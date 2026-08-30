// ═══════════════════════════════════════════════════════════════════════════
// MODULE: E-Commerce OMS, FMCG Supply Chain & Distribusi 1.000 Apotek
// ---------------------------------------------------------------------------
// Fitur:
// - Multi-Channel OMS (TikTok Shop, Shopee Mall, Tokopedia, Web D2C AVA)
// - Manajemen Konsinyasi Distribusi 1.000 Apotek Modern (K-24, Kimia Farma, Century)
// - Manajemen Batch & Stok FEFO (First Expired First Out) Gudang
// - Integrasi Ekspedisi Logistik (Kalkulator Ongkir & Cetak Resi Thermal 100x150mm)
// - Laporan Finansial Omzet & Margin Produk Nutraseutikal
// ═══════════════════════════════════════════════════════════════════════════

let OMS_STATE = {
  activeTab: 'd2c', // 'd2c' | 'apotek' | 'batch' | 'shipping' | 'analytics'
  selectedChannel: 'ALL',
  selectedStatus: 'ALL',
  orders: [
    {
      id: 'ORD-2026-8801',
      channel: 'TikTok Shop',
      customer: 'Siti Nurhaliza',
      telepon: '0812-3344-5566',
      alamat: 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
      items: 'Queen Royal Collagen Glow 15g (x2 Box)',
      sku: 'Q-NUT-01',
      total: 578000,
      resi: 'SPXID0299881123',
      kurir: 'Shopee Xpress',
      status: 'Dikirim',
      tgl: '2026-08-22 09:15'
    },
    {
      id: 'ORD-2026-8802',
      channel: 'Shopee Mall',
      customer: 'Dewi Lestari',
      telepon: '0813-7788-9900',
      alamat: 'Cluster Magnolia Blok C2/10, BSD City, Tangerang Selatan',
      items: 'Queen HerBalance Elixir 30mL (x1 Box) + Intimate Wash',
      sku: 'Q-NUT-02 + Q-CAR-01',
      total: 344000,
      resi: 'JNT992201992',
      kurir: 'J&T Express',
      status: 'Perlu Diproses',
      tgl: '2026-08-22 10:30'
    },
    {
      id: 'ORD-2026-8803',
      channel: 'Web D2C AVA',
      customer: 'dr. Amanda Clarissa',
      telepon: '0812-9988-7711',
      alamat: 'Jl. Kemang Raya No. 88, Mampang Prapatan, Jakarta Selatan',
      items: 'Ultimate Longevity Set (Collagen + HerBalance + Mist)',
      sku: 'Q-BUNDLE-01',
      total: 649000,
      resi: 'GOSEND-881902',
      kurir: 'GoSend Instant',
      status: 'Siap Pickup',
      tgl: '2026-08-22 11:45'
    },
    {
      id: 'ORD-2026-8804',
      channel: 'Tokopedia',
      customer: 'Ibu Ratna Juwita',
      telepon: '0814-5566-7788',
      alamat: 'Menteng Residence No. 12, Jakarta Pusat',
      items: 'Queen Royal Collagen Glow 15g (x4 Box Bundle)',
      sku: 'Q-NUT-01',
      total: 1100000,
      resi: 'JNE88291039',
      kurir: 'JNE Reguler',
      status: 'Selesai',
      tgl: '2026-08-21 14:20'
    }
  ],
  apotekKonsinyasi: [
    { id: 'APT-01', nama: 'Apotek Kimia Farma Matraman', kota: 'Jakarta Timur', pic: 'apt. Budi Santoso, S.Farm', telp: '0811-2233-4455', stok_titip: 80, terjual: 62, omset: 17918000, margin_apotek: 3583600, jatuh_tempo: '2026-09-05', status: 'Aktif' },
    { id: 'APT-02', nama: 'Apotek K-24 Dharmawangsa', kota: 'Jakarta Selatan', pic: 'apt. Rina Marlina, S.Farm', telp: '0812-4455-6677', stok_titip: 60, terjual: 45, omset: 13005000, margin_apotek: 2601000, jatuh_tempo: '2026-09-10', status: 'Aktif' },
    { id: 'APT-03', nama: 'Apotek Century Grand Indonesia', kota: 'Jakarta Pusat', pic: 'apt. Sandra Dewi, S.Farm', telp: '0813-6677-8899', stok_titip: 100, terjual: 90, omset: 26010000, margin_apotek: 5202000, jatuh_tempo: '2026-08-30', status: 'Top Performer' },
    { id: 'APT-04', nama: 'Apotek Roxy Kebon Jeruk', kota: 'Jakarta Barat', pic: 'apt. Hendra Setiawan', telp: '0815-7788-9911', stok_titip: 50, terjual: 38, omset: 10982000, margin_apotek: 2196400, jatuh_tempo: '2026-09-15', status: 'Aktif' }
  ],
  batchStok: [
    { batchNo: 'LOT-2026-07A', produk: 'Queen Royal Collagen Glow 15g', tglProduksi: '2026-07-01', tglExp: '2028-07-01', stokFisik: 4200, stokReserved: 340, status: 'Optimal' },
    { batchNo: 'LOT-2026-06B', produk: 'Queen HerBalance Elixir 30mL', tglProduksi: '2026-06-15', tglExp: '2028-06-15', stokFisik: 2800, stokReserved: 190, status: 'Optimal' },
    { batchNo: 'LOT-2025-12C', produk: 'Queen Radiance Intimate Wash', tglProduksi: '2025-12-10', tglExp: '2027-12-10', stokFisik: 1200, stokReserved: 80, status: 'Optimal' },
    { batchNo: 'LOT-2025-08A', produk: 'Ultimate Longevity Essence Mist', tglProduksi: '2025-08-01', tglExp: '2027-02-01', stokFisik: 450, stokReserved: 120, status: 'Exp < 6 Bulan' }
  ]
};

