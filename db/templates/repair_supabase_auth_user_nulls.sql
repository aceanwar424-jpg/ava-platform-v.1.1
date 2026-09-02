-- PEMULIHAN akun Auth yang dibuat dengan SQL template versi lama.
-- Jalankan di Supabase SQL Editor untuk memperbaiki admin@avahealth.sbs
-- yang gagal login dengan pesan "Database error querying schema".
-- Tidak mengubah password, role, atau data klinis apa pun.

UPDATE auth.users
   SET confirmation_token    = COALESCE(confirmation_token, ''),
       recovery_token        = COALESCE(recovery_token, ''),
       email_change          = COALESCE(email_change, ''),
       email_change_token_new = COALESCE(email_change_token_new, '')
 WHERE lower(email) = 'admin@avahealth.sbs';

-- Pastikan hasilnya bersih; semua kolom berikut harus false.
SELECT email,
       confirmation_token IS NULL AS confirmation_token_null,
       recovery_token IS NULL AS recovery_token_null,
       email_change IS NULL AS email_change_null,
       email_change_token_new IS NULL AS email_change_token_new_null
  FROM auth.users
 WHERE lower(email) = 'admin@avahealth.sbs';
