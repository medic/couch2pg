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
  * e.g. `https://user:pass@localhost/medic/_all_docs?include_docs=true`

## Example usage

Run `node`, then:

```
var couch2pg = require('couch2pg')
couch2pg().then(function () {console.log('done!');}).catch(function (e) {console.log(e);});
```

## Process

1. Ensure Postgres has jsonb storage location ready.
1. All record UUIDs are taken in from CouchDB using GET `_all_docs` and `include_docs=false`
1. Fetched UUIDs are compared against existing records in Postgres.
1. Missing docs are taken in from CouchDB using POST `_all_docs` and `include_docs=true`.
1. Fetched docs are iterated into distinct JSON objects.
1. Each JSON object is added to Postgres as jsonb.

### Missing steps:

1. All materialized views are refreshed.

No materialized views yet exist.
