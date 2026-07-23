// ═══════════════════════════════════════════════════════════════
// MODULE: RAWAT INAP (Inpatient)
// ───────────────────────────────────────────────────────────────
// Papan tempat tidur, admisi, pindah ruang, visite & catatan keperawatan,
// billing harian, dan resume pulang.
//
// Admisi, pindah ruang, dan pemulangan tidak ditulis langsung ke tabel.
// Ketiganya memanggil fungsi basis data (RPC) agar tempat tidur terkunci dan
// tidak ada dua pasien pada satu tempat tidur.
//
// Catatan klinis memakai tabel clinical_notes dan vital_signs yang sudah ada,
// ditaut lewat admission_id — bukan tabel catatan baru.
//
// Seluruh nama global diawali "inp" agar tidak bertabrakan dengan modul lain.
// Skema: supabase_inpatient.sql
// ═══════════════════════════════════════════════════════════════

const INP_BED_STATUS = {
  'Kosong':      { c: '#15803D', bg: '#E8F5EC' },
  'Terisi':      { c: '#0E7C86', bg: '#E6F2F3' },
  'Dibersihkan': { c: '#B45309', bg: '#FBF1E4' },
  'Perbaikan':   { c: '#B91C1C', bg: '#FBEAEA' },
};

const INP_STAY_STATUS = {
  'Dirawat':    { c: '#0E7C86', bg: '#E6F2F3' },
  'Pulang':     { c: '#15803D', bg: '#E8F5EC' },
  'Dirujuk':    { c: '#7C3AED', bg: '#F1EAFB' },
  'Pulang APS': { c: '#B45309', bg: '#FBF1E4' },
  'Meninggal':  { c: '#475569', bg: '#EEF1F5' },
};

const INP_CHARGE_TYPES = ['Visite', 'Tindakan', 'Obat & BHP', 'Penunjang', 'Lain-lain'];

let inpWards = [], inpClasses = [], inpBeds = [], inpStays = [], inpEmployees = [];
let inpTab = 'board', inpWardFilter = '', inpStayFilter = 'Dirawat';
let inpCurrentStay = null, inpCharges = [], inpNotes = [], inpDetailTabName = 'cppt';
let inpPatTimer = null;

// ── Penolong kecil ─────────────────────────────────────────────
function inpEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inpMoney(n) {
  try { return formatCurrency(Number(n) || 0); }
  catch (e) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
}

function inpDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function inpDateOnly(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Lama rawat dalam hari kalender, minimal 1 — sejalan dengan cara biaya kamar dihitung
function inpLos(stay) {
  if (!stay || !stay.admitted_at) return 0;
  const a = new Date(stay.admitted_at); a.setHours(0, 0, 0, 0);
  const b = stay.discharged_at ? new Date(stay.discharged_at) : new Date(); b.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function inpUser() { try { return getUserName(); } catch (e) { return 'Pengguna'; } }

// Pesan galat yang bisa dipahami petugas
function inpErrText(e) {
  const m = (e && e.message) ? String(e.message) : 'Terjadi kesalahan';
  if (/does not exist|could not find|schema cache|not find the function/i.test(m)) {
    return 'Modul rawat inap belum disiapkan — jalankan supabase_inpatient.sql';
  }
  return m;
}

function inpFail(e) { toast('❌ ' + inpErrText(e), 'err'); }

function inpBedLabel(b) {
  if (!b) return '—';
  const w = inpWards.find(w => w.id === b.ward_id);
  return [w ? w.name : '', b.room_no, b.bed_no].filter(Boolean).join(' / ');
}

function inpClassRate(code) {
  const c = inpClasses.find(c => c.code === code);
  return c ? Number(c.room_rate) || 0 : 0;
}

// ═══════════════════════════════════════════════════════════════
// HALAMAN UTAMA
// ═══════════════════════════════════════════════════════════════
async function renderInpatient(tab) {
  inpTab = tab || inpTab || 'board';
  const tabs = [
    { k: 'board',  l: 'Papan Tempat Tidur' },
    { k: 'stays',  l: 'Pasien Dirawat' },
    { k: 'master', l: 'Ruang & Tarif' },
  ];
  document.getElementById('main-content').innerHTML = `
    <div class="lis-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#0A2342,#0d2d54);color:#fff;border-radius:8px;padding:8px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" style="color:#fff;border-color:rgba(255,255,255,0.2)" onclick="openCategory('inpatient')" title="Kembali ke daftar menu Rawat Inap">← Menu Rawat Inap</button>
        <div>
          <h1 style="margin:0;font-size:15px;color:#fff;font-weight:800">Rawat Inap (Inpatient Management)</h1>
          <span class="lis-sub" style="font-size:11px;color:#9db4d0">Papan tempat tidur, admisi, visite, billing harian, dan resume pulang</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="inp-date-badge" class="lis-date" style="font-size:11px;color:#cfe0f2"></span>
        <button class="btn btn-teal btn-sm" onclick="inpOpenAdmitForm()">+ Admisi Rawat Inap</button>
      </div>
    </div>
    <div id="inp-warn"></div>
    <div class="tabs" id="inp-tabs" style="margin-bottom:14px">
      ${tabs.map(t => `<button class="tab-btn ${inpTab === t.k ? 'active' : ''}"
        onclick="inpSwitchTab('${t.k}')">${t.l}</button>`).join('')}
    </div>
    <div id="inp-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px"></div>
    <div id="inp-content"><div class="loading-row"><div class="spinner"></div></div></div>`;

  const badge = document.getElementById('inp-date-badge');
  if (badge) badge.textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  await inpLoadAll();
}

function inpSwitchTab(k) {
  inpTab = k;
  document.querySelectorAll('#inp-tabs .tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['board', 'stays', 'master'][i] === k);
  });
  inpPaint();
}

async function inpLoadAll() {
  try {
    const [wards, classes, beds, stays] = await Promise.all([
      sbGet('inpatient_wards',   'select=*&order=sort_order,name'),
      sbGet('inpatient_classes', 'select=*&order=sort_order,code'),
      sbGet('inpatient_beds',    'select=*&order=ward_id,room_no,bed_no&limit=500'),
      sbGet('inpatient_stays',   'select=*&order=admitted_at.desc&limit=300'),
    ]);
    inpWards   = Array.isArray(wards)   ? wards   : [];
    inpClasses = Array.isArray(classes) ? classes : [];
    inpBeds    = Array.isArray(beds)    ? beds    : [];
    inpStays   = Array.isArray(stays)   ? stays   : [];
    const w = document.getElementById('inp-warn'); if (w) w.innerHTML = '';
    inpPaint();
  } catch (e) {
    const w = document.getElementById('inp-warn');
    if (w) w.innerHTML = `<div class="status-box status-warn" style="margin-bottom:14px">
      Modul rawat inap belum tersedia — jalankan <code>supabase_inpatient.sql</code>
      di Supabase SQL Editor, lalu muat ulang halaman ini.</div>`;
    const c = document.getElementById('inp-content'); if (c) c.innerHTML = '';
    const k = document.getElementById('inp-kpi'); if (k) k.innerHTML = '';
  }
}

function inpPaint() {
  inpPaintKpi();
  if (inpTab === 'board')  return inpPaintBoard();
  if (inpTab === 'stays')  return inpPaintStays();
  return inpPaintMaster();
}

function inpPaintKpi() {
  const el = document.getElementById('inp-kpi'); if (!el) return;
  const aktif = inpBeds.filter(b => b.is_active !== false);
  const terisi = aktif.filter(b => b.status === 'Terisi').length;
  const kosong = aktif.filter(b => b.status === 'Kosong').length;
  const bor = aktif.length ? Math.round(terisi / aktif.length * 100) : 0;
  const dirawat = inpStays.filter(s => s.status === 'Dirawat');
  el.innerHTML = [
    { l: 'Pasien Dirawat', v: dirawat.length, c: '#0E7C86' },
    { l: 'Tempat Tidur Kosong', v: kosong, c: '#15803D' },
    { l: 'BOR Hari Ini', v: bor + '%', c: '#123A5C' },
    { l: 'Perlu Dibersihkan', v: aktif.filter(b => b.status === 'Dibersihkan').length, c: '#B45309' },
  ].map(k => `<div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${k.c};
    border-radius:10px;padding:12px">
    <div style="font-size:20px;font-weight:800;color:${k.c};font-variant-numeric:tabular-nums">${k.v}</div>
    <div style="font-size:10.5px;color:var(--gray)">${k.l}</div></div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// PAPAN TEMPAT TIDUR
// ═══════════════════════════════════════════════════════════════
function inpPaintBoard() {
  const el = document.getElementById('inp-content'); if (!el) return;

  if (!inpBeds.length) {
    el.innerHTML = `<div class="empty-state">
      <h3>Belum ada tempat tidur</h3>
      <p>Buat bangsal dan tempat tidurnya pada tab Ruang &amp; Tarif.</p>
      <button class="btn btn-teal" style="margin-top:10px" onclick="inpSwitchTab('master')">Buka Ruang &amp; Tarif</button></div>`;
    return;
  }

  const wards = inpWardFilter
    ? inpWards.filter(w => String(w.id) === String(inpWardFilter))
    : inpWards;

  const legend = Object.keys(INP_BED_STATUS).map(s => {
    const st = INP_BED_STATUS[s];
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--gray)">
      <span style="width:11px;height:11px;border-radius:3px;background:${st.bg};border:1.5px solid ${st.c}"></span>${s}</span>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
      <select onchange="inpFilterWard(this.value)" style="max-width:230px">
        <option value="">Semua bangsal</option>
        ${inpWards.map(w => `<option value="${w.id}" ${String(w.id) === String(inpWardFilter) ? 'selected' : ''}>
          ${inpEsc(w.name)}</option>`).join('')}
      </select>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-left:auto">${legend}</div>
    </div>
    ${wards.map(w => inpBoardWardHtml(w)).join('') || '<div class="empty-state"><h3>Bangsal tidak ditemukan</h3></div>'}`;
}

function inpFilterWard(v) { inpWardFilter = v; inpPaintBoard(); }

function inpBoardWardHtml(w) {
  const beds = inpBeds.filter(b => b.ward_id === w.id && b.is_active !== false);
  const terisi = beds.filter(b => b.status === 'Terisi').length;
  return `
    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <div style="font-weight:750;font-size:14px">${inpEsc(w.name)}</div>
        <div style="font-size:11px;color:var(--gray)">${inpEsc(w.floor || '')} ·
          ${inpEsc(w.ward_type || 'Umum')}</div>
        <div style="margin-left:auto;font-size:11.5px;color:var(--gray)">
          Terisi <b style="color:var(--teal)">${terisi}</b> / ${beds.length}</div>
      </div>
      ${beds.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:9px">
        ${beds.map(b => inpBedCardHtml(b)).join('')}</div>`
        : `<div style="font-size:12px;color:var(--gray)">Belum ada tempat tidur di bangsal ini.
           <a href="javascript:void(0)" onclick="inpOpenBedForm(null,${w.id})" style="color:var(--teal)">Tambah</a></div>`}
    </div>`;
}

function inpBedCardHtml(b) {
  const st = INP_BED_STATUS[b.status] || INP_BED_STATUS['Kosong'];
  const stay = b.status === 'Terisi'
    ? inpStays.find(s => s.id === b.current_stay_id && s.status === 'Dirawat')
      || inpStays.find(s => s.bed_id === b.id && s.status === 'Dirawat')
    : null;

  const body = stay ? `
      <div style="font-weight:700;font-size:12.5px;margin-top:5px;line-height:1.3">${inpEsc(stay.patient_name)}</div>
      <div style="font-size:10.5px;color:var(--gray);font-family:ui-monospace,monospace">${inpEsc(stay.mr_number || '')}</div>
      <div style="font-size:10.5px;color:var(--gray);margin-top:3px">
        Hari ke-${inpLos(stay)} · ${inpEsc(stay.dpjp_name || 'DPJP belum diisi')}</div>`
    : `<div style="font-size:11px;color:var(--gray);margin-top:6px">${inpEsc(b.status)}</div>`;

  const act = stay
    ? `<button class="btn btn-teal btn-xs" style="width:100%" onclick="inpOpenStay(${stay.id})">Buka</button>`
    : b.status === 'Kosong'
      ? `<button class="btn btn-ghost btn-xs" style="width:100%" onclick="inpOpenAdmitForm(${b.id})">+ Tempatkan</button>`
      : `<button class="btn btn-ghost btn-xs" style="width:100%" onclick="inpSetBedStatus(${b.id},'Kosong')">Siapkan</button>`;

  return `
    <div style="border:1.5px solid ${st.c}33;background:${st.bg};border-radius:10px;padding:10px 11px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${st.c};margin-right:2px"></span>
        <span style="font-weight:800;font-size:12.5px;color:${st.c}">${inpEsc(b.room_no || '')}${b.room_no ? '-' : ''}${inpEsc(b.bed_no)}</span>
        <span style="margin-left:auto;font-size:10px;font-weight:700;color:${st.c};
          background:#ffffffaa;padding:2px 6px;border-radius:4px">${inpEsc(b.class_code || '-')}</span>
      </div>
      ${body}
      <div style="margin-top:8px">${act}</div>
    </div>`;
}

async function inpSetBedStatus(bedId, status) {
  try {
    await sbRpc('inp_set_bed_status', { p_bed_id: bedId, p_status: status });
    toast(`Tempat tidur → ${status}`, 'ok');
    await inpLoadAll();
  } catch (e) { inpFail(e); }
}

// ═══════════════════════════════════════════════════════════════
// DAFTAR PASIEN DIRAWAT
// ═══════════════════════════════════════════════════════════════
function inpPaintStays() {
  const el = document.getElementById('inp-content'); if (!el) return;
  const list = inpStayFilter === 'Semua'
    ? inpStays : inpStays.filter(s => s.status === inpStayFilter);

  const filters = ['Dirawat', 'Pulang', 'Dirujuk', 'Semua'];
  const head = `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px">
    ${filters.map(f => `<button class="btn ${inpStayFilter === f ? 'btn-teal' : 'btn-ghost'} btn-xs"
      onclick="inpFilterStay('${f}')">${f}</button>`).join('')}</div>`;

  if (!list.length) {
    el.innerHTML = head + `<div class="empty-state">
      <h3>Tidak ada pasien pada status ini</h3>
      <button class="btn btn-teal" style="margin-top:10px" onclick="inpOpenAdmitForm()">+ Admisi Rawat Inap</button></div>`;
    return;
  }

  el.innerHTML = head + `<div class="table-wrap"><table><thead><tr>
    <th>No. Episode</th><th>Pasien</th><th>Ruang</th><th>DPJP</th>
    <th>Masuk</th><th>Lama</th><th>Tagihan</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>${list.map(s => {
    const st = INP_STAY_STATUS[s.status] || INP_STAY_STATUS['Dirawat'];
    return `<tr>
      <td><span style="font-family:ui-monospace,monospace;font-size:11.5px;color:var(--teal)">${inpEsc(s.stay_number || '—')}</span></td>
      <td><div style="font-weight:600">${inpEsc(s.patient_name)}</div>
        <div style="font-size:11px;color:var(--gray)">${inpEsc(s.mr_number || '')}</div></td>
      <td style="font-size:12px">${inpEsc([s.ward_name, s.room_no, s.bed_no].filter(Boolean).join(' / '))}
        <div style="font-size:10.5px;color:var(--gray)">Kelas ${inpEsc(s.class_code || '-')}</div></td>
      <td style="font-size:12px">${inpEsc(s.dpjp_name || '—')}</td>
      <td style="font-size:11.5px;color:var(--gray)">${inpDateOnly(s.admitted_at)}</td>
      <td style="font-size:12px">${inpLos(s)} hari</td>
      <td style="font-size:12px;font-variant-numeric:tabular-nums">${inpMoney(s.total_charges)}</td>
      <td><span style="background:${st.bg};color:${st.c};padding:3px 9px;border-radius:5px;
        font-size:11px;font-weight:700">${inpEsc(s.status)}</span></td>
      <td><div class="act-row" style="flex-wrap:wrap">
        <button class="btn btn-teal btn-xs" onclick="inpOpenStay(${s.id})">Buka</button>
        ${s.status === 'Dirawat'
          ? `<button class="btn btn-ghost btn-xs" onclick="inpOpenTransfer(${s.id})">↔ Pindah</button>`
          : ''}
      </div></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

function inpFilterStay(f) { inpStayFilter = f; inpPaintStays(); }

// ═══════════════════════════════════════════════════════════════
// ADMISI
// ═══════════════════════════════════════════════════════════════
async function inpOpenAdmitForm(bedId) {
  if (!inpBeds.length) { await inpLoadAll(); }
  if (!inpBeds.length) {
    toast('Belum ada tempat tidur. Buat dulu di tab Ruang & Tarif.', 'warn'); return;
  }
  if (!inpEmployees.length) {
    inpEmployees = await sbGet('employees',
      'select=id,full_name,position&order=full_name&limit=300').catch(() => []);
  }

  const kosong = inpBeds.filter(b => b.status === 'Kosong' && b.is_active !== false);
  if (!kosong.length && !bedId) { toast('Tidak ada tempat tidur kosong', 'warn'); return; }

  const dokter = inpEmployees.filter(e =>
    /dokter|dr\.|spesialis|dpjp/i.test(e.position || '') ) ;
  const pilihanDokter = (dokter.length ? dokter : inpEmployees);

  openModal(`
    <div class="modal-header"><div class="modal-title">🛏 Admisi Rawat Inap</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>

    <div class="form-group"><label>Pasien Terdaftar *</label>
      <div style="display:flex;gap:6px">
        <input type="text" id="inp-adm-name" oninput="inpSearchPatient(this.value)" autocomplete="off"
          placeholder="Ketik nama atau nomor rekam medis (min. 3 huruf)" style="flex:1">
        <input type="text" id="inp-adm-mr" placeholder="No. RM" readonly
          style="width:135px;background:var(--bg2);font-family:ui-monospace,monospace;font-size:12px">
      </div>
      <input type="hidden" id="inp-adm-id">
      <div id="inp-adm-results" style="position:relative"></div>
      <div style="font-size:11px;color:var(--gray);margin-top:4px">
        Pasien harus sudah terdaftar di modul Admission.</div></div>

    <div class="form-row">
      <div class="form-group"><label>Tempat Tidur *</label>
        <select id="inp-adm-bed" onchange="inpAdmitRateHint()">
          ${kosong.map(b => `<option value="${b.id}" ${String(b.id) === String(bedId) ? 'selected' : ''}
            data-class="${inpEsc(b.class_code || '')}">${inpEsc(inpBedLabel(b))} — Kelas ${inpEsc(b.class_code || '-')}</option>`).join('')}
        </select>
        <div id="inp-adm-rate" style="font-size:11px;color:var(--teal);margin-top:4px"></div></div>
      <div class="form-group"><label>Asal Masuk</label>
        <select id="inp-adm-src">
          <option>Poliklinik</option><option>IGD</option>
          <option>Rujukan</option><option>Kamar Bersalin</option>
        </select></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>DPJP (Dokter Penanggung Jawab)</label>
        <select id="inp-adm-dpjp">
          <option value="">— pilih dokter —</option>
          ${pilihanDokter.map(e => `<option value="${e.id}">${inpEsc(e.full_name)}${e.position ? ' — ' + inpEsc(e.position) : ''}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Penjamin</label>
        <select id="inp-adm-guar">
          <option>Umum</option><option>BPJS</option><option>Asuransi</option><option>Korporat</option>
        </select></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>Diagnosis Masuk *</label>
        <input type="text" id="inp-adm-diag" placeholder="mis. Demam Berdarah Dengue"></div>
      <div class="form-group"><label>Kode ICD-10</label>
        <input type="text" id="inp-adm-icd" placeholder="A91"></div>
    </div>

    <div class="form-group"><label>Catatan</label>
      <textarea id="inp-adm-notes" rows="2" placeholder="Keterangan tambahan saat masuk"></textarea></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="inpSaveAdmission()">💾 Rawat Inapkan</button>
    </div>`, 'wide');

  inpAdmitRateHint();
}

function inpAdmitRateHint() {
  const sel = document.getElementById('inp-adm-bed');
  const box = document.getElementById('inp-adm-rate');
  if (!sel || !box) return;
  const cls = sel.options[sel.selectedIndex]?.dataset.class || '';
  const rate = inpClassRate(cls);
  box.textContent = rate ? `Tarif kamar ${inpMoney(rate)} / hari` : 'Tarif kelas belum diatur';
}

function inpSearchPatient(q) {
  clearTimeout(inpPatTimer);
  const box = document.getElementById('inp-adm-results'); if (!box) return;
  if (!q || q.trim().length < 3) { box.innerHTML = ''; return; }
  inpPatTimer = setTimeout(async () => {
    const term = encodeURIComponent('%' + q.trim() + '%');
    try {
      const rows = await sbGet('admissions',
        `select=id,mr_number,patient_name,patient_gender,patient_dob,patient_age,visit_number` +
        `&or=(patient_name.ilike.${term},mr_number.ilike.${term})` +
        `&mr_number=not.is.null&order=created_at.desc&limit=20`);
      const list = (rows || []).slice(0, 10);
      box.innerHTML = list.length ? `<div style="position:absolute;z-index:50;left:0;right:0;background:#fff;
        border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);max-height:230px;overflow:auto">
        ${list.map(r => `<div onclick="inpPickPatient(${r.id},'${inpEsc(r.mr_number).replace(/'/g, '')}','${inpEsc(r.patient_name).replace(/'/g, '')}')"
          style="padding:8px 11px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12.5px">
          <div style="font-weight:650">${inpEsc(r.patient_name)}</div>
          <div style="font-size:11px;color:var(--teal);font-family:ui-monospace,monospace">
            ${inpEsc(r.mr_number)} · ${inpEsc(r.visit_number || '')}</div>
        </div>`).join('')}</div>` : '';
    } catch (e) { box.innerHTML = ''; }
  }, 300);
}

function inpPickPatient(id, mr, name) {
  document.getElementById('inp-adm-id').value = id;
  document.getElementById('inp-adm-mr').value = mr || '';
  document.getElementById('inp-adm-name').value = name || '';
  document.getElementById('inp-adm-results').innerHTML = '';
}

async function inpSaveAdmission() {
  const admId = document.getElementById('inp-adm-id').value;
  const bedSel = document.getElementById('inp-adm-bed');
  const diag = document.getElementById('inp-adm-diag').value.trim();

  if (!admId) { toast('Pilih pasien dari daftar hasil pencarian', 'err'); return; }
  if (!bedSel.value) { toast('Pilih tempat tidur', 'err'); return; }
  if (!diag) { toast('Diagnosis masuk wajib diisi', 'err'); return; }

  const dpjpSel = document.getElementById('inp-adm-dpjp');
  const dpjpId = dpjpSel.value ? parseInt(dpjpSel.value) : null;
  const dpjpName = dpjpSel.value ? dpjpSel.options[dpjpSel.selectedIndex].text.split(' — ')[0] : null;

  try {
    const r = await sbRpc('inp_admit_patient', {
      p_admission_id: parseInt(admId),
      p_bed_id: parseInt(bedSel.value),
      p_dpjp_id: dpjpId,
      p_dpjp_name: dpjpName,
      p_diagnosis: diag,
      p_icd: document.getElementById('inp-adm-icd').value.trim() || null,
      p_source: document.getElementById('inp-adm-src').value,
      p_guarantor: document.getElementById('inp-adm-guar').value,
      p_notes: document.getElementById('inp-adm-notes').value.trim() || null,
    });
    toast(`✅ ${r?.stay_number || 'Episode'} dibuat — ${r?.bed || ''}`, 'ok');
    closeModalForce();
    await inpLoadAll();
  } catch (e) { inpFail(e); }
}

// ═══════════════════════════════════════════════════════════════
// PINDAH RUANG
// ═══════════════════════════════════════════════════════════════
function inpOpenTransfer(stayId) {
  const s = inpStays.find(x => x.id === stayId);
  if (!s) { toast('Episode tidak ditemukan', 'err'); return; }
  if (s.status !== 'Dirawat') { toast('Pasien sudah tidak dirawat', 'warn'); return; }

  const kosong = inpBeds.filter(b => b.status === 'Kosong' && b.is_active !== false);
  if (!kosong.length) { toast('Tidak ada tempat tidur kosong untuk tujuan pindah', 'warn'); return; }

  openModal(`
    <div class="modal-header"><div class="modal-title">↔ Pindah Ruang</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="background:var(--bg2);border-radius:8px;padding:10px 13px;margin-bottom:12px;font-size:12.5px">
      <b>${inpEsc(s.patient_name)}</b> · ${inpEsc(s.mr_number || '')}<br>
      Sekarang: ${inpEsc([s.ward_name, s.room_no, s.bed_no].filter(Boolean).join(' / '))}
      (Kelas ${inpEsc(s.class_code || '-')} · ${inpMoney(s.room_rate)}/hari)
    </div>
    <div class="form-group"><label>Tempat Tidur Tujuan *</label>
      <select id="inp-trf-bed" onchange="inpTransferRateHint()">
        ${kosong.map(b => `<option value="${b.id}" data-class="${inpEsc(b.class_code || '')}">
          ${inpEsc(inpBedLabel(b))} — Kelas ${inpEsc(b.class_code || '-')}</option>`).join('')}
      </select>
      <div id="inp-trf-rate" style="font-size:11px;color:var(--teal);margin-top:4px"></div></div>
    <div class="form-group"><label>Alasan Pindah</label>
      <textarea id="inp-trf-reason" rows="2" placeholder="Permintaan keluarga, naik kelas, kebutuhan isolasi, ..."></textarea></div>
    <div style="font-size:11.5px;color:var(--gray);margin-bottom:10px">
      Hari rawat yang sudah lewat ditagih dengan tarif kelas lama. Tarif baru berlaku
      untuk hari berikutnya.</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="inpSaveTransfer(${stayId})">↔ Pindahkan</button>
    </div>`, 'wide');

  inpTransferRateHint();
}

function inpTransferRateHint() {
  const sel = document.getElementById('inp-trf-bed');
  const box = document.getElementById('inp-trf-rate');
  if (!sel || !box) return;
  const rate = inpClassRate(sel.options[sel.selectedIndex]?.dataset.class || '');
  box.textContent = rate ? `Tarif kamar baru ${inpMoney(rate)} / hari` : 'Tarif kelas belum diatur';
}

async function inpSaveTransfer(stayId) {
  const bed = document.getElementById('inp-trf-bed').value;
  if (!bed) { toast('Pilih tempat tidur tujuan', 'err'); return; }
  try {
    const r = await sbRpc('inp_transfer_bed', {
      p_stay_id: stayId,
      p_to_bed_id: parseInt(bed),
      p_reason: document.getElementById('inp-trf-reason').value.trim() || null,
    });
    toast(`✅ Pindah ke ${r?.ke || 'tempat tidur baru'}`, 'ok');
    closeModalForce();
    await inpLoadAll();
    if (inpCurrentStay && inpCurrentStay.id === stayId) await inpOpenStay(stayId);
  } catch (e) { inpFail(e); }
}

// ═══════════════════════════════════════════════════════════════
// DETAIL PASIEN
// ═══════════════════════════════════════════════════════════════
async function inpOpenStay(stayId) {
  let s = inpStays.find(x => x.id === stayId);
  if (!s) {
    const rows = await sbGet('inpatient_stays', `select=*&id=eq.${stayId}&limit=1`).catch(() => []);
    s = rows?.[0];
  }
  if (!s) { toast('Episode tidak ditemukan', 'err'); return; }
  inpCurrentStay = s;
  inpDetailTabName = 'cppt';

  const st = INP_STAY_STATUS[s.status] || INP_STAY_STATUS['Dirawat'];
  const tabs = [
    { k: 'cppt',    l: '📝 Visite & Catatan' },
    { k: 'ttv',     l: '❤️ Tanda Vital' },
    { k: 'billing', l: '💰 Billing' },
    { k: 'resume',  l: '📋 Resume Pulang' },
  ];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${inpEsc(s.patient_name)} — ${inpEsc(s.stay_number || '')}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>

    <div style="background:var(--bg2);border-radius:8px;padding:11px 13px;margin-bottom:12px;
      font-size:12.5px;display:flex;gap:16px;flex-wrap:wrap">
      <div><span style="color:var(--gray)">No. RM</span><br>
        <b style="font-family:ui-monospace,monospace">${inpEsc(s.mr_number || '—')}</b></div>
      <div><span style="color:var(--gray)">Ruang</span><br>
        <b>${inpEsc([s.ward_name, s.room_no, s.bed_no].filter(Boolean).join(' / ') || '—')}</b>
        <span style="color:var(--gray)">· Kelas ${inpEsc(s.class_code || '-')}</span></div>
      <div><span style="color:var(--gray)">DPJP</span><br><b>${inpEsc(s.dpjp_name || '—')}</b></div>
      <div><span style="color:var(--gray)">Masuk</span><br><b>${inpDateTime(s.admitted_at)}</b></div>
      <div><span style="color:var(--gray)">Lama Rawat</span><br><b>${inpLos(s)} hari</b></div>
      <div><span style="color:var(--gray)">Status</span><br>
        <span style="background:${st.bg};color:${st.c};padding:2px 8px;border-radius:5px;
          font-size:11px;font-weight:700">${inpEsc(s.status)}</span></div>
      ${s.status === 'Dirawat' ? `<div style="margin-left:auto;display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost btn-xs" onclick="inpOpenTransfer(${s.id})">↔ Pindah Ruang</button></div>` : ''}
    </div>
    ${s.admit_diagnosis ? `<div style="font-size:12.5px;margin-bottom:12px">
      <span style="color:var(--gray)">Diagnosis masuk:</span>
      <b>${inpEsc(s.admit_diagnosis)}</b> ${s.admit_icd ? `<code>${inpEsc(s.admit_icd)}</code>` : ''}</div>` : ''}

    <div class="tabs" id="inp-dt-tabs" style="margin-bottom:12px">
      ${tabs.map(t => `<button class="tab-btn ${t.k === 'cppt' ? 'active' : ''}"
        onclick="inpShowDetailTab('${t.k}')">${t.l}</button>`).join('')}
    </div>
    <div id="inp-dt-body"><div class="loading-row"><div class="spinner"></div></div></div>`, 'wide');

  inpShowDetailTab('cppt');
}

function inpShowDetailTab(k) {
  inpDetailTabName = k;
  const order = ['cppt', 'ttv', 'billing', 'resume'];
  document.querySelectorAll('#inp-dt-tabs .tab-btn').forEach((b, i) => {
    b.classList.toggle('active', order[i] === k);
  });
  if (k === 'cppt')    return inpPaintNotes();
  if (k === 'ttv')     return inpPaintVitals();
  if (k === 'billing') return inpPaintBilling();
  return inpPaintResume();
}

// ── Visite dokter & catatan keperawatan (clinical_notes) ───────
async function inpPaintNotes() {
  const el = document.getElementById('inp-dt-body'); if (!el || !inpCurrentStay) return;
  const s = inpCurrentStay;
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

  try {
    inpNotes = await sbGet('clinical_notes',
      `select=*&admission_id=eq.${s.admission_id}&order=created_at.desc&limit=100`) || [];
  } catch (e) { inpNotes = []; }

  el.innerHTML = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-weight:700;font-size:12.5px;margin-bottom:9px">Catatan Baru</div>
      <div class="form-row">
        <div class="form-group"><label>Jenis</label>
          <select id="inp-note-type"><option>CPPT</option><option>SOAP</option></select></div>
        <div class="form-group"><label>Penulis</label>
          <select id="inp-note-role">
            <option>Dokter</option><option>Perawat</option><option>Gizi</option>
            <option>Fisioterapis</option><option>Analis</option>
          </select></div>
      </div>
      <div class="form-group"><label>S — Subjektif</label>
        <textarea id="inp-note-s" rows="2" placeholder="Keluhan pasien hari ini"></textarea></div>
      <div class="form-group"><label>O — Objektif</label>
        <textarea id="inp-note-o" rows="2" placeholder="Pemeriksaan fisik, tanda vital, hasil penunjang"></textarea></div>
      <div class="form-group"><label>A — Asesmen</label>
        <textarea id="inp-note-a" rows="2" placeholder="Penilaian / diagnosis kerja"></textarea></div>
      <div class="form-group"><label>P — Rencana</label>
        <textarea id="inp-note-p" rows="2" placeholder="Terapi, tindakan, rencana pemeriksaan"></textarea></div>
      <div style="text-align:right">
        <button class="btn btn-teal btn-xs" onclick="inpSaveNote()">💾 Simpan Catatan</button></div>
    </div>

    <div style="font-weight:700;font-size:12.5px;margin-bottom:8px">
      Riwayat Catatan (${inpNotes.length})</div>
    ${inpNotes.length ? inpNotes.map(n => `
      <div style="border-left:3px solid var(--teal);background:#fff;border:1px solid var(--border);
        border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;gap:8px;align-items:center;font-size:11px;color:var(--gray);margin-bottom:5px">
          <b style="color:var(--text)">${inpEsc(n.author_name || '—')}</b>
          <span>${inpEsc(n.author_role || '')}</span>
          <span style="margin-left:auto">${inpDateTime(n.created_at)}</span>
          <span style="background:var(--bg2);padding:1px 6px;border-radius:4px">${inpEsc(n.note_type || 'CPPT')}</span>
        </div>
        ${['subjective:S', 'objective:O', 'assessment:A', 'plan:P'].map(pair => {
          const [f, lbl] = pair.split(':');
          return n[f] ? `<div style="font-size:12.5px;margin-bottom:3px">
            <b style="color:var(--teal)">${lbl}</b> — ${inpEsc(n[f])}</div>` : '';
        }).join('')}
      </div>`).join('')
      : '<div style="font-size:12px;color:var(--gray)">Belum ada catatan pada episode ini.</div>'}`;
}

async function inpSaveNote() {
  const s = inpCurrentStay; if (!s) return;
  const get = id => (document.getElementById(id)?.value || '').trim();
  const S = get('inp-note-s'), O = get('inp-note-o'), A = get('inp-note-a'), P = get('inp-note-p');
  if (!S && !O && !A && !P) { toast('Isi minimal satu bagian catatan', 'err'); return; }

  try {
    await sbPost('clinical_notes', {
      admission_id: s.admission_id,
      mr_number: s.mr_number,
      patient_name: s.patient_name,
      note_type: get('inp-note-type') || 'CPPT',
      subjective: S || null, objective: O || null,
      assessment: A || null, plan: P || null,
      author_name: inpUser(),
      author_role: get('inp-note-role') || 'Dokter',
      updated_at: new Date().toISOString(),
    });
    await logActivity('inpatient_note', 'clinical_notes', s.id,
      `Catatan rawat inap ${s.stay_number} — ${s.patient_name}`, s.patient_name);
    toast('✅ Catatan tersimpan', 'ok');
    inpPaintNotes();
  } catch (e) { inpFail(e); }
}

// ── Tanda vital (vital_signs) ──────────────────────────────────
async function inpPaintVitals() {
  const el = document.getElementById('inp-dt-body'); if (!el || !inpCurrentStay) return;
  const s = inpCurrentStay;
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

  let rows = [];
  try {
    rows = await sbGet('vital_signs',
      `select=*&admission_id=eq.${s.admission_id}&order=recorded_at.desc&limit=60`) || [];
  } catch (e) { rows = []; }

  const f = (id, lbl, ph) => `<div class="form-group"><label>${lbl}</label>
    <input type="number" step="any" id="${id}" placeholder="${ph || ''}"></div>`;

  el.innerHTML = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-weight:700;font-size:12.5px;margin-bottom:9px">Pencatatan Tanda Vital</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:9px">
        ${f('inp-vs-sys', 'Sistolik', '120')}
        ${f('inp-vs-dia', 'Diastolik', '80')}
        ${f('inp-vs-pulse', 'Nadi', '80')}
        ${f('inp-vs-temp', 'Suhu °C', '36.5')}
        ${f('inp-vs-rr', 'Napas', '20')}
        ${f('inp-vs-spo2', 'SpO₂ %', '98')}
        ${f('inp-vs-bb', 'Berat kg', '')}
        ${f('inp-vs-tb', 'Tinggi cm', '')}
      </div>
      <div style="text-align:right;margin-top:8px">
        <button class="btn btn-teal btn-xs" onclick="inpSaveVitals()">💾 Simpan</button></div>
    </div>

    ${rows.length ? `<div class="table-wrap"><table><thead><tr>
      <th>Waktu</th><th>TD</th><th>Nadi</th><th>Suhu</th><th>Napas</th><th>SpO₂</th><th>Pencatat</th>
    </tr></thead><tbody>${rows.map(v => `<tr>
      <td style="font-size:11.5px;color:var(--gray)">${inpDateTime(v.recorded_at)}</td>
      <td>${v.bp_systolic || '—'}/${v.bp_diastolic || '—'}</td>
      <td>${v.pulse || '—'}</td><td>${v.temperature || '—'}</td>
      <td>${v.resp_rate || '—'}</td><td>${v.spo2 || '—'}</td>
      <td style="font-size:11.5px">${inpEsc(v.recorded_by || '—')}</td>
    </tr>`).join('')}</tbody></table></div>`
    : '<div style="font-size:12px;color:var(--gray)">Belum ada catatan tanda vital.</div>'}`;
}

async function inpSaveVitals() {
  const s = inpCurrentStay; if (!s) return;
  const num = id => {
    const v = document.getElementById(id)?.value;
    return v === '' || v == null ? null : Number(v);
  };
  const body = {
    admission_id: s.admission_id, mr_number: s.mr_number,
    bp_systolic: num('inp-vs-sys'), bp_diastolic: num('inp-vs-dia'),
    pulse: num('inp-vs-pulse'), temperature: num('inp-vs-temp'),
    resp_rate: num('inp-vs-rr'), spo2: num('inp-vs-spo2'),
    weight: num('inp-vs-bb'), height: num('inp-vs-tb'),
    recorded_by: inpUser(), recorded_at: new Date().toISOString(),
  };
  const terisi = ['bp_systolic', 'bp_diastolic', 'pulse', 'temperature', 'resp_rate', 'spo2', 'weight', 'height']
    .some(k => body[k] != null);
  if (!terisi) { toast('Isi minimal satu nilai', 'err'); return; }

  if (body.weight && body.height) {
    body.bmi = Math.round(body.weight / Math.pow(body.height / 100, 2) * 10) / 10;
  }
  try {
    await sbPost('vital_signs', body);
    toast('✅ Tanda vital tersimpan', 'ok');
    inpPaintVitals();
  } catch (e) { inpFail(e); }
}

// ═══════════════════════════════════════════════════════════════
// BILLING HARIAN
// ═══════════════════════════════════════════════════════════════
async function inpPaintBilling() {
  const el = document.getElementById('inp-dt-body'); if (!el || !inpCurrentStay) return;
  const s = inpCurrentStay;
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

  try {
    inpCharges = await sbGet('inpatient_charges',
      `select=*&stay_id=eq.${s.id}&order=charge_date,id&limit=500`) || [];
  } catch (e) {
    el.innerHTML = `<div class="status-box status-warn">Jalankan <code>supabase_inpatient.sql</code> lebih dulu.</div>`;
    return;
  }

  const total = inpCharges.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const perType = {};
  inpCharges.forEach(c => {
    perType[c.charge_type] = (perType[c.charge_type] || 0) + (Number(c.amount) || 0);
  });
  const hariKamar = inpCharges.filter(c => c.charge_type === 'Kamar').length;

  el.innerHTML = `
    <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:12px">
      ${s.status === 'Dirawat'
        ? `<button class="btn btn-ghost btn-xs" onclick="inpSyncRoomCharges(${s.id})">🔄 Perbarui Biaya Kamar</button>
           <button class="btn btn-teal btn-xs" onclick="inpOpenAddCharge(${s.id})">+ Tambah Biaya</button>` : ''}
      <button class="btn btn-ghost btn-xs" onclick="inpPrintBill(${s.id})">🖨 Cetak Rincian</button>
      <div style="margin-left:auto;font-size:13px">
        <span style="color:var(--gray)">Total berjalan</span>
        <b style="color:var(--teal);font-size:16px;margin-left:7px;font-variant-numeric:tabular-nums">${inpMoney(total)}</b></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:14px">
      ${Object.keys(perType).length ? Object.keys(perType).map(t => `
        <div style="background:var(--bg2);border-radius:8px;padding:9px 11px">
          <div style="font-size:10.5px;color:var(--gray)">${inpEsc(t)}${t === 'Kamar' ? ` · ${hariKamar} hari` : ''}</div>
          <div style="font-weight:750;font-size:13px;font-variant-numeric:tabular-nums">${inpMoney(perType[t])}</div>
        </div>`).join('')
        : '<div style="font-size:12px;color:var(--gray)">Belum ada biaya tercatat.</div>'}
    </div>

    ${inpCharges.length ? `<div class="table-wrap"><table><thead><tr>
      <th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th style="text-align:right">Qty</th>
      <th style="text-align:right">Harga</th><th style="text-align:right">Jumlah</th>
    </tr></thead><tbody>${inpCharges.map(c => `<tr>
      <td style="font-size:11.5px;color:var(--gray)">${inpDateOnly(c.charge_date)}</td>
      <td style="font-size:12px">${inpEsc(c.charge_type)}
        ${c.source === 'otomatis' ? '<span style="font-size:9.5px;color:var(--gray)"> · otomatis</span>' : ''}</td>
      <td style="font-size:12px">${inpEsc(c.description || '')}</td>
      <td style="text-align:right;font-size:12px">${Number(c.qty) || 1}</td>
      <td style="text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${inpMoney(c.unit_price)}</td>
      <td style="text-align:right;font-size:12px;font-weight:650;font-variant-numeric:tabular-nums">${inpMoney(c.amount)}</td>
    </tr>`).join('')}
    <tr style="background:var(--bg2)"><td colspan="5" style="text-align:right;font-weight:750">Total</td>
      <td style="text-align:right;font-weight:800;font-variant-numeric:tabular-nums">${inpMoney(total)}</td></tr>
    </tbody></table></div>` : ''}`;
}

async function inpSyncRoomCharges(stayId) {
  try {
    const r = await sbRpc('inp_charge_room_days', { p_stay_id: stayId });
    toast(r?.hari_baru ? `✅ ${r.hari_baru} hari kamar ditambahkan` : 'Biaya kamar sudah mutakhir', 'ok');
    const rows = await sbGet('inpatient_stays', `select=*&id=eq.${stayId}&limit=1`).catch(() => []);
    if (rows?.[0]) inpCurrentStay = rows[0];
    inpPaintBilling();
  } catch (e) { inpFail(e); }
}

function inpOpenAddCharge(stayId) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const visitRate = (() => {
    const c = inpClasses.find(c => c.code === (inpCurrentStay?.class_code));
    return c ? Number(c.visit_rate) || 0 : 0;
  })();

  openModal(`
    <div class="modal-header"><div class="modal-title">+ Tambah Biaya</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Jenis Biaya *</label>
        <select id="inp-chg-type" onchange="inpChargeTypeHint(${visitRate})">
          ${INP_CHARGE_TYPES.map(t => `<option>${t}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Tanggal</label>
        <input type="date" id="inp-chg-date" value="${today}"></div>
    </div>
    <div class="form-group"><label>Keterangan *</label>
      <input type="text" id="inp-chg-desc" placeholder="mis. Visite dr. Andi, Pasang infus, Paracetamol inf"></div>
    <div class="form-row">
      <div class="form-group"><label>Jumlah</label>
        <input type="number" id="inp-chg-qty" value="1" min="1" step="1" oninput="inpChargeTotalHint()"></div>
      <div class="form-group"><label>Harga Satuan</label>
        <input type="number" id="inp-chg-price" value="0" min="0" step="1000" oninput="inpChargeTotalHint()"></div>
    </div>
    <div id="inp-chg-total" style="font-size:12.5px;color:var(--teal);margin-bottom:10px"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="inpSaveCharge(${stayId})">💾 Simpan Biaya</button>
    </div>`, 'wide');

  inpChargeTotalHint();
}

// Visite dokter memakai tarif kelas sebagai nilai awal
function inpChargeTypeHint(visitRate) {
  const t = document.getElementById('inp-chg-type')?.value;
  const p = document.getElementById('inp-chg-price');
  if (t === 'Visite' && p && visitRate) { p.value = visitRate; }
  inpChargeTotalHint();
}

function inpChargeTotalHint() {
  const q = Number(document.getElementById('inp-chg-qty')?.value) || 0;
  const p = Number(document.getElementById('inp-chg-price')?.value) || 0;
  const box = document.getElementById('inp-chg-total');
  if (box) box.textContent = `Jumlah: ${inpMoney(q * p)}`;
}

async function inpSaveCharge(stayId) {
  const desc = document.getElementById('inp-chg-desc').value.trim();
  if (!desc) { toast('Keterangan wajib diisi', 'err'); return; }
  try {
    await sbRpc('inp_add_charge', {
      p_stay_id: stayId,
      p_charge_type: document.getElementById('inp-chg-type').value,
      p_description: desc,
      p_qty: Number(document.getElementById('inp-chg-qty').value) || 1,
      p_unit_price: Number(document.getElementById('inp-chg-price').value) || 0,
      p_charge_date: document.getElementById('inp-chg-date').value || null,
    });
    toast('✅ Biaya tercatat', 'ok');
    closeModalForce();
    const rows = await sbGet('inpatient_stays', `select=*&id=eq.${stayId}&limit=1`).catch(() => []);
    if (rows?.[0]) inpCurrentStay = rows[0];
    inpPaintBilling();
  } catch (e) { inpFail(e); }
}

async function inpPrintBill(stayId) {
  const s = inpCurrentStay && inpCurrentStay.id === stayId ? inpCurrentStay
    : (await sbGet('inpatient_stays', `select=*&id=eq.${stayId}&limit=1`).catch(() => []))?.[0];
  if (!s) { toast('Episode tidak ditemukan', 'err'); return; }
  const rows = await sbGet('inpatient_charges',
    `select=*&stay_id=eq.${stayId}&order=charge_date,id&limit=500`).catch(() => []);
  if (!rows.length) { toast('Belum ada biaya untuk dicetak', 'warn'); return; }

  const total = rows.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const org = localStorage.getItem('ol_org_name') || 'OneLab Diagnostics';
  const w = window.open('', '_blank');
  w.document.write(`<html><head><meta charset="utf-8"><title>${inpEsc(s.stay_number || 'Rincian')}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:26px;max-width:720px;margin:auto;line-height:1.5}
      h2{margin:0 0 2px} .sub{color:#666;font-size:11px;margin-bottom:16px}
      .box{border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:11.5px}
      table{width:100%;border-collapse:collapse;font-size:11.5px}
      th,td{border-bottom:1px solid #e5e5e5;padding:6px 5px;text-align:left}
      th{background:#f5f5f5;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}
      .r{text-align:right} .tot td{font-weight:800;border-top:2px solid #333;font-size:13px}
      .sign{margin-top:44px;text-align:right}
      .sign div{display:inline-block;width:220px;text-align:center;border-top:1px solid #333;padding-top:4px}</style>
    </head><body>
    <h2>Rincian Biaya Rawat Inap</h2>
    <div class="sub">${inpEsc(org)} · ${inpEsc(s.stay_number || '')}</div>
    <div class="box"><b>${inpEsc(s.patient_name)}</b> · ${inpEsc(s.mr_number || '')}<br>
      Ruang: ${inpEsc([s.ward_name, s.room_no, s.bed_no].filter(Boolean).join(' / '))} ·
      Kelas ${inpEsc(s.class_code || '-')}<br>
      Masuk: ${inpDateTime(s.admitted_at)} ·
      ${s.discharged_at ? 'Pulang: ' + inpDateTime(s.discharged_at) : 'Masih dirawat'}<br>
      Lama rawat: ${inpLos(s)} hari · DPJP: ${inpEsc(s.dpjp_name || '—')} ·
      Penjamin: ${inpEsc(s.guarantor || 'Umum')}</div>
    <table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th>
      <th class="r">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead>
    <tbody>${rows.map(c => `<tr>
      <td>${inpDateOnly(c.charge_date)}</td><td>${inpEsc(c.charge_type)}</td>
      <td>${inpEsc(c.description || '')}</td>
      <td class="r">${Number(c.qty) || 1}</td>
      <td class="r">${inpMoney(c.unit_price)}</td>
      <td class="r">${inpMoney(c.amount)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="5" class="r">TOTAL</td><td class="r">${inpMoney(total)}</td></tr>
    </tbody></table>
    <div class="sign"><div>Petugas<br><span style="font-size:10px;color:#666">${inpEsc(inpUser())}</span></div></div>
    <script>window.print()<\/script></body></html>`);
  w.document.close();
}

// ═══════════════════════════════════════════════════════════════
// RESUME PULANG
// ═══════════════════════════════════════════════════════════════
async function inpPaintResume() {
  const el = document.getElementById('inp-dt-body'); if (!el || !inpCurrentStay) return;
  const s = inpCurrentStay;
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

  let d = null;
  try {
    const rows = await sbGet('inpatient_discharges',
      `select=*&stay_id=eq.${s.id}&order=id.desc&limit=1`);
    d = rows?.[0] || null;
  } catch (e) { d = null; }

  // Sudah pulang → tampilkan resume yang tersimpan
  if (s.status !== 'Dirawat') {
    el.innerHTML = `
      <div style="background:#E8F5EC;border:1px solid #15803D55;border-radius:8px;padding:10px 13px;
        margin-bottom:12px;font-size:12.5px;color:#15803D">
        ✅ ${inpEsc(s.status)} pada ${inpDateTime(s.discharged_at)} ·
        ${inpLos(s)} hari rawat · tagihan ${inpMoney(s.total_charges)}</div>
      ${d ? `
        ${inpResumeRow('Cara Pulang', d.discharge_type)}
        ${inpResumeRow('Diagnosis Akhir', [d.final_diagnosis, d.final_icd].filter(Boolean).join(' · '))}
        ${inpResumeRow('Diagnosis Sekunder', d.secondary_diagnosis)}
        ${inpResumeRow('Tindakan', d.procedures)}
        ${inpResumeRow('Ringkasan Perawatan', d.treatment_summary)}
        ${inpResumeRow('Obat Pulang', d.discharge_medication)}
        ${inpResumeRow('Instruksi Pulang', d.discharge_instruction)}
        ${inpResumeRow('Kondisi Saat Pulang', d.condition_on_discharge)}
        ${inpResumeRow('Kontrol', [d.follow_up_date ? inpDateOnly(d.follow_up_date) : '', d.follow_up_place].filter(Boolean).join(' · '))}
        ${inpResumeRow('Dirujuk Ke', d.referred_to)}
        ${inpResumeRow('Dokter', d.doctor_name)}
        <div style="margin-top:12px;text-align:right">
          <button class="btn btn-ghost btn-xs" onclick="inpPrintResume(${s.id})">🖨 Cetak Resume</button></div>`
        : '<div style="font-size:12px;color:var(--gray)">Resume pulang tidak tersimpan pada episode ini.</div>'}`;
    return;
  }

  // Masih dirawat → formulir resume pulang
  const tomorrow = new Date(Date.now() + 7 * 86400000 - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
  el.innerHTML = `
    <div style="background:#FBF1E4;border:1px solid #B4530955;border-radius:8px;padding:9px 13px;
      margin-bottom:12px;font-size:12px;color:#8A4A0B">
      Menyimpan resume sekaligus menutup episode dan membebaskan tempat tidur.
      Biaya kamar dilengkapi otomatis sampai hari ini sebelum tagihan dikunci.</div>

    <div class="form-row">
      <div class="form-group"><label>Cara Pulang *</label>
        <select id="inp-dis-type" onchange="inpResumeTypeHint()">
          <option>Pulang</option><option>Dirujuk</option>
          <option>Pulang APS</option><option>Meninggal</option>
        </select></div>
      <div class="form-group"><label>Kondisi Saat Pulang</label>
        <select id="inp-dis-cond">
          <option>Membaik</option><option>Sembuh</option>
          <option>Belum Sembuh</option><option>Meninggal</option>
        </select></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>Diagnosis Akhir *</label>
        <input type="text" id="inp-dis-diag" value="${inpEsc(s.admit_diagnosis || '')}"></div>
      <div class="form-group"><label>Kode ICD-10</label>
        <input type="text" id="inp-dis-icd" value="${inpEsc(s.admit_icd || '')}"></div>
    </div>

    <div class="form-group"><label>Diagnosis Sekunder</label>
      <input type="text" id="inp-dis-sec" placeholder="Penyakit penyerta / komplikasi"></div>
    <div class="form-group"><label>Tindakan Selama Dirawat</label>
      <textarea id="inp-dis-proc" rows="2" placeholder="Tindakan, operasi, prosedur"></textarea></div>
    <div class="form-group"><label>Ringkasan Perawatan *</label>
      <textarea id="inp-dis-sum" rows="4" placeholder="Perjalanan penyakit, terapi yang diberikan, hasil pemeriksaan penting"></textarea></div>
    <div class="form-group"><label>Obat Pulang</label>
      <textarea id="inp-dis-med" rows="2" placeholder="Nama obat, dosis, aturan pakai"></textarea></div>
    <div class="form-group"><label>Instruksi Pulang</label>
      <textarea id="inp-dis-inst" rows="3" placeholder="Diet, aktivitas, perawatan luka, tanda bahaya yang harus diwaspadai"></textarea></div>

    <div class="form-row">
      <div class="form-group"><label>Tanggal Kontrol</label>
        <input type="date" id="inp-dis-fu" value="${tomorrow}"></div>
      <div class="form-group" id="inp-dis-ref-wrap" style="display:none">
        <label>Dirujuk Ke</label>
        <input type="text" id="inp-dis-ref" placeholder="Nama rumah sakit tujuan"></div>
    </div>

    <div style="text-align:right;margin-top:10px">
      <button class="btn btn-ghost btn-xs" onclick="inpShowDetailTab('billing')">Lihat Tagihan Dulu</button>
      <button class="btn btn-teal" onclick="inpSaveDischarge(${s.id})">✅ Pulangkan Pasien</button>
    </div>`;
}

function inpResumeRow(label, val) {
  if (!val) return '';
  return `<div style="margin-bottom:9px">
    <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--gray);
      font-weight:700;margin-bottom:2px">${inpEsc(label)}</div>
    <div style="font-size:12.5px;white-space:pre-wrap">${inpEsc(val)}</div></div>`;
}

function inpResumeTypeHint() {
  const t = document.getElementById('inp-dis-type')?.value;
  const wrap = document.getElementById('inp-dis-ref-wrap');
  if (wrap) wrap.style.display = t === 'Dirujuk' ? '' : 'none';
  const cond = document.getElementById('inp-dis-cond');
  if (cond && t === 'Meninggal') cond.value = 'Meninggal';
}

async function inpSaveDischarge(stayId) {
  const get = id => (document.getElementById(id)?.value || '').trim();
  const diag = get('inp-dis-diag');
  const sum = get('inp-dis-sum');
  if (!diag) { toast('Diagnosis akhir wajib diisi', 'err'); return; }
  if (!sum) { toast('Ringkasan perawatan wajib diisi', 'err'); return; }
  if (!confirm('Pulangkan pasien dan tutup episode rawat inap? Tempat tidur akan dibebaskan.')) return;

  try {
    const r = await sbRpc('inp_discharge_patient', {
      p_stay_id: stayId,
      p_discharge_type: get('inp-dis-type') || 'Pulang',
      p_final_diagnosis: diag,
      p_final_icd: get('inp-dis-icd') || null,
      p_secondary: get('inp-dis-sec') || null,
      p_procedures: get('inp-dis-proc') || null,
      p_summary: sum,
      p_medication: get('inp-dis-med') || null,
      p_instruction: get('inp-dis-inst') || null,
      p_condition: get('inp-dis-cond') || 'Membaik',
      p_follow_up_date: get('inp-dis-fu') || null,
      p_referred_to: get('inp-dis-ref') || null,
    });
    toast(`✅ Pasien ${r?.status || 'pulang'} — ${r?.hari_rawat || 0} hari, ${inpMoney(r?.total)}`, 'ok');
    // Kegagalan jurnal tidak menahan pasien; petugas keuangan diberi tahu terpisah.
    if (r?.warning) toast('⚠ ' + r.warning, 'warn');

    const rows = await sbGet('inpatient_stays', `select=*&id=eq.${stayId}&limit=1`).catch(() => []);
    if (rows?.[0]) inpCurrentStay = rows[0];
    await inpLoadAll();
    inpShowDetailTab('resume');
  } catch (e) { inpFail(e); }
}

async function inpPrintResume(stayId) {
  const s = inpCurrentStay && inpCurrentStay.id === stayId ? inpCurrentStay
    : (await sbGet('inpatient_stays', `select=*&id=eq.${stayId}&limit=1`).catch(() => []))?.[0];
  if (!s) { toast('Episode tidak ditemukan', 'err'); return; }
  const rows = await sbGet('inpatient_discharges',
    `select=*&stay_id=eq.${stayId}&order=id.desc&limit=1`).catch(() => []);
  const d = rows?.[0];
  if (!d) { toast('Resume pulang belum ada', 'warn'); return; }

  const org = localStorage.getItem('ol_org_name') || 'OneLab Diagnostics';
  const sec = (t, v) => v ? `<div class="sec"><div class="lbl">${inpEsc(t)}</div>
    <div>${inpEsc(v).replace(/\n/g, '<br>')}</div></div>` : '';
  const w = window.open('', '_blank');
  w.document.write(`<html><head><meta charset="utf-8"><title>Resume ${inpEsc(s.stay_number || '')}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:26px;max-width:720px;margin:auto;line-height:1.55}
      h2{margin:0 0 2px} .sub{color:#666;font-size:11px;margin-bottom:16px}
      .box{border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:11.5px}
      .sec{margin-bottom:12px} .lbl{font-weight:700;font-size:11px;text-transform:uppercase;
        letter-spacing:.06em;color:#555;margin-bottom:3px}
      .sign{margin-top:44px;text-align:right}
      .sign div{display:inline-block;width:220px;text-align:center;border-top:1px solid #333;padding-top:4px}</style>
    </head><body>
    <h2>Resume Pulang Rawat Inap</h2>
    <div class="sub">${inpEsc(org)} · ${inpEsc(s.stay_number || '')}</div>
    <div class="box"><b>${inpEsc(s.patient_name)}</b> · ${inpEsc(s.mr_number || '')} ·
      ${inpEsc(s.patient_gender || '')} ${s.patient_age ? '· ' + s.patient_age + ' th' : ''}<br>
      Ruang: ${inpEsc([s.ward_name, s.room_no, s.bed_no].filter(Boolean).join(' / '))} ·
      Kelas ${inpEsc(s.class_code || '-')}<br>
      Masuk: ${inpDateTime(s.admitted_at)} · Pulang: ${inpDateTime(s.discharged_at)} ·
      Lama rawat: ${inpLos(s)} hari<br>
      DPJP: ${inpEsc(s.dpjp_name || '—')} · Cara pulang: ${inpEsc(d.discharge_type || '')}</div>
    ${sec('Diagnosis Masuk', s.admit_diagnosis)}
    ${sec('Diagnosis Akhir', [d.final_diagnosis, d.final_icd].filter(Boolean).join(' — '))}
    ${sec('Diagnosis Sekunder', d.secondary_diagnosis)}
    ${sec('Tindakan', d.procedures)}
    ${sec('Ringkasan Perawatan', d.treatment_summary)}
    ${sec('Obat Pulang', d.discharge_medication)}
    ${sec('Instruksi Pulang', d.discharge_instruction)}
    ${sec('Kondisi Saat Pulang', d.condition_on_discharge)}
    ${sec('Kontrol', d.follow_up_date ? inpDateOnly(d.follow_up_date) : '')}
    ${sec('Dirujuk Ke', d.referred_to)}
    <div class="sign"><div>${inpEsc(d.doctor_name || s.dpjp_name || '')}<br>
      <span style="font-size:10px;color:#666">Dokter Penanggung Jawab Pasien</span></div></div>
    <script>window.print()<\/script></body></html>`);
  w.document.close();
}

// ═══════════════════════════════════════════════════════════════
// MASTER: BANGSAL, TEMPAT TIDUR, TARIF KELAS
// ═══════════════════════════════════════════════════════════════
function inpPaintMaster() {
  const el = document.getElementById('inp-content'); if (!el) return;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px">

      <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="display:flex;align-items:center;margin-bottom:10px">
          <div style="font-weight:750;font-size:13px">Bangsal / Ruang</div>
          <button class="btn btn-teal btn-xs" style="margin-left:auto" onclick="inpOpenWardForm()">+ Bangsal</button>
        </div>
        ${inpWards.length ? `<div class="table-wrap"><table><thead><tr>
          <th>Kode</th><th>Nama</th><th>Lantai</th><th>Tipe</th><th>TT</th><th></th>
        </tr></thead><tbody>${inpWards.map(w => `<tr>
          <td style="font-family:ui-monospace,monospace;font-size:11.5px">${inpEsc(w.code || '')}</td>
          <td style="font-size:12.5px">${inpEsc(w.name)}</td>
          <td style="font-size:12px;color:var(--gray)">${inpEsc(w.floor || '—')}</td>
          <td style="font-size:12px">${inpEsc(w.ward_type || 'Umum')}</td>
          <td style="font-size:12px">${inpBeds.filter(b => b.ward_id === w.id).length}</td>
          <td><div class="act-row">
            <button class="btn btn-ghost btn-xs" onclick="inpOpenWardForm(${w.id})">Ubah</button>
            <button class="btn btn-ghost btn-xs" onclick="inpOpenBedForm(null,${w.id})">+ TT</button>
          </div></td></tr>`).join('')}</tbody></table></div>`
          : '<div style="font-size:12px;color:var(--gray)">Belum ada bangsal.</div>'}
      </div>

      <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="display:flex;align-items:center;margin-bottom:10px">
          <div style="font-weight:750;font-size:13px">Kelas &amp; Tarif Kamar</div>
          <button class="btn btn-teal btn-xs" style="margin-left:auto" onclick="inpOpenClassForm()">+ Kelas</button>
        </div>
        ${inpClasses.length ? `<div class="table-wrap"><table><thead><tr>
          <th>Kelas</th><th>Nama</th><th style="text-align:right">Kamar/hari</th>
          <th style="text-align:right">Visite</th><th></th>
        </tr></thead><tbody>${inpClasses.map(c => `<tr>
          <td style="font-weight:700;font-size:12px">${inpEsc(c.code)}</td>
          <td style="font-size:12.5px">${inpEsc(c.name || '')}</td>
          <td style="text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${inpMoney(c.room_rate)}</td>
          <td style="text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${inpMoney(c.visit_rate)}</td>
          <td><button class="btn btn-ghost btn-xs" onclick="inpOpenClassForm(${c.id})">Ubah</button></td>
        </tr>`).join('')}</tbody></table></div>`
          : '<div style="font-size:12px;color:var(--gray)">Belum ada kelas perawatan.</div>'}
      </div>
    </div>

    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;margin-top:14px">
      <div style="display:flex;align-items:center;margin-bottom:10px">
        <div style="font-weight:750;font-size:13px">Tempat Tidur (${inpBeds.length})</div>
        <button class="btn btn-teal btn-xs" style="margin-left:auto" onclick="inpOpenBedForm()">+ Tempat Tidur</button>
      </div>
      ${inpBeds.length ? `<div class="table-wrap"><table><thead><tr>
        <th>Bangsal</th><th>Kamar</th><th>TT</th><th>Kelas</th><th>Status</th><th>Aksi</th>
      </tr></thead><tbody>${inpBeds.map(b => {
        const st = INP_BED_STATUS[b.status] || INP_BED_STATUS['Kosong'];
        const w = inpWards.find(w => w.id === b.ward_id);
        return `<tr>
          <td style="font-size:12.5px">${inpEsc(w ? w.name : '—')}</td>
          <td style="font-size:12px">${inpEsc(b.room_no || '—')}</td>
          <td style="font-size:12px;font-weight:650">${inpEsc(b.bed_no)}</td>
          <td style="font-size:12px">${inpEsc(b.class_code || '—')}</td>
          <td><span style="background:${st.bg};color:${st.c};padding:3px 9px;border-radius:5px;
            font-size:11px;font-weight:700">${inpEsc(b.status)}</span></td>
          <td><div class="act-row" style="flex-wrap:wrap">
            <button class="btn btn-ghost btn-xs" onclick="inpOpenBedForm(${b.id})">Ubah</button>
            ${b.status !== 'Terisi' ? `
              ${b.status !== 'Kosong' ? `<button class="btn btn-ghost btn-xs" onclick="inpSetBedStatus(${b.id},'Kosong')">Kosongkan</button>` : ''}
              ${b.status !== 'Perbaikan' ? `<button class="btn btn-ghost btn-xs" onclick="inpSetBedStatus(${b.id},'Perbaikan')">Perbaikan</button>` : ''}
            ` : ''}
          </div></td></tr>`;
      }).join('')}</tbody></table></div>`
        : '<div style="font-size:12px;color:var(--gray)">Belum ada tempat tidur.</div>'}
    </div>`;
}

function inpOpenWardForm(id) {
  const w = id ? inpWards.find(x => x.id === id) : null;
  openModal(`
    <div class="modal-header"><div class="modal-title">${w ? 'Ubah' : 'Tambah'} Bangsal</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Kode *</label>
        <input type="text" id="inp-w-code" value="${inpEsc(w?.code || '')}" placeholder="MLT"></div>
      <div class="form-group"><label>Nama Bangsal *</label>
        <input type="text" id="inp-w-name" value="${inpEsc(w?.name || '')}" placeholder="Bangsal Melati"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Lantai</label>
        <input type="text" id="inp-w-floor" value="${inpEsc(w?.floor || '')}" placeholder="Lantai 2"></div>
      <div class="form-group"><label>Tipe</label>
        <select id="inp-w-type">
          ${['Umum', 'Anak', 'Kebidanan', 'Isolasi', 'Intensif'].map(t =>
            `<option ${w?.ward_type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-group"><label>Catatan</label>
      <input type="text" id="inp-w-notes" value="${inpEsc(w?.notes || '')}"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="inpSaveWard(${w ? w.id : 'null'})">💾 Simpan</button>
    </div>`, 'wide');
}

async function inpSaveWard(id) {
  const code = document.getElementById('inp-w-code').value.trim();
  const name = document.getElementById('inp-w-name').value.trim();
  if (!code) { toast('Kode bangsal wajib diisi', 'err'); return; }
  if (!name) { toast('Nama bangsal wajib diisi', 'err'); return; }
  const body = {
    code, name,
    floor: document.getElementById('inp-w-floor').value.trim() || null,
    ward_type: document.getElementById('inp-w-type').value,
    notes: document.getElementById('inp-w-notes').value.trim() || null,
    is_active: true, updated_at: new Date().toISOString(),
  };
  try {
    if (id) await sbPatch('inpatient_wards', id, body);
    else await sbPost('inpatient_wards', body);
    await logActivity(id ? 'update' : 'create', 'inpatient_wards', id || code,
      `Bangsal ${name}`, name);
    toast('✅ Bangsal tersimpan', 'ok');
    closeModalForce(); await inpLoadAll();
  } catch (e) { inpFail(e); }
}

function inpOpenBedForm(id, wardId) {
  const b = id ? inpBeds.find(x => x.id === id) : null;
  if (!inpWards.length) { toast('Buat bangsal lebih dulu', 'warn'); return; }
  const wid = b?.ward_id || wardId || inpWards[0].id;

  openModal(`
    <div class="modal-header"><div class="modal-title">${b ? 'Ubah' : 'Tambah'} Tempat Tidur</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Bangsal *</label>
        <select id="inp-b-ward">
          ${inpWards.map(w => `<option value="${w.id}" ${w.id === wid ? 'selected' : ''}>${inpEsc(w.name)}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Kelas *</label>
        <select id="inp-b-class">
          ${inpClasses.map(c => `<option value="${inpEsc(c.code)}" ${b?.class_code === c.code ? 'selected' : ''}>
            ${inpEsc(c.code)} — ${inpMoney(c.room_rate)}/hari</option>`).join('')}
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Nomor Kamar</label>
        <input type="text" id="inp-b-room" value="${inpEsc(b?.room_no || '')}" placeholder="201"></div>
      <div class="form-group"><label>Nomor Tempat Tidur *</label>
        <input type="text" id="inp-b-bed" value="${inpEsc(b?.bed_no || '')}" placeholder="A"></div>
    </div>
    ${!b ? `<div class="form-group"><label>Buat Sekaligus</label>
      <input type="number" id="inp-b-count" value="1" min="1" max="20" step="1">
      <div style="font-size:11px;color:var(--gray);margin-top:4px">
        Lebih dari satu akan membuat nomor berurutan: A, B, C, ... dimulai dari nomor di atas.</div></div>` : ''}
    <div class="form-group"><label>Catatan</label>
      <input type="text" id="inp-b-notes" value="${inpEsc(b?.notes || '')}"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="inpSaveBed(${b ? b.id : 'null'})">💾 Simpan</button>
    </div>`, 'wide');
}

async function inpSaveBed(id) {
  const bedNo = document.getElementById('inp-b-bed').value.trim();
  if (!bedNo) { toast('Nomor tempat tidur wajib diisi', 'err'); return; }

  const base = {
    ward_id: parseInt(document.getElementById('inp-b-ward').value),
    class_code: document.getElementById('inp-b-class').value,
    room_no: document.getElementById('inp-b-room').value.trim() || null,
    notes: document.getElementById('inp-b-notes').value.trim() || null,
    is_active: true, updated_at: new Date().toISOString(),
  };

  try {
    if (id) {
      await sbPatch('inpatient_beds', id, { ...base, bed_no: bedNo });
    } else {
      const n = Math.max(1, Math.min(20, parseInt(document.getElementById('inp-b-count')?.value) || 1));
      const rows = [];
      for (let i = 0; i < n; i++) rows.push({ ...base, bed_no: inpNextBedNo(bedNo, i), status: 'Kosong' });
      await sbPost('inpatient_beds', rows);
    }
    toast('✅ Tempat tidur tersimpan', 'ok');
    closeModalForce(); await inpLoadAll();
  } catch (e) {
    if (/duplicate key|uq_inp_bed/i.test(e.message || '')) {
      toast('❌ Nomor tempat tidur itu sudah ada di kamar tersebut', 'err');
    } else { inpFail(e); }
  }
}

// A → A, B, C ... / 1 → 1, 2, 3 ...
function inpNextBedNo(base, offset) {
  if (!offset) return base;
  if (/^[A-Za-z]$/.test(base)) {
    return String.fromCharCode(base.charCodeAt(0) + offset);
  }
  const m = base.match(/^(.*?)(\d+)$/);
  if (m) return m[1] + String(parseInt(m[2]) + offset).padStart(m[2].length, '0');
  return base + '-' + (offset + 1);
}

function inpOpenClassForm(id) {
  const c = id ? inpClasses.find(x => x.id === id) : null;
  openModal(`
    <div class="modal-header"><div class="modal-title">${c ? 'Ubah' : 'Tambah'} Kelas Perawatan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Kode Kelas *</label>
        <input type="text" id="inp-c-code" value="${inpEsc(c?.code || '')}" placeholder="VIP / 1 / 2 / 3"
          ${c ? 'readonly style="background:var(--bg2)"' : ''}></div>
      <div class="form-group"><label>Nama *</label>
        <input type="text" id="inp-c-name" value="${inpEsc(c?.name || '')}" placeholder="Kelas VIP"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tarif Kamar / hari *</label>
        <input type="number" id="inp-c-rate" value="${Number(c?.room_rate) || 0}" min="0" step="10000"></div>
      <div class="form-group"><label>Tarif Visite Dokter</label>
        <input type="number" id="inp-c-visit" value="${Number(c?.visit_rate) || 0}" min="0" step="10000"></div>
    </div>
    <div style="font-size:11.5px;color:var(--gray);margin-bottom:10px">
      Perubahan tarif berlaku untuk hari rawat berikutnya. Hari yang sudah tertagih
      tidak ikut berubah.</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="inpSaveClass(${c ? c.id : 'null'})">💾 Simpan</button>
    </div>`, 'wide');
}

async function inpSaveClass(id) {
  const code = document.getElementById('inp-c-code').value.trim();
  const name = document.getElementById('inp-c-name').value.trim();
  if (!code) { toast('Kode kelas wajib diisi', 'err'); return; }
  if (!name) { toast('Nama kelas wajib diisi', 'err'); return; }

  const body = {
    name,
    room_rate: Number(document.getElementById('inp-c-rate').value) || 0,
    visit_rate: Number(document.getElementById('inp-c-visit').value) || 0,
    is_active: true, updated_at: new Date().toISOString(),
  };
  try {
    if (id) await sbPatch('inpatient_classes', id, body);
    else await sbPost('inpatient_classes', { ...body, code });
    await logActivity(id ? 'update' : 'create', 'inpatient_classes', id || code,
      `Kelas perawatan ${code} — tarif ${body.room_rate}`, code);
    toast('✅ Kelas tersimpan', 'ok');
    closeModalForce(); await inpLoadAll();
  } catch (e) { inpFail(e); }
}
