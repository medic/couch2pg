exports.Promise = require('rsvp').Promise;

function wrapError(err) {
  // sometimes the err is a string, other times not. :(
  if (err.length !== undefined) {
    // wrap strings (which have length prop) with Error()
    err = Error(err);
  }
  console.error('Error encountered!');
  console.error(err);
  return err;
}

exports.handleError = function (err) {
  throw wrapError(err);
};

exports.handleReject = function (reject) {
  return function (err) {
    return reject(wrapError(err));
  };
};
