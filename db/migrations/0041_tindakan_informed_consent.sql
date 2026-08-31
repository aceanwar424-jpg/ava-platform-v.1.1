-- ══════════════════════════════════════════════════════════════════
-- TINDAKAN MEDIS, PERSETUJUAN TINDAKAN, DAN SERI TERAPI
--
-- Mengisi empat menu yang berstatus "belum":
--   his-procedures    Tindakan & Prosedur
--   sm-usg            USG Non-Radiologi
--   sm-endoskopi      Endoskopi
--   sm-fisioterapi    Fisioterapi & Rehabilitasi Medik
--
-- Keempatnya adalah hal yang sama secara struktur — tindakan yang
-- dikerjakan pada pasien, dicatat siapa mengerjakan, apa temuannya, dan
-- apa yang terjadi sesudahnya. Yang membedakan hanya kategorinya dan
-- apakah ia berdiri sendiri atau bagian dari seri.
--
-- Membuat empat tabel terpisah akan membuat pertanyaan "tindakan apa
-- saja yang dijalani pasien ini" harus di-UNION dari empat tempat, dan
-- satu di antaranya pasti terlupakan.
--
-- ── PENJAGAAN YANG PALING PENTING DI BERKAS INI ───────────────────
-- Tindakan yang menuntut persetujuan TIDAK BISA dimulai sebelum
-- persetujuannya tercatat. Dijaga di basis data, bukan di layar.
--
-- Ini bukan kerapian administratif. Tindakan invasif tanpa persetujuan
-- tertulis adalah pelanggaran hak pasien dan, bila ada sengketa, rumah
-- sakit tidak punya apa pun untuk ditunjukkan. Pemeriksaan di JavaScript
-- bisa dilewati siapa saja lewat alat pengembang peramban; pemeriksaan
-- di sini tidak.
--
-- Persetujuan juga TERIKAT pada tindakan tertentu. Persetujuan untuk
-- endoskopi tidak menutupi biopsi yang diputuskan di tengah jalan —
-- itulah sebabnya kolomnya menunjuk tindakan, bukan pasien.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. KATALOG TINDAKAN ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tindakan_katalog (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode          text UNIQUE NOT NULL,
  nama          text NOT NULL,
  -- Bedah Minor | USG | Endoskopi | Fisioterapi | Perawatan Luka | Lain
  kategori      text NOT NULL,
  icd9_cm       text,                    -- kode prosedur untuk klaim
  durasi_menit  int,
  tarif         numeric DEFAULT 0,
  -- Penentu penjagaan di bagian 5. Default TRUE: lebih aman menuntut
  -- persetujuan untuk tindakan yang ternyata tidak memerlukannya
  -- daripada melewatkannya untuk tindakan yang memerlukan.
  butuh_consent boolean DEFAULT true,
  -- Diisi tim medis. Dibiarkan kosong berarti lembar persetujuan
  -- tercetak tanpa penjelasan risiko — dan persetujuan tanpa penjelasan
  -- bukan persetujuan.
  persiapan     text,
  risiko        text,
  alternatif    text,
  -- Untuk tindakan berseri seperti fisioterapi.
  berseri       boolean DEFAULT false,
  sesi_standar  int,
  status        text DEFAULT 'Aktif',
  created_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tkatalog_kategori ON public.tindakan_katalog(kategori, status);

-- ── 2. SERI / PROGRAM TERAPI ──────────────────────────────────────
-- Fisioterapi dan rehabilitasi berjalan sebagai program: sekian sesi
-- yang direncanakan, dievaluasi di tengah, dan bisa dihentikan lebih
-- awal. Tanpa induk program, tiap sesi berdiri sendiri dan tidak ada
-- yang bisa menjawab "sudah sesi ke berapa dari berapa".
CREATE TABLE IF NOT EXISTS public.tindakan_seri (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_seri       text UNIQUE,
  katalog_id    bigint REFERENCES public.tindakan_katalog(id),
  admission_id  bigint,
  patient_name  text,
  mr_number     text,
  dokter_perujuk text,
  sesi_rencana  int DEFAULT 0,
  tgl_mulai     date DEFAULT current_date,
  tgl_target_selesai date,
  tujuan_terapi text,
  evaluasi      text,
  -- Berjalan | Selesai | Dihentikan
  status        text DEFAULT 'Berjalan',
  alasan_henti  text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);

-- ── 3. TINDAKAN ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tindakan (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_tindakan   text UNIQUE,
  katalog_id    bigint REFERENCES public.tindakan_katalog(id),
  seri_id       bigint REFERENCES public.tindakan_seri(id) ON DELETE SET NULL,
  sesi_ke       int,
  admission_id  bigint,
  visit_number  text,
  patient_name  text,
  mr_number     text,
  -- Dijadwalkan | Berjalan | Selesai | Batal
  status        text DEFAULT 'Dijadwalkan',
  tgl_rencana   timestamp,
  mulai_at      timestamp,
  selesai_at    timestamp,
  operator      text,
  asisten       text,
  ruangan       text,
  -- Hasil
  temuan        text,
  tindakan_dilakukan text,
  komplikasi    text,
  anjuran       text,
  tarif         numeric DEFAULT 0,
  alasan_batal  text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tindakan_status ON public.tindakan(status, tgl_rencana);
CREATE INDEX IF NOT EXISTS idx_tindakan_seri   ON public.tindakan(seri_id, sesi_ke);
CREATE INDEX IF NOT EXISTS idx_tindakan_admisi ON public.tindakan(admission_id);

-- ── 4. PERSETUJUAN TINDAKAN (INFORMED CONSENT) ────────────────────
-- Menunjuk TINDAKAN, bukan pasien: persetujuan untuk endoskopi tidak
-- menutupi biopsi yang diputuskan di tengah jalan.
CREATE TABLE IF NOT EXISTS public.tindakan_consent (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tindakan_id    bigint REFERENCES public.tindakan(id) ON DELETE CASCADE,
  -- Isi penjelasan yang benar-benar disampaikan, disalin dari katalog
  -- saat itu. Katalog bisa berubah kemudian; yang mengikat adalah apa
  -- yang dijelaskan pada hari itu.
  penjelasan_risiko text,
  penjelasan_alternatif text,
  dijelaskan_oleh text,                  -- dokter yang menjelaskan
  dijelaskan_at   timestamp,
  -- Yang menyetujui bisa bukan pasien sendiri (anak, tidak sadar).
  penerima_nama   text,
  penerima_hubungan text,                -- Pasien | Suami | Istri | Anak | Wali
  penerima_identitas text,
  -- Setuju | Menolak
  keputusan      text NOT NULL,
  alasan_menolak text,
  saksi_petugas  text,
  saksi_keluarga text,
  ttd_url        text,                   -- berkas tanda tangan/berkas pindaian
  ditandatangani_at timestamp DEFAULT now(),
  dicabut_at     timestamp,
  alasan_cabut   text,
  created_at     timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_tindakan ON public.tindakan_consent(tindakan_id);

-- ── 5. MULAI TINDAKAN — GERBANG PERSETUJUAN ───────────────────────
CREATE OR REPLACE FUNCTION public.tindakan_mulai(
  p_tindakan_id bigint, p_operator text DEFAULT NULL,
  p_asisten text DEFAULT NULL, p_ruangan text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_t record; v_k record; v_c record;
BEGIN
  SELECT * INTO v_t FROM public.tindakan WHERE id = p_tindakan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Tindakan tidak ditemukan.'); END IF;

  IF v_t.status <> 'Dijadwalkan' THEN
    RETURN jsonb_build_object('error',
      format('Tindakan berstatus "%s" — hanya yang Dijadwalkan bisa dimulai.', v_t.status));
  END IF;

  IF COALESCE(btrim(COALESCE(p_operator, v_t.operator)), '') = '' THEN
    RETURN jsonb_build_object('error',
      'Nama operator wajib diisi — tindakan tanpa pelaksana yang tercatat '
      || 'tidak bisa dipertanggungjawabkan.');
  END IF;

  SELECT * INTO v_k FROM public.tindakan_katalog WHERE id = v_t.katalog_id;

  IF COALESCE(v_k.butuh_consent, true) THEN
    SELECT * INTO v_c FROM public.tindakan_consent
     WHERE tindakan_id = p_tindakan_id AND dicabut_at IS NULL
     ORDER BY id DESC LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error',
        'Persetujuan tindakan belum tercatat. Tindakan ini tidak boleh '
        || 'dimulai sebelum pasien atau walinya menyatakan persetujuan.');
    END IF;

    IF lower(v_c.keputusan) <> 'setuju' THEN
      RETURN jsonb_build_object('error',
        'Pasien atau walinya MENOLAK tindakan ini'
        || COALESCE(': ' || v_c.alasan_menolak, '') || '.');
    END IF;

    -- Persetujuan yang tidak menyebut siapa yang menjelaskan bukan
    -- persetujuan yang diinformasikan. Kolom ini kosong berarti lembarnya
    -- ditandatangani tanpa ada yang menerangkan.
    IF COALESCE(btrim(v_c.dijelaskan_oleh), '') = '' THEN
      RETURN jsonb_build_object('error',
        'Persetujuan belum mencantumkan siapa yang memberi penjelasan. '
        || 'Persetujuan tanpa penjelasan bukan informed consent.');
    END IF;
  END IF;

  UPDATE public.tindakan
     SET status = 'Berjalan', mulai_at = now(),
         operator = COALESCE(p_operator, operator),
         asisten = COALESCE(p_asisten, asisten),
         ruangan = COALESCE(p_ruangan, ruangan),
         updated_at = now()
   WHERE id = p_tindakan_id;

  RETURN jsonb_build_object('ok', true, 'no_tindakan', v_t.no_tindakan,
    'butuh_consent', COALESCE(v_k.butuh_consent, true));
END $fn$;

-- ── 6. SELESAIKAN TINDAKAN ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tindakan_selesai(
  p_tindakan_id bigint, p_temuan text DEFAULT NULL,
  p_dilakukan text DEFAULT NULL, p_komplikasi text DEFAULT NULL,
  p_anjuran text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_t record; v_sudah int; v_seri record;
BEGIN
  SELECT * INTO v_t FROM public.tindakan WHERE id = p_tindakan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Tindakan tidak ditemukan.'); END IF;
  IF v_t.status <> 'Berjalan' THEN
    RETURN jsonb_build_object('error',
      format('Tindakan berstatus "%s" — belum berjalan.', v_t.status));
  END IF;

  IF COALESCE(btrim(p_dilakukan), '') = '' THEN
    RETURN jsonb_build_object('error',
      'Uraian tindakan yang dikerjakan wajib diisi.');
  END IF;

  UPDATE public.tindakan
     SET status = 'Selesai', selesai_at = now(),
         temuan = p_temuan, tindakan_dilakukan = p_dilakukan,
         komplikasi = p_komplikasi, anjuran = p_anjuran, updated_at = now()
   WHERE id = p_tindakan_id;

  -- Seri ditutup otomatis saat sesi terakhir selesai — tapi hanya
  -- ditutup, bukan dinyatakan berhasil. Keberhasilan terapi diputuskan
  -- lewat evaluasi, bukan lewat menghitung sesi.
  IF v_t.seri_id IS NOT NULL THEN
    SELECT * INTO v_seri FROM public.tindakan_seri WHERE id = v_t.seri_id;
    SELECT count(*) INTO v_sudah FROM public.tindakan
     WHERE seri_id = v_t.seri_id AND status = 'Selesai';

    IF v_seri.sesi_rencana > 0 AND v_sudah >= v_seri.sesi_rencana
       AND v_seri.status = 'Berjalan' THEN
      UPDATE public.tindakan_seri
         SET status = 'Selesai', updated_at = now() WHERE id = v_t.seri_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'no_tindakan', v_t.no_tindakan,
      'sesi_selesai', v_sudah, 'sesi_rencana', v_seri.sesi_rencana);
  END IF;

  RETURN jsonb_build_object('ok', true, 'no_tindakan', v_t.no_tindakan);
END $fn$;

-- ── 7. CATAT PERSETUJUAN ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tindakan_catat_consent(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_t record; v_k record; v_id bigint; v_keputusan text;
BEGIN
  SELECT * INTO v_t FROM public.tindakan
   WHERE id = NULLIF(p_data->>'tindakan_id','')::bigint;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Tindakan tidak ditemukan.'); END IF;

  IF v_t.status NOT IN ('Dijadwalkan') THEN
    RETURN jsonb_build_object('error',
      'Persetujuan harus dicatat SEBELUM tindakan dimulai.');
  END IF;

  v_keputusan := lower(COALESCE(p_data->>'keputusan',''));
  IF v_keputusan NOT IN ('setuju','menolak') THEN
    RETURN jsonb_build_object('error','Keputusan harus "setuju" atau "menolak".');
  END IF;
  IF COALESCE(btrim(p_data->>'dijelaskan_oleh'),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Nama pemberi penjelasan wajib diisi.');
  END IF;
  IF COALESCE(btrim(p_data->>'penerima_nama'),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Nama penerima penjelasan wajib diisi.');
  END IF;
  IF v_keputusan = 'menolak'
     AND COALESCE(btrim(p_data->>'alasan_menolak'),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Alasan penolakan wajib dicatat — penolakan tanpa alasan tidak bisa '
      || 'dipertanggungjawabkan bila kemudian dipersoalkan.');
  END IF;

  SELECT * INTO v_k FROM public.tindakan_katalog WHERE id = v_t.katalog_id;

  INSERT INTO public.tindakan_consent
    (tindakan_id, penjelasan_risiko, penjelasan_alternatif, dijelaskan_oleh,
     dijelaskan_at, penerima_nama, penerima_hubungan, penerima_identitas,
     keputusan, alasan_menolak, saksi_petugas, saksi_keluarga, ttd_url)
  VALUES (v_t.id,
          -- Disalin dari katalog SAAT INI, bukan dirujuk. Katalog bisa
          -- berubah kemudian; yang mengikat adalah apa yang dijelaskan
          -- pada hari itu.
          COALESCE(p_data->>'penjelasan_risiko', v_k.risiko),
          COALESCE(p_data->>'penjelasan_alternatif', v_k.alternatif),
          btrim(p_data->>'dijelaskan_oleh'), now(),
          btrim(p_data->>'penerima_nama'), p_data->>'penerima_hubungan',
          p_data->>'penerima_identitas',
          initcap(v_keputusan), p_data->>'alasan_menolak',
          p_data->>'saksi_petugas', p_data->>'saksi_keluarga',
          p_data->>'ttd_url')
  RETURNING id INTO v_id;

  -- Penolakan langsung membatalkan tindakan. Membiarkannya tetap
  -- "Dijadwalkan" berarti ia masih muncul di daftar kerja dan bisa
  -- terlanjur dikerjakan.
  IF v_keputusan = 'menolak' THEN
    UPDATE public.tindakan
       SET status = 'Batal',
           alasan_batal = 'Pasien/wali menolak: ' || COALESCE(p_data->>'alasan_menolak',''),
           updated_at = now()
     WHERE id = v_t.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id,
    'keputusan', initcap(v_keputusan),
    'tindakan_dibatalkan', (v_keputusan = 'menolak'));
END $fn$;

-- ── 8. BUAT TINDAKAN ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tindakan_buat(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_k record; v_id bigint; v_no text; v_seri bigint; v_sesi int;
BEGIN
  SELECT * INTO v_k FROM public.tindakan_katalog
   WHERE id = NULLIF(p_data->>'katalog_id','')::bigint;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Jenis tindakan tidak ditemukan.'); END IF;
  IF COALESCE(btrim(p_data->>'patient_name'),'') = '' THEN
    RETURN jsonb_build_object('error','Nama pasien wajib diisi.');
  END IF;

  v_seri := NULLIF(p_data->>'seri_id','')::bigint;
  IF v_seri IS NOT NULL THEN
    SELECT COALESCE(max(sesi_ke), 0) + 1 INTO v_sesi
      FROM public.tindakan WHERE seri_id = v_seri;
  END IF;

  v_no := 'TDK-' || to_char(now(),'YYMMDD') || '-' ||
          lpad((COALESCE((SELECT count(*) FROM public.tindakan
                          WHERE created_at::date = current_date),0) + 1)::text, 4, '0');

  INSERT INTO public.tindakan
    (no_tindakan, katalog_id, seri_id, sesi_ke, admission_id, visit_number,
     patient_name, mr_number, tgl_rencana, operator, ruangan, tarif)
  VALUES (v_no, v_k.id, v_seri, v_sesi,
          NULLIF(p_data->>'admission_id','')::bigint, p_data->>'visit_number',
          btrim(p_data->>'patient_name'), p_data->>'mr_number',
          COALESCE(NULLIF(p_data->>'tgl_rencana','')::timestamp, now()),
          p_data->>'operator', p_data->>'ruangan', COALESCE(v_k.tarif, 0))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_tindakan', v_no,
    'butuh_consent', COALESCE(v_k.butuh_consent, true),
    'sesi_ke', v_sesi,
    'catatan', CASE WHEN COALESCE(v_k.butuh_consent, true)
                    AND COALESCE(btrim(v_k.risiko),'') = ''
      THEN 'Katalog tindakan ini belum mencantumkan risiko. Lembar '
        || 'persetujuan akan tercetak tanpa penjelasan risiko.' END);
END $fn$;

-- ── 9. PAPAN TINDAKAN ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.tindakan_papan AS
SELECT t.*, k.nama AS nama_tindakan, k.kategori, k.icd9_cm,
       k.butuh_consent, k.durasi_menit, k.berseri,
       s.no_seri, s.sesi_rencana, s.tujuan_terapi,
       c.keputusan     AS consent_keputusan,
       c.dijelaskan_oleh AS consent_oleh,
       c.penerima_nama AS consent_penerima,
       c.ditandatangani_at AS consent_at,
       -- Siap dikerjakan bila tidak butuh consent, atau consent-nya
       -- sudah ada dan berbunyi setuju.
       (NOT COALESCE(k.butuh_consent, true)
        OR (c.id IS NOT NULL AND lower(c.keputusan) = 'setuju'
            AND COALESCE(btrim(c.dijelaskan_oleh),'') <> '')) AS siap_dikerjakan
  FROM public.tindakan t
  LEFT JOIN public.tindakan_katalog k ON k.id = t.katalog_id
  LEFT JOIN public.tindakan_seri    s ON s.id = t.seri_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.tindakan_consent cc
     WHERE cc.tindakan_id = t.id AND cc.dicabut_at IS NULL
     ORDER BY cc.id DESC LIMIT 1
  ) c ON true;

GRANT SELECT ON public.tindakan_papan TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tindakan_buat(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tindakan_mulai(bigint,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tindakan_selesai(bigint,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tindakan_catat_consent(jsonb) TO authenticated, service_role;
