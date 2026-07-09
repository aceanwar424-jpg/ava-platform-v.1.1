// ═══════════════════════════════════════════
// MODULE: Operasional Lab
// - Check In Sampel (barcode)
// - Enter Result (manual + auto analyzer)
// - Validasi & Approval
// - Medical Record Lab
// ═══════════════════════════════════════════

const LAB_TABS = ['checkin','result','validation','approval','medrecord'];
let labSamples=[], labResults=[];

async function renderLab(tab='checkin') {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Operasional Lab</h1>
        <p>Check in sampel, input hasil, validasi, approval, rekam medis</p></div>
      <div class="btn-row">
        <span id="lab-date-badge" style="font-size:12px;color:var(--gray)"></span>
      </div>
    </div>

    <!-- KPI -->
    <div id="lab-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <div class="tabs" id="lab-tabs">
      <button class="tab-btn ${tab==='checkin'?'active':''}"  onclick="switchLabTab('checkin',this)">🧪 Check In Sampel</button>
      <button class="tab-btn ${tab==='result'?'active':''}"   onclick="switchLabTab('result',this)">📝 Enter Result</button>
      <button class="tab-btn ${tab==='validation'?'active':''}" onclick="switchLabTab('validation',this)">✅ Validasi</button>
      <button class="tab-btn ${tab==='approval'?'active':''}" onclick="switchLabTab('approval',this)">🔏 Approval</button>
      <button class="tab-btn ${tab==='medrecord'?'active':''}" onclick="switchLabTab('medrecord',this)">📁 Rekam Medis Lab</button>
    </div>

    <div id="lab-checkin"    ${tab!=='checkin'?'style="display:none"':''}></div>
    <div id="lab-result"     ${tab!=='result'?'style="display:none"':''}></div>
    <div id="lab-validation" ${tab!=='validation'?'style="display:none"':''}></div>
    <div id="lab-approval"   ${tab!=='approval'?'style="display:none"':''}></div>
    <div id="lab-medrecord"  ${tab!=='medrecord'?'style="display:none"':''}></div>`;

  const today = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
  const badge = document.getElementById('lab-date-badge');
  if (badge) badge.textContent = today;

  await Promise.all([loadLabSamples(), loadLabResults()]);
  renderLabKPI();
  renderCheckinTab();
  renderResultTab();
  renderValidationTab();
  renderApprovalTab();
  renderMedRecordTab();
}

function switchLabTab(tab, btn) {
  document.querySelectorAll('#lab-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  LAB_TABS.forEach(t=>{
    const el=document.getElementById(`lab-${t}`);
    if (el) el.style.display=t===tab?'block':'none';
  });
}

async function loadLabSamples() {
  try {
    const today=new Date().toISOString().split('T')[0];
    const data=await sbGet('lab_samples',
      `select=*,admissions(patient_name,visit_number)&order=created_at.desc&limit=100`);
    labSamples=Array.isArray(data)?data:[];
  } catch(e){ labSamples=[]; }
}

async function loadLabResults() {
  try {
    const data=await sbGet('lab_results',
      `select=*,products(nama_tes,satuan_hasil),ref_ranges(condition_name,color_code)&order=created_at.desc&limit=200`);
    labResults=Array.isArray(data)?data:[];
  } catch(e){ labResults=[]; }
}

function renderLabKPI() {
  const el=document.getElementById('lab-kpi'); if (!el) return;
  const pending  = labSamples.filter(s=>s.status==='Pending').length;
  const inProc   = labSamples.filter(s=>s.status==='In Process').length;
  const draftRes = labResults.filter(r=>r.status==='Draft').length;
  const validated= labResults.filter(r=>r.status==='Validated').length;
  const approved = labResults.filter(r=>r.status==='Approved').length;
  const released = labResults.filter(r=>r.status==='Released').length;

  el.innerHTML=[
    {icon:'🧪',val:pending,    label:'Sampel Pending',  color:'#F59E0B'},
    {icon:'⚗️', val:inProc,    label:'Diproses',        color:'#0EA5E9'},
    {icon:'📝',val:draftRes,   label:'Draft Hasil',     color:'#8B5CF6'},
    {icon:'✅',val:validated,  label:'Tervalidasi',     color:'#22C55E'},
    {icon:'🔏',val:approved,   label:'Approved',        color:'#00897B'},
    {icon:'📤',val:released,   label:'Released',        color:'#0A2342'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:10px 12px;border:1px solid var(--border);border-left:4px solid ${k.color};text-align:center;cursor:pointer">
      <div style="font-size:16px">${k.icon}</div>
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:9px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

// ── CHECK IN SAMPEL ───────────────────────
function renderCheckinTab() {
  const el=document.getElementById('lab-checkin'); if (!el) return;
  const pending=labSamples.filter(s=>['Pending','Rejected'].includes(s.status));

  el.innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
      <input class="table-search" id="barcode-input" placeholder="🔍 Scan / Ketik Barcode Label atau Nama Pasien..."
        onkeydown="if(event.key==='Enter')checkInBarcode(this.value)" style="flex:1">
      <button class="btn btn-teal" onclick="checkInBarcode(document.getElementById('barcode-input').value)">Check In</button>
      <button class="btn btn-ghost" onclick="openSampleForm()">+ Manual</button>
    </div>
    <div id="lab-pending-labels"></div>
    <div class="table-wrap">
      <table><thead><tr>
        <th>Barcode</th><th>Pasien</th><th>Tes</th><th>Tipe Sampel</th>
        <th>Waktu Terima</th><th>Analis</th><th>Alat</th><th>Status</th><th>Aksi</th>
      </tr></thead><tbody>
      ${pending.length ? pending.map(s=>`<tr>
        <td style="font-family:monospace;font-size:12px;font-weight:700">${s.barcode||'—'}</td>
        <td>
          <div style="font-weight:600">${s.patient_name||s.admissions?.patient_name||'—'}</div>
          <div style="font-size:10px;color:var(--gray)">${s.visit_number||s.admissions?.visit_number||'—'}</div>
        </td>
        <td style="font-size:12px">${s.product_name||'—'}</td>
        <td style="font-size:11px;color:var(--gray)">${s.sampel_type||'—'}</td>
        <td style="font-size:11px;color:var(--gray)">${s.received_at?new Date(s.received_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
        <td style="font-size:12px">${s.collected_by||'—'}</td>
        <td style="font-size:11px;color:var(--gray)">${s.analyzer_name||'—'}</td>
        <td>
          <span style="background:${s.status==='Pending'?'#FFF8E1':'#FFEBEE'};
            color:${s.status==='Pending'?'#92400E':'#C62828'};
            padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${s.status}</span>
        </td>
        <td>
          <div class="act-row">
            <button class="act-btn" style="color:#22C55E;font-size:11px"
              onclick="processSample(${s.id})">Proses</button>
            <button class="act-btn del" onclick="rejectSample(${s.id})">Tolak</button>
          </div>
        </td>
      </tr>`).join('') : `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--gray)">
        ✅ Tidak ada sampel pending</td></tr>`}
      </tbody></table>
    </div>`;
  loadPendingLabels();
}

async function loadPendingLabels() {
  const el = document.getElementById('lab-pending-labels');
  if (!el) return;
  try {
    const labels = await sbGet('sample_labels',
      'select=*&status=eq.Created&order=created_at.desc&limit=30').catch(()=>[]);
    if (!labels || !labels.length) { el.innerHTML=''; return; }

    const itemCounts = await Promise.all(labels.map(l =>
      sbGet('sample_label_items',`select=product_name&label_id=eq.${l.id}`).catch(()=>[])
    ));

    el.innerHTML = `
      <div style="background:var(--mint);border-radius:var(--r);padding:12px 14px;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin-bottom:8px">
          🏷️ ${labels.length} Label Menunggu Check-In dari Klinik
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${labels.map((l,i)=>`
            <div onclick="openLabelCheckin(${l.id})" style="cursor:pointer;background:#fff;border:1px solid var(--border);
              border-radius:var(--r);padding:8px 12px;min-width:180px">
              <div style="font-family:monospace;font-size:11px;font-weight:700;color:var(--teal)">${l.label_barcode}</div>
              <div style="font-size:12px;font-weight:600">${l.patient_name}</div>
              <div style="font-size:10.5px;color:var(--gray)">
                <span style="background:#0891B2;color:#fff;padding:1px 6px;border-radius:6px;margin-right:4px">${l.sampel_type}</span>
                ${itemCounts[i]?.length||0} tes
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  } catch(e) { el.innerHTML=''; }
}

async function checkInBarcode(val) {
  val = (val||'').trim();
  if (!val) return;
  try {
    // Primary path: search by sample_labels (the label printed at registration)
    const labels = await sbGet('sample_labels',
      `select=*&label_barcode=ilike.${encodeURIComponent('%'+val+'%')}&status=eq.Created&limit=5`).catch(()=>[]);
    if (labels?.length) {
      await openLabelCheckin(labels[0].id);
      return;
    }

    // Fallback: legacy lab_samples (manual check-in, no label system used)
    let samples = await sbGet('lab_samples',`select=*&barcode=ilike.${encodeURIComponent('%'+val+'%')}&limit=5`);
    if (!samples?.length) {
      // Try by patient name via admissions
      const adms = await sbGet('admissions',`select=id,visit_number,patient_name&patient_name=ilike.${encodeURIComponent('%'+val+'%')}&status=eq.Lab&limit=5`);
      if (adms?.length) {
        openCheckinForAdmission(adms[0]);
        return;
      }
    }
    if (samples?.length) {
      await processSample(samples[0].id);
    } else {
      toast('Barcode label/pasien tidak ditemukan','warn');
    }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// LABEL CHECK-IN — scan 1 barcode label, check-in semua tes sekaligus
// ══════════════════════════════════════════════════════════════
async function openLabelCheckin(labelId) {
  const [labelData, items] = await Promise.all([
    sbGet('sample_labels',`select=*&id=eq.${labelId}`),
    sbGet('sample_label_items',`select=*&label_id=eq.${labelId}`).catch(()=>[]),
  ]);
  const label = labelData?.[0]; if (!label) { toast('Label tidak ditemukan','err'); return; }

  let analyzerOpts='<option value="">-- Pilih Alat (opsional) --</option>';
  try {
    const azs=await sbGet('analyzers','select=id,nama_alat&status=eq.Aktif');
    analyzerOpts+=(azs||[]).map(a=>`<option value="${a.id}">${a.nama_alat}</option>`).join('');
  } catch(e){}

  const now = new Date().toISOString().slice(0,16);
  const user = getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">🧪 Check In Label — ${label.label_barcode}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="background:var(--mint);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <strong>${label.patient_name}</strong> · ${label.visit_number} ·
      <span style="background:#0891B2;color:#fff;padding:1px 8px;border-radius:8px;font-size:10.5px;margin-left:4px">${label.sampel_type}</span>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">
      ${items.length} Tes dalam Label Ini — semua akan check-in sekaligus
    </div>
    <div style="max-height:180px;overflow-y:auto;margin-bottom:14px">
      ${items.map(it=>`<div style="padding:6px 10px;background:var(--bg2);border-radius:var(--r);margin-bottom:4px;font-size:12.5px">
        • ${it.product_name}</div>`).join('')}
    </div>
    <div class="form-row">
      <div class="form-group"><label>Volume Total (mL)</label><input type="number" id="lc-vol" step="0.1" placeholder="3"></div>
      <div class="form-group"><label>Waktu Pengambilan</label><input type="datetime-local" id="lc-collected" value="${now}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Diambil/Diterima Oleh</label><input type="text" id="lc-collector" value="${user}"></div>
      <div class="form-group"><label>Alat Analyzer</label><select id="lc-analyzer">${analyzerOpts}</select></div>
    </div>
    <div class="form-group"><label>Catatan</label><input type="text" id="lc-notes" placeholder="Kondisi sampel..."></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveLabelCheckin(${labelId})">🧪 Check In Semua (${items.length} Tes)</button>
    </div>`);
}

async function saveLabelCheckin(labelId) {
  const [labelData, items] = await Promise.all([
    sbGet('sample_labels',`select=*&id=eq.${labelId}`),
    sbGet('sample_label_items',`select=*&label_id=eq.${labelId}`).catch(()=>[]),
  ]);
  const label = labelData?.[0]; if (!label) return;

  const vol       = parseFloat(document.getElementById('lc-vol')?.value)||null;
  const collected = document.getElementById('lc-collected')?.value||new Date().toISOString();
  const collector = document.getElementById('lc-collector')?.value.trim()||(getUserName?getUserName():'User');
  const azSel      = document.getElementById('lc-analyzer');
  const azId       = azSel?.value;
  const azName     = azSel?.options[azSel?.selectedIndex]?.textContent?.trim()||'';
  const notes      = document.getElementById('lc-notes')?.value.trim()||null;
  const user = getUserName?getUserName():'User';

  try {
    for (const it of items) {
      await sbPost('lab_samples',{
        barcode: `${label.label_barcode}-${it.product_id}`,
        admission_id: label.admission_id,
        visit_number: label.visit_number,
        patient_name: label.patient_name,
        product_id: it.product_id,
        product_name: it.product_name,
        sampel_type: label.sampel_type,
        volume_ml: vol,
        collected_at: collected,
        collected_by: collector,
        analyzer_id: parseInt(azId)||null,
        analyzer_name: azName||null,
        received_at: new Date().toISOString(),
        status: 'Pending',
        notes,
        label_id: labelId,
      });
      await sbPost('lab_results',{
        admission_id: label.admission_id,
        visit_number: label.visit_number,
        patient_name: label.patient_name,
        product_id: it.product_id,
        product_name: it.product_name,
        status: 'Draft',
        entered_by: user,
        entered_at: new Date().toISOString(),
      });
    }
    await sbPatch('sample_labels', labelId, {
      status:'CheckedIn', checked_in_at: new Date().toISOString(),
      collected_at: collected, collected_by: collector,
    });

    toast(`✅ ${items.length} tes berhasil check-in dari 1 label`,'ok');
    closeModalForce();
    await Promise.all([loadLabSamples(), loadLabResults()]);
    renderLabKPI(); renderCheckinTab(); renderResultTab();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function openCheckinForAdmission(adm) {
  // Load tes yang dipesan di admission ini
  let prodOpts='<option value="">-- Pilih Tes --</option>';
  try {
    const prods=await sbGet('products','select=id,nama_tes,kode_internal,sampel_type&is_active=eq.true&order=kategori,nama_tes');
    prodOpts+=(prods||[]).map(p=>`<option value="${p.id}" data-sampel="${p.sampel_type||''}" data-name="${p.nama_tes}">${p.kode_internal} — ${p.nama_tes}</option>`).join('');
  } catch(e){}

  let analyzerOpts='<option value="">-- Pilih Alat --</option>';
  try {
    const azs=await sbGet('analyzers','select=id,nama_alat,merk&status=eq.Aktif');
    analyzerOpts+=(azs||[]).map(a=>`<option value="${a.id}" data-name="${a.nama_alat}">${a.nama_alat}</option>`).join('');
  } catch(e){}

  const user=getUserName?getUserName():'User';
  const now=new Date().toISOString().slice(0,16);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">🧪 Check In Sampel — ${adm.patient_name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="background:var(--mint);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <strong>${adm.visit_number}</strong> · ${adm.patient_name}
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Barcode Sampel *</label>
        <input type="text" id="sc-barcode" value="${adm.visit_number}-${Date.now().toString().slice(-4)}"
          placeholder="Scan atau ketik barcode">
      </div>
      <div class="form-group" style="grid-column:2/-1">
        <label>Tes / Pemeriksaan *</label>
        <select id="sc-prod" onchange="document.getElementById('sc-sampel').value=this.options[this.selectedIndex].dataset.sampel||''">
          ${prodOpts}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipe Sampel</label>
        <input type="text" id="sc-sampel" placeholder="Darah Vena, Urin...">
      </div>
      <div class="form-group">
        <label>Volume (mL)</label>
        <input type="number" id="sc-vol" placeholder="2" step="0.1">
      </div>
      <div class="form-group">
        <label>Waktu Pengambilan</label>
        <input type="datetime-local" id="sc-collected" value="${now}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Diambil Oleh</label>
        <input type="text" id="sc-collector" value="${user}">
      </div>
      <div class="form-group" style="grid-column:2/-1">
        <label>Alat Analyzer</label>
        <select id="sc-analyzer">${analyzerOpts}</select>
      </div>
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <input type="text" id="sc-notes" placeholder="Kondisi sampel, catatan khusus...">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveSampleCheckin(${adm.id})">🧪 Check In</button>
    </div>`);
}

async function openSampleForm() {
  // Quick search admission
  openModal(`
    <div class="modal-header">
      <div class="modal-title">🧪 Check In Sampel Manual</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Cari No. Kunjungan / Nama Pasien</label>
      <input type="text" id="ci-search" placeholder="Ketik untuk cari..." oninput="searchAdmForCheckin(this.value)">
    </div>
    <div id="ci-results" style="max-height:300px;overflow-y:auto"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
    </div>`);
}

async function searchAdmForCheckin(q) {
  if (!q || q.length < 2) return;
  const el = document.getElementById('ci-results');
  if (!el) return;
  try {
    const data = await sbGet('admissions',
      `select=id,visit_number,patient_name,status&patient_name=ilike.${encodeURIComponent('%'+q+'%')}&order=created_at.desc&limit=10`);
    el.innerHTML = (data||[]).map(a=>`
      <div onclick="closeModalForce();openCheckinForAdmission(${JSON.stringify({id:a.id,visit_number:a.visit_number,patient_name:a.patient_name}).replace(/"/g,'&quot;')})"
        style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;
          hover:background:var(--lgray)">
        <div style="font-weight:600">${a.patient_name}</div>
        <div style="font-size:11px;color:var(--gray)">${a.visit_number} · ${a.status}</div>
      </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--gray)">Tidak ditemukan</div>';
  } catch(e){}
}

async function saveSampleCheckin(admissionId) {
  const barcode  = document.getElementById('sc-barcode').value.trim();
  const prodSel  = document.getElementById('sc-prod');
  const prodId   = prodSel?.value;
  const prodName = prodSel?.options[prodSel.selectedIndex]?.dataset.name||'';
  const azSel    = document.getElementById('sc-analyzer');
  const azId     = azSel?.value;
  const azName   = azSel?.options[azSel?.selectedIndex]?.textContent?.trim()||'';
  const user=getUserName?getUserName():'User';

  if (!barcode) { toast('Barcode wajib diisi','err'); return; }
  if (!prodId)  { toast('Pilih tes dulu','err'); return; }

  try {
    const admission = await sbGet('admissions',`select=patient_name,visit_number&id=eq.${admissionId}`);
    const adm = admission[0]||{};

    await sbPost('lab_samples',{
      barcode,
      admission_id:   admissionId,
      visit_number:   adm.visit_number,
      patient_name:   adm.patient_name,
      product_id:     parseInt(prodId),
      product_name:   prodName,
      sampel_type:    document.getElementById('sc-sampel').value.trim()||null,
      volume_ml:      parseFloat(document.getElementById('sc-vol').value)||null,
      collected_at:   document.getElementById('sc-collected').value||new Date().toISOString(),
      collected_by:   document.getElementById('sc-collector').value.trim()||user,
      analyzer_id:    parseInt(azId)||null,
      analyzer_name:  azName||null,
      received_at:    new Date().toISOString(),
      status:         'Pending',
      notes:          document.getElementById('sc-notes').value.trim()||null,
    });

    // Also create draft lab result
    await sbPost('lab_results',{
      admission_id:  admissionId,
      visit_number:  adm.visit_number,
      patient_name:  adm.patient_name,
      product_id:    parseInt(prodId),
      product_name:  prodName,
      status:        'Draft',
      entered_by:    user,
      entered_at:    new Date().toISOString(),
    });

    toast('✅ Sampel berhasil di check-in','ok');
    closeModalForce();
    await Promise.all([loadLabSamples(), loadLabResults()]);
    renderLabKPI();
    renderCheckinTab();
    renderResultTab();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function processSample(id) {
  const user=getUserName?getUserName():'User';
  try {
    await sbPatch('lab_samples',id,{status:'In Process',received_at:new Date().toISOString()});
    toast('✅ Sampel diproses','ok');
    await loadLabSamples();
    renderCheckinTab();
    renderLabKPI();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function rejectSample(id) {
  const reason=prompt('Alasan penolakan sampel:');
  if (!reason) return;
  try {
    await sbPatch('lab_samples',id,{status:'Rejected',rejection_reason:reason});
    toast('Sampel ditolak','warn');
    await loadLabSamples();
    renderCheckinTab();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── ENTER RESULT ──────────────────────────
function renderResultTab() {
  const el=document.getElementById('lab-result'); if (!el) return;
  const drafts=labResults.filter(r=>r.status==='Draft');

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <span class="badge badge-gray" style="margin-right:6px">${drafts.length} hasil belum diinput</span>
        <span style="font-size:12px;color:var(--gray)">Hasil dari analyzer masuk otomatis jika terintegrasi</span>
      </div>
      <button class="btn btn-teal btn-sm" onclick="openResultForm()">+ Input Manual</button>
    </div>
    <div class="table-wrap">
      <table><thead><tr>
        <th>Pasien</th><th>Tes</th><th>Hasil</th><th>Unit</th>
        <th>Interpretasi</th><th>Sumber</th><th>Status</th><th>Aksi</th>
      </tr></thead><tbody>
      ${drafts.length ? drafts.map(r=>{
        const colorMap={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'};
        const c=colorMap[r.color_code||r.ref_ranges?.color_code]||'#94A3B8';
        return `<tr>
          <td>
            <div style="font-weight:600">${r.patient_name||'—'}</div>
            <div style="font-size:10px;color:var(--gray)">${r.visit_number||'—'}</div>
          </td>
          <td style="font-size:12px">${r.product_name||r.products?.nama_tes||'—'}</td>
          <td>
            ${r.result_value ?
              `<span style="font-size:14px;font-weight:800;color:${c}">${r.result_value}</span>` :
              `<button class="btn btn-teal btn-xs" onclick="openResultForm(${r.id})">Input</button>`}
          </td>
          <td style="font-size:11px;color:var(--gray)">${r.unit||r.products?.satuan_hasil||'—'}</td>
          <td>
            ${r.interpretation?`
              <span style="background:${c}20;color:${c};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">
                ${r.interpretation}
              </span>`:'—'}
          </td>
          <td style="font-size:11px">
            ${r.is_auto?'<span class="badge badge-teal">Auto</span>':'<span class="badge badge-gray">Manual</span>'}
          </td>
          <td>
            <span style="background:#FFF8E1;color:#92400E;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">
              ${r.status}
            </span>
          </td>
          <td>
            <div class="act-row">
              <button class="act-btn edit" onclick="openResultForm(${r.id})">✏️</button>
            </div>
          </td>
        </tr>`;
      }).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray)">
        ✅ Semua hasil sudah diinput</td></tr>`}
      </tbody></table>
    </div>`;
}

async function openResultForm(resultId=null) {
  let r={};
  if (resultId) { const d=await sbGet('lab_results',`select=*&id=eq.${resultId}`); r=d[0]||{}; }

  // Load ref ranges for selected product
  let rrData=[];
  if (r.product_id) {
    try { rrData=await sbGet('ref_ranges',`select=*&product_id=eq.${r.product_id}&order=range_min.asc`)||[]; } catch(e){}
  }

  // Load admissions for patient selection
  let admOpts='<option value="">-- Pilih Kunjungan --</option>';
  try {
    const adms=await sbGet('admissions','select=id,visit_number,patient_name&status=in.(Lab,Registered)&order=created_at.desc&limit=50');
    admOpts+=(adms||[]).map(a=>`<option value="${a.id}" data-name="${a.patient_name}" data-visit="${a.visit_number}"
      ${r.admission_id==a.id?'selected':''}>${a.visit_number} — ${a.patient_name}</option>`).join('');
  } catch(e){}

  let prodOpts='<option value="">-- Pilih Tes --</option>';
  try {
    const prods=await sbGet('products','select=id,nama_tes,kode_internal,satuan_hasil&is_active=eq.true&order=kategori,nama_tes');
    prodOpts+=(prods||[]).map(p=>`<option value="${p.id}" data-unit="${p.satuan_hasil||''}" data-name="${p.nama_tes}"
      ${r.product_id==p.id?'selected':''}>${p.kode_internal} — ${p.nama_tes}</option>`).join('');
  } catch(e){}

  const user=getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📝 ${resultId?'Update':'Input'} Hasil Pemeriksaan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1">
        <label>Kunjungan Pasien *</label>
        <select id="rf-adm" onchange="document.getElementById('rf-patient').value=this.options[this.selectedIndex].dataset.name||''">
          ${admOpts}
        </select>
      </div>
      <input type="hidden" id="rf-patient" value="${r.patient_name||''}">
      <div class="form-group" style="grid-column:1/-1">
        <label>Tes / Pemeriksaan *</label>
        <select id="rf-prod" onchange="loadRRForResult(this.value);document.getElementById('rf-unit').value=this.options[this.selectedIndex].dataset.unit||''">
          ${prodOpts}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Nilai Hasil *</label>
        <input type="text" id="rf-value" value="${r.result_value||''}"
          placeholder="Angka atau teks (Pos/Neg)"
          oninput="interpretResult(this.value)">
      </div>
      <div class="form-group">
        <label>Unit</label>
        <input type="text" id="rf-unit" value="${r.unit||''}" placeholder="mg/dL">
      </div>
    </div>

    <!-- Auto Interpretation -->
    <div id="rf-interp-box" style="margin-bottom:12px"></div>

    <!-- Ref Ranges quick view -->
    <div id="rf-rr-view" style="margin-bottom:12px">
      ${rrData.length?`
        <div style="font-size:11px;color:var(--gray);margin-bottom:6px;font-weight:700">Rentang Rujukan:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${rrData.map(rr=>{
            const c={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'}[rr.color_code]||'#94A3B8';
            return `<div style="background:${c}15;border:1px solid ${c}40;border-radius:8px;padding:4px 10px;font-size:11px">
              <strong style="color:${c}">${rr.condition_name}</strong>
              ${rr.range_min!==null&&rr.range_max!==null?`: ${rr.range_min}–${rr.range_max} ${rr.unit||''}`:''}</div>`;
          }).join('')}
        </div>`:''}
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Interpretasi</label>
        <input type="text" id="rf-interp" value="${r.interpretation||''}" placeholder="Normal, Tinggi, Prediabetik...">
      </div>
      <div class="form-group">
        <label>Catatan</label>
        <input type="text" id="rf-notes" value="${r.notes||''}" placeholder="Catatan analis...">
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveLabResult(${resultId||'null'})">💾 Simpan Hasil</button>
    </div>`);
}

let _rrCache = {};
async function loadRRForResult(productId) {
  if (!productId) return;
  try {
    const rrs = _rrCache[productId] || await sbGet('ref_ranges',`select=*&product_id=eq.${productId}&order=range_min.asc`);
    _rrCache[productId] = rrs||[];
    const el=document.getElementById('rf-rr-view');
    if (!el||!rrs?.length) return;
    const c={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'};
    el.innerHTML=`
      <div style="font-size:11px;color:var(--gray);margin-bottom:6px;font-weight:700">Rentang Rujukan:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${rrs.map(rr=>`<div style="background:${(c[rr.color_code]||'#94A3B8')}15;border:1px solid ${(c[rr.color_code]||'#94A3B8')}40;border-radius:8px;padding:4px 10px;font-size:11px">
          <strong style="color:${c[rr.color_code]||'#94A3B8'}">${rr.condition_name}</strong>
          ${rr.range_min!==null&&rr.range_max!==null?`: ${rr.range_min}–${rr.range_max} ${rr.unit||''}`:''}</div>`).join('')}
      </div>`;
  } catch(e){}
}

function interpretResult(val) {
  const numVal = parseFloat(val);
  const prodSel = document.getElementById('rf-prod');
  if (!prodSel?.value || isNaN(numVal)) return;

  const rrs = _rrCache[prodSel.value]||[];
  if (!rrs.length) return;

  const match = rrs.find(rr=>
    (rr.range_min===null||numVal>=rr.range_min) &&
    (rr.range_max===null||numVal<=rr.range_max)
  );
  if (!match) return;

  const c={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'}[match.color_code]||'#94A3B8';
  const iEl=document.getElementById('rf-interp');
  if (iEl) iEl.value=match.interpretation||match.condition_name||'';

  const box=document.getElementById('rf-interp-box');
  if (box) box.innerHTML=`
    <div style="background:${c}15;border:2px solid ${c}40;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px">
      <div style="width:12px;height:12px;border-radius:50%;background:${c};flex-shrink:0"></div>
      <div>
        <div style="font-size:13px;font-weight:700;color:${c}">${match.condition_name||match.interpretation||'—'}</div>
        ${match.description?`<div style="font-size:11px;color:var(--gray)">${match.description}</div>`:''}
        ${match.recommendation?`<div style="font-size:11px;color:${c};margin-top:2px">💡 ${match.recommendation}</div>`:''}
      </div>
    </div>`;
}

async function saveLabResult(id) {
  const admSel  = document.getElementById('rf-adm');
  const admId   = admSel?.value;
  const prodSel = document.getElementById('rf-prod');
  const prodId  = prodSel?.value;
  const val     = document.getElementById('rf-value').value.trim();

  if (!admId)  { toast('Pilih kunjungan dulu','err'); return; }
  if (!prodId) { toast('Pilih tes dulu','err'); return; }
  if (!val)    { toast('Nilai hasil wajib diisi','err'); return; }

  const admName  = document.getElementById('rf-patient').value||
    admSel.options[admSel.selectedIndex]?.dataset.name||'';
  const admVisit = admSel.options[admSel.selectedIndex]?.dataset.visit||'';
  const prodName = prodSel.options[prodSel.selectedIndex]?.dataset.name||'';
  const user=getUserName?getUserName():'User';

  // Apply ref range
  const numVal = parseFloat(val);
  const rrs = _rrCache[prodId]||[];
  const matchRR = !isNaN(numVal) ? rrs.find(rr=>
    (rr.range_min===null||numVal>=rr.range_min)&&(rr.range_max===null||numVal<=rr.range_max)
  ) : null;

  const payload={
    admission_id:  parseInt(admId),
    visit_number:  admVisit,
    patient_name:  admName,
    product_id:    parseInt(prodId),
    product_name:  prodName,
    result_value:  val,
    result_numeric:isNaN(numVal)?null:numVal,
    unit:          document.getElementById('rf-unit').value.trim()||null,
    ref_range_id:  matchRR?.id||null,
    normal_min:    matchRR?.range_min||null,
    normal_max:    matchRR?.range_max||null,
    interpretation:document.getElementById('rf-interp').value.trim()||matchRR?.interpretation||null,
    color_code:    matchRR?.color_code||'green',
    condition_name:matchRR?.condition_name||null,
    is_auto:       false,
    status:        'Draft',
    entered_by:    user,
    entered_at:    new Date().toISOString(),
    notes:         document.getElementById('rf-notes').value.trim()||null,
    updated_at:    new Date().toISOString(),
  };

  try {
    if (id) { await sbPatch('lab_results',id,payload); toast('✅ Hasil diupdate','ok'); }
    else    { await sbPost('lab_results',payload);    toast('✅ Hasil disimpan','ok'); }
    closeModalForce();
    await loadLabResults();
    renderResultTab();
    renderValidationTab();
    renderLabKPI();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── VALIDASI ──────────────────────────────
function renderValidationTab() {
  const el=document.getElementById('lab-validation'); if (!el) return;
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value);

  el.innerHTML=`
    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <span class="badge badge-gold">${toValidate.length} hasil siap divalidasi</span>
      ${toValidate.length?`<button class="btn btn-teal btn-sm" onclick="validateAllResults()">✅ Validasi Semua</button>`:''}
    </div>
    ${renderResultReviewTable(toValidate,'validated')}`;
}

function renderApprovalTab() {
  const el=document.getElementById('lab-approval'); if (!el) return;
  const toApprove=labResults.filter(r=>r.status==='Validated');

  el.innerHTML=`
    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <span class="badge badge-purple">${toApprove.length} hasil siap diapprove</span>
      ${toApprove.length?`<button class="btn btn-teal btn-sm" onclick="approveAllResults()">🔏 Approve Semua</button>`:''}
    </div>
    ${renderResultReviewTable(toApprove,'approved')}`;
}

function renderResultReviewTable(data, nextStatus) {
  if (!data.length) return `<div class="empty-state" style="padding:40px">
    <div class="ico">✅</div><h3>Tidak ada yang perlu di-${nextStatus==='validated'?'validasi':'approve'}</h3>
  </div>`;

  const actionLabel = nextStatus==='validated' ? 'Validasi' : 'Approve';
  const actionColor = nextStatus==='validated' ? '#22C55E' : '#8B5CF6';
  const c={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'};

  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>Pasien</th><th>Tes</th><th>Hasil</th><th>Interpretasi</th><th>Status</th><th>Aksi</th>
    </tr></thead><tbody>
    ${data.map(r=>{
      const col=c[r.color_code||r.ref_ranges?.color_code]||'#94A3B8';
      return `<tr>
        <td>
          <div style="font-weight:600">${r.patient_name||'—'}</div>
          <div style="font-size:10px;color:var(--gray)">${r.visit_number||'—'}</div>
        </td>
        <td style="font-size:12px">${r.product_name||r.products?.nama_tes||'—'}</td>
        <td style="font-size:14px;font-weight:800;color:${col}">${r.result_value||'—'} ${r.unit||''}</td>
        <td>
          <span style="background:${col}20;color:${col};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">
            ${r.interpretation||'—'}
          </span>
        </td>
        <td><span class="badge badge-gray">${r.status}</span></td>
        <td>
          <button onclick="updateResultStatus(${r.id},'${nextStatus}')"
            style="background:${actionColor};color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">
            ${actionLabel}
          </button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

async function updateResultStatus(id, status) {
  const user=getUserName?getUserName():'User';
  const now=new Date().toISOString();
  const updates={status,updated_at:now};
  if (status==='Validated') { updates.validated_by=user; updates.validated_at=now; }
  if (status==='Approved')  { updates.approved_by=user;  updates.approved_at=now; }
  if (status==='Released')  { updates.approved_by=user;  updates.approved_at=now; }

  try {
    await sbPatch('lab_results',id,updates);
    toast(`✅ Status → ${status}`,'ok');
    await loadLabResults();
    renderValidationTab();
    renderApprovalTab();
    renderLabKPI();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function validateAllResults() {
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value);
  const user=getUserName?getUserName():'User';
  const now=new Date().toISOString();
  for (const r of toValidate) {
    await sbPatch('lab_results',r.id,{status:'Validated',validated_by:user,validated_at:now,updated_at:now}).catch(()=>{});
  }
  toast(`✅ ${toValidate.length} hasil tervalidasi`,'ok');
  await loadLabResults();
  renderValidationTab(); renderApprovalTab(); renderLabKPI();
}

async function approveAllResults() {
  const toApprove=labResults.filter(r=>r.status==='Validated');
  const user=getUserName?getUserName():'User';
  const now=new Date().toISOString();
  for (const r of toApprove) {
    await sbPatch('lab_results',r.id,{status:'Approved',approved_by:user,approved_at:now,updated_at:now}).catch(()=>{});
  }
  toast(`✅ ${toApprove.length} hasil approved`,'ok');
  await loadLabResults();
  renderApprovalTab(); renderLabKPI();
}

// ── MEDICAL RECORD LAB ────────────────────
function renderMedRecordTab() {
  const el=document.getElementById('lab-medrecord'); if (!el) return;
  const released=labResults.filter(r=>r.status==='Approved'||r.status==='Released');

  // Group by patient
  const byPatient={};
  released.forEach(r=>{
    const key=r.patient_name||'Unknown';
    if (!byPatient[key]) byPatient[key]={name:key,results:[],visit:r.visit_number};
    byPatient[key].results.push(r);
  });

  if (!Object.keys(byPatient).length) {
    el.innerHTML=`<div class="empty-state">
      <div class="ico">📁</div><h3>Belum ada hasil yang diapprove</h3>
    </div>`; return;
  }

  const c={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'};

  el.innerHTML=Object.values(byPatient).map(pt=>`
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--navy)">${pt.name}</div>
          <div style="font-size:11px;color:var(--gray)">${pt.visit} · ${pt.results.length} pemeriksaan</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="printLabReport('${pt.name}')">🖨 Cetak Hasil</button>
      </div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr style="background:var(--lgray)">
          <th style="padding:6px 10px;text-align:left">Pemeriksaan</th>
          <th style="padding:6px 10px;text-align:left">Hasil</th>
          <th style="padding:6px 10px;text-align:left">Satuan</th>
          <th style="padding:6px 10px;text-align:left">Interpretasi</th>
          <th style="padding:6px 10px;text-align:left">Rentang Normal</th>
        </tr></thead>
        <tbody>
        ${pt.results.map(r=>{
          const col=c[r.color_code]||'#94A3B8';
          return `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:6px 10px;font-weight:600">${r.product_name||'—'}</td>
            <td style="padding:6px 10px;font-weight:800;color:${col}">${r.result_value||'—'}</td>
            <td style="padding:6px 10px;color:var(--gray)">${r.unit||'—'}</td>
            <td style="padding:6px 10px">
              <span style="background:${col}20;color:${col};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">
                ${r.interpretation||'—'}
              </span>
            </td>
            <td style="padding:6px 10px;color:var(--gray)">
              ${r.normal_min!==null&&r.normal_max!==null?`${r.normal_min}–${r.normal_max}`:'—'}
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`).join('');
}

function printLabReport(patientName) {
  const results=labResults.filter(r=>r.patient_name===patientName&&['Approved','Released'].includes(r.status));
  const orgName=localStorage.getItem('ol_org_name')||'OneLab Diagnostics';
  const orgAddr=localStorage.getItem('ol_org_addr')||'';
  const c={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'};

  const w=window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Hasil Lab — ${patientName}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;font-size:13px;color:#1A2B3C}
      h2{color:#0A2342;margin:0}
      .header{display:flex;justify-content:space-between;border-bottom:3px solid #0A2342;padding-bottom:14px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#0A2342;color:#fff;padding:8px 12px;text-align:left;font-size:12px}
      td{padding:8px 12px;border-bottom:1px solid #e2e8f0}
      .badge{padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700}
      .footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:14px;font-size:11px;color:#546E7A}
      @media print{button{display:none}}
    </style></head><body>
    <button onclick="window.print()" style="position:fixed;top:16px;right:16px;
      padding:8px 18px;background:#0A2342;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
      🖨 Print
    </button>
    <div class="header">
      <div>
        <h2>${orgName}</h2>
        <div style="font-size:12px;color:#546E7A;margin-top:4px">${orgAddr}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:800;color:#0A2342">HASIL PEMERIKSAAN</div>
        <div style="font-size:12px;color:#546E7A">${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
    </div>
    <div style="background:#F0F4F8;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><span style="font-size:11px;color:#546E7A">NAMA PASIEN</span><br><strong>${patientName}</strong></div>
      <div><span style="font-size:11px;color:#546E7A">NO. KUNJUNGAN</span><br><strong>${results[0]?.visit_number||'—'}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th>Pemeriksaan</th><th>Hasil</th><th>Satuan</th>
        <th>Rentang Normal</th><th>Interpretasi</th>
      </tr></thead>
      <tbody>
      ${results.map(r=>{
        const col=c[r.color_code]||'#94A3B8';
        return `<tr>
          <td><strong>${r.product_name||'—'}</strong></td>
          <td><strong style="color:${col};font-size:15px">${r.result_value||'—'}</strong></td>
          <td style="color:#546E7A">${r.unit||'—'}</td>
          <td style="color:#546E7A">${r.normal_min!==null&&r.normal_max!==null?`${r.normal_min}–${r.normal_max}`:'—'}</td>
          <td><span class="badge" style="background:${col}20;color:${col}">${r.interpretation||'—'}</span></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    <div class="footer">
      <div style="display:flex;justify-content:space-between;margin-top:40px">
        <div>Diperiksa oleh:<br><br><br>__________________________<br><em>${results[0]?.entered_by||'Analis'}</em></div>
        <div style="text-align:center">Divalidasi oleh:<br><br><br>__________________________<br><em>${results[0]?.validated_by||'Validator'}</em></div>
        <div style="text-align:right">Disetujui oleh:<br><br><br>__________________________<br><em>${results[0]?.approved_by||'Dokter'}</em></div>
      </div>
      <div style="margin-top:20px;font-size:10px;color:#94A3B8;text-align:center">
        Dokumen ini digenerate secara elektronik oleh ${orgName} · ${new Date().toLocaleString('id-ID')}
      </div>
    </div>
    </body></html>`);
  w.document.close();
}
