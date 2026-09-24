-- SQL Patch: Clean Up Duplicate Enrollments & Reset Consent to Pending
-- Target: Supabase SQL Editor
-- Mengkonsolidasi duplikat enrollment dan menyetel consent_status = 'pending' untuk testing UAT.

-- 1. Hapus duplikat enrollment tanpa auth_user_id jika sudah ada enrollment yang memiliki auth_user_id
DELETE FROM public.wellness_enrollments e1
WHERE e1.auth_user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.wellness_enrollments e2
    WHERE e2.program_id = e1.program_id
      AND e2.auth_user_id = (SELECT id FROM auth.users WHERE lower(email) = 'uat.karyawan@avahealth.sbs' LIMIT 1)
  );

-- 2. Tautkan corporate_employee_id & setel consent_status = 'pending' pada enrollment peserta
UPDATE public.wellness_enrollments e
SET corporate_employee_id = COALESCE(
      e.corporate_employee_id,
      (SELECT id FROM public.corporate_employees WHERE lower(email) = 'uat.karyawan@avahealth.sbs' LIMIT 1)
    ),
    consent_status = 'pending',
    status = 'active',
    consented_at = NULL
WHERE e.auth_user_id = (SELECT id FROM auth.users WHERE lower(email) = 'uat.karyawan@avahealth.sbs' LIMIT 1);

-- 3. Verifikasi Hasil Konsolidasi Enrollment
SELECT 
  e.id AS enrollment_id,
  e.program_id,
  e.auth_user_id,
  e.corporate_employee_id,
  e.consent_status,
  e.status AS enrollment_status,
  u.email AS user_email,
  emp.full_name AS employee_name
FROM public.wellness_enrollments e
JOIN auth.users u ON u.id = e.auth_user_id
LEFT JOIN public.corporate_employees emp ON emp.id = e.corporate_employee_id
WHERE lower(u.email) = 'uat.karyawan@avahealth.sbs';
