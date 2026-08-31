// ═══════════════════════════════════════════════════════════════
// MODUL: Order Terintegrasi — satu permintaan lintas layanan
//
// Versi sebelumnya tidak punya panggilan data: katalog pemeriksaan dan
// daftar order ditulis tangan, termasuk harga dan kode LOINC.
//
// Sekarang membaca public.products (katalog tes yang sudah ada) dan
// order_terintegrasi / order_terintegrasi_item (migrasi 0039).
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Order ini INDUK, bukan pengganti. Lab tetap dikerjakan lewat
// lab_samples dan radiologi lewat radiology_orders; yang ditambahkan
// adalah satu tempat yang bisa menjawab "apa saja yang diminta untuk
// pasien ini, dan mana yang belum selesai". Menggantikannya berarti
// menulis ulang seluruh alur yang sudah berjalan.
//
// Harga tidak dikirim dari layar. Keranjang hanya mengirim product_id;
// harga diambil server dari master. Harga yang dikirim layar bisa
// disetel siapa saja lewat alat pengembang peramban.
//
// Status induk dihitung dari itemnya, tidak disetel terpisah. Dua angka
// yang harus dijaga sinkron secara manual selalu berakhir berbeda.
//
// Prefiks "io".
// ═══════════════════════════════════════════════════════════════

let ioData = null;
let ioTab = 'daftar';
let ioKeranjang = [];
let ioCari = '';

function ioEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ioRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function ioJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function ioMuat() {
  if (typeof sbGet !== 'function') { ioData = null; return; }
  try {
    const [papan, item, produk] = await Promise.all([
      sbGet('order_terintegrasi_papan', 'select=*&order=created_at.desc&limit=200'),
      sbGet('order_terintegrasi_item', 'select=*'),
      sbGet('products',
        'select=id,kode_internal,nama_tes,kategori,harga_normal,loinc_code&order=nama_tes'),
    ]);
    ioData = { papan, item, produk };
  } catch (e) { ioData = null; }
}

async function renderIntegratedOrders() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await ioMuat();

  if (ioData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Order Terintegrasi</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data order tidak dapat dibaca.</strong><br>
        Tabel <code>order_terintegrasi</code> belum ada — jalankan ulang
        aplikasi agar migrasi
        <code>0039_tech_lisensi_harga_order_terintegrasi.sql</code> terpasang.
      </div>`;
    return;
  }
  ioGambar();
}

function ioGambar() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Order Terintegrasi</h1>
        <p class="muted">Satu permintaan pemeriksaan lintas lab, radiologi, dan tindakan.</p>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${ioTab === 'daftar' ? 'active' : ''}"
              onclick="ioGantiTab('daftar')">Daftar Order</button>
      <button class="tab ${ioTab === 'baru' ? 'active' : ''}"
              onclick="ioGantiTab('baru')">Order Baru${
                ioKeranjang.length ? ` (${ioKeranjang.length})` : ''}</button>
    </div>

    ${ioTab === 'daftar' ? ioTabDaftar() : ioTabBaru()}`;
}

function ioGantiTab(t) { ioTab = t; ioGambar(); }

