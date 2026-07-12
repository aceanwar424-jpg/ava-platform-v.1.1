// ═══════════════════════════════════════════
// MODULE: Configuration — Product & Ref Range
// ═══════════════════════════════════════════

const PRODUCT_CATEGORIES = [
  'Hematologi','Kimia Klinik','Imunologi','Urinalisa',
  'Mikrobiologi','Patologi Anatomi','Radiologi','Fisiologi',
  'Spirometry','EKG','Audiometri','Lainnya'
];

const SAMPEL_TYPES = [
  'Darah Vena','Darah EDTA','Darah Kapiler','Urin Midstream',
  'Urin 24 Jam','Feses','Swab Tenggorokan','Swab Nasofaring',
  'Dahak','Cairan Pleura','—'
];

let prodAll = [], prodFilter = { q:'', kategori:'' };

async function renderConfigProduct() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Master Produk &amp; Tes</h1>
        <p>Kelola semua tes, layanan, harga, HPP, dan nilai rujukan</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderConfigRefRange()">📊 Ref Range</button>
        <button class="btn btn-teal" onclick="navigate('import')">📥 Import Excel</button>
        <button class="btn btn-ghost btn-sm" onclick="exportProductsCSV()">📤 Export CSV</button>
        <button class="btn btn-teal" onclick="openProductForm()">+ Tambah Tes</button>
      </div>
    </div>

    <!-- Stats -->
    <div id="prod-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <!-- Filter -->
    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="prod-q" placeholder="🔍 Cari nama tes, kode..."
          oninput="prodFilter.q=this.value;applyProdFilter()" style="flex:1">
        <select class="table-filter" id="prod-kat" onchange="prodFilter.kategori=this.value;applyProdFilter()">
          <option value="">Semua Kategori</option>
          ${PRODUCT_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
        </select>
        <select class="table-filter" id="prod-active" onchange="applyProdFilter()">
          <option value="">Semua</option>
          <option value="true">Aktif</option>
          <option value="false">Non-Aktif</option>
        </select>
      </div>
      <div id="prod-tbody">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>`;

  await loadProducts();
}

async function loadProducts() {
  try {
    const data = await sbGet('products','select=*&order=kategori.asc,nama_tes.asc');
    prodAll = Array.isArray(data) ? data : [];
    // jumlah code item aktif per produk (untuk badge panel)
    try {
      const items = await sbGet('product_items','select=product_id,is_active').catch(()=>[]);
      const cnt={}; (items||[]).forEach(it=>{ if(it.is_active!==false) cnt[it.product_id]=(cnt[it.product_id]||0)+1; });
      prodAll.forEach(p=>p._items=cnt[p.id]||0);
    } catch(e){}
    renderProdKPI();
    applyProdFilter();
  } catch(e) {
    document.getElementById('prod-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderProdKPI() {
  const el = document.getElementById('prod-kpi');
  if (!el) return;
  const active = prodAll.filter(p=>p.is_active).length;
  const byKat  = {};
  prodAll.forEach(p=>{ byKat[p.kategori]=(byKat[p.kategori]||0)+1; });
  const topKat = Object.entries(byKat).sort((a,b)=>b[1]-a[1])[0];

  el.innerHTML = [
    {label:'Total Tes',     val:prodAll.length,                 color:'#0A2342'},
    {label:'Aktif',         val:active,                         color:'#22C55E'},
    {label:'Non-Aktif',     val:prodAll.length-active,          color:'#EF4444'},
    {label:'Kategori',      val:Object.keys(byKat).length,      color:'#8B5CF6'},
    {label:'Terbanyak',     val:topKat?`${topKat[0]}`:'-',      color:'#0EA5E9'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);
      border-left:4px solid ${k.color}">
      <div style="font-size:${String(k.val).length>8?'11px':'16px'};font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

function applyProdFilter() {
  const q   = prodFilter.q.toLowerCase();
  const kat = prodFilter.kategori;
  const act = document.getElementById('prod-active')?.value;
  const f   = prodAll.filter(p=>
    (!q  || (p.nama_tes||'').toLowerCase().includes(q)||
             (p.kode_internal||'').toLowerCase().includes(q)||
             (p.loinc_code||'').toLowerCase().includes(q)) &&
    (!kat|| p.kategori===kat) &&
    (!act|| String(p.is_active)===act)
  );
  renderProdTable(f);
}

function renderProdTable(data) {
  const el = document.getElementById('prod-tbody');
  if (!data.length) {
    el.innerHTML=`<div class="empty-state"><div class="ico">🧬</div>
      <h3>${prodAll.length?'Tidak ada hasil':'Belum ada produk/tes'}</h3>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openProductForm()">+ Tambah Tes</button>
    </div>`; return;
  }

  el.innerHTML=`<table>
    <thead><tr>
      <th>Kode Internal</th><th>Kode Material</th><th>LOINC</th>
      <th>Nama Tes</th><th>Kategori</th><th>Sampel</th>
      <th>Harga</th><th>HPP</th><th>TAT</th><th>Status</th><th>Aksi</th>
    </tr></thead>
    <tbody>
    ${data.map(p=>`<tr>
      <td style="font-family:monospace;font-size:11px;font-weight:700;color:var(--teal)">${p.kode_internal||'—'}</td>
      <td style="font-family:monospace;font-size:11px;color:var(--gray)">${p.kode_material||'—'}</td>
      <td style="font-family:monospace;font-size:11px;color:var(--gray)">${p.loinc_code||'—'}</td>
      <td>
        <div style="font-weight:600;color:var(--navy)">${p.nama_tes||'—'}
          ${p._items>1?`<span style="background:#EDE9FE;color:#6D28D9;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700;margin-left:4px">🧬 PANEL ${p._items}</span>`
            :p._items===1?`<span style="background:#F1F5F9;color:#475569;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700;margin-left:4px">1 item</span>`
            :`<span title="Belum ada code item" style="background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700;margin-left:4px">⚠ 0 item</span>`}
        </div>
        ${p.sub_kategori?`<div style="font-size:10px;color:var(--gray)">${p.sub_kategori}</div>`:''}
      </td>
      <td><span class="badge badge-navy">${p.kategori||'—'}</span></td>
      <td style="font-size:11px;color:var(--gray)">${p.sampel_type||'—'}</td>
      <td>
        <div style="font-size:12px;font-weight:700;color:var(--navy)">${formatCurrency(p.harga_normal||0)}</div>
        ${p.harga_korporat?`<div style="font-size:10px;color:var(--gray)">Korp: ${formatCurrency(p.harga_korporat)}</div>`:''}
      </td>
      <td style="font-size:12px;color:var(--gray)">${p.hpp?formatCurrency(p.hpp):'—'}</td>
      <td style="font-size:11px;color:var(--gray);text-align:center">${p.waktu_tat_jam||'—'}j</td>
      <td>
        <span style="background:${p.is_active?'#E8F5E9':'#FFEBEE'};
          color:${p.is_active?'#2E7D32':'#C62828'};
          padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">
          ${p.is_active?'Aktif':'Non-Aktif'}
        </span>
      </td>
      <td>
        <div class="act-row">
          <button class="act-btn" onclick="openRefRangeForProduct(${p.id},'${(p.nama_tes||'').replace(/'/g,"\\'")}')" title="Ref Range">📊</button>
          <button class="act-btn edit" onclick="openProductForm(${p.id})">✏️</button>
          <button class="act-btn del" onclick="deleteProduct(${p.id})">🗑</button>
        </div>
      </td>
    </tr>`).join('')}
    </tbody></table>`;
}

let prodItemState = [];

async function loadProductItems(productId) {
  try {
    const items = await sbGet('product_items', `select=*&product_id=eq.${productId}&order=display_order.asc`).catch(()=>[]);
    prodItemState = (items||[]).map(r=>({ ...r }));
  } catch(e) { prodItemState = []; }
}

const SPECIMEN_TYPES = ['BLOOD, WHOLE','BLOOD, SERUM','BLOOD, PLASMA','URINE','STOOL/FECES','SWAB, NASOPHARYNGEAL',
  'SWAB, THROAT','SPUTUM','SALIVA','CSF','TISSUE','OTHER'];
const RESULT_TYPES = ['numeric','text','select'];

function piVal(v){ return v==null?'':String(v).replace(/"/g,'&quot;'); }

function renderProductItemTable() {
  const el = document.getElementById('pf-item-table'); if (!el) return;
  if (!prodItemState.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:12px;text-align:center;border:1px dashed var(--border);border-radius:8px">
      Belum ada <strong>code item</strong>. Setiap tes wajib ≥1 code item.<br>
      Tes tunggal → 1 item (SGOT→<code>SGOT</code>, Glukosa→<code>GLU</code>). Panel → banyak item (Darah Lengkap→<code>RBC/WBC/PLT…</code>).
      <div style="margin-top:10px;display:flex;gap:6px;justify-content:center">
        <button class="btn btn-teal btn-xs" onclick="autoSingleItem()">✨ 1 item = tes ini</button>
        <button class="btn btn-ghost btn-xs" onclick="addProdItem()">+ Item kosong</button>
      </div></div>`;
    return;
  }
  el.innerHTML = `
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px">
    <table style="font-size:11.5px;border-collapse:collapse;min-width:1080px">
      <thead><tr style="background:var(--bg)">
        <th style="padding:5px;width:42px">Ord</th>
        <th style="padding:5px;text-align:left;min-width:80px">Code *</th>
        <th style="padding:5px;text-align:left;min-width:150px">Nama Analit *</th>
        <th style="padding:5px;text-align:left;width:74px">Satuan</th>
        <th style="padding:5px;width:82px">Tipe Hasil</th>
        <th style="padding:5px;text-align:left;width:88px" title="LOINC per analit">LOINC</th>
        <th style="padding:5px;width:66px">Normal↓</th>
        <th style="padding:5px;width:66px">Normal↑</th>
        <th style="padding:5px;text-align:left;min-width:100px">Rujukan teks</th>
        <th style="padding:5px;text-align:left;min-width:118px">Specimen</th>
        <th style="padding:5px;text-align:left;width:86px" title="Kode transmisi analyzer (integrasi alat)">Host Code</th>
        <th style="padding:5px;width:32px" title="Aktif">✓</th><th style="padding:5px;width:28px"></th>
      </tr></thead>
      <tbody>
        ${prodItemState.map((row,i)=>`
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:3px"><input type="number" value="${row.display_order||i+1}" oninput="updateProdItem(${i},'display_order',this.value)" style="font-size:11px;padding:3px;width:38px"></td>
            <td style="padding:3px"><input type="text" value="${piVal(row.code)}" oninput="updateProdItem(${i},'code',this.value)" placeholder="RBC" style="font-size:11px;padding:3px;width:76px;font-family:monospace;font-weight:700"></td>
            <td style="padding:3px"><input type="text" value="${piVal(row.name_id)}" oninput="updateProdItem(${i},'name_id',this.value)" placeholder="Eritrosit" style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="text" value="${piVal(row.uom)}" oninput="updateProdItem(${i},'uom',this.value)" placeholder="10^6/µL" style="font-size:11px;padding:3px;width:70px"></td>
            <td style="padding:3px"><select onchange="updateProdItem(${i},'result_type',this.value)" style="font-size:11px;padding:3px;width:80px">
              ${RESULT_TYPES.map(t=>`<option ${((row.result_type||'numeric')===t)?'selected':''}>${t}</option>`).join('')}</select></td>
            <td style="padding:3px"><input type="text" value="${piVal(row.loinc_code)}" oninput="updateProdItem(${i},'loinc_code',this.value)" placeholder="789-8" style="font-size:11px;padding:3px;width:84px;font-family:monospace"></td>
            <td style="padding:3px"><input type="number" step="any" value="${row.ref_low??''}" oninput="updateProdItem(${i},'ref_low',this.value)" style="font-size:11px;padding:3px;width:62px"></td>
            <td style="padding:3px"><input type="number" step="any" value="${row.ref_high??''}" oninput="updateProdItem(${i},'ref_high',this.value)" style="font-size:11px;padding:3px;width:62px"></td>
            <td style="padding:3px"><input type="text" value="${piVal(row.ref_text)}" oninput="updateProdItem(${i},'ref_text',this.value)" placeholder="Negatif" style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><select onchange="updateProdItem(${i},'specimen_type',this.value)" style="font-size:11px;padding:3px;width:100%">
              <option value="">-- Pilih --</option>${SPECIMEN_TYPES.map(s=>`<option ${row.specimen_type===s?'selected':''}>${s}</option>`).join('')}</select></td>
            <td style="padding:3px"><input type="text" value="${piVal(row.host_code)}" oninput="updateProdItem(${i},'host_code',this.value)" placeholder="731" style="font-size:11px;padding:3px;width:84px;font-family:monospace"></td>
            <td style="padding:3px;text-align:center"><input type="checkbox" ${row.is_active!==false?'checked':''} onchange="updateProdItem(${i},'is_active',this.checked)"></td>
            <td style="padding:3px;text-align:center"><button class="btn btn-ghost btn-xs" onclick="removeProdItem(${i})" style="color:#EF4444">✕</button></td>
          </tr>`).join('')}
      </tbody>
    </table></div>
    <div style="font-size:11px;color:var(--gray);margin-top:6px">
      ${prodItemState.filter(r=>r.is_active!==false && r.name_id).length>1?'🧬 Tes ini = <strong>PANEL</strong> (banyak analit)':'▪️ Tes tunggal (1 analit)'} ·
      <strong>Host Code</strong> = kode yang dikirim analyzer saat integrasi.
    </div>`;
}

