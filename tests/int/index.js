var _ = require('underscore'),
    common = require('../common'),
    expect = common.expect,
    log = require('loglevel'),
    pouchdb = require('../../db'),
    spawn = require('child_process').spawn;

var RSVP = require('rsvp'),
    Promise = RSVP.Promise,
    pgp = require('pg-promise')({ 'promiseLib': Promise });

var INT_PG_HOST = process.env.INT_PG_HOST || 'localhost',
    INT_PG_PORT = process.env.INT_PG_PORT || 5432,
    INT_PG_USER = process.env.INT_PG_USER,
    INT_PG_PASS = process.env.INT_PG_PASS,
    INT_PG_DB   = process.env.INT_PG_DB || 'medic-analytics-test',
    INT_COUCHDB_URL = process.env.INT_COUCHDB_URL || 'http://admin:pass@localhost:5984/medic-analytics-test';

var POSTGRESQL_URL = 'postgres://' +
  (INT_PG_USER ? INT_PG_USER : '') +
  (INT_PG_PASS ? ':' + INT_PG_PASS : '') +
  (INT_PG_USER ? '@' : '') +
  INT_PG_HOST + ':' + INT_PG_PORT + '/' + INT_PG_DB;

log.setDefaultLevel('error'); // CHANGE ME TO debug FOR MORE DETAILS

var DOCS_TO_CREATE = 10;
var DOCS_TO_ADD = 5;
var DOCS_TO_EDIT = 5;
var DOCS_TO_DELETE = 5;

var pgdb = pgp(POSTGRESQL_URL);

// drop and re-create couchdb
var initialiseCouchDb = function() {
  return pouchdb(INT_COUCHDB_URL).destroy().then(function() {
    return new Promise(function(res) {
      res(pouchdb(INT_COUCHDB_URL));
    });
  });
};

var resetPostgres = function() {
  return pgdb.query('drop schema public cascade')
    .then(function() {
      return pgdb.query('create schema public');
    });
};

var randomData = function() {
  return [
    _.sample(['happy', 'sad', 'angry', 'scared', 'morose', 'pensive', 'quixotic']),
    _.sample(['red', 'blue', 'green', 'orange', 'pink', 'mustard', 'vermillion']),
    _.sample(['cat', 'dog', 'panda', 'tiger', 'ant', 'lemur', 'dugong', 'vontsira'])
    ].join('-');
};

var generateRandomDocument = function() {
  return {
    data: randomData()
  };
};

