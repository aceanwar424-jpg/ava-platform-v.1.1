// Pemeriksaan statis kontrak antrean multi-tenant. Tidak menyentuh database.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('db/migrations/0048_antrean_tenant_device_public.sql');
const edge = read('ava-platform/supabase/functions/queue-public/index.ts');
const errors = [];

for (const fragment of [
  'queue_tickets ADD COLUMN IF NOT EXISTS tenant_id',
  'queue_config ADD COLUMN IF NOT EXISTS tenant_id',
  'queue_counters ADD COLUMN IF NOT EXISTS tenant_id',
  'queue_log ADD COLUMN IF NOT EXISTS tenant_id',
  'queue_public_devices',
  'queue_public_rate_windows',
  'issue_public_queue_ticket',
  'REVOKE ALL ON public.queue_papan FROM anon',
  'CREATE OR REPLACE FUNCTION public.queue_panggil_berikutnya',
  'CREATE OR REPLACE FUNCTION public.queue_pindah',
]) if (!migration.includes(fragment)) errors.push(`Migrasi tidak memuat: ${fragment}`);

for (const fragment of ['QUEUE_PUBLIC_DEVICE_ID', 'queue_public_device_context', 'issue_public_queue_ticket', 'tenant_id=eq.', 'Origin tidak diizinkan']) {
  if (!edge.includes(fragment)) errors.push(`Edge Function tidak memuat: ${fragment}`);
}
if (edge.includes('patient_name')) errors.push('Edge Function publik masih meminta patient_name.');
if (edge.includes('const jejak')) errors.push('Rate limit memori lama masih tersisa.');
if (!migration.includes('AND tenant_id = v_tenant')) errors.push('RPC konsol belum memfilter tenant secara eksplisit.');

if (errors.length) {
  console.error('KONTRAK ANTREAN MULTI-TENANT GAGAL');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log('KONTRAK ANTREAN MULTI-TENANT LULUS — tenant, device, rate-limit, dan minimisasi data terpasang.');
