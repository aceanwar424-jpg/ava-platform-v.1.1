// ═══════════════════════════════════════════════════════════════
// MODULE: Pelaporan & Audit
// Placeholder module — structure ready, forms via task system
// ═══════════════════════════════════════════════════════════════

const REPORT_TYPES = [
  {
    id:'INM', label:'INM', fullLabel:'Indikator Nasional Mutu',
    icon:'📊', color:'#0891B2',
    frekuensi:'Bulanan', deadline:'Tgl 10 bulan berikutnya',
    pic_default:'Faiz, Hilmy',
    description:'Pelaporan indikator mutu wajib ke Kemenkes/Dinkes setiap bulan.',
    category:'Regulasi Mutu',
  },
  {
    id:'IKP', label:'IKP', fullLabel:'Insiden Keselamatan Pasien',
    icon:'⚠️', color:'#EF4444',
    frekuensi:'Event-based', deadline:'H+24 jam sejak insiden',
    pic_default:'dr. Laras Sheila Andini',
    description:'Pelaporan insiden keselamatan pasien segera setelah kejadian.',
    category:'Keselamatan Pasien',
  },
  {
    id:'SISDMK', label:'SISDMK', fullLabel:'Sistem Informasi SDM Kesehatan',
    icon:'👥', color:'#7C3AED',
    frekuensi:'Per Quarter', deadline:'Akhir kuartal',
    pic_default:'Ace Darojatun Anwar',
    description:'Update data SDM Kesehatan ke sistem Kemenkes.',
    category:'Regulasi SDM',
  },
  {
    id:'SIMPEL', label:'SIMPEL', fullLabel:'Sistem Informasi Pelaporan',
    icon:'📋', color:'#F59E0B',
    frekuensi:'Bulanan', deadline:'Tgl 5 bulan berikutnya',
    pic_default:'Faiz',
    description:'Pelaporan laboratorium ke sistem SIMPEL Kemenkes.',
    category:'Regulasi Lab',
  },
  {
    id:'KASIR', label:'Rekap Kasir', fullLabel:'Rekonsiliasi Kasir Harian',
    icon:'💰', color:'#22C55E',
    frekuensi:'Harian', deadline:'EOD 18:00',
    pic_default:'Liza',
    description:'Rekap dan rekonsiliasi kasir setiap hari kerja.',
    category:'Finance',
  },
  {
    id:'LIMBAH_B3', label:'Limbah B3', fullLabel:'Pelaporan Limbah Medis B3',
    icon:'♻️', color:'#6B7280',
    frekuensi:'Per jadwal DLH', deadline:'Sesuai jadwal DLH',
    pic_default:'Prayitno, Faiz',
    description:'Pelaporan pengelolaan limbah medis ke DLH/Dinkes.',
    category:'Lingkungan',
  },
  {
    id:'AUDIT_INTERNAL', label:'Audit Internal', fullLabel:'Audit Internal Klinik',
    icon:'🔍', color:'#0EA5E9',
    frekuensi:'Bulanan', deadline:'Akhir bulan',
    pic_default:'Ace Darojatun Anwar',
    description:'Audit internal SOP, kebersihan, keamanan, dan alur layanan.',
    category:'Audit',
  },
];

let reportState = { tab:'dashboard', records:[], tasks:[] };

// ── RENDER UTAMA ──────────────────────────────────────────────
async function renderRegulatoryReports() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>📊 Pelaporan & Audit</h1>
        <p>INM · IKP · SISDMK · SIMPEL · Audit Internal · Rekap Kasir</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="openNewReportTask()">+ Buat Laporan / Task</button>
      </div>
    </div>

    <div class="ms-topbar" style="margin-bottom:18px">
      <button class="ms-tab active" onclick="switchReportTab('dashboard',this)">📊 Dashboard</button>
      <button class="ms-tab" onclick="switchReportTab('records',this)">📋 Riwayat</button>
      <button class="ms-tab" onclick="switchReportTab('calendar',this)">📅 Kalender</button>
    </div>

    <div id="report-main">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;

  await loadReportData();
  renderReportDashboard();
}

