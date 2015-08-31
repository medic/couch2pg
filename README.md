# medic-analytics
Software for creating read-only replicas of Medic Mobile data, using PostgreSQL v9.4

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
* `COUCHDB_URL`: a full path URL to `_all_doc`, including `user:pass@` and `include_docs=true`.
  * e.g. `http://user:pass@localhost/medic/_all_docs?include_docs=true`

## Current Process

1. Ensure Postgres has jsonb ready and clears the contents.
1. All records are taken in from CouchDB using `_all_docs` and `include_docs=true` (as part of `COUCHDB_URL`).
1. Each record is iterated into distinct JSON objects.
1. Each JSON object is added to Postgres as jsonb.

## Future Process

1. Ensure Postgres has jsonb ready.
1. All records are taken in from CouchDB using `_all_docs` and `include_docs=true` (as part of `COUCHDB_URL`).
1. Fetched records are compared against existing records in Postgres.
1. Missing records are iterated into distinct JSON objects.
1. Each JSON object is added to Postgres as jsonb.
1. All materialized views are refreshed.
