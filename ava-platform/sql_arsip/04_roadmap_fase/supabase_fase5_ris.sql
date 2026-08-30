-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 5.3 : RIS + PACS Rancangan Sendiri
-- ──────────────────────────────────────────────────────────────
-- KONDISI AWAL (audit 18 Jul 2026)
--   modules/radiology.js hanya 393 baris, 11 fungsi, menyimpan hasil ke tabel
--   lab_results. Isinya unggah berkas dan cetak. Tidak ada penjadwalan
--   modalitas, alur baca radiolog, maupun arsip citra.
--
-- RANCANGAN PACS SENDIRI — dan alasannya
--   PACS komersial bertumpu pada protokol DICOM di jaringan (C-STORE, C-FIND,
--   WADO). Itu menuntut server tersendiri di luar aplikasi web ini.
--
--   Untuk skala klinik, arsitektur berikut memberi manfaat terbesar dengan
--   perawatan paling sedikit:
--     · ARSIP    : Supabase Storage sebagai penyimpan berkas citra
--     · METADATA : tabel di sini — studi, seri, instans, dan tautannya ke order
--     · PENAMPIL : kanvas di browser dengan zoom, geser, window level, dan
--                  pengukuran jarak
--     · BERKAS   : simpan DUA bentuk — pratinjau (JPG/PNG) untuk dilihat cepat,
--                  dan berkas DICOM asli untuk diunduh ke workstation
--
--   Menampilkan DICOM mentah langsung di browser menuntut pustaka dekoder
--   berukuran besar. Struktur di bawah sudah menyediakan tempatnya
--   (radiology_images.dicom_path), sehingga penampil DICOM penuh dapat
--   ditambahkan kemudian tanpa mengubah skema.
--
-- PRASYARAT: supabase_fase1_rpc.sql
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- MODALITAS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.modalities (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.modalities
  ADD COLUMN IF NOT EXISTS code        text,   -- CR, DX, US, CT, MR
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS room        text,
  ADD COLUMN IF NOT EXISTS slot_minutes integer default 20,
  ADD COLUMN IF NOT EXISTS is_active   boolean default true,
  ADD COLUMN IF NOT EXISTS notes       text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();

INSERT INTO public.modalities (code, name, room, slot_minutes)
SELECT v.* FROM (VALUES
  ('CR','Radiografi Konvensional','Ruang Rontgen', 15),
  ('US','Ultrasonografi',         'Ruang USG',     30),
  ('CT','CT Scan',                'Ruang CT',      30),
  ('MR','MRI',                    'Ruang MRI',     45),
  ('PX','Panoramik Gigi',         'Ruang Dental',  15)
) AS v(code,name,room,slot_minutes)
WHERE NOT EXISTS (SELECT 1 FROM public.modalities m WHERE m.code = v.code);

-- ══════════════════════════════════════════════════════════════
-- ORDER & PENJADWALAN
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.radiology_orders (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.radiology_orders
  ADD COLUMN IF NOT EXISTS accession_no  text,   -- nomor unik studi, dipakai juga sbg folder arsip
  ADD COLUMN IF NOT EXISTS admission_id  bigint,
  ADD COLUMN IF NOT EXISTS mr_number     text,
  ADD COLUMN IF NOT EXISTS patient_name  text,
  ADD COLUMN IF NOT EXISTS patient_gender text,
  ADD COLUMN IF NOT EXISTS patient_dob   date,
  ADD COLUMN IF NOT EXISTS modality_id   bigint,
  ADD COLUMN IF NOT EXISTS modality_code text,
  ADD COLUMN IF NOT EXISTS procedure_name text,
  ADD COLUMN IF NOT EXISTS product_id    bigint,
  ADD COLUMN IF NOT EXISTS clinical_info text,   -- keterangan klinis dari perujuk
  ADD COLUMN IF NOT EXISTS referring_doctor text,
  ADD COLUMN IF NOT EXISTS priority      text default 'Rutin',   -- Rutin | Cito
  ADD COLUMN IF NOT EXISTS scheduled_at  timestamp,
  ADD COLUMN IF NOT EXISTS performed_at  timestamp,
  ADD COLUMN IF NOT EXISTS performed_by  text,
  -- Dijadwalkan → Dikerjakan → Menunggu Baca → Dibaca → Diverifikasi → Selesai
  ADD COLUMN IF NOT EXISTS status        text default 'Dijadwalkan',
  ADD COLUMN IF NOT EXISTS preparation   text,   -- persiapan pasien
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS created_by    text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

CREATE INDEX IF NOT EXISTS idx_ro_status ON public.radiology_orders(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ro_mr     ON public.radiology_orders(mr_number);

-- Nomor akses unik; dipakai sekaligus sebagai nama folder arsip citra
CREATE OR REPLACE FUNCTION public.next_accession()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq int; v_no text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('accession' || current_date::text));
  SELECT count(*) + 1 INTO v_seq FROM radiology_orders
   WHERE created_at::date = current_date;
  v_no := 'ACC' || to_char(now(),'YYMMDD') || lpad(v_seq::text, 3, '0');
  RETURN v_no;
END $$;

-- ══════════════════════════════════════════════════════════════
-- PACS — ARSIP CITRA
-- ══════════════════════════════════════════════════════════════
-- Satu order menghasilkan satu studi; satu studi berisi banyak citra.
CREATE TABLE IF NOT EXISTS public.radiology_images (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.radiology_images
  ADD COLUMN IF NOT EXISTS order_id     bigint,
  ADD COLUMN IF NOT EXISTS accession_no text,
  ADD COLUMN IF NOT EXISTS series_no    integer default 1,
  ADD COLUMN IF NOT EXISTS instance_no  integer default 1,
  ADD COLUMN IF NOT EXISTS view_label   text,    -- AP, Lateral, Oblique
  ADD COLUMN IF NOT EXISTS preview_url  text,    -- JPG/PNG untuk dilihat di browser
  ADD COLUMN IF NOT EXISTS preview_path text,
  ADD COLUMN IF NOT EXISTS dicom_path   text,    -- berkas asli, diunduh ke workstation
  ADD COLUMN IF NOT EXISTS file_size    bigint,
  ADD COLUMN IF NOT EXISTS width        integer,
  ADD COLUMN IF NOT EXISTS height       integer,
  ADD COLUMN IF NOT EXISTS uploaded_by  text,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

CREATE INDEX IF NOT EXISTS idx_rimg_order ON public.radiology_images(order_id, series_no, instance_no);

-- ══════════════════════════════════════════════════════════════
-- LAPORAN RADIOLOG
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.radiology_reports (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.radiology_reports
  ADD COLUMN IF NOT EXISTS order_id     bigint,
  ADD COLUMN IF NOT EXISTS accession_no text,
  ADD COLUMN IF NOT EXISTS technique    text,   -- teknik pemeriksaan
  ADD COLUMN IF NOT EXISTS comparison   text,   -- pembanding pemeriksaan sebelumnya
  ADD COLUMN IF NOT EXISTS findings     text,   -- temuan
  ADD COLUMN IF NOT EXISTS impression   text,   -- kesan
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS is_critical  boolean default false,
  ADD COLUMN IF NOT EXISTS critical_notified_at timestamp,
  ADD COLUMN IF NOT EXISTS critical_notified_to text,
  ADD COLUMN IF NOT EXISTS radiologist  text,
  ADD COLUMN IF NOT EXISTS read_at      timestamp,
  ADD COLUMN IF NOT EXISTS signed_at    timestamp,
  ADD COLUMN IF NOT EXISTS locked       boolean default false,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

CREATE INDEX IF NOT EXISTS idx_rrep_order ON public.radiology_reports(order_id);

-- Laporan yang sudah ditandatangani tidak boleh diubah diam-diam
CREATE OR REPLACE FUNCTION public.trg_lock_rad_report()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.locked = true THEN
    IF NEW.findings   IS DISTINCT FROM OLD.findings
    OR NEW.impression IS DISTINCT FROM OLD.impression THEN
      RAISE EXCEPTION 'Laporan sudah ditandatangani dan terkunci.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rad_report_lock ON public.radiology_reports;
CREATE TRIGGER rad_report_lock BEFORE UPDATE ON public.radiology_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_lock_rad_report();

-- ══════════════════════════════════════════════════════════════
-- DOSIS RADIASI — keperluan audit BAPETEN
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.radiology_dose (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.radiology_dose
  ADD COLUMN IF NOT EXISTS order_id   bigint,
  ADD COLUMN IF NOT EXISTS dose_value numeric,
  ADD COLUMN IF NOT EXISTS dose_unit  text default 'mGy',
  ADD COLUMN IF NOT EXISTS kvp        numeric,
  ADD COLUMN IF NOT EXISTS mas        numeric,
  ADD COLUMN IF NOT EXISTS exposures  integer default 1,
  ADD COLUMN IF NOT EXISTS recorded_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

-- ══════════════════════════════════════════════════════════════
-- FUNGSI: tandatangani laporan
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sign_rad_report(p_report_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rep record; v_name text := public.current_app_name();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  SELECT * INTO v_rep FROM radiology_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Laporan tidak ditemukan'; END IF;
  IF v_rep.locked THEN RAISE EXCEPTION 'Laporan sudah ditandatangani'; END IF;
  IF coalesce(trim(v_rep.impression),'') = '' THEN
    RAISE EXCEPTION 'Kesan (impression) wajib diisi sebelum ditandatangani';
  END IF;

  UPDATE radiology_reports
    SET signed_at = now(), locked = true,
        radiologist = coalesce(radiologist, v_name), updated_at = now()
    WHERE id = p_report_id;

  UPDATE radiology_orders SET status = 'Selesai', updated_at = now()
    WHERE id = v_rep.order_id;

  PERFORM public.write_audit('sign','radiology_reports', p_report_id::text,
    concat('Tanda tangan laporan radiologi ', coalesce(v_rep.accession_no,'')),
    v_rep.accession_no, NULL, jsonb_build_object('radiolog', v_name));

  RETURN jsonb_build_object('ok', true, 'radiolog', v_name);
END $$;

-- ══════════════════════════════════════════════════════════════
-- RLS & perizinan
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.modalities DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['radiology_orders','radiology_images','radiology_reports','radiology_dose'] LOOP
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

REVOKE ALL ON FUNCTION public.next_accession()          FROM public, anon;
REVOKE ALL ON FUNCTION public.sign_rad_report(bigint)   FROM public, anon;
GRANT EXECUTE ON FUNCTION public.next_accession()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_rad_report(bigint) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- CATATAN PENYIAPAN ARSIP CITRA
-- ══════════════════════════════════════════════════════════════
-- Buat bucket bernama "pacs" di Supabase Storage secara manual:
--   Dashboard → Storage → New bucket → nama: pacs → Public: NONAKTIF
-- Citra medis TIDAK BOLEH bersifat publik. Aplikasi mengambilnya memakai token
-- pengguna yang sedang login.
--
-- Susunan berkas yang dipakai aplikasi:
--   pacs/{accession_no}/{series}-{instance}-preview.jpg
--   pacs/{accession_no}/{series}-{instance}.dcm
-- ══════════════════════════════════════════════════════════════

SELECT 'tabel' AS jenis, table_name AS nama FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('modalities','radiology_orders','radiology_images','radiology_reports','radiology_dose')
UNION ALL
SELECT 'fungsi', proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('next_accession','sign_rad_report')
ORDER BY 1,2;
