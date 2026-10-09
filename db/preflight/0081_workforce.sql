-- Read-only. Local authorized environment; no automatic enrollment.
SELECT id,tenant_id,role FROM user_profiles WHERE lower(role) IN ('dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance');
SELECT id,tenant_id,kind,scope,state,reviewed_by FROM ops_policy_versions WHERE kind IN ('authority','clinical_template') ORDER BY tenant_id,scope,id;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) signature,p.prosecdef,r.rolname owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='public' AND p.proname IN ('ops_assert_permission','ops_policy_command','rs_clinical_command','rs_episode_command');
SELECT tablename,policyname,roles,cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('user_profiles','ops_policy_versions','rs_clinical_records');
