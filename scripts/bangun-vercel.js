#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Bangkitkan vercel.json dari config/domain.json.
//
// MENGAPA DIBANGKITKAN, BUKAN DITULIS TANGAN
// Satu subdomain butuh beberapa aturan rute sekaligus, dan tiap host punya
// pasangan ejaan salah ketik. Ditulis tangan, satu subdomain berarti belasan
// baris JSON yang mudah salah salin — dan salahnya baru ketahuan setelah
// deploy, ketika situs sudah 404 di depan orang lain.
//
// Di sini satu subdomain = satu entri di config/domain.json.
//
// PENTING: berkas yang sama juga dibaca server statis lokal (:5174), sehingga
// perilaku di komputer sendiri dan di produksi berasal dari satu sumber.
// Kalau keduanya dibiarkan punya konfigurasi sendiri-sendiri, "di lokal jalan
// kok" akan menjadi kalimat yang sering diucapkan.
//
// Pakai:
//   node scripts/bangun-vercel.js            → tulis vercel.json
//   node scripts/bangun-vercel.js --periksa  → hanya periksa, jangan tulis
//                                              (keluar 1 bila sudah basi)
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const AKAR = path.resolve(__dirname, '..');
const PETA = path.join(AKAR, 'config', 'domain.json');
const KELUAR = path.join(AKAR, 'vercel.json');

// Folder platform relatif terhadap akar repo. Vercel menyajikan folder ini
// sebagai akar situs; lihat docs/DEPLOY-WEB-VERCEL.md.
const FOLDER_PLATFORM = 'ava-platform';

const peta = JSON.parse(fs.readFileSync(PETA, 'utf8'));
const situs = peta.situs || [];

if (!situs.length) {
  console.error('config/domain.json tidak memuat satu pun situs.');
  process.exit(1);
}

// ── Pemeriksaan yang menolak konfigurasi mustahil ──────────────
// Lebih baik gagal di sini daripada menghasilkan vercel.json yang diterima
// Vercel tetapi mengarahkan pengunjung ke halaman yang tidak ada.
const galat = [];
const hostTerpakai = new Map();