async function renderEcommerceOms(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  if (params.tab) OMS_STATE.activeTab = params.tab;

  const totalOmsetOrders = OMS_STATE.orders.reduce((s, o) => s + o.total, 0);
  const totalOmsetApotek = OMS_STATE.apotekKonsinyasi.reduce((s, a) => s + a.omset, 0);

  content.innerHTML = `
    <!-- Header Modul -->
    <div class="page-header">
      <div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span class="badge" style="background:#fce7f3; color:#9d174d; font-weight:800; font-size:10px;">PILAR 4 &bull; PT QUEEN NUTRITION NUSANTARA</span>
          <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:800; font-size:10px;">BPOM &amp; HALAL VERIFIED</span>
        </div>
        <h1>🛍️ E-Commerce OMS &amp; Distribusi 1.000 Apotek</h1>
        <p>Manajemen pesanan multi-channel D2C, stok batch FMCG &amp; konsinyasi ritel apotek modern</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderEcommerceOms()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="openTambahPesananModal()">+ Buat Pesanan D2C</button>
        <button class="btn btn-primary btn-sm" style="background:#0A2342; border-color:#0A2342; color:#fff;" onclick="openTambahApotekModal()">+ Tambah Mitra Apotek</button>
      </div>
    </div>

    <!-- Ringkasan KPI Utama -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; margin-bottom:20px;">
      <div class="kpi-card" style="border-left: 4px solid #ec4899;">
        <div class="kpi-icon" style="background:rgba(236,72,153,0.15); color:#ec4899;">📦</div>
        <div>
          <div class="kpi-val">1.240 Box</div>
          <div class="kpi-label">Volume Terjual Bulan Ini</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Rp ${(totalOmsetOrders/1000000).toFixed(1)} Jt D2C Online</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #f59e0b;">
        <div class="kpi-icon" style="background:rgba(245,158,11,0.15); color:#f59e0b;">🏪</div>
        <div>
          <div class="kpi-val">420 Apotek</div>
          <div class="kpi-label">Jaringan Konsinyasi Aktif</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Rp ${(totalOmsetApotek/1000000).toFixed(1)} Jt Omzet Apotek</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #0ea5e9;">
        <div class="kpi-icon" style="background:rgba(14,165,233,0.15); color:#0ea5e9;">🌐</div>
        <div>
          <div class="kpi-val">4 Saluran</div>
          <div class="kpi-label">Multi-Channel Active Sync</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">TikTok &bull; Shopee &bull; Tokped &bull; Web</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #22c55e;">
        <div class="kpi-icon" style="background:rgba(34,197,94,0.15); color:#22c55e;">⚡</div>
        <div>
          <div class="kpi-val">99.2%</div>
          <div class="kpi-label">Fulfillment SLA Rate</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Sameday Dispatch</div>
        </div>
      </div>
    </div>

    <!-- Sub-Menu Workspace Tabs (Navigasi Internal Modul) -->
    <div style="display:flex; gap:8px; border-bottom:2px solid var(--border); margin-bottom:20px; overflow-x:auto; padding-bottom:2px;">
      <button class="btn btn-sm ${OMS_STATE.activeTab === 'd2c' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabOms('d2c')">
        🛍️ 1. Pesanan Marketplace &amp; D2C (${OMS_STATE.orders.length})
      </button>
      <button class="btn btn-sm ${OMS_STATE.activeTab === 'apotek' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabOms('apotek')">
        🏪 2. Konsinyasi 1.000 Apotek (${OMS_STATE.apotekKonsinyasi.length})
      </button>
      <button class="btn btn-sm ${OMS_STATE.activeTab === 'batch' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabOms('batch')">
        📦 3. Manajemen Batch &amp; Stok FEFO
      </button>
      <button class="btn btn-sm ${OMS_STATE.activeTab === 'shipping' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabOms('shipping')">
        🚚 4. Ekspedisi &amp; Resi Thermal
      </button>
      <button class="btn btn-sm ${OMS_STATE.activeTab === 'analytics' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabOms('analytics')">
        📊 5. Laporan Omzet &amp; P&amp;L Produk
      </button>
    </div>

    <!-- Konten Tab Aktif -->
    <div id="oms-tab-content">
      ${renderOmsTabContent()}
    </div>
  `;
}

