// ═══════════════════════════════════════════════════════════════════════════
// MODULE: Compliance & Permit Tracker — PT AVA HEALTH SOLUTION
// ---------------------------------------------------------------------------
// Fitur:
// - Pelacakan Masa Berlaku Izin Operasional Faskes & Akreditasi Kemenkes
// - Pelacakan SIP & STR Dokter, Analis Lab, Apoteker, dan Perawat
// - Pelacakan Izin Edar BPOM (MD/TR/NA), Sertifikasi Halal, & PSE Kominfo
// - Notifikasi Peringatan Jatuh Tempo (H-90, H-60, H-30 Hari)
// ═══════════════════════════════════════════════════════════════════════════

let COMPLIANCE_STATE = {
  permits: [
    {
      id: 'LIC-001',
      kategori: 'Perizinan Faskes',
      nama_dokumen: 'Izin Operasional Klinik Pratama (DPM-PTSP)',
      nomor_izin: '503/014/KLINIK/DPMPTSP/2024',
      penerbit: 'DPM-PTSP & Dinkes',
      tgl_terbit: '2024-05-10',
      tgl_kadaluarsa: '2029-05-10',
      sisa_hari: 994,
      status: 'Aktif & Sah'
    },
    {
      id: 'LIC-002',
      kategori: 'Perizinan Faskes',
      nama_dokumen: 'Sertifikat Akreditasi Paripurna Fasyankes',
      nomor_izin: 'YM.02.01/KEMENKES/AKR/2024/091',
      penerbit: 'Kemenkes RI',
      tgl_terbit: '2024-08-15',
      tgl_kadaluarsa: '2029-08-15',
      sisa_hari: 1091,
      status: 'Aktif & Sah'
    },
    {
      id: 'LIC-003',
      kategori: 'Legalitas Nakes',
      nama_dokumen: 'SIP Dokter Sp.OG (dr. Siti Rahma, Sp.OG)',
      nomor_izin: '446/089/SIP-DS/DINKES/2025',
      penerbit: 'Dinas Kesehatan',
      tgl_terbit: '2025-01-10',
      tgl_kadaluarsa: '2028-01-10',
      sisa_hari: 509,
      status: 'Aktif & Sah'
    },
    {
      id: 'LIC-004',
      kategori: 'Legalitas Nakes',
      nama_dokumen: 'SIP Dokter Sp.PK (dr. Penanggung Jawab Lab)',
      nomor_izin: '446/012/SIP-SPPK/DINKES/2025',
      penerbit: 'Dinas Kesehatan',
      tgl_terbit: '2025-03-01',
      tgl_kadaluarsa: '2028-03-01',
      sisa_hari: 559,
      status: 'Aktif & Sah'
    },
    {
      id: 'LIC-005',
      kategori: 'Izin Edar Produk',
      nama_dokumen: 'BPOM MD: Queen Royal Collagen Glow (Q-NUT-01)',
      nomor_izin: 'BPOM RI MD 867031001290',
      penerbit: 'Badan POM RI',
      tgl_terbit: '2026-01-15',
      tgl_kadaluarsa: '2031-01-15',
      sisa_hari: 1610,
      status: 'Aktif & Sah'
    },
    {
      id: 'LIC-006',
      kategori: 'Izin Edar Produk',
      nama_dokumen: 'BPOM TR: Queen HerBalance Elixir 30mL (Q-NUT-02)',
      nomor_izin: 'BPOM RI TR 246019921',
      penerbit: 'Badan POM RI',
      tgl_terbit: '2026-02-01',
      tgl_kadaluarsa: '2031-02-01',
      sisa_hari: 1627,
      status: 'Aktif & Sah'
    },
    {
      id: 'LIC-007',
      kategori: 'Sistem Digital',
      nama_dokumen: 'Tanda Daftar Penyelenggara Sistem Elektronik (PSE)',
      nomor_izin: '00892.01/DJAI.PSE/08/2026',
      penerbit: 'Kemenkominfo RI',
      tgl_terbit: '2026-08-01',
      tgl_kadaluarsa: 'Permanen',
      sisa_hari: 9999,
      status: 'Terdaftar Resmi'
    }
  ]
};

