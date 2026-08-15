-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 3 : Rekam Medis & Alur Klinik
-- ──────────────────────────────────────────────────────────────
--   3.1  Catatan klinis SOAP / CPPT yang bisa ditulis & ditandatangani
--   3.2  Alergi, daftar masalah, tanda vital (menempel di PASIEN)
--   3.3  Diagnosis berkode ICD-10, utama vs sekunder
--   3.4  Garis waktu kunjungan
--   3.5  Antrian bernomor
--   3.6  Perjanjian / booking
--
-- TEMUAN YANG DIJAWAB (audit 18 Jul 2026):
--   modules/medrecord.js hanya 289 baris dengan 5 fungsi: cari, muat, tampilkan,
--   cetak. Tidak ada satu pun cara MENULIS catatan klinis. Tanpa ini, klaim tidak
--   dapat disusun dan kesinambungan perawatan tidak terdokumentasi.
--
-- KEPUTUSAN RANCANGAN — kenapa mr_number, bukan patient_id
--   Rekam medis dicari berdasarkan nama pasien, dan admissions memiliki
--   mr_number. Catatan yang seharusnya MENEMPEL DI PASIEN (alergi, masalah
--   kronis) di-anchor ke mr_number agar bertahan lintas kunjungan, sedangkan
--   catatan per kunjungan tetap membawa admission_id.
--
-- SUDAH ADA, tidak dibuat ulang: icd_diagnostics (admission_id, icd_code,
--   diagnose_name) — di sini hanya ditambah penanda diagnosis utama.
--
-- PRASYARAT: supabase_fase1_rpc.sql (write_audit, current_app_*).
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 3.1  CATATAN KLINIS — SOAP & CPPT
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS admission_id bigint,
  ADD COLUMN IF NOT EXISTS mr_number    text,
  ADD COLUMN IF NOT EXISTS patient_name text,
  ADD COLUMN IF NOT EXISTS note_type    text default 'SOAP',   -- SOAP | CPPT | Adendum
  ADD COLUMN IF NOT EXISTS subjective   text,
  ADD COLUMN IF NOT EXISTS objective    text,
  ADD COLUMN IF NOT EXISTS assessment   text,
  ADD COLUMN IF NOT EXISTS plan         text,
  ADD COLUMN IF NOT EXISTS author_name  text,
  ADD COLUMN IF NOT EXISTS author_role  text,   -- Dokter | Perawat | Analis | Gizi | Fisioterapis
  ADD COLUMN IF NOT EXISTS signed_at    timestamp,
  ADD COLUMN IF NOT EXISTS locked       boolean default false,
  ADD COLUMN IF NOT EXISTS parent_id    bigint, -- adendum menunjuk catatan asal
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

CREATE INDEX IF NOT EXISTS idx_cn_mr  ON public.clinical_notes(mr_number);
CREATE INDEX IF NOT EXISTS idx_cn_adm ON public.clinical_notes(admission_id);

-- Catatan yang sudah ditandatangani TIDAK BOLEH diubah diam-diam.
-- Koreksi wajib berbentuk adendum. Ini syarat rekam medis elektronik.
CREATE OR REPLACE FUNCTION public.trg_lock_signed_note()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.locked = true THEN
    -- hanya kolom updated_at yang boleh berubah (mis. penautan adendum)
    IF NEW.subjective IS DISTINCT FROM OLD.subjective
    OR NEW.objective  IS DISTINCT FROM OLD.objective
    OR NEW.assessment IS DISTINCT FROM OLD.assessment
    OR NEW.plan       IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'Catatan sudah ditandatangani dan terkunci. Buat adendum untuk koreksi.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clinical_notes_lock ON public.clinical_notes;
CREATE TRIGGER clinical_notes_lock
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_lock_signed_note();

