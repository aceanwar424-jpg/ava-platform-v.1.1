-- Buat akun Super Admin untuk HIS AVA di Supabase SQL Editor.
--
-- 1. Ganti hanya nilai v_email, v_password, dan v_full_name di bawah ini.
-- 2. Jalankan SEKALI di project Supabase HIS yang dipakai his.avahealth.sbs.
-- 3. Jangan menyimpan password nyata ini ke Git, chat, atau screenshot.
--
-- Script ini aman diulang: bila email sudah ada, password TIDAK diubah;
-- hanya profil Super Admin-nya yang dipastikan ada.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_email     text := 'admin@avahealth.sbs';
  v_password  text := '12345678';
  v_full_name text := 'Master Super Admin';
  v_user_id   uuid;
  v_created   boolean := false;
BEGIN
  IF v_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Isi v_email dengan alamat email yang valid.';
  END IF;

  IF v_password = 'GANTI_DENGAN_PASSWORD_KUAT_MINIMAL_12_KARAKTER'
     OR length(v_password) < 12 THEN
    RAISE EXCEPTION 'Ganti v_password dengan password unik minimal 12 karakter sebelum menjalankan script.';
  END IF;

  SELECT id INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower(v_email)
   LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', lower(v_email),
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', v_full_name, 'role', 'super_admin'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email)),
      'email', v_user_id::text, now(), now(), now()
    );
    v_created := true;
  END IF;

  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (v_user_id, v_full_name, 'super_admin')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = 'super_admin';

  RAISE NOTICE 'Akun % untuk % siap. Password %diubah oleh script ini.',
    CASE WHEN v_created THEN 'baru' ELSE 'yang sudah ada' END,
    lower(v_email),
    CASE WHEN v_created THEN '' ELSE 'tidak ' END;
END $$;

-- Verifikasi aman (tidak menampilkan hash/password):
SELECT u.id, u.email, u.email_confirmed_at, p.full_name, p.role
  FROM auth.users u
  JOIN public.user_profiles p ON p.id = u.id
 WHERE lower(u.email) = 'admin@avahealth.sbs';
