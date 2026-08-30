// ═══════════════════════════════════════════
// CORE: Supabase API helpers
// ═══════════════════════════════════════════
// SUPABASE_URL dipilih saat runtime:
//  • Desktop Engine (AVA Desktop.exe) menyajikan platform di 127.0.0.1:5174 →
//    pakai shim PostgREST lokal (PGlite) di :54329, sepenuhnya offline.
//  • Selain itu (mis. Vercel produksi) → Supabase cloud seperti biasa.
// Deteksi berbasis hostname; TIDAK mengubah perilaku deployment cloud.
const SUPABASE_CLOUD_URL = 'https://rmyqzyfvlmjxtatpctks.supabase.co';
const _isLocalEngine = (typeof location !== 'undefined') &&
  (location.hostname === '127.0.0.1' || location.hostname === 'localhost');
const LOCAL_ENGINE_URL = (typeof location !== 'undefined') ? `http://${location.hostname}:54329` : '';
const SUPABASE_URL = _isLocalEngine ? LOCAL_ENGINE_URL : SUPABASE_CLOUD_URL;
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXF6eWZ2bG1qeHRhdHBjdGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDQzNzIsImV4cCI6MjA5NjgyMDM3Mn0.tBVQBNH-yi9bmcpY7MRf5w-diwonMTDqwfAOs3t7YK8';

// ── Sesi (Fase 1.0) ───────────────────────────────────────────
// Token pengguna dibaca langsung dari localStorage supaya berkas ini tidak
// bergantung pada auth.js yang dimuat belakangan.
function sbAccessToken()  { try { return localStorage.getItem('ol_token')   || ''; } catch(e) { return ''; } }
function sbRefreshToken() { try { return localStorage.getItem('ol_refresh') || ''; } catch(e) { return ''; } }

// PENTING: 'Authorization' sengaja berupa getter, bukan nilai tetap.
// Object spread ({...SB_HEADERS}) memanggil getter dan menyalin hasilnya,
// sehingga ~18 pemanggil yang sudah ada ikut mengirim JWT pengguna tanpa diubah.
// Selama belum login, jatuh kembali ke anon key agar layar login tetap berfungsi.
const SB_HEADERS = {
  'apikey': SUPABASE_KEY,
  get 'Authorization'() { return `Bearer ${sbAccessToken() || SUPABASE_KEY}`; },
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
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ refresh_token: rt }),
      });
      const data = await res.json();
      if (data && data.access_token) {
        localStorage.setItem('ol_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('ol_refresh', data.refresh_token);
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
    const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.hint || JSON.stringify(data));
    return data;
  } catch (err) {
    console.warn(`[Local Engine Fallback] Querying table '${table}' via SQLite:`, err);
    if (table.includes('products') && window.parent?.api?.getProducts) {
      return await window.parent.api.getProducts();
    }
    if (table.includes('products') && window.api?.getProducts) {
      return await window.api.getProducts();
    }
    return [];
  }
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
