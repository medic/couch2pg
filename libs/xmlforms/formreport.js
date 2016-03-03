var parseInstanceXML = require('./formdef').parseInstanceXML;

exports.fetchAndParseReports = function(db, pgsql) {
  // fetches all reports that aren't yet processed
  // returns dataset of form fields and form reports organized by tablename
  // { "formview_formname_version": {
  //    "fields": [...]
  //    "docs": [...] }, ... }
  return db.query(pgsql.fetchMissingReportContents()).then(function (data) {
    var dataset = {};
    Object.keys(data).forEach(function (i) {
      // extract XML and add a root tag around it to reuse existing code
      // which expects wrapper
      var flatxml = parseInstanceXML('<instance>' + data[i].xml + '</instance>');
      var formname = flatxml.formname;
      var formversion = flatxml.jsondata._Attribs.version;
      var table = 'formview_' + formname + '_' + formversion;

      // establish a place for this table if it hasn't been seen before
      if (dataset[table] === undefined) {
        dataset[table] = {
          'fields': [],
          'docs': []
        };
      }

      // build object from nested field names
      var xmldict = {};
      flatxml.fields.forEach(function (field) {
        // use single strings to resolve deeply nested properties
        // adapted from http://stackoverflow.com/a/22129960/1867779
        xmldict[field] = field.split('/').reduce(function(prev, curr) {
          return  prev ? prev[curr] : undefined;
        }, flatxml.jsondata);
      });

      // establish fields from current report if no fields are yet defined
      // for this table
      if (dataset[table].fields.length === 0) {
        dataset[table].fields = Object.keys(xmldict);
      }

      // add current report including meta data and parsed XML
      dataset[table].docs.push({
        'id': data[i].uuid,
        'formname': formname,
        'formversion': formversion,
        'chw': data[i].chw,
        'reported': data[i].reported,
        'xml': xmldict
      });
    });
    return dataset;
  });
};

exports.createTables = function(db, pgsql, tableObjects) {
  // takes in objects sorted by table
  // as output from fetchAndParseReports()
  // and creates tables for each
  
  // map tableObjects into
  // { "table": [ fields ], ... }
  var tableFields = {};
  Object.keys(tableObjects).forEach(function (k) {
    tableFields[k] = tableObjects[k].fields;
  });
  return db.query(pgsql.putFormViews(tableFields))
         // return tableObjects, not "yay creates!" messages
         .then(function () {
           return tableObjects;
         });
};

exports.storeMetaData = function(db, pgsql, tableObjects) {
  // stores form metadata from a list of objects fashioned
  // as output from fetchAndParseReports()

  // extract all docs into a single list
  var formContents = [];
  Object.keys(tableObjects).forEach(function (k) {
    tableObjects[k].docs.forEach(function (doc) {
      formContents.push(doc);
    });
  });

  return db.query(pgsql.writeReportMetaData(formContents))
         // return tableObjects, not "yay inserts!" messages
         .then(function () {
           return tableObjects;
         });
};

exports.storeReports = function(db, pgsql, objects, formDefs) {
  // stores form field data from a list of objects fashioned
  // as output from fetchAndParseReports()
  return db.query(pgsql.writeReportContents(objects, formDefs));
};
