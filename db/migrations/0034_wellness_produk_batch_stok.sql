-- ══════════════════════════════════════════════════════════════════
-- WELLNESS — MASTER BARANG JADI, BATCH PRODUKSI, DAN STOK
--
-- ── KENAPA TABEL BARU, BUKAN PAKAI YANG SUDAH ADA ─────────────────
-- Repo ini sudah punya dua hal yang sekilas mirip, tapi keduanya
-- BUKAN barang konsumen:
--
--   public.products         → daftar TES LAB (loinc_code, sampel_type,
--                             volume_sampel, metode). Bukan barang.
--   public.inventory_items  → barang yang kita BELI (reagen, ATK).
--                             Punya stock_qty & FEFO lewat
--                             inventory_batches.
--
-- Yang belum ada: barang yang kita BUAT lalu JUAL. Bedanya nyata,
-- bukan sekadar penamaan — barang jadi butuh nomor izin edar BPOM,
-- sertifikat halal, netto, masa simpan, dan harga yang berbeda per
-- kanal jualan. Memaksakannya ke inventory_items berarti menambah
-- belasan kolom yang selalu NULL untuk reagen.
--
-- Batas yang dipakai: inventory_items = yang dibeli (bahan baku),
-- wellness_produk = yang dibuat dan dijual. Perintah produksi di
-- migrasi 0037 memakan yang pertama dan menghasilkan yang kedua.
--
-- ── KENAPA STOK TIDAK DISIMPAN SEBAGAI SATU ANGKA ─────────────────
-- inventory_items menyimpan stock_qty sebagai kolom tunggal. Untuk
-- barang ber-kedaluwarsa itu tidak cukup: 100 pcs yang kedaluwarsa
-- bulan depan tidak sama dengan 100 pcs yang kedaluwarsa tahun depan.
-- Karena itu stok di sini adalah JUMLAH dari batch yang tersisa, dan
-- pengambilan memakai FEFO (First-Expired-First-Out) — bukan FIFO.
-- Untuk suplemen dan kosmetik, tanggal kedaluwarsa yang menentukan,
-- bukan tanggal masuk.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. MASTER BARANG JADI ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellness_produk (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku           text UNIQUE NOT NULL,
  nama          text NOT NULL,
  merek         text,
  kategori      text,
  varian        text,
  netto         text,
  satuan        text DEFAULT 'pcs',
  -- Legalitas. Dibiarkan NULL kalau memang belum terbit; JANGAN diisi
  -- nomor contoh — nomor izin edar palsu di label adalah pelanggaran.
  no_bpom       text,
  no_halal      text,
  masa_simpan_bulan int,
  hpp           numeric DEFAULT 0,
  harga_normal  numeric DEFAULT 0,
  harga_reseller numeric DEFAULT 0,
  min_stok      numeric DEFAULT 0,
  status        text DEFAULT 'Aktif',
  deskripsi     text,
  gambar_url    text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wproduk_merek  ON public.wellness_produk(merek);
CREATE INDEX IF NOT EXISTS idx_wproduk_status ON public.wellness_produk(status);

-- ── 2. HARGA PER KANAL ────────────────────────────────────────────
-- Harga di Shopee tidak sama dengan harga di web sendiri: ada komisi
-- kanal, subsidi ongkir, dan program diskon platform. Menyimpannya
-- sebagai satu kolom di produk memaksa tim menimpa harga tiap ganti
-- kanal, dan riwayatnya hilang.
CREATE TABLE IF NOT EXISTS public.wellness_harga_kanal (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produk_id   bigint REFERENCES public.wellness_produk(id) ON DELETE CASCADE,
  kanal       text NOT NULL,
  harga       numeric DEFAULT 0,
  komisi_pct  numeric DEFAULT 0,
  aktif       boolean DEFAULT true,
  updated_at  timestamp DEFAULT now(),
  UNIQUE (produk_id, kanal)
);

-- ── 3. BATCH PRODUKSI (FEFO) ──────────────────────────────────────
-- Terpisah dari inventory_batches karena asalnya beda: inventory_batches
-- lahir dari PO ke pemasok (punya po_id, supplier_name), sedangkan batch
-- di sini lahir dari perintah produksi sendiri (migrasi 0037).
CREATE TABLE IF NOT EXISTS public.wellness_batch (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produk_id     bigint REFERENCES public.wellness_produk(id) ON DELETE CASCADE,
  no_batch      text NOT NULL,
  tgl_produksi  date,
  tgl_kedaluwarsa date,
  qty_produksi  numeric DEFAULT 0,
  qty_sisa      numeric DEFAULT 0,
  hpp_batch     numeric DEFAULT 0,
  wo_id         bigint,
  -- Karantina sampai hasil uji mutu keluar. Barang yang belum lulus
  -- TIDAK boleh terambil FEFO — itulah gunanya kolom ini, bukan
  -- sekadar penanda tampilan.
  status        text DEFAULT 'Karantina',
  catatan       text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now(),
  UNIQUE (produk_id, no_batch)
);
CREATE INDEX IF NOT EXISTS idx_wbatch_fefo
  ON public.wellness_batch(produk_id, tgl_kedaluwarsa);

-- ── 4. BUKU MUTASI STOK ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellness_stok_mutasi (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produk_id  bigint REFERENCES public.wellness_produk(id) ON DELETE CASCADE,
  batch_id   bigint REFERENCES public.wellness_batch(id) ON DELETE SET NULL,
  jenis      text NOT NULL,
  qty        numeric NOT NULL,
  saldo_after numeric DEFAULT 0,
  ref_tipe   text,
  ref_id     bigint,
  ref_no     text,
  catatan    text,
  oleh       text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wmutasi_produk ON public.wellness_stok_mutasi(produk_id, created_at DESC);

-- ── 5. STOK TERSEDIA (turunan, bukan simpanan) ────────────────────
-- View, bukan kolom. Angka stok yang disimpan terpisah selalu bisa
-- berbeda dari jumlah batch-nya begitu ada satu update yang gagal;
-- turunan tidak bisa.
CREATE OR REPLACE VIEW public.wellness_stok AS
SELECT p.id AS produk_id, p.sku, p.nama, p.merek, p.satuan, p.min_stok,
       COALESCE(SUM(b.qty_sisa) FILTER (WHERE b.status = 'Lulus'), 0)      AS stok_siap_jual,
       COALESCE(SUM(b.qty_sisa) FILTER (WHERE b.status = 'Karantina'), 0)  AS stok_karantina,
       MIN(b.tgl_kedaluwarsa) FILTER (WHERE b.status = 'Lulus' AND b.qty_sisa > 0) AS kedaluwarsa_terdekat,
       COALESCE(SUM(b.qty_sisa) FILTER (
         WHERE b.status = 'Lulus' AND b.tgl_kedaluwarsa <= current_date + 90), 0)  AS stok_kedaluwarsa_90hari
  FROM public.wellness_produk p
  LEFT JOIN public.wellness_batch b ON b.produk_id = p.id
 GROUP BY p.id, p.sku, p.nama, p.merek, p.satuan, p.min_stok;

-- ── 6. AMBIL STOK SECARA FEFO ─────────────────────────────────────
-- Dipakai saat pesanan dikemas. Mengembalikan batch mana saja yang
-- dipotong, supaya nomor batch bisa dicetak di surat jalan — wajib
-- untuk penarikan produk kalau suatu saat ada masalah mutu.
CREATE OR REPLACE FUNCTION public.wellness_ambil_stok(
  p_produk_id bigint, p_qty numeric, p_ref_tipe text DEFAULT NULL,
  p_ref_id bigint DEFAULT NULL, p_ref_no text DEFAULT NULL, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_sisa numeric := p_qty; v_b record; v_pakai numeric;
  v_dipakai jsonb := '[]'::jsonb; v_tersedia numeric;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('error', 'Jumlah harus lebih dari nol.');
  END IF;

  SELECT COALESCE(SUM(qty_sisa), 0) INTO v_tersedia
    FROM public.wellness_batch
   WHERE produk_id = p_produk_id AND status = 'Lulus' AND qty_sisa > 0;

  -- Diperiksa di depan supaya tidak ada batch yang terlanjur terpotong
  -- lalu gagal di tengah dengan stok separuh terambil.
  IF v_tersedia < p_qty THEN
    RETURN jsonb_build_object('error',
      format('Stok siap jual tidak cukup: tersedia %s, diminta %s.', v_tersedia, p_qty));
  END IF;

  -- FEFO: yang paling dekat kedaluwarsa keluar lebih dulu.
  -- SKIP LOCKED sengaja TIDAK dipakai di sini — kalau ada pengemasan
  -- lain yang sedang memegang batch ini, kita HARUS menunggu dan
  -- memakai angka terbarunya, bukan melompatinya dan menjual stok
  -- yang sama dua kali.
  FOR v_b IN
    SELECT id, qty_sisa, no_batch, tgl_kedaluwarsa
      FROM public.wellness_batch
     WHERE produk_id = p_produk_id AND status = 'Lulus' AND qty_sisa > 0
     ORDER BY tgl_kedaluwarsa NULLS LAST, id
     FOR UPDATE
  LOOP
    EXIT WHEN v_sisa <= 0;
    v_pakai := LEAST(v_b.qty_sisa, v_sisa);

    UPDATE public.wellness_batch
       SET qty_sisa = qty_sisa - v_pakai, updated_at = now()
     WHERE id = v_b.id;

    INSERT INTO public.wellness_stok_mutasi
      (produk_id, batch_id, jenis, qty, ref_tipe, ref_id, ref_no, oleh,
       saldo_after, catatan)
    VALUES (p_produk_id, v_b.id, 'keluar', v_pakai, p_ref_tipe, p_ref_id,
            p_ref_no, p_oleh, v_b.qty_sisa - v_pakai,
            'FEFO batch ' || v_b.no_batch);

    v_dipakai := v_dipakai || jsonb_build_object(
      'batch_id', v_b.id, 'no_batch', v_b.no_batch,
      'qty', v_pakai, 'kedaluwarsa', v_b.tgl_kedaluwarsa);
    v_sisa := v_sisa - v_pakai;
  END LOOP;

  IF v_sisa > 0 THEN
    -- Bisa terjadi kalau ada transaksi lain yang menghabiskan stok
    -- antara pemeriksaan di atas dan penguncian baris. RAISE supaya
    -- seluruh pemotongan di atas ikut dibatalkan.
    RAISE EXCEPTION 'Stok habis diambil transaksi lain saat proses berjalan (sisa % belum terpenuhi).', v_sisa;
  END IF;

  RETURN jsonb_build_object('ok', true, 'batch', v_dipakai);
END $fn$;

-- ── 7. TERIMA HASIL PRODUKSI ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wellness_terima_batch(
  p_produk_id bigint, p_no_batch text, p_qty numeric,
  p_tgl_produksi date DEFAULT current_date, p_tgl_kedaluwarsa date DEFAULT NULL,
  p_hpp numeric DEFAULT 0, p_wo_id bigint DEFAULT NULL, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_id bigint; v_exp date; v_simpan int;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('error', 'Jumlah produksi harus lebih dari nol.');
  END IF;
  IF COALESCE(btrim(p_no_batch), '') = '' THEN
    RETURN jsonb_build_object('error', 'Nomor batch wajib diisi.');
  END IF;

  -- Kedaluwarsa dihitung dari masa simpan produk kalau tidak disebut.
  v_exp := p_tgl_kedaluwarsa;
  IF v_exp IS NULL THEN
    SELECT masa_simpan_bulan INTO v_simpan FROM public.wellness_produk WHERE id = p_produk_id;
    IF v_simpan IS NOT NULL THEN
      v_exp := (p_tgl_produksi + (v_simpan || ' months')::interval)::date;
    END IF;
  END IF;

  INSERT INTO public.wellness_batch
    (produk_id, no_batch, tgl_produksi, tgl_kedaluwarsa, qty_produksi,
     qty_sisa, hpp_batch, wo_id, status)
  VALUES (p_produk_id, btrim(p_no_batch), p_tgl_produksi, v_exp, p_qty,
          p_qty, p_hpp, p_wo_id, 'Karantina')
  RETURNING id INTO v_id;

  INSERT INTO public.wellness_stok_mutasi
    (produk_id, batch_id, jenis, qty, saldo_after, ref_tipe, ref_id, oleh, catatan)
  VALUES (p_produk_id, v_id, 'masuk', p_qty, p_qty, 'produksi', p_wo_id, p_oleh,
          'Hasil produksi batch ' || btrim(p_no_batch) || ' — masuk karantina');

  RETURN jsonb_build_object('ok', true, 'batch_id', v_id,
    'kedaluwarsa', v_exp, 'status', 'Karantina');
END $fn$;

-- ── 8. LULUSKAN / TOLAK BATCH ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wellness_putuskan_batch(
  p_batch_id bigint, p_keputusan text, p_catatan text DEFAULT NULL,
  p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_b record;
BEGIN
  IF lower(COALESCE(p_keputusan,'')) NOT IN ('lulus','ditolak','ditarik') THEN
    RETURN jsonb_build_object('error', 'Keputusan harus: lulus, ditolak, atau ditarik.');
  END IF;

  SELECT * INTO v_b FROM public.wellness_batch WHERE id = p_batch_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Batch tidak ditemukan.'); END IF;

  UPDATE public.wellness_batch
     SET status = initcap(p_keputusan),
         catatan = COALESCE(p_catatan, catatan),
         -- Batch yang ditolak atau ditarik sisanya dinolkan supaya tidak
         -- mungkin terambil FEFO lewat jalur lain mana pun.
         qty_sisa = CASE WHEN lower(p_keputusan) IN ('ditolak','ditarik')
                         THEN 0 ELSE qty_sisa END,
         updated_at = now()
   WHERE id = p_batch_id;

  IF lower(p_keputusan) IN ('ditolak','ditarik') AND v_b.qty_sisa > 0 THEN
    INSERT INTO public.wellness_stok_mutasi
      (produk_id, batch_id, jenis, qty, saldo_after, ref_tipe, oleh, catatan)
    VALUES (v_b.produk_id, p_batch_id, 'rusak', v_b.qty_sisa, 0, 'mutu', p_oleh,
            initcap(p_keputusan) || COALESCE(': ' || p_catatan, ''));
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', initcap(p_keputusan));
END $fn$;

GRANT SELECT ON public.wellness_stok TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wellness_ambil_stok(bigint,numeric,text,bigint,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wellness_terima_batch(bigint,text,numeric,date,date,numeric,bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wellness_putuskan_batch(bigint,text,text,text) TO authenticated, service_role;
