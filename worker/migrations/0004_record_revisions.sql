ALTER TABLE records ADD COLUMN revision TEXT NOT NULL DEFAULT '';
UPDATE records SET revision = lower(hex(randomblob(16)));

-- Prefer a standard date already present in a third-party ADIF import.
UPDATE records
SET data = json_remove(json_set(data, '$.QSLSDATE', coalesce(json_extract(data, '$.QSLSDATE'), json_extract(data, '$.QSL_SENT_DATE'))), '$.QSL_SENT_DATE')
WHERE json_type(data, '$.QSL_SENT_DATE') IS NOT NULL;
UPDATE records
SET data = json_remove(json_set(data, '$.QSLRDATE', coalesce(json_extract(data, '$.QSLRDATE'), json_extract(data, '$.QSL_RCVD_DATE'))), '$.QSL_RCVD_DATE')
WHERE json_type(data, '$.QSL_RCVD_DATE') IS NOT NULL;

CREATE INDEX records_chronological ON records(qso_date DESC, coalesce(json_extract(data, '$.TIME_ON'), '') DESC, id);
DROP INDEX records_date;
