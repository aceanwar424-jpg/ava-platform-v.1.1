const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
const fs=require('node:fs');
const routes=[...fs.readFileSync('ava-platform/js/public-profile.js','utf8').matchAll(/'([^']+\.html)': \{ hero:/g)].map(m=>m[1]);
const browser=await chromium.launch({headless:true,channel:'msedge'});const results=[];
for(const width of [1440,390]){
const page=await browser.newPage({viewport:{width,height:1000}});
for(const route of routes){
await page.goto('http://localhost:8765/'+route);await page.waitForLoadState('networkidle');
await page.locator('.ava-visual img,.v2-hero-visual img').evaluateAll(async images=>{await Promise.all(images.map(i=>{i.loading='eager';return i.decode()}))});
const audit=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.querySelectorAll('.ava-visual img,.v2-hero-visual img')].map(i=>({ok:i.complete&&i.naturalWidth>0,ratio:i.getBoundingClientRect().width/i.getBoundingClientRect().height,natural:i.naturalWidth/i.naturalHeight}))}));
if(audit.overflow||audit.images.some(i=>!i.ok||Math.abs(i.ratio-i.natural)>.02))throw Error(JSON.stringify({width,route,audit}));
await page.locator('.visual-expand').first().click();if(!await page.locator('dialog').evaluate(d=>d.open))throw Error('viewer closed');await page.keyboard.press('Escape');
results.push({width,route,...audit});
await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)});
if(route==='portal.html')await page.screenshot({path:'docs/audit-evidence/public-visual-'+width+'.png',fullPage:true});
}
await page.close();}
fs.writeFileSync('docs/audit-evidence/public-visual-qa.json',JSON.stringify(results,null,2)+'\n');console.log('PASS:',results.length,'page/viewport checks, images preserve ratio, no overflow, dialog opens and closes with Escape.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});


