// ═══════════════════════════════════════════════════════════════
// CORE: Router v12 — AVA GLOBAL ECOSYSTEM (Blueprint V5.1 Dual-Routing)
// ═══════════════════════════════════════════════════════════════

// Pemetaan Rute 3-Segmen Blueprint V5.1 (ADR-05) ke Rute Flat Legacy
const ROUTE_ALIASES_3SEG = {
  // AVA LAB
  'lab/pre/order': 'lab',
  'lab/pre/registration': 'admission',
  'lab/pre/checkin': 'lab',
  'lab/ana/worklist': 'lab',
  'lab/ana/interface': 'lab',
  'lab/ana/manual-entry': 'lab',
  'lab/qc/entry': 'lab',
  'lab/qc/levey-jennings': 'lab',
  'lab/post/validation': 'lab',
  'lab/post/release': 'lab',
  'lab/master/test-catalog': 'product',
  'lab/master/panels': 'package',
  'lab/master/specimen': 'product',
  'lab/master/referrer': 'perujuk',
  'lab/ref/intervals': 'refrange',
  'lab/ref/critical-values': 'lab',
  'lab/ref/fitwork-engine': 'mcu',
  'lab/inv/stock': 'inventory',
  'lab/inv/reorder': 'inventory',
  'lab/inv/equipment': 'assets',
  'lab/qms/documents': 'wiki',
  'lab/qms/readiness': 'compliance-tracker',
  'lab/analytics/tat': 'lab-tat',
  'lab/analytics/referrer': 'perujuk',

  // AVA HEALTH
  'health/his/admission': 'admission',
  'health/his/emr': 'emr-soap',
  'health/his/orders': 'his',
  'health/his/pharmacy': 'pharmacy',
  'health/his/pacs': 'radiology',
  'health/his/inpatient': 'inpatient',
  'health/queue/console': 'queue',
  'health/queue/display': 'queue',
  'health/kiosk/ticket': 'queue-kiosk',
  'health/apps/patient': 'portal-akses',
  'health/apps/nakes': 'hc-staff',
  'health/corp/clients': 'corporate',
  'health/corp/quotation': 'penawaran',
  'health/corp/project': 'mcu',
  'health/corp/fitwork': 'mcu',
  'health/corp/claims': 'bpjs-claim',
  'health/corp/compliance': 'compliance-tracker',
  'health/billing/cashier': 'cashier',
  'health/billing/shift': 'cashier',
  'health/billing/ar': 'ar-aging',

  // AVA CARE
  'care/order/intake': 'homecare',
  'care/dispatch/schedule': 'hc-schedule',
  'care/service/catalog': 'hc-tariff',
  'care/staff/registry': 'hc-staff',
  'care/quality/report': 'hc-report',

  // AVA NUTRITION
  'nutri/sales/oms': 'ecommerce-oms',
  'nutri/sales/subscription': 'subscription',
  'nutri/supply/warehouse': 'inventory',
  'nutri/analytics/inventory': 'inventory',

  // AVA SANCTUARY
  'sanct/booking/calendar': 'sanctuary-booking',
  'sanct/program/catalog': 'sanctuary-booking',
  'sanct/program/membership': 'sanctuary-booking',
  'sanct/commerce/pos': 'cashier',

  // AVA TECH
  'tech/platform/tenants': 'lisensi',
  'tech/platform/iam': 'users',
  'tech/platform/audit': 'audit',
  'tech/integration/satusehat': 'satusehat',
  'tech/ai/orchestrator': 'agentic',

  // AVA HQ
  'hq/cockpit/dashboard': 'dashboard',
  'hq/cockpit/ops-control': 'ops-kendali',
  'hq/cockpit/executive': 'executive-dashboard',
  'hq/finance/consolidation': 'holding-finance',
  'hq/legal/compliance-calendar': 'compliance-tracker'
};

