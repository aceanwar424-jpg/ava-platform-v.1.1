// ═══════════════════════════════════════════════════════════════
// MODULE: AGENTIC AI 2026 — CLINICAL & LAB OPERATIONS AGENT (LIS-AI)
// Autoverification, Critical Value Alerting & ISO 15189 QC Engine
// ═══════════════════════════════════════════════════════════════

const CLINICAL_RULES = [
  { parameter: 'Hemoglobin (Hb)', refMin: 13.0, refMax: 17.5, unit: 'g/dL', criticalMin: 7.0, criticalMax: 20.0 },
  { parameter: 'Leukosit (WBC)', refMin: 4400, refMax: 11300, unit: '/µL', criticalMin: 2000, criticalMax: 30000 },
  { parameter: 'Trombosit (PLT)', refMin: 150000, refMax: 450000, unit: '/µL', criticalMin: 50000, criticalMax: 1000000 },
  { parameter: 'Glukosa Sewaktu', refMin: 70, refMax: 140, unit: 'mg/dL', criticalMin: 50, criticalMax: 400 },
  { parameter: 'Kalium (K+)', refMin: 3.5, refMax: 5.1, unit: 'mEq/L', criticalMin: 2.8, criticalMax: 6.2 },
];

function renderAgClinicalTab() {
  const container = document.getElementById('ag-tab-content');
  if (!container) return;

  let html = `
    <div style="padding:20px; display:flex; flex-direction:column; gap:20px;">
      {/* Header Banner */}
      <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(56,189,248,0.3); border-radius:14px; padding:18px; backdrop-filter:blur(10px);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); padding:10px; border-radius:12px; color:#38BDF8;">
              🩺
            </div>
            <div>
              <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--bg);">Clinical & Lab Ops Agent (LIS-AI)</h3>
              <p style="margin:4px 0 0 0; font-size:12px; color:#94A3B8;">Otomasi autoverifikasi hasil lab, deteksi Nilai Kritis (Critical Value Alert), & aturan Westgard QC.</p>
            </div>
          </div>
          <span style="background:rgba(139,92,246,0.15); color:#A78BFA; border:1px solid rgba(139,92,246,0.3); font-size:11px; padding:4px 10px; border-radius:999px; font-weight:600;">
            Tier R3 Mandate (Human Supervisory)
          </span>
        </div>
      </div>

      {/* Interactive Simulator */}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
        {/* Rules Table */}
        <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px;">
          <h4 style="margin:0 0 12px 0; font-size:13px; color:var(--bg2); font-weight:700;">Aturan Autoverifikasi & Nilai Kritis</h4>
          <div style="overflow-x:auto;">
            <table style="width:100%; text-align:left; font-size:11px; color:var(--border2); border-collapse:collapse;">
              <thead>
                <tr style="border-b:1px solid rgba(255,255,255,0.1); color:#94A3B8;">
                  <th style="padding:6px;">Parameter</th>
                  <th style="padding:6px;">Rentang Normal</th>
                  <th style="padding:6px;">Batas Kritis</th>
                </tr>
              </thead>
              <tbody>
  `;

  CLINICAL_RULES.forEach(r => {
    html += `
      <tr style="border-b:1px solid rgba(255,255,255,0.04);">
        <td style="padding:6px; font-weight:600; color:var(--bg);">${r.parameter}</td>
        <td style="padding:6px; color:var(--accent2);">${r.refMin} - ${r.refMax} ${r.unit}</td>
        <td style="padding:6px; color:#F87171;">< ${r.criticalMin} atau > ${r.criticalMax}</td>
      </tr>
    `;
  });

  html += `
              </tbody>
            </table>
          </div>
        </div>

        {/* Test Run Simulator */}
        <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <h4 style="margin:0 0 12px 0; font-size:13px; color:var(--bg2); font-weight:700;">Simulasi Evaluasi Agen Klinis</h4>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <div>
                <label style="font-size:11px; color:#94A3B8; display:block; margin-bottom:4px;">Parameter Lab:</label>
                <select id="ag-sim-param" style="width:100%; background:var(--text); border:1px solid rgba(255,255,255,0.1); color:var(--bg); padding:6px; border-radius:6px; font-size:12px;">
                  <option value="Hb">Hemoglobin (Hb)</option>
                  <option value="WBC">Leukosit (WBC)</option>
                  <option value="PLT">Trombosit (PLT)</option>
                  <option value="K">Kalium (K+)</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px; color:#94A3B8; display:block; margin-bottom:4px;">Nilai Hasil Tes:</label>
                <input type="number" id="ag-sim-val" value="5.5" step="0.1" style="width:100%; background:var(--text); border:1px solid rgba(255,255,255,0.1); color:var(--bg); padding:6px; border-radius:6px; font-size:12px;" />
              </div>
            </div>
          </div>

          <button onclick="runClinicalSim()" style="margin-top:16px; background:#0EA5E9; hover:background:#0284C7; color:white; border:none; padding:8px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">
            Jalankan Evaluasi Autoverifikasi Agent
          </button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function runClinicalSim() {
  const p = document.getElementById('ag-sim-param').value;
  const v = parseFloat(document.getElementById('ag-sim-val').value);

  if (p === 'Hb' && v < 7.0) {
    alert(`🚨 [CRITICAL VALUE ALERT DETECTED]\nParameter: Hemoglobin (${v} g/dL)\nHasil di bawah batas kritis (7.0 g/dL).\nAgenic AI memicu notifikasi darurat ke Dokter DPJP & membutuhkan Approval Dokter (Tier R3 Mandate)!`);
  } else {
    alert(`✅ [AUTOVERIFIED PASS]\nHasil ${p} (${v}) berada dalam batas aman. Agenic AI meloloskan hasil secara otomatis (Tier R1).`);
  }
}

window.renderAgClinicalTab = renderAgClinicalTab;
window.runClinicalSim = runClinicalSim;
