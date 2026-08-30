-- ══════════════════════════════════════════════════════════════════
-- ANTRIAN: LOKET, PRIORITAS, DAN TINDAKAN PANGGILAN
--
-- Sistem antrian yang ada baru bisa menerbitkan nomor dan menandainya
-- "Dipanggil". Yang belum ada justru pekerjaan sehari-harinya di loket:
--
--   - Tidak ada definisi loket. "counter" hanyalah teks bebas, sehingga
--     dua petugas bisa mengetik "Loket 1" dan "loket1" dan sistem
--     menganggapnya berbeda.
--   - Tidak ada prioritas. Ibu hamil, lansia, disabilitas, dan kasus cito
--     mengantre di belakang seperti yang lain — padahal dokumen
--     arsitektur (Bab 5.2) mewajibkannya.
--   - Tidak ada panggil-ulang, lewati, atau pindah loket. Pasien yang
--     tidak muncul saat dipanggil menyumbat antrean, karena satu-satunya
--     jalan maju adalah menandainya selesai (padahal ia tidak dilayani)
--     atau membiarkannya menggantung.
--   - Pemanggilan tidak tercatat. Ketika pasien protes "saya tidak pernah
--     dipanggil", tidak ada yang bisa diperiksa.
--
-- Migrasi ini menambahkan keempatnya.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. LOKET ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.queue_counters (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode        text UNIQUE NOT NULL,          -- LOKET-1, POLI-UMUM, FARMASI
  nama        text NOT NULL,
  layanan     text NOT NULL,                 -- cocok dengan queue_tickets.service_type
  prefiks     text,                          -- huruf depan nomor; NULL = dari nama layanan
  ruang       text,                          -- keterangan lokasi fisik
  urutan      integer NOT NULL DEFAULT 100,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_counters_layanan
  ON public.queue_counters (layanan, is_active);

COMMENT ON COLUMN public.queue_counters.layanan IS
  'Harus sama persis dengan queue_tickets.service_type. Loket hanya '
  'memanggil tiket dari layanan yang sama.';


-- ── 2. PENGATURAN ANTREAN PER LAYANAN ────────────────────────────
-- id sengaja ada meskipun layanan sudah unik: helper sbPatch() di
-- js/core/api.js selalu menyaring dengan ?id=eq.<nilai>. Tabel tanpa
-- kolom id tidak bisa disunting lewat helper itu, dan menuliskan
-- pengecualian di sisi klien hanya memindahkan masalahnya.
CREATE TABLE IF NOT EXISTS public.queue_config (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layanan       text UNIQUE NOT NULL,
  prefiks       text NOT NULL,
  kuota_harian  integer NOT NULL DEFAULT 0,  -- 0 = tanpa batas
  reset_harian  boolean NOT NULL DEFAULT true,
  suara_aktif   boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Nilai awal diturunkan dari layanan yang SUDAH dipakai tiket yang ada,
-- bukan daftar tebakan. Instalasi yang belum punya tiket tidak mendapat
-- baris apa pun — dan itu benar: belum ada layanan yang perlu diatur.
INSERT INTO public.queue_config (layanan, prefiks)
SELECT DISTINCT service_type,
       upper(left(regexp_replace(service_type, '[^A-Za-z]', '', 'g'), 1))
  FROM public.queue_tickets
 WHERE service_type IS NOT NULL AND service_type <> ''
ON CONFLICT (layanan) DO NOTHING;


-- ── 3. KOLOM BARU PADA TIKET ─────────────────────────────────────
ALTER TABLE public.queue_tickets
  ADD COLUMN IF NOT EXISTS prioritas      text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS counter_id     bigint REFERENCES public.queue_counters(id),
  ADD COLUMN IF NOT EXISTS jml_panggil    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dilewati_pada  timestamptz,
  ADD COLUMN IF NOT EXISTS pindah_dari    text,
  ADD COLUMN IF NOT EXISTS catatan        text;

COMMENT ON COLUMN public.queue_tickets.prioritas IS
  'cito | lansia | hamil | disabilitas | normal. Urutan panggil mengikuti '
  'bobot di queue_bobot_prioritas(), bukan urutan abjad.';


-- Bobot prioritas ditulis sebagai fungsi, bukan angka yang disebar di
-- banyak kueri. Mengubah kebijakan prioritas cukup di satu tempat.
CREATE OR REPLACE FUNCTION public.queue_bobot_prioritas(p text)
RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(p, 'normal'))
    WHEN 'cito'        THEN 0   -- gawat, didahulukan mutlak
    WHEN 'hamil'       THEN 1
    WHEN 'disabilitas' THEN 1
    WHEN 'lansia'      THEN 2
    ELSE 3
  END;
$$;


-- ── 4. JEJAK PEMANGGILAN ─────────────────────────────────────────
--
-- Tanpa ini, sengketa "saya tidak pernah dipanggil" tidak bisa diperiksa
-- sama sekali. Satu baris per tindakan, bukan hanya keadaan terakhir.
CREATE TABLE IF NOT EXISTS public.queue_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id  bigint NOT NULL REFERENCES public.queue_tickets(id) ON DELETE CASCADE,
  tindakan   text NOT NULL,       -- panggil | panggil_ulang | lewati | layani | selesai | pindah
  counter    text,
  oleh       text,
  catatan    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_log_ticket ON public.queue_log (ticket_id, created_at);


-- ══════════════════════════════════════════════════════════════════
-- 5. PANGGIL BERIKUTNYA
--
-- Mengambil satu tiket menunggu dengan prioritas tertinggi, lalu
-- menandainya dipanggil — dalam satu transaksi.
--
-- FOR UPDATE SKIP LOCKED dipakai supaya dua loket yang menekan tombol
-- pada detik yang sama tidak mendapat tiket yang sama. Tanpa itu, dua
-- petugas memanggil nomor yang sama ke ruang yang berbeda, dan pasiennya
-- yang bingung.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.queue_panggil_berikutnya(
  p_counter_kode text, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_c record; v_t record;
BEGIN
  SELECT * INTO v_c FROM public.queue_counters
   WHERE kode = p_counter_kode AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Loket tidak dikenal atau sedang nonaktif.');
  END IF;

  SELECT * INTO v_t
    FROM public.queue_tickets
   WHERE queue_date = current_date
     AND service_type = v_c.layanan
     AND status = 'Menunggu'
   ORDER BY public.queue_bobot_prioritas(prioritas), seq
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('kosong', true,
      'pesan', 'Tidak ada antrean menunggu untuk ' || v_c.layanan || '.');
  END IF;

  UPDATE public.queue_tickets
     SET status      = 'Dipanggil',
         counter     = v_c.nama,
         counter_id  = v_c.id,
         called_at   = now(),
         jml_panggil = jml_panggil + 1,
         updated_at  = now()
   WHERE id = v_t.id;

  INSERT INTO public.queue_log (ticket_id, tindakan, counter, oleh)
  VALUES (v_t.id, 'panggil', v_c.nama, p_oleh);

  RETURN jsonb_build_object(
    'ok', true, 'id', v_t.id,
    'nomor', v_t.queue_number, 'pasien', v_t.patient_name,
    'prioritas', v_t.prioritas, 'layanan', v_c.layanan,
    'loket', v_c.nama, 'ruang', v_c.ruang, 'panggilan_ke', 1);
END $$;

GRANT EXECUTE ON FUNCTION public.queue_panggil_berikutnya(text, text)
  TO authenticated, service_role;


-- ── 6. PANGGIL ULANG ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.queue_panggil_ulang(
  p_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t record;
BEGIN
  UPDATE public.queue_tickets
     SET called_at = now(), jml_panggil = jml_panggil + 1, updated_at = now()
   WHERE id = p_id AND status IN ('Dipanggil', 'Menunggu')
   RETURNING * INTO v_t;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tiket tidak dalam keadaan bisa dipanggil ulang.');
  END IF;

  INSERT INTO public.queue_log (ticket_id, tindakan, counter, oleh)
  VALUES (p_id, 'panggil_ulang', v_t.counter, p_oleh);

  RETURN jsonb_build_object('ok', true, 'nomor', v_t.queue_number,
    'pasien', v_t.patient_name, 'loket', v_t.counter,
    'panggilan_ke', v_t.jml_panggil);
END $$;

GRANT EXECUTE ON FUNCTION public.queue_panggil_ulang(bigint, text)
  TO authenticated, service_role;


-- ── 7. LEWATI ────────────────────────────────────────────────────
--
-- Tiket TIDAK dihapus dan tidak ditandai selesai. Pasien yang terlambat
-- masih bisa dipanggil kembali; menandainya "Selesai" akan mencatat
-- pelayanan yang tidak pernah terjadi.
CREATE OR REPLACE FUNCTION public.queue_lewati(
  p_id bigint, p_alasan text DEFAULT NULL, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t record;
BEGIN
  UPDATE public.queue_tickets
     SET status = 'Lewat', dilewati_pada = now(), updated_at = now(),
         catatan = coalesce(p_alasan, catatan)
   WHERE id = p_id AND status IN ('Dipanggil', 'Menunggu')
   RETURNING * INTO v_t;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tiket tidak dalam keadaan bisa dilewati.');
  END IF;

  INSERT INTO public.queue_log (ticket_id, tindakan, counter, oleh, catatan)
  VALUES (p_id, 'lewati', v_t.counter, p_oleh, p_alasan);

  RETURN jsonb_build_object('ok', true, 'nomor', v_t.queue_number);
END $$;

GRANT EXECUTE ON FUNCTION public.queue_lewati(bigint, text, text)
  TO authenticated, service_role;


-- ── 8. PANGGIL KEMBALI YANG TERLEWAT ─────────────────────────────
CREATE OR REPLACE FUNCTION public.queue_kembalikan(
  p_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t record;
BEGIN
  UPDATE public.queue_tickets
     SET status = 'Menunggu', dilewati_pada = NULL, updated_at = now()
   WHERE id = p_id AND status = 'Lewat'
   RETURNING * INTO v_t;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tiket ini tidak sedang berstatus terlewat.');
  END IF;

  INSERT INTO public.queue_log (ticket_id, tindakan, oleh)
  VALUES (p_id, 'kembalikan', p_oleh);

  RETURN jsonb_build_object('ok', true, 'nomor', v_t.queue_number);
END $$;

GRANT EXECUTE ON FUNCTION public.queue_kembalikan(bigint, text)
  TO authenticated, service_role;


-- ── 9. PINDAH LOKET ──────────────────────────────────────────────
--
-- Nomor antrean TIDAK berubah. Pasien sudah memegang kertas dengan nomor
-- itu; mengganti nomornya saat dipindah membuat pemanggilan berikutnya
-- tidak dikenali pasien yang bersangkutan.
CREATE OR REPLACE FUNCTION public.queue_pindah(
  p_id bigint, p_counter_tujuan text, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_c record; v_t record;
BEGIN
  SELECT * INTO v_c FROM public.queue_counters
   WHERE kode = p_counter_tujuan AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Loket tujuan tidak dikenal atau nonaktif.');
  END IF;

  UPDATE public.queue_tickets
     SET pindah_dari  = counter,
         counter      = v_c.nama,
         counter_id   = v_c.id,
         service_type = v_c.layanan,
         status       = 'Menunggu',
         updated_at   = now()
   WHERE id = p_id
   RETURNING * INTO v_t;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tiket tidak ditemukan.');
  END IF;

  INSERT INTO public.queue_log (ticket_id, tindakan, counter, oleh, catatan)
  VALUES (p_id, 'pindah', v_c.nama, p_oleh,
          'dari ' || coalesce(v_t.pindah_dari, '-'));

  RETURN jsonb_build_object('ok', true, 'nomor', v_t.queue_number,
    'loket_baru', v_c.nama);
END $$;

GRANT EXECUTE ON FUNCTION public.queue_pindah(bigint, text, text)
  TO authenticated, service_role;


-- ── 10. PAPAN ANTREAN ────────────────────────────────────────────
--
-- Satu sumber untuk konsol petugas, layar TV, dan kiosk. Tanpa ini tiap
-- layar menyusun kuerinya sendiri dan ketiganya bisa menampilkan urutan
-- yang berbeda pada saat yang sama.
CREATE OR REPLACE VIEW public.queue_papan AS
SELECT
  t.id, t.queue_date, t.queue_number, t.seq, t.service_type,
  t.patient_name, t.status, t.prioritas, t.counter, t.counter_id,
  t.called_at, t.served_at, t.jml_panggil, t.dilewati_pada, t.pindah_dari,
  public.queue_bobot_prioritas(t.prioritas) AS bobot,
  c.ruang
FROM public.queue_tickets t
LEFT JOIN public.queue_counters c ON c.id = t.counter_id
WHERE t.queue_date = current_date;

GRANT SELECT ON public.queue_papan TO anon, authenticated, service_role;
