#!/usr/bin/env node
// Salin seluruh berkas .js polos dari electron/ ke dist-electron/.
//
// MENGAPA MENYALIN SEMUA, BUKAN DAFTAR NAMA
// Sebelumnya skrip build hanya menyalin local-engine.js, satu nama, ditulis
// langsung di package.json. Saat lisensi.js ditambahkan, ia ikut ter-require
// oleh local-engine.js tetapi TIDAK ikut tersalin — dan hanya build terpaket
// yang gagal, karena di mode pengembangan berkasnya memang ada di electron/.
//
// Pemeriksaan lisensi jadi selalu mengembalikan galat di instalasi klien,
// sementara di komputer pengembang semuanya tampak sehat.
//
// Daftar nama yang harus diingat manusia akan terlupa lagi. Menyalin seluruh
// isi folder tidak bisa lupa.
//
// Berkas .ts tidak disalin — itu urusan tsc, yang mengeluarkan hasilnya ke
// folder yang sama.

const fs = require('fs');
const path = require('path');

const ASAL = path.join(__dirname, '..', 'electron');
const TUJUAN = path.join(__dirname, '..', 'dist-electron');

fs.mkdirSync(TUJUAN, { recursive: true });

const berkas = fs.readdirSync(ASAL).filter(f => f.endsWith('.js'));
if (!berkas.length) {
  console.error('Tidak ada berkas .js di electron/ — build hampir pasti tidak akan jalan.');
  process.exit(1);
}

for (const f of berkas) {
  fs.copyFileSync(path.join(ASAL, f), path.join(TUJUAN, f));
}

console.log(`[build] ${berkas.length} berkas disalin ke dist-electron: ${berkas.join(', ')}`);
