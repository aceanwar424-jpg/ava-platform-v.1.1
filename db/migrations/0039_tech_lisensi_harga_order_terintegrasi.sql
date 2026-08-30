-- ══════════════════════════════════════════════════════════════════
-- AVA TECH — PAKET HARGA & AKTIVASI LISENSI
-- HIS      — ORDER TERINTEGRASI
--
-- Lima menu berstatus "ada" tanpa data di belakangnya:
--   tech-harga       paket berlangganan yang dijual AVA Tech
--   tech-aktivasi    aktivasi lisensi per tenant
--   tech-telemetri   pemakaian nyata tiap tenant
--   his-orders       order lintas layanan (lab + radiologi + tindakan)
--   his-mpi          sudah punya tabel (mpi_person) — hanya perlu disambung
--
-- tenants dan tenant_pemakaian sudah ada (migrasi 0004 & 0029); yang
-- belum ada adalah apa yang dijual dan lisensi yang menghidupkannya.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. PAKET YANG DIJUAL ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tech_paket (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode          text UNIQUE NOT NULL,
  nama          text NOT NULL,
  untuk         text,                   -- klinik | lab | wellness | suite
  harga_bulanan numeric DEFAULT 0,
  harga_tahunan numeric DEFAULT 0,
  -- Batas pemakaian. NULL berarti tanpa batas — dibedakan dari 0, yang
  -- berarti fitur itu tidak termasuk sama sekali.
  batas_pengguna     int,
  batas_transaksi_bln int,
  batas_penyimpanan_gb numeric,
  modul_termasuk jsonb DEFAULT '[]'::jsonb,
  keterangan    text,
  urutan_tampil int DEFAULT 0,
  status        text DEFAULT 'Aktif',
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);

