// ═══════════════════════════════════════════════════════════════
// LIS · PENERIMAAN SAMPEL (Specimen Reception)
// - Scan barcode label / cari pasien
// - Check-in 1 label (banyak tes) sekaligus
// - Check-in manual per admission
// - Penolakan sampel dengan alasan terstandar (pre-analytic)
// ═══════════════════════════════════════════════════════════════

// Alasan penolakan sampel standar (fase pra-analitik)
const SAMPLE_REJECT_REASONS = [
  'Hemolisis','Lipemik','Ikterik','Sampel beku (clotted)',
  'Volume tidak cukup (QNS)','Tabung salah / antikoagulan salah',
  'Label tidak sesuai / tidak terbaca','Sampel tanpa identitas',
  'Kontaminasi','Sampel bocor / tumpah','Melewati batas waktu stabilitas',
];

let _ciSel = null;   // sampel terpilih untuk panel detail (split kanan)

function renderCheckinTab(){
  const el=document.getElementById('lab-checkin'); if(!el) return;

  // Satu daftar untuk SEMUA sampel. Urut: yang butuh aksi dulu, lalu selesai.
  const order={Pending:0,Rejected:1,'In Process':2,Done:3};
  const samples=(labSamples||[]).slice().sort((a,b)=>{
    const oa=order[a.status]??9, ob=order[b.status]??9;
    if(oa!==ob) return oa-ob;
    return new Date(b.received_at||b.created_at||0)-new Date(a.received_at||a.created_at||0);
  });
  const pendCount=samples.filter(s=>s.status==='Pending').length;
  if(!samples.some(s=>s.id==_ciSel)) _ciSel = samples.length?samples[0].id:null;

  el.innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
      <input class="table-search" id="barcode-input" placeholder="🔍 Scan / ketik barcode tabung (L260830-001) atau nama pasien..."
        onkeydown="if(event.key==='Enter')checkInBarcode(this.value)" style="flex:1;min-width:240px">
      <button class="btn btn-teal" onclick="checkInBarcode(document.getElementById('barcode-input').value)">Check In Barcode</button>
      <button class="btn btn-ghost" style="border:1px solid var(--teal);color:var(--teal);font-weight:750" onclick="navigate('anamnesa')">+ Order Walk-In LIS (Mandiri)</button>
      <button class="btn btn-ghost" style="border:1px solid var(--border);font-weight:700" onclick="openSampleForm()">🏥 Tarik Order HIS</button>
    </div>
    <div id="lab-pending-labels"></div>

    <div class="lis-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>Daftar Sampel — check-in s/d selesai</span>
      ${pendCount?`<button class="btn btn-teal btn-xs" onclick="processAllPending()">Proses Semua Pending (${pendCount})</button>`:''}
    </div>
    ${samples.length?`
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 372px;gap:14px;align-items:start">
      <div class="table-wrap" style="max-height:648px;overflow:auto;margin:0">
        <table style="margin:0"><thead><tr>
          <th>Barcode</th><th>Pasien</th><th>Sampel</th><th>Jam Diterima</th><th>Status</th><th>Aksi</th>
        </tr></thead><tbody>
        ${samples.map(s=>{
          const st=checkinSampleStatus(s);
          const jam=s.received_at||s.collected_at;
          const sel=s.id==_ciSel;
          return `<tr class="ci-row" data-id="${s.id}" onclick="selectCheckinSample(${s.id})"
            style="cursor:pointer;transition:background .15s;${sel?'background:var(--mint);box-shadow:inset 3px 0 0 var(--teal)':''}"
            onmouseover="if(this.dataset.id!=='${_ciSel}')this.style.background='var(--lgray)'"
            onmouseout="if(this.dataset.id!=='${_ciSel}')this.style.background=''">
            <td style="font-family:monospace;font-size:11.5px;font-weight:700">${s.barcode||'—'}</td>
            <td><div style="font-weight:600">${s.patient_name||'—'}</div><div style="font-size:10px;color:var(--gray)">${s.visit_number||''}</div></td>
            <td style="font-size:11px;color:var(--gray)">${s.sampel_type||'—'}</td>
            <td style="font-size:11px;color:var(--gray)">${jam?new Date(jam).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</td>
            <td><span class="lis-badge" style="background:${st.bg};color:${st.color}"${s.status==='Rejected'&&s.rejection_reason?` title="${s.rejection_reason.replace(/"/g,'&quot;')}"`:''}>${st.label}</span></td>
            <td onclick="event.stopPropagation()"><div class="act-row">${checkinActions(s)}</div></td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>
      <div id="ci-detail" style="position:sticky;top:12px;background:var(--white);border:1px solid var(--border);border-radius:12px;overflow:hidden;max-height:calc(100vh - 130px);overflow-y:auto;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,.06))"></div>
    </div>`:`<div class="empty-state"><div class="ico">🧪</div><h3>Belum ada sampel</h3><p>Scan barcode untuk check-in.</p></div>`}`;
  loadPendingLabels();
  if(samples.length && _ciSel!=null) renderCheckinDetail(_ciSel);
}

// Status gabungan sampel (pra-analitik + progres hasil).
function checkinSampleStatus(s){
  if(s.status==='Rejected') return {label:'Ditolak',bg:'#FFEBEE',color:'#C62828'};
  const rs=labResults.filter(r=>r.sample_id==s.id);
  if(rs.some(r=>r.status==='Approved'||r.status==='Released')) return {label:'Selesai',bg:'#DCFCE7',color:'#166534'};
  if(rs.some(r=>r.status==='Validated'))                       return {label:'Tervalidasi',bg:'#E0F2FE',color:'#0369A1'};
  if(rs.some(r=>r.result_value))                                return {label:'Input Hasil',bg:'#EDE9FE',color:'#6D28D9'};
  if(s.status==='In Process')                                   return {label:'Proses',bg:'#E0F2FE',color:'#0369A1'};
  return {label:'Pending',bg:'#FEF3C7',color:'#92400E'};
}

function checkinActions(s){
  const rs=labResults.filter(r=>r.sample_id==s.id);
  const hasVal=rs.some(r=>r.result_value&&String(r.result_value).trim());
  const isFinal=rs.some(r=>['Validated','Approved','Released'].includes(r.status));
  // Sampel tanpa hasil & belum final → boleh dihapus (mis. duplikat check-in ganda).
  const del = (!hasVal && !isFinal) ? `<button class="act-btn del" title="Hapus sampel (belum ada hasil)" onclick="deleteCheckinSample(${s.id})">🗑</button>` : '';
  if(s.status==='Rejected') return `<button class="act-btn" style="color:var(--info);font-size:11px" onclick="processSample(${s.id})">Terima Ulang</button>${del}`;
  if(s.status==='Pending')  return `<button class="act-btn" style="color:var(--success-strong);font-size:11px" onclick="processSample(${s.id})">Proses</button>
    <button class="act-btn del" onclick="rejectSample(${s.id})">Tolak</button>${del}`;
  if(rs.some(r=>r.status==='Approved'||r.status==='Released')) return `<span style="font-size:11px;color:var(--gray)">selesai</span>`;
  if(rs.some(r=>r.status==='Validated'))                       return `<button class="btn btn-outline btn-xs" onclick="switchLabTab('approval')">Approval →</button>`;
  return `<button class="btn btn-outline btn-xs" onclick="goInputResult(${s.admission_id})">Input Hasil</button>${del}`;
}

// Hapus sampel duplikat/salah — dijaga server (hanya jika belum ada hasil).
async function deleteCheckinSample(id){
  const s=labSamples.find(x=>x.id==id)||{};
  if(!confirm(`Hapus sampel ${s.barcode||('#'+id)} — ${s.product_name||''}?\nHanya bisa jika belum ada hasil (mis. duplikat check-in).`)) return;
  try{
    await sbRpc('lab_sample_delete',{p_sample_id:id});
    toast('Sampel dihapus','ok');
    if(_ciSel==id) _ciSel=null;
    await Promise.all([loadLabSamples(),loadLabResults()]);
    renderCheckinTab(); renderLabKPI();
  }catch(e){
    toast('❌ '+(e.message||e),'err');
  }
}

// Proses semua sampel Pending (lintas pasien).
async function processAllPending(){
  const ss=labSamples.filter(s=>s.status==='Pending');
  if(!ss.length){ toast('Tidak ada sampel pending','warn'); return; }
  for(const s of ss){ await sbPatch('lab_samples',s.id,{status:'In Process',received_at:new Date().toISOString()}).catch(()=>{}); }
  toast(`${ss.length} sampel diproses`,'ok');
  await loadLabSamples(); renderCheckinTab(); renderLabKPI();
}

// Pilih sampel → sorot baris + render panel detail kanan (tanpa expand).
function selectCheckinSample(sid){
  _ciSel=sid;
  document.querySelectorAll('#lab-checkin .ci-row').forEach(tr=>{
    const on = tr.dataset.id==String(sid);
    tr.style.background = on?'var(--mint)':'';
    tr.style.boxShadow = on?'inset 3px 0 0 var(--teal)':'';
  });
  renderCheckinDetail(sid);
}

// Panel detail: identitas + daftar tes + riwayat TAT (timeline vertikal).
function renderCheckinDetail(sid){
  const panel=document.getElementById('ci-detail'); if(!panel) return;
  const s=labSamples.find(x=>x.id==sid);
  if(!s){ panel.innerHTML='<div style="padding:26px;text-align:center;color:var(--gray);font-size:12px">Pilih sampel di kiri.</div>'; return; }
  const st=checkinSampleStatus(s);
  let list=labResults.filter(r=>r.sample_id==s.id);
  if(!list.length) list=labResults.filter(r=>r.admission_id==s.admission_id && r.product_id==s.product_id);
  const pick=(fn,last)=>{ const v=list.map(fn).filter(Boolean).sort(); return last?v.slice(-1)[0]:v[0]; };
  const fmt=t=>t?new Date(t).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):null;
  const eRow=list.find(r=>r.entered_at)||{}, vRow=list.find(r=>r.validated_at)||{}, aRow=list.find(r=>r.approved_at||r.released_at)||{};
  const steps=[
    {label:'Diterima',    at:s.received_at||s.collected_at,          by:s.collected_by,                         c:'#F59E0B'},
    {label:'Input Hasil', at:pick(r=>r.entered_at),                  by:eRow.entered_by,                        c:'#8B5CF6'},
    {label:'Validasi',    at:pick(r=>r.validated_at),                by:vRow.validated_by,                      c:'#0EA5E9'},
    {label:'Selesai',     at:pick(r=>r.approved_at||r.released_at,1), by:aRow.approved_by||aRow.released_by,     c:'#22C55E'},
  ];
  const testRows = list.length ? list.map(r=>`
    <div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--bg2)">
      <div style="min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--navy)">${r.item_name||r.product_name||'—'}</div>
        ${(r.interpretation||r.condition_name)?`<div style="font-size:10.5px;color:var(--gray)">${r.interpretation||r.condition_name}</div>`:''}
      </div>
      <div style="font-size:12.5px;font-weight:800;white-space:nowrap;color:${r.result_value?labColor(r.color_code):'#94A3B8'}">${r.result_value||'—'} <span style="font-size:10px;color:var(--gray);font-weight:600">${r.unit||''}</span></div>
    </div>`).join('') : '<div style="font-size:12px;color:var(--gray);padding:8px 0">Belum ada parameter.</div>';

  panel.innerHTML=`
    <div style="padding:14px 16px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,#F8FAFC,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="min-width:0">
          <div style="font-size:15px;font-weight:800;color:var(--navy)">${s.patient_name||'—'}</div>
          <div style="font-size:11px;color:var(--gray);font-family:monospace">${s.barcode||''}</div>
          <div style="font-size:11px;color:var(--gray);font-family:monospace">${s.visit_number||''}${s.sampel_type?' · '+s.sampel_type:''}</div>
        </div>
        <span class="lis-badge" style="background:${st.bg};color:${st.color};flex:0 0 auto">${st.label}</span>
      </div>
    </div>
    <div style="padding:14px 16px">
      <div style="font-size:10.5px;font-weight:800;color:var(--gray);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Daftar Tes · ${s.product_name||''}</div>
      ${testRows}
    </div>
    <div style="padding:2px 16px 16px">
      <div style="font-size:10.5px;font-weight:800;color:var(--gray);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Riwayat TAT</div>
      <div style="padding-left:2px">
        ${steps.map((sp,i)=>{
          const done=!!sp.at;
          return `<div style="display:flex;gap:10px;position:relative;padding-bottom:${i<steps.length-1?'14px':'0'}">
            ${i<steps.length-1?`<div style="position:absolute;left:5px;top:14px;bottom:0;width:2px;background:${done?sp.c:'#e5e7eb'}"></div>`:''}
            <div style="width:12px;height:12px;border-radius:50%;flex:0 0 auto;margin-top:2px;background:${done?sp.c:'#fff'};border:2px solid ${done?sp.c:'#cbd5e1'}"></div>
            <div style="min-width:0;flex:1">
              <div style="font-size:12px;font-weight:700;color:${done?'var(--navy)':'#94A3B8'}">${sp.label}</div>
              <div style="font-size:11px;color:var(--gray)">${fmt(sp.at)||'—'}${sp.by?` · <span style="color:var(--teal);font-weight:700">${sp.by}</span>`:''}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// Proses semua sampel Pending milik satu pasien
async function processAllForPatient(admissionId){
  const ss=labSamples.filter(s=>s.admission_id==admissionId && s.status==='Pending');
  if(!ss.length){ toast('Tidak ada sampel pending','warn'); return; }
  for(const s of ss){ await sbPatch('lab_samples',s.id,{status:'In Process',received_at:new Date().toISOString()}).catch(()=>{}); }
  toast(`✅ ${ss.length} sampel diproses`,'ok');
  await loadLabSamples(); renderCheckinTab(); renderWorklistTab(); renderLabKPI();
}

// Loncat ke tab Input Hasil dengan pasien terpilih (hanya bisa setelah check-in)
function goInputResult(admissionId){
  const idx=LAB_TABS.indexOf('result');
  const btn=document.querySelector(`#lab-tabs .tab-btn:nth-child(${idx+1})`);
  switchLabTab('result', btn);
  if(admissionId!=null){ if(typeof _resSel!=='undefined') _resSel=admissionId; renderResultTab(); }
}

async function loadPendingLabels(){
  const el=document.getElementById('lab-pending-labels'); if(!el) return;
  try {
    const labels=await sbGet('sample_labels','select=*&status=eq.Created&order=created_at.desc&limit=30').catch(()=>[]);
    if(!labels||!labels.length){ el.innerHTML=''; return; }
    const itemCounts=await Promise.all(labels.map(l=>
      sbGet('sample_label_items',`select=product_name&label_id=eq.${l.id}`).catch(()=>[])));
    el.innerHTML=`
      <div style="background:var(--mint);border-radius:var(--r);padding:12px 14px;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin-bottom:8px">
          🏷️ ${labels.length} Label Menunggu Check-In dari Klinik</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${labels.map((l,i)=>`
            <div onclick="openLabelCheckin(${l.id})" style="cursor:pointer;background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:8px 12px;min-width:180px">
              <div style="font-family:monospace;font-size:11px;font-weight:700;color:var(--teal)">${l.label_barcode}</div>
              <div style="font-size:12px;font-weight:600">${l.patient_name}</div>
              <div style="font-size:10.5px;color:var(--gray)">
                <span style="background:var(--teal);color:var(--on-accent);padding:1px 6px;border-radius:6px;margin-right:4px">${l.sampel_type}</span>
                ${itemCounts[i]?.length||0} tes</div>
            </div>`).join('')}
        </div>
      </div>`;
  } catch(e){ el.innerHTML=''; }
}

async function checkInBarcode(val){
  val=(val||'').trim(); if(!val) return;
  try {
    const labels=await sbGet('sample_labels',
      `select=*&label_barcode=ilike.${encodeURIComponent('%'+val+'%')}&status=eq.Created&limit=5`).catch(()=>[]);
    if(labels?.length){ await openLabelCheckin(labels[0].id); return; }
    let samples=await sbGet('lab_samples',`select=*&barcode=ilike.${encodeURIComponent('%'+val+'%')}&limit=5`);
    if(!samples?.length){
      const adms=await sbGet('admissions',`select=id,visit_number,patient_name,patient_gender,patient_age&patient_name=ilike.${encodeURIComponent('%'+val+'%')}&status=eq.Lab&limit=5`);
      if(adms?.length){ openCheckinForAdmission(adms[0]); return; }
    }
    if(samples?.length) await processSample(samples[0].id);
    else toast('Barcode label/pasien tidak ditemukan','warn');
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function openLabelCheckin(labelId){
  const [labelData, items]=await Promise.all([
    sbGet('sample_labels',`select=*&id=eq.${labelId}`),
    sbGet('sample_label_items',`select=*&label_id=eq.${labelId}`).catch(()=>[]),
  ]);
  const label=labelData?.[0]; if(!label){ toast('Label tidak ditemukan','err'); return; }

  let analyzerOpts='<option value="">-- Pilih Alat (opsional) --</option>';
  try {
    const azs=await sbGet('analyzers','select=id,nama_alat&status=eq.Aktif');
    analyzerOpts+=(azs||[]).map(a=>`<option value="${a.id}">${a.nama_alat}</option>`).join('');
  } catch(e){}

  const now=new Date().toISOString().slice(0,16);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Check In Label — ${label.label_barcode}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="background:var(--mint);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <strong>${label.patient_name}</strong> · ${label.visit_number} ·
      <span style="background:var(--teal);color:var(--on-accent);padding:1px 8px;border-radius:8px;font-size:10.5px;margin-left:4px">${label.sampel_type}</span>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">
      ${items.length} Tes dalam label ini — semua akan check-in sekaligus</div>
    <div style="max-height:180px;overflow-y:auto;margin-bottom:14px">
      ${items.map(it=>`<div style="padding:6px 10px;background:var(--bg2);border-radius:var(--r);margin-bottom:4px;font-size:12.5px">• ${it.product_name}</div>`).join('')}
    </div>
    <div class="form-row">
      <div class="form-group"><label>Volume Total (mL)</label><input type="number" id="lc-vol" step="0.1" placeholder="3"></div>
      <div class="form-group"><label>Waktu Pengambilan</label><input type="datetime-local" id="lc-collected" value="${now}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Diambil/Diterima Oleh</label><input type="text" id="lc-collector" value="${labUser()}"></div>
      <div class="form-group"><label>Alat Analyzer</label><select id="lc-analyzer">${analyzerOpts}</select></div>
    </div>
    <div class="form-group"><label>Catatan</label><input type="text" id="lc-notes" placeholder="Kondisi sampel..."></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveLabelCheckin(${labelId})">Check In Semua (${items.length} Tes)</button>
    </div>`);
}

async function saveLabelCheckin(labelId){
  const [labelData, items]=await Promise.all([
    sbGet('sample_labels',`select=*&id=eq.${labelId}`),
    sbGet('sample_label_items',`select=*&label_id=eq.${labelId}`).catch(()=>[]),
  ]);
  const label=labelData?.[0]; if(!label) return;

  const vol=parseFloat(document.getElementById('lc-vol')?.value)||null;
  const collected=document.getElementById('lc-collected')?.value||new Date().toISOString();
  const collector=document.getElementById('lc-collector')?.value.trim()||labUser();
  const azSel=document.getElementById('lc-analyzer');
  const azId=azSel?.value;
  const azName=azSel?.options[azSel?.selectedIndex]?.textContent?.trim()||'';
  const notes=document.getElementById('lc-notes')?.value.trim()||null;

  // ── DEDUPLICATE BY PRODUCT_ID ──
  // Panel tes (memiliki banyak komponen dengan product_id sama) hanya dibuatkan 1 baris di lab_samples.
  const uniqueItems = [];
  const seenProd = {};
  for(const it of items){
    if(!seenProd[it.product_id]){
      seenProd[it.product_id] = true;
      uniqueItems.push(it);
    }
  }

  // ── GENERATE CHRONOLOGICAL DATE-CODED BARCODE SEQUENCE (e.g. 202623070001) ──
  let startSeq = 1;
  const now = new Date();
  const yyyy = now.getFullYear();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `${yyyy}${dd}${mm}`; // YYYYDDMM, misal "20262307"

  try {
    const rows = await sbGet('lab_samples', `select=barcode&barcode=like.${prefix}*&order=barcode.desc&limit=1`).catch(() => []);
    if (rows && rows.length > 0) {
      const lastBarcode = rows[0].barcode;
      if (lastBarcode && lastBarcode.length >= 12) {
        const lastSeq = parseInt(lastBarcode.substring(8));
        if (!isNaN(lastSeq)) {
          startSeq = lastSeq + 1;
        }
      }
    }
  } catch(e) {
    console.error('[saveLabelCheckin] Failed to fetch last barcode sequence:', e);
  }

  try {
    for(let idx=0; idx<uniqueItems.length; idx++){
      const it = uniqueItems[idx];
      const seqStr = String(startSeq + idx).padStart(4, '0');
      const customBarcode = `${prefix}${seqStr}`;

      const sample=await sbPost('lab_samples',{
        barcode:customBarcode,
        admission_id:label.admission_id, visit_number:label.visit_number, patient_name:label.patient_name,
        product_id:it.product_id, product_name:it.product_name, sampel_type:label.sampel_type,
        volume_ml:vol, collected_at:collected, collected_by:collector,
        analyzer_id:parseInt(azId)||null, analyzer_name:azName||null,
        received_at:new Date().toISOString(), status:'Pending', notes, label_id:labelId,
      });
      const sid = Array.isArray(sample)? sample[0]?.id : sample?.id;
      await labCreateDraftResults(
        { admission_id:label.admission_id, sample_id:sid||null, visit_number:label.visit_number, patient_name:label.patient_name },
        it.product_id, it.product_name);
    }
    await sbPatch('sample_labels',labelId,{status:'CheckedIn',checked_in_at:new Date().toISOString(),collected_at:collected,collected_by:collector});
    if(typeof logActivity==='function') logActivity('checkin','sample_labels',labelId,`Check-in ${uniqueItems.length} tes`,label.patient_name);
    toast(`✅ ${uniqueItems.length} tes berhasil check-in dari 1 label`,'ok');

    // ── BARCODE BRIDGE: Cetak label sampel otomatis (barcode.js sudah ada, baru terhubung) ──────
    try {
      if (typeof printLabBarcodes === 'function') {
        const labelsToPrint = uniqueItems.map((it, idx) => ({
          label_barcode: `${prefix}${String(startSeq + idx).padStart(4,'0')}`,
          patient_name:  label.patient_name,
          mr_number:     label.mr_number || '',
          visit_number:  label.visit_number,
          patient_gender: label.patient_gender || '',
          patient_dob:   label.patient_dob || '',
          patient_age:   label.patient_age || '',
          sampel_type:   label.sampel_type || 'Darah Vena',
          tests:         [{ product_name: it.product_name }],
        }));
        setTimeout(() => printLabBarcodes(labelsToPrint), 500);
      }
    } catch(ePrint) { console.warn('[Checkin] Barcode print skip:', ePrint.message); }

    closeModalForce(); labRefresh();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function openCheckinForAdmission(adm){
  let prodOpts='<option value="">-- Pilih Tes --</option>';
  const prods=await loadLabProducts();
  prodOpts+=(prods||[]).map(p=>`<option value="${p.id}" data-sampel="${p.sampel_type||''}" data-name="${p.nama_tes}">${p.kode_internal} — ${p.nama_tes}</option>`).join('');

  let analyzerOpts='<option value="">-- Pilih Alat --</option>';
  try {
    const azs=await sbGet('analyzers','select=id,nama_alat&status=eq.Aktif');
    analyzerOpts+=(azs||[]).map(a=>`<option value="${a.id}" data-name="${a.nama_alat}">${a.nama_alat}</option>`).join('');
  } catch(e){}

  const now=new Date().toISOString().slice(0,16);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Check In Sampel — ${adm.patient_name}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="background:var(--mint);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <strong>${adm.visit_number}</strong> · ${adm.patient_name}</div>
    <div class="form-row">
      <div class="form-group"><label>Barcode Sampel *</label>
        <input type="text" id="sc-barcode" value="${adm.visit_number}-${Date.now().toString().slice(-4)}" placeholder="Scan atau ketik barcode"></div>
      <div class="form-group" style="grid-column:2/-1"><label>Tes / Pemeriksaan *</label>
        <select id="sc-prod" onchange="document.getElementById('sc-sampel').value=this.options[this.selectedIndex].dataset.sampel||''">${prodOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tipe Sampel</label><input type="text" id="sc-sampel" placeholder="Darah Vena, Urin..."></div>
      <div class="form-group"><label>Volume (mL)</label><input type="number" id="sc-vol" placeholder="2" step="0.1"></div>
      <div class="form-group"><label>Waktu Pengambilan</label><input type="datetime-local" id="sc-collected" value="${now}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Diambil Oleh</label><input type="text" id="sc-collector" value="${labUser()}"></div>
      <div class="form-group" style="grid-column:2/-1"><label>Alat Analyzer</label><select id="sc-analyzer">${analyzerOpts}</select></div>
    </div>
    <div class="form-group"><label>Catatan</label><input type="text" id="sc-notes" placeholder="Kondisi sampel, catatan khusus..."></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveSampleCheckin(${adm.id})">Check In</button>
    </div>`);
}

async function openSampleForm(){
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Check In Sampel Manual</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div class="form-group"><label>Cari No. Kunjungan / Nama Pasien</label>
      <input type="text" id="ci-search" placeholder="Ketik untuk cari..." oninput="searchAdmForCheckin(this.value)"></div>
    <div id="ci-results" style="max-height:300px;overflow-y:auto"></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Batal</button></div>`);
}

async function searchAdmForCheckin(q){
  if(!q||q.length<2) return;
  const el=document.getElementById('ci-results'); if(!el) return;
  try {
    const data=await sbGet('admissions',
      `select=id,visit_number,patient_name,patient_gender,patient_age,status&patient_name=ilike.${encodeURIComponent('%'+q+'%')}&order=created_at.desc&limit=10`);
    el.innerHTML=(data||[]).map(a=>`
      <div onclick="closeModalForce();openCheckinForAdmission(${JSON.stringify({id:a.id,visit_number:a.visit_number,patient_name:a.patient_name,patient_gender:a.patient_gender,patient_age:a.patient_age}).replace(/"/g,'&quot;')})"
        style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer">
        <div style="font-weight:600">${a.patient_name}</div>
        <div style="font-size:11px;color:var(--gray)">${a.visit_number} · ${a.status}</div>
      </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--gray)">Tidak ditemukan</div>';
  } catch(e){}
}

