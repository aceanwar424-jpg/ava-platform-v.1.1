// ═══════════════════════════════════════════════════════════════
// LIS · INTEGRASI ANALYZER (HL7 / ASTM / CSV)
// - Terima output alat, cocokkan ke draft hasil via HOST CODE / kode analit
// - Interpretasi otomatis (is_auto=true) lalu isi nilai per parameter
// Catatan: koneksi TCP/serial real membutuhkan middleware server. Modul ini
// menyediakan jalur intake (paste/upload pesan) yang matching-nya siap dipakai
// begitu middleware meneruskan pesan alat ke sini.
// ═══════════════════════════════════════════════════════════════

let _aiMatches = [];

function openAnalyzerIntake(){
  const samples = labSamples.filter(s=>['In Process','Pending','Done'].includes(s.status));
  let azOpts = '';
  try {
    // analyzers cache tidak wajib; hanya informatif
  } catch(e){}
  openModal(`
    <div class="modal-header"><div class="modal-title">🔌 Terima Hasil dari Analyzer</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
      Pilih sampel, tempel output alat (HL7 OBX / ASTM R / CSV / <code>KODE=NILAI</code>). Nilai dicocokkan otomatis ke tiap parameter lewat <strong>Host Code</strong> / kode analit / LOINC.
    </div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label>Sampel *</label>
        <select id="ai-sample">
          <option value="">-- Pilih sampel --</option>
          ${samples.map(s=>`<option value="${s.id}">${s.barcode||('#'+s.id)} · ${s.patient_name||''} · ${s.product_name||''}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-group"><label>Output Analyzer</label>
      <textarea id="ai-feed" rows="7" placeholder="Contoh:
GLU=105
OBX|1|NM|WBC^Leukosit||7.2|10^3/uL|...
R|1|^^^RBC^|4.8|10^6/uL||N
HGB,14.2,g/dL" style="width:100%;font-family:monospace;font-size:12px"></textarea></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn btn-teal btn-sm" onclick="parseAnalyzerIntake()">🔎 Parse &amp; Cocokkan</button>
    </div>
    <div id="ai-preview"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" id="ai-apply-btn" style="display:none" onclick="applyAnalyzerIntake()">✅ Terapkan ke Hasil</button>
    </div>`, 'wide');
}

// Parser toleran: HL7 OBX, ASTM R, key=value, CSV/tab
function parseAnalyzerFeed(text){
  const out=[];
  (text||'').split(/\r?\n/).forEach(line=>{
    const l=line.trim(); if(!l) return;
    let code='', value='', unit='', flag='';
    if(/^OBX\|/i.test(l)){
      const f=l.split('|');
      code=(f[3]||'').split('^')[0];
      value=(f[5]||'').trim(); unit=(f[6]||'').trim(); flag=(f[8]||'').trim();
    } else if(/^R\|/i.test(l)){
      const f=l.split('|');
      const comps=(f[2]||'').split('^').filter(Boolean);
      code=comps.length?comps[comps.length-1]:'';
      value=(f[3]||'').trim(); unit=(f[4]||'').trim(); flag=(f[6]||'').trim();
    } else if(l.includes('=')){
      const i=l.indexOf('='); code=l.slice(0,i).trim(); value=l.slice(i+1).trim();
    } else if(l.includes(',') || l.includes('\t')){
      const f=l.split(/[,\t]/); code=(f[0]||'').trim(); value=(f[1]||'').trim(); unit=(f[2]||'').trim();
    }
    if(code && value!=='') out.push({ code, value, unit, flag });
  });
  return out;
}

async function parseAnalyzerIntake(){
  const sampleId=parseInt(document.getElementById('ai-sample')?.value)||null;
  const text=document.getElementById('ai-feed')?.value||'';
  const prev=document.getElementById('ai-preview');
  const applyBtn=document.getElementById('ai-apply-btn');
  if(!sampleId){ toast('Pilih sampel dulu','err'); return; }
  const entries=parseAnalyzerFeed(text);
  if(!entries.length){ prev.innerHTML='<div class="status-box status-warn">Tidak ada baris hasil yang bisa diparse.</div>'; return; }

  const s=labSamples.find(x=>x.id==sampleId)||{};
  const prod=labProduct(s.product_id)||{};
  // draft parameter untuk sampel ini
  let drafts=labResults.filter(r=>r.admission_id==s.admission_id && r.product_id==s.product_id && r.status==='Draft');
  if(!drafts.length){
    // fallback: ambil dari DB
    drafts=await sbGet('lab_results',`select=*&admission_id=eq.${s.admission_id}&product_id=eq.${s.product_id}&status=eq.Draft&order=id.asc`).catch(()=>[]);
  }

  // kunci pencocokan per draft
  const keyOf=d=>[d.host_code, d.item_code, d.loinc_code, (!d.product_item_id?prod.host_code:null), (!d.product_item_id?prod.kode_internal:null)]
    .filter(Boolean).map(x=>String(x).toLowerCase());

  _aiMatches=[];
  const used=new Set();
  entries.forEach(e=>{
    const key=String(e.code).toLowerCase();
    const d=drafts.find(dr=>!used.has(dr.id) && keyOf(dr).includes(key));
    if(d) used.add(d.id);
    _aiMatches.push({ entry:e, draft:d||null });
  });
  const matched=_aiMatches.filter(m=>m.draft).length;

  prev.innerHTML=`
    <div style="font-size:12px;margin-bottom:6px"><strong>${matched}/${entries.length}</strong> baris cocok · sampel ${s.barcode||''} (${prod.nama_tes||s.product_name||''})</div>
    <div class="table-wrap" style="max-height:260px;overflow-y:auto"><table><thead><tr>
      <th>Kode Alat</th><th>Nilai</th><th>Unit</th><th>→ Parameter</th><th>Status</th>
    </tr></thead><tbody>
    ${_aiMatches.map(m=>`<tr>
      <td style="font-family:monospace;font-size:12px;font-weight:700">${m.entry.code}</td>
      <td style="font-weight:700">${m.entry.value}</td>
      <td style="font-size:11px;color:var(--gray)">${m.entry.unit||''}</td>
      <td style="font-size:12px">${m.draft?(m.draft.item_name||m.draft.product_name):'<span style="color:#EF4444">tidak cocok</span>'}</td>
      <td>${m.draft?'<span class="badge badge-green">✓ cocok</span>':'<span class="badge badge-gray">dilewati</span>'}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
  if(applyBtn) applyBtn.style.display = matched?'':'none';
}

async function applyAnalyzerIntake(){
  const toApply=_aiMatches.filter(m=>m.draft);
  if(!toApply.length){ toast('Tidak ada yang cocok','warn'); return; }
  // butuh gender/umur pasien + ref ranges
  const first=toApply[0].draft;
  const admD=await sbGet('admissions',`select=patient_gender,patient_age&id=eq.${first.admission_id}`).catch(()=>[]);
  const adm=admD?.[0]||{};
  const rrAll=await labLoadRR(first.product_id);
  const sampleIds=new Set();
  let ok=0;

  for(const m of toApply){
    const d=m.draft, val=String(m.entry.value).trim();
    const rr=(rrAll||[]).filter(x=> (d.product_item_id? (x.product_item_id==d.product_item_id||x.product_item_id==null) : x.product_item_id==null));
    const num=parseFloat(val);
    const match=matchRefRange(rr, val, adm.patient_gender, adm.patient_age);
    const crit=match?((!isNaN(num)&&((match.critical_low!=null&&num<=match.critical_low)||(match.critical_high!=null&&num>=match.critical_high)))||match.condition_type==='critical'):false;
    const payload={
      result_value:val, result_numeric:isNaN(num)?null:num, unit:(m.entry.unit||d.unit||null),
      ref_range_id:match?.id||null, normal_min:match?.range_min??null, normal_max:match?.range_max??null,
      critical_low:match?.critical_low??null, critical_high:match?.critical_high??null,
      interpretation:match?.interpretation||match?.condition_name||null, color_code:match?.color_code||'green',
      condition_name:match?.condition_name||null, condition_type:match?.condition_type||null,
      is_critical:crit, is_auto:true, status:'Draft',
      entered_by:'Analyzer', entered_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    };
    try { await sbPatch('lab_results',d.id,payload); ok++; if(d.sample_id) sampleIds.add(d.sample_id); } catch(e){}
  }
  for(const sid of sampleIds){ await sbPatch('lab_samples',sid,{status:'Done',updated_at:new Date().toISOString()}).catch(()=>{}); }
  if(typeof logActivity==='function') logActivity('analyzer_import','lab_results',first.id,`Auto-import ${ok} hasil dari analyzer`);
  toast(`✅ ${ok} hasil masuk otomatis dari analyzer`,'ok',4000);
  closeModalForce(); labRefresh();
}
