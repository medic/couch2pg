var scrub = require('pg-format');

function getFromEnv() {
  var config = {};
  config.jsonTable = process.env.POSTGRESQL_TABLE;
  config.jsonCol = process.env.POSTGRESQL_COLUMN;
  return config;
}

exports.createTable = function() {
  var c = getFromEnv();
  return scrub('CREATE TABLE %I (%I jsonb);', c.jsonTable, c.jsonCol);
};

exports.addColumnToTable = function() {
  var c = getFromEnv();
  return scrub('ALTER TABLE %I ADD COLUMN %I jsonb;', c.jsonTable, c.jsonCol);
};

exports.checkTableSyntax = function() {
  var c = getFromEnv();
  return scrub('SELECT count(%I) FROM %I;', c.jsonCol, c.jsonTable);
};

exports.insertIntoColumn = function(data) {
  var c = getFromEnv();
  return scrub('INSERT INTO %I (%I) VALUES %L;', c.jsonTable, c.jsonCol, data);
};

exports.fetchEntries = function () {
  var c = getFromEnv();
  return scrub('SELECT %I->\'_id\' AS _id, %I->\'_rev\' AS _rev FROM %I', c.jsonCol, c.jsonCol, c.jsonTable);
};
