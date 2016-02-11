var fs = require('fs');
var common = require('../common');
var expect = common.expect;
var Promise = common.Promise;

var formdef = require('../../libs/xmlforms/formdef');
var pgsql = {
  getFormDefinitionsXML: function() { return '13164adb'; },
  putFormList: function(x) { return '5b31-' + x + '-4c68'; },
  putFormViews: function(x)  { return '53e3-' + x + '-400b'; }
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

var formDefinitionBase64 = '';

var formDefinitionXML = '';

var formInstanceDefinitionXML = '';

var formInstanceDefinition = require('./fixtures/formdefinition.json');


describe('Form Definition XML Handler', function() {

  // read in all files before running tests
  before(function (done) {
    new Promise(function (resolve, reject) {
      fs.readFile(fixturePath + 'formdefinition.b64', 'utf8', function (err,data) {
        if (err) {
          reject(err);
        } else {
          formDefinitionBase64 = data;
          resolve();
        }
      });
    }).then(function () {
      fs.readFile(fixturePath + 'formdefinition.xml', 'utf8', function (err,data) {
        if (err) {
          throw err;
        } else {
          formDefinitionXML = data;
        }
      });
    }, done).then(function () {
      fs.readFile(fixturePath + 'formdefinitioninstance.xml', 'utf8', function (err,data) {
        if (err) {
          throw err;
        } else {
          formInstanceDefinitionXML = data;
        }
      });
    }, done).then(done, done);
  });

  describe('fetchFormDefs()', function () {
    var callstack = [];
    var result = '';
    before(function (done) {
      // pg-promise will return a list of objects as rows, with properties for
      // requested fields. One field will be requested called "form".
      var this_db = dbgen(callstack, [
        [ { 'form': formDefinitionBase64 } ]
      ]);
      formdef.fetchFormDefs(this_db, pgsql).then(function (val) {
        result = val;
        return done();
      }, done);
    });

    it('passes expected query', function () {
      return expect(callstack[0]).to.equal(pgsql.getFormDefinitionsXML());
    });

    // this would be a passthrough, but the XML attachments are base64 encoded
    it('decodes form definitions as XML', function () {
      return expect(result).to.equal(formDefinitionXML);
    });
  });

  describe('filterInstanceXML()', function () {

    it('extracts <instance>', function () {
      var promise = formdef.filterInstanceXML(formDefinitionXML);
      return expect(promise).to.eventually.equal(formInstanceDefinitionXML);
    });

  });

  describe('parseFormDefXML()', function () {

    it('converts XML to an object with form properties and field list values', function () {
      var promise = formdef.parseFormDefXML(formInstanceDefinitionXML);
      return expect(promise).to.eventually.equal(formInstanceDefinition);
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

    // in integration testing: check behavior when pre-existing and not.
    it('creates and populates formlist table', function () {
      return expect(callstack[0]).to.equal(pgsql.putFormList());
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

    Object.keys(formInstanceDefinition).forEach(function (form) {

      // in integration testing: check behavior when pre-existing and not.
      it('creates and populates formview_' + form + ' table', function () {
        return expect(callstack).to.contain(pgsql.putFormList());
      });

    }); // forms

  }); //writeFormViews

}); // XML Handler
