-- ═══════════════════════════════════════════════════════════════
-- Portal Corporate (apps/) — wiring ke backend nyata
-- Identitas akun → corporate_id, invoice korporat, saldo cashback.
-- Aman diulang (IF NOT EXISTS). Jalankan SEBELUM hard-refresh.
-- Prasyarat: supabase_corp_mcu_booking.sql sudah dijalankan.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Tautkan akun login ke satu corporate ─────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS corporate_id bigint;   -- null = bukan akun korporat

-- ── 2. Invoice korporat (invoices sudah punya partner_id saja) ──
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS corporate_id bigint;

CREATE INDEX IF NOT EXISTS idx_invoices_corp ON public.invoices(corporate_id);

-- ── 3. Cashback korporat: saldo + riwayat klaim ─────────────────
ALTER TABLE public.corporates
  ADD COLUMN IF NOT EXISTS cashback_balance numeric default 0;

CREATE TABLE IF NOT EXISTS public.corporate_cashback_claims (
  id            bigint generated always as identity primary key,
  corporate_id  bigint references public.corporates(id) on delete cascade,
  amount        numeric not null,
  method        text,                -- Transfer Bank, Potong Invoice, dll
  status        text default 'Requested',   -- Requested, Approved, Paid
  claimed_by    text,
  notes         text,
  created_at    timestamp default now()
);

CREATE INDEX IF NOT EXISTS idx_cashback_corp ON public.corporate_cashback_claims(corporate_id);

SELECT 'corp portal wiring columns ready' AS status;
