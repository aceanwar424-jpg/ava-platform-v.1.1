-- 0014 — Perbaikan zona waktu pada perbandingan waktu
--
-- BUG YANG DIPERBAIKI
-- Kolom waktu lama (lab_samples.received_at, lab_results.created_at, dsb)
-- bertipe `timestamp` TANPA zona waktu, dan berisi nilai UTC — karena klien
-- mengirim new Date().toISOString().
--
-- Sementara itu now() mengembalikan waktu LOKAL basis data, yang di sini
-- disetel Etc/GMT-7 (WIB). Membandingkan keduanya menggeser hasil sebesar
-- 7 jam: sampel yang tertahan 9 jam terbaca 16 jam.
--
-- Akibatnya bukan sekadar angka meleset. Pusat kendali akan menandai sampel
-- sebagai "tertahan" padahal belum, dan setiap klinik dengan zona waktu
-- selain UTC akan melihat angka yang dilebih-lebihkan sesuai offset-nya.
--
-- Perbaikannya: bandingkan pada bidang yang sama — now() diubah ke UTC
-- sebelum diadu dengan kolom naif yang memang berisi UTC.
--
-- Fungsi ditulis ulang UTUH (CREATE OR REPLACE), bukan menyunting 0013 yang
-- sudah terpasang di basis data mana pun.

CREATE OR REPLACE FUNCTION public.ops_kendali(p_ambang_jam integer DEFAULT 4)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH kini AS (SELECT (now() AT TIME ZONE 'UTC') AS t)   -- bidang yang sama dgn kolom naif
  SELECT jsonb_build_object(

    'sampel', jsonb_build_object(
      'belum_diterima', (SELECT count(*) FROM public.lab_samples
                          WHERE received_at IS NULL AND COALESCE(status,'') NOT IN ('Ditolak','Batal')),
      'diproses',       (SELECT count(*) FROM public.lab_samples s
                          WHERE s.received_at IS NOT NULL
                            AND NOT EXISTS (SELECT 1 FROM public.lab_results r
                                             WHERE r.visit_number = s.visit_number)),
      'tertahan',       (SELECT count(*) FROM public.lab_samples s, kini
                          WHERE s.received_at IS NOT NULL
                            AND s.received_at < kini.t - make_interval(hours => p_ambang_jam)
                            AND NOT EXISTS (SELECT 1 FROM public.lab_results r
                                             WHERE r.visit_number = s.visit_number)),
      'ditolak_hari_ini', (SELECT count(*) FROM public.lab_samples
                            WHERE COALESCE(status,'') = 'Ditolak'
                              AND created_at::date = CURRENT_DATE)
    ),

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

    'tertahan_terlama', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'jam')::numeric DESC)
        FROM (SELECT jsonb_build_object(
                 'barcode', s.barcode, 'pasien', s.patient_name,
                 'pemeriksaan', s.product_name,
                 'jam', round(EXTRACT(EPOCH FROM (kini.t - s.received_at))/3600, 1)) x
                FROM public.lab_samples s, kini
               WHERE s.received_at IS NOT NULL
                 AND s.received_at < kini.t - make_interval(hours => p_ambang_jam)
                 AND NOT EXISTS (SELECT 1 FROM public.lab_results r WHERE r.visit_number = s.visit_number)
               ORDER BY s.received_at LIMIT 15) t2), '[]'::jsonb),

    'ambang_jam', p_ambang_jam,
    'diambil_pada', now()
  ) FROM kini;
$$;

-- Penyaring rentang di lab_tat mengalami pergeseran yang sama: lr.created_at
-- naif diadu dengan now() bertimezone, sehingga batas rentangnya meleset
-- sebesar offset zona waktu.
CREATE OR REPLACE FUNCTION public.lab_tat(p_hari integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH r AS (
    SELECT lr.id, lr.visit_number, lr.product_name,
           s.barcode, s.sampel_type, s.collected_at, s.received_at,
           lr.entered_at, lr.validated_at, lr.approved_at,
           EXTRACT(EPOCH FROM (s.received_at  - s.collected_at))/60 AS m_ambil_terima,
           EXTRACT(EPOCH FROM (lr.entered_at  - s.received_at))/60  AS m_terima_hasil,
           EXTRACT(EPOCH FROM (lr.validated_at- lr.entered_at))/60  AS m_hasil_validasi,
           EXTRACT(EPOCH FROM (lr.approved_at - lr.validated_at))/60 AS m_validasi_setuju,
           EXTRACT(EPOCH FROM (lr.approved_at - s.collected_at))/60  AS m_total
      FROM public.lab_results lr
      LEFT JOIN public.lab_samples s ON s.visit_number = lr.visit_number
     WHERE lr.created_at > (now() AT TIME ZONE 'UTC') - make_interval(days => p_hari)
  ),
  stat AS (
    SELECT
      count(*) FILTER (WHERE m_total IS NOT NULL) AS n_tuntas,
      count(*) AS n_total,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY m_ambil_terima)    AS med_ambil_terima,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY m_terima_hasil)    AS med_terima_hasil,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY m_hasil_validasi)  AS med_hasil_validasi,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY m_validasi_setuju) AS med_validasi_setuju,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY m_total)           AS med_total,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY m_total)           AS p90_total
    FROM r
  )
  SELECT jsonb_build_object(
    'tahap', jsonb_build_array(
      jsonb_build_object('nama','Diambil → Diterima',    'median', round(med_ambil_terima::numeric,1)),
      jsonb_build_object('nama','Diterima → Hasil',      'median', round(med_terima_hasil::numeric,1)),
      jsonb_build_object('nama','Hasil → Validasi',      'median', round(med_hasil_validasi::numeric,1)),
      jsonb_build_object('nama','Validasi → Disetujui',  'median', round(med_validasi_setuju::numeric,1))
    ),
    'total_median', round(med_total::numeric,1),
    'total_p90',    round(p90_total::numeric,1),
    'n_tuntas',     n_tuntas,
    'n_total',      n_total,
    'terlambat', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'menit')::numeric DESC)
        FROM (SELECT jsonb_build_object(
                 'barcode', barcode, 'pemeriksaan', product_name,
                 'jenis', sampel_type, 'menit', round(m_total::numeric,0)) x
                FROM r WHERE m_total IS NOT NULL ORDER BY m_total DESC LIMIT 20) t), '[]'::jsonb),
    'per_jenis', COALESCE((
      SELECT jsonb_agg(y ORDER BY (y->>'median')::numeric DESC NULLS LAST)
        FROM (SELECT jsonb_build_object(
                 'jenis', COALESCE(sampel_type,'(tak tercatat)'),
                 'jumlah', count(*),
                 'median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY m_total)::numeric,1)) y
                FROM r GROUP BY sampel_type LIMIT 20) u), '[]'::jsonb),
    'rentang_hari', p_hari
  ) FROM stat;
$$;
