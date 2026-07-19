// ═══════════════════════════════════════════
// MOBILE APPS - Logic & Multi-Role Datasets
// ═══════════════════════════════════════════

// --- MOCK DATASETS ---
const MOCK_CORPORATES = [
  { name: 'Ahmad Subarjo', id: 'EMP-001', test: 'Paket MCU Eksekutif A', status: 'fit', remark: 'Fit to Work &bull; Sehat', medrec: { cholesterol: 185, sugar: 95, uric: 5.4, notes: 'Semua marker normal. Kondisi fisik prima.' } },
  { name: 'Siti Rahma', id: 'EMP-002', test: 'Paket MCU Dasar', status: 'fit', remark: 'Fit to Work &bull; Sehat', medrec: { cholesterol: 192, sugar: 88, uric: 4.8, notes: 'Hasil pemeriksaan laboratorium berada dalam ambang batas normal.' } },
  { name: 'Bambang Wijaya', id: 'EMP-003', test: 'Paket MCU Driver', status: 'unfit', remark: 'Unfit / Review (Hipertensi Gr. II)', medrec: { cholesterol: 260, sugar: 142, uric: 8.2, notes: 'Peringatan: Kolesterol total tinggi dan indikasi prediabetes. Butuh pantauan tekanan darah rutin.' } },
  { name: 'Indah Permata', id: 'EMP-004', test: 'Paket MCU Dasar', status: 'pending', remark: 'Proses Analisa Lab', medrec: null },
  { name: 'Dedi Kurniawan', id: 'EMP-005', test: 'Paket MCU Eksekutif B', status: 'fit', remark: 'Fit to Work &bull; Sehat', medrec: { cholesterol: 175, sugar: 90, uric: 5.1, notes: 'Tubuh dalam kondisi ideal. Lanjutkan gaya hidup sehat.' } }
];

const MOCK_REFERRALS = [
  { name: 'Budi Santoso', phone: '08123456789', test: 'Darah Lengkap + Urinalisis', status: 'finished', fee: 150000, date: '19/07/2026' },
  { name: 'Rian Hidayat', phone: '08567890123', test: 'Profil Lipid + Asam Urat', status: 'waiting', fee: 100000, date: '19/07/2026' },
  { name: 'Citra Kirana', phone: '08789012345', test: 'HBsAg + Anti-HBs', status: 'finished', fee: 80000, date: '18/07/2026' }
];

// --- VIRTU STYLE LAB TEST ITEMS ---
const LAB_TEST_ITEMS = [
  { code: 'CHEM - CALCIUM', name: 'CHEM - CALCIUM', price: 149000, desc: 'Calcium blood is used to help screening, diagnosis, and monitor a state related to bone health.' },
  { code: 'CHEM - CREATININE', name: 'CHEM - CREATININE', price: 79000, desc: 'Creatinine is a garbage product from solving muscle cells during activities. A healthy kidney filters it.' },
  { code: 'CHEM - GLUCOSE FASTING', name: 'CHEM - GLUCOSE FASTING', price: 49000, desc: 'Glucose fasting checks can be done both for screening, DM diagnosis, or monitoring of treatment.' },
  { code: 'CHEM - HEMOGLOBIN A1C (HBA1C)', name: 'CHEM - HEMOGLOBIN A1C (HBA1C)', price: 209000, desc: 'The HBA1C examination measures the average number of Glucose bound to Hemoglobin over 3 months.' },
  { code: 'CHEM - CHOLESTEROL TOTAL', name: 'CHEM - CHOLESTEROL TOTAL', price: 79000, desc: 'Total cholesterol examination measures the concentration of all cholesterol fractions in blood.' },
  { code: 'CHEM - GAMMA-GLUTAMYL TRANSFERASE', name: 'CHEM - GAMMA-GLUTAMYL TRANSFERASE (GGT)', price: 139000, desc: 'Gamma Glutamyl Transferase (GGT) is the most sensitive marker for hepatobiliary diseases.' },
  { code: 'CHEM - GLUCOSE RANDOM', name: 'CHEM - GLUCOSE RANDOM', price: 49000, desc: 'Glucose random measures blood sugar level at any point of time without fasting constraint.' },
  { code: 'CHEM - HIGH DENSITY LIPOPROTEIN (HDL)', name: 'CHEM - HIGH DENSITY LIPOPROTEIN (HDL)', price: 99000, desc: 'HDL cholesterol examination measures the concentration of good cholesterol protective for heart.' }
];

// --- LIVE SUPABASE INTEGRATION STATES ---
let labTestsFromDB = [];
let packagesFromDB = [];
let branchesFromDB = [];

async function loadDataFromSupabase() {
  console.log("Loading live data from Supabase...");
  if (typeof sbGet !== 'function') {
    console.warn("sbGet is not loaded. Using fallback mocks.");
    return;
  }
  
  try {
    const prods = await sbGet('products', 'select=*&is_active=eq.true&order=kategori.asc,nama_tes.asc');
    if (Array.isArray(prods) && prods.length > 0) {
      labTestsFromDB = prods.map(p => ({
        code: p.kode_tes || p.nama_tes,
        name: p.nama_tes,
        price: p.harga_normal || 0,
        desc: p.deskripsi || 'Pemeriksaan laboratorium berkualitas tinggi.',
        category: p.kategori || 'Lainnya'
      }));
      console.log(`Loaded ${labTestsFromDB.length} lab tests from Supabase.`);
    }
  } catch (e) {
    console.warn("Gagal mengambil data produk dari Supabase:", e.message);
  }

  try {
    const pkgs = await sbGet('packages', 'select=*&is_active=eq.true&order=kategori_paket.asc,nama_paket.asc');
    if (Array.isArray(pkgs) && pkgs.length > 0) {
      packagesFromDB = pkgs;
      console.log(`Loaded ${packagesFromDB.length} packages from Supabase.`);
    }
  } catch (e) {
    console.warn("Gagal mengambil data paket dari Supabase:", e.message);
  }

  try {
    const brs = await sbGet('branches', 'select=*&is_active=eq.true&order=name.asc');
    if (Array.isArray(brs) && brs.length > 0) {
      branchesFromDB = brs;
      console.log(`Loaded ${branchesFromDB.length} branches from Supabase.`);
    }
  } catch (e) {
    console.warn("Gagal mengambil data cabang dari Supabase:", e.message);
  }

  updateUIWithDBData();
}

