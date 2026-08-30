// ═══════════════════════════════════════════════════════════════
// MODULE: AGENTIC AI 2026 — MCP (MODEL CONTEXT PROTOCOL) CONSOLE
// Model-to-Tool Protocol (Agent-to-Tool Context Standard)
// ═══════════════════════════════════════════════════════════════

const AG_MCP_TOOLS = [
  {
    id: 'mcp_fhir_satusehat',
    name: 'fhir_kemenkes_converter',
    server: 'satusehat-mcp-server',
    category: 'INTEROPERABILITY',
    description: 'Konverter HL7 FHIR v4 untuk sinkronisasi otomatis data lab & pasien ke portal SATUSEHAT Kemenkes RI.',
    status: 'CONNECTED',
    latencyMs: 2,
    schema: { resourceType: 'Patient|Observation', targetId: 'string' }
  },
  {
    id: 'mcp_langcare_privacy',
    name: 'langcare_privacy_gateway',
    server: 'security-mcp-server',
    category: 'PRIVACY_COMPLIANCE',
    description: 'De-identification Gateway untuk anonimisasi data PII pasien (NIK, Nama, HP) sebelum LLM inference.',
    status: 'CONNECTED',
    latencyMs: 1,
    schema: { patient_data: 'object', level: 'ISO27001_HIPAA' }
  },
  {
    id: 'mcp_westgard_qc',
    name: 'bika_westgard_qc_evaluator',
    server: 'iso15189-mcp-server',
    category: 'CLINICAL_LAB',
    description: 'Evaluasi otomatis aturan Westgard QC (1-2s, 1-3s, 2-2s, R-4s, 10x) untuk kontrol mutu laboratorium ISO 15189.',
    status: 'CONNECTED',
    latencyMs: 2,
    schema: { val: 'number', mean: 'number', sd: 'number' }
  },
  {
    id: 'mcp_ohif_dicom',
    name: 'ohif_orthanc_dicom_server',
    server: 'pacs-imaging-mcp-server',
    category: 'RADIOLOGY',
    description: 'Integrasi DICOM PACS Server untuk pengolahan gambar Rontgen, USG, CT-Scan & deteksi kelainan AI.',
    status: 'CONNECTED',
    latencyMs: 6,
    schema: { studyInstanceUid: 'string', modality: 'CR|US|CT' }
  },
  {
    id: 'mcp_sqlite_query',
    name: 'sqlite_query_tool',
    server: 'local-db-mcp-server',
    category: 'DATABASE',
    description: 'Menjalankan query SQL ke database SQLite dev.db secara aman.',
    status: 'CONNECTED',
    latencyMs: 1,
    schema: { query: 'string', limit: 'number' }
  },
  {
    id: 'mcp_lab_autoverify',
    name: 'lab_autoverification_engine',
    server: 'lis-clinical-mcp-server',
    category: 'CLINICAL_LAB',
    description: 'Verifikasi otomatis hasil tes laboratorium berdasarkan rentang rujukan ISO 15189 & aturan delta check.',
    status: 'CONNECTED',
    latencyMs: 3,
    schema: { sample_id: 'string', test_code: 'string', result_value: 'number' }
  },
  {
    id: 'mcp_critical_alert',
    name: 'critical_value_notifier',
    server: 'clinical-safety-mcp-server',
    category: 'CLINICAL_LAB',
    description: 'Memicu notifikasi nilai kritis (Critical Value Alert) ke dokter & nakes penanggung jawab.',
    status: 'CONNECTED',
    latencyMs: 5,
    schema: { patient_id: 'string', critical_parameter: 'string', val: 'number' }
  },
  {
    id: 'mcp_pharmacy_reorder',
    name: 'pharmacy_stock_reorder',
    server: 'supply-chain-mcp-server',
    category: 'SUPPLY_CHAIN',
    description: 'Prediksi kebutuhan reagen/obat & buat draft Purchase Order otomatis jika stok di bawah minimum.',
    status: 'CONNECTED',
    latencyMs: 4,
    schema: { drug_id: 'string', min_stock: 'number', projected_days: 'number' }
  }
];

