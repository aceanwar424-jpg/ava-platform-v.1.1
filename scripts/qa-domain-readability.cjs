// OWNED_BY: generic. All browser requests are fulfilled locally; no production access.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('ava-platform'),out=path.resolve('docs/audit-evidence/2026-10-01');
const sites=JSON.parse(fs.readFileSync('config/domain.json')).situs;
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
async function inspect(page){return page.evaluate(()=>{
 const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const findings=[];
 for(const el of document.querySelectorAll('body *')){
 const st=getComputedStyle(el),r=el.getBoundingClientRect();
 if(el.closest('[aria-hidden="true"]')||!r.width||!r.height||st.visibility==='hidden'||st.display==='none'||st.opacity==='0'||!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
 const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(!text)continue;
 let bg=null,gradient=false;for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(s.backgroundImage!=='none'){gradient=true;break;}const c=rgb(s.backgroundColor);if(c.length>=3&&(c[3]??1)===1){bg=c;break;}}
 const fg=rgb(st.color);let contrast=null;if(!gradient&&fg.length>=3&&(fg[3]??1)===1){const a=lum(fg),b=lum(bg||[255,255,255]);contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
 const size=parseFloat(st.fontSize),threshold=size>=24||(size>=18.66&&Number(st.fontWeight)>=700)?3:4.5;
 if(size<11||(contrast!==null&&contrast<threshold))findings.push({tag:el.tagName,class:el.className,text:text.slice(0,90),size,color:st.color,bg:bg?.slice(0,3),contrast:contrast&&+contrast.toFixed(2)});
 }
 return {title:document.title,overflow:document.documentElement.scrollWidth>innerWidth,scrollWidth:document.documentElement.scrollWidth,findings};
});}
async function localRoute(route){const u=new URL(route.request().url());const site=sites.find(s=>s.host.includes(u.hostname));if(!site)return route.fulfill({status:200,contentType:'text/plain',body:''});
 if(u.pathname==='/api/runtime-config.js')return route.fulfill({contentType:'application/javascript',body:''});
 const rel=u.pathname==='/'?site.masuk:u.pathname;const file=path.resolve(root,'.'+decodeURIComponent(rel));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Local fixture: missing path'});
 return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
}
async function main(){fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true});const results=[];try{for(const width of [1440,390])for(const site of sites){const p=await b.newPage({viewport:{width,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',localRoute);await p.goto('https://'+site.host[0]+'/');await p.waitForTimeout(350);const a=await inspect(p);results.push({domain:site.kunci,width,...a,errors});await p.screenshot({path:path.join(out,site.kunci+'-'+width+'.png')});await p.close();}fs.writeFileSync(path.join(out,'domain-browser.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(r=>({domain:r.domain,width:r.width,overflow:r.overflow,findings:r.findings.length,errors:r.errors})),null,2));}finally{await b.close()}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});module.exports={inspect,localRoute};
