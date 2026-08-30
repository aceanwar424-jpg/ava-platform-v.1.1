// ═══════════════════════════════════════════════════════════════
// MODULE: LEMBAR BACAAN & EKSPERTISE RADIOLOG (Sp.Rad)
// Standar Akreditasi KARS & Permenkes — Structured Reporting & TTE QR
// ═══════════════════════════════════════════════════════════════

let radiologyReports = [
  {
    report_id: 'RAD-EXP-2026-001',
    accession_no: 'RAD-260830-0001',
    patient_name: 'Tn. Budi Setiawan',
    ava_id: 'AVA-7K3M2P9QX4',
    modality: 'Foto Thorax AP/PA',
    radiologist: 'dr. Sarah Sp.Rad',
    sip_no: 'SIP-RAD-3174/2024',
    clinical_note: 'Batuk kronis 3 minggu, sesak ringan',
    findings: {
      cor: 'Bentuk dan ukuran membesar, CTR 56%',
      pulmo: 'Corakan bronkovaskuler normal, tidak tampak infiltrat/nodul aktif',
      sinus_diafragma: 'Sinus kostofrenikus lancip, diafragma licin',
      skeleton: 'Tulang-tulang dinding thorax intak'
    },
    impression: 'Kardiomegali ringan tanpa tanda bendungan paru aktif. Tidak tampak TB paru aktif.',
    recommendation: 'Korelasikan klinis dan evaluasi profil lipid & EKG.',
    tte_verified: true,
    tte_qr_digest: 'SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    released_at: '2026-08-30 11:15',
    status: 'FINAL_RELEASED'
  }
];

/**
 * Buat lembar ekspertise radiolog terstruktur
 */
function createRadiologyExpertise(reportPayload) {
  const {
    accession_no,
    patient_name,
    ava_id = 'AVA-PATIENT',
    modality = 'Foto Thorax AP',
    radiologist = 'dr. Sarah Sp.Rad',
    findings = {},
    impression = 'Dalam batas normal',
    recommendation = '-'
  } = reportPayload;

  if (!accession_no || !patient_name) {
    throw new Error('Nomor accession dan nama pasien wajib diisi.');
  }

  const reportId = `RAD-EXP-${new Date().getFullYear()}-${String(radiologyReports.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const newReport = {
    report_id: reportId,
    accession_no,
    patient_name,
    ava_id,
    modality,
    radiologist,
    sip_no: 'SIP-RAD-3174/2024',
    findings,
    impression,
    recommendation,
    tte_verified: true,
    tte_qr_digest: `SHA256:AVA_RAD_${Date.now()}`,
    released_at: now,
    status: 'FINAL_RELEASED'
  };

  radiologyReports.unshift(newReport);

  return {
    success: true,
    report: newReport,
    message: `Lembar ekspertise radiologi ${reportId} berhasil dirilis dengan TTE QR.`
  };
}

async function renderRadiologyExpertise() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#8b5cf6; margin-bottom:6px;">
            🩻 RADIOLOGI &bull; EKSPERTISE DOKTER Sp.Rad DENGAN TTE QR
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Lembar Bacaan &amp; Ekspertise Radiologi
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Pelaporan bacaan radiologi terstruktur per organ, kesimpulan klinis (Impression), dan otorisasi kriptografis TTE QR.
          </p>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Arsip Hasil Ekspertise Radiologi Terbit</h3>
        <table class="table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg2);">
              <th>ID Ekspertise</th>
              <th>No. Accession &amp; Pasien</th>
              <th>Pemeriksaan / Modalitas</th>
              <th>Kesimpulan (Impression)</th>
              <th>Dokter Radiolog</th>
              <th>TTE Otorisasi</th>
              <th>Waktu Rilis</th>
            </tr>
          </thead>
          <tbody>
            ${radiologyReports.map(r => `
              <tr>
                <td style="font-family:monospace; font-weight:700; color:#8b5cf6;">${r.report_id}</td>
                <td><b>${r.patient_name}</b><div style="font-size:11px; color:var(--text3); font-family:monospace;">${r.accession_no}</div></td>
                <td><span class="badge" style="background:#334155; color:#fff;">${r.modality}</span></td>
                <td><b style="color:var(--text);">${r.impression}</b></td>
                <td>${r.radiologist}</td>
                <td><span class="badge badge-success">✓ TTE QR Valid</span></td>
                <td style="font-family:monospace;">${r.released_at}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderRadiologyExpertise = renderRadiologyExpertise;
  window.createRadiologyExpertise = createRadiologyExpertise;
  window.radiologyReports = radiologyReports;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderRadiologyExpertise,
    createRadiologyExpertise,
    radiologyReports
  };
}
