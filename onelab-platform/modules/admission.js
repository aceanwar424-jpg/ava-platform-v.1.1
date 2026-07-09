// ═══════════════════════════════════════════
// MODULE: Admission — Registrasi Pasien
// Flow: Walk-in / Booking / Project MCU
// ═══════════════════════════════════════════

let admAll = [], admFilter = { status:'', type:'', search:'' };

const ADM_STATUS = {
  'Registered':  {color:'#0EA5E9', icon:'📋'},
  'Anamnesa':    {color:'#8B5CF6', icon:'🩺'},
  'Lab':         {color:'#F59E0B', icon:'🧪'},
  'Radiology':   {color:'#F97316', icon:'🫁'},
  'Done':        {color:'#22C55E', icon:'✅'},
  'Cancelled':   {color:'#EF4444', icon:'❌'},
};

async function renderAdmission() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Admission</h1>
        <p>Registrasi pasien — Walk-in, Booking, Rujukan, Project MCU</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderAdmissionReport()">📊 Laporan</button>
        <button class="btn btn-teal" onclick="openAdmissionForm()">+ Registrasi Pasien</button>
      </div>
    </div>

    <!-- KPI -->
    <div id="adm-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <!-- Status Filter -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="adm-status-tabs">
      <button class="btn btn-teal btn-sm" onclick="setAdmFilter('','',this)">Semua</button>
      ${Object.entries(ADM_STATUS).map(([s,v])=>
        `<button class="btn btn-ghost btn-sm" onclick="setAdmFilter('status','${s}',this)">${v.icon} ${s}</button>`
      ).join('')}
    </div>

    <!-- Search + Date -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <input class="table-search" id="adm-q" placeholder="🔍 Cari nama pasien, no. kunjungan..."
        oninput="admFilter.search=this.value;applyAdmFilter()" style="flex:1">
      <select class="table-filter" id="adm-type" onchange="admFilter.type=this.value;applyAdmFilter()">
        <option value="">Semua Tipe</option>
        <option>Walk-in</option><option>Booking</option>
        <option>Rujukan</option><option>Project MCU</option>
      </select>
      <input type="date" class="table-filter" id="adm-date" onchange="applyAdmFilter()"
        value="${new Date().toISOString().split('T')[0]}">
    </div>

    <div id="adm-list">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;

  await loadAdmissions();
}

