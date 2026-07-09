// ═══════════════════════════════════════════
// MODULE: User Management & Role/Permission v4
// Per-role menu access + granular permissions
// ═══════════════════════════════════════════

// ── Semua page yang ada di sistem ─────────
const ALL_PAGES = {
  // key: [group, label, icon]
  'dashboard':        ['Utama',           'Dashboard',           '🏠'],
  // Marketing & Sales
  'partners':         ['Marketing & Sales','Partner Database',    '🤝'],
  'maps':             ['Marketing & Sales','Maps Prospecting',    '🗺️'],
  'leads':            ['Marketing & Sales','Leads Management',    '🎯'],
  'marketing':        ['Marketing & Sales','Marketing & Voucher', '📣'],
  'okr':              ['Marketing & Sales','OKR & Target Sales',  '📈'],
  'mcu':              ['Marketing & Sales','Project MCU',         '🏥'],
  'surat':            ['Marketing & Sales','Surat Keluar',        '📄'],
  'mou':              ['Marketing & Sales','MOU / Perjanjian',    '📜'],
  // Operasional Lab
  'lab-checkin':      ['Operasional Lab',  'Check In Sampel',    '🧪'],
  'lab-result':       ['Operasional Lab',  'Enter Result',       '📝'],
  'lab-validation':   ['Operasional Lab',  'Validasi Hasil',     '✅'],
  'lab-approval':     ['Operasional Lab',  'Approval Lab',       '🔏'],
  'medrecord':        ['Operasional Lab',  'Medical Record',     '📁'],
  // Layanan Klinik
  'admission':        ['Layanan Klinik',   'Admission',          '🏨'],
  'radiology':        ['Layanan Klinik',   'Radiology',          '🫁'],
  'supportive':       ['Layanan Klinik',   'Supportive/EKG',     '❤️'],
  'package':          ['Layanan Klinik',   'Package Service',    '🗂️'],
  // Home Care
  'homecare':         ['Home Care',        'Order Home Care',    '🏠'],
  'hc-schedule':      ['Home Care',        'Jadwal Kunjungan',   '📅'],
  'hc-billing':       ['Home Care',        'Billing Fee Nakes',  '💵'],
  'hc-report':        ['Home Care',        'Report Home Care',   '📊'],
  // Finance
  'cashier':          ['Finance',          'Cashier',            '🏧'],
  'finance':          ['Finance',          'Invoice & Tagihan',  '💰'],
  'finance-ar':       ['Finance',          'Tagihan AR',         '📑'],
  'finance-comm':     ['Finance',          'Komisi Sales',       '🏆'],
  'finance-report':   ['Finance',          'Laporan Keuangan',   '📊'],
  // Inventory
  'inventory':        ['Inventory',        'Stock & Reagen',     '📦'],
  'inventory-pr':     ['Inventory',        'Purchase Request',   '🛒'],
  'inventory-supplier':['Inventory',       'Supplier',           '🏭'],
  // HRD
  'hrd':              ['HRD',              'Data Karyawan',      '👥'],
  'org-structure':    ['HRD',              'Struktur Organisasi','🏛️'],
  'work-schedule':    ['HRD',              'Jadwal Kerja',       '📅'],
  'shift-calendar':   ['HRD',              'Kalender Shift',     '📆'],
  'attendance':       ['HRD',              'Absensi',            '⏰'],
  'hrd-cuti':         ['HRD',              'Cuti & Izin',        '🕐'],
  'hrd-payroll':      ['HRD',              'Penggajian',         '💵'],
  // Produktivitas
  'tasks':            ['Produktivitas',    'Task Management',    '📋'],
  'regulatory':       ['Produktivitas',    'Pelaporan & Audit',  '📊'],
  // Konfigurasi
  'product':          ['Konfigurasi',      'Product',            '🧬'],
  'corporate':        ['Konfigurasi',      'Corporate',          '🏢'],
  'import':           ['Konfigurasi',      'Import Excel',       '📥'],
  'settings':         ['Konfigurasi',      'Pengaturan',         '⚙️'],
  'users':            ['Konfigurasi',      'User Management',    '👤'],
};

