// ═══════════════════════════════════════════════════════════════
// MODULE: SMART QC & WESTGARD MULTI-RULES ENGINE (ISO 15189:2022)
// Evaluasi Otomatis Levey-Jennings, Westgard Rules & Six Sigma Metrics
// ═══════════════════════════════════════════════════════════════

const WESTGARD_RULES = [
  { code: '1-2s', name: 'Aturan Peringatan (Warning Rule)', type: 'WARNING', desc: '1 nilai QC melebihi 2 SD. Tandai untuk pengamatan.' },
  { code: '1-3s', name: 'Aturan Penolakan (Rejection Rule)', type: 'REJECT', desc: '1 nilai QC melebihi 3 SD. Hasil batch LAB HARUS DITOLAK.' },
  { code: '2-2s', name: 'Kesalahan Sistematik (Systematic Error)', type: 'REJECT', desc: '2 nilai QC berturut-turut melebihi 2 SD pada arah yang sama.' },
  { code: 'R-4s', name: 'Kesalahan Acak (Random Error)', type: 'REJECT', desc: 'Perbedaan antara 2 nilai QC berturut-turut melebihi 4 SD.' },
  { code: '4-1s', name: 'Tren Sistematik (Maintenance Needed)', type: 'WARNING', desc: '4 nilai QC berturut-turut melebihi 1 SD pada arah yang sama.' },
  { code: '10x',  name: 'Pergeseran Mean (Shift Error)', type: 'REJECT', desc: '10 nilai QC berturut-turut berada di satu sisi nilai Mean.' },
];

/**
 * Evaluasi Levey-Jennings & Westgard Multi-Rules
 * @param {number} val - Nilai QC saat ini
 * @param {number} targetMean - Nilai target mean kontrol
 * @param {number} sd - Standar Deviasi (SD)
 * @param {Array<number>} previousValues - Riwayat nilai QC sebelumnya (kronologis)
 */
