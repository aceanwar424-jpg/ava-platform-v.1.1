-- 0013 — Pusat Kendali Operasional & Corong Penjualan
--
-- Dua fokus utama pemilik: operasional menyeluruh, dan marketing/sales.
--
-- Dasbor yang ada hanya berorientasi penjualan (leads, deals, invoices).
-- Tidak ada satu layar pun yang menjawab pertanyaan paling sering diucapkan
-- di lantai operasional: "apa yang perlu ditangani SEKARANG?" — sehingga
-- petugas harus membuka enam layar bergantian untuk menyusunnya sendiri.
--
-- Corong penjualan juga belum pernah utuh: tahap penawaran baru ada sejak
-- migrasi 0012, sehingga konversi dari prospek sampai tagihan tidak pernah
-- bisa diukur ujung ke ujung.

-- ══════════════════════════════════════════════════════════════════
-- A. PUSAT KENDALI OPERASIONAL
-- Bukan laporan, melainkan daftar tindakan. Setiap angka di sini harus
-- bisa dijawab dengan "siapa mengerjakan apa berikutnya".
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ops_kendali(p_ambang_jam integer DEFAULT 4)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(

    -- Sampel yang menggantung. Dipisah menurut TAHAP, karena penanganannya
    -- berbeda: yang belum diterima urusan penerimaan, yang sudah diterima
    -- tapi belum ada hasil urusan analis.
    'sampel', jsonb_build_object(
      'belum_diterima', (SELECT count(*) FROM public.lab_samples
                          WHERE received_at IS NULL AND COALESCE(status,'') NOT IN ('Ditolak','Batal')),
      'diproses',       (SELECT count(*) FROM public.lab_samples s
                          WHERE s.received_at IS NOT NULL
                            AND NOT EXISTS (SELECT 1 FROM public.lab_results r
                                             WHERE r.visit_number = s.visit_number)),
      -- Tertahan melewati ambang: inilah yang menjadi keluhan pasien.
      'tertahan',       (SELECT count(*) FROM public.lab_samples s
                          WHERE s.received_at IS NOT NULL
                            AND s.received_at < now() - make_interval(hours => p_ambang_jam)
                            AND NOT EXISTS (SELECT 1 FROM public.lab_results r
                                             WHERE r.visit_number = s.visit_number)),
      'ditolak_hari_ini', (SELECT count(*) FROM public.lab_samples
                            WHERE COALESCE(status,'') = 'Ditolak'
                              AND created_at::date = CURRENT_DATE)
    ),

    -- Hasil yang menunggu manusia. Dua jenjang validasi memang disengaja,
    -- tapi keduanya bisa menjadi antrean yang tak terlihat.
    'hasil', jsonb_build_object(
      'menunggu_validasi', (SELECT count(*) FROM public.lab_results
                             WHERE validated_at IS NULL AND entered_at IS NOT NULL),
      'menunggu_approval', (SELECT count(*) FROM public.lab_results
                             WHERE approved_at IS NULL AND validated_at IS NOT NULL),
      'selesai_hari_ini',  (SELECT count(*) FROM public.lab_results
                             WHERE approved_at::date = CURRENT_DATE)
    ),

    'kunjungan', jsonb_build_object(
      'hari_ini',    (SELECT count(*) FROM public.admissions WHERE visit_date = CURRENT_DATE),
      'belum_bayar', (SELECT count(*) FROM public.admissions
                       WHERE COALESCE(payment_status,'') = 'Unpaid'
                         AND COALESCE(status,'') <> 'Cancelled')
    ),

    -- Stok menipis: dihitung terhadap ambang minimum yang sudah ditetapkan,
    -- bukan angka tetap — tiap reagen punya laju pakai sendiri.
    'stok', jsonb_build_object(
      'di_bawah_minimum', (SELECT count(*) FROM public.inventory_items
                            WHERE COALESCE(min_stock,0) > 0 AND COALESCE(stock_qty,0) <= min_stock),
      'habis',            (SELECT count(*) FROM public.inventory_items WHERE COALESCE(stock_qty,0) <= 0)
    ),

    'keuangan', jsonb_build_object(
      'tagihan_lewat_tempo', (SELECT count(*) FROM public.invoices
                               WHERE COALESCE(status,'') NOT IN ('Dibayar','Dibatalkan')
                                 AND due_date < CURRENT_DATE),
      'nilai_lewat_tempo',   (SELECT COALESCE(sum(total_amount),0) FROM public.invoices
                               WHERE COALESCE(status,'') NOT IN ('Dibayar','Dibatalkan')
                                 AND due_date < CURRENT_DATE)
    ),

    -- Daftar sampel tertahan terlama: layar ini harus bisa ditindaklanjuti,
    -- bukan sekadar memberi angka.
    'tertahan_terlama', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'jam')::numeric DESC)
        FROM (SELECT jsonb_build_object(
                 'barcode', s.barcode, 'pasien', s.patient_name,
                 'pemeriksaan', s.product_name,
                 'jam', round(EXTRACT(EPOCH FROM (now() - s.received_at))/3600, 1)) x
                FROM public.lab_samples s
               WHERE s.received_at IS NOT NULL
                 AND s.received_at < now() - make_interval(hours => p_ambang_jam)
                 AND NOT EXISTS (SELECT 1 FROM public.lab_results r WHERE r.visit_number = s.visit_number)
               ORDER BY s.received_at LIMIT 15) t), '[]'::jsonb),

    'ambang_jam', p_ambang_jam,
    'diambil_pada', now()
  );
