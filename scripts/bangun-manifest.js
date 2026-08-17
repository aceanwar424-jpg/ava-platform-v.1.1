// Membangkitkan js/core/modul-manifest.js : peta halaman → berkas modul.
// Modul dalam subfolder dimuat SEKELOMPOK (index.js sering memanggil fungsi
// di berkas saudaranya), modul berkas-tunggal dimuat sendiri.
const fs = require('fs'), path = require('path');
process.chdir('D:/onelab-platform-main/onelab-platform-main/onelab-platform');

// Urutan <script> di index.html menentukan urutan muat yang sudah terbukti jalan.
const html = fs.readFileSync('index.html', 'utf8');
const urutan = [...html.matchAll(/<script[^>]*src="(modules\/[^"?]+)\.js[^"]*"/g)].map(m => m[1] + '.js');

const router = fs.readFileSync('js/core/router.js', 'utf8');
const pageFn = {};
for (const m of router.matchAll(/case '([a-z0-9-]+)':\s*safeRun\('([a-zA-Z0-9_]+)'/g)) pageFn[m[1]] = m[2];

const defs = {};
for (const f of urutan) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/^(?:async\s+)?function ([a-zA-Z0-9_]+)/gm)) if (!defs[m[1]]) defs[m[1]] = f;
  for (const m of s.matchAll(/^window\.([a-zA-Z0-9_]+)\s*=/gm)) if (!defs[m[1]]) defs[m[1]] = f;
}

// Modul yang WAJIB eager: dipakai sebelum navigasi pertama (boot/login/menu).
const EAGER = new Set([
  'modules/settings_users.js',        // ROLES, applyRoleMenu, loadServerAccess
  'modules/dashboard/index.js',       // halaman pertama sesudah login
  'modules/executive_dashboard.js',   // injectExecToggle dipanggil saat boot
  'modules/mou.js',                   // checkMOURenewals dipanggil saat boot
]);

const grup = (f) => {
  const d = path.dirname(f).split(path.sep).join('/');
  return d === 'modules' ? [f] : urutan.filter(x => x.startsWith(d + '/'));
};

const manifest = {};
for (const [pg, fn] of Object.entries(pageFn)) {
  const f = defs[fn];
  if (!f) continue;
  const daftar = grup(f).filter(x => !EAGER.has(x));
  if (daftar.length) manifest[pg] = daftar;
}

const semua = urutan.filter(f => !EAGER.has(f));
const out = `// ═══════════════════════════════════════════════════════════════
// DIBANGKITKAN OTOMATIS — jangan disunting tangan.
// Sumber: scripts/bangun-manifest.js  (jalankan ulang bila menu/route berubah)
//
// Peta halaman → berkas modul untuk pemuatan saat dibutuhkan.
// Sebelumnya 82 berkas modul (3,1 MB) dimuat pada SETIAP kali aplikasi
// dibuka, bahkan ketika pengguna hanya melihat Dashboard.
// ═══════════════════════════════════════════════════════════════
window.MODUL_HALAMAN = ${JSON.stringify(manifest, null, 1)};

// Semua modul yang dapat ditunda — dipakai sebagai jaring pengaman bila
// sebuah halaman memanggil fungsi milik modul lain yang belum termuat.
window.MODUL_SEMUA = ${JSON.stringify(semua, null, 1)};
`;
fs.writeFileSync('js/core/modul-manifest.js', out);

console.log('halaman di manifest :', Object.keys(manifest).length);
console.log('berkas dapat ditunda:', semua.length, 'dari', urutan.length);
console.log('eager               :', [...EAGER].length);
const ukur = semua.reduce((s, f) => s + (fs.existsSync(f) ? fs.statSync(f).size : 0), 0);
console.log('byte yang ditunda   :', (ukur / 1048576).toFixed(2), 'MB');
