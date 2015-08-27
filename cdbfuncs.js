var Promise = require('./common').Promise;

exports.fetchDocs = function(httplib, url) {
  return new Promise(function (resolve, reject) {
    var incoming = httplib.request(url);
    var buffer = '';
    incoming.on('response', function (res) {
      if ((res.statusCode >= 300) || (res.statusCode < 200)) {
          reject('Invalid status code: ' + [res.statusCode,res.StatusMessage].toString());
      }
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        buffer = buffer + new Buffer(chunk);
      });
      res.on('end', function() {
        resolve(buffer);
      });
    });
    incoming.end();
  });
};
