// Static/local readiness audit. It never calls Supabase, Vercel, DNS, or a backup store.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reportDir = path.join(root, 'docs', 'audit-evidence', '2026-10-02');
fs.mkdirSync(reportDir, { recursive: true });

const blockers = [];
const warnings = [];
const checks = [];
const pass = (id, detail) => checks.push({ id, status: 'PASS', detail });
const warn = (id, detail) => { checks.push({ id, status: 'WARN', detail }); warnings.push({ id, detail }); };
const block = (id, detail) => { checks.push({ id, status: 'BLOCKED', detail }); blockers.push({ id, detail }); };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const migrations = ['0065_tech_operations_control_plane.sql', '0066_tech_operations_transitions.sql',
  '0067_tech_auto_telemetry.sql', '0068_tech_deployment_center.sql', '0069_rbac_user_provisioning.sql'];
const migrationContracts = {
  '0065_tech_operations_control_plane.sql': ['tech_ops_record_event', 'tech_alerts', 'tech_incidents'],
  '0066_tech_operations_transitions.sql': ['tech_ops_open_incident', 'tech_ops_transition_incident', 'tech_ops_transition_problem'],
  '0067_tech_auto_telemetry.sql': ['tech_ops_ingest_client_error', 'CLIENT_FAILURE'],
  '0068_tech_deployment_center.sql': ['tech_ops_save_deployment'],
  '0069_rbac_user_provisioning.sql': ['create_auth_user', 'get_my_access', 'set_user_access', 'REVOKE ALL ON FUNCTION public.create_auth_user'],
};
let last = -1;
for (const name of migrations) {
  const file = path.join(root, 'db', 'migrations', name);
  if (!fs.existsSync(file)) block(`migration:${name}`, 'File migration tidak ditemukan.');
  else {
    const number = Number(name.slice(0, 4));
    if (number <= last) block(`migration-order:${name}`, 'Urutan migration tidak monoton.');
    last = number;
    pass(`migration-source:${name}`, 'Source tersedia; eksekusi target belum dibuktikan oleh audit lokal.');
    const sql = fs.readFileSync(file, 'utf8');
    for (const marker of migrationContracts[name]) {
      if (!sql.includes(marker)) block(`migration-contract:${name}:${marker}`, `Marker ${marker} tidak ditemukan.`);
    }
  }
}

for (const name of ['ahm.json', 'klinik-utama-moksa.json']) {
  const file = path.join(root, 'config', 'tenants', name);
  if (!fs.existsSync(file)) { block(`manifest:${name}`, 'Manifest tenant tidak ditemukan.'); continue; }
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const deployment = config.deployment || {};
  for (const field of ['tenant_id', 'core_version']) {
    if (!config[field]) block(`manifest:${name}:${field}`, `${field} kosong.`);
  }
  for (const field of ['domain', 'repository']) {
    if (!deployment[field] || String(deployment[field]).startsWith('REPLACE_WITH_'))
      block(`manifest:${name}:${field}`, `${field} masih placeholder; target dedicated belum siap.`);
  }
  for (const field of ['url_env', 'anon_key_env', 'service_role_key_env']) {
    if (!deployment.database?.[field]) block(`manifest:${name}:${field}`, `Referensi ${field} tidak tersedia.`);
  }
  const text = JSON.stringify(config);
  if (/(sk-[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}|password\s*[:=]\s*[^"']+)/i.test(text))
    block(`secret-scan:${name}`, 'Manifest tampak memuat nilai secret; hapus dari repo.');
  else pass(`secret-scan:${name}`, 'Tidak menemukan nilai secret pada manifest.');
}

const adapter = read('api/tech-deployment-sync.js');
if (adapter.includes('VERCEL_TOKEN') && adapter.includes('VERCEL_TEAM_ID'))
  pass('vercel-adapter-contract', 'Adapter membaca secret server-side dan mendukung team scope.');
else block('vercel-adapter-contract', 'Kontrak adapter Vercel tidak lengkap.');

const controlPlane = read('ava-platform/modules/tech-platform/techControlPlane.js');
if (controlPlane.includes('UNKNOWN') && controlPlane.includes('STALE') && controlPlane.includes('OFFLINE'))
  pass('heartbeat-honesty', 'Status heartbeat membedakan UNKNOWN/STALE/OFFLINE.');
else block('heartbeat-honesty', 'Status heartbeat tidak lengkap.');

warn('staging-runtime', 'Belum ada koneksi target; migrasi, RLS, RPC, DNS, scheduler, notification, backup, dan restore belum terbukti runtime.');
warn('live-deployment', 'Audit lokal tidak membuktikan deployment live memakai commit terbaru.');

const result = {
  generated_at: new Date().toISOString(),
  scope: 'local static readiness; no external connections',
  status: blockers.length ? 'BLOCKED_FOR_STAGING' : 'LOCAL_CONTRACT_PASS',
  checks, blockers, warnings,
};
const output = path.join(reportDir, 'release-readiness.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(`READINESS ${result.status}`);
console.log(`Checks: ${checks.filter(x => x.status === 'PASS').length} pass, ${warnings.length} warning, ${blockers.length} blocker`);
console.log(`Evidence: ${path.relative(root, output)}`);
