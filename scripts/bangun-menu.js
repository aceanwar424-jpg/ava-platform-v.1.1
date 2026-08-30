#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Bangkitkan struktur menu dari config/menu.json.
//
// MENGAPA DIBANGKITKAN, BUKAN DITULIS TANGAN
// Struktur menu sebelumnya hidup di dua tempat sekaligus: FLYOUT_MENUS di
// dalam index.html dan LAPORAN_ARSITEKTUR_MENU_AVA_GLOBAL.md. Keduanya
// ditulis tangan dan sudah menyimpang — dokumennya menjanjikan pembagian
// per unit usaha, aplikasinya menampilkan semuanya di setiap subdomain.
//
// Sekarang keduanya berasal dari satu berkas.
//
// Keluaran:
//   1. ava-platform/js/core/peta-menu.js  -> dipakai aplikasi
//   2. docs/PETA-MENU.md                     -> dibaca manusia
//
// Pakai:
//   node scripts/bangun-menu.js            -> tulis keduanya
//   node scripts/bangun-menu.js --periksa  -> keluar 1 bila sudah basi
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const AKAR = path.resolve(__dirname, '..');
const SUMBER = path.join(AKAR, 'config', 'menu.json');
const PLATFORM = path.join(AKAR, 'ava-platform');
const KELUAR_JS = path.join(PLATFORM, 'js', 'core', 'peta-menu.js');
const KELUAR_MD = path.join(AKAR, 'docs', 'PETA-MENU.md');
const ROUTER = path.join(PLATFORM, 'js', 'core', 'router.js');

const peta = JSON.parse(fs.readFileSync(SUMBER, 'utf8'));

// ── Pemeriksaan: status "ada" harus benar-benar punya rute ──────────
//
// Tanpa ini, "ada" hanyalah klaim di dalam berkas konfigurasi — persis
// jenis kesenjangan antara dokumen dan kenyataan yang berkas ini dibuat
// untuk menghilangkannya.
const isiRouter = fs.readFileSync(ROUTER, 'utf8');
const rute = new Set(
  [...isiRouter.matchAll(/case '([a-z0-9_-]+)':/gi)].map((m) => m[1])
);

const galat = [];
const peringatan = [];

for (const [kunciKat, kat] of Object.entries(peta.kategori || {})) {
  for (const grup of kat.grup || []) {
    for (const m of grup.menu || []) {
      if (!m.id || !m.label) {
        galat.push(`kategori "${kunciKat}" punya menu tanpa id atau label`);
        continue;
      }
      if (!['ada', 'parsial', 'belum'].includes(m.status)) {
        galat.push(`menu "${m.id}" berstatus "${m.status}" — harus ada/parsial/belum`);
      }
      // Halaman portal konsumen bukan rute internal; wajar tidak ada di router.
      // Banyak menu bukan rute tersendiri melainkan tab di dalam halaman
      // lain. Yang diperiksa adalah halaman yang benar-benar dibuka router,
      // bukan id menunya.
      const halaman = m.rute || m.id;
      const portalKonsumen = kunciKat === 'konsumen';
      if (m.status === 'ada' && !rute.has(halaman) && !portalKonsumen) {
        peringatan.push(`"${m.id}" (${kat.label}) ditandai "ada" tetapi halaman "${halaman}" tidak punya case di router.js`);
      }
      if (m.status === 'belum' && rute.has(halaman)) {
        peringatan.push(`"${m.id}" ditandai "belum" padahal rute "${halaman}" sudah ada — perbarui statusnya`);
      }
    }
  }
}

// Setiap kategori yang dirujuk sebuah ruang harus benar-benar terdefinisi.
for (const [kunciRuang, r] of Object.entries(peta.ruang || {})) {
  for (const k of r.kategori || []) {
    if (!peta.kategori[k]) {
      galat.push(`ruang "${kunciRuang}" merujuk kategori "${k}" yang tidak ada`);
    }
  }
}

