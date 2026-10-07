// Synthetic navigation fixtures; production requests are blocked.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('../lib/playwright.cjs');
const html=fs.readFileSync('ava-platform/index.html','utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<div id="rail-nav"></div><div id="topbar-title"></div><main id="main-content"></main>'}));await page.goto('https://tech.avahealth.sbs');
 await page.addScriptTag({path:'ava-platform/js/core/peta-menu.js'});
 await page.evaluate(()=>{window.testRole='super_admin';window.getUserRole=()=>window.testRole;window.kategoriRuang=()=>['tech'];window.currentPage='';window.syncFlyoutToPage=()=>{};window.closeNavigationContext=()=>{};window.closeModulePicker=()=>{};window.setSidebarOpen=()=>{};window.navigateFromContext=(g,s,i)=>{window.selected=window.navigationMenuGroups.find(x=>x.id===g).services[s].items[i].page;};});
 await page.addScriptTag({content:between('let FLYOUT_MENUS = {};','function updateBreadcrumb(page)')});
 await page.addScriptTag({path:'ava-platform/js/core/tech-navigation.js'});
 await page.addStyleTag({path:'ava-platform/css/tech-navigation.css'});
 const menu=JSON.parse(fs.readFileSync('config/menu.json')).kategori.tech.grup.flatMap(g=>g.menu);
 for(const role of ['super_admin','manager','direktur','sales','viewer']){
  await page.evaluate(role=>{window.testRole=role;window.roleConfig={pages:['saas-console','tenants']};gambarRail('tech');TechNavigation.directory();},role);
  const actual=await page.evaluate(()=>modulePickerItems.map(i=>i.page));
  if(role==='super_admin')assert.equal(actual.length,23);else assert.deepEqual(actual.sort(),['saas-console','tech-sprint','tenants']);
  const groupIds=await page.evaluate(()=>navigationMenuGroups.map(g=>g.id));
  for(const id of groupIds){await page.evaluate(id=>TechNavigation.directory(id),id);const buttons=page.locator('.tech-directory-card:not(:disabled)');for(let i=0;i<await buttons.count();i++){await buttons.nth(i).click();const selected=await page.evaluate(()=>window.selected);assert(actual.includes(selected));assert(menu.some(m=>m.id===selected));}}
 }
 await page.evaluate(()=>{window.testRole='super_admin';gambarRail('tech');TechNavigation.directory();});
 fs.mkdirSync('docs/audit-evidence/2026-10-06',{recursive:true});
 await page.screenshot({path:'docs/audit-evidence/2026-10-06/tech-directory-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'docs/audit-evidence/2026-10-06/tech-directory-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.evaluate(()=>TechNavigation.directory('missing')),false);
 await page.evaluate(()=>{window.sbGet=async()=>[];window.toast=()=>{};});
 await page.addScriptTag({path:'ava-platform/modules/tech-platform/techControlPlane.js'});
 await page.evaluate(()=>renderTechControlPlane());
 assert.deepEqual(await page.locator('.tcp-panel').evaluateAll(a=>a.filter(e=>!e.hidden).map(e=>e.dataset.tcpPanel)),['ringkasan','ringkasan']);
 await page.evaluate(()=>{sessionStorage.setItem('avaTechDeploymentPrefill',JSON.stringify({tenant_id:'synthetic'}));tcpApplyDeploymentPrefill();});
 assert.deepEqual(await page.locator('.tcp-panel').evaluateAll(a=>a.filter(e=>!e.hidden).map(e=>e.dataset.tcpPanel)),['deployment']);
 assert.equal(await page.locator('#tcp-deploy-tenant').inputValue(),'synthetic');
 await page.addScriptTag({path:'ava-platform/modules/tech-platform/tech_saas.js'});
 await page.evaluate(()=>{window.sbGetStrict=async()=>[{ticket_no:'SYN-1',title:'Synthetic ticket',priority:'P2',status:'OPEN',created_at:'2026-10-06'}];});
 await page.evaluate(()=>renderTechIsu());assert((await page.locator('#main-content').textContent()).includes('SYN-1'));assert(!(await page.locator('#main-content').textContent()).includes('TICK-102'));
 await page.evaluate(()=>{window.sbGetStrict=async()=>{throw Error('synthetic unavailable')};});
 await page.evaluate(()=>renderTechRoadmap());assert(await page.locator('[role="alert"]').isVisible());
 await page.evaluate(()=>renderTechSprint());assert((await page.locator('#main-content').textContent()).includes('belum tersedia'));assert(!(await page.locator('#main-content').textContent()).includes('42 Story Points'));
 await page.addScriptTag({path:'ava-platform/modules/tech-platform/tenants.js'});
 await page.evaluate(()=>{window.sbGetStrict=async()=>[{id:'synthetic-tenant',kode:'synthetic',nama:'Tenant Sintetis',kota:'Jakarta',is_active:true}];window.toast=(message,type)=>{window.lastToast={message,type}};window.closeModalForce=()=>{};window.openModal=()=>{throw Error('Unexpected modal')};});
 await page.evaluate(()=>renderTenants());
 await page.getByRole('button',{name:'Detail',exact:true}).click();assert(await page.getByRole('heading',{name:'Tenant Sintetis'}).isVisible());
 await page.locator('#tnt-edit').click();assert(await page.locator('.tnt-page-editor').isVisible());
 await page.locator('#tnt-nama').fill('Tenant Diubah');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Batal',exact:true}).click();assert(await page.locator('.tnt-page-editor').isVisible());
 await page.evaluate(()=>{window.sbPatch=async()=>[]});await page.getByRole('button',{name:'Simpan Data Tenant',exact:true}).click();assert.equal(await page.evaluate(()=>lastToast.type),'err');assert(await page.locator('.tnt-page-editor').isVisible());
 await page.evaluate(()=>{window.sbPatch=async()=>[{id:'synthetic-tenant'}]});await page.getByRole('button',{name:'Simpan Data Tenant',exact:true}).click();await page.waitForSelector('#tnt-isi');assert.equal(await page.evaluate(()=>lastToast.type),'ok');
 await page.evaluate(()=>tntDetail('missing'));assert((await page.locator('#main-content').textContent()).includes('tidak ditemukan'));
 await page.goto('https://his.avahealth.sbs');await page.addScriptTag({path:'ava-platform/js/core/tech-navigation.js'});assert.equal(await page.evaluate(()=>TechNavigation.enabled()),false);
 await browser.close();console.log('PASS: five role inventories, directory targets, mobile, invalid group, initial panel, tenant deployment prefill, non-Tech isolation, tenant detail/edit/dirty guard/save validation');
})().catch(e=>{console.error(e);process.exit(1)});
