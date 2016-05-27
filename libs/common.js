var scrub_inner = require('pg-format');

exports.scrub = function() {
  // Intercept calls to scrub SQL and insert SET ROLE.

  // This requires a full_access role to be present for the adapter to use,
  // and the membership required to switch into the full_access role.

  // convert unknown list of arguments into array for alteration
  var args = Array.prototype.slice.call(arguments);
  // modify first argument (query string)
  args[0] = 'SET ROLE full_access;' + args[0];
  // push arguments with modification
  return scrub_inner.apply(null, args);
};

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
