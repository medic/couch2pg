var POSTGRESQL_URL = process.env.POSTGRESQL_URL,
    COUCH2PG_DEBUG = process.env.COUCH2PG_DEBUG;

var _ = require('underscore');
var pglib = require('pg-promise');

var Promise = require('rsvp').Promise;

var formreport = require('./formreport');
var pgsql = require('./pgsql');
var cleaner = require('./cleaner');
var postgrator = require('postgrator');

var exports = module.exports = {};
exports.extract = function (changedDocIds) {
  if (changedDocIds || changedDocIds.length < 0) {
    if (COUCH2PG_DEBUG) {
      console.log('No changes, no need to run xmlforms');
    }

    return;
  }

  var db;
  return pglib({ 'promiseLib': Promise })(process.env.POSTGRESQL_URL)
    .connect()
    .then(function (this_db) {
      db = this_db;
    })
    .then(function () {
      if (COUCH2PG_DEBUG) {
        console.log('cleaning up ' + changedDocIds.length + ' changed documents');
      }

      return cleaner.clean(db, changedDocIds);
    })
    .then(function () {
      if (COUCH2PG_DEBUG) {
        console.log('find unparsed reports and parse them');
      }
      return formreport.fetchAndParseReports(db, pgsql);
    })
    .then(function (reports) {
      if (COUCH2PG_DEBUG) {
        console.log('create form tables to store reports');
      }

      if (_.isEmpty(reports)) {
        return new Promise(function(succ) { succ(); });
      } else {
        return formreport.createTables(db, pgsql, reports)
          .then(function (reports) {
            if (COUCH2PG_DEBUG) {
              console.log('writing report metadata to database');
            }
            return formreport.storeMetaData(db, pgsql, reports);
          })
          .then(function (reports) {
            if (COUCH2PG_DEBUG) {
              console.log('writing report data to database');
            }
            return formreport.storeReports(db, pgsql, reports);
          })
          .then(function () {
            if (COUCH2PG_DEBUG) {
              console.log('refreshing materialized views');
            }
            return db.query(pgsql.refreshMatViews());
          });
      }
    })
    .catch(function(err) {
      console.log('An error occured', err);
    })
    .finally(function () {
      if (COUCH2PG_DEBUG) {
        console.log('done. releasing database connection');
      }
      if (db) {
        db.done();
      }
    });
};

exports.migrate = function() {
  return new Promise(function (resolve, reject) {
    postgrator.setConfig({
      migrationDirectory: __dirname + '/migrations',
      schemaTable: 'xmlforms_migrations',
      driver: 'pg',
      connectionString: POSTGRESQL_URL
    });

    postgrator.migrate('201606201000', function(err, migrations) {
      if (err) {
        reject(err);
      } else {
        postgrator.endConnection(function() {
          resolve(migrations);
        });
      }
    });
  });
};
