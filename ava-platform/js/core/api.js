// ═══════════════════════════════════════════
// CORE: Supabase API helpers
// ═══════════════════════════════════════════
// SUPABASE_URL dipilih saat runtime:
//  • Desktop Engine (AVA Desktop.exe) menyajikan platform di 127.0.0.1:5174 →
//    pakai shim PostgREST lokal (PGlite) di :54329, sepenuhnya offline.
//  • Selain itu (mis. Vercel produksi) → Supabase cloud seperti biasa.
// Deteksi berbasis hostname; TIDAK mengubah perilaku deployment cloud.
const _avaRuntimeConfig = (typeof window !== 'undefined' && window.AVA_RUNTIME_CONFIG) || {};
// Fallback mempertahankan deployment lama; Vercel dapat menimpa URL ini per tenant.
const SUPABASE_CLOUD_URL = _avaRuntimeConfig.supabaseUrl || '';
const _isLocalEngine = (typeof location !== 'undefined') &&
  (location.hostname === '127.0.0.1' || location.hostname === 'localhost' ||
   location.hostname.endsWith('.localhost'));
const LOCAL_ENGINE_URL = _isLocalEngine ? 'http://127.0.0.1:54329' : '';
const SUPABASE_URL = _isLocalEngine ? LOCAL_ENGINE_URL : SUPABASE_CLOUD_URL;
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXF6eWZ2bG1qeHRhdHBjdGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDQzNzIsImV4cCI6MjA5NjgyMDM3Mn0.tBVQBNH-yi9bmcpY7MRf5w-diwonMTDqwfAOs3t7YK8';
const SUPABASE_RUNTIME_KEY = _avaRuntimeConfig.supabaseAnonKey || SUPABASE_KEY;

// Invalidate legacy persistent sessions on every origin; never migrate them.
for (const key of ['ol_token', 'ol_refresh', 'ol_master_user', 'AVA_CURRENT_USER_ROLE']) {
  try { localStorage.removeItem(key); } catch (_) {}
}

// ── Sesi (Fase 1.0) ───────────────────────────────────────────
// Token pengguna dibaca langsung dari sessionStorage supaya berkas ini tidak
// bergantung pada auth.js yang dimuat belakangan.
function sbIsJwt(token) {
  // Token demo lama seperti "master_ava_token_*" bukan JWT dan ditolak
  // Supabase sebelum query diproses. Jangan pernah meneruskannya ke cloud.
  // Engine lokal memakai token HMAC dua bagian; token itu hanya valid pada
  // origin lokal dan tetap diverifikasi ulang oleh server PGlite.
  return typeof token === 'string' && (
    token.split('.').length === 3 ||
    (_isLocalEngine && token.split('.').length === 2)
  );
}
function sbAccessToken()  {
  try {
    const token = sessionStorage.getItem('ol_token') || '';
    return sbIsJwt(token) ? token : '';
  } catch(e) { return ''; }
}
function sbRefreshToken() { try { return sessionStorage.getItem('ol_refresh') || ''; } catch(e) { return ''; } }

// PENTING: 'Authorization' sengaja berupa getter, bukan nilai tetap.
// Object spread ({...SB_HEADERS}) memanggil getter dan menyalin hasilnya,
// sehingga ~18 pemanggil yang sudah ada ikut mengirim JWT pengguna tanpa diubah.
// Selama belum login, jatuh kembali ke anon key agar layar login tetap berfungsi.
const SB_HEADERS = {
  'apikey': SUPABASE_RUNTIME_KEY,
  get 'Authorization'() { return `Bearer ${sbAccessToken() || SUPABASE_RUNTIME_KEY}`; },
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// Perbarui sesi memakai refresh token. Dipanggil saat permintaan ditolak 401.
// Beberapa permintaan yang gagal bersamaan berbagi satu proses perbaruan.
let _sbRefreshing = null;
async function sbRefreshSession() {
  const rt = sbRefreshToken();
  if (!rt) return false;
  if (_sbRefreshing) return _sbRefreshing;

  _sbRefreshing = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_RUNTIME_KEY },
        body: JSON.stringify({ refresh_token: rt }),
      });
      const data = await res.json();
      if (data && data.access_token) {
        sessionStorage.setItem('ol_token', data.access_token);
        if (data.refresh_token) sessionStorage.setItem('ol_refresh', data.refresh_token);
        return true;
      }
    } catch (e) { /* jaringan bermasalah — tangani sebagai gagal */ }
    return false;
  })();

  const ok = await _sbRefreshing;
  _sbRefreshing = null;
  return ok;
}

