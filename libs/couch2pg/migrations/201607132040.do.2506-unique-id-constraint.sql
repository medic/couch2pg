DROP INDEX couchdb_doc_uuid;
CREATE UNIQUE INDEX couchdb_doc_uuid ON couchdb ( (doc->>'_id') );
