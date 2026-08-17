// ═══════════════════════════════════════════════════════════════
// MODULE: Penawaran Harga (Quotation)
//
// Audit ulang menemukan rantai penjualan putus: dari deal LANGSUNG ke
// invoice, tanpa satu pun tabel atau layar penawaran. Padahal untuk jualan
// B2B ke klinik dan korporat, penawaran harga justru dokumen intinya —
// yang dikirim, dinegosiasikan, lalu jadi dasar kontrak.
//
//   Lead → Deal → [PENAWARAN] → Invoice
//
// ── Dua hal yang sengaja dijaga ketat ─────────────────────────
// 1. Harga DIBEKUKAN saat baris ditambahkan. Katalog berubah sewaktu-waktu;
//    penawaran yang sudah dikirim tidak boleh ikut berubah nilainya.
// 2. Konversi ke invoice hanya dari status "Diterima", dan hanya SEKALI.
//    Penawaran yang ganda menjadi dua tagihan adalah kesalahan mahal dan
//    sulit ditelusuri kemudian.
//
// Prefiks "pnw" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let pnwDaftar = [];
let pnwAktif = null;          // penawaran yang sedang dibuka
let pnwBaris = [];
let pnwKatalog = [];
let pnwFilter = 'semua';

const pnwRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const PNW_STATUS = {
  Draft:       'var(--text3)',
  Terkirim:    'var(--info)',
  Diterima:    'var(--success-strong)',
  Ditolak:     'var(--danger-strong)',
  Kedaluwarsa: 'var(--warn-deep)',
};

async function renderPenawaran() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Penawaran Harga</h1>
        <p style="color:var(--text3);font-size:13px">
          Dokumen penawaran ke klinik dan korporat — dari draft sampai jadi invoice</p></div>
      <div class="btn-row">
        <button class="btn btn-teal btn-sm" onclick="pnwBaru()">+ Penawaran Baru</button>
      </div>
    </div>
    <div id="pnw-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await pnwMuat();
  pnwGambar();
}

async function pnwMuat() {
  try {
    pnwDaftar = await sbGet('quotations', 'select=*&order=created_at.desc&limit=200') || [];
    if (!Array.isArray(pnwDaftar)) pnwDaftar = [];
  } catch (e) { pnwDaftar = []; }
}

