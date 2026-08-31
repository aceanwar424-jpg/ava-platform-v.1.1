-- ══════════════════════════════════════════════════════════════════
-- TRIASE IGD, SKRINING RISIKO, EWS, DAN CATATAN PEMBERIAN OBAT
--
-- Empat hal yang belum ada sama sekali, dan keempatnya adalah bagian
-- keselamatan pasien yang paling awal terasa saat terjadi sesuatu.
--
-- ══════════════════════════════════════════════════════════════════
-- KENAPA PRIORITAS ANTREAN BUKAN TRIASE
--
-- Migrasi 0032 sudah memberi antrean prioritas cito/hamil/lansia/
-- disabilitas. Itu urutan pelayanan, bukan penilaian kegawatan.
--
-- Triase menjawab pertanyaan berbeda: berapa lama pasien ini MASIH AMAN
-- menunggu. Jawabannya menentukan apakah ia dibawa langsung ke ruang
-- resusitasi atau boleh duduk. Ia juga harus DIULANG — pasien yang saat
-- datang hijau bisa memburuk dalam 20 menit, dan tanpa triase ulang
-- tidak ada yang menyadarinya sampai ia kolaps di ruang tunggu.
--
-- ══════════════════════════════════════════════════════════════════
-- KENAPA MAR PENTING WALAU RAWAT INAP BELUM BERJALAN
--
-- Farmasi sudah menyerahkan obat. Yang tidak ada adalah catatan siapa
-- MEMBERIKAN obat itu ke pasien dan jam berapa. Tanpa itu, dosis yang
-- terlewat dan dosis ganda sama-sama tidak terdeteksi — keduanya baru
-- ketahuan setelah pasien bereaksi.
--
-- Strukturnya dipasang sekarang, sebelum rawat inap berjalan, supaya
-- tidak ada masa di mana obat diberikan tanpa tempat mencatatnya.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. TRIASE IGD ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.triase (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_triase     text UNIQUE,
  admission_id  bigint,
  patient_name  text NOT NULL,
  mr_number     text,
  usia_tahun    int,
  jenis_kelamin text,
  tiba_at       timestamp DEFAULT now(),
  cara_datang   text,                 -- Jalan sendiri | Kursi roda | Brankar | Ambulans
  keluhan_utama text NOT NULL,
  -- Level kegawatan. 1 paling gawat.
  --   1 Resusitasi  — segera, mengancam nyawa
  --   2 Emergensi   — sangat mendesak
  --   3 Urgen       — mendesak
  --   4 Kurang urgen
  --   5 Tidak urgen
  level         int NOT NULL,
  alasan_level  text,
  -- Tanda vital saat triase. Dipakai menghitung EWS.
  td_sistol     int,
  td_diastol    int,
  nadi          int,
  napas         int,
  suhu          numeric,
  spo2          int,
  kesadaran     text,                 -- Sadar | Suara | Nyeri | Tidak respons
  ews_skor      int,
  -- Target waktu tunggu maksimal menurut levelnya, dan kenyataannya.
  target_menit  int,
  dilihat_dokter_at timestamp,
  ruang_tujuan  text,
  petugas_triase text,
  -- Aktif | Ditangani | Dirujuk | Pulang | Meninggal
  status        text DEFAULT 'Aktif',
  -- Triase ulang menunjuk triase sebelumnya.
  triase_ulang_dari bigint REFERENCES public.triase(id),
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_triase_aktif ON public.triase(status, level, tiba_at);

-- ── 2. SKRINING RISIKO ────────────────────────────────────────────
-- Jatuh, nyeri, dan gizi dinilai di menit-menit pertama dan wajib untuk
-- akreditasi. Disimpan sebagai satu tabel berjenis, bukan tiga tabel:
-- ketiganya dinilai pada momen yang sama oleh orang yang sama, dan
-- pertanyaan "skrining apa saja yang sudah dikerjakan untuk pasien ini"
-- harus dijawab dari satu tempat.
CREATE TABLE IF NOT EXISTS public.skrining (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id bigint,
  patient_name text,
  mr_number    text,
  jenis        text NOT NULL,         -- jatuh | nyeri | gizi
  -- Alat ukur yang dipakai disebutkan, karena skor 45 pada Morse
  -- berarti hal yang berbeda dari 45 pada alat lain.
  instrumen    text,
  skor         numeric,
  kategori     text,                  -- Rendah | Sedang | Tinggi
  rincian      jsonb DEFAULT '{}'::jsonb,
  -- Risiko tinggi menuntut tindak lanjut. Kolomnya ada supaya
  -- kewajiban itu terlihat kosong bila belum dikerjakan.
  tindak_lanjut text,
  dinilai_oleh text,
  dinilai_at   timestamp DEFAULT now(),
  -- Skrining diulang; yang lama tidak dihapus.
  created_at   timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skrining_admisi ON public.skrining(admission_id, jenis, dinilai_at DESC);

-- ── 3. CATATAN PEMBERIAN OBAT (MAR) ───────────────────────────────
-- Jadwal pemberian: apa, berapa, kapan saja.
CREATE TABLE IF NOT EXISTS public.mar_jadwal (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id  bigint,
  stay_id       bigint,
  patient_name  text,
  mr_number     text,
  prescription_id bigint,
  nama_obat     text NOT NULL,
  dosis         text NOT NULL,
  rute          text,
  frekuensi     text,                 -- 3x1, tiap 8 jam, dsb
  -- Jam pemberian dalam sehari, mis. ["06:00","14:00","22:00"].
  jam_pemberian jsonb DEFAULT '[]'::jsonb,
  mulai_tgl     date DEFAULT current_date,
  sampai_tgl    date,
  instruksi     text,
  diresepkan_oleh text,
  -- Aktif | Dihentikan | Selesai
  status        text DEFAULT 'Aktif',
  alasan_henti  text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marjadwal ON public.mar_jadwal(admission_id, status);

-- Tiap pemberian dicatat satu baris. Termasuk yang TIDAK diberikan —
-- dosis yang dilewati adalah informasi klinis, bukan ketiadaan data.
CREATE TABLE IF NOT EXISTS public.mar_pemberian (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jadwal_id    bigint REFERENCES public.mar_jadwal(id) ON DELETE CASCADE,
  jadwal_tgl   date NOT NULL,
  jadwal_jam   text NOT NULL,
  -- Diberikan | Ditunda | Ditolak Pasien | Dilewati | Dihentikan
  hasil        text NOT NULL,
  diberikan_at timestamp,
  oleh         text,
  -- Wajib bila hasilnya bukan "Diberikan". Ditegakkan fungsi di bawah.
  alasan       text,
  catatan      text,
  created_at   timestamp DEFAULT now(),
  -- Satu jadwal-jam hanya boleh punya satu catatan. Tanpa ini, obat
  -- yang sama bisa tercatat diberikan dua kali oleh dua perawat.
  UNIQUE (jadwal_id, jadwal_tgl, jadwal_jam)
);

-- ── 4. HITUNG EWS ─────────────────────────────────────────────────
-- Skor peringatan dini dari tanda vital. Ambangnya mengikuti pola NEWS
-- yang lazim; yang penting bukan angkanya persis, melainkan bahwa
-- pasien memburuk terdeteksi SEBELUM ia kolaps.
--
-- Fungsi ini murni menghitung — tidak menulis apa pun — supaya bisa
-- dipakai triase, rawat inap, dan rawat jalan tanpa efek samping.
CREATE OR REPLACE FUNCTION public.hitung_ews(
  p_napas int, p_spo2 int, p_suhu numeric, p_sistol int, p_nadi int,
  p_kesadaran text DEFAULT 'Sadar')
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
AS $fn$
DECLARE s int := 0; v_ada int := 0; v_merah boolean := false;
BEGIN
  IF p_napas IS NOT NULL THEN
    v_ada := v_ada + 1;
    s := s + CASE
      WHEN p_napas <= 8  THEN 3 WHEN p_napas <= 11 THEN 1
      WHEN p_napas <= 20 THEN 0 WHEN p_napas <= 24 THEN 2 ELSE 3 END;
    IF p_napas <= 8 OR p_napas >= 25 THEN v_merah := true; END IF;
  END IF;

  IF p_spo2 IS NOT NULL THEN
    v_ada := v_ada + 1;
    s := s + CASE
      WHEN p_spo2 <= 91 THEN 3 WHEN p_spo2 <= 93 THEN 2
      WHEN p_spo2 <= 95 THEN 1 ELSE 0 END;
    IF p_spo2 <= 91 THEN v_merah := true; END IF;
  END IF;

  IF p_suhu IS NOT NULL THEN
    v_ada := v_ada + 1;
    s := s + CASE
      WHEN p_suhu <= 35.0 THEN 3 WHEN p_suhu <= 36.0 THEN 1
      WHEN p_suhu <= 38.0 THEN 0 WHEN p_suhu <= 39.0 THEN 1 ELSE 2 END;
    IF p_suhu <= 35.0 THEN v_merah := true; END IF;
  END IF;

  IF p_sistol IS NOT NULL THEN
    v_ada := v_ada + 1;
    s := s + CASE
      WHEN p_sistol <= 90  THEN 3 WHEN p_sistol <= 100 THEN 2
      WHEN p_sistol <= 110 THEN 1 WHEN p_sistol <= 219 THEN 0 ELSE 3 END;
    IF p_sistol <= 90 OR p_sistol >= 220 THEN v_merah := true; END IF;
  END IF;

  IF p_nadi IS NOT NULL THEN
    v_ada := v_ada + 1;
    s := s + CASE
      WHEN p_nadi <= 40  THEN 3 WHEN p_nadi <= 50  THEN 1
      WHEN p_nadi <= 90  THEN 0 WHEN p_nadi <= 110 THEN 1
      WHEN p_nadi <= 130 THEN 2 ELSE 3 END;
    IF p_nadi <= 40 OR p_nadi >= 131 THEN v_merah := true; END IF;
  END IF;

  IF p_kesadaran IS NOT NULL AND lower(p_kesadaran) <> 'sadar' THEN
    v_ada := v_ada + 1;
    s := s + 3;
    v_merah := true;
  ELSIF p_kesadaran IS NOT NULL THEN
    v_ada := v_ada + 1;
  END IF;

  -- Skor dari tanda vital yang tidak lengkap menyesatkan: pasien bisa
  -- terlihat aman hanya karena yang buruk tidak diukur. Kelengkapannya
  -- ikut dikembalikan supaya layar bisa mengatakannya.
  RETURN jsonb_build_object(
    'skor', s,
    'parameter_terisi', v_ada,
    'lengkap', (v_ada >= 5),
    'ada_parameter_merah', v_merah,
    'tingkat', CASE
      WHEN v_merah OR s >= 7 THEN 'Tinggi'
      WHEN s >= 5            THEN 'Sedang'
      WHEN s >= 1            THEN 'Rendah'
      ELSE 'Normal' END,
    'anjuran', CASE
      WHEN v_merah OR s >= 7 THEN 'Panggil dokter segera; pertimbangkan tim reaksi cepat.'
      WHEN s >= 5            THEN 'Lapor perawat penanggung jawab; ulangi tiap 1 jam.'
      WHEN s >= 1            THEN 'Ulangi pengukuran tiap 4-6 jam.'
      ELSE 'Pemantauan rutin.' END);
END $fn$;

-- ── 5. CATAT TRIASE ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.triase_catat(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_id bigint; v_no text; v_level int; v_ews jsonb; v_target int;
  v_ulang bigint;
BEGIN
  v_level := NULLIF(p_data->>'level','')::int;
  IF v_level IS NULL OR v_level < 1 OR v_level > 5 THEN
    RETURN jsonb_build_object('error','Level triase harus 1 sampai 5.');
  END IF;
  IF COALESCE(btrim(p_data->>'patient_name'),'') = '' THEN
    RETURN jsonb_build_object('error','Nama pasien wajib diisi.');
  END IF;
  IF COALESCE(btrim(p_data->>'keluhan_utama'),'') = '' THEN
    RETURN jsonb_build_object('error','Keluhan utama wajib diisi.');
  END IF;
  IF COALESCE(btrim(p_data->>'petugas_triase'),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Nama petugas triase wajib diisi — keputusan kegawatan harus ada '
      || 'yang bertanggung jawab.');
  END IF;

  v_ews := public.hitung_ews(
    NULLIF(p_data->>'napas','')::int, NULLIF(p_data->>'spo2','')::int,
    NULLIF(p_data->>'suhu','')::numeric, NULLIF(p_data->>'td_sistol','')::int,
    NULLIF(p_data->>'nadi','')::int, COALESCE(p_data->>'kesadaran','Sadar'));

  -- Target waktu tunggu maksimal menurut level.
  v_target := CASE v_level
    WHEN 1 THEN 0 WHEN 2 THEN 10 WHEN 3 THEN 30
    WHEN 4 THEN 60 ELSE 120 END;

  v_ulang := NULLIF(p_data->>'triase_ulang_dari','')::bigint;

  v_no := 'TRI-' || to_char(now(),'YYMMDD') || '-' ||
          lpad((COALESCE((SELECT count(*) FROM public.triase
                          WHERE created_at::date = current_date),0) + 1)::text, 4, '0');

  INSERT INTO public.triase
    (no_triase, admission_id, patient_name, mr_number, usia_tahun, jenis_kelamin,
     cara_datang, keluhan_utama, level, alasan_level,
     td_sistol, td_diastol, nadi, napas, suhu, spo2, kesadaran,
     ews_skor, target_menit, ruang_tujuan, petugas_triase, triase_ulang_dari)
  VALUES (v_no, NULLIF(p_data->>'admission_id','')::bigint,
          btrim(p_data->>'patient_name'), p_data->>'mr_number',
          NULLIF(p_data->>'usia_tahun','')::int, p_data->>'jenis_kelamin',
          p_data->>'cara_datang', btrim(p_data->>'keluhan_utama'),
          v_level, p_data->>'alasan_level',
          NULLIF(p_data->>'td_sistol','')::int, NULLIF(p_data->>'td_diastol','')::int,
          NULLIF(p_data->>'nadi','')::int, NULLIF(p_data->>'napas','')::int,
          NULLIF(p_data->>'suhu','')::numeric, NULLIF(p_data->>'spo2','')::int,
          p_data->>'kesadaran', (v_ews->>'skor')::int, v_target,
          p_data->>'ruang_tujuan', btrim(p_data->>'petugas_triase'), v_ulang)
  RETURNING id INTO v_id;

  -- Triase lama ditutup bila ini triase ulang.
  IF v_ulang IS NOT NULL THEN
    UPDATE public.triase SET status = 'Ditangani', updated_at = now()
     WHERE id = v_ulang AND status = 'Aktif';
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_triase', v_no,
    'level', v_level, 'target_menit', v_target, 'ews', v_ews,
    'peringatan', CASE
      WHEN v_level >= 4 AND (v_ews->>'tingkat') = 'Tinggi'
        THEN 'Tanda vital menunjukkan EWS tinggi padahal level triase '
          || v_level || '. Tinjau ulang penilaian kegawatannya.'
      WHEN NOT (v_ews->>'lengkap')::boolean
        THEN 'Tanda vital belum lengkap — skor EWS belum bisa diandalkan.' END);
END $fn$;

-- ── 6. CATAT SKRINING ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.skrining_catat(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_id bigint; v_jenis text; v_kat text; v_skor numeric;
BEGIN
  v_jenis := lower(btrim(COALESCE(p_data->>'jenis','')));
  IF v_jenis NOT IN ('jatuh','nyeri','gizi') THEN
    RETURN jsonb_build_object('error','Jenis skrining harus jatuh, nyeri, atau gizi.');
  END IF;
  IF NULLIF(p_data->>'admission_id','') IS NULL THEN
    RETURN jsonb_build_object('error','Skrining harus menempel pada kunjungan.');
  END IF;
  IF COALESCE(btrim(p_data->>'instrumen'),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Alat ukur wajib disebutkan — skor 45 pada satu instrumen berarti '
      || 'hal yang berbeda pada instrumen lain.');
  END IF;

  v_skor := NULLIF(p_data->>'skor','')::numeric;
  v_kat := NULLIF(btrim(COALESCE(p_data->>'kategori','')),'');
  IF v_kat IS NULL THEN
    RETURN jsonb_build_object('error',
      'Kategori risiko (Rendah/Sedang/Tinggi) wajib diisi — skor mentah '
      || 'tanpa kategori tidak bisa ditindaklanjuti perawat.');
  END IF;

  -- Risiko tinggi menuntut tindak lanjut yang tertulis.
  IF lower(v_kat) = 'tinggi'
     AND COALESCE(btrim(p_data->>'tindak_lanjut'),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Risiko tinggi harus disertai tindak lanjut. Menandai pasien '
      || 'berisiko tinggi tanpa berbuat apa-apa tidak melindungi siapa pun.');
  END IF;

  INSERT INTO public.skrining
    (admission_id, patient_name, mr_number, jenis, instrumen, skor,
     kategori, rincian, tindak_lanjut, dinilai_oleh)
  VALUES ((p_data->>'admission_id')::bigint, p_data->>'patient_name',
          p_data->>'mr_number', v_jenis, btrim(p_data->>'instrumen'), v_skor,
          initcap(v_kat), COALESCE(p_data->'rincian','{}'::jsonb),
          p_data->>'tindak_lanjut', p_data->>'dinilai_oleh')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'kategori', initcap(v_kat));
END $fn$;

-- ── 7. CATAT PEMBERIAN OBAT ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mar_catat(
  p_jadwal_id bigint, p_tgl date, p_jam text, p_hasil text,
  p_oleh text, p_alasan text DEFAULT NULL, p_catatan text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_j record; v_id bigint;
BEGIN
  SELECT * INTO v_j FROM public.mar_jadwal WHERE id = p_jadwal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Jadwal obat tidak ditemukan.'); END IF;

  IF p_hasil NOT IN ('Diberikan','Ditunda','Ditolak Pasien','Dilewati','Dihentikan') THEN
    RETURN jsonb_build_object('error','Hasil pemberian tidak dikenal.');
  END IF;
  IF COALESCE(btrim(p_oleh),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Nama pemberi wajib diisi — obat yang diberikan tanpa pencatat '
      || 'tidak bisa ditelusuri bila terjadi sesuatu.');
  END IF;

  -- Yang TIDAK diberikan wajib beralasan. Dosis terlewat tanpa alasan
  -- tidak bisa dibedakan dari lupa mencatat, dan keduanya menuntut
  -- tindakan yang berbeda.
  IF p_hasil <> 'Diberikan' AND COALESCE(btrim(p_alasan),'') = '' THEN
    RETURN jsonb_build_object('error',
      format('Hasil "%s" wajib disertai alasan.', p_hasil));
  END IF;

  IF v_j.status <> 'Aktif' AND p_hasil = 'Diberikan' THEN
    RETURN jsonb_build_object('error',
      format('Jadwal obat ini berstatus "%s" — tidak boleh diberikan.', v_j.status));
  END IF;

  INSERT INTO public.mar_pemberian
    (jadwal_id, jadwal_tgl, jadwal_jam, hasil, diberikan_at, oleh, alasan, catatan)
  VALUES (p_jadwal_id, p_tgl, p_jam, p_hasil,
          CASE WHEN p_hasil = 'Diberikan' THEN now() END,
          btrim(p_oleh), p_alasan, p_catatan)
  ON CONFLICT (jadwal_id, jadwal_tgl, jadwal_jam) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('error',
      format('Dosis %s jam %s sudah tercatat sebelumnya.', p_tgl, p_jam));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'obat', v_j.nama_obat);
END $fn$;

-- ── 8. PAPAN ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.triase_papan AS
SELECT t.*,
       EXTRACT(EPOCH FROM (COALESCE(t.dilihat_dokter_at, now()) - t.tiba_at))/60
         AS menit_tunggu,
       (t.dilihat_dokter_at IS NULL AND t.status = 'Aktif'
        AND EXTRACT(EPOCH FROM (now() - t.tiba_at))/60 > t.target_menit)
         AS lewat_target,
       CASE t.level
         WHEN 1 THEN 'Resusitasi' WHEN 2 THEN 'Emergensi' WHEN 3 THEN 'Urgen'
         WHEN 4 THEN 'Kurang Urgen' ELSE 'Tidak Urgen' END AS label_level
  FROM public.triase t;

-- Skrining terakhir per jenis per kunjungan, plus mana yang belum ada.
CREATE OR REPLACE VIEW public.skrining_terakhir AS
SELECT DISTINCT ON (admission_id, jenis)
       id, admission_id, patient_name, mr_number, jenis, instrumen,
       skor, kategori, tindak_lanjut, dinilai_oleh, dinilai_at
  FROM public.skrining
 ORDER BY admission_id, jenis, dinilai_at DESC;

CREATE OR REPLACE VIEW public.mar_papan AS
SELECT j.id AS jadwal_id, j.admission_id, j.patient_name, j.mr_number,
       j.nama_obat, j.dosis, j.rute, j.frekuensi, j.jam_pemberian,
       j.mulai_tgl, j.sampai_tgl, j.status, j.diresepkan_oleh,
       (SELECT count(*) FROM public.mar_pemberian p
         WHERE p.jadwal_id = j.id AND p.hasil = 'Diberikan')      AS jml_diberikan,
       (SELECT count(*) FROM public.mar_pemberian p
         WHERE p.jadwal_id = j.id AND p.hasil <> 'Diberikan')     AS jml_tidak_diberikan,
       (SELECT max(p.diberikan_at) FROM public.mar_pemberian p
         WHERE p.jadwal_id = j.id AND p.hasil = 'Diberikan')      AS terakhir_diberikan
  FROM public.mar_jadwal j;

GRANT SELECT ON public.triase_papan, public.skrining_terakhir, public.mar_papan
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hitung_ews(int,int,numeric,int,int,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.triase_catat(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.skrining_catat(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mar_catat(bigint,date,text,text,text,text,text) TO authenticated, service_role;
