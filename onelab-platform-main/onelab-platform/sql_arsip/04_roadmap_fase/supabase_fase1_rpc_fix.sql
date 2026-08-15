-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 1 (PERBAIKAN) : tutup akses anon ke fungsi penolong
-- ──────────────────────────────────────────────────────────────
-- MASALAH YANG DIPERBAIKI
--   supabase_fase1_rpc.sql mencabut hak eksekusi dari anon untuk enam fungsi
--   utama, tetapi TIDAK untuk fungsi penolongnya. Pengujian membuktikan
--   anon masih dapat memanggil:
--
--       POST /rest/v1/rpc/write_audit  →  HTTP 204 (berhasil)
--
--   write_audit bersifat SECURITY DEFINER dan menulis ke activity_logs,
--   sehingga siapa pun yang memegang anon key dapat MEMALSUKAN entri jejak
--   audit atau membanjirinya. Itu justru meruntuhkan tujuan langkah 1.5:
--   jejak audit hanya bernilai bila tidak bisa dikarang.
--
-- YANG DILAKUKAN
--   write_audit dijadikan fungsi internal — tidak dapat dipanggil siapa pun
--   lewat REST. Keenam RPC utama tetap bisa memakainya karena berjalan
--   sebagai pemilik (SECURITY DEFINER).
--   current_app_role dan current_app_name ditutup dari anon; keduanya tidak
--   membocorkan apa pun untuk anon (hasilnya NULL), tetapi tidak ada alasan
--   membiarkannya terbuka.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── write_audit: internal saja ─────────────────────────────────
REVOKE ALL ON FUNCTION public.write_audit(text,text,text,text,text,jsonb,jsonb)
  FROM public, anon, authenticated;

-- ── Fungsi penolong: hanya pengguna yang sudah login ───────────
REVOKE ALL ON FUNCTION public.current_app_role() FROM public, anon;
REVOKE ALL ON FUNCTION public.current_app_name() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_name() TO authenticated;

-- ── Fungsi pemeriksa peran dari 1.1b, bila sudah dibuat ────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='can_access_clinical') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.can_access_clinical() FROM public, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_access_clinical() TO authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.can_access_finance()  FROM public, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_access_finance()  TO authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.can_access_hr()       FROM public, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_access_hr()       TO authenticated';
    RAISE NOTICE 'izin fungsi peran 1.1b ikut ditutup';
  END IF;
END $$;

-- ── Verifikasi: siapa saja yang boleh mengeksekusi ─────────────
SELECT p.proname AS fungsi,
       coalesce(
         (SELECT string_agg(DISTINCT a.grantee, ', ')
          FROM information_schema.routine_privileges a
          WHERE a.specific_name = p.proname || '_' || p.oid
            AND a.privilege_type = 'EXECUTE'),
         '(tidak ada — internal)') AS boleh_eksekusi
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('write_audit','current_app_role','current_app_name',
                    'approve_pr','reject_pr','adjust_stock',
                    'post_goods_issue','receive_po','finish_opname')
ORDER BY p.proname;

-- Yang benar:
--   write_audit                          → (tidak ada — internal)
--   selain itu                           → authenticated  (TANPA anon / PUBLIC)
