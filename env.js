var log = require('loglevel');

module.exports = function() {
  if (process.env.COUCH2PG_DEBUG) {
    log.setDefaultLevel('debug');
  } else {
    log.setDefaultLevel('info');
  }

  return {
    couchdbUrl: process.env.COUCHDB_URL,
    postgresqlUrl: process.env.POSTGRESQL_URL,
    couch2pgDocLimit: process.env.COUCH2PG_DOC_LIMIT || 100,
    couch2pgChangesLimit: process.env.COUCH2PG_CHANGES_LIMIT || 10000,
    sleepMs: (process.env.COUCH2PG_SLEEP_MINS || 60) * 60 * 1000
  };
};
