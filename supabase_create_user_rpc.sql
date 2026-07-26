-- ═══════════════════════════════════════════════════════════════
-- SQL RPC: create_auth_user
-- Memungkinkan Admin membuat akun login di auth.users secara otomatis
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_auth_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_corporate_id bigint,
  p_corp_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
BEGIN
  -- 1) Cari user di auth.users jika sudah ada
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  
  -- Enkripsi password menggunakan crypt dari pgcrypto
  -- Supabase menempatkan pgcrypto bisa di public atau extensions schema.
  BEGIN
    v_encrypted_password := extensions.crypt(p_password, extensions.gen_salt('bf'));
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_encrypted_password := crypt(p_password, gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
      -- Fallback jika extension tidak terpasang (sangat jarang terjadi di Supabase)
      v_encrypted_password := p_password;
    END;
  END;

  IF v_user_id IS NOT NULL THEN
    -- Update data profil yang sudah ada
    UPDATE public.user_profiles
    SET 
      full_name = p_full_name,
      email = p_email,
      phone = p_phone,
      role = p_role,
      corporate_id = p_corporate_id,
      corp_role = p_corp_role,
      updated_at = now()
    WHERE id = v_user_id;
    
    -- Pastikan email terkonfirmasi jika sudah ada akunnya
    UPDATE auth.users
    SET encrypted_password = v_encrypted_password
    WHERE id = v_user_id;

    RETURN v_user_id;
  END IF;

  -- 2) Buat UUID baru untuk user
  v_user_id := gen_random_uuid();
  
  -- 3) Sisipkan ke tabel auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_password,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_full_name)::jsonb,
    false,
    now(),
    now(),
    p_phone,
    now(),
    '',
    '',
    '',
    ''
  );

  -- 4) Sisipkan ke tabel public.user_profiles
  -- Karena ada trigger bawaan Supabase yang kadang otomatis menyisipkan profil kosong saat auth.users dibuat, 
  -- kita gunakan INSERT ON CONFLICT DO UPDATE untuk mencegah duplikasi.
  INSERT INTO public.user_profiles (
    id,
    full_name,
    email,
    phone,
    role,
    corporate_id,
    corp_role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_full_name,
    p_email,
    p_phone,
    p_role,
    p_corporate_id,
    p_corp_role,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    corporate_id = EXCLUDED.corporate_id,
    corp_role = EXCLUDED.corp_role,
    updated_at = now();

  RETURN v_user_id;
END;
$$;

-- Berikan izin akses eksekusi RPC ke semua role agar bisa diakses dari Web Client
GRANT EXECUTE ON FUNCTION public.create_auth_user(text, text, text, text, text, bigint, text) TO anon, authenticated, service_role;
