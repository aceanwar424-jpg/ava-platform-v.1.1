-- ═══════════════════════════════════════════════════════════════
-- 0021 — FONDASI FASE 0: KONVENSI IDENTITAS & PENOMORAN TERPUSAT
-- Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 15 & Bab 16
-- ═══════════════════════════════════════════════════════════════

-- 1. Generator UUID v7 (Timestamp-ordered UUID)
CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid AS $$
DECLARE
  v_time_ms bigint;
  v_unix_t_hex text;
  v_rand_hex text;
  v_uuid_str text;
BEGIN
  -- Ambil waktu unix epoch dalam milidetik
  v_time_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_unix_t_hex := lpad(to_hex(v_time_ms), 12, '0');
  
  -- Bangun random hex 74-bit
  v_rand_hex := encode(gen_random_bytes(10), 'hex');
  
  -- Rakit format UUID v7: time_high(8)-time_mid(4)-'7'time_low(3)-'8..b'rand(3)-rand(12)
  v_uuid_str := substr(v_unix_t_hex, 1, 8) || '-' ||
                substr(v_unix_t_hex, 9, 4) || '-' ||
                '7' || substr(v_rand_hex, 1, 3) || '-' ||
                substr('89ab', (get_byte(gen_random_bytes(1), 0) % 4) + 1, 1) || substr(v_rand_hex, 4, 3) || '-' ||
                substr(v_rand_hex, 7, 12);
                
  RETURN v_uuid_str::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Generator AVA-ID (10 Digit Crockford Base32: AVA-XXXXXXXXXX)
CREATE OR REPLACE FUNCTION public.generate_ava_id()
RETURNS text AS $$
DECLARE
  chars text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; -- Crockford 32 (tanpa I, L, O, U)
  result text := 'AVA-';
  i integer;
  rand_bytes bytea;
  b integer;
BEGIN
  rand_bytes := gen_random_bytes(10);
  FOR i IN 0..9 LOOP
    b := get_byte(rand_bytes, i);
    result := result || substr(chars, (b % 32) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 3. Tabel Registri Penomoran Dokumen Terpusat (Bab 15.2)
CREATE TABLE IF NOT EXISTS public.sys_number_registry (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  brand_code      varchar(10) NOT NULL,
  doc_type        varchar(30) NOT NULL, -- INVOICE, SPK, MOU, LAB_ORDER, ACC_NO, SURAT_KELUAR
  period_year     integer NOT NULL,
  period_month    integer NOT NULL,
  last_number     bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sys_number UNIQUE (tenant_id, brand_code, doc_type, period_year, period_month)
);

-- 4. Tabel Nomor Dokumen yang Dibatalkan (VOID Registry)
CREATE TABLE IF NOT EXISTS public.sys_number_void (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  brand_code      varchar(10) NOT NULL,
  doc_type        varchar(30) NOT NULL,
  doc_number      text NOT NULL,
  void_reason     text NOT NULL,
  void_by         uuid,
  void_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_void_number UNIQUE (tenant_id, doc_number)
);

-- 5. Stored Procedure Penerbitan Nomor dengan Row-Locking (Atomic)
CREATE OR REPLACE FUNCTION public.issue_document_number(
  p_tenant_id   uuid,
  p_brand_code  text,
  p_doc_type    text,
  p_year        integer DEFAULT extract(year from now())::integer,
  p_month       integer DEFAULT extract(month from now())::integer
)
RETURNS text AS $$
DECLARE
  v_next_num bigint;
  v_month_romawi text;
  v_result text;
BEGIN
  -- Mapping bulan ke angka romawi
  v_month_romawi := CASE p_month
    WHEN 1 THEN 'I' WHEN 2 THEN 'II' WHEN 3 THEN 'III' WHEN 4 THEN 'IV'
    WHEN 5 THEN 'V' WHEN 6 THEN 'VI' WHEN 7 THEN 'VII' WHEN 8 THEN 'VIII'
    WHEN 9 THEN 'IX' WHEN 10 THEN 'X' WHEN 11 THEN 'XI' WHEN 12 THEN 'XII'
    ELSE 'I'
  END;

  -- Atomic increment dengan row lock
  INSERT INTO public.sys_number_registry (tenant_id, brand_code, doc_type, period_year, period_month, last_number, updated_at)
  VALUES (p_tenant_id, upper(p_brand_code), upper(p_doc_type), p_year, p_month, 1, now())
  ON CONFLICT (tenant_id, brand_code, doc_type, period_year, period_month)
  DO UPDATE SET last_number = sys_number_registry.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_next_num;

  -- Format nomor resmi: AVA/{BRAND}/{JENIS}/{BULAN_ROMAWI}/{YYYY}/{URUT_5_DIGIT}
  IF upper(p_doc_type) = 'INVOICE' THEN
    v_result := 'INV/' || upper(p_brand_code) || '/' || p_year::text || lpad(p_month::text, 2, '0') || '/' || lpad(v_next_num::text, 5, '0');
  ELSIF upper(p_doc_type) = 'LAB_ORDER' THEN
    v_result := 'L' || to_char(now(), 'YYMMDD') || '-' || lpad(v_next_num::text, 5, '0');
  ELSE
    v_result := 'AVA/' || upper(p_brand_code) || '/' || upper(p_doc_type) || '/' || v_month_romawi || '/' || p_year::text || '/' || lpad(v_next_num::text, 5, '0');
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE;
