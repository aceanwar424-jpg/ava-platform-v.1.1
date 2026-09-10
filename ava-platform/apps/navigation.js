// OWNED_BY: ava. Menu labels and availability for the initial portal release.
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
  'member-sanctuary-view': ['Layanan Member'],
  'staff-homecare-view': ['Tugas Kunjungan'],
  'corporate-view': ['Ringkasan Perusahaan'],
  'corporate-employees-view': ['Data Karyawan'],
  'book-examination-view': ['Ajukan Pemeriksaan Karyawan'],
  'examination-approval-view': ['Persetujuan Pemeriksaan'],
  'examination-history-view': ['Riwayat Pemeriksaan Karyawan'],
  'corporate-billing-view': ['Tagihan Perusahaan'],
  'corporate-cashback-view': ['Klaim Cashback', 'planned'],
  'referral-view': ['Rujukan Pasien', 'planned'],
  'referral-catalog-view': ['Katalog Pemeriksaan Rujukan', 'planned'],
  'referral-lab-results-view': ['Hasil Pasien Rujukan', 'planned'],
  'ava-biotwin-view': ['Ringkasan Usia Biologis', 'planned'],
  'ava-biointerpreter-view': ['Penjelasan Hasil Berbantuan AI', 'planned'],
  'ava-homecare-tracking-view': ['Pelacakan Petugas', 'planned'],
  'orders-tracking-view': ['Pelacakan Pesanan', 'planned'],
  'ava-corp-burnout-view': ['Ringkasan Kesehatan Karyawan', 'planned'],
  'corporate-analytics-view': ['Analisis Pemeriksaan Karyawan', 'planned'],
  'corporate-onsite-schedule-view': ['Jadwal Pemeriksaan di Lokasi', 'planned'],
  'ava-ambient-scribe-view': ['Transkripsi Konsultasi', 'planned'],
  'ava-iso-audit-view': ['Pemeriksaan Mutu', 'planned'],
  'ava-laas-api-view': ['Akses API', 'planned'],
  'staff-custody-view': ['Serah Terima Spesimen', 'planned'],
  'staff-coldchain-check-view': ['Pemeriksaan Transportasi Spesimen', 'planned'],
  'tech-saas-master-console-view': ['Pengelolaan Platform', 'planned'],
  'ava-wellness-hub-view': ['Kebugaran & Kebiasaan Sehat', 'planned'],
  'wellness-run-challenge-view': ['Aktivitas Harian', 'planned'],
  'wellness-nutrico-view': ['Rencana Makan', 'planned'],
  'wellness-sleep-optimizer-view': ['Kebiasaan Tidur', 'planned'],
  'wellness-hrv-stress-view': ['Latihan Relaksasi', 'planned'],
  'wellness-hydration-view': ['Asupan Air', 'planned'],
  'wellness-hormonal-sync-view': ['Kesehatan Hormonal', 'planned'],
  'wellness-bioage-quest-view': ['Program Kebiasaan Sehat', 'planned']
};
const APPS_MENU_GROUPS = {
  patient: [
    ['Layanan', ['patient-view', 'book-test-view', 'book-homecare-view', 'buy-package-view', 'ava-consult-view']],
    ['Riwayat & akun', ['medrec-view', 'homecare-results-view', 'ava-devices-view', 'ava-caregiver-view', 'nearme-view', 'profile-view']],
    ['Belanja', ['toko-view', 'ava-marketplace-view']],
    ['Dalam pengembangan', ['ava-biointerpreter-view', 'ava-biotwin-view', 'ava-homecare-tracking-view', 'orders-tracking-view', 'ava-wellness-hub-view']]
  ],
  member: [
    ['Layanan', ['patient-view', 'member-sanctuary-view', 'book-test-view', 'book-homecare-view', 'buy-package-view', 'ava-consult-view']],
    ['Riwayat & akun', ['medrec-view', 'homecare-results-view', 'ava-devices-view', 'ava-caregiver-view', 'nearme-view', 'profile-view']],
    ['Belanja', ['toko-view', 'ava-marketplace-view']],
    ['Dalam pengembangan', ['ava-wellness-hub-view', 'ava-biotwin-view']]
  ],
  corporate: [
    ['Pemeriksaan karyawan', ['corporate-view', 'corporate-employees-view', 'book-examination-view', 'examination-approval-view', 'examination-history-view']],
    ['Administrasi', ['corporate-billing-view', 'profile-view']],
    ['Dalam pengembangan', ['corporate-analytics-view', 'corporate-onsite-schedule-view', 'ava-corp-burnout-view', 'corporate-cashback-view']]
  ],
  staff: [
    ['Kunjungan rumah', ['staff-homecare-view', 'homecare-results-view', 'nearme-view', 'profile-view']],
    ['Dalam pengembangan', ['staff-custody-view', 'staff-coldchain-check-view', 'ava-iso-audit-view']]
  ],
  referral: [
    ['Akun & layanan', ['profile-view', 'nearme-view']],
    ['Dalam pengembangan', ['referral-view', 'referral-catalog-view', 'referral-lab-results-view', 'ava-ambient-scribe-view']]
  ],
  tech: [['Akun', ['profile-view']], ['Dalam pengembangan', ['tech-saas-master-console-view', 'ava-laas-api-view']]]
};
function appsEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function appsMenuItems(role) {
  return (APPS_MENU_GROUPS[role] || []).map(([label, ids]) => [label, ids.filter(id => {
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
  const links = appsMenuItems(currentRole).flatMap(([, ids]) => ids).filter(id => id !== 'patient-view' && APPS_PAGES[id][1] !== 'planned');
  target.innerHTML = `<section class="apps-page-heading"><h2>Selamat datang${currentUsername ? ', ' + appsEscape(currentUsername) : ''}</h2><p>Pilih layanan atau lihat riwayat yang tersedia untuk akun Anda.</p></section>
    <div class="apps-shortcuts">${links.map(id => `<button type="button" onclick="showView('${id}')">${appsEscape(APPS_PAGES[id][0])}<span aria-hidden="true">→</span></button>`).join('')}</div>`;
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
