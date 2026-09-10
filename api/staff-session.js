// OWNED_BY: ava. No credentials logged or persisted; token cookie is host-only and HttpOnly.
module.exports = async (req,res) => {
  const {settings, verifyStaff, readCookie, cookie, PRIVATE_HEADERS} = await import('../security/staff-access.mjs');
  for (const [key,value] of Object.entries(PRIVATE_HEADERS)) res.setHeader(key,value);
  const domainMap = require('../config/domain.json');
  const host = String(req.headers.host || '').toLowerCase();
  const privateHosts = domainMap.situs.filter(s=>s.kunci !== 'web').flatMap(s=>s.host);
  if (!privateHosts.includes(host)) return res.status(404).send('Not found');
  if (!['POST','DELETE'].includes(req.method)) { res.setHeader('Allow','POST, DELETE'); return res.status(405).send('Method not allowed'); }
  if (req.headers.origin !== 'https://'+host) return res.status(403).send('Origin tidak sesuai.');
  const cfg = settings();
  if (!cfg) return res.status(503).send('Akses staf belum dikonfigurasi.');
  if (req.method === 'DELETE') {
    const token = readCookie(new Request('https://'+host,{headers:{cookie:req.headers.cookie || ''}}));
    res.setHeader('Set-Cookie',cookie(''));
    if (token) try { await fetch(cfg.url+'/auth/v1/logout',{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)}); } catch (_) {}
    return res.status(204).end();
  }
  res.setHeader('Set-Cookie',cookie(''));
  const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.email.length > 254 || body.password.length > 1024) return res.status(400).send('Isian login tidak sesuai.');
  try {
    const r = await fetch(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({email:body.email,password:body.password}),signal:AbortSignal.timeout(8000)});
    const data = await r.json();
    if (!r.ok || !await verifyStaff(data.access_token,cfg)) return res.status(401).send('Login tidak berhasil atau akun belum disetujui sebagai staf.');
    res.setHeader('Set-Cookie',cookie(data.access_token));
    // Bootstrap only this tab. No refresh token: expiration requires staff to sign in again.
    const nonce = require('node:crypto').randomBytes(18).toString('base64');
    res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`);
    res.setHeader('Content-Type','text/html; charset=utf-8');
    const token = JSON.stringify(data.access_token).replace(/</g,'\\u003c');
    return res.status(200).send(`<!doctype html><html lang="id"><title>Masuk</title><script nonce="${nonce}">localStorage.removeItem('ol_token');localStorage.removeItem('ol_refresh');sessionStorage.setItem('ol_token',${token});sessionStorage.removeItem('ol_refresh');location.replace('/');</script><p>Membuka aplikasi staf…</p></html>`);
  } catch (_) { return res.status(503).send('Layanan login belum dapat dihubungi.'); }
};
