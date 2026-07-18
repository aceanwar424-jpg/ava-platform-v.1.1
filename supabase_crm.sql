-- ══════════════════════════════════════════════════════════════
-- OneLab — CRM PIPELINE & PENDAPATAN
-- ──────────────────────────────────────────────────────────────
--   Menyambungkan corong penjualan dengan uang yang benar-benar masuk.
--
-- MASALAH YANG DIPECAHKAN (hasil audit fungsional):
--   CRM sudah punya leads, partner, deal, MOU, surat, voucher, dan OKR,
--   tetapi tidak ada satu pun tampilan yang bisa menjawab pertanyaan
--   paling mendasar: "dari sekian banyak leads, berapa yang berubah
--   menjadi uang?" Angka yang tersedia selama ini hanyalah
--   leads.estimated_value — perkiraan yang diketik sendiri oleh sales.
--
--   Berkas ini menambahkan rantai penelusuran:
--       leads → partners → invoices        (pendapatan tertagih)
--       leads → partners → corporates → admissions  (kunjungan pasien)
--   sehingga PERKIRAAN dan KENYATAAN dapat dibedakan dengan tegas.
--
-- KONDISI AWAL (hasil pembacaan kode, bukan asumsi):
--   Sudah ada : leads (status = tahapan penjualan, converted_to = id partner),
--               partners, partner_deals, invoices (partner_id, status,
--               invoice_date, total_amount), okr_targets (period/assigned_name/
--               target/actual), corporates (partner_id → partners),
--               admissions (corporate_id → corporates, visit_date, net_amount).
--   PENTING   : admissions TIDAK memiliki kolom partner_id. Kaitan pasien
--               rujukan korporat ke partner ditempuh lewat corporates.
--   Belum ada : tahapan pipeline sebagai data, riwayat perpindahan tahap,
--               dan seluruh fungsi agregasi corong/konversi/LTV.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- 1. TAHAPAN PIPELINE — disimpan sebagai data, bukan dipatri di kode
-- ══════════════════════════════════════════════════════════════
-- Tim penjualan mengubah cara kerjanya jauh lebih sering daripada tim
-- pengembang merilis kode. Karena itu tahapan disimpan di tabel: nama,
-- urutan, warna, peluang menang, dan ambang menganggur semuanya dapat
-- disunting dari layar tanpa menyentuh kode.
--
-- Nilai stage_key sengaja dibuat SAMA PERSIS dengan LEAD_STATUSES di
-- modules/leads.js supaya seluruh data leads yang sudah ada langsung
-- terpetakan tanpa migrasi apa pun.
CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.crm_pipeline_stages
  ADD COLUMN IF NOT EXISTS stage_key    text,
  ADD COLUMN IF NOT EXISTS stage_name   text,
  ADD COLUMN IF NOT EXISTS sort_order   integer default 0,
  ADD COLUMN IF NOT EXISTS color        text default '#94A3B8',
  ADD COLUMN IF NOT EXISTS probability  numeric default 0,   -- peluang menang (%) untuk pipeline tertimbang
  ADD COLUMN IF NOT EXISTS idle_days    integer default 14,  -- ambang deal menganggur, per tahap
  ADD COLUMN IF NOT EXISTS is_won       boolean default false,
  ADD COLUMN IF NOT EXISTS is_lost      boolean default false,
  ADD COLUMN IF NOT EXISTS is_active    boolean default true,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.crm_pipeline_stages ADD CONSTRAINT uq_crm_stage_key UNIQUE (stage_key);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Tahapan bawaan. Peluang menang naik bertahap — dipakai untuk menghitung
-- "pipeline tertimbang", yaitu perkiraan yang sudah dikalikan peluang,
-- bukan penjumlahan mentah yang selalu terlihat terlalu optimistis.
INSERT INTO public.crm_pipeline_stages
  (stage_key, stage_name, sort_order, color, probability, idle_days, is_won, is_lost)
SELECT v.k, v.n, v.o, v.c, v.p, v.d, v.w, v.l FROM (VALUES
  ('Baru',       'Baru',        1, '#94A3B8',   5,  7, false, false),
  ('Dihubungi',  'Dihubungi',   2, '#0EA5E9',  15,  7, false, false),
  ('Qualified',  'Qualified',   3, '#8B5CF6',  30, 10, false, false),
  ('Presentasi', 'Presentasi',  4, '#F59E0B',  45, 14, false, false),
  ('Proposal',   'Proposal',    5, '#F97316',  60, 14, false, false),
  ('Negosiasi',  'Negosiasi',   6, '#06B6D4',  80, 10, false, false),
  ('Won',        'Menang',      7, '#22C55E', 100,999, true,  false),
  ('Lost',       'Kalah',       8, '#EF4444',   0, 999, false, true )
) AS v(k,n,o,c,p,d,w,l)
WHERE NOT EXISTS (SELECT 1 FROM public.crm_pipeline_stages s WHERE s.stage_key = v.k);


