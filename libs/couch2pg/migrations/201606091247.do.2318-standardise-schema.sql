-- get everyone to baseline what existed before we added migrations
CREATE TABLE IF NOT EXISTS couchdb (doc jsonb);

-- IF NOT EXISTS doesn't exist (!) in Postgres 9.4, so do this silliness instead
DO $$
BEGIN

IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'couchdb_doc_uuid') THEN
    CREATE INDEX couchdb_doc_uuid ON couchdb ( (doc->>'_id') );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'couchdb_doc_type') THEN
    CREATE INDEX couchdb_doc_type ON couchdb ( (doc->>'type') );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'couchdb_doc_attachments') THEN
    CREATE INDEX couchdb_doc_attachments ON couchdb USING GIN ( (doc->'_attachments') );
END IF;

END$$;

