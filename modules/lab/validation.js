// ═══════════════════════════════════════════════════════════════════════════════
// LIS · VALIDASI & APPROVAL BERJENJANG (3-KOLOM LAYOUT)
// - Validasi teknis (analis)     : Draft → Validated
// - AI Conclusion generation     : Triggered on validation
// - Approval klinis (dokter)     : Validated → Approved (Released)
// - Digital signature on approval: PKI-signed for ISO 15189
// - Layout: Sidebar (patients) | Center (results grid) | Right (conclusions/notes)
// - Per-patient bulk action      : Checkbox selection + bulk validate/approve
// ═══════════════════════════════════════════════════════════════════════════════

let _valNotes={};
let _conclusionEngine=null, _auditLogger=null, _pkiService=null;

// ── Pemisahan tab Validasi dan Approval ───────────────────────────────────────
// Kedua tab hidup bersamaan di DOM (disembunyikan display:none, bukan dihapus).
// Sebelumnya keduanya memakai id yang SAMA — val-worklist, val-pbar, val-grid,
// val-notes — sehingga getElementById selalu mengembalikan milik tab Validasi
// yang letaknya lebih dulu. Akibatnya tab Approval tidak pernah terisi, dan
// daftar di tab Validasi tertimpa isi Approval karena dirender belakangan.
// Itulah sebab hasil yang baru diinput "hilang" dari Validasi, dan Approval
// hanya menampilkan nama pasien tanpa satu pun test.
//
// Sekarang tiap tab punya awalan id sendiri dan menyimpan pilihannya sendiri.
// Mode dioper sebagai argumen, tidak lagi ditebak dari style.display — tebakan
// itu salah setiap kali satu tab dirender saat tab lain sedang tampil.
const VAL_MODES = {
  validate: { prefix:'val', status:'validated' },
  approve:  { prefix:'app', status:'approved'  },
};
let _valSelBy     = { validate:null, approve:null };
let _valCheckedBy = { validate:new Set(), approve:new Set() };

function valEl(mode, suffix){
  return document.getElementById(`${VAL_MODES[mode].prefix}-${suffix}`);
}

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

// Rangka tiga kolom dipakai kedua tab, hanya awalan id-nya yang berbeda.
function valPaneHtml(mode){
  const p=VAL_MODES[mode].prefix;
  return `
    <div style="display:grid;grid-template-columns:240px 1fr 260px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff">
      <div id="${p}-worklist" style="border-right:1px solid var(--border);overflow-y:auto;max-height:640px;background:var(--lgray)"></div>
      <div style="display:flex;flex-direction:column;min-width:0">
        <div id="${p}-pbar" style="border-bottom:1px solid var(--border);padding:10px 14px;background:#F8FAFC"></div>
        <div id="${p}-grid" style="overflow:auto;max-height:600px"></div>
        ${mode==='approve' ? `<div id="${p}-concl"></div>` : ''}
      </div>
      <div id="${p}-notes" style="border-left:1px solid var(--border);background:var(--lgray);padding:14px;overflow-y:auto;max-height:640px"></div>
    </div>`;
}

function renderValidationTab(){
  const el=document.getElementById('lab-validation'); if(!el) return;
  const patients=valPatientsByStatus('validated');
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value);
  const unackCrit=toValidate.filter(r=>isCriticalResult(r)&&!r.critical_ack_at).length;
  const checked=_valCheckedBy.validate;

  if(!patients.some(p=>p.admission_id==_valSelBy.validate))
    _valSelBy.validate = patients.length?patients[0].admission_id:null;

  el.innerHTML=`
    <div id="lab-autoverify-panel"></div>
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <span class="badge badge-gold">${toValidate.length} hasil siap divalidasi</span>
        ${unackCrit?`<span class="badge" style="background:#FEF2F2;color:#DC2626;margin-left:6px">🚨 ${unackCrit} kritis belum di-ack</span>`:''}
      </div>
      ${checked.size?`<button class="btn btn-teal btn-sm" onclick="validateSelectedResults()">✅ Validasi ${checked.size} Test</button>`:''}
      ${toValidate.length?`<button class="btn btn-teal btn-sm" style="background:#666" onclick="validateAllResults()">⚡ Validasi Semua (non-kritis)</button>`:''}
    </div>
    ${patients.length?valPaneHtml('validate')
      :`<div class="empty-state"><div class="ico">✅</div><h3>Semua hasil sudah divalidasi</h3></div>`}`;

  if(patients.length){
    renderValWorklist(patients,'validate');
    if(_valSelBy.validate!=null) selectValidationPatient(_valSelBy.validate,'validate');
  }

  // Fase 5.5 — panel autoverifikasi (tidak mengganggu bila tabelnya belum ada)
  if (typeof renderAutoverifyPanel === 'function')
    renderAutoverifyPanel('lab-autoverify-panel', labResults);
}

