var pglib = require('pg-promise');

var Promise = require('../common').Promise;
var handleError = require('../common').handleError;

var contacts = require('./contacts');
var formreport = require('./formreport');
var pgsql = require('./pgsql');

module.exports = function () {
  var db;
  return pglib({ 'promiseLib': Promise })(process.env.POSTGRESQL_URL)
    .connect()
    .then(function (this_db) {
      db = this_db;
    })
    .then(function () {
      console.log('checking if contacts are needed and missing');
      return contacts.contactsNeeded(db, pgsql);
    })
    .then(function (needed) {
      console.log('contacts needed? ' + needed);
      console.log('adding if necessary.');
      return contacts.addContacts(db, pgsql, needed);
    })
    .then(function () {
      console.log('checking if form metadata is missing');
      return formreport.formMetadataNeeded(db, pgsql);
    })
    .then(function (needed) {
      console.log('metadata table needed? ' + needed);
      console.log('adding if necessary.');
      return formreport.addFormMetadata(db, pgsql, needed);
    })
    .then(function () {
      console.log('find unparsed reports and parse them');
      return formreport.fetchAndParseReports(db, pgsql);
    }, handleError)
    .then(function (reports) {
      console.log('create form tables to store reports');
      return formreport.createTables(db, pgsql, reports);
    }, handleError)
    .then(function (reports) {
      console.log('writing report metadata to database');
      return formreport.storeMetaData(db, pgsql, reports);
    }, handleError)
    .then(function (reports) {
      console.log('writing report data to database');
      return formreport.storeReports(db, pgsql, reports);
    }, handleError)
    .then(function () {
      console.log('refreshing materialized views');
      return db.query(pgsql.refreshMatViews());
    }, handleError)
    .catch(handleError)
    .finally(function () {
      console.log('done. releasing database connection');
      if (db) {
        db.done();
      }
    });
};
