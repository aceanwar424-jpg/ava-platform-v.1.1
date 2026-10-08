// OWNED_BY: generic. No invented velocity or implicit team configuration.
let teamSprintName='',teamSprintData=null,teamSprintEpoch=0;
const teamSprintEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function renderTeamSprint(){
 const epoch=++teamSprintEpoch,main=document.getElementById('main-content');
 main.innerHTML=`<section class="team-sprint"><style>.team-sprint{padding:16px;max-width:1100px;margin:auto}.team-sprint article,.team-sprint form{border:1px solid #bfccd5;padding:16px;margin:12px 0;border-radius:8px}.team-sprint label{display:block;margin:10px 0}.team-sprint input,.team-sprint select,.team-sprint textarea{padding:9px;max-width:100%;box-sizing:border-box}.team-sprint button{padding:9px;margin:4px}.team-sprint .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}</style><h1>Sprint & Velocity</h1><form id="ts-team"><label>Nama tim<input name="team" maxlength="100" value="${teamSprintEscape(teamSprintName)}" required></label><button>Buka tim</button></form><p role="alert" id="ts-error"></p><button id="ts-policy">Setup kebijakan tim</button><div id="ts-editor"></div><div id="ts-board"></div></section>`;
 document.getElementById('ts-team').onsubmit=e=>{e.preventDefault();teamSprintName=new FormData(e.target).get('team').trim();renderTeamSprint();};
 document.getElementById('ts-policy').onclick=()=>navigate('cfg-rs-policy');
 if(!teamSprintName)return;
 try{
  const data=await sbRpc('tech_sprint_board',{p_team:teamSprintName});if(epoch!==teamSprintEpoch||(typeof currentPage==='string'&&currentPage!=='tech-sprint'))return;teamSprintData=data;
  document.getElementById('ts-board').innerHTML=`<p>Velocity: <strong>${data.velocity===null?'Belum tersedia':teamSprintEscape(data.velocity)}</strong> · ${data.sample_size} sprint tertutup · kebijakan v${data.policy.revision}</p><p>Estimasi relatif tim; tidak dikonversi menjadi produktivitas individu.</p><button id="ts-new-sprint">Buat sprint</button><button id="ts-new-item">Tambah backlog</button>${data.sprints.length===data.sprint_limit||data.items.length===data.item_limit?'<p>Batas tampilan tercapai; board ini belum menampilkan seluruh arsip.</p>':''}<h2>Sprint</h2><div class="grid">${data.sprints.map(s=>`<article><h3>${teamSprintEscape(s.title)}</h3><p>${teamSprintEscape(s.state)}${s.state==='closed'?' · '+teamSprintEscape(s.closed_points)+' poin selesai':''}</p>${s.state==='planning'?`<button data-command="start" data-sprint="${s.id}">Mulai</button>`:s.state==='active'?`<button data-command="close" data-sprint="${s.id}">Tutup & carry-over</button>`:''}</article>`).join('')||'<p>Belum ada sprint.</p>'}</div><h2>Backlog & pekerjaan</h2><div class="grid">${data.items.map(i=>`<article><h3>${teamSprintEscape(i.title)}</h3><p>${teamSprintEscape(i.points)} poin · ${teamSprintEscape(i.state)} · sprint ${i.sprint_id||'—'}</p>${i.state==='backlog'?`<button data-command="assign" data-item="${i.id}">Rencanakan</button>`:i.state==='planned'?`<button data-command="doing" data-item="${i.id}">Kerjakan</button>`:i.state==='doing'?`<button data-command="done" data-item="${i.id}">Verifikasi DoD</button>`:''}${['planned','doing'].includes(i.state)?`<button data-command="return" data-item="${i.id}">Kembali ke backlog</button>`:''}</article>`).join('')||'<p>Belum ada pekerjaan.</p>'}</div>`;
  document.getElementById('ts-new-sprint').onclick=()=>teamSprintNew('create_sprint');document.getElementById('ts-new-item').onclick=()=>teamSprintNew('create_item');
  const cards=main.querySelectorAll('#ts-board .grid')[1].children;
  data.items.forEach((item,index)=>{
   const command=item.state==='backlog'?'edit_item':item.state==='done'&&data.sprints.some(s=>s.id===item.sprint_id&&s.state==='active')?'reopen':null;
   if(command){const button=document.createElement('button');button.dataset.command=command;button.dataset.item=String(item.id);button.textContent=command==='edit_item'?'Ubah backlog & estimasi':'Koreksi Done';cards[index].appendChild(button);}
  });
  main.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>teamSprintAction(b.dataset.command,b.dataset.sprint?data.sprints.find(x=>x.id===Number(b.dataset.sprint)):data.items.find(x=>x.id===Number(b.dataset.item))));
 }catch(e){if(epoch===teamSprintEpoch&&document.getElementById('ts-error'))document.getElementById('ts-error').textContent=e.message;}
}
function teamSprintForm(html,save){
 const editor=document.getElementById('ts-editor');editor.innerHTML=`<form>${html}<label>Alasan<textarea name="reason" minlength="3" required></textarea></label><button type="submit">Simpan</button><button type="button" id="ts-cancel">Tutup</button></form>`;
 const form=editor.querySelector('form'),key=crypto.randomUUID();document.getElementById('ts-cancel').onclick=()=>editor.replaceChildren();
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;try{await save(new FormData(form),key);if(form.isConnected)await renderTeamSprint();}catch(err){const error=document.getElementById('ts-error');if(error)error.textContent=err.message;}finally{if(b.isConnected)b.disabled=false;}};editor.scrollIntoView({block:'start'});
}
function teamSprintSend(action,data,key){return sbRpc('tech_sprint_command',{p_action:action,p_data:{team:teamSprintName,...data},p_request_key:key});}
function teamSprintNew(action){
 teamSprintForm(`<h2>${action==='create_item'?'Tambah backlog':'Buat sprint'}</h2><label>Judul<input name="title" minlength="3" maxlength="150" required></label>${action==='create_item'?`<label>Poin<select name="points">${teamSprintData.policy.payload.points.map(p=>`<option>${teamSprintEscape(p)}</option>`).join('')}</select></label>`:''}`,async(d,k)=>teamSprintSend(action,{title:d.get('title'),...(action==='create_item'?{points:Number(d.get('points'))}:{}),reason:d.get('reason')},k));
}
function teamSprintAction(action,row){
 let checks=[];
 if(action==='done')checks=teamSprintData.policy.payload.done_checks;
 // DoD belongs to the sprint's pinned version, not the latest team policy.
 if(action==='done'){
  const s=teamSprintData.sprints.find(x=>x.id===row.sprint_id);
  if(s.policy_id!==teamSprintData.policy.id){teamSprintLoadPinned(row);return;}
 }
 teamSprintActionForm(action,row,checks);
}
async function teamSprintLoadPinned(row){
 try{const s=teamSprintData.sprints.find(x=>x.id===row.sprint_id);const p=await sbGet('ops_policy_versions',`select=payload&id=eq.${s.policy_id}&limit=1`);if(!p[0])throw Error('Versi DoD sprint tidak tersedia');teamSprintActionForm('done',row,p[0].payload.done_checks);}catch(e){document.getElementById('ts-error').textContent=e.message;}
}
function teamSprintActionForm(action,row,checks){
 const options=teamSprintData.sprints.filter(s=>s.state==='planning');
 teamSprintForm(`<h2>${teamSprintEscape(action)} · ${teamSprintEscape(row.title)}</h2>${action==='edit_item'?`<label>Judul<input name="title" value="${teamSprintEscape(row.title)}" minlength="3" maxlength="200" required></label><label>Poin<select name="points">${teamSprintData.policy.payload.points.map(p=>`<option ${p===Number(row.points)?'selected':''}>${teamSprintEscape(p)}</option>`).join('')}</select></label>`:''}${action==='assign'?`<label>Sprint tujuan<select name="sprint" required><option value="">Pilih</option>${options.map(s=>`<option value="${s.id}">${teamSprintEscape(s.title)}</option>`).join('')}</select></label>`:''}${action==='done'?checks.map((c,i)=>`<label><input type="checkbox" name="check${i}" required> ${teamSprintEscape(c)}</label>`).join('')+'<label>Bukti selesai<textarea name="evidence" minlength="3" required></textarea></label>':''}${action==='close'?'<p>Poin hanya dihitung untuk item Done. Pekerjaan belum selesai mengikuti aturan carry-over versi sprint.</p>':''}`,async(d,k)=>{
  const data={id:row.id,version:row.version,reason:d.get('reason')};if(action==='edit_item'){data.title=d.get('title');data.points=Number(d.get('points'));}if(action==='assign')data.sprint_id=Number(d.get('sprint'));if(action==='done'){data.checks=Object.fromEntries(checks.map((c,i)=>[c,d.get('check'+i)==='on']));data.evidence=d.get('evidence');}
  await teamSprintSend(action,data,k);
 });
}
window.renderTeamSprint=renderTeamSprint;
