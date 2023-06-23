var _ = require('underscore'),
    log = require('loglevel'),
    rsvp = require('rsvp'),
    format = require('pg-format');

var DEFAULT_DATABASE = 'default-source';

var DELETE_STMT = 'DELETE FROM %I WHERE doc->>\'_id\' in (%L)';
var SELECT_SEQ_STMT = 'SELECT seq FROM couchdb_progress WHERE source = %L';
var UPDATE_SEQ_SOURCE_STMT = 'UPDATE couchdb_progress SET source = %L WHERE source = %L';
var INSERT_SEQ_STMT = 'INSERT INTO couchdb_progress(seq, source) VALUES (%L, %L)';
var UPDATE_SEQ_STMT = 'UPDATE couchdb_progress SET seq = %L WHERE source = %L';
var INSERT_DOC_STMT = 'INSERT INTO %I (doc) VALUES %L';

var NO_DATA_ERROR = 'queryResultErrorCode.noData';

var sanitise = function(string) {
      // PostgreSQL doesn't support \u0000 in JSON strings, see:
      //   https://www.postgresql.org/message-id/E1YHHV8-00032A-Em@gemulon.postgresql.org

      // This is true for both actual 1 byte 0x00 values, as well as 6 byte
      // '\u0000' ones. Because '\\u0000u0000' would be replaced as '\u0000', we
      // also aggressively remove any concurrent slashes as well
      return string.replace(/(\\+u0000)|\u0000/g, ''); // eslint-disable-line
};

var deleteDocuments = function(db, postgresTable, docIdsToDelete) {
  if (docIdsToDelete && docIdsToDelete.length) {
    var query = format(DELETE_STMT, postgresTable, docIdsToDelete);

    query = sanitise(query);

    return db.query(query);
  } else {
    return rsvp.Promise.resolve();
  }
};

var getSeq = function(db, source) {
  // Find sequence for source
  return db.one(format(SELECT_SEQ_STMT, source))
    .then(function(result) {
      return result.seq;
    })
    .catch(function(err) {
      if(err.code && err.code !== NO_DATA_ERROR) {
        throw err;
      }
      // Find sequence for default database
      return db.one(format(SELECT_SEQ_STMT, DEFAULT_DATABASE))
        .then(function(result) {
          // Update default database with given source
          return db.query(format(UPDATE_SEQ_SOURCE_STMT, source, DEFAULT_DATABASE))
            .then(function() {
              return result.seq;
            });
        })
        .catch(function(err) {
          if(err.code && err.code !== NO_DATA_ERROR) {
            throw err;
          }
          // Default database does not exist, we create a new sequence
          return db.query(format(INSERT_SEQ_STMT,  0, source))
            .then(function() {
              return 0;
            });
        });
    });
};

var storeSeq = function(db, seq, source) {
  return db.query(format(UPDATE_SEQ_STMT, seq, source));
};

/*
Downloads all given documents from couchdb and stores them in Postgres, in batches.
We presume if a document is on this list it has changed, and thus needs updating.
*/
var loadAndStoreDocs = function(db, couchdb, concurrentDocLimit, docsToDownload, postgresTable) {
  if (docsToDownload.length) {
    var changeSet = docsToDownload.splice(0, concurrentDocLimit);

    return couchdb.allDocs({
      include_docs: true,
      keys: _.pluck(changeSet, 'id')
    }).then(function(couchDbResult) {
      log.debug('Pulled ' + couchDbResult.rows.length + ' results from couchdb');

      log.debug('Clearing any existing documents from postgresql');

      return deleteDocuments(db, postgresTable, _.pluck(couchDbResult.rows, 'id'))
        .then(function() {
          return couchDbResult;
        });
    }).then(function(couchDbResult) {
      log.debug('Inserting ' + couchDbResult.rows.length + ' results into postgresql');

      var insertSql = format(
        INSERT_DOC_STMT,
        postgresTable,
        couchDbResult.rows.map(function(row) {
          const isUserDoc = row.doc.type === 'user' && row.doc._id.startsWith('org.couchdb.user:');
          if (isUserDoc) {
            delete row.doc.password_scheme;
            delete row.doc.derived_key;
            delete row.doc.salt;
          }

          return [row.doc];
        })
      );

      insertSql = sanitise(insertSql);

      return db.query(insertSql);
    }).then(function() {
      return loadAndStoreDocs(db, couchdb, concurrentDocLimit, docsToDownload, postgresTable);
    });
  }
};

