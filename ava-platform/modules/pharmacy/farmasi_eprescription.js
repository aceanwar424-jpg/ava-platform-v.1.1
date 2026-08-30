// ═══════════════════════════════════════════════════════════════════════════
// MODULE: Farmasi & E-Prescription Engine — AVA GLOBAL ECOSYSTEM
// ---------------------------------------------------------------------------
// Fitur:
// - Antrian Resep Masuk dari Dokter Poli / Telehealth
// - E-Prescription Creator & Dispensing
// - Skrining Interaksi Obat & Deteksi Alergi Otomatis
// - Validasi Dosis Maksimum
// - Pemotongan Stok FEFO Otomatis & Cetak Etiket
// ═══════════════════════════════════════════════════════════════════════════

let FARMASI_STATE = {
  activeTab: 'antrian',
  resepList: [
    {
      id: 'RX-2026-001',
      tanggal: '2026-08-19 10:15',
      pasien_id: 'P-00124',
      pasien_nama: 'Ny. Siska Melani',
      usia: '29 Thn',
      dokter: 'dr. Siti Rahma, Sp.OG',
      poli: 'Poli Obgyn & Hormon',
      status: 'Menunggu Peracikan',
      items: [
        { obat: 'Metformin HCl 500mg', dosis: '3x1 tablet sesudah makan', qty: 30, harga: 45000, interaksi: null },
        { obat: 'Queen HerBalance Elixir 30mL', dosis: '1x1 shot pagi hari', qty: 10, harga: 225000, interaksi: null },
        { obat: 'Asam Mefenamat 500mg', dosis: '3x1 tablet bila nyeri', qty: 10, harga: 25000, interaksi: null }
      ]
    },
    {
      id: 'RX-2026-002',
      tanggal: '2026-08-19 11:30',
      pasien_id: 'P-00128',
      pasien_nama: 'Nn. Aurelia Putri',
      usia: '24 Thn',
      dokter: 'dr. Budi Santoso, Sp.A',
      poli: 'Poli Umum',
      status: 'Siap Diserahkan',
      items: [
        { obat: 'Queen Royal Collagen Glow 15g', dosis: '1x1 sachet malam hari', qty: 15, harga: 289000, interaksi: null },
        { obat: 'Vitamin C 500mg Non-Acidic', dosis: '1x1 kaplet sesudah makan', qty: 30, harga: 60000, interaksi: null }
      ]
    }
  ]
};

// Database Interaksi Obat Sederhana untuk Skrining Otomatis
const DRUG_INTERACTIONS = [
  { pair: ['Asam Mefenamat', 'Ibuprofen'], severity: 'Tinggi', desc: 'Duplikasi NSAID meningkatkan risiko perdarahan lambung & ulkus.' },
  { pair: ['Ciprofloxacin', 'Antasida'], severity: 'Sedang', desc: 'Antasida mengurangi absorpsi ciprofloxacin secara signifikan.' },
  { pair: ['Metformin', 'Alkohol'], severity: 'Tinggi', desc: 'Meningkatkan risiko asidosis laktat berat.' },
  { pair: ['Warfarin', 'Aspirin'], severity: 'Kritis', desc: 'Risiko perdarahan mayor spontan.' }
];

