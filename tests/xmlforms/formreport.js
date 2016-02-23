var common = require('../common');
var expect = common.expect;
var dbgen = common.dbgen;

// helper functions 

var strObjectList = function (objlist) {
  return objlist.map(function (o) {
    if (o.substring !== undefined) {
      // return strings as-is
      return o;
    }
    if (o.join !== undefined) {
      // dive into lists
      return strObjectList(o);
    }
    // leaves an object basically. expose key/value pairs
    return Object.keys(o).map(function (k) {
      var v = o[k];
      if (v.substring !== undefined) {
        // return strings as-is
        return k + ':' + v + ',';
      }
      if (v.join !== undefined) {
        // dive into lists
        return k + ':' + strObjectList(v) + ',';
      }
      // leaves an object basically. wrap in list and feed back.
      return k + ':' + strObjectList([v]) + ',';
    });
  });
};

// functions under test

var formreport = require('../../libs/xmlforms/formreport');

// fixtures 

var pgsql = {
  fetchMissingReportContents: function() { return 'fb349fd4'; },
  writeReportMetaData: function(x) {
    return '6240-' + strObjectList(x) + '-07f7';
  },
  writeReportContents: function(x,y) {
    return '5fe9-' + strObjectList(x) + '-47b6-' + strObjectList([y]) + '-b630';
  }
};

var formContents = require('./fixtures/formcontents.json');

var formDefinition = require('./fixtures/formdefinition.json');

// represents UUIDs of documents in Couch reflection
// list of { 'uuid': 'X' }
var db_ids = formContents.map(function (el) {
  return { 'uuid': el.id };
});

describe('Form Reports XML Handler', function() {

  describe('fetchAndParseReports()', function () {

    describe('with none already parsed', function () {
      var callstack = [];
      var result = {};
      before(function (done) {
        var this_db = dbgen(callstack, [[]]);
        formreport.fetchAndParseReports(this_db, pgsql).then(function (val) {
          result = val;
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.fetchMissingReportContents());
      });

      it('returns all docs', function () {
        return expect(result).to.deep.equal(db_ids);
      });
    }); // none parsed

    describe('with two already parsed', function () {
      var callstack = [];
      var result = {};
      var already_parsed = db_ids.slice(1,3); // two are parsed
      var not_parsed = [db_ids[0]].concat(db_ids.slice(3)); // all but two left
      before(function (done) {
        var this_db = dbgen(callstack, [already_parsed]);
        formreport.fetchAndParseReports(this_db, pgsql).then(function (val) {
          result = val;
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.fetchMissingReportContents());
      });

      it('returns missing docs', function () {
        return expect(result).to.deep.equal(not_parsed);
      });
    }); // two parsed

  }); // fetchAndParseReports

  describe('storeMetaData', function () {
    var callstack = [];
    var result = {};
    before(function (done) {
      var this_db = dbgen(callstack);
      formreport.storeMetaData(this_db, pgsql, formContents).then(function (val) {
        result = val;
        return done();
      }, done);
    });

    it('passes expected query', function() {
      // just look for the basic text. pgsql will modify the inputs, so
      // pass no inputs to generate only the text.
      return expect(callstack[0]).to.contain(pgsql.writeReportMetaData(formContents));
    });

    it('returns the data passed into it', function() {
      return expect(result).to.deep.equal(formContents);
    });

  });

  describe('storeReports', function () {
    var callstack = [];
    before(function (done) {
      var this_db = dbgen(callstack);
      formreport.storeReports(this_db, pgsql, formContents, formDefinition)
      .then(function () {
        return done();
      }, done);
    });

    it('passes expected query', function() {
      // just look for the basic text. pgsql will modify the inputs, so
      // pass no inputs to generate only the text.
      return expect(callstack[0]).to.contain(pgsql.writeReportContents(formContents, formDefinition));
    });

  });

});
