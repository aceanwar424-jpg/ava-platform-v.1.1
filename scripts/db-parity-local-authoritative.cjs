// Local-authoritative database parity audit and guarded Supabase synchronizer.
//
// Default mode is read-only. Applying changes requires:
//   --apply --confirm-local-authoritative
// and SUPABASE_SERVICE_ROLE_KEY must be supplied through the environment.
// No credentials or row data are written to the report.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.PGLITE_DATA_DIR || path.join(ROOT, 'desktop-app', 'pglite-data');
const SUPABASE_URL = (process.env.AVA_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const READ_KEY = SERVICE_KEY || process.env.AVA_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const PAGE_SIZE = 500;
const EXCLUDED = new Set(['schema_migrations', 'sync_outbox', 'sync_state']);

function arg(name) { return process.argv.includes(name); }
function option(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function fail(message) { console.error(`GAGAL: ${message}`); process.exitCode = 1; }
function canonical(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])])
  );
  return value;
}
function digest(rows) {
  const hash = crypto.createHash('sha256');
  for (const row of rows) hash.update(JSON.stringify(canonical(row)) + '\n');
  return hash.digest('hex');
}
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}`, ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} (${url})`);
  return response;
}
async function cloudRows(table, query = 'select=*') {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await request(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${query}&limit=${PAGE_SIZE}&offset=${offset}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
async function main() {
  if (!SUPABASE_URL) return fail('Set AVA_SUPABASE_URL or SUPABASE_URL.');
  if (!fs.existsSync(DATA_DIR)) return fail(`Local PGlite data directory not found: ${DATA_DIR}`);

  const { PGlite } = await import(path.join(ROOT, 'desktop-app', 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js'));
  const pg = await PGlite.create({ dataDir: DATA_DIR });
  const tables = (await pg.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `)).rows.map(row => row.table_name).filter(table => !EXCLUDED.has(table));
  const requested = option('--tables').split(',').map(x => x.trim()).filter(Boolean);
  const selected = requested.length ? tables.filter(table => requested.includes(table)) : tables;
  if (requested.some(table => !tables.includes(table))) {
    const missing = requested.filter(table => !tables.includes(table));
    throw new Error(`Local table not found: ${missing.join(', ')}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: 'local-pglite',
    dataDir: DATA_DIR,
    mode: arg('--apply') ? 'apply' : 'audit',
    tables: [],
  };
  for (const table of selected) {
    const columns = (await pg.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position
    `, [table])).rows;
    const keys = (await pg.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [table])).rows.map(row => row.column_name);
    const localCount = Number((await pg.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count);
    const entry = { table, primaryKey: keys, localCount, columns: columns.map(row => row.column_name) };
    try {
      const cloudResponse = await request(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=count`, {
        headers: { Prefer: 'count=exact' },
      });
      const range = cloudResponse.headers.get('content-range') || '';
      entry.cloudCount = range.includes('/') ? Number(range.split('/')[1]) : null;
      entry.status = entry.cloudCount === localCount ? 'count-match' : 'count-drift';
    } catch (error) {
      entry.cloudCount = null;
      entry.status = 'cloud-read-error';
      entry.error = error.message;
    }
    if (arg('--deep') && entry.status !== 'cloud-read-error') {
      const localRows = (await pg.query(`SELECT * FROM "${table}" ORDER BY ${keys.length ? keys.map(key => `"${key}"`).join(',') : '1'}`)).rows;
      const cloudRowsForTable = await cloudRows(table);
      entry.localDigest = digest(localRows);
      entry.cloudDigest = digest(cloudRowsForTable);
      if (entry.localDigest !== entry.cloudDigest) entry.status = 'row-drift';
    }
    report.tables.push(entry);
  }

  if (arg('--apply')) {
    if (!arg('--confirm-local-authoritative')) {
      throw new Error('Refusing to write cloud: add --confirm-local-authoritative.');
    }
    if (!SERVICE_KEY) throw new Error('Refusing to write cloud: SUPABASE_SERVICE_ROLE_KEY is required.');
    if (arg('--deep') === false) throw new Error('Apply requires --deep so row drift is measured before writing.');
    for (const entry of report.tables) {
      if (!entry.primaryKey.length) {
        entry.apply = 'skipped-no-primary-key';
        continue;
      }
      const rows = (await pg.query(`SELECT * FROM "${entry.table}"`)).rows;
      let written = 0;
      for (let offset = 0; offset < rows.length; offset += PAGE_SIZE) {
        const page = rows.slice(offset, offset + PAGE_SIZE);
        const response = await request(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(entry.table)}?on_conflict=${entry.primaryKey.map(encodeURIComponent).join(',')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(page),
        });
        written += page.length;
      }
      entry.apply = `upserted-${written}`;
    }
  }
  const output = option('--report', path.join(ROOT, 'db', 'parity-report.json'));
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Parity report: ${output}`);
  console.table(report.tables.map(({ table, localCount, cloudCount, status, apply }) => ({ table, localCount, cloudCount, status, apply: apply || '' })));
  if (report.tables.some(entry => entry.status === 'cloud-read-error')) process.exitCode = 2;
  await pg.close();
}

main().catch(error => { fail(error.stack || error.message || String(error)); });
