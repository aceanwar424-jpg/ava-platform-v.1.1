// OWNED_BY: ava. Vercel routing middleware: all hosts and all paths, before static files.
import domains from './config/domain.json';
import {PUBLIC_HOST, PRIVATE_HEADERS, settings, readCookie, verifyStaff, loginPage} from './security/staff-access.mjs';

const hosts = new Set(domains.situs.flatMap(s=>s.host));
const publicFiles = domains.situs.find(s=>s.kunci === 'web').berkas;
export const config = { matcher: '/:path*' };
export default async function middleware(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (_) { return new Response('Not found',{status:404}); }
  // Deny source/config/backup artifacts even to authenticated users.
  if (/(?:^|\/)\.|\\|%|\.(?:sql|map|env|pem|key|bak|sqlite|db|zip)$/i.test(pathname)
      || /^\/(?:connector|sql_arsip|supabase|node_modules|scripts)(?:\/|$)/i.test(pathname)
      || pathname === '/js/config.local.js') return new Response('Not found',{status:404,headers:PRIVATE_HEADERS});
  if (host === PUBLIC_HOST) {
    const allowed = pathname === '/' || publicFiles.some(file=>file.endsWith('/') ? pathname.startsWith('/'+file) : pathname === '/'+file);
    return allowed && ['GET','HEAD'].includes(request.method) ? undefined : new Response('Not found',{status:404,headers:PRIVATE_HEADERS});
  }
  if (domains.situs.find(s=>s.kunci === 'web').host.includes(host)) {
    return new Response(null,{status:308,headers:{Location:'https://'+PUBLIC_HOST+'/',...PRIVATE_HEADERS}});
  }
  // Includes unregistered custom hosts and direct *.vercel.app bypass URLs.
  if (!hosts.has(host)) return new Response('Not found',{status:404,headers:PRIVATE_HEADERS});
  if (pathname === '/api/staff-session') return;
  // Let the replacement worker purge old offline copies; no application content.
  if (pathname === '/apps/service-worker.js' && request.method === 'GET') return;
  const cfg = settings();
  if (!cfg) return new Response('Akses staf belum dikonfigurasi. Hubungi administrator.',{status:503,headers:PRIVATE_HEADERS});
  if (await verifyStaff(readCookie(request),cfg)) return;
  return new Response(loginPage(),{status:401,headers:{...PRIVATE_HEADERS,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
