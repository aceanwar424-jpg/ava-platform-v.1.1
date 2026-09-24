-- SQL Patch: Directly Grant Consent for UAT Participant Testing
-- Target: Supabase SQL Editor
-- Penjelasan: Mengubah consent_status menjadi 'granted' agar peringatan kuning hilang & form input mandiri langsung aktif 100%.

UPDATE public.wellness_enrollments e
SET consent_status = 'granted',
    consented_at = now(),
    status = 'active',
    updated_at = now()
FROM public.corporate_employees emp
JOIN auth.users u ON lower(u.email) = lower(emp.email)
WHERE (e.corporate_employee_id = emp.id OR e.auth_user_id = u.id)
  AND lower(u.email) = 'uat.karyawan@avahealth.sbs';

-- Verifikasi Status Consent
SELECT e.id, e.program_id, e.auth_user_id, e.consent_status, e.status, u.email
FROM public.wellness_enrollments e
JOIN auth.users u ON u.id = e.auth_user_id
WHERE lower(u.email) = 'uat.karyawan@avahealth.sbs';
