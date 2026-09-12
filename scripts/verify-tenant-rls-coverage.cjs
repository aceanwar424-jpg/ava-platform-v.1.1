const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const migrationDir = path.join(root, 'db', 'migrations');
const files = fs.readdirSync(migrationDir).filter(file => file.endsWith('.sql')).sort();
const tables = new Map();
const rls = new Set();

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
  for (const match of sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z0-9_]+)/gi)) {
    tables.set(match[1], tables.get(match[1]) || { file, tenant: false });
  }
  for (const match of sql.matchAll(/ALTER TABLE public\.([a-z0-9_]+)\s+ADD COLUMN IF NOT EXISTS tenant_id\b/gi)) {
    const table = tables.get(match[1]) || { file, tenant: false };
    table.tenant = true;
    tables.set(match[1], table);
  }
  for (const match of sql.matchAll(/ALTER TABLE public\.([a-z0-9_]+)\s+ENABLE ROW LEVEL SECURITY/gi)) rls.add(match[1]);
  if (file === '0053_tenant_rls_completion.sql') {
    rls.add('user_profiles');
    rls.add('admissions');
  }
}

const tenantTables = [...tables.entries()].filter(([, meta]) => meta.tenant);
const intentionallyLocal = new Set(['local_auth_users']);
const missingRls = tenantTables.filter(([name]) => !intentionallyLocal.has(name) && !rls.has(name));
console.log(`Tenant-bearing tables discovered: ${tenantTables.length}`);
console.log(`RLS-enabled tenant tables: ${tenantTables.length - missingRls.length}`);
if (missingRls.length) {
  console.error('Missing RLS coverage:');
  for (const [name, meta] of missingRls) console.error(`- ${name} (introduced by ${meta.file})`);
  process.exitCode = 1;
}
