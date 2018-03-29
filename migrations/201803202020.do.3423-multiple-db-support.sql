delete from couchdb_progress where seq = '0';
alter table couchdb_progress add column source_id varchar not null;
CREATE UNIQUE INDEX couchdb_progress_source_id ON couchdb_progress ( source_id );
