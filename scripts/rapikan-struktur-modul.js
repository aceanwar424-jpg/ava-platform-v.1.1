const fs = require('fs');
const path = require('path');

const PLATFORM_DIR = path.resolve(__dirname, '..', 'ava-platform');
const MODULES_DIR = path.join(PLATFORM_DIR, 'modules');

console.log('Mulai perapihan struktur modul di:', MODULES_DIR);

const PEMETAAN = {
  // HIS (Klinis / Faskes)
  'admission.js': 'his/admission.js',
  'anamnesa.js': 'his/anamnesa.js',
  'clinicflow.js': 'his/clinicflow.js',
  'emr_soap.js': 'his/emr_soap.js',
  'inpatient.js': 'his/inpatient.js',
  'medrecord.js': 'his/medrecord.js',
  'mcu.js': 'his/mcu.js',
  'homecare.js': 'his/homecare.js',

  // Radiology (RIS + PACS)
  'ris.js': 'radiology/ris.js',
  'pacs.js': 'radiology/pacs.js',
  'pacs_viewer.js': 'radiology/pacs_viewer.js',
  'radiology.js': 'radiology/radiology_legacy.js',

  // Pharmacy
  'pharmacy.js': 'pharmacy/pharmacy.js',
  'farmasi.js': 'pharmacy/farmasi_eprescription.js',

  // Logistics
  'inventory.js': 'logistics/inventory.js',
  'assets.js': 'logistics/assets.js',
  'catalog_export.js': 'logistics/catalog_export.js',

  // Finance
  'cashier.js': 'finance/cashier.js',
  'finance.js': 'finance/finance.js',
  'finance_aging.js': 'finance/finance_aging.js',
  'payables.js': 'finance/payables.js',
  'accounting.js': 'finance/accounting.js',
  'holding_finance.js': 'finance/holding_finance.js',
  'subscription.js': 'finance/subscription.js',

  // HRD
  'hrd.js': 'hrd/hrd.js',
  'attendance.js': 'hrd/attendance.js',
  'payroll.js': 'hrd/payroll.js',
  'org_structure.js': 'hrd/org_structure.js',
  'work_schedule.js': 'hrd/work_schedule.js',
  'task_management.js': 'hrd/task_management.js',

  // CRM & Marketing
  'crm_pipeline.js': 'crm/crm_pipeline.js',
  'leads.js': 'crm/leads.js',
  'marketing.js': 'crm/marketing.js',
  'mou.js': 'crm/mou.js',
  'perujuk.js': 'crm/perujuk.js',
  'quotation.js': 'crm/quotation.js',
  'sales_corong.js': 'crm/sales_corong.js',
  'voucher.js': 'crm/voucher.js',

  // Business Units
  'ava_health.js': 'business_units/ava_health.js',
  'sanctuary_booking.js': 'business_units/sanctuary_booking.js',
  'ecommerce_oms.js': 'business_units/ecommerce_oms.js',

  // Compliance
  'audit.js': 'compliance/audit.js',
  'compliance_tracker.js': 'compliance/compliance_tracker.js',
  'regulatory_reports.js': 'compliance/regulatory_reports.js',
  'rl_reports.js': 'compliance/rl_reports.js',
  'satusehat.js': 'compliance/satusehat.js',
  'bpjs_claim.js': 'compliance/bpjs_claim.js',
  'import_excel.js': 'compliance/import_excel.js',

  // Dashboard
  'executive_dashboard.js': 'dashboard/executive_dashboard.js',

  // System & Config
  'settings.js': 'system/settings.js',
  'settings_users.js': 'system/settings_users.js',
  'lisensi.js': 'system/lisensi.js',
  'portal_akses.js': 'system/portal_akses.js',
  'ops_kendali.js': 'system/ops_kendali.js',
  'db_studio.js': 'system/db_studio.js',
  'surat.js': 'system/surat.js',
  'timeline.js': 'system/timeline.js',
  'supportive.js': 'system/supportive.js',
  'test_reviewer.js': 'system/test_reviewer.js',
  'config_family.js': 'system/config/config_family.js',
  'config_home.js': 'system/config/config_home.js',
  'config_labreport.js': 'system/config/config_labreport.js',
  'config_package.js': 'system/config/config_package.js',
  'config_product.js': 'system/config/config_product.js'
};

let dipindah = 0;
for (const [asal, tujuanRel] of Object.entries(PEMETAAN)) {
  const fileAsal = path.join(MODULES_DIR, asal);
  const fileTujuan = path.join(MODULES_DIR, tujuanRel);

  if (fs.existsSync(fileAsal)) {
    const dirTujuan = path.dirname(fileTujuan);
    if (!fs.existsSync(dirTujuan)) {
      fs.mkdirSync(dirTujuan, { recursive: true });
    }
    fs.renameSync(fileAsal, fileTujuan);
    dipindah++;
    console.log(`✓ ${asal} -> ${tujuanRel}`);
  } else {
    console.log(`- ${asal} sudah tidak ada di root modules/ (mungkin sudah dipindah)`);
  }
}

console.log(`\nSelesai merapikan: ${dipindah} berkas berhasil dipindahkan ke folder kluster domain.`);
