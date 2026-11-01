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

-- Celulares con la app instalada (tokens de Firebase Cloud Messaging)
CREATE TABLE IF NOT EXISTS devices (
  token      TEXT PRIMARY KEY,
  -- client | admin
  role       TEXT NOT NULL,
  cedula     TEXT,
  email      TEXT,
  reminders  BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devices_person_idx ON devices (cedula, email);

-- Reservas creadas/editadas por el admin: el comprobante es opcional (pago en efectivo, etc.)
ALTER TABLE reservations ALTER COLUMN receipt_path DROP NOT NULL;
ALTER TABLE reservations ALTER COLUMN receipt_mime DROP NOT NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'cliente';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Historial de cambios hechos por el admin (también guarda las reservas eliminadas)
CREATE TABLE IF NOT EXISTS reservation_history (
  id             BIGSERIAL PRIMARY KEY,
  reservation_id UUID NOT NULL,
  code           TEXT NOT NULL,
  -- creada | editada | estado | comprobante | eliminada
  action         TEXT NOT NULL,
  detail         JSONB NOT NULL DEFAULT '{}',
  at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reservation_history_res_idx ON reservation_history (reservation_id);
