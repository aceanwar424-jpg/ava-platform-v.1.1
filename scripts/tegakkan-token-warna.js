// ═══════════════════════════════════════════════════════════════
// Menegakkan design token: mengganti warna heksa keras di modul menjadi
// var(--token) — HANYA bila aman.
//
// Kenapa ini penting: tema gelap dan aksen futuristik menuntut warna
// terpusat. Selama 2.500 heksa tersebar di modul, mengganti tema berarti
// menyunting ribuan tempat. Dengan token, satu berkas cukup.
//
// ── Dua syarat, keduanya wajib ───────────────────────────────
// 1. Nilai heksa COCOK PERSIS dengan token di :root. Warna yang hanya
//    mirip (#dc2626 vs #ef4444) TIDAK disentuh — itu keputusan desain,
//    bukan penyeragaman mekanis, dan menyamakannya diam-diam mengubah
//    tampilan tanpa ada yang memutuskan.
// 2. Berada tepat sesudah properti CSS (`color:`, `background:`, …).
//    var() TIDAK berlaku di canvas (ctx.fillStyle) maupun atribut SVG
//    (fill="#…"); keduanya memakai `=`, sehingga pola ini melewatinya.
//
// Hasilnya nol perubahan visual: token bernilai sama persis dengan heksa
// yang digantikannya.
//
//   node scripts/tegakkan-token-warna.js --uji      (hitung saja)
//   node scripts/tegakkan-token-warna.js            (terapkan)
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');

const AKAR = path.resolve(__dirname, '..', 'onelab-platform-main', 'onelab-platform');
const HANYA_UJI = process.argv.includes('--uji');

const css = fs.readFileSync(path.join(AKAR, 'css', 'style.css'), 'utf8');
const token = {};
for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/g)) {
  const hex = m[2].toLowerCase();
  if (!token[hex]) token[hex] = m[1];
}

const PROP = '(color|background|background-color|border-color|border-top-color|' +
             'border-bottom-color|border-left-color|border-right-color|outline-color)';
const RE = new RegExp(`(${PROP}\\s*:\\s*)(#[0-9A-Fa-f]{6})\\b`, 'gi');

// Putih ditangani terpisah, dan DIBEDAKAN menurut perannya:
//   background:#fff → --white     (permukaan; ikut menggelap di tema gelap)
//   color:#fff      → --on-accent (teks di atas lencana; tetap putih)
// Menyamakan keduanya membuat teks putih di atas lencana merah berubah gelap
// saat tema gelap — tidak terbaca. 136 latar + 148 teks.
const RE_BG_PUTIH   = /((?:background|background-color)\s*:\s*)(#fff(?:fff)?|white)\b/gi;
const RE_TEKS_PUTIH = /((?<!background-)(?<!background)color\s*:\s*)(#fff(?:fff)?|white)\b/gi;

const berkas = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) berkas.push(p);
  }
})(path.join(AKAR, 'modules'));

let diganti = 0, dilewati = 0;
const perBerkas = [];

for (const f of berkas) {
  const asli = fs.readFileSync(f, 'utf8');
  let n = 0;
  const baru = asli.split('\n').map(baris => {
    // Sabuk pengaman kedua: lewati baris yang menyentuh canvas.
    if (/fillStyle|strokeStyle|getContext\(/.test(baris)) return baris;
    let b = baris.replace(RE, (utuh, awal, _prop, hex) => {
      const t = token[hex.toLowerCase()];
      if (!t) { dilewati++; return utuh; }
      n++; return `${awal}var(--${t})`;
    });
    b = b.replace(RE_BG_PUTIH,   (_u, awal) => { n++; return `${awal}var(--white)`; });
    b = b.replace(RE_TEKS_PUTIH, (_u, awal) => { n++; return `${awal}var(--on-accent)`; });
    return b;
  }).join('\n');

  if (n) {
    diganti += n;
    perBerkas.push([path.relative(AKAR, f).split(path.sep).join('/'), n]);
    if (!HANYA_UJI) fs.writeFileSync(f, baru);
  }
}

perBerkas.sort((a, b) => b[1] - a[1]);
console.log(HANYA_UJI ? '— MODE UJI (tidak ada berkas diubah) —\n' : '— DITERAPKAN —\n');
console.log('token warna tersedia :', Object.keys(token).length);
console.log('heksa diganti        :', diganti);
console.log('heksa dilewati       :', dilewati, '(tidak cocok token — dibiarkan apa adanya)');
console.log('berkas tersentuh     :', perBerkas.length);
console.log('\n10 berkas terbanyak:');
perBerkas.slice(0, 10).forEach(([f, n]) => console.log(`   ${String(n).padStart(4)}  ${f}`));
