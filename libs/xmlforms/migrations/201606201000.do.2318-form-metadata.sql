DO $$
BEGIN

IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'form_metadata') THEN
  CREATE TABLE form_metadata (
    uuid TEXT, chw TEXT, chw_area TEXT,
    formname TEXT, formversion TEXT, reported TIMESTAMP);

  CREATE INDEX form_metadata_uuid ON form_metadata (uuid);
  CREATE INDEX form_metadata_chw ON form_metadata (chw);
  CREATE INDEX form_metadata_reported ON form_metadata (reported);
  CREATE INDEX form_metadata_formname ON form_metadata (formname);
  CREATE INDEX form_metadata_formversion ON form_metadata (formname, formversion);
END IF;

END$$;
