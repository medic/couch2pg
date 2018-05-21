-- Remove sequence record from previous migration
-- (INSERT INTO couchdb_progress VALUES (0);)
-- only applies to a new db where seq = 0
DELETE FROM couchdb_progress WHERE seq = '0';

-- Add source column to identify the couchdb source for this sequence
ALTER TABLE couchdb_progress add column source VARCHAR;

-- Add default source to existing sequence
UPDATE couchdb_progress SET source='default-source' WHERE source IS NULL;
-- Don't allow null sources
ALTER TABLE couchdb_progress ALTER COLUMN source SET NOT NULL;
-- Create source index
CREATE UNIQUE INDEX couchdb_progress_source ON couchdb_progress ( source );
