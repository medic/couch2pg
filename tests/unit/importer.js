require('chai').should();
var sinon = require('sinon'),
    Promise = require('rsvp').Promise,
    rewire = require('rewire'),
    importer = rewire('../../lib/importer'),
    common = require('../common'),
    expect = common.expect,
    log = require('loglevel');

log.setDefaultLevel('debug'); // CHANGE ME FOR MORE DETAILS

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


describe('importer', function() {
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

  describe('Import changes batch', function() {
    it('gets rid of duplicates from changes feed', function() {
      sinon.stub(db, 'one').returns(successfulPromise(STORED_SEQ));
      var changes = sinon.stub(couchdb, 'changes');
      changes.onCall(0).returns(successfulPromise({
        results: [
          STUB_TO_STORE,
          STUB_TO_STORE,
          STUB_TO_DELETE
        ],
        last_seq: 2
      }));
      changes.onCall(1).returns(successfulPromise({
        results: [],
        last_seq: 2
      }));
      sinon.stub(db, 'query').returns(successfulPromise());
      var allDocs = sinon.stub(couchdb, 'allDocs');
      allDocs.returns(successfulPromise(ALL_DOCS));

      return importer(db, couchdb).importBatch().then(function() {
        allDocs.args[0][0].keys.should.deep.equal(['123']);
      });
    });
  });

  describe('IO failure propagation:', function() {

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
          sinon.stub(db, 'query').returns(failedPromise('seq'));

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

    describe('different scenarios for get sequence', function() {
      it('finds sequence for given source', function() {
        sinon.stub(db, 'one').returns(successfulPromise(STORED_SEQ));

        return importer(db, couchdb).getSeq('localhost:5984/simon')
          .then(function(seq) {
            expect(seq).to.equal(STORED_SEQ.seq);
          });
      });

      it('does not find sequence for given source but finds default source seq', function() {
        var seqStub = sinon.stub(db, 'one');
        seqStub.onCall(0).returns(failedPromise('seq for this source does not exist'));
        // default database sequence
        seqStub.onCall(1).returns(successfulPromise(STORED_SEQ));
        var updateDefaultSeq = sinon.stub(db, 'query').returns(successfulPromise({}));

        return importer(db, couchdb).getSeq('localhost:5984/simon')
          .then(function(seq) {
            expect(seq).to.equal(STORED_SEQ.seq);
            expect(updateDefaultSeq.callCount).to.equal(1);
            var stmt = 'UPDATE couchdb_progress SET source = \'localhost:5984/simon\' WHERE source = \'default-source\'';
            expect(updateDefaultSeq.args[0][0]).to.equal(stmt);
          });
      });

      it('does not find sequence for given nor default source', function() {
        var seqStub = sinon.stub(db, 'one');
        seqStub.onCall(0).returns(failedPromise('seq for this source does not exist'));
        seqStub.onCall(1).returns(failedPromise('default source sequence does not exist'));

        var insertSeq = sinon.stub(db, 'query').returns(successfulPromise({}));

        return importer(db, couchdb).getSeq('localhost:5984/simon')
          .then(function(seq) {
            expect(seq).to.equal(0);
            expect(insertSeq.callCount).to.equal(1);
            var stmt = 'INSERT INTO couchdb_progress(seq, source) VALUES (\'0\', \'localhost:5984/simon\')';
            expect(insertSeq.args[0][0]).to.equal(stmt);
          });
      });
    });
  });
});
