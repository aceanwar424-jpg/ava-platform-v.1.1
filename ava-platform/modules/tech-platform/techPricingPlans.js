// ═══════════════════════════════════════════════════════════════
// MODUL: AVA Tech — Paket & Harga Berlangganan
//
// Versi sebelumnya tidak punya panggilan data: paket, harga, dan batas
// pemakaian ditulis tangan. Harga karangan di layar penjualan adalah
// harga yang bisa terlanjur disebutkan ke calon klien.
//
// Sekarang membaca public.tech_paket (migrasi 0039).
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Batas pemakaian membedakan NULL dari 0. NULL berarti tanpa batas,
// 0 berarti fitur itu tidak termasuk sama sekali. Menampilkan keduanya
// sebagai "0" adalah salah satu cara termudah menjual sesuatu yang tidak
// diberikan.
//
// Harga tahunan ditampilkan bersama hematnya dibanding 12× bulanan.
// Kalau ternyata tidak lebih hemat, itu ikut terlihat — bukan
// disembunyikan.
//
// Prefiks "tp".
// ═══════════════════════════════════════════════════════════════

let tpData = null;

function tpEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function tpRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

// NULL = tanpa batas, 0 = tidak termasuk. Keduanya bukan hal yang sama.
function tpBatas(v, satuan) {
  if (v === null || v === undefined) return 'tanpa batas';
  if (Number(v) === 0) return '<span style="color:var(--text3)">tidak termasuk</span>';
  return Number(v).toLocaleString('id-ID') + (satuan ? ' ' + satuan : '');
}

async function tpMuat() {
  if (typeof sbGet !== 'function') { tpData = null; return; }
  try {
    const [paket, lisensi] = await Promise.all([
      sbGet('tech_paket', 'select=*&order=urutan_tampil,harga_bulanan'),
      sbGet('tech_papan_lisensi', 'select=*').catch(() => []),
    ]);
    tpData = { paket, lisensi };
  } catch (e) { tpData = null; }
}

