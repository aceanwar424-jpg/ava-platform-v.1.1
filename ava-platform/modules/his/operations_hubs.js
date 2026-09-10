// ═══════════════════════════════════════════════════════════════
// HIS · HUB OPERASIONAL
// Hub hanya mengarahkan proses ke sumber otoritatifnya. Ia tidak menghitung
// ulang saldo hak paket, gaji, atau komisi dan tidak menulis data transaksi.
// ═══════════════════════════════════════════════════════════════

function opsHubNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}

function opsHubCard(icon, title, desc, target, params = {}) {
  const encoded = JSON.stringify(params).replace(/"/g, '&quot;');
  return `<button class="ops-hub-card" type="button" onclick="navigate('${target}',${encoded})">
    <span class="ops-hub-icon">${icon}</span><span><strong>${title}</strong><small>${desc}</small></span><b aria-hidden="true">→</b>
  </button>`;
}

function opsHubMetric(label, value, note = '') {
  return `<article class="ops-hub-metric"><strong>${opsHubNumber(value)}</strong><span>${label}</span>${note ? `<small>${note}</small>` : ''}</article>`;
}

async function renderPackageServiceHub() {
  const main = document.getElementById('main-content'); if (!main) return;
  main.innerHTML = `<section class="ops-hub"><header class="ops-hub-head"><div><span>ALUR PASIEN · PAKET & MEMBERSHIP</span><h1>Paket & Membership</h1><p>Registrasi, hak paket, dan penebusan layanan dipisahkan dari konfigurasi master agar petugas tidak mengubah katalog saat melayani pasien.</p></div><div class="ops-hub-readonly">Master paket dikelola pada Administrasi Sistem</div></header><div id="ops-package-metrics" class="ops-hub-metrics"><div class="loading-row"><div class="spinner"></div></div></div><div class="ops-hub-grid"><section><h2>Operasional pasien</h2><div class="ops-hub-actions">${opsHubCard('🧾','Registrasi Paket','Daftarkan paket/MCU dan add-on pasien','admission',{mode:'package'})}${opsHubCard('🔄','Langganan Paket','Terbitkan hak penggunaan berulang','admission',{mode:'subscription'})}${opsHubCard('✅','Pemakaian Hak Paket','Tebus layanan dari hak yang aktif','admission',{mode:'package-usage'})}</div></section><section><h2>Konfigurasi terpisah</h2><div class="ops-hub-actions">${opsHubCard('⚙️','Master Paket & Panel','Kode, item, tarif, dan status aktif','package')}${opsHubCard('🏢','Paket Korporat','Paket terikat kontrak dan peserta MCU','mcu')}</div></section></div><div class="ops-hub-note"><strong>Batas kontrol:</strong> layar ini tidak menyatakan saldo hak valid. Validasi saldo, masa berlaku, pembatalan, dan penebusan bersamaan harus ditegakkan oleh ledger entitlement server-side sebelum menjadi kontrol final.</div></section>`;
  const target = document.getElementById('ops-package-metrics');
  const [packages, admissions] = await Promise.all([
    sbGet('packages', 'select=id,is_active&limit=2000').catch(() => []),
    sbGet('admissions', 'select=id,package_id,services,status&package_id=not.is.null&limit=1000').catch(() => []),
  ]);
  if (!target) return;
  const valid = (admissions || []).filter(a => a.status !== 'Cancelled');
  const subscribed = valid.filter(a => String(a.services || '').includes('subscriptionStart')).length;
  target.innerHTML = opsHubMetric('paket aktif', (packages || []).filter(p => p.is_active).length)
    + opsHubMetric('registrasi paket', valid.length, 'periode data tersedia')
    + opsHubMetric('langganan tercatat', subscribed, 'perlu ledger otoritatif');
}

async function renderRemunerationHub() {
  const main = document.getElementById('main-content'); if (!main) return;
  main.innerHTML = `<section class="ops-hub"><header class="ops-hub-head"><div><span>KEUANGAN · REMUNERASI</span><h1>Remunerasi</h1><p>Satu titik navigasi untuk data periode gaji, presensi, komisi, dan fee layanan—tanpa menghitung ulang nilai atau melewati approval payroll.</p></div><div class="ops-hub-readonly">Finalisasi hanya dari Penggajian</div></header><div id="ops-rem-metrics" class="ops-hub-metrics"><div class="loading-row"><div class="spinner"></div></div></div><div class="ops-hub-grid"><section><h2>Dasar perhitungan</h2><div class="ops-hub-actions">${opsHubCard('🗓️','Roster & Jadwal Kerja','Shift dan kapasitas kerja','work-schedule')}${opsHubCard('📍','Presensi','Clock in/out, riwayat, dan review SPV','attendance')}${opsHubCard('👥','Database Karyawan','Status aktif dan komponen personalia','hrd')}</div></section><section><h2>Komponen & finalisasi</h2><div class="ops-hub-actions">${opsHubCard('💰','Penggajian per Periode','Gaji, tunjangan, BPJS, PPh 21, slip, dan finalisasi','payroll')}${opsHubCard('🏆','Komisi Sales','Komisi komersial pada Finance','finance',{tab:'commission'})}${opsHubCard('🚑','Fee Nakes Home Care','Rekap billing dan fee layanan home care','hc-billing')}</div></section></div><div class="ops-hub-note"><strong>Urutan wajib:</strong> roster/presensi dikunci → komponen layanan direkonsiliasi → payroll dihitung → reviewer menyetujui → payroll difinalkan dan jurnal dicatat. Hub ini tidak dapat melakukan finalisasi.</div></section>`;
  const target = document.getElementById('ops-rem-metrics');
  const month = new Date().toISOString().slice(0, 7);
  const [runs, attendance] = await Promise.all([
    sbGet('payroll_runs', `select=id,status,employee_count,total_net&period=eq.${month}&limit=1`).catch(() => []),
    sbGet('attendance', `select=id,clock_in_at,clock_out_at&tanggal=eq.${new Date().toISOString().slice(0, 10)}&limit=2000`).catch(() => []),
  ]);
  const run = (runs || [])[0];
  const present = (attendance || []).filter(a => a.clock_in_at).length;
  const complete = (attendance || []).filter(a => a.clock_in_at && a.clock_out_at).length;
  if (target) target.innerHTML = opsHubMetric('hadir hari ini', present, `${complete} presensi lengkap`)
    + opsHubMetric('karyawan periode', run?.employee_count || 0, run ? (run.status || 'Draft') : 'belum dihitung')
    + opsHubMetric('net payroll', run?.total_net || 0, run ? month : 'belum ada run');
}

async function renderWorkforceHub() {
  const main = document.getElementById('main-content'); if (!main) return;
  main.innerHTML = `<section class="ops-hub"><header class="ops-hub-head"><div><span>SDM · WORKFORCE</span><h1>Workforce</h1><p>Master karyawan, struktur, kehadiran, dan produktivitas dikelompokkan agar perencanaan tenaga kerja tidak tercampur dengan penggajian.</p></div><div class="ops-hub-readonly">Kredensial klinis dikelola melalui kepatuhan</div></header><div id="ops-workforce-metrics" class="ops-hub-metrics"><div class="loading-row"><div class="spinner"></div></div></div><div class="ops-hub-grid"><section><h2>Personalia & kapasitas</h2><div class="ops-hub-actions">${opsHubCard('🪪','Database Karyawan','Biodata dan status staf','hrd')}${opsHubCard('🏢','Struktur Organisasi','Posisi, departemen, dan pelaporan','org-structure')}${opsHubCard('🗓️','Jadwal & Roster','Pemetaan shift dan kapasitas','work-schedule')}</div></section><section><h2>Eksekusi kerja</h2><div class="ops-hub-actions">${opsHubCard('⏰','Presensi GPS','Clock in/out dan review tim','attendance')}${opsHubCard('📆','Kalender Shift','Tampilan bulanan tenaga bertugas','shift-calendar')}${opsHubCard('✓','Manajemen Tugas','Tugas, tenggat, dan status tim','tasks')}</div></section></div><div class="ops-hub-note"><strong>Gap yang belum diotorisasi:</strong> cuti, kompetensi/privilege, STR/SIP, substitusi shift, dan timekeeping lock perlu disatukan dengan kebijakan HR sebelum perubahan skema dilakukan.</div></section>`;
  const target = document.getElementById('ops-workforce-metrics');
  const [employees, schedules, attendance] = await Promise.all([
    sbGet('employees', 'select=id,is_active&limit=2000').catch(() => []),
    sbGet('work_schedules', 'select=id,is_active&limit=2000').catch(() => []),
    sbGet('attendance', `select=id,clock_in_at&tanggal=eq.${new Date().toISOString().slice(0, 10)}&limit=2000`).catch(() => []),
  ]);
  if (target) target.innerHTML = opsHubMetric('staf aktif', (employees || []).filter(e => e.is_active !== false).length)
    + opsHubMetric('roster aktif', (schedules || []).filter(s => s.is_active !== false).length)
    + opsHubMetric('clock-in hari ini', (attendance || []).filter(a => a.clock_in_at).length);
}

window.renderPackageServiceHub = renderPackageServiceHub;
window.renderRemunerationHub = renderRemunerationHub;
window.renderWorkforceHub = renderWorkforceHub;
