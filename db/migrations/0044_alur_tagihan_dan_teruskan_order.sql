-- ══════════════════════════════════════════════════════════════════
-- MENYAMBUNG DUA ALUR YANG TERPUTUS
--
-- 1. Tindakan dan imunisasi dikerjakan, dicatat, lalu TIDAK PERNAH
--    DITAGIH. Keduanya punya kolom tarif; tidak ada satu pun yang
--    memposting biaya. Itu kebocoran pendapatan langsung, dan tidak
--    terlihat di laporan mana pun karena tagihannya memang tidak
--    pernah ada.
--
-- 2. Order terintegrasi tidak meneruskan apa pun ke lab dan radiologi.
--    Dokter membuat order, laboratorium tidak pernah menerimanya.
--    Kolom ref_tabel/ref_id sudah disiapkan di migrasi 0039 tapi tidak
--    ada yang mengisinya.
--
-- ══════════════════════════════════════════════════════════════════
-- KENAPA TIDAK MEMBUAT TABEL TAGIHAN BARU
--
-- Godaannya membuat billing_charge tersendiri untuk layanan rawat
-- jalan, karena inpatient_charges berkunci stay_id. Itu akan membuat
-- kasir harus membaca DUA tabel biaya, dan dua tempat yang menyimpan
-- hal yang sama selalu berakhir berbeda.
--
-- inpatient_charges sebenarnya sudah universal: charge_type-nya
-- mencakup Kamar, Visite, Tindakan, Obat & BHP, Penunjang, Lain-lain.
-- Yang kurang hanya satu kolom — penunjuk kunjungan rawat jalan.
--
-- Jadi ia diperluas, bukan digandakan. Namanya kini kurang tepat untuk
-- rawat jalan, dan itu memang harga yang dibayar; nama yang menyesatkan
-- jauh lebih murah daripada dua sumber angka yang harus dicocokkan tiap
-- tutup buku. View tagihan_layanan di bawah menyajikannya dengan nama
-- yang netral.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.inpatient_charges
  -- Rawat jalan tidak punya stay_id. Salah satu dari keduanya harus
  -- terisi; itu ditegakkan fungsi di bawah, bukan constraint, supaya
  -- baris lama yang stay_id-nya sudah ada tidak ikut ditolak.
  ADD COLUMN IF NOT EXISTS admission_id bigint,
  ADD COLUMN IF NOT EXISTS ref_tabel    text,
  ADD COLUMN IF NOT EXISTS ref_id       bigint,
  ADD COLUMN IF NOT EXISTS dibatalkan_at timestamp,
  ADD COLUMN IF NOT EXISTS alasan_batal text;

COMMENT ON TABLE public.inpatient_charges IS
  'Baris biaya untuk rawat inap DAN rawat jalan. Nama tabel warisan: '
  'ia dipakai lebih luas daripada namanya. Kunci: stay_id untuk rawat '
  'inap, admission_id untuk rawat jalan.';

CREATE INDEX IF NOT EXISTS idx_charge_admission
  ON public.inpatient_charges(admission_id) WHERE admission_id IS NOT NULL;

-- Satu layanan hanya boleh menghasilkan satu baris biaya. Tanpa ini,
-- menekan "Selesai" dua kali pada tindakan yang sama menagih pasien dua
-- kali — dan yang menemukan biasanya pasien, bukan kita.
CREATE UNIQUE INDEX IF NOT EXISTS uq_charge_ref
  ON public.inpatient_charges(ref_tabel, ref_id)
  WHERE ref_tabel IS NOT NULL AND ref_id IS NOT NULL AND dibatalkan_at IS NULL;

