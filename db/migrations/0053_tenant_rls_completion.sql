-- OWNED_BY: ava. Completes tenant boundaries for shared-cloud tables.
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS user_profiles_tenant_boundary ON public.user_profiles';
    EXECUTE 'CREATE POLICY user_profiles_tenant_boundary ON public.user_profiles
      FOR ALL TO authenticated
      USING (tenant_id = public.current_tenant_id() AND (id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles actor WHERE actor.id = auth.uid()
          AND lower(actor.role) IN (''super_admin'',''admin'',''admin_faskes''))))
      WITH CHECK (tenant_id = public.current_tenant_id())';
  END IF;
  IF to_regclass('public.admissions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS admissions_tenant_boundary ON public.admissions';
    EXECUTE 'CREATE POLICY admissions_tenant_boundary ON public.admissions
      FOR ALL TO authenticated
      USING (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id())';
  END IF;
END $$;
