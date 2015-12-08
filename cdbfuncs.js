var Promise = require('./common').Promise;
var handleReject = require('./common').handleReject;
var qs = require('querystring');
var ul = require('url');

exports.filterIncludeDocs = function(url, include_docs) {
  if (include_docs === true || include_docs === false) {
    var urlParts = ul.parse(url);
    var queryParts = qs.parse(urlParts.query);
    if (queryParts === null || Object.keys(queryParts).length === 0) {
      // no query string present, directly add one here.
      url = url + '?include_docs=' + include_docs;
    } else {
      // muck with query string
      queryParts.include_docs = include_docs;
      urlParts.search = qs.stringify(queryParts);
      url = ul.format(urlParts);
    }
  }
  return url;
};

exports.fetchDocs = function(httplib, url, include_docs) {
  url = exports.filterIncludeDocs(url, include_docs);
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
