-- 0057 — Hindari recursive RLS pada bootstrap user_profiles
--
-- Policy sebelumnya melakukan SELECT kembali ke public.user_profiles dari
-- dalam policy public.user_profiles. PostgreSQL dapat menghentikan query itu
-- sebagai infinite recursion (PostgREST kemudian terlihat sebagai HTTP 500).
-- Pemeriksaan admin dipindahkan ke helper SECURITY DEFINER agar policy tidak
-- membaca tabel yang sama melalui RLS.

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_profiles actor
     WHERE actor.id = auth.uid()
       AND actor.tenant_id = p_tenant
       AND lower(actor.role) IN ('super_admin', 'admin', 'admin_faskes')
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_tenant_boundary ON public.user_profiles;
CREATE POLICY user_profiles_tenant_boundary
  ON public.user_profiles
  FOR ALL TO authenticated
  USING (
    id = auth.uid()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.is_tenant_admin(tenant_id)
    )
  )
  WITH CHECK (tenant_id = public.current_tenant_id());
