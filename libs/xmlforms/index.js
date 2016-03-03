var pglib = require('pg-promise');

var Promise = require('../common').Promise;
var handleError = require('../common').handleError;

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
      console.log('create metadata table');
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
    .catch(handleError)
    .finally(function () {
      console.log('done. releasing database connection');
      if (db) {
        db.done();
      }
    });
};
