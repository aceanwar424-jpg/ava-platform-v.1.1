-- OWNED_BY: ava. Read-only deployment preflight. No patient rows or secrets.
-- Run in the intended Supabase project's SQL editor before frontend activation.
WITH required(name,signature) AS (VALUES
  ('catalog','public.lis_his_catalog()'),
  ('service_order','public.lis_his_submit_order(uuid,jsonb)'),
  ('result_transition','public.lis_transition_results(text,jsonb)'),
  ('patient_history','public.lis_result_history(bigint,bigint,bigint,bigint)'),
  ('critical_notification','public.lis_record_critical(bigint,jsonb)')
)
SELECT name, to_regprocedure(signature) IS NOT NULL AS installed FROM required ORDER BY name;

SELECT
  to_regclass('public.lis_result_events') IS NOT NULL AS transaction_audit_installed,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.lab_results')
    AND tgname='lis_result_write_guard' AND tgenabled='O') AS result_guard_enabled,
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lab_results'
    AND policyname='lis_result_tenant_boundary' AND permissive='RESTRICTIVE') AS result_tenant_boundary,
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='critical_value_notifications'
    AND policyname='lis_critical_tenant_boundary' AND permissive='RESTRICTIVE') AS critical_tenant_boundary;

SELECT CASE WHEN to_regprocedure('public.mark_autoverified(bigint,text)') IS NULL THEN true
  ELSE NOT has_function_privilege('authenticated','public.mark_autoverified(bigint,text)','EXECUTE')
  END AS unsafe_autoverify_unavailable;

-- All booleans should be true. Installation alone does not establish clinical
-- acceptance: test tenant mapping, clinical roles, result amendments, QC policy,
-- HIS delivery and real instrument behavior in staging as described in RC notes.
