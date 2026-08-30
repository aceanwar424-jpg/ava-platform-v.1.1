// ═══════════════════════════════════════════════════════════════
// MODUL: Langganan & Auto-Refill
//
// Versi sebelumnya tidak punya panggilan data: daftar pelanggan
// langganan, tanggal kirim, dan nilai berlangganan ditulis tangan.
//
// Sekarang membaca wellness_langganan, wellness_langganan_item, dan
// view wellness_langganan_jatuh_tempo (migrasi 0035).
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Pesanan TIDAK dibuat otomatis saat jatuh tempo. Pengiriman rutin yang
// berjalan tanpa ada yang menengok adalah cara tercepat mengirim barang
// ke alamat lama, ke pelanggan yang sudah minta berhenti, atau untuk
// produk yang stoknya kosong. Yang dilakukan layar ini adalah menyodorkan
// daftar yang jatuh tempo untuk dijalankan petugas.
//
// Tanggal kirim berikutnya baru maju SESUDAH pesanan berhasil dibuat,
// bukan sebelumnya. Memajukan lebih dulu berarti siklus yang gagal
// terlewat diam-diam.
//
// Prefiks "sb" dipakai helper global, jadi modul ini memakai "lg".
// ═══════════════════════════════════════════════════════════════

let lgData = null;
let lgTab = 'jatuhtempo';

function lgEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function lgRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function lgTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function lgMuat() {
  if (typeof sbGet !== 'function') { lgData = null; return; }
  try {
    const [semua, tempo, item, produk] = await Promise.all([
      sbGet('wellness_langganan', 'select=*&order=tgl_kirim_berikut'),
      sbGet('wellness_langganan_jatuh_tempo', 'select=*'),
      sbGet('wellness_langganan_item', 'select=*'),
      sbGet('wellness_produk', 'select=id,sku,nama,harga_normal').catch(() => []),
    ]);
    lgData = { semua, tempo, item, produk };
  } catch (e) { lgData = null; }
}

