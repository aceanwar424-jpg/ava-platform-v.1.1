#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// SIMULATOR ALAT LAB — untuk menguji OneLab Connector tanpa alat fisik
//
// Kenapa ini ada: verifikasi connector selama ini hanya bisa dilakukan di
// depan alat sungguhan, di lab yang sedang berjalan. Itu tempat terburuk
// untuk menemukan bug. Simulator ini berperan sebagai alat — mengirim
// hasil, bertanya order (host query), dan mengirim bahan kontrol —
// sehingga pemasangan bisa dibuktikan lebih dulu di meja.
//
// PEMAKAIAN
//   node simulator-alat.js hasil   [--host 127.0.0.1] [--port 5001] [--barcode 123456]
//   node simulator-alat.js query   [--barcode 123456]
//   node simulator-alat.js qc      [--level "LEVEL 2"] [--lot A77]
//
// Connector harus dalam mode `server` (listen) pada porta yang dituju.
// ═══════════════════════════════════════════════════════════════════════
const net = require('net');

const ENQ = 0x05, ACK = 0x06, NAK = 0x15, STX = 0x02, ETX = 0x03, EOT = 0x04;
const VT = 0x0B, FS = 0x1C, CR = 0x0D;

const argv = process.argv.slice(2);
const mode = (argv[0] || 'hasil').toLowerCase();
const opsi = (nama, bawaan) => {
  const i = argv.indexOf('--' + nama);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};

const HOST     = opsi('host', '127.0.0.1');
const PORT     = parseInt(opsi('port', '5001'), 10);
const PROTOKOL = opsi('protokol', 'ASTM').toUpperCase();
const BARCODE  = opsi('barcode', '123456');
const LEVEL    = opsi('level', 'LEVEL 2');
const LOT      = opsi('lot', 'A77');
const TES      = opsi('tes', 'GLU');
const NILAI    = opsi('nilai', '102.5');

const warna = { ok: '\x1b[32m', in: '\x1b[36m', out: '\x1b[33m', err: '\x1b[31m', off: '\x1b[0m' };
const catat = (arah, teks) => {
  const w = arah === '→' ? warna.out : arah === '←' ? warna.in : warna.ok;
  console.log(`${w}${arah} ${teks}${warna.off}`);
};

// Frame ASTM: <STX> FN record <CR> <ETX> C1 C2 <CR><LF>
//
// CR setelah record itu WAJIB menurut E1381 — ia pemisah antar-record saat
// beberapa frame digabung kembali oleh penerima. Tanpa CR, record menyatu
// (…SIMULATORQ|1|…) dan penerima tidak bisa mengenali awal record berikutnya.
function frame(n, teks) {
  const isi = String(n % 8) + teks + '\r' + String.fromCharCode(ETX);
  let sum = 0;
  for (const c of isi) sum = (sum + c.charCodeAt(0)) & 0xFF;
  return Buffer.from(
    String.fromCharCode(STX) + isi + sum.toString(16).toUpperCase().padStart(2, '0') + '\r\n',
    'latin1');
}

function susunPesan() {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  if (mode === 'query') {
    // Host query: alat menanyakan order untuk satu barcode.
    return PROTOKOL === 'HL7'
      ? [`MSH|^~\\&|SIMULATOR||OneLab||${ts}||QRY^Q02|1|P|2.3`,
         `QRD|${ts}|R|I|1|||10|${BARCODE}|OTH`]
      : [`H|\\^&|||SIMULATOR`, `Q|1|^^${BARCODE}^|||||||||O`, `L|1|N`];
  }
  if (mode === 'qc') {
    // Bahan kontrol: ditandai kode aksi 'Q' pada record O (field ke-12).
    const spesimen = `QC-${LEVEL} LOT:${LOT}`;
    return [`H|\\^&|||SIMULATOR`,
            `P|1|||${spesimen}|KONTROL`,
            `O|1|${spesimen}||^^^${TES}|R|||||Q`,
            `R|1|^^^${TES}|${NILAI}|mg/dL||||F`,
            `L|1|N`];
  }
  // Hasil pasien biasa.
  return PROTOKOL === 'HL7'
    ? [`MSH|^~\\&|SIMULATOR||OneLab||${ts}||ORU^R01|1|P|2.3`,
       `PID|||${BARCODE}||PASIEN SIMULASI`,
       `OBR|1|${BARCODE}||${TES}`,
       `OBX|1|NM|${TES}||${NILAI}|mg/dL|||||F`]
    : [`H|\\^&|||SIMULATOR`,
       `P|1|||${BARCODE}|PASIEN SIMULASI`,
       `O|1|${BARCODE}||^^^${TES}|R`,
       `R|1|^^^${TES}|${NILAI}|mg/dL||||F`,
       `L|1|N`];
}

