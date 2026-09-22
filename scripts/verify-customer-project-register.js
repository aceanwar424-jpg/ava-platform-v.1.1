// OWNED_BY: ava. Validates internal customer-project metadata without network or production data.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'docs/project/customer-project-register.ava.json');
const register = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
if (register.owned_by !== 'ava') errors.push('Register harus dimiliki AVA.');
if (register.visibility !== 'internal_confidential') errors.push('Register harus berstatus internal_confidential.');
const ids = new Set();
for (const project of register.projects || []) {
  if (!project.project_id || ids.has(project.project_id)) errors.push(`Project ID tidak valid/ganda: ${project.project_id || '(kosong)'}`);
  ids.add(project.project_id);
  if (project.contract_status === 'signed' && project.lifecycle_status !== 'won') errors.push(`${project.project_id}: kontrak signed harus berada pada lifecycle won.`);
  if (project.public_claim_allowed && project.contract_status !== 'signed') errors.push(`${project.project_id}: klaim publik memerlukan kontrak signed.`);
  if (project.data_state !== 'no_participant_or_clinical_data_stored') errors.push(`${project.project_id}: register tidak boleh menyimpan atau mengklaim data peserta/klinis.`);
  for (const forbidden of ['pic', 'email', 'phone', 'participant_data', 'clinical_data']) {
    if (Object.prototype.hasOwnProperty.call(project, forbidden)) errors.push(`${project.project_id}: properti ${forbidden} tidak diizinkan di register.`);
  }
}
if (errors.length) {
  console.error('CUSTOMER PROJECT REGISTER GAGAL');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`PASS: ${ids.size} customer project internal valid; tanpa PII/data klinis/klaim kontrak.`);
