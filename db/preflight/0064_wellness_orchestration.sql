-- OWNED_BY: generic. Read-only aggregate checks; no identities or clinical values returned.
SELECT name,to_regclass('public.'||name) IS NOT NULL AS present
FROM unnest(ARRAY['wellness_programs','wellness_enrollments','wellness_observations','wellness_treatment_requests','wellness_audit_events','corporate_employees','user_profiles']) name;
SELECT count(*) AS profiles_without_tenant FROM public.user_profiles WHERE tenant_id IS NULL;
SELECT count(*) AS enrollments_with_cross_tenant_profile
FROM public.wellness_enrollments e JOIN public.user_profiles p ON p.id=e.auth_user_id
WHERE p.tenant_id IS DISTINCT FROM e.tenant_id;
SELECT count(*) AS linked_accounts_without_verified_email
FROM public.wellness_enrollments e JOIN auth.users u ON u.id=e.auth_user_id WHERE u.email_confirmed_at IS NULL;
SELECT consent_status,count(*) AS enrollments FROM public.wellness_enrollments GROUP BY consent_status;
SELECT status,count(*) AS treatment_requests FROM public.wellness_treatment_requests GROUP BY status;
