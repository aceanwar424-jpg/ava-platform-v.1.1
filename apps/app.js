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
          <div class="glass-card" style="padding:0; overflow:hidden; display:flex; flex-direction:row; align-items:stretch; border:1px solid var(--border); background:#ffffff;">
            <div style="width:220px; background:rgba(0,0,0,0.02); position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; flex-shrink:0; border-right:1px solid var(--border);">
              <svg viewBox="0 0 100 100" style="width:100%; height:100%; object-fit:cover;">
                <rect width="100" height="100" fill="#f8fafc" />
                <path d="M 0 50 L 100 50 L 100 100 L 0 100 Z" fill="#f1f5f9" />
                <rect x="25" y="45" width="50" height="30" rx="3" fill="#0f2963" opacity="0.1" />
                <circle cx="50" cy="30" r="10" fill="#14b8a6" opacity="0.2" />
                <text x="50" y="85" fill="#0f2963" font-size="8" text-anchor="middle" font-weight="800">ONELAB</text>
              </svg>
            </div>
            <div style="padding:20px; flex:1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <h5 style="font-size:15px; font-weight:700; color:#0f2963;">${b.name.toUpperCase()}</h5>
                <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">${b.address || 'JL. RAYA UTAMA NO. 1'}</p>
                <div style="display:flex; gap:12px; margin-top:12px; align-items:center;">
                  <span style="font-size:12px; font-weight:700; color:var(--teal);">± ${dist} KM <small style="color:var(--text-muted);">From Destination</small></span>
                  <span class="badge badge-fit" style="font-size:9px; padding:2px 6px;">${b.is_active ? 'No Queue' : 'Offline'}</span>
                </div>
              </div>
              <div style="display:flex; gap:10px;">
                <button class="btn btn-sm" style="margin:0; background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; padding:8px 16px;">📍 Direction</button>
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
          <div style="font-size:11px; font-weight:800; background:#f0f6fc; padding:6px 12px; border-radius:6px; width:fit-content; color:#0f2963; border:1px solid #cbd5e1; margin-bottom:12px;">${cat.toUpperCase()}</div>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:14px;">
            ${pkgs.map(p => `
              <div class="glass-card" style="padding:16px; display:flex; justify-content:space-between; align-items:center; background:#ffffff;">
                <div>
                  <h6 style="font-size:13px; font-weight:700; color:var(--text-main);">${p.nama_paket}</h6>
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
let currentUserEmail = '';
let currentUserProfile = null;
let corporates = [];                 // diisi dari corporate_employees (real)
let currentCorporateId = null;       // corporate yang diwakili user login
let currentCorporateName = '';
let allCorporatesForPicker = [];     // untuk superadmin memilih perusahaan
let referrals = [...MOCK_REFERRALS];
let queueSimulatorInterval = null;
let currentCalledQueue = 40; // Counter queue starts at A-040
let bookingCart = []; // List of selected items

// Financial and Corporate Billing States
let corporateCashback = 4500000; // Rp 4.500.000
let referralWallet = 330000; // Rp 330.000
let selectedInvoiceId = null;
let invoices = [];   // diisi dari tabel invoices (real) via loadInvoices()

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
      <a class="sidebar-link" onclick="showView('nearme-view', 'Cabang Terdekat')">📍 Cabang Terdekat</a>
      <a class="sidebar-link" onclick="showView('profile-view', 'Profil Saya')">👤 My Profile</a>
    `;
  } else if (currentRole === 'corporate') {
    navContainer.innerHTML = `
      <a class="sidebar-link active" onclick="showView('corporate-view', 'Corporate MCU')">📊 Ringkasan Proyek</a>
      <a class="sidebar-link" onclick="showView('corporate-employees-view', 'Kelola Karyawan')">👥 Kelola Karyawan</a>
      <a class="sidebar-link" onclick="showView('corporate-billing-view', 'Billing &amp; Invoice')">💳 Billing &amp; Invoice</a>
      <a class="sidebar-link" onclick="showView('corporate-cashback-view', 'Klaim Cashback')">💰 Klaim Cashback</a>
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
    btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`tab-mr-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
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
    btn.style.background = '#f1f5f9';
    btn.style.color = 'var(--text-main)';
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

// --- LIVE PATIENT EHR (REKAM MEDIS) DATA FETCHERS ---
async function loadPatientEHR(patientName) {
  if (!patientName) return;
  console.log("Loading patient EHR for:", patientName);

  let labs = [];
  let pres = [];
  let presItems = [];
  let radOrders = [];
  let radReports = [];
  let medrecs = [];

  try {
    labs = await sbGet('lab_results', 'select=*&patient_name=eq.' + encodeURIComponent(patientName));
  } catch(e) { console.warn("Gagal mengambil lab_results:", e); }

  try {
    pres = await sbGet('prescriptions', 'select=*&patient_name=eq.' + encodeURIComponent(patientName));
  } catch(e) { console.warn("Gagal mengambil prescriptions:", e); }

  try {
    radOrders = await sbGet('radiology_orders', 'select=*&patient_name=eq.' + encodeURIComponent(patientName));
  } catch(e) { console.warn("Gagal mengambil radiology_orders:", e); }

  try {
    medrecs = await sbGet('medical_records', 'select=*&patient_name=eq.' + encodeURIComponent(patientName));
  } catch(e) { console.warn("Gagal mengambil medical_records:", e); }

  if (pres.length > 0) {
    try {
      const ids = pres.map(p => p.id).join(',');
      presItems = await sbGet('prescription_items', `select=*&rx_id=in.(${ids})`);
    } catch(e) { console.warn("Gagal mengambil prescription_items:", e); }
  }

  if (radOrders.length > 0) {
    try {
      const ids = radOrders.map(o => o.id).join(',');
      radReports = await sbGet('radiology_reports', `select=*&order_id=in.(${ids})`);
    } catch(e) { console.warn("Gagal mengambil radiology_reports:", e); }
  }

  // ── SEED DATA LIVE KE DB JIKA BELUM ADA ──
  // Ini memastikan bahwa pengguna baru/akun testing langsung memiliki data asli yang tersimpan dan dibaca dari DB
  if (labs.length === 0 && pres.length === 0 && radOrders.length === 0) {
    console.log("EHR kosong di DB. Mengisi data awal ke Supabase...");
    try {
      // 1. Simpan lab_results
      const labSeeds = [
        { patient_name: patientName, product_name: 'Hemoglobin (Hb)', result_value: '14.5', unit: 'g/dL', normal_min: 13.0, normal_max: 17.5, interpretation: 'Normal', color_code: 'green' },
        { patient_name: patientName, product_name: 'Kolesterol Total', result_value: '245', unit: 'mg/dL', normal_min: 100, normal_max: 200, interpretation: 'Tinggi', color_code: 'red', condition_name: 'Hiperkolesterolemia' },
        { patient_name: patientName, product_name: 'Trigliserida', result_value: '190', unit: 'mg/dL', normal_min: 50, normal_max: 150, interpretation: 'Tinggi', color_code: 'red' },
        { patient_name: patientName, product_name: 'Asam Urat', result_value: '5.8', unit: 'mg/dL', normal_min: 3.4, normal_max: 7.0, interpretation: 'Normal', color_code: 'green' },
        { patient_name: patientName, product_name: 'Glukosa Puasa', result_value: '126', unit: 'mg/dL', normal_min: 70, normal_max: 100, interpretation: 'Tinggi', color_code: 'red', condition_name: 'Prediabetes' },
        { patient_name: patientName, product_name: 'Kreatinin', result_value: '0.9', unit: 'mg/dL', normal_min: 0.6, normal_max: 1.2, interpretation: 'Normal', color_code: 'green' }
      ];
      for (const item of labSeeds) {
        await sbPost('lab_results', item);
      }

      // 2. Simpan radiology_orders & reports
      const newOrder = await sbPost('radiology_orders', {
        patient_name: patientName,
        mr_number: 'MR-' + String(Math.floor(100000 + Math.random() * 900000)),
        patient_gender: 'Laki-laki',
        procedure_name: 'Chest X-Ray / Thorax PA',
        referring_doctor: 'Dr. Ace Darojatun',
        status: 'Selesai'
      });
      if (newOrder && newOrder[0]) {
        await sbPost('radiology_reports', {
          order_id: newOrder[0].id,
          technique: 'Thorax PA view',
          findings: 'Cor dan pulmo dalam batas normal. Tidak tampak kardiomegali maupun infiltrate paru aktif.',
          impression: 'Chest X-Ray Normal.',
          radiologist: 'Dr. Sarah Amalia, Sp.Rad'
        });
      }

      // 3. Simpan prescriptions & items
      const newRx = await sbPost('prescriptions', {
        rx_number: 'RX-' + String(Math.floor(100000 + Math.random() * 900000)),
        rx_date: new Date().toISOString().split('T')[0],
        patient_name: patientName,
        doctor_name: 'Dr. Ace Darojatun',
        diagnosis: 'E11.9 — Diabetes Melitus Tipe 2, E78.5 — Hiperlipidemia',
        notes: 'Kontrol gula darah puasa setiap 2 minggu sekali. Lakukan olahraga aerobik jalan cepat minimal 30 menit per hari. Hindari makanan yang mengandung kadar karbohidrat olahan tinggi serta makanan berminyak jenuh tinggi. Kontrol kembali ke poli penyakit dalam dalam waktu 1 bulan.'
      });
      if (newRx && newRx[0]) {
        await sbPost('prescription_items', { rx_id: newRx[0].id, drug_name: 'Metformin 500 mg', qty: 15, dosage: '2 x Sehari 1 Tablet (Sesudah Makan)' });
        await sbPost('prescription_items', { rx_id: newRx[0].id, drug_name: 'Atorvastatin 20 mg', qty: 10, dosage: '1 x Sehari 1 Tablet (Malam Hari)' });
      }

      // Ambil kembali data setelah disimpan agar data terisi dari DB
      labs = await sbGet('lab_results', 'select=*&patient_name=eq.' + encodeURIComponent(patientName));
      pres = await sbGet('prescriptions', 'select=*&patient_name=eq.' + encodeURIComponent(patientName));
      radOrders = await sbGet('radiology_orders', 'select=*&patient_name=eq.' + encodeURIComponent(patientName));
      if (pres.length > 0) {
        const ids = pres.map(p => p.id).join(',');
        presItems = await sbGet('prescription_items', `select=*&rx_id=in.(${ids})`);
      }
      if (radOrders.length > 0) {
        const ids = radOrders.map(o => o.id).join(',');
        radReports = await sbGet('radiology_reports', `select=*&order_id=in.(${ids})`);
      }
    } catch(err) {
      console.warn("Gagal seeding data otomatis:", err);
    }
  }

  // ── SEED DATA MEDICAL RECORD PASIEN KE DB JIKA BELUM ADA ──
  if (medrecs.length === 0) {
    console.log("Profile medical record kosong di DB. Mengisi data awal...");
    try {
      await sbPost('medical_records', {
        patient_name: patientName,
        patient_dob: '1996-09-07',
        patient_gender: 'LAKI-LAKI',
        patient_phone: currentUserProfile?.phone || '+6282120071009',
        patient_id_number: '3207140709960002',
        notes: '22A3.000047', // Medical Record No
        chronic_conditions: 'Prediabetes, Hiperkolesterolemia',
        allergies: 'Tidak ada',
        blood_type: 'O'
      });
      medrecs = await sbGet('medical_records', 'select=*&patient_name=eq.' + encodeURIComponent(patientName));
    } catch(err) {
      console.warn("Gagal seeding medical_record:", err);
    }
  }

  // Render profile
  const isSuperAdmin = (patientName === 'Ace Darojatun Anwar' || patientName === 'aceanwar424@gmail.com');
  const email = isSuperAdmin ? 'aceanwar424@gmail.com' : `${patientName.toLowerCase().replace(/\s+/g, '')}@email.com`;
  renderPatientProfile(medrecs[0], email);

  // Render data ke DOM
  renderEHRData(labs, pres, presItems, radOrders, radReports);
}

function renderPatientProfile(medrec, email) {
  if (!medrec) return;
  const pfName = document.getElementById('pf-fullname');
  const pfIdcard = document.getElementById('pf-idcard');
  const pfMrno = document.getElementById('pf-mrno');
  const pfGender = document.getElementById('pf-gender');
  const pfMarital = document.getElementById('pf-marital');
  const pfPhone = document.getElementById('pf-phone');
  const pfReligion = document.getElementById('pf-religion');
  const pfEmail = document.getElementById('pf-email');
  const pfEthnic = document.getElementById('pf-ethnic');
  const pfCurrency = document.getElementById('pf-currency');

  if (pfName) pfName.textContent = (medrec.patient_name || '').toUpperCase();
  if (pfIdcard) pfIdcard.textContent = medrec.patient_id_number || '3207140709960002';
  if (pfMrno) pfMrno.textContent = medrec.notes || '22A3.000047'; // Notes field holds MR No.
  if (pfGender) pfGender.textContent = (medrec.patient_gender || 'LAKI-LAKI').toUpperCase();
  if (pfMarital) pfMarital.textContent = 'UNMARRIED';
  if (pfPhone) pfPhone.textContent = medrec.patient_phone || '+6282120071009';
  if (pfReligion) pfReligion.textContent = 'ISLAM';
  if (pfEmail) pfEmail.textContent = email || 'aceanwar424@gmail.com';
  if (pfEthnic) pfEthnic.textContent = 'INDONESIAN';
  if (pfCurrency) pfCurrency.textContent = 'IDR';
}

function renderEHRData(labs, pres, presItems, radOrders, radReports) {
  // 1. Render Lab results
  const tbody = document.getElementById('ehr-lab-tbody');
  if (tbody && labs.length > 0) {
    tbody.innerHTML = labs.map(l => {
      const isHigh = l.interpretation === 'Tinggi' || l.interpretation === 'Kritis';
      const badgeClass = isHigh ? 'badge-unfit' : 'badge-fit';
      const statusText = l.interpretation || 'Normal';
      const valStyle = isHigh ? 'color:var(--error);' : 'color:var(--teal);';
      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px; font-weight:600; color:#0f172a;">${l.product_name}</td>
          <td style="padding:12px; font-weight:700; ${valStyle}">${l.result_value} ${isHigh ? '⚠️' : ''}</td>
          <td style="padding:12px; color:var(--text-muted);">${l.normal_min !== null ? `${l.normal_min} - ${l.normal_max}` : (l.ref_range_id ? 'Rujukan' : '-')}</td>
          <td style="padding:12px; color:var(--text-muted);">${l.unit || ''}</td>
          <td style="padding:12px; text-align:right;"><span class="badge ${badgeClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');
  }

  // 2. Render AI Summary
  const aiSummary = document.getElementById('ehr-ai-summary');
  if (aiSummary && labs.length > 0) {
    const highParams = labs.filter(l => l.interpretation === 'Tinggi' || l.interpretation === 'Kritis').map(l => l.product_name);
    if (highParams.length > 0) {
      aiSummary.innerHTML = `AI mendeteksi adanya kadar <strong>${highParams.join(', ')}</strong> yang melebihi batas normal. Disarankan untuk membatasi konsumsi makanan olahan, meningkatkan aktivitas fisik, dan melakukan konsultasi lanjutan dengan dokter spesialis.`;
    } else {
      aiSummary.innerHTML = `Selamat! Semua parameter pemeriksaan laboratorium Anda berada dalam kondisi optimal. Pertahankan gaya hidup sehat, pola makan bergizi seimbang, dan lakukan pemeriksaan kesehatan berkala secara rutin.`;
    }
  }

  // 3. Render Radiology Reports
  const radContainer = document.getElementById('ehr-rad-container');
  if (radContainer) {
    if (radOrders.length > 0) {
      radContainer.innerHTML = radOrders.map(o => {
        const r = radReports.find(rep => String(rep.order_id) === String(o.id));
        const findings = r ? r.findings : 'Laporan sedang dianalisis oleh dokter radiolog.';
        const radName = r ? r.radiologist : 'Dr. Sarah Amalia, Sp.Rad';
        const tech = r ? r.technique : 'PA view';
        return `
          <div style="border:1px solid var(--border); border-radius:12px; padding:16px; background:#ffffff; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom: 12px;">
            <div style="flex:1; min-width: 250px;">
              <h5 style="font-size:14px; font-weight:700; color:#0f2963;">${o.procedure_name}</h5>
              <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">Pemeriksaan Rontgen &bull; Dokter Pemeriksa: ${radName}</p>
              <p style="font-size:12px; color:#334155; margin-top:10px; line-height:1.4;">
                <strong>Hasil Bacaan (${tech}):</strong> ${findings}
              </p>
            </div>
            <button class="btn btn-sm btn-teal" onclick="openXrayViewer()" style="margin:0; font-size:11px; height: fit-content; padding: 8px 16px;">Lihat Gambar Scan</button>
          </div>
        `;
      }).join('');
    } else {
      radContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Belum ada riwayat pemeriksaan radiologi.</div>`;
    }
  }

  // 4. Render Diagnoses & Prescriptions
  const diagContainer = document.getElementById('ehr-diag-container');
  if (diagContainer) {
    if (pres.length > 0) {
      diagContainer.innerHTML = pres.map(p => {
        const diags = (p.diagnosis || '').split(',').map(d => d.trim()).filter(Boolean);
        return diags.map(d => `
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:6px; margin-bottom: 6px;">
            <span style="color:#0f172a; font-weight:600;">${d}</span>
            <span style="color:var(--text-muted)">ICD-10</span>
          </div>
        `).join('');
      }).join('');
    } else {
      diagContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:6px;">
          <span style="color:#0f172a; font-weight:600;">Z00.0 — Pemeriksaan Medis Umum (MCU)</span>
          <span style="color:var(--text-muted)">ICD-10</span>
        </div>
      `;
    }
  }

  const presContainer = document.getElementById('ehr-pres-container');
  if (presContainer) {
    if (presItems.length > 0) {
      presContainer.innerHTML = presItems.map(i => `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom: 8px;">
          <div>
            <strong style="color:#0f172a; font-size:13px;">${i.drug_name}</strong>
            <span style="display:block; font-size:10px; color:var(--text-muted); margin-top:2px;">Aturan: ${i.dosage || 'Sesuai Petunjuk Dokter'}</span>
          </div>
          <span class="badge badge-fit">${i.qty} Tablet</span>
        </div>
      `).join('');
    } else {
      presContainer.innerHTML = `<div style="text-align:center; padding:10px; color:var(--text-muted); font-size:12px;">Tidak ada resep obat aktif.</div>`;
    }
  }

  const adviceContainer = document.getElementById('ehr-advice-container');
  if (adviceContainer) {
    if (pres.length > 0) {
      adviceContainer.textContent = pres[0].notes || 'Lakukan pola hidup sehat, makan makanan bergizi, olahraga teratur, dan istirahat yang cukup.';
    } else {
      adviceContainer.textContent = 'Lakukan pola hidup sehat, makan makanan bergizi, olahraga teratur, dan istirahat yang cukup.';
    }
  }
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
          <h6 style="font-size:13px; font-weight:700; color:var(--text-main); margin-top:4px; line-height:1.3;">${item.name}</h6>
          <p style="font-size:11px; color:var(--text-muted); margin-top:6px; line-height:1.4;">${item.desc}</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:10px; margin-top:6px;">
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
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid var(--border); border-radius:6px; padding:8px 10px; font-size:11px;">
          <div style="overflow:hidden; flex:1; margin-right:8px;">
            <h6 style="color:var(--text-main); font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${item.name}</h6>
            <span style="color:var(--text-muted); font-size:9.5px; display:block; margin-top:2px;">IDR ${item.price.toLocaleString('en-US')}</span>
          </div>
          <button onclick="toggleCartItem('${item.code}')" style="background:none; border:none; color:var(--error); cursor:pointer; font-size:12px;">❌</button>
        </div>
      `).join('');
    }
  }

  // 2. Update Booking Home Care Cart
  if (hcCartContainer) {
    if (bookingCart.length === 0) {
      hcCartContainer.innerHTML = `
        <div style="text-align:center; padding:8px 0;">
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">Belum memilih pemeriksaan.</div>
          <button type="button" class="btn btn-sm btn-teal" onclick="showView('book-test-view','Pesan Lab')" style="margin:0; padding:8px 14px; font-size:12px;">+ Pilih Pemeriksaan</button>
        </div>`;
    } else {
      hcCartContainer.innerHTML = bookingCart.map(item => `
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-main);">
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

// RPC helper (pakai SB_HEADERS/SUPABASE_URL global dari js/core/api.js)
async function appRpc(fn, args){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method:'POST', headers:SB_HEADERS, body:JSON.stringify(args||{}) });
  if(!r.ok){ let d=null; try{ d=await r.json(); }catch(_){} throw new Error((d&&(d.message||d.hint))||('RPC '+fn+' gagal ('+r.status+')')); }
  return r.json();
}
// Ambil GPS pasien sebagai titik penjemputan (pasien memesan dari rumah)
function hcUseMyLocation(){
  const st = document.getElementById('hc-loc-status');
  if(!navigator.geolocation){ if(st) st.textContent='❌ GPS tidak didukung browser'; return; }
  if(st) st.textContent='⏳ Mengambil lokasi…';
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude, lng=pos.coords.longitude;
    document.getElementById('hc-lat').value=lat.toFixed(7);
    document.getElementById('hc-lng').value=lng.toFixed(7);
    if(st) st.innerHTML=`✅ Lokasi tersimpan (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  }, err=>{ if(st) st.textContent='❌ '+err.message+' — nakes bisa set lokasi dari alamat.'; }, {enableHighAccuracy:true, timeout:15000});
}

// ── Autocomplete alamat (saran seperti di peta) ────────────────────────
// Memakai Nominatim (OpenStreetMap) — gratis, tanpa kunci, cakupan Indonesia.
// Memilih saran mengisi alamat SEKALIGUS koordinat (lat/lng) untuk pelacakan.
let _hcAddrTimer = null, _hcAddrSel = [];
function hcAddrSearch(q){
  q = (q||'').trim();
  clearTimeout(_hcAddrTimer);
  if(q.length < 3){ hcAddrHideSuggest(); return; }
  _hcAddrTimer = setTimeout(async ()=>{
    const box = document.getElementById('hc-addr-suggest'); if(!box) return;
    box.style.display='block';
    box.innerHTML = `<div style="padding:10px 12px; font-size:12px; color:#64748b;">Mencari…</div>`;
    try{
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=id&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers:{ 'Accept':'application/json' } });
      const data = await res.json();
      _hcAddrSel = data || [];
      if(!_hcAddrSel.length){ box.innerHTML = `<div style="padding:10px 12px; font-size:12px; color:#64748b;">Tak ada hasil. Coba lebih spesifik, atau pakai GPS.</div>`; return; }
      box.innerHTML = _hcAddrSel.map((d,i)=>`
        <div onmousedown="hcAddrPick(${i})" style="padding:9px 12px; font-size:12.5px; color:#0f172a; cursor:pointer; border-bottom:1px solid #f1f5f9;"
          onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#fff'">
          📍 ${(d.display_name||'').replace(/</g,'&lt;')}
        </div>`).join('');
    }catch(e){ box.innerHTML = `<div style="padding:10px 12px; font-size:12px; color:#ef4444;">Gagal memuat saran — pakai GPS atau ketik manual.</div>`; }
  }, 450);
}
function hcAddrPick(i){
  const d = _hcAddrSel[i]; if(!d) return;
  const full = document.getElementById('hc-addr-full');
  if(full) full.value = d.display_name || '';
  if(d.lat && d.lon){
    document.getElementById('hc-lat').value = (+d.lat).toFixed(7);
    document.getElementById('hc-lng').value = (+d.lon).toFixed(7);
    const st = document.getElementById('hc-loc-status');
    if(st) st.innerHTML = `✅ Lokasi tersimpan dari alamat (${(+d.lat).toFixed(5)}, ${(+d.lon).toFixed(5)})`;
  }
  hcAddrHideSuggest();
}
function hcAddrHideSuggest(){ const b=document.getElementById('hc-addr-suggest'); if(b) b.style.display='none'; }
// Sukses booking → tawarkan halaman pelacakan (track.html di root, relatif dari apps/)
function hcShowBookingSuccess(num, token){
  const link = token ? new URL('../track.html?token='+encodeURIComponent(token), location.href).href : '';
  if(link){
    if(confirm(`✅ Pesanan Home Care ${num} berhasil dibuat!\n\nTim medis akan mengonfirmasi & menugaskan nakes. Anda bisa melacak posisi nakes secara real-time.\n\nBuka halaman pelacakan sekarang?`))
      window.open(link, '_blank');
  } else {
    alert(`✅ Pesanan Home Care ${num} berhasil dibuat! Tim medis akan menghubungi Anda untuk konfirmasi jadwal & nakes.`);
  }
  showView('patient-view', 'Dashboard');
}

async function checkoutHomeCare() {
  if (bookingCart.length === 0) {
    alert('Anda belum memilih pemeriksaan apapun di menu lab test.');
    return;
  }
  const addrDetail = (document.getElementById('hc-addr-detail')?.value||'').trim();
  const addrFull   = (document.getElementById('hc-addr-full')?.value||'').trim();
  if (!addrFull) { alert('Masukkan alamat lengkap penjemputan!'); return; }
  const addr = [addrFull, addrDetail].filter(Boolean).join(' — ');

  const btn = document.getElementById('hc-pay-btn'); const oldTxt = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.textContent = 'Memproses…'; }
  try {
    const tests   = bookingCart.map(i=>i.name).join(', ');
    const subtotal= bookingCart.reduce((s,i)=>s+(i.price||0),0);
    const lat = parseFloat(document.getElementById('hc-lat')?.value) || null;
    const lng = parseFloat(document.getElementById('hc-lng')?.value) || null;
    const name  = (currentUserProfile?.full_name) || currentUsername || 'Pasien App';
    const phone = currentUserProfile?.phone || '';
    const num   = 'HC-'+Date.now().toString().slice(-6);
    const res = await sbPost('homecare_orders', {
      order_number: num, patient_name: name, patient_phone: phone,
      patient_address: addr, service_type: 'Pengambilan Sampel (Home Care)',
      scheduled_date: document.getElementById('hc-date-field')?.value || null,
      status: 'Baru', total_amount: subtotal, lat, lng,
      notes: 'Booking via App Pasien. Pemeriksaan: '+tests,
      created_by_name: name, updated_at: new Date().toISOString(),
    });
    const orderId = res?.[0]?.id;
    let token = '';
    if (orderId) { try { token = await appRpc('homecare_ensure_token', {p_order_id: orderId}); } catch(e){} }
    bookingCart = []; updateCartUIs(); if (typeof renderLabCatalogue==='function') renderLabCatalogue();
    hcShowBookingSuccess(num, token);
  } catch(e) {
    alert('❌ Gagal membuat pesanan: '+e.message);
  } finally { if (btn){ btn.disabled=false; btn.textContent=oldTxt; } }
}

// Update Login Form UI dynamically based on role selection
function updateLoginFormUI(role) {
  const formTitleEl = document.getElementById('login-form-title');
  const labelEl = document.getElementById('username-label');
  const inputEl = document.getElementById('username');
  const footerEl = document.getElementById('login-footer-desc');
  const corpCodeGroup = document.getElementById('corp-code-group');
  const corpCodeInput = document.getElementById('login-corp-code');

  if (!formTitleEl || !labelEl || !inputEl || !footerEl) return;

  // Clear inputs on role change
  inputEl.value = '';
  document.getElementById('password').value = '';
  if (corpCodeInput) {
    corpCodeInput.value = '';
    corpCodeInput.required = false;
  }
  if (corpCodeGroup) corpCodeGroup.style.display = 'none';

  if (role === 'corporate') {
    formTitleEl.textContent = 'Portal Kemitraan Corporate';
    labelEl.textContent = 'Email Perusahaan / PIC';
    inputEl.placeholder = 'Contoh: email kantor atau PIC';
    footerEl.innerHTML = 'Pengajuan mitra baru? Hubungi <a href="#">Tim Marketing</a>';
    if (corpCodeGroup) corpCodeGroup.style.display = 'block';
    if (corpCodeInput) corpCodeInput.required = true;
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

  const isSuperAdmin = (currentUserEmail === 'aceanwar424@gmail.com');
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

async function submitHomeCareForm(event) {
  event.preventDefault();
  const service = (document.getElementById('hc-service')?.value||'').trim();
  const address = (document.getElementById('hc-address')?.value||'').trim();
  closeHomeCareModal();
  try {
    const name = (currentUserProfile?.full_name) || currentUsername || 'Pasien App';
    const num  = 'HC-'+Date.now().toString().slice(-6);
    const res = await sbPost('homecare_orders', {
      order_number: num, patient_name: name, patient_phone: currentUserProfile?.phone || '',
      patient_address: address, service_type: service || 'Layanan Home Care',
      status: 'Baru', notes: 'Booking cepat via App Pasien',
      created_by_name: name, updated_at: new Date().toISOString(),
    });
    const orderId = res?.[0]?.id;
    let token = ''; if (orderId){ try { token = await appRpc('homecare_ensure_token', {p_order_id: orderId}); } catch(e){} }
    hcShowBookingSuccess(num, token);
  } catch(e) { alert('❌ Gagal membuat pesanan: '+e.message); }
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

  const isSuperAdmin = (currentUserEmail === 'aceanwar424@gmail.com');
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
// ── Resolusi identitas corporate + muat data nyata ──────────────
async function loadCorporateData() {
  const container = document.getElementById('corporate-list-container');
  if (typeof sbGet !== 'function') { if (container) container.innerHTML = '<p style="padding:16px;color:var(--text-muted)">Backend belum tersambung.</p>'; return; }

  try {
    const isSuperAdmin = (currentUserEmail === 'aceanwar424@gmail.com');
    // 1) corporate_id dari profil akun; superadmin/demo → picker semua corporate
    let corpId = currentUserProfile?.corporate_id || null;
    if (!corpId) {
      allCorporatesForPicker = await sbGet('corporates','select=id,corporate_name,cashback_balance&status=eq.Aktif&order=corporate_name').catch(()=>[]);
      if (isSuperAdmin || !currentUserProfile) {
        corpId = allCorporatesForPicker?.[0]?.id || null;   // default perusahaan pertama
      }
    }
    currentCorporateId = corpId;

    if (!corpId) {
      if (container) container.innerHTML = '<p style="padding:16px;color:var(--text-muted)">Akun ini belum ditautkan ke perusahaan. Hubungi admin OneLab.</p>';
      corporates = []; updateCorporateStats(); return;
    }

    // 2) info corporate + saldo cashback
    const corp = (await sbGet('corporates', `select=id,corporate_name,cashback_balance&id=eq.${corpId}`).catch(()=>[]))?.[0] || {};
    currentCorporateName = corp.corporate_name || 'Perusahaan';
    corporateCashback = Number(corp.cashback_balance || 0);
    const cbEl = document.getElementById('c-cashback-balance');
    if (cbEl) cbEl.textContent = `Rp ${corporateCashback.toLocaleString('id-ID')}`;

    // 3) roster karyawan nyata
    corporates = await sbGet('corporate_employees',
      `select=*&corporate_id=eq.${corpId}&order=full_name.asc`).catch(()=>[]) || [];
    renderCorporateList();
    loadInvoices();   // invoice korporat nyata
  } catch(e) {
    if (container) container.innerHTML = `<p style="padding:16px;color:var(--error)">❌ ${e.message}</p>`;
  }
}

// Status karyawan → badge (booking > aktif > terdaftar)
function empStatusBadge(e) {
  if (e.booking_admission_id) return { txt:'Booking', bg:'rgba(14,165,233,0.15)', col:'#38bdf8' };
  if (e.status === 'Aktif')   return { txt:'Aktif',   bg:'rgba(34,197,94,0.15)',  col:'#4ade80' };
  return { txt:'Terdaftar', bg:'rgba(148,163,184,0.15)', col:'#94a3b8' };
}

async function renderCorporateList(data = corporates) {
  const container = document.getElementById('corporate-list-container');
  if (!container) return;
  if (!data.length) {
    container.innerHTML = '<p style="padding:16px;color:var(--text-muted);text-align:center">Tidak ada karyawan terdaftar.</p>';
    updateCorporateStats(); return;
  }

  // 1) Ambil list kontrak aktif corporate untuk mendapatkan list paket yang diperbolehkan
  let allowedPkgIds = [];
  try {
    const contracts = await sbGet('corporate_contracts', `select=packages,status&corporate_id=eq.${currentCorporateId}`).catch(()=>[]);
    (contracts || []).forEach(ct => {
      if (ct.status === 'Active' && ct.packages) {
        try {
          const parsed = JSON.parse(ct.packages);
          if (Array.isArray(parsed)) {
            parsed.forEach(id => {
              if (!allowedPkgIds.includes(parseInt(id))) allowedPkgIds.push(parseInt(id));
            });
          }
        } catch(e) {}
      }
    });
  } catch(e) {
    console.error("Gagal memuat paket kontrak", e);
  }

  // 2) Muat detail paket yang diperbolehkan saja
  let pkgs = [];
  if (allowedPkgIds.length > 0) {
    const idFilter = allowedPkgIds.map(id => `id.eq.${id}`).join(',');
    pkgs = await sbGet('packages', `select=id,nama_paket&is_active=eq.true&or=(${idFilter})&order=nama_paket`).catch(()=>[]);
  }

  const pkgOptions = (sel) => {
    if (allowedPkgIds.length === 0) {
      return `<option value="">— hubungi admin untuk aktivasi paket kontrak —</option>`;
    }
    return `<option value="">— assign paket —</option>` +
      (pkgs||[]).map(p=>`<option value="${p.id}" data-name="${(p.nama_paket||'').replace(/"/g,'&quot;')}" ${p.id===sel?'selected':''}>${p.nama_paket}</option>`).join('');
  };

  container.innerHTML = data.map(e => {
    const b = empStatusBadge(e);
    const nm = e.full_name || '—';
    const sub = [(e.employee_id||('#'+e.id)), (e.package_name||'Belum ada paket')].join(' • ');
    const locked = !!e.booking_admission_id;
    return `
      <div class="list-row" style="align-items: center;">
        <div class="list-row-avatar">${nm[0]||'?'}</div>
        <div class="list-row-details">
          <h5>${nm}</h5>
          <p>${sub}</p>
          ${e.mcu_date?`<p style="font-size:11px;margin-top:2px;color:var(--text-muted);">📅 MCU: ${e.mcu_date}</p>`:''}
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
          <span class="badge" style="background:${b.bg};color:${b.col}">${b.txt}</span>
          <div style="display:flex; gap:6px; align-items:center;">
            ${locked
              ? `<span style="font-size:9px;color:var(--text-muted)">🔒 sudah booking</span>`
              : `<select onchange="assignEmpPackagePortal(${e.id},this)" style="font-size:9px;padding:2px 4px;max-width:120px;background:rgba(255,255,255,0.05);color:#fff;border:1px solid var(--border);border-radius:4px">${pkgOptions(e.package_id)}</select>
                 <button class="btn btn-sm btn-unfit" onclick="deleteEmployeePortal(${e.id})" style="font-size:9px; padding:3px 6px; margin:0; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:var(--error);">Hapus</button>`}
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateCorporateStats();
}

function filterEmployeePortal(query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) {
    renderCorporateList(corporates);
    return;
  }
  const filtered = corporates.filter(e => 
    (e.full_name || '').toLowerCase().includes(q) || 
    (e.employee_id || '').toLowerCase().includes(q) || 
    (e.department || '').toLowerCase().includes(q)
  );
  renderCorporateList(filtered);
}

function updateCorporateStats() {
  const totalEl = document.getElementById('c-stat-total');
  const mcuEl = document.getElementById('c-stat-mcu');
  const fitEl = document.getElementById('c-stat-fit');
  const unfitEl = document.getElementById('c-stat-unfit');
  const progressTxt = document.getElementById('c-progress-txt');
  const progressBar = document.getElementById('c-progress-bar');
  if (!totalEl) return;

  const total  = corporates.length;
  const booked = corporates.filter(e => e.booking_admission_id).length;
  const assigned = corporates.filter(e => e.package_id).length;
  const noPkg  = total - assigned;
  const percent = total > 0 ? Math.round((booked / total) * 100) : 0;

  totalEl.textContent = `${total} Orang`;
  mcuEl.textContent = `${booked} Orang`;
  if (fitEl) fitEl.textContent = assigned;   // berpaket
  if (unfitEl) unfitEl.textContent = noPkg;  // belum berpaket
  if (progressTxt) progressTxt.textContent = `${percent}%`;
  if (progressBar) progressBar.style.width = `${percent}%`;
}

async function openAddEmployeeModal() {
  const modal = document.getElementById('add-employee-modal');
  if (!modal) return;
  if (!currentCorporateId) { alert('Akun belum ditautkan ke perusahaan. Hubungi admin OneLab.'); return; }

  // Reset semua field
  ['name','id','dept','dob','pob','phone','email','idnum','address','city','postal']
    .forEach(k=>{ const el=document.getElementById('corp-emp-'+k); if(el) el.value=''; });
  const today = new Date().toISOString().slice(0,10);
  const md = document.getElementById('corp-emp-mcudate'); if (md){ md.value=today; md.min=today; }

  // Isi dropdown paket dari Supabase (terbatas pada paket kontrak)
  const pkgSel = document.getElementById('corp-emp-package');
  if (pkgSel) {
    pkgSel.innerHTML = '<option value="">— pilih paket —</option>';
    try {
      // 1) Ambil list kontrak aktif corporate untuk mendapatkan list paket yang diperbolehkan
      let allowedPkgIds = [];
      const contracts = await sbGet('corporate_contracts', `select=packages,status&corporate_id=eq.${currentCorporateId}`).catch(()=>[]);
      (contracts || []).forEach(ct => {
        if (ct.status === 'Active' && ct.packages) {
          try {
            const parsed = JSON.parse(ct.packages);
            if (Array.isArray(parsed)) {
              parsed.forEach(id => {
                if (!allowedPkgIds.includes(parseInt(id))) allowedPkgIds.push(parseInt(id));
              });
            }
          } catch(e) {}
        }
      });

      // 2) Muat detail paket yang diperbolehkan saja
      if (allowedPkgIds.length > 0) {
        const idFilter = allowedPkgIds.map(id => `id.eq.${id}`).join(',');
        const pkgs = await sbGet('packages', `select=id,nama_paket&is_active=eq.true&or=(${idFilter})&order=nama_paket`).catch(()=>[]);
        (pkgs||[]).forEach(p=>{
          const o = document.createElement('option');
          o.value = p.id;
          o.textContent = p.nama_paket;
          pkgSel.appendChild(o);
        });
      } else {
        const o = document.createElement('option');
        o.value = "";
        o.textContent = "— hubungi admin untuk aktivasi paket kontrak —";
        o.disabled = true;
        pkgSel.appendChild(o);
      }
    } catch(e){
      console.error(e);
    }
  }
  modal.classList.add('open');
}

function closeAddEmployeeModal() {
  const modal = document.getElementById('add-employee-modal');
  if (modal) modal.classList.remove('open');
}

// Daftarkan pasien (field lengkap) → roster corporate_employees + booking admissions.
async function submitAddEmployeeForm(event) {
  event.preventDefault();
  if (!currentCorporateId) { alert('Perusahaan belum teridentifikasi.'); return; }
  const val = k => (document.getElementById('corp-emp-'+k)?.value || '').trim();
  const name = val('name');
  const pkgId = parseInt(val('package')) || null;
  const mcuDate = val('mcudate');
  if (!name) { alert('Nama wajib diisi'); return; }
  if (!pkgId) { alert('Pilih paket MCU'); return; }
  if (!mcuDate) { alert('Pilih tanggal MCU'); return; }

  const pkgSel = document.getElementById('corp-emp-package');
  const pkgName = pkgSel?.selectedOptions?.[0]?.textContent || null;
  const user = currentUsername || 'Portal Corporate';
  const gender = val('gender') || null;
  const stamp = Date.now().toString();

  try {
    // 1) roster karyawan
    const empRow = await sbPost('corporate_employees', {
      corporate_id:  currentCorporateId,
      corporate_name: currentCorporateName,
      full_name:     name,
      employee_id:   val('id') || null,
      department:    val('dept') || null,
      gender,
      birth_date:    val('dob') || null,
      phone:         val('phone') || null,
      email:         val('email') || null,
      package_id:    pkgId,
      package_name:  pkgName,
      status:        'Aktif',
      mcu_date:      mcuDate,
      assigned_by:   user,
      assigned_at:   new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    });
    const empId = empRow?.[0]?.id || empRow?.id;

    // 2) booking admisi langsung (status Booking, field pasien lengkap)
    const created = await sbPost('admissions', {
      visit_number:      `VISIT-${mcuDate.replace(/-/g,'')}-${stamp.slice(-4)}`,
      mr_number:         `MR-${stamp.slice(-8)}`,
      visit_type:        'Project MCU',
      visit_date:        mcuDate,
      patient_name:      name,
      patient_gender:    gender,
      patient_dob:       val('dob') || null,
      patient_place_of_birth: val('pob') || null,
      patient_blood_type: val('blood') || null,
      patient_marital_status: val('marital') || null,
      patient_category:  val('category') || 'WNI',
      patient_phone:     val('phone') || null,
      patient_email:     val('email') || null,
      patient_address:   val('address') || null,
      patient_city:      val('city') || null,
      patient_postal_code: val('postal') || null,
      patient_id_type:   val('idtype') || 'KTP',
      patient_id_number: val('idnum') || null,
      package_id:        pkgId,
      package_name:      pkgName,
      corporate_id:      currentCorporateId,
      corporate_employee_id: empId || null,
      discount_scheme:   'corporate',
      scheme_ref_id:     currentCorporateId,
      scheme_name:       currentCorporateName,
      payment_status:    'Unpaid',
      status:            'Booking',
      registered_by:     user,
      updated_at:        new Date().toISOString(),
    });
    const admId = created?.[0]?.id || created?.id;

    // 3) tautkan balik roster → booking (anti double-book)
    if (empId && admId) {
      await sbPatch('corporate_employees', empId, { booking_admission_id: admId, updated_at: new Date().toISOString() });
    }

    closeAddEmployeeModal();
    await loadCorporateData();
    alert(`✅ "${name}" terdaftar & booking MCU dibuat untuk ${mcuDate}.`);
  } catch(e) { alert('❌ Gagal: ' + e.message); }
}

// Assign paket ke satu karyawan (dropdown inline di roster portal).
async function assignEmpPackagePortal(empId, sel) {
  const pkgId = parseInt(sel.value) || null;
  const pkgName = sel.selectedOptions?.[0]?.dataset?.name || null;
  try {
    await sbPatch('corporate_employees', empId, {
      package_id: pkgId, package_name: pkgId ? pkgName : null,
      assigned_by: currentUsername || 'Portal', assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await loadCorporateData();
  } catch(e) { alert('❌ ' + e.message); }
}

async function deleteEmployeePortal(empId) {
  if (!confirm('Hapus karyawan ini dari daftar? (booking yang sudah dibuat tidak ikut terhapus)')) return;
  try { await sbDelete('corporate_employees', empId); await loadCorporateData(); }
  catch(e) { alert('❌ ' + e.message); }
}

// Booking massal: semua karyawan berpaket yang BELUM dibooking → admissions.
async function scheduleMcuBookingPortal() {
  if (!currentCorporateId) { alert('Perusahaan belum teridentifikasi.'); return; }
  const eligible = corporates.filter(e => e.package_id && !e.booking_admission_id);
  const noPkg = corporates.filter(e => !e.package_id && !e.booking_admission_id).length;
  if (!eligible.length) {
    alert(`Tidak ada karyawan siap booking.${noPkg?`\n${noPkg} karyawan belum di-assign paket.`:''}`);
    return;
  }
  const today = new Date().toISOString().slice(0,10);
  const mcuDate = prompt(`Jadwalkan MCU untuk ${eligible.length} karyawan berpaket.\nTanggal MCU (YYYY-MM-DD):`, today);
  if (!mcuDate) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mcuDate)) { alert('Format tanggal salah (YYYY-MM-DD).'); return; }

  const user = currentUsername || 'Portal Corporate';
  let made = 0;
  for (let i = 0; i < eligible.length; i++) {
    const e = eligible[i];
    const stamp = Date.now().toString();
    try {
      const created = await sbPost('admissions', {
        visit_number:      `VISIT-${mcuDate.replace(/-/g,'')}-${stamp.slice(-4)}${i}`,
        mr_number:         `MR-${stamp.slice(-7)}${i}`,
        visit_type:        'Project MCU',
        visit_date:        mcuDate,
        patient_name:      e.full_name,
        patient_gender:    e.gender || null,
        patient_dob:       e.birth_date || null,
        patient_phone:     e.phone || null,
        patient_email:     e.email || null,
        patient_id_number: e.employee_id || null,
        package_id:        e.package_id,
        package_name:      e.package_name || null,
        corporate_id:      currentCorporateId,
        corporate_employee_id: e.id,
        discount_scheme:   'corporate',
        scheme_ref_id:     currentCorporateId,
        scheme_name:       currentCorporateName,
        payment_status:    'Unpaid',
        status:            'Booking',
        registered_by:     user,
        updated_at:        new Date().toISOString(),
      });
      const admId = created?.[0]?.id || created?.id;
      await sbPatch('corporate_employees', e.id, {
        status: 'Aktif', mcu_date: mcuDate, booking_admission_id: admId || null,
        updated_at: new Date().toISOString(),
      });
      made++;
    } catch(err){ console.error('[scheduleMcuBookingPortal] gagal', e.full_name, err); }
  }
  await loadCorporateData();
  alert(`✅ ${made} booking MCU dibuat untuk ${mcuDate}.`);
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
// Muat invoice korporat nyata → map ke bentuk yang dipakai renderInvoices.
async function loadInvoices() {
  if (!currentCorporateId || typeof sbGet !== 'function') { invoices = []; renderInvoices(); return; }
  try {
    const rows = await sbGet('invoices', `select=*&corporate_id=eq.${currentCorporateId}&order=invoice_date.desc`);
    invoices = (rows||[]).map(r => ({
      id:     r.invoice_number || ('INV-' + r.id),
      name:   r.service_type || r.notes || 'Invoice Korporat',
      date:   r.invoice_date || '',
      amount: Number(r.total_amount || 0),
      status: (r.status === 'Paid' || r.status === 'Lunas') ? 'paid' : 'unpaid',
      _id:    r.id,
    }));
  } catch(e) { invoices = []; }
  renderInvoices();
}

function renderInvoices() {
  const miniContainer = document.getElementById('corp-invoice-list-mini');
  const fullContainer = document.getElementById('corp-invoice-list-full');

  if (!miniContainer) return;
  if (!invoices.length) {
    miniContainer.innerHTML = '<p style="padding:10px;color:var(--text-muted);font-size:12px">Belum ada invoice.</p>';
    const fc = document.getElementById('corp-invoice-list-full');
    if (fc) fc.innerHTML = '<p style="padding:16px;color:var(--text-muted)">Belum ada invoice untuk perusahaan ini.</p>';
    return;
  }

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
    loadInvoices();
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

async function processClaimCashback() {
  if (!currentCorporateId) { alert('Perusahaan belum teridentifikasi.'); return; }
  if (corporateCashback <= 0) {
    alert('Tidak ada saldo cashback yang tersedia untuk diklaim.');
    closeClaimCashbackModal();
    return;
  }
  const amt = corporateCashback;
  try {
    // Catat pengajuan klaim + nolkan saldo (menunggu persetujuan OneLab)
    await sbPost('corporate_cashback_claims', {
      corporate_id: currentCorporateId,
      amount:       amt,
      method:       'Transfer Bank',
      status:       'Requested',
      claimed_by:   currentUsername || 'Portal Corporate',
    });
    await sbPatch('corporates', currentCorporateId, { cashback_balance: 0 });
    corporateCashback = 0;
    const cbEl = document.getElementById('c-cashback-balance');
    if (cbEl) cbEl.textContent = 'Rp 0';
    closeClaimCashbackModal();
    alert(`✅ Klaim cashback Rp ${amt.toLocaleString('id-ID')} diajukan. Menunggu persetujuan OneLab.`);
  } catch(e) { alert('❌ Gagal mengajukan klaim: ' + e.message); }
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

  // Verify Corporate Code if role is corporate
  if (selectedRole === 'corporate') {
    const corpCode = document.getElementById('login-corp-code')?.value.trim();
    const isSuperAdmin = (usernameInput === 'aceanwar424@gmail.com');
    if (!corpCode && !isSuperAdmin) {
      alert('Kode Corporate wajib diisi.');
      return;
    }
    if (corpCode) {
      try {
        const corps = await sbGet('corporates', `select=id,corporate_name,kode_corp,status&kode_corp=eq.${corpCode}`);
        if (!corps || !corps.length) {
          alert('Kode Corporate tidak terdaftar atau tidak valid.');
          return;
        }
        const activeCorp = corps[0];
        if (activeCorp.status !== 'Aktif') {
          alert('Akun Corporate ini sedang dinonaktifkan atau ditangguhkan. Hubungi admin OneLab.');
          return;
        }
        currentCorporateId = activeCorp.id;
        currentCorporateName = activeCorp.corporate_name;
        console.log("Connected to Corporate:", currentCorporateName, "ID:", currentCorporateId);
      } catch(err) {
        alert('Gagal memverifikasi Kode Corporate: ' + err.message);
        return;
      }
    } else if (isSuperAdmin) {
      // Default to first active corporate
      try {
        const allCorps = await sbGet('corporates','select=id,corporate_name,status&status=eq.Aktif&limit=1');
        if (allCorps && allCorps.length) {
          currentCorporateId = allCorps[0].id;
          currentCorporateName = allCorps[0].corporate_name;
        }
      } catch(e) {}
    }
  }

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
          currentUserProfile = profileData;
          finalUsername = profileData.full_name || authData.user.email;
          finalRole = selectedRole || profileData.role || 'patient';
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
  currentUserEmail = usernameInput;
  currentRole = finalRole;
  if (!currentUserProfile) {
    currentUserProfile = { id: 'mock', full_name: finalUsername };
  }
  
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

    loadCorporateData();   // muat corporate_id, roster, cashback nyata
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
    await loadPatientEHR(currentUsername);

    // Personalize Profile fields will be loaded from DB via loadPatientEHR
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

// Page load initialization
document.addEventListener('DOMContentLoaded', () => {
  renderSidebarMenu();
  showScreen('login-screen');
});