function pnwGambar() {
  const el = document.getElementById('pnw-isi');
  if (!el) return;

  const rows = pnwFilter === 'semua' ? pnwDaftar : pnwDaftar.filter(q => q.status === pnwFilter);
  const nilai = (st) => pnwDaftar.filter(q => q.status === st).reduce((s, q) => s + Number(q.total || 0), 0);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px">
      ${[['Total penawaran', pnwDaftar.length + ' dokumen', 'var(--navy)'],
         ['Menunggu jawaban', pnwRp(nilai('Terkirim')), 'var(--info)'],
         ['Diterima', pnwRp(nilai('Diterima')), 'var(--success-strong)'],
         ['Ditolak', pnwRp(nilai('Ditolak')), 'var(--danger-strong)']]
        .map(([l, v, c]) => `<div class="card" style="padding:13px">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${l}</div>
          <div style="font-size:17px;font-weight:800;color:${c};margin-top:3px">${v}</div></div>`).join('')}
    </div>

    <div style="display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap">
      ${['semua', ...Object.keys(PNW_STATUS)].map(s => `
        <button class="btn btn-sm ${pnwFilter === s ? 'btn-teal' : 'btn-ghost'}"
          onclick="pnwSaring('${s}')">${s === 'semua' ? 'Semua' : s}</button>`).join('')}
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      ${rows.length ? `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="color:var(--text3);text-align:left">
            <th style="padding:10px 16px">Nomor</th><th>Pelanggan</th><th>Judul</th>
            <th>Berlaku s/d</th><th style="text-align:right">Total</th>
            <th>Status</th><th style="padding-right:16px">Aksi</th></tr></thead>
          <tbody>${rows.map(q => {
            const kadaluwarsa = q.berlaku_sampai && new Date(q.berlaku_sampai) < new Date()
                                && !['Diterima','Ditolak'].includes(q.status);
            return `<tr style="border-top:1px solid var(--border)">
              <td style="padding:10px 16px;font-family:monospace">${q.nomor || '—'}</td>
              <td>${q.partner_name || '—'}</td>
              <td style="color:var(--text3)">${q.judul || '—'}</td>
              <td style="color:${kadaluwarsa ? 'var(--danger-strong)' : 'var(--text3)'}">
                ${q.berlaku_sampai || '—'}${kadaluwarsa ? ' (lewat)' : ''}</td>
              <td style="text-align:right;font-weight:700">${pnwRp(q.total)}</td>
              <td><span class="badge" style="color:${PNW_STATUS[q.status] || 'var(--text3)'}">${q.status}</span>
                  ${q.invoice_id ? '<span style="font-size:10px;color:var(--success-deep)"> · jadi invoice</span>' : ''}</td>
              <td style="padding-right:16px"><button class="btn btn-ghost btn-sm"
                    onclick="pnwBuka(${q.id})">Buka</button></td>
            </tr>`; }).join('')}</tbody></table></div>`
        : `<div style="padding:26px;text-align:center;color:var(--text3);font-size:12.5px">
             ${pnwFilter === 'semua' ? 'Belum ada penawaran. Klik "+ Penawaran Baru" untuk membuat yang pertama.'
                                     : 'Tidak ada penawaran berstatus ' + pnwFilter + '.'}</div>`}
    </div>`;
}

function pnwSaring(s) { pnwFilter = s; pnwGambar(); }

async function pnwBaru() {
  let nomor = '';
  try { nomor = await sbRpc('quotation_nomor_baru', {}); } catch (e) {}
  openModal(`
    <h3 style="margin:0 0 4px">Penawaran Baru</h3>
    <p style="font-size:12px;color:var(--text3);margin:0 0 16px">Nomor otomatis: <b>${nomor || '—'}</b></p>
    <div class="input-group"><label>Nama Pelanggan</label>
      <input id="pnw-partner" placeholder="mis. Klinik Melati"></div>
    <div class="input-group"><label>Judul Penawaran</label>
      <input id="pnw-judul" placeholder="mis. Paket MCU Karyawan 2026"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>Berlaku sampai</label>
        <input type="date" id="pnw-berlaku" value="${new Date(Date.now()+30*864e5).toISOString().slice(0,10)}"></div>
      <div class="input-group"><label>Jenis harga</label>
        <select id="pnw-jenis"><option value="korporat">Harga korporat</option>
          <option value="normal">Harga normal</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>Diskon (%)</label><input type="number" id="pnw-diskon" value="0" min="0" max="100"></div>
      <div class="input-group"><label>PPN (%)</label><input type="number" id="pnw-ppn" value="0" min="0" max="100"></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-close" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-primary" style="margin-top:0" onclick="pnwSimpanBaru('${nomor}')">Buat</button>
    </div>`);
}

async function pnwSimpanBaru(nomor) {
  const partner = document.getElementById('pnw-partner')?.value.trim();
  if (!partner) { toast('Nama pelanggan wajib diisi', 'warn'); return; }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/quotations`, {
      method: 'POST', headers: SB_HEADERS,
      body: JSON.stringify({
        nomor: nomor || null, partner_name: partner,
        judul: document.getElementById('pnw-judul')?.value.trim() || null,
        berlaku_sampai: document.getElementById('pnw-berlaku')?.value || null,
        jenis_harga: document.getElementById('pnw-jenis')?.value || 'korporat',
        diskon_persen: parseFloat(document.getElementById('pnw-diskon')?.value) || 0,
        ppn_persen: parseFloat(document.getElementById('pnw-ppn')?.value) || 0,
        dibuat_oleh: (window.currentUser && window.currentUser.email) || null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const baru = (await res.json())[0];
    closeModalForce();
    toast('Penawaran dibuat', 'ok');
    await pnwMuat();
    pnwBuka(baru.id);
  } catch (e) { toast('Gagal membuat penawaran: ' + e.message, 'err'); }
}

async function pnwBuka(id) {
  pnwAktif = pnwDaftar.find(q => q.id === id) || null;
  if (!pnwAktif) { await pnwMuat(); pnwAktif = pnwDaftar.find(q => q.id === id); }
  if (!pnwAktif) return;
  try {
    pnwBaris = await sbGet('quotation_items', `quotation_id=eq.${id}&select=*&order=urutan`) || [];
    if (!Array.isArray(pnwBaris)) pnwBaris = [];
  } catch (e) { pnwBaris = []; }
  pnwGambarDetail();
}

function pnwGambarDetail() {
  const q = pnwAktif;
  const terkunci = !!q.invoice_id || ['Diterima', 'Ditolak'].includes(q.status);
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>${q.nomor || 'Penawaran'}</h1>
        <p style="color:var(--text3);font-size:13px">${q.partner_name || ''} · ${q.judul || ''}</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderPenawaran()">← Daftar</button>
        ${!terkunci ? `<button class="btn btn-ghost btn-sm" onclick="pnwTambahBaris()">+ Tambah Item</button>` : ''}
        ${pnwTombolStatus(q)}
      </div>
    </div>

    ${terkunci ? `<div class="card" style="padding:11px 14px;margin-bottom:12px;
        background:var(--warn-soft);border-color:var(--gold);font-size:12.5px">
        Penawaran terkunci karena berstatus <b>${q.status}</b>${q.invoice_id ? ' dan sudah menjadi invoice' : ''}.
        Isinya tidak bisa diubah lagi — dokumen yang sudah disepakati harus tetap sebagaimana disepakati.
      </div>` : ''}

    <div class="card" style="padding:0;overflow:hidden;margin-bottom:14px">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
        Rincian Item <span style="font-weight:400;color:var(--text3);font-size:11.5px">
        · harga dibekukan saat item ditambahkan</span></div>
      ${pnwBaris.length ? `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="color:var(--text3);text-align:left">
          <th style="padding:9px 16px">Kode</th><th>Pemeriksaan</th>
          <th style="text-align:right">Qty</th><th style="text-align:right">Harga</th>
          <th style="text-align:right">Jumlah</th>${terkunci ? '' : '<th style="padding-right:16px"></th>'}</tr></thead>
        <tbody>${pnwBaris.map(b => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:9px 16px;font-family:monospace">${b.kode || '—'}</td>
          <td>${b.nama}</td>
          <td style="text-align:right">${b.qty}</td>
          <td style="text-align:right">${pnwRp(b.harga)}</td>
          <td style="text-align:right;font-weight:700">${pnwRp(b.jumlah)}</td>
          ${terkunci ? '' : `<td style="padding-right:16px;text-align:right">
            <button class="act-btn del" onclick="pnwHapusBaris(${b.id})">✕</button></td>`}
        </tr>`).join('')}</tbody></table>`
        : `<div style="padding:22px;text-align:center;color:var(--text3);font-size:12.5px">
             Belum ada item. Klik "+ Tambah Item" untuk memilih dari katalog.</div>`}
    </div>

    <div class="card" style="padding:16px;max-width:380px;margin-left:auto">
      ${[['Subtotal', pnwRp(q.subtotal)],
         [`Diskon ${q.diskon_persen || 0}%`, '− ' + pnwRp((q.subtotal || 0) * (q.diskon_persen || 0) / 100)],
         [`PPN ${q.ppn_persen || 0}%`, '+ ' + pnwRp(((q.subtotal || 0) - (q.subtotal || 0) * (q.diskon_persen || 0) / 100) * (q.ppn_persen || 0) / 100)]]
        .map(([l, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px">
          <span style="color:var(--text3)">${l}</span><span>${v}</span></div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:10px 0 0;border-top:1px solid var(--border);
                  margin-top:6px;font-size:15px;font-weight:800">
        <span>Total</span><span style="color:var(--teal)">${pnwRp(q.total)}</span></div>
    </div>`;
}

function pnwTombolStatus(q) {
  if (q.invoice_id) return `<span class="badge" style="color:var(--success-deep)">Sudah jadi invoice</span>`;
  if (q.status === 'Draft')    return `<button class="btn btn-teal btn-sm" onclick="pnwUbahStatus('Terkirim')">Tandai Terkirim</button>`;
  if (q.status === 'Terkirim') return `<button class="btn btn-teal btn-sm" onclick="pnwUbahStatus('Diterima')">Diterima</button>
    <button class="btn btn-ghost btn-sm" onclick="pnwUbahStatus('Ditolak')">Ditolak</button>`;
  if (q.status === 'Diterima') return `<button class="btn btn-teal btn-sm" onclick="pnwJadiInvoice()">Jadikan Invoice</button>`;
  return '';
}

async function pnwUbahStatus(status) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/quotations?id=eq.${pnwAktif.id}`, {
      method: 'PATCH', headers: SB_HEADERS, body: JSON.stringify({ status }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    toast('Status menjadi ' + status, 'ok');
    await pnwMuat(); await pnwBuka(pnwAktif.id);
  } catch (e) { toast('Gagal mengubah status: ' + e.message, 'err'); }
}

async function pnwJadiInvoice() {
  try {
    const r = await sbRpc('quotation_jadi_invoice', { p_id: pnwAktif.id });
    if (!r || !r.ok) { toast(r && r.error ? r.error : 'Gagal membuat invoice', 'err'); return; }
    toast(`Invoice ${r.nomor} dibuat`, 'ok');
    await pnwMuat(); await pnwBuka(pnwAktif.id);
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

async function pnwTambahBaris() {
  if (!pnwKatalog.length) {
    try {
      pnwKatalog = await sbGet('products',
        'select=id,kode_internal,nama_tes,harga_normal,harga_korporat&is_active=eq.true&order=nama_tes&limit=500') || [];
    } catch (e) { pnwKatalog = []; }
  }
  const korporat = (pnwAktif.jenis_harga || 'korporat') === 'korporat';
  openModal(`
    <h3 style="margin:0 0 4px">Tambah Item</h3>
    <p style="font-size:12px;color:var(--text3);margin:0 0 12px">
      Memakai <b>${korporat ? 'harga korporat' : 'harga normal'}</b> sesuai setelan penawaran ini.</p>
    <input id="pnw-cari" placeholder="Cari pemeriksaan..." oninput="pnwFilterKatalog()"
      style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px">
    <div id="pnw-katalog" style="max-height:320px;overflow:auto"></div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn btn-close" onclick="closeModalForce()">Tutup</button></div>`, 'lg');
  pnwFilterKatalog();
}

