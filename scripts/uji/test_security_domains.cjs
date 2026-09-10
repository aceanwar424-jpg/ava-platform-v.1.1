// OWNED_BY: ava. Synthetic security tests, no production services.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const map = require('../../config/domain.json');
const policy = import('../../security/staff-access.mjs');
const synthetic = {AVA_SUPABASE_URL:'https://auth.example.invalid',AVA_SUPABASE_ANON_KEY:'synthetic-public',AVA_STAFF_USER_IDS:'staff-id'};
async function gateway(env = synthetic, fetcher = async()=>new Response(JSON.stringify({id:'staff-id'}))) {
  const p = await policy;
  const src = fs.readFileSync('middleware.js','utf8').replace(/^import .*\r?\n/gm,'').replace('export const config','const config').replace('export default async function middleware','async function middleware');
  const c={domains:map,...p,process:{env},settings:()=>p.settings(env), verifyStaff:(t,cfg)=>p.verifyStaff(t,cfg,fetcher),URL,Response};
  vm.createContext(c); vm.runInContext(src,c); return c.middleware;
}
test('every configured private domain denies anonymous requests and direct file paths',async()=>{
  const gate=await gateway();
  for(const site of map.situs.filter(s=>s.kunci!=='web' && s.kunci!=='app')) for(const host of site.host) for(const path of ['/','/index.html','/apps/index.html','/monitor/antrian.html','/api/runtime-config.js']) {
    const r=await gate(new Request('https://'+host+path)); assert.equal(r.status,401,host+path);
    assert.match(r.headers.get('cache-control'),/no-store/);
  }
});
test('private login shells can load frontend assets without exposing protected files',async()=>{
  const gate=await gateway();
  for(const host of map.situs.find(s=>s.kunci==='his').host) {
    for(const path of ['/css/style.css','/css/dashboard.css','/js/auth.js','/js/core/router.js','/images/logo.svg','/fonts/inter.woff2']) {
      assert.equal(await gate(new Request('https://'+host+path)),undefined, host+path);
    }
    for(const path of ['/js/config.local.js','/js/core/router.js.map','/sql_arsip/catalog.sql','/connector/config.json']) {
      assert.equal((await gate(new Request('https://'+host+path))).status,404,path);
    }
  }
});
test('patient portal serves only its public shell and shared static assets anonymously',async()=>{
  const gate=await gateway();
  for(const host of map.situs.find(s=>s.kunci==='app').host) {
    for(const path of ['/', '/apps/index.html', '/apps/style.css', '/apps/login.css', '/apps/app.js', '/css/token.css', '/css/logo-ava-global.png', '/js/core/api.js']) {
      assert.equal(await gate(new Request('https://'+host+path)), undefined, host+path);
    }
    assert.equal((await gate(new Request('https://'+host+'/api/runtime-config.js'))).status, 401);
    assert.equal((await gate(new Request('https://'+host+'/private.txt'))).status, 401);
  }
});
test('only www serves public assets; private files, secrets and unregistered hosts are denied',async()=>{
  const gate=await gateway();
  for(const path of ['/','/portal.html','/public/tentang.html','/css/public-profile.css']) assert.equal(await gate(new Request('https://www.avahealth.sbs'+path)),undefined);
  for(const path of ['/index.html','/js/auth.js','/js/config.local.js','/.env','/connector/config.json','/api/staff-session','/public/test.sql']) assert.equal((await gate(new Request('https://www.avahealth.sbs'+path))).status,404,path);
  assert.equal((await gate(new Request('https://preview.vercel.app/'))).status,404);
  assert.equal((await gate(new Request('https://avahealth.sbs/'))).status,308);
});
test('staff requires real Auth verification AND administrator UUID approval',async()=>{
  const p=await policy; const cfg=p.settings(synthetic);
  assert.equal(await p.verifyStaff('fake',cfg,async()=>new Response('{}',{status:401})),null);
  assert.equal(await p.verifyStaff('fake',cfg,async()=>new Response(JSON.stringify({id:'patient-id',user_metadata:{role:'super_admin'}}))),null);
  assert.equal(await p.verifyStaff('fake',cfg,async()=>{throw Error('offline')}),null);
  const gate=await gateway(); assert.equal(await gate(new Request('https://his.avahealth.sbs/',{headers:{cookie:p.COOKIE+'=synthetic.token.value'}})),undefined);
});
test('missing staff configuration locks private hosts, leaving public site accessible',async()=>{
  const gate=await gateway({}); assert.equal((await gate(new Request('https://his.avahealth.sbs/'))).status,503);
  assert.equal(await gate(new Request('https://www.avahealth.sbs/')),undefined);
});
test('cookie is HttpOnly, Secure, host-only and nonpersistent; duplicate cookie fails closed',async()=>{
  const p=await policy; const c=p.cookie('synthetic.token.value');
  assert.match(c,/HttpOnly; Secure; SameSite=Strict/); assert.doesNotMatch(c,/Domain=|Max-Age=|Expires=/i);
  assert.equal(p.readCookie(new Request('https://his.avahealth.sbs',{headers:{cookie:`${p.COOKIE}=one; ${p.COOKIE}=two`}})),'');
});
test('staff login screen has no default username, password, demo or self-registration',async()=>{
  const p=await policy; assert.doesNotMatch(p.loginPage(),/value=|12345678|signup|register/i);
  const src=fs.readFileSync('ava-platform/js/auth.js','utf8'); assert.doesNotMatch(src,/12345678|AVA_DEMO_USERS|master_ava_token|auth\/v1\/signup/);
  assert.doesNotMatch(fs.readFileSync('ava-platform/index.html','utf8'),/setItem\('ol_token', qToken\)|master_ava_token/);
});
test('password rejection and network failure cannot create a local demo session',async()=>{
  const src=fs.readFileSync('ava-platform/js/auth.js','utf8');
  for(const offline of [false,true]) {
    const values=new Map(); const nodes={'login-email':{value:'admin@avahealth.sbs'},'login-pass':{value:'12345678'},'btn-login':{},'login-err':{style:{}}};
    const c={window:{},location:{hostname:'localhost',reload:()=>{throw Error('unexpected login')}},document:{getElementById:id=>nodes[id]},sessionStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},SUPABASE_URL:'https://example.invalid',SUPABASE_RUNTIME_KEY:'synthetic',fetch:async()=>{if(offline)throw Error('offline');return{ok:false,json:async()=>({})}}};
    vm.createContext(c);vm.runInContext(src,c);await c.doLogin(); assert.equal(values.size,0);assert.equal(nodes['login-pass'].value,'');
  }
});
test('inline scripts parse; session tokens are not written into localStorage',()=>{
  for(const file of ['ava-platform/index.html','ava-platform/apps/index.html']) {
    const src=fs.readFileSync(file,'utf8');for(const m of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1],{filename:file});
  }
  for(const file of ['ava-platform/js/auth.js','ava-platform/js/core/api.js','ava-platform/index.html','ava-platform/apps/app.js']) assert.doesNotMatch(fs.readFileSync(file,'utf8'),/localStorage\.setItem\('ol_(?:token|refresh)'/);
});
test('staff session endpoint rejects CSRF, wrong passwords and nonstaff; sets protected cookie only for approved staff',async()=>{
  const handler=require('../../api/staff-session.js'); const oldFetch=global.fetch;
  const oldEnv=Object.fromEntries(Object.keys(synthetic).map(k=>[k,process.env[k]])); Object.assign(process.env,synthetic);
  function response(){return {headers:{},status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v},send(v){this.body=v;return this},end(){return this}};}
  try {
    for (const scenario of ['csrf','wrong','nonstaff','approved']) {
      let calls=0;
      global.fetch=async url=>{calls++;return String(url).includes('/token?') ? new Response(JSON.stringify({access_token:'synthetic.jwt.value'}),{status:scenario==='wrong'?400:200}) : new Response(JSON.stringify({id:scenario==='nonstaff'?'patient-id':'staff-id'}));};
      const res=response(); await handler({method:'POST',headers:{host:'his.avahealth.sbs',origin:scenario==='csrf'?'https://evil.invalid':'https://his.avahealth.sbs'},body:{email:'synthetic@example.invalid',password:'synthetic-only'}},res);
      assert.equal(res.code,scenario==='csrf'?403:scenario==='approved'?200:401,scenario);
      if(scenario==='csrf') assert.equal(calls,0);
      if(scenario==='approved'){assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure/);assert.match(res.headers['Content-Security-Policy'],/nonce-/);assert.doesNotMatch(res.body,/synthetic-only|refresh_token/);}
    }
  } finally {global.fetch=oldFetch;for(const[k,v]of Object.entries(oldEnv))v===undefined?delete process.env[k]:process.env[k]=v;}
});
test('runtime configuration refuses service-role secrets',()=>{
  const handler=require('../../api/runtime-config.js'); const old=process.env.AVA_SUPABASE_ANON_KEY;
  try {
    process.env.AVA_SUPABASE_ANON_KEY='sb_secret_synthetic';
    const res={setHeader(){},status(n){this.code=n;return this},send(v){this.body=v;}};
    handler({},res); assert.equal(res.code,503);assert.doesNotMatch(res.body,/sb_secret/);
  } finally {old===undefined?delete process.env.AVA_SUPABASE_ANON_KEY:process.env.AVA_SUPABASE_ANON_KEY=old;}
});
