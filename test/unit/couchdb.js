var http = require('request');
var nock = require('nock');

var common = require('../common');
var expect = common.expect;

var cdbfuncs = require('../../cdbfuncs');

var dl_data = 'cmVtIGVhcXVlIG9mZmljaWEgbGFib3J1bQp2b2x1cHRhdGVtIGVycm9yIHNlZAphY2N1c2FtdXMgbWFpb3JlcyByZXByZWhlbmRlcml0IHNpdCBoYXJ1bSBxdW9kIGVzc2Ugc2VkIGFkaXBpc2NpCm1hZ25pIGF0IGFkIHJlcnVtIHF1aWJ1c2RhbSBhbmltaSBhdXQgZXQgaXBzYW0gdm9sdXB0YXMKZXhlcmNpdGF0aW9uZW0gdXQgZWEgbmloaWwgZXVtIHF1bwpldCBtb2RpIGV0IHJlY3VzYW5kYWUgaW4gbW9sZXN0aWFlIGVycm9yIGFsaXF1YW0KIA1ldCBleGVyY2l0YXRpb25lbSBkb2xvcmVzIGFjY3VzYW11cyB2b2x1cHRhcyBvZGlvCmF1dCBkb2xvcmlidXMgbm9uIGV0IHNhZXBlIGV4cGxpY2FibyBtb2xsaXRpYSBhdXQgbmVtbwpuZW1vIGxhYm9ydW0gZG9sb3JlbXF1ZSBhY2N1c2FudGl1bQppbiBuaXNpIGVzdCBudW1xdWFtIHF1aWEKIA1sYWJvcmlvc2FtIGFyY2hpdGVjdG8gbmFtCmRvbG9yaWJ1cyBhc3BlcmlvcmVzIGlkIHF1aSB0ZW1wb3JhIGxhYm9ydW0gcXVvZCBkb2xvcmVtCnF1aSB2ZWxpdCB1dCByZXJ1bSBzZXF1aSBhbGlxdWFtCnZlbCBlc3QgbWF4aW1lIGVuaW0gcGVyc3BpY2lhdGlzIHByYWVzZW50aXVtIGV0IGVycm9y';

var urlObj = {
  'scheme': 'http',
  'user': 'uZn',
  'pass': 'pZw',
  'host': '192.168.10.12:1025',
  'uri': '/me/_de/me?something',
  'uriT': '/me/_de/me?something&include_docs=true',
  'uriF': '/me/_de/me?something&include_docs=false'
};
var urlFixture = urlObj.scheme + '://' + urlObj.user + ':' + urlObj.pass + '@' + urlObj.host + urlObj.uri;
var urlFixtureIDT = urlFixture + '&include_docs=true';
var urlFixtureIDF = urlFixture + '&include_docs=false';

//var docList = '';

describe('fetchDocs()', function() {

  var nock_http;
  var requestURLs = [
    { 'uri': urlObj.uri, 'url': urlFixture },
    { 'uri': urlObj.uriT, 'url': urlFixtureIDT },
    { 'uri': urlObj.uriF, 'url': urlFixtureIDF }
  ];

  beforeEach(function() {
    // reset nock interceptor
    nock_http = nock(urlObj.scheme + '://' + urlObj.host)
      .get(urlObj.uri);
  });

  context('given no include_docs override', function() {
    requestURLs.forEach(function (testURL) {
      var storeInput;
      before(function (done) {
        storeInput = '';
        nock_http = nock(urlObj.scheme + '://' + urlObj.host)
          .get(testURL.uri);
        nock_http.reply(200, function(uri) {
          storeInput = uri;
          done();
          return uri;
        });
        cdbfuncs.fetchDocs(http, testURL.url);
      });
      it('requests without modification ' + testURL.url, function() {
        return expect(storeInput).to.equal(testURL.uri);
      });
    });
  });

  context('given true include_docs override', function() {
    requestURLs.forEach(function (testURL) {
      var storeInput;
      before(function (done) {
        storeInput = '';
        nock_http = nock(urlObj.scheme + '://' + urlObj.host)
          .get(testURL.uri);
        nock_http.reply(200, function(uri) {
          storeInput = uri;
          done();
          return uri;
        });
        cdbfuncs.fetchDocs(http, testURL.url, true);
      });
      it('requests with include_docs=true against ' + testURL.url, function() {
        return expect(storeInput).to.equal(urlObj.uriT);
      });
    });
  });

  context('given false include_docs override', function() {
    requestURLs.forEach(function (testURL) {
      var storeInput;
      before(function (done) {
        storeInput = '';
        nock_http = nock(urlObj.scheme + '://' + urlObj.host)
          .get(testURL.uri);
        nock_http.reply(200, function(uri) {
          storeInput = uri;
          done();
          return dl_data;
        });
        cdbfuncs.fetchDocs(http, testURL.url, false);
      });
      it('requests with include_docs=false against ' + testURL.url, function() {
        return expect(storeInput).to.equal(urlObj.uriF);
      });
    });
  });

  it('returns data via promise without modification', function() {
    nock_http.reply(200, dl_data);
    var promise = cdbfuncs.fetchDocs(http, urlFixture);
    return expect(promise).to.eventually.deep.equal(dl_data);
  });

  it('rejects promise when data not found', function() {
    nock_http.reply(404);
    var promise = cdbfuncs.fetchDocs(http, urlFixture);
    return expect(promise).to.be.rejected;
  });

  //it('rejects promise when cannot connect occurs', function() {
  //  cannot figure out how to mock or nock this
  //});

  //it('rejects promise when data read error occurs', function() {
  //  cannot figure out how to mock or nock this
  //});

});
