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

// ── Ikon SVG line profesional (Feather-style) ─────────────────────
const SVG_ICONS = {
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/>',
  stethoscope:'<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 16a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  tube:'<path d="M9 3h6M10 3v13a2 2 0 0 0 4 0V3"/><path d="M10 9h4"/>',
  eye:'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6"/>',
  diagnosis:'<rect x="4" y="4" width="16" height="18" rx="2"/><path d="M9 2h6v4H9z"/><path d="M8 13h2l1 2 2-4 1 2h2"/>',
  print:'<path d="M6 9V2h12v7"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 17h12v5H6z"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  chevron:'<path d="M9 18l6-6-6-6"/>',
  scan:'<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M3 12h18"/>',
  heart:'<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  box:'<path d="M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
};
function svgIcon(name, size, color){
  const p=SVG_ICONS[name]||''; size=size||16;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color||'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">${p}</svg>`;
}

// ── Style shell profesional bersama (Layanan Klinik) ──────────────
function injectProShell(){
  if(document.getElementById('pro-shell-style')) return;
  const s=document.createElement('style'); s.id='pro-shell-style';
  s.textContent=`
    .pro-shell{ font-size:12.5px;color:#1A2B3C; }
    .pro-shell .pro-header{ display:flex;justify-content:space-between;align-items:center;
      background:linear-gradient(90deg,#0A2342,#0d2d54);color:#fff;border-radius:8px;padding:9px 16px;margin-bottom:12px;flex-wrap:wrap;gap:8px; }
    .pro-shell .pro-header h1{ font-size:16px;margin:0;color:#fff;font-weight:800;display:flex;align-items:center;gap:8px; }
    .pro-shell .pro-sub{ font-size:11px;color:#9db4d0; }
    .pro-shell .pro-kpi{ display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:12px; }
    .pro-shell .pro-kpi > div{ padding:8px 10px !important;border-radius:8px !important; }
    .pro-shell .pro-toolbar{ display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px; }
    .pro-shell .pro-chip{ font-size:11.5px;padding:5px 11px;border-radius:7px;border:1px solid #d3dae1;background:#fff;cursor:pointer;font-weight:600;color:#1A2B3C; }
    .pro-shell .pro-chip.active{ background:var(--teal);color:#fff;border-color:var(--teal); }
    .pro-shell .pro-grid{ width:100%;border-collapse:collapse;background:#fff;border:1px solid #d3dae1;border-radius:8px;overflow:hidden; }
    .pro-shell .pro-grid th{ background:#0A2342;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;padding:6px 9px;text-align:left;white-space:nowrap; }
    .pro-shell .pro-grid td{ padding:5px 9px;border-bottom:1px solid #eef1f4;font-size:12px;vertical-align:middle; }
    .pro-shell .pro-grid tbody tr:nth-child(even){ background:#f8fafc; }
    .pro-shell .pro-grid tbody tr:hover{ background:#eaf5f3; }
    .pro-shell .pro-grid tbody tr.sel{ background:#e0f2f1 !important; }
    /* Examination tab-rail (Virtu-style) */
    .exam-wrap{ display:grid;grid-template-columns:210px 1fr;gap:0;border:1px solid #d3dae1;border-radius:10px;overflow:hidden;background:#fff;margin-top:12px; }
    .exam-rail{ background:#f1f5f9;border-right:1px solid #d3dae1;padding:8px; }
    .exam-tab{ display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:none;background:none;border-radius:8px;
      cursor:pointer;font-size:12.5px;font-weight:600;color:#334155;text-align:left;margin-bottom:2px; }
    .exam-tab:hover{ background:#e2e8f0; }
    .exam-tab.active{ background:#0A2342;color:#fff; }
    .exam-tab svg{ flex-shrink:0; }
    .exam-body{ padding:14px 16px;min-height:320px; }
    .exam-topbar{ display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;
      background:#f8fafc;border-bottom:1px solid #d3dae1;padding:10px 14px; }
    .exam-sec{ font-size:11px;font-weight:800;color:#0A2342;text-transform:uppercase;letter-spacing:.05em;
      background:#EAF3FB;border-left:3px solid var(--teal);padding:6px 10px;border-radius:4px;margin:2px 0 10px; }`;
  document.head.appendChild(s);
}

