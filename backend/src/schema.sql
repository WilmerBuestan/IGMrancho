CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
  id             UUID PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,
  service_date   DATE NOT NULL,
  full_name      TEXT NOT NULL,
  cedula         TEXT NOT NULL,
  email          TEXT NOT NULL,
  desayuno       INT  NOT NULL DEFAULT 0 CHECK (desayuno >= 0),
  almuerzo       INT  NOT NULL DEFAULT 0 CHECK (almuerzo >= 0),
  merienda       INT  NOT NULL DEFAULT 0 CHECK (merienda >= 0),
  total_cents    INT  NOT NULL,
  receipt_path   TEXT NOT NULL,
  receipt_mime   TEXT NOT NULL,
  -- pendiente | aprobada | rechazada
  status         TEXT NOT NULL DEFAULT 'pendiente',
  admin_note     TEXT,
  -- pending | uploaded | failed | disabled
  drive_status   TEXT NOT NULL DEFAULT 'pending',
  drive_attempts INT  NOT NULL DEFAULT 0,
  drive_file_id  TEXT,
  drive_link     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservations_date_idx   ON reservations (service_date);
CREATE INDEX IF NOT EXISTS reservations_cedula_idx ON reservations (cedula);
CREATE INDEX IF NOT EXISTS reservations_drive_idx  ON reservations (drive_status);
