CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE records (id TEXT PRIMARY KEY, qso_date TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX records_date ON records(qso_date DESC);
