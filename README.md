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

## Required database setup

It is assumed PostgreSQL is in use.

### `full_access` role

A role called `full_access` must exist, and the role accessing PostgreSQL must
either be `full_access` or must have access to `SET ROLE full_access;`. Such
access can be granted using `GRANT full_access TO <role>;`.

It might be useful to add real users to the `full_access` role as well using
the same command above.

### `read_only` role

While not required for this software, it is assumed for some use cases that
there is also a `read_only` role. In such a case, `full_access` should be set
so that `read_only` is granted read access. While logged in as `full_access`,
or using `SET ROLE full_access;`, this can be done with the following:

```
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO full_access;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO read_only;
```

`full_access` should also be able to read anything `read_only` can read. While
logged in as `read_only` or using `SET ROLE read_only;`, access can be granted
with `GRANT read_only TO full_access;`.

### `no_delete` role and `static` schema

Again, while not required for this software, it is assumed for some use cases
that `no_delete` will be used to maintain datasets that should be immutable
by this adapter and the `full_access` user. This utilizes a schema called
`static`.

Create the `no_delete` role, create the `static` schema, expose the `static`
schema to other roles, and then set `no_delete` default permissions:
```
CREATE ROLE no_delete;
CREATE SCHEMA static;
SET ROLE no_delete;
ALTER DEFAULT PRIVILEGES IN SCHEMA static GRANT ALL ON TABLES TO no_delete;
ALTER DEFAULT PRIVILEGES IN SCHEMA static GRANT SELECT ON TABLES TO read_only;
RESET ROLE;
```

Here, anything created by `no_delete` is readable by `read_only` (and thus
`full_access`), meanwhile `full_access` has no write ability in the `static`
schema.

### Local PostgreSQL testing

If using a local PostgreSQL database, the integration tests can choke if
the data table already exists.

Between iterations of the integration test, the table must be dropped or
cleared.

https://github.com/medic/medic-analytics/issues/15

## Example usage

Run `node index`

## Common problems

### Cannot read property 'version'

```
[TypeError: Cannot read property 'version' of undefined]
```

This error is normal when first running the import process. It means that the
design document, which contains the version in Kanso, has not yet been imported
and so the XML Forms and Contacts code cannot determine whether or not it
should run.

If this software is in use with a system that isn't using Kanso, the error will
never go away. It might be annoying but it will not adversely affect
performance.

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
