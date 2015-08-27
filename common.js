exports.Promise = require('rsvp').Promise;

function wrapError(err) {
  // sometimes the err is a string, other times not. :(
  if (err.length !== undefined) {
    // wrap strings (which have length prop) with Error()
    err = Error(err);
  }
  return err;
}

exports.handleError = function (err) {
  throw wrapError(err);
};

exports.handleReject = function (reject) {
  return function (err) {
    console.log('Error encountered!');
    return reject(wrapError(err));
  };
};
