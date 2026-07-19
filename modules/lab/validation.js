// ═══════════════════════════════════════════════════════════════════════════════
// LIS · VALIDASI & APPROVAL BERJENJANG (3-KOLOM LAYOUT)
// - Validasi teknis (analis)     : Draft → Validated
// - AI Conclusion generation     : Triggered on validation
// - Approval klinis (dokter)     : Validated → Approved (Released)
// - Digital signature on approval: PKI-signed for ISO 15189
// - Layout: Sidebar (pasien) | Tengah (grid hasil + bilah aksi) | Kanan (detail/kesimpulan)
//
// ── Model aksi (tanpa centang) ────────────────────────────────────────────────
// Tidak ada lagi centang per-baris. Aksi berlaku PER PASIEN lewat bilah tombol di
// bawah grid. Aturannya sederhana dan cocok dengan cara kerja lab:
//   · Test yang SUDAH ADA HASILNYA ikut divalidasi.
//   · Test yang MASIH KOSONG tertahan — tetap Draft, tidak maju.
//   · Nilai KRITIS yang belum dilapor (acknowledge) juga tertahan demi keselamatan.
// ═══════════════════════════════════════════════════════════════════════════════

let _valNotes={};

// Catatan: modul ConclusionEngine/AuditLogger/PKIService di js/core dibangun untuk
// klien supabase-js (this.db.from().select()) yang TIDAK ada di aplikasi ini —
// aplikasi memakai REST helper (sbGet/sbPost). Karena itu ketiganya tidak pernah
// berfungsi di sini, dan mereferensikannya justru melempar "supabase is not defined"
// sehingga tombol Validasi/Approve gagal. Jejak audit di sini memakai logActivity()
// milik aplikasi, yang menulis ke activity_logs (dibaca oleh layar Jejak Audit).