function renderApprovalTab(){
  const el=document.getElementById('lab-approval'); if(!el) return;
  const patients=valPatientsByStatus('approved');
  const toApprove=labResults.filter(r=>r.status==='Validated');
  const checked=_valCheckedBy.approve;

  if(!patients.some(p=>p.admission_id==_valSelBy.approve))
    _valSelBy.approve = patients.length?patients[0].admission_id:null;

  el.innerHTML=`
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span class="badge badge-purple">${toApprove.length} hasil siap diapprove &amp; rilis</span>
      ${checked.size?`<button class="btn btn-teal btn-sm" onclick="approveSelectedResults()">🔏 Approve ${checked.size} Test</button>`:''}
      ${toApprove.length?`<button class="btn btn-teal btn-sm" style="background:#666" onclick="approveAllResults()">⚡ Approve Semua</button>`:''}
    </div>
    ${patients.length?valPaneHtml('approve')
      :`<div class="empty-state"><div class="ico">✅</div><h3>Semua hasil sudah diapprove</h3></div>`}`;

  if(patients.length){
    renderValWorklist(patients,'approve');
    if(_valSelBy.approve!=null) selectValidationPatient(_valSelBy.approve,'approve');
  }
}

function renderValWorklist(patients, mode){
  const el=valEl(mode,'worklist'); if(!el) return;
  el.innerHTML=patients.map(p=>{
    const filled=p.rows.length;
    const sel=p.admission_id==_valSelBy[mode];
    const crit=p.rows.some(isCriticalResult);
    return `<div onclick="selectValidationPatient(${p.admission_id},'${mode}')"
      style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;${sel?'background:var(--mint);border-left:3px solid var(--teal)':'border-left:3px solid transparent'}">
      <div style="font-weight:700;font-size:13px;color:var(--navy)">${p.patient_name||'—'}${crit?' 🚨':''}</div>
      <div style="font-size:10.5px;color:var(--gray);font-family:monospace">${p.mr_number||''} ${p.visit_number||''}</div>
      <div style="font-size:10px;color:#0EA5E9;font-weight:700;margin-top:2px">${filled} test(s) dgn hasil</div>
    </div>`;
  }).join('') || '<div style="padding:16px;text-align:center;color:var(--gray);font-size:12px">Tidak ada pasien</div>';
}