async function renderAdmission() {
  injectProShell();
  document.getElementById('main-content').innerHTML = `
    <div class="pro-shell">
    <div class="pro-header">
      <div><h1>🏨 Admission / Registrasi</h1>
        <span class="pro-sub">Walk-in · Booking · Rujukan · Project MCU</span></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderAdmissionReport()">📊 Laporan</button>
        <button class="btn btn-teal btn-sm" onclick="openAdmissionForm()">+ Registrasi Pasien</button>
      </div>
    </div>

    <div id="adm-kpi" class="pro-kpi"><div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div></div>

    <div class="pro-toolbar" id="adm-status-tabs">
      <button class="pro-chip active" onclick="setAdmFilter('','',this)">Semua</button>
      ${Object.entries(ADM_STATUS).map(([s,v])=>`<button class="pro-chip" onclick="setAdmFilter('status','${s}',this)">${v.icon} ${s}</button>`).join('')}
    </div>

    <div class="pro-toolbar">
      <input class="table-search" id="adm-q" placeholder="🔍 Cari nama pasien, no. kunjungan..."
        oninput="admFilter.search=this.value;applyAdmFilter()" style="flex:1;min-width:220px">
      <select class="table-filter" id="adm-type" onchange="admFilter.type=this.value;applyAdmFilter()">
        <option value="">Semua Tipe</option><option>Walk-in</option><option>Booking</option><option>Rujukan</option><option>Project MCU</option>
      </select>
      <input type="date" class="table-filter" id="adm-date" onchange="applyAdmFilter()" value="${new Date().toISOString().split('T')[0]}">
    </div>

    <div id="adm-list"><div class="loading-row"><div class="spinner"></div></div></div>
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
  document.querySelectorAll('#adm-status-tabs .pro-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  admFilter.status = key==='status' ? val : '';
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

  el.innerHTML = `<div style="overflow-x:auto"><table class="pro-grid"><thead><tr>
    <th>MR / Kunjungan</th><th>Pasien</th><th>Layanan</th><th>Tipe</th><th>Status</th><th style="text-align:right">Tagihan</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(a=>{
    const st = ADM_STATUS[a.status]||ADM_STATUS['Registered'];
    return `<tr>
      <td style="font-family:monospace;font-size:11px">${a.mr_number||'—'}<div style="color:var(--gray)">${a.visit_number||''}</div></td>
      <td><div style="font-weight:700;color:var(--navy)">${a.patient_name||'—'}</div>
        <div style="font-size:10.5px;color:var(--gray)">${a.patient_gender||''} ${a.patient_age?'· '+a.patient_age+' th':''} ${a.patient_phone?'· '+a.patient_phone:''}</div></td>
      <td style="font-size:12px">${a.package_name||'Layanan Individual'}</td>
      <td style="font-size:11px;color:var(--gray)">${a.visit_type||'Walk-in'}</td>
      <td><span style="background:${st.color}20;color:${st.color};padding:2px 9px;border-radius:9px;font-size:11px;font-weight:700;white-space:nowrap">${st.icon} ${a.status}</span></td>
      <td style="text-align:right"><div style="font-weight:700;color:var(--navy)">${formatCurrency(a.net_amount||0)}</div>
        <div style="font-size:10px;color:${a.payment_status==='Paid'?'#22C55E':'#F59E0B'}">${a.payment_status||'Unpaid'}</div></td>
      <td><div class="act-row" style="flex-wrap:nowrap">
        ${['Registered','Anamnesa'].includes(a.status)?`<button class="btn btn-teal btn-xs" title="Buka Anamnesa" onclick="navigate('anamnesa')">🩺</button>`:''}
        ${a.package_id?`<button class="act-btn" title="Cetak Ulang Barcode" onclick="reprintSampleLabels(${a.id})">🏷️</button>`:''}
        <button class="act-btn edit" onclick="openAdmissionForm(${a.id})">✏️</button>
        ${a.payment_status!=='Paid'?`<button class="act-btn" style="color:#22C55E;font-size:11px" onclick="markAdmPaid(${a.id})">Bayar</button>`:''}
      </div></td>
    </tr>`;
  }).join('')}
  </tbody></table></div>`;
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
let admMasterPackages = [];

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
              ${row.pkg_name?`<div style="font-size:9px;color:var(--teal);font-weight:700;margin-bottom:2px">🗂️ ${row.pkg_name}</div>`:''}
              <select onchange="selectServiceLineProduct(${i},this)" style="font-size:11px;padding:3px;width:100%">
                <option value="">-- Pilih Tes/Layanan --</option>
                ${admMasterProducts.map(pr=>`<option value="${pr.id}" data-price="${pr.harga_normal||0}" data-name="${pr.nama_tes}"
                  ${row.product_id==pr.id?'selected':''}>[${pr.kode_internal||'—'}] ${pr.nama_tes}${pr.is_panel?' 🧬 Panel':''}</option>`).join('')}
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
// ── Mesin tagihan berjenjang: line → skema (family/corporate) → voucher ──
function computeAdmBill() {
  const gross = admFormState.serviceLines.reduce((s,r)=>s+(parseFloat(r.unit_price||0)),0);
  const afterLine = admFormState.serviceLines.reduce((s,r)=>s+calcServiceLineSubtotal(r),0);
  const lineDisc = Math.max(0, gross - afterLine);

  // Diskon skema (hanya salah satu: family ATAU corporate)
  let schemeDisc = 0;
  if (admFormState.scheme==='family' || admFormState.scheme==='corporate') {
    const t = admFormState.schemeDiscType, v = parseFloat(admFormState.schemeDiscVal||0);
    schemeDisc = t==='fixed' ? v : afterLine * v/100;
  }
  schemeDisc = Math.min(schemeDisc, afterLine);
  const afterScheme = afterLine - schemeDisc;

  // Voucher (boleh ditumpuk di atas skema)
  let voucherDisc = 0;
  const vc = admFormState.voucher;
  if (vc) {
    if (vc.minPurchase && afterLine < vc.minPurchase) {
      voucherDisc = 0; // belum memenuhi min. pembelian
    } else if (vc.discType) {
      voucherDisc = vc.discType==='fixed' ? parseFloat(vc.discVal||0) : afterScheme*parseFloat(vc.discVal||0)/100;
    } else {
      voucherDisc = parseFloat(vc.amount||0); // voucher tersimpan (edit mode)
    }
  }
  voucherDisc = Math.min(voucherDisc, afterScheme);
  if (vc) vc.amount = Math.round(voucherDisc);

  const net = Math.max(0, afterScheme - voucherDisc);
  const totalDisc = lineDisc + schemeDisc + voucherDisc;
  return { gross, afterLine, lineDisc, schemeDisc, afterScheme, voucherDisc, net, totalDisc };
}

function recalcServiceTotals() {
  const b = computeAdmBill();
  const setVal = (id,v)=>{ const el=document.getElementById(id); if(el) el.value=v; };
  setVal('af-total-price', Math.round(b.gross));
  setVal('af-discount',   Math.round(b.totalDisc));
  setVal('af-total-net',  Math.round(b.net));
  setVal('af-pay-total',  Math.round(b.net));
  setVal('af-cash-total', Math.round(b.net));
  renderBillSummary(b);
}

function billRow(label, val, opts={}) {
  const c = opts.color || 'var(--navy)';
  const neg = opts.neg ? '− ' : '';
  return `<div style="display:flex;justify-content:space-between;padding:${opts.big?'8px 0':'4px 0'};
    ${opts.border?'border-top:1px solid var(--border);margin-top:4px;padding-top:8px':''}">
    <span style="font-size:${opts.big?'13px':'12px'};color:${opts.big?'var(--navy)':'var(--gray)'};font-weight:${opts.big?'700':'400'}">${label}</span>
    <span style="font-size:${opts.big?'15px':'12.5px'};font-weight:${opts.big?'800':'600'};color:${c}">${neg}${formatCurrency(Math.round(val))}</span>
  </div>`;
}

function renderBillSummary(b) {
  b = b || computeAdmBill();
  const schemeLabel = admFormState.scheme==='family' ? `Diskon Family (${admFormState.schemeName||'-'})`
    : admFormState.scheme==='corporate' ? `Diskon Corporate (${admFormState.schemeName||'-'})` : null;
  const html = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      ${billRow('Subtotal Layanan', b.gross)}
      ${b.lineDisc>0 ? billRow('Diskon per-baris', b.lineDisc, {neg:true, color:'#EF4444'}) : ''}
      ${schemeLabel && b.schemeDisc>0 ? billRow(schemeLabel, b.schemeDisc, {neg:true, color:'#EF4444'}) : ''}
      ${admFormState.voucher && b.voucherDisc>0 ? billRow(`Voucher ${admFormState.voucher.code}`, b.voucherDisc, {neg:true, color:'#EF4444'}) : ''}
      ${admFormState.voucher && b.voucherDisc===0 ? `<div style="font-size:11px;color:#F59E0B;padding:2px 0">⚠️ Voucher belum memenuhi min. pembelian</div>` : ''}
      ${billRow('GRAND TOTAL', b.net, {big:true, border:true, color:'var(--teal)'})}
      ${b.totalDisc>0 ? `<div style="font-size:11px;color:#16A34A;text-align:right;margin-top:4px">Total hemat ${formatCurrency(Math.round(b.totalDisc))}</div>` : ''}
    </div>`;
  ['af-bill-summary','af-cashier-summary'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=html; });
}

