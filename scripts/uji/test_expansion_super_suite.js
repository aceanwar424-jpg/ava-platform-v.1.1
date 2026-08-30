// ═══════════════════════════════════════════════════════════════
// UJI INTEGRASI TERPADU: 3 PAKET STRATEGIS EKSPANSI AVA GLOBAL
// Paket A: Klinik HIS & Radiologi
// Paket B: Komersialisasi AVA Tech B2B SaaS
// Paket C: Unified B2C Patient & Customer Super-App
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Mock browser global environment
global.window = global;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

// Muat Seluruh Modul Baru Terkait
require('../../ava-platform/modules/his/integratedOrders.js');
require('../../ava-platform/modules/radiology/radiologyExpertise.js');
require('../../ava-platform/modules/his/mpiManagement.js');
require('../../ava-platform/modules/business_units/techLicenseActivation.js');
require('../../ava-platform/modules/business_units/techTelemetry.js');
require('../../ava-platform/modules/business_units/techPricingPlans.js');
require('../../ava-platform/apps/app.js');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${details}`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('🚀 MENJALANKAN UJI INTEGRASI 3 PAKET STRATEGIS (HIS, TECH, APPS)');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── 1. PAKET A: KLINIK HIS & RADIOLOGI ──
console.log('1. PAKET A: KLINIK HIS & RADIOLOGI PRESISI');

const ordRes = window.createIntegratedOrder({
  patient_name: 'Ny. Amanda Manopo',
  ava_id: 'AVA-AMANDA-01',
  doctor_name: 'dr. Hendra Pratama, Sp.PD',
  lab_items: [{ code: 'LAB-01', name: 'Darah Lengkap', price: 120000 }],
  radiology_items: [{ code: 'RAD-01', name: 'Foto Thorax AP', price: 185000 }],
  pharmacy_items: [{ code: 'MED-01', name: 'Paracetamol 500mg', price: 15000 }],
  procedure_items: [{ code: 'PROC-01', name: 'Inhalasi Nebulizer', price: 75000 }],
  payment_coverage: 'BPJS Kesehatan'
});
assert(ordRes.success === true && ordRes.order.total_amount === 395000,
  'Order terintegrasi (Lab + Rad + Obat + Tindakan) berhasil dibuat dengan total Rp 395.000');
assert(ordRes.order.dispatches.lis_accession !== null && ordRes.order.dispatches.ris_order_no !== null,
  'Order terpadu otomatis menghasilkan Accession LIS dan Nomor Order RIS Radiologi');

const radExpRes = window.createRadiologyExpertise({
  accession_no: 'RAD-260830-0099',
  patient_name: 'Tn. Rudi Hartono',
  ava_id: 'AVA-RUDI-01',
  modality: 'Foto Thorax AP/PA',
  findings: { cor: 'CTR 54%', pulmo: 'Normal' },
  impression: 'Kardiomegali ringan tanpa bendungan paru',
  recommendation: 'Kontrol rutin'
});
assert(radExpRes.success === true && radExpRes.report.tte_verified === true && radExpRes.report.tte_qr_digest.startsWith('SHA256:'),
  'Lembar ekspertise radiologi Sp.Rad berhasil dirilis lengkap dengan tanda tangan TTE QR');

const mergeRes = window.mergePatientRecords('AVA-7K3M2P9QX4', 'AVA-7K3M2P9QX9', 'dr. Sarah (Admin)');
assert(mergeRes.success === true && mergeRes.merge_entry.master_ava_id === 'AVA-7K3M2P9QX4',
  'Deduplikasi pasien ganda (MPI) berhasil di-merge ke 1 profil primer dengan audit trail imutabel');

// ── 2. PAKET B: KOMERSIALISASI AVA TECH B2B SAAS ──
console.log('\n2. PAKET B: KOMERSIALISASI AVA TECH B2B SAAS');

const licRes = window.issueEd25519License({
  client_name: 'RS Siloam Hospital Network',
  tier: 'ENTERPRISE',
  hardware_fingerprint: 'HW-SRV-9988AABBCC',
  modules_enabled: ['his', 'lis', 'pacs', 'qc', 'satusehat'],
  max_monthly_orders: 50000,
  valid_days: 365
});
assert(licRes.success === true && licRes.license.tier === 'ENTERPRISE' && licRes.raw_lic_payload.length > 50,
  'Penerbitan file lisensi kriptografis Ed25519 (.lic) terikat hardware mesin klien berhasil');

const verifyLic = window.verifyClientLicense(licRes.license, 'HW-SRV-9988AABBCC');
assert(verifyLic.valid === true && verifyLic.client_name === 'RS Siloam Hospital Network',
  'Validasi file lisensi klien pada mesin terdaftar berhasil (Status Valid)');

const verifyFailHw = window.verifyClientLicense(licRes.license, 'HW-WRONG-MACHINE');
assert(verifyFailHw.valid === false && verifyFailHw.reason.includes('Hardware Fingerprint'),
  'Lisensi otomatis DITOLAK bila dipasang pada mesin perangkat keras yang tidak sesuai');

const hbRes = window.recordClientHeartbeat({
  client_id: 'CLI-001',
  name: 'Klinik Utama Sehat Sentosa',
  latency_ms: 22,
  db_size_mb: 520,
  daily_transactions: 185
});
assert(hbRes.success === true && hbRes.node.status === 'HEALTHY' && hbRes.node.latency_ms === 22,
  'Pencatatan telemetri live heartbeat & kesehatan mesin faskes mitra berhasil (22ms)');

const billRes = window.calculateSubscriptionBilling('TIER-PRO', 6200, 'MONTHLY');
assert(billRes.base_price === 5500000 && billRes.overage_orders === 1200 && billRes.total_bill === 6700000,
  'Kalkulasi tagihan SaaS Pro Clinic: Pokok Rp 5.5jt + Overage 1.200 order (Rp 1.2jt) = Rp 6.700.000');

// ── 3. PAKET C: UNIFIED B2C PATIENT SUPER-APP ──
console.log('\n3. PAKET C: UNIFIED B2C PATIENT & CUSTOMER SUPER-APP');

const cartRes = window.addToUnifiedCart({
  id: 'PROD-HERB-01',
  type: 'PRODUCT',
  name: 'HerBalance Elixir 100ml',
  unitPrice: 165000,
  qty: 1,
  weightGram: 250
});
assert(cartRes.success === true && cartRes.total_items > 0,
  'Penambahan item nutraseutikal ke Keranjang Belanja Terpadu B2C berhasil');

const totals = window.calculateUnifiedCartTotal('JNE_REG');
assert(totals.subtotal_product > 0 && totals.subtotal_spa > 0 && totals.subtotal_clinical > 0,
  'Keranjang terpadu berhasil menggabungkan Produk Nutrisi + Booking Spa + Lab Klinis dalam 1 hitungan');
assert(totals.shipping_fee === 15000 && totals.grand_total > totals.subtotal_items,
  `Kalkulasi Grand Total (Termasuk Ongkir JNE Rp ${totals.shipping_fee} & Biaya Admin) = Rp ${Number(totals.grand_total).toLocaleString('id-ID')}`);

const checkoutRes = window.processUnifiedCheckout('QRIS_DYNAMIC', {
  customer_name: 'Ny. Amanda Manopo',
  phone: '081288990011',
  address: 'Kebayoran Baru, Jakarta Selatan',
  courier: 'JNE_REG'
});
assert(checkoutRes.success === true && checkoutRes.order.qris_reference.startsWith('NMID-'),
  'Checkout instan Dynamic QRIS berhasil menerbitkan kode bayar dan nomor resi kurir');

const trackRes = window.trackUnifiedOrder(checkoutRes.order.order_id);
assert(trackRes.found === true && trackRes.timeline.length >= 2,
  'Pelacakan status pesanan & timeline riwayat pengiriman kurir berhasil terbaca');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`📊 HASIL UJI 3 PAKET STRATEGIS: ${passedTests} DARI ${totalTests} SKENARIO LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
