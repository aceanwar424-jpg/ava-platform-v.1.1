#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Periksa sintaks skrip inline di dalam berkas HTML.
//
// MENGAPA ADA
// `node --check` hanya membaca berkas .js. Skrip yang ditulis langsung di
// dalam <script> pada index.html tidak pernah tersentuh, padahal di sanalah
// struktur menu, boot, dan sesi didefinisikan.
//
// Sekali waktu satu entri menu tersisip di TENGAH entri lain sehingga sebuah
// string tidak pernah ditutup. Akibatnya seluruh skrip inline — 734 baris —
// gagal diurai sekaligus. Halaman tetap terbuka dan sebagian besar aplikasi
// tetap jalan karena modul lain dimuat dari berkas terpisah, jadi tidak ada
// yang terlihat rusak. Satu-satunya tanda adalah satu baris
// "SyntaxError: Invalid or unexpected token" di konsol peramban.
//
// Kegagalan yang tidak terlihat justru yang paling mahal. Skrip ini
// membuatnya terlihat.
//
// Pakai:  node scripts/periksa-html-inline.js
// Keluar dengan kode 1 bila ada yang gagal, supaya bisa dipakai di CI.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const AKAR = path.resolve(__dirname, '..');
// 'release' dan 'win-unpacked' = keluaran electron-builder. Isinya salinan
// berkas yang sudah diperiksa dari sumbernya, plus HTML pihak ketiga dari
// Electron. Memeriksanya hanya menggandakan hasil dan menyamarkan angka.
const LEWATI = new Set(['node_modules', '.git', 'dist', 'dist-electron',
                        'build', 'backup', 'release', 'win-unpacked']);

function kumpulkanHtml(dir, hasil = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_karantina')) continue;
    if (e.isDirectory()) {
      if (LEWATI.has(e.name) || e.name.startsWith('.')) continue;
      kumpulkanHtml(path.join(dir, e.name), hasil);
    } else if (e.name.endsWith('.html')) {
      hasil.push(path.join(dir, e.name));
    }
  }
  return hasil;
}

// Hanya <script> tanpa atribut src, dan bukan yang bertipe data
// (application/json, text/template, dan sejenisnya bukan JavaScript).
const RE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

function bukanJavaScript(atribut) {
  if (/\bsrc\s*=/i.test(atribut)) return true;
  const t = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(atribut);
  if (!t) return false;
  const tipe = t[1].toLowerCase();
  return !['text/javascript', 'application/javascript', 'module'].includes(tipe);
}

function barisDari(teks, indeks) {
  return teks.slice(0, indeks).split('\n').length;
}

let diperiksa = 0;
const gagal = [];

for (const berkas of kumpulkanHtml(AKAR)) {
  const isi = fs.readFileSync(berkas, 'utf8');
  let m;
  RE_SCRIPT.lastIndex = 0;
  while ((m = RE_SCRIPT.exec(isi))) {
    if (bukanJavaScript(m[1])) continue;
    diperiksa++;
    const kode = m[2];
    const barisMulai = barisDari(isi, m.index);
    try {
      // new Function() mengurai tanpa menjalankan. Cukup untuk menangkap
      // galat sintaks, dan tidak ada efek samping.
      new Function(kode);
    } catch (e) {
      // Cari baris pertama yang membuatnya gagal, supaya penunjuknya berguna.
      const baris = kode.split('\n');
      let tebakan = null;
      for (let n = 1; n <= baris.length; n++) {
        try { new Function(baris.slice(0, n).join('\n')); }
        catch (_) { tebakan = barisMulai + n - 1; break; }
      }
      gagal.push({
        berkas: path.relative(AKAR, berkas),
        baris: tebakan || barisMulai,
        pesan: e.message,
        cuplikan: tebakan ? (baris[tebakan - barisMulai] || '').trim().slice(0, 120) : '',
      });
    }
  }
}

if (gagal.length) {
  console.error(`\n✗ ${gagal.length} skrip inline gagal diurai:\n`);
  for (const g of gagal) {
    console.error(`  ${g.berkas}:${g.baris}`);
    console.error(`    ${g.pesan}`);
    if (g.cuplikan) console.error(`    → ${g.cuplikan}`);
    console.error('');
  }
  process.exit(1);
}

console.log(`✓ ${diperiksa} skrip inline di berkas HTML terurai bersih.`);