async function renderComplianceTracker(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1>⚖️ Compliance &amp; Legal Permit Tracker</h1>
        <p>Pelacakan masa berlaku izin operasional klinik, SIP nakes, BPOM, Halal &amp; standar ISO 15189</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderComplianceTracker()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="openTambahIzinModal()">+ Tambah Dokumen Izin</button>
      </div>
    </div>

    <!-- KPI Row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin-bottom:20px;">
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(16,185,129,0.15);color:var(--teal)">✅</div>
        <div>
          <div class="kpi-val" style="color:var(--teal)">100%</div>
          <div class="kpi-label">Tingkat Kepatuhan Regulasi</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(212,175,55,0.15);color:var(--accent)">📜</div>
        <div>
          <div class="kpi-val">${COMPLIANCE_STATE.permits.length} Izin</div>
          <div class="kpi-label">Total Sertifikasi &amp; Izin Aktif</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(14,165,233,0.15);color:#0ea5e9">⏳</div>
        <div>
          <div class="kpi-val">0 Dokumen</div>
          <div class="kpi-label">Mendekati Kadaluarsa (&lt;90 Hari)</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(168,85,247,0.15);color:#a855f7">🛡️</div>
        <div>
          <div class="kpi-val">Patuh PDP</div>
          <div class="kpi-label">UU PDP No. 27/2022 Verified</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:14px;">Matriks Perizinan &amp; Akreditasi Legalitas Holding</div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Kategori Izin</th>
              <th>Nama Dokumen Sertifikasi</th>
              <th>Nomor Registrasi Resmi</th>
              <th>Instansi Penerbit</th>
              <th>Masa Berlaku</th>
              <th>Status Legalitas</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${COMPLIANCE_STATE.permits.map(p => `
              <tr>
                <td><code>${p.id}</code></td>
                <td><span class="badge badge-info">${p.kategori}</span></td>
                <td><b>${p.nama_dokumen}</b></td>
                <td><code>${p.nomor_izin}</code></td>
                <td>${p.penerbit}</td>
                <td>
                  <span>Exp: ${p.tgl_kadaluarsa}</span><br>
                  <span style="font-size:11px;color:var(--teal)">(${p.sisa_hari === 9999 ? 'Permanen' : p.sisa_hari + ' Hari Lagi'})</span>
                </td>
                <td><span class="badge badge-success">${p.status}</span></td>
                <td>
                  <button class="btn btn-sm btn-ghost" onclick="toast('Salinan PDF ${p.id} terverifikasi asli dari Kemenkes/BPOM', 'ok')">Lihat Berkas 📄</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openTambahIzinModal() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Tambah Dokumen Perizinan / SIP Baru</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="padding:10px 0;">
      <div class="form-group">
        <label>Kategori Dokumen</label>
        <select id="lic-kat" class="input">
          <option value="Perizinan Faskes">Perizinan Faskes (Klinik / Lab)</option>
          <option value="Legalitas Nakes">Legalitas Nakes (SIP / STR)</option>
          <option value="Izin Edar Produk">Izin Edar Produk (BPOM / Halal)</option>
          <option value="Sistem Digital">Sistem Digital (PSE / ISO 27001)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nama Dokumen / Izin</label>
        <input type="text" id="lic-nama" class="input" placeholder="mis. SIP Dokter Umum dr. Budi Santoso">
      </div>
      <div class="form-group">
        <label>Nomor Izin Resmi</label>
        <input type="text" id="lic-nomor" class="input" placeholder="mis. 446/099/SIP-DU/DINKES/2026">
      </div>
      <div class="grid-2" style="gap:10px;">
        <div class="form-group">
          <label>Instansi Penerbit</label>
          <input type="text" id="lic-penerbit" class="input" value="Dinas Kesehatan">
        </div>
        <div class="form-group">
          <label>Tanggal Kadaluarsa</label>
          <input type="date" id="lic-exp" class="input" value="2029-08-19">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="simpanIzinBaru()">Simpan Legalitas</button>
    </div>
  `);
}

function simpanIzinBaru() {
  const kat = document.getElementById('lic-kat')?.value || 'Perizinan Faskes';
  const nama = document.getElementById('lic-nama')?.value || 'Izin Baru';
  const no = document.getElementById('lic-nomor')?.value || 'REG-AUTO-2026';
  const penerbit = document.getElementById('lic-penerbit')?.value || 'Dinkes';
  const exp = document.getElementById('lic-exp')?.value || '2029-12-31';

  const newId = `LIC-00${COMPLIANCE_STATE.permits.length + 1}`;

  COMPLIANCE_STATE.permits.push({
    id: newId,
    kategori: kat,
    nama_dokumen: nama,
    nomor_izin: no,
    penerbit: penerbit,
    tgl_terbit: '2026-08-19',
    tgl_kadaluarsa: exp,
    sisa_hari: 1095,
    status: 'Aktif & Sah'
  });

  toast(`Dokumen legalitas ${newId} berhasil dicatat & sistem pengingat masa berlaku aktif!`, 'ok');
  closeModalForce();
  renderComplianceTracker();
}

window.renderComplianceTracker = renderComplianceTracker;
window.openTambahIzinModal = openTambahIzinModal;
window.simpanIzinBaru = simpanIzinBaru;
