-- ══════════════════════════════════════════════════════════════════
-- WELLNESS — PESANAN D2C MULTI-KANAL, EKSPEDISI, KONSINYASI, LANGGANAN
--
-- Menggantikan layar karangan di modules/business_units/ecommerce_oms.js
-- (689 baris, NOL panggilan data — seluruh isinya array yang ditulis
-- tangan, termasuk nomor resi yang tidak pernah ada).
--
-- ── SATU TABEL PESANAN, BUKAN SATU PER KANAL ──────────────────────
-- Godaan awalnya membuat pesanan_shopee, pesanan_tiktok, dan seterusnya
-- karena tiap kanal punya bentuk data sendiri. Itu keliru: begitu
-- laporan penjualan gabungan diminta — dan itu pasti diminta — semua
-- tabel harus di-UNION dengan kolom yang tidak sepadan. Kanal disimpan
-- sebagai NILAI di kolom, bukan sebagai nama tabel. Bagian yang benar-
-- benar khas kanal masuk ke kolom meta jsonb.
--
-- ── NOMOR PESANAN KANAL BUKAN KUNCI UTAMA ─────────────────────────
-- Shopee dan Tokopedia bisa memakai format nomor yang sama, dan nomor
-- kanal bisa berubah saat pesanan dipecah. Kunci kita sendiri yang
-- dipakai; nomor kanal disimpan bersama nama kanalnya dan unik hanya
-- dalam pasangan itu.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. PESANAN ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellness_pesanan (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_pesanan    text UNIQUE,
  kanal         text NOT NULL,
  no_kanal      text,
  tgl_pesan     timestamp DEFAULT now(),
  -- Pembeli. Sengaja tidak menunjuk ke tabel pasien: pembeli suplemen
  -- di Shopee bukan pasien, dan menautkannya paksa akan membuat rekam
  -- medis penuh nama orang yang tidak pernah berobat.
  pembeli_nama  text,
  pembeli_hp    text,
  pembeli_email text,
  alamat        text,
  kota          text,
  provinsi      text,
  kode_pos      text,
  subtotal      numeric DEFAULT 0,
  ongkir        numeric DEFAULT 0,
  diskon        numeric DEFAULT 0,
  total         numeric DEFAULT 0,
  metode_bayar  text,
  status_bayar  text DEFAULT 'Belum Bayar',
  -- Baru | Diproses | Dikemas | Dikirim | Selesai | Batal | Retur
  status        text DEFAULT 'Baru',
  langganan_id  bigint,
  catatan       text,
  meta          jsonb DEFAULT '{}'::jsonb,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now(),
  UNIQUE (kanal, no_kanal)
);
CREATE INDEX IF NOT EXISTS idx_wpesanan_status ON public.wellness_pesanan(status, tgl_pesan DESC);
CREATE INDEX IF NOT EXISTS idx_wpesanan_kanal  ON public.wellness_pesanan(kanal, tgl_pesan DESC);