// ── Skema harga (Umum / Family / Corporate) ──────────────────────
function setAdmScheme(scheme) {
  admFormState.scheme = scheme;
  ['umum','family','corporate'].forEach(k=>{
    const btn=document.getElementById(`af-scheme-${k}`);
    if(btn) btn.className = `btn ${k===scheme?'btn-teal':'btn-ghost'} btn-sm`;
    const panel=document.getElementById(`af-scheme-${k}`);
  });
  const famBox=document.getElementById('af-scheme-family');
  const corpBox=document.getElementById('af-scheme-corporate');
  if(famBox) famBox.style.display = scheme==='family' ? '' : 'none';
  if(corpBox) corpBox.style.display = scheme==='corporate' ? '' : 'none';
  // reset skema aktif ke pilihan tab
  if(scheme==='umum'){ admFormState.schemeRefId=null; admFormState.schemeName=''; admFormState.schemeDiscVal=0; }
  else if(scheme==='family'){ const s=document.getElementById('af-family'); if(s) onFamilyChange(s); }
  else if(scheme==='corporate'){ const s=document.getElementById('af-corp'); if(s) onCorporateChange(s); }
  recalcServiceTotals();
}

async function onFamilyChange(sel) {
  const o=sel.options[sel.selectedIndex];
  admFormState.schemeRefId = parseInt(sel.value)||null;
  admFormState.schemeName = o?.dataset.name||'';
  admFormState.schemeDiscType = o?.dataset.discType||'percent';
  admFormState.schemeDiscVal = parseFloat(o?.dataset.discVal||0);
  recalcServiceTotals();

  // Muat anggota keluarga untuk auto-isi data pasien
  const box=document.getElementById('af-family-member-box');
  const msel=document.getElementById('af-family-member');
  if(!box||!msel) return;
  if(!admFormState.schemeRefId){ box.style.display='none'; return; }
  let members=[];
  try { members=await sbGet('family_members',`select=*&family_id=eq.${admFormState.schemeRefId}&order=is_primary.desc,id.asc`)||[]; } catch(e){}
  if(!members.length){ box.style.display='none'; return; }
  msel.innerHTML='<option value="">-- Pilih anggota untuk auto-isi --</option>'+
    members.map(m=>`<option value="${m.id}"
      data-name="${(m.member_name||'').replace(/"/g,'&quot;')}" data-gender="${m.gender||''}"
      data-dob="${m.birth_date||''}" data-phone="${m.phone||''}" data-nik="${m.id_number||''}">
      ${m.member_name}${m.relationship?' · '+m.relationship:''}</option>`).join('');
  box.style.display='';
}

function fillPatientFromMember(sel) {
  const o=sel.options[sel.selectedIndex];
  if(!o||!sel.value) return;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el&&v) el.value=v; };
  set('af-name',o.dataset.name);
  set('af-phone',o.dataset.phone);
  if(o.dataset.gender){ const g=document.getElementById('af-gender'); if(g) g.value=o.dataset.gender; }
  if(o.dataset.dob){ const d=document.getElementById('af-dob'); if(d){ d.value=o.dataset.dob; calcAge(); } }
  if(o.dataset.nik && !admFormState.patientIds.some(r=>r.id_number===o.dataset.nik)){
    admFormState.patientIds.forEach(r=>r.is_primary=false);
    admFormState.patientIds.unshift({ id_type:'ID Card Number', id_number:o.dataset.nik, issuer_country:'Indonesia', is_primary:true });
    renderPatientIdTable();
  }
  toast('✅ Data pasien terisi dari anggota keluarga','ok');
}
function onCorporateChange(sel) {
  const o=sel.options[sel.selectedIndex];
  admFormState.schemeRefId = parseInt(sel.value)||null;
  admFormState.schemeName = o?.dataset.name||'';
  admFormState.schemeDiscType = (o?.dataset.discType && o.dataset.discType!=='none') ? o.dataset.discType : 'percent';
  admFormState.schemeDiscVal = parseFloat(o?.dataset.discVal||0);
  recalcServiceTotals();
}

