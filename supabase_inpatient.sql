-- ══════════════════════════════════════════════════════════════
-- OneLab — MODUL RAWAT INAP (Inpatient)
-- ──────────────────────────────────────────────────────────────
-- CAKUPAN
--   · Master bangsal, kelas perawatan, dan tempat tidur
--   · Admisi rawat inap dari pasien yang sudah terdaftar di admissions
--   · Pindah ruang beserta riwayatnya
--   · Billing harian: biaya kamar per hari menginap + tindakan
--   · Resume pulang dan pembebasan tempat tidur
--
-- YANG DIPAKAI ULANG, BUKAN DIBUAT ULANG
--   admissions        — data pasien dan nomor rekam medis
--   employees         — daftar DPJP
--   clinical_notes    — visite dokter & catatan keperawatan (ditaut lewat admission_id)
--   vital_signs       — tanda vital harian
--   icd_diagnostics   — diagnosis masuk dan diagnosis akhir
--   post_journal()    — pencatatan jurnal saat pasien pulang
--
-- SATU TEMPAT TIDUR, SATU PASIEN
--   Admisi, pindah ruang, dan pemulangan dijalankan sebagai fungsi tunggal
--   dengan penguncian baris (FOR UPDATE). Dua petugas yang menekan tombol
--   bersamaan tidak dapat menempatkan dua pasien pada tempat tidur yang sama.
--   Indeks unik parsial di bawah menjadi lapis pengaman kedua bila kelak ada
--   jalur penulisan lain.
--
-- PRASYARAT: supabase_fase1_rls_a.sql, supabase_fase1_rpc.sql, supabase_fase3.sql,
--            supabase_fase4.sql
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- KELAS PERAWATAN — sumber tarif kamar
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inpatient_classes (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inpatient_classes
  ADD COLUMN IF NOT EXISTS code         text,      -- VIP, 1, 2, 3, ICU
  ADD COLUMN IF NOT EXISTS name         text,
  ADD COLUMN IF NOT EXISTS room_rate    numeric default 0,   -- tarif kamar per hari
  ADD COLUMN IF NOT EXISTS visit_rate   numeric default 0,   -- tarif visite dokter
  ADD COLUMN IF NOT EXISTS bed_capacity integer default 1,   -- tempat tidur per ruang
  ADD COLUMN IF NOT EXISTS sort_order   integer default 0,
  ADD COLUMN IF NOT EXISTS is_active    boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.inpatient_classes ADD CONSTRAINT uq_inp_class_code UNIQUE (code);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.inpatient_classes (code, name, room_rate, visit_rate, bed_capacity, sort_order)
SELECT v.* FROM (VALUES
  ('VIP','Kelas VIP',      750000, 200000, 1, 1),
  ('1',  'Kelas 1',        450000, 150000, 2, 2),
  ('2',  'Kelas 2',        300000, 125000, 4, 3),
  ('3',  'Kelas 3',        180000, 100000, 6, 4),
  ('ICU','Intensive Care', 1200000,300000, 1, 5)
) AS v(code,name,room_rate,visit_rate,bed_capacity,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.inpatient_classes c WHERE c.code = v.code);

-- ══════════════════════════════════════════════════════════════
-- BANGSAL / RUANG
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inpatient_wards (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inpatient_wards
  ADD COLUMN IF NOT EXISTS code       text,
  ADD COLUMN IF NOT EXISTS name       text,
  ADD COLUMN IF NOT EXISTS floor      text,
  ADD COLUMN IF NOT EXISTS ward_type  text default 'Umum',   -- Umum | Anak | Kebidanan | Isolasi | Intensif
  ADD COLUMN IF NOT EXISTS gender_policy text default 'Campur', -- Campur | Pria | Wanita
  ADD COLUMN IF NOT EXISTS phone      text,
  ADD COLUMN IF NOT EXISTS notes      text,
  ADD COLUMN IF NOT EXISTS is_active  boolean default true,
  ADD COLUMN IF NOT EXISTS sort_order integer default 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.inpatient_wards ADD CONSTRAINT uq_inp_ward_code UNIQUE (code);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.inpatient_wards (code, name, floor, ward_type, sort_order)
SELECT v.* FROM (VALUES
  ('MLT','Bangsal Melati','Lantai 2','Umum',      1),
  ('ANG','Bangsal Anggrek','Lantai 3','Umum',     2)
) AS v(code,name,floor,ward_type,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.inpatient_wards w WHERE w.code = v.code);

-- ══════════════════════════════════════════════════════════════
-- TEMPAT TIDUR
-- ══════════════════════════════════════════════════════════════
-- status: Kosong | Terisi | Perbaikan | Dibersihkan
-- Kolom current_stay_id hanya cerminan agar papan tempat tidur dapat digambar
-- dengan satu kueri. Kebenarannya dijaga oleh fungsi-fungsi di bawah.
CREATE TABLE IF NOT EXISTS public.inpatient_beds (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inpatient_beds
  ADD COLUMN IF NOT EXISTS ward_id        bigint,
  ADD COLUMN IF NOT EXISTS room_no        text,
  ADD COLUMN IF NOT EXISTS bed_no         text,
  ADD COLUMN IF NOT EXISTS class_code     text,
  ADD COLUMN IF NOT EXISTS status         text default 'Kosong',
  ADD COLUMN IF NOT EXISTS current_stay_id bigint,
  ADD COLUMN IF NOT EXISTS gender_lock    text,   -- terisi pria/wanita, untuk ruang campur
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS is_active      boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

CREATE INDEX IF NOT EXISTS idx_inp_bed_ward   ON public.inpatient_beds(ward_id, room_no, bed_no);
CREATE INDEX IF NOT EXISTS idx_inp_bed_status ON public.inpatient_beds(status);

DO $$ BEGIN
  ALTER TABLE public.inpatient_beds ADD CONSTRAINT uq_inp_bed UNIQUE (ward_id, room_no, bed_no);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════════
-- EPISODE RAWAT INAP
-- ══════════════════════════════════════════════════════════════
-- status: Dirawat | Pulang | Dirujuk | Meninggal | Pulang APS
CREATE TABLE IF NOT EXISTS public.inpatient_stays (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inpatient_stays
  ADD COLUMN IF NOT EXISTS stay_number    text,
  ADD COLUMN IF NOT EXISTS admission_id   bigint,
  ADD COLUMN IF NOT EXISTS mr_number      text,
  ADD COLUMN IF NOT EXISTS patient_name   text,
  ADD COLUMN IF NOT EXISTS patient_gender text,
  ADD COLUMN IF NOT EXISTS patient_dob    date,
  ADD COLUMN IF NOT EXISTS patient_age    integer,
  ADD COLUMN IF NOT EXISTS bed_id         bigint,
  ADD COLUMN IF NOT EXISTS ward_id        bigint,
  ADD COLUMN IF NOT EXISTS ward_name      text,
  ADD COLUMN IF NOT EXISTS room_no        text,
  ADD COLUMN IF NOT EXISTS bed_no         text,
  ADD COLUMN IF NOT EXISTS class_code     text,
  ADD COLUMN IF NOT EXISTS room_rate      numeric default 0,  -- tarif berjalan, ikut berubah saat pindah kelas
  ADD COLUMN IF NOT EXISTS dpjp_id        bigint,
  ADD COLUMN IF NOT EXISTS dpjp_name      text,
  ADD COLUMN IF NOT EXISTS admit_diagnosis text,
  ADD COLUMN IF NOT EXISTS admit_icd      text,
  ADD COLUMN IF NOT EXISTS admit_source   text default 'Poliklinik', -- Poliklinik | IGD | Rujukan | Kamar Bersalin
  ADD COLUMN IF NOT EXISTS admitted_at    timestamp default now(),
  ADD COLUMN IF NOT EXISTS discharged_at  timestamp,
  ADD COLUMN IF NOT EXISTS status         text default 'Dirawat',
  ADD COLUMN IF NOT EXISTS total_charges  numeric default 0,
  ADD COLUMN IF NOT EXISTS guarantor      text default 'Umum',  -- Umum | BPJS | Asuransi | Korporat
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS admitted_by    text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

CREATE INDEX IF NOT EXISTS idx_inp_stay_status ON public.inpatient_stays(status, admitted_at);
CREATE INDEX IF NOT EXISTS idx_inp_stay_mr     ON public.inpatient_stays(mr_number);
CREATE INDEX IF NOT EXISTS idx_inp_stay_adm    ON public.inpatient_stays(admission_id);

-- Lapis pengaman: satu tempat tidur hanya boleh punya satu episode berjalan,
-- dan satu pendaftaran hanya boleh punya satu episode berjalan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inp_stay_bed_active
  ON public.inpatient_stays(bed_id) WHERE status = 'Dirawat';
CREATE UNIQUE INDEX IF NOT EXISTS uq_inp_stay_adm_active
  ON public.inpatient_stays(admission_id) WHERE status = 'Dirawat';

-- Penanda pada pendaftaran agar modul lain tahu pasien sedang dirawat inap
ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS is_inpatient      boolean default false,
  ADD COLUMN IF NOT EXISTS inpatient_stay_id bigint;

-- ══════════════════════════════════════════════════════════════
-- RIWAYAT PINDAH RUANG
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inpatient_transfers (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inpatient_transfers
  ADD COLUMN IF NOT EXISTS stay_id      bigint,
  ADD COLUMN IF NOT EXISTS from_bed_id  bigint,
  ADD COLUMN IF NOT EXISTS to_bed_id    bigint,
  ADD COLUMN IF NOT EXISTS from_label   text,   -- "Melati / 201 / A (Kelas 2)"
  ADD COLUMN IF NOT EXISTS to_label     text,
  ADD COLUMN IF NOT EXISTS from_class   text,
  ADD COLUMN IF NOT EXISTS to_class     text,
  ADD COLUMN IF NOT EXISTS reason       text,
  ADD COLUMN IF NOT EXISTS moved_at     timestamp default now(),
  ADD COLUMN IF NOT EXISTS moved_by     text;

CREATE INDEX IF NOT EXISTS idx_inp_trf_stay ON public.inpatient_transfers(stay_id, moved_at);

-- ══════════════════════════════════════════════════════════════
-- RINCIAN BIAYA
-- ══════════════════════════════════════════════════════════════
-- charge_type: Kamar | Visite | Tindakan | Obat & BHP | Penunjang | Lain-lain
CREATE TABLE IF NOT EXISTS public.inpatient_charges (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inpatient_charges
  ADD COLUMN IF NOT EXISTS stay_id     bigint,
  ADD COLUMN IF NOT EXISTS charge_date date default current_date,
  ADD COLUMN IF NOT EXISTS charge_type text default 'Tindakan',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS qty         numeric default 1,
  ADD COLUMN IF NOT EXISTS unit_price  numeric default 0,
  ADD COLUMN IF NOT EXISTS amount      numeric default 0,
  ADD COLUMN IF NOT EXISTS source      text default 'manual',  -- manual | otomatis
  ADD COLUMN IF NOT EXISTS ref_table   text,
  ADD COLUMN IF NOT EXISTS ref_id      bigint,
  ADD COLUMN IF NOT EXISTS posted_by   text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();

CREATE INDEX IF NOT EXISTS idx_inp_chg_stay ON public.inpatient_charges(stay_id, charge_date);

-- Biaya kamar tepat satu baris per hari menginap. Indeks ini yang membuat
-- pembentukan biaya kamar dapat dijalankan berulang tanpa menggandakan tagihan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inp_chg_room
  ON public.inpatient_charges(stay_id, charge_date) WHERE charge_type = 'Kamar';

-- ══════════════════════════════════════════════════════════════
-- RESUME PULANG
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inpatient_discharges (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inpatient_discharges
  ADD COLUMN IF NOT EXISTS stay_id            bigint,
  ADD COLUMN IF NOT EXISTS discharge_type     text default 'Pulang',  -- Pulang | Dirujuk | Meninggal | Pulang APS
  ADD COLUMN IF NOT EXISTS final_diagnosis    text,
  ADD COLUMN IF NOT EXISTS final_icd          text,
  ADD COLUMN IF NOT EXISTS secondary_diagnosis text,
  ADD COLUMN IF NOT EXISTS procedures         text,   -- tindakan selama dirawat
  ADD COLUMN IF NOT EXISTS treatment_summary  text,   -- ringkasan perawatan
  ADD COLUMN IF NOT EXISTS lab_summary        text,
  ADD COLUMN IF NOT EXISTS discharge_medication text,
  ADD COLUMN IF NOT EXISTS discharge_instruction text, -- instruksi pulang
  ADD COLUMN IF NOT EXISTS condition_on_discharge text, -- Sembuh | Membaik | Belum Sembuh | Meninggal
  ADD COLUMN IF NOT EXISTS follow_up_date     date,
  ADD COLUMN IF NOT EXISTS follow_up_place    text,
  ADD COLUMN IF NOT EXISTS referred_to        text,
  ADD COLUMN IF NOT EXISTS doctor_name        text,
  ADD COLUMN IF NOT EXISTS signed_at          timestamp,
  ADD COLUMN IF NOT EXISTS updated_at         timestamp default now();

CREATE INDEX IF NOT EXISTS idx_inp_dis_stay ON public.inpatient_discharges(stay_id);

-- ══════════════════════════════════════════════════════════════
-- AKUNTANSI — pemetaan akun untuk tagihan rawat inap
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.cost_centers (code, name, unit_type)
SELECT 'CC-RI','Rawat Inap','Pendapatan'
WHERE NOT EXISTS (SELECT 1 FROM public.cost_centers x WHERE x.code = 'CC-RI');

INSERT INTO public.gl_mappings (event_key, debit_code, credit_code, description)
SELECT 'inpatient.bill','1-1310','4-1100','Tagihan rawat inap saat pasien pulang'
WHERE NOT EXISTS (SELECT 1 FROM public.gl_mappings g WHERE g.event_key = 'inpatient.bill');

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: penolong internal
-- ══════════════════════════════════════════════════════════════
-- Peran yang boleh mengerjakan alur rawat inap. Peran "viewer" hanya membaca.
CREATE OR REPLACE FUNCTION public.inp_assert_staff()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  v_role := public.current_app_role();
  IF v_role IN ('viewer','') OR v_role IS NULL THEN
    RAISE EXCEPTION 'Peran % tidak berwenang mengubah data rawat inap', coalesce(v_role,'(kosong)');
  END IF;
  RETURN v_role;
END $$;

-- Label tempat tidur yang terbaca manusia, dipakai di riwayat pindah ruang
CREATE OR REPLACE FUNCTION public.inp_bed_label(p_bed_id bigint)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' / ', w.name, nullif(b.room_no,''), b.bed_no)
         || coalesce(' (Kelas ' || b.class_code || ')','')
  FROM inpatient_beds b LEFT JOIN inpatient_wards w ON w.id = b.ward_id
  WHERE b.id = p_bed_id
$$;

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: biaya kamar per hari menginap
-- ══════════════════════════════════════════════════════════════
-- Satu baris per tanggal, dari tanggal masuk sampai tanggal pulang (inklusif),
-- atau sampai hari ini bila pasien masih dirawat. Lama rawat minimal satu hari.
-- Tarif yang dipakai adalah tarif berjalan pada inpatient_stays.room_rate; saat
-- pindah kelas, fungsi pindah ruang menagih dulu hari-hari yang lewat dengan
-- tarif lama sebelum tarif diganti.
CREATE OR REPLACE FUNCTION public.inp_charge_room_days(p_stay_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stay  record;
  v_end   date;
  v_added int := 0;
  v_name  text := public.current_app_name();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;

  SELECT * INTO v_stay FROM inpatient_stays WHERE id = p_stay_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episode rawat inap tidak ditemukan'; END IF;

  v_end := coalesce(v_stay.discharged_at::date, current_date);
  IF v_end < v_stay.admitted_at::date THEN v_end := v_stay.admitted_at::date; END IF;

  INSERT INTO inpatient_charges
    (stay_id, charge_date, charge_type, description, qty, unit_price, amount,
     source, posted_by, updated_at)
  SELECT p_stay_id, d::date, 'Kamar',
         concat('Kamar Kelas ', coalesce(v_stay.class_code,'-'), ' — ',
                to_char(d::date,'DD Mon YYYY')),
         1, coalesce(v_stay.room_rate,0), coalesce(v_stay.room_rate,0),
         'otomatis', v_name, now()
  FROM generate_series(v_stay.admitted_at::date, v_end, interval '1 day') AS d
  ON CONFLICT (stay_id, charge_date) WHERE charge_type = 'Kamar' DO NOTHING;

  GET DIAGNOSTICS v_added = ROW_COUNT;

  UPDATE inpatient_stays
     SET total_charges = (SELECT coalesce(sum(amount),0) FROM inpatient_charges WHERE stay_id = p_stay_id),
         updated_at = now()
   WHERE id = p_stay_id;

  RETURN jsonb_build_object('ok', true, 'hari_baru', v_added,
                            'total', (SELECT coalesce(sum(amount),0) FROM inpatient_charges WHERE stay_id = p_stay_id));
END $$;

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: admisi rawat inap
-- ══════════════════════════════════════════════════════════════
-- Seluruh langkah berada dalam satu transaksi: tempat tidur dikunci, episode
-- dibuat, tempat tidur ditandai Terisi, biaya kamar hari pertama dibentuk.
CREATE OR REPLACE FUNCTION public.inp_admit_patient(
  p_admission_id bigint,
  p_bed_id       bigint,
  p_dpjp_id      bigint DEFAULT NULL,
  p_dpjp_name    text   DEFAULT NULL,
  p_diagnosis    text   DEFAULT NULL,
  p_icd          text   DEFAULT NULL,
  p_source       text   DEFAULT 'Poliklinik',
  p_guarantor    text   DEFAULT 'Umum',
  p_notes        text   DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bed   record;
  v_ward  record;
  v_cls   record;
  v_adm   record;
  v_stay  bigint;
  v_no    text;
  v_seq   int;
  v_name  text := public.current_app_name();
BEGIN
  PERFORM public.inp_assert_staff();

  SELECT * INTO v_adm FROM admissions WHERE id = p_admission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pendaftaran pasien tidak ditemukan'; END IF;

  -- Kunci tempat tidur lebih dulu. Petugas kedua menunggu di sini, lalu
  -- menemukan status sudah Terisi dan ditolak.
  SELECT * INTO v_bed FROM inpatient_beds WHERE id = p_bed_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tempat tidur tidak ditemukan'; END IF;
  IF coalesce(v_bed.is_active,true) = false THEN
    RAISE EXCEPTION 'Tempat tidur sedang dinonaktifkan';
  END IF;
  IF v_bed.status <> 'Kosong' THEN
    RAISE EXCEPTION 'Tempat tidur % sedang berstatus %', public.inp_bed_label(p_bed_id), v_bed.status;
  END IF;

  IF EXISTS (SELECT 1 FROM inpatient_stays
             WHERE admission_id = p_admission_id AND status = 'Dirawat') THEN
    RAISE EXCEPTION 'Pasien ini masih punya episode rawat inap yang berjalan';
  END IF;

  SELECT * INTO v_ward FROM inpatient_wards WHERE id = v_bed.ward_id;
  SELECT * INTO v_cls  FROM inpatient_classes WHERE code = v_bed.class_code;

  -- Nomor episode: RI + tanggal + urutan harian
  PERFORM pg_advisory_xact_lock(hashtext('inp_stay' || current_date::text));
  SELECT count(*) + 1 INTO v_seq FROM inpatient_stays WHERE created_at::date = current_date;
  v_no := 'RI' || to_char(now(),'YYMMDD') || lpad(v_seq::text, 3, '0');

  INSERT INTO inpatient_stays
    (stay_number, admission_id, mr_number, patient_name, patient_gender, patient_dob,
     patient_age, bed_id, ward_id, ward_name, room_no, bed_no, class_code, room_rate,
     dpjp_id, dpjp_name, admit_diagnosis, admit_icd, admit_source, guarantor,
     admitted_at, status, notes, admitted_by, updated_at)
  VALUES
    (v_no, p_admission_id, v_adm.mr_number, v_adm.patient_name, v_adm.patient_gender,
     v_adm.patient_dob, v_adm.patient_age, p_bed_id, v_bed.ward_id, v_ward.name,
     v_bed.room_no, v_bed.bed_no, v_bed.class_code, coalesce(v_cls.room_rate,0),
     p_dpjp_id, p_dpjp_name, p_diagnosis, p_icd, coalesce(p_source,'Poliklinik'),
     coalesce(p_guarantor,'Umum'), now(), 'Dirawat', p_notes, v_name, now())
  RETURNING id INTO v_stay;

  UPDATE inpatient_beds
     SET status = 'Terisi', current_stay_id = v_stay,
         gender_lock = v_adm.patient_gender, updated_at = now()
   WHERE id = p_bed_id;

  UPDATE admissions
     SET is_inpatient = true, inpatient_stay_id = v_stay, updated_at = now()
   WHERE id = p_admission_id;

  -- Diagnosis masuk ikut tercatat di daftar diagnosis pasien
  IF coalesce(trim(p_diagnosis),'') <> '' THEN
    INSERT INTO icd_diagnostics (admission_id, mr_number, icd_code, diagnose_name, is_primary)
    VALUES (p_admission_id, v_adm.mr_number, p_icd, p_diagnosis, true);
  END IF;

  PERFORM public.inp_charge_room_days(v_stay);

  PERFORM public.write_audit('inpatient_admit','inpatient_stays', v_stay::text,
    concat('Admisi rawat inap ', v_no, ' — ', v_adm.patient_name, ' di ',
           public.inp_bed_label(p_bed_id)),
    v_adm.patient_name);

  RETURN jsonb_build_object('ok', true, 'stay_id', v_stay, 'stay_number', v_no,
                            'bed', public.inp_bed_label(p_bed_id));
END $$;

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: pindah ruang
-- ══════════════════════════════════════════════════════════════
-- Tempat tidur lama dibebaskan dan tempat tidur baru diisi dalam satu
-- transaksi. Kedua baris dikunci berurutan menurut id agar dua perpindahan
-- yang bersilangan tidak saling mengunci selamanya.
CREATE OR REPLACE FUNCTION public.inp_transfer_bed(
  p_stay_id   bigint,
  p_to_bed_id bigint,
  p_reason    text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stay  record;
  v_new   record;
  v_ward  record;
  v_cls   record;
  v_from  text;
  v_to    text;
  v_name  text := public.current_app_name();
  v_id    bigint;
BEGIN
  PERFORM public.inp_assert_staff();

  SELECT * INTO v_stay FROM inpatient_stays WHERE id = p_stay_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episode rawat inap tidak ditemukan'; END IF;
  IF v_stay.status <> 'Dirawat' THEN
    RAISE EXCEPTION 'Pasien sudah tidak dirawat (status: %)', v_stay.status;
  END IF;
  IF v_stay.bed_id = p_to_bed_id THEN
    RAISE EXCEPTION 'Tempat tidur tujuan sama dengan tempat tidur sekarang';
  END IF;

  -- Kunci kedua tempat tidur menurut urutan id
  FOR v_id IN SELECT unnest(ARRAY[v_stay.bed_id, p_to_bed_id]) ORDER BY 1 LOOP
    PERFORM 1 FROM inpatient_beds WHERE id = v_id FOR UPDATE;
  END LOOP;

  SELECT * INTO v_new FROM inpatient_beds WHERE id = p_to_bed_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tempat tidur tujuan tidak ditemukan'; END IF;
  IF v_new.status <> 'Kosong' THEN
    RAISE EXCEPTION 'Tempat tidur tujuan sedang berstatus %', v_new.status;
  END IF;

  -- Hari-hari yang sudah lewat ditagih dengan tarif kelas lama lebih dulu
  PERFORM public.inp_charge_room_days(p_stay_id);
  SELECT * INTO v_stay FROM inpatient_stays WHERE id = p_stay_id;

  v_from := public.inp_bed_label(v_stay.bed_id);
  v_to   := public.inp_bed_label(p_to_bed_id);

  SELECT * INTO v_ward FROM inpatient_wards   WHERE id   = v_new.ward_id;
  SELECT * INTO v_cls  FROM inpatient_classes WHERE code = v_new.class_code;

  -- Tempat tidur lama: dibebaskan, ditandai perlu dibersihkan
  UPDATE inpatient_beds
     SET status = 'Dibersihkan', current_stay_id = NULL, gender_lock = NULL, updated_at = now()
   WHERE id = v_stay.bed_id;

  UPDATE inpatient_beds
     SET status = 'Terisi', current_stay_id = p_stay_id,
         gender_lock = v_stay.patient_gender, updated_at = now()
   WHERE id = p_to_bed_id;

  UPDATE inpatient_stays
     SET bed_id = p_to_bed_id, ward_id = v_new.ward_id, ward_name = v_ward.name,
         room_no = v_new.room_no, bed_no = v_new.bed_no, class_code = v_new.class_code,
         room_rate = coalesce(v_cls.room_rate, v_stay.room_rate), updated_at = now()
   WHERE id = p_stay_id;

  INSERT INTO inpatient_transfers
    (stay_id, from_bed_id, to_bed_id, from_label, to_label, from_class, to_class,
     reason, moved_at, moved_by)
  VALUES
    (p_stay_id, v_stay.bed_id, p_to_bed_id, v_from, v_to, v_stay.class_code,
     v_new.class_code, p_reason, now(), v_name);

  PERFORM public.write_audit('inpatient_transfer','inpatient_stays', p_stay_id::text,
    concat('Pindah ruang ', v_stay.patient_name, ': ', v_from, ' → ', v_to),
    v_stay.patient_name);

  RETURN jsonb_build_object('ok', true, 'dari', v_from, 'ke', v_to);
END $$;

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: catat biaya
-- ══════════════════════════════════════════════════════════════
-- Baris biaya kamar dibentuk otomatis, jadi tidak boleh ditambah dari sini.
CREATE OR REPLACE FUNCTION public.inp_add_charge(
  p_stay_id     bigint,
  p_charge_type text,
  p_description text,
  p_qty         numeric DEFAULT 1,
  p_unit_price  numeric DEFAULT 0,
  p_charge_date date    DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stay record; v_id bigint; v_amt numeric;
  v_name text := public.current_app_name();
BEGIN
  PERFORM public.inp_assert_staff();

  IF p_charge_type = 'Kamar' THEN
    RAISE EXCEPTION 'Biaya kamar dibentuk otomatis per hari menginap';
  END IF;
  IF coalesce(trim(p_description),'') = '' THEN
    RAISE EXCEPTION 'Keterangan biaya wajib diisi';
  END IF;

  SELECT * INTO v_stay FROM inpatient_stays WHERE id = p_stay_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episode rawat inap tidak ditemukan'; END IF;
  IF v_stay.status <> 'Dirawat' THEN
    RAISE EXCEPTION 'Episode sudah ditutup, biaya tidak dapat ditambah';
  END IF;

  v_amt := coalesce(p_qty,1) * coalesce(p_unit_price,0);

  INSERT INTO inpatient_charges
    (stay_id, charge_date, charge_type, description, qty, unit_price, amount,
     source, posted_by, updated_at)
  VALUES
    (p_stay_id, coalesce(p_charge_date, current_date), p_charge_type, p_description,
     coalesce(p_qty,1), coalesce(p_unit_price,0), v_amt, 'manual', v_name, now())
  RETURNING id INTO v_id;

  UPDATE inpatient_stays
     SET total_charges = (SELECT coalesce(sum(amount),0) FROM inpatient_charges WHERE stay_id = p_stay_id),
         updated_at = now()
   WHERE id = p_stay_id;

  PERFORM public.write_audit('inpatient_charge','inpatient_charges', v_id::text,
    concat('Biaya rawat inap ', p_charge_type, ': ', p_description, ' — ', v_amt),
    v_stay.patient_name);

  RETURN jsonb_build_object('ok', true, 'charge_id', v_id, 'amount', v_amt);
END $$;

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: ubah status tempat tidur
-- ══════════════════════════════════════════════════════════════
-- Terisi hanya boleh datang dari admisi atau pindah ruang, dan tempat tidur
-- yang sedang dipakai pasien tidak boleh dialihkan begitu saja.
CREATE OR REPLACE FUNCTION public.inp_set_bed_status(
  p_bed_id bigint, p_status text, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bed record;
BEGIN
  PERFORM public.inp_assert_staff();

  IF p_status NOT IN ('Kosong','Perbaikan','Dibersihkan') THEN
    RAISE EXCEPTION 'Status % tidak dapat diatur manual', p_status;
  END IF;

  SELECT * INTO v_bed FROM inpatient_beds WHERE id = p_bed_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tempat tidur tidak ditemukan'; END IF;

  IF EXISTS (SELECT 1 FROM inpatient_stays
             WHERE bed_id = p_bed_id AND status = 'Dirawat') THEN
    RAISE EXCEPTION 'Tempat tidur sedang ditempati pasien. Pulangkan atau pindahkan dulu.';
  END IF;

  UPDATE inpatient_beds
     SET status = p_status, current_stay_id = NULL, gender_lock = NULL,
         notes = coalesce(p_notes, notes), updated_at = now()
   WHERE id = p_bed_id;

  PERFORM public.write_audit('inpatient_bed_status','inpatient_beds', p_bed_id::text,
    concat('Status tempat tidur ', public.inp_bed_label(p_bed_id), ' → ', p_status), NULL);

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END $$;

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: pulangkan pasien + resume pulang
-- ══════════════════════════════════════════════════════════════
-- Biaya kamar dilengkapi, resume disimpan, episode ditutup, tempat tidur
-- dibebaskan — semuanya dalam satu transaksi.
--
-- Pencatatan jurnal sengaja dibungkus penanganan galat: kegagalan akuntansi
-- (mis. periode sudah ditutup) tidak boleh menahan pasien di tempat tidur.
-- Kegagalan itu dikembalikan sebagai peringatan agar bagian keuangan menyusul.
CREATE OR REPLACE FUNCTION public.inp_discharge_patient(
  p_stay_id        bigint,
  p_discharge_type text DEFAULT 'Pulang',
  p_final_diagnosis text DEFAULT NULL,
  p_final_icd      text DEFAULT NULL,
  p_secondary      text DEFAULT NULL,
  p_procedures     text DEFAULT NULL,
  p_summary        text DEFAULT NULL,
  p_medication     text DEFAULT NULL,
  p_instruction    text DEFAULT NULL,
  p_condition      text DEFAULT 'Membaik',
  p_follow_up_date date DEFAULT NULL,
  p_referred_to    text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stay   record;
  v_status text;
  v_total  numeric;
  v_days   int;
  v_warn   text := NULL;
  v_dis    bigint;
  v_name   text := public.current_app_name();
BEGIN
  PERFORM public.inp_assert_staff();

  IF p_discharge_type NOT IN ('Pulang','Dirujuk','Meninggal','Pulang APS') THEN
    RAISE EXCEPTION 'Cara pulang % tidak dikenal', p_discharge_type;
  END IF;
  IF coalesce(trim(p_final_diagnosis),'') = '' THEN
    RAISE EXCEPTION 'Diagnosis akhir wajib diisi pada resume pulang';
  END IF;

  SELECT * INTO v_stay FROM inpatient_stays WHERE id = p_stay_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episode rawat inap tidak ditemukan'; END IF;
  IF v_stay.status <> 'Dirawat' THEN
    RAISE EXCEPTION 'Episode sudah ditutup pada % (status: %)',
      to_char(v_stay.discharged_at,'DD Mon YYYY HH24:MI'), v_stay.status;
  END IF;

  v_status := CASE p_discharge_type
                WHEN 'Dirujuk'     THEN 'Dirujuk'
                WHEN 'Meninggal'   THEN 'Meninggal'
                WHEN 'Pulang APS'  THEN 'Pulang APS'
                ELSE 'Pulang' END;

  -- Tutup episode dulu supaya biaya kamar berhenti pada tanggal hari ini
  UPDATE inpatient_stays
     SET status = v_status, discharged_at = now(), updated_at = now()
   WHERE id = p_stay_id;

  PERFORM public.inp_charge_room_days(p_stay_id);

  SELECT coalesce(sum(amount),0) INTO v_total FROM inpatient_charges WHERE stay_id = p_stay_id;
  SELECT count(*) INTO v_days FROM inpatient_charges
   WHERE stay_id = p_stay_id AND charge_type = 'Kamar';

  INSERT INTO inpatient_discharges
    (stay_id, discharge_type, final_diagnosis, final_icd, secondary_diagnosis,
     procedures, treatment_summary, discharge_medication, discharge_instruction,
     condition_on_discharge, follow_up_date, referred_to, doctor_name, signed_at, updated_at)
  VALUES
    (p_stay_id, p_discharge_type, p_final_diagnosis, p_final_icd, p_secondary,
     p_procedures, p_summary, p_medication, p_instruction,
     coalesce(p_condition,'Membaik'), p_follow_up_date, p_referred_to,
     coalesce(v_stay.dpjp_name, v_name), now(), now())
  RETURNING id INTO v_dis;

  -- Tempat tidur dibebaskan, menunggu dibersihkan
  UPDATE inpatient_beds
     SET status = 'Dibersihkan', current_stay_id = NULL, gender_lock = NULL, updated_at = now()
   WHERE id = v_stay.bed_id;

  UPDATE admissions SET is_inpatient = false, updated_at = now()
   WHERE id = v_stay.admission_id;

  -- Diagnosis akhir masuk daftar diagnosis pasien
  IF v_stay.admission_id IS NOT NULL THEN
    INSERT INTO icd_diagnostics (admission_id, mr_number, icd_code, diagnose_name, is_primary)
    VALUES (v_stay.admission_id, v_stay.mr_number, p_final_icd, p_final_diagnosis, true);
  END IF;

  UPDATE inpatient_stays SET total_charges = v_total, updated_at = now() WHERE id = p_stay_id;

  BEGIN
    IF v_total > 0 THEN
      PERFORM public.post_journal('inpatient.bill', v_total,
        concat('Tagihan rawat inap ', v_stay.stay_number, ' — ', v_stay.patient_name),
        'inpatient', p_stay_id, 'CC-RI', current_date);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_warn := concat('Jurnal tagihan belum tercatat: ', SQLERRM);
  END;

  PERFORM public.write_audit('inpatient_discharge','inpatient_stays', p_stay_id::text,
    concat(p_discharge_type, ' — ', v_stay.patient_name, ' (', v_stay.stay_number,
           '), ', v_days, ' hari rawat, tagihan ', v_total),
    v_stay.patient_name);

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'hari_rawat', v_days,
                            'total', v_total, 'discharge_id', v_dis, 'warning', v_warn);
END $$;

-- ══════════════════════════════════════════════════════════════
-- RLS & perizinan
-- ══════════════════════════════════════════════════════════════
-- Master ruang, kelas, dan tempat tidur tidak memuat data pasien.
ALTER TABLE public.inpatient_classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inpatient_wards   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inpatient_beds    DISABLE ROW LEVEL SECURITY;

-- Tabel berisi data pasien: seluruh kebijakan lama dihapus lebih dulu, termasuk
-- kebijakan USING(true) untuk PUBLIC yang pernah membocorkan data.
DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['inpatient_stays','inpatient_transfers',
                           'inpatient_charges','inpatient_discharges'] LOOP
    FOR pol IN SELECT p.polname FROM pg_policy p
               JOIN pg_class c ON c.oid = p.polrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = t
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, t); END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                    USING (true) WITH CHECK (true)', t||'_authenticated', t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.inp_assert_staff()            FROM public, anon;
REVOKE ALL ON FUNCTION public.inp_bed_label(bigint)         FROM public, anon;
REVOKE ALL ON FUNCTION public.inp_charge_room_days(bigint)  FROM public, anon;
REVOKE ALL ON FUNCTION public.inp_admit_patient(bigint,bigint,bigint,text,text,text,text,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.inp_transfer_bed(bigint,bigint,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.inp_add_charge(bigint,text,text,numeric,numeric,date) FROM public, anon;
REVOKE ALL ON FUNCTION public.inp_set_bed_status(bigint,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.inp_discharge_patient(bigint,text,text,text,text,text,text,text,text,text,date,text) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.inp_assert_staff()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.inp_bed_label(bigint)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.inp_charge_room_days(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inp_admit_patient(bigint,bigint,bigint,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inp_transfer_bed(bigint,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inp_add_charge(bigint,text,text,numeric,numeric,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inp_set_bed_status(bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inp_discharge_patient(bigint,text,text,text,text,text,text,text,text,text,date,text) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- VERIFIKASI
-- ══════════════════════════════════════════════════════════════
SELECT 'tabel' AS jenis, table_name AS nama FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN
  ('inpatient_classes','inpatient_wards','inpatient_beds','inpatient_stays',
   'inpatient_transfers','inpatient_charges','inpatient_discharges')
UNION ALL
SELECT 'fungsi', proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN
  ('inp_assert_staff','inp_bed_label','inp_charge_room_days','inp_admit_patient',
   'inp_transfer_bed','inp_add_charge','inp_set_bed_status','inp_discharge_patient')
ORDER BY 1, 2;
