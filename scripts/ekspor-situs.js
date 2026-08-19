#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Ekspor tiap situs jadi folder mandiri yang siap menjadi repo sendiri.
//
// MENGAPA MENGEKSPOR, BUKAN MEMINDAHKAN
// Memecah repo ini menjadi enam repo terpisah kelihatannya rapi, tetapi ada
// satu hal yang menahannya: produk desktop (.exe) menyajikan SELURUH folder
// platform sebagai satu akar. Kalau situsnya benar-benar tersebar di enam
// repo, build desktop harus menyatukannya kembali — sebuah langkah build
// baru pada proyek yang sengaja tidak punya langkah build, tepat di bagian
// yang justru dijual.
//
// Karena itu repo ini tetap menjadi sumber kebenaran, dan situs mandiri
// DIBANGKITKAN darinya. Yang didapat sama dengan repo terpisah — tiap situs
// bisa di-deploy sendiri, punya domain sendiri, dan bisa didorong ke repo
// sendiri — tanpa membuat produk desktop bergantung pada penyatuan ulang.
//
// Kalau nanti benar-benar ingin repo terpisah permanen, hasil ekspor inilah
// isinya: tinggal `git init` di dalamnya dan push. Keputusan itu jadi bisa
// diambil belakangan tanpa membongkar apa pun hari ini.
//
// BERKAS BERSAMA
// Hanya satu yang melintasi batas: js/core/api.js (138 baris), dibutuhkan
// situs "app". Ia disalin saat ekspor, dan sidiknya dicatat. Kalau salinan
// di hasil ekspor pernah disunting terpisah, ekspor berikutnya melaporkannya
// — supaya penyimpangan ketahuan saat itu juga, bukan ketika produksi
// diam-diam berperilaku beda.
//
// Pakai:
//   node scripts/ekspor-situs.js                 → ekspor semua situs
//   node scripts/ekspor-situs.js --situs app     → satu situs saja
//   node scripts/ekspor-situs.js --keluar D:/x   → folder tujuan lain
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AKAR = path.resolve(__dirname, '..');
const PLATFORM = path.join(AKAR, 'onelab-platform-main', 'onelab-platform');
const PETA = path.join(AKAR, 'config', 'domain.json');

function arg(nama, bawaan = null) {
  const i = process.argv.indexOf('--' + nama);
  if (i < 0) return bawaan;
  const v = process.argv[i + 1];
  return (!v || v.startsWith('--')) ? true : v;
}

const TUJUAN = path.resolve(String(arg('keluar', path.join(AKAR, 'dist-situs'))));
const HANYA = arg('situs');

const peta = JSON.parse(fs.readFileSync(PETA, 'utf8'));

function sidik(berkas) {
  return crypto.createHash('sha256').update(fs.readFileSync(berkas)).digest('hex').slice(0, 16);
}

// ── Berkas yang TIDAK BOLEH ikut terekspor ──────────────────────
//
// Hasil ekspor ditujukan untuk di-git init dan di-push. Apa pun yang
// diblokir .gitignore di repo induk diblokir karena suatu alasan — dan
// alasan yang paling sering adalah "berisi rahasia".
//
// Ini ditemukan saat menguji: ekspor pertama membawa js/config.local.js,
// tempat kunci LLM disimpan. Kebetulan sedang kosong. Kalau tidak, satu
// perintah push akan menerbitkannya.
//
// Aturannya diambil dari git sendiri, bukan daftar nama yang ditulis di
// sini. Daftar buatan tangan akan ketinggalan begitu ada berkas rahasia
// jenis baru; .gitignore tidak.
const { execFileSync } = require('child_process');

