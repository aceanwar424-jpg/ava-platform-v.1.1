// ═══════════════════════════════════════════════════════════════
// MODULE: VERIFIKASI KELAYAKAN & KRITERIA PENOLAKAN SPESIMEN
// Standar ISO 15189:2022 Klausul 7.2.6 (Sample Acceptance & Rejection)
// ═══════════════════════════════════════════════════════════════

const REJECTION_CRITERIA = {
  HEMOLYSIS_SEVERE: { code: 'REJ-01', name: 'Hemolisis Berat (≥3+ / >300 mg/dL Hb bebas)', action: 'TOLAK untuk Kalium, LDH, SGOT, Faal Koagulasi' },
  LIPEMIC_SEVERE: { code: 'REJ-02', name: 'Lipemik Keruh Pekat / Kilomikron', action: 'Sentrifugasi ulang kecepatan tinggi / Tolak Elektrolit ISE' },
  ICTERIC_SEVERE: { code: 'REJ-03', name: 'Ikterik Pekat (Bilirubin >20 mg/dL)', action: 'Verifikasi metode kimia bebas interferensi kromogen' },
  CLOTTED_EDTA: { code: 'REJ-04', name: 'Bekuan / Micro-clot pada Tabung EDTA/Citrate', action: 'TOLAK MUTLAK untuk Hematologi & Koagulasi (Minta tusuk ulang)' },
  INSUFFICIENT_VOLUME: { code: 'REJ-05', name: 'Volume Kurang / QNS (Quantity Not Sufficient)', action: 'TOLAK jika rasio antikoagulan sitrat tidak 1:9 atau tabung vakum tidak penuh' },
  TEMPERATURE_EXCEEDED: { code: 'REJ-06', name: 'Suhu Rantai Dingin Rusak (>8.0°C saat diterima)', action: 'TOLAK untuk gas darah, hormon labil, dan kultur mikroba' }
};

/**
 * Evaluasi Kelayakan Spesimen
 */
function evaluateSpecimenSuitability(evaluationData) {
  const {
    accession_no,
    hemolysis_grade = 'NONE', // 'NONE' | 'SLIGHT_1+' | 'MODERATE_2+' | 'SEVERE_3+' | 'GROSS_4+'
    is_lipemic = false,
    is_clotted = false,
    volume_adequate = true,
    temperature_celsius = 4.0,
    tube_matching = true
  } = evaluationData;

  const reasons = [];
  let is_suitable = true;

  if (['SEVERE_3+', 'GROSS_4+'].includes(hemolysis_grade)) {
    is_suitable = false;
    reasons.push(REJECTION_CRITERIA.HEMOLYSIS_SEVERE);
  }

  if (is_clotted) {
    is_suitable = false;
    reasons.push(REJECTION_CRITERIA.CLOTTED_EDTA);
  }

  if (!volume_adequate) {
    is_suitable = false;
    reasons.push(REJECTION_CRITERIA.INSUFFICIENT_VOLUME);
  }

  if (temperature_celsius > 8.0) {
    is_suitable = false;
    reasons.push(REJECTION_CRITERIA.TEMPERATURE_EXCEEDED);
  }

  if (!tube_matching) {
    is_suitable = false;
    reasons.push({ code: 'REJ-07', name: 'Tabung Antikoagulan Salah / Mismatch', action: 'Sampling ulang pada tabung yang benar' });
  }

  return {
    accession_no,
    is_suitable,
    status: is_suitable ? 'ACCEPTED_FOR_ANALYSIS' : 'REJECTED_SPECIMEN',
    evaluated_at: new Date().toISOString(),
    clause: 'ISO 15189:2022 Clause 7.2.6',
    reasons,
    action_required: is_suitable ? 'Spesimen layak masuk ke worklist analyzer.' : 'Kirim permintaan pengambilan spesimen ulang (Repeat Sampling Form).'
  };
}

async function renderSpecimenVerification() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#f59e0b; margin-bottom:6px;">
            ⚠️ ISO 15189:2022 KLAUSUL 7.2.6 &bull; INTEGRITAS SPESIMEN
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Verifikasi Kelayakan &amp; Kriteria Penolakan Spesimen
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Pencegahan hasil analisis bias akibat hemolisis, bekuan mikro, lipemik pekat, dan volume kurang (QNS).
          </p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:16px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Form Evaluasi Spesimen Masuk</h3>
          <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
            <div>
              <label style="font-weight:700; display:block; margin-bottom:4px;">Nomor Accession Barcode</label>
              <input type="text" id="eval-acc" class="input" value="L260830-0001" style="font-family:monospace;">
            </div>
            <div>
              <label style="font-weight:700; display:block; margin-bottom:4px;">Derajat Hemolisis Serum/Plasma</label>
              <select id="eval-hemo" class="input">
                <option value="NONE">Negatif / Jernih (Normal)</option>
                <option value="SLIGHT_1+">Slight 1+ (Hb 50-100 mg/dL)</option>
                <option value="MODERATE_2+">Moderate 2+ (Hb 100-300 mg/dL)</option>
                <option value="SEVERE_3+">Severe 3+ (Hb >300 mg/dL - TOLAK)</option>
                <option value="GROSS_4+">Gross 4+ (Merah Gelap - TOLAK MUTLAK)</option>
              </select>
            </div>
            <div style="display:flex; gap:16px;">
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="checkbox" id="eval-clot"> Adanya Bekuan (Clotted)
              </label>
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="checkbox" id="eval-qns"> Volume Kurang (QNS)
              </label>
            </div>
            <button class="btn btn-teal" style="margin-top:8px;" onclick="
              const acc = document.getElementById('eval-acc').value;
              const hemo = document.getElementById('eval-hemo').value;
              const clotted = document.getElementById('eval-clot').checked;
              const qns = document.getElementById('eval-qns').checked;
              const res = evaluateSpecimenSuitability({ accession_no: acc, hemolysis_grade: hemo, is_clotted: clotted, volume_adequate: !qns });
              alert(res.is_suitable ? '✅ SPESIMEN DITERIMA: Layak lanjut ke analyzer.' : '❌ SPESIMEN DITOLAK: ' + res.reasons.map(r=>r.name).join(', '));
            ">
              🔍 Evaluasi &amp; Simpan Status
            </button>
          </div>
        </div>

        <div class="card" style="padding:20px;">
          <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Daftar Kriteria Penolakan Resmi (SOP-LAB-012)</h3>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
            ${Object.values(REJECTION_CRITERIA).map(c => `
              <div style="padding:8px; background:var(--bg2); border-radius:6px; border-left:3px solid #ef4444;">
                <b style="color:var(--text);">${c.code} - ${c.name}</b>
                <div style="color:var(--text3); margin-top:2px;">Tindakan: ${c.action}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderSpecimenVerification = renderSpecimenVerification;
  window.evaluateSpecimenSuitability = evaluateSpecimenSuitability;
  window.REJECTION_CRITERIA = REJECTION_CRITERIA;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderSpecimenVerification,
    evaluateSpecimenSuitability,
    REJECTION_CRITERIA
  };
}
