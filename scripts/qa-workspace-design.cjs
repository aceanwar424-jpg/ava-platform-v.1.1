// OWNED_BY: generic. Synthetic UI checks; all requests served from local files.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('./lib/playwright.cjs');
const {localRoute}=require('./qa-domain-readability.cjs');
const sites=JSON.parse(fs.readFileSync('config/domain.json')).situs;
const html=fs.readFileSync('ava-platform/index.html','utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const out='docs/audit-evidence/2026-10-06/workspace-design';
const clean=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const appsOnly=process.argv.includes('--apps-only');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
 try{
  for(const site of sites.filter(s=>!appsOnly&&s.masuk==='/index.html')){
   const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
   await page.route('**/*',r=>{const u=new URL(r.request().url());return u.pathname==='/'?r.fulfill({contentType:'text/html',body:clean(html)}):localRoute(r);});
   await page.goto('https://'+site.host[0]+'/');
   await page.addScriptTag({path:'ava-platform/js/core/icons.js'});await page.addScriptTag({path:'ava-platform/js/core/peta-menu.js'});
   await page.evaluate(()=>{window.getUserRole=()=> 'super_admin';window.roleConfig={};window.currentPage='';window.syncFlyoutToPage=()=>{};});
   await page.addScriptTag({content:between('function setSidebarOpen(isOpen)', '// ── Date display')});
   await page.addScriptTag({content:between('let FLYOUT_MENUS = {};','function updateBreadcrumb(page)')});
   await page.addScriptTag({path:'ava-platform/js/core/tech-navigation.js'});await page.addScriptTag({path:'ava-platform/js/core/workspace-navigation.js'});
   await page.evaluate(workspace=>{gambarRail(workspace);window.navigateFromContext=(g,s,i)=>{window.fixtureTarget=navigationMenuGroups.find(x=>x.id===g).services[s].items[i].page;};},site.workspace);
   assert(await page.evaluate(()=>navigationMenuGroups.length>0),site.kunci+' real workspace groups');
   await page.evaluate(()=>WorkspaceNavigation.directory(navigationMenuGroups[0].id));
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    const dimensions=await page.evaluate(()=>{const rail=document.getElementById('sidebar-rail').getBoundingClientRect(),header=document.getElementById('topbar').getBoundingClientRect(),main=document.getElementById('main-content').getBoundingClientRect();return {rail:rail.width,headerLeft:header.left,headerHeight:header.height,mainLeft:main.left,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert(!dimensions.overflow,site.kunci+' overflow '+width);assert.equal(dimensions.headerHeight,60);
    if(width===1440){assert.equal(dimensions.headerLeft,224);assert.equal(dimensions.mainLeft,224);
     await page.evaluate(()=>setSidebarExpanded(true));await page.waitForTimeout(250);assert.equal(await page.locator('#topbar').evaluate(e=>e.getBoundingClientRect().left),64);
     await page.evaluate(()=>toggleSidebarVisibility());await page.waitForTimeout(250);assert.equal(await page.locator('#topbar').evaluate(e=>e.getBoundingClientRect().left),0);
     await page.evaluate(()=>toggleSidebarVisibility());await page.waitForTimeout(250);await page.screenshot({path:`${out}/${site.kunci}-compact.png`});await page.evaluate(()=>setSidebarExpanded(false));await page.waitForTimeout(250);
    }else{assert.equal(dimensions.headerLeft,0);await page.evaluate(()=>toggleSidebarVisibility());await page.waitForTimeout(250);assert(await page.locator('#sidebar-rail').evaluate(e=>e.classList.contains('open')));await page.evaluate(()=>setSidebarOpen(false));}
    await page.screenshot({path:`${out}/${site.kunci}-${width}.png`,fullPage:true});results.push({domain:site.kunci,width,...dimensions});
   }
   if(site.workspace==='tech'){
    await page.setViewportSize({width:1440,height:1000});const toggle=page.getByRole('button',{name:'Tampilkan submenu Pusat Kendali Operasi'});await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    await page.screenshot({path:`${out}/tech-expanded-menu.png`});await page.getByRole('button',{name:'Kesehatan sistem',exact:true}).click();assert.equal(await page.evaluate(()=>fixtureTarget),'tech-control-plane');assert.equal(await page.evaluate(()=>workspacePanelTarget.panel),'kesehatan');
    await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');await toggle.click();
    await page.screenshot({path:`${out}/${site.kunci}-dark.png`});
    assert.equal(await page.locator('.workspace-tile').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(23, 36, 50)');
   }
   await page.close();
  }
  for(const site of sites.filter(s=>s.masuk==='/apps/index.html')){
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await page.route('**/*',r=>new URL(r.request().url()).pathname==='/'?r.fulfill({contentType:'text/html',body:clean(fs.readFileSync('ava-platform/apps/index.html','utf8'))}):localRoute(r));
  await page.goto('https://'+site.host[0]+'/');
  await page.evaluate(()=>{document.getElementById('login-screen').classList.remove('active');document.getElementById('dashboard-screen').classList.add('active');document.querySelectorAll('.view-panel').forEach(e=>e.classList.remove('active'));document.getElementById('patient-view').classList.add('active');window.currentRole='patient';window.currentUserProfile={role:'patient'};window.currentUsername='Akun Sintetis';window.showView=id=>window.fixtureView=id;});
  await page.addScriptTag({path:'ava-platform/apps/navigation.js'});await page.addScriptTag({path:'ava-platform/apps/workspace-design.js'});await page.evaluate(()=>{renderAppsMenu();renderAppsHome(document.getElementById('patient-view'));});
  await page.locator('.apps-directory-group').first().locator('summary').click();assert(await page.locator('.apps-directory-group').first().evaluate(e=>e.open));
  await page.locator('.apps-directory-children button').first().click();assert(await page.evaluate(()=>typeof fixtureView==='string'));
  assert(!await page.locator('.apps-directory-group').first().evaluate(e=>e.open));
  await page.locator('.apps-directory-group').first().locator('summary').click();await page.keyboard.press('Escape');assert(!await page.locator('.apps-directory-group').first().evaluate(e=>e.open));
  await page.locator('.apps-directory-group').first().locator('summary').click();
  await page.screenshot({path:`${out}/${site.kunci}-desktop.png`});results.push({domain:site.kunci,width:1440,overflow:false});await page.locator('.apps-collapse-btn').click();assert.equal(await page.locator('#app-sidebar').evaluate(e=>e.getBoundingClientRect().width),64);
  await page.locator('.menu-toggle-btn').click();assert(await page.locator('#app-sidebar').evaluate(e=>getComputedStyle(e).display==='none'));await page.locator('.menu-toggle-btn').click();
  await page.setViewportSize({width:390,height:844});await page.locator('.menu-toggle-btn').click();assert(await page.locator('#app-sidebar').evaluate(e=>e.classList.contains('open')));await page.locator('.apps-sidebar-scrim').click({position:{x:350,y:300}});assert(!await page.locator('#app-sidebar').evaluate(e=>e.classList.contains('open')));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/${site.kunci}-mobile.png`});results.push({domain:site.kunci,width:390,overflow:false});await page.close();
  }
  for(const site of sites.filter(s=>!appsOnly&&!['/index.html','/apps/index.html'].includes(s.masuk))){
   for(const width of [1440,390]){
    const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    await p.route('**/*',r=>new URL(r.request().url()).pathname==='/'?r.fulfill({contentType:'text/html',body:clean(fs.readFileSync('ava-platform'+site.masuk,'utf8'))}):localRoute(r));
    await p.goto('https://'+site.host[0]+'/');
    const data=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,background:getComputedStyle(document.body).backgroundColor}));
    assert(!data.overflow,site.kunci+' overflow '+width);
    await p.screenshot({path:`${out}/${site.kunci}-${width}.png`,fullPage:true});results.push({domain:site.kunci,width,...data});await p.close();
   }
  }
  fs.writeFileSync(`${out}/${appsOnly?'verification-apps':'verification'}.json`,JSON.stringify(results,null,2));console.log('PASS: '+results.length+' domain/viewports, shared header alignment, compact/hidden/mobile sidebar, real child destinations, Apps controls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
