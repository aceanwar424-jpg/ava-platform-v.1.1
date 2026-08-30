-- ══════════════════════════════════════════════════════════════════
-- MEREK: satu kalimat yang tertinggal di penetapan paket
--
-- Lanjutan 0030. Pesan "kuota kontrak penuh" pada
-- portal_korporat_karyawan_assign() masih menyebut "OneLab" — kalimat itu
-- dibaca langsung oleh PIC perusahaan klien saat kuota kontraknya habis.
--
-- Sama seperti 0030: fungsinya didefinisikan ulang di sini, BUKAN dengan
-- menyunting 0028 yang sudah terpasang. Badan fungsinya disalin apa adanya
-- supaya penegakan kuota dan pembatasan paket per perusahaan tidak bergeser.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.portal_korporat_karyawan_assign(
  p_token   text,
  p_id      bigint,
  p_paket   bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_g      jsonb;
  v_akses  bigint;
  v_ref    bigint;
  v_pk     record;
  v_kuota  int;
  v_pakai  int;
  v_punya  boolean;
BEGIN
  v_g := public.portal_korporat_penjaga(p_token);
  IF v_g ? 'error' THEN RETURN v_g; END IF;
  v_akses := (v_g->>'id')::bigint;
  v_ref   := (v_g->>'ref_id')::bigint;

  SELECT true INTO v_punya FROM public.corporate_employees
   WHERE id = p_id AND corporate_id = v_ref;
  IF NOT FOUND THEN
    -- Karyawan milik perusahaan lain dijawab sama dengan yang tidak ada.
    RETURN jsonb_build_object('error', 'Karyawan tidak ditemukan.');
  END IF;

  -- Melepas paket: selalu boleh, tidak perlu cek kuota.
  IF p_paket IS NULL THEN
    UPDATE public.corporate_employees
       SET package_id = NULL, package_name = NULL,
           status = 'Non-Aktif', updated_at = now()
     WHERE id = p_id AND corporate_id = v_ref;

    INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
    VALUES (v_akses, 'korporat', v_ref, true, 'lepas paket karyawan #' || p_id);
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT id, nama_paket INTO v_pk FROM public.packages
   WHERE id = p_paket
     AND COALESCE(is_active, true)
     AND (corporate_id IS NULL OR corporate_id = v_ref);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Paket tidak tersedia untuk perusahaan Anda.');
  END IF;

  SELECT COALESCE(sum(max_peserta), 0) INTO v_kuota
    FROM public.corporate_contracts
   WHERE corporate_id = v_ref AND COALESCE(status, '') = 'Active';

  SELECT count(*) INTO v_pakai
    FROM public.corporate_employees
   WHERE corporate_id = v_ref AND package_id IS NOT NULL AND id <> p_id;

  IF v_kuota > 0 AND v_pakai >= v_kuota THEN
    RETURN jsonb_build_object('error', format(
      'Kuota kontrak sudah penuh (%s dari %s terpakai). Hubungi AVA untuk menambah kuota.',
      v_pakai, v_kuota));
  END IF;

  UPDATE public.corporate_employees
     SET package_id = v_pk.id, package_name = v_pk.nama_paket,
         status = 'Aktif', updated_at = now()
   WHERE id = p_id AND corporate_id = v_ref;

  INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
  VALUES (v_akses, 'korporat', v_ref, true,
          format('assign paket %s ke karyawan #%s', v_pk.nama_paket, p_id));

  RETURN jsonb_build_object('ok', true, 'paket', v_pk.nama_paket);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_korporat_karyawan_assign(text, bigint, bigint)
  TO anon, authenticated, service_role;
