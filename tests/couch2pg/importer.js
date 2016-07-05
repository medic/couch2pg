require('chai').should();
var sinon = require('sinon'),
    Promise = require('rsvp').Promise,
    rewire = require('rewire'),
    importer = rewire('../../libs/couch2pg/importer');

var STORED_SEQ = {seq: 0};
var STUB_TO_STORE = {id: '123', seq: 1};
var STUB_TO_DELETE = {id: '345', deleted: true, seq: 2};
var CHANGES_FEED = {
  results: [
    STUB_TO_STORE,
    STUB_TO_DELETE
  ],
  last_seq: 2
};
var ALL_DOCS = {
  rows: [
    STUB_TO_STORE
  ]
};

var failedPromise = function(reason) {
  return Promise.reject(reason);
};
var successfulPromise = function(result) {
  return Promise.resolve(result);
};

var shouldFail = function(promise, reason) {
  return promise
  .then(function() {
    throw Error('Promise successed when it should have failed');
  }).catch(function(err) {
    err.should.equal(reason);
  });
};

describe('IO failure propagation:', function() {
  var db, couchdb;
  beforeEach(function() {
    db = {
      one: function() {},
      query: function() {}
    };
    couchdb = {
      changes: function() {},
      allDocs: function() {}
    };
  });

  describe('of one batch', function() {
    var importerFailsBecause = function(reason) {
      return shouldFail(importer(db, couchdb).importBatch(), reason);
    };

    /* TODO each `it` expands on the previous' successful mocks with a failure that
            in the next is a success. Work out how to not have to repeat yourself
            in a clean way
    */
    describe('import correctly fails when', function() {
      it('accessing seq from postgres', function() {
        sinon.stub(db, 'one').returns(failedPromise('seq'));

        return importerFailsBecause('seq');
      });

      it('accessing changes from couchdb', function() {
        sinon.stub(db, 'one').returns(successfulPromise(STORED_SEQ));

        sinon.stub(couchdb, 'changes').returns(failedPromise('changes'));

        return importerFailsBecause('changes');
      });

      it('attempting to delete docs', function() {
        sinon.stub(db, 'one').returns(successfulPromise(STORED_SEQ));
        sinon.stub(couchdb, 'changes').returns(successfulPromise(CHANGES_FEED));

        sinon.stub(db, 'query').returns(failedPromise('delete'));

        return importerFailsBecause('delete');
      });

      it('accessing allDocs from couchdb', function() {
        sinon.stub(db, 'one').returns(successfulPromise(STORED_SEQ));
        sinon.stub(couchdb, 'changes').returns(successfulPromise(CHANGES_FEED));
        sinon.stub(db, 'query').returns(successfulPromise());

        sinon.stub(couchdb, 'allDocs').returns(failedPromise('allDocs'));

        return importerFailsBecause('allDocs');
      });

      it('trying to delete existing docs before adding them', function() {
        sinon.stub(db, 'one').returns(successfulPromise(STORED_SEQ));
        sinon.stub(couchdb, 'changes').returns(successfulPromise(CHANGES_FEED));
        var dbQuery = sinon.stub(db, 'query');
        dbQuery.onCall(0).returns(successfulPromise());
        sinon.stub(couchdb, 'allDocs').returns(successfulPromise(ALL_DOCS));

        dbQuery.onCall(1).returns(failedPromise('Deleting stub to store'));

        return importerFailsBecause('Deleting stub to store');
      });

      it('adding docs', function() {
        sinon.stub(db, 'one').returns(successfulPromise(STORED_SEQ));
        sinon.stub(couchdb, 'changes').returns(successfulPromise(CHANGES_FEED));
        var dbQuery = sinon.stub(db, 'query');
        dbQuery.onCall(0).returns(successfulPromise());
        sinon.stub(couchdb, 'allDocs').returns(successfulPromise(ALL_DOCS));
        dbQuery.onCall(1).returns(successfulPromise());

        dbQuery.withArgs(sinon.match(/INSERT INTO couchdb/)).returns(failedPromise('insert docs'));

        return importerFailsBecause('insert docs');
      });
    });
  });

  describe('of import all', function() {
      var importerFailsBecause = function(reason) {
        return shouldFail(importer(db, couchdb).importAll(), reason);
      };

      it('storing seq after a batch', function() {
        var importChangesBatch = sinon.stub();
        importChangesBatch.returns(successfulPromise({lastSeq: 2}));
        importer.__set__('importChangesBatch', importChangesBatch);

        var dbQuery = sinon.stub(db, 'query');
        dbQuery.withArgs(sinon.match(/UPDATE couchdb_progress/)).returns(failedPromise('update seq'));

        return importerFailsBecause('update seq');
      });
  });

});
