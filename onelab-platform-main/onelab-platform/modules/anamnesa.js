// ═══════════════════════════════════════════════════════════════
// MODULE: Anamnesa (WAJIB) — gerbang setelah registrasi
// Semua registrasi masuk ke sini. Alur:
//   Registrasi → ANAMNESA (TTV + keluhan) → Generate & Print Barcode
//   → jika ada tes lab: dilempar ke Lab; jika tidak: Selesai.
// Barcode lab dicetak di sini (Code 128, label 5×3 cm).
// ═══════════════════════════════════════════════════════════════

let anamAll = [], anamSearch = '';

async function renderAnamnesa() {
  if(typeof injectProShell==='function') injectProShell();
  document.getElementById('main-content').innerHTML = `
    <div class="pro-shell">
    <div class="lis-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#0A2342,#0d2d54);color:var(--on-accent);border-radius:8px;padding:8px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" style="color:var(--on-accent);border-color:rgba(255,255,255,0.2)" onclick="openCategory('anamnesa')" title="Kembali ke daftar menu Anamnesa">← Menu Anamnesa</button>
        <div>
          <h1 style="margin:0;font-size:15px;color:var(--on-accent);font-weight:800">Anamnesa &amp; Skrining Awal</h1>
          <span class="lis-sub" style="font-size:11px;color:#9db4d0">Pemeriksaan awal wajib · TTV &amp; antropometri · cetak barcode · rujuk ke Lab</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="anam-date-badge" class="lis-date" style="font-size:11px;color:#cfe0f2"></span>
        <input type="date" class="table-filter" id="anam-date" onchange="loadAnamnesaQueue()"
          value="${new Date().toISOString().split('T')[0]}" style="max-width:170px;background:var(--white);color:var(--navy)">
      </div>
    </div>
    <div id="anam-kpi" class="pro-kpi"></div>
    <div class="pro-toolbar">
      <input class="table-search" id="anam-q" placeholder="Cari nama / no. kunjungan / MR..."
        oninput="anamSearch=this.value;renderAnamnesaList()" style="flex:1;min-width:220px">
    </div>
    <div id="anam-list"><div class="loading-row"><div class="spinner"></div></div></div>
    <div id="anam-exam"></div>
    </div>`;

  const badge = document.getElementById('anam-date-badge');
  if (badge) badge.textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  await loadAnamnesaQueue();
}

