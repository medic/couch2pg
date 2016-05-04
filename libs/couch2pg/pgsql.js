var scrub = require('../common').scrub;

function getFromEnv() {
  var config = {};
  config.jsonTable = process.env.POSTGRESQL_TABLE;
  config.jsonCol = process.env.POSTGRESQL_COLUMN;
  return config;
}

exports.createTable = function() {
  var c = getFromEnv();
  return scrub('CREATE TABLE %I (%I jsonb); CREATE INDEX %I ON %I ( (%I->>\'_id\') ); CREATE INDEX %I ON %I ( (%I->>\'type\') ); CREATE INDEX %I ON %I USING GIN ( (%I->\'_attachments\') );', c.jsonTable, c.jsonCol, [c.jsonTable, c.jsonCol, 'uuid'].join('_'), c.jsonTable, c.jsonCol, [c.jsonTable, c.jsonCol, 'type'].join('_'), c.jsonTable, c.jsonCol, [c.jsonTable, c.jsonCol, 'attachments'].join('_'), c.jsonTable, c.jsonCol);
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
