var http = require('http');
var sinon = require('sinon');
var nock = require('nock');

var common = require('../common');
var expect = common.expect;

var cdbfuncs = require('../../cdbfuncs');

var dl_data = 'cmVtIGVhcXVlIG9mZmljaWEgbGFib3J1bQp2b2x1cHRhdGVtIGVycm9yIHNlZAphY2N1c2FtdXMgbWFpb3JlcyByZXByZWhlbmRlcml0IHNpdCBoYXJ1bSBxdW9kIGVzc2Ugc2VkIGFkaXBpc2NpCm1hZ25pIGF0IGFkIHJlcnVtIHF1aWJ1c2RhbSBhbmltaSBhdXQgZXQgaXBzYW0gdm9sdXB0YXMKZXhlcmNpdGF0aW9uZW0gdXQgZWEgbmloaWwgZXVtIHF1bwpldCBtb2RpIGV0IHJlY3VzYW5kYWUgaW4gbW9sZXN0aWFlIGVycm9yIGFsaXF1YW0KIA1ldCBleGVyY2l0YXRpb25lbSBkb2xvcmVzIGFjY3VzYW11cyB2b2x1cHRhcyBvZGlvCmF1dCBkb2xvcmlidXMgbm9uIGV0IHNhZXBlIGV4cGxpY2FibyBtb2xsaXRpYSBhdXQgbmVtbwpuZW1vIGxhYm9ydW0gZG9sb3JlbXF1ZSBhY2N1c2FudGl1bQppbiBuaXNpIGVzdCBudW1xdWFtIHF1aWEKIA1sYWJvcmlvc2FtIGFyY2hpdGVjdG8gbmFtCmRvbG9yaWJ1cyBhc3BlcmlvcmVzIGlkIHF1aSB0ZW1wb3JhIGxhYm9ydW0gcXVvZCBkb2xvcmVtCnF1aSB2ZWxpdCB1dCByZXJ1bSBzZXF1aSBhbGlxdWFtCnZlbCBlc3QgbWF4aW1lIGVuaW0gcGVyc3BpY2lhdGlzIHByYWVzZW50aXVtIGV0IGVycm9y';

var urlFixture = 'http://uZn:pZw@192.168.10.12:1025/me/_de/me?include_docs=true';

describe('fetchDocs', function() {

  var nock_http;

  beforeEach(function() {
    // reset nock interceptor
    nock_http = nock('http://192.168.10.12:1025')
      .get('/me/_de/me?include_docs=true');
  });

  it('requests the specified URL', function() {
    var mock_http = sinon.mock(http, 'request', function(fetchURL) {
      return expect(fetchURL).to.equal(urlFixture);
    });
    cdbfuncs.fetchDocs(mock_http, urlFixture);
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
