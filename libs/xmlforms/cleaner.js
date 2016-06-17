var _ = require('underscore'),
    rsvp = require('rsvp'),
    log = require('loglevel'),
    format = require('pg-format');

var getTablesForDocs = function(db, docIds) {
  return db.query(format('SELECT uuid, formname, formversion FROM form_metadata WHERE uuid in (%L)', docIds))
  .then(function(results) {
    log.info('Found ' + results.length + ' documents to be removed before regenerating');

    var grouped =_.groupBy(results, function(row) {
      return 'formview_' + row.formname + '_' + row.formversion;
    });

    _.chain(grouped)
      .keys()
      .each(function(key) {
        grouped[key] = _.pluck(grouped[key], 'uuid');
      });

    return grouped;
  });
};

var deleteDocsInTable = function(db, tableToDocs) {
  return _.reduce(
    _.keys(tableToDocs),
    function(thenChain, key) {
      return db.query(format('DELETE FROM %I WHERE xmlforms_uuid IN (%L)', key, tableToDocs[key]));
    },
    rsvp.Promise.resolve()
    ).then(function() {
      return tableToDocs;
    });
};

var deleteMetadata = function(db, tableToDocs) {
  var allDocs = _.flatten(_.values(tableToDocs));

  if (allDocs.length > 0) {
    return db.query(format('DELETE FROM form_metadata WHERE uuid in (%L)', allDocs));
  } else {
    return rsvp.Promise.resolve();
  }
};

module.exports.clean = function(db, docIds) {
  return getTablesForDocs(db, docIds)
    .then(function(tableToDocs) {
      return deleteDocsInTable(db, tableToDocs);
    })
    .then(function(tableToDocs) {
      log.info('Removed documents from data tables');

      return deleteMetadata(db, tableToDocs);
    })
    .then(function() {
      log.info('Removed documents from metadata table');
    });
};
