#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════
// OneLab Connector — Jembatan Alat Lab (LIS) ↔ Supabase
// ──────────────────────────────────────────────────────────────────────
// Jalankan di PC/mini-PC yang SATU JARINGAN (LAN) dengan alat lab.
// Alat bicara TCP mentah (ASTM E1381/E1394 atau HL7 MLLP); connector ini:
//   1. Menjadi TCP server (alat konek ke IP:port connector)  ATAU
//      TCP client (connector konek ke IP:port alat)          — per config.
//   2. Menangani framing + ACK (alat WAJIB dibalas ACK).
//   3. Meneruskan pesan mentah ke Supabase (RPC analyzer_ingest, HTTPS).
//   4. (Dua-arah) merespons host-query dengan order dari analyzer_pending_orders.
//
// Konfigurasi alat dibaca dari DB (RPC analyzer_config) — sumber kebenaran =
// master "analyzers" di OneLab (isi IP/port/mode/protocol di UI).
//
// Tanpa dependensi eksternal. Node.js 18+ (butuh global fetch).
//   Jalankan:  node onelab-connector.js
//   Config  :  env SUPABASE_URL / SUPABASE_KEY  ATAU file config.json
// ══════════════════════════════════════════════════════════════════════
'use strict';
const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Alamat IPv4 LAN PC ini (untuk diisi di master Alat OneLab, mode server).
function localIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    for (const ni of (ifaces[name] || [])) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

// ── Konfigurasi koneksi Supabase ──────────────────────────────────────
let CFG = {};
try { CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (_) {}
const SUPABASE_URL = process.env.SUPABASE_URL || CFG.supabase_url || 'https://rmyqzyfvlmjxtatpctks.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || CFG.supabase_key || '';
const REFRESH_MS   = (CFG.refresh_seconds || 60) * 1000;
const STATUS_PORT  = CFG.status_port || 9999;
if (!SUPABASE_KEY) { console.error('❌ SUPABASE_KEY belum diset (env atau config.json). Berhenti.'); process.exit(1); }

const HDR = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
async function rpc(fn, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: HDR, body: JSON.stringify(args || {}) });
  if (!r.ok) throw new Error(`RPC ${fn} HTTP ${r.status}`);
  return r.json();
}

// ── Status hidup (dipakai halaman status lokal http://localhost:PORT) ──
const STATE = { started: new Date(), devices: new Map(), logs: [], rawStream: [] };
function pushLog(line) { STATE.logs.push(line); if (STATE.logs.length > 250) STATE.logs.shift(); }
const log = (...a) => {
  const line = new Date().toISOString().slice(11, 19) + ' ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  console.log(line); pushLog(line);
};

function pushRawStream(deviceName, direction, protocol, raw) {
  STATE.rawStream.push({
    timestamp: new Date(),
    device: deviceName,
    direction: direction || 'IN',
    protocol: protocol || 'HL7',
    data: String(raw)
  });
  if (STATE.rawStream.length > 500) STATE.rawStream.shift();
}

// ── Kode kontrol protokol ─────────────────────────────────────────────
const ENQ = 0x05, ACK = 0x06, NAK = 0x15, STX = 0x02, ETX = 0x03, ETB = 0x17, EOT = 0x04, CR = 0x0D, LF = 0x0A;
const VT = 0x0B, FS = 0x1C; // HL7 MLLP

