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
* `COUCH2PG_DEBUG`: set this to anything to get more output.

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