function updateUIWithDBData() {
  const btBranchSelect = document.getElementById('bt-branch-select');
  const hcBranch = document.getElementById('hc-branch');
  const nmRegion = document.getElementById('nm-branch-region');

  if (branchesFromDB.length > 0) {
    const optionsHtml = branchesFromDB.map(b => `<option value="${b.name}">${b.name.toUpperCase()}</option>`).join('');
    if (btBranchSelect) btBranchSelect.innerHTML = optionsHtml;
    if (hcBranch) hcBranch.innerHTML = optionsHtml;
    if (nmRegion) {
      nmRegion.innerHTML = branchesFromDB.map(b => `<option value="${b.name}">${b.name.toUpperCase()}</option>`).join('');
    }

    const nearMeContainer = document.querySelector('#nearme-view div[style="display:flex; flex-direction:column; gap:16px;"]');
    if (nearMeContainer) {
      nearMeContainer.innerHTML = branchesFromDB.map((b, index) => {
        const dist = 12 + index * 4;
        return `
          <div class="glass-card" style="padding:0; overflow:hidden; display:flex; flex-direction:row; align-items:stretch; border:1px solid var(--border);">
            <div style="width:220px; background:rgba(0,0,0,0.2); position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg viewBox="0 0 100 100" style="width:100%; height:100%; object-fit:cover;">
                <rect width="100" height="100" fill="#0f172a" />
                <path d="M 0 50 L 100 50 L 100 100 L 0 100 Z" fill="#1e293b" />
                <rect x="25" y="45" width="50" height="30" rx="3" fill="#0ea5e9" opacity="0.3" />
                <circle cx="50" cy="30" r="10" fill="#0d9488" opacity="0.4" />
                <text x="50" y="85" fill="#f8fafc" font-size="8" text-anchor="middle" font-weight="800">VIRTU DIGILAB</text>
              </svg>
            </div>
            <div style="padding:20px; flex:1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <h5 style="font-size:15px; font-weight:700; color:white;">${b.name.toUpperCase()}</h5>
                <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">${b.address || 'JL. RAYA UTAMA NO. 1'}</p>
                <div style="display:flex; gap:12px; margin-top:12px; align-items:center;">
                  <span style="font-size:12px; font-weight:700; color:var(--teal);">± ${dist} KM <small style="color:var(--text-muted);">From Destination</small></span>
                  <span class="badge badge-fit" style="font-size:9px; padding:2px 6px;">${b.is_active ? 'No Queue' : 'Offline'}</span>
                </div>
              </div>
              <div style="display:flex; gap:10px;">
                <button class="btn btn-sm" style="margin:0; background:rgba(255,255,255,0.03); color:white; border:1px solid var(--border); padding:8px 16px;">📍 Direction</button>
                <button class="btn btn-sm btn-teal" onclick="showView('book-test-view', 'Pesan Lab')" style="margin:0; padding:8px 16px;">Book Lab Test</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const packagesContainer = document.querySelector('#buy-package-view div[style="display:flex; flex-direction:column; gap:20px;"]');
  if (packagesContainer && packagesFromDB.length > 0) {
    const grouped = {};
    packagesFromDB.forEach(p => {
      const cat = p.kategori_paket || 'INDIVIDUAL';
      grouped[cat] = grouped[cat] || [];
      grouped[cat].push(p);
    });

    packagesContainer.innerHTML = Object.entries(grouped).map(([cat, pkgs]) => {
      const cleanCatId = cat.toLowerCase().replace(/\s+/g, '-');
      return `
        <div id="pkg-sec-${cleanCatId}">
          <div style="font-size:11px; font-weight:800; background:rgba(15,23,42,0.6); padding:6px 12px; border-radius:6px; width:fit-content; color:white; border:1px solid var(--border); margin-bottom:12px;">${cat.toUpperCase()}</div>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:14px;">
            ${pkgs.map(p => `
              <div class="glass-card" style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <h6 style="font-size:13px; font-weight:700; color:white;">${p.nama_paket}</h6>
                  <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">${p.deskripsi || '-'}</p>
                  <strong style="color:var(--teal); font-size:13px; display:block; margin-top:6px;">IDR ${p.harga_normal ? p.harga_normal.toLocaleString('en-US') : '0.00'}</strong>
                </div>
                <button class="btn btn-sm btn-teal" onclick="buyPackage('${p.nama_paket}')" style="margin:0; width:auto; padding:8px 12px;">🛒</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderLabCatalogue();
}

// --- APP RUNTIME STATE ---
let currentRole = 'patient';
let currentPhase = 'fase1';
let currentUsername = '';
let corporates = [...MOCK_CORPORATES];
let referrals = [...MOCK_REFERRALS];
let queueSimulatorInterval = null;
let currentCalledQueue = 40; // Counter queue starts at A-040
let bookingCart = []; // List of selected items

// Financial and Corporate Billing States
let corporateCashback = 4500000; // Rp 4.500.000
let referralWallet = 330000; // Rp 330.000
let selectedInvoiceId = null;
let invoices = [
  { id: 'INV-202607-001', name: 'MCU Tahunan Tahap 1', date: '19 Juli 2026', amount: 45000000, status: 'unpaid' },
  { id: 'INV-202606-024', name: 'MCU Karyawan Baru', date: '24 Juni 2026', amount: 12500000, status: 'paid' }
];

// Switch Screens (General routing: Login vs Dashboard)
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');

  // If dashboard is loaded, default to the right view
  if (screenId === 'dashboard-screen') {
    if (currentRole === 'patient') {
      showView('patient-view', 'Dashboard');
    } else if (currentRole === 'corporate') {
      showView('corporate-view', 'Corporate MCU');
    } else if (currentRole === 'referral') {
      showView('referral-view', 'Faskes Referral');
    }
  }
}

// Sub-view Routing (Sidebar clicks)
function showView(viewId, viewTitle) {
  // Hide all view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Display active panel
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');

  // Update Breadcrumb
  const breadcrumbActive = document.getElementById('breadcrumb-active-view');
  if (breadcrumbActive) breadcrumbActive.textContent = viewTitle;

  // Sync Active Sidebar Link
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const isTarget = link.getAttribute('onclick').includes(viewId) || 
                     (viewId === 'patient-view' && link.getAttribute('onclick').includes('patient-view'));
    link.classList.toggle('active', isTarget);
  });

  // Close sidebar drawer on mobile
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

// Switch Timeline Phase (Only applicable for Patient view)
function switchTimelinePhase(phaseId) {
  currentPhase = phaseId;

  // Sync tab active states
  document.querySelectorAll('.t-tab').forEach(btn => {
    btn.classList.toggle('active', btn.id === `btn-${phaseId}`);
  });

  // Hide all panels
  document.querySelectorAll('.phase-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Show active panel matching role + phase
  let prefix = 'p';
  if (currentRole === 'corporate') prefix = 'c';
  if (currentRole === 'referral') prefix = 'r';

  const targetPanel = document.getElementById(`${prefix}-${phaseId}-panel`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
}

// Toggle Sidebar on mobile
function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// Render dynamic menus inside sidebar based on logged-in role
function renderSidebarMenu() {
  const navContainer = document.getElementById('sidebar-nav');
  if (!navContainer) return;

  if (currentRole === 'patient') {
    navContainer.innerHTML = `
      <a class="sidebar-link active" onclick="showView('patient-view', 'Dashboard Utama')">📊 Dashboard Utama</a>
      <a class="sidebar-link" onclick="showView('medrec-view', 'Rekam Medis (EHR)')">🗂️ Rekam Medis (EHR)</a>
      <a class="sidebar-link" onclick="showView('book-test-view', 'Pesan Lab')">🧪 Book Lab Test</a>
      <a class="sidebar-link" onclick="showView('book-homecare-view', 'Book Home Care')">🏠 Book Home Care</a>
      <a class="sidebar-link" onclick="showView('buy-package-view', 'Beli Paket MCU')">📦 Buy Package</a>
      <a class="sidebar-link" onclick="showView('nearme-view', 'Cabang Terdekat')">📍 Virtu Near Me</a>
      <a class="sidebar-link" onclick="showView('profile-view', 'Profil Saya')">👤 My Profile</a>
    `;
  } else if (currentRole === 'corporate') {
    navContainer.innerHTML = `
      <a class="sidebar-link active" onclick="showView('corporate-view', 'Corporate MCU')">📊 Ringkasan Proyek</a>
      <a class="sidebar-link" onclick="openAddEmployeeModal()">➕ Tambah Karyawan</a>
      <a class="sidebar-link" onclick="openCorpBillingModal()">💳 Kelola Invoice</a>
      <a class="sidebar-link" onclick="openClaimCashbackModal()">💰 Klaim Cashback</a>
    `;
  } else if (currentRole === 'referral') {
    navContainer.innerHTML = `
      <a class="sidebar-link active" onclick="showView('referral-view', 'Faskes Referral')">📊 Riwayat Rujukan</a>
      <a class="sidebar-link" onclick="openReferralForm()">📋 Buat Rujukan Baru</a>
      <a class="sidebar-link" onclick="openWithdrawFeeModal()">💰 Tarik Komisi</a>
    `;
  }
}

// Switch EHR sub tabs (Lab, Radiology, Resume Medis)
function switchMedrecSubTab(tabName) {
  // Toggle active tab buttons
  document.querySelectorAll('.tab-btn-medrec').forEach(btn => {
    btn.classList.remove('active', 'btn-teal');
    btn.style.background = 'rgba(255, 255, 255, 0.05)';
    btn.style.color = 'white';
  });

  const activeBtn = document.getElementById(`tab-mr-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'btn-teal');
    activeBtn.style.background = '';
  }

  // Toggle sub panels
  document.querySelectorAll('.medrec-sub-panel').forEach(panel => {
    panel.classList.remove('active');
    panel.style.display = 'none';
  });

  const activePanel = document.getElementById(`mr-panel-${tabName}`);
  if (activePanel) {
    activePanel.classList.add('active');
    activePanel.style.display = 'block';
  }
}

// Switch Profile sub tabs
function switchProfileSubTab(tabName) {
  // Toggle buttons
  document.querySelectorAll('[id^="prof-subtab-"]').forEach(btn => {
    btn.classList.remove('active', 'btn-teal');
    btn.style.background = 'rgba(255, 255, 255, 0.03)';
    btn.style.color = 'white';
  });

  const activeBtn = document.getElementById(`prof-subtab-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'btn-teal');
    activeBtn.style.background = '';
  }

  // Toggle panels
  document.querySelectorAll('.profile-sub-panel').forEach(panel => {
    panel.classList.remove('active');
    panel.style.display = 'none';
  });

  const activePanel = document.getElementById(`prof-panel-${tabName}`);
  if (activePanel) {
    activePanel.classList.add('active');
    activePanel.style.display = 'block';
  }
}

// Filter Packages Category
function filterPackageCategory(cat) {
  // Toggle active btn
  document.querySelectorAll('[id^="pkg-cat-"]').forEach(btn => {
    btn.classList.remove('active', 'btn-teal');
    btn.style.background = 'rgba(255, 255, 255, 0.03)';
    btn.style.color = 'white';
  });

  const btnId = cat === 'ALL' ? 'pkg-cat-all' : cat === 'CORP' ? 'pkg-cat-corp' : cat === 'IND' ? 'pkg-cat-ind' : 'pkg-cat-sub';
  const activeBtn = document.getElementById(btnId);
  if (activeBtn) {
    activeBtn.classList.add('active', 'btn-teal');
    activeBtn.style.background = '';
  }

  // Show sections
  const corpSec = document.getElementById('pkg-sec-corp');
  const indSec = document.getElementById('pkg-sec-ind');

  if (cat === 'ALL') {
    if (corpSec) corpSec.style.display = 'block';
    if (indSec) indSec.style.display = 'block';
  } else if (cat === 'CORP') {
    if (corpSec) corpSec.style.display = 'block';
    if (indSec) indSec.style.display = 'none';
  } else if (cat === 'IND') {
    if (corpSec) corpSec.style.display = 'none';
    if (indSec) indSec.style.display = 'block';
  } else {
    // SUB
    if (corpSec) corpSec.style.display = 'none';
    if (indSec) indSec.style.display = 'none';
  }
}

// Radiology X-ray viewer overlay triggers
function openXrayViewer() {
  const modal = document.getElementById('xray-viewer-modal');
  if (modal) modal.classList.add('open');
}

function closeXrayViewer() {
  const modal = document.getElementById('xray-viewer-modal');
  if (modal) modal.classList.remove('open');
}

// --- HIGH-FIDELITY LAB CATALOGUE CART HANDLERS ---
function renderLabCatalogue(filterText = '') {
  const container = document.getElementById('bt-catalogue-grid');
  if (!container) return;

  const itemsList = labTestsFromDB.length > 0 ? labTestsFromDB : LAB_TEST_ITEMS;
  const query = filterText.toLowerCase();
  const filtered = itemsList.filter(item => 
    item.code.toLowerCase().includes(query) || 
    item.name.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">Tidak menemukan hasil pemeriksaan "${filterText}"</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const inCart = bookingCart.some(i => i.code === item.code);
    const btnText = inCart ? '✓ Selected' : '🛒 Add to Order';
    const btnClass = inCart ? 'btn-teal' : '';

    return `
      <div class="test-catalog-card">
        <div>
          <span style="font-family:monospace; font-size:10px; color:var(--primary); font-weight:700;">${item.code}</span>
          <h6 style="font-size:13px; font-weight:700; color:white; margin-top:4px; line-height:1.3;">${item.name}</h6>
          <p style="font-size:11px; color:var(--text-muted); margin-top:6px; line-height:1.4;">${item.desc}</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.03); padding-top:10px; margin-top:6px;">
          <strong style="color:var(--teal); font-size:13px;">IDR ${item.price.toLocaleString('en-US')}</strong>
          <button class="btn btn-sm ${btnClass}" onclick="toggleCartItem('${item.code}')" style="margin:0; width:auto; padding:6px 12px; font-size:11px;">${btnText}</button>
        </div>
      </div>
    `;
  }).join('');
}

function searchLabTest() {
  const query = document.getElementById('bt-search').value;
  renderLabCatalogue(query);
}

function toggleCartItem(code) {
  const itemsList = labTestsFromDB.length > 0 ? labTestsFromDB : LAB_TEST_ITEMS;
  const item = itemsList.find(i => i.code === code);
  if (!item) return;

  const idx = bookingCart.findIndex(i => i.code === code);
  if (idx > -1) {
    bookingCart.splice(idx, 1);
  } else {
    bookingCart.push(item);
  }

  // Sync catalog buttons
  renderLabCatalogue(document.getElementById('bt-search').value);
  
  // Re-calculate & update cart UIs
  updateCartUIs();
}

function updateCartUIs() {
  const btCartContainer = document.getElementById('bt-cart-items');
  const hcCartContainer = document.getElementById('hc-cart-items');

  const subtotalVal = bookingCart.reduce((sum, item) => sum + item.price, 0);
  const serviceFeeVal = bookingCart.length > 0 ? 15000 : 0;
  const grandTotalVal = subtotalVal + serviceFeeVal;

  // 1. Update Booking Lab Test Cart
  if (btCartContainer) {
    if (bookingCart.length === 0) {
      btCartContainer.innerHTML = `<span style="font-size:11px; color:var(--text-muted); text-align:center; padding:20px 0;">Belum ada pemeriksaan terpilih.</span>`;
    } else {
      btCartContainer.innerHTML = bookingCart.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:6px; padding:8px 10px; font-size:11px;">
          <div style="overflow:hidden; flex:1; margin-right:8px;">
            <h6 style="color:white; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</h6>
            <span style="color:var(--text-muted); font-size:9px;">IDR ${item.price.toLocaleString('en-US')}</span>
          </div>
          <button onclick="toggleCartItem('${item.code}')" style="background:none; border:none; color:var(--error); cursor:pointer; font-size:12px;">❌</button>
        </div>
      `).join('');
    }
  }

  // 2. Update Booking Home Care Cart
  if (hcCartContainer) {
    if (bookingCart.length === 0) {
      hcCartContainer.innerHTML = `<span style="font-size:11px; color:var(--text-muted); text-align:center; padding:12px 0;">Belum memilih pemeriksaan. Silakan pilih di menu lab test terlebih dahulu.</span>`;
    } else {
      hcCartContainer.innerHTML = bookingCart.map(item => `
        <div style="display:flex; justify-content:space-between; font-size:11px; color:white;">
          <span>${item.name}</span>
          <strong>IDR ${item.price.toLocaleString('en-US')}</strong>
        </div>
      `).join('');
    }
  }

  // Update prices labels in both views
  const btSub = document.getElementById('bt-subtotal');
  const btGrand = document.getElementById('bt-grand-total');
  if (btSub) btSub.textContent = `IDR ${subtotalVal.toLocaleString('en-US')}.00`;
  if (btGrand) btGrand.textContent = `IDR ${grandTotalVal.toLocaleString('en-US')}.00`;

  const hcSub = document.getElementById('hc-subtotal');
  const hcFee = document.getElementById('hc-service-fee');
  const hcGrand = document.getElementById('hc-grand-total');
  const hcPayBtn = document.getElementById('hc-pay-btn');

  if (hcSub) hcSub.textContent = `IDR ${subtotalVal.toLocaleString('en-US')}.00`;
  if (hcFee) hcFee.textContent = `IDR ${serviceFeeVal.toLocaleString('en-US')}.00`;
  if (hcGrand) hcGrand.textContent = `IDR ${grandTotalVal.toLocaleString('en-US')}.00`;
  if (hcPayBtn) hcPayBtn.textContent = `Pay IDR ${grandTotalVal.toLocaleString('en-US')}.00`;
}

function checkoutLabBooking() {
  if (bookingCart.length === 0) {
    alert('Keranjang belanja kosong. Pilih minimal 1 pemeriksaan!');
    return;
  }

  const branch = document.getElementById('bt-branch-select').value;
  const date = document.getElementById('bt-date').value;

  // Show antrean ticket on dashboard
  const ticketBox = document.getElementById('p-active-ticket-box');
  const ticketNumEl = document.getElementById('p-ticket-number');
  const ticketServiceEl = document.getElementById('p-ticket-service');
  const ticketTimeEl = document.getElementById('p-ticket-time');
  const ticketCurrentEl = document.getElementById('p-ticket-current');

  const myQueueNum = 45; 
  currentCalledQueue = 40; 

  if (ticketNumEl) ticketNumEl.textContent = `A-0${myQueueNum}`;
  if (ticketServiceEl) ticketServiceEl.textContent = `${bookingCart[0].name} +${bookingCart.length - 1} lainnya`;
  if (ticketTimeEl) ticketTimeEl.textContent = '12 Menit lagi';
  if (ticketCurrentEl) ticketCurrentEl.textContent = `A-0${currentCalledQueue}`;
  if (ticketBox) ticketBox.style.display = 'block';

  alert(`Pemesanan Berhasil!\nCabang: ${branch}\nTanggal: ${date}\nTiket antrean Anda A-045 telah dibuat.`);

  // Reset cart
  bookingCart = [];
  updateCartUIs();
  renderLabCatalogue();

  // Go to main dashboard view
  showView('patient-view', 'Dashboard');

  // Start live simulator
  if (queueSimulatorInterval) clearInterval(queueSimulatorInterval);
  queueSimulatorInterval = setInterval(() => {
    if (currentCalledQueue < myQueueNum) {
      currentCalledQueue += 1;
      if (ticketCurrentEl) ticketCurrentEl.textContent = `A-0${currentCalledQueue}`;
      const minutesLeft = (myQueueNum - currentCalledQueue) * 2.5;
      if (minutesLeft > 0) {
        if (ticketTimeEl) ticketTimeEl.textContent = `${Math.ceil(minutesLeft)} Menit lagi`;
      } else {
        if (ticketTimeEl) {
          ticketTimeEl.textContent = 'Silakan menuju Counter!';
          ticketTimeEl.style.color = 'var(--success)';
        }
        clearInterval(queueSimulatorInterval);
      }
    }
  }, 10000);
}

function checkoutHomeCare() {
  if (bookingCart.length === 0) {
    alert('Anda belum memilih pemeriksaan apapun di menu lab test.');
    return;
  }

  const addr = document.getElementById('hc-addr-full').value.trim();
  if (!addr) {
    alert('Masukkan alamat lengkap penjemputan!');
    return;
  }

  alert(`Pemesanan Home Care sukses!\nPetugas medis akan melakukan kunjungan untuk melakukan pengambilan sampel di alamat: ${addr}`);
  
  // Reset cart
  bookingCart = [];
  updateCartUIs();
  renderLabCatalogue();

  showView('patient-view', 'Dashboard');
}

// Update Login Form UI dynamically based on role selection
function updateLoginFormUI(role) {
  const formTitleEl = document.getElementById('login-form-title');
  const labelEl = document.getElementById('username-label');
  const inputEl = document.getElementById('username');
  const footerEl = document.getElementById('login-footer-desc');

  if (!formTitleEl || !labelEl || !inputEl || !footerEl) return;

  // Clear inputs on role change
  inputEl.value = '';
  document.getElementById('password').value = '';

  if (role === 'corporate') {
    formTitleEl.textContent = 'Portal Kemitraan Corporate';
    labelEl.textContent = 'ID Kemitraan / Email Perusahaan';
    inputEl.placeholder = 'Contoh: MITRA-0293 atau email kantor';
    footerEl.innerHTML = 'Pengajuan mitra baru? Hubungi <a href="#">Tim Marketing</a>';
  } else if (role === 'referral') {
    formTitleEl.textContent = 'Portal Faskes Referral';
    labelEl.textContent = 'NPA ID / Email Faskes';
    inputEl.placeholder = 'Contoh: NPA-12948 atau email klinik';
    footerEl.innerHTML = 'Pengajuan dokter perujuk? Hubungi <a href="#">Layanan Medis</a>';
  } else {
    // Patient
    formTitleEl.textContent = 'Portal Pasien';
    labelEl.textContent = 'No. Rekam Medis / Email';
    inputEl.placeholder = 'Contoh: RM-12948 atau email Anda';
    footerEl.innerHTML = 'Belum memiliki akun? <a href="#" onclick="openRegisterModal()">Daftar Pasien Baru</a>';
  }
}

// Open/Close Registration Modal
function openRegisterModal() {
  const modal = document.getElementById('register-modal');
  if (modal) modal.classList.add('open');
}

function closeRegisterModal() {
  const modal = document.getElementById('register-modal');
  if (modal) modal.classList.remove('open');
}

function handleRegistrationSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  
  closeRegisterModal();
  alert(`Registrasi Akun Mandiri berhasil! No. Rekam Medis (RM) Anda adalah RM-12948. Silakan gunakan untuk masuk.`);
  
  // Fill the login form with the mock RM number
  const inputEl = document.getElementById('username');
  if (inputEl) inputEl.value = 'RM-12948';
}