-- ── 1. POSTING BIAYA ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tagihan_posting(
  p_ref_tabel text, p_ref_id bigint, p_jenis text, p_uraian text,
  p_qty numeric DEFAULT 1, p_harga numeric DEFAULT 0,
  p_admission_id bigint DEFAULT NULL, p_stay_id bigint DEFAULT NULL,
  p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_id bigint; v_ada record;
BEGIN
  IF p_admission_id IS NULL AND p_stay_id IS NULL THEN
    RETURN jsonb_build_object('error',
      'Biaya harus menempel pada kunjungan atau perawatan — tanpa itu ia '
      || 'tidak akan pernah muncul di tagihan siapa pun.');
  END IF;

  -- Sudah pernah diposting? Kembalikan yang lama, jangan gandakan.
  SELECT * INTO v_ada FROM public.inpatient_charges
   WHERE ref_tabel = p_ref_tabel AND ref_id = p_ref_id AND dibatalkan_at IS NULL;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'id', v_ada.id, 'sudah_ada', true,
      'jumlah', v_ada.amount);
  END IF;

  -- Tarif nol dibiarkan lewat: ada layanan yang memang gratis (program
  -- pemerintah, tanggungan korporat). Yang tidak boleh adalah tarif
  -- negatif — itu potongan, dan potongan punya jalurnya sendiri.
  IF COALESCE(p_harga, 0) < 0 THEN
    RETURN jsonb_build_object('error', 'Tarif tidak boleh negatif.');
  END IF;

  INSERT INTO public.inpatient_charges
    (stay_id, admission_id, charge_date, charge_type, description,
     qty, unit_price, amount, source, ref_tabel, ref_id, posted_by)
  VALUES (p_stay_id, p_admission_id, current_date, p_jenis, p_uraian,
          COALESCE(p_qty, 1), COALESCE(p_harga, 0),
          COALESCE(p_qty, 1) * COALESCE(p_harga, 0),
          'otomatis', p_ref_tabel, p_ref_id, p_oleh)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'sudah_ada', false,
    'jumlah', COALESCE(p_qty, 1) * COALESCE(p_harga, 0));
END $fn$;

