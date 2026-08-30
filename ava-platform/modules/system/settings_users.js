// ═══════════════════════════════════════════
// MODULE: User Management & Role/Permission v4
// Per-role menu access + granular permissions
// ═══════════════════════════════════════════

// ── Semua page yang ada di sistem ─────────
const ALL_PAGES = {
  // key: [group, label, icon]
  'dashboard':        ['Utama',           'Dashboard',           '🏠'],
  'ops-kendali':      ['Utama',           'Pusat Kendali Ops',   '⚡'],
  'executive-dashboard':['Utama',         'CEO Master Cockpit',  '👑'],
  'holding-finance':  ['Utama',           'Konsolidasi Finansial','🏛️'],
  
  // Administrasi & Legal
  'administration':   ['Administrasi',    'Administrasi Umum',   '📋'],
  'compliance-tracker':['Administrasi',   'Compliance & Legal Tracker','🛡️'],
  'partners':         ['Administrasi',    'Database Rekanan & Vendor','💼'],
  'mou':              ['Administrasi',    'Arsip MOU & Kontrak', '📜'],
  'penawaran':        ['Administrasi',    'Penawaran & Surat Keluar','📄'],
  'surat':            ['Administrasi',    'Surat Keluar',        '📄'],

  // Marketing & Growth
  'leads':            ['Marketing',       'Leads & Pipeline CRM','🎯'],
  'campaigns':        ['Marketing',       'Campaign & Promo Voucher','✨'],
  'content-engine':   ['Marketing',       'AI Content & SEO Writer','✍️'],
  'marketing':        ['Marketing',       'Marketing & Voucher', '📣'],
  'okr':              ['Marketing',       'OKR & Target Sales',  '📈'],
  'maps':             ['Marketing',       'Maps Prospecting',    '🗺️'],
  'crm-tv':           ['Marketing',       'CRM Live Display TV', '📺'],

  // Operasional Lab (Pilar 1)
  'lab-checkin':      ['Operasional Lab',  'Check In Sampel',    '🧪'],
  'lab-result':       ['Operasional Lab',  'Enter Result',       '📝'],
  'lab-validation':   ['Operasional Lab',  'Validasi Hasil',     '✅'],
  'lab-approval':     ['Operasional Lab',  'Approval Lab',       '🔏'],
  'lab-qc':           ['Operasional Lab',  'Smart QC Westgard',  '📊'],
  'lab-tat':          ['Operasional Lab',  'TAT Lab Monitoring', '⏱️'],
  'referral':         ['Operasional Lab',  'Rujukan Lab Rekanan','🚚'],
  'catalog-export':   ['Operasional Lab',  'Master Catalog LOINC','📗'],
  'lab-report':       ['Operasional Lab',  'Arsip Rekam Medis Lab','📁'],
  'medrecord':        ['Operasional Lab',  'Medical Record',     '📁'],

  // Layanan Klinik (Pilar 2)
  'admission':        ['Layanan Klinik',   'Admisi Pasien',      '🏨'],
  'emr-soap':         ['Layanan Klinik',   'EMR SOAP & CPPT',    '📋'],
  'farmasi':          ['Layanan Klinik',   'Farmasi & E-Resep',  '💊'],
  'pacs-viewer':      ['Layanan Klinik',   'PACS DICOM Imaging', '🫁'],
  'queue':            ['Layanan Klinik',   'Antrian Poliklinik', '📢'],
  'queue-kiosk':      ['Layanan Klinik',   'Kiosk Mandiri',      '🖥️'],
  'appointments':     ['Layanan Klinik',   'Jadwal Dokter',      '📅'],
  'inpatient':        ['Layanan Klinik',   'Rawat Inap',         '🛏️'],
  'bpjs-claim':       ['Layanan Klinik',   'Klaim BPJS & INA-CBG','🧾'],
  'satusehat':        ['Layanan Klinik',   'SATUSEHAT FHIR Bridge','🏛️'],
  'radiology':        ['Layanan Klinik',   'Radiology',          '🫁'],
  'supportive':       ['Layanan Klinik',   'Supportive/EKG',     '❤️'],
  'package':          ['Layanan Klinik',   'Package Service',    '🗂️'],

  // Home Care (Pilar 3)
  'homecare':         ['Home Care',        'Order Home Care',    '🏠'],
  'hc-schedule':      ['Home Care',        'Jadwal Nakes & GPS', '📅'],
  'hc-billing':       ['Home Care',        'Billing Fee Nakes',  '💳'],
  'hc-staff':         ['Home Care',        'Master Nakes & STR', '🧑‍⚕️'],
  'hc-tariff':        ['Home Care',        'Master Tarif Zonasi','🏷️'],
  'hc-report':        ['Home Care',        'Report CSAT Home Care','📊'],

  // Nutrisi & FMCG D2C (Pilar 4)
  'ecommerce-oms':    ['FMCG & D2C',       'Pesanan Multi-Channel D2C','📦'],
  'ecommerce-oms-apotek':['FMCG & D2C',    'Konsinyasi Apotek',  '🏥'],
  'ecommerce-oms-batch':['FMCG & D2C',     'Batch & Stok FEFO',  '🔍'],
  'ecommerce-oms-shipping':['FMCG & D2C',  'Ekspedisi & Label Resi','🚚'],
  'subscription':     ['FMCG & D2C',       'Auto-Refill Member', '🔄'],
  'ecommerce-oms-analytics':['FMCG & D2C', 'Analitik Omzet FMCG','📈'],

  // Sanctuary Spa (Pilar 5)
  'sanctuary':        ['Sanctuary',        'Sanctuary Wellness', '👑'],
  'sanctuary-booking':['Sanctuary',        'Reservasi Treatment','📅'],
  'sanctuary-members':['Sanctuary',        'Member VIP & Saldo Sesi','💎'],
  'sanctuary-rooms':  ['Sanctuary',        'Okupansi Private Suite','🚪'],
  'sanctuary-menu':   ['Sanctuary',        'Katalog Terapi Wanita','🌸'],

  // Korporat & B2B (Pilar 6)
  'corporate':        ['Korporat B2B',     'Layanan Korporat',   '🏢'],
  'mcu':              ['Korporat B2B',     'Project MCU Massal', '💼'],

  // Finance & Billing
  'cashier':          ['Finance',          'Cashier POS',        '🏧'],
  'cashier-shift':    ['Finance',          'Shift Kasir',        '⏰'],
  'finance':          ['Finance',          'Invoice & Tagihan',  '💳'],
  'finance-ar':       ['Finance',          'Tagihan AR',         '📑'],
  'finance-comm':     ['Finance',          'Komisi Sales',       '🏆'],
  'finance-report':   ['Finance',          'Laporan Keuangan P&L','📊'],
  'ar-aging':         ['Finance',          'Umur Piutang AR',    '📅'],
  'accounting':       ['Finance',          'Buku Besar Akuntansi','📖'],
  'payables':         ['Finance',          'Hutang Usaha AP',    '🧾'],
  'assets':           ['Finance',          'Aset & Kalibrasi',   '🔧'],

  // Inventory & Logistik
  'inventory':        ['Inventory',        'Stock & Reagen',     '📦'],
  'inventory-issue':  ['Inventory',        'Pengeluaran Barang', '📤'],
  'inventory-opname': ['Inventory',        'Stock Opname',       '📋'],
  'inventory-ledger': ['Inventory',        'Kartu Stok',         '📜'],
  'inventory-recipe': ['Inventory',        'Resep BHP per Tes',  '🧪'],
  'inventory-pr':     ['Inventory',        'Purchase Request',   '🛒'],
  'inventory-po':     ['Inventory',        'Purchase Order',     '📄'],
  'inventory-supplier':['Inventory',       'Master Supplier',    '🏭'],
  'inventory-mrp':    ['Inventory',        'Perencanaan MRP',    '📈'],
  'inventory-report': ['Inventory',        'Laporan Stok Logistik','📊'],

  // HRD & SDM
  'hrd':              ['HRD',              'Data Karyawan',      '👥'],
  'org-structure':    ['HRD',              'Struktur Organisasi','🌳'],
  'work-schedule':    ['HRD',              'Jadwal Kerja',       '📅'],
  'shift-calendar':   ['HRD',              'Kalender Shift',     '📆'],
  'attendance':       ['HRD',              'Presensi GPS & Hadir','⏰'],
  'hrd-cuti':         ['HRD',              'Cuti & Izin',        '🕐'],
  'hrd-payroll':      ['HRD',              'Penggajian Payroll', '💵'],

  // AI & Tech
  'agentic':          ['AI & Tech',        'Agentic AI Suite',   '🤖'],
  'tech':             ['AI & Tech',        'Tech SaaS Engine',   '💻'],
  'license-manager':  ['AI & Tech',        'Lisensi SaaS Multi-Tenant','🔑'],

  // Konfigurasi & Pengaturan
  'settings':         ['Konfigurasi',      'Pengaturan Sistem',  '⚙️'],
  'users':            ['Konfigurasi',      'User Management RBAC','👤'],
  'audit':            ['Konfigurasi',      'Jejak Audit Trail',  '🔍'],
  'product':          ['Konfigurasi',      'Master Product',     '🧬'],
  'import':           ['Konfigurasi',      'Import Data Excel',  '📥'],
  'tasks':            ['Produktivitas',    'Task Management',    '✅'],
  'regulatory':       ['Produktivitas',    'Pelaporan & Audit',  '📊'],
};

