-- ══════════════════════════════════════════════════════════════════
-- INSIDEN KESELAMATAN PASIEN (IKP) DAN INDIKATOR MUTU
--
-- Tidak ada apa pun untuk ini sebelumnya. compliance_tracker melacak
-- izin dan STR — bukan insiden.
--
-- ══════════════════════════════════════════════════════════════════
-- SATU KEPUTUSAN YANG MENENTUKAN APAKAH SISTEM INI DIPAKAI
--
-- Pelaporan boleh ANONIM. Itu bukan kelonggaran administratif, itu
-- syarat agar laporannya ada sama sekali.
--
-- Sistem pelaporan insiden yang menuntut nama pelapor akan menerima
-- sedikit laporan, dan yang masuk hanya insiden yang sudah telanjur
-- ketahuan orang lain. Yang paling berharga justru nyaris-cedera (KNC)
-- yang hanya diketahui pelakunya sendiri — dan tidak ada yang melaporkan
-- dirinya sendiri ke sistem yang mencatat namanya.
--
-- Karena itu kolom pelapor boleh kosong, dan TIDAK ada penjagaan yang
-- menuntutnya. Yang wajib adalah kronologi dan waktu kejadian.
--
-- Konsekuensi yang disengaja: laporan anonim tidak bisa ditanyakan
-- lanjut ke pelapornya. Itu harga yang jauh lebih murah daripada tidak
-- menerima laporan sama sekali.
--
-- ── GRADING TIDAK DIKETIK, DIHITUNG ───────────────────────────────
-- Band risiko (biru/hijau/kuning/merah) adalah hasil dampak × peluang.
-- Membiarkannya diketik berarti insiden berat bisa diturunkan jadi
-- hijau agar tidak perlu investigasi mendalam — dan itu persis yang
-- membuat program keselamatan kehilangan gunanya.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. INSIDEN ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ikp (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_ikp        text UNIQUE,
  -- KPC  Kondisi Potensial Cedera   (berpotensi, belum terjadi)
  -- KNC  Kejadian Nyaris Cedera     (terjadi, tidak sampai ke pasien)
  -- KTC  Kejadian Tidak Cedera      (sampai ke pasien, tidak mencederai)
  -- KTD  Kejadian Tidak Diharapkan  (mencederai pasien)
  -- Sentinel                        (kematian/cedera permanen/berat)
  jenis         text NOT NULL,
  tgl_kejadian  timestamp NOT NULL,
  tgl_lapor     timestamp DEFAULT now(),
  lokasi        text,
  unit_terkait  text,
  -- Pasien boleh kosong: KPC sering tidak menyangkut pasien tertentu.
  admission_id  bigint,
  patient_name  text,
  mr_number     text,
  kronologi     text NOT NULL,
  tindakan_segera text,
  -- Boleh NULL. Lihat catatan panjang di atas.
  pelapor_nama  text,
  pelapor_unit  text,
  anonim        boolean DEFAULT false,
  -- Grading: diisi tim mutu, lalu band dihitung fungsi di bawah.
  dampak        int,                  -- 1 tidak signifikan … 5 katastropik
  peluang       int,                  -- 1 sangat jarang … 5 sangat sering
  band          text,                 -- Biru | Hijau | Kuning | Merah
  -- Baru | Diinvestigasi | Selesai | Ditutup
  status        text DEFAULT 'Baru',
  batas_investigasi date,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ikp_status ON public.ikp(status, tgl_kejadian DESC);
CREATE INDEX IF NOT EXISTS idx_ikp_band   ON public.ikp(band);

-- ── 2. INVESTIGASI ────────────────────────────────────────────────
-- Band kuning dan merah menuntut investigasi mendalam (RCA). Band biru
-- dan hijau cukup investigasi sederhana. Itu ditegakkan di bagian 5.
CREATE TABLE IF NOT EXISTS public.ikp_investigasi (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ikp_id       bigint REFERENCES public.ikp(id) ON DELETE CASCADE,
  metode       text,                  -- Sederhana | RCA
  tim          text,
  mulai_at     timestamp DEFAULT now(),
  selesai_at   timestamp,
  -- Akar masalah, bukan "kelalaian petugas". Insiden yang akar
  -- masalahnya selalu individu berarti sistemnya tidak pernah diperbaiki.
  akar_masalah text,
  faktor_kontribusi text,
  kesimpulan   text,
  created_at   timestamp DEFAULT now()
);

-- ── 3. TINDAKAN PERBAIKAN (CAPA) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ikp_tindakan (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ikp_id       bigint REFERENCES public.ikp(id) ON DELETE CASCADE,
  jenis        text,                  -- Korektif | Preventif
  uraian       text NOT NULL,
  penanggung_jawab text,
  batas_waktu  date,
  selesai_at   timestamp,
  bukti        text,
  -- Efektivitas diperiksa ulang sesudah beberapa waktu. Tindakan yang
  -- ditutup tanpa pemeriksaan ulang sering hanya menutup berkasnya.
  efektif      boolean,
  ditinjau_at  timestamp,
  ditinjau_oleh text,
  created_at   timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ikptindakan ON public.ikp_tindakan(ikp_id);

-- ── 4. INDIKATOR MUTU ─────────────────────────────────────────────
-- Definisi indikator TIDAK ditanam sebagai data bawaan. Indikator Mutu
-- Nasional berubah, dan tiap faskes juga punya indikator prioritasnya
-- sendiri. Yang dibangun adalah tempatnya, beserta siapa menetapkan.
CREATE TABLE IF NOT EXISTS public.mutu_indikator (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode         text UNIQUE NOT NULL,
  nama         text NOT NULL,
  kategori     text,
  -- Rumus disimpan sebagai keterangan, bukan dieksekusi. Menjalankan
  -- rumus yang diketik pengguna berarti membiarkan isi tabel menentukan
  -- kueri yang berjalan.
  definisi_numerator   text,
  definisi_denominator text,
  satuan       text DEFAULT '%',
  target       numeric,
  -- naik = makin tinggi makin baik; turun = makin rendah makin baik.
  arah_baik    text DEFAULT 'naik',
  frekuensi    text,                  -- Harian | Bulanan | Triwulan
  penanggung_jawab text,
  ditetapkan_oleh text,
  tgl_berlaku  date,
  aktif        boolean DEFAULT true,
  created_at   timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mutu_capaian (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  indikator_id bigint REFERENCES public.mutu_indikator(id) ON DELETE CASCADE,
  periode      text NOT NULL,         -- 2026-08 atau 2026-Q3
  numerator    numeric,
  denominator  numeric,
  capaian      numeric,
  -- Diisi bila capaian tidak mencapai target. Kolomnya ada supaya
  -- kewajiban itu terlihat kosong, bukan tersembunyi.
  analisis     text,
  rencana_perbaikan text,
  dicatat_oleh text,
  created_at   timestamp DEFAULT now(),
  UNIQUE (indikator_id, periode)
);

-- ── 5. LAPOR INSIDEN ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ikp_lapor(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_id bigint; v_no text; v_jenis text; v_kejadian timestamp; v_anonim boolean;
BEGIN
  v_jenis := upper(btrim(COALESCE(p_data->>'jenis','')));
  IF v_jenis NOT IN ('KPC','KNC','KTC','KTD','SENTINEL') THEN
    RETURN jsonb_build_object('error',
      'Jenis insiden harus KPC, KNC, KTC, KTD, atau Sentinel.');
  END IF;

  v_kejadian := NULLIF(p_data->>'tgl_kejadian','')::timestamp;
  IF v_kejadian IS NULL THEN
    RETURN jsonb_build_object('error','Waktu kejadian wajib diisi.');
  END IF;
  IF v_kejadian > now() + interval '1 hour' THEN
    RETURN jsonb_build_object('error','Waktu kejadian tidak boleh di masa depan.');
  END IF;
  IF COALESCE(btrim(p_data->>'kronologi'),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Kronologi wajib diisi — tanpa urutan kejadian, insiden tidak bisa '
      || 'diinvestigasi dan tidak bisa dicegah berulang.');
  END IF;

  -- Nama pelapor SENGAJA tidak diwajibkan. Lihat catatan di kepala berkas.
  v_anonim := COALESCE((p_data->>'anonim')::boolean,
                       COALESCE(btrim(p_data->>'pelapor_nama'),'') = '');

  v_no := 'IKP-' || to_char(now(),'YYMM') || '-' ||
          lpad((COALESCE((SELECT count(*) FROM public.ikp
                          WHERE to_char(created_at,'YYMM') = to_char(now(),'YYMM')),0) + 1)
               ::text, 4, '0');

  INSERT INTO public.ikp
    (no_ikp, jenis, tgl_kejadian, lokasi, unit_terkait, admission_id,
     patient_name, mr_number, kronologi, tindakan_segera,
     pelapor_nama, pelapor_unit, anonim,
     -- Batas investigasi 2×24 jam sejak dilaporkan; itu jeda yang lazim
     -- dipakai dan cukup pendek supaya ingatan orang belum kabur.
     batas_investigasi)
  VALUES (v_no, initcap(v_jenis), v_kejadian, p_data->>'lokasi',
          p_data->>'unit_terkait', NULLIF(p_data->>'admission_id','')::bigint,
          p_data->>'patient_name', p_data->>'mr_number',
          btrim(p_data->>'kronologi'), p_data->>'tindakan_segera',
          CASE WHEN v_anonim THEN NULL ELSE btrim(p_data->>'pelapor_nama') END,
          p_data->>'pelapor_unit', v_anonim,
          (current_date + 2))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_ikp', v_no,
    'anonim', v_anonim,
    'catatan', CASE WHEN v_jenis = 'SENTINEL'
      THEN 'Kejadian sentinel wajib diinvestigasi dengan RCA dan dilaporkan '
        || 'ke Komite Nasional Keselamatan Pasien.' END);
END $fn$;

-- ── 6. GRADING — DIHITUNG, BUKAN DIKETIK ──────────────────────────
CREATE OR REPLACE FUNCTION public.ikp_grading(
  p_ikp_id bigint, p_dampak int, p_peluang int, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_band text; v_skor int; v_i record;
BEGIN
  IF p_dampak IS NULL OR p_dampak < 1 OR p_dampak > 5
     OR p_peluang IS NULL OR p_peluang < 1 OR p_peluang > 5 THEN
    RETURN jsonb_build_object('error','Dampak dan peluang harus 1 sampai 5.');
  END IF;

  SELECT * INTO v_i FROM public.ikp WHERE id = p_ikp_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Insiden tidak ditemukan.'); END IF;

  v_skor := p_dampak * p_peluang;

  -- Matriks risiko. Bandnya tidak bisa disetel dari layar: menurunkan
  -- band agar tidak perlu RCA adalah cara paling umum program
  -- keselamatan kehilangan gunanya.
  v_band := CASE
    WHEN p_dampak >= 4 AND p_peluang >= 3 THEN 'Merah'
    WHEN v_skor >= 15                     THEN 'Merah'
    WHEN v_skor >= 8                      THEN 'Kuning'
    WHEN v_skor >= 4                      THEN 'Hijau'
    ELSE 'Biru' END;

  -- Sentinel selalu merah berapa pun angkanya.
  IF lower(v_i.jenis) = 'sentinel' THEN v_band := 'Merah'; END IF;

  UPDATE public.ikp
     SET dampak = p_dampak, peluang = p_peluang, band = v_band,
         status = CASE WHEN status = 'Baru' THEN 'Diinvestigasi' ELSE status END,
         updated_at = now()
   WHERE id = p_ikp_id;

  RETURN jsonb_build_object('ok', true, 'band', v_band, 'skor', v_skor,
    'metode_wajib', CASE WHEN v_band IN ('Kuning','Merah') THEN 'RCA' ELSE 'Sederhana' END,
    'catatan', CASE WHEN v_band IN ('Kuning','Merah')
      THEN 'Band ' || v_band || ' menuntut investigasi mendalam (RCA).' END);
END $fn$;

-- ── 7. TUTUP INSIDEN ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ikp_tutup(
  p_ikp_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_i record; v_inv record; v_capa int; v_belum int;
BEGIN
  SELECT * INTO v_i FROM public.ikp WHERE id = p_ikp_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Insiden tidak ditemukan.'); END IF;
  IF v_i.status = 'Ditutup' THEN
    RETURN jsonb_build_object('error','Insiden ini sudah ditutup.');
  END IF;
  IF v_i.band IS NULL THEN
    RETURN jsonb_build_object('error','Insiden belum digrading.');
  END IF;

  SELECT * INTO v_inv FROM public.ikp_investigasi
   WHERE ikp_id = p_ikp_id ORDER BY id DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error',
      'Belum ada investigasi. Insiden tidak boleh ditutup tanpa dicari '
      || 'sebabnya — kalau ditutup begitu saja, ia akan terulang.');
  END IF;

  -- Band kuning/merah menuntut RCA, bukan investigasi sederhana.
  IF v_i.band IN ('Kuning','Merah') AND upper(COALESCE(v_inv.metode,'')) <> 'RCA' THEN
    RETURN jsonb_build_object('error',
      format('Band %s menuntut investigasi RCA, yang tercatat "%s".',
             v_i.band, COALESCE(v_inv.metode,'belum diisi')));
  END IF;

  IF COALESCE(btrim(v_inv.akar_masalah),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Akar masalah belum diisi. Insiden yang ditutup tanpa akar masalah '
      || 'tidak menghasilkan perbaikan apa pun.');
  END IF;

  -- Harus ada tindakan perbaikan, dan semuanya harus sudah selesai.
  SELECT count(*), count(*) FILTER (WHERE selesai_at IS NULL)
    INTO v_capa, v_belum
    FROM public.ikp_tindakan WHERE ikp_id = p_ikp_id;

  IF v_capa = 0 THEN
    RETURN jsonb_build_object('error',
      'Belum ada tindakan perbaikan. Investigasi tanpa tindakan hanya '
      || 'menghasilkan berkas.');
  END IF;
  IF v_belum > 0 THEN
    RETURN jsonb_build_object('error',
      format('%s tindakan perbaikan belum selesai.', v_belum));
  END IF;

  UPDATE public.ikp SET status = 'Ditutup', updated_at = now() WHERE id = p_ikp_id;
  RETURN jsonb_build_object('ok', true, 'no_ikp', v_i.no_ikp);
END $fn$;

-- ── 8. CATAT CAPAIAN INDIKATOR ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mutu_catat(
  p_indikator_id bigint, p_periode text, p_numerator numeric,
  p_denominator numeric, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_i record; v_capaian numeric; v_tercapai boolean;
BEGIN
  SELECT * INTO v_i FROM public.mutu_indikator WHERE id = p_indikator_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Indikator tidak ditemukan.'); END IF;

  IF p_denominator IS NULL OR p_denominator = 0 THEN
    RETURN jsonb_build_object('error',
      'Denominator nol — capaian tidak bisa dihitung. Bila memang tidak ada '
      || 'kasus pada periode ini, catat sebagai tidak ada data, bukan sebagai 0%.');
  END IF;

  v_capaian := ROUND(p_numerator / p_denominator * 100, 2);
  v_tercapai := CASE
    WHEN v_i.target IS NULL THEN NULL
    WHEN lower(COALESCE(v_i.arah_baik,'naik')) = 'turun' THEN v_capaian <= v_i.target
    ELSE v_capaian >= v_i.target END;

  INSERT INTO public.mutu_capaian
    (indikator_id, periode, numerator, denominator, capaian, dicatat_oleh)
  VALUES (p_indikator_id, p_periode, p_numerator, p_denominator, v_capaian, p_oleh)
  ON CONFLICT (indikator_id, periode) DO UPDATE
    SET numerator = EXCLUDED.numerator, denominator = EXCLUDED.denominator,
        capaian = EXCLUDED.capaian, dicatat_oleh = EXCLUDED.dicatat_oleh;

  RETURN jsonb_build_object('ok', true, 'capaian', v_capaian,
    'target', v_i.target, 'tercapai', v_tercapai,
    'wajib_analisis', (v_tercapai IS FALSE));
END $fn$;

-- ── 9. PAPAN ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.ikp_papan AS
SELECT i.*,
       (SELECT count(*) FROM public.ikp_tindakan t WHERE t.ikp_id = i.id) AS jml_capa,
       (SELECT count(*) FROM public.ikp_tindakan t
         WHERE t.ikp_id = i.id AND t.selesai_at IS NULL)                  AS capa_belum,
       (SELECT metode FROM public.ikp_investigasi v
         WHERE v.ikp_id = i.id ORDER BY v.id DESC LIMIT 1)                AS metode_investigasi,
       (SELECT akar_masalah FROM public.ikp_investigasi v
         WHERE v.ikp_id = i.id ORDER BY v.id DESC LIMIT 1)                AS akar_masalah,
       (i.status <> 'Ditutup' AND i.batas_investigasi < current_date)     AS lewat_batas,
       (i.band IN ('Kuning','Merah'))                                     AS wajib_rca
  FROM public.ikp i;

CREATE OR REPLACE VIEW public.mutu_papan AS
SELECT c.id, c.indikator_id, c.periode, c.numerator, c.denominator,
       c.capaian, c.analisis, c.rencana_perbaikan, c.dicatat_oleh,
       i.kode, i.nama, i.kategori, i.satuan, i.target, i.arah_baik,
       i.penanggung_jawab,
       CASE
         WHEN i.target IS NULL THEN NULL
         WHEN lower(COALESCE(i.arah_baik,'naik')) = 'turun' THEN c.capaian <= i.target
         ELSE c.capaian >= i.target END                       AS tercapai,
       (i.target IS NOT NULL
        AND CASE WHEN lower(COALESCE(i.arah_baik,'naik')) = 'turun'
                 THEN c.capaian > i.target ELSE c.capaian < i.target END
        AND COALESCE(btrim(c.rencana_perbaikan),'') = '')     AS perbaikan_belum_diisi
  FROM public.mutu_capaian c
  LEFT JOIN public.mutu_indikator i ON i.id = c.indikator_id;

GRANT SELECT ON public.ikp_papan, public.mutu_papan TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ikp_lapor(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ikp_grading(bigint,int,int,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ikp_tutup(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mutu_catat(bigint,text,numeric,numeric,text) TO authenticated, service_role;
