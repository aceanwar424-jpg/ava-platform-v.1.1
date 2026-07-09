// ═══════════════════════════════════════════════════════════════
// MODULE: Executive Dashboard — Ace Darojatun Anwar
// Toggle: Standard View ↔ Executive View
// ═══════════════════════════════════════════════════════════════

let execState = {
  tasks:     [],
  attendance:[],
  employees: [],
  isLoading: false,
  lastRefresh: null,
};

const EXEC_ROLE = ['super_admin'];

function isExecUser() {
  const role = getUserRole?getUserRole():'sales';
  const name = getUserName?getUserName():'';
  return isSpv() || name.toLowerCase().includes('ace');
}

// ── TOGGLE BUTTON (inject ke topbar) ─────────────────────────
function injectExecToggle() {
  if (!isExecUser()) return;
  const topbar = document.getElementById('topbar-right');
  if (!topbar || document.getElementById('exec-toggle-btn')) return;
  const btn = document.createElement('button');
  btn.id        = 'exec-toggle-btn';
  btn.className = 'topbar-btn';
  btn.title     = 'Executive Dashboard';
  btn.style.cssText = 'background:var(--navy);color:#fff;border-color:var(--navy);font-size:12px;padding:4px 10px;width:auto';
  btn.textContent   = '👁 Exec View';
  btn.onclick       = toggleExecView;
  topbar.insertBefore(btn, topbar.firstChild);
}

let execViewActive = false;
function toggleExecView() {
  execViewActive = !execViewActive;
  const btn = document.getElementById('exec-toggle-btn');
  if (btn) {
    btn.textContent   = execViewActive ? '← Standard View' : '👁 Exec View';
    btn.style.background = execViewActive ? 'var(--teal)' : 'var(--navy)';
    btn.style.borderColor= execViewActive ? 'var(--teal)' : 'var(--navy)';
  }
  if (execViewActive) renderExecutiveDashboard();
  else { execViewActive = false; navigate('dashboard'); }
}

