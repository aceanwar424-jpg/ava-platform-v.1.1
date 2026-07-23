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

// ══════════════════════════════════════════════════════════════════════
// Halaman status lokal — http://localhost:PORT (hanya 127.0.0.1, demi PDP:
// log dapat memuat barcode pasien; hanya bisa dibuka DI PC connector).
// ══════════════════════════════════════════════════════════════════════
const STATUS_HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>OneLab Connector — Status</title>
<style>
 *{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0b1220;color:#e2e8f0;padding:16px}
 h1{font-size:16px;font-weight:800}.sub{font-size:12px;color:#94a3b8;margin-bottom:14px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:16px}
 .dev{background:#131c2e;border:1px solid #1e293b;border-radius:10px;padding:12px}
 .dev h3{font-size:13px;font-weight:700}.dev .meta{font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.6}
 .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}
 .on{background:#22c55e}.off{background:#64748b}
 .bar{display:flex;gap:8px;align-items:center;margin-bottom:12px}
 button{background:#0e7c86;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer}
 button.ghost{background:#1e293b}
 pre{background:#060a14;border:1px solid #1e293b;border-radius:10px;padding:12px;font-size:11.5px;line-height:1.55;max-height:46vh;overflow:auto;white-space:pre-wrap}
 .empty{color:#64748b;font-size:12px;padding:14px;text-align:center}
</style></head><body>
 <h1>🔬 OneLab Connector</h1>
 <div class="sub" id="sub">memuat…</div>
 <div class="bar">
   <button onclick="reload()">↻ Muat ulang config</button>
   <span style="font-size:11px;color:#64748b">Perubahan alat yang sudah aktif butuh restart proses (tutup lalu jalankan lagi).</span>
 </div>
 <div class="grid" id="devs"></div>
 <div style="font-size:12px;font-weight:700;margin-bottom:6px">Log</div>
 <pre id="log">…</pre>
<script>
 async function tick(){
   try{
     const r=await fetch('/api/status'); const s=await r.json();
     const up=Math.round((Date.now()-new Date(s.started).getTime())/1000);
     document.getElementById('sub').textContent='Supabase: '+s.supabase+' · uptime '+Math.floor(up/60)+'m '+(up%60)+'s · '+s.devices.length+' alat';
     document.getElementById('devs').innerHTML = s.devices.length ? s.devices.map(d=>{
       const seen=d.lastMsgAt?new Date(d.lastMsgAt).toLocaleTimeString('id-ID'):'—';
       return '<div class="dev"><h3><span class="dot '+(d.connected?'on':'off')+'"></span>'+(d.name||'?')+'</h3>'+
         '<div class="meta">'+(d.mode==='server'?('LISTEN :'+d.port):('CONNECT '+(d.ip||'')+':'+d.port))+' · '+(d.protocol||'')+' · '+(d.direction||'')+'<br>'+
         'Pesan: <b>'+d.msgCount+'</b> · terakhir '+seen+(d.connectedFrom?'<br>dari '+d.connectedFrom:'')+'</div></div>';
     }).join('') : '<div class="empty">Belum ada alat. Set IP/port + aktifkan integrasi di OneLab → master Alat.</div>';
     document.getElementById('log').textContent = (s.logs||[]).join('\\n');
   }catch(e){ document.getElementById('sub').textContent='connector tidak merespons'; }
 }
 async function reload(){ await fetch('/reload',{method:'POST'}); setTimeout(tick,300); }
 tick(); setInterval(tick,3000);
</script></body></html>`;

function startStatusServer() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/status')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        started: STATE.started, supabase: SUPABASE_URL,
        devices: [...STATE.devices.entries()].map(([id, d]) => ({ id, ...d })),
        logs: STATE.logs.slice(-120),
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
(async () => {
  log('══ OneLab Connector ══');
  log(`Supabase: ${SUPABASE_URL}`);
  startStatusServer();
  await loadAndBind();
  setInterval(loadAndBind, REFRESH_MS); // pungut alat baru tiap menit (restart utk ubah alat yang sudah bind)
})();
