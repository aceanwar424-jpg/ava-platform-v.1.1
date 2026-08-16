// ═══════════════════════════════════════════════════════════════
// CORE: HL7 FHIR v4 CONVERTER & SATUSEHAT KEMENKES RI API BRIDGE
// Standard Interoperability Engine for Patient, Observation & DiagnosticReport
// ═══════════════════════════════════════════════════════════════

// Alamat dan kredensial SATUSEHAT TIDAK lagi ditetapkan di sini. Peramban
// tidak boleh memegang client secret, dan organizationId berbeda tiap faskes —
// nilai yang ter-hardcode akan ikut terdistribusi ke klien lain saat produk
// dijual. Semuanya kini di desktop-app/.env, dibaca engine.
// Kesiapannya bisa dibaca lewat statusSatuSehat().
const FHIR_CONFIG = {
  sistemNik:   'https://fhir.kemkes.go.id/id/nik',
  sistemRekMed: 'https://fhir.kemkes.go.id/id/rme',
};

/**
 * Mengubah data Pasien lokal ke Resource FHIR 'Patient'
 */
function convertToFhirPatient(patientData) {
  // NIK WAJIB dan tidak boleh dikarang. Sebelumnya ada nilai cadangan
  // '3171234567890001' bila NIK kosong — itu akan mendaftarkan pasien ke
  // sistem kesehatan nasional atas nomor identitas yang bukan miliknya.
  // Lebih baik gagal di sini daripada mengirim data yang salah orang.
  const nik = String(patientData.nik || '').trim();
  if (!/^\d{16}$/.test(nik)) {
    throw new Error('NIK pasien wajib 16 digit untuk pengiriman ke SATUSEHAT. ' +
                    'Lengkapi data pasien terlebih dahulu.');
  }
  const nama = (patientData.patient_name || patientData.nama || '').trim();
  if (!nama) throw new Error('Nama pasien wajib diisi untuk pengiriman ke SATUSEHAT.');

  return {
    resourceType: 'Patient',
    id: patientData.id || `pat-${Date.now()}`,
    identifier: [
      {
        use: 'official',
        system: FHIR_CONFIG.sistemNik,
        value: nik
      }
    ],
    name: [
      {
        use: 'official',
        text: nama
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
// Mengirim resource FHIR ke SATUSEHAT lewat gerbang sisi server.
//
// Versi sebelumnya TIDAK mengirim apa pun: ia hanya mencetak log lalu
// mengembalikan success:true dengan ID karangan `satusehat-<timestamp>`.
// Aplikasi melaporkan "SYNCED_TO_KEMENKES" padahal tidak ada yang sampai —
// jenis kegagalan paling berbahaya, karena tidak ada yang terlihat salah.
//
// Kredensial SATUSEHAT tidak boleh berada di peramban; engine yang memegang
// client secret dan menukar token.
async function syncToSatuSehat(resource, opsi = {}) {
  if (!resource || !resource.resourceType) {
    return { success: false, error: 'Resource FHIR tidak sah (resourceType kosong)' };
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/satusehat`, {
      method: 'POST',
      headers: { ...SB_HEADERS },
      body: JSON.stringify({
        metode: opsi.metode || 'POST',
        jalur: opsi.jalur || resource.resourceType,
        resource,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || `SATUSEHAT menolak (HTTP ${res.status})`,
        detail: data,
      };
    }
    return {
      success: true,
      satusehatId: data.id || null,     // ID sesungguhnya dari Kemenkes
      resourceType: resource.resourceType,
      detail: data,
    };
  } catch (e) {
    return { success: false, error: 'Gagal menghubungi gerbang SATUSEHAT: ' + (e.message || e) };
  }
}

// Kesiapan integrasi — untuk ditampilkan di antarmuka sebelum mencoba kirim.
async function statusSatuSehat() {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/satusehat/status`, { headers: { ...SB_HEADERS } });
    if (!res.ok) return { siap: false, error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) { return { siap: false, error: e.message || String(e) }; }
}

window.fhirConverter = {
  convertToFhirPatient,
  convertToFhirObservation,
  syncToSatuSehat,
  statusSatuSehat,
  FHIR_CONFIG
};