// ── MAIN EXECUTIVE DASHBOARD ──────────────────────────────────
async function renderExecutiveDashboard() {
  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <div>
        <h1 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:800;
          color:var(--text);letter-spacing:-.3px">
          👁 Executive Dashboard
        </h1>
        <p style="font-size:13px;color:var(--text3)">
          Real-time monitoring · Semua tim · Quick decision
          <span id="exec-last-refresh" style="margin-left:10px;font-size:11px;color:var(--border2)"></span>
        </p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="refreshExecDashboard()">↻ Refresh</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleExecView()">← Standard View</button>
      </div>
    </div>

    <!-- KPI Row -->
    <div id="exec-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:18px">
      ${[1,2,3,4,5,6].map(()=>`<div class="kpi-card"><div class="kpi-icon" style="background:var(--bg2)"><div class="spinner" style="width:14px;height:14px;border-width:2px"></div></div><div><div class="kpi-val">—</div><div class="kpi-label">...</div></div></div>`).join('')}
    </div>

    <!-- Attendance live -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title">⏰ Kehadiran Hari Ini</div>
        <button class="btn btn-ghost btn-xs" onclick="renderAttendance()">Lihat Detail →</button>
      </div>
      <div id="exec-attendance"><div class="spinner"></div></div>
    </div>

    <!-- Task Monitor -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="card-title">📋 All Tasks — Live Monitor</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['Semua','Overdue','Blocked','Todo','InProgress'].map((f,i)=>`
            <button class="btn btn-xs ${i===0?'btn-navy':'btn-ghost'}" id="exec-filter-${f.toLowerCase().replace(' ','')}"
              onclick="execFilterTasks('${f}',this)">
              ${f} ${f!=='Semua'?`<span id="exec-cnt-${f.toLowerCase().replace(' ','')}" style="font-size:9px"></span>`:''}
            </button>`).join('')}
        </div>
      </div>
      <div id="exec-task-table" style="max-height:50vh;overflow-y:auto">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>`;

  await loadExecData();
  renderExecKPI();
  renderExecAttendance();
  renderExecTasks('Semua');
  updateExecRefreshTime();

  // Auto-refresh every 2 minutes
  if (window._execRefreshTimer) clearInterval(window._execRefreshTimer);
  window._execRefreshTimer = setInterval(()=>{
    if (execViewActive) refreshExecDashboard();
  }, 120000);
}

async function loadExecData() {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart ? getWeekStart() : today;
  const [tasks, att, emps] = await Promise.all([
    sbGet('tasks',`select=*&order=due_date.asc,status.asc&limit=200`).catch(()=>[]),
    sbGet('attendance',`select=*&tanggal=eq.${today}&order=employee_name`).catch(()=>[]),
    sbGet('employees','select=id,full_name,position,division&status=eq.Aktif&order=full_name').catch(()=>[]),
  ]);
  execState.tasks      = Array.isArray(tasks) ? tasks : [];
  execState.attendance = Array.isArray(att)   ? att   : [];
  execState.employees  = Array.isArray(emps)  ? emps  : [];
  execState.lastRefresh= new Date();
}

async function refreshExecDashboard() {
  await loadExecData();
  renderExecKPI();
  renderExecAttendance();
  const activeFilter = document.querySelector('[id^="exec-filter-"].btn-navy')?.textContent?.trim()||'Semua';
  renderExecTasks(activeFilter);
  updateExecRefreshTime();
  toast('↻ Data diperbarui','info',1500);
}

function updateExecRefreshTime() {
  const el = document.getElementById('exec-last-refresh');
  if (el && execState.lastRefresh) {
    el.textContent = `Last refresh: ${execState.lastRefresh.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`;
  }
}

function renderExecKPI() {
  const el = document.getElementById('exec-kpi'); if (!el) return;
  const today   = new Date().toISOString().split('T')[0];
  const tasks   = execState.tasks;
  const att     = execState.attendance;
  const emps    = execState.employees;

  const hadir   = att.filter(a=>a.clock_in_at).length;
  const overdue = tasks.filter(t=>t.due_date<today&&!['Done','CarryOver'].includes(t.status)).length;
  const blocked = tasks.filter(t=>t.status==='Blocked').length;
  const doneToday= tasks.filter(t=>t.completed_at?.slice(0,10)===today).length;
  const noAssign = tasks.filter(t=>!t.assigned_to&&t.status!=='Done').length;
  const highPri = tasks.filter(t=>['High','Critical'].includes(t.priority)&&t.status!=='Done').length;

  el.innerHTML = [
    {icon:'👥', val:`${hadir}/${emps.length}`, label:'Hadir Hari Ini',  color:'#22C55E'},
    {icon:'⚠️', val:overdue,                   label:'Task Overdue',    color:'#EF4444'},
    {icon:'🚫', val:blocked,                   label:'Task Blocked',    color:'#F59E0B'},
    {icon:'✅', val:doneToday,                 label:'Done Hari Ini',   color:'#0891B2'},
    {icon:'❗', val:highPri,                   label:'Prioritas Tinggi',color:'#7C3AED'},
    {icon:'👤', val:noAssign,                  label:'Tanpa PIC',       color:'#94A3B8'},
  ].map(k=>`
    <div class="kpi-card" style="border-top:3px solid ${k.color};cursor:pointer"
      onclick="execFilterTasks(k.label,null)">
      <div class="kpi-icon" style="background:${k.color}18;font-size:18px">${k.icon}</div>
      <div>
        <div class="kpi-val" style="font-size:${String(k.val).length>4?'16px':'22px'};color:${k.val&&k.val>0&&k.color!=='#22C55E'&&k.color!=='#0891B2'?k.color:'var(--text)'}">${k.val}</div>
        <div class="kpi-label">${k.label}</div>
      </div>
    </div>`).join('');
}

function renderExecAttendance() {
  const el = document.getElementById('exec-attendance'); if (!el) return;
  const att  = execState.attendance;
  const emps = execState.employees;
  const STATUS_COLOR = {OnTime:'#22C55E',Late:'#F59E0B',VeryLate:'#EF4444'};

  if (!emps.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">Tidak ada data karyawan</div>'; return; }

  el.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">
    ${emps.map(emp=>{
      const rec = att.find(a=>a.employee_name===emp.full_name);
      const sc  = STATUS_COLOR[rec?.clock_in_status]||'#94A3B8';
      const hasClockedIn  = !!rec?.clock_in_at;
      const hasClockedOut = !!rec?.clock_out_at;
      return `
        <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--r);
          background:${hasClockedIn?sc+'18':'var(--bg2)'};border:1px solid ${hasClockedIn?sc:'var(--border)'};
          min-width:130px" title="${emp.position||'—'}">
          <div style="width:8px;height:8px;border-radius:50%;background:${hasClockedIn?sc:'#94A3B8'};flex-shrink:0"></div>
          <div style="min-width:0">
            <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${emp.full_name.split(' ').slice(0,2).join(' ')}
            </div>
            <div style="font-size:10px;color:${hasClockedIn?sc:'var(--text3)'}">
              ${hasClockedIn
                ? (hasClockedOut
                    ? `Out ${rec.clock_out_at?.slice(11,16)} · ${rec.total_jam_kerja?.toFixed(1)||'?'}j`
                    : `In ${rec.clock_in_at?.slice(11,16)} · ${rec.clock_in_status||''}`)
                : 'Belum hadir'}
            </div>
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function execFilterTasks(filter, btn) {
  // Update button styles
  document.querySelectorAll('[id^="exec-filter-"]').forEach(b=>{
    b.className = 'btn btn-xs btn-ghost';
  });
  if (btn) btn.className = 'btn btn-xs btn-navy';
  renderExecTasks(filter);
}

