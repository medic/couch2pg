var Promise = require('rsvp').Promise;

exports.contactsNeeded = function(db, pgsql) {
  return db.query(pgsql.checkForContacts())
  .then(function (results) {
    // expect a single return beacuse LIMIT 1
    var result = results[0];
    if ((result.version === '0.6' || result.version === '2.6') &&
        (result.matviewname === null)) {
      // if 0.6 or 2.6, then we're using contacts.
      // if there are no materialized views, then contacts haven't been made.
      return true;
    } else {
      // pretty much any other situation means we don't need to make contacts.
      return false;
    }
  });
};

exports.addContacts = function(db, pgsql, needed) {
  if (needed) {
    return db.query(pgsql.initializeContacts());
  } else {
    // NOOP
    return new Promise(function (resolve) {
      return resolve();
    });
  }
};
