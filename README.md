# medic-analytics
Software for creating read-only replicas of CouchDB data inside PostgreSQL v9.4

The focus is on Medic Mobile data currently stored in CouchDB, but applications
might extend beyond that.

## Required Environment Variables

Environment Variables will be used for confiuration. A number of variables
are required.

* `POSTGRESQL_URL`: a URL used by pg libs to connect to postgres.
  * tcp: `postgres://user:password@site:port/dbname`
  * unix domain socket: e.g. `postgres:///dbname?host=/var/run/postgresql`
  * parameters: e.g. `postgres://localhost/dbname?client_encoding=UTF8`
* `POSTGRESQL_TABLE`: name of table for storing CouchDB data.
* `POSTGRESQL_COLUMN`: name of the `jsonb` column in `POSTGRESQL_TABLE` for
  storing CouchDB data.
* `COUCHDB_URL`: a full path URL to `_all_docs`, including `user:pass@`, the
  database name, and `_all_docs`.
  * e.g. `https://user:pass@localhost/medic/_all_docs`
* `COUCH2PG_SLEEP_MINS`: number of minutes between checking for updates.

Optional variables:

* `COUCH2PG_DOC_LIMIT`: maximum number of full documents to request and download from couch during any particular iterative run. this is useful to avoid out of memory errors. Must be balanced properly with `COUCH2PG_SLEEP_MINS` to keep up with new data but not overload.

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

### Process

1. form reports
  1. Make sure there's a place for metadata storage
  1. Fetch contents of reports in Couch table which don't already have metadata in the system.
  1. Parse common features from reports.
  1. Create `formview_` tables to store each version of each form if they are missing.
  1. Write form report meta data.
  1. Write form reports out to the correct `formview_` tables.

#### Missing steps:

* Before everything else
  * determine if initialization has been performed
  * if not, create metadata table and a bunch of other initial steps
  * currently, metadata storage is created if not exists, but can't do that
    with all the queries (like indexes) and might be inefficient with enough
    such queries
* After everything else
  * All materialized views are refreshed.
  * Function is written in missing.sql.
    * function needs to be added as part of initialization
    * function needs to be run with `SELECT refresh_matviews();` as last step
