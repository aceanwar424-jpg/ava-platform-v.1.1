// ═══════════════════════════════════════════════════════════════
// MODULE: Hutang Usaha (Fase 2 + Fase 4) — Faktur Supplier
//
// Inti modul ini adalah PENGENDALIAN PEMBAYARAN: faktur supplier hanya boleh
// dibayar setelah lolos pencocokan tiga arah (PO vs penerimaan barang vs
// faktur). Aturan itu ditegakkan di basis data oleh pay_vendor_invoice(),
// sehingga layar ini tidak menyediakan — dan tidak boleh menyediakan —
// jalan pintas apa pun untuk melewatinya.
//
// Nilai penerimaan TIDAK PERNAH diketik ulang: seluruhnya dihitung dari
// po_items (qty_received × unit_price).
//
// Catatan penamaan: seluruh fungsi & variabel modul ini berawalan `ap`
// (accounts payable) untuk mencegah tabrakan nama antar modul.
// ═══════════════════════════════════════════════════════════════

let apInvoices    = [];      // faktur supplier yang sedang ditampilkan
let apPOs         = [];      // daftar PO untuk entri faktur baru
let apPoValue     = {};      // { po_id: { ordered, received, value } } dari po_items
let apMatchCache  = {};      // { invoice_id: hasil match_vendor_invoice terakhir }
let apTab         = 'daftar';
let apFilterMatch = '';
let apFilterPay   = '';
let apSchemaSiap  = true;

// ── Pembantu kecil ────────────────────────────────────────────
function apEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function apNum(v) { return +v || 0; }

