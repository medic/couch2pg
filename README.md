# medic-analytics
Software for creating read-only replicas of Medic Mobile data, using PostgreSQL v9.4

## Required Environment Variables

Environment Variables will be used for confiuration. A number of variables
are required.

* `POSTGRESQL_URL`: a URL used by pg libs to connect to postgres.
  * tcp: 'postgres://user:password@site:port/dbname'
  * unix domain socket: e.g. 'postgres:///dbname?host=/var/run/postgresql'
  * parameters: e.g. 'postgres://localhost/dbname?client_encoding=UTF8'
* `POSTGRESQL_TABLE`: name of table for storing CouchDB data.
* `POSTGRESQL_COLUMN`: name of the `jsonb` column in `POSTGRESQL_TABLE` for
  storing CouchDB data.
* `COUCHDB_URL`: a full path URL to `_all_doc`, including `user:pass@`

## Process

1. Records are taken in full or in part from CouchDB using `_all_docs`.
1. Each record is iterated by this code into distinct JSON objects.
1. Each JSON object is added to a jsonb column in a particular PostgreSQL table.
1. Update any and all materialized views

### In full or in part

#### Initial load

If there are no records in Postgres or if the software runs remotely to CouchDB,
then all records in CouchDB should be retrieved using `_all_docs` in full
content by including `include_docs=true`. In the remote situation, the contents
should ideally be compressed before transmission.

#### Optimized step

Fetch `_all_docs` including docs (compress if needed). Compile each uuid/rev
as a tuple and combine them into a tuple of tuples. Ask Postgres which
uuid/rev tuples are already present, then iterate all docs not present into a
single `INSERT` or `COPY`.

* Single CouchDB call
* One-Two Postgres calls

#### Unoptimized step

Blow away the full contents of the Postgres table and repeat initial load step.

* Single CouchDB call
* Single Postgres call
