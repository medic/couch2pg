var Promise = require('rsvp').Promise,
    postgrator = require('postgrator'),
    importer = require('./importer');

var COUCHDB_URL  = process.env.COUCHDB_URL,
    POSTGRESQL_URL = process.env.POSTGRESQL_URL,
    COUCH2PG_DOC_LIMIT = process.env.COUCH2PG_DOC_LIMIT;

var couchdb = require('pouchdb')(COUCHDB_URL),
    db = require('pg-promise')({ 'promiseLib': Promise })(POSTGRESQL_URL);

var exports = module.exports = {};
exports.import = function() {
  return importer(db, couchdb, COUCH2PG_DOC_LIMIT).import();
};

exports.migrate = function() {
  return new Promise(function (resolve, reject) {
    postgrator.setConfig({
      migrationDirectory: __dirname + '/migrations',
      schemaTable: 'couch2pg_migrations',
      driver: 'pg',
      connectionString: POSTGRESQL_URL
    });

    postgrator.migrate('002', function(err, migrations) {
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
