var expect = require('../common').expect;
var libcommon = require('../../libs/common');

describe('Libs Common', function() {

  describe('scrub()', function() {
    it('prefixes full_access role before statements', function() {
      return expect(libcommon.scrub('hi there')).to.equal('SET ROLE full_access;hi there');
    });

    it('still properly formats data', function() {
      return expect(libcommon.scrub('hi %L there %I', 'fr-end', 'per-on')).to.equal('SET ROLE full_access;hi \'fr-end\' there "per-on"');
    });
  });


});