function gantiTabOms(tab) {
  OMS_STATE.activeTab = tab;
  renderEcommerceOms();
}

function renderOmsTabContent() {
  // TAB 1: PESANAN MARKETPLACE & D2C
  if (OMS_STATE.activeTab === 'd2c') {
    const filteredOrders = OMS_STATE.orders.filter(o => {
      if (OMS_STATE.selectedChannel !== 'ALL' && o.channel !== OMS_STATE.selectedChannel) return false;
      if (OMS_STATE.selectedStatus !== 'ALL' && o.status !== OMS_STATE.selectedStatus) return false;
      return true;
    });

    return `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">Daftar Pesanan Multi-Channel Masuk</h3>
            <p style="font-size:12px; color:var(--text3); margin:2px 0 0 0;">Sinkronisasi otomatis dengan API Shopee Open Platform &amp; TikTok Shop Partner</p>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <select class="input" style="padding:6px 12px; font-size:12px; width:auto;" onchange="OMS_STATE.selectedChannel = this.value; renderEcommerceOms();">
              <option value="ALL" ${OMS_STATE.selectedChannel === 'ALL' ? 'selected' : ''}>Semua Channel</option>
              <option value="TikTok Shop" ${OMS_STATE.selectedChannel === 'TikTok Shop' ? 'selected' : ''}>TikTok Shop</option>
              <option value="Shopee Mall" ${OMS_STATE.selectedChannel === 'Shopee Mall' ? 'selected' : ''}>Shopee Mall</option>
              <option value="Tokopedia" ${OMS_STATE.selectedChannel === 'Tokopedia' ? 'selected' : ''}>Tokopedia</option>
              <option value="Web D2C AVA" ${OMS_STATE.selectedChannel === 'Web D2C AVA' ? 'selected' : ''}>Web D2C AVA</option>
            </select>

            <select class="input" style="padding:6px 12px; font-size:12px; width:auto;" onchange="OMS_STATE.selectedStatus = this.value; renderEcommerceOms();">
              <option value="ALL" ${OMS_STATE.selectedStatus === 'ALL' ? 'selected' : ''}>Semua Status</option>
              <option value="Perlu Diproses" ${OMS_STATE.selectedStatus === 'Perlu Diproses' ? 'selected' : ''}>Perlu Diproses</option>
              <option value="Siap Pickup" ${OMS_STATE.selectedStatus === 'Siap Pickup' ? 'selected' : ''}>Siap Pickup</option>
              <option value="Dikirim" ${OMS_STATE.selectedStatus === 'Dikirim' ? 'selected' : ''}>Dikirim</option>
              <option value="Selesai" ${OMS_STATE.selectedStatus === 'Selesai' ? 'selected' : ''}>Selesai</option>
            </select>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>No. Pesanan</th>
                <th>Channel</th>
                <th>Nama Pembeli &amp; Kontak</th>
                <th>Produk / SKU</th>
                <th>Total</th>
                <th>Kurir &amp; Resi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${filteredOrders.map(o => `
                <tr>
                  <td><b>${o.id}</b><div style="font-size:10.5px; color:var(--text3);">${o.tgl}</div></td>
                  <td><span class="badge ${o.channel.includes('TikTok') ? 'badge-dark' : o.channel.includes('Shopee') ? 'badge-warning' : 'badge-teal'}">${o.channel}</span></td>
                  <td>
                    <b>${o.customer}</b>
                    <div style="font-size:11px; color:var(--text3);">${o.telepon}</div>
                  </td>
                  <td>${o.items}</td>
                  <td><strong style="color:var(--teal);">Rp ${o.total.toLocaleString('id-ID')}</strong></td>
                  <td>
                    <div>${o.kurir}</div>
                    <code style="font-size:11px; color:#0ea5e9;">${o.resi}</code>
                  </td>
                  <td>
                    <span class="badge ${o.status === 'Selesai' ? 'badge-success' : o.status === 'Dikirim' ? 'badge-teal' : 'badge-warning'}">${o.status}</span>
                  </td>
                  <td>
                    <div style="display:flex; gap:4px;">
                      <button class="btn btn-xs btn-ghost" title="Cetak Label Resi" onclick="cetakResiThermal('${o.id}')">🏷️ Resi</button>
                      <button class="btn btn-xs btn-teal" title="Kirim WA Resi" onclick="kirimWaResi('${o.id}')">💬 WA</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 2: KONSINYASI 1.000 APOTEK
  if (OMS_STATE.activeTab === 'apotek') {
    return `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">Jaringan Distribusi Konsinyasi Apotek Modern</h3>
            <p style="font-size:12px; color:var(--text3); margin:2px 0 0 0;">Monitoring stok titipan, rekap penjualan, dan margin bagi hasil apotek rekanan</p>
          </div>
          <button class="btn btn-sm btn-teal" onclick="openTambahApotekModal()">+ Tambah Titipan Konsinyasi</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>Nama Apotek &amp; Kota</th>
                <th>Penanggung Jawab (Apoteker)</th>
                <th>Stok Dititip</th>
                <th>Terjual</th>
                <th>Total Omset</th>
                <th>Margin Apotek (20%)</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${OMS_STATE.apotekKonsinyasi.map(a => `
                <tr>
                  <td><b>${a.nama}</b><div style="font-size:11px; color:var(--text3);">${a.kota}</div></td>
                  <td>${a.pic}<div style="font-size:11px; color:var(--text3);">${a.telp}</div></td>
                  <td><b>${a.stok_titip} Box</b></td>
                  <td><b style="color:var(--teal);">${a.terjual} Box</b></td>
                  <td><strong>Rp ${a.omset.toLocaleString('id-ID')}</strong></td>
                  <td><span style="color:#f59e0b; font-weight:700;">Rp ${a.margin_apotek.toLocaleString('id-ID')}</span></td>
                  <td><span style="color:#ef4444; font-weight:600;">${a.jatuh_tempo}</span></td>
                  <td><span class="badge ${a.status === 'Top Performer' ? 'badge-success' : 'badge-teal'}">${a.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 3: BATCH & MANAJEMEN STOK FEFO
  if (OMS_STATE.activeTab === 'batch') {
    return `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">Manajemen Lot / Batch &amp; Pelacakan FEFO Gudang</h3>
            <p style="font-size:12px; color:var(--text3); margin:2px 0 0 0;">Standar Good Manufacturing Practice (GMP) &amp; Rantai Pasok Maklon Bersertifikasi</p>
          </div>
          <button class="btn btn-sm btn-teal" onclick="alert('Form penerimaan batch maklon baru')">+ Input Batch Produksi Baru</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>Nomor Lot / Batch</th>
                <th>Nama Produk FMCG</th>
                <th>Tgl Produksi</th>
                <th>Expired Date (ED)</th>
                <th>Stok Fisik Gudang</th>
                <th>Alokasi Reserved</th>
                <th>Status FEFO</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${OMS_STATE.batchStok.map(b => `
                <tr>
                  <td><code style="font-weight:700; color:#0A2342;">${b.batchNo}</code></td>
                  <td><b>${b.produk}</b></td>
                  <td>${b.tglProduksi}</td>
                  <td><b>${b.tglExp}</b></td>
                  <td><strong style="color:var(--teal); font-size:13px;">${b.stokFisik.toLocaleString('id-ID')} Box</strong></td>
                  <td>${b.stokReserved} Box</td>
                  <td><span class="badge ${b.status === 'Optimal' ? 'badge-success' : 'badge-warning'}">${b.status}</span></td>
                  <td>
                    <button class="btn btn-xs btn-ghost" onclick="alert('Kartu Stok Mutasi Batch ${b.batchNo}')">📄 Kartu Stok</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 4: EKSPEDISI & RESI THERMAL
  if (OMS_STATE.activeTab === 'shipping') {
    return `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">🚚 Cek Tarif &amp; Pickup Ekspedisi</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div class="form-group">
              <label>Kota / Kecamatan Tujuan</label>
              <input type="text" class="input" id="ship-dest" value="Kebayoran Baru, Jakarta Selatan">
            </div>
            <div class="form-group">
              <label>Estimasi Berat Total (Gram)</label>
              <input type="number" class="input" id="ship-weight" value="500">
            </div>
            <button class="btn btn-teal" onclick="cekTarifEkspedisi()">🔍 Hitung Tarif Multi-Kurir</button>
            <div id="ship-results" style="margin-top:12px;"></div>
          </div>
        </div>

        <div class="card" style="padding:20px;">
          <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">🏷️ Simulator Cetak Resi Thermal 100x150mm</h3>
          <p style="font-size:12px; color:var(--text3); margin-bottom:14px;">Klik pesanan di bawah untuk mencetak label pengiriman otomatis:</p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${OMS_STATE.orders.map(o => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg2); border-radius:8px;">
                <div>
                  <b>${o.id} &bull; ${o.customer}</b>
                  <div style="font-size:11px; color:var(--text3);">${o.items}</div>
                </div>
                <button class="btn btn-xs btn-teal" onclick="cetakResiThermal('${o.id}')">🖨️ Cetak Label</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // TAB 5: ANALITIK OMZET & P&L
  return `
    <div class="card" style="padding:20px;">
      <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">📊 Kinerja Penjualan &amp; Margin Kontribusi Pilar 4</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:20px;">
        <div style="background:var(--bg2); padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--text3);">Gross Merchandise Value (GMV)</span>
          <h2 style="font-size:22px; color:var(--navy); margin:4px 0 0 0;">Rp 480.200.000</h2>
        </div>
        <div style="background:var(--bg2); padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--text3);">Harga Pokok Penjualan (HPP Maklon)</span>
          <h2 style="font-size:22px; color:#ef4444; margin:4px 0 0 0;">Rp 144.060.000 (30%)</h2>
        </div>
        <div style="background:var(--bg2); padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--text3);">Gross Profit (Laba Kotor)</span>
          <h2 style="font-size:22px; color:#22c55e; margin:4px 0 0 0;">Rp 336.140.000 (70%)</h2>
        </div>
      </div>
    </div>
  `;
}

// Handler Cetak Resi
function cetakResiThermal(orderId) {
  const o = OMS_STATE.orders.find(x => x.id === orderId);
  if (!o) return;

  if (typeof SHIPPING_ENGINE !== 'undefined') {
    SHIPPING_ENGINE.openShippingLabelModal({
      orderId: o.id,
      customerName: o.customer,
      customerPhone: o.telepon,
      customerAddress: o.alamat,
      items: o.items,
      courier: o.kurir,
      awb: o.resi !== '-' ? o.resi : null
    });
  } else {
    alert(`Mencetak resi ${o.resi} untuk ${o.customer}`);
  }
}

// Handler Kirim WhatsApp Resi
function kirimWaResi(orderId) {
  const o = OMS_STATE.orders.find(x => x.id === orderId);
  if (!o) return;

  if (typeof WA_GATEWAY !== 'undefined') {
    WA_GATEWAY.sendD2COrderShipped({
      customerName: o.customer,
      customerPhone: o.telepon,
      orderNumber: o.id,
      courier: o.kurir,
      awbNumber: o.resi,
      items: o.items
    }).then(res => {
      if (typeof toast === 'function') toast(`✅ WhatsApp resi terkirim ke ${o.customer}!`, 'ok');
      if (res && res.waLink) window.open(res.waLink, '_blank');
    });
  }
}

// Handler Cek Tarif
async function cekTarifEkspedisi() {
  const dest = document.getElementById('ship-dest')?.value || 'Jakarta';
  const weight = Number(document.getElementById('ship-weight')?.value || 500);
  const container = document.getElementById('ship-results');
  if (!container) return;

  container.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;
  
  if (typeof SHIPPING_ENGINE !== 'undefined') {
    const rates = await SHIPPING_ENGINE.calculateRates({ destinationCity: dest, weightGram: weight });
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; margin-top:10px;">
        ${rates.map(r => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; font-size:12px;">
            <span>${r.logo} <b>${r.courier}</b> (${r.etd})</span>
            <strong style="color:var(--teal);">Rp ${r.cost.toLocaleString('id-ID')}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Modal Tambah Pesanan
function openTambahPesananModal() {
  const modalHtml = `
    <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
      <div class="modal-title" style="font-size:16px; font-weight:800;">+ Buat Pesanan D2C Baru</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-group">
        <label>Saluran Channel</label>
        <select id="modal-ord-channel" class="input">
          <option value="Web D2C AVA">Web D2C AVA</option>
          <option value="TikTok Shop">TikTok Shop</option>
          <option value="Shopee Mall">Shopee Mall</option>
          <option value="Tokopedia">Tokopedia</option>
          <option value="WhatsApp Direct">WhatsApp Direct</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nama Pembeli</label>
        <input type="text" id="modal-ord-name" class="input" placeholder="Nama Lengkap">
      </div>
      <div class="form-group">
        <label>Nomor WhatsApp</label>
        <input type="text" id="modal-ord-phone" class="input" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Alamat Pengiriman</label>
        <textarea id="modal-ord-addr" class="input" rows="2" placeholder="Alamat lengkap tujuan"></textarea>
      </div>
      <div class="form-group">
        <label>Pilihan Produk</label>
        <select id="modal-ord-prod" class="input">
          <option value="Queen Royal Collagen Glow 15g (x2 Box)">Queen Royal Collagen Glow 15g (x2 Box) - Rp 578.000</option>
          <option value="Queen HerBalance Elixir 30mL (x1 Box)">Queen HerBalance Elixir 30mL (x1 Box) - Rp 289.000</option>
          <option value="Ultimate Longevity Set (Bundle 3in1)">Ultimate Longevity Set (Bundle 3in1) - Rp 649.000</option>
        </select>
      </div>
      <div class="modal-footer" style="margin-top:10px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
        <button class="btn btn-teal" onclick="simpanPesananBaru()">💾 Simpan &amp; Generate AWB</button>
      </div>
    </div>
  `;
  if (typeof openModal === 'function') openModal(modalHtml, 'medium');
}

function simpanPesananBaru() {
  const name = document.getElementById('modal-ord-name')?.value;
  const phone = document.getElementById('modal-ord-phone')?.value;
  const channel = document.getElementById('modal-ord-channel')?.value;
  const addr = document.getElementById('modal-ord-addr')?.value;
  const prod = document.getElementById('modal-ord-prod')?.value;

  if (!name || !phone) {
    if (typeof toast === 'function') toast('Nama dan nomor WA wajib diisi', 'err');
    return;
  }

  const newOrder = {
    id: 'ORD-2026-' + Math.floor(1000 + Math.random() * 9000),
    channel: channel || 'Web D2C AVA',
    customer: name,
    telepon: phone,
    alamat: addr || 'Jakarta',
    items: prod,
    sku: 'Q-SKU-NEW',
    total: 578000,
    resi: typeof SHIPPING_ENGINE !== 'undefined' ? SHIPPING_ENGINE.generateAWB('SPX') : 'SPXID0299102',
    kurir: 'Shopee Xpress',
    status: 'Perlu Diproses',
    tgl: new Date().toISOString().slice(0,16).replace('T',' ')
  };

  OMS_STATE.orders.unshift(newOrder);
  if (typeof closeModalForce === 'function') closeModalForce();
  if (typeof toast === 'function') toast(`✅ Pesanan ${newOrder.id} berhasil dibuat!`, 'ok');
  renderEcommerceOms();
}

function openTambahApotekModal() {
  const modalHtml = `
    <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
      <div class="modal-title" style="font-size:16px; font-weight:800;">+ Tambah Mitra Apotek Konsinyasi</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-group">
        <label>Nama Apotek</label>
        <input type="text" id="modal-apt-name" class="input" placeholder="contoh: Apotek Kimia Farma Pondok Indah">
      </div>
      <div class="form-group">
        <label>Kota / Wilayah</label>
        <input type="text" id="modal-apt-city" class="input" placeholder="Jakarta Selatan">
      </div>
      <div class="form-group">
        <label>Nama Apoteker / PIC</label>
        <input type="text" id="modal-apt-pic" class="input" placeholder="apt. Sarah, S.Farm">
      </div>
      <div class="form-group">
        <label>Jumlah Stok Dititipkan (Box)</label>
        <input type="number" id="modal-apt-stock" class="input" value="50">
      </div>
      <div class="modal-footer" style="margin-top:10px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
        <button class="btn btn-teal" onclick="simpanApotekBaru()">💾 Simpan Konsinyasi</button>
      </div>
    </div>
  `;
  if (typeof openModal === 'function') openModal(modalHtml, 'medium');
}

function simpanApotekBaru() {
  const nama = document.getElementById('modal-apt-name')?.value;
  const kota = document.getElementById('modal-apt-city')?.value;
  const pic = document.getElementById('modal-apt-pic')?.value;
  const stok = Number(document.getElementById('modal-apt-stock')?.value || 50);

  if (!nama) {
    if (typeof toast === 'function') toast('Nama apotek wajib diisi', 'err');
    return;
  }

  OMS_STATE.apotekKonsinyasi.unshift({
    id: 'APT-' + String(OMS_STATE.apotekKonsinyasi.length + 1).padStart(2, '0'),
    nama,
    kota: kota || 'Jakarta',
    pic: pic || 'Apoteker Penanggung Jawab',
    telp: '0812-9900-1122',
    stok_titip: stok,
    terjual: 0,
    omset: 0,
    margin_apotek: 0,
    jatuh_tempo: new Date(Date.now() + 30*86400000).toISOString().slice(0,10),
    status: 'Baru'
  });

  if (typeof closeModalForce === 'function') closeModalForce();
  if (typeof toast === 'function') toast(`✅ Mitra apotek ${nama} berhasil ditambahkan!`, 'ok');
  renderEcommerceOms();
}

// ═══════════════════════════════════════════════════════════════
// CPOTB BPOM BATCH RECALL SIMULATOR (SLA < 2 Jam)
// ═══════════════════════════════════════════════════════════════
function simulateBatchRecall(batchNo) {
  const batch = OMS_STATE.batchStok.find(b => b.batchNo === batchNo) || {
    batchNo: batchNo || 'LOT-2026-07A',
    produk: 'Queen Royal Collagen Glow 15g',
    tglProduksi: '2026-07-01',
    tglExp: '2028-07-01',
    stokFisik: 4200
  };

  const distributedD2C = OMS_STATE.orders.filter(o => o.items.includes('Collagen') || o.sku.includes('Q-NUT-01'));
  const distributedApotek = OMS_STATE.apotekKonsinyasi.map(a => ({
    apotek_id: a.id,
    nama: a.nama,
    kota: a.kota,
    qty_titip: a.stok_titip,
    qty_terjual: a.terjual,
    qty_sisa: a.stok_titip - a.terjual,
    pic_kontak: `${a.pic} (${a.telp})`
  }));

  const totalSoldApotek = distributedApotek.reduce((s, a) => s + a.qty_terjual, 0);
  const totalInApotek = distributedApotek.reduce((s, a) => s + a.qty_sisa, 0);
  const totalD2COrders = distributedD2C.length;

  return {
    batchNo: batch.batchNo,
    produk: batch.produk,
    tglProduksi: batch.tglProduksi,
    tglExp: batch.tglExp,
    statusBPOM: 'SIMULATION_ACTIVE',
    sla_trace_minutes: 15,
    summary: {
      gudang_pusat_quarantined: batch.stokFisik,
      apotek_channel_quarantined: totalInApotek,
      consumer_distributed: totalSoldApotek + totalD2COrders,
      total_batch_volume: batch.stokFisik + totalInApotek + totalSoldApotek + totalD2COrders
    },
    action_plan: [
      '1. Karantina fisik seketika di Gudang Pusat AVA Nutrition (Status: LOCKED)',
      '2. Broadcast WA & Email penarikan ke seluruh APOTEK mitra konsinyasi',
      '3. Hubungi konsumen D2C terdampak untuk penukaran produk batch baru (Replacement Guarantee)',
      '4. Terbitkan Laporan Investigasi CAPA (Corrective and Preventive Action) ke BPOM RI'
    ],
    distributedApotek,
    distributedD2C
  };
}

window.renderEcommerceOms = renderEcommerceOms;
window.gantiTabOms = gantiTabOms;
window.cetakResiThermal = cetakResiThermal;
window.kirimWaResi = kirimWaResi;
window.cekTarifEkspedisi = cekTarifEkspedisi;
window.openTambahPesananModal = openTambahPesananModal;
window.simpanPesananBaru = simpanPesananBaru;
window.openTambahApotekModal = openTambahApotekModal;
window.simpanApotekBaru = simpanApotekBaru;
window.simulateBatchRecall = simulateBatchRecall;