function renderExecTasks(filter) {
  const el = document.getElementById('exec-task-table'); if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  let tasks = [...execState.tasks];

  if (filter === 'Overdue')    tasks = tasks.filter(t=>t.due_date<today&&!['Done','CarryOver'].includes(t.status));
  else if (filter === 'Blocked')    tasks = tasks.filter(t=>t.status==='Blocked');
  else if (filter === 'Todo')       tasks = tasks.filter(t=>t.status==='Todo');
  else if (filter === 'InProgress') tasks = tasks.filter(t=>t.status==='InProgress');
  else tasks = tasks.filter(t=>!['Done','CarryOver'].includes(t.status));

  // Update counts
  const today2 = new Date().toISOString().split('T')[0];
  [['overdue',t=>t.due_date<today2&&!['Done','CarryOver'].includes(t.status)],
   ['blocked',t=>t.status==='Blocked'],['todo',t=>t.status==='Todo'],
   ['inprogress',t=>t.status==='InProgress']].forEach(([key,fn])=>{
    const cnt = document.getElementById(`exec-cnt-${key}`);
    if (cnt) cnt.textContent = `(${execState.tasks.filter(fn).length})`;
  });

  if (!tasks.length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text3)">
      ${filter==='Semua'?'Tidak ada task aktif 🎉':'Tidak ada task dengan filter ini'}
    </div>`; return;
  }

  const STATUS_COLOR = {Todo:'#94A3B8',InProgress:'#0891B2',Done:'#22C55E',Blocked:'#EF4444',CarryOver:'#F59E0B'};
  const PRIORITY_COLOR = {Low:'#94A3B8',Normal:'#64748B',High:'#F59E0B',Critical:'#EF4444'};

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead style="position:sticky;top:0;z-index:1">
        <tr style="background:var(--navy)">
          ${['PIC','TASK','PRIORITAS','DEADLINE','STATUS','LAST UPDATE','AKSI'].map(h=>`
            <th style="padding:8px 12px;color:#fff;text-align:left;font-size:10.5px;
              white-space:nowrap;font-weight:700">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${tasks.map((t,i)=>{
          const isOverdue  = t.due_date < today && !['Done','CarryOver'].includes(t.status);
          const sc         = STATUS_COLOR[t.status]||'#94A3B8';
          const pc         = PRIORITY_COLOR[t.priority]||'#64748B';
          const lastUpdate = t.updated_at?.slice(0,16).replace('T',' ')||'—';
          const assignedShort = (t.assigned_to||'—').split(' ').slice(0,2).join(' ');
          return `
            <tr style="background:${isOverdue?'#FEF2F2':i%2?'var(--bg2)':'#fff'};
              border-bottom:1px solid var(--border);transition:background .1s"
              onmouseover="this.style.background='${isOverdue?'#FEE2E2':'#EFF9FC'}'"
              onmouseout="this.style.background='${isOverdue?'#FEF2F2':i%2?'var(--bg2)':'#fff'}'">
              <td style="padding:8px 12px;font-weight:700;white-space:nowrap">
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="width:26px;height:26px;border-radius:50%;background:var(--teal);
                    color:#fff;display:flex;align-items:center;justify-content:center;
                    font-size:10px;font-weight:700;flex-shrink:0">
                    ${(t.assigned_to||'?').charAt(0).toUpperCase()}
                  </div>
                  ${assignedShort}
                </div>
              </td>
              <td style="padding:8px 12px;max-width:220px">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                  max-width:220px" title="${t.title}">${t.title}</div>
                <div style="font-size:10.5px;color:var(--text3)">${t.category||'—'} · ${t.type}</div>
              </td>
              <td style="padding:8px 12px;white-space:nowrap">
                <span style="color:${pc};font-weight:700;font-size:11px">${t.priority||'Normal'}</span>
              </td>
              <td style="padding:8px 12px;white-space:nowrap;font-weight:${isOverdue?700:400};
                color:${isOverdue?'#DC2626':'var(--text)'}">
                ${isOverdue?'⚠️ ':''} ${t.due_date||'—'}
              </td>
              <td style="padding:8px 12px;white-space:nowrap">
                <span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:10px;
                  font-size:11px;font-weight:700">${t.status}</span>
              </td>
              <td style="padding:8px 12px;color:var(--text3);font-size:11px;white-space:nowrap">
                ${lastUpdate}
              </td>
              <td style="padding:8px 12px">
                <div class="act-row" style="gap:4px;flex-wrap:nowrap">
                  <button class="btn btn-xs btn-ghost" onclick="openTaskDetail(${t.id})" title="Detail">👁</button>
                  <button class="btn btn-xs btn-outline" onclick="execAssignExtra(${t.id},'${(t.title||'').replace(/'/g,'').slice(0,30)}')" title="Assign Tambahan">👥</button>
                  <button class="btn btn-xs" style="background:var(--teal);color:#fff"
                    onclick="execPingPIC(${t.id},'${(t.assigned_to||'').replace(/'/g,'')}')" title="Ping WA">💬</button>
                  ${t.status!=='Done'?`<button class="btn btn-xs" style="background:#22C55E;color:#fff"
                    onclick="execForceDone(${t.id})" title="Force Done">✅</button>`:''}
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── QUICK ACTIONS ─────────────────────────────────────────────
async function execAssignExtra(taskId, taskTitle) {
  const emps = execState.employees;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">👥 Assign Tambahan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px">
      Task: <strong>${taskTitle}</strong>
    </div>
    <div class="form-group">
      <label>Tambah Assignee (bantu ambil alih)</label>
      <select id="exec-extra-assignee">
        <option value="">-- Pilih Karyawan --</option>
        ${emps.map(e=>`<option value="${e.full_name}">${e.full_name} — ${e.position||'—'}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <input type="text" id="exec-extra-note" placeholder="Instruksi khusus...">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="doExecAssignExtra(${taskId})">👥 Assign</button>
    </div>`,'narrow');
}

async function doExecAssignExtra(taskId) {
  const assignee = document.getElementById('exec-extra-assignee')?.value;
  const note     = document.getElementById('exec-extra-note')?.value.trim();
  if (!assignee) { toast('Pilih karyawan dulu','err'); return; }
  const user = getUserName?getUserName():'Ace';
  try {
    // Get current task
    const td = await sbGet('tasks',`select=*&id=eq.${taskId}`);
    const t  = td[0]; if (!t) return;
    // Update with co-assignee tag
    const newTags = [t.tags||'', `co:${assignee}`].filter(Boolean).join(',');
    await sbPatch('tasks',taskId,{
      tags:       newTags,
      updated_at: new Date().toISOString(),
    });
    // Log
    await sbPost('task_logs',{
      task_id:taskId, action:'co_assigned',
      new_value:assignee, note:`${note||'Diassign tambahan oleh '+ user}`,
      by_user:user, created_at:new Date().toISOString(),
    });
    // Notify
    if (typeof sendTaskNotif === 'function') {
      sendTaskNotif(assignee,'task_assigned',`[${user}] assign kamu bantu task: "${t.title}"`, 'task');
    }
    toast(`✅ ${assignee} ditambahkan sebagai co-assignee`,'ok');
    closeModalForce();
    await refreshExecDashboard();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function execPingPIC(taskId, assignee) {
  if (!assignee) { toast('Task tidak punya PIC','warn'); return; }
  const td = await sbGet('tasks',`select=title,due_date,status&id=eq.${taskId}`).catch(()=>[]);
  const t  = td[0]||{};
  const msg = `📋 *Reminder Task OneLab*\n\nHai ${assignee.split(' ')[0]},\n\nTask berikut memerlukan update:\n*${t.title||'—'}*\nDeadline: ${t.due_date||'—'}\nStatus: ${t.status||'—'}\n\nMohon update progress atau hubungi Head of Operations jika ada kendala.\n\n_Pesan otomatis dari sistem OneLab_`;
  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url,'_blank');
  toast(`💬 WA dibuka untuk ${assignee.split(' ')[0]}`,'ok',2000);
}

async function execForceDone(taskId) {
  if (!confirm('Tandai task ini sebagai Done?')) return;
  const user = getUserName?getUserName():'Ace';
  try {
    await sbPatch('tasks',taskId,{
      status:'Done', completed_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    });
    await sbPost('task_logs',{
      task_id:taskId, action:'force_done',
      note:`Force done by ${user}`, by_user:user,
      created_at:new Date().toISOString(),
    });
    toast('✅ Task ditandai Done','ok');
    await refreshExecDashboard();
  } catch(e) { toast('❌ '+e.message,'err'); }
}
