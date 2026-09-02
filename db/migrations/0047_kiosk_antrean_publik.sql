-- ══════════════════════════════════════════════════════════════════
-- KIOSK & DISPLAY ANTREAN PUBLIK — KLIE N TERBATAS DARI HIS
--
-- Kiosk dan TV bukan sumber data terpisah. Keduanya hanya mengakses
-- queue_tickets milik HIS lewat Edge Function server-side. Browser publik
-- tidak memperoleh izin tabel atau kredensial service-role.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.queue_tickets
  ADD COLUMN IF NOT EXISTS issued_via text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS kiosk_id text;

ALTER TABLE public.queue_tickets
  DROP CONSTRAINT IF EXISTS queue_tickets_issued_via_check;
ALTER TABLE public.queue_tickets
  ADD CONSTRAINT queue_tickets_issued_via_check
  CHECK (issued_via IN ('staff', 'kiosk'));

CREATE INDEX IF NOT EXISTS idx_queue_tickets_kiosk_harian
  ON public.queue_tickets(queue_date, issued_via, service_type, seq);

COMMENT ON COLUMN public.queue_tickets.issued_via IS
  'Asal penerbitan tiket: staff (HIS) atau kiosk (perangkat publik).';
COMMENT ON COLUMN public.queue_tickets.kiosk_id IS
  'Identitas perangkat/host kiosk, tanpa identitas pasien.';

-- Sebagian instalasi HIS sudah memiliki queue_tickets dari fase awal tetapi
-- belum pernah memasang migrasi loket 0032. Kiosk tetap harus bisa dipasang
-- tanpa menuntut operator menebak dependensi historisnya.
CREATE TABLE IF NOT EXISTS public.queue_config (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layanan       text UNIQUE NOT NULL,
  prefiks       text NOT NULL,
  kuota_harian  integer NOT NULL DEFAULT 0,
  reset_harian  boolean NOT NULL DEFAULT true,
  suara_aktif   boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Konfigurasi awal dipasang sebagai bagian dari HIS. Operator dapat mengubah
-- prefiks/kuota melalui konfigurasi antrean; kiosk tidak menyimpan daftar
-- layanan atau nomor sendiri.
INSERT INTO public.queue_config (layanan, prefiks)
VALUES
  ('Umum',         'U'),
  ('Laboratorium', 'L'),
  ('MCU',          'M'),
  ('Sanctuary',    'S'),
  ('Spesialis',    'P'),
  ('Farmasi',      'F')
ON CONFLICT (layanan) DO NOTHING;

-- Hanya Edge Function dengan JWT service_role yang dapat menjalankan fungsi
-- ini. Tidak ada grant untuk anon/authenticated: petugas memakai
-- issue_queue_ticket yang terautentikasi seperti biasa.
CREATE OR REPLACE FUNCTION public.issue_kiosk_queue_ticket(
  p_service text,
  p_kiosk_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seq int;
  v_prefix text;
  v_no text;
  v_ahead int;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Penerbitan kiosk hanya melalui layanan server.';
  END IF;

  SELECT prefiks INTO v_prefix
    FROM public.queue_config
   WHERE layanan = p_service;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Layanan kiosk tidak dikonfigurasi.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_service || current_date::text));
  SELECT coalesce(max(seq), 0) + 1 INTO v_seq
    FROM public.queue_tickets
   WHERE queue_date = current_date AND service_type = p_service;

  v_no := upper(coalesce(nullif(v_prefix, ''), 'A')) || lpad(v_seq::text, 3, '0');
  INSERT INTO public.queue_tickets
    (queue_date, queue_number, seq, service_type, patient_name, status,
     issued_via, kiosk_id, updated_at)
  VALUES
    (current_date, v_no, v_seq, p_service, NULL, 'Menunggu',
     'kiosk', nullif(left(trim(coalesce(p_kiosk_id, '')), 80), ''), now());

  SELECT count(*)::int INTO v_ahead
    FROM public.queue_tickets
   WHERE queue_date = current_date
     AND service_type = p_service
     AND status = 'Menunggu'
     AND seq < v_seq;

  RETURN jsonb_build_object(
    'ok', true, 'queue_number', v_no, 'seq', v_seq, 'ahead', v_ahead
  );
END $$;

REVOKE ALL ON FUNCTION public.issue_kiosk_queue_ticket(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_kiosk_queue_ticket(text, text) TO service_role;