// ── Default pages per role (page keys) ────
const ROLE_DEFAULT_PAGES = {
  super_admin:   Object.keys(ALL_PAGES),
  direktur:      Object.keys(ALL_PAGES),
  manager:       Object.keys(ALL_PAGES),
  spv:           Object.keys(ALL_PAGES).filter(p=>p!=='users'),
  sales:         ['dashboard','partners','maps','leads','marketing','okr','mcu','surat','mou','tasks','regulatory'],
  operasional:   ['dashboard','lab-checkin','lab-result','lab-validation','lab-approval','medrecord','admission','radiology','supportive','homecare','hc-schedule','hc-billing','hc-report','inventory','inventory-pr','tasks'],
  hrd_staff:     ['dashboard','hrd','org-structure','work-schedule','attendance','hrd-cuti','hrd-payroll','tasks'],
  finance_staff: ['dashboard','cashier','finance','finance-ar','finance-comm','finance-report','tasks','regulatory'],
  viewer:        ['dashboard'],
};

const ROLES = {
  super_admin: {
    label:'Super Admin', color:'#7B1FA2',
    desc:'Akses penuh semua modul + kelola user',
    pages: ROLE_DEFAULT_PAGES.super_admin,
    canDelete:true, canBulkDelete:true, canExport:true, canManageUsers:true,
    canApproveLogbook:true, canAssignTask:true, canSeeTeamBoard:true,
  },
  direktur: {
    label:'Direktur', color:'#0A2342',
    desc:'Semua modul, approval, laporan keuangan',
    pages: ROLE_DEFAULT_PAGES.direktur,
    canDelete:true, canBulkDelete:false, canExport:true, canManageUsers:false,
    canApproveLogbook:true, canAssignTask:true, canSeeTeamBoard:true,
  },
  manager: {
    label:'Manager', color:'#00897B',
    desc:'Semua operasional kecuali user management',
    pages: ROLE_DEFAULT_PAGES.manager,
    canDelete:true, canBulkDelete:false, canExport:true, canManageUsers:false,
    canApproveLogbook:true, canAssignTask:true, canSeeTeamBoard:true,
  },
  spv: {
    label:'SPV / Supervisor', color:'#0E7490',
    desc:'Supervisi tim, approve logbook, assign task, team board',
    pages: ROLE_DEFAULT_PAGES.spv,
    canDelete:false, canBulkDelete:false, canExport:true, canManageUsers:false,
    canApproveLogbook:true, canAssignTask:true, canSeeTeamBoard:true,
  },
  sales: {
    label:'Sales', color:'#1565C0',
    desc:'Partner, maps, marketing, leads, MCU, OKR',
    pages: ROLE_DEFAULT_PAGES.sales,
    canDelete:false, canBulkDelete:false, canExport:false, canManageUsers:false,
  },
  operasional: {
    label:'Operasional Lab', color:'#2E7D32',
    desc:'Lab, klinik, homecare, inventory',
    pages: ROLE_DEFAULT_PAGES.operasional,
    canDelete:false, canBulkDelete:false, canExport:false, canManageUsers:false,
  },
  hrd_staff: {
    label:'HRD Staff', color:'#E65100',
    desc:'Data karyawan, jadwal, absensi, cuti, payroll',
    pages: ROLE_DEFAULT_PAGES.hrd_staff,
    canDelete:false, canBulkDelete:false, canExport:false, canManageUsers:false,
  },
  finance_staff: {
    label:'Finance Staff', color:'#00838F',
    desc:'Cashier, invoice, AR, laporan keuangan',
    pages: ROLE_DEFAULT_PAGES.finance_staff,
    canDelete:false, canBulkDelete:false, canExport:true, canManageUsers:false,
  },
  viewer: {
    label:'Viewer', color:'#546E7A',
    desc:'Hanya lihat dashboard',
    pages: ROLE_DEFAULT_PAGES.viewer,
    canDelete:false, canBulkDelete:false, canExport:false, canManageUsers:false,
  },
};

