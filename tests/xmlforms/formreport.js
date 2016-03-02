var common = require('../common');
var expect = common.expect;
var dbgen = common.dbgen;

// functions under test

var formreport = require('../../libs/xmlforms/formreport');

// fixtures 

var pgsql = {
  fetchMissingReportContents: function() { return 'fb349fd4'; },
  putFormViews: function(x)  {
    return '53e3-' + JSON.stringify(x) + '-4762';
  },
  writeReportMetaData: function(x) {
    return '6240-' + JSON.stringify(x) + '-07f7';
  },
  writeReportContents: function(x) {
    return '5fe9-' + JSON.stringify(x) + '-47b6';
  }
};

var tableDefinition = require('./fixtures/tabledefinition.json');

var formContents = [];
Object.keys(tableDefinition).forEach(function (k) {
  // smoosh all docs into a single list
  tableDefinition[k].docs.forEach(function (doc) {
    formContents.push(doc);
  });
});

var tableFields = {};
Object.keys(tableDefinition).forEach(function (k) {
  // create { 'formname': [fields] ...} from tableDefinition
  tableFields[k] = tableDefinition[k].fields;
});

var dbContents = require('./fixtures/formcontentsdb.json');

// tests

describe('Form Reports XML Handler', function() {

  describe('fetchAndParseReports()', function () {
    var callstack = [];
    var result = {};
    before(function (done) {
      var this_db = dbgen(callstack, [dbContents]);
      formreport.fetchAndParseReports(this_db, pgsql)
      .then(function (val) {
        result = val;
        return done();
      }, done);
    });

    it('passes expected query', function () {
      return expect(callstack[0]).to.equal(pgsql.fetchMissingReportContents());
    });

    it('returns all docs sorted by table', function () {
      return expect(result).to.deep.equal(tableDefinition);
    });

  });

  describe('createTables()', function () {
    var callstack = [];
    var result = {};
    before(function (done) {
      var this_db = dbgen(callstack);
      formreport.createTables(this_db, pgsql, tableDefinition)
      .then(function (val) {
        result = val;
        return done();
      }, done);
    });

    it('passes expected query', function () {
      return expect(callstack[0]).to.equal(pgsql.putFormViews(tableFields));
    });

    it('returns the data passed into it', function() {
      return expect(result).to.deep.equal(tableDefinition);
    });

  });

  describe('storeMetaData()', function () {
    var callstack = [];
    var result = {};
    before(function (done) {
      var this_db = dbgen(callstack);
      formreport.storeMetaData(this_db, pgsql, tableDefinition)
      .then(function (val) {
        result = val;
        return done();
      }, done);
    });

    it('passes expected query', function() {
      return expect(callstack[0]).to.equal(pgsql.writeReportMetaData(formContents));
    });

    it('returns the data passed into it', function() {
      return expect(result).to.deep.equal(tableDefinition);
    });

  });

  describe('storeReports()', function () {
    var callstack = [];
    before(function (done) {
      var this_db = dbgen(callstack);
      formreport.storeReports(this_db, pgsql, tableDefinition)
      .then(function () {
        return done();
      }, done);
    });

    it('passes expected query', function() {
      // just look for the basic text. pgsql will modify the inputs, so
      // pass no inputs to generate only the text.
      return expect(callstack[0]).to.equal(pgsql.writeReportContents(tableDefinition));
    });

  });

});
