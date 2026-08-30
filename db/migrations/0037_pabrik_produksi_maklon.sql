-- ══════════════════════════════════════════════════════════════════
-- PABRIK — FORMULASI, PERINTAH PRODUKSI, MAKLON, DAN UJI MUTU
--
-- Tiga menu di kategori Wellness ("Formulasi & R&D", "Kemitraan Maklon",
-- "Uji Mutu Produk ke Lab") berstatus "belum" karena memang tidak ada
-- apa pun di belakangnya. Migrasi ini yang membangunnya.
--
-- ── ALIRAN YANG DIMODELKAN ────────────────────────────────────────
--   formulasi (resep)  →  perintah produksi  →  batch barang jadi
--        ↑                       ↓                      ↓
--     versi & uji           makan bahan baku        uji mutu → lulus
--                        (public.inventory_items)     atau ditolak
--
-- Bahan baku memakai inventory_items + inventory_batches yang SUDAH
-- ADA di repo — keduanya sudah punya batch, kedaluwarsa, dan sisa.
-- Membuat tabel bahan baku sendiri berarti gudang yang sama dicatat
-- di dua tempat, dan angkanya akan berbeda dalam hitungan minggu.
--
-- ── KENAPA FORMULASI BERVERSI ─────────────────────────────────────
-- Resep berubah: pemasok ganti, dosis disesuaikan, bahan ditarik dari
-- peredaran. Kalau resep ditimpa di tempat, batch yang sudah beredar
-- kehilangan catatan dibuat dengan resep yang mana. Saat BPOM atau
-- pelanggan bertanya soal satu batch tertentu, tidak ada jawaban.
-- Karena itu versi baru = baris baru, dan batch menunjuk ke versi.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. FORMULASI / RESEP ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pabrik_formula (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode        text NOT NULL,
  versi       int  NOT NULL DEFAULT 1,
  nama        text NOT NULL,
  produk_id   bigint REFERENCES public.wellness_produk(id),
  bentuk      text,                    -- Kapsul | Serbuk | Krim | Cair
  batch_standar numeric DEFAULT 0,     -- ukuran batch acuan resep ini
  satuan_batch text DEFAULT 'pcs',
  -- Draf | Uji Coba | Disetujui | Ditarik
  status      text DEFAULT 'Draf',
  disetujui_oleh text,
  tgl_setuju  date,
  catatan_rnd text,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now(),
  UNIQUE (kode, versi)
);
CREATE INDEX IF NOT EXISTS idx_formula_produk ON public.pabrik_formula(produk_id, status);

-- ── 2. BILL OF MATERIALS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pabrik_bom (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  formula_id bigint REFERENCES public.pabrik_formula(id) ON DELETE CASCADE,
  item_id    bigint REFERENCES public.inventory_items(id),
  nama_bahan text,
  qty        numeric NOT NULL,
  satuan     text,
  -- Susut yang wajar saat proses (tumpah, menempel di mesin). Dipakai
  -- saat menghitung kebutuhan, supaya perintah produksi tidak selalu
  -- kekurangan bahan di akhir.
  susut_pct  numeric DEFAULT 0,
  fungsi     text,                     -- Bahan aktif | Pengisi | Pelapis
  catatan    text
);
CREATE INDEX IF NOT EXISTS idx_bom_formula ON public.pabrik_bom(formula_id);