// ── Default pages per role (page keys) ────
const ROLE_DEFAULT_PAGES = {
  super_admin:    Object.keys(ALL_PAGES),
  head_operation: Object.keys(ALL_PAGES), // Otoritas penuh: Marketing, Agentic AI, Prosedur SOP, Holding Cockpit
  direktur:       Object.keys(ALL_PAGES),
  manager:        Object.keys(ALL_PAGES).filter(p=>!['users','lisensi','agentic-orchestrator','agentic-mcp'].includes(p)),
  spv:            Object.keys(ALL_PAGES).filter(p=>!['users','lisensi','agentic','agentic-orchestrator','agentic-mcp','holding-finance','executive-dashboard'].includes(p)),
  sales:          ['dashboard','partners','maps','leads','mcu','surat','penawaran','tasks'],
  operasional:    ['dashboard','lab-checkin','lab-result','lab-validation','lab-approval','medrecord','admission','radiology','supportive','homecare','hc-schedule','hc-billing','hc-report','inventory','inventory-pr','tasks'],
  hrd_staff:      ['dashboard','hrd','org-structure','work-schedule','attendance','hrd-cuti','hrd-payroll','tasks'],
  finance_staff:  ['dashboard','cashier','finance','finance-ar','finance-comm','finance-report','accounting','payables','tasks','regulatory'],
  patient:        ['ava-portals','ava-consult','ava-devices','ava-marketplace','ava-caregiver'],
  dokter:         ['ava-portals','ava-consult','ava-devices','medrecord','emr-soap','farmasi'],
  vendor:         ['ava-portals','ava-calibration','ava-marketplace'],
  viewer:         ['dashboard'],
};

