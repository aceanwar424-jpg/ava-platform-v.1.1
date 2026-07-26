// ═══════════════════════════════════════════
// MODULE: Configuration — Package & Corporate
// ═══════════════════════════════════════════

let pkgAll = [], corpAll = [];

// ══════════════════════════════════════════
// PACKAGE SERVICE
// ══════════════════════════════════════════
async function renderConfigPackage() {
  if (typeof injectProShell==='function') injectProShell();
  document.getElementById('main-content').innerHTML = `
    <div class="pro-shell">
    <div class="pro-header">
      <div><h1>${svgIcon('box',18)} Package Service</h1>
        <span class="pro-sub">Master paket pemeriksaan — MCU · Screening · Gut Health · Panel</span></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="navigate('import')">${svgIcon('plus',13)} Bulk Upload</button>
        <button class="btn btn-ghost btn-sm" onclick="exportPackagesCSV()">${svgIcon('print',13)} Export</button>
        <button class="btn btn-teal btn-sm" onclick="openPackageForm()">${svgIcon('plus',14)} Buat Paket</button>
      </div>
    </div>

    <div id="pkg-kpi" class="pro-kpi"><div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div></div>

    <div id="pkg-list"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await loadPackages();
}

async function loadPackages() {
  try {
    const data = await sbGet('packages','select=*&order=kategori_paket.asc,nama_paket.asc');
    pkgAll = Array.isArray(data) ? data : [];
    renderPkgKPI();
    renderPkgList();
  } catch(e) {
    document.getElementById('pkg-list').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderPkgKPI() {
  const el = document.getElementById('pkg-kpi');
  if (!el) return;
  const active = pkgAll.filter(p=>p.is_active).length;
  el.innerHTML = [
    {label:'Total Paket', val:pkgAll.length,                    color:'#0A2342'},
    {label:'Aktif',       val:active,                           color:'#22C55E'},
    {label:'Harga Terendah', val:formatCurrency(Math.min(...pkgAll.map(p=>p.harga_normal||0))||0), color:'#0EA5E9'},
    {label:'Harga Tertinggi', val:formatCurrency(Math.max(...pkgAll.map(p=>p.harga_normal||0))||0), color:'#8B5CF6'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);border-left:4px solid ${k.color}">
      <div style="font-size:14px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

function renderPkgList() {
  const el = document.getElementById('pkg-list');
  if (!pkgAll.length) {
    el.innerHTML=`<div class="empty-state"><div class="ico"></div>
      <h3>Belum ada paket layanan</h3>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openPackageForm()">+ Buat Paket</button>
    </div>`; return;
  }

  // Group by kategori
  const byKat = {};
  pkgAll.forEach(p=>{ (byKat[p.kategori_paket||'Lainnya']=byKat[p.kategori_paket||'Lainnya']||[]).push(p); });

  el.innerHTML = Object.entries(byKat).map(([kat,pkgs])=>`
    <div style="margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;color:var(--navy);text-transform:uppercase;
        letter-spacing:.06em;padding:6px 12px;background:var(--lgray);border-radius:8px;margin-bottom:10px">
        ${kat} (${pkgs.length})
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${pkgs.map(p=>`
          <div class="card" style="padding:16px;border-top:4px solid ${p.is_active?'var(--teal)':'#ccc'}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--navy)">${p.nama_paket}</div>
                <div style="font-size:10px;font-family:monospace;color:var(--gray)">${p.kode_paket||'—'}</div>
              </div>
              <span style="background:${p.is_active?'#E8F5E9':'#FFEBEE'};
                color:${p.is_active?'#2E7D32':'#C62828'};
                padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700">
                ${p.is_active?'Aktif':'Non-Aktif'}
              </span>
            </div>

            ${p.deskripsi?`<p style="font-size:12px;color:var(--gray);margin:8px 0;line-height:1.5">${p.deskripsi}</p>`:''}

            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
              <div>
                <div style="font-size:16px;font-weight:800;color:var(--navy)">${formatCurrency(p.harga_normal||0)}</div>
                ${p.harga_korporat?`<div style="font-size:11px;color:var(--gray)">Korporat: ${formatCurrency(p.harga_korporat)}</div>`:''}
              </div>
              <div style="text-align:right">
                <div style="font-size:11px;color:var(--gray)">TAT: ${p.tat_jam||'—'} jam</div>
                ${p.target_segment?`<div style="font-size:10px;color:var(--teal)">${p.target_segment}</div>`:''}
              </div>
            </div>

            ${p.persiapan?`
              <div style="background:#FFF8E1;border-radius:6px;padding:6px 8px;margin-top:8px;font-size:11px;color:#5D4037">
                ⚠️ ${p.persiapan}
              </div>`:''}

            <div style="display:flex;gap:6px;margin-top:12px">
              <button class="btn btn-outline btn-sm" style="flex:1" onclick="openPackageItems(${p.id},'${(p.nama_paket||'').replace(/'/g,"\\'")}')">
                Isi Tes
              </button>
              <button class="btn btn-ghost btn-sm" onclick="openPackageForm(${p.id})">${icon('edit', 12)}</button>
              <button class="btn btn-ghost btn-sm" style="color:#EF4444" onclick="deletePackage(${p.id})">${icon('trash', 12)}</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

async function openPackageForm(id=null) {
  let p={};
  if (id) { const d=await sbGet('packages',`select=*&id=eq.${id}`); p=d[0]||{}; }
  const code = `PKG-${Date.now().toString().slice(-5)}`;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'Edit Paket':'Buat Paket Layanan'}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Kode Paket *</label>
        <input type="text" id="pkf-kode" value="${p.kode_paket||code}">
      </div>
      <div class="form-group" style="grid-column:2/-1">
        <label>Nama Paket *</label>
        <input type="text" id="pkf-name" value="${p.nama_paket||''}" placeholder="MCU Executive, Paket Diabetes...">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Kategori Paket</label>
        <select id="pkf-kat">
          ${['MCU Basic','MCU Executive','MCU Komprehensif','Screening Diabetes',
             'Screening Kardio','Gut Health','Gene Solution','Paket Wanita',
             'Paket Pria','Paket Lansia','Custom'].map(c=>
            `<option${p.kategori_paket===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Target Segmen</label>
        <select id="pkf-seg">
          ${['Umum','Korporat','Wanita','Pria','Lansia (>50)','Anak'].map(s=>
            `<option${p.target_segment===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Harga Normal (Rp)</label>
        <input type="number" id="pkf-harga" value="${p.harga_normal||0}">
      </div>
      <div class="form-group">
        <label>Harga Korporat (Rp)</label>
        <input type="number" id="pkf-harga-corp" value="${p.harga_korporat||0}">
      </div>
      <div class="form-group">
        <label>HPP Total (Rp)</label>
        <input type="number" id="pkf-hpp" value="${p.hpp_total||0}">
      </div>
      <div class="form-group">
        <label>TAT (jam)</label>
        <input type="number" id="pkf-tat" value="${p.tat_jam||4}" min="1">
      </div>
    </div>

    <div class="form-group">
      <label>Deskripsi Paket</label>
      <textarea id="pkf-desc" rows="2" placeholder="Daftar singkat tes yang termasuk...">${p.deskripsi||''}</textarea>
    </div>

    <div class="form-group">
      <label>Instruksi Persiapan Pasien</label>
      <textarea id="pkf-prep" rows="2" placeholder="Puasa 8-10 jam, hindari olahraga berat...">${p.persiapan||''}</textarea>
    </div>

    <div class="form-group">
      <label>Status</label>
      <select id="pkf-active">
        <option value="true" ${p.is_active!==false?'selected':''}>Aktif</option>
        <option value="false" ${p.is_active===false?'selected':''}>Non-Aktif</option>
      </select>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="savePackage(${id||'null'})">Simpan</button>
    </div>`);
}

async function savePackage(id) {
  const kode = document.getElementById('pkf-kode').value.trim();
  const name = document.getElementById('pkf-name').value.trim();
  if (!kode||!name) { toast('Kode dan nama wajib diisi','err'); return; }
  const user = getUserName?getUserName():'User';

  const payload = {
    kode_paket:      kode,
    nama_paket:      name,
    kategori_paket:  document.getElementById('pkf-kat').value,
    target_segment:  document.getElementById('pkf-seg').value,
    harga_normal:    parseFloat(document.getElementById('pkf-harga').value)||0,
    harga_korporat:  parseFloat(document.getElementById('pkf-harga-corp').value)||0,
    hpp_total:       parseFloat(document.getElementById('pkf-hpp').value)||0,
    tat_jam:         parseInt(document.getElementById('pkf-tat').value)||4,
    deskripsi:       document.getElementById('pkf-desc').value.trim()||null,
    persiapan:       document.getElementById('pkf-prep').value.trim()||null,
    is_active:       document.getElementById('pkf-active').value==='true',
    created_by:      user,
    updated_at:      new Date().toISOString(),
  };

  try {
    if (id) { await sbPatch('packages',id,payload); toast('✅ Paket diupdate','ok'); }
    else    { await sbPost('packages',payload);     toast('✅ Paket dibuat','ok'); }
    closeModalForce();
    await loadPackages();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function openPackageItems(pkgId, pkgName) {
  const items = await sbGet('package_items',
    `select=*,products(nama_tes,kode_internal,kategori)&package_id=eq.${pkgId}`).catch(()=>[]);

  let prodOpts = '';
  try {
    const prods = await sbGet('products','select=id,nama_tes,kode_internal,kategori&is_active=eq.true&order=kategori,nama_tes');
    prodOpts = (prods||[]).map(p=>`<option value="${p.id}" data-name="${p.nama_tes}">
      ${p.kode_internal} — ${p.nama_tes}</option>`).join('');
  } catch(e){}

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Tes dalam Paket: ${pkgName}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>

    <!-- Current items -->
    <div id="pkg-items-list" style="margin-bottom:14px">
      ${(items||[]).length ? `
        <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">
          Tes yang sudah ada (${items.length})
        </div>
        ${(items||[]).map(i=>`
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;
            background:var(--lgray);border-radius:6px;margin-bottom:4px">
            <span class="badge badge-navy" style="font-size:10px">${i.products?.kategori||'—'}</span>
            <span style="flex:1;font-size:12px;font-weight:600">${i.product_name||i.products?.nama_tes||'—'}</span>
            <span style="font-size:10px;color:var(--gray)">${i.is_optional?'Opsional':''}</span>
            <button onclick="deletePkgItem(${i.id})" class="act-btn del" style="padding:2px 6px">${icon('trash', 12)}</button>
          </div>`).join('')}` :
        '<div style="color:var(--gray);font-size:13px;margin-bottom:8px">Belum ada tes. Tambahkan di bawah.</div>'
      }
    </div>

    <!-- Add tes -->
    <div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
        Tambah Tes
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="pkg-add-prod" style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px">
          <option value="">-- Pilih Tes --</option>
          ${prodOpts}
        </select>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap">
          <input type="checkbox" id="pkg-optional"> Opsional
        </label>
        <button class="btn btn-teal btn-sm" onclick="addPkgItem(${pkgId})">+ Tambah</button>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Selesai</button>
    </div>`);
}

async function addPkgItem(pkgId) {
  const sel = document.getElementById('pkg-add-prod');
  const prodId = sel?.value;
  if (!prodId) { toast('Pilih tes dulu','err'); return; }
  const prodName = sel.options[sel.selectedIndex]?.dataset.name||'';
  const optional = document.getElementById('pkg-optional')?.checked||false;

  try {
    await sbPost('package_items',{
      package_id:  pkgId,
      product_id:  parseInt(prodId),
      product_name:prodName,
      qty:1,
      is_optional: optional,
    });
    toast('✅ Tes ditambahkan','ok');
    const pkg = pkgAll.find(p=>p.id===pkgId);
    await openPackageItems(pkgId, pkg?.nama_paket||'');
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deletePkgItem(id) {
  try { await sbDelete('package_items',id); toast('Dihapus','info'); }
  catch(e) { toast('❌ '+e.message,'err'); }
  const el=document.getElementById('pkg-items-list');
  if (el) el.innerHTML='<div class="loading-row"><div class="spinner"></div></div>';
}

async function deletePackage(id) {
  if (!confirm('Hapus paket ini? Item tes di dalamnya juga terhapus.')) return;
  try { await sbDelete('packages',id); toast('Dihapus','info'); await loadPackages(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════
// CORPORATE MANAGEMENT
// ══════════════════════════════════════════
async function renderConfigCorporate() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Corporate Management</h1>
        <p>Manajemen klien korporat — kontrak, billing, limit kredit</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderConfigHealthFacility()">Health Facility</button>
        <button class="btn btn-teal" onclick="navigate('import')">Import</button>
        <button class="btn btn-ghost btn-sm" onclick="exportCorporatesCSV()">Export</button>
        <button class="btn btn-teal" onclick="renderCorporateDetail()">+ Tambah Corporate</button>
      </div>
    </div>

    <!-- KPI -->
    <div id="corp-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="corp-q" placeholder="Cari nama perusahaan..." oninput="filterCorp()" style="flex:1">
        <select class="table-filter" id="corp-status" onchange="filterCorp()">
          <option value="">Semua</option>
          <option>Aktif</option><option>Non-Aktif</option><option>Suspend</option>
        </select>
        <select class="table-filter" id="corp-billing" onchange="filterCorp()">
          <option value="">Semua Billing</option>
          <option>Invoice</option><option>Prepaid</option><option>Credit</option>
        </select>
      </div>
      <div id="corp-tbody">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>`;

  await loadCorporates();
}

async function loadCorporates() {
  try {
    const data = await sbGet('corporates','select=*&order=corporate_name.asc');
    corpAll = Array.isArray(data) ? data : [];
    renderCorpKPI();
    filterCorp();
  } catch(e) {
    document.getElementById('corp-tbody').innerHTML=
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderCorpKPI() {
  const el=document.getElementById('corp-kpi');
  if (!el) return;
  const active  = corpAll.filter(c=>c.status==='Aktif').length;
  const credit  = corpAll.filter(c=>c.billing_type==='Credit');
  const totCred = credit.reduce((s,c)=>s+(c.credit_limit||0),0);
  el.innerHTML = [
    {label:'Total Corporate', val:corpAll.length,      color:'#0A2342'},
    {label:'Aktif',           val:active,              color:'#22C55E'},
    {label:'Total Credit Limit', val:formatCurrency(totCred), color:'#8B5CF6'},
    {label:'Invoice Client', val:corpAll.filter(c=>c.billing_type==='Invoice').length, color:'#0EA5E9'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);border-left:4px solid ${k.color}">
      <div style="font-size:14px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

function filterCorp() {
  const q  = (document.getElementById('corp-q')?.value||'').toLowerCase();
  const st = document.getElementById('corp-status')?.value||'';
  const bt = document.getElementById('corp-billing')?.value||'';
  const f  = corpAll.filter(c=>
    (!q || (c.corporate_name||'').toLowerCase().includes(q)) &&
    (!st|| c.status===st) &&
    (!bt|| c.billing_type===bt)
  );
  renderCorpTable(f);
}

function renderCorpTable(data) {
  const el=document.getElementById('corp-tbody');
  if (!data.length) {
    el.innerHTML=`<div class="empty-state"><div class="ico">🏢</div>
      <h3>${corpAll.length?'Tidak ada hasil':'Belum ada data corporate'}</h3>
      <button class="btn btn-teal" style="margin-top:12px" onclick="renderCorporateDetail()">+ Tambah Corporate</button>
    </div>`; return;
  }

  el.innerHTML=`<table><thead><tr>
    <th>Perusahaan</th><th>PIC</th><th>Billing</th>
    <th>Diskon</th><th>Credit Limit</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(c=>{
    const stColors={Aktif:'#22C55E','Non-Aktif':'#EF4444',Suspend:'#F59E0B'};
    const sc=stColors[c.status]||'#94A3B8';
    return `<tr>
      <td>
        <div style="font-weight:700;color:var(--navy)">${c.corporate_name||'—'}</div>
        ${c.kode_corp?`<div style="font-size:10px;color:var(--gray);font-family:monospace">${c.kode_corp}</div>`:''}
        ${c.industry?`<div style="font-size:11px;color:var(--gray)">${c.industry}</div>`:''}
      </td>
      <td>
        <div style="font-size:12px">${c.pic_name||'—'}</div>
        ${c.pic_phone?`<div style="font-size:11px;color:var(--teal)">${c.pic_phone}</div>`:''}
      </td>
      <td>
        <span class="badge badge-navy">${c.billing_type||'Invoice'}</span>
        ${c.payment_terms?`<div style="font-size:10px;color:var(--gray)">NET ${c.payment_terms} hari</div>`:''}
      </td>
      <td style="font-size:12px">
        ${c.discount_type!=='none'?`${c.discount_value}${c.discount_type==='percent'?'%':' Rp'}`:'-'}
      </td>
      <td style="font-size:12px;font-weight:600">${c.credit_limit?formatCurrency(c.credit_limit):'-'}</td>
      <td><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${c.status||'—'}</span></td>
      <td>
        <div class="act-row">
          <button class="act-btn edit" onclick="renderCorporateDetail(${c.id})" title="Detail & Edit Corporate">${icon('edit', 12)}</button>
          <button class="act-btn del" onclick="deleteCorp(${c.id})" title="Hapus Corporate">${icon('trash', 12)}</button>
        </div>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

let _corpFormId = null, _corpFormName = '';

function _caStyleTag() {
  return `<style>
    .corp-acct {
      font-family: 'Outfit', sans-serif;
      color: #1e293b;
      font-size: 13px;
    }
    .corp-acct .tab-btn {
      text-align: left;
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      color: #0f2963;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .corp-acct .tab-btn:hover:not(:disabled) {
      background: #f1f5f9;
    }
    .corp-acct .tab-btn.active {
      background: #0f2963 !important;
      color: #fff !important;
      border-color: #0f2963 !important;
    }
    .corp-acct .tab-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .corp-acct .erp-form-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12.5px;
      border: 1px solid #cbd5e1;
    }
    .corp-acct .erp-form-table td {
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      background: #fff;
    }
    .corp-acct .erp-form-table .erp-label {
      background-color: #f1f5f9;
      font-weight: 600;
      color: #0f2963;
      width: 170px;
      user-select: none;
    }
    .corp-acct .erp-form-table input[type="text"],
    .corp-acct .erp-form-table input[type="email"],
    .corp-acct .erp-form-table input[type="number"],
    .corp-acct .erp-form-table input[type="date"],
    .corp-acct .erp-form-table select,
    .corp-acct .erp-form-table textarea {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 12.5px;
      width: 100%;
      background: #fff;
      box-sizing: border-box;
      outline: none;
    }
    .corp-acct .erp-form-table input[readonly] {
      background: #e2e8f0;
      color: #475569;
      cursor: not-allowed;
    }
    .corp-acct .erp-section-title {
      background-color: #d9ebf7;
      border: 1px solid #cbd5e1;
      border-bottom: none;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
      color: #0f2963;
      margin-top: 16px;
      border-radius: 4px 4px 0 0;
    }
  </style>`;
}


async function renderCorporateDetail(id = null) {
  window.currentDetailCorpId = id;
  window.currentDetailCorpName = 'Corporate';
  let c = {};
  if (id) {
    try {
      const d = await sbGet('corporates', `select=*&id=eq.${id}`);
      c = d?.[0] || {};
      window.currentDetailCorpName = c.corporate_name;
    } catch(e) {
      toast('❌ Gagal memuat data corporate: ' + e.message, 'err');
    }
  }
  
  const kode = c.kode_corp || `CORP-${Date.now().toString().slice(-5)}`;
  const sel = (a, b) => a === b ? 'selected' : '';
  const esc = s => String(s || '').replace(/"/g, '&quot;');
  const statusVal = c.status || 'Aktif';
  const stColor = statusVal === 'Aktif' ? '#059669' : statusVal === 'Suspend' ? '#DC2626' : '#64748B';

  let partnerOpts = '<option value="">-- Link ke Partner (opsional) --</option>';
  try {
    const pts = await sbGet('partners', 'select=id,partner_name&status=eq.Aktif&order=partner_name&limit=200');
    partnerOpts += (pts || []).map(p => `<option value="${p.id}" ${c.partner_id == p.id ? 'selected' : ''}>${p.partner_name}</option>`).join('');
  } catch (e) {}

  document.getElementById('main-content').innerHTML = `
    ${_caStyleTag()}
    <div class="pro-shell corp-acct" style="max-width: 1200px; margin: 0 auto; padding: 10px;">
      
      <!-- Top Navigation Tabs Bar matching Virtu Digilab -->
      <div style="display:flex; gap:20px; border-bottom:2px solid #cbd5e1; padding-bottom:6px; margin-bottom:12px;">
        <span style="font-weight:700; color:#0f2963; text-transform:uppercase; font-size:13px; cursor:pointer;" onclick="navigate('corporate')">Configuration</span>
        <span style="font-weight:700; color:var(--teal); text-transform:uppercase; font-size:13px; cursor:pointer;" onclick="navigate('corporate')">Corporate List</span>
      </div>

      <!-- Corporate Account Forms Title Banner with Close Button -->
      <div style="background:#d9ebf7; border: 1px solid #b8d2e6; border-radius: 4px; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span style="font-weight:700; color:#0f2963; font-size:14px;">Corporate Account Forms</span>
        <button onclick="navigate('corporate')" style="background:#dc2626; color:#fff; border:none; border-radius:4px; width:22px; height:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; font-size:12px;">&times;</button>
      </div>

      <!-- Two-Column Workspace Layout -->
      <div style="display:grid; grid-template-columns: 200px 1fr; gap: 20px; align-items: start;">
        
        <!-- Left Sidebar Tabs -->
        <div style="display:flex; flex-direction:column; gap:8px;">
          <button class="tab-btn active" id="tab-btn-partner" onclick="switchCorpDetailTab('partner')">Business Partner</button>
          <button class="tab-btn" id="tab-btn-info" onclick="switchCorpDetailTab('info')">Account Info</button>
          <button class="tab-btn" id="tab-btn-employees" onclick="switchCorpDetailTab('employees')" ${id ? '' : 'disabled'} style="${id ? '' : 'opacity:0.5; cursor:not-allowed;'}">Employee List</button>
          <button class="tab-btn" id="tab-btn-import" onclick="switchCorpDetailTab('import')" ${id ? '' : 'disabled'} style="${id ? '' : 'opacity:0.5; cursor:not-allowed;'}">Import Employee</button>
          <button class="tab-btn" id="tab-btn-users" onclick="switchCorpDetailTab('users')" ${id ? '' : 'disabled'} style="${id ? '' : 'opacity:0.5; cursor:not-allowed;'}">Corporate Users</button>
        </div>

        <!-- Right Side Panel Workspace -->
        <div class="glass-card" style="padding:0; border: 1px solid #cbd5e1; border-radius:6px; background:#fff; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          
          <!-- ==================== TAB: BUSINESS PARTNER ==================== -->
          <div class="tab-content" id="tab-content-partner" style="display:block;">
            <div class="erp-section-title" style="margin-top:0; border-top:none; border-left:none; border-right:none;">Business Partner Data</div>
            <div style="padding:16px;">
              <table class="erp-form-table">
                <tr>
                  <td class="erp-label">Code</td>
                  <td><input type="text" id="cf-code" value="${esc(kode)}" readonly></td>
                  <td class="erp-label">SAP Relation *</td>
                  <td><input type="text" id="cf-saprel" value="${esc(c.sap_relation)}" placeholder="TRADE THIRD PARTY"></td>
                </tr>
                <tr>
                  <td class="erp-label">SAP ID</td>
                  <td><input type="text" id="cf-sapid" value="${esc(c.sap_id)}" placeholder="8000020470"></td>
                  <td class="erp-label">SAP Relation Period *</td>
                  <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <input type="date" id="cf-sapstart" value="${c.sap_period_start||''}">
                      <span>-</span>
                      <input type="date" id="cf-sapend" value="${c.sap_period_end||''}">
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="erp-label">Name *</td>
                  <td><input type="text" id="cf-name" value="${esc(c.corporate_name)}" placeholder="Nama Perusahaan"></td>
                  <td class="erp-label">Mobile Phone *</td>
                  <td><input type="text" id="cf-phone" value="${esc(c.pic_phone)}" placeholder="08xxxxxxxxxx"></td>
                </tr>
                <tr>
                  <td class="erp-label">Type</td>
                  <td>
                    <select id="cf-type">
                      ${['COMPANY','GOVERNMENT','INSURANCE','INDIVIDUAL'].map(t=>`<option ${sel(c.company_type||'COMPANY',t)}>${t}</option>`).join('')}
                    </select>
                  </td>
                  <td class="erp-label">Email *</td>
                  <td><input type="email" id="cf-email" value="${esc(c.pic_email)}" placeholder="hrd@perusahaan.com"></td>
                </tr>
                <tr>
                  <td class="erp-label">Brand</td>
                  <td><input type="text" id="cf-brand" value="${esc(c.brand)}" placeholder="Nama brand/unit"></td>
                  <td class="erp-label">Active</td>
                  <td>
                    <div style="display:flex; gap:16px; align-items:center;">
                      <label style="display:flex; align-items:center; gap:4px; font-weight:normal; margin:0;"><input type="radio" name="cf-status-radio" value="Aktif" ${statusVal === 'Aktif' ? 'checked' : ''} style="width:auto; margin:0;"> Yes</label>
                      <label style="display:flex; align-items:center; gap:4px; font-weight:normal; margin:0;"><input type="radio" name="cf-status-radio" value="Non-Aktif" ${statusVal !== 'Aktif' ? 'checked' : ''} style="width:auto; margin:0;"> No</label>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="erp-label">Link ke Partner</td>
                  <td>
                    <select id="cf-partner">${partnerOpts}</select>
                  </td>
                  <td class="erp-label">Multinational</td>
                  <td>
                    <div style="display:flex; gap:16px; align-items:center;">
                      <label style="display:flex; align-items:center; gap:4px; font-weight:normal; margin:0;"><input type="radio" name="cf-multi-radio" value="true" ${c.multinational ? 'checked' : ''} style="width:auto; margin:0;"> Yes</label>
                      <label style="display:flex; align-items:center; gap:4px; font-weight:normal; margin:0;"><input type="radio" name="cf-multi-radio" value="false" ${!c.multinational ? 'checked' : ''} style="width:auto; margin:0;"> No</label>
                    </div>
                  </td>
                </tr>
              </table>

              <div class="erp-section-title">Primary Address</div>
              <table class="erp-form-table">
                <tr>
                  <td class="erp-label">Address *</td>
                  <td><input type="text" id="cf-addr" value="${esc(c.address)}" placeholder="Jl. ..."></td>
                  <td class="erp-label">City</td>
                  <td><input type="text" id="cf-city" value="${esc(c.city)}" placeholder="Kota"></td>
                </tr>
                <tr>
                  <td class="erp-label">Sub District *</td>
                  <td><input type="text" id="cf-subdist" value="${esc(c.subdistrict)}" placeholder="Kecamatan/Kelurahan"></td>
                  <td class="erp-label">Province</td>
                  <td><input type="text" id="cf-prov" value="${esc(c.province)}" placeholder="Provinsi"></td>
                </tr>
                <tr>
                  <td class="erp-label">PIC Name</td>
                  <td><input type="text" id="cf-pic" value="${esc(c.pic_name)}" placeholder="Nama PIC"></td>
                  <td class="erp-label">Country</td>
                  <td><input type="text" id="cf-country" value="${esc(c.country||'INDONESIA')}"></td>
                </tr>
              </table>
              
              <!-- Tab Action Footer -->
              <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #cbd5e1; padding-top:14px;">
                <button class="btn btn-ghost btn-sm" onclick="navigate('corporate')" style="display:flex; align-items:center; gap:6px; border:1px solid #cbd5e1; padding:6px 16px;"><span style="color:#dc2626;">&times;</span> Cancel</button>
                <button class="btn btn-teal btn-sm" onclick="saveCorpDetail(${id || 'null'}, '${esc(kode)}')" style="display:flex; align-items:center; gap:6px; padding:6px 16px;">💾 Save</button>
              </div>
            </div>
          </div>

          <!-- ==================== TAB: ACCOUNT INFO ==================== -->
          <div class="tab-content" id="tab-content-info" style="display:none;">
            <div class="erp-section-title" style="margin-top:0; border-top:none; border-left:none; border-right:none;">Tax Information</div>
            <div style="padding:16px;">
              <table class="erp-form-table">
                <tr>
                  <td class="erp-label">NPWP *</td>
                  <td><input type="text" id="cf-npwp" value="${esc(c.npwp)}" placeholder="00.000.000.0-000.000"></td>
                  <td class="erp-label">Tax Type *</td>
                  <td>
                    <select id="cf-taxtype">
                      ${['BUSINESS','PERSONAL','GOVERNMENT'].map(t=>`<option ${sel(c.tax_type||'BUSINESS',t)}>${t}</option>`).join('')}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td class="erp-label">Address *</td>
                  <td><input type="text" id="cf-taxaddr" value="${esc(c.tax_address)}" placeholder="Alamat Pajak"></td>
                  <td class="erp-label">Tax Office</td>
                  <td><input type="text" id="cf-taxoffice" value="${esc(c.tax_office)}" placeholder="KPP Pratama ..."></td>
                </tr>
                <tr>
                  <td class="erp-label">Registered at</td>
                  <td><input type="date" id="cf-taxreg" value="${c.tax_registered_at||''}"></td>
                  <td class="erp-label">PPh 23 *</td>
                  <td>
                    <div style="display:flex; gap:12px; align-items:center;">
                      <label style="display:flex; align-items:center; gap:4px; font-weight:normal; margin:0;"><input type="radio" name="cf-pph23-radio" value="true" ${c.pph23 ? 'checked' : ''} style="width:auto; margin:0;"> Yes</label>
                      <label style="display:flex; align-items:center; gap:4px; font-weight:normal; margin:0;"><input type="radio" name="cf-pph23-radio" value="false" ${!c.pph23 ? 'checked' : ''} style="width:auto; margin:0;"> No</label>
                    </div>
                  </td>
                </tr>
              </table>

              <div class="erp-section-title">Bank Information</div>
              <table class="erp-form-table">
                <thead>
                  <tr style="background: #f1f5f9; font-weight: 700; text-align: center;">
                    <td style="padding:6px; border:1px solid #cbd5e1; width: 80px;">Primary</td>
                    <td style="padding:6px; border:1px solid #cbd5e1;">Name</td>
                    <td style="padding:6px; border:1px solid #cbd5e1;">Branch</td>
                    <td style="padding:6px; border:1px solid #cbd5e1;">Account Number</td>
                    <td style="padding:6px; border:1px solid #cbd5e1;">Account Name</td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:4px; border:1px solid #cbd5e1; text-align:center;"><input type="checkbox" checked disabled style="width:auto; margin:0;"></td>
                    <td style="padding:4px; border:1px solid #cbd5e1;"><input type="text" id="cf-bank" value="${esc(c.bank_name)}" placeholder="BCA" style="border:none; padding:4px; width:100%;"></td>
                    <td style="padding:4px; border:1px solid #cbd5e1;"><input type="text" id="cf-bankbranch" value="${esc(c.bank_branch)}" placeholder="Cabang" style="border:none; padding:4px; width:100%;"></td>
                    <td style="padding:4px; border:1px solid #cbd5e1;"><input type="text" id="cf-bankacc" value="${esc(c.bank_account_number)}" placeholder="No Rekening" style="border:none; padding:4px; width:100%;"></td>
                    <td style="padding:4px; border:1px solid #cbd5e1;"><input type="text" id="cf-bankname" value="${esc(c.bank_account_name)}" placeholder="Atas Nama" style="border:none; padding:4px; width:100%;"></td>
                  </tr>
                </tbody>
              </table>

              <div class="erp-section-title">Service Rate &amp; Contract Information</div>
              <table class="erp-form-table">
                <tr>
                  <td class="erp-label">Billing Type</td>
                  <td>
                    <select id="cf-billing">
                      ${['Invoice','Prepaid','Credit'].map(b=>`<option ${sel(c.billing_type||'Invoice',b)}>${b}</option>`).join('')}
                    </select>
                  </td>
                  <td class="erp-label">Payment Terms (days)</td>
                  <td><input type="number" id="cf-terms" value="${c.payment_terms||30}" min="0"></td>
                </tr>
                <tr>
                  <td class="erp-label">Credit Limit (Rp)</td>
                  <td><input type="number" id="cf-credit" value="${c.credit_limit||0}"></td>
                  <td class="erp-label">Discount Type</td>
                  <td>
                    <select id="cf-disc-type">
                      <option value="none" ${sel(c.discount_type||'none','none')}>Tidak Ada</option>
                      <option value="percent" ${sel(c.discount_type,'percent')}>Persen (%)</option>
                      <option value="fixed" ${sel(c.discount_type,'fixed')}>Nominal (Rp)</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td class="erp-label">Discount Value</td>
                  <td colspan="3"><input type="number" id="cf-disc-val" value="${c.discount_value||0}"></td>
                </tr>
              </table>

              <!-- Contracts and Packages List -->
              ${id ? `
                <div style="margin-top: 24px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px; border-bottom:1px solid #cbd5e1; padding-bottom:8px;">
                    <h5 style="margin:0; font-size:14px; font-weight:700; color:#0f2963;">Daftar Kontrak &amp; Paket</h5>
                    <button class="btn btn-teal btn-xs" onclick="openInlineContractForm(${id}, '${esc(c.corporate_name)}')">+ Kontrak Baru</button>
                  </div>
                  
                  <div id="inline-contract-form-container" style="display:none; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 14px;"></div>
                  
                  <div id="corporate-detail-contracts-list">
                    <div class="loading-row"><div class="spinner"></div></div>
                  </div>
                </div>
              ` : ''}

              <!-- Tab Action Footer -->
              <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #cbd5e1; padding-top:14px;">
                <button class="btn btn-ghost btn-sm" onclick="navigate('corporate')" style="display:flex; align-items:center; gap:6px; border:1px solid #cbd5e1; padding:6px 16px;"><span style="color:#dc2626;">&times;</span> Cancel</button>
                <button class="btn btn-teal btn-sm" onclick="saveCorpDetail(${id || 'null'}, '${esc(kode)}')" style="display:flex; align-items:center; gap:6px; padding:6px 16px;">💾 Save</button>
              </div>
            </div>
          </div>

          <!-- ==================== TAB: EMPLOYEE LIST ==================== -->
          <div class="tab-content" id="tab-content-employees" style="display:none; padding:16px;">
            <div class="erp-section-title" style="margin-top:0; border-top:none; border-left:none; border-right:none; display:flex; justify-content:space-between; align-items:center;">
              <span>Employee List</span>
              <div id="erp-cemp-badges" style="display:flex; gap:6px;"></div>
            </div>
            
            <div style="display:flex; gap:8px; margin: 12px 0;">
              <input class="table-search" id="erp-cemp-q" placeholder="Cari nama, NIK..." oninput="loadTabCorpEmployees(${id}, '${esc(c.corporate_name)}', this.value, document.getElementById('erp-cemp-status').value)" style="flex:1; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
              <select class="table-filter" id="erp-cemp-status" onchange="loadTabCorpEmployees(${id}, '${esc(c.corporate_name)}', document.getElementById('erp-cemp-q').value, this.value)" style="width: 140px; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
                <option value="">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Non-Aktif">Non-Aktif</option>
              </select>
              <button class="btn btn-teal btn-sm" onclick="openCorpEmpForm(${id}, '${esc(c.corporate_name)}')" style="padding:8px 16px;">➕ Add</button>
            </div>

            <div style="overflow-x:auto;">
              <table style="width:100%; font-size:12px; border-collapse:collapse; border:1px solid #cbd5e1;">
                <thead>
                  <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
                    <th style="padding:10px; text-align:center; width: 140px;">Action</th>
                    <th style="padding:10px; text-align:left;">Name</th>
                    <th style="padding:10px; text-align:left;">Employee Number (NIK)</th>
                    <th style="padding:10px; text-align:left;">Department</th>
                    <th style="padding:10px; text-align:center; width:100px;">Status</th>
                  </tr>
                </thead>
                <tbody id="erp-cemp-tbody">
                  <!-- Dinamis load via JS -->
                </tbody>
              </table>
            </div>

            <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:16px; border-top:1px solid #cbd5e1; padding-top:12px;">
              <button class="btn btn-sm btn-ghost" onclick="navigate('corporate')" style="border:1px solid #cbd5e1; padding:6px 16px;">Tutup</button>
            </div>
          </div>

          <!-- ==================== TAB: EMPLOYEE FORM (INLINE EDITOR) ==================== -->
          <div class="tab-content" id="tab-content-employee-form" style="display:none; padding:16px;">
            <div class="erp-section-title" id="cef-title" style="margin-top:0; border-top:none; border-left:none; border-right:none; display:flex; justify-content:space-between; align-items:center;">
              <span>Employee Forms</span>
            </div>
            
            <div style="padding:12px 0;">
              <!-- Identity Documents Grid -->
              <div style="border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 16px; background:#fff; overflow:hidden;">
                <div style="background:#f1f5f9; padding:8px 12px; font-weight:700; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center; font-size:12.5px; color:#0f2963;">
                  <span>Identity Documents</span>
                  <button class="btn btn-teal btn-xs" style="padding:4px 10px; font-size:11px; margin:0;" onclick="addIdentityDocRow()">➕ Add</button>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                  <thead>
                    <tr style="background:#f8fafc; border-bottom:1px solid #cbd5e1;">
                      <th style="padding:8px; width:60px; text-align:center;">Primary</th>
                      <th style="padding:8px; width:80px; text-align:center;">Action</th>
                      <th style="padding:8px; text-align:left;">ID</th>
                      <th style="padding:8px; text-align:left;">ID Number</th>
                      <th style="padding:8px; text-align:left;">Issuer Country</th>
                    </tr>
                  </thead>
                  <tbody id="cef-docs-tbody">
                    <tr>
                      <td style="padding:8px; text-align:center;"><input type="checkbox" id="cef-doc-primary" checked></td>
                      <td style="padding:8px; text-align:center;"><button class="btn btn-unfit btn-xs" style="color:#ef4444; border:1px solid #fecaca; background:#fff; padding:2px 6px; margin:0;">Delete</button></td>
                      <td style="padding:8px;">
                        <select id="cef-doc-type" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;">
                          <option>KTP</option><option>Paspor</option><option>BPJS</option><option>SIM</option>
                        </select>
                      </td>
                      <td style="padding:8px;"><input type="text" id="cef-doc-num" placeholder="Identity Number" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>
                      <td style="padding:8px;"><input type="text" id="cef-doc-issuer" value="INDONESIA" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Personal Data Section -->
              <div style="border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 16px; background:#fff; overflow:hidden;">
                <div style="background:#f1f5f9; padding:8px 12px; font-weight:700; border-bottom:1px solid #cbd5e1; font-size:12.5px; color:#0f2963;">Personal Data</div>
                <div style="padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                  
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Employee Number *</label>
                    <input type="text" id="cef-id" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Date Of Birth / Age *</label>
                    <input type="date" id="cef-dob" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Department *</label>
                    <input type="text" id="cef-dept" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Place Of Birth *</label>
                    <input type="text" id="cef-pob" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Level *</label>
                    <select id="cef-level" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px; background:#fff; color:#0f172a;">
                      <option>STAFF</option><option>SUPERVISOR</option><option>MANAGER</option><option>DIRECTOR</option>
                    </select>
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Blood Type *</label>
                    <select id="cef-blood" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px; background:#fff; color:#0f172a;">
                      <option value="">—</option><option>A</option><option>B</option><option>AB</option><option>O</option>
                    </select>
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Name *</label>
                    <div style="display:flex; gap:8px;">
                      <input type="text" id="cef-firstname" placeholder="First Name" style="flex:1; border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                      <input type="text" id="cef-lastname" placeholder="Last Name" style="flex:1; border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                    </div>
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Marital Status *</label>
                    <select id="cef-marital" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px; background:#fff; color:#0f172a;">
                      <option value="">—</option><option>Single</option><option>Married</option><option>Divorced</option>
                    </select>
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Job Position *</label>
                    <input type="text" id="cef-job" placeholder="Supervisor, Manager..." style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Religion</label>
                    <select id="cef-religion" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px; background:#fff; color:#0f172a;">
                      <option value="">—</option><option>Islam</option><option>Kristen Protestan</option><option>Katolik</option><option>Hindu</option><option>Buddha</option><option>Khonghucu</option>
                    </select>
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Email *</label>
                    <input type="email" id="cef-email" placeholder="email@perusahaan.com" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Ethnic *</label>
                    <input type="text" id="cef-ethnic" value="JAWA" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Gender *</label>
                    <select id="cef-gender" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px; background:#fff; color:#0f172a;">
                      <option value="M">Male</option><option value="F">Female</option>
                    </select>
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Country of Birth *</label>
                    <input type="text" id="cef-country" value="INDONESIA" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Mobile Phone *</label>
                    <div style="display:flex; gap:4px;">
                      <select id="cef-phonecode" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px; background:#fff; color:#0f172a;"><option>+62</option><option>+1</option><option>+65</option></select>
                      <input type="text" id="cef-phone" placeholder="8xxxxxxxx" style="flex:1; border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                    </div>
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Citizenship Category</label>
                    <div style="display:flex; gap:12px; font-size:12px;">
                      <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="radio" name="cef-citizenship" value="WNI" checked> WNI</label>
                      <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="radio" name="cef-citizenship" value="WNA"> WNA</label>
                    </div>
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Status *</label>
                    <select id="cef-status" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px; background:#fff; color:#0f172a;">
                      <option value="Non-Aktif">Non-Aktif (Terdaftar)</option>
                      <option value="Aktif">Aktif</option>
                    </select>
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Special Notes</label>
                    <input type="text" id="cef-notes" placeholder="Alergi, kondisi khusus..." style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>

                </div>
              </div>

              <!-- Primary Address Section -->
              <div style="border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 16px; background:#fff; overflow:hidden;">
                <div style="background:#f1f5f9; padding:8px 12px; font-weight:700; border-bottom:1px solid #cbd5e1; font-size:12.5px; color:#0f2963;">Primary Address</div>
                <div style="padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                  
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:start; grid-row: span 2;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963; margin-top:6px;">Address *</label>
                    <textarea id="cef-address" placeholder="Alamat Lengkap" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px; height:80px; resize:none;"></textarea>
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">City *</label>
                    <input type="text" id="cef-city" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Province *</label>
                    <input type="text" id="cef-province" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Sub District *</label>
                    <input type="text" id="cef-subdistrict" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Country *</label>
                    <input type="text" id="cef-address-country" value="INDONESIA" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>

                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">District *</label>
                    <input type="text" id="cef-district" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>
                  <div class="form-group-inline" style="display:grid; grid-template-columns: 140px 1fr; gap:10px; align-items:center;">
                    <label style="font-weight:600; font-size:11.5px; color:#0f2963;">Postal Code *</label>
                    <input type="text" id="cef-postal" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px; font-size:12px;">
                  </div>

                </div>
              </div>

            </div>

            <!-- Form Action Footer -->
            <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid #cbd5e1; padding-top:14px; margin-top:12px;">
              <button class="btn btn-ghost btn-sm" onclick="closeCorpEmpFormInline()" style="border:1px solid #cbd5e1; padding:6px 16px;">Cancel</button>
              <button class="btn btn-teal btn-sm" id="cef-submit-btn" onclick="saveCorpEmpInline()" style="padding:6px 20px; margin:0;">💾 Save</button>
            </div>
          </div>

          <!-- ==================== TAB: IMPORT EMPLOYEE ==================== -->
          <div class="tab-content" id="tab-content-import" style="display:none; padding:16px;">
            <div class="erp-section-title" style="margin-top:0; border-top:none; border-left:none; border-right:none;">Import Data Employee</div>
            
            <div style="background:#FFF8E1; border-radius:8px; padding:12px; margin: 14px 0; font-size:12px; color:#b7791f; border: 1px solid #fef3c7;">
              ⚠️ Format CSV yang didukung: <strong>nama,nik,departemen,gender(M/F),tanggal_lahir,phone,email</strong>
            </div>

            <table class="erp-form-table">
              <tr>
                <td class="erp-label">Company Name</td>
                <td><input type="text" value="${esc(c.corporate_name)}" readonly></td>
              </tr>
              <tr>
                <td class="erp-label">Upload File</td>
                <td>
                  <input type="file" id="erp-cemp-csv" accept=".csv" onchange="previewCSVImportInline(this, ${id})" style="padding:4px;">
                </td>
              </tr>
            </table>

            <div id="erp-csv-preview" style="max-height:220px; overflow-y:auto; margin-top:14px; border:1px solid #cbd5e1; border-radius:6px; display:none;"></div>

            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px; border-top:1px solid #cbd5e1; padding-top:14px;">
              <button class="btn btn-ghost btn-sm" onclick="clearImportInline()" style="border:1px solid #cbd5e1;">Clear</button>
              <button class="btn btn-sm" onclick="downloadTemplateKaryawan()" style="border:1px solid #cbd5e1;">📋 Download Template</button>
              <button class="btn btn-teal btn-sm" id="erp-csv-import-btn" onclick="processCSVImportInline(${id})" disabled>💾 Load File</button>
              <button class="btn btn-ghost btn-sm" onclick="navigate('corporate')" style="border:1px solid #cbd5e1;">Cancel</button>
            </div>
          </div>

          <!-- ==================== TAB: CORPORATE USERS ==================== -->
          <div class="tab-content" id="tab-content-users" style="display:none; padding:16px;">
            <div class="erp-section-title" style="margin-top:0; border-top:none; border-left:none; border-right:none;">Corporate Users Settings</div>
            
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:14px; margin-bottom:16px;">
              <span style="font-weight:700; color:#0f2963; font-size:12.5px; display:block; margin-bottom:6px;">Link Existing User Account</span>
              <div style="display:flex; gap:8px;">
                <select id="erp-corp-user-select" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; color:#0f172a; font-size:12.5px;">
                  <!-- Dinamis load via JS -->
                </select>
                <select id="erp-corp-role-select" style="width:140px; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; color:#0f172a; font-size:12.5px;">
                  <option value="requestor">Requestor</option>
                  <option value="approver">Approver</option>
                  <option value="">None / View Only</option>
                </select>
                <button class="btn btn-teal btn-sm" onclick="linkUserToCorporate(${id})" style="padding:8px 16px; margin:0;">➕ Link User</button>
              </div>
            </div>

            <div style="overflow-x:auto;">
              <table style="width:100%; font-size:12px; border-collapse:collapse; border:1px solid #cbd5e1;">
                <thead>
                  <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
                    <th style="padding:10px; text-align:left;">Name</th>
                    <th style="padding:10px; text-align:left;">Email</th>
                    <th style="padding:10px; text-align:left;">Phone</th>
                    <th style="padding:10px; text-align:left; width:180px;">Role in Corporate</th>
                    <th style="padding:10px; text-align:center; width:100px;">Action</th>
                  </tr>
                </thead>
                <tbody id="erp-cusers-tbody">
                  <!-- Dinamis load via JS -->
                </tbody>
              </table>
            </div>

            <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:16px; border-top:1px solid #cbd5e1; padding-top:12px;">
              <button class="btn btn-sm btn-ghost" onclick="navigate('corporate')" style="border:1px solid #cbd5e1; padding:6px 16px;">Tutup</button>
            </div>
          </div>

        </div>

      </div>
      
    </div>`;

  if (id) {
    await loadCorporateDetailContracts(id, c.corporate_name);
  }
}

// Global Tab switcher for Corporate Config Details
window.switchCorpDetailTab = function(tabId) {
  document.querySelectorAll('.corp-acct .tab-content').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelectorAll('.corp-acct .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeContent = document.getElementById(`tab-content-${tabId}`);
  if (activeContent) activeContent.style.display = 'block';

  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Trigger content loader on tab switch
  if (tabId === 'employees') {
    const corpId = window.currentDetailCorpId;
    const corpName = window.currentDetailCorpName || 'Corporate';
    if (corpId) {
      loadTabCorpEmployees(corpId, corpName);
    }
  } else if (tabId === 'users') {
    const corpId = window.currentDetailCorpId;
    if (corpId) {
      loadTabCorpUsers(corpId);
    }
  }
};

// Global Employee List loader for erp-style tab inside Corporate Config
window.loadTabCorpEmployees = async function(corpId, corpName, query = '', statusFilter = '') {
  const tbody = document.getElementById('erp-cemp-tbody');
  const countBadgeContainer = document.getElementById('erp-cemp-badges');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text3);"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

  try {
    let url = `select=*&corporate_id=eq.${corpId}&order=full_name.asc`;
    if (statusFilter) {
      url += `&status=eq.${statusFilter}`;
    }
    const [emps, pkgs] = await Promise.all([
      sbGet('corporate_employees', url).catch(() => []),
      sbGet('packages', 'select=id,nama_paket&is_active=eq.true&order=nama_paket').catch(() => [])
    ]);

    let filtered = emps || [];
    if (query) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(e => 
        (e.full_name || '').toLowerCase().includes(q) ||
        (e.employee_id || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q)
      );
    }

    const activeCount = emps.filter(e => e.status === 'Aktif').length;
    const inactiveCount = emps.filter(e => e.status === 'Non-Aktif').length;
    const assignedCount = emps.filter(e => e.package_id).length;
    const bookedCount = emps.filter(e => e.booking_admission_id).length;

    if (countBadgeContainer) {
      countBadgeContainer.innerHTML = `
        <span class="badge badge-green">${activeCount} Aktif</span>
        <span class="badge badge-gray">${inactiveCount} Non-Aktif</span>
        <span class="badge" style="background:#EEF2FF;color:#3730A3; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">${assignedCount} Berpaket</span>
        <span class="badge" style="background:#E0F2FE;color:#0369A1; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">${bookedCount} Booking</span>
      `;
    }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text3);">Belum ada karyawan.</td></tr>`;
      return;
    }

    const pkgOpts = (empPkgId) => `<option value="">— pilih paket —</option>` +
      (pkgs||[]).map(p=>`<option value="${p.id}" ${p.id===empPkgId?'selected':''}>${p.nama_paket}</option>`).join('');

    const esc = s => String(s || '').replace(/"/g, '&quot;');
    const partnerEsc = corpName.replace(/'/g, "\\'");

    tbody.innerHTML = filtered.map((e, idx) => {
      const nm = e.full_name || '—';
      const department = e.department || '—';
      const employee_id = e.employee_id || '—';
      return `
        <tr style="border-bottom:1px solid #cbd5e1;">
          <td style="padding:8px; text-align:center;">
            <div style="display:flex; gap:6px; justify-content:center;">
              <button class="act-btn edit" onclick="openCorpEmpForm(${corpId},'${partnerEsc}',${e.id})" style="padding:4px 8px; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer; background:#fff;">Edit</button>
              <button class="act-btn del" onclick="deleteCorpEmp(${e.id},${corpId},'${partnerEsc}')" style="padding:4px 8px; border-radius:4px; border:1px solid #ef4444; color:#ef4444; cursor:pointer; background:#fff;">Delete</button>
            </div>
          </td>
          <td style="padding:8px; font-weight:600;">${nm}</td>
          <td style="padding:8px; font-family:monospace;">${employee_id}</td>
          <td style="padding:8px;">${department}</td>
          <td style="padding:8px; text-align:center;">
            <span style="background:${e.status==='Aktif'?'#E8F5E9':'#F1F5F9'};
              color:${e.status==='Aktif'?'#2E7D32':'#546E7A'};
              padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">
              ${e.status||'Non-Aktif'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#ef4444;">Gagal memuat data: ${e.message}</td></tr>`;
  }
};
window.loadTabCorpUsers = async function(corpId) {
  const tbody = document.getElementById('erp-cusers-tbody');
  const select = document.getElementById('erp-corp-user-select');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text3);"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

  try {
    const [linkedUsers, allUsers, emps] = await Promise.all([
      sbGet('user_profiles', `select=*&corporate_id=eq.${corpId}&order=full_name.asc`).catch(() => []),
      sbGet('user_profiles', `select=*&order=full_name.asc`).catch(() => []),
      sbGet('corporate_employees', `select=id,full_name,email,phone&corporate_id=eq.${corpId}&order=full_name.asc`).catch(() => [])
    ]);

    if (select) {
      let optionsHtml = '<option value="">-- Pilih Karyawan atau User Profile --</option>';
      
      if (emps && emps.length) {
        optionsHtml += '<optgroup label="Daftar Karyawan">';
        emps.forEach(e => {
          optionsHtml += `<option value="emp_${e.id}">${e.full_name} (${e.email || 'No Email'}) [Karyawan]</option>`;
        });
        optionsHtml += '</optgroup>';
      }

      const unlinkedUsers = (allUsers || []).filter(u => u.corporate_id !== corpId);
      if (unlinkedUsers.length) {
        optionsHtml += '<optgroup label="User Profiles (Registered)">';
        unlinkedUsers.forEach(u => {
          optionsHtml += `<option value="usr_${u.id}">${u.full_name} (${u.email || 'No Email'}) [User]</option>`;
        });
        optionsHtml += '</optgroup>';
      }
      
      select.innerHTML = optionsHtml;
    }

    if (!linkedUsers.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text3);">Belum ada user corporate yang ditautkan. Silakan tautkan di atas.</td></tr>`;
      return;
    }

    tbody.innerHTML = linkedUsers.map(u => {
      return `
        <tr style="border-bottom:1px solid #cbd5e1;">
          <td style="padding:10px 8px; font-weight:600; color:#0f2963;">${u.full_name || '—'}</td>
          <td style="padding:10px 8px; color:#475569;">${u.email || '—'}</td>
          <td style="padding:10px 8px; color:#475569;">${u.phone || '—'}</td>
          <td style="padding:10px 8px;">
            <select onchange="updateUserCorpRole('${u.id}', this.value, ${corpId})" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; color:#0f172a; font-size:12px;">
              <option value="requestor" ${u.corp_role === 'requestor' ? 'selected' : ''}>Requestor</option>
              <option value="approver" ${u.corp_role === 'approver' ? 'selected' : ''}>Approver</option>
              <option value="" ${!u.corp_role ? 'selected' : ''}>None / View Only</option>
            </select>
          </td>
          <td style="padding:10px 8px; text-align:center;">
            <button class="btn btn-unfit btn-xs" style="color:#ef4444; border:1px solid #fecaca; background:#fff; padding:4px 8px; margin:0;" onclick="unlinkUserFromCorporate('${u.id}', ${corpId})">Unlink</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#ef4444;">Gagal memuat user: ${e.message}</td></tr>`;
  }
};

window.linkUserToCorporate = async function(corpId) {
  const selectedVal = document.getElementById('erp-corp-user-select')?.value;
  const corpRole = document.getElementById('erp-corp-role-select')?.value || null;
  const corpName = window.currentDetailCorpName || 'Corporate';
  if (!selectedVal) { toast('Silakan pilih karyawan atau user terlebih dahulu', 'err'); return; }

  try {
    if (selectedVal.startsWith('usr_')) {
      const userId = selectedVal.slice(4);
      await sbPatch('user_profiles', userId, {
        corporate_id: corpId,
        corporate_name: corpName,
        corp_role: corpRole,
        updated_at: new Date().toISOString()
      });
      toast('✅ User berhasil ditautkan ke corporate', 'ok');
    } else if (selectedVal.startsWith('emp_')) {
      const empId = parseInt(selectedVal.slice(4));
      const empData = await sbGet('corporate_employees', `select=*&id=eq.${empId}`);
      const emp = empData?.[0];
      if (!emp) { toast('Karyawan tidak ditemukan', 'err'); return; }

      let userProfile = null;
      if (emp.email) {
        const matchingProfs = await sbGet('user_profiles', `select=*&email=eq.${emp.email}`);
        userProfile = matchingProfs?.[0];
      }
      if (!userProfile) {
        const matchingProfs = await sbGet('user_profiles', `select=*&full_name=eq.${emp.full_name}`);
        userProfile = matchingProfs?.[0];
      }

      if (userProfile) {
        await sbPatch('user_profiles', userProfile.id, {
          corporate_id: corpId,
          corporate_name: corpName,
          corp_role: corpRole,
          updated_at: new Date().toISOString()
        });
        toast(`✅ Akun login ${userProfile.full_name} ditautkan sebagai ${corpRole || 'none'}`, 'ok');
      } else {
        const newUuid = 'c' + Math.random().toString(36).substring(2, 15) + '-0000-0000-0000-000000000000';
        await sbPost('user_profiles', {
          id: newUuid,
          full_name: emp.full_name,
          email: emp.email,
          phone: emp.phone,
          role: 'corporate',
          corporate_id: corpId,
          corporate_name: corpName,
          corp_role: corpRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        toast(`✅ User profile baru dibuat & ditautkan untuk ${emp.full_name}`, 'ok');
      }
    }
    loadTabCorpUsers(corpId);
  } catch(e) {
    toast('❌ Gagal menautkan: ' + e.message, 'err');
  }
};

window.updateUserCorpRole = async function(userId, corpRole, corpId) {
  try {
    await sbPatch('user_profiles', userId, {
      corp_role: corpRole || null,
      updated_at: new Date().toISOString()
    });
    toast('✅ Peran corporate berhasil diperbarui', 'ok');
    loadTabCorpUsers(corpId);
  } catch(e) {
    toast('❌ Gagal memperbarui peran: ' + e.message, 'err');
  }
};

window.unlinkUserFromCorporate = async function(userId, corpId) {
  if (!confirm('Apakah Anda yakin ingin melepas tautan user ini dari corporate?')) return;
  try {
    await sbPatch('user_profiles', userId, {
      corporate_id: null,
      corporate_name: null,
      corp_role: null,
      updated_at: new Date().toISOString()
    });
    toast('✅ Tautan user berhasil dilepas', 'ok');
    loadTabCorpUsers(corpId);
  } catch(e) {
    toast('❌ Gagal melepas tautan: ' + e.message, 'err');
  }
};

// Global CSV Import Helpers for inline ERP tab
let inlineCsvRows = [];

window.downloadTemplateKaryawan = function() {
  const headers = [
    'first_name', 'last_name', 'nik', 'department', 'level', 'job_position',
    'gender', 'birth_date', 'place_of_birth', 'blood_type', 'marital_status',
    'phone', 'email', 'id_type', 'id_number', 'country_of_birth',
    'address', 'city', 'subdistrict', 'district', 'province', 'postal_code',
    'citizenship', 'package_name'
  ];
  const sampleRow = [
    'Andi', 'Firmansyah', 'QH-0039', 'Gizi', 'STAFF', 'Nutritional Officer',
    'M', '1975-10-03', 'Jakarta', 'O', 'Married', '81904966319', 'andi.firmansyah@queenhealth.co.id',
    'KTP', '3171010310750001', 'INDONESIA', 'Jl. Tebet Barat No. 12', 'Jakarta Selatan', 'Tebet', 'Tebet', 'DKI Jakarta', '12810',
    'WNI', 'Paket Gold'
  ];
  
  const csvContent = "\uFEFF" + [headers.join(','), sampleRow.join(',')].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "template_import_karyawan.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.previewCSVImportInline = function(input, corpId) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim());
    inlineCsvRows = lines.slice(1).map(l => {
      const parts = l.split(',').map(v=>v.trim().replace(/"/g,''));
      return {
        first_name: parts[0],
        last_name: parts[1],
        nik: parts[2],
        dept: parts[3],
        level: parts[4],
        job: parts[5],
        gender: parts[6],
        dob: parts[7],
        pob: parts[8],
        blood: parts[9],
        marital: parts[10],
        phone: parts[11],
        email: parts[12],
        id_type: parts[13],
        id_number: parts[14],
        country_of_birth: parts[15],
        address: parts[16],
        city: parts[17],
        subdistrict: parts[18],
        district: parts[19],
        province: parts[20],
        postal: parts[21],
        citizenship: parts[22],
        package_name: parts[23]
      };
    }).filter(r => r.first_name);

    const el = document.getElementById('erp-csv-preview');
    if (el) {
      el.style.display = 'block';
      el.innerHTML = `
        <div style="font-size:12px;color:var(--gray);padding:8px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">${inlineCsvRows.length} data ditemukan</div>
        <table style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;">
            <th style="padding:6px;text-align:left;border-right:1px solid #cbd5e1;">Nama</th>
            <th style="padding:6px;text-align:left;border-right:1px solid #cbd5e1;">NIK</th>
            <th style="padding:6px;text-align:left;border-right:1px solid #cbd5e1;">Dept</th>
            <th style="padding:6px;text-align:left;">Gender</th>
          </tr></thead>
          <tbody>
            ${inlineCsvRows.slice(0,5).map(r=>`<tr style="border-bottom:1px solid #cbd5e1">
              <td style="padding:6px;border-right:1px solid #cbd5e1;font-weight:600;">${r.first_name} ${r.last_name||''}</td>
              <td style="padding:6px;font-family:monospace;border-right:1px solid #cbd5e1;">${r.nik||'—'}</td>
              <td style="padding:6px;border-right:1px solid #cbd5e1;">${r.dept||'—'}</td>
              <td style="padding:6px;">${r.gender||'—'}</td>
            </tr>`).join('')}
            ${inlineCsvRows.length>5?`<tr><td colspan="4" style="padding:6px;text-align:center;color:var(--gray);background:#f8fafc;">...dan ${inlineCsvRows.length-5} lainnya</td></tr>`:''}
          </tbody>
        </table>`;
    }

    const btn = document.getElementById('erp-csv-import-btn');
    if (btn) btn.disabled = false;
  };
  reader.readAsText(file);
};

window.processCSVImportInline = async function(corpId) {
  if (!inlineCsvRows.length) { toast('Tidak ada data','err'); return; }
  const btn = document.getElementById('erp-csv-import-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
  const user = getUserName?getUserName():'User';
  const corpName = window.currentDetailCorpName || 'Corporate';
  let added = 0;

  let allPkgs = [];
  try {
    allPkgs = await sbGet('packages', 'select=id,nama_paket&is_active=eq.true');
  } catch(e){}

  for (const row of inlineCsvRows) {
    if (!row.first_name) continue;
    
    let pkgId = null;
    let resolvedPkgName = null;
    if (row.package_name) {
      const matchPkg = allPkgs.find(p => p.nama_paket.toLowerCase().trim() === row.package_name.toLowerCase().trim());
      if (matchPkg) {
        pkgId = matchPkg.id;
        resolvedPkgName = matchPkg.nama_paket;
      }
    }

    const full_name = [row.first_name, row.last_name].filter(Boolean).join(' ');
    const notes = (row.job || row.level) ? `Position: ${row.job || '—'}, Level: ${row.level || '—'}` : null;

    try {
      await sbPost('corporate_employees',{
        corporate_id:   corpId,
        corporate_name: corpName,
        full_name,
        employee_id:    row.nik||null,
        department:     row.dept||null,
        gender:         row.gender||'M',
        birth_date:     row.dob||null,
        phone:          row.phone||null,
        email:          row.email||null,
        status:         'Non-Aktif',
        package_id:     pkgId,
        package_name:   resolvedPkgName,
        notes,
        updated_at:     new Date().toISOString(),
      });
      added++;
    } catch(e){}
  }
  toast(`✅ ${added} karyawan berhasil diimport`,'ok');
  clearImportInline();
  switchCorpDetailTab('employees');
};

window.clearImportInline = function() {
  const fileInput = document.getElementById('erp-cemp-csv');
  if (fileInput) fileInput.value = '';
  const previewDiv = document.getElementById('erp-csv-preview');
  if (previewDiv) {
    previewDiv.innerHTML = '';
    previewDiv.style.display = 'none';
  }
  const btn = document.getElementById('erp-csv-import-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '💾 Load File';
  }
  inlineCsvRows = [];
};

async function saveCorpDetail(id, defaultKode) {
  const name = document.getElementById('cf-name')?.value.trim();
  if (!name) { toast('Nama perusahaan wajib diisi', 'err'); return; }

  const v = id => { const el = document.getElementById(id); return el ? (el.value.trim() || null) : null; };
  const user = getUserName ? getUserName() : 'User';
  
  const statusVal = document.querySelector('input[name="cf-status-radio"]:checked')?.value || 'Aktif';
  const multinationalVal = document.querySelector('input[name="cf-multi-radio"]:checked')?.value === 'true';
  const pph23Val = document.querySelector('input[name="cf-pph23-radio"]:checked')?.value === 'true';

  const payload = {
    corporate_name: name,
    kode_corp: v('cf-code') || defaultKode,
    brand: v('cf-brand'),
    industry: v('cf-industry'),
    company_type: v('cf-type') || 'COMPANY',
    partner_id: parseInt(v('cf-partner')) || null,
    sap_id: v('cf-sapid'),
    sap_relation: v('cf-saprel'),
    sap_period_start: v('cf-sapstart') || null,
    sap_period_end: v('cf-sapend') || null,
    multinational: multinationalVal,
    status: statusVal,
    
    pic_name: v('cf-pic'),
    pic_phone: v('cf-phone'),
    pic_email: v('cf-email'),
    address: v('cf-addr'),
    subdistrict: v('cf-subdist'),
    city: v('cf-city'),
    province: v('cf-prov'),
    country: v('cf-country') || 'INDONESIA',
    
    billing_type: v('cf-billing') || 'Invoice',
    payment_terms: parseInt(v('cf-terms')) || 30,
    credit_limit: parseFloat(v('cf-credit')) || 0,
    discount_type: v('cf-disc-type') || 'none',
    discount_value: parseFloat(v('cf-disc-val')) || 0,
    
    npwp: v('cf-npwp'),
    tax_type: v('cf-taxtype') || 'BUSINESS',
    pph23: pph23Val,
    tax_address: v('cf-taxaddr'),
    tax_registered_at: v('cf-taxreg') || null,
    tax_office: v('cf-taxoffice'),
    
    bank_name: v('cf-bank'),
    bank_branch: v('cf-bankbranch'),
    bank_account_number: v('cf-bankacc'),
    bank_account_name: v('cf-bankname'),
    
    created_by: user,
    updated_at: new Date().toISOString()
  };

  try {
    if (id) {
      await sbPatch('corporates', id, payload);
      toast('✅ Data corporate berhasil diperbarui', 'ok');
    } else {
      payload.created_at = new Date().toISOString();
      await sbPost('corporates', payload);
      toast('✅ Corporate baru berhasil ditambahkan', 'ok');
    }
    navigate('corporate');
  } catch(e) {
    toast('❌ ' + e.message, 'err');
  }
}

async function loadCorporateDetailContracts(corpId, corpName) {
  const el = document.getElementById('corporate-detail-contracts-list');
  if (!el) return;
  
  try {
    const [contracts, pkgs] = await Promise.all([
      sbGet('corporate_contracts', `select=*&corporate_id=eq.${corpId}&order=created_at.desc`),
      sbGet('packages', 'select=id,nama_paket').catch(() => [])
    ]);
    
    if (!contracts || !contracts.length) {
      el.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center;">Belum ada kontrak. Klik "+ Kontrak Baru" untuk membuat.</div>`;
      return;
    }
    
    // Create a map of packageId -> packageName
    const pkgMap = {};
    (pkgs || []).forEach(p => { pkgMap[p.id] = p.nama_paket; });

    const now = new Date().toISOString().split('T')[0];
    const esc = s => String(s || '').replace(/"/g, '&quot;');

    el.innerHTML = (contracts || []).map(ct => {
      const isExpired = ct.end_date && ct.end_date < now;
      const daysLeft = ct.end_date ? Math.ceil((new Date(ct.end_date) - new Date()) / 86400000) : null;
      
      // Parse packages array
      let allowedPkgs = [];
      try {
        if (ct.packages) {
          const parsed = JSON.parse(ct.packages);
          if (Array.isArray(parsed)) {
            allowedPkgs = parsed.map(id => pkgMap[id]).filter(Boolean);
          }
        }
      } catch(err) {
        console.error("Failed to parse contract packages", err);
      }

      return `
        <div class="card" style="margin-bottom:12px; border-left:4px solid ${ct.status==='Active'?'#22C55E':isExpired?'#EF4444':'#94A3B8'}; padding: 14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:700; color:var(--navy);">${ct.contract_number||'—'} · ${ct.contract_type||'—'}</div>
              <div style="font-size:11px; color:var(--text3); margin-top:2px;">
                📅 ${ct.start_date?formatDateShort(ct.start_date):''} s/d ${ct.end_date?formatDateShort(ct.end_date):'—'}
              </div>
              <div style="font-size:12px; margin-top:8px">
                Peserta: <strong>${ct.used_peserta||0}/${ct.max_peserta||0}</strong> &nbsp;·&nbsp;
                Nilai: <strong>${formatCurrency(ct.nilai_kontrak||0)}</strong>
              </div>
              
              <!-- Paket Kontrak -->
              <div style="margin-top: 8px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--navy); display:block; margin-bottom: 2px;">Paket Tersedia:</span>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                  ${allowedPkgs.map(pName => `<span style="background:var(--bg2); border: 1px solid var(--border); border-radius:4px; padding:2px 6px; font-size:10.5px; color:var(--teal); font-weight:600;">${esc(pName)}</span>`).join('') || '<span style="font-size:11px; color:var(--gray);">— tidak ada paket —</span>'}
                </div>
              </div>

              ${ct.notes ? `<p style="font-size:11.5px; color:var(--text3); margin-top: 8px; background:var(--bg2); padding:6px 8px; border-radius:6px; margin-bottom: 0;">📝 ${esc(ct.notes)}</p>` : ''}
            </div>
            <div style="text-align:right; margin-left: 12px; flex-shrink:0;">
              <span style="background:${ct.status==='Active'?'#E8F5E9':'#FFEBEE'}; color:${ct.status==='Active'?'#2E7D32':'#C62828'}; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:700">${ct.status}</span>
              ${daysLeft!==null ? `<div style="font-size:10px; color:${daysLeft<30?'#EF4444':'var(--text3)'}; margin-top:4px">${daysLeft>0?daysLeft+' hari lagi':'Expired'}</div>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div class="status-box status-err">❌ Gagal memuat kontrak: ${e.message}</div>`;
  }
}

async function openInlineContractForm(corpId, corpName) {
  const container = document.getElementById('inline-contract-form-container');
  if (!container) return;
  
  container.style.display = 'block';
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

  try {
    const pkgs = await sbGet('packages', 'select=id,nama_paket&is_active=eq.true&order=nama_paket').catch(() => []);
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    const esc = s => String(s || '').replace(/"/g, '&quot;');

    container.innerHTML = `
      <div style="font-weight:700; font-size:13px; color:var(--navy); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <span>Kontrak &amp; Paket Baru</span>
        <button class="btn btn-ghost btn-xs" onclick="document.getElementById('inline-contract-form-container').style.display='none'" style="margin:0;">&times;</button>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div class="fg"><label>No. Kontrak</label><input type="text" id="ctf-num" value="CTR-${Date.now().toString().slice(-5)}" placeholder="CTR-001"></div>
        <div class="fg"><label>Tipe Kontrak</label>
          <select id="ctf-type">
            ${['MCU Tahunan','Per Event','On-demand','Retainer'].map(t=>`<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Tanggal Mulai</label><input type="date" id="ctf-start" value="${today}"></div>
        <div class="fg"><label>Tanggal Berakhir</label><input type="date" id="ctf-end" value="${nextYear}"></div>
        <div class="fg"><label>Max Peserta</label><input type="number" id="ctf-max" value="100"></div>
        <div class="fg"><label>Nilai Kontrak (Rp)</label><input type="number" id="ctf-nilai" value="50000000"></div>
        
        <!-- Packages Checklist -->
        <div class="fg" style="grid-column: span 2;">
          <label style="font-weight:700; margin-bottom: 6px;">Pilih Paket MCU yang Tersedia dalam Kontrak ini</label>
          <div style="max-height: 120px; overflow-y: auto; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
            ${(pkgs || []).map(p => `
              <label style="display: flex; align-items: center; gap: 8px; font-weight: normal; cursor: pointer; color: #000;">
                <input type="checkbox" name="ctf-pkgs" value="${p.id}" style="width: auto; margin:0;">
                <span>${esc(p.nama_paket)}</span>
              </label>
            `).join('') || '<div style="color:var(--gray); font-size:11px;">Tidak ada paket aktif. Buat paket dulu di menu Konfigurasi Paket.</div>'}
          </div>
        </div>

        <div class="fg" style="grid-column: span 2;"><label>Catatan</label><textarea id="ctf-notes" rows="2" style="border:1px solid var(--border); border-radius:8px; padding:8px; font-size:13px; width:100%;"></textarea></div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('inline-contract-form-container').style.display='none'">Batal</button>
        <button class="btn btn-teal btn-sm" onclick="saveInlineContract(${corpId}, '${esc(corpName)}')">Simpan Kontrak</button>
      </div>`;
  } catch(e) {
    container.innerHTML = `<div class="status-box status-err">❌ Gagal memuat form: ${e.message}</div>`;
  }
}

async function saveInlineContract(corpId, corpName) {
  const user = getUserName ? getUserName() : 'User';
  const pkgEls = document.querySelectorAll('input[name="ctf-pkgs"]:checked');
  const packageIds = Array.from(pkgEls).map(el => parseInt(el.value));

  const payload = {
    corporate_id:    corpId,
    corporate_name:  corpName,
    contract_number: document.getElementById('ctf-num').value.trim(),
    contract_type:   document.getElementById('ctf-type').value,
    start_date:      document.getElementById('ctf-start').value||null,
    end_date:        document.getElementById('ctf-end').value||null,
    max_peserta:     parseInt(document.getElementById('ctf-max').value)||0,
    used_peserta:    0,
    nilai_kontrak:   parseFloat(document.getElementById('ctf-nilai').value)||0,
    packages:        JSON.stringify(packageIds),
    status:          'Active',
    notes:           document.getElementById('ctf-notes').value.trim()||null,
    created_by:      user,
    updated_at:      new Date().toISOString(),
  };
  try {
    await sbPost('corporate_contracts', payload);
    toast('✅ Kontrak berhasil dibuat', 'ok');
    document.getElementById('inline-contract-form-container').style.display = 'none';
    await loadCorporateDetailContracts(corpId, corpName);
  } catch(e) {
    toast('❌ ' + e.message, 'err');
  }
}

// ══════════════════════════════════════════════════════════════
// Import Employee SCOPED — corporate sudah dikunci ke form ini,
// jadi TIDAK perlu mencocokkan Kode Corporate (sumber error lama).
// Menerima template 9-kolom (kolom Kode Corporate diabaikan) atau
// template ringkas 7-kolom.
// ══════════════════════════════════════════════════════════════
let _corpImportRows = [];

function _parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}
function _normHdr(h) { return String(h||'').replace(/^﻿/,'').replace(/\*/g,'').trim().toLowerCase(); }
function _normGender(g) {
  const s = String(g||'').trim().toLowerCase();
  if (s.startsWith('l') || s === 'm') return 'M';
  if (s.startsWith('p') || s === 'f' || s === 'w') return 'F';
  return null;
}

function previewCorpImport(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = String(e.target.result).split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) { toast('File kosong','err'); return; }
    const header = _parseCsvLine(lines[0]).map(_normHdr);
    const find = (...cands) => { for (const c of cands) { const i = header.indexOf(c); if (i >= 0) return i; } return -1; };
    const col = {
      name:   find('nama karyawan','nama','full name','first name'),
      nik:    find('nik / id karyawan','nik','id karyawan','employee number','employee id','nik/id'),
      dept:   find('departemen','department'),
      gender: find('jenis kelamin','gender'),
      dob:    find('tanggal lahir','tgl lahir','birth date'),
      phone:  find('no hp','phone','telepon','mobile'),
      email:  find('email'),
    };
    if (col.name < 0) { toast('❌ Kolom "Nama" tidak ditemukan di file','err',5000); return; }

    _corpImportRows = lines.slice(1).map(_parseCsvLine).filter(r => r.some(c => c && c.trim())).map(r => ({
      full_name:   (r[col.name]||'').trim(),
      employee_id: col.nik>=0 ? (r[col.nik]||'').trim()||null : null,
      department:  col.dept>=0 ? (r[col.dept]||'').trim()||null : null,
      gender:      col.gender>=0 ? _normGender(r[col.gender]) : null,
      birth_date:  col.dob>=0 ? (r[col.dob]||'').trim()||null : null,
      phone:       col.phone>=0 ? (r[col.phone]||'').trim()||null : null,
      email:       col.email>=0 ? (r[col.email]||'').trim()||null : null,
    })).filter(x => x.full_name);

    const el = document.getElementById('cf-imp-preview');
    if (el) el.innerHTML = `
      <div style="font-size:12px;color:var(--gray);margin-bottom:6px">${_corpImportRows.length} baris terbaca</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr style="background:var(--lgray)"><th style="padding:4px 8px;text-align:left">Nama</th><th style="padding:4px 8px;text-align:left">NIK</th><th style="padding:4px 8px;text-align:left">Dept</th><th style="padding:4px 8px;text-align:left">JK</th></tr></thead>
        <tbody>${_corpImportRows.slice(0,6).map(r=>`<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px">${r.full_name}</td><td style="padding:4px 8px;font-family:monospace">${r.employee_id||'—'}</td><td style="padding:4px 8px">${r.department||'—'}</td><td style="padding:4px 8px">${r.gender||'—'}</td></tr>`).join('')}
        ${_corpImportRows.length>6?`<tr><td colspan="4" style="padding:4px 8px;color:var(--gray)">…dan ${_corpImportRows.length-6} lainnya</td></tr>`:''}</tbody>
      </table>`;
    const btn = document.getElementById('cf-imp-btn');
    if (btn) btn.disabled = !_corpImportRows.length;
  };
  reader.readAsText(file);
}

async function loadCorpImport(corpId) {
  if (!_corpImportRows.length) { toast('Tidak ada data','warn'); return; }
  const btn = document.getElementById('cf-imp-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Import...'; }
  let ok = 0, err = 0, firstErr = '';
  for (const r of _corpImportRows) {
    try {
      // Hanya kolom yang pasti ada (samakan dengan saveCorpEmp yang sudah bekerja).
      await sbPost('corporate_employees', {
        corporate_id: corpId,
        full_name:    r.full_name,
        employee_id:  r.employee_id,
        department:   r.department,
        gender:       r.gender,
        birth_date:   r.birth_date,
        phone:        r.phone,
        email:        r.email,
        status:       'Non-Aktif',
        updated_at:   new Date().toISOString(),
      });
      ok++;
    } catch(e) { err++; if (!firstErr) firstErr = e.message; console.error('[loadCorpImport]', r.full_name, e); }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Load File'; }
  if (ok) {
    toast(`✅ ${ok} karyawan diimport${err?`, ${err} gagal`:''}`, err?'warn':'ok', 5000);
    _corpImportRows = [];
    closeModalForce();
  } else {
    // Semua gagal → tampilkan sebab asli agar bisa ditelusuri
    toast(`❌ Semua gagal. Sebab: ${firstErr||'tidak diketahui'}`, 'err', 9000);
  }
}

function downloadCorpImportTemplate() {
  const csv = '﻿"Nama Karyawan","NIK / ID Karyawan","Departemen","Jenis Kelamin","Tanggal Lahir","No HP","Email"\r\n'
            + '"Siti Aminah","12345","HRD","Perempuan","1990-05-20","081234567","siti@company.com"\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'template_import_karyawan.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('✅ Template didownload','ok');
}

async function deleteCorp(id) {
  if (!confirm('Hapus data corporate ini?')) return;
  try { await sbDelete('corporates',id); toast('Dihapus','info'); await loadCorporates(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}


// ══════════════════════════════════════════
// CORPORATE: Employee/Participant Management
// ══════════════════════════════════════════
async function openCorpEmployees(corpId, corpName) {
  const [emps, pkgs] = await Promise.all([
    sbGet('corporate_employees', `select=*&corporate_id=eq.${corpId}&order=full_name.asc`).catch(()=>[]),
    sbGet('packages','select=id,nama_paket&is_active=eq.true&order=nama_paket').catch(()=>[]),
  ]);

  const active   = (emps||[]).filter(e=>e.status==='Aktif').length;
  const inactive = (emps||[]).filter(e=>e.status==='Non-Aktif').length;
  const booked   = (emps||[]).filter(e=>e.booking_admission_id).length;
  const assigned = (emps||[]).filter(e=>e.package_id).length;

  // Opsi <select> paket, dipakai inline per baris
  const pkgOpts = (empPkgId) => `<option value="">— pilih paket —</option>` +
    (pkgs||[]).map(p=>`<option value="${p.id}" data-name="${(p.nama_paket||'').replace(/"/g,'&quot;')}" ${p.id===empPkgId?'selected':''}>${p.nama_paket}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Data Karyawan — ${corpName}</div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="badge badge-green">${active} Aktif</span>
        <span class="badge badge-gray">${inactive} Non-Aktif</span>
        <span class="badge" style="background:#EEF2FF;color:#3730A3">${assigned} Berpaket</span>
        <span class="badge" style="background:#E0F2FE;color:#0369A1">${booked} Booking</span>
        <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px">
      <input class="table-search" id="cemp-q" placeholder="Cari nama, NIK..." 
        oninput="filterCorpEmps(${corpId})" style="flex:1">
      <select class="table-filter" id="cemp-status" onchange="filterCorpEmps(${corpId})">
        <option value="">Semua</option>
        <option>Aktif</option><option>Non-Aktif</option>
      </select>
      <button class="btn btn-teal btn-sm" onclick="openCorpEmpForm(${corpId},'${corpName.replace(/'/g,"\'")}')" >+ Tambah</button>
      <button class="btn btn-ghost btn-sm" onclick="importCorpEmps(${corpId})">Import CSV</button>
    </div>

    <div id="cemp-list" style="max-height:400px;overflow-y:auto">
      ${(emps||[]).length ? `
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr style="background:var(--lgray)">
            <th style="padding:6px 10px;text-align:left">Nama</th>
            <th style="padding:6px 10px;text-align:left">NIK/ID</th>
            <th style="padding:6px 10px;text-align:left">Departemen</th>
            <th style="padding:6px 10px;text-align:left">Paket MCU</th>
            <th style="padding:6px 10px;text-align:left">Status</th>
            <th style="padding:6px 10px">Aksi</th>
          </tr></thead>
          <tbody id="cemp-tbody">
            ${(emps||[]).map(e=>`<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:6px 10px;font-weight:600">${e.full_name||'—'}</td>
              <td style="padding:6px 10px;font-family:monospace;font-size:11px">${e.employee_id||'—'}</td>
              <td style="padding:6px 10px;color:var(--gray)">${e.department||'—'}</td>
              <td style="padding:6px 10px">
                ${e.booking_admission_id
                  ? `<span style="font-size:11px;font-weight:600">${e.package_name||'—'}</span> <span title="Sudah booking, terkunci">🔒</span>`
                  : `<select onchange="assignEmpPackage(${e.id},this,${corpId},'${corpName.replace(/'/g,"\\'")}')" style="font-size:11px;padding:2px 4px;max-width:150px">${pkgOpts(e.package_id)}</select>`}
              </td>
              <td style="padding:6px 10px">
                <span style="background:${e.status==='Aktif'?'#E8F5E9':'#F1F5F9'};
                  color:${e.status==='Aktif'?'#2E7D32':'#546E7A'};
                  padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700">
                  ${e.status||'Non-Aktif'}
                </span>
              </td>
              <td style="padding:6px 10px">
                <div class="act-row">
                  <button class="act-btn edit" onclick="openCorpEmpForm(${corpId},'${corpName.replace(/'/g,"\'")}',${ e.id})">${icon('edit', 12)}</button>
                  <button class="act-btn del" onclick="deleteCorpEmp(${e.id},${corpId},'${corpName.replace(/'/g,"\'")}')">${icon('trash', 12)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>` :
        `<div class="empty-state" style="padding:30px">
          <div class="ico"></div>
          <h3>Belum ada data karyawan</h3>
          <p>Tambah manual atau import dari CSV</p>
        </div>`
      }
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal btn-sm" onclick="scheduleMcuBooking(${corpId},'${corpName.replace(/'/g,"\\'")}')" style="color:#fff">
        📅 Jadwalkan MCU → Booking
      </button>
    </div>`);
}

window.addIdentityDocRow = function() {
  const tbody = document.getElementById('cef-docs-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid #cbd5e1';
  tr.innerHTML = `
    <td style="padding:8px; text-align:center;"><input type="checkbox" class="cef-doc-primary" onclick="onlyOnePrimaryDoc(this)"></td>
    <td style="padding:8px; text-align:center;"><button class="btn btn-unfit btn-xs" style="color:#ef4444; border:1px solid #fecaca; background:#fff; padding:2px 6px; margin:0;" onclick="this.closest('tr').remove()">Delete</button></td>
    <td style="padding:8px;">
      <select class="cef-doc-type" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;">
        <option>KTP</option><option>Paspor</option><option>BPJS</option><option>SIM</option>
      </select>
    </td>
    <td style="padding:8px;"><input type="text" class="cef-doc-num" placeholder="Identity Number" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>
    <td style="padding:8px;"><input type="text" class="cef-doc-issuer" value="INDONESIA" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>
  `;
  tbody.appendChild(tr);
};

window.onlyOnePrimaryDoc = function(chk) {
  if (chk.checked) {
    document.querySelectorAll('.cef-doc-primary').forEach(c => {
      if (c !== chk) c.checked = false;
    });
  }
};

window.closeCorpEmpFormInline = function() {
  const formTab = document.getElementById('tab-content-employee-form');
  const listTab = document.getElementById('tab-content-employees');
  if (formTab) formTab.style.display = 'none';
  if (listTab) listTab.style.display = 'block';
  delete window.cefEditingId;
};

window.openCorpEmpForm = async function(corpId, corpName, id=null) {
  const listTab = document.getElementById('tab-content-employees');
  const formTab = document.getElementById('tab-content-employee-form');
  if (listTab) listTab.style.display = 'none';
  if (formTab) formTab.style.display = 'block';

  window.cefEditingId = id;
  
  const titleSpan = document.querySelector('#cef-title span');
  if (titleSpan) titleSpan.textContent = id ? `Edit Karyawan — ${corpName}` : `Add New Employee — ${corpName}`;

  const setV = (k, v) => { const el = document.getElementById('cef-'+k); if (el) el.value = v || ''; };
  setV('id', '');
  setV('dob', '');
  setV('dept', '');
  setV('pob', '');
  setV('level', 'STAFF');
  setV('blood', '');
  setV('firstname', '');
  setV('lastname', '');
  setV('marital', '');
  setV('job', '');
  setV('religion', '');
  setV('email', '');
  setV('ethnic', 'JAWA');
  setV('gender', 'M');
  setV('country', 'INDONESIA');
  setV('phonecode', '+62');
  setV('phone', '');
  setV('status', 'Non-Aktif');
  setV('notes', '');

  setV('address', '');
  setV('city', '');
  setV('province', '');
  setV('subdistrict', '');
  setV('address-country', 'INDONESIA');
  setV('district', '');
  setV('postal', '');

  const tbody = document.getElementById('cef-docs-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr style="border-bottom:1px solid #cbd5e1;">
        <td style="padding:8px; text-align:center;"><input type="checkbox" class="cef-doc-primary" checked onclick="onlyOnePrimaryDoc(this)"></td>
        <td style="padding:8px; text-align:center;"><button class="btn btn-unfit btn-xs" style="color:#ef4444; border:1px solid #fecaca; background:#fff; padding:2px 6px; margin:0;" onclick="this.closest('tr').remove()">Delete</button></td>
        <td style="padding:8px;">
          <select class="cef-doc-type" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;">
            <option>KTP</option><option>Paspor</option><option>BPJS</option><option>SIM</option>
          </select>
        </td>
        <td style="padding:8px;"><input type="text" class="cef-doc-num" placeholder="Identity Number" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>
        <td style="padding:8px;"><input type="text" class="cef-doc-issuer" value="INDONESIA" style="width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:4px;"></td>
      </tr>
    `;
  }

  if (id) {
    try {
      const data = await sbGet('corporate_employees', `select=*&id=eq.${id}`);
      const e = data?.[0];
      if (e) {
        setV('id', e.employee_id);
        setV('dob', e.birth_date);
        setV('dept', e.department);
        setV('email', e.email);
        setV('status', e.status || 'Non-Aktif');

        let first = e.full_name || '';
        let last = '';
        const parts = first.trim().split(/\s+/);
        if (parts.length > 1) {
          first = parts[0];
          last = parts.slice(1).join(' ');
        }
        setV('firstname', first);
        setV('lastname', last);

        if (e.phone) {
          if (e.phone.startsWith('+62')) {
            setV('phonecode', '+62');
            setV('phone', e.phone.slice(3));
          } else {
            setV('phonecode', '+62');
            setV('phone', e.phone);
          }
        }

        if (e.notes) {
          setV('notes', e.notes);
          const pMatch = e.notes.match(/Position:\s*([^,]+)/);
          if (pMatch) setV('job', pMatch[1]);
          const lMatch = e.notes.match(/Level:\s*([^,]+)/);
          if (lMatch) setV('level', lMatch[1]);
        }

        const docNumInput = document.querySelector('.cef-doc-num');
        if (docNumInput) docNumInput.value = e.employee_id || '';
      }
    } catch(err) {
      toast('Gagal memuat data karyawan: ' + err.message, 'err');
    }
  }
};

window.saveCorpEmpInline = async function() {
  const corpId = window.currentDetailCorpId;
  const corpName = window.currentDetailCorpName || 'Corporate';
  if (!corpId) { toast('Error: ID corporate tidak teridentifikasi.', 'err'); return; }

  const val = k => (document.getElementById('cef-'+k)?.value || '').trim();
  const firstName = val('firstname');
  const lastName = val('lastname');
  const name = [firstName, lastName].filter(Boolean).join(' ');

  if (!firstName) { toast('First Name wajib diisi', 'err'); return; }

  const phoneCode = val('phonecode');
  const phoneNum = val('phone');
  const fullPhone = phoneNum ? (phoneCode + phoneNum) : null;

  const job = val('job');
  const level = val('level');
  let notesStr = val('notes');
  if (job || level) {
    notesStr = `Position: ${job || '—'}, Level: ${level || '—'}`;
  }

  const payload = {
    corporate_id: corpId,
    corporate_name: corpName,
    full_name:    name,
    employee_id:  val('id') || null,
    department:   val('dept') || null,
    gender:       val('gender') || 'M',
    birth_date:   val('dob') || null,
    phone:        fullPhone,
    email:        val('email') || null,
    status:       val('status') || 'Non-Aktif',
    notes:        notesStr || null,
    updated_at:   new Date().toISOString(),
  };

  const btn = document.getElementById('cef-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

  try {
    if (window.cefEditingId) {
      await sbPatch('corporate_employees', window.cefEditingId, payload);
      toast('✅ Karyawan berhasil diupdate', 'ok');
    } else {
      await sbPost('corporate_employees', payload);
      toast('✅ Karyawan berhasil ditambahkan', 'ok');
    }

    closeCorpEmpFormInline();
    loadTabCorpEmployees(corpId, corpName);
  } catch(e) {
    toast('❌ Gagal menyimpan: ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save'; }
  }
};

async function deleteCorpEmp(id, corpId, corpName) {
  if (!confirm('Hapus data karyawan ini?')) return;
  try {
    await sbDelete('corporate_employees',id);
    toast('Dihapus','info');
    if (document.getElementById('erp-cemp-tbody')) {
      loadTabCorpEmployees(corpId, corpName);
    } else {
      await openCorpEmployees(corpId, corpName);
    }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// Assign paket ke SATU karyawan (inline dropdown di tabel).
async function assignEmpPackage(empId, sel, corpId, corpName) {
  const pkgId = parseInt(sel.value) || null;
  const pkgName = sel.selectedOptions?.[0]?.dataset?.name || sel.selectedOptions?.[0]?.textContent || null;
  const user = getUserName ? getUserName() : 'User';
  try {
    await sbPatch('corporate_employees', empId, {
      package_id:   pkgId,
      package_name: pkgId ? pkgName : null,
      assigned_by:  user,
      assigned_at:  new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    });
    toast(pkgId ? `✅ Paket: ${pkgName}` : 'Paket dilepas', 'ok', 2000);
    if (document.getElementById('erp-cemp-tbody')) {
      loadTabCorpEmployees(corpId, corpName);
    } else {
      await openCorpEmployees(corpId, corpName);
    }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// Jadwalkan MCU → buat baris admissions (booking) per karyawan.
// Hanya karyawan yang SUDAH berpaket & BELUM pernah dibooking.
// Inilah sambungan rantai: config paket → list booking admisi.
// ══════════════════════════════════════════════════════════════
async function scheduleMcuBooking(corpId, corpName) {
  const emps = await sbGet('corporate_employees',
    `select=*&corporate_id=eq.${corpId}&order=full_name.asc`).catch(()=>[]);
  const eligible = (emps||[]).filter(e => e.package_id && !e.booking_admission_id);
  const noPkg    = (emps||[]).filter(e => !e.package_id && !e.booking_admission_id).length;

  if (!eligible.length) {
    toast(`Tidak ada karyawan siap booking.${noPkg?` ${noPkg} karyawan belum di-assign paket.`:''}`, 'warn', 6000);
    return;
  }
  const today = new Date().toISOString().slice(0,10);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Jadwalkan MCU — ${corpName}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="background:#EEF2FF;border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;line-height:1.5">
      <strong>${eligible.length} karyawan</strong> siap dibuatkan booking.
      ${noPkg?`<br><span style="color:#B45309">⚠️ ${noPkg} karyawan dilewati (belum di-assign paket).</span>`:''}
    </div>
    <div class="form-group">
      <label>Tanggal MCU *</label>
      <input type="date" id="mcu-date" value="${today}" min="${today}">
    </div>
    <div style="max-height:220px;overflow-y:auto;margin-top:10px;border:1px solid var(--border);border-radius:6px">
      <table style="width:100%;font-size:11.5px;border-collapse:collapse">
        <thead><tr style="background:var(--lgray)">
          <th style="padding:5px 8px;text-align:left">Nama</th>
          <th style="padding:5px 8px;text-align:left">Paket</th>
        </tr></thead>
        <tbody>${eligible.map(e=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 8px;font-weight:600">${e.full_name||'—'}</td>
          <td style="padding:5px 8px;color:#3730A3">${e.package_name||'—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="createCorpBookings(${corpId},'${corpName.replace(/'/g,"\\'")}')" style="color:#fff">
        Buat ${eligible.length} Booking
      </button>
    </div>`);
}

async function createCorpBookings(corpId, corpName) {
  const mcuDate = document.getElementById('mcu-date')?.value;
  if (!mcuDate) { toast('Pilih tanggal MCU dulu','err'); return; }
  const user = getUserName ? getUserName() : 'User';

  try {
    // Diskon korporat untuk isi scheme_discount di admisi
    const corp = (await sbGet('corporates', `select=discount_type,discount_value&id=eq.${corpId}`).catch(()=>[]))?.[0] || {};
    const emps = await sbGet('corporate_employees',
      `select=*&corporate_id=eq.${corpId}&package_id=not.is.null&booking_admission_id=is.null`);

    if (!emps || !emps.length) { toast('Tidak ada karyawan untuk dibooking','warn'); return; }

    const dateTag = mcuDate.replace(/-/g,'');
    let made = 0;
    for (let i = 0; i < emps.length; i++) {
      const e = emps[i];
      const rnd = (Date.now().toString().slice(-4)) + i;
      const payload = {
        visit_number:      `VISIT-${dateTag}-${rnd}`,
        mr_number:         `MR-${Date.now().toString().slice(-6)}${i}`,
        visit_type:        'Project MCU',
        visit_date:        mcuDate,
        patient_name:      e.full_name,
        patient_gender:    e.gender || null,
        patient_dob:       e.birth_date || null,
        patient_phone:     e.phone || null,
        patient_email:     e.email || null,
        patient_id_number: e.employee_id || null,
        package_id:        e.package_id,
        package_name:      e.package_name || null,
        corporate_id:      corpId,
        corporate_employee_id: e.id,
        discount_scheme:   'corporate',
        scheme_ref_id:     corpId,
        scheme_name:       corpName,
        scheme_discount:   0,   // dihitung ulang di admisi saat service line diisi
        payment_status:    'Unpaid',
        status:            'Booking',
        registered_by:     user,
        updated_at:        new Date().toISOString(),
      };
      try {
        const created = await sbPost('admissions', payload);
        const admId = created?.[0]?.id || created?.id;
        await sbPatch('corporate_employees', e.id, {
          status:               'Aktif',
          mcu_date:             mcuDate,
          booking_admission_id: admId || null,
          updated_at:           new Date().toISOString(),
        });
        made++;
      } catch(err){ console.error('[createCorpBookings] gagal untuk', e.full_name, err); }
    }
    toast(`✅ ${made} booking dibuat untuk ${mcuDate}`, 'ok', 4000);
    closeModalForce();
    await openCorpEmployees(corpId, corpName);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

function importCorpEmps(corpId) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Import Karyawan dari CSV</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="background:#FFF8E1;border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px">
      Format CSV: <strong>nama,nik,departemen,gender(M/F),tanggal_lahir,phone,email</strong>
    </div>
    <div class="form-group">
      <label>Upload File CSV</label>
      <input type="file" id="cemp-csv" accept=".csv" onchange="previewCSVImport(this,${corpId})">
    </div>
    <div id="csv-preview" style="max-height:200px;overflow-y:auto;margin-top:10px"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" id="csv-import-btn" onclick="processCSVImport(${corpId})" disabled>
        Import
      </button>
    </div>`);
}

let csvRows = [];
function previewCSVImport(input, corpId) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim());
    csvRows = lines.slice(1).map(l => {
      const [name,nik,dept,gender,dob,phone,email] = l.split(',').map(v=>v.trim().replace(/"/g,''));
      return {name,nik,dept,gender,dob,phone,email};
    }).filter(r=>r.name);

    const el = document.getElementById('csv-preview');
    if (el) el.innerHTML = `
      <div style="font-size:12px;color:var(--gray);margin-bottom:6px">${csvRows.length} data ditemukan</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr style="background:var(--lgray)">
          <th style="padding:4px 8px">Nama</th><th style="padding:4px 8px">NIK</th>
          <th style="padding:4px 8px">Dept</th><th style="padding:4px 8px">Gender</th>
        </tr></thead>
        <tbody>
          ${csvRows.slice(0,5).map(r=>`<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:4px 8px">${r.name}</td>
            <td style="padding:4px 8px;font-family:monospace">${r.nik||'—'}</td>
            <td style="padding:4px 8px">${r.dept||'—'}</td>
            <td style="padding:4px 8px">${r.gender||'—'}</td>
          </tr>`).join('')}
          ${csvRows.length>5?`<tr><td colspan="4" style="padding:4px 8px;color:var(--gray)">...dan ${csvRows.length-5} lainnya</td></tr>`:''}
        </tbody>
      </table>`;

    const btn = document.getElementById('csv-import-btn');
    if (btn) btn.disabled = false;
  };
  reader.readAsText(file);
}

async function processCSVImport(corpId) {
  if (!csvRows.length) { toast('Tidak ada data','err'); return; }
  const user = getUserName?getUserName():'User';
  let added = 0;
  for (const row of csvRows) {
    if (!row.name) continue;
    try {
      await sbPost('corporate_employees',{
        corporate_id: corpId,
        full_name:    row.name,
        employee_id:  row.nik||null,
        department:   row.dept||null,
        gender:       row.gender||null,
        birth_date:   row.dob||null,
        phone:        row.phone||null,
        email:        row.email||null,
        status:       'Non-Aktif',
        updated_at:   new Date().toISOString(),
      });
      added++;
    } catch(e){}
  }
  toast(`✅ ${added} karyawan berhasil diimport`,'ok');
  closeModalForce();
}

// Override openCorpForm to accept prefill
const _origOpenCorpForm = typeof openCorpForm !== 'undefined' ? openCorpForm : null;

async function openCorpContracts(corpId, corpName) {
  const contracts = await sbGet('corporate_contracts',
    `select=*&corporate_id=eq.${corpId}&order=created_at.desc`).catch(()=>[]);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Kontrak: ${corpName}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <button class="btn btn-teal btn-sm" style="margin-bottom:12px"
      onclick="openContractForm(${corpId},'${corpName.replace(/'/g,"\\'")}')">+ Kontrak Baru</button>

    ${(contracts||[]).map(ct=>{
      const now=new Date().toISOString().split('T')[0];
      const isExpired=ct.end_date&&ct.end_date<now;
      const daysLeft=ct.end_date?Math.ceil((new Date(ct.end_date)-new Date())/86400000):null;
      return `<div class="card" style="margin-bottom:10px;border-left:4px solid ${ct.status==='Active'?'#22C55E':isExpired?'#EF4444':'#94A3B8'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:13px;font-weight:700">${ct.contract_number||'—'} · ${ct.contract_type||'—'}</div>
            <div style="font-size:11px;color:var(--gray)">
              ${ct.start_date?formatDateShort(ct.start_date):''} s/d ${ct.end_date?formatDateShort(ct.end_date):'—'}
            </div>
            <div style="font-size:12px;margin-top:4px">
              Peserta: <strong>${ct.used_peserta||0}/${ct.max_peserta||0}</strong> &nbsp;·&nbsp;
              Nilai: <strong>${formatCurrency(ct.nilai_kontrak||0)}</strong>
            </div>
          </div>
          <div style="text-align:right">
            <span style="background:${ct.status==='Active'?'#E8F5E9':'#FFEBEE'};color:${ct.status==='Active'?'#2E7D32':'#C62828'};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${ct.status}</span>
            ${daysLeft!==null?`<div style="font-size:10px;color:${daysLeft<30?'#EF4444':'var(--gray)'};margin-top:4px">${daysLeft>0?daysLeft+'h lagi':'Expired'}</div>`:''}
          </div>
        </div>
      </div>`;
    }).join('')||'<div style="color:var(--gray);font-size:13px">Belum ada kontrak</div>'}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    </div>`);
}

async function openContractForm(corpId, corpName) {
  const today=new Date().toISOString().split('T')[0];
  const nextYear=new Date(Date.now()+365*86400000).toISOString().split('T')[0];
  const user=getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Kontrak Baru — ${corpName}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>No. Kontrak</label>
        <input type="text" id="ctf-num" value="CTR-${Date.now().toString().slice(-5)}" placeholder="CTR-001">
      </div>
      <div class="form-group">
        <label>Tipe Kontrak</label>
        <select id="ctf-type">
          ${['MCU Tahunan','Per Event','On-demand','Retainer'].map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tanggal Mulai</label>
        <input type="date" id="ctf-start" value="${today}">
      </div>
      <div class="form-group">
        <label>Tanggal Berakhir</label>
        <input type="date" id="ctf-end" value="${nextYear}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Max Peserta</label>
        <input type="number" id="ctf-max" value="0">
      </div>
      <div class="form-group">
        <label>Nilai Kontrak (Rp)</label>
        <input type="number" id="ctf-nilai" value="0">
      </div>
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <textarea id="ctf-notes" rows="2"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveContract(${corpId},'${corpName.replace(/'/g,"\\'")}')">Simpan</button>
    </div>`);
}

async function saveContract(corpId, corpName) {
  const user=getUserName?getUserName():'User';
  const payload={
    corporate_id:    corpId,
    corporate_name:  corpName,
    contract_number: document.getElementById('ctf-num').value.trim(),
    contract_type:   document.getElementById('ctf-type').value,
    start_date:      document.getElementById('ctf-start').value||null,
    end_date:        document.getElementById('ctf-end').value||null,
    max_peserta:     parseInt(document.getElementById('ctf-max').value)||0,
    used_peserta:    0,
    nilai_kontrak:   parseFloat(document.getElementById('ctf-nilai').value)||0,
    status:          'Active',
    notes:           document.getElementById('ctf-notes').value.trim()||null,
    created_by:      user,
    updated_at:      new Date().toISOString(),
  };
  try {
    await sbPost('corporate_contracts',payload);
    toast('✅ Kontrak dibuat','ok');
    closeModalForce();
    await openCorpContracts(corpId, corpName);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════
// HEALTH FACILITY
// ══════════════════════════════════════════
async function renderConfigHealthFacility() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Health Facility &amp; Rujukan</h1>
        <p>RS, Klinik, Dokter mitra — kontrak rujukan dan fee referral</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderConfigCorporate()">← Corporate</button>
        <button class="btn btn-teal" onclick="openFacilityForm()">+ Tambah Fasilitas</button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="fac-q" placeholder="Cari nama fasilitas..." oninput="filterFacility()" style="flex:1">
        <select class="table-filter" id="fac-type" onchange="filterFacility()">
          <option value="">Semua Tipe</option>
          ${['RS','Klinik','Dokter Praktik','Apotek'].map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
      <div id="fac-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await loadFacilities();
}

let facAll = [];
async function loadFacilities() {
  try {
    const data = await sbGet('health_facilities','select=*&order=facility_name.asc');
    facAll = Array.isArray(data)?data:[];
    filterFacility();
  } catch(e) {
    document.getElementById('fac-tbody').innerHTML=`<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function filterFacility() {
  const q=( document.getElementById('fac-q')?.value||'').toLowerCase();
  const tp=document.getElementById('fac-type')?.value||'';
  const f=facAll.filter(f=>
    (!q || (f.facility_name||'').toLowerCase().includes(q)) && (!tp||f.facility_type===tp));
  const el=document.getElementById('fac-tbody');
  if (!f.length) {
    el.innerHTML=`<div class="empty-state"><div class="ico"></div>
      <h3>Belum ada health facility</h3>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openFacilityForm()">+ Tambah</button>
    </div>`; return;
  }
  el.innerHTML=`<table><thead><tr>
    <th>Fasilitas</th><th>Tipe</th><th>PIC</th>
    <th>Fee Referral</th><th>Kontrak</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
  ${f.map(fa=>`<tr>
    <td style="font-weight:600;color:var(--navy)">${fa.facility_name||'—'}</td>
    <td><span class="badge badge-gray">${fa.facility_type||'—'}</span></td>
    <td>
      <div style="font-size:12px">${fa.pic_name||'—'}</div>
      ${fa.phone?`<div style="font-size:11px;color:var(--teal)">${fa.phone}</div>`:''}
    </td>
    <td style="font-size:12px">
      ${fa.referral_fee_value?`${fa.referral_fee_value}${fa.referral_fee_type==='percent'?'%':' Rp'}`:'-'}
    </td>
    <td style="font-size:11px;color:var(--gray)">
      ${fa.contract_start?formatDateShort(fa.contract_start):''} 
      ${fa.contract_end?' s/d '+formatDateShort(fa.contract_end):''}
    </td>
    <td><span style="background:${fa.is_active?'#E8F5E9':'#FFEBEE'};color:${fa.is_active?'#2E7D32':'#C62828'};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${fa.is_active?'Aktif':'Non-Aktif'}</span></td>
    <td>
      <div class="act-row">
        <button class="act-btn edit" onclick="openFacilityForm(${fa.id})">${icon('edit', 12)}</button>
        <button class="act-btn del" onclick="deleteFacility(${fa.id})">${icon('trash', 12)}</button>
      </div>
    </td>
  </tr>`).join('')}</tbody></table>`;
}

async function openFacilityForm(id=null) {
  let f={};
  if (id) { const d=await sbGet('health_facilities',`select=*&id=eq.${id}`); f=d[0]||{}; }
  const user=getUserName?getUserName():'User';
  const today=new Date().toISOString().split('T')[0];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'Edit Fasilitas':'Tambah Health Facility'}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1">
        <label>Nama Fasilitas *</label>
        <input type="text" id="ff-name" value="${f.facility_name||''}" placeholder="RS Siloam Serpong, Klinik Sehat...">
      </div>
      <div class="form-group">
        <label>Tipe</label>
        <select id="ff-type">
          ${['RS','Klinik','Dokter Praktik','Apotek','Lainnya'].map(t=>`<option${f.facility_type===t?' selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="ff-active">
          <option value="true" ${f.is_active!==false?'selected':''}>Aktif</option>
          <option value="false" ${f.is_active===false?'selected':''}>Non-Aktif</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Nama PIC</label>
        <input type="text" id="ff-pic" value="${f.pic_name||''}">
      </div>
      <div class="form-group">
        <label>No. HP</label>
        <input type="text" id="ff-phone" value="${f.phone||''}">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="ff-email" value="${f.email||''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipe Fee Referral</label>
        <select id="ff-fee-type">
          <option value="percent" ${(f.referral_fee_type||'percent')==='percent'?'selected':''}>Persen (%)</option>
          <option value="fixed"   ${f.referral_fee_type==='fixed'?'selected':''}>Nominal (Rp)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nilai Fee Referral</label>
        <input type="number" id="ff-fee-val" value="${f.referral_fee_value||0}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Kontrak Mulai</label>
        <input type="date" id="ff-start" value="${f.contract_start||today}">
      </div>
      <div class="form-group">
        <label>Kontrak Berakhir</label>
        <input type="date" id="ff-end" value="${f.contract_end||''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveFacility(${id||'null'})">Simpan</button>
    </div>`);
}

async function saveFacility(id) {
  const name=document.getElementById('ff-name').value.trim();
  if (!name) { toast('Nama fasilitas wajib diisi','err'); return; }
  const user=getUserName?getUserName():'User';
  const payload={
    facility_name:      name,
    facility_type:      document.getElementById('ff-type').value,
    pic_name:           document.getElementById('ff-pic').value.trim()||null,
    phone:              document.getElementById('ff-phone').value.trim()||null,
    email:              document.getElementById('ff-email').value.trim()||null,
    referral_fee_type:  document.getElementById('ff-fee-type').value,
    referral_fee_value: parseFloat(document.getElementById('ff-fee-val').value)||0,
    contract_start:     document.getElementById('ff-start').value||null,
    contract_end:       document.getElementById('ff-end').value||null,
    is_active:          document.getElementById('ff-active').value==='true',
    updated_at:         new Date().toISOString(),
  };
  try {
    if (id) { await sbPatch('health_facilities',id,payload); toast('✅ Diupdate','ok'); }
    else    { await sbPost('health_facilities',payload);    toast('✅ Ditambahkan','ok'); }
    closeModalForce();
    await loadFacilities();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteFacility(id) {
  if (!confirm('Hapus fasilitas ini?')) return;
  try { await sbDelete('health_facilities',id); toast('Dihapus','info'); await loadFacilities(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Export CSV helpers ─────────────────────────────
function exportPackagesCSV() {
  if (!pkgAll?.length) { toast('Tidak ada data','warn'); return; }
  const h = ['Kode Paket','Nama Paket','Kategori','Segment','Harga Normal','Harga Korporat','HPP','TAT','Aktif'];
  const r = pkgAll.map(p=>[p.kode_paket,p.nama_paket,p.kategori_paket||'',p.target_segment||'',
    p.harga_normal||0,p.harga_korporat||0,p.hpp_total||0,p.tat_jam||4,p.is_active?'true':'false']);
  const csv=[h,...r].map(row=>row.map(v=>`"${v}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='packages_export.csv';a.click();toast('Export berhasil','ok');
}

function exportCorporatesCSV() {
  if (!corpAll?.length) { toast('Tidak ada data','warn'); return; }
  const h=['Kode','Nama Corporate','Industri','PIC','HP PIC','Email PIC','Billing','Tenor','Status'];
  const r=corpAll.map(c=>[c.kode_corp,c.corporate_name,c.industry||'',c.pic_name||'',
    c.pic_phone||'',c.pic_email||'',c.billing_type||'',c.payment_terms||30,c.status]);
  const csv=[h,...r].map(row=>row.map(v=>`"${v}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='corporates_export.csv';a.click();toast('Export berhasil','ok');
}