// map SAMPEL_TYPES (produk) → SPECIMEN_TYPES (label)
function mapSpecimenType(s){
  s=(s||'').toLowerCase();
  if(s.includes('serum')) return 'BLOOD, SERUM';
  if(s.includes('plasma')) return 'BLOOD, PLASMA';
  if(s.includes('edta')||s.includes('darah')||s.includes('kapiler')) return 'BLOOD, WHOLE';
  if(s.includes('urin')) return 'URINE';
  if(s.includes('feses')) return 'STOOL/FECES';
  if(s.includes('nasofaring')) return 'SWAB, NASOPHARYNGEAL';
  if(s.includes('swab')||s.includes('tenggorok')) return 'SWAB, THROAT';
  if(s.includes('dahak')||s.includes('sputum')) return 'SPUTUM';
  return '';
}

function newProdItem(over){
  return Object.assign({ code:'', uom:'', name_id:'', name_en:'', display_order:prodItemState.length+1,
    specimen_type:'', result_type:'numeric', decimals:1, loinc_code:'', ref_low:null, ref_high:null,
    ref_text:'', host_code:'', analyzer_id:null, is_active:true }, over||{});
}
function addProdItem() { prodItemState.push(newProdItem()); renderProductItemTable(); }

// Buat 1 code item otomatis dari data tes (untuk tes tunggal spt SGOT/Glukosa)
function autoSingleItem() {
  const kode = (document.getElementById('pf-kode')?.value||'').split('-').pop()||'';
  prodItemState.push(newProdItem({
    code: kode.toUpperCase(),
    name_id: document.getElementById('pf-name')?.value||'',
    uom: document.getElementById('pf-unit')?.value||'',
    loinc_code: document.getElementById('pf-loinc')?.value||'',
    specimen_type: mapSpecimenType(document.getElementById('pf-sampel')?.value),
  }));
  renderProductItemTable();
}

