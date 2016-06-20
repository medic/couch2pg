-- filter contact docs into one place
CREATE OR REPLACE VIEW raw_contacts AS SELECT * FROM couchdb WHERE doc->>'type' IN ('clinic', 'district_hospital', 'health_center', 'person');

-- extract JSON data from contact docs and cache it
DROP MATERIALIZED VIEW IF EXISTS contactview_metadata CASCADE;
CREATE MATERIALIZED VIEW contactview_metadata AS
SELECT doc->>'_id' AS uuid, doc->>'name' AS name, doc->>'type' AS type, doc#>>'{contact,_id}' AS contact_uuid, doc#>>'{parent,_id}' AS parent_uuid, doc->>'notes' AS notes,
TIMESTAMP WITH TIME ZONE 'epoch' + (doc->>'reported_date')::numeric / 1000 * interval '1 second' AS reported
FROM raw_contacts;

DO $$
BEGIN

IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'contactview_metadata_uuid') THEN
    CREATE UNIQUE INDEX contactview_metadata_uuid ON contactview_metadata (uuid);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'contactview_metadata_contact_uuid') THEN
    CREATE INDEX contactview_metadata_contact_uuid ON contactview_metadata (contact_uuid);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'contactview_metadata_parent_uuid') THEN
    CREATE INDEX contactview_metadata_parent_uuid ON contactview_metadata (parent_uuid);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'contactview_metadata_type') THEN
    CREATE INDEX contactview_metadata_type ON contactview_metadata (type);
END IF;

END$$;

-- make a view for district hospitals
-- does not need to be materialized since it is a metadata passthrough.
CREATE OR REPLACE VIEW contactview_hospital AS
SELECT cmd.uuid, cmd.name
FROM contactview_metadata AS cmd
WHERE cmd.type = 'district_hospital';

-- extract JSON data from contacts relating to person type contacts
-- this should not be used directly, but used by materialized views,
-- thus no reason to materialize it.
CREATE OR REPLACE VIEW contactview_person_fields AS
SELECT
doc->>'_id' AS uuid, doc->>'phone' AS phone,
doc->>'alternative_phone' AS phone2, doc->>'date_of_birth' AS date_of_birth,
doc#>>'{parent,type}' AS parent_type
FROM raw_contacts
WHERE doc->>'type' = 'person';

-- make a view for CHWs
CREATE OR REPLACE VIEW contactview_chw AS
SELECT chw.name, pplfields.*, chwarea.uuid AS area_uuid,
chwarea.parent_uuid AS branch_uuid
FROM contactview_person_fields AS pplfields
INNER JOIN contactview_metadata AS chw ON (chw.uuid = pplfields.uuid)
INNER JOIN contactview_metadata AS chwarea ON (chw.parent_uuid = chwarea.uuid)
WHERE pplfields.parent_type = 'health_center';

-- make a view for clinics
CREATE OR REPLACE VIEW contactview_clinic AS
SELECT cmd.uuid, cmd.name, chw.uuid AS chw_uuid, cmd.reported AS created
FROM contactview_metadata AS cmd
INNER JOIN contactview_chw AS chw ON (cmd.parent_uuid = chw.area_uuid)
WHERE type = 'clinic';

-- make a view for clinic contacts
CREATE OR REPLACE VIEW contactview_clinic_person AS
SELECT
  raw_contacts.doc ->> '_id' AS uuid,
  raw_contacts.doc ->> 'name' AS name, raw_contacts.doc ->> 'type' AS type,
  raw_contacts.doc #>> '{parent,_id}' AS family_uuid,
  raw_contacts.doc ->> 'phone' AS phone,
  raw_contacts.doc ->> 'alternative_phone' AS phone2,
  raw_contacts.doc ->> 'date_of_birth' AS date_of_birth,
  raw_contacts.doc #>> '{parent,type}' AS parent_type
FROM raw_contacts
WHERE
(raw_contacts.doc ->> 'type') = 'person' AND
(raw_contacts.doc ->> '_id') IN (SELECT contact_uuid FROM contactview_metadata WHERE type = 'clinic');

-- a function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_matviews() RETURNS INTEGER AS $$
DECLARE
  matview RECORD;
BEGIN
  RAISE NOTICE 'Refreshing base metaviews';
  -- other matviews rely on contactview_metadata, which is a matview
  -- so load this first
  REFRESH MATERIALIZED VIEW CONCURRENTLY contactview_metadata;
  FOR matview IN SELECT matviewname FROM pg_catalog.pg_matviews LOOP
    IF matview.matviewname = 'contactview_metadata' THEN
      -- this one is already done, skip it.
      CONTINUE;
    END IF;
    RAISE NOTICE 'Refreshing %', matview.matviewname;
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', matview.matviewname);
  END LOOP;
  RAISE NOTICE 'Materialized views refreshed.';
  RETURN 1;
END;
$$ LANGUAGE plpgsql;