-- ── 2. LISENSI PER TENANT ─────────────────────────────────────────
-- Satu tenant bisa punya beberapa baris lisensi sepanjang waktu
-- (perpanjangan, naik paket). Yang berlaku adalah yang belum kedaluwarsa
-- dan berstatus Aktif — bukan baris terakhir yang dibuat.
CREATE TABLE IF NOT EXISTS public.tech_lisensi (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  paket_id      bigint REFERENCES public.tech_paket(id),
  kode_lisensi  text UNIQUE NOT NULL,
  -- Sidik kunci publik Ed25519 dari berkas lisensi luring (fase 4).
  -- Kuncinya sendiri TIDAK disimpan di sini.
  sidik_kunci   text,
  tgl_mulai     date DEFAULT current_date,
  tgl_berakhir  date,
  siklus        text DEFAULT 'bulanan', -- bulanan | tahunan
  nilai         numeric DEFAULT 0,
  -- Belum Aktif | Aktif | Kedaluwarsa | Dicabut
  status        text DEFAULT 'Belum Aktif',
  diaktifkan_at timestamp,
  diaktifkan_oleh text,
  dicabut_at    timestamp,
  alasan_cabut  text,
  catatan       text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lisensi_tenant ON public.tech_lisensi(tenant_id, status);

-- ── 3. AKTIVASI ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tech_aktifkan_lisensi(
  p_kode text, p_sidik_kunci text DEFAULT NULL, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_l record; v_t record; v_p record;
BEGIN
  SELECT * INTO v_l FROM public.tech_lisensi
   WHERE upper(btrim(kode_lisensi)) = upper(btrim(p_kode)) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','Kode lisensi tidak dikenal.');
  END IF;

  IF v_l.status = 'Dicabut' THEN
    RETURN jsonb_build_object('error',
      'Lisensi ini dicabut' || COALESCE(': ' || v_l.alasan_cabut, '') || '.');
  END IF;
  IF v_l.status = 'Aktif' THEN
    RETURN jsonb_build_object('error',
      format('Lisensi sudah aktif sejak %s.', v_l.diaktifkan_at::date));
  END IF;
  IF v_l.tgl_berakhir IS NOT NULL AND v_l.tgl_berakhir < current_date THEN
    RETURN jsonb_build_object('error',
      format('Masa berlaku lisensi sudah lewat (%s).', v_l.tgl_berakhir));
  END IF;

  UPDATE public.tech_lisensi
     SET status = 'Aktif', diaktifkan_at = now(), diaktifkan_oleh = p_oleh,
         sidik_kunci = COALESCE(p_sidik_kunci, sidik_kunci), updated_at = now()
   WHERE id = v_l.id;

  -- Tenant dihidupkan bersamaan. Lisensi aktif dengan tenant nonaktif
  -- adalah keadaan yang membingungkan: pelanggan sudah membayar tapi
  -- tidak bisa masuk, dan tidak ada satu tempat pun yang menjelaskannya.
  UPDATE public.tenants SET is_active = true WHERE id = v_l.tenant_id;

  SELECT * INTO v_t FROM public.tenants  WHERE id = v_l.tenant_id;
  SELECT * INTO v_p FROM public.tech_paket WHERE id = v_l.paket_id;

  RETURN jsonb_build_object('ok', true, 'tenant', v_t.nama,
    'paket', COALESCE(v_p.nama, '—'), 'berlaku_sampai', v_l.tgl_berakhir);
END $fn$;

CREATE OR REPLACE FUNCTION public.tech_cabut_lisensi(
  p_lisensi_id bigint, p_alasan text, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_l record;
BEGIN
  IF COALESCE(btrim(p_alasan),'') = '' THEN
    RETURN jsonb_build_object('error','Alasan pencabutan wajib diisi.');
  END IF;

  SELECT * INTO v_l FROM public.tech_lisensi WHERE id = p_lisensi_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Lisensi tidak ditemukan.'); END IF;

  UPDATE public.tech_lisensi
     SET status = 'Dicabut', dicabut_at = now(),
         alasan_cabut = btrim(p_alasan), updated_at = now()
   WHERE id = p_lisensi_id;

  -- Tenant TIDAK otomatis dimatikan. Mencabut lisensi sering terjadi saat
  -- perpanjangan sedang diurus; mematikan akses seketika berarti klinik
  -- berhenti melayani pasien karena urusan administrasi. Penonaktifan
  -- adalah keputusan terpisah yang disengaja.
  RETURN jsonb_build_object('ok', true,
    'catatan', 'Lisensi dicabut. Akses tenant belum dimatikan — matikan '
             || 'terpisah bila memang dikehendaki.');
END $fn$;

-- ── 4. PAPAN LISENSI + PEMAKAIAN ──────────────────────────────────
CREATE OR REPLACE VIEW public.tech_papan_lisensi AS
SELECT l.id, l.kode_lisensi, l.status, l.tgl_mulai, l.tgl_berakhir,
       l.siklus, l.nilai, l.diaktifkan_at,
       t.id AS tenant_id, t.kode AS tenant_kode, t.nama AS tenant_nama,
       t.jenis AS tenant_jenis, t.is_active AS tenant_aktif,
       p.kode AS paket_kode, p.nama AS paket_nama,
       p.batas_pengguna, p.batas_transaksi_bln,
       CASE WHEN l.tgl_berakhir IS NULL THEN NULL
            ELSE l.tgl_berakhir - current_date END AS sisa_hari,
       (l.status = 'Aktif' AND l.tgl_berakhir IS NOT NULL
        AND l.tgl_berakhir - current_date <= 30)          AS segera_berakhir
  FROM public.tech_lisensi l
  LEFT JOIN public.tenants     t ON t.id = l.tenant_id
  LEFT JOIN public.tech_paket  p ON p.id = l.paket_id;

-- ══════════════════════════════════════════════════════════════════
-- ORDER TERINTEGRASI
--
-- Satu permintaan pemeriksaan yang isinya bisa lintas layanan: lab,
-- radiologi, dan tindakan. Sebelumnya tiap layanan punya jalurnya
-- sendiri (lab_samples, radiology_orders), sehingga tidak ada satu
-- tempat pun yang bisa menjawab "apa saja yang diminta untuk pasien ini
-- hari ini, dan mana yang belum selesai".
--
-- Order ini TIDAK menggantikan tabel per layanan — ia menjadi induknya.
-- Menggantinya berarti menulis ulang seluruh alur lab dan radiologi yang
-- sudah berjalan.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.order_terintegrasi (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_order      text UNIQUE,
  admission_id  bigint,
  visit_number  text,
  patient_name  text,
  mr_number     text,
  dokter_perujuk text,
  klinis        text,                   -- keterangan klinis / diagnosis kerja
  prioritas     text DEFAULT 'Rutin',   -- Rutin | Cito
  -- Draf | Dikirim | Sebagian Selesai | Selesai | Batal
  status        text DEFAULT 'Draf',
  total         numeric DEFAULT 0,
  dibuat_oleh   text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orderint_status ON public.order_terintegrasi(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_terintegrasi_item (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id     bigint REFERENCES public.order_terintegrasi(id) ON DELETE CASCADE,
  layanan      text NOT NULL,           -- lab | radiologi | tindakan
  product_id   bigint,
  kode         text,
  nama         text,
  harga        numeric DEFAULT 0,
  -- Diminta | Diproses | Selesai | Batal
  status       text DEFAULT 'Diminta',
  -- Penunjuk ke baris di tabel layanan masing-masing, diisi saat order
  -- diteruskan. Inilah yang menyambungkan order ke pekerjaan nyatanya.
  ref_tabel    text,
  ref_id       bigint,
  catatan      text
);
CREATE INDEX IF NOT EXISTS idx_orderint_item ON public.order_terintegrasi_item(order_id);

-- ── 5. BUAT ORDER ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.order_terintegrasi_buat(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_id bigint; v_no text; v_it jsonb; v_total numeric := 0;
  v_harga numeric; v_prod record;
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
    v_harga := NULL; v_prod := NULL;

    -- Harga diambil dari master, bukan dari yang dikirim layar.
    IF NULLIF(v_it->>'product_id','') IS NOT NULL THEN
      SELECT * INTO v_prod FROM public.products
       WHERE id = (v_it->>'product_id')::bigint;
      IF FOUND THEN v_harga := v_prod.harga_normal; END IF;
    END IF;

    INSERT INTO public.order_terintegrasi_item
      (order_id, layanan, product_id, kode, nama, harga, catatan)
    VALUES (v_id, lower(COALESCE(v_it->>'layanan','lab')),
            NULLIF(v_it->>'product_id','')::bigint,
            COALESCE(v_it->>'kode', v_prod.kode_internal),
            COALESCE(v_it->>'nama', v_prod.nama_tes),
            COALESCE(v_harga, 0), v_it->>'catatan');

    v_total := v_total + COALESCE(v_harga, 0);
  END LOOP;

  UPDATE public.order_terintegrasi SET total = v_total WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_order', v_no,
    'total', v_total);
END $fn$;

-- ── 6. PERBARUI STATUS ITEM → STATUS INDUK IKUT ───────────────────
-- Status induk dihitung dari itemnya, bukan disetel terpisah. Dua angka
-- yang harus dijaga sinkron secara manual selalu berakhir berbeda.
CREATE OR REPLACE FUNCTION public.order_terintegrasi_status_item(
  p_item_id bigint, p_status text, p_ref_tabel text DEFAULT NULL,
  p_ref_id bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_order bigint; v_total int; v_selesai int; v_batal int; v_st text;
BEGIN
  IF p_status NOT IN ('Diminta','Diproses','Selesai','Batal') THEN
    RETURN jsonb_build_object('error','Status item tidak dikenal.');
  END IF;

  UPDATE public.order_terintegrasi_item
     SET status = p_status,
         ref_tabel = COALESCE(p_ref_tabel, ref_tabel),
         ref_id = COALESCE(p_ref_id, ref_id)
   WHERE id = p_item_id
  RETURNING order_id INTO v_order;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error','Item order tidak ditemukan.');
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'Selesai'),
         count(*) FILTER (WHERE status = 'Batal')
    INTO v_total, v_selesai, v_batal
    FROM public.order_terintegrasi_item WHERE order_id = v_order;

  v_st := CASE
    WHEN v_batal = v_total                    THEN 'Batal'
    WHEN v_selesai + v_batal = v_total        THEN 'Selesai'
    WHEN v_selesai > 0                        THEN 'Sebagian Selesai'
    ELSE 'Dikirim' END;

  UPDATE public.order_terintegrasi
     SET status = v_st, updated_at = now() WHERE id = v_order;

  RETURN jsonb_build_object('ok', true, 'status_order', v_st,
    'selesai', v_selesai, 'total', v_total);
END $fn$;

CREATE OR REPLACE VIEW public.order_terintegrasi_papan AS
SELECT o.*,
       (SELECT count(*) FROM public.order_terintegrasi_item i
         WHERE i.order_id = o.id)                              AS jml_item,
       (SELECT count(*) FROM public.order_terintegrasi_item i
         WHERE i.order_id = o.id AND i.status = 'Selesai')      AS jml_selesai,
       (SELECT string_agg(DISTINCT i.layanan, ', ')
          FROM public.order_terintegrasi_item i
         WHERE i.order_id = o.id)                              AS layanan
  FROM public.order_terintegrasi o;

GRANT SELECT ON public.tech_papan_lisensi, public.order_terintegrasi_papan
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tech_aktifkan_lisensi(text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tech_cabut_lisensi(bigint,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_terintegrasi_buat(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_terintegrasi_status_item(bigint,text,text,bigint) TO authenticated, service_role;
