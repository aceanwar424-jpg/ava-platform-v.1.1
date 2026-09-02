-- ══════════════════════════════════════════════════════════════════
-- 0048 — ANTREAN MULTI-TENANT & PERANGKAT PUBLIK
--
-- Prasyarat: 0004 (tenant), 0032 (loket), 0047 (kiosk publik).
-- Aman dijalankan berulang. Data lama dipetakan ke tenant lokal agar tidak
-- berpindah diam-diam. Jalankan di staging terlebih dahulu dan verifikasi
-- jumlah tiket sebelum/selepas migrasi.
-- ══════════════════════════════════════════════════════════════════

-- Klaim tenant pada JWT cloud diprioritaskan; desktop/offline tetap memakai
-- tenant lokal. Middleware/auth harus menerbitkan claim tenant_id yang valid.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE v_claim text;
BEGIN
  v_claim := nullif(auth.jwt() ->> 'tenant_id', '');
  RETURN coalesce(
    nullif(current_setting('app.tenant_id', true), '')::uuid,
    CASE WHEN v_claim ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         THEN v_claim::uuid END,
    '00000000-0000-0000-0000-000000000001'::uuid
  );
END $$;

-- 1. Tambahkan tenant pada seluruh entitas antrean dan pertahankan data lama.
ALTER TABLE public.queue_tickets ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.queue_config ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.queue_counters ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.queue_log ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.queue_tickets SET tenant_id = public.current_tenant_id() WHERE tenant_id IS NULL;
UPDATE public.queue_config SET tenant_id = public.current_tenant_id() WHERE tenant_id IS NULL;
UPDATE public.queue_counters SET tenant_id = public.current_tenant_id() WHERE tenant_id IS NULL;
UPDATE public.queue_log l SET tenant_id = t.tenant_id FROM public.queue_tickets t
 WHERE l.ticket_id = t.id AND l.tenant_id IS NULL;
UPDATE public.queue_log SET tenant_id = public.current_tenant_id() WHERE tenant_id IS NULL;