const ROLES = {
  head_operation: {
    label:'Head of Operations (Ace Anwar)', color:'#D4AF37',
    desc:'Master Orchestration: Marketing B2B, Agentic AI Suite, Prosedur SOP QMS & Holding Cockpit',
    pages: ROLE_DEFAULT_PAGES.head_operation,
    canDelete:true, canBulkDelete:true, canExport:true, canManageUsers:true,
    canApproveLogbook:true, canAssignTask:true, canSeeTeamBoard:true,
  },
  super_admin: {
    label:'Super Admin', color:'#7B1FA2',
    desc:'Akses penuh semua modul + kelola user',
    pages: ROLE_DEFAULT_PAGES.super_admin,
    canDelete:true, canBulkDelete:true, canExport:true, canManageUsers:true,
    canApproveLogbook:true, canAssignTask:true, canSeeTeamBoard:true,
  },
  patient: {
    label:'Pasien / Customer (Registrasi Mandiri)', color:'#10B981',
    desc:'Portal pasien: konsultasi online, telemetri alkes rumah, toko alkes, caregiver alert',
    pages: ROLE_DEFAULT_PAGES.patient,
    canDelete:false, canBulkDelete:false, canExport:false, canManageUsers:false,
  },
  dokter: {
    label:'Dokter Telehealth', color:'#0EA5E9',
    desc:'Portal dokter: antrian konsultasi, e-resep, review telemetri, klaim fee',
    pages: ROLE_DEFAULT_PAGES.dokter,
    canDelete:false, canBulkDelete:false, canExport:true, canManageUsers:false,
  },
  vendor: {
    label:'Vendor Alkes / Lab Kalibrasi', color:'#F59E0B',
    desc:'Portal vendor: upload alkes, sertifikat kalibrasi, badge AVA Verified',
    pages: ROLE_DEFAULT_PAGES.vendor,
    canDelete:false, canBulkDelete:false, canExport:false, canManageUsers:false,
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
// Ambil izin & halaman milik sesi dari SERVER. Dipanggil sekali saat boot,
// sebelum applyRoleMenu(). Hasilnya disimpan di window.serverAccess.
//
// Sebelumnya daftar halaman dibaca dari localStorage ('ol_user_pages_<id>'),
// yang bisa ditulis ulang siapa pun lewat DevTools untuk membuka seluruh
// modul. Sumbernya kini matriks di basis data.
async function loadServerAccess() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/permissions`, { headers: { ...SB_HEADERS } });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d || !Array.isArray(d.permissions)) return null;
    window.serverAccess = d;
    return d;
  } catch (e) { return null; }
}

// Pemeriksaan izin untuk dipakai modul: can('data.delete').
// Ini hanya untuk MENYEMBUNYIKAN kendali di antarmuka — penjaga sesungguhnya
// ada di server. Jangan pernah menjadikan ini satu-satunya penghalang.
function can(izin) {
  const sa = window.serverAccess;
  if (sa && Array.isArray(sa.permissions)) return sa.permissions.includes(izin);
  // Cadangan saat endpoint tidak tersedia (deployment lama): matriks bawaan.
  const rc = ROLES[getUserRole ? getUserRole() : 'viewer'] || ROLES.viewer;
  const peta = {
    'data.delete': 'canDelete', 'data.bulk_delete': 'canBulkDelete',
    'data.export': 'canExport', 'user.manage': 'canManageUsers',
    'logbook.approve': 'canApproveLogbook', 'task.assign': 'canAssignTask',
    'team.board.view': 'canSeeTeamBoard',
  };
  return !!rc[peta[izin]];
}

function applyRoleMenu() {
  const role   = getUserRole ? getUserRole() : 'sales';
  const rc     = ROLES[role] || ROLES.sales;

  // Urutan sumber: 1) server (tepercaya), 2) matriks bawaan di berkas ini.
  // localStorage TIDAK lagi dipakai sebagai sumber hak akses.
  const sa = window.serverAccess;
  const allowedPages = (sa && Array.isArray(sa.pages) && sa.pages.length)
    ? sa.pages
    : getRolePages(role);

  window.roleConfig = {
    ...rc,
    pages:        allowedPages,
    sumber:       (sa && sa.pages && sa.pages.length) ? 'server' : 'bawaan',
    isSpv:        ['super_admin','spv','manager','direktur'].includes(role),
    isManager:    ['super_admin','manager','direktur'].includes(role),
    isSuperAdmin: role === 'super_admin' || role === 'head_operation',
    isHeadOp:     role === 'head_operation' || role === 'super_admin',
  };

  // Note: menu visibility now handled by openFlyout() reading window.roleConfig.pages
  // (old .nav-item DOM elements no longer exist — replaced by rail + flyout panel)

  // Hide rail category icons entirely if NONE of their pages are allowed
  const isPrivileged = ['super_admin', 'head_operation', 'direktur'].includes(role);
  if (!isPrivileged && typeof FLYOUT_MENUS !== 'undefined') {
    document.querySelectorAll('.rail-item[data-cat]').forEach(btn => {
      const cat  = btn.getAttribute('data-cat');
      const menu = FLYOUT_MENUS[cat];
      if (!menu) return;

      // Restriksi Ketat: Agentic AI, Wiki/Prosedur SOP & Marketing Strategis hanya untuk Head of Operations
      if (['agentic', 'wiki', 'marketing'].includes(cat)) {
        btn.style.display = 'none';
        return;
      }

      const hasAnyAccess = menu.items.some(item =>
        item.soon || allowedPages.includes(item.page) ||
        (item.adminOnly && ['manager','direktur','head_operation','super_admin'].includes(role))
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
async function renderUsers(targetId = 'main-content') {
  if (getUserRole() !== 'super_admin') {
    document.getElementById(targetId).innerHTML = `
      <div class="empty-state" style="min-height:60vh">
        <div class="ico"></div><h3>Akses Ditolak</h3>
        <p>Hanya Super Admin yang bisa mengelola user.</p>
      </div>`; return;
  }

  const isSettingsSub = targetId !== 'main-content';

  const headerHtml = isSettingsSub ? `
    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <h2 style="font-size:16px; font-weight:800; color:var(--navy)">👥 User Management</h2>
        <p style="font-size:12px; color:var(--text3)">Kelola akun, role, dan hak akses semua pengguna platform</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-teal btn-sm" onclick="openInviteUserForm()">+ Tambah User</button>
      </div>
    </div>
  ` : `
    <div class="page-header">
      <div><h1>User Management</h1>
        <p>Kelola akses dan role setiap pengguna platform</p></div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="openInviteUserForm()">+ Tambah User</button>
      </div>
    </div>
  `;

  document.getElementById(targetId).innerHTML = `
    ${headerHtml}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      ${Object.entries(ROLES).map(([k,r])=>`
        <div style="padding:5px 10px;background:var(--white);border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;gap:6px">
          <div style="width:8px;height:8px;border-radius:2px;background:${r.color}"></div>
          <span style="font-size:11px;font-weight:600;color:var(--navy)">${r.label}</span>
          <span style="font-size:10px;color:var(--text3)">— ${r.desc}</span>
        </div>`).join('')}
    </div>
    <div class="table-wrap">
      <div id="users-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await loadUsers();
}

async function loadUsers() {
  try {
    const [users, employees, halamanKhusus] = await Promise.all([
      sbGet('user_profiles','select=*&order=created_at.asc'),
      sbGet('employees','select=id,full_name,email,position,division&status=eq.Aktif').catch(()=>[]),
      sbGet('user_pages','select=user_id,page').catch(()=>[]),
    ]);

    // Jumlah halaman khusus per pengguna, dibaca dari basis data (dulu dari
    // localStorage, yang hanya berlaku di peramban yang kebetulan dipakai).
    window._jumlahHalamanKhusus = {};
    (Array.isArray(halamanKhusus) ? halamanKhusus : []).forEach(r => {
      window._jumlahHalamanKhusus[r.user_id] = (window._jumlahHalamanKhusus[r.user_id] || 0) + 1;
    });
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
            <div style="width:34px;height:34px;border-radius:50%;background:${rc.color};color:var(--on-accent);
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
            <div style="font-size:9.5px;color:var(--teal);margin-top:2px">${linkedEmp.full_name}</div>
          ` : `
            <div style="font-size:11px;color:var(--text3);font-style:italic;margin-bottom:3px">Belum terhubung</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <button class="btn btn-xs btn-ghost" style="padding:1px 7px"
                onclick="openLinkEmployeeForm('${u.id}','${(u.full_name||'').replace(/'/g,"\\'")}')">
                Hubungkan
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
            const jml = (window._jumlahHalamanKhusus || {})[u.id];
            if (jml) return `<span style="color:var(--teal);font-weight:700">${jml} menu (custom)</span>`;
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
            Role
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
      <div class="modal-title">Akses & Role — ${userName}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
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
      <div style="background:var(--navy);color:var(--on-accent);padding:8px 14px;font-size:12px;font-weight:700;
        display:flex;align-items:center;justify-content:space-between">
        <span>Akses Menu</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-xs" style="background:rgba(255,255,255,.15);color:var(--on-accent);border:none"
            onclick="selectAllMenus(true)">Pilih Semua</button>
          <button class="btn btn-xs" style="background:rgba(255,255,255,.15);color:var(--on-accent);border:none"
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
      <button class="btn btn-teal" onclick="saveUserRoleAndMenu('${userId}','${userName}')">Simpan</button>
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
    [rc.canDelete,       'Hapus data'],
    [rc.canBulkDelete,   'Bulk delete'],
    [rc.canExport,       'Export CSV'],
    [rc.canManageUsers,  '👤 Kelola user'],
    [rc.canApproveLogbook,'✅ Approve logbook'],
    [rc.canAssignTask,   'Assign task'],
    [rc.canSeeTeamBoard, 'Team board'],
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
    // Halaman khusus pengguna disimpan di BASIS DATA (tabel user_pages),
    // bukan localStorage. localStorage bisa ditulis ulang lewat DevTools,
    // jadi tidak boleh menjadi sumber hak akses — dan sejak menu dibaca dari
    // server, penyimpanan di localStorage tidak berpengaruh apa pun.
    const isCustom = JSON.stringify([...selectedPages].sort()) !==
                     JSON.stringify([...(ROLE_DEFAULT_PAGES[role]||[])].sort());
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_pages?user_id=eq.${userId}`,
                  { method:'DELETE', headers: SB_HEADERS });
      if (isCustom && selectedPages.length) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/user_pages`, {
          method:'POST', headers: SB_HEADERS,
          body: JSON.stringify(selectedPages.map(p => ({ user_id: userId, page: p }))),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      // Bersihkan sisa penyimpanan lama agar tidak menyesatkan saat ditelusuri.
      localStorage.removeItem('ol_user_pages_'+userId);
      localStorage.removeItem('ol_role_pages_'+role+'_'+userId);
    } catch (e) {
      toast('Gagal menyimpan akses menu: ' + (e.message || e), 'err');
      return;
    }
    toast(`✅ Role & akses menu ${userName} disimpan`,'ok');
    closeModalForce();
    await loadUsers();
    // Bila menyunting diri sendiri, ambil ulang hak akses dari server dulu —
    // applyRoleMenu() kini membaca window.serverAccess, bukan localStorage.
    if (userId === window.currentUser?.id) {
      if (typeof loadServerAccess === 'function') await loadServerAccess();
      applyRoleMenu();
    }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// saveUserRole merged into saveUserRoleAndMenu


function openInviteUserForm() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">+ Tambah User Profile</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="background:var(--warn-soft2);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--ink-14);margin-bottom:12px">
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
      <button class="btn btn-teal" onclick="createUserProfile()">+ Simpan</button>
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
      <div class="modal-title">Hubungkan ke Data Karyawan</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
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
      <button class="btn btn-teal" onclick="saveLinkEmployee('${userId}')">Hubungkan</button>
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