const PAGE_TITLES = {
  dashboard:'Dashboard', partners:'Partner Database', maps:'Maps Prospecting',
  marketing:'Marketing Kit', voucher:'Voucher Builder', surat:'Surat Masuk & Keluar',
  mou:'MOU & Perjanjian', administration:'Administrasi & Legal', leads:'Leads Management', okr:'OKR & Target Sales',
  mcu:'Project MCU', avahealth:'AVA Health Ecosystem', 'ava-consult':'Telekonsultasi Dokter',
  'ava-devices':'Alat Medis & Wearables', 'ava-calibration':'Badge AVA Verified', 'ava-marketplace':'Marketplace Alkes',
  'ava-caregiver':'Caregiver & Keluarga', 'ava-corporate':'Corporate B2B Wellness', 'ava-portals':'Multi-Portal Switcher', finance:'Finance & Billing',
  inventory:'Inventory & Logistik', hrd:'HRD & SDM', homecare:'Home Care',
  admission:'Admission / Registrasi', anamnesa:'Anamnesa', lab:'Operasional Lab',
  wiki:'Wiki AVA Ecosystem', agentic:'Agentic AI',
  config:'Configuration', product:'Master Produk & Tes', refrange:'Reference Range', labreport:'Setting Hasil PDF', corporate:'Corporate Management',
  radiology:'Radiology', supportive:'Supportive Examination',
  medrecord:'Rekam Medis', cashier:'Kasir',
  queue:'Antrian', appointments:'Perjanjian', 'queue-kiosk':'Kiosk Antrian', accounting:'Akuntansi', payables:'Hutang Usaha', assets:'Aset & Kalibrasi', referral:'Rujukan Lab Luar', payroll:'Penggajian', 'rl-reports':'Laporan Kemenkes', inpatient:'Rawat Inap', pharmacy:'Farmasi', 'crm-pipeline':'Pipeline & Pendapatan',
  package:'Package Service', family:'Family Registry',
  settings:'Pengaturan', users:'User Management',
  audit:'Jejak Audit', 'db-studio':'Database Studio (Supabase GUI)',
  satusehat:'SATUSEHAT — Kemenkes RI',
  'ar-aging':'Umur Piutang', 'lab-tat':'Turnaround Time Lab', penawaran:'Penawaran Harga', 'ops-kendali':'Pusat Kendali Operasional', 'sales-corong':'Corong Penjualan', 'portal-akses':'Akses Portal', perujuk:'Dokter & Klinik Perujuk', lisensi:'Lisensi',
  'hc-schedule':'Home Care — Jadwal', 'hc-staff':'Home Care — Petugas',
  'hc-tariff':'Home Care — Tarif', 'hc-billing':'Home Care — Penagihan',
  'hc-report':'Home Care — Laporan',
  'farmasi':'Farmasi & E-Prescription',
  'emr-soap':'Rekam Medis (EMR SOAP)',
  'subscription':'Subscription & Auto-Refill',
  'sanctuary-booking':'Queen Sanctuary & Spa',
  'holding-finance':'Konsolidasi Finansial Holding',
  'ecommerce-oms':'E-Commerce OMS & Apotek',
  'pabrik':'Pabrik — Produksi & Maklon',
  'wellness-rnd':'Formulasi & R&D Produk',
  'wellness-maklon':'Kemitraan Maklon',
  'wellness-mutu':'Uji Mutu Produk',
  'bpjs-claim':'Klaim Asuransi & BPJS INA-CBG',
  'compliance-tracker':'Compliance & Legal Tracker',
  'pacs-viewer':'PACS & DICOM Imaging Viewer',
  'catalog-export':'Master Catalog & LIS Exporter',
  'lis-settings':'Pengaturan LIS & Connector (:9999)',
  'anamnesa':'Order Pemeriksaan Lab (Walk-in)',
  'lis-admission':'Order Pemeriksaan Lab (Walk-in)',
  'order-lab':'Order Pemeriksaan Lab (Walk-in)',
  'executive-dashboard':'👑 CEO Master Orchestration Cockpit',
  cockpit:'👑 CEO Master Orchestration Cockpit',
  his:'Sistem Informasi Manajemen Rumah Sakit & Faskes (HIS)',
  klinik:'Pelayanan Poliklinik Rawat Jalan & EMR',
  fmcg:'Queen Nutrition & FMCG Logistics',
};

let currentPage = '';