async function selectValidationPatient(admId, mode='validate'){
  if(!VAL_MODES[mode]) mode='validate';
  _valSelBy[mode]=admId;
  const isApprovalTab = (mode==='approve');
  const patients=valPatientsByStatus(VAL_MODES[mode].status);
  renderValWorklist(patients, mode);

  const drafts=isApprovalTab
    ? labResults.filter(r=>r.status==='Validated' && r.admission_id==admId)
    : labResults.filter(r=>r.status==='Draft' && r.result_value && r.admission_id==admId);

  const admD=await sbGet('admissions',`select=patient_name,patient_gender,patient_age,visit_number,patient_blood_type,mr_number&id=eq.${admId}`).catch(()=>[]);
  const admInfo=admD?.[0]||{};

  const pbar=valEl(mode,'pbar');
  if(pbar) pbar.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <span style="font-size:15px;font-weight:800;color:var(--navy)">${admInfo.patient_name||''}</span>
        ${admInfo.patient_blood_type?`<span style="color:#DC2626;font-weight:800;margin-left:8px">${admInfo.patient_blood_type}</span>`:''}
        <div style="font-size:11px;color:var(--gray);font-family:monospace">${admInfo.mr_number||''} · ${admInfo.visit_number||''}</div>
      </div>
      <div style="display:flex;gap:6px">
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;background:var(--mint);padding:4px 10px;border-radius:6px;cursor:pointer">
          <input type="checkbox" id="${VAL_MODES[mode].prefix}-select-all" onchange="toggleSelectAllVal(this,'${mode}')" style="cursor:pointer;width:16px;height:16px">
          Pilih Semua
        </label>
      </div>
    </div>`;

  const grid=valEl(mode,'grid');
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
        const checked=_valCheckedBy[mode].has(r.id);
        return `<tr data-rid="${r.id}" style="background:${checked?'#EAF5F3':''}">
          <td style="padding:5px 8px;text-align:center"><input type="checkbox" class="val-check" value="${r.id}" ${checked?'checked':''} onchange="toggleValCheck(this,'${mode}')" style="cursor:pointer;width:16px;height:16px"></td>
          <td style="padding:5px 10px;font-weight:600;cursor:pointer" onclick="selectValResult(${r.id},'${mode}')">${r.item_name||r.product_name||'—'}${r.item_code?` <span style="font-size:9px;color:var(--gray);font-family:monospace">${r.item_code}</span>`:''}</td>
          <td style="padding:5px 8px;font-weight:800;color:${col};cursor:pointer" onclick="selectValResult(${r.id},'${mode}')">${r.result_value||'—'}</td>
          <td style="padding:5px 4px;text-align:center">${crit?'<span style="color:#DC2626;font-weight:800">🚨</span>':''}${flag?`<span style="color:${flag==='H'?'#EF4444':'#0EA5E9'};font-weight:800">${flag}</span>`:''}</td>
          <td style="padding:5px 8px;color:var(--gray)">${r.unit||''}</td>
          <td style="padding:5px 8px;color:var(--gray);font-size:11px">${r.normal_min!=null?`${r.normal_min}–${r.normal_max}`:r.interpretation||'—'}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray)">Tidak ada hasil untuk pasien ini</td></tr>'}
      </tbody></table>`;

  const notes=valEl(mode,'notes');
  if(notes) notes.innerHTML=`<div style="font-size:11px;color:var(--gray);text-align:center;padding:24px 8px">Klik sebuah test untuk lihat detail.</div>`;

  // Kesimpulan panel menyeluruh — hanya di tab Approval (dokter).
  if(mode==='approve' && typeof lpiRenderPanel==='function')
    lpiRenderPanel(`${VAL_MODES[mode].prefix}-concl`, admId);
}

function toggleValCheck(cb, mode='validate'){
  if(!VAL_MODES[mode]) mode='validate';
  if(cb.checked) _valCheckedBy[mode].add(parseInt(cb.value));
  else _valCheckedBy[mode].delete(parseInt(cb.value));
}

function toggleSelectAllVal(cb, mode='validate'){
  if(!VAL_MODES[mode]) mode='validate';
  const checks=document.querySelectorAll(`#${VAL_MODES[mode].prefix}-grid .val-check`);
  checks.forEach(c=>{ c.checked=cb.checked; toggleValCheck(c, mode); });
}

function selectValResult(rid, mode='validate'){
  if(!VAL_MODES[mode]) mode='validate';
  const gid=`#${VAL_MODES[mode].prefix}-grid`;
  const tr=document.querySelector(`${gid} tr[data-rid="${rid}"]`); if(!tr) return;
  document.querySelectorAll(`${gid} tr[data-rid]`).forEach(t=>t.style.background='');
  tr.style.background='var(--mint)';
  const r=labResults.find(x=>x.id==rid)||{};
  const notes=valEl(mode,'notes'); if(!notes) return;

  // Kotak sunting kesimpulan hanya muncul di tab Approval (dokter), bukan di
  // tab Validasi (analis). Modenya dioper, tidak lagi ditebak dari style.display.
  const isApprovalTab = (mode==='approve');
  const conclusionSection=r.ai_conclusion?`
    <div style="background:#F0F9FF;border-left:3px solid #0EA5E9;border-radius:6px;padding:10px;margin-bottom:8px;font-size:11px">
      <div style="font-weight:700;color:#0369A1;margin-bottom:4px">✅ AI Conclusion</div>
      <div style="color:var(--navy);line-height:1.4;margin-bottom:6px">${r.ai_conclusion}</div>
      ${isApprovalTab?`
        <textarea id="${VAL_MODES[mode].prefix}-conclusion-edit" rows="3" style="width:100%;font-size:10px;padding:4px;border:1px solid #0EA5E9;border-radius:4px;background:#fff;color:var(--navy)" placeholder="Edit conclusion if needed...">${r.ai_conclusion}</textarea>
        <button onclick="saveConclusionEdit(${rid},'${mode}')" style="margin-top:4px;padding:4px 8px;background:#0EA5E9;color:#fff;border:0;border-radius:4px;font-size:10px;cursor:pointer">📝 Save Edit</button>
      `:''}
    </div>
  `:'';
  
  notes.innerHTML=`
    <div style="font-size:12.5px;font-weight:800;color:var(--navy)">${r.item_name||r.product_name||''}</div>
    <div style="font-size:10.5px;color:var(--gray);margin-bottom:8px">${r.product_name||''}${r.loinc_code?' · LOINC '+r.loinc_code:''}${r.host_code?' · Host '+r.host_code:''}</div>
    <div style="background:#EAF5F3;border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px">
      <div><strong>Hasil:</strong> ${r.result_value||'—'} ${r.unit||''}</div>
      <div><strong>Interpretasi:</strong> <span style="color:${labColor(r.color_code)};font-weight:700">${r.interpretation||'—'}</span></div>
      ${r.normal_min!=null?`<div><strong>Rujukan:</strong> ${r.normal_min}–${r.normal_max}</div>`:''}
      ${isCriticalResult(r)?`<div><strong style="color:#DC2626">🚨 NILAI KRITIS</strong></div>`:''}
    </div>
    ${conclusionSection}
    <label style="font-size:11px;color:var(--gray);font-weight:700">Catatan Validator</label>
    <textarea id="${VAL_MODES[mode].prefix}-note-input" rows="4" style="width:100%;font-size:11px;padding:6px;border:1px solid var(--border);border-radius:6px;margin-top:4px" placeholder="Catatan validasi...">${_valNotes[rid]||''}</textarea>`;
}