// Pembungkus fetch: sekali coba ulang setelah memperbarui sesi bila token kedaluwarsa.
async function sbFetch(url, opts = {}) {
  const build = () => ({ ...opts, headers: { ...SB_HEADERS, ...(opts.headers || {}) } });
  let res = await fetch(url, build());
  if (res.status === 401 && sbRefreshToken()) {
    const ok = await sbRefreshSession();
    if (ok) res = await fetch(url, build());   // header dibangun ulang → token baru
  }
  return res;
}

async function sbGet(table, query='') {
  try {
    if (!SUPABASE_URL || !SUPABASE_RUNTIME_KEY) {
      throw new Error('Konfigurasi data runtime tidak tersedia');
    }
    const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.hint || JSON.stringify(data));
    return data;
  } catch (err) {
    // Only the explicitly local Electron origin may use the local typed bridge.
    // Cloud failures remain visible and never become success-shaped empty data.
    if (_isLocalEngine && table === 'products') {
      if (window.parent?.api?.getProducts) return await window.parent.api.getProducts();
      if (window.api?.getProducts) return await window.api.getProducts();
    }
    console.error(`[Data access failed] table '${table}':`, err);
    throw err;
  }
}

// Versi ketat untuk gerbang autentikasi/RBAC. `sbGet` sengaja mempertahankan
// fallback kosong untuk banyak daftar operasional lama, tetapi gerbang akses
// tidak boleh menyamakan penolakan RLS, gangguan jaringan, dan profil kosong.
// Pemanggil wajib menampilkan alasan yang aman tanpa memberi hak akses bawaan.
async function sbGetStrict(table, query='') {
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`);
  let data = null;
  try { data = await res.json(); } catch (_) { /* pesan aman di bawah */ }
  if (!res.ok) {
    // Pesan PostgREST/RLS dapat mengungkap struktur internal; cukup tampilkan
    // status yang dapat ditindaklanjuti kepada pengguna.
    throw new Error('Profil akses tidak dapat diverifikasi saat ini. Coba lagi atau hubungi administrator.');
  }
  return data;
}
async function sbPost(table, body) {
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}`, { method:'POST', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.hint || JSON.stringify(data));
  return data;
}
async function sbPatch(table, id, body) {
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method:'PATCH', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}
async function sbDelete(table, id) {
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method:'DELETE', headers: { 'Prefer':'return=minimal' } });
  return res.ok;
}
async function sbCount(table, query='') {
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?${query}&select=count`, { headers: { 'Prefer':'count=exact' } });
  const count = res.headers.get('content-range')?.split('/')[1];
  return parseInt(count)||0;
}

// Panggil fungsi Postgres (RPC) — dipakai aksi berwewenang & operasi atomik (Fase 1.2 & 1.4)
async function sbRpc(fnName, args = {}) {
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, { method:'POST', body: JSON.stringify(args) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.hint || `RPC ${fnName} gagal`);
  return data;
}
if (typeof window !== 'undefined' && !window.agRpc) {
  window.agRpc = sbRpc;
}


// Jejak audit (Fase 1.5) — menyertakan id pengguna, bukan hanya namanya,
// serta cuplikan data sebelum/sesudah bila diberikan.
async function logActivity(action, tableName, recordId, description, name='', beforeData=null, afterData=null) {
  try {
    await sbPost('activity_logs', {
      action, table_name: tableName, record_id: String(recordId),
      description, record_name: name, created_at: new Date().toISOString(),
      user_id:   window.currentUser?.id || null,
      user_name: window.currentUser?.profile?.full_name || window.currentUser?.email || '',
      ...(beforeData ? { before_data: beforeData } : {}),
      ...(afterData  ? { after_data:  afterData  } : {}),
    });
  } catch(e) {}
}
