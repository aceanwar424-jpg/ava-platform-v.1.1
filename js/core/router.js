// ═══════════════════════════════════════════
// CORE: Router v10
// ═══════════════════════════════════════════

const PAGE_TITLES = {
  dashboard:'Dashboard', partners:'Partner Database', maps:'Maps Prospecting',
  marketing:'Marketing Kit', voucher:'Voucher Builder', surat:'Surat Keluar',
  mou:'MOU / Perjanjian', leads:'Leads Management', okr:'OKR & Target Sales',
  mcu:'Project MCU', finance:'Finance & Billing',
  inventory:'Inventory & Logistik', hrd:'HRD & SDM', homecare:'Home Care',
  admission:'Admission / Registrasi', anamnesa:'Anamnesa', lab:'Operasional Lab',
  wiki:'Wiki OneLab', agentic:'Agentic AI',
  config:'Configuration', product:'Master Produk & Tes', refrange:'Reference Range', labreport:'Setting Hasil PDF', corporate:'Corporate Management',
  radiology:'Radiology', supportive:'Supportive Examination',
  medrecord:'Rekam Medis', cashier:'Kasir',
  queue:'Antrian', appointments:'Perjanjian', 'queue-kiosk':'Kiosk Antrian', accounting:'Akuntansi', payroll:'Penggajian', 'rl-reports':'Laporan Kemenkes',
  package:'Package Service', family:'Family Registry',
  settings:'Pengaturan', users:'User Management',
};

let currentPage = '';

function navigate(page, params={}) {
  // Sync rail + flyout active states (new sidebar structure)
  if (typeof syncFlyoutToPage === 'function') syncFlyoutToPage(page);

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

  if (window.innerWidth < 768) {
    document.getElementById('sidebar-rail')?.classList.remove('open');
    if (typeof closeFlyout === 'function') closeFlyout();
  }

  currentPage = page;

  switch(page) {
    case 'dashboard':   renderDashboard();              break;
    case 'partners':    renderPartners(params);         break;
    case 'maps':        renderMaps();                   break;
    case 'marketing':   renderMarketing();              break;
    case 'voucher':     renderVoucher();                break;
    case 'surat':       renderSurat();                  break;
    case 'mou':         renderMOU();                    break;
    case 'leads':       renderLeads();                  break;
    case 'okr':         renderOKR();                    break;
    case 'mcu':         renderMCU(params);              break;
    case 'finance':     renderFinance();                break;
    case 'inventory':   renderInventory(params.tab||'stock'); break;
    case 'hrd':         renderHRD();                    break;
    case 'work-schedule': renderWorkSchedule();          break;
    case 'shift-calendar': renderShiftCalendar();         break;
    case 'tasks':       renderTaskManagement();          break;
    case 'wiki':        renderWiki(params.tab||'docs');   break;
    case 'agentic':     renderAgentic(params.tab||'inbox'); break;
    case 'attendance':   renderAttendance();               break;
    case 'org-structure':renderOrgStructure();             break;
    case 'regulatory':   renderRegulatoryReports();        break;
    case 'rl-reports':   renderRLReports();                break;
    case 'homecare':    renderHomeCare();               break;
    case 'admission':   renderAdmission();              break;
    case 'lab':         renderLab(params.tab||'checkin'); break;
    case 'product':     renderConfigProduct();          break;
    case 'config':      renderConfigHome();              break;
    case 'refrange':    renderConfigRefRange();          break;
    case 'labreport':   renderLabReportConfig();          break;
    case 'corporate':   renderConfigCorporate();        break;
    case 'radiology':   renderRIS();                    break;
    case 'radiology-old':renderRadiology();             break;
    case 'supportive':  renderSupportive();             break;
    case 'spirometry':  renderSupportive();             break;
    case 'medrecord':   renderMedRecord();              break;
    case 'queue':       renderQueuePage();                  break;
    case 'queue-kiosk': renderQueueKiosk();                 break;
    case 'appointments':renderAppointments();           break;
    case 'cashier':     renderCashier();                break;
    case 'accounting':  renderAccounting();             break;
    case 'payroll':     renderPayroll();                break;
    case 'package':     renderConfigPackage();          break;
    case 'family':      renderConfigFamily();            break;
    case 'anamnesa':    renderAnamnesa();               break;
    case 'import':      renderImportExcel();            break;
    case 'settings':    renderSettings();               break;
    case 'users':       renderUsers();                  break;
    default:
      document.getElementById('main-content').innerHTML = `
        <div class="empty-state" style="min-height:70vh">
          <div class="ico">🚧</div>
          <h3>Halaman ini sedang dikembangkan</h3>
          <button class="btn btn-teal" style="margin-top:14px" onclick="navigate('dashboard')">← Dashboard</button>
        </div>`;
  }
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}
