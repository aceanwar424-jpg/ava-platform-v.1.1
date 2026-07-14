// ═══════════════════════════════════════════════════════════════
// LIS · INPUT HASIL (Result Entry)
// - Input manual + auto-interpretasi rentang rujukan
// - Deteksi nilai kritis (panic value)
// - Delta check: bandingkan dengan hasil sebelumnya pasien
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// INPUT HASIL — Result Entry ala LIS profesional (Sysmex-style)
// Kiri: worklist pasien · Atas: detail pasien · Tengah: grid tes/analit
// Kanan: panel catatan/detail per parameter. Klik pasien → grid berubah.
// ═══════════════════════════════════════════════════════════════
let _resSel=null, _resAdm={}, _resNotes={};

function resDraftPatients(){
  const byAdm={};
  labResults.filter(r=>r.status==='Draft').forEach(r=>{
    const k=r.admission_id;
    if(!byAdm[k]) byAdm[k]={admission_id:r.admission_id,patient_name:r.patient_name,
      visit_number:r.visit_number,mr_number:r.mr_number,rows:[]};
    byAdm[k].rows.push(r);
  });
  return Object.values(byAdm);
}

function renderResultTab(){
  const el=document.getElementById('lab-result'); if(!el) return;
  const patients=resDraftPatients();
  if(!patients.some(p=>p.admission_id==_resSel)) _resSel = patients.length?patients[0].admission_id:null;

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span class="badge badge-gray">${patients.length} pasien menunggu input hasil</span>
      <button class="btn btn-teal btn-sm" onclick="openResultForm()">+ Input Manual</button>
    </div>
    ${patients.length?`
    <div style="display:grid;grid-template-columns:240px 1fr 260px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff">
      <div id="res-worklist" style="border-right:1px solid var(--border);overflow-y:auto;max-height:640px;background:var(--lgray)"></div>
      <div style="display:flex;flex-direction:column;min-width:0">
        <div id="res-pbar" style="border-bottom:1px solid var(--border);padding:10px 14px;background:#F8FAFC"></div>
        <div id="res-grid" style="overflow:auto;max-height:600px"></div>
      </div>
      <div id="res-notes" style="border-left:1px solid var(--border);background:var(--lgray);padding:14px;overflow-y:auto;max-height:640px"></div>
    </div>`:`<div class="empty-state"><div class="ico">✅</div><h3>Semua hasil sudah diinput</h3></div>`}`;

  if(patients.length){
    renderResWorklist(patients);
    if(_resSel!=null) selectResultPatient(_resSel);
  }
}

function renderResWorklist(patients){
  const el=document.getElementById('res-worklist'); if(!el) return;
  el.innerHTML=patients.map(p=>{
    const filled=p.rows.filter(r=>r.result_value).length;
    const sel=p.admission_id==_resSel;
    const crit=p.rows.some(isCriticalResult);
    return `<div onclick="selectResultPatient(${p.admission_id})"
      style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;${sel?'background:var(--mint);border-left:3px solid var(--teal)':'border-left:3px solid transparent'}">
      <div style="font-weight:700;font-size:13px;color:var(--navy)">${p.patient_name||'—'}${crit?' 🚨':''}</div>
      <div style="font-size:10.5px;color:var(--gray);font-family:monospace">${p.mr_number||''} ${p.visit_number||''}</div>
      <div style="font-size:10px;color:${filled===p.rows.length?'#22C55E':'#F59E0B'};font-weight:700;margin-top:2px">${filled}/${p.rows.length} parameter</div>
    </div>`;
  }).join('') || '<div style="padding:16px;text-align:center;color:var(--gray);font-size:12px">Tidak ada pasien</div>';
}

async function selectResultPatient(admId){
  _resSel=admId;
  renderResWorklist(resDraftPatients());
  const drafts=labResults.filter(r=>r.status==='Draft' && r.admission_id==admId);

  const admD=await sbGet('admissions',`select=patient_name,patient_gender,patient_age,patient_dob,visit_number,patient_blood_type,mr_number&id=eq.${admId}`).catch(()=>[]);
  _resAdm=admD?.[0]||{};
  await Promise.all([...new Set(drafts.map(r=>r.product_id))].map(pid=>labLoadRR(pid)));

  const pbar=document.getElementById('res-pbar');
  if(pbar) pbar.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <span style="font-size:15px;font-weight:800;color:var(--navy)">${_resAdm.patient_name||''}</span>
        ${_resAdm.patient_blood_type?`<span style="color:#DC2626;font-weight:800;margin-left:8px">${_resAdm.patient_blood_type}</span>`:''}
        <div style="font-size:11px;color:var(--gray);font-family:monospace">${_resAdm.mr_number||''} · ${_resAdm.visit_number||''} · ${_resAdm.patient_gender==='F'?'Perempuan':'Laki-laki'}${_resAdm.patient_age?' · '+_resAdm.patient_age+' th':''}</div>
      </div>
      <button class="btn btn-teal btn-sm" onclick="resSaveAll()">💾 Simpan Hasil</button>
    </div>`;

  const groups={};
  drafts.forEach(r=>{ (groups[r.product_id]=groups[r.product_id]||{name:r.product_name,rows:[]}).rows.push(r); });
  const grid=document.getElementById('res-grid');
  if(grid) grid.innerHTML=`
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--lgray);position:sticky;top:0;z-index:1">
        <th style="padding:6px 10px;text-align:left">Test Name</th>
        <th style="padding:6px 8px;text-align:left;width:110px">Curr Result</th>
        <th style="padding:6px 8px;text-align:left;width:70px">Prev</th>
        <th style="padding:6px 4px;width:36px">Flag</th>
        <th style="padding:6px 8px;text-align:left;width:64px">Unit</th>
        <th style="padding:6px 8px;text-align:left;width:110px">Reference</th>
      </tr></thead><tbody>
      ${Object.entries(groups).map(([pid,g])=>{
        const isPanel=g.rows.length>1 || g.rows.some(r=>r.product_item_id);
        let html=isPanel?`<tr><td colspan="6" style="background:#EEF2FF;color:#3730A3;font-weight:700;padding:5px 10px">${g.name}</td></tr>`:'';
        html+=g.rows.map(r=>resRowHtml(r,pid,isPanel)).join('');
        return html;
      }).join('')}
      </tbody></table>`;

  const notes=document.getElementById('res-notes');
  if(notes) notes.innerHTML=`<div style="font-size:11px;color:var(--gray);text-align:center;padding:24px 8px">Klik sebuah parameter untuk melihat riwayat &amp; menambah catatan.</div>`;

  document.querySelectorAll('#res-grid .res-val').forEach(inp=>{ if(inp.value.trim()) resInterpret(inp); });
}

