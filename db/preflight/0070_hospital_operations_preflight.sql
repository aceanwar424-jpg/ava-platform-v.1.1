-- READ ONLY. No ownership guessing, production application or patient export.
SELECT name, to_regclass('public.' || name) IS NOT NULL AS available
FROM unnest(ARRAY['tenants','user_profiles','admissions','inpatient_beds','inpatient_stays','inpatient_charges','inpatient_discharges','roles','role_pages','user_pages']) name;
SELECT proname, pg_get_function_identity_arguments(p.oid) AS signature
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('current_tenant_id','inp_admit_patient','inp_transfer_bed','inp_discharge_patient','inp_set_bed_status','create_auth_user','set_user_access');
SELECT count(*) AS admissions_without_tenant FROM public.admissions a WHERE to_jsonb(a)->>'tenant_id' IS NULL;
SELECT count(*) AS beds_without_confirmed_tenant FROM public.inpatient_beds b WHERE to_jsonb(b)->>'tenant_id' IS NULL;
SELECT count(*) AS active_stays_without_confirmed_tenant FROM public.inpatient_stays s WHERE s.status='Dirawat' AND to_jsonb(s)->>'tenant_id' IS NULL;
SELECT count(*) AS orphan_stays FROM public.inpatient_stays s LEFT JOIN public.admissions a ON a.id=s.admission_id WHERE a.id IS NULL;
SELECT count(*) AS duplicate_active_beds FROM (SELECT bed_id FROM public.inpatient_stays WHERE status='Dirawat' GROUP BY bed_id HAVING count(*)>1) x;
