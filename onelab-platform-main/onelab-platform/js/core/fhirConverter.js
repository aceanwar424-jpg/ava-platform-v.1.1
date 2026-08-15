// ═══════════════════════════════════════════════════════════════
// CORE: HL7 FHIR v4 CONVERTER & SATUSEHAT KEMENKES RI API BRIDGE
// Standard Interoperability Engine for Patient, Observation & DiagnosticReport
// ═══════════════════════════════════════════════════════════════

const FHIR_CONFIG = {
  organizationId: '100028919', // ID Organisasi Faskes SATUSEHAT Kemenkes
  systemUrl: 'https://api-satusehat.kemkes.go.id/fhir/v1',
};

/**
 * Mengubah data Pasien lokal ke Resource FHIR 'Patient'
 */
function convertToFhirPatient(patientData) {
  return {
    resourceType: 'Patient',
    id: patientData.id || `pat-${Date.now()}`,
    identifier: [
      {
        use: 'official',
        system: 'https://fhir.kemkes.go.id/id/nik',
        value: patientData.nik || '3171234567890001'
      }
    ],
    name: [
      {
        use: 'official',
        text: patientData.patient_name || patientData.nama || 'Pasien Anonim'
      }
    ],
    telecom: [
      {
        system: 'phone',
        value: patientData.phone || '08123456789'
      }
    ],
    gender: patientData.gender === 'L' ? 'male' : 'female',
    birthDate: patientData.birth_date || '1990-01-01'
  };
}

/**
 * Mengubah hasil tes lab lokal ke Resource FHIR 'Observation' (LOINC Standard)
 */
function convertToFhirObservation(resultData) {
  return {
    resourceType: 'Observation',
    id: resultData.id || `obs-${Date.now()}`,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: resultData.loinc_code || '58410-2',
          display: resultData.nama_tes || 'Hemoglobin [Mass/volume] in Blood'
        }
      ],
      text: resultData.nama_tes || 'Pemeriksaan Lab'
    },
    subject: {
      reference: `Patient/${resultData.patient_id || 'pat-001'}`
    },
    valueQuantity: {
      value: parseFloat(resultData.nilai_hasil) || 14.2,
      unit: resultData.satuan || 'g/dL',
      system: 'http://unitsofmeasure.org',
      code: resultData.satuan || 'g/dL'
    },
    referenceRange: [
      {
        low: { value: parseFloat(resultData.ref_min) || 13.0, unit: resultData.satuan || 'g/dL' },
        high: { value: parseFloat(resultData.ref_max) || 17.5, unit: resultData.satuan || 'g/dL' }
      }
    ]
  };
}

/**
 * Simulasi Sinkronisasi Data ke Gateway SATUSEHAT Kemenkes RI
 */
async function syncToSatuSehat(resource) {
  console.log('[SATUSEHAT FHIR Sync] Mengirim resource ke Kemenkes RI:', resource);
  return {
    success: true,
    satusehatId: `satusehat-${Date.now()}`,
    resourceType: resource.resourceType,
    status: 'SYNCED_TO_KEMENKES'
  };
}

window.fhirConverter = {
  convertToFhirPatient,
  convertToFhirObservation,
  syncToSatuSehat,
  FHIR_CONFIG
};
