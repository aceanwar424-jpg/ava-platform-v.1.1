-- ══════════════════════════════════════════════════════════════════
-- VAKSINASI & IMUNISASI
--
-- Mengisi menu his-immunization yang berstatus "belum".
--
-- ── DUA PENJAGAAN YANG TIDAK BOLEH ADA DI LAYAR SAJA ──────────────
--
-- 1. Vaksin kedaluwarsa atau yang rantai dinginnya rusak TIDAK BISA
--    disuntikkan. Vaksin yang pernah terpapar suhu di luar rentang
--    kehilangan potensinya tanpa berubah rupa — pasien tetap disuntik,
--    tetap merasa terlindungi, dan tidak ada yang tahu sampai ia jatuh
--    sakit. Penanda VVM (Vaccine Vial Monitor) pada botol adalah satu-
--    satunya cara melihatnya, dan hasilnya dicatat di sini.
--
-- 2. Dosis berikutnya tidak boleh diberikan sebelum interval minimalnya
--    lewat. Memberi terlalu cepat membuat dosis itu tidak dihitung dan
--    seri harus diulang.
--
-- Keduanya dijaga di basis data. Petugas imunisasi bekerja cepat di
-- posyandu dan klinik ramai; penjagaan yang hanya ada di layar akan
-- dilewati justru pada hari tersibuk.
--
-- ── YANG SENGAJA TIDAK DIPUTUSKAN DI SINI ─────────────────────────
-- Jadwal imunisasi nasional (IDAI/Kemenkes) TIDAK ditanam sebagai data
-- bawaan. Jadwal berubah, berbeda antar program, dan berbeda untuk
-- pasien dengan kondisi khusus. Yang dibangun adalah tempatnya; isinya
-- ditetapkan penanggung jawab program dan tercatat siapa yang menetapkan.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. MASTER VAKSIN ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vaksin (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode          text UNIQUE NOT NULL,
  nama          text NOT NULL,
  nama_dagang   text,
  produsen      text,
  jenis         text,                    -- Hidup dilemahkan | Inaktif | mRNA | Toksoid
  penyakit      text,                    -- yang dicegah
  rute          text,                    -- IM | SC | ID | Oral
  dosis_ml      numeric,
  lokasi_suntik text,
  -- Berapa dosis untuk seri lengkap, dan jarak minimal antar dosis.
  -- Ditetapkan penanggung jawab program, bukan bawaan sistem.
  total_dosis   int DEFAULT 1,
  interval_min_hari int,
  usia_min_bulan  int,
  usia_max_bulan  int,
  kontraindikasi text,
  suhu_simpan   text,
  status        text DEFAULT 'Aktif',
  ditetapkan_oleh text,
  created_at    timestamp DEFAULT now()
);

-- ── 2. BATCH VAKSIN ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vaksin_batch (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vaksin_id     bigint REFERENCES public.vaksin(id) ON DELETE CASCADE,
  no_batch      text NOT NULL,
  tgl_kedaluwarsa date,
  qty_terima    numeric DEFAULT 0,
  qty_sisa      numeric DEFAULT 0,
  tgl_terima    date DEFAULT current_date,
  pemasok       text,
  lokasi_simpan text,
  -- Penanda VVM pada botol. A dan B masih boleh dipakai; C dan D berarti
  -- vaksin sudah terpapar panas berlebih dan HARUS dibuang.
  vvm           text DEFAULT 'A',
  suhu_terakhir numeric,
  suhu_dicek_at timestamp,
  -- Aktif | Ditarik | Dibuang
  status        text DEFAULT 'Aktif',
  alasan_buang  text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now(),
  UNIQUE (vaksin_id, no_batch)
);
CREATE INDEX IF NOT EXISTS idx_vbatch_exp ON public.vaksin_batch(vaksin_id, tgl_kedaluwarsa);

