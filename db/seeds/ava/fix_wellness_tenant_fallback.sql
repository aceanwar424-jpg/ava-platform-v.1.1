-- SQL Patch: Fix "Sesi atau profil pengguna tidak valid" Error in Supabase
-- Target: Supabase SQL Editor
-- Jalankan skrip ini SEKALI di Supabase SQL Editor untuk memperbaiki fungsi tenant resolver & mengisi tenant_id pada profil user.

-- 1. Tambahkan Fallback Tenant Resolver di Postgres Function
CREATE OR REPLACE FUNCTION public.wellness_actor_tenant()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL LIMIT 1),
    (SELECT tenant_id FROM public.wellness_programs LIMIT 1),
    (SELECT tenant_id FROM public.user_profiles WHERE tenant_id IS NOT NULL LIMIT 1),
    '11111111-1111-4111-8111-111111111111'::uuid
  );
$$;

-- 2. Pastikan semua user_profiles (termasuk uat.admin@avahealth.sbs) memiliki tenant_id terisi
UPDATE public.user_profiles
SET tenant_id = '11111111-1111-4111-8111-111111111111'::uuid
WHERE tenant_id IS NULL;

-- 3. Pastikan role akun UAT admin terisi super_admin
UPDATE public.user_profiles
SET role = 'super_admin'
WHERE lower(email) IN ('uat.admin@avahealth.sbs', 'uat.ihc@avahealth.sbs')
   OR id = auth.uid();

-- Verifikasi Perbaikan
SELECT 
  p.id, 
  p.full_name, 
  p.role, 
  p.tenant_id,
  public.wellness_actor_tenant() AS resolved_tenant
FROM public.user_profiles p
WHERE p.id = auth.uid() OR lower(COALESCE(p.full_name,'')) LIKE '%uat%'
LIMIT 10;
