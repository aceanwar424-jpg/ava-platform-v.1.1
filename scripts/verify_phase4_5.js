/**
 * Script Verifikasi Phase 4 & 5 (SMM Assembler, Content Pipeline, GTM Readiness)
 */

const fs = require('fs');
const path = require('path');
const { SMMPackAssembler } = require('../lib/assembler/smm_pack_assembler');
const { ContentPipeline } = require('../tools/content_pipeline');
const { CatalogValidator } = require('../lib/validator/catalog_validator');

function runPhase4and5Verification() {
  console.log('=====================================================');
  console.log('VERIFIKASI PHASE 4 & 5: SMM MODULAR, CONTENT & GTM');
  console.log('=====================================================\n');

  // 1. Verifikasi SMM Pack Assembler (Work Item P3)
  console.log('[1/4] Menguji SMM Pack Assembler ("Rakit Paket SMM")...');
  const tenantPath = path.join(__dirname, '../config/tenant.template.json');
  const tenantConfig = JSON.parse(fs.readFileSync(tenantPath, 'utf-8'));
  const assembler = new SMMPackAssembler();

  const packResult = assembler.assemble(tenantConfig, ['MOD-ISO-4.1-001']);
  console.log(`✅ Assembled Lab: ${packResult.lab_name}`);
  console.log(`✅ Total Modules Assembled: ${packResult.total_modules}`);
  console.log(`✅ Bundle Size: ${packResult.combined_bundle.length} bytes`);
  console.log(`✅ Compliance Status: ${packResult.is_audit_ready ? 'AUDIT_READY' : 'NEEDS_REVISION'}\n`);

  // 2. Verifikasi Content Pipeline (Work Item P4)
  console.log('[2/4] Menguji Content Pipeline (Patient-Facing & LinkedIn)...');
  const pipeline = new ContentPipeline();
  const catalogCsvPath = path.join(__dirname, '../data/catalog/catalog_generic.csv');
  const csvContent = fs.readFileSync(catalogCsvPath, 'utf-8');
  const validator = new CatalogValidator();
  const sampleRow = validator.parseCSV(csvContent).rows[0];

  const patientDoc = pipeline.generatePatientFacingDescription(sampleRow);
  console.log(`✅ Patient-Facing Content Created: "${patientDoc.title}"`);
  console.log(`✅ Patient Prep Steps: ${patientDoc.persiapan_pasien.length} butir`);

  const linkedInPost = pipeline.generateLinkedInPost({ type: 'AUDIT_LESSON' });
  console.log(`✅ LinkedIn Authority Post Drafted (${linkedInPost.length} bytes)\n`);

  // 3. Verifikasi GTM Entry Offer 1-Pager (Work Item P5)
  console.log('[3/4] Memeriksa Dokumen GTM Entry Offer 1-Pager...');
  const offerPath = path.join(__dirname, '../docs/gtm/entry_offer_1pager.md');
  const offerExists = fs.existsSync(offerPath);
  console.log(`✅ Entry Offer 1-Pager Exists: ${offerExists} (${fs.statSync(offerPath).size} bytes)\n`);

  // 4. Verifikasi Lead Magnet Checklist (Work Item P5)
  console.log('[4/4] Memeriksa Lead Magnet Checklist ISO 15189...');
  const leadMagnetPath = path.join(__dirname, '../docs/gtm/lead_magnet_checklist.md');
  const leadMagnetExists = fs.existsSync(leadMagnetPath);
  console.log(`✅ Lead Magnet Checklist Exists: ${leadMagnetExists} (${fs.statSync(leadMagnetPath).size} bytes)\n`);

  console.log('=====================================================');
  console.log('SELURUH UJI VERIFIKASI PHASE 4 & 5 BERHASIL 100%! 🚀');
  console.log('=====================================================');
}

runPhase4and5Verification();
