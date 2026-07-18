// ═══════════════════════════════════════════════════════════════
// LIS · VALIDASI & APPROVAL BERJENJANG (3-KOLOM LAYOUT)
// - Validasi teknis (analis)  : Draft → Validated
// - Approval klinis (dokter)  : Validated → Approved (Released)
// - Layout: Sidebar kiri (pasien list) | Center (hasil grid) | Right (notes/detail)
// - Per-patient bulk action: checkbox selection + bulk validate/approve
// ═══════════════════════════════════════════════════════════════

let _valSel=null, _valChecked=new Set(), _valNotes={};

function valPatientsByStatus(targetStatus){
  const byAdm={};
  labResults.filter(r=>{
    if(targetStatus==='validated') return r.status==='Draft' && r.result_value;
    if(targetStatus==='approved')  return r.status==='Validated';
    return false;
  }).forEach(r=>{
    const k=r.admission_id;
    if(!byAdm[k]) byAdm[k]={admission_id:r.admission_id,patient_name:r.patient_name,
      visit_number:r.visit_number,mr_number:r.mr_number,rows:[]};
    byAdm[k].rows.push(r);
  });
  return Object.values(byAdm);
}

function renderValidationTab(){
  const el=document.getElementById('lab-validation'); if(!el) return;
  const patients=valPatientsByStatus('validated');
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value);
  const unackCrit=toValidate.filter(r=>isCriticalResult(r)&&!r.critical_ack_at).length;
  
  if(!patients.some(p=>p.admission_id==_valSel)) _valSel = patients.length?patients[0].admission_id:null;

  el.innerHTML=`
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <span class="badge badge-gold">${toValidate.length} hasil siap divalidasi</span>
        ${unackCrit?`<span class="badge" style="background:#FEF2F2;color:#DC2626;margin-left:6px">🚨 ${unackCrit} kritis belum di-ack</span>`:''}
      </div>
      ${_valChecked.size?`<button class="btn btn-teal btn-sm" onclick="validateSelectedResults()">✅ Validasi ${_valChecked.size} Test</button>`:''}
      ${toValidate.length?`<button class="btn btn-teal btn-sm" style="background:#666" onclick="validateAllResults()">⚡ Validasi Semua (non-kritis)</button>`:''}
    </div>
    ${patients.length?`
    <div style="display:grid;grid-template-columns:240px 1fr 260px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff">
      <div id="val-worklist" style="border-right:1px solid var(--border);overflow-y:auto;max-height:640px;background:var(--lgray)"></div>
      <div style="display:flex;flex-direction:column;min-width:0">
        <div id="val-pbar" style="border-bottom:1px solid var(--border);padding:10px 14px;background:#F8FAFC"></div>
        <div id="val-grid" style="overflow:auto;max-height:600px"></div>
      </div>
      <div id="val-notes" style="border-left:1px solid var(--border);background:var(--lgray);padding:14px;overflow-y:auto;max-height:640px"></div>
    </div>`:`<div class="empty-state"><div class="ico">✅</div><h3>Semua hasil sudah divalidasi</h3></div>`}`;

  if(patients.length){
    renderValWorklist(patients);
    if(_valSel!=null) selectValidationPatient(_valSel);
  }
}

function renderApprovalTab(){
  const el=document.getElementById('lab-approval'); if(!el) return;
  const patients=valPatientsByStatus('approved');
  const toApprove=labResults.filter(r=>r.status==='Validated');
  
  if(!patients.some(p=>p.admission_id==_valSel)) _valSel = patients.length?patients[0].admission_id:null;

  el.innerHTML=`
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span class="badge badge-purple">${toApprove.length} hasil siap diapprove &amp; rilis</span>
      ${_valChecked.size?`<button class="btn btn-teal btn-sm" onclick="approveSelectedResults()">🔏 Approve ${_valChecked.size} Test</button>`:''}
      ${toApprove.length?`<button class="btn btn-teal btn-sm" style="background:#666" onclick="approveAllResults()">⚡ Approve Semua</button>`:''}
    </div>
    ${patients.length?`
    <div style="display:grid;grid-template-columns:240px 1fr 260px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff">
      <div id="val-worklist" style="border-right:1px solid var(--border);overflow-y:auto;max-height:640px;background:var(--lgray)"></div>
      <div style="display:flex;flex-direction:column;min-width:0">
        <div id="val-pbar" style="border-bottom:1px solid var(--border);padding:10px 14px;background:#F8FAFC"></div>
        <div id="val-grid" style="overflow:auto;max-height:600px"></div>
      </div>
      <div id="val-notes" style="border-left:1px solid var(--border);background:var(--lgray);padding:14px;overflow-y:auto;max-height:640px"></div>
    </div>`:`<div class="empty-state"><div class="ico">✅</div><h3>Semua hasil sudah diapprove</h3></div>`}`;

  if(patients.length){
    renderValWorklist(patients);
    if(_valSel!=null) selectValidationPatient(_valSel);
  }
}

