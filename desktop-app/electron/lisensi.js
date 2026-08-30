// ═══════════════════════════════════════════════════════════════
// LISENSI — verifikasi berkas lisensi bertanda tangan
//
// APA YANG INI LAKUKAN, DAN APA YANG TIDAK
// Ini BUKAN proteksi salin. Kode aplikasi dikirim sebagai JavaScript yang
// bisa dibuka siapa saja; orang yang memang berniat membobol akan bisa
// mematikan pemeriksaan ini dalam hitungan menit. Menyebutnya "pengaman"
// hanya akan membuat keputusan bisnis diambil di atas rasa aman yang palsu.
//
// Yang benar-benar dilakukannya:
//   1. Membuat kesepakatan lisensi menjadi eksplisit dan bisa diperiksa —
//      siapa pemegangnya, edisi apa, sampai kapan.
//   2. Mencegah satu berkas lisensi dipakai ulang di banyak klinik, karena
//      isinya terikat pada sidik mesin.
//   3. Membuat masa berlaku habis terlihat oleh pemakai yang jujur, jauh
//      sebelum jadi sengketa.
//
// MENGAPA TANDA TANGAN, BUKAN "KUNCI SERIAL"
// Kunci serial harus bisa diverifikasi aplikasi, artinya cara membuatnya
// ikut terkirim ke komputer klien — siapa pun bisa membuat kunci sendiri.
// Dengan Ed25519, yang terkirim hanya kunci PUBLIK. Kunci privat tinggal di
// tangan penjual dan tidak pernah masuk paket instalasi.
//
// MENGAPA OFFLINE
// Komputer klinik sering tanpa internet, dan aktivasi daring berarti
// layanan yang harus hidup selamanya. Kalau layanan itu mati, seluruh
// pelanggan ikut mati. Berkas lisensi tidak punya masalah itu.
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Kunci publik penerbit lisensi. Aman diedarkan — ia hanya bisa MEMERIKSA
// tanda tangan, tidak bisa membuatnya. Pasangan privatnya ada di
// desktop-app/.lisensi-privat.pem, diblokir .gitignore, dan dipakai
// scripts/lisensi-buat.js untuk menerbitkan lisensi.
//
// Kuncinya dibaca dari berkas, bukan ditulis di dalam kode. Kunci yang
// ditanam sebagai teks di sumber cenderung disalin-tempel sampai tidak ada
// lagi yang tahu mana yang benar-benar dipakai — dan kalau ia tidak
// berpasangan dengan kunci privat mana pun, tidak akan pernah ada lisensi
// yang lolos verifikasi tanpa ada yang menyadari sebabnya.
//
// Tidak ketemu = build pengembangan: lisensi tidak diperiksa sama sekali.
function muatKunciPublik() {
  if (process.env.AVA_LICENSE_PUBKEY) return process.env.AVA_LICENSE_PUBKEY.trim();
  const kandidat = [
    process.resourcesPath && path.join(process.resourcesPath, 'lisensi-publik.pem'),
    path.join(__dirname, 'lisensi-publik.pem'),
    path.join(__dirname, '..', 'lisensi-publik.pem'),
  ].filter(Boolean);
  for (const k of kandidat) {
    try { if (fs.existsSync(k)) return fs.readFileSync(k, 'utf8').trim(); } catch (_) {}
  }
  return '';
}

const KUNCI_PUBLIK_PEM = muatKunciPublik();

// Sidik mesin. Sengaja dibangun dari hal yang stabil terhadap pemutakhiran
// biasa (ganti RAM, pasang ulang Windows di mesin yang sama umumnya masih
// cocok), bukan dari nomor seri disk yang berubah setiap kali disk diganti.
// Terlalu ketat berarti klinik kehilangan akses karena servis perangkat
// keras — itu kerugian yang jauh lebih besar daripada satu salinan liar.
function sidikMesin() {
  const bahan = [
    os.hostname(),
    os.platform(),
    os.arch(),
    // CPU model, bukan jumlah inti: jumlah inti bisa berubah karena
    // pengaturan BIOS atau mesin virtual.
    (os.cpus()[0] && os.cpus()[0].model || '').trim(),
  ].join('|');
  return crypto.createHash('sha256').update(bahan).digest('hex').slice(0, 32);
}

