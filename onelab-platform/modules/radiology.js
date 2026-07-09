// ═══════════════════════════════════════════
// MODULE: Radiology
// Upload gambar + nilai + interpretasi dokter
// ═══════════════════════════════════════════

const RADIO_TYPES = [
  'Rontgen Thorax','Rontgen Extremitas','Rontgen Vertebra',
  'USG Abdomen','USG Pelvis','USG Thyroid','USG Mammae',
  'Rontgen Sinus Paranasal','Rontgen Panoramik','Lainnya'
];

const RADIO_STATUS = {
  'Waiting':    {color:'#F59E0B',icon:'⏳'},
  'Processing': {color:'#0EA5E9',icon:'🔄'},
  'Done':       {color:'#8B5CF6',icon:'📝'},
  'Validated':  {color:'#22C55E',icon:'✅'},
};

let radioAll = [];

async function renderRadiology() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Radiology</h1>
        <p>Rontgen, USG — upload hasil, input nilai, interpretasi dokter</p></div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="openRadioForm()">+ Input Hasil Radiologi</button>
      </div>
    </div>

    <!-- KPI -->
    <div id="radio-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <!-- Filter -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <input class="table-search" id="radio-q" placeholder="🔍 Cari nama pasien, no. kunjungan..."
        oninput="filterRadio()" style="flex:1">
      <select class="table-filter" id="radio-status" onchange="filterRadio()">
        <option value="">Semua Status</option>
        ${Object.keys(RADIO_STATUS).map(s=>`<option>${s}</option>`).join('')}
      </select>
      <select class="table-filter" id="radio-type" onchange="filterRadio()">
        <option value="">Semua Tipe</option>
        ${RADIO_TYPES.map(t=>`<option>${t}</option>`).join('')}
      </select>
      <input type="date" class="table-filter" id="radio-date"
        value="${new Date().toISOString().split('T')[0]}" onchange="loadRadiology()">
    </div>

    <div id="radio-list">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;

  await loadRadiology();
}

async function loadRadiology() {
  try {
    const data = await sbGet('lab_results',
      `select=*&product_id=in.(${await getRadioProdIds()})&order=created_at.desc&limit=100`
    ).catch(async () => {
      // Fallback: get all radiology category
      return await sbGet('lab_results','select=*&order=created_at.desc&limit=100');
    });
    radioAll = (Array.isArray(data)?data:[]).filter(r=>
      r.product_name?.toLowerCase().includes('rontgen')||
      r.product_name?.toLowerCase().includes('usg')||
      r.product_name?.toLowerCase().includes('radio')||
      r.notes?.includes('[RADIO]')
    );
    renderRadioKPI();
    filterRadio();
  } catch(e) {
    radioAll = [];
    renderRadioKPI();
    filterRadio();
  }
}

async function getRadioProdIds() {
  try {
    const prods = await sbGet('products','select=id&kategori=eq.Radiologi');
    return (prods||[]).map(p=>p.id).join(',') || '0';
  } catch(e) { return '0'; }
}

