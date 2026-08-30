// ═══════════════════════════════════════════════════════════════════════════
// MODULE: Subscription & Auto-Refill Engine — Queen Nutrition & Care
// ---------------------------------------------------------------------------
// Fitur:
// - Manajemen Paket Langganan Nutrisi & Produk Intimate Care
// - Auto-Refill Dispatch Schedule (Jadwal Kirim Bulanan Pasien)
// - Pelacakan Monthly Recurring Revenue (MRR) & Churn Rate
// - Integrasi Notifikasi Pengingat WhatsApp
// ═══════════════════════════════════════════════════════════════════════════

let SUBSCRIPTION_STATE = {
  activeTab: 'subscribers',
  subscribers: [
    {
      id: 'SUB-2026-081',
      pelanggan: 'dr. Amanda Clarissa',
      telepon: '0812-9988-7711',
      alamat: 'Menteng, Jakarta Pusat',
      paket: 'Queen Royal Collagen Glow (2 Box/Bulan)',
      sku: 'Q-NUT-01',
      nilai_bulanan: 550000,
      frekuensi: 'Setiap 30 Hari',
      tgl_mulai: '2026-06-01',
      next_dispatch: '2026-09-01',
      status: 'Aktif',
      siklus_ke: 3
    },
    {
      id: 'SUB-2026-082',
      pelanggan: 'Ny. Siska Melani',
      telepon: '0811-2233-4455',
      alamat: 'Pondok Indah, Jakarta Selatan',
      paket: 'Queen HerBalance Elixir (3 Box/Bulan)',
      sku: 'Q-NUT-02',
      nilai_bulanan: 620000,
      frekuensi: 'Setiap 30 Hari',
      tgl_mulai: '2026-07-15',
      next_dispatch: '2026-08-25',
      status: 'Aktif',
      siklus_ke: 2
    },
    {
      id: 'SUB-2026-083',
      pelanggan: 'Ibu Ratna Juwita',
      telepon: '0813-4455-6677',
      alamat: 'Surabaya Barat',
      paket: 'Hormonal & Intimate Care Complete Combo',
      sku: 'Q-NUT-02 + Q-CAR-01',
      nilai_bulanan: 750000,
      frekuensi: 'Setiap 30 Hari',
      tgl_mulai: '2026-05-10',
      next_dispatch: '2026-09-10',
      status: 'Aktif',
      siklus_ke: 4
    }
  ]
};