if (galat.length) {
  console.error('\nStruktur menu bermasalah:\n');
  for (const g of galat) console.error('  ✗ ' + g);
  console.error('\nTidak ada berkas yang ditulis.\n');
  process.exit(1);
}

// ── Keluaran 1: peta-menu.js ────────────────────────────────────────
const jsTeks = [
  '// ═══════════════════════════════════════════════════════════════',
  '// DIBANGKITKAN OTOMATIS dari config/menu.json — jangan disunting tangan.',
  '// Jalankan ulang: node scripts/bangun-menu.js',
  '//',
  '// Struktur menu seluruh ruang kerja. Sebelumnya ditulis tangan sebagai',
  '// FLYOUT_MENUS di dalam index.html, terpisah dari dokumen pemetaannya —',
  '// dan keduanya sudah menyimpang.',
  '// ═══════════════════════════════════════════════════════════════',
  'window.PETA_MENU = ' + JSON.stringify(
    { ruang: peta.ruang, kategori: peta.kategori }, null, 2) + ';',
  '',
  '// Kategori yang boleh tampil di sebuah ruang. Ruang dengan lihat_semua',
  '// mendapat seluruh kategori — dipakai Holding HQ.',
  'window.kategoriRuang = function (kunci) {',
  '  const r = window.PETA_MENU.ruang[kunci];',
  '  if (!r) return Object.keys(window.PETA_MENU.kategori);',
  '  if (r.lihat_semua) return Object.keys(window.PETA_MENU.kategori);',
  '  return r.kategori || [];',
  '};',
  '',
].join('\n');

// ── Keluaran 2: docs/PETA-MENU.md ───────────────────────────────────
const LENCANA = { ada: '🟢', parsial: '🟡', belum: '⚪' };
const KATA = { ada: 'ada', parsial: 'parsial', belum: 'belum dibuat' };

const baris = [];
const P = (s) => baris.push(s);

P('# PETA MENU AVA GLOBAL');
P('');
P('> **Dibangkitkan otomatis dari [`config/menu.json`](../config/menu.json).**');
P('> Jangan disunting tangan — jalankan `node scripts/bangun-menu.js`.');
P('>');
P('> Berkas ini dan menu di dalam aplikasi berasal dari sumber yang sama,');
P('> sehingga keduanya tidak bisa lagi menyimpang.');
P('');
P('Keterangan status: 🟢 ada · 🟡 sebagian · ⚪ struktur saja, belum dibuat');
P('');
P('---');
P('');

// Ringkasan ruang
P('## 1. RUANG KERJA (SUBDOMAIN)');
P('');
P('| Subdomain | Ruang | Peran | Kategori menu |');
P('|---|---|---|---|');
for (const [k, r] of Object.entries(peta.ruang)) {
  const kat = r.lihat_semua ? '**semua kategori**' : (r.kategori || []).join(', ');
  P(`| \`${r.subdomain}\` | ${r.nama} | ${r.peran} | ${kat} |`);
}
P('');

// Hitung status
let nAda = 0, nParsial = 0, nBelum = 0;
for (const kat of Object.values(peta.kategori)) {
  for (const g of kat.grup || []) {
    for (const m of g.menu || []) {
      if (m.status === 'ada') nAda++;
      else if (m.status === 'parsial') nParsial++;
      else nBelum++;
    }
  }
}
P(`**Total menu terpetakan:** ${nAda + nParsial + nBelum} — 🟢 ${nAda} ada · 🟡 ${nParsial} sebagian · ⚪ ${nBelum} belum dibuat`);
P('');
P('---');
P('');