function renderAgMcpTab() {
  const container = document.getElementById('ag-tab-content');
  if (!container) return;

  let html = `
    <div className="ag-mcp-panel" style="padding:20px; display:flex; flex-direction:column; gap:20px;">
      {/* Header Banner */}
      <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(139,92,246,0.3); border-radius:14px; padding:18px; backdrop-filter:blur(10px);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); padding:10px; border-radius:12px; color:#A78BFA;">
              🔌
            </div>
            <div>
              <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--bg);">MCP Console — Model Context Protocol 2026</h3>
              <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Standar terintegrasi untuk menghubungkan Agentic AI ke HL7 FHIR (SATUSEHAT), LangCare Privacy, Bika Westgard QC, OHIF DICOM PACS, & SQLite DB.</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:rgba(16,185,129,0.15); color:var(--accent2); border:1px solid rgba(16,185,129,0.3); font-size:11px; padding:4px 10px; border-radius:999px; font-weight:600;">
              ● 8 MCP Connectors Active
            </span>
          </div>
        </div>
      </div>

      {/* Grid of MCP Tools */}
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
  `;

  AG_MCP_TOOLS.forEach(tool => {
    html += `
      <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <span style="font-family:monospace; font-size:12px; font-weight:700; color:var(--sky); background:rgba(56,189,248,0.1); padding:2px 8px; border-radius:6px; border:1px solid rgba(56,189,248,0.2);">
              ${tool.name}
            </span>
            <span style="font-size:10px; color:var(--accent2); font-mono">
              ⚡ ${tool.latencyMs}ms
            </span>
          </div>
          <p style="margin:0 0 10px 0; font-size:12px; color:var(--border2); line-height:1.4;">${tool.description}</p>
          <div style="font-size:11px; color:var(--text3); background:rgba(15,23,42,0.6); padding:8px; border-radius:6px; font-family:monospace;">
            Server: <span style="color:#A78BFA;">${tool.server}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.06); pt:10px; font-size:11px;">
          <span style="color:var(--text4);">Kategori: <strong style="color:var(--bg2);">${tool.category}</strong></span>
          <button onclick="testMcpTool('${tool.id}')" style="background:var(--info); color:var(--on-accent); border:none; padding:4px 10px; border-radius:6px; font-weight:600; cursor:pointer; font-size:11px;">
            Test Run Tool
          </button>
        </div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function testMcpTool(toolId) {
  const tool = AG_MCP_TOOLS.find(t => t.id === toolId);
  if (!tool) return;

  if (toolId === 'mcp_fhir_satusehat' && window.fhirConverter) {
    // Data CONTOH, bukan pasien sungguhan — dan ditulis apa adanya di layar
    // supaya tidak ada yang mengira ini hasil konversi rekam medis nyata.
    // NIK-nya sengaja memakai blok 0000-0000 yang tidak diterbitkan.
    const contoh = {
      nik: '0000000000000000', patient_name: '(CONTOH) Ahmad Pratama',
      birth_date: '1985-03-12', gender: 'L', phone: '',
    };
    try {
      const fhirPat = window.fhirConverter.convertToFhirPatient(contoh);
      alert('[MCP — HL7 FHIR SATUSEHAT]\nResource: Patient\n\n' +
            'DATA CONTOH, bukan pasien nyata.\n\n' + JSON.stringify(fhirPat, null, 2));
    } catch (e) {
      // Converter menolak data yang tidak lengkap. Kalau contoh di atas pun
      // ditolak, berarti syaratnya berubah dan contohnya yang harus diperbarui.
      alert('[MCP — HL7 FHIR SATUSEHAT]\nKonversi contoh DITOLAK converter:\n\n' + e.message);
    }
    return;
  }

  if (toolId === 'mcp_langcare_privacy' && window.privacyGateway) {
    const masked = window.privacyGateway.anonymizePatientData({ nik: '3171234567890001', patient_name: 'Siti Aminah', phone: '08123456789' });
    alert(`[MCP Executed - LangCare De-identification]\nISO 27001 Masked Result:\n${JSON.stringify(masked, null, 2)}`);
    return;
  }

  if (toolId === 'mcp_westgard_qc' && window.westgardQcEngine) {
    const qcRes = window.westgardQcEngine.evaluateWestgardRules(14.8, 12.0, 0.8);
    alert(`[MCP Executed - Westgard QC ISO 15189]\nRule: ${qcRes.triggeredRule}\nStatus: ${qcRes.status}\nRecommendation:\n${qcRes.recommendation}`);
    return;
  }

  // Alat ini BELUM tersambung ke apa pun. Sebelumnya baris ini menampilkan
  // "Executed Successfully … Status: 200 OK" beserta angka latensi — ketiganya
  // karangan, untuk pemanggilan yang tidak pernah terjadi. Layar yang
  // melaporkan sukses palsu membuat orang berhenti memeriksa.
  alert(`[MCP — ${tool.name}]\nServer: ${tool.server}\n\n` +
        'Alat ini belum tersambung. Tombol ini hanya menampilkan keterangannya, ' +
        'tidak memanggil apa pun.');
}

window.renderAgMcpTab = renderAgMcpTab;
window.testMcpTool = testMcpTool;
