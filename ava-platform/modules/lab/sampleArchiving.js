// ═══════════════════════════════════════════════════════════════
// MODULE: MANAJEMEN ARSIP & RETENSI SPESIMEN (SAMPLE ARCHIVING)
// Standar ISO 15189:2022 Klausul 7.5 (Sample Retention & Disposal)
// ═══════════════════════════════════════════════════════════════

let sampleArchives = [
  {
    accession_no: 'L260830-0001',
    patient_name: 'Tn. Budi Setiawan',
    sample_type: 'Serum Sisa (0.8 mL)',
    freezer_id: 'FREEZER-A (-20°C)',
    rack_id: 'RACK-02',
    box_id: 'BOX-KIM-04',
    grid_position: 'C5',
    stored_at: '2026-08-30 11:30',
    retention_days: 7,
    dispose_due_date: '2026-09-06',
    status: 'STORED_ACTIVE'
  },
  {
    accession_no: 'L260830-0002',
    patient_name: 'Ny. Ratna Dewi',
    sample_type: 'Whole Blood EDTA (1.2 mL)',
    freezer_id: 'KULKAS-B (4°C)',
    rack_id: 'RACK-01',
    box_id: 'BOX-HEM-01',
    grid_position: 'A2',
    stored_at: '2026-08-30 10:45',
    retention_days: 3,
    dispose_due_date: '2026-09-02',
    status: 'STORED_ACTIVE'
  }
];

/**
 * Simpan arsip spesimen ke lokasi rak freezer
 */
function archiveSpecimen(accessionNo, archiveDetails = {}) {
  const {
    patient_name = 'Pasien',
    sample_type = 'Serum',
    freezer_id = 'FREEZER-A (-20°C)',
    rack_id = 'RACK-01',
    box_id = 'BOX-01',
    grid_position = 'A1',
    retention_days = 7
  } = archiveDetails;

  const now = new Date();
  const dueDate = new Date(now.getTime() + (retention_days * 86400000)).toISOString().slice(0, 10);

  const archiveEntry = {
    accession_no: accessionNo,
    patient_name,
    sample_type,
    freezer_id,
    rack_id,
    box_id,
    grid_position,
    stored_at: now.toISOString().slice(0, 16).replace('T', ' '),
    retention_days,
    dispose_due_date: dueDate,
    status: 'STORED_ACTIVE'
  };

  sampleArchives.unshift(archiveEntry);

  return {
    success: true,
    entry: archiveEntry,
    message: `Spesimen ${accessionNo} berhasil diarsipkan di ${freezer_id} [${rack_id} / ${box_id} Posisi ${grid_position}].`
  };
}

/**
 * Cari lokasi tabung spesimen untuk Add-on Test (Tes Susulan)
 */
function findArchivedSpecimen(accessionNo) {
  const item = sampleArchives.find(s => s.accession_no === accessionNo && s.status === 'STORED_ACTIVE');
  if (!item) {
    return { found: false, message: `Spesimen ${accessionNo} tidak ditemukan di rak aktif / sudah dimusnahkan.` };
  }

  return {
    found: true,
    accession_no: item.accession_no,
    patient_name: item.patient_name,
    location_summary: `${item.freezer_id} ➔ ${item.rack_id} ➔ ${item.box_id} ➔ Grid [${item.grid_position}]`,
    sample_type: item.sample_type,
    stored_at: item.stored_at,
    expires_at: item.dispose_due_date
  };
}

async function renderSampleArchiving() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#0284c7; margin-bottom:6px;">
            🧊 ISO 15189:2022 KLAUSUL 7.5 &bull; RETENSI &amp; ARSIP SPESIMEN
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Manajemen Lokasi Rak &amp; Retensi Spesimen Freezer (-20°C)
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Pemetaan lokasi fisik tabung sisa untuk permintaan tes susulan (Add-on Tests) dan kepatuhan jadwal pemusnahan limbah.
          </p>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:15px; font-weight:800; margin:0;">Daftar Spesimen Tersimpan di Freezer Laboratorium</h3>
          <div style="display:flex; gap:8px;">
            <input type="text" id="find-acc-input" placeholder="Cari No. Accession (Add-on)..." class="input" style="font-size:12px; width:220px;">
            <button class="btn btn-teal btn-sm" onclick="
              const acc = document.getElementById('find-acc-input').value;
              const res = findArchivedSpecimen(acc);
              alert(res.found ? '📍 LOKASI SPESIMEN DITEMUKAN:\\n' + res.location_summary : res.message);
            ">🔍 Cari Lokasi</button>
          </div>
        </div>

        <table class="table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg2);">
              <th>Accession</th>
              <th>Pasien</th>
              <th>Tipe Sampel</th>
              <th>Lokasi Freezer &amp; Box</th>
              <th>Grid Posisi</th>
              <th>Waktu Simpan</th>
              <th>Batas Retensi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${sampleArchives.map(s => `
              <tr>
                <td style="font-family:monospace; font-weight:700; color:var(--sky);">${s.accession_no}</td>
                <td><b>${s.patient_name}</b></td>
                <td>${s.sample_type}</td>
                <td>${s.freezer_id} &bull; ${s.box_id}</td>
                <td><span class="badge" style="background:#0284c7; color:#fff; font-family:monospace;">${s.grid_position}</span></td>
                <td style="font-family:monospace;">${s.stored_at}</td>
                <td style="font-family:monospace; color:#f59e0b;">${s.dispose_due_date}</td>
                <td><span class="badge badge-success">Aktif Tersimpan</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderSampleArchiving = renderSampleArchiving;
  window.archiveSpecimen = archiveSpecimen;
  window.findArchivedSpecimen = findArchivedSpecimen;
  window.sampleArchives = sampleArchives;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderSampleArchiving,
    archiveSpecimen,
    findArchivedSpecimen,
    sampleArchives
  };
}