// Detail kategori
P('## 2. STRUKTUR MENU PER KATEGORI');
P('');
for (const [kunci, kat] of Object.entries(peta.kategori)) {
  P(`### ${kat.label}`);
  P('');
  P(`\`${kunci}\``);
  if (kat.catatan) { P(''); P(`> ${kat.catatan}`); }
  P('');
  for (const g of kat.grup || []) {
    P(`**${g.nama}**`);
    P('');
    P('| | Menu | Halaman | Keterangan |');
    P('|---|---|---|---|');
    for (const m of g.menu || []) {
      const hal = m.rute && m.rute !== m.id ? `\`${m.rute}\` › ${m.id}` : `\`${m.id}\``;
      P(`| ${LENCANA[m.status]} | ${m.label} | ${hal} | ${m.ket || '—'} |`);
    }
    P('');
  }
  P('---');
  P('');
}

// Portal konsumen
P('## 3. PORTAL KONSUMEN');
P('');
P(peta.konsumen._catatan);
P('');
for (const [k, c] of Object.entries(peta.konsumen)) {
  if (k.startsWith('_')) continue;
  P(`### ${c.nama}`);
  P('');
  P(`- **Subdomain:** \`${c.subdomain}\``);
  P(`- **Cara masuk:** ${c.masuk}`);
  if (c.integrasi) P(`- **Integrasi:** ${c.integrasi}`);
  if (c.catatan) P(`- **Catatan:** ${c.catatan}`);
  P('');
  P('| | Menu | Keterangan |');
  P('|---|---|---|');
  for (const m of c.menu || []) {
    P(`| ${LENCANA[m.status]} | ${m.label} | ${m.ket || '—'} |`);
  }
  P('');
}
P('---');
P('');

// Pendukung
P('## 4. PERANGKAT PENDUKUNG');
P('');
P(peta.pendukung._catatan);
P('');
P('| | Perangkat | Subdomain | Keterangan |');
P('|---|---|---|---|');
for (const d of peta.pendukung.daftar) {
  P(`| ${LENCANA[d.status]} | ${d.nama} | \`${d.subdomain}\` | ${d.ket} |`);
}
P('');
P('---');
P('');

// Yang dihapus
P('## 5. SUBDOMAIN ALIAS');
P('');
for (const c of (peta.alias && peta.alias._catatan) || []) P(c);
P('');
P('| Subdomain | Mengarah ke ruang | Halaman awal | Keterangan |');
P('|---|---|---|---|');
for (const a of (peta.alias && peta.alias.daftar) || []) {
  P(`| \`${a.kunci}.avahealth.sbs\` | ${a.ruang} | \`${a.awal}\` | ${a.ket} |`);
}
P('');

const mdTeks = baris.join('\n') + '\n';

// ── Tulis / periksa ─────────────────────────────────────────────────
if (process.argv.includes('--periksa')) {
  const lamaJs = fs.existsSync(KELUAR_JS) ? fs.readFileSync(KELUAR_JS, 'utf8') : '';
  const lamaMd = fs.existsSync(KELUAR_MD) ? fs.readFileSync(KELUAR_MD, 'utf8') : '';
  if (lamaJs !== jsTeks || lamaMd !== mdTeks) {
    console.error('✗ peta-menu.js / docs/PETA-MENU.md sudah basi terhadap config/menu.json.');
    console.error('  Jalankan: node scripts/bangun-menu.js');
    process.exit(1);
  }
  console.log('✓ Struktur menu sesuai dengan config/menu.json.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(KELUAR_JS), { recursive: true });
fs.mkdirSync(path.dirname(KELUAR_MD), { recursive: true });
fs.writeFileSync(KELUAR_JS, jsTeks);
fs.writeFileSync(KELUAR_MD, mdTeks);

console.log(`✓ Struktur menu dibangkitkan.`);
console.log(`  ruang     : ${Object.keys(peta.ruang).length}`);
console.log(`  kategori  : ${Object.keys(peta.kategori).length}`);
console.log(`  menu      : ${nAda + nParsial + nBelum}  (ada ${nAda} · parsial ${nParsial} · belum ${nBelum})`);
console.log(`  keluaran  : js/core/peta-menu.js, docs/PETA-MENU.md`);

if (peringatan.length) {
  console.log(`\n  ${peringatan.length} hal perlu diperiksa:`);
  for (const w of peringatan) console.log('   ! ' + w);
}
