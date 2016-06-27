//TODO fix this in alignment with ../index.js

var log = require('loglevel'),
    couch2pg = require('./index');

if (process.env.COUCH2PG_DEBUG) {
  log.setDefaultLevel('debug');
} else {
  log.setDefaultLevel('info');
}

var sleepMs = process.env.COUCH2PG_SLEEP_MINS * 60000;
if (isNaN(sleepMs)) {
  log.info('Missing time interval. Defaulting to once per hour.');
  sleepMs = 1 * 60 * 60 * 1000;
}

var loop = function() {
  log.info('Starting loop at ' + new Date());
  return couch2pg.migrate()
    .then(couch2pg.import)
    .then(function () {
      log.info('Imported successfully at ' + Date());
    }, function (err) {
      log.error('Import errored at ' + Date(), err);
    });
};

loop().then(function() {
  log.info('Next run at ' + new Date(new Date().getTime() + sleepMs));
  setInterval(loop, sleepMs);
});