function berkasDiabaikan(daftarRelatif) {
  if (!daftarRelatif.length) return new Set();
  try {
    const keluar = execFileSync('git', ['check-ignore', '--stdin'], {
      cwd: PLATFORM,
      input: daftarRelatif.join('\n'),
      encoding: 'utf8',
    });
    return new Set(keluar.split('\n').map(x => x.trim().replace(/\\/g, '/')).filter(Boolean));
  } catch (e) {
    // git check-ignore keluar dengan kode 1 bila TIDAK ada yang cocok —
    // itu keadaan normal, bukan kegagalan.
    if (e.status === 1) {
      return new Set(String(e.stdout || '').split('\n').map(x => x.trim().replace(/\\/g, '/')).filter(Boolean));
    }
    // Kegagalan lain (git tidak ada, bukan repo) tidak boleh didiamkan:
    // tanpa penyaring ini, berkas rahasia bisa ikut terekspor tanpa jejak.
    throw new Error('Tidak bisa memeriksa .gitignore lewat git: ' +
      (e && e.message ? e.message : e) + '\nEkspor dihentikan demi keamanan.');
  }
}

// Kumpulkan dulu daftar berkasnya, baru saring lewat .gitignore sekali jalan.
// Memanggil git untuk tiap berkas satu per satu akan lambat sekali pada situs
// "his" yang berisi ratusan berkas.
function kumpulkan(asal, tujuan, hasil = []) {
  const stat = fs.statSync(asal);
  if (stat.isDirectory()) {
    for (const e of fs.readdirSync(asal)) {
      if (['node_modules', '.git', 'graphify-out'].includes(e)) continue;
      kumpulkan(path.join(asal, e), path.join(tujuan, e), hasil);
    }
    return hasil;
  }
  hasil.push({ asal, tujuan });
  return hasil;
}

function salin(asal, tujuan, dilewati) {
  const daftar = kumpulkan(asal, tujuan);
  const relatif = daftar.map(d => path.relative(PLATFORM, d.asal).replace(/\\/g, '/'));
  const abaikan = berkasDiabaikan(relatif);

  let n = 0;
  daftar.forEach((d, i) => {
    if (abaikan.has(relatif[i])) { dilewati.push(relatif[i]); return; }
    fs.mkdirSync(path.dirname(d.tujuan), { recursive: true });
    fs.copyFileSync(d.asal, d.tujuan);
    n++;
  });
  return n;
}

// vercel.json untuk situs yang berdiri sendiri. Jauh lebih sederhana daripada
// yang di akar monorepo: satu situs, satu halaman masuk, tanpa aturan host —
// karena repo ini hanya melayani satu domain.
function vercelSitus(s) {
  return JSON.stringify({
    $schema: 'https://openapi.vercel.sh/vercel.json',
    rewrites: [{ source: '/(.*)', destination: s.masuk }],
  }, null, 2) + '\n';
}

function readmeSitus(s, berkas, bersama) {
  return `# ${s.nama}

Folder ini **dibangkitkan** oleh \`scripts/ekspor-situs.js\` dari repo induk
OneLab. Jangan menyunting isinya langsung — suntingan akan hilang pada ekspor
berikutnya. Ubah sumbernya di repo induk, lalu ekspor ulang.

## Isi

| Hal | Nilai |
|---|---|
| Halaman masuk | \`${s.masuk}\` |
| Domain | ${(s.host || []).join(', ') || '—'} |
| Uji lokal | http://${s.lokal}.localhost:5174/ (dari repo induk) |
| Berkas | ${berkas} |

${bersama.length ? `## Berkas milik situs lain

${bersama.map(b => `- \`${b}\``).join('\n')}

Disalin saat ekspor. Jangan disunting di sini: pengekspor membandingkan isinya
dengan sumber di repo induk dan akan melaporkan bila keduanya berbeda.
` : ''}
## Menjadikannya repo sendiri

\`\`\`bash
cd ${path.basename(TUJUAN)}/${s.kunci}
git init && git add -A && git commit -m "ekspor awal ${s.nama}"
git remote add origin <url-repo-baru>
git push -u origin main
\`\`\`

Lalu buat proyek Vercel baru yang menunjuk repo itu, dan arahkan domainnya.
Root Directory dibiarkan di akar repo — \`vercel.json\` di sini sudah mengatur
sisanya.
`;
}

