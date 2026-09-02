// Pemeriksaan statis kontrak deploy: tidak menyentuh jaringan maupun database.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'ava-platform');
const errors = [];
const read = file => fs.readFileSync(path.join(app, file), 'utf8');
let vercel;
try { vercel = JSON.parse(read('vercel.json')); }
catch (error) { errors.push(`vercel.json tidak valid: ${error.message}`); }
for (const host of ['kiosk.avahealth.sbs', 'apps.avahealth.sbs', 'antrian.avahealth.sbs']) {
  const hit = (vercel?.redirects || []).some(rule => (rule.has || []).some(x => x.type === 'host' && x.value === host));
  if (!hit) errors.push(`Redirect host ${host} belum didefinisikan.`);
}
if (!fs.existsSync(path.join(app, 'api', 'runtime-config.js'))) errors.push('Endpoint runtime-config.js tidak ditemukan.');
for (const file of ['index.html', 'kiosk/index.html', 'monitor/antrian.html']) {
  if (!read(file).includes('/api/runtime-config.js')) errors.push(`${file} belum memuat runtime config.`);
}
if (!read('kiosk/queue-api.js').includes('AVA_RUNTIME_CONFIG')) errors.push('Kiosk belum membaca runtime config.');
if (errors.length) { console.error('DEPLOY READINESS GAGAL'); errors.forEach(error => console.error(`- ${error}`)); process.exit(1); }
console.log('DEPLOY READINESS LULUS — domain publik dan runtime config terhubung secara statis.');
