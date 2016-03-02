var parseInstanceXML = require('./formdef').parseInstanceXML;

exports.fetchAndParseReports = function(db, pgsql) {
  // fetches a list of UUIDs of reports in the couch database.
  return db.query(pgsql.fetchMissingReportContents()).then(function (data) {
    return Object.keys(data).map(function (i) {
      // extract XML and add a root tag around it to reuse existing code
      // which expects wrapper
      var flatxml = parseInstanceXML('<instance>' + data[i].xml + '</instance>');
      // build object from nested field names
      var xmldict = {};
      flatxml.fields.forEach(function (field) {
        // use single strings to resolve deeply nested properties
        // adapted from http://stackoverflow.com/a/22129960/1867779
        xmldict[field] = field.split('/').reduce(function(prev, curr) {
          return  prev ? prev[curr] : undefined;
        }, flatxml.jsondata);
      });
      // return object with expected properties
      return {
        'id': data[i].uuid,
        'formname': flatxml.formname,
        'formversion': flatxml.jsondata._Attribs.version,
        'chw': data[i].chw,
        'reported': data[i].reported,
        'xml': xmldict
      };
    });
  });
};

exports.createTables = function(db) {
  return db.query('FAIL!');
};

exports.storeMetaData = function(db, pgsql, objects) {
  // stores metadata from a list of objects fashioned as defined in
  // pgsql.writeReportMetaData()
  return db.query(pgsql.writeReportMetaData(objects)).then(function () {
    return objects;
  });
};

exports.storeReports = function(db, pgsql, objects, formDefs) {
  // stores form field data from a list of objects fashioned as defined in
  // pgsql.writeReportMetaData() ... which also applies to
  // pgsql.writeReportContents()
  // requires formDefs as defined in pgsql.writeReportContents()
  return db.query(pgsql.writeReportContents(objects, formDefs));
};
