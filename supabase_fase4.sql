-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 4 : Akuntansi (SAP FI/CO)
-- ──────────────────────────────────────────────────────────────
--   4.1  Bagan akun, jurnal, buku besar, periode
--   4.2  Posting otomatis dari kasir, faktur, dan inventory
--   4.3  Hutang usaha
--   4.4  Pusat biaya → laba rugi per unit layanan
--
-- CARA MEMBUKA PEMBLOKIRAN
--   Dokumen fase sebelumnya menyatakan bagian ini menunggu akuntan. Itu terlalu
--   pasif. Berkas ini memasang BAGAN AKUN STANDAR klinik/laboratorium Indonesia
--   sebagai titik awal yang BISA DIUBAH — akuntan tinggal mengoreksi nama, nomor,
--   atau menambah akun, bukan menyusun dari nol.
--
--   Pemetaan transaksi ke akun juga disimpan sebagai DATA (tabel gl_mappings),
--   bukan dipatri di kode. Mengubah akun mana yang dipakai untuk pendapatan lab
--   cukup mengubah satu baris, tanpa menyentuh program.
--
-- YANG TETAP HARUS DIPUTUSKAN MANUSIA
--   · Apakah nomor & nama akun sesuai kebijakan akuntansi Anda
--   · Saldo awal tiap akun
--   · Kebijakan pengakuan pendapatan (kas atau akrual)
--   Jalankan paralel dengan pembukuan manual selama satu periode penuh sebelum
--   angkanya diandalkan.
--
-- PRASYARAT: supabase_fase1_rpc.sql
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 4.4  PUSAT BIAYA
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.cost_centers
  ADD COLUMN IF NOT EXISTS code       text,
  ADD COLUMN IF NOT EXISTS name       text,
  ADD COLUMN IF NOT EXISTS unit_type  text,   -- Pendapatan | Pendukung
  ADD COLUMN IF NOT EXISTS is_active  boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

INSERT INTO public.cost_centers (code, name, unit_type)
SELECT v.c, v.n, v.t FROM (VALUES
  ('CC-LAB','Laboratorium',        'Pendapatan'),
  ('CC-RAD','Radiologi',           'Pendapatan'),
  ('CC-HC', 'Home Care',           'Pendapatan'),
  ('CC-MCU','MCU',                 'Pendapatan'),
  ('CC-KLN','Klinik',              'Pendapatan'),
  ('CC-ADM','Umum & Administrasi', 'Pendukung')
) AS v(c,n,t)
WHERE NOT EXISTS (SELECT 1 FROM public.cost_centers x WHERE x.code = v.c);

-- ══════════════════════════════════════════════════════════════
-- 4.1  BAGAN AKUN
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS code        text,
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS acc_type    text,   -- Aset|Kewajiban|Ekuitas|Pendapatan|Beban
  ADD COLUMN IF NOT EXISTS normal_side text,   -- D | K
  ADD COLUMN IF NOT EXISTS parent_code text,
  ADD COLUMN IF NOT EXISTS is_active   boolean default true,
  ADD COLUMN IF NOT EXISTS notes       text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.chart_of_accounts ADD CONSTRAINT uq_coa_code UNIQUE (code);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Bagan akun awal — silakan dikoreksi akuntan.
