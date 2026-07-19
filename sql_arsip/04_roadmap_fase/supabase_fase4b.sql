-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 4.6 (Penggajian) + 2.3 (Komisi → Penggajian)
-- ──────────────────────────────────────────────────────────────
-- KONDISI AWAL
--   renderPayrollTab() hanya menampilkan TABEL ESTIMASI: BPJS dipukul rata 4%
--   dari gaji pokok, tanpa komponen lain. Belum bisa dipakai membayar orang.
--   Komisi nakes home care sudah dihitung tetapi berhenti sebagai laporan.
--
-- CARA MEMBUKA PEMBLOKIRAN PAJAK
--   Tarif PPh 21 dan iuran BPJS berubah mengikuti peraturan, dan saya TIDAK
--   BOLEH menebaknya. Karena itu seluruh tarif disimpan sebagai DATA yang dapat
--   diubah (tabel payroll_settings dan tax_brackets), bukan dipatri di kode.
--
--   Nilai yang terpasang adalah TITIK AWAL YANG HARUS DIKONFIRMASI konsultan
--   pajak Anda. Sistem sengaja menandai perhitungan pajak sebagai "belum
--   dikonfirmasi" sampai Anda menyatakannya sudah diperiksa.
--
-- PRASYARAT: supabase_fase4.sql
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- PARAMETER PENGGAJIAN — semuanya dapat diubah
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.payroll_settings
  ADD COLUMN IF NOT EXISTS setting_key text,
  ADD COLUMN IF NOT EXISTS value       numeric,
  ADD COLUMN IF NOT EXISTS label       text,
  ADD COLUMN IF NOT EXISTS notes       text,
  ADD COLUMN IF NOT EXISTS confirmed   boolean default false,  -- sudah diperiksa konsultan?
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.payroll_settings ADD CONSTRAINT uq_payroll_setting UNIQUE (setting_key);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Nilai awal — WAJIB dikonfirmasi sebelum dipakai membayar orang.
INSERT INTO public.payroll_settings (setting_key, value, label, notes, confirmed)
SELECT v.* FROM (VALUES
  ('bpjs_kes_employee', 1.0,  'BPJS Kesehatan — porsi karyawan (%)',       'Konfirmasi ke HRD/konsultan', false),
  ('bpjs_kes_company',  4.0,  'BPJS Kesehatan — porsi perusahaan (%)',     'Konfirmasi ke HRD/konsultan', false),
  ('bpjs_jht_employee', 2.0,  'BPJS JHT — porsi karyawan (%)',             'Konfirmasi ke HRD/konsultan', false),
  ('bpjs_jht_company',  3.7,  'BPJS JHT — porsi perusahaan (%)',           'Konfirmasi ke HRD/konsultan', false),
  ('bpjs_jp_employee',  1.0,  'BPJS Jaminan Pensiun — karyawan (%)',       'Konfirmasi ke HRD/konsultan', false),
  ('bpjs_jp_company',   2.0,  'BPJS Jaminan Pensiun — perusahaan (%)',     'Konfirmasi ke HRD/konsultan', false),
  ('ptkp_tk0',      54000000, 'PTKP setahun TK/0 (Rp)',                    'Konfirmasi ke konsultan pajak', false),
  ('ptkp_tanggungan', 4500000,'Tambahan PTKP per tanggungan (Rp)',         'Konfirmasi ke konsultan pajak', false),
  ('biaya_jabatan_pct', 5.0,  'Biaya jabatan (% dari bruto)',              'Konfirmasi ke konsultan pajak', false),
  ('biaya_jabatan_max', 6000000,'Batas biaya jabatan setahun (Rp)',        'Konfirmasi ke konsultan pajak', false),
  ('overtime_rate',   1.5,    'Pengali upah lembur per jam',               'Sesuaikan kebijakan perusahaan', false),
  ('leave_quota',     12,     'Kuota cuti tahunan (hari)',                 'Sesuaikan kebijakan perusahaan', false)
) AS v(setting_key,value,label,notes,confirmed)
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_settings s WHERE s.setting_key = v.setting_key);

