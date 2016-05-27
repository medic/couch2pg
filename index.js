var couch2pg = require('./libs/couch2pg/index'),
    xmlforms = require('./libs/xmlforms/index'),
    postgrator = require('postgrator'),
    Promise = require('rsvp').Promise;

// convert minutes into ms
var sleepMins = process.env.COUCH2PG_SLEEP_MINS * 60000;
if (isNaN(sleepMins)) {
  // no interval specified. Default to once per hour.
  console.log('Missing time interval. Defaulting to once per hour.');
  sleepMins = 3600000;
}

var startTime = function() {
  return new Promise(function (resolve) {
    var starttime = new Date();
    console.log('\nStarting import at ' + starttime);
    resolve(starttime);
  });
};

var potentiallyMigrateDatabase = function() {
  return new Promise(function (resolve, reject) {
    postgrator.setConfig({
      migrationDirectory: __dirname + '/migrations',
      driver: 'pg',
      connectionString: process.env.POSTGRESQL_URL
    });

    postgrator.migrate('201505271423', function(err, migrations) {
      if (err) {
        reject(err);
      } else {
        postgrator.endConnection(function() {
          resolve(migrations);
        });
      }
    });
  });
};

var loop = function () {
  var starttime;
  startTime()
    .then(function (time) {
      starttime = time;
    })
    .then(potentiallyMigrateDatabase)
    .then(function(migrations) {
      console.log('Sucessfully migrated', migrations);
    })
    .then(couch2pg)
    .then(function () {
      console.log('Imported successfully at ' + Date());
    })
    .then(xmlforms)
    .then(function () {
      console.log('XML forms completed at ' + Date());
    })
    .catch(function(err) {
      console.error(err);
    })
    .finally(function () {
      console.log('Next run at ' + new Date(starttime.valueOf() + sleepMins));
    });
};

loop();
setInterval(loop, sleepMins);