const INGEST_QUEUE = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  if (INGEST_QUEUE.length === 0) return;
  isProcessingQueue = true;
  while (INGEST_QUEUE.length > 0) {
    const item = INGEST_QUEUE[0];
    try {
      const res = await rpc('analyzer_ingest', {
        p: {
          analyzer_code: item.analyzer.code,
          analyzer_id: item.analyzer.id,
          protocol: item.protocol,
          raw_text: item.raw,
          direction: item.direction
        }
      });
      log(`  ⇢ [QUEUE] ingest ${item.analyzer.name} (${item.protocol}, ${item.raw.length}b) id=${res && res.id}`);
      const d = STATE.devices.get(item.analyzer.id);
      if (d && item.direction === 'IN') {
        d.msgCount++;
        d.lastMsgAt = new Date();
        d.lastRaw = String(item.raw).slice(0, 4000);
        d.lastError = null;
        d.lastErrorAt = null;
      }
      INGEST_QUEUE.shift(); // remove from queue on success
    } catch (e) {
      item.attempts = (item.attempts || 0) + 1;
      log(`  ⚠ [QUEUE] ingest gagal (${item.analyzer.name}) (ke-${item.attempts}): ${e.message}`);
      const d = STATE.devices.get(item.analyzer.id);
      if (d) {
        d.lastError = `ingest gagal (ke-${item.attempts}): ${e.message}`;
        d.lastErrorAt = new Date();
      }
      // Wait with backoff before retry (max 10s)
      const delay = Math.min(1000 * Math.pow(2, item.attempts - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  isProcessingQueue = false;
}

// Kirim pesan mentah ke Supabase (non-fatal bila gagal — jangan putus koneksi alat)
function ingest(analyzer, protocol, raw, direction) {
  const dir = direction || 'IN';
  pushRawStream(analyzer.name, dir, protocol, raw);
  INGEST_QUEUE.push({ analyzer, protocol, raw, direction: dir, attempts: 0 });
  processQueue();
}

// ══════════════════════════════════════════════════════════════════════
// Handler per-koneksi: deteksi & rakit ASTM/HL7, balas ACK, ingest.
// ══════════════════════════════════════════════════════════════════════
function attachHandler(socket, analyzer) {
  let buf = Buffer.alloc(0);
  let astm = [];          // kumpulan teks frame ASTM dalam satu sesi (STX..EOT)
  const proto = (analyzer.protocol || '').toUpperCase();

  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let advanced = true;
    while (advanced && buf.length) {
      advanced = false;
      const b0 = buf[0];

      // Saat connector sedang MENGIRIM (host query dijawab), ACK/NAK dari alat
      // adalah balasan untuk kita — bukan sampah. Tanpa cabang ini byte itu
      // jatuh ke "byte tak dikenal" di bawah dan pengiriman menggantung.
      const tx = socket._tx;
      if (tx && tx.menunggu && (b0 === ACK || b0 === NAK)) {
        buf = buf.slice(1);
        tx.menunggu(b0);
        advanced = true; continue;
      }

      // ── HL7 MLLP: VT ... FS CR ──
      if (b0 === VT || (proto === 'HL7' && b0 !== ENQ && b0 !== STX && b0 !== EOT)) {
        const start = buf.indexOf(VT);
        if (start < 0) { buf = Buffer.alloc(0); break; }
        const end = buf.indexOf(FS, start + 1);
        if (end < 0) break; // tunggu sisa
        const msg = buf.slice(start + 1, end).toString('latin1');
        buf = buf.slice(end + 2); // buang FS + CR
        ingest(analyzer, 'HL7', msg, 'IN');
        socket.write(hl7Ack(msg));         // MLLP ACK
        if (analyzer.direction === 'twoway') maybeSendOrders(socket, analyzer, msg, 'HL7');
        advanced = true; continue;
      }

      // ── ASTM: ENQ / STX-frame / EOT ──
      if (b0 === ENQ) { socket.write(Buffer.from([ACK])); astm = []; buf = buf.slice(1); advanced = true; continue; }
      if (b0 === EOT) {
        buf = buf.slice(1);
        if (astm.length) {
          const full = astm.join(''); astm = [];
          // Hasil bahan kontrol dialihkan ke lab_qc_runs, tidak dicampur
          // ke jalur hasil pasien.
          const qc = pisahkanQcAstm(full);
          if (qc.length) kirimQc(analyzer, qc);
          else ingest(analyzer, 'ASTM', full, 'IN');
          if (analyzer.direction === 'twoway') maybeSendOrders(socket, analyzer, full, 'ASTM');
        }
        advanced = true; continue;
      }
      if (b0 === STX) {
        // <STX> FN data <ETX|ETB> C1 C2 <CR><LF>
        let term = -1;
        for (let i = 1; i < buf.length; i++) { if (buf[i] === ETX || buf[i] === ETB) { term = i; break; } }
        if (term < 0) break;               // frame belum lengkap
        if (buf.length < term + 4) break;  // tunggu checksum + CRLF
        const text = buf.slice(2, term).toString('latin1'); // buang STX + nomor frame
        astm.push(text);
        buf = buf.slice(term + 4);         // buang ETX/ETB + 2 checksum + CR (+LF ditangani loop)
        if (buf.length && buf[0] === LF) buf = buf.slice(1);
        socket.write(Buffer.from([ACK]));  // ACK per frame
        advanced = true; continue;
      }

      // Byte tak dikenal (CR/LF sisa dsb) — buang 1 byte agar tak macet
      buf = buf.slice(1); advanced = true;
    }
  });
  socket.on('error', (e) => {
    log(`  ⚠ socket ${analyzer.name}: ${e.message}`);
    const d = STATE.devices.get(analyzer.id);
    if (d) {
      d.lastError = `socket error: ${e.message}`;
      d.lastErrorAt = new Date();
    }
  });
}

// HL7 ACK minimal (MSH + MSA|AA) dibungkus MLLP
function hl7Ack(inMsg) {
  let ctrlId = '1', sendApp = 'OneLab', recvApp = 'ANALYZER';
  const msh = (inMsg.split(/\r|\n/)[0] || '').split('|');
  if (msh[0] === 'MSH') { ctrlId = msh[9] || '1'; recvApp = msh[2] || recvApp; }
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const ack = `MSH|^~\\&|${sendApp}||${recvApp}||${ts}||ACK|${ctrlId}|P|2.3\rMSA|AA|${ctrlId}\r`;
  return Buffer.concat([Buffer.from([VT]), Buffer.from(ack, 'latin1'), Buffer.from([FS, CR])]);
}

// ══════════════════════════════════════════════════════════════════════
// DUA ARAH — host query
//
// Alat menanyakan "sampel dengan barcode X mau diperiksa apa?", host
// menjawab dengan order. Sebelumnya barcode yang ditanyakan TIDAK dibaca,
// sehingga SELURUH order tertunda dikirim balik untuk setiap query. Pada
// alat sibuk itu berarti puluhan sampel dijawabkan atas satu pertanyaan,
// dan alat bisa menjalankan panel milik sampel lain.
// ══════════════════════════════════════════════════════════════════════

// Barcode yang ditanyakan alat.
//   ASTM E1394 : Q|1|^^123456^|...   → field ke-3, di antara caret
//   HL7 QRY^Q02: QRD-8 (who-subject-filter)
//   HL7 QBP    : QPD-3
function ambilBarcodeQuery(incoming, protocol) {
  if (protocol === 'ASTM') {
    const q = (incoming.split(/\r|\n/).find(b => /^Q\|/.test(b)) || '').split('|');
    const rentang = q[2] || '';
    const bagian = rentang.split('^').map(s => s.trim()).filter(Boolean);
    return bagian.length ? bagian[bagian.length - 1] : '';
  }
  for (const seg of incoming.split(/\r|\n/)) {
    const f = seg.split('|');
    if (f[0] === 'QRD' && f[8]) return f[8].split('^')[0].trim();
    if (f[0] === 'QPD' && f[3]) return f[3].split('^')[0].trim();
  }
  return '';
}

// Selalu lebih pendek daripada timeout host-query alat (umumnya 10–30 detik).
const ORDER_TIMEOUT_MS = parseInt(CFG.order_timeout_ms, 10) || 5000;

function apakahQuery(incoming, protocol) {
  if (protocol === 'ASTM') return /(^|\r|\n)Q\|/.test(incoming);
  // ORM^O01 SENGAJA tidak dianggap query: itu pesan ORDER yang dikirim host
  // KE alat, bukan pertanyaan dari alat. Memperlakukannya sebagai query
  // membuat connector membalas order atas pesan order.
  return /\|QRY\^|\|QBP\^/.test(incoming);
}

async function maybeSendOrders(socket, analyzer, incoming, protocol) {
  if (!apakahQuery(incoming, protocol)) return;

  const barcode = ambilBarcodeQuery(incoming, protocol);
  let orders = [];
  try {
    // Batas waktu WAJIB. Alat sedang menunggu jawaban di ujung sana; bila
    // pengambilan order menggantung (internet klinik putus, Supabase lambat),
    // alat ikut menggantung sampai timeout internalnya sendiri dan sampel
    // berhenti diproses. Lebih baik dijawab "tidak ada order" dalam hitungan
    // detik — alat akan bertanya lagi.
    orders = await Promise.race([
      rpc('analyzer_pending_orders', { p_analyzer_id: analyzer.id }),
      new Promise((_, tolak) =>
        setTimeout(() => tolak(new Error('batas waktu 5 dtk terlampaui')), ORDER_TIMEOUT_MS)),
    ]);
  } catch (e) {
    log(`  ⚠ ambil order gagal (${e.message}) — dijawab kosong agar alat tidak menggantung`);
    orders = [];
  }
  orders = Array.isArray(orders) ? orders : [];

  // Saring ke barcode yang ditanyakan. Bila alat bertanya tanpa menyebut
  // barcode (query "semua"), barulah seluruh order tertunda dikirim.
  if (barcode) {
    orders = orders.filter(o => String(o.barcode || '').trim() === barcode);
    log(`  ↔ query ${analyzer.name} barcode=${barcode} → ${orders.length} order`);
  } else {
    log(`  ↔ query ${analyzer.name} tanpa barcode → ${orders.length} order tertunda`);
  }

  // Balasan kosong TETAP dikirim. Banyak alat menunggu jawaban dan berhenti
  // memproses bila host diam — lebih buruk daripada dijawab "tidak ada".
  if (protocol === 'ASTM') await sendAstmOrders(socket, orders);
  else sendHl7Orders(socket, analyzer, orders);

  ingest(analyzer, protocol,
    `[ORDER→ALAT] barcode=${barcode || '(semua)'} jumlah=${orders.length}`, 'OUT');
}
function astmFrame(n, text) {
  const body = String(n % 8) + text; // FN + data
  const withEtx = body + String.fromCharCode(ETX);
  let sum = 0; for (const ch of withEtx) sum = (sum + ch.charCodeAt(0)) & 0xFF;
  const cs = sum.toString(16).toUpperCase().padStart(2, '0');
  return Buffer.from(String.fromCharCode(STX) + withEtx + cs + '\r\n', 'latin1');
}
// Menunggu satu byte balasan (ACK/NAK) dari alat. Byte itu ditangkap oleh
// penangan 'data' lewat socket._tx — tanpa itu, ACK dari alat akan dibuang
// sebagai "byte tak dikenal" dan pengiriman menggantung.
// PENTING: penunggu didaftarkan LEBIH DULU, baru byte-nya ditulis. Bila
// urutannya dibalik, balasan alat yang datang sangat cepat tiba saat belum
// ada yang menunggunya — byte itu ikut terbuang dan pengiriman menggantung
// sampai timeout. Balapan itu jarang terjadi, tapi tidak boleh disisakan.
function kirimDanTunggu(socket, data, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const tx = socket._tx || (socket._tx = {});
    const selesai = (nilai) => { clearTimeout(t); tx.menunggu = null; resolve(nilai); };
    const t = setTimeout(() => selesai(null), timeoutMs);   // null = timeout
    tx.menunggu = selesai;
    socket.write(data);
  });
}

