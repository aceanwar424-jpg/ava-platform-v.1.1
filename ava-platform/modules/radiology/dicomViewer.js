// ═══════════════════════════════════════════════════════════════
// MODULE: PACS DICOM MEDICAL VIEWER & CTR MEASUREMENT ENGINE
// Standar Citra Medis DICOM PS3.x (Rontgen Chest, CT-Scan, USG)
// ═══════════════════════════════════════════════════════════════

const DICOM_PRESETS = {
  SOFT_TISSUE: { name: 'Chest / Jaringan Lunak', wl: 40, ww: 400 },
  BONE: { name: 'Tulang / Bone Structure', wl: 300, ww: 1500 },
  LUNG: { name: 'Paru-paru / Lung Window', wl: -600, ww: 1500 },
  BRAIN: { name: 'Kepala / Brain Window', wl: 40, ww: 80 }
};

/**
 * Kalkulasi Rasio Jantung-Toraks (Cardio-Thoracic Ratio / CTR)
 * @param {number} cardiacDiameterMm - Diameter transversal jantung (A + B dalam mm)
 * @param {number} thoracicDiameterMm - Diameter transversal rongga toraks (C dalam mm)
 */
function calculateCTR(cardiacDiameterMm, thoracicDiameterMm) {
  if (!thoracicDiameterMm || thoracicDiameterMm <= 0) {
    return { ctrPct: 0, status: 'INVALID', interpretation: 'Diameter toraks harus > 0' };
  }

  const ctr = (cardiacDiameterMm / thoracicDiameterMm) * 100;
  const roundedCTR = parseFloat(ctr.toFixed(1));

  let status = 'NORMAL';
  let interpretation = 'Jantung dalam batas normal (CTR ≤ 50%). Tidak ada kardiomegali.';

  if (roundedCTR > 55.0) {
    status = 'CARDIOMEGALY_SIGNIFICANT';
    interpretation = `⚠️ Kardiomegali Signifikan (CTR ${roundedCTR}% > 55%). Rekomendasi konsultasi spesialis Jantung/Kardiologi.`;
  } else if (roundedCTR > 50.0) {
    status = 'CARDIOMEGALY_BORDERLINE';
    interpretation = `⚡ Kardiomegali Ringan (CTR ${roundedCTR}% > 50%). Pantau faktor risiko hipertensi.`;
  }

  return {
    cardiacDiameterMm,
    thoracicDiameterMm,
    ctrPct: roundedCTR,
    status,
    interpretation
  };
}

// Keadaan tampilan viewer. Preset yang dipilih benar-benar mengubah tampilan
// dan label WL/WW, bukan sekadar memunculkan kotak pesan berisi angkanya.
const DICOM_STATE = { preset: 'SOFT_TISSUE', invert: false };

function terapkanPreset(kunci) {
  const p = DICOM_PRESETS[kunci];
  if (!p) return;
  DICOM_STATE.preset = kunci;

  const label = document.getElementById('dicom-preset-label');
  if (label) label.textContent = `${p.name} (WL ${p.wl} / WW ${p.ww})`;

  // Perkiraan tampilan, bukan windowing DICOM sesungguhnya: tanpa piksel
  // 16-bit dari berkas DICOM, kontras hanya bisa didekati. Label di bawah
  // viewport menyatakan itu apa adanya supaya tidak dikira hasil rekonstruksi.
  const vp = document.getElementById('dicom-viewport');
  if (vp) {
    const kontras = Math.max(0.6, Math.min(2.4, 1200 / (p.ww || 400)));
    vp.style.filter = `contrast(${kontras.toFixed(2)}) ${DICOM_STATE.invert ? 'invert(1)' : ''}`;
  }
  document.querySelectorAll('[data-preset]').forEach(b => {
    b.style.background = b.getAttribute('data-preset') === kunci ? 'rgba(56,189,248,.22)' : 'transparent';
  });
}

function balikCitra() {
  DICOM_STATE.invert = !DICOM_STATE.invert;
  terapkanPreset(DICOM_STATE.preset);
}

// Pengukuran CTR memakai angka yang DIMASUKKAN pemeriksa, bukan angka yang
// sudah tertulis di kode. Sebelumnya tombol ini selalu melaporkan "CTR 46,2%
// normal" untuk citra apa pun — sebuah bacaan klinis yang tidak pernah
// benar-benar diukur, pada layar yang dipakai mengambil keputusan medis.
function ukurCTR() {
  const jantung = parseFloat(prompt('Diameter transversal jantung (mm):', ''));
  if (!isFinite(jantung) || jantung <= 0) return;
  const toraks = parseFloat(prompt('Diameter transversal rongga toraks (mm):', ''));
  if (!isFinite(toraks) || toraks <= 0) return;

  const h = calculateCTR(jantung, toraks);
  const kotak = document.getElementById('dicom-ctr-hasil');
  if (!kotak) return;

  const warna = h.status === 'NORMAL' ? '#22c55e'
              : h.status === 'CARDIOMEGALY_BORDERLINE' ? '#f59e0b' : '#ef4444';
  kotak.style.display = 'block';
  kotak.innerHTML = `
    <div style="color:${warna};font-weight:800;font-size:12px">
      CTR ${h.ctrPct}% &mdash; ${h.status.replace(/_/g, ' ')}</div>
    <div style="color:#94a3b8;font-size:10.5px;margin-top:3px;line-height:1.5">
      Jantung ${h.cardiacDiameterMm} mm / Toraks ${h.thoracicDiameterMm} mm.
      ${h.interpretation}</div>
    <div style="color:#64748b;font-size:10px;margin-top:5px;font-style:italic">
      Hasil hitung dari angka yang Anda masukkan. Interpretasi akhir tetap
      kewenangan dokter spesialis radiologi.</div>`;
}