-- Pembatalan biaya. Baris TIDAK dihapus — tagihan yang pernah terbit
-- lalu hilang tanpa jejak adalah yang paling sulit dijelaskan saat
-- pasien bertanya.
CREATE OR REPLACE FUNCTION public.tagihan_batalkan(
  p_charge_id bigint, p_alasan text, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF COALESCE(btrim(p_alasan), '') = '' THEN
    RETURN jsonb_build_object('error', 'Alasan pembatalan wajib diisi.');
  END IF;
  UPDATE public.inpatient_charges
     SET dibatalkan_at = now(), alasan_batal = btrim(p_alasan), updated_at = now()
   WHERE id = p_charge_id AND dibatalkan_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Biaya tidak ditemukan atau sudah dibatalkan.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END $fn$;

-- ── 2. TINDAKAN SELESAI → BIAYA TERBIT ────────────────────────────
-- Menggantikan versi di migrasi 0041. Yang berubah hanya satu: sesudah
-- tindakan ditutup, biayanya diposting.
CREATE OR REPLACE FUNCTION public.tindakan_selesai(
  p_tindakan_id bigint, p_temuan text DEFAULT NULL,
  p_dilakukan text DEFAULT NULL, p_komplikasi text DEFAULT NULL,
  p_anjuran text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_t record; v_sudah int; v_seri record; v_k record; v_tagih jsonb;
BEGIN
  SELECT * INTO v_t FROM public.tindakan WHERE id = p_tindakan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Tindakan tidak ditemukan.'); END IF;
  IF v_t.status <> 'Berjalan' THEN
    RETURN jsonb_build_object('error',
      format('Tindakan berstatus "%s" — belum berjalan.', v_t.status));
  END IF;
  IF COALESCE(btrim(p_dilakukan), '') = '' THEN
    RETURN jsonb_build_object('error', 'Uraian tindakan yang dikerjakan wajib diisi.');
  END IF;

  UPDATE public.tindakan
     SET status = 'Selesai', selesai_at = now(),
         temuan = p_temuan, tindakan_dilakukan = p_dilakukan,
         komplikasi = p_komplikasi, anjuran = p_anjuran, updated_at = now()
   WHERE id = p_tindakan_id;

  SELECT * INTO v_k FROM public.tindakan_katalog WHERE id = v_t.katalog_id;

  -- Biaya terbit di sini, bukan saat dijadwalkan: tindakan yang batal
  -- tidak boleh menagih apa pun.
  IF v_t.admission_id IS NOT NULL THEN
    v_tagih := public.tagihan_posting(
      'tindakan', p_tindakan_id, 'Tindakan',
      COALESCE(v_k.nama, 'Tindakan') ||
        CASE WHEN v_t.sesi_ke IS NOT NULL THEN ' (sesi ' || v_t.sesi_ke || ')' ELSE '' END,
      1, COALESCE(NULLIF(v_t.tarif, 0), v_k.tarif, 0),
      v_t.admission_id, NULL, v_t.operator);
  ELSE
    -- Tanpa kunjungan, biaya tidak punya tempat menempel. Ini disebutkan
    -- apa adanya supaya tidak diam-diam hilang.
    v_tagih := jsonb_build_object('ok', false,
      'catatan', 'Tindakan tidak tertaut ke kunjungan — biaya belum bisa ditagihkan.');
  END IF;

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
      'sesi_selesai', v_sudah, 'sesi_rencana', v_seri.sesi_rencana,
      'tagihan', v_tagih);
  END IF;

  RETURN jsonb_build_object('ok', true, 'no_tindakan', v_t.no_tindakan,
    'tagihan', v_tagih);
END $fn$;

-- ── 3. TARIF IMUNISASI & POSTING ──────────────────────────────────
ALTER TABLE public.vaksin ADD COLUMN IF NOT EXISTS tarif numeric DEFAULT 0;

-- Membungkus imunisasi_beri: pemberiannya tetap dikerjakan fungsi asli
-- (dengan seluruh penjagaan rantai dingin dan intervalnya), lalu
-- biayanya diposting bila pemberiannya berhasil.
CREATE OR REPLACE FUNCTION public.imunisasi_beri_dan_tagih(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_hasil jsonb; v_id bigint; v_i record; v_v record; v_tagih jsonb;
BEGIN
  v_hasil := public.imunisasi_beri(p_data);
  IF v_hasil ? 'error' THEN RETURN v_hasil; END IF;

  v_id := (v_hasil->>'id')::bigint;
  SELECT * INTO v_i FROM public.imunisasi WHERE id = v_id;
  SELECT * INTO v_v FROM public.vaksin WHERE id = v_i.vaksin_id;

  IF v_i.admission_id IS NOT NULL THEN
    v_tagih := public.tagihan_posting(
      'imunisasi', v_id, 'Tindakan',
      COALESCE(v_v.nama, 'Imunisasi') || ' — dosis ' || v_i.dosis_ke,
      1, COALESCE(v_v.tarif, 0), v_i.admission_id, NULL, v_i.penyuntik);
  ELSE
    v_tagih := jsonb_build_object('ok', false,
      'catatan', 'Imunisasi tidak tertaut ke kunjungan — biaya belum bisa ditagihkan.');
  END IF;

  RETURN v_hasil || jsonb_build_object('tagihan', v_tagih);
END $fn$;

-- ── 3b. PERBAIKAN order_terintegrasi_buat (dari migrasi 0039) ─────
--
-- Cacat yang ditemukan uji: item tanpa product_id membuat SELURUH
-- pembuatan order gagal.
--
--     SELECT * INTO v_prod FROM public.products WHERE id = ...;
--     IF FOUND THEN v_harga := v_prod.harga_normal; END IF;
--     ...
--     COALESCE(v_it->>'kode', v_prod.kode_internal)   ← di sini
--
-- v_prod := NULL di awal perulangan TIDAK membuat strukturnya dikenal;
-- PostgreSQL tetap menganggapnya belum ditetapkan dan menolak akses
-- kolomnya dengan "tuple structure of a not-yet-assigned record is
-- indeterminate".
--
-- Yang paling sering terkena justru tindakan: ia dipesan dengan nama,
-- bukan dengan product_id, karena katalog tindakan terpisah dari
-- katalog tes lab. Jadi seluruh order yang memuat tindakan gagal dibuat.
--
-- Diperbaiki dengan variabel skalar: nilai yang tidak ada tetap NULL,
-- dan NULL bisa diakses.
CREATE OR REPLACE FUNCTION public.order_terintegrasi_buat(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_id bigint; v_no text; v_it jsonb; v_total numeric := 0;
  v_harga numeric; v_pid bigint;
  v_kode text; v_nama text;
BEGIN
  IF COALESCE(jsonb_array_length(p_data->'item'), 0) = 0 THEN
    RETURN jsonb_build_object('error','Order harus berisi minimal satu pemeriksaan.');
  END IF;
  IF COALESCE(btrim(p_data->>'patient_name'),'') = '' THEN
    RETURN jsonb_build_object('error','Nama pasien wajib diisi.');
  END IF;

  v_no := 'ORD-' || to_char(now(),'YYMMDD') || '-' ||
          lpad((COALESCE((SELECT count(*) FROM public.order_terintegrasi
                          WHERE created_at::date = current_date),0) + 1)::text, 4, '0');

  INSERT INTO public.order_terintegrasi
    (no_order, admission_id, visit_number, patient_name, mr_number,
     dokter_perujuk, klinis, prioritas, status, dibuat_oleh)
  VALUES (v_no, NULLIF(p_data->>'admission_id','')::bigint,
          p_data->>'visit_number', btrim(p_data->>'patient_name'),
          p_data->>'mr_number', p_data->>'dokter_perujuk', p_data->>'klinis',
          COALESCE(NULLIF(p_data->>'prioritas',''),'Rutin'),
          'Dikirim', p_data->>'dibuat_oleh')
  RETURNING id INTO v_id;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_data->'item') LOOP
    v_pid := NULLIF(v_it->>'product_id','')::bigint;
    v_harga := NULL; v_kode := NULL; v_nama := NULL;

    -- Skalar, bukan record: item tanpa product_id tetap boleh lewat.
    IF v_pid IS NOT NULL THEN
      SELECT harga_normal, kode_internal, nama_tes
        INTO v_harga, v_kode, v_nama
        FROM public.products WHERE id = v_pid;
    END IF;

    INSERT INTO public.order_terintegrasi_item
      (order_id, layanan, product_id, kode, nama, harga, catatan)
    VALUES (v_id, lower(COALESCE(v_it->>'layanan','lab')), v_pid,
            COALESCE(v_it->>'kode', v_kode),
            COALESCE(v_it->>'nama', v_nama),
            COALESCE(v_harga, 0), v_it->>'catatan');

    v_total := v_total + COALESCE(v_harga, 0);
  END LOOP;

  UPDATE public.order_terintegrasi SET total = v_total WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_order', v_no,
    'total', v_total);
END $fn$;

-- ── 4. ORDER TERINTEGRASI → DITERUSKAN KE LAYANAN ─────────────────
--
-- Inilah bagian yang membuat order berarti. Sebelum ini, order dibuat
-- lalu berhenti di tabelnya sendiri: laboratorium tidak pernah tahu ada
-- permintaan.
--
-- Yang dibuat menyesuaikan layanannya:
--   lab       → public.lab_samples  (menunggu diambil)
--   radiologi → public.radiology_orders (menunggu dikerjakan)
--   tindakan  → public.tindakan (dijadwalkan, lengkap dengan gerbang
--               persetujuannya)
CREATE OR REPLACE FUNCTION public.order_terintegrasi_teruskan(
  p_item_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_i record; v_o record; v_p record; v_baru bigint;
  v_tabel text; v_no text; v_kat record;
BEGIN
  SELECT * INTO v_i FROM public.order_terintegrasi_item
   WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Item order tidak ditemukan.'); END IF;

  IF v_i.ref_id IS NOT NULL THEN
    RETURN jsonb_build_object('error',
      format('Item ini sudah diteruskan ke %s #%s.', v_i.ref_tabel, v_i.ref_id));
  END IF;
  IF v_i.status = 'Batal' THEN
    RETURN jsonb_build_object('error','Item sudah dibatalkan.');
  END IF;

  SELECT * INTO v_o FROM public.order_terintegrasi WHERE id = v_i.order_id;
  SELECT * INTO v_p FROM public.products WHERE id = v_i.product_id;

  IF v_i.layanan = 'lab' THEN
    v_no := 'LB-' || to_char(now(),'YYMMDD') || '-' ||
            lpad((COALESCE((SELECT count(*) FROM public.lab_samples
                            WHERE created_at::date = current_date), 0) + 1)::text, 4, '0');
    INSERT INTO public.lab_samples
      (barcode, admission_id, visit_number, patient_name, product_id,
       product_name, sampel_type, status)
    VALUES (v_no, v_o.admission_id, v_o.visit_number, v_o.patient_name,
            v_i.product_id, COALESCE(v_i.nama, v_p.nama_tes),
            v_p.sampel_type, 'Pending')
    RETURNING id INTO v_baru;
    v_tabel := 'lab_samples';

  ELSIF v_i.layanan = 'radiologi' THEN
    v_no := 'RAD-' || to_char(now(),'YYMMDD') || '-' ||
            lpad((COALESCE((SELECT count(*) FROM public.radiology_orders
                            WHERE created_at::date = current_date), 0) + 1)::text, 4, '0');
    INSERT INTO public.radiology_orders
      (accession_no, admission_id, patient_name, mr_number, procedure_name,
       product_id, clinical_info, referring_doctor, priority, scheduled_at, created_by)
    VALUES (v_no, v_o.admission_id, v_o.patient_name, v_o.mr_number,
            COALESCE(v_i.nama, v_p.nama_tes), v_i.product_id, v_o.klinis,
            v_o.dokter_perujuk, COALESCE(v_o.prioritas,'Rutin'), now(), p_oleh)
    RETURNING id INTO v_baru;
    v_tabel := 'radiology_orders';

  ELSIF v_i.layanan = 'tindakan' THEN
    -- Dicocokkan ke katalog tindakan lewat kode. Tanpa katalog yang
    -- cocok, tindakan tidak bisa dibuat — sebab gerbang persetujuannya
    -- bergantung pada katalog (butuh_consent, risiko).
    SELECT * INTO v_kat FROM public.tindakan_katalog
     WHERE kode = v_i.kode OR lower(nama) = lower(COALESCE(v_i.nama,''))
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error',
        format('Tindakan "%s" belum ada di katalog tindakan. Tambahkan dulu '
               || 'beserta risikonya, karena lembar persetujuan mengambil dari sana.',
               COALESCE(v_i.nama, v_i.kode)));
    END IF;
    v_no := 'TDK-' || to_char(now(),'YYMMDD') || '-' ||
            lpad((COALESCE((SELECT count(*) FROM public.tindakan
                            WHERE created_at::date = current_date), 0) + 1)::text, 4, '0');
    INSERT INTO public.tindakan
      (no_tindakan, katalog_id, admission_id, visit_number, patient_name,
       mr_number, tgl_rencana, tarif)
    VALUES (v_no, v_kat.id, v_o.admission_id, v_o.visit_number, v_o.patient_name,
            v_o.mr_number, now(), COALESCE(v_kat.tarif, 0))
    RETURNING id INTO v_baru;
    v_tabel := 'tindakan';

  ELSE
    RETURN jsonb_build_object('error',
      format('Layanan "%s" belum punya jalur penerusan.', v_i.layanan));
  END IF;

  PERFORM public.order_terintegrasi_status_item(p_item_id, 'Diproses', v_tabel, v_baru);

  RETURN jsonb_build_object('ok', true, 'layanan', v_i.layanan,
    'tabel', v_tabel, 'id', v_baru, 'nomor', v_no);
END $fn$;

-- ── 5. TAGIHAN LAYANAN — pandangan netral ─────────────────────────
CREATE OR REPLACE VIEW public.tagihan_layanan AS
SELECT c.id, c.admission_id, c.stay_id, c.charge_date AS tanggal,
       c.charge_type AS jenis, c.description AS uraian,
       c.qty, c.unit_price AS harga, c.amount AS jumlah,
       c.source AS sumber, c.ref_tabel, c.ref_id,
       c.posted_by AS diposting_oleh, c.dibatalkan_at, c.alasan_batal,
       a.visit_number, a.patient_name, a.mr_number,
       (c.dibatalkan_at IS NULL) AS aktif
  FROM public.inpatient_charges c
  LEFT JOIN public.admissions a ON a.id = c.admission_id;

-- Ringkasan per kunjungan, untuk kasir.
CREATE OR REPLACE VIEW public.tagihan_ringkas AS
SELECT admission_id,
       count(*) FILTER (WHERE dibatalkan_at IS NULL)               AS jml_item,
       COALESCE(SUM(amount) FILTER (WHERE dibatalkan_at IS NULL), 0) AS total,
       COALESCE(SUM(amount) FILTER (
         WHERE dibatalkan_at IS NULL AND charge_type = 'Tindakan'), 0) AS total_tindakan,
       COALESCE(SUM(amount) FILTER (
         WHERE dibatalkan_at IS NULL AND charge_type = 'Penunjang'), 0) AS total_penunjang,
       max(charge_date)                                            AS tanggal_terakhir
  FROM public.inpatient_charges
 WHERE admission_id IS NOT NULL
 GROUP BY admission_id;

GRANT SELECT ON public.tagihan_layanan, public.tagihan_ringkas
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tagihan_posting(text,bigint,text,text,numeric,numeric,bigint,bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tagihan_batalkan(bigint,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.imunisasi_beri_dan_tagih(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_terintegrasi_teruskan(bigint,text) TO authenticated, service_role;
