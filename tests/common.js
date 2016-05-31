var fs = require('fs'),
    Promise = require('rsvp').Promise,
    chai = require('chai'),
    chaiAsPromised = require('chai-as-promised');

chai.config.includeStack = true;
chai.use(chaiAsPromised);

exports.expect = chai.expect;

exports.dbgen = function(callstack, retval) {
  // callstack should be a list
  // retval should be a list of ordered return values
  var counter = 0;
  // handler for undefined retval: treat as single call with no response
  if (retval === undefined) {
    retval = [undefined];
  }
  return {'query': function(sql) {
    // store the sql for comparison
    callstack.push(sql);
    // accept anything passed with custom value returned
    return new Promise(function (resolve) {
      if (counter > retval.length) {
        throw 'Database called more often than expected.';
      }
      var resolveval = retval[counter];
      counter = counter + 1;
      return resolve(resolveval);
    });
  }};
};

exports.readFixtureFile = function (fixturePath) {
  return function(filename, storage) {
    return new Promise(function (resolve, reject) {
      fs.readFile(fixturePath + filename, 'utf8', function (err,data) {
        if (err) {
          return reject(err);
        } else {
          storage.push(data);
          return resolve();
        }
      });
    });
  };
};
