var couch2pg = require('./index');
var Promise = require('../common').Promise;

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

var loop = function () {
  var starttime;
  startTime()
    .then(function (time) {
      starttime = time;
    })
    .then(couch2pg)
    .then(function () {
      console.log('Imported successfully at ' + Date());
    }, function (err) {
      console.log('Import errored at ' + Date());
      console.log(err);
    })
    .then(function () {
      console.log('Next run at ' + new Date(starttime.valueOf() + sleepMins));
    });
};

loop();
setInterval(loop, sleepMins);
