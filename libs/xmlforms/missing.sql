-- filter contact docs into one place
CREATE VIEW raw_contacts AS SELECT * FROM lg WHERE data->>'type' IN ('clinic', 'district_hospital', 'health_center', 'person');

-- extract JSON data from contact docs and cache it
CREATE MATERIALIZED VIEW contactview_metadata AS
SELECT data->>'_id' AS uuid, data->>'name' AS name, data->>'type' AS type, data#>>'{contact,_id}' AS contact_uuid, data#>>'{parent,_id}' AS parent_uuid, data->>'notes' AS notes,
TIMESTAMP WITH TIME ZONE 'epoch' + (data->>'reported_date')::numeric / 1000 * interval '1 second' AS reported
FROM raw_contacts ;
CREATE INDEX contactview_metadata_uuid ON contactview_metadata (uuid);
CREATE INDEX contactview_metadata_contact_uuid ON contactview_metadata (contact_uuid);
CREATE INDEX contactview_metadata_parent_uuid ON contactview_metadata (parent_uuid);
CREATE INDEX contactview_metadata_type ON contactview_metadata (type);

-- make a view for district hospitals
-- does not need to be materialized since it is a metadata passthrough.
CREATE VIEW contactview_hospital AS
SELECT cmd.uuid, cmd.name
FROM contactview_metadata AS cmd
WHERE cmd.type = 'district_hospital';

-- extract JSON data from contacts relating to person type contacts
-- this should not be used directly, but used by materialized views,
-- thus no reason to materialize it.
CREATE VIEW contactview_person_fields AS 
SELECT
data->>'_id' AS uuid, data->>'phone' AS phone,
data->>'alternative_phone' AS phone2, data->>'date_of_birth' AS date_of_birth,
data#>>'{parent,type}' AS parent_type
FROM raw_contacts
WHERE data->>'type' = 'person';

-- make a view for CHWs
CREATE MATERIALIZED VIEW contactview_chw AS
SELECT chw.name, pplfields.*, chwarea.uuid AS area_uuid,
chwarea.parent_uuid AS branch_uuid
FROM contactview_person_fields AS pplfields
INNER JOIN contactview_metadata AS chw ON (chw.uuid = pplfields.uuid)
INNER JOIN contactview_metadata AS chwarea ON (chw.parent_uuid = chwarea.uuid)
WHERE pplfields.parent_type = 'health_center';
CREATE INDEX contactview_chw_uuid ON contactview_chw (uuid);

-- make a view for clinics and cache it
CREATE MATERIALIZED VIEW contactview_clinic AS
SELECT cmd.uuid, cmd.name, chp.uuid AS chp_uuid, cmd.reported AS created
FROM contactview_metadata AS cmd
INNER JOIN contactview_chp AS chp ON (cmd.parent_uuid = chp.area_uuid)
WHERE type = 'clinic';
CREATE INDEX contactview_clinic_uuid ON contactview_clinic (uuid);

-- make a view for clinic contacts and cache it
CREATE MATERIALIZED VIEW contactview_clinic_person AS
SELECT person.name, pplfields.*, person.parent_uuid AS family_uuid
FROM contactview_person_fields AS pplfields
INNER JOIN contactview_metadata AS person ON (person.uuid = pplfields.uuid)
WHERE person.uuid IN (SELECT contact_uuid FROM contactview_metadata WHERE type = 'clinic');
CREATE INDEX contactview_clinic_person_uuid ON contactview_clinic_person (uuid);

-- a function to refresh all materialized views
CREATE FUNCTION refresh_matviews() RETURNS INTEGER AS $$
DECLARE
  matview RECORD;
BEGIN
  RAISE NOTICE 'Refreshing base metaviews';
  -- other matviews rely on contactview_metadata, which is a matview
  -- so load this first
  REFRESH MATERIALIZED VIEW contactview_metadata;
  FOR matview IN SELECT matviewname FROM pg_catalog.pg_matviews LOOP
    IF matview.matviewname = 'contactview_metadata' THEN
      -- this one is already done, skip it.
      CONTINUE;
    END IF;
    RAISE NOTICE 'Refreshing %', matview.matviewname;
    EXECUTE format('REFRESH MATERIALIZED VIEW %I', matview.matviewname);
  END LOOP;
  RAISE NOTICE 'Materialized views refreshed.';
  RETURN 1;
END;
$$ LANGUAGE plpgsql;
