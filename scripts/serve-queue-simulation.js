#!/usr/bin/env node
// Menyalakan engine antrean sintetis untuk simulasi kiosk.localhost ↔
// antrian.localhost. Tidak memakai atau mengubah data PGlite operasional.

const path = require('path');
const { createEngine } = require('../desktop-app/electron/local-engine.js');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.AVA_QUEUE_SIM_PORT || 54329);
const dataDir = path.join(root, 'data', 'queue-simulation');

(async () => {
  const engine = await createEngine({
    platformDir: path.join(root, 'ava-platform'),
    dataDir,
    port,
    log: (x) => console.log(x),
  });
  console.log(`\nSimulasi antrean siap di http://127.0.0.1:${port}`);
  console.log('Buka http://kiosk.localhost:5174/ lalu http://antrian.localhost:5174/');

  const stop = async () => {
    await new Promise(resolve => engine.server.close(resolve));
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((e) => {
  console.error('Simulasi antrean gagal dimulai:', e && e.message ? e.message : e);
  process.exit(1);
});
