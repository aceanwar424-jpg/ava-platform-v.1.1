// OWNED_BY: ava. Menu labels and availability for portal navigation.
const APPS_PAGES = {
  'patient-view': ['Beranda', 'home'],
  'book-test-view': ['Pesan Pemeriksaan'],
  'book-homecare-view': ['Pesan Kunjungan Rumah'],
  'buy-package-view': ['Paket Pemeriksaan'],
  'medrec-view': ['Hasil & Rekam Medis'],
  'homecare-results-view': ['Riwayat Kunjungan'],
  'ava-consult-view': ['Konsultasi Dokter'],
  'ava-marketplace-view': ['Alat Kesehatan'],
  'toko-view': ['Toko Kesehatan'],
  'toko-checkout-view': ['Keranjang & Pengiriman'],
  'ava-devices-view': ['Perangkat Kesehatan'],
  'ava-caregiver-view': ['Pendamping Keluarga'],
  'nearme-view': ['Daftar Cabang', 'branches'],
  'profile-view': ['Profil Akun', 'profile'],
  'wellness-personal-view': ['Program Wellness Saya'],
  'member-sanctuary-view': ['Layanan Member'],
  'staff-homecare-view': ['Tugas Kunjungan'],
  'corporate-view': ['Ringkasan Perusahaan'],
  'corporate-employees-view': ['Data Karyawan'],
  'book-examination-view': ['Ajukan Pemeriksaan Karyawan'],
  'examination-approval-view': ['Persetujuan Pemeriksaan'],
  'examination-history-view': ['Riwayat Pemeriksaan Karyawan'],
  'corporate-billing-view': ['Tagihan Perusahaan'],
  'corporate-wellness-view': ['Monitoring Wellness'],
  'corporate-cashback-view': ['Klaim Cashback'],
  'corporate-assigned-program-view': ['Program Khusus Perusahaan'],
  'referral-view': ['Rujukan Pasien'],
  'referral-catalog-view': ['Katalog Pemeriksaan Rujukan'],
  'referral-lab-results-view': ['Hasil Pasien Rujukan'],
  'ava-biotwin-view': ['Ringkasan Usia Biologis (Bio-Twin)'],
  'ava-biointerpreter-view': ['Penjelasan Hasil AI (Bio-Interpreter)'],
  'ava-homecare-tracking-view': ['Pelacakan Petugas'],
  'orders-tracking-view': ['Pelacakan Pesanan'],
  'ava-corp-burnout-view': ['Kesehatan & Burnout Karyawan'],
  'corporate-analytics-view': ['Analisis Pemeriksaan Karyawan'],
  'corporate-onsite-schedule-view': ['Jadwal Pemeriksaan di Lokasi'],
  'ava-ambient-scribe-view': ['Transkripsi Konsultasi AI'],
  'ava-iso-audit-view': ['Pemeriksaan Mutu Lab (ISO 15189)'],
  'ava-laas-api-view': ['Akses API Developer (LaaS)'],
  'staff-custody-view': ['Serah Terima Spesimen'],
  'staff-coldchain-check-view': ['Pemeriksaan Transportasi Spesimen'],
  'tech-saas-master-console-view': ['Pengelolaan Platform SaaS'],
  'wellness-admin-view': ['Rancang Program Wellness'],
  'wellness-import-view': ['Impor Hasil IHC'],
  'ava-wellness-hub-view': ['Wellness & Bio-Hacking Hub'],
  'wellness-run-challenge-view': ['Step & Run Club Challenge'],
  'wellness-nutrico-view': ['NutriCo Calorie & Diet Planner'],
  'wellness-sleep-optimizer-view': ['Sleep & Circadian Optimizer'],
  'wellness-hrv-stress-view': ['Mindfulness & HRV Stress'],
  'wellness-hydration-view': ['Smart Hydration Tracker'],
  'wellness-hormonal-sync-view': ['Hormonal & Cycle Sync'],
  'wellness-bioage-quest-view': ['Bio-Age 90-Day Quest']
};