function resRowHtml(r, pid, indent){
  const name = indent
    ? `<span style="padding-left:14px">${r.item_name||'—'}${r.item_code?` <span style="font-size:9px;color:var(--gray);font-family:monospace">${r.item_code}</span>`:''}</span>`
    : `<strong>${r.product_name||'—'}</strong>`;
  const rr=(_rrCache[pid]||[]).filter(x=> r.product_item_id? (x.product_item_id==r.product_item_id||x.product_item_id==null):x.product_item_id==null);
  const norm=rr.find(x=>x.value_type!=='qualitative'&&x.condition_type==='normal'&&x.range_min!=null&&x.range_max!=null);
  const refTxt=norm?`${norm.range_min}–${norm.range_max}`:(rr.filter(x=>x.value_type==='qualitative').map(x=>x.condition_name).join('/')||'—');
  return `<tr data-rid="${r.id}" data-item="${r.product_item_id||''}" data-prod="${pid}" onclick="resPickRow(${r.id})">
    <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${name}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9"><input type="text" class="res-val" value="${(r.result_value||'').replace(/"/g,'&quot;')}" oninput="resInterpret(this)" onclick="event.stopPropagation()" style="width:96px;padding:4px 6px;border:1.5px solid var(--border);border-radius:5px"></td>
    <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:var(--gray)" class="res-prev">—</td>
    <td style="padding:5px 4px;border-bottom:1px solid #f1f5f9;text-align:center" class="res-flag"></td>
    <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:var(--gray)">${r.unit||''}</td>
    <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:var(--gray);font-size:11px">${refTxt}</td>
  </tr>`;
}

