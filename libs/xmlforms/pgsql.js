var scrub = require('pg-format');
var fs = require('fs');

function getFromEnv() {
  var config = {};
  config.jsonTable = process.env.POSTGRESQL_TABLE;
  config.jsonCol = process.env.POSTGRESQL_COLUMN;
  return config;
}

exports.checkForContacts = function() {
  var c = getFromEnv();
  // return version and 1 materialized view name (if any)
  return scrub('SELECT LEFT(%I#>>\'{kanso,config,version}\',3)::NUMERIC AS version, matviewname FROM %I LEFT OUTER JOIN pg_catalog.pg_matviews ON (true) WHERE %I->>\'_id\' = \'_design/medic\' LIMIT 1;', c.jsonCol, c.jsonTable, c.jsonCol);
};

exports.initializeContacts = function() {
  return fs.readFileSync('./prepareContacts.sql');
};

exports.getFormDefinitionsXML = function() {
  var c = getFromEnv();
  // it is important (yet arbitrary) to name the field "form"
  return scrub('SELECT %I->>\'_rev\' AS version, (%I #> \'{_attachments,xml,data}\') AS form FROM %I WHERE %I->>\'type\' = \'form\' AND %I->\'_attachments\' ? \'xml\';', c.jsonCol, c.jsonCol, c.jsonTable, c.jsonCol, c.jsonCol);
};

exports.putFormList = function(formlist) {
  // expect formlist to be of the format ['form1', 'form2', ...]
  formlist = formlist.map(function (formname) {
    return scrub('(%L)', formname);
  }).join(',');
  return 'DROP TABLE IF EXISTS form_list; CREATE TABLE form_list (name TEXT); INSERT INTO form_list VALUES ' + formlist;
};

exports.fetchMissingReportContents = function() {
  var c = getFromEnv();
  // reduce database calls by appending a CREATE with no return value.
  // add a bunch of indices while we're about
  var create = 'CREATE TABLE IF NOT EXISTS form_metadata (uuid TEXT, chw TEXT, chw_area TEXT, formname TEXT, formversion TEXT, reported TIMESTAMP); CREATE INDEX form_metadata_uuid ON form_metadata (uuid); CREATE INDEX form_metadata_chw ON form_metadata (chw); CREATE INDEX form_metadata_reported ON form_metadata (reported); CREATE INDEX form_metadata_formname ON form_metadata (formname); CREATE INDEX form_metadata_formversion ON form_metadata (formname, formversion); ';
  // grab specific report fields for each report in Couch but not in formmeta
  var get_contents = scrub('SELECT %I->>\'_id\' AS uuid, %I->>\'reported_date\' AS reported, %I#>\'{contact,parent,_id}\' AS area, %I#>\'{contact,_id}\' AS chw, %I->>\'content\' AS xml FROM %I LEFT OUTER JOIN form_metadata AS fmd ON (fmd.uuid = %I->>\'_id\') WHERE %I @> \'{"type": "data_record"}\'::jsonb AND %I ? \'form\' AND fmd.uuid IS NULL;', c.jsonCol, c.jsonCol, c.jsonCol, c.jsonCol, c.jsonCol, c.jsonTable, c.jsonCol, c.jsonCol, c.jsonCol);
  return create + get_contents;
};

exports.putFormViews = function(tabledef) {
  // expects an obj of {
  //   'formview_formname_formversion': ['field1','field2',...],
  //   ...
  //  }
  var manyQueries = '';
  Object.keys(tabledef).forEach(function (tableName) {
    // map the fields to include a type
    manyQueries += scrub('CREATE TABLE IF NOT EXISTS %I (', tableName);
    // scrub field names and append TEXT type to each
    var fields = tabledef[tableName].map(function (attr) {
      return scrub('%I', attr) + ' TEXT';
    }).join(',');
    // finalize CREATE TABLE
    manyQueries += fields + ');';
  });
  return manyQueries;
};

exports.writeReportMetaData = function (objs) {
  // expect input objects to be a list of {
  //   'id': 'uuid', 'formname': 'name', 'formversion': 'date',
  //   'chw': 'uuid', 'reported': 'epoch', 'xml': {
  //     'flattened': 'version', 'of': 'xml'
  //   }
  // }

  if ((!objs) || (objs.length === 0)) {
    // null op if there's nothing to do.
    return '';
  }

  // extract relevant values in the order defined below
  var values = objs.map(function (el) {
    return [el.id, el.chw, el.area, el.formname, el.formversion,
            // map epochs to UTC dates
            new Date(parseInt(el.reported)).toUTCString()];
  });
  return scrub('INSERT INTO form_metadata (uuid, chw, chw_area, formname, formversion, reported) VALUES %L;', values);
};

exports.writeReportContents = function(objs) {
  // take in list of { 'tablename':
  //   'fields': [...],
  //   'docs': [...]
  // }, ... }
  // and write each contained doc to the proper table
  var inserts = '';
  // prepare one INSERT for each table
  Object.keys(objs).forEach(function (tableName) {
    var table = objs[tableName];
    var fields = table.fields;
    // compress all values into a list of lists in the same order as fields.
    var values = table.docs.map(function (doc) {
      // order by fields
      return fields.map(function (field) {
        // extract each field's value from doc
        return doc.xml[field];
      });
    });
    inserts += scrub('INSERT INTO %I (%I) VALUES %L;', tableName, fields, values);
  });
  return inserts;
};
