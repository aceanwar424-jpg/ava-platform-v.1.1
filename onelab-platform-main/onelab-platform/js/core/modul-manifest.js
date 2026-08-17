// ═══════════════════════════════════════════════════════════════
// DIBANGKITKAN OTOMATIS — jangan disunting tangan.
// Sumber: scripts/bangun-manifest.js  (jalankan ulang bila menu/route berubah)
//
// Peta halaman → berkas modul untuk pemuatan saat dibutuhkan.
// Sebelumnya 82 berkas modul (3,1 MB) dimuat pada SETIAP kali aplikasi
// dibuka, bahkan ketika pengguna hanya melihat Dashboard.
// ═══════════════════════════════════════════════════════════════
window.MODUL_HALAMAN = {
 "partners": [
  "modules/partners/index.js",
  "modules/partners/deals.js"
 ],
 "maps": [
  "modules/maps/index.js"
 ],
 "marketing": [
  "modules/marketing.js"
 ],
 "voucher": [
  "modules/voucher.js"
 ],
 "surat": [
  "modules/surat.js"
 ],
 "test-reviewer": [
  "modules/test_reviewer.js"
 ],
 "leads": [
  "modules/leads.js"
 ],
 "okr": [
  "modules/leads.js"
 ],
 "mcu": [
  "modules/mcu.js"
 ],
 "avahealth": [
  "modules/ava_health.js"
 ],
 "ava-consult": [
  "modules/ava_health.js"
 ],
 "ava-devices": [
  "modules/ava_health.js"
 ],
 "ava-calibration": [
  "modules/ava_health.js"
 ],
 "ava-marketplace": [
  "modules/ava_health.js"
 ],
 "ava-caregiver": [
  "modules/ava_health.js"
 ],
 "ava-corporate": [
  "modules/ava_health.js"
 ],
 "ava-portals": [
  "modules/ava_health.js"
 ],
 "finance": [
  "modules/finance.js"
 ],
 "inventory": [
  "modules/inventory.js"
 ],
 "hrd": [
  "modules/hrd.js"
 ],
 "work-schedule": [
  "modules/work_schedule.js"
 ],
 "shift-calendar": [
  "modules/work_schedule.js"
 ],
 "tasks": [
  "modules/task_management.js"
 ],
 "wiki": [
  "modules/wiki/index.js",
  "modules/wiki/sop.js",
  "modules/wiki/fix.js",
  "modules/wiki/studio.js"
 ],
 "agentic": [
  "modules/agentic/mcp.js",
  "modules/agentic/orchestrator.js",
  "modules/agentic/clinical_agent.js",
  "modules/agentic/index.js",
  "modules/agentic/inbox.js",
  "modules/agentic/docs.js",
  "modules/agentic/overlap.js",
  "modules/agentic/aieditor.js",
  "modules/agentic/rag.js",
  "modules/agentic/docxfill.js",
  "modules/agentic/studio.js",
  "modules/agentic/render.js",
  "modules/agentic/org.js",
  "modules/agentic/canvas.js"
 ],
 "audit": [
  "modules/audit.js"
 ],
 "satusehat": [
  "modules/satusehat.js"
 ],
 "ar-aging": [
  "modules/finance_aging.js"
 ],
 "penawaran": [
  "modules/quotation.js"
 ],
 "lab-tat": [
  "modules/lab/qcEngine.js",
  "modules/lab/index.js",
  "modules/lab/checkin.js",
  "modules/lab/worklist.js",
  "modules/lab/results.js",
  "modules/lab/validation.js",
  "modules/lab/impression.js",
  "modules/lab/report.js",
  "modules/lab/qc.js",
  "modules/lab/autoverify.js",
  "modules/lab/integration.js",
  "modules/lab/parser_config.js",
  "modules/lab/tat.js"
 ],
 "hc-schedule": [
  "modules/homecare.js"
 ],
 "hc-staff": [
  "modules/homecare.js"
 ],
 "hc-tariff": [
  "modules/homecare.js"
 ],
 "hc-billing": [
  "modules/homecare.js"
 ],
 "hc-report": [
  "modules/homecare.js"
 ],
 "attendance": [
  "modules/attendance.js"
 ],
 "org-structure": [
  "modules/org_structure.js"
 ],
 "regulatory": [
  "modules/regulatory_reports.js"
 ],
 "rl-reports": [
  "modules/rl_reports.js"
 ],
 "homecare": [
  "modules/homecare.js"
 ],
 "admission": [
  "modules/admission.js"
 ],
 "lab": [
  "modules/lab/qcEngine.js",
  "modules/lab/index.js",
  "modules/lab/checkin.js",
  "modules/lab/worklist.js",
  "modules/lab/results.js",
  "modules/lab/validation.js",
  "modules/lab/impression.js",
  "modules/lab/report.js",
  "modules/lab/qc.js",
  "modules/lab/autoverify.js",
  "modules/lab/integration.js",
  "modules/lab/parser_config.js",
  "modules/lab/tat.js"
 ],
 "product": [
  "modules/config_product.js"
 ],
 "config": [
  "modules/settings.js"
 ],
 "refrange": [
  "modules/config_product.js"
 ],
 "labreport": [
  "modules/settings.js"
 ],
 "corporate": [
  "modules/config_package.js"
 ],
 "radiology": [
  "modules/ris.js"
 ],
 "radiology-old": [
  "modules/radiology.js"
 ],
 "supportive": [
  "modules/supportive.js"
 ],
 "spirometry": [
  "modules/supportive.js"
 ],
 "medrecord": [
  "modules/medrecord.js"
 ],
 "inpatient": [
  "modules/inpatient.js"
 ],
 "pharmacy": [
  "modules/pharmacy.js"
 ],
 "crm-pipeline": [
  "modules/crm_pipeline.js"
 ],
 "queue": [
  "modules/clinicflow.js"
 ],
 "queue-kiosk": [
  "modules/clinicflow.js"
 ],
 "appointments": [
  "modules/clinicflow.js"
 ],
 "cashier": [
  "modules/cashier.js"
 ],
 "accounting": [
  "modules/accounting.js"
 ],
 "payables": [
  "modules/payables.js"
 ],
 "assets": [
  "modules/assets.js"
 ],
 "referral": [
  "modules/referral.js"
 ],
 "payroll": [
  "modules/payroll.js"
 ],
 "package": [
  "modules/config_package.js"
 ],
 "family": [
  "modules/config_family.js"
 ],
 "anamnesa": [
  "modules/anamnesa.js"
 ],
 "import": [
  "modules/settings.js"
 ],
 "settings": [
  "modules/settings.js"
 ],
 "users": [
  "modules/settings.js"
 ],
 "db-studio": [
  "modules/db_studio.js"
 ]
};

