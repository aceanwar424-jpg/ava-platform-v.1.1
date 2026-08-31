// ═══════════════════════════════════════════════════════════════
// AUDIT: apakah setiap menu benar-benar HIDUP?
//
// Pemeriksa menu yang sudah ada (bangun-menu.js) menjawab dua hal:
// apakah rutenya ada, dan apakah modulnya memanggil data. Itu belum
// cukup untuk menjamin layarnya jalan.
//
// Layar bisa mati karena:
//   1. fungsi render yang dipanggil router tidak pernah didefinisikan
//   2. berkas modulnya tidak terdaftar di manifest halaman itu
//   3. modul membaca TABEL/VIEW yang tidak ada di skema
//   4. modul memanggil RPC yang tidak ada
//   5. onclick menunjuk fungsi yang tidak diekspor ke window
//
// Nomor 3 dan 4 yang paling sering: layarnya termuat, lalu menampilkan
// "tidak dapat dibaca" untuk selamanya. Secara teknis tidak error —
// secara pemakaian, mati.
//
// Jalankan: node scripts/audit-menu-hidup.js
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const AKAR = path.resolve(__dirname, '..');
const PLAT = path.join(AKAR, 'ava-platform');

const merah = s => `\x1b[31m${s}\x1b[0m`;
const kuning = s => `\x1b[33m${s}\x1b[0m`;
const hijau = s => `\x1b[32m${s}\x1b[0m`;
const abu = s => `\x1b[90m${s}\x1b[0m`;

// ── Kumpulkan skema: tabel, view, fungsi ──────────────────────────
function bacaSemuaSql() {
  const berkas = [];
  const tel = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) tel(p);
      else if (e.name.endsWith('.sql')) berkas.push(p);
    }
  };
  tel(path.join(AKAR, 'db'));
  tel(path.join(PLAT, 'sql_arsip'));
  const satu = path.join(PLAT, 'database.sql');
  if (fs.existsSync(satu)) berkas.push(satu);

  // Berkas supabase_*.sql yang tergeletak di akar ava-platform IKUT
  // dijalankan runner (lihat local-engine.js: readdirSync(repoDir) yang
  // menyaring /^supabase_.*\.sql$/). Melewatkannya membuat tabel seperti
  // corp_exam_requests dilaporkan hilang padahal ia memang dibuat di sana.
  for (const f of fs.readdirSync(PLAT)) {
    if (/^supabase_.*\.sql$/.test(f)) berkas.push(path.join(PLAT, f));
  }
  return berkas.map(f => fs.readFileSync(f, 'utf8')).join('\n');
}

const SQL = bacaSemuaSql();

const TABEL = new Set();
for (const m of SQL.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
  TABEL.add(m[1].toLowerCase());
}
for (const m of SQL.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?([a-z0-9_]+)/gi)) {
  TABEL.add(m[1].toLowerCase());
}
const FUNGSI = new Set();
for (const m of SQL.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z0-9_]+)/gi)) {
  FUNGSI.add(m[1].toLowerCase());
}

