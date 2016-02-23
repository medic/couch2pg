var Promise = require('../common').Promise;

//var xmleng = require('pixl-xml');

exports.fetchAndParseReports = function() {
  // fetches a list of UUIDs of reports in the couch database.
  return new Promise(function (resolve) {
    return resolve('Fail!');
  });
};

exports.storeMetaData = function() {
  // stores metadata from a list of objects fashioned as defined in
  // pgsql.writeReportMetaData()
  return new Promise(function (resolve) {
    return resolve('Fail!');
  });
};

exports.storeReports = function() {
  // stores form field data from a list of objects fashioned as defined in
  // pgsql.writeReportMetaData() ... which also applies to
  // pgsql.writeReportContents()
  return new Promise(function (resolve) {
    return resolve('Fail!');
  });
};
