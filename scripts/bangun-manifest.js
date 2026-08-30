// Membangkitkan js/core/modul-manifest.js : peta halaman → berkas modul.
// Modul dalam subfolder dimuat SEKELOMPOK (index.js sering memanggil fungsi
// di berkas saudaranya), modul berkas-tunggal dimuat sendiri.
const fs = require('fs'), path = require('path');
const AKAR = path.resolve(__dirname, '..', 'ava-platform');
process.chdir(AKAR);

// Urutan muat.
//
// Dulu diambil dari tag <script> di index.html. Sejak modul dimuat saat
// dibutuhkan, tag itu tidak ada lagi — menjalankan generator versi lama kini
// menghasilkan manifest KOSONG dan akan mematikan seluruh halaman.
//
// Sumber urutan sekarang: manifest yang berlaku (urutan yang sudah terbukti
// jalan), lalu berkas baru di disk ditambahkan di belakang.
function urutanModul() {
  const daftar = [];
  const jalur = 'js/core/modul-manifest.js';
  if (fs.existsSync(jalur)) {
    const m = fs.readFileSync(jalur, 'utf8').match(/window\.MODUL_SEMUA\s*=\s*(\[[\s\S]*?\]);/);
    if (m) { try { daftar.push(...JSON.parse(m[1])); } catch (_) {} }
  }
  const diDisk = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) diDisk.push(p.split(path.sep).join('/'));
    }
  })('modules');

  const ada = new Set(daftar);
  for (const f of diDisk.sort()) if (!ada.has(f)) daftar.push(f);   // berkas baru
  return daftar.filter(f => fs.existsSync(f));                      // buang yang sudah terhapus
}
const urutan = urutanModul();

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
  'modules/system/settings_users.js',        // ROLES, applyRoleMenu, loadServerAccess
  'modules/dashboard/index.js',              // halaman pertama sesudah login
  'modules/dashboard/executive_dashboard.js',// injectExecToggle dipanggil saat boot
  'modules/crm/mou.js',                      // checkMOURenewals dipanggil saat boot
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