-- Lapisan tarif PPh 21 progresif — dapat diubah bila peraturan berubah
CREATE TABLE IF NOT EXISTS public.tax_brackets (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.tax_brackets
  ADD COLUMN IF NOT EXISTS min_amount numeric default 0,
  ADD COLUMN IF NOT EXISTS max_amount numeric,          -- NULL = tak terbatas
  ADD COLUMN IF NOT EXISTS rate_pct   numeric default 0,
  ADD COLUMN IF NOT EXISTS seq        integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

INSERT INTO public.tax_brackets (seq, min_amount, max_amount, rate_pct)
SELECT v.* FROM (VALUES
  (1,          0,   60000000,  5.0),
  (2,   60000000,  250000000, 15.0),
  (3,  250000000,  500000000, 25.0),
  (4,  500000000, 5000000000, 30.0),
  (5, 5000000000,       NULL, 35.0)
) AS v(seq,min_amount,max_amount,rate_pct)
WHERE NOT EXISTS (SELECT 1 FROM public.tax_brackets t WHERE t.seq = v.seq);

-- ══════════════════════════════════════════════════════════════
-- KOMPONEN PENGHASILAN & POTONGAN PER KARYAWAN
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.employee_components (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.employee_components
  ADD COLUMN IF NOT EXISTS employee_id  bigint,
  ADD COLUMN IF NOT EXISTS component    text,   -- Tunjangan Jabatan, Transport, Makan, dll
  ADD COLUMN IF NOT EXISTS comp_type    text default 'Tunjangan',  -- Tunjangan | Potongan
  ADD COLUMN IF NOT EXISTS amount       numeric default 0,
  ADD COLUMN IF NOT EXISTS is_taxable   boolean default true,
  ADD COLUMN IF NOT EXISTS is_active    boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

CREATE INDEX IF NOT EXISTS idx_empcomp ON public.employee_components(employee_id, is_active);

-- ══════════════════════════════════════════════════════════════
-- PROSES GAJI
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS period      text,     -- 'YYYY-MM'
  ADD COLUMN IF NOT EXISTS status      text default 'Draft',  -- Draft | Final
  ADD COLUMN IF NOT EXISTS total_gross numeric default 0,
  ADD COLUMN IF NOT EXISTS total_net   numeric default 0,
  ADD COLUMN IF NOT EXISTS total_tax   numeric default 0,
  ADD COLUMN IF NOT EXISTS employee_count integer default 0,
  ADD COLUMN IF NOT EXISTS run_by      text,
  ADD COLUMN IF NOT EXISTS finalized_at timestamp,
  ADD COLUMN IF NOT EXISTS journal_id  bigint,
  ADD COLUMN IF NOT EXISTS notes       text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.payroll_runs ADD CONSTRAINT uq_payroll_period UNIQUE (period);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payroll_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS run_id        bigint,
  ADD COLUMN IF NOT EXISTS employee_id   bigint,
  ADD COLUMN IF NOT EXISTS employee_name text,
  ADD COLUMN IF NOT EXISTS base_salary   numeric default 0,
  ADD COLUMN IF NOT EXISTS allowances    numeric default 0,
  ADD COLUMN IF NOT EXISTS overtime      numeric default 0,
  ADD COLUMN IF NOT EXISTS commission    numeric default 0,   -- dari home care (Fase 2.3)
  ADD COLUMN IF NOT EXISTS gross         numeric default 0,
  ADD COLUMN IF NOT EXISTS bpjs_employee numeric default 0,
  ADD COLUMN IF NOT EXISTS bpjs_company  numeric default 0,
  ADD COLUMN IF NOT EXISTS other_deduction numeric default 0,
  ADD COLUMN IF NOT EXISTS pph21         numeric default 0,
  ADD COLUMN IF NOT EXISTS net           numeric default 0,
  ADD COLUMN IF NOT EXISTS detail        jsonb,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

CREATE INDEX IF NOT EXISTS idx_payitem_run ON public.payroll_items(run_id);

-- Saldo cuti
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS employee_id bigint,
  ADD COLUMN IF NOT EXISTS year        integer,
  ADD COLUMN IF NOT EXISTS quota       numeric default 12,
  ADD COLUMN IF NOT EXISTS used        numeric default 0,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.leave_balances ADD CONSTRAINT uq_leave_bal UNIQUE (employee_id, year);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Kurangi saldo cuti otomatis saat pengajuan disetujui
CREATE OR REPLACE FUNCTION public.trg_leave_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year int; v_quota numeric;
BEGIN
  IF NEW.status <> 'Approved' OR coalesce(OLD.status,'') = 'Approved' THEN RETURN NEW; END IF;
  IF NEW.employee_id IS NULL THEN RETURN NEW; END IF;

  v_year := extract(year from coalesce(NEW.start_date, current_date));
  SELECT coalesce(value,12) INTO v_quota FROM payroll_settings WHERE setting_key='leave_quota';

  INSERT INTO leave_balances(employee_id, year, quota, used, updated_at)
  VALUES (NEW.employee_id, v_year, coalesce(v_quota,12), coalesce(NEW.total_days,1), now())
  ON CONFLICT (employee_id, year)
  DO UPDATE SET used = leave_balances.used + coalesce(NEW.total_days,1), updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Pembaruan saldo cuti gagal utk pengajuan %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS leave_balance_sync ON public.leave_requests;
CREATE TRIGGER leave_balance_sync AFTER UPDATE OF status ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_leave_balance();

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: hitung gaji satu periode
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calculate_payroll(p_period text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  text := public.current_app_role();
  v_run   bigint;
  v_emp   record;
  v_set   jsonb := '{}'::jsonb;
  s       record;
  v_allow numeric; v_deduct numeric; v_comm numeric; v_ot numeric;
  v_gross numeric; v_bpjs_e numeric; v_bpjs_c numeric;
  v_taxable numeric; v_bj numeric; v_ptkp numeric; v_pkp numeric; v_pph numeric;
  v_net   numeric;
  v_tg    numeric := 0; v_tn numeric := 0; v_tt numeric := 0; v_cnt int := 0;
  v_start date; v_end date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('super_admin','direktur','manager','hrd_staff') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang memproses gaji', v_role;
  END IF;

  FOR s IN SELECT setting_key, value FROM payroll_settings LOOP
    v_set := v_set || jsonb_build_object(s.setting_key, s.value);
  END LOOP;

  v_start := to_date(p_period || '-01','YYYY-MM-DD');
  v_end   := (v_start + interval '1 month - 1 day')::date;

  -- Satu proses per periode; yang sudah final tidak boleh dihitung ulang
  SELECT id INTO v_run FROM payroll_runs WHERE period = p_period;
  IF v_run IS NOT NULL THEN
    IF (SELECT status FROM payroll_runs WHERE id = v_run) = 'Final' THEN
      RAISE EXCEPTION 'Periode gaji % sudah final dan terkunci', p_period;
    END IF;
    DELETE FROM payroll_items WHERE run_id = v_run;
  ELSE
    INSERT INTO payroll_runs(period, status, run_by, updated_at)
    VALUES (p_period, 'Draft', public.current_app_name(), now()) RETURNING id INTO v_run;
  END IF;

  FOR v_emp IN SELECT * FROM employees WHERE coalesce(status,'Aktif') = 'Aktif' LOOP
    -- Tunjangan & potongan tetap
    SELECT coalesce(sum(CASE WHEN comp_type='Tunjangan' THEN amount END),0),
           coalesce(sum(CASE WHEN comp_type='Potongan'  THEN amount END),0)
      INTO v_allow, v_deduct
      FROM employee_components WHERE employee_id = v_emp.id AND coalesce(is_active,true);

    -- Komisi home care (Fase 2.3) — hanya kunjungan selesai pada periode ini
    SELECT coalesce(sum(o.commission_amount),0) INTO v_comm
      FROM homecare_orders o
      JOIN homecare_staff st ON st.id = o.staff_id
     WHERE st.employee_id = v_emp.id
       AND o.status = 'Selesai'
       AND o.scheduled_date BETWEEN v_start AND v_end;

    v_ot := 0;   -- lembur menyusul bila jam lembur sudah tercatat terstruktur

    v_gross  := coalesce(v_emp.base_salary,0) + v_allow + v_comm + v_ot;
    v_bpjs_e := v_gross * (coalesce((v_set->>'bpjs_kes_employee')::numeric,0)
                         + coalesce((v_set->>'bpjs_jht_employee')::numeric,0)
                         + coalesce((v_set->>'bpjs_jp_employee')::numeric,0)) / 100;
    v_bpjs_c := v_gross * (coalesce((v_set->>'bpjs_kes_company')::numeric,0)
                         + coalesce((v_set->>'bpjs_jht_company')::numeric,0)
                         + coalesce((v_set->>'bpjs_jp_company')::numeric,0)) / 100;

    -- PPh 21 disetahunkan, memakai lapisan tarif yang dapat diubah
    v_bj := least(v_gross * coalesce((v_set->>'biaya_jabatan_pct')::numeric,0)/100 * 12,
                  coalesce((v_set->>'biaya_jabatan_max')::numeric,0));
    v_ptkp := coalesce((v_set->>'ptkp_tk0')::numeric,0);
    v_taxable := (v_gross - v_bpjs_e) * 12 - v_bj;
    v_pkp := greatest(v_taxable - v_ptkp, 0);

    v_pph := 0;
    IF v_pkp > 0 THEN
      SELECT coalesce(sum(
        greatest(least(v_pkp, coalesce(t.max_amount, v_pkp)) - t.min_amount, 0) * t.rate_pct / 100
      ),0) INTO v_pph FROM tax_brackets t WHERE t.min_amount < v_pkp;
      v_pph := round(v_pph / 12);   -- kembali ke bulanan
    END IF;

    v_net := v_gross - v_bpjs_e - v_deduct - v_pph;

    INSERT INTO payroll_items(run_id, employee_id, employee_name, base_salary, allowances,
                              overtime, commission, gross, bpjs_employee, bpjs_company,
                              other_deduction, pph21, net, detail, updated_at)
    VALUES (v_run, v_emp.id, v_emp.full_name, coalesce(v_emp.base_salary,0), v_allow,
            v_ot, v_comm, v_gross, round(v_bpjs_e), round(v_bpjs_c),
            v_deduct, v_pph, round(v_net),
            jsonb_build_object('pkp', v_pkp, 'biaya_jabatan', v_bj, 'ptkp', v_ptkp), now());

    v_tg := v_tg + v_gross; v_tn := v_tn + v_net; v_tt := v_tt + v_pph; v_cnt := v_cnt + 1;
  END LOOP;

  UPDATE payroll_runs SET total_gross=v_tg, total_net=v_tn, total_tax=v_tt,
         employee_count=v_cnt, updated_at=now() WHERE id = v_run;

  PERFORM public.write_audit('payroll_calc','payroll_runs', v_run::text,
    format('Hitung gaji %s: %s karyawan, bruto %s', p_period, v_cnt, v_tg), p_period);

  RETURN jsonb_build_object('ok',true,'run_id',v_run,'employees',v_cnt,
                            'gross',v_tg,'net',v_tn,'tax',v_tt);
END $$;

-- Finalisasi: mengunci periode dan mencatat jurnal
CREATE OR REPLACE FUNCTION public.finalize_payroll(p_run_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run record; v_role text := public.current_app_role(); v_j jsonb; v_unconfirmed int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('super_admin','direktur') THEN
    RAISE EXCEPTION 'Hanya direktur atau super admin yang boleh memfinalkan gaji';
  END IF;

  SELECT * INTO v_run FROM payroll_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proses gaji tidak ditemukan'; END IF;
  IF v_run.status = 'Final' THEN RAISE EXCEPTION 'Periode ini sudah final'; END IF;

  -- Pengaman: tarif pajak yang belum dikonfirmasi tidak boleh dipakai membayar orang
  SELECT count(*) INTO v_unconfirmed FROM payroll_settings
   WHERE setting_key IN ('ptkp_tk0','biaya_jabatan_pct','biaya_jabatan_max')
     AND coalesce(confirmed,false) = false;
  IF v_unconfirmed > 0 THEN
    RAISE EXCEPTION 'Parameter pajak belum dikonfirmasi. Periksa Pengaturan Penggajian bersama konsultan pajak sebelum memfinalkan.';
  END IF;

  v_j := public.post_journal('payroll.salary', v_run.total_gross,
          'Beban gaji periode ' || v_run.period, 'payroll', p_run_id, 'CC-ADM', current_date);

  IF coalesce(v_run.total_tax,0) > 0 THEN
    PERFORM public.post_journal('payroll.pph21', v_run.total_tax,
      'Potongan PPh 21 periode ' || v_run.period, 'payroll', p_run_id, 'CC-ADM', current_date);
  END IF;

  UPDATE payroll_runs SET status='Final', finalized_at=now(),
         journal_id=(v_j->>'entry_id')::bigint, updated_at=now() WHERE id = p_run_id;

  PERFORM public.write_audit('payroll_final','payroll_runs', p_run_id::text,
    format('Finalisasi gaji %s — bruto %s, PPh21 %s', v_run.period, v_run.total_gross, v_run.total_tax),
    v_run.period);

  RETURN jsonb_build_object('ok',true,'journal',v_j);
END $$;

-- ══════════════════════════════════════════════════════════════
-- RLS & perizinan
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.payroll_settings     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_brackets         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_components  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances       DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['payroll_runs','payroll_items'] LOOP
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

REVOKE ALL ON FUNCTION public.calculate_payroll(text)  FROM public, anon;
REVOKE ALL ON FUNCTION public.finalize_payroll(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.calculate_payroll(text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payroll(bigint) TO authenticated;

SELECT 'parameter' AS jenis, count(*)::text FROM payroll_settings
UNION ALL SELECT 'lapisan pajak', count(*)::text FROM tax_brackets
UNION ALL SELECT 'belum dikonfirmasi', count(*)::text FROM payroll_settings WHERE confirmed = false;
