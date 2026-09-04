// Verifikasi statis: 20 menu konfigurasi harus memiliki domain, form UI,
// serta seed database yang konsisten. Tidak mengakses jaringan/database.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const menu = JSON.parse(fs.readFileSync(path.join(root, 'config/menu.json'), 'utf8'));
const ui = fs.readFileSync(path.join(root, 'ava-platform/modules/system/config/master_registry.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'db/migrations/0050_his_master_registry.sql'), 'utf8');

const expected = {
  'cfg-branch':'branch', 'cfg-unit-room':'unit_room', 'cfg-equipment':'equipment', 'cfg-service-class':'service_capacity',
  'cfg-specialty':'specialty', 'cfg-practitioner-fee':'practitioner_fee', 'cfg-patient-reference':'patient_reference',
  'cfg-diagnosis-reference':'diagnosis_reference', 'cfg-mcu-parameter':'mcu_parameter', 'cfg-mcu-assessment':'mcu_threshold',
  'cfg-medicine-reference':'medicine_reference', 'cfg-corporate-contract':'corporate_contract', 'cfg-job-master':'job_master',
  'cfg-bank-edc':'bank_edc', 'cfg-payment-account':'payment_mapping', 'cfg-promotion':'promotion', 'cfg-queue-flow':'queue_flow',
  'cfg-queue-device':'queue_device', 'cfg-telemedicine':'telemedicine', 'cfg-satusehat':'satusehat_setup',
};
const allMenus = [];
for (const category of Object.values(menu.kategori || {})) for (const group of category.grup || []) allMenus.push(...(group.menu || []));
const errors = [];
for (const [menuId, domain] of Object.entries(expected)) {
  const item = allMenus.find(row => row.id === menuId);
  if (!item) errors.push(`${menuId}: menu tidak ditemukan`);
  else if (item.rute !== 'master-records' || !String(item.aksi || '').includes(`domain:'${domain}'`)) errors.push(`${menuId}: rute/domain tidak sesuai`);
  if (!new RegExp(`\\n  ${domain}: \\{`).test(ui)) errors.push(`${domain}: definisi form UI tidak ditemukan`);
  if (!migration.includes(`('${domain}',`)) errors.push(`${domain}: seed domain database tidak ditemukan`);
}
if (!migration.includes('queue_public_devices') || !migration.includes('his_master_audit')) errors.push('Kontrak sinkronisasi antrean atau audit hilang');
if (errors.length) { console.error('Kontrak registry master GAGAL:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`Kontrak registry master OK: ${Object.keys(expected).length} menu/domain sinkron.`);
