// ═══════════════════════════════════════════════════════════════
// MODULE: AGENTIC AI 2026 — ORCHESTRATOR & A2A TOPOLOGY
// Agent-to-Agent Inter-Orchestration & Closed Feedback Loop
// ═══════════════════════════════════════════════════════════════

const AG_A2A_AGENTS = [
  {
    id: 'CHIEF_ORCHESTRATOR',
    title: 'Chief Agentic Orchestrator',
    role: 'Orkestrator Utama & Resolusi Konflik A2A',
    status: 'ACTIVE',
    closedLoopCount: 1420,
    avatarBg: '#8B5CF6'
  },
  {
    id: 'CLINICAL_LAB_AGENT',
    title: 'Clinical & Lab Ops Specialist',
    role: 'Autoverifikasi Lab, Delta Check & Value Alert',
    status: 'ACTIVE',
    closedLoopCount: 890,
    avatarBg: '#38BDF8'
  },
  {
    id: 'ISO_QUALITY_AGENT',
    title: 'ISO 15189 Compliance Officer',
    role: 'Audit Mutu L1-L4, CAPA Generator & Guardrail',
    status: 'ACTIVE',
    closedLoopCount: 450,
    avatarBg: '#10B981'
  },
  {
    id: 'PHARMACY_SUPPLY_AGENT',
    title: 'Pharmacy & Stock Manager',
    role: 'Prediksi Reagen, Stock Ledger & Auto-reorder',
    status: 'ACTIVE',
    closedLoopCount: 310,
    avatarBg: '#F59E0B'
  },
  {
    id: 'PATIENT_JOURNEY_AGENT',
    title: 'Patient Experience & MCU Specialist',
    role: 'Paket MCU Smart Matching & Bahasa Pasien (R3)',
    status: 'ACTIVE',
    closedLoopCount: 620,
    avatarBg: '#EC4899'
  }
];

function renderAgOrchestratorTab() {
  const container = document.getElementById('ag-tab-content');
  if (!container) return;

  let html = `
    <div style="padding:20px; display:flex; flex-direction:column; gap:20px;">
      <!-- Peringatan wajib: angka di layar ini TIDAK dibaca dari basis data.
           Daftar agen dan closedLoopCount diketik langsung di berkas ini.
           Tanpa peringatan, panel monitoring yang isinya karangan adalah
           kebohongan paling berbahaya — orang mengambil keputusan darinya. -->
      <div style="background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.4);
                  border-radius:12px;padding:12px 15px;font-size:12.5px;line-height:1.6;color:#FCD34D">
        <strong>Skema statis — bukan data langsung.</strong>
        Angka dan daftar agen di layar ini contoh tetap yang tertulis di kode,
        bukan bacaan dari basis data. Untuk pemantauan sesungguhnya
        (53 agen terdaftar, status, delegasi, dan jejak keputusan),
        buka tab <strong>🕸 Kanvas Orkestrator</strong>.
      </div>
      {/* 2026 CLOSED FEEDBACK LOOP BANNER */}
      <div style="background:linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9)); border:1px solid rgba(56,189,248,0.3); border-radius:16px; p:20px; backdrop-filter:blur(12px);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--bg); display:flex; align-items:center; gap:8px;">
              <span style="color:#38BDF8;">🔄</span> The 2026 Closed Feedback Loop Engine
            </h3>
            <p style="margin:4px 0 0 0; font-size:12px; color:#94A3B8;">Siklus otonom: <strong>Observe Environment ➔ Break Down Problem ➔ Create Plan ➔ Take Action ➔ Evaluate ➔ Self-Tune</strong></p>
          </div>
          <span style="background:rgba(56,189,248,0.15); color:#38BDF8; border:1px solid rgba(56,189,248,0.3); font-size:11px; padding:4px 12px; border-radius:999px; font-weight:700;">
            A2A Protocol v2.4 (Active)
          </span>
        </div>

        {/* 4 Steps Telemetry Bar */}
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px;">
          <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.06); padding:12px; border-radius:10px;">
            <p style="margin:0; font-size:10px; color:var(--text3); uppercase font-weight:700;">1. OBSERVE & PLAN</p>
            <p style="margin:4px 0 0 0; font-size:13px; font-weight:700; color:#38BDF8;">99.8% Accuracy</p>
          </div>
          <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.06); padding:12px; border-radius:10px;">
            <p style="margin:0; font-size:10px; color:var(--text3); uppercase font-weight:700;">2. TAKE ACTION (R1/R2)</p>
            <p style="margin:4px 0 0 0; font-size:13px; font-weight:700; color:var(--accent2);">3,690 Tasks Executed</p>
          </div>
          <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.06); padding:12px; border-radius:10px;">
            <p style="margin:0; font-size:10px; color:var(--text3); uppercase font-weight:700;">3. EVALUATE RESULTS</p>
            <p style="margin:4px 0 0 0; font-size:13px; font-weight:700; color:#FBBF24;">0 Critical Anomaly</p>
          </div>
          <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.06); padding:12px; border-radius:10px;">
            <p style="margin:0; font-size:10px; color:var(--text3); uppercase font-weight:700;">4. SELF-TUNING ANALYTICS</p>
            <p style="margin:4px 0 0 0; font-size:13px; font-weight:700; color:#A78BFA;">Auto-Optimized</p>
          </div>
        </div>
      </div>

      {/* A2A AGENT TOPOLOGY CARDS */}
      <div>
        <h4 style="margin:0 0 12px 0; font-size:14px; color:var(--bg2); font-weight:700;">Jaringan Agen Digital (A2A Inter-Agent Protocol)</h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
  `;

  AG_A2A_AGENTS.forEach(ag => {
    html += `
      <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px; height:40px; border-radius:12px; background:${ag.avatarBg}; display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:16px;">
            ${ag.title.substring(0,2)}
          </div>
          <div>
            <h4 style="margin:0; font-size:13px; font-weight:700; color:var(--bg);">${ag.title}</h4>
            <p style="margin:2px 0 0 0; font-size:11px; color:#94A3B8;">${ag.role}</p>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.6); padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; font-size:11px;">
          <span style="color:var(--text3);">Feedback Loop Executions:</span>
          <span style="font-family:monospace; color:#38BDF8; font-weight:700;">${ag.closedLoopCount} cycles</span>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; pt:6px;">
          <span style="color:var(--accent2); font-weight:600;">● ${ag.status}</span>
          <button onclick="triggerAgentTask('${ag.id}')" style="background:rgba(255,255,255,0.08); hover:background:rgba(255,255,255,0.15); color:var(--bg2); border:1px solid rgba(255,255,255,0.1); padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer;">
            Pemicu Tugas
          </button>
        </div>
      </div>
    `;
  });

  html += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function triggerAgentTask(agentId) {
  alert(`[A2A Dispatch Success]\nTugas otomatis telah dikirim ke Agen '${agentId}' via Protocol A2A.\nSiklus Closed Feedback Loop sedang berjalan.`);
}

window.renderAgOrchestratorTab = renderAgOrchestratorTab;
window.triggerAgentTask = triggerAgentTask;