function renderValWorklist(patients){
  const el=document.getElementById('val-worklist'); if(!el) return;
  el.innerHTML=patients.map(p=>{
    const filled=p.rows.length;
    const sel=p.admission_id==_valSel;
    const crit=p.rows.some(isCriticalResult);
    return `<div onclick="selectValidationPatient(${p.admission_id})"
      style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;${sel?'background:var(--mint);border-left:3px solid var(--teal)':'border-left:3px solid transparent'}">
      <div style="font-weight:700;font-size:13px;color:var(--navy)">${p.patient_name||'—'}${crit?' 🚨':''}</div>
      <div style="font-size:10.5px;color:var(--gray);font-family:monospace">${p.mr_number||''} ${p.visit_number||''}</div>
      <div style="font-size:10px;color:#0EA5E9;font-weight:700;margin-top:2px">${filled} test(s) dgn hasil</div>
    </div>`;
  }).join('') || '<div style="padding:16px;text-align:center;color:var(--gray);font-size:12px">Tidak ada pasien</div>';
}

async function selectValidationPatient(admId){
  _valSel=admId;
  const isApprovalTab=document.getElementById('lab-approval').style.display !== 'none';
  const patients=valPatientsByStatus(isApprovalTab?'approved':'validated');
  renderValWorklist(patients);
  
  const drafts=isApprovalTab
    ? labResults.filter(r=>r.status==='Validated' && r.admission_id==admId)
    : labResults.filter(r=>r.status==='Draft' && r.result_value && r.admission_id==admId);

  const admD=await sbGet('admissions',`select=patient_name,patient_gender,patient_age,visit_number,patient_blood_type,mr_number&id=eq.${admId}`).catch(()=>[]);
  const admInfo=admD?.[0]||{};

  const pbar=document.getElementById('val-pbar');
  if(pbar) pbar.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <span style="font-size:15px;font-weight:800;color:var(--navy)">${admInfo.patient_name||''}</span>
        ${admInfo.patient_blood_type?`<span style="color:#DC2626;font-weight:800;margin-left:8px">${admInfo.patient_blood_type}</span>`:''}
        <div style="font-size:11px;color:var(--gray);font-family:monospace">${admInfo.mr_number||''} · ${admInfo.visit_number||''}</div>
      </div>
      <div style="display:flex;gap:6px">
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;background:var(--mint);padding:4px 10px;border-radius:6px;cursor:pointer">
          <input type="checkbox" id="val-select-all" onchange="toggleSelectAllVal(this)" style="cursor:pointer;width:16px;height:16px">
          Pilih Semua
        </label>
      </div>
    </div>`;

  const grid=document.getElementById('val-grid');
  if(grid) grid.innerHTML=`
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--lgray);position:sticky;top:0;z-index:1">
        <th style="padding:6px 8px;width:36px"><input type="checkbox" class="val-check-all" style="cursor:pointer;width:16px;height:16px"></th>
        <th style="padding:6px 10px;text-align:left">Test Name</th>
        <th style="padding:6px 8px;text-align:left;width:110px">Result</th>
        <th style="padding:6px 4px;width:36px">Flag</th>
        <th style="padding:6px 8px;text-align:left;width:64px">Unit</th>
        <th style="padding:6px 8px;text-align:left;width:110px">Reference</th>
      </tr></thead><tbody>
      ${drafts.length ? drafts.map(r=>{
        const col=labColor(r.color_code);
        const crit=isCriticalResult(r);
        const flag=r.result_numeric!=null&&r.normal_max!=null&&r.result_numeric>r.normal_max?'H'
                  :r.result_numeric!=null&&r.normal_min!=null&&r.result_numeric<r.normal_min?'L':'';
        const checked=_valChecked.has(r.id);
        return `<tr data-rid="${r.id}" style="background:${checked?'#EAF5F3':''}">
          <td style="padding:5px 8px;text-align:center"><input type="checkbox" class="val-check" value="${r.id}" ${checked?'checked':''} onchange="toggleValCheck(this)" style="cursor:pointer;width:16px;height:16px"></td>
          <td style="padding:5px 10px;font-weight:600;cursor:pointer" onclick="selectValResult(${r.id})">${r.item_name||r.product_name||'—'}${r.item_code?` <span style="font-size:9px;color:var(--gray);font-family:monospace">${r.item_code}</span>`:''}</td>
          <td style="padding:5px 8px;font-weight:800;color:${col};cursor:pointer" onclick="selectValResult(${r.id})">${r.result_value||'—'}</td>
          <td style="padding:5px 4px;text-align:center">${crit?'<span style="color:#DC2626;font-weight:800">🚨</span>':''}${flag?`<span style="color:${flag==='H'?'#EF4444':'#0EA5E9'};font-weight:800">${flag}</span>`:''}</td>
          <td style="padding:5px 8px;color:var(--gray)">${r.unit||''}</td>
          <td style="padding:5px 8px;color:var(--gray);font-size:11px">${r.normal_min!=null?`${r.normal_min}–${r.normal_max}`:r.interpretation||'—'}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray)">Tidak ada hasil untuk pasien ini</td></tr>'}
      </tbody></table>`;

  const notes=document.getElementById('val-notes');
  if(notes) notes.innerHTML=`<div style="font-size:11px;color:var(--gray);text-align:center;padding:24px 8px">Klik sebuah test untuk lihat detail.</div>`;
}

function toggleValCheck(cb){
  if(cb.checked) _valChecked.add(parseInt(cb.value));
  else _valChecked.delete(parseInt(cb.value));
}

function toggleSelectAllVal(cb){
  const checks=document.querySelectorAll('#val-grid .val-check');
  checks.forEach(c=>{ c.checked=cb.checked; toggleValCheck(c); });
}

function selectValResult(rid){
  const tr=document.querySelector(`#val-grid tr[data-rid="${rid}"]`); if(!tr) return;
  document.querySelectorAll('#val-grid tr[data-rid]').forEach(t=>t.style.background='');
  tr.style.background='var(--mint)';
  const r=labResults.find(x=>x.id==rid)||{};
  const notes=document.getElementById('val-notes'); if(!notes) return;
  notes.innerHTML=`
    <div style="font-size:12.5px;font-weight:800;color:var(--navy)">${r.item_name||r.product_name||''}</div>
    <div style="font-size:10.5px;color:var(--gray);margin-bottom:8px">${r.product_name||''}${r.loinc_code?' · LOINC '+r.loinc_code:''}${r.host_code?' · Host '+r.host_code:''}</div>
    <div style="background:#EAF5F3;border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px">
      <div><strong>Hasil:</strong> ${r.result_value||'—'} ${r.unit||''}</div>
      <div><strong>Interpretasi:</strong> <span style="color:${labColor(r.color_code)};font-weight:700">${r.interpretation||'—'}</span></div>
      ${r.normal_min!=null?`<div><strong>Rujukan:</strong> ${r.normal_min}–${r.normal_max}</div>`:''}
      ${isCriticalResult(r)?`<div><strong style="color:#DC2626">🚨 NILAI KRITIS</strong></div>`:''}
    </div>
    <label style="font-size:11px;color:var(--gray);font-weight:700">Catatan Validator</label>
    <textarea id="val-note-input" rows="4" style="width:100%;font-size:11px;padding:6px;border:1px solid var(--border);border-radius:6px;margin-top:4px" placeholder="Catatan validasi...">${_valNotes[rid]||''}</textarea>`;
}

async function validateSelectedResults(){
  if(!_valChecked.size){ toast('⚠️ Pilih minimal 1 test','warn'); return; }
  const now=new Date().toISOString();
  let ok=0;
  for(const rid of _valChecked){
    const r=labResults.find(x=>x.id==rid);
    if(!r || r.status!=='Draft') continue;
    const crit=isCriticalResult(r);
    if(crit && !r.critical_ack_at){ 
      toast(`⚠️ ${r.product_name}: nilai kritis belum di-acknowledge`,'warn');
      continue;
    }
    const note=_valNotes[rid];
    const payload={status:'Validated',validated_by:labUser(),validated_at:now,updated_at:now};
    if(note) payload.validation_notes=note;
    try { await sbPatch('lab_results',rid,payload); ok++; } catch(e){}
  }
  if(ok>0){
    toast(`✅ ${ok} hasil tervalidasi`,'ok');
    _valChecked.clear(); _valNotes={};
    await loadLabResults();
    renderValidationTab(); renderLabKPI(); renderCriticalBanner();
  }
}

async function validateAllResults(){
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value&&!(isCriticalResult(r)&&!r.critical_ack_at));
  const now=new Date().toISOString();
  for(const r of toValidate){
    await sbPatch('lab_results',r.id,{status:'Validated',validated_by:labUser(),validated_at:now,updated_at:now}).catch(()=>{});
  }
  toast(`✅ ${toValidate.length} hasil tervalidasi`,'ok');
  _valChecked.clear(); _valNotes={};
  await loadLabResults();
  renderValidationTab(); renderApprovalTab(); renderLabKPI();
}

async function approveSelectedResults(){
  if(!_valChecked.size){ toast('⚠️ Pilih minimal 1 test','warn'); return; }
  const now=new Date().toISOString();
  let ok=0;
  for(const rid of _valChecked){
    const r=labResults.find(x=>x.id==rid);
    if(!r || r.status!=='Validated') continue;
    const payload={status:'Approved',approved_by:labUser(),approved_at:now,released_by:labUser(),released_at:now,updated_at:now};
    try { await sbPatch('lab_results',rid,payload); ok++; } catch(e){}
  }
  if(ok>0){
    toast(`✅ ${ok} hasil approved & rilis`,'ok');
    _valChecked.clear(); _valNotes={};
    await loadLabResults();
    renderApprovalTab(); renderLabKPI();
  }
}

async function approveAllResults(){
  const toApprove=labResults.filter(r=>r.status==='Validated');
  const now=new Date().toISOString();
  for(const r of toApprove){
    await sbPatch('lab_results',r.id,{status:'Approved',approved_by:labUser(),approved_at:now,released_by:labUser(),released_at:now,updated_at:now}).catch(()=>{});
  }
  toast(`✅ ${toApprove.length} hasil approved & rilis`,'ok');
  _valChecked.clear(); _valNotes={};
  await loadLabResults();
  renderApprovalTab(); renderLabKPI();
}