INSERT INTO public.chart_of_accounts (code, name, acc_type, normal_side, parent_code)
SELECT v.* FROM (VALUES
  ('1',      'ASET',                          'Aset',      'D', NULL),
  ('1-1',    'Aset Lancar',                   'Aset',      'D', '1'),
  ('1-1100', 'Kas',                           'Aset',      'D', '1-1'),
  ('1-1110', 'Kas Kecil',                     'Aset',      'D', '1-1'),
  ('1-1200', 'Bank',                          'Aset',      'D', '1-1'),
  ('1-1300', 'Piutang Pasien',                'Aset',      'D', '1-1'),
  ('1-1310', 'Piutang Korporat',              'Aset',      'D', '1-1'),
  ('1-1320', 'Piutang BPJS',                  'Aset',      'D', '1-1'),
  ('1-1400', 'Persediaan Reagen & BHP',       'Aset',      'D', '1-1'),
  ('1-2',    'Aset Tetap',                    'Aset',      'D', '1'),
  ('1-2100', 'Peralatan Medis',               'Aset',      'D', '1-2'),
  ('1-2900', 'Akumulasi Penyusutan',          'Aset',      'K', '1-2'),

  ('2',      'KEWAJIBAN',                     'Kewajiban', 'K', NULL),
  ('2-1100', 'Hutang Usaha',                  'Kewajiban', 'K', '2'),
  ('2-1150', 'Hutang Penerimaan Barang',      'Kewajiban', 'K', '2'),
  ('2-1200', 'Hutang Gaji',                   'Kewajiban', 'K', '2'),
  ('2-1310', 'Hutang PPh 21',                 'Kewajiban', 'K', '2'),
  ('2-1320', 'Hutang PPN',                    'Kewajiban', 'K', '2'),

  ('3',      'EKUITAS',                       'Ekuitas',   'K', NULL),
  ('3-1100', 'Modal Disetor',                 'Ekuitas',   'K', '3'),
  ('3-2100', 'Laba Ditahan',                  'Ekuitas',   'K', '3'),

  ('4',      'PENDAPATAN',                    'Pendapatan','K', NULL),
  ('4-1100', 'Pendapatan Laboratorium',       'Pendapatan','K', '4'),
  ('4-1200', 'Pendapatan Radiologi',          'Pendapatan','K', '4'),
  ('4-1300', 'Pendapatan Home Care',          'Pendapatan','K', '4'),
  ('4-1400', 'Pendapatan MCU',                'Pendapatan','K', '4'),
  ('4-1500', 'Pendapatan Klinik',             'Pendapatan','K', '4'),
  ('4-1900', 'Diskon & Potongan Penjualan',   'Pendapatan','D', '4'),

  ('5',      'BEBAN POKOK',                   'Beban',     'D', NULL),
  ('5-1100', 'Beban Reagen & BHP',            'Beban',     'D', '5'),
  ('5-1200', 'Beban Rujukan Lab Luar',        'Beban',     'D', '5'),
  ('5-1300', 'Beban Komisi Nakes',            'Beban',     'D', '5'),
  ('5-1900', 'Beban Selisih Persediaan',      'Beban',     'D', '5'),

  ('6',      'BEBAN OPERASIONAL',             'Beban',     'D', NULL),
  ('6-1100', 'Beban Gaji & Tunjangan',        'Beban',     'D', '6'),
  ('6-1200', 'Beban Penyusutan',              'Beban',     'D', '6'),
  ('6-1300', 'Beban Sewa',                    'Beban',     'D', '6'),
  ('6-1400', 'Beban Listrik, Air & Telepon',  'Beban',     'D', '6'),
  ('6-1500', 'Beban Pemeliharaan & Kalibrasi','Beban',     'D', '6'),
  ('6-1900', 'Beban Lain-lain',               'Beban',     'D', '6')
) AS v(code,name,acc_type,normal_side,parent_code)
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.code = v.code);

-- ══════════════════════════════════════════════════════════════
-- PERIODE AKUNTANSI
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.accounting_periods
  ADD COLUMN IF NOT EXISTS period     text,   -- 'YYYY-MM'
  ADD COLUMN IF NOT EXISTS status     text default 'Buka',  -- Buka | Tutup
  ADD COLUMN IF NOT EXISTS closed_at  timestamp,
  ADD COLUMN IF NOT EXISTS closed_by  text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.accounting_periods ADD CONSTRAINT uq_period UNIQUE (period);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.accounting_periods (period, status)
SELECT to_char(now(),'YYYY-MM'), 'Buka'
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_periods p WHERE p.period = to_char(now(),'YYYY-MM'));

-- ══════════════════════════════════════════════════════════════
-- JURNAL
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS entry_no    text,
  ADD COLUMN IF NOT EXISTS entry_date  date,
  ADD COLUMN IF NOT EXISTS period      text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS source_type text,   -- cashier|invoice|gr|gi|opname|return|payroll|manual
  ADD COLUMN IF NOT EXISTS source_id   bigint,
  ADD COLUMN IF NOT EXISTS total_debit numeric default 0,
  ADD COLUMN IF NOT EXISTS total_credit numeric default 0,
  ADD COLUMN IF NOT EXISTS is_reversal boolean default false,
  ADD COLUMN IF NOT EXISTS reversal_of bigint,
  ADD COLUMN IF NOT EXISTS posted_by   text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();

CREATE INDEX IF NOT EXISTS idx_je_period ON public.journal_entries(period, entry_date);
CREATE INDEX IF NOT EXISTS idx_je_source ON public.journal_entries(source_type, source_id);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.journal_lines
  ADD COLUMN IF NOT EXISTS entry_id       bigint,
  ADD COLUMN IF NOT EXISTS account_code   text,
  ADD COLUMN IF NOT EXISTS account_name   text,
  ADD COLUMN IF NOT EXISTS debit          numeric default 0,
  ADD COLUMN IF NOT EXISTS credit         numeric default 0,
  ADD COLUMN IF NOT EXISTS cost_center_id bigint,
  ADD COLUMN IF NOT EXISTS memo           text;

