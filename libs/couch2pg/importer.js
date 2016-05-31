var _ = require('underscore'),
    Promise = require('rsvp').Promise,
    format = require('pg-format');

var deleteDocuments = function(db, docIdsToDelete) {
  if (docIdsToDelete && docIdsToDelete.length > 0) {
    return db.query(
      format('DELETE FROM couchdb WHERE doc->>\'_id\' in (%L)',
        docIdsToDelete));
  } else {
    return Promise.resolve();
  }
};

var storeSeq = function(db, seq) {
  return db.query(format('UPDATE couchdb_progress SET seq = %L', seq));
};

/*
NB: loadAndStore doesn't try to only load and store documents that have changed
from postgres' perspective, because we presume if something appears in the
changes feed it needs updating.

If somehow this changes we can make this code more complicated.
*/
var loadAndStoreDocs = function(db, couchdb, concurrentDocLimit, docsToDownload) {
  if (docsToDownload.length > 0) {
    var changeSet = docsToDownload.splice(0, concurrentDocLimit);
    var maxSeq = _.max(_.pluck(changeSet, 'seq'));

    return couchdb.allDocs({
      include_docs: true,
      keys: _.pluck(changeSet, 'id')
    }).then(function(couchDbResult) {
      console.log('Pulled ' + couchDbResult.rows.length + ' results from couchdb');

      console.log('Clearing any existing documents from postgresql');

      return deleteDocuments(db, _.pluck(couchDbResult.rows, 'id'))
        .then(function() {
          return couchDbResult;
        });
    }).then(function(couchDbResult) {
      console.log('Inserting ' + couchDbResult.rows.length + ' results into couchdb');

      return db.query(format(
        'INSERT INTO couchdb (doc) VALUES %L',
        couchDbResult.rows.map(function(row) {
          return [JSON.stringify(row.doc)];
        })));
    }).then(function() {
      return storeSeq(db, maxSeq);
    }).then(function() {
      console.log('Marked seq at ' + maxSeq);

      return loadAndStoreDocs(db, couchdb, concurrentDocLimit, docsToDownload);
    });
  }
};

module.exports = function(db, couchdb, concurrentDocLimit) {
  concurrentDocLimit = concurrentDocLimit || 100;

  var _import = function() {
    return db.one('SELECT seq FROM couchdb_progress')
      .then(function(seqResult) {
        console.log('Downloading CouchDB changes feed from ' + seqResult.seq);
        return couchdb.changes({
          since: seqResult.seq
        });
      })
      .then(function(changes) {
        console.log('There are ' + changes.results.length + ' changes to process');

        if (changes.results.length === 0) {
          return Promise.resolve();
        }

        // TODO when node supports destructuring use it:
        // var [docsToDelete, docsToDownload] = _.partition... etc
        var deletesAndModifications = _.partition(changes.results, function(result) {
          return result.deleted;
        });
        var docsToDelete = deletesAndModifications[0],
            docsToDownload = deletesAndModifications[1];

        console.log('There are ' +
          docsToDelete.length + ' deletions and ' +
          docsToDownload.length + ' new / changed documents');

        return deleteDocuments(db, _.pluck(docsToDelete, 'id'))
          .then(function() {
            return loadAndStoreDocs(db, couchdb, concurrentDocLimit, docsToDownload);
          })
          .then(function() {
            console.log('Marked final seq of ' + changes.last_seq);
            return storeSeq(db, changes.last_seq);
          });
      });
  };

  return {
    import: _import
  };
};
