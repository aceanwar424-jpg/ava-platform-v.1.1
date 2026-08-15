-- 0002 — Tabel AVA Health (wellness & layanan ke rumah)
-- Menopang menu Telekonsultasi, Sewa & Beli Alkes, Perangkat & Wearables,
-- dan Caregiver di Portal Customer.
--
-- Sebelumnya DDL ini hanya berjalan pada inisialisasi pertama, sehingga basis
-- data yang dibuat lebih dulu tidak pernah menerimanya — gejalanya menyamar
-- sebagai "belum ada data". Sekarang ikut jalur migrasi.

CREATE TABLE IF NOT EXISTS public.ava_consultations (
  id              SERIAL PRIMARY KEY,
  patient_name    TEXT,
  doctor_name     TEXT,
  complaint       TEXT,
  triage_level    TEXT DEFAULT 'normal',   -- normal | priority | urgent
  status          TEXT DEFAULT 'pending',
  e_prescription  TEXT,
  lab_referral    TEXT,
  doctor_fee      NUMERIC DEFAULT 150000,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ava_device_readings (
  id             SERIAL PRIMARY KEY,
  patient_id     TEXT,
  device_name    TEXT,
  device_type    TEXT,
  reading_value  TEXT,
  unit           TEXT,
  alert_status   TEXT DEFAULT 'normal',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ava_calibration_badges (
  id            SERIAL PRIMARY KEY,
  device_name   TEXT,
  lab_name      TEXT,
  cert_number   TEXT UNIQUE,
  expiry_date   DATE,
  badge_status  TEXT DEFAULT 'verified',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ava_marketplace_items (
  id            SERIAL PRIMARY KEY,
  title         TEXT,
  vendor_name   TEXT,
  price         NUMERIC,
  type          TEXT DEFAULT 'sewa',       -- sewa | beli
  badge_status  TEXT DEFAULT 'verified',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ava_caregiver_links (
  id                SERIAL PRIMARY KEY,
  patient_id        TEXT,
  caregiver_name    TEXT,
  relation          TEXT,
  permission_scope  TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daftar sering diurutkan menurun berdasarkan waktu.
CREATE INDEX IF NOT EXISTS idx_ava_consultations_created  ON public.ava_consultations  (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ava_device_readings_created ON public.ava_device_readings (created_at DESC);
