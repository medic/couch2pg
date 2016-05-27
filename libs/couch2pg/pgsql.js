var scrub = require('../common').scrub;

function getFromEnv() {
  var config = {};
  config.jsonTable = 'couchdb';
  config.jsonCol = 'doc';
  return config;
}

exports.insertIntoColumn = function(data) {
  var c = getFromEnv();
  return scrub('INSERT INTO %I (%I) VALUES %L;', c.jsonTable, c.jsonCol, data);
};

exports.fetchEntries = function () {
  var c = getFromEnv();
  return scrub('SELECT %I->\'_id\' AS _id, %I->\'_rev\' AS _rev FROM %I', c.jsonCol, c.jsonCol, c.jsonTable);
};
