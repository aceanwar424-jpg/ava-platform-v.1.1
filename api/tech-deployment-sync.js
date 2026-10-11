// Existing AVA adapter; credentials remain server-side. No external calls in tests.
const ALLOWED_HOSTS=new Set(['tech.avahealth.sbs','www.tech.avahealth.sbs']);
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!ALLOWED_HOSTS.has(String(req.headers.host||'').toLowerCase()))return res.status(404).send('Not found');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).send('Method not allowed');}
  const {settings,verifyStaff,readCookie}=await import('../security/staff-access.mjs');const cfg=settings();
  const token=readCookie(new Request('https://'+req.headers.host,{headers:{cookie:req.headers.cookie||''}}))||String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!cfg||!token||!await verifyStaff(token,cfg))return res.status(401).json({ok:false,code:'STAFF_AUTH_REQUIRED'});
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}catch{return res.status(400).json({ok:false,code:'INVALID_JSON'});}
  const id=Number(body.deployment_id);if(!Number.isSafeInteger(id)||id<=0||typeof body.expected_updated_at!=='string')return res.status(400).json({ok:false,code:'INVALID_DEPLOYMENT_ID'});
  const dbHeaders={apikey:cfg.key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
  let row;
  try{const response=await fetch(cfg.url+'/rest/v1/tech_deployments?select=id,project_name,domain,repository_url,updated_at&id=eq.'+id+'&limit=1',{headers:dbHeaders,signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const rows=await response.json();row=Array.isArray(rows)?rows[0]:null;}catch{return res.status(503).json({ok:false,code:'DEPLOYMENT_READ_FAILED'});}
  if(!row)return res.status(403).json({ok:false,code:'DEPLOYMENT_ACCESS_DENIED'});
  if(new Date(row.updated_at).getTime()!==new Date(body.expected_updated_at).getTime())return res.status(409).json({ok:false,code:'DEPLOYMENT_CHANGED'});
  if(row.project_name!==body.project_name||row.domain!==body.domain)return res.status(409).json({ok:false,code:'DEPLOYMENT_INPUT_MISMATCH'});
  async function respond(http,payload,state){
    let persisted=false;
    try{const response=await fetch(cfg.url+'/rest/v1/rpc/tech_ops_deployment_sync_result',{method:'POST',headers:dbHeaders,body:JSON.stringify({p_id:id,p_status:state,p_error:payload.ok?null:payload.code,p_expected_updated_at:row.updated_at}),signal:AbortSignal.timeout(10000)});const ack=await response.json();persisted=response.ok&&ack?.ok===true&&Number(ack.deployment_id)===id&&ack.status===state;}catch{}
    return res.status(http).json({...payload,status:state,persisted,deployment_id:id});
  }
  const vendorToken=process.env.VERCEL_TOKEN;if(!vendorToken)return respond(503,{ok:false,code:'VERCEL_NOT_CONFIGURED'},'FAILED');
  const project=row.project_name,domain=row.domain,repo=row.repository_url||'',team=process.env.VERCEL_TEAM_ID||'';
  const headers={Authorization:'Bearer '+vendorToken,'Content-Type':'application/json'},qs=team?'?teamId='+encodeURIComponent(team):'';
  try{
    let response=await fetch('https://api.vercel.com/v9/projects/'+encodeURIComponent(project)+qs,{headers,signal:AbortSignal.timeout(10000)});
    if(response.status===404){const payload={name:project,...(repo?{gitRepository:{type:'github',repo:repo.replace(/^https?:\/\/github.com\//,'').replace(/\.git$/,'')}}:{})};response=await fetch('https://api.vercel.com/v9/projects'+qs,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});}
    if(!response.ok)return respond(502,{ok:false,code:'VERCEL_PROJECT_FAILED'},'FAILED');
    const result=await fetch('https://api.vercel.com/v10/projects/'+encodeURIComponent(project)+'/domains'+qs,{method:'POST',headers,body:JSON.stringify({name:domain}),signal:AbortSignal.timeout(10000)});
    const data=await result.json().catch(()=>({}));
    if(!result.ok){
      if(data.error?.code==='domain_already_in_use')return respond(409,{ok:false,code:'DOMAIN_OWNERSHIP_REVIEW_REQUIRED'},'DRIFT');
      return respond(502,{ok:false,code:'VERCEL_DOMAIN_FAILED'},'FAILED');
    }
    return respond(200,{ok:true,project,domain},'SYNCED');
  }catch{return respond(502,{ok:false,code:'VERCEL_UNREACHABLE'},'FAILED');}
};
