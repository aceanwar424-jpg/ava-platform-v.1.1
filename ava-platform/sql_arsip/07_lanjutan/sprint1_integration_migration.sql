-- ============================================================
-- MIGRATION: Sprint 1 AVA GLOBAL Ecosystem Integration
-- Tanggal: 2026-08-28
-- Jalankan di: Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom tracking redemption ke vouchers
ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS used_at      timestamp,
  ADD COLUMN IF NOT EXISTS used_by_name text,
  ADD COLUMN IF NOT EXISTS used_txn_ref text,
  ADD COLUMN IF NOT EXISTS expires_at   timestamp;

-- 2. Backfill expires_at dari valid_until kampanye
UPDATE public.vouchers v
SET expires_at = c.valid_until
FROM public.voucher_campaigns c
WHERE v.campaign_id = c.id
  AND v.expires_at IS NULL
  AND c.valid_until IS NOT NULL;

-- 3. Tambahkan event keys baru ke gl_mappings
INSERT INTO public.gl_mappings (event_key, debit_code, credit_code, description)
SELECT v.event_key, v.debit_code, v.credit_code, v.description
FROM (VALUES
  ('cashier.qris',  '1-1200','4-1100','Penerimaan kasir QRIS'),
  ('cashier.ovo',   '1-1200','4-1100','Penerimaan kasir OVO'),
  ('cashier.gopay', '1-1200','4-1100','Penerimaan kasir GoPay'),
  ('cashier.dana',  '1-1200','4-1100','Penerimaan kasir DANA'),
  ('cashier.va',    '1-1200','4-1100','Penerimaan kasir Virtual Account'),
  ('cashier.bpjs',  '1-1310','4-1100','Klaim BPJS (piutang ke penjamin)'),
  ('cashier.corp',  '1-1310','4-1100','Tagihan korporat (piutang)')
) AS v(event_key,debit_code,credit_code,description)
WHERE NOT EXISTS (SELECT 1 FROM public.gl_mappings g WHERE g.event_key = v.event_key);

-- 4. Pastikan periode berjalan ada di accounting_periods
INSERT INTO public.accounting_periods (period, status)
SELECT to_char(now(),'YYYY-MM'), 'Buka'
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_periods p
  WHERE p.period = to_char(now(),'YYYY-MM')
);

-- 5. Verifikasi semua event keys
SELECT event_key, debit_code, credit_code, is_active
FROM public.gl_mappings ORDER BY event_key;
