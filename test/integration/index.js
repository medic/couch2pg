var httplib = require('http');
var pgplib = require('pg-promise');
var scrub = require('pg-format');

var common = require('../common');
var expect = common.expect;
var Promise = common.Promise;

var handleError = require('../common').handleError;

var couch2pg = require('../../index');

// prebuild the query string with table and column references
var pgcol = process.env.POSTGRESQL_COLUMN;
var pgtab = process.env.POSTGRESQL_TABLE;
var queryStr = scrub('SELECT %I FROM %I WHERE %I->>\'_id\' = %%L AND %I->>\'_rev\' = %%L;', pgcol, pgtab, pgcol, pgcol);

describe('Integration', function() {

  before(function (done) {
    couch2pg().then(function () {
      done();
    }, function (err) {
      done(err);
    });
  });

  it('moves all documents to postgres', function(done) {
    // connect to postgres
    var pgp = pgplib({ 'promiseLib': Promise });
    var db = pgp(process.env.POSTGRESQL_URL);

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

});
