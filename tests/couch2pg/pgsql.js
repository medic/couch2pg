var common = require('../common');
var expect = common.expect;

var pgsql = require('../../libs/couch2pg/pgsql');

var good = {
 'table': 'a189f370',
 'column': '2d8b450f',
 'data': 'd22e9511'
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

describe('couch2pg SQL', function() {

  var original = {};

  before(function () {
    original.table = process.env[envTable];
    original.column = process.env[envColumn];
  });

  after(function () {
    process.env[envTable] = original.table;
    process.env[envColumn] = original.column;
  });

  ['createTable', 'addColumnToTable', 'checkTableSyntax', 'fetchEntries']
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

   // separated because takes data parameter
   describe('insertIntoColumn()', function() {

     it('returns env table', function() {
       return testWith('insertIntoColumn', 'goodTable', 'hasData');
     });

     it('returns env column', function() {
       return testWith('insertIntoColumn', 'goodColumn', 'hasData');
     });

     it('returns passed data', function() {
       return testWith('insertIntoColumn', 'goodData', 'hasData');
     });

     it('escapes bad table', function() {
       return testWith('insertIntoColumn', 'badTable', 'hasData');
     });

     it('escapes bad column', function() {
       return testWith('insertIntoColumn', 'badColumn', 'hasData');
     });

     it('escapes bad data', function() {
       return testWith('insertIntoColumn', 'badData', 'hasData');
     });

  });

});
