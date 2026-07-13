// ═══════════════════════════════════════════════════════════════
// LIS · INPUT HASIL (Result Entry)
// - Input manual + auto-interpretasi rentang rujukan
// - Deteksi nilai kritis (panic value)
// - Delta check: bandingkan dengan hasil sebelumnya pasien
// ═══════════════════════════════════════════════════════════════

function renderResultTab(){
  const el=document.getElementById('lab-result'); if(!el) return;
  const drafts=labResults.filter(r=>r.status==='Draft');

  // Kelompokkan per (kunjungan + tes) — panel = banyak parameter dalam satu grup
  const groups={};
  drafts.forEach(r=>{
    const k=`${r.admission_id}|${r.product_id}`;
    if(!groups[k]) groups[k]={admission_id:r.admission_id, product_id:r.product_id,
      product_name:r.product_name, patient_name:r.patient_name, visit_number:r.visit_number, rows:[]};
    groups[k].rows.push(r);
  });
  const list=Object.values(groups);

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <span class="badge badge-gray" style="margin-right:6px">${list.length} tes dalam proses input</span>
        <span style="font-size:12px;color:var(--gray)">Panel otomatis terpecah per parameter (analit) · hasil analyzer masuk otomatis bila terintegrasi</span>
      </div>
      <button class="btn btn-teal btn-sm" onclick="openResultForm()">+ Input Manual</button>
    </div>
    <div class="table-wrap">
      <table><thead><tr>
        <th>Pasien</th><th>Tes</th><th>Parameter</th><th>Terisi</th><th>Aksi</th>
      </tr></thead><tbody>
      ${list.length ? list.map(g=>{
        const filled=g.rows.filter(r=>r.result_value).length;
        const isPanel=g.rows.length>1 || g.rows.some(r=>r.product_item_id);
        const anyCrit=g.rows.some(isCriticalResult);
        return `<tr>
          <td><div style="font-weight:600">${g.patient_name||'—'}</div>
              <div style="font-size:10px;color:var(--gray)">${g.visit_number||'—'}</div></td>
          <td style="font-size:12px">${g.product_name||'—'}
            ${isPanel?`<span style="background:#EDE9FE;color:#6D28D9;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700;margin-left:4px">🧬 PANEL</span>`:''}
            ${anyCrit?' <span title="Ada nilai kritis">🚨</span>':''}</td>
          <td style="font-size:12px">${g.rows.length} parameter</td>
          <td><span style="font-size:12px;font-weight:800;color:${filled===g.rows.length?'#22C55E':'#F59E0B'}">${filled}/${g.rows.length}</span></td>
          <td><button class="btn btn-teal btn-xs" onclick="openResultEntry(${g.admission_id},${g.product_id})">📝 Input Hasil</button></td>
        </tr>`;
      }).join('') : `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray)">✅ Semua hasil sudah diinput</td></tr>`}
      </tbody></table>
    </div>`;
}

// ── Input hasil per-tes: 1 tabel, 1 baris per parameter/analit ──────
let _reRR=[], _reAdm={}, _reSampleIds=[];
async function openResultEntry(admissionId, productId){
  const [results, items, rrAll, admD] = await Promise.all([
    sbGet('lab_results',`select=*&admission_id=eq.${admissionId}&product_id=eq.${productId}&order=id.asc`).catch(()=>[]),
    labProductItems(productId),
    labLoadRR(productId),
    sbGet('admissions',`select=patient_name,patient_gender,patient_age,visit_number&id=eq.${admissionId}`).catch(()=>[]),
  ]);
  const rows=(results||[]).filter(r=>r.status==='Draft'||r.status==='Validated'||r.status==='Rejected');
  if(!rows.length){
    // belum ada draft (mis. tes manual) → buka form tunggal
    openResultForm(null, { admission_id:admissionId, product_id:productId }); return;
  }
  _reAdm=admD?.[0]||{};
  _reRR=rrAll||[];
  _reSampleIds=[...new Set(rows.map(r=>r.sample_id).filter(Boolean))];
  const itemMap={}; (items||[]).forEach(it=>itemMap[it.id]=it);
  const prodName=rows[0].product_name||'';

  openModal(`
    <div class="modal-header"><div class="modal-title">📝 Input Hasil — ${prodName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="background:var(--mint);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px">
      <strong>${_reAdm.patient_name||rows[0].patient_name||''}</strong> · ${_reAdm.visit_number||rows[0].visit_number||''}
      · ${_reAdm.patient_gender||''} ${_reAdm.patient_age?_reAdm.patient_age+' th':''} · ${rows.length} parameter</div>
    <div class="table-wrap" style="max-height:440px;overflow-y:auto"><table><thead><tr>
      <th>Parameter</th><th style="width:130px">Hasil</th><th>Unit</th><th>Rujukan</th><th>Interpretasi</th>
    </tr></thead><tbody>
    ${rows.map(r=>{
      const it=r.product_item_id?itemMap[r.product_item_id]:null;
      const unit=r.unit||it?.uom||'';
      const ref=reRefText(r, it);
      return `<tr data-rid="${r.id}" data-item="${r.product_item_id||''}">
        <td style="font-size:12px;font-weight:600">${r.item_name||r.product_name||'—'}
          ${r.item_code?`<span style="font-size:9px;color:var(--gray);font-family:monospace">${r.item_code}</span>`:''}</td>
        <td><input type="text" class="re-val" value="${r.result_value||''}" placeholder="—"
          style="width:120px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px" oninput="reInterpret(this)"></td>
        <td style="font-size:11px;color:var(--gray)"><span class="re-unit">${unit}</span></td>
        <td style="font-size:10.5px;color:var(--gray)">${ref}</td>
        <td class="re-interp" style="font-size:11px;color:var(--gray)">—</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveResultEntry()">💾 Simpan Semua</button>
    </div>`);
  document.querySelectorAll('#modal-box .re-val').forEach(inp=>{ if(inp.value.trim()) reInterpret(inp); });
}

// teks rujukan singkat untuk sebuah parameter
function reRefText(r, it){
  const rr=_reRR.filter(x=> (r.product_item_id? (x.product_item_id==r.product_item_id||x.product_item_id==null) : x.product_item_id==null));
  const norm=rr.find(x=>x.value_type!=='qualitative' && x.condition_type==='normal' && x.range_min!=null && x.range_max!=null);
  if(norm) return `${norm.range_min}–${norm.range_max} ${norm.unit||''}`;
  if(it && it.ref_low!=null && it.ref_high!=null) return `${it.ref_low}–${it.ref_high}`;
  if(it && it.ref_text) return it.ref_text;
  const qual=rr.filter(x=>x.value_type==='qualitative').map(x=>x.condition_name);
  return qual.length?qual.join('/'):'—';
}

function reRRForRow(tr){
  const itemId=tr.dataset.item?parseInt(tr.dataset.item):null;
  return _reRR.filter(x=> (itemId? (x.product_item_id==itemId||x.product_item_id==null) : x.product_item_id==null));
}

function reInterpret(input){
  const tr=input.closest('tr');
  const cell=tr.querySelector('.re-interp');
  const raw=input.value.trim();
  if(raw===''){ cell.textContent='—'; cell.style.color='var(--gray)'; input.style.borderColor='var(--border)'; return; }
  const m=matchRefRange(reRRForRow(tr), raw, _reAdm.patient_gender, _reAdm.patient_age);
  if(!m){ cell.textContent='—'; cell.style.color='var(--gray)'; input.style.borderColor='var(--border)'; return; }
  const num=parseFloat(raw), c=labColor(m.color_code);
  const crit=(!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical';
  cell.innerHTML=`<span style="color:${c};font-weight:700">${m.condition_name||m.interpretation||'—'}${crit?' 🚨':''}</span>`;
  input.style.borderColor=c;
}

async function saveResultEntry(){
  const trs=[...document.querySelectorAll('#modal-box tbody tr')];
  let ok=0;
  for(const tr of trs){
    const rid=parseInt(tr.dataset.rid); if(!rid) continue;
    const val=tr.querySelector('.re-val').value.trim();
    if(val==='') continue; // kosong → biarkan draft
    const unit=tr.querySelector('.re-unit')?.textContent.trim()||null;
    const num=parseFloat(val);
    const m=matchRefRange(reRRForRow(tr), val, _reAdm.patient_gender, _reAdm.patient_age);
    const crit=m?((!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical'):false;
    const payload={
      result_value:val, result_numeric:isNaN(num)?null:num, unit:unit||null,
      ref_range_id:m?.id||null, normal_min:m?.range_min??null, normal_max:m?.range_max??null,
      critical_low:m?.critical_low??null, critical_high:m?.critical_high??null,
      interpretation:m?.interpretation||m?.condition_name||null, color_code:m?.color_code||'green',
      condition_name:m?.condition_name||null, condition_type:m?.condition_type||null,
      is_critical:crit, is_auto:false, status:'Draft',
      entered_by:labUser(), entered_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    };
    try { await sbPatch('lab_results',rid,payload); ok++; } catch(e){}
  }
  // tandai sampel terkait selesai diproses
  for(const sid of _reSampleIds){ await sbPatch('lab_samples',sid,{status:'Done',updated_at:new Date().toISOString()}).catch(()=>{}); }
  toast(`✅ ${ok} parameter tersimpan → siap divalidasi`,'ok');
  closeModalForce(); labRefresh();
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