async function navigate(page, params={}) {
  // Resolusi 3-segmen rute ke target handler (Strangler Fig)
  const resolvedPage = ROUTE_ALIASES_3SEG[page] || page;

  if (typeof syncFlyoutToPage === 'function') syncFlyoutToPage(resolvedPage);

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[resolvedPage] || resolvedPage;

  if (window.innerWidth < 768) {
    document.getElementById('sidebar-rail')?.classList.remove('open');
    if (typeof closeFlyout === 'function') closeFlyout();
  }

  currentPage = resolvedPage;

  // ── Router Guard: RBAC Check dengan RBACService jika tersedia ──
  const userRole = typeof getUserRole === 'function' ? getUserRole() : (localStorage.getItem('AVA_CURRENT_USER_ROLE') || 'viewer');
  if (window.RBACService && typeof window.RBACService.canAccessRoute === 'function') {
    const isAllowed = window.RBACService.canAccessRoute(userRole, page);
    if (!isAllowed && !['SUPERADMIN', 'HQ_EXECUTIVE', 'head_operation', 'super_admin'].includes(userRole)) {
      console.warn(`[Router Guard RBAC] Akses ke route '${page}' ditolak untuk peran '${userRole}'.`);
      renderRouterError(page, `Akses Terbatas: Peran '${userRole}' tidak memiliki hak akses ke '${page}'.`);
      return;
    }
  }

  const RESTRICTED_HO_PAGES = ['agentic', 'wiki', 'marketing', 'voucher', 'mou', 'executive-dashboard', 'holding-finance', 'cockpit'];
  if (RESTRICTED_HO_PAGES.includes(resolvedPage) && !['head_operation', 'super_admin', 'direktur', 'SUPERADMIN', 'HQ_EXECUTIVE'].includes(userRole)) {
    console.warn(`[Router Guard] Akses ke modul '${resolvedPage}' dibatasi khusus Head of Operations.`);
    renderRouterError(resolvedPage, `Akses Terbatas: Modul '${resolvedPage}' merupakan otoritas eksklusif Head of Operations / Super Admin.`);
    return;
  }

  if (typeof pastikanModulHalaman === 'function') {
    try { await pastikanModulHalaman(resolvedPage); }
    catch (e) { console.warn('[Router] pemuatan modul gagal:', e); }
  }

  if (currentPage !== resolvedPage) return;

  async function safeRun(fnName, ...args) {
    try {
      if (typeof window[fnName] !== 'function' && typeof muatSemuaModul === 'function') {
        await muatSemuaModul();
        if (currentPage !== page) return;
      }
      if (typeof window[fnName] === 'function') {
        window[fnName](...args);
      } else {
        console.warn(`[Router] Module function ${fnName} not found.`);
        renderRouterError(page, `Modul '${page}' (${fnName}) belum dimuat.`);
      }
    } catch (err) {
      console.error(`[Router] Error executing ${fnName}:`, err);
      renderRouterError(page, err.message || String(err));
    }
  }

  switch(page) {
    case 'dashboard':   safeRun('renderDashboard');              break;
    case 'partners':    safeRun('renderPartners', params);         break;
    case 'maps':        safeRun('renderMaps');                   break;
    case 'marketing':   safeRun('renderMarketing');              break;
    case 'voucher':     safeRun('renderVoucher');                break;
    case 'surat':       safeRun('renderSurat');                  break;
    case 'mou':         safeRun('renderMOU');                    break;
    case 'administration': if (typeof openCategory === 'function') openCategory('administration'); break;
    case 'leads':       safeRun('renderLeads');                  break;
    case 'okr':         safeRun('renderOKR');                    break;
    case 'mcu':         safeRun('renderMCU', params);              break;
    case 'avahealth':       safeRun('renderAVAHealth', 'consult');     break;
    case 'ava-consult':     safeRun('renderAVAHealth', 'consult');     break;
    case 'ava-devices':     safeRun('renderAVAHealth', 'devices');     break;
    case 'ava-calibration': safeRun('renderAVAHealth', 'calibration'); break;
    case 'ava-marketplace': safeRun('renderAVAHealth', 'marketplace'); break;
    case 'ava-caregiver':   safeRun('renderAVAHealth', 'caregiver');   break;
    case 'ava-corporate':   safeRun('renderAVAHealth', 'corporate');   break;
    case 'ava-portals':     safeRun('renderAVAHealth', 'portals');     break;
    case 'finance':     safeRun('renderFinance', params.tab);      break;
    case 'inventory':   safeRun('renderInventory', params.tab||'stock'); break;
    case 'hrd':         safeRun('renderHRD');                    break;
    case 'work-schedule': safeRun('renderWorkSchedule');          break;
    case 'shift-calendar':safeRun('renderShiftCalendar');         break;
    case 'tasks':       safeRun('renderTaskManagement');          break;
    case 'wiki':        safeRun('renderWiki');                   break;
    case 'agentic':     safeRun('renderAgentic', params.tab);     break;
    case 'satusehat':   safeRun('renderSatusehat');              break;
    case 'ar-aging':    safeRun('renderArAging');                break;
    case 'lab-tat':     safeRun('renderLabTat');                 break;
    case 'penawaran':   safeRun('renderPenawaran');              break;
    case 'ops-kendali': safeRun('renderOpsKendali');             break;
    case 'sales-corong':safeRun('renderSalesCorong');            break;
    case 'portal-akses':safeRun('renderPortalAkses');            break;
    case 'perujuk':     safeRun('renderPerujuk');                break;
    case 'lis-settings':safeRun('renderLisSettings');            break;
    case 'anamnesa':
    case 'lis-admission':
    case 'order-lab':   safeRun('renderLisAdmission');           break;
    case 'lisensi':     safeRun('renderLisensi');                break;
    case 'executive_dashboard':
    case 'executive-dashboard': safeRun('renderExecutiveDashboard');     break;
    case 'hc-schedule': safeRun('renderHCSchedule');              break;
    case 'hc-staff':    safeRun('renderHCStaff');                 break;
    case 'hc-tariff':   safeRun('renderHCTariff');                break;
    case 'hc-billing':  safeRun('renderHCBilling');               break;
    case 'hc-report':   safeRun('renderHCFullReport');            break;
    case 'attendance':   safeRun('renderAttendance');               break;
    case 'org-structure':safeRun('renderOrgStructure');             break;
    case 'regulatory':   safeRun('renderRegulatoryReports');        break;
    // Dua menu berikut sudah lama ada di rel navigasi tapi tidak punya case
    // di sini, sehingga kliknya tidak melakukan apa pun. Fungsi rendernya
    // sendiri sudah ada dan berfungsi — yang hilang cuma sambungannya.
    case 'audit':        safeRun('renderAuditTrail');               break;
    case 'campaigns':    safeRun('renderVoucher');                  break;
    case 'rl-reports':   safeRun('renderRLReports');                break;
    case 'homecare_order':
    case 'homecare-order':
    case 'homecare':    safeRun('renderHomeCare');               break;
    case 'his':
    case 'klinik':
    case 'poliklinik':
    case 'clinic':
      if (typeof openCategory === 'function') openCategory('klinik');
      else safeRun('renderAdmission');
      break;
    case 'utama':
      if (typeof openCategory === 'function') openCategory('utama');
      else safeRun('renderDashboard');
      break;
    case 'fmcg':
    case 'marketing_cat':
      if (typeof openCategory === 'function') openCategory('marketing');
      else safeRun('renderMarketing');
      break;
    case 'cockpit':
    case 'ceo_cockpit':
      safeRun('renderExecutiveDashboard');
      break;
    case 'pendaftaran':
    case 'registrasi':
    case 'admission':   safeRun('renderAdmission');              break;
    case 'laboratorium':
    case 'lab':         safeRun('renderLab', params.tab || 'checkin'); break;
    case 'worklist':    safeRun('renderLab', 'worklist'); break;
    case 'validasi':    safeRun('renderLab', 'validation'); break;
    case 'product':     safeRun('renderConfigProduct');          break;
    case 'config':      safeRun('renderSettings', 'masterdata');   break;
    case 'refrange':    safeRun('renderConfigRefRange');          break;
    case 'labreport':   safeRun('renderSettings', 'pdf');          break;
    case 'corporate':   safeRun('renderConfigCorporate');        break;
    case 'radiology':   safeRun('renderRIS');                    break;
    case 'supportive':  safeRun('renderSupportive');             break;
    case 'spirometry':  safeRun('renderSupportive');             break;
    case 'medrecord':   safeRun('renderMedRecord');              break;
    case 'inpatient':   safeRun('renderInpatient');              break;
    // Dulu menunjuk renderFarmasi di farmasi_eprescription.js — 367 baris
    // tanpa satu pun panggilan data. Sementara itu pharmacy.js yang nyata
    // (6 tabel, 6 RPC, termasuk skrining interaksi obat dan alergi) tidak
    // punya rute sama sekali, jadi tidak pernah bisa dibuka. Yang tampil
    // di layar justru yang karangan.
    case 'pharmacy':
    case 'farmasi':     safeRun('renderPharmacy', params);       break;
    case 'emr':
    case 'emr_soap':
    case 'emr-soap':    safeRun('renderEmrSoap', params);        break;
    case 'subscription':safeRun('renderSubscription', params);   break;
    case 'sanctuary':
    case 'sanctuary_booking':
    case 'sanctuary-booking': safeRun('renderSanctuaryBooking', params); break;
    case 'holding_finance':
    case 'holding-finance':   safeRun('renderHoldingFinance', params);   break;
    case 'oms':
    case 'd2c':
    case 'ecommerce_oms':
    case 'ecommerce-oms':     safeRun('renderEcommerceOms', params);     break;
    case 'pabrik':
    case 'wellness-rnd':      safeRun('renderPabrik', { tab: 'formula' });  break;
    case 'wellness-maklon':   safeRun('renderPabrik', { tab: 'maklon' });   break;
    case 'wellness-mutu':     safeRun('renderPabrik', { tab: 'mutu' });     break;
    case 'bpjs':
    case 'bpjs_claim':
    case 'bpjs-claim':        safeRun('renderBpjsClaim', params);        break;
    case 'compliance_tracker':
    case 'compliance-tracker':safeRun('renderComplianceTracker', params);break;
    case 'pacs':
    case 'pacs_viewer':
    case 'pacs-viewer':       safeRun('renderPacsViewer', params);       break;
    case 'catalog_export':
    case 'catalog-export':    safeRun('renderCatalogExport', params);    break;
    case 'crm-pipeline':safeRun('renderCrmPipeline');            break;
    case 'queue':       safeRun('renderQueuePage');                  break;
    case 'queue-console': safeRun('renderQueueConsole');          break;
    case 'queue-config':  safeRun('renderQueueConfig');           break;
    case 'queue-kiosk': safeRun('renderQueueKiosk');                 break;
    case 'appointments':safeRun('renderAppointments');           break;
    case 'kasir':
    case 'billing':
    case 'cashier':     safeRun('renderCashier', params.buka);     break;
    case 'accounting':  safeRun('renderAccounting');             break;
    case 'payables':    safeRun('renderPayables');               break;
    case 'assets':      safeRun('renderAssets', params.tab||'list'); break;
    case 'referral':    safeRun('renderReferral');               break;
    case 'payroll':     safeRun('renderPayroll');                break;
    case 'package':     safeRun('renderConfigPackage');          break;
    case 'family':      safeRun('renderConfigFamily');            break;
    case 'anamnesa':    safeRun('renderAnamnesa');               break;
    case 'import':      safeRun('renderSettings', 'data');         break;
    case 'settings':    safeRun('renderSettings', params.tab || 'general'); break;
    case 'tech':
    case 'tech_saas':
    case 'license-manager':
    case 'saas-console':safeRun('renderTechSaas', params);           break;
    case 'lis-phlebotomy':
    case 'phlebotomy':  safeRun('renderPhlebotomy');                 break;
    case 'lis-kelayakan':
    case 'specimen-verification': safeRun('renderSpecimenVerification'); break;
    case 'lis-analyzer':
    case 'analyzer-interfacing': safeRun('renderAnalyzerInterfacing'); break;
    case 'lis-lot-verification':
    case 'lot-verification': safeRun('renderLotVerification');       break;
    case 'lis-pme':
    case 'pme':
    case 'proficiency-testing': safeRun('renderPmeProficiency');      break;
    case 'lis-critical-value':
    case 'critical-value': safeRun('renderCriticalValue');           break;
    case 'lis-sample-archive':
    case 'sample-archiving': safeRun('renderSampleArchiving');       break;
    case 'his-orders':  safeRun('renderIntegratedOrders');           break;
    case 'rad-ekspertise': safeRun('renderRadiologyExpertise');      break;
    case 'his-mpi':     safeRun('renderMpiManagement');              break;
    case 'tech-aktivasi': safeRun('renderTechLicenseActivation');    break;
    case 'tech-telemetri': safeRun('renderTechTelemetry');           break;
    case 'tech-harga':  safeRun('renderTechPricingPlans');           break;
    case 'tenants':     safeRun('renderTenants');                    break;
    case 'db-studio':    safeRun('renderDatabaseStudio');           break;
    default:
      renderRouterError(page, 'Halaman ini belum tersedia.');
  }
}

function renderRouterError(page, msg) {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <div class="empty-state" style="min-height:70vh; padding:40px; text-align:center;">
      <div class="ico" style="font-size:48px; margin-bottom:12px;">⚠️</div>
      <h3 style="margin:0 0 8px; color:var(--text, #F8FAFC);">Gagal Memuat Modul '${page}'</h3>
      <p style="color:var(--text3, #94A3B8); font-size:13.5px; margin:0 0 18px;">${msg}</p>
      <div style="display:flex; gap:10px; justify-content:center;">
        <button class="btn btn-ghost" onclick="location.reload()">🔄 Muat Ulang Halaman</button>
        <button class="btn btn-teal" onclick="navigate('dashboard')">← Kembali ke Dashboard</button>
      </div>
    </div>`;
}

function toggleSidebar() {
  document.getElementById('sidebar-rail')?.classList.toggle('open');
}

window.navigate = navigate;
window.PAGE_TITLES = PAGE_TITLES;
window.toggleSidebar = toggleSidebar;