// ── Load custom page overrides from localStorage ─────────────
function getRolePages(role) {
  const stored = localStorage.getItem('ol_role_pages_' + role);
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }
  return ROLES[role]?.pages || ROLE_DEFAULT_PAGES[role] || ['dashboard'];
}

function saveRolePages(role, pages) {
  localStorage.setItem('ol_role_pages_' + role, JSON.stringify(pages));
}

// ── Apply menu visibility based on role pages ────────────────
function applyRoleMenu() {
  const role   = getUserRole ? getUserRole() : 'sales';
  const rc     = ROLES[role] || ROLES.sales;
  const userId = window.currentUser?.id || '';

  // Priority: 1) per-user custom, 2) per-role custom, 3) role default
  let allowedPages;
  const userCustom = userId ? localStorage.getItem('ol_user_pages_'+userId) : null;
  if (userCustom) {
    try { allowedPages = JSON.parse(userCustom); } catch(e) {}
  }
  if (!allowedPages) allowedPages = getRolePages(role);

  window.roleConfig = {
    ...rc,
    pages:        allowedPages,
    isSpv:        ['super_admin','spv','manager','direktur'].includes(role),
    isManager:    ['super_admin','manager','direktur'].includes(role),
    isSuperAdmin: role === 'super_admin',
  };

  // Note: menu visibility now handled by openFlyout() reading window.roleConfig.pages
  // (old .nav-item DOM elements no longer exist — replaced by rail + flyout panel)

  // Hide rail category icons entirely if NONE of their pages are allowed
  if (role !== 'super_admin' && typeof FLYOUT_MENUS !== 'undefined') {
    document.querySelectorAll('.rail-item[data-cat]').forEach(btn => {
      const cat  = btn.getAttribute('data-cat');
      const menu = FLYOUT_MENUS[cat];
      if (!menu) return;
      const hasAnyAccess = menu.items.some(item =>
        item.soon || allowedPages.includes(item.page) ||
        (item.adminOnly && ['manager','direktur'].includes(role))
      );
      btn.style.display = hasAnyAccess ? '' : 'none';
    });
  } else {
    document.querySelectorAll('.rail-item[data-cat]').forEach(btn => { btn.style.display = ''; });
  }

  // Role label in sidebar with color
  const roleEl = document.getElementById('user-role-sidebar');
  if (roleEl) {
    roleEl.textContent  = rc.label;
    roleEl.style.color  = rc.color ? rc.color+'CC' : 'rgba(255,255,255,.5)';
  }
  // Avatar color per role
  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl && rc.color) {
    avatarEl.style.background = `linear-gradient(135deg,${rc.color},${rc.color}99)`;
  }
  // Topbar avatar & user name color
  const topbarAv = document.getElementById('topbar-avatar');
  if (topbarAv && rc.color) {
    topbarAv.style.background = `linear-gradient(135deg,${rc.color},${rc.color}99)`;
  }
}

// ── Permission helpers ─────────────────────
function isSpv() {
  return ['super_admin','spv','manager','direktur'].includes(getUserRole ? getUserRole() : '');
}
function isManager() {
  return ['super_admin','manager','direktur'].includes(getUserRole ? getUserRole() : '');
}
function canAccess(page) {
  const role = getUserRole ? getUserRole() : 'sales';
  if (role === 'super_admin') return true;
  return getRolePages(role).includes(page);
}

