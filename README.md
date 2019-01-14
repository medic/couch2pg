# couch2pg [![Build Status](https://travis-ci.org/medic/couch2pg.svg?branch=master)](https://travis-ci.org/medic/couch2pg/branches)

Library and cli for one-way replicating CouchDB databases to PostgreSQL 9.4+.

## Required database setup

couch2pg supports PostgreSQL 9.4 and greater. The user passed in the postgres url needs to have full creation rights on the given database.

## Example cli usage

```
npm install -g couch2pg`
couch2pg --help
```

## Example library usage

```
npm install --save couch2pg
```

```js
var PG_URL = 'postgres://localhost:5432/db-name',
    COUCHDB_URL = 'http://localhost:5984/db-name';

var couchdb = require('pouchdb')(COUCHDB_URL),
    db = require('pg-promise')()(PG_URL);

var couch2pg = require('couch2pg'),
    migrator = couch2pg.migrator(PG_URL),
    importer = couch2pg.importer(db, couchdb);

return migrator()
    .then(importer.importAll);
```

`migrator` ensures that the named DB is ready to use, `importAll` imports all docs from CouchDB into the postgres. If it's been run before against this DB it will pick up from where it left off last time.

## Running tests

Enjoy your tests with: `grunt test`.

Some environment variables that may be required for the integration tests to run correctly:
 * `INT_PG_HOST`: postgres host, defaults to `localhost`
 * `INT_PG_PORT`: postgres port, defaults to `5432` 
 * `INT_PG_USER`: postgres user, defaults to none (system default). This user must be able to create databases on the given host.
 * `INT_PG_PASS`: user's password, defaults to none (system default)
 * `INT_PG_DB`: test databse to use, defaults to `medic-analytics-test`
 * `INT_COUCHDB_URL`: url to test couchdb, defaults to `http://admin:pass@localhost:5894/medic-analytics-test`. The user must have the ability to destory and create databases on that host.

You may be able to get away with not setting any of these, or only needing to set some of these depending on your development environment.

NB: the integration tests destroy and re-create the given databases each time they are run. Use test databases.