function removeProdItem(i) { prodItemState.splice(i,1); renderProductItemTable(); }
function updateProdItem(i,key,val) {
  if (!prodItemState[i]) return;
  if (key==='display_order') prodItemState[i][key] = parseInt(val)||1;
  else if (key==='decimals') prodItemState[i][key] = parseInt(val)||0;
  else if (key==='ref_low' || key==='ref_high') prodItemState[i][key] = (val===''||val==null)?null:parseFloat(val);
  else prodItemState[i][key] = val;
  // refresh footer panel/tunggal saat toggle aktif/nama
  if (key==='is_active' || key==='name_id') renderProductItemTable();
}

async function saveProductItems(productId) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/product_items?product_id=eq.${productId}`,{
      method:'DELETE', headers:{...SB_HEADERS,'Prefer':'return=minimal'}
    });
    const toSave = prodItemState.filter(r=>r.name_id || r.code);
    if (toSave.length) {
      await sbPost('product_items', toSave.map((r,idx)=>({
        product_id: productId, code:r.code||null, uom:r.uom||null,
        name_id:r.name_id||r.code, name_en:r.name_en||null,
        display_order:r.display_order||idx+1, specimen_type:r.specimen_type||null,
        loinc_code:r.loinc_code||null, result_type:r.result_type||'numeric', decimals:(r.decimals==null?1:r.decimals),
        ref_low:(r.ref_low===''?null:r.ref_low)??null, ref_high:(r.ref_high===''?null:r.ref_high)??null,
        ref_text:r.ref_text||null, host_code:r.host_code||null, analyzer_id:r.analyzer_id||null,
        is_active: r.is_active!==false,
      })));
    }
  } catch(e) { console.error('[saveProductItems] Failed:', e); toast('⚠️ Produk tersimpan, tapi gagal simpan code item: '+e.message,'warn',5000); }
}

async function openProductForm(id=null) {
  let p = {};
  if (id) { const d=await sbGet('products',`select=*&id=eq.${id}`); p=d[0]||{}; }
  prodItemState = [];
  if (id) await loadProductItems(id);

  // Load analyzers
  let analyzerOpts = '<option value="">-- Pilih Alat --</option>';
  try {
    const az=await sbGet('analyzers','select=id,nama_alat,merk&status=eq.Aktif&order=nama_alat');
    analyzerOpts+=(az||[]).map(a=>`<option value="${a.id}" ${p.alat_id==a.id?'selected':''}>${a.nama_alat} (${a.merk||''})</option>`).join('');
  } catch(e){}

  const newCode = `OL-${Date.now().toString().slice(-5)}`;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Produk/Tes':'🧬 Tambah Produk/Tes'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <!-- Kode-kode -->
    <div style="background:var(--lgray);border-radius:8px;padding:12px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Kode Identifikasi</div>
      <div class="form-row">
        <div class="form-group">
          <label>Kode Internal *</label>
          <input type="text" id="pf-kode" value="${p.kode_internal||newCode}" placeholder="OL-CHE-001">
        </div>
        <div class="form-group">
          <label>Kode Material</label>
          <input type="text" id="pf-mat" value="${p.kode_material||''}" placeholder="MAT-001">
        </div>
        <div class="form-group">
          <label>LOINC Code</label>
          <input type="text" id="pf-loinc" value="${p.loinc_code||''}" placeholder="2345-7">
        </div>
        <div class="form-group">
          <label title="Kode order tes ke analyzer saat integrasi alat">Host Code (alat)</label>
          <input type="text" id="pf-host" value="${p.host_code||''}" placeholder="mis. CBC5">
        </div>
      </div>
    </div>

    <!-- Info Tes -->
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1">
        <label>Nama Tes *</label>
        <input type="text" id="pf-name" value="${p.nama_tes||''}" placeholder="Gula Darah Puasa (GDP)">
      </div>
      <div class="form-group">
        <label>Kategori</label>
        <select id="pf-kat">
          ${PRODUCT_CATEGORIES.map(c=>`<option${p.kategori===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Sub Kategori</label>
        <input type="text" id="pf-subkat" value="${p.sub_kategori||''}" placeholder="Metabolisme, Lipid...">
      </div>
    </div>

    <!-- Teknis -->
    <div class="form-row">
      <div class="form-group">
        <label>Tipe Sampel</label>
        <select id="pf-sampel">
          ${SAMPEL_TYPES.map(s=>`<option${p.sampel_type===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Volume Sampel</label>
        <input type="text" id="pf-vol" value="${p.volume_sampel||''}" placeholder="2 mL">
      </div>
      <div class="form-group">
        <label>Satuan Hasil</label>
        <input type="text" id="pf-unit" value="${p.satuan_hasil||''}" placeholder="mg/dL, IU/L, %">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Metode Pemeriksaan</label>
        <input type="text" id="pf-metode" value="${p.metode||''}" placeholder="Enzymatic GOD-POD">
      </div>
      <div class="form-group">
        <label>Alat Analyzer</label>
        <select id="pf-alat">${analyzerOpts}</select>
      </div>
      <div class="form-group">
        <label>TAT (Turnaround Time, jam)</label>
        <input type="number" id="pf-tat" value="${p.waktu_tat_jam||4}" min="1">
      </div>
    </div>

    <!-- Harga -->
    <div style="border-top:1px solid var(--border);padding-top:12px;margin:12px 0">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Harga & Biaya</div>
      <div class="form-row">
        <div class="form-group">
          <label>Harga Normal (Rp)</label>
          <input type="number" id="pf-harga" value="${p.harga_normal||0}" oninput="calcProdMargin()">
        </div>
        <div class="form-group">
          <label>Harga Korporat (Rp)</label>
          <input type="number" id="pf-harga-corp" value="${p.harga_korporat||0}">
        </div>
        <div class="form-group">
          <label>HPP / COGS (Rp)</label>
          <input type="number" id="pf-hpp" value="${p.hpp||0}" oninput="calcProdMargin()">
        </div>
        <div class="form-group">
          <label>Margin (%)</label>
          <input type="text" id="pf-margin" value="${p.margin_pct||0}" readonly
            style="background:var(--lgray);font-weight:700;color:var(--teal)">
        </div>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select id="pf-active">
          <option value="true" ${p.is_active!==false?'selected':''}>Aktif</option>
          <option value="false" ${p.is_active===false?'selected':''}>Non-Aktif</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:2/-1">
        <label>Keterangan</label>
        <input type="text" id="pf-ket" value="${p.keterangan||''}" placeholder="Catatan tambahan...">
      </div>
    </div>

    ${id?`
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase">
          Code Item / Analit — tiap tes dipecah per item di modul Lab
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-teal btn-xs" onclick="autoSingleItem()">✨ 1 item = tes ini</button>
          <button class="btn btn-ghost btn-xs" onclick="addProdItem()">+ Item</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">
        Setiap analit punya <strong>Code</strong> (RBC/WBC/GLU…), <strong>LOINC</strong>, satuan, rentang normal, <strong>Specimen</strong> (jenis label),
        dan <strong>Host Code</strong> (kode transmisi analyzer untuk integrasi alat). Saat pasien memesan, tes terpecah per code item dengan nilai masing-masing.
      </div>
      <div id="pf-item-table"></div>
    </div>` : `
    <div class="status-box status-info" style="margin-top:12px;font-size:11.5px">
      ℹ️ Simpan tes dulu, lalu buka kembali untuk menambahkan <strong>Code Item / Analit</strong> (RBC/WBC/GLU…) + LOINC + integrasi alat.
    </div>`}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      ${id?`<button class="btn btn-outline btn-sm" onclick="closeModalForce();openRefRangeForProduct(${id},'${(p.nama_tes||'').replace(/'/g,"\\'")}')">📊 Ref Range</button>`:''}
      <button class="btn btn-teal" onclick="saveProduct(${id||'null'})">💾 Simpan</button>
    </div>`,'wide');

  calcProdMargin();
  if (id) renderProductItemTable();
}

function calcProdMargin() {
  const harga = parseFloat(document.getElementById('pf-harga')?.value)||0;
  const hpp   = parseFloat(document.getElementById('pf-hpp')?.value)||0;
  const margin= harga > 0 ? Math.round((harga-hpp)/harga*100) : 0;
  const el    = document.getElementById('pf-margin');
  if (el) el.value = `${margin}%`;
}

async function saveProduct(id) {
  const kode = document.getElementById('pf-kode').value.trim();
  const name = document.getElementById('pf-name').value.trim();
  if (!kode) { toast('Kode internal wajib diisi','err'); return; }
  if (!name) { toast('Nama tes wajib diisi','err'); return; }

  const harga = parseFloat(document.getElementById('pf-harga').value)||0;
  const hpp   = parseFloat(document.getElementById('pf-hpp').value)||0;
  const margin= harga > 0 ? Math.round((harga-hpp)/harga*100) : 0;
  const user  = getUserName?getUserName():'User';

  const payload = {
    kode_internal:    kode,
    kode_material:    document.getElementById('pf-mat').value.trim()||null,
    loinc_code:       document.getElementById('pf-loinc').value.trim()||null,
    nama_tes:         name,
    kategori:         document.getElementById('pf-kat').value,
    sub_kategori:     document.getElementById('pf-subkat').value.trim()||null,
    sampel_type:      document.getElementById('pf-sampel').value,
    volume_sampel:    document.getElementById('pf-vol').value.trim()||null,
    satuan_hasil:     document.getElementById('pf-unit').value.trim()||null,
    metode:           document.getElementById('pf-metode').value.trim()||null,
    alat_id:          parseInt(document.getElementById('pf-alat').value)||null,
    waktu_tat_jam:    parseInt(document.getElementById('pf-tat').value)||4,
    harga_normal:     harga,
    harga_korporat:   parseFloat(document.getElementById('pf-harga-corp').value)||0,
    hpp,
    margin_pct:       margin,
    host_code:        document.getElementById('pf-host')?.value.trim()||null,
    is_panel:         prodItemState.filter(r=>(r.name_id||r.code) && r.is_active!==false).length > 1,
    is_active:        document.getElementById('pf-active').value==='true',
    keterangan:       document.getElementById('pf-ket').value.trim()||null,
    created_by:       user,
    updated_at:       new Date().toISOString(),
  };

  try {
    let productId = id;
    if (id) { await sbPatch('products',id,payload); toast('✅ Produk diupdate','ok'); }
    else    {
      const created = await sbPost('products',payload);
      productId = created?.[0]?.id || created?.id;
      toast('✅ Produk ditambahkan','ok');
    }
    if (productId && (id || prodItemState.length)) await saveProductItems(productId);
    closeModalForce();
    await loadProducts();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteProduct(id) {
  if (!confirm('Hapus produk/tes ini? Ref range terkait juga akan terhapus.')) return;
  try { await sbDelete('products',id); toast('🗑 Dihapus','info'); await loadProducts(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════
// REF RANGE
// ══════════════════════════════════════════
let rrProductId = null, rrProductName = '';

async function renderConfigRefRange() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Reference Range / Nilai Rujukan</h1>
        <p>Nilai normal per tes — berdasarkan gender, usia, dan kondisi klinis</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderConfigProduct()">← Produk</button>
        <button class="btn btn-teal" onclick="openRRForm()">+ Tambah Range</button>
      </div>
    </div>

    <!-- Filter by product -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <select class="table-filter" id="rr-prod-filter" onchange="loadRefRanges()"
        style="min-width:250px">
        <option value="">-- Pilih Tes untuk filter --</option>
      </select>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('rr-prod-filter').value='';loadRefRanges()">Tampilkan Semua</button>
    </div>

    <div class="table-wrap">
      <div id="rr-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  // Load product options
  try {
    const prods = await sbGet('products','select=id,nama_tes,kode_internal&is_active=eq.true&order=kategori,nama_tes');
    const sel = document.getElementById('rr-prod-filter');
    if (sel) {
      (prods||[]).forEach(p=>{
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.kode_internal} — ${p.nama_tes}`;
        if (p.id === rrProductId) opt.selected = true;
        sel.appendChild(opt);
      });
    }
  } catch(e){}

  await loadRefRanges();
}

