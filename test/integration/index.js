var httplib = require('http');
var pgplib = require('pg-promise');
var scrub = require('pg-format');
var request = require('request');

var all = require('rsvp').all;

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

// postgres connection
var pgp;
var db;

// backup the env URL
var couchdb_url = process.env.COUCHDB_URL;

// determine how many rows are in the database
var n_docs;
var fetch_rows = new Promise(function (resolve, reject) {
  // perform a request for no keys to get back only the db doc count
  request.post({
    url: couchdb_url,
    form: '{"keys": []}'
  }, function (err, httpResponse, body) {
    if (err) {
      return handleReject(reject)(err);
    }
    return resolve(parseInt(JSON.parse(body).total_rows));
  });
});

describe('Integration', function() {
  before(function (done) {
    var todo = [];

    todo.push(fetch_rows.then(function (total_rows) {
      n_docs = total_rows;
    }, function (err) {
      done(err);
    }));

    todo.push(couch2pg().then(function () {
      done();
    }, function (err) {
      done(err);
    }));

    // connect to postgres
    pgp = pgplib({ 'promiseLib': Promise });
    db = pgp(process.env.POSTGRESQL_URL);

    all(todo).then(function () {done();});
  });

  it('fetches non-zero doc count', function () {
    // make sure there are documents to be fetched.
    return expect(n_docs).to.be.gt(0);
  });

  it('moves all non-design documents to postgres', function(done) {
    // fetch all documents out of couch
    var buffer = '';
    var incoming = httplib.request(process.env.COUCHDB_URL);
    incoming.on('response', function (res) {
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        buffer = buffer + new Buffer(chunk);
      });
      res.on('end', function() {
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
          })
          .catch(function (err) {
            done(err);
          })
          .finally(function () {
            if (sco) {
              // close the database connection
              sco.done();
            }
          });
      });
    });
    incoming.end();
  });

  it('puts a doc with app_settings into postgres', function() {
    // ideally: fetch app settings from the webapp and compare.
    // however app settings might change, something to do with defaults.
    // also good: grab a subset, like schedules and compare those.
    // there's no obvious API for that yet without grabbing the whole doc.
    // for now, just make sure the database has a doc with app_settings in it.
    var queryAppSettings = scrub('SELECT %I->\'app_settings\'->\'schedules\'->0->\'messages\' FROM %I WHERE %I->\'app_settings\'->\'schedules\'->0 ? \'messages\';', pgcol, pgtab, pgcol);
    return expect(db.one(queryAppSettings)).to.eventually.be.fulfilled;
  });

});
