---
name: map-satusehat-fhir
description: Prosedur pemetaan data order & hasil laboratorium ke standar Kemenkes SATUSEHAT HL7 FHIR R4 (DiagnosticReport, Observation, Specimen) berbasis PMK 24/2022.
---

# Skill: Map SATUSEHAT FHIR (HL7 FHIR R4 Interoperability)

Skill ini digunakan untuk mengonversi data order, sampel, dan hasil pemeriksaan laboratorium klinis dari format internal LIS / katalog acuan menjadi bundle sumber daya (resource) HL7 FHIR R4 yang kompatibel 100% dengan platform Kemenkes SATUSEHAT sesuai mandat Permenkes No. 24 Tahun 2022 tentang Rekam Medis Elektronik.

---

## Arsitektur Interoperabilitas SATUSEHAT

```
[ LIS / SIMRS Order ]
         │
         ▼
[ ServiceRequest ] ──▶ [ Specimen ] (SNOMED CT kode spesimen)
         │                     │
         ▼                     ▼
[ DiagnosticReport ] ◄── [ Observation ] (LOINC = OBX-3, UCUM = OBX-6)
```

---

## Aturan Pemetaan Kode Standar (Katalog Integritas)

1. **Kode Analit / Uji:** Wajib menggunakan sistem kode **LOINC** (`http://loinc.org`) pada elemen `Observation.code.coding`. Ini setara dengan segmen HL7 v2 **OBX-3**.
2. **Satuan Nilai Ukur:** Wajib menggunakan sistem kode **UCUM** (`http://unitsofmeasure.org`) pada elemen `Observation.valueQuantity.code` dan `system`. Ini setara dengan segmen HL7 v2 **OBX-6**.
3. **Kategori Diagnostik:** Menggunakan kode `LAB` (`http://terminology.hl7.org/CodeSystem/v2-0074`).
4. **Status Hasil:**
   - Hasil awal: `registered` atau `preliminary`
   - Hasil terverifikasi digital Sp.PK: `final`
   - Hasil perbaikan/koreksi: `corrected` atau `amended`

---

## Contoh Transformasi Programatik (Node.js)

```javascript
const { createLabObservation, createDiagnosticReport } = require('../../../lib/interop/fhir_converter');

// 1. Data Hasil dari LIS
const labResult = {
  patient_ihs_id: 'P10029381923',
  encounter_id: 'ENC-2026-10-001',
  performer_ihs_id: 'N10002931', // dr. Sp.PK
  analyte_name: 'Hemoglobin',
  loinc_code: '718-7',
  value: 14.5,
  ucum_unit: 'g/dL',
  ref_low: 13.0,
  ref_high: 17.0,
  interpretation_code: 'N', // Normal ('L' = Low, 'H' = High, 'PANIC' = Critical)
  effective_datetime: new Date().toISOString()
};

// 2. Pembentukan Resource Observation FHIR R4
const observationResource = {
  resourceType: 'Observation',
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
        code: labResult.loinc_code,
        display: labResult.analyte_name
      }
    ]
  },
  subject: {
    reference: `Patient/${labResult.patient_ihs_id}`
  },
  encounter: {
    reference: `Encounter/${labResult.encounter_id}`
  },
  effectiveDateTime: labResult.effective_datetime,
  issued: new Date().toISOString(),
  performer: [
    {
      reference: `Practitioner/${labResult.performer_ihs_id}`
    }
  ],
  valueQuantity: {
    value: labResult.value,
    unit: labResult.ucum_unit,
    system: 'http://unitsofmeasure.org',
    code: labResult.ucum_unit
  },
  referenceRange: [
    {
      low: { value: labResult.ref_low, unit: labResult.ucum_unit },
      high: { value: labResult.ref_high, unit: labResult.ucum_unit }
    }
  ]
};

console.log('Observation FHIR Valid:', observationResource.resourceType);
```

---

## Validasi Kepatuhan UU PDP (No. 27/2022) & PMK 24/2022
- Seluruh payload pengujian **DILARANG** menggunakan data NIK / identitas pasien nyata. Gunakan data sintetis.
- Komunikasi API ke endpoint SATUSEHAT (`https://api-satusehat.kemkes.go.id/fhir-r4/v1`) wajib menggunakan OAuth2 Bearer Token dengan TLS 1.3.
