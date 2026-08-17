-- 0012 — Penawaran Harga (Quotation)
--
-- Celah nyata dari audit ulang: rantai penjualan berhenti dari deal
-- LANGSUNG ke invoice. Tidak ada tabel maupun modul penawaran sama sekali,
-- padahal untuk jualan B2B ke klinik dan korporat justru penawaran harga
-- yang menjadi dokumen intinya — yang dikirim, dinegosiasikan, dan
-- dijadikan dasar kontrak.
--
--   Lead → Deal → [PENAWARAN] → Invoice
--
-- ── Keputusan penting: harga DIBEKUKAN saat penawaran dibuat ──
-- Baris penawaran menyimpan harga saat itu juga, bukan merujuk products.
-- Katalog berubah sewaktu-waktu; penawaran yang sudah dikirim ke pelanggan
-- TIDAK BOLEH ikut berubah nilainya. Merujuk harga hidup akan membuat
-- dokumen yang sudah diteken diam-diam berbeda dari yang disepakati.

CREATE TABLE IF NOT EXISTS public.quotations (
  id             bigserial PRIMARY KEY,
  nomor          text UNIQUE,
  partner_id     bigint,
  partner_name   text,
  judul          text,
  tanggal        date NOT NULL DEFAULT CURRENT_DATE,
  berlaku_sampai date,
  status         text NOT NULL DEFAULT 'Draft',   -- Draft|Terkirim|Diterima|Ditolak|Kedaluwarsa
  jenis_harga    text NOT NULL DEFAULT 'korporat',-- korporat|normal
  diskon_persen  numeric NOT NULL DEFAULT 0,
  ppn_persen     numeric NOT NULL DEFAULT 0,
  subtotal       numeric NOT NULL DEFAULT 0,
  total          numeric NOT NULL DEFAULT 0,
  catatan        text,
  deal_id        bigint,
  invoice_id     bigint,            -- terisi bila penawaran sudah jadi invoice
  dibuat_oleh    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id           bigserial PRIMARY KEY,
  quotation_id bigint NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id   bigint,
  kode         text,
  nama         text NOT NULL,
  qty          numeric NOT NULL DEFAULT 1 CHECK (qty > 0),
  harga        numeric NOT NULL DEFAULT 0,       -- dibekukan saat dibuat
  jumlah       numeric GENERATED ALWAYS AS (qty * harga) STORED,
  urutan       integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotations_status  ON public.quotations (status, tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_partner ON public.quotations (partner_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_q  ON public.quotation_items (quotation_id, urutan);

-- Nomor berurut per tahun: PNW/2026/0001
CREATE OR REPLACE FUNCTION public.quotation_nomor_baru()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'PNW/' || to_char(CURRENT_DATE, 'YYYY') || '/' ||
         lpad((COALESCE(max(substring(nomor from '\d+$')::int), 0) + 1)::text, 4, '0')
    FROM public.quotations
   WHERE nomor LIKE 'PNW/' || to_char(CURRENT_DATE, 'YYYY') || '/%';
$$;

-- Hitung ulang subtotal & total dari baris. Dijalankan di basis data agar
-- angka tidak bergantung pada perhitungan di peramban yang bisa berbeda.
CREATE OR REPLACE FUNCTION public.quotation_hitung(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub numeric; v_q record; v_total numeric;
BEGIN
  SELECT COALESCE(sum(jumlah), 0) INTO v_sub FROM public.quotation_items WHERE quotation_id = p_id;
  SELECT * INTO v_q FROM public.quotations WHERE id = p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Penawaran tidak ditemukan'); END IF;

  v_total := (v_sub - v_sub * COALESCE(v_q.diskon_persen,0)/100);
  v_total := v_total + v_total * COALESCE(v_q.ppn_persen,0)/100;

  UPDATE public.quotations
     SET subtotal = v_sub, total = round(v_total, 2), updated_at = now()
   WHERE id = p_id;

  RETURN jsonb_build_object('subtotal', v_sub, 'total', round(v_total, 2));
END $$;

-- Ubah penawaran yang DITERIMA menjadi invoice.
--
-- Sengaja menolak bila statusnya bukan 'Diterima' dan bila sudah pernah
-- dijadikan invoice: penawaran yang ganda menjadi dua tagihan adalah
-- kesalahan yang sangat mahal dan sulit ditelusuri kemudian.
CREATE OR REPLACE FUNCTION public.quotation_jadi_invoice(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_q record; v_inv_id bigint; v_nomor text;
BEGIN
  SELECT * INTO v_q FROM public.quotations WHERE id = p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Penawaran tidak ditemukan'); END IF;
  IF v_q.invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Penawaran ini sudah pernah dijadikan invoice #' || v_q.invoice_id);
  END IF;
  IF v_q.status <> 'Diterima' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hanya penawaran berstatus Diterima yang bisa dijadikan invoice');
  END IF;

  v_nomor := 'INV/' || to_char(CURRENT_DATE, 'YYYY') || '/' ||
             lpad((COALESCE((SELECT max(substring(invoice_number from '\d+$')::int)
                               FROM public.invoices
                              WHERE invoice_number LIKE 'INV/' || to_char(CURRENT_DATE,'YYYY') || '/%'), 0) + 1)::text, 4, '0');

  INSERT INTO public.invoices (invoice_number, invoice_date, partner_id, partner_name,
                               service_type, subtotal, discount, ppn_percent,
                               total_amount, due_date, status)
  VALUES (v_nomor, CURRENT_DATE, v_q.partner_id, v_q.partner_name,
          COALESCE(v_q.judul, 'Penawaran ' || v_q.nomor), v_q.subtotal,
          round(v_q.subtotal * COALESCE(v_q.diskon_persen,0)/100, 2),
          COALESCE(v_q.ppn_persen, 0), v_q.total,
          CURRENT_DATE + 30, 'Draft')
  RETURNING id INTO v_inv_id;

  UPDATE public.quotations SET invoice_id = v_inv_id, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'invoice_id', v_inv_id, 'nomor', v_nomor);
END $$;

GRANT EXECUTE ON FUNCTION public.quotation_nomor_baru()          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quotation_hitung(bigint)        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quotation_jadi_invoice(bigint)  TO anon, authenticated, service_role;