// ── Pemisahan tab Validasi dan Approval ───────────────────────────────────────
// Kedua tab hidup bersamaan di DOM (disembunyikan display:none, bukan dihapus).
// Karena itu tiap tab memakai awalan id sendiri (val- vs app-) dan menyimpan
// pilihan pasiennya sendiri; mode dioper sebagai argumen, tidak ditebak dari DOM.
const VAL_MODES = {
  validate: { prefix:'val', status:'validated' },
  approve:  { prefix:'app', status:'approved'  },
};
let _valSelBy = { validate:null, approve:null };

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
        <div id="${p}-grid" style="overflow:auto;max-height:520px"></div>
        <div id="${p}-actionbar" style="border-top:1px solid var(--border);background:#fff"></div>
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

  if(!patients.some(p=>p.admission_id==_valSelBy.validate))
    _valSelBy.validate = patients.length?patients[0].admission_id:null;

  el.innerHTML=`
    <div id="lab-autoverify-panel"></div>
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <span class="badge badge-gold">${toValidate.length} hasil siap divalidasi</span>
        ${unackCrit?`<span class="badge" style="background:#FEF2F2;color:#DC2626;margin-left:6px">🚨 ${unackCrit} kritis belum di-ack</span>`:''}
      </div>
      ${toValidate.length?`<button class="btn btn-ghost btn-sm" onclick="validateAllResults()">⚡ Validasi Semua Pasien (non-kritis)</button>`:''}
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

  if(!patients.some(p=>p.admission_id==_valSelBy.approve))
    _valSelBy.approve = patients.length?patients[0].admission_id:null;

  el.innerHTML=`
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span class="badge badge-purple">${toApprove.length} hasil siap diapprove &amp; rilis</span>
      ${toApprove.length?`<button class="btn btn-ghost btn-sm" onclick="approveAllResults()">⚡ Approve Semua Pasien</button>`:''}
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

  // Di tab Validasi tampilkan SELURUH test Draft pasien — termasuk yang masih
  // kosong — agar terlihat mana yang tertahan. Di tab Approval hanya yang sudah
  // Validated.
  const rows=isApprovalTab
    ? labResults.filter(r=>r.status==='Validated' && r.admission_id==admId)
    : labResults.filter(r=>r.status==='Draft' && r.admission_id==admId);

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
    </div>`;

  const grid=valEl(mode,'grid');
  if(grid) grid.innerHTML=`
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--lgray);position:sticky;top:0;z-index:1">
        <th style="padding:6px 10px;text-align:left">Test Name</th>
        <th style="padding:6px 8px;text-align:left;width:110px">Result</th>
        <th style="padding:6px 4px;width:36px">Flag</th>
        <th style="padding:6px 8px;text-align:left;width:64px">Unit</th>
        <th style="padding:6px 8px;text-align:left;width:110px">Reference</th>
      </tr></thead><tbody>
      ${rows.length ? rows.map(r=>{
        const kosong=!r.result_value;
        const col=labColor(r.color_code);
        const crit=isCriticalResult(r);
        const flag=r.result_numeric!=null&&r.normal_max!=null&&r.result_numeric>r.normal_max?'H'
                  :r.result_numeric!=null&&r.normal_min!=null&&r.result_numeric<r.normal_min?'L':'';
        const held=kosong || (crit && !r.critical_ack_at);
        return `<tr data-rid="${r.id}" style="${kosong?'opacity:.55':''}">
          <td style="padding:5px 10px;font-weight:600;cursor:pointer" onclick="selectValResult(${r.id},'${mode}')">${r.item_name||r.product_name||'—'}${r.item_code?` <span style="font-size:9px;color:var(--gray);font-family:monospace">${r.item_code}</span>`:''}
            ${held?`<span style="font-size:9px;font-weight:700;color:#B45309;background:#FEF3C7;padding:1px 6px;border-radius:10px;margin-left:6px">${kosong?'menunggu hasil':'kritis belum dilapor'} · tertahan</span>`:''}</td>
          <td style="padding:5px 8px;font-weight:800;color:${col};cursor:pointer" onclick="selectValResult(${r.id},'${mode}')">${r.result_value||'—'}</td>
          <td style="padding:5px 4px;text-align:center">${crit?'<span style="color:#DC2626;font-weight:800">🚨</span>':''}${flag?`<span style="color:${flag==='H'?'#EF4444':'#0EA5E9'};font-weight:800">${flag}</span>`:''}</td>
          <td style="padding:5px 8px;color:var(--gray)">${r.unit||''}</td>
          <td style="padding:5px 8px;color:var(--gray);font-size:11px">${r.normal_min!=null?`${r.normal_min}–${r.normal_max}`:r.interpretation||'—'}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray)">Tidak ada hasil untuk pasien ini</td></tr>`}
      </tbody></table>`;

  const notes=valEl(mode,'notes');
  if(notes) notes.innerHTML=`<div style="font-size:11px;color:var(--gray);text-align:center;padding:24px 8px">Klik sebuah test untuk lihat detail.</div>`;

  // Bilah aksi per pasien di bawah grid.
  renderValActionBar(mode, admId, rows);

  // Kesimpulan panel menyeluruh — hanya di tab Approval (dokter).
  if(mode==='approve' && typeof lpiRenderPanel==='function')
    lpiRenderPanel(`${VAL_MODES[mode].prefix}-concl`, admId);
}

// ── Bilah aksi di bawah grid ──────────────────────────────────
function renderValActionBar(mode, admId, rows){
  const bar=valEl(mode,'actionbar'); if(!bar) return;

  if(mode==='validate'){
    const withRes = rows.filter(r=>r.result_value);
    const empties = rows.length - withRes.length;
    const heldCrit = withRes.filter(r=>isCriticalResult(r)&&!r.critical_ack_at).length;
    const eligible = withRes.length - heldCrit;
    const infoBits=[];
    if(empties)  infoBits.push(`${empties} kosong tertahan`);
    if(heldCrit) infoBits.push(`${heldCrit} kritis belum dilapor`);

    bar.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;flex-wrap:wrap">
        <div style="font-size:11.5px;color:var(--gray)">
          ${eligible} hasil siap divalidasi${infoBits.length?` · <span style="color:#B45309">${infoBits.join(' · ')}</span>`:''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="printPatientResults(${admId},'validate')">🖨️ Cetak Sementara</button>
          <button class="btn btn-teal btn-sm" ${eligible?'':'disabled'} onclick="validatePatientResults(${admId})">✓ Validasi Hasil</button>
        </div>
      </div>`;
  } else {
    bar.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;flex-wrap:wrap">
        <div style="font-size:11.5px;color:var(--gray)">${rows.length} hasil siap diapprove &amp; rilis</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="printPatientResults(${admId},'approve')">🖨️ Cetak</button>
          <button class="btn btn-teal btn-sm" ${rows.length?'':'disabled'} onclick="approvePatientResults(${admId})">🔏 Approve &amp; Rilis</button>
        </div>
      </div>`;
  }
}

function selectValResult(rid, mode='validate'){
  if(!VAL_MODES[mode]) mode='validate';
  const gid=`#${VAL_MODES[mode].prefix}-grid`;
  const tr=document.querySelector(`${gid} tr[data-rid="${rid}"]`); if(!tr) return;
  document.querySelectorAll(`${gid} tr[data-rid]`).forEach(t=>t.style.background='');
  tr.style.background='var(--mint)';
  const r=labResults.find(x=>x.id==rid)||{};
  const notes=valEl(mode,'notes'); if(!notes) return;

  // Kotak sunting kesimpulan per-test hanya di tab Approval (dokter).
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
    <textarea id="${VAL_MODES[mode].prefix}-note-input" rows="4" style="width:100%;font-size:11px;padding:6px;border:1px solid var(--border);border-radius:6px;margin-top:4px" placeholder="Catatan validasi..." onchange="_valNotes[${rid}]=this.value">${_valNotes[rid]||''}</textarea>`;
}

// ── Validasi seluruh hasil satu pasien ────────────────────────
// Yang ada hasilnya divalidasi; yang kosong / kritis-belum-dilapor tertahan.
async function validatePatientResults(admId){
  const drafts=labResults.filter(r=>r.status==='Draft' && r.result_value && r.admission_id==admId);
  if(!drafts.length){ toast('Tidak ada hasil untuk divalidasi','warn'); return; }

  const now=new Date().toISOString();
  let ok=0, held=0;

  for(const r of drafts){
    if(isCriticalResult(r) && !r.critical_ack_at){ held++; continue; }   // kritis ditahan
    const note=_valNotes[r.id];
    const payload={status:'Validated',validated_by:labUser(),validated_at:now,updated_at:now};
    if(note) payload.validation_notes=note;
    try{
      await sbPatch('lab_results',r.id,payload); ok++;
      if(typeof logActivity==='function')
        logActivity('validated','lab_results',r.id,`Hasil ${r.item_name||r.product_name||''} divalidasi`,r.patient_name);
    }catch(e){ console.error('Validation error:',e); }
  }

  _valNotes={};
  toast(held ? `✅ ${ok} divalidasi · ${held} kritis tertahan (Lapor dulu di banner)` : `✅ ${ok} hasil tervalidasi`, held?'warn':'ok');
  await loadLabResults();
  renderValidationTab(); renderApprovalTab(); renderLabKPI(); renderCriticalBanner();
}

// Validasi lintas SEMUA pasien (non-kritis) — kemudahan untuk lab sibuk.
async function validateAllResults(){
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value&&!(isCriticalResult(r)&&!r.critical_ack_at));
  if(!toValidate.length){ toast('Tidak ada hasil non-kritis untuk divalidasi','warn'); return; }
  const now=new Date().toISOString();
  for(const r of toValidate){
    await sbPatch('lab_results',r.id,{status:'Validated',validated_by:labUser(),validated_at:now,updated_at:now}).catch(()=>{});
  }
  toast(`✅ ${toValidate.length} hasil tervalidasi`,'ok');
  _valNotes={};
  await loadLabResults();
  renderValidationTab(); renderApprovalTab(); renderLabKPI();
}

// ── Approve & rilis seluruh hasil satu pasien ─────────────────
async function approvePatientResults(admId){
  const rows=labResults.filter(r=>r.status==='Validated' && r.admission_id==admId);
  if(!rows.length){ toast('Tidak ada hasil untuk diapprove','warn'); return; }

  // Simpan & konfirmasi kesimpulan panel (bila dokter mengisinya) SEBELUM reload,
  // selagi textarea masih ada di DOM. Approval oleh dokter = konfirmasi kesimpulan.
  let conclSaved=false;
  if(typeof lpiSaveConclusion==='function') conclSaved=await lpiSaveConclusion(admId,{confirm:true});

  const now=new Date().toISOString();
  let ok=0;

  for(const r of rows){
    const payload={status:'Approved',approved_by:labUser(),approved_at:now,released_by:labUser(),released_at:now,updated_at:now};
    try{
      await sbPatch('lab_results',r.id,payload); ok++;
      if(typeof logActivity==='function')
        logActivity('approved','lab_results',r.id,`Hasil ${r.item_name||r.product_name||''} disetujui & dirilis`,r.patient_name);
    }catch(e){ console.error('Approval error:',e); }
  }

  toast(`✅ ${ok} hasil approved & rilis${conclSaved?' · kesimpulan dikonfirmasi':''}`,'ok');
  await loadLabResults();
  renderApprovalTab(); renderLabKPI();
}

// Approve lintas SEMUA pasien.
async function approveAllResults(){
  const toApprove=labResults.filter(r=>r.status==='Validated');
  if(!toApprove.length){ toast('Tidak ada hasil untuk diapprove','warn'); return; }
  const now=new Date().toISOString();
  let ok=0;
  for(const r of toApprove){
    const payload={status:'Approved',approved_by:labUser(),approved_at:now,released_by:labUser(),released_at:now,updated_at:now};
    try{
      await sbPatch('lab_results',r.id,payload); ok++;
      if(typeof logActivity==='function')
        logActivity('approved','lab_results',r.id,`Hasil ${r.item_name||r.product_name||''} disetujui & dirilis`,r.patient_name);
    }catch(e){}
  }
  toast(`✅ ${ok} hasil approved & rilis`,'ok');
  await loadLabResults();
  renderApprovalTab(); renderLabKPI();
}

// ── Cetak hasil satu pasien ───────────────────────────────────
// Validasi → cetak sementara (draf/validated). Approval → cetak final.
function printPatientResults(admId, mode){
  const statusSet = mode==='approve' ? ['Validated','Approved','Released'] : ['Draft','Validated','Approved'];
  const rows=labResults.filter(r=>r.admission_id==admId && r.result_value && statusSet.includes(r.status));
  if(!rows.length){ toast('Tidak ada hasil untuk dicetak','warn'); return; }
  const p=rows[0]||{};
  if(typeof printLabReport==='function') printLabReport(p.patient_name, p.visit_number, rows);
  else toast('Fungsi cetak tidak tersedia','err');
}

// ── Simpan suntingan kesimpulan per-test ──────────────────────
async function saveConclusionEdit(rid, mode='approve') {
  if(!VAL_MODES[mode]) mode='approve';
  const textarea=valEl(mode,'conclusion-edit');
  if(!textarea) return;
  const editedConclusion=textarea.value.trim();

  const r=labResults.find(x=>x.id==rid);
  if(!r) return;

  try {
    await sbPatch('lab_results',rid,{
      ai_conclusion:editedConclusion,
      conclusion_modified:true,
      conclusion_modified_at:new Date().toISOString(),
      conclusion_modified_by:labUser()
    });
    if(typeof logActivity==='function')
      logActivity('conclusion_edit','lab_results',rid,`Kesimpulan ${r.item_name||r.product_name||''} disunting`,r.patient_name);
    toast('✅ Kesimpulan tersimpan','ok');
    await loadLabResults();
    selectValResult(rid, mode);
  } catch(e) {
    toast('❌ Gagal menyimpan: '+e.message,'err');
  }
}
