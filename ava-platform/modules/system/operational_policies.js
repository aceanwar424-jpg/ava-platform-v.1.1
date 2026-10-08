// OWNED_BY: generic. Approval/activation are enforced by the server.
let opPolicyRows=[],opPolicyEpoch=0,opPolicyStaff=[];
const opPolicyEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function renderOperationalPolicies(){
 const epoch=++opPolicyEpoch,main=document.getElementById('main-content');
 main.innerHTML='<section><h1>Kebijakan Operasional</h1><p role="status">Memuat versi kebijakan…</p></section>';
 try{
  const [rows,staff]=await Promise.all([sbGet('ops_policy_versions','select=*&order=created_at.desc&limit=101'),sbRpc('ops_policy_staff',{})]);
  if(epoch!==opPolicyEpoch||(typeof currentPage==='string'&&currentPage!=='cfg-rs-policy'))return;opPolicyRows=rows;opPolicyStaff=staff;
  main.innerHTML=`<section class="ops-policy"><style>.ops-policy{max-width:1100px;margin:auto;padding:16px}.ops-policy article,.ops-policy form{border:1px solid #bccbd5;border-radius:8px;padding:16px;margin:12px 0}.ops-policy label{display:block;margin:10px 0}.ops-policy input,.ops-policy select,.ops-policy textarea{display:block;padding:9px;width:100%;box-sizing:border-box}.ops-policy button{padding:9px;margin:4px}.ops-policy pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Kebijakan Operasional</h1><p>Versi baru wajib melalui review dan persetujuan sebelum aktivasi. Template klinis memerlukan reviewer profesi. Pengaturan ini belum otomatis mengubah perhitungan billing existing.</p><p id="op-error" role="alert"></p><button id="op-new">Buat versi</button><button id="op-reload">Muat ulang</button><div id="op-editor"></div>${rows.length>100?'<p>Tampil 100 versi terbaru; gunakan scope yang spesifik untuk review.</p>':''}${rows.slice(0,100).map(p=>`<article><h2>${opPolicyEscape(p.kind)} · ${opPolicyEscape(p.scope)} · v${p.revision}</h2><p>${opPolicyEscape(p.state)}${p.effective_at?' · Berlaku '+opPolicyEscape(new Date(p.effective_at).toLocaleString('id-ID')):''}</p><details><summary>Isi dan identitas review</summary><pre>${opPolicyEscape(JSON.stringify(p.payload,null,2))}</pre><p>Pembuat: ${opPolicyEscape(p.created_by)}<br>Reviewer: ${opPolicyEscape(p.reviewed_by||'Belum direview')}</p></details>${({draft:['submit'],in_review:['approve'],approved:['activate','retire'],active:['retire']}[p.state]||[]).map(a=>`<button data-policy="${p.id}" data-action="${a}">${({submit:'Ajukan review',approve:'Setujui',activate:'Aktifkan',retire:'Pensiunkan'})[a]}</button>`).join('')}</article>`).join('')||'<p>Belum ada konfigurasi. Modul yang membutuhkan konfigurasi aktif akan menolak operasi sampai setup selesai.</p>'}</section>`;
  document.getElementById('op-new').onclick=opPolicyNew;
  document.getElementById('op-reload').onclick=renderOperationalPolicies;
  main.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>opPolicyTransition(opPolicyRows.find(x=>x.id===Number(b.dataset.policy)),b.dataset.action));
 }catch(e){if(epoch===opPolicyEpoch&&(typeof currentPage!=='string'||currentPage==='cfg-rs-policy')){main.innerHTML=`<section><h1>Kebijakan belum dapat dibaca</h1><p role="alert">${opPolicyEscape(e.message)}</p><p>Periksa hak akses dan migrasi 0074.</p><button id="op-retry">Coba lagi</button></section>`;document.getElementById('op-retry').onclick=renderOperationalPolicies;}}
}
function opPolicyForm(html,save){
 const target=document.getElementById('op-editor');target.innerHTML=`<form>${html}<label>Alasan<textarea name="reason" minlength="3" required></textarea></label><button type="submit">Simpan</button><button type="button" id="op-cancel">Tutup</button></form>`;
 const form=target.querySelector('form'),key=crypto.randomUUID();document.getElementById('op-cancel').onclick=()=>target.replaceChildren();
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;try{await save(new FormData(form),key);if(form.isConnected)await renderOperationalPolicies();}catch(err){const error=document.getElementById('op-error');if(error)error.textContent=err.message;}finally{if(b.isConnected)b.disabled=false;}};
 target.scrollIntoView({block:'start'});
}
function opPolicyNew(){
 opPolicyForm('<h2>Versi baru</h2><label>Jenis<select name="kind" id="op-kind"><option value="administrative">Administratif</option><option value="clinical_template">Formulir klinis</option><option value="authority">Kewenangan</option><option value="sprint">Sprint tim</option></select></label><label>Lingkup (kelas/penjamin, unit, atau nama tim)<input name="scope" maxlength="100" required></label><div id="op-fields"></div>',async(d,key)=>{
  const kind=d.get('kind');let payload;
  if(kind==='sprint')payload={duration_days:Number(d.get('duration')),velocity_window:Number(d.get('window')),points:d.get('points').split(',').map(x=>Number(x.trim())),done_checks:d.get('checks').split('\n').map(x=>x.trim()).filter(Boolean),carry_over:d.get('carry'),members:d.getAll('members')};
  else if(kind==='administrative')payload={room_method:d.get('room'),transfer_method:d.get('transfer'),deposit_method:d.get('deposit'),deposit_value:Number(d.get('deposit_value')),timezone:d.get('timezone'),cutoff:d.get('cutoff'),rounding:d.get('rounding'),minimum_units:Number(d.get('minimum')),payer_precedence:'explicit_contract_only'};
  else if(kind==='clinical_template')payload={title:d.get('title'),signer_roles:d.get('roles').split(',').map(x=>x.trim()).filter(Boolean),fields:d.get('fields').split('\n').filter(x=>x.trim()).map(line=>{const [key,label,type,required]=line.split('|').map(x=>x.trim());return {key,label,type,required:required==='ya'};})};
  else payload={rules:d.get('rules').split('\n').filter(x=>x.trim()).map(line=>{const [action,roles,separate]=line.split('|').map(x=>x.trim());return {action,roles:roles.split(',').map(x=>x.trim()),separate_verifier:separate==='ya'};})};
  await sbRpc('ops_policy_command',{p_id:null,p_action:'create',p_data:{kind,scope:d.get('scope').trim(),payload,reason:d.get('reason')},p_request_key:key});
 });
 document.getElementById('op-kind').onchange=opPolicyFields;opPolicyFields();
}
function opPolicyFields(){
 const input=(label,name,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" ${extra} required></label>`;
 const select=(label,name,values)=>`<label>${label}<select name="${name}" required><option value="">Pilih</option>${values.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>`;
 const kind=document.getElementById('op-kind').value;
 const fields={
  sprint:input('Durasi sprint (hari)','duration','number','min="1" max="90"')+input('Jendela velocity (sprint tertutup)','window','number','min="1" max="50"')+input('Skala poin, dipisahkan koma','points')+`<label>Anggota tim<select name="members" multiple required>${opPolicyStaff.filter(p=>['super_admin','head_operation','direktur','tech'].includes(p.role)).map(p=>`<option value="${opPolicyEscape(p.id)}">${opPolicyEscape(p.name)} · ${opPolicyEscape(p.role)}</option>`).join('')}</select></label>`+'<label>Definition of Done, satu syarat per baris<textarea name="checks" required></textarea></label>'+select('Pekerjaan belum selesai','carry',[['backlog','Kembali ke backlog'],['next_planning','Sprint planning berikutnya']]),
  administrative:select('Metode kamar','room',[['calendar','Hari kalender'],['24_hour','Per 24 jam'],['hourly','Per jam']])+select('Pindah kelas','transfer',[['prorata','Prorata durasi'],['highest','Kelas tertinggi'],['cutoff','Kelas saat cutoff']])+select('Deposit','deposit',[['fixed','Nominal tetap'],['percentage','Persentase'],['none','Tanpa deposit']])+input('Nilai deposit (0 jika tanpa deposit)','deposit_value','number','min="0" step="0.01"')+input('Timezone IANA','timezone')+'<label>Cutoff (wajib untuk hari kalender/kelas cutoff)<input name="cutoff" type="time"></label>'+select('Pembulatan','rounding',[['up','Ke atas'],['nearest','Terdekat'],['down','Ke bawah']])+input('Minimum unit tagihan','minimum','number','min="0" step="0.01"'),
  clinical_template:input('Judul formulir','title')+input('Role profesi penandatangan, dipisahkan koma','roles')+'<label>Field: kode | label | text/number/date/boolean | wajib ya/tidak<textarea name="fields" required></textarea></label><p>Isi klinis harus direview profesi sebelum aktivasi.</p>',
  authority:'<label>Aturan: aksi | role dipisahkan koma | verifikator berbeda ya/tidak<textarea name="rules" required></textarea></label><p>Matriks ini belum menggantikan guard profesi/tenant pada modul existing.</p>'
 };
 document.getElementById('op-fields').innerHTML=fields[kind];
}
function opPolicyTransition(p,action){
 opPolicyForm(`<h2>${opPolicyEscape(action)} · ${opPolicyEscape(p.scope)} v${p.revision}</h2>${action==='activate'?'<label>Tanggal dan waktu mulai berlaku<input name="effective" type="datetime-local" required></label>':''}`,async(d,key)=>{
  const data={reason:d.get('reason'),expected_state:p.state};if(action==='activate')data.effective_at=new Date(d.get('effective')).toISOString();
  await sbRpc('ops_policy_command',{p_id:p.id,p_action:action,p_data:data,p_request_key:key});
 });
}
window.renderOperationalPolicies=renderOperationalPolicies;