CREATE INDEX IF NOT EXISTS idx_jl_entry ON public.journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_acc   ON public.journal_lines(account_code);

-- ══════════════════════════════════════════════════════════════
-- 4.2  PEMETAAN TRANSAKSI → AKUN (data, bukan kode)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.gl_mappings (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.gl_mappings
  ADD COLUMN IF NOT EXISTS event_key    text,   -- mis. 'cashier.cash', 'gi.expense'
  ADD COLUMN IF NOT EXISTS debit_code   text,
  ADD COLUMN IF NOT EXISTS credit_code  text,
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS is_active    boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.gl_mappings ADD CONSTRAINT uq_glmap UNIQUE (event_key);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.gl_mappings (event_key, debit_code, credit_code, description)
SELECT v.* FROM (VALUES
  ('cashier.cash',    '1-1100','4-1100','Penerimaan kasir tunai'),
  ('cashier.bank',    '1-1200','4-1100','Penerimaan kasir non-tunai'),
  ('cashier.refund',  '4-1100','1-1100','Pengembalian dana ke pasien'),
  ('invoice.issue',   '1-1310','4-1100','Faktur korporat diterbitkan'),
  ('invoice.paid',    '1-1200','1-1310','Pelunasan faktur korporat'),
  ('gr.receive',      '1-1400','2-1150','Penerimaan barang dari PO'),
  ('vendor.invoice',  '2-1150','2-1100','Faktur supplier dicocokkan'),
  ('ap.payment',      '2-1100','1-1200','Pembayaran hutang usaha'),
  ('gi.expense',      '5-1100','1-1400','Pemakaian reagen & BHP'),
  ('opname.loss',     '5-1900','1-1400','Selisih kurang stock opname'),
  ('opname.gain',     '1-1400','5-1900','Selisih lebih stock opname'),
  ('purchase.return', '2-1100','1-1400','Retur pembelian ke supplier'),
  ('homecare.comm',   '5-1300','2-1200','Komisi nakes home care'),
  ('payroll.salary',  '6-1100','2-1200','Beban gaji periode'),
  ('payroll.pph21',   '2-1200','2-1310','Potongan PPh 21'),
  ('asset.depr',      '6-1200','1-2900','Penyusutan aset tetap')
) AS v(event_key,debit_code,credit_code,description)
WHERE NOT EXISTS (SELECT 1 FROM public.gl_mappings g WHERE g.event_key = v.event_key);

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: catat jurnal (selalu seimbang, periode wajib terbuka)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.post_journal(
  p_event_key text, p_amount numeric, p_description text,
  p_source_type text DEFAULT 'manual', p_source_id bigint DEFAULT NULL,
  p_cost_center text DEFAULT NULL, p_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_map    record;
  v_date   date := coalesce(p_date, current_date);
  v_period text := to_char(v_date,'YYYY-MM');
  v_pstat  text;
  v_cc     bigint;
  v_entry  bigint;
  v_no     text;
  v_dname  text; v_cname text;
  v_name   text := public.current_app_name();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF coalesce(p_amount,0) = 0 THEN
    RETURN jsonb_build_object('ok',true,'skipped','nilai nol');
  END IF;

  SELECT * INTO v_map FROM gl_mappings WHERE event_key = p_event_key AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pemetaan akun untuk "%" belum diatur', p_event_key;
  END IF;

  -- Periode tertutup tidak menerima entri baru
  SELECT status INTO v_pstat FROM accounting_periods WHERE period = v_period;
  IF v_pstat = 'Tutup' THEN
    RAISE EXCEPTION 'Periode % sudah ditutup. Gunakan jurnal balik pada periode berjalan.', v_period;
  END IF;
  IF v_pstat IS NULL THEN
    INSERT INTO accounting_periods(period, status, updated_at) VALUES (v_period,'Buka',now());
  END IF;

  IF p_cost_center IS NOT NULL THEN
    SELECT id INTO v_cc FROM cost_centers WHERE code = p_cost_center;
  END IF;

  SELECT name INTO v_dname FROM chart_of_accounts WHERE code = v_map.debit_code;
  SELECT name INTO v_cname FROM chart_of_accounts WHERE code = v_map.credit_code;
  IF v_dname IS NULL OR v_cname IS NULL THEN
    RAISE EXCEPTION 'Akun % atau % tidak ada di bagan akun', v_map.debit_code, v_map.credit_code;
  END IF;

  v_no := 'JV/' || to_char(v_date,'YYYYMM') || '/' || lpad((floor(random()*99999))::text,5,'0');

  INSERT INTO journal_entries(entry_no, entry_date, period, description, source_type, source_id,
                              total_debit, total_credit, posted_by, updated_at)
  VALUES (v_no, v_date, v_period, coalesce(p_description, v_map.description),
          p_source_type, p_source_id, p_amount, p_amount, v_name, now())
  RETURNING id INTO v_entry;

  INSERT INTO journal_lines(entry_id, account_code, account_name, debit, credit, cost_center_id, memo)
  VALUES (v_entry, v_map.debit_code,  v_dname, p_amount, 0, v_cc, p_description),
         (v_entry, v_map.credit_code, v_cname, 0, p_amount, v_cc, p_description);

  RETURN jsonb_build_object('ok',true,'entry_id',v_entry,'entry_no',v_no,
                            'debit',v_map.debit_code,'credit',v_map.credit_code);
END $$;

-- Jurnal balik — periode tertutup dikoreksi lewat sini, bukan dibuka kembali
CREATE OR REPLACE FUNCTION public.reverse_journal(p_entry_id bigint, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_e record; v_l record; v_new bigint; v_no text; v_name text := public.current_app_name();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF coalesce(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'Alasan pembalikan wajib diisi'; END IF;

  SELECT * INTO v_e FROM journal_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jurnal tidak ditemukan'; END IF;

  v_no := 'RV/' || to_char(current_date,'YYYYMM') || '/' || lpad((floor(random()*99999))::text,5,'0');

  INSERT INTO journal_entries(entry_no, entry_date, period, description, source_type, source_id,
                              total_debit, total_credit, is_reversal, reversal_of, posted_by, updated_at)
  VALUES (v_no, current_date, to_char(current_date,'YYYY-MM'),
          'Pembalikan ' || v_e.entry_no || ': ' || p_reason,
          v_e.source_type, v_e.source_id, v_e.total_credit, v_e.total_debit,
          true, p_entry_id, v_name, now())
  RETURNING id INTO v_new;

  FOR v_l IN SELECT * FROM journal_lines WHERE entry_id = p_entry_id LOOP
    INSERT INTO journal_lines(entry_id, account_code, account_name, debit, credit, cost_center_id, memo)
    VALUES (v_new, v_l.account_code, v_l.account_name, v_l.credit, v_l.debit, v_l.cost_center_id,
            'Pembalikan: ' || coalesce(v_l.memo,''));
  END LOOP;

  PERFORM public.write_audit('reverse','journal_entries', p_entry_id::text,
    'Jurnal dibalik: ' || p_reason, v_e.entry_no);

  RETURN jsonb_build_object('ok',true,'entry_no',v_no);
END $$;

-- Neraca saldo per periode
CREATE OR REPLACE FUNCTION public.trial_balance(p_period text)
RETURNS TABLE(account_code text, account_name text, acc_type text,
              total_debit numeric, total_credit numeric, balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.code, c.name, c.acc_type,
         coalesce(sum(l.debit),0), coalesce(sum(l.credit),0),
         CASE WHEN c.normal_side = 'D'
              THEN coalesce(sum(l.debit),0) - coalesce(sum(l.credit),0)
              ELSE coalesce(sum(l.credit),0) - coalesce(sum(l.debit),0) END
  FROM chart_of_accounts c
  LEFT JOIN journal_lines l   ON l.account_code = c.code
  LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.period = p_period
  WHERE c.is_active AND c.parent_code IS NOT NULL
  GROUP BY c.code, c.name, c.acc_type, c.normal_side
  HAVING coalesce(sum(l.debit),0) <> 0 OR coalesce(sum(l.credit),0) <> 0
  ORDER BY c.code
$$;

-- Laba rugi per pusat biaya
CREATE OR REPLACE FUNCTION public.profit_by_cost_center(p_period text)
RETURNS TABLE(cost_center text, pendapatan numeric, beban numeric, margin numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(cc.name,'(tanpa pusat biaya)'),
         coalesce(sum(CASE WHEN c.acc_type='Pendapatan' THEN l.credit - l.debit END),0),
         coalesce(sum(CASE WHEN c.acc_type='Beban'      THEN l.debit  - l.credit END),0),
         coalesce(sum(CASE WHEN c.acc_type='Pendapatan' THEN l.credit - l.debit END),0)
       - coalesce(sum(CASE WHEN c.acc_type='Beban'      THEN l.debit  - l.credit END),0)
  FROM journal_lines l
  JOIN journal_entries e     ON e.id = l.entry_id AND e.period = p_period
  JOIN chart_of_accounts c   ON c.code = l.account_code
  LEFT JOIN cost_centers cc  ON cc.id = l.cost_center_id
  WHERE c.acc_type IN ('Pendapatan','Beban')
  GROUP BY cc.name
  ORDER BY 4 DESC
$$;

-- ══════════════════════════════════════════════════════════════
-- 4.3  HUTANG USAHA — pembayaran faktur supplier
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS paid_at    timestamp,
  ADD COLUMN IF NOT EXISTS paid_by    text,
  ADD COLUMN IF NOT EXISTS journal_id bigint;

CREATE OR REPLACE FUNCTION public.pay_vendor_invoice(p_invoice_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv record; v_role text := public.current_app_role(); v_j jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('super_admin','direktur','manager','finance_staff') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang membayar hutang', v_role;
  END IF;

  SELECT * INTO v_inv FROM vendor_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktur tidak ditemukan'; END IF;
  IF v_inv.payment_status = 'Dibayar' THEN RAISE EXCEPTION 'Faktur sudah dibayar'; END IF;

  -- Pengendalian utama: hanya faktur yang lolos pencocokan tiga arah boleh dibayar
  IF coalesce(v_inv.match_status,'') <> 'Cocok' THEN
    RAISE EXCEPTION 'Faktur belum lolos pencocokan tiga arah (status: %)',
      coalesce(v_inv.match_status,'Belum Dicocokkan');
  END IF;

  v_j := public.post_journal('ap.payment', v_inv.total_amount,
          'Pembayaran ' || coalesce(v_inv.invoice_number,'faktur supplier'),
          'ap', p_invoice_id, 'CC-ADM', current_date);

  UPDATE vendor_invoices
    SET payment_status='Dibayar', paid_at=now(), paid_by=public.current_app_name(),
        journal_id=(v_j->>'entry_id')::bigint, updated_at=now()
    WHERE id = p_invoice_id;

  RETURN jsonb_build_object('ok',true,'journal',v_j);
END $$;

-- ══════════════════════════════════════════════════════════════
-- RLS & perizinan
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.chart_of_accounts  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_mappings        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['journal_entries','journal_lines'] LOOP
    FOR pol IN SELECT p.polname FROM pg_policy p
               JOIN pg_class c ON c.oid=p.polrelid
               JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relname=t
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, t); END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                    USING (true) WITH CHECK (true)', t||'_authenticated', t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.post_journal(text,numeric,text,text,bigint,text,date) FROM public, anon;
REVOKE ALL ON FUNCTION public.reverse_journal(bigint,text)      FROM public, anon;
REVOKE ALL ON FUNCTION public.trial_balance(text)               FROM public, anon;
REVOKE ALL ON FUNCTION public.profit_by_cost_center(text)       FROM public, anon;
REVOKE ALL ON FUNCTION public.pay_vendor_invoice(bigint)        FROM public, anon;
GRANT EXECUTE ON FUNCTION public.post_journal(text,numeric,text,text,bigint,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_journal(bigint,text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.trial_balance(text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.profit_by_cost_center(text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_vendor_invoice(bigint)     TO authenticated;

-- ══════════════════════════════════════════════════════════════
SELECT 'akun'        AS jenis, count(*)::text AS jumlah FROM chart_of_accounts
UNION ALL SELECT 'pusat biaya', count(*)::text FROM cost_centers
UNION ALL SELECT 'pemetaan GL', count(*)::text FROM gl_mappings
UNION ALL SELECT 'fungsi', count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN
    ('post_journal','reverse_journal','trial_balance','profit_by_cost_center','pay_vendor_invoice');

-- ══════════════════════════════════════════════════════════════
-- 4.2  POSTING OTOMATIS — dipasang sebagai pemicu
-- ══════════════════════════════════════════════════════════════
-- Dipasang di tabel sumbernya, bukan dipanggil dari JavaScript, supaya tidak
-- ada jalur yang bisa melewatinya. Kegagalan posting TIDAK PERNAH membatalkan
-- transaksi operasionalnya — kasir tetap boleh menerima uang walau jurnalnya
-- bermasalah; yang gagal dicatat sebagai peringatan untuk ditelusuri.

CREATE OR REPLACE FUNCTION public.trg_post_cashier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text; v_amt numeric;
BEGIN
  v_amt := coalesce(NEW.total_amount,0);
  IF v_amt = 0 THEN RETURN NEW; END IF;

  IF NEW.transaction_type = 'Refund' THEN v_key := 'cashier.refund';
  ELSIF coalesce(NEW.payment_method,'cash') IN ('cash','tunai','Tunai') THEN v_key := 'cashier.cash';
  ELSE v_key := 'cashier.bank';
  END IF;

  PERFORM public.post_journal(v_key, v_amt,
    concat('Kasir ', coalesce(NEW.transaction_number,''), ' — ', coalesce(NEW.patient_name,'')),
    'cashier', NEW.id, 'CC-ADM', coalesce(NEW.created_at::date, current_date));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Posting jurnal kasir gagal utk transaksi %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cashier_post_gl ON public.cashier_transactions;
CREATE TRIGGER cashier_post_gl AFTER INSERT ON public.cashier_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_cashier();

CREATE OR REPLACE FUNCTION public.trg_post_goods_issue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cc text;
BEGIN
  IF coalesce(NEW.total_value,0) = 0 THEN RETURN NEW; END IF;
  v_cc := CASE
    WHEN NEW.division ILIKE '%lab%'   THEN 'CC-LAB'
    WHEN NEW.division ILIKE '%radio%' THEN 'CC-RAD'
    WHEN NEW.division ILIKE '%home%'  THEN 'CC-HC'
    WHEN NEW.division ILIKE '%mcu%'   THEN 'CC-MCU'
    ELSE 'CC-ADM' END;

  PERFORM public.post_journal('gi.expense', NEW.total_value,
    concat('Pemakaian barang ', coalesce(NEW.gi_number,''), ' — ', coalesce(NEW.purpose,'')),
    'gi', NEW.id, v_cc, coalesce(NEW.issue_date, current_date));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Posting jurnal pengeluaran barang gagal utk %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS gi_post_gl ON public.goods_issues;
CREATE TRIGGER gi_post_gl AFTER INSERT ON public.goods_issues
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_goods_issue();

-- Opname: selisih kurang menjadi beban, selisih lebih mengurangi beban
CREATE OR REPLACE FUNCTION public.trg_post_opname()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'Selesai' OR coalesce(OLD.status,'') = 'Selesai' THEN RETURN NEW; END IF;
  IF coalesce(NEW.total_selisih_value,0) = 0 THEN RETURN NEW; END IF;

  IF NEW.total_selisih_value < 0 THEN
    PERFORM public.post_journal('opname.loss', abs(NEW.total_selisih_value),
      concat('Selisih kurang opname ', coalesce(NEW.opname_number,'')),
      'opname', NEW.id, 'CC-ADM', current_date);
  ELSE
    PERFORM public.post_journal('opname.gain', NEW.total_selisih_value,
      concat('Selisih lebih opname ', coalesce(NEW.opname_number,'')),
      'opname', NEW.id, 'CC-ADM', current_date);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Posting jurnal opname gagal utk %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS opname_post_gl ON public.stock_opname;
CREATE TRIGGER opname_post_gl AFTER UPDATE OF status ON public.stock_opname
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_opname();

-- Komisi nakes diakui saat kunjungan home care ditandai selesai
CREATE OR REPLACE FUNCTION public.trg_post_homecare_comm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'Selesai' OR coalesce(OLD.status,'') = 'Selesai' THEN RETURN NEW; END IF;
  IF coalesce(NEW.commission_amount,0) = 0 THEN RETURN NEW; END IF;

  PERFORM public.post_journal('homecare.comm', NEW.commission_amount,
    concat('Komisi nakes ', coalesce(NEW.assigned_staff,''), ' — ', coalesce(NEW.patient_name,'')),
    'homecare', NEW.id, 'CC-HC', coalesce(NEW.scheduled_date, current_date));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Posting jurnal komisi home care gagal utk %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS hc_comm_post_gl ON public.homecare_orders;
CREATE TRIGGER hc_comm_post_gl AFTER UPDATE OF status ON public.homecare_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_homecare_comm();

SELECT tgname AS pemicu_terpasang FROM pg_trigger
WHERE tgname IN ('cashier_post_gl','gi_post_gl','opname_post_gl','hc_comm_post_gl')
ORDER BY tgname;