async function loadReportData() {
  const [tasks, recs] = await Promise.all([
    sbGet('tasks',`select=*&category=in.(INM,IKP,SISDMK,SIMPEL,Rekap Kasir,Limbah B3,Audit Internal)&order=due_date.asc&limit=50`).catch(()=>[]),
    sbGet('report_records','select=*&order=created_at.desc&limit=50').catch(()=>[]),
  ]);
  reportState.tasks   = Array.isArray(tasks) ? tasks : [];
  reportState.records = Array.isArray(recs)  ? recs  : [];
}

function switchReportTab(tab, btn) {
  document.querySelectorAll('.ms-topbar .ms-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  reportState.tab = tab;
  if (tab==='dashboard') renderReportDashboard();
  if (tab==='records')   renderReportRecords();
  if (tab==='calendar')  renderReportCalendar();
}

function renderReportDashboard() {
  const el = document.getElementById('report-main'); if (!el) return;
  const today = new Date().toISOString().split('T')[0];

  el.innerHTML = `
    <!-- Type cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-bottom:24px">
      ${REPORT_TYPES.map(rt=>{
        const relTasks = reportState.tasks.filter(t=>t.category===rt.label||(t.tags||'').includes(rt.id));
        const pending  = relTasks.filter(t=>t.status!=='Done').length;
        const overdue  = relTasks.filter(t=>t.due_date<today&&t.status!=='Done').length;
        return `
          <div class="card" style="border-top:3px solid ${rt.color};cursor:pointer;transition:all .15s"
            onmouseover="this.style.boxShadow='var(--shadow)'" onmouseout="this.style.boxShadow='var(--shadow-xs)'"
            onclick="openReportTypeDetail('${rt.id}')">
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
              <span style="font-size:24px">${rt.icon}</span>
              <div style="flex:1">
                <div style="font-weight:800;font-size:13.5px;color:var(--text)">${rt.fullLabel}</div>
                <div style="font-size:11px;color:${rt.color};font-weight:600">${rt.frekuensi} · ${rt.deadline}</div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:10px">${rt.description}</div>
            <div style="display:flex;gap:10px;font-size:11.5px">
              <span>PIC: <strong>${rt.pic_default}</strong></span>
              ${pending?`<span style="color:${overdue?'#EF4444':'#F59E0B'};font-weight:700">
                ${overdue?`⚠️ ${overdue} overdue`:`📋 ${pending} pending`}
              </span>`:`<span style="color:#22C55E;font-weight:700">✅ Clear</span>`}
            </div>
          </div>`;
      }).join('')}
    </div>

    <!-- Upcoming deadlines -->
    <div class="card">
      <div class="card-title" style="margin-bottom:14px">⏰ Deadline Terdekat</div>
      ${reportState.tasks.filter(t=>t.status!=='Done').slice(0,10).length ?
        reportState.tasks.filter(t=>t.status!=='Done').slice(0,10).map(t=>{
          const isOverdue = t.due_date < today;
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="font-size:20px">${REPORT_TYPES.find(r=>r.label===t.category||r.id===t.category)?.icon||'📋'}</div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px">${t.title}</div>
                <div style="font-size:11px;color:var(--text3)">PIC: ${t.assigned_to||'—'} · ${t.category}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:12px;font-weight:700;color:${isOverdue?'#EF4444':'var(--text)'}">
                  ${isOverdue?'⚠️ OVERDUE':t.due_date}
                </div>
                <span class="badge ${t.status==='Done'?'badge-green':isOverdue?'badge-red':'badge-gold'}" style="font-size:10px">
                  ${t.status}
                </span>
              </div>
              <button class="act-btn edit" onclick="openTaskDetail(${t.id})">📋</button>
            </div>`;
        }).join('') :
        `<div class="empty-state" style="padding:30px">
          <div class="ico" style="font-size:36px">✅</div>
          <p>Semua laporan up to date!</p>
        </div>`}
    </div>`;
}

function renderReportRecords() {
  const el = document.getElementById('report-main'); if (!el) return;
  const done = reportState.tasks.filter(t=>t.status==='Done');
  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <span style="font-size:13px;color:var(--text3)">${done.length} laporan selesai</span>
        <button class="btn btn-teal btn-sm" onclick="openNewReportTask()">+ Buat Laporan</button>
      </div>
      ${done.length ? `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${['JENIS','JUDUL','PIC','TANGGAL SELESAI','STATUS'].map(h=>`
            <th style="padding:9px 12px;background:var(--bg);font-size:11px;color:var(--text3);
              border-bottom:1px solid var(--border)">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${done.map((t,i)=>`
            <tr style="background:${i%2?'var(--bg2)':'#fff'};border-bottom:1px solid var(--border);cursor:pointer"
              onclick="openTaskDetail(${t.id})">
              <td style="padding:9px 12px">${REPORT_TYPES.find(r=>r.label===t.category)?.icon||'📋'} ${t.category}</td>
              <td style="padding:9px 12px;font-weight:600">${t.title}</td>
              <td style="padding:9px 12px;color:var(--text3)">${t.assigned_to||'—'}</td>
              <td style="padding:9px 12px">${t.completed_at?.slice(0,10)||t.updated_at?.slice(0,10)||'—'}</td>
              <td style="padding:9px 12px"><span class="badge badge-green">✅ Done</span></td>
            </tr>`).join('')}
        </tbody>
      </table>` :
      `<div class="empty-state" style="padding:40px"><div class="ico">📋</div>
        <h3>Belum ada laporan selesai</h3></div>`}
    </div>`;
}

function renderReportCalendar() {
  const el = document.getElementById('report-main'); if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:14px">📅 Kalender Pelaporan</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${REPORT_TYPES.map(rt=>`
          <div style="border-left:4px solid ${rt.color};padding:12px 14px;background:var(--bg2);border-radius:0 var(--r) var(--r) 0">
            <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:4px">
              ${rt.icon} ${rt.label}
            </div>
            <div style="font-size:12px;color:var(--text3)">📅 ${rt.frekuensi}</div>
            <div style="font-size:12px;color:${rt.color};font-weight:600">⏰ ${rt.deadline}</div>
            <div style="font-size:11.5px;color:var(--text3);margin-top:4px">PIC: ${rt.pic_default}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function openReportTypeDetail(typeId) {
  const rt = REPORT_TYPES.find(r=>r.id===typeId); if (!rt) return;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${rt.icon} ${rt.fullLabel}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="margin-bottom:14px">
      <div class="form-row">
        ${[
          ['Frekuensi',rt.frekuensi],['Deadline',rt.deadline],
          ['PIC Default',rt.pic_default],['Kategori',rt.category],
        ].map(([l,v])=>`<div><label>${l}</label><div style="font-weight:600;font-size:13px">${v}</div></div>`).join('')}
      </div>
      <div style="margin-top:12px;font-size:13px;color:var(--text2)">${rt.description}</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="closeModalForce();openNewReportTask('${rt.id}')">+ Buat Task Laporan</button>
    </div>`);
}

function openNewReportTask(typeId=null) {
  const rt = typeId ? REPORT_TYPES.find(r=>r.id===typeId) : null;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const due = tomorrow.toISOString().split('T')[0];
  openTaskForm(null, 'PRIMARY', due, rt?.pic_default?.split(',')[0].trim()||null);
  setTimeout(()=>{
    const catEl = document.getElementById('tf-cat');
    if (catEl && rt) catEl.value = rt.label;
    const titleEl = document.getElementById('tf-title');
    if (titleEl && rt) titleEl.value = `[${rt.label}] `;
    const tagEl = document.getElementById('tf-tags');
    if (tagEl && rt) tagEl.value = rt.id+',regulasi';
  }, 200);
}