-- ── 3. PEMBERIAN IMUNISASI ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.imunisasi (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_imunisasi  text UNIQUE,
  admission_id  bigint,
  patient_name  text NOT NULL,
  mr_number     text,
  tgl_lahir     date,
  usia_bulan    int,
  vaksin_id     bigint REFERENCES public.vaksin(id),
  batch_id      bigint REFERENCES public.vaksin_batch(id),
  no_batch      text,                    -- disalin; batch bisa dihapus, catatan tidak
  dosis_ke      int DEFAULT 1,
  tgl_beri      timestamp DEFAULT now(),
  rute          text,
  lokasi_suntik text,
  penyuntik     text,
  -- Tanggal jatuh tempo dosis berikutnya, dihitung dari interval vaksin.
  tgl_dosis_berikut date,
  catatan       text,
  created_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_imunisasi_pasien ON public.imunisasi(mr_number, vaksin_id, dosis_ke);
CREATE INDEX IF NOT EXISTS idx_imunisasi_berikut ON public.imunisasi(tgl_dosis_berikut);

-- ── 4. KIPI — KEJADIAN IKUTAN PASCA IMUNISASI ─────────────────────
-- Wajib dilaporkan. Dipisahkan dari catatan bebas supaya kejadian yang
-- perlu dilaporkan tidak tenggelam di kolom catatan.
CREATE TABLE IF NOT EXISTS public.imunisasi_kipi (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  imunisasi_id  bigint REFERENCES public.imunisasi(id) ON DELETE CASCADE,
  gejala        text NOT NULL,
  mulai_at      timestamp,
  -- Ringan | Sedang | Berat
  derajat       text,
  tindakan      text,
  dirawat       boolean DEFAULT false,
  dilaporkan_ke text,
  dilaporkan_at timestamp,
  hasil_akhir   text,
  dicatat_oleh  text,
  created_at    timestamp DEFAULT now()
);

-- ── 5. BERI IMUNISASI — GERBANG KEAMANAN ──────────────────────────
CREATE OR REPLACE FUNCTION public.imunisasi_beri(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_v record; v_b record; v_id bigint; v_no text;
  v_terakhir record; v_dosis int; v_jarak int; v_berikut date;
BEGIN
  SELECT * INTO v_b FROM public.vaksin_batch
   WHERE id = NULLIF(p_data->>'batch_id','')::bigint FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Batch vaksin tidak ditemukan.'); END IF;

  SELECT * INTO v_v FROM public.vaksin WHERE id = v_b.vaksin_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Vaksin tidak ditemukan.'); END IF;

  IF COALESCE(btrim(p_data->>'patient_name'),'') = '' THEN
    RETURN jsonb_build_object('error','Nama pasien wajib diisi.');
  END IF;
  IF COALESCE(btrim(p_data->>'penyuntik'),'') = '' THEN
    RETURN jsonb_build_object('error','Nama penyuntik wajib diisi.');
  END IF;

  -- ── Penjagaan 1: batch tidak layak ──
  IF v_b.status <> 'Aktif' THEN
    RETURN jsonb_build_object('error',
      format('Batch ini berstatus "%s" dan tidak boleh dipakai.', v_b.status));
  END IF;

  IF v_b.tgl_kedaluwarsa IS NOT NULL AND v_b.tgl_kedaluwarsa < current_date THEN
    RETURN jsonb_build_object('error',
      format('Vaksin batch %s sudah kedaluwarsa (%s).', v_b.no_batch, v_b.tgl_kedaluwarsa));
  END IF;

  -- VVM C dan D berarti vaksin sudah terpapar panas berlebih. Ia terlihat
  -- sama persis dengan yang masih baik; penanda inilah satu-satunya
  -- pembedanya.
  IF upper(COALESCE(v_b.vvm,'A')) IN ('C','D') THEN
    RETURN jsonb_build_object('error',
      format('Penanda VVM batch %s berada di tingkat %s — vaksin sudah '
             || 'terpapar panas berlebih dan harus dibuang, bukan disuntikkan.',
             v_b.no_batch, upper(v_b.vvm)));
  END IF;

  IF COALESCE(v_b.qty_sisa, 0) <= 0 THEN
    RETURN jsonb_build_object('error',
      format('Batch %s sudah habis.', v_b.no_batch));
  END IF;

  -- ── Penjagaan 2: interval antar dosis ──
  SELECT * INTO v_terakhir FROM public.imunisasi
   WHERE vaksin_id = v_v.id
     AND ( (NULLIF(p_data->>'mr_number','') IS NOT NULL
            AND mr_number = p_data->>'mr_number')
        OR (NULLIF(p_data->>'mr_number','') IS NULL
            AND lower(patient_name) = lower(btrim(p_data->>'patient_name'))) )
   ORDER BY dosis_ke DESC, tgl_beri DESC LIMIT 1;

  v_dosis := COALESCE(v_terakhir.dosis_ke, 0) + 1;

  IF v_terakhir.id IS NOT NULL AND COALESCE(v_v.interval_min_hari, 0) > 0 THEN
    v_jarak := (current_date - v_terakhir.tgl_beri::date);
    IF v_jarak < v_v.interval_min_hari THEN
      RETURN jsonb_build_object('error',
        format('Dosis ke-%s baru boleh diberikan %s hari setelah dosis '
               || 'sebelumnya. Baru lewat %s hari — bila diberikan sekarang, '
               || 'dosis ini tidak dihitung dan serinya harus diulang.',
               v_dosis, v_v.interval_min_hari, v_jarak));
    END IF;
  END IF;

  IF v_dosis > COALESCE(v_v.total_dosis, 1) THEN
    RETURN jsonb_build_object('error',
      format('Seri %s sudah lengkap (%s dosis). Dosis tambahan perlu '
             || 'keputusan dokter dan dicatat sebagai booster terpisah.',
             v_v.nama, v_v.total_dosis));
  END IF;

  -- ── Catat ──
  -- Nomor diturunkan dari akhiran tertinggi yang sudah ada untuk awalan
  -- hari ini, BUKAN dari menghitung baris. Menghitung baris berdasarkan
  -- tgl_beri salah: tanggal pemberian bisa dimundurkan saat mencatat
  -- vaksinasi yang diberikan kemarin, penghitungnya mengulang, dan
  -- nomornya bentrok. Menghitung baris juga salah bila ada baris yang
  -- dihapus.
  SELECT 'IMN-' || to_char(now(),'YYMMDD') || '-' ||
         lpad((COALESCE(max(NULLIF(regexp_replace(no_imunisasi, '^.*-', ''), '')::int), 0)
               + 1)::text, 4, '0')
    INTO v_no
    FROM public.imunisasi
   WHERE no_imunisasi LIKE 'IMN-' || to_char(now(),'YYMMDD') || '-%';

  IF v_dosis < COALESCE(v_v.total_dosis, 1) AND COALESCE(v_v.interval_min_hari,0) > 0 THEN
    v_berikut := current_date + v_v.interval_min_hari;
  END IF;

  INSERT INTO public.imunisasi
    (no_imunisasi, admission_id, patient_name, mr_number, tgl_lahir, usia_bulan,
     vaksin_id, batch_id, no_batch, dosis_ke, rute, lokasi_suntik, penyuntik,
     tgl_dosis_berikut, catatan)
  VALUES (v_no, NULLIF(p_data->>'admission_id','')::bigint,
          btrim(p_data->>'patient_name'), NULLIF(p_data->>'mr_number',''),
          NULLIF(p_data->>'tgl_lahir','')::date,
          NULLIF(p_data->>'usia_bulan','')::int,
          v_v.id, v_b.id, v_b.no_batch, v_dosis,
          COALESCE(p_data->>'rute', v_v.rute),
          COALESCE(p_data->>'lokasi_suntik', v_v.lokasi_suntik),
          btrim(p_data->>'penyuntik'), v_berikut, p_data->>'catatan')
  RETURNING id INTO v_id;

  UPDATE public.vaksin_batch
     SET qty_sisa = qty_sisa - 1, updated_at = now() WHERE id = v_b.id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_imunisasi', v_no,
    'vaksin', v_v.nama, 'dosis_ke', v_dosis, 'total_dosis', v_v.total_dosis,
    'no_batch', v_b.no_batch, 'dosis_berikut', v_berikut,
    'seri_lengkap', (v_dosis >= COALESCE(v_v.total_dosis, 1)));
END $fn$;

-- ── 6. TANDAI BATCH TIDAK LAYAK ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.vaksin_batch_buang(
  p_batch_id bigint, p_alasan text, p_vvm text DEFAULT NULL,
  p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_b record;
BEGIN
  IF COALESCE(btrim(p_alasan),'') = '' THEN
    RETURN jsonb_build_object('error','Alasan pembuangan wajib diisi.');
  END IF;
  SELECT * INTO v_b FROM public.vaksin_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Batch tidak ditemukan.'); END IF;

  UPDATE public.vaksin_batch
     SET status = 'Dibuang', alasan_buang = btrim(p_alasan),
         vvm = COALESCE(p_vvm, vvm),
         qty_sisa = 0, updated_at = now()
   WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'no_batch', v_b.no_batch,
    'sisa_dibuang', v_b.qty_sisa);
END $fn$;

-- ── 7. PAPAN & PENGINGAT ──────────────────────────────────────────
CREATE OR REPLACE VIEW public.imunisasi_papan AS
SELECT i.*, v.nama AS nama_vaksin, v.penyakit, v.total_dosis,
       v.interval_min_hari,
       b.tgl_kedaluwarsa, b.vvm, b.status AS status_batch,
       (i.dosis_ke >= COALESCE(v.total_dosis, 1))            AS seri_lengkap,
       (SELECT count(*) FROM public.imunisasi_kipi k
         WHERE k.imunisasi_id = i.id)                        AS jml_kipi,
       CASE WHEN i.tgl_dosis_berikut IS NOT NULL
            THEN (i.tgl_dosis_berikut - current_date) END    AS hari_ke_dosis_berikut
  FROM public.imunisasi i
  LEFT JOIN public.vaksin       v ON v.id = i.vaksin_id
  LEFT JOIN public.vaksin_batch b ON b.id = i.batch_id;

-- Dosis yang jatuh tempo dan belum diberikan. Dihitung dari catatan
-- terakhir tiap pasien per vaksin — bukan disimpan sebagai daftar
-- terpisah yang harus dijaga tetap sinkron.
CREATE OR REPLACE VIEW public.imunisasi_jatuh_tempo AS
SELECT DISTINCT ON (i.mr_number, i.patient_name, i.vaksin_id)
       i.id AS imunisasi_terakhir_id, i.patient_name, i.mr_number,
       i.vaksin_id, v.nama AS nama_vaksin,
       i.dosis_ke AS dosis_terakhir, v.total_dosis,
       i.tgl_beri AS tgl_dosis_terakhir, i.tgl_dosis_berikut,
       (current_date - i.tgl_dosis_berikut) AS telat_hari
  FROM public.imunisasi i
  LEFT JOIN public.vaksin v ON v.id = i.vaksin_id
 WHERE i.tgl_dosis_berikut IS NOT NULL
   AND i.dosis_ke < COALESCE(v.total_dosis, 1)
 ORDER BY i.mr_number, i.patient_name, i.vaksin_id, i.dosis_ke DESC;

-- Batch yang perlu perhatian: kedaluwarsa, hampir kedaluwarsa, atau
-- penanda VVM sudah bergerak.
CREATE OR REPLACE VIEW public.vaksin_batch_perhatian AS
SELECT b.*, v.nama AS nama_vaksin,
       (b.tgl_kedaluwarsa - current_date) AS sisa_hari,
       CASE
         WHEN b.status <> 'Aktif' THEN b.status
         WHEN upper(COALESCE(b.vvm,'A')) IN ('C','D') THEN 'VVM tidak layak'
         WHEN b.tgl_kedaluwarsa < current_date THEN 'Kedaluwarsa'
         WHEN b.tgl_kedaluwarsa <= current_date + 30 THEN 'Segera kedaluwarsa'
         ELSE 'Layak' END AS perhatian
  FROM public.vaksin_batch b
  LEFT JOIN public.vaksin v ON v.id = b.vaksin_id;

GRANT SELECT ON public.imunisasi_papan, public.imunisasi_jatuh_tempo,
                public.vaksin_batch_perhatian
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.imunisasi_beri(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vaksin_batch_buang(bigint,text,text,text) TO authenticated, service_role;
