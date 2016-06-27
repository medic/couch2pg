var rsvp = require('rsvp'),
    postgrator = require('postgrator'),
    log = require('loglevel');

module.exports = function(postgresUrl) {
  return function() {
    return new rsvp.Promise(function (resolve, reject) {
      postgrator.setConfig({
        migrationDirectory: __dirname + '/migrations',
        schemaTable: 'xmlforms_migrations',
        driver: 'pg',
        logProgress: log.getLevel() <= log.levels.DEBUG,
        connectionString: postgresUrl
      });

      postgrator.migrate('201606201000', function(err, migrations) {
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
