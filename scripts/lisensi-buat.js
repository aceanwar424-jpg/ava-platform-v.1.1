#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Terbitkan berkas lisensi OneLab.
//
// Dijalankan OLEH PENJUAL, di komputer penjual. Tidak pernah ikut dikirim
// ke klien — ia butuh kunci privat, dan siapa pun yang memegang kunci itu
// bisa menerbitkan lisensi sah untuk siapa saja.
//
// Pakai:
//   node scripts/lisensi-buat.js --pemegang "Klinik Melati" --hari 365
//   node scripts/lisensi-buat.js --pemegang "Lab Sehat" --sidik 3f2a… --edisi lengkap
//   node scripts/lisensi-buat.js --pemegang "Demo" --hari 30 --tanpa-ikatan
//
// Sidik mesin klien didapat dari layar Lisensi di aplikasi mereka, atau:
//   node scripts/lisensi-buat.js --sidik-saya
//
// Hasilnya berkas lisensi.json — kirimkan ke klien, taruh di folder data
// instalasi mereka (di sebelah pglite-data).
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AKAR = path.resolve(__dirname, '..');
const KUNCI_PRIVAT = path.join(AKAR, 'desktop-app', '.lisensi-privat.pem');

function arg(nama, bawaan = null) {
  const i = process.argv.indexOf('--' + nama);
  if (i < 0) return bawaan;
  const v = process.argv[i + 1];
  return (!v || v.startsWith('--')) ? true : v;
}

// Harus sama persis dengan sidikMesin() di desktop-app/electron/lisensi.js.
// Kalau salah satu berubah, lisensi yang terbit hari ini akan ditolak
// aplikasi — jadi keduanya sengaja ditulis pendek dan gamblang.
function sidikMesinLokal() {
  const os = require('os');
  const bahan = [os.hostname(), os.platform(), os.arch(),
    (os.cpus()[0] && os.cpus()[0].model || '').trim()].join('|');
  return crypto.createHash('sha256').update(bahan).digest('hex').slice(0, 32);
}

function kanonik(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

if (arg('sidik-saya')) {
  console.log(sidikMesinLokal());
  process.exit(0);
}

const pemegang = arg('pemegang');
if (!pemegang || pemegang === true) {
  console.error('Wajib: --pemegang "Nama Klinik"');
  console.error('Lihat komentar di kepala berkas ini untuk contoh lengkap.');
  process.exit(1);
}

if (!fs.existsSync(KUNCI_PRIVAT)) {
  console.error('Kunci privat tidak ada: ' + KUNCI_PRIVAT);
  console.error('Tanpa kunci itu tidak ada lisensi yang bisa diterbitkan.');
  console.error('Kalau ini komputer baru, salin kunci dari cadangan Anda —');
  console.error('JANGAN membuat pasangan baru, karena seluruh lisensi yang');
  console.error('sudah beredar akan langsung ditolak semua instalasi klien.');
  process.exit(1);
}

const hari = parseInt(arg('hari', '365'), 10);
const tanpaIkatan = !!arg('tanpa-ikatan');
const sidik = arg('sidik');

if (!tanpaIkatan && !sidik) {
  console.error('Wajib salah satu: --sidik <sidik mesin klien>  atau  --tanpa-ikatan');
  console.error('');
  console.error('Lisensi tanpa ikatan mesin bisa disalin ke berapa pun komputer.');
  console.error('Itu sah untuk demo atau lisensi seluruh cabang, tetapi harus');
  console.error('menjadi pilihan sadar — bukan yang terjadi karena lupa mengisi.');
  process.exit(1);
}

const lisensi = {
  pemegang: String(pemegang),
  edisi: String(arg('edisi', 'standar')),
  diterbitkan: new Date().toISOString().slice(0, 10),
  berlaku_sampai: Number.isFinite(hari) && hari > 0
    ? new Date(Date.now() + hari * 86400000).toISOString().slice(0, 10)
    : null,
  ...(tanpaIkatan ? {} : { sidik_mesin: String(sidik) }),
  ...(arg('catatan') && arg('catatan') !== true ? { catatan: String(arg('catatan')) } : {}),
};

const privat = crypto.createPrivateKey(fs.readFileSync(KUNCI_PRIVAT, 'utf8'));
const tanda = crypto.sign(null, Buffer.from(kanonik(lisensi), 'utf8'), privat)
  .toString('base64');

const berkas = arg('keluar') && arg('keluar') !== true
  ? String(arg('keluar'))
  : path.join(AKAR, `lisensi-${String(pemegang).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.json`);

fs.writeFileSync(berkas, JSON.stringify({ lisensi, tanda_tangan: tanda }, null, 2));

console.log('Lisensi diterbitkan:');
console.log('  pemegang       : ' + lisensi.pemegang);
console.log('  edisi          : ' + lisensi.edisi);
console.log('  berlaku sampai : ' + (lisensi.berlaku_sampai || 'tanpa batas waktu'));
console.log('  ikatan mesin   : ' + (lisensi.sidik_mesin || 'TIDAK TERIKAT — bisa disalin'));
console.log('  berkas         : ' + berkas);
console.log('');
console.log('Kirimkan berkas itu ke klien, lalu taruh dengan nama lisensi.json');
console.log('di folder data instalasi mereka (sejajar dengan pglite-data).');
