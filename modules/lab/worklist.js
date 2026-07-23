// ═══════════════════════════════════════════════════════════════
// LIS · WORKLIST & TURNAROUND TIME (TAT)
// - Worklist berbasis daftar pasien beserta status keseluruhan
// - Kolom kanan: Daftar test yang dipesan dan statusnya per-test
//   (Pending, Enter Result, Validate, Approve)
// ═══════════════════════════════════════════════════════════════

let _wlSelPatient = null;
let _wlStatusFilter = 'ALL';
let _wlSearchQuery = '';
let _wlAdm = {};       // identitas pasien terpilih (gender/umur untuk interpretasi)
let _wlNotes = {};     // catatan per hasil (rid -> teks) sebelum disimpan

function getWorklistPatientsData() {
  const patientMap = {};

  // 1. Ambil dari labSamples (sampel terdaftar)
  (labSamples || []).forEach(s => {
    const k = s.admission_id || s.visit_number || s.patient_name;
    if (!k) return;
    if (!patientMap[k]) {
      patientMap[k] = {
        admission_id: s.admission_id,
        patient_name: s.patient_name,
        visit_number: s.visit_number,
        mr_number: s.mr_number,
        created_at: s.created_at,
        collected_at: s.collected_at,
        received_at: s.received_at,
        testsMap: {}
      };
    }
    const pid = s.product_id || s.product_name;
    if (!patientMap[k].testsMap[pid]) {
      patientMap[k].testsMap[pid] = {
        product_id: s.product_id,
        product_name: s.product_name,
        barcode: s.barcode,
        sampel_type: s.sampel_type,
        sample_id: s.id,
        sample_status: s.status,
        results: []
      };
    } else {
      if (s.barcode && !patientMap[k].testsMap[pid].barcode) {
        patientMap[k].testsMap[pid].barcode = s.barcode;
      }
    }
  });

  // 2. Ambil dari labResults (hasil terdaftar)
  (labResults || []).forEach(r => {
    const k = r.admission_id || r.visit_number || r.patient_name;
    if (!k) return;
    if (!patientMap[k]) {
      patientMap[k] = {
        admission_id: r.admission_id,
        patient_name: r.patient_name,
        visit_number: r.visit_number,
        mr_number: r.mr_number,
        created_at: r.created_at,
        collected_at: null,
        received_at: null,
        testsMap: {}
      };
    }
    const pid = r.product_id || r.product_name;
    if (!patientMap[k].testsMap[pid]) {
      patientMap[k].testsMap[pid] = {
        product_id: r.product_id,
        product_name: r.product_name,
        barcode: null,
        sampel_type: null,
        sample_id: r.sample_id,
        sample_status: null,
        results: [r]
      };
    } else {
      patientMap[k].testsMap[pid].results.push(r);
    }
  });

  // 3. Hitung status per-test & status pasien keseluruhan
  const patients = Object.values(patientMap).map(p => {
    const tests = Object.values(p.testsMap).map(t => {
      let status = 'Pending';
      const results = t.results || [];
      if (results.some(r => r.status === 'Approved' || r.status === 'Released')) {
        status = 'Approve';
      } else if (results.some(r => r.status === 'Validated')) {
        status = 'Validate';
      } else if (results.some(r => r.result_value || r.status === 'Draft')) {
        status = 'Enter Result';
      } else {
        status = 'Pending';
      }

      const firstRes = results.find(r => r.result_value);
      const resultVal = firstRes ? `${firstRes.result_value} ${firstRes.unit || ''}`.trim() : null;

      return {
        ...t,
        status,
        resultVal
      };
    });

    let patientStatus = 'Pending';
    if (tests.length > 0) {
      if (tests.every(t => t.status === 'Approve')) {
        patientStatus = 'Approve';
      } else if (tests.every(t => t.status === 'Validate' || t.status === 'Approve')) {
        patientStatus = 'Validate';
      } else if (tests.some(t => t.status === 'Enter Result' || t.status === 'Validate' || t.status === 'Approve')) {
        patientStatus = 'Enter Result';
      } else {
        patientStatus = 'Pending';
      }
    }

    return {
      ...p,
      tests,
      patientStatus
    };
  });

  // Filter pencarian
  let filtered = patients;
  if (_wlSearchQuery) {
    const q = _wlSearchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      (p.patient_name || '').toLowerCase().includes(q) ||
      (p.mr_number || '').toLowerCase().includes(q) ||
      (p.visit_number || '').toLowerCase().includes(q) ||
      p.tests.some(t => (t.product_name || '').toLowerCase().includes(q) || (t.barcode || '').toLowerCase().includes(q))
    );
  }

  if (_wlStatusFilter !== 'ALL') {
    filtered = filtered.filter(p => p.patientStatus === _wlStatusFilter || p.tests.some(t => t.status === _wlStatusFilter));
  }

  filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return filtered;
}

