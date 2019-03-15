var PouchDB = require('pouchdb-core');
PouchDB.plugin(require('pouchdb-adapter-http'));

module.exports = PouchDB;
