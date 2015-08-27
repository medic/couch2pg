var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.config.includeStack = true;
chai.use(chaiAsPromised);

exports.expect = chai.expect;
exports.Promise = require('../common').Promise;
exports.handleError = require('../common').handleError;