// ── Jalankan ────────────────────────────────────────────────────
const situs = (peta.situs || []).filter(s => !HANYA || HANYA === true || s.kunci === HANYA);

if (!situs.length) {
  console.error(HANYA ? `Situs "${HANYA}" tidak ada di config/domain.json.` : 'Peta domain kosong.');
  process.exit(1);
}

const galat = [];
const ringkas = [];

for (const s of situs) {
  const daftar = s.berkas || [];
  if (!daftar.length) {
    galat.push(`"${s.kunci}" belum punya daftar "berkas" di config/domain.json`);
    continue;
  }

  const dir = path.join(TUJUAN, s.kunci);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  let jml = 0;
  let gagalSitus = false;
  const dilewati = [];

  for (const b of daftar) {
    const asal = path.join(PLATFORM, b);
    if (!fs.existsSync(asal)) {
      galat.push(`"${s.kunci}": ${b} tidak ada di folder platform`);
      gagalSitus = true;
      continue;
    }
    jml += salin(asal, path.join(dir, b), dilewati);
  }

  // Berkas bersama: disalin, lalu sidiknya dibandingkan dengan sumber.
  // Perbandingan ini yang membuat penyimpangan terlihat.
  const bersama = s.bersama || [];
  for (const b of bersama) {
    const asal = path.join(PLATFORM, b);
    if (!fs.existsSync(asal)) {
      galat.push(`"${s.kunci}": berkas bersama ${b} tidak ada`);
      gagalSitus = true;
      continue;
    }
    const tujuanB = path.join(dir, b);
    salin(asal, tujuanB, dilewati);
    jml++;
    if (sidik(asal) !== sidik(tujuanB)) {
      galat.push(`"${s.kunci}": salinan ${b} berbeda dari sumbernya`);
    }
  }

  if (gagalSitus) continue;

  fs.writeFileSync(path.join(dir, 'vercel.json'), vercelSitus(s));
  fs.writeFileSync(path.join(dir, 'README.md'), readmeSitus(s, jml, bersama));

  // Halaman masuk WAJIB ada di hasil ekspor. Tanpa pemeriksaan ini, situs
  // yang daftar berkasnya salah tetap terekspor rapi dan baru ketahuan 404
  // setelah domainnya diarahkan.
  const masuk = path.join(dir, s.masuk.replace(/^\//, ''));
  if (!fs.existsSync(masuk)) {
    galat.push(`"${s.kunci}": halaman masuk ${s.masuk} tidak ikut terekspor — periksa daftar "berkas"`);
    continue;
  }

  ringkas.push({ kunci: s.kunci, nama: s.nama, jml, dir, masuk: s.masuk,
                 bersama: bersama.length, dilewati });
}

if (galat.length) {
  console.error('\n✗ Ekspor bermasalah:\n');
  for (const g of galat) console.error('  ' + g);
  console.error('');
  process.exit(1);
}

console.log(`\n✓ ${ringkas.length} situs diekspor ke ${TUJUAN}\n`);
for (const r of ringkas) {
  console.log(`  ${r.kunci.padEnd(6)} ${String(r.nama).padEnd(30)} ${String(r.jml).padStart(4)} berkas   masuk: ${r.masuk}` +
    (r.bersama ? `   (+${r.bersama} berkas bersama)` : ''));
  if (r.dilewati.length) {
    console.log(`         dilewati (diblokir .gitignore): ${r.dilewati.join(', ')}`);
  }
}
console.log('\nTiap folder sudah berisi vercel.json dan README sendiri — siap di-git init.');
console.log('Repo induk tetap sumber kebenaran; hasil ekspor dibangkitkan ulang, bukan disunting.\n');
