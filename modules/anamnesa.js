// ═══════════════════════════════════════════════════════════════
// MODULE: Anamnesa (WAJIB) — gerbang setelah registrasi
// Semua registrasi masuk ke sini. Alur:
//   Registrasi → ANAMNESA (TTV + keluhan) → Generate & Print Barcode
//   → jika ada tes lab: dilempar ke Lab; jika tidak: Selesai.
// Barcode lab dicetak di sini (Code 128, label 5×3 cm).
// ═══════════════════════════════════════════════════════════════

let anamAll = [], anamSearch = '';

async function renderAnamnesa() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>🩺 Anamnesa</h1>
        <p>Pemeriksaan awal wajib · TTV &amp; keluhan · cetak barcode sampel · rujuk ke Lab</p></div>
      <div class="btn-row">
        <input type="date" class="table-filter" id="anam-date" onchange="loadAnamnesaQueue()"
          value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>
    <div id="anam-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px"></div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <input class="table-search" id="anam-q" placeholder="🔍 Cari nama / no. kunjungan / MR..."
        oninput="anamSearch=this.value;renderAnamnesaList()" style="flex:1">
    </div>
    <div id="anam-list"><div class="loading-row"><div class="spinner"></div></div></div>`;
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
    {icon:'🩺', val:done,    label:'Anamnesa Selesai',  color:'#8B5CF6'},
    {icon:'🧪', val:inLab,   label:'Di Lab',            color:'#0EA5E9'},
    {icon:'📋', val:anamAll.length, label:'Total Antrian', color:'#0A2342'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:10px 12px;border:1px solid var(--border);border-left:4px solid ${k.color}">
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
    el.innerHTML = `<div class="empty-state"><div class="ico">🩺</div>
      <h3>${anamAll.length?'Tidak ada hasil':'Belum ada antrian anamnesa'}</h3></div>`; return;
  }
  const stColor = {Registered:'#F59E0B', Anamnesa:'#8B5CF6', Lab:'#0EA5E9'};
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
    ${data.map(a=>{
      const c = stColor[a.status]||'#94A3B8';
      const stLabel = a.status==='Registered'?'Menunggu Anamnesa':a.status==='Anamnesa'?'Anamnesa Selesai':a.status;
      return `<div class="card" style="padding:12px 16px;border-left:4px solid ${c}">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="font-size:11px;font-family:monospace;color:var(--gray);min-width:110px">
            ${a.mr_number?'<div style="font-weight:700;color:var(--navy)">'+a.mr_number+'</div>':''}${a.visit_number||'—'}</div>
          <div style="flex:1;min-width:150px">
            <div style="font-weight:700;color:var(--navy)">${a.patient_name||'—'}</div>
            <div style="font-size:11px;color:var(--gray)">${a.patient_gender||''} ${a.patient_age?'· '+a.patient_age+' th':''} ${a.patient_phone?'· '+a.patient_phone:''}</div>
          </div>
          <div style="min-width:150px">
            <div style="font-size:12px;font-weight:600;color:var(--navy)">${anamServicesSummary(a)}</div>
            <div style="font-size:11px;color:var(--gray)">${a.visit_type||'Walk-in'}</div>
          </div>
          <div><span style="background:${c}20;color:${c};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">${stLabel}</span></div>
          <div class="act-row" style="flex-shrink:0">
            <button class="btn btn-teal btn-xs" onclick="openAnamnesaForm(${a.id})">🩺 Anamnesa</button>
            <button class="act-btn" title="Cetak Barcode Sampel" onclick="printAnamnesaLabels(${a.id})">🏷️</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
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
      <div class="modal-title">🩺 Anamnesa — ${a.patient_name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="background:var(--mint);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <strong>${a.mr_number||''}</strong> · ${a.visit_number} · ${a.patient_gender||''} ${a.patient_age?a.patient_age+' th':''} · ${anamServicesSummary(a)}
    </div>

    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Tanda Vital (TTV)</div>
    <div class="form-row">
      <div class="form-group"><label>Tekanan Darah (mmHg)</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" id="an-sys" value="${an.systole||''}" placeholder="120" style="width:70px">
          <span>/</span>
          <input type="number" id="an-dia" value="${an.diastole||''}" placeholder="80" style="width:70px"></div></div>
      <div class="form-group"><label>Nadi (x/mnt)</label><input type="number" id="an-hr" value="${an.heart_rate||''}" placeholder="72"></div>
      <div class="form-group"><label>Napas (x/mnt)</label><input type="number" id="an-rr" value="${an.respiratory||''}" placeholder="18"></div>
      <div class="form-group"><label>Suhu (°C)</label><input type="number" step="0.1" id="an-temp" value="${an.temperature||''}" placeholder="36.5"></div>
      <div class="form-group"><label>SpO₂ (%)</label><input type="number" id="an-spo2" value="${an.spo2||''}" placeholder="98"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Berat (kg)</label><input type="number" step="0.1" id="an-weight" value="${an.weight||''}" oninput="calcBMI()"></div>
      <div class="form-group"><label>Tinggi (cm)</label><input type="number" step="0.1" id="an-height" value="${an.height||''}" oninput="calcBMI()"></div>
      <div class="form-group"><label>BMI</label><input type="text" id="an-bmi" value="${an.bmi||''}" readonly style="background:var(--lgray)"></div>
      <div class="form-group"><label>Puasa (jam)</label><input type="number" id="an-fasting" value="${an.fasting_hours||''}" placeholder="10"></div>
    </div>

    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin:10px 0 8px">Catatan</div>
    <div class="form-group"><label>Note / Catatan</label>
      <textarea id="an-note" rows="3" placeholder="Catatan anamnesa, keluhan singkat, kondisi pasien...">${an.notes||an.chief_complaint||''}</textarea></div>
    <div class="form-group"><label>Petugas</label><input type="text" id="an-nurse" value="${an.nurse_name||(getUserName?getUserName():'')}"></div>

    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:12px;color:#1E40AF">
      ${hasLab
        ? '🧪 Kunjungan ini <strong>ada tes lab</strong>. Setelah anamnesa disimpan, barcode akan digenerate & dicetak, lalu pasien dilempar ke <strong>Lab</strong>.'
        : 'ℹ️ Kunjungan ini <strong>tanpa tes lab</strong>. Setelah anamnesa disimpan, status menjadi <strong>Selesai</strong>.'}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-outline" onclick="saveAnamnesa(${admissionId},false)">💾 Simpan Saja</button>
      <button class="btn btn-teal" onclick="saveAnamnesa(${admissionId},true)">
        ${hasLab?'✅ Simpan → Print Barcode → Lab':'✅ Simpan → Selesai'}</button>
    </div>`, 'wide');
  calcBMI();
}

function calcBMI() {
  const w = parseFloat(document.getElementById('an-weight')?.value);
  const h = parseFloat(document.getElementById('an-height')?.value);
  const el = document.getElementById('an-bmi'); if (!el) return;
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
  if (labels && labels.length) printLabBarcodes(labels);
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
