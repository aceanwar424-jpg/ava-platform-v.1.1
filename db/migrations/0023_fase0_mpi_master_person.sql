-- ═══════════════════════════════════════════════════════════════
-- 0023 — FONDASI FASE 0: MASTER PERSON INDEX (MPI) TUNGGAL & CONSENT
-- Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 16.4 & ADR-03
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabel Identitas Orang Tunggal (MPI Person)
-- Hanya data identitas demografi netral, tanpa catatan klinis / rekam medis
CREATE TABLE IF NOT EXISTS public.mpi_person (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  ava_id          varchar(20) UNIQUE NOT NULL DEFAULT public.generate_ava_id(),
  full_name       varchar(200) NOT NULL,
  birth_date      date,
  birth_place     varchar(100),
  sex             varchar(10) CHECK (sex IN ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN')),
  blood_type      varchar(5),
  status          varchar(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, MERGED, DECEASED, INACTIVE
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz,
  updated_by      uuid,
  is_deleted      boolean NOT NULL DEFAULT false,
  version         integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_mpi_person_name_dob ON public.mpi_person (full_name, birth_date);
CREATE INDEX IF NOT EXISTS idx_mpi_person_ava_id ON public.mpi_person (ava_id);

-- 2. Tabel Pengenal Orang (NIK, BPJS, Paspor, Rekam Medis Lokal, Pegawai)
CREATE TABLE IF NOT EXISTS public.person_identifier (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  person_id       uuid NOT NULL REFERENCES public.mpi_person(id) ON DELETE CASCADE,
  type            varchar(20) NOT NULL, -- NIK, BPJS, PASSPORT, MRN, EMPLOYEE_NO
  value           varchar(100) NOT NULL,
  is_verified     boolean NOT NULL DEFAULT false,
  verified_at     timestamptz,
  verified_source varchar(50), -- DUKCAPIL, BPJS_BRIDGING, MANUAL_KTP
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_person_id_type_val UNIQUE (tenant_id, type, value)
);

CREATE INDEX IF NOT EXISTS idx_person_id_val ON public.person_identifier (type, value);

-- 3. Tabel Kontak Orang (Telepon, Email, Alamat)
CREATE TABLE IF NOT EXISTS public.person_contact (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  person_id       uuid NOT NULL REFERENCES public.mpi_person(id) ON DELETE CASCADE,
  type            varchar(20) NOT NULL, -- PHONE, EMAIL, ADDRESS
  value           text NOT NULL,
  is_primary      boolean NOT NULL DEFAULT false,
  is_verified     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 4. Tabel Manajemen Persetujuan Data Pribadi (Consent UU PDP No. 27/2022)
-- Persetujuan terpisah per jenis (tidak boleh digabung dalam satu checkbox)
CREATE TABLE IF NOT EXISTS public.person_consent (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  person_id       uuid NOT NULL REFERENCES public.mpi_person(id) ON DELETE CASCADE,
  consent_type    varchar(50) NOT NULL, -- GENERAL_TREATMENT, DATA_PROCESSING, MARKETING, RESEARCH, PHOTO_USE
  scope           varchar(100) NOT NULL DEFAULT 'ALL_BRANDS',
  granted_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  evidence_url    text,
  granted_via     varchar(50) NOT NULL DEFAULT 'DIGITAL_SIGNATURE',
  CONSTRAINT uq_person_consent UNIQUE (tenant_id, person_id, consent_type)
);

-- 5. Tabel Relasi Orang ke Brand Ekosistem (person_brand_link)
CREATE TABLE IF NOT EXISTS public.person_brand_link (
  id                  uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id           uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  person_id           uuid NOT NULL REFERENCES public.mpi_person(id) ON DELETE CASCADE,
  brand_code          varchar(10) NOT NULL REFERENCES public.brands(code),
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_activity_at    timestamptz NOT NULL DEFAULT now(),
  local_ref           varchar(100),
  CONSTRAINT uq_person_brand_link UNIQUE (tenant_id, person_id, brand_code)
);

-- 6. Tabel Log Penggabungan Pasien Duplikat (person_merge_log)
-- Penggabungan dapat dibatalkan (unmergeable) berkat snapshot JSONB
CREATE TABLE IF NOT EXISTS public.person_merge_log (
  id                  uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id           uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  surviving_person_id uuid NOT NULL REFERENCES public.mpi_person(id),
  merged_person_id    uuid NOT NULL REFERENCES public.mpi_person(id),
  reason              text NOT NULL,
  performed_by        uuid,
  performed_at        timestamptz NOT NULL DEFAULT now(),
  snapshot            jsonb NOT NULL, -- Menyimpan data sebelum digabung
  is_unmerged         boolean NOT NULL DEFAULT false,
  unmerged_at         timestamptz,
  unmerged_by         uuid
);

-- 7. Backfill Otomatis Data Pasien Legacy ke MPI (Non-Destruktif)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients') THEN
    INSERT INTO public.mpi_person (tenant_id, full_name, birth_date, sex, created_at)
    SELECT 
      COALESCE(tenant_id, '00000000-0000-0000-0000-000000000001'::uuid),
      nama_lengkap,
      tanggal_lahir,
      CASE WHEN jenis_kelamin IN ('L', 'Laki-laki', 'MALE') THEN 'MALE'
           WHEN jenis_kelamin IN ('P', 'Perempuan', 'FEMALE') THEN 'FEMALE'
           ELSE 'UNKNOWN' END,
      COALESCE(created_at, now())
    FROM public.patients
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