// ── Voucher: validasi & terapkan (stackable) ─────────────────────
async function applyVoucher() {
  const code = (document.getElementById('af-voucher-code')?.value||'').trim().toUpperCase();
  const msg = document.getElementById('af-voucher-msg');
  if(!code){ if(msg) msg.innerHTML='<span style="color:#EF4444">Masukkan kode voucher</span>'; return; }
  if(msg) msg.innerHTML='<span style="color:var(--gray)">⏳ Memeriksa...</span>';
  try {
    const rows = await sbGet('vouchers', `select=*&code=eq.${encodeURIComponent(code)}&limit=1`);
    const v = rows?.[0];
    if(!v){ if(msg) msg.innerHTML='<span style="color:#EF4444">❌ Kode voucher tidak ditemukan</span>'; return; }
    if(v.status && !['Active','Aktif'].includes(v.status)){ if(msg) msg.innerHTML=`<span style="color:#EF4444">❌ Voucher sudah ${v.status}</span>`; return; }
    if(v.expires_at && new Date(v.expires_at) < new Date()){ if(msg) msg.innerHTML='<span style="color:#EF4444">❌ Voucher kedaluwarsa</span>'; return; }

    // Ambil detail campaign untuk nilai diskon
    let camp={};
    if(v.campaign_id){ const c=await sbGet('voucher_campaigns',`select=*&id=eq.${v.campaign_id}&limit=1`).catch(()=>[]); camp=c?.[0]||{}; }
    if(camp.valid_until && new Date(camp.valid_until) < new Date()){ if(msg) msg.innerHTML='<span style="color:#EF4444">❌ Campaign voucher sudah berakhir</span>'; return; }

    admFormState.voucher = {
      id: v.id, code: v.code, campaign: camp.campaign_name||v.campaign_name||'',
      discType: camp.discount_type||'percent', discVal: parseFloat(camp.discount_value||0),
      minPurchase: parseFloat(camp.min_purchase||0), amount:0,
    };
    // refresh voucher UI (input jadi readonly + tombol lepas)
    refreshVoucherUI();
    recalcServiceTotals();
    const b=computeAdmBill();
    if(msg) msg.innerHTML = b.voucherDisc>0
      ? `<span style="color:#16A34A">✅ ${admFormState.voucher.campaign||'Voucher'} — hemat ${formatCurrency(b.voucherDisc)}</span>`
      : `<span style="color:#F59E0B">⚠️ Voucher valid tapi min. pembelian ${formatCurrency(admFormState.voucher.minPurchase)} belum tercapai</span>`;
  } catch(e){ if(msg) msg.innerHTML=`<span style="color:#EF4444">❌ ${e.message}</span>`; }
}

function removeVoucher() {
  admFormState.voucher = null;
  refreshVoucherUI();
  recalcServiceTotals();
  const msg=document.getElementById('af-voucher-msg'); if(msg) msg.innerHTML='';
}

function refreshVoucherUI() {
  const input=document.getElementById('af-voucher-code');
  const wrap=input?.parentElement;
  if(!wrap) return;
  const v=admFormState.voucher;
  wrap.innerHTML = `
    <input type="text" id="af-voucher-code" placeholder="Masukkan kode voucher..." style="flex:1;text-transform:uppercase"
      value="${v?.code||''}" ${v?'readonly style="background:var(--lgray);flex:1;text-transform:uppercase"':''}>
    ${v ? `<button type="button" class="btn btn-ghost btn-sm" onclick="removeVoucher()" style="color:#EF4444">✕ Lepas</button>`
        : `<button type="button" class="btn btn-teal btn-sm" onclick="applyVoucher()">Terapkan</button>`}`;
}

