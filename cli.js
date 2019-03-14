#! /usr/bin/env node
var urlParser = require('url');
var log = require('loglevel-message-prefix')(require('loglevel'), {
    prefixes: ['timestamp', 'level']
});

var env = require('./env')(log);

// Removes credentials from couchdb url
// Converts http://admin:pass@localhost:5984/medic
// to localhost:5984/medic -- seq source
var parseSource = function(url) {
  var source = urlParser.parse(url);
  return source.host+source.path;
};

var rsvp = require('rsvp'),
    couchdb = require('./db')(env.couchdbUrl),
    db = require('pg-promise')({ 'promiseLib': rsvp.Promise })(env.postgresqlUrl),
    couch2pgMigrator = require('./lib/migrator'),
    couch2pg = require('./lib/importer')(
      db, couchdb,
      env.couch2pgDocLimit,
      env.couch2pgChangesLimit,
      parseSource(env.couchdbUrl));

var backoff = 0;
var sleepMs = function(errored) {
  if (errored) {
    var backoffMs = backoff * 1000 * 60;
    if (backoffMs < env.sleepMs) {
      backoff++;
      return backoffMs;
    } else {
      return env.sleepMs;
    }
  } else {
    backoff = 0;
    return env.sleepMs;
  }
};

var migrateCouch2pg = function() {
  return couch2pgMigrator(env.postgresqlUrl)();
};

var delayLoop = function(errored) {
  return new rsvp.Promise(function(resolve) {
    var ms = sleepMs(errored);
    log.info('Run '+(errored ? 'errored' : 'complete') + '. Next run at ' + new Date(new Date().getTime() + ms));
    if (ms === 0) {
      resolve();
    } else {
      setTimeout(resolve, ms);
    }
  });
};

var doRun = function() {
  log.info('Beginning couch2pg run at ' + new Date());

  if (!env.continuous) {
    return couch2pg.importAll();
  } else {
    return couch2pg.importAll()
    .then(
      function() {
        return delayLoop();
      },
      function(err) {
        log.error('Couch2PG import failed');
        log.error(err.stack);

        return delayLoop(true);
      })
    .then(doRun);
  }
};

migrateCouch2pg()
.then(doRun)
.then(function() {
  process.exit(0);
})
.catch(function(err) {
  log.error('An unrecoverable error occurred');
  log.error(err.stack);
  log.error('exiting');
  process.exit(1);
});