function resInterpret(input){
  const tr=input.closest('tr');
  const pid=tr.dataset.prod, itemId=tr.dataset.item?parseInt(tr.dataset.item):null;
  const raw=input.value.trim();
  const flagCell=tr.querySelector('.res-flag');
  const rr=(_rrCache[pid]||[]).filter(x=> itemId? (x.product_item_id==itemId||x.product_item_id==null):x.product_item_id==null);
  if(raw===''){ flagCell.innerHTML=''; input.style.borderColor='var(--border)'; return; }
  const m=matchRefRange(rr, raw, _resAdm.patient_gender, _resAdm.patient_age);
  const num=parseFloat(raw);
  const norm=rr.find(x=>x.condition_type==='normal'&&x.range_min!=null&&x.range_max!=null);
  let flag='';
  if(norm&&!isNaN(num)){ if(num>norm.range_max) flag='H'; else if(num<norm.range_min) flag='L'; }
  const crit=m?((!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical'):false;
  const c=m?labColor(m.color_code):'#94A3B8';
  flagCell.innerHTML= crit?'<span style="font-weight:800;color:#DC2626">🚨</span>'
    : flag?`<span style="font-weight:800;color:${flag==='H'?'#EF4444':'#0EA5E9'}">${flag}</span>`
    : (m?`<span style="color:${c}">●</span>`:'');
  input.style.borderColor=c;
}

async function resPickRow(rid){
  const tr=document.querySelector(`#res-grid tr[data-rid="${rid}"]`); if(!tr) return;
  document.querySelectorAll('#res-grid tr[data-rid]').forEach(t=>t.style.background='');
  tr.style.background='var(--mint)';
  const r=labResults.find(x=>x.id==rid)||{};
  const notes=document.getElementById('res-notes'); if(!notes) return;
  const noteVal=(_resNotes[rid]!=null?_resNotes[rid]:(r.notes||''));
  notes.innerHTML=`
    <div style="font-size:12.5px;font-weight:800;color:var(--navy)">${r.item_name||r.product_name||''}</div>
    <div style="font-size:10.5px;color:var(--gray);margin-bottom:10px">${r.product_name||''}${r.loinc_code?' · LOINC '+r.loinc_code:''}${r.host_code?' · Host '+r.host_code:''}</div>
    <div id="res-prevbox" style="font-size:11px;color:var(--gray);margin-bottom:12px">memuat riwayat…</div>
    <label style="font-size:11px;color:var(--gray);font-weight:700">Catatan / Komentar</label>
    <textarea id="res-note-input" rows="6" style="width:100%;margin-top:4px;font-size:12px" oninput="_resNotes[${rid}]=this.value" placeholder="Catatan analis, kondisi sampel, dll...">${noteVal}</textarea>
    <div style="font-size:10px;color:var(--gray);margin-top:6px">Catatan ikut tersimpan saat "Simpan Hasil".</div>`;
  try {
    const prev=await sbGet('lab_results',
      `select=result_value,unit,created_at&patient_name=eq.${encodeURIComponent(r.patient_name||'')}&product_id=eq.${r.product_id}${r.product_item_id?`&product_item_id=eq.${r.product_item_id}`:''}&result_value=not.is.null&status=in.(Approved,Released,Validated)&order=created_at.desc&limit=1`).catch(()=>[]);
    const p=prev?.[0];
    const box=document.getElementById('res-prevbox');
    if(box) box.innerHTML= p?`📊 Hasil sebelumnya: <strong>${p.result_value} ${p.unit||''}</strong> <span style="color:#94A3B8">(${new Date(p.created_at).toLocaleDateString('id-ID')})</span>`:'Belum ada riwayat sebelumnya.';
    const prevCell=tr.querySelector('.res-prev'); if(prevCell&&p) prevCell.textContent=p.result_value;
  } catch(e){}
}

async function resSaveAll(){
  const trs=[...document.querySelectorAll('#res-grid tr[data-rid]')];
  let ok=0; const sampleIds=new Set();
  for(const tr of trs){
    const rid=parseInt(tr.dataset.rid);
    const val=tr.querySelector('.res-val').value.trim();
    const note=_resNotes[rid];
    if(val==='' && note==null) continue;
    const r=labResults.find(x=>x.id==rid)||{};
    const pid=tr.dataset.prod, itemId=tr.dataset.item?parseInt(tr.dataset.item):null;
    const rr=(_rrCache[pid]||[]).filter(x=> itemId? (x.product_item_id==itemId||x.product_item_id==null):x.product_item_id==null);
    const num=parseFloat(val);
    const m=val!==''?matchRefRange(rr,val,_resAdm.patient_gender,_resAdm.patient_age):null;
    const crit=m?((!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical'):false;
    const payload={ updated_at:new Date().toISOString() };
    if(val!==''){
      Object.assign(payload,{ result_value:val, result_numeric:isNaN(num)?null:num,
        ref_range_id:m?.id||null, normal_min:m?.range_min??null, normal_max:m?.range_max??null,
        critical_low:m?.critical_low??null, critical_high:m?.critical_high??null,
        interpretation:m?.interpretation||m?.condition_name||null, color_code:m?.color_code||'green',
        condition_name:m?.condition_name||null, condition_type:m?.condition_type||null,
        is_critical:crit, is_auto:false, status:'Draft', entered_by:labUser(), entered_at:new Date().toISOString() });
    }
    if(note!=null) payload.notes=note||null;
    try{ await sbPatch('lab_results',rid,payload); ok++; if(r.sample_id) sampleIds.add(r.sample_id); }catch(e){}
  }
  for(const sid of sampleIds){ await sbPatch('lab_samples',sid,{status:'Done',updated_at:new Date().toISOString()}).catch(()=>{}); }
  _resNotes={};
  toast(`✅ ${ok} hasil disimpan`,'ok');
  await Promise.all([loadLabSamples(),loadLabResults()]);
  renderLabKPI(); renderCriticalBanner(); renderResultTab();
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
