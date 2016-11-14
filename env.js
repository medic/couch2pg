var log = require('loglevel'),
    program = require('commander');

module.exports = function() {
  var couchdbUrl, postgresqlUrl;

  program
    .version(require('./package.json').version)
    .arguments('<source> <target>')
    .option('--doc-limit [value]', 'number of docs to batch')
    .option('--changes-limit [value]', 'number of changes to batch')
    .option('-d, --daemon', 'continually replicate between CouchDB and PostgresSQL')
    .option('-v, --verbose', 'verbose logging')
    .action(function(source, target) {
      couchdbUrl = source;
      postgresqlUrl = target;
    });

  program.on('--help', function() {
    console.log('  <source> should be a valid CouchDB URL');
    console.log('  <target> should be a valid PostgreSQL URL');
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ couch2pg "http://admin:pass@localhost:5984/db" "postgres://user:pass@localhost:5432/db"');
  });

  program.parse(process.argv);

  if (!couchdbUrl || !postgresqlUrl) {
    program.help();
  }

  if (program.verbose) {
    log.setDefaultLevel('debug');
  } else {
    log.setDefaultLevel('info');
  }

  return {
    couchdbUrl: couchdbUrl,
    postgresqlUrl: postgresqlUrl,
    couch2pgDocLimit: program['doc-limit'],
    couch2pgChangesLimit: program['changes-limit'],
    continuous: program.daemon,
    sleepMs: 10 * 60 * 60 * 1000
  };
};