// ── Render User Management ────────────────
async function renderUsers() {
  if (getUserRole() !== 'super_admin') {
    document.getElementById('main-content').innerHTML = `
      <div class="empty-state" style="min-height:60vh">
        <div class="ico">🔒</div><h3>Akses Ditolak</h3>
        <p>Hanya Super Admin yang bisa mengelola user.</p>
      </div>`; return;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>User Management</h1>
        <p>Kelola akses dan role setiap pengguna platform</p></div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="openInviteUserForm()">+ Tambah User</button>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      ${Object.entries(ROLES).map(([k,r])=>`
        <div style="padding:5px 10px;background:#fff;border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;gap:6px">
          <div style="width:8px;height:8px;border-radius:2px;background:${r.color}"></div>
          <span style="font-size:11px;font-weight:600;color:var(--navy)">${r.label}</span>
          <span style="font-size:10px;color:var(--gray)">— ${r.desc}</span>
        </div>`).join('')}
    </div>
    <div class="table-wrap">
      <div id="users-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await loadUsers();
}

async function loadUsers() {
  try {
    const [users, employees] = await Promise.all([
      sbGet('user_profiles','select=*&order=created_at.asc'),
      sbGet('employees','select=id,full_name,email,position,division&status=eq.Aktif').catch(()=>[]),
    ]);
    const userList = Array.isArray(users) ? users : [];
    const empList  = Array.isArray(employees) ? employees : [];

    // Client-side auto-match by email for any user not yet linked
    // (covers users created/logged-in after the SQL migration ran)
    const autoMatchPromises = userList
      .filter(u => !u.employee_id && u.email)
      .map(async u => {
        const match = empList.find(e => e.email && e.email.trim().toLowerCase() === u.email.trim().toLowerCase());
        if (match) {
          try {
            await sbPatch('user_profiles', u.id, { employee_id: match.id, updated_at: new Date().toISOString() });
            u.employee_id = match.id;
          } catch(e) { /* non-fatal, will retry next load */ }
        }
      });
    await Promise.all(autoMatchPromises);

    renderUsersTable(userList, empList);
  } catch(e) {
    document.getElementById('users-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderUsersTable(users, employees=[]) {
  const el = document.getElementById('users-tbody');
  if (!users.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ico">👤</div><h3>Belum ada user</h3>
        <p>User muncul di sini setelah login pertama kali.</p>
      </div>`; return;
  }
  el.innerHTML = `
    <table><thead><tr>
      <th>User</th><th>Jabatan / Divisi</th><th>Role</th><th>Akses Menu</th><th>No. HP</th><th>Terdaftar</th><th>Aksi</th>
    </tr></thead><tbody>
    ${users.map(u => {
      const role = u.role||'sales';
      const rc   = ROLES[role]||ROLES.sales;
      const isMe = u.id === window.currentUser?.id;
      const linkedEmp = u.employee_id ? employees.find(e=>e.id===u.employee_id) : null;
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;border-radius:50%;background:${rc.color};color:#fff;
              display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">
              ${(u.full_name||'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--navy)">
                ${u.full_name||'—'}
                ${isMe?'<span style="font-size:10px;color:var(--teal);margin-left:4px">(Saya)</span>':''}
              </div>
              <div style="font-size:10.5px;color:var(--text3)">${u.email||''}</div>
            </div>
          </div>
        </td>
        <td>
          ${linkedEmp ? `
            <div style="font-size:12px;font-weight:600">${linkedEmp.position||'—'}</div>
            <div style="font-size:10.5px;color:var(--text3)">${linkedEmp.division||''}</div>
            <div style="font-size:9.5px;color:var(--teal);margin-top:2px">🔗 ${linkedEmp.full_name}</div>
          ` : `
            <div style="font-size:11px;color:var(--text3);font-style:italic;margin-bottom:3px">Belum terhubung</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <button class="btn btn-xs btn-ghost" style="padding:1px 7px"
                onclick="openLinkEmployeeForm('${u.id}','${(u.full_name||'').replace(/'/g,"\\'")}')">
                🔗 Hubungkan
              </button>
              <button class="btn btn-xs" style="padding:1px 7px;background:var(--teal-light);color:var(--teal);border:1px solid var(--teal)"
                onclick="jadikanKaryawan('${u.id}','${(u.full_name||'').replace(/'/g,"\\'")}','${u.email||''}','${u.phone||''}')">
                + Jadikan Karyawan
              </button>
            </div>
          `}
        </td>
        <td>
          <span style="background:${rc.color}20;color:${rc.color};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">
            ${rc.label}
          </span>
        </td>
        <td style="font-size:11px;color:var(--text3)">
          ${(()=>{ 
            const custom = localStorage.getItem('ol_user_pages_'+u.id);
            if (custom) { try { const p=JSON.parse(custom); return `<span style="color:var(--teal);font-weight:700">${p.length} menu (custom)</span>`; } catch(e){} }
            const def = ROLE_DEFAULT_PAGES[u.role||'sales']||[];
            return `${def.length} menu (default)`;
          })()}
        </td>
        <td style="font-size:12px;color:var(--gray)">${u.phone||'—'}</td>
        <td style="font-size:11px;color:var(--gray)">
          ${u.created_at?new Date(u.created_at).toLocaleDateString('id-ID'):'—'}
        </td>
        <td>
          <button class="act-btn edit"
            onclick="openEditUserRole('${u.id}','${(u.full_name||'').replace(/'/g,"\\'")}','${role}')">
            ✏️ Role
          </button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

function openEditUserRole(userId, userName, currentRole) {
  const customPages = getRolePages(currentRole);
  const groups = {};
  Object.entries(ALL_PAGES).forEach(([key,[grp,label,icon]]) => {
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push({key, label, icon, checked: customPages.includes(key)});
  });

  openModal(`
    <div class="modal-header">
      <div class="modal-title">✏️ Akses & Role — ${userName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <!-- Role selector -->
    <div class="form-group">
      <label>Role / Jabatan</label>
      <select id="ur-role" onchange="onRoleChange(this.value,'${userId}')">
        ${Object.entries(ROLES).map(([k,r])=>`
          <option value="${k}" ${k===currentRole?'selected':''}>${r.label} — ${r.desc}</option>`).join('')}
      </select>
    </div>

    <!-- Permission summary -->
    <div id="ur-perm-summary" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px 12px;background:var(--bg2);border-radius:var(--r)">
    </div>

    <!-- Menu access config -->
    <div style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;margin-bottom:4px">
      <div style="background:var(--navy);color:#fff;padding:8px 14px;font-size:12px;font-weight:700;
        display:flex;align-items:center;justify-content:space-between">
        <span>📋 Akses Menu</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-xs" style="background:rgba(255,255,255,.15);color:#fff;border:none"
            onclick="selectAllMenus(true)">Pilih Semua</button>
          <button class="btn btn-xs" style="background:rgba(255,255,255,.15);color:#fff;border:none"
            onclick="selectAllMenus(false)">Reset</button>
        </div>
      </div>
      <div style="max-height:320px;overflow-y:auto;padding:12px 14px">
        ${Object.entries(groups).map(([grp, items]) => `
          <div style="margin-bottom:12px">
            <div style="font-size:10.5px;font-weight:800;color:var(--text3);text-transform:uppercase;
              letter-spacing:.06em;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">
              ${grp}
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:4px">
              ${items.map(p => `
                <label style="display:flex;align-items:center;gap:6px;padding:5px 8px;
                  border-radius:6px;cursor:pointer;transition:background .1s;font-size:12px;
                  background:${p.checked?'var(--teal-light)':'transparent'}"
                  onmouseover="this.style.background='var(--bg2)'"
                  onmouseout="this.style.background='${p.checked?'var(--teal-light)':'transparent'}'"
                  id="menu-lbl-${p.key}">
                  <input type="checkbox" id="menu-${p.key}" value="${p.key}" ${p.checked?'checked':''}
                    onchange="onMenuCheck('${p.key}',this.checked)"
                    style="width:14px;height:14px;accent-color:var(--teal)">
                  <span>${p.icon} ${p.label}</span>
                </label>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-outline btn-sm" onclick="resetToRoleDefault('${currentRole}')">↺ Default Role</button>
      <button class="btn btn-teal" onclick="saveUserRoleAndMenu('${userId}','${userName}')">💾 Simpan</button>
    </div>`, 'wide');

  updatePermSummary(currentRole);
}

function onRoleChange(role, userId) {
  // Update checkboxes to role default
  const pages = ROLE_DEFAULT_PAGES[role] || Object.keys(ALL_PAGES);
  Object.keys(ALL_PAGES).forEach(key => {
    const cb  = document.getElementById('menu-'+key);
    const lbl = document.getElementById('menu-lbl-'+key);
    if (cb) cb.checked = pages.includes(key);
    if (lbl) lbl.style.background = pages.includes(key) ? 'var(--teal-light)' : 'transparent';
  });
  updatePermSummary(role);
}

function onMenuCheck(key, checked) {
  const lbl = document.getElementById('menu-lbl-'+key);
  if (lbl) lbl.style.background = checked ? 'var(--teal-light)' : 'transparent';
}

function selectAllMenus(val) {
  Object.keys(ALL_PAGES).forEach(key => {
    const cb  = document.getElementById('menu-'+key);
    const lbl = document.getElementById('menu-lbl-'+key);
    if (cb) cb.checked = val;
    if (lbl) lbl.style.background = val ? 'var(--teal-light)' : 'transparent';
  });
}

function resetToRoleDefault(role) {
  onRoleChange(role, null);
  toast('↺ Reset ke default role','info',1500);
}

function updatePermSummary(role) {
  const rc = ROLES[role]||ROLES.sales;
  const el = document.getElementById('ur-perm-summary'); if (!el) return;
  const perms = [
    [rc.canDelete,       '🗑 Hapus data'],
    [rc.canBulkDelete,   '🗑 Bulk delete'],
    [rc.canExport,       '📥 Export CSV'],
    [rc.canManageUsers,  '👤 Kelola user'],
    [rc.canApproveLogbook,'✅ Approve logbook'],
    [rc.canAssignTask,   '📋 Assign task'],
    [rc.canSeeTeamBoard, '👥 Team board'],
  ];
  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:6px;width:100%">
      Permissions untuk <span style="color:${rc.color||'var(--teal)'}">● ${rc.label}</span>:
    </div>
    ${perms.map(([can,label])=>`
      <span style="font-size:11px;padding:3px 8px;border-radius:6px;font-weight:600;
        background:${can?'#DCFCE7':'#FEF2F2'};color:${can?'#15803D':'#DC2626'}">
        ${can?'✓':'✗'} ${label}
      </span>`).join('')}`;
}

async function saveUserRoleAndMenu(userId, userName) {
  const role = document.getElementById('ur-role')?.value;
  if (!role) return;
  // Collect selected pages
  const selectedPages = [];
  Object.keys(ALL_PAGES).forEach(key => {
    if (document.getElementById('menu-'+key)?.checked) selectedPages.push(key);
  });
  try {
    await sbPatch('user_profiles', userId, {
      role, updated_at: new Date().toISOString()
    });
    // Save custom menu to localStorage (keyed by userId for per-user override)
    const isCustom = JSON.stringify(selectedPages.sort()) !== 
                     JSON.stringify((ROLE_DEFAULT_PAGES[role]||[]).sort());
    if (isCustom) {
      saveRolePages(role+'_'+userId, selectedPages);
      // Also store per-user
      localStorage.setItem('ol_user_pages_'+userId, JSON.stringify(selectedPages));
    } else {
      localStorage.removeItem('ol_role_pages_'+role+'_'+userId);
      localStorage.removeItem('ol_user_pages_'+userId);
    }
    toast(`✅ Role & akses menu ${userName} disimpan`,'ok');
    closeModalForce();
    await loadUsers();
    // If editing self, reapply menu
    if (userId === window.currentUser?.id) {
      applyRoleMenu();
    }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// saveUserRole merged into saveUserRoleAndMenu


function openInviteUserForm() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">➕ Tambah User Profile</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="background:#FFF8E1;border-radius:8px;padding:10px 12px;font-size:12px;color:#5D4037;margin-bottom:12px">
      ℹ️ User mendaftar sendiri di halaman login. Setelah login pertama, role diatur di sini.
    </div>
    <div class="form-group">
      <label>Nama Lengkap *</label>
      <input type="text" id="inv-name" placeholder="Nama karyawan">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Role</label>
        <select id="inv-role">
          ${Object.entries(ROLES).map(([k,r])=>`
            <option value="${k}" ${k==='sales'?'selected':''}>${r.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>No. HP / WA</label>
        <input type="text" id="inv-phone" placeholder="08xxxxxxxxxx">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="createUserProfile()">➕ Simpan</button>
    </div>`);
}

async function createUserProfile() {
  const name  = document.getElementById('inv-name').value.trim();
  const role  = document.getElementById('inv-role').value;
  const phone = document.getElementById('inv-phone').value.trim();
  if (!name) { toast('Nama wajib diisi','err'); return; }
  try {
    await sbPost('user_profiles', {
      full_name:name, role, phone,
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    });
    toast('✅ User profile dibuat','ok');
    closeModalForce();
    await loadUsers();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// MANUAL LINK — User Management ↔ Data SDM
// ══════════════════════════════════════════════════════════════
async function openLinkEmployeeForm(userId, userName) {
  const employees = await sbGet('employees',
    'select=id,full_name,position,division,email&status=eq.Aktif&order=full_name').catch(()=>[]);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">🔗 Hubungkan ke Data Karyawan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px">
      Hubungkan akun login <strong>${userName}</strong> ke data karyawan yang sesuai di Data SDM.
      Setelah terhubung, Jabatan &amp; Divisi akan otomatis tampil di User Management.
    </div>
    <div class="form-group">
      <label>Pilih Karyawan</label>
      <select id="link-emp-select">
        <option value="">-- Pilih Karyawan --</option>
        ${employees.map(e=>`<option value="${e.id}">${e.full_name} — ${e.position||'—'} (${e.division||'—'})</option>`).join('')}
      </select>
      <div class="form-hint">${employees.length===0?'Belum ada data karyawan aktif. Tambahkan dulu di menu Data Karyawan.':`${employees.length} karyawan aktif tersedia.`}</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveLinkEmployee('${userId}')">🔗 Hubungkan</button>
    </div>`, 'narrow');
}

async function saveLinkEmployee(userId) {
  const empId = document.getElementById('link-emp-select')?.value;
  if (!empId) { toast('Pilih karyawan dulu','err'); return; }
  try {
    await sbPatch('user_profiles', userId, {
      employee_id: parseInt(empId),
      updated_at:  new Date().toISOString(),
    });
    toast('✅ Berhasil dihubungkan ke Data SDM','ok');
    closeModalForce();
    await loadUsers();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// JADIKAN KARYAWAN — auto-create row Data SDM dari user existing
// ══════════════════════════════════════════════════════════════
async function jadikanKaryawan(userId, userName, userEmail, userPhone) {
  if (!confirm(`Buat data karyawan baru untuk "${userName}" dan langsung hubungkan?\n\nData akan terisi: Nama, Email, No. HP dari akun ini.\nJabatan & Divisi bisa dilengkapi setelahnya di Data SDM.`)) return;
  try {
    const created = await sbPost('employees', {
      full_name:   userName,
      email:       userEmail || null,
      phone:       userPhone || null,
      status:      'Aktif',
      join_date:   new Date().toISOString().split('T')[0],
      created_by_name: getUserName ? getUserName() : 'System',
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    });
    const newEmpId = created?.[0]?.id || created?.id;
    if (!newEmpId) throw new Error('Gagal mendapatkan ID karyawan baru');

    await sbPatch('user_profiles', userId, {
      employee_id: newEmpId,
      updated_at:  new Date().toISOString(),
    });

    toast(`✅ Data karyawan untuk "${userName}" dibuat dan terhubung. Lengkapi Jabatan & Divisi di Data SDM.`,'ok',5000);
    await loadUsers();
  } catch(e) { toast('❌ '+e.message,'err'); }
}
