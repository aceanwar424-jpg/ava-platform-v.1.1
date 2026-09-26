// OWNED_BY: generic. Browser -> local RPC adapter -> real PGlite migrations. No production access.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createFixture,A,P,H,I}=require('./verify-wellness-orchestration.cjs');
async function main(){
 const {db,actor,rpc,program,eid}=await createFixture();
 let browser,server;
 try{
  await actor(P);await rpc('wellness_accept_consent',[program,'wellness-privacy-v2',true]);
  await rpc('wellness_record_self',[program,'blood_pressure',JSON.stringify({systolic:145,diastolic:95}),new Date(Date.now()-3600000).toISOString(),'resting',null,null,'browser-bp']);
  await actor(A);await rpc('wellness_set_result_provider',[program,I,true]);
  const root=path.resolve('ava-platform'),actors={hr:H,admin:A,patient:P,ihc:I};let serial=Promise.resolve();
  server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/rpc'){
    let body='';req.on('data',c=>body+=c);req.on('end',()=>{serial=serial.then(async()=>{
     try{const {name,args,role}=JSON.parse(body);if(!/^wellness_[a-z_]+$/.test(name)||!actors[role])throw Error('Invalid fixture RPC');
      await actor(actors[role]);const entries=Object.entries(args||{});if(entries.some(([k])=>!/^p_[a-z_]+$/.test(k)))throw Error('Invalid argument');
      const values=entries.map(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)?JSON.stringify(v):v);
      const result=await db.query(`SELECT ${name}(${entries.map(([k],i)=>k+' => $'+(i+1)).join(',')}) AS value`,values);
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result.rows[0].value));
     }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.message}));}
    });});return;
   }
   if(url.pathname==='/test'){
    const role=Object.keys(actors).includes(url.searchParams.get('role'))?url.searchParams.get('role'):'hr';
    const view=role==='admin'?'main-content':role==='patient'?'wellness-personal-view':role==='ihc'?'wellness-import-view':'corporate-wellness-view';
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/wellness-base.css"><link rel="stylesheet" href="/css/wellness-flow.css"><style>body{margin:0;padding:20px;box-sizing:border-box;font-family:system-ui}*{box-sizing:border-box}</style></head><body><main id="${view}"></main><script>
     window.alert=()=>{};
     async function sbRpc(name,args={}){const r=await fetch('/rpc',{method:'POST',body:JSON.stringify({name,args,role:${JSON.stringify(role)}})});const data=await r.json();if(!r.ok)throw Error(data.message);return data;}
     </script><script src="/js/wellness-flow.js"></script><script src="/apps/wellness.js"></script><script src="/modules/his/wellness_orchestration.js"></script><script>
     ${role==='admin'?'renderHisWellness()':role==='patient'?'renderPersonalWellness()':role==='ihc'?'renderWellnessImport()':'renderCorporateWellness()'};
     </script></body></html>`);return;
   }
   const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/test?role=hr');await page.locator('[data-enrollment]').waitFor();
  assert.equal(await page.locator('[data-participants] tr').count(),1);assert.match(await page.locator('[data-participants]').innerText(),/L3/);
  assert.equal(await page.locator('[data-participants] img').count(),0,'participant names escaped');
  await page.locator('[data-tier]').selectOption('1');assert.match(await page.locator('[data-participants]').innerText(),/Tidak ada/);
  await page.locator('[data-tier]').selectOption('3');await page.locator('[data-enrollment]').check();await page.locator('[data-action=request]').click();
  await page.locator('#wf-dialog [name=label]').fill('Treatment UAT browser');await page.locator('#wf-dialog [name=notes]').fill('Dua sesi sintetis');
  await page.locator('#wf-dialog button[type=submit]').click();await page.locator('#wf-dialog').waitFor({state:'detached'});
  await page.getByText('Treatment UAT browser',{exact:true}).waitFor();assert.equal(await page.locator('[data-action=accept]').count(),0);
  fs.mkdirSync('docs/audit-evidence/wellness',{recursive:true});await page.screenshot({path:'docs/audit-evidence/wellness/hr-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/audit-evidence/wellness/hr-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile no horizontal document overflow');
  await page.setViewportSize({width:1366,height:900});await page.goto(origin+'/test?role=admin');
  await page.locator('[data-action=accept]').click();await page.locator('[data-action=schedule]').waitFor();
  await page.locator('[data-action=schedule]').click();await page.locator('#wf-dialog [name=schedule]').fill('2026-09-24T08:00');await page.locator('#wf-dialog [name=staff]').selectOption(A);await page.locator('#wf-dialog button[type=submit]').click();await page.locator('#wf-dialog').waitFor({state:'detached'});
  await page.locator('[data-action=report]').click();await page.locator('#wf-dialog [name=attendance]').selectOption('late');await page.locator('#wf-dialog [name=adherence]').selectOption('partial');await page.locator('#wf-dialog [name=report]').fill('Hadir terlambat, mengikuti sebagian arahan.');await page.locator('#wf-dialog [name=follow_up]').fill('Evaluasi disiplin pada kunjungan berikutnya.');await page.locator('#wf-dialog button[type=submit]').click();await page.locator('#wf-dialog').waitFor({state:'detached'});
  await page.locator('[data-action=complete]').click();await page.locator('#wf-dialog [name=report]').fill('Treatment selesai; evaluasi disampaikan kepada HR.');await page.locator('#wf-dialog button[type=submit]').click();await page.locator('#wf-dialog').waitFor({state:'detached'});
  await page.screenshot({path:'docs/audit-evidence/wellness/his-completed.png',fullPage:true});
  // Configuration lives in HIS and its existing forms actually mount.
  await page.locator('[data-tab=setup]').click();await page.locator('#wellness-program-form').waitFor();
  await page.locator('[data-tab=imports]').click();await page.locator('#wellness-import-program').waitFor();
  await page.goto(origin+'/test?role=patient');await page.getByText('Treatment UAT browser',{exact:true}).waitFor();assert.match(await page.locator('#wellness-personal-treatments').innerText(),/Terlambat/);
  await page.locator('[data-action=history]').click();await page.locator('#wf-dialog table').waitFor();assert.match(await page.locator('#wf-dialog').innerText(),/145/);await page.locator('[data-close]').click();
  await page.screenshot({path:'docs/audit-evidence/wellness/participant-report.png',fullPage:true});
  await page.goto(origin+'/test?role=ihc');await page.locator('#wellness-import-program').waitFor();assert.equal(await page.locator('[data-action=request]').count(),0);assert.equal(await page.locator('#wellness-import-program option').count(),2);
  await page.locator('#wellness-import-program').selectOption(program);
  await page.locator('#wellness-import-file').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('employee_id,measured_at,glucose,glucose_context,external_id\nSYN-001,2026-09-24T09:00:00+07:00,108,fasting,SYN-BROWSER-GLU\n')});
  await page.locator('#wellness-import-submit').click();await page.getByText('synthetic.csv',{exact:true}).waitFor();
  await page.screenshot({path:'docs/audit-evidence/wellness/ihc-import.png',fullPage:true});
  assert.deepEqual(errors,[]);
  const result={date:new Date().toISOString(),synthetic:true,productionAccess:false,checks:['HR list auto-load','tier filter','escaped identity','HR request','HIS accept/schedule/report/complete','HIS setup/import tabs','participant history/report','IHC upload','mobile no page overflow','zero browser exceptions']};
  fs.writeFileSync('docs/audit-evidence/wellness/browser-qa.json',JSON.stringify(result,null,2)+'\n');console.log('PASS browser E2E:',result.checks.join(', '));
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await db.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