// ASTM E1381: tiap frame harus di-ACK sebelum frame berikutnya dikirim.
// Versi sebelumnya menulis seluruh frame sekaligus tanpa menunggu apa pun;
// alat sungguhan akan menolak atau kehilangan sebagian besar isinya.
async function kirimFrameAstm(socket, frame, label) {
  for (let coba = 1; coba <= 6; coba++) {      // ASTM: maksimal 6 percobaan
    const balas = await kirimDanTunggu(socket, frame);
    if (balas === ACK) return true;
    if (balas === null) { log(`  ⚠ ASTM ${label}: tidak ada balasan (timeout)`); return false; }
    log(`  ⚠ ASTM ${label}: NAK, ulang ke-${coba}`);
  }
  log(`  ⚠ ASTM ${label}: gagal setelah 6 percobaan`);
  return false;
}

async function sendAstmOrders(socket, orders) {
  const jalur = await kirimDanTunggu(socket, Buffer.from([ENQ]));
  if (jalur !== ACK) {
    log(`  ⚠ ASTM: alat tidak memberi ACK atas ENQ — pengiriman order dibatalkan`);
    return false;
  }

  let n = 1;
  const kirim = (teks, label) => kirimFrameAstm(socket, astmFrame(n++, teks), label);

  if (!await kirim(`H|\\^&|||OneLab`, 'header')) { socket.write(Buffer.from([EOT])); return false; }

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (!await kirim(`P|${i + 1}|||${o.barcode}|${o.patient_name || ''}`, `P#${i + 1}`)) break;
    const tests = (o.tests || []).map(t => `^^^${t}`).join('\\');
    if (!await kirim(`O|1|${o.barcode}||${tests}|R`, `O#${i + 1}`)) break;
  }

  await kirim(`L|1|N`, 'terminator');
  socket.write(Buffer.from([EOT]));
  return true;
}
function sendHl7Orders(socket, analyzer, orders) {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  orders.forEach((o) => {
    const seg = [`MSH|^~\\&|OneLab||${analyzer.code || ''}||${ts}||ORM^O01|${o.barcode}|P|2.3`,
      `PID|||${o.barcode}||${o.patient_name || ''}`,
      `ORC|NW|${o.barcode}`,
      ...(o.tests || ['ALL']).map(t => `OBR|1|${o.barcode}||${t}`)].join('\r') + '\r';
    socket.write(Buffer.concat([Buffer.from([VT]), Buffer.from(seg, 'latin1'), Buffer.from([FS, CR])]));
  });
}

// ══════════════════════════════════════════════════════════════════════
// AUTO-UPLOAD QC
//
// Hasil bahan kontrol yang dikirim alat selama ini masuk ke jalur hasil
// pasien yang sama, sehingga nilai QC bercampur dengan hasil pasien dan
// grafik Levey-Jennings harus diisi manual.
//
// CATATAN: penandaan QC BERBEDA TIAP ALAT. Dua pola paling umum dipakai di
// bawah — kode aksi 'Q' pada record O (ASTM), dan pola barcode. Sesuaikan
// `qc_pattern` di config.json bila alat Anda memakai penanda lain.
// ══════════════════════════════════════════════════════════════════════

const QC_PATTERN = (() => {
  try { return new RegExp(CFG.qc_pattern || '^(QC|CTRL|CONTROL)', 'i'); }
  catch (e) { log(`⚠ qc_pattern tidak sah, memakai bawaan: ${e.message}`); return /^(QC|CTRL|CONTROL)/i; }
})();

