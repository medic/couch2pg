var Promise = require('../common').Promise;

var xmleng = require('pixl-xml');

// modified from
// http://stackoverflow.com/questions/19628912/flattening-nested-arrays-objects-in-underscore-js
var flattenObj = function(x, result, prefix) {
  if((x !== null) && (typeof(x) === 'object')) {
    Object.keys(x).forEach(function(k) {
      flattenObj(x[k], result, prefix ? prefix + '/' + k : k);
    });
  } else {
    result[prefix] = x;
  }
  return result;
};

var parseInstanceXML = function(xml) {
  // parse to json
  var jsondata = xmleng.parse(xml, { 'preserveAttributes': true } );
  // pick off form's name
  var formname = xmleng.hashKeysToArray(jsondata)[0];
  // skip contact forms (for now)
  if (formname === 'data') {
    return;
  }
  // grab subset of data
  jsondata = jsondata[formname];
  // flatten the leaf tags
  var flattaglist = Object.keys(flattenObj(jsondata, {}));
  // filter out anything containing `_Attribs`. tag attributes not needed.
  flattaglist = flattaglist.filter(function (el) {
    return el.indexOf('_Attribs') === -1;
  });
  return {
    'formname': formname,
    'jsondata': jsondata,
    'fields': flattaglist
  };
};

exports.formMetadataNeeded = function(db, pgsql) {
  return db.query(pgsql.checkFormMetadata())
         .then(function (rows) {
           // convert "exists" into "needed"
           return !rows[0].exists;
         });
};

exports.addFormMetadata = function(db, pgsql, needed) {
  if (needed) {
    return db.query(pgsql.initializeFormMetadata());
  } else {
    return new Promise(function (resolve) {
      return resolve();
    });
  }
};

exports.fetchAndParseReports = function(db, pgsql) {
  // fetches all reports that aren't yet processed
  // returns dataset of form fields and form reports organized by tablename
  // { "formview_formname_version": {
  //    "fields": [...]
  //    "docs": [...] }, ... }
  return db.query(pgsql.fetchMissingReportContents()).then(function (data) {
    var dataset = {};
    Object.keys(data).forEach(function (i) {
      // skip docs with empty XML and skip contacts reports
      if (!data[i].xml || data[i].xml.slice(0,5) === '<data') {
        return;
      }

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

      // inject special xmlforms_uuid field so that the form's UUID as
      // determined for metadata is always accessible from an obvious location.
      xmldict.xmlforms_uuid = data[i].uuid;

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
        'area': data[i].area,
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

exports.storeReports = function(db, pgsql, objects) {
  // stores form field data from a list of objects fashioned
  // as output from fetchAndParseReports()
  return db.query(pgsql.writeReportContents(objects));
};