// Selisih hari terhadap tanggal jatuh tempo.
// Positif = sudah lewat N hari; nol/negatif = belum jatuh tempo.
function apHariTelat(due) {
  if (!due) return null;
  const d = new Date(String(due).slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.floor((t - d) / 86400000);
}

// Apakah pesan galat menandakan tabel/fungsi-nya memang belum dipasang?
function apSkemaHilang(msg) {
  return /does not exist|schema cache|could not find the (table|function)|PGRST(202|205)|relation .* does not exist/i
    .test(String(msg || ''));
}

function apPesanSkema() {
  return `<div class="status-box status-warn">
    <b>Modul hutang usaha belum terpasang di basis data.</b><br>
    Jalankan <code>supabase_fase2.sql</code> lalu <code>supabase_fase4.sql</code>
    di Supabase SQL Editor, kemudian muat ulang halaman ini.
  </div>`;
}

function apBadgeCocok(status) {
  const s = status || 'Belum Dicocokkan';
  const cls = s === 'Cocok' ? 'badge-green' : s === 'Selisih' ? 'badge-red' : 'badge-gray';
  return `<span class="badge ${cls}">${apEsc(s)}</span>`;
}

function apBadgeBayar(status) {
  return status === 'Dibayar'
    ? '<span class="badge badge-teal">Dibayar</span>'
    : '<span class="badge badge-gold">Belum Dibayar</span>';
}

// Alasan mengapa sebuah faktur belum boleh dibayar — dipakai di daftar
// maupun di layar rincian, supaya tombol mati selalu disertai keterangan.
// Peran yang boleh membayar — cerminan pemeriksaan di dalam pay_vendor_invoice.
// Pemeriksaan di sini hanya agar tombolnya tidak ditawarkan sia-sia; pengamanan
// yang sesungguhnya tetap di basis data.
function apBolehBayar() {
  const r = (typeof getUserRole === 'function') ? getUserRole() : '';
  return ['super_admin', 'direktur', 'manager', 'finance_staff'].includes(r);
}

function apAlasanBelumBolehBayar(inv) {
  if (inv.payment_status === 'Dibayar') return 'Faktur ini sudah dibayar.';
  if (!apBolehBayar()) {
    return 'Peran Anda tidak berwenang melakukan pembayaran. ' +
      'Pembayaran hutang usaha hanya dapat dilakukan oleh Finance, Manager, Direktur, atau Super Admin.';
  }
  if (inv.match_status === 'Cocok') return null;
  if (inv.match_status === 'Selisih') {
    return 'Faktur berselisih dengan penerimaan barang. ' +
      (inv.match_note ? apEsc(inv.match_note) + ' ' : '') +
      'Perbaiki nilai faktur atau lengkapi penerimaan barangnya, lalu cocokkan ulang.';
  }
  return 'Faktur belum dicocokkan dengan penerimaan barang. ' +
    'Jalankan pencocokan tiga arah terlebih dahulu — faktur yang belum cocok tidak boleh dibayar.';
}

// ═══════════════════════════════════════════════════════════════
// Layar utama
// ═══════════════════════════════════════════════════════════════
async function renderPayables() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Hutang Usaha</h1>
        <p>Faktur supplier, pencocokan tiga arah, dan pengendalian pembayaran</p></div>
      <div class="btn-row">
        <button class="btn btn-teal btn-sm" onclick="apOpenFormFaktur()">＋ Faktur Baru</button>
      </div>
    </div>

    <div style="background:#FBF1E4;border:1px solid #E0A75E55;border-radius:8px;padding:11px 14px;
      margin-bottom:14px;font-size:12.5px;color:#7a4a12">
      <b>Aturan pembayaran:</b> faktur hanya dapat dibayar bila hasil pencocokan tiga arah
      berstatus <b>Cocok</b> — yaitu nilai faktur sepadan dengan nilai barang yang benar-benar
      diterima. Aturan ini dijaga langsung oleh basis data dan tidak dapat dilewati dari layar mana pun.
    </div>

    <div id="ap-summary" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));
      gap:10px;margin-bottom:16px"></div>

    <div class="tabs" id="ap-tabs" style="margin-bottom:14px">
      <button class="tab-btn active" onclick="apSwitchTab('daftar',this)">Daftar Faktur</button>
      <button class="tab-btn" onclick="apSwitchTab('umur',this)">⏳ Umur Hutang</button>
    </div>

    <div id="ap-content"><div class="loading-row"><div class="spinner"></div></div></div>`;

  await apLoadInvoices();
}

function apSwitchTab(tab, btn) {
  apTab = tab;
  document.querySelectorAll('#ap-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  apPaint();
}

// Memuat faktur beserta nilai penerimaan tiap PO yang dirujuk.
async function apLoadInvoices() {
  const el = document.getElementById('ap-content');
  if (el) el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  try {
    apInvoices = await sbGet('vendor_invoices',
      'select=*&order=due_date.asc,id.desc&limit=500') || [];
    apSchemaSiap = true;
    await apLoadNilaiPenerimaan(apInvoices.map(i => i.po_id).filter(Boolean));
    apPaint();
  } catch (e) {
    apSchemaSiap = false;
    const sum = document.getElementById('ap-summary');
    if (sum) sum.innerHTML = '';
    if (el) el.innerHTML = apSkemaHilang(e.message)
      ? apPesanSkema()
      : `<div class="status-box status-warn">Gagal memuat faktur: ${apEsc(e.message)}</div>`;
  }
}

// Nilai penerimaan dihitung dari po_items, bukan dari angka yang diketik ulang.
async function apLoadNilaiPenerimaan(poIds) {
  const unik = [...new Set(poIds.map(Number).filter(n => n))];
  if (!unik.length) return;
  try {
    const items = await sbGet('po_items',
      `select=po_id,qty_ordered,qty_received,unit_price&po_id=in.(${unik.join(',')})`) || [];
    unik.forEach(id => { apPoValue[id] = apPoValue[id] || { ordered: 0, received: 0, value: 0 }; });
    items.forEach(it => {
      const b = apPoValue[it.po_id] || (apPoValue[it.po_id] = { ordered: 0, received: 0, value: 0 });
      b.ordered  += apNum(it.qty_ordered);
      b.received += apNum(it.qty_received);
      b.value    += apNum(it.qty_received) * apNum(it.unit_price);
    });
  } catch (e) { /* nilai penerimaan tampil sebagai "—" bila po_items tak terbaca */ }
}

function apPaint() {
  apPaintRingkasan();
  const el = document.getElementById('ap-content');
  if (!el) return;
  if (!apSchemaSiap) { el.innerHTML = apPesanSkema(); return; }
  if (apTab === 'umur') apPaintUmurHutang(el);
  else apPaintDaftar(el);
}

// ═══════════════════════════════════════════════════════════════
// Ringkasan
// ═══════════════════════════════════════════════════════════════
function apPaintRingkasan() {
  const box = document.getElementById('ap-summary');
  if (!box) return;

  const belumBayar = apInvoices.filter(i => i.payment_status !== 'Dibayar');
  const totalHutang = belumBayar.reduce((s, i) => s + apNum(i.total_amount), 0);

  // Jatuh tempo minggu ini: masih dalam tenggat 7 hari ke depan (belum lewat).
  const mingguIni = belumBayar.filter(i => {
    const n = apHariTelat(i.due_date);
    return n !== null && n <= 0 && n >= -7;
  });
  const nilaiMingguIni = mingguIni.reduce((s, i) => s + apNum(i.total_amount), 0);

  // Bermasalah: berselisih, atau sudah lewat jatuh tempo namun belum lolos cocok.
  const bermasalah = belumBayar.filter(i =>
    i.match_status === 'Selisih' || (apHariTelat(i.due_date) > 0 && i.match_status !== 'Cocok'));

  const kartu = [
    { ico: '💳', label: 'Total Hutang Berjalan', val: formatCurrency(totalHutang),
      sub: `${belumBayar.length} faktur belum dibayar`, warna: '#0E7C86' },
    { ico: '', label: 'Jatuh Tempo Minggu Ini', val: formatCurrency(nilaiMingguIni),
      sub: `${mingguIni.length} faktur dalam 7 hari`, warna: '#B45309' },
    { ico: '⚠️', label: 'Faktur Bermasalah', val: String(bermasalah.length),
      sub: 'Berselisih atau lewat tempo & belum cocok', warna: bermasalah.length ? '#B91C1C' : '#15803D' },
  ];

  box.innerHTML = kartu.map(k => `
    <div class="kpi-card" style="border-top:3px solid ${k.warna}">
      <div class="kpi-icon" style="background:${k.warna}18;font-size:18px">${k.ico}</div>
      <div>
        <div class="kpi-val" style="font-size:${k.val.length > 12 ? '15px' : '20px'};color:${k.warna};
          font-variant-numeric:tabular-nums">${apEsc(k.val)}</div>
        <div class="kpi-label">${k.label}</div>
        <div style="font-size:10.5px;color:var(--gray);margin-top:2px">${k.sub}</div>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// Daftar faktur