ALTER TABLE public.queue_tickets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.queue_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.queue_counters ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.queue_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.queue_tickets ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.queue_config ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.queue_counters ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.queue_log ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.queue_tickets DROP CONSTRAINT IF EXISTS queue_tickets_tenant_id_fkey;
ALTER TABLE public.queue_config DROP CONSTRAINT IF EXISTS queue_config_tenant_id_fkey;
ALTER TABLE public.queue_counters DROP CONSTRAINT IF EXISTS queue_counters_tenant_id_fkey;
ALTER TABLE public.queue_log DROP CONSTRAINT IF EXISTS queue_log_tenant_id_fkey;
ALTER TABLE public.queue_tickets ADD CONSTRAINT queue_tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.queue_config ADD CONSTRAINT queue_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.queue_counters ADD CONSTRAINT queue_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.queue_log ADD CONSTRAINT queue_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Kode loket dan layanan hanya unik dalam satu tenant.
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.queue_config'::regclass AND contype = 'u' LOOP
    EXECUTE format('ALTER TABLE public.queue_config DROP CONSTRAINT %I', c.conname);
  END LOOP;
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.queue_counters'::regclass AND contype = 'u' LOOP
    EXECUTE format('ALTER TABLE public.queue_counters DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.queue_config ADD CONSTRAINT queue_config_tenant_layanan_key UNIQUE (tenant_id, layanan);
ALTER TABLE public.queue_counters ADD CONSTRAINT queue_counters_tenant_kode_key UNIQUE (tenant_id, kode);
CREATE INDEX IF NOT EXISTS idx_queue_ticket_tenant_harian ON public.queue_tickets (tenant_id, queue_date, service_type, status, seq);
CREATE INDEX IF NOT EXISTS idx_queue_counter_tenant_layanan ON public.queue_counters (tenant_id, layanan, is_active);
CREATE INDEX IF NOT EXISTS idx_queue_log_tenant_ticket ON public.queue_log (tenant_id, ticket_id, created_at);

-- 2. Daftar perangkat publik dan bucket rate-limit persisten.
CREATE TABLE IF NOT EXISTS public.queue_public_devices (
  device_id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  display_name text NOT NULL,
  kiosk_origin text,
  display_origin text,
  allowed_services text[] NOT NULL DEFAULT '{}',
  max_issues_per_minute integer NOT NULL DEFAULT 6 CHECK (max_issues_per_minute BETWEEN 1 AND 60),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.queue_public_rate_windows (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  device_id text NOT NULL REFERENCES public.queue_public_devices(device_id) ON DELETE CASCADE,
  service_type text NOT NULL,
  window_started timestamptz NOT NULL,
  issued_count integer NOT NULL DEFAULT 0 CHECK (issued_count >= 0),
  PRIMARY KEY (tenant_id, device_id, service_type, window_started)
);
ALTER TABLE public.queue_public_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_public_rate_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.queue_public_devices, public.queue_public_rate_windows FROM anon, authenticated;

INSERT INTO public.queue_public_devices
  (device_id, tenant_id, display_name, kiosk_origin, display_origin, allowed_services)
VALUES
  ('kiosk.avahealth.sbs', public.current_tenant_id(), 'Kiosk utama AVA',
   'https://kiosk.avahealth.sbs', 'https://antrian.avahealth.sbs',
   ARRAY['Umum','Laboratorium','MCU','Sanctuary','Spesialis','Farmasi'])
ON CONFLICT (device_id) DO NOTHING;

-- Context ini satu-satunya cara Edge Function memperoleh tenant perangkat.
CREATE OR REPLACE FUNCTION public.queue_public_device_context(p_device_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.queue_public_devices%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Perangkat publik hanya dapat dibaca layanan server'; END IF;
  SELECT * INTO d FROM public.queue_public_devices WHERE device_id = trim(p_device_id) AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perangkat antrean tidak terdaftar atau nonaktif'; END IF;
  RETURN jsonb_build_object('tenant_id', d.tenant_id, 'device_id', d.device_id,
    'allowed_services', d.allowed_services, 'kiosk_origin', d.kiosk_origin,
    'display_origin', d.display_origin);
END $$;

-- 3. Terbit tiket publik bersifat atomik: perangkat, layanan, limit, tenant,
-- nomor harian, dan tiket dipastikan di satu transaksi.
CREATE OR REPLACE FUNCTION public.issue_public_queue_ticket(p_device_id text, p_service text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.queue_public_devices%ROWTYPE; v_prefix text; v_seq integer;
  v_number text; v_ahead integer; v_issued integer; v_window timestamptz := date_trunc('minute', now());
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Penerbitan kiosk hanya melalui layanan server'; END IF;
  SELECT * INTO d FROM public.queue_public_devices WHERE device_id = trim(p_device_id) AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perangkat antrean tidak terdaftar atau nonaktif'; END IF;
  IF NOT (trim(p_service) = ANY(d.allowed_services)) THEN RAISE EXCEPTION 'Layanan kiosk tidak diizinkan untuk perangkat ini'; END IF;
  SELECT prefiks INTO v_prefix FROM public.queue_config WHERE tenant_id = d.tenant_id AND layanan = trim(p_service);
  IF NOT FOUND THEN RAISE EXCEPTION 'Layanan kiosk belum dikonfigurasi untuk tenant ini'; END IF;
  INSERT INTO public.queue_public_rate_windows (tenant_id, device_id, service_type, window_started, issued_count)
  VALUES (d.tenant_id, d.device_id, trim(p_service), v_window, 1)
  ON CONFLICT (tenant_id, device_id, service_type, window_started) DO UPDATE
    SET issued_count = public.queue_public_rate_windows.issued_count + 1
    WHERE public.queue_public_rate_windows.issued_count < d.max_issues_per_minute
  RETURNING issued_count INTO v_issued;
  IF v_issued IS NULL THEN RAISE EXCEPTION 'Batas penerbitan tiket perangkat tercapai, coba lagi satu menit'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(d.tenant_id::text || '|' || trim(p_service) || '|' || current_date::text));
  SELECT coalesce(max(seq), 0) + 1 INTO v_seq FROM public.queue_tickets
   WHERE tenant_id = d.tenant_id AND queue_date = current_date AND service_type = trim(p_service);
  v_number := upper(coalesce(nullif(v_prefix, ''), 'A')) || lpad(v_seq::text, 3, '0');
  INSERT INTO public.queue_tickets (tenant_id, queue_date, queue_number, seq, service_type, patient_name, status, issued_via, kiosk_id, updated_at)
  VALUES (d.tenant_id, current_date, v_number, v_seq, trim(p_service), NULL, 'Menunggu', 'kiosk', d.device_id, now());
  SELECT count(*)::int INTO v_ahead FROM public.queue_tickets
   WHERE tenant_id = d.tenant_id AND queue_date = current_date AND service_type = trim(p_service)
     AND status = 'Menunggu' AND seq < v_seq;
  RETURN jsonb_build_object('ok', true, 'queue_number', v_number, 'seq', v_seq, 'ahead', v_ahead);
END $$;

-- Pertahankan nama RPC lama agar kiosk versi sebelumnya gagal aman, bukan
-- menerbitkan tiket lintas-tenant.
DROP FUNCTION IF EXISTS public.issue_kiosk_queue_ticket(text, text);
CREATE OR REPLACE FUNCTION public.issue_kiosk_queue_ticket(p_service text, p_kiosk_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Gunakan issue_public_queue_ticket dengan perangkat terdaftar';
END $$;
REVOKE ALL ON FUNCTION public.issue_public_queue_ticket(text, text), public.queue_public_device_context(text), public.issue_kiosk_queue_ticket(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_public_queue_ticket(text, text), public.queue_public_device_context(text) TO service_role;

-- 4. Jalur staf juga wajib terisolasi tenant.
CREATE OR REPLACE FUNCTION public.issue_queue_ticket(p_service text, p_patient text DEFAULT NULL, p_admission_id bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_seq integer; v_prefix text; v_no text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_tenant::text || '|' || p_service || '|' || current_date::text));
  SELECT coalesce(max(seq),0)+1 INTO v_seq FROM public.queue_tickets
   WHERE tenant_id = v_tenant AND queue_date = current_date AND service_type = p_service;
  SELECT prefiks INTO v_prefix FROM public.queue_config WHERE tenant_id = v_tenant AND layanan = p_service;
  v_prefix := coalesce(nullif(v_prefix, ''), upper(left(regexp_replace(p_service,'[^A-Za-z]','','g'),1)), 'A');
  v_no := v_prefix || lpad(v_seq::text, 3, '0');
  INSERT INTO public.queue_tickets (tenant_id, queue_date, queue_number, seq, service_type, admission_id, patient_name, status, updated_at)
  VALUES (v_tenant, current_date, v_no, v_seq, p_service, p_admission_id, p_patient, 'Menunggu', now());
  RETURN jsonb_build_object('ok',true,'queue_number',v_no,'seq',v_seq);
END $$;

-- Konsol loket memakai SECURITY DEFINER untuk transaksi atomik; karena itu
-- setiap fungsi harus menyaring tenant secara eksplisit, bukan mengandalkan
-- RLS pemanggil yang dibypass oleh SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.queue_panggil_berikutnya(p_counter_kode text, p_oleh text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_c record; v_t record;
BEGIN
  SELECT * INTO v_c FROM public.queue_counters WHERE tenant_id = v_tenant AND kode = p_counter_kode AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Loket tidak dikenal atau sedang nonaktif.'); END IF;
  SELECT * INTO v_t FROM public.queue_tickets WHERE tenant_id = v_tenant AND queue_date = current_date
    AND service_type = v_c.layanan AND status = 'Menunggu'
    ORDER BY public.queue_bobot_prioritas(prioritas), seq FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('kosong', true, 'pesan', 'Tidak ada antrean menunggu untuk ' || v_c.layanan || '.'); END IF;
  UPDATE public.queue_tickets SET status = 'Dipanggil', counter = v_c.nama, counter_id = v_c.id,
    called_at = now(), jml_panggil = jml_panggil + 1, updated_at = now()
    WHERE id = v_t.id AND tenant_id = v_tenant;
  INSERT INTO public.queue_log (tenant_id, ticket_id, tindakan, counter, oleh) VALUES (v_tenant, v_t.id, 'panggil', v_c.nama, p_oleh);
  RETURN jsonb_build_object('ok', true, 'id', v_t.id, 'nomor', v_t.queue_number, 'pasien', v_t.patient_name,
    'prioritas', v_t.prioritas, 'layanan', v_c.layanan, 'loket', v_c.nama, 'ruang', v_c.ruang, 'panggilan_ke', v_t.jml_panggil + 1);
END $$;

CREATE OR REPLACE FUNCTION public.queue_panggil_ulang(p_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_t record;
BEGIN
  UPDATE public.queue_tickets SET called_at = now(), jml_panggil = jml_panggil + 1, updated_at = now()
    WHERE id = p_id AND tenant_id = v_tenant AND status IN ('Dipanggil', 'Menunggu') RETURNING * INTO v_t;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Tiket tidak dalam keadaan bisa dipanggil ulang.'); END IF;
  INSERT INTO public.queue_log (tenant_id, ticket_id, tindakan, counter, oleh) VALUES (v_tenant, p_id, 'panggil_ulang', v_t.counter, p_oleh);
  RETURN jsonb_build_object('ok', true, 'nomor', v_t.queue_number, 'pasien', v_t.patient_name, 'loket', v_t.counter, 'panggilan_ke', v_t.jml_panggil);
END $$;

CREATE OR REPLACE FUNCTION public.queue_lewati(p_id bigint, p_alasan text DEFAULT NULL, p_oleh text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_t record;
BEGIN
  UPDATE public.queue_tickets SET status = 'Lewat', dilewati_pada = now(), updated_at = now(), catatan = coalesce(p_alasan, catatan)
    WHERE id = p_id AND tenant_id = v_tenant AND status IN ('Dipanggil', 'Menunggu') RETURNING * INTO v_t;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Tiket tidak dalam keadaan bisa dilewati.'); END IF;
  INSERT INTO public.queue_log (tenant_id, ticket_id, tindakan, counter, oleh, catatan) VALUES (v_tenant, p_id, 'lewati', v_t.counter, p_oleh, p_alasan);
  RETURN jsonb_build_object('ok', true, 'nomor', v_t.queue_number);
END $$;

CREATE OR REPLACE FUNCTION public.queue_kembalikan(p_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_t record;
BEGIN
  UPDATE public.queue_tickets SET status = 'Menunggu', dilewati_pada = NULL, updated_at = now()
    WHERE id = p_id AND tenant_id = v_tenant AND status = 'Lewat' RETURNING * INTO v_t;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Tiket ini tidak sedang terlewat.'); END IF;
  INSERT INTO public.queue_log (tenant_id, ticket_id, tindakan, oleh) VALUES (v_tenant, p_id, 'kembalikan', p_oleh);
  RETURN jsonb_build_object('ok', true, 'nomor', v_t.queue_number);
END $$;

CREATE OR REPLACE FUNCTION public.queue_pindah(p_id bigint, p_counter_tujuan text, p_oleh text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_c record; v_t record;
BEGIN
  SELECT * INTO v_c FROM public.queue_counters WHERE tenant_id = v_tenant AND kode = p_counter_tujuan AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Loket tujuan tidak dikenal atau nonaktif.'); END IF;
  UPDATE public.queue_tickets SET pindah_dari = counter, counter = v_c.nama, counter_id = v_c.id,
    service_type = v_c.layanan, status = 'Menunggu', updated_at = now()
    WHERE id = p_id AND tenant_id = v_tenant RETURNING * INTO v_t;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Tiket tidak ditemukan.'); END IF;
  INSERT INTO public.queue_log (tenant_id, ticket_id, tindakan, counter, oleh, catatan)
    VALUES (v_tenant, p_id, 'pindah', v_c.nama, p_oleh, 'dari ' || coalesce(v_t.pindah_dari, '-'));
  RETURN jsonb_build_object('ok', true, 'nomor', v_t.queue_number, 'loket_baru', v_c.nama);
END $$;

-- Papan internal tidak boleh dapat dibaca anonim karena masih berisi nama pasien.
CREATE OR REPLACE VIEW public.queue_papan WITH (security_invoker = true) AS
SELECT t.id, t.tenant_id, t.queue_date, t.queue_number, t.seq, t.service_type,
  t.patient_name, t.status, t.prioritas, t.counter, t.counter_id, t.called_at,
  t.served_at, t.jml_panggil, t.dilewati_pada, t.pindah_dari,
  public.queue_bobot_prioritas(t.prioritas) AS bobot, c.ruang
FROM public.queue_tickets t
LEFT JOIN public.queue_counters c ON c.id = t.counter_id AND c.tenant_id = t.tenant_id
WHERE t.tenant_id = public.current_tenant_id() AND t.queue_date = current_date;
REVOKE ALL ON public.queue_papan FROM anon;
GRANT SELECT ON public.queue_papan TO authenticated, service_role;

-- 5. RLS: browser staf hanya melihat antrean tenant dari JWT/sesi aktif.
ALTER TABLE public.queue_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_log ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['queue_tickets','queue_config','queue_counters','queue_log'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_isolation', t);
    EXECUTE format('CREATE POLICY %I ON public.%I USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())', t || '_tenant_isolation', t);
  END LOOP;
END $$;

COMMENT ON TABLE public.queue_public_devices IS 'Registry perangkat kiosk/display. Secret tidak disimpan di browser.';
COMMENT ON TABLE public.queue_public_rate_windows IS 'Rate-limit penerbitan tiket publik per tenant, perangkat, layanan, dan menit.';
