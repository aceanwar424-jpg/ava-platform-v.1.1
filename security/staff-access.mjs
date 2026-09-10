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
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="theme-color" content="#071a2f"><title>Masuk — ${title}</title><style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:#071a2f;color:#f8fafc}
    *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:28px 18px;overflow-x:hidden;background:radial-gradient(circle at 12% 12%,#164269 0,transparent 36%),radial-gradient(circle at 90% 85%,#152d4a 0,transparent 34%),#071a2f}
    body:before,body:after{content:"";position:fixed;z-index:-1;border:1px solid #d4af3730;border-radius:50%;pointer-events:none}body:before{width:420px;height:420px;top:-240px;right:-110px}body:after{width:300px;height:300px;bottom:-190px;left:-130px}
    main{width:min(100%,470px);padding:clamp(28px,6vw,46px);border:1px solid #ffffff1c;border-radius:26px;background:linear-gradient(145deg,#102943f2,#091b30f2);box-shadow:0 30px 90px #00000055,0 0 0 1px #d4af3710;backdrop-filter:blur(18px)}
    .brand{display:flex;align-items:center;gap:14px;margin-bottom:38px}.brand img{width:54px;height:54px;border:2px solid #d4af37;border-radius:16px;object-fit:cover;box-shadow:0 0 22px #d4af3740}.eyebrow{margin:0 0 6px;color:#d4af37;font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.brand strong{display:block;color:#fff;font-size:15px;line-height:1.3}
    .rule{width:48px;height:3px;margin:0 0 18px;border-radius:4px;background:#d4af37}h1{margin:0;font-family:Georgia,serif;font-size:clamp(30px,6vw,40px);font-weight:500;letter-spacing:-.03em;line-height:1.05}p{color:#a8bbcd;line-height:1.6}
    .intro{max-width:360px;margin:14px 0 28px;font-size:14px}label{display:grid;gap:8px;margin:17px 0;color:#d9e5ef;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}input{width:100%;padding:14px 15px;border:1px solid #ffffff26;border-radius:11px;color:#fff;font:inherit;background:#061426;transition:border-color .2s,box-shadow .2s}input::placeholder{color:#71869b}input:focus{outline:none;border-color:#d4af37;box-shadow:0 0 0 4px #d4af371c}
    button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:11px;background:linear-gradient(110deg,#c99d2e,#e5c15b);color:#071a2f;font:800 14px inherit;letter-spacing:.02em;cursor:pointer;box-shadow:0 10px 24px #d4af3730;transition:transform .2s,filter .2s}button:hover{filter:brightness(1.08);transform:translateY(-1px)}button:focus-visible{outline:3px solid #fff;outline-offset:3px}.note{margin:25px 0 0;padding-top:17px;border-top:1px solid #ffffff16;font-size:11px}
    @media(max-width:420px){main{padding:27px 22px;border-radius:20px}.brand{margin-bottom:30px}}
  </style></head><body><main><div class="brand"><img src="/css/logo-ava-global.png" alt="AVA Health Solution"><div><p class="eyebrow">AVA Global Ecosystem</p><strong>${title}</strong></div></div><div class="rule"></div><h1>Selamat datang kembali.</h1><p class="intro">Masuk ke ruang kerja aman untuk melanjutkan pekerjaan dan pelayanan Anda.</p><form method="post" action="/api/staff-session" autocomplete="off"><label>Email akun<input name="email" type="email" autocomplete="username" placeholder="nama@perusahaan.com" required></label><label>Kata sandi<input name="password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required></label><button type="submit">Masuk ke sistem <span aria-hidden="true">↗</span></button></form><p class="note">Akses staf terverifikasi. Jika belum memiliki akses, hubungi administrator sistem.</p></main></body></html>`;
}
