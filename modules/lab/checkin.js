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

function renderCheckinTab(){
  const el=document.getElementById('lab-checkin'); if(!el) return;
  const pending=labSamples.filter(s=>['Pending','Rejected'].includes(s.status));

  // Daftar tunggu — dikelompokkan per pasien (status check-in s/d selesai)
  const byPat={};
  labSamples.forEach(s=>{
    const k=s.admission_id||s.visit_number||s.patient_name;
    if(!byPat[k]) byPat[k]={admission_id:s.admission_id,patient_name:s.patient_name,
      visit_number:s.visit_number,mr:s.mr_number,samples:[]};
    byPat[k].samples.push(s);
  });
  const wait=Object.values(byPat);

  el.innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">
      <input class="table-search" id="barcode-input" placeholder="Scan / ketik barcode label atau nama pasien..."
        onkeydown="if(event.key==='Enter')checkInBarcode(this.value)" style="flex:1">
      <button class="btn btn-teal" onclick="checkInBarcode(document.getElementById('barcode-input').value)">Check In</button>
      <button class="btn btn-ghost" onclick="openSampleForm()">+ Manual</button>
    </div>
    <div id="lab-pending-labels"></div>

    <div class="lis-title">Daftar Tunggu Pasien — check-in s/d selesai</div>
    <div class="table-wrap"><table><thead><tr>
      <th>MR / Kunjungan</th><th>Pasien</th><th>Sampel</th><th>Pending</th><th>Proses</th><th>Selesai</th><th>Progress</th><th>Aksi</th>
    </tr></thead><tbody>
    ${wait.length ? wait.map(p=>{
      const total=p.samples.length;
      const pend=p.samples.filter(s=>s.status==='Pending').length;
      const proc=p.samples.filter(s=>s.status==='In Process').length;
      const done=p.samples.filter(s=>s.status==='Done').length;
      const rej =p.samples.filter(s=>s.status==='Rejected').length;
      const pct=Math.round(done/Math.max(1,total)*100);
      return `<tr>
        <td style="font-family:monospace;font-size:11px">${p.mr||'—'}<div style="color:var(--gray)">${p.visit_number||''}</div></td>
        <td style="font-weight:600">${p.patient_name||'—'}</td>
        <td style="font-size:11px;color:var(--gray)">${total} sampel${rej?` · ${rej} ditolak`:''}</td>
        <td style="text-align:center">${pend?`<span class="lis-badge warn">${pend}</span>`:'—'}</td>
        <td style="text-align:center">${proc?`<span class="lis-badge info">${proc}</span>`:'—'}</td>
        <td style="text-align:center">${done?`<span class="lis-badge ok">${done}</span>`:'—'}</td>
        <td><div class="lis-bar"><span style="width:${pct}%"></span></div></td>
        <td><div class="act-row">
          ${pend?`<button class="btn btn-teal btn-xs" onclick="processAllForPatient(${p.admission_id})">Proses Semua</button>`:''}
          <button class="btn btn-outline btn-xs" onclick="goInputResult(${p.admission_id})">Input Hasil</button>
        </div></td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--gray)">Belum ada sampel. Scan barcode untuk check-in.</td></tr>`}
    </tbody></table></div>

    ${pending.length?`
    <div class="lis-title">Sampel Pending — perlu diproses / ditolak</div>
    <div class="table-wrap"><table><thead><tr>
      <th>Barcode</th><th>Pasien</th><th>Tes</th><th>Sampel</th><th>Terima</th><th>Status</th><th>Aksi</th>
    </tr></thead><tbody>
    ${pending.map(s=>`<tr>
      <td style="font-family:monospace;font-size:11.5px;font-weight:700">${s.barcode||'—'}</td>
      <td><div style="font-weight:600">${s.patient_name||'—'}</div><div style="font-size:10px;color:var(--gray)">${s.visit_number||''}</div></td>
      <td style="font-size:12px">${s.product_name||'—'}</td>
      <td style="font-size:11px;color:var(--gray)">${s.sampel_type||'—'}</td>
      <td style="font-size:11px;color:var(--gray)">${s.received_at?new Date(s.received_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
      <td>${s.status==='Rejected'
        ? `<span title="${s.rejection_reason||''}" class="lis-badge" style="background:#FFEBEE;color:#C62828">Ditolak</span>`
        : `<span class="lis-badge warn">Pending</span>`}</td>
      <td><div class="act-row">
        ${s.status==='Pending'?`<button class="act-btn" style="color:#22C55E;font-size:11px" onclick="processSample(${s.id})">Proses</button>
          <button class="act-btn del" onclick="rejectSample(${s.id})">Tolak</button>`
          :`<button class="act-btn" style="color:#0EA5E9;font-size:11px" onclick="processSample(${s.id})">Terima Ulang</button>`}
      </div></td>
    </tr>`).join('')}
    </tbody></table></div>`:''}`;
  loadPendingLabels();
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
            <div onclick="openLabelCheckin(${l.id})" style="cursor:pointer;background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:8px 12px;min-width:180px">
              <div style="font-family:monospace;font-size:11px;font-weight:700;color:var(--teal)">${l.label_barcode}</div>
              <div style="font-size:12px;font-weight:600">${l.patient_name}</div>
              <div style="font-size:10.5px;color:var(--gray)">
                <span style="background:#0891B2;color:#fff;padding:1px 6px;border-radius:6px;margin-right:4px">${l.sampel_type}</span>
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
      <span style="background:#0891B2;color:#fff;padding:1px 8px;border-radius:8px;font-size:10.5px;margin-left:4px">${label.sampel_type}</span>
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
    <div style="background:#FFF8E1;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
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