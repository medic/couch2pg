-- NB: I'm intentionally not cascading here so that upgraders can make sure they
--     know what is going to be changed / removed by this change.
DROP TABLE form_metadata;
CREATE MATERIALIZED VIEW form_metadata AS
SELECT
  couchdb.doc->>'_id' as uuid,
  couchdb.doc#>>'{contact, _id}' as chw,
  couchdb.doc#>>'{contact, parent, _id}' as chw_area,
  couchdb.doc->>'form' as formname,
  timestamp 'epoch' + (couchdb.doc->>'reported_date')::bigint * interval '1 millisecond' as reported
FROM couchdb
WHERE couchdb.doc->>'type' = 'data_record'
AND couchdb.doc ? 'form'
AND (couchdb.doc->>'form')::text is not null;

CREATE UNIQUE INDEX form_metadata_uuid ON form_metadata (uuid);
CREATE INDEX form_metadata_chw ON form_metadata (chw);
CREATE INDEX form_metadata_reported ON form_metadata (reported);
CREATE INDEX form_metadata_formname ON form_metadata (formname);

-- TODO consider indexing patient id