// ═══════════════════════════════════════════════════════════════
function apSetFilter() {
  apFilterMatch = document.getElementById('ap-f-match')?.value || '';
  apFilterPay   = document.getElementById('ap-f-pay')?.value || '';
  apPaintDaftar(document.getElementById('ap-content'));
}

function apPaintDaftar(el) {
  if (!el) return;

  const rows = apInvoices.filter(i =>
    (!apFilterMatch || (i.match_status || 'Belum Dicocokkan') === apFilterMatch) &&
    (!apFilterPay || (i.payment_status || 'Belum Dibayar') === apFilterPay));

  const filterBar = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <select class="table-filter" id="ap-f-match" onchange="apSetFilter()">
        <option value="">Semua status pencocokan</option>
        ${['Belum Dicocokkan', 'Cocok', 'Selisih'].map(s =>
          `<option value="${s}" ${apFilterMatch === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <select class="table-filter" id="ap-f-pay" onchange="apSetFilter()">
        <option value="">Semua status bayar</option>
        ${['Belum Dibayar', 'Dibayar'].map(s =>
          `<option value="${s}" ${apFilterPay === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <span style="font-size:12.5px;color:var(--text3)">${rows.length} faktur ditampilkan</span>
    </div>`;

  if (!rows.length) {
    el.innerHTML = filterBar + `<div class="empty-state"><div class="ico"></div>
      <h3>Belum ada faktur supplier</h3>
      <p>Catat faktur yang diterima dari supplier, lalu jalankan pencocokan tiga arah
         sebelum pembayaran dilakukan.</p></div>`;
    return;
  }

  el.innerHTML = filterBar + `<div class="table-wrap"><table><thead><tr>
      <th>No. Faktur</th><th>Supplier</th><th>Tanggal</th><th>Jatuh Tempo</th>
      <th style="text-align:right">Nilai Faktur</th><th style="text-align:right">Nilai Penerimaan</th>
      <th>Pencocokan</th><th>Bayar</th><th></th>
    </tr></thead><tbody>${rows.map(i => {
      const telat = apHariTelat(i.due_date);
      const lewat = i.payment_status !== 'Dibayar' && telat !== null && telat > 0;
      const pv = apPoValue[i.po_id];
      const bolehBayar = i.match_status === 'Cocok' && i.payment_status !== 'Dibayar' && apBolehBayar();
      return `<tr style="${lewat ? 'background:#FEF2F2' : ''}">
        <td style="font-family:ui-monospace,monospace;font-size:11.5px;color:var(--teal);font-weight:650">
          ${apEsc(i.invoice_number || '—')}</td>
        <td style="font-size:12.5px">${apEsc(i.supplier_name || '—')}</td>
        <td style="font-size:11.5px;color:var(--gray)">${i.invoice_date ? formatDateShort(i.invoice_date) : '—'}</td>
        <td style="font-size:11.5px">
          ${i.due_date ? formatDateShort(i.due_date) : '—'}
          ${lewat ? `<div style="color:#B91C1C;font-weight:700;font-size:10.5px">
            ⚠️ lewat ${telat} hari</div>` : ''}</td>
        <td style="text-align:right;font-weight:650;font-variant-numeric:tabular-nums">
          ${formatCurrency(i.total_amount)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--gray)">
          ${pv ? formatCurrency(pv.value) : '—'}</td>
        <td>${apBadgeCocok(i.match_status)}</td>
        <td>${apBadgeBayar(i.payment_status)}</td>
        <td><div class="act-row">
          <button class="act-btn" onclick="apOpenRincian(${i.id})" title="Rincian & pencocokan">${icon('file-text', 12)}</button>
          ${i.payment_status !== 'Dibayar'
            ? `<button class="act-btn" onclick="apJalankanCocok(${i.id})" title="Jalankan pencocokan tiga arah"></button>`
            : ''}
          ${bolehBayar
            ? `<button class="act-btn" onclick="apAskBayar(${i.id})" title="Bayar faktur"></button>`
            : ''}
        </div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

// ═══════════════════════════════════════════════════════════════
// Umur hutang
// ═══════════════════════════════════════════════════════════════
function apPaintUmurHutang(el) {
  if (!el) return;
  const belumBayar = apInvoices.filter(i => i.payment_status !== 'Dibayar');

  const ember = [
    { key: 'belum', label: 'Belum Jatuh Tempo', warna: '#15803D', items: [] },
    { key: 'd30',   label: 'Lewat 1–30 Hari',   warna: '#CA8A04', items: [] },
    { key: 'd60',   label: 'Lewat 31–60 Hari',  warna: '#EA580C', items: [] },
    { key: 'd60p',  label: 'Lewat > 60 Hari',   warna: '#B91C1C', items: [] },
  ];

  belumBayar.forEach(i => {
    const n = apHariTelat(i.due_date);
    if (n === null || n <= 0) ember[0].items.push(i);
    else if (n <= 30) ember[1].items.push(i);
    else if (n <= 60) ember[2].items.push(i);
    else ember[3].items.push(i);
  });

  const total = belumBayar.reduce((s, i) => s + apNum(i.total_amount), 0);

  if (!belumBayar.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">✅</div>
      <h3>Tidak ada hutang berjalan</h3>
      <p>Seluruh faktur supplier yang tercatat sudah dibayar.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:16px">
      ${ember.map(b => {
        const nilai = b.items.reduce((s, i) => s + apNum(i.total_amount), 0);
        const pct = total ? Math.round((nilai / total) * 100) : 0;
        return `<div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${b.warna};
          border-radius:10px;padding:13px">
          <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.06em">${b.label}</div>
          <div style="font-size:18px;font-weight:800;color:${b.warna};font-variant-numeric:tabular-nums">
            ${formatCurrency(nilai)}</div>
          <div style="font-size:11px;color:var(--gray);margin-top:3px">${b.items.length} faktur · ${pct}% dari total</div>
          <div style="height:5px;background:var(--border);border-radius:3px;margin-top:6px">
            <div style="height:100%;width:${pct}%;background:${b.warna};border-radius:3px"></div></div>
        </div>`;
      }).join('')}
    </div>

    <div style="font-size:12.5px;color:var(--text3);margin-bottom:10px">
      Total hutang berjalan <b style="color:var(--teal)">${formatCurrency(total)}</b>
      dari ${belumBayar.length} faktur yang belum dibayar.
    </div>

    ${ember.filter(b => b.items.length).map(b => `
      <div style="margin-bottom:18px">
        <div style="font-weight:700;font-size:13px;color:${b.warna};margin-bottom:6px">
          ${b.label} — ${b.items.length} faktur ·
          ${formatCurrency(b.items.reduce((s, i) => s + apNum(i.total_amount), 0))}</div>
        <div class="table-wrap"><table><thead><tr>
          <th>No. Faktur</th><th>Supplier</th><th>Jatuh Tempo</th>
          <th>Umur</th><th style="text-align:right">Nilai</th><th>Pencocokan</th><th></th>
        </tr></thead><tbody>${b.items.map(i => {
          const n = apHariTelat(i.due_date);
          return `<tr>
            <td style="font-family:ui-monospace,monospace;font-size:11.5px;color:var(--teal)">
              ${apEsc(i.invoice_number || '—')}</td>
            <td style="font-size:12.5px">${apEsc(i.supplier_name || '—')}</td>
            <td style="font-size:11.5px;color:var(--gray)">
              ${i.due_date ? formatDateShort(i.due_date) : '—'}</td>
            <td style="font-size:11.5px;font-weight:${n > 0 ? '700' : '400'};color:${n > 0 ? b.warna : 'var(--gray)'}">
              ${n === null ? 'tanpa tempo' : n > 0 ? `lewat ${n} hari` : `${Math.abs(n)} hari lagi`}</td>
            <td style="text-align:right;font-weight:650;font-variant-numeric:tabular-nums">
              ${formatCurrency(i.total_amount)}</td>
            <td>${apBadgeCocok(i.match_status)}</td>
            <td><button class="act-btn" onclick="apOpenRincian(${i.id})" title="Rincian">${icon('file-text', 12)}</button></td>
          </tr>`;
        }).join('')}</tbody></table></div>
      </div>`).join('')}`;
}

// ═══════════════════════════════════════════════════════════════
// Entri faktur baru
// ═══════════════════════════════════════════════════════════════
async function apOpenFormFaktur() {
  let pos = [];
  try {
    pos = await sbGet('purchase_orders',
      'select=id,po_number,supplier_id,supplier_name,order_date,status,total_amount&order=id.desc&limit=300') || [];
  } catch (e) {
    toast(apSkemaHilang(e.message)
      ? 'Jalankan supabase_fase2.sql dan supabase_fase4.sql dulu'
      : 'Gagal memuat PO: ' + e.message, 'warn');
    return;
  }
  if (!pos.length) {
    toast('Belum ada Purchase Order — faktur supplier harus ditautkan ke PO', 'warn');
    return;
  }
  apPOs = pos;
  await apLoadNilaiPenerimaan(pos.map(p => p.id));

  const hariIni = new Date().toISOString().slice(0, 10);
  openModal(`
    <div class="modal-header"><div class="modal-title">Faktur Supplier Baru</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>

    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      Faktur wajib ditautkan ke Purchase Order agar dapat dicocokkan dengan penerimaan barang.
      Nilai penerimaan dihitung otomatis dari rincian PO — tidak diketik ulang.
    </div>

    <div class="form-group"><label>Purchase Order *</label>
      <select id="ap-po" onchange="apOnPOChange()">
        <option value="">— pilih PO —</option>
        ${pos.map(p => `<option value="${p.id}">${apEsc(p.po_number || ('PO#' + p.id))}
          — ${apEsc(p.supplier_name || 'tanpa supplier')}</option>`).join('')}
      </select>
    </div>

    <div id="ap-po-info" style="background:var(--bg2);border-radius:8px;padding:11px 13px;
      margin-bottom:12px;font-size:12.5px;color:var(--text3)">
      Pilih PO untuk melihat supplier dan nilai barang yang sudah diterima.
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label>Nomor Faktur *</label>
        <input type="text" id="ap-no" placeholder="mis. INV/2026/0417"></div>
      <div class="form-group"><label>Nilai Faktur (Rp) *</label>
        <input type="number" id="ap-nilai" min="0" step="1" placeholder="0"></div>
      <div class="form-group"><label>Tanggal Faktur *</label>
        <input type="date" id="ap-tgl" value="${hariIni}"></div>
      <div class="form-group"><label>Jatuh Tempo *</label>
        <input type="date" id="ap-tempo"></div>
    </div>

    <div class="form-group"><label>Catatan</label>
      <textarea id="ap-catatan" rows="2" placeholder="opsional"></textarea></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="apSimpanFaktur()">Simpan & Cocokkan</button>
    </div>`, 'wide');
}

// Menampilkan supplier dan nilai penerimaan PO yang dipilih.
function apOnPOChange() {
  const box = document.getElementById('ap-po-info');
  const id = +document.getElementById('ap-po')?.value || 0;
  if (!box) return;
  if (!id) {
    box.innerHTML = 'Pilih PO untuk melihat supplier dan nilai barang yang sudah diterima.';
    return;
  }
  const po = apPOs.find(p => p.id === id);
  const pv = apPoValue[id] || { ordered: 0, received: 0, value: 0 };
  const belumTerima = pv.received === 0;

  box.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
      <div><div style="font-size:10.5px;color:var(--gray);text-transform:uppercase">Supplier</div>
        <b>${apEsc(po?.supplier_name || '—')}</b></div>
      <div><div style="font-size:10.5px;color:var(--gray);text-transform:uppercase">Status PO</div>
        <b>${apEsc(po?.status || '—')}</b></div>
      <div><div style="font-size:10.5px;color:var(--gray);text-transform:uppercase">Qty Dipesan</div>
        <b>${pv.ordered}</b></div>
      <div><div style="font-size:10.5px;color:var(--gray);text-transform:uppercase">Qty Diterima</div>
        <b style="color:${belumTerima ? '#B91C1C' : '#15803D'}">${pv.received}</b></div>
      <div><div style="font-size:10.5px;color:var(--gray);text-transform:uppercase">Nilai Penerimaan</div>
        <b style="color:var(--teal);font-variant-numeric:tabular-nums">${formatCurrency(pv.value)}</b></div>
    </div>
    ${belumTerima ? `<div style="margin-top:9px;color:#B91C1C;font-weight:600">
      ⚠️ Barang pada PO ini belum diterima. Faktur boleh dicatat, tetapi pencocokan akan
      berstatus Selisih dan pembayaran tidak akan diizinkan sampai barangnya diterima.</div>` : ''}`;
}

async function apSimpanFaktur() {
  const poId   = +document.getElementById('ap-po')?.value || 0;
  const no     = document.getElementById('ap-no')?.value.trim() || '';
  const nilai  = +document.getElementById('ap-nilai')?.value || 0;
  const tgl    = document.getElementById('ap-tgl')?.value || '';
  const tempo  = document.getElementById('ap-tempo')?.value || '';
  const catatan= document.getElementById('ap-catatan')?.value.trim() || '';

  if (!poId)  { toast('Purchase Order wajib dipilih', 'err'); return; }
  if (!no)    { toast('Nomor faktur wajib diisi', 'err'); return; }
  if (nilai <= 0) { toast('Nilai faktur harus lebih dari nol', 'err'); return; }
  if (!tgl)   { toast('Tanggal faktur wajib diisi', 'err'); return; }
  if (!tempo) { toast('Tanggal jatuh tempo wajib diisi', 'err'); return; }
  if (tempo < tgl) { toast('Jatuh tempo tidak boleh mendahului tanggal faktur', 'err'); return; }

  const po = apPOs.find(p => p.id === poId);
  try {
    const hasil = await sbPost('vendor_invoices', {
      invoice_number: no,
      po_id: poId,
      supplier_id: po?.supplier_id ?? null,
      supplier_name: po?.supplier_name || '',
      invoice_date: tgl,
      due_date: tempo,
      total_amount: nilai,
      match_status: 'Belum Dicocokkan',
      payment_status: 'Belum Dibayar',
      notes: catatan || null,
      created_by: getUserName(),
      updated_at: new Date().toISOString(),
    });
    const baru = Array.isArray(hasil) ? hasil[0] : hasil;
    await logActivity('create', 'vendor_invoices', baru?.id, `Faktur supplier ${no} dicatat`, no);
    toast('✅ Faktur tersimpan', 'ok');
    closeModalForce();

    // Langsung dicocokkan supaya statusnya tidak menggantung.
    if (baru?.id) await apJalankanCocok(baru.id, true);
    await apLoadInvoices();
  } catch (e) {
    toast('❌ ' + (apSkemaHilang(e.message)
      ? 'Tabel belum ada — jalankan supabase_fase2.sql dan supabase_fase4.sql'
      : e.message), 'err');
  }
}

// ═══════════════════════════════════════════════════════════════
// Pencocokan tiga arah
// ═══════════════════════════════════════════════════════════════
async function apJalankanCocok(id, diam) {
  try {
    const r = await sbRpc('match_vendor_invoice', { p_invoice_id: id });
    apMatchCache[id] = r;
    const inv = apInvoices.find(i => i.id === id);
    if (inv) { inv.match_status = r?.status || inv.match_status; inv.match_note = r?.note || inv.match_note; }
    if (!diam) {
      await apLoadInvoices();
      apTampilkanHasilCocok(id, r);
    }
    return r;
  } catch (e) {
    toast('❌ ' + (apSkemaHilang(e.message)
      ? 'Fungsi pencocokan belum ada — jalankan supabase_fase2.sql'
      : e.message), 'err');
    return null;
  }
}

// Menyajikan hasil pencocokan secara gamblang: dipesan vs diterima vs ditagih.
function apTampilkanHasilCocok(id, r) {
  if (!r) return;
  const inv = apInvoices.find(i => i.id === id) || {};
  const cocok = r.status === 'Cocok';
  const selisih = apNum(r.selisih);

  openModal(`
    <div class="modal-header"><div class="modal-title">Hasil Pencocokan Tiga Arah</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>

    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      Faktur <b>${apEsc(inv.invoice_number || '—')}</b> · ${apEsc(inv.supplier_name || '—')}
    </div>

    <div style="background:${cocok ? '#F0FDF4' : '#FEF2F2'};
      border:1px solid ${cocok ? '#15803D40' : '#B91C1C40'};border-radius:9px;
      padding:13px 15px;margin-bottom:14px">
      <div style="font-size:16px;font-weight:800;color:${cocok ? '#15803D' : '#B91C1C'}">
        ${cocok ? '✅ Cocok' : '⚠️ Selisih'}</div>
      <div style="font-size:12.5px;color:var(--text3);margin-top:4px">${apEsc(r.note || '')}</div>
    </div>

    <table style="width:100%;font-size:12.5px;margin-bottom:12px">
      <tbody>
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:7px 6px;color:var(--gray)">Jumlah dipesan (PO)</td>
          <td style="padding:7px 6px;text-align:right;font-weight:650">${apNum(r.qty_ordered)}</td></tr>
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:7px 6px;color:var(--gray)">Jumlah diterima (penerimaan barang)</td>
          <td style="padding:7px 6px;text-align:right;font-weight:650;
            color:${apNum(r.qty_received) ? '#15803D' : '#B91C1C'}">${apNum(r.qty_received)}</td></tr>
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:7px 6px;color:var(--gray)">Nilai penerimaan (qty diterima × harga satuan)</td>
          <td style="padding:7px 6px;text-align:right;font-weight:650;font-variant-numeric:tabular-nums">
            ${formatCurrency(r.nilai_penerimaan)}</td></tr>
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:7px 6px;color:var(--gray)">Nilai ditagih (faktur supplier)</td>
          <td style="padding:7px 6px;text-align:right;font-weight:650;font-variant-numeric:tabular-nums">
            ${formatCurrency(inv.total_amount)}</td></tr>
        <tr>
          <td style="padding:7px 6px;font-weight:700">Selisih (faktur − penerimaan)</td>
          <td style="padding:7px 6px;text-align:right;font-weight:800;font-variant-numeric:tabular-nums;
            color:${Math.abs(selisih) < 0.5 ? '#15803D' : '#B91C1C'}">${formatCurrency(selisih)}</td></tr>
      </tbody>
    </table>

    <div class="status-box ${cocok ? 'status-ok' : 'status-warn'}" style="font-size:12.5px">
      ${cocok
        ? 'Faktur sepadan dengan barang yang benar-benar diterima, sehingga sudah boleh dibayar.'
        : 'Faktur <b>tidak boleh dibayar</b> selama masih berselisih. Periksa kembali nilai faktur, ' +
          'atau lengkapi pencatatan penerimaan barang pada PO terkait, lalu cocokkan ulang.'}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      ${cocok && inv.payment_status !== 'Dibayar'
        ? `<button class="btn btn-teal" onclick="closeModalForce();apAskBayar(${id})">Bayar Faktur</button>`
        : ''}
    </div>`, 'wide');
}

// ═══════════════════════════════════════════════════════════════
// Rincian faktur
// ═══════════════════════════════════════════════════════════════
async function apOpenRincian(id) {
  const inv = apInvoices.find(i => i.id === id);
  if (!inv) { toast('Faktur tidak ditemukan', 'err'); return; }

  const pv = apPoValue[inv.po_id] || { ordered: 0, received: 0, value: 0 };
  const telat = apHariTelat(inv.due_date);
  const lewat = inv.payment_status !== 'Dibayar' && telat !== null && telat > 0;
  const bolehBayar = inv.match_status === 'Cocok' && inv.payment_status !== 'Dibayar' && apBolehBayar();
  const alasan = apAlasanBelumBolehBayar(inv);

  const baris = (l, v) => `<tr style="border-bottom:1px solid var(--border)">
    <td style="padding:6px;color:var(--gray)">${l}</td>
    <td style="padding:6px;text-align:right">${v}</td></tr>`;

  openModal(`
    <div class="modal-header"><div class="modal-title">${apEsc(inv.invoice_number || 'Faktur Supplier')}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>

    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      ${apBadgeCocok(inv.match_status)} ${apBadgeBayar(inv.payment_status)}
      ${lewat ? `<span class="badge badge-red">Lewat tempo ${telat} hari</span>` : ''}
    </div>

    <table style="width:100%;font-size:12.5px;margin-bottom:12px"><tbody>
      ${baris('Supplier', `<b>${apEsc(inv.supplier_name || '—')}</b>`)}
      ${baris('Tanggal faktur', inv.invoice_date ? formatDateShort(inv.invoice_date) : '—')}
      ${baris('Jatuh tempo', inv.due_date ? formatDateShort(inv.due_date) : '—')}
      ${baris('Nilai ditagih', `<b style="font-variant-numeric:tabular-nums">${formatCurrency(inv.total_amount)}</b>`)}
      ${baris('Qty dipesan / diterima', `${pv.ordered} / <b style="color:${pv.received ? '#15803D' : '#B91C1C'}">${pv.received}</b>`)}
      ${baris('Nilai penerimaan', `<b style="color:var(--teal);font-variant-numeric:tabular-nums">${formatCurrency(pv.value)}</b>`)}
      ${baris('Selisih terhadap penerimaan',
        `<b style="font-variant-numeric:tabular-nums">${formatCurrency(apNum(inv.total_amount) - pv.value)}</b>`)}
      ${baris('Catatan pencocokan', apEsc(inv.match_note || '—'))}
      ${baris('Catatan', apEsc(inv.notes || '—'))}
      ${baris('Dicatat oleh', apEsc(inv.created_by || '—'))}
      ${inv.payment_status === 'Dibayar'
        ? baris('Dibayar', `${inv.paid_at ? formatDateShort(inv.paid_at) : '—'} oleh ${apEsc(inv.paid_by || '—')}
            ${inv.journal_id ? `<br><span style="font-size:11px;color:var(--gray)">Jurnal #${inv.journal_id}</span>` : ''}`)
        : ''}
    </tbody></table>

    ${alasan
      ? `<div class="status-box status-warn" style="font-size:12.5px">
          <b>Belum dapat dibayar.</b><br>${alasan}</div>`
      : `<div class="status-box status-ok" style="font-size:12.5px">
          Pencocokan tiga arah lolos — faktur ini sudah boleh dibayar.</div>`}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      ${inv.payment_status !== 'Dibayar'
        ? `<button class="btn btn-outline" onclick="closeModalForce();apJalankanCocok(${id})">Cocokkan Ulang</button>`
        : ''}
      ${bolehBayar
        ? `<button class="btn btn-teal" onclick="closeModalForce();apAskBayar(${id})">Bayar Faktur</button>`
        : ''}
    </div>`, 'wide');
}

// ═══════════════════════════════════════════════════════════════
// Pembayaran — hanya untuk faktur berstatus Cocok
// ═══════════════════════════════════════════════════════════════
function apAskBayar(id) {
  const inv = apInvoices.find(i => i.id === id);
  if (!inv) { toast('Faktur tidak ditemukan', 'err'); return; }

  // Penjagaan berlapis: layar tidak pernah menawarkan pembayaran untuk faktur
  // yang belum cocok, dan basis data akan menolaknya sekali lagi.
  const alasan = apAlasanBelumBolehBayar(inv);
  if (alasan) {
    openModal(`
      <div class="modal-header"><div class="modal-title">🚫 Pembayaran Ditolak</div>
        <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
      <div class="status-box status-warn" style="font-size:12.5px">
        Faktur <b>${apEsc(inv.invoice_number || '—')}</b> belum dapat dibayar.<br><br>${alasan}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
        ${inv.payment_status !== 'Dibayar'
          ? `<button class="btn btn-outline" onclick="closeModalForce();apJalankanCocok(${id})">Cocokkan Sekarang</button>`
          : ''}
      </div>`);
    return;
  }

  openModal(`
    <div class="modal-header"><div class="modal-title">Bayar Faktur Supplier</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      Pembayaran akan dicatat beserta jurnalnya secara otomatis dan tidak dapat dibatalkan
      dari layar ini. Koreksi hanya dapat dilakukan lewat jurnal balik di modul Akuntansi.
    </div>
    <table style="width:100%;font-size:13px;margin-bottom:12px"><tbody>
      <tr><td style="padding:6px;color:var(--gray)">Faktur</td>
        <td style="padding:6px;text-align:right"><b>${apEsc(inv.invoice_number || '—')}</b></td></tr>
      <tr><td style="padding:6px;color:var(--gray)">Supplier</td>
        <td style="padding:6px;text-align:right">${apEsc(inv.supplier_name || '—')}</td></tr>
      <tr><td style="padding:6px;color:var(--gray)">Nilai dibayar</td>
        <td style="padding:6px;text-align:right;font-size:16px;font-weight:800;color:var(--teal);
          font-variant-numeric:tabular-nums">${formatCurrency(inv.total_amount)}</td></tr>
    </tbody></table>
    <div class="status-box status-ok" style="font-size:12.5px">
      ✅ Pencocokan tiga arah lolos: nilai faktur sepadan dengan barang yang diterima.
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="apDoBayar(${id})">Konfirmasi Pembayaran</button>
    </div>`);
}

async function apDoBayar(id) {
  try {
    const r = await sbRpc('pay_vendor_invoice', { p_invoice_id: id });
    const inv = apInvoices.find(i => i.id === id);
    await logActivity('pay', 'vendor_invoices', id,
      `Pembayaran faktur supplier ${inv?.invoice_number || id}`, inv?.invoice_number || '');
    toast('✅ Pembayaran tercatat' + (r?.journal?.entry_no ? ` · jurnal ${r.journal.entry_no}` : ''), 'ok');
    closeModalForce();
    await apLoadInvoices();
  } catch (e) {
    // Penolakan dari basis data ditampilkan apa adanya — inilah pengendaliannya.
    toast('❌ ' + (apSkemaHilang(e.message)
      ? 'Fungsi pembayaran belum ada — jalankan supabase_fase4.sql'
      : e.message), 'err');
  }
}