async function validateSelectedResults(){
  if(!_valCheckedBy.validate.size){ toast('⚠️ Pilih minimal 1 test','warn'); return; }
  
  // Initialize services on first call
  if(!_conclusionEngine) {
    if(typeof ConclusionEngine !== 'undefined') _conclusionEngine=new ConclusionEngine(supabase);
    if(typeof AuditLogger !== 'undefined') _auditLogger=new AuditLogger(supabase);
  }
  
  const now=new Date().toISOString();
  let ok=0, generated=0;
  
  for(const rid of _valCheckedBy.validate){
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
    
    try { 
      await sbPatch('lab_results',rid,payload); 
      ok++;
      
      // ⭐ NEW: Generate AI conclusion on validation trigger
      if(_conclusionEngine) {
        const prevResult=labResults.find(x=>x.patient_name===r.patient_name && 
                                           x.product_id===r.product_id && 
                                           x.id!==r.id && 
                                           x.status==='Approved');
        const refRange=_rrCache[r.product_id]?.[0];
        
        const conclusion=await _conclusionEngine.generateConclusion(r, prevResult, refRange);
        
        // Save conclusion to DB
        await sbPatch('lab_results',rid,{
          ai_conclusion:conclusion.conclusion,
          conclusion_generated_at:new Date().toISOString(),
          conclusion_generated_by:'system/ai'
        }).catch(e=>console.warn('Failed to save conclusion:',e));
        
        generated++;
        
        // Log to audit trail
        if(_auditLogger) {
          await _auditLogger.logConclusionGenerated(rid, 'system/ai', conclusion.conclusion, 
                                                   conclusion.pattern_used, 
                                                   '127.0.0.1');
        }
      }
      
      // Log validation action
      if(_auditLogger) {
        await _auditLogger.logResultValidated(rid, labUser(), {status:'Draft'}, 
                                            {status:'Validated'}, note, '127.0.0.1');
      }
    } catch(e){
      console.error('Validation error:',e);
    }
  }
  
  if(ok>0){
    toast(`✅ ${ok} hasil tervalidasi${generated>0?` (${generated} conclusion dibuat)`:''}`,'ok');
    _valCheckedBy.validate.clear(); _valNotes={};
    await loadLabResults();
    renderValidationTab(); renderApprovalTab(); renderLabKPI(); renderCriticalBanner();
  }
}

async function validateAllResults(){
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value&&!(isCriticalResult(r)&&!r.critical_ack_at));
  const now=new Date().toISOString();
  for(const r of toValidate){
    await sbPatch('lab_results',r.id,{status:'Validated',validated_by:labUser(),validated_at:now,updated_at:now}).catch(()=>{});
  }
  toast(`✅ ${toValidate.length} hasil tervalidasi`,'ok');
  _valCheckedBy.validate.clear(); _valNotes={};
  await loadLabResults();
  renderValidationTab(); renderApprovalTab(); renderLabKPI();
}

