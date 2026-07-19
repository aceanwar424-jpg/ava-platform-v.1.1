-- ══════════════════════════════════════════════════════════════
-- OneLab — Jadikan jejak audit benar-benar hanya-tambah (append-only)
-- ──────────────────────────────────────────────────────────────
-- MASALAH
--   activity_logs adalah satu-satunya catatan "siapa melakukan apa" di
--   seluruh sistem. Tapi tabel itu tidak punya kebijakan RLS satu pun, dan
--   logActivity() di klien menulis langsung ke tabel memakai kunci anon.
--
--   Artinya siapa pun yang memegang kunci anon — yang tertanam di berkas
--   JavaScript dan karenanya dapat dibaca siapa saja yang membuka situs —
--   secara teknis dapat MENGUBAH atau MENGHAPUS baris audit.
--
--   Jejak audit yang dapat dihapus oleh orang yang diawasinya bukan jejak
--   audit. Ia hanya memberi rasa aman, dan rasa aman yang keliru lebih
--   berbahaya daripada tidak punya catatan sama sekali — karena keputusan
--   diambil dengan percaya pada sesuatu yang tidak layak dipercaya.
--
-- CARA MEMPERBAIKI
--   Penambahan tetap dibuka (semua modul harus bisa mencatat). Pengubahan
--   dan penghapusan ditutup untuk semua orang, termasuk service_role, lewat
--   pemicu yang menolak di tingkat basis data. Penutupan lewat pemicu dipilih
--   karena tidak dapat dilangkahi dengan mengganti peran atau mematikan RLS.
--
-- YANG PERLU DIKETAHUI SEBELUM MENJALANKAN
--   Sesudah ini, baris audit yang salah TIDAK dapat diperbaiki atau dihapus
--   oleh siapa pun lewat aplikasi. Itu memang tujuannya. Koreksi dilakukan
--   dengan menambah baris baru yang menjelaskan, bukan menyunting yang lama.
--   Pemilik basis data masih dapat melepas pemicunya secara sadar dan
--   sengaja lewat SQL Editor — dan pelepasan itu sendiri terlihat jelas.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Tolak pengubahan dan penghapusan di tingkat basis data ──
CREATE OR REPLACE FUNCTION public.trg_audit_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'activity_logs bersifat hanya-tambah: % ditolak. Untuk mengoreksi, tambahkan baris audit baru yang menjelaskan.',
    TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS audit_no_update ON public.activity_logs;
CREATE TRIGGER audit_no_update
  BEFORE UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_append_only();

DROP TRIGGER IF EXISTS audit_no_delete ON public.activity_logs;
CREATE TRIGGER audit_no_delete
  BEFORE DELETE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_append_only();

-- ── 2. Cabut izin lewat PostgREST ─────────────────────────────
-- Pemicu di atas sudah cukup, tapi mencabut izin membuat penolakannya
-- terjadi lebih awal dan pesannya lebih jelas (401, bukan galat pemicu).
REVOKE UPDATE, DELETE, TRUNCATE ON public.activity_logs FROM anon, authenticated;
GRANT  INSERT, SELECT                ON public.activity_logs TO anon, authenticated;

-- ── 3. Jangan biarkan waktu dan pelaku dipalsukan ─────────────
-- created_at yang dikirim klien dapat diatur sesuka hati, sehingga urutan
-- kejadian dapat diputarbalikkan. Waktu server yang dipakai, selalu.
CREATE OR REPLACE FUNCTION public.trg_audit_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.created_at := now();
  -- Bila klien tidak menyebutkan pelaku, ambil dari sesi yang sedang berjalan.
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_stamp ON public.activity_logs;
CREATE TRIGGER audit_stamp
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_stamp();

-- ── 4. Percepat penyaringan layar Jejak Audit ─────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_created  ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_table    ON public.activity_logs (table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user     ON public.activity_logs (user_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action   ON public.activity_logs (action, created_at DESC);

-- ── Verifikasi ─────────────────────────────────────────────────
-- Yang benar: tiga pemicu terdaftar (audit_no_update, audit_no_delete, audit_stamp).
SELECT tgname AS pemicu,
       CASE tgtype & 28
         WHEN  4 THEN 'INSERT' WHEN  8 THEN 'DELETE'
         WHEN 16 THEN 'UPDATE' ELSE 'lainnya' END AS pada
FROM pg_trigger
WHERE tgrelid = 'public.activity_logs'::regclass AND NOT tgisinternal
ORDER BY tgname;

-- Uji cepat (jalankan terpisah bila ingin membuktikan penolakannya):
--   DELETE FROM public.activity_logs WHERE id = -1;
--   → harus gagal dengan pesan "activity_logs bersifat hanya-tambah"