// Open/Close Member & Affiliate Modal
function openMemberModal() {
  const modal = document.getElementById('member-modal');
  const titleEl = document.getElementById('member-welcome-title');

  if (!modal) return;

  const isSuperAdmin = (currentUsername === 'aceanwar424@gmail.com');
  const nameToDisplay = isSuperAdmin ? 'Ace' : (currentUsername || 'Ace');

  if (titleEl) titleEl.textContent = `Halo, ${nameToDisplay}`;
  modal.classList.add('open');
}

function closeMemberModal() {
  const modal = document.getElementById('member-modal');
  if (modal) modal.classList.remove('open');
}

function copyReferralCode() {
  const codeText = document.getElementById('ref-code-text').textContent;
  navigator.clipboard.writeText(codeText).then(() => {
    alert(`Kode Referral ${codeText} berhasil disalin ke clipboard!`);
  }).catch(err => {
    const dummy = document.createElement('textarea');
    document.body.appendChild(dummy);
    dummy.value = codeText;
    dummy.select();
    document.execCommand('copy');
    document.body.removeChild(dummy);
    alert(`Kode Referral ${codeText} berhasil disalin ke clipboard!`);
  });
}

// --- BOOK HOME CARE MODAL TRIGGERS ---
function openHomeCareModal() {
  const modal = document.getElementById('homecare-modal');
  if (modal) modal.classList.add('open');
}