function evaluateWestgardRules(val, targetMean, sd, previousValues = []) {
  if (!sd || sd <= 0) return { status: 'INVALID', message: 'SD harus lebih besar dari 0' };

  const zScore = (val - targetMean) / sd;
  const absZ = Math.abs(zScore);
  const allValues = [...previousValues, val];
  const allZScores = allValues.map(v => (v - targetMean) / sd);

  let status = 'PASS';
  let triggeredRule = null;
  let recommendation = 'Hasil QC Normal. Batch tes laboratorium dapat diloloskan.';

  // 1. Rule 1-3s (Rejection: Random / Large Error)
  if (absZ > 3.0) {
    status = 'REJECT';
    triggeredRule = '1-3s';
    recommendation = '🚫 REJECT BATCH! Nilai QC menyimpang > 3 SD (Kesalahan Acak / Gross Error). Hentikan analisis, periksa reagen dan kalibrasi ulang instrumen.';
  }
  // 2. Rule 2-2s (Rejection: Systematic Error)
  else if (allZScores.length >= 2) {
    const prevZ = allZScores[allZScores.length - 2];
    if ((zScore > 2.0 && prevZ > 2.0) || (zScore < -2.0 && prevZ < -2.0)) {
      status = 'REJECT';
      triggeredRule = '2-2s';
      recommendation = '🚫 REJECT BATCH! 2 nilai QC berturut-turut melebihi 2 SD pada arah yang sama (Kesalahan Sistematik). Periksa lot reagen atau stabilitas suhu inkubator.';
    }
  }

  // 3. Rule R-4s (Rejection: Random Error across run)
  if (status === 'PASS' && allZScores.length >= 2) {
    const prevZ = allZScores[allZScores.length - 2];
    if (Math.abs(zScore - prevZ) >= 4.0) {
      status = 'REJECT';
      triggeredRule = 'R-4s';
      recommendation = '🚫 REJECT BATCH! Rentang antara 2 nilai QC berturut-turut melebihi 4 SD (Kesalahan Acak Ekstrem). Ulangi tes QC dengan vial kontrol baru.';
    }
  }

  // 4. Rule 4-1s (Warning / Maintenance: Systematic Trend)
  if (status === 'PASS' && allZScores.length >= 4) {
    const last4 = allZScores.slice(-4);
    const allPos1s = last4.every(z => z > 1.0);
    const allNeg1s = last4.every(z => z < -1.0);
    if (allPos1s || allNeg1s) {
      status = 'WARNING';
      triggeredRule = '4-1s';
      recommendation = '⚡ PERINGATAN: 4 nilai berturut-turut melebihi 1 SD pada sisi yang sama (Tren Sistematik). Lakukan maintenance preventif pada probe / fotometer.';
    }
  }

  // 5. Rule 10x (Rejection / Shift: Bias Shift)
  if (status === 'PASS' && allZScores.length >= 10) {
    const last10 = allZScores.slice(-10);
    const allAboveMean = last10.every(z => z > 0);
    const allBelowMean = last10.every(z => z < 0);
    if (allAboveMean || allBelowMean) {
      status = 'REJECT';
      triggeredRule = '10x';
      recommendation = '🚫 REJECT BATCH! 10 nilai berturut-turut berada di satu sisi mean (Pergeseran Sistematik / Shift). Kalibrasi ulang diperlukan sebelum rilis hasil pasien.';
    }
  }

  // 6. Rule 1-2s (Warning: Single deviation)
  if (status === 'PASS' && absZ > 2.0) {
    status = 'WARNING';
    triggeredRule = '1-2s';
    recommendation = '⚡ PERINGATAN: 1 nilai QC melebihi 2 SD. Amati hasil tes kontrol berikutnya dengan seksama.';
  }

  return {
    val,
    targetMean,
    sd,
    zScore: parseFloat(zScore.toFixed(2)),
    status,
    triggeredRule,
    recommendation,
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * Kalkulasi Six Sigma Metrics untuk Instrumen Analitik
 * Rumus: Sigma = (TEa% - |Bias%|) / CV%
 * @param {number} teaPct - Total Allowable Error (CLIA / Ricos guideline %)
 * @param {number} biasPct - Bias akurasi terhadap nilai konsensus / peer group (%)
 * @param {number} cvPct - Koefisien Variasi presisi (%)
 */
function calculateSigmaMetrics(teaPct, biasPct, cvPct) {
  if (!cvPct || cvPct <= 0) return { sigma: 0, performance: 'INVALID', desc: 'CV% harus > 0' };

  const sigma = (teaPct - Math.abs(biasPct)) / cvPct;
  const roundedSigma = parseFloat(sigma.toFixed(2));

  let performance = 'UNACCEPTABLE';
  let qcStrategy = 'Multi-rules ketat + Frekuensi QC ditingkatkan';

  if (roundedSigma >= 6.0) {
    performance = 'WORLD_CLASS';
    qcStrategy = 'Single rule 1-3s (Evaluasi sederhana cukup, 1x per hari)';
  } else if (roundedSigma >= 5.0) {
    performance = 'EXCELLENT';
    qcStrategy = 'Westgard 1-3s, 2-2s, R-4s (1x per shift)';
  } else if (roundedSigma >= 4.0) {
    performance = 'GOOD';
    qcStrategy = 'Full Westgard multi-rules (2x per shift)';
  } else if (roundedSigma >= 3.0) {
    performance = 'MARGINAL';
    qcStrategy = 'Full Westgard multi-rules + troubleshooting berkala';
  }

  return {
    teaPct,
    biasPct,
    cvPct,
    sigma: roundedSigma,
    performance,
    qcStrategy
  };
}

if (typeof window !== 'undefined') {
  window.westgardQcEngine = {
    WESTGARD_RULES,
    evaluateWestgardRules,
    calculateSigmaMetrics
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WESTGARD_RULES,
    evaluateWestgardRules,
    calculateSigmaMetrics
  };
}
