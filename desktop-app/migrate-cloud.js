// ═══════════════════════════════════════════════════════════════════════════
// Migrasi data Supabase cloud → PGlite lokal (satu arah, idempoten).
// Menarik SEMUA tabel yang punya data & bisa dibaca anon ke DB lokal
// (desktop-app/pglite-data). Aman diulang (ON CONFLICT DO NOTHING).
// Progres ditulis ke migrate-progress.log (stdout sering block-buffered).
//   node migrate-cloud.js
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { createEngine } = require('./electron/local-engine.js');

const CLOUD_URL = 'https://rmyqzyfvlmjxtatpctks.supabase.co';
const CLOUD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXF6eWZ2bG1qeHRhdHBjdGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDQzNzIsImV4cCI6MjA5NjgyMDM3Mn0.tBVQBNH-yi9bmcpY7MRf5w-diwonMTDqwfAOs3t7YK8';
// Diturunkan dari lokasi berkas ini — jangan tulis path absolut.
const PLATFORM = process.env.ONELAB_PLATFORM_PATH ||
  path.resolve(__dirname, '..', 'onelab-platform-main', 'onelab-platform');
const DATA_DIR = path.join(__dirname, 'pglite-data');
const LOG = path.join(__dirname, 'migrate-progress.log');
const PAGE = 1000;
const H = { apikey: CLOUD_KEY, Authorization: 'Bearer ' + CLOUD_KEY };

fs.writeFileSync(LOG, '');
function log(m) { console.log(m); fs.appendFileSync(LOG, m + '\n'); }

async function fetchT(url, opts = {}, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

async function cloudCount(table) {
  try {
    const r = await fetchT(`${CLOUD_URL}/rest/v1/${table}?select=count`, { headers: { ...H, Prefer: 'count=exact' } });
    if (!r.ok) return -1;
    const cr = r.headers.get('content-range');
    return cr ? parseInt(cr.split('/')[1]) || 0 : 0;
  } catch { return -1; }
}

async function cloudPage(table, offset) {
  const r = await fetchT(`${CLOUD_URL}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`, { headers: H }, 20000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function norm(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

async function insertRows(pg, table, localCols, rows, overriding) {
  // Per-baris (multi-row VALUES memicu 'stack depth' di parser PGlite WASM).
  // OVERRIDING SYSTEM VALUE agar id 'generated always as identity' bisa diisi
  // dari cloud (menjaga integritas FK). Tanpa ini insert gagal & merusak instance.
  const ov = overriding ? 'OVERRIDING SYSTEM VALUE ' : '';
  let ok = 0;
  for (const row of rows) {
    const cols = Object.keys(row).filter(c => localCols.has(c));
    if (!cols.length) continue;
    const vals = cols.map(c => norm(row[c]));
    const ph = cols.map((_, i) => `$${i + 1}`);
    const sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) ${ov}VALUES (${ph.join(',')}) ON CONFLICT DO NOTHING`;
    try { await pg.query(sql, vals); ok++; } catch (_) {}
  }
  return ok;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

(async () => {
  log('Membuka DB lokal + memastikan skema…');
  const { pg, server } = await createEngine({ platformDir: PLATFORM, dataDir: DATA_DIR, port: 54360, log: (m) => log('  ' + m) });

  // Matikan trigger saat bulk-load: beberapa tabel (mis. ref_ranges) punya trigger
  // rekursif yang memicu 'stack depth limit exceeded' & merusak instance PGlite.
  try { await pg.exec(`SET session_replication_role = 'replica';`); log('Trigger dimatikan selama migrasi (session_replication_role=replica).'); } catch (e) { log('Gagal set replica: ' + e.message); }

  const localTables = (await pg.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows.map(r => r.tablename);
  log(`\nCek ${localTables.length} tabel di cloud (paralel)…`);

  // PASS 1: hitung count paralel (dengan timeout) → cari tabel berisi data
  const counts = await mapLimit(localTables, 12, async (t) => ({ t, c: await cloudCount(t) }));
  const nonEmpty = counts.filter(x => x.c > 0).sort((a, b) => b.c - a.c);
  log(`Tabel berisi data di cloud: ${nonEmpty.length} → ${nonEmpty.map(x => x.t + '(' + x.c + ')').join(', ')}\n`);

  // Lewati tabel referensi raksasa (outlier). Bisa dimigrasi terpisah bila perlu:
  //   ONLY=postal_codes node migrate-cloud.js
  const SKIP = new Set(process.env.ONLY ? [] : ['postal_codes']);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const toDo = nonEmpty.filter(x => (only ? only.includes(x.t) : !SKIP.has(x.t)));
  const skipped = nonEmpty.filter(x => !toDo.includes(x));
  if (skipped.length) log(`Dilewati (opsional/besar): ${skipped.map(x => x.t + '(' + x.c + ')').join(', ')}\n`);

  // PASS 2: tarik & masukkan
  let totalRows = 0, filled = 0;
  for (const { t: table, c: cnt } of toDo) {
    const colRows = (await pg.query(`SELECT column_name, is_identity, identity_generation FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table])).rows;
    const localCols = new Set(colRows.map(r => r.column_name));
    const overriding = colRows.some(r => r.is_identity === 'YES' && r.identity_generation === 'ALWAYS');
    let inserted = 0;
    try {
      for (let off = 0; off < cnt; off += PAGE) {
        const rows = await cloudPage(table, off);
        if (!rows.length) break;
        inserted += await insertRows(pg, table, localCols, rows, overriding);
      }
    } catch (e) { log(`  ! ${table}: ${String(e.message).split('\n')[0]}`); }
    let now = 0;
    try { now = (await pg.query(`SELECT count(*)::int c FROM "${table}"`)).rows[0].c; } catch (_) {}
    if (inserted > 0) { totalRows += inserted; filled++; }
    log(`  ✓ ${table.padEnd(26)} cloud=${String(cnt).padStart(5)}  +${inserted}  → lokal ${now}`);
  }

  log(`\n=== SELESAI: ${filled} tabel terisi, ${totalRows} baris dimigrasikan ===`);
  server.close();
  process.exit(0);
})().catch(e => { log('MIGRASI GAGAL: ' + (e && e.stack || e)); process.exit(1); });
