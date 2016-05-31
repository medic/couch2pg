var _ = require('underscore'),
    couch2pg =  require('./libs/couch2pg/index'),
    xmlforms = require('./libs/xmlforms/index');

var sleepMs = process.env.COUCH2PG_SLEEP_MINS * 60 * 1000;
if (isNaN(sleepMs)) {
  console.log('Missing time interval. Defaulting to once per hour.');
  sleepMs = 1 * 60 * 60 * 1000;
}

var loop = function () {
  console.log('Starting loop at ' + new Date());
  return couch2pg.migrate()
    .then(function() {
      console.log('Couch2pg Migration checks complete');
    })
    .then(couch2pg.import)
    .then(function () {
      console.log('Imported successfully at ' + Date());
    })
    .then(xmlforms.migrate)
    .then(function() {
      console.log('xmlforms Migration checks complete');
    })
    .then(xmlforms.extract)
    .then(function () {
      console.log('XML forms completed at ' + Date());
    })
    .catch(function(err) {
      console.error('Something went wrong', err);
    });
};

loop().then(function() {
  console.log('Next run at ' + new Date(new Date().getTime() + sleepMs));
  setInterval(loop, sleepMs);
});
