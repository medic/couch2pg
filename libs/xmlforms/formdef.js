var Promise = require('../common').Promise;

var xmleng = require('pixl-xml');

exports.fetchFormDefs = function(db, pgsql) {
  // fetches a list of objects with base64 attachment in the "form" field.
  // unwraps the objects and decodes the base64
  return db.query(pgsql.getFormDefinitionsXML())
           .then(function (formlist) {
             return formlist.map(function (el) {
               return new Buffer(el.form, 'base64').toString('utf8');
             });
           }, console.log);
};

exports.filterInstanceXML = function(xmldata) {
  return new Promise(function (resolve) {
    var xml = xmleng.parse(xmldata, { 'preserveAttributes': true } );
    return resolve(xmleng.stringify(xml['h:head'].model.instance,
                                    'instance'));
  });
};

exports.parseFormDefXML = function() {
  // DFS through xmleng.parse returning leaf with full path to leaf.
  return new Promise(function (resolve) {
    return resolve();
  });
};

exports.writeFormList = function() {
  return new Promise(function (resolve) {
    return resolve();
  });
};

exports.writeFormViews = function() {
  return new Promise(function (resolve) {
    return resolve();
  });
};
