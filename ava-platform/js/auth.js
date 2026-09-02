// ═══════════════════════════════════════════════════
// Auth — Supabase Auth
// ═══════════════════════════════════════════════════

// auth.js operates on window.currentUser directly (not a local `let` binding),
// since the boot sequence in index.html sets `window.currentUser = user`.
// IMPORTANT: do not redeclare with `let`/`const` here — a top-level `let` does
// NOT become a window property, which previously caused getUserRole()/getUserName()
// to read a permanently-null local variable instead of the real session data.
if (typeof window.currentUser === 'undefined') window.currentUser = null;
const authLocalDemo = () => {
  const h = String(location.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
};

async function initAuth(){
  const token = getStoredToken();
  if (token.startsWith('master_ava_') && !authLocalDemo()) {
    clearStoredToken();
    window.currentUser = null;
    showLoginScreen();
    return;
  }
  if (token === 'master_ava_token_superadmin_all_access' && authLocalDemo()) {
    window.currentUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@avahealth.sbs',
      role: 'super_admin',
      user_metadata: { full_name: 'Master Super Admin', role: 'super_admin' },
      profile: { full_name: 'Master Super Admin', role: 'super_admin', is_superadmin: true }
    };
    return;
  }

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

function getStoredToken(){ return localStorage.getItem('ol_token')||''; }
function setStoredToken(t){ localStorage.setItem('ol_token', t); }
function getStoredRefresh(){ return localStorage.getItem('ol_refresh')||''; }
function setStoredRefresh(t){ if(t) localStorage.setItem('ol_refresh', t); }
function clearStoredToken(){ localStorage.removeItem('ol_token'); localStorage.removeItem('ol_refresh'); }

const AVA_DEMO_USERS = {
  'admin@avahealth.sbs': { id: 'usr-admin-master', email: 'admin@avahealth.sbs', full_name: 'Master Super Admin', role: 'super_admin', is_superadmin: true },
  'dokter@avahealth.sbs': { id: 'usr-dokter-sp', email: 'dokter@avahealth.sbs', full_name: 'dr. Andi Pratama, Sp.PD', role: 'dokter', is_superadmin: false, alias: 'dr. Andi' },
  'analis@avahealth.sbs': { id: 'usr-atlm-lab', email: 'analis@avahealth.sbs', full_name: 'Siti Rahmawati, A.Md.AK', role: 'analis', is_superadmin: false, alias: 'Siti ATLM' },
  'sppk@avahealth.sbs': { id: 'usr-sppk-valid', email: 'sppk@avahealth.sbs', full_name: 'dr. Budi Santoso, Sp.PK', role: 'dokter_sp_pk', is_superadmin: false, alias: 'dr. Budi SpPK' },
  'pasien@avahealth.sbs': { id: 'usr-pasien-d2c', email: 'pasien@avahealth.sbs', full_name: 'Rina Kusuma (Pasien)', role: 'patient', is_superadmin: false },
  'member@avahealth.sbs': { id: 'usr-member-vip', email: 'member@avahealth.sbs', full_name: 'Dewi Lestari (VIP Member)', role: 'member', is_superadmin: false },
  'corp@avahealth.sbs': { id: 'usr-corp-pic', email: 'corp@avahealth.sbs', full_name: 'Budi Hartono (PIC Corporate)', role: 'corporate', is_superadmin: false },
  'farmasi@avahealth.sbs': { id: 'usr-apt-farmasi', email: 'farmasi@avahealth.sbs', full_name: 'apt. Maya Sari, S.Farm', role: 'farmasi', is_superadmin: false },
  'kasir@avahealth.sbs': { id: 'usr-kasir-pos', email: 'kasir@avahealth.sbs', full_name: 'Ahmad Fauzi (Kasir)', role: 'kasir', is_superadmin: false }
};

function quickFillDemo(roleKey) {
  const map = {
    admin: 'admin@avahealth.sbs',
    dokter: 'dokter@avahealth.sbs',
    analis: 'analis@avahealth.sbs',
    sppk: 'sppk@avahealth.sbs',
    pasien: 'pasien@avahealth.sbs',
    member: 'member@avahealth.sbs',
    corp: 'corp@avahealth.sbs',
    farmasi: 'farmasi@avahealth.sbs',
    kasir: 'kasir@avahealth.sbs'
  };
  const email = map[roleKey] || 'admin@avahealth.sbs';
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-pass');
  if (emailInput) emailInput.value = email;
  if (passInput) passInput.value = '12345678';
  doLogin();
}
window.quickFillDemo = quickFillDemo;

async function loadUserProfile(){
  if(!window.currentUser) return;
  const email = (window.currentUser.email || '').toLowerCase();
  if (AVA_DEMO_USERS[email]) {
    const demo = AVA_DEMO_USERS[email];
    window.currentUser.role = demo.role;
    window.currentUser.profile = { ...demo };
    return;
  }
  try {
    const data = await sbGet('user_profiles',`select=*&id=eq.${window.currentUser.id}`);
    if(data && data[0]) window.currentUser.profile = data[0];
  } catch(e){}
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

        <!-- QUICK DEMO LOGIN CHIPS -->
        <div style="background:#020617;padding:10px;border-radius:12px;border:1px solid #1E293B;margin-bottom:18px">
          <div style="font-size:10.5px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:8px;display:flex;justify-content:space-between">
            <span>⚡ 1-Click Demo Login:</span>
            <span style="color:#D4AF37">Pass: 12345678</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            <button onclick="quickFillDemo('admin')" style="padding:4px 8px;font-size:11px;font-weight:700;background:#0A2342;color:#38BDF8;border:1px solid #0284C7;border-radius:6px;cursor:pointer">👑 Admin/CEO</button>
            <button onclick="quickFillDemo('dokter')" style="padding:4px 8px;font-size:11px;font-weight:700;background:#0A2342;color:#34D399;border:1px solid #059669;border-radius:6px;cursor:pointer">🩺 Dokter</button>
            <button onclick="quickFillDemo('analis')" style="padding:4px 8px;font-size:11px;font-weight:700;background:#0A2342;color:#FBBF24;border:1px solid #D97706;border-radius:6px;cursor:pointer">🔬 Analis Lab</button>
            <button onclick="quickFillDemo('sppk')" style="padding:4px 8px;font-size:11px;font-weight:700;background:#0A2342;color:#A78BFA;border:1px solid #7C3AED;border-radius:6px;cursor:pointer">🔏 Sp.PK</button>
            <button onclick="quickFillDemo('pasien')" style="padding:4px 8px;font-size:11px;font-weight:700;background:#0A2342;color:#F472B6;border:1px solid #DB2777;border-radius:6px;cursor:pointer">👤 Pasien</button>
            <button onclick="quickFillDemo('member')" style="padding:4px 8px;font-size:11px;font-weight:700;background:#0A2342;color:#D4AF37;border:1px solid #D4AF37;border-radius:6px;cursor:pointer">👑 VIP Member</button>
            <button onclick="quickFillDemo('corp')" style="padding:4px 8px;font-size:11px;font-weight:700;background:#0A2342;color:#60A5FA;border:1px solid #2563EB;border-radius:6px;cursor:pointer">🏢 Korporat</button>
          </div>
        </div>

        <div id="auth-tabs" style="display:flex;border-bottom:2px solid #1E293B;margin-bottom:16px">
          <button class="auth-tab active" onclick="switchAuthTab('login')" id="tab-login"
            style="flex:1;padding:8px;background:none;border:none;font-size:13px;font-weight:700;color:#38BDF8;border-bottom:2px solid #38BDF8;margin-bottom:-2px;cursor:pointer">
            Masuk
          </button>
          <button class="auth-tab" onclick="switchAuthTab('register')" id="tab-register"
            style="flex:1;padding:8px;background:none;border:none;font-size:13px;font-weight:600;color:#64748B;cursor:pointer">
            Daftar
          </button>
        </div>

        <!-- LOGIN FORM -->
        <div id="form-login">
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Email Akun</label>
            <input type="email" id="login-email" placeholder="admin@avahealth.sbs" value="admin@avahealth.sbs"
              style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none"
              onfocus="this.style.borderColor='#38BDF8'" onblur="this.style.borderColor='#334155'">
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:18px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Password</label>
            <input type="password" id="login-pass" placeholder="••••••••" value="12345678"
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

        <!-- REGISTER FORM -->
        <div id="form-register" style="display:none">
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Tipe Pendaftaran / Role *</label>
            <select id="reg-role" onchange="trOnRoleSelectChange(this.value)"
              style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;outline:none;font-weight:700;color:#F8FAFC">
              <option value="patient">👤 Pasien / Pelanggan AVA Health (Registrasi Mandiri)</option>
              <option value="dokter">🩺 Dokter Telehealth</option>
              <option value="vendor">🏬 Vendor Alkes / Lab Kalibrasi</option>
              <option value="sales">💼 Sales Executive / Staff</option>
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Nama Lengkap *</label>
            <input type="text" id="reg-name" placeholder="Nama sesuai KTP"
              style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none">
          </div>
          <div id="reg-field-nik" style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">NIK (16 Digit KTP) *</label>
            <input type="text" id="reg-nik" placeholder="3273010101900001" maxlength="16"
              style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none;font-family:monospace;letter-spacing:1px">
          </div>
          <div style="display:flex;gap:10px;margin-bottom:12px">
            <div style="flex:1;display:flex;flex-direction:column;gap:5px">
              <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">No. HP / WA *</label>
              <input type="text" id="reg-phone" placeholder="08xxxxxxxxxx"
                style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none">
            </div>
            <div id="reg-field-dob" style="flex:1;display:flex;flex-direction:column;gap:5px">
              <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Tgl Lahir</label>
              <input type="date" id="reg-dob"
                style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none">
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Email *</label>
            <input type="email" id="reg-email" placeholder="user@avahealth.sbs"
              style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none">
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:18px">
            <label style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Password *</label>
            <input type="password" id="reg-pass" placeholder="Min. 8 karakter"
              style="padding:10px 12px;background:#020617;border:1.5px solid #334155;border-radius:8px;font-size:13.5px;color:#F8FAFC;outline:none">
          </div>
          <button onclick="doRegister()" id="btn-register"
            style="width:100%;padding:11px;background:#00897B;color:#fff;border:none;border-radius:8px;font-size:13.5px;font-weight:700;cursor:pointer">
            Daftar & Buat Profil
          </button>
          <div id="reg-msg" style="display:none;margin-top:10px;padding:10px;border-radius:8px;font-size:13px"></div>
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

function switchAuthTab(tab){
  document.getElementById('form-login').style.display     = tab==='login'    ? 'block':'none';
  document.getElementById('form-register').style.display  = tab==='register' ? 'block':'none';
  document.getElementById('tab-login').style.color        = tab==='login'    ? '#38BDF8':'#64748B';
  document.getElementById('tab-login').style.borderBottom = tab==='login'    ? '2px solid #38BDF8':'none';
  document.getElementById('tab-register').style.color     = tab==='register' ? '#38BDF8':'#64748B';
  document.getElementById('tab-register').style.borderBottom = tab==='register' ? '2px solid #38BDF8':'none';
}

async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('btn-login');
  const err   = document.getElementById('login-err');

  if(!email||!pass){ showAuthErr('login','Email dan password wajib diisi'); return; }

  btn.textContent='⏳ Memproses...'; btn.disabled=true;

  // Multi-Role Demo Direct Authentication
  const lowEmail = email.toLowerCase();
  if (authLocalDemo() && AVA_DEMO_USERS[lowEmail] && (pass === '12345678' || pass.length >= 6)) {
    const demoUser = AVA_DEMO_USERS[lowEmail];
    const sessionUser = {
      id: demoUser.id,
      email: demoUser.email,
      role: demoUser.role,
      user_metadata: { full_name: demoUser.full_name, role: demoUser.role },
      profile: { ...demoUser }
    };
    setStoredToken('master_ava_token_' + demoUser.role);
    setStoredRefresh('master_ava_refresh_' + demoUser.role);
    window.currentUser = sessionUser;
    localStorage.setItem('ol_master_user', JSON.stringify(sessionUser));
    showApp();
    return;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if(data.access_token){
      setStoredToken(data.access_token);
      setStoredRefresh(data.refresh_token);
      window.currentUser = data.user;
      await loadUserProfile();
      showApp();
    } else {
      if (authLocalDemo() && AVA_DEMO_USERS[lowEmail]) {
        const demoUser = AVA_DEMO_USERS[lowEmail];
        setStoredToken('master_ava_token_' + demoUser.role);
        window.currentUser = { id: demoUser.id, email: demoUser.email, role: demoUser.role, profile: demoUser };
        showApp();
        return;
      }
      showAuthErr('login', data.error_description || data.msg || 'Login gagal. Cek email & password.');
      btn.textContent='Masuk ke Sistem'; btn.disabled=false;
    }
  } catch(e){
    if (authLocalDemo() && AVA_DEMO_USERS[lowEmail]) {
      const demoUser = AVA_DEMO_USERS[lowEmail];
      setStoredToken('master_ava_token_' + demoUser.role);
      window.currentUser = { id: demoUser.id, email: demoUser.email, role: demoUser.role, profile: demoUser };
      showApp();
      return;
    }
    showAuthErr('login','Gagal konek ke server: '+e.message);
    btn.textContent='Masuk ke Sistem'; btn.disabled=false;
  }
}

async function doRegister(){
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const role  = document.getElementById('reg-role').value;
  const nik   = document.getElementById('reg-nik')?.value.trim() || '';
  const phone = document.getElementById('reg-phone')?.value.trim() || '';
  const dob   = document.getElementById('reg-dob')?.value || '';
  const btn   = document.getElementById('btn-register');

  if(!name||!email||!pass){ showAuthErr('reg','Nama, email, dan password wajib diisi'); return; }
  if(pass.length<8){ showAuthErr('reg','Password minimal 8 karakter'); return; }

  // Validasi khusus Pasien / Customer: NIK wajib 16 digit
  if(role === 'patient') {
    if(!nik || !/^\d{16}$/.test(nik)) {
      showAuthErr('reg','Validasi Gagal: NIK wajib diisi 16 digit angka KTP yang valid');
      return;
    }
  }

  btn.textContent='⏳ Validasi & Mendaftar...'; btn.disabled=true;
  try {
    const patientCode = role==='patient' ? `PAT-${Date.now().toString().slice(-5)}` : null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body: JSON.stringify({ email, password: pass, data:{ full_name:name, role, nik, phone, dob, patient_id: patientCode } })
    });
    const data = await res.json();
    if(data.id || data.user){
      const userId = (data.user||data).id;
      await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`,{
        method:'POST',
        headers:{...SB_HEADERS},
        body: JSON.stringify({
          id: userId,
          full_name: name,
          role: role,
          nik: nik || null,
          phone: phone || null,
          dob: dob || null,
          patient_id: patientCode
        })
      });
      showAuthMsg('reg','✅ Akun & profil berhasil divalidasi! Silakan masuk.','ok');
      setTimeout(()=>switchAuthTab('login'), 1500);
    } else {
      showAuthErr('reg', data.error_description || data.msg || 'Pendaftaran gagal.');
    }
  } catch(e){ showAuthErr('reg','Error: '+e.message); }
  btn.textContent='Daftar & Buat Profil'; btn.disabled=false;
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

// getUserName(), getUserRole(), dan isAdmin() TIDAK didefinisikan di sini.
// Ketiganya dulu ada rangkap: satu di js/core/utils.js, satu lagi di berkas ini.
// Karena auth.js dimuat SETELAH utils.js, salinan di sinilah yang menang —
// dan salinan ini kehilangan fallback `user_metadata.full_name`, sehingga nama
// pengguna yang hanya tersimpan di metadata tampil sebagai potongan email.
// Sumber tunggalnya sekarang js/core/utils.js.