// Lokasi berkas lisensi. Dicari di beberapa tempat supaya bisa dipasang
// oleh installer, oleh admin klinik, atau lewat variabel lingkungan saat
// pengujian.
function cariBerkasLisensi(dataDir) {
  const kandidat = [
    process.env.AVA_LICENSE_FILE,
    dataDir && path.join(dataDir, 'lisensi.json'),
    dataDir && path.join(path.dirname(dataDir), 'lisensi.json'),
    process.resourcesPath && path.join(process.resourcesPath, 'lisensi.json'),
  ].filter(Boolean);

  for (const k of kandidat) {
    try { if (fs.existsSync(k)) return k; } catch (_) {}
  }
  return '';
}

// Payload ditandatangani dalam bentuk JSON yang urutan kuncinya pasti.
// Tanpa ini, dua JSON yang isinya sama tapi urutannya beda menghasilkan
// tanda tangan berbeda, dan lisensi yang sah akan tertolak.
function kanonik(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function verifikasiTandaTangan(payload, tandaTangan) {
  if (!KUNCI_PUBLIK_PEM) return false;
  try {
    return crypto.verify(
      null,
      Buffer.from(kanonik(payload), 'utf8'),
      crypto.createPublicKey(KUNCI_PUBLIK_PEM),
      Buffer.from(String(tandaTangan), 'base64'),
    );
  } catch (_) {
    return false;
  }
}

// Hasil selalu berbentuk sama, apa pun keadaannya. Pemanggil tidak perlu
// membedakan "gagal baca" dari "tidak ada" dari "kedaluwarsa" — status yang
// berbeda ditandai kolom `status`, bukan bentuk data yang berbeda-beda.
function bacaLisensi(dataDir) {
  const kosong = {
    status: 'tidak-ada', sah: false, pesan: '', pemegang: '', edisi: '',
    berlaku_sampai: null, sisa_hari: null, berkas: '', terikat_mesin: false,
  };

  // Build pengembangan tanpa kunci publik: tidak ada yang bisa diperiksa,
  // dan berpura-pura memeriksa lebih buruk daripada mengatakannya.
  if (!KUNCI_PUBLIK_PEM) {
    return { ...kosong, status: 'tidak-diperiksa', sah: true,
             pesan: 'Build pengembangan — lisensi tidak diperiksa.' };
  }

  const berkas = cariBerkasLisensi(dataDir);
  if (!berkas) {
    return { ...kosong, pesan: 'Belum ada berkas lisensi pada instalasi ini.' };
  }

  let isi;
  try {
    isi = JSON.parse(fs.readFileSync(berkas, 'utf8'));
  } catch (e) {
    return { ...kosong, status: 'rusak', berkas,
             pesan: 'Berkas lisensi tidak terbaca: ' + (e && e.message ? e.message : e) };
  }

  const payload = isi && isi.lisensi;
  if (!payload || !isi.tanda_tangan) {
    return { ...kosong, status: 'rusak', berkas, pesan: 'Isi berkas lisensi tidak lengkap.' };
  }

  if (!verifikasiTandaTangan(payload, isi.tanda_tangan)) {
    return { ...kosong, status: 'palsu', berkas,
             pesan: 'Tanda tangan lisensi tidak cocok. Berkas ini tidak diterbitkan oleh penyedia aplikasi.' };
  }

  const dasar = {
    ...kosong, berkas,
    pemegang: payload.pemegang || '',
    edisi: payload.edisi || 'standar',
    berlaku_sampai: payload.berlaku_sampai || null,
    terikat_mesin: !!payload.sidik_mesin,
  };

  // Ikatan mesin diperiksa SESUDAH tanda tangan: kalau tanda tangannya
  // palsu, isi sidik mesinnya tidak ada artinya untuk dibandingkan.
  if (payload.sidik_mesin && payload.sidik_mesin !== sidikMesin()) {
    return { ...dasar, status: 'mesin-lain', sah: false,
             pesan: 'Lisensi ini diterbitkan untuk komputer lain. ' +
                    'Minta lisensi baru untuk komputer ini.' };
  }

  if (payload.berlaku_sampai) {
    const batas = new Date(payload.berlaku_sampai + 'T23:59:59');
    const sisa = Math.ceil((batas - new Date()) / 86400000);
    if (sisa < 0) {
      return { ...dasar, status: 'kedaluwarsa', sah: false, sisa_hari: sisa,
               pesan: `Masa lisensi berakhir ${payload.berlaku_sampai}.` };
    }
    return { ...dasar, status: sisa <= 30 ? 'segera-berakhir' : 'aktif', sah: true, sisa_hari: sisa,
             pesan: sisa <= 30 ? `Lisensi berakhir dalam ${sisa} hari.` : '' };
  }

  return { ...dasar, status: 'aktif', sah: true, pesan: '' };
}

module.exports = { bacaLisensi, sidikMesin, cariBerkasLisensi };
