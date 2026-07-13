// ═══════════════════════════════════════════════════════════════
// LIS · INPUT HASIL (Result Entry)
// - Input manual + auto-interpretasi rentang rujukan
// - Deteksi nilai kritis (panic value)
// - Delta check: bandingkan dengan hasil sebelumnya pasien
// ═══════════════════════════════════════════════════════════════

function renderResultTab(){
  const el=document.getElementById('lab-result'); if(!el) return;
  const drafts=labResults.filter(r=>r.status==='Draft');

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <span class="badge badge-gray" style="margin-right:6px">${drafts.length} hasil dalam proses input</span>
        <span style="font-size:12px;color:var(--gray)">Hasil analyzer masuk otomatis bila terintegrasi (HL7/ASTM)</span>
      </div>
      <button class="btn btn-teal btn-sm" onclick="openResultForm()">+ Input Manual</button>
    </div>
    <div class="table-wrap">
      <table><thead><tr>
        <th>Pasien</th><th>Tes</th><th>Hasil</th><th>Unit</th>
        <th>Interpretasi</th><th>Sumber</th><th>Status</th><th>Aksi</th>
      </tr></thead><tbody>
      ${drafts.length ? drafts.map(r=>{
        const c=labColor(r.color_code);
        const crit=isCriticalResult(r);
        return `<tr>
          <td><div style="font-weight:600">${r.patient_name||'—'}</div>
              <div style="font-size:10px;color:var(--gray)">${r.visit_number||'—'}</div></td>
          <td style="font-size:12px">${r.product_name||'—'}</td>
          <td>${r.result_value
              ? `<span style="font-size:14px;font-weight:800;color:${c}">${r.result_value}</span>${crit?' <span title="Nilai kritis">🚨</span>':''}`
              : `<button class="btn btn-teal btn-xs" onclick="openResultForm(${r.id})">Input</button>`}</td>
          <td style="font-size:11px;color:var(--gray)">${r.unit||'—'}</td>
          <td>${r.interpretation?`<span style="background:${c}20;color:${c};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${r.interpretation}</span>`:'—'}</td>
          <td style="font-size:11px">${r.is_auto?'<span class="badge badge-teal">Auto</span>':'<span class="badge badge-gray">Manual</span>'}</td>
          <td><span style="background:#FFF8E1;color:#92400E;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${r.status}</span></td>
          <td><div class="act-row"><button class="act-btn edit" onclick="openResultForm(${r.id})">✏️</button></div></td>
        </tr>`;
      }).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray)">✅ Semua hasil sudah diinput</td></tr>`}
      </tbody></table>
    </div>`;
}

// prefill: konteks opsional dari worklist (sampel yg belum punya draft)
async function openResultForm(resultId=null, prefill=null){
  let r=prefill?{...prefill}:{};
  if(resultId){ const d=await sbGet('lab_results',`select=*&id=eq.${resultId}`); r=d[0]||{}; }

  const rrData = r.product_id ? await labLoadRR(r.product_id) : [];

  let admOpts='<option value="">-- Pilih Kunjungan --</option>';
  try {
    const adms=await sbGet('admissions','select=id,visit_number,patient_name,patient_gender,patient_age&status=in.(Lab,Registered,Anamnesa)&order=created_at.desc&limit=50');
    admOpts+=(adms||[]).map(a=>`<option value="${a.id}" data-name="${a.patient_name}" data-visit="${a.visit_number}" data-gender="${a.patient_gender||''}" data-age="${a.patient_age||''}"
      ${r.admission_id==a.id?'selected':''}>${a.visit_number} — ${a.patient_name}</option>`).join('');
  } catch(e){}

  const prods=await loadLabProducts();
  let prodOpts='<option value="">-- Pilih Tes --</option>';
  prodOpts+=(prods||[]).map(p=>`<option value="${p.id}" data-unit="${p.satuan_hasil||''}" data-name="${p.nama_tes}"
    ${r.product_id==p.id?'selected':''}>${p.kode_internal} — ${p.nama_tes}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📝 ${resultId?'Update':'Input'} Hasil Pemeriksaan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <input type="hidden" id="rf-sample" value="${r.sample_id||''}">
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label>Kunjungan Pasien *</label>
        <select id="rf-adm" onchange="rfPickAdm(this)">${admOpts}</select></div>
      <input type="hidden" id="rf-patient" value="${r.patient_name||''}">
      <div class="form-group" style="grid-column:1/-1"><label>Tes / Pemeriksaan *</label>
        <select id="rf-prod" onchange="loadRRForResult(this.value);document.getElementById('rf-unit').value=this.options[this.selectedIndex].dataset.unit||''">${prodOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Nilai Hasil *</label>
        <input type="text" id="rf-value" value="${r.result_value||''}" placeholder="Angka atau teks (Pos/Neg)" oninput="interpretResult(this.value)"></div>
      <div class="form-group"><label>Unit</label>
        <input type="text" id="rf-unit" value="${r.unit||''}" placeholder="mg/dL"></div>
    </div>
    <div id="rf-interp-box" style="margin-bottom:12px"></div>
    <div id="rf-delta-box" style="margin-bottom:12px"></div>
    <div id="rf-rr-view" style="margin-bottom:12px">${renderRRChips(rrData)}</div>
    <div class="form-row">
      <div class="form-group"><label>Interpretasi</label>
        <input type="text" id="rf-interp" value="${r.interpretation||''}" placeholder="Normal, Tinggi, Prediabetik..."></div>
      <div class="form-group"><label>Catatan Analis</label>
        <input type="text" id="rf-notes" value="${r.notes||''}" placeholder="Catatan..."></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveLabResult(${resultId||'null'})">💾 Simpan Hasil</button>
    </div>`);

  // delta check untuk data prefill/edit
  if(r.patient_name && r.product_id) showDeltaCheck(r.patient_name, r.product_id, resultId);
  if(r.result_value) interpretResult(r.result_value);
}

function rfPickAdm(sel){
  const o=sel.options[sel.selectedIndex];
  document.getElementById('rf-patient').value=o.dataset.name||'';
  const pid=document.getElementById('rf-prod')?.value;
  if(o.dataset.name&&pid) showDeltaCheck(o.dataset.name, pid);
}

function renderRRChips(rrs){
  if(!rrs||!rrs.length) return '';
  return `<div style="font-size:11px;color:var(--gray);margin-bottom:6px;font-weight:700">Rentang Rujukan:</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${rrs.map(rr=>{const c=labColor(rr.color_code);
        return `<div style="background:${c}15;border:1px solid ${c}40;border-radius:8px;padding:4px 10px;font-size:11px">
          <strong style="color:${c}">${rr.condition_name}</strong>
          ${rr.value_type==='qualitative'
            ? `: ${rr.expected_values||''}`
            : (rr.range_min!=null&&rr.range_max!=null?`: ${rr.range_min}–${rr.range_max} ${rr.unit||''}`:'')}
          ${(rr.critical_low!=null||rr.critical_high!=null)?`<span style="color:#DC2626"> · kritis ${rr.critical_low??'‹'}${rr.critical_low!=null&&rr.critical_high!=null?'/':''}${rr.critical_high??'›'}</span>`:''}</div>`;
      }).join('')}
    </div>`;
}

async function loadRRForResult(productId){
  if(!productId) return;
  const rrs=await labLoadRR(productId);
  const el=document.getElementById('rf-rr-view');
  if(el) el.innerHTML=renderRRChips(rrs);
  const patient=document.getElementById('rf-patient')?.value;
  if(patient) showDeltaCheck(patient, productId);
}

function interpretResult(val){
  const prodSel=document.getElementById('rf-prod');
  const box=document.getElementById('rf-interp-box');
  const raw=(val==null?'':String(val)).trim();
  if(!prodSel?.value||raw===''){ if(box) box.innerHTML=''; return; }
  const rrs=_rrCache[prodSel.value]||[];
  const admSel=document.getElementById('rf-adm');
  const gender=admSel?.options[admSel.selectedIndex]?.dataset.gender||null;
  const age=parseInt(admSel?.options[admSel.selectedIndex]?.dataset.age)||null;
  const match=matchRefRange(rrs,raw,gender,age);
  if(!match){ if(box) box.innerHTML=''; return; }

  const numVal=parseFloat(raw);
  const c=labColor(match.color_code);
  const iEl=document.getElementById('rf-interp');
  if(iEl) iEl.value=match.interpretation||match.condition_name||'';
  const crit=(!isNaN(numVal)&&((match.critical_low!=null&&numVal<=match.critical_low)||(match.critical_high!=null&&numVal>=match.critical_high)))||match.condition_type==='critical';

  if(box) box.innerHTML=`
    <div style="background:${crit?'#FEF2F2':c+'15'};border:2px solid ${crit?'#DC2626':c+'40'};border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px">
      <div style="width:12px;height:12px;border-radius:50%;background:${crit?'#DC2626':c};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:800;color:${crit?'#DC2626':c}">${crit?'🚨 NILAI KRITIS · ':''}${match.condition_name||match.interpretation||'—'}</div>
        ${match.description?`<div style="font-size:11px;color:var(--gray)">${match.description}</div>`:''}
        ${match.recommendation?`<div style="font-size:11px;color:${c};margin-top:2px">💡 ${match.recommendation}</div>`:''}
      </div>
    </div>`;
}

// Delta check: tampilkan hasil terakhir pasien untuk tes yang sama
async function showDeltaCheck(patientName, productId, excludeId=null){
  const box=document.getElementById('rf-delta-box'); if(!box) return;
  try {
    const prev=await sbGet('lab_results',
      `select=result_value,result_numeric,unit,created_at&patient_name=eq.${encodeURIComponent(patientName)}&product_id=eq.${productId}&result_value=not.is.null&order=created_at.desc&limit=1`);
    const p=(prev||[]).find(x=>true);
    if(!p){ box.innerHTML=''; return; }
    box.innerHTML=`
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 12px;font-size:12px;color:#1E40AF">
        📊 Hasil sebelumnya: <strong>${p.result_value} ${p.unit||''}</strong>
        <span style="color:#64748B">(${new Date(p.created_at).toLocaleDateString('id-ID')})</span>
        <span id="rf-delta-arrow"></span>
      </div>`;
    box._prevNum=p.result_numeric;
  } catch(e){ box.innerHTML=''; }
}

async function saveLabResult(id){
  const admSel=document.getElementById('rf-adm');
  const admId=admSel?.value;
  const prodSel=document.getElementById('rf-prod');
  const prodId=prodSel?.value;
  const val=document.getElementById('rf-value').value.trim();

  if(!admId){ toast('Pilih kunjungan dulu','err'); return; }
  if(!prodId){ toast('Pilih tes dulu','err'); return; }
  if(!val){ toast('Nilai hasil wajib diisi','err'); return; }

  const admName=document.getElementById('rf-patient').value||admSel.options[admSel.selectedIndex]?.dataset.name||'';
  const admVisit=admSel.options[admSel.selectedIndex]?.dataset.visit||'';
  const gender=admSel.options[admSel.selectedIndex]?.dataset.gender||null;
  const age=parseInt(admSel.options[admSel.selectedIndex]?.dataset.age)||null;
  const prodName=prodSel.options[prodSel.selectedIndex]?.dataset.name||'';
  const sampleId=parseInt(document.getElementById('rf-sample')?.value)||null;

  const numVal=parseFloat(val);
  const rrs=_rrCache[prodId]||[];
  const m=matchRefRange(rrs, val, gender, age);
  const crit=m?((!isNaN(numVal)&&((m.critical_low!=null&&numVal<=m.critical_low)||(m.critical_high!=null&&numVal>=m.critical_high)))||m.condition_type==='critical'):false;

  const payload={
    admission_id:parseInt(admId), sample_id:sampleId, visit_number:admVisit, patient_name:admName,
    product_id:parseInt(prodId), product_name:prodName,
    result_value:val, result_numeric:isNaN(numVal)?null:numVal,
    unit:document.getElementById('rf-unit').value.trim()||null,
    ref_range_id:m?.id||null, normal_min:m?.range_min??null, normal_max:m?.range_max??null,
    critical_low:m?.critical_low??null, critical_high:m?.critical_high??null,
    interpretation:document.getElementById('rf-interp').value.trim()||m?.interpretation||null,
    color_code:m?.color_code||'green', condition_name:m?.condition_name||null, condition_type:m?.condition_type||null,
    is_critical:crit, is_auto:false, status:'Draft',
    entered_by:labUser(), entered_at:new Date().toISOString(),
    notes:document.getElementById('rf-notes').value.trim()||null, updated_at:new Date().toISOString(),
  };

  try {
    if(id){ await sbPatch('lab_results',id,payload); toast('✅ Hasil diupdate','ok'); }
    else  { await sbPost('lab_results',payload);     toast('✅ Hasil disimpan','ok'); }
    // tandai sampel selesai diproses
    if(sampleId){ await sbPatch('lab_samples',sampleId,{status:'Done',updated_at:new Date().toISOString()}).catch(()=>{}); }
    if(crit && typeof logActivity==='function') logActivity('critical','lab_results',id||0,`Nilai kritis: ${prodName}=${val}`,admName);
    closeModalForce(); labRefresh();
  } catch(e){ toast('❌ '+e.message,'err'); }
}
