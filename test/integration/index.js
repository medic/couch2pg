var httplib = require('request');
var pgplib = require('pg-promise');
var scrub = require('pg-format');
var url = require('url');

var common = require('../common');
var expect = common.expect;
var Promise = common.Promise;
var handleError = common.handleError;
var handleReject = common.handleReject;

var couch2pg = require('../../index');

// prebuild the query string with table and column references
var pgcol = process.env.POSTGRESQL_COLUMN;
var pgtab = process.env.POSTGRESQL_TABLE;
var queryStr = scrub('SELECT %I FROM %I WHERE %I->>\'_id\' = %%L AND %I->>\'_rev\' = %%L;', pgcol, pgtab, pgcol, pgcol);
var appQueryStr = scrub('SELECT %I->\'app_settings\'->\'schedules\'->0->\'messages\' FROM %I WHERE %I->\'app_settings\'->\'schedules\'->0 ? \'messages\';', pgcol, pgtab, pgcol);
var countQueryStr = scrub('SELECT COUNT(%I) FROM %I;', pgcol, pgtab);

// postgres connection
var pgp = pgplib({ 'promiseLib': Promise });
var db = pgp(process.env.POSTGRESQL_URL);

// backup the env URL
var couchdb_url_bu = process.env.COUCHDB_URL;

// determine how many rows are in the database
var n_docs;
var fetch_rows = new Promise(function (resolve, reject) {
  // perform a request for no keys to get back only the db doc count
  httplib.post({
    url: process.env.COUCHDB_URL,
    form: '{"keys": []}'
  }, function (err, httpResponse, body) {
    if (err) {
      return handleReject(reject)(err);
    }
    return resolve(parseInt(JSON.parse(body).total_rows));
  });
});

// verify postgres and couch match!
function couch_in_postgres(done) {
  // fetch all documents out of couch
  httplib.get({ url: process.env.COUCHDB_URL },
              function (err, httpResponse, buffer) {
    if (err) {
      return done(err);
    }

    // document download completed
    var data = JSON.parse(buffer);
    // setup a single connection for a series of thenable queries
    var sco;
    var queries = db.connect()
      .then(function(cnxn) {
        sco = cnxn;
      });
    // iterate over all documents
    data.rows.forEach(function (row) {

      // confirm each doc is in postgres
      var uuid = row.id;
      var rev = row.value.rev;
      var thisQuery = scrub(queryStr, uuid, rev);
      // skip design docs
      if (uuid.slice(0,7) === '_design') { return; }
      // iterative step: order queries with then
      queries = queries.then(function () {
        return sco.query(thisQuery);
      }, handleError)
        .then(function(result) {
          if (result[0] === undefined) {
            throw Error('cannot find result for query: ' + thisQuery);
          }
          var obj = result[0][pgcol];
          return expect(obj).deep.equals(row.doc);
        }, handleError);
    });
    // mark completion when the last promise has returned
    queries.then(function () {
        done();
    }).catch(function (err) {
      done(err);
    }).finally(function () {
      if (sco) {
        // close the database connection
        sco.done();
      }
    });
  });
}

function run_pre_tasks(done, f_buildurl, f_restoreurl) {
  fetch_rows.then(function (total_rows) {
    n_docs = total_rows;
  }, function (err) {
    done(err);
  }).then(f_buildurl).then(couch2pg).catch(function (err) {
    done(err);
  }).then(f_restoreurl);
}

describe('base import of couchdb integration', function() {
  before(function (done) {

    run_pre_tasks(done, function () {
      // restore couchdb URL backup
      var url_pieces = url.parse(couchdb_url_bu);
      // set the query to limit to the first half of the docs
      if ((url_pieces.search === null) || (url_pieces.search === undefined)) {
        url_pieces.search = '?';
      } else {
        url_pieces.search = url_pieces.search + '&';
      }
      url_pieces.search = url_pieces.search + 'limit=' + Math.floor(n_docs/2);
      // configure the new URL for couch2pg and this test
      process.env.COUCHDB_URL = url.format(url_pieces);
    }, function () {
      // leave env URL unchanged for this phase of testing
      done();
    });
  });

  after(function () {
    // restore couchdb URL to the env
    process.env.COUCHDB_URL = url.format(couchdb_url_bu);
  });

  it('imports as many rows as there are expected docs', function (done) {
    // compare couchdb doc count (n_docs) to postgres rows.
    db.one(countQueryStr).then(function (row) {
      var docs = parseInt(row.count);
      expect(docs).to.equal(Math.floor(n_docs/2));
    }, function (err) {
      done(err);
    }).then(done, function (err) {
      done(err);
    });
  });

  it('moves expected non-design documents to postgres', function(done) {
    couch_in_postgres(done);
  });

});

describe('iterative step of couchdb integration', function() {
  before(function (done) {
    run_pre_tasks(done, function () {
      // restore couchdb URL backup
      var url_pieces = url.parse(couchdb_url_bu);
      // configure the new URL for couch2pg and this test
      process.env.COUCHDB_URL = url.format(url_pieces);
    }, function () {
      // restore URL to grab full couchdb to test against
      process.env.COUCHDB_URL = url.format(couchdb_url_bu);
      done();
    });
  });

  it('imports as many rows as there are total docs', function (done) {
    // compare couchdb doc count (n_docs) to postgres rows.
    db.one(countQueryStr).then(function (row) {
      var docs = parseInt(row.count);
      expect(docs).to.equal(n_docs);
    }, function (err) {
      done(err);
    }).then(done, function (err) {
      done(err);
    });
  });

  it('moves all non-design documents to postgres', function(done) {
    couch_in_postgres(done);
  });

});

describe('full import', function() {

  it('puts a doc with app_settings into postgres', function() {
    // ideally: fetch app settings from the webapp and compare.
    // however app settings might change, something to do with defaults.
    // also good: grab a subset, like schedules and compare those.
    // there's no obvious API for that yet without grabbing the whole doc.
    // for now, just make sure the database has a doc with app_settings in it.
    return expect(db.one(appQueryStr)).to.eventually.be.fulfilled;
  });

});