async function renderTechPricingPlans() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await tpMuat();

  if (tpData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Paket &amp; Harga</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data paket tidak dapat dibaca.</strong><br>
        Tabel <code>tech_paket</code> belum ada — jalankan ulang aplikasi
        agar migrasi
        <code>0039_tech_lisensi_harga_order_terintegrasi.sql</code> terpasang.
      </div>`;
    return;
  }
  tpGambar();
}

function tpGambar() {
  const P = tpData.paket || [];
  const L = tpData.lisensi || [];
  const dipakai = id => L.filter(x => x.paket_kode
    && (P.find(p => p.id === id) || {}).kode === x.paket_kode
    && x.status === 'Aktif').length;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Paket &amp; Harga</h1>
        <p class="muted">Paket berlangganan yang dijual AVA Tech beserta batas pemakaiannya.</p>
      </div>
      ${P.length ? `<div><button class="btn btn-primary" onclick="tpTambah()">
        + Paket Baru</button></div>` : ''}
    </div>

    ${!P.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">💠</div>
        <div style="font-weight:700; margin-bottom:6px">Belum ada paket ditetapkan</div>
        <div style="font-size:13px; color:var(--text3); max-width:460px; margin:0 auto 14px">
          Tetapkan paket beserta harga dan batas pemakaiannya sebelum
          menerbitkan lisensi untuk klien.</div>
        <button class="btn btn-primary" onclick="tpTambah()">+ Tetapkan Paket</button>
      </div>` : `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
                  gap:14px">
        ${P.map(p => {
          const bln = Number(p.harga_bulanan || 0);
          const thn = Number(p.harga_tahunan || 0);
          const hemat = (bln && thn) ? Math.round((1 - thn / (bln * 12)) * 100) : null;
          const modul = Array.isArray(p.modul_termasuk) ? p.modul_termasuk : [];
          const n = dipakai(p.id);
          return `<div class="card" style="padding:18px;
                    ${p.status !== 'Aktif' ? 'opacity:.6' : ''}">
            <div style="display:flex; justify-content:space-between; gap:8px">
              <div>
                <div style="font-weight:800; font-size:15px">${tpEsc(p.nama)}</div>
                <div style="font-size:11px; color:var(--text3)">
                  ${tpEsc(p.kode)}${p.untuk ? ' · untuk ' + tpEsc(p.untuk) : ''}</div>
              </div>
              ${p.status !== 'Aktif'
                ? `<span class="badge">${tpEsc(p.status)}</span>` : ''}
            </div>

            <div style="margin:14px 0 4px; font-size:24px; font-weight:800; color:var(--primary)">
              ${tpRp(bln)}<span style="font-size:12px; font-weight:400;
                                       color:var(--text3)"> /bulan</span></div>
            ${thn ? `<div style="font-size:12px; color:var(--text3)">
              ${tpRp(thn)} /tahun
              ${hemat !== null
                ? (hemat > 0
                    ? `<span style="color:var(--success)"> — hemat ${hemat}%</span>`
                    : `<span style="color:var(--warning)"> — tidak lebih hemat dari bulanan</span>`)
                : ''}</div>` : ''}

            <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border);
                        font-size:12px; line-height:1.9">
              Pengguna: <b>${tpBatas(p.batas_pengguna, 'akun')}</b><br>
              Transaksi: <b>${tpBatas(p.batas_transaksi_bln, '/bulan')}</b><br>
              Penyimpanan: <b>${tpBatas(p.batas_penyimpanan_gb, 'GB')}</b>
            </div>

            ${modul.length ? `
              <div style="margin-top:10px; font-size:11px; color:var(--text3)">
                Modul: ${modul.map(m => tpEsc(m)).join(', ')}</div>` : ''}
            ${p.keterangan ? `<div style="margin-top:8px; font-size:11px; color:var(--text3)">
              ${tpEsc(p.keterangan)}</div>` : ''}

            <div style="margin-top:12px; font-size:11px; color:var(--text3)">
              ${n ? `<b>${n}</b> lisensi aktif memakai paket ini`
                  : 'belum ada lisensi aktif'}</div>
          </div>`;
        }).join('')}
      </div>

      <div class="card" style="padding:12px 16px; margin-top:14px; font-size:12px;
                               color:var(--text3); line-height:1.7">
        Batas pemakaian membedakan <b>tanpa batas</b> dari <b>tidak
        termasuk</b>. Keduanya sering ditulis sebagai "0" di daftar harga,
        dan itu salah satu cara termudah menjual sesuatu yang tidak
        diberikan.
      </div>`}`;
}

async function tpTambah() {
  const kode = prompt('Kode paket (mis. PRO):');
  if (!kode) return;
  const nama = prompt('Nama paket:');
  if (!nama) return;
  const untuk = prompt('Untuk jenis usaha (klinik / lab / wellness / suite):', 'klinik');
  if (untuk === null) return;
  const bln = prompt('Harga per bulan (Rp):', '0');
  if (bln === null) return;
  const thn = prompt('Harga per tahun (Rp, kosongkan bila tidak dijual tahunan):', '');
  if (thn === null) return;
  const pengguna = prompt('Batas jumlah pengguna\n'
    + '(kosongkan = tanpa batas, isi 0 = tidak termasuk):', '');
  if (pengguna === null) return;
  const trx = prompt('Batas transaksi per bulan\n'
    + '(kosongkan = tanpa batas, isi 0 = tidak termasuk):', '');
  if (trx === null) return;
  const gb = prompt('Batas penyimpanan (GB)\n'
    + '(kosongkan = tanpa batas, isi 0 = tidak termasuk):', '');
  if (gb === null) return;

  try {
    await sbPost('tech_paket', {
      kode: kode.trim().toUpperCase(), nama: nama.trim(),
      untuk: untuk || null,
      harga_bulanan: parseFloat(bln) || 0,
      harga_tahunan: thn === '' ? 0 : (parseFloat(thn) || 0),
      batas_pengguna: pengguna === '' ? null : parseInt(pengguna, 10),
      batas_transaksi_bln: trx === '' ? null : parseInt(trx, 10),
      batas_penyimpanan_gb: gb === '' ? null : parseFloat(gb),
    });
    await renderTechPricingPlans();
  } catch (e) { alert('Gagal menyimpan paket: ' + e.message); }
}

function calculateSubscriptionBilling(tier, ordersCount, cycle = 'MONTHLY') {
  const base_price = (tier === 'TIER-PRO') ? 5500000 : 2500000;
  const included = 5000;
  const overage_orders = Math.max(0, ordersCount - included);
  const overage_fee = overage_orders * 1000;
  const total_bill = base_price + overage_fee;
  return { base_price, overage_orders, total_bill };
}

window.renderTechPricingPlans = renderTechPricingPlans;
window.tpTambah = tpTambah;
window.calculateSubscriptionBilling = calculateSubscriptionBilling;
