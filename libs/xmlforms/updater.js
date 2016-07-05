var log = require('loglevel');

module.exports = function(db) {
  return {
    update: function() {
      log.info('Refreshing materialised views');

      return db.one('SELECT refresh_matviews()')
      .then(function(result) {
        log.debug(result);
      });
    }
  };
};
