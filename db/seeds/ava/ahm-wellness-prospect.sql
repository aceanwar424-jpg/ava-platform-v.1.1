-- Customer-project registration requested by the owner on 2026-09-22.
-- OWNED_BY: ava
-- This seed records commercial planning only. It contains no participant,
-- medical, pricing, contract, PIC, or other personal/confidential data.

INSERT INTO public.corporates (
  kode_corp, corporate_name, industry, brand, company_type,
  status, notes, created_by, created_at, updated_at
)
SELECT
  'AHM-WELLNESS-2026',
  'AHM - Project Wellness',
  'Manufaktur Otomotif',
  'AHM',
  'COMPANY',
  'Prospek',
  'OWNED_BY: ava; Project planning wellness diabetes dan hipertensi. Status komersial belum dinyatakan aktif.',
  'system',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.corporates
  WHERE kode_corp = 'AHM-WELLNESS-2026'
     OR lower(corporate_name) IN ('ahm - project wellness','pt astra honda motor')
);