-- ── 2. ITEM PESANAN ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellness_pesanan_item (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pesanan_id bigint REFERENCES public.wellness_pesanan(id) ON DELETE CASCADE,
  produk_id  bigint REFERENCES public.wellness_produk(id),
  sku        text,
  nama       text,
  qty        numeric DEFAULT 1,
  harga      numeric DEFAULT 0,
  subtotal   numeric DEFAULT 0,
  -- Diisi saat pengemasan oleh wellness_ambil_stok(). Wajib disimpan:
  -- kalau ada penarikan produk, inilah satu-satunya cara tahu batch
  -- bermasalah itu dikirim ke pembeli yang mana.
  batch_terpakai jsonb DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_wpitem_pesanan ON public.wellness_pesanan_item(pesanan_id);

-- ── 3. PENGIRIMAN ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellness_pengiriman (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pesanan_id bigint REFERENCES public.wellness_pesanan(id) ON DELETE CASCADE,
  kurir      text,
  layanan    text,
  no_resi    text,
  ongkir     numeric DEFAULT 0,
  berat_gram numeric DEFAULT 0,
  tgl_kirim  timestamp,
  tgl_sampai timestamp,
  status     text DEFAULT 'Menunggu Pickup',
  riwayat    jsonb DEFAULT '[]'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wkirim_resi ON public.wellness_pengiriman(no_resi);

-- ── 4. KONSINYASI APOTEK MITRA ────────────────────────────────────
-- Barang titipan: stok fisik pindah ke apotek, tapi kepemilikan tetap
-- milik kita sampai terjual. Karena itu ia TIDAK boleh dicatat sebagai
-- penjualan saat dikirim — kalau begitu, omzet tercatat untuk barang
-- yang mungkin kembali utuh sebulan kemudian.
CREATE TABLE IF NOT EXISTS public.wellness_apotek (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode       text UNIQUE,
  nama       text NOT NULL,
  pic        text,
  hp         text,
  alamat     text,
  kota       text,
  komisi_pct numeric DEFAULT 0,
  status     text DEFAULT 'Aktif',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellness_konsinyasi (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  apotek_id  bigint REFERENCES public.wellness_apotek(id) ON DELETE CASCADE,
  produk_id  bigint REFERENCES public.wellness_produk(id),
  batch_id   bigint REFERENCES public.wellness_batch(id),
  qty_titip  numeric DEFAULT 0,
  qty_terjual numeric DEFAULT 0,
  qty_retur  numeric DEFAULT 0,
  harga_jual numeric DEFAULT 0,
  tgl_titip  date DEFAULT current_date,
  tgl_settle date,
  status     text DEFAULT 'Dititipkan',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wkonsi_apotek ON public.wellness_konsinyasi(apotek_id, status);

-- ── 5. LANGGANAN / AUTO-REFILL ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellness_langganan (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode          text UNIQUE,
  pelanggan_nama text,
  pelanggan_hp  text,
  pelanggan_email text,
  alamat        text,
  kota          text,
  interval_hari int DEFAULT 30,
  tgl_mulai     date DEFAULT current_date,
  tgl_kirim_berikut date,
  harga_per_siklus numeric DEFAULT 0,
  -- Aktif | Jeda | Berhenti
  status        text DEFAULT 'Aktif',
  alasan_berhenti text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellness_langganan_item (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  langganan_id bigint REFERENCES public.wellness_langganan(id) ON DELETE CASCADE,
  produk_id    bigint REFERENCES public.wellness_produk(id),
  qty          numeric DEFAULT 1
);

-- ── 6. BUAT PESANAN ───────────────────────────────────────────────
-- Stok TIDAK dipotong di sini. Pesanan baru masuk belum tentu dibayar
-- (COD dibatalkan, pembayaran kedaluwarsa). Pemotongan terjadi saat
-- pengemasan — lihat wellness_kemas_pesanan().
CREATE OR REPLACE FUNCTION public.wellness_buat_pesanan(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_id bigint; v_no text; v_it jsonb; v_sub numeric := 0;
  v_harga numeric; v_qty numeric; v_pid bigint; v_prod record; v_kanal text;
BEGIN
  v_kanal := lower(COALESCE(p_data->>'kanal', ''));
  IF v_kanal = '' THEN
    RETURN jsonb_build_object('error', 'Kanal penjualan wajib diisi.');
  END IF;
  IF COALESCE(jsonb_array_length(p_data->'item'), 0) = 0 THEN
    RETURN jsonb_build_object('error', 'Pesanan harus berisi minimal satu barang.');
  END IF;

  v_no := 'WO-' || to_char(now(), 'YYMMDD') || '-' ||
          lpad((COALESCE((SELECT count(*) FROM public.wellness_pesanan
                          WHERE tgl_pesan::date = current_date), 0) + 1)::text, 4, '0');

  INSERT INTO public.wellness_pesanan
    (no_pesanan, kanal, no_kanal, pembeli_nama, pembeli_hp, pembeli_email,
     alamat, kota, provinsi, kode_pos, ongkir, diskon, metode_bayar,
     status_bayar, catatan, meta, langganan_id)
  VALUES (v_no, v_kanal, NULLIF(p_data->>'no_kanal',''),
          p_data->>'pembeli_nama', p_data->>'pembeli_hp', p_data->>'pembeli_email',
          p_data->>'alamat', p_data->>'kota', p_data->>'provinsi', p_data->>'kode_pos',
          COALESCE((p_data->>'ongkir')::numeric, 0),
          COALESCE((p_data->>'diskon')::numeric, 0),
          p_data->>'metode_bayar',
          COALESCE(NULLIF(p_data->>'status_bayar',''), 'Belum Bayar'),
          p_data->>'catatan',
          COALESCE(p_data->'meta', '{}'::jsonb),
          NULLIF(p_data->>'langganan_id','')::bigint)
  RETURNING id INTO v_id;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_data->'item') LOOP
    v_pid := NULLIF(v_it->>'produk_id','')::bigint;
    v_qty := COALESCE((v_it->>'qty')::numeric, 1);

    SELECT * INTO v_prod FROM public.wellness_produk WHERE id = v_pid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk id % tidak ditemukan.', v_pid;
    END IF;

    -- Harga diambil dari master per kanal, BUKAN dari yang dikirim
    -- klien. Harga yang datang dari layar bisa disetel siapa saja
    -- lewat alat pengembang peramban.
    SELECT harga INTO v_harga FROM public.wellness_harga_kanal
     WHERE produk_id = v_pid AND kanal = v_kanal AND aktif;
    IF v_harga IS NULL THEN v_harga := v_prod.harga_normal; END IF;

    INSERT INTO public.wellness_pesanan_item
      (pesanan_id, produk_id, sku, nama, qty, harga, subtotal)
    VALUES (v_id, v_pid, v_prod.sku, v_prod.nama, v_qty, v_harga, v_harga * v_qty);

    v_sub := v_sub + (v_harga * v_qty);
  END LOOP;

  UPDATE public.wellness_pesanan
     SET subtotal = v_sub, total = v_sub + ongkir - diskon
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_pesanan', v_no, 'total', v_sub);
END $fn$;

-- ── 7. KEMAS PESANAN (di sinilah stok dipotong) ───────────────────
CREATE OR REPLACE FUNCTION public.wellness_kemas_pesanan(
  p_pesanan_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_p record; v_i record; v_amb jsonb; v_hasil jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_p FROM public.wellness_pesanan WHERE id = p_pesanan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Pesanan tidak ditemukan.'); END IF;

  -- Penjaga idempoten. Tanpa ini, klik ganda pada tombol Kemas memotong
  -- stok dua kali untuk pesanan yang sama.
  IF v_p.status NOT IN ('Baru','Diproses') THEN
    RETURN jsonb_build_object('error',
      format('Pesanan berstatus "%s" — hanya pesanan Baru atau Diproses yang bisa dikemas.', v_p.status));
  END IF;

  FOR v_i IN SELECT * FROM public.wellness_pesanan_item WHERE pesanan_id = p_pesanan_id LOOP
    v_amb := public.wellness_ambil_stok(
      v_i.produk_id, v_i.qty, 'pesanan', p_pesanan_id, v_p.no_pesanan, p_oleh);

    IF v_amb ? 'error' THEN
      -- RAISE, bukan RETURN: kalau barang kedua gagal, potongan barang
      -- pertama harus ikut batal. Mengembalikan error biasa akan
      -- meninggalkan stok terpotong untuk pesanan yang tidak jadi.
      RAISE EXCEPTION 'Gagal mengemas %: %', v_i.nama, v_amb->>'error';
    END IF;

    UPDATE public.wellness_pesanan_item
       SET batch_terpakai = v_amb->'batch' WHERE id = v_i.id;

    v_hasil := v_hasil || jsonb_build_object(
      'sku', v_i.sku, 'nama', v_i.nama, 'qty', v_i.qty, 'batch', v_amb->'batch');
  END LOOP;

  UPDATE public.wellness_pesanan
     SET status = 'Dikemas', updated_at = now() WHERE id = p_pesanan_id;

  RETURN jsonb_build_object('ok', true, 'no_pesanan', v_p.no_pesanan, 'rincian', v_hasil);
END $fn$;

-- ── 8. CATAT PENGIRIMAN ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wellness_kirim_pesanan(
  p_pesanan_id bigint, p_kurir text, p_layanan text, p_no_resi text,
  p_ongkir numeric DEFAULT 0, p_berat numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_st text; v_id bigint;
BEGIN
  SELECT status INTO v_st FROM public.wellness_pesanan WHERE id = p_pesanan_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Pesanan tidak ditemukan.'); END IF;
  IF v_st <> 'Dikemas' THEN
    RETURN jsonb_build_object('error',
      'Pesanan harus dikemas dulu sebelum dikirim (status sekarang: ' || v_st || ').');
  END IF;
  IF COALESCE(btrim(p_no_resi),'') = '' THEN
    RETURN jsonb_build_object('error','Nomor resi wajib diisi.');
  END IF;

  INSERT INTO public.wellness_pengiriman
    (pesanan_id, kurir, layanan, no_resi, ongkir, berat_gram, tgl_kirim, status,
     riwayat)
  VALUES (p_pesanan_id, p_kurir, p_layanan, btrim(p_no_resi), p_ongkir, p_berat,
          now(), 'Dikirim',
          jsonb_build_array(jsonb_build_object(
            'waktu', now(), 'status', 'Dikirim', 'ket', 'Paket diserahkan ke ' || COALESCE(p_kurir,'kurir'))))
  RETURNING id INTO v_id;

  UPDATE public.wellness_pesanan
     SET status = 'Dikirim', updated_at = now() WHERE id = p_pesanan_id;

  RETURN jsonb_build_object('ok', true, 'pengiriman_id', v_id, 'no_resi', btrim(p_no_resi));
END $fn$;

-- ── 9. LAPORAN PENJUALAN PER KANAL ────────────────────────────────
CREATE OR REPLACE VIEW public.wellness_penjualan_kanal AS
SELECT kanal,
       count(*)                                              AS jml_pesanan,
       count(*) FILTER (WHERE status = 'Selesai')            AS jml_selesai,
       count(*) FILTER (WHERE status = 'Batal')              AS jml_batal,
       COALESCE(SUM(total) FILTER (WHERE status <> 'Batal'), 0) AS omzet,
       COALESCE(AVG(total) FILTER (WHERE status <> 'Batal'), 0) AS rata_nilai_pesanan
  FROM public.wellness_pesanan
 GROUP BY kanal;

-- ── 10. LANGGANAN JATUH TEMPO ─────────────────────────────────────
-- Tidak membuat pesanan otomatis. Pengiriman rutin yang terkirim tanpa
-- ada yang menengok adalah cara cepat mengirim barang ke alamat lama
-- atau ke pelanggan yang sudah minta berhenti. Daftar ini disodorkan
-- ke petugas untuk dijalankan.
CREATE OR REPLACE VIEW public.wellness_langganan_jatuh_tempo AS
SELECT l.*,
       (SELECT count(*) FROM public.wellness_langganan_item i WHERE i.langganan_id = l.id) AS jml_item,
       (current_date - l.tgl_kirim_berikut) AS telat_hari
  FROM public.wellness_langganan l
 WHERE l.status = 'Aktif'
   AND l.tgl_kirim_berikut IS NOT NULL
   AND l.tgl_kirim_berikut <= current_date + 3;

GRANT SELECT ON public.wellness_penjualan_kanal, public.wellness_langganan_jatuh_tempo
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wellness_buat_pesanan(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wellness_kemas_pesanan(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wellness_kirim_pesanan(bigint,text,text,text,numeric,numeric) TO authenticated, service_role;
