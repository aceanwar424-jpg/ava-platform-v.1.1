// OWNED_BY: ava. Read-only HTTP metadata; never submits credentials or reads patient APIs.
const fs = require('node:fs');
const domains = JSON.parse(fs.readFileSync('config/domain.json')).situs.flatMap(s => s.host);
async function probe(host, pathname = '/') {
  try {
    const r = await fetch(`https://${host}${pathname}`, {redirect:'manual', signal:AbortSignal.timeout(12000)});
    const text = pathname === '/' ? await r.text() : '';
    if (pathname !== '/') await r.body?.cancel();
    return {host, path:pathname, status:r.status, location:r.headers.get('location')?.split('?')[0],
      hsts:!!r.headers.get('strict-transport-security'), csp:!!r.headers.get('content-security-policy'),
      cache:r.headers.get('cache-control'), demoPasswordMarkup:/value=["']12345678["']|Pass: 12345678/.test(text)};
  } catch(e) { return {host, path:pathname, error:e.cause?.code || e.name}; }
}
(async () => {
  const results = [];
  for (let i=0;i<domains.length;i+=6) results.push(...await Promise.all(domains.slice(i,i+6).map(h=>probe(h))));
  results.push(...await Promise.all(['/index.html','/js/auth.js','/js/config.local.js','/connector/config.json','/sql_arsip/','/.env'].map(p=>probe('www.avahealth.sbs',p))));
  fs.mkdirSync('docs/audit-evidence',{recursive:true});
  fs.writeFileSync('docs/audit-evidence/security-http-2026-09-10.json', JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
})();
