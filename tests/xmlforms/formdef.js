var fs = require('fs');
var xmleng = require('pixl-xml');
var common = require('../common');
var expect = common.expect;
var Promise = common.Promise;

var formdef = require('../../libs/xmlforms/formdef');
var pgsql = {
  getFormDefinitionsXML: function() { return '13164adb'; },
  putFormList: function(x) { return '5b31-' + x + '-4c68'; },
  putFormViews: function(x)  {
    return '53e3-' + Object.keys(x) + '-400b-' + Object.keys(x).map(function (y) { return x[y].fields; }) + '-4762';
  }
};


var dbgen = function(callstack, retval) {
  // callstack should be a list
  // retval should be a list of ordered return values
  var counter = 0;
  // handler for undefined retval: treat as single call with no response
  if (retval === undefined) {
    retval = [undefined];
  }
  return {'query': function(sql) {
    // store the sql for comparison
    callstack.push(sql);
    // accept anything passed with custom value returned
    return new Promise(function (resolve) {
      if (counter > retval.length) {
        throw 'Database called more often than expected.';
      }
      var resolveval = retval[counter];
      counter = counter + 1;
      return resolve(resolveval);
    });
  }};
};


// fixtures

var fixturePath = './tests/xmlforms/fixtures/';

var formDefinitionBase64 = [];

var formDefinitionXML = [];

var formInstanceDefinitionXML = [];

var formInstanceDefinition = require('./fixtures/formdefinition.json');

var formNames = Object.keys(formInstanceDefinition);

var formVersionsList = require('./fixtures/formversion.json');

var readFixtureFile = function (filename, storage) {
  return new Promise(function (resolve, reject) {
    fs.readFile(fixturePath + filename, 'utf8', function (err,data) {
      if (err) {
        return reject(err);
      } else {
        storage.push(data);
        return resolve();
      }
    });
  });
};


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
      var retdb = [];
      for (var i=0; i<formDefinitionBase64.length; i++) {
        retdb.push({
          // build versions by referencing form name from index order and then
          // form version from form name.
          'version': formVersionsList[i],
          'form': formDefinitionBase64[i]
        });
      }
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
      return expect(result.xmlstrs).to.deep.equal(formDefinitionXML);
    });

    // returns an object property with form version in order of XML above
    it('finds all versions for forms', function () {
      return expect(result.vers).to.deep.equal(formVersionsList);
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

    // takes in two lists, returns an object with fields and version
    it('converts XML to an object with form properties and field list values', function () {
      var promise = formdef.parseFormDefXML(formInstanceDefinitionXML,
                                            formVersionsList);
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