// Memisahkan sesi ASTM menjadi hasil QC bila ditandai sebagai kontrol.
// Mengembalikan [] bila sesi ini bukan QC — pemanggil lanjut seperti biasa.
function pisahkanQcAstm(raw) {
  const baris = raw.split(/\r|\n/).map(s => s.trim()).filter(Boolean);

  const rekO = baris.find(b => /^O\|/.test(b));
  const rekP = baris.find(b => /^P\|/.test(b));
  if (!rekO) return [];

  const fO = rekO.split('|');
  const spesimen = (fO[2] || '').split('^')[0].trim();
  const kodeAksi = (fO[11] || '').trim().toUpperCase();   // O-12: 'Q' = kontrol

  const iniQc = kodeAksi === 'Q' || QC_PATTERN.test(spesimen);
  if (!iniQc) return [];

  // Level & lot biasanya menumpang di ID spesimen atau nama "pasien".
  const namaP = rekP ? (rekP.split('|')[5] || '') : '';
  const level = (spesimen.match(/(L(?:EVEL)?\s?[123]|NORMAL|ABNORMAL|HIGH|LOW)/i) || [])[1]
             || (namaP.match(/(L(?:EVEL)?\s?[123]|NORMAL|ABNORMAL|HIGH|LOW)/i) || [])[1] || null;
  const lot = (spesimen.match(/LOT[:\-]?([A-Z0-9]+)/i) || [])[1] || null;

  const hasil = [];
  for (const b of baris) {
    if (!/^R\|/.test(b)) continue;
    const f = b.split('|');
    const kodeTes = (f[2] || '').split('^').filter(Boolean).pop() || '';
    const nilai = parseFloat(f[3]);
    if (!kodeTes || !Number.isFinite(nilai)) continue;     // jangan kirim nilai karangan
    hasil.push({ test_name: kodeTes, measured: nilai, qc_level: level, lot_number: lot });
  }
  return hasil;
}

// ── Penilaian Westgard ────────────────────────────────────────────────
// Mencatat angka QC saja belum menjadi bukti mutu; yang dinilai auditor
// adalah apakah rentetannya melanggar aturan. Aturan yang memerlukan
// riwayat (2-2s, R-4s, 4-1s, 10x) memakai run sebelumnya pada alat, tes,
// dan level yang sama.
//
// `riwayatZ` = z-score run sebelumnya, urut dari yang TERBARU.
function nilaiWestgard(z, riwayatZ = []) {
  const abs = Math.abs(z);
  const semua = [z, ...riwayatZ];                       // termasuk run ini
  const sama = (a, b) => (a >= 0) === (b >= 0);         // sisi yang sama terhadap mean

  // 1-3s — kesalahan acak besar. Paling tegas, dicek lebih dulu.
  if (abs > 3) return { verdict: 'REJECT', rule: '1-3s',
    catatan: 'Menyimpang >3 SD. Tolak batch, telusuri alat/reagen sebelum melanjutkan.' };

  // R-4s — selisih dua run berturut pada sisi berlawanan melebihi 4 SD.
  if (riwayatZ.length >= 1 && Math.abs(z - riwayatZ[0]) > 4 && !sama(z, riwayatZ[0]))
    return { verdict: 'REJECT', rule: 'R-4s',
      catatan: 'Rentang dua run >4 SD berlawanan arah. Indikasi kesalahan acak.' };

  // 2-2s — dua run berturut >2 SD pada sisi yang sama.
  if (abs > 2 && riwayatZ.length >= 1 && Math.abs(riwayatZ[0]) > 2 && sama(z, riwayatZ[0]))
    return { verdict: 'REJECT', rule: '2-2s',
      catatan: 'Dua run berturut >2 SD searah. Indikasi kesalahan sistematik.' };

  // 4-1s — empat run berturut >1 SD pada sisi yang sama.
  if (semua.length >= 4 && semua.slice(0, 4).every(v => Math.abs(v) > 1 && sama(v, z)))
    return { verdict: 'REJECT', rule: '4-1s',
      catatan: 'Empat run berturut >1 SD searah. Pergeseran sistematik.' };

  // 10x — sepuluh run berturut pada sisi yang sama, sekecil apa pun simpangannya.
  if (semua.length >= 10 && semua.slice(0, 10).every(v => sama(v, z)))
    return { verdict: 'REJECT', rule: '10x',
      catatan: 'Sepuluh run berturut di sisi yang sama. Bias terhadap mean.' };

  // 1-2s — bukan penolakan, melainkan tanda waspada.
  if (abs > 2) return { verdict: 'WARNING', rule: '1-2s',
    catatan: 'Satu run >2 SD. Amati run berikutnya sebelum menyimpulkan.' };

  return { verdict: 'PASS', rule: null, catatan: null };
}

async function ambilLot(analyzer, r) {
  const q = new URLSearchParams({
    select: 'target,sd,unit,lot_number',
    analyzer_id: `eq.${analyzer.id}`,
    test_name: `eq.${r.test_name}`,
    is_active: 'eq.true',
    limit: '1',
  });
  if (r.qc_level) q.set('qc_level', `eq.${r.qc_level}`);
  if (r.lot_number) q.set('lot_number', `eq.${r.lot_number}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lab_qc_lots?${q}`, { headers: HDR });
  if (!res.ok) return null;
  const d = await res.json().catch(() => []);
  return Array.isArray(d) && d[0] ? d[0] : null;
}

async function ambilRiwayatZ(analyzer, r, n = 10) {
  const q = new URLSearchParams({
    select: 'z_score',
    analyzer_id: `eq.${analyzer.id}`,
    test_name: `eq.${r.test_name}`,
    order: 'run_at.desc',
    limit: String(n),
  });
  if (r.qc_level) q.set('qc_level', `eq.${r.qc_level}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lab_qc_runs?${q}`, { headers: HDR });
  if (!res.ok) return [];
  const d = await res.json().catch(() => []);
  return (Array.isArray(d) ? d : [])
    .map(x => parseFloat(x.z_score)).filter(Number.isFinite);
}

