// OWNED_BY: generic. Exercise new directory behavior with synthetic state only.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('../lib/playwright.cjs');
const html=fs.readFileSync('ava-platform/index.html','utf8');
const start=html.indexOf('let FLYOUT_MENUS = {};'),end=html.indexOf('function updateBreadcrumb(page)',start);
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<body class="ava-ops-shell"><nav id="rail-nav"></nav><div id="topbar-title"></div><main id="main-content"></main></body>'}));await p.goto('https://tech.avahealth.sbs');
  await p.addScriptTag({path:'ava-platform/js/core/peta-menu.js'});await p.addScriptTag({path:'ava-platform/js/core/icons.js'});
  await p.evaluate(()=>{window.testRole='super_admin';window.getUserRole=()=>testRole;window.roleConfig={};window.kategoriRuang=()=>['tech'];window.currentPage='';window.syncFlyoutToPage=()=>{};});
  await p.addScriptTag({content:html.slice(start,end)});
  await p.addScriptTag({path:'ava-platform/js/core/tech-navigation.js'});await p.addScriptTag({path:'ava-platform/js/core/workspace-navigation.js'});await p.addStyleTag({path:'ava-platform/css/workspace-design.css'});
  await p.evaluate(()=>{gambarRail('tech');window.navigateFromContext=(g,s,i)=>{window.selected=navigationMenuGroups.find(x=>x.id===g).services[s].items[i].page;};WorkspaceNavigation.directory(navigationMenuGroups[0].id);});
  assert.equal(await p.evaluate(()=>WorkspaceNavigation.directory('invalid')),false);
  const opener=p.getByRole('button',{name:'Tampilkan submenu Pusat Kendali Operasi'});await opener.click();assert.equal(await opener.getAttribute('aria-expanded'),'true');
  await p.keyboard.press('Escape');assert.equal(await opener.getAttribute('aria-expanded'),'false');assert(await opener.evaluate(e=>e===document.activeElement));
  await opener.click();await p.getByRole('button',{name:'Deployment tenant',exact:true}).click();assert.equal(await p.evaluate(()=>selected),'tech-control-plane');assert.equal(await p.evaluate(()=>workspacePanelTarget.panel),'deployment');
  await p.evaluate(()=>{window.sbGetStrict=async()=>[];window.toast=()=>{};});await p.addScriptTag({path:'ava-platform/modules/tech-platform/techControlPlane.js'});await p.evaluate(()=>renderTechControlPlane());
  assert.deepEqual(await p.locator('.tcp-panel').evaluateAll(a=>a.filter(e=>!e.hidden).map(e=>e.dataset.tcpPanel)),['deployment']);assert.equal(await p.evaluate(()=>workspacePanelTarget),null);
  for(const role of ['manager','direktur','sales','viewer']){
   await p.evaluate(role=>{window.testRole=role;window.roleConfig={pages:['saas-console']};gambarRail('tech');WorkspaceNavigation.directory(navigationMenuGroups[0].id);},role);
   assert.equal(await p.locator('.workspace-tile').count(),1);assert.equal(await p.locator('[data-panel]').count(),0);assert(!(await p.locator('#main-content').textContent()).includes('Pusat Kendali'));
  }
  console.log('PASS: invalid group, dropdown Escape/focus, actual deployment panel, consumed destination, four restricted role inventories.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
