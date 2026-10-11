// OWNED_BY: generic. Synthetic browser state; no production API access.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('../lib/playwright.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<body class="ava-ops-shell"><div id="topbar-title"></div><main id="main-content"><button id="original">Daftar</button></main></body>'}));
  await page.goto('https://tech.avahealth.sbs');
  for(const file of ['tech-navigation','tech-pages','utils'])await page.addScriptTag({path:'ava-platform/js/core/'+file+'.js'});
  await page.addStyleTag({path:'ava-platform/css/style.css'});await page.addStyleTag({path:'ava-platform/css/workspace-design.css'});await page.addStyleTag({content:'body{display:block}#main-content{margin:0;padding:24px}'});
  await page.evaluate(()=>{window.hits=0;document.querySelector('#original').onclick=()=>hits++;openModal('<h2>Tambah data</h2><input id="field"><button onclick="closeModalForce()">Batal</button>');});
  assert.equal(await page.locator('.tech-record-page').count(),1);assert.equal(await page.locator('.modal-overlay.open').count(),0);
  await page.locator('#field').fill('Sintetis');
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Batal',exact:true}).click();assert.equal(await page.locator('#field').inputValue(),'Sintetis');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Batal',exact:true}).click();await page.locator('#original').click();assert.equal(await page.evaluate(()=>hits),1);
  await page.evaluate(()=>{window.sbGetStrict=async()=>[];window.sbRpc=async()=>{throw Error('Gagal sintetis')};});
  await page.addScriptTag({path:'ava-platform/modules/tech-platform/techControlPlane.js'});
  for(const section of ['ringkasan','kesehatan','tiket','deployment','pengaturan']){
   await page.evaluate(async section=>{window.workspacePanelTarget={page:'tech-control-plane',panel:section};await renderTechControlPlane();},section);
   assert.equal(await page.locator('.tcp-workspace-nav').count(),0);
   assert(await page.locator('h1').textContent());
   assert.equal(await page.locator('.tcp-panel').evaluateAll(nodes=>nodes.every(n=>!n.hidden)),true);
   if(section==='deployment'){
    assert.equal(await page.locator('#tcp-deploy-domain').count(),0);
    await page.getByRole('button',{name:'+ Tambah deployment'}).click();await page.locator('#tcp-deploy-domain').fill('synthetic.invalid');
    await page.locator('#tcp-deploy-tenant').fill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');await page.locator('#tcp-deploy-project').fill('synthetic');
    await page.evaluate(()=>tcpSimpanDeployment());assert.equal(await page.locator('#tcp-deploy-domain').inputValue(),'synthetic.invalid');
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'← Kembali ke daftar'}).click();
    await page.evaluate(()=>renderTechControlPlane());assert.equal(await page.locator('h1').textContent(),'Deployment tenant');
   }
  }
  await page.addScriptTag({path:'ava-platform/modules/system/config/config_home.js'});await page.evaluate(()=>renderConfigHub('medicine'));
  assert.equal(await page.locator('.config-domain-tabs').count(),0);assert((await page.locator('.tech-config-tile').count())>5);
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  fs.mkdirSync('docs/audit-evidence/2026-10-09',{recursive:true});await page.screenshot({path:'docs/audit-evidence/2026-10-09/tech-config-mobile.png',fullPage:true});
  await page.setViewportSize({width:1365,height:850});await page.evaluate(()=>{workspacePanelTarget={page:'tech-control-plane',panel:'deployment'};return renderTechControlPlane();});await page.screenshot({path:'docs/audit-evidence/2026-10-09/tech-deployment-list.png',fullPage:true});
  await page.evaluate(()=>{window.sbGet=async()=>[];window.getUserName=()=> 'Synthetic';window.formatDateShort=v=>v;window.SUPABASE_URL='https://synthetic.invalid';window.sbFetch=async()=>({ok:true,json:async()=>[]});});
  await page.addScriptTag({path:'ava-platform/modules/system/config/master_registry.js'});await page.evaluate(()=>renderMasterRegistry('medicine_reference'));
  await page.getByRole('button',{name:'+ Tambah master'}).first().click();assert.equal(await page.locator('.modal-overlay.open').count(),0);assert.equal(await page.locator('#master-registry-form').count(),1);
  await page.locator('[name=code]').fill('SYN-01');await page.locator('[name=name]').fill('Data Sintetis');await page.locator('[name=category]').fill('Sintetis');await page.locator('[name=dosage_form]').fill('Sintetis');await page.locator('[name=reason]').fill('Pengujian sintetis');
  await page.evaluate(async()=>{const form=document.querySelector('#master-registry-form');await saveMasterRecord({preventDefault(){},currentTarget:form});});
  assert.equal(await page.locator('[name=name]').inputValue(),'Data Sintetis');
  await page.evaluate(()=>{window.masterRows=[];window.sbRpc=async(name,data)=>{if(name==='his_master_upsert_record'){masterRows=[{id:1,code:data.p_code,name:data.p_name,payload:data.p_payload,status:'draft',version:1}];return {id:1}};throw Error('Unexpected synthetic RPC')};window.sbFetch=async()=>({ok:true,json:async()=>masterRows});});
  await page.evaluate(async()=>{const form=document.querySelector('#master-registry-form');await saveMasterRecord({preventDefault(){},currentTarget:form});});
  assert.equal(await page.locator('.tech-record-page').count(),0);assert((await page.locator('tbody').textContent()).includes('Data Sintetis'));
  await page.evaluate(()=>openMasterRecordForm(1));assert.equal(await page.locator('[name=name]').inputValue(),'Data Sintetis');await page.locator('[name=name]').fill('Sintetis Diperbarui');
  await page.evaluate(async()=>{const form=document.querySelector('#master-registry-form');form.querySelector('[name=reason]').value='Uji edit sintetis';await saveMasterRecord({preventDefault(){},currentTarget:form},1);});
  assert.equal(await page.locator('.tech-record-page').count(),0);assert((await page.locator('tbody').textContent()).includes('Sintetis Diperbarui'));
  await page.evaluate(()=>document.querySelector('#toast-container')?.replaceChildren());
  await page.screenshot({path:'docs/audit-evidence/2026-10-09/tech-master-list.png',fullPage:true});
  await page.evaluate(()=>openMasterRecordForm(1));await page.screenshot({path:'docs/audit-evidence/2026-10-09/tech-master-edit.png',fullPage:true});await page.getByRole('button',{name:'Batal',exact:true}).click();
  await page.addScriptTag({path:'ava-platform/modules/finance/finance.js'});
  for(const section of ['invoice','payment','report','commission']){
    await page.evaluate(async panel=>{workspacePanelTarget={page:'finance',panel};await renderFinance();},section);
    assert.equal(await page.locator('#fin-tabs').count(),0);assert.equal(await page.locator('#fin-'+section).isVisible(),true);
  }
  await page.addScriptTag({path:'ava-platform/modules/hrd/hrd.js'});
  for(const section of ['emp','leave','payroll']){
    await page.evaluate(async panel=>{workspacePanelTarget={page:'hrd',panel};await renderHRD();},section);
    assert.equal(await page.locator('#hrd-tabs').count(),0);assert.equal(await page.locator('#hrd-'+section).isVisible(),true);
  }
  await page.evaluate(()=>{window.sbRpc=async()=>{throw Error('Gagal sintetis')};window.sbPost=async()=>{throw Error('Gagal sintetis')};});
  await page.addScriptTag({path:'ava-platform/modules/tech-platform/techPricingPlans.js'});await page.evaluate(()=>tpTambah());
  await page.locator('#tp-m-kode').fill('SYN');await page.locator('#tp-m-nama').fill('Paket Sintetis');await page.evaluate(()=>tpEksekusiTambah());assert.equal(await page.locator('#tp-m-nama').inputValue(),'Paket Sintetis');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Batal',exact:true}).click();
  await page.addScriptTag({path:'ava-platform/modules/tech-platform/techLicenseActivation.js'});await page.evaluate(()=>tlAktivasi('SYN-LICENSE'));await page.evaluate(()=>tlEksekusiAktivasi());assert.equal(await page.locator('#tl-modal-kode').inputValue(),'SYN-LICENSE');await page.getByRole('button',{name:'Batal',exact:true}).click();
  await page.addScriptTag({path:'ava-platform/modules/tech-platform/operational_lifecycle.js'});await page.evaluate(()=>{window.currentPage='tech-isu';window.sbRpc=async name=>{if(name==='tech_ops_board')return {rows:[],staff:[]};throw Error('Gagal sintetis')};return renderTechOperations({page:'tech-isu'});});
  await page.locator('#to-new').click();assert.equal(await page.locator('.tech-record-page').count(),1);await page.locator('[name=title]').fill('Tiket Sintetis');await page.locator('[name=description]').fill('Uraian sintetis');await page.locator('[name=priority]').selectOption('P2');await page.locator('[name=reason]').fill('Uji sintetis');await page.locator('button[type=submit]').click();assert.equal(await page.locator('#to-error').textContent(),'Gagal sintetis');
  page.once('dialog',d=>d.accept());await page.locator('#to-cancel').click();assert.equal(await page.locator('#to-new').count(),1);
  await page.addScriptTag({path:'ava-platform/modules/tech-platform/team_sprint.js'});await page.evaluate(()=>{window.currentPage='tech-sprint';teamSprintName='Synthetic';window.sbRpc=async name=>{if(name==='tech_sprint_board')return {policy:{revision:1,payload:{points:[1,2,3]}},sprints:[],items:[],velocity:null,sample_size:0,sprint_limit:100,item_limit:500};throw Error('Gagal sintetis')};return renderTeamSprint();});
  await page.locator('#ts-new-sprint').click();assert.equal(await page.locator('.tech-record-page').count(),1);await page.locator('[name=title]').fill('Sprint Sintetis');await page.locator('[name=reason]').fill('Uji sintetis');await page.locator('button[type=submit]').click();assert.equal(await page.locator('#ts-error').textContent(),'Gagal sintetis');page.once('dialog',d=>d.accept());await page.locator('#ts-cancel').click();
  await page.goto('https://other.example');for(const file of ['tech-navigation','tech-pages','utils'])await page.addScriptTag({path:'ava-platform/js/core/'+file+'.js'});
  await page.evaluate(()=>openModal('<input id="other-field">'));assert.equal(await page.locator('.modal-overlay.open').count(),1);
  console.log('PASS Tech: page forms, dirty cancel, retained listeners, five isolated destinations, deployment list/error/refresh, master add/edit, Finance/HRD destinations, package/license/operations/sprint error retention, mobile width, other-domain modal preserved.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