async function kirimQc(analyzer, runs) {
  if (!runs.length) return;

  const baris = [];
  for (const r of runs) {
    const dasar = {
      analyzer_id: analyzer.id, analyzer_name: analyzer.name,
      test_name: r.test_name, measured: r.measured,
      qc_level: r.qc_level, lot_number: r.lot_number,
      run_by: 'connector',
    };

    let lot = null;
    try { lot = await ambilLot(analyzer, r); } catch (e) { /* dinilai tanpa lot di bawah */ }

    if (!lot) {
      // Tanpa target & SD, z-score tidak bisa dihitung. Angkanya tetap
      // disimpan agar tidak hilang, tetapi TIDAK dinilai — memberi verdict
      // tanpa dasar sama saja mengarang bukti mutu.
      baris.push({ ...dasar, notes: 'Otomatis dari alat — lot QC belum terdaftar, belum dinilai' });
      log(`  ⚠ QC ${r.test_name} (${r.qc_level || 'tanpa level'}): lot belum terdaftar di lab_qc_lots`);
      continue;
    }

    const z = (r.measured - Number(lot.target)) / Number(lot.sd);
    let riwayat = [];
    try { riwayat = await ambilRiwayatZ(analyzer, r); } catch (e) { /* aturan rentetan dilewati */ }
    const nilai = nilaiWestgard(z, riwayat);

    baris.push({
      ...dasar,
      target: Number(lot.target), sd: Number(lot.sd),
      z_score: Number(z.toFixed(3)),
      verdict: nilai.verdict,
      notes: nilai.rule ? `${nilai.rule} — ${nilai.catatan}` : 'Otomatis dari alat — dalam batas',
    });

    if (nilai.verdict === 'REJECT')
      log(`  ⛔ QC ${r.test_name} ${nilai.rule}: z=${z.toFixed(2)} — batch perlu ditahan`);
    else if (nilai.verdict === 'WARNING')
      log(`  ⚡ QC ${r.test_name} 1-2s: z=${z.toFixed(2)}`);
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lab_qc_runs`, {
      method: 'POST', headers: HDR, body: JSON.stringify(baris),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
    const ditolak = baris.filter(b => b.verdict === 'REJECT').length;
    log(`  ✓ QC otomatis: ${baris.length} hasil dari ${analyzer.name}` +
        (ditolak ? ` — ${ditolak} REJECT` : ''));
  } catch (e) {
    // Jangan diamkan: QC yang gagal naik berarti bukti mutu hilang.
    log(`  ⚠ QC gagal diunggah (${analyzer.name}): ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// Bind alat: server (listen) atau client (connect + reconnect)
// ══════════════════════════════════════════════════════════════════════
const bound = new Map(); // id -> server/socket
function bindAnalyzer(a) {
  if (bound.has(a.id)) return;
  if (!a.port) { log(`⚠ ${a.name}: port kosong — dilewati`); return; }
  const dev = { name: a.name, code: a.code, mode: a.mode || 'server', ip: a.ip, port: a.port,
    protocol: a.protocol, direction: a.direction, connected: false, connectedFrom: null,
    msgCount: 0, lastMsgAt: null, lastError: null, lastErrorAt: null, boundAt: new Date() };
  STATE.devices.set(a.id, dev);
  if ((a.mode || 'server') === 'server') {
    const server = net.createServer((sock) => {
      log(`🔌 ${a.name}: alat terhubung dari ${sock.remoteAddress}`);
      dev.connected = true; dev.connectedFrom = sock.remoteAddress;
      dev.lastError = null;
      dev.lastErrorAt = null;
      attachHandler(sock, a);
      sock.on('close', () => { log(`⏻ ${a.name}: koneksi ditutup`); dev.connected = false; dev.connectedFrom = null; });
    });
    server.on('error', (e) => {
      log(`❌ ${a.name} server error: ${e.message}`);
      dev.lastError = `server error: ${e.message}`;
      dev.lastErrorAt = new Date();
    });
    server.listen(a.port, () => log(`🟢 ${a.name}: LISTEN :${a.port} (${a.protocol}, ${a.direction}) — isi IP PC ini + port ${a.port} di alat`));
    bound.set(a.id, server);
  } else {
    const connect = () => {
      const sock = net.connect(a.port, a.ip, () => {
        log(`🟢 ${a.name}: CONNECT ${a.ip}:${a.port} (${a.protocol})`);
        dev.connected = true;
        dev.lastError = null;
        dev.lastErrorAt = null;
      });
      attachHandler(sock, a);
      sock.on('close', () => { log(`⏻ ${a.name}: putus — reconnect 5s`); dev.connected = false; setTimeout(connect, 5000); });
      sock.on('error', (e) => {
        log(`❌ ${a.name} connect error: ${e.message}`);
        dev.lastError = `connect error: ${e.message}`;
        dev.lastErrorAt = new Date();
      });
    };
    connect();
    bound.set(a.id, true);
  }
}

async function loadAndBind() {
  let cfg = [];
  try { cfg = await rpc('analyzer_config', {}); } catch (e) { log(`❌ baca config gagal: ${e.message}`); return; }
  const cfgList = Array.isArray(cfg) ? cfg : [];
  if (!bound.size) log(`📋 ${cfgList.length} alat aktif dari OneLab`);
  cfgList.forEach(bindAnalyzer);
  if (!cfgList.length && !bound.size) log('ℹ Belum ada alat dengan IP+port+integrasi aktif. Set di OneLab → master Alat.');
}

// ── Status HTML lokal monitor ─────────────────────────────────────────
const STATUS_HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>OneLab Connector — Status</title>
<style>
  :root {
    --bg-dark: #0A1120;
    --card-bg: #131E35;
    --border: #1E2E4E;
    --text-main: #E2E8F0;
    --text-muted: #94A3B8;
    --teal: #14B8A6;
    --red: #F87171;
    --orange: #FB923C;
    --yellow: #FBBF24;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg-dark);color:var(--text-main);padding:24px}
  .container{max-width:1100px;margin:0 auto}
  h1{font-size:20px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;display:flex;align-items:center;gap:8px}
  .sub{font-size:12.5px;color:var(--text-muted);margin-bottom:20px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:20px}
  .dev{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;box-shadow:0 4px 20px rgba(0,0,0,0.15)}
  .dev-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:10px}
  .dev h3{font-size:14.5px;font-weight:700;flex:1}
  .dev .meta{font-size:11.5px;color:var(--text-muted);line-height:1.7}
  .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
  .on{background:#22c55e;box-shadow:0 0 8px #22c55e}
  .off{background:#64748b}
  .err-badge{background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.3);color:var(--red);border-radius:8px;padding:8px 10px;font-size:11px;margin-top:10px;line-height:1.45}
  .bar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
  button{background:var(--teal);color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;transition:opacity 0.15s}
  button:hover{opacity:0.9}
  .split-row {display:flex;gap:20px;margin-top:20px}
  .split-col {flex:1;min-width:0}
  pre{background:#060a14;border:1px solid var(--border);border-radius:12px;padding:14px;font-family:'Consolas',monospace;font-size:11px;line-height:1.6;height:450px;overflow:auto;white-space:pre-wrap}
  .empty{color:var(--text-muted);font-size:12.5px;padding:24px;text-align:center;background:var(--card-bg);border:1px solid var(--border);border-radius:12px}
  .log-err{color:var(--red);font-weight:600}
  .log-warn{color:var(--yellow)}
  .log-success{color:#34d399}
  .raw-item {margin-bottom:14px;border-bottom:1px dashed var(--border);padding-bottom:10px}
  .raw-header {font-size:10.5px;color:var(--teal);margin-bottom:4px;font-weight:700}
  @media (max-width: 768px) {
    .split-row {flex-direction:column}
  }
  .tabs{display:flex;gap:4px;margin-bottom:18px;border-bottom:1px solid var(--border)}
  .tabx{background:none;color:var(--text-muted);border:none;border-bottom:2px solid transparent;border-radius:0;padding:10px 18px;font-weight:700;font-size:13px}
  .tabx:hover{color:var(--text-main);opacity:1}
  .tabx.active{color:var(--teal);border-bottom-color:var(--teal)}
  .lis-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0}
  textarea.lis-in{width:100%;height:190px;background:#060a14;border:1px solid var(--border);border-radius:10px;color:var(--text-main);font-family:'Consolas',monospace;font-size:12px;padding:12px;resize:vertical}
  select.lis-sel{background:#060a14;color:var(--text-main);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:12px;font-weight:600}
  .lis-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
  .lis-tbl th{background:#0e1832;color:var(--text-muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);font-size:10.5px;text-transform:uppercase;letter-spacing:.03em}
  .lis-tbl td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:top}
  .lis-tbl tbody tr:hover{background:#0e1832}
  .lis-H{color:var(--red);font-weight:700}.lis-L{color:#38bdf8;font-weight:700}
  .lis-count{font-size:12px;color:var(--text-muted)}
</style></head><body>
<div class="container">
  <h1>OneLab Connector</h1>
  <div class="sub" id="sub">memuat…</div>

  <div class="tabs">
    <button class="tabx active" id="tabx-status" onclick="switchTab('status')">Status Alat</button>
    <button class="tabx" id="tabx-lis" onclick="switchTab('lis')">LIS — Parsing Manual</button>
  </div>

  <div id="panel-status">
  <div id="ip-banner" style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12.5px;line-height:1.5">memuat IP…</div>
  <div class="bar">
    <button onclick="reload()">Muat ulang config</button>
    <span style="font-size:11.5px;color:var(--text-muted)">Perubahan alat yang sudah aktif butuh restart proses (tutup lalu jalankan lagi).</span>
  </div>
  <div class="grid" id="devs"></div>
  
  <div class="split-row">
    <div class="split-col">
      <div style="font-size:13.5px;font-weight:700;margin-bottom:8px">Log Aktivitas (Live)</div>
      <pre id="log">…</pre>
    </div>
    <div class="split-col">
      <div style="font-size:13.5px;font-weight:700;margin-bottom:8px">Aliran Data Mentah Real-Time (Raw Stream)</div>
      <pre id="raw-stream">…</pre>
    </div>
  </div>
  </div><!-- /panel-status -->

  <div id="panel-lis" style="display:none">
    <div class="sub" style="margin-bottom:4px">Mode manual — untuk dipakai saat cloud sedang maintenance/offline. Tempel pesan mentah dari alat (ASTM / HL7), parse jadi tabel, lalu export ke Excel.</div>
    <div class="lis-toolbar">
      <select class="lis-sel" id="lis-proto"><option value="auto">Auto-deteksi</option><option value="ASTM">ASTM</option><option value="HL7">HL7</option></select>
      <button onclick="lisParse()">Parse</button>
      <button style="background:#334155" onclick="lisClear()">Bersihkan</button>
      <button style="background:#0e7490" onclick="lisExport()">Export Excel</button>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);cursor:pointer;user-select:none"><input type="checkbox" id="lis-auto"> Auto ambil dari alat</label>
      <span class="lis-count" id="lis-count"></span>
    </div>
    <textarea class="lis-in" id="lis-raw" placeholder="Tempel pesan alat di sini...&#10;Contoh ASTM:  R|1|^^^GLU|95|mg/dL|70-110|N&#10;Contoh HL7:   OBX|1|NM|GLU^Glukosa||95|mg/dL|70-110|N"></textarea>
    <div style="overflow-x:auto"><table class="lis-tbl" id="lis-tbl">
      <thead><tr><th>ID Sampel</th><th>Kode Item</th><th>Hasil</th><th>Satuan</th><th>Ref Range</th><th>Flag</th></tr></thead>
      <tbody id="lis-tbody"><tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:20px">Belum ada data. Tempel pesan lalu klik Parse.</td></tr></tbody>
    </table></div>
  </div>
</div>
<script>
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  async function tick(){
    try{
      const r=await fetch('/api/status'); const s=await r.json();
      const up=Math.round((Date.now()-new Date(s.started).getTime())/1000);
      document.getElementById('sub').textContent='Supabase: '+s.supabase+' · Antrean: '+(s.queueSize || 0)+' · uptime '+Math.floor(up/60)+'m '+(up%60)+'s · '+s.devices.length+' alat aktif';
      var ipEl=document.getElementById('ip-banner');
      if(ipEl){ var ips=(s.localIps||[]); ipEl.innerHTML='<b style="color:var(--teal)">IP PC Connector:</b> '+(ips.length?ips.map(function(x){return '<code style="color:#38bdf8;font-size:13.5px">'+esc(x)+'</code>';}).join('&nbsp; , &nbsp;'):'(tidak terdeteksi)')+' &nbsp;·&nbsp; <span style="color:var(--text-muted)">Isi IP ini + port yang sama di master Alat OneLab (mode server) agar alat mengirim hasil ke PC ini.</span>'; }
      
      document.getElementById('devs').innerHTML = s.devices.length ? s.devices.map(d=>{
        const seen=d.lastMsgAt?new Date(d.lastMsgAt).toLocaleTimeString('id-ID'):'—';
        const errTime=d.lastErrorAt?new Date(d.lastErrorAt).toLocaleTimeString('id-ID'):'';
        
        let errHtml = '';
        if (d.lastError) {
          errHtml = '<div class="err-badge"><b>⚠️ Error Terakhir:</b><br>' + esc(d.lastError) + (errTime ? ' (' + errTime + ')' : '') + '</div>';
        }
        
        return '<div class="dev">' +
          '<div class="dev-header"><h3><span class="dot '+(d.connected?'on':'off')+'"></span>'+esc(d.name||'?')+'</h3><span style="font-size:11px;color:var(--text-muted)">'+esc(d.protocol||'')+'</span></div>'+
          '<div class="meta">'+
            'Mode: <b>'+(d.mode==='server'?'Server (LISTEN)':'Client (CONNECT)')+'</b><br>'+
            'Koneksi: <b>'+(d.mode==='server'?('Port :'+d.port):('Target '+esc(d.ip||'')+':'+d.port))+'</b><br>'+
            'Arah: <b>'+(d.direction==='twoway'?'2 Arah (Host-Query)':'1 Arah (Masuk saja)')+'</b><br>'+
            'Pesan Sukses: <b style="color:var(--teal)">'+d.msgCount+'</b> · terakhir '+seen +
            (d.connectedFrom?'<br>Connected from: <code>'+esc(d.connectedFrom)+'</code>':'')+'</div>'+
          errHtml +
          (d.lastRaw?'<details style="margin-top:10px"><summary style="cursor:pointer;font-size:11px;color:#14B8A6">Lihat pesan mentah terakhir</summary><pre style="max-height:150px;margin-top:6px;font-size:10.5px;background:#090d16;padding:8px">'+esc(d.lastRaw)+'</pre></details>':'')+
          '</div>';
      }).join('') : '<div class="empty">Belum ada alat terdaftar. Set IP/port & aktifkan integrasi di OneLab → master Alat.</div>';
      
      // Highlight logs
      const logText = (s.logs||[]).map(l => {
        const lower = l.toLowerCase();
        if (lower.includes('gagal') || lower.includes('error') || lower.includes('❌')) {
          return '<span class="log-err">' + esc(l) + '</span>';
        }
        if (lower.includes('warning') || lower.includes('⚠') || lower.includes('putus')) {
          return '<span class="log-warn">' + esc(l) + '</span>';
        }
        if (lower.includes('connect') || lower.includes('listen') || lower.includes('terhubung') || lower.includes('🟢')) {
          return '<span class="log-success">' + esc(l) + '</span>';
        }
        return esc(l);
      }).join('\\n');
      
      const logEl = document.getElementById('log');
      logEl.innerHTML = logText;
      logEl.scrollTop = logEl.scrollHeight; // Auto scroll to bottom

      // Render raw stream
      const rawText = (s.rawStream || []).map(r => {
        const time = new Date(r.timestamp).toLocaleTimeString('id-ID');
        const dirBadge = r.direction === 'IN' ? '📥 [MASUK]' : '📤 [KELUAR]';
        return '<div class="raw-item">' +
          '<div class="raw-header">['+time+'] '+esc(r.device)+' ('+esc(r.protocol)+') '+dirBadge+'</div>' +
          '<div style="color:#38bdf8;word-break:break-all">'+esc(r.data)+'</div>' +
          '</div>';
      }).join('');
      
      const rawEl = document.getElementById('raw-stream');
      rawEl.innerHTML = rawText || '<div style="color:var(--text-muted)">Menunggu aliran data alat lab...</div>';
      rawEl.scrollTop = rawEl.scrollHeight; // Auto scroll to bottom
      lisAutoFeed(s.rawStream); // feed tab LIS dari kiriman alat (jika Auto aktif)
    }catch(e){ document.getElementById('sub').textContent='connector tidak merespons'; }
  }
  async function reload(){ await fetch('/reload',{method:'POST'}); setTimeout(tick,300); }

  // ── Tab LIS: parsing manual ASTM/HL7 (offline, saat cloud maintenance) ──
  var lisRows = [];
  function switchTab(which){
    document.getElementById('panel-status').style.display = which==='status'?'':'none';
    document.getElementById('panel-lis').style.display = which==='lis'?'':'none';
    document.getElementById('tabx-status').classList.toggle('active', which==='status');
    document.getElementById('tabx-lis').classList.toggle('active', which==='lis');
  }
  function isLookLikeBarcode(str) {
    if (!str) return false;
    var clean = String(str).trim();
    if (clean.length < 3) return false;
    if (/^\d+$/.test(clean) && clean.length <= 3) return false;
    return true;
  }
  function lisComp(x){ return String(x==null?'':x).split('^')[0].trim(); }
  function lisLastComp(x){ var p=String(x==null?'':x).split('^').filter(function(s){return s.trim();}); return p.length?p[p.length-1].trim():''; }
  function lisCode(x){ var p=String(x==null?'':x).split('^'); for(var i=0;i<p.length;i++){ if(p[i].trim()) return p[i].trim(); } return ''; }
  function lisRecords(raw){ return String(raw||'').split(/\\r\\n|\\r|\\n/).map(function(s){return s.replace(/[\\x00-\\x1f]/g,'').trim();}).filter(Boolean); }
  function lisDetect(recs){ for(var i=0;i<recs.length;i++){ var r=recs[i].replace(/^\\d+/,''); if(/^MSH\\|/.test(r)||/^OBX\\|/.test(r)||/^PID\\|/.test(r)) return 'HL7'; } return 'ASTM'; }
  function lisParseASTM(recs){
    var out=[], sample='', patId='';
    recs.forEach(function(rec){
      var r=rec.replace(/^\\d+/,'');
      var f=r.split('|');
      var t=(f[0]||'').charAt(0).toUpperCase();
      if(t==='H'){
        sample=''; patId='';
      } else if(t==='P'){
        var b3 = lisComp(f[3]);
        var b2 = lisComp(f[2]);
        var b4 = lisComp(f[4]);
        if (isLookLikeBarcode(b3)) patId = b3;
        else if (isLookLikeBarcode(b2)) patId = b2;
        else if (isLookLikeBarcode(b4)) patId = b4;
        else patId = b3 || b2 || patId;
      } else if(t==='O'){
        var b3 = lisComp(f[3]);
        var b2 = lisComp(f[2]);
        if (isLookLikeBarcode(b2)) sample = b2;
        else if (isLookLikeBarcode(b3)) sample = b3;
        else sample = b3 || b2 || sample;
      } else if(t==='R'){
        out.push({id:sample||patId,code:lisCode(f[2]),result:(f[3]||'').trim(),unit:(f[4]||'').trim(),ref:(f[5]||'').trim(),flag:(f[6]||'').trim()});
      }
    });
    return out;
  }
  function lisParseHL7(recs){
    var out=[], sample='', pid='';
    recs.forEach(function(rec){
      var f=rec.split('|');
      var t=(f[0]||'').toUpperCase();
      if(t==='MSH'){
        sample=''; pid='';
      } else if(t==='OBR'){
        var b2 = lisComp(f[2]);
        var b3 = lisComp(f[3]);
        if (isLookLikeBarcode(b2)) sample = b2;
        else if (isLookLikeBarcode(b3)) sample = b3;
        else sample = b3 || b2 || sample;
      } else if(t==='PID'){
        var b3 = lisComp(f[3]);
        var b2 = lisComp(f[2]);
        var b5 = lisComp(f[5]);
        if (isLookLikeBarcode(b3)) pid = b3;
        else if (isLookLikeBarcode(b2)) pid = b2;
        else if (isLookLikeBarcode(b5)) pid = b5;
        else pid = b3 || b2 || pid;
      } else if(t==='SPM'){
        var b2 = lisComp(f[2]);
        if (isLookLikeBarcode(b2)) sample = b2;
        else sample = b2 || sample;
      } else if(t==='OBX'){
        out.push({id:sample||pid,code:lisCode(f[3]),result:(f[5]||'').trim(),unit:(f[6]||'').trim(),ref:(f[7]||'').trim(),flag:(f[8]||'').trim()});
      }
    });
    return out;
  }
  function lisParse(){ var raw=document.getElementById('lis-raw').value; var recs=lisRecords(raw); if(!recs.length){ lisRows=[]; lisRender(); return; } var proto=document.getElementById('lis-proto').value; if(proto==='auto') proto=lisDetect(recs); lisRows = proto==='HL7'?lisParseHL7(recs):lisParseASTM(recs); lisRender(proto); }
  function lisFlag(fl){ var f=(fl||'').toUpperCase(); if(f.indexOf('H')>=0) return '<span class="lis-H">'+esc(fl)+'</span>'; if(f.indexOf('L')>=0) return '<span class="lis-L">'+esc(fl)+'</span>'; return esc(fl||'—'); }
  function lisRender(proto){ var tb=document.getElementById('lis-tbody'); var cnt=document.getElementById('lis-count'); if(!lisRows.length){ tb.innerHTML='<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:20px">Tidak ada baris hasil (R/OBX) terdeteksi. Cek protokol atau format pesan.</td></tr>'; cnt.textContent=''; return; } tb.innerHTML=lisRows.map(function(x){ return '<tr><td>'+esc(x.id||'—')+'</td><td style="font-weight:700;color:var(--teal)">'+esc(x.code||'—')+'</td><td>'+esc(x.result||'—')+'</td><td>'+esc(x.unit||'')+'</td><td>'+esc(x.ref||'')+'</td><td>'+lisFlag(x.flag)+'</td></tr>'; }).join(''); cnt.textContent=lisRows.length+' hasil'+(proto?' ('+proto+')':''); }
  function lisClear(){ document.getElementById('lis-raw').value=''; lisRows=[]; lisRender(); }
  // Auto ambil kiriman terbaru dari alat (direction IN) lalu parse — sumber data
  // tetap dari alat, pengolahan tetap manual (bisa dimatikan lewat checkbox).
  var lisFeedSig = '';
  function lisAutoFeed(rawStream){
    var cb=document.getElementById('lis-auto'); if(!cb||!cb.checked) return;
    var ins=(rawStream||[]).filter(function(r){return r.direction==='IN';});
    if(!ins.length) return;
    var sig=ins.length+'|'+new Date(ins[ins.length-1].timestamp).getTime();
    if(sig===lisFeedSig) return;   // tak ada pesan baru → jangan re-parse berulang
    lisFeedSig=sig;
    var ta=document.getElementById('lis-raw');
    if(ta){ ta.value=ins.map(function(r){return r.data;}).join('\\r\\n'); lisParse(); }  // gabung SEMUA pesan → semua pasien
  }
  function lisExport(){ if(!lisRows.length){ alert('Belum ada data untuk diexport. Parse pesan dulu.'); return; } var h=['ID Sampel','Kode Item','Hasil','Satuan','Ref Range','Flag']; var rows=lisRows.map(function(x){return [x.id,x.code,x.result,x.unit,x.ref,x.flag];}); var tbl='<table border="1"><tr>'+h.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr>'+rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+esc(c==null?'':c)+'</td>';}).join('')+'</tr>';}).join('')+'</table>'; var blob=new Blob(['\\ufeff<html><head><meta charset="utf-8"></head><body>'+tbl+'</body></html>'],{type:'application/vnd.ms-excel'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); var d=new Date().toISOString().slice(0,10).replace(/-/g,''); a.download='lis_manual_'+d+'.xls'; a.click(); URL.revokeObjectURL(a.href); }

  tick(); setInterval(tick,3000);
</script></body></html>`;

function startStatusServer() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/status')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        started: STATE.started, supabase: SUPABASE_URL,
        queueSize: INGEST_QUEUE.length,
        devices: [...STATE.devices.entries()].map(([id, d]) => ({ id, ...d })),
        logs: STATE.logs.slice(-120),
        rawStream: STATE.rawStream,
        localIps: localIPs()
      }));
      return;
    }
    if (req.url === '/reload' && req.method === 'POST') { loadAndBind(); res.writeHead(200); res.end('ok'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(STATUS_HTML);
  });
  server.on('error', (e) => log(`⚠ status server: ${e.message}`));
  server.listen(STATUS_PORT, '127.0.0.1', () => log(`🖥  Status lokal: http://localhost:${STATUS_PORT}`));
}

// ── Main ──────────────────────────────────────────────────────────────
// Hanya menyala bila berkas ini DIJALANKAN langsung. Saat di-require untuk
// pengujian, tidak ada server yang dibuka dan tidak ada koneksi ke alat.
if (require.main === module) {
  (async () => {
    log('══ OneLab Connector ══');
    log(`Supabase: ${SUPABASE_URL}`);
    startStatusServer();
    await loadAndBind();
    setInterval(loadAndBind, REFRESH_MS); // pungut alat baru tiap menit (restart utk ubah alat yang sudah bind)
  })();
}

// Diekspor untuk pengujian protokol (parsing query, penandaan QC, framing).
module.exports = {
  ambilBarcodeQuery, apakahQuery, pisahkanQcAstm, nilaiWestgard,
  astmFrame, sendAstmOrders, attachHandler,
};
