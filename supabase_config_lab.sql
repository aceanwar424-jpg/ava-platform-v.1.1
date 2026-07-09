-- ══════════════════════════════════════════════════════════════
-- OneLab — Configuration & Lab Schema
-- Jalankan di Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── PRODUCTS (Master Tes/Layanan) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id                  bigint generated always as identity primary key,
  -- Kode-kode
  kode_internal       text unique,           -- OL-001
  kode_material       text,                  -- MAT-2234 (untuk reagen/inventory)
  loinc_code          text,                  -- 2345-7
  -- Info tes
  nama_tes            text not null,
  nama_singkat        text,
  kategori            text,                  -- Hematologi, Kimia Klinik, dll
  sub_kategori        text,
  -- Harga
  harga_normal        numeric default 0,
  harga_korporat      numeric default 0,
  hpp                 numeric default 0,
  margin_pct          numeric default 0,
  -- Teknis lab
  sampel_type         text,                  -- Darah vena, urin, swab, dll
  volume_sampel       text,                  -- 3 mL, 5 mL
  satuan_hasil        text,                  -- mg/dL, IU/L, %
  metode              text,                  -- Enzymatic, Turbidimetri
  alat_id             bigint,                -- FK ke analyzers
  alat_nama           text,
  waktu_tat_jam       integer default 4,     -- Turnaround time
  -- Reporting
  unit_reporting      text,
  is_active           boolean default true,
  is_panel            boolean default false, -- bagian dari panel/paket
  keterangan          text,
  created_by          text,
  created_at          timestamp default now(),
  updated_at          timestamp default now()
);

-- ── REFERENCE RANGES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ref_ranges (
  id              bigint generated always as identity primary key,
  product_id      bigint references public.products(id) on delete cascade,
  product_name    text,
  -- Kondisi pasien
  gender          text default 'All',     -- All, M, F
  age_min         integer default 0,      -- tahun
  age_max         integer default 999,    -- tahun
  condition_name  text,                   -- 'Normal', 'Prediabetik', 'Diabetes', 'Hamil', dll
  condition_type  text default 'normal',  -- normal, risk, critical
  -- Range values
  range_min       numeric,
  range_max       numeric,
  unit            text,
  -- Critical values
  critical_low    numeric,
  critical_high   numeric,
  -- Interpretasi
  interpretation  text,                   -- Normal, Tinggi, Rendah, Prediabetik, dll
  color_code      text default 'green',   -- green, yellow, orange, red
  description     text,                   -- Penjelasan kondisi ini
  recommendation  text,                   -- Saran tindak lanjut
  created_at      timestamp default now()
);

-- ── ANALYZERS (Alat Lab) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analyzers (
  id                  bigint generated always as identity primary key,
  kode_alat           text unique,
  nama_alat           text not null,
  merk                text,
  model               text,
  serial_number       text,
  kategori            text,               -- Hematology, Chemistry, Immunology, dll
  lokasi              text,               -- Lab Utama, Lab Satelit
  kapasitas_per_jam   integer default 0,
  status              text default 'Aktif', -- Aktif, Maintenance, Rusak
  kalibrasi_terakhir  date,
  kalibrasi_berikutnya date,
  integrasi_aktif     boolean default false, -- HL7/ASTM terintegrasi
  integrasi_protocol  text,               -- HL7, ASTM, POCT
  notes               text,
  created_at          timestamp default now(),
  updated_at          timestamp default now()
);