function closeHomeCareModal() {
  const modal = document.getElementById('homecare-modal');
  if (modal) modal.classList.remove('open');
}

function submitHomeCareForm(event) {
  event.preventDefault();
  const service = document.getElementById('hc-service').value.trim();
  const address = document.getElementById('hc-address').value.trim();
  
  closeHomeCareModal();
  alert(`Booking Home Care sukses! Tenaga medis AvaHealth akan melakukan kunjungan untuk layanan "${service}" ke alamat Anda pada tanggal kunjungan.`);
}

// --- BUY PACKAGE MODAL TRIGGERS ---
function openPackageModal() {
  const modal = document.getElementById('package-modal');
  if (modal) modal.classList.add('open');
}

function closePackageModal() {
  const modal = document.getElementById('package-modal');
  if (modal) modal.classList.remove('open');
}

function buyPackage(packageName) {
  alert(`Pemesanan paket "${packageName}" berhasil ditambahkan ke keranjang belanja Anda.`);
}

// --- NEAR ME MODAL TRIGGERS ---
function openNearMeModal() {
  const modal = document.getElementById('nearme-modal');
  if (modal) modal.classList.add('open');
}

function closeNearMeModal() {
  const modal = document.getElementById('nearme-modal');
  if (modal) modal.classList.remove('open');
}

