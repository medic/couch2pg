// move data from couch to postgres.
var pglib = require('pg-promise');

// import the correct lib for web content:
// travis couchdb does not support HTTPS, but prod systems require HTTPS
var httplib = null;
if (process.env.COUCHDB_URL.slice(0,6) === 'https:') {
  httplib = require('https');
}
if (process.env.COUCHDB_URL.slice(0,5) === 'http:') {
  httplib = require('http');
}
if (httplib === null) {
  throw new Error('Invalid URL scheme: ' + process.env.COUCHDB_URL);
}

var Promise = require('./common').Promise;

var cdbfuncs = require('./cdbfuncs');
var couchiter = require('./couchiter');
var pgsql = require('./pgsql');
var pgfuncs = require('./pgfuncs');

module.exports = function () {
  var sco;
  // establish a single connection to postgresql
  return pglib({ 'promiseLib': Promise })(process.env.POSTGRESQL_URL)
    .connect()
    .then(function(cnxn) {
      sco = cnxn;
    })
  // ensure a table exists to receive JSON data in postgres
    .then(function() {
      pgfuncs.initializeDatabase(pgsql, sco);
    })
  // extract all documents from Couch
    .then(function() {
      return cdbfuncs.fetchDocs(httplib, process.env.COUCHDB_URL);
    })
    .then(couchiter.extractFromCouchDump)
  // and push the individual documents into postgres
    .then(function (documents) {
      return couchiter.insertListToPG(sco, pgsql, documents);
    });
};
