// OWNED_BY: ava. Server-only access policy, independent of browser roles.
export const COOKIE = '__Host-ava_staff';
export const PUBLIC_HOST = 'www.avahealth.sbs';
export const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
};
export function settings(env = process.env) {
  const url = env.AVA_SUPABASE_URL || env.SUPABASE_URL || '';
  const key = env.AVA_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
  const staff = new Set((env.AVA_STAFF_USER_IDS || '').split(',').map(x=>x.trim()).filter(Boolean));
  if (!/^https:\/\/[^/]+\/?$/.test(url) || !key || !staff.size) return null;
  return {url:url.replace(/\/$/,''), key, staff};
}
export function readCookie(request) {
  const values = (request.headers.get('cookie') || '').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
  if(values.length !== 1) return '';
  const token = values[0].slice(COOKIE.length+1);
  return /^[A-Za-z0-9_.-]+$/.test(token) && token.length < 8192 ? token : '';
}
export const cookie = token => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict${token ? '' : '; Max-Age=0'}`;
export async function verifyStaff(token, cfg, fetcher = fetch) {
  if (!cfg || !token) return null;
  try {
    const r = await fetcher(cfg.url+'/auth/v1/user', {headers:{apikey:cfg.key, Authorization:'Bearer '+token}, cache:'no-store', signal:AbortSignal.timeout(8000)});
    if (!r.ok) return null;
    const user = await r.json();
    // Explicit administrative UUID allowlist: user-editable metadata is never authority.
    return user?.id && cfg.staff.has(user.id) ? user : null;
  } catch (_) { return null; }
}
export function loginPage() {
  return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Masuk staf</title><body><main><h1>Masuk akun staf</h1><p>Akses khusus staf yang telah disetujui.</p><form method="post" action="/api/staff-session" autocomplete="off"><p><label>Email <input name="email" type="email" autocomplete="off" required></label></p><p><label>Kata sandi <input name="password" type="password" autocomplete="off" required></label></p><button type="submit">Masuk</button></form></main></body></html>`;
}
