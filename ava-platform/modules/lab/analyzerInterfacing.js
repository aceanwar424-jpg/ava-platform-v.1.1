// ═══════════════════════════════════════════════════════════════
// MODULE: MASTER INTERFACING ALAT ANALYZER (ASTM E1381 / E1394 & HL7 v2)
// Jembatan Bi-directional LIS dengan Mesin Laboratorium (Port :9999)
// ═══════════════════════════════════════════════════════════════

const ANALYZER_DRIVERS = [
  {
    id: 'ALAT-01',
    name: 'Sysmex XN-550',
    type: 'Hematologi 5-Diff',
    protocol: 'ASTM E1381/E1394',
    ip_host: '192.168.1.110',
    port: 9999,
    status: 'ONLINE',
    channel_mappings: [
      { machine_code: 'WBC', loinc: '6690-2', internal_code: 'LAB-HEM-001.3', param_name: 'Leukosit' },
      { machine_code: 'RBC', loinc: '789-8', internal_code: 'LAB-HEM-001.2', param_name: 'Eritrosit' },
      { machine_code: 'HGB', loinc: '718-7', internal_code: 'LAB-HEM-001.1', param_name: 'Hemoglobin' },
      { machine_code: 'HCT', loinc: '4544-3', internal_code: 'LAB-HEM-001.5', param_name: 'Hematokrit' },
      { machine_code: 'PLT', loinc: '777-3', internal_code: 'LAB-HEM-001.4', param_name: 'Trombosit' }
    ]
  },
  {
    id: 'ALAT-02',
    name: 'Mindray BS-240',
    type: 'Kimia Klinik Otomatis',
    protocol: 'ASTM E1381/E1394',
    ip_host: '192.168.1.112',
    port: 9999,
    status: 'ONLINE',
    channel_mappings: [
      { machine_code: 'GLU', loinc: '1558-6', internal_code: 'LAB-KIM-010.1', param_name: 'Glukosa Puasa' },
      { machine_code: 'CHOL', loinc: '2093-3', internal_code: 'LAB-KIM-021.1', param_name: 'Kolesterol Total' },
      { machine_code: 'AST', loinc: '1920-8', internal_code: 'LAB-KIM-030.1', param_name: 'SGOT / AST' },
      { machine_code: 'ALT', loinc: '1742-6', internal_code: 'LAB-KIM-031.1', param_name: 'SGPT / ALT' }
    ]
  },
  {
    id: 'ALAT-03',
    name: 'Cobas e411',
    type: 'Imunologi & Hormon',
    protocol: 'ASTM E1381/E1394',
    ip_host: '192.168.1.115',
    port: 9999,
    status: 'STANDBY',
    channel_mappings: [
      { machine_code: 'HBsAg', loinc: '5196-1', internal_code: 'LAB-IMU-001.1', param_name: 'HBsAg Kualitatif' },
      { machine_code: 'TSH', loinc: '3016-3', internal_code: 'LAB-IMU-010.1', param_name: 'TSH Sensitif' }
    ]
  }
];

/**
 * Parsing ASTM Record Stream (Result Frame R|)
 */
function parseAstmResultFrame(rawFrame) {
  if (!rawFrame || typeof rawFrame !== 'string') {
    return { success: false, results: [] };
  }

  const lines = rawFrame.split(/[\r\n]+/).filter(l => l.trim().length > 0);
  const parsedResults = [];
  let currentAccession = 'UNKNOWN';

  lines.forEach(line => {
    // Record Order (O|1|ACCESSION_NO|...)
    if (line.startsWith('O|') || line.startsWith('O^')) {
      const parts = line.split('|');
      currentAccession = parts[2] || parts[3] || 'UNKNOWN';
    }

    // Record Result (R|1|^^^MACHINE_CODE|VALUE|UNITS|REFRANGE|FLAG|...)
    if (line.startsWith('R|') || line.startsWith('R^')) {
      const parts = line.split('|');
      const testPart = parts[2] || '';
      const testCode = testPart.replace(/\^/g, ' ').trim().split(' ').pop();
      const value = parseFloat(parts[3]) || parts[3];
      const units = parts[4] || '';
      const flag = parts[6] || 'N';

      parsedResults.push({
        accession_no: currentAccession,
        machine_test_code: testCode,
        value,
        units,
        flag: flag === 'H' ? 'HIGH' : flag === 'L' ? 'LOW' : 'NORMAL'
      });
    }
  });

  return {
    success: parsedResults.length > 0,
    accession_no: currentAccession,
    results: parsedResults
  };
}

async function renderAnalyzerInterfacing() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#0ea5e9; margin-bottom:6px;">
            🔌 PROTOKOL ASTM E1381/E1394 &bull; LIVE ANALYZER BRIDGE (PORT :9999)
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Master Alat &amp; Interfacing Laboratorium
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Koneksi bi-directional antara mesin analyzer otomatis (Sysmex, Mindray, Cobas) dengan LIS.
          </p>
        </div>
        <button class="btn btn-teal" onclick="renderAnalyzerInterfacing()">↻ Test Socket Connection</button>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-top:16px;">
        ${ANALYZER_DRIVERS.map(a => `
          <div class="card" style="padding:18px; border-left:4px solid ${a.status === 'ONLINE' ? '#10b981' : '#f59e0b'};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <b style="font-size:15px; color:var(--text);">${a.name}</b>
              <span class="badge ${a.status === 'ONLINE' ? 'badge-success' : 'badge-warning'}">${a.status}</span>
            </div>
            <div style="font-size:12px; color:var(--text3); margin-bottom:12px;">
              Tipe: ${a.type}<br/>
              Protokol: <code style="color:var(--sky);">${a.protocol}</code> &bull; IP: <code style="color:var(--text);">${a.ip_host}:${a.port}</code>
            </div>
            <div style="background:var(--bg2); padding:10px; border-radius:8px; font-size:11.5px;">
              <b style="color:var(--text); display:block; margin-bottom:4px;">Channel Mappings (${a.channel_mappings.length} Param):</b>
              ${a.channel_mappings.map(c => `
                <div style="display:flex; justify-content:space-between; padding:2px 0;">
                  <span style="font-family:monospace; color:var(--sky);">${c.machine_code} &rarr; ${c.param_name}</span>
                  <span style="color:var(--text3); font-size:10.5px;">LOINC: ${c.loinc}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderAnalyzerInterfacing = renderAnalyzerInterfacing;
  window.parseAstmResultFrame = parseAstmResultFrame;
  window.ANALYZER_DRIVERS = ANALYZER_DRIVERS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderAnalyzerInterfacing,
    parseAstmResultFrame,
    ANALYZER_DRIVERS
  };
}