async function saveSampleCheckin(admissionId){
  const barcode=document.getElementById('sc-barcode').value.trim();
  const prodSel=document.getElementById('sc-prod');
  const prodId=prodSel?.value;
  const prodName=prodSel?.options[prodSel.selectedIndex]?.dataset.name||'';
  const azSel=document.getElementById('sc-analyzer');
  const azId=azSel?.value;
  const azName=azSel?.options[azSel?.selectedIndex]?.textContent?.trim()||'';

  if(!barcode){ toast('Barcode wajib diisi','err'); return; }
  if(!prodId){ toast('Pilih tes dulu','err'); return; }

  try {
    const admission=await sbGet('admissions',`select=patient_name,visit_number&id=eq.${admissionId}`);
    const adm=admission[0]||{};
    const sample=await sbPost('lab_samples',{
      barcode, admission_id:admissionId, visit_number:adm.visit_number, patient_name:adm.patient_name,
      product_id:parseInt(prodId), product_name:prodName,
      sampel_type:document.getElementById('sc-sampel').value.trim()||null,
      volume_ml:parseFloat(document.getElementById('sc-vol').value)||null,
      collected_at:document.getElementById('sc-collected').value||new Date().toISOString(),
      collected_by:document.getElementById('sc-collector').value.trim()||labUser(),
      analyzer_id:parseInt(azId)||null, analyzer_name:azName||null,
      received_at:new Date().toISOString(), status:'Pending',
      notes:document.getElementById('sc-notes').value.trim()||null,
    });
    const sid=Array.isArray(sample)?sample[0]?.id:sample?.id;
    await labCreateDraftResults(
      { admission_id:admissionId, sample_id:sid||null, visit_number:adm.visit_number, patient_name:adm.patient_name },
      parseInt(prodId), prodName);
    if(typeof logActivity==='function') logActivity('checkin','lab_samples',sid,`Check-in ${prodName}`,adm.patient_name);
    toast('✅ Sampel berhasil di check-in','ok');
    closeModalForce(); labRefresh();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function processSample(id){
  try {
    await sbPatch('lab_samples',id,{status:'In Process',received_at:new Date().toISOString()});
    toast('✅ Sampel diproses → masuk Worklist','ok');
    await loadLabSamples(); renderCheckinTab(); renderWorklistTab(); renderLabKPI();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

// Penolakan sampel dengan alasan terstandar (bukan prompt bebas)
function rejectSample(id){
  const s=labSamples.find(x=>x.id==id)||{};
  openModal(`
    <div class="modal-header">
      <div class="modal-title">🚫 Tolak Sampel</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="background:var(--warn-soft2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <strong>${s.patient_name||'—'}</strong> · ${s.product_name||'—'} · <span style="font-family:monospace">${s.barcode||''}</span></div>
    <div class="form-group"><label>Alasan Penolakan (pra-analitik) *</label>
      <select id="rej-reason">
        <option value="">-- Pilih alasan --</option>
        ${SAMPLE_REJECT_REASONS.map(r=>`<option value="${r}">${r}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>Keterangan Tambahan</label>
      <input type="text" id="rej-note" placeholder="Detail, tindak lanjut (mis. minta sampel ulang)..."></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-red" onclick="confirmRejectSample(${id})">🚫 Tolak Sampel</button>
    </div>`);
}

async function confirmRejectSample(id){
  const reason=document.getElementById('rej-reason')?.value;
  const note=document.getElementById('rej-note')?.value.trim()||'';
  if(!reason){ toast('Pilih alasan penolakan','err'); return; }
  const full=note?`${reason} — ${note}`:reason;
  try {
    await sbPatch('lab_samples',id,{status:'Rejected',rejection_reason:full});
    if(typeof logActivity==='function') logActivity('reject','lab_samples',id,'Sampel ditolak: '+full);
    toast('Sampel ditolak','warn');
    closeModalForce();
    await loadLabSamples(); renderCheckinTab(); renderLabKPI();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function openWalkinLabModal() {
  const prods = await loadLabProducts();
  const prodOptions = (prods || []).map(p => `<option value="${p.id}" data-price="${p.harga_dasar || p.tarif || 0}" data-sample="${p.sampel_type || 'Darah Vena'}" data-name="${p.nama_tes}">${p.kode_internal || 'LAB'} — ${p.nama_tes} (${p.sampel_type || 'Darah'})</option>`).join('');

  const today = new Date();
  const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');
  const randSeq = String(Math.floor(Math.random() * 900) + 100);
  const autoBarcode = `L${dateStr}-${randSeq}`;
  const autoVisit = `WALK-LAB-${dateStr}-${randSeq}`;

  openModal(`
    <div class="modal-header">
      <div>
        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); padding:2px 8px; border-radius:999px; font-size:10.5px; font-weight:800; color:#10B981; margin-bottom:4px;">
          🩸 ADMISI LAB MANDIRI &bull; WALK-IN DIRECT
        </div>
        <div class="modal-title" style="font-size:17px; font-weight:800;">Registrasi Pasien &amp; Order Pemeriksaan Lab</div>
      </div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:14px; font-weight:700;">&times;</button>
    </div>

    <div style="max-height:75vh; overflow-y:auto; padding:2px 4px;">
      <!-- DATA PASIEN -->
      <div style="background:var(--bg2); padding:14px; border-radius:10px; border:1px solid var(--border); margin-bottom:14px;">
        <div style="font-size:12.5px; font-weight:800; color:var(--text); margin-bottom:10px;">📋 Identitas Pasien Walk-in</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="form-group">
            <label style="font-size:11.5px; font-weight:700;">Nama Lengkap Pasien *</label>
            <input type="text" id="walkin-name" placeholder="Contoh: Tn. Bambang Irawan" required style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
          </div>
          <div class="form-group">
            <label style="font-size:11.5px; font-weight:700;">NIK / No. KTP</label>
            <input type="text" id="walkin-nik" placeholder="16 Digit NIK" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
          </div>
          <div class="form-group">
            <label style="font-size:11.5px; font-weight:700;">Jenis Kelamin *</label>
            <select id="walkin-gender" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
              <option value="L">Laki-laki (L)</option>
              <option value="P">Perempuan (P)</option>
            </select>
          </div>
          <div class="form-group">
            <label style="font-size:11.5px; font-weight:700;">Usia / Tgl Lahir *</label>
            <input type="text" id="walkin-age" placeholder="Contoh: 35 th atau 1989-05-12" required style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
          </div>
          <div class="form-group">
            <label style="font-size:11.5px; font-weight:700;">No. WhatsApp / HP</label>
            <input type="tel" id="walkin-phone" placeholder="08xxxxxxxxxx" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
          </div>
          <div class="form-group">
            <label style="font-size:11.5px; font-weight:700;">Dokter / Faskes Perujuk</label>
            <input type="text" id="walkin-doctor" placeholder="dr. Pengirim / Atas Permintaan Sendiri (APS)" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
          </div>
        </div>
      </div>

      <!-- PEMILIHAN TES LAB -->
      <div style="background:var(--bg2); padding:14px; border-radius:10px; border:1px solid var(--border); margin-bottom:14px;">
        <div style="font-size:12.5px; font-weight:800; color:var(--text); margin-bottom:10px;">🧪 Parameter Pemeriksaan Laboratorium</div>
        <div class="form-group">
          <label style="font-size:11.5px; font-weight:700;">Pilih Tes Lab (530+ Parameter LOINC) *</label>
          <select id="walkin-test-select" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;" onchange="onWalkinTestSelected(this)">
            <option value="">-- Pilih Tes dari Katalog --</option>
            ${prodOptions}
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px;">
          <div class="form-group">
            <label style="font-size:11.5px; font-weight:700;">Barcode Tabung (Auto Accession)</label>
            <input type="text" id="walkin-barcode" value="${autoBarcode}" readonly style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); border-radius:6px; font-size:12.5px; font-weight:800; font-family:monospace; color:var(--teal);">
          </div>
          <div class="form-group">
            <label style="font-size:11.5px; font-weight:700;">Tipe Spesimen</label>
            <input type="text" id="walkin-sample-type" value="Darah Vena (EDTA / Serum)" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
          </div>
        </div>

        <div class="form-group" style="margin-top:10px;">
          <label style="font-size:11.5px; font-weight:700;">Diagnosis Klinis / Catatan Sampling</label>
          <input type="text" id="walkin-notes" placeholder="Puasa 10 jam, evaluasi diabetes, dll..." style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
        </div>
      </div>
    </div>

    <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" style="font-weight:800; padding:10px 20px;" onclick="submitWalkinLabOrder('${autoVisit}')">
        💾 Simpan &amp; Cetak Barcode Tabung
      </button>
    </div>
  `);
}

function onWalkinTestSelected(selectEl) {
  const opt = selectEl.options[selectEl.selectedIndex];
  if (opt && opt.dataset.sample) {
    const sampEl = document.getElementById('walkin-sample-type');
    if (sampEl) sampEl.value = opt.dataset.sample;
  }
}

async function submitWalkinLabOrder(visitNumber) {
  const patient_name = document.getElementById('walkin-name')?.value?.trim();
  const nik = document.getElementById('walkin-nik')?.value?.trim() || null;
  const patient_gender = document.getElementById('walkin-gender')?.value || 'L';
  const ageVal = document.getElementById('walkin-age')?.value?.trim();
  const patient_phone = document.getElementById('walkin-phone')?.value?.trim() || null;
  const doctor = document.getElementById('walkin-doctor')?.value?.trim() || 'APS';
  const barcode = document.getElementById('walkin-barcode')?.value?.trim();
  const sample_type = document.getElementById('walkin-sample-type')?.value?.trim() || 'Darah Vena';
  const notes = document.getElementById('walkin-notes')?.value?.trim() || null;

  const testSel = document.getElementById('walkin-test-select');
  const productId = parseInt(testSel?.value, 10);
  const productName = testSel?.options[testSel.selectedIndex]?.dataset.name || 'Pemeriksaan Lab';

  if (!patient_name) { toast('Nama Pasien wajib diisi', 'err'); return; }
  if (!productId) { toast('Pilih tes laboratorium dulu', 'err'); return; }

  try {
    const adm = await sbPost('admissions', {
      visit_number: visitNumber,
      patient_name,
      patient_nik: nik,
      patient_gender,
      patient_age: parseInt(ageVal, 10) || 30,
      patient_phone,
      doctor_name: doctor,
      unit: 'Laboratorium',
      status: 'In Progress',
      created_at: new Date().toISOString()
    });

    const admId = Array.isArray(adm) ? adm[0]?.id : adm?.id;

    const sample = await sbPost('lab_samples', {
      barcode,
      admission_id: admId || null,
      visit_number: visitNumber,
      patient_name,
      product_id: productId,
      product_name: productName,
      sampel_type: sample_type,
      volume_ml: 3.0,
      collected_at: new Date().toISOString(),
      collected_by: labUser(),
      received_at: new Date().toISOString(),
      status: 'Pending',
      notes
    });

    const sampleId = Array.isArray(sample) ? sample[0]?.id : sample?.id;

    await labCreateDraftResults(
      { admission_id: admId, sample_id: sampleId, visit_number: visitNumber, patient_name },
      productId,
      productName
    );

    toast('✅ Pasien Walk-in & Order Lab berhasil dibuat!', 'ok');

    if (typeof printLabBarcodes === 'function') {
      setTimeout(() => {
        printLabBarcodes([{
          barcode,
          patient_name,
          product_name: productName,
          visit_number: visitNumber,
          sample_type
        }]);
      }, 400);
    }

    closeModalForce();
    if (typeof labRefresh === 'function') labRefresh();
  } catch (e) {
    toast('❌ ' + e.message, 'err');
  }
}

window.openWalkinLabModal = openWalkinLabModal;
window.onWalkinTestSelected = onWalkinTestSelected;
window.submitWalkinLabOrder = submitWalkinLabOrder;