const sock = net.connect(PORT, HOST, async () => {
  console.log(`\nSimulator alat → ${HOST}:${PORT}  protokol=${PROTOKOL}  mode=${mode}\n`);
  const baris = susunPesan();

  if (PROTOKOL === 'HL7') {
    const pesan = baris.join('\r') + '\r';
    catat('→', `MLLP ${baris.length} segmen`);
    baris.forEach(b => catat('→', '  ' + b));
    sock.write(Buffer.concat([Buffer.from([VT]), Buffer.from(pesan, 'latin1'), Buffer.from([FS, CR])]));
    return;
  }

  // ASTM: ENQ → tunggu ACK → frame satu per satu → EOT
  catat('→', 'ENQ');
  sock.write(Buffer.from([ENQ]));
  tahap = 'tunggu-ack-enq';
  antre = baris;
});

let tahap = 'tunggu-ack-enq';
let antre = [];
let nomor = 1;
let masuk = Buffer.alloc(0);

function lanjutkanKirim() {
  if (!antre.length) {
    catat('→', 'EOT');
    sock.write(Buffer.from([EOT]));
    tahap = 'selesai-kirim';
    // Untuk mode query, tunggu jawaban order dari connector.
    if (mode !== 'query') setTimeout(() => { console.log('\nSelesai.\n'); sock.end(); }, 500);
    return;
  }
  const teks = antre.shift();
  catat('→', teks);
  sock.write(frame(nomor++, teks));
}

sock.on('data', (chunk) => {
  masuk = Buffer.concat([masuk, chunk]);

  while (masuk.length) {
    const b0 = masuk[0];

    if (b0 === ACK) {
      masuk = masuk.slice(1);
      if (tahap === 'tunggu-ack-enq' || tahap === 'kirim') { tahap = 'kirim'; lanjutkanKirim(); }
      continue;
    }
    if (b0 === NAK) { masuk = masuk.slice(1); catat('←', 'NAK'); continue; }

    // Connector membuka sesi balik untuk mengirim ORDER (jawaban host query).
    if (b0 === ENQ) {
      masuk = masuk.slice(1);
      catat('←', 'ENQ (connector mulai kirim order)');
      sock.write(Buffer.from([ACK]));
      continue;
    }
    if (b0 === EOT) {
      masuk = masuk.slice(1);
      catat('←', 'EOT (order selesai)');
      setTimeout(() => { console.log('\nSelesai.\n'); sock.end(); }, 300);
      continue;
    }
    if (b0 === STX) {
      let t = -1;
      for (let i = 1; i < masuk.length; i++) if (masuk[i] === ETX) { t = i; break; }
      if (t < 0 || masuk.length < t + 4) break;                 // frame belum utuh
      catat('←', masuk.slice(2, t).toString('latin1'));         // buang STX + nomor frame
      masuk = masuk.slice(t + 4);
      if (masuk.length && masuk[0] === 0x0A) masuk = masuk.slice(1);
      sock.write(Buffer.from([ACK]));
      continue;
    }
    if (b0 === VT) {                                            // balasan HL7 (ACK MLLP)
      const akhir = masuk.indexOf(FS);
      if (akhir < 0) break;
      catat('←', masuk.slice(1, akhir).toString('latin1').replace(/\r/g, ' | '));
      masuk = masuk.slice(akhir + 2);
      setTimeout(() => { console.log('\nSelesai.\n'); sock.end(); }, 300);
      continue;
    }
    masuk = masuk.slice(1);                                     // byte tak dikenal
  }
});

sock.on('error', (e) => {
  console.error(`${warna.err}Gagal terhubung ke ${HOST}:${PORT} — ${e.message}${warna.off}`);
  console.error('Pastikan connector berjalan dan alat ini dikonfigurasi mode "server" pada porta itu.\n');
  process.exit(1);
});
sock.on('close', () => process.exit(0));
