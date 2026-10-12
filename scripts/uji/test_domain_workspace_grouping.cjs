// OWNED_BY: generic. Actual menu renderer; synthetic auth; no external requests.
const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
const {chromium}=require('../lib/playwright.cjs');
const html=fs.readFileSync('ava-platform/index.html','utf8');
const nav=html.slice(html.indexOf('let FLYOUT_MENUS = {};'),html.indexOf('function updateBreadcrumb(page)',html.indexOf('let FLYOUT_MENUS = {};')));
const sites=JSON.parse(fs.readFileSync('config/domain.json')).situs;
const out='docs/audit-evidence/2026-10-12';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];fs.mkdirSync(out,{recursive:true});
try{for(const site of sites.filter(s=>s.workspace)){
 const page=await browser.newPage({viewport:{width:1365,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.fulfill({body:'<body class="ava-ops-shell"><aside class="sidebar-rail" id="sidebar-rail"><div class="sidebar-brand-box"><strong>Ruang kerja</strong></div><nav id="rail-nav" class="rail-nav"></nav></aside><header class="topbar"><div id="topbar-title"></div></header><main class="main-content" id="main-content"></main></body>',contentType:'text/html'}));await page.goto('https://'+site.host[0]);
 for(const file of ['peta-menu','icons'])await page.addScriptTag({path:'ava-platform/js/core/'+file+'.js'});
 await page.evaluate(()=>{window.getUserRole=()=>window.syntheticRole||'super_admin';window.roleConfig={};window.currentPage='';window.syncFlyoutToPage=()=>{};window.navigate=(p,args)=>{window.destination={page:p,args};};window.navigateFromContext=(g,s,i)=>{const item=navigationMenuGroups.find(x=>x.id===g).services[s].items[i];window.destination={page:item.page};};});
 await page.addScriptTag({content:nav});for(const file of ['tech-navigation','workspace-navigation','tech-pages'])await page.addScriptTag({path:'ava-platform/js/core/'+file+'.js'});
 await page.addStyleTag({path:'ava-platform/css/style.css'});await page.addStyleTag({path:'ava-platform/css/workspace-design.css'});
 await page.evaluate(w=>gambarRail(w),site.workspace);
 const groups=await page.evaluate(()=>navigationMenuGroups.map(g=>({id:g.id,count:g.services.reduce((n,s)=>n+s.items.length,0)})));
 assert(groups.length>0,site.kunci+' requires groups');let leaves=0;
 for(const group of groups){await page.evaluate(id=>WorkspaceNavigation.directory(id),group.id);assert.equal(await page.locator('.workspace-children .workspace-children').count(),0);leaves+=await page.locator('.workspace-child').count();const buttons=page.locator('.workspace-tile-toggle[aria-controls]');if(await buttons.count()){await buttons.first().click();assert.equal(await buttons.first().getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await buttons.first().getAttribute('aria-expanded'),'false');}}
 // Common section navigation consumes its target on every operational hostname.
 await page.evaluate(()=>{workspacePanelTarget={page:'finance',panel:'payment'};window.chosen=WorkspaceNavigation.selection('finance','invoice');});assert.equal(await page.evaluate(()=>chosen),'payment');assert.equal(await page.evaluate(()=>workspacePanelTarget),null);
 if(site.kunci==='his'){await page.evaluate(()=>{window.sbGet=async()=>[];window.formatRp=v=>String(v||0);window.formatDate=v=>v||'';window.formatDateShort=v=>v||'';window.toast=()=>{};});for(const mod of ['finance/finance','hrd/hrd'])await page.addScriptTag({path:'ava-platform/modules/'+mod+'.js'});await page.evaluate(()=>{workspacePanelTarget={page:'finance',panel:'payment'};return renderFinance();});assert.equal(await page.locator('#fin-tabs').count(),0);assert.equal(await page.locator('#main-content h1').textContent(),'Pembayaran');await page.evaluate(()=>{workspacePanelTarget={page:'hrd',panel:'leave'};return renderHRD();});assert.equal(await page.locator('#hrd-tabs').count(),0);assert.equal(await page.locator('#main-content h1').textContent(),'Absensi & cuti');}
 await page.evaluate(()=>WorkspaceNavigation.directory(navigationMenuGroups[0].id));await page.screenshot({path:path.join(out,site.kunci+'-grouping-desktop.png')});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,site.kunci+'-grouping-mobile.png')});
 await page.evaluate(w=>{window.syntheticRole='viewer';window.roleConfig={pages:[]};gambarRail(w);WorkspaceNavigation.directory();},site.workspace);assert.equal(await page.locator('.workspace-child:not(:disabled)').count(),0);assert.deepEqual(errors,[]);
 results.push({domain:site.kunci,workspace:site.workspace,groups:groups.length,leaves,mobileOverflow:false,restrictedRole:true,errors});await page.close();console.log('PASS '+site.kunci+' grouping, keyboard, mobile, restricted role');
 }fs.writeFileSync(out+'/domain-workspace-grouping.json',JSON.stringify({synthetic:true,results},null,2));}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
