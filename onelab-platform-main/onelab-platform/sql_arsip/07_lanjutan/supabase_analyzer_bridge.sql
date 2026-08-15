-- ══════════════════════════════════════════════════════════════════════
-- OneLab · LIS — JEMBATAN ALAT (Analyzer Bridge) untuk OneLab Connector
-- Alat lab bicara TCP mentah (ASTM/HL7) di LAN; cloud tak bisa raw-socket.
-- OneLab Connector (PC di lab) menjembatani: TCP alat ↔ HTTPS Supabase.
-- File ini menambah:
--   • analyzers: ip_address/tcp_port/conn_mode/conn_direction/last_seen_at
--   • analyzer_messages: pesan mentah masuk/keluar (staging sebelum di-parse)
--   • RPC: analyzer_config (connector baca daftar alat) · analyzer_ingest
--     (connector kirim pesan mentah) · analyzer_status (UI) ·
--     analyzer_pending_orders (dua-arah: order untuk dikirim ke alat)
-- Aman: connector menulis ke STAGING (analyzer_messages), BUKAN langsung ke
-- lab_results. Parse & match (mengisi hasil) tetap lewat alur bervalidasi manusia.
-- IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Kolom koneksi pada master alat ────────────────────────────────
ALTER TABLE public.analyzers
  ADD COLUMN IF NOT EXISTS ip_address     text,
  ADD COLUMN IF NOT EXISTS tcp_port       integer,
  ADD COLUMN IF NOT EXISTS conn_mode      text DEFAULT 'server',   -- server: connector listen, alat konek | client: connector konek ke alat
  ADD COLUMN IF NOT EXISTS conn_direction text DEFAULT 'oneway',   -- oneway: hasil masuk saja | twoway: + kirim order ke alat
  ADD COLUMN IF NOT EXISTS last_seen_at   timestamptz;

-- ── 2. Staging pesan alat (mentah) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analyzer_messages (
  id            bigserial PRIMARY KEY,
  analyzer_id   bigint,
  analyzer_code text,
  direction     text NOT NULL DEFAULT 'IN' CHECK (direction IN ('IN','OUT')),  -- IN: dari alat · OUT: ke alat
  protocol      text,                                                          -- ASTM | HL7
  raw_text      text,
  status        text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PARSED','MATCHED','ERROR','SENT')),
  parse_note    text,
  sample_barcode text,
  received_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anmsg_status ON public.analyzer_messages(status, received_at);
CREATE INDEX IF NOT EXISTS idx_anmsg_analyzer ON public.analyzer_messages(analyzer_id, received_at DESC);
ALTER TABLE public.analyzer_messages DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.analyzer_messages TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.analyzer_messages_id_seq TO anon, authenticated, service_role;

-- ── 3. Connector membaca konfigurasi alat aktif (sumber kebenaran = DB) ─
CREATE OR REPLACE FUNCTION public.analyzer_config()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'code', kode_alat, 'name', nama_alat, 'category', kategori,
    'ip', ip_address, 'port', tcp_port, 'mode', COALESCE(conn_mode,'server'),
    'direction', COALESCE(conn_direction,'oneway'), 'protocol', COALESCE(integrasi_protocol,'ASTM')
  ) ORDER BY nama_alat), '[]'::jsonb)
  FROM public.analyzers
  WHERE COALESCE(integrasi_aktif,false) AND COALESCE(status,'Aktif') <> 'Rusak'
    AND ip_address IS NOT NULL AND tcp_port IS NOT NULL;
$$;

-- ── 4. Connector mengirim pesan mentah (masuk/keluar) + update last_seen ─
CREATE OR REPLACE FUNCTION public.analyzer_ingest(p JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT; v_aid BIGINT;
BEGIN
  SELECT id INTO v_aid FROM public.analyzers
   WHERE (NULLIF(p->>'analyzer_id','')::bigint = id) OR (kode_alat = p->>'analyzer_code') LIMIT 1;
  INSERT INTO public.analyzer_messages(analyzer_id, analyzer_code, direction, protocol, raw_text, status)
  VALUES (v_aid, p->>'analyzer_code',
          CASE WHEN upper(COALESCE(p->>'direction','IN'))='OUT' THEN 'OUT' ELSE 'IN' END,
          upper(NULLIF(p->>'protocol','')), p->>'raw_text',
          CASE WHEN upper(COALESCE(p->>'direction','IN'))='OUT' THEN 'SENT' ELSE 'RECEIVED' END)
  RETURNING id INTO v_id;
  IF v_aid IS NOT NULL THEN
    UPDATE public.analyzers SET last_seen_at = now() WHERE id = v_aid;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'analyzer_id', v_aid);
END $$;

-- ── 5. Status alat untuk UI (last-seen + hitung pesan) ───────────────
CREATE OR REPLACE FUNCTION public.analyzer_status()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'code', a.kode_alat, 'name', a.nama_alat, 'category', a.kategori,
    'ip', a.ip_address, 'port', a.tcp_port, 'mode', a.conn_mode, 'direction', a.conn_direction,
    'protocol', a.integrasi_protocol, 'active', a.integrasi_aktif, 'last_seen_at', a.last_seen_at,
    'online', (a.last_seen_at IS NOT NULL AND a.last_seen_at > now() - interval '5 minutes'),
    'msg_24h', (SELECT count(*) FROM public.analyzer_messages m WHERE m.analyzer_id=a.id AND m.received_at > now()-interval '24 hours'),
    'unprocessed', (SELECT count(*) FROM public.analyzer_messages m WHERE m.analyzer_id=a.id AND m.status='RECEIVED')
  ) ORDER BY a.nama_alat), '[]'::jsonb)
  FROM public.analyzers a WHERE COALESCE(a.integrasi_aktif,false);
$$;

-- ── 6. Dua-arah: order yang perlu dikirim ke alat (host query response) ─
--   Sampel yang ditugaskan ke alat ini & belum selesai → connector menyusun
--   pesan order (ASTM O record / HL7 ORM). Tes diambil dari product_items via
--   host_code. (Struktur ringkas; connector merakit sesuai protokol.)
CREATE OR REPLACE FUNCTION public.analyzer_pending_orders(p_analyzer_id BIGINT)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'barcode', s.barcode, 'patient_name', s.patient_name, 'sampel_type', s.sampel_type,
    'product_name', s.product_name,
    'tests', (SELECT COALESCE(jsonb_agg(pi.host_code) FILTER (WHERE pi.host_code IS NOT NULL), '[]'::jsonb)
                FROM public.product_items pi WHERE pi.product_id = s.product_id)
  )), '[]'::jsonb)
  FROM public.lab_samples s
  WHERE s.analyzer_id = p_analyzer_id AND s.status IN ('Pending','In Process');
$$;

GRANT EXECUTE ON FUNCTION public.analyzer_config() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.analyzer_ingest(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.analyzer_status() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.analyzer_pending_orders(BIGINT) TO anon, authenticated, service_role;

SELECT 'Analyzer Bridge siap — analyzers(ip/port/mode) + analyzer_messages + RPC connector' AS status;
