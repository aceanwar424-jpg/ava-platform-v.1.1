// ═══════════════════════════════════════════════════════════════════════════
// MODULE: PACS & DICOM Medical Imaging Viewer Lite — AVA GLOBAL
// ---------------------------------------------------------------------------
// Fitur:
// - Viewer Citra Digital USG Obgyn, Rontgen Thorax, & Mammografi
// - Tool Pengukuran Caliper Jarak & Pengaturan Kontras / Windowing
// - Eksport Ekspertise Radiologi Terintegrasi Rekam Medis Pasien
// ═══════════════════════════════════════════════════════════════════════════

let PACS_STATE = {
  studies: [
    {
      id: 'STUDY-2026-041',
      pasien: 'Ny. Siska Melani (RM-0041)',
      modality: 'USG',
      organ: 'Pelvic & Uterus (Transvaginal)',
      tgl: '2026-08-19 10:45',
      dokter: 'dr. Siti Rahma, Sp.OG',
      kesan: 'Tampak gambaran polycystic appearance pada ovarium bilateral (>12 folikel perifer, volume >10cc). Endometrium tebal 8.2mm regular.',
      status: 'Expertise Selesai'
    },
    {
      id: 'STUDY-2026-042',
      pasien: 'Bpk. Hendra Gunawan (RM-0048)',
      modality: 'CR (X-Ray)',
      organ: 'Thorax AP/PA',
      tgl: '2026-08-18 14:20',
      dokter: 'dr. Spesialis Radiologi, Sp.Rad',
      kesan: 'Cor: CTR < 50%, bentuk normal. Pulmo: corakan bronkovaskular normal, tidak tampak infiltrat/nodul aktif. Sinus costophrenicus lancip.',
      status: 'Expertise Selesai'
    }
  ],
  selectedStudy: null
};

async function renderPacsViewer(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  if (!PACS_STATE.selectedStudy) {
    PACS_STATE.selectedStudy = PACS_STATE.studies[0];
  }

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1>🖼️ PACS &amp; DICOM Medical Imaging Viewer</h1>
        <p>Visualisasi citra digital USG kandungan, radiologi digital &amp; expertise dokter spesialis</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderPacsViewer()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="toast('Modality Worklist DICOM terhubung ke mesin USG &amp; CR', 'ok')">📡 Worklist DICOM</button>
      </div>
    </div>

    <div class="grid-2" style="grid-template-columns: 320px 1fr; gap: 20px; align-items: start;">
      <!-- Daftar Pemeriksaan Imaging -->
      <div class="card" style="padding:16px;">
        <div class="card-title" style="margin-bottom:12px;">Daftar Studi Citra Pasien</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${PACS_STATE.studies.map(s => `
            <div onclick="pilihStudyPacs('${s.id}')" style="background:${s.id === PACS_STATE.selectedStudy.id ? 'rgba(0,210,180,0.1)' : 'var(--bg2)'};border:1px solid ${s.id === PACS_STATE.selectedStudy.id ? 'var(--teal)' : 'rgba(255,255,255,0.06)'};border-radius:10px;padding:12px;cursor:pointer;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <b>${s.pasien}</b>
                <span class="badge badge-teal" style="font-size:10px;">${s.modality}</span>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-top:4px;">
                ${s.organ}<br>
                <span style="font-size:11px;">${s.tgl}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- PACS Viewer Workspace -->
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div class="card" style="background:#000;border:1px solid #334155;border-radius:14px;padding:20px;text-align:center;min-height:360px;display:flex;flex-direction:column;justify-content:center;align-items:center;">
          <!-- Simulated Medical Scan Canvas -->
          <div style="width:100%;max-width:480px;height:260px;background:radial-gradient(circle at center, #1e293b 0%, #050811 85%);border:1px solid #475569;border-radius:8px;position:relative;display:flex;justify-content:center;align-items:center;box-shadow:inset 0 0 40px rgba(0,0,0,0.9);">
            <!-- Mock Overlay Info -->
            <div style="position:absolute;top:10px;left:12px;text-align:left;font-family:monospace;font-size:11px;color:var(--teal);">
              AVA HEALTH IMAGING<br>
              ${PACS_STATE.selectedStudy.pasien}<br>
              ${PACS_STATE.selectedStudy.modality} - ${PACS_STATE.selectedStudy.organ}
            </div>
            <div style="position:absolute;top:10px;right:12px;text-align:right;font-family:monospace;font-size:11px;color:var(--accent);">
              FPS: 30<br>
              GAIN: 64dB<br>
              DEPTH: 14cm
            </div>
            <!-- Center Icon -->
            <div style="font-size:64px;opacity:0.8;">🩻</div>
            <div style="position:absolute;bottom:10px;left:12px;font-family:monospace;font-size:11px;color:#94a3b8;">
              W: 256 L: 128 | CALIPER: 24.5 mm
            </div>
          </div>

          <!-- Viewer Toolbar -->
          <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;justify-content:center;">
            <button class="btn btn-sm btn-ghost" onclick="toast('Zoom & Pan diaktifkan', 'info')">🔍 Zoom / Pan</button>
            <button class="btn btn-sm btn-ghost" onclick="toast('Contrast Windowing disesuaikan', 'info')">☀️ Kontras / Window</button>
            <button class="btn btn-sm btn-ghost" onclick="toast('Caliper pengukur diameter ovarium aktif: 24.5mm', 'ok')">📏 Caliper Ukur Jarak</button>
            <button class="btn btn-sm btn-ghost" onclick="toast('Citra di-invert (hitam/putih)', 'info')">🔄 Invert LUT</button>
          </div>
        </div>

        <!-- Expertise Radiologi / Obgyn Card -->
        <div class="card">
          <div class="card-title" style="margin-bottom:10px;">🩺 Lembar Kesan Klinis &amp; Expertise Dokter</div>
          <p style="font-size:12px;color:var(--text3);margin-bottom:10px;">Dokter Pemeriksa: <b>${PACS_STATE.selectedStudy.dokter}</b></p>
          <div style="background:var(--bg2);padding:14px;border-radius:8px;font-size:13.5px;line-height:1.6;color:var(--text2);border-left:3px solid var(--teal);">
            ${PACS_STATE.selectedStudy.kesan}
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:14px;gap:10px;">
            <button class="btn btn-ghost" onclick="toast('Hasil citra terlampir otomatis ke EMR SOAP pasien', 'ok')">📎 Tautkan ke Rekam Medis</button>
            <button class="btn btn-teal" onclick="toast('Hasil USG & expertise dicetak sebagai PDF standar Kemenkes', 'ok')">🖨️ Cetak Lembar Hasil</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function pilihStudyPacs(id) {
  const s = PACS_STATE.studies.find(x => x.id === id);
  if (s) {
    PACS_STATE.selectedStudy = s;
    renderPacsViewer();
  }
}

window.renderPacsViewer = renderPacsViewer;
window.pilihStudyPacs = pilihStudyPacs;
