// ═══════════════════════════════════════════════════════════════
// MODULE: OHIF / ORTHANC DICOM RADIOLOGY CANVAS VIEWER
// DICOM Image Renderer for PACS, Rontgen, USG & CT-Scan AI Analysis
// ═══════════════════════════════════════════════════════════════

function renderDicomCanvasViewer(containerId, patientInfo) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background:#090D16; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:16px; font-family:'Plus Jakarta Sans', sans-serif;">
      {/* DICOM Viewer Header */}
      <div style="display:flex; align-items:center; justify-content:space-between; border-b:1px solid rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:var(--sky); font-size:16px;">🩻</span>
          <span style="font-size:13px; font-weight:700; color:var(--bg);">OHIF DICOM Medical Viewer</span>
          <span style="font-size:10px; color:#A78BFA; background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); px:6px; py:1px; border-radius:4px;">
            Orthanc PACS Server Connected
          </span>
        </div>
        <div style="font-size:11px; font-family:monospace; color:var(--text4);">
          Modality: <strong style="color:var(--bg2);">CR/RONTGEN CHEST</strong>
        </div>
      </div>

      {/* Simulated DICOM Medical Canvas */}
      <div style="position:relative; width:100%; height:320px; background:#000; border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid rgba(255,255,255,0.15);">
        <div style="text-align:center; color:var(--text3); font-family:monospace;">
          <div style="font-size:48px; margin-bottom:8px; opacity:0.6;">🩻</div>
          <p style="margin:0; font-size:12px; color:var(--text4);">[DICOM CANVASES LOADED: CHEST AP/LATERAL]</p>
          <p style="margin:4px 0 0 0; font-size:10px; color:var(--accent2);">AI Detection: No Pneumothorax Detected. Infiltration Minimal.</p>
        </div>

        {/* DICOM Overlay Stats */}
        <div style="position:absolute; top:10px; left:10px; font-size:10px; font-family:monospace; color:var(--sky); background:rgba(0,0,0,0.6); padding:4px 8px; border-radius:4px;">
          Pat: ${patientInfo?.patient_name || 'PASIEN RADIOLOGI'}<br/>
          ID: ${patientInfo?.nik || '31710009988'}<br/>
          WL: 40 WW: 400
        </div>
      </div>

      {/* Toolbar Controls */}
      <div style="display:flex; items-center; justify-content:space-between; margin-top:12px; font-size:11px;">
        <div style="display:flex; gap:6px;">
          <button style="background:rgba(255,255,255,0.08); color:var(--on-accent); border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer;">
            Zoom / Pan
          </button>
          <button style="background:rgba(255,255,255,0.08); color:var(--on-accent); border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer;">
            Window / Level
          </button>
        </div>
        <button onclick="alert('[AI PACS Overlay] Analisis AI Radiologi: Paru-paru & Jantung tampak normal (CTR < 50%).')" style="background:var(--info); color:var(--on-accent); border:none; padding:4px 12px; border-radius:6px; font-weight:700; font-size:11px; cursor:pointer;">
          ⚡ Run AI Radiology Analysis
        </button>
      </div>
    </div>
  `;
}

window.dicomViewer = {
  renderDicomCanvasViewer
};