-- ══════════════════════════════════════════════════════════════
-- 2. RIWAYAT PERPINDAHAN TAHAP
-- ══════════════════════════════════════════════════════════════
-- Tanpa riwayat, dua pertanyaan penting mustahil dijawab: berapa lama
-- sebuah prospek tertahan di satu tahap, dan berapa persen yang lolos
-- dari tahap ke tahap. Kolom updated_at pada leads tidak cukup karena
-- ikut berubah oleh penyuntingan apa pun.
CREATE TABLE IF NOT EXISTS public.crm_stage_history (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.crm_stage_history
  ADD COLUMN IF NOT EXISTS entity_type     text default 'lead',  -- lead | deal
  ADD COLUMN IF NOT EXISTS entity_id       bigint,
  ADD COLUMN IF NOT EXISTS stage_from      text,
  ADD COLUMN IF NOT EXISTS stage_to        text,
  ADD COLUMN IF NOT EXISTS changed_at      timestamp default now(),
  ADD COLUMN IF NOT EXISTS changed_by_name text,
  ADD COLUMN IF NOT EXISTS notes           text;

CREATE INDEX IF NOT EXISTS idx_crm_hist_entity ON public.crm_stage_history(entity_type, entity_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_crm_hist_stage  ON public.crm_stage_history(stage_to);


-- ══════════════════════════════════════════════════════════════
-- 3. KOLOM PENYAMBUNG PADA TABEL YANG SUDAH ADA
-- ══════════════════════════════════════════════════════════════
-- Sengaja seminimal mungkin. leads.converted_to SUDAH menyimpan id partner
-- hasil konversi (lihat convertLeadToPartner di modules/leads.js), jadi
-- TIDAK dibuat kolom partner_id tandingan yang berisiko berbeda isi.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamp;   -- diisi otomatis oleh pemicu di bawah

-- Agar output kerjasama dapat dirunut balik ke prospek asalnya.
ALTER TABLE public.partner_deals
  ADD COLUMN IF NOT EXISTS lead_id bigint;

CREATE INDEX IF NOT EXISTS idx_leads_converted   ON public.leads(converted_to);
CREATE INDEX IF NOT EXISTS idx_leads_stage       ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_deals_lead        ON public.partner_deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_partner  ON public.invoices(partner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tanggal  ON public.invoices(invoice_date);


-- ══════════════════════════════════════════════════════════════
-- 4. PEMICU PENCATAT PERPINDAHAN TAHAP
-- ══════════════════════════════════════════════════════════════
-- Diletakkan di basis data, bukan di kode layar, supaya perpindahan tahap
-- tetap tercatat dari mana pun asalnya: papan kanban modul ini, tombol
-- status di modules/leads.js, maupun impor massal.
CREATE OR REPLACE FUNCTION public.crm_catat_tahap_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage_changed_at := now();
    INSERT INTO crm_stage_history (entity_type, entity_id, stage_from, stage_to, changed_at, changed_by_name)
    VALUES ('lead', NEW.id, NULL, NEW.status, now(), coalesce(NEW.created_by_name, 'sistem'));

  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.stage_changed_at := now();
    INSERT INTO crm_stage_history (entity_type, entity_id, stage_from, stage_to, changed_at, changed_by_name)
    VALUES ('lead', NEW.id, OLD.status, NEW.status, now(),
            coalesce(NEW.assigned_name, NEW.created_by_name, 'sistem'));
  END IF;
  RETURN NEW;
END $$;

-- Pemicu INSERT terpisah dari UPDATE karena baris baru belum punya id pada
-- BEFORE INSERT. Untuk itu pencatatan riwayat saat penambahan dijalankan
-- setelah baris tersimpan.
CREATE OR REPLACE FUNCTION public.crm_catat_tahap_lead_baru()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO crm_stage_history (entity_type, entity_id, stage_from, stage_to, changed_at, changed_by_name)
  VALUES ('lead', NEW.id, NULL, NEW.status, now(), coalesce(NEW.created_by_name, 'sistem'));
  RETURN NULL;
END $$;

-- Versi BEFORE hanya mengurus stage_changed_at + riwayat perubahan.
CREATE OR REPLACE FUNCTION public.crm_catat_tahap_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.stage_changed_at := now();
    INSERT INTO crm_stage_history (entity_type, entity_id, stage_from, stage_to, changed_at, changed_by_name)
    VALUES ('lead', NEW.id, OLD.status, NEW.status, now(),
            coalesce(NEW.assigned_name, NEW.created_by_name, 'sistem'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_crm_tahap_lead      ON public.leads;
CREATE TRIGGER trg_crm_tahap_lead
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_catat_tahap_lead();

DROP TRIGGER IF EXISTS trg_crm_tahap_lead_baru ON public.leads;
CREATE TRIGGER trg_crm_tahap_lead_baru
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_catat_tahap_lead_baru();

-- Isi awal riwayat untuk leads yang sudah terlanjur ada, agar analisis
-- konversi tidak dimulai dari nol. Tanggal masuk tahap diperkirakan dari
-- created_at — perkiraan yang jujur dan diberi keterangan.
INSERT INTO public.crm_stage_history (entity_type, entity_id, stage_from, stage_to, changed_at, changed_by_name, notes)
SELECT 'lead', l.id, NULL, coalesce(l.status,'Baru'), coalesce(l.created_at, now()),
       coalesce(l.created_by_name,'sistem'), 'Isi awal saat pemasangan modul CRM'
FROM public.leads l
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_stage_history h
  WHERE h.entity_type='lead' AND h.entity_id = l.id
);

UPDATE public.leads
   SET stage_changed_at = coalesce(updated_at, created_at, now())
 WHERE stage_changed_at IS NULL;


-- ══════════════════════════════════════════════════════════════
-- 5. RINGKASAN CORONG — perkiraan versus kenyataan
-- ══════════════════════════════════════════════════════════════
-- Aturan pendapatan yang dipakai di SELURUH berkas ini:
--   TERBIT = invoices berstatus Dikirim / Dibayar / Overdue
--            (sudah menjadi tagihan sah, Draft dan Dibatalkan tidak dihitung)
--   LUNAS  = invoices berstatus Dibayar
-- estimated_value pada leads TIDAK PERNAH dicampur ke dalam keduanya.
CREATE OR REPLACE FUNCTION public.crm_funnel_summary(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
)
RETURNS TABLE(
  jumlah_leads          bigint,
  leads_aktif           bigint,
  leads_won             bigint,
  leads_lost            bigint,
  partner_terhubung     bigint,
  partner_aktif         bigint,
  deal_aktif            bigint,
  perkiraan_pipeline    numeric,   -- estimated_value leads yang masih berjalan
  perkiraan_tertimbang  numeric,   -- estimated_value dikalikan peluang tiap tahap
  nilai_deal_aktif      numeric,
  pendapatan_terbit     numeric,   -- KENYATAAN: invoices sah
  pendapatan_lunas      numeric,   -- KENYATAAN: invoices dibayar
  jumlah_invoice        bigint,
  jumlah_kunjungan      bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH ld AS (
    SELECT l.id, l.status, coalesce(l.estimated_value,0) AS est, l.converted_to
    FROM leads l
    WHERE (p_from IS NULL OR l.created_at::date >= p_from)
      AND (p_to   IS NULL OR l.created_at::date <= p_to)
  ),
  st AS (SELECT stage_key, probability, is_won, is_lost FROM crm_pipeline_stages),
  pid AS (SELECT DISTINCT converted_to AS partner_id FROM ld WHERE converted_to IS NOT NULL),
  inv AS (
    SELECT i.partner_id, i.total_amount, i.status
    FROM invoices i
    WHERE (p_from IS NULL OR i.invoice_date >= p_from)
      AND (p_to   IS NULL OR i.invoice_date <= p_to)
  ),
  kunj AS (
    SELECT count(*)::bigint AS n
    FROM admissions a
    JOIN corporates c ON c.id = a.corporate_id
    WHERE c.partner_id IS NOT NULL
      AND (p_from IS NULL OR a.visit_date >= p_from)
      AND (p_to   IS NULL OR a.visit_date <= p_to)
  )
  SELECT
    (SELECT count(*) FROM ld)::bigint,
    (SELECT count(*) FROM ld JOIN st ON st.stage_key = ld.status
      WHERE NOT st.is_won AND NOT st.is_lost)::bigint,
    (SELECT count(*) FROM ld JOIN st ON st.stage_key = ld.status WHERE st.is_won)::bigint,
    (SELECT count(*) FROM ld JOIN st ON st.stage_key = ld.status WHERE st.is_lost)::bigint,
    (SELECT count(*) FROM pid)::bigint,
    (SELECT count(*) FROM partners p WHERE p.status = 'Aktif')::bigint,
    (SELECT count(*) FROM partner_deals d WHERE d.status = 'Active')::bigint,
    coalesce((SELECT sum(ld.est) FROM ld JOIN st ON st.stage_key = ld.status
              WHERE NOT st.is_won AND NOT st.is_lost),0)::numeric,
    coalesce((SELECT sum(ld.est * st.probability / 100.0) FROM ld JOIN st ON st.stage_key = ld.status
              WHERE NOT st.is_won AND NOT st.is_lost),0)::numeric,
    coalesce((SELECT sum(d.value) FROM partner_deals d WHERE d.status='Active'),0)::numeric,
    coalesce((SELECT sum(inv.total_amount) FROM inv
              WHERE inv.status IN ('Dikirim','Dibayar','Overdue')),0)::numeric,
    coalesce((SELECT sum(inv.total_amount) FROM inv WHERE inv.status = 'Dibayar'),0)::numeric,
    (SELECT count(*) FROM inv WHERE inv.status IN ('Dikirim','Dibayar','Overdue'))::bigint,
    (SELECT n FROM kunj)::bigint;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 6. KONVERSI ANTAR TAHAP DAN LAMA MENGENDAP
-- ══════════════════════════════════════════════════════════════
-- "Jumlah masuk" dihitung dari prospek unik yang pernah menyentuh tahap
-- tersebut, bukan dari isi papan hari ini — prospek yang sudah melaju
-- tetap harus ikut terhitung, jika tidak, angka konversi akan menipu.
CREATE OR REPLACE FUNCTION public.crm_stage_conversion(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
)
RETURNS TABLE(
  stage_key     text,
  stage_name    text,
  urutan        integer,
  warna         text,
  jumlah_masuk  bigint,
  jumlah_lanjut bigint,
  konversi_pct  numeric,
  rata_hari     numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH h AS (
    SELECT sh.entity_id,
           sh.stage_to,
           sh.changed_at,
           lead(sh.changed_at) OVER (PARTITION BY sh.entity_id ORDER BY sh.changed_at) AS lanjut_at
    FROM crm_stage_history sh
    WHERE sh.entity_type = 'lead'
      AND (p_from IS NULL OR sh.changed_at::date >= p_from)
      AND (p_to   IS NULL OR sh.changed_at::date <= p_to)
  )
  SELECT s.stage_key,
         s.stage_name,
         s.sort_order,
         s.color,
         count(DISTINCT h.entity_id)::bigint,
         count(DISTINCT h.entity_id) FILTER (WHERE h.lanjut_at IS NOT NULL)::bigint,
         CASE WHEN count(DISTINCT h.entity_id) > 0
              THEN round(count(DISTINCT h.entity_id) FILTER (WHERE h.lanjut_at IS NOT NULL)::numeric
                         / count(DISTINCT h.entity_id)::numeric * 100, 1)
              ELSE 0 END,
         coalesce(round(avg(extract(epoch FROM (h.lanjut_at - h.changed_at)) / 86400.0)
                        FILTER (WHERE h.lanjut_at IS NOT NULL)::numeric, 1), 0)
  FROM crm_pipeline_stages s
  LEFT JOIN h ON h.stage_to = s.stage_key
  WHERE s.is_active
  GROUP BY s.stage_key, s.stage_name, s.sort_order, s.color
  ORDER BY s.sort_order;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 7. MUTU SUMBER LEADS — banyak belum tentu menghasilkan
-- ══════════════════════════════════════════════════════════════
-- Inti nilai modul ini. Sumber yang melahirkan paling banyak prospek sering
-- kali BUKAN sumber yang melahirkan paling banyak uang. Fungsi ini memisahkan
-- keduanya secara tegas: jumlah_leads di satu sisi, pendapatan_lunas di sisi
-- lain, plus pendapatan rata-rata per lead sebagai penengah.
--
-- Pendapatan dijumlahkan atas partner UNIK per sumber. Bila dua prospek dari
-- sumber yang sama berujung pada satu partner, pendapatannya dihitung sekali.
CREATE OR REPLACE FUNCTION public.crm_source_performance(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
)
RETURNS TABLE(
  sumber              text,
  jumlah_leads        bigint,
  jumlah_won          bigint,
  konversi_pct        numeric,
  perkiraan_nilai     numeric,
  partner_jadi        bigint,
  pendapatan_terbit   numeric,
  pendapatan_lunas    numeric,
  pendapatan_per_lead numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH ld AS (
    SELECT coalesce(nullif(trim(l.source),''), '(tanpa sumber)') AS src,
           l.id, l.status, coalesce(l.estimated_value,0) AS est, l.converted_to
    FROM leads l
    WHERE (p_from IS NULL OR l.created_at::date >= p_from)
      AND (p_to   IS NULL OR l.created_at::date <= p_to)
  ),
  rev AS (
    SELECT i.partner_id,
           sum(i.total_amount) FILTER (WHERE i.status IN ('Dikirim','Dibayar','Overdue')) AS terbit,
           sum(i.total_amount) FILTER (WHERE i.status = 'Dibayar')                        AS lunas
    FROM invoices i
    WHERE i.partner_id IS NOT NULL
    GROUP BY i.partner_id
  ),
  src_partner AS (
    SELECT DISTINCT ld.src, ld.converted_to AS partner_id
    FROM ld WHERE ld.converted_to IS NOT NULL
  ),
  src_rev AS (
    SELECT sp.src,
           count(*)::bigint                     AS partner_jadi,
           coalesce(sum(r.terbit),0)::numeric    AS terbit,
           coalesce(sum(r.lunas),0)::numeric     AS lunas
    FROM src_partner sp
    LEFT JOIN rev r ON r.partner_id = sp.partner_id
    GROUP BY sp.src
  ),
  agg AS (
    SELECT ld.src,
           count(*)::bigint AS n_leads,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM crm_pipeline_stages s WHERE s.stage_key = ld.status AND s.is_won
           ))::bigint AS n_won,
           sum(ld.est)::numeric AS est
    FROM ld GROUP BY ld.src
  )
  SELECT a.src,
         a.n_leads,
         a.n_won,
         CASE WHEN a.n_leads > 0 THEN round(a.n_won::numeric / a.n_leads::numeric * 100, 1) ELSE 0 END,
         coalesce(a.est,0),
         coalesce(sr.partner_jadi,0),
         coalesce(sr.terbit,0),
         coalesce(sr.lunas,0),
         CASE WHEN a.n_leads > 0 THEN round(coalesce(sr.lunas,0) / a.n_leads::numeric, 0) ELSE 0 END
  FROM agg a
  LEFT JOIN src_rev sr ON sr.src = a.src
  ORDER BY coalesce(sr.lunas,0) DESC, a.n_leads DESC;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 8. NILAI UMUR PELANGGAN (LIFETIME VALUE) PER PARTNER
-- ══════════════════════════════════════════════════════════════
-- Menggabungkan dua aliran nilai yang berbeda sifatnya dan karena itu
-- TIDAK dijumlahkan menjadi satu angka:
--   a. tagihan korporat  → invoices.partner_id
--   b. kunjungan pasien  → admissions → corporates → partners
-- Menjumlahkan keduanya berisiko menghitung ganda bila satu paket MCU
-- ditagihkan sekaligus lewat invoice.
CREATE OR REPLACE FUNCTION public.crm_partner_ltv(
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  partner_id        bigint,
  partner_name      text,
  kategori          text,
  sales             text,
  status            text,
  jumlah_invoice    bigint,
  pendapatan_terbit numeric,
  pendapatan_lunas  numeric,
  invoice_pertama   date,
  invoice_terakhir  date,
  bulan_aktif       integer,
  rata_per_bulan    numeric,
  jumlah_kunjungan  bigint,
  nilai_kunjungan   numeric,
  deal_aktif        bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH inv AS (
    SELECT i.partner_id,
           count(*) FILTER (WHERE i.status IN ('Dikirim','Dibayar','Overdue'))::bigint AS n,
           coalesce(sum(i.total_amount) FILTER (WHERE i.status IN ('Dikirim','Dibayar','Overdue')),0)::numeric AS terbit,
           coalesce(sum(i.total_amount) FILTER (WHERE i.status = 'Dibayar'),0)::numeric AS lunas,
           min(i.invoice_date) FILTER (WHERE i.status IN ('Dikirim','Dibayar','Overdue')) AS pertama,
           max(i.invoice_date) FILTER (WHERE i.status IN ('Dikirim','Dibayar','Overdue')) AS terakhir
    FROM invoices i
    WHERE i.partner_id IS NOT NULL
    GROUP BY i.partner_id
  ),
  kunj AS (
    SELECT c.partner_id,
           count(*)::bigint AS n,
           coalesce(sum(coalesce(a.net_amount, a.total_amount, 0)),0)::numeric AS nilai
    FROM admissions a
    JOIN corporates c ON c.id = a.corporate_id
    WHERE c.partner_id IS NOT NULL
    GROUP BY c.partner_id
  ),
  dl AS (
    SELECT d.partner_id, count(*)::bigint AS n
    FROM partner_deals d WHERE d.status = 'Active' GROUP BY d.partner_id
  )
  SELECT p.id,
         p.partner_name,
         p.category,
         coalesce(p.assigned_name, p.created_by_name),
         p.status,
         coalesce(inv.n, 0),
         coalesce(inv.terbit, 0),
         coalesce(inv.lunas, 0),
         inv.pertama,
         inv.terakhir,
         CASE WHEN inv.pertama IS NULL THEN 0
              ELSE greatest(1, (date_part('year',  age(inv.terakhir, inv.pertama)) * 12
                              + date_part('month', age(inv.terakhir, inv.pertama)) + 1)::integer)
         END,
         CASE WHEN inv.pertama IS NULL THEN 0
              ELSE round(coalesce(inv.lunas,0) /
                   greatest(1, (date_part('year',  age(inv.terakhir, inv.pertama)) * 12
                              + date_part('month', age(inv.terakhir, inv.pertama)) + 1))::numeric, 0)
         END,
         coalesce(kunj.n, 0),
         coalesce(kunj.nilai, 0),
         coalesce(dl.n, 0)
  FROM partners p
  LEFT JOIN inv  ON inv.partner_id  = p.id
  LEFT JOIN kunj ON kunj.partner_id = p.id
  LEFT JOIN dl   ON dl.partner_id   = p.id
  WHERE coalesce(inv.terbit,0) > 0 OR coalesce(kunj.n,0) > 0 OR coalesce(dl.n,0) > 0
  ORDER BY coalesce(inv.lunas,0) DESC, coalesce(inv.terbit,0) DESC
  LIMIT greatest(1, coalesce(p_limit, 100));
END $$;


-- ── Tren bulanan satu partner ────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_partner_monthly(
  p_partner_id bigint,
  p_bulan      integer DEFAULT 12
)
RETURNS TABLE(
  bulan             text,
  pendapatan_terbit numeric,
  pendapatan_lunas  numeric,
  jumlah_invoice    bigint,
  jumlah_kunjungan  bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mulai date := date_trunc('month', now())::date
                        - ((greatest(1, coalesce(p_bulan,12)) - 1) || ' months')::interval;
BEGIN
  RETURN QUERY
  WITH bulan_list AS (
    SELECT to_char(gs, 'YYYY-MM') AS b, gs::date AS awal
    FROM generate_series(v_mulai, date_trunc('month', now())::date, interval '1 month') gs
  ),
  inv AS (
    SELECT to_char(i.invoice_date, 'YYYY-MM') AS b,
           coalesce(sum(i.total_amount) FILTER (WHERE i.status IN ('Dikirim','Dibayar','Overdue')),0)::numeric AS terbit,
           coalesce(sum(i.total_amount) FILTER (WHERE i.status = 'Dibayar'),0)::numeric AS lunas,
           count(*) FILTER (WHERE i.status IN ('Dikirim','Dibayar','Overdue'))::bigint AS n
    FROM invoices i
    WHERE i.partner_id = p_partner_id AND i.invoice_date >= v_mulai
    GROUP BY 1
  ),
  kunj AS (
    SELECT to_char(a.visit_date, 'YYYY-MM') AS b, count(*)::bigint AS n
    FROM admissions a
    JOIN corporates c ON c.id = a.corporate_id
    WHERE c.partner_id = p_partner_id AND a.visit_date >= v_mulai
    GROUP BY 1
  )
  SELECT bl.b,
         coalesce(inv.terbit, 0),
         coalesce(inv.lunas, 0),
         coalesce(inv.n, 0),
         coalesce(kunj.n, 0)
  FROM bulan_list bl
  LEFT JOIN inv  ON inv.b  = bl.b
  LEFT JOIN kunj ON kunj.b = bl.b
  ORDER BY bl.b;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 9. DEAL MENGANGGUR
-- ══════════════════════════════════════════════════════════════
-- Ambang diambil dari kolom idle_days milik tahap yang sedang ditempati,
-- sehingga tahap cepat seperti "Baru" boleh diberi ambang pendek sementara
-- "Negosiasi" diberi kelonggaran lebih. Parameter p_min_hari dipakai untuk
-- menyaring lebih ketat dari layar tanpa mengubah pengaturan tahap.
CREATE OR REPLACE FUNCTION public.crm_idle_deals(
  p_min_hari integer DEFAULT NULL
)
RETURNS TABLE(
  lead_id         bigint,
  nama            text,
  perusahaan      text,
  stage_key       text,
  stage_name      text,
  warna           text,
  hari_diam       integer,
  ambang          integer,
  kelebihan       integer,
  assigned_name   text,
  estimated_value numeric,
  followup_date   date,
  partner_id      bigint,
  phone           text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT l.id,
         coalesce(l.lead_name, l.company, '(tanpa nama)'),
         l.company,
         s.stage_key,
         s.stage_name,
         s.color,
         (now()::date - coalesce(l.stage_changed_at, l.updated_at, l.created_at)::date)::integer,
         s.idle_days,
         ((now()::date - coalesce(l.stage_changed_at, l.updated_at, l.created_at)::date)
           - s.idle_days)::integer,
         l.assigned_name,
         coalesce(l.estimated_value, 0),
         l.followup_date,
         l.converted_to,
         l.phone
  FROM leads l
  JOIN crm_pipeline_stages s ON s.stage_key = l.status
  WHERE NOT s.is_won AND NOT s.is_lost AND s.is_active
    AND (now()::date - coalesce(l.stage_changed_at, l.updated_at, l.created_at)::date)
        >= coalesce(p_min_hari, s.idle_days)
  ORDER BY 7 DESC;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 10. PENCAPAIAN TARGET — OKR dibandingkan pendapatan nyata
-- ══════════════════════════════════════════════════════════════
-- Selama ini kolom okr_targets.actual diisi tangan, sehingga pencapaian
-- bergantung pada kerajinan mengisi. Fungsi ini menghitung ulang realisasi
-- dari invoices untuk metrik bernuansa uang, dan tetap menampilkan angka
-- isian tangan berdampingan supaya selisihnya terlihat, bukan tersembunyi.
--
-- Pendapatan diatribusikan ke pemilik hubungan (partners.assigned_name),
-- dengan cadangan pembuat invoice bila partner belum punya penanggung jawab.
CREATE OR REPLACE FUNCTION public.crm_target_achievement(
  p_period text DEFAULT NULL
)
RETURNS TABLE(
  okr_id             bigint,
  periode            text,
  assigned_name      text,
  objective          text,
  metric_type        text,
  satuan             text,
  target             numeric,
  actual_manual      numeric,
  metrik_uang        boolean,
  pendapatan_terbit  numeric,
  pendapatan_lunas   numeric,
  pencapaian_pct     numeric,
  tanggal_mulai      date,
  tanggal_akhir      date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mulai date; v_akhir date; v_thn integer; v_kuartal integer;
BEGIN
  -- Format periode mengikuti modules/leads.js: '2026-Q3' atau '2026'.
  IF p_period ~ '^\d{4}-Q[1-4]$' THEN
    v_thn     := left(p_period, 4)::integer;
    v_kuartal := right(p_period, 1)::integer;
    v_mulai   := make_date(v_thn, (v_kuartal - 1) * 3 + 1, 1);
    v_akhir   := (v_mulai + interval '3 months' - interval '1 day')::date;
  ELSIF p_period ~ '^\d{4}-\d{2}$' THEN
    v_mulai := to_date(p_period || '-01', 'YYYY-MM-DD');
    v_akhir := (v_mulai + interval '1 month' - interval '1 day')::date;
  ELSIF p_period ~ '^\d{4}$' THEN
    v_mulai := make_date(p_period::integer, 1, 1);
    v_akhir := make_date(p_period::integer, 12, 31);
  ELSE
    v_mulai := NULL; v_akhir := NULL;   -- seluruh waktu
  END IF;

  RETURN QUERY
  WITH rev AS (
    SELECT coalesce(nullif(trim(p.assigned_name),''),
                    nullif(trim(i.created_by_name),''), '(tanpa penanggung jawab)') AS nm,
           coalesce(sum(i.total_amount) FILTER (WHERE i.status IN ('Dikirim','Dibayar','Overdue')),0)::numeric AS terbit,
           coalesce(sum(i.total_amount) FILTER (WHERE i.status = 'Dibayar'),0)::numeric AS lunas
    FROM invoices i
    LEFT JOIN partners p ON p.id = i.partner_id
    WHERE (v_mulai IS NULL OR i.invoice_date >= v_mulai)
      AND (v_akhir IS NULL OR i.invoice_date <= v_akhir)
    GROUP BY 1
  )
  SELECT o.id,
         o.period,
         coalesce(nullif(trim(o.assigned_name),''), '(tanpa penanggung jawab)'),
         o.objective,
         o.metric_type,
         o.unit,
         coalesce(o.target, 0),
         coalesce(o.actual, 0),
         (o.metric_type ILIKE '%revenue%' OR o.metric_type ILIKE '%rp%'
          OR o.unit ILIKE '%rp%' OR o.metric_type ILIKE '%pendapatan%'),
         coalesce(r.terbit, 0),
         coalesce(r.lunas, 0),
         CASE
           WHEN coalesce(o.target,0) = 0 THEN 0
           WHEN (o.metric_type ILIKE '%revenue%' OR o.metric_type ILIKE '%rp%'
                 OR o.unit ILIKE '%rp%' OR o.metric_type ILIKE '%pendapatan%')
             THEN round(coalesce(r.lunas,0) / o.target * 100, 1)
           ELSE round(coalesce(o.actual,0) / o.target * 100, 1)
         END,
         v_mulai,
         v_akhir
  FROM okr_targets o
  LEFT JOIN rev r ON r.nm = coalesce(nullif(trim(o.assigned_name),''), '(tanpa penanggung jawab)')
  WHERE p_period IS NULL OR p_period = '' OR o.period = p_period
  ORDER BY 3, 5;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 11. PENELUSURAN SATU PROSPEK SAMPAI KE UANGNYA
-- ══════════════════════════════════════════════════════════════
-- Dipakai saat pengguna menekan satu kartu di papan pipeline: menampilkan
-- rantai lengkap prospek → partner → tagihan → kunjungan dalam sekali panggil.
CREATE OR REPLACE FUNCTION public.crm_lead_revenue(
  p_lead_id bigint
)
RETURNS TABLE(
  lead_id           bigint,
  nama              text,
  stage_key         text,
  perkiraan_nilai   numeric,
  partner_id        bigint,
  partner_name      text,
  jumlah_deal       bigint,
  nilai_deal        numeric,
  jumlah_invoice    bigint,
  pendapatan_terbit numeric,
  pendapatan_lunas  numeric,
  jumlah_kunjungan  bigint,
  umur_hari         integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT l.id,
         coalesce(l.lead_name, l.company, '(tanpa nama)'),
         l.status,
         coalesce(l.estimated_value, 0),
         l.converted_to,
         p.partner_name,
         (SELECT count(*) FROM partner_deals d WHERE d.partner_id = l.converted_to)::bigint,
         coalesce((SELECT sum(d.value) FROM partner_deals d WHERE d.partner_id = l.converted_to),0)::numeric,
         (SELECT count(*) FROM invoices i
           WHERE i.partner_id = l.converted_to
             AND i.status IN ('Dikirim','Dibayar','Overdue'))::bigint,
         coalesce((SELECT sum(i.total_amount) FROM invoices i
                    WHERE i.partner_id = l.converted_to
                      AND i.status IN ('Dikirim','Dibayar','Overdue')),0)::numeric,
         coalesce((SELECT sum(i.total_amount) FROM invoices i
                    WHERE i.partner_id = l.converted_to AND i.status = 'Dibayar'),0)::numeric,
         (SELECT count(*) FROM admissions a
            JOIN corporates c ON c.id = a.corporate_id
           WHERE c.partner_id = l.converted_to)::bigint,
         (now()::date - l.created_at::date)::integer
  FROM leads l
  LEFT JOIN partners p ON p.id = l.converted_to
  WHERE l.id = p_lead_id;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 12. KEAMANAN
-- ══════════════════════════════════════════════════════════════
-- Tabel CRM bukan data pasien, mengikuti pola modul non-pasien lain.
ALTER TABLE public.crm_pipeline_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stage_history   DISABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.crm_funnel_summary(date,date)      FROM public, anon;
REVOKE ALL ON FUNCTION public.crm_stage_conversion(date,date)    FROM public, anon;
REVOKE ALL ON FUNCTION public.crm_source_performance(date,date)  FROM public, anon;
REVOKE ALL ON FUNCTION public.crm_partner_ltv(integer)           FROM public, anon;
REVOKE ALL ON FUNCTION public.crm_partner_monthly(bigint,integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.crm_idle_deals(integer)            FROM public, anon;
REVOKE ALL ON FUNCTION public.crm_target_achievement(text)       FROM public, anon;
REVOKE ALL ON FUNCTION public.crm_lead_revenue(bigint)           FROM public, anon;

GRANT EXECUTE ON FUNCTION public.crm_funnel_summary(date,date)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_stage_conversion(date,date)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_source_performance(date,date)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_partner_ltv(integer)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_partner_monthly(bigint,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_idle_deals(integer)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_target_achievement(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_lead_revenue(bigint)           TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- VERIFIKASI
-- ══════════════════════════════════════════════════════════════
SELECT 'tahapan pipeline'   AS jenis, count(*)::text AS jumlah FROM public.crm_pipeline_stages
UNION ALL SELECT 'riwayat tahap',     count(*)::text FROM public.crm_stage_history
UNION ALL SELECT 'leads terpetakan',  count(*)::text FROM public.leads l
  JOIN public.crm_pipeline_stages s ON s.stage_key = l.status
UNION ALL SELECT 'leads TANPA tahap', count(*)::text FROM public.leads l
  WHERE NOT EXISTS (SELECT 1 FROM public.crm_pipeline_stages s WHERE s.stage_key = l.status)
UNION ALL SELECT 'leads jadi partner', count(*)::text FROM public.leads WHERE converted_to IS NOT NULL
UNION ALL SELECT 'fungsi CRM',        count(*)::text FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN
    ('crm_funnel_summary','crm_stage_conversion','crm_source_performance',
     'crm_partner_ltv','crm_partner_monthly','crm_idle_deals',
     'crm_target_achievement','crm_lead_revenue')
UNION ALL SELECT 'pemicu tahap',      count(*)::text FROM pg_trigger
  WHERE tgname IN ('trg_crm_tahap_lead','trg_crm_tahap_lead_baru');

-- Baris "leads TANPA tahap" HARUS 0. Bila tidak, ada nilai leads.status yang
-- belum terdaftar di crm_pipeline_stages — tambahkan tahapnya lewat layar
-- Pengaturan Tahapan, jika tidak prospek tersebut akan hilang dari papan.
