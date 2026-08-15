-- ═══════════════════════════════════════════════════════════════
-- Corporate Account Forms — perluasan data corporate (ala DIGILAB)
-- Business Partner + Tax Information + Bank Information (bank primary
-- tunggal disimpan sebagai kolom; cukup untuk MVP).
-- Aman diulang (IF NOT EXISTS). Jalankan SEBELUM hard-refresh.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.corporates
  -- Business Partner
  ADD COLUMN IF NOT EXISTS sap_id          text,
  ADD COLUMN IF NOT EXISTS brand           text,
  ADD COLUMN IF NOT EXISTS company_type    text default 'COMPANY',
  ADD COLUMN IF NOT EXISTS multinational   boolean default false,
  ADD COLUMN IF NOT EXISTS sap_relation    text,
  ADD COLUMN IF NOT EXISTS sap_period_start date,
  ADD COLUMN IF NOT EXISTS sap_period_end   date,
  -- Primary Address (lengkap)
  ADD COLUMN IF NOT EXISTS city            text,
  ADD COLUMN IF NOT EXISTS province        text,
  ADD COLUMN IF NOT EXISTS subdistrict     text,
  ADD COLUMN IF NOT EXISTS country         text default 'INDONESIA',
  -- Tax Information
  ADD COLUMN IF NOT EXISTS npwp            text,
  ADD COLUMN IF NOT EXISTS tax_address     text,
  ADD COLUMN IF NOT EXISTS tax_registered_at date,
  ADD COLUMN IF NOT EXISTS tax_type        text default 'BUSINESS',
  ADD COLUMN IF NOT EXISTS tax_office      text,
  ADD COLUMN IF NOT EXISTS pph23           boolean default false,
  -- Bank Information (primary)
  ADD COLUMN IF NOT EXISTS bank_name           text,
  ADD COLUMN IF NOT EXISTS bank_branch         text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_name   text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

SELECT 'corporate account columns ready' AS status;
