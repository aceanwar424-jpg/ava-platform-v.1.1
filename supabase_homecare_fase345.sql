-- ══════════════════════════════════════════════════════════════
-- OneLab — HOME CARE · FASE 3-5
--   Fase 3 (Integrasi)  : billing status + tautan invoice; BHP via goods_issues (no schema)
--   Fase 4 (Analitik)   : rating & feedback pasien
--   Fase 5 (Governance) : audit via activity_logs (no schema)
-- Aman dijalankan berulang (idempoten). Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.homecare_orders
  -- Fase 3: billing
  ADD COLUMN IF NOT EXISTS billing_status text default 'Belum Ditagih',  -- Belum Ditagih | Ditagih | Lunas
  ADD COLUMN IF NOT EXISTS invoice_id     bigint,
  ADD COLUMN IF NOT EXISTS billed_at      timestamp,
  -- Fase 4: kepuasan pasien
  ADD COLUMN IF NOT EXISTS rating         integer,   -- 1..5
  ADD COLUMN IF NOT EXISTS feedback       text,
  -- Fase 3: pemakaian BHP terhitung (nilai)
  ADD COLUMN IF NOT EXISTS bhp_value      numeric default 0;

CREATE INDEX IF NOT EXISTS idx_hc_billing ON public.homecare_orders(billing_status);
CREATE INDEX IF NOT EXISTS idx_hc_rating  ON public.homecare_orders(rating);

SELECT 'homecare_orders Fase 3-5 columns added' AS result;