function ioTabDaftar() {
  const P = ioData.papan || [];
  if (!P.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📋</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada order tercatat</div>
      <div style="font-size:13px; color:var(--text3)">
        Buat order baru untuk meminta pemeriksaan lintas layanan sekaligus.</div>
    </div>`;
  }

  const warna = {
    'Draf': 'var(--text3)', 'Dikirim': 'var(--info)',
    'Sebagian Selesai': 'var(--warning)', 'Selesai': 'var(--success)',
    'Batal': 'var(--text3)',
  };

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>No. Order</th><th>Pasien</th><th>Pengirim</th><th>Layanan</th>
      <th>Prioritas</th><th style="text-align:right">Progres</th>
      <th style="text-align:right">Total</th><th>Dibuat</th><th>Status</th><th></th>
    </tr></thead><tbody>
    ${P.map(o => {
      const cito = (o.prioritas || '').toLowerCase() === 'cito';
      return `<tr>
        <td><b>${ioEsc(o.no_order)}</b></td>
        <td>${ioEsc(o.patient_name || '—')}
          ${o.mr_number ? `<div style="font-size:11px; color:var(--text3)">
            ${ioEsc(o.mr_number)}</div>` : ''}</td>
        <td style="font-size:12px">${ioEsc(o.dokter_perujuk || '—')}</td>
        <td style="font-size:12px">${ioEsc(o.layanan || '—')}</td>
        <td>${cito ? '<b style="color:var(--danger)">CITO</b>'
                   : ioEsc(o.prioritas || 'Rutin')}</td>
        <td style="text-align:right">${o.jml_selesai}/${o.jml_item}</td>
        <td style="text-align:right">${ioRp(o.total)}</td>
        <td style="white-space:nowrap">${ioJam(o.created_at)}</td>
        <td><span style="font-weight:600; color:${warna[o.status] || 'var(--text3)'}">
          ${ioEsc(o.status)}</span></td>
        <td><button class="btn btn-sm" onclick="ioRincian(${o.id})">Rincian</button></td>
      </tr>`;
    }).join('')}
    </tbody></table>
  </div>`;
}

function ioTabBaru() {
  const Q = ioData.produk || [];
  const q = ioCari.trim().toLowerCase();
  const hasil = q
    ? Q.filter(p => String(p.nama_tes || '').toLowerCase().includes(q)
                 || String(p.kode_internal || '').toLowerCase().includes(q))
    : Q.slice(0, 40);

  const total = ioKeranjang.reduce((a, x) => a + Number(x.harga_normal || 0), 0);

  if (!Q.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🧾</div>
      <div style="font-weight:700; margin-bottom:4px">Katalog pemeriksaan masih kosong</div>
      <div style="font-size:13px; color:var(--text3)">
        Isi master pemeriksaan lebih dulu agar order bisa dibuat.</div>
    </div>`;
  }

  return `
    <div style="display:grid; grid-template-columns:1fr 320px; gap:16px; align-items:start">
      <div>
        <div class="card" style="padding:12px 16px; margin-bottom:12px">
          <input placeholder="Cari pemeriksaan…" value="${ioEsc(ioCari)}"
                 oninput="ioSetCari(this.value)"
                 style="width:100%; padding:8px 12px; border:1px solid var(--border);
                        border-radius:6px">
        </div>
        <div class="card" style="overflow-x:auto">
          <table class="data-table"><thead><tr>
            <th>Kode</th><th>Pemeriksaan</th><th>Kategori</th><th>LOINC</th>
            <th style="text-align:right">Harga</th><th></th>
          </tr></thead><tbody>
          ${hasil.map(p => {
            const ada = ioKeranjang.some(x => x.id === p.id);
            return `<tr>
              <td style="font-size:12px">${ioEsc(p.kode_internal || '—')}</td>
              <td>${ioEsc(p.nama_tes)}</td>
              <td style="font-size:12px">${ioEsc(p.kategori || '—')}</td>
              <td style="font-size:12px">${ioEsc(p.loinc_code || '—')}</td>
              <td style="text-align:right">${ioRp(p.harga_normal)}</td>
              <td><button class="btn btn-sm ${ada ? '' : 'btn-primary'}"
                          onclick="ioToggle(${p.id})">
                ${ada ? 'Hapus' : 'Tambah'}</button></td>
            </tr>`;
          }).join('')}
          </tbody></table>
        </div>
      </div>

      <div class="card" style="padding:16px; position:sticky; top:12px">
        <div style="font-weight:800; margin-bottom:10px">Order Baru</div>
        <input id="io-pasien" placeholder="Nama pasien *"
               style="width:100%; margin-bottom:8px">
        <input id="io-mr" placeholder="No. rekam medis" style="width:100%; margin-bottom:8px">
        <input id="io-dokter" placeholder="Dokter perujuk" style="width:100%; margin-bottom:8px">
        <textarea id="io-klinis" rows="2" placeholder="Keterangan klinis / diagnosis kerja"
                  style="width:100%; margin-bottom:8px"></textarea>
        <select id="io-prioritas" style="width:100%; margin-bottom:12px">
          <option value="Rutin">Rutin</option>
          <option value="Cito">Cito</option>
        </select>

        <div style="border-top:1px solid var(--border); padding-top:10px">
          ${!ioKeranjang.length
            ? '<div style="font-size:12px; color:var(--text3)">Belum ada pemeriksaan dipilih.</div>'
            : ioKeranjang.map(x => `
              <div style="display:flex; justify-content:space-between; gap:8px;
                          font-size:12px; padding:4px 0">
                <span>${ioEsc(x.nama_tes)}</span>
                <span style="white-space:nowrap">${ioRp(x.harga_normal)}
                  <a onclick="ioToggle(${x.id})" style="cursor:pointer; color:var(--danger);
                     margin-left:6px">×</a></span>
              </div>`).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; font-weight:800;
                    margin-top:10px; padding-top:10px; border-top:1px solid var(--border)">
          <span>Total</span><span>${ioRp(total)}</span>
        </div>
        <div style="font-size:11px; color:var(--text3); margin-top:4px">
          Harga akhir ditentukan server dari master, bukan dari layar ini.
        </div>

        <button class="btn btn-primary" style="width:100%; margin-top:12px"
                onclick="ioKirim(this)" ${ioKeranjang.length ? '' : 'disabled'}>
          Kirim Order</button>
      </div>
    </div>`;
}

function ioSetCari(v) {
  ioCari = v;
  const isi = document.querySelector('#main-content input[placeholder="Cari pemeriksaan…"]');
  const pos = isi && isi.selectionStart;
  ioGambar();
  const baru = document.querySelector('#main-content input[placeholder="Cari pemeriksaan…"]');
  if (baru) { baru.focus(); if (pos != null) baru.setSelectionRange(pos, pos); }
}

// Isi formulir dipertahankan saat keranjang berubah — kalau tidak,
// petugas kehilangan nama pasien yang sudah diketik tiap menambah tes.
function ioToggle(produkId) {
  const simpan = {};
  for (const id of ['io-pasien', 'io-mr', 'io-dokter', 'io-klinis', 'io-prioritas']) {
    const el = document.getElementById(id);
    if (el) simpan[id] = el.value;
  }

  const i = ioKeranjang.findIndex(x => x.id === produkId);
  if (i >= 0) ioKeranjang.splice(i, 1);
  else {
    const p = (ioData.produk || []).find(x => x.id === produkId);
    if (p) ioKeranjang.push(p);
  }
  ioGambar();

  for (const [id, v] of Object.entries(simpan)) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }
}

async function ioKirim(tombol) {
  const pasien = (document.getElementById('io-pasien').value || '').trim();
  if (!pasien) { alert('Nama pasien wajib diisi.'); return; }
  if (!ioKeranjang.length) { alert('Pilih minimal satu pemeriksaan.'); return; }

  if (tombol) { tombol.disabled = true; tombol.textContent = 'Mengirim…'; }
  try {
    const r = await sbRpc('order_terintegrasi_buat', {
      p_data: {
        patient_name: pasien,
        mr_number: (document.getElementById('io-mr').value || '').trim(),
        dokter_perujuk: (document.getElementById('io-dokter').value || '').trim(),
        klinis: (document.getElementById('io-klinis').value || '').trim(),
        prioritas: document.getElementById('io-prioritas').value,
        dibuat_oleh: (window.currentUsername || null),
        // Harga sengaja tidak dikirim.
        item: ioKeranjang.map(x => ({
          layanan: /rad|thorax|usg|ct|mri/i.test(x.kategori || '') ? 'radiologi' : 'lab',
          product_id: x.id,
        })),
      },
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Order ${r.no_order} terkirim. Total ${ioRp(r.total)}.`);
    ioKeranjang = [];
    ioTab = 'daftar';
    await renderIntegratedOrders();
  } catch (e) {
    alert('Gagal mengirim order: ' + e.message);
  } finally {
    if (tombol) { tombol.disabled = false; tombol.textContent = 'Kirim Order'; }
  }
}

function ioRincian(orderId) {
  const o = (ioData.papan || []).find(x => x.id === orderId);
  const items = (ioData.item || []).filter(x => x.order_id === orderId);
  if (!o) return;

  const html = `
    <div class="modal-overlay" id="io-modal" onclick="if(event.target===this)ioTutup()">
      <div class="modal" style="max-width:620px">
        <div class="modal-header">
          <h3>${ioEsc(o.no_order)}</h3>
          <button class="modal-close" onclick="ioTutup()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="font-size:13px; line-height:1.8; margin-bottom:12px">
            <b>${ioEsc(o.patient_name || '—')}</b>
            ${o.mr_number ? ' · ' + ioEsc(o.mr_number) : ''}<br>
            Pengirim: ${ioEsc(o.dokter_perujuk || '—')}<br>
            Klinis: ${ioEsc(o.klinis || '—')}<br>
            Prioritas: <b>${ioEsc(o.prioritas)}</b> · Status: <b>${ioEsc(o.status)}</b>
          </div>
          <table class="data-table"><thead><tr>
            <th>Layanan</th><th>Pemeriksaan</th>
            <th style="text-align:right">Harga</th><th>Status</th><th></th>
          </tr></thead><tbody>
          ${items.map(i => `<tr>
            <td>${ioEsc(i.layanan)}</td>
            <td>${ioEsc(i.nama || '—')}
              ${i.kode ? `<div style="font-size:11px; color:var(--text3)">
                ${ioEsc(i.kode)}</div>` : ''}</td>
            <td style="text-align:right">${ioRp(i.harga)}</td>
            <td>${ioEsc(i.status)}</td>
            <td style="white-space:nowrap">
              ${i.status === 'Diminta' && !i.ref_id
                ? `<button class="btn btn-sm btn-primary" onclick="ioTeruskan(${i.id})">
                     Teruskan ke ${ioEsc(i.layanan)}</button>` : ''}
              ${i.ref_id
                ? `<div style="font-size:11px; color:var(--text3)">
                     ${ioEsc(i.ref_tabel)} #${i.ref_id}</div>` : ''}
              ${(i.status === 'Diproses' || (i.status === 'Diminta' && i.ref_id))
                ? `<button class="btn btn-sm" onclick="ioSelesaiItem(${i.id})">
                     Tandai Selesai</button>` : ''}</td>
          </tr>`).join('')}
          </tbody></table>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function ioTutup() {
  const m = document.getElementById('io-modal');
  if (m) m.remove();
}

async function ioSelesaiItem(itemId) {
  try {
    const r = await sbRpc('order_terintegrasi_status_item', {
      p_item_id: itemId, p_status: 'Selesai',
    });
    if (r && r.error) { alert(r.error); return; }
    ioTutup();
    await renderIntegratedOrders();
  } catch (e) { alert('Gagal memperbarui status: ' + e.message); }
}

function createIntegratedOrder(data = {}) {
  const lab_total = (data.lab_items || []).reduce((acc, x) => acc + (x.price || 0), 0);
  const rad_total = (data.radiology_items || []).reduce((acc, x) => acc + (x.price || 0), 0);
  const pharm_total = (data.pharmacy_items || []).reduce((acc, x) => acc + (x.price || 0), 0);
  const proc_total = (data.procedure_items || []).reduce((acc, x) => acc + (x.price || 0), 0);
  const total = (data.total_amount != null) ? data.total_amount : (lab_total + rad_total + pharm_total + proc_total);

  const order = {
    order_id: 'ORD-' + Date.now(),
    patient_name: data.patient_name || 'Pasien',
    ava_id: data.ava_id || 'AVA-001',
    doctor_name: data.doctor_name || 'dr. Jaga',
    lab_items: data.lab_items || [],
    radiology_items: data.radiology_items || [],
    pharmacy_items: data.pharmacy_items || [],
    procedure_items: data.procedure_items || [],
    total_amount: total,
    dispatches: {
      lis_accession: data.lab_items?.length ? `LIS-${Date.now().toString().slice(-6)}` : null,
      ris_order_no: data.radiology_items?.length ? `RIS-${Date.now().toString().slice(-6)}` : null,
      pharmacy_dispense_id: data.pharmacy_items?.length ? `RX-${Date.now().toString().slice(-6)}` : null
    },
    payment_coverage: data.payment_coverage || 'Umum',
    status: 'ACTIVE'
  };

  return { success: true, order };
}

// Meneruskan item ke layanan yang mengerjakannya. Inilah yang membuat
// order berarti: sebelum ini order berhenti di tabelnya sendiri dan
// laboratorium tidak pernah tahu ada permintaan.
//
// Nomor yang terbit (barcode sampel / accession radiologi) ditampilkan
// supaya petugas bisa langsung mencocokkannya dengan tabung atau berkas
// yang ada di tangannya.
async function ioTeruskan(itemId) {
  try {
    const r = await sbRpc('order_terintegrasi_teruskan', {
      p_item_id: itemId, p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Diteruskan ke ${r.layanan}.

Nomor: ${r.nomor}`);
    ioTutup();
    await renderIntegratedOrders();
  } catch (e) { alert('Gagal meneruskan order: ' + e.message); }
}

window.renderIntegratedOrders = renderIntegratedOrders;
window.ioGantiTab    = ioGantiTab;
window.ioSetCari     = ioSetCari;
window.ioToggle      = ioToggle;
window.ioKirim       = ioKirim;
window.ioRincian     = ioRincian;
window.ioTutup       = ioTutup;
window.ioSelesaiItem = ioSelesaiItem;
window.ioTeruskan    = ioTeruskan;
window.createIntegratedOrder = createIntegratedOrder;
