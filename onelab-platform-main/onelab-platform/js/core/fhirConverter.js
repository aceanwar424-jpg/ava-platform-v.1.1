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
  // Nilai hasil, LOINC, satuan, dan pasien TIDAK boleh dikarang.
  // Versi sebelumnya memakai nilai cadangan: nilai_hasil || 14.2,
  // loinc_code || '58410-2', patient_id || 'pat-001'. Artinya hasil lab
  // fiktif bisa terkirim ke sistem kesehatan nasional atas nama pasien
  // sungguhan — jauh lebih berbahaya daripada gagal mengirim.
  const nilai = parseFloat(resultData.nilai_hasil);
  if (!Number.isFinite(nilai)) {
    throw new Error(`Nilai hasil "${resultData.nama_tes || 'pemeriksaan'}" kosong atau bukan angka. ` +
                    'Hasil kualitatif belum didukung pengiriman Observation.');
  }
  if (!resultData.loinc_code) {
    throw new Error(`Kode LOINC belum diisi untuk "${resultData.nama_tes || 'pemeriksaan'}". ` +
                    'Lengkapi katalog tes sebelum mengirim ke SATUSEHAT.');
  }
  if (!resultData.satuan) {
    throw new Error(`Satuan (UCUM) belum diisi untuk "${resultData.nama_tes || 'pemeriksaan'}".`);
  }
  if (!resultData.satusehat_patient_id && !resultData.patient_id) {
    throw new Error('Pasien belum tertaut. Kirim resource Patient lebih dulu, lalu simpan ID SATUSEHAT-nya.');
  }
  const satuan = String(resultData.satuan);

  // Rentang rujukan hanya disertakan bila memang ada — bukan diisi angka contoh.
  const rMin = parseFloat(resultData.ref_min);
  const rMax = parseFloat(resultData.ref_max);
  const rentang = (Number.isFinite(rMin) || Number.isFinite(rMax)) ? {
    ...(Number.isFinite(rMin) ? { low:  { value: rMin, unit: satuan, system: 'http://unitsofmeasure.org', code: satuan } } : {}),
    ...(Number.isFinite(rMax) ? { high: { value: rMax, unit: satuan, system: 'http://unitsofmeasure.org', code: satuan } } : {}),
  } : null;

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
          code: resultData.loinc_code,
          display: resultData.nama_tes
        }
      ],
      text: resultData.nama_tes
    },
    subject: {
      reference: `Patient/${resultData.satusehat_patient_id || resultData.patient_id}`
    },
    effectiveDateTime: resultData.tanggal_hasil || resultData.created_at || new Date().toISOString(),
    valueQuantity: {
      value: nilai,
      unit: satuan,
      system: 'http://unitsofmeasure.org',
      code: satuan
    },
    ...(rentang ? { referenceRange: [rentang] } : {})
  };
}

/**
 * Simulasi Sinkronisasi Data ke Gateway SATUSEHAT Kemenkes RI
 */
/**
 * Kunjungan pasien → Resource FHIR 'Encounter'.
 * Encounter adalah wadah yang mengikat pemeriksaan ke satu kunjungan;
 * tanpa ini Observation dan DiagnosticReport menggantung tanpa konteks.
 */
function convertToFhirEncounter(visitData, orgId) {
  const pasien = visitData.satusehat_patient_id || visitData.patient_id;
  if (!pasien) throw new Error('Pasien belum tertaut untuk kunjungan ini.');
  if (!orgId) throw new Error('SATUSEHAT_ORG_ID belum diset di sisi server.');

  // Kelas kunjungan mengikuti terminologi HL7 v3 ActCode:
  // AMB = rawat jalan, IMP = rawat inap, HH = layanan ke rumah.
  const petaKelas = {
    'rawat jalan': 'AMB', 'rajal': 'AMB', 'outpatient': 'AMB',
    'rawat inap': 'IMP', 'ranap': 'IMP', 'inpatient': 'IMP',
    'home care': 'HH', 'homecare': 'HH', 'home service': 'HH',
  };
  const kode = petaKelas[String(visitData.jenis_kunjungan || '').toLowerCase()] || 'AMB';
  const mulai = visitData.tanggal_kunjungan || visitData.created_at || new Date().toISOString();

  return {
    resourceType: 'Encounter',
    id: visitData.id || `enc-${Date.now()}`,
    status: visitData.status_selesai ? 'finished' : 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: kode,
      display: kode === 'IMP' ? 'inpatient encounter'
             : kode === 'HH'  ? 'home health' : 'ambulatory',
    },
    subject: {
      reference: `Patient/${pasien}`,
      display: visitData.patient_name || undefined,
    },
    period: {
      start: mulai,
      ...(visitData.tanggal_selesai ? { end: visitData.tanggal_selesai } : {}),
    },
    serviceProvider: { reference: `Organization/${orgId}` },
  };
}

/**
 * Laporan hasil lab → Resource FHIR 'DiagnosticReport'.
 * Merangkum beberapa Observation menjadi satu laporan yang diterbitkan.
 *
 * @param {object}   reportData     data laporan lokal
 * @param {string[]} observationIds ID Observation yang SUDAH dikirim ke SATUSEHAT
 */
function convertToFhirDiagnosticReport(reportData, observationIds = []) {
  const pasien = reportData.satusehat_patient_id || reportData.patient_id;
  if (!pasien) throw new Error('Pasien belum tertaut untuk laporan ini.');
  if (!Array.isArray(observationIds) || !observationIds.length) {
    // Laporan tanpa hasil yang sudah terdaftar akan ditolak / jadi laporan kosong
    // di sistem nasional. Lebih baik berhenti di sini dengan sebab yang jelas.
    throw new Error('Kirim Observation-nya lebih dulu; DiagnosticReport merujuk ID hasil dari SATUSEHAT.');
  }

  return {
    resourceType: 'DiagnosticReport',
    id: reportData.id || `dr-${Date.now()}`,
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
        code: 'LAB',
        display: 'Laboratory',
      }],
    }],
    code: {
      coding: reportData.loinc_code ? [{
        system: 'http://loinc.org',
        code: reportData.loinc_code,
        display: reportData.nama_panel || undefined,
      }] : undefined,
      text: reportData.nama_panel || 'Laporan Hasil Laboratorium',
    },
    subject: { reference: `Patient/${pasien}` },
    ...(reportData.satusehat_encounter_id
        ? { encounter: { reference: `Encounter/${reportData.satusehat_encounter_id}` } } : {}),
    effectiveDateTime: reportData.tanggal_hasil || reportData.created_at || new Date().toISOString(),
    issued: reportData.tanggal_terbit || new Date().toISOString(),
    result: observationIds.map(id => ({ reference: `Observation/${id}` })),
    ...(reportData.kesimpulan ? { conclusion: String(reportData.kesimpulan) } : {}),
  };
}

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
  convertToFhirEncounter,
  convertToFhirDiagnosticReport,
  syncToSatuSehat,
  statusSatuSehat,
  FHIR_CONFIG
};
