// ═══════════════════════════════════════════════════════════════
// Server statis platform (:5174) — SATU implementasi untuk semua pemakai.
//
// MENGAPA DISATUKAN
// Sebelumnya ada dua: satu di electron/main.ts untuk aplikasi desktop, satu
// lagi ditulis ulang di run-local.js untuk pengujian. Keduanya sudah mulai
// menyimpang — yang di run-local.js kehilangan penjaga path traversal, dan
// tidak satu pun tahu tentang subdomain.
//
// Server yang dipakai untuk menguji harus berperilaku sama dengan yang
// dipakai sungguhan. Kalau tidak, pengujiannya menguji hal yang lain.
//
// PEMETAAN SUBDOMAIN
// Membaca config/domain.json — berkas yang sama yang dipakai
// scripts/bangun-vercel.js untuk membangkitkan vercel.json. Satu sumber
// untuk lokal dan produksi.
//
// Untuk menguji di komputer sendiri, buka <lokal>.localhost:5174 —
// peramban modern mengarahkan seluruh *.localhost ke 127.0.0.1 tanpa perlu
// menyunting berkas hosts.
//
// Peta ini TIDAK wajib: bila config/domain.json tidak ketemu, server
// berperilaku seperti server statis biasa. Instalasi klinik tidak boleh
// bergantung pada berkas yang hanya penting untuk deploy web.
// ═══════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.geojson': 'application/geo+json',
};

function naikCari(mulai, bagian) {
  let dir = mulai;
  for (let i = 0; i < 12; i++) {
    const penuh = path.join(dir, ...bagian);
    if (fs.existsSync(penuh)) return penuh;
    const induk = path.dirname(dir);
    if (induk === dir) break;
    dir = induk;
  }
  return '';
}

function muatPetaDomain(platformDir, log = () => {}) {
  const kandidat = [
    process.resourcesPath && path.join(process.resourcesPath, 'config', 'domain.json'),
    platformDir && naikCari(platformDir, ['config', 'domain.json']),
    naikCari(__dirname, ['config', 'domain.json']),
  ].filter(Boolean);

  for (const k of kandidat) {
    try {
      if (!fs.existsSync(k)) continue;
      const isi = JSON.parse(fs.readFileSync(k, 'utf8'));
      if (Array.isArray(isi.situs)) return isi.situs;
    } catch (e) {
      // Peta yang rusak dilaporkan, bukan didiamkan. Kalau didiamkan,
      // subdomain lokal berhenti bekerja tanpa sebab yang kelihatan dan
      // orang akan mengira masalahnya ada di aturan Vercel.
      log(`[platform] config/domain.json tidak terbaca (${k}): ${e && e.message}`);
    }
  }
  return [];
}

function situsUntukHost(situs, host) {
  const nama = String(host || '').split(':')[0].toLowerCase();
  if (!nama) return null;
  for (const s of situs) {
    if (s.lokal && (nama === `${s.lokal}.localhost` || nama === `${s.lokal}.127.0.0.1`)) return s;
    if (Array.isArray(s.host) && s.host.includes(nama)) return s;
  }
  return null;
}

function buatServerStatis({ platformDir, port = 5174, host = '127.0.0.1', log = console.log }) {
  const situs = muatPetaDomain(platformDir, log);

  const server = http.createServer((req, res) => {
    const rawUrl = (req.url || '/').split('?')[0];

    if (!platformDir) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Folder platform AVA tidak ditemukan</h1>' +
        '<p>Setel <code>AVA_PLATFORM_PATH</code> ke folder yang berisi ' +
        '<code>index.html</code>, atau jalankan lewat <code>AVAPLATFORM.bat</code>.</p>');
    }

    // Urutan sama dengan Vercel: berkas nyata lebih dulu, aturan host hanya
    // untuk jalur yang tidak berwujud berkas. Dengan begitu /style.css dan
    // /js/core/api.js tetap tersaji apa adanya di subdomain mana pun.
    const cocok = situsUntukHost(situs, req.headers.host || '');
    const bawaan = cocok ? String(cocok.masuk || '').replace(/^\//, '') : 'index.html';

    let berkas = path.join(platformDir, rawUrl === '/' ? bawaan : decodeURIComponent(rawUrl));

    // Tahan path traversal. Penting begitu server ini dibuka ke LAN — dan
    // inilah yang hilang dari salinan di run-local.js.
    if (!path.resolve(berkas).startsWith(path.resolve(platformDir))) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      return res.end('<h1>403 Forbidden</h1>');
    }

    // Jaring untuk tautan dalam, sepadan dengan aturan "/(.*)" di vercel.json.
    if (cocok && rawUrl !== '/' && !fs.existsSync(berkas)) {
      berkas = path.join(platformDir, bawaan);
    }

    const ext = path.extname(berkas).toLowerCase();
    fs.readFile(berkas, (err, isi) => {
      if (err) {
        res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(err.code === 'ENOENT'
          ? '<h1>404 File Not Found</h1>'
          : `Server Error: ${err.code}`);
      }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(isi);
    });
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      log(`[platform] Porta ${port} sudah digunakan oleh proses lain (server statis sudah aktif). Melanjutkan...`);
    } else {
      log(`[platform] Server statis galat: ${err && err.message ? err.message : err}`);
    }
  });

  server.listen(port, host, () => {
    log(`AVA Platform static server → http://${host}:${port}`);
    if (situs.length) {
      log('[platform] subdomain lokal: ' +
        situs.map(s => `http://${s.lokal}.localhost:${port}/`).join('  '));
    }
  });

  return server;
}

module.exports = { buatServerStatis, muatPetaDomain, situsUntukHost, MIME };
