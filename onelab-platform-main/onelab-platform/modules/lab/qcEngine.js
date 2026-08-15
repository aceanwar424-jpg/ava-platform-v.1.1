// ═══════════════════════════════════════════════════════════════
// MODULE: BIKA/LABKEY WESTGARD QC ENGINE & INSTRUMENT PARSER
// ISO 15189 Quality Control Evaluation & ASTM/HL7 Analyzer Bridge
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
 * Evaluasi QC berdasarkan nilai Terukur, Target Mean, dan Standard Deviation (SD)
 */
function evaluateWestgardRules(val, targetMean, sd, previousValues = []) {
  const zScore = (val - targetMean) / sd;
  const absZ = Math.abs(zScore);

  let status = 'PASS';
  let triggeredRule = null;
  let recommendation = 'Hasil QC Normal. Batch tes laboratorium dapat diloloskan.';

  if (absZ > 3.0) {
    status = 'REJECT';
    triggeredRule = '1-3s';
    recommendation = '⚠️ REJECT BATCH! Nilai QC menyimpang > 3 SD. Lakukan kalibrasi ulang instrumen.';
  } else if (absZ > 2.0) {
    if (previousValues.length > 0 && Math.abs((previousValues[previousValues.length - 1] - targetMean) / sd) > 2.0) {
      status = 'REJECT';
      triggeredRule = '2-2s';
      recommendation = '⚠️ REJECT BATCH! 2 nilai QC berturut-turut melebihi 2 SD (Kesalahan Sistematik).';
    } else {
      status = 'WARNING';
      triggeredRule = '1-2s';
      recommendation = '⚡ PERINGATAN: 1 nilai QC melebihi 2 SD. Amati hasil tes berikutnya.';
    }
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

window.westgardQcEngine = {
  WESTGARD_RULES,
  evaluateWestgardRules
};