async function renderSubscription() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await lgMuat();

  if (lgData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Langganan &amp; Auto-Refill</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data langganan tidak dapat dibaca.</strong><br>
        Tabel <code>wellness_langganan</code> belum ada — jalankan ulang
        aplikasi agar migrasi <code>0035_wellness_pesanan_d2c.sql</code>
        terpasang.
      </div>`;
    return;
  }
  lgGambar();
}

function lgProduk(id) {
  return (lgData.produk || []).find(p => p.id === id) || {};
}
function lgItemOf(langgananId) {
  return (lgData.item || []).filter(i => i.langganan_id === langgananId);
}

function lgGambar() {
  const S = lgData.semua || [];
  const T = lgData.tempo || [];
  const aktif = S.filter(x => x.status === 'Aktif');
  const jeda = S.filter(x => x.status === 'Jeda');
  const berhenti = S.filter(x => x.status === 'Berhenti');
  const telat = T.filter(x => Number(x.telat_hari) > 0);

  const nilaiBulanan = aktif.reduce((a, x) => {
    const per = Number(x.harga_per_siklus || 0);
    const hari = Number(x.interval_hari || 30) || 30;
    return a + per * (30 / hari);
  }, 0);

  const daftar = lgTab === 'jatuhtempo' ? T
               : lgTab === 'aktif' ? aktif
               : lgTab === 'jeda' ? jeda : berhenti;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Langganan &amp; Auto-Refill</h1>
        <p class="muted">Pengiriman rutin produk wellness ke pelanggan tetap.</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
                gap:12px; margin-bottom:16px">
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Langganan aktif</div>
        <div style="font-size:22px; font-weight:800">${aktif.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Jatuh tempo ≤3 hari</div>
        <div style="font-size:22px; font-weight:800;
                    color:${T.length ? 'var(--warning)' : 'var(--text3)'}">${T.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Terlambat kirim</div>
        <div style="font-size:22px; font-weight:800;
                    color:${telat.length ? 'var(--danger)' : 'var(--text3)'}">${telat.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Perkiraan nilai / bulan</div>
        <div style="font-size:19px; font-weight:800">${lgRp(Math.round(nilaiBulanan))}</div>
      </div>
    </div>

    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Pesanan <b>tidak dibuat otomatis</b>. Pengiriman rutin yang berjalan
      tanpa ada yang menengok adalah cara tercepat mengirim barang ke
      alamat lama, ke pelanggan yang sudah minta berhenti, atau untuk
      produk yang stoknya kosong. Tanggal kirim berikutnya baru maju
      sesudah pesanan berhasil dibuat.
    </div>

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${lgTab === 'jatuhtempo' ? 'active' : ''}"
              onclick="lgGantiTab('jatuhtempo')">Jatuh Tempo (${T.length})</button>
      <button class="tab ${lgTab === 'aktif' ? 'active' : ''}"
              onclick="lgGantiTab('aktif')">Aktif (${aktif.length})</button>
      <button class="tab ${lgTab === 'jeda' ? 'active' : ''}"
              onclick="lgGantiTab('jeda')">Dijeda (${jeda.length})</button>
      <button class="tab ${lgTab === 'berhenti' ? 'active' : ''}"
              onclick="lgGantiTab('berhenti')">Berhenti (${berhenti.length})</button>
    </div>

    ${!daftar.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🔁</div>
        <div style="font-weight:700">${
          lgTab === 'jatuhtempo' ? 'Tidak ada langganan yang jatuh tempo'
          : 'Tidak ada langganan pada kelompok ini'}</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Kode</th><th>Pelanggan</th><th>Kota</th><th>Isi Paket</th>
          <th style="text-align:right">Interval</th>
          <th>Kirim Berikutnya</th>
          <th style="text-align:right">Nilai</th><th>Status</th><th></th>
        </tr></thead><tbody>
        ${daftar.map(l => {
          const isi = lgItemOf(l.id);
          const telatHari = Number(l.telat_hari);
          return `<tr>
            <td><b>${lgEsc(l.kode || '—')}</b></td>
            <td>${lgEsc(l.pelanggan_nama || '—')}
              ${l.pelanggan_hp ? `<div style="font-size:11px; color:var(--text3)">
                ${lgEsc(l.pelanggan_hp)}</div>` : ''}</td>
            <td>${lgEsc(l.kota || '—')}</td>
            <td style="font-size:12px">${isi.length
              ? isi.map(i => `${lgEsc(lgProduk(i.produk_id).nama || '—')} ×${i.qty}`).join(', ')
              : '<span style="color:var(--warning)">belum diisi</span>'}</td>
            <td style="text-align:right">${l.interval_hari || 30} hari</td>
            <td>${lgTgl(l.tgl_kirim_berikut)}
              ${telatHari > 0 ? `<div style="font-size:11px; color:var(--danger)">
                telat ${telatHari} hari</div>` : ''}</td>
            <td style="text-align:right">${lgRp(l.harga_per_siklus)}</td>
            <td>${lgEsc(l.status)}</td>
            <td style="white-space:nowrap">
              ${l.status === 'Aktif' && isi.length
                ? `<button class="btn btn-sm btn-primary" onclick="lgBuatPesanan(${l.id})">
                     Buat Pesanan</button>` : ''}
              ${l.status === 'Aktif'
                ? `<button class="btn btn-sm" onclick="lgUbahStatus(${l.id},'Jeda')">
                     Jeda</button>` : ''}
              ${l.status === 'Jeda'
                ? `<button class="btn btn-sm" onclick="lgUbahStatus(${l.id},'Aktif')">
                     Aktifkan</button>` : ''}
              ${l.status !== 'Berhenti'
                ? `<button class="btn btn-sm" onclick="lgBerhenti(${l.id})">
                     Berhenti</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}`;
}

function lgGantiTab(t) { lgTab = t; lgGambar(); }

async function lgBuatPesanan(langgananId) {
  const l = (lgData.semua || []).find(x => x.id === langgananId)
         || (lgData.tempo || []).find(x => x.id === langgananId);
  const isi = lgItemOf(langgananId);
  if (!l || !isi.length) { alert('Isi paket langganan belum ditetapkan.'); return; }

  const rincian = isi.map(i =>
    `${lgProduk(i.produk_id).nama || '—'} ×${i.qty}`).join('\n');
  if (!confirm(`Buat pesanan untuk ${l.pelanggan_nama}?\n\n${rincian}\n\n`
    + `Kirim ke: ${l.alamat || '(alamat belum diisi)'}`)) return;

  try {
    const r = await sbRpc('wellness_buat_pesanan', {
      p_data: {
        kanal: 'web',
        pembeli_nama: l.pelanggan_nama,
        pembeli_hp: l.pelanggan_hp,
        pembeli_email: l.pelanggan_email,
        alamat: l.alamat, kota: l.kota,
        langganan_id: String(langgananId),
        catatan: 'Pengiriman rutin langganan ' + (l.kode || ''),
        item: isi.map(i => ({ produk_id: i.produk_id, qty: i.qty })),
      },
    });
    if (r && r.error) { alert(r.error); return; }

    // Tanggal kirim berikutnya baru maju SESUDAH pesanan tersimpan.
    const dasar = l.tgl_kirim_berikut ? new Date(l.tgl_kirim_berikut) : new Date();
    dasar.setDate(dasar.getDate() + (Number(l.interval_hari) || 30));
    await sbPatch('wellness_langganan', langgananId, {
      tgl_kirim_berikut: dasar.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    });

    alert(`Pesanan ${r.no_pesanan} dibuat. Kirim berikutnya: `
      + dasar.toISOString().slice(0, 10) + '.');
    await renderSubscription();
  } catch (e) { alert('Gagal membuat pesanan: ' + e.message); }
}

async function lgUbahStatus(id, status) {
  try {
    await sbPatch('wellness_langganan', id,
      { status, updated_at: new Date().toISOString() });
    await renderSubscription();
  } catch (e) { alert('Gagal mengubah status: ' + e.message); }
}

async function lgBerhenti(id) {
  const alasan = prompt('Alasan berhenti berlangganan:');
  if (alasan === null) return;
  try {
    await sbPatch('wellness_langganan', id, {
      status: 'Berhenti', alasan_berhenti: alasan || null,
      updated_at: new Date().toISOString(),
    });
    await renderSubscription();
  } catch (e) { alert('Gagal menghentikan langganan: ' + e.message); }
}

window.renderSubscription = renderSubscription;
window.lgGantiTab    = lgGantiTab;
window.lgBuatPesanan = lgBuatPesanan;
window.lgUbahStatus  = lgUbahStatus;
window.lgBerhenti    = lgBerhenti;
