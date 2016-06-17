/*jshint expr: true*/
require('chai').should();

var sinon = require('sinon'),
    match = sinon.match,
    Promise = require('rsvp').Promise,
    rewire = require('rewire'),
    cleaner = rewire('../../libs/xmlforms/cleaner');

describe('cleaner', function() {
  var db;
  beforeEach(function() {
    db = {
      query: function() {}
    };
  });

  var queryResult = [
    {formname: 'goodform', formversion: '1', uuid: 'abc'},
    {formname: 'goodform', formversion: '1', uuid: 'def'},
    {formname: 'goodform', formversion: '2', uuid: 'ghi'},
    {formname: 'greatform', formversion: '1', uuid: 'jkl'},
    {formname: 'greatform', formversion: '1', uuid: 'mno'}];

  var getTablesForDocsResult = {
    'formview_goodform_1': ['abc', 'def'],
    'formview_goodform_2': ['ghi'],
    'formview_greatform_1': ['jkl', 'mno']
  };

  describe('getTablesForDocs', function() {
    var getTablesForDocs = cleaner.__get__('getTablesForDocs');

    it('should generate a map of table to uuids', function() {
      sinon.stub(db, 'query').returns(Promise.resolve(queryResult));

      return getTablesForDocs(db, []).then(function(result) {
        result.should.deep.equal(getTablesForDocsResult);
      });
    });
  });

  describe('deleteDocsInTable', function() {
    var deleteDocsInTable = cleaner.__get__('deleteDocsInTable');

    it('transforms tableToDocs into a collection of executed DELETE statements', function() {
      var query = sinon.stub(db, 'query');
      query.returns(Promise.resolve());

      return deleteDocsInTable(db, getTablesForDocsResult).then(function() {
        query.alwaysCalledWith(match('DELETE FROM')).should.be.ok;
        query.alwaysCalledWith(match('WHERE xmlforms_uuid IN')).should.be.ok;
        query.calledWith(match('formview_goodform_1').and(match('\'abc\',\'def\''))).should.be.ok;
        query.calledWith(match('formview_goodform_2').and(match('\'ghi\''))).should.be.ok;
        query.calledWith(match('formview_greatform_1').and(match('\'jkl\',\'mno\''))).should.be.ok;
      });
    });
  });

  describe('deleteMetadata', function() {
    var deleteMetadata = cleaner.__get__('deleteMetadata');

    it('deletes metadata for the given uuids', function() {
      var query = sinon.stub(db, 'query');
      query.returns(Promise.resolve());

      return deleteMetadata(db, getTablesForDocsResult).then(function() {
        query.alwaysCalledWith(match('DELETE FROM form_metadata WHERE uuid in')).should.be.ok;
        query.calledWith(match('abc')).should.be.ok;
        query.calledWith(match('def')).should.be.ok;
        query.calledWith(match('ghi')).should.be.ok;
        query.calledWith(match('jkl')).should.be.ok;
        query.calledWith(match('mno')).should.be.ok;
      });
    });
  });
});