async function loadAnamnesaQueue() {
  try {
    const date = document.getElementById('anam-date')?.value || new Date().toISOString().split('T')[0];
    // Antrian anamnesa: registrasi hari ini yang belum selesai anamnesa/lab
    anamAll = await sbGet('admissions',
      `select=*&visit_date=eq.${date}&status=in.(Registered,Anamnesa,Lab)&order=created_at.asc`) || [];
    renderAnamKPI();
    renderAnamnesaList();
  } catch(e) {
    document.getElementById('anam-list').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderAnamKPI() {
  const el = document.getElementById('anam-kpi'); if (!el) return;
  const pending = anamAll.filter(a=>a.status==='Registered').length;
  const inLab   = anamAll.filter(a=>a.status==='Lab').length;
  const done    = anamAll.filter(a=>a.status==='Anamnesa').length;
  el.innerHTML = [
    {icon:'🕒', val:pending, label:'Menunggu Anamnesa', color:'#F59E0B'},
    {icon:'', val:done,    label:'Anamnesa Selesai',  color:'#8B5CF6'},
    {icon:'', val:inLab,   label:'Di Lab',            color:'#0EA5E9'},
    {icon:'', val:anamAll.length, label:'Total Antrian', color:'#0A2342'},
  ].map(k=>`
    <div style="background:var(--white);border-radius:10px;padding:10px 12px;border:1px solid var(--border);border-left:4px solid ${k.color}">
      <div style="font-size:16px">${k.icon}</div>
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

function anamServicesSummary(a) {
  try {
    const s = a.services ? JSON.parse(a.services) : [];
    if (a.package_name) return `${a.package_name}${s.length?' +'+s.length+' item':''}`;
    if (!s.length) return 'Layanan individual';
    return s.slice(0,2).map(x=>x.name).join(', ') + (s.length>2?` +${s.length-2}`:'');
  } catch(e){ return '—'; }
}

function renderAnamnesaList() {
  const el = document.getElementById('anam-list'); if (!el) return;
  const q = anamSearch.toLowerCase();
  const data = anamAll.filter(a=>!q ||
    `${a.patient_name||''} ${a.visit_number||''} ${a.mr_number||''}`.toLowerCase().includes(q));
  if (!data.length) {
    el.innerHTML = `<div class="empty-state">
      <h3>${anamAll.length?'Tidak ada hasil':'Belum ada antrian anamnesa'}</h3></div>`; return;
  }
  const stColor = {Registered:'#F59E0B', Anamnesa:'#8B5CF6', Lab:'#0EA5E9'};
  el.innerHTML = `<div style="overflow-x:auto"><table class="pro-grid"><thead><tr>
    <th>MR / Kunjungan</th><th>Pasien</th><th>Layanan</th><th>Tipe</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(a=>{
    const c = stColor[a.status]||'#94A3B8';
    const stLabel = a.status==='Registered'?'Menunggu Anamnesa':a.status==='Anamnesa'?'Anamnesa Selesai':a.status;
    return `<tr>
      <td style="font-family:monospace;font-size:11px">${a.mr_number?'<span style="font-weight:700;color:var(--navy)">'+a.mr_number+'</span>':''}<div style="color:var(--gray)">${a.visit_number||''}</div></td>
      <td><div style="font-weight:700;color:var(--navy)">${a.patient_name||'—'}</div>
        <div style="font-size:10.5px;color:var(--gray)">${a.patient_gender||''} ${a.patient_age?'· '+a.patient_age+' th':''} ${a.patient_phone?'· '+a.patient_phone:''}</div></td>
      <td style="font-size:12px">${anamServicesSummary(a)}</td>
      <td style="font-size:11px;color:var(--gray)">${a.visit_type||'Walk-in'}</td>
      <td><span style="background:${c}15;color:${c};border:1px solid ${c}35;padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:700;white-space:nowrap">${stLabel}</span></td>
      <td><div class="act-row" style="flex-wrap:nowrap">
        <button class="btn btn-teal btn-xs" onclick="openExamination(${a.id})">${svgIcon('eye',13)} Examination</button>
        <button class="act-btn" title="Cetak Barcode" onclick="printAnamnesaLabels(${a.id})">${svgIcon('print',14)}</button>
      </div></td>
    </tr>`;
  }).join('')}
  </tbody></table></div>`;
}

// ── Form Anamnesa ────────────────────────────────────────────────
async function openAnamnesaForm(admissionId) {
  const admD = await sbGet('admissions', `select=*&id=eq.${admissionId}`);
  const a = admD?.[0]; if (!a) { toast('Kunjungan tidak ditemukan','err'); return; }
  const exD = await sbGet('anamnesas', `select=*&admission_id=eq.${admissionId}&order=created_at.desc&limit=1`).catch(()=>[]);
  const an = exD?.[0] || {};
  const hasLab = anamHasLabTests(a);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Anamnesa — ${a.patient_name}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="background:var(--mint);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <strong>${a.mr_number||''}</strong> · ${a.visit_number} · ${a.patient_gender||''} ${a.patient_age?a.patient_age+' th':''} · ${anamServicesSummary(a)}
    </div>

    <div class="form-row" style="margin-bottom:8px">
      <div class="form-group" style="grid-column:1/-1"><label>Practitioner *</label>
        <input type="text" id="an-pract" value="${an.practitioner||(getUserName?getUserName():'')}"></div>
      <div class="form-group"><label>Test Date</label>
        <input type="date" id="an-testdate" value="${an.test_date||new Date().toISOString().slice(0,10)}"></div>
    </div>

    <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin-bottom:8px">Vital Sign</div>
    <div class="form-row">
      <div class="form-group"><label>Blood Pressure (mmHg)</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" id="an-sys" value="${an.systole||''}" placeholder="120" style="width:70px">
          <span>/</span>
          <input type="number" id="an-dia" value="${an.diastole||''}" placeholder="80" style="width:70px"></div></div>
      <div class="form-group"><label>Heart Rate (bpm)</label><input type="number" id="an-hr" value="${an.heart_rate||''}" placeholder="72"></div>
      <div class="form-group"><label>Temperature (°C)</label><input type="number" step="0.1" id="an-temp" value="${an.temperature||''}" placeholder="36.5"></div>
      <div class="form-group"><label>Breath (x/mnt)</label><input type="number" id="an-rr" value="${an.respiratory||''}" placeholder="18"></div>
    </div>

    <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:10px 0 8px">Anthropometry</div>
    <div class="form-row">
      <div class="form-group"><label>Height (cm)</label><input type="number" step="0.1" id="an-height" value="${an.height||''}" oninput="calcBMI()"></div>
      <div class="form-group"><label>Weight (kg)</label><input type="number" step="0.1" id="an-weight" value="${an.weight||''}" oninput="calcBMI()"></div>
      <div class="form-group"><label>IMT (kg/m²)</label><input type="text" id="an-bmi" value="${an.bmi||''}" readonly style="background:var(--lgray)"></div>
      <div class="form-group"><label>Ideal Weight (kg)</label><input type="number" step="0.1" id="an-idealw" value="${an.ideal_weight||''}" readonly style="background:var(--lgray)"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Abdomen Circ (cm)</label><input type="number" step="0.1" id="an-abd" value="${an.abdomen_circ||''}"></div>
      <div class="form-group"><label>Chest Circ (cm)</label><input type="number" step="0.1" id="an-chest" value="${an.chest_circ||''}"></div>
      <div class="form-group"><label>Head Circ (cm)</label><input type="number" step="0.1" id="an-head" value="${an.head_circ||''}"></div>
      <div class="form-group"><label>O₂ Saturation (%)</label><input type="number" id="an-spo2" value="${an.spo2||''}" placeholder="98"></div>
      <div class="form-group"><label>Fasting (jam)</label><input type="number" id="an-fasting" value="${an.fasting_hours||''}" placeholder="10"></div>
    </div>

    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin:10px 0 8px">Catatan</div>
    <div class="form-group"><label>Note / Catatan</label>
      <textarea id="an-note" rows="3" placeholder="Catatan anamnesa, keluhan singkat, kondisi pasien...">${an.notes||an.chief_complaint||''}</textarea></div>
    <div class="form-group"><label>Petugas</label><input type="text" id="an-nurse" value="${an.nurse_name||(getUserName?getUserName():'')}"></div>

    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:12px;color:#1E40AF">
      ${hasLab
        ? 'Kunjungan ini <strong>ada tes lab</strong>. Setelah anamnesa disimpan, barcode akan digenerate & dicetak, lalu pasien dilempar ke <strong>Lab</strong>.'
        : 'ℹ️ Kunjungan ini <strong>tanpa tes lab</strong>. Setelah anamnesa disimpan, status menjadi <strong>Selesai</strong>.'}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-outline" onclick="saveAnamnesa(${admissionId},false)">Simpan Saja</button>
      <button class="btn btn-teal" onclick="saveAnamnesa(${admissionId},true)">
        ${hasLab?'✅ Simpan → Print Barcode → Lab':'✅ Simpan → Selesai'}</button>
    </div>`, 'wide');
  calcBMI();
}

function calcBMI() {
  const w = parseFloat(document.getElementById('an-weight')?.value);
  const h = parseFloat(document.getElementById('an-height')?.value);
  const el = document.getElementById('an-bmi');
  const iw = document.getElementById('an-idealw');
  if (h>0 && iw) iw.value = (22*Math.pow(h/100,2)).toFixed(1); else if(iw) iw.value='';
  if (!el) return;
  if (w>0 && h>0) { const b = w/Math.pow(h/100,2); el.value = b.toFixed(1); } else el.value='';
}

function anamHasLabTests(a) {
  try {
    const s = a.services ? JSON.parse(a.services) : [];
    if (s.some(x=>x.product_id)) return true;
    return !!a.package_id;
  } catch(e){ return !!a.package_id; }
}

async function saveAnamnesa(admissionId, proceed) {
  const val = id => document.getElementById(id)?.value;
  const num = id => parseFloat(val(id))||null;
  const payload = {
    admission_id: admissionId,
    systole:num('an-sys'), diastole:num('an-dia'), heart_rate:num('an-hr'),
    respiratory:num('an-rr'), temperature:num('an-temp'), spo2:num('an-spo2'),
    weight:num('an-weight'), height:num('an-height'), bmi:num('an-bmi'), fasting_hours:num('an-fasting'),
    ideal_weight:num('an-idealw'), abdomen_circ:num('an-abd'), chest_circ:num('an-chest'), head_circ:num('an-head'),
    practitioner:val('an-pract')?.trim()||null, test_date:val('an-testdate')||null,
    notes:val('an-note')?.trim()||null, chief_complaint:val('an-note')?.trim()||null,
    nurse_name:val('an-nurse')?.trim()||null,
  };
  try {
    // ambil identitas untuk kolom denormalisasi
    const admD = await sbGet('admissions', `select=visit_number,patient_name&id=eq.${admissionId}`).catch(()=>[]);
    payload.visit_number = admD?.[0]?.visit_number || null;
    payload.patient_name = admD?.[0]?.patient_name || null;

    // upsert: update jika sudah ada, else insert
    const ex = await sbGet('anamnesas', `select=id&admission_id=eq.${admissionId}&limit=1`).catch(()=>[]);
    if (ex?.[0]) await sbPatch('anamnesas', ex[0].id, payload);
    else await sbPost('anamnesas', payload);

    if (typeof logActivity==='function') logActivity('anamnesa','admissions',admissionId,'Anamnesa disimpan',payload.patient_name);
    toast('✅ Anamnesa tersimpan','ok');

    if (proceed) { closeModalForce(); await completeAnamnesa(admissionId); }
    else { await sbPatch('admissions',admissionId,{status:'Anamnesa',updated_at:new Date().toISOString()}).catch(()=>{});
           closeModalForce(); loadAnamnesaQueue(); }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// Selesaikan anamnesa → generate & print barcode → lempar ke Lab (jika ada lab)
async function completeAnamnesa(admissionId) {
  const admD = await sbGet('admissions', `select=*&id=eq.${admissionId}`);
  const a = admD?.[0]; if (!a) return;

  if (!anamHasLabTests(a)) {
    await sbPatch('admissions', admissionId, {status:'Done', updated_at:new Date().toISOString()}).catch(()=>{});
    toast('✅ Anamnesa selesai — tanpa lab, status Selesai','ok');
    loadAnamnesaQueue(); return;
  }

  // pastikan label ada (buat bila belum), lalu cetak Code 128
  const labels = await ensureSampleLabels(a);
  if (labels && labels.length) printLabBarcodes(labels);

  await sbPatch('admissions', admissionId, {status:'Lab', updated_at:new Date().toISOString()}).catch(()=>{});
  toast('✅ Barcode dicetak — pasien dilempar ke Lab','ok',4000);
  loadAnamnesaQueue();
}

// Reprint barcode dari daftar
async function printAnamnesaLabels(admissionId) {
  const admD = await sbGet('admissions', `select=*&id=eq.${admissionId}`);
  const a = admD?.[0]; if (!a) return;
  if (!anamHasLabTests(a)) { toast('Kunjungan ini tidak ada tes lab','warn'); return; }
  const labels = await ensureSampleLabels(a);

  // Resolve actual checked-in barcodes from lab_samples if they exist
  const printable = [];
  for (const l of labels) {
    try {
      const samples = await sbGet('lab_samples', `select=*&label_id=eq.${l.id}`).catch(() => []);
      if (samples && samples.length > 0) {
        samples.forEach(s => {
          printable.push({
            label_barcode: s.barcode,
            patient_name: s.patient_name || a.patient_name,
            mr_number: a.mr_number || l.mr_number,
            visit_number: s.visit_number || a.visit_number,
            patient_gender: a.patient_gender,
            patient_dob: a.patient_dob,
            patient_age: a.patient_age,
            sampel_type: s.sampel_type || l.sampel_type,
            tests: [{ product_name: s.product_name }]
          });
        });
      } else {
        printable.push(l);
      }
    } catch(e) {
      printable.push(l);
    }
  }

  if (printable.length) printLabBarcodes(printable);
  else toast('Tidak ada label untuk dicetak','warn');
}

// Ambil label yang sudah ada; jika belum ada, generate dari tes yang dipesan.
// Mengembalikan array label lengkap dengan tests[] + identitas untuk barcode.
async function ensureSampleLabels(a) {
  let labels = await sbGet('sample_labels', `select=*&admission_id=eq.${a.id}&order=created_at.asc`).catch(()=>[]);
  if (!labels || !labels.length) {
    // generate dari product_ids pada services
    let productIds = [];
    try { productIds = (a.services?JSON.parse(a.services):[]).map(s=>s.product_id).filter(Boolean); } catch(e){}
    if (productIds.length && typeof generateSampleLabelsFromProducts==='function') {
      await generateSampleLabelsFromProducts(a.id, a, productIds);
      labels = await sbGet('sample_labels', `select=*&admission_id=eq.${a.id}&order=created_at.asc`).catch(()=>[]);
    }
  }
  // lampirkan tes tiap label + identitas
  const withTests = await Promise.all((labels||[]).map(async l => {
    const items = await sbGet('sample_label_items', `select=product_name&label_id=eq.${l.id}`).catch(()=>[]);
    return { ...l, mr_number:l.mr_number||a.mr_number, patient_age:a.patient_age,
      tests:(items||[]).map(it=>({product_name:it.product_name})) };
  }));
  return withTests;
}

// ═══════════════════════════════════════════════════════════════
// EXAMINATION VIEW — tab rail (Patient/Anamnesa/Specimen/
// Observation/Notes/ICD X Diagnostic) ala Virtu Digilab
// ═══════════════════════════════════════════════════════════════
let _examAdm=null, _examTab='patient', _examData={};

async function openExamination(admissionId){
  _examAdm=admissionId; _examTab='patient';
  const [admD, anD, labels] = await Promise.all([
    sbGet('admissions',`select=*&id=eq.${admissionId}`),
    sbGet('anamnesas',`select=*&admission_id=eq.${admissionId}&order=created_at.desc&limit=1`).catch(()=>[]),
    sbGet('sample_labels',`select=*&admission_id=eq.${admissionId}&order=created_at.asc`).catch(()=>[]),
  ]);
  _examData={ a:admD?.[0]||{}, an:anD?.[0]||{}, labels:labels||[] };
  renderExam();
  document.getElementById('anam-exam')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function examTab(t){ _examTab=t; renderExam(); }
function closeExam(){ _examAdm=null; const el=document.getElementById('anam-exam'); if(el) el.innerHTML=''; }

function renderExam(){
  const el=document.getElementById('anam-exam'); if(!el) return;
  if(!_examAdm){ el.innerHTML=''; return; }
  const a=_examData.a||{};
  let bc='';
  if(typeof code128B_SVG==='function' && a.visit_number)
    bc = code128B_SVG(a.visit_number).replace('<svg','<svg style="width:180px;height:32px"');
  const tabs=[['patient','Patient','user'],['anamnesa','Anamnesa','stethoscope'],['specimen','Specimen','tube'],
    ['observation','Observation','eye'],['notes','Notes','note'],['icd','ICD X Diagnostic','diagnosis']];
  el.innerHTML=`
    <div class="exam-wrap">
      <div class="exam-rail">
        ${tabs.map(([k,l,ic])=>`<button class="exam-tab ${_examTab===k?'active':''}" onclick="examTab('${k}')">
          ${svgIcon(ic,16)}<span>${l}</span></button>`).join('')}
      </div>
      <div style="min-width:0">
        <div class="exam-topbar">
          <div style="font-size:12px">
            <strong style="color:var(--navy)">${a.mr_number||'—'}</strong> · ${a.visit_number||''}
            <div style="color:var(--gray)">${a.patient_name||''} · ${a.patient_gender==='F'?'Perempuan':a.patient_gender==='M'?'Laki-laki':''}${a.patient_age?' · '+a.patient_age+' th':''}</div>
          </div>
          <div style="text-align:center">${bc}<div style="font-family:monospace;font-size:9px;color:var(--text-dim)">${a.visit_number||''}</div></div>
          <button class="btn btn-ghost btn-sm" onclick="closeExam()">Tutup</button>
        </div>
        <div class="exam-body" id="exam-body"></div>
      </div>
    </div>`;
  renderExamTab();
}

function renderExamTab(){
  const body=document.getElementById('exam-body'); if(!body) return;
  const a=_examData.a||{}, an=_examData.an||{};
  if(_examTab==='patient')          body.innerHTML=examPatientHTML(a);
  else if(_examTab==='anamnesa'){   body.innerHTML=examAnamnesaHTML(an,a); calcBMI(); }
  else if(_examTab==='specimen')    body.innerHTML=examSpecimenHTML();
  else if(_examTab==='observation') body.innerHTML=examObservationHTML(an);
  else if(_examTab==='notes')       body.innerHTML=examNotesHTML(an);
  else if(_examTab==='icd'){        body.innerHTML=`<div class="exam-sec">ICD-X Diagnostic</div><div id="exam-icd-list">Memuat…</div>`; loadExamICD(); }
}

function examPatientHTML(a){
  const row=(l,v)=>`<div style="display:flex;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px">
    <div style="width:140px;color:var(--gray);flex-shrink:0">${l}</div><div style="font-weight:600">${v||'—'}</div></div>`;
  return `<div class="exam-sec">Data Pasien</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
      ${row('MR Number',a.mr_number)}${row('Registration No',a.visit_number)}
      ${row('Name',a.patient_name)}${row('Blood Type',a.patient_blood_type)}
      ${row('Gender',a.patient_gender==='F'?'Perempuan':a.patient_gender==='M'?'Laki-laki':'')}${row('Date of Birth',a.patient_dob)}
      ${row('Age',a.patient_age?a.patient_age+' th':'')}${row('Mobile Phone',a.patient_phone)}
      ${row('Email',a.patient_email)}${row('Citizenship',a.patient_country_of_birth)}
    </div>
    <div class="exam-sec" style="margin-top:14px">Alamat</div>
    <div style="font-size:12.5px">${[a.patient_address,a.patient_subdistrict,a.patient_district,a.patient_city,a.patient_province,a.patient_postal_code].filter(Boolean).join(', ')||'—'}</div>`;
}

function examAnamnesaHTML(an,a){
  const hasLab=anamHasLabTests(a);
  return `<div class="exam-sec">Practitioner &amp; Test Date</div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label>Practitioner *</label>
        <input type="text" id="an-pract" value="${an.practitioner||(getUserName?getUserName():'')}"></div>
      <div class="form-group"><label>Test Date</label>
        <input type="date" id="an-testdate" value="${an.test_date||new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div class="exam-sec">Vital Sign</div>
    <div class="form-row">
      <div class="form-group"><label>Blood Pressure (mmHg)</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" id="an-sys" value="${an.systole||''}" placeholder="120" style="width:70px"><span>/</span>
          <input type="number" id="an-dia" value="${an.diastole||''}" placeholder="80" style="width:70px"></div></div>
      <div class="form-group"><label>Heart Rate (bpm)</label><input type="number" id="an-hr" value="${an.heart_rate||''}" placeholder="72"></div>
      <div class="form-group"><label>Temperature (°C)</label><input type="number" step="0.1" id="an-temp" value="${an.temperature||''}" placeholder="36.5"></div>
      <div class="form-group"><label>Breath (x/mnt)</label><input type="number" id="an-rr" value="${an.respiratory||''}" placeholder="18"></div>
    </div>
    <div class="exam-sec">Anthropometry</div>
    <div class="form-row">
      <div class="form-group"><label>Height (cm)</label><input type="number" step="0.1" id="an-height" value="${an.height||''}" oninput="calcBMI()"></div>
      <div class="form-group"><label>Weight (kg)</label><input type="number" step="0.1" id="an-weight" value="${an.weight||''}" oninput="calcBMI()"></div>
      <div class="form-group"><label>IMT (kg/m²)</label><input type="text" id="an-bmi" value="${an.bmi||''}" readonly style="background:var(--lgray)"></div>
      <div class="form-group"><label>Ideal Weight (kg)</label><input type="number" step="0.1" id="an-idealw" value="${an.ideal_weight||''}" readonly style="background:var(--lgray)"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Abdomen Circ (cm)</label><input type="number" step="0.1" id="an-abd" value="${an.abdomen_circ||''}"></div>
      <div class="form-group"><label>Chest Circ (cm)</label><input type="number" step="0.1" id="an-chest" value="${an.chest_circ||''}"></div>
      <div class="form-group"><label>Head Circ (cm)</label><input type="number" step="0.1" id="an-head" value="${an.head_circ||''}"></div>
      <div class="form-group"><label>O₂ Saturation (%)</label><input type="number" id="an-spo2" value="${an.spo2||''}" placeholder="98"></div>
      <div class="form-group"><label>Fasting (jam)</label><input type="number" id="an-fasting" value="${an.fasting_hours||''}" placeholder="10"></div>
    </div>
    <div class="exam-sec">Note</div>
    <div class="form-group"><textarea id="an-note" rows="3" placeholder="Catatan anamnesa singkat...">${an.notes||''}</textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:12px;margin-top:6px">
      <button class="btn btn-outline btn-sm" onclick="saveExamAnamnesa(false)">${svgIcon('check',14)} Simpan</button>
      <button class="btn btn-teal btn-sm" onclick="saveExamAnamnesa(true)">
        ${hasLab?'Simpan → Print Barcode → Lab':'Simpan → Selesai'} ${svgIcon('chevron',14)}</button>
    </div>`;
}

async function saveExamAnamnesa(proceed){
  const val=id=>document.getElementById(id)?.value;
  const num=id=>parseFloat(val(id))||null;
  const a=_examData.a||{};
  const payload={ admission_id:_examAdm, visit_number:a.visit_number||null, patient_name:a.patient_name||null,
    systole:num('an-sys'), diastole:num('an-dia'), heart_rate:num('an-hr'), respiratory:num('an-rr'),
    temperature:num('an-temp'), spo2:num('an-spo2'), weight:num('an-weight'), height:num('an-height'),
    bmi:num('an-bmi'), fasting_hours:num('an-fasting'), ideal_weight:num('an-idealw'),
    abdomen_circ:num('an-abd'), chest_circ:num('an-chest'), head_circ:num('an-head'),
    practitioner:val('an-pract')?.trim()||null, test_date:val('an-testdate')||null,
    notes:val('an-note')?.trim()||null, chief_complaint:val('an-note')?.trim()||null,
    nurse_name:val('an-pract')?.trim()||null };
  try{
    const ex=await sbGet('anamnesas',`select=id&admission_id=eq.${_examAdm}&limit=1`).catch(()=>[]);
    if(ex?.[0]) await sbPatch('anamnesas',ex[0].id,payload); else await sbPost('anamnesas',payload);
    _examData.an=Object.assign({},_examData.an,payload);
    toast('✅ Anamnesa tersimpan','ok');
    if(proceed){ const id=_examAdm; closeExam(); await completeAnamnesa(id); }
    else { await sbPatch('admissions',_examAdm,{status:'Anamnesa',updated_at:new Date().toISOString()}).catch(()=>{}); loadAnamnesaQueue(); }
  }catch(e){ toast('❌ '+e.message,'err'); }
}

function examSpecimenHTML(){
  const labels=_examData.labels||[];
  const hasLab=anamHasLabTests(_examData.a||{});
  const badge=(s)=>`<span style="background:${s==='CheckedIn'?'#DCFCE7':'#FEF3C7'};color:${s==='CheckedIn'?'#166534':'#92400E'};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${s||'—'}</span>`;
  return `<div class="exam-sec">Specimen</div>
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn btn-teal btn-sm" onclick="examGenSpecimen()">${svgIcon('refresh',14)} Generate &amp; Print Barcode</button>
      <button class="btn btn-ghost btn-sm" onclick="printAnamnesaLabels(${_examAdm})">${svgIcon('print',14)} Print Barcode</button>
    </div>
    ${labels.length?`<table class="pro-grid"><thead><tr><th>Barcode</th><th>Specimen</th><th>Status</th><th>Check-in</th></tr></thead><tbody>
      ${labels.map(l=>`<tr><td style="font-family:monospace;font-size:11px;font-weight:700">${l.label_barcode||''}</td>
        <td>${l.sampel_type||'—'}</td><td>${badge(l.status)}</td>
        <td style="font-size:11px;color:var(--gray)">${l.checked_in_at?new Date(l.checked_in_at).toLocaleString('id-ID'):'—'}</td></tr>`).join('')}
      </tbody></table>`
      :`<div style="color:var(--gray);font-size:12px;padding:8px 0">${hasLab?'Belum ada barcode. Klik <strong>Generate &amp; Print Barcode</strong>.':'Kunjungan ini tanpa tes lab.'}</div>`}
    <div style="font-size:11px;color:var(--gray);margin-top:10px">ℹ️ Specimen dikirim ke LIS saat <strong>Check-In</strong> di modul Laboratorium.</div>`;
}
async function examGenSpecimen(){
  const labels=await ensureSampleLabels(_examData.a||{});
  if(labels&&labels.length){
    if(typeof printLabBarcodes==='function') printLabBarcodes(labels);
    _examData.labels=await sbGet('sample_labels',`select=*&admission_id=eq.${_examAdm}&order=created_at.asc`).catch(()=>_examData.labels);
    renderExamTab();
  } else toast('Kunjungan ini tanpa tes lab','warn');
}

function examObservationHTML(an){
  return `<div class="exam-sec">Observation &amp; Clinical Notes</div>
    <textarea id="exam-obs" rows="7" style="width:100%" placeholder="Observasi klinis, temuan pemeriksaan...">${an.observation||''}</textarea>
    <div style="margin-top:8px;text-align:right">
      <button class="btn btn-teal btn-sm" onclick="saveExamField('observation','exam-obs')">${svgIcon('check',14)} Simpan Observasi</button></div>`;
}
function examNotesHTML(an){
  return `<div class="exam-sec">Notes</div>
    <textarea id="exam-notes" rows="7" style="width:100%" placeholder="Catatan tambahan...">${an.notes||''}</textarea>
    <div style="margin-top:8px;text-align:right">
      <button class="btn btn-teal btn-sm" onclick="saveExamField('notes','exam-notes')">${svgIcon('check',14)} Simpan Notes</button></div>`;
}
async function saveExamField(field, inputId){
  const v=document.getElementById(inputId)?.value?.trim()||null;
  const a=_examData.a||{};
  try{
    const ex=await sbGet('anamnesas',`select=id&admission_id=eq.${_examAdm}&limit=1`).catch(()=>[]);
    if(ex?.[0]) await sbPatch('anamnesas',ex[0].id,{[field]:v});
    else { const p={admission_id:_examAdm, visit_number:a.visit_number||null, patient_name:a.patient_name||null}; p[field]=v; await sbPost('anamnesas',p); }
    _examData.an[field]=v;
    toast('✅ Tersimpan','ok');
  }catch(e){ toast('❌ '+e.message,'err'); }
}

// ── ICD-X Diagnostic ─────────────────────────────────────────────
async function loadExamICD(){
  const el=document.getElementById('exam-icd-list'); if(!el) return;
  let rows=[];
  try{ rows=await sbGet('icd_diagnostics',`select=*&admission_id=eq.${_examAdm}&order=created_at.asc`)||[]; }
  catch(e){ el.innerHTML=`<div class="status-box status-warn">Tabel <code>icd_diagnostics</code> belum ada — jalankan <code>supabase_virtu_fields.sql</code>.</div>`; return; }
  el.innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button class="btn btn-teal btn-sm" onclick="examAddICD()">${svgIcon('plus',14)} Add</button>
      <button class="btn btn-ghost btn-sm" onclick="loadExamICD()">${svgIcon('refresh',14)} Refresh</button>
    </div>
    <table class="pro-grid"><thead><tr><th>ICD Code</th><th>Diagnose Name</th><th>Type</th><th>Case</th><th>Description</th><th>Date</th><th></th></tr></thead><tbody>
    ${rows.length?rows.map(r=>`<tr>
      <td style="font-family:monospace;font-weight:700">${r.icd_code||''}</td>
      <td>${r.diagnose_name||''}</td>
      <td style="font-size:11px">${r.diagnose_type||''}</td>
      <td style="font-size:11px">${r.case_type||''}</td>
      <td style="font-size:11px;color:var(--gray)">${r.description||'—'}</td>
      <td style="font-size:11px;color:var(--gray)">${r.dx_date||'—'}</td>
      <td><button class="act-btn del" onclick="examDelICD(${r.id})" style="font-size:10.5px;font-weight:700"></button></td></tr>`).join('')
      :`<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:18px">Belum ada diagnosis</td></tr>`}
    </tbody></table>`;
}
function examAddICD(){
  openModal(`<div class="modal-header"><div class="modal-title">Tambah ICD-X Diagnostic</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div class="form-row">
      <div class="form-group"><label>ICD Code *</label><input id="icd-code" placeholder="Z00.0"></div>
      <div class="form-group" style="grid-column:2/-1"><label>Diagnose Name *</label><input id="icd-name" placeholder="General medical examination"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Diagnose Type</label><select id="icd-type"><option>PRIMARY</option><option>SECONDARY</option></select></div>
      <div class="form-group"><label>Case</label><select id="icd-case"><option>NEW</option><option>OLD</option></select></div>
      <div class="form-group"><label>Date</label><input type="date" id="icd-date" value="${new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div class="form-group"><label>Description</label><input id="icd-desc"></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="examSaveICD()">Simpan</button></div>`);
}
async function examSaveICD(){
  const code=document.getElementById('icd-code').value.trim();
  const name=document.getElementById('icd-name').value.trim();
  if(!code||!name){ toast('ICD Code & Diagnose Name wajib','err'); return; }
  try{
    await sbPost('icd_diagnostics',{ admission_id:_examAdm, icd_code:code, diagnose_name:name,
      diagnose_type:document.getElementById('icd-type').value, case_type:document.getElementById('icd-case').value,
      description:document.getElementById('icd-desc').value.trim()||null,
      dx_date:document.getElementById('icd-date').value||null, created_by:getUserName?getUserName():'User' });
    toast('✅ Diagnosis ditambahkan','ok'); closeModalForce(); loadExamICD();
  }catch(e){ toast('❌ '+e.message,'err',5000); }
}
async function examDelICD(id){
  if(!confirm('Hapus diagnosis ini?')) return;
  try{ await sbDelete('icd_diagnostics',id); toast('Terhapus','warn'); loadExamICD(); }
  catch(e){ toast('❌ '+e.message,'err'); }
}