// ── Peta rute → fungsi render ─────────────────────────────────────
const isiRouter = fs.readFileSync(path.join(PLAT, 'js/core/router.js'), 'utf8');
const petaRender = {};
{
  const re = /case\s+'([a-z0-9_-]+)'[ \t]*:[ \t]*(?:[^\n]*?safeRun\([ \t]*'([A-Za-z0-9_]+)')?/gi;
  let m, tertunda = [];
  while ((m = re.exec(isiRouter)) !== null) {
    if (m[2]) {
      for (const h of tertunda) petaRender[h] = m[2];
      petaRender[m[1]] = m[2];
      tertunda = [];
    } else tertunda.push(m[1]);
  }
}

// ── Peta fungsi render → berkas, dan isi tiap berkas ──────────────
const petaBerkas = {};
const isiBerkas = {};
(function tel(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { tel(p); continue; }
    if (!e.name.endsWith('.js')) continue;
    const isi = fs.readFileSync(p, 'utf8');
    isiBerkas[p] = isi;
    for (const m of isi.matchAll(/(?:async\s+)?function\s+(render[A-Za-z0-9_]*)\s*\(/g)) {
      if (!petaBerkas[m[1]]) petaBerkas[m[1]] = p;
    }
  }
})(path.join(PLAT, 'modules'));

// Fungsi render bisa juga didefinisikan di js/core atau apps.
for (const extra of ['js/core', 'apps']) {
  const d = path.join(PLAT, extra);
  if (!fs.existsSync(d)) continue;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.js')) continue;
    const p = path.join(d, e.name);
    const isi = fs.readFileSync(p, 'utf8');
    isiBerkas[p] = isi;
    for (const m of isi.matchAll(/(?:async\s+)?function\s+(render[A-Za-z0-9_]*)\s*\(/g)) {
      if (!petaBerkas[m[1]]) petaBerkas[m[1]] = p;
    }
  }
}

// ── Seluruh nama yang bisa dipanggil dari onclick ─────────────────
// Skrip klasik: deklarasi fungsi tingkat atas DAN penetapan window.X
// sama-sama menghasilkan global.
//
// Skrip sebaris di dalam HTML ikut dibaca. Melewatkannya membuat fungsi
// seperti openCategory() — yang memang tinggal di index.html — dilaporkan
// hilang padahal ada.
const sumberGlobal = Object.values(isiBerkas).slice();
for (const h of ['index.html', 'portal.html', 'apps/index.html']) {
  const p = path.join(PLAT, h);
  if (fs.existsSync(p)) sumberGlobal.push(fs.readFileSync(p, 'utf8'));
}

const SEMUA_FUNGSI_JS = new Set();
for (const isi of sumberGlobal) {
  // Tanpa jangkar awal-baris ketat: skrip di dalam HTML punya indentasi
  // yang berbeda-beda, dan fungsi tingkat atasnya tetap global.
  for (const m of isi.matchAll(/(?:^|\n)[ \t]*(?:async[ \t]+)?function[ \t]+([a-zA-Z0-9_$]+)/g)) {
    SEMUA_FUNGSI_JS.add(m[1]);
  }
  for (const m of isi.matchAll(/window\.([a-zA-Z0-9_$]+)\s*=/g)) SEMUA_FUNGSI_JS.add(m[1]);
  for (const m of isi.matchAll(
    /^(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:function|\()/gm)) {
    SEMUA_FUNGSI_JS.add(m[1]);
  }
}
// Nama bawaan peramban atau kerangka yang wajar muncul di onclick.
// 'if', 'return' dsb muncul karena onclick boleh berisi pernyataan JS
// (mis. onclick="if(event.target===this)tutup()"), bukan pemanggilan fungsi.
const BAWAAN = new Set(['alert', 'confirm', 'print', 'history', 'location', 'open',
  'close', 'event', 'navigate', 'toast', 'icon', 'showScreen', 'showView', 'logout',
  'if', 'for', 'while', 'switch', 'return', 'typeof', 'this', 'window', 'document']);

// ── Manifest halaman ──────────────────────────────────────────────
//
// Sebagian modul sengaja TIDAK masuk manifest karena dimuat lebih awal
// (daftar EAGER di bangun-manifest.js): fungsinya dipanggil saat boot,
// sebelum navigasi pertama. Membacanya dari sana, bukan menebak, supaya
// modul seperti mou.js tidak dilaporkan hilang padahal justru dimuat
// lebih dulu daripada yang lain.
const EAGER = new Set();
try {
  const gen = fs.readFileSync(path.join(AKAR, 'scripts/bangun-manifest.js'), 'utf8');
  const blok = gen.match(/const EAGER = new Set\(\[([\s\S]*?)\]\)/);
  if (blok) {
    for (const m of blok[1].matchAll(/'([^']+)'/g)) EAGER.add(m[1]);
  }
} catch (_) {}

let MANIFEST = {};
try {
  const w = {};
  new Function('window', fs.readFileSync(path.join(PLAT, 'js/core/modul-manifest.js'), 'utf8'))(w);
  MANIFEST = w.MODUL_HALAMAN || {};
} catch (_) {}

// ── Menu ──────────────────────────────────────────────────────────
const menu = JSON.parse(fs.readFileSync(path.join(AKAR, 'config/menu.json'), 'utf8'));

const temuan = { mati: [], tabel: [], rpc: [], manifest: [], handler: [] };
let diperiksa = 0;

const rel = p => path.relative(PLAT, p).replace(/\\/g, '/');

for (const [kunciKat, kat] of Object.entries(menu.kategori || {})) {
  if (kunciKat === 'konsumen') continue;      // halaman portal, bukan rute internal
  for (const grup of kat.grup || []) {
    for (const m of grup.menu || []) {
      if (m.status !== 'ada') continue;
      diperiksa++;
      const halaman = m.rute || m.id;
      const fn = petaRender[halaman];
      const label = `${m.id} (${kat.label})`;

      // 1. fungsi render ada?
      if (!fn) { temuan.mati.push(`${label} → rute "${halaman}" tanpa safeRun`); continue; }
      const berkas = petaBerkas[fn];
      if (!berkas) {
        temuan.mati.push(`${label} → ${fn}() tidak pernah didefinisikan`);
        continue;
      }

      // 2. berkas terdaftar di manifest halaman ini?
      const daftar = MANIFEST[halaman] || [];
      const relB = rel(berkas);
      const dimuatEager = relB.startsWith('js/core/') || relB.startsWith('apps/')
                       || EAGER.has(relB);
      if (!dimuatEager && daftar.length && !daftar.includes(relB)) {
        temuan.manifest.push(`${label} → ${relB} tidak ada di manifest "${halaman}"`);
      }

      const isi = isiBerkas[berkas] || '';

      // 3. tabel/view yang dibaca ada?
      const tabelDipakai = new Set();
      for (const mm of isi.matchAll(/\bsb(?:Get|Post|Patch|Delete)\s*\(\s*['"]([a-z0-9_]+)['"]/g)) {
        tabelDipakai.add(mm[1]);
      }
      for (const mm of isi.matchAll(/\bavaAmbil\s*\(\s*['"]([a-z0-9_]+)['"]/g)) {
        tabelDipakai.add(mm[1]);
      }
      for (const t of tabelDipakai) {
        if (!TABEL.has(t)) temuan.tabel.push(`${label} → tabel/view "${t}" tidak ada di skema  [${relB}]`);
      }

      // 4. RPC yang dipanggil ada?
      const rpcDipakai = new Set();
      for (const mm of isi.matchAll(/\b(?:sbRpc|appRpc)\s*\(\s*['"]([a-z0-9_]+)['"]/g)) {
        rpcDipakai.add(mm[1]);
      }
      for (const r of rpcDipakai) {
        if (!FUNGSI.has(r)) temuan.rpc.push(`${label} → RPC "${r}()" tidak ada di skema  [${relB}]`);
      }

      // 5. onclick menunjuk fungsi yang benar-benar ADA di suatu tempat?
      //
      // Versi pertama pemeriksaan ini menandai fungsi yang tidak
      // di-assign ke window sebagai rusak. Itu KELIRU dan menghasilkan
      // 1339 temuan palsu: berkas modul dimuat sebagai skrip klasik
      // (createElement('script'), tanpa type=module dan tanpa pembungkus
      // IIFE), sehingga `function foo(){}` di tingkat atas otomatis
      // menjadi properti window. `window.foo = foo` hanya penegasan.
      //
      // Yang benar-benar merusak tombol adalah fungsi yang tidak
      // didefinisikan di mana pun. Itu yang diperiksa sekarang.
      for (const mm of isi.matchAll(/onclick="([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g)) {
        const c = mm[1];
        if (SEMUA_FUNGSI_JS.has(c) || BAWAAN.has(c)) continue;
        temuan.handler.push(`${label} → onclick="${c}()" tidak didefinisikan di mana pun  [${relB}]`);
      }
    }
  }
}

// ── Laporan ───────────────────────────────────────────────────────
console.log(`\n═══ AUDIT MENU HIDUP ═══\n`);
console.log(`  Menu berstatus "ada" diperiksa : ${diperiksa}`);
console.log(`  Tabel/view dikenal di skema    : ${TABEL.size}`);
console.log(`  Fungsi basis data dikenal      : ${FUNGSI.size}\n`);

const bagian = [
  ['LAYAR MATI — fungsi render tidak ada', temuan.mati, merah],
  ['TABEL/VIEW TIDAK ADA — layar termuat lalu menampilkan galat', temuan.tabel, merah],
  ['RPC TIDAK ADA — tombol akan gagal saat ditekan', temuan.rpc, merah],
  ['HANDLER HILANG — onclick menunjuk fungsi yang tidak ada', temuan.handler, merah],
  ['TIDAK DI MANIFEST — termuat lewat jaring pengaman, lebih lambat', temuan.manifest, kuning],
];

let totalBerat = 0;
for (const [judul, daftar, warna] of bagian) {
  if (!daftar.length) { console.log(`  ${hijau('✓')} ${judul.split(' —')[0]}: bersih`); continue; }
  if (warna === merah) totalBerat += daftar.length;
  console.log(`\n  ${warna('✗ ' + judul)} (${daftar.length})`);
  const unik = [...new Set(daftar)];
  for (const d of unik.slice(0, 40)) console.log(`      · ${d}`);
  if (unik.length > 40) console.log(abu(`      … ${unik.length - 40} lagi`));
}

console.log(`\n─────────────────────────────────────────`);
console.log(totalBerat
  ? merah(`  ${totalBerat} masalah berat — ada menu yang tidak akan jalan.`)
  : hijau(`  Tidak ada masalah berat.`));
console.log(`─────────────────────────────────────────\n`);
process.exit(totalBerat ? 1 : 0);
