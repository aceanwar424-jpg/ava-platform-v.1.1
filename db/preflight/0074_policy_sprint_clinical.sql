-- Read-only: use only on an explicitly authorized environment.
SELECT name,to_regclass('public.'||name) IS NOT NULL AS available
FROM unnest(ARRAY['tenants','user_profiles','admissions','roles','role_pages','rs_workflow_types']) name;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS signature
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('current_tenant_id','rs_can_read');
SELECT role,count(*) FROM public.user_profiles GROUP BY role;
SELECT count(*) AS admissions_without_tenant FROM public.admissions WHERE tenant_id IS NULL;
SELECT name,to_regclass('public.'||name) IS NOT NULL AS already_present
FROM unnest(ARRAY['ops_policy_versions','tech_team_sprints','rs_clinical_records']) name;
