-- Complete RLS for legacy tenant-bearing tables discovered by the expanded
-- control-plane audit. Missing tables are skipped for backwards-compatible
-- upgrades, but every existing table receives the same tenant boundary.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'sys_number_registry', 'sys_number_void', 'permits',
    'service_activity_map', 'person_contact', 'person_brand_link',
    'person_merge_log', 'rbac_user_roles', 'tenant_pemakaian', 'tech_lisensi'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'DROP POLICY IF EXISTS tenant_isolation_select ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_select ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id())', t);
      EXECUTE format(
        'DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id())', t);
      EXECUTE format(
        'DROP POLICY IF EXISTS tenant_isolation_update ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_update ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())', t);
      EXECUTE format(
        'DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_delete ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id())', t);
    END IF;
  END LOOP;
END $$;
