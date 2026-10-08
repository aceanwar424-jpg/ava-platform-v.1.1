// OWNED_BY: generic. Synthetic templates are not installed into real tenants.
let rsFormAdmission='',rsFormTemplates=[],rsFormRecords=[],rsFormEpoch=0;
const rsFormEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function renderClinicalForms(){
 const epoch=++rsFormEpoch,main=document.getElementById('main-content');
 main.innerHTML=`<section class="rs-forms"><style>.rs-forms{padding:16px;max-width:1100px;margin:auto}.rs-forms article,.rs-forms form{padding:16px;margin:12px 0;border:1px solid #b9c8d1;border-radius:8px}.rs-forms label{display:block;margin:10px 0}.rs-forms input,.rs-forms select,.rs-forms textarea{padding:9px;max-width:100%;box-sizing:border-box}.rs-forms button{padding:9px;margin:4px}.rs-forms pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Formulir Klinis</h1><p>Isian memakai versi template yang disahkan. Pengesahan mengikuti profesi dan matriks kewenangan aktif. Modul ini tidak menentukan terapi atau kelayakan klinis.</p><form id="rf-search"><label>ID kunjungan<input name="admission" type="number" min="1" value="${rsFormEscape(rsFormAdmission)}" required></label><button>Buka kunjungan</button></form><p id="rf-error" role="alert"></p><button id="rf-setup">Setup template & kewenangan</button><div id="rf-editor"></div><div id="rf-records"></div></section>`;
 document.getElementById('rf-search').onsubmit=e=>{e.preventDefault();rsFormAdmission=new FormData(e.target).get('admission');renderClinicalForms();};
 document.getElementById('rf-setup').onclick=()=>navigate('cfg-rs-policy');if(!rsFormAdmission)return;
 try{
  const [templates,records]=await Promise.all([sbGet('ops_policy_versions','select=*&kind=eq.clinical_template&state=eq.active&order=revision.desc&limit=200'),sbGet('rs_clinical_records',`select=*&admission_id=eq.${Number(rsFormAdmission)}&order=created_at.desc&limit=200`)]);
  if(epoch!==rsFormEpoch||(typeof currentPage==='string'&&currentPage!=='rs-clinical-forms'))return;
  rsFormTemplates=templates.filter(p=>new Date(p.effective_at)<=new Date()).sort((a,b)=>new Date(b.effective_at)-new Date(a.effective_at)||b.revision-a.revision).filter((p,i,all)=>!all.slice(0,i).some(x=>x.scope===p.scope));
  rsFormRecords=records;
  document.getElementById('rf-records').innerHTML=`<button id="rf-new">Catat formulir</button>${records.length===200||templates.length===200?'<p>Batas tampilan 200 tercapai; seluruh riwayat belum tampil.</p>':''}${records.map(r=>`<article><h2>Catatan #${r.id} · versi template #${r.policy_id}</h2><p>${r.signed_at?'Disahkan '+rsFormEscape(new Date(r.signed_at).toLocaleString('id-ID')):'Belum disahkan'}${r.amendment_of?' · Amendment catatan #'+r.amendment_of:''}</p><pre>${rsFormEscape(JSON.stringify(r.form_values,null,2))}</pre><p>Alasan: ${rsFormEscape(r.reason)}</p><button data-record="${r.id}" data-action="${r.signed_at?'amend':'sign'}">${r.signed_at?'Buat amendment':'Sahkan'}</button></article>`).join('')||'<p>Belum ada catatan yang dapat diakses.</p>'}`;
  document.getElementById('rf-new').onclick=()=>rsFormNew();main.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>{const r=rsFormRecords.find(x=>x.id===Number(b.dataset.record));b.dataset.action==='sign'?rsFormSign(r):rsFormNew(r);});
 }catch(e){if(epoch===rsFormEpoch&&document.getElementById('rf-error'))document.getElementById('rf-error').textContent=e.message;}
}
function rsFormEditor(html,save){
 const target=document.getElementById('rf-editor');target.innerHTML=`<form>${html}<label>Alasan / konteks<textarea name="reason" minlength="3" required></textarea></label><button type="submit">Simpan</button><button type="button" id="rf-cancel">Tutup</button></form>`;
 const form=target.querySelector('form'),key=crypto.randomUUID();document.getElementById('rf-cancel').onclick=()=>target.replaceChildren();
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;try{await save(new FormData(form),key);if(form.isConnected)await renderClinicalForms();}catch(err){const error=document.getElementById('rf-error');if(error)error.textContent=err.message;}finally{if(b.isConnected)b.disabled=false;}};target.scrollIntoView({block:'start'});
}
async function rsFormNew(previous){
 let scope;
 if(previous){try{const source=await sbGet('ops_policy_versions',`select=scope&id=eq.${previous.policy_id}&limit=1`);scope=source[0]?.scope;}catch(e){document.getElementById('rf-error').textContent=e.message;return;}}
 const templates=previous?rsFormTemplates.filter(p=>p.scope===scope):rsFormTemplates;
 if(previous&&!templates.length){document.getElementById('rf-error').textContent='Versi/scope template asal belum tersedia pada daftar aktif; buka setup untuk menyiapkan versi pengganti.';return;}
 rsFormEditor(`<h2>${previous?'Amendment #'+previous.id:'Catat formulir'}</h2><label>Template<select name="policy" id="rf-policy" required><option value="">Pilih</option>${templates.map(p=>`<option value="${p.id}">${rsFormEscape(p.payload.title)} · ${rsFormEscape(p.scope)} v${p.revision}</option>`).join('')}</select></label><div id="rf-fields"></div>`,async(d,key)=>{
  const p=templates.find(x=>x.id===Number(d.get('policy')));if(!p)throw Error('Template wajib');const values={};
  for(const f of p.payload.fields){const value=d.get('f_'+f.key);if(value!==null&&value!=='')values[f.key]=f.type==='boolean'?value==='true':f.type==='number'?Number(value):value;}
  await sbRpc('rs_clinical_command',{p_action:'record',p_data:{admission_id:Number(rsFormAdmission),policy_id:p.id,values,amendment_of:previous?.id??null,reason:d.get('reason')},p_request_key:key});
 });
 document.getElementById('rf-policy').onchange=e=>{
  const p=templates.find(x=>x.id===Number(e.target.value));document.getElementById('rf-fields').innerHTML=p?p.payload.fields.map(f=>`<label>${rsFormEscape(f.label)}${f.type==='boolean'?`<select name="f_${f.key}" ${f.required?'required':''}><option value="">Pilih</option><option value="true">Ya</option><option value="false">Tidak</option></select>`:`<input name="f_${f.key}" type="${f.type==='number'?'number':f.type==='date'?'date':'text'}" ${f.type==='number'?'step="any"':''} ${f.required?'required':''}>`}</label>`).join(''):'';
 };
}
function rsFormSign(r){rsFormEditor(`<h2>Sahkan catatan #${r.id}</h2><p>Pastikan isi dan profesi penandatangan sesuai; histori tidak dihapus setelah pengesahan.</p>`,async(d,key)=>sbRpc('rs_clinical_command',{p_action:'sign',p_data:{id:r.id,reason:d.get('reason')},p_request_key:key}));}
window.renderClinicalForms=renderClinicalForms;
