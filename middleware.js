// OWNED_BY: ava. Vercel routing middleware: all hosts and all paths, before static files.
import domains from './config/domain.json';
import {PUBLIC_HOST, PRIVATE_HEADERS, settings, readCookie, verifyStaff, loginPage} from './security/staff-access.mjs';

const hosts = new Set(domains.situs.flatMap(s=>s.host));
const publicFiles = domains.situs.find(s=>s.kunci === 'web').berkas;
const publicAsset = /^\/(?:css|js|modules|public|apps|kiosk|monitor|vendor|fonts|images)(?:\/|$)/i;
const publicAssetFile = /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|webmanifest)$/i;
const deniedAsset = /\.(?:map|env|pem|key|sql|db|sqlite|bak|zip)$/i;
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
  const site = domains.situs.find(s=>s.host.includes(host));
  if (site?.kunci === 'app' && ['GET','HEAD'].includes(request.method)) {
    // The patient portal must load its login UI before Supabase can authenticate
    // the user. Only its static shell and explicitly referenced shared assets
    // are public; application data remains protected by Supabase/RLS.
    const appAssets = new Set([
      '/css/token.css',
      '/css/logo-ava-global.png',
      '/js/core/api.js',
      '/js/core/whatsappGateway.js',
      '/js/core/paymentGateway.js',
      '/js/core/escposPrinter.js',
      '/js/core/shippingEngine.js',
      '/js/core/bpjsBridge.js',
      '/js/core/pacsEngine.js',
      '/js/core/pdfSigner.js',
      '/js/core/peta-subdomain.js',
    ]);
    if (pathname === '/' || pathname === '/api/runtime-config.js' || pathname.startsWith('/apps/') || appAssets.has(pathname)) return;
  }
  // Runtime configuration contains only the public Supabase URL and anon key.
  // It must load before authentication so the login screen can contact Auth.
  if (pathname === '/api/runtime-config.js' && ['GET','HEAD'].includes(request.method)) return;
  // Private shells still need their public frontend assets before staff login.
  // This never exposes source maps, credentials, database files, or server code.
  if (['GET','HEAD'].includes(request.method)
      && publicAsset.test(pathname)
      && publicAssetFile.test(pathname)
      && !deniedAsset.test(pathname)) return;
  if (site?.kunci === 'web') {
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
  return new Response(loginPage(site),{status:401,headers:{...PRIVATE_HEADERS,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
