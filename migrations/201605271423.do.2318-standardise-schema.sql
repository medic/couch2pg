-- get everyone to baseline what existed before we added migrations
CREATE TABLE IF NOT EXISTS couchdb (doc jsonb);
CREATE INDEX IF NOT EXISTS couchdb_doc_uuid ON couchdb ( (%I->>'_id') );
CREATE INDEX IF NOT EXISTS couchdb_doc_type ON couchdb ( (%I->>'type') );
CREATE INDEX IF NOT EXISTS couchdb_doc_attachments ON couchdb USING GIN ( (%I->'_attachments') );
