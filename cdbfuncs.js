var Promise = require('./common').Promise;
var handleReject = require('./common').handleReject;

exports.fetchDocs = function(httplib, url) {
  return new Promise(function (resolve, reject) {
    httplib.get({ url: url }, function (err, httpResponse, buffer) {
      if ((!err) &&
          (httpResponse.statusCode >= 200 && httpResponse.statusCode < 300)) {
        return resolve(buffer);
      }
      if (err) {
        return handleReject(reject)(err);
      }
      return handleReject(reject)('Unsatisfactory response: ' + httpResponse.statusCode);
    });
  });
};
