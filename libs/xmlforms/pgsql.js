var format = require('pg-format');

exports.getFormDefinitionsXML = function() {
  return ['SELECT doc->>\'_rev\' AS version, (doc #> \'{_attachments,xml,data}\') AS form',
          'FROM coucdb WHERE doc->>\'type\' = \'form\' AND doc->\'_attachments\' ? \'xml\';'].join(' ');
};

exports.putFormList = function(formlist) {
  // expect formlist to be of the format ['form1', 'form2', ...]
  formlist = formlist.map(function (formname) {
    return format('(%L)', formname);
  }).join(',');
  return 'DROP TABLE IF EXISTS form_list; CREATE TABLE form_list (name TEXT); INSERT INTO form_list VALUES ' + formlist;
};

exports.fetchMissingReportContents = function() {
  return ['SELECT doc->>\'_id\' AS uuid, doc->>\'reported_date\' AS reported,',
          'doc#>\'{contact,parent,_id}\' AS area, doc#>\'{contact,_id}\' AS chw,',
          'doc->>\'content\' AS xml FROM couchdb',
          'LEFT OUTER JOIN form_metadata AS fmd ON (fmd.uuid = doc->>\'_id\')',
          'WHERE doc @> \'{"type": "data_record"}\'::jsonb AND doc ? \'form\'',
          'AND fmd.uuid IS NULL;'].join(' ');
};

exports.putFormViews = function(tabledef) {
  // expects an obj of {
  //   'formview_formname_formversion': ['field1','field2',...],
  //   ...
  //  }
  var manyQueries = '';
  Object.keys(tabledef).forEach(function (tableName) {
    // map the fields to include a type
    manyQueries += format('CREATE TABLE IF NOT EXISTS %I (', tableName);
    // format field names and append TEXT type to each
    var fields = tabledef[tableName].map(function (attr) {
      return format('%I', attr) + ' TEXT';
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
  return format('INSERT INTO form_metadata (uuid, chw, chw_area, formname, formversion, reported) VALUES %L;', values);
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
    inserts += format('INSERT INTO %I (%I) VALUES %L;', tableName, fields, values);
  });
  return inserts;
};

exports.refreshMatViews = function() {
  return 'SELECT refresh_matviews();';
};
