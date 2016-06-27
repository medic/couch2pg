var log = require('loglevel'),
    env = require('./env')(),
    Promise = require('rsvp').Promise,
    couch2pgMigrator = require('./libs/couch2pg/migrator'),
    xmlformsMigrator = require('./libs/xmlforms/migrator');

var couchdb = require('pouchdb')(env.couchdbUrl),
    db = require('pg-promise')({ 'promiseLib': Promise })(env.postgresqlUrl);

var couch2pg = require('./libs/couch2pg/importer')(
      db, couchdb,
      env.couch2pgDocLimit,
      env.couch2pgChangesLimit),
    xmlforms = require('./libs/xmlforms/extractor')(db);

var batchLoop = function() {
  var completeBatch = function(lastSeq) {
    return couch2pg.storeSeq(lastSeq)
      .then(function() {
        log.info('Batch completed up to ' + lastSeq);
      });
  };

  log.info('Beginning couch2pg and xmlforms batch');

  return couch2pg.importBatch()
  .then(function(changes) {
    var allDocs = changes.deleted.concat(changes.edited);
    log.debug('There are ' + allDocs.length + ' changes');

    if (allDocs.length > 0) {
      return xmlforms.extract(allDocs)
      .then(function() {
        return completeBatch(changes.lastSeq);
      })
      .then(batchLoop);
    } else {
      return completeBatch(changes.lastSeq);
    }
  });
};

var run = function() {
  log.info('Beginning couch2pg and xmlforms run');

  return batchLoop()
  .catch(function(err) {
    log.error(err.stack);
  })
  .then(function() {
    log.info('Run complete. Next run at ' + new Date(new Date().getTime() + env.sleepMs));
    setInterval(run, env.sleepMs);
  });
};

couch2pgMigrator(env.postgresqlUrl)()
.then(function() {
  return xmlformsMigrator(env.postgresqlUrl)();
})
.then(run);
