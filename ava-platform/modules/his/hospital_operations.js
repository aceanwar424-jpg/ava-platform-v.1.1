// OWNED_BY: generic. Server workflow definitions, synthetic data only in tests.
let rsOpsPage = 'rs-patient-flow', rsOpsOffset = 0, rsOpsEpoch = 0;
let rsOpsTypes = [], rsOpsRows = [], rsOpsProfiles = [], rsOpsAdmissions = [], rsOpsBeds = [];
let rsOpsStatus = 'active', rsOpsBusy = false;
let rsOpsCapacityData = null;
const rsOpsLabels = {'rs-patient-flow':'Pusat Kendali Alur Pasien','rs-bed-reservation':'Reservasi & Daftar Tunggu Bed','rs-capacity':'Kapasitas Rawat Inap'};
function rsOpsEsc(v) { return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rsOpsKey() { return 'rs-' + crypto.randomUUID(); }
function rsOpsType() { return rsOpsTypes.find(t=>t.code===rsOpsPage); }
function rsOpsPatient(id) { const a=rsOpsAdmissions.find(a=>String(a.id)===String(id)); return a ? `${a.visit_number || a.id} · ${a.patient_name || ''}` : (id ? `Kunjungan #${id}` : 'Tanpa pasien'); }
function rsOpsMain() { return document.getElementById('main-content'); }
function rsOpsError(e) { const el=document.getElementById('rs-ops-error'); if(el){el.textContent=e.message || String(e);el.hidden=false;} }
async function renderHospitalOperations(params={}) {
  rsOpsPage=params.page || rsOpsPage; rsOpsOffset=0; rsOpsStatus='active';
  await rsOpsLoad();
}
async function rsOpsLoad() {
  const epoch=++rsOpsEpoch;
  rsOpsMain().innerHTML='<section aria-live="polite">Memuat operasional RS…</section>';
  try {
    const bedPage=['rs-bed-reservation','rs-capacity'].includes(rsOpsPage);
    const definitions=await sbGet('rs_workflow_types','select=*&order=label');
    const needPatients=rsOpsPage==='rs-bed-reservation'||rsOpsPage==='rs-patient-flow'||definitions.find(t=>t.code===rsOpsPage)?.patient_required;
    const [types,rows,profiles,admissions,beds,capacity]=await Promise.all([
      Promise.resolve(definitions),
      bedPage ? sbGet('rs_bed_reservations',`select=*&order=created_at.desc&limit=51&offset=${rsOpsOffset}`)
        : sbGet('rs_work_orders',`select=*&status=eq.${rsOpsStatus}${rsOpsPage==='rs-patient-flow'?'':`&kind=eq.${encodeURIComponent(rsOpsPage)}`}&order=priority.desc,updated_at.desc,id.desc&limit=51&offset=${rsOpsOffset}`),
      sbRpc('rs_staff_directory',{}),
      needPatients?sbGet('admissions','select=id,visit_number,patient_name&order=id.desc&limit=200'):Promise.resolve([]),
      bedPage ? sbGet('inpatient_beds','select=id,room_no,bed_no,status,is_active,tenant_id&order=id&limit=1001') : Promise.resolve([]),
      rsOpsPage==='rs-capacity'?sbRpc('rs_bed_capacity',{}):Promise.resolve(null),
    ]);
    if(epoch!==rsOpsEpoch||(typeof currentPage==='string'&&currentPage!==rsOpsPage))return;
    rsOpsTypes=types;rsOpsRows=rows;rsOpsProfiles=profiles;rsOpsAdmissions=admissions;rsOpsBeds=beds;
    rsOpsCapacityData=capacity;
    rsOpsPaint();
  } catch(e) {
    if(epoch!==rsOpsEpoch||(typeof currentPage==='string'&&currentPage!==rsOpsPage))return;
    rsOpsMain().innerHTML=`<section><h1>Operasional RS belum dapat dibaca</h1><p>${rsOpsEsc(e.message)}</p><p>Periksa akses serta migrasi 0070–0073 dan pemetaan tenant bed melalui runbook.</p><button id="rs-retry">Coba lagi</button></section>`;
    document.getElementById('rs-retry').onclick=rsOpsLoad;
  }
}
function rsOpsPaint() {
  const type=rsOpsType(), bed=rsOpsPage==='rs-bed-reservation', capacity=rsOpsPage==='rs-capacity';
  const label=type?.label || rsOpsLabels[rsOpsPage] || 'Operasional RS';
  const data=rsOpsRows.slice(0,50);
  rsOpsMain().innerHTML=`<section class="rs-ops"><style>
    .rs-ops{max-width:1200px;margin:auto;padding:16px}.rs-ops header,.rs-ops nav{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.rs-ops header{justify-content:space-between}.rs-ops h1{font-size:22px}.rs-ops button,.rs-ops select,.rs-ops input,.rs-ops textarea{padding:9px;border:1px solid #b5c5ce;border-radius:6px;font:inherit;max-width:100%;box-sizing:border-box}.rs-ops button{cursor:pointer}.rs-ops .rs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px;margin-top:16px}.rs-ops article,.rs-ops form,.rs-ops .rs-notice{border:1px solid #c7d5de;border-radius:8px;padding:16px;margin:12px 0}.rs-ops label{display:block;margin:12px 0}.rs-ops label input,.rs-ops label select,.rs-ops label textarea{display:block;width:100%;margin-top:4px}.rs-ops .rs-error{color:#a71926;background:#fff0f0;padding:12px}.rs-ops small{display:block}.rs-ops .rs-actions{display:flex;gap:8px;flex-wrap:wrap}.rs-ops .rs-kpi{font-size:24px;font-weight:bold}@media(max-width:600px){.rs-ops{padding:8px}.rs-ops h1{font-size:19px}}
  </style><header><h1>${rsOpsEsc(label)}</h1><div class="rs-actions"><button id="rs-source">Rawat inap</button><button id="rs-refresh">Muat ulang</button></div></header>
  <div class="rs-notice">${capacity?'Kapasitas saat ini dari bed yang dapat diakses. Indikator historis ALOS/BTO/TOI belum dihitung.':bed?'Reservasi memakai bed existing; persyaratan isolasi/kelas harus diverifikasi petugas sebelum alokasi.':'Workflow operasional menyimpan bukti dan handoff. Catatan klinis, stok, resep, tagihan dan keputusan medis tetap dibuat di modul sumber.'}</div>
  <p id="rs-ops-error" class="rs-error" role="alert" hidden></p>
  ${!bed&&!capacity?`<nav><label>Status <select id="rs-status">${['active','completed','cancelled'].map(s=>`<option ${s===rsOpsStatus?'selected':''}>${s}</option>`).join('')}</select></label>${type?'<button id="rs-new">+ Permintaan baru</button>':''}</nav>`:bed?'<button id="rs-new-bed">+ Permintaan bed</button>':''}
  <div id="rs-editor"></div>
  ${capacity?rsOpsCapacity():`<div class="rs-grid">${data.length?data.map(r=>bed?rsOpsBedCard(r):rsOpsCard(r)).join(''):'<p>Belum ada pekerjaan pada halaman ini.</p>'}</div><nav><button id="rs-prev" ${rsOpsOffset===0?'disabled':''}>Sebelumnya</button><span>Halaman ${1+rsOpsOffset/50}</span><button id="rs-next" ${rsOpsRows.length<=50?'disabled':''}>Berikutnya</button></nav>`}
  </section>`;
  document.getElementById('rs-refresh').onclick=rsOpsLoad;
  document.getElementById('rs-source').onclick=()=>navigate('inpatient');
  if(type){const links=[['Booking ruang / alat','rs-resource-booking'],['Stok antarunit','rs-shared-stock'],['Formulir klinis','rs-clinical-forms']];const target=rsOpsMain().querySelector('header .rs-actions');links.forEach(([label,page])=>{const button=document.createElement('button');button.textContent=label;button.onclick=()=>navigate(page);target.appendChild(button);});}
  document.getElementById('rs-status')?.addEventListener('change',e=>{rsOpsStatus=e.target.value;rsOpsOffset=0;rsOpsLoad();});
  document.getElementById('rs-new')?.addEventListener('click',rsOpsNew);
  document.getElementById('rs-new-bed')?.addEventListener('click',rsOpsNewBed);
  document.getElementById('rs-prev')?.addEventListener('click',()=>{rsOpsOffset=Math.max(0,rsOpsOffset-50);rsOpsLoad();});
  document.getElementById('rs-next')?.addEventListener('click',()=>{rsOpsOffset+=50;rsOpsLoad();});
  rsOpsMain().querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>rsOpsDetail(Number(b.dataset.detail)));
  rsOpsMain().querySelectorAll('[data-bed]').forEach(b=>b.onclick=()=>rsOpsAllocate(Number(b.dataset.bed)));
  rsOpsMain().querySelectorAll('[data-cancel-bed]').forEach(b=>b.onclick=()=>rsOpsCancelBed(Number(b.dataset.cancelBed)));
}
function rsOpsCard(r) {
  const t=rsOpsTypes.find(t=>t.code===r.kind),stage=t?.stages[r.stage],who=rsOpsProfiles.find(p=>p.id===r.assignee_id);
  return `<article><small>${rsOpsEsc(t?.label || r.kind)} · ${rsOpsEsc(r.priority)}</small><h2>${rsOpsEsc(r.title)}</h2><p>${rsOpsEsc(rsOpsPatient(r.admission_id))}</p><p>${rsOpsEsc(r.location)} · ${rsOpsEsc(r.status)}</p><p>Tahap: ${rsOpsEsc(stage?.label || 'Selesai')} (${r.stage}/${t?.stages.length || '?'})</p><p>Petugas: ${rsOpsEsc(who?.full_name || r.assignee_id || 'Belum ditugaskan')}</p><button data-detail="${r.id}">Detail & tindak lanjut</button></article>`;
}
function rsOpsBedCard(r) {
  const expired=r.status==='reserved' && new Date(r.expires_at)<=new Date();
  return `<article><h2>${rsOpsEsc(rsOpsPatient(r.admission_id))}</h2><p>${rsOpsEsc(r.requirements)}</p><p>Status: ${expired?'Reservasi kedaluwarsa':rsOpsEsc(r.status)} · Bed #${rsOpsEsc(r.bed_id || 'belum dialokasikan')}</p>${r.expires_at?`<p>Berlaku sampai: ${rsOpsEsc(new Date(r.expires_at).toLocaleString('id-ID'))}</p>`:''}<div class="rs-actions">${r.status==='waiting'?`<button data-bed="${r.id}">Alokasikan bed</button>`:''}${['waiting','reserved','expired'].includes(r.status)?`<button data-cancel-bed="${r.id}">Batalkan</button>`:''}</div></article>`;
}
function rsOpsCapacity() {
  const c=rsOpsCapacityData;if(!c||typeof c.active!=='number')return '<p>Ringkasan kapasitas tidak tersedia.</p>';
  return `<div class="rs-grid">${[['Bed aktif',c.active],['Terisi',c.occupied],['Okupansi saat ini',c.active?`${(c.occupied/c.active*100).toFixed(1)}%`:'Tidak tersedia'],['Siap dialokasikan',c.available],['Direservasi',c.reserved],['Perlu dibersihkan',c.cleaning],['Perbaikan',c.repair]].map(([l,v])=>`<article><p>${l}</p><span class="rs-kpi">${rsOpsEsc(v)}</span></article>`).join('')}</div>`;
}
function rsOpsPatientField(required) { return `<label>Kunjungan pasien<select name="admission_id" ${required?'required':''}><option value="">${required?'Pilih kunjungan':'Tanpa pasien'}</option>${rsOpsAdmissions.map(a=>`<option value="${a.id}">${rsOpsEsc(rsOpsPatient(a.id))}</option>`).join('')}</select></label><small>Daftar 200 kunjungan terbaru; gunakan ID kunjungan melalui pencarian bila belum tampil.</small><label>ID kunjungan lainnya (opsional)<input name="admission_override" type="number" min="1"></label>`; }
function rsOpsForm(inner,onSave) {
  const editor=document.getElementById('rs-editor');editor.innerHTML=`<form id="rs-form">${inner}<div class="rs-actions"><button type="submit">Simpan</button><button type="button" id="rs-close">Tutup</button></div></form>`;
  document.getElementById('rs-close').onclick=()=>editor.replaceChildren();
  const form=document.getElementById('rs-form');const key=rsOpsKey();
  form.onsubmit=async e=>{e.preventDefault();if(rsOpsBusy)return;rsOpsBusy=true;const button=form.querySelector('[type=submit]');button.disabled=true;
    try{await onSave(new FormData(form),key);await rsOpsLoad();}catch(err){rsOpsError(err);}finally{rsOpsBusy=false;if(button.isConnected)button.disabled=false;}
  };form.scrollIntoView({block:'start',behavior:'smooth'});
}
function rsOpsNew() {
  const t=rsOpsType();
  rsOpsForm(`<h2>Permintaan ${rsOpsEsc(t.label)}</h2><label>Judul<input name="title" minlength="3" maxlength="200" required></label><label>Unit / lokasi<input name="location" maxlength="200" required></label>${t.patient_required?rsOpsPatientField(false):''}<label>Prioritas<select name="priority"><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>`,async(d,k)=>{
    const admission=d.get('admission_override') || d.get('admission_id');if(t.patient_required&&!admission)throw Error('Pilih kunjungan pasien');
    const r=await sbRpc('rs_create_order',{p_kind:t.code,p_title:d.get('title'),p_location:d.get('location'),p_admission_id:admission?Number(admission):null,p_priority:d.get('priority'),p_request_key:k});if(!r?.id)throw Error('Server tidak mengonfirmasi penyimpanan');
  });
}
async function rsOpsDetail(id) {
  const r=rsOpsRows.find(r=>r.id===id),t=rsOpsTypes.find(t=>t.code===r.kind);if(!r||!t)return;
  const stage=t.stages[r.stage];
  rsOpsForm(`<h2>${rsOpsEsc(r.title)}</h2><p>${rsOpsEsc(rsOpsPatient(r.admission_id))}</p><label>Aksi<select name="action" id="rs-action"><option value="advance">Selesaikan tahap: ${rsOpsEsc(stage?.label || 'sudah selesai')}</option><option value="assign">Tugaskan petugas</option><option value="cancel">Batalkan pekerjaan</option></select></label><div id="rs-action-fields"></div><div id="rs-history">Memuat jejak audit…</div>`,async(d,k)=>{
    const action=d.get('action'),evidence={};
    for(const [name,value] of d.entries())if(name.startsWith('evidence_'))evidence[name.slice(9)]=String(value).trim();
    const updated=await sbRpc('rs_transition_order',{p_id:r.id,p_version:r.version,p_action:action,p_evidence:evidence,p_request_key:k});if(!updated?.id)throw Error('Server tidak mengonfirmasi perubahan');
  });
  const fields=()=>{
    const action=document.getElementById('rs-action').value;
    document.getElementById('rs-action-fields').innerHTML=action==='assign'?`<label>Petugas<select name="evidence_assignee_id" required><option value="">Pilih</option>${rsOpsProfiles.filter(p=>t.owner_roles.includes(p.role?.toLowerCase())||['super_admin','head_operation','direktur'].includes(p.role?.toLowerCase())).map(p=>`<option value="${rsOpsEsc(p.id)}">${rsOpsEsc(p.full_name || p.id)} (${rsOpsEsc(p.role)})</option>`).join('')}</select></label>`:action==='cancel'?'<label>Alasan<textarea name="evidence_reason" minlength="3" required></textarea></label>':stage?`<p>Peran tahap: ${rsOpsEsc(stage.roles.join(', '))}</p>${stage.fields.map(f=>`<label>${rsOpsEsc(f.replaceAll('_',' '))}<textarea name="evidence_${rsOpsEsc(f)}" minlength="3" required></textarea></label>`).join('')}`:'<p>Pekerjaan telah selesai.</p>';
  };document.getElementById('rs-action').onchange=fields;fields();
  const historyTarget=document.getElementById('rs-history');
  try{const history=await sbGet('rs_work_events',`select=*&order_id=eq.${id}&order=id.desc&limit=100`);if(historyTarget.isConnected)historyTarget.innerHTML=`<h3>Jejak audit (100 terbaru)</h3>${history.map(h=>`<p>${rsOpsEsc(new Date(h.created_at).toLocaleString('id-ID'))} · ${rsOpsEsc(h.action)} · ${rsOpsEsc(h.actor_id)}<small>${rsOpsEsc(JSON.stringify(h.evidence))}</small></p>`).join('')}`;}catch(e){if(historyTarget.isConnected)historyTarget.textContent='Jejak audit gagal dibaca: '+e.message;}
}
function rsOpsNewBed() {
  rsOpsForm(`<h2>Permintaan bed</h2>${rsOpsPatientField(false)}<label>Kelas / isolasi / persyaratan<textarea name="requirements" minlength="3" required></textarea></label>`,async(d,k)=>{const admission=d.get('admission_override') || d.get('admission_id');if(!admission)throw Error('Pilih kunjungan pasien');const r=await sbRpc('rs_request_bed',{p_admission_id:Number(admission),p_requirements:d.get('requirements'),p_request_key:k});if(!r?.id)throw Error('Permintaan tidak dikonfirmasi');});
}
function rsOpsAllocate(id) {
  rsOpsForm(`<h2>Alokasikan bed</h2><p>Verifikasi persyaratan pasien dan fasilitas sebelum memilih.</p><label>Bed<select name="bed_id" required><option value="">Pilih bed</option>${rsOpsBeds.filter(b=>b.status==='Kosong'&&b.is_active!==false).map(b=>`<option value="${b.id}">${rsOpsEsc(b.room_no)} / ${rsOpsEsc(b.bed_no)}</option>`).join('')}</select></label><label>Durasi reservasi (jam)<input name="hours" type="number" min="1" max="24" value="4" required></label>`,async d=>{const r=await sbRpc('rs_allocate_bed',{p_id:id,p_bed_id:Number(d.get('bed_id')),p_hours:Number(d.get('hours'))});if(!r?.id)throw Error('Alokasi tidak dikonfirmasi');});
}
function rsOpsCancelBed(id) {
  rsOpsForm('<h2>Batalkan permintaan bed</h2><label>Alasan<textarea name="reason" minlength="3" required></textarea></label>',async d=>{const r=await sbRpc('rs_cancel_bed',{p_id:id,p_reason:d.get('reason')});if(!r?.id)throw Error('Pembatalan tidak dikonfirmasi');});
}
window.renderHospitalOperations=renderHospitalOperations;