function wlStatusBadge(status) {
  const BADGES = {
    'Pending':      { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
    'Enter Result': { bg: '#EDE9FE', color: '#6D28D9', label: 'Enter Result' },
    'Validate':     { bg: '#E0F2FE', color: '#0369A1', label: 'Validated' },
    'Approve':      { bg: '#DCFCE7', color: '#166534', label: 'Approved' },
  };
  const b = BADGES[status] || BADGES['Pending'];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:700;background:${b.bg};color:${b.color}">${b.label}</span>`;
}

function renderWorklistTab(){
  const el = document.getElementById('lab-worklist'); if(!el) return;
  const patients = getWorklistPatientsData();

  if(!patients.some(p => p.admission_id == _wlSelPatient)) {
    _wlSelPatient = patients.length ? patients[0].admission_id : null;
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <input type="text" id="wl-search-input" value="${_wlSearchQuery}" placeholder="Cari Pasien / RM / Barcode / Test..."
          oninput="_wlSearchQuery=this.value;renderWorklistTab()"
          style="padding:6px 12px;font-size:12px;border:1px solid var(--border);border-radius:6px;width:240px">
        <div style="display:flex;gap:4px">
          ${['ALL','Pending','Enter Result','Validate','Approve'].map(st => `
            <button onclick="_wlStatusFilter='${st}';renderWorklistTab()"
              class="btn btn-xs ${st===_wlStatusFilter?'btn-teal':'btn-ghost'}" style="font-weight:600">
              ${st==='ALL'?'Semua':st}
            </button>
          `).join('')}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="openAnalyzerIntake()">Terima Hasil Alat</button>
      </div>
    </div>

    ${patients.length ? `
    <div style="display:grid;grid-template-columns:230px 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff">
      <div id="wl-list" style="border-right:1px solid var(--border);overflow-y:auto;max-height:660px;background:var(--lgray)"></div>
      <div id="wl-work" style="overflow-y:auto;max-height:660px;min-width:0"></div>
    </div>
    <datalist id="wl-note-presets">${LAB_NOTE_PRESETS.map(n=>`<option value="${n.replace(/"/g,'&quot;')}">`).join('')}</datalist>
    ` : `
    <div class="empty-state" style="padding:40px;background:#fff;border-radius:10px;border:1px solid var(--border)">
      <h3>Worklist Kosong</h3>
      <p style="color:var(--gray);font-size:12px">Belum ada order pasien atau sampel yang sesuai dengan filter.</p>
    </div>`}
  `;

  if(patients.length){
    renderWlList(patients);
    if(_wlSelPatient != null) renderWlWork(_wlSelPatient);
  }
}

function selectWorklistPatient(admId) {
  _wlSelPatient = admId;
  renderWlList(getWorklistPatientsData());
  renderWlWork(admId);
}

// ── Kolom kiri: daftar pasien minimal (Lab No + Nama + status) ──
function renderWlList(patients){
  const el=document.getElementById('wl-list'); if(!el) return;
  el.innerHTML = patients.map(p=>{
    const sel = p.admission_id == _wlSelPatient;
    return `<div onclick="selectWorklistPatient(${p.admission_id})"
      style="padding:9px 12px;border-bottom:1px solid var(--border);cursor:pointer;${sel?'background:var(--mint);border-left:3px solid var(--teal)':'border-left:3px solid transparent'}">
      <div style="font-size:10.5px;color:var(--gray);font-family:monospace">${p.visit_number||'—'}${p.mr_number?' · '+p.mr_number:''}</div>
      <div style="font-weight:700;font-size:13px;color:var(--navy);margin:1px 0 3px">${p.patient_name||'—'}</div>
      ${wlStatusBadge(p.patientStatus)}
    </div>`;
  }).join('') || '<div style="padding:16px;text-align:center;color:var(--gray);font-size:12px">Tidak ada pasien</div>';
}

// ── Kolom tengah: area kerja (tes collapsible + input + rujukan + flag + catatan) ──
async function renderWlWork(admId){
  const work=document.getElementById('wl-work'); if(!work) return;
  const p=getWorklistPatientsData().find(x=>x.admission_id==admId);
  if(!p){ work.innerHTML='<div style="color:var(--gray);font-size:12px;text-align:center;padding:34px">Pilih pasien di kiri.</div>'; return; }
  work.innerHTML='<div class="loading-row"><div class="spinner"></div></div>';

  const prodIds=[...new Set(p.tests.map(t=>t.product_id).filter(Boolean))];
  await Promise.all(prodIds.map(pid=>labLoadRR(pid)));
  const admD=await sbGet('admissions',`select=patient_name,patient_gender,patient_age,patient_blood_type,mr_number,visit_number&id=eq.${admId}`).catch(()=>[]);
  _wlAdm=admD?.[0]||{};

  work.innerHTML=`
    <div style="border-bottom:1px solid var(--border);padding:10px 14px;background:#F8FAFC;position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <span style="font-size:15px;font-weight:800;color:var(--navy)">${_wlAdm.patient_name||p.patient_name||''}</span>
        ${_wlAdm.patient_blood_type?`<span style="color:#DC2626;font-weight:800;margin-left:8px">${_wlAdm.patient_blood_type}</span>`:''}
        <div style="font-size:11px;color:var(--gray);font-family:monospace">${_wlAdm.mr_number||p.mr_number||''} · ${_wlAdm.visit_number||p.visit_number||''}${_wlAdm.patient_age?' · '+_wlAdm.patient_age+' th':''} · ${_wlAdm.patient_gender==='F'?'P':'L'}</div>
      </div>
      <div id="wl-actions"></div>
    </div>
    <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px">
      ${p.tests.map(t=>wlTestCard(t)).join('')}
    </div>`;

  renderWlActions(p);
  document.querySelectorAll('#wl-work .wl-val').forEach(inp=>{ if(inp.value.trim()) wlInterpret(inp); });
}

// Satu tes/panel = kartu collapsible; klik untuk buka daftar parameter.
function wlTestCard(t){
  const rows=(t.results||[]).slice().sort((a,b)=>(a.id||0)-(b.id||0));
  const editable = t.status==='Pending' || t.status==='Enter Result';
  const stColor = t.status==='Approve'?'#22C55E':t.status==='Validate'?'#0EA5E9':t.status==='Enter Result'?'#8B5CF6':'#F59E0B';
  return `<details ${editable?'open':''} style="background:#fff;border:1px solid var(--border);border-left:4px solid ${stColor};border-radius:8px;overflow:hidden">
    <summary style="cursor:pointer;padding:9px 12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12.5px;font-weight:700;color:var(--navy)">${t.product_name||'—'}
        <span style="font-size:10px;color:var(--gray);font-weight:400">· ${rows.length} parameter</span></span>
      ${wlStatusBadge(t.status)}
    </summary>
    <div style="border-top:1px solid #f1f5f9;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--lgray);color:var(--gray);font-size:10px;text-transform:uppercase">
          <th style="padding:5px 10px;text-align:left">Parameter</th>
          <th style="padding:5px 8px;text-align:left;width:100px">Rujukan</th>
          <th style="padding:5px 8px;text-align:left;width:118px">Hasil</th>
          <th style="padding:5px 4px;width:30px">Flag</th>
          <th style="padding:5px 8px;text-align:left;width:160px">Catatan</th>
        </tr></thead><tbody>
        ${rows.length?rows.map(r=>wlParamRow(r,editable)).join(''):`<tr><td colspan="5" style="padding:8px 10px;color:var(--gray)">Belum ada parameter (sampel belum masuk).</td></tr>`}
      </tbody></table>
    </div>
  </details>`;
}

function wlParamRow(r, editable){
  const pid=r.product_id, itemId=r.product_item_id||null;
  const rr=(_rrCache[pid]||[]).filter(x=> itemId?(x.product_item_id==itemId||x.product_item_id==null):x.product_item_id==null);
  const norm=rr.find(x=>x.value_type!=='qualitative'&&x.condition_type==='normal'&&x.range_min!=null&&x.range_max!=null);
  const refTxt=norm?`${norm.range_min}–${norm.range_max}`:(rr.filter(x=>x.value_type==='qualitative').map(x=>x.condition_name).join('/')||'—');
  const name=r.item_name||r.product_name||'—';
  const noteVal=(_wlNotes[r.id]!=null?_wlNotes[r.id]:(r.notes||''));
  const valCell = editable
    ? `<input type="text" class="wl-val" data-rid="${r.id}" data-item="${itemId||''}" data-prod="${pid}" value="${(r.result_value||'').replace(/"/g,'&quot;')}" oninput="wlInterpret(this)" style="width:104px;padding:4px 6px;border:1.5px solid var(--border);border-radius:5px">`
    : `<span style="font-weight:700">${r.result_value||'—'} ${r.unit||''}</span>`;
  const noteCell = editable
    ? `<input list="wl-note-presets" class="wl-note" value="${String(noteVal).replace(/"/g,'&quot;')}" placeholder="catatan…" oninput="_wlNotes[${r.id}]=this.value" style="width:100%;font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:5px">`
    : (noteVal?`<span style="font-size:11px;color:var(--gray)">${noteVal}</span>`:'<span style="color:var(--gray)">—</span>');
  return `<tr>
    <td style="padding:4px 10px;border-bottom:1px solid #f5f7fa">${name}${r.unit?` <span style="font-size:9.5px;color:var(--gray)">${r.unit}</span>`:''}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #f5f7fa;color:var(--gray);font-size:11px">${refTxt}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #f5f7fa">${valCell}</td>
    <td style="padding:4px 4px;border-bottom:1px solid #f5f7fa;text-align:center" class="wl-flag"></td>
    <td style="padding:4px 8px;border-bottom:1px solid #f5f7fa">${noteCell}</td>
  </tr>`;
}

function wlInterpret(input){
  const tr=input.closest('tr'); const cell=tr.querySelector('.wl-flag'); if(!cell) return;
  const pid=input.dataset.prod, itemId=input.dataset.item?parseInt(input.dataset.item):null;
  const raw=input.value.trim();
  const rr=(_rrCache[pid]||[]).filter(x=> itemId?(x.product_item_id==itemId||x.product_item_id==null):x.product_item_id==null);
  if(raw===''){ cell.innerHTML=''; input.style.borderColor='var(--border)'; return; }
  const m=matchRefRange(rr, raw, _wlAdm.patient_gender, _wlAdm.patient_age);
  const num=parseFloat(raw);
  const norm=rr.find(x=>x.condition_type==='normal'&&x.range_min!=null&&x.range_max!=null);
  let flag=''; if(norm&&!isNaN(num)){ if(num>norm.range_max)flag='H'; else if(num<norm.range_min)flag='L'; }
  const crit=m?((!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical'):false;
  const c=m?labColor(m.color_code):'#94A3B8';
  cell.innerHTML= crit?'<span style="font-weight:800;color:#DC2626" title="Nilai kritis">!!</span>'
    : flag?`<span style="font-weight:800;color:${flag==='H'?'#EF4444':'#0EA5E9'}">${flag}</span>`
    : (m?`<span style="color:${c}">●</span>`:'');
  input.style.borderColor=c;
}

// Bilah aksi bawah header: Simpan (jika masih entry) + Validasi + Approve.
function renderWlActions(p){
  const box=document.getElementById('wl-actions'); if(!box) return;
  const allRows = p.tests.flatMap(t=>t.results||[]);
  const hasEntry       = allRows.some(r=>r.status==='Draft');                       // masih ada draft utk diisi/simpan
  const hasFilledDraft = allRows.some(r=>r.status==='Draft' && r.result_value);     // draft terisi → siap divalidasi
  const hasValidated   = allRows.some(r=>r.status==='Validated');                    // tervalidasi → siap approve
  let b='';
  if(hasEntry) b+=`<button class="btn btn-teal btn-sm" onclick="wlSaveResults(${p.admission_id})">Simpan Hasil</button>`;
  if(hasFilledDraft) b+=`<button class="btn btn-sm" style="background:#0369A1;color:#fff;border-color:#0369A1" onclick="wlValidate(${p.admission_id})">Validasi</button>`;
  if(hasValidated) b+=`<button class="btn btn-sm" style="background:#166534;color:#fff;border-color:#166534" onclick="wlApprove(${p.admission_id})">Approve &amp; Rilis</button>`;
  box.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap">${b||'<span style="font-size:11px;color:var(--gray)">Semua hasil sudah dirilis</span>'}</div>`;
}

// Simpan semua nilai yang diketik (draft) + interpretasi + catatan.
async function wlSaveResults(admId){
  const inputs=[...document.querySelectorAll('#wl-work .wl-val')];
  let ok=0, changed=0;
  for(const inp of inputs){
    const rid=inp.dataset.rid; const r=labResults.find(x=>x.id==rid); if(!r) continue;
    const val=inp.value.trim();
    const noteChanged=(_wlNotes[rid]!==undefined && (_wlNotes[rid]||'')!==(r.notes||''));
    if(val===(r.result_value||'') && !noteChanged) continue;   // tak berubah
    changed++;
    const pid=inp.dataset.prod, itemId=inp.dataset.item?parseInt(inp.dataset.item):null;
    const rr=(_rrCache[pid]||[]).filter(x=> itemId?(x.product_item_id==itemId||x.product_item_id==null):x.product_item_id==null);
    const num=parseFloat(val);
    const m=matchRefRange(rr, val, _wlAdm.patient_gender, _wlAdm.patient_age);
    const crit=m?((!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical'):false;
    const payload={
      result_value:val||null, result_numeric:isNaN(num)?null:num,
      ref_range_id:m?.id||null, normal_min:m?.range_min??null, normal_max:m?.range_max??null,
      critical_low:m?.critical_low??null, critical_high:m?.critical_high??null,
      interpretation:m?.interpretation||m?.condition_name||null, color_code:m?.color_code||'green',
      condition_name:m?.condition_name||null, condition_type:m?.condition_type||null,
      is_critical:crit, status:'Draft', updated_at:new Date().toISOString(),
    };
    if(_wlNotes[rid]!==undefined) payload.notes=_wlNotes[rid]||null;
    if(val && !r.entered_at){ payload.entered_by=labUser(); payload.entered_at=new Date().toISOString(); }
    try{ await sbPatch('lab_results',rid,payload); ok++; }catch(e){}
  }
  if(!changed){ toast('Tidak ada perubahan','warn'); return; }
  _wlNotes={};
  toast(`${ok} hasil disimpan`,'ok');
  await labRefresh();
}

// Validasi / Approve satu pasien — pakai ulang fungsi bersama, lalu refresh worklist.
async function wlValidate(admId){
  if(typeof validatePatientResults==='function'){ await validatePatientResults(admId); }
  renderWorklistTab();
}
async function wlApprove(admId){
  if(typeof approvePatientResults==='function'){ await approvePatientResults(admId); }
  renderWorklistTab();
}

// Buka input hasil per-tes
function entryFromSample(sampleId){
  const s=labSamples.find(x=>x.id==sampleId); if(!s) return;
  openResultEntry(s.admission_id, s.product_id);
}

// Input Batch
async function openBatchEntry(nameEnc){
  const name=decodeURIComponent(nameEnc);
  const inProc=labSamples.filter(s=>s.status==='In Process').filter(s=>{
    const p=labProduct(s.product_id);
    const key=s.analyzer_name || (p?.kategori) || 'Manual / Belum Ditentukan';
    return key===name;
  });
  if(!inProc.length){ toast('Tidak ada sampel','warn'); return; }

  await Promise.all([...new Set(inProc.map(s=>s.product_id))].map(pid=>labLoadRR(pid)));

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Input Batch — ${name}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
      Masukkan nilai lalu tekan <strong>Simpan Semua</strong>. Interpretasi & nilai kritis dihitung otomatis dari rentang rujukan.</div>
    <div class="table-wrap" style="max-height:420px;overflow-y:auto">
      <table><thead><tr>
        <th>Pasien</th><th>Tes</th><th style="width:120px">Hasil</th><th>Unit</th><th>Interpretasi</th>
      </tr></thead><tbody>
      ${inProc.map(s=>{
        const p=labProduct(s.product_id);
        if(p?.is_panel){
          return `<tr data-sample="${s.id}" data-prod="${s.product_id}">
            <td style="font-size:12px"><div style="font-weight:600">${s.patient_name||'—'}</div>
              <div style="font-size:10px;color:var(--gray)">${s.visit_number||''}</div></td>
            <td style="font-size:12px">${s.product_name||'—'} <span style="background:#EDE9FE;color:#6D28D9;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700">PANEL</span></td>
            <td colspan="2"><button class="btn btn-teal btn-xs" onclick="closeModalForce();openResultEntry(${s.admission_id},${s.product_id})">Input per parameter →</button></td>
            <td class="be-interp" style="font-size:11px;color:var(--gray)">panel</td>
          </tr>`;
        }
        return `<tr data-sample="${s.id}" data-prod="${s.product_id}">
          <td style="font-size:12px"><div style="font-weight:600">${s.patient_name||'—'}</div>
            <div style="font-size:10px;color:var(--gray)">${s.visit_number||''}</div></td>
          <td style="font-size:12px">${s.product_name||'—'}</td>
          <td><input type="text" class="be-val" style="width:110px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px"
            oninput="beInterpret(this)" placeholder="—"></td>
          <td style="font-size:11px;color:var(--gray)">${p?.satuan_hasil||''}
            <input type="hidden" class="be-unit" value="${p?.satuan_hasil||''}"></td>
          <td class="be-interp" style="font-size:11px;color:var(--gray)">—</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveBatchEntry()">Simpan Semua</button>
    </div>`);
}

function beInterpret(input){
  const tr=input.closest('tr');
  const pid=tr.dataset.prod;
  const cell=tr.querySelector('.be-interp');
  const raw=input.value.trim();
  const rrs=_rrCache[pid]||[];
  if(raw===''||!rrs.length){ cell.textContent='—'; cell.style.color='var(--gray)'; input.style.borderColor='var(--border)'; return; }
  const m=matchRefRange(rrs,raw);
  if(!m){ cell.textContent='—'; cell.style.color='var(--gray)'; input.style.borderColor='var(--border)'; return; }
  const num=parseFloat(raw);
  const c=labColor(m.color_code);
  const crit=(!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical';
  cell.innerHTML=`<span style="color:${c};font-weight:700">${m.condition_name||m.interpretation||'—'}${crit?' [KRITIS]':''}</span>`;
  input.style.borderColor=c;
}

async function saveBatchEntry(){
  const rows=[...document.querySelectorAll('#modal-box tbody tr')];
  const toSave=rows.filter(tr=>{ const i=tr.querySelector('.be-val'); return i && i.value.trim(); });
  if(!toSave.length){ toast('Belum ada nilai diisi','warn'); return; }
  let ok=0;
  for(const tr of toSave){
    const sid=parseInt(tr.dataset.sample);
    const pid=parseInt(tr.dataset.prod);
    const val=tr.querySelector('.be-val').value.trim();
    const unit=tr.querySelector('.be-unit').value||null;
    const s=labSamples.find(x=>x.id==sid)||{};
    const num=parseFloat(val);
    const rrs=_rrCache[pid]||[];
    const m=matchRefRange(rrs, val);
    const crit=m?((!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical'):false;
    const payload={
      result_value:val, result_numeric:isNaN(num)?null:num, unit,
      ref_range_id:m?.id||null, normal_min:m?.range_min??null, normal_max:m?.range_max??null,
      critical_low:m?.critical_low??null, critical_high:m?.critical_high??null,
      interpretation:m?.interpretation||m?.condition_name||null, color_code:m?.color_code||'green',
      condition_name:m?.condition_name||null, condition_type:m?.condition_type||null,
      is_critical:crit, is_auto:false, status:'Draft',
      entered_by:labUser(), entered_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    };
    try {
      let r=labResults.find(x=>x.sample_id==sid) ||
            labResults.find(x=>x.admission_id==s.admission_id && x.product_id==pid && x.status==='Draft');
      if(r) await sbPatch('lab_results',r.id,payload);
      else  await sbPost('lab_results',{...payload, sample_id:sid, admission_id:s.admission_id,
              visit_number:s.visit_number, patient_name:s.patient_name, product_id:pid, product_name:s.product_name});
      await sbPatch('lab_samples',sid,{status:'Done',updated_at:new Date().toISOString()});
      ok++;
    } catch(e){ }
  }
  toast(`${ok} hasil tersimpan → siap divalidasi`,'ok');
  closeModalForce(); labRefresh();
}