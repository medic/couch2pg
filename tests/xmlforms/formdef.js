var xmleng = require('pixl-xml');

var common = require('../common');
var expect = common.expect;
var dbgen = common.dbgen;
var readFixtureFile = common.readFixtureFile('./tests/xmlforms/fixtures/');

var formdef = require('../../libs/xmlforms/formdef');
var pgsql = {
  getFormDefinitionsXML: function() { return '13164adb'; },
  putFormList: function(x) { return '5b31-' + x + '-4c68'; },
  putFormViews: function(x)  {
    return '53e3-' + Object.keys(x) + '-400b-' + Object.keys(x).map(function (y) { return x[y].fields; }) + '-4762';
  }
};

// fixtures

var formDefinitionBase64 = [];

var formDefinitionXML = [];

var formInstanceDefinitionXML = [];

var formInstanceDefinition = require('./fixtures/formdefinition.json');

var formNames = Object.keys(formInstanceDefinition);


describe('Form Definition XML Handler', function() {

  // read in all fixture files before running tests
  before(function (done) {
    readFixtureFile('form1definition.b64', formDefinitionBase64)
    .then(function () {
      return readFixtureFile('form2definition.b64', formDefinitionBase64);
    }, done)
    .then(function () {
      return readFixtureFile('form1definition.xml', formDefinitionXML);
    }, done)
    .then(function () {
      return readFixtureFile('form2definition.xml', formDefinitionXML);
    }, done)
    .then(function () {
      return readFixtureFile('form1definitioninstance.xml', formInstanceDefinitionXML);
    }, done)
    .then(function () {
      return readFixtureFile('form2definitioninstance.xml', formInstanceDefinitionXML);
    }, done)
    .then(done,done);
  });

  describe('fetchFormDefs()', function () {
    var callstack = [];
    var result = {};
    before(function (done) {
      // create rows with form field containing base64 encoded XML
      var retdb = formDefinitionBase64.map(function (formXML) {
        return {'form': formXML};
      });
      // pg-promise will return a list of objects as rows, with properties for
      // requested fields. Two fields will be requested, one called "form"
      // and one called "version".
      var this_db = dbgen(callstack, [retdb]);
      formdef.fetchFormDefs(this_db, pgsql).then(function (val) {
        result = val;
        return done();
      }, done);
    });

    it('passes expected query', function () {
      return expect(callstack[0]).to.equal(pgsql.getFormDefinitionsXML());
    });

    // returns an object property containing every XML
    it('finds all XML for forms', function () {
      return expect(result).to.deep.equal(formDefinitionXML);
    });

  });

  describe('filterInstanceXML()', function () {

    // takes in a list, returns a list
    it('extracts <instance>', function () {
      // XML strings can be subtly different. check contents as JSON instead.
      var promise = formdef.filterInstanceXML(formDefinitionXML)
                           .then(function (xmldatalist) {
                             return xmldatalist.map(function (xmldata) {
                               return xmleng.parse(xmldata);
                             });
                           });
      var fIDXML = formInstanceDefinitionXML.map(function (data) {
        return xmleng.parse(data);
      });
      return expect(promise).to.eventually.deep.equal(fIDXML);
    });

  });

  describe('parseFormDefXML()', function () {

    // takes in a list, returns an object with fields and version
    it('converts XML to an object with form properties and field list values', function () {
      var promise = formdef.parseFormDefXML(formInstanceDefinitionXML);
      return expect(promise).to.eventually.deep.equal(formInstanceDefinition);
    });

  });

  describe('writeFormList()', function() {
    var callstack = [];
    var result = '';
    before(function (done) {
      var this_db = dbgen(callstack);
      formdef.writeFormList(this_db, pgsql, formInstanceDefinition)
             .then(function (val) {
        result = val;
        return done();
      }, done);
    });

    it('passes through forms object', function () {
      return expect(result).to.equal(formInstanceDefinition);
    });

    it('creates and populates formlist table', function () {
      // with a single query
      return expect(callstack[0]).to.equal(pgsql.putFormList(formNames));
    });

    formNames.forEach(function (formName) {
      it('includes a value for form name ' + formName, function () {
        // in the single query
        return expect(callstack[0]).to.contain(formName);
      });
    });

  });

  describe('writeFormViews()', function() {
    var callstack = [];
    var result = '';
    before(function (done) {
      var this_db = dbgen(callstack);
      formdef.writeFormViews(this_db, pgsql, formInstanceDefinition)
             .then(function (val) {
        result = val;
        return done();
      }, done);
    });

    it('creates and populates formview tables', function () {
      // with a single query
      return expect(callstack[0]).to.equal(pgsql.putFormViews(formInstanceDefinition));
    });

    Object.keys(formInstanceDefinition).forEach(function (formName) {
      // in integration testing: check behavior when pre-existing and not.
      it('includes values for form name ' + formName, function () {
        return expect(callstack[0]).to.contain(formName);
      });
      it('includes values for fields ' + formName, function () {
        return expect(callstack[0]).to.contain(formInstanceDefinition[formName].fields);
      });
    }); // forms

  }); //writeFormViews

}); // XML Handler
