// ═══════════════════════════════════════════════════════════════
// MODULE: UJI PROFISIENSI & PEMANTAPAN MUTU EKSTERNAL (PME)
// Standar ISO 15189:2022 Klausul 7.3.7.3 (Interlaboratory Comparison / EQA)
// ═══════════════════════════════════════════════════════════════

const PME_PROGRAMS = [
  { id: 'PME-KMK-2026-1', organizer: 'PME Kemenkes RI (BBLK Surabaya)', cycle: 'Siklus 1 2026', scope: 'Kimia Klinik & Hematologi' },
  { id: 'PME-RIQAS-2026-A', organizer: 'Randox RIQAS International', cycle: 'Monthly Cycle Aug 2026', scope: 'Imunologi & Hormon' }
];

let pmeResults = [
  {
    program_id: 'PME-KMK-2026-1',
    sample_code: 'PME-HEM-A1',
    parameter: 'Hemoglobin',
    unit: 'g/dL',
    lab_value: 14.2,
    peer_target: 14.0,
    peer_sd: 0.35,
    z_score: 0.57,
    evaluation: 'SATISFACTORY'
  },
  {
    program_id: 'PME-KMK-2026-1',
    sample_code: 'PME-KIM-B1',
    parameter: 'Glukosa Puasa',
    unit: 'mg/dL',
    lab_value: 128.0,
    peer_target: 125.0,
    peer_sd: 3.2,
    z_score: 0.94,
    evaluation: 'SATISFACTORY'
  }
];

/**
 * Kalkulasi Z-Score Uji Profisiensi PME
 * Z = (X_lab - Mean_peer) / SD_peer
 */
function calculatePmeZScore(labValue, peerTarget, peerSD) {
  const v = parseFloat(labValue);
  const target = parseFloat(peerTarget);
  const sd = parseFloat(peerSD);

  if (isNaN(v) || isNaN(target) || isNaN(sd) || sd <= 0) {
    throw new Error('Nilai lab, target peer, dan SD peer wajib bernilai numerik valid.');
  }

  const z = (v - target) / sd;
  const roundedZ = parseFloat(z.toFixed(2));
  const absZ = Math.abs(roundedZ);

  let evaluation = 'SATISFACTORY';
  let interpretation = 'Memuaskan (|Z| ≤ 2.0). Kinerja analitik sejalan dengan peer group.';

  if (absZ > 3.0) {
    evaluation = 'UNSATISFACTORY';
    interpretation = '❌ Tidak Memuaskan (|Z| > 3.0). Wajib menerbitkan formulir CAPA dan investigasi kalibrasi.';
  } else if (absZ > 2.0) {
    evaluation = 'QUESTIONABLE';
    interpretation = '⚠️ Meragukan (2.0 < |Z| ≤ 3.0). Pantau stabilitas reagen dan lakukan verifikasi QC.';
  }

  return {
    lab_value: v,
    peer_target: target,
    peer_sd: sd,
    z_score: roundedZ,
    evaluation,
    interpretation
  };
}

async function renderPmeProficiency() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#10b981; margin-bottom:6px;">
            🧬 ISO 15189:2022 KLAUSUL 7.3.7.3 &bull; PME EKSTERNAL
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Uji Profisiensi &amp; Pemantapan Mutu Eksternal (PME)
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Pencatatan siklus PME Kemenkes/BBLK/RIQAS, evaluasi Z-Score, dan komparasi akurasi analitik antar-laboratorium.
          </p>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Hasil Siklus PME Laboratorium Terbaru</h3>
        <table class="table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg2);">
              <th>Program PME</th>
              <th>Kode Sampel</th>
              <th>Parameter</th>
              <th>Hasil Lab</th>
              <th>Target Peer Group</th>
              <th>Z-Score</th>
              <th>Evaluasi</th>
            </tr>
          </thead>
          <tbody>
            ${pmeResults.map(r => `
              <tr>
                <td><b>${r.program_id}</b></td>
                <td style="font-family:monospace; color:var(--sky);">${r.sample_code}</td>
                <td><b>${r.parameter}</b></td>
                <td>${r.lab_value} ${r.unit}</td>
                <td>${r.peer_target} &plusmn; ${r.peer_sd} ${r.unit}</td>
                <td><b style="font-family:monospace;">${r.z_score}</b></td>
                <td><span class="badge ${r.evaluation === 'SATISFACTORY' ? 'badge-success' : 'badge-warning'}">${r.evaluation}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderPmeProficiency = renderPmeProficiency;
  window.calculatePmeZScore = calculatePmeZScore;
  window.PME_PROGRAMS = PME_PROGRAMS;
  window.pmeResults = pmeResults;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPmeProficiency,
    calculatePmeZScore,
    PME_PROGRAMS,
    pmeResults
  };
}
