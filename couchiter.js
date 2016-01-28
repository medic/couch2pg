var Promise = require('./common').Promise;
var handleReject = require('./common').handleReject;

exports.extractFromCouchDump = function(dataString) {
  return new Promise(function (resolve) {
    var data = JSON.parse(dataString);
    var docs = [];
    data.rows.forEach(function (row) {
      docs.push(row.doc);
    });
    return resolve(docs);
  });
};

exports.extractUUIDFromCouchDump = function(dataString) {
  return new Promise(function (resolve) {
    var data = JSON.parse(dataString);
    var uuids = [];
    data.rows.forEach(function (row) {
      uuids.push({
        'id': row.id,
        'rev': row.value.rev
      });
    });
    return resolve(uuids);
  });
};

exports.skipExistingInPG = function(db, pgsql, docsInCouch) {
  return db.query(pgsql.fetchEntries()).then(function (docsInPg) {
    // compile docsInPg to a simple hash lookup
    // a single O(n) traversal leading to O(1) checks instead of multiple
    // O(n) traversals later.
    var docsInPgHash = {};
    docsInPg.forEach(function (pgdoc) {
      // string concatenation of _id and _rev should be unique
      docsInPgHash[pgdoc._id + pgdoc._rev] = true;
    });
    return docsInCouch.filter(function (cddoc) {
      if (docsInPgHash[cddoc._id + cddoc._rev]) {
        // doc is already in postgres. filter it out.
        return false;
      } else {
        // doc is not in postgres. keep it.
        return true;
      }
    });
  });
};

exports.insertListToPG = function(db, pgsql, dataList) {
  return new Promise(function (resolve, reject) {
    // create a base accepting promise for an iterative promise chain
    var queries = new Promise(function (resolve) { resolve(); });
    dataList.forEach(function (datum) {
      queries = queries.then(function () {
        return db.query(pgsql.insertIntoColumn(JSON.stringify(datum)));
      }).catch(handleReject(reject));
    });
    // only resolve when the queries complete
    queries.then(function () {
      return resolve();
    }).catch(handleReject(reject));
  });
};
