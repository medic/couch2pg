var fs = require('fs');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.config.includeStack = true;
chai.use(chaiAsPromised);

exports.expect = chai.expect;
var common = require('../libs/common');
exports.Promise = common.Promise;
exports.handleError = common.handleError;
exports.handleReject = common.handleReject;

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
    return new common.Promise(function (resolve) {
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
    return new common.Promise(function (resolve, reject) {
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