async function approveSelectedResults(){
  if(!_valCheckedBy.approve.size){ toast('⚠️ Pilih minimal 1 test','warn'); return; }
  
  // Initialize services
  if(!_auditLogger && typeof AuditLogger !== 'undefined') _auditLogger=new AuditLogger(supabase);
  if(!_pkiService && typeof PKIService !== 'undefined') _pkiService=new PKIService(supabase);
  
  const now=new Date().toISOString();
  let ok=0;
  
  for(const rid of _valCheckedBy.approve){
    const r=labResults.find(x=>x.id==rid);
    if(!r || r.status!=='Validated') continue;
    
    // Prepare approval payload
    const payload={
      status:'Approved',
      approved_by:labUser(),
      approved_at:now,
      released_by:labUser(),
      released_at:now,
      updated_at:now
    };
    
    // ⭐ NEW: Sign the approval (if PKI available)
    let signature=null;
    if(_pkiService && window.userPrivateKey) {
      try {
        const contentToSign=`APPROVAL|${rid}|${labUser()}|${now}|${r.ai_conclusion||''}`;
        signature=await _pkiService.sign(contentToSign, window.userPrivateKey);
        payload.digital_signature=signature;
        payload.signature_timestamp=now;
      } catch(e) {
        console.warn('Signature failed, continuing without it:',e);
      }
    }
    
    try { 
      await sbPatch('lab_results',rid,payload); 
      ok++;
      
      // Log approval with signature
      if(_auditLogger) {
        await _auditLogger.logResultApproved(rid, labUser(), signature, 
                                           {status:'Validated'}, 
                                           {status:'Approved'}, 
                                           'Doctor approval and release', 
                                           '127.0.0.1');
      }
    } catch(e){
      console.error('Approval error:',e);
    }
  }
  
  if(ok>0){
    toast(`✅ ${ok} hasil approved & rilis${signature?' (ditandatangani)':''}`,'ok');
    _valCheckedBy.approve.clear(); _valNotes={};
    await loadLabResults();
    renderApprovalTab(); renderLabKPI();
  }
}

async function approveAllResults(){
  if(!_auditLogger && typeof AuditLogger !== 'undefined') _auditLogger=new AuditLogger(supabase);
  if(!_pkiService && typeof PKIService !== 'undefined') _pkiService=new PKIService(supabase);
  
  const toApprove=labResults.filter(r=>r.status==='Validated');
  const now=new Date().toISOString();
  let ok=0;
  
  for(const r of toApprove){
    const payload={status:'Approved',approved_by:labUser(),approved_at:now,released_by:labUser(),released_at:now,updated_at:now};
    
    let signature=null;
    if(_pkiService && window.userPrivateKey) {
      try {
        const contentToSign=`APPROVAL|${r.id}|${labUser()}|${now}|${r.ai_conclusion||''}`;
        signature=await _pkiService.sign(contentToSign, window.userPrivateKey);
        payload.digital_signature=signature;
        payload.signature_timestamp=now;
      } catch(e) {
        console.warn('Signature failed:',e);
      }
    }
    
    try {
      await sbPatch('lab_results',r.id,payload);
      ok++;
      
      if(_auditLogger) {
        await _auditLogger.logResultApproved(r.id, labUser(), signature, {status:'Validated'}, 
                                           {status:'Approved'}, 'Bulk approval', '127.0.0.1');
      }
    } catch(e){}
  }
  
  toast(`✅ ${ok} hasil approved & rilis`,'ok');
  _valCheckedBy.approve.clear(); _valNotes={};
  await loadLabResults();
  renderApprovalTab(); renderLabKPI();
}

// ⭐ NEW: Save edited conclusion
async function saveConclusionEdit(rid, mode='approve') {
  if(!VAL_MODES[mode]) mode='approve';
  const textarea=valEl(mode,'conclusion-edit');
  if(!textarea) return;
  const editedConclusion=textarea.value.trim();
  
  const r=labResults.find(x=>x.id==rid);
  if(!r) return;
  
  const originalConclusion=r.ai_conclusion;
  
  try {
    await sbPatch('lab_results',rid,{
      ai_conclusion:editedConclusion,
      conclusion_modified:true,
      conclusion_modified_at:new Date().toISOString(),
      conclusion_modified_by:labUser()
    });
    
    // Log edit
    if(_auditLogger) {
      await _auditLogger.logConclusionEdited(rid, labUser(), originalConclusion, 
                                           editedConclusion, 'Doctor revision', '127.0.0.1');
    }
    
    toast('✅ Conclusion saved','ok');
    await loadLabResults();
    selectValResult(rid, mode);
  } catch(e) {
    toast('❌ Save failed: '+e.message,'error');
  }
}