function pnwFilterKatalog() {
  const q = (document.getElementById('pnw-cari')?.value || '').toLowerCase();
  const korporat = (pnwAktif.jenis_harga || 'korporat') === 'korporat';
  const rows = pnwKatalog.filter(p => !q || (p.nama_tes || '').toLowerCase().includes(q)
                                     || (p.kode_internal || '').toLowerCase().includes(q)).slice(0, 80);
  const el = document.getElementById('pnw-katalog');
  if (!el) return;
  el.innerHTML = rows.length ? rows.map(p => {
    const harga = korporat ? (p.harga_korporat || p.harga_normal || 0) : (p.harga_normal || 0);
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;
              padding:8px 10px;border-bottom:1px solid var(--border)">
      <div style="min-width:0">
        <div style="font-size:12.5px;font-weight:600">${p.nama_tes}</div>
        <div style="font-size:11px;color:var(--text3);font-family:monospace">${p.kode_internal || ''}</div></div>
      <div style="display:flex;align-items:center;gap:8px;white-space:nowrap">
        <span style="font-size:12.5px;font-weight:700">${pnwRp(harga)}</span>
        <button class="btn btn-teal btn-sm" onclick="pnwPilihItem(${p.id},'${(p.kode_internal||'').replace(/'/g,"")}','${(p.nama_tes||'').replace(/'/g,"")}',${harga})">+</button>
      </div></div>`; }).join('')
    : `<div style="padding:18px;text-align:center;color:var(--text3);font-size:12.5px">Tidak ada yang cocok.</div>`;
}

async function pnwPilihItem(product_id, kode, nama, harga) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/quotation_items`, {
      method: 'POST', headers: SB_HEADERS,
      body: JSON.stringify({ quotation_id: pnwAktif.id, product_id, kode, nama,
                             qty: 1, harga, urutan: pnwBaris.length + 1 }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await sbRpc('quotation_hitung', { p_id: pnwAktif.id });
    toast(nama + ' ditambahkan', 'ok');
    await pnwMuat(); await pnwBuka(pnwAktif.id);
    if (document.getElementById('pnw-katalog')) pnwTambahBaris();
  } catch (e) { toast('Gagal menambah item: ' + e.message, 'err'); }
}

async function pnwHapusBaris(id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/quotation_items?id=eq.${id}`,
      { method: 'DELETE', headers: SB_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await sbRpc('quotation_hitung', { p_id: pnwAktif.id });
    await pnwMuat(); await pnwBuka(pnwAktif.id);
  } catch (e) { toast('Gagal menghapus: ' + e.message, 'err'); }
}

window.renderPenawaran = renderPenawaran;
window.pnwSaring = pnwSaring;
window.pnwBaru = pnwBaru;
window.pnwSimpanBaru = pnwSimpanBaru;
window.pnwBuka = pnwBuka;
window.pnwTambahBaris = pnwTambahBaris;
window.pnwFilterKatalog = pnwFilterKatalog;
window.pnwPilihItem = pnwPilihItem;
window.pnwHapusBaris = pnwHapusBaris;
window.pnwUbahStatus = pnwUbahStatus;
window.pnwJadiInvoice = pnwJadiInvoice;
