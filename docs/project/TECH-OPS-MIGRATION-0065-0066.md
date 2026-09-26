# Runbook — Aktivasi Tech Operations 0065–0066

Jalankan pada database target secara berurutan setelah backup dan checkpoint:

```sql
-- 1. buka file db/migrations/0065_tech_operations_control_plane.sql
-- 2. jalankan seluruh isi 0065
-- 3. buka file db/migrations/0066_tech_operations_transitions.sql
-- 4. jalankan seluruh isi 0066
```

Verifikasi function yang dipakai UI:

```sql
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tech_ops_record_event',
    'tech_ops_open_incident',
    'tech_ops_transition_incident',
    'tech_ops_transition_problem',
    'tech_ops_approve_change'
  )
order by p.proname, arguments;
```

Untuk pemanggilan tenant-first yang dipakai aplikasi:

```sql
select public.tech_ops_open_incident(
  '<TENANT_UUID>'::uuid,
  'INC-TEST-001',
  'P2',
  'Uji kendala penyimpanan',
  'CS-TEST-001',
  'Data tidak tersimpan setelah tombol simpan',
  null
);
```

Jangan menjalankan contoh tersebut pada production dengan data nyata tanpa mengganti UUID dan mengikuti prosedur change. Function menolak tenant mismatch dan setiap incident harus memiliki correlation ID.
