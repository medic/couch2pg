var fs = require('fs');

var common = require('../common');
var expect = common.expect;

var pgsql = require('../../libs/xmlforms/pgsql');
var scrub = require('pg-format');

// test helpers

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

// tests

describe('xmlforms SQL', function() {

  var original = {};

  before(function () {
    original.table = process.env[envTable];
    original.column = process.env[envColumn];
  });

  after(function () {
    process.env[envTable] = original.table;
    process.env[envColumn] = original.column;
  });

  ['getFormDefinitionsXML', 'fetchMissingReportContents', 'checkForContacts']
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

  }); // forEach uses env table

  describe('initializeContacts()', function() {

    it('returns contents of prepareContacts.sql', function() {
      var fixedSQL = fs.readFileSync('./libs/xmlforms/prepareContacts.sql',
                                     {'encoding': 'utf8'});
      return expect(pgsql.initializeContacts()).to.equal(fixedSQL);
    });

  }); // initializeContacts()

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

    // injection fixture
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

    // iterate tests over each form in the fixture
    Object.keys(formHash).forEach(function (tableName) {

      it('contains/scrubs the table ' + tableName, function () {
        return expect(retSQL).to.contain(scrub('%I', tableName));
      });

      formHash[tableName].forEach(function (fieldName) {

        it('contains/scrubs the field ' + fieldName, function () {
          return expect(retSQL).to.contain(scrub('%I', fieldName));
        });

      });

    });

  }); // putFormViews()

  describe('writeReportMetaData()', function() {

    // fixture
    var listOfRecordObjects = [
      {
        'id': 'field1',
        'formname': 'lol\'; INSERT INTO INJECTION; --',
        'formversion': 'field3',
        'chw': 'field4',
        'reported': '1234567',
        'xml': {
          'anything': 'goes'
        }
      },
      {
        'value\'; DROP TABLE Students; --': 'field0',
        'id': 'fieldA',
        'formname': 'fieldB',
        'formversion': 'fieldC',
        'chw': 'fieldD',
        'reported': '2345678',
        'xml': {
          'banana': 'republic'
        }
      },
      {
        'id': 'field000',
        'formname': 'field001',
        'formversion': 'field010',
        'chw': 'field011',
        'reported': '4567890',
        'xml': {
          'you got got\'; DROP DATABASE *; --': 'field100',
          'field101': 'Robert\'; DROP TABLE Students; --'
        }
      }
    ];

    var retSQL = '';
    before(function () {
      retSQL = pgsql.writeReportMetaData(listOfRecordObjects);
    });

    it('returns empty string with no arguments', function() {
      return expect(pgsql.writeReportMetaData()).to.equal('');
    });

    it('returns empty string for empty list', function() {
      return expect(pgsql.writeReportMetaData([])).to.equal('');
    });

    it('contains INSERT when there is data', function() {
      return expect(retSQL).to.contain('INSERT');
    });

    // test each injection fixture object
    listOfRecordObjects.forEach(function (obj) {

      describe('record id ' + obj.id, function() {

        // iterate through all the relevant fields to make sure they're escaped
        ['id', 'formname', 'formversion', 'chw'].forEach(function (field) {
          it('escapes field ' + field, function() {
            return expect(retSQL).to.contain(scrub('%I', field));
          });

          it('escapes value ' + obj[field], function() {
            return expect(retSQL).to.contain(scrub('%L', obj[field]));
          });
        });

        it('converts ' + obj.reported + ' into a date', function() {
          return expect(retSQL).to.contain(new Date(parseInt(obj.reported))
                                               .toUTCString());
        });

      });

    });

  }); // writeReportMetaData()


  describe('writeReportContents()', function() {

    // fixture
    var formObject = {
      'lol\'; DELETE FROM INJECTION; --': {
        'fields': ['anything'],
        'docs': [
          {
            'id': 'field1',
            'formname': 'lol\'; DELETE FROM INJECTION; --',
            'formversion': 'field3',
            'chw': 'field4',
            'reported': '1234567',
            'xml': {
              'anything': 'goes'
            }
          },
          {
            'value\'; DROP TABLE Students; --': 'field0',
            'id': 'fieldA',
            'formname': 'fieldB',
            'formversion': 'fieldC',
            'chw': 'fieldD',
            'reported': '2345678',
            'xml': {
              'anything': 'republic'
            }
          }
        ]
      },
      'field001': {
        'fields': ['you got got\'; DROP DATABASE *; --', 'field101'],
        'docs': [
          {
            'id': 'field000',
            'formname': 'field001',
            'formversion': 'field010',
            'chw': 'field011',
            'reported': '4567890',
            'xml': {
              'you got got\'; DROP DATABASE *; --': 'field100',
              'field101': 'Robert\'; DROP TABLE Students; --'
            }
          }
        ]
      }
    };

    var retSQL = '';
    before(function() {
      retSQL = pgsql.writeReportContents(formObject);
    });

    it('contains expected number of INSERT INTO', function () {
      // count the number of CREATE TABLEs by string split. Adds 1 element more
      // than expected.
      var expected = Object.keys(formObject).length + 1;
      return expect(retSQL.split('INSERT INTO').length).to.equal(expected);
    });

    // iterate over tables
    Object.keys(formObject).forEach(function (table) {

      describe('for table ' + table, function() {

        // iterate over fields to ensure they're escaped
        formObject[table].fields.forEach(function (field) {
          it('escapes field ' + field, function() {
            return expect(retSQL).to.contain(scrub('%I', field));
          });
        });

        // iterate over objects
        formObject[table].docs.forEach(function (doc) {
          // check each xml field value to make sure it is escaped
          Object.keys(doc.xml).forEach(function (field) {
            var value = doc.xml[field];
            it('escapes value ' + value, function() {
              return expect(retSQL).to.contain(scrub('%L', value));
            });
          });
        });

      });

    }); // forEach table

  }); // writeReportContents()

});
