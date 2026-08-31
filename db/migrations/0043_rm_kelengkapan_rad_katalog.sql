-- ══════════════════════════════════════════════════════════════════
-- KELENGKAPAN & RETENSI REKAM MEDIS  +  KATALOG RADIOLOGI
--
-- Mengisi tiga menu berstatus "belum":
--   his-mr-governance  Kelengkapan & Retensi Rekam Medis
--   rad-katalog        Katalog Pemeriksaan Radiologi
--   rad-modalitas      Modalitas & Jadwal Alat  (tabel modalities sudah
--                      ada — yang ditambahkan hanya jadwal & kapasitas)
--
-- ── KENAPA KELENGKAPAN DIHITUNG, BUKAN DICENTANG ──────────────────
-- Godaannya membuat daftar centang yang diisi petugas. Itu mengukur
-- kerajinan mencentang, bukan kelengkapan berkas. Yang dipakai di sini:
-- keberadaan isian diperiksa langsung ke tabelnya — ada anamnesa atau
-- tidak, ada diagnosa atau tidak, ada resume pulang atau tidak.
--
-- Yang tetap perlu dicentang manual hanya yang tidak punya tabel
-- sendiri (mis. lembar persetujuan kertas yang dipindai), dan itu
-- dibedakan jelas dari yang terhitung otomatis.
--
-- ── RETENSI ───────────────────────────────────────────────────────
-- Masa simpan rekam medis diatur peraturan, dan angkanya berbeda untuk
-- rekam medis umum, anak, dan kasus tertentu. Angkanya TIDAK ditanam di
-- sini — ia ditetapkan penanggung jawab rekam medis beserta dasar
-- hukumnya, supaya saat berubah tidak perlu menyunting kode dan ada
-- jejak siapa menetapkan.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. ATURAN RETENSI ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rm_aturan_retensi (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode          text UNIQUE NOT NULL,
  nama          text NOT NULL,
  -- Kepada siapa aturan ini berlaku: 'umum', 'anak', atau kategori lain
  -- yang ditetapkan lab/rumah sakit.
  berlaku_untuk text,
  simpan_tahun  int NOT NULL,
  -- Sesudah masa aktif, sebagian berkas dimusnahkan dan sebagian
  -- diabadikan (ringkasan, persetujuan, hasil penting).
  abadikan      text,
  dasar_hukum   text,
  ditetapkan_oleh text,
  tgl_berlaku   date,
  aktif         boolean DEFAULT true,
  created_at    timestamp DEFAULT now()
);

-- ── 2. UNSUR KELENGKAPAN ──────────────────────────────────────────
-- Tiap unsur menyebut CARA memeriksanya. Yang otomatis punya sumber
-- tabel; yang manual tidak, dan itu terlihat di layar.
CREATE TABLE IF NOT EXISTS public.rm_unsur (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode         text UNIQUE NOT NULL,
  nama         text NOT NULL,
  kelompok     text,                     -- Identitas | Anamnesis | Pemeriksaan | Tindakan | Pulang
  -- otomatis: dihitung dari tabel sumber. manual: dicentang petugas.
  cara_periksa text DEFAULT 'otomatis',
  sumber_tabel text,                     -- untuk yang otomatis
  wajib        boolean DEFAULT true,
  berlaku_rawat text,                    -- Jalan | Inap | Semua
  urutan       int DEFAULT 0,
  aktif        boolean DEFAULT true
);

-- ── 3. PENILAIAN KELENGKAPAN PER KUNJUNGAN ────────────────────────
CREATE TABLE IF NOT EXISTS public.rm_kelengkapan (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id  bigint NOT NULL,
  visit_number  text,
  patient_name  text,
  mr_number     text,
  dinilai_at    timestamp DEFAULT now(),
  dinilai_oleh  text,
  jml_wajib     int DEFAULT 0,
  jml_terpenuhi int DEFAULT 0,
  persen        numeric DEFAULT 0,
  -- Lengkap | Tidak Lengkap
  hasil         text,
  kurang        jsonb DEFAULT '[]'::jsonb,
  -- Retensi
  aturan_id     bigint REFERENCES public.rm_aturan_retensi(id),
  simpan_sampai date,
  dimusnahkan_at timestamp,
  dimusnahkan_oleh text,
  berita_acara  text,
  created_at    timestamp DEFAULT now(),
  UNIQUE (admission_id)
);
CREATE INDEX IF NOT EXISTS idx_rmkelengkapan_hasil ON public.rm_kelengkapan(hasil);
CREATE INDEX IF NOT EXISTS idx_rmkelengkapan_retensi
  ON public.rm_kelengkapan(simpan_sampai) WHERE dimusnahkan_at IS NULL;

