-- ═══════════════════════════════════════════════════════════════
-- Invoice MCU korporat per batch (admin Finance).
-- Tautkan permintaan pemeriksaan ke invoice yang diterbitkan agar
-- satu batch tidak tertagih dua kali. Aman diulang (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════

-- corp_exam_requests: tautan ke invoice (null = belum ditagih)
ALTER TABLE public.corp_exam_requests
  ADD COLUMN IF NOT EXISTS invoice_id bigint;

-- invoices: pastikan kolom corporate_id ada (dipakai Account Statement & generator)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS corporate_id bigint;

CREATE INDEX IF NOT EXISTS idx_cer_invoice ON public.corp_exam_requests(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_corp ON public.invoices(corporate_id);

SELECT 'corp invoice-per-batch ready' AS status;
