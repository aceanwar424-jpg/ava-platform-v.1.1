-- Extend Super Admin provisioning with hospital roles; existing grants preserved.
BEGIN;
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
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_tenant uuid;
  v_user_id uuid;
  v_existing_tenant uuid;
  v_email text := lower(btrim(p_email));
  v_role text := lower(btrim(coalesce(p_role, 'viewer')));
  v_password_hash text;
  v_instance uuid;
BEGIN
  SELECT lower(role), tenant_id INTO v_actor_role, v_tenant
    FROM public.user_profiles WHERE id = v_actor;
  IF v_actor IS NULL OR v_actor_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Hanya Super Admin yang dapat membuat akun.';
  END IF;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant Super Admin belum terpasang.';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Format email tidak valid.';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password awal minimal 8 karakter.';
  END IF;
  IF p_full_name IS NULL OR length(btrim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Nama lengkap wajib diisi.';
  END IF;
  IF v_role NOT IN (
    'super_admin','head_operation','direktur','manager','spv','sales',
    'operasional','hrd_staff','finance_staff','ihc','patient','dokter',
    'vendor','viewer','corporate','admin','admin_faskes','tech','nurse','pharmacist','housekeeping','cssd','nutrition','porter','facility','midwife'
  ) THEN
    RAISE EXCEPTION 'Role % tidak dikenali.', v_role;
  END IF;

  -- Never store a plaintext password. If pgcrypto is unavailable, fail closed.
  v_password_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
  SELECT id, instance_id INTO v_user_id, v_instance
    FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    SELECT tenant_id INTO v_existing_tenant
      FROM public.user_profiles WHERE id = v_user_id;
    IF v_existing_tenant IS NOT NULL AND v_existing_tenant IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'Akun sudah terdaftar pada tenant lain.';
    END IF;
    -- Existing accounts are linked/upserted without resetting their password.
    -- Password changes stay in the authenticated reset-password flow.
    UPDATE auth.users
       SET email = v_email,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           phone = nullif(btrim(p_phone), ''),
           phone_confirmed_at = CASE WHEN nullif(btrim(p_phone), '') IS NULL THEN NULL ELSE coalesce(phone_confirmed_at, now()) END,
           updated_at = now()
     WHERE id = v_user_id;
  ELSE
    v_user_id := gen_random_uuid();
    SELECT instance_id INTO v_instance FROM auth.users LIMIT 1;
    v_instance := coalesce(v_instance, '00000000-0000-0000-0000-000000000000'::uuid);
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_instance, v_user_id, 'authenticated', 'authenticated', v_email,
      v_password_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', btrim(p_full_name)), false,
      now(), now(), nullif(btrim(p_phone), ''),
      CASE WHEN nullif(btrim(p_phone), '') IS NULL THEN NULL ELSE now() END,
      '', '', '', ''
    );
  END IF;

  INSERT INTO public.user_profiles (
    id, tenant_id, full_name, email, phone, role, corporate_id, corp_role,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_tenant, btrim(p_full_name), v_email,
    nullif(btrim(p_phone), ''), v_role, p_corporate_id, nullif(btrim(p_corp_role), ''),
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    corporate_id = EXCLUDED.corporate_id,
    corp_role = EXCLUDED.corp_role,
    updated_at = now();

  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    INSERT INTO public.activity_logs(action, table_name, record_id, record_name, description, user_id, user_name, created_at)
    VALUES('user.provisioned', 'user_profiles', v_user_id::text, btrim(p_full_name),
           'Akun Auth dan profile tenant dibuat/ditautkan oleh Super Admin.', v_actor,
           coalesce((SELECT full_name FROM public.user_profiles WHERE id = v_actor), v_actor::text), now());
  END IF;

  RETURN v_user_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_user_access(
  p_user_id uuid,
  p_role text,
  p_pages text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_tenant uuid;
  v_target_tenant uuid;
  v_role text := lower(btrim(coalesce(p_role, 'viewer')));
  v_page text;
BEGIN
  SELECT lower(role), tenant_id INTO v_actor_role, v_tenant
    FROM public.user_profiles WHERE id = v_actor;
  IF v_actor_role <> 'super_admin' OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'Hanya Super Admin yang dapat mengubah role.';
  END IF;
  SELECT tenant_id INTO v_target_tenant FROM public.user_profiles WHERE id = p_user_id;
  IF v_target_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'User berada di tenant berbeda atau tidak ditemukan.';
  END IF;
  IF v_role NOT IN (
    'super_admin','head_operation','direktur','manager','spv','sales',
    'operasional','hrd_staff','finance_staff','ihc','patient','dokter',
    'vendor','viewer','corporate','admin','admin_faskes','tech','nurse','pharmacist','housekeeping','cssd','nutrition','porter','facility','midwife'
  ) THEN
    RAISE EXCEPTION 'Role % tidak dikenali.', v_role;
  END IF;
  IF coalesce(array_length(p_pages, 1), 0) > 250 THEN
    RAISE EXCEPTION 'Jumlah menu terlalu banyak.';
  END IF;
  FOREACH v_page IN ARRAY coalesce(p_pages, ARRAY[]::text[]) LOOP
    IF nullif(btrim(v_page), '') IS NULL THEN
      RAISE EXCEPTION 'Daftar menu berisi nilai kosong.';
    END IF;
  END LOOP;

  UPDATE public.user_profiles SET role = v_role, updated_at = now() WHERE id = p_user_id;
  DELETE FROM public.user_pages WHERE user_id = p_user_id;
  INSERT INTO public.user_pages(user_id, page)
  SELECT p_user_id, btrim(x) FROM unnest(coalesce(p_pages, ARRAY[]::text[])) x
  ON CONFLICT DO NOTHING;
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    INSERT INTO public.activity_logs(action, table_name, record_id, record_name, description, user_id, user_name, created_at)
    VALUES('user.access_changed', 'user_profiles', p_user_id::text, p_user_id::text,
           'Role dan akses menu diperbarui oleh Super Admin.', v_actor,
           coalesce((SELECT full_name FROM public.user_profiles WHERE id = v_actor), v_actor::text), now());
  END IF;
  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'role', v_role,
                            'page_count', coalesce(array_length(p_pages, 1), 0));
END;
$$;
COMMIT;
