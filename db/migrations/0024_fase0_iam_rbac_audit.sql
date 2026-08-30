-- ═══════════════════════════════════════════════════════════════
-- 0024 — FONDASI FASE 0: IAM, 18 PERAN BAKU & AUDIT TRAIL HASH CHAIN
-- Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 16.5 & Bab 19
-- ═══════════════════════════════════════════════════════════════

-- ── CATATAN TABRAKAN NAMA TABEL (ditemukan 30 Agustus 2026) ──────────────
--
-- Migrasi ini semula membuat public.roles dengan kolom code/name/brand_scope.
-- Nama itu SUDAH DIPAKAI oleh 0003_rbac.sql dengan bentuk yang sama sekali
-- berbeda (kode/label/keterangan), dan bentuk itulah yang sedang menegakkan
-- izin di sistem berjalan — lihat role_permissions.role_kode dan
-- peranPunyaIzin() di desktop-app/electron/local-engine.js.
--
-- Akibatnya CREATE TABLE IF NOT EXISTS di sini menjadi no-op dan INSERT-nya
-- gagal: column "code" of relation "roles" does not exist. Karena runner
-- migrasi berhenti pada kegagalan, 0025-0028 ikut tidak pernah terpasang.
--
-- Keputusan: katalog 18 peran baku blueprint diberi tabel sendiri
-- (rbac_roles / rbac_user_roles). RBAC yang berjalan TIDAK disentuh —
-- menimpanya berarti mengganti mesin izin yang sedang menjaga data pasien
-- dalam satu langkah migrasi, tanpa uji dan tanpa jalan mundur.
--
-- Penyatuan keduanya adalah pekerjaan tersendiri yang harus diputuskan
-- sadar, bukan efek samping dari memasang fondasi Fase 0.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Tabel Peran Baku Blueprint (18 Roles)
CREATE TABLE IF NOT EXISTS public.rbac_roles (
  code            varchar(50) PRIMARY KEY,
  name            varchar(100) NOT NULL,
  brand_scope     varchar(20) NOT NULL DEFAULT 'ALL', -- ALL, LAB, HEALTH, CARE, NUTRI, SANCT, TECH, HQ
  is_clinical     boolean NOT NULL DEFAULT false,     -- True jika berhak akses data K4
  description     text,
  is_system       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed 18 Peran Baku Blueprint Bab 19.2
INSERT INTO public.rbac_roles (code, name, brand_scope, is_clinical, description)
VALUES
  ('SUPERADMIN',         'Super Administrator Platform',    'ALL',    false, 'Konfigurasi teknis & master platform. Tidak memiliki akses langsung ke rekam medis.'),
  ('HQ_EXECUTIVE',       'Executive Director & Holding HQ', 'ALL',    false, 'Akses cockpit eksekutif, P&L agregat, dan metrik lintas brand.'),
  ('BRAND_MANAGER',      'Brand Business Unit Manager',     'ALL',    false, 'Operasional penuh pada unit brand yang ditugaskan.'),
  ('LEGAL_COMPLIANCE',   'Legal & Compliance Officer',      'ALL',    false, 'Manajemen KBLI, izin faskes, kalender kepatuhan, dan MoU/PKS.'),
  ('FINANCE_STAFF',      'Finance & Billing Staff',         'ALL',    false, 'Manajemen AR, AP, invoice, dan pembukuan.'),
  ('HR_ADMIN',           'Human Resources Administrator',   'ALL',    false, 'Manajemen pegawai, shift, dan payroll.'),
  ('REGISTRATION',       'Front Office & Admisi',           'ALL',    false, 'Pendaftaran pasien, pembuatan order, dan pencetakan antrean/label.'),
  ('LAB_ANALYST',        'Analis Laboratorium',             'LAB',    true,  'Check-in sampel, input hasil, dan verifikasi teknis analitik.'),
  ('LAB_SUPERVISOR',     'Penyelia Laboratorium',           'LAB',    true,  'Otorisasi QC, manajemen reagen, penolakan spesimen, dan eskalasi teknis.'),
  ('DOCTOR_SPPK',        'Dokter Spesialis Patologi Klinik','LAB',    true,  'Validasi medis, persetujuan addendum, dan rilis hasil LIS.'),
  ('DOCTOR_CLINICIAN',   'Dokter Poliklinik & Telehealth',  'HEALTH', true,  'Asuhan EMR SOAP, order resep/lab, dan validasi MCU.'),
  ('NURSE',              'Perawat & Bidan Faskes',          'HEALTH', true,  'Pemeriksaan vital sign, tindakan medis, dan triase.'),
  ('FIELD_NAKES',        'Nakes Lapangan & Home Care',      'CARE',   true,  'Pelayanan kunjungan rumah dan sampling darah home service.'),
  ('CASHIER',            'Kasir Pembayaran POS',            'ALL',    false, 'Transaksi pembayaran kasir, split bill, dan penutupan shift.'),
  ('SALES_CORPORATE',    'Corporate Sales & Account Exec',  'HEALTH', false, 'Penawaran paket MCU dan manajemen proyek korporat (tanpa akses hasil individual).'),
  ('QUALITY_MANAGER',    'Manajer Mutu & Akreditasi',       'ALL',    false, 'Audit ISO 15189, manajemen CAPA, dokumen mutu, dan risiko.'),
  ('TECH_ENGINEER',      'Software & Integration Engineer', 'TECH',   false, 'Pemeliharaan sistem dan integrasi alat (akses produksi via break-glass).'),
  ('AUDITOR_READONLY',   'Auditor Eksternal / Asesor',      'ALL',    false, 'Hak baca jejak audit, sertifikat, dan SOP untuk keperluan akreditasi.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  brand_scope = EXCLUDED.brand_scope,
  is_clinical = EXCLUDED.is_clinical,
  description = EXCLUDED.description;

-- 2. Tabel Mapping Peran Pengguna (User Roles)
CREATE TABLE IF NOT EXISTS public.rbac_user_roles (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  user_id         uuid NOT NULL,
  role_code       varchar(50) NOT NULL REFERENCES public.rbac_roles(code),
  brand_code      varchar(10) REFERENCES public.brands(code),
  location_code   varchar(20) REFERENCES public.locations(code),
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_until     timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);

CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_user_role ON public.rbac_user_roles (user_id, role_code);

-- 3. Tabel Jejak Audit Terenkripsi & Hash-Chain (sys_audit_log)
-- Append-only: Dilarang keras UPDATE dan DELETE
CREATE TABLE IF NOT EXISTS public.sys_audit_log (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  occurred_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_user_id   uuid,
  actor_username  varchar(100),
  actor_role      varchar(50),
  brand_code      varchar(10),
  entity_table    varchar(100) NOT NULL,
  entity_id       varchar(100) NOT NULL,
  action          varchar(20) NOT NULL, -- INSERT, UPDATE, DELETE, VIEW_K4, BREAK_GLASS, EXPORT
  before_data     jsonb,
  after_data      jsonb,
  ip_address      varchar(50),
  user_agent      text,
  reason          text,
  prev_hash       varchar(64),
  curr_hash       varchar(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sys_audit_entity ON public.sys_audit_log (entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_time ON public.sys_audit_log (occurred_at);

-- 4. Trigger Proteksi Imutabilitas Audit Trail (Mencegah UPDATE / DELETE)
CREATE OR REPLACE FUNCTION public.protect_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'IMUTABILITAS AUDIT DILANGGAR: sys_audit_log dilarang keras diubah atau dihapus!';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_audit_log ON public.sys_audit_log;
CREATE TRIGGER trg_protect_audit_log
BEFORE UPDATE OR DELETE ON public.sys_audit_log
FOR EACH ROW EXECUTE FUNCTION public.protect_audit_log();