-- Menandatangani catatan: mengunci sekaligus mencatat jejak audit
CREATE OR REPLACE FUNCTION public.sign_clinical_note(p_note_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_note record; v_name text := public.current_app_name();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  SELECT * INTO v_note FROM clinical_notes WHERE id = p_note_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catatan tidak ditemukan'; END IF;
  IF v_note.locked THEN RAISE EXCEPTION 'Catatan sudah ditandatangani'; END IF;

  UPDATE clinical_notes
    SET signed_at = now(), locked = true, author_name = coalesce(author_name, v_name),
        updated_at = now()
    WHERE id = p_note_id;

  PERFORM public.write_audit('sign','clinical_notes', p_note_id::text,
    concat('Tanda tangan catatan ', v_note.note_type, ' pasien ', v_note.patient_name),
    v_note.patient_name, NULL, jsonb_build_object('signed_by', v_name));

  RETURN jsonb_build_object('ok', true, 'signed_by', v_name);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 3.2  MENEMPEL DI PASIEN — alergi, daftar masalah, tanda vital
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.patient_allergies (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.patient_allergies
  ADD COLUMN IF NOT EXISTS mr_number  text,
  ADD COLUMN IF NOT EXISTS allergen   text,
  ADD COLUMN IF NOT EXISTS reaction   text,
  ADD COLUMN IF NOT EXISTS severity   text default 'Sedang',  -- Ringan | Sedang | Berat
  ADD COLUMN IF NOT EXISTS noted_by   text,
  ADD COLUMN IF NOT EXISTS is_active  boolean default true,
  ADD COLUMN IF NOT EXISTS notes      text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();
CREATE INDEX IF NOT EXISTS idx_alg_mr ON public.patient_allergies(mr_number);

CREATE TABLE IF NOT EXISTS public.patient_problems (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.patient_problems
  ADD COLUMN IF NOT EXISTS mr_number   text,
  ADD COLUMN IF NOT EXISTS icd_code    text,
  ADD COLUMN IF NOT EXISTS diagnosis   text,
  ADD COLUMN IF NOT EXISTS status      text default 'Aktif',   -- Aktif | Teratasi
  ADD COLUMN IF NOT EXISTS onset_date  date,
  ADD COLUMN IF NOT EXISTS resolved_at date,
  ADD COLUMN IF NOT EXISTS noted_by    text,
  ADD COLUMN IF NOT EXISTS notes       text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();
CREATE INDEX IF NOT EXISTS idx_prb_mr ON public.patient_problems(mr_number);

-- Tanda vital terstruktur — pola kolomnya sengaja disamakan dengan
-- homecare_visit_records agar tren bisa digabung lintas layanan.
CREATE TABLE IF NOT EXISTS public.vital_signs (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.vital_signs
  ADD COLUMN IF NOT EXISTS admission_id bigint,
  ADD COLUMN IF NOT EXISTS mr_number    text,
  ADD COLUMN IF NOT EXISTS bp_systolic  integer,
  ADD COLUMN IF NOT EXISTS bp_diastolic integer,
  ADD COLUMN IF NOT EXISTS pulse        integer,
  ADD COLUMN IF NOT EXISTS temperature  numeric,
  ADD COLUMN IF NOT EXISTS resp_rate    integer,
  ADD COLUMN IF NOT EXISTS spo2         integer,
  ADD COLUMN IF NOT EXISTS weight       numeric,
  ADD COLUMN IF NOT EXISTS height       numeric,
  ADD COLUMN IF NOT EXISTS bmi          numeric,
  ADD COLUMN IF NOT EXISTS recorded_by  text,
  ADD COLUMN IF NOT EXISTS recorded_at  timestamp default now();
CREATE INDEX IF NOT EXISTS idx_vs_mr ON public.vital_signs(mr_number, recorded_at);

-- ══════════════════════════════════════════════════════════════
-- 3.3  DIAGNOSIS — melengkapi icd_diagnostics yang sudah ada
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.icd_diagnostics
  ADD COLUMN IF NOT EXISTS is_primary boolean default false,
  ADD COLUMN IF NOT EXISTS mr_number  text,
  ADD COLUMN IF NOT EXISTS noted_by   text;

-- Satu kunjungan hanya boleh punya SATU diagnosis utama
CREATE OR REPLACE FUNCTION public.trg_single_primary_dx()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.icd_diagnostics SET is_primary = false
      WHERE admission_id = NEW.admission_id AND id <> NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS icd_single_primary ON public.icd_diagnostics;
CREATE TRIGGER icd_single_primary
  AFTER INSERT OR UPDATE OF is_primary ON public.icd_diagnostics
  FOR EACH ROW WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.trg_single_primary_dx();

-- ══════════════════════════════════════════════════════════════
-- 3.5  ANTRIAN BERNOMOR
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.queue_tickets (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.queue_tickets
  ADD COLUMN IF NOT EXISTS queue_date   date default current_date,
  ADD COLUMN IF NOT EXISTS queue_number text,
  ADD COLUMN IF NOT EXISTS seq          integer,
  ADD COLUMN IF NOT EXISTS service_type text,     -- Lab | Radiologi | Dokter | Kasir
  ADD COLUMN IF NOT EXISTS admission_id bigint,
  ADD COLUMN IF NOT EXISTS patient_name text,
  ADD COLUMN IF NOT EXISTS status       text default 'Menunggu', -- Menunggu | Dipanggil | Dilayani | Selesai | Lewat
  ADD COLUMN IF NOT EXISTS counter      text,
  ADD COLUMN IF NOT EXISTS called_at    timestamp,
  ADD COLUMN IF NOT EXISTS served_at    timestamp,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();
CREATE INDEX IF NOT EXISTS idx_q_day ON public.queue_tickets(queue_date, service_type, status);

-- Terbitkan nomor antrian berikutnya, tanpa bentrok saat ramai
CREATE OR REPLACE FUNCTION public.issue_queue_ticket(
  p_service text, p_patient text DEFAULT NULL, p_admission_id bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq int; v_prefix text; v_no text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;

  -- Kunci penasihat per layanan per hari: dua loket bersamaan tidak dapat
  -- nomor kembar.
  PERFORM pg_advisory_xact_lock(hashtext(p_service || current_date::text));

  SELECT coalesce(max(seq),0)+1 INTO v_seq FROM queue_tickets
    WHERE queue_date = current_date AND service_type = p_service;

  v_prefix := upper(left(regexp_replace(p_service,'[^A-Za-z]','','g'),1));
  IF v_prefix = '' THEN v_prefix := 'A'; END IF;
  v_no := v_prefix || lpad(v_seq::text, 3, '0');

  INSERT INTO queue_tickets(queue_date, queue_number, seq, service_type,
                            admission_id, patient_name, status, updated_at)
  VALUES (current_date, v_no, v_seq, p_service, p_admission_id, p_patient, 'Menunggu', now());

  RETURN jsonb_build_object('ok',true,'queue_number',v_no,'seq',v_seq);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 3.6  PERJANJIAN / BOOKING
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.appointments (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS mr_number       text,
  ADD COLUMN IF NOT EXISTS patient_name    text,
  ADD COLUMN IF NOT EXISTS patient_phone   text,
  ADD COLUMN IF NOT EXISTS service_type    text,
  ADD COLUMN IF NOT EXISTS resource        text,   -- dokter / alat / ruang
  ADD COLUMN IF NOT EXISTS scheduled_at    timestamp,
  ADD COLUMN IF NOT EXISTS duration_min    integer default 30,
  ADD COLUMN IF NOT EXISTS status          text default 'Terjadwal', -- Terjadwal | Hadir | Tidak Hadir | Batal
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp,
  ADD COLUMN IF NOT EXISTS admission_id    bigint,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS created_by      text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();
CREATE INDEX IF NOT EXISTS idx_appt_time ON public.appointments(scheduled_at, status);

-- ══════════════════════════════════════════════════════════════
-- RLS — data klinis mengikuti pola batch-1 Fase 1
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clinical_notes','patient_allergies','patient_problems','vital_signs',
    'queue_tickets','appointments'
  ] LOOP
    -- hapus SEMUA kebijakan lama, apa pun namanya (pelajaran dari patient_ids)
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

-- ── Perizinan fungsi ───────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sign_clinical_note(bigint)          FROM public, anon;
REVOKE ALL ON FUNCTION public.issue_queue_ticket(text,text,bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sign_clinical_note(bigint)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_queue_ticket(text,text,bigint) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- Verifikasi
-- ══════════════════════════════════════════════════════════════
SELECT 'tabel' AS jenis, table_name AS nama FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('clinical_notes','patient_allergies','patient_problems','vital_signs','queue_tickets','appointments')
UNION ALL
SELECT 'fungsi', proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('sign_clinical_note','issue_queue_ticket')
UNION ALL
SELECT 'pemicu', tgname FROM pg_trigger
WHERE tgname IN ('clinical_notes_lock','icd_single_primary')
ORDER BY 1,2;

-- ══════════════════════════════════════════════════════════════
-- 2.2  Home Care → rekam medis (tautan pasien)
-- ══════════════════════════════════════════════════════════════
-- Order Home Care sebelumnya terputus dari riwayat pasien. Kolom ini
-- menautkannya ke mr_number yang sama dengan rekam medis, sehingga kunjungan
-- rumah muncul di riwayat pasien bersama hasil lab dan catatan klinisnya.
ALTER TABLE public.homecare_orders
  ADD COLUMN IF NOT EXISTS mr_number text;
CREATE INDEX IF NOT EXISTS idx_hc_mr ON public.homecare_orders(mr_number);
