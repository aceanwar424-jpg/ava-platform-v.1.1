-- ══════════════════════════════════════════════════════════════════
-- LIS — FLEBOTOMI, KELAYAKAN SPESIMEN, PME, DAN ARSIP SAMPEL
--
-- Empat menu LIS berstatus "ada" padahal modulnya nol panggilan data:
-- lis-phlebotomy, lis-kelayakan, lis-pme, lis-sample-archive.
--
-- Tiga menu LIS lain (analyzer, lot QC, nilai kritis) sudah punya
-- tabelnya — analyzers, analyzer_messages, lab_qc_lots, lab_qc_runs,
-- critical_value_notifications — dan hanya perlu disambungkan.
--
-- ── SATU HAL YANG SENGAJA TIDAK SAYA ISI ──────────────────────────
-- Tabel kriteria penolakan spesimen dan tabung dibuat KOSONG, bukan
-- diisi contoh. Ambang penolakan (berapa plus hemolisis yang menolak
-- kalium, berapa jam sampel masih layak) adalah kebijakan tiap
-- laboratorium — bergantung pada analyzer, metode, dan validasi
-- internalnya. Mengisinya dengan angka yang terdengar masuk akal akan
-- membuat petugas menolak atau menerima sampel berdasarkan ambang yang
-- tidak pernah divalidasi siapa pun di lab ini.
--
-- Yang dibangun adalah tempatnya, beserta jejak siapa memutuskan apa.
-- Isinya diputuskan penanggung jawab lab.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. KATALOG TABUNG & URUTAN PENGAMBILAN ────────────────────────
-- Urutan pengambilan penting bukan karena kerapian: aditif dari tabung
-- sebelumnya yang terbawa (carryover) mengubah hasil tabung berikutnya
-- — EDTA yang masuk ke tabung kimia menaikkan kalium dan menurunkan
-- kalsium. Karena itu urutan disimpan sebagai angka, bukan catatan.
CREATE TABLE IF NOT EXISTS public.lab_tabung (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode          text UNIQUE NOT NULL,
  nama          text NOT NULL,
  warna_tutup   text,
  aditif        text,
  urutan_ambil  int,                    -- 1 = diambil paling dulu
  volume_ml     numeric,
  jml_bolak_balik int,                  -- inversi setelah pengambilan
  departemen    text,
  suhu_simpan   text,
  stabil_jam    numeric,
  catatan       text,
  aktif         boolean DEFAULT true,
  created_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tabung_urutan ON public.lab_tabung(urutan_ambil);

-- ── 2. KRITERIA PENOLAKAN SPESIMEN ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_kriteria_tolak (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode         text UNIQUE NOT NULL,
  nama         text NOT NULL,
  kategori     text,                    -- Praanalitik | Identitas | Volume | Transport
  tindakan     text,                    -- apa yang harus dilakukan petugas
  -- Sebagian kriteria hanya berlaku untuk pemeriksaan tertentu:
  -- hemolisis menolak kalium tapi tidak menolak hemoglobin.
  berlaku_untuk text,
  wajib_ambil_ulang boolean DEFAULT true,
  aktif        boolean DEFAULT true,
  ditetapkan_oleh text,
  tgl_berlaku  date,
  created_at   timestamp DEFAULT now()
);

-- ── 3. KOLOM TAMBAHAN PADA lab_samples ────────────────────────────
-- Ditambahkan ke tabel yang sudah ada, bukan bikin tabel sampel kedua.
ALTER TABLE public.lab_samples
  -- Flebotomi
  ADD COLUMN IF NOT EXISTS tabung_id        bigint,
  ADD COLUMN IF NOT EXISTS lokasi_tusuk     text,
  ADD COLUMN IF NOT EXISTS jml_percobaan    int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS puasa            boolean,
  -- Kelayakan
  ADD COLUMN IF NOT EXISTS diverifikasi_oleh text,
  ADD COLUMN IF NOT EXISTS diverifikasi_at  timestamp,
  ADD COLUMN IF NOT EXISTS kriteria_tolak_id bigint,
  ADD COLUMN IF NOT EXISTS alasan_tolak     text,
  ADD COLUMN IF NOT EXISTS diambil_ulang    boolean DEFAULT false,
  -- Arsip & retensi
  ADD COLUMN IF NOT EXISTS lokasi_arsip     text,
  ADD COLUMN IF NOT EXISTS rak              text,
  ADD COLUMN IF NOT EXISTS boks             text,
  ADD COLUMN IF NOT EXISTS posisi           text,
  ADD COLUMN IF NOT EXISTS diarsipkan_at    timestamp,
  ADD COLUMN IF NOT EXISTS simpan_sampai    date,
  ADD COLUMN IF NOT EXISTS dimusnahkan_at   timestamp,
  ADD COLUMN IF NOT EXISTS dimusnahkan_oleh text,
  ADD COLUMN IF NOT EXISTS berita_acara_musnah text;

CREATE INDEX IF NOT EXISTS idx_sample_arsip
  ON public.lab_samples(simpan_sampai)
  WHERE dimusnahkan_at IS NULL;

-- ── 4. PME / UJI PROFISIENSI ──────────────────────────────────────
-- Pemantapan Mutu Eksternal: lab mengirim sampel yang nilainya sudah
-- diketahui penyelenggara, lalu hasilnya dibandingkan. Ini syarat
-- akreditasi ISO 15189, jadi jejaknya harus utuh — termasuk siklus yang
-- hasilnya buruk.
CREATE TABLE IF NOT EXISTS public.lab_pme_program (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode         text UNIQUE NOT NULL,
  nama         text NOT NULL,
  penyelenggara text,                   -- BBLK, RIQAS, dsb
  lingkup      text,                    -- Kimia Klinik, Hematologi, dsb
  frekuensi    text,                    -- Bulanan | Per siklus | Tahunan
  no_peserta   text,
  status       text DEFAULT 'Aktif',
  created_at   timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_pme_siklus (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_id   bigint REFERENCES public.lab_pme_program(id) ON DELETE CASCADE,
  kode_siklus  text NOT NULL,
  tgl_kirim_sampel date,
  batas_kirim_hasil date,
  tgl_hasil    date,
  -- Belum Dikirim | Terkirim | Menunggu Hasil | Selesai
  status       text DEFAULT 'Belum Dikirim',
  penanggung_jawab text,
  catatan      text,
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now(),
  UNIQUE (program_id, kode_siklus)
);

CREATE TABLE IF NOT EXISTS public.lab_pme_hasil (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  siklus_id    bigint REFERENCES public.lab_pme_siklus(id) ON DELETE CASCADE,
  parameter    text NOT NULL,
  nilai_lab    numeric,
  nilai_acuan  numeric,
  satuan       text,
  -- z-score: berapa simpangan baku hasil kita dari nilai acuan.
  -- |z| <= 2 memuaskan, 2 < |z| <= 3 dipertanyakan, > 3 tidak memuaskan.
  z_score      numeric,
  evaluasi     text,
  -- Hasil yang tidak memuaskan WAJIB punya tindakan perbaikan. Kolom ini
  -- ada supaya kewajiban itu terlihat kosong kalau belum dikerjakan,
  -- bukan tersembunyi di catatan bebas.
  akar_masalah text,
  tindakan_perbaikan text,
  tgl_tindakan date,
  created_at   timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pme_hasil_siklus ON public.lab_pme_hasil(siklus_id);

-- ── 5. EVALUASI OTOMATIS DARI Z-SCORE ─────────────────────────────
CREATE OR REPLACE FUNCTION public.lab_pme_catat_hasil(
  p_siklus_id bigint, p_parameter text, p_nilai_lab numeric,
  p_nilai_acuan numeric, p_sd numeric, p_satuan text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_z numeric; v_eval text; v_id bigint;
BEGIN
  IF p_sd IS NULL OR p_sd = 0 THEN
    RETURN jsonb_build_object('error',
      'Simpangan baku (SD) dari penyelenggara wajib diisi — tanpa itu z-score tidak bisa dihitung.');
  END IF;

  v_z := ROUND((p_nilai_lab - p_nilai_acuan) / p_sd, 2);

  -- Batas baku PME. Sengaja tidak bisa diatur dari layar: melonggarkan
  -- ambang agar hasil terlihat memuaskan adalah persis yang membuat
  -- program mutu kehilangan gunanya.
  v_eval := CASE
    WHEN abs(v_z) <= 2 THEN 'Memuaskan'
    WHEN abs(v_z) <= 3 THEN 'Dipertanyakan'
    ELSE 'Tidak Memuaskan' END;

  INSERT INTO public.lab_pme_hasil
    (siklus_id, parameter, nilai_lab, nilai_acuan, satuan, z_score, evaluasi)
  VALUES (p_siklus_id, p_parameter, p_nilai_lab, p_nilai_acuan, p_satuan, v_z, v_eval)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'z_score', v_z,
    'evaluasi', v_eval,
    'wajib_tindakan', (v_eval <> 'Memuaskan'));
END $fn$;

-- ── 6. TOLAK SPESIMEN ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lab_tolak_spesimen(
  p_sample_id bigint, p_kriteria_id bigint, p_alasan text DEFAULT NULL,
  p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_s record; v_k record;
BEGIN
  SELECT * INTO v_s FROM public.lab_samples WHERE id = p_sample_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Sampel tidak ditemukan.'); END IF;

  -- Sampel yang hasilnya sudah keluar tidak bisa ditolak surut. Kalau
  -- hasilnya diragukan, jalurnya adalah penarikan hasil — bukan menandai
  -- sampelnya ditolak dan meninggalkan hasil yang sudah terlanjur
  -- dikirim ke dokter tanpa penjelasan.
  IF COALESCE(v_s.status,'') = 'Done' THEN
    RETURN jsonb_build_object('error',
      'Sampel ini sudah selesai diperiksa. Gunakan penarikan hasil, bukan penolakan spesimen.');
  END IF;

  SELECT * INTO v_k FROM public.lab_kriteria_tolak WHERE id = p_kriteria_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error',
      'Kriteria penolakan tidak dikenal. Penolakan harus merujuk kriteria yang ditetapkan lab.');
  END IF;

  UPDATE public.lab_samples
     SET status = 'Rejected',
         kriteria_tolak_id = p_kriteria_id,
         alasan_tolak = COALESCE(p_alasan, v_k.nama),
         diverifikasi_oleh = p_oleh,
         diverifikasi_at = now(),
         diambil_ulang = COALESCE(v_k.wajib_ambil_ulang, true)
   WHERE id = p_sample_id;

  RETURN jsonb_build_object('ok', true, 'barcode', v_s.barcode,
    'kriteria', v_k.kode || ' — ' || v_k.nama,
    'perlu_ambil_ulang', COALESCE(v_k.wajib_ambil_ulang, true),
    'tindakan', v_k.tindakan);
END $fn$;

-- ── 7. TERIMA SPESIMEN ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lab_terima_spesimen(
  p_sample_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_s record;
BEGIN
  SELECT * INTO v_s FROM public.lab_samples WHERE id = p_sample_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Sampel tidak ditemukan.'); END IF;
  IF COALESCE(v_s.status,'') = 'Rejected' THEN
    RETURN jsonb_build_object('error',
      'Sampel ini sudah ditolak. Terbitkan sampel baru bila pasien diambil ulang.');
  END IF;

  UPDATE public.lab_samples
     SET status = CASE WHEN COALESCE(status,'') IN ('','Pending')
                       THEN 'In Process' ELSE status END,
         received_at = COALESCE(received_at, now()),
         diverifikasi_oleh = p_oleh, diverifikasi_at = now()
   WHERE id = p_sample_id;

  RETURN jsonb_build_object('ok', true, 'barcode', v_s.barcode);
END $fn$;

-- ── 8. ARSIPKAN & MUSNAHKAN SAMPEL ────────────────────────────────
CREATE OR REPLACE FUNCTION public.lab_arsipkan_sampel(
  p_sample_id bigint, p_lokasi text, p_rak text DEFAULT NULL,
  p_boks text DEFAULT NULL, p_posisi text DEFAULT NULL,
  p_simpan_hari int DEFAULT 7, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_s record; v_sampai date;
BEGIN
  SELECT * INTO v_s FROM public.lab_samples WHERE id = p_sample_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Sampel tidak ditemukan.'); END IF;
  IF COALESCE(btrim(p_lokasi),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Lokasi penyimpanan wajib diisi — arsip tanpa lokasi tidak bisa ditemukan kembali.');
  END IF;

  v_sampai := current_date + COALESCE(p_simpan_hari, 7);

  UPDATE public.lab_samples
     SET lokasi_arsip = btrim(p_lokasi), rak = p_rak, boks = p_boks,
         posisi = p_posisi, diarsipkan_at = now(), simpan_sampai = v_sampai
   WHERE id = p_sample_id;

  RETURN jsonb_build_object('ok', true, 'barcode', v_s.barcode,
    'simpan_sampai', v_sampai);
END $fn$;

CREATE OR REPLACE FUNCTION public.lab_musnahkan_sampel(
  p_sample_id bigint, p_berita_acara text, p_oleh text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_s record;
BEGIN
  SELECT * INTO v_s FROM public.lab_samples WHERE id = p_sample_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Sampel tidak ditemukan.'); END IF;
  IF v_s.dimusnahkan_at IS NOT NULL THEN
    RETURN jsonb_build_object('error','Sampel ini sudah tercatat dimusnahkan.');
  END IF;
  IF COALESCE(btrim(p_oleh),'') = '' THEN
    RETURN jsonb_build_object('error','Nama petugas pemusnah wajib diisi.');
  END IF;

  -- Pemusnahan sebelum masa simpan habis ditolak. Sampel adalah satu-
  -- satunya cara memeriksa ulang hasil yang dipertanyakan; membuangnya
  -- lebih cepat dari jadwal menghapus kemungkinan itu.
  IF v_s.simpan_sampai IS NOT NULL AND v_s.simpan_sampai > current_date THEN
    RETURN jsonb_build_object('error',
      format('Belum melewati masa simpan (sampai %s).', v_s.simpan_sampai));
  END IF;

  UPDATE public.lab_samples
     SET dimusnahkan_at = now(), dimusnahkan_oleh = p_oleh,
         berita_acara_musnah = p_berita_acara
   WHERE id = p_sample_id;

  RETURN jsonb_build_object('ok', true, 'barcode', v_s.barcode);
END $fn$;

-- ── 9. PAPAN ARSIP ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.lab_arsip_papan AS
SELECT s.id, s.barcode, s.patient_name, s.product_name, s.sampel_type,
       s.lokasi_arsip, s.rak, s.boks, s.posisi,
       s.diarsipkan_at, s.simpan_sampai, s.dimusnahkan_at, s.dimusnahkan_oleh,
       CASE
         WHEN s.dimusnahkan_at IS NOT NULL THEN 'Dimusnahkan'
         WHEN s.simpan_sampai IS NULL       THEN 'Belum Diarsipkan'
         WHEN s.simpan_sampai < current_date THEN 'Siap Dimusnahkan'
         ELSE 'Tersimpan' END AS status_arsip,
       (s.simpan_sampai - current_date) AS sisa_hari
  FROM public.lab_samples s
 WHERE s.diarsipkan_at IS NOT NULL OR s.status = 'Done';

GRANT SELECT ON public.lab_arsip_papan TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lab_pme_catat_hasil(bigint,text,numeric,numeric,numeric,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lab_tolak_spesimen(bigint,bigint,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lab_terima_spesimen(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lab_arsipkan_sampel(bigint,text,text,text,text,int,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lab_musnahkan_sampel(bigint,text,text) TO authenticated, service_role;
