// ═══════════════════════════════════════════════════
// Auth — Supabase Auth
// ═══════════════════════════════════════════════════

// auth.js operates on window.currentUser directly (not a local `let` binding),
// since the boot sequence in index.html sets `window.currentUser = user`.
// IMPORTANT: do not redeclare with `let`/`const` here — a top-level `let` does
// NOT become a window property, which previously caused getUserRole()/getUserName()
// to read a permanently-null local variable instead of the real session data.
if (typeof window.currentUser === 'undefined') window.currentUser = null;

async function initAuth(){
  // Cek sesi aktif; bila token kedaluwarsa, coba perbarui dulu sebelum
  // memaksa pengguna login ulang (Fase 1.0).
  try {
    let res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { ...SB_HEADERS, 'Authorization': `Bearer ${getStoredToken()}` }
    });
    if(!res.ok && getStoredRefresh() && typeof sbRefreshSession === 'function'){
      const ok = await sbRefreshSession();
      if(ok){
        res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { ...SB_HEADERS, 'Authorization': `Bearer ${getStoredToken()}` }
        });
      }
    }
    if(res.ok){
      const user = await res.json();
      if(user && user.id){
        window.currentUser = user;
        try {
          await loadUserProfile();
        } catch (profileError) {
          showAccessBlocked(profileError);
          return;
        }
        showApp();
        return;
      }
    }
  } catch(e){}

  clearStoredToken();
  window.currentUser = null;
  showLoginScreen();
}

function getStoredToken(){ return sessionStorage.getItem('ol_token')||''; }
function setStoredToken(t){ sessionStorage.setItem('ol_token', t); }
function getStoredRefresh(){ return sessionStorage.getItem('ol_refresh')||''; }
function setStoredRefresh(t){ if(t) sessionStorage.setItem('ol_refresh', t); }
function clearStoredToken(){ sessionStorage.removeItem('ol_token'); sessionStorage.removeItem('ol_refresh'); }


async function loadUserProfile(){
  if(!window.currentUser) return;
  const loader = typeof sbGetStrict === 'function' ? sbGetStrict : sbGet;
  const data = await loader('user_profiles',`select=*&id=eq.${encodeURIComponent(window.currentUser.id)}`);
  if(!data?.[0] || data[0].id !== window.currentUser.id) {
    throw new Error('Profil akses akun ini belum tersedia. Hubungi administrator untuk melengkapi peran akun.');
  }
  window.currentUser.profile = data[0];
}

