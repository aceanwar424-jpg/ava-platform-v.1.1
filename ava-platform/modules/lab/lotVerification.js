// ═══════════════════════════════════════════════════════════════
// MODULE: VERIFIKASI LOT-TO-LOT REAGEN BARU (PARALLEL TESTING)
// Standar CLSI EP26-A / ISO 15189:2022 Klausul 6.4 (Reagent Lot Verification)
// ═══════════════════════════════════════════════════════════════

let lotVerifications = [
  {
    id: 'LOT-VER-01',
    parameter: 'Kolesterol Total',
    analyzer: 'Mindray BS-240',
    old_lot_no: 'LOT-CHOL-2026A',
    new_lot_no: 'LOT-CHOL-2026B',
    tested_at: '2026-08-30',
    sample_pairs: [
      { sample_id: 'SPL-01', old_val: 185.0, new_val: 187.0 },
      { sample_id: 'SPL-02', old_val: 220.0, new_val: 222.0 },
      { sample_id: 'SPL-03', old_val: 145.0, new_val: 144.0 },
      { sample_id: 'SPL-04', old_val: 260.0, new_val: 264.0 },
      { sample_id: 'SPL-05', old_val: 195.0, new_val: 198.0 }
    ],
    mean_bias_pct: 1.15,
    status: 'APPROVED_FOR_USE',
    verifier: 'dr. Penanggung Jawab Sp.PK'
  }
];

/**
 * Kalkulasi Evaluasi Uji Paralel Lot Reagen Baru (CLSI EP26-A)
 * @param {Array<{old_val: number, new_val: number}>} samplePairs 
 * @param {number} maxAllowedBiasPct - Batas toleransi %Bias (default: 5.0%)
 */
function evaluateLotToLotVerification(lotData) {
  const {
    parameter,
    old_lot_no,
    new_lot_no,
    sample_pairs = [],
    max_bias_pct = 5.0
  } = lotData;

  if (!sample_pairs.length) {
    throw new Error('Minimal 5 pasang sampel uji paralel wajib disertakan.');
  }

  let totalBiasPct = 0;
  const pairDetails = sample_pairs.map(p => {
    const oldV = parseFloat(p.old_val);
    const newV = parseFloat(p.new_val);
    const diff = newV - oldV;
    const pct = oldV !== 0 ? (diff / oldV) * 100 : 0;
    totalBiasPct += Math.abs(pct);

    return {
      sample_id: p.sample_id || 'Sample',
      old_val: oldV,
      new_val: newV,
      diff,
      bias_pct: parseFloat(pct.toFixed(2))
    };
  });

  const meanBiasPct = parseFloat((totalBiasPct / sample_pairs.length).toFixed(2));
  const isApproved = meanBiasPct <= max_bias_pct;

  return {
    parameter,
    old_lot_no,
    new_lot_no,
    tested_count: sample_pairs.length,
    mean_bias_pct: meanBiasPct,
    max_allowed_bias: max_bias_pct,
    is_approved: isApproved,
    status: isApproved ? 'APPROVED_FOR_USE' : 'REJECTED_SIGNIFICANT_BIAS',
    interpretation: isApproved
      ? `✅ Lot baru ${new_lot_no} DISETUJUI. Rerata bias (${meanBiasPct}%) dalam batas toleransi ≤ ${max_bias_pct}%.`
      : `❌ Lot baru ${new_lot_no} DITOLAK. Rerata bias (${meanBiasPct}%) melebihi batas toleransi > ${max_bias_pct}%. Hubungi supplier reagen.`
  };
}

async function renderLotVerification() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#8b5cf6; margin-bottom:6px;">
            🧪 STANDAR CLSI EP26-A &bull; VERIFIKASI LOT REAGEN
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Verifikasi Lot-to-Lot Reagen Baru (Parallel Testing)
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Uji komparasi 5–10 sampel pada pergantian nomor lot baru sebelum dipakai rilis hasil pasien.
          </p>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Riwayat Verifikasi Lot Reagen Baru</h3>
        <table class="table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg2);">
              <th>ID Uji</th>
              <th>Parameter</th>
              <th>Alat Analyzer</th>
              <th>Lot Lama ➔ Lot Baru</th>
              <th>Rerata %Bias</th>
              <th>Status Kelayakan</th>
              <th>Otorisasi</th>
            </tr>
          </thead>
          <tbody>
            ${lotVerifications.map(v => `
              <tr>
                <td style="font-family:monospace; font-weight:700;">${v.id}</td>
                <td><b>${v.parameter}</b></td>
                <td>${v.analyzer}</td>
                <td><span style="color:var(--text3);">${v.old_lot_no}</span> &rarr; <b style="color:var(--sky);">${v.new_lot_no}</b></td>
                <td><b style="font-family:monospace; color:#10b981;">${v.mean_bias_pct}%</b></td>
                <td><span class="badge badge-success">✓ Disetujui Digunakan</span></td>
                <td>${v.verifier}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderLotVerification = renderLotVerification;
  window.evaluateLotToLotVerification = evaluateLotToLotVerification;
  window.lotVerifications = lotVerifications;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderLotVerification,
    evaluateLotToLotVerification,
    lotVerifications
  };
}
