-- ══════════════════════════════════════════════════════════════════════
-- OneLab · HOME CARE — INTEGRASI PETA LIVE (booking + tracking GPS real-time)
-- Menambah:
--   • homecare_orders: lat/lng lokasi pasien + track_token (link publik pasien)
--   • homecare_staff : current_lat/current_lng/location_updated_at (posisi live)
--   • RPC: homecare_track_update (nakes kirim GPS) · homecare_live_orders (peta
--          admin) · homecare_track_public (halaman pasien via token) ·
--          homecare_ensure_token (buat/ambil token link pasien)
-- Dipakai admin (dashboard), nakes (bagikan lokasi + rute), pasien (lacak + ETA).
-- IDEMPOTEN — aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Kolom geolokasi ───────────────────────────────────────────────
ALTER TABLE public.homecare_orders
  ADD COLUMN IF NOT EXISTS lat         numeric,
  ADD COLUMN IF NOT EXISTS lng         numeric,
  ADD COLUMN IF NOT EXISTS track_token text;

ALTER TABLE public.homecare_staff
  ADD COLUMN IF NOT EXISTS current_lat         numeric,
  ADD COLUMN IF NOT EXISTS current_lng         numeric,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_hc_orders_token ON public.homecare_orders(track_token);

-- ── 2. Nakes mengirim posisi GPS (dipanggil berkala dari HP nakes) ────
CREATE OR REPLACE FUNCTION public.homecare_track_update(p_staff_id BIGINT, p_lat NUMERIC, p_lng NUMERIC)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.homecare_staff
     SET current_lat = p_lat, current_lng = p_lng, location_updated_at = now(), updated_at = now()
   WHERE id = p_staff_id
  RETURNING jsonb_build_object('id', id, 'at', location_updated_at);
$$;

-- ── 3. Buat/ambil token pelacakan publik untuk sebuah order ───────────
CREATE OR REPLACE FUNCTION public.homecare_ensure_token(p_order_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tok TEXT;
BEGIN
  SELECT track_token INTO v_tok FROM public.homecare_orders WHERE id = p_order_id;
  IF v_tok IS NULL OR btrim(v_tok) = '' THEN
    v_tok := substr(md5(gen_random_uuid()::text || p_order_id::text), 1, 18);
    UPDATE public.homecare_orders SET track_token = v_tok WHERE id = p_order_id;
  END IF;
  RETURN v_tok;
END $$;

-- ── 4. Order aktif + posisi nakes → peta admin/operator ───────────────
CREATE OR REPLACE FUNCTION public.homecare_live_orders()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'order_number', o.order_number, 'patient_name', o.patient_name,
    'patient_address', o.patient_address, 'patient_phone', o.patient_phone,
    'service_type', o.service_type, 'status', o.status,
    'scheduled_date', o.scheduled_date, 'scheduled_time', o.scheduled_time,
    'lat', o.lat, 'lng', o.lng, 'track_token', o.track_token,
    'staff_id', o.staff_id, 'staff_name', COALESCE(s.staff_name, o.assigned_staff),
    'staff_phone', s.phone,
    'staff_lat', s.current_lat, 'staff_lng', s.current_lng, 'staff_loc_at', s.location_updated_at
  ) ORDER BY o.scheduled_date, o.scheduled_time), '[]'::jsonb)
  FROM public.homecare_orders o
  LEFT JOIN public.homecare_staff s ON s.id = o.staff_id
  WHERE COALESCE(o.status,'') NOT IN ('Selesai','Dibatalkan');
$$;

-- ── 5. Data pelacakan PUBLIK untuk pasien (via token; minim PII) ──────
CREATE OR REPLACE FUNCTION public.homecare_track_public(p_token TEXT)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'order_number', o.order_number, 'patient_name', split_part(COALESCE(o.patient_name,''),' ',1),
    'service_type', o.service_type, 'status', o.status,
    'scheduled_date', o.scheduled_date, 'scheduled_time', o.scheduled_time,
    'patient_lat', o.lat, 'patient_lng', o.lng,
    'staff_name', COALESCE(s.staff_name, o.assigned_staff), 'staff_phone', s.phone,
    'staff_lat', s.current_lat, 'staff_lng', s.current_lng, 'staff_loc_at', s.location_updated_at,
    'loc_fresh', (s.location_updated_at IS NOT NULL AND s.location_updated_at > now() - interval '3 minutes')
  )
  FROM public.homecare_orders o
  LEFT JOIN public.homecare_staff s ON s.id = o.staff_id
  WHERE o.track_token = p_token
  LIMIT 1;
$$;

-- ── 6. Grants ─────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.homecare_track_update(BIGINT,NUMERIC,NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.homecare_ensure_token(BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.homecare_live_orders() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.homecare_track_public(TEXT) TO anon, authenticated, service_role;

SELECT 'Home Care Maps siap — geolokasi + tracking GPS (admin·nakes·pasien)' AS status;
