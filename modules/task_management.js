// ═══════════════════════════════════════════════════════════════
// MODULE: Task Management System
// Sub-menu HRD — My Tasks, Team Board, Logbook, Weekly Summary
// ═══════════════════════════════════════════════════════════════

const TASK_CATEGORIES = ['Meeting','Lapangan','Admin','Riset','Koordinasi','Lainnya'];
const TASK_STATUSES   = ['Todo','InProgress','Done','Blocked','CarryOver'];
const MOOD_ICONS      = ['','😫','😐','🙂','😄'];
const MOOD_LABELS     = ['','Exhausted','Okay','Good','Great'];

const LINK_TYPES = {
  'gdoc':   { icon:'📄', label:'Google Doc' },
  'gdrive': { icon:'📁', label:'Google Drive' },
  'gsheet': { icon:'📊', label:'Google Sheet' },
  'notion': { icon:'📓', label:'Notion' },
  'figma':  { icon:'🎨', label:'Figma' },
  'wa':     { icon:'💬', label:'WhatsApp' },
  'link':   { icon:'🔗', label:'Link Lain' },
};

function detectLinkType(url) {
  if (!url) return 'link';
  if (url.includes('docs.google.com/document'))     return 'gdoc';
  if (url.includes('drive.google.com'))             return 'gdrive';
  if (url.includes('docs.google.com/spreadsheets')) return 'gsheet';
  if (url.includes('notion.so'))                    return 'notion';
  if (url.includes('figma.com'))                    return 'figma';
  if (url.includes('wa.me')||url.includes('whatsapp')) return 'wa';
  return 'link';
}

let taskState = {
  view:      'mytasks',   // mytasks, team, logbook, weekly
  myTasks:   [],
  allTasks:  [],
  employees: [],
  mySchedule:null,
  dateView:  new Date().toISOString().split('T')[0],
  weekStart: getWeekStart(),
  filterStatus: '',
  filterType:   '',
  logbookDate:  new Date().toISOString().split('T')[0],
};

function getWeekStart(d=new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day===0?-6:1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split('T')[0];
}

