-- ══════════════════════════════════════════════════════════════════
-- AVA TECH — DATA PENJUALAN & LISENSI SISTEM
--
-- AVA Tech adalah unit yang MEMBANGUN platform ini dan MENJUALNYA ke
-- faskes lain. Sampai sekarang unit itu tidak punya data sama sekali:
-- modules/business_units/tech_saas.js menyimpan daftar kliennya di dalam
-- sebuah array JavaScript (SAAS_TENANTS) yang hilang setiap kali halaman
-- dimuat ulang, dan provisionNewTenant() hanya mendorong baris ke array
-- itu lalu mengembalikan pesan "berhasil diprovisioning".
--
-- Tabel public.tenants sendiri sudah ada sejak 0004_tenancy.sql, tetapi
-- hanya menyimpan identitas (kode, nama, jenis) — cukup untuk memisahkan
-- data antar tenant, tidak cukup untuk mengelola penjualan.
--
-- Migrasi ini menambahkan yang kurang, DI ATAS tabel yang sudah ada.
-- Tidak ada tabel tenant kedua: satu klien = satu baris tenants, dipakai
-- bersama oleh isolasi data dan oleh pengelolaan langganan.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS paket           text,          -- STARTER_LIS | CLINIC_PRATAMA | ENTERPRISE_RS | MASTER_HOLDING
  ADD COLUMN IF NOT EXISTS subdomain       text,
  ADD COLUMN IF NOT EXISTS pic_nama        text,
  ADD COLUMN IF NOT EXISTS pic_kontak      text,
  ADD COLUMN IF NOT EXISTS kota            text,
  ADD COLUMN IF NOT EXISTS mulai_langganan date,
  ADD COLUMN IF NOT EXISTS habis_langganan date,
  ADD COLUMN IF NOT EXISTS nilai_langganan numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kuota_tes       integer DEFAULT 0,   -- 0 = tanpa batas
  ADD COLUMN IF NOT EXISTS kuota_kunjungan integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS catatan         text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

COMMENT ON COLUMN public.tenants.paket IS
  'Paket lisensi yang dibeli klien. Menentukan kuota bawaan, bukan penguncian fitur.';
COMMENT ON COLUMN public.tenants.kuota_tes IS
  'Batas pemakaian per periode. 0 berarti tanpa batas — dipakai tenant lokal sendiri.';

-- Instalasi ini sendiri bukan klien berbayar. Ditandai supaya tidak ikut
-- terhitung sebagai penjualan di ringkasan AVA Tech.
UPDATE public.tenants
   SET paket = 'MASTER_HOLDING', catatan = 'Instalasi milik sendiri, bukan klien'
 WHERE kode = 'lokal' AND paket IS NULL;


-- ══════════════════════════════════════════════════════════════════
-- Pencatatan pemakaian per tenant.
--
-- trackUsageMetering() sebelumnya menaikkan angka di dalam array memori,
-- sehingga pemakaian klien tidak pernah benar-benar tercatat dan tidak bisa
-- ditagihkan. Tabel ini membuatnya bertahan.
--
-- Satu baris per tenant per bulan per jenis metrik. Agregasi dilakukan saat
-- membaca; menyimpan satu baris per kejadian akan tumbuh sangat cepat pada
-- instalasi laboratorium yang sibuk tanpa memberi informasi tambahan yang
-- dipakai untuk menagih.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tenant_pemakaian (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  periode    text NOT NULL,                    -- 'YYYY-MM'
  metrik     text NOT NULL,                    -- 'tes_lab' | 'kunjungan_emr'
  jumlah     integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, periode, metrik)
);

CREATE INDEX IF NOT EXISTS idx_tenant_pemakaian_periode
  ON public.tenant_pemakaian (periode, metrik);


-- Menaikkan pemakaian secara atomik. UPSERT dipakai supaya dua permintaan
-- bersamaan tidak saling menimpa — masalah yang sama dengan penomoran
-- dokumen di 0021, dan diselesaikan dengan cara yang sama.
CREATE OR REPLACE FUNCTION public.tenant_catat_pemakaian(
  p_tenant uuid, p_metrik text, p_jumlah integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_periode text := to_char(now(), 'YYYY-MM');
  v_total   integer;
  v_kuota   integer;
BEGIN
  IF p_metrik NOT IN ('tes_lab', 'kunjungan_emr') THEN
    RETURN jsonb_build_object('error', 'Metrik tidak dikenali.');
  END IF;

  INSERT INTO public.tenant_pemakaian (tenant_id, periode, metrik, jumlah)
  VALUES (p_tenant, v_periode, p_metrik, GREATEST(COALESCE(p_jumlah, 1), 0))
  ON CONFLICT (tenant_id, periode, metrik) DO UPDATE
    SET jumlah = public.tenant_pemakaian.jumlah + GREATEST(COALESCE(p_jumlah, 1), 0),
        updated_at = now()
  RETURNING jumlah INTO v_total;

  SELECT CASE WHEN p_metrik = 'tes_lab' THEN kuota_tes ELSE kuota_kunjungan END
    INTO v_kuota FROM public.tenants WHERE id = p_tenant;

  RETURN jsonb_build_object(
    'ok', true, 'periode', v_periode, 'metrik', p_metrik,
    'terpakai', v_total, 'kuota', COALESCE(v_kuota, 0),
    -- Kuota 0 berarti tanpa batas; jangan pernah dilaporkan terlampaui.
    'terlampaui', COALESCE(v_kuota, 0) > 0 AND v_total > v_kuota);
END $$;

GRANT EXECUTE ON FUNCTION public.tenant_catat_pemakaian(uuid, text, integer)
  TO authenticated, service_role;


-- Ringkasan untuk cockpit AVA Tech: satu baris per tenant beserta pemakaian
-- bulan berjalan. Dibuat sebagai view supaya layar tidak perlu menyusun
-- kueri agregat sendiri dan tidak bisa salah menghitungnya.
CREATE OR REPLACE VIEW public.tenant_ringkasan AS
SELECT
  t.id, t.kode, t.nama, t.jenis, t.is_active,
  t.paket, t.subdomain, t.kota, t.pic_nama, t.pic_kontak,
  t.mulai_langganan, t.habis_langganan, t.nilai_langganan,
  t.kuota_tes, t.kuota_kunjungan, t.catatan,
  COALESCE(u.tes, 0)       AS pakai_tes,
  COALESCE(u.kunjungan, 0) AS pakai_kunjungan,
  CASE
    WHEN t.habis_langganan IS NULL THEN 'tanpa-batas'
    WHEN t.habis_langganan < CURRENT_DATE THEN 'kedaluwarsa'
    WHEN t.habis_langganan < CURRENT_DATE + 30 THEN 'segera-berakhir'
    ELSE 'aktif'
  END AS status_langganan
FROM public.tenants t
LEFT JOIN (
  SELECT tenant_id,
         sum(jumlah) FILTER (WHERE metrik = 'tes_lab')       AS tes,
         sum(jumlah) FILTER (WHERE metrik = 'kunjungan_emr') AS kunjungan
    FROM public.tenant_pemakaian
   WHERE periode = to_char(now(), 'YYYY-MM')
   GROUP BY tenant_id
) u ON u.tenant_id = t.id;

GRANT SELECT ON public.tenant_ringkasan TO authenticated, service_role;
