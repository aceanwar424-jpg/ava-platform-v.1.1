// ═══════════════════════════════════════════════════
// OneLab Growth Platform — app.js
// Router, Toast, Modal, Connection Check
// ═══════════════════════════════════════════════════

let currentPage = 'dashboard';
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  partners:  'Partner Database',
  marketing: 'Marketing Kit',
  voucher:   'Voucher Builder',
  surat:     'Surat Keluar',
  maps:      'Maps Prospecting',
  settings:  'Pengaturan'
};

// ── Router ────────────────────────────────────────
function navigate(page) {
  currentPage = page;

  // Update active nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update topbar title
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page] || page;

  // Topbar button visibility
  const addBtn = document.querySelector('.topbar-btn');
  if (addBtn) addBtn.style.display = page === 'partners' ? 'inline-flex' : 'none';

  // Load page
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="loading-row"><div class="spinner"></div> Memuat halaman...</div>';

  // Dispatch to module
  setTimeout(() => {
    switch(page) {
      case 'dashboard': renderDashboard(); break;
      case 'partners':  renderPartners();  break;
      case 'marketing': renderMarketing(); break;
      case 'voucher':   renderVoucher();   break;
      case 'surat':     renderSurat();     break;
      case 'maps':      renderMaps();      break;
      case 'settings':  renderSettings();  break;
    }
  }, 80);

  // Close sidebar on mobile
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// ── Sidebar toggle (mobile) ───────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Modal ─────────────────────────────────────────
function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('open');
    document.getElementById('modal-box').innerHTML = '';
  }
}

function closeModalForce() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-box').innerHTML = '';
}

// ── Toast ──────────────────────────────────────────
function toast(message, type = 'info', duration = 2800) {
  const icons = { ok: '✅', err: '❌', info: 'ℹ️', warn: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]||''}</span><span>${message}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Connection check ──────────────────────────────
async function checkConnection() {
  const dot   = document.getElementById('conn-dot');
  const label = document.getElementById('conn-label');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: SB_HEADERS });
    if (res.ok || res.status === 200 || res.status === 404) {
      dot.className   = 'conn-dot ok';
      label.textContent = 'Supabase terhubung';
    } else throw new Error(res.status);
  } catch(e) {
    dot.className   = 'conn-dot error';
    label.textContent = 'Gagal konek';
  }
}

// ── Init ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Hide topbar add button by default
  const addBtn = document.querySelector('.topbar-btn');
  if (addBtn) addBtn.style.display = 'none';

  checkConnection();
  navigate('dashboard');

  // Re-check every 60s
  setInterval(checkConnection, 60000);
});

// ── Global helpers shared across modules ──────────
function catIcon(cat){
  if(!cat) return '📍';
  cat=cat.toLowerCase();
  if(cat.includes('apotek')) return '💊';
  if(cat.includes('klinik')) return '🏥';
  if(cat.includes('dokter')) return '👨‍⚕️';
  if(cat.includes('puskesmas')) return '🏨';
  if(cat.includes('rumah sakit')) return '🏦';
  if(cat.includes('perusahaan')||cat.includes('sme')) return '🏢';
  if(cat.includes('komunitas')) return '👥';
  if(cat.includes('sekolah')||cat.includes('kampus')) return '🎓';
  if(cat.includes('gym')||cat.includes('sport')) return '🏋️';
  return '📍';
}

function statusBadgeClass(status){
  const map={
    'Aktif':'badge-green','MOU':'badge-teal','Prospect':'badge-gold',
    'Dihubungi':'badge-navy','Meeting':'badge-purple',
    'Proposal Dikirim':'badge-gold','Tidak Berminat':'badge-red',
  };
  return map[status]||'badge-gray';
}