// Sesi Auth yang masih sah tidak boleh dihapus hanya karena profil/RBAC tidak
// dapat dibaca. Menghapusnya menghasilkan loop login dan menyamarkan akar
// masalah (profil belum dibuat, RLS menolak, atau layanan sedang terganggu).
function showAccessBlocked(error){
  const message = error?.message || 'Profil akses tidak dapat diverifikasi.';
  document.body.innerHTML = `
    <main style="min-height:100vh;background:#020617;display:flex;align-items:center;justify-content:center;padding:20px">
      <section role="alert" style="background:#0F172A;border:1px solid #334155;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.45);padding:28px;width:100%;max-width:500px;color:#F8FAFC">
        <p style="margin:0 0 8px;color:#38BDF8;font-size:12px;font-weight:800;letter-spacing:.06em">AKSES PERLU DIVERIFIKASI</p>
        <h1 style="margin:0 0 10px;font-size:20px">Akun berhasil diautentikasi</h1>
        <p style="margin:0;color:#CBD5E1;line-height:1.55;font-size:14px">${escapeAuthText(message)}</p>
        <p style="margin:12px 0 20px;color:#94A3B8;font-size:12px;line-height:1.5">Tidak ada menu atau data klinis yang dibuka. Administrator dapat memeriksa profil dan peran akun, lalu Anda dapat mencoba kembali.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" onclick="location.reload()" style="padding:10px 14px;background:#0284C7;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer">Coba lagi</button>
          <button type="button" onclick="resetAccessSession()" style="padding:10px 14px;background:transparent;color:#E2E8F0;border:1px solid #475569;border-radius:8px;font-weight:700;cursor:pointer">Masuk dengan akun lain</button>
        </div>
      </section>
    </main>`;
}
function escapeAuthText(value){
  return String(value).replace(/[&<>\"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[ch]));
}
function resetAccessSession(){
  clearStoredToken();
  window.currentUser = null;
  location.reload();
}

// ── Login Screen ──────────────────────────────────
function showLoginScreen(){
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#020617;display:flex;align-items:center;justify-content:center;padding:20px">
      <div style="background:#0F172A;border:1px solid #1E293B;border-radius:20px;box-shadow:0 12px 48px rgba(0,0,0,.45);padding:32px;width:100%;max-width:440px;color:#F8FAFC">
        <div style="text-align:center;margin-bottom:24px">
          <img src="css/logo-ava-global.png" style="width:58px;height:58px;border-radius:50%;border:2px solid #d4af37;object-fit:cover;margin:0 auto 10px;display:block;box-shadow:0 0 16px rgba(212,175,55,0.35);" alt="Logo">
          <h1 style="font-size:20px;font-weight:800;color:#F8FAFC;margin-bottom:4px;letter-spacing:-0.01em">AVA GLOBAL ECOSYSTEM</h1>
          <p style="font-size:12px;color:#94A3B8">Pintu Masuk Terpadu Multi-Role Platform</p>
        </div>

        <div id="auth-tabs" style="display:flex;border-bottom:2px solid #1E293B;margin-bottom:16px">
          <button class="auth-tab active" onclick="switchAuthTab('login')" id="tab-login"
            style="flex:1;padding:8px;background:none;border:none;font-size:13px;font-weight:700;color:#38BDF8;border-bottom:2px solid #38BDF8;margin-bottom:-2px;cursor:pointer">
            Masuk
          </button>
        </div>

        <!-- LOGIN FORM -->
        <div id="form-login">
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Email Akun</label>
            <input type="email" id="login-email" placeholder="contoh@gmail.com" autocomplete="username"
              style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none"
              onfocus="this.style.borderColor='#38BDF8'" onblur="this.style.borderColor='#334155'">
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:18px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Password</label>
            <input type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password"
              style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none"
              onfocus="this.style.borderColor='#38BDF8'" onblur="this.style.borderColor='#334155'"
              onkeydown="if(event.key==='Enter')doLogin()">
          </div>
          <button onclick="doLogin()" id="btn-login"
            style="width:100%;padding:11px;background:linear-gradient(135deg, #0284C7 0%, #0369A1 100%);color:#fff;border:none;border-radius:8px;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(2,132,199,0.3)">
            Masuk ke Sistem
          </button>
          <div id="login-err" style="display:none;margin-top:10px;padding:10px;background:rgba(239,68,68,0.15);color:#FCA5A5;border:1px solid rgba(239,68,68,0.3);border-radius:8px;font-size:12px"></div>
        </div>


      </div>
    </div>`;
}

function trOnRoleSelectChange(val) {
  const nikEl = document.getElementById('reg-field-nik');
  const dobEl = document.getElementById('reg-field-dob');
  if (nikEl) nikEl.style.display = (val === 'patient') ? 'flex' : 'none';
  if (dobEl) dobEl.style.display = (val === 'patient') ? 'flex' : 'none';
}

function switchAuthTab(tab){ return; }

async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('btn-login');
  const err   = document.getElementById('login-err');

  if(!email||!pass){ showAuthErr('login','Email dan password wajib diisi'); return; }

  clearStoredToken();
  document.getElementById('login-pass').value = '';
  btn.textContent='⏳ Memproses...'; btn.disabled=true;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_RUNTIME_KEY},
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if(res.ok && data.access_token && data.user?.id){
      setStoredToken(data.access_token);
      setStoredRefresh(data.refresh_token);
      window.currentUser = data.user;
      await loadUserProfile();
      showApp();
    } else {
      showAuthErr('login', data.error_description || data.msg || 'Login gagal. Cek email & password.');
      btn.textContent='Masuk ke Sistem'; btn.disabled=false;
    }
  } catch(e){
    showAuthErr('login','Gagal konek ke server: '+e.message);
    btn.textContent='Masuk ke Sistem'; btn.disabled=false;
  }
}

async function doRegister(){
  showAuthErr('reg', 'Pendaftaran akun harus melalui administrator.');
  return;
}

function showAuthErr(form, msg){
  const id = form==='login' ? 'login-err' : 'reg-msg';
  const el = document.getElementById(id);
  if(!el) return;
  el.style.display='block';
  el.style.background='#FFEBEE'; el.style.color='#C62828';
  el.textContent=msg;
}

function showAuthMsg(form, msg, type){
  const id = form==='reg' ? 'reg-msg' : 'login-err';
  const el = document.getElementById(id);
  if(!el) return;
  el.style.display='block';
  el.style.background= type==='ok' ? '#E8F5E9' : '#FFEBEE';
  el.style.color= type==='ok' ? '#1B5E20' : '#C62828';
  el.textContent=msg;
}

// ── Show main app ─────────────────────────────────
function showApp(){
  // Reload page HTML structure (karena login screen replace seluruh body)
  location.reload();
  // Setelah reload, app.js akan cek token dan tampilkan app
}

async function doLogout(){
  const token = getStoredToken();
  clearStoredToken();
  window.currentUser = null;
  try {
    if (location.protocol === 'https:') await fetch('/api/staff-session', {method:'DELETE'});
    await fetch(`${SUPABASE_URL}/auth/v1/logout`,{
      method:'POST',
      headers:{...SB_HEADERS,'Authorization':`Bearer ${token}`}
    });
  } catch(e){}
  clearStoredToken();
  window.currentUser = null;
  location.reload();
}

// getUserName(), getUserRole(), dan isAdmin() TIDAK didefinisikan di sini.
// Ketiganya dulu ada rangkap: satu di js/core/utils.js, satu lagi di berkas ini.
// Karena auth.js dimuat SETELAH utils.js, salinan di sinilah yang menang —
// dan salinan ini kehilangan fallback `user_metadata.full_name`, sehingga nama
// pengguna yang hanya tersimpan di metadata tampil sebagai potongan email.
// Sumber tunggalnya sekarang js/core/utils.js.
