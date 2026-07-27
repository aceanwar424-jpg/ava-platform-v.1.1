-- ═══════════════════════════════════════════════════════════════
-- Migration: Support Custom Corporate Packages
-- ═══════════════════════════════════════════════════════════════

-- Add corporate_id to packages table to isolate custom corporate packages
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS corporate_id bigint REFERENCES public.corporates(id) ON DELETE CASCADE;