function getWeekDates(startStr) {
  const dates = [];
  const start = new Date(startStr);
  for (let i=0;i<7;i++) {
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// ══════════════════════════════════════════════════════════════
// RENDER UTAMA
// ══════════════════════════════════════════════════════════════
async function renderTaskManagement(view='mytasks') {
  taskState.view = view;
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>📋 Task Management</h1>
        <p>Alokasi task harian berdasarkan kapasitas shift — Primary & Secondary</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderTaskManagement(taskState.view)">↻</button>
        <button class="btn btn-teal" onclick="openTaskForm()">+ Task Baru</button>
      </div>
    </div>

    <!-- Nav tabs -->
    <div class="ms-topbar" style="margin-bottom:18px">
      <button class="ms-tab ${view==='mytasks'?'active':''}" onclick="renderTaskManagement('mytasks')">📋 My Tasks</button>
      <button class="ms-tab ${view==='team'?'active':''}"    onclick="renderTaskManagement('team')">👥 Team Board</button>
      <button class="ms-tab ${view==='logbook'?'active':''}" onclick="renderTaskManagement('logbook')">📝 Logbook</button>
      <button class="ms-tab ${view==='weekly'?'active':''}"  onclick="renderTaskManagement('weekly')">📊 Weekly Summary</button>
    </div>

    <div id="task-main-area">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;

  await loadTaskData();

  switch(view) {
    case 'mytasks': renderMyTasks(); break;
    case 'team':    renderTeamBoard(); break;
    case 'logbook': renderLogbook(); break;
    case 'weekly':  renderWeeklySummary(); break;
  }
}

async function loadTaskData() {
  const user = getUserName?getUserName():'';
  const today = taskState.dateView;
  const weekEnd = getWeekDates(taskState.weekStart).slice(-1)[0];

  try {
    const [myTasks, allTasks, emps] = await Promise.all([
      sbGet('tasks',`select=*&assigned_to=eq.${encodeURIComponent(user)}&order=due_date.asc,type.asc`).catch(()=>[]),
      sbGet('tasks',`select=*&due_date=gte.${taskState.weekStart}&due_date=lte.${weekEnd}&order=due_date.asc,assigned_to.asc`).catch(()=>[]),
      sbGet('employees','select=id,full_name,division,position&status=eq.Aktif&order=full_name').catch(()=>[]),
    ]);
    taskState.myTasks  = Array.isArray(myTasks)  ? myTasks  : [];
    taskState.allTasks = Array.isArray(allTasks) ? allTasks : [];
    taskState.employees= Array.isArray(emps)     ? emps     : [];
    taskState.mySchedule = await getMySchedule().catch(()=>null);
  } catch(e) {
    console.error('loadTaskData error:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// VIEW 1: MY TASKS
// ══════════════════════════════════════════════════════════════
function renderMyTasks() {
  const el = document.getElementById('task-main-area'); if (!el) return;
  const today    = taskState.dateView;
  const dayTasks = taskState.myTasks.filter(t=>t.due_date===today);
  const primary  = dayTasks.filter(t=>t.type==='PRIMARY');
  const secondary= dayTasks.filter(t=>t.type==='SECONDARY');
  const sched    = taskState.mySchedule;
  const kapTotal = sched ? parseFloat(sched.kapasitas_jam||7) : 8;
  const priMax   = kapTotal * ((sched?.primary_max_pct||80)/100);
  const priUsed  = primary.reduce((s,t)=>s+(parseFloat(t.alokasi_jam)||0),0);
  const secUsed  = secondary.reduce((s,t)=>s+(parseFloat(t.alokasi_jam)||0),0);
  const totalUsed= priUsed + secUsed;
  const pct      = Math.min(100, Math.round(totalUsed/kapTotal*100));
  const overload = totalUsed > kapTotal;
  const dateLabel= new Date(today+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});

  // Pending from other days
  const overdue = taskState.myTasks.filter(t=>
    t.due_date < today && !['Done','CarryOver'].includes(t.status)
  );

  el.innerHTML = `
    <!-- Date nav -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="shiftDate(-1)">← Kemarin</button>
      <div style="font-size:14px;font-weight:700;color:var(--text);flex:1;text-align:center">${dateLabel}</div>
      <button class="btn btn-ghost btn-sm" onclick="shiftDate(1)">Besok →</button>
      <button class="btn btn-outline btn-sm" onclick="taskState.dateView=new Date().toISOString().split('T')[0];renderMyTasks()">Hari Ini</button>
    </div>

    ${overdue.length?`
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:var(--r);padding:10px 14px;margin-bottom:14px;cursor:pointer"
      onclick="showOverdueTasksModal()">
      <div style="font-weight:700;color:#C2410C;font-size:12.5px">
        ⚠️ ${overdue.length} task overdue dari hari sebelumnya — klik untuk lihat &amp; kerjakan
      </div>
      <div style="font-size:11px;color:#9A3412;margin-top:2px">
        ${overdue.slice(0,3).map(t=>t.title).join(', ')}${overdue.length>3?` +${overdue.length-3} lainnya`:''}
      </div>
    </div>`:''}

    <!-- Kapasitas bar -->
    <div class="card" style="margin-bottom:16px;padding:14px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;font-weight:700;color:var(--text)">
          ⏱ Kapasitas Hari Ini
          ${sched?`<span style="font-size:10px;color:var(--text3);font-weight:400">· ${sched.shift_name} · ${sched.jam_masuk?.slice(0,5)}–${sched.jam_pulang?.slice(0,5)}</span>`:''}
        </div>
        <div style="font-size:12px;font-weight:700;color:${overload?'#DC2626':'var(--teal)'}">
          ${totalUsed.toFixed(1)}j / ${kapTotal.toFixed(1)}j ${overload?'⚠️ OVERLOAD':''}
        </div>
      </div>
      <div style="height:10px;background:var(--bg2);border-radius:10px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${pct}%;background:${overload?'#EF4444':pct>80?'#F59E0B':'var(--teal)'};
          border-radius:10px;transition:width .4s"></div>
      </div>
      <div style="display:flex;gap:16px;font-size:11.5px;flex-wrap:wrap">
        <span>🔴 Primary: <strong>${priUsed.toFixed(1)}j</strong> / ${priMax.toFixed(1)}j maks</span>
        <span>🟡 Secondary: <strong>${secUsed.toFixed(1)}j</strong></span>
        <span style="color:var(--text3)">Sisa: <strong>${Math.max(0,kapTotal-totalUsed).toFixed(1)}j</strong></span>
      </div>
    </div>

    <!-- Filter bar -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${['','Todo','InProgress','Done','Blocked'].map(s=>`
        <button class="btn btn-sm ${taskState.filterStatus===s?'btn-teal':'btn-ghost'}"
          onclick="taskState.filterStatus='${s}';renderMyTasks()">
          ${s||'Semua'} ${s?`(${dayTasks.filter(t=>t.status===s).length})`:`(${dayTasks.length})`}
        </button>`).join('')}
      <div style="flex:1"></div>
      <button class="btn btn-outline btn-sm" onclick="openTaskForm(null,'PRIMARY','${today}')">+ Primary</button>
      <button class="btn btn-ghost btn-sm" onclick="openTaskForm(null,'SECONDARY','${today}')">+ Secondary</button>
    </div>

    <!-- Primary Tasks -->
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;font-weight:800;color:var(--text);text-transform:uppercase;letter-spacing:.04em">
          🔴 Primary Tasks <span style="color:var(--text3);font-weight:400">(${primary.length} task · ${priUsed.toFixed(1)}j)</span>
        </div>
        ${priUsed > priMax?`<span style="font-size:11px;color:#DC2626;font-weight:700">⚠️ Melebihi batas ${priMax.toFixed(1)}j</span>`:''}
      </div>
      ${renderTaskCards(primary.filter(t=>!taskState.filterStatus||t.status===taskState.filterStatus), 'PRIMARY')}
    </div>

    <!-- Secondary Tasks -->
    <div>
      <div style="font-size:12px;font-weight:800;color:var(--text);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">
        🟡 Secondary Tasks <span style="color:var(--text3);font-weight:400">(${secondary.length} task · ${secUsed.toFixed(1)}j)</span>
      </div>
      ${renderTaskCards(secondary.filter(t=>!taskState.filterStatus||t.status===taskState.filterStatus), 'SECONDARY')}
    </div>

    <!-- End of Day logbook prompt -->
    ${today===new Date().toISOString().split('T')[0]?`
    <div style="margin-top:20px;background:linear-gradient(135deg,#0891B2,#0E7490);border-radius:var(--r);padding:14px 18px;
      display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer"
      onclick="renderTaskManagement('logbook')">
      <div style="color:#fff">
        <div style="font-weight:700;font-size:13px">📝 Isi Daily Logbook</div>
        <div style="font-size:11.5px;opacity:.8">Rekap aktivitas hari ini sebelum EOD</div>
      </div>
      <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3)">
        Buka Logbook →
      </button>
    </div>`:''}`;
}

function renderTaskCards(tasks, type) {
  if (!tasks.length) {
    return `<div style="text-align:center;padding:20px;background:var(--bg2);border-radius:var(--r);
      border:2px dashed var(--border);color:var(--text3);font-size:12px">
      Belum ada task ${type==='PRIMARY'?'utama':'tambahan'} hari ini
    </div>`;
  }
  const STATUS_COLOR = {Todo:'#94A3B8',InProgress:'#0891B2',Done:'#22C55E',Blocked:'#EF4444',CarryOver:'#F59E0B'};
  const STATUS_ICON  = {Todo:'⬜',InProgress:'🔵',Done:'✅',Blocked:'🚫',CarryOver:'🔄'};

  return tasks.map(t=>`
    <div style="background:#fff;border:1.5px solid ${t.status==='Done'?'#BBF7D0':t.status==='Blocked'?'#FECACA':'var(--border)'};
      border-radius:var(--r);padding:12px 14px;margin-bottom:8px;
      ${t.status==='Done'?'opacity:.7':''}
      transition:all .15s;cursor:pointer"
      onmouseover="this.style.borderColor='${STATUS_COLOR[t.status]||'var(--teal)'}';this.style.boxShadow='var(--shadow-sm)'"
      onmouseout="this.style.borderColor='${t.status==='Done'?'#BBF7D0':t.status==='Blocked'?'#FECACA':'var(--border)'  }';this.style.boxShadow='none'"
      onclick="openTaskDetail(${t.id})">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <!-- Status toggle -->
        <div onclick="event.stopPropagation();quickStatusToggle(${t.id},'${t.status}')"
          style="font-size:18px;cursor:pointer;flex-shrink:0;margin-top:-1px" title="Klik untuk toggle status">
          ${STATUS_ICON[t.status]||'⬜'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:${t.status==='Done'?'var(--text3)':'var(--text)'};
            ${t.status==='Done'?'text-decoration:line-through':''}">
            ${t.title}
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;align-items:center">
            <span style="font-size:11px;color:var(--text3)">📁 ${t.category||'Admin'}</span>
            <span style="font-size:11px;color:var(--text3)">⏱ ${t.alokasi_jam||1}j plan${t.actual_jam?` · ${t.actual_jam}j aktual`:''}</span>
            ${t.carry_over_from?`<span class="badge badge-gold" style="font-size:10px">🔄 Carry-over</span>`:''}
            ${t.priority==='High'||t.priority==='Critical'?`<span class="badge badge-red" style="font-size:10px">❗ ${t.priority}</span>`:''}
            <span style="font-size:11px;background:${STATUS_COLOR[t.status]||'var(--bg2)'}20;
              color:${STATUS_COLOR[t.status]||'var(--text3)'};padding:1px 7px;border-radius:10px;font-weight:600">
              ${t.status}
            </span>
          </div>
          ${t.carry_over_note?`<div style="font-size:10.5px;color:#92400E;margin-top:4px;background:#FFFBEB;padding:3px 8px;border-radius:4px">📌 ${t.carry_over_note}</div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div onclick="event.stopPropagation()" style="display:flex;gap:4px">
            <button class="act-btn edit" onclick="openTaskForm(${t.id})" title="Edit">✏️</button>
            ${t.status!=='Done'?`<button class="act-btn" onclick="event.stopPropagation();markTaskDone(${t.id})" 
              style="color:#22C55E" title="Selesai">✅</button>`:''}
          </div>
        </div>
      </div>
      <!-- Links -->
      ${t._links?.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
        ${t._links.map(l=>`
          <a href="${l.url}" target="_blank" onclick="event.stopPropagation()"
            style="display:flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;
              border-radius:6px;background:var(--bg2);color:var(--teal);text-decoration:none;border:1px solid var(--border)">
            ${LINK_TYPES[l.type]?.icon||'🔗'} ${l.label||l.url.slice(0,30)}
          </a>`).join('')}
      </div>`:''}
    </div>`).join('');
}

function shiftDate(days) {
  const d = new Date(taskState.dateView+'T00:00:00');
  d.setDate(d.getDate()+days);
  taskState.dateView = d.toISOString().split('T')[0];
  renderMyTasks();
}

function showOverdueTasksModal() {
  const today = new Date().toISOString().split('T')[0];
  const overdue = taskState.myTasks.filter(t=>
    t.due_date < today && !['Done','CarryOver'].includes(t.status)
  ).sort((a,b)=>a.due_date.localeCompare(b.due_date));

  const TYPE_COLOR = {PRIMARY:'#EF4444', SECONDARY:'#F59E0B'};

  openModal(`
    <div class="modal-header">
      <div class="modal-title">⚠️ ${overdue.length} Task Overdue</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn btn-teal btn-sm" onclick="rescheduleAllOverdue()">📅 Pindahkan Semua ke Hari Ini</button>
    </div>
    <div style="max-height:55vh;overflow-y:auto">
      ${overdue.map(t=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
          border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px">
          <span style="width:6px;height:36px;border-radius:3px;background:${TYPE_COLOR[t.type]||'#94A3B8'};flex-shrink:0"></span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px">${t.title}</div>
            <div style="font-size:11px;color:var(--text3)">
              ${t.category||'Admin'} · Due: <strong style="color:#DC2626">${t.due_date}</strong> · ${t.status}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="rescheduleOverdueTask(${t.id})">→ Hari Ini</button>
          <button class="btn btn-ghost btn-sm" onclick="closeModalForce();openTaskForm(${t.id})">✏️</button>
        </div>`).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    </div>`, 'wide');
}

async function rescheduleOverdueTask(taskId) {
  const today = new Date().toISOString().split('T')[0];
  try {
    await sbPatch('tasks', taskId, { due_date: today, updated_at: new Date().toISOString() });
    toast('✅ Task dipindahkan ke hari ini', 'ok', 1500);
    closeModalForce();
    await loadTaskData();
    renderMyTasks();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function rescheduleAllOverdue() {
  const today = new Date().toISOString().split('T')[0];
  const overdue = taskState.myTasks.filter(t=>
    t.due_date < today && !['Done','CarryOver'].includes(t.status)
  );
  if (!overdue.length) { closeModalForce(); return; }
  if (!confirm(`Pindahkan ${overdue.length} task overdue ke hari ini?`)) return;
  let ok=0;
  for (const t of overdue) {
    try { await sbPatch('tasks', t.id, { due_date: today, updated_at: new Date().toISOString() }); ok++; }
    catch(e) {}
  }
  toast(`✅ ${ok} task dipindahkan ke hari ini`, 'ok');
  closeModalForce();
  await loadTaskData();
  renderMyTasks();
}

// ══════════════════════════════════════════════════════════════
// VIEW 2: TEAM BOARD (SPV only)
// ══════════════════════════════════════════════════════════════
function renderTeamBoard() {
  const el = document.getElementById('task-main-area'); if (!el) return;
  const weekDates = getWeekDates(taskState.weekStart);
  const role = getUserRole?getUserRole():'sales';
  const canSeeTeam = isSpv();

  if (!canSeeTeam) {
    el.innerHTML = `<div class="empty-state"><div class="ico">🔒</div>
      <h3>Akses Terbatas</h3><p>Team Board hanya bisa diakses SPV dan Manager.</p></div>`;
    return;
  }

  const empNames = [...new Set(taskState.allTasks.map(t=>t.assigned_to).filter(Boolean))];

  el.innerHTML = `
    <!-- Week nav -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <button class="btn btn-ghost btn-sm" onclick="shiftWeek(-1)">← Minggu Lalu</button>
      <div style="flex:1;text-align:center;font-size:13px;font-weight:700">
        ${new Date(weekDates[0]+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long'})} –
        ${new Date(weekDates[6]+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="shiftWeek(1)">Minggu Ini →</button>
    </div>

    <!-- Capacity legend -->
    <div style="display:flex;gap:12px;margin-bottom:14px;font-size:11.5px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;background:#22C55E;border-radius:3px"></div>Normal (&lt;80%)</div>
      <div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;background:#F59E0B;border-radius:3px"></div>Hampir Penuh (80–100%)</div>
      <div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;background:#EF4444;border-radius:3px"></div>Overload (&gt;100%)</div>
      <div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;background:var(--bg2);border-radius:3px;border:1px solid var(--border)"></div>Tidak ada task</div>
    </div>

    <!-- Grid -->
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:700px">
        <thead>
          <tr>
            <th style="padding:8px 12px;background:var(--navy);color:#fff;font-size:12px;text-align:left;min-width:150px">Karyawan</th>
            ${weekDates.map(d=>{
              const dd = new Date(d+'T00:00:00');
              const isToday = d===new Date().toISOString().split('T')[0];
              return `<th style="padding:8px 10px;background:${isToday?'var(--teal)':'var(--navy)'};color:#fff;font-size:11px;text-align:center;min-width:100px">
                ${dd.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short'})}
                ${isToday?'<br><span style="font-size:9px;opacity:.8">Hari ini</span>':''}
              </th>`;
            }).join('')}
            <th style="padding:8px 10px;background:var(--navy);color:#fff;font-size:11px;text-align:center">Total</th>
          </tr>
        </thead>
        <tbody>
          ${empNames.length ? empNames.map(emp=>{
            const empTasks = taskState.allTasks.filter(t=>t.assigned_to===emp);
            const weekTotal = empTasks.reduce((s,t)=>s+(parseFloat(t.alokasi_jam)||0),0);
            return `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 12px;font-weight:600;font-size:13px;background:#fff">
                  <div>${emp}</div>
                  <div style="font-size:10px;color:var(--text3)">${empTasks.filter(t=>t.status==='Done').length}/${empTasks.length} done minggu ini</div>
                </td>
                ${weekDates.map(d=>{
                  const dayT = empTasks.filter(t=>t.due_date===d);
                  const dayJam = dayT.reduce((s,t)=>s+(parseFloat(t.alokasi_jam)||0),0);
                  const kapHari = 7; // default, idealnya dari work_schedules
                  const loadPct = Math.round(dayJam/kapHari*100);
                  const color = loadPct===0?'var(--bg2)':loadPct<=80?'#DCFCE7':loadPct<=100?'#FEF3C7':'#FEE2E2';
                  const textColor = loadPct===0?'var(--text3)':loadPct<=80?'#15803D':loadPct<=100?'#92400E':'#DC2626';
                  return `<td style="padding:8px 10px;text-align:center;background:${color};cursor:pointer"
                    onclick="filterTeamDay('${emp}','${d}')" title="${dayT.length} task · ${dayJam}j">
                    ${dayT.length>0?`
                      <div style="font-size:13px;font-weight:800;color:${textColor}">${dayJam}j</div>
                      <div style="font-size:10px;color:${textColor}">${dayT.length} task</div>
                    `:`<div style="color:var(--text3);font-size:11px">—</div>`}
                  </td>`;
                }).join('')}
                <td style="padding:10px;text-align:center;background:#fff;font-weight:700;color:var(--teal)">${weekTotal.toFixed(1)}j</td>
              </tr>`;
          }).join('') : `
            <tr><td colspan="${weekDates.length+2}" style="text-align:center;padding:40px;color:var(--text3)">
              Belum ada task minggu ini
            </td></tr>`}
        </tbody>
      </table>
    </div>

    <div id="team-day-detail" style="margin-top:16px"></div>`;
}

function shiftWeek(dir) {
  const d = new Date(taskState.weekStart+'T00:00:00');
  d.setDate(d.getDate()+(dir*7));
  taskState.weekStart = d.toISOString().split('T')[0];
  loadTaskData().then(()=>renderTeamBoard());
}

function filterTeamDay(emp, date) {
  const el = document.getElementById('team-day-detail'); if (!el) return;
  const tasks = taskState.allTasks.filter(t=>t.assigned_to===emp&&t.due_date===date);
  const dateLabel = new Date(date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
  el.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:12px">📋 ${emp} — ${dateLabel}</div>
      ${tasks.length ? renderTaskCards(tasks,'ALL') : '<div style="color:var(--text3);font-size:13px">Tidak ada task</div>'}
      <div style="margin-top:10px">
        <button class="btn btn-teal btn-sm" onclick="openTaskForm(null,'PRIMARY','${date}','${emp}')">+ Assign Task ke ${emp.split(' ')[0]}</button>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// VIEW 3: LOGBOOK HARIAN
// ══════════════════════════════════════════════════════════════
async function renderLogbook() {
  const el = document.getElementById('task-main-area'); if (!el) return;
  const today  = taskState.logbookDate;
  const user   = getUserName?getUserName():'';
  const role   = getUserRole?getUserRole():'sales';
  const isSpvUser = isSpv();

  // Load today's log + tasks
  const [logs, dayTasks] = await Promise.all([
    sbGet('daily_logs',`select=*&employee_name=eq.${encodeURIComponent(user)}&tanggal=eq.${today}&limit=1`).catch(()=>[]),
    sbGet('tasks',`select=*&assigned_to=eq.${encodeURIComponent(user)}&due_date=eq.${today}&order=type.asc`).catch(()=>[]),
  ]);
  const log = logs[0]||{};
  const doneTasks = dayTasks.filter(t=>t.status==='Done');
  const pendTasks = dayTasks.filter(t=>!['Done','CarryOver'].includes(t.status));
  const totPlan   = dayTasks.reduce((s,t)=>s+(parseFloat(t.alokasi_jam)||0),0);
  const totActual = doneTasks.reduce((s,t)=>s+(parseFloat(t.actual_jam)||t.alokasi_jam||0),0);
  const dateLabel = new Date(today+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const isLocked  = log.status==='Approved';

  el.innerHTML = `
    <!-- Date nav -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="shiftLogDate(-1)">← Kemarin</button>
      <div style="font-size:14px;font-weight:700;flex:1;text-align:center">${dateLabel}</div>
      <button class="btn btn-ghost btn-sm" onclick="shiftLogDate(1)">Besok →</button>
      <button class="btn btn-outline btn-sm" onclick="taskState.logbookDate=new Date().toISOString().split('T')[0];renderLogbook()">Hari Ini</button>
    </div>

    <!-- Status banner -->
    ${log.status?`
    <div style="background:${ {Draft:'#F1F5F9',Submitted:'#EFF6FF',Approved:'#DCFCE7',Revision:'#FEF3C7'}[log.status]||'var(--bg2)'};
      border-radius:var(--r);padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">${{Draft:'📝',Submitted:'⏳',Approved:'✅',Revision:'⚠️'}[log.status]}</span>
      <div>
        <div style="font-weight:700;font-size:13px">Status Logbook: ${log.status}</div>
        ${log.spv_notes?`<div style="font-size:12px;color:var(--text3);margin-top:2px">Catatan SPV: ${log.spv_notes}</div>`:''}
        ${log.approved_by_spv?`<div style="font-size:11px;color:var(--text3)">Disetujui oleh ${log.approved_by_spv} · ${log.approved_at_spv?.slice(0,10)||''}</div>`:''}
      </div>
    </div>`:''}

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
      ${[
        {icon:'✅', val:doneTasks.length, label:'Task Done',     color:'#22C55E'},
        {icon:'⏳', val:pendTasks.length, label:'Task Pending',  color:'#F59E0B'},
        {icon:'⏱', val:totPlan.toFixed(1)+'j', label:'Jam Plan',color:'#0891B2'},
        {icon:'⚡', val:totActual.toFixed(1)+'j',label:'Jam Aktual',color:'#7C3AED'},
      ].map(k=>`
        <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);
          padding:10px 12px;border-top:3px solid ${k.color};text-align:center">
          <div style="font-size:20px">${k.icon}</div>
          <div style="font-size:16px;font-weight:800;color:${k.color}">${k.val}</div>
          <div style="font-size:10px;color:var(--text3)">${k.label}</div>
        </div>`).join('')}
    </div>

    <!-- Form logbook -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-title" style="margin-bottom:14px">📝 Daily Log</div>

      <div class="form-group">
        <label>Apa yang saya kerjakan hari ini?</label>
        <textarea id="log-summary" rows="3" placeholder="Ringkasan aktivitas hari ini..." ${isLocked?'disabled':''}>${log.summary||''}</textarea>
      </div>
      <div class="form-group">
        <label>Hambatan / kendala hari ini</label>
        <textarea id="log-kendala" rows="2" placeholder="Jika ada hambatan..." ${isLocked?'disabled':''}>${log.kendala||''}</textarea>
      </div>
      <div class="form-group">
        <label>Rencana utama besok</label>
        <textarea id="log-rencana" rows="2" placeholder="Task atau target utama besok..." ${isLocked?'disabled':''}>${log.rencana_besok||''}</textarea>
      </div>

      <!-- Carry-over tasks -->
      ${pendTasks.length?`
      <div style="background:#FFF7ED;border-radius:var(--r);padding:12px;margin-bottom:14px">
        <div style="font-weight:700;font-size:12px;color:#C2410C;margin-bottom:8px">
          🔄 Task Pending — akan di-carry-over ke besok (${pendTasks.length} task)
        </div>
        ${pendTasks.map(t=>`
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12.5px">
            <span>⬜</span>
            <span style="flex:1">${t.title}</span>
            <span style="color:var(--text3)">${t.alokasi_jam||1}j</span>
            <input type="text" placeholder="Catatan carry-over..." id="co-note-${t.id}"
              style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:4px;width:180px">
          </div>`).join('')}
      </div>`:''}

      <!-- Mood -->
      <div class="form-group">
        <label>Energy Level Hari Ini</label>
        <div style="display:flex;gap:12px;margin-top:6px">
          ${[1,2,3,4].map(m=>`
            <label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer">
              <input type="radio" name="mood" value="${m}" ${(log.mood||3)==m?'checked':''} ${isLocked?'disabled':''}
                style="display:none" id="mood-${m}">
              <div onclick="${isLocked?'':'document.getElementById(\"mood-'+m+'\").checked=true'}"
                style="font-size:28px;cursor:pointer;transition:transform .15s;
                  ${(log.mood||3)==m?'transform:scale(1.3)':''}"
                class="mood-ico" data-mood="${m}">
                ${MOOD_ICONS[m]}
              </div>
              <span style="font-size:10px;color:var(--text3)">${MOOD_LABELS[m]}</span>
            </label>`).join('')}
        </div>
      </div>
    </div>

    <!-- Done tasks summary -->
    ${doneTasks.length?`
    <div class="card" style="margin-bottom:14px">
      <div class="card-title" style="margin-bottom:10px">✅ Task Selesai Hari Ini</div>
      ${doneTasks.map(t=>`
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px">
          <span>✅</span>
          <span style="flex:1;text-decoration:line-through;color:var(--text3)">${t.title}</span>
          <span style="color:var(--text3);font-size:11px">${t.category||'Admin'}</span>
          <input type="number" value="${t.actual_jam||t.alokasi_jam||1}" min="0" step="0.5"
            style="width:55px;text-align:center;border:1px solid var(--border);border-radius:4px;font-size:11px;padding:2px"
            onchange="updateActualJam(${t.id},this.value)" ${isLocked?'disabled':''}
            title="Jam aktual">
          <span style="font-size:10px;color:var(--text3)">j aktual</span>
        </div>`).join('')}
    </div>`:''}

    <!-- Logbook actions -->
    ${!isLocked?`
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="saveLogbook('${today}','Draft')">💾 Simpan Draft</button>
      <button class="btn btn-teal" onclick="submitLogbook('${today}')">📤 Submit ke SPV</button>
    </div>`:`
    <div class="status-box status-ok">✅ Logbook sudah disetujui SPV. Tidak bisa diubah lagi.</div>`}

    <!-- SPV: logbook pending review -->
    ${isSpvUser?`
    <div style="margin-top:20px">
      <div class="card-title" style="margin-bottom:12px">👥 Logbook Tim — Perlu Review</div>
      <div id="spv-logbook-list"><div class="spinner"></div></div>
    </div>`:''}`;

  if (isSpvUser) loadSpvLogbookList();
}

function shiftLogDate(days) {
  const d = new Date(taskState.logbookDate+'T00:00:00');
  d.setDate(d.getDate()+days);
  taskState.logbookDate = d.toISOString().split('T')[0];
  renderLogbook();
}

async function saveLogbook(tanggal, status='Draft') {
  const user  = getUserName?getUserName():'';
  const mood  = parseInt(document.querySelector('input[name="mood"]:checked')?.value||3);
  const payload = {
    employee_name:    user,
    tanggal,
    summary:          document.getElementById('log-summary')?.value.trim()||'',
    kendala:          document.getElementById('log-kendala')?.value.trim()||'',
    rencana_besok:    document.getElementById('log-rencana')?.value.trim()||'',
    mood,
    status,
    updated_at:       new Date().toISOString(),
  };
  if (status==='Submitted') payload.submitted_at = new Date().toISOString();

  try {
    const existing = await sbGet('daily_logs',`select=id&employee_name=eq.${encodeURIComponent(user)}&tanggal=eq.${tanggal}`).catch(()=>[]);
    if (existing[0]?.id) await sbPatch('daily_logs',existing[0].id,payload);
    else await sbPost('daily_logs',{...payload,created_at:new Date().toISOString()});
    toast(`✅ Logbook ${status==='Draft'?'disimpan':'disubmit'}!`,'ok');
    if (status==='Submitted') {
      sendTaskNotif('spv-group','logbook_submitted',`${user} submit logbook ${tanggal}`, 'task');
    }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function submitLogbook(tanggal) {
  // Carry-over pending tasks first
  const user = getUserName?getUserName():'';
  const pendTasks = taskState.myTasks.filter(t=>
    t.due_date===tanggal && !['Done','CarryOver'].includes(t.status)
  );

  for (const t of pendTasks) {
    const coNote = document.getElementById(`co-note-${t.id}`)?.value.trim();
    const tomorrow = new Date(tanggal+'T00:00:00');
    tomorrow.setDate(tomorrow.getDate()+1);
    const nextDate = tomorrow.toISOString().split('T')[0];
    try {
      // Create carry-over task for tomorrow
      await sbPost('tasks',{
        title:          t.title,
        type:           t.type,
        category:       t.category,
        assigned_to:    t.assigned_to,
        assigned_to_id: t.assigned_to_id,
        assigned_by:    t.assigned_by,
        due_date:       nextDate,
        alokasi_jam:    t.alokasi_jam,
        status:         'Todo',
        priority:       t.priority,
        carry_over_from:t.id,
        carry_over_count:(t.carry_over_count||0)+1,
        carry_over_note: coNote || `Dibawa dari ${tanggal}`,
        tags:           t.tags,
        created_by:     user,
        created_at:     new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      });
      // Mark original as CarryOver
      await sbPatch('tasks',t.id,{status:'CarryOver',updated_at:new Date().toISOString()});
    } catch(e) { console.error('Carry-over error:',e); }
  }

  await saveLogbook(tanggal,'Submitted');
  await renderLogbook();
}

async function updateActualJam(taskId, val) {
  try {
    await sbPatch('tasks',taskId,{actual_jam:parseFloat(val)||0,updated_at:new Date().toISOString()});
  } catch(e) { console.error(e); }
}

async function loadSpvLogbookList() {
  const el = document.getElementById('spv-logbook-list'); if(!el) return;
  try {
    const pending = await sbGet('daily_logs','select=*&status=eq.Submitted&order=tanggal.desc&limit=20');
    if(!pending?.length) { el.innerHTML='<div style="color:var(--text3);font-size:13px">Tidak ada logbook yang perlu direview</div>'; return; }
    el.innerHTML = `
      <div class="table-wrap">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="padding:8px 12px;background:var(--bg);font-size:11px;color:var(--text3);text-align:left;border-bottom:1px solid var(--border)">KARYAWAN</th>
            <th style="padding:8px 12px;background:var(--bg);font-size:11px;color:var(--text3);text-align:left;border-bottom:1px solid var(--border)">TANGGAL</th>
            <th style="padding:8px 12px;background:var(--bg);font-size:11px;color:var(--text3);text-align:left;border-bottom:1px solid var(--border)">RINGKASAN</th>
            <th style="padding:8px 12px;background:var(--bg);font-size:11px;color:var(--text3);text-align:center;border-bottom:1px solid var(--border)">AKSI</th>
          </tr></thead>
          <tbody>
            ${pending.map((lg,i)=>`
              <tr style="background:${i%2?'var(--bg2)':'#fff'};border-bottom:1px solid var(--border)">
                <td style="padding:10px 12px;font-weight:600">${lg.employee_name}</td>
                <td style="padding:10px 12px">${lg.tanggal}</td>
                <td style="padding:10px 12px;font-size:12px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lg.summary||'—'}</td>
                <td style="padding:10px 12px;text-align:center">
                  <div class="act-row" style="justify-content:center;gap:6px">
                    <button class="btn btn-accent btn-xs" onclick="approveLogbook(${lg.id},'Approved')">✅ Approve</button>
                    <button class="btn btn-danger btn-xs" onclick="requestLogbookRevision(${lg.id})">⚠️ Revisi</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) { el.innerHTML=`<div class="status-box status-err">${e.message}</div>`; }
}

async function approveLogbook(id, status) {
  const spv = getUserName?getUserName():'SPV';
  try {
    await sbPatch('daily_logs',id,{
      status,
      approved_by_spv: spv,
      approved_at_spv: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    toast('✅ Logbook diapprove','ok');
    loadSpvLogbookList();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function requestLogbookRevision(id) {
  const note = prompt('Catatan untuk revisi:');
  if (!note) return;
  const spv = getUserName?getUserName():'SPV';
  try {
    await sbPatch('daily_logs',id,{
      status:'Revision', spv_notes:note, spv_name:spv, updated_at:new Date().toISOString()
    });
    toast('⚠️ Logbook dikembalikan untuk revisi','warn');
    loadSpvLogbookList();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// VIEW 4: WEEKLY SUMMARY (Manager)
// ══════════════════════════════════════════════════════════════
async function renderWeeklySummary() {
  const el = document.getElementById('task-main-area'); if (!el) return;
  const weekDates = getWeekDates(taskState.weekStart);
  const role = getUserRole?getUserRole():'sales';
  const isManagerUser = isManager();

  if (!isManagerUser) {
    el.innerHTML = `<div class="empty-state"><div class="ico">🔒</div>
      <h3>Akses Terbatas</h3><p>Weekly Summary hanya untuk Manager & Admin.</p></div>`;
    return;
  }

  el.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

  try {
    const [logs, weekTasks] = await Promise.all([
      sbGet('daily_logs',`select=*&tanggal=gte.${weekDates[0]}&tanggal=lte.${weekDates[6]}&status=eq.Approved&order=employee_name,tanggal`).catch(()=>[]),
      sbGet('tasks',`select=*&due_date=gte.${weekDates[0]}&due_date=lte.${weekDates[6]}&order=assigned_to`).catch(()=>[]),
    ]);

    const empGroups = {};
    (logs||[]).forEach(l=>{
      if (!empGroups[l.employee_name]) empGroups[l.employee_name]={ logs:[], tasks:[] };
      empGroups[l.employee_name].logs.push(l);
    });
    (weekTasks||[]).forEach(t=>{
      if (t.assigned_to) {
        if (!empGroups[t.assigned_to]) empGroups[t.assigned_to]={ logs:[], tasks:[] };
        empGroups[t.assigned_to].tasks.push(t);
      }
    });

    const weekLabel = `${new Date(weekDates[0]+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long'})} – ${new Date(weekDates[6]+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}`;

    el.innerHTML = `
      <!-- Week nav -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <button class="btn btn-ghost btn-sm" onclick="shiftWeek(-1);renderWeeklySummary()">← Minggu Lalu</button>
        <div style="flex:1;text-align:center;font-size:14px;font-weight:700">${weekLabel}</div>
        <button class="btn btn-ghost btn-sm" onclick="shiftWeek(1);renderWeeklySummary()">Minggu Ini →</button>
      </div>

      ${Object.keys(empGroups).length===0?`
        <div class="empty-state"><div class="ico">📊</div>
          <h3>Belum ada data minggu ini</h3>
          <p>Data muncul setelah SPV menyetujui logbook anggota tim.</p>
        </div>`
      : Object.entries(empGroups).map(([emp,data])=>{
          const totalTask  = data.tasks.length;
          const doneTask   = data.tasks.filter(t=>t.status==='Done').length;
          const carryOver  = data.tasks.filter(t=>t.status==='CarryOver').length;
          const completePct= totalTask>0?Math.round(doneTask/totalTask*100):0;
          const avgMood    = data.logs.length
            ? (data.logs.reduce((s,l)=>s+(l.mood||3),0)/data.logs.length).toFixed(1)
            : null;
          const totalPlanJ = data.tasks.reduce((s,t)=>s+(parseFloat(t.alokasi_jam)||0),0);
          const logCount   = data.logs.length;

          return `
            <div class="card" style="margin-bottom:14px">
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--accent));
                  display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0">
                  ${emp.charAt(0).toUpperCase()}
                </div>
                <div style="flex:1">
                  <div style="font-weight:800;font-size:14px">${emp}</div>
                  <div style="font-size:11px;color:var(--text3)">${logCount}/5 logbook diapprove minggu ini</div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  ${[
                    {l:'Task Done',v:`${doneTask}/${totalTask}`,c:'#22C55E'},
                    {l:'Completion',v:`${completePct}%`,c:completePct>=80?'#22C55E':completePct>=50?'#F59E0B':'#EF4444'},
                    {l:'Carry-over',v:carryOver,c:carryOver>3?'#EF4444':'#94A3B8'},
                    ...(avgMood?[{l:'Avg Mood',v:`${MOOD_ICONS[Math.round(parseFloat(avgMood))]} ${avgMood}`,c:'#7C3AED'}]:[]),
                    {l:'Total Jam Plan',v:`${totalPlanJ.toFixed(1)}j`,c:'#0891B2'},
                  ].map(k=>`
                    <div style="text-align:center">
                      <div style="font-size:14px;font-weight:800;color:${k.c}">${k.v}</div>
                      <div style="font-size:10px;color:var(--text3)">${k.l}</div>
                    </div>`).join('')}
                </div>
              </div>
              <div style="height:8px;background:var(--bg2);border-radius:8px;overflow:hidden">
                <div style="height:100%;width:${completePct}%;background:${completePct>=80?'#22C55E':completePct>=50?'#F59E0B':'#EF4444'};border-radius:8px;transition:width .5s"></div>
              </div>
            </div>`;
        }).join('')}`;
  } catch(e) {
    el.innerHTML = `<div class="status-box status-err">❌ ${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// TASK FORM (Create/Edit)
// ══════════════════════════════════════════════════════════════
async function openTaskForm(id=null, defaultType='PRIMARY', defaultDate=null, defaultAssignee=null) {
  let t = {};
  let links = [];
  if (id) {
    const [td, tl] = await Promise.all([
      sbGet('tasks',`select=*&id=eq.${id}`),
      sbGet('task_links',`select=*&task_id=eq.${id}&order=id`).catch(()=>[]),
    ]);
    t = td[0]||{};
    links = tl||[];
  }

  const today   = defaultDate || new Date().toISOString().split('T')[0];
  const user    = getUserName?getUserName():'';
  const empOpts = taskState.employees.map(e=>
    `<option value="${e.full_name}" ${(t.assigned_to||defaultAssignee||user)===e.full_name?'selected':''}>${e.full_name} — ${e.division||'—'}</option>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📋 ${id?'Edit Task':'Task Baru'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-group">
      <label>Judul Task *</label>
      <input type="text" id="tf-title" value="${t.title||''}" placeholder="Judul task yang jelas dan spesifik...">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Tipe</label>
        <select id="tf-type">
          <option value="PRIMARY"   ${(t.type||defaultType)==='PRIMARY'?'selected':''}>🔴 Primary (Utama/Wajib)</option>
          <option value="SECONDARY" ${(t.type||defaultType)==='SECONDARY'?'selected':''}>🟡 Secondary (Tambahan)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Kategori</label>
        <select id="tf-cat">
          ${TASK_CATEGORIES.map(c=>`<option${(t.category||'Admin')===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Assigned To</label>
        <select id="tf-assignee"><option value="${user}">${user} (Saya)</option>${empOpts}</select>
      </div>
      <div class="form-group">
        <label>Prioritas</label>
        <select id="tf-priority">
          ${['Low','Normal','High','Critical'].map(p=>`<option${(t.priority||'Normal')===p?' selected':''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Due Date *</label>
        <input type="date" id="tf-date" value="${t.due_date||today}">
      </div>
      <div class="form-group">
        <label>Due Time</label>
        <input type="time" id="tf-time" value="${t.due_time?.slice(0,5)||''}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Alokasi Jam (Estimasi)</label>
        <input type="number" id="tf-jam" value="${t.alokasi_jam||1}" min="0.5" step="0.5">
        <div class="form-hint" id="tf-kap-hint" style="color:var(--teal)"></div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="tf-status">
          ${TASK_STATUSES.map(s=>`<option${(t.status||'Todo')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>Deskripsi / Catatan</label>
      <textarea id="tf-desc" rows="2" placeholder="Detail task, konteks, atau instruksi...">${t.description||''}</textarea>
    </div>

    <div class="form-group">
      <label>Tags (pisah koma)</label>
      <input type="text" id="tf-tags" value="${t.tags||''}" placeholder="lapangan, kunjungan, urgent...">
    </div>

    <!-- Links section -->
    <div class="form-group">
      <label>🔗 Links & Referensi</label>
      <div id="tf-links-list">
        ${links.map((l,i)=>`
          <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center" id="tf-link-row-${i}">
            <span style="font-size:16px">${LINK_TYPES[l.type]?.icon||'🔗'}</span>
            <input type="text" value="${l.label||''}" placeholder="Label" style="width:120px;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">
            <input type="url" value="${l.url}" placeholder="https://..." style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px"
              oninput="autoDetectLinkType(this,${i})">
            <button onclick="document.getElementById('tf-link-row-${i}').remove()" class="act-btn del">✕</button>
          </div>`).join('')}
        <div id="tf-links-extra"></div>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:4px" onclick="addLinkRow()">+ Tambah Link</button>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      ${id?`<button class="btn btn-danger btn-sm" onclick="deleteTask(${id})">🗑 Hapus</button>`:''}
      <button class="btn btn-teal" onclick="saveTask(${id||'null'})">💾 Simpan Task</button>
    </div>`);

  // Kapasitas hint
  document.getElementById('tf-jam')?.addEventListener('input', updateCapacityHint);
  document.getElementById('tf-date')?.addEventListener('change', updateCapacityHint);
  document.getElementById('tf-assignee')?.addEventListener('change', updateCapacityHint);
  updateCapacityHint();
}

let linkRowCount = 0;
function addLinkRow() {
  const el = document.getElementById('tf-links-extra'); if (!el) return;
  const i = `new_${++linkRowCount}`;
  el.insertAdjacentHTML('beforeend',`
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center" id="tf-link-row-${i}">
      <span style="font-size:16px" id="tf-link-icon-${i}">🔗</span>
      <input type="text" id="tf-link-label-${i}" placeholder="Label" style="width:120px;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">
      <input type="url" id="tf-link-url-${i}" placeholder="https://..." style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px"
        oninput="autoDetectIcon('tf-link-icon-${i}',this.value)">
      <button onclick="document.getElementById('tf-link-row-${i}').remove()" class="act-btn del">✕</button>
    </div>`);
}

function autoDetectIcon(iconElId, url) {
  const t = detectLinkType(url);
  const el = document.getElementById(iconElId);
  if (el) el.textContent = LINK_TYPES[t]?.icon||'🔗';
}

function updateCapacityHint() {
  const hint = document.getElementById('tf-kap-hint'); if (!hint) return;
  const jam  = parseFloat(document.getElementById('tf-jam')?.value||1);
  const type = document.getElementById('tf-type')?.value||'PRIMARY';
  const sched = taskState.mySchedule;
  if (sched) {
    const kap     = parseFloat(sched.kapasitas_jam||7);
    const priMax  = kap * ((sched.primary_max_pct||80)/100);
    const pct     = Math.round(jam/kap*100);
    hint.textContent = `${pct}% dari kapasitas harian ${kap}j (${type==='PRIMARY'?`max Primary: ${priMax.toFixed(1)}j`:''})`;
    hint.style.color = type==='PRIMARY'&&jam>priMax?'#EF4444':'var(--teal)';
  }
}

async function saveTask(id) {
  const title = document.getElementById('tf-title')?.value.trim();
  if (!title) { toast('Judul task wajib','err'); return; }

  const assignee = document.getElementById('tf-assignee')?.value;
  const user     = getUserName?getUserName():'';
  const payload  = {
    title,
    type:       document.getElementById('tf-type')?.value||'PRIMARY',
    category:   document.getElementById('tf-cat')?.value||'Admin',
    assigned_to:assignee||user,
    assigned_by:user,
    due_date:   document.getElementById('tf-date')?.value||null,
    due_time:   document.getElementById('tf-time')?.value||null,
    alokasi_jam:parseFloat(document.getElementById('tf-jam')?.value||1),
    status:     document.getElementById('tf-status')?.value||'Todo',
    priority:   document.getElementById('tf-priority')?.value||'Normal',
    description:document.getElementById('tf-desc')?.value.trim()||null,
    tags:       document.getElementById('tf-tags')?.value.trim()||null,
    updated_at: new Date().toISOString(),
  };
  if (!id) { payload.created_by = user; payload.created_at = new Date().toISOString(); }

  try {
    let taskId = id;
    if (id) await sbPatch('tasks',id,payload);
    else {
      const res = await sbPost('tasks',payload);
      taskId = res[0]?.id;
    }

    // Save links
    if (taskId) {
      if (id) {
        await fetch(`${SUPABASE_URL}/rest/v1/task_links?task_id=eq.${taskId}`,{
          method:'DELETE',headers:{...SB_HEADERS,'Prefer':'return=minimal'}
        }).catch(()=>{});
      }
      // Collect all link rows
      const linkRows = document.querySelectorAll('[id^="tf-link-row-"]');
      const linkPayloads = [];
      linkRows.forEach(row=>{
        const urlEl   = row.querySelector('input[type="url"]');
        const labelEl = row.querySelector('input[type="text"]:not([id*="url"])');
        const url     = urlEl?.value.trim();
        if (url) linkPayloads.push({
          task_id: taskId,
          label:   labelEl?.value.trim()||'',
          url,
          type:    detectLinkType(url),
        });
      });
      if (linkPayloads.length) await sbPost('task_links',linkPayloads);
    }

    // Notify if assigned to someone else
    if (assignee && assignee !== user) {
      sendTaskNotif(assignee,'task_assigned',`Task baru dari ${user}: "${title}"`, 'task');
    }

    toast(`✅ Task ${id?'diupdate':'dibuat'}`,'ok');
    closeModalForce();
    await loadTaskData();
    renderMyTasks();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function openTaskDetail(id) {
  const [td, tl, tlogs] = await Promise.all([
    sbGet('tasks',`select=*&id=eq.${id}`),
    sbGet('task_links',`select=*&task_id=eq.${id}`).catch(()=>[]),
    sbGet('task_logs',`select=*&task_id=eq.${id}&order=created_at.desc&limit=20`).catch(()=>[]),
  ]);
  const t = {...(td[0]||{}), _links: tl||[]};
  const STATUS_COLOR = {Todo:'#94A3B8',InProgress:'#0891B2',Done:'#22C55E',Blocked:'#EF4444',CarryOver:'#F59E0B'};

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t.title||'—'}</div>
        <div style="font-size:11.5px;color:var(--text3)">${t.category||'Admin'} · ${t.type} · ${t.assigned_to||'—'}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="closeModalForce();openTaskForm(${id})">✏️ Edit</button>
        <button class="modal-close" onclick="closeModalForce()">✕</button>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <span class="badge badge-teal">${t.type}</span>
      <span style="padding:3px 10px;border-radius:10px;font-size:11.5px;font-weight:700;
        background:${STATUS_COLOR[t.status]||'var(--bg2)'}20;color:${STATUS_COLOR[t.status]||'var(--text3)'}">${t.status}</span>
      ${t.priority!=='Normal'?`<span class="badge badge-red">${t.priority}</span>`:''}
    </div>

    ${t.description?`<div style="background:var(--bg2);border-radius:var(--r);padding:10px 14px;margin-bottom:14px;font-size:13px">${t.description}</div>`:''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:12.5px">
      ${[
        ['📅 Due Date', t.due_date||(t.due_time?'—':'—')],
        ['⏱ Alokasi', `${t.alokasi_jam||1}j plan · ${t.actual_jam||0}j aktual`],
        ['👤 Assigned To', t.assigned_to||'—'],
        ['👤 Assigned By', t.assigned_by||'—'],
        ['🔄 Carry-over', t.carry_over_count?`${t.carry_over_count}x`:'—'],
        ['🏷 Tags', t.tags||'—'],
      ].map(([l,v])=>`<div><span style="color:var(--text3)">${l}: </span><strong>${v}</strong></div>`).join('')}
    </div>

    ${t._links?.length?`
    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:12px;margin-bottom:8px">🔗 Links</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${t._links.map(l=>`
          <a href="${l.url}" target="_blank" style="display:flex;align-items:center;gap:5px;
            padding:5px 10px;border-radius:6px;background:var(--bg2);color:var(--teal);
            text-decoration:none;border:1px solid var(--border);font-size:12px">
            ${LINK_TYPES[l.type]?.icon||'🔗'} ${l.label||l.url.slice(0,40)}
          </a>`).join('')}
      </div>
    </div>`:''}

    <!-- Quick status change -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${['Todo','InProgress','Done','Blocked'].map(s=>`
        <button class="btn btn-sm ${t.status===s?'btn-teal':'btn-ghost'}"
          onclick="changeTaskStatus(${id},'${s}')">
          ${s===t.status?'✓ ':''} ${s}
        </button>`).join('')}
    </div>

    ${t.carry_over_note?`<div class="status-box status-warn" style="margin-bottom:14px;font-size:12px">🔄 ${t.carry_over_note}</div>`:''}

    <!-- Activity log -->
    ${tlogs?.length?`
    <div style="margin-top:14px">
      <div style="font-weight:700;font-size:12px;margin-bottom:8px">📋 Activity Log</div>
      ${tlogs.map(l=>`
        <div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">
          <span style="color:var(--text3)">${l.created_at?.slice(0,16)||'—'}</span>
          · <strong>${l.by_user||'—'}</strong> · ${l.action}
          ${l.note?`<div style="color:var(--text3);font-size:11px;margin-top:2px">${l.note}</div>`:''}
        </div>`).join('')}
    </div>`:''}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      ${t.status!=='Done'?`<button class="btn btn-accent" onclick="markTaskDone(${id});closeModalForce()">✅ Tandai Selesai</button>`:''}
    </div>`);
}

async function quickStatusToggle(id, currentStatus) {
  const next = {Todo:'InProgress', InProgress:'Done', Done:'Todo', Blocked:'Todo', CarryOver:'InProgress'};
  await changeTaskStatus(id, next[currentStatus]||'Todo');
}

async function changeTaskStatus(id, status) {
  const user = getUserName?getUserName():'';
  const payload = { status, updated_at: new Date().toISOString() };
  if (status==='Done') {
    payload.completed_at = new Date().toISOString();
    // Prompt actual hours
    const actualJam = prompt('Berapa jam aktual yang dihabiskan?','1');
    if (actualJam !== null) payload.actual_jam = parseFloat(actualJam)||0;
  }
  try {
    await sbPatch('tasks',id,payload);
    await sbPost('task_logs',{task_id:id,action:'status_change',new_value:status,by_user:user,created_at:new Date().toISOString()});
    toast(`✅ Status → ${status}`,'ok',1500);
    await loadTaskData();
    renderMyTasks();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function markTaskDone(id) { await changeTaskStatus(id,'Done'); }

async function deleteTask(id) {
  if (!confirm('Hapus task ini?')) return;
  try {
    await sbDelete('tasks',id);
    toast('🗑 Task dihapus','info');
    closeModalForce();
    await loadTaskData();
    renderMyTasks();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Notifications ──────────────────────────────────────────
async function sendTaskNotif(toUser, type, message, linkAction='task') {
  try {
    await sbPost('task_notifications',{
      user_name:toUser, type, message,
      title:type.replace(/_/g,' '),
      link_action:linkAction,
      is_read:false,
      created_at:new Date().toISOString(),
    });
  } catch(e) { console.log('Notif error (non-critical):',e.message); }
}

async function loadMyNotifications() {
  const user = getUserName?getUserName():'';
  try {
    const notifs = await sbGet('task_notifications',
      `select=*&user_name=eq.${encodeURIComponent(user)}&is_read=eq.false&order=created_at.desc&limit=10`);
    const badge = document.getElementById('task-notif-badge');
    if (badge) badge.textContent = notifs?.length||'';
    return notifs||[];
  } catch(e) { return []; }
}
