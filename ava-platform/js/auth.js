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
        await loadUserProfile();
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
  try {
    const data = await sbGet('user_profiles',`select=*&id=eq.${window.currentUser.id}`);
    if(!data?.[0] || data[0].id !== window.currentUser.id) throw new Error('Profil akses tidak tersedia.');
    window.currentUser.profile = data[0];
  } catch(e){ clearStoredToken(); window.currentUser = null; throw e; }
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
