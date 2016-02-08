var common = require('../common');
var expect = common.expect;
var Promise = common.Promise;

var pgfuncs = require('../../libs/couch2pg/pgfuncs');
var pgsql = {
  createTable: function() { return '9df62459'; },
  addColumnToTable: function() { return '5de44864'; },
  checkTableSyntax: function() { return 'bc1e0018'; },
};

function acceptPromise(resolve) {
  return resolve();
}

function rejectPromise(resolve, reject) {
  return reject();
}

function lookForQuery(db, mainQuery, passedToDB, done) {
  // prepare a db-engine that will accept checking table syntax
  db.query = function(query) {
    passedToDB.push(query);
    if (mainQuery.indexOf(query) >= 0) {
      return new Promise(acceptPromise);
    } else {
      return new Promise(rejectPromise);
    }
  };

  // initializeDatabase(pgsql, pgpDB):
  //   ensures the database is setup with a proper table.
  //   returns a Promise
  var promise = pgfuncs.initializeDatabase(pgsql, db);
  promise.finally(function () {
    // execute tests only after the promise has completed one way
    // or the other.
    done();
  });

  return promise;
}

describe('Postgres endpoint', function() {

  describe('initializing when named table and column exist', function() {

    // the main query we care to see used
    var passedToDB = [];
    var promise;

    before(function(done) {
      promise = lookForQuery({},
        [pgsql.checkTableSyntax()],
        passedToDB, done);
    });

    it('should check the table syntax', function() {
      return expect(passedToDB).to.include(pgsql.checkTableSyntax());
    });
    it('should not error', function() {
      return expect(promise).to.be.fulfilled;
    });

  });

  describe('named table exists, but named column does not', function() {

    // the main query we care to see used
    var passedToDB = [];
    var promise;

    before(function(done) {
      promise = lookForQuery({}, [pgsql.addColumnToTable()], passedToDB, done);
    });

    it('should check the table syntax', function() {
      return expect(passedToDB).to.include(pgsql.checkTableSyntax());
    });
    it('should add a column to the table', function() {
      return expect(passedToDB).to.include(pgsql.addColumnToTable());
    });
    it('should not error', function() {
      return expect(promise).to.be.fulfilled;
    });

  });

  describe('named table does not exist', function() {

    // the main query we care to see used
    var passedToDB = [];
    var promise;

    before(function(done) {
      promise = lookForQuery({}, [pgsql.createTable()], passedToDB, done);
    });

    it('should check the table syntax', function() {
      return expect(passedToDB).to.include(pgsql.checkTableSyntax());
    });
    it('should create the table', function() {
      return expect(passedToDB).to.include(pgsql.createTable());
    });
    it('should not error', function() {
      return expect(promise).to.be.fulfilled;
    });
  });

  describe('database problems e.g. no authz', function() {

    // the main query we care to see used
    var passedToDB = [];
    var promise;

    before(function(done) {
      promise = lookForQuery({}, ['ALWAYS WRONG'], passedToDB, done);
    });

    it('should error', function() {
      return expect(promise).to.be.rejected;
    });
    it('should give useful error information', function() {
      return promise.catch(function (error) {
        return expect(error.toString()).to.include('Could not initialize');
      });
    });
  });

});
