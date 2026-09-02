// Inventaris kebutuhan SQL lama yang masih disebut UI. Tidak mengeksekusi SQL.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'ava-platform');
const refs = new Map();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(file); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/supabase_[A-Za-z0-9_]+\.sql/g)) {
      const name = match[0];
      if (!refs.has(name)) refs.set(name, new Set());
      refs.get(name).add(path.relative(root, file).replace(/\\/g, '/'));
    }
  }
}
function findByName(dir, name, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) findByName(file, name, found);
    else if (entry.name === name) found.push(file);
  }
  return found;
}

walk(path.join(app, 'modules'));
const missing = [];
console.log('═══ AUDIT KATALOG MIGRASI LEGACY ═══');
for (const [name, callers] of [...refs].sort(([a], [b]) => a.localeCompare(b))) {
  const files = findByName(app, name);
  const status = files.length ? 'ADA DI ARSIP' : 'HILANG';
  console.log(`${status.padEnd(12)} ${name} ← ${[...callers].join(', ')}`);
  if (!files.length) missing.push(name);
}
if (missing.length) {
  console.error(`\nGAGAL: ${missing.length} referensi SQL tidak ditemukan.`);
  process.exit(1);
}
console.log(`\nLULUS: ${refs.size} referensi SQL legacy terinventaris; tidak ada nama berkas hilang.`);
