-- ══════════════════════════════════════════════════════════════════════
-- OneLab · ALIAS PENGGUNA (inisial/nama singkat untuk jejak TAT)
-- Jejak waktu lab (collected_by/entered_by/validated_by/approved_by) menyimpan
-- NAMA pelaku. Agar ringkas di riwayat TAT, pakai ALIAS (mis. "ADA", "dr. Sari").
-- Menambah kolom alias + RPC agar tiap user set alias-nya sendiri (aman via
-- auth.uid(), tak perlu buka RLS user_profiles).
-- IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS alias text;

-- Set alias milik SENDIRI (berdasarkan sesi login).
CREATE OR REPLACE FUNCTION public.set_my_alias(p_alias TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  UPDATE public.user_profiles
     SET alias = NULLIF(btrim(p_alias), '')
   WHERE id = v_uid;
  RETURN NULLIF(btrim(p_alias), '');
END $$;

GRANT EXECUTE ON FUNCTION public.set_my_alias(TEXT) TO authenticated, service_role;

SELECT 'Alias pengguna siap — kolom user_profiles.alias + RPC set_my_alias' AS status;
