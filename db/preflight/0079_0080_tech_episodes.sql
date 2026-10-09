-- Read-only; authorized local database only. No automatic historical backfill.
SELECT name,to_regclass('public.'||name) IS NOT NULL available FROM unnest(ARRAY['tenants','user_profiles','roles','role_pages','admissions','inpatient_stays','his_master_records','ops_policy_versions','rs_work_orders','rs_clinical_records','tech_support_tickets','tech_changes']) name;
SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('tech_support_tickets','tech_changes','admissions','inpatient_stays','his_master_records') ORDER BY table_name,ordinal_position;
SELECT a.id FROM admissions a LEFT JOIN tenants t ON t.id=a.tenant_id WHERE t.id IS NULL;
SELECT s.admission_id,count(*) FROM inpatient_stays s WHERE s.status='Dirawat' GROUP BY s.admission_id HAVING count(*)>1;
SELECT id,code,name,status,payload FROM his_master_records WHERE domain_key='unit_room';
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('tech_support_tickets','tech_changes','admissions','inpatient_stays');
SELECT p.proname,pg_get_function_identity_arguments(p.oid) signature,p.prosecdef,r.rolname owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='public' AND p.proname IN ('ops_actor','ops_assert_permission','rs_can_read','rs_clinical_command','inp_admit_patient','inp_discharge_patient');