function renderRadioKPI() {
  const el = document.getElementById('radio-kpi'); if (!el) return;
  el.innerHTML = [
    {icon:'🏥',val:radioAll.length,                                    label:'Total Pemeriksaan',color:'#0A2342'},
    {icon:'⏳',val:radioAll.filter(r=>r.status==='Draft').length,      label:'Menunggu Input',   color:'#F59E0B'},
    {icon:'📝',val:radioAll.filter(r=>r.status==='Validated').length,  label:'Tervalidasi',      color:'#22C55E'},
    {icon:'🔏',val:radioAll.filter(r=>r.status==='Approved').length,   label:'Approved',         color:'#8B5CF6'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);border-left:4px solid ${k.color}">
      <div style="font-size:20px">${k.icon}</div>
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

function filterRadio() {
  const q  = (document.getElementById('radio-q')?.value||'').toLowerCase();
  const st = document.getElementById('radio-status')?.value||'';
  const tp = document.getElementById('radio-type')?.value||'';
  const f  = radioAll.filter(r=>
    (!q  || (r.patient_name||'').toLowerCase().includes(q)||(r.visit_number||'').includes(q)) &&
    (!st || r.status===st) &&
    (!tp || (r.product_name||'').includes(tp))
  );
  renderRadioList(f);
}

function renderRadioList(data) {
  const el = document.getElementById('radio-list'); if (!el) return;
  if (!data.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="ico">🫁</div>
      <h3>${radioAll.length?'Tidak ada hasil':'Belum ada pemeriksaan radiologi'}</h3>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openRadioForm()">+ Input Hasil</button>
    </div>`; return;
  }

  el.innerHTML = `<div style="display:grid;gap:10px">
    ${data.map(r=>{
      const fileUrl = r.notes?.match(/\[FILE:(.*?)\]/)?.[1];
      return `
      <div class="card" style="padding:14px 16px">
        <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
          <!-- Thumbnail -->
          <div style="width:70px;height:70px;border-radius:8px;background:var(--lgray);
            display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;
            overflow:hidden;border:1px solid var(--border)">
            ${fileUrl?`<img src="${fileUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.innerHTML='🫁'">`:'🫁'}
          </div>
          <!-- Info -->
          <div style="flex:1;min-width:150px">
            <div style="font-size:14px;font-weight:700;color:var(--navy)">${r.patient_name||'—'}</div>
            <div style="font-size:11px;color:var(--gray)">${r.visit_number||'—'} · ${r.product_name||'Radiologi'}</div>
            ${r.result_value?`<div style="font-size:12px;margin-top:6px;color:var(--text)">${r.result_value}</div>`:''}
            ${r.interpretation?`
              <div style="margin-top:6px">
                <span style="background:${r.color_code==='green'?'#E8F5E9':r.color_code==='red'?'#FFEBEE':'#FFF8E1'};
                  color:${r.color_code==='green'?'#2E7D32':r.color_code==='red'?'#C62828':'#92400E'};
                  padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">
                  ${r.interpretation}
                </span>
              </div>`:''}
          </div>
          <!-- Status & Actions -->
          <div style="text-align:right;flex-shrink:0">
            <span style="background:${r.status==='Approved'?'#E8F5E9':r.status==='Validated'?'#E3F2FD':'#FFF8E1'};
              color:${r.status==='Approved'?'#2E7D32':r.status==='Validated'?'#1565C0':'#92400E'};
              padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">${r.status||'Draft'}</span>
            <div class="act-row" style="margin-top:8px;justify-content:flex-end">
              <button class="act-btn edit" onclick="openRadioForm(${r.id})">✏️ Edit</button>
              ${r.status==='Draft'?`<button class="act-btn" style="color:#22C55E;font-size:11px" onclick="updateResultStatus(${r.id},'Validated')">Validasi</button>`:''}
              ${r.status==='Validated'?`<button class="act-btn" style="color:#8B5CF6;font-size:11px" onclick="updateResultStatus(${r.id},'Approved')">Approve</button>`:''}
              <button class="act-btn" onclick="printRadioResult(${r.id})" title="Print">🖨</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

async function openRadioForm(id=null) {
  let r = {};
  if (id) { const d=await sbGet('lab_results',`select=*&id=eq.${id}`); r=d[0]||{}; }

  let admOpts = '<option value="">-- Pilih Kunjungan Pasien --</option>';
  try {
    const adms = await sbGet('admissions','select=id,visit_number,patient_name,patient_gender,patient_age&order=created_at.desc&limit=100');
    admOpts += (adms||[]).map(a=>`<option value="${a.id}"
      data-name="${a.patient_name}" data-visit="${a.visit_number}"
      data-gender="${a.patient_gender||''}" data-age="${a.patient_age||''}"
      ${r.admission_id==a.id?'selected':''}>
      ${a.visit_number} — ${a.patient_name}</option>`).join('');
  } catch(e){}

  // Extract existing file URL and notes
  const existingFile = r.notes?.match(/\[FILE:(.*?)\]/)?.[1]||'';
  const existingNotes = (r.notes||'').replace(/\[FILE:.*?\]/,'').replace('[RADIO]','').trim();
  const existingRec   = r.notes?.match(/\[REC:(.*?)\]/)?.[1]||'';
  const cleanNotes    = existingNotes.replace(/\[REC:.*?\]/,'').trim();

  const user = getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit':'🫁 Input'} Hasil Radiologi</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1">
        <label>Pasien / Kunjungan *</label>
        <select id="rf-adm" onchange="
          document.getElementById('rf-patient').value=this.options[this.selectedIndex].dataset.name||'';
          document.getElementById('rf-visit').value=this.options[this.selectedIndex].dataset.visit||''">
          ${admOpts}
        </select>
        <input type="hidden" id="rf-patient" value="${r.patient_name||''}">
        <input type="hidden" id="rf-visit" value="${r.visit_number||''}">
      </div>
      <div class="form-group">
        <label>Tipe Pemeriksaan *</label>
        <select id="rf-type">
          ${RADIO_TYPES.map(t=>`<option${(r.product_name||'')==t?' selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Dokter Radiologi</label>
        <input type="text" id="rf-doctor" value="${r.approved_by||''}" placeholder="dr. Nama SpRad">
      </div>
    </div>

    <!-- Upload Gambar -->
    <div class="form-group">
      <label>Upload Gambar Hasil (JPG/PNG/PDF)</label>
      <div style="border:2px dashed var(--border);border-radius:8px;padding:16px;text-align:center;background:var(--lgray)">
        <input type="file" id="rf-file" accept=".jpg,.jpeg,.png,.pdf" style="display:none"
          onchange="previewRadioFile(this)">
        <div id="rf-preview" style="margin-bottom:8px">
          ${existingFile?`<img src="${existingFile}" style="max-height:120px;border-radius:6px">`:
            '<div style="font-size:32px">🫁</div><div style="font-size:12px;color:var(--gray)">Klik untuk upload gambar</div>'}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('rf-file').click()">
          📁 Pilih File
        </button>
        <input type="hidden" id="rf-file-url" value="${existingFile}">
        <div id="rf-file-name" style="font-size:11px;color:var(--gray);margin-top:4px"></div>
      </div>
    </div>

    <!-- Klinis -->
    <div class="form-group">
      <label>Deskripsi / Kesan Radiologi *</label>
      <textarea id="rf-value" rows="3"
        placeholder="Cor: membesar, CTR > 0.5. Pulmo: infiltrat di lapang tengah kanan...">${r.result_value||''}</textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Kesimpulan / Interpretasi</label>
        <select id="rf-interp" onchange="updateRadioColor(this.value)">
          <option value="Normal" ${(r.interpretation||'')==='Normal'?'selected':''}>Normal</option>
          <option value="Borderline" ${r.interpretation==='Borderline'?'selected':''}>Borderline</option>
          <option value="Abnormal" ${r.interpretation==='Abnormal'?'selected':''}>Abnormal</option>
          <option value="Curiga Keganasan" ${r.interpretation==='Curiga Keganasan'?'selected':''}>Curiga Keganasan</option>
          <option value="Perlu Follow-up" ${r.interpretation==='Perlu Follow-up'?'selected':''}>Perlu Follow-up</option>
        </select>
        <input type="hidden" id="rf-color" value="${r.color_code||'green'}">
      </div>
      <div class="form-group">
        <label>Rekomendasi Dokter</label>
        <input type="text" id="rf-rec" value="${existingRec}"
          placeholder="Foto ulang, konsul SpPD, kontrol 1 bulan...">
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveRadioResult(${id||'null'})">💾 Simpan</button>
    </div>`);
}

function updateRadioColor(val) {
  const map = {Normal:'green',Borderline:'yellow','Abnormal':'orange','Curiga Keganasan':'red','Perlu Follow-up':'yellow'};
  const el  = document.getElementById('rf-color');
  if (el) el.value = map[val]||'green';
}

function previewRadioFile(input) {
  const file = input.files[0]; if (!file) return;
  const nameEl = document.getElementById('rf-file-name');
  if (nameEl) nameEl.textContent = file.name + ' (' + (file.size/1024).toFixed(0) + ' KB)';
  const prev = document.getElementById('rf-preview');
  if (prev && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => { prev.innerHTML = `<img src="${e.target.result}" style="max-height:120px;border-radius:6px">`; };
    reader.readAsDataURL(file);
  }
  // In real implementation, upload to Supabase storage
  // For now store as data URL
  const reader2 = new FileReader();
  reader2.onload = e => {
    const urlEl = document.getElementById('rf-file-url');
    if (urlEl) urlEl.value = e.target.result;
  };
  reader2.readAsDataURL(file);
}

async function saveRadioResult(id) {
  const admSel = document.getElementById('rf-adm');
  const admId  = admSel?.value;
  const type   = document.getElementById('rf-type').value;
  const desc   = document.getElementById('rf-value').value.trim();
  if (!admId) { toast('Pilih kunjungan pasien dulu','err'); return; }
  if (!desc)  { toast('Deskripsi wajib diisi','err'); return; }

  const patName  = document.getElementById('rf-patient').value || admSel.options[admSel.selectedIndex]?.dataset.name||'';
  const visitNum = document.getElementById('rf-visit').value   || admSel.options[admSel.selectedIndex]?.dataset.visit||'';
  const fileUrl  = document.getElementById('rf-file-url').value||'';
  const rec      = document.getElementById('rf-rec').value.trim();
  const interp   = document.getElementById('rf-interp').value;
  const color    = document.getElementById('rf-color').value||'green';
  const doctor   = document.getElementById('rf-doctor').value.trim();
  const user     = getUserName?getUserName():'User';

  const notesStr = `[RADIO]${fileUrl?`[FILE:${fileUrl}]`:''}${rec?`[REC:${rec}]`:''}`;

  const payload = {
    admission_id:  parseInt(admId),
    visit_number:  visitNum,
    patient_name:  patName,
    product_name:  type,
    result_value:  desc,
    interpretation:interp,
    color_code:    color,
    is_auto:       false,
    status:        'Draft',
    entered_by:    user,
    entered_at:    new Date().toISOString(),
    approved_by:   doctor||null,
    notes:         notesStr,
    updated_at:    new Date().toISOString(),
  };

  try {
    if (id) { await sbPatch('lab_results',id,payload); toast('✅ Hasil diupdate','ok'); }
    else    { await sbPost('lab_results',payload);    toast('✅ Hasil disimpan','ok'); }
    closeModalForce();
    await loadRadiology();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function printRadioResult(id) {
  const d = await sbGet('lab_results',`select=*&id=eq.${id}`);
  const r = d[0]; if (!r) return;
  const fileUrl   = r.notes?.match(/\[FILE:(.*?)\]/)?.[1]||'';
  const rec       = r.notes?.match(/\[REC:(.*?)\]/)?.[1]||'';
  const orgName   = localStorage.getItem('ol_org_name')||'OneLab Diagnostics';
  const orgAddr   = localStorage.getItem('ol_org_addr')||'';
  const cMap      = {green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'};
  const c         = cMap[r.color_code]||'#94A3B8';

  const w = window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Hasil Radiologi — ${r.patient_name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;font-size:13px;color:#1A2B3C}
      .header{display:flex;justify-content:space-between;border-bottom:3px solid #0A2342;padding-bottom:14px;margin-bottom:20px}
      h2{color:#0A2342;margin:0}.badge{padding:4px 14px;border-radius:10px;font-size:12px;font-weight:700}
      .section{margin-bottom:20px}.label{font-size:11px;color:#546E7A;text-transform:uppercase;letter-spacing:.05em}
      .img-box{border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center;margin-bottom:16px}
      @media print{button{display:none}}
    </style></head><body>
    <button onclick="window.print()" style="position:fixed;top:16px;right:16px;padding:8px 18px;background:#0A2342;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print</button>
    <div class="header">
      <div><h2>${orgName}</h2><div style="font-size:12px;color:#546E7A">${orgAddr}</div></div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:800;color:#0A2342">HASIL RADIOLOGI</div>
        <div style="font-size:12px;color:#546E7A">${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#F0F4F8;border-radius:8px;padding:14px;margin-bottom:20px">
      <div><div class="label">Nama Pasien</div><strong>${r.patient_name||'—'}</strong></div>
      <div><div class="label">No. Kunjungan</div><strong>${r.visit_number||'—'}</strong></div>
      <div><div class="label">Pemeriksaan</div><strong>${r.product_name||'—'}</strong></div>
      <div><div class="label">Dokter Radiologi</div><strong>${r.approved_by||'—'}</strong></div>
    </div>
    ${fileUrl&&!fileUrl.startsWith('data:')?`<div class="img-box"><img src="${fileUrl}" style="max-width:100%;max-height:400px"></div>`:''}
    <div class="section">
      <div class="label" style="margin-bottom:6px">Deskripsi / Kesan Radiologi</div>
      <div style="background:#F8FAFC;border-radius:8px;padding:14px;line-height:1.8">${r.result_value||'—'}</div>
    </div>
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
      <div class="label">Kesimpulan:</div>
      <span class="badge" style="background:${c}20;color:${c}">${r.interpretation||'—'}</span>
    </div>
    ${rec?`<div class="section">
      <div class="label" style="margin-bottom:4px">Rekomendasi</div>
      <div style="color:#0A2342;font-weight:600">${rec}</div>
    </div>`:''}
    <div style="margin-top:50px;display:flex;justify-content:flex-end">
      <div style="text-align:center">
        <div style="margin-bottom:40px">Diperiksa oleh:</div>
        <div>________________________</div>
        <div style="font-size:12px;color:#546E7A">${r.approved_by||'Dokter Radiologi'}</div>
      </div>
    </div>
    </body></html>`);
  w.document.close();
}
