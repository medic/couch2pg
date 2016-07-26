# medic-couch2pg ![travis](https://travis-ci.org/medic/medic-couch2pg.svg?branch=master)

Software for creating read-only replicas of CouchDB data inside PostgreSQL v9.4

The focus is on Medic Mobile data currently stored in CouchDB, but applications
might extend beyond that.

## Required Environment Variables

Environment Variables will be used for configuration. A number of variables
are required.

* `POSTGRESQL_URL`: a URL used by pg libs to connect to postgres.
  * tcp: `postgres://user:password@site:port/dbname`
  * unix domain socket: e.g. `postgres:///dbname?host=/var/run/postgresql`
  * parameters: e.g. `postgres://localhost/dbname?client_encoding=UTF8`
* `COUCHDB_URL`: a full path URL to the couchdb database, with any required credentials.
  * e.g. `https://user:pass@localhost/medic`
* `COUCH2PG_SLEEP_MINS`: number of minutes between checking for updates.

Optional variables:

* `COUCH2PG_DOC_LIMIT`: number of documents to grab concurrently. Defaults to **100**. Increasing this number will cut down on HTTP GETs and may improve performance, decreasing this number will cut down on node memory usage, and may increase stability.
* `COUCH2PG_CHANGES_LIMIT`: number of document ids to grab per change limit request. Defaults to **10,000**. Increasing this number will cut down on HTTP GETs and may improve performance, decreasing this number will cut down on node memory usage slightly, and may increase stability.
* `COUCH2PG_DEBUG`: Whether or not to have verbose logging. Defaults to **true**.
* `V0_4_MODE`: skips anything 2.6+ related. Defaults to **false**.

## Required database setup

We support PostgreSQL 9.4 and greater. The user passed in the postgres url needs to have full creation rights on the given database.

## Example usage

You should probably install medic-analytics as a service and leave it to do its thing, as it should be able to run independently without any user input.

### Installing as a service using Upstart (Ubuntu 14.4)

To setup a really simple service with upstart, all you need is sudo rights on the server. You want to do something like this:
 - For now, you should still just clone this repo onto your server, check out the relevant tag, and run `npm install`. In the future this will be better!
 - `sudo` create a `/etc/init/couch2pg-example-client.conf`
 - As we are going to put passwords in this file, you want to `chown o-r /etc/init/couch2pg-example-client.conf` so that only root can read it
 - Edit this file and put something like this in it:

```
description "Service for running Example Client's couch2pg integration"
author "Your name"
script
    export POSTGRESQL_URL="..."
    export COUCHDB_URL="..."
    exec nodejs /path/to/the/repo/index >> /var/log/couch2pg-example-client.log
end script
```
 - The service is then a standard service, e.g. `service couch2pg-example-client start`

### Running locally

If you want to run it locally: `node index`

Or more realistically with useful env vars: `POSTGRESQL_URL=postgres://manalytics:manalytics@localhost:5432/medic-analytics-0.1.0 COUCHDB_URL=http://admin:pass@localhost:5984/medic COUCH2PG_SLEEP_MINS=10 COUCH2PG_DOC_LIMIT=1000 node index.js`

## Running tests

Some environment variables that may be required for the integration tests to run correctly:
 * `INT_PG_HOST`: postgres host, defaults to `localhost`
 * `INT_PG_PORT`: postgres port, defaults to `5432` 
 * `INT_PG_USER`: postgres user, defaults to none (system default). This user must be able to create databases on the given host.
 * `INT_PG_PASS`: user's password, defaults to none (system default)
 * `INT_PG_DB`: test databse to use, defaults to `medic-analytics-test`
 * `INT_COUCHDB_URL`: url to test couchdb, defaults to `http://admin:pass@localhost:5894/medic-analytics-test`. The user must have the ability to destory and create databases on that host.

You may be able to get away with not setting any of these, or only needing to set some of these depending on your development environment.

NB: the integration tests destroy and re-create the given databases each time they are run. Use test databases.
