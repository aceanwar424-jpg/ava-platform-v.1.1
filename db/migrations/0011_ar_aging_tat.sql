-- 0011 — Piutang Menua (AR Aging) & Turnaround Time (TAT)
--
-- Dua celah terbesar yang muncul dari audit kematangan modul:
--   Finance 12%  → tidak ada satu pun layar umur piutang. Tagihan yang lewat
--                  jatuh tempo hanya terlihat satu per satu, tidak pernah
--                  sebagai gambaran utuh. Di klinik, kas bocor justru di sini.
--   Lab 80%      → terkuat, tapi TAT tidak pernah diukur. Padahal seluruh
--                  stempel waktunya SUDAH ada dan tidak dipakai.
--
-- Keduanya diagregasi di basis data, bukan di peramban: menarik ribuan baris
-- ke klien lalu menghitungnya di sana lambat dan boros, dan pada instalasi
-- klinik yang komputernya sederhana itu terasa.

-- ══════════════════════════════════════════════════════════════════
-- A. UMUR PIUTANG
-- Ember umur dihitung dari JATUH TEMPO, bukan tanggal terbit — yang
-- menentukan kas macet adalah seberapa lama tagihan lewat tempo.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ar_aging(p_tanggal date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH belum_lunas AS (
    SELECT i.id, i.invoice_number, i.partner_name, i.total_amount,
           i.invoice_date, i.due_date, i.status,
           GREATEST(0, p_tanggal - COALESCE(i.due_date, i.invoice_date))::int AS hari_lewat
      FROM public.invoices i
     WHERE COALESCE(i.status,'') NOT IN ('Dibayar','Dibatalkan')
       AND COALESCE(i.total_amount,0) > 0
  ),
  berember AS (
    SELECT *, CASE
        WHEN hari_lewat = 0             THEN 'belum_jatuh_tempo'
        WHEN hari_lewat BETWEEN 1 AND 30  THEN 'lewat_1_30'
        WHEN hari_lewat BETWEEN 31 AND 60 THEN 'lewat_31_60'
        WHEN hari_lewat BETWEEN 61 AND 90 THEN 'lewat_61_90'
        ELSE 'lewat_90_plus' END AS ember
      FROM belum_lunas
  )
  SELECT jsonb_build_object(
    'per_ember', COALESCE((
      SELECT jsonb_object_agg(ember, jsonb_build_object(
               'jumlah', n, 'nilai', nilai))
        FROM (SELECT ember, count(*) n, sum(total_amount) nilai
                FROM berember GROUP BY ember) x), '{}'::jsonb),

    -- Per pelanggan: siapa penunggak terbesar, dan seberapa tua utangnya.
    'per_partner', COALESCE((
      SELECT jsonb_agg(p ORDER BY (p->>'nilai')::numeric DESC)
        FROM (SELECT jsonb_build_object(
                  'partner', COALESCE(partner_name,'(tanpa nama)'),
                  'jumlah', count(*), 'nilai', sum(total_amount),
                  'terlama', max(hari_lewat),
                  'lewat_tempo', sum(total_amount) FILTER (WHERE hari_lewat > 0)) p
                FROM berember GROUP BY partner_name LIMIT 50) y), '[]'::jsonb),

    -- Daftar rinci untuk ditindaklanjuti, yang paling tua lebih dulu.
    'daftar', COALESCE((
      SELECT jsonb_agg(d ORDER BY (d->>'hari_lewat')::int DESC)
        FROM (SELECT jsonb_build_object(
                  'id', id, 'nomor', invoice_number, 'partner', partner_name,
                  'nilai', total_amount, 'jatuh_tempo', due_date,
                  'hari_lewat', hari_lewat, 'status', status, 'ember', ember) d
                FROM berember ORDER BY hari_lewat DESC LIMIT 200) z), '[]'::jsonb),

    'total_piutang', COALESCE((SELECT sum(total_amount) FROM berember), 0),
    'total_lewat_tempo', COALESCE((SELECT sum(total_amount) FROM berember WHERE hari_lewat > 0), 0),
    'per_tanggal', p_tanggal
  );
$$;

-- ══════════════════════════════════════════════════════════════════
-- B. TURNAROUND TIME
-- Rantai tahap: diambil → diterima → hasil dimasukkan → divalidasi →
-- disetujui. Seluruh stempel waktunya sudah ada sejak lama; yang belum
-- ada hanyalah yang membaca.
--
-- Memakai MEDIAN dan P90, bukan rata-rata: satu sampel yang tertahan
-- semalam menarik rata-rata sampai menyesatkan, sedangkan median
-- menggambarkan pengalaman yang biasa dan P90 menunjukkan ekor buruknya.
-- ══════════════════════════════════════════════════════════════════
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
     WHERE lr.created_at > now() - make_interval(days => p_hari)
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

    -- Sampel paling lambat: daftar tindak lanjut, bukan sekadar angka.
    'terlambat', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'menit')::numeric DESC)
        FROM (SELECT jsonb_build_object(
                 'barcode', barcode, 'pemeriksaan', product_name,
                 'jenis', sampel_type, 'menit', round(m_total::numeric,0)) x
                FROM r WHERE m_total IS NOT NULL ORDER BY m_total DESC LIMIT 20) t), '[]'::jsonb),

    -- Per jenis spesimen: menunjukkan di mana penyumbatan berulang.
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

GRANT EXECUTE ON FUNCTION public.ar_aging(date)     TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lab_tat(integer)   TO anon, authenticated, service_role;