// ── Main tabbed Admission Form ───────────────────────────────
async function openAdmissionForm(id=null) {
  let a={};
  if (id) { const d=await sbGet('admissions',`select=*&id=eq.${id}`); a=d[0]||{}; }

  // Load packages, corporates, families, projects, master products in parallel
  let pkgs=[], corps=[], fams=[], projs=[];
  try {
    [pkgs, corps, fams, projs, admMasterProducts] = await Promise.all([
      sbGet('packages','select=id,nama_paket,harga_normal,harga_korporat,kode_paket&is_active=eq.true&order=nama_paket').catch(()=>[]),
      sbGet('corporates','select=id,corporate_name,discount_type,discount_value&status=eq.Aktif&order=corporate_name').catch(()=>[]),
      sbGet('families','select=id,family_code,family_name,discount_type,discount_value,status&status=eq.Aktif&order=family_name').catch(()=>[]),
      sbGet('projects','select=id,project_name,project_code&status=eq.Active&order=created_at.desc&limit=50').catch(()=>[]),
      sbGet('products','select=id,kode_internal,nama_tes,hpp,harga_normal,kategori,is_panel,sampel_type&is_active=eq.true&order=kategori,nama_tes').catch(()=>[]),
    ]);
  } catch(e) {}
  admMasterPackages = pkgs||[];

  // Load existing patient IDs and service lines if editing
  admFormState = {
    patientIds: [], serviceLines: [], admissionId: id, activeTab: 'patient',
    // Diskon berjenjang
    scheme: a.discount_scheme || 'umum',       // umum | family | corporate
    schemeRefId: a.scheme_ref_id || a.corporate_id || a.family_id || null,
    schemeName: a.scheme_name || '',
    schemeDiscType: 'percent', schemeDiscVal: 0,
    voucher: (a.voucher_id ? { id:a.voucher_id, code:a.voucher_code, amount:a.voucher_discount||0,
      discType:null, discVal:0, campaign:'', minPurchase:0 } : null),
    packageId: a.package_id || null, packageName: a.package_name || '',
    existingMR: a.mr_number || null,
  };
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

  const corpOpts = '<option value="">-- Pilih Korporat --</option>' +
    (corps||[]).map(c=>`<option value="${c.id}" data-disc-type="${c.discount_type||'none'}" data-disc-val="${c.discount_value||0}" data-name="${c.corporate_name}"
      ${a.corporate_id==c.id?'selected':''}>${c.corporate_name} (${c.discount_type==='fixed'?formatCurrency(c.discount_value||0):(c.discount_value||0)+'%'})</option>`).join('');
  const famOpts = '<option value="">-- Pilih Keluarga --</option>' +
    (fams||[]).map(fm=>`<option value="${fm.id}" data-disc-type="${fm.discount_type||'percent'}" data-disc-val="${fm.discount_value||0}" data-name="${fm.family_name}"
      ${a.family_id==fm.id?'selected':''}>${fm.family_code?'['+fm.family_code+'] ':''}${fm.family_name} (${fm.discount_type==='fixed'?formatCurrency(fm.discount_value||0):(fm.discount_value||0)+'%'})</option>`).join('');
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
            <div class="form-group" style="grid-column:1/-1"><label>Nama Lengkap * <span style="font-weight:400;color:var(--gray)">— pasien lama? cari dulu agar tidak isi ulang</span></label>
              <div style="display:flex;gap:6px">
                <input type="text" id="af-name" value="${a.patient_name||''}" placeholder="Nama sesuai KTP" style="flex:1">
                <button type="button" class="btn btn-ghost btn-sm" onclick="openPatientSearch()" title="Cari pasien terdaftar">🔍 Cari Pasien</button>
              </div></div>
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
      <!-- Skema Harga / Diskon -->
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Skema Harga</div>
      <div style="display:flex;gap:8px;margin-bottom:12px" id="af-scheme-tabs">
        ${[['umum','👤 Umum'],['family','👨‍👩‍👧 Family Member'],['corporate','🏢 Corporate']].map(([k,l])=>`
          <button type="button" onclick="setAdmScheme('${k}')" id="af-scheme-${k}"
            class="btn ${admFormState.scheme===k?'btn-teal':'btn-ghost'} btn-sm" style="flex:1">${l}</button>`).join('')}
      </div>

      <div id="af-scheme-family" style="display:${admFormState.scheme==='family'?'':'none'};margin-bottom:12px">
        <div class="form-row">
          <div class="form-group" style="grid-column:1/-1"><label>Pilih Keluarga (diskon otomatis)</label>
            <select id="af-family" onchange="onFamilyChange(this)">${famOpts}</select></div>
          <div class="form-group" id="af-family-member-box" style="grid-column:1/-1;display:none">
            <label>Isi data pasien dari anggota (opsional)</label>
            <select id="af-family-member" onchange="fillPatientFromMember(this)"></select></div>
        </div>
      </div>
      <div id="af-scheme-corporate" style="display:${admFormState.scheme==='corporate'?'':'none'};margin-bottom:12px">
        <div class="form-group"><label>Pilih Korporat (diskon otomatis)</label>
          <select id="af-corp" onchange="onCorporateChange(this)">${corpOpts}</select></div>
      </div>

      <!-- Voucher (boleh ditumpuk) -->
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Voucher <span style="font-weight:400;text-transform:none">(bisa ditumpuk dengan skema di atas)</span></div>
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <input type="text" id="af-voucher-code" placeholder="Masukkan kode voucher..." style="flex:1;text-transform:uppercase"
          value="${admFormState.voucher?.code||''}" ${admFormState.voucher?'readonly style="background:var(--lgray);flex:1;text-transform:uppercase"':''}>
        ${admFormState.voucher
          ? `<button type="button" class="btn btn-ghost btn-sm" onclick="removeVoucher()" style="color:#EF4444">✕ Lepas</button>`
          : `<button type="button" class="btn btn-teal btn-sm" onclick="applyVoucher()">Terapkan</button>`}
      </div>
      <div id="af-voucher-msg" style="font-size:11.5px;margin-bottom:14px">${admFormState.voucher?`<span style="color:#16A34A">✅ Voucher ${admFormState.voucher.code} aktif</span>`:''}</div>

      <div class="form-row">
        <div class="form-group"><label>Class</label>
          <select id="af-class">${['Non Kelas','VIP','Kelas 1','Kelas 2','Kelas 3'].map(c=>`<option ${a.patient_class===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Payment Type</label>
          <select id="af-paytype">${['Personal','Corporate','BPJS','Asuransi'].map(p=>`<option ${a.payment_type===p?'selected':''}>${p}</option>`).join('')}</select></div>
        <div class="form-group"><label>Status Pembayaran</label>
          <select id="af-paystatus">${['Unpaid','DP','Paid','Billed'].map(s=>`<option${(a.payment_status||'Unpaid')===s?' selected':''}>${s}</option>`).join('')}</select></div>
      </div>

      <div id="af-bill-summary" style="margin-top:14px"></div>
    </div>

    <!-- ═══ TAB: SERVICES ═══ -->
    <div id="af-tab-content-services" style="display:none">
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <button type="button" class="btn btn-ghost btn-sm" onclick="addServiceLine()">+ Satuan / Panel</button>
        <button type="button" class="btn btn-teal btn-sm" onclick="openPackagePicker()">+ Paket</button>
        <span style="font-size:11px;color:var(--gray)">🧬 Panel &amp; 🗂️ Paket otomatis terurai menjadi tes komponen dengan harga per-tes.</span>
      </div>
      <div id="af-services-table"></div>
    </div>

    <!-- ═══ TAB: CASHIER ═══ -->
    <div id="af-tab-content-cashier" style="display:none">
      <div id="af-cashier-summary"></div>
      <!-- hidden fields dipakai saat simpan -->
      <input type="hidden" id="af-total-price"><input type="hidden" id="af-discount"><input type="hidden" id="af-total-net">
      <input type="hidden" id="af-pay-total"><input type="hidden" id="af-cash-total">
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveAdmission(${id||'null'})">${id?'💾 Update':'📋 Save & Print'}</button>
    </div>`,'wide');

  renderPatientIdTable();
  renderServiceLines();
  // Inisialisasi skema harga + rincian tagihan
  if (admFormState.scheme==='family')   { const s=document.getElementById('af-family'); if(s&&s.value) onFamilyChange(s); }
  if (admFormState.scheme==='corporate'){ const s=document.getElementById('af-corp');   if(s&&s.value) onCorporateChange(s); }
  recalcServiceTotals();
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

// ── Paket: picker + ekspansi menjadi tes komponen ────────────────
function openPackagePicker() {
  openModal(`
    <div class="modal-header"><div class="modal-title">🗂️ Pilih Paket</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <input class="table-search" placeholder="🔍 Cari paket..." oninput="filterPkgPicker(this.value)" style="margin-bottom:10px;width:100%">
    <div id="pkg-picker-list" style="max-height:340px;overflow-y:auto">
      ${(admMasterPackages||[]).map(p=>`
        <div class="pkg-pick-item" data-s="${(p.nama_paket||'').toLowerCase()} ${(p.kode_paket||'').toLowerCase()}"
          onclick="addPackageLines(${p.id});closeModalForce()"
          style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;gap:10px">
          <div><div style="font-weight:600">${p.nama_paket}</div><div style="font-size:11px;color:var(--gray)">${p.kode_paket||''}</div></div>
          <div style="font-weight:700;color:var(--teal);white-space:nowrap">${formatCurrency(p.harga_normal||0)}</div>
        </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--gray)">Belum ada paket. Buat di Konfigurasi → Package & Panel.</div>'}
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`);
}
function filterPkgPicker(q) {
  q=(q||'').toLowerCase();
  document.querySelectorAll('#pkg-picker-list .pkg-pick-item').forEach(el=>el.style.display=el.dataset.s.includes(q)?'':'none');
}

async function addPackageLines(pkgId) {
  const pkg=(admMasterPackages||[]).find(p=>p.id==pkgId);
  if(!pkg){ toast('Paket tidak ditemukan','err'); return; }
  let items=[];
  try {
    items=await sbGet('package_items',
      `select=*,products(id,nama_tes,harga_normal,is_panel)&package_id=eq.${pkgId}`)||[];
  } catch(e){}

  if(!items.length){
    // Paket tanpa rincian tes → tambahkan sebagai 1 baris di harga paket
    admFormState.serviceLines.push({ product_id:null, name:`[PAKET] ${pkg.nama_paket}`, priority:'-',
      unit_price:parseFloat(pkg.harga_normal||0), discount_pct:0, discount_idr:0, pkg_name:pkg.nama_paket });
    toast('⚠️ Paket belum punya rincian tes — ditambah sebagai 1 baris. Lengkapi di Konfigurasi Paket.','warn',5000);
  } else {
    // Ekspansi: tiap tes jadi baris di harga individual, lalu diskon bundle proporsional
    const sumInd=items.reduce((s,it)=>s+(parseFloat(it.products?.harga_normal||0)*(it.qty||1)),0);
    const pkgPrice=parseFloat(pkg.harga_normal||0);
    const bundlePct=(pkgPrice>0 && sumInd>pkgPrice) ? Math.round((1-pkgPrice/sumInd)*10000)/100 : 0;
    items.forEach(it=>{
      admFormState.serviceLines.push({
        product_id: it.products?.id||it.product_id||null,
        name: it.products?.nama_tes||it.product_name||'',
        priority:'-', unit_price:parseFloat(it.products?.harga_normal||0),
        discount_pct:bundlePct, discount_idr:0,
        pkg_name:pkg.nama_paket, is_panel:it.products?.is_panel||false,
      });
    });
    toast(`✅ Paket ${pkg.nama_paket}: ${items.length} tes ditambahkan${bundlePct?` (diskon bundle ${bundlePct}%)`:''}`,'ok',4000);
  }
  // Simpan referensi paket pertama (untuk pelaporan)
  if(!admFormState.packageId){ admFormState.packageId=pkg.id; admFormState.packageName=pkg.nama_paket; }
  renderServiceLines();
}

// ═══════════════════════════════════════════════════════════════
// CARI PASIEN TERDAFTAR — popup (by Nama / Tgl Lahir / MR / No. ID)
// Pilih → data pasien terisi otomatis + MR lama dipakai ulang.
// Pengisian dari nol hanya untuk pasien baru.
// ═══════════════════════════════════════════════════════════════
let _patSearchField = 'name', _patSearchResults = [];

// Popup cari pasien — overlay MANDIRI (bukan openModal), agar form registrasi
// di #modal-box tetap ada saat pasien dipilih dan field bisa terisi.
function openPatientSearch() {
  _patSearchField = 'name'; _patSearchResults = [];
  closePatientSearch();
  const ov = document.createElement('div');
  ov.id = 'pat-search-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10001;display:flex;align-items:flex-start;justify-content:center;padding:56px 16px';
  ov.onclick = (e)=>{ if(e.target===ov) closePatientSearch(); };
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;box-shadow:0 12px 44px rgba(0,0,0,.28);width:100%;max-width:640px;max-height:82vh;display:flex;flex-direction:column;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:16px;font-weight:800;color:var(--navy)">🔍 Cari Pasien Terdaftar</div>
        <button onclick="closePatientSearch()" style="border:none;background:none;font-size:18px;cursor:pointer;color:var(--gray)">✕</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px" id="pat-search-tabs">
        ${[['name','Nama'],['dob','Tgl Lahir'],['mr','No. MR'],['id','No. ID / KTP']].map(([k,l])=>`
          <button type="button" class="btn ${k==='name'?'btn-teal':'btn-ghost'} btn-sm" id="pat-tab-${k}" onclick="setPatSearchField('${k}')">${l}</button>`).join('')}
      </div>
      <div id="pat-search-input-wrap">
        <input class="table-search" id="pat-search-input" placeholder="Ketik nama pasien..." oninput="searchPatientDB(this.value)" style="width:100%"></div>
      <div id="pat-search-results" style="flex:1;overflow-y:auto;margin-top:10px;min-height:120px">
        <div style="padding:20px;text-align:center;color:var(--gray)">Ketik untuk mencari…</div></div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('pat-search-input')?.focus(), 50);
}
function closePatientSearch(){ document.getElementById('pat-search-overlay')?.remove(); }

function setPatSearchField(f) {
  _patSearchField = f;
  ['name','dob','mr','id'].forEach(k=>{ const b=document.getElementById(`pat-tab-${k}`); if(b) b.className=`btn ${k===f?'btn-teal':'btn-ghost'} btn-sm`; });
  const wrap=document.getElementById('pat-search-input-wrap');
  if(wrap){
    const ph={name:'Ketik nama pasien...',mr:'Ketik No. MR...',id:'Ketik No. ID / KTP...'}[f];
    wrap.innerHTML = f==='dob'
      ? `<input type="date" class="table-search" id="pat-search-input" onchange="searchPatientDB(this.value)" style="width:100%">`
      : `<input class="table-search" id="pat-search-input" placeholder="${ph}" oninput="searchPatientDB(this.value)" style="width:100%">`;
  }
  const res=document.getElementById('pat-search-results');
  if(res) res.innerHTML='<div style="padding:20px;text-align:center;color:var(--gray)">Ketik untuk mencari…</div>';
}

async function searchPatientDB(q) {
  q=(q||'').trim();
  const el=document.getElementById('pat-search-results'); if(!el) return;
  if(!q || (q.length<2 && _patSearchField!=='dob')){
    el.innerHTML='<div style="padding:20px;text-align:center;color:var(--gray)">Ketik minimal 2 karakter…</div>'; return;
  }
  const cols='id,mr_number,patient_name,patient_salutation,patient_gender,patient_dob,patient_age,patient_place_of_birth,patient_country_of_birth,patient_phone,patient_email,patient_blood_type,patient_marital_status,patient_religion,patient_ethnicity,patient_category,patient_postal_code,patient_subdistrict,patient_district,patient_city,patient_province,patient_address,patient_id_type,patient_id_number';
  let filter;
  if(_patSearchField==='name')    filter=`patient_name=ilike.${encodeURIComponent('%'+q+'%')}`;
  else if(_patSearchField==='mr') filter=`mr_number=ilike.${encodeURIComponent('%'+q+'%')}`;
  else if(_patSearchField==='id') filter=`patient_id_number=ilike.${encodeURIComponent('%'+q+'%')}`;
  else                            filter=`patient_dob=eq.${q}`;
  el.innerHTML='<div class="loading-row"><div class="spinner"></div></div>';
  try {
    const rows=await sbGet('admissions',`select=${cols}&${filter}&order=created_at.desc&limit=40`)||[];
    const seen={}, uniq=[];
    for(const r of rows){ const key=r.mr_number||r.patient_id_number||`${r.patient_name}|${r.patient_dob}`; if(seen[key]) continue; seen[key]=1; uniq.push(r); }
    _patSearchResults=uniq;
    if(!uniq.length){ el.innerHTML='<div style="padding:20px;text-align:center;color:var(--gray)">Tidak ditemukan — lanjutkan isi sebagai pasien baru.</div>'; return; }
    el.innerHTML=uniq.map((r,i)=>`
      <div onclick="pickPatient(${i})" style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <div style="font-weight:600">${r.patient_name||'—'}</div>
          <div style="font-family:monospace;font-size:11px;color:var(--teal);font-weight:700">${r.mr_number||''}</div></div>
        <div style="font-size:11px;color:var(--gray)">${r.patient_gender||''} ${r.patient_age?'· '+r.patient_age+' th':''} ${r.patient_dob?'· '+r.patient_dob:''} ${r.patient_id_number?'· ID '+r.patient_id_number:''} ${r.patient_phone?'· '+r.patient_phone:''}</div>
      </div>`).join('');
  } catch(e){ el.innerHTML=`<div class="status-box status-err">❌ ${e.message}</div>`; }
}

async function pickPatient(i) {
  const p=_patSearchResults[i]; if(!p) return;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  const sel=(id,v)=>{ const el=document.getElementById(id); if(el&&v) el.value=v; };
  set('af-name',p.patient_name); set('af-salutation',p.patient_salutation);
  sel('af-gender',p.patient_gender);
  set('af-dob',p.patient_dob); set('af-age',p.patient_age);
  set('af-pob',p.patient_place_of_birth); set('af-cob',p.patient_country_of_birth);
  set('af-phone',p.patient_phone); set('af-email',p.patient_email);
  sel('af-bloodtype',p.patient_blood_type); sel('af-marital',p.patient_marital_status); sel('af-religion',p.patient_religion);
  set('af-ethnicity',p.patient_ethnicity);
  set('af-postal',p.patient_postal_code); set('af-subdistrict',p.patient_subdistrict);
  set('af-district',p.patient_district); set('af-city',p.patient_city); set('af-province',p.patient_province);
  set('af-address',p.patient_address);
  if(p.patient_category){ const rb=document.querySelector(`input[name="af-category"][value="${p.patient_category}"]`); if(rb) rb.checked=true; }
  // ── MR dipakai ulang (kunci: MR unik per pasien) ──
  if(p.mr_number) sel('af-mr',p.mr_number);
  admFormState.existingMR = p.mr_number||null;
  // Identitas: muat multi-ID dari kunjungan tsb; fallback ke kolom tunggal
  admFormState.patientIds=[];
  try {
    const ids=await sbGet('patient_ids',`select=*&admission_id=eq.${p.id}`).catch(()=>[]);
    admFormState.patientIds=(ids||[]).map(r=>({id_type:r.id_type,id_number:r.id_number,issuer_country:r.issuer_country,is_primary:r.is_primary}));
  } catch(e){}
  if(!admFormState.patientIds.length && p.patient_id_number){
    admFormState.patientIds=[{id_type:p.patient_id_type||'ID Card Number',id_number:p.patient_id_number,issuer_country:'Indonesia',is_primary:true}];
  }
  renderPatientIdTable();
  closePatientSearch();
  toast(`✅ Data pasien lama dimuat${p.mr_number?' — MR '+p.mr_number+' dipakai ulang':''}`,'ok',3500);
}

async function saveAdmission(id) {
  const name = document.getElementById('af-name').value.trim();
  if (!name) { toast('Nama pasien wajib diisi','err'); return; }

  const pkgId = admFormState.packageId || null;
  const pkgName = admFormState.packageName || null;
  const user = getUserName?getUserName():'User';
  const categoryEl = document.querySelector('input[name="af-category"]:checked');
  const bill = computeAdmBill();

  const servicesJson = JSON.stringify(admFormState.serviceLines.map(r=>({
    product_id:r.product_id, name:r.name, priority:r.priority,
    unit_price:r.unit_price, discount_pct:r.discount_pct, discount_idr:r.discount_idr,
  })));

  const primaryId = admFormState.patientIds.find(r=>r.is_primary) || admFormState.patientIds[0];

  // MR unik per pasien: untuk registrasi baru, jika No. ID/KTP sudah pernah
  // terdaftar, pakai ulang MR-nya (tanpa harus lewat popup cari pasien).
  if (!id && !admFormState.existingMR && primaryId?.id_number) {
    try {
      const ex = await sbGet('admissions',
        `select=mr_number&patient_id_number=eq.${encodeURIComponent(primaryId.id_number)}&mr_number=not.is.null&order=created_at.asc&limit=1`);
      if (ex?.[0]?.mr_number) { const mrEl=document.getElementById('af-mr'); if(mrEl) mrEl.value=ex[0].mr_number; }
    } catch(e){}
  }

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
    package_id:        pkgId||null,
    package_name:      pkgName||null,
    corporate_id:      admFormState.scheme==='corporate' ? (admFormState.schemeRefId||null) : null,
    family_id:         admFormState.scheme==='family' ? (admFormState.schemeRefId||null) : null,
    discount_scheme:   admFormState.scheme||'umum',
    scheme_ref_id:     admFormState.schemeRefId||null,
    scheme_name:       admFormState.schemeName||null,
    scheme_discount:   Math.round(bill.schemeDisc)||0,
    voucher_id:        admFormState.voucher?.id||null,
    voucher_code:      admFormState.voucher?.code||null,
    voucher_discount:  Math.round(bill.voucherDisc)||0,
    gross_amount:      Math.round(bill.gross)||0,
    line_discount:     Math.round(bill.lineDisc)||0,
    services:          servicesJson,
    total_amount:      Math.round(bill.gross)||0,
    discount_amount:   Math.round(bill.totalDisc)||0,
    net_amount:        Math.round(bill.net)||0,
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

    // Tandai voucher terpakai (hanya registrasi baru dengan voucher)
    if (!id && admissionId && admFormState.voucher?.id && bill.voucherDisc>0) {
      try {
        await sbPatch('vouchers', admFormState.voucher.id, {
          status:'Used', used_at:new Date().toISOString(),
          notes:`Dipakai di ${payload.visit_number} — ${name}`,
        });
      } catch(e){ console.error('[saveAdmission] mark voucher used failed:', e); }
    }

    closeModalForce();
    await loadAdmissions();

    // Label sampel & barcode TIDAK dicetak di sini — semua kunjungan wajib
    // lewat modul Anamnesa; barcode digenerate & dicetak di sana, lalu
    // (jika ada tes lab) pasien dilempar ke Lab.
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function generateSampleLabelsFromProducts(admissionId, adm, productIds) {
  try {
    productIds = [...new Set((productIds||[]).filter(Boolean))];
    if (!productIds.length) return;

    const prods = await sbGet('products',
      `select=id,nama_tes,kategori,sampel_type&id=in.(${productIds.join(',')})`).catch(()=>[]);
    if (!prods || !prods.length) return;

    // Rincian komponen panel (product_items dengan specimen_type, mis. WBC/RBC/HGB)
    let itemsByProduct = {};
    try {
      const allProdItems = await sbGet('product_items',
        `select=*&product_id=in.(${productIds.join(',')})&is_active=eq.true&order=display_order.asc`).catch(()=>[]);
      (allProdItems||[]).forEach(pi => {
        (itemsByProduct[pi.product_id] = itemsByProduct[pi.product_id]||[]).push(pi);
      });
    } catch(e) { console.error('[generateSampleLabelsFromProducts] product_items lookup failed:', e); }

    // Kelompokkan per jenis spesimen — spesimen sama = 1 label
    const groups = {};
    let totalComponents = 0;
    for (const prod of prods) {
      const components = itemsByProduct[prod.id];
      if (components && components.length) {
        for (const comp of components) {
          const specimenType = comp.specimen_type || prod.sampel_type || 'Lainnya';
          if (!groups[specimenType]) groups[specimenType] = [];
          groups[specimenType].push({ product_id: prod.id, product_name: `${prod.nama_tes} — ${comp.name_id}`, kategori: prod.kategori });
          totalComponents++;
        }
      } else {
        const specimenType = prod.sampel_type || 'Lainnya';
        if (!groups[specimenType]) groups[specimenType] = [];
        groups[specimenType].push({ product_id: prod.id, product_name: prod.nama_tes, kategori: prod.kategori });
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
        mr_number: adm.mr_number||null,
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

    // Barcode dicetak di modul Anamnesa (bukan di sini) — kembalikan labelnya.
    if (createdLabels.length && totalComponents) {
      toast(`✅ ${createdLabels.length} label sampel digenerate (${totalComponents} item)`,'ok',3000);
    }
    return createdLabels;
  } catch(e) {
    console.error('[generateSampleLabelsFromProducts] Failed:', e);
    toast('❌ Gagal generate label sampel: '+e.message,'err',6000);
    return [];
  }
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
  // Cetak ulang barcode (Code 128). Barcode utama digenerate di modul Anamnesa;
  // fungsi ini memakai ulang alur yang sama bila tersedia.
  try {
    if (typeof printAnamnesaLabels === 'function') { await printAnamnesaLabels(admissionId); return; }
    const labels = await sbGet('sample_labels', `select=*&admission_id=eq.${admissionId}`).catch(()=>[]);
    if (!labels || !labels.length) { toast('⚠️ Belum ada barcode — selesaikan Anamnesa dulu.','warn',5000); return; }
    const withTests = await Promise.all(labels.map(async l => {
      const items = await sbGet('sample_label_items', `select=*&label_id=eq.${l.id}`).catch(()=>[]);
      return { ...l, tests: (items||[]).map(it=>({product_name:it.product_name})) };
    }));
    if (typeof printLabBarcodes === 'function') printLabBarcodes(withTests);
  } catch(e) { toast('❌ '+e.message,'err'); }
}
