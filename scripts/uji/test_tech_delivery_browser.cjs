// OWNED_BY: generic. Real app boot/router and authenticated native SQL; synthetic only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),f=require('../lib/tech-delivery-fixture.cjs');
const {chromium}=require('../lib/playwright.cjs'),{createAuthenticatedBrowserSql}=require('../lib/authenticated-browser-sql.cjs');let pg,browser,heldResolve;
(async()=>{let count=0;try{const s=await f.createDeliveryFixture();pg=s.pg;await s.actor(s.worker);
 let change=await s.ops('change','create',{title:'Synthetic browser release',type:'code',risk:'Synthetic reviewed risk',rollback:'Synthetic rollback'});change=await s.opsNext('change',change,'submit');await s.actor(s.receiver);change=await s.opsNext('change',change,'approve');await s.actor(s.worker);change=await s.opsNext('change',change,'start',{preflight:{reference:'SYN-PREFLIGHT'}});change=await s.opsNext('change',change,'complete',{release:'SYN-UI-1',result:{reference:'SYN-RESULT'}});
 let deployment=await s.ops('deployment','report',{change_id:change.id,module:'his',installation:'SYN-INSTALL',environment:'test',release:'SYN-UI-1',evidence:'SYN-SOURCE-INSTALL'});await s.actor(s.receiver);deployment=await s.opsNext('deployment',deployment,'verify',{evidence:'SYN-INDEPENDENT'});await s.actor();
 const allowed=['tech_delivery_board','tech_delivery_command','tech_delivery_sources','tech_delivery_audit','tech_ops_board'];
 const rpc=await createAuthenticatedBrowserSql(pg,allowed);let hold=null,holdEntered,commandCount=0;
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1365,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('ol_token','synthetic.jwt.token'));
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url()),json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/runtime-config.js')return route.fulfill({contentType:'application/javascript',body:'window.AVA_RUNTIME_CONFIG={supabaseUrl:"https://synthetic-db.invalid",supabaseAnonKey:"synthetic-key"};'});
  if(url.hostname==='synthetic-db.invalid'){
   if(url.pathname==='/auth/v1/user')return json({id:s.admin,email:'synthetic@example.invalid'});
   if(url.pathname.includes('/user_profiles'))return json([{id:s.admin,tenant_id:s.A,role:'super_admin',full_name:'Synthetic admin',is_active:true}]);
   const name=url.pathname.split('/rpc/')[1];if(allowed.includes(name)){try{if(name==='tech_delivery_command')commandCount++;const result=await rpc(name,req.postDataJSON());if(hold&&name==='tech_delivery_board'){holdEntered?.();await hold;}return json(result);}catch(e){return json({message:e.message},400);}}
   return json([]);
  }
  if(url.hostname==='tech.avahealth.sbs'){const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)),file=path.resolve('ava-platform',relative),root=path.resolve('ava-platform');if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream',body:fs.readFileSync(file)});}
  return route.fulfill({status:200,body:''});
 });
 const check=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
 const actor=async(id,role)=>{await s.actor(id);await page.evaluate(({id,tenant,role})=>{window.currentUser={id,tenant_id:tenant,role,profile:{id,tenant_id:tenant,role}};return renderTechDelivery();},{id,tenant:s.A,role});};
 const submit=async()=>{await page.locator('#td-editor [type=submit]').click();await page.locator('#td-editor form').waitFor({state:'detached'});};
 const action=async(name)=>{await page.locator('[data-project="1"] > button[data-action="'+name+'"]').click();await page.locator('#td-editor [name=reason]').fill('Synthetic browser reviewed reason');};
 await check('real app boot and lazy router load actual delivery source instead of readiness panel',async()=>{
  await page.goto('https://tech.avahealth.sbs/?techPage=tech-delivery');await page.locator('#td-new').waitFor();assert.equal(await page.evaluate(()=>typeof renderTechDelivery),'function');assert.ok(!(await page.locator('#main-content').textContent()).includes('SYN-SECRET'));assert.ok((await page.evaluate(()=>MODUL_HALAMAN['tech-delivery'])).includes('modules/tech-platform/delivery.js'));
 });
 await check('typed scope/SLA/milestones create through source picker and authenticated transaction',async()=>{
  await page.locator('#td-new').click();await page.locator('[name=title]').fill('Synthetic browser delivery');await page.locator('[name=contract_reference]').fill('SYN-BROWSER-CONTRACT');await page.locator('[data-source=license]').click();await page.locator('[data-pick="1"]').click();
  await page.locator('[name=modules]').fill('his');await page.locator('[name=installation]').fill('SYN-INSTALL');await page.locator('[name=environment]').selectOption('test');await page.locator('[name=timezone]').fill('Asia/Jakarta');for(const v of ['P0','P1','P2','P3']){await page.locator('[name='+v+'_response]').fill('5');await page.locator('[name='+v+'_resolution]').fill('10');}
  await page.locator('#td-add-milestone').click();for(const [i,code] of ['onboarding','his-install'].entries()){const row=page.locator('.td-milestone').nth(i);await row.locator('[name=m_code]').fill(code);await row.locator('[name=m_title]').fill('Synthetic '+code);await row.locator('[name=m_mandatory]').check();await row.locator('[name=m_due]').fill('2026-11-01T09:00:00+07:00');if(i===1)await row.locator('[name=m_module]').fill('his');}
  await page.locator('[name=reason]').fill('Synthetic source create');await submit();assert.equal((await s.q('SELECT count(*)::int n FROM tech_delivery_projects'))[0].n,1);
 });
 await check('scope maker/checker, UI errors and running state',async()=>{
  await action('submit');await submit();await action('approve');await page.locator('#td-editor [type=submit]').click();await page.waitForFunction(()=>document.getElementById('td-error').textContent.includes('berbeda'));assert.equal(await page.locator('#td-editor form').count(),1);
  await actor(s.receiver,'direktur');await action('approve');await submit();await actor(s.worker,'tech');await action('start');await submit();assert.equal((await s.q('SELECT state FROM tech_delivery_projects WHERE id=1'))[0].state,'running');
 });
 await check('source deployment and onboarding milestone review reach handover with real audit history',async()=>{
  for(let index=0;index<2;index++){await actor(s.worker,'tech');await page.locator('[data-action=milestone_submit]').first().click();await page.locator('[name=evidence]').fill('SYN-BROWSER-MILESTONE');if(index===1){await page.locator('[data-source=deployment]').click();await page.locator('[data-pick="'+deployment.id+'"]').click();}await page.locator('[name=reason]').fill('Synthetic milestone submission');await submit();await actor(s.receiver,'direktur');await page.locator('[data-action=milestone_accept]').first().click();await page.locator('[name=reason]').fill('Synthetic independent milestone review');await submit();}
  await actor(s.worker,'tech');await action('handover');await submit();await page.locator('[data-audit="1"]').click();await page.locator('[data-audit-output="1"] .td-audit-prev').waitFor();assert.match(await page.locator('[data-audit-output="1"]').textContent(),/Serah terima/);
 });
 await check('independent customer evidence, follow-up and final closure; source drift remains visible',async()=>{
  await actor(s.receiver,'direktur');await action('accept');await page.locator('[name=acceptance_reference]').fill('SYN-CUSTOMER-ACCEPTANCE');await submit();await action('close');await page.locator('[name=followup_reference]').fill('SYN-ADOPTION-FOLLOWUP');await page.locator('[name=followup_outcome]').fill('Synthetic usage observed by reviewer');await submit();assert.equal((await s.q('SELECT state FROM tech_delivery_projects WHERE id=1'))[0].state,'closed');
  await s.q("UPDATE tech_lisensi SET status='Dicabut' WHERE id=1");await page.locator('#td-reload').click();await page.waitForFunction(()=>document.querySelector('[data-project="1"]')?.textContent.includes('Lisensi/paket sumber berubah'));
 });
 await check('real navigation connects release and verified module board back to delivery',async()=>{
  await actor(s.admin,'super_admin');for(const route of ['tech-roadmap','tech-modul']){await page.evaluate(route=>navigate(route),route);await page.locator('[data-delivery="1"]').waitFor();await page.locator('[data-delivery="1"]').click();await page.locator('#td-new').waitFor();assert.equal(await page.evaluate(()=>currentPage),'tech-delivery');}
 });
 await check('stale form cannot send command after context changes',async()=>{
  await page.locator('#td-new').click();await page.evaluate(()=>{document.querySelector('form').noValidate=true;currentUser.id='changed';});const before=commandCount;await page.locator('#td-editor [type=submit]').click();await page.waitForFunction(()=>document.getElementById('td-error').textContent.includes('berubah'));assert.equal(commandCount,before);await actor(s.receiver,'direktur');
 });
 await check('late source response cannot expose prior tenant data; pagination resets and mobile has no overflow',async()=>{
  const entered=new Promise(resolve=>holdEntered=resolve);hold=new Promise(resolve=>heldResolve=resolve);await page.evaluate(()=>{window.pendingDelivery=renderTechDelivery();});await entered;await s.actor(s.foreign,s.B);await page.evaluate(({id,tenant})=>{currentUser={id,tenant_id:tenant};},{id:s.foreign,tenant:s.B});heldResolve();hold=null;await page.evaluate(()=>pendingDelivery);assert.ok(!(await page.locator('#main-content').textContent()).includes('SYN-BROWSER-CONTRACT'));
  await page.evaluate(async()=>{tdOffset=50;await renderTechDelivery();});assert.equal(await page.evaluate(()=>tdOffset),0);assert.equal(await page.locator('[data-project]').count(),0);
  await actor(s.receiver,'direktur');await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 });
 console.log(count+' authenticated app delivery scenarios passed');
}finally{if(heldResolve)heldResolve();if(browser)await browser.close();if(pg)await pg.close();if(process.env.RS_TEST_RUNTIME)assert.equal(fs.existsSync(path.join(process.env.RS_TEST_RUNTIME,'cluster')),false);console.log('Browser and dummy database removed; no test files retained');}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
