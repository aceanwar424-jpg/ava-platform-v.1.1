// ═══════════════════════════════════════════════════════════════
// MODULE: SMART QC & WESTGARD MULTI-RULES ENGINE (ISO 15189:2022)
// Evaluasi Otomatis Levey-Jennings, Westgard Rules & Six Sigma Metrics
// ═══════════════════════════════════════════════════════════════

const WESTGARD_RULES = [
  { code: '1-2s', name: 'Aturan Peringatan (Warning Rule)', type: 'WARNING', desc: '1 nilai QC melebihi 2 SD. Tandai untuk pengamatan.' },
  { code: '1-3s', name: 'Aturan Penolakan (Rejection Rule)', type: 'REJECT', desc: '1 nilai QC melebihi 3 SD. Hasil batch LAB HARUS DITOLAK.' },
  { code: '2-2s', name: 'Kesalahan Sistematik (Systematic Error)', type: 'REJECT', desc: '2 nilai QC berturut-turut melebihi 2 SD pada arah yang sama.' },
  { code: 'R-4s', name: 'Kesalahan Acak (Random Error)', type: 'REJECT', desc: 'Rentang dua level dalam run yang sama melebihi 4 SD.' },
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
// One evaluator; chronology is oldest to newest. R-4s requires explicit same-run levels.
function evaluateWestgardZ(zScores, sameRunZ=[]) {
  if(!zScores.length || [...zScores,...sameRunZ].some(v=>typeof v!=='number'||!Number.isFinite(v)))
    return {status:'INVALID',triggeredRule:null,recommendation:'Data QC tidak valid; tinjau input.'};
  const z=zScores.at(-1),same=(n,t)=>zScores.length>=n &&
    (zScores.slice(-n).every(v=>v>t)||zScores.slice(-n).every(v=>v < -t));
  let rule=null,status='PASS';
  const run = sameRunZ;
  if(Math.abs(z)>3) rule='1-3s';
  else if(same(2,2)) rule='2-2s';
  // Historical values do not establish that controls belong to the same run.
  // Callers must supply same-run levels explicitly for R-4s.
  else if(run.length>=2 && Math.max(...run)>2 && Math.min(...run)<-2 && Math.max(...run)-Math.min(...run)>4) rule='R-4s';
  else if(same(10,0)) rule='10x';
  if(rule) status='REJECT';
  else if(same(4,1)){rule='4-1s';status='WARNING';}
  else if(Math.abs(z)>2){rule='1-2s';status='WARNING';}
  return {status,triggeredRule:rule,zScore:z,ruleVersion:'ava-qc-1.1',
    recommendation:status==='PASS'?'Tidak ada pelanggaran aturan terpilih. Tinjau kelengkapan QC sesuai SOP.':
      status==='REJECT'?'Pelanggaran '+rule+'. Tahan dan tinjau QC sesuai SOP.':'Peringatan '+rule+'. Tinjau QC sesuai SOP.'};
}
function evaluateWestgardRules(val,targetMean,sd,previousValues=[],sameRunValues=[]) {
  const values=[val,targetMean,sd,...previousValues,...sameRunValues];
  if(values.some(v=>v==null||v===''||typeof v==='boolean'||!Number.isFinite(Number(v))) || Number(sd)<=0)
    return {status:'INVALID',message:'Nilai, target dan SD harus berupa angka; SD harus positif'};
  return {...evaluateWestgardZ([...previousValues,val].map(v=>(Number(v)-Number(targetMean))/Number(sd)),
    sameRunValues.map(v=>(Number(v)-Number(targetMean))/Number(sd))),val,targetMean,sd};
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
    evaluateWestgardZ,
    evaluateWestgardRules,
    calculateSigmaMetrics
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WESTGARD_RULES,
    evaluateWestgardZ,
    evaluateWestgardRules,
    calculateSigmaMetrics
  };
}
