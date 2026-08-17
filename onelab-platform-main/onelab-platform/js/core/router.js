// ═══════════════════════════════════════════
// CORE: Router v10
// ═══════════════════════════════════════════

const PAGE_TITLES = {
  dashboard:'Dashboard', partners:'Partner Database', maps:'Maps Prospecting',
  marketing:'Marketing Kit', voucher:'Voucher Builder', surat:'Surat Masuk & Keluar',
  mou:'MOU & Perjanjian', 'test-reviewer':'Peninjau Deskripsi Medis', administration:'Administrasi & Legal', leads:'Leads Management', okr:'OKR & Target Sales',
  mcu:'Project MCU', avahealth:'AVA Health Ecosystem', 'ava-consult':'Telekonsultasi Dokter',
  'ava-devices':'Alat Medis & Wearables', 'ava-calibration':'Badge AVA Verified', 'ava-marketplace':'Marketplace Alkes',
  'ava-caregiver':'Caregiver & Keluarga', 'ava-corporate':'Corporate B2B Wellness', 'ava-portals':'Multi-Portal Switcher', finance:'Finance & Billing',
  inventory:'Inventory & Logistik', hrd:'HRD & SDM', homecare:'Home Care',
  admission:'Admission / Registrasi', anamnesa:'Anamnesa', lab:'Operasional Lab',
  wiki:'Wiki OneLab', agentic:'Agentic AI',
  config:'Configuration', product:'Master Produk & Tes', refrange:'Reference Range', labreport:'Setting Hasil PDF', corporate:'Corporate Management',
  radiology:'Radiology', supportive:'Supportive Examination',
  medrecord:'Rekam Medis', cashier:'Kasir',
  queue:'Antrian', appointments:'Perjanjian', 'queue-kiosk':'Kiosk Antrian', accounting:'Akuntansi', payables:'Hutang Usaha', assets:'Aset & Kalibrasi', referral:'Rujukan Lab Luar', payroll:'Penggajian', 'rl-reports':'Laporan Kemenkes', inpatient:'Rawat Inap', pharmacy:'Farmasi', 'crm-pipeline':'Pipeline & Pendapatan',
  package:'Package Service', family:'Family Registry',
  settings:'Pengaturan', users:'User Management',
  audit:'Jejak Audit', 'db-studio':'Database Studio (Supabase GUI)',
  satusehat:'SATUSEHAT — Kemenkes RI',
  'ar-aging':'Umur Piutang', 'lab-tat':'Turnaround Time Lab', penawaran:'Penawaran Harga', 'ops-kendali':'Pusat Kendali Operasional', 'sales-corong':'Corong Penjualan', 'portal-akses':'Akses Portal',
  'hc-schedule':'Home Care — Jadwal', 'hc-staff':'Home Care — Petugas',
  'hc-tariff':'Home Care — Tarif', 'hc-billing':'Home Care — Penagihan',
  'hc-report':'Home Care — Laporan',
};

let currentPage = '';

// async: modul halaman dimuat saat dibutuhkan (lihat js/core/lazy.js).
// Pemanggil lama tidak perlu diubah — mereka mengabaikan nilai kembalian.
async function navigate(page, params={}) {
  // Sync rail + flyout active states (new sidebar structure)
  if (typeof syncFlyoutToPage === 'function') syncFlyoutToPage(page);

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

  if (window.innerWidth < 768) {
    document.getElementById('sidebar-rail')?.classList.remove('open');
    if (typeof closeFlyout === 'function') closeFlyout();
  }

  currentPage = page;

  // Muat modul halaman ini lebih dulu. Untuk halaman yang modulnya sudah
  // termuat (atau eager), ini selesai seketika.
  if (typeof pastikanModulHalaman === 'function') {
    try { await pastikanModulHalaman(page); }
    catch (e) { console.warn('[Router] pemuatan modul gagal:', e); }
  }

  // Halaman lain mungkin sudah dibuka sementara modul ini dimuat; jangan
  // menimpa layar yang sedang aktif dengan hasil navigasi yang sudah basi.
  if (currentPage !== page) return;

  async function safeRun(fnName, ...args) {
    try {
      if (typeof window[fnName] !== 'function' && typeof muatSemuaModul === 'function') {
        await muatSemuaModul();                     // jaring pengaman lintas-modul
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
    case 'test-reviewer': safeRun('renderTestReviewer');         break;
    case 'administration': openCategory('administration'); break;
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
    case 'shift-calendar': safeRun('renderShiftCalendar');         break;
    case 'tasks':       safeRun('renderTaskManagement');          break;
    case 'wiki':        safeRun('renderWiki', params.tab||'docs');   break;
    case 'agentic':     safeRun('renderAgentic', params.tab||'inbox'); break;
    case 'audit':       safeRun('renderAuditTrail');              break;
    case 'satusehat':   safeRun('renderSatuSehat');               break;
    case 'ar-aging':    safeRun('renderArAging');                 break;
    case 'penawaran':   safeRun('renderPenawaran');               break;
    case 'ops-kendali': safeRun('renderOpsKendali');               break;
    case 'sales-corong':safeRun('renderSalesCorong');              break;
    case 'portal-akses':safeRun('renderPortalAkses');              break;
    case 'lab-tat':     safeRun('renderLabTat');                  break;

    // Home Care: sub-halaman ini dulu memanggil renderHC*() LANGSUNG dari
    // atribut onclick menu, melewati router — sehingga judul topbar tidak
    // ikut berubah, sorotan menu tidak sinkron, dan galat modul tidak
    // tertangkap safeRun. Kini lewat jalur yang sama seperti halaman lain.
    case 'hc-schedule': safeRun('renderHCSchedule');              break;
    case 'hc-staff':    safeRun('renderHCStaff');                 break;
    case 'hc-tariff':   safeRun('renderHCTariff');                break;
    case 'hc-billing':  safeRun('renderHCBilling');               break;
    case 'hc-report':   safeRun('renderHCFullReport');            break;
    case 'attendance':   safeRun('renderAttendance');               break;
    case 'org-structure':safeRun('renderOrgStructure');             break;
    case 'regulatory':   safeRun('renderRegulatoryReports');        break;
    case 'rl-reports':   safeRun('renderRLReports');                break;
    case 'homecare':    safeRun('renderHomeCare');               break;
    case 'admission':   safeRun('renderAdmission');              break;
    case 'lab':         safeRun('renderLab', params.tab||'checkin'); break;
    case 'product':     safeRun('renderConfigProduct');          break;
    case 'config':      safeRun('renderSettings', 'masterdata');   break;
    case 'refrange':    safeRun('renderConfigRefRange');          break;
    case 'labreport':   safeRun('renderSettings', 'pdf');          break;
    case 'corporate':   safeRun('renderConfigCorporate');        break;
    case 'radiology':   safeRun('renderRIS');                    break;
    case 'radiology-old':safeRun('renderRadiology');             break;
    case 'supportive':  safeRun('renderSupportive');             break;
    case 'spirometry':  safeRun('renderSupportive');             break;
    case 'medrecord':   safeRun('renderMedRecord');              break;
    case 'inpatient':   safeRun('renderInpatient');              break;
    case 'pharmacy':    safeRun('renderPharmacy');               break;
    case 'crm-pipeline':safeRun('renderCrmPipeline');            break;
    case 'queue':       safeRun('renderQueuePage');                  break;
    case 'queue-kiosk': safeRun('renderQueueKiosk');                 break;
    case 'appointments':safeRun('renderAppointments');           break;
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
    case 'users':       safeRun('renderSettings', 'users');        break;
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
