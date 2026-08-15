// Launcher headless: engine PGlite (shim :54329) + server statis platform (:5174).
// Dipakai untuk uji integrasi frontend↔engine tanpa Electron GUI.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createEngine } = require('./electron/local-engine.js');

// Diturunkan dari lokasi berkas ini — jangan tulis path absolut.
const PLATFORM = process.env.ONELAB_PLATFORM_PATH ||
  path.resolve(__dirname, '..', 'onelab-platform-main', 'onelab-platform');
const mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.map':'application/json' };

(async () => {
  await createEngine({ platformDir: PLATFORM, dataDir: path.join(__dirname, '.pglite-dev'), port: 54329, log: console.log });
  http.createServer((req, res) => {
    const raw = (req.url || '/').split('?')[0];
    const fp = path.join(PLATFORM, raw === '/' ? 'index.html' : raw);
    const ext = path.extname(fp).toLowerCase();
    fs.readFile(fp, (err, c) => {
      if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); res.end('err ' + err.code); }
      else { res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' }); res.end(c); }
    });
  }).listen(5174, '127.0.0.1', () => console.log('PLATFORM_READY http://127.0.0.1:5174'));
})().catch(e => { console.error('LAUNCH FAIL', e); process.exit(1); });
