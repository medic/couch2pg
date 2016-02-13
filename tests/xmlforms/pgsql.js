var common = require('../common');
var expect = common.expect;

var pgsql = require('../../libs/xmlforms/pgsql');
var scrub = require('pg-format');

var good = {
 'table': 'aabd1c98',
 'column': '1d244dfc',
 'data': '4d79f6fd'
};
var bad = 'injection"; SELECT \'do bad things\'; \\echo';
var escapeBadId = '"injection""; SELECT \'do bad things\'; \\echo"';
var escapeBadLit = 'E\'injection"; SELECT \'\'do bad things\'\'; \\\\echo\'::jsonb';
var envTable = 'POSTGRESQL_TABLE';
var envColumn = 'POSTGRESQL_COLUMN';

function testWith(funcName, condition, hasData) {
  if (condition === 'badTable') {
    process.env[envTable] = bad;
  } else {
    process.env[envTable] = good.table;
  }

  if (condition === 'badColumn') {
    process.env[envColumn] = bad;
  } else {
    process.env[envColumn] = good.column;
  }

  var response;
  if (hasData !== 'hasData') {
    response = pgsql[funcName]();
  }
  if (hasData === 'hasData' && condition !== 'badData') {
    response = pgsql[funcName](good.data);
  }
  if (hasData === 'hasData' && condition === 'badData') {
    response = pgsql[funcName](bad);
  }

  var expected;
  if (condition.slice(0,4) === 'good') {
    expected = good[condition.slice(4).toLowerCase()];
  }
  if (condition.slice(0,3) === 'bad' && condition !== 'badData') {
    expected = escapeBadId;
  }
  if (condition === 'badData') {
    expected = escapeBadLit;
  }

  return expect(response).to.contain(expected);
}

describe('pgsql', function() {

  var original = {};

  before(function () {
    original.table = process.env[envTable];
    original.column = process.env[envColumn];
  });

  after(function () {
    process.env[envTable] = original.table;
    process.env[envColumn] = original.column;
  });

  // odd format b/c borrowed from couch2pg pgsql tests
  ['getFormDefinitionsXML']
    .forEach(function (funcName) {

      describe(funcName + '()', function() {

        it('returns env table', function() {
          return testWith(funcName, 'goodTable');
        });

        it('returns env column', function() {
          return testWith(funcName, 'goodColumn');
        });

        it('escapes bad table', function() {
          return testWith(funcName, 'badTable');
        });

        it('escapes bad column', function() {
          return testWith(funcName, 'badColumn');
        });

      });

  }); // forEach

  describe('putFormList()', function () {

    // https://xkcd.com/327/
    var formNames = ['form1', 'form2', 'Robert\'; DROP TABLE Students; --'];
    var retSQL = '';

    before(function () {
      retSQL = pgsql.putFormList(formNames);
    });

    it('contains INSERT INTO', function () {
      return expect(retSQL).to.contain('INSERT INTO');
    });

    formNames.forEach(function (formName) {

      it('contains/scrubs the form ' + formName + ' as expected', function () {
        return expect(retSQL).to.contain(scrub('%L', formName));
      });

    });

  });

  describe('putFormViews()', function () {

    var formHash = {
      'form1': ['field1', 'lol\'; INSERT INTO INJECTION; --', 'field3'],
      'form2': ['value\'; DROP TABLE Students; --', 'field2', 'fieldC'],
      'Robert\'; DROP TABLE Students; --': ['fieldA', 'fieldB', 'fieldGamma'],
      'form4': ['fieldAlpha', 'fieldBeta', 'gamma\'; MALICIOUS; --']
    };
    var retSQL = '';

    before(function () {
      retSQL = pgsql.putFormViews(formHash);
    });

    it('contains expected number of CREATE TABLE', function () {
      // count the number of CREATE TABLEs by string split. Adds 1 element more
      // than expected.
      var expected = Object.keys(formHash).length + 1;
      return expect(retSQL.split('CREATE TABLE').length).to.equal(expected);
    });

    Object.keys(formHash).forEach(function (formName) {

      it('contains/scrubs the form ' + formName + ' as expected', function () {
        return expect(retSQL).to.contain(scrub('%I', 'formview_' + formName));
      });

      formHash[formName].forEach(function (fieldName) {

        it('contains/scrubs the field ' + fieldName + ' as expected', function () {
          return expect(retSQL).to.contain(scrub('%I', fieldName));
        });

      });

    });

  });

});