async function loadAdmissions() {
  try {
    const date = document.getElementById('adm-date')?.value || new Date().toISOString().split('T')[0];
    const data = await sbGet('admissions',
      `select=*&visit_date=eq.${date}&order=created_at.desc`);
    admAll = Array.isArray(data) ? data : [];
    renderAdmKPI();
    applyAdmFilter();
  } catch(e) {
    document.getElementById('adm-list').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderAdmKPI() {
  const el = document.getElementById('adm-kpi'); if (!el) return;
  const done    = admAll.filter(a=>a.status==='Done').length;
  const active  = admAll.filter(a=>!['Done','Cancelled'].includes(a.status)).length;
  const revenue = admAll.filter(a=>a.payment_status==='Paid').reduce((s,a)=>s+(a.net_amount||0),0);
  el.innerHTML = [
    {icon:'📋', val:admAll.length,        label:'Total Hari Ini',  color:'#0A2342'},
    {icon:'🔵', val:active,               label:'Sedang Dilayani', color:'#0EA5E9'},
    {icon:'✅', val:done,                 label:'Selesai',         color:'#22C55E'},
    {icon:'❌', val:admAll.filter(a=>a.status==='Cancelled').length, label:'Batal', color:'#EF4444'},
    {icon:'💰', val:formatCurrency(revenue), label:'Revenue Hari Ini', color:'#8B5CF6'},
    {icon:'🏥', val:admAll.filter(a=>a.visit_type==='Project MCU').length, label:'MCU Project', color:'#F59E0B'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:10px 12px;border:1px solid var(--border);border-left:4px solid ${k.color}">
      <div style="font-size:18px">${k.icon}</div>
      <div style="font-size:16px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

function setAdmFilter(key, val, btn) {
  document.querySelectorAll('#adm-status-tabs button').forEach(b=>b.className='btn btn-ghost btn-sm');
  btn.className = 'btn btn-teal btn-sm';
  if (key==='status') admFilter.status = val;
  applyAdmFilter();
}

function applyAdmFilter() {
  const q  = admFilter.search.toLowerCase();
  const st = admFilter.status;
  const tp = admFilter.type;
  const f  = admAll.filter(a=>
    (!q  || (a.patient_name||'').toLowerCase().includes(q) ||
             (a.visit_number||'').toLowerCase().includes(q)) &&
    (!st || a.status===st) &&
    (!tp || a.visit_type===tp)
  );
  renderAdmList(f);
}

function renderAdmList(data) {
  const el = document.getElementById('adm-list');
  if (!data.length) {
    el.innerHTML=`<div class="empty-state"><div class="ico">📋</div>
      <h3>${admAll.length?'Tidak ada hasil':'Belum ada kunjungan hari ini'}</h3>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openAdmissionForm()">+ Registrasi Pasien</button>
    </div>`; return;
  }

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
    ${data.map(a=>{
      const st = ADM_STATUS[a.status]||ADM_STATUS['Registered'];
      return `
      <div class="card" style="padding:12px 16px;border-left:4px solid ${st.color}">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <!-- Visit Number -->
          <div style="font-size:11px;font-family:monospace;color:var(--gray);min-width:120px">
            ${a.visit_number||'—'}
          </div>
          <!-- Patient -->
          <div style="flex:1;min-width:150px">
            <div style="font-weight:700;color:var(--navy)">${a.patient_name||'—'}</div>
            <div style="font-size:11px;color:var(--gray)">
              ${a.patient_gender||''} ${a.patient_age?'· '+a.patient_age+' thn':''} 
              ${a.patient_phone?'· '+a.patient_phone:''}
            </div>
          </div>
          <!-- Package/Service -->
          <div style="min-width:140px">
            <div style="font-size:12px;font-weight:600;color:var(--navy)">${a.package_name||'Layanan Individual'}</div>
            <div style="font-size:11px;color:var(--gray)">${a.visit_type||'Walk-in'}</div>
          </div>
          <!-- Status -->
          <div>
            <span style="background:${st.color}20;color:${st.color};padding:3px 10px;
              border-radius:10px;font-size:11px;font-weight:700">${st.icon} ${a.status}</span>
          </div>
          <!-- Amount -->
          <div style="text-align:right;min-width:100px">
            <div style="font-size:13px;font-weight:700;color:var(--navy)">${formatCurrency(a.net_amount||0)}</div>
            <div style="font-size:10px;color:${a.payment_status==='Paid'?'#22C55E':'#F59E0B'}">
              ${a.payment_status||'Unpaid'}
            </div>
          </div>
          <!-- Actions -->
          <div class="act-row" style="flex-shrink:0">
            ${a.status==='Registered'?`<button class="btn btn-teal btn-xs" onclick="updateAdmStatus(${a.id},'Anamnesa')">→ Anamnesa</button>`:''}
            ${a.status==='Anamnesa'?`<button class="btn btn-teal btn-xs" onclick="updateAdmStatus(${a.id},'Lab')">→ Lab</button>`:''}
            ${a.status==='Lab'?`<button class="btn btn-teal btn-xs" onclick="updateAdmStatus(${a.id},'Done')">→ Selesai</button>`:''}
            ${a.package_id?`<button class="act-btn" title="Cetak Ulang Label Sampel" onclick="reprintSampleLabels(${a.id})">🏷️</button>`:''}
            <button class="act-btn edit" onclick="openAdmissionForm(${a.id})">✏️</button>
            ${a.payment_status!=='Paid'?`<button class="act-btn" style="color:#22C55E;font-size:11px" onclick="markAdmPaid(${a.id})">Bayar</button>`:''}
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

async function updateAdmStatus(id, status) {
  try {
    await sbPatch('admissions',id,{status,updated_at:new Date().toISOString()});
    toast(`✅ Status → ${status}`,'ok');
    await loadAdmissions();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function markAdmPaid(id) {
  try {
    await sbPatch('admissions',id,{payment_status:'Paid',updated_at:new Date().toISOString()});
    toast('✅ Pembayaran dicatat','ok');
    await loadAdmissions();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ═══════════════════════════════════════════════════════════════
// TABBED ADMISSION FORM — Patient / Payment / Services / Cashier
// Mirrors Virtu Digilab reference structure
// ═══════════════════════════════════════════════════════════════

let admFormState = { patientIds: [], serviceLines: [], admissionId: null, activeTab: 'patient' };

function toggleProjectField(type) {
  const el = document.getElementById('af-project-row');
  if (el) el.style.display = type==='Project MCU' ? '' : 'none';
}

function calcAge() {
  const dob = document.getElementById('af-dob')?.value;
  if (!dob) return;
  const age = Math.floor((new Date()-new Date(dob))/(365.25*86400000));
  const el  = document.getElementById('af-age');
  if (el) el.value = age;
}

const PATIENT_ID_TYPES = [
  'STR/SIP Number','ID Card Number','Organization Identifier','Health Plan Identifier',
  'Work Permit',"Workers' Comp Number",'WIC Identifier','VISA','Visitor Permit',
  'Visit Number','Unique Specimen ID','Medicare/CMS','Universal Device Identifier','Unspecified Identifier',
];

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const MARITAL_STATUS = ['Belum Menikah','Menikah','Cerai Hidup','Cerai Mati'];
const RELIGIONS = ['Islam','Kristen Protestan','Katolik','Hindu','Buddha','Khonghucu','Lainnya'];

// ── Postal code autofill — fills subdistrict/district/city/province
// from kode pos, but all four remain manually editable afterward.
async function lookupPostalCode() {
  const code = document.getElementById('af-postal')?.value?.trim();
  if (!code || code.length < 4) return;
  try {
    const rows = await sbGet('postal_codes', `select=*&postal_code=eq.${code}&limit=20`).catch(()=>[]);
    if (!rows || !rows.length) {
      toast(`⚠️ Kode pos ${code} tidak ditemukan di database`, 'warn', 3000);
      return;
    }
    // Multiple villages can share one postal code — if so, let user pick which subdistrict
    if (rows.length === 1) {
      applyPostalResult(rows[0]);
    } else {
      const sel = document.getElementById('af-postal-multi');
      if (sel) {
        sel.style.display = '';
        sel.innerHTML = `<option value="">-- Pilih Kelurahan (${rows.length} cocok) --</option>` +
          rows.map((r,i)=>`<option value="${i}">${r.subdistrict}, ${r.district}, ${r.city}</option>`).join('');
        sel.dataset.rows = JSON.stringify(rows);
      }
    }
  } catch(e) { console.error('[lookupPostalCode]', e); }
}

function applyPostalMultiChoice() {
  const sel = document.getElementById('af-postal-multi');
  if (!sel?.value) return;
  const rows = JSON.parse(sel.dataset.rows||'[]');
  applyPostalResult(rows[parseInt(sel.value)]);
}

function applyPostalResult(row) {
  if (!row) return;
  const setVal = (id,v) => { const el=document.getElementById(id); if (el) el.value = v||''; };
  setVal('af-subdistrict', row.subdistrict);
  setVal('af-district',    row.district);
  setVal('af-city',        row.city);
  setVal('af-province',    row.province);
  const multiSel = document.getElementById('af-postal-multi');
  if (multiSel) multiSel.style.display = 'none';
  toast(`📍 Alamat terisi otomatis dari kode pos ${row.postal_code}`, 'ok', 2500);
}

// ── Patient ID multi-row table (Add ID) ──────────────────────
function renderPatientIdTable() {
  const el = document.getElementById('af-id-table'); if (!el) return;
  if (!admFormState.patientIds.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:10px;text-align:center">Belum ada ID ditambahkan</div>`;
    return;
  }
  el.innerHTML = `
    <table style="width:100%;font-size:11.5px;border-collapse:collapse">
      <thead><tr style="background:var(--bg)">
        <th style="padding:4px;width:30px"></th><th style="padding:4px;text-align:left">ID Type</th>
        <th style="padding:4px;text-align:left">ID Number</th><th style="padding:4px;text-align:left">Issuer Country</th>
        <th style="padding:4px;width:36px"></th>
      </tr></thead>
      <tbody>
        ${admFormState.patientIds.map((row,i)=>`
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:3px;text-align:center">
              <input type="radio" name="af-id-primary" ${row.is_primary?'checked':''} onchange="setPrimaryPatientId(${i})">
            </td>
            <td style="padding:3px">
              <select onchange="updatePatientIdField(${i},'id_type',this.value)" style="font-size:11px;padding:3px;width:100%">
                <option value="">-- Pilih --</option>
                ${PATIENT_ID_TYPES.map(t=>`<option value="${t}" ${row.id_type===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </td>
            <td style="padding:3px"><input type="text" value="${row.id_number||''}" oninput="updatePatientIdField(${i},'id_number',this.value)" style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="text" value="${row.issuer_country||'Indonesia'}" oninput="updatePatientIdField(${i},'issuer_country',this.value)" style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px;text-align:center"><button class="btn btn-ghost btn-xs" onclick="removePatientId(${i})" style="color:#EF4444">✕</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}
function addPatientId() {
  admFormState.patientIds.push({ id_type:'', id_number:'', issuer_country:'Indonesia', is_primary: admFormState.patientIds.length===0 });
  renderPatientIdTable();
}
function removePatientId(i) {
  const wasPrimary = admFormState.patientIds[i]?.is_primary;
  admFormState.patientIds.splice(i,1);
  if (wasPrimary && admFormState.patientIds.length) admFormState.patientIds[0].is_primary = true;
  renderPatientIdTable();
}
function updatePatientIdField(i,key,val) { if (admFormState.patientIds[i]) admFormState.patientIds[i][key] = val; }
function setPrimaryPatientId(i) { admFormState.patientIds.forEach((r,idx)=>r.is_primary = idx===i); }

// ── Services line-item table (dropdown sourced from master products) ──
let admMasterProducts = [];

function renderServiceLines() {
  const el = document.getElementById('af-services-table'); if (!el) return;
  el.innerHTML = `
    <table style="width:100%;font-size:11.5px;border-collapse:collapse">
      <thead><tr style="background:var(--bg)">
        <th style="padding:4px;text-align:left;min-width:180px">Name</th><th style="padding:4px;min-width:80px">Priority</th>
        <th style="padding:4px;min-width:90px">Unit Price</th><th style="padding:4px;min-width:60px">Disc %</th>
        <th style="padding:4px;min-width:90px">Disc (Rp)</th><th style="padding:4px;min-width:100px">Sub Total</th>
        <th style="padding:4px;width:36px"></th>
      </tr></thead>
      <tbody>
        ${admFormState.serviceLines.map((row,i)=>{
          const subtotal = calcServiceLineSubtotal(row);
          return `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:3px">
              <select onchange="selectServiceLineProduct(${i},this)" style="font-size:11px;padding:3px;width:100%">
                <option value="">-- Pilih Tes/Layanan --</option>
                ${admMasterProducts.map(pr=>`<option value="${pr.id}" data-price="${pr.harga_normal||0}" data-name="${pr.nama_tes}"
                  ${row.product_id==pr.id?'selected':''}>[${pr.kode_internal||'—'}] ${pr.nama_tes}</option>`).join('')}
              </select>
            </td>
            <td style="padding:3px">
              <select onchange="updateServiceLine(${i},'priority',this.value)" style="font-size:11px;padding:3px;width:100%">
                ${['-','Normal','Urgent','Cito'].map(p=>`<option ${row.priority===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </td>
            <td style="padding:3px"><input type="number" value="${row.unit_price||0}" oninput="updateServiceLine(${i},'unit_price',this.value)" style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="number" value="${row.discount_pct||0}" oninput="updateServiceLine(${i},'discount_pct',this.value)" style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="number" value="${row.discount_idr||0}" oninput="updateServiceLine(${i},'discount_idr',this.value)" style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px;font-weight:700">${formatCurrency(subtotal)}</td>
            <td style="padding:3px;text-align:center"><button class="btn btn-ghost btn-xs" onclick="removeServiceLine(${i})" style="color:#EF4444">✕</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:8px">
      <button class="btn btn-ghost btn-sm" onclick="addServiceLine()">+ Add</button>
    </div>`;
  recalcServiceTotals();
}
function calcServiceLineSubtotal(row) {
  const unit = parseFloat(row.unit_price||0);
  const discPct = parseFloat(row.discount_pct||0);
  const discIdr = parseFloat(row.discount_idr||0);
  const afterPct = unit - (unit*discPct/100);
  return Math.max(0, afterPct - discIdr);
}
function addServiceLine() {
  admFormState.serviceLines.push({ product_id:null, name:'', priority:'-', unit_price:0, discount_pct:0, discount_idr:0 });
  renderServiceLines();
}
function removeServiceLine(i) { admFormState.serviceLines.splice(i,1); renderServiceLines(); }
function updateServiceLine(i,key,val) {
  if (!admFormState.serviceLines[i]) return;
  admFormState.serviceLines[i][key] = ['unit_price','discount_pct','discount_idr'].includes(key) ? parseFloat(val)||0 : val;
  renderServiceLines();
}
function selectServiceLineProduct(i, sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!admFormState.serviceLines[i]) return;
  admFormState.serviceLines[i].product_id = parseInt(sel.value)||null;
  admFormState.serviceLines[i].name = opt?.dataset.name||'';
  admFormState.serviceLines[i].unit_price = parseFloat(opt?.dataset.price||0);
  renderServiceLines();
}
function recalcServiceTotals() {
  const total = admFormState.serviceLines.reduce((s,r)=>s+calcServiceLineSubtotal(r),0);
  const discTotal = admFormState.serviceLines.reduce((s,r)=>{
    const unit = parseFloat(r.unit_price||0);
    return s + (unit*parseFloat(r.discount_pct||0)/100) + parseFloat(r.discount_idr||0);
  },0);
  const setVal = (id,v) => { const el=document.getElementById(id); if (el) el.value = v; };
  setVal('af-total-price', Math.round(total+discTotal));
  setVal('af-discount', Math.round(discTotal));
  setVal('af-total-net', Math.round(total));
  // mirror into Payment/Cashier tab summary widgets if present
  ['af-pay-total','af-cash-total'].forEach(id=>setVal(id, Math.round(total)));
}

// ── Main tabbed Admission Form ───────────────────────────────
async function openAdmissionForm(id=null) {
  let a={};
  if (id) { const d=await sbGet('admissions',`select=*&id=eq.${id}`); a=d[0]||{}; }

  // Load packages, corporates, projects, master products in parallel
  let pkgs=[], corps=[], projs=[];
  try {
    [pkgs, corps, projs, admMasterProducts] = await Promise.all([
      sbGet('packages','select=id,nama_paket,harga_normal,kode_paket&is_active=eq.true&order=nama_paket').catch(()=>[]),
      sbGet('corporates','select=id,corporate_name,discount_type,discount_value&status=eq.Aktif&order=corporate_name').catch(()=>[]),
      sbGet('projects','select=id,project_name,project_code&status=eq.Active&order=created_at.desc&limit=50').catch(()=>[]),
      sbGet('products','select=id,kode_internal,nama_tes,hpp,harga_normal,kategori&is_active=eq.true&order=kategori,nama_tes').catch(()=>[]),
    ]);
  } catch(e) {}

  // Load existing patient IDs and service lines if editing
  admFormState = { patientIds: [], serviceLines: [], admissionId: id, activeTab: 'patient' };
  if (id) {
    try {
      const existingIds = await sbGet('patient_ids', `select=*&admission_id=eq.${id}`).catch(()=>[]);
      admFormState.patientIds = (existingIds||[]).map(r=>({ id_type:r.id_type, id_number:r.id_number, issuer_country:r.issuer_country, is_primary:r.is_primary }));
    } catch(e){}
    try {
      const svcIds = a.services ? JSON.parse(a.services) : [];
      admFormState.serviceLines = (svcIds||[]).map(s => ({
        product_id: s.product_id, name: s.name, priority: s.priority||'-',
        unit_price: s.unit_price||0, discount_pct: s.discount_pct||0, discount_idr: s.discount_idr||0,
      }));
    } catch(e){}
  }
  if (!admFormState.patientIds.length && a.patient_id_number) {
    admFormState.patientIds.push({ id_type: a.patient_id_type||'ID Card Number', id_number: a.patient_id_number, issuer_country:'Indonesia', is_primary:true });
  }

  const pkgOpts = '<option value="">-- Pilih Paket (opsional) --</option>' +
    (pkgs||[]).map(p=>`<option value="${p.id}" data-price="${p.harga_normal||0}" data-name="${p.nama_paket}"
      ${a.package_id==p.id?'selected':''}>${p.kode_paket} — ${p.nama_paket} (${formatCurrency(p.harga_normal||0)})</option>`).join('');
  const corpOpts = '<option value="">-- Umum (bukan korporat) --</option>' +
    (corps||[]).map(c=>`<option value="${c.id}" data-disc-type="${c.discount_type||'none'}" data-disc-val="${c.discount_value||0}"
      ${a.corporate_id==c.id?'selected':''}>${c.corporate_name}</option>`).join('');
  const projOpts = '<option value="">-- Tidak terkait project --</option>' +
    (projs||[]).map(p=>`<option value="${p.id}" ${a.project_id==p.id?'selected':''}>${p.project_code} — ${p.project_name}</option>`).join('');

  const today=new Date().toISOString().split('T')[0];
  const visitNum=id?a.visit_number:`VISIT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-3)}`;
  const mrNum = id ? (a.mr_number||'') : `MR-${Date.now().toString().slice(-8)}`;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Registrasi':'📋 Service Registration Form'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px">
      ${[['patient','Patient'],['payment','Payment'],['services','Services'],['cashier','Cashier']].map(([k,label])=>`
        <button onclick="switchAdmTab('${k}')" id="af-tab-${k}"
          style="padding:9px 18px;border:none;background:none;cursor:pointer;font-size:12.5px;font-weight:700;
          color:${k==='patient'?'var(--teal)':'var(--text3)'};border-bottom:2.5px solid ${k==='patient'?'var(--teal)':'transparent'}">
          ${label}
        </button>`).join('')}
    </div>

    <!-- ═══ TAB: PATIENT ═══ -->
    <div id="af-tab-content-patient">
      <div style="background:var(--lgray);border-radius:8px;padding:10px 14px;margin-bottom:14px">
        <div class="form-row">
          <div class="form-group"><label>No. Kunjungan</label><input type="text" id="af-visit" value="${visitNum}" readonly style="background:#fff;font-family:monospace"></div>
          <div class="form-group"><label>MR Number</label><input type="text" id="af-mr" value="${mrNum}" readonly style="background:#fff;font-family:monospace"></div>
          <div class="form-group">
            <label>Tipe Kunjungan</label>
            <select id="af-type" onchange="toggleProjectField(this.value)">
              ${['Walk-in','Booking','Rujukan','Project MCU'].map(t=>`<option${(a.visit_type||'Walk-in')===t?' selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Tanggal</label><input type="date" id="af-date" value="${a.visit_date||today}"></div>
        </div>
        <div id="af-project-row" style="${a.visit_type==='Project MCU'?'':'display:none'}">
          <div class="form-group"><label>Project MCU</label><select id="af-project">${projOpts}</select></div>
        </div>
      </div>

      <div style="display:flex;gap:16px">
        <div style="flex:1">
          <div class="form-row">
            <div class="form-group" style="grid-column:1/-1"><label>Nama Lengkap *</label><input type="text" id="af-name" value="${a.patient_name||''}" placeholder="Nama sesuai KTP"></div>
            <div class="form-group">
              <label>Gender / Salutation</label>
              <div style="display:flex;gap:6px">
                <select id="af-gender" style="flex:1">
                  <option value="M" ${(a.patient_gender||'M')==='M'?'selected':''}>Laki-laki</option>
                  <option value="F" ${a.patient_gender==='F'?'selected':''}>Perempuan</option>
                </select>
                <input type="text" id="af-salutation" value="${a.patient_salutation||''}" placeholder="Tn/Ny/Nn" style="width:70px">
              </div>
            </div>
            <div class="form-group">
              <label>Tanggal Lahir / Usia</label>
              <div style="display:flex;gap:6px">
                <input type="date" id="af-dob" value="${a.patient_dob||''}" onchange="calcAge()" style="flex:1">
                <input type="number" id="af-age" value="${a.patient_age||''}" placeholder="thn" style="width:60px">
              </div>
            </div>
            <div class="form-group"><label>Place of Birth</label><input type="text" id="af-pob" value="${a.patient_place_of_birth||''}"></div>
            <div class="form-group">
              <label>Country of Birth</label>
              <input type="text" id="af-cob" value="${a.patient_country_of_birth||'Indonesia'}">
            </div>
            <div class="form-group"><label>Mobile Phone</label><input type="text" id="af-phone" value="${a.patient_phone||''}" placeholder="08xxxxxxxxxx"></div>
            <div class="form-group"><label>Email</label><input type="email" id="af-email" value="${a.patient_email||''}"></div>
            <div class="form-group">
              <label>Blood Type</label>
              <select id="af-bloodtype">
                <option value="">-- Pilih --</option>
                ${BLOOD_TYPES.map(b=>`<option ${a.patient_blood_type===b?'selected':''}>${b}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Marital Status</label>
              <select id="af-marital">
                <option value="">-- Pilih --</option>
                ${MARITAL_STATUS.map(m=>`<option ${a.patient_marital_status===m?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Religion</label>
              <select id="af-religion">
                <option value="">-- Pilih --</option>
                ${RELIGIONS.map(r=>`<option ${a.patient_religion===r?'selected':''}>${r}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Ethnicity</label><input type="text" id="af-ethnicity" value="${a.patient_ethnicity||''}"></div>
          </div>
        </div>
        <div style="width:130px;flex-shrink:0">
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Photo Profile</label>
          <div style="width:120px;height:120px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:28px">👤</div>
        </div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">
        <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Address</div>
        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <div style="display:flex;gap:14px;padding:8px 0">
              <label style="font-weight:400;display:flex;align-items:center;gap:4px"><input type="radio" name="af-category" value="WNI" ${(a.patient_category||'WNI')==='WNI'?'checked':''}> WNI</label>
              <label style="font-weight:400;display:flex;align-items:center;gap:4px"><input type="radio" name="af-category" value="WNA" ${a.patient_category==='WNA'?'checked':''}> WNA</label>
            </div>
          </div>
          <div class="form-group">
            <label>Kode Pos</label>
            <input type="text" id="af-postal" value="${a.patient_postal_code||''}" placeholder="cth: 15224"
              onchange="lookupPostalCode()" maxlength="5">
            <select id="af-postal-multi" onchange="applyPostalMultiChoice()" style="display:none;margin-top:4px;font-size:11px"></select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Subdistrict (Kelurahan)</label><input type="text" id="af-subdistrict" value="${a.patient_subdistrict||''}"></div>
          <div class="form-group"><label>District (Kecamatan)</label><input type="text" id="af-district" value="${a.patient_district||''}"></div>
          <div class="form-group"><label>City</label><input type="text" id="af-city" value="${a.patient_city||''}"></div>
          <div class="form-group"><label>Province</label><input type="text" id="af-province" value="${a.patient_province||''}"></div>
        </div>
        <div class="form-group"><label>Alamat Lengkap (Detail — jalan/no rumah)</label><textarea id="af-address" rows="2">${a.patient_address||''}</textarea></div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase">Identity Documents (Add ID)</div>
          <button class="btn btn-ghost btn-xs" onclick="addPatientId()">+ Add ID</button>
        </div>
        <div id="af-id-table"></div>
      </div>
    </div>

    <!-- ═══ TAB: PAYMENT ═══ -->
    <div id="af-tab-content-payment" style="display:none">
      <div class="form-row">
        <div class="form-group" style="grid-column:1/-1"><label>Corporate / Korporat</label><select id="af-corp">${corpOpts}</select></div>
        <div class="form-group">
          <label>Class</label>
          <select id="af-class">${['Non Kelas','VIP','Kelas 1','Kelas 2','Kelas 3'].map(c=>`<option ${a.patient_class===c?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Payment Type</label>
          <select id="af-paytype">${['Personal','Corporate','BPJS','Asuransi'].map(p=>`<option ${a.payment_type===p?'selected':''}>${p}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row" style="margin-top:10px">
        <div class="form-group"><label>Total Price</label><input type="number" id="af-pay-total" readonly style="background:var(--lgray)"></div>
        <div class="form-group"><label>Status Pembayaran</label>
          <select id="af-paystatus">${['Unpaid','DP','Paid','Billed'].map(s=>`<option${(a.payment_status||'Unpaid')===s?' selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
    </div>

    <!-- ═══ TAB: SERVICES ═══ -->
    <div id="af-tab-content-services" style="display:none">
      <div class="form-row" style="margin-bottom:10px">
        <div class="form-group" style="grid-column:1/-1">
          <label>Paket Pemeriksaan (opsional — atau pilih layanan satuan di bawah)</label>
          <select id="af-package" onchange="applyPackagePrefill()">${pkgOpts}</select>
        </div>
      </div>
      <div id="af-services-table"></div>
    </div>

    <!-- ═══ TAB: CASHIER ═══ -->
    <div id="af-tab-content-cashier" style="display:none">
      <div class="form-row">
        <div class="form-group"><label>Total Price</label><input type="number" id="af-total-price" readonly style="background:var(--lgray)"></div>
        <div class="form-group"><label>Discount (Rp)</label><input type="number" id="af-discount" readonly style="background:var(--lgray)"></div>
        <div class="form-group"><label>Total Net</label><input type="number" id="af-total-net" readonly style="background:var(--lgray);font-weight:700;color:var(--teal)"></div>
        <div class="form-group"><label>Cashier Total</label><input type="number" id="af-cash-total" readonly style="background:var(--lgray)"></div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveAdmission(${id||'null'})">${id?'💾 Update':'📋 Save & Print'}</button>
    </div>`,'wide');

  renderPatientIdTable();
  renderServiceLines();
}

function switchAdmTab(tab) {
  admFormState.activeTab = tab;
  ['patient','payment','services','cashier'].forEach(t=>{
    const content = document.getElementById(`af-tab-content-${t}`);
    const btn = document.getElementById(`af-tab-${t}`);
    if (content) content.style.display = t===tab ? '' : 'none';
    if (btn) {
      btn.style.color = t===tab ? 'var(--teal)' : 'var(--text3)';
      btn.style.borderBottom = t===tab ? '2.5px solid var(--teal)' : '2.5px solid transparent';
    }
  });
}

function applyPackagePrefill() {
  const sel = document.getElementById('af-package');
  if (!sel?.value) return;
  const opt = sel.options[sel.selectedIndex];
  const price = parseFloat(opt?.dataset.price||0);
  const name = opt?.dataset.name||'';
  // Package adds as a single line item; individual tests can still be added alongside
  admFormState.serviceLines.push({ product_id:null, name:`[PAKET] ${name}`, priority:'-', unit_price:price, discount_pct:0, discount_idr:0 });
  renderServiceLines();
}

async function saveAdmission(id) {
  const name = document.getElementById('af-name').value.trim();
  if (!name) { toast('Nama pasien wajib diisi','err'); return; }

  const pkgSel = document.getElementById('af-package');
  const pkgName = pkgSel?.value ? pkgSel.options[pkgSel.selectedIndex]?.dataset.name||'' : '';
  const user = getUserName?getUserName():'User';
  const categoryEl = document.querySelector('input[name="af-category"]:checked');

  const servicesJson = JSON.stringify(admFormState.serviceLines.map(r=>({
    product_id:r.product_id, name:r.name, priority:r.priority,
    unit_price:r.unit_price, discount_pct:r.discount_pct, discount_idr:r.discount_idr,
  })));

  const primaryId = admFormState.patientIds.find(r=>r.is_primary) || admFormState.patientIds[0];

  const payload={
    visit_number:      document.getElementById('af-visit').value,
    mr_number:          document.getElementById('af-mr')?.value||null,
    visit_type:        document.getElementById('af-type').value,
    visit_date:        document.getElementById('af-date').value,
    project_id:        parseInt(document.getElementById('af-project')?.value)||null,
    patient_name:      name,
    patient_salutation: document.getElementById('af-salutation')?.value.trim()||null,
    patient_gender:    document.getElementById('af-gender').value,
    patient_dob:       document.getElementById('af-dob').value||null,
    patient_age:       parseInt(document.getElementById('af-age').value)||null,
    patient_place_of_birth: document.getElementById('af-pob')?.value.trim()||null,
    patient_country_of_birth: document.getElementById('af-cob')?.value.trim()||'Indonesia',
    patient_phone:     document.getElementById('af-phone').value.trim()||null,
    patient_email:     document.getElementById('af-email')?.value.trim()||null,
    patient_blood_type: document.getElementById('af-bloodtype')?.value||null,
    patient_marital_status: document.getElementById('af-marital')?.value||null,
    patient_religion:  document.getElementById('af-religion')?.value||null,
    patient_ethnicity: document.getElementById('af-ethnicity')?.value.trim()||null,
    patient_category:  categoryEl?.value||'WNI',
    patient_postal_code: document.getElementById('af-postal')?.value.trim()||null,
    patient_subdistrict: document.getElementById('af-subdistrict')?.value.trim()||null,
    patient_district:  document.getElementById('af-district')?.value.trim()||null,
    patient_city:       document.getElementById('af-city')?.value.trim()||null,
    patient_province:  document.getElementById('af-province')?.value.trim()||null,
    patient_address:   document.getElementById('af-address')?.value.trim()||null,
    patient_id_type:   primaryId?.id_type||'ID Card Number',
    patient_id_number: primaryId?.id_number||null,
    package_id:        parseInt(pkgSel?.value)||null,
    package_name:      pkgName||null,
    corporate_id:      parseInt(document.getElementById('af-corp')?.value)||null,
    services:          servicesJson,
    total_amount:      parseFloat(document.getElementById('af-total-price')?.value)||0,
    discount_amount:   parseFloat(document.getElementById('af-discount')?.value)||0,
    net_amount:        parseFloat(document.getElementById('af-total-net')?.value)||0,
    payment_status:    document.getElementById('af-paystatus')?.value||'Unpaid',
    status:            id ? undefined : 'Registered',
    registered_by:     user,
    updated_at:        new Date().toISOString(),
  };
  if (id) delete payload.status;

  try {
    let admissionId = id;
    if (id) {
      await sbPatch('admissions',id,payload); toast('✅ Data diupdate','ok');
    } else {
      const created = await sbPost('admissions',payload);
      admissionId = created?.[0]?.id || created?.id;
      toast('✅ Pasien terdaftar','ok');
    }

    // Sync patient_ids table — replace all rows for this admission
    if (admissionId) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/patient_ids?admission_id=eq.${admissionId}`,{
          method:'DELETE', headers:{...SB_HEADERS,'Prefer':'return=minimal'}
        });
        const idsToSave = admFormState.patientIds.filter(r=>r.id_type && r.id_number);
        if (idsToSave.length) {
          await sbPost('patient_ids', idsToSave.map(r=>({
            admission_id: admissionId, is_primary: !!r.is_primary,
            id_type: r.id_type, id_number: r.id_number, issuer_country: r.issuer_country||'Indonesia',
          })));
        }
      } catch(e) { console.error('[saveAdmission] patient_ids sync failed:', e); }
    }

    closeModalForce();
    await loadAdmissions();

    // Auto-generate sample labels from package breakdown — only for new registrations with a package
    if (!id && admissionId && payload.package_id) {
      await generateSampleLabelsFromPackage(admissionId, payload);
    }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function generateSampleLabelsFromPackage(admissionId, adm) {
  try {
    const items = await sbGet('package_items',
      `select=*,products!product_id(id,nama_tes,kategori,sampel_type)&package_id=eq.${adm.package_id}`).catch(()=>[]);
    if (!items || !items.length) {
      toast('⚠️ Paket ini belum punya daftar tes (package_items kosong) — label tidak bisa digenerate otomatis. Lengkapi dulu di Konfigurasi Paket.','warn',6000);
      return;
    }

    // For each product, check if it has component-level breakdown (product_items with
    // specimen_type set, e.g. WBC/RBC/HGB under "Hematologi Lengkap"). If so, expand
    // into those components for grouping. If not, fall back to the whole-product
    // sampel_type as before — keeps older packages without item breakdown working.
    const productIds = [...new Set(items.map(it=>it.products?.id).filter(Boolean))];
    let itemsByProduct = {};
    if (productIds.length) {
      try {
        const allProdItems = await sbGet('product_items',
          `select=*&product_id=in.(${productIds.join(',')})&is_active=eq.true&order=display_order.asc`).catch(()=>[]);
        (allProdItems||[]).forEach(pi => {
          (itemsByProduct[pi.product_id] = itemsByProduct[pi.product_id]||[]).push(pi);
        });
      } catch(e) { console.error('[generateSampleLabelsFromPackage] product_items lookup failed:', e); }
    }

    // Group by specimen type — same specimen shares one label, different specimens get separate labels
    const groups = {};
    let totalComponents = 0;
    for (const it of items) {
      const prod = it.products || {};
      const components = itemsByProduct[prod.id];
      if (components && components.length) {
        // Granular: one entry per component, grouped by its own specimen_type
        for (const comp of components) {
          const specimenType = comp.specimen_type || prod.sampel_type || 'Lainnya';
          if (!groups[specimenType]) groups[specimenType] = [];
          groups[specimenType].push({ product_id: prod.id, product_name: `${prod.nama_tes} — ${comp.name_id}`, kategori: prod.kategori });
          totalComponents++;
        }
      } else {
        // Fallback: whole-product grouping (no item breakdown configured for this test yet)
        const specimenType = prod.sampel_type || 'Lainnya';
        if (!groups[specimenType]) groups[specimenType] = [];
        groups[specimenType].push({ product_id: prod.id, product_name: prod.nama_tes||it.product_name, kategori: prod.kategori });
        totalComponents++;
      }
    }

    const sampelCodes = {
      'BLOOD, WHOLE':'DRH', 'BLOOD, SERUM':'SRM', 'BLOOD, PLASMA':'PLS', 'URINE':'URN',
      'STOOL/FECES':'FCS', 'SWAB, NASOPHARYNGEAL':'SWN', 'SWAB, THROAT':'SWT', 'SPUTUM':'SPT',
      'SALIVA':'SAL', 'CSF':'CSF', 'TISSUE':'TIS',
      'Darah Vena':'DRH', 'Darah':'DRH', 'Urin':'URN', 'Swab':'SWB', 'Feses':'FCS', 'Sputum':'SPT',
    };
    const createdLabels = [];
    for (const [specimenType, tests] of Object.entries(groups)) {
      const code = sampelCodes[specimenType] || specimenType.substring(0,3).toUpperCase();
      const barcode = `${adm.visit_number}-${code}`;
      const labelPayload = {
        label_barcode: barcode,
        admission_id: admissionId,
        visit_number: adm.visit_number,
        patient_name: adm.patient_name,
        patient_dob: adm.patient_dob||null,
        patient_gender: adm.patient_gender||null,
        sampel_type: specimenType,
        status: 'Created',
        created_by: getUserName?getUserName():'User',
      };
      const created = await sbPost('sample_labels', labelPayload);
      const labelId = created?.[0]?.id || created?.id;
      for (const t of tests) {
        await sbPost('sample_label_items', {
          label_id: labelId, product_id: t.product_id, product_name: t.product_name, kategori: t.kategori,
        });
      }
      createdLabels.push({ ...labelPayload, id: labelId, tests });
    }

    toast(`✅ ${createdLabels.length} label sampel digenerate dari paket (${totalComponents} item)`,'ok',4000);
    printSampleLabels(createdLabels);
  } catch(e) {
    console.error('[generateSampleLabelsFromPackage] Failed:', e);
    toast('❌ Gagal generate label sampel: '+e.message,'err',6000);
  }
}

function printSampleLabels(labels) {
  const w = window.open('','_blank');
  w.document.write(`
    <html><head><title>Label Sampel</title>
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:10px}
      .label{width:7cm;min-height:4.5cm;border:1.5px dashed #999;border-radius:6px;padding:10px 12px;
        margin-bottom:10px;page-break-inside:avoid;display:inline-block;vertical-align:top}
      .barcode{font-family:'Courier New',monospace;font-size:15px;font-weight:700;letter-spacing:1px;
        background:#000;color:#fff;padding:4px 8px;text-align:center;margin-bottom:6px;border-radius:3px}
      .patient{font-size:12px;font-weight:700;margin-bottom:2px}
      .meta{font-size:10px;color:#555;margin-bottom:6px}
      .sampel-type{display:inline-block;background:#0891B2;color:#fff;font-size:10px;font-weight:700;
        padding:2px 8px;border-radius:8px;margin-bottom:6px}
      .tests{font-size:9.5px;color:#333;border-top:1px dashed #ccc;padding-top:5px}
      .tests div{padding:1px 0}
      @media print { .label{border:1px solid #333} }
    </style></head><body>
    ${labels.map(l => `
      <div class="label">
        <div class="barcode">${l.label_barcode}</div>
        <div class="patient">${l.patient_name}</div>
        <div class="meta">${l.visit_number} · ${l.patient_gender||''} ${l.patient_dob?'· '+l.patient_dob:''}</div>
        <div class="sampel-type">${l.sampel_type}</div>
        <div class="tests">
          ${l.tests.map(t=>`<div>• ${t.product_name}</div>`).join('')}
        </div>
      </div>
    `).join('')}
    <script>window.print()</script>
    </body></html>`);
  w.document.close();
}

async function renderAdmissionReport() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">📊 Laporan Admission</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      ${[
        {l:'Total Kunjungan', v:admAll.length},
        {l:'Selesai', v:admAll.filter(a=>a.status==='Done').length},
        {l:'Walk-in', v:admAll.filter(a=>a.visit_type==='Walk-in').length},
        {l:'Project MCU', v:admAll.filter(a=>a.visit_type==='Project MCU').length},
        {l:'Revenue', v:formatCurrency(admAll.filter(a=>a.payment_status==='Paid').reduce((s,a)=>s+(a.net_amount||0),0))},
        {l:'Unpaid', v:formatCurrency(admAll.filter(a=>a.payment_status==='Unpaid').reduce((s,a)=>s+(a.net_amount||0),0))},
      ].map(k=>`<div style="background:var(--lgray);border-radius:8px;padding:12px">
        <div style="font-size:16px;font-weight:800;color:var(--navy)">${k.v}</div>
        <div style="font-size:11px;color:var(--gray)">${k.l}</div>
      </div>`).join('')}
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`);
}

// ══════════════════════════════════════════════════════════════
// REPRINT LABEL — untuk label rusak/hilang sebelum check-in
// ══════════════════════════════════════════════════════════════
async function reprintSampleLabels(admissionId) {
  try {
    const labels = await sbGet('sample_labels', `select=*&admission_id=eq.${admissionId}`).catch(()=>[]);
    if (!labels || !labels.length) {
      toast('⚠️ Belum ada label untuk kunjungan ini. Label hanya digenerate otomatis saat registrasi awal dengan paket.','warn',5000);
      return;
    }
    const withTests = await Promise.all(labels.map(async l => {
      const items = await sbGet('sample_label_items', `select=*&label_id=eq.${l.id}`).catch(()=>[]);
      return { ...l, tests: (items||[]).map(it=>({product_name:it.product_name})) };
    }));
    printSampleLabels(withTests);
  } catch(e) { toast('❌ '+e.message,'err'); }
}
