var fs = require('fs');

var common = require('../common');
var expect = common.expect;

var pgsql = require('../../libs/xmlforms/pgsql');
var format = require('pg-format');

describe('xmlforms SQL', function() {

  describe('initializeContacts()', function() {

    it('returns contents of prepareContacts.sql', function() {
      var fixedSQL = fs.readFileSync('./libs/xmlforms/prepareContacts.sql',
                                     {'encoding': 'utf8'});
      return expect(pgsql.initializeContacts()).to.equal(fixedSQL);
    });

  }); // initializeContacts()

  describe('checkFormMetadata', function () {

    it('returns a very specific SQL string', function () {
      expect(pgsql.checkFormMetadata()).to.equal('SELECT count(tablename) > 0 AS exists FROM pg_catalog.pg_tables WHERE tablename = \'form_metadata\';');
    });

  });

  describe('initializeFormMetadata', function () {

    it('returns a very specific SQL string', function () {
      expect(pgsql.initializeFormMetadata()).to.equal('CREATE TABLE form_metadata (uuid TEXT, chw TEXT, chw_area TEXT, formname TEXT, formversion TEXT, reported TIMESTAMP); CREATE INDEX form_metadata_uuid ON form_metadata (uuid); CREATE INDEX form_metadata_chw ON form_metadata (chw); CREATE INDEX form_metadata_reported ON form_metadata (reported); CREATE INDEX form_metadata_formname ON form_metadata (formname); CREATE INDEX form_metadata_formversion ON form_metadata (formname, formversion); ');
    });

  });

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

      it('contains/formats the form ' + formName + ' as expected', function () {
        return expect(retSQL).to.contain(format('%L', formName));
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

      it('contains/formats the table ' + tableName, function () {
        return expect(retSQL).to.contain(format('%I', tableName));
      });

      formHash[tableName].forEach(function (fieldName) {

        it('contains/formats the field ' + fieldName, function () {
          return expect(retSQL).to.contain(format('%I', fieldName));
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
            return expect(retSQL).to.contain(format('%I', field));
          });

          it('escapes value ' + obj[field], function() {
            return expect(retSQL).to.contain(format('%L', obj[field]));
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
            return expect(retSQL).to.contain(format('%I', field));
          });
        });

        // iterate over objects
        formObject[table].docs.forEach(function (doc) {
          // check each xml field value to make sure it is escaped
          Object.keys(doc.xml).forEach(function (field) {
            var value = doc.xml[field];
            it('escapes value ' + value, function() {
              return expect(retSQL).to.contain(format('%L', value));
            });
          });
        });

      });

    }); // forEach table

  }); // writeReportContents()

  describe('refreshMatViews()', function() {

    it('returns specific SQL', function() {
      return expect(pgsql.refreshMatViews()).to.equal('SELECT refresh_matviews();');
    });

  }); // refreshMatViews()

});
