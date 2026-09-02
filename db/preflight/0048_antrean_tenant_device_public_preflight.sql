-- READ-ONLY PREFLIGHT — 0048 antrean multi-tenant
-- Jalankan di Supabase SQL Editor STAGING sebelum migrasi 0048.
-- Tidak ada INSERT/UPDATE/DELETE/DDL dalam berkas ini.

-- 1. Fondasi wajib tersedia.
SELECT 'tables_required' AS check_name,
  array_agg(c.relname ORDER BY c.relname) AS found_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('tenants','queue_tickets','queue_config','queue_counters','queue_log');

-- 2. Tenant lokal harus ada agar data historis memiliki tujuan backfill aman.
SELECT 'local_tenant' AS check_name, id, kode, nama, is_active
FROM public.tenants
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 3. Kolom yang dipakai 0048 pada tabel tiket.
SELECT 'queue_ticket_columns' AS check_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'queue_tickets'
  AND column_name IN ('id','queue_date','queue_number','seq','service_type','patient_name','status','counter','counter_id','issued_via','kiosk_id')
ORDER BY column_name;

-- 4. Ukur data yang akan menerima tenant lokal; simpan hasil ini di tiket rilis.
SELECT 'queue_data_volume' AS check_name,
  (SELECT count(*) FROM public.queue_tickets) AS tickets,
  (SELECT count(*) FROM public.queue_config) AS configurations,
  (SELECT count(*) FROM public.queue_counters) AS counters,
  (SELECT count(*) FROM public.queue_log) AS logs;

-- 5. Daftar constraint unik lama yang akan diganti menjadi unik per tenant.
SELECT 'unique_constraints_to_review' AS check_name, c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('queue_config','queue_counters') AND con.contype = 'u'
ORDER BY c.relname, con.conname;

-- 6. Catat status RLS sebelum cutover sebagai bukti audit.
SELECT 'rls_before' AS check_name, c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('queue_tickets','queue_config','queue_counters','queue_log')
ORDER BY c.relname;

-- 7. Pastikan fungsi antrean yang akan ditimpa memang terinventarisasi.
SELECT 'queue_functions_before' AS check_name, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'issue_queue_ticket','issue_kiosk_queue_ticket','queue_panggil_berikutnya',
  'queue_panggil_ulang','queue_lewati','queue_kembalikan','queue_pindah','current_tenant_id')
ORDER BY p.proname;