// --- PROFILE MODAL TRIGGERS ---
function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  const nameEl = document.getElementById('prof-fullname');
  const emailEl = document.getElementById('prof-email');

  if (!modal) return;

  const isSuperAdmin = (currentUsername === 'aceanwar424@gmail.com');
  const finalName = isSuperAdmin ? 'Ace Darojatun Anwar' : (currentUsername || 'Budi Santoso');
  const finalEmail = isSuperAdmin ? 'aceanwar424@gmail.com' : `${finalName.toLowerCase().replace(/\s+/g, '')}@email.com`;

  if (nameEl) nameEl.innerHTML = `${finalName} <span class="verified-badge-blue">✓</span>`;
  if (emailEl) emailEl.textContent = finalEmail;

  modal.classList.add('open');
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('open');
}

function seeReferralPackages() {
  closeMemberModal();
  showView('book-test-view', 'Pesan Lab');
}

// --- CORPORATE EMPLOYEE CRUD & STATS UPDATES ---
function renderCorporateList() {
  const container = document.getElementById('corporate-list-container');
  if (!container) return;

  container.innerHTML = corporates.map(emp => {
    let badgeClass = 'badge-pending';
    if (emp.status === 'fit') badgeClass = 'badge-fit';
    if (emp.status === 'unfit') badgeClass = 'badge-unfit';

    return `
      <div class="list-row" style="align-items: center;">
        <div class="list-row-avatar">${emp.name[0]}</div>
        <div class="list-row-details">
          <h5>${emp.name}</h5>
          <p>${emp.id} &bull; ${emp.test}</p>
          <p style="font-size:11px; margin-top:2px; color: var(--text-muted);">${emp.remark}</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
          <span class="badge ${badgeClass}">${emp.status}</span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm" onclick="openEmpMedrecModal('${emp.id}')" style="font-size:9px; padding:3px 6px; margin:0; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:white;">Medrec</button>
            <button class="btn btn-sm btn-unfit" onclick="deleteEmployee('${emp.id}')" style="font-size:9px; padding:3px 6px; margin:0; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:var(--error);">Hapus</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateCorporateStats();
}

function updateCorporateStats() {
  const totalEl = document.getElementById('c-stat-total');
  const mcuEl = document.getElementById('c-stat-mcu');
  const fitEl = document.getElementById('c-stat-fit');
  const unfitEl = document.getElementById('c-stat-unfit');
  const progressTxt = document.getElementById('c-progress-txt');
  const progressBar = document.getElementById('c-progress-bar');

  if (!totalEl) return;

  const total = corporates.length;
  const finished = corporates.filter(e => e.status !== 'pending').length;
  const fit = corporates.filter(e => e.status === 'fit').length;
  const unfit = corporates.filter(e => e.status === 'unfit').length;
  const percent = total > 0 ? Math.round((finished / total) * 100) : 0;

  totalEl.textContent = `${total} Orang`;
  mcuEl.textContent = `${finished} Orang`;
  if (fitEl) fitEl.textContent = fit;
  if (unfitEl) unfitEl.textContent = unfit;
  if (progressTxt) progressTxt.textContent = `${percent}%`;
  if (progressBar) progressBar.style.width = `${percent}%`;
}

function openAddEmployeeModal() {
  const modal = document.getElementById('add-employee-modal');
  if (modal) {
    document.getElementById('corp-emp-name').value = '';
    document.getElementById('corp-emp-id').value = `EMP-00${corporates.length + 1}`;
    modal.classList.add('open');
  }
}

function closeAddEmployeeModal() {
  const modal = document.getElementById('add-employee-modal');
  if (modal) modal.classList.remove('open');
}

function submitAddEmployeeForm(event) {
  event.preventDefault();
  
  const name = document.getElementById('corp-emp-name').value.trim();
  const id = document.getElementById('corp-emp-id').value.trim();
  const packageType = document.getElementById('corp-emp-package').value;

  if (!name || !id) return;

  // Add new employee
  corporates.push({
    name: name,
    id: id,
    test: packageType,
    status: 'pending',
    remark: 'Proses Analisa Lab',
    medrec: null
  });

  renderCorporateList();
  closeAddEmployeeModal();
  alert(`Karyawan "${name}" berhasil didaftarkan ke program MCU.`);
}

function deleteEmployee(empId) {
  if (confirm('Apakah Anda yakin ingin menghapus karyawan ini dari daftar program MCU?')) {
    corporates = corporates.filter(e => e.id !== empId);
    renderCorporateList();
  }
}

// --- EMPLOYEE MEDICAL RECORD DETAIL MODAL ---
function openEmpMedrecModal(empId) {
  const emp = corporates.find(e => e.id === empId);
  if (!emp) return;

  const modal = document.getElementById('emp-medrec-modal');
  const titleEl = document.getElementById('medrec-title');
  const subEl = document.getElementById('medrec-sub');
  const contentEl = document.getElementById('medrec-content');

  if (!modal || !titleEl || !contentEl) return;

  titleEl.textContent = `Rekam Medis: ${emp.name}`;
  subEl.innerHTML = `ID Karyawan: <strong>${emp.id}</strong> &bull; ${emp.test}`;

  if (emp.status === 'pending') {
    contentEl.innerHTML = `
      <div style="text-align:center; padding:20px; color:var(--text-muted);">
        <p style="font-size:24px; margin-bottom:10px;">🧪</p>
        <p style="font-size:13px; line-height:1.4;">Sampel laboratorium karyawan sedang diproses. Hasil klinis dan status kelayakan kerja akan diterbitkan setelah proses analisa lab selesai.</p>
      </div>
    `;
  } else {
    const med = emp.medrec || { cholesterol: 180, sugar: 90, uric: 5.0, notes: 'Data normal.' };
    const cholClass = med.cholesterol > 200 ? 'abnormal' : 'normal';
    const sugarClass = med.sugar > 100 ? 'abnormal' : 'normal';
    const uricClass = med.uric > 7.0 ? 'abnormal' : 'normal';

    contentEl.innerHTML = `
      <div class="medrec-param-row">
        <span class="medrec-param-label">Kolesterol Total</span>
        <span class="medrec-param-value ${cholClass}">${med.cholesterol} mg/dL</span>
      </div>
      <div class="medrec-param-row">
        <span class="medrec-param-label">Glukosa Puasa</span>
        <span class="medrec-param-value ${sugarClass}">${med.sugar} mg/dL</span>
      </div>
      <div class="medrec-param-row">
        <span class="medrec-param-label">Asam Urat</span>
        <span class="medrec-param-value ${uricClass}">${med.uric} mg/dL</span>
      </div>
      <div style="margin-top:12px; padding:12px; border-radius:8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:9px; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:4px;">Catatan Dokter / Kelayakan Kerja</span>
        <p style="font-size:12px; line-height:1.4; color:#f8fafc;">${med.notes}</p>
      </div>
    `;
  }

  modal.classList.add('open');
}

function closeEmpMedrecModal() {
  const modal = document.getElementById('emp-medrec-modal');
  if (modal) modal.classList.remove('open');
}

// --- CORPORATE INVOICES & BILLING PAYMENTS ---
function renderInvoices() {
  const miniContainer = document.getElementById('corp-invoice-list-mini');
  const fullContainer = document.getElementById('corp-invoice-list-full');

  if (!miniContainer) return;

  // Render mini dashboard widget
  miniContainer.innerHTML = invoices.map(inv => {
    let badgeClass = inv.status === 'paid' ? 'badge-fit' : 'badge-unfit';
    let badgeText = inv.status === 'paid' ? 'Lunas' : 'Belum Bayar';

    return `
      <div class="invoice-row" style="border-bottom:1px solid rgba(255,255,255,0.04); padding: 8px 0;">
        <div class="invoice-info">
          <h5>${inv.id}</h5>
          <p>${inv.name} &bull; ${inv.date}</p>
        </div>
        <div style="text-align:right;">
          <span class="invoice-amount" style="font-weight:700; color:white;">Rp ${inv.amount.toLocaleString('id-ID')}</span>
          <span class="badge ${badgeClass}" style="display:block; width:fit-content; margin-left:auto; margin-top:4px; font-size:9px; padding:2px 6px;">${badgeText}</span>
        </div>
      </div>
    `;
  }).join('');

  // Render full list in modal
  if (fullContainer) {
    fullContainer.innerHTML = invoices.map(inv => {
      let badgeClass = inv.status === 'paid' ? 'badge-fit' : 'badge-unfit';
      let badgeText = inv.status === 'paid' ? 'Lunas' : 'Belum Bayar';
      let actionBtn = inv.status === 'unpaid' 
        ? `<button class="btn btn-sm btn-primary" onclick="selectInvoiceToPay('${inv.id}')" style="margin:0; font-size:11px; padding:6px 12px;">Bayar</button>`
        : `<span style="color:var(--teal); font-size:12px; font-weight:700;">🤝 Selesai</span>`;

      return `
        <div class="invoice-card" id="inv-card-${inv.id}">
          <div class="invoice-card-header">
            <span style="font-weight:800; font-family:monospace; color:white;">${inv.id}</span>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="invoice-card-body">
            <div>
              <h5 style="font-size:13px; margin:0; color:white;">${inv.name}</h5>
              <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">Tanggal: ${inv.date}</p>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
              <strong style="color:var(--warning); font-size:14px;">Rp ${inv.amount.toLocaleString('id-ID')}</strong>
              ${actionBtn}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function openCorpBillingModal() {
  const modal = document.getElementById('corp-billing-modal');
  if (modal) {
    selectedInvoiceId = null;
    document.getElementById('payment-panel').style.display = 'none';
    renderInvoices();
    modal.classList.add('open');
  }
}

function closeCorpBillingModal() {
  const modal = document.getElementById('corp-billing-modal');
  if (modal) modal.classList.remove('open');
}

function selectInvoiceToPay(invId) {
  selectedInvoiceId = invId;

  // Highlight selected card
  invoices.forEach(inv => {
    const card = document.getElementById(`inv-card-${inv.id}`);
    if (card) {
      if (inv.id === invId) {
        card.style.borderColor = 'var(--primary)';
        card.style.background = 'rgba(14, 165, 233, 0.05)';
      } else {
        card.style.borderColor = 'var(--border)';
        card.style.background = 'rgba(15, 23, 42, 0.4)';
      }
    }
  });

  // Open payment panel
  document.getElementById('payment-panel').style.display = 'block';
}

function processInvoicePayment() {
  if (!selectedInvoiceId) return;

  const method = document.querySelector('input[name="pay-method"]:checked').value;
  const inv = invoices.find(i => i.id === selectedInvoiceId);

  if (!inv) return;

  inv.status = 'paid';
  
  // Hide payment panel
  document.getElementById('payment-panel').style.display = 'none';

  renderInvoices();
  alert(`Pembayaran Invoice "${selectedInvoiceId}" sebesar Rp ${inv.amount.toLocaleString('id-ID')} menggunakan "${method}" berhasil diproses!`);
}

// --- CLAIM CASHBACK ---
function openClaimCashbackModal() {
  const modal = document.getElementById('claim-cashback-modal');
  const amtEl = document.getElementById('cashback-modal-amt');
  if (modal && amtEl) {
    amtEl.textContent = `Rp ${corporateCashback.toLocaleString('id-ID')}`;
    modal.classList.add('open');
  }
}

function closeClaimCashbackModal() {
  const modal = document.getElementById('claim-cashback-modal');
  if (modal) modal.classList.remove('open');
}

function processClaimCashback() {
  if (corporateCashback <= 0) {
    alert('Tidak ada saldo cashback yang tersedia untuk diklaim.');
    closeClaimCashbackModal();
    return;
  }

  const amt = corporateCashback;
  corporateCashback = 0;

  // Update dashboard
  const cbEl = document.getElementById('c-cashback-balance');
  if (cbEl) cbEl.textContent = 'Rp 0';

  closeClaimCashbackModal();
  alert(`Klaim Cashback sebesar Rp ${amt.toLocaleString('id-ID')} berhasil dicairkan ke saldo deposit perusahaan!`);
}

// --- WITHDRAW REFERRAL COMMISSION FEE ---
function openWithdrawFeeModal() {
  const modal = document.getElementById('withdraw-fee-modal');
  const amtEl = document.getElementById('withdraw-modal-amt');
  const inputEl = document.getElementById('w-amount');

  if (modal && amtEl && inputEl) {
    amtEl.textContent = `Rp ${referralWallet.toLocaleString('id-ID')}`;
    inputEl.value = referralWallet;
    inputEl.max = referralWallet;
    modal.classList.add('open');
  }
}

function closeWithdrawFeeModal() {
  const modal = document.getElementById('withdraw-fee-modal');
  if (modal) modal.classList.remove('open');
}

function processWithdrawFee(event) {
  event.preventDefault();

  const amtInput = parseInt(document.getElementById('w-amount').value);
  const bank = document.getElementById('w-bank-name').value;

  if (isNaN(amtInput) || amtInput <= 0) return;

  if (amtInput > referralWallet) {
    alert('Saldo rujukan tidak mencukupi untuk melakukan penarikan.');
    return;
  }

  referralWallet -= amtInput;

  // Update dashboard commission values
  const feeEl = document.getElementById('r-fee-balance');
  if (feeEl) feeEl.textContent = `Rp ${referralWallet.toLocaleString('id-ID')}`;

  closeWithdrawFeeModal();
  alert(`Komisi rujukan sebesar Rp ${amtInput.toLocaleString('id-ID')} berhasil dicairkan ke rekening ${bank}.`);
}

// Render Referral List
function renderReferralList() {
  const container = document.getElementById('referral-list-container');
  if (!container) return;

  container.innerHTML = referrals.map(ref => {
    let badgeClass = 'badge-pending';
    let statusText = 'Menunggu';
    if (ref.status === 'finished') {
      badgeClass = 'badge-finished';
      statusText = 'Selesai';
    }

    return `
      <div class="list-row">
        <div class="list-row-avatar">👤</div>
        <div class="list-row-details">
          <h5>${ref.name}</h5>
          <p>${ref.test}</p>
          <p style="font-size:11px; margin-top:2px; color: var(--teal);">Fee Rujukan: Rp ${ref.fee.toLocaleString('id-ID')}</p>
        </div>
        <div style="text-align:right; display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
          <span class="badge ${badgeClass}">${statusText}</span>
          <span style="font-size:10px; color: var(--text-muted);">${ref.date}</span>
        </div>
      </div>
    `;
  }).join('');

  // Update Stats
  const totalEl = document.getElementById('r-total-referrals');
  const feeEl = document.getElementById('r-commission');
  
  if (totalEl) totalEl.textContent = `${referrals.length} Pasien`;
  
  if (feeEl) {
    const totalFee = referrals.reduce((sum, r) => sum + r.fee, 0);
    feeEl.textContent = `Rp ${totalFee.toLocaleString('id-ID')}`;
  }
}

// Handle Login Submission
async function handleLogin(event) {
  event.preventDefault();
  
  const usernameInput = document.getElementById('username').value.trim();
  const passwordInput = document.getElementById('password').value;
  const selectedRole = document.querySelector('input[name="login-role"]:checked').value;
  
  let finalUsername = usernameInput;
  let finalRole = selectedRole;
  let profileData = null;

  // Try real Supabase auth if password is provided
  if (passwordInput && typeof sbAccessToken === 'function') {
    const btn = document.querySelector('#login-screen button[type="submit"]');
    const oldText = btn ? btn.textContent : 'Masuk';
    if (btn) {
      btn.textContent = '⏳ Memproses Auth...';
      btn.disabled = true;
    }
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ email: usernameInput, password: passwordInput })
      });
      const authData = await authRes.json();
      if (authData.access_token) {
        localStorage.setItem('ol_token', authData.access_token);
        if (authData.refresh_token) localStorage.setItem('ol_refresh', authData.refresh_token);
        
        // Fetch user profile
        const profs = await sbGet('user_profiles', `select=*&id=eq.${authData.user.id}`);
        if (profs && profs[0]) {
          profileData = profs[0];
          finalUsername = profileData.full_name || authData.user.email;
          finalRole = profileData.role || 'patient';
          console.log("Logged in user:", finalUsername, "with role:", finalRole);
        }
      } else {
        alert(`Gagal Login Supabase: ${authData.error_description || authData.msg || 'Cek kembali email & password Anda.'}`);
        if (btn) {
          btn.textContent = oldText;
          btn.disabled = false;
        }
        return;
      }
    } catch (e) {
      console.warn("Gagal menyambungkan ke auth Supabase, falling back to mock login:", e.message);
    }
    if (btn) {
      btn.textContent = oldText;
      btn.disabled = false;
    }
  }

  // Continue login flow
  currentUsername = finalUsername;
  currentRole = finalRole;
  
  const avatarEl = document.getElementById('user-avatar');
  const welcomeEl = document.getElementById('user-welcome');
  const roleBadgeEl = document.getElementById('user-role-badge');
  
  const isSuperAdmin = (usernameInput === 'aceanwar424@gmail.com');
  const adminRealName = 'Ace Darojatun Anwar';

  renderSidebarMenu();

  if (currentRole === 'corporate') {
    avatarEl.textContent = 'C';
    avatarEl.style.background = 'linear-gradient(135deg, #f59e0b, #ea580c)';
    welcomeEl.textContent = isSuperAdmin ? `${adminRealName}` : (finalUsername || 'PT. Sukses Mandiri');
    roleBadgeEl.textContent = isSuperAdmin ? 'Super Admin Korporasi' : 'Mitra Korporasi';
    
    const cbEl = document.getElementById('c-cashback-balance');
    if (cbEl) cbEl.textContent = `Rp ${corporateCashback.toLocaleString('id-ID')}`;

    renderCorporateList();
    renderInvoices();
  } 
  else if (currentRole === 'referral') {
    avatarEl.textContent = 'R';
    avatarEl.style.background = 'linear-gradient(135deg, #14b8a6, #0d9488)';
    welcomeEl.textContent = isSuperAdmin ? `Dr. ${adminRealName}` : (finalUsername || 'Klinik Medika Pratama');
    roleBadgeEl.textContent = isSuperAdmin ? 'Super Admin Referral' : 'Faskes / Dokter Perujuk';
    
    const feeEl = document.getElementById('r-fee-balance');
    if (feeEl) feeEl.textContent = `Rp ${referralWallet.toLocaleString('id-ID')}`;

    renderReferralList();
  } 
  else {
    // Default: Patient
    const finalName = isSuperAdmin ? adminRealName : (finalUsername || 'Budi Santoso');
    avatarEl.textContent = 'P';
    avatarEl.style.background = 'linear-gradient(135deg, #0ea5e9, #0284c7)';
    welcomeEl.textContent = finalName;
    roleBadgeEl.textContent = isSuperAdmin ? 'Super Admin Pasien' : 'Pasien Terverifikasi';
    
    const memberNameEl = document.getElementById('p-member-name');
    if (memberNameEl) memberNameEl.textContent = finalName;

    // Load real database data from Supabase (async)
    await loadDataFromSupabase();

    // Personalize Profile fields
    const pfName = document.getElementById('pf-fullname');
    const pfEmail = document.getElementById('pf-email');
    if (pfName) pfName.textContent = finalName.toUpperCase();
    if (pfEmail) pfEmail.textContent = isSuperAdmin ? 'aceanwar424@gmail.com' : `${finalName.toLowerCase().replace(/\s+/g, '')}@email.com`;
  }
  
  // Hide timeline tabs for corporate and referral, only show for patient
  const timelineNav = document.getElementById('timeline-tabs-nav');
  if (timelineNav) {
    timelineNav.style.display = (selectedRole === 'patient') ? 'block' : 'none';
  }

  // Always reset timeline phase to Fase 1 on login
  switchTimelinePhase('fase1');
  showScreen('dashboard-screen');
}