// Semua modul yang dapat ditunda — dipakai sebagai jaring pengaman bila
// sebuah halaman memanggil fungsi milik modul lain yang belum termuat.
window.MODUL_SEMUA = [
 "modules/partners/index.js",
 "modules/partners/deals.js",
 "modules/maps/index.js",
 "modules/marketing.js",
 "modules/voucher.js",
 "modules/surat.js",
 "modules/test_reviewer.js",
 "modules/ava_health.js",
 "modules/leads.js",
 "modules/finance.js",
 "modules/accounting.js",
 "modules/payables.js",
 "modules/assets.js",
 "modules/audit.js",
 "modules/satusehat.js",
 "modules/inventory.js",
 "modules/hrd.js",
 "modules/payroll.js",
 "modules/work_schedule.js",
 "modules/task_management.js",
 "modules/org_structure.js",
 "modules/attendance.js",
 "modules/regulatory_reports.js",
 "modules/rl_reports.js",
 "modules/homecare.js",
 "modules/mcu.js",
 "modules/admission.js",
 "modules/anamnesa.js",
 "modules/lab/qcEngine.js",
 "modules/radiology/dicomViewer.js",
 "modules/lab/index.js",
 "modules/lab/checkin.js",
 "modules/lab/worklist.js",
 "modules/lab/results.js",
 "modules/lab/validation.js",
 "modules/lab/impression.js",
 "modules/lab/report.js",
 "modules/lab/qc.js",
 "modules/lab/autoverify.js",
 "modules/referral.js",
 "modules/lab/integration.js",
 "modules/lab/parser_config.js",
 "modules/radiology.js",
 "modules/pacs.js",
 "modules/ris.js",
 "modules/supportive.js",
 "modules/medrecord.js",
 "modules/inpatient.js",
 "modules/pharmacy.js",
 "modules/crm_pipeline.js",
 "modules/timeline.js",
 "modules/clinicflow.js",
 "modules/cashier.js",
 "modules/config_product.js",
 "modules/config_package.js",
 "modules/config_family.js",
 "modules/wiki/index.js",
 "modules/wiki/sop.js",
 "modules/wiki/fix.js",
 "modules/wiki/studio.js",
 "modules/agentic/mcp.js",
 "modules/agentic/orchestrator.js",
 "modules/agentic/clinical_agent.js",
 "modules/agentic/index.js",
 "modules/agentic/inbox.js",
 "modules/agentic/docs.js",
 "modules/agentic/overlap.js",
 "modules/agentic/aieditor.js",
 "modules/agentic/rag.js",
 "modules/agentic/docxfill.js",
 "modules/agentic/studio.js",
 "modules/agentic/render.js",
 "modules/agentic/org.js",
 "modules/config_home.js",
 "modules/config_labreport.js",
 "modules/settings.js",
 "modules/db_studio.js",
 "modules/import_excel.js",
 "modules/agentic/canvas.js",
 "modules/finance_aging.js",
 "modules/lab/tat.js",
 "modules/quotation.js"
];
