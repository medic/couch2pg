var chai = require('chai'),
    chaiAsPromised = require('chai-as-promised');

chai.config.includeStack = true;
chai.use(chaiAsPromised);

exports.expect = chai.expect;
