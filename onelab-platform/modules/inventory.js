// ═══════════════════════════════════════════════════════════════
// MODULE: Inventory & Logistik — Full Build
// PR/PO terstruktur, approval 3-jenjang, chat, stock ledger, opname, MRP
// ═══════════════════════════════════════════════════════════════

const INV_CATEGORIES = ['Reagen','BHP Lab','APD','ATK','Consumable Radiologi','Consumable EKG','Obat & Alkes','Lainnya'];
const PR_SOURCES     = ['KAS GANTUNG','XENDIT','PR / PO','VENDOR','STOCK INTERNAL'];

let invItems = [], invPRs = [], invPOs = [], invSuppliers = [], invOpnames = [];
let invFilter = { search:'', category:'' };

// ── Approval role helpers (strict 3-tier, independent from broader isSpv/isManager) ──
function invCanApproveSPV()     { return ['spv','manager','direktur','super_admin'].includes(getUserRole?getUserRole():''); }
function invCanApproveManager() { return ['manager','direktur','super_admin'].includes(getUserRole?getUserRole():''); }
function invCanApproveHeadOps() { return ['super_admin','direktur'].includes(getUserRole?getUserRole():''); }

async function renderInventory() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>📦 Inventory &amp; Logistik</h1>
        <p style="color:var(--text3);font-size:13px">Stok, Purchase Request/Order, Stock Opname, dan MRP</p></div>
    </div>

    <div class="tabs" id="inv-tabs">
      <button class="tab-btn active" onclick="switchInvTab('stock',this)">📦 Stok Barang</button>
      <button class="tab-btn" onclick="switchInvTab('pr',this)">🛒 Purchase Request</button>
      <button class="tab-btn" onclick="switchInvTab('po',this)">📄 Purchase Order</button>
      <button class="tab-btn" onclick="switchInvTab('opname',this)">📋 Stock Opname</button>
      <button class="tab-btn" onclick="switchInvTab('ledger',this)">📜 Stock Ledger</button>
      <button class="tab-btn" onclick="switchInvTab('mrp',this)">📊 MRP</button>
      <button class="tab-btn" onclick="switchInvTab('supplier',this)">🏭 Supplier</button>
    </div>

    <div id="inv-stock">
      <div id="inv-stock-alerts"></div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <input class="table-search" id="inv-q" placeholder="🔍 Cari nama/kode barang..." oninput="filterInvItems()">
          <select class="table-filter" id="inv-cat" onchange="filterInvItems()">
            <option value="">Semua Kategori</option>
            ${INV_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
          </select>
          <button class="btn btn-teal" onclick="openItemForm()">+ Tambah Barang</button>
        </div>
        <div id="inv-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
      </div>
    </div>

    <div id="inv-pr" style="display:none"></div>
    <div id="inv-po" style="display:none"></div>
    <div id="inv-opname" style="display:none"></div>
    <div id="inv-ledger" style="display:none"></div>
    <div id="inv-mrp" style="display:none"></div>
    <div id="inv-supplier" style="display:none"></div>
  `;
  await loadInventory();
}

function switchInvTab(tab, btn) {
  document.querySelectorAll('#inv-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['stock','pr','po','opname','ledger','mrp','supplier'].forEach(t=>{
    const el = document.getElementById('inv-'+t);
    if (el) el.style.display = t===tab?'block':'none';
  });
  if (tab==='pr')      renderPRList();
  if (tab==='po')      renderPOList();
  if (tab==='opname')  renderOpnameList();
  if (tab==='ledger')  renderStockLedger();
  if (tab==='mrp')     renderMRPDashboard();
  if (tab==='supplier')renderSupplierList();
}

async function loadInventory() {
  try {
    const [items, prs, pos, suppliers] = await Promise.all([
      sbGet('inventory_items','select=*&order=item_name.asc'),
      sbGet('purchase_requests','select=*&order=created_at.desc'),
      sbGet('purchase_orders','select=*&order=created_at.desc'),
      sbGet('suppliers','select=*&order=supplier_name.asc'),
    ]);
    invItems     = Array.isArray(items)?items:[];
    invPRs       = Array.isArray(prs)?prs:[];
    invPOs       = Array.isArray(pos)?pos:[];
    invSuppliers = Array.isArray(suppliers)?suppliers:[];
    renderStockAlerts();
    filterInvItems();
  } catch(e) {
    document.getElementById('inv-tbody').innerHTML = `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// STOK BARANG (Master Item)
// ══════════════════════════════════════════════════════════════
function renderStockAlerts() {
  const low = invItems.filter(i => (i.stock_qty||0) <= (i.min_stock||0) && i.is_active!==false);
  const el = document.getElementById('inv-stock-alerts');
  if (!el) return;
  if (!low.length) { el.innerHTML=''; return; }
  el.innerHTML = `
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:var(--r);padding:10px 14px;margin-bottom:14px">
      <div style="font-weight:700;color:#C2410C;font-size:12.5px">⚠️ ${low.length} barang di bawah stok minimum</div>
      <div style="font-size:11px;color:#9A3412;margin-top:2px">
        ${low.slice(0,5).map(i=>`${i.item_name} (${i.stock_qty} ${i.unit})`).join(', ')}${low.length>5?` +${low.length-5} lainnya`:''}
      </div>
    </div>`;
}

function filterInvItems() {
  const q   = (document.getElementById('inv-q')?.value||'').toLowerCase();
  const cat = document.getElementById('inv-cat')?.value||'';
  const filtered = invItems.filter(i =>
    (!q || (i.item_name||'').toLowerCase().includes(q) || (i.item_code||'').toLowerCase().includes(q)) &&
    (!cat || i.category===cat)
  );
  renderStockTable(filtered);
}

function renderStockTable(data) {
  const el = document.getElementById('inv-tbody');
  if (!data.length) { el.innerHTML = `<div class="empty-state"><div class="ico">📦</div><h3>Belum ada barang</h3><p>Klik "+ Tambah Barang" untuk mulai.</p></div>`; return; }
  el.innerHTML = `<table><thead><tr>
    <th>Kode</th><th>Nama Barang</th><th>Kategori</th><th>Stok</th><th>Min/Max</th><th>Harga</th><th>Lokasi</th><th>Aksi</th>
  </tr></thead><tbody>${data.map(i=>{
    const low = (i.stock_qty||0) <= (i.min_stock||0);
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--teal)">${i.item_code||'—'}</td>
      <td><div style="font-weight:600">${i.item_name||'—'}</div>
        <div style="font-size:11px;color:var(--gray)">${i.description||''}</div></td>
      <td><span class="badge badge-gray">${i.category||'—'}</span></td>
      <td>
        <span style="font-weight:700;color:${low?'#DC2626':'var(--navy)'}">${i.stock_qty||0}</span>
        <span style="font-size:11px;color:var(--gray)"> ${i.unit||''}</span>
        ${low?'<div style="font-size:10px;color:#DC2626">⚠️ Rendah</div>':''}
      </td>
      <td style="font-size:11px;color:var(--gray)">${i.min_stock||0} / ${i.max_stock||0}</td>
      <td style="font-size:12px">${i.unit_price?formatCurrency(i.unit_price):'—'}</td>
      <td style="font-size:11px;color:var(--gray)">${i.location||'—'}</td>
      <td><div class="act-row">
        <button class="act-btn" onclick="adjustStock(${i.id},'${(i.item_name||'').replace(/'/g,"\\'")}',${i.stock_qty||0})" title="Adjust Stok">⚖️</button>
        <button class="act-btn edit" onclick="openItemForm(${i.id})">✏️</button>
        <button class="act-btn del" onclick="deleteItem(${i.id})">🗑</button>
      </div></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

function adjustStock(id, name, current) {
  openModal(`
    <div class="modal-header"><div class="modal-title">⚖️ Adjust Stok: ${name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Stok Saat Ini</label>
      <input type="number" value="${current}" disabled style="background:var(--bg2)"></div>
    <div class="form-group"><label>Stok Baru *</label>
      <input type="number" id="adj-new-qty" value="${current}"></div>
    <div class="form-group"><label>Alasan</label>
      <textarea id="adj-reason" rows="2" placeholder="Koreksi manual, barang rusak, dll"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveStockAdj(${id},${current})">💾 Simpan</button>
    </div>`);
}

async function saveStockAdj(id, oldQty) {
  const newQty = parseFloat(document.getElementById('adj-new-qty').value);
  if (isNaN(newQty)) { toast('Qty tidak valid','err'); return; }
  const reason = document.getElementById('adj-reason').value.trim();
  const diff = newQty - oldQty;
  try {
    await sbPatch('inventory_items', id, { stock_qty:newQty, updated_at:new Date().toISOString() });
    if (diff !== 0) await writeStockLedger(id, 'ADJUST', diff, newQty, 'manual', null, null, reason||'Adjustment manual');
    toast('✅ Stok diupdate','ok');
    closeModalForce(); await loadInventory();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function openItemForm(id=null) {
  let it = {};
  if (id) { const d = await sbGet('inventory_items',`select=*&id=eq.${id}`); it=d[0]||{}; }
  openModal(`
    <div class="modal-header"><div class="modal-title">${id?'✏️ Edit Barang':'➕ Tambah Barang'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Kode Barang</label>
        <input type="text" id="if-code" value="${it.item_code||'BRG-'+Date.now().toString().slice(-5)}"></div>
      <div class="form-group"><label>Kategori</label>
        <select id="if-cat">${INV_CATEGORIES.map(c=>`<option${it.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>Nama Barang *</label>
      <input type="text" id="if-name" value="${it.item_name||''}" placeholder="Reagen HbA1c, APD Level 2, dll"></div>
    <div class="form-row">
      <div class="form-group"><label>Satuan (UoM)</label>
        <input type="text" id="if-uom" value="${it.unit||''}" placeholder="box, pcs, botol"></div>
      <div class="form-group"><label>Harga Satuan (Rp)</label>
        <input type="number" id="if-price" value="${it.unit_price||0}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Stok Saat Ini</label>
        <input type="number" id="if-stock" value="${it.stock_qty||0}" ${id?'disabled style="background:var(--bg2)"':''}></div>
      <div class="form-group"><label>Lokasi</label>
        <input type="text" id="if-loc" value="${it.location||''}" placeholder="Gudang A, Rak 3"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Stok Minimum</label>
        <input type="number" id="if-min" value="${it.min_stock||0}"></div>
      <div class="form-group"><label>Stok Maximum</label>
        <input type="number" id="if-max" value="${it.max_stock||0}"></div>
    </div>
    <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:10px">📊 Parameter MRP</div>
      <div class="form-row">
        <div class="form-group"><label>Lead Time (hari)</label>
          <input type="number" id="if-leadtime" value="${it.lead_time_days||7}"></div>
        <div class="form-group"><label>Safety Stock</label>
          <input type="number" id="if-safety" value="${it.safety_stock||0}"></div>
      </div>
      <div class="form-group"><label>Rata-rata Pemakaian/Bulan</label>
        <input type="number" id="if-avgusage" value="${it.avg_monthly_usage||0}">
        <div class="form-hint">Reorder Point akan dihitung otomatis: (Pemakaian/Bulan ÷ 30 × Lead Time) + Safety Stock</div>
      </div>
    </div>
    <div class="form-group"><label>Deskripsi</label>
      <textarea id="if-desc" rows="2">${it.description||''}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveItem(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function saveItem(id) {
  const name = document.getElementById('if-name').value.trim();
  if (!name) { toast('Nama barang wajib diisi','err'); return; }
  const avgUsage = parseFloat(document.getElementById('if-avgusage').value)||0;
  const leadTime = parseInt(document.getElementById('if-leadtime').value)||7;
  const safety   = parseFloat(document.getElementById('if-safety').value)||0;
  const reorderPoint = Math.round((avgUsage/30*leadTime) + safety);

  const payload = {
    item_code: document.getElementById('if-code').value.trim(),
    item_name: name,
    category:  document.getElementById('if-cat').value,
    unit:      document.getElementById('if-uom').value.trim(),
    unit_price:parseFloat(document.getElementById('if-price').value)||0,
    location:  document.getElementById('if-loc').value.trim(),
    min_stock: parseFloat(document.getElementById('if-min').value)||0,
    max_stock: parseFloat(document.getElementById('if-max').value)||0,
    lead_time_days: leadTime,
    safety_stock:   safety,
    avg_monthly_usage: avgUsage,
    reorder_point:  reorderPoint,
    description: document.getElementById('if-desc').value.trim(),
    updated_at: new Date().toISOString(),
  };
  if (!id) payload.stock_qty = parseFloat(document.getElementById('if-stock').value)||0;

  try {
    let itemId = id;
    if (id) { await sbPatch('inventory_items',id,payload); toast('✅ Barang diupdate','ok'); }
    else {
      const created = await sbPost('inventory_items',payload);
      itemId = created?.[0]?.id || created?.id;
      if (payload.stock_qty > 0) {
        await writeStockLedger(itemId, 'IN', payload.stock_qty, payload.stock_qty, 'manual', null, null, 'Stok awal');
      }
      toast('✅ Barang ditambahkan','ok');
    }
    closeModalForce(); await loadInventory();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteItem(id) {
  if (!confirm('Hapus barang ini? Histori ledger tetap tersimpan.')) return;
  try { await sbDelete('inventory_items',id); toast('🗑 Barang dihapus','info'); await loadInventory(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// STOCK LEDGER — histori pergerakan stok selamanya
// ══════════════════════════════════════════════════════════════
async function writeStockLedger(itemId, movementType, qty, balanceAfter, refType, refId, refNumber, notes) {
  const item = invItems.find(i=>i.id===itemId) || (await sbGet('inventory_items',`select=item_code,item_name,unit_price&id=eq.${itemId}`))?.[0];
  try {
    await sbPost('stock_ledger', {
      item_id: itemId,
      item_code: item?.item_code||'',
      item_name: item?.item_name||'',
      movement_type: movementType,
      qty: qty,
      balance_after: balanceAfter,
      unit_price: item?.unit_price||0,
      ref_type: refType||null,
      ref_id: refId||null,
      ref_number: refNumber||null,
      notes: notes||null,
      created_by: getUserName?getUserName():'System',
      created_at: new Date().toISOString(),
    });
  } catch(e) { console.error('[writeStockLedger] Failed:', e); }
}

let ledgerFilter = { itemId:'', from:'', to:'' };

async function renderStockLedger() {
  const el = document.getElementById('inv-ledger');
  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <select class="table-filter" id="ledger-item" onchange="filterLedger()">
          <option value="">Semua Barang</option>
          ${invItems.map(i=>`<option value="${i.id}">${i.item_name}</option>`).join('')}
        </select>
        <input type="date" id="ledger-from" class="table-filter" onchange="filterLedger()">
        <input type="date" id="ledger-to" class="table-filter" onchange="filterLedger()">
        <button class="btn btn-ghost btn-sm" onclick="printStockLedgerPDF()">🖨 Print PDF</button>
      </div>
      <div id="ledger-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;
  await loadLedgerData();
}

let ledgerData = [];
async function loadLedgerData() {
  try {
    const data = await sbGet('stock_ledger','select=*&order=created_at.desc&limit=500');
    ledgerData = Array.isArray(data)?data:[];
    filterLedger();
  } catch(e) {
    document.getElementById('ledger-tbody').innerHTML = `<div class="status-box status-err">❌ ${e.message}</div>`;
  }
}

function filterLedger() {
  const itemId = document.getElementById('ledger-item')?.value||'';
  const from   = document.getElementById('ledger-from')?.value||'';
  const to     = document.getElementById('ledger-to')?.value||'';
  const filtered = ledgerData.filter(l => {
    if (itemId && String(l.item_id)!==itemId) return false;
    if (from && l.created_at < from) return false;
    if (to && l.created_at > to+'T23:59:59') return false;
    return true;
  });
  renderLedgerTable(filtered);
}

function renderLedgerTable(data) {
  const el = document.getElementById('ledger-tbody');
  if (!data.length) { el.innerHTML = `<div class="empty-state"><div class="ico">📜</div><h3>Belum ada pergerakan stok</h3></div>`; return; }
  const typeColor = {IN:'#22C55E', OUT:'#EF4444', ADJUST:'#F59E0B', TRANSFER:'#0EA5E9'};
  const typeLabel = {IN:'Masuk', OUT:'Keluar', ADJUST:'Adjustment', TRANSFER:'Transfer'};
  el.innerHTML = `<table><thead><tr>
    <th>Tanggal</th><th>Barang</th><th>Tipe</th><th>Qty</th><th>Saldo Akhir</th><th>Referensi</th><th>Oleh</th><th>Catatan</th>
  </tr></thead><tbody>${data.map(l=>{
    const col = typeColor[l.movement_type]||'#94A3B8';
    return `<tr>
      <td style="font-size:11px;color:var(--gray)">${new Date(l.created_at).toLocaleString('id-ID')}</td>
      <td><div style="font-weight:600;font-size:12.5px">${l.item_name}</div>
        <div style="font-size:10.5px;color:var(--gray)">${l.item_code||''}</div></td>
      <td><span style="background:${col}20;color:${col};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${typeLabel[l.movement_type]||l.movement_type}</span></td>
      <td style="font-weight:700;color:${l.qty>=0?'#16A34A':'#DC2626'}">${l.qty>=0?'+':''}${l.qty}</td>
      <td style="font-weight:700">${l.balance_after}</td>
      <td style="font-size:11px;color:var(--teal)">${l.ref_number||'—'}</td>
      <td style="font-size:11px">${l.created_by||'—'}</td>
      <td style="font-size:11px;color:var(--gray)">${l.notes||''}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

function printStockLedgerPDF() {
  const itemId = document.getElementById('ledger-item')?.value||'';
  const filtered = itemId ? ledgerData.filter(l=>String(l.item_id)===itemId) : ledgerData;
  const w = window.open('','_blank');
  w.document.write(`
    <html><head><title>Stock Ledger - OneLab</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
      h2{margin-bottom:4px} .sub{color:#666;margin-bottom:16px}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
      th{background:#f1f5f9}
    </style></head><body>
    <h2>📜 Stock Ledger — OneLab Diagnostics</h2>
    <div class="sub">Dicetak: ${new Date().toLocaleString('id-ID')} ${itemId?'· Filter: '+(invItems.find(i=>i.id==itemId)?.item_name||''):''}</div>
    <table><thead><tr><th>Tanggal</th><th>Barang</th><th>Tipe</th><th>Qty</th><th>Saldo</th><th>Ref</th><th>Oleh</th></tr></thead>
    <tbody>${filtered.map(l=>`<tr>
      <td>${new Date(l.created_at).toLocaleString('id-ID')}</td><td>${l.item_name}</td>
      <td>${l.movement_type}</td><td>${l.qty}</td><td>${l.balance_after}</td>
      <td>${l.ref_number||'-'}</td><td>${l.created_by||'-'}</td></tr>`).join('')}</tbody></table>
    <script>window.print()</script></body></html>`);
  w.document.close();
}

// ══════════════════════════════════════════════════════════════
// PURCHASE REQUEST — line item terstruktur + approval 3 jenjang + chat
// ══════════════════════════════════════════════════════════════
let prLineItems = []; // working state for the open PR form

function renderPRList() {
  const el = document.getElementById('inv-pr');
  el.innerHTML = `
    <div class="page-header" style="margin-bottom:14px">
      <div><p style="color:var(--text3);font-size:13px">Permintaan pengadaan barang dengan approval SPV → Manager → Head of Operations</p></div>
      <button class="btn btn-teal" onclick="openPRForm()">+ Buat PR</button>
    </div>
    <div class="table-wrap">
      <div id="pr-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;
  renderPRTable();
}

const PR_STATUS_COLOR = {
  'Draft':'#94A3B8', 'Menunggu SPV':'#F59E0B', 'Menunggu Manager':'#F59E0B',
  'Menunggu Head Ops':'#F59E0B', 'Approved':'#22C55E', 'Rejected':'#EF4444',
  'PO Dibuat':'#06B6D4', 'Closed':'#6B7280'
};

function renderPRTable() {
  const el = document.getElementById('pr-tbody');
  if (!el) return;
  if (!invPRs.length) { el.innerHTML = `<div class="empty-state"><div class="ico">🛒</div><h3>Belum ada Purchase Request</h3><p>Klik "+ Buat PR" untuk mulai.</p></div>`; return; }
  el.innerHTML = `<table><thead><tr>
    <th>No. PR</th><th>Deskripsi</th><th>Total Est.</th><th>Diminta Oleh</th><th>Jenjang Approval</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>${invPRs.map(p=>{
    const col = PR_STATUS_COLOR[p.status]||'#94A3B8';
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--teal)">${p.pr_number||'—'}</td>
      <td><div style="font-weight:600">${p.reason||p.notes||'—'}</div>
        <div style="font-size:11px;color:var(--gray)">${formatDateShort(p.created_at)}</div></td>
      <td style="font-size:12px;font-weight:600">${p.total_amount?formatCurrency(p.total_amount):'—'}</td>
      <td style="font-size:11px">${p.requested_by||'—'}</td>
      <td>${renderApprovalSteps(p)}</td>
      <td><span style="background:${col}20;color:${col};padding:3px 9px;border-radius:10px;font-size:11px;font-weight:700">${p.status}</span></td>
      <td><div class="act-row">
        <button class="act-btn" onclick="openPRDetail(${p.id})" title="Detail & Chat">👁️</button>
        ${p.status==='Draft'?`<button class="act-btn edit" onclick="openPRForm(${p.id})">✏️</button>`:''}
        ${p.status==='Approved'?`<button class="act-btn" onclick="convertPRtoPO(${p.id})" title="Buat PO" style="color:#06B6D4">📄</button>`:''}
      </div></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

function renderApprovalSteps(p) {
  const steps = [
    {label:'SPV', status:p.spv_status||'Pending'},
    {label:'Mgr', status:p.manager_status||'Pending'},
    {label:'HeadOps', status:p.headops_status||'Pending'},
  ];
  const icon = s => s==='Approved'?'✅':s==='Rejected'?'❌':'⏳';
  return `<div style="display:flex;gap:4px;font-size:10px">
    ${steps.map(s=>`<span title="${s.label}: ${s.status}">${icon(s.status)}${s.label}</span>`).join(' → ')}
  </div>`;
}

async function openPRForm(id=null) {
  let p = {};
  prLineItems = [];
  if (id) {
    const d = await sbGet('purchase_requests',`select=*&id=eq.${id}`); p = d[0]||{};
    const li = await sbGet('pr_items',`select=*&pr_id=eq.${id}`).catch(()=>[]);
    prLineItems = (li||[]).map(x=>({...x}));
  }
  openModal(`
    <div class="modal-header"><div class="modal-title">${id?'✏️ Edit PR':'🛒 Buat Purchase Request'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Tanggal Dibutuhkan</label>
        <input type="date" id="pf-needed" value="${p.needed_date||''}"></div>
      <div class="form-group"><label>Divisi</label>
        <input type="text" id="pf-div" value="${p.division||''}" placeholder="Laboratory, Operasional, dll"></div>
    </div>
    <div class="form-group"><label>Alasan / Justifikasi Pengadaan *</label>
      <textarea id="pf-reason" rows="2" placeholder="Alasan pengadaan...">${p.reason||''}</textarea></div>

    <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase">Detail Item</div>
        <button class="btn btn-xs btn-ghost" onclick="addPRLineItem()">+ Tambah Item</button>
      </div>
      <div id="pr-items-table"></div>
      <div style="text-align:right;font-weight:700;margin-top:8px;font-size:13px">
        Total: <span id="pr-items-total" style="color:var(--teal)">Rp 0</span>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="savePR(${id||'null'})">📤 ${id?'Simpan':'Submit PR'}</button>
    </div>`, 'wide');
  renderPRLineItemsTable();
}

function addPRLineItem() {
  prLineItems.push({ item_id:null, item_code:'', description:'', category:'', uom:'', unit_price:0, qty:1 });
  renderPRLineItemsTable();
}
function removePRLineItem(idx) { prLineItems.splice(idx,1); renderPRLineItemsTable(); }

function fillPRItemFromCatalog(idx, sel) {
  const opt = sel.options[sel.selectedIndex];
  const itemId = opt.value;
  if (!itemId) return;
  const item = invItems.find(i=>String(i.id)===itemId);
  if (!item) return;
  prLineItems[idx] = {
    ...prLineItems[idx],
    item_id: item.id, item_code: item.item_code, description: item.item_name,
    category: item.category, uom: item.unit, unit_price: item.unit_price,
  };
  renderPRLineItemsTable();
}

function renderPRLineItemsTable() {
  const el = document.getElementById('pr-items-table');
  if (!el) return;
  if (!prLineItems.length) { el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:10px 0">Belum ada item. Klik "+ Tambah Item".</div>`; updatePRTotal(); return; }
  el.innerHTML = `<table style="width:100%;font-size:12px"><thead><tr>
    <th style="text-align:left;padding:4px">Kategori</th><th style="text-align:left;padding:4px">Kode &amp; Deskripsi</th>
    <th style="padding:4px">UoM</th><th style="padding:4px">Harga</th><th style="padding:4px">Qty</th><th style="padding:4px">Subtotal</th><th></th>
  </tr></thead><tbody>${prLineItems.map((it,idx)=>`
    <tr>
      <td style="padding:4px">
        <select onchange="updatePRItemField(${idx},'category',this.value);populateItemPicker(${idx},this.value)" style="font-size:11px;padding:4px">
          <option value="">--</option>
          ${INV_CATEGORIES.map(c=>`<option${it.category===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </td>
      <td style="padding:4px">
        <select id="pr-item-picker-${idx}" onchange="fillPRItemFromCatalog(${idx},this)" style="font-size:11px;padding:4px;margin-bottom:3px;width:100%">
          <option value="">-- Pilih dari katalog (opsional) --</option>
          ${invItems.filter(i=>!it.category||i.category===it.category).map(i=>`<option value="${i.id}" ${it.item_id===i.id?'selected':''}>${i.item_code} — ${i.item_name}</option>`).join('')}
        </select>
        <input type="text" value="${it.description||''}" placeholder="Deskripsi item"
          oninput="updatePRItemField(${idx},'description',this.value)" style="font-size:11px;padding:4px;width:100%">
      </td>
      <td style="padding:4px"><input type="text" value="${it.uom||''}" style="width:55px;font-size:11px;padding:4px" oninput="updatePRItemField(${idx},'uom',this.value)"></td>
      <td style="padding:4px"><input type="number" value="${it.unit_price||0}" style="width:90px;font-size:11px;padding:4px" oninput="updatePRItemField(${idx},'unit_price',this.value)"></td>
      <td style="padding:4px"><input type="number" value="${it.qty||1}" style="width:60px;font-size:11px;padding:4px" oninput="updatePRItemField(${idx},'qty',this.value)"></td>
      <td style="padding:4px;font-weight:700">${formatCurrency((it.unit_price||0)*(it.qty||0))}</td>
      <td style="padding:4px"><button class="act-btn del" onclick="removePRLineItem(${idx})">✕</button></td>
    </tr>`).join('')}</tbody></table>`;
  updatePRTotal();
}

function populateItemPicker(idx, category) {
  const sel = document.getElementById(`pr-item-picker-${idx}`);
  if (!sel) return;
  sel.innerHTML = `<option value="">-- Pilih dari katalog (opsional) --</option>` +
    invItems.filter(i=>!category||i.category===category).map(i=>`<option value="${i.id}">${i.item_code} — ${i.item_name}</option>`).join('');
}

function updatePRItemField(idx, field, value) {
  if (!prLineItems[idx]) return;
  prLineItems[idx][field] = (field==='unit_price'||field==='qty') ? parseFloat(value)||0 : value;
  if (field==='unit_price'||field==='qty') {
    const totalEl = document.querySelector(`#pr-items-table tbody tr:nth-child(${idx+1}) td:nth-child(6)`);
    if (totalEl) totalEl.textContent = formatCurrency((prLineItems[idx].unit_price||0)*(prLineItems[idx].qty||0));
  }
  updatePRTotal();
}

function updatePRTotal() {
  const total = prLineItems.reduce((s,it)=>s+((it.unit_price||0)*(it.qty||0)),0);
  const el = document.getElementById('pr-items-total');
  if (el) el.textContent = formatCurrency(total);
}

async function savePR(id) {
  const reason = document.getElementById('pf-reason').value.trim();
  if (!reason) { toast('Alasan/justifikasi wajib diisi','err'); return; }
  if (!prLineItems.length) { toast('Tambahkan minimal 1 item','err'); return; }
  const total = prLineItems.reduce((s,it)=>s+((it.unit_price||0)*(it.qty||0)),0);

  const payload = {
    requested_by: getUserName?getUserName():'User',
    division:     document.getElementById('pf-div').value.trim(),
    needed_date:  document.getElementById('pf-needed').value||null,
    reason:       reason,
    total_amount: total,
    status:       'Menunggu SPV',
    spv_status: 'Pending', manager_status: 'Pending', headops_status: 'Pending',
    updated_at:   new Date().toISOString(),
  };

  try {
    let prId = id;
    if (id) {
      await sbPatch('purchase_requests', id, payload);
      const existingItems = await sbGet('pr_items', `select=id&pr_id=eq.${id}`).catch(()=>[]);
      for (const ex of (existingItems||[])) { await sbDelete('pr_items', ex.id).catch(()=>{}); }
    } else {
      payload.pr_number = `PR/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`;
      const created = await sbPost('purchase_requests', payload);
      prId = created?.[0]?.id || created?.id;
    }
    // Insert line items fresh
    for (const it of prLineItems) {
      await sbPost('pr_items', {
        pr_id: prId, item_id: it.item_id||null, item_code: it.item_code||'',
        description: it.description||'', category: it.category||'', uom: it.uom||'',
        unit_price: it.unit_price||0, qty: it.qty||0, subtotal: (it.unit_price||0)*(it.qty||0),
      });
    }
    toast(id?'✅ PR diupdate':'✅ PR disubmit, menunggu approval SPV','ok');
    closeModalForce(); await loadInventory(); renderPRTable();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── PR Detail Modal: line items, approval actions, chat ──────────
async function openPRDetail(id) {
  const [pData, items, chat] = await Promise.all([
    sbGet('purchase_requests',`select=*&id=eq.${id}`),
    sbGet('pr_items',`select=*&pr_id=eq.${id}`).catch(()=>[]),
    sbGet('inventory_doc_chat',`select=*&doc_type=eq.pr&doc_id=eq.${id}&order=created_at.asc`).catch(()=>[]),
  ]);
  const p = pData?.[0]; if (!p) return;

  const role = getUserRole?getUserRole():'';
  const canSPV     = invCanApproveSPV()     && p.spv_status==='Pending';
  const canManager = invCanApproveManager() && p.spv_status==='Approved' && p.manager_status==='Pending';
  const canHeadOps = invCanApproveHeadOps() && p.manager_status==='Approved' && p.headops_status==='Pending';

  openModal(`
    <div class="modal-header"><div class="modal-title">🛒 ${p.pr_number}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:12.5px">
      <div><strong>Diminta oleh:</strong> ${p.requested_by||'—'}</div>
      <div><strong>Divisi:</strong> ${p.division||'—'}</div>
      <div><strong>Dibutuhkan:</strong> ${p.needed_date||'—'}</div>
      <div><strong>Total:</strong> ${formatCurrency(p.total_amount||0)}</div>
      <div style="grid-column:1/-1"><strong>Alasan:</strong> ${p.reason||'—'}</div>
    </div>

    <table style="width:100%;font-size:11.5px;margin-bottom:14px"><thead><tr style="background:var(--bg)">
      <th style="padding:5px;text-align:left">Item</th><th style="padding:5px">UoM</th><th style="padding:5px">Harga</th><th style="padding:5px">Qty</th><th style="padding:5px">Subtotal</th>
    </tr></thead><tbody>${(items||[]).map(it=>`
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px">${it.description}</td><td style="padding:5px;text-align:center">${it.uom}</td>
        <td style="padding:5px;text-align:right">${formatCurrency(it.unit_price)}</td>
        <td style="padding:5px;text-align:center">${it.qty}</td>
        <td style="padding:5px;text-align:right;font-weight:700">${formatCurrency(it.subtotal)}</td>
      </tr>`).join('')}</tbody></table>

    <div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Jenjang Approval</div>
      ${renderApprovalDetailRow('SPV', p.spv_status, p.spv_approver, p.spv_at, p.spv_note)}
      ${renderApprovalDetailRow('Manager', p.manager_status, p.manager_approver, p.manager_at, p.manager_note)}
      ${renderApprovalDetailRow('Head of Operations', p.headops_status, p.headops_approver, p.headops_at, p.headops_note)}
    </div>

    ${(canSPV||canManager||canHeadOps)?`
    <div style="background:var(--teal-light);border-radius:var(--r);padding:12px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--teal);margin-bottom:8px">
        ⏳ Menunggu approval Anda (${canSPV?'SPV':canManager?'Manager':'Head of Operations'})
      </div>
      <textarea id="approval-note" rows="2" placeholder="Catatan (opsional)" style="width:100%;font-size:12px;margin-bottom:8px"></textarea>
      <div style="display:flex;gap:8px">
        <button class="btn btn-teal btn-sm" onclick="approvePRStep(${id},'${canSPV?'spv':canManager?'manager':'headops'}')">✅ Approve</button>
        <button class="btn btn-danger btn-sm" onclick="rejectPRStep(${id},'${canSPV?'spv':canManager?'manager':'headops'}')">❌ Reject</button>
      </div>
    </div>`:''}

    <div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">💬 Diskusi</div>
      <div id="pr-chat-thread" style="max-height:220px;overflow-y:auto;margin-bottom:10px">
        ${(chat||[]).length ? chat.map(c=>`
          <div style="margin-bottom:8px;padding:8px 10px;background:var(--bg2);border-radius:var(--r)">
            <div style="font-size:11px;font-weight:700;color:var(--navy)">${c.sender_name||'User'}
              <span style="font-weight:400;color:var(--text3);margin-left:6px">${new Date(c.created_at).toLocaleString('id-ID')}</span></div>
            <div style="font-size:12.5px;margin-top:2px">${c.message}</div>
          </div>`).join('') : '<div style="font-size:12px;color:var(--text3)">Belum ada diskusi.</div>'}
      </div>
      <div style="display:flex;gap:8px">
        <input type="text" id="pr-chat-input" placeholder="Tulis pesan..." style="flex:1;font-size:12.5px"
          onkeydown="if(event.key==='Enter')sendPRChat(${id})">
        <button class="btn btn-teal btn-sm" onclick="sendPRChat(${id})">Kirim</button>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    </div>`, 'wide');
}

function renderApprovalDetailRow(label, status, approver, at, note) {
  const icon = status==='Approved'?'✅':status==='Rejected'?'❌':'⏳';
  const color = status==='Approved'?'#22C55E':status==='Rejected'?'#EF4444':'#94A3B8';
  return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:12px">
    <span style="font-size:16px">${icon}</span>
    <div style="flex:1">
      <strong>${label}</strong> — <span style="color:${color};font-weight:600">${status}</span>
      ${approver?`<span style="color:var(--text3)"> oleh ${approver}${at?' · '+new Date(at).toLocaleString('id-ID'):''}</span>`:''}
      ${note?`<div style="font-size:11px;color:var(--text3);font-style:italic">"${note}"</div>`:''}
    </div>
  </div>`;
}

async function approvePRStep(id, step) {
  const note = document.getElementById('approval-note')?.value.trim()||null;
  const approver = getUserName?getUserName():'User';
  const now = new Date().toISOString();
  let payload = {};
  if (step==='spv') payload = { spv_status:'Approved', spv_approver:approver, spv_at:now, spv_note:note, status:'Menunggu Manager' };
  if (step==='manager') payload = { manager_status:'Approved', manager_approver:approver, manager_at:now, manager_note:note, status:'Menunggu Head Ops' };
  if (step==='headops') payload = { headops_status:'Approved', headops_approver:approver, headops_at:now, headops_note:note, status:'Approved' };
  try {
    await sbPatch('purchase_requests', id, {...payload, updated_at:now});
    toast(`✅ PR di-approve di jenjang ${step.toUpperCase()}`,'ok');
    closeModalForce(); await loadInventory(); renderPRTable();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function rejectPRStep(id, step) {
  const note = document.getElementById('approval-note')?.value.trim();
  if (!note) { toast('Catatan alasan penolakan wajib diisi','err'); return; }
  const approver = getUserName?getUserName():'User';
  const now = new Date().toISOString();
  let payload = { status:'Rejected' };
  if (step==='spv') payload = {...payload, spv_status:'Rejected', spv_approver:approver, spv_at:now, spv_note:note};
  if (step==='manager') payload = {...payload, manager_status:'Rejected', manager_approver:approver, manager_at:now, manager_note:note};
  if (step==='headops') payload = {...payload, headops_status:'Rejected', headops_approver:approver, headops_at:now, headops_note:note};
  try {
    await sbPatch('purchase_requests', id, {...payload, updated_at:now});
    toast('❌ PR ditolak','info');
    closeModalForce(); await loadInventory(); renderPRTable();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function sendPRChat(id) {
  const input = document.getElementById('pr-chat-input');
  const msg = input?.value.trim();
  if (!msg) return;
  try {
    await sbPost('inventory_doc_chat', {
      doc_type:'pr', doc_id:id, message:msg,
      sender_name: getUserName?getUserName():'User',
      sender_id: window.currentUser?.id||null,
      created_at: new Date().toISOString(),
    });
    input.value='';
    await openPRDetail(id); // refresh thread
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// PURCHASE ORDER — convert dari PR approved, terima barang → stock ledger
// ══════════════════════════════════════════════════════════════
function renderPOList() {
  const el = document.getElementById('inv-po');
  el.innerHTML = `
    <div class="page-header" style="margin-bottom:14px">
      <div><p style="color:var(--text3);font-size:13px">PO dibuat dari PR yang sudah Approved penuh (3 jenjang)</p></div>
    </div>
    <div class="table-wrap"><div id="po-tbody"><div class="loading-row"><div class="spinner"></div></div></div></div>`;
  renderPOTable();
}

const PO_STATUS_COLOR = {
  'Draft':'#94A3B8','Dikirim ke Vendor':'#F59E0B','Dikonfirmasi Vendor':'#0EA5E9',
  'Sebagian Diterima':'#F59E0B','Diterima Lengkap':'#22C55E','Closed':'#6B7280','Cancelled':'#EF4444'
};

function renderPOTable() {
  const el = document.getElementById('po-tbody');
  if (!invPOs.length) { el.innerHTML = `<div class="empty-state"><div class="ico">📄</div><h3>Belum ada Purchase Order</h3><p>PO dibuat dari PR yang sudah Approved (tab Purchase Request).</p></div>`; return; }
  el.innerHTML = `<table><thead><tr>
    <th>No. PO</th><th>Supplier</th><th>PR Asal</th><th>Total</th><th>Tgl Order</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>${invPOs.map(po=>{
    const col = PO_STATUS_COLOR[po.status]||'#94A3B8';
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--teal)">${po.po_number||'—'}</td>
      <td style="font-weight:600">${po.supplier_name||'—'}</td>
      <td style="font-size:11px;color:var(--gray)">${invPRs.find(p=>p.id===po.pr_id)?.pr_number||'—'}</td>
      <td style="font-size:12px;font-weight:600">${formatCurrency(po.total_amount||0)}</td>
      <td style="font-size:11px;color:var(--gray)">${formatDateShort(po.order_date)}</td>
      <td><span style="background:${col}20;color:${col};padding:3px 9px;border-radius:10px;font-size:11px;font-weight:700">${po.status}</span></td>
      <td><div class="act-row">
        <button class="act-btn" onclick="openPODetail(${po.id})" title="Detail">👁️</button>
        ${['Dikirim ke Vendor','Dikonfirmasi Vendor','Sebagian Diterima'].includes(po.status)?`<button class="act-btn" onclick="openReceivePO(${po.id})" title="Terima Barang" style="color:#22C55E">📥</button>`:''}
      </div></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function convertPRtoPO(prId) {
  const pr = invPRs.find(p=>p.id===prId);
  if (!pr) return;
  const items = await sbGet('pr_items',`select=*&pr_id=eq.${prId}`).catch(()=>[]);
  openModal(`
    <div class="modal-header"><div class="modal-title">📄 Buat PO dari ${pr.pr_number}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Supplier *</label>
      <select id="po-supplier">
        <option value="">-- Pilih Supplier --</option>
        ${invSuppliers.map(s=>`<option value="${s.id}">${s.supplier_name}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tanggal Order</label><input type="date" id="po-date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>Estimasi Tiba</label><input type="date" id="po-expected"></div>
    </div>
    <div class="form-group"><label>Termin Pembayaran</label>
      <input type="text" id="po-terms" placeholder="Net 30, COD, dll"></div>
    <div style="font-size:12px;color:var(--text3);margin:10px 0">
      ${(items||[]).length} item dari PR akan dimasukkan ke PO ini — total ${formatCurrency(pr.total_amount||0)}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="savePOFromPR(${prId})">📤 Buat PO</button>
    </div>`);
}

async function savePOFromPR(prId) {
  const supplierId = document.getElementById('po-supplier').value;
  if (!supplierId) { toast('Pilih supplier dulu','err'); return; }
  const supplier = invSuppliers.find(s=>String(s.id)===supplierId);
  const pr = invPRs.find(p=>p.id===prId);
  const items = await sbGet('pr_items',`select=*&pr_id=eq.${prId}`).catch(()=>[]);

  try {
    const poPayload = {
      po_number: `PO/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`,
      pr_id: prId,
      supplier_id: parseInt(supplierId),
      supplier_name: supplier?.supplier_name||'',
      order_date: document.getElementById('po-date').value,
      expected_date: document.getElementById('po-expected').value||null,
      payment_terms: document.getElementById('po-terms').value.trim(),
      status: 'Draft',
      total_amount: pr?.total_amount||0,
      created_by: getUserName?getUserName():'User',
      updated_at: new Date().toISOString(),
    };
    const created = await sbPost('purchase_orders', poPayload);
    const poId = created?.[0]?.id || created?.id;

    for (const it of (items||[])) {
      await sbPost('po_items', {
        po_id: poId, item_id: it.item_id, item_code: it.item_code,
        description: it.description, uom: it.uom, unit_price: it.unit_price,
        qty_ordered: it.qty, qty_received: 0, subtotal: it.subtotal,
      });
    }
    await sbPatch('purchase_requests', prId, { status:'PO Dibuat', updated_at:new Date().toISOString() });
    toast('✅ PO dibuat dari PR','ok');
    closeModalForce(); await loadInventory();
    switchInvTab('po', document.querySelector('#inv-tabs .tab-btn:nth-child(3)'));
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function openPODetail(id) {
  const [poData, items] = await Promise.all([
    sbGet('purchase_orders',`select=*&id=eq.${id}`),
    sbGet('po_items',`select=*&po_id=eq.${id}`).catch(()=>[]),
  ]);
  const po = poData?.[0]; if (!po) return;
  openModal(`
    <div class="modal-header"><div class="modal-title">📄 ${po.po_number}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:12.5px">
      <div><strong>Supplier:</strong> ${po.supplier_name}</div>
      <div><strong>Status:</strong> ${po.status}</div>
      <div><strong>Tgl Order:</strong> ${formatDateShort(po.order_date)}</div>
      <div><strong>Estimasi Tiba:</strong> ${po.expected_date?formatDateShort(po.expected_date):'—'}</div>
    </div>
    <table style="width:100%;font-size:11.5px"><thead><tr style="background:var(--bg)">
      <th style="padding:5px;text-align:left">Item</th><th style="padding:5px">Qty Order</th><th style="padding:5px">Qty Diterima</th><th style="padding:5px">Subtotal</th>
    </tr></thead><tbody>${(items||[]).map(it=>`
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px">${it.description}</td>
        <td style="padding:5px;text-align:center">${it.qty_ordered} ${it.uom}</td>
        <td style="padding:5px;text-align:center">${it.qty_received} ${it.uom}</td>
        <td style="padding:5px;text-align:right">${formatCurrency(it.subtotal)}</td>
      </tr>`).join('')}</tbody></table>
    <div style="text-align:right;font-weight:700;margin-top:10px">Total: ${formatCurrency(po.total_amount||0)}</div>
    ${po.status==='Draft'?`<div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="markPOSent(${id})">📤 Tandai Dikirim ke Vendor</button>
    </div>`:`<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`}
  `, 'wide');
}

async function markPOSent(id) {
  try { await sbPatch('purchase_orders',id,{status:'Dikirim ke Vendor',updated_at:new Date().toISOString()}); toast('✅ PO ditandai dikirim','ok'); closeModalForce(); await loadInventory(); renderPOTable(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

async function openReceivePO(id) {
  const [poData, items] = await Promise.all([
    sbGet('purchase_orders',`select=*&id=eq.${id}`),
    sbGet('po_items',`select=*&po_id=eq.${id}`).catch(()=>[]),
  ]);
  const po = poData?.[0]; if (!po) return;
  openModal(`
    <div class="modal-header"><div class="modal-title">📥 Terima Barang — ${po.po_number}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Isi qty yang benar-benar diterima fisik. Stok &amp; ledger akan terupdate otomatis.</div>
    <table style="width:100%;font-size:12px"><thead><tr style="background:var(--bg)">
      <th style="padding:5px;text-align:left">Item</th><th style="padding:5px">Qty Order</th><th style="padding:5px">Sudah Diterima</th><th style="padding:5px">Terima Sekarang</th>
    </tr></thead><tbody>${(items||[]).map(it=>`
      <tr style="border-bottom:1px solid var(--border)" data-po-item-id="${it.id}" data-item-id="${it.item_id||''}">
        <td style="padding:5px">${it.description}</td>
        <td style="padding:5px;text-align:center">${it.qty_ordered} ${it.uom}</td>
        <td style="padding:5px;text-align:center">${it.qty_received} ${it.uom}</td>
        <td style="padding:5px"><input type="number" class="recv-qty" min="0" max="${it.qty_ordered-it.qty_received}"
          value="${Math.max(0,it.qty_ordered-it.qty_received)}" style="width:80px;font-size:12px;padding:4px"></td>
      </tr>`).join('')}</tbody></table>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveReceivePO(${id})">📥 Konfirmasi Terima</button>
    </div>`, 'wide');
}

async function saveReceivePO(poId) {
  const rows = document.querySelectorAll('[data-po-item-id]');
  let allReceived = true, anyReceived = false;
  for (const row of rows) {
    const poItemId = row.getAttribute('data-po-item-id');
    const itemId   = row.getAttribute('data-item-id');
    const qtyInput = row.querySelector('.recv-qty');
    const recvQty  = parseFloat(qtyInput.value)||0;
    if (recvQty <= 0) continue;
    anyReceived = true;
    try {
      const poItem = await sbGet('po_items',`select=*&id=eq.${poItemId}`);
      const cur = poItem?.[0]; if (!cur) continue;
      const newReceived = (cur.qty_received||0) + recvQty;
      await sbPatch('po_items', poItemId, { qty_received: newReceived });
      if (newReceived < cur.qty_ordered) allReceived = false;

      if (itemId) {
        const item = invItems.find(i=>i.id===parseInt(itemId)) || (await sbGet('inventory_items',`select=*&id=eq.${itemId}`))?.[0];
        if (item) {
          const newStock = (item.stock_qty||0) + recvQty;
          await sbPatch('inventory_items', itemId, { stock_qty:newStock, updated_at:new Date().toISOString() });
          await writeStockLedger(parseInt(itemId), 'IN', recvQty, newStock, 'po', poId, null, `Penerimaan PO`);
        }
      }
    } catch(e) { console.error('[saveReceivePO]', e); }
  }
  if (!anyReceived) { toast('Isi minimal 1 qty penerimaan','warn'); return; }
  try {
    const allItems = await sbGet('po_items',`select=*&po_id=eq.${poId}`).catch(()=>[]);
    const fullyReceived = (allItems||[]).every(it=>it.qty_received >= it.qty_ordered);
    await sbPatch('purchase_orders', poId, {
      status: fullyReceived ? 'Diterima Lengkap' : 'Sebagian Diterima',
      updated_at: new Date().toISOString(),
    });
    toast('✅ Penerimaan barang dicatat, stok terupdate','ok');
    closeModalForce(); await loadInventory(); renderPOTable();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// STOCK OPNAME — mingguan/bulanan, print PDF cross-check fisik
// ══════════════════════════════════════════════════════════════
function renderOpnameList() {
  const el = document.getElementById('inv-opname');
  el.innerHTML = `
    <div class="page-header" style="margin-bottom:14px">
      <div><p style="color:var(--text3);font-size:13px">Stock opname mingguan/bulanan untuk cross-check fisik vs sistem</p></div>
      <button class="btn btn-teal" onclick="openOpnameForm()">+ Mulai Opname</button>
    </div>
    <div class="table-wrap"><div id="opname-tbody"><div class="loading-row"><div class="spinner"></div></div></div></div>`;
  loadOpnameList();
}

async function loadOpnameList() {
  try {
    const data = await sbGet('stock_opname','select=*&order=created_at.desc');
    invOpnames = Array.isArray(data)?data:[];
    renderOpnameTable();
  } catch(e) { document.getElementById('opname-tbody').innerHTML = `<div class="status-box status-err">❌ ${e.message}</div>`; }
}

function renderOpnameTable() {
  const el = document.getElementById('opname-tbody');
  if (!invOpnames.length) { el.innerHTML = `<div class="empty-state"><div class="ico">📋</div><h3>Belum ada sesi opname</h3></div>`; return; }
  el.innerHTML = `<table><thead><tr>
    <th>No. Opname</th><th>Tipe</th><th>Periode</th><th>Dilakukan Oleh</th><th>Item Dicek</th><th>Total Selisih</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>${invOpnames.map(o=>`
    <tr>
      <td style="font-family:monospace;font-size:11px;color:var(--teal)">${o.opname_number}</td>
      <td><span class="badge badge-gray">${o.opname_type}</span></td>
      <td style="font-size:12px">${o.period_label||'—'}</td>
      <td style="font-size:11px">${o.conducted_by||'—'}</td>
      <td style="font-size:12px">${o.total_items_checked||0}</td>
      <td style="font-size:12px;font-weight:700;color:${(o.total_selisih_value||0)<0?'#DC2626':'#16A34A'}">${formatCurrency(o.total_selisih_value||0)}</td>
      <td><span class="badge ${o.status==='Selesai'?'badge-teal':'badge-gray'}">${o.status}</span></td>
      <td><div class="act-row">
        <button class="act-btn" onclick="openOpnameDetail(${o.id})" title="Detail">👁️</button>
        <button class="act-btn" onclick="printOpnamePDF(${o.id})" title="Print PDF">🖨</button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

function openOpnameForm() {
  openModal(`
    <div class="modal-header"><div class="modal-title">📋 Mulai Stock Opname</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Tipe Opname</label>
      <select id="op-type"><option>Mingguan</option><option>Bulanan</option></select></div>
    <div class="form-group"><label>Label Periode</label>
      <input type="text" id="op-period" placeholder='Contoh: "Minggu 3 Juni 2026" / "Juni 2026"'></div>
    <div style="font-size:12px;color:var(--text3);margin:8px 0">
      Akan dibuat sesi opname berisi seluruh ${invItems.filter(i=>i.is_active!==false).length} barang aktif untuk dihitung fisik.
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="startOpname()">▶️ Mulai</button>
    </div>`);
}

async function startOpname() {
  const type = document.getElementById('op-type').value;
  const period = document.getElementById('op-period').value.trim() || `${type} - ${new Date().toLocaleDateString('id-ID')}`;
  try {
    const created = await sbPost('stock_opname', {
      opname_number: `OPN/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`,
      opname_type: type, period_label: period, status:'Draft',
      conducted_by: getUserName?getUserName():'User',
      conducted_at: new Date().toISOString(),
    });
    const opnameId = created?.[0]?.id || created?.id;
    for (const item of invItems.filter(i=>i.is_active!==false)) {
      await sbPost('stock_opname_items', {
        opname_id: opnameId, item_id: item.id, item_code: item.item_code, item_name: item.item_name,
        system_qty: item.stock_qty||0, physical_qty: item.stock_qty||0, selisih:0,
        unit_price: item.unit_price||0, selisih_value:0,
      });
    }
    toast('✅ Sesi opname dimulai, silakan isi hasil hitung fisik','ok');
    closeModalForce(); await loadOpnameList();
    openOpnameDetail(opnameId);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function openOpnameDetail(opnameId) {
  const [oData, items] = await Promise.all([
    sbGet('stock_opname',`select=*&id=eq.${opnameId}`),
    sbGet('stock_opname_items',`select=*&opname_id=eq.${opnameId}&order=item_name.asc`).catch(()=>[]),
  ]);
  const o = oData?.[0]; if (!o) return;
  const isDraft = o.status==='Draft';
  openModal(`
    <div class="modal-header"><div class="modal-title">📋 ${o.opname_number} — ${o.period_label}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <table style="width:100%;font-size:12px"><thead><tr style="background:var(--bg)">
      <th style="padding:5px;text-align:left">Barang</th><th style="padding:5px">Sistem</th><th style="padding:5px">Fisik</th><th style="padding:5px">Selisih</th>
    </tr></thead><tbody>${(items||[]).map(it=>`
      <tr data-opname-item-id="${it.id}" data-item-id="${it.item_id}" style="border-bottom:1px solid var(--border)">
        <td style="padding:5px">${it.item_name}</td>
        <td style="padding:5px;text-align:center">${it.system_qty}</td>
        <td style="padding:5px;text-align:center">
          ${isDraft?`<input type="number" class="opn-physical" value="${it.physical_qty}" style="width:70px;font-size:12px;padding:3px"
              oninput="recalcOpnameSelisih(${it.id})">`:it.physical_qty}
        </td>
        <td style="padding:5px;text-align:center;font-weight:700" id="opn-selisih-${it.id}"
          class="${it.selisih<0?'text-red':it.selisih>0?'text-green':''}">${it.selisih>0?'+':''}${it.selisih}</td>
      </tr>`).join('')}</tbody></table>
    ${isDraft?`<div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="finishOpname(${opnameId})">✅ Selesaikan Opname &amp; Update Stok</button>
    </div>`:`<div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="printOpnamePDF(${opnameId})">🖨 Print PDF</button>
    </div>`}
  `, 'wide');
}

function recalcOpnameSelisih(opnameItemId) {
  const row = document.querySelector(`[data-opname-item-id="${opnameItemId}"]`);
  if (!row) return;
  const sys = parseFloat(row.children[1].textContent)||0;
  const phys = parseFloat(row.querySelector('.opn-physical').value)||0;
  const selisih = phys - sys;
  const el = document.getElementById(`opn-selisih-${opnameItemId}`);
  if (el) { el.textContent = (selisih>0?'+':'')+selisih; el.className = selisih<0?'text-red':selisih>0?'text-green':''; }
}

async function finishOpname(opnameId) {
  if (!confirm('Selesaikan opname? Stok sistem akan disesuaikan ke hasil hitung fisik, dan tercatat di Stock Ledger.')) return;
  const rows = document.querySelectorAll('[data-opname-item-id]');
  let totalSelisihValue = 0, checked = 0;
  try {
    for (const row of rows) {
      const opnameItemId = row.getAttribute('data-opname-item-id');
      const itemId = row.getAttribute('data-item-id');
      const sys = parseFloat(row.children[1].textContent)||0;
      const physInput = row.querySelector('.opn-physical');
      const phys = physInput ? parseFloat(physInput.value)||0 : sys;
      const selisih = phys - sys;
      checked++;
      const item = invItems.find(i=>i.id===parseInt(itemId));
      const selisihValue = selisih * (item?.unit_price||0);
      totalSelisihValue += selisihValue;

      await sbPatch('stock_opname_items', opnameItemId, { physical_qty:phys, selisih, selisih_value:selisihValue });

      if (selisih !== 0 && itemId) {
        await sbPatch('inventory_items', itemId, { stock_qty:phys, updated_at:new Date().toISOString() });
        await writeStockLedger(parseInt(itemId), 'ADJUST', selisih, phys, 'opname', opnameId, null, 'Hasil Stock Opname');
      }
    }
    await sbPatch('stock_opname', opnameId, {
      status:'Selesai', total_items_checked:checked, total_selisih_value:totalSelisihValue,
    });
    toast('✅ Opname selesai, stok sistem sudah disesuaikan','ok');
    closeModalForce(); await loadInventory(); await loadOpnameList();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function printOpnamePDF(opnameId) {
  const [oData, items] = await Promise.all([
    sbGet('stock_opname',`select=*&id=eq.${opnameId}`),
    sbGet('stock_opname_items',`select=*&opname_id=eq.${opnameId}&order=item_name.asc`).catch(()=>[]),
  ]);
  const o = oData?.[0]; if (!o) return;
  const w = window.open('','_blank');
  w.document.write(`
    <html><head><title>${o.opname_number}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
      h2{margin-bottom:2px} .sub{color:#666;margin-bottom:16px}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
      th{background:#f1f5f9} .r{text-align:right} .c{text-align:center}
      .sign{margin-top:40px;display:flex;justify-content:space-between}
      .sign div{width:200px;text-align:center;border-top:1px solid #333;padding-top:4px}
    </style></head><body>
    <h2>📋 Stock Opname — ${o.opname_number}</h2>
    <div class="sub">Periode: ${o.period_label} · Tipe: ${o.opname_type} · Oleh: ${o.conducted_by} · Status: ${o.status}</div>
    <table><thead><tr><th>Kode</th><th>Nama Barang</th><th class="c">Sistem</th><th class="c">Fisik</th><th class="c">Selisih</th><th class="r">Nilai Selisih</th></tr></thead>
    <tbody>${(items||[]).map(it=>`<tr>
      <td>${it.item_code||''}</td><td>${it.item_name}</td>
      <td class="c">${it.system_qty}</td><td class="c">${it.physical_qty}</td>
      <td class="c">${it.selisih>0?'+':''}${it.selisih}</td>
      <td class="r">${formatCurrency(it.selisih_value||0)}</td>
    </tr>`).join('')}</tbody></table>
    <div class="sign">
      <div>Petugas Opname<br><br><br>${o.conducted_by}</div>
      <div>Mengetahui<br><br><br>Head of Operations</div>
    </div>
    <script>window.print()</script></body></html>`);
  w.document.close();
}

// ══════════════════════════════════════════════════════════════
// MRP — Material Requirement Planning
// ══════════════════════════════════════════════════════════════
function renderMRPDashboard() {
  const el = document.getElementById('inv-mrp');
  const active = invItems.filter(i=>i.is_active!==false);
  const needReorder = active.filter(i => (i.stock_qty||0) <= (i.reorder_point||i.min_stock||0));

  el.innerHTML = `
    <div style="font-size:13px;color:var(--text3);margin-bottom:14px">
      Reorder Point dihitung dari: (Rata-rata Pemakaian/Bulan ÷ 30 × Lead Time) + Safety Stock — diatur per barang di form Tambah/Edit Barang.
    </div>
    <div class="table-wrap">
      <table><thead><tr>
        <th>Barang</th><th>Stok Saat Ini</th><th>Reorder Point</th><th>Pemakaian/Bulan</th><th>Lead Time</th><th>Estimasi Habis</th><th>Rekomendasi</th>
      </tr></thead><tbody>${active.map(i=>{
        const stock = i.stock_qty||0;
        const usage = i.avg_monthly_usage||0;
        const rop   = i.reorder_point || i.min_stock || 0;
        const daysLeft = usage>0 ? Math.round((stock/usage)*30) : null;
        const needOrder = stock <= rop;
        const suggestedQty = needOrder ? Math.max((i.max_stock||0) - stock, Math.ceil(usage)) : 0;
        return `<tr style="${needOrder?'background:#FFF7ED':''}">
          <td><div style="font-weight:600">${i.item_name}</div><div style="font-size:10.5px;color:var(--gray)">${i.item_code}</div></td>
          <td style="text-align:center;font-weight:700;color:${needOrder?'#DC2626':'var(--navy)'}">${stock} ${i.unit||''}</td>
          <td style="text-align:center;font-size:12px">${rop}</td>
          <td style="text-align:center;font-size:12px">${usage||'—'}</td>
          <td style="text-align:center;font-size:12px">${i.lead_time_days||7} hari</td>
          <td style="text-align:center;font-size:12px">${daysLeft!==null?daysLeft+' hari':'—'}</td>
          <td>${needOrder?`<span style="color:#DC2626;font-weight:700;font-size:11.5px">⚠️ Reorder ${suggestedQty} ${i.unit||''}</span>`:'<span style="color:#16A34A;font-size:11.5px">✓ Aman</span>'}</td>
        </tr>`;
      }).join('')}</tbody></table>
    </div>
    ${needReorder.length?`<div style="margin-top:14px;text-align:right">
      <button class="btn btn-teal" onclick="generatePRFromMRP()">🛒 Buat PR Otomatis dari Rekomendasi (${needReorder.length} item)</button>
    </div>`:''}
  `;
}

async function generatePRFromMRP() {
  const active = invItems.filter(i=>i.is_active!==false);
  const needReorder = active.filter(i => (i.stock_qty||0) <= (i.reorder_point||i.min_stock||0));
  if (!needReorder.length) { toast('Tidak ada barang yang perlu reorder','info'); return; }
  prLineItems = needReorder.map(i => ({
    item_id: i.id, item_code: i.item_code, description: i.item_name, category: i.category,
    uom: i.unit, unit_price: i.unit_price,
    qty: Math.max((i.max_stock||0)-(i.stock_qty||0), Math.ceil(i.avg_monthly_usage||1)),
  }));
  openModal(`
    <div class="modal-header"><div class="modal-title">🛒 Buat PR dari Rekomendasi MRP</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Tanggal Dibutuhkan</label><input type="date" id="pf-needed" value=""></div>
      <div class="form-group"><label>Divisi</label><input type="text" id="pf-div" value="Operasional Lab"></div>
    </div>
    <div class="form-group"><label>Alasan / Justifikasi Pengadaan *</label>
      <textarea id="pf-reason" rows="2">Reorder otomatis berdasarkan rekomendasi MRP — ${needReorder.length} barang di bawah reorder point</textarea></div>
    <div id="pr-items-table"></div>
    <div style="text-align:right;font-weight:700;margin-top:8px;font-size:13px">Total: <span id="pr-items-total" style="color:var(--teal)">Rp 0</span></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="savePR(null)">📤 Submit PR</button>
    </div>`, 'wide');
  renderPRLineItemsTable();
}

// ══════════════════════════════════════════════════════════════
// SUPPLIER
// ══════════════════════════════════════════════════════════════
function renderSupplierList() {
  const el = document.getElementById('inv-supplier');
  if (!el) return;
  const header = `
    <div class="page-header" style="margin-bottom:14px">
      <div></div>
      <button class="btn btn-teal" onclick="openSupplierForm()">+ Tambah Supplier</button>
    </div>`;
  if (!invSuppliers.length) {
    el.innerHTML = header + `<div class="empty-state"><div class="ico">🏭</div><h3>Belum ada supplier</h3></div>`; return;
  }
  el.innerHTML = header + `<table>
    <thead><tr><th>Nama Supplier</th><th>Kontak</th><th>Kategori Item</th><th>Rating</th><th>Aksi</th></tr></thead>
    <tbody>${invSuppliers.map(s=>`<tr>
      <td><div style="font-weight:600;color:var(--navy)">${s.supplier_name}</div><div style="font-size:11px;color:var(--gray)">${s.address||''}</div></td>
      <td><div style="font-size:12px">${s.contact_name||'—'}</div><div style="font-size:11px;color:var(--gray)">${s.phone||''}</div></td>
      <td style="font-size:12px">${s.item_categories||'—'}</td>
      <td>${'⭐'.repeat(Math.min(5,parseInt(s.rating)||0))||'—'}</td>
      <td><div class="act-row">
        <button class="act-btn edit" onclick="openSupplierForm(${s.id})">✏️</button>
        <button class="act-btn del" onclick="deleteSupplier(${s.id})">🗑</button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

async function openSupplierForm(id=null) {
  let s = {};
  if (id) { const d = await sbGet('suppliers',`select=*&id=eq.${id}`); s=d[0]||{}; }
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Supplier':'🏭 Tambah Supplier'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1">
        <label>Nama Supplier *</label>
        <input type="text" id="sf2-name" value="${s.supplier_name||''}" placeholder="PT. Supplier ABC">
      </div>
      <div class="form-group"><label>Nama Kontak</label><input type="text" id="sf2-contact" value="${s.contact_name||''}"></div>
      <div class="form-group"><label>No. HP / WA</label><input type="text" id="sf2-phone" value="${s.phone||''}"></div>
      <div class="form-group"><label>Email</label><input type="email" id="sf2-email" value="${s.email||''}"></div>
      <div class="form-group"><label>Rating (1-5)</label><input type="number" id="sf2-rating" value="${s.rating||''}" min="1" max="5"></div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Alamat</label><input type="text" id="sf2-addr" value="${s.address||''}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Kategori Item yang Disupply</label>
        <input type="text" id="sf2-cats" value="${s.item_categories||''}" placeholder="Reagen, APD, Alkes">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Catatan</label>
        <textarea id="sf2-notes" rows="2">${s.notes||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveSupplier(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function saveSupplier(id) {
  const name = document.getElementById('sf2-name').value.trim();
  if (!name) { toast('Nama supplier wajib diisi','err'); return; }
  const payload = {
    supplier_name: name,
    contact_name: document.getElementById('sf2-contact').value.trim(),
    phone: document.getElementById('sf2-phone').value.trim(),
    email: document.getElementById('sf2-email').value.trim(),
    rating: parseFloat(document.getElementById('sf2-rating').value)||null,
    address: document.getElementById('sf2-addr').value.trim(),
    item_categories: document.getElementById('sf2-cats').value.trim(),
    notes: document.getElementById('sf2-notes').value.trim(),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) { await sbPatch('suppliers',id,payload); toast('✅ Supplier diupdate','ok'); }
    else { await sbPost('suppliers',payload); toast('✅ Supplier ditambahkan','ok'); }
    closeModalForce(); await loadInventory(); renderSupplierList();
  } catch(e) { toast('❌ '+e.message,'err'); }
}
async function deleteSupplier(id) {
  if (!confirm('Hapus supplier?')) return;
  try { await sbDelete('suppliers',id); toast('🗑 Dihapus','info'); await loadInventory(); renderSupplierList(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}
