var Promise = require('../common').Promise;

exports.extractFromCouchDump = function(dataString) {
  return new Promise(function (resolve) {
    var data = JSON.parse(dataString);
    return resolve(data.rows.map(function (row) {
      // add placeholder for UUIDs with no doc (should such a thing exist)
      if (row.doc === undefined) {
        // placeholder in postgres to not fetch it every time.
        return { '_id': row.id, '_rev': row.value.rev, 'type': 'no doc' };
      } else {
        return row.doc;
      }
    }));
  });
};

exports.extractUUIDFromCouchDump = function(dataString) {
  return new Promise(function (resolve) {
    var data = JSON.parse(dataString);
    return resolve({
      'keys': data.rows.map(function (row) {
                return row.id;
              })
    });
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
      // revision is not used for bulk fetch
      //docsInPgHash[pgdoc._id + pgdoc._rev] = true;
      docsInPgHash[pgdoc._id] = true;
    });
    var keys = docsInCouch.keys.filter(function (uuid) {
      if (docsInPgHash[uuid]) {
        // doc is already in postgres. filter it out.
        return false;
      } else {
        // doc is not in postgres. keep it.
        return true;
      }
    });
    return { 'keys': keys }; 
  });
};

exports.insertListToPG = function(db, pgsql, dataList) {
  if (dataList.length === 0) {
    // NOOP if there's no data to insert.
    return new Promise(function (resolve) { return resolve(); });
  }
  // pass a list of lists of items onto the database function
  return db.query(pgsql.insertIntoColumn(dataList.map(function (datum) {
    // stringify each item of the dataList to JSON
    // each value is a list of one field
    return [JSON.stringify(datum)];
  })));
};

exports.reduceUUIDs = function(UUIDlist, limit) {
  // return no more than limit values for UUIDlist
  if (!limit) {
    // 0, '', undefined, etc; implies passthrough.
    return new Promise(function (resolve) {
      // passthrough without limit
      resolve(UUIDlist);
    });
  } else {
    return new Promise(function (resolve) {
      var slice = UUIDlist.keys.slice(0,limit);
      resolve({ 'keys': slice });
    });
  }
};