async function loadRefRanges() {
  try {
    const prodId = document.getElementById('rr-prod-filter')?.value||'';
    let q = 'select=*,products(nama_tes,kode_internal)&order=product_id.asc,age_min.asc,gender.asc';
    if (prodId) q += `&product_id=eq.${prodId}`;
    const data = await sbGet('ref_ranges', q);
    renderRRTable(Array.isArray(data)?data:[]);
  } catch(e) {
    document.getElementById('rr-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderRRTable(data) {
  const el = document.getElementById('rr-tbody');
  if (!data.length) {
    el.innerHTML=`<div class="empty-state"><div class="ico">📊</div>
      <h3>Belum ada reference range</h3>
      <p>Tambah nilai rujukan per tes untuk mendukung interpretasi hasil lab.</p>
    </div>`; return;
  }

  const colorMap={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'};

  el.innerHTML=`<table>
    <thead><tr>
      <th>Tes</th><th>Gender</th><th>Usia</th><th>Kondisi</th>
      <th>Range Normal</th><th>Unit</th><th>Critical</th>
      <th>Interpretasi</th><th>Warna</th><th>Aksi</th>
    </tr></thead>
    <tbody>
    ${data.map(r=>{
      const c = colorMap[r.color_code]||'#94A3B8';
      const prodName = r.products?.nama_tes || r.product_name || '—';
      const prodCode = r.products?.kode_internal || '';
      return `<tr>
        <td>
          <div style="font-size:12px;font-weight:600;color:var(--navy)">${prodName}</div>
          ${prodCode?`<div style="font-size:10px;color:var(--gray);font-family:monospace">${prodCode}</div>`:''}
        </td>
        <td style="font-size:12px;text-align:center">${r.gender||'All'}</td>
        <td style="font-size:11px;color:var(--gray);white-space:nowrap">
          ${r.age_min===0&&r.age_max===999?'Semua':`${r.age_min}–${r.age_max} thn`}
        </td>
        <td>
          <span style="background:${c}20;color:${c};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">
            ${r.condition_name||'—'}
          </span>
        </td>
        <td style="font-size:12px;font-weight:600;white-space:nowrap">
          ${r.range_min!==null&&r.range_max!==null?`${r.range_min} – ${r.range_max}`:'—'}
        </td>
        <td style="font-size:11px;color:var(--gray)">${r.unit||'—'}</td>
        <td style="font-size:11px;color:#EF4444;white-space:nowrap">
          ${r.critical_low!==null?`↓${r.critical_low}`:''}
          ${r.critical_high!==null?` ↑${r.critical_high}`:''}
          ${!r.critical_low&&!r.critical_high?'—':''}
        </td>
        <td style="font-size:12px">${r.interpretation||'—'}</td>
        <td><div style="width:16px;height:16px;border-radius:50%;background:${c};margin:auto"></div></td>
        <td>
          <div class="act-row">
            <button class="act-btn edit" onclick="openRRForm(${r.id})">✏️</button>
            <button class="act-btn del" onclick="deleteRR(${r.id})">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

async function openRefRangeForProduct(productId, productName) {
  rrProductId   = productId;
  rrProductName = productName;
  await renderConfigRefRange();
  const sel = document.getElementById('rr-prod-filter');
  if (sel) { sel.value = productId; await loadRefRanges(); }
}

async function openRRForm(id=null) {
  let r = {};
  if (id) { const d=await sbGet('ref_ranges',`select=*&id=eq.${id}`); r=d[0]||{}; }

  let prodOpts = '<option value="">-- Pilih Tes --</option>';
  try {
    const prods = await sbGet('products','select=id,nama_tes,kode_internal&is_active=eq.true&order=kategori,nama_tes');
    prodOpts += (prods||[]).map(p=>
      `<option value="${p.id}" data-name="${p.nama_tes}" ${(r.product_id||rrProductId)==p.id?'selected':''}>
        ${p.kode_internal} — ${p.nama_tes}
      </option>`).join('');
  } catch(e){}

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Ref Range':'📊 Tambah Reference Range'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-group">
      <label>Tes / Produk *</label>
      <select id="rrf-prod" onchange="document.getElementById('rrf-prod-name').value=this.options[this.selectedIndex].dataset.name||''">
        ${prodOpts}
      </select>
      <input type="hidden" id="rrf-prod-name" value="${r.product_name||rrProductName}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Nama Kondisi *</label>
        <input type="text" id="rrf-cond" value="${r.condition_name||''}"
          placeholder="Normal, Prediabetik, Diabetes, Hamil, Anak, ...">
        <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
          ${['Normal','Prediabetik','Diabetes','Risiko Tinggi','Kritis Rendah','Kritis Tinggi','Hamil','Anak'].map(c=>
            `<button type="button" onclick="document.getElementById('rrf-cond').value='${c}'"
              style="font-size:10px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--lgray);cursor:pointer">
              ${c}
            </button>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>Tipe Kondisi</label>
        <select id="rrf-type">
          <option value="normal" ${(r.condition_type||'normal')==='normal'?'selected':''}>Normal ✅</option>
          <option value="risk"   ${r.condition_type==='risk'?'selected':''}>Risiko ⚠️</option>
          <option value="critical" ${r.condition_type==='critical'?'selected':''}>Kritis 🔴</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Gender</label>
        <select id="rrf-gender">
          <option value="All"  ${(r.gender||'All')==='All'?'selected':''}>Semua (All)</option>
          <option value="M"    ${r.gender==='M'?'selected':''}>Laki-laki (M)</option>
          <option value="F"    ${r.gender==='F'?'selected':''}>Perempuan (F)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Usia Min (tahun)</label>
        <input type="number" id="rrf-age-min" value="${r.age_min||0}" min="0">
      </div>
      <div class="form-group">
        <label>Usia Maks (tahun)</label>
        <input type="number" id="rrf-age-max" value="${r.age_max||999}" min="0">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Nilai Min (batas bawah normal)</label>
        <input type="number" id="rrf-min" value="${r.range_min||''}" placeholder="70" step="0.01">
      </div>
      <div class="form-group">
        <label>Nilai Maks (batas atas normal)</label>
        <input type="number" id="rrf-max" value="${r.range_max||''}" placeholder="99" step="0.01">
      </div>
      <div class="form-group">
        <label>Unit</label>
        <input type="text" id="rrf-unit" value="${r.unit||''}" placeholder="mg/dL, %, IU/L">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Critical Low (nilai kritis bawah)</label>
        <input type="number" id="rrf-crit-lo" value="${r.critical_low||''}" placeholder="40" step="0.01">
      </div>
      <div class="form-group">
        <label>Critical High (nilai kritis atas)</label>
        <input type="number" id="rrf-crit-hi" value="${r.critical_high||''}" placeholder="500" step="0.01">
      </div>
      <div class="form-group">
        <label>Warna Indikator</label>
        <select id="rrf-color">
          <option value="green"  ${(r.color_code||'green')==='green'?'selected':''}>🟢 Hijau (Normal)</option>
          <option value="yellow" ${r.color_code==='yellow'?'selected':''}>🟡 Kuning (Borderline)</option>
          <option value="orange" ${r.color_code==='orange'?'selected':''}>🟠 Oranye (Risiko)</option>
          <option value="red"    ${r.color_code==='red'?'selected':''}>🔴 Merah (Kritis)</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>Interpretasi (teks singkat untuk hasil)</label>
      <input type="text" id="rrf-interp" value="${r.interpretation||''}"
        placeholder="Normal, Prediabetik, Diabetes Mellitus...">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Deskripsi Kondisi</label>
        <textarea id="rrf-desc" rows="2"
          placeholder="Penjelasan singkat kondisi ini...">${r.description||''}</textarea>
      </div>
      <div class="form-group">
        <label>Rekomendasi Tindak Lanjut</label>
        <textarea id="rrf-rec" rows="2"
          placeholder="Saran untuk pasien/dokter...">${r.recommendation||''}</textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveRR(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function saveRR(id) {
  const prodId = document.getElementById('rrf-prod').value;
  const cond   = document.getElementById('rrf-cond').value.trim();
  if (!prodId) { toast('Pilih tes dulu','err'); return; }
  if (!cond)   { toast('Nama kondisi wajib diisi','err'); return; }

  const prodName = document.getElementById('rrf-prod-name').value ||
    document.getElementById('rrf-prod').options[document.getElementById('rrf-prod').selectedIndex]?.dataset.name||'';

  const payload = {
    product_id:     parseInt(prodId),
    product_name:   prodName,
    condition_name: cond,
    condition_type: document.getElementById('rrf-type').value,
    gender:         document.getElementById('rrf-gender').value,
    age_min:        parseInt(document.getElementById('rrf-age-min').value)||0,
    age_max:        parseInt(document.getElementById('rrf-age-max').value)||999,
    range_min:      parseFloat(document.getElementById('rrf-min').value)||null,
    range_max:      parseFloat(document.getElementById('rrf-max').value)||null,
    unit:           document.getElementById('rrf-unit').value.trim()||null,
    critical_low:   parseFloat(document.getElementById('rrf-crit-lo').value)||null,
    critical_high:  parseFloat(document.getElementById('rrf-crit-hi').value)||null,
    color_code:     document.getElementById('rrf-color').value,
    interpretation: document.getElementById('rrf-interp').value.trim()||null,
    description:    document.getElementById('rrf-desc').value.trim()||null,
    recommendation: document.getElementById('rrf-rec').value.trim()||null,
  };

  try {
    if (id) { await sbPatch('ref_ranges',id,payload); toast('✅ Ref range diupdate','ok'); }
    else    { await sbPost('ref_ranges',payload);    toast('✅ Ref range ditambahkan','ok'); }
    closeModalForce();
    await loadRefRanges();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteRR(id) {
  if (!confirm('Hapus reference range ini?')) return;
  try { await sbDelete('ref_ranges',id); toast('🗑 Dihapus','info'); await loadRefRanges(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Export Products CSV ────────────────────────────
function exportProductsCSV() {
  if (!prodAll?.length) { toast('Tidak ada data','warn'); return; }
  const headers = ['Kode Internal','Nama Tes','Kategori','Sub Kategori','Sampel','Volume',
    'Satuan','Metode','TAT (Jam)','Harga Normal','Harga Korporat','HPP','Margin%','LOINC','Aktif'];
  const rows = prodAll.map(p => [
    p.kode_internal, p.nama_tes, p.kategori, p.sub_kategori||'',
    p.sampel_type||'', p.volume_sampel||'', p.satuan_hasil||'', p.metode||'',
    p.waktu_tat_jam||4, p.harga_normal||0, p.harga_korporat||0, p.hpp||0, p.margin_pct||0,
    p.loinc_code||'', p.is_active?'true':'false'
  ]);
  const csv = [headers, ...rows].map(r => r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'products_export.csv'; a.click();
  toast('📥 Export CSV berhasil','ok');
}
