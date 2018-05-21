require('es6-promise').polyfill();
require('chai').should();
var sinon = require('sinon'),
    rewire = require('rewire'),
    importer = rewire('../../lib/importer'),
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


var shouldFail = function(promise, reason) {
  return promise
  .then(function() {
    throw Error('Promise successed when it should have failed');
  }).catch(function(err) {
    err.name.should.equal(reason);
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
      sinon.stub(db, 'one').resolves(STORED_SEQ);
      var changes = sinon.stub(couchdb, 'changes');
      changes.onCall(0).resolves({
        results: [
          STUB_TO_STORE,
          STUB_TO_STORE,
          STUB_TO_DELETE
        ],
        last_seq: 2
      });
      changes.onCall(1).resolves({
        results: [],
        last_seq: 2
      });
      sinon.stub(db, 'query').resolves();
      var allDocs = sinon.stub(couchdb, 'allDocs');
      allDocs.resolves(ALL_DOCS);

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
          sinon.stub(db, 'one').rejects('seq');
          sinon.stub(db, 'query').rejects('seq');

          return importerFailsBecause('seq');
        });

        it('accessing changes from couchdb', function() {
          sinon.stub(db, 'one').resolves(STORED_SEQ);

          sinon.stub(couchdb, 'changes').rejects('changes');

          return importerFailsBecause('changes');
        });

        it('attempting to delete docs', function() {
          sinon.stub(db, 'one').resolves(STORED_SEQ);
          sinon.stub(couchdb, 'changes').resolves(CHANGES_FEED);

          sinon.stub(db, 'query').rejects('delete');

          return importerFailsBecause('delete');
        });

        it('accessing allDocs from couchdb', function() {
          sinon.stub(db, 'one').resolves(STORED_SEQ);
          sinon.stub(couchdb, 'changes').resolves(CHANGES_FEED);
          sinon.stub(db, 'query').resolves();

          sinon.stub(couchdb, 'allDocs').rejects('allDocs');

          return importerFailsBecause('allDocs');
        });

        it('trying to delete existing docs before adding them', function() {
          sinon.stub(db, 'one').resolves(STORED_SEQ);
          sinon.stub(couchdb, 'changes').resolves(CHANGES_FEED);
          var dbQuery = sinon.stub(db, 'query');
          dbQuery.onCall(0).resolves();
          sinon.stub(couchdb, 'allDocs').resolves(ALL_DOCS);

          dbQuery.onCall(1).rejects('Deleting stub to store');

          return importerFailsBecause('Deleting stub to store');
        });

        it('adding docs', function() {
          sinon.stub(db, 'one').resolves(STORED_SEQ);
          sinon.stub(couchdb, 'changes').resolves(CHANGES_FEED);
          var dbQuery = sinon.stub(db, 'query');
          dbQuery.onCall(0).resolves();
          sinon.stub(couchdb, 'allDocs').resolves(ALL_DOCS);
          dbQuery.onCall(1).resolves();

          dbQuery.withArgs(sinon.match(/INSERT INTO couchdb/)).rejects('insert docs');

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
          importChangesBatch.resolves({lastSeq: 2});
          importer.__set__('importChangesBatch', importChangesBatch);

          var dbQuery = sinon.stub(db, 'query');
          dbQuery.withArgs(sinon.match(/UPDATE couchdb_progress/)).rejects('update seq');

          return importerFailsBecause('update seq');
        });
    });

    describe('different scenarios for get sequence', function() {
      it('finds sequence for given source', function() {
        sinon.stub(db, 'one').resolves(STORED_SEQ);

        return importer(db, couchdb)._getSeq('localhost:5984/simon')
          .then(function(seq) {
            seq.should.equal(STORED_SEQ.seq);
          });
      });

      it('does not find sequence for given source but finds default source seq', function() {
        var seqStub = sinon.stub(db, 'one');
        seqStub.onCall(0).rejects({code: 'queryResultErrorCode.noData'});
        // default database sequence
        seqStub.onCall(1).resolves(STORED_SEQ);
        var updateDefaultSeq = sinon.stub(db, 'query').resolves({});

        return importer(db, couchdb)._getSeq('localhost:5984/simon')
          .then(function(seq) {
            seq.should.equal(STORED_SEQ.seq);
            updateDefaultSeq.callCount.should.equal(1);
            var stmt = 'UPDATE couchdb_progress SET source = \'localhost:5984/simon\' WHERE source = \'default-source\'';
            updateDefaultSeq.args[0][0].should.equal(stmt);
          });
      });

      it('does not find sequence for given nor default source', function() {
        var seqStub = sinon.stub(db, 'one');
        seqStub.onCall(0).rejects({code: 'queryResultErrorCode.noData'});
        seqStub.onCall(1).rejects({code: 'queryResultErrorCode.noData'});

        var insertSeq = sinon.stub(db, 'query').resolves({});

        return importer(db, couchdb)._getSeq('localhost:5984/simon')
          .then(function(seq) {
            seq.should.equal(0);
            insertSeq.callCount.should.equal(1);
            var stmt = 'INSERT INTO couchdb_progress(seq, source) VALUES (\'0\', \'localhost:5984/simon\')';
            insertSeq.args[0][0].should.equal(stmt);
          });
      });
    });
  });
});
