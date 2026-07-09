// ═══════════════════════════════════════════
// MODULE: Configuration — Package & Corporate
// ═══════════════════════════════════════════

let pkgAll = [], corpAll = [];

// ══════════════════════════════════════════
// PACKAGE SERVICE
// ══════════════════════════════════════════
async function renderConfigPackage() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Paket Layanan</h1>
        <p>Master paket pemeriksaan — MCU, Screening, Gut Health, dll</p></div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="navigate('import')">📥 Import Excel</button>
        <button class="btn btn-ghost btn-sm" onclick="exportPackagesCSV()">📤 Export</button>
        <button class="btn btn-teal" onclick="openPackageForm()">+ Buat Paket</button>
      </div>
    </div>

    <!-- KPI -->
    <div id="pkg-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <div id="pkg-list">
      <div class="loading-row"><div class="spinner"></div></div>
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
    el.innerHTML=`<div class="empty-state"><div class="ico">📦</div>
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
                📋 Isi Tes
              </button>
              <button class="btn btn-ghost btn-sm" onclick="openPackageForm(${p.id})">✏️</button>
              <button class="btn btn-ghost btn-sm" style="color:#EF4444" onclick="deletePackage(${p.id})">🗑</button>
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
      <div class="modal-title">${id?'✏️ Edit Paket':'📦 Buat Paket Layanan'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
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
      <button class="btn btn-teal" onclick="savePackage(${id||'null'})">💾 Simpan</button>
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
      <div class="modal-title">📋 Tes dalam Paket: ${pkgName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
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
            <button onclick="deletePkgItem(${i.id})" class="act-btn del" style="padding:2px 6px">🗑</button>
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
  try { await sbDelete('package_items',id); toast('🗑 Dihapus','info'); }
  catch(e) { toast('❌ '+e.message,'err'); }
  const el=document.getElementById('pkg-items-list');
  if (el) el.innerHTML='<div class="loading-row"><div class="spinner"></div></div>';
}

async function deletePackage(id) {
  if (!confirm('Hapus paket ini? Item tes di dalamnya juga terhapus.')) return;
  try { await sbDelete('packages',id); toast('🗑 Dihapus','info'); await loadPackages(); }
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
        <button class="btn btn-ghost btn-sm" onclick="renderConfigHealthFacility()">🏥 Health Facility</button>
        <button class="btn btn-teal" onclick="navigate('import')">📥 Import</button>
        <button class="btn btn-ghost btn-sm" onclick="exportCorporatesCSV()">📤 Export</button>
        <button class="btn btn-teal" onclick="openCorpForm()">+ Tambah Corporate</button>
      </div>
    </div>

    <!-- KPI -->
    <div id="corp-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="corp-q" placeholder="🔍 Cari nama perusahaan..." oninput="filterCorp()" style="flex:1">
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
      <button class="btn btn-teal" style="margin-top:12px" onclick="openCorpForm()">+ Tambah Corporate</button>
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
          <button class="act-btn edit" onclick="openCorpForm(${c.id})">✏️</button>
          <button class="act-btn" onclick="openCorpContracts(${c.id},'${(c.corporate_name||'').replace(/'/g,"\\'")}')">📋</button>
          <button class="act-btn del" onclick="deleteCorp(${c.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function openCorpForm(id=null) {
  let c={};
  if (id) { const d=await sbGet('corporates',`select=*&id=eq.${id}`); c=d[0]||{}; }

  let partnerOpts = '<option value="">-- Link ke Partner (opsional) --</option>';
  try {
    const pts=await sbGet('partners','select=id,partner_name&status=eq.Aktif&order=partner_name&limit=200');
    partnerOpts+=(pts||[]).map(p=>`<option value="${p.id}" ${c.partner_id==p.id?'selected':''}>${p.partner_name}</option>`).join('');
  } catch(e){}

  const kode = `CORP-${Date.now().toString().slice(-5)}`;
  const user=getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Corporate':'🏢 Tambah Corporate'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Kode Corporate</label>
        <input type="text" id="cf-kode" value="${c.kode_corp||kode}">
      </div>
      <div class="form-group" style="grid-column:2/-1">
        <label>Nama Perusahaan *</label>
        <input type="text" id="cf-name" value="${c.corporate_name||''}" placeholder="PT. ABC Tbk">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Industri</label>
        <input type="text" id="cf-industry" value="${c.industry||''}" placeholder="Manufaktur, Perbankan...">
      </div>
      <div class="form-group">
        <label>Link ke Partner DB</label>
        <select id="cf-partner">${partnerOpts}</select>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding:12px 0;margin:8px 0">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">PIC / Kontak</div>
      <div class="form-row">
        <div class="form-group">
          <label>Nama PIC</label>
          <input type="text" id="cf-pic" value="${c.pic_name||''}" placeholder="Manager HRD...">
        </div>
        <div class="form-group">
          <label>No. HP PIC</label>
          <input type="text" id="cf-phone" value="${c.pic_phone||''}" placeholder="08xxxxxxxxxx">
        </div>
        <div class="form-group">
          <label>Email PIC</label>
          <input type="email" id="cf-email" value="${c.pic_email||''}" placeholder="hrd@perusahaan.com">
        </div>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding:12px 0;margin:8px 0">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Billing & Diskon</div>
      <div class="form-row">
        <div class="form-group">
          <label>Tipe Billing</label>
          <select id="cf-billing">
            ${['Invoice','Prepaid','Credit'].map(b=>`<option${(c.billing_type||'Invoice')===b?' selected':''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Payment Terms (hari)</label>
          <input type="number" id="cf-terms" value="${c.payment_terms||30}" min="0">
        </div>
        <div class="form-group">
          <label>Credit Limit (Rp)</label>
          <input type="number" id="cf-credit" value="${c.credit_limit||0}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tipe Diskon</label>
          <select id="cf-disc-type">
            <option value="none" ${(c.discount_type||'none')==='none'?'selected':''}>Tidak Ada</option>
            <option value="percent" ${c.discount_type==='percent'?'selected':''}>Persen (%)</option>
            <option value="fixed"   ${c.discount_type==='fixed'?'selected':''}>Nominal (Rp)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Nilai Diskon</label>
          <input type="number" id="cf-disc-val" value="${c.discount_value||0}">
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="cf-status">
            ${['Aktif','Non-Aktif','Suspend'].map(s=>`<option${(c.status||'Aktif')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveCorp(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function saveCorp(id) {
  const name = document.getElementById('cf-name').value.trim();
  if (!name) { toast('Nama perusahaan wajib diisi','err'); return; }
  const user=getUserName?getUserName():'User';

  const payload={
    kode_corp:       document.getElementById('cf-kode').value.trim(),
    corporate_name:  name,
    industry:        document.getElementById('cf-industry').value.trim()||null,
    partner_id:      parseInt(document.getElementById('cf-partner').value)||null,
    pic_name:        document.getElementById('cf-pic').value.trim()||null,
    pic_phone:       document.getElementById('cf-phone').value.trim()||null,
    pic_email:       document.getElementById('cf-email').value.trim()||null,
    billing_type:    document.getElementById('cf-billing').value,
    payment_terms:   parseInt(document.getElementById('cf-terms').value)||30,
    credit_limit:    parseFloat(document.getElementById('cf-credit').value)||0,
    discount_type:   document.getElementById('cf-disc-type').value,
    discount_value:  parseFloat(document.getElementById('cf-disc-val').value)||0,
    status:          document.getElementById('cf-status').value,
    created_by:      user,
    updated_at:      new Date().toISOString(),
  };

  try {
    if (id) { await sbPatch('corporates',id,payload); toast('✅ Corporate diupdate','ok'); }
    else    { await sbPost('corporates',payload);    toast('✅ Corporate ditambahkan','ok'); }
    closeModalForce();
    await loadCorporates();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteCorp(id) {
  if (!confirm('Hapus data corporate ini?')) return;
  try { await sbDelete('corporates',id); toast('🗑 Dihapus','info'); await loadCorporates(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}


// ══════════════════════════════════════════
// CORPORATE: Employee/Participant Management
// ══════════════════════════════════════════
async function openCorpEmployees(corpId, corpName) {
  const emps = await sbGet('corporate_employees',
    `select=*&corporate_id=eq.${corpId}&order=full_name.asc`).catch(()=>[]);

  const active   = (emps||[]).filter(e=>e.status==='Aktif').length;
  const inactive = (emps||[]).filter(e=>e.status==='Non-Aktif').length;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">👥 Data Karyawan — ${corpName}</div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="badge badge-green">${active} Aktif</span>
        <span class="badge badge-gray">${inactive} Non-Aktif</span>
        <button class="modal-close" onclick="closeModalForce()">✕</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px">
      <input class="table-search" id="cemp-q" placeholder="🔍 Cari nama, NIK..." 
        oninput="filterCorpEmps(${corpId})" style="flex:1">
      <select class="table-filter" id="cemp-status" onchange="filterCorpEmps(${corpId})">
        <option value="">Semua</option>
        <option>Aktif</option><option>Non-Aktif</option>
      </select>
      <button class="btn btn-teal btn-sm" onclick="openCorpEmpForm(${corpId},'${corpName.replace(/'/g,"\'")}')" >+ Tambah</button>
      <button class="btn btn-ghost btn-sm" onclick="importCorpEmps(${corpId})">📥 Import CSV</button>
    </div>

    <div id="cemp-list" style="max-height:400px;overflow-y:auto">
      ${(emps||[]).length ? `
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr style="background:var(--lgray)">
            <th style="padding:6px 10px;text-align:left">Nama</th>
            <th style="padding:6px 10px;text-align:left">NIK/ID</th>
            <th style="padding:6px 10px;text-align:left">Departemen</th>
            <th style="padding:6px 10px;text-align:left">Tgl Lahir</th>
            <th style="padding:6px 10px;text-align:left">Status</th>
            <th style="padding:6px 10px">Aksi</th>
          </tr></thead>
          <tbody id="cemp-tbody">
            ${(emps||[]).map(e=>`<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:6px 10px;font-weight:600">${e.full_name||'—'}</td>
              <td style="padding:6px 10px;font-family:monospace;font-size:11px">${e.employee_id||'—'}</td>
              <td style="padding:6px 10px;color:var(--gray)">${e.department||'—'}</td>
              <td style="padding:6px 10px;color:var(--gray)">${e.birth_date||'—'}</td>
              <td style="padding:6px 10px">
                <span style="background:${e.status==='Aktif'?'#E8F5E9':'#F1F5F9'};
                  color:${e.status==='Aktif'?'#2E7D32':'#546E7A'};
                  padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700">
                  ${e.status||'Non-Aktif'}
                </span>
              </td>
              <td style="padding:6px 10px">
                <div class="act-row">
                  <button class="act-btn edit" onclick="openCorpEmpForm(${corpId},'${corpName.replace(/'/g,"\'")}',${ e.id})">✏️</button>
                  <button class="act-btn del" onclick="deleteCorpEmp(${e.id},${corpId},'${corpName.replace(/'/g,"\'")}')">🗑</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>` :
        `<div class="empty-state" style="padding:30px">
          <div class="ico">👥</div>
          <h3>Belum ada data karyawan</h3>
          <p>Tambah manual atau import dari CSV</p>
        </div>`
      }
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal btn-sm" onclick="activateAllCorpEmps(${corpId},'${corpName.replace(/'/g,"\'")}')" style="color:#fff">
        ✅ Aktifkan Semua untuk MCU
      </button>
    </div>`);
}

async function openCorpEmpForm(corpId, corpName, id=null) {
  let e = {};
  if (id) {
    const d = await sbGet('corporate_employees',`select=*&id=eq.${id}`);
    e = d[0]||{};
  }
  const user = getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit':'➕ Tambah'} Karyawan — ${corpName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1">
        <label>Nama Lengkap *</label>
        <input type="text" id="cef-name" value="${e.full_name||''}" placeholder="Nama sesuai KTP">
      </div>
      <div class="form-group">
        <label>NIK / ID Karyawan</label>
        <input type="text" id="cef-id" value="${e.employee_id||''}" placeholder="NIK perusahaan">
      </div>
      <div class="form-group">
        <label>Departemen / Divisi</label>
        <input type="text" id="cef-dept" value="${e.department||''}" placeholder="HRD, Produksi...">
      </div>
      <div class="form-group">
        <label>Jenis Kelamin</label>
        <select id="cef-gender">
          <option value="M" ${(e.gender||'M')==='M'?'selected':''}>Laki-laki</option>
          <option value="F" ${e.gender==='F'?'selected':''}>Perempuan</option>
        </select>
      </div>
      <div class="form-group">
        <label>Tanggal Lahir</label>
        <input type="date" id="cef-dob" value="${e.birth_date||''}">
      </div>
      <div class="form-group">
        <label>No. HP</label>
        <input type="text" id="cef-phone" value="${e.phone||''}" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="cef-email" value="${e.email||''}" placeholder="email@perusahaan.com">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="cef-status">
          <option value="Non-Aktif" ${(e.status||'Non-Aktif')==='Non-Aktif'?'selected':''}>Non-Aktif (Terdaftar)</option>
          <option value="Aktif" ${e.status==='Aktif'?'selected':''}>Aktif (Sudah Booking)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Paket MCU</label>
        <select id="cef-package">
          <option value="">-- Pilih Paket (opsional) --</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Catatan Medis / Kondisi Khusus</label>
      <input type="text" id="cef-notes" value="${e.notes||''}" placeholder="Alergi, kondisi khusus...">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveCorpEmp(${corpId},${id||'null'})">💾 Simpan</button>
    </div>`);

  // Load packages
  try {
    const pkgs = await sbGet('packages','select=id,nama_paket&is_active=eq.true&order=nama_paket');
    const sel  = document.getElementById('cef-package');
    if (sel) {
      (pkgs||[]).forEach(p=>{
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nama_paket;
        if (p.id === e.package_id) opt.selected = true;
        sel.appendChild(opt);
      });
    }
  } catch(err){}
}

async function saveCorpEmp(corpId, id) {
  const name = document.getElementById('cef-name').value.trim();
  if (!name) { toast('Nama wajib diisi','err'); return; }
  const user = getUserName?getUserName():'User';

  const payload = {
    corporate_id: corpId,
    full_name:    name,
    employee_id:  document.getElementById('cef-id').value.trim()||null,
    department:   document.getElementById('cef-dept').value.trim()||null,
    gender:       document.getElementById('cef-gender').value,
    birth_date:   document.getElementById('cef-dob').value||null,
    phone:        document.getElementById('cef-phone').value.trim()||null,
    email:        document.getElementById('cef-email').value.trim()||null,
    status:       document.getElementById('cef-status').value,
    package_id:   parseInt(document.getElementById('cef-package').value)||null,
    notes:        document.getElementById('cef-notes').value.trim()||null,
    updated_at:   new Date().toISOString(),
  };

  try {
    if (id) { await sbPatch('corporate_employees',id,payload); toast('✅ Diupdate','ok'); }
    else    { await sbPost('corporate_employees',payload);    toast('✅ Karyawan ditambahkan','ok'); }
    closeModalForce();
    // Refresh corporate list without closing
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteCorpEmp(id, corpId, corpName) {
  if (!confirm('Hapus data karyawan ini?')) return;
  try {
    await sbDelete('corporate_employees',id);
    toast('🗑 Dihapus','info');
    await openCorpEmployees(corpId, corpName);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function activateAllCorpEmps(corpId, corpName) {
  if (!confirm('Aktifkan semua karyawan terdaftar untuk MCU?\nStatus akan berubah dari Non-Aktif → Aktif')) return;
  try {
    // Update all non-active employees of this corporate
    const emps = await sbGet('corporate_employees',
      `select=id&corporate_id=eq.${corpId}&status=eq.Non-Aktif`);
    for (const e of (emps||[])) {
      await sbPatch('corporate_employees',e.id,{status:'Aktif',updated_at:new Date().toISOString()});
    }
    toast(`✅ ${(emps||[]).length} karyawan diaktifkan`,'ok');
    await openCorpEmployees(corpId, corpName);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

function importCorpEmps(corpId) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">📥 Import Karyawan dari CSV</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
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
        📥 Import
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
      <div class="modal-title">📋 Kontrak: ${corpName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
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
      <div class="modal-title">📋 Kontrak Baru — ${corpName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
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
      <button class="btn btn-teal" onclick="saveContract(${corpId},'${corpName.replace(/'/g,"\\'")}')">💾 Simpan</button>
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
        <input class="table-search" id="fac-q" placeholder="🔍 Cari nama fasilitas..." oninput="filterFacility()" style="flex:1">
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
    el.innerHTML=`<div class="empty-state"><div class="ico">🏥</div>
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
        <button class="act-btn edit" onclick="openFacilityForm(${fa.id})">✏️</button>
        <button class="act-btn del" onclick="deleteFacility(${fa.id})">🗑</button>
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
      <div class="modal-title">${id?'✏️ Edit Fasilitas':'🏥 Tambah Health Facility'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
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
      <button class="btn btn-teal" onclick="saveFacility(${id||'null'})">💾 Simpan</button>
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
  try { await sbDelete('health_facilities',id); toast('🗑 Dihapus','info'); await loadFacilities(); }
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
  a.download='packages_export.csv';a.click();toast('📥 Export berhasil','ok');
}

function exportCorporatesCSV() {
  if (!corpAll?.length) { toast('Tidak ada data','warn'); return; }
  const h=['Kode','Nama Corporate','Industri','PIC','HP PIC','Email PIC','Billing','Tenor','Status'];
  const r=corpAll.map(c=>[c.kode_corp,c.corporate_name,c.industry||'',c.pic_name||'',
    c.pic_phone||'',c.pic_email||'',c.billing_type||'',c.payment_terms||30,c.status]);
  const csv=[h,...r].map(row=>row.map(v=>`"${v}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='corporates_export.csv';a.click();toast('📥 Export berhasil','ok');
}