// Logout
function handleLogout() {
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  currentUsername = '';
  bookingCart = [];
  if (queueSimulatorInterval) {
    clearInterval(queueSimulatorInterval);
    queueSimulatorInterval = null;
  }
  // Hide active queue ticket on logout
  document.getElementById('p-active-ticket-box').style.display = 'none';
  showScreen('login-screen');
}

// --- REFERRAL MODAL FORM (FPP Parameter Checklist) ---
function openReferralForm() {
  const modal = document.getElementById('referral-modal');
  if (modal) {
    document.getElementById('ref-patient-name').value = '';
    document.getElementById('ref-patient-phone').value = '';
    // Uncheck all checkboxes
    document.querySelectorAll('input[name="ref-test-param"]').forEach(cb => cb.checked = false);
    modal.classList.add('open');
  }
}

function closeReferralForm() {
  const modal = document.getElementById('referral-modal');
  if (modal) modal.classList.remove('open');
}

function submitReferralForm(event) {
  event.preventDefault();
  
  const name = document.getElementById('ref-patient-name').value.trim();
  const phone = document.getElementById('ref-patient-phone').value.trim();

  // Get selected checkboxes
  const checkedParams = Array.from(document.querySelectorAll('input[name="ref-test-param"]:checked')).map(cb => cb.value);
  
  if (checkedParams.length === 0) {
    alert('Pilih minimal 1 parameter pemeriksaan pada Formulir Permintaan Pemeriksaan (FPP)!');
    return;
  }

  const testListStr = checkedParams.join(', ');
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Calculate simulated commission fee based on amount of tests chosen (e.g. 50k per test)
  const calcFee = checkedParams.length * 50000;

  // Add new referral
  referrals.unshift({
    name: name,
    phone: phone,
    test: testListStr,
    status: 'waiting',
    fee: calcFee,
    date: dateStr
  });

  // Re-render
  renderReferralList();

  // Close modal
  closeReferralForm();
  
  alert('Rujukan pasien baru dengan parameter terpilih berhasil dikirim!');
}

