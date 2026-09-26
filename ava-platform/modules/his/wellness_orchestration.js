// OWNED_BY: generic. Internal HIS owns setup, execution and reports.
async function renderHisWellness() {
  const target=document.getElementById('main-content');
  target.innerHTML='<p>Memuat orkestrasi wellness…</p>';
  try {
    // Authorization is checked before loading configuration or participant data.
    const data=await sbRpc('wellness_admin_dashboard');
    for(const href of ['/css/wellness-flow.css?v=20260925','/css/wellness-base.css?v=20260925']){
      if(!document.querySelector(`link[href="${href}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);}
    }
    for(const [src,ready] of [['/js/wellness-flow.js?v=20260925',()=>window.WellnessFlow],['/apps/wellness.js?v=20260925-orchestration',()=>window.renderWellnessAdmin]]){
      if(!ready())await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Modul wellness gagal dimuat.'));};document.head.appendChild(s);});
    }
    const esc=window.WellnessFlow.escape;
    target.innerHTML=`<section class="wf"><h2>Orkestrasi Wellness</h2><p>HIS mengatur program, peserta, permintaan treatment, pelaksana dan laporan sesi. HR melakukan evaluasi dan request melalui APPS; IHC hanya mengirim hasil.</p>
      <div class="wf-his-tabs"><button type="button" data-tab="operations">Peserta & pelaksanaan</button><button type="button" data-tab="setup">Konfigurasi program & roster</button><button type="button" data-tab="imports">Impor hasil</button></div>
      <div data-pane="operations" class="wf-his-pane"><label>Program<select id="his-wellness-program"><option value="">Pilih program</option>${(data.programs||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.corporate_name)} · ${esc(p.name)} · ${esc(p.status)}</option>`).join('')}</select></label><div id="his-wellness-workspace"></div></div>
      <div data-pane="setup" class="wf-his-pane" hidden><div id="wellness-admin-view"></div></div>
      <div data-pane="imports" class="wf-his-pane" hidden><div id="wellness-import-view"></div></div></section>`;
    const select=target.querySelector('#his-wellness-program');
    select.onchange=()=>select.value?window.WellnessFlow.workspace(target.querySelector('#his-wellness-workspace'),select.value):target.querySelector('#his-wellness-workspace').replaceChildren();
    target.querySelectorAll('[data-tab]').forEach(b=>b.onclick=async()=>{
      target.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==b.dataset.tab);
      if(b.dataset.tab==='setup')await window.renderWellnessAdmin();
      if(b.dataset.tab==='imports')await window.renderWellnessImport();
      if(b.dataset.tab==='operations'){
        const latest=await sbRpc('wellness_admin_dashboard');const previous=select.value;
        select.innerHTML='<option value="">Pilih program</option>'+(latest.programs||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.corporate_name)} · ${esc(p.name)}</option>`).join('');
        select.value=previous||latest.programs?.[0]?.id||'';await select.onchange();
      }
    });
    if(data.programs?.length){select.value=data.programs[0].id;await select.onchange();}
  } catch(e){target.replaceChildren();const p=document.createElement('p');p.textContent='Orkestrasi belum dapat dimuat: '+e.message;target.appendChild(p);}
}
