// AVA Tech deployment adapter. Vercel credentials remain server-side.
const ALLOWED_HOSTS = new Set(['tech.avahealth.sbs','www.tech.avahealth.sbs']);
function clean(v, max=240){ return typeof v === 'string' ? v.trim().slice(0,max) : ''; }
module.exports = async (req,res) => {
  if (!ALLOWED_HOSTS.has(String(req.headers.host||'').toLowerCase())) return res.status(404).send('Not found');
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).send('Method not allowed'); }  const {settings, verifyStaff, readCookie} = await import('../security/staff-access.mjs');
  const cfg = settings();
  const cookieToken = readCookie(new Request('https://' + req.headers.host, { headers: { cookie: req.headers.cookie || '' } }));
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!cfg || !(cookieToken || bearer) || !await verifyStaff(cookieToken || bearer, cfg)) return res.status(401).json({ok:false,code:'STAFF_AUTH_REQUIRED'});
  const token = process.env.VERCEL_TOKEN;
  if (!token) return res.status(503).json({ok:false, code:'VERCEL_NOT_CONFIGURED', message:'Vercel adapter belum dikonfigurasi di secret manager.'});
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const project = clean(body.project_name,100).toLowerCase();
  const domain = clean(body.domain,253).toLowerCase();
  const repo = clean(body.repository_url,500);
  const team = clean(process.env.VERCEL_TEAM_ID,100);
  if (!/^[a-z0-9][a-z0-9-_]{1,98}$/.test(project) || !/^[a-z0-9.-]+$/.test(domain)) return res.status(400).json({ok:false,code:'INVALID_DEPLOYMENT_INPUT'});
  const headers = {Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const qs = team ? `?teamId=${encodeURIComponent(team)}` : '';
  try {
    let pr = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}${qs}`,{headers,signal:AbortSignal.timeout(10000)});
    if (pr.status === 404) {
      const payload = {name:project, ...(repo ? {gitRepository:{type:'github',repo:repo.replace(/^https?:\/\/github.com\//,'').replace(/\.git$/,'')}} : {})};
      pr = await fetch(`https://api.vercel.com/v9/projects${qs}`,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
    }
    const projectData = await pr.json().catch(()=>({}));
    if (!pr.ok) return res.status(pr.status === 401 || pr.status === 403 ? 502 : 400).json({ok:false,code:'VERCEL_PROJECT_FAILED',detail:projectData.error?.message || 'Project Vercel gagal dibuat/dibaca.'});
    const dr = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains${qs}`,{method:'POST',headers,body:JSON.stringify({name:domain}),signal:AbortSignal.timeout(10000)});
    const domainData = await dr.json().catch(()=>({}));
    if (!dr.ok && domainData.error?.code !== 'domain_already_in_use') return res.status(502).json({ok:false,code:'VERCEL_DOMAIN_FAILED',detail:domainData.error?.message || 'Domain gagal ditambahkan.'});
    return res.status(200).json({ok:true,project:projectData.name || project,domain,status:dr.ok?'SYNCED':'SYNCED_EXISTING'});
  } catch (_) { return res.status(502).json({ok:false,code:'VERCEL_UNREACHABLE',message:'Vercel tidak dapat dihubungi.'}); }
};


