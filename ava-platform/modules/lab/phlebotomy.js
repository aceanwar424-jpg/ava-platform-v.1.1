// ═══════════════════════════════════════════════════════════════
// MODULE: FLEBOTOMI & CHECKLIST SAMPLING (ISO 15189:2022 Klausul 7.2.4 & 7.2.5)
// Pencatatan waktu pengambilan darah, verifikasi tabung & identitas pasien
// ═══════════════════════════════════════════════════════════════

const PHLEBOTOMY_TUBES = {
  EDTA: { name: 'EDTA K2/K3 (Ungu)', volume_ml: 3.0, department: 'Hematologi', inversions: 8 },
  CLOT_SERUM: { name: 'Serum Clot Activator / Gel (Kuning/Merah)', volume_ml: 5.0, department: 'Kimia & Imunologi', inversions: 5 },
  CITRATE: { name: 'Sodium Citrate 3.2% (Biru)', volume_ml: 2.7, department: 'Koagulasi', inversions: 4 },
  HEPARIN: { name: 'Lithium Heparin (Hijau)', volume_ml: 4.0, department: 'Gas Darah / Elektrolit', inversions: 8 },
  FLUORIDE: { name: 'Sodium Fluoride / NaF (Abu-abu)', volume_ml: 2.0, department: 'Glukosa Puasa', inversions: 8 }
};

let phlebotomyQueue = [
  {
    accession_no: 'L260830-0001',
    patient_name: 'Tn. Budi Setiawan',
    ava_id: 'AVA-7K3M2P9QX4',
    fasting_status: 'Puasa 10 Jam (Sejak 22:00)',
    sampling_site: 'Vena Mediana Cubiti Dextra',
    tubes_required: ['EDTA', 'CLOT_SERUM'],
    status: 'Selesai Sampling',
    sampled_at: '2026-08-30 08:15',
    officer: 'Siti Rahma, A.Md.AK'
  },
  {
    accession_no: 'L260830-0002',
    patient_name: 'Ny. Ratna Dewi',
    ava_id: 'AVA-9M2K8P4TY1',
    fasting_status: 'Tidak Puasa',
    sampling_site: 'Vena Cephalica Sinistra',
    tubes_required: ['EDTA', 'CLOT_SERUM', 'CITRATE'],
    status: 'Menunggu Sampling',
    sampled_at: null,
    officer: '-'
  }
];

/**
 * Catat proses flebotomi selesai
 */
function recordPhlebotomySampling(accessionNo, details = {}) {
  const item = phlebotomyQueue.find(q => q.accession_no === accessionNo);
  if (!item) throw new Error(`Antrean flebotomi dengan Accession ${accessionNo} tidak ditemukan.`);

  const timestamp = details.sampled_at || new Date().toISOString().slice(0, 16).replace('T', ' ');
  item.status = 'Selesai Sampling';
  item.sampled_at = timestamp;
  item.officer = details.officer || 'Petugas Flebotomis';
  item.sampling_site = details.sampling_site || 'Vena Mediana Cubiti';
  item.tubes_collected = details.tubes_collected || item.tubes_required;
  item.notes = details.notes || 'Flebotomi lancar, tidak ada hematoma.';

  return {
    success: true,
    accession_no: accessionNo,
    sampled_at: item.sampled_at,
    status: item.status,
    message: `Sampling pasien ${item.patient_name} (${accessionNo}) berhasil dicatat.`
  };
}

async function renderPhlebotomy() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#ef4444; margin-bottom:6px;">
            🩸 ISO 15189:2022 KLAUSUL 7.2.4 &bull; PRA-ANALITIK
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Flebotomi &amp; Checklist Sampling Pasien
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Pencatatan waktu tusukan vena, checklist tabung darah (EDTA/Serum/Citrate), dan identitas flebotomis.
          </p>
        </div>
        <button class="btn btn-teal" onclick="renderPhlebotomy()">↻ Refresh Antrean</button>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Antrean Sampling Meja Flebotomi</h3>
        <table class="table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg2);">
              <th>No. Accession</th>
              <th>Nama Pasien (AVA-ID)</th>
              <th>Status Puasa</th>
              <th>Tabung Dibutuhkan</th>
              <th>Waktu Sampling</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${phlebotomyQueue.map(q => `
              <tr>
                <td style="font-family:monospace; font-weight:700; color:var(--sky);">${q.accession_no}</td>
                <td><b>${q.patient_name}</b><div style="font-size:11px; color:var(--text3); font-family:monospace;">${q.ava_id}</div></td>
                <td>${q.fasting_status}</td>
                <td>${q.tubes_required.map(t => `<span class="badge" style="background:#334155; color:#f8fafc; font-size:10px; margin-right:4px;">${t}</span>`).join('')}</td>
                <td style="font-family:monospace;">${q.sampled_at || '-'}</td>
                <td><span class="badge ${q.status === 'Selesai Sampling' ? 'badge-success' : 'badge-warning'}">${q.status}</span></td>
                <td>
                  ${q.status === 'Menunggu Sampling' ? `
                    <button class="btn btn-teal btn-xs" onclick="recordPhlebotomySampling('${q.accession_no}'); renderPhlebotomy();">
                      ✓ Konfirmasi Selesai
                    </button>
                  ` : `<span style="color:#10b981; font-weight:700; font-size:11px;">✓ Di Meja Analis</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderPhlebotomy = renderPhlebotomy;
  window.recordPhlebotomySampling = recordPhlebotomySampling;
  window.PHLEBOTOMY_TUBES = PHLEBOTOMY_TUBES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPhlebotomy,
    recordPhlebotomySampling,
    PHLEBOTOMY_TUBES
  };
}
