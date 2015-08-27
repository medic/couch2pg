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