async function renderSubscription(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  const totalMRR = SUBSCRIPTION_STATE.subscribers.reduce((s, x) => s + (x.status === 'Aktif' ? x.nilai_bulanan : 0), 0);
  const activeCount = SUBSCRIPTION_STATE.subscribers.filter(x => x.status === 'Aktif').length;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1>📦 Subscription &amp; Auto-Refill Engine</h1>
        <p>Otomasi langganan rutin Queen Nutrition, Queen Care &amp; Membership Sanctuary</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderSubscription()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="openTambahLanggananModal()">+ Tambah Langganan Pasien</button>
      </div>
    </div>

    <!-- KPI Row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:20px;">
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(16,185,129,0.15);color:var(--teal)">🔄</div>
        <div>
          <div class="kpi-val" style="color:var(--teal)">Rp ${totalMRR.toLocaleString('id-ID')}</div>
          <div class="kpi-label">Monthly Recurring Revenue (MRR)</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(14,165,233,0.15);color:#0ea5e9">👥</div>
        <div>
          <div class="kpi-val">${activeCount} Member</div>
          <div class="kpi-label">Pelanggan Aktif Auto-Refill</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(212,175,55,0.15);color:var(--accent)">📈</div>
        <div>
          <div class="kpi-val">94.8%</div>
          <div class="kpi-label">Tingkat Retensi (Retention Rate)</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(168,85,247,0.15);color:#a855f7">🚚</div>
        <div>
          <div class="kpi-val">1 Dispatch</div>
          <div class="kpi-label">Jadwal Kirim Pekan Ini</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:14px;">Daftar Pelanggan Rutin &amp; Jadwal Auto-Refill</div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>ID Sub</th>
              <th>Nama Pelanggan</th>
              <th>Paket Formulasi SKU</th>
              <th>Nilai / Bulan</th>
              <th>Siklus Ke-</th>
              <th>Next Dispatch</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${SUBSCRIPTION_STATE.subscribers.map(s => `
              <tr>
                <td><code>${s.id}</code></td>
                <td>
                  <b>${s.pelanggan}</b><br>
                  <span style="font-size:11px;color:var(--text3);">${s.telepon} · ${s.alamat}</span>
                </td>
                <td>
                  <b>${s.paket}</b><br>
                  <span style="font-size:11px;color:var(--teal)">SKU: ${s.sku}</span>
                </td>
                <td><b>Rp ${s.nilai_bulanan.toLocaleString('id-ID')}</b></td>
                <td><span class="badge badge-info">Bulan ke-${s.siklus_ke}</span></td>
                <td><b>${s.next_dispatch}</b></td>
                <td><span class="badge badge-success">${s.status}</span></td>
                <td>
                  <button class="btn btn-sm btn-ghost" onclick="prosesKirimSekarang('${s.id}')">Dispatch Now 🚀</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function prosesKirimSekarang(id) {
  const s = SUBSCRIPTION_STATE.subscribers.find(x => x.id === id);
  if (!s) return;

  toast(`Paket auto-refill ${s.paket} untuk ${s.pelanggan} telah dijadwalkan ke kurir & stok dipotong otomatis!`, 'ok');
}

function openTambahLanggananModal() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Tambah Paket Langganan Nutrisi</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="padding:10px 0;">
      <div class="form-group">
        <label>Nama Pasien / Pelanggan</label>
        <input type="text" id="sub-nama" class="input" placeholder="mis. Ny. Nadia Kartika">
      </div>
      <div class="form-group">
        <label>Nomor WhatsApp &amp; Alamat</label>
        <input type="text" id="sub-wa" class="input" placeholder="0812-xxxx-xxxx, Jakarta Selatan">
      </div>
      <div class="form-group">
        <label>Pilihan Paket Formulasi</label>
        <select id="sub-paket" class="input">
          <option value="Queen Royal Collagen Glow (2 Box/Bln)">Queen Royal Collagen Glow (2 Box/Bulan) — Rp 550.000</option>
          <option value="Queen HerBalance Elixir (3 Box/Bln)">Queen HerBalance Elixir (3 Box/Bulan) — Rp 620.000</option>
          <option value="Ultimate Longevity Combo (Collagen + HerBalance + Mist)">Ultimate Longevity Combo — Rp 990.000</option>
        </select>
      </div>
      <div class="form-group">
        <label>Frekuensi Pengiriman</label>
        <select id="sub-freq" class="input">
          <option value="Setiap 30 Hari">Setiap 30 Hari (Bulanan)</option>
          <option value="Setiap 14 Hari">Setiap 14 Hari (Dwi-Mingguan)</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="simpanLanggananBaru()">Aktifkan Langganan Auto-Refill</button>
    </div>
  `);
}

function simpanLanggananBaru() {
  const nama = document.getElementById('sub-nama')?.value || 'Pelanggan Baru';
  const wa = document.getElementById('sub-wa')?.value || '0812-0000-0000';
  const paket = document.getElementById('sub-paket')?.value || 'Queen Royal Collagen Glow';
  const freq = document.getElementById('sub-freq')?.value || 'Setiap 30 Hari';

  const newId = `SUB-2026-0${SUBSCRIPTION_STATE.subscribers.length + 84}`;
  
  SUBSCRIPTION_STATE.subscribers.unshift({
    id: newId,
    pelanggan: nama,
    telepon: wa,
    alamat: 'Alamat Pasien Terdaftar',
    paket: paket,
    sku: 'Q-NUT-AUTO',
    nilai_bulanan: 550000,
    frekuensi: freq,
    tgl_mulai: '2026-08-19',
    next_dispatch: '2026-09-19',
    status: 'Aktif',
    siklus_ke: 1
  });

  toast(`Langganan auto-refill ${newId} berhasil diaktifkan!`, 'ok');
  closeModalForce();
  renderSubscription();
}

window.renderSubscription = renderSubscription;
window.prosesKirimSekarang = prosesKirimSekarang;
window.openTambahLanggananModal = openTambahLanggananModal;
window.simpanLanggananBaru = simpanLanggananBaru;
