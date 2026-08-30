-- ═══════════════════════════════════════════════════════════════
-- 0025 — FONDASI FASE 0: EXPAND 9 KOLOM WAJIB PADA TABEL TRANSAKSIONAL
-- Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 16.2 & ADR-01, ADR-08
-- Pola: EXPAND -> BACKFILL (Non-Destruktif)
-- ═══════════════════════════════════════════════════════════════

-- 1. Helper Procedure untuk Menambahkan 9 Kolom Wajib secara Aman
CREATE OR REPLACE FUNCTION public.add_mandatory_columns_if_missing(p_table_name text, p_default_brand text DEFAULT 'LAB')
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name) THEN
    -- 1. tenant_id
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT %L', p_table_name, '00000000-0000-0000-0000-000000000001'::uuid);
    -- 2. brand_code
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS brand_code varchar(10) DEFAULT %L', p_table_name, p_default_brand);
    -- 3. cost_center_code
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cost_center_code varchar(20)', p_table_name);
    -- 4. kbli_code
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS kbli_code varchar(10)', p_table_name);
    -- 5. location_code
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS location_code varchar(20) DEFAULT %L', p_table_name, 'LOC-PST-01');
    -- 6. created_by
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid', p_table_name);
    -- 7. updated_by
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid', p_table_name);
    -- 8. is_deleted
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false', p_table_name);
    -- 9. version
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS version integer DEFAULT 1', p_table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Eksekusi Penambahan Kolom pada Tabel Master & Transaksional
SELECT public.add_mandatory_columns_if_missing('products', 'LAB');
SELECT public.add_mandatory_columns_if_missing('orders', 'LAB');
SELECT public.add_mandatory_columns_if_missing('samples', 'LAB');
SELECT public.add_mandatory_columns_if_missing('examinations', 'LAB');
SELECT public.add_mandatory_columns_if_missing('invoices', 'LAB');
SELECT public.add_mandatory_columns_if_missing('patients', 'HEALTH');
SELECT public.add_mandatory_columns_if_missing('corporate_packages', 'HEALTH');
SELECT public.add_mandatory_columns_if_missing('corporate_invoices', 'HEALTH');

-- 3. Backfill Nilai Standar untuk Data Eksisting
UPDATE public.products 
SET 
  tenant_id = COALESCE(tenant_id, '00000000-0000-0000-0000-000000000001'::uuid),
  brand_code = COALESCE(brand_code, 'LAB'),
  cost_center_code = COALESCE(cost_center_code, 'CC-LAB-OPS'),
  kbli_code = COALESCE(kbli_code, '86903'),
  location_code = COALESCE(location_code, 'LOC-PST-01'),
  is_deleted = COALESCE(is_deleted, false),
  version = COALESCE(version, 1)
WHERE tenant_id IS NULL OR brand_code IS NULL;
