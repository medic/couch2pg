var common = require('../common');
var expect = common.expect;
var dbgen = common.dbgen;

// functions under test

var contacts = require('../../libs/xmlforms/contacts');

// fixtures

var pgsql = {
  checkForContacts: function() { return 'cdaa-4592'; },
  initializeContacts: function(x) { return '339c-' + x + '-4d45'; }
};

// tests

describe('Contacts Handler', function() {

  describe('contactsNeeded()', function () {

    context('when 0.4', function () {
      var callstack = [];
      var result = {};
      before(function (done) {
        var this_db = dbgen(callstack, [
          [ {
            'version': '0.4',
            'matviewname': null
          } ]
        ]);
        contacts.contactsNeeded(this_db, pgsql)
        .then(function (val) {
          result = val;
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.checkForContacts());
      });

      it('returns false', function () {
        return expect(result).to.be.false;
      });

    });

    context('when 2.4', function () {
      var callstack = [];
      var result = {};
      before(function (done) {
        var this_db = dbgen(callstack, [
          [ {
            'version': '2.4',
            'matviewname': null
          } ]
        ]);
        contacts.contactsNeeded(this_db, pgsql)
        .then(function (val) {
          result = val;
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.checkForContacts());
      });

      it('returns false', function () {
        return expect(result).to.be.false;
      });

    });

    context('when 0.6 and contacts are missing', function () {
      var callstack = [];
      var result = {};
      before(function (done) {
        // proper version
        var this_db = dbgen(callstack, [
          [ {
            'version': '0.6',
            'matviewname': null
          } ]
        ]);
        contacts.contactsNeeded(this_db, pgsql)
        .then(function (val) {
          result = val;
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.checkForContacts());
      });

      it('returns true', function () {
        return expect(result).to.be.true;
      });

    });

    context('when 2.6 and contacts are missing', function () {
      var callstack = [];
      var result = {};
      before(function (done) {
        // proper version
        var this_db = dbgen(callstack, [
          [ {
            'version': '2.6',
            'matviewname': null
          } ]
        ]);
        contacts.contactsNeeded(this_db, pgsql)
        .then(function (val) {
          result = val;
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.checkForContacts());
      });

      it('returns true', function () {
        return expect(result).to.be.true;
      });

    });

    context('when 0.6 and contacts exist', function () {
      var callstack = [];
      var result = {};
      before(function (done) {
        // expect return value to be of the format
        // [{ version: 'xx', 
        var this_db = dbgen(callstack, [
          [ {
            'version': '0.6',
            'matviewname': 'anything'
          } ]
        ]);
        contacts.contactsNeeded(this_db, pgsql)
        .then(function (val) {
          result = val;
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.checkForContacts());
      });

      it('returns false', function () {
        return expect(result).to.be.false;
      });

    });

    context('when 2.6 and contacts exist', function () {
      var callstack = [];
      var result = {};
      before(function (done) {
        // expect return value to be of the format
        // [{ version: 'xx', 
        var this_db = dbgen(callstack, [
          [ {
            'version': '2.6',
            'matviewname': 'anything'
          } ]
        ]);
        contacts.contactsNeeded(this_db, pgsql)
        .then(function (val) {
          result = val;
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.checkForContacts());
      });

      it('returns false', function () {
        return expect(result).to.be.false;
      });

    });

  }); // contactsNeeded()

  describe('addContacts()', function () {

    context('when contacts are needed', function () {
      var callstack = [];
      before(function (done) {
        var this_db = dbgen(callstack);
        contacts.addContacts(this_db, pgsql, true)
        .then(function () {
          return done();
        }, done);
      });

      it('passes expected query', function () {
        return expect(callstack[0]).to.equal(pgsql.initializeContacts());
      });

    });

    context('when materialized views exist', function () {
      var callstack = [];
      before(function (done) {
        var this_db = dbgen(callstack);
        contacts.addContacts(this_db, pgsql, false)
        .then(function () {
          return done();
        }, done);
      });

      it('passes no query', function () {
        return expect(callstack).to.deep.equal([]);
      });

    });

  }); // addContacts()

}); // Contacts Handler
