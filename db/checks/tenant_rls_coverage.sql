-- Run in staging with a read-only database role.
-- Reports every public table with tenant_id and whether RLS is enabled.
SELECT
  c.relname AS table_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public'
      AND col.table_name = c.relname
      AND col.column_name = 'tenant_id'
  ) AS has_tenant_id,
  c.relrowsecurity AS rls_enabled,
  COUNT(p.policyname)::int AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p
  ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public'
      AND col.table_name = c.relname
      AND col.column_name = 'tenant_id'
  )
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
