var pglib = require('pg-promise');

var Promise = require('../common').Promise;
var handleError = require('../common').handleError;

var formdef = require('./formdef');
var pgsql = require('./pgsql');

module.exports = function () {
  var db;
  return pglib({ 'promiseLib': Promise })(process.env.POSTGRESQL_URL)
    .connect()
    .then(function (this_db) {
      db = this_db;
    })
    .then(function () {
      console.log('fetching XML form definitions');
      return formdef.fetchFormDefs(db, pgsql);
    })
    .then(function (listOfXMLStrings) {
      console.log('extracting <instance> from ' + listOfXMLStrings.length + ' XML definitions');
      return formdef.filterInstanceXML(listOfXMLStrings);
    }, handleError)
    .then(function (listOfXMLStrings) {
      console.log('converting ' + listOfXMLStrings.length + ' <instance> tags into an object of forms and flat lists of fields and form versions.');
      return formdef.parseFormDefXML(listOfXMLStrings);
    }, handleError)
    .then(function (formDefs) {
      console.log('write out list of ' + Object.keys(formDefs).length + ' forms to form_list table');
      return formdef.writeFormList(db, pgsql, formDefs);
    }, handleError)
    .then(function (formDefs) {
      console.log('create a table for each form as formview_{formname}');
      return formdef.writeFormViews(db, pgsql, formDefs);
    }, handleError)
    .catch(handleError)
    .finally(function () {
      console.log('done. releasing database connection');
      if (db) {
        db.done();
      }
    });
};
