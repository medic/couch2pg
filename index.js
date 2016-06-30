var log = require('loglevel'),
    Promise = require('rsvp').Promise,
    env = require('./env')(),
    couch2pgMigrator = require('./libs/couch2pg/migrator'),
    xmlformsMigrator = require('./libs/xmlforms/migrator');

var couchdb = require('pouchdb')(env.couchdbUrl),
    db = require('pg-promise')({ 'promiseLib': Promise })(env.postgresqlUrl);

var couch2pg = require('./libs/couch2pg/importer')(
      db, couchdb,
      env.couch2pgDocLimit,
      env.couch2pgChangesLimit),
    xmlforms = require('./libs/xmlforms/updater')(db);

var fallback = 0;
var sleepMs = function(errored) {
  if (errored) {
    var fallBackMs = fallback * 1000 * 60;
    if (fallBackMs < env.sleepMs) {
      fallBackMs++;
      return fallBackMs;
    } else {
      return env.sleepMs;
    }
  } else {
    fallback = 0;
    return env.sleepMs;
  }
};

var migrateCouch2pg = function() {
  return couch2pgMigrator(env.postgresqlUrl)();
};
var migrateXmlforms = function() {
  return xmlformsMigrator(env.postgresqlUrl)();
};

var delayLoop = function(loopFn, errored) {
  return new Promise(function(resolve) {
    var ms = sleepMs(errored);
    log.info('Run '+(errored ? 'errored' : 'complete') + '. Next run at ' + new Date(new Date().getTime() + ms));
    if (ms === 0) {
      resolve();
    } else {
      setInterval(resolve, ms);
    }
  });
};

var run = function() {
  log.info('Beginning couch2pg and xmlforms run at ' + new Date());

  return couch2pg.importAll()
  .catch(function(err) {
    log.error('Couch2PG import failed');
    log.error(err.stack);
  })
  .then(function() {
    return xmlforms.update();
  })
  .catch(function(err) {
    log.error('XMLForms support failed');
    log.error(err.stack);
    return true;
  })
  .then(function(errored) {
    return delayLoop(run, errored);
  })
  .then(run);
};

var legacyRun = function() {
  log.info('Beginning couch2pg run at ' + new Date());

  return couch2pg.importAll()
  .catch(function(err) {
    log.error('Couch2PG import failed');
    log.error(err.stack);
    return true;
  })
  .then(function(errored) {
    return delayLoop(legacyRun, errored);
  })
  .then(legacyRun);
};

var doRun = function() {
  if (env.legacyMode) {
    log.info('Adapter is running in LEGACY(0.4) mode');

    return migrateCouch2pg()
    .then(legacyRun);
  } else {
    log.info('Adapter is running in NORMAL mode');

    return migrateCouch2pg()
    .then(migrateXmlforms)
    .then(run);
  }
};

doRun().catch(function(err) {
  log.error('An unrecoverable error occurred');
  log.error(err.stack);
  log.error('exiting');
  process.exit(1);
});
