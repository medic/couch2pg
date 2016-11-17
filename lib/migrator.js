var rsvp = require('rsvp'),
    postgrator = require('postgrator'),
    log = require('loglevel');

module.exports = function(postgresUrl) {
  return function() {
    return new rsvp.Promise(function (resolve, reject) {
      postgrator.setConfig({
      migrationDirectory: __dirname + '/../migrations',
        schemaTable: 'couch2pg_migrations',
        driver: 'pg',
        logProgress: log.getLevel() <= log.levels.DEBUG,
        connectionString: postgresUrl
      });

      postgrator.migrate('201611271809', function(err, migrations) {
        if (err) {
          reject(err);
        } else {
          postgrator.endConnection(function() {
            resolve(migrations);
          });
        }
      });
    });
  };
};
