// move data from couch to postgres.
var pglib = require('pg-promise');

// import the correct lib for web content:
// travis couchdb does not support HTTPS, but prod systems require HTTPS
var httplib = require('request');

var Promise = require('../common').Promise;

var cdbfuncs = require('./cdbfuncs');
var couchiter = require('./couchiter');
var pgsql = require('./pgsql');

module.exports = function () {
  var sco;

  // establish a single connection to postgresql
  return pglib({ 'promiseLib': Promise })(process.env.POSTGRESQL_URL)
    .connect()
    .then(function(cnxn) {
      sco = cnxn;
    })
  // extract all document UUIDs from Couch and convert to objects
    .then(function() {
      return cdbfuncs.fetchDocs(httplib, process.env.COUCHDB_URL, false);
    })
    .then(couchiter.extractUUIDFromCouchDump)
  // filter out UUIDs that are already in Postgres
    .then(function(uuids) {
      return couchiter.skipExistingInPG(sco, pgsql, uuids);
    })
  // reduce total number of UUIDs requested if desired
    .then(function(uuids) {
      return couchiter.reduceUUIDs(uuids, process.env.COUCH2PG_DOC_LIMIT);
    })
  // extract all missing UUIDs documents from Couch and convert to objects
    .then(function(uuids) {
      return cdbfuncs.fetchDocs(httplib, process.env.COUCHDB_URL, true, uuids);
    })
    .then(couchiter.extractFromCouchDump)
  // and push the individual documents into postgres
    .then(function (documents) {
      return couchiter.insertListToPG(sco, pgsql, documents);
    })
  // close the db connection and other cleanup
    .finally(function () {
      if (sco) {
        sco.done();
      }
    });
};
