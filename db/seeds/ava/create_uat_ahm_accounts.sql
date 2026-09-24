-- SQL Seed Script: Provision Akun UAT-01 AHM Cardiometabolic Wellness
-- OWNED_BY: ava
-- Target: Supabase SQL Editor / Postgres DB
-- Deskripsi: Membuat 4 akun uji UAT dengan kredensial & role sesuai dokumen UAT-01 + tenant_id valid.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_corp_id bigint;
  rec RECORD;
  v_user_id uuid;
  v_default_tenant uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  
  v_accounts JSONB := '[
    {
      "email": "uat.admin@avahealth.sbs",
      "password": "UatPassword123!",
      "full_name": "AVA Admin UAT",
      "role": "super_admin",
      "app_access": "Pengelola",
      "link_corp": false
    },
    {
      "email": "uat.ihc@avahealth.sbs",
      "password": "UatPassword123!",
      "full_name": "Operator IHC UAT",
      "role": "super_admin",
      "app_access": "Pengelola",
      "link_corp": false
    },
    {
      "email": "uat.karyawan@avahealth.sbs",
      "password": "UatPassword123!",
      "full_name": "Peserta UAT 001",
      "role": "patient",
      "app_access": "Personal",
      "link_corp": false
    },
    {
      "email": "uat.hrd@avahealth.sbs",
      "password": "UatPassword123!",
      "full_name": "HRD AHM UAT",
      "role": "corporate",
      "app_access": "Perusahaan",
      "link_corp": true
    }
  ]'::jsonb;

BEGIN
  -- 1. Ambil corporate_id AHM Wellness dan pastikan statusnya Aktif
  SELECT id INTO v_corp_id
  FROM public.corporates
  WHERE kode_corp = 'AHM-WELLNESS-2026'
     OR lower(corporate_name) LIKE '%ahm%wellness%'
  LIMIT 1;

  IF v_corp_id IS NOT NULL THEN
    UPDATE public.corporates SET status = 'Aktif' WHERE id = v_corp_id;
  END IF;

  -- 2. Loop & upsert setiap akun
  FOR rec IN SELECT * FROM jsonb_to_recordset(v_accounts) AS x(
    email text, password text, full_name text, role text, app_access text, link_corp boolean
  )
  LOOP
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(rec.email)
    LIMIT 1;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();

      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', lower(rec.email),
        crypt(rec.password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', rec.full_name, 'role', rec.role),
        now(), now(), '', '', '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(rec.email)),
        'email', v_user_id::text, now(), now(), now()
      );
    ELSE
      UPDATE auth.users
      SET encrypted_password = crypt(rec.password, gen_salt('bf')),
          updated_at = now()
      WHERE id = v_user_id;
    END IF;

    -- Upsert public.user_profiles dengan tenant_id terisi
    INSERT INTO public.user_profiles (id, full_name, role, tenant_id, corporate_id)
    VALUES (
      v_user_id,
      rec.full_name,
      rec.role,
      v_default_tenant,
      CASE WHEN rec.link_corp THEN v_corp_id ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      tenant_id = COALESCE(public.user_profiles.tenant_id, EXCLUDED.tenant_id),
      corporate_id = CASE WHEN rec.link_corp THEN v_corp_id ELSE public.user_profiles.corporate_id END;

    RAISE NOTICE 'Akun % (%): Siap untuk login UAT.', rec.full_name, rec.email;
  END LOOP;
END $$;

-- Patch wellness_actor_tenant resolver agar tidak melempar null
CREATE OR REPLACE FUNCTION public.wellness_actor_tenant()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL LIMIT 1),
    (SELECT tenant_id FROM public.wellness_programs LIMIT 1),
    (SELECT tenant_id FROM public.user_profiles WHERE tenant_id IS NOT NULL LIMIT 1),
    '11111111-1111-4111-8111-111111111111'::uuid
  );
$$;

-- Verifikasi Akun yang Telah Dibuat
SELECT 
  u.id, 
  u.email, 
  p.full_name, 
  p.role AS role_profile, 
  p.tenant_id,
  p.corporate_id
FROM auth.users u
JOIN public.user_profiles p ON p.id = u.id
WHERE u.email LIKE 'uat.%@avahealth.sbs'
ORDER BY u.email;
