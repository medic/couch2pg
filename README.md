# medic-analytics ![travis](https://travis-ci.org/medic/medic-analytics.svg?branch=master)

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

* `COUCH2PG_DOC_LIMIT`: number of documents to grab concurrently. Defaults to 100. Increasing this number will cut down on HTTP GETs and may improve performance, decreasing this number will cut down on node memory usage, and may increase stability.
* `COUCH2PG_DEBUG`: returns more debug output from the xmlforms module.

## Required database setup

We support PostgreSQL 9.4 and greater. The user passed in the postgres url needs to have full creation rights on the given database.

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

## Example usage

Run `node index`

## couch2pg

Moves couch data into postgres.

### Example usage

Run `node libs/couch2pg/mainloop`.

### Process

1. Ensure Postgres has jsonb storage location ready.
1. All record UUIDs are taken in from CouchDB using GET `_all_docs` and `include_docs=false`
1. Fetched UUIDs are compared against existing records in Postgres.
1. Missing docs are taken in from CouchDB using POST `_all_docs` and `include_docs=true`.
1. Fetched docs are iterated into distinct JSON objects.
1. Each JSON object is added to Postgres as jsonb.

## xmlforms

Create table representations of OpenRosa/XForms data in PostgreSQL.

### Example usage

Run `node libs/xmlforms/main`.

### Process

1. contacts
  1. Make sure version is either 0.6 or 2.6.
  1. Determine if contacts have been generated.
  1. If version .6 and contacts missing, create contacts framework.
1. form reports
  1. Make sure there's a place for metadata storage (and index it)
  1. Fetch contents of reports in Couch table which don't already have metadata in the system.
  1. Parse common features from reports.
  1. Create `formview_` tables to store each version of each form if they are missing.
  1. Write form report meta data.
  1. Write form reports out to the correct `formview_` tables.
1. materialized views
  1. refresh them!
