var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.config.includeStack = true;
chai.use(chaiAsPromised);

exports.expect = chai.expect;
var common = require('../../libs/couch2pg/common');
exports.Promise = common.Promise;
exports.handleError = common.handleError;
exports.handleReject = common.handleReject;