// --- PEER-TO-PEER CHAT CONSULTATION ---
function sendConsultMessage(event) {
  event.preventDefault();
  
  const inputEl = document.getElementById('chat-input');
  const messageText = inputEl.value.trim();
  if (!messageText) return;

  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Append sent message
  const msgSent = document.createElement('div');
  msgSent.className = 'chat-msg msg-sent';
  msgSent.innerHTML = `
    <p>${messageText}</p>
    <span class="msg-time">${timeStr}</span>
  `;
  container.appendChild(msgSent);
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
  
  // Reset input
  inputEl.value = '';

  // Simulate Pathology Response after 2.5 seconds
  setTimeout(() => {
    const responseTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const msgReceived = document.createElement('div');
    msgReceived.className = 'chat-msg msg-received';
    msgReceived.innerHTML = `
      <p>Baik Dokter, kami segera lakukan konfirmasi mikroskopis manual sediaan apus darah tepi. Hasil koreksinya akan kami unggah langsung ke sistem rujukan dalam waktu 30 menit.</p>
      <span class="msg-time">${responseTime}</span>
    `;
    container.appendChild(msgReceived);
    container.scrollTop = container.scrollHeight;
  }, 2500);
}

// --- WEARABLE SENSOR DATA SYNC SIMULATOR ---
function syncWearableData() {
  const stepsEl = document.getElementById('w-steps');
  const stepsBarEl = document.getElementById('w-steps-bar');
  const heartEl = document.getElementById('w-heart');

  if (!stepsEl || !heartEl) return;

  stepsEl.textContent = 'Syncing...';
  heartEl.textContent = 'Syncing...';

  setTimeout(() => {
    // Generate random realistic metrics
    const randomSteps = Math.floor(Math.random() * (9900 - 7500 + 1)) + 7500;
    const stepsPercent = Math.min(Math.round((randomSteps / 10000) * 100), 100);
    const randomHeart = Math.floor(Math.random() * (86 - 66 + 1)) + 66;

    stepsEl.textContent = randomSteps.toLocaleString('id-ID');
    if (stepsBarEl) stepsBarEl.style.width = `${stepsPercent}%`;
    heartEl.innerHTML = `${randomHeart} <small>bpm</small>`;

    alert('Data kesehatan dari Smartwatch berhasil disinkronkan!');
  }, 1200);
}

