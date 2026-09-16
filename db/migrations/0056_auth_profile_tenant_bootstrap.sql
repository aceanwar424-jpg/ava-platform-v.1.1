-- 0056 — Bootstrap tenant profil pengguna saat JWT belum membawa tenant_id
--
-- Login cloud dapat mengautentikasi user lebih dahulu, sementara custom claim
-- tenant_id belum diterbitkan. Sebelumnya current_tenant_id() mengembalikan
-- NULL; RLS kemudian menyembunyikan user_profiles milik user itu sendiri dan
-- portal berhenti pada pesan "Profil akses tidak dapat diverifikasi".
--
-- Fallback hanya membaca tenant milik auth.uid() melalui SECURITY DEFINER.
-- Tidak membuka profil pengguna lain dan tidak menerima tenant dari input
-- browser. Claim tenant tetap memiliki prioritas ketika sudah tersedia.

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim text;
  v_setting text;
  v_tenant uuid;
BEGIN
  v_claim := nullif(auth.jwt() ->> 'tenant_id', '');
  IF v_claim IS NOT NULL AND v_claim ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN v_claim::uuid;
  END IF;

  -- Some hosted requests carry a non-UUID marker (for example `local`) in
  -- app.tenant_id. Validate before casting so a malformed setting cannot turn
  -- a profile read into HTTP 500.
  v_setting := nullif(current_setting('app.tenant_id', true), '');
  IF v_setting IS NOT NULL AND v_setting ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN v_setting::uuid;
  END IF;

  SELECT up.tenant_id INTO v_tenant
    FROM public.user_profiles up
   WHERE up.id = auth.uid()
   LIMIT 1;
  RETURN v_tenant;
END;
$$;

-- Profil milik user yang sedang login harus dapat dibaca untuk bootstrap RBAC.
-- Akses lintas pengguna tetap mensyaratkan tenant yang sama dan peran admin.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_tenant_boundary ON public.user_profiles;
CREATE POLICY user_profiles_tenant_boundary
  ON public.user_profiles
  FOR ALL TO authenticated
  USING (
    id = auth.uid()
    OR (
      tenant_id = public.current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.user_profiles actor
         WHERE actor.id = auth.uid()
           AND lower(actor.role) IN ('super_admin','admin','admin_faskes')
           AND actor.tenant_id = public.current_tenant_id()
      )
    )
  )
  WITH CHECK (tenant_id = public.current_tenant_id());

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
