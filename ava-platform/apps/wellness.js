// OWNED_BY: generic. Cardiometabolic wellness UI shared by personal,
// corporate (aggregate only), and internal program administrators.
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const WELLNESS_NOTICE_VERSION = 'wellness-privacy-v1';
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
      const activePrograms = programs.filter(program => ['granted', 'not_required'].includes(program.consent_status));
      const pendingPrograms = programs.filter(program => !['granted', 'not_required'].includes(program.consent_status));
      if (!programs.length) {
        target.innerHTML = `<section class="wellness-heading"><div><span>PROGRAM WELLNESS</span><h2>Belum ada program aktif</h2><p>Akun Anda belum ditautkan ke program wellness perusahaan.</p></div></section>${state('Enrollment diperlukan', 'Hubungi admin program atau IHC. Setelah roster disinkronkan, program akan muncul otomatis di akun ini.')}`;
        return;
      }
      const programOptions = activePrograms.map(program => `<option value="${safe(program.id)}">${safe(program.name)}</option>`).join('');
      const groups = groupObservations(personalData.observations);
      const tasks = personalData.open_tasks || [];
      const consentCards = pendingPrograms.map(program => `<section class="wellness-card wellness-consent-card">
        <div class="wellness-card-title"><div><span>PERSETUJUAN PESERTA</span><h3>Aktifkan ${safe(program.name)}</h3></div><span class="wellness-badge self">Belum disetujui</span></div>
        <p>Program memproses hasil tekanan darah, gula darah, HbA1c, aktivitas pencatatan, dan data roster yang diperlukan untuk pemantauan wellness. Input mandiri tetap berlabel belum diverifikasi, sedangkan hasil IHC berlabel terverifikasi.</p>
        <p>Tim HR hanya menerima ringkasan kelompok dengan perlindungan small-cell; nama, catatan, dan nilai kesehatan individual tidak ditampilkan pada dashboard HR. Data ini membantu pemantauan program dan tidak menggantikan diagnosis atau konsultasi medis.</p>
        <label class="wellness-consent-check"><input id="wellness-consent-${safe(program.id)}" type="checkbox"> <span>Saya telah membaca pemberitahuan di atas dan menyetujui penggunaan data untuk program ini. Saya dapat menghubungi pengelola program untuk pertanyaan atau penarikan persetujuan.</span></label>
        <button class="wellness-primary" type="button" onclick="wellnessAcceptConsent(this,'${safe(program.id)}')">Setujui dan aktifkan pencatatan</button>
        <small>Versi pemberitahuan: ${WELLNESS_NOTICE_VERSION}</small>
      </section>`).join('');
      target.innerHTML = `
        <section class="wellness-heading"><div><span>PROGRAM WELLNESS</span><h2>Diabetes & Hipertensi</h2><p>Data mandiri diberi label khusus dan dapat ditinjau tim medis IHC. Hasil IHC yang tervalidasi muncul pada timeline yang sama.</p></div><div class="wellness-program-chip">${safe(programs[0].name)}</div></section>
        ${consentCards}
        ${activePrograms.length ? `<div class="wellness-layout-two">
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
        </div>` : state('Pencatatan belum aktif', 'Baca dan setujui pemberitahuan program di atas. Form pencatatan akan terbuka setelah persetujuan tersimpan.')}
        ${tasks.length ? `<section class="wellness-card"><div class="wellness-card-title"><div><span>PENGINGAT</span><h3>Tugas program Anda</h3></div></div><div class="wellness-task-list">${tasks.map(task => `<article><strong>${safe(task.payload?.message || 'Lakukan pengukuran sesuai jadwal.')}</strong><span>${safe(dateLabel(task.due_at))}</span></article>`).join('')}</div></section>` : ''}
        <section class="wellness-card"><div class="wellness-card-title"><div><span>TIMELINE</span><h3>Riwayat pengukuran</h3></div><span>${groups.length} catatan</span></div><div class="wellness-readings">${groups.length ? groups.map(observationCard).join('') : state('Belum ada pengukuran', 'Masukkan tekanan darah atau gula darah pertama Anda.')}</div></section>
        <div class="wellness-safety">Hasil pada halaman ini membantu pemantauan program dan bukan diagnosis. Bila merasa tidak sehat atau hasil sangat berbeda dari biasanya, hubungi IHC atau layanan darurat sesuai kondisi Anda.</div>`;
    } catch (error) {
      target.innerHTML += state('Data belum dapat dimuat', error.message || 'Coba lagi beberapa saat.', 'error');
    }
  }

  async function wellnessAcceptConsent(button, programId) {
    const checkbox = $(`wellness-consent-${programId}`);
    if (!checkbox?.checked) { notify('Centang persetujuan setelah membaca pemberitahuan program.'); return; }
    setBusy(button, true, 'Menyimpan persetujuan…');
    try {
      await rpc('wellness_accept_consent', {
        p_program_id: programId,
        p_notice_version: WELLNESS_NOTICE_VERSION,
        p_accept: true
      });
      notify('Persetujuan tersimpan. Pencatatan program sudah aktif.');
      await renderPersonalWellness();
    } catch (error) { notify(`Persetujuan belum tersimpan: ${error.message}`); }
    finally { setBusy(button, false); }
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

    function wellnessExportHrReport() {
    if (!window._lastCorporateData || !window._lastCorporateData.programs) { notify('Data laporan HRD belum tersedia.'); return; }
    const progs = window._lastCorporateData.programs;
    let csv = 'Kode Program,Nama Program,Perusahaan,Peserta Terdaftar,Akun Apps Tertaut,Aktif 7 Hari,Pengukuran 30 Hari,Cakupan Tensi,Cakupan Gula,Rerata Sistolik,Rerata Diastolik,Rerata Gula\n';
    progs.forEach(p => {
      csv += `"${p.code}","${p.name}","${p.corporate_name || ''}",${p.enrolled || 0},${p.linked_accounts || 0},${p.active_7d || 0},${p.measurements_30d || 0},${p.bp_coverage_30d || 0},${p.glucose_coverage_30d || 0},${p.avg_systolic_30d ?? 'Disembunyikan'},${p.avg_diastolic_30d ?? 'Disembunyikan'},${p.avg_glucose_30d ?? 'Disembunyikan'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `laporan-wellness-hrd-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  async function renderCorporateWellness() {
    const target = $('corporate-wellness-view');
    if (!target) return;
    target.innerHTML = `<section class="wellness-heading"><div><span>CORPORATE WELLNESS</span><h2>Monitoring Program</h2><p>Ringkasan agregat diabetes dan hipertensi untuk HR.</p></div></section>${state('Memuat dashboard', 'Menghitung data cohort yang diizinkan.')}`;
    try {
      const data = await rpc('wellness_corporate_dashboard', { p_program_id: null, p_corporate_id: currentCorporateId || null });
      window._lastCorporateData = data;
      const programs = data?.programs || [];
      const threshold = data?.small_cell_threshold || 5;

      target.innerHTML = `
        <section class="wellness-heading corporate-hero" style="background: linear-gradient(135deg, #0f172a 0%, #0f4c5c 100%); border-radius: 16px; padding: 24px; color: #fff; margin-bottom: 20px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
            <div>
              <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; color:#5eead4; text-transform:uppercase;">EXECUTIVE HR DASHBOARD · WELLNESS COHORT</span>
              <h2 style="margin:6px 0 8px; font-size:24px; color:#fff; font-weight:800;">Monitoring Kesehatan &amp; Wellness Karyawan</h2>
              <p style="margin:0; max-width:700px; font-size:13px; color:#cbd5e1; line-height:1.6;">Monitoring partisipasi, kepatuhan kontrol, stratifikasi risiko 4 level, dan tren kardiometabolik. Privasi individual 100% terlindungi sesuai UU PDP No. 27/2022.</p>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
              <div class="wellness-program-chip" style="background:rgba(94,234,212,0.15); border:1px solid rgba(94,234,212,0.3); color:#5eead4; font-size:11px; font-weight:700; padding:6px 12px; border-radius:20px;">&#x1F512; Aggregate Only · Small-cell &#x2265;${threshold}</div>
              ${programs.length ? `<button class="wellness-secondary" onclick="wellnessExportHrReport()" style="background:#fff; color:#0f172a; border:0; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.1);">&#x1F4E5; Unduh Laporan HRD (CSV)</button>` : ''}
            </div>
          </div>
        </section>

        <!-- RISK STRATIFICATION LEGEND / FLOWCHART -->
        <section style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:20px; box-shadow:0 4px 16px rgba(0,0,0,0.04);">
          <div style="margin-bottom:16px;">
            <span style="font-size:10px; font-weight:800; color:#0e7c86; letter-spacing:0.08em; text-transform:uppercase;">SISTEM STRATIFIKASI RISIKO</span>
            <h3 style="margin:4px 0 2px; font-size:15px; color:#0f172a; font-weight:800;">Alur Kategorisasi 4 Level Risiko Kardiometabolik</h3>
            <p style="margin:0; font-size:11.5px; color:#64748b;">Berdasarkan pedoman JNC-8 (Hipertensi) &amp; ADA 2024 (Diabetes). Nilai tekanan darah dalam mmHg, gula darah puasa dalam mg/dL.</p>
          </div>
          <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0; position:relative; margin-bottom:16px;">
            <div style="position:absolute; top:27px; left:12.5%; right:12.5%; height:3px; background:linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444); z-index:0; border-radius:4px;"></div>
            <div style="position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; padding:0 6px;">
              <div style="width:54px; height:54px; border-radius:50%; background:#dcfce7; border:3px solid #22c55e; display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:10px; box-shadow:0 4px 12px rgba(34,197,94,0.25);">&#x2705;</div>
              <div style="background:#dcfce7; border:1.5px solid #22c55e; border-radius:10px; padding:10px 8px; width:100%; text-align:center;">
                <div style="font-size:10px; font-weight:800; color:#15803d; text-transform:uppercase; letter-spacing:0.05em;">L1 · Normal</div>
                <div style="font-size:11px; color:#166534; margin-top:4px; line-height:1.5;">TD: &lt;120/80<br>GDS: &lt;100</div>
                <div style="margin-top:6px; font-size:10px; color:#15803d; font-weight:700; background:#bbf7d0; padding:3px 6px; border-radius:6px;">&#x2714; Pantau rutin</div>
              </div>
            </div>
            <div style="position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; padding:0 6px;">
              <div style="width:54px; height:54px; border-radius:50%; background:#fef9c3; border:3px solid #facc15; display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:10px; box-shadow:0 4px 12px rgba(250,204,21,0.25);">&#x26A0;&#xFE0F;</div>
              <div style="background:#fef9c3; border:1.5px solid #facc15; border-radius:10px; padding:10px 8px; width:100%; text-align:center;">
                <div style="font-size:10px; font-weight:800; color:#a16207; text-transform:uppercase; letter-spacing:0.05em;">L2 · Perhatian</div>
                <div style="font-size:11px; color:#713f12; margin-top:4px; line-height:1.5;">TD: 120–139/80–89<br>GDS: 100–125</div>
                <div style="margin-top:6px; font-size:10px; color:#854d0e; font-weight:700; background:#fef08a; padding:3px 6px; border-radius:6px;">&#x26A1; Edukasi &amp; gaya hidup</div>
              </div>
            </div>
            <div style="position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; padding:0 6px;">
              <div style="width:54px; height:54px; border-radius:50%; background:#ffedd5; border:3px solid #f97316; display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:10px; box-shadow:0 4px 12px rgba(249,115,22,0.25);">&#x1F536;</div>
              <div style="background:#ffedd5; border:1.5px solid #f97316; border-radius:10px; padding:10px 8px; width:100%; text-align:center;">
                <div style="font-size:10px; font-weight:800; color:#c2410c; text-transform:uppercase; letter-spacing:0.05em;">L3 · Risiko Tinggi</div>
                <div style="font-size:11px; color:#9a3412; margin-top:4px; line-height:1.5;">TD: 140–159/90–99<br>GDS: 126–199</div>
                <div style="margin-top:6px; font-size:10px; color:#9a3412; font-weight:700; background:#fed7aa; padding:3px 6px; border-radius:6px;">&#x1F3E5; Rujuk IHC segera</div>
              </div>
            </div>
            <div style="position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; padding:0 6px;">
              <div style="width:54px; height:54px; border-radius:50%; background:#fee2e2; border:3px solid #ef4444; display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:10px; box-shadow:0 4px 12px rgba(239,68,68,0.3);">&#x1F6A8;</div>
              <div style="background:#fee2e2; border:1.5px solid #ef4444; border-radius:10px; padding:10px 8px; width:100%; text-align:center;">
                <div style="font-size:10px; font-weight:800; color:#b91c1c; text-transform:uppercase; letter-spacing:0.05em;">L4 · Sangat Berisiko</div>
                <div style="font-size:11px; color:#7f1d1d; margin-top:4px; line-height:1.5;">TD: &#x2265;160/&#x2265;100<br>GDS: &#x2265;200</div>
                <div style="margin-top:6px; font-size:10px; color:#7f1d1d; font-weight:700; background:#fecaca; padding:3px 6px; border-radius:6px;">&#x1F691; Tindak darurat &amp; rujuk</div>
              </div>
            </div>
          </div>
          <div style="font-size:10.5px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:10px;">
            &#x2695;&#xFE0F; <strong>Referensi klinis:</strong> JNC-8 (Hipertensi) · ADA Standards of Care 2024 (Diabetes) · PERKENI 2021. Kategorisasi untuk pemantauan program, bukan diagnosis klinis.
          </div>
        </section>

        <div class="wellness-notice privacy" style="background:#f0fdfa; border:1px solid #99f6e4; color:#0f766e; border-radius:12px; padding:14px 16px; margin-bottom:20px; font-size:12.5px; display:flex; gap:10px; align-items:center;">
          <span style="font-size:18px;">&#x1F6E1;&#xFE0F;</span>
          <div><strong>Proteksi Kerahasiaan Cohort Aktif.</strong> Rata-rata medis otomatis disembunyikan jika jumlah peserta terukur kurang dari ${threshold} orang agar identitas &amp; data kesehatan individual tidak dapat dikenali.</div>
        </div>

        ${programs.length ? programs.map(program => {
          const isHidden = program.avg_systolic_30d == null;
          const enrolled = program.enrolled || 0;
          const screened = program.screened_count || 0;
          const unscreened = program.unscreened_count || 0;
          const l1 = program.risk_l1_count || 0;
          const l2 = program.risk_l2_count || 0;
          const l3 = program.risk_l3_count || 0;
          const l4 = program.risk_l4_count || 0;
          const pct = n => screened > 0 ? Math.round((n / screened) * 100) : 0;
          const hasRiskData = screened > 0;
          return `<section class="wellness-card corporate-program" style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:20px; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
            <div class="wellness-card-title" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
              <div>
                <span style="font-size:10px; font-weight:800; color:#0e7c86; letter-spacing:0.05em; text-transform:uppercase;">PROGRAM: ${safe(program.code)} · STATUS: ${safe(program.status).toUpperCase()}</span>
                <h3 style="margin:4px 0 2px; font-size:18px; color:#0f172a; font-weight:800;">${safe(program.name)}</h3>
                <p style="margin:0; font-size:12px; color:#64748b;">${safe(program.description || 'Program pemantauan kardiometabolik corporate.')}</p>
              </div>
              <span class="wellness-badge verified" style="background:#d1fae5; color:#047857; font-size:10.5px; font-weight:700; padding:4px 10px; border-radius:20px;">ISO 15189 Compliant</span>
            </div>

            <div class="wellness-kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:20px;">
              <article style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:10px;">
                <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">&#x1F465; Peserta Terdaftar</span>
                <strong style="display:block; margin-top:4px; font-size:17px; color:#0f172a;">${safe(enrolled)} <small style="font-size:11px; font-weight:500;">orang</small></strong>
              </article>
              <article style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:10px;">
                <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">&#x1F4F1; Apps Tertaut</span>
                <strong style="display:block; margin-top:4px; font-size:17px; color:#0f172a;">${safe(program.linked_accounts || 0)} <small style="font-size:11px; font-weight:500;">akun</small></strong>
              </article>
              <article style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:10px;">
                <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">&#x26A1; Aktif 7 Hari</span>
                <strong style="display:block; margin-top:4px; font-size:17px; color:#0f172a;">${safe(program.active_7d || 0)} <small style="font-size:11px; font-weight:500;">peserta</small></strong>
              </article>
              <article style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:10px;">
                <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">&#x1F4CA; Total Sesi (30d)</span>
                <strong style="display:block; margin-top:4px; font-size:17px; color:#0f172a;">${safe(program.measurements_30d || 0)} <small style="font-size:11px; font-weight:500;">sesi</small></strong>
              </article>
              <article style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:10px;">
                <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">&#x1FAC0; Cakupan Tensi</span>
                <strong style="display:block; margin-top:4px; font-size:17px; color:#0f172a;">${safe(program.bp_coverage_30d || 0)} <small style="font-size:11px; font-weight:500;">sesi</small></strong>
              </article>
              <article style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:10px;">
                <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">&#x1FA78; Cakupan Gula</span>
                <strong style="display:block; margin-top:4px; font-size:17px; color:#0f172a;">${safe(program.glucose_coverage_30d || 0)} <small style="font-size:11px; font-weight:500;">sesi</small></strong>
              </article>
            </div>

            <!-- HRD TIER ASSIGNMENT PANEL -->
            <div style="background:#fff; border:1.5px solid #0e7c86; border-radius:14px; overflow:hidden; margin-bottom:16px;">
              <button onclick="(function(btn){const body=btn.parentElement.querySelector('[data-tier-body]');const isOpen=body.style.display!=='none';body.style.display=isOpen?'none':'block';btn.querySelector('.tc').style.transform=isOpen?'rotate(0)':'rotate(180deg)';})(this)" style="width:100%; display:flex; align-items:center; gap:10px; padding:14px 18px; background:linear-gradient(90deg,#f0fdfa,#fff); border:0; cursor:pointer; text-align:left;">
                <span style="font-size:18px;">&#x1F465;</span>
                <div style="flex:1;">
                  <span style="font-size:11px; font-weight:800; color:#0e7c86; text-transform:uppercase; letter-spacing:0.06em;">MANAJEMEN PESERTA PER TIER</span>
                  <p style="margin:2px 0 0; font-size:12px; color:#475569;">Lihat daftar karyawan per level risiko &middot; Assign treatment tambahan.</p>
                </div>
                <span class="tc" style="font-size:14px; color:#0e7c86; transition:transform 0.2s;">&#x25BC;</span>
              </button>
              <div data-tier-body style="display:none; border-top:1.5px solid #99f6e4;" id="${_hrdPanelId ? _hrdPanelId(program.id) : ('hrd-tp-'+safe(program.id).replace(/-/g,'').slice(0,10))}">
                <div style="padding:16px;">
                  <p style="margin:0 0 10px; font-size:11.5px; color:#64748b;">Klik tombol di bawah untuk memuat roster peserta terbaru berdasarkan tier risiko dan membuat assignment treatment wellness tambahan.</p>
                  <button onclick="wellnessHrdLoadTierPanel('${safe(program.id)}')" style="font-size:12px; padding:8px 20px; border-radius:8px; border:0; background:linear-gradient(135deg,#0f4c5c,#0e7c86); color:#fff; cursor:pointer; font-weight:700;">&#x1F504; Muat Daftar Peserta</button>
                </div>
              </div>
            </div>

            <!-- RISK DISTRIBUTION CHART -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:18px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                <div>
                  <h4 style="margin:0 0 2px; font-size:13px; color:#0f172a; font-weight:800;">&#x1F4CA; Distribusi Risiko Karyawan</h4>
                  <p style="margin:0; font-size:11px; color:#64748b;">${screened} dari ${enrolled} peserta sudah terukur &middot; ${unscreened} belum ada data</p>
                </div>
                <span style="font-size:10.5px; font-weight:700; padding:3px 10px; border-radius:20px; background:${l3+l4 > 0 ? '#fee2e2' : '#dcfce7'}; color:${l3+l4 > 0 ? '#b91c1c' : '#15803d'};">${l3+l4 > 0 ? '&#x26A0; '+(l3+l4)+' perlu perhatian klinis' : '&#x2705; Profil risiko baik'}</span>
              </div>

              ${hasRiskData ? `
              <!-- Horizontal stacked bar chart -->
              <div style="margin-bottom:14px;">
                <div style="height:28px; border-radius:8px; overflow:hidden; display:flex; background:#e2e8f0; box-shadow:inset 0 1px 3px rgba(0,0,0,0.08);">
                  ${pct(l1) > 0 ? `<div title="L1 Normal: ${l1} orang (${pct(l1)}%)" style="width:${pct(l1)}%; background:linear-gradient(90deg,#22c55e,#4ade80); display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:800;">${pct(l1) >= 10 ? pct(l1)+'%' : ''}</div>` : ''}
                  ${pct(l2) > 0 ? `<div title="L2 Perhatian: ${l2} orang (${pct(l2)}%)" style="width:${pct(l2)}%; background:linear-gradient(90deg,#facc15,#fbbf24); display:flex; align-items:center; justify-content:center; color:#78350f; font-size:10px; font-weight:800;">${pct(l2) >= 10 ? pct(l2)+'%' : ''}</div>` : ''}
                  ${pct(l3) > 0 ? `<div title="L3 Risiko Tinggi: ${l3} orang (${pct(l3)}%)" style="width:${pct(l3)}%; background:linear-gradient(90deg,#f97316,#fb923c); display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:800;">${pct(l3) >= 10 ? pct(l3)+'%' : ''}</div>` : ''}
                  ${pct(l4) > 0 ? `<div title="L4 Sangat Berisiko: ${l4} orang (${pct(l4)}%)" style="width:${pct(l4)}%; background:linear-gradient(90deg,#ef4444,#dc2626); display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:800;">${pct(l4) >= 10 ? pct(l4)+'%' : ''}</div>` : ''}
                </div>
                <div style="display:flex; gap:14px; margin-top:8px; flex-wrap:wrap;">
                  <span style="font-size:10px; color:#15803d; display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#22c55e; border-radius:2px;"></span>L1 Normal</span>
                  <span style="font-size:10px; color:#a16207; display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#facc15; border-radius:2px;"></span>L2 Perhatian</span>
                  <span style="font-size:10px; color:#c2410c; display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#f97316; border-radius:2px;"></span>L3 Risiko Tinggi</span>
                  <span style="font-size:10px; color:#b91c1c; display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#ef4444; border-radius:2px;"></span>L4 Sangat Berisiko</span>
                </div>
              </div>

              <!-- 4-Tier cards -->
              <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                <div style="background:#dcfce7; border:1.5px solid #22c55e; border-radius:10px; padding:10px; text-align:center;">
                  <div style="font-size:18px; margin-bottom:4px;">&#x2705;</div>
                  <div style="font-size:9.5px; font-weight:800; color:#15803d; text-transform:uppercase;">L1 Normal</div>
                  <div style="font-size:22px; font-weight:900; color:#14532d; margin:4px 0 2px; line-height:1;">${l1}</div>
                  <div style="font-size:10px; color:#16a34a;">${pct(l1)}%</div>
                  <div style="font-size:9px; color:#15803d; margin-top:4px; font-style:italic; line-height:1.3;">Pantau rutin</div>
                </div>
                <div style="background:#fef9c3; border:1.5px solid #facc15; border-radius:10px; padding:10px; text-align:center;">
                  <div style="font-size:18px; margin-bottom:4px;">&#x26A0;&#xFE0F;</div>
                  <div style="font-size:9.5px; font-weight:800; color:#a16207; text-transform:uppercase;">L2 Perhatian</div>
                  <div style="font-size:22px; font-weight:900; color:#713f12; margin:4px 0 2px; line-height:1;">${l2}</div>
                  <div style="font-size:10px; color:#a16207;">${pct(l2)}%</div>
                  <div style="font-size:9px; color:#854d0e; margin-top:4px; font-style:italic; line-height:1.3;">Edukasi &amp; gaya hidup</div>
                </div>
                <div style="background:#ffedd5; border:1.5px solid #f97316; border-radius:10px; padding:10px; text-align:center;">
                  <div style="font-size:18px; margin-bottom:4px;">&#x1F536;</div>
                  <div style="font-size:9.5px; font-weight:800; color:#c2410c; text-transform:uppercase;">L3 Risiko Tinggi</div>
                  <div style="font-size:22px; font-weight:900; color:#7c2d12; margin:4px 0 2px; line-height:1;">${l3}</div>
                  <div style="font-size:10px; color:#c2410c;">${pct(l3)}%</div>
                  <div style="font-size:9px; color:#9a3412; margin-top:4px; font-style:italic; line-height:1.3;">Rujuk IHC segera</div>
                </div>
                <div style="background:#fee2e2; border:1.5px solid #ef4444; border-radius:10px; padding:10px; text-align:center;">
                  <div style="font-size:18px; margin-bottom:4px;">&#x1F6A8;</div>
                  <div style="font-size:9.5px; font-weight:800; color:#b91c1c; text-transform:uppercase;">L4 Sangat Berisiko</div>
                  <div style="font-size:22px; font-weight:900; color:#7f1d1d; margin:4px 0 2px; line-height:1;">${l4}</div>
                  <div style="font-size:10px; color:#b91c1c;">${pct(l4)}%</div>
                  <div style="font-size:9px; color:#7f1d1d; margin-top:4px; font-style:italic; line-height:1.3;">Tindak darurat &amp; rujuk</div>
                </div>
              </div>

              ${l3+l4 > 0 ? `
              <div style="margin-top:12px; background:#fef2f2; border:1px solid #fca5a5; border-radius:10px; padding:12px; display:flex; gap:10px; align-items:flex-start;">
                <span style="font-size:20px; flex-shrink:0;">&#x2695;&#xFE0F;</span>
                <div style="font-size:12px; color:#7f1d1d; line-height:1.7;">
                  <strong>Rekomendasi Tindak Lanjut HR:</strong><br>
                  ${l4 > 0 ? `<span>• <strong>${l4} karyawan L4</strong> memerlukan tindakan segera — koordinasikan dengan IHC / fasilitas kesehatan rujukan.</span><br>` : ''}
                  ${l3 > 0 ? `<span>• <strong>${l3} karyawan L3</strong> perlu rujukan IHC dalam 1–2 minggu untuk evaluasi klinis lebih lanjut.</span>` : ''}
                </div>
              </div>` : ''}
              ` : `
              <div style="background:#fff; border:1px dashed #cbd5e1; border-radius:10px; padding:16px; text-align:center; color:#94a3b8; font-size:12.5px;">
                &#x1F4EB; Belum ada data pengukuran untuk menghitung distribusi risiko. Peserta perlu mulai merekam data kesehatan.
              </div>
              `}
            </div>

            <!-- AGGREGATE AVERAGES -->
            <div style="background:#f1f5f9; border-radius:12px; padding:16px; margin-top:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                <h4 style="margin:0; font-size:13px; color:#0f172a; font-weight:800;">&#x1F4C8; Rerata Cohort Karyawan (30 Hari)</h4>
                <span style="font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; background:${isHidden ? '#ffedd5' : '#dcfce7'}; color:${isHidden ? '#9a3412' : '#166534'};">${isHidden ? '&#x1F512; Small-cell Active (< 5 peserta)' : '&#x2705; Cohort Terukur (&#x2265;5 peserta)'}</span>
              </div>
              ${isHidden ? `
                <div style="background:#fff; border:1px dashed #fdba74; border-radius:10px; padding:14px; display:flex; gap:12px; align-items:center;">
                  <div style="font-size:24px; flex-shrink:0;">&#x1F6E1;&#xFE0F;</div>
                  <div style="font-size:12px; color:#9a3412; line-height:1.5;">
                    <strong>Statistik Rerata Disembunyikan secara Otomatis</strong><br>
                    Jumlah peserta terukur belum mencapai ambang batas ${threshold} orang. Sesuai UU PDP, rerata disembunyikan untuk menjaga perlindungan privasi data individu.
                  </div>
                </div>
              ` : `
                <div class="wellness-aggregate-grid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px;">
                  <article style="background:#fff; border:1px solid #cbd5e1; padding:14px; border-radius:10px;">
                    <span style="font-size:11px; color:#475569; font-weight:700;">&#x1FAC0; Rerata Tekanan Darah Cohort</span>
                    <strong style="display:block; margin-top:4px; font-size:20px; color:#0f172a;">${safe(program.avg_systolic_30d)} / ${safe(program.avg_diastolic_30d)} <small style="font-size:12px;">mmHg</small></strong>
                    <span style="font-size:10.5px; color:#64748b; margin-top:4px; display:block;">Berdasarkan ${safe(program.bp_coverage_30d)} pengukuran terotorisasi</span>
                  </article>
                  <article style="background:#fff; border:1px solid #cbd5e1; padding:14px; border-radius:10px;">
                    <span style="font-size:11px; color:#475569; font-weight:700;">&#x1FA78; Rerata Gula Darah Puasa Cohort</span>
                    <strong style="display:block; margin-top:4px; font-size:20px; color:#0f172a;">${safe(program.avg_glucose_30d)} <small style="font-size:12px;">mg/dL</small></strong>
                    <span style="font-size:10.5px; color:#64748b; margin-top:4px; display:block;">Berdasarkan ${safe(program.glucose_coverage_30d)} pengukuran terotorisasi</span>
                  </article>
                </div>
              `}
            </div>
          </section>`;
        }).join('') : state('Belum ada program aktif', 'Admin perlu membuat program corporate dan menyinkronkan roster karyawan.')}`;
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
          <section class="wellness-card"><div class="wellness-card-title"><div><span>PROGRAM</span><h3 id="wellness-program-form-title">Buat program corporate</h3></div></div>
            <form id="wellness-program-form" class="wellness-form" onsubmit="wellnessSaveProgram(event)">
              <input name="id" type="hidden">
              <label>Perusahaan<select name="corporate_id" required><option value="">Pilih perusahaan</option>${corporates.map(c => `<option value="${safe(c.id)}">${safe(c.name)}</option>`).join('')}</select></label>
              <div class="wellness-fields two"><label>Kode program<input name="code" placeholder="CARDIOMET-2026" required></label><label>Nama program<input name="name" placeholder="Program Diabetes & Hipertensi" required></label></div>
              <label>Tujuan program<textarea name="description" rows="3" placeholder="Tujuan, cohort, dan cakupan program"></textarea></label>
              <div class="wellness-fields three"><label>Mulai<input name="starts_on" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Selesai<input name="ends_on" type="date"></label><label>Status<select name="status"><option value="draft">Draft</option><option value="pilot">Pilot</option><option value="active">Aktif</option><option value="paused">Ditunda</option></select></label></div>
              <div class="wellness-fields two"><label>Frekuensi tekanan darah<select name="bp_frequency"><option value="daily">Harian</option><option value="weekly">Mingguan</option></select></label><label>Frekuensi gula darah<select name="glucose_frequency"><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="custom">Sesuai care plan</option></select></label></div>
              <div class="wellness-row-actions"><button class="wellness-primary" type="submit">Simpan program</button><button id="wellness-program-cancel" class="wellness-secondary" type="button" onclick="wellnessResetProgramForm()" hidden>Batal edit</button></div>
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
            <div class="wellness-row-actions"><button onclick="wellnessEditProgram('${safe(program.id)}')">Edit konfigurasi</button><button onclick="wellnessImportRosterFile('${safe(program.id)}')">Impor roster CSV</button><button onclick="wellnessEnrollRoster('${safe(program.id)}',this)">Sinkronkan roster</button><button onclick="wellnessGenerateReminders('${safe(program.id)}',this)">Buat task reminder</button><button onclick="wellnessOpenImport('${safe(program.id)}')">Impor hasil IHC</button></div>
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
        id: data.get('id') || null, corporate_id: data.get('corporate_id'), code: data.get('code'), name: data.get('name'), description: data.get('description'),
        starts_on: data.get('starts_on'), ends_on: data.get('ends_on'), status: data.get('status'),
        measurement_plan: { blood_pressure: data.get('bp_frequency'), blood_glucose: data.get('glucose_frequency') },
        reporting_plan: { daily: 'ihc', weekly: 'corporate_medical', monthly: 'hr_aggregate' }
      }});
      notify('Program wellness tersimpan. Lanjutkan dengan sinkronisasi roster.'); await renderWellnessAdmin();
    } catch (error) { notify(`Program belum tersimpan: ${error.message}`); }
    finally { setBusy(button, false); }
  }

  function wellnessEditProgram(programId) {
    const program = (adminData?.programs || []).find(item => item.id === programId);
    const form = $('wellness-program-form');
    if (!program || !form) { notify('Konfigurasi program tidak ditemukan.'); return; }
    const set = (name, value) => { const field = form.elements.namedItem(name); if (field) field.value = value ?? ''; };
    set('id', program.id); set('corporate_id', program.corporate_id); set('code', program.code);
    set('name', program.name); set('description', program.description); set('starts_on', program.starts_on);
    set('ends_on', program.ends_on); set('status', program.status);
    set('bp_frequency', program.measurement_plan?.blood_pressure || 'daily');
    set('glucose_frequency', program.measurement_plan?.blood_glucose || 'custom');
    const title = $('wellness-program-form-title'); if (title) title.textContent = 'Edit konfigurasi program';
    const cancel = $('wellness-program-cancel'); if (cancel) cancel.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function wellnessResetProgramForm() {
    const form = $('wellness-program-form'); if (!form) return;
    form.reset(); form.elements.namedItem('id').value = '';
    const starts = form.elements.namedItem('starts_on'); if (starts) starts.value = new Date().toISOString().slice(0,10);
    const title = $('wellness-program-form-title'); if (title) title.textContent = 'Buat program corporate';
    const cancel = $('wellness-program-cancel'); if (cancel) cancel.hidden = true;
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

  function wellnessImportRosterFile(programId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const rows = parseCsv(text);
        if (!rows.length) { notify('Berkas CSV kosong.'); return; }
        const mapped = rows.map(r => {
          const obj = {};
          for (const k in r) obj[k.toLowerCase().trim()] = r[k];
          return {
            employee_id: obj.nik || obj.employee_id || '',
            nik: obj.nik || obj.employee_id || '',
            first_name: obj.first_name || obj.nama || obj.full_name || '',
            last_name: obj.last_name || '',
            email: obj.email || '',
            department: obj.department || obj.departemen || '',
            job_position: obj.job_position || obj.jabatan || ''
          };
        });
        const res = await rpc('wellness_admin_import_roster', { p_program_id: programId, p_rows: mapped });
        notify(`Impor roster berhasil: ${res.imported_rows || 0} karyawan diproses dan tersinkron.`);
        await renderWellnessAdmin();
      } catch (err) {
        notify(`Impor roster gagal: ${err.message}`);
      }
    };
    input.click();
  }

  function wellnessDownloadTemplate() {
    const csv = 'employee_id,measured_at,systolic,diastolic,pulse,glucose,glucose_context,hba1c,external_id\nSYNTH-001,2026-09-22T08:00:00+07:00,120,80,72,105,fasting,5.6,IHC-SYNTH-001\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'template-wellness-ihc.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  Object.assign(window, {
    renderPersonalWellness, renderCorporateWellness, renderWellnessAdmin, renderWellnessImport,
    wellnessAcceptConsent, wellnessSubmitPersonal, wellnessSaveProgram, wellnessEditProgram, wellnessResetProgramForm,
    wellnessSaveReminder, wellnessEnrollRoster, wellnessImportRosterFile,
    wellnessGenerateReminders, wellnessOpenImport, wellnessReadImportFile, wellnessUploadImport,
    wellnessDownloadTemplate,
    wellnessHrdLoadTierPanel, wellnessHrdSelectAll, wellnessHrdClearAll,
    wellnessHrdOpenAssignModal, wellnessHrdSubmitAssignment
  });


  // ─── HRD TIER ASSIGNMENT PANEL ──────────────────────────────────────────────

  const TREATMENT_OPTIONS = [
    { value: 'konsultasi_dokter', label: 'Konsultasi Dokter / Internist' },
    { value: 'followup_ihc',      label: 'Follow-up Pemeriksaan IHC' },
    { value: 'program_diet',      label: 'Program Diet & Nutrisi' },
    { value: 'program_olahraga',  label: 'Program Olahraga Terstruktur' },
    { value: 'monitoring_ketat',  label: 'Monitoring Ketat (Harian)' },
    { value: 'psikologis',        label: 'Pendampingan Psikologis / Stress' },
    { value: 'rehab_gaya_hidup',  label: 'Rehabilitasi Gaya Hidup' },
    { value: 'tindak_darurat',    label: 'Tindak Darurat – Rujuk Faskes' },
  ];

  const TIER_META = {
    0: { label: 'Belum Terukur',      bg: '#f1f5f9', border: '#cbd5e1', color: '#64748b', icon: '&#x1F4EB;' },
    1: { label: 'L1 Normal',          bg: '#dcfce7', border: '#22c55e', color: '#15803d', icon: '&#x2705;' },
    2: { label: 'L2 Perhatian',       bg: '#fef9c3', border: '#facc15', color: '#a16207', icon: '&#x26A0;&#xFE0F;' },
    3: { label: 'L3 Risiko Tinggi',   bg: '#ffedd5', border: '#f97316', color: '#c2410c', icon: '&#x1F536;' },
    4: { label: 'L4 Sangat Berisiko', bg: '#fee2e2', border: '#ef4444', color: '#b91c1c', icon: '&#x1F6A8;' },
  };

  function _hrdPanelId(programId) {
    return 'hrd-tp-' + String(programId).replace(/-/g,'').slice(0,10);
  }

  async function wellnessHrdLoadTierPanel(programId) {
    const panel = document.getElementById(_hrdPanelId(programId));
    if (!panel) return;
    panel.innerHTML = '<p style="padding:16px; color:#64748b; font-size:12.5px;">&#x23F3; Memuat daftar peserta per tier&hellip;</p>';
    try {
      const data = await rpc('wellness_hrd_participant_tier_list', { p_program_id: programId });
      const participants = data.tiers || [];
      const treatmentRequests = data.treatment_requests || [];
      if (!participants.length) {
        panel.innerHTML = '<p style="padding:16px; color:#64748b; font-size:12.5px; text-align:center;">&#x1F4EB; Belum ada peserta untuk program ini.</p>';
        return;
      }
      const byTier = { 4:[], 3:[], 2:[], 1:[], 0:[] };
      participants.forEach(p => { const t = p.risk_tier; (byTier[t] !== undefined ? byTier[t] : byTier[0]).push(p); });

      const safeStr = v => String(v ?? '—');
      const tierHtml = [4, 3, 2, 1, 0].filter(t => byTier[t].length > 0).map(t => {
        const m = TIER_META[t];
        const rows = byTier[t];
        return `<div style="margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
            <span style="font-size:16px;">${m.icon}</span>
            <span style="font-size:11px; font-weight:800; color:${m.color}; text-transform:uppercase;">${m.label}</span>
            <span style="font-size:10.5px; background:${m.bg}; color:${m.color}; border:1px solid ${m.border}; padding:2px 8px; border-radius:12px; font-weight:700;">${rows.length} orang</span>
            ${t >= 3 ? `<span style="font-size:9.5px; background:#fef2f2; color:#b91c1c; border:1px solid #fca5a5; padding:2px 8px; border-radius:12px; font-weight:700;">&#x26A0; Perlu tindak lanjut</span>` : ''}
          </div>
          <div style="border:1px solid ${m.border}; border-radius:10px; overflow:hidden; background:${m.bg};">
            ${rows.map((p, i) => {
              const bpStr = (p.sys && p.dia) ? `${p.sys}/${p.dia} mmHg` : '&#x2014;';
              const gluStr = p.glu ? `${p.glu} mg/dL` : '&#x2014;';
              const hasTx = p.active_treatment_requests > 0;
              return `<label style="display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer; border-top:${i>0 ? '1px solid '+m.border : 'none'};" onmouseover="this.style.background='rgba(0,0,0,0.04)'" onmouseout="this.style.background='transparent'">
                <input type="checkbox" data-enrollment-id="${safeStr(p.enrollment_id)}" style="width:16px; height:16px; cursor:pointer; flex-shrink:0; accent-color:${m.border};">
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <strong style="font-size:12.5px; color:#0f172a;">${safeStr(p.participant_name)}</strong>
                    <span style="font-size:10px; color:#94a3b8; font-family:monospace;">ID: ${safeStr(p.employee_code)}</span>
                    ${hasTx ? `<span style="font-size:9.5px; background:#dbeafe; color:#1e40af; padding:1px 6px; border-radius:10px; font-weight:700;">&#x1F4CC; ${p.active_treatment_requests} aktif</span>` : ''}
                  </div>
                  <div style="font-size:11px; color:#64748b; margin-top:2px;">Tensi: <strong>${bpStr}</strong> &nbsp;&middot;&nbsp; Gula: <strong>${gluStr}</strong></div>
                </div>
              </label>`;
            }).join('')}
          </div>
        </div>`;
      }).join('');

      const txHtml = treatmentRequests.length ? `
        <div style="margin-top:16px; border-top:1px solid #e2e8f0; padding-top:14px;">
          <h5 style="margin:0 0 10px; font-size:12px; color:#0f172a; font-weight:800;">&#x1F4CB; Riwayat Assignment Treatment</h5>
          ${treatmentRequests.slice(0,10).map(tx => {
            const stBg = { pending:'#fef9c3', accepted:'#dbeafe', in_progress:'#ede9fe', completed:'#dcfce7', cancelled:'#f1f5f9' }[tx.status] || '#f1f5f9';
            const stCl = { pending:'#a16207', accepted:'#0369a1', in_progress:'#7c3aed', completed:'#15803d', cancelled:'#64748b' }[tx.status] || '#64748b';
            const tm = TIER_META[tx.risk_tier] || TIER_META[1];
            return `<div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px;">
              <span style="font-size:14px;">${tm.icon}</span>
              <div style="flex:1; min-width:0;">
                <div style="font-size:12px; font-weight:700; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeStr(tx.treatment_label)}</div>
                <div style="font-size:10.5px; color:#64748b;">${new Date(tx.created_at).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'})}</div>
              </div>
              <span style="font-size:10px; font-weight:700; padding:3px 10px; border-radius:12px; background:${stBg}; color:${stCl}; white-space:nowrap;">${tx.status}</span>
            </div>`;
          }).join('')}
        </div>
      ` : '';

      panel.innerHTML = `
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:14px;">
          <button onclick="wellnessHrdSelectAll('${_hrdPanelId(programId)}')" style="font-size:11px; padding:5px 12px; border-radius:7px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; font-weight:600;">&#x2611; Pilih Semua</button>
          <button onclick="wellnessHrdClearAll('${_hrdPanelId(programId)}')" style="font-size:11px; padding:5px 12px; border-radius:7px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; font-weight:600;">&#x2610; Batal Pilih</button>
          <span style="flex:1;"></span>
          <button onclick="wellnessHrdOpenAssignModal('${programId}','${_hrdPanelId(programId)}')" style="font-size:12px; font-weight:700; padding:8px 18px; border-radius:9px; border:0; background:linear-gradient(135deg,#0f4c5c,#0e7c86); color:#fff; cursor:pointer; box-shadow:0 2px 8px rgba(14,124,134,0.3);">&#x2795; Assign Treatment</button>
        </div>
        ${tierHtml}
        ${txHtml}
      `;
    } catch(err) {
      panel.innerHTML = `<p style="padding:16px; color:#b91c1c; font-size:12.5px;">&#x274C; Gagal memuat: ${err.message}</p>`;
    }
  }

  function wellnessHrdSelectAll(panelId) {
    document.querySelectorAll('#' + panelId + ' input[type=checkbox]').forEach(cb => cb.checked = true);
  }
  function wellnessHrdClearAll(panelId) {
    document.querySelectorAll('#' + panelId + ' input[type=checkbox]').forEach(cb => cb.checked = false);
  }

  function wellnessHrdOpenAssignModal(programId, panelId) {
    const checked = [...document.querySelectorAll('#' + panelId + ' input[type=checkbox]:checked')];
    if (!checked.length) { notify('Pilih minimal 1 peserta terlebih dahulu.'); return; }
    const enrollmentIds = checked.map(cb => cb.dataset.enrollmentId);
    const count = checked.length;
    let modal = document.getElementById('hrd-assign-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'hrd-assign-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:#fff; border-radius:20px; width:100%; max-width:520px; box-shadow:0 32px 80px rgba(15,23,42,0.3); overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#0f4c5c 100%); padding:20px 24px; color:#fff;">
          <div style="font-size:10px; color:#5eead4; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px;">ASSIGN TREATMENT WELLNESS</div>
          <h3 style="margin:0; font-size:18px; font-weight:800;">Program Tambahan untuk ${count} Peserta</h3>
          <p style="margin:6px 0 0; font-size:12px; color:#cbd5e1; line-height:1.5;">Semua peserta terpilih akan menerima assignment ini secara bersamaan.</p>
        </div>
        <div style="padding:24px;">
          <label style="display:block; margin-bottom:14px;">
            <span style="font-size:11px; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">Jenis Treatment *</span>
            <select id="hrd-at-type" style="display:block; width:100%; margin-top:6px; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:9px; font-size:13px; color:#0f172a; background:#f8fafc; cursor:pointer;" onchange="const lbl=document.getElementById('hrd-at-label'); if(!lbl.value || lbl.dataset.auto==='1'){lbl.value=this.options[this.selectedIndex].text; lbl.dataset.auto='1';}">
              <option value="">&#x2014; Pilih jenis treatment &mdash;</option>
              ${TREATMENT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
          </label>
          <label style="display:block; margin-bottom:14px;">
            <span style="font-size:11px; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">Label / Deskripsi Treatment *</span>
            <input id="hrd-at-label" type="text" placeholder="Mis: Sesi konsultasi dokter Oktober 2026" data-auto="0" oninput="this.dataset.auto='0'" style="display:block; width:100%; margin-top:6px; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:9px; font-size:13px; color:#0f172a; background:#f8fafc; box-sizing:border-box;">
          </label>
          <label style="display:block; margin-bottom:14px;">
            <span style="font-size:11px; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">Jadwal Pelaksanaan (opsional)</span>
            <input id="hrd-at-schedule" type="datetime-local" style="display:block; width:100%; margin-top:6px; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:9px; font-size:13px; color:#0f172a; background:#f8fafc; box-sizing:border-box;">
          </label>
          <label style="display:block; margin-bottom:18px;">
            <span style="font-size:11px; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">Catatan untuk IHC / Pengelola</span>
            <textarea id="hrd-at-notes" rows="3" placeholder="Alasan, instruksi khusus, atau informasi tambahan&hellip;" style="display:block; width:100%; margin-top:6px; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:9px; font-size:13px; color:#0f172a; background:#f8fafc; resize:vertical; box-sizing:border-box;"></textarea>
          </label>
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:9px; padding:10px 14px; margin-bottom:16px; font-size:11.5px; color:#1e40af; line-height:1.5;">
            &#x1F465; <strong>${count} peserta</strong> dipilih &mdash; semua akan menerima treatment yang sama.
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button onclick="document.getElementById('hrd-assign-modal').remove()" style="padding:10px 20px; border-radius:9px; border:1.5px solid #e2e8f0; background:#f8fafc; font-size:13px; cursor:pointer; font-weight:600; color:#374151;">Batal</button>
            <button id="hrd-at-submit" onclick="wellnessHrdSubmitAssignment('${programId}',${JSON.stringify(enrollmentIds)},'${panelId}')" style="padding:10px 24px; border-radius:9px; border:0; background:linear-gradient(135deg,#0f4c5c,#0e7c86); color:#fff; font-size:13px; font-weight:800; cursor:pointer; box-shadow:0 3px 10px rgba(14,124,134,0.4);">&#x2705; Kirim Assignment</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  async function wellnessHrdSubmitAssignment(programId, enrollmentIds, panelId) {
    const treatmentType  = document.getElementById('hrd-at-type')?.value;
    const treatmentLabel = (document.getElementById('hrd-at-label')?.value || '').trim();
    const notes          = (document.getElementById('hrd-at-notes')?.value || '').trim() || null;
    const schedRaw       = document.getElementById('hrd-at-schedule')?.value;
    const scheduledAt    = schedRaw ? new Date(schedRaw).toISOString() : null;
    const btn = document.getElementById('hrd-at-submit');
    if (!treatmentType) { notify('Pilih jenis treatment terlebih dahulu.'); return; }
    if (!treatmentLabel) { notify('Isi label / deskripsi treatment.'); return; }
    setBusy(btn, true, 'Mengirim…');
    try {
      const res = await rpc('wellness_hrd_assign_treatment', {
        p_program_id: programId,
        p_enrollment_ids: enrollmentIds,
        p_treatment_type: treatmentType,
        p_treatment_label: treatmentLabel,
        p_notes: notes,
        p_scheduled_at: scheduledAt
      });
      document.getElementById('hrd-assign-modal')?.remove();
      notify('✅ Assignment berhasil! ' + (res.assigned_count || 0) + ' peserta ditetapkan untuk "' + (res.treatment_type || '') + '".');
      await wellnessHrdLoadTierPanel(programId);
    } catch(err) {
      notify('Gagal mengirim assignment: ' + err.message);
    } finally { setBusy(btn, false); }
  }

})();
