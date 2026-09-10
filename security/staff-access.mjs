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
export function loginPage(site = {}) {
  const title = String(site.nama || 'AVA Health Platform')
    .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Masuk — ${title}</title><style>
    :root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:#eef3f8;color:#122033}
    *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 15% 10%,#dcecff 0,transparent 38%),#eef3f8}
    main{width:min(100%,430px);padding:34px;border:1px solid #d8e1ec;border-radius:20px;background:#fff;box-shadow:0 20px 60px #17324d1c}
    .brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}.mark{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:#0a2342;color:#d4af37;font-weight:800;letter-spacing:-1px}
    .eyebrow{margin:0 0 5px;color:#64748b;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h1{margin:0;font-size:25px;line-height:1.15}p{color:#64748b;line-height:1.55}
    label{display:grid;gap:7px;margin:16px 0;font-size:13px;font-weight:700}input{width:100%;padding:12px 13px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;background:#fff}input:focus{outline:3px solid #bfdbfe;border-color:#2563eb}
    button{width:100%;margin-top:8px;padding:12px;border:0;border-radius:10px;background:#0a2342;color:#fff;font:700 14px inherit;cursor:pointer}button:hover{background:#123c6b}
    .note{margin:20px 0 0;font-size:12px}
  </style></head><body><main><div class="brand"><div class="mark" aria-hidden="true">AVA</div><div><p class="eyebrow">AVA Health Platform</p><strong>${title}</strong></div></div><h1>Masuk ke sistem</h1><p>Akses hanya untuk staf yang telah disetujui administrator.</p><form method="post" action="/api/staff-session" autocomplete="off"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Kata sandi<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Masuk dengan aman</button></form><p class="note">Jika belum memiliki akses, hubungi administrator sistem.</p></main></body></html>`;
}
