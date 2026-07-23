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
const STATE = { started: new Date(), devices: new Map(), logs: [] };
function pushLog(line) { STATE.logs.push(line); if (STATE.logs.length > 250) STATE.logs.shift(); }
const log = (...a) => {
  const line = new Date().toISOString().slice(11, 19) + ' ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  console.log(line); pushLog(line);
};

// ── Kode kontrol protokol ─────────────────────────────────────────────
const ENQ = 0x05, ACK = 0x06, NAK = 0x15, STX = 0x02, ETX = 0x03, ETB = 0x17, EOT = 0x04, CR = 0x0D, LF = 0x0A;
const VT = 0x0B, FS = 0x1C; // HL7 MLLP

// Kirim pesan mentah ke Supabase (non-fatal bila gagal — jangan putus koneksi alat)
async function ingest(analyzer, protocol, raw, direction) {
  try {
    const res = await rpc('analyzer_ingest', { analyzer_code: analyzer.code, analyzer_id: analyzer.id,
      protocol, raw_text: raw, direction: direction || 'IN' });
    log(`  ⇢ ingest ${analyzer.name} (${protocol}, ${raw.length}b) id=${res && res.id}`);
    const d = STATE.devices.get(analyzer.id);
    if (d && (direction || 'IN') === 'IN') { d.msgCount++; d.lastMsgAt = new Date(); }
  } catch (e) { log(`  ⚠ ingest gagal (${analyzer.name}): ${e.message}`); }
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
        if (astm.length) { const full = astm.join(''); astm = []; ingest(analyzer, 'ASTM', full, 'IN');
          if (analyzer.direction === 'twoway') maybeSendOrders(socket, analyzer, full, 'ASTM'); }
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
  socket.on('error', (e) => log(`  ⚠ socket ${analyzer.name}: ${e.message}`));
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

// ── Dua-arah (scaffold) — kirim order ke alat saat host-query ──────────
// Deteksi query bersifat SPESIFIK PER ALAT; sesuaikan pola di bawah.
async function maybeSendOrders(socket, analyzer, incoming, protocol) {
  const isQuery = /(^|\r|\n)Q\|/.test(incoming) || /\|ORM\^|\|QRY\^/.test(incoming);
  if (!isQuery) return;
  let orders = [];
  try { orders = await rpc('analyzer_pending_orders', { p_analyzer_id: analyzer.id }); } catch (e) { log(`  ⚠ ambil order gagal: ${e.message}`); return; }
  if (!orders || !orders.length) return;
  if (protocol === 'ASTM') sendAstmOrders(socket, orders);
  else sendHl7Orders(socket, analyzer, orders);
  ingest(analyzer, protocol, `[ORDER→ALAT] ${orders.length} sampel`, 'OUT');
}
function astmFrame(n, text) {
  const body = String(n % 8) + text; // FN + data
  const withEtx = body + String.fromCharCode(ETX);
  let sum = 0; for (const ch of withEtx) sum = (sum + ch.charCodeAt(0)) & 0xFF;
  const cs = sum.toString(16).toUpperCase().padStart(2, '0');
  return Buffer.from(String.fromCharCode(STX) + withEtx + cs + '\r\n', 'latin1');
}
function sendAstmOrders(socket, orders) {
  socket.write(Buffer.from([ENQ]));
  let n = 1;
  socket.write(astmFrame(n++, `H|\\^&|||OneLab`));
  orders.forEach((o, i) => {
    socket.write(astmFrame(n++, `P|${i + 1}|||${o.barcode}|${o.patient_name || ''}`));
    const tests = (o.tests || []).map(t => `^^^${t}`).join('\\');
    socket.write(astmFrame(n++, `O|1|${o.barcode}||${tests}|R`));
  });
  socket.write(astmFrame(n++, `L|1|N`));
  socket.write(Buffer.from([EOT]));
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
// Bind alat: server (listen) atau client (connect + reconnect)
// ══════════════════════════════════════════════════════════════════════
const bound = new Map(); // id -> server/socket
function bindAnalyzer(a) {
  if (bound.has(a.id)) return;
  if (!a.port) { log(`⚠ ${a.name}: port kosong — dilewati`); return; }
  const dev = { name: a.name, code: a.code, mode: a.mode || 'server', ip: a.ip, port: a.port,
    protocol: a.protocol, direction: a.direction, connected: false, connectedFrom: null,
    msgCount: 0, lastMsgAt: null, boundAt: new Date() };
  STATE.devices.set(a.id, dev);
  if ((a.mode || 'server') === 'server') {
    const server = net.createServer((sock) => {
      log(`🔌 ${a.name}: alat terhubung dari ${sock.remoteAddress}`);
      dev.connected = true; dev.connectedFrom = sock.remoteAddress;
      attachHandler(sock, a);
      sock.on('close', () => { log(`⏻ ${a.name}: koneksi ditutup`); dev.connected = false; dev.connectedFrom = null; });
    });
    server.on('error', (e) => log(`❌ ${a.name} server error: ${e.message}`));
    server.listen(a.port, () => log(`🟢 ${a.name}: LISTEN :${a.port} (${a.protocol}, ${a.direction}) — isi IP PC ini + port ${a.port} di alat`));
    bound.set(a.id, server);
  } else {
    const connect = () => {
      const sock = net.connect(a.port, a.ip, () => { log(`🟢 ${a.name}: CONNECT ${a.ip}:${a.port} (${a.protocol})`); dev.connected = true; });
      attachHandler(sock, a);
      sock.on('close', () => { log(`⏻ ${a.name}: putus — reconnect 5s`); dev.connected = false; setTimeout(connect, 5000); });
      sock.on('error', () => {});
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

// ── Main ──────────────────────────────────────────────────────────────
(async () => {
  log('══ OneLab Connector ══');
  log(`Supabase: ${SUPABASE_URL}`);
  await loadAndBind();
  setInterval(loadAndBind, REFRESH_MS); // pungut alat baru tiap menit (restart utk ubah alat yang sudah bind)
})();