const APPS_MENU_GROUPS = {
  patient: [
    ['Layanan Utama', ['patient-view', 'wellness-personal-view', 'book-test-view', 'book-homecare-view', 'buy-package-view', 'ava-consult-view']],
    ['Wellness & Kebugaran', ['ava-wellness-hub-view', 'wellness-run-challenge-view', 'wellness-nutrico-view', 'wellness-hydration-view', 'wellness-hrv-stress-view', 'wellness-sleep-optimizer-view', 'wellness-hormonal-sync-view', 'wellness-bioage-quest-view']],
    ['Riwayat & Pesanan', ['medrec-view', 'homecare-results-view', 'orders-tracking-view', 'ava-devices-view', 'ava-caregiver-view', 'nearme-view', 'profile-view']],
    ['Belanja & Farmasi', ['toko-view', 'ava-marketplace-view']],
    ['Fitur AI & Bio-Twin', ['ava-biointerpreter-view', 'ava-biotwin-view', 'ava-homecare-tracking-view']]
  ],
  member: [
    ['Layanan Member', ['patient-view', 'wellness-personal-view', 'member-sanctuary-view', 'book-test-view', 'book-homecare-view', 'buy-package-view', 'ava-consult-view']],
    ['Wellness & Kebugaran', ['ava-wellness-hub-view', 'wellness-run-challenge-view', 'wellness-nutrico-view', 'wellness-hydration-view', 'wellness-hrv-stress-view', 'wellness-sleep-optimizer-view', 'wellness-hormonal-sync-view', 'wellness-bioage-quest-view']],
    ['Riwayat & Akun', ['medrec-view', 'homecare-results-view', 'orders-tracking-view', 'ava-devices-view', 'ava-caregiver-view', 'nearme-view', 'profile-view']],
    ['Belanja & Farmasi', ['toko-view', 'ava-marketplace-view']],
    ['Bio-Twin & AI', ['ava-biotwin-view', 'ava-biointerpreter-view']]
  ],
  corporate: [
    ['Pemeriksaan Karyawan', ['corporate-view', 'corporate-employees-view', 'book-examination-view', 'examination-approval-view', 'examination-history-view']],
    ['Program Wellness', ['corporate-wellness-view', 'ava-wellness-hub-view', 'wellness-run-challenge-view', 'wellness-nutrico-view']],
    ['Analisis & Jadwal', ['corporate-analytics-view', 'corporate-onsite-schedule-view', 'ava-corp-burnout-view']],
    ['Administrasi & Billing', ['corporate-billing-view', 'corporate-cashback-view', 'profile-view']]
  ],
  staff: [
    ['Kunjungan Rumah', ['staff-homecare-view', 'homecare-results-view', 'ava-homecare-tracking-view', 'nearme-view', 'profile-view']],
    ['Manajemen Spesimen', ['staff-custody-view', 'staff-coldchain-check-view', 'ava-iso-audit-view']]
  ],
  referral: [
    ['Layanan Rujukan', ['referral-view', 'referral-catalog-view', 'referral-lab-results-view', 'ava-ambient-scribe-view']],
    ['Akun & Lokasi', ['profile-view', 'nearme-view']]
  ],
  ihc: [
    ['Pengiriman Hasil', ['wellness-import-view', 'profile-view']]
  ],
  tech: [
    ['Pengelolaan di HIS', ['wellness-admin-view']],
    ['Console SaaS & API', ['tech-saas-master-console-view', 'ava-laas-api-view']],
    ['Akun', ['profile-view']]
  ]
};

function appsEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function appsMenuItems(role) {
  let baseGroups = [...(APPS_MENU_GROUPS[role] || [])];

  // If patient or member has linked corporate, show special assigned corporate program group as attention on top,
  // while KEEPING ALL BASIC MENUS 100% visible and accessible below it!
  const linkedCorp = (typeof window !== 'undefined' && (window.currentCorporateName || window.currentCorporateId || localStorage.getItem('AVA_LINKED_CORP_NAME')));
  if ((role === 'patient' || role === 'member') && linkedCorp) {
    const corpName = window.currentCorporateName || localStorage.getItem('AVA_LINKED_CORP_NAME') || 'Mitra Perusahaan';
    const corpGroup = [
      '🏢 Program Khusus: ' + corpName,
      ['corporate-assigned-program-view', 'wellness-run-challenge-view', 'examination-history-view', 'wellness-nutrico-view']
    ];
    baseGroups = [corpGroup, ...baseGroups];
  }

  return baseGroups.map(([label, ids]) => [label, ids.filter(id => {
    if (currentUserProfile?.role === 'super_admin') return true;
    if (id === 'book-examination-view') return currentCorpRole === 'requestor';
    if (id === 'examination-approval-view') return currentCorpRole === 'approver';
    return true;
  })]);
}

