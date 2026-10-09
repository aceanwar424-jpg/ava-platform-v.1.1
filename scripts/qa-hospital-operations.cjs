// OWNED_BY: generic. Browser UI connected to real PGlite SQL; no external network.
const {chromium}=require('./lib/playwright.cjs');
const {createHospitalFixture,A,admin,receiver}=require('./lib/hospital-fixture.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/audit-evidence/2026-10-06');
const types=JSON.parse(fs.readFileSync(path.join(root,'config/rs-workflows.json'),'utf8'));
let pg,browser,fail=false;const steps=[];
const tables=new Set(['rs_workflow_types','rs_work_orders','rs_bed_reservations','rs_work_events','admissions','inpatient_beds']);
async function read(table,q){
 if(fail)throw Error('Synthetic backend unavailable');if(!tables.has(table))throw Error('Fixture table not allowed');
 const p=new URLSearchParams(q),values=[],where=[];const select=p.get('select')||'*';if(!/^(\*|[a-z_,]+)$/.test(select))throw Error('Bad select');
 for(const [k,v] of p){if(['select','order','limit','offset'].includes(k))continue;if(!/^[a-z_]+$/.test(k)||!v.startsWith('eq.'))throw Error('Bad query');values.push(v.slice(3));where.push(`"${k}"=$${values.length}`);}
 let sql=`SELECT ${select} FROM public."${table}"${where.length?' WHERE '+where.join(' AND '):''}`;
 if(p.get('order')){const order=p.get('order').split(',').map(x=>{const [col,dir]=x.split('.');if(!/^[a-z_]+$/.test(col)||!['asc','desc',undefined].includes(dir))throw Error('Bad order');return '"'+col+'" '+(dir||'asc');});sql+=' ORDER BY '+order.join(',');}
 sql+=' LIMIT '+Math.min(Number(p.get('limit'))||1000,2000)+' OFFSET '+(Number(p.get('offset'))||0);
 return (await pg.query(sql,values)).rows;
}
async function rpc(name,args){
 if(fail)throw Error('Synthetic backend unavailable');if(!/^(rs_|inp_)[a-z_]+$/.test(name))throw Error('Fixture RPC not allowed');
 const entries=Object.entries(args),values=entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v);
 const named=entries.map(([k],i)=>{if(!/^p_[a-z_]+$/.test(k))throw Error('Bad arg');return k+'=> $'+(i+1);}).join(',');
 if(name==='rs_staff_directory')return(await pg.query('SELECT * FROM rs_staff_directory()')).rows;
 return (await pg.query(`SELECT public.${name}(${named}) AS result`,values)).rows[0].result;
}
async function actor(id=admin,role='super_admin') {await pg.query('UPDATE user_profiles SET role=$1 WHERE id=$2',[role,id]);await pg.query("SELECT set_config('app.user_id',$1,false),set_config('app.tenant_id',$2,false)",[id,A]);}
async function render(page,id){await page.evaluate(id=>renderHospitalOperations({page:id}),id);await page.locator('.rs-ops').waitFor();}
async function save(page){await page.locator('#rs-form button[type=submit]').click();await page.locator('#rs-form').waitFor({state:'detached'});await page.locator('.rs-ops').waitFor();}
async function detail(page,id){await page.locator(`[data-detail="${id}"]`).click();await page.locator('#rs-form').waitFor();}
async function workflow(page,type){
 await actor();await render(page,type.code);await page.locator('#rs-new').click();
 await page.locator('[name=title]').fill('Synthetic '+type.label);await page.locator('[name=location]').fill('Synthetic ward');
 if(type.patient_required)await page.locator('[name=admission_id]').selectOption('1');await save(page);
 const r=(await pg.query('SELECT * FROM rs_work_orders WHERE kind=$1 ORDER BY id DESC LIMIT 1',[type.code])).rows[0];
 await detail(page,r.id);await page.locator('#rs-action').selectOption('assign');await page.locator('[name=evidence_assignee_id]').selectOption(admin);await save(page);
 for(const stage of type.stages){await actor(stage.receiver?receiver:admin,stage.receiver?'nurse':stage.roles[0]);await detail(page,r.id);for(const f of stage.fields)await page.locator(`[name=evidence_${f}]`).fill('Synthetic source '+f);await save(page);}
 assert.equal((await pg.query('SELECT status FROM rs_work_orders WHERE id=$1',[r.id])).rows[0].status,'completed');
 steps.push({name:'UI → SQL complete '+type.code,status:'passed'});console.log('PASS UI '+type.code);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});pg=await createHospitalFixture();
 await pg.query(`INSERT INTO inpatient_beds(tenant_id,ward_id,room_no,bed_no,class_code,status,is_active) VALUES($1,1,'Synthetic room','Synthetic bed','1','Kosong',true)`,[A]);
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url()==='http://127.0.0.1:43819/'?route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="id"><meta charset="utf-8"><title>RS synthetic QA</title><body style="margin:0;background:#f4f7fa;font-family:Arial,sans-serif"><main id="main-content"></main></body></html>'}):route.abort());
 await page.exposeFunction('sbGet',read);await page.exposeFunction('sbRpc',rpc);
 await page.goto('http://127.0.0.1:43819/');await page.evaluate(()=>{window.navigate=id=>{window.destination=id;};});
 await page.addScriptTag({path:path.join(root,'ava-platform/modules/his/hospital_operations.js')});
 for(const type of types)await workflow(page,type);
 await actor();await render(page,'rs-patient-flow');await page.locator('#rs-status').selectOption('completed');
 await page.screenshot({path:path.join(out,'hospital-board-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'hospital-board-mobile.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');steps.push({name:'desktop/mobile no overflow',status:'passed'});
 await page.setViewportSize({width:1440,height:1000});await render(page,'rs-bed-reservation');await page.locator('#rs-new-bed').click();await page.locator('[name=admission_id]').selectOption('1');await page.locator('[name=requirements]').fill('Synthetic bed needs');await save(page);
 const reservation=(await pg.query('SELECT * FROM rs_bed_reservations ORDER BY id DESC LIMIT 1')).rows[0];await page.locator(`[data-bed="${reservation.id}"]`).click();await page.locator('[name=bed_id]').selectOption('1');await save(page);
 assert.equal((await pg.query('SELECT status FROM rs_bed_reservations WHERE id=$1',[reservation.id])).rows[0].status,'reserved');
 await page.screenshot({path:path.join(out,'hospital-bed-reservation.png'),fullPage:true});
 await page.locator(`[data-cancel-bed="${reservation.id}"]`).click();await page.locator('[name=reason]').fill('Synthetic cancellation');await save(page);assert.equal((await pg.query('SELECT status FROM rs_bed_reservations WHERE id=$1',[reservation.id])).rows[0].status,'cancelled');steps.push({name:'UI bed request allocation cancellation',status:'passed'});
 await render(page,'rs-capacity');await page.locator('#rs-source').click();assert.equal(await page.evaluate(()=>window.destination),'inpatient');steps.push({name:'capacity actual bed and source navigation',status:'passed'});
 // HTML escaping: hostile title is displayed as literal text, never executed.
 await rpc('rs_create_order',{p_kind:'rs-transport',p_title:'<img src=x onerror="window.xss=true">',p_location:'Synthetic ward',p_admission_id:1,p_priority:'urgent',p_request_key:'synthetic-xss-title'});
 await render(page,'rs-transport');assert.equal(await page.locator('.rs-grid img').count(),0);assert.equal(await page.evaluate(()=>window.xss),undefined);steps.push({name:'hostile title escaped',status:'passed'});
 // Missing evidence and backend failure keep editor visible and do not report success.
 const active=(await pg.query("SELECT * FROM rs_work_orders WHERE status='active' AND kind='rs-transport' ORDER BY id DESC LIMIT 1")).rows[0];await detail(page,active.id);await page.locator('#rs-action').selectOption('assign');await page.locator('[name=evidence_assignee_id]').selectOption(admin);fail=true;await page.locator('#rs-form button[type=submit]').click();await page.locator('#rs-ops-error').waitFor({state:'visible'});assert.equal(await page.locator('#rs-form').count(),1);fail=false;
 await render(page,'rs-transport');fail=true;await page.locator('#rs-refresh').click();await page.locator('#rs-retry').waitFor();fail=false;await page.locator('#rs-retry').click();await page.locator('.rs-ops').waitFor();steps.push({name:'save/read failure and retry without false success',status:'passed'});
 await page.locator('#rs-status').selectOption('cancelled');assert.equal(await page.locator('.rs-grid article').count(),0);steps.push({name:'empty status filter',status:'passed'});
 for(let i=0;i<55;i++)await rpc('rs_create_order',{p_kind:'rs-transport',p_title:'Synthetic pagination '+i,p_location:'Synthetic ward',p_admission_id:1,p_priority:'normal',p_request_key:'synthetic-pagination-'+i});
 await page.locator('#rs-status').selectOption('active');await page.locator('.rs-grid article').first().waitFor();assert.equal(await page.locator('.rs-grid article').count(),50);await page.locator('#rs-next').click();await page.waitForFunction(()=>document.querySelector('.rs-ops nav:last-child')?.textContent.includes('Halaman 2'));assert.equal(await page.locator('.rs-grid article').count(),6);await page.locator('#rs-prev').click();await page.waitForFunction(()=>document.querySelector('.rs-ops nav:last-child')?.textContent.includes('Halaman 1'));steps.push({name:'pagination next previous with 56 actual SQL records',status:'passed'});
 const menu=JSON.parse(fs.readFileSync(path.join(root,'config/menu.json'),'utf8'));const routes=fs.readFileSync(path.join(root,'ava-platform/js/core/router.js'),'utf8');const manifest=fs.readFileSync(path.join(root,'ava-platform/js/core/modul-manifest.js'),'utf8');const rsMenus=menu.kategori.his.grup.flatMap(g=>g.menu).filter(m=>types.some(t=>t.code===m.id)||['rs-patient-flow','rs-bed-reservation','rs-capacity'].includes(m.id));assert.equal(rsMenus.length,21);for(const m of rsMenus){assert.ok(routes.includes(m.id==='rs-patient-flow'?"case 'rs-patient-flow': safeRun('renderCareEpisodes')":m.id==='rs-inpatient-billing'?"case 'rs-inpatient-billing': safeRun('renderRoomBilling')":`case '${m.id}': safeRun('renderHospitalOperations', {page:'${m.id}'})`));assert.ok(manifest.includes('"'+m.id+'"'));assert.equal(m.status,'parsial');}steps.push({name:'21 RS routes use dedicated episode renderer or task board with honest partial status',status:'passed'});
 const context={window:{roleConfig:{pages:['rs-housekeeping']}}};vm.runInNewContext(fs.readFileSync(path.join(root,'ava-platform/js/core/rbacService.js'),'utf8'),context);assert.equal(context.window.RBACService.canAccessRoute('housekeeping','rs-housekeeping'),true);assert.equal(context.window.RBACService.canAccessRoute('housekeeping','rs-discharge'),false);assert.equal(context.window.RBACService.canAccessRoute('viewer','rs-bed-reservation'),false);assert.equal(context.window.RBACService.canAccessRoute('super_admin','rs-discharge'),true);steps.push({name:'RS route guard effective page allowlist and denied unrelated routes',status:'passed'});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'hospital-ui-simulation.json'),JSON.stringify({synthetic:true,backend:'actual PGlite RPCs with synthetic baseline and accounting sinks',steps},null,2));
 console.log(`${steps.length} UI scenarios passed`);await browser.close();await pg.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();if(pg)await pg.close();process.exitCode=1;});