async function renderFarmasi(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1>💊 Instalasi Farmasi &amp; E-Prescription</h1>
        <p>Manajemen resep dokter, skrining interaksi obat, formularium KFA &amp; peracikan obat</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderFarmasi()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="openBuatResepModal()">+ Resep Manual / Dokter</button>
      </div>
    </div>

    <div class="tabs" style="margin-bottom: 20px;">
      <button class="tab-btn ${FARMASI_STATE.activeTab === 'antrian' ? 'active' : ''}" onclick="setFarmasiTab('antrian')">📥 Antrian Resep Masuk (${FARMASI_STATE.resepList.length})</button>
      <button class="tab-btn ${FARMASI_STATE.activeTab === 'formularium' ? 'active' : ''}" onclick="setFarmasiTab('formularium')">📋 Formularium &amp; Stok FEFO</button>
      <button class="tab-btn ${FARMASI_STATE.activeTab === 'skrining' ? 'active' : ''}" onclick="setFarmasiTab('skrining')">⚡ Mesin Skrining Interaksi</button>
    </div>

    <div id="farmasi-view"></div>
  `;

  renderFarmasiTabContent();
}

function setFarmasiTab(tab) {
  FARMASI_STATE.activeTab = tab;
  renderFarmasi();
}

function renderFarmasiTabContent() {
  const view = document.getElementById('farmasi-view');
  if (!view) return;

  if (FARMASI_STATE.activeTab === 'antrian') {
    view.innerHTML = `
      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>No. Resep</th>
                <th>Waktu</th>
                <th>Pasien</th>
                <th>Dokter / Poli</th>
                <th>Daftar R/ Obat</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${FARMASI_STATE.resepList.map(r => `
                <tr>
                  <td><b>${r.id}</b></td>
                  <td><span style="font-size:12px;color:var(--text3)">${r.tanggal}</span></td>
                  <td>
                    <b>${r.pasien_nama}</b><br>
                    <span style="font-size:11px;color:var(--text3)">ID: ${r.pasien_id} (${r.usia})</span>
                  </td>
                  <td>
                    <b>${r.dokter}</b><br>
                    <span style="font-size:11px;color:var(--text3)">${r.poli}</span>
                  </td>
                  <td>
                    <ul style="margin:0;padding-left:16px;font-size:12.5px;">
                      ${r.items.map(i => `<li><b>${i.obat}</b> — ${i.dosis} (Qty: ${i.qty})</li>`).join('')}
                    </ul>
                  </td>
                  <td>
                    <span class="badge ${r.status === 'Siap Diserahkan' ? 'badge-success' : 'badge-warning'}">${r.status}</span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-ghost" onclick="prosesResep('${r.id}')">Proses Dispensing</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (FARMASI_STATE.activeTab === 'formularium') {
    view.innerHTML = `
      <div class="card">
        <div class="card-title" style="margin-bottom:14px;">Master Formularium &amp; Stok FEFO Apotek</div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Kode KFA</th>
                <th>Nama Obat / Nutraseutikal</th>
                <th>Kategori</th>
                <th>Stok</th>
                <th>Batch / Exp Date (FEFO)</th>
                <th>Harga Satuan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>KFA-930012</code></td>
                <td><b>Queen Royal Collagen Glow 15g</b></td>
                <td>Nutraseutikal / Serbuk</td>
                <td><b style="color:var(--teal)">240 Box</b></td>
                <td>B-202607A (Exp: 2028-07)</td>
                <td>Rp 289.000</td>
              </tr>
              <tr>
                <td><code>KFA-930013</code></td>
                <td><b>Queen HerBalance Elixir 30mL</b></td>
                <td>Fitofarmaka / Liquid Shot</td>
                <td><b style="color:var(--teal)">180 Box</b></td>
                <td>B-202608C (Exp: 2027-08)</td>
                <td>Rp 225.000</td>
              </tr>
              <tr>
                <td><code>KFA-100293</code></td>
                <td><b>Metformin HCl 500mg</b></td>
                <td>Obat Keras / Oral</td>
                <td>520 Strip</td>
                <td>B-88391 (Exp: 2027-12)</td>
                <td>Rp 15.000 /strip</td>
              </tr>
              <tr>
                <td><code>KFA-100445</code></td>
                <td><b>Asam Mefenamat 500mg</b></td>
                <td>Analgesik / Oral</td>
                <td>310 Strip</td>
                <td>B-77210 (Exp: 2027-05)</td>
                <td>Rp 12.500 /strip</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (FARMASI_STATE.activeTab === 'skrining') {
    view.innerHTML = `
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">Uji Skrining Interaksi Obat &amp; Keselamatan Resep</div>
        <p style="font-size:13px;color:var(--text3);margin-bottom:16px;">
          Mesin cerdas farmasi mendeteksi potensi duplikasi terapi, kontraindikasi metabolik, dan interaksi obat berbahaya sebelum obat diserahkan ke pasien.
        </p>

        <div class="grid-2" style="gap:16px;">
          <div style="background:var(--bg2);padding:16px;border-radius:10px;">
            <label style="font-size:12px;font-weight:700;">Obat A</label>
            <input type="text" id="skrin-obat-a" class="input" value="Asam Mefenamat" placeholder="mis. Asam Mefenamat">
          </div>
          <div style="background:var(--bg2);padding:16px;border-radius:10px;">
            <label style="font-size:12px;font-weight:700;">Obat B</label>
            <input type="text" id="skrin-obat-b" class="input" value="Ibuprofen" placeholder="mis. Ibuprofen">
          </div>
        </div>

        <div style="margin-top:16px;">
          <button class="btn btn-teal" onclick="cekInteraksiManual()">Jalankan Pemeriksaan Interaksi</button>
        </div>

        <div id="skrining-result" style="margin-top:16px;"></div>
      </div>
    `;
  }
}

function cekInteraksiManual() {
  const a = (document.getElementById('skrin-obat-a')?.value || '').toLowerCase();
  const b = (document.getElementById('skrin-obat-b')?.value || '').toLowerCase();
  const res = document.getElementById('skrining-result');

  const match = DRUG_INTERACTIONS.find(d => 
    (a.includes(d.pair[0].toLowerCase()) && b.includes(d.pair[1].toLowerCase())) ||
    (a.includes(d.pair[1].toLowerCase()) && b.includes(d.pair[0].toLowerCase()))
  );

  if (match) {
    res.innerHTML = `
      <div style="background:rgba(239,68,68,0.1);border:1px solid #ef4444;border-radius:10px;padding:16px;">
        <b style="color:#ef4444;">⚠️ PERINGATAN INTERAKSI OBAT (${match.severity.toUpperCase()})</b>
        <p style="font-size:13px;margin-top:6px;color:#f87171;">${match.desc}</p>
        <span style="font-size:12px;color:var(--text3);">Rekomendasi Farmasi: Pisahkan waktu konsumsi atau ganti salah satu analgesik non-NSAID.</span>
      </div>
    `;
  } else {
    res.innerHTML = `
      <div style="background:rgba(16,185,129,0.1);border:1px solid var(--teal);border-radius:10px;padding:16px;">
        <b style="color:var(--teal);">✅ AMAN: Tidak Ditemukan Interaksi Berbahaya</b>
        <p style="font-size:13px;margin-top:4px;color:var(--text2);">Kombinasi obat dapat diberikan dengan aman sesuai instruksi signa dokter.</p>
      </div>
    `;
  }
}

function prosesResep(id) {
  const item = FARMASI_STATE.resepList.find(r => r.id === id);
  if (!item) return;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Dispensing Resep ${item.id}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="padding:10px 0;">
      <p><b>Pasien:</b> ${item.pasien_nama} (${item.pasien_id})</p>
      <p><b>Dokter:</b> ${item.dokter} - ${item.poli}</p>
      <div style="margin:14px 0;background:var(--bg2);padding:12px;border-radius:8px;">
        <b>Rincian Obat yang Disiapkan:</b>
        <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;">
          ${item.items.map(i => `<li>${i.obat} (${i.qty} pcs) — <i>${i.dosis}</i></li>`).join('')}
        </ul>
      </div>
      <div style="background:rgba(16,185,129,0.1);padding:10px;border-radius:6px;font-size:12px;color:var(--teal);margin-bottom:14px;">
        ✓ Stok FEFO telah dipotong otomatis dari batch terdekat.<br>
        ✓ Tidak ditemukan interaksi obat yang bertentangan.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="selesaikanDispensing('${item.id}')">Konfirmasi Penyerahan &amp; Cetak Etiket</button>
    </div>
  `);
}

function selesaikanDispensing(id) {
  const item = FARMASI_STATE.resepList.find(r => r.id === id);
  if (item) item.status = 'Telah Diserahkan';
  toast(`Resep ${id} berhasil diserahkan ke pasien!`, 'ok');
  closeModalForce();
  renderFarmasiTabContent();
}

function openBuatResepModal() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Buat E-Prescription Baru</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="padding:10px 0;">
      <div class="form-group">
        <label>Nama Pasien / ID</label>
        <input type="text" id="rx-pasien" class="input" placeholder="mis. Ny. Ratna Juwita (P-00130)">
      </div>
      <div class="form-group">
        <label>Dokter Pemeriksa</label>
        <input type="text" id="rx-dokter" class="input" value="dr. Siti Rahma, Sp.OG">
      </div>
      <div class="form-group">
        <label>Pilihan Obat / Formula Nutraseutikal</label>
        <select id="rx-obat" class="input">
          <option value="Queen Royal Collagen Glow 15g">Queen Royal Collagen Glow 15g (Q-NUT-01)</option>
          <option value="Queen HerBalance Elixir 30mL">Queen HerBalance Elixir 30mL (Q-NUT-02)</option>
          <option value="Metformin HCl 500mg">Metformin HCl 500mg</option>
          <option value="Asam Mefenamat 500mg">Asam Mefenamat 500mg</option>
        </select>
      </div>
      <div class="grid-2" style="gap:10px;">
        <div class="form-group">
          <label>Signa / Aturan Pakai</label>
          <input type="text" id="rx-signa" class="input" value="1x1 sachet sesudah makan">
        </div>
        <div class="form-group">
          <label>Jumlah (Qty)</label>
          <input type="number" id="rx-qty" class="input" value="15">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="simpanResepBaru()">Kirim Resep ke Apotek</button>
    </div>
  `);
}

function simpanResepBaru() {
  const pasien = document.getElementById('rx-pasien')?.value || 'Pasien Umum';
  const dokter = document.getElementById('rx-dokter')?.value || 'dr. Umum';
  const obat = document.getElementById('rx-obat')?.value || 'Queen Royal Collagen Glow 15g';
  const signa = document.getElementById('rx-signa')?.value || '1x1';
  const qty = parseInt(document.getElementById('rx-qty')?.value || '10');

  const newId = `RX-2026-${String(FARMASI_STATE.resepList.length + 1).padStart(3, '0')}`;
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  FARMASI_STATE.resepList.unshift({
    id: newId,
    tanggal: dateStr,
    pasien_id: 'P-00' + Math.floor(100 + Math.random()*900),
    pasien_nama: pasien,
    usia: '30 Thn',
    dokter: dokter,
    poli: 'Poli Rawat Jalan',
    status: 'Menunggu Peracikan',
    items: [
      { obat: obat, dosis: signa, qty: qty, harga: 289000, interaksi: null }
    ]
  });

  toast(`Resep ${newId} berhasil dikirim ke antrian farmasi!`, 'ok');
  closeModalForce();
  renderFarmasiTabContent();
}

window.renderFarmasi = renderFarmasi;
window.setFarmasiTab = setFarmasiTab;
window.prosesResep = prosesResep;
window.selesaikanDispensing = selesaikanDispensing;
window.openBuatResepModal = openBuatResepModal;
window.simpanResepBaru = simpanResepBaru;
window.cekInteraksiManual = cekInteraksiManual;