function renderDicomCanvasViewer(containerId, patientInfo) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background:#090D16; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:16px; font-family:'Plus Jakarta Sans', sans-serif;">
      <!-- DICOM Viewer Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:#38bdf8; font-size:16px;">🩻</span>
          <span style="font-size:13px; font-weight:700; color:#fff;">AVA PACS DICOM Medical Viewer</span>
          <span style="font-size:10px; color:#94a3b8; background:rgba(148,163,184,0.12); border:1px solid rgba(148,163,184,0.3); padding:2px 6px; border-radius:4px;">
            Sumber PACS belum tersambung
          </span>
        </div>
        <div style="font-size:11px; font-family:monospace; color:#94a3b8;">
          Modality: <strong style="color:#f8fafc;">CR / CHEST AP</strong>
        </div>
      </div>

      <!-- Simulated DICOM Medical Canvas -->
      <div id="dicom-viewport" style="position:relative; width:100%; height:320px; background:#000; border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid rgba(255,255,255,0.15);">
        <div style="text-align:center; color:#64748b; font-family:monospace;">
          <div style="font-size:48px; margin-bottom:8px; opacity:0.55;">🩻</div>
          <p style="margin:0; font-size:12px; color:#94a3b8;">Belum ada citra dimuat</p>
          <p style="margin:4px 0 0; font-size:10px; color:#64748b; max-width:340px; line-height:1.5;">
            Sambungkan sumber DICOM (Orthanc / modality worklist) untuk menampilkan
            citra pasien di sini.</p>
        </div>

        <!-- DICOM Overlay Stats -->
        <div style="position:absolute; top:10px; left:10px; font-size:10px; font-family:monospace; color:#38bdf8; background:rgba(0,0,0,0.65); padding:4px 8px; border-radius:4px; line-height:1.4;">
          Pasien: ${patientInfo?.patient_name || '—'}<br/>
          AVA-ID: ${patientInfo?.ava_id || '—'}<br/>
          Preset: <span id="dicom-preset-label">Chest / Jaringan Lunak (WL 40 / WW 400)</span>
        </div>
      </div>

      <!-- Toolbar Controls -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px; font-size:11px; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-xs" data-preset="BONE"
            style="color:#fff; border-color:rgba(255,255,255,0.2)"
            onclick="dicomViewer.terapkanPreset('BONE')">🦴 Bone</button>
          <button class="btn btn-ghost btn-xs" data-preset="LUNG"
            style="color:#fff; border-color:rgba(255,255,255,0.2)"
            onclick="dicomViewer.terapkanPreset('LUNG')">🫁 Lung</button>
          <button class="btn btn-ghost btn-xs" data-preset="SOFT_TISSUE"
            style="color:#fff; border-color:rgba(255,255,255,0.2)"
            onclick="dicomViewer.terapkanPreset('SOFT_TISSUE')">🫀 Soft Tissue</button>
          <button class="btn btn-ghost btn-xs" data-preset="BRAIN"
            style="color:#fff; border-color:rgba(255,255,255,0.2)"
            onclick="dicomViewer.terapkanPreset('BRAIN')">🧠 Brain</button>
          <button class="btn btn-ghost btn-xs"
            style="color:#fff; border-color:rgba(255,255,255,0.2)"
            onclick="dicomViewer.balikCitra()">🔄 Invert</button>
        </div>
        <button onclick="dicomViewer.ukurCTR()"
          style="background:#0284c7; color:#fff; border:none; padding:5px 12px;
          border-radius:6px; font-weight:700; font-size:11px; cursor:pointer;">
          📏 Ukur CTR
        </button>
      </div>

      <div id="dicom-ctr-hasil" style="display:none; margin-top:10px; padding:10px 12px;
        background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
        border-radius:8px;"></div>

      <p style="margin:10px 0 0; font-size:10px; color:#64748b; line-height:1.5;">
        Preset di atas mengatur kontras tampilan sebagai pendekatan. Windowing DICOM
        sesungguhnya memerlukan piksel 16-bit dari berkas asli dan akan aktif setelah
        sumber PACS tersambung.
      </p>
    </div>
  `;

  terapkanPreset(DICOM_STATE.preset);
}

if (typeof window !== 'undefined') {
  window.dicomViewer = {
    DICOM_PRESETS,
    calculateCTR,
    renderDicomCanvasViewer,
    terapkanPreset,
    balikCitra,
    ukurCTR
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DICOM_PRESETS,
    calculateCTR,
    renderDicomCanvasViewer
  };
}
