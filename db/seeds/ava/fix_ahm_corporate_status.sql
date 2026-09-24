-- SQL Patch: Activate AHM Corporate Status for Portal Perusahaan Login
-- Target: Supabase SQL Editor
-- Mengubah status corporate AHM dari 'Prospek' menjadi 'Aktif' agar lolos verifikasi korporat_verifikasi_akses.

UPDATE public.corporates
SET status = 'Aktif'
WHERE kode_corp = 'AHM-WELLNESS-2026' OR lower(corporate_name) LIKE '%ahm%wellness%';

-- Verifikasi Status Corporate AHM
SELECT id, kode_corp, corporate_name, status, created_at
FROM public.corporates
WHERE kode_corp = 'AHM-WELLNESS-2026' OR lower(corporate_name) LIKE '%ahm%wellness%';