-- Centang manual untuk unsur yang tidak punya tabel sumber.
CREATE TABLE IF NOT EXISTS public.rm_kelengkapan_manual (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id bigint NOT NULL,
  unsur_id     bigint REFERENCES public.rm_unsur(id) ON DELETE CASCADE,
  ada          boolean DEFAULT false,
  catatan      text,
  dicek_oleh   text,
  dicek_at     timestamp DEFAULT now(),
  UNIQUE (admission_id, unsur_id)
);

-- ── 4. HITUNG KELENGKAPAN ─────────────────────────────────────────
-- Keberadaan isian diperiksa langsung ke tabelnya. Daftar tabel yang
-- dikenali disebutkan di sini; unsur yang sumbernya di luar daftar ini
-- diperlakukan sebagai manual, bukan diam-diam dianggap terpenuhi.
CREATE OR REPLACE FUNCTION public.rm_hitung_kelengkapan(
  p_admission_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_a record; v_u record; v_ada boolean; v_n int;
  v_wajib int := 0; v_ok int := 0; v_kurang jsonb := '[]'::jsonb;
  v_rawat text; v_aturan record; v_sampai date; v_persen numeric;
BEGIN
  SELECT * INTO v_a FROM public.admissions WHERE id = p_admission_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Kunjungan tidak ditemukan.'); END IF;

  v_rawat := CASE WHEN COALESCE(v_a.is_inpatient, false) THEN 'Inap' ELSE 'Jalan' END;

  FOR v_u IN
    SELECT * FROM public.rm_unsur
     WHERE aktif AND (berlaku_rawat IS NULL OR berlaku_rawat IN ('Semua', v_rawat))
     ORDER BY urutan, id
  LOOP
    v_ada := false;

    IF v_u.cara_periksa = 'otomatis' AND v_u.sumber_tabel IS NOT NULL THEN
      v_n := 0;
      -- Daftar tertutup. Menerima nama tabel apa pun dari data berarti
      -- membiarkan isi tabel menentukan SQL yang dijalankan.
      CASE v_u.sumber_tabel
        WHEN 'anamnesas' THEN
          SELECT count(*) INTO v_n FROM public.anamnesas WHERE admission_id = p_admission_id;
        WHEN 'vital_signs' THEN
          SELECT count(*) INTO v_n FROM public.vital_signs WHERE admission_id = p_admission_id;
        WHEN 'icd_diagnostics' THEN
          SELECT count(*) INTO v_n FROM public.icd_diagnostics WHERE admission_id = p_admission_id;
        WHEN 'tindakan' THEN
          SELECT count(*) INTO v_n FROM public.tindakan WHERE admission_id = p_admission_id;
        WHEN 'tindakan_consent' THEN
          SELECT count(*) INTO v_n FROM public.tindakan_consent c
            JOIN public.tindakan t ON t.id = c.tindakan_id
           WHERE t.admission_id = p_admission_id;
        WHEN 'prescriptions' THEN
          BEGIN
            SELECT count(*) INTO v_n FROM public.prescriptions WHERE admission_id = p_admission_id;
          EXCEPTION WHEN undefined_table THEN v_n := 0; END;
        WHEN 'lab_samples' THEN
          SELECT count(*) INTO v_n FROM public.lab_samples WHERE admission_id = p_admission_id;
        WHEN 'radiology_orders' THEN
          SELECT count(*) INTO v_n FROM public.radiology_orders WHERE admission_id = p_admission_id;
        ELSE
          -- Sumber tidak dikenal: diperlakukan manual, bukan dianggap ada.
          v_n := -1;
      END CASE;

      IF v_n >= 0 THEN
        v_ada := (v_n > 0);
      ELSE
        SELECT COALESCE(m.ada, false) INTO v_ada
          FROM public.rm_kelengkapan_manual m
         WHERE m.admission_id = p_admission_id AND m.unsur_id = v_u.id;
        v_ada := COALESCE(v_ada, false);
      END IF;
    ELSE
      SELECT COALESCE(m.ada, false) INTO v_ada
        FROM public.rm_kelengkapan_manual m
       WHERE m.admission_id = p_admission_id AND m.unsur_id = v_u.id;
      v_ada := COALESCE(v_ada, false);
    END IF;

    IF v_u.wajib THEN
      v_wajib := v_wajib + 1;
      IF v_ada THEN v_ok := v_ok + 1;
      ELSE
        v_kurang := v_kurang || jsonb_build_object(
          'kode', v_u.kode, 'nama', v_u.nama, 'kelompok', v_u.kelompok,
          'cara', v_u.cara_periksa);
      END IF;
    END IF;
  END LOOP;

  v_persen := CASE WHEN v_wajib > 0 THEN ROUND(v_ok::numeric / v_wajib * 100, 1) ELSE 0 END;

  SELECT * INTO v_aturan FROM public.rm_aturan_retensi
   WHERE aktif ORDER BY (berlaku_untuk = 'umum') DESC, id LIMIT 1;
  IF v_aturan.id IS NOT NULL THEN
    v_sampai := COALESCE(v_a.visit_date, current_date)
              + (v_aturan.simpan_tahun || ' years')::interval;
  END IF;

  INSERT INTO public.rm_kelengkapan
    (admission_id, visit_number, patient_name, mr_number, dinilai_oleh,
     jml_wajib, jml_terpenuhi, persen, hasil, kurang, aturan_id, simpan_sampai)
  VALUES (p_admission_id, v_a.visit_number, v_a.patient_name, v_a.mr_number,
          p_oleh, v_wajib, v_ok, v_persen,
          CASE WHEN v_wajib > 0 AND v_ok = v_wajib THEN 'Lengkap' ELSE 'Tidak Lengkap' END,
          v_kurang, v_aturan.id, v_sampai)
  ON CONFLICT (admission_id) DO UPDATE
    SET dinilai_at = now(), dinilai_oleh = EXCLUDED.dinilai_oleh,
        jml_wajib = EXCLUDED.jml_wajib, jml_terpenuhi = EXCLUDED.jml_terpenuhi,
        persen = EXCLUDED.persen, hasil = EXCLUDED.hasil,
        kurang = EXCLUDED.kurang, aturan_id = EXCLUDED.aturan_id,
        simpan_sampai = EXCLUDED.simpan_sampai;

  RETURN jsonb_build_object('ok', true, 'wajib', v_wajib, 'terpenuhi', v_ok,
    'persen', v_persen,
    'hasil', CASE WHEN v_wajib > 0 AND v_ok = v_wajib THEN 'Lengkap' ELSE 'Tidak Lengkap' END,
    'kurang', v_kurang, 'simpan_sampai', v_sampai,
    'catatan', CASE WHEN v_wajib = 0
      THEN 'Belum ada unsur kelengkapan yang ditetapkan — kelengkapan '
        || 'belum bisa dinilai.' END);
END $fn$;

-- ── 5. MUSNAHKAN BERKAS ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rm_musnahkan(
  p_admission_id bigint, p_berita_acara text, p_oleh text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_k record;
BEGIN
  IF COALESCE(btrim(p_oleh),'') = '' THEN
    RETURN jsonb_build_object('error','Nama petugas pemusnah wajib diisi.');
  END IF;
  IF COALESCE(btrim(p_berita_acara),'') = '' THEN
    RETURN jsonb_build_object('error','Nomor berita acara wajib diisi.');
  END IF;

  SELECT * INTO v_k FROM public.rm_kelengkapan
   WHERE admission_id = p_admission_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error',
      'Berkas ini belum pernah dinilai kelengkapannya — masa simpannya '
      || 'belum ditetapkan.');
  END IF;
  IF v_k.dimusnahkan_at IS NOT NULL THEN
    RETURN jsonb_build_object('error','Berkas ini sudah tercatat dimusnahkan.');
  END IF;
  IF v_k.simpan_sampai IS NULL THEN
    RETURN jsonb_build_object('error','Masa simpan belum ditetapkan.');
  END IF;
  IF v_k.simpan_sampai > current_date THEN
    RETURN jsonb_build_object('error',
      format('Belum melewati masa simpan (sampai %s).', v_k.simpan_sampai));
  END IF;

  UPDATE public.rm_kelengkapan
     SET dimusnahkan_at = now(), dimusnahkan_oleh = p_oleh,
         berita_acara = p_berita_acara
   WHERE admission_id = p_admission_id;

  RETURN jsonb_build_object('ok', true, 'visit_number', v_k.visit_number);
END $fn$;

-- ── 6. PAPAN KELENGKAPAN ──────────────────────────────────────────
CREATE OR REPLACE VIEW public.rm_papan AS
SELECT k.*, r.nama AS aturan_nama, r.simpan_tahun, r.dasar_hukum,
       CASE
         WHEN k.dimusnahkan_at IS NOT NULL THEN 'Dimusnahkan'
         WHEN k.simpan_sampai IS NULL       THEN 'Retensi belum ditetapkan'
         WHEN k.simpan_sampai < current_date THEN 'Siap Dimusnahkan'
         ELSE 'Aktif' END AS status_retensi,
       CASE WHEN k.simpan_sampai IS NOT NULL
            THEN (k.simpan_sampai - current_date) END AS sisa_hari
  FROM public.rm_kelengkapan k
  LEFT JOIN public.rm_aturan_retensi r ON r.id = k.aturan_id;

-- ══════════════════════════════════════════════════════════════════
-- KATALOG & MODALITAS RADIOLOGI
-- ══════════════════════════════════════════════════════════════════

-- Kolom tambahan pada modalities yang sudah ada — bukan tabel kedua.
ALTER TABLE public.modalities
  ADD COLUMN IF NOT EXISTS merk         text,
  ADD COLUMN IF NOT EXISTS model        text,
  ADD COLUMN IF NOT EXISTS jam_buka     text,
  ADD COLUMN IF NOT EXISTS jam_tutup    text,
  ADD COLUMN IF NOT EXISTS hari_operasi text,
  ADD COLUMN IF NOT EXISTS kapasitas_harian int,
  ADD COLUMN IF NOT EXISTS kalibrasi_terakhir date,
  ADD COLUMN IF NOT EXISTS kalibrasi_berikut  date,
  ADD COLUMN IF NOT EXISTS izin_bapeten text,
  ADD COLUMN IF NOT EXISTS izin_berlaku_sampai date;

CREATE TABLE IF NOT EXISTS public.rad_katalog (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode          text UNIQUE NOT NULL,
  nama          text NOT NULL,
  modality_id   bigint REFERENCES public.modalities(id),
  modality_code text,                    -- CR | CT | MR | US | MG
  region_tubuh  text,
  posisi        text,                    -- PA, AP, Lateral, dsb
  durasi_menit  int,
  tarif         numeric DEFAULT 0,
  -- Kontras adalah penentu persiapan pasien dan risiko; dipisahkan dari
  -- catatan bebas supaya tidak terlewat.
  pakai_kontras boolean DEFAULT false,
  jenis_kontras text,
  persiapan     text,
  kontraindikasi text,
  -- Dosis acuan (DRL) untuk pembanding. Dibiarkan NULL bila lab belum
  -- menetapkannya — angka dosis yang ditebak lebih buruk daripada kosong.
  drl_msv       numeric,
  status        text DEFAULT 'Aktif',
  created_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radkatalog_mod ON public.rad_katalog(modality_id, status);

-- Beban tiap modalitas hari ini, dihitung dari order — bukan disimpan.
CREATE OR REPLACE VIEW public.rad_modalitas_papan AS
SELECT m.id, m.code, m.name, m.room, m.slot_minutes, m.is_active,
       m.merk, m.model, m.jam_buka, m.jam_tutup, m.hari_operasi,
       m.kapasitas_harian, m.kalibrasi_terakhir, m.kalibrasi_berikut,
       m.izin_bapeten, m.izin_berlaku_sampai,
       CASE WHEN m.kalibrasi_berikut IS NOT NULL
            THEN (m.kalibrasi_berikut - current_date) END AS kalibrasi_sisa_hari,
       CASE WHEN m.izin_berlaku_sampai IS NOT NULL
            THEN (m.izin_berlaku_sampai - current_date) END AS izin_sisa_hari,
       (SELECT count(*) FROM public.radiology_orders o
         WHERE o.modality_id = m.id
           AND COALESCE(o.scheduled_at::date, o.performed_at::date) = current_date)
         AS order_hari_ini,
       (SELECT count(*) FROM public.radiology_orders o
         WHERE o.modality_id = m.id AND o.performed_at::date = current_date)
         AS selesai_hari_ini,
       (SELECT count(*) FROM public.rad_katalog k WHERE k.modality_id = m.id)
         AS jml_pemeriksaan
  FROM public.modalities m;

GRANT SELECT ON public.rm_papan, public.rad_modalitas_papan
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rm_hitung_kelengkapan(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rm_musnahkan(bigint,text,text) TO authenticated, service_role;
