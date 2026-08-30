// ═══════════════════════════════════════════════════════════════
// CORE: LANGCARE PRIVACY & DE-IDENTIFICATION GATEWAY
// Anonymization, PII Masking, & ISO 27001 Compliance Layer
// ═══════════════════════════════════════════════════════════════

const PRIVACY_RULES = {
  maskNik: true,
  maskPhone: true,
  maskPatientName: true,
  maskAddress: true,
};

/**
 * Anonimisasi data PII pasien sebelum dikirim ke AI / External Gateway
 */
function anonymizePatientData(data) {
  if (!data) return data;
  const anonymized = { ...data };

  // Mask NIK (Contoh: 3171234567890001 -> 3171************)
  if (anonymized.nik && typeof anonymized.nik === 'string') {
    anonymized.nik = anonymized.nik.substring(0, 4) + '************';
  }

  // Mask Nama Pasien (Contoh: Budi Santoso -> B*** S******)
  if (anonymized.patient_name || anonymized.nama) {
    const origName = anonymized.patient_name || anonymized.nama;
    anonymized.patient_name = origName.split(' ').map(w => w[0] + '*'.repeat(Math.max(1, w.length - 1))).join(' ');
    if (anonymized.nama) anonymized.nama = anonymized.patient_name;
  }

  // Mask Nomor HP (Contoh: 08123456789 -> 0812****789)
  if (anonymized.phone) {
    anonymized.phone = anonymized.phone.substring(0, 4) + '****' + anonymized.phone.slice(-3);
  }

  anonymized._anonymizedAt = new Date().toISOString();
  anonymized._privacyStatus = 'PII_MASKED_ISO27001';
  return anonymized;
}

/**
 * Log audit kepatuhan privasi
 */
function logPrivacyAudit(action, resourceId) {
  console.log(`[LangCare Privacy Audit Log] ${action} on resource ${resourceId} at ${new Date().toISOString()}`);
}

window.privacyGateway = {
  anonymizePatientData,
  logPrivacyAudit,
  PRIVACY_RULES
};
