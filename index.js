var log = require('loglevel'),
    couch2pg =  require('./libs/couch2pg/index'),
    xmlforms = require('./libs/xmlforms/index');

if (process.env.COUCH2PG_DEBUG) {
  log.setDefaultLevel('debug');
} else {
  log.setDefaultLevel('info');
}

var sleepMs = process.env.COUCH2PG_SLEEP_MINS * 60 * 1000;
if (isNaN(sleepMs)) {
  log.debug('Missing time interval. Defaulting to once per hour.');
  sleepMs = 1 * 60 * 60 * 1000;
}

var loop = function () {
  console.log('Starting loop at ' + new Date());
  return couch2pg.migrate()
    .then(function() {
      log.info('Couch2pg Migration checks complete');
    })
    .then(couch2pg.import)
    .then(function () {
      log.info('Imported successfully at ' + Date());
    })
    .then(xmlforms.migrate)
    .then(function() {
      log.info('xmlforms Migration checks complete');
    })
    .then(xmlforms.extract)
    .then(function () {
      log.info('XML forms completed at ' + Date());
    })
    .catch(function(err) {
      log.error('Something went wrong at ' + Date(), err);
    });
};

loop().then(function() {
  log.info('Next run at ' + new Date(new Date().getTime() + sleepMs));
  setInterval(loop, sleepMs);
});
