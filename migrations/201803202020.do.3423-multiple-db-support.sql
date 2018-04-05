-- Remove sequence record from previous migration
-- (INSERT INTO couchdb_progress VALUES (0);)
-- only applies to a new db where seq = 0
delete from couchdb_progress where seq = '0';

-- Add sorce_id column to identify the couchdb source for this sequence
alter table couchdb_progress add column source_id varchar not null;

-- Existing deployments will have to update source_id with the
-- couch db url that was previously replicated.
-- So, a new migration for an existing deployment:
--  $ couch2pg "http://user:pass@localhost:5984/db1" "postgres://pg1"
-- would need to update source_id to be "http://user:pass@localhost:5984/db1"
-- This is required to continue replication based on the last sequence.
update couchdb_progress set source_id='update-me' where source_id is null;
CREATE UNIQUE INDEX couchdb_progress_source_id ON couchdb_progress ( source_id );
