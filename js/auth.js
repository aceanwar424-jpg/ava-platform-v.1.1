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
  // Check active session via Supabase
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { ...SB_HEADERS, 'Authorization': `Bearer ${getStoredToken()}` }
    });
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
  showLoginScreen();
}

function getStoredToken(){ return localStorage.getItem('ol_token')||''; }
function setStoredToken(t){ localStorage.setItem('ol_token', t); }
function clearStoredToken(){ localStorage.removeItem('ol_token'); }

async function loadUserProfile(){
  if(!window.currentUser) return;
  try {
    const data = await sbGet('user_profiles',`select=*&id=eq.${window.currentUser.id}`);
    if(data && data[0]) window.currentUser.profile = data[0];
  } catch(e){}
}

// ── Login Screen ──────────────────────────────────
function showLoginScreen(){
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#F1F5F9;display:flex;align-items:center;justify-content:center;padding:20px">
      <div style="background:#fff;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,.12);padding:36px;width:100%;max-width:400px">
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:52px;height:52px;background:#0A2342;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;margin:0 auto 12px">OL</div>
          <h1 style="font-size:22px;font-weight:800;color:#0A2342;margin-bottom:4px">OneLab Growth Platform</h1>
          <p style="font-size:13px;color:#64748B">Masuk untuk melanjutkan</p>
        </div>

        <div id="auth-tabs" style="display:flex;border-bottom:2px solid #E2E8F0;margin-bottom:20px">
          <button class="auth-tab active" onclick="switchAuthTab('login')" id="tab-login"
            style="flex:1;padding:9px;background:none;border:none;font-size:13px;font-weight:700;color:#00897B;border-bottom:2px solid #00897B;margin-bottom:-2px;cursor:pointer">
            Masuk
          </button>
          <button class="auth-tab" onclick="switchAuthTab('register')" id="tab-register"
            style="flex:1;padding:9px;background:none;border:none;font-size:13px;font-weight:600;color:#64748B;cursor:pointer">
            Daftar
          </button>
        </div>

        <!-- LOGIN FORM -->
        <div id="form-login">
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px">
            <label style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase">Email</label>
            <input type="email" id="login-email" placeholder="email@domain.com"
              style="padding:11px 13px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none"
              onfocus="this.style.borderColor='#00897B'" onblur="this.style.borderColor='#E2E8F0'">
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:20px">
            <label style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase">Password</label>
            <input type="password" id="login-pass" placeholder="••••••••"
              style="padding:11px 13px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none"
              onfocus="this.style.borderColor='#00897B'" onblur="this.style.borderColor='#E2E8F0'"
              onkeydown="if(event.key==='Enter')doLogin()">
          </div>
          <button onclick="doLogin()" id="btn-login"
            style="width:100%;padding:12px;background:#0A2342;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">
            Masuk
          </button>
          <div id="login-err" style="display:none;margin-top:10px;padding:10px;background:#FFEBEE;color:#C62828;border-radius:8px;font-size:13px"></div>
        </div>

        <!-- REGISTER FORM -->
        <div id="form-register" style="display:none">
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px">
            <label style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase">Nama Lengkap</label>
            <input type="text" id="reg-name" placeholder="Nama Sales / Tim"
              style="padding:11px 13px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none"
              onfocus="this.style.borderColor='#00897B'" onblur="this.style.borderColor='#E2E8F0'">
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px">
            <label style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase">Email</label>
            <input type="email" id="reg-email" placeholder="email@domain.com"
              style="padding:11px 13px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none"
              onfocus="this.style.borderColor='#00897B'" onblur="this.style.borderColor='#E2E8F0'">
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px">
            <label style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase">Password</label>
            <input type="password" id="reg-pass" placeholder="Min. 8 karakter"
              style="padding:11px 13px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none"
              onfocus="this.style.borderColor='#00897B'" onblur="this.style.borderColor='#E2E8F0'">
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:20px">
            <label style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase">Role</label>
            <select id="reg-role"
              style="padding:11px 13px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;outline:none;background:#fff">
              <option value="sales">Sales Executive</option>
              <option value="admin">Admin / Manager</option>
            </select>
          </div>
          <button onclick="doRegister()" id="btn-register"
            style="width:100%;padding:12px;background:#00897B;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">
            Daftar Akun
          </button>
          <div id="reg-msg" style="display:none;margin-top:10px;padding:10px;border-radius:8px;font-size:13px"></div>
        </div>
      </div>
    </div>`;
}

function switchAuthTab(tab){
  document.getElementById('form-login').style.display     = tab==='login'    ? 'block':'none';
  document.getElementById('form-register').style.display  = tab==='register' ? 'block':'none';
  document.getElementById('tab-login').style.color        = tab==='login'    ? '#00897B':'#64748B';
  document.getElementById('tab-login').style.borderBottom = tab==='login'    ? '2px solid #00897B':'none';
  document.getElementById('tab-register').style.color     = tab==='register' ? '#00897B':'#64748B';
  document.getElementById('tab-register').style.borderBottom = tab==='register' ? '2px solid #00897B':'none';
}

async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('btn-login');
  const err   = document.getElementById('login-err');

  if(!email||!pass){ showAuthErr('login','Email dan password wajib diisi'); return; }

  btn.textContent='⏳ Memproses...'; btn.disabled=true;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if(data.access_token){
      setStoredToken(data.access_token);
      window.currentUser = data.user;
      await loadUserProfile();
      showApp();
    } else {
      showAuthErr('login', data.error_description || data.msg || 'Login gagal. Cek email & password.');
      btn.textContent='Masuk'; btn.disabled=false;
    }
  } catch(e){
    showAuthErr('login','Gagal konek ke server: '+e.message);
    btn.textContent='Masuk'; btn.disabled=false;
  }
}

async function doRegister(){
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const role  = document.getElementById('reg-role').value;
  const btn   = document.getElementById('btn-register');

  if(!name||!email||!pass){ showAuthErr('reg','Semua field wajib diisi'); return; }
  if(pass.length<8){ showAuthErr('reg','Password minimal 8 karakter'); return; }

  btn.textContent='⏳ Mendaftar...'; btn.disabled=true;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body: JSON.stringify({ email, password: pass, data:{ full_name:name, role } })
    });
    const data = await res.json();
    if(data.id || data.user){
      // Save profile
      const userId = (data.user||data).id;
      await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`,{
        method:'POST',
        headers:{...SB_HEADERS},
        body: JSON.stringify({ id:userId, full_name:name, role })
      });
      showAuthMsg('reg','✅ Akun berhasil dibuat! Silakan masuk.','ok');
      setTimeout(()=>switchAuthTab('login'), 1500);
    } else {
      showAuthErr('reg', data.error_description || data.msg || 'Pendaftaran gagal.');
    }
  } catch(e){ showAuthErr('reg','Error: '+e.message); }
  btn.textContent='Daftar Akun'; btn.disabled=false;
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
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`,{
      method:'POST',
      headers:{...SB_HEADERS,'Authorization':`Bearer ${getStoredToken()}`}
    });
  } catch(e){}
  clearStoredToken();
  window.currentUser = null;
  location.reload();
}

function getUserName(){
  return window.currentUser?.profile?.full_name || window.currentUser?.email?.split('@')[0] || 'User';
}

function getUserRole(){
  let role = window.currentUser?.profile?.role 
      || window.currentUser?.user_metadata?.role
      || window.currentUser?.role
      || 'sales';
  role = String(role).trim().toLowerCase();
  const map = { admin:'super_admin', head:'super_admin', superadmin:'super_admin' };
  return map[role] || role;
}

function isAdmin(){
  return getUserRole() === 'admin';
}
