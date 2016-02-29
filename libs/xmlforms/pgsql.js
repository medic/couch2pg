var scrub = require('pg-format');

function getFromEnv() {
  var config = {};
  config.jsonTable = process.env.POSTGRESQL_TABLE;
  config.jsonCol = process.env.POSTGRESQL_COLUMN;
  return config;
}

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

exports.putFormViews = function(formdef) {
  // expects an obj of {
  //   'form1': {
  //     'fields': ['field1','field2',...],
  //     'version': 'x'
  //  },
  //  'form2':
  //    ...
  var manyQueries = '';
  Object.keys(formdef).forEach(function (formName) {
    var thisForm = formdef[formName];
    manyQueries += scrub('CREATE TABLE IF NOT EXISTS %I (',
                         'formview_' + formName + '_' + formdef[formName].version);
    var fields = thisForm.fields.map(function (attr) {
      return scrub('%I', attr) + ' TEXT';
    }).join(',');
    manyQueries += fields + ');';
  });
  return manyQueries;
};

exports.fetchMissingReportContents = function() {
  var c = getFromEnv();
  // reduce database calls by appending a CREATE with new return value.
  var create = 'CREATE TABLE IF NOT EXISTS form_metadata (uuid TEXT, chw TEXT, formname TEXT, formversion TEXT, reported TIMESTAMP); ';
  // grab specific report fields for each report in Couch but not in formmeta
  var get_contents = scrub('SELECT %I->>\'_id\' AS uuid, %I->>\'reported_date\' AS reported, %I#>\'{contact,parent,_id}\' AS chw, %I->>\'content\' AS xml FROM %I LEFT OUTER JOIN form_metadata AS fmd ON (fmd.uuid = %I->>\'_id\') WHERE %I @> \'{"type": "data_record"}\'::jsonb AND %I ? \'form\' AND fmd.uuid IS NULL;', c.jsonCol, c.jsonCol, c.jsonCol, c.jsonCol, c.jsonTable, c.jsonCol, c.jsonCol, c.jsonCol);
  return create + get_contents;
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
    return [el.id, el.chw, el.formname, el.formversion,
            // map epochs to UTC dates
            new Date(parseInt(el.reported)).toUTCString()];
  });
  return scrub('INSERT INTO form_metadata (uuid, chw, formname, formversion, reported) VALUES %L;', values);
};

var tableToForm = function(table) {
  // spearate formview_ off.
  // separate _year[ hh:mm:ss] off the end
  return table.split('formview_')[1].split('_').slice(0,-1).join('_');
};

exports.writeReportContents = function(objs, tabledefs) {
  // expect same objs as writeFormMetaData
  // tabledefs should be: {
  //   'tablename': {
  //     'fields': ['col1','col2','col3'...],
  //     'version': 'date'
  //   }, ...
  // }
  // this format is produced by formdef.parseFormDefXML()

  // sort objects into separate tables
  var dataset = {};
  objs.forEach(function (el) {
    var table = 'formview_' + el.formname + '_' + el.formversion;
    // create list for table if one doesn't exist
    if (dataset[table] === undefined) {
      dataset[table] = [];
    }
    // store elements by their table
    dataset[table].push(el);
  });

  // perform inserts grouped as one per table.
  return Object.keys(dataset).filter(function (table) {
    // skip any tables which are not found in the table definitions
    if (tabledefs[tableToForm(table)] === undefined) {
      return false;
    } else {
      return true;
    }
  }).map(function (table) {
    // reduce table name back to base form name
    var form = tableToForm(table);
    // order element fields of objects for this table using tabledef
    var orderedDataset = dataset[table].map(function (el) {
      // use tabledef field order
      // only one version for any form definition can be found for now.
      return tabledefs[form].fields.map(function (field) {
        // return element's values for tabledef's field
        return el.xml[field];
      });
    });

    // prepare insert definition
    return scrub('INSERT INTO %I (%I) VALUES %L', table, tabledefs[form].fields, orderedDataset);
  }).join('; ');
};
