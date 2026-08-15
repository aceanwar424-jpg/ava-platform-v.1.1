-- ══════════════════════════════════════════════════════════════════════
-- OneLab · HOME CARE — PORTAL NAKES (akses nakes via link/token, tanpa login admin)
-- ──────────────────────────────────────────────────────────────────────
-- Selama ini nakes membagikan lokasi lewat modal DI DALAM aplikasi admin —
-- perlu login penuh & pilih nama sendiri tanpa autentikasi. Portal ini memberi
-- nakes halaman sendiri (nakes.html?t=<token>) yang:
--   • menampilkan order yang DITUGASKAN ke nakes itu (alamat, pasien, jadwal),
--   • tombol navigasi ke lokasi pasien,
--   • berbagi lokasi GPS live (lewat token, staff_id tak diekspos ke klien).
-- Token per-nakes bersifat rahasia (seperti token pelacakan pasien).
--
-- PRASYARAT: supabase_homecare_maps.sql sudah dijalankan (kolom lat/lng/current_*).
-- IDEMPOTEN — aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.homecare_staff
  ADD COLUMN IF NOT EXISTS access_token text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hc_staff_token ON public.homecare_staff(access_token);

-- ── 1. Buat/ambil token akses nakes (dipanggil admin) ─────────────────
CREATE OR REPLACE FUNCTION public.homecare_staff_ensure_token(p_staff_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tok TEXT;
BEGIN
  SELECT access_token INTO v_tok FROM public.homecare_staff WHERE id = p_staff_id;
  IF v_tok IS NULL OR btrim(v_tok) = '' THEN
    v_tok := 'nk_' || substr(md5(gen_random_uuid()::text || p_staff_id::text), 1, 20);
    UPDATE public.homecare_staff SET access_token = v_tok WHERE id = p_staff_id;
  END IF;
  RETURN v_tok;
END $$;

-- ── 2. Portal nakes: identitas + order yang ditugaskan ────────────────
-- Token → nakes → daftar order aktif (hari ini & mendatang) miliknya.
CREATE OR REPLACE FUNCTION public.homecare_staff_portal(p_token TEXT)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH st AS (
    SELECT id, staff_name, phone FROM public.homecare_staff
     WHERE access_token = p_token LIMIT 1
  )
  SELECT CASE WHEN st.id IS NULL THEN NULL ELSE jsonb_build_object(
    'staff_name', st.staff_name,
    'orders', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'order_number', o.order_number, 'patient_name', o.patient_name,
        'patient_address', o.patient_address, 'patient_phone', o.patient_phone,
        'service_type', o.service_type, 'status', o.status,
        'scheduled_date', o.scheduled_date, 'scheduled_time', o.scheduled_time,
        'lat', o.lat, 'lng', o.lng
      ) ORDER BY o.scheduled_date, o.scheduled_time)
      FROM public.homecare_orders o
      WHERE o.staff_id = st.id
        AND COALESCE(o.status,'') NOT IN ('Selesai','Dibatalkan')
        AND (o.scheduled_date IS NULL OR o.scheduled_date >= CURRENT_DATE - 1)
    ), '[]'::jsonb)
  ) END
  FROM st;
$$;

-- ── 3. Nakes kirim GPS lewat TOKEN (staff_id tak diekspos) ────────────
CREATE OR REPLACE FUNCTION public.homecare_staff_track(p_token TEXT, p_lat NUMERIC, p_lng NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT;
BEGIN
  SELECT id INTO v_id FROM public.homecare_staff WHERE access_token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Token nakes tidak valid'; END IF;
  UPDATE public.homecare_staff
     SET current_lat = p_lat, current_lng = p_lng, location_updated_at = now(), updated_at = now()
   WHERE id = v_id;
  RETURN jsonb_build_object('ok', true, 'at', now());
END $$;

GRANT EXECUTE ON FUNCTION public.homecare_staff_ensure_token(BIGINT)          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.homecare_staff_portal(TEXT)                  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.homecare_staff_track(TEXT,NUMERIC,NUMERIC)   TO anon, authenticated, service_role;

SELECT 'Home Care portal nakes siap — nakes.html?t=<token>' AS status;