describe('couch2pg', function() {
  var couchdb;

  var createDocs = function(docs) {
    return couchdb.bulkDocs(docs).then(function(results) {
      return _.zip(docs, results).map(function(docAndResult) {
        // TODO replace with destructuring when node supports it
        var doc = docAndResult[0];
        var result = docAndResult[1];

        if (!result.ok) {
          throw ['Document failed to be saved', result];
        }

        doc._id = result.id;
        doc._rev = result.rev;

        return doc;
      });
    });
  };

  var couchDbDocs = function() {
    return couchdb.allDocs({
      include_docs: true
    }).then(function(results) {
      return _.pluck(results.rows, 'doc');
    });
  };

  var itRunsSuccessfully = (postgresTable='couchdb') => {
    return new Promise(function(res, rej) {
      var run = spawn('node', [ 'cli.js', INT_COUCHDB_URL, POSTGRESQL_URL, postgresTable]);

      var logIt = function(targetFn) {
        return function(data) {
          data = data.toString();
          data = data.substring(0, data.length - 1);
          targetFn(data);
        };
      };

      run.on('error', function(err) {
        rej(new Error('Child process errored attempting to transform xml', err));
      });

      run.stdout.on('data', logIt(log.debug));
      run.stderr.on('data', logIt(log.error));

      run.on('close', function(code) {
        if (code) {
          rej(new Error('couch2pg cli exited with code', code));
        } else {
          res();
        }
      });
    });
  };

  var itHasTheSameNumberOfDocs = (table='couchdb') => {
    return RSVP.all([
      pgdb.one(`SELECT COUNT(*) FROM ${table}`),
      couchDbDocs()
    ]).then(function(results) {
      var pgCount = parseInt(results[0].count),
          couchCount = results[1].length;

      expect(pgCount).to.equal(couchCount);
    });
  };

  // It's OK to not pass _rev values in existingDocs, but if you do pass them
  // we will compare them
  var itHasExactlyTheseDocuments = function(existingDocs, table='couchdb') {
    return RSVP.all([
      pgdb.query(`SELECT * from ${table}`),
      existingDocs
    ]).then(function(results) {
      var pgdocs = _.pluck(results[0], 'doc');
      var docs = results[1];

      expect(pgdocs.length).to.equal(docs.length);

      pgdocs = _.sortBy(pgdocs, '_id');
      docs = _.sortBy(docs, '_id');

      for (var i = 0; i < pgdocs.length; i++) {
        if (!docs[i]._rev) {
          delete pgdocs[i]._rev;
        }

        expect(pgdocs[i]).deep.equals(docs[i]);
      }
    });
  };

  var itHasTheSameDocuments = (table='couchdb') => {
    return itHasExactlyTheseDocuments(couchDbDocs(), table);
  };

  var resetDbState = function() {
    return initialiseCouchDb()
      .then(function(db) {
        log.info('CouchDB ready');
        couchdb = db;
        return resetPostgres();
      }).then(function() {
        log.info('PostgreSQL ready');
      });
  };

  before(resetDbState);

  describe('initial import into postgres', function() {
    before(function() {
      return createDocs(_.range(DOCS_TO_CREATE).map(generateRandomDocument));
    });

    it('runs successfully', itRunsSuccessfully);
    it('has the same number of documents as couch', itHasTheSameNumberOfDocs);
    it('has the same documents as couch', itHasTheSameDocuments);
  });
  describe('subsequent creations, updates and deletions', function() {
    before(function() {
      return couchDbDocs().then(function(docs) {
        var deletedDocs = _.sample(docs, DOCS_TO_DELETE);
        docs = _.difference(docs, deletedDocs);
        deletedDocs.forEach(function(doc) {
          doc._deleted = true;
        });

        var updatedDocs = _.sample(docs, DOCS_TO_EDIT);
        updatedDocs.forEach(function(doc) {
          doc.data = randomData();
        });

        var createdDocs =_.range(DOCS_TO_ADD).map(generateRandomDocument);

        return couchdb.bulkDocs(deletedDocs)
        .then(function() {
          return couchdb.bulkDocs(updatedDocs).then(function(results) {
            results.forEach(function(result) {
              var doc = _.find(docs, function(d) {
                return d._id === result.id;
              });

              doc._id = result.id;
              doc._rev = result.rev;
            });
          });
        })
        .then(function() {
          return createDocs(createdDocs).then(function(createdDocs) {
            docs = docs.concat(createdDocs);
          });
        });
      });
    });


    it('runs successfully', itRunsSuccessfully);
    it('has the same number of documents as couch', itHasTheSameNumberOfDocs);
    it('has the same documents as couch', itHasTheSameDocuments);
  });

  describe('no change', function() {
    it('runs successfully', itRunsSuccessfully);
    it('still has the same number of documents as couch', itHasTheSameNumberOfDocs);
    it('still has the same documents as couch', itHasTheSameDocuments);
  });

  describe('replicates to the correct table', () => {
    it('replicates to the table passed in with options', () => {
      it('runs successfully', itRunsSuccessfully('test_table'));
      it('has the same number of documents as couch', itHasTheSameNumberOfDocs('test_table'));
      it('has the same documents as couch', itHasTheSameDocuments('test_table'));
    });
  });

  describe('Escaping', function() {
    beforeEach(resetDbState);

    it('should handle documents with \\u0000 in it', function() {
      return couchdb.put({
        _id: 'u0000-escaped',
        data: 'blah blah \u00003\u00003\u00003\u00003 blah'
      })
        .then(itRunsSuccessfully)
        .then(function() {
          return itHasExactlyTheseDocuments([{
            _id: 'u0000-escaped',
            data: 'blah blah 3333 blah'
          }]);
        });
    });
    it('including variants that would exist *after* you remove a single \u0000', function() {
      return couchdb.put({
        _id: 'u0000-even-more-escaped',
        data: 'blah blah \\u0000u0000 blah blah'
      })
        .then(itRunsSuccessfully)
        .then(function() {
          return itHasExactlyTheseDocuments([{
            _id: 'u0000-even-more-escaped',
            data: 'blah blah u0000 blah blah'
          }]);
        });
    });
    // This is not as technically correct as it could be, but it's simpler! It removes the possibility
    // of slashes that aren't removed changing the thing they are escaping (see the it directly above
    // this for one example).
    it('removes all backslashes for simplicity', function() {
      return couchdb.put({
        _id: 'remove-all-backslashes',
        data: 'blah blah \\\\\\\\u0000" blah blah'
      })
        .then(itRunsSuccessfully)
        .then(function() {
          return itHasExactlyTheseDocuments([{
            _id: 'remove-all-backslashes',
            data: 'blah blah " blah blah'
          }]);
        });
    });
    it('Escapes ids correctly as well', function() {
      return couchdb.put({
        _id: 'this is a \u0000 bad id'
      })
        .then(itRunsSuccessfully)
        .then(function() {
          return itHasExactlyTheseDocuments([{
            _id: 'this is a  bad id',
          }]);
        });
    });
    it('Escapes actual 1-byte 0x00 values', function() {
      var badValue = 'foo\0bar';
      return couchdb.put({
        _id: badValue,
        data: badValue
      })
        .then(itRunsSuccessfully)
        .then(function() {
          return itHasExactlyTheseDocuments([{
            _id: 'foobar',
            data: 'foobar'
          }]);
        });
    });
    it('Specific production bug #medic-projects/4706', function() {
      return couchdb.put({
        _id: '54collect_off\u00004form:collect_off\u0000\u0000'
      })
        .then(itRunsSuccessfully)
        .then(function() {
          return itHasExactlyTheseDocuments([{
            _id: '54collect_off4form:collect_off',
          }]);
        });
    });
  });
}).timeout(100000);