$$;

-- ══════════════════════════════════════════════════════════════════
-- B. CORONG PENJUALAN
-- Prospek → Deal → Penawaran → Invoice. Tahap penawaran baru ada sejak
-- 0012, jadi baru sekarang corongnya bisa diukur ujung ke ujung.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sales_corong(p_hari integer DEFAULT 90)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH batas AS (SELECT now() - make_interval(days => p_hari) AS sejak)
  SELECT jsonb_build_object(
    'tahap', jsonb_build_array(
      jsonb_build_object('nama','Prospek',   'jumlah',
        (SELECT count(*) FROM public.leads, batas WHERE created_at > sejak), 'nilai',
        (SELECT COALESCE(sum(estimated_value),0) FROM public.leads, batas WHERE created_at > sejak)),
      jsonb_build_object('nama','Deal',      'jumlah',
        (SELECT count(*) FROM public.partner_deals, batas WHERE created_at > sejak), 'nilai',
        (SELECT COALESCE(sum(value),0) FROM public.partner_deals, batas WHERE created_at > sejak)),
      jsonb_build_object('nama','Penawaran', 'jumlah',
        (SELECT count(*) FROM public.quotations, batas WHERE created_at > sejak), 'nilai',
        (SELECT COALESCE(sum(total),0) FROM public.quotations, batas WHERE created_at > sejak)),
      jsonb_build_object('nama','Invoice',   'jumlah',
        (SELECT count(*) FROM public.invoices, batas WHERE created_at > sejak), 'nilai',
        (SELECT COALESCE(sum(total_amount),0) FROM public.invoices, batas WHERE created_at > sejak))
    ),

    -- Tingkat menang dihitung dari penawaran yang SUDAH dijawab saja.
    -- Memasukkan yang masih menunggu akan menekan angka secara palsu dan
    -- membuat tim terlihat buruk padahal keputusannya belum keluar.
    'penawaran', jsonb_build_object(
      'terkirim',  (SELECT count(*) FROM public.quotations WHERE status = 'Terkirim'),
      'diterima',  (SELECT count(*) FROM public.quotations WHERE status = 'Diterima'),
      'ditolak',   (SELECT count(*) FROM public.quotations WHERE status = 'Ditolak'),
      'nilai_menunggu', (SELECT COALESCE(sum(total),0) FROM public.quotations WHERE status = 'Terkirim'),
      'tingkat_menang', (SELECT CASE WHEN count(*) FILTER (WHERE status IN ('Diterima','Ditolak')) = 0
                                     THEN NULL
                                     ELSE round(100.0 * count(*) FILTER (WHERE status='Diterima')
                                          / count(*) FILTER (WHERE status IN ('Diterima','Ditolak')), 1) END
                           FROM public.quotations)
    ),

    -- Lama siklus: dari penawaran dibuat sampai dijawab.
    'siklus_hari_median', (SELECT round(percentile_cont(0.5) WITHIN GROUP (
                              ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))/86400)::numeric, 1)
                             FROM public.quotations WHERE status IN ('Diterima','Ditolak')),

    'sumber_prospek', COALESCE((
      SELECT jsonb_agg(s ORDER BY (s->>'jumlah')::int DESC)
        FROM (SELECT jsonb_build_object('sumber', COALESCE(source,'(tak tercatat)'),
                       'jumlah', count(*), 'nilai', COALESCE(sum(estimated_value),0)) s
                FROM public.leads, batas WHERE created_at > sejak
               GROUP BY source LIMIT 12) y), '[]'::jsonb),

    'rentang_hari', p_hari
  );
$$;

GRANT EXECUTE ON FUNCTION public.ops_kendali(integer)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sales_corong(integer) TO anon, authenticated, service_role;
