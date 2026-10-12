/**
 * Unit Test: SATUSEHAT REST API Client & Interoperability
 */

const assert = require('assert');
const { SatuSehatClient } = require('../../lib/interop/satusehat_client');

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 PENGUJIAN ADAPTER REST API SATUSEHAT FHIR R4 KEMENKES RI');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Inisialisasi Mode Simulasi
  const client = new SatuSehatClient({
    simulationMode: true,
    organizationId: 'org-test-1002'
  });

  const token = await client.getAccessToken();
  assert(token && token.startsWith('mock_token_'), 'Token OAuth2 simulasi berhasil diterbitkan');
  console.log('  ✅ [PASS] Autentikasi OAuth2 Client Credentials simulasi berhasil');

  // 2. Pengujian Helper ServiceRequest (Order Lab DPJP)
  const srResult = await client.createServiceRequest({
    patientIhsId: 'P10029381923',
    encounterId: 'ENC-2026-10-001',
    requesterIhsId: 'N10002931',
    orderCode: '58410-2',
    orderName: 'Complete blood count (CBC) panel',
    priority: 'routine'
  });
  assert(srResult.success === true && srResult.resourceType === 'ServiceRequest', 'ServiceRequest berhasil dibuat');
  console.log('  ✅ [PASS] Pembuatan Resource ServiceRequest (Order CBC DPJP) sukses');

  // 3. Pengujian Helper Specimen (Spesimen Darah Flebotomi)
  const specResult = await client.createSpecimen({
    patientIhsId: 'P10029381923',
    serviceRequestId: srResult.id,
    collectorIhsId: 'N10002932',
    specimenTypeCode: '119297000',
    specimenTypeName: 'Blood specimen (EDTA Whole Blood)'
  });
  assert(specResult.success === true && specResult.resourceType === 'Specimen', 'Specimen berhasil dibuat');
  console.log('  ✅ [PASS] Pembuatan Resource Specimen (SNOMED CT 119297000) sukses');

  // 4. Pengujian Helper Observation (Hasil Uji Analit Hb & Trombosit)
  const obsHbResult = await client.createObservation({
    patientIhsId: 'P10029381923',
    encounterId: 'ENC-2026-10-001',
    performerIhsId: 'N10002931',
    specimenId: specResult.id,
    loincCode: '718-7',
    analyteName: 'Hemoglobin',
    value: 14.5,
    ucumUnit: 'g/dL',
    refLow: 13.0,
    refHigh: 17.0,
    interpretationCode: 'N'
  });
  assert(obsHbResult.success === true && obsHbResult.resourceType === 'Observation', 'Observation Hb berhasil dibuat');
  console.log('  ✅ [PASS] Pembuatan Resource Observation (LOINC 718-7, UCUM g/dL) sukses');

  // 5. Pengujian Helper DiagnosticReport (Laporan Hasil Kumulatif Ber-TTE)
  const drReportResult = await client.createDiagnosticReport({
    patientIhsId: 'P10029381923',
    encounterId: 'ENC-2026-10-001',
    performerIhsId: 'N10002931',
    serviceRequestId: srResult.id,
    specimenId: specResult.id,
    observationIds: [obsHbResult.id],
    reportCode: '11502-2',
    reportTitle: 'Hasil Pemeriksaan Hematologi Lengkap',
    conclusion: 'Profil hematologi dalam batas normal.'
  });
  assert(drReportResult.success === true && drReportResult.resourceType === 'DiagnosticReport', 'DiagnosticReport berhasil dibuat');
  console.log('  ✅ [PASS] Pembuatan Resource DiagnosticReport (Playbook 4-Resource) sukses');

  // 6. Validasi Penolakan Parameter Kosong
  let rejected = false;
  try {
    await client.postResource('', null);
  } catch (e) {
    rejected = true;
  }
  assert(rejected, 'Client menolak pengiriman payload kosong');
  console.log('  ✅ [PASS] Penjagaan integritas payload kosong ditegakkan');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 TOTAL: 6 DARI 6 SKENARIO SATUSEHAT LULUS (100%)');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runTest().catch(err => {
  console.error('❌ GAGAL:', err);
  process.exit(1);
});
