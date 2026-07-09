// ═══════════════════════════════════════════
// CORE: Shared Utilities
// ═══════════════════════════════════════════

// Toast
function toast(msg, type='info', dur=2800) {
  const icons = {ok:'✅', err:'❌', info:'ℹ️', warn:'⚠️'};
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// Modal
function openModal(html, size='') {
  const box = document.getElementById('modal-box');
  box.innerHTML = html;
  box.className = 'modal-box' + (size ? ' '+size : '');
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModalForce() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-box').innerHTML = '';
}
function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) closeModalForce();
}

// Category helpers
function catIcon(cat) {
  if (!cat) return '📍';
  const c = cat.toLowerCase();
  if (c.includes('apotek')) return '💊';
  if (c.includes('klinik')) return '🏥';
  if (c.includes('dokter')) return '👨‍⚕️';
  if (c.includes('puskesmas')) return '🏨';
  if (c.includes('rumah sakit')) return '🏦';
  if (c.includes('perusahaan') || c.includes('sme') || c.includes('pabrik')) return '🏢';
  if (c.includes('komunitas') || c.includes('masjid')) return '👥';
  if (c.includes('sekolah') || c.includes('kampus')) return '🎓';
  if (c.includes('gym') || c.includes('sport') || c.includes('yoga') || c.includes('golf')) return '🏋️';
  if (c.includes('lab')) return '🔬';
  return '📍';
}

function statusColor(status) {
  const map = {
    'Aktif':           {color:'#22C55E', bg:'#E8F5E9'},
    'MOU':             {color:'#06B6D4', bg:'#E0F7FA'},
    'Proposal Dikirim':{color:'#F97316', bg:'#FFF3E0'},
    'Meeting':         {color:'#8B5CF6', bg:'#F3E5F5'},
    'Dihubungi':       {color:'#0EA5E9', bg:'#E0F2FE'},
    'Prospect':        {color:'#F59E0B', bg:'#FFF8E1'},
    'Tidak Berminat':  {color:'#EF4444', bg:'#FFEBEE'},
  };
  return map[status] || {color:'#94A3B8', bg:'#F1F5F9'};
}

function statusBadgeClass(status) {
  const map = {
    'Aktif':'badge-green','MOU':'badge-teal','Prospect':'badge-gold',
    'Dihubungi':'badge-navy','Meeting':'badge-purple',
    'Proposal Dikirim':'badge-gold','Tidak Berminat':'badge-red',
  };
  return map[status] || 'badge-gray';
}

function catBadge(cat) {
  const map = {
    'Apotek':'badge-gold','Klinik Pratama':'badge-teal','Klinik Utama':'badge-teal',
    'Dokter Praktik':'badge-navy','Dokter Spesialis':'badge-navy',
    'Puskesmas':'badge-teal','Rumah Sakit':'badge-navy',
    'Perusahaan SME':'badge-purple','Komunitas':'badge-green',
    'Sekolah / Kampus':'badge-green','Gym & Sport Club':'badge-green',
    'Lab Klinik':'badge-red',
  };
  return map[cat] || 'badge-gray';
}

function autoCode(cat) {
  const p = {
    'Apotek':'APT','Klinik Pratama':'KLN','Klinik Utama':'KLU','Dokter Praktik':'DKT',
    'Dokter Spesialis':'DSP','Puskesmas':'PKM','Rumah Sakit':'RSK','Lab Klinik':'LAB',
    'Perusahaan SME':'PRS','Komunitas':'KOM','Sekolah / Kampus':'SKL',
    'Gym & Sport Club':'GYM','Lainnya':'LNY'
  };
  return `${p[cat]||'PTN'}-${Date.now().toString().slice(-5)}`;
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch(e) { return null; }
}

function formatCurrency(n) {
  return new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'});
}

function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'});
}

function timeAgo(d) {
  if (!d) return '';
  const sec = Math.floor((Date.now() - new Date(d)) / 1000);
  if (sec < 60) return 'baru saja';
  if (sec < 3600) return `${Math.floor(sec/60)} menit lalu`;
  if (sec < 86400) return `${Math.floor(sec/3600)} jam lalu`;
  if (sec < 604800) return `${Math.floor(sec/86400)} hari lalu`;
  return formatDateShort(d);
}


function getUserName() {
  return window.currentUser?.profile?.full_name 
      || window.currentUser?.user_metadata?.full_name
      || window.currentUser?.email?.split('@')[0] 
      || 'User';
}
function getUserRole() {
  let role = window.currentUser?.profile?.role 
      || window.currentUser?.user_metadata?.role
      || window.currentUser?.role
      || 'sales';
  role = String(role).trim().toLowerCase();
  const map = { admin:'super_admin', head:'super_admin', superadmin:'super_admin' };
  return map[role] || role;
}
function getRoleLabel(role) {
  if (typeof ROLES !== 'undefined' && ROLES[role]) return ROLES[role].label;
  const map = {
    'super_admin':'Super Admin','admin':'Admin','manager':'Manager',
    'sales':'Sales','lab':'Lab Staff','finance':'Finance',
    'hrd':'HRD','cashier':'Kasir','dokter':'Dokter','direktur':'Direktur'
  };
  return map[role] || role || 'User';
}

function isAdmin() {
  return getUserRole() === 'admin';
}