function renderAppsMenu() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const name = document.getElementById('user-welcome');
  if (name) name.textContent = currentUsername || 'Akun Anda';
  const roleSelect = document.getElementById('role-switcher-select');
  if (roleSelect) { roleSelect.value = currentRole; roleSelect.disabled = currentUserProfile?.role !== 'super_admin'; }
  nav.innerHTML = appsMenuItems(currentRole).map(([label, ids], index) => `
    <details class="apps-menu-group" ${label === 'Dalam pengembangan' ? '' : 'open'}>
      <summary>${appsEscape(label)}<span aria-hidden="true">⌄</span></summary>
      <div>${ids.map(id => `<button type="button" class="sidebar-link" data-view="${id}" onclick="showView('${id}')"><span>${appsEscape(APPS_PAGES[id][0])}</span>${APPS_PAGES[id][1] === 'planned' ? '<small>Belum tersedia</small>' : ''}</button>`).join('')}</div>
    </details>`).join('');
}

function appsStatusPanel(target, title, message) {
  target.innerHTML = `<section class="apps-state"><h2>${appsEscape(title)}</h2><p>${appsEscape(message)}</p></section>`;
}

function renderAppsHome(target) {
  const linkedCorp = (typeof window !== 'undefined' && (window.currentCorporateName || window.currentCorporateId || localStorage.getItem('AVA_LINKED_CORP_NAME')));
  const corpName = (typeof window !== 'undefined' && (window.currentCorporateName || localStorage.getItem('AVA_LINKED_CORP_NAME'))) || 'PT Astra Honda Motor (AHM)';

  let corpBannerHtml = '';
  if (linkedCorp) {
    corpBannerHtml = `
      <!-- Corporate Special Assigned Program Attention Banner -->
      <div class="corporate-attention-card">
        <div class="corp-attn-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="corp-icon-badge">🏢</span>
            <div>
              <span class="corp-attn-eyebrow">PROGRAM KHUSUS KARYAWAN TERHUBUNG</span>
              <h3 style="margin:2px 0 0 0; font-size:15px; font-weight:800; color:#0f2963;">${appsEscape(corpName)}</h3>
            </div>
          </div>
          <span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800; font-size:11px; padding:4px 10px; border-radius:999px;">● SUBSIDI AKTIF</span>
        </div>

        <p style="font-size:12px; color:#475569; margin:10px 0 14px 0; line-height:1.5;">
          Perusahaan Anda telah menugaskan program kesehatan & kebugaran khusus untuk periode aktif. Program ini disesuaikan dengan profil pekerjaan dan dapat diakses langsung di bawah:
        </p>

        <div class="corp-attn-grid">
          <div class="corp-attn-item" onclick="showView('wellness-run-challenge-view')">
            <span class="c-icon">🏃</span>
            <div style="flex:1;">
              <strong>Step &amp; Run Challenge (Komunitas Karyawan)</strong>
              <small>Sinkronisasi wearable harian &amp; raih reward AVA Coins divisi</small>
            </div>
            <span class="c-arrow">Buka &rarr;</span>
          </div>

          <div class="corp-attn-item" onclick="showView('examination-history-view')">
            <span class="c-icon">🩺</span>
            <div style="flex:1;">
              <strong>Medical Check-Up (MCU) Tahunan Terjadwal</strong>
              <small>Pemeriksaan klinis komprehensif 100% subsidi perusahaan</small>
            </div>
            <span class="c-arrow">Status &rarr;</span>
          </div>

          <div class="corp-attn-item" onclick="showView('wellness-nutrico-view')">
            <span class="c-icon">🥗</span>
            <div style="flex:1;">
              <strong>NutriCo Workplace Nutrition Plan</strong>
              <small>Panduan gizi &amp; kalori shift kerja sesuai biomarker darah</small>
            </div>
            <span class="c-arrow">Buka &rarr;</span>
          </div>

          <div class="corp-attn-item" onclick="showView('corporate-assigned-program-view')">
            <span class="c-icon">📋</span>
            <div style="flex:1;">
              <strong>Detail Kuota &amp; Benefit Kesehatan Karyawan</strong>
              <small>Lihat ringkasan program khusus, NIP &amp; fasilitas HR</small>
            </div>
            <span class="c-arrow">Detail &rarr;</span>
          </div>
        </div>
      </div>
    `;
  } else {
    corpBannerHtml = `
      <div style="margin-bottom:18px; padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:20px;">🏢</span>
          <div>
            <strong style="font-size:12.5px; color:#166534; display:block;">Karyawan Perusahaan Mitra (AHM, Astra, dll)?</strong>
            <span style="font-size:11px; color:#14532d;">Tautkan kode perusahaan Anda untuk membuka program kesehatan khusus &amp; subsidi penuh.</span>
          </div>
        </div>
        <button type="button" class="btn btn-teal" onclick="promptLinkCorporateCode()" style="padding:6px 14px; font-size:11.5px; font-weight:700;">+ Tautkan Perusahaan</button>
      </div>
    `;
  }

  const basicLinks = appsMenuItems(currentRole).flatMap(([, ids]) => ids).filter(id => id !== 'patient-view' && id !== 'corporate-assigned-program-view' && APPS_PAGES[id][1] !== 'planned');

  target.innerHTML = `
    <section class="apps-page-heading">
      <h2>Selamat datang${currentUsername ? ', ' + appsEscape(currentUsername) : ''}</h2>
      <p>Layanan kesehatan presisi, rekam medis, dan program kebugaran harian Anda.</p>
    </section>

    ${corpBannerHtml}

    <div style="margin-top:20px;">
      <div style="font-size:12px; font-weight:800; color:#0f2963; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
        <span>⚡ Menu Layanan Lengkap (Akses Seluruh Pengguna)</span>
      </div>
      <div class="apps-shortcuts">
        ${basicLinks.map(id => `<button type="button" onclick="showView('${id}')">${appsEscape(APPS_PAGES[id][0])}<span aria-hidden="true">&rarr;</span></button>`).join('')}
      </div>
    </div>
  `;
}

