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
  if (STATE.rawStream.length > 50) STATE.rawStream.shift();
}

// ── Kode kontrol protokol ─────────────────────────────────────────────
const ENQ = 0x05, ACK = 0x06, NAK = 0x15, STX = 0x02, ETX = 0x03, ETB = 0x17, EOT = 0x04, CR = 0x0D, LF = 0x0A;
const VT = 0x0B, FS = 0x1C; // HL7 MLLP

// Kirim pesan mentah ke Supabase (non-fatal bila gagal — jangan putus koneksi alat)
async function ingest(analyzer, protocol, raw, direction) {
  const dir = direction || 'IN';
  pushRawStream(analyzer.name, dir, protocol, raw);
  try {
    const res = await rpc('analyzer_ingest', {
      p: {
        analyzer_code: analyzer.code,
        analyzer_id: analyzer.id,
        protocol,
        raw_text: raw,
        direction: dir
      }
    });
    log(`  ⇢ ingest ${analyzer.name} (${protocol}, ${raw.length}b) id=${res && res.id}`);
    const d = STATE.devices.get(analyzer.id);
    if (d && dir === 'IN') {
      d.msgCount++;
      d.lastMsgAt = new Date();
      d.lastRaw = String(raw).slice(0, 4000);
      d.lastError = null;
      d.lastErrorAt = null;
    }
  } catch (e) {
    log(`  ⚠ ingest gagal (${analyzer.name}): ${e.message}`);
    const d = STATE.devices.get(analyzer.id);
    if (d) {
      d.lastError = `ingest gagal: ${e.message}`;
      d.lastErrorAt = new Date();
    }
  }
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
</style></head><body>
<div class="container">
  <h1>OneLab Connector</h1>
  <div class="sub" id="sub">memuat…</div>
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
</div>
<script>
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  async function tick(){
    try{
      const r=await fetch('/api/status'); const s=await r.json();
      const up=Math.round((Date.now()-new Date(s.started).getTime())/1000);
      document.getElementById('sub').textContent='Supabase: '+s.supabase+' · uptime '+Math.floor(up/60)+'m '+(up%60)+'s · '+s.devices.length+' alat aktif';
      
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
        rawStream: STATE.rawStream
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