for (const s of situs) {
  if (!s.kunci || !s.masuk || !Array.isArray(s.host) || !s.host.length) {
    galat.push(`entri "${s.kunci || '(tanpa kunci)'}" tidak lengkap (butuh kunci, host, masuk)`);
    continue;
  }

  const berkas = path.join(AKAR, FOLDER_PLATFORM, s.masuk.replace(/^\//, ''));
  if (!fs.existsSync(berkas)) {
    galat.push(`"${s.kunci}" menunjuk ${s.masuk} — berkasnya tidak ada`);
  }

  // Berkas di dalam subfolder WAJIB punya basis. Tanpa itu, saat dibuka di
  // akar subdomain, style.css dan app.js miliknya akan dicari di akar situs
  // dan halaman tampil tanpa gaya sama sekali.
  const diSubfolder = s.masuk.replace(/^\//, '').includes('/');
  if (diSubfolder && !s.basis) {
    galat.push(`"${s.kunci}" memakai berkas di subfolder (${s.masuk}) tetapi "basis" kosong — ` +
               `aset relatifnya akan gagal dimuat`);
  }
  if (s.basis && fs.existsSync(berkas)) {
    const isi = fs.readFileSync(berkas, 'utf8');
    if (!isi.includes(`<base href="${s.basis}"`)) {
      galat.push(`"${s.kunci}": ${s.masuk} belum memuat <base href="${s.basis}">`);
    }
  }

  for (const h of s.host) {
    if (hostTerpakai.has(h)) {
      galat.push(`host ${h} dipakai dua kali: "${hostTerpakai.get(h)}" dan "${s.kunci}"`);
    }
    hostTerpakai.set(h, s.kunci);
  }
}

if (galat.length) {
  console.error('\nKonfigurasi domain bermasalah:\n');
  for (const g of galat) console.error('  ✗ ' + g);
  console.error('\nvercel.json TIDAK ditulis.\n');
  process.exit(1);
}

// ── Susun aturan rute ──────────────────────────────────────────
//
// Dua aturan per host:
//   1. "/"      → berkas masuk situs itu
//   2. "/(.*)"  → berkas masuk juga, sebagai jaring untuk tautan dalam
//
// Keduanya REWRITE, bukan redirect: alamat di bilah peramban tetap bersih
// (app.avahealth.sbs/ bukan app.avahealth.sbs/apps/index.html).
//
// Vercel memeriksa berkas nyata LEBIH DULU, jadi /style.css, /js/core/api.js,
// dan /portal_korporat.html tetap tersaji apa adanya di host mana pun. Yang
// jatuh ke aturan kedua hanya jalur yang memang tidak berwujud berkas.
const rewrites = [];

for (const s of situs) {
  for (const h of s.host) {
    const has = [{ type: 'host', value: h }];
    rewrites.push({ source: '/', has, destination: s.masuk });
    rewrites.push({ source: '/(.*)', has, destination: s.masuk });
  }
}

const konfig = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  outputDirectory: FOLDER_PLATFORM,
  rewrites,
};

const teks = JSON.stringify(konfig, null, 2) + '\n';

// ══════════════════════════════════════════════════════════════════
// KELUARAN KEDUA: js/core/peta-subdomain.js
//
// index.html melayani empat subdomain sekaligus (his, lis, ops, console)
// dan harus tahu ia sedang disajikan di mana. Tanpa itu keempatnya
// menampilkan seluruh 14 rel menu dan terlihat persis sama — persis
// keluhan yang muncul saat menelusuri simulator.
//
// Pembeda sebelumnya adalah query string ?workspace= yang ditempelkan
// simulator. Itu TIDAK PERNAH berlaku di produksi: his.avahealth.sbs
// menyajikan /index.html tanpa query apa pun, sehingga di produksi keempat
// subdomain memang selalu identik sejak awal.
//
// Dibangkitkan dari config/domain.json supaya tidak ada daftar kedua yang
// bisa menyimpang — alasan yang sama dengan vercel.json.
// ══════════════════════════════════════════════════════════════════
const PETA_JS = path.join(AKAR, FOLDER_PLATFORM, 'js', 'core', 'peta-subdomain.js');

const petaSubdomain = {};
for (const s of situs) {
  if (!s.workspace && !s.awal && !s.sorot && !s.peran) continue;
  const isi = { nama: s.nama || s.kunci };
  if (s.workspace) isi.workspace = s.workspace;
  if (s.awal)      isi.awal      = s.awal;
  if (s.sorot)     isi.sorot     = s.sorot;
  if (s.peran)     isi.peran     = s.peran;

  // Didaftarkan di bawah SELURUH hostname produksi sekaligus nama lokalnya,
  // supaya pencocokan di peramban cukup satu pencarian tanpa menebak pola.
  for (const h of (s.host || [])) petaSubdomain[h] = isi;
  petaSubdomain[`${s.lokal}.localhost`] = isi;
}

const petaTeks = [
  '// ═══════════════════════════════════════════════════════════════',
  '// DIBANGKITKAN OTOMATIS dari config/domain.json — jangan disunting tangan.',
  '// Jalankan ulang: node scripts/bangun-vercel.js',
  '//',
  '// Memberi tahu index.html dan portal.html subdomain mana yang sedang',
  '// membukanya, sehingga lingkup menu dan halaman awalnya mengikuti',
  '// pembagian di config/domain.json — bukan menampilkan semuanya.',
  '// ═══════════════════════════════════════════════════════════════',
  'window.PETA_SUBDOMAIN = ' + JSON.stringify(petaSubdomain, null, 2) + ';',
  '',
  '// Mengembalikan { nama, workspace, awal, sorot, peran } untuk host ini, atau',
  '// null bila host-nya tidak terdaftar (mis. dibuka lewat 127.0.0.1 langsung).',
  'window.situsSaatIni = function () {',
  '  const h = String(location.hostname || \'\').toLowerCase();',
  '  return window.PETA_SUBDOMAIN[h] || null;',
  '};',
  '',
].join('\n');

if (process.argv.includes('--periksa')) {
  const lama = fs.existsSync(KELUAR) ? fs.readFileSync(KELUAR, 'utf8') : '';
  const lamaPeta = fs.existsSync(PETA_JS) ? fs.readFileSync(PETA_JS, 'utf8') : '';
  if (lama !== teks || lamaPeta !== petaTeks) {
    console.error('✗ vercel.json / peta-subdomain.js sudah basi terhadap config/domain.json.');
    console.error('  Jalankan: node scripts/bangun-vercel.js');
    process.exit(1);
  }
  console.log('✓ vercel.json & js/core/peta-subdomain.js sesuai dengan config/domain.json.');
  process.exit(0);
}

fs.writeFileSync(KELUAR, teks);
fs.mkdirSync(path.dirname(PETA_JS), { recursive: true });
fs.writeFileSync(PETA_JS, petaTeks);

console.log(`✓ vercel.json ditulis — ${situs.length} situs, ${hostTerpakai.size} host, ${rewrites.length} aturan\n`);
for (const s of situs) {
  console.log(`  ${String(s.kunci).padEnd(6)} ${String(s.nama).padEnd(30)} ${s.masuk}`);
  console.log(`         ${s.host.join(', ')}`);
  console.log(`         lokal: http://${s.lokal}.localhost:5174/`);
}
console.log('\nUji lokal dulu sebelum push — subdomain .localhost bekerja tanpa mengubah hosts file.');
