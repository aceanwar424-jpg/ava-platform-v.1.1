-- 0016 — Pembuatan token portal tanpa pgcrypto
--
-- BUG YANG DIPERBAIKI
-- portal_akses_buat() memakai gen_random_bytes(), yang berasal dari ekstensi
-- pgcrypto. Ekstensi itu TIDAK tersedia pada PGlite (mesin lokal desktop),
-- sehingga pembuatan tautan portal gagal total di instalasi klinik —
-- justru tempat portal ini paling dibutuhkan.
--
-- Penggantinya gen_random_uuid(), yang ada di inti PostgreSQL sejak versi 13
-- dan sudah dipakai skema agentic. Dua UUID v4 digabung menghasilkan 64
-- karakter heksadesimal, sekitar 244 bit keacakan — jauh melampaui kebutuhan
-- token yang juga dijaga masa berlaku, pencabutan, dan pembatasan percobaan.
--
-- Sengaja BUKAN md5(random()): random() memakai pembangkit yang tidak aman
-- secara kriptografis dan dapat ditebak bila keadaan awalnya diketahui.

CREATE OR REPLACE FUNCTION public.portal_akses_buat(
  p_jenis text, p_ref_id bigint, p_label text, p_hari integer DEFAULT 180)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_id bigint;
BEGIN
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.portal_akses (token, jenis, ref_id, label, berlaku_sampai)
  VALUES (v_token, COALESCE(p_jenis, 'korporat'), p_ref_id, p_label,
          CURRENT_DATE + COALESCE(p_hari, 180))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_akses_buat(text, bigint, text, integer) TO authenticated, service_role;
