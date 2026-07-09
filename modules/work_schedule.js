// ═══════════════════════════════════════════════════════════════
// MODULE: Jadwal Kerja & Shift — v2
// Weekday vs Sabtu jam berbeda, rotasi P1↔P2 support
// ═══════════════════════════════════════════════════════════════

const SHIFT_TEMPLATES = [
  { name:'P1 – Shift 1',  code:'P1', masuk_wd:'09:00', pulang_wd:'17:00', masuk_sb:'08:00', pulang_sb:'14:00', hari:['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name:'P2 – Shift 2',  code:'P2', masuk_wd:'10:00', pulang_wd:'18:00', masuk_sb:'09:00', pulang_sb:'15:00', hari:['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name:'P3 – Shift 3',  code:'P3', masuk_wd:'08:00', pulang_wd:'16:00', masuk_sb:'08:00', pulang_sb:'13:00', hari:['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name:'OH – Office Hr', code:'OH', masuk_wd:'09:00', pulang_wd:'18:00', masuk_sb:null,   pulang_sb:null,   hari:['Mon','Tue','Wed','Thu','Fri'] },
  { name:'Shift Malam',   code:'ML', masuk_wd:'22:00', pulang_wd:'06:00', masuk_sb:'22:00', pulang_sb:'06:00', hari:['Mon','Tue','Wed','Thu','Fri','Sat'], cross:true },
];

const ROTATION_TYPES = [
  {value:'none',    label:'Tidak Rotasi (Tetap)'},
  {value:'weekly',  label:'Rotasi Mingguan (P1↔P2)'},
  {value:'biweekly',label:'Rotasi 2 Minggu Sekali'},
];

const DAYS_LABEL = {Mon:'Sen',Tue:'Sel',Wed:'Rab',Thu:'Kam',Fri:'Jum',Sat:'Sab',Sun:'Min'};

let scheduleAll = [], scheduleEmpList = [];

// ── RENDER UTAMA ──────────────────────────────────────────────
async function renderWorkSchedule() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>📅 Jadwal Kerja & Shift</h1>
        <p>Setup shift per karyawan — jam weekday vs sabtu, rotasi P1↔P2</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="seedScheduleFromExcel()">📥 Import dari Template</button>
        <button class="btn btn-outline btn-sm" onclick="navigate('shift-calendar')">📅 Kalender Shift</button>
        <button class="btn btn-teal" onclick="openScheduleForm()">+ Tambah Jadwal</button>
      </div>
    </div>

    <div style="background:var(--teal-light);border-radius:var(--r);padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--teal)">
      ℹ️ Tabel di bawah ini adalah <strong>template shift mingguan</strong> per karyawan (jam masuk/pulang, hari kerja).
      Untuk assign shift ke <strong>tanggal spesifik di kalender</strong> (misal: tanggal 25 Juni karyawan X masuk P2),
      gunakan tombol "📅 Kalender Shift" — itu sistem terpisah yang mencatat kehadiran harian.
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:20px" id="sched-kpi">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <!-- Quick setup templates -->
    <div class="card" style="margin-bottom:18px">
      <div class="card-title" style="margin-bottom:12px">⚡ Quick Setup — Template Shift</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${SHIFT_TEMPLATES.map(t=>`
          <button class="btn btn-ghost btn-sm" onclick='applyShiftTemplate(${JSON.stringify(t).replace(/'/g,"&apos;")})'>
            ${t.name} (${t.masuk_wd}–${t.pulang_wd})
          </button>`).join('')}
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="sched-q" placeholder="Cari nama karyawan..."
          oninput="filterSchedule(this.value)" style="flex:1">
        <select class="table-filter" id="sched-shift" onchange="filterSchedule()">
          <option value="">Semua Shift</option>
          ${SHIFT_TEMPLATES.map(t=>`<option value="${t.code}">${t.name}</option>`).join('')}
        </select>
      </div>
      <div id="sched-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await loadSchedules();
}

async function loadSchedules() {
  try {
    const [scheds, emps] = await Promise.all([
      sbGet('work_schedules','select=*,employees(id,full_name,division,position)&order=created_at.desc').catch(()=>[]),
      sbGet('employees','select=id,full_name,division,position&status=eq.Aktif&order=full_name').catch(()=>[]),
    ]);
    scheduleAll     = Array.isArray(scheds) ? scheds : [];
    scheduleEmpList = Array.isArray(emps)   ? emps   : [];
    renderScheduleKPI();
    filterSchedule();
  } catch(e) {
    document.getElementById('sched-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderScheduleKPI() {
  const el = document.getElementById('sched-kpi'); if (!el) return;
  const active     = scheduleAll.filter(s=>s.is_active).length;
  const withRot    = scheduleAll.filter(s=>s.rotation_type&&s.rotation_type!=='none').length;
  const empWithSch = new Set(scheduleAll.filter(s=>s.employee_id).map(s=>s.employee_id)).size;
  const avgKap     = scheduleAll.length
    ? (scheduleAll.reduce((s,x)=>s+(calcKapFromSchedule(x)||7),0)/scheduleAll.length).toFixed(1) : '0';

  el.innerHTML = [
    {icon:'📋', val:scheduleAll.length, label:'Total Jadwal',       color:'#0891B2'},
    {icon:'✅', val:active,             label:'Jadwal Aktif',       color:'#22C55E'},
    {icon:'👥', val:empWithSch,         label:'Karyawan Terjadwal', color:'#7C3AED'},
    {icon:'🔄', val:withRot,            label:'Dengan Rotasi',      color:'#F59E0B'},
    {icon:'⏱', val:avgKap+'j',          label:'Rata-rata Kapasitas',color:'#06B6D4'},
  ].map(k=>`
    <div class="kpi-card" style="border-top:3px solid ${k.color}">
      <div class="kpi-icon" style="background:${k.color}18;font-size:18px">${k.icon}</div>
      <div><div class="kpi-val" style="font-size:20px">${k.val}</div>
      <div class="kpi-label">${k.label}</div></div>
    </div>`).join('');
}

function calcKapFromSchedule(s) {
  const masuk  = s.jam_masuk_weekday;
  const pulang = s.jam_pulang_weekday;
  if (!masuk || !pulang) return 7;
  const [mh,mm] = masuk.slice(0,5).split(':').map(Number);
  const [ph,pm] = pulang.slice(0,5).split(':').map(Number);
  let mins = (ph*60+pm) - (mh*60+mm);
  if (s.is_cross_midnight || mins <= 0) mins += 24*60;
  return Math.max(0, (mins/60) - 1);
}

function filterSchedule(q='') {
  const shift  = document.getElementById('sched-shift')?.value||'';
  const search = (q || document.getElementById('sched-q')?.value || '').toLowerCase();
  let data = [...scheduleAll];
  if (search) data = data.filter(s=>(s.employees?.full_name||'').toLowerCase().includes(search));
  if (shift)  data = data.filter(s=>s.shift_code===shift);
  renderScheduleTable(data);
}

function renderScheduleTable(data) {
  const el = document.getElementById('sched-tbody'); if (!el) return;
  if (!data.length) {
    el.innerHTML = `<div class="empty-state" style="padding:40px">
      <div class="ico">📅</div><h3>Belum ada jadwal kerja</h3>
      <p>Klik "+ Tambah Jadwal" atau "Import dari Template"</p>
      <button class="btn btn-teal" style="margin-top:14px" onclick="openScheduleForm()">+ Tambah Jadwal</button>
    </div>`; return;
  }

  const ROT_COLORS = {none:'var(--bg2)',weekly:'#EDE9FE',biweekly:'#FEF3C7'};

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        ${['KARYAWAN','SHIFT','WEEKDAY','SABTU','KAPASITAS/HARI','HARI KERJA','ROTASI','AKSI'].map(h=>`
          <th style="padding:9px 12px;background:var(--bg);font-size:11px;color:var(--text3);
            text-align:left;border-bottom:1px solid var(--border)">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${data.map((s,i)=>{
          const empName = s.employees?.full_name||'—';
          const hari    = (() => { try { return JSON.parse(s.hari_kerja||'[]'); } catch(e){ return []; } })();
          const kap     = calcKapFromSchedule(s).toFixed(1);
          const kapSab  = s.jam_masuk_sabtu && s.jam_pulang_sabtu
            ? calcKapFromSchedule({jam_masuk_weekday:s.jam_masuk_sabtu, jam_pulang_weekday:s.jam_pulang_sabtu, is_cross_midnight:false}).toFixed(1)
            : null;
          const rotLbl  = ROTATION_TYPES.find(r=>r.value===(s.rotation_type||'none'))?.label||'Tetap';
          return `
            <tr style="background:${i%2?'var(--bg2)':'#fff'};border-bottom:1px solid var(--border)">
              <td style="padding:10px 12px">
                <div style="font-weight:700;font-size:13px">${empName}</div>
                <div style="font-size:11px;color:var(--text3)">${s.employees?.division||''}</div>
              </td>
              <td style="padding:10px 12px">
                <div style="font-weight:600">${s.shift_name}</div>
                <span class="badge badge-teal" style="font-size:10px">${s.shift_code||'—'}</span>
              </td>
              <td style="padding:10px 12px;font-weight:700">
                ${s.jam_masuk_weekday?.slice(0,5)||'—'} – ${s.jam_pulang_weekday?.slice(0,5)||'—'}
              </td>
              <td style="padding:10px 12px">
                ${s.jam_masuk_sabtu
                  ? `<span style="font-size:12px">${s.jam_masuk_sabtu.slice(0,5)} – ${s.jam_pulang_sabtu?.slice(0,5)||'—'}</span>`
                  : '<span style="color:var(--text3);font-size:11px">OFF</span>'}
              </td>
              <td style="padding:10px 12px;text-align:center">
                <div style="font-size:15px;font-weight:800;color:var(--teal)">${kap}j</div>
                ${kapSab?`<div style="font-size:10px;color:var(--text3)">Sab: ${kapSab}j</div>`:''}
              </td>
              <td style="padding:10px 12px">
                <div style="display:flex;gap:2px;flex-wrap:wrap">
                  ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`
                    <span style="padding:2px 5px;border-radius:4px;font-size:10px;font-weight:700;
                      background:${hari.includes(d)?'var(--teal)':'var(--bg2)'};
                      color:${hari.includes(d)?'#fff':'var(--text3)'}">${DAYS_LABEL[d]}</span>`).join('')}
                </div>
              </td>
              <td style="padding:10px 12px">
                <div style="background:${ROT_COLORS[s.rotation_type||'none']};padding:3px 8px;
                  border-radius:6px;font-size:11px;font-weight:600">${rotLbl}</div>
              </td>
              <td style="padding:10px 12px">
                <div class="act-row">
                  <button class="act-btn edit" onclick="openScheduleForm(${s.id})">✏️</button>
                  <button class="act-btn del" onclick="deleteSchedule(${s.id},'${(empName||'').replace(/'/g,'').slice(0,20)}')">🗑</button>
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── FORM ──────────────────────────────────────────────────────
async function openScheduleForm(id=null) {
  let s = {};
  if (id) { const d=await sbGet('work_schedules',`select=*&id=eq.${id}`); s=d[0]||{}; }
  const hari = (() => { try { return JSON.parse(s.hari_kerja||'["Mon","Tue","Wed","Thu","Fri"]'); } catch(e){ return ['Mon','Tue','Wed','Thu','Fri']; } })();

  const empOpts = scheduleEmpList.map(e=>`
    <option value="${e.id}" ${s.employee_id==e.id?'selected':''}>${e.full_name} — ${e.division||'—'}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📅 ${id?'Edit':'Tambah'} Jadwal Shift</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Karyawan *</label>
        <select id="sf-emp"><option value="">-- Pilih --</option>${empOpts}</select>
      </div>
      <div class="form-group">
        <label>Kode Shift</label>
        <select id="sf-code">
          ${SHIFT_TEMPLATES.map(t=>`<option value="${t.code}" ${(s.shift_code||'P1')===t.code?'selected':''}>${t.code} — ${t.name}</option>`).join('')}
          <option value="CUSTOM" ${s.shift_code==='CUSTOM'?'selected':''}>CUSTOM</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Nama Shift *</label>
      <input type="text" id="sf-shift" value="${s.shift_name||''}">
    </div>

    <div class="section-label">Jam Kerja Senin–Jumat</div>
    <div class="form-row">
      <div class="form-group">
        <label>Jam Masuk *</label>
        <input type="time" id="sf-masuk-wd" value="${s.jam_masuk_weekday?.slice(0,5)||'09:00'}" oninput="calcSchedKapasitas()">
      </div>
      <div class="form-group">
        <label>Jam Pulang *</label>
        <input type="time" id="sf-pulang-wd" value="${s.jam_pulang_weekday?.slice(0,5)||'17:00'}" oninput="calcSchedKapasitas()">
      </div>
    </div>

    <div class="section-label">Jam Kerja Sabtu (kosongkan jika OFF)</div>
    <div class="form-row">
      <div class="form-group">
        <label>Jam Masuk Sabtu</label>
        <input type="time" id="sf-masuk-sb" value="${s.jam_masuk_sabtu?.slice(0,5)||''}" oninput="calcSchedKapasitas()">
        <div class="form-hint">Kosongkan jika Sabtu libur</div>
      </div>
      <div class="form-group">
        <label>Jam Pulang Sabtu</label>
        <input type="time" id="sf-pulang-sb" value="${s.jam_pulang_sabtu?.slice(0,5)||''}" oninput="calcSchedKapasitas()">
      </div>
    </div>

    <div class="form-group">
      <label>Lintas Tengah Malam (shift malam)?</label>
      <select id="sf-cross" onchange="calcSchedKapasitas()">
        <option value="false" ${!s.is_cross_midnight?'selected':''}>Tidak</option>
        <option value="true"  ${s.is_cross_midnight?'selected':''}>Ya</option>
      </select>
    </div>

    <div style="background:var(--teal-light);border-radius:var(--r);padding:10px 14px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--teal)">⏱ Kapasitas Harian</div>
      <div id="sched-kap-display" style="font-size:16px;font-weight:800;color:var(--teal)">—</div>
      <div id="sched-kap-detail" style="font-size:11px;color:var(--text3)"></div>
    </div>

    <div class="form-group">
      <label>Hari Kerja</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`
          <label id="day-lbl-${d}" style="display:flex;align-items:center;gap:4px;cursor:pointer;
            padding:5px 10px;border-radius:6px;transition:all .15s;
            border:1.5px solid ${hari.includes(d)?'var(--teal)':'var(--border)'};
            background:${hari.includes(d)?'var(--teal-light)':'var(--bg2)'}">
            <input type="checkbox" id="day-${d}" ${hari.includes(d)?'checked':''} style="display:none">
            <span id="day-txt-${d}" style="font-size:12px;font-weight:700;
              color:${hari.includes(d)?'var(--teal)':'var(--text3)'}">${DAYS_LABEL[d]}</span>
          </label>`).join('')}
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Tipe Rotasi</label>
        <select id="sf-rotation">
          ${ROTATION_TYPES.map(r=>`<option value="${r.value}" ${(s.rotation_type||'none')===r.value?'selected':''}>${r.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Primary Max (%)</label>
        <input type="number" id="sf-pct" value="${s.primary_max_pct||80}" min="50" max="95">
      </div>
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <input type="text" id="sf-notes" value="${s.notes||''}">
    </div>
    <div class="form-group">
      <label>Status</label>
      <select id="sf-active">
        <option value="true"  ${s.is_active!==false?'selected':''}>Aktif</option>
        <option value="false" ${s.is_active===false?'selected':''}>Non-Aktif</option>
      </select>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveSchedule(${id||'null'})">💾 Simpan</button>
    </div>`);

  // Wire day toggles
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{
    document.getElementById(`day-lbl-${d}`)?.addEventListener('click', ()=>{
      const cb  = document.getElementById(`day-${d}`);
      const lbl = document.getElementById(`day-lbl-${d}`);
      const txt = document.getElementById(`day-txt-${d}`);
      if (!cb||!lbl||!txt) return;
      cb.checked = !cb.checked;
      lbl.style.borderColor = cb.checked ? 'var(--teal)' : 'var(--border)';
      lbl.style.background  = cb.checked ? 'var(--teal-light)' : 'var(--bg2)';
      txt.style.color       = cb.checked ? 'var(--teal)' : 'var(--text3)';
    });
  });
  calcSchedKapasitas();
}

function calcSchedKapasitas() {
  const masuk  = document.getElementById('sf-masuk-wd')?.value;
  const pulang = document.getElementById('sf-pulang-wd')?.value;
  const masukSb= document.getElementById('sf-masuk-sb')?.value;
  const pulangSb=document.getElementById('sf-pulang-sb')?.value;
  const cross  = document.getElementById('sf-cross')?.value === 'true';
  const pct    = parseInt(document.getElementById('sf-pct')?.value||80);
  const disp   = document.getElementById('sched-kap-display');
  const detail = document.getElementById('sched-kap-detail');
  if (!masuk||!pulang||!disp) return;

  const calcKap = (m, p, cr) => {
    if (!m||!p) return null;
    const [mh,mm] = m.split(':').map(Number);
    const [ph,pm] = p.split(':').map(Number);
    let mins = (ph*60+pm)-(mh*60+mm);
    if (cr||mins<=0) mins += 24*60;
    return Math.max(0,(mins/60)-1);
  };

  const kapWd   = calcKap(masuk,pulang,cross);
  const kapSb   = calcKap(masukSb,pulangSb,false);
  const priMaxWd= (kapWd*(pct/100)).toFixed(1);

  disp.textContent = `${kapWd?.toFixed(1)||'?'}j/hari${kapSb?` · Sabtu: ${kapSb.toFixed(1)}j`:''}`;
  detail.textContent= `Primary max: ${priMaxWd}j · Secondary: ${(kapWd*(1-pct/100)).toFixed(1)}j`;
}

function applyShiftTemplate(tpl) {
  if (document.getElementById('sf-shift'))   document.getElementById('sf-shift').value   = tpl.name;
  if (document.getElementById('sf-code'))    document.getElementById('sf-code').value    = tpl.code;
  if (document.getElementById('sf-masuk-wd')) document.getElementById('sf-masuk-wd').value = tpl.masuk_wd;
  if (document.getElementById('sf-pulang-wd'))document.getElementById('sf-pulang-wd').value= tpl.pulang_wd;
  if (document.getElementById('sf-masuk-sb')) document.getElementById('sf-masuk-sb').value = tpl.masuk_sb||'';
  if (document.getElementById('sf-pulang-sb'))document.getElementById('sf-pulang-sb').value= tpl.pulang_sb||'';
  if (document.getElementById('sf-cross'))   document.getElementById('sf-cross').value   = tpl.cross?'true':'false';
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{
    const cb  = document.getElementById(`day-${d}`);
    const lbl = document.getElementById(`day-lbl-${d}`);
    const txt = document.getElementById(`day-txt-${d}`);
    if (!cb||!lbl||!txt) return;
    cb.checked = tpl.hari.includes(d);
    lbl.style.borderColor = cb.checked?'var(--teal)':'var(--border)';
    lbl.style.background  = cb.checked?'var(--teal-light)':'var(--bg2)';
    txt.style.color       = cb.checked?'var(--teal)':'var(--text3)';
  });
  calcSchedKapasitas();
}

async function saveSchedule(id) {
  const empId   = document.getElementById('sf-emp')?.value;
  const shift   = document.getElementById('sf-shift')?.value.trim();
  const masukWd = document.getElementById('sf-masuk-wd')?.value;
  const pulangWd= document.getElementById('sf-pulang-wd')?.value;
  if (!empId)     { toast('Pilih karyawan','err'); return; }
  if (!shift)     { toast('Nama shift wajib','err'); return; }
  if (!masukWd||!pulangWd) { toast('Jam weekday wajib diisi','err'); return; }

  const hari = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter(d=>document.getElementById(`day-${d}`)?.checked);
  if (!hari.length) { toast('Pilih minimal 1 hari kerja','err'); return; }

  const masukSb = document.getElementById('sf-masuk-sb')?.value||null;
  const pulangSb= document.getElementById('sf-pulang-sb')?.value||null;

  const payload = {
    employee_id:       parseInt(empId),
    shift_name:        shift,
    shift_code:        document.getElementById('sf-code')?.value||'P1',
    // Legacy columns — fill defensively in case NOT NULL constraint still exists
    jam_masuk:         masukWd,
    jam_pulang:        pulangWd,
    jam_masuk_weekday: masukWd,
    jam_pulang_weekday:pulangWd,
    jam_masuk_sabtu:   masukSb,
    jam_pulang_sabtu:  pulangSb,
    is_cross_midnight: document.getElementById('sf-cross')?.value==='true',
    hari_kerja:        JSON.stringify(hari),
    primary_max_pct:   parseInt(document.getElementById('sf-pct')?.value||80),
    rotation_type:     document.getElementById('sf-rotation')?.value||'none',
    notes:             document.getElementById('sf-notes')?.value.trim()||null,
    is_active:         document.getElementById('sf-active')?.value==='true',
    created_by:        getUserName?getUserName():'User',
    updated_at:        new Date().toISOString(),
  };

  try {
    if (id) await sbPatch('work_schedules',id,payload);
    else    await sbPost('work_schedules',{...payload,created_at:new Date().toISOString()});
    toast('✅ Jadwal disimpan','ok');
    closeModalForce();
    await loadSchedules();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteSchedule(id, name) {
  if (!confirm(`Hapus jadwal ${name}?`)) return;
  try { await sbDelete('work_schedules',id); toast('🗑 Dihapus','info'); await loadSchedules(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// Import dari data Excel
async function seedScheduleFromExcel() {
  const seed = [
    {name:'Ace Darojatun Anwar',  shift:'OH – Office Hr', code:'OH'},
    {name:'dr. Laras Sheila Andini',shift:'OH – Office Hr', code:'OH'},
    {name:'Farenty',              shift:'P1 – Shift 1',   code:'P1'},
    {name:'Nurul',                shift:'P2 – Shift 2',   code:'P2', rotation:'weekly'},
    {name:'Faiz Prasetyo',        shift:'P1 – Shift 1',   code:'P1', rotation:'weekly'},
    {name:'Hilmi',                shift:'P1 – Shift 1',   code:'P1', rotation:'weekly'},
    {name:'Prayitno',             shift:'P3 – Shift 3',   code:'P3'},
    {name:'Dado',                 shift:'P2 – Shift 2',   code:'P2'},
    {name:'Reza',                 shift:'P1 – Shift 1',   code:'P1'},
  ];
  const emps = scheduleEmpList;
  let added=0, skipped=0;
  const user = getUserName?getUserName():'System';

  for (const item of seed) {
    const emp = emps.find(e=>e.full_name.toLowerCase().includes(item.name.toLowerCase().split(' ')[0]));
    if (!emp) { skipped++; continue; }
    const tpl = SHIFT_TEMPLATES.find(t=>t.code===item.code)||SHIFT_TEMPLATES[0];
    const hari= tpl.hari||['Mon','Tue','Wed','Thu','Fri'];
    const ex  = scheduleAll.find(s=>s.employee_id===emp.id);
    if (ex)   { skipped++; continue; }

    await sbPost('work_schedules',{
      employee_id:        emp.id,
      shift_name:         tpl.name,
      shift_code:         item.code,
      jam_masuk_weekday:  tpl.masuk_wd,
      jam_pulang_weekday: tpl.pulang_wd,
      jam_masuk_sabtu:    tpl.masuk_sb||null,
      jam_pulang_sabtu:   tpl.pulang_sb||null,
      is_cross_midnight:  tpl.cross||false,
      hari_kerja:         JSON.stringify(hari),
      primary_max_pct:    80,
      rotation_type:      item.rotation||'none',
      is_active:          true,
      created_by:         user,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    }).catch(()=>{ skipped++; });
    added++;
  }
  toast(`✅ ${added} jadwal diimport dari template Excel, ${skipped} dilewati`,'ok');
  await loadSchedules();
}

// ── Helper: get schedule for current user ─────────────────────
async function getMySchedule() {
  const user = getUserName?getUserName():'';
  try {
    const emps = await sbGet('employees',`select=id&full_name=eq.${encodeURIComponent(user)}&limit=1`);
    if (!emps?.length) return null;
    const scheds = await sbGet('work_schedules',
      `select=*&employee_id=eq.${emps[0].id}&is_active=eq.true&limit=1`);
    return scheds?.[0]||null;
  } catch(e) { return null; }
}


// ═══════════════════════════════════════════════════════════════
// CALENDAR SHIFT VIEW
// ═══════════════════════════════════════════════════════════════

let calendarState = {
  year:  new Date().getFullYear(),
  month: new Date().getMonth(),
  selectedEmp: null,
  selectedEmpName: '',
  assignments: {},
  defaultShift: 'P1',
};

let activeCalShift = 'P1';

const SHIFT_COLORS_CAL = {P1:'#0891B2',P2:'#7C3AED',P3:'#059669',OH:'#F59E0B',ML:'#1E293B',OFF:'#EF4444',C:'#8B5CF6',S:'#F59E0B',I:'#6B7280'};

async function renderShiftCalendar() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>📅 Kalender Shift</h1><p>Klik tanggal → set shift. Pilih shift dulu di panel atas. Simpan otomatis menambahkan karyawan ke Daftar Jadwal jika belum ada.</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderWorkSchedule()">← Daftar</button>
        <button class="btn btn-teal btn-sm" onclick="seedOKRTasks()">📥 Import OKR Tasks (164)</button>
        <button class="btn btn-teal" onclick="saveCalendarShifts()">💾 Simpan</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:220px 1fr;gap:16px">
      <div class="card" style="height:fit-content">
        <div class="card-title" style="margin-bottom:10px">👥 Karyawan</div>
        <div id="cal-emp-list"><div class="spinner"></div></div>
      </div>
      <div>
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <button class="btn btn-ghost btn-sm" onclick="calShiftMonth(-1)">← Prev</button>
            <div id="cal-month-label" style="font-weight:800;font-size:15px"></div>
            <button class="btn btn-ghost btn-sm" onclick="calShiftMonth(1)">Next →</button>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
            ${SHIFT_TEMPLATES.map(t=>`
              <button id="cal-btn-${t.code}" class="btn btn-sm btn-ghost" onclick="setCalShift('${t.code}')">${t.code}</button>`).join('')}
            <button id="cal-btn-OFF" class="btn btn-sm btn-ghost" onclick="setCalShift('OFF')" style="color:#EF4444">OFF</button>
            <button id="cal-btn-C" class="btn btn-sm btn-ghost" onclick="setCalShift('C')" style="color:#8B5CF6">CUTI</button>
            <button id="cal-btn-S" class="btn btn-sm btn-ghost" onclick="setCalShift('S')" style="color:#F59E0B">SAKIT</button>
            <button id="cal-btn-I" class="btn btn-sm btn-ghost" onclick="setCalShift('I')" style="color:#6B7280">IZIN</button>
          </div>
          <div id="cal-active-info" style="font-size:12px;color:var(--text3);margin-bottom:12px">
            Pilih shift di atas, lalu klik tanggal
          </div>
          <div id="cal-grid"></div>
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:10px">⚡ Isi Cepat</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${SHIFT_TEMPLATES.map(t=>`
              <button class="btn btn-ghost btn-sm" onclick="fillWeekdays('${t.code}')">Weekday → ${t.code}</button>`).join('')}
            <button class="btn btn-danger btn-sm" onclick="clearCalMonth()">🗑 Clear Bulan</button>
          </div>
        </div>
      </div>
    </div>`;
  // Always reload fresh — this page can be reached directly (rail icon, back/forward)
  // without having visited the Jadwal Kerja list page first, which would otherwise
  // leave scheduleAll/scheduleEmpList empty and make saved schedules appear missing.
  await loadSchedules();
  renderCalEmpList();
  renderCalGrid();
}

function setCalShift(code) {
  activeCalShift = code;
  document.querySelectorAll('[id^="cal-btn-"]').forEach(b => {
    const c = b.id.replace('cal-btn-','');
    const col = SHIFT_COLORS_CAL[c]||'var(--teal)';
    b.style.background = c===code ? col : '';
    b.style.color      = c===code ? '#fff' : '';
    b.style.borderColor= c===code ? col : '';
  });
  const el = document.getElementById('cal-active-info');
  if (el) el.innerHTML = `<span style="color:${SHIFT_COLORS_CAL[code]||'var(--teal)'};font-weight:700">✓ Aktif: ${code}</span> — klik tanggal untuk set`;
}

function renderCalEmpList() {
  const el = document.getElementById('cal-emp-list'); if (!el) return;
  if (!scheduleEmpList.length) { el.innerHTML='<div style="font-size:12px;color:var(--text3)">Data karyawan belum dimuat</div>'; return; }
  el.innerHTML = scheduleEmpList.map(emp => `
    <div onclick="selectCalEmp(${emp.id},'${emp.full_name.replace(/'/g,'').replace(/"/g,'')}')"
      style="padding:8px 10px;border-radius:var(--r);cursor:pointer;margin-bottom:4px;transition:all .15s;
        border:1.5px solid ${calendarState.selectedEmp===emp.id?'var(--teal)':'var(--border)'};
        background:${calendarState.selectedEmp===emp.id?'var(--teal-light)':'#fff'}">
      <div style="font-size:12px;font-weight:${calendarState.selectedEmp===emp.id?700:600};color:${calendarState.selectedEmp===emp.id?'var(--teal)':'var(--text)'}">${emp.full_name.split(' ').slice(0,2).join(' ')}</div>
      <div style="font-size:10px;color:var(--text3)">${emp.position||emp.division||''}</div>
    </div>`).join('');
}

async function selectCalEmp(empId, empName) {
  calendarState.selectedEmp     = empId;
  calendarState.selectedEmpName = empName;
  const y = calendarState.year, m = calendarState.month;
  const startDate = `${y}-${String(m+1).padStart(2,'0')}-01`;
  const lastDay   = new Date(y, m+1, 0).getDate(); // actual last day of this month (28-31)
  const endDate   = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  try {
    const recs = await sbGet('attendance',`select=tanggal,shift_code,leave_type&employee_id=eq.${empId}&tanggal=gte.${startDate}&tanggal=lte.${endDate}`);
    calendarState.assignments = {};
    (recs||[]).forEach(r => { calendarState.assignments[r.tanggal] = r.leave_type??(r.shift_code||'P1'); });
  } catch(e) {
    calendarState.assignments = {};
    toast('⚠️ Gagal load data shift: tabel attendance mungkin belum di-migrate. Jalankan supabase_attendance.sql di Supabase SQL Editor.', 'warn', 6000);
    console.error('[selectCalEmp] Query failed:', e);
  }
  renderCalEmpList();
  renderCalGrid();
}

function renderCalGrid() {
  const el = document.getElementById('cal-grid'); if (!el) return;
  const y = calendarState.year, m = calendarState.month;
  const monthStr = new Date(y,m,1).toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  const mlEl = document.getElementById('cal-month-label');
  if (mlEl) mlEl.textContent = monthStr;

  const firstDay    = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const DAY_NAMES   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const startOffset = firstDay; // Sun=0

  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center">';
  DAY_NAMES.forEach(d => { html += `<div style="font-size:11px;font-weight:700;color:var(--text3);padding:4px 0;border-bottom:1px solid var(--border)">${d}</div>`; });
  for (let i=0; i<startOffset; i++) html += '<div></div>';

  const todayStr = new Date().toISOString().split('T')[0];
  for (let d=1; d<=daysInMonth; d++) {
    const dt      = new Date(y,m,d);
    const dayKey  = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow     = dt.getDay();
    const isWeekend = dow===0||dow===6;
    const asgn    = calendarState.assignments[dayKey];
    const bgColor = asgn ? (SHIFT_COLORS_CAL[asgn]||'#94A3B8') : (isWeekend?'#F8FAFC':'transparent');
    const txtColor= asgn ? '#fff' : (isWeekend?'#CBD5E1':'var(--text)');
    const border  = dayKey===todayStr ? '2px solid var(--teal)' : '1.5px solid #E2E8F0';
    html += `<div onclick="calClickDate('${dayKey}')"
      style="padding:6px 2px;border-radius:6px;cursor:pointer;transition:all .15s;
        border:${border};background:${bgColor};color:${txtColor};font-size:11px;
        min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center"
      onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">
      <div style="font-weight:${asgn?700:400}">${d}</div>
      <div style="font-size:9px;margin-top:1px">${asgn||''}</div>
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

function calClickDate(dateStr) {
  if (!calendarState.selectedEmp) { toast('Pilih karyawan dulu','warn'); return; }
  if (calendarState.assignments[dateStr] === activeCalShift) {
    delete calendarState.assignments[dateStr];
  } else {
    calendarState.assignments[dateStr] = activeCalShift;
  }
  renderCalGrid();
}

function calShiftMonth(dir) {
  calendarState.month += dir;
  if (calendarState.month > 11) { calendarState.month=0; calendarState.year++; }
  if (calendarState.month < 0)  { calendarState.month=11; calendarState.year--; }
  if (calendarState.selectedEmp) selectCalEmp(calendarState.selectedEmp, calendarState.selectedEmpName);
  else renderCalGrid();
}

function fillWeekdays(code) {
  if (!calendarState.selectedEmp) { toast('Pilih karyawan dulu','warn'); return; }
  const y=calendarState.year, m=calendarState.month;
  const days = new Date(y,m+1,0).getDate();
  for (let d=1; d<=days; d++) {
    const dt  = new Date(y,m,d);
    const dow = dt.getDay();
    if (dow>0 && dow<6) {
      const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      calendarState.assignments[key] = code;
    }
  }
  renderCalGrid();
  toast(`Weekday set ke ${code}`,'ok',1500);
}

function clearCalMonth() {
  if (!confirm('Clear semua assignment bulan ini?')) return;
  calendarState.assignments = {};
  renderCalGrid();
}

async function saveCalendarShifts() {
  if (!calendarState.selectedEmp) { toast('Pilih karyawan dulu','warn'); return; }
  const empId   = calendarState.selectedEmp;
  const empName = calendarState.selectedEmpName;
  const entries = Object.entries(calendarState.assignments);
  if (!entries.length) { toast('Tidak ada data untuk disimpan','warn'); return; }

  toast(`⏳ Menyimpan ${entries.length} tanggal...`,'info',3000);

  // Batch fetch ALL existing records for this employee+month in ONE query,
  // instead of one query per date (this was the main cause of slowness).
  const y = calendarState.year, m = calendarState.month;
  const startDate = `${y}-${String(m+1).padStart(2,'0')}-01`;
  const lastDay   = new Date(y, m+1, 0).getDate();
  const endDate   = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  let existingMap = {};
  try {
    const existing = await sbGet('attendance',
      `select=id,tanggal&employee_id=eq.${empId}&tanggal=gte.${startDate}&tanggal=lte.${endDate}`);
    (existing||[]).forEach(r => { existingMap[r.tanggal] = r.id; });
  } catch(e) {
    toast(`❌ Gagal membaca data existing: ${e.message} — kemungkinan tabel attendance belum di-migrate, jalankan supabase_attendance.sql`, 'err', 7000);
    console.error('[saveCalendarShifts] Batch fetch failed:', e);
    return;
  }

  // Write all dates in parallel instead of sequential await-in-loop.
  const leaveMap = {C:'Cuti',S:'Sakit',I:'Izin'};
  const results = await Promise.allSettled(entries.map(([date, shift]) => {
    const isLeave = ['C','S','I'].includes(shift);
    const payload = {
      employee_id:   empId,
      employee_name: empName,
      tanggal:       date,
      shift_code:    isLeave ? null : shift,
      leave_type:    isLeave ? leaveMap[shift] : null,
      updated_at:    new Date().toISOString(),
    };
    const existingId = existingMap[date];
    return existingId
      ? sbPatch('attendance', existingId, payload)
      : sbPost('attendance', {...payload, created_at: new Date().toISOString()});
  }));

  const saved = results.filter(r => r.status==='fulfilled').length;
  const errs  = results.filter(r => r.status==='rejected');
  if (errs.length) console.error('[saveCalendarShifts] Failed dates:', errs.map(e=>e.reason?.message));

  if (errs.length && saved === 0) {
    toast(`❌ Gagal simpan semua (${errs.length} tanggal). Error: ${errs[0]?.reason?.message||'unknown'}`, 'err', 7000);
  } else {
    toast(`✅ ${saved} tanggal disimpan${errs.length?` · ${errs.length} gagal`:''}`, errs.length?'warn':'ok');
  }

  // Always refresh from DB after saving — this is the actual source of truth.
  // Without this, the grid kept showing local state even when a save failed,
  // which looked like "data lama masih ke-record" even after a successful click.
  await selectCalEmp(empId, empName);

  // Bridge to Daftar Jadwal (work_schedules) — without this, saving shifts here
  // never shows up in the schedule list page because they're two separate tables
  // with no link between them. Auto-create a work_schedules row using the most
  // common shift code from what was just saved, only if the employee doesn't
  // already have an active schedule entry.
  if (saved > 0) {
    try {
      const hasSchedule = await sbGet('work_schedules',
        `select=id&employee_id=eq.${empId}&is_active=eq.true&limit=1`);
      if (!hasSchedule?.length) {
        const codeCounts = {};
        entries.forEach(([,shift]) => {
          if (!['C','S','I','OFF'].includes(shift)) codeCounts[shift] = (codeCounts[shift]||0)+1;
        });
        const topCode = Object.entries(codeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
        const tmpl = SHIFT_TEMPLATES.find(t=>t.code===topCode);
        if (tmpl) {
          await sbPost('work_schedules', {
            employee_id: empId,
            shift_name:  tmpl.name,
            jam_masuk:   tmpl.masuk_wd,
            jam_pulang:  tmpl.pulang_wd,
            is_cross_midnight: !!tmpl.cross,
            hari_kerja:  JSON.stringify(tmpl.hari),
            is_active:   true,
            notes:       'Auto-generated dari Kalender Shift',
            created_by:  getUserName?getUserName():'System',
          });
          toast(`📋 ${empName} otomatis ditambahkan ke Daftar Jadwal (${tmpl.name})`, 'info', 4000);
        }
      }
    } catch(e) {
      console.error('[saveCalendarShifts] Bridge to work_schedules failed:', e);
      // Non-fatal — calendar save itself already succeeded, this is a secondary convenience step
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// OKR TASKS SEED
// ═══════════════════════════════════════════════════════════════

const OKR_SEED_TASKS = [{"title": "Menyusun, mereview, dan memastikan eksekusi OKR perusahaan setiap kuartal", "sub_category": "Strategic Planning", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Memimpin Squad Meeting Operations dan memastikan dokumentasi (deck, SOP, RAB) selalu update", "sub_category": "Strategic Planning", "category": "Admin", "type": "PRIMARY", "assigned_to": "Bhisma", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Approval lab rujukan sampel bersama Nakes Operations", "sub_category": "Strategic Planning", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Mengawasi project Klinik & Lab Utama (regulatory approval, infrastruktur, staffing plan)", "sub_category": "Strategic Planning", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Melakukan supervisi harian terhadap seluruh tim Klinik (Dokter, Perawat, Analis, Security, Cleaning Service, Kurir, Finance)", "sub_category": "People & Operations Management", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "Tugas tambahan terkait pembentukan struktur klinik baru", "priority": "Normal"}, {"title": "Menyusun jadwal kerja (shift) seluruh personil klinik dan memastikan kehadiran sesuai jadwal", "sub_category": "People & Operations Management", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan evaluasi kinerja bulanan untuk seluruh SDM operasional (Perawat, Analis, Security, CS, Kurir)", "sub_category": "People & Operations Management", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memastikan kepatuhan terhadap SOP klinik & lab, termasuk K3 dan standar mutu laboratorium", "sub_category": "Compliance & Quality", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan audit internal berkala terhadap operasional klinik (kebersihan, keamanan, alur layanan pasien)", "sub_category": "Compliance & Quality", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengelola hubungan dengan vendor alat medis, BHP, dan supplier kebutuhan klinik", "sub_category": "Vendor & Procurement", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "CS berkoordinasi dengan Dokter in house untuk dibuatkan resume medis pasien setelah menerima hasil lab test", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Dokter membuatkan resume medis pasien", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Dokter melakukan layanan telemedicine sesuai jadwal yang sudah dikonfirmasi oleh CS dan Pasien", "sub_category": "Telemedicine", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Bertindak sebagai Dokter Penanggung Jawab (PJ) klinik sesuai persyaratan perizinan fasyankes", "sub_category": "Penanggung Jawab Klinik", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan pemeriksaan, diagnosis, dan tata laksana pasien yang datang ke klinik", "sub_category": "Pelayanan Medis", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memvalidasi dan menandatangani hasil pemeriksaan laboratorium serta resume medis pasien", "sub_category": "Pelayanan Medis", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan supervisi terhadap tindakan keperawatan dan flebotomi yang dilakukan oleh Perawat dan Analis", "sub_category": "Supervisi Klinis", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memastikan ketersediaan dan penggunaan obat-obatan/alat medis sesuai standar dan regulasi yang berlaku", "sub_category": "Compliance", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan tindakan keperawatan dasar (pengukuran tanda vital, EKG, dll) sesuai instruksi dokter", "sub_category": "Pelayanan Keperawatan", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Membantu dokter dalam tindakan medis dan mempersiapkan ruang pemeriksaan/peralatan medis", "sub_category": "Pelayanan Keperawatan", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan triase awal terhadap pasien yang datang ke klinik", "sub_category": "Pelayanan Keperawatan", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mencatat dan mendokumentasikan rekam medis pasien dengan lengkap dan akurat", "sub_category": "Administrasi Medis", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengelola inventory obat-obatan dan alat kesehatan di klinik, termasuk monitoring stok dan masa kadaluarsa", "sub_category": "Manajemen Obat & Alat", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memastikan kelengkapan dan keberlakuan STR (Surat Tanda Registrasi) dan SIP (Surat Izin Praktik) sesuai lokasi praktik klinik", "sub_category": "Legal & Perizinan", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "Syarat utama izin operasional klinik", "priority": "Normal"}, {"title": "Bertanggung jawab sebagai penanggung jawab teknis dalam pengurusan izin operasional klinik dan izin laboratorium ke Dinas Kesehatan setempat", "sub_category": "Legal & Perizinan", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memastikan dokumen perizinan (izin klinik, izin lab, sertifikat alat) selalu update dan tidak ada yang kadaluarsa", "sub_category": "Legal & Perizinan", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengidentifikasi dan menangani kondisi kegawatdaruratan pasien sesuai SOP Basic Life Support (BLS)", "sub_category": "Kegawatdaruratan", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menyiapkan dan memastikan ketersediaan emergency kit/obat emergency selalu lengkap dan tidak kadaluarsa", "sub_category": "Kegawatdaruratan", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan rujukan pasien ke RS terdekat jika kondisi pasien di luar kapasitas penanganan klinik, termasuk menyiapkan surat rujukan", "sub_category": "Rujukan Eksternal", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menyusun dan memastikan daftar kontak RS rujukan terdekat beserta nomor ambulans tersedia dan mudah diakses", "sub_category": "Rujukan Eksternal", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Hasil MCU Walk-In akan dikirim paling lambat H+3 setelah MCU", "sub_category": "MCU Walk-in", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Hasil MCU akan dikirim kirim menggunakan Map Plebo", "sub_category": "MCU Walk-in", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS berkoordinasi dengan Nakes Operations untuk menentukan jadwal home service", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS akan mengupdate status pemesanan yang berlangsung di WAG Operations", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Setelah mendapatkan konfirmasi pembayaran dari CS, Nakes Operations akan mengatur jadwal nakes yang bertugas ke rumah pasien sesuai dengan waktu booking yang telah ditentukan", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ayu", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations wajib memeriksa ketersediaan barang nakes yang bertugas", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Sita", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations merekap data nakes yang bertugas di tracker nakes", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Sita", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations berkoordinasi dengan Head of Operations untuk menentukan lab rujukan sampel", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Setelah mendapat approval, Nakes Operations akan berkoordinasi dengan Lab Rekanan yang akan menerima sampe rujukan", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations akan mengirim kurir untuk mengambil sampel dari nakes yang bertugas mengambil sampel", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS memonitor status order melalui WhatsApp Group yang terdiri dari:", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations memastikan perlengkapan nakes sudah lengkap dan sesuai dengan jenis pemeriksaan yang diminta oleh pasien", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Apabila nakes yang ditunjuk tidak bisa ditugaskan, Nakes Operations akan mencari pengganti nakes lain atau menjadi nakes yang bertugas melakukan pengambilan sampel ke rumah pasien", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes tiba di rumah pasien sesuai jadwal dan melakukan prosedur pengambilan sampel sesuai dengan SOP Tenaga Kesehatan", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes menyerahkan sampel ke kurir dan dilanjutkan untuk dikirim ke lab rekanan untuk pemeriksaan sampel", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations memastikan hasil lab tes sudah keluar paling lama H+1 setelah sampel diterima oleh lab", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Jika ada hasil lab keluar lebih dari H+1 hari kalender, Nakes Operations akan menginformasikan ke CS untuk diteruskan ke pasien", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations melakukan stock opname setiap hari pertama di minggu berikutnya (Senin).", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS menerima notifikasi permintaan home service melalui telegram rujukan dokter atau dari Klinik Pintar", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS-Ops menerima notifikasi permintaan pick up sampel immunology", "sub_category": "KSO Immunology", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS-Ops menugaskan kurur untuk melakukan pick up sampel", "sub_category": "KSO Immunology", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations menyiapkan tenaga medis untuk kebutuhan home service", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Melakukan pemeriksaan sampel laboratorium (hematologi, kimia klinik, imunologi, dll) sesuai SOP laboratorium", "sub_category": "Pemeriksaan Laboratorium", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menginput dan memvalidasi hasil pemeriksaan laboratorium ke sistem sebelum diteruskan ke dokter untuk validasi akhir", "sub_category": "Pelaporan Hasil", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengelola stok reagen dan Barang Habis Pakai (BHP) laboratorium serta melakukan permintaan restock saat diperlukan", "sub_category": "Manajemen BHP Lab", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan pengambilan sampel darah (flebotomi) pasien sesuai SOP dan standar keselamatan", "sub_category": "Phlebotomy", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Berkoordinasi dengan Nakes (perawat/analis) dan Kurir terkait jadwal home service dan pengambilan/pengiriman sampel", "sub_category": "Koordinasi Nakes & Kurir", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Melakukan koordinasi dan proses pembayaran fee Nakes serta fee marketing sesuai SLA yang berlaku", "sub_category": "Koordinasi Pembayaran", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Melakukan monitoring availability nakes dan memastikan kehadiran nakes maksimal 15 menit sebelum jadwal", "sub_category": "Koordinasi Operasional", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Melakukan pelaporan limbah B3 (limbah medis) ke instansi terkait (DLH/Dinas Kesehatan) sesuai jadwal yang ditentukan, berkoordinasi dengan Cleaning Service", "sub_category": "Pelaporan Regulasi", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melaporkan hasil pemeriksaan penyakit menular tertentu (notifiable diseases) ke Dinas Kesehatan sesuai ketentuan yang berlaku, atas validasi Dokter PJ", "sub_category": "Pelaporan Regulasi", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menyimpan dan mengarsipkan dokumen hasil pemeriksaan laboratorium sesuai masa retensi yang dipersyaratkan regulasi", "sub_category": "Pelaporan Regulasi", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Finance Operations berkoordinasi dengan partnership untuk fasyankes rujukan walk-in dengan detail berikut:", "sub_category": "MCU Walk-in", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "Finance membuat WAG untuk koordinasi permintaan MCU Walk-In", "sub_category": "MCU Walk-in", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "Finance Operations melakukan rekap pada akhir bulan dan akan mengirimkan invoice paling lambat tanggal 5 hari kalender", "sub_category": "MCU Walk-in", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "Finance Operations akan melakukan reminder paling telat 7 hari kalender sebelum overdue", "sub_category": "MCU Walk-in", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "CS berkoordinasi dengan Financial Operations untuk dibuatkan link pembayaran", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "Link pembayaran harus diberikan ke CS maksimal 5 menit setelah pemesanan dikonfirmasi oleh CS", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "Setelah mendapatkan konfirmasi pembayaran dari CS, Nakes Operations akan mengatur jadwal nakes yang bertugas ke rumah pasien sesuai dengan waktu booking yang telah ditentukan", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "Nakes Operations wajib memeriksa ketersediaan barang nakes yang bertugas", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "Nakes Operations merekap data nakes yang bertugas di tracker nakes", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "CS berkoordinasi dengan FinOps untuk pembuatan link pembayaran", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "CS merekap detail pemesanan dalam tracker master order B2B2C dan menandai source customer sebagai \"Rujukan Dokter/Rujukan KP\"", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "PIC existing Ayu/Sita - dapat dialihkan ke Liza sesuai struktur baru", "priority": "Normal"}, {"title": "Mengelola kas operasional klinik harian (petty cash) termasuk pencatatan pengeluaran operasional klinik", "sub_category": "Pengelolaan Kas & Pembayaran", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memproses penggajian/fee untuk seluruh personil klinik (Dokter, Perawat, Analis, Security, Cleaning Service, Kurir) tepat waktu", "sub_category": "Penggajian & Fee", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menyusun laporan keuangan operasional klinik bulanan untuk manajemen", "sub_category": "Pelaporan Keuangan", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melanjutkan pengelolaan AR aging dan AP cycle sesuai target OKR (AR>90 hari <3%, AP cycle 45 hari)", "sub_category": "AR/AP Management", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS mengkonfirmasi pemesanan pasien melalui WhatsApp Plebo atau Pancake dengan format sebagai berikut:", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations akan mengirim kurir untuk mengambil sampel dari nakes yang bertugas mengambil sampel", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes menyerahkan sampel ke kurir dan dilanjutkan untuk dikirim ke lab rekanan untuk pemeriksaan sampel", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Kurir akan mengantar sample ke lab (Immunolgy/Rujukan Dokter/Rujukan KP)", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Kurir melakukan serah terima sampel dengan pihak lab dan memastikan pihak penerima sign form serah terima sampel", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "09.00 - 11.30: Otw and pick up sample nearby RS Brawijaya Tangerang (Kode B) - Kurir wajib menyerahkan Form Serah Terima Sampel (FSTS) ketika melakukan pick up sampel", "sub_category": "Jadwal Pick Up Sample", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "11.30 - 12.00: On the way to RS Brawijaya Tangerang + Drop Sample (Kode C) - Kurir wajib mengupdate lokasi ketika dalam perjalanan ke Lab", "sub_category": "Jadwal Pick Up Sample", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "12.00 - 13.00: Break", "sub_category": "Jadwal Pick Up Sample", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "13.00 - 14.00: Back to RS Brawijaya Duren Tiga (Kode D)", "sub_category": "Jadwal Pick Up Sample", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "14.30 - 17.00: Otw and pick up sample nearby RS Brawijaya Tangerang (Kode B)", "sub_category": "Jadwal Pick Up Sample", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "17.30 - 18.00: On the way to RS Brawijaya Tangerang + Drop Sample (Kode C)", "sub_category": "Jadwal Pick Up Sample", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Menjaga keamanan area klinik selama jam operasional, termasuk membuka/menutup akses klinik di awal dan akhir hari", "sub_category": "Keamanan Klinik", "category": "Admin", "type": "PRIMARY", "assigned_to": "Dado", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menjadi first responder dalam situasi darurat (kebakaran, gangguan keamanan) dan berkoordinasi dengan pihak terkait", "sub_category": "Penanganan Darurat", "category": "Admin", "type": "PRIMARY", "assigned_to": "Dado", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan disinfeksi rutin pada area dan peralatan yang berisiko tinggi (ruang periksa, alat flebotomi, dll)", "sub_category": "Kebersihan Klinik", "category": "Admin", "type": "PRIMARY", "assigned_to": "Prayitno", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengelola dan membuang limbah medis (limbah B3) sesuai SOP dan regulasi pengelolaan limbah medis", "sub_category": "Manajemen Limbah", "category": "Admin", "type": "PRIMARY", "assigned_to": "Prayitno", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memastikan ketersediaan perlengkapan kebersihan dan kebutuhan dasar klinik (sabun, tisu, dll)", "sub_category": "Inventory Kebersihan", "category": "Admin", "type": "PRIMARY", "assigned_to": "Prayitno", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan pick up dan pengiriman sampel ke laboratorium rujukan sesuai jadwal yang telah ditentukan", "sub_category": "Pengambilan & Pengiriman Sampel", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Mengantarkan hasil MCU/lab dan dokumen invoice (hard copy) ke klien sesuai SLA yang berlaku", "sub_category": "Pengiriman Hasil & Dokumen", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Menggunakan atribut Plebo (kaos/kemeja/tas) dan menyerahkan Form Serah Terima Sampel (FSTS) setiap kali pick up sampel", "sub_category": "Atribut & SOP Kurir", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Melakukan update lokasi/status real-time selama perjalanan pengambilan/pengiriman sampel ke grup tracking", "sub_category": "Update Status", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Melakukan penjagaan di luar jam operasional (shift malam/akhir pekan) jika klinik beroperasi 24 jam, termasuk patroli rutin area klinik", "sub_category": "Keamanan Shift Malam", "category": "Admin", "type": "PRIMARY", "assigned_to": "Dado", "tags": "okr,baru", "description": "Berlaku jika ada penyimpanan aset/sampel overnight", "priority": "Normal"}, {"title": "Memastikan keamanan ruang penyimpanan sampel/reagen/obat (akses terbatas) di luar jam operasional", "sub_category": "Keamanan Penyimpanan", "category": "Admin", "type": "PRIMARY", "assigned_to": "Dado", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan serah terima tugas dan kondisi keamanan klinik antar shift dengan pencatatan log book", "sub_category": "Serah Terima Shift", "category": "Admin", "type": "PRIMARY", "assigned_to": "Dado", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan deep cleaning mingguan untuk area-area kritis (ruang lab, ruang periksa, AC, ventilasi)", "sub_category": "Deep Cleaning", "category": "Admin", "type": "PRIMARY", "assigned_to": "Prayitno", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan general cleaning bulanan menyeluruh termasuk area yang jarang terjangkau (plafon, kaca, gudang)", "sub_category": "Deep Cleaning", "category": "Admin", "type": "PRIMARY", "assigned_to": "Prayitno", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menyusun dan mengisi checklist deep cleaning sebagai bukti pelaksanaan untuk keperluan audit internal", "sub_category": "Deep Cleaning", "category": "Admin", "type": "PRIMARY", "assigned_to": "Prayitno", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Segera melaporkan ke Nurul/Ace Darojatun Anwar apabila terjadi kerusakan/kebocoran sampel selama perjalanan, dan mengikuti prosedur penanganan tumpahan/kontaminasi", "sub_category": "Penanganan Darurat Pengiriman", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Apabila terjadi kecelakaan atau keterlambatan signifikan, segera menginformasikan ke grup tracking dan koordinasi penggantian kurir/jadwal", "sub_category": "Penanganan Darurat Pengiriman", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mendokumentasikan kejadian darurat (foto, kronologi) untuk laporan ke Finance/Head of Operation jika ada klaim asuransi/penggantian", "sub_category": "Penanganan Darurat Pengiriman", "category": "Admin", "type": "PRIMARY", "assigned_to": "Reza", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "CS mengkonfirmasi pemesanan pasien melalui WhatsApp Plebo atau Pancake dengan format sebagai berikut:", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS merekap detail pemesanan dalam tracker master order dan memastikan tidak ada kesalahan penulisan nama dan sudah sesuai dengan ID/KTP/Paspor atau kartu identitas lainnya", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS berkoordinasi dengan Nakes Operations untuk menentukan jadwal home service", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS berkoordinasi dengan Financial Operations untuk dibuatkan link pembayaran", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ayu", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS memastikan pembayaran telah diterima", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS mengkonfirmasi pemesanan dan jadwal home service ke pasien paling cepat 1 Jam sebelum perjanjian", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations berkoordinasi dengan Head of Operations untuk menentukan lab rujukan sampel", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Setelah mendapat approval, Nakes Operations akan berkoordinasi dengan Lab Rekanan yang akan menerima sampe rujukan", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS memonitor status order melalui WhatsApp Group yang terdiri dari:", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Nurul", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS akan mengirimkan hasil lab test dan resume medis paling lama H+1 hari kalender setelah pengambilan sampel ke pasien", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Nakes Operations memastikan hasil lab tes sudah keluar paling lama H+1 setelah sampel diterima oleh lab", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Jika ada hasil lab keluar lebih dari H+1 hari kalender, Nakes Operations akan menginformasikan ke CS untuk diteruskan ke pasien", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS menawarkan layanan tambahan atau promo yang tersedia.", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS secara rutin memonitor dashboard CRM untuk memastikan semua pesanan dan follow-up tercatat dengan baik.", "sub_category": "General B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS menerima permintaan telemedicine dari pasien", "sub_category": "Telemedicine", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS berkoordinasi dengan dokter untuk jadwal telemedicine dengan pasien", "sub_category": "Telemedicine", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS follow up pasien untuk konfirmasi jadwal home service", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS-Ops menerima notifikasi permintaan pick up sampel immunology", "sub_category": "KSO Immunology", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS-Ops merekap detail pemesanan dalam tracker master order B2B2C di bagian tab khusus \"Immunology\"", "sub_category": "KSO Immunology", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS merekap detail pemesanan dalam tracker master order B2B2C dan menandai source customer sebagai \"Rujukan Dokter/Rujukan KP\"", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ayu", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS mengkonfirmasi pembayaran ke pasien (Rujukan Dokter/Rujukan KP)", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "CS akan mengirimkan hasil lab pasien ke Dokter/Pihak Klinik Pintar", "sub_category": "Rujukan Dokter, Klinik Pintar, RS", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,existing", "description": "", "priority": "Normal"}, {"title": "Menerima dan menyambut pasien yang datang langsung ke klinik (walk-in), memastikan pasien mengisi formulir pendaftaran/data diri", "sub_category": "Pendaftaran Pasien", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "Front desk klinik fisik - berbeda dari alur B2C home service yang sudah ada", "priority": "Normal"}, {"title": "Menginput data pasien walk-in ke sistem/tracker klinik dan menentukan nomor antrian sesuai jenis layanan (konsultasi dokter/lab)", "sub_category": "Pendaftaran Pasien", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengarahkan pasien ke ruang tunggu/ruang periksa sesuai antrian dan jenis layanan yang dipilih", "sub_category": "Pendaftaran Pasien", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Melakukan konfirmasi pembayaran pasien walk-in (tunai/QRIS) sebelum/sesudah layanan, berkoordinasi dengan Finance", "sub_category": "Pendaftaran Pasien", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memonitor alur antrian agar waktu tunggu pasien tidak melebihi target SLA klinik (maks 15 menit)", "sub_category": "Manajemen Antrian", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "[KR: Improve operational team productivity by 20% | Target: 20% increase in productivity | Initiative: Operational Efficiency] Action: Optimize team structure and responsibilities, Implement new workflow processes", "sub_category": "B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Achieve 95% SOP adherence across all initiatives | Target: 0.95 | Initiative: Operational Efficiency] Action: Establish monitoring system, Revise SOPs where needed", "sub_category": "B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Maintain AR aging over 90 days <3% | Target: <3% | Initiative: AR/AP Management] Action: Implement proactive collection strategies; refine tracking system", "sub_category": "B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Sita", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Enforcing a 45-day Accounts Payable (AP) cycle for 80% of vendors | Target: 80% within 15 days | Initiative: AR/AP Management] Action: Negotiate favorable payment terms; streamline payment processes", "sub_category": "B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Sita", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Create a monthly financial report to the management on the 5th of each month | Target: 1.0 | Initiative: AR/AP Management] Action: Collaborate with Goritax (third party) to accurately categorize company expenses in the tracker, such as capex, opex, office management, etc", "sub_category": "B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Sita", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Achieve 90% satisfaction rate for B2B MCU Onsite | Target: 0.9 | Initiative: B2B MCU Onsite] Action: Conduct pre-implementation meetings; Implement post-implementation feedback mechanisms", "sub_category": "B2B", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Achieve 95% satisfaction rate for B2C Home Service | Target: 1.0 | Initiative: B2C Home Service] Action: Proactive monitoring; client surveys", "sub_category": "B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ikhsan", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Maximum of 10% client complaints regarding MCU results | Target: 0.1 | Initiative: B2B MCU Onsite & Referrals] Action: Implement robust QC procedures; enforce vendor penalties for errors", "sub_category": "B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Secure all necessary regulatory approvals and compliance | Target: 100% approval | Initiative: Klinik & Lab Utama] Action: Complete all applications; address any compliance issues", "sub_category": "B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Complete Infrastructure Development and Setup | Target: Full setup | Initiative: Klinik & Lab Utama] Action: Finalize lease; complete construction; procure and install equipment; develop systems", "sub_category": "B2B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Reduce registration processing time by 50% | Target: 50% reduction | Initiative: Process Improvement] Action: Implement digital registration system; provide vendor training; address connectivity issues", "sub_category": "B2B/B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "[KR: Ensure 100% vendor compliance with digital system | Target: 1.0 | Initiative: Process Improvement] Action: Provide technical support; enforce penalties for non-compliance", "sub_category": "B2B/B2C", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,okr-existing", "description": "", "priority": "Normal"}, {"title": "Mencapai 100% kepatuhan SOP klinik (kebersihan, keamanan, pelayanan medis) berdasarkan checklist audit bulanan", "sub_category": "Klinik Operations", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memastikan waktu tunggu pasien di klinik maksimal 15 menit dari kedatangan hingga dilayani", "sub_category": "Klinik Operations", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mencapai 0% kesalahan hasil laboratorium (zero error rate) melalui implementasi double-check QC", "sub_category": "Lab Quality", "category": "Admin", "type": "PRIMARY", "assigned_to": "Faiz", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memastikan ketersediaan stok BHP dan reagen laboratorium minimal 95% setiap saat (tidak ada stockout)", "sub_category": "Klinik Operations", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menyelesaikan rekonsiliasi kas harian klinik H+0 (same day) setiap hari kerja", "sub_category": "Finance", "category": "Admin", "type": "PRIMARY", "assigned_to": "Liza", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Memastikan 100% kebersihan dan keamanan fasilitas klinik sesuai checklist harian (pagi & sore)", "sub_category": "Facility & Security", "category": "Admin", "type": "PRIMARY", "assigned_to": "Prayitno", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menyusun dan menjalankan program onboarding untuk seluruh karyawan baru klinik (pengenalan SOP, fasilitas, tim, dan job description)", "sub_category": "Onboarding Karyawan Baru", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menyiapkan checklist administrasi onboarding (kontrak kerja, ID card, akses sistem, atribut kerja) untuk setiap karyawan baru", "sub_category": "Onboarding Karyawan Baru", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengadakan pelatihan K3 (Kesehatan & Keselamatan Kerja) dan penanganan limbah B3 secara berkala minimal setiap 6 bulan untuk Perawat, Analis, dan Cleaning Service", "sub_category": "Pelatihan Berkala", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengadakan pelatihan Basic Life Support (BLS)/penanganan kegawatdaruratan untuk seluruh tim medis dan support secara berkala", "sub_category": "Pelatihan Berkala", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Mengadakan refreshment SOP flebotomi dan pemeriksaan laboratorium untuk Analis (Faiz, Hilmy, Nurul) minimal setiap 6 bulan", "sub_category": "Pelatihan Berkala", "category": "Admin", "type": "PRIMARY", "assigned_to": "dr. Laras Sheila Andini", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Menerima dan mencatat komplain pasien klinik fisik (walk-in) melalui form/log komplain di front desk", "sub_category": "Penanganan Komplain Klinik", "category": "Admin", "type": "PRIMARY", "assigned_to": "Farenty", "tags": "okr,baru", "description": "Berbeda dari komplain B2C yang ditangani CS via WhatsApp/Pancake", "priority": "Normal"}, {"title": "Melakukan investigasi dan tindak lanjut komplain pasien klinik maksimal H+2 hari kerja sejak komplain diterima", "sub_category": "Penanganan Komplain Klinik", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Membuat laporan rekap komplain bulanan beserta status penyelesaian untuk evaluasi manajemen", "sub_category": "Penanganan Komplain Klinik", "category": "Admin", "type": "PRIMARY", "assigned_to": "Ace Darojatun Anwar", "tags": "okr,baru", "description": "", "priority": "Normal"}, {"title": "Lab Manager", "sub_category": "Ace Darojatun Anwar", "category": "Admin", "type": "PRIMARY", "assigned_to": "0", "tags": "okr,0", "description": "OFF", "priority": "Normal"}, {"title": "Analis Laboratorium", "sub_category": "Nurul", "category": "Admin", "type": "PRIMARY", "assigned_to": "0", "tags": "okr,0", "description": "OFF", "priority": "Normal"}, {"title": "Analis Laboratorium", "sub_category": "Faiz Prasetyo", "category": "Admin", "type": "PRIMARY", "assigned_to": "0", "tags": "okr,0", "description": "OFF", "priority": "Normal"}, {"title": "Analis Laboratorium", "sub_category": "Hilmi", "category": "Admin", "type": "PRIMARY", "assigned_to": "0", "tags": "okr,0", "description": "OFF", "priority": "Normal"}, {"title": "Cleaning Service", "sub_category": "Prayitno", "category": "Admin", "type": "PRIMARY", "assigned_to": "0", "tags": "okr,0", "description": "OFF", "priority": "Normal"}];

async function seedOKRTasks() {
  const count = OKR_SEED_TASKS.length;
  if (!confirm(`Import ${count} task dari file OKR Excel ke Task Management?\n\nTask akan ter-assign ke PIC masing-masing sesuai Excel.\nLanjut?`)) return;
  const user  = getUserName?getUserName():'Ace Darojatun Anwar';
  const today = new Date().toISOString().split('T')[0];
  let added=0, errs=0;
  for (let i=0; i<OKR_SEED_TASKS.length; i++) {
    const t = OKR_SEED_TASKS[i];
    try {
      await sbPost('tasks', {
        title:       t.title,
        type:        t.type||'PRIMARY',
        category:    t.sub_category||'Operasional',
        description: t.description||null,
        assigned_to: t.assigned_to||user,
        assigned_by: user,
        due_date:    today,
        alokasi_jam: 1,
        status:      'Todo',
        priority:    'Normal',
        tags:        t.tags||'okr',
        created_by:  user,
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      });
      added++;
    } catch(e) { errs++; console.error(t.title, e.message); }
    if ((i+1) % 20 === 0) toast(`Importing... ${i+1}/${count}`,'info',600);
  }
  toast(`✅ ${added} task diimport ke Task Management${errs?` · ${errs} gagal`:''}`, errs?'warn':'ok', 5000);
}
