// OWNED_BY: generic. Synthetic fixtures only; no network/backend access.
const { chromium } = require('./lib/playwright.cjs');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'artifacts','corporate-dashboard');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:"msedge"});
 const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.abort());
 await page.setContent('<html lang="id"><head><style>body{margin:0;padding:28px 24px;background:#f0f4f8;font-family:Arial,sans-serif;box-sizing:border-box}@media(max-width:680px){body{padding:0 !important}}</style></head><body><section class="corp-dashboard" id="corporate-dashboard"></section></body></html>');
 await page.addStyleTag({path:path.join(root,'ava-platform/apps/corporate-dashboard.css')});
 await page.evaluate(()=>{
  window.mode='data';window.destination=null;
  window.showView=id=>window.destination=id;
  window.sbGetStrict=async(table,query)=>{
   if(window.mode==='error')throw Error('Synthetic offline');
   if(window.mode==='empty'||!query.includes('offset=0'))return [];
   if(table==='corporate_employees')return Array.from({length:80},(_,i)=>({id:i+1,department:['Operasional','Keuangan','Teknologi','SDM'][i%4]}));
   return Array.from({length:120},(_,i)=>({id:i+1,corporate_employee_id:i%80+1,requested_at:`2026-${String(i%9+1).padStart(2,'0')}-15T08:00:00Z`,branch:i%2?'Jakarta':'Bandung',type_of_test:i%2?'MCU':'Skrining',exam_status:['Approved','Requested','Rejected'][i%3]}));
  };
  window.sbRpc=async()=>{if(window.mode==='error')throw Error('Synthetic offline');return {programs:window.mode==='empty'?[]:[{id:'p1',name:'Program Sintetis',enrolled:80,screened_count:60,risk_l1_count:30,risk_l2_count:20,risk_l3_count:8,risk_l4_count:2},{id:'p2',name:'Privasi terbatas',enrolled:4,risk_l1_count:null,risk_l2_count:null,risk_l3_count:null,risk_l4_count:null}]};};
 });
 await page.addScriptTag({path:path.join(root,'ava-platform/apps/corporate-dashboard.js')});
 const render=()=>page.evaluate(()=>CorporateDashboard.render({corporateId:10,corporateName:'Perusahaan Uji Sintetis'}));
 await render();
 assert.deepEqual(await page.locator('.cd-kpi strong').allTextContents(),['80','40','75%','10']);
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
 await page.locator('[data-filter="branch"]').selectOption('Jakarta');
 assert.equal(await page.locator('.cd-kpi strong').nth(1).textContent(),'20');
 const dl=page.waitForEvent('download');await page.getByText('Unduh ringkasan ↓').click();const download=await dl;await download.saveAs(path.join(out,'synthetic-summary.csv'));
 const csv=fs.readFileSync(path.join(out,'synthetic-summary.csv'),'utf8');assert(csv.includes('Jakarta'));assert(csv.includes('"Disetujui","20"'));
 await page.locator('#cd-program').selectOption('p2');assert.equal(await page.locator('.cd-kpi strong').nth(3).textContent(),'—');
 await page.locator('[data-filter="from"]').fill('2026-10-01');await page.locator('[data-filter="to"]').fill('2026-01-01');assert(await page.locator('.cd-warning').isVisible());assert(await page.locator('[data-action="export"]').isDisabled());
 await render();await page.locator('[data-view="corporate-wellness-view"]').click();assert.equal(await page.evaluate(()=>destination),'corporate-wellness-view');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 await page.evaluate(()=>window.mode='empty');await render();assert.deepEqual(await page.locator('.cd-kpi strong').allTextContents(),['0','0','—','—']);
 await page.evaluate(()=>window.mode='error');await render();assert.deepEqual(await page.locator('.cd-kpi strong').allTextContents(),['—','—','—','—']);assert(await page.locator('[data-action="export"]').isDisabled());
 await page.evaluate(()=>window.mode='data');await page.getByText('Muat ulang',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cd-kpi strong')?.textContent==='80');
 await page.evaluate(()=>CorporateDashboard.render({corporateId:null}));assert((await page.locator('#corporate-dashboard').textContent()).includes('belum ditautkan'));
 const html=fs.readFileSync(path.join(root,'ava-platform/apps/index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
 await page.setContent(html);
 for(const file of ['css/token.css','apps/style.css','apps/login.css','js/../css/wellness-flow.css','apps/corporate-dashboard.css'])await page.addStyleTag({path:path.join(root,'ava-platform',file)});
 await page.evaluate(()=>{document.getElementById('login-screen').remove();document.getElementById('dashboard-screen').classList.add('active');document.querySelectorAll('.view-panel').forEach(e=>e.classList.remove('active'));document.getElementById('corporate-view').classList.add('active');});
 await render();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.waitForTimeout(400);
  if(width===390)assert(await page.locator("#app-sidebar").evaluate(e=>e.getBoundingClientRect().right<=1));
  assert(await page.locator('#corporate-dashboard').isVisible());
  assert(await page.locator(".cd-filters").evaluate(e=>[...e.querySelectorAll("input,select")].every(c=>c.getBoundingClientRect().right<=e.getBoundingClientRect().right+1)));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(out,'apps-shell-'+width+'.png'),fullPage:true});
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: data, filter, CSV, privacy, invalid dates, navigation, mobile overflow, empty, error, retry, missing corporate; zero browser errors.');
})().catch(e=>{console.error(e);process.exit(1)});