function renderAppsProfile(target) {
  const profile = currentUserProfile || {};
  const roleNames = { patient: 'Pasien', member: 'Member', corporate: 'Perusahaan', staff: 'Tenaga kesehatan', referral: 'Dokter / Faskes', tech: 'Pengelola', super_admin: 'Administrator' };
  const fields = [['Nama', profile.full_name || currentUsername], ['Email', currentUserEmail], ['Peran akun', roleNames[profile.role] || 'Belum tersedia'], ['Nomor telepon', profile.phone], ['Perusahaan', currentCorporateName]];
  target.innerHTML = `<section class="apps-page-heading"><h2>Profil Akun</h2><p>Untuk memperbarui identitas atau akses layanan, hubungi petugas.</p></section><dl class="apps-profile">${fields.map(([name, value]) => `<div><dt>${name}</dt><dd>${appsEscape(value || 'Belum tercatat')}</dd></div>`).join('')}</dl>`;
}

async function renderAppsBranches(target) {
  appsStatusPanel(target, 'Daftar Cabang', 'Memuat cabang…');
  const rows = await avaAmbil('branches', 'select=name,address&is_active=eq.true&order=name.asc');
  if (!rows.length) { appsStatusPanel(target, 'Belum ada cabang', 'Informasi cabang belum diterbitkan. Hubungi petugas untuk lokasi layanan.'); return; }
  target.innerHTML = `<h2>Daftar Cabang</h2><div class="apps-shortcuts">${rows.map(row => `<article class="apps-state"><h3>${appsEscape(row.name)}</h3><p>${appsEscape(row.address || 'Alamat belum tersedia')}</p></article>`).join('')}</div>`;
}

if (typeof window !== 'undefined') {
  window.APPS_PAGES = APPS_PAGES;
  window.APPS_MENU_GROUPS = APPS_MENU_GROUPS;
  window.appsMenuItems = appsMenuItems;
  window.renderAppsMenu = renderAppsMenu;
  window.renderAppsHome = renderAppsHome;
}
