var Promise = require('../common').Promise;

var xmleng = require('pixl-xml');

exports.fetchFormDefs = function(db, pgsql) {
  // fetches a list of objects with base64 attachment in the "form" field.
  // unwraps the objects and decodes the base64
  return db.query(pgsql.getFormDefinitionsXML())
           .then(function (formlist) {
             if (!formlist) {
               return {'xmlstrs': [], 'vers': []};
             }
             return {
               'xmlstrs': formlist.map(function (el) {
                 return new Buffer(el.form, 'base64').toString('utf8');
               }),
               'vers': formlist.map(function (el) {
                 return el.version;
               })
             };
           });
};

exports.filterInstanceXML = function(xmldatalist) {
  return new Promise(function (resolve) {
    var xmlinstances = [];
    xmldatalist.forEach(function (xmldata) {
      // workaround
      // https://github.com/jhuckaby/pixl-xml/issues/2
      xmldata = xmldata.replace(/\r|\n/g, ' ');

      var jsondata = xmleng.parse(xmldata, { 'preserveAttributes': true } );
      xmlinstances.push(xmleng.stringify(jsondata['h:head'].model.instance,
                                        'instance'));
    });
    return resolve(xmlinstances);
  });
};

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

exports.parseFormDefXML = function(xmldatalist, versions) {
  return new Promise(function (resolve) {
    // each form's name acts as index
    var flatdefs = {};
    // iterate over each form
    for (var i=0; i<xmldatalist.length; i++) {
      var xmldata = xmldatalist[i];

      // parse to json
      var jsondata = xmleng.parse(xmldata, { 'preserveAttributes': true } );
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
      // track the leaves wrapped up in the form name
      flatdefs[formname] = {};
      flatdefs[formname].fields = flattaglist;
      // apply version
      flatdefs[formname].version = versions[i];
    }
    return resolve(flatdefs);
  });
};

exports.writeFormList = function(db, pgsql, flatdefs) {
  return db.query(pgsql.putFormList(Object.keys(flatdefs)))
  .then(function () {
    return flatdefs;
  });
};

exports.writeFormViews = function(db, pgsql, flatdefs) {
  return db.query(pgsql.putFormViews(flatdefs));
};