-- ── 3. PERINTAH PRODUKSI (Work Order) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.pabrik_wo (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_wo        text UNIQUE,
  formula_id   bigint REFERENCES public.pabrik_formula(id),
  produk_id    bigint REFERENCES public.wellness_produk(id),
  qty_rencana  numeric DEFAULT 0,
  qty_hasil    numeric DEFAULT 0,
  no_batch     text,
  tgl_rencana  date,
  tgl_mulai    timestamp,
  tgl_selesai  timestamp,
  -- Direncanakan | Bahan Disiapkan | Produksi | Selesai | Batal
  status       text DEFAULT 'Direncanakan',
  -- Diisi kalau ini pesanan maklon pihak lain, bukan produksi sendiri.
  maklon_id    bigint,
  penanggung_jawab text,
  catatan      text,
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wo_status ON public.pabrik_wo(status, tgl_rencana);

-- Bahan yang benar-benar dipakai, per batch bahan baku. Bukan salinan
-- BOM: BOM adalah rencana, tabel ini adalah kenyataan. Keduanya sering
-- berbeda, dan selisihnya yang menjadi angka susut sesungguhnya.
CREATE TABLE IF NOT EXISTS public.pabrik_wo_bahan (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wo_id      bigint REFERENCES public.pabrik_wo(id) ON DELETE CASCADE,
  item_id    bigint REFERENCES public.inventory_items(id),
  nama_bahan text,
  qty_rencana numeric DEFAULT 0,
  qty_pakai  numeric DEFAULT 0,
  batch_bahan text,
  satuan     text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wobahan_wo ON public.pabrik_wo_bahan(wo_id);

-- ── 4. KEMITRAAN MAKLON ───────────────────────────────────────────
-- Maklon: kita memproduksi untuk merek pihak lain. Bedanya dengan
-- produksi sendiri bukan cuma administratif — barang jadinya BUKAN
-- milik kita dan tidak boleh masuk stok jualan sendiri.
CREATE TABLE IF NOT EXISTS public.pabrik_maklon (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_kontrak   text UNIQUE,
  klien_nama   text NOT NULL,
  klien_pic    text,
  klien_hp     text,
  klien_email  text,
  merek_klien  text,
  produk_nama  text,
  formula_id   bigint REFERENCES public.pabrik_formula(id),
  qty_kontrak  numeric DEFAULT 0,
  qty_terkirim numeric DEFAULT 0,
  harga_satuan numeric DEFAULT 0,
  nilai_kontrak numeric DEFAULT 0,
  tgl_kontrak  date,
  tgl_target   date,
  -- Penjajakan | Sampel | Kontrak | Produksi | Selesai | Batal
  status       text DEFAULT 'Penjajakan',
  catatan      text,
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maklon_status ON public.pabrik_maklon(status);

-- ── 5. UJI MUTU ───────────────────────────────────────────────────
-- Menghubungkan batch produksi ke pemeriksaan laboratorium. Sengaja
-- tidak memakai tabel order lab pasien: sampel produk bukan sampel
-- orang, dan mencampurnya akan memasukkan nomor batch ke daftar
-- pemeriksaan pasien.
CREATE TABLE IF NOT EXISTS public.pabrik_uji_mutu (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_uji      text UNIQUE,
  batch_id    bigint REFERENCES public.wellness_batch(id) ON DELETE CASCADE,
  wo_id       bigint REFERENCES public.pabrik_wo(id),
  jenis_uji   text,                 -- Mikrobiologi | Kadar Bahan Aktif | Logam Berat | Organoleptik
  lab_tujuan  text,                 -- Lab internal AVA | lab eksternal
  tgl_kirim   date,
  tgl_hasil   date,
  -- Dikirim | Diproses | Lulus | Tidak Lulus
  status      text DEFAULT 'Dikirim',
  hasil       jsonb DEFAULT '{}'::jsonb,
  kesimpulan  text,
  no_sertifikat text,
  berkas_url  text,
  diperiksa_oleh text,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ujimutu_batch ON public.pabrik_uji_mutu(batch_id);

-- ── 6. HITUNG KEBUTUHAN BAHAN ─────────────────────────────────────
-- Dipanggil sebelum produksi dimulai supaya kekurangan bahan ketahuan
-- saat masih bisa dipesan, bukan saat mesin sudah menyala.
CREATE OR REPLACE FUNCTION public.pabrik_cek_bahan(
  p_formula_id bigint, p_qty numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_f record; v_b record; v_faktor numeric;
  v_butuh numeric; v_ada numeric; v_hasil jsonb := '[]'::jsonb; v_cukup boolean := true;
BEGIN
  SELECT * INTO v_f FROM public.pabrik_formula WHERE id = p_formula_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Formula tidak ditemukan.'); END IF;
  IF COALESCE(v_f.batch_standar, 0) <= 0 THEN
    RETURN jsonb_build_object('error',
      'Formula belum punya ukuran batch standar, kebutuhan bahan tidak bisa dihitung.');
  END IF;

  v_faktor := p_qty / v_f.batch_standar;

  FOR v_b IN SELECT * FROM public.pabrik_bom WHERE formula_id = p_formula_id LOOP
    v_butuh := ROUND(v_b.qty * v_faktor * (1 + COALESCE(v_b.susut_pct,0)/100.0), 4);

    SELECT COALESCE(stock_qty, 0) INTO v_ada
      FROM public.inventory_items WHERE id = v_b.item_id;
    v_ada := COALESCE(v_ada, 0);

    IF v_ada < v_butuh THEN v_cukup := false; END IF;

    v_hasil := v_hasil || jsonb_build_object(
      'item_id', v_b.item_id, 'nama', v_b.nama_bahan, 'satuan', v_b.satuan,
      'butuh', v_butuh, 'tersedia', v_ada, 'kurang', GREATEST(v_butuh - v_ada, 0),
      'cukup', v_ada >= v_butuh);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'cukup', v_cukup,
    'faktor', v_faktor, 'bahan', v_hasil);
END $fn$;

-- ── 7. MULAI PRODUKSI ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pabrik_mulai_produksi(
  p_wo_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_wo record; v_cek jsonb; v_b jsonb; v_saldo numeric;
BEGIN
  SELECT * INTO v_wo FROM public.pabrik_wo WHERE id = p_wo_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Perintah produksi tidak ditemukan.'); END IF;
  IF v_wo.status <> 'Direncanakan' THEN
    RETURN jsonb_build_object('error',
      format('Perintah produksi berstatus "%s" — hanya yang Direncanakan bisa dimulai.', v_wo.status));
  END IF;

  v_cek := public.pabrik_cek_bahan(v_wo.formula_id, v_wo.qty_rencana);
  IF v_cek ? 'error' THEN RETURN v_cek; END IF;
  IF NOT (v_cek->>'cukup')::boolean THEN
    RETURN jsonb_build_object('error', 'Bahan baku tidak mencukupi.',
      'bahan', v_cek->'bahan');
  END IF;

  -- Bahan dipotong dari gudang dan dicatat di stock_ledger yang sudah
  -- dipakai modul logistik, supaya buku gudang tetap satu.
  FOR v_b IN SELECT * FROM jsonb_array_elements(v_cek->'bahan') LOOP
    UPDATE public.inventory_items
       SET stock_qty = stock_qty - (v_b->>'butuh')::numeric, updated_at = now()
     WHERE id = (v_b->>'item_id')::bigint
     RETURNING stock_qty INTO v_saldo;

    INSERT INTO public.stock_ledger
      (item_id, item_name, movement_type, qty, balance_after,
       ref_type, ref_id, ref_number, notes, created_by)
    VALUES ((v_b->>'item_id')::bigint, v_b->>'nama', 'OUT',
            (v_b->>'butuh')::numeric, COALESCE(v_saldo, 0),
            'produksi', p_wo_id, v_wo.no_wo,
            'Pemakaian bahan untuk ' || v_wo.no_wo, p_oleh);

    INSERT INTO public.pabrik_wo_bahan
      (wo_id, item_id, nama_bahan, qty_rencana, qty_pakai, satuan)
    VALUES (p_wo_id, (v_b->>'item_id')::bigint, v_b->>'nama',
            (v_b->>'butuh')::numeric, (v_b->>'butuh')::numeric, v_b->>'satuan');
  END LOOP;

  UPDATE public.pabrik_wo
     SET status = 'Produksi', tgl_mulai = now(),
         penanggung_jawab = COALESCE(p_oleh, penanggung_jawab), updated_at = now()
   WHERE id = p_wo_id;

  RETURN jsonb_build_object('ok', true, 'no_wo', v_wo.no_wo,
    'bahan_dipotong', v_cek->'bahan');
END $fn$;

-- ── 8. SELESAIKAN PRODUKSI → BATCH BARANG JADI ────────────────────
CREATE OR REPLACE FUNCTION public.pabrik_selesai_produksi(
  p_wo_id bigint, p_qty_hasil numeric, p_no_batch text DEFAULT NULL,
  p_tgl_kedaluwarsa date DEFAULT NULL, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_wo record; v_batch text; v_hasil jsonb; v_hpp numeric;
BEGIN
  SELECT * INTO v_wo FROM public.pabrik_wo WHERE id = p_wo_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Perintah produksi tidak ditemukan.'); END IF;
  IF v_wo.status <> 'Produksi' THEN
    RETURN jsonb_build_object('error',
      format('Perintah produksi berstatus "%s" — belum berjalan.', v_wo.status));
  END IF;
  IF p_qty_hasil IS NULL OR p_qty_hasil <= 0 THEN
    RETURN jsonb_build_object('error','Jumlah hasil produksi harus lebih dari nol.');
  END IF;

  v_batch := COALESCE(NULLIF(btrim(p_no_batch),''), v_wo.no_batch,
                      to_char(now(),'YYMMDD') || '-' || p_wo_id::text);

  -- HPP batch = total nilai bahan yang benar-benar dipakai dibagi hasil
  -- nyata. Memakai qty_rencana akan menyembunyikan biaya gagal produksi.
  SELECT COALESCE(SUM(b.qty_pakai * COALESCE(i.unit_price, 0)), 0) / p_qty_hasil
    INTO v_hpp
    FROM public.pabrik_wo_bahan b
    LEFT JOIN public.inventory_items i ON i.id = b.item_id
   WHERE b.wo_id = p_wo_id;

  -- Maklon TIDAK masuk stok sendiri: barangnya milik klien.
  IF v_wo.maklon_id IS NOT NULL THEN
    UPDATE public.pabrik_maklon
       SET qty_terkirim = COALESCE(qty_terkirim,0) + p_qty_hasil, updated_at = now()
     WHERE id = v_wo.maklon_id;
    v_hasil := jsonb_build_object('maklon', true,
      'catatan', 'Hasil produksi maklon tidak masuk stok AVA — milik klien.');
  ELSE
    v_hasil := public.wellness_terima_batch(
      v_wo.produk_id, v_batch, p_qty_hasil, current_date,
      p_tgl_kedaluwarsa, COALESCE(v_hpp,0), p_wo_id, p_oleh);
    IF v_hasil ? 'error' THEN
      RAISE EXCEPTION 'Gagal mencatat batch hasil produksi: %', v_hasil->>'error';
    END IF;
  END IF;

  UPDATE public.pabrik_wo
     SET status = 'Selesai', qty_hasil = p_qty_hasil, no_batch = v_batch,
         tgl_selesai = now(), updated_at = now()
   WHERE id = p_wo_id;

  RETURN jsonb_build_object('ok', true, 'no_wo', v_wo.no_wo, 'no_batch', v_batch,
    'qty_hasil', p_qty_hasil, 'hpp_per_unit', ROUND(COALESCE(v_hpp,0), 2),
    'rendemen_pct', ROUND(p_qty_hasil / NULLIF(v_wo.qty_rencana,0) * 100, 2),
    'batch', v_hasil);
END $fn$;

-- ── 9. CATAT HASIL UJI MUTU ───────────────────────────────────────
-- Hasil uji langsung menentukan nasib batch: lulus membuka karantina,
-- tidak lulus menutupnya permanen. Menyimpan hasil tanpa menggerakkan
-- status batch akan membuat barang tidak lulus tetap bisa terjual.
CREATE OR REPLACE FUNCTION public.pabrik_catat_uji(
  p_uji_id bigint, p_status text, p_kesimpulan text DEFAULT NULL,
  p_hasil jsonb DEFAULT NULL, p_no_sertifikat text DEFAULT NULL,
  p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_u record; v_sisa int; v_batch jsonb;
BEGIN
  IF lower(COALESCE(p_status,'')) NOT IN ('lulus','tidak lulus','diproses') THEN
    RETURN jsonb_build_object('error','Status uji harus: lulus, tidak lulus, atau diproses.');
  END IF;

  SELECT * INTO v_u FROM public.pabrik_uji_mutu WHERE id = p_uji_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Data uji tidak ditemukan.'); END IF;

  UPDATE public.pabrik_uji_mutu
     SET status = initcap(p_status), kesimpulan = COALESCE(p_kesimpulan, kesimpulan),
         hasil = COALESCE(p_hasil, hasil), no_sertifikat = COALESCE(p_no_sertifikat, no_sertifikat),
         tgl_hasil = CASE WHEN lower(p_status) = 'diproses' THEN tgl_hasil ELSE current_date END,
         diperiksa_oleh = COALESCE(p_oleh, diperiksa_oleh), updated_at = now()
   WHERE id = p_uji_id;

  IF lower(p_status) = 'tidak lulus' THEN
    v_batch := public.wellness_putuskan_batch(
      v_u.batch_id, 'ditolak',
      'Tidak lulus uji ' || COALESCE(v_u.jenis_uji,'mutu') ||
      COALESCE(': ' || p_kesimpulan, ''), p_oleh);
    RETURN jsonb_build_object('ok', true, 'batch', 'Ditolak', 'detail', v_batch);
  END IF;

  IF lower(p_status) = 'lulus' THEN
    -- Batch baru boleh keluar karantina kalau SEMUA uji yang dijadwalkan
    -- untuknya sudah lulus. Meluluskan begitu satu uji selesai berarti
    -- barang bisa terjual sebelum uji mikrobiologi keluar.
    SELECT count(*) INTO v_sisa FROM public.pabrik_uji_mutu
     WHERE batch_id = v_u.batch_id AND status <> 'Lulus';

    IF v_sisa = 0 THEN
      v_batch := public.wellness_putuskan_batch(
        v_u.batch_id, 'lulus', 'Seluruh uji mutu lulus', p_oleh);
      RETURN jsonb_build_object('ok', true, 'batch', 'Lulus', 'detail', v_batch);
    END IF;

    RETURN jsonb_build_object('ok', true, 'batch', 'Karantina',
      'catatan', format('Masih ada %s uji yang belum lulus untuk batch ini.', v_sisa));
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', initcap(p_status));
END $fn$;

-- ── 10. PAPAN PRODUKSI ────────────────────────────────────────────
CREATE OR REPLACE VIEW public.pabrik_papan AS
SELECT w.id, w.no_wo, w.status, w.qty_rencana, w.qty_hasil, w.no_batch,
       w.tgl_rencana, w.tgl_mulai, w.tgl_selesai, w.penanggung_jawab,
       f.kode AS kode_formula, f.versi AS versi_formula, f.nama AS nama_formula,
       p.sku, p.nama AS nama_produk, p.merek,
       m.klien_nama, m.merek_klien,
       (w.maklon_id IS NOT NULL) AS is_maklon,
       CASE WHEN w.qty_rencana > 0 AND w.qty_hasil > 0
            THEN ROUND(w.qty_hasil / w.qty_rencana * 100, 1) END AS rendemen_pct,
       (SELECT count(*) FROM public.pabrik_uji_mutu u
         WHERE u.wo_id = w.id AND u.status = 'Lulus')       AS uji_lulus,
       (SELECT count(*) FROM public.pabrik_uji_mutu u
         WHERE u.wo_id = w.id)                              AS uji_total
  FROM public.pabrik_wo w
  LEFT JOIN public.pabrik_formula f ON f.id = w.formula_id
  LEFT JOIN public.wellness_produk p ON p.id = w.produk_id
  LEFT JOIN public.pabrik_maklon  m ON m.id = w.maklon_id;

GRANT SELECT ON public.pabrik_papan TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pabrik_cek_bahan(bigint,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pabrik_mulai_produksi(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pabrik_selesai_produksi(bigint,numeric,text,date,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pabrik_catat_uji(bigint,text,text,jsonb,text,text) TO authenticated, service_role;
