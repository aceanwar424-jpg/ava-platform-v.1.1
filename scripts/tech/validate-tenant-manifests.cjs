#!/usr/bin/env node
// Validate tenant deployment manifests without reading or printing secret values.
const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '..', '..', 'config', 'tenants');
const required = ['tenant_id','display_name','core_version','deployment','features'];
const modes = new Set(['shared-core','dedicated-db','dedicated-instance']);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
let failed = false;
for (const file of files) {
  const full = path.join(dir, file);
  let c;
  try { c = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) { console.error(`${file}: invalid JSON`); failed = true; continue; }
  for (const k of required) if (!(k in c)) { console.error(`${file}: missing ${k}`); failed = true; }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.tenant_id || '')) { console.error(`${file}: invalid tenant_id`); failed = true; }
  if (!/^\d+\.\d+\.\d+$/.test(c.core_version || '')) { console.error(`${file}: invalid core_version`); failed = true; }
  const d = c.deployment || {};
  if (!modes.has(d.mode)) { console.error(`${file}: invalid deployment.mode`); failed = true; }
  for (const k of ['environment','domain','repository']) if (!d[k]) { console.error(`${file}: missing deployment.${k}`); failed = true; }
  for (const k of ['url_env','anon_key_env','service_role_key_env']) {
    if (!d.database?.[k] || !/^[A-Z][A-Z0-9_]+$/.test(d.database[k])) { console.error(`${file}: deployment.database.${k} must be an env name`); failed = true; }
  }
  if (JSON.stringify(c).match(/(password|token|secret|key|database_url)"\s*:\s*"(?![A-Z][A-Z0-9_]+")/i)) { console.error(`${file}: possible secret value in manifest`); failed = true; }
  console.log(`OK ${file}: ${c.tenant_id} / ${d.mode} / ${d.environment}`);
}
if (!files.length) { console.error('No tenant manifests found'); process.exit(1); }
if (failed) process.exit(1);
console.log(`Validated ${files.length} tenant manifest(s).`);