var emptyChangesSummary = function(lastSeq) {
  return {
    deleted: [],
    edited: [],
    lastSeq: lastSeq || 0
  };
};

var importChangesBatch = function(db, couchdb, concurrentDocLimit, changesLimit, source, postgresTable) {
  return getSeq(db, source)
    .then(function(seq) {
      log.debug('Downloading CouchDB changes feed from ' + seq);
      return couchdb.changes({ limit: changesLimit, since: seq });
    })
    .then(function(changes) {
      log.info('There are ' + changes.results.length + ' changes to process');

      if (!changes.results.length) {
        return emptyChangesSummary(changes.last_seq);
      }

      // TODO when node supports destructuring use it:
      // var [docsToDelete, docsToDownload] = _.partition... etc
      var deletesAndModifications = _.partition(changes.results, function(result) {
        return result.deleted;
      });
      var docsToDelete   = _.uniq(deletesAndModifications[0], _.property('id')),
          docsToDownload = _.uniq(deletesAndModifications[1], _.property('id'));

      var deletedDocIds = _.pluck(docsToDelete, 'id');
      var editedDocIds = _.pluck(docsToDownload, 'id');

      log.debug('There are ' +
        docsToDelete.length + ' deletions and ' +
        docsToDownload.length + ' new / changed documents');

      return deleteDocuments(db, postgresTable, deletedDocIds)
        .then(function() {
          return loadAndStoreDocs(db, couchdb, concurrentDocLimit, docsToDownload, postgresTable);
        })
        .then(function() {
          return {
            deleted: deletedDocIds || [],
            edited: editedDocIds || [],
            lastSeq: changes.last_seq
          };
        });
    });
};

var changesCount = function(changes) {
  return ((changes && changes.deleted && changes.deleted.length) || 0) +
         ((changes && changes.edited && changes.edited.length)   || 0);
};

module.exports = function(db, couchdb, concurrentDocLimit, changesLimit, source, postgresTable) {
  concurrentDocLimit = concurrentDocLimit || 100;
  changesLimit = changesLimit || 10000;
  postgresTable = postgresTable || 'couchdb';

  var importLoop = function(accChanges) {
    log.debug('Performing an import batch of up to ' + changesLimit + ' changes');

    return importChangesBatch(db, couchdb, concurrentDocLimit, changesLimit, source, postgresTable)
    .then(function(changes) {
      return storeSeq(db, changes.lastSeq, source).then(function() {
        if (changesCount(changes) > 0) {
          log.debug('Batch completed with ' + changesCount(changes) + ' changes');

          return importLoop({
            deleted: accChanges.deleted.concat(changes.deleted),
            edited: accChanges.edited.concat(changes.edited),
            lastSeq : changes.lastSeq
          });
        } else {
          log.debug('Import loop complete, ' + changesCount(accChanges) + ' changes total');

          // It's almost completely unlikely that this nunber will be different due to how
          // couchdb works (if there are absolutely no changes in a batch that's because you already
          // got to the end of all changes last time) but I'm counting that as an implementation
          // detail (eg maybe we change to a filtered changes feed in the future), so let's be sure.
          accChanges.lastSeq = changes.lastSeq;
          return accChanges;
        }
      });
    });
  };

  return {
    /*
      Imports all changes from CouchDB since last time into PostgreSQL,
      checkpointing the lastSeq value into postgres as it goes.
      Returns a summary of edits, deletes, and the latest seq number
    */
    importAll: function() { return importLoop(emptyChangesSummary()); },
    /*
      Imports one batch of `changesLimit` changes into PostgreSQL.
      Unlike `importAll` it does not checkpoint the lastSeq value into postgres,
      it is presumed you will do this yourself at a later stage.
      Returns a summary of edits, deletes, and the latest seq number from the batch
    */
    importBatch: function() { return importChangesBatch(db, couchdb, concurrentDocLimit, changesLimit, source, postgresTable); },
    /*
      Persists a given seq value.
    */
    storeSeq: function(seq) { return storeSeq(db, seq, source); },
    /*
      Returns a seq value for the given source.
    */
    _getSeq: function(source) { return getSeq(db, source); }
  };
};
