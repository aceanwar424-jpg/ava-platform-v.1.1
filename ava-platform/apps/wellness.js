// OWNED_BY: generic. Cardiometabolic wellness UI shared by personal,
// corporate (aggregate only), and internal program administrators.
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const safe = value => typeof appsEscape === 'function' ? appsEscape(value) : String(value ?? '');
  const dateTimeLocal = value => {
    const date = value ? new Date(value) : new Date();
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const dateLabel = value => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const rpc = async (name, args = {}) => {
    if (typeof sbRpc !== 'function') throw new Error('Layanan data belum tersedia.');
    return sbRpc(name, args);
  };
  const setBusy = (button, busy, label) => {
    if (!button) return;
    if (busy) { button.dataset.label = button.textContent; button.disabled = true; button.textContent = label || 'Memproses…'; }
    else { button.disabled = false; button.textContent = button.dataset.label || button.textContent; }
  };
  const notify = message => typeof alert === 'function' && alert(message);
  const state = (title, message, type = '') => `<section class="wellness-state ${safe(type)}"><h3>${safe(title)}</h3><p>${safe(message)}</p></section>`;
  const sourceName = source => ({
    self_reported: 'Input mandiri', ihc_bulk: 'IHC · Bulk upload', ihc_api: 'IHC · API',
    device: 'Perangkat', his: 'HIS', lis: 'LIS', manual_admin: 'Input petugas'
  }[source] || source || 'Belum diketahui');
  const contextName = context => ({
    fasting: 'Puasa', random: 'Sewaktu', postprandial: '2 jam setelah makan',
    before_meal: 'Sebelum makan', before_sleep: 'Sebelum tidur', resting: 'Setelah istirahat', ihc: 'Pemeriksaan IHC'
  }[context] || context || '—');

  let personalData = null;
  let adminData = null;
  let importRows = [];
  let importRaw = '';

  function groupObservations(rows) {
    const groups = new Map();
    (rows || []).forEach(row => {
      const key = row.group_id || row.id;
      if (!groups.has(key)) groups.set(key, { key, measured_at: row.measured_at, source: row.source, verification_status: row.verification_status, context: row.measurement_context, device_method: row.device_method, note: row.note, values: {} });
      groups.get(key).values[row.code] = row;
    });
    return [...groups.values()].sort((a, b) => new Date(b.measured_at) - new Date(a.measured_at));
  }

  function observationCard(group) {
    const value = group.values;
    const bp = value.blood_pressure_systolic && value.blood_pressure_diastolic;
    const glucose = value.blood_glucose;
    const hba1c = value.hba1c;
    const verified = group.verification_status === 'verified';
    return `<article class="wellness-reading">
      <div class="wellness-reading-main">
        <span class="wellness-reading-icon" aria-hidden="true">${bp ? '♥' : hba1c ? 'A1c' : 'G'}</span>
        <div>
          <h4>${bp ? `${safe(value.blood_pressure_systolic.value)}/${safe(value.blood_pressure_diastolic.value)} mmHg` : glucose ? `${safe(glucose.value)} mg/dL` : `${safe(hba1c?.value)}% HbA1c`}</h4>
          <p>${safe(contextName(group.context))} · ${safe(dateLabel(group.measured_at))}</p>
          ${value.pulse_rate ? `<small>Denyut ${safe(value.pulse_rate.value)} bpm</small>` : ''}
        </div>
      </div>
      <div class="wellness-reading-meta">
        <span class="wellness-badge ${verified ? 'verified' : 'self'}">${verified ? 'Terverifikasi' : 'Belum diverifikasi'}</span>
        <small>${safe(sourceName(group.source))}${group.device_method ? ` · ${safe(group.device_method)}` : ''}</small>
      </div>
    </article>`;
  }

  async function renderPersonalWellness() {
    const target = $('wellness-personal-view');
    if (!target) return;
    target.innerHTML = `<section class="wellness-heading"><div><span>PROGRAM WELLNESS</span><h2>Diabetes & Hipertensi</h2><p>Catat hasil kontrol mandiri dan lihat riwayat dari IHC dalam satu timeline.</p></div></section>${state('Memuat program', 'Mengambil enrollment dan riwayat pengukuran Anda.')}`;
    try {
      personalData = await rpc('wellness_personal_dashboard');
      const programs = personalData?.programs || [];
      const activePrograms = programs.filter(program => program.enrollment_status === 'active');
      if (!programs.length) {
        target.innerHTML = `<section class="wellness-heading"><div><span>PROGRAM WELLNESS</span><h2>Belum ada program aktif</h2><p>Akun Anda belum ditautkan ke program wellness perusahaan.</p></div></section>${state('Enrollment diperlukan', 'Hubungi admin program atau IHC. Setelah roster disinkronkan, program akan muncul otomatis di akun ini.')}`;
        return;
      }
      const programOptions = activePrograms.map(program => `<option value="${safe(program.id)}">${safe(program.name)}</option>`).join('');
      const groups = groupObservations(personalData.observations);
      const tasks = personalData.open_tasks || [];
      target.innerHTML = `
        <section class="wellness-heading"><div><span>PROGRAM WELLNESS</span><h2>Diabetes & Hipertensi</h2><p>Data mandiri diberi label khusus dan dapat ditinjau tim medis IHC. Hasil IHC yang tervalidasi muncul pada timeline yang sama.</p></div><div class="wellness-program-chip">${safe(programs[0].name)}</div></section>
        ${programs.some(program => program.consent_status === 'pending') ? `<div class="wellness-notice warning"><strong>Persetujuan program belum lengkap.</strong><span>Hubungi pengelola program untuk memastikan pemberitahuan privasi dan persetujuan sudah diselesaikan.</span></div>` : ''}
        <div class="wellness-layout-two">
          <section class="wellness-card">
            <div class="wellness-card-title"><div><span>INPUT MANDIRI</span><h3>Tekanan darah</h3></div><span class="wellness-badge self">Self reported</span></div>
            <form class="wellness-form" onsubmit="wellnessSubmitPersonal(event,'blood_pressure')">
              <label>Program<select name="program_id" required>${programOptions}</select></label>
              <div class="wellness-fields three"><label>Sistolik<input name="systolic" type="number" min="40" max="300" placeholder="120" required><small>mmHg</small></label><label>Diastolik<input name="diastolic" type="number" min="30" max="200" placeholder="80" required><small>mmHg</small></label><label>Denyut<input name="pulse" type="number" min="20" max="250" placeholder="72"><small>bpm</small></label></div>
              <div class="wellness-fields two"><label>Waktu ukur<input name="measured_at" type="datetime-local" value="${dateTimeLocal()}" required></label><label>Kondisi<select name="context"><option value="resting">Setelah istirahat</option><option value="before_meal">Sebelum makan</option><option value="before_sleep">Sebelum tidur</option></select></label></div>
              <label>Alat / metode<input name="device_method" placeholder="Contoh: tensimeter digital lengan atas"></label>
              <label>Catatan<textarea name="note" rows="2" maxlength="500" placeholder="Opsional"></textarea></label>
              <button class="wellness-primary" type="submit">Simpan tekanan darah</button>
            </form>
          </section>
          <section class="wellness-card">
            <div class="wellness-card-title"><div><span>INPUT MANDIRI</span><h3>Gula darah</h3></div><span class="wellness-badge self">Self reported</span></div>
            <form class="wellness-form" onsubmit="wellnessSubmitPersonal(event,'blood_glucose')">
              <label>Program<select name="program_id" required>${programOptions}</select></label>
              <div class="wellness-fields two"><label>Hasil<input name="glucose" type="number" min="20" max="600" step="0.1" placeholder="105" required><small>mg/dL</small></label><label>Kondisi<select name="context" required><option value="fasting">Puasa</option><option value="random">Sewaktu</option><option value="postprandial">2 jam setelah makan</option><option value="before_meal">Sebelum makan</option><option value="before_sleep">Sebelum tidur</option></select></label></div>
              <label>Waktu ukur<input name="measured_at" type="datetime-local" value="${dateTimeLocal()}" required></label>
              <label>Alat / metode<input name="device_method" placeholder="Contoh: glucometer finger test"></label>
              <label>Catatan<textarea name="note" rows="2" maxlength="500" placeholder="Opsional"></textarea></label>
              <button class="wellness-primary" type="submit">Simpan gula darah</button>
            </form>
          </section>
        </div>
        ${tasks.length ? `<section class="wellness-card"><div class="wellness-card-title"><div><span>PENGINGAT</span><h3>Tugas program Anda</h3></div></div><div class="wellness-task-list">${tasks.map(task => `<article><strong>${safe(task.payload?.message || 'Lakukan pengukuran sesuai jadwal.')}</strong><span>${safe(dateLabel(task.due_at))}</span></article>`).join('')}</div></section>` : ''}
        <section class="wellness-card"><div class="wellness-card-title"><div><span>TIMELINE</span><h3>Riwayat pengukuran</h3></div><span>${groups.length} catatan</span></div><div class="wellness-readings">${groups.length ? groups.map(observationCard).join('') : state('Belum ada pengukuran', 'Masukkan tekanan darah atau gula darah pertama Anda.')}</div></section>
        <div class="wellness-safety">Hasil pada halaman ini membantu pemantauan program dan bukan diagnosis. Bila merasa tidak sehat atau hasil sangat berbeda dari biasanya, hubungi IHC atau layanan darurat sesuai kondisi Anda.</div>`;
    } catch (error) {
      target.innerHTML += state('Data belum dapat dimuat', error.message || 'Coba lagi beberapa saat.', 'error');
    }
  }

  async function wellnessSubmitPersonal(event, type) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const payload = type === 'blood_pressure'
      ? { systolic: Number(data.get('systolic')), diastolic: Number(data.get('diastolic')), pulse: data.get('pulse') ? Number(data.get('pulse')) : null }
      : { value: Number(data.get('glucose')) };
    if (type === 'blood_pressure' && payload.diastolic >= payload.systolic) { notify('Nilai sistolik harus lebih tinggi daripada diastolik.'); return; }
    setBusy(button, true, 'Menyimpan…');
    try {
      await rpc('wellness_record_self', {
        p_program_id: data.get('program_id'), p_measurement_type: type, p_payload: payload,
        p_measured_at: new Date(data.get('measured_at')).toISOString(), p_context: data.get('context'),
        p_device_method: data.get('device_method') || null, p_note: data.get('note') || null,
        p_client_record_id: crypto.randomUUID()
      });
      notify('Hasil tersimpan sebagai input mandiri dan masuk ke timeline program.');
      await renderPersonalWellness();
    } catch (error) { notify(`Hasil belum tersimpan: ${error.message}`); }
    finally { setBusy(button, false); }
  }

  function programMetric(program, key, label, suffix = '') {
    const value = program[key];
    return `<article><span>${safe(label)}</span><strong>${value == null ? '—' : safe(value) + suffix}</strong></article>`;
  }

  async function renderCorporateWellness() {
    const target = $('corporate-wellness-view');
    if (!target) return;
    target.innerHTML = `<section class="wellness-heading"><div><span>CORPORATE WELLNESS</span><h2>Monitoring Program</h2><p>Ringkasan agregat diabetes dan hipertensi untuk HR.</p></div></section>${state('Memuat dashboard', 'Menghitung data cohort yang diizinkan.')}`;
    try {
      const data = await rpc('wellness_corporate_dashboard', { p_program_id: null, p_corporate_id: currentCorporateId || null });
      const programs = data?.programs || [];
      target.innerHTML = `
        <section class="wellness-heading"><div><span>CORPORATE WELLNESS</span><h2>Monitoring Diabetes & Hipertensi</h2><p>HR melihat partisipasi, keteraturan pemantauan, dan tren agregat. Identitas serta hasil individual tetap berada pada peserta dan tim medis.</p></div><div class="wellness-program-chip">Aggregate only</div></section>
        <div class="wellness-notice privacy"><strong>Privasi cohort aktif.</strong><span>Rata-rata otomatis disembunyikan bila jumlah peserta yang berkontribusi kurang dari ${safe(data?.small_cell_threshold || 5)} orang.</span></div>
        ${programs.length ? programs.map(program => `<section class="wellness-card corporate-program">
          <div class="wellness-card-title"><div><span>${safe(program.code)} · ${safe(program.status)}</span><h3>${safe(program.name)}</h3><p>${safe(program.description || 'Program pemantauan kardiometabolik.')}</p></div></div>
          <div class="wellness-kpi-grid">${programMetric(program,'enrolled','Peserta terdaftar')}${programMetric(program,'linked_accounts','Akun Apps tertaut')}${programMetric(program,'active_7d','Aktif 7 hari')}${programMetric(program,'measurements_30d','Pengukuran 30 hari')}${programMetric(program,'bp_coverage_30d','Cakupan tekanan darah')}${programMetric(program,'glucose_coverage_30d','Cakupan gula darah')}</div>
          <div class="wellness-aggregate-grid">
            <article><span>Rerata tekanan darah 30 hari</span><strong>${program.avg_systolic_30d == null ? 'Disembunyikan' : `${safe(program.avg_systolic_30d)}/${safe(program.avg_diastolic_30d)} mmHg`}</strong></article>
            <article><span>Rerata gula darah 30 hari</span><strong>${program.avg_glucose_30d == null ? 'Disembunyikan' : `${safe(program.avg_glucose_30d)} mg/dL`}</strong></article>
          </div>
        </section>`).join('') : state('Belum ada program', 'Admin perlu membuat program dan melakukan enrollment roster perusahaan.')}`;
    } catch (error) { target.innerHTML += state('Dashboard belum dapat dimuat', error.message, 'error'); }
  }

  async function loadAdmin() {
    adminData = await rpc('wellness_admin_dashboard');
    return adminData;
  }

  function adminProgramOptions(programs, selected = '') {
    return (programs || []).map(program => `<option value="${safe(program.id)}" ${program.id === selected ? 'selected' : ''}>${safe(program.code)} · ${safe(program.corporate_name)} · ${safe(program.name)}</option>`).join('');
  }

  async function renderWellnessAdmin() {
    const target = $('wellness-admin-view');
    if (!target) return;
    target.innerHTML = `<section class="wellness-heading"><div><span>ADMIN WELLNESS</span><h2>Rancang Program & Reminder</h2><p>Konfigurasi generik untuk setiap corporate tenant.</p></div></section>${state('Memuat konfigurasi', 'Mengambil program, enrollment, dan rule reminder.')}`;
    try {
      const data = await loadAdmin();
      const programs = data.programs || [];
      const corporates = data.corporates || [];
      target.innerHTML = `
        <section class="wellness-heading"><div><span>ADMIN WELLNESS</span><h2>Rancang Program & Reminder</h2><p>Susun periode, frekuensi pemantauan, enrollment roster, serta antrean reminder tanpa menanam konfigurasi klien ke kode inti.</p></div></section>
        <div class="wellness-layout-two admin-layout">
          <section class="wellness-card"><div class="wellness-card-title"><div><span>PROGRAM</span><h3>Buat program corporate</h3></div></div>
            <form class="wellness-form" onsubmit="wellnessSaveProgram(event)">
              <label>Perusahaan<select name="corporate_id" required><option value="">Pilih perusahaan</option>${corporates.map(c => `<option value="${safe(c.id)}">${safe(c.name)}</option>`).join('')}</select></label>
              <div class="wellness-fields two"><label>Kode program<input name="code" placeholder="CARDIOMET-2026" required></label><label>Nama program<input name="name" placeholder="Program Diabetes & Hipertensi" required></label></div>
              <label>Tujuan program<textarea name="description" rows="3" placeholder="Tujuan, cohort, dan cakupan program"></textarea></label>
              <div class="wellness-fields three"><label>Mulai<input name="starts_on" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Selesai<input name="ends_on" type="date"></label><label>Status<select name="status"><option value="draft">Draft</option><option value="pilot">Pilot</option><option value="active">Aktif</option><option value="paused">Ditunda</option></select></label></div>
              <div class="wellness-fields two"><label>Frekuensi tekanan darah<select name="bp_frequency"><option value="daily">Harian</option><option value="weekly">Mingguan</option></select></label><label>Frekuensi gula darah<select name="glucose_frequency"><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="custom">Sesuai care plan</option></select></label></div>
              <button class="wellness-primary" type="submit">Simpan program</button>
            </form>
          </section>
          <section class="wellness-card"><div class="wellness-card-title"><div><span>CRM REMINDER</span><h3>Atur pengingat peserta</h3></div></div>
            <form class="wellness-form" onsubmit="wellnessSaveReminder(event)">
              <label>Program<select name="program_id" required><option value="">Pilih program</option>${adminProgramOptions(programs)}</select></label>
              <label>Nama rule<input name="name" placeholder="Reminder kontrol harian" required></label>
              <div class="wellness-fields three"><label>Target<select name="measurement_type"><option value="any">Semua pengukuran</option><option value="blood_pressure">Tekanan darah</option><option value="blood_glucose">Gula darah</option></select></label><label>Tidak aktif selama<input name="inactivity_days" type="number" min="1" max="90" value="1" required><small>hari</small></label><label>Jam<input name="send_time" type="time" value="08:00" required></label></div>
              <label>Kanal<select name="channel"><option value="in_app">Notifikasi Apps</option><option value="task_only">Task CRM internal</option><option value="email">Email</option><option value="whatsapp">WhatsApp*</option></select><small>*Pengiriman eksternal memerlukan connector dan persetujuan terpisah.</small></label>
              <label>Pesan<textarea name="message_template" rows="3" maxlength="500" required placeholder="Saatnya mencatat kontrol harian Anda."></textarea></label>
              <button class="wellness-primary" type="submit">Simpan reminder</button>
            </form>
          </section>
        </div>
        <section class="wellness-card"><div class="wellness-card-title"><div><span>PROGRAM AKTIF</span><h3>Enrollment & operasi</h3></div><span>${programs.length} program</span></div>
          <div class="wellness-admin-programs">${programs.length ? programs.map(program => `<article>
            <div><span>${safe(program.code)} · ${safe(program.status)}</span><h4>${safe(program.name)}</h4><p>${safe(program.corporate_name)}</p></div>
            <div class="wellness-program-stats"><b>${safe(program.enrolled)} peserta</b><b>${safe(program.observations)} hasil</b><b>${safe(program.open_tasks)} task</b></div>
            <div class="wellness-row-actions"><button onclick="wellnessEnrollRoster('${safe(program.id)}',this)">Sinkronkan roster</button><button onclick="wellnessGenerateReminders('${safe(program.id)}',this)">Buat task reminder</button><button onclick="wellnessOpenImport('${safe(program.id)}')">Impor hasil IHC</button></div>
          </article>`).join('') : state('Belum ada program', 'Buat program pertama menggunakan formulir di atas.')}</div>
        </section>
        <section class="wellness-card"><div class="wellness-card-title"><div><span>RULE AKTIF</span><h3>Reminder tersimpan</h3></div></div><div class="wellness-task-list">${(data.reminder_rules || []).length ? data.reminder_rules.map(rule => `<article><strong>${safe(rule.name)}</strong><span>${safe(rule.measurement_type)} · ${safe(rule.inactivity_days)} hari · ${safe(rule.channel)} · ${safe(String(rule.send_time).slice(0,5))}</span></article>`).join('') : '<p>Belum ada rule reminder.</p>'}</div></section>`;
    } catch (error) { target.innerHTML += state('Konfigurasi belum dapat dimuat', error.message, 'error'); }
  }

  async function wellnessSaveProgram(event) {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); const data = new FormData(form);
    setBusy(button, true, 'Menyimpan…');
    try {
      await rpc('wellness_admin_save_program', { p_data: {
        corporate_id: data.get('corporate_id'), code: data.get('code'), name: data.get('name'), description: data.get('description'),
        starts_on: data.get('starts_on'), ends_on: data.get('ends_on'), status: data.get('status'),
        measurement_plan: { blood_pressure: data.get('bp_frequency'), blood_glucose: data.get('glucose_frequency') },
        reporting_plan: { daily: 'ihc', weekly: 'corporate_medical', monthly: 'hr_aggregate' }
      }});
      notify('Program wellness tersimpan. Lanjutkan dengan sinkronisasi roster.'); await renderWellnessAdmin();
    } catch (error) { notify(`Program belum tersimpan: ${error.message}`); }
    finally { setBusy(button, false); }
  }

  async function wellnessSaveReminder(event) {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); const data = Object.fromEntries(new FormData(form));
    setBusy(button, true, 'Menyimpan…');
    try { await rpc('wellness_admin_save_reminder', { p_data: data }); notify('Rule reminder tersimpan.'); await renderWellnessAdmin(); }
    catch (error) { notify(`Reminder belum tersimpan: ${error.message}`); }
    finally { setBusy(button, false); }
  }

  async function wellnessEnrollRoster(programId, button) {
    setBusy(button, true, 'Menyinkronkan…');
    try { const result = await rpc('wellness_admin_enroll_roster', { p_program_id: programId }); notify(`${result.affected || 0} enrollment diproses; ${result.linked_accounts || 0} akun Apps sudah tertaut.`); await renderWellnessAdmin(); }
    catch (error) { notify(`Roster belum tersinkron: ${error.message}`); }
    finally { setBusy(button, false); }
  }

  async function wellnessGenerateReminders(programId, button) {
    setBusy(button, true, 'Membuat task…');
    try { const result = await rpc('wellness_generate_reminders', { p_program_id: programId }); notify(`${result.tasks_created || 0} task reminder baru dibuat.`); await renderWellnessAdmin(); }
    catch (error) { notify(`Task belum dibuat: ${error.message}`); }
    finally { setBusy(button, false); }
  }

  function wellnessOpenImport(programId) {
    showView('wellness-import-view');
    setTimeout(() => { const select = $('wellness-import-program'); if (select) select.value = programId; }, 0);
  }

  async function renderWellnessImport() {
    const target = $('wellness-import-view');
    if (!target) return;
    target.innerHTML = `<section class="wellness-heading"><div><span>IHC DATA INTAKE</span><h2>Impor Hasil Pemeriksaan</h2><p>Preflight dan audit batch sebelum data masuk ke timeline peserta.</p></div></section>${state('Memuat program', 'Mengambil konfigurasi program yang tersedia.')}`;
    try {
      const data = adminData || await loadAdmin();
      const programs = data.programs || [];
      target.innerHTML = `<section class="wellness-heading"><div><span>IHC DATA INTAKE</span><h2>Bulk Upload Hasil IHC</h2><p>Unggah CSV tervalidasi. Setiap baris dicocokkan dengan NIK karyawan, diberi provenance IHC, dan dicatat dalam batch yang idempoten.</p></div><button class="wellness-secondary" onclick="wellnessDownloadTemplate()">Unduh template CSV</button></section>
        <section class="wellness-card wellness-form">
          <div class="wellness-fields two"><label>Program<select id="wellness-import-program" required><option value="">Pilih program</option>${adminProgramOptions(programs)}</select></label><label>Berkas CSV<input id="wellness-import-file" type="file" accept=".csv,text/csv" onchange="wellnessReadImportFile(this)"></label></div>
          <div class="wellness-notice"><strong>Kolom wajib:</strong><span><code>employee_id</code>, <code>measured_at</code>, lalu minimal satu dari pasangan <code>systolic/diastolic</code>, <code>glucose</code>, atau <code>hba1c</code>. Kolom tambahan: <code>pulse</code>, <code>glucose_context</code>, <code>external_id</code>.</span></div>
          <div id="wellness-import-preview">${state('Belum ada file', 'Pilih CSV hasil IHC untuk menjalankan preflight.')}</div>
          <button id="wellness-import-submit" class="wellness-primary" type="button" onclick="wellnessUploadImport(this)" disabled>Impor hasil tervalidasi</button>
        </section>
        <section class="wellness-card"><div class="wellness-card-title"><div><span>RIWAYAT BATCH</span><h3>Monitoring impor</h3></div></div><div class="wellness-import-history">${(data.imports || []).length ? data.imports.map(batch => `<article><div><strong>${safe(batch.source_file || 'Batch IHC')}</strong><span>${safe(dateLabel(batch.created_at))}</span></div><div><b>${safe(batch.status)}</b><span>${safe(batch.accepted_rows)}/${safe(batch.total_rows)} diterima · ${safe(batch.rejected_rows)} ditolak</span></div></article>`).join('') : '<p>Belum ada batch impor.</p>'}</div></section>`;
    } catch (error) { target.innerHTML += state('Program belum dapat dimuat', error.message, 'error'); }
  }

  function parseCsv(text) {
    const result = []; let row = []; let cell = ''; let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i], next = text[i + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(cell); cell = ''; if (row.some(value => value.trim())) result.push(row); row = [];
      } else cell += char;
    }
    row.push(cell); if (row.some(value => value.trim())) result.push(row);
    if (result.length < 2) return [];
    const headers = result.shift().map(value => value.trim().toLowerCase());
    return result.map(cells => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || '').trim()])));
  }

  function preflightRows(rows) {
    const allowedContext = new Set(['fasting','random','postprandial','before_meal','before_sleep','']);
    return rows.map((row, index) => {
      const errors = [];
      if (!row.employee_id) errors.push('employee_id kosong');
      if (!row.measured_at || Number.isNaN(new Date(row.measured_at).getTime())) errors.push('measured_at tidak valid');
      const hasBp = row.systolic || row.diastolic;
      if (hasBp && !(row.systolic && row.diastolic)) errors.push('sistolik/diastolik harus berpasangan');
      if (!hasBp && !row.glucose && !row.hba1c) errors.push('nilai pemeriksaan kosong');
      if (row.systolic && (+row.systolic < 40 || +row.systolic > 300)) errors.push('sistolik di luar batas');
      if (row.diastolic && (+row.diastolic < 30 || +row.diastolic > 200)) errors.push('diastolik di luar batas');
      if (row.glucose && (+row.glucose < 20 || +row.glucose > 600)) errors.push('glukosa di luar batas');
      if (!allowedContext.has(row.glucose_context || '')) errors.push('konteks glukosa tidak dikenal');
      return { row: index + 2, data: row, errors };
    });
  }

  async function wellnessReadImportFile(input) {
    const file = input.files?.[0]; const preview = $('wellness-import-preview'); const submit = $('wellness-import-submit');
    importRows = []; importRaw = ''; if (submit) submit.disabled = true;
    if (!file) { if (preview) preview.innerHTML = state('Belum ada file', 'Pilih CSV hasil IHC.'); return; }
    if (file.size > 5 * 1024 * 1024) { preview.innerHTML = state('File terlalu besar', 'Maksimal 5 MB per batch.', 'error'); return; }
    importRaw = await file.text(); const parsed = parseCsv(importRaw); const checked = preflightRows(parsed);
    const invalid = checked.filter(item => item.errors.length); importRows = checked.filter(item => !item.errors.length).map(item => item.data);
    preview.innerHTML = `<div class="wellness-preflight"><div><strong>${parsed.length}</strong><span>Total baris</span></div><div><strong>${importRows.length}</strong><span>Lolos preflight</span></div><div class="${invalid.length ? 'bad' : ''}"><strong>${invalid.length}</strong><span>Perlu diperbaiki</span></div></div>
      ${invalid.length ? `<div class="wellness-error-list">${invalid.slice(0,20).map(item => `<p>Baris ${item.row}: ${safe(item.errors.join(', '))}</p>`).join('')}</div>` : '<div class="wellness-notice success"><strong>Preflight lulus.</strong><span>Data siap dikirim ke validasi server dan audit batch.</span></div>'}
      ${importRows.length ? `<div class="wellness-table-wrap"><table><thead><tr><th>Employee ID</th><th>Waktu</th><th>Tekanan darah</th><th>Glukosa</th><th>HbA1c</th></tr></thead><tbody>${importRows.slice(0,10).map(row => `<tr><td>${safe(row.employee_id)}</td><td>${safe(row.measured_at)}</td><td>${safe(row.systolic || '—')}/${safe(row.diastolic || '—')}</td><td>${safe(row.glucose || '—')}</td><td>${safe(row.hba1c || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    if (submit) submit.disabled = invalid.length > 0 || importRows.length === 0;
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function wellnessUploadImport(button) {
    const programId = $('wellness-import-program')?.value; const file = $('wellness-import-file')?.files?.[0];
    if (!programId) { notify('Pilih program tujuan terlebih dahulu.'); return; }
    if (!importRows.length || !file) { notify('Jalankan preflight file CSV terlebih dahulu.'); return; }
    setBusy(button, true, 'Mengimpor…');
    try {
      const result = await rpc('wellness_import_ihc', { p_program_id: programId, p_source_file: file.name, p_checksum: await sha256(importRaw), p_rows: importRows });
      notify(result.duplicate ? 'Batch yang sama sudah pernah diproses; tidak ada data ganda.' : `${result.accepted_rows || 0} baris diterima dan ${result.rejected_rows || 0} ditolak.`);
      adminData = null; importRows = []; importRaw = ''; await renderWellnessImport();
    } catch (error) { notify(`Impor gagal: ${error.message}`); }
    finally { setBusy(button, false); }
  }

  function wellnessDownloadTemplate() {
    const csv = 'employee_id,measured_at,systolic,diastolic,pulse,glucose,glucose_context,hba1c,external_id\nSYNTH-001,2026-09-22T08:00:00+07:00,120,80,72,105,fasting,5.6,IHC-SYNTH-001\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'template-wellness-ihc.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  Object.assign(window, {
    renderPersonalWellness, renderCorporateWellness, renderWellnessAdmin, renderWellnessImport,
    wellnessSubmitPersonal, wellnessSaveProgram, wellnessSaveReminder, wellnessEnrollRoster,
    wellnessGenerateReminders, wellnessOpenImport, wellnessReadImportFile, wellnessUploadImport,
    wellnessDownloadTemplate
  });
})();
