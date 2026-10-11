// OWNED_BY: generic. All fetches intercepted in process; no external vendor calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),adapter=require('../../api/tech-deployment-sync.js');
(async()=>{const priorFetch=global.fetch,priorEnv={...process.env};const results=[];
try{
 Object.assign(process.env,{AVA_SUPABASE_URL:'https://synthetic.invalid',AVA_SUPABASE_ANON_KEY:'synthetic',AVA_STAFF_USER_IDS:'synthetic-user',VERCEL_TOKEN:'synthetic-vendor-token'});
 const row={id:1,project_name:'synthetic-project',domain:'synthetic.example',updated_at:'2026-10-11T00:00:00.000Z'};
 async function run(options={}){
   const calls=[],persist=[];const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
   global.fetch=async(url,init)=>{
     calls.push(String(url));
     if(String(url).endsWith('/auth/v1/user'))return response(200,{id:'synthetic-user'});
     if(String(url).includes('/rest/v1/tech_deployments?'))return response(200,options.denied?[]:[row]);
     if(String(url).endsWith('/rpc/tech_ops_deployment_sync_result')){const data=JSON.parse(init.body);persist.push(data);return response(options.persistFails?500:200,{ok:true,deployment_id:1,status:data.p_status});}
     if(String(url).startsWith('https://api.vercel.com/')){
       if(options.networkError)throw Error('Synthetic connection loss');
       if(String(url).includes('/domains'))return response(options.domainUsed?409:options.domainFailed?502:200,options.domainUsed?{error:{code:'domain_already_in_use'}}:{});
       return response(options.projectFailed?502:200,{name:'synthetic-project'});
     }
     throw Error('Unexpected network destination');
   };
   const req={method:'POST',headers:{host:'tech.avahealth.sbs',authorization:'Bearer synthetic.token.value'},body:options.body??{deployment_id:1,project_name:row.project_name,domain:row.domain,expected_updated_at:row.updated_at}};
   const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this},send(data){this.data=data;return this}};await adapter(req,res);return {res,calls,persist};
 }
 let test=await run();assert.equal(test.res.data.persisted,true);assert.equal(test.persist[0].p_status,'SYNCED');results.push('success persisted through existing authenticated context');
 test=await run({denied:true});assert.equal(test.res.code,403);assert(!test.calls.some(u=>u.includes('vercel.com')));results.push('denied record never reaches vendor');
 test=await run({body:{deployment_id:1,expected_updated_at:'2000-01-01'}});assert.equal(test.res.code,409);assert(!test.calls.some(u=>u.includes('vercel.com')));results.push('stale request never reaches vendor');
 test=await run({body:'{broken'});assert.equal(test.res.code,400);results.push('malformed body rejected');
 test=await run({domainUsed:true});assert.equal(test.res.data.ok,false);assert.equal(test.persist[0].p_status,'DRIFT');results.push('occupied domain requires ownership review, never false success');
 test=await run({networkError:true});assert.equal(test.persist[0].p_status,'FAILED');assert.equal(test.res.data.persisted,true);results.push('connection failure persisted');
 test=await run({persistFails:true});assert.equal(test.res.data.persisted,false);results.push('missing DB acknowledgement never reported persisted');
 delete process.env.VERCEL_TOKEN;test=await run();assert.equal(test.res.code,503);assert.equal(test.persist[0].p_status,'FAILED');results.push('unconfigured adapter recorded without vendor request');
 for(const result of results)console.log('PASS '+result);fs.mkdirSync('docs/audit-evidence/2026-10-11',{recursive:true});fs.writeFileSync('docs/audit-evidence/2026-10-11/tech-deployment-adapter.json',JSON.stringify({synthetic:true,vendorCalls:0,results},null,2));
}finally{global.fetch=priorFetch;for(const key of Object.keys(process.env))if(!(key in priorEnv))delete process.env[key];Object.assign(process.env,priorEnv);}
})().catch(error=>{console.error(error);process.exitCode=1;});