// ════════════════════════ FUTURISTIC SIMULATORS ════════════════════════

// Fase 2: Continuous Biosensor Pulse Scanner
function simulateBiosensorPulse() {
  const sugarEl = document.getElementById('f2-sugar-val');
  const uricEl = document.getElementById('f2-uric-val');

  if (!sugarEl || !uricEl) return;

  sugarEl.textContent = 'Scanning...';
  uricEl.textContent = 'Scanning...';

  setTimeout(() => {
    const randomSugar = Math.floor(Math.random() * (116 - 92 + 1)) + 92;
    const randomUric = (Math.random() * (6.6 - 5.0) + 5.0).toFixed(1);

    sugarEl.textContent = `${randomSugar} mg/dL`;
    uricEl.textContent = `${randomUric} mg/dL`;

    alert('Scan sensor tubuh selesai. Data biosensor Anda stabil dan sinkron.');
  }, 1200);
}

// Fase 4: CRISPR Age Reversal
function simulateAgeReversal() {
  const ageEl = document.getElementById('f4-bio-age');
  if (!ageEl) return;

  let currentAge = parseInt(ageEl.textContent) || 25;
  
  if (currentAge > 21) {
    currentAge -= 1;
    ageEl.textContent = `${currentAge} Tahun`;
    alert(`Terapi sel penuaan berhasil dipicu. Usia biologis Anda ter-update menjadi ${currentAge} tahun.`);
  } else {
    alert('Usia biologis Anda telah mencapai performa puncak seluler (21 tahun). Terapi optimal tercapai!');
  }
}
