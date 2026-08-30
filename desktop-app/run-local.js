// Launcher headless: engine PGlite (shim :54329) + server statis platform (:5174).
// Dipakai untuk uji integrasi frontend↔engine tanpa Electron GUI.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createEngine } = require('./electron/local-engine.js');
const { buatServerStatis } = require('./electron/server-statis.js');

// Diturunkan dari lokasi berkas ini — jangan tulis path absolut.
const PLATFORM = process.env.AVA_PLATFORM_PATH ||
  path.resolve(__dirname, '..', 'ava-platform');
const mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.map':'application/json' };

(async () => {
  await createEngine({ platformDir: PLATFORM, dataDir: path.join(__dirname, '.pglite-dev'), port: 54329, log: console.log });
  // Server statis dipakai bersama dengan aplikasi desktop — lihat
  // electron/server-statis.js. Dulu ditulis ulang di sini, dan salinannya
  // kehilangan penjaga path traversal serta tidak tahu apa-apa soal subdomain.
  buatServerStatis({ platformDir: PLATFORM, port: 5174, log: console.log });
  console.log('PLATFORM_READY http://127.0.0.1:5174');
})().catch(e => { console.error('LAUNCH FAIL', e); process.exit(1); });
