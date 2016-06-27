var _ = require('underscore'),
    log = require('loglevel'),
    rsvp = require('rsvp'),
    formreport = require('./formreport'),
    pgsql = require('./pgsql'),
    cleaner = require('./cleaner');

var pluckier = function(data, terms) {
  data = _.pluck(data, terms.shift());
  if (terms.length === 0) {
    return data;
  } else {
    return pluckier(data, terms);
  }
};

module.exports = function(db) {
  return {
    extract: function(changedDocIds) {
      if (!changedDocIds || changedDocIds.length < 0) {
        log.debug('No changes, no need to run xmlforms');
        return rsvp.Promise.resolve();
      } else {
        log.debug('Cleaning up ' + changedDocIds.length + ' changed documents');

        return cleaner.clean(db, changedDocIds)
        .then(function () {
          log.debug('Find unparsed reports and parse them');
          /*
            We don't need to constrain by changedDocIds, this will occur tacitly
            in practice because the DB state should be up-to-date except for
            changedDocIds (as couch2pg and xmlforms get run in tandem).
            If that hasn't happened for some reason this will conveniently bring
            the DB state up-to-date, and thus correct for the next run.
          */
          return formreport.fetchAndParseReports(db, pgsql);
        })
        .then(function (reports) {
          if (log.getLevel() <= log.levels.DEBUG) {
            var reportCount = _.pluck(_.values(reports), 'docs').reduce(function(acc, docs) {
              return acc + ((docs && docs.length) || 0);
            }, 0);

            log.debug('Found ' + reportCount + ' new documents of type report to extract');
          }

          if (!_.isEmpty(reports)) {
            log.debug('Create form tables to store reports');
            return formreport.createTables(db, pgsql, reports)
            .then(function (reports) {
              log.debug('Writing report metadata to database');
              return formreport.storeMetaData(db, pgsql, reports);
            })
            .then(function (reports) {
              log.debug('Writing report data to database');
              return formreport.storeReports(db, pgsql, reports);
            })
            .then(function () {
              log.debug('Refreshing materialized views');
              return db.query(pgsql.refreshMatViews());
            });
          }
        });
      }
    }
  };
};

