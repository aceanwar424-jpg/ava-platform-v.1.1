// ═══════════════════════════════════════════
// CORE: Shared Utilities
// ═══════════════════════════════════════════

// Toast
function toast(msg, type='info', dur=2800) {
  const icons = {ok:'✅', err:'❌', info:'ℹ️', warn:'⚠️'};
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
  // Wadah dibuat bila belum ada. Sebelumnya appendChild dipanggil langsung
  // pada hasil getElementById, sehingga toast APA PUN yang muncul sebelum
  // shell aplikasi terpasang — mis. galat saat boot atau di layar login —
  // melempar TypeError dan justru menutupi pesan yang ingin disampaikan.
  let wadah = document.getElementById('toast-container');
  if (!wadah) {
    wadah = document.createElement('div');
    wadah.id = 'toast-container';
    document.body.appendChild(wadah);
  }
  wadah.appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// Modal
//
// Wadah dibuat bila belum ada. showLoginScreen() mengganti isi body,
// sehingga #modal-overlay dan #modal-box lenyap — dan setiap openModal()
// sesudah itu melempar TypeError. Akibatnya paling terasa justru pada
// dialog galat: pesan yang seharusnya menjelaskan masalah malah ikut hilang.
function _wadahModal() {
  let ov = document.getElementById('modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'modal-overlay';
    ov.className = 'modal-overlay';
    ov.onclick = (e) => { if (e.target === ov) closeModalForce(); };
    ov.innerHTML = '<div class="modal-box" id="modal-box"></div>';
    document.body.appendChild(ov);
  }
  return { ov, box: document.getElementById('modal-box') };
}

function openModal(html, size='') {
  const { ov, box } = _wadahModal();
  if (!box) return;
  box.innerHTML = html;
  box.className = 'modal-box' + (size ? ' '+size : '');
  ov.classList.add('open');
}
function closeModalForce() {
  const ov = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  if (ov) ov.classList.remove('open');
  if (box) box.innerHTML = '';
}
function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) closeModalForce();
}

// Category helpers
function catIcon(cat) {
  return '';
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
  let name = window.currentUser?.profile?.full_name
      || window.currentUser?.user_metadata?.full_name
      || window.currentUser?.email?.split('@')[0]
      || 'Administrator AVA GLOBAL ECOSYSTEM';
  if (name.includes('AVA')) {
    name = name.replace(/AVA/g, 'AVA GLOBAL ECOSYSTEM');
  }
  return name;
}
// Alias (nama singkat/inisial) untuk jejak TAT. Fallback ke potongan nama.
function getUserAlias() {
  const al = window.currentUser?.profile?.alias;
  if (al && String(al).trim()) return String(al).trim();
  return getUserName();
}
// Modal atur alias sendiri (dipanggil dari dropdown user).
function openAliasModal() {
  const cur = window.currentUser?.profile?.alias || '';
  openModal(`
    <div class="modal-header"><div class="modal-title">Atur Alias</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
      Alias singkat dipakai pada jejak TAT lab (mis. siapa yang menerima, menginput, memvalidasi). Contoh: <b>ADA</b>, <b>dr. Sari</b>.</div>
    <div class="form-group"><label>Alias</label>
      <input type="text" id="alias-input" maxlength="24" value="${String(cur).replace(/"/g,'&quot;')}" placeholder="mis. ADA"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveMyAlias()">Simpan</button>
    </div>`);
}
async function saveMyAlias() {
  const v = (document.getElementById('alias-input')?.value || '').trim();
  try {
    await sbRpc('set_my_alias', { p_alias: v });
    if (window.currentUser) { window.currentUser.profile = window.currentUser.profile || {}; window.currentUser.profile.alias = v || null; }
    toast('Alias tersimpan', 'ok');
    closeModalForce();
  } catch (e) {
    toast('Gagal menyimpan alias: ' + (e.message || e), 'err');
  }
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

// getUserRole() menormalkan 'admin' menjadi 'super_admin', sehingga
// perbandingan lama terhadap 'admin' tidak pernah bisa benar — isAdmin()
// selalu mengembalikan false. Belum ada pemanggilnya saat ini, tapi dibetulkan
// supaya tidak menjadi jebakan bagi kode yang memakainya nanti.
function isAdmin() {
  return getUserRole() === 'super_admin';
}

// ── Tema terang/gelap ────────────────────────────────────────────
// Pilihan disimpan per peramban, TIDAK mengikuti setelan sistem operasi.
// Alasannya: satu komputer klinik dipakai bergantian banyak petugas, dan
// tampilan yang berubah sendiri mengikuti jam atau setelan OS akan
// mengejutkan orang di tengah pekerjaan. Bawaannya tetap terang.
function olTerapkanTema(nama) {
  const gelap = nama === 'dark';
  document.documentElement.setAttribute('data-theme', gelap ? 'dark' : 'light');
  const b = document.getElementById('btn-tema');
  if (b) {
    b.textContent = gelap ? '☀️' : '🌙';
    b.title = gelap ? 'Ganti ke tema terang' : 'Ganti ke tema gelap';
  }
}

function olToggleTema() {
  const kini = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const baru = kini === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('ol_tema', baru); } catch (e) {}
  olTerapkanTema(baru);

  // Pemberitahuan sekali per peramban.
  //
  // Kontras teks sudah diaudit terprogram pada 36 halaman ditambah modal:
  // nol teks tak terbaca, nol kontras di bawah 3:1. Yang BELUM diperiksa
  // adalah tinjauan visual menyeluruh — keadaan hover/fokus, cetakan, dan
  // layar yang jarang dibuka. Karena itu disebut apa adanya: terverifikasi
  // untuk keterbacaan, belum untuk seluruh nuansa tampilan.
  if (baru === 'dark') {
    let sudah = false;
    try { sudah = localStorage.getItem('ol_tema_notis') === '2'; } catch (e) {}
    if (!sudah) {
      try { localStorage.setItem('ol_tema_notis', '2'); } catch (e) {}
      if (typeof toast === 'function') {
        toast('Tema gelap aktif. Keterbacaan teks sudah diuji pada 36 halaman; ' +
              'laporkan bila menemukan tampilan yang janggal.', 'info', 7000);
      }
    }
  }
}

// Diterapkan sedini mungkin agar tidak ada kedipan terang saat memuat.
(function () {
  let t = 'light';
  try { t = localStorage.getItem('ol_tema') || 'light'; } catch (e) {}
  olTerapkanTema(t);
  document.addEventListener('DOMContentLoaded', () => olTerapkanTema(t));
})();
