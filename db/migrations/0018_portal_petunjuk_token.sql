-- 0018 — Petunjuk token portal, supaya token utuh tidak perlu dibaca lagi
--
-- Kolom portal_akses.token kini disensor di sisi mesin (KOLOM_RAHASIA di
-- desktop-app/electron/local-engine.js) dan tidak pernah keluar lewat REST.
-- Layar admin tetap perlu menandai baris mana yang mana, tapi untuk itu cukup
-- potongannya — bukan kredensial utuhnya.
--
-- Potongan disimpan sebagai kolom tersendiri saat token dibuat. Menghitungnya
-- di sisi peramban mustahil sekarang, dan memang begitu yang diinginkan:
-- satu-satunya saat token utuh terlihat adalah nilai kembalian
-- portal_akses_buat(), tepat ketika dibuat.

ALTER TABLE public.portal_akses ADD COLUMN IF NOT EXISTS token_petunjuk text;

-- Baris yang sudah ada dari sebelum kolom ini dibuat.
UPDATE public.portal_akses
   SET token_petunjuk = left(token, 6) || '…' || right(token, 4)
 WHERE token_petunjuk IS NULL AND token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.portal_akses_buat(
  p_jenis text, p_ref_id bigint, p_label text, p_hari integer DEFAULT 180)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_id bigint;
BEGIN
  -- gen_random_uuid(), bukan gen_random_bytes(): pgcrypto tidak ada di PGlite.
  -- Lihat 0016_token_tanpa_pgcrypto.sql.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.portal_akses (token, token_petunjuk, jenis, ref_id, label, berlaku_sampai)
  VALUES (v_token, left(v_token, 6) || '…' || right(v_token, 4),
          COALESCE(p_jenis, 'korporat'), p_ref_id, p_label,
          CURRENT_DATE + COALESCE(p_hari, 180))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_akses_buat(text, bigint, text, integer) TO authenticated, service_role;
