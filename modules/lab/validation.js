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

// Master catatan validator — pilihan cepat yang lazim dipakai, tapi kolomnya
// tetap bisa diketik bebas (datalist = pilih dari daftar ATAU tulis sendiri).
const LAB_NOTE_PRESETS = [
  'Duplo — pemeriksaan diulang dua kali',
  'Triplo — pemeriksaan diulang tiga kali',
  'Sampel hemolisis',
  'Sampel lipemik',
  'Sampel ikterik',
  'Sampel kurang (QNS)',
  'Sampel bekuan (clotted)',
  'Sampel diencerkan (diluted)',
  'Diperiksa ulang — hasil konsisten',
  'Hasil dikonfirmasi dengan sampel ulang',
  'Perlu sampel ulang',
  'Nilai kritis sudah dilaporkan ke DPJP',
];

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

  // Konteks klinis membantu analis menetapkan hasil: identitas + keluhan (anamnesa)
  // + diagnosis. Tiap sumber dibungkus catch sendiri agar tabel yang belum ada
  // (fase yang belum dijalankan) tidak menggagalkan seluruh header.
  const [admD, anamD, dxD, vitD] = await Promise.all([
    sbGet('admissions',`select=patient_name,patient_gender,patient_age,patient_dob,visit_number,patient_blood_type,mr_number&id=eq.${admId}`).catch(()=>[]),
    sbGet('anamnesas',`select=keluhan_utama,chief_complaint,riwayat_penyakit,notes&admission_id=eq.${admId}&order=created_at.desc&limit=1`).catch(()=>[]),
    sbGet('icd_diagnostics',`select=icd_code,diagnose_name,diagnosis,diagnose_type,is_primary&admission_id=eq.${admId}&order=created_at.desc`).catch(()=>[]),
    sbGet('vital_signs',`select=bp_systolic,bp_diastolic,pulse,temperature,spo2,weight&admission_id=eq.${admId}&order=recorded_at.desc&limit=1`).catch(()=>[]),
  ]);
  const admInfo=admD?.[0]||{};
  const anam=anamD?.[0]||null;
  const dxs=dxD||[];
  const vit=vitD?.[0]||null;

  const keluhan = anam ? (anam.keluhan_utama||anam.chief_complaint||anam.notes||'') : '';
  const dxUtama = d => d.is_primary===true || String(d.diagnose_type||'').toUpperCase()==='PRIMARY';
  const dxChips = dxs.map(d=>{
    const txt = `${d.icd_code||''} ${d.diagnose_name||d.diagnosis||''}`.trim();
    const utama = dxUtama(d);
    return `<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;
      background:${utama?'#FEE2E2':'#EEF2FF'};color:${utama?'#B91C1C':'#3730A3'}">${txt||'—'}${utama?' •utama':''}</span>`;
  }).join(' ');
  const vitStr = vit ? [
    (vit.bp_systolic)&&`TD ${vit.bp_systolic}/${vit.bp_diastolic||'—'}`,
    vit.pulse&&`Nadi ${vit.pulse}`, vit.temperature&&`Suhu ${vit.temperature}°`,
    vit.spo2&&`SpO₂ ${vit.spo2}%`,
  ].filter(Boolean).join(' · ') : '';

  const umur = admInfo.patient_age!=null ? `${admInfo.patient_age} th` : '';
  const jk = admInfo.patient_gender ? (String(admInfo.patient_gender).toLowerCase().startsWith('f')?'P':'L') : '';

  const pbar=valEl(mode,'pbar');
  if(pbar) pbar.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
      <div>
        <span style="font-size:15px;font-weight:800;color:var(--navy)">${admInfo.patient_name||''}</span>
        ${[jk,umur].filter(Boolean).length?`<span style="font-size:11px;color:var(--gray);margin-left:8px">${[jk,umur].filter(Boolean).join(' · ')}</span>`:''}
        ${admInfo.patient_blood_type?`<span style="color:#DC2626;font-weight:800;margin-left:8px">Gol. ${admInfo.patient_blood_type}</span>`:''}
      </div>
      <div style="font-size:11px;color:var(--gray);font-family:monospace">${admInfo.mr_number||''} · ${admInfo.visit_number||''}</div>
    </div>
    ${(keluhan||dxs.length||vitStr)?`
      <div style="margin-top:7px;padding-top:7px;border-top:1px dashed var(--border);display:flex;flex-direction:column;gap:4px">
        ${keluhan?`<div style="font-size:11.5px"><span style="color:var(--gray);font-weight:700">Keluhan:</span> ${keluhan}</div>`:''}
        ${dxs.length?`<div style="font-size:11.5px;display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span style="color:var(--gray);font-weight:700">Diagnosis:</span> ${dxChips}</div>`:''}
        ${vitStr?`<div style="font-size:11px;color:var(--text2)"><span style="color:var(--gray);font-weight:700">Vital:</span> ${vitStr}</div>`:''}
      </div>`
    :`<div style="margin-top:5px;font-size:10.5px;color:var(--gray);font-style:italic">Belum ada anamnesa/diagnosis untuk kunjungan ini</div>`}`;

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
    <div style="font-size:10px;color:var(--gray);margin:2px 0 4px">Pilih dari daftar atau ketik sendiri</div>
    <input list="${VAL_MODES[mode].prefix}-note-presets" id="${VAL_MODES[mode].prefix}-note-input"
      value="${(_valNotes[rid] ?? r.notes ?? '').replace(/"/g,'&quot;')}"
      placeholder="mis. Duplo, sampel lipemik…"
      style="width:100%;font-size:11.5px;padding:7px;border:1px solid var(--border);border-radius:6px"
      oninput="_valNotes[${rid}]=this.value">
    <datalist id="${VAL_MODES[mode].prefix}-note-presets">
      ${LAB_NOTE_PRESETS.map(p=>`<option value="${p.replace(/"/g,'&quot;')}">`).join('')}
    </datalist>
    <button class="btn btn-teal btn-sm" style="margin-top:6px;width:100%" onclick="saveResultNote(${rid},'${mode}')">💾 Simpan Catatan</button>
    <div style="font-size:10px;color:var(--gray);margin-top:4px">Catatan tersimpan ikut tampil di hasil cetak.</div>`;
}

// Simpan catatan validator ke DB (kolom notes) langsung, tanpa harus
// menunggu validasi — supaya catatan seperti "duplo" tidak hilang dan muncul di
// hasil cetak.
async function saveResultNote(rid, mode='validate'){
  const inp = valEl(mode,'note-input'); if(!inp) return;
  const note = inp.value.trim();
  try{
    await sbPatch('lab_results',rid,{notes: note||null, updated_at:new Date().toISOString()});
    const r = labResults.find(x=>x.id==rid); if(r) r.notes = note||null;   // segarkan salinan memori
    _valNotes[rid]=note;
    const p=labResults.find(x=>x.id==rid)||{};
    if(typeof logActivity==='function')
      logActivity('note','lab_results',rid,`Catatan hasil: ${note||'(dikosongkan)'}`,p.patient_name);
    toast('💾 Catatan tersimpan','ok');
  }catch(e){ toast('❌ Gagal menyimpan catatan: '+e.message,'err'); }
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
    if(note) payload.notes=note;
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