-- ── PACKAGES (Paket Layanan) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.packages (
  id              bigint generated always as identity primary key,
  kode_paket      text unique,
  nama_paket      text not null,
  kategori_paket  text,                   -- MCU Basic, Executive, Screening, dll
  target_segment  text,                   -- Umum, Korporat, Wanita, Pria, Lansia
  harga_normal    numeric default 0,
  harga_korporat  numeric default 0,
  hpp_total       numeric default 0,
  deskripsi       text,
  persiapan       text,                   -- Instruksi persiapan pasien (puasa, dll)
  tat_jam         integer default 4,
  is_active       boolean default true,
  keterangan      text,
  created_by      text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── PACKAGE ITEMS (Tes dalam Paket) ──────────────────────
CREATE TABLE IF NOT EXISTS public.package_items (
  id          bigint generated always as identity primary key,
  package_id  bigint references public.packages(id) on delete cascade,
  product_id  bigint references public.products(id),
  product_name text,
  qty         integer default 1,
  is_optional boolean default false,
  notes       text
);

-- ── CORPORATES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.corporates (
  id              bigint generated always as identity primary key,
  kode_corp       text unique,
  corporate_name  text not null,
  industry        text,
  pic_name        text,
  pic_phone       text,
  pic_email       text,
  address         text,
  partner_id      bigint references public.partners(id),  -- link ke partner DB
  -- Billing
  billing_type    text default 'Invoice',  -- Invoice, Prepaid, Credit
  payment_terms   integer default 30,      -- hari
  credit_limit    numeric default 0,
  -- Discount
  discount_type   text default 'none',     -- none, percent, fixed
  discount_value  numeric default 0,
  -- Status
  status          text default 'Aktif',
  notes           text,
  created_by      text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── CORPORATE CONTRACTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.corporate_contracts (
  id              bigint generated always as identity primary key,
  corporate_id    bigint references public.corporates(id) on delete cascade,
  corporate_name  text,
  contract_number text,
  contract_type   text,                    -- MCU Tahunan, Per Event, On-demand
  start_date      date,
  end_date        date,
  max_peserta     integer default 0,
  used_peserta    integer default 0,
  nilai_kontrak   numeric default 0,
  packages        text,                    -- JSON array package_ids
  custom_prices   text,                    -- JSON override harga per tes
  status          text default 'Active',   -- Draft, Active, Expired, Terminated
  file_url        text,
  file_name       text,
  notes           text,
  created_by      text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── HEALTH FACILITIES (Rujukan) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.health_facilities (
  id                  bigint generated always as identity primary key,
  facility_name       text not null,
  facility_type       text,               -- RS, Klinik, Dokter Praktik, Apotek
  pic_name            text,
  phone               text,
  email               text,
  address             text,
  partner_id          bigint references public.partners(id),
  -- Referral fee
  referral_fee_type   text default 'percent', -- percent, fixed
  referral_fee_value  numeric default 0,
  -- Rujukan keluar
  is_rujukan_keluar   boolean default false,
  -- Contract
  contract_start      date,
  contract_end        date,
  is_active           boolean default true,
  notes               text,
  created_at          timestamp default now(),
  updated_at          timestamp default now()
);

-- ── ADMISSIONS (Registrasi Pasien) ───────────────────────
CREATE TABLE IF NOT EXISTS public.admissions (
  id                bigint generated always as identity primary key,
  visit_number      text unique,           -- VISIT-20260613-001
  -- Pasien
  patient_name      text not null,
  patient_dob       date,
  patient_age       integer,
  patient_gender    text,                  -- M, F
  patient_phone     text,
  patient_address   text,
  patient_id_type   text default 'KTP',
  patient_id_number text,
  -- Kunjungan
  visit_date        date default current_date,
  visit_time        time,
  visit_type        text default 'Walk-in', -- Walk-in, Booking, Rujukan, Project
  -- Referensi
  project_id        bigint references public.projects(id),
  corporate_id      bigint references public.corporates(id),
  facility_id       bigint references public.health_facilities(id),
  doctor_referral   text,
  -- Layanan dipesan
  package_id        bigint references public.packages(id),
  package_name      text,
  services          text,                  -- JSON array product_ids yang dipesan
  -- Status
  status            text default 'Registered', -- Registered, Anamnesa, Lab, Done, Cancelled
  -- Billing
  total_amount      numeric default 0,
  discount_amount   numeric default 0,
  net_amount        numeric default 0,
  payment_status    text default 'Unpaid', -- Unpaid, DP, Paid, Billed (korporat)
  -- Staff
  registered_by     text,
  created_at        timestamp default now(),
  updated_at        timestamp default now()
);

-- ── ANAMNESA ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anamnesas (
  id              bigint generated always as identity primary key,
  admission_id    bigint references public.admissions(id) on delete cascade,
  visit_number    text,
  patient_name    text,
  -- TTV
  systole         integer,
  diastole        integer,
  heart_rate      integer,
  respiratory     integer,
  temperature     numeric,
  spo2            integer,
  weight          numeric,
  height          numeric,
  bmi             numeric,
  -- Keluhan
  chief_complaint text,
  history         text,
  allergies       text,
  current_meds    text,
  -- Riwayat
  family_history  text,
  social_history  text,
  -- Persiapan puasa
  fasting_hours   integer,
  last_meal       text,
  -- Staff
  nurse_name      text,
  doctor_name     text,
  notes           text,
  created_at      timestamp default now()
);

-- ── LAB SAMPLES (Check In Sampel) ───────────────────────
CREATE TABLE IF NOT EXISTS public.lab_samples (
  id              bigint generated always as identity primary key,
  barcode         text unique,             -- Barcode sampel
  admission_id    bigint references public.admissions(id),
  visit_number    text,
  patient_name    text,
  product_id      bigint references public.products(id),
  product_name    text,
  sampel_type     text,                    -- Darah, Urin, Swab, dll
  -- Collection
  collected_at    timestamp,
  collected_by    text,
  volume_ml       numeric,
  -- Processing
  analyzer_id     bigint references public.analyzers(id),
  analyzer_name   text,
  received_at     timestamp,
  -- Status
  status          text default 'Pending',  -- Pending, In Process, Done, Rejected
  rejection_reason text,
  notes           text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── LAB RESULTS (Enter Result) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_results (
  id              bigint generated always as identity primary key,
  admission_id    bigint references public.admissions(id),
  sample_id       bigint references public.lab_samples(id),
  visit_number    text,
  patient_name    text,
  product_id      bigint references public.products(id),
  product_name    text,
  -- Hasil
  result_value    text,                    -- bisa numeric atau text (pos/neg)
  result_numeric  numeric,
  unit            text,
  -- Ref range applied
  ref_range_id    bigint references public.ref_ranges(id),
  normal_min      numeric,
  normal_max      numeric,
  interpretation  text,                    -- Normal, Tinggi, Rendah, Kritis
  color_code      text default 'green',
  condition_name  text,                    -- Prediabetik, Diabetes, dll
  -- Source
  is_auto         boolean default false,   -- true = dari analyzer otomatis
  analyzer_id     bigint,
  -- Status
  status          text default 'Draft',    -- Draft, Validated, Approved, Released
  -- Staff
  entered_by      text,
  entered_at      timestamp,
  validated_by    text,
  validated_at    timestamp,
  approved_by     text,
  approved_at     timestamp,
  notes           text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── MEDICAL RECORDS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_records (
  id              bigint generated always as identity primary key,
  patient_name    text not null,
  patient_dob     date,
  patient_gender  text,
  patient_phone   text,
  patient_id_number text,
  -- Link kunjungan
  admissions      text,                    -- JSON array admission_ids
  total_visits    integer default 0,
  last_visit      date,
  -- Summary kondisi
  chronic_conditions text,                 -- DM, HT, dll
  allergies       text,
  blood_type      text,
  notes           text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── CASHIER TRANSACTIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cashier_transactions (
  id              bigint generated always as identity primary key,
  transaction_number text unique,
  admission_id    bigint references public.admissions(id),
  visit_number    text,
  patient_name    text,
  corporate_id    bigint references public.corporates(id),
  -- Amount
  subtotal        numeric default 0,
  discount_amount numeric default 0,
  tax_amount      numeric default 0,
  total_amount    numeric default 0,
  paid_amount     numeric default 0,
  change_amount   numeric default 0,
  -- Payment
  payment_method  text,                    -- Cash, Debit, Credit, Transfer, BPJS, Corporate
  payment_ref     text,
  -- Type
  transaction_type text default 'Payment', -- Payment, Refund, Cancellation, Corporate Bill
  status          text default 'Completed',
  -- Staff
  cashier_name    text,
  notes           text,
  created_at      timestamp default now()
);

-- ── DISABLE RLS ──────────────────────────────────────────
ALTER TABLE public.products              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_ranges            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyzers             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_items         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporates            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_contracts   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_facilities     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissions            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesas             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_samples           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_transactions  DISABLE ROW LEVEL SECURITY;

-- ── INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_kategori     ON public.products(kategori);
CREATE INDEX IF NOT EXISTS idx_products_kode         ON public.products(kode_internal);
CREATE INDEX IF NOT EXISTS idx_ref_ranges_product    ON public.ref_ranges(product_id);
CREATE INDEX IF NOT EXISTS idx_pkg_items_package     ON public.package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_admissions_date       ON public.admissions(visit_date);
CREATE INDEX IF NOT EXISTS idx_admissions_patient    ON public.admissions(patient_name);
CREATE INDEX IF NOT EXISTS idx_admissions_project    ON public.admissions(project_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_admission ON public.lab_results(admission_id);
CREATE INDEX IF NOT EXISTS idx_lab_samples_barcode   ON public.lab_samples(barcode);
CREATE INDEX IF NOT EXISTS idx_cashier_admission     ON public.cashier_transactions(admission_id);

-- ── SAMPLE DATA: Product Categories & Ref Ranges ─────────
-- Insert beberapa contoh tes untuk testing
INSERT INTO public.products (kode_internal, kode_material, loinc_code, nama_tes, kategori, sub_kategori,
  harga_normal, harga_korporat, hpp, sampel_type, volume_sampel, satuan_hasil, metode, waktu_tat_jam, is_active)
VALUES
  ('OL-CHE-001','MAT-001','2345-7','Gula Darah Puasa (GDP)','Kimia Klinik','Metabolisme',
   75000,60000,15000,'Darah Vena','2 mL','mg/dL','Enzymatic GOD-POD',2,true),
  ('OL-CHE-002','MAT-002','4548-4','HbA1c','Kimia Klinik','Metabolisme',
   150000,120000,35000,'Darah Vena','2 mL','%','HPLC',4,true),
  ('OL-CHE-003','MAT-003','2093-3','Kolesterol Total','Kimia Klinik','Lipid',
   75000,60000,12000,'Darah Vena','2 mL','mg/dL','Enzymatic CHOD-POD',2,true),
  ('OL-CHE-004','MAT-004','14959-1','HDL Kolesterol','Kimia Klinik','Lipid',
   85000,70000,18000,'Darah Vena','2 mL','mg/dL','Direct Enzymatic',2,true),
  ('OL-CHE-005','MAT-005','13457-7','LDL Kolesterol','Kimia Klinik','Lipid',
   85000,70000,18000,'Darah Vena','2 mL','mg/dL','Direct Enzymatic',2,true),
  ('OL-CHE-006','MAT-006','3043-7','Trigliserida','Kimia Klinik','Lipid',
   85000,70000,15000,'Darah Vena','2 mL','mg/dL','Enzymatic GPO-POD',2,true),
  ('OL-HEM-001','MAT-007','58410-2','Darah Lengkap (CBC)','Hematologi','Darah Rutin',
   100000,80000,20000,'Darah EDTA','3 mL','—','Hematology Analyzer',2,true),
  ('OL-CHE-007','MAT-008','1742-6','SGOT (AST)','Kimia Klinik','Fungsi Hati',
   85000,70000,18000,'Darah Vena','2 mL','U/L','UV-IFCC',2,true),
  ('OL-CHE-008','MAT-009','1743-4','SGPT (ALT)','Kimia Klinik','Fungsi Hati',
   85000,70000,18000,'Darah Vena','2 mL','U/L','UV-IFCC',2,true),
  ('OL-CHE-009','MAT-010','3094-0','Ureum','Kimia Klinik','Fungsi Ginjal',
   75000,60000,12000,'Darah Vena','2 mL','mg/dL','Enzymatic',2,true),
  ('OL-CHE-010','MAT-011','2160-0','Kreatinin','Kimia Klinik','Fungsi Ginjal',
   75000,60000,12000,'Darah Vena','2 mL','mg/dL','Jaffe',2,true),
  ('OL-CHE-011','MAT-012','3084-1','Asam Urat','Kimia Klinik','Metabolisme',
   75000,60000,12000,'Darah Vena','2 mL','mg/dL','Enzymatic Uricase',2,true),
  ('OL-URN-001','MAT-013','24356-8','Urinalisa Lengkap','Urinalisa','Urin Rutin',
   65000,52000,10000,'Urin Midstream','10 mL','—','Dipstick + Sedimen',2,true),
  ('OL-FOB-001','MAT-014','12503-6','FOB (Fecal Occult Blood)','Imunologi','Kanker',
   250000,200000,75000,'Feses','—','—','Immunochromatography',3,true),
  ('OL-IMG-001','MAT-015',NULL,'Rontgen Thorax','Radiologi','X-Ray',
   200000,160000,50000,'—','—','Normal/Abnormal','Digital X-Ray',1,true),
  ('OL-FIS-001','MAT-016',NULL,'EKG 12 Lead','Fisiologi','Kardiovaskular',
   150000,120000,30000,'—','—','Interpretasi','Digital ECG',1,true),
  ('OL-FIS-002','MAT-017',NULL,'Spirometri','Fisiologi','Paru',
   175000,140000,40000,'—','—','FVC/FEV1','Spirometer',1,true)
ON CONFLICT (kode_internal) DO NOTHING;

-- Reference Ranges untuk GDP
INSERT INTO public.ref_ranges (product_id, product_name, gender, age_min, age_max, 
  condition_name, condition_type, range_min, range_max, unit, 
  critical_low, critical_high, interpretation, color_code, description, recommendation)
SELECT p.id, p.nama_tes, 'All', 0, 999, 
  'Normal', 'normal', 70, 99, 'mg/dL', 
  40, 500, 'Normal', 'green', 'Gula darah puasa dalam rentang normal', 'Pertahankan pola hidup sehat'
FROM public.products p WHERE p.kode_internal = 'OL-CHE-001'
ON CONFLICT DO NOTHING;

INSERT INTO public.ref_ranges (product_id, product_name, gender, age_min, age_max,
  condition_name, condition_type, range_min, range_max, unit,
  interpretation, color_code, description, recommendation)
SELECT p.id, p.nama_tes, 'All', 0, 999,
  'Prediabetik', 'risk', 100, 125, 'mg/dL',
  'Prediabetik', 'yellow', 'Gula darah puasa menunjukkan risiko diabetes', 
  'Konsultasi dokter, ubah pola makan dan olahraga rutin'
FROM public.products p WHERE p.kode_internal = 'OL-CHE-001'
ON CONFLICT DO NOTHING;

INSERT INTO public.ref_ranges (product_id, product_name, gender, age_min, age_max,
  condition_name, condition_type, range_min, range_max, unit,
  interpretation, color_code, description, recommendation)
SELECT p.id, p.nama_tes, 'All', 0, 999,
  'Diabetes', 'critical', 126, 9999, 'mg/dL',
  'Diabetes Mellitus', 'red', 'Gula darah puasa ≥126 mg/dL menunjukkan Diabetes Mellitus',
  'Segera konsultasi dokter spesialis penyakit dalam'
FROM public.products p WHERE p.kode_internal = 'OL-CHE-001'
ON CONFLICT DO NOTHING;

-- Sample package
INSERT INTO public.packages (kode_paket, nama_paket, kategori_paket, target_segment,
  harga_normal, harga_korporat, hpp_total, deskripsi, persiapan, tat_jam, is_active)
VALUES
  ('PKG-MCU-BASIC','MCU Basic','MCU Basic','Umum',
   750000,600000,200000,
   'Paket MCU dasar: Darah Lengkap, GDP, Kolesterol, Urinalisa, Rontgen Thorax, EKG',
   'Puasa 8-10 jam sebelum pemeriksaan. Bawa air minum. Gunakan pakaian yang mudah dibuka.',
   4, true),
  ('PKG-MCU-EXEC','MCU Executive','MCU Executive','Korporat',
   1500000,1200000,400000,
   'MCU lengkap: CBC, GDP, HbA1c, Lipid Panel, LFT, RFT, Asam Urat, Urinalisa, Rontgen, EKG',
   'Puasa 10-12 jam. Hindari olahraga berat 24 jam sebelumnya.',
   6, true),
  ('PKG-DIABETES','Paket Diabetes','Screening','Umum',
   350000,280000,90000,
   'GDP, HbA1c, Urinalisa, Kolesterol Total — skrining komprehensif diabetes',
   'Puasa 8-10 jam sebelum pemeriksaan.',
   3, true),
  ('PKG-GUT','Gut Health','Gut Health','Umum',
   500000,400000,150000,
   'FOB + Konsultasi Nutrisi — deteksi dini masalah pencernaan dan risiko kanker kolorektal',
   'Tidak perlu puasa. Hindari konsumsi daging merah 3 hari sebelumnya.',
   3, true)
ON CONFLICT (kode_paket) DO NOTHING;

-- ── VERIFY ───────────────────────────────────────────────
SELECT table_name, 
  (SELECT COUNT(*) FROM information_schema.columns c 
   WHERE c.table_name=t.table_name AND c.table_schema='public') cols
FROM information_schema.tables t
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;

-- ── CORPORATE EMPLOYEES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.corporate_employees (
  id             bigint generated always as identity primary key,
  corporate_id   bigint references public.corporates(id) on delete cascade,
  corporate_name text,
  full_name      text not null,
  employee_id    text,                    -- NIK / ID karyawan
  department     text,
  gender         text,                    -- M, F
  birth_date     date,
  phone          text,
  email          text,
  status         text default 'Non-Aktif', -- Non-Aktif (terdaftar), Aktif (booking)
  package_id     bigint references public.packages(id),
  package_name   text,
  notes          text,
  created_at     timestamp default now(),
  updated_at     timestamp default now()
);

ALTER TABLE public.corporate_employees DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_corp_emp_corp    ON public.corporate_employees(corporate_id);
CREATE INDEX IF NOT EXISTS idx_corp_emp_status  ON public.corporate_employees(status);

-- ── UPDATE RAB ITEMS (add qty_actual, total_actual) ──────────
ALTER TABLE public.rab_items
  ADD COLUMN IF NOT EXISTS qty_actual   numeric default 0,
  ADD COLUMN IF NOT EXISTS total_actual numeric default 0,
  ADD COLUMN IF NOT EXISTS notes        text;      -- stores source|scheme

-- ── UPDATE PROJECTS (add rab_actual, corporate_id) ───────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rab_actual   numeric default 0,
  ADD COLUMN IF NOT EXISTS corporate_id bigint references public.corporates(id);

SELECT 'corporate_employees + RAB updates done' as status;
