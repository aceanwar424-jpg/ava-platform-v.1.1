// ═══════════════════════════════════════════
// MODULE: HRD & SDM v2 — Complete
// ═══════════════════════════════════════════

const HRD_DIVISIONS = [
  'Laboratory','Sales & Marketing','Operasional','Finance','HRD','IT','Management','Lainnya'
];
const LEAVE_TYPES = ['Cuti Tahunan','Cuti Sakit','Cuti Melahirkan','Izin','Cuti Khusus','Tanpa Keterangan'];

let empAll = [], leaveAll = [], hrdPositionsCache = [];

async function renderHRD() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>HRD &amp; SDM</h1>
        <p>Data karyawan, absensi, cuti, dan penggajian OneLab Diagnostics</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="openBulkSyncPositionShift()">🔗 Lengkapi Jabatan &amp; Jadwal</button>
        <button class="btn btn-ghost btn-sm" onclick="openPayrollModal()">💵 Payroll</button>
        <button class="btn btn-teal" onclick="openEmpForm()">+ Tambah Karyawan</button>
      </div>
    </div>

    <!-- KPI -->
    <div id="hrd-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <div class="tabs" id="hrd-tabs">
      <button class="tab-btn active" onclick="switchHRDTab('emp',this)">👥 Data Karyawan</button>
      <button class="tab-btn" onclick="switchHRDTab('leave',this)">🕐 Absensi &amp; Cuti</button>
      <button class="tab-btn" onclick="switchHRDTab('payroll',this)">💵 Penggajian</button>
    </div>

    <!-- Karyawan Tab -->
    <div id="hrd-emp">
      <div class="table-wrap">
        <div class="table-toolbar">
          <input class="table-search" id="emp-q" placeholder="🔍 Cari nama, posisi, divisi..."
            oninput="filterEmp()" style="flex:1">
          <select class="table-filter" id="emp-div" onchange="filterEmp()">
            <option value="">Semua Divisi</option>
            ${HRD_DIVISIONS.map(d=>`<option>${d}</option>`).join('')}
          </select>
          <select class="table-filter" id="emp-status" onchange="filterEmp()">
            <option value="">Semua Status</option>
            <option>Aktif</option><option>Non-Aktif</option><option>Probasi</option><option>Kontrak</option>
          </select>
        </div>
        <div id="emp-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Leave Tab -->
    <div id="hrd-leave" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:14px;font-weight:700;color:var(--navy)">Pengajuan Cuti & Izin</div>
        <button class="btn btn-teal btn-sm" onclick="openLeaveForm()">+ Ajukan Cuti</button>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <select class="table-filter" id="leave-status" onchange="loadLeaves()">
            <option value="">Semua Status</option>
            <option>Pending</option><option>Approved</option><option>Rejected</option>
          </select>
          <select class="table-filter" id="leave-type" onchange="loadLeaves()">
            <option value="">Semua Tipe</option>
            ${LEAVE_TYPES.map(t=>`<option>${t}</option>`).join('')}
          </select>
        </div>
        <div id="leave-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Payroll Tab -->
    <div id="hrd-payroll" style="display:none">
      <div id="payroll-content">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>`;

  await Promise.all([loadEmployees(), loadLeaves()]);
}

let linkedEmployeeIds = new Set();

async function loadEmployees() {
  try {
    const [data, linkedUsers] = await Promise.all([
      sbGet('employees','select=*&order=full_name.asc'),
      sbGet('user_profiles','select=employee_id&employee_id=not.is.null').catch(()=>[]),
    ]);
    empAll = Array.isArray(data) ? data : [];
    linkedEmployeeIds = new Set((linkedUsers||[]).map(u=>u.employee_id));
    renderHRDKPI();
    filterEmp();
  } catch(e) {
    document.getElementById('emp-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderHRDKPI() {
  const el = document.getElementById('hrd-kpi');
  if (!el) return;
  const active   = empAll.filter(e=>e.status==='Aktif').length;
  const probasi  = empAll.filter(e=>e.status==='Probasi').length;
  const kontrak  = empAll.filter(e=>e.status==='Kontrak').length;
  const totalGaji= empAll.filter(e=>e.status==='Aktif').reduce((s,e)=>s+(e.base_salary||0),0);
  const byDiv    = {};
  empAll.forEach(e=>{ byDiv[e.division]=(byDiv[e.division]||0)+1; });
  const topDiv   = Object.entries(byDiv).sort((a,b)=>b[1]-a[1])[0];

  el.innerHTML = [
    {icon:'👥',val:empAll.length,  label:'Total Karyawan', color:'#0A2342'},
    {icon:'✅',val:active,         label:'Aktif',           color:'#22C55E'},
    {icon:'🔄',val:probasi,        label:'Probasi',         color:'#F59E0B'},
    {icon:'📋',val:kontrak,        label:'Kontrak',         color:'#0EA5E9'},
    {icon:'💰',val:formatCurrency(totalGaji),label:'Total Gaji/Bln',color:'#8B5CF6'},
    {icon:'🏆',val:topDiv?`${topDiv[0]} (${topDiv[1]})`:'—',label:'Divisi Terbesar',color:'#00897B'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);
      border-left:4px solid ${k.color}">
      <div style="font-size:20px">${k.icon}</div>
      <div style="font-size:${k.val.toString().length>8?'12px':'16px'};font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

function filterEmp() {
  const q   = (document.getElementById('emp-q')?.value||'').toLowerCase();
  const div = document.getElementById('emp-div')?.value||'';
  const st  = document.getElementById('emp-status')?.value||'';
  const f   = empAll.filter(e=>
    (!q  || (e.full_name||'').toLowerCase().includes(q)||(e.position||'').toLowerCase().includes(q)) &&
    (!div|| e.division===div) &&
    (!st || e.status===st)
  );
  renderEmpTable(f);
}

function renderEmpTable(data) {
  const el = document.getElementById('emp-tbody');
  if (!data.length) {
    el.innerHTML=`<div class="empty-state"><div class="ico">👥</div>
      <h3>${empAll.length?'Tidak ada hasil':'Belum ada data karyawan'}</h3>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openEmpForm()">+ Tambah Karyawan</button>
    </div>`; return;
  }

  const stColors={Aktif:'#22C55E',Probasi:'#F59E0B',Kontrak:'#0EA5E9','Non-Aktif':'#EF4444'};
  el.innerHTML=`<table><thead><tr>
    <th>Karyawan</th><th>Divisi & Posisi</th><th>Kontak</th>
    <th>Status</th><th>Akun Login</th><th>Gaji Pokok</th><th>Bergabung</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(e=>{
    const hasAccount = linkedEmployeeIds.has(e.id);
    return `<tr>
    <td>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:${stColors[e.status]||'#94A3B8'}20;
          color:${stColors[e.status]||'#94A3B8'};display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:800;flex-shrink:0">
          ${(e.full_name||'?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight:700;color:var(--navy)">${e.full_name||'—'}</div>
          <div style="font-size:11px;color:var(--gray)">${e.employee_id||'—'}</div>
        </div>
      </div>
    </td>
    <td>
      <div style="font-size:12px;font-weight:600">${e.position||'—'}</div>
      <div style="font-size:11px;color:var(--gray)">${e.division||'—'}</div>
    </td>
    <td>
      <div style="font-size:12px">${e.phone||'—'}</div>
      <div style="font-size:11px;color:var(--gray)">${e.email||'—'}</div>
    </td>
    <td><span style="background:${(stColors[e.status]||'#94A3B8')}20;color:${stColors[e.status]||'#94A3B8'};
      padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${e.status||'—'}</span></td>
    <td>
      ${hasAccount
        ? '<span style="color:#22C55E;font-size:11px;font-weight:700">✓ Terhubung</span>'
        : `<button class="btn btn-xs btn-ghost" onclick="openCreateAccountForm(${e.id},'${(e.full_name||'').replace(/'/g,"\\'")}','${e.email||''}')">+ Buat Akun</button>`}
    </td>
    <td style="font-size:12px;font-weight:600;color:var(--navy)">${e.base_salary?formatCurrency(e.base_salary):'—'}</td>
    <td style="font-size:11px;color:var(--gray)">${e.join_date?formatDateShort(e.join_date):'—'}</td>
    <td>
      <div class="act-row">
        <button class="act-btn edit" onclick="openEmpForm(${e.id})">✏️</button>
        <button class="act-btn" onclick="openLeaveForm(${e.id},'${(e.full_name||'').replace(/'/g,"\\'")}')">📅</button>
        <button class="act-btn del" onclick="deleteEmp(${e.id})">🗑</button>
      </div>
    </td>
  </tr>`;
  }).join('')}</tbody></table>`;
}

function switchHRDTab(tab, btn) {
  document.querySelectorAll('#hrd-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['emp','leave','payroll'].forEach(t=>{
    const el=document.getElementById(`hrd-${t}`);
    if (el) el.style.display=t===tab?'block':'none';
  });
  if (tab==='payroll') renderPayrollTab();
}

async function openEmpForm(id=null) {
  let e={};
  if (id) { const d=await sbGet('employees',`select=*&id=eq.${id}`); e=d[0]||{}; }
  const today=new Date().toISOString().split('T')[0];
  const user=getUserName?getUserName():'User';
  const empCode = `EMP-${Date.now().toString().slice(-5)}`;

  // Load positions for the Jabatan dropdown (cached across modal opens this session)
  if (!hrdPositionsCache.length) {
    hrdPositionsCache = await sbGet('positions','select=*&order=level,title').catch(()=>[]);
  }
  // Existing schedule for this employee, if editing
  let existingSchedule = null;
  if (id) {
    const sc = await sbGet('work_schedules',`select=*&employee_id=eq.${id}&is_active=eq.true&limit=1`).catch(()=>[]);
    existingSchedule = sc?.[0]||null;
  }
  const shiftTemplates = (typeof SHIFT_TEMPLATES !== 'undefined') ? SHIFT_TEMPLATES : [];

  // Only relevant for NEW employees: users who registered/logged in but have no employee_id yet
  let unlinkedUsers = [];
  if (!id) {
    const allUsers = await sbGet('user_profiles','select=id,full_name,email,phone,employee_id').catch(()=>[]);
    unlinkedUsers = (allUsers||[]).filter(u=>!u.employee_id);
  }

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Karyawan':'➕ Tambah Karyawan'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    ${(!id && unlinkedUsers.length) ? `
    <div style="background:var(--teal-light);border-radius:var(--r);padding:10px 14px;margin-bottom:14px">
      <label style="font-size:11.5px;font-weight:700;color:var(--teal);margin-bottom:4px;display:block">
        ⚡ Isi Otomatis dari User Terdaftar
      </label>
      <select id="ef-from-user" onchange="fillEmpFromUser(this)" style="font-size:12.5px">
        <option value="">-- Ketik manual, atau pilih user di sini --</option>
        ${unlinkedUsers.map(u=>`<option value="${u.id}" data-name="${(u.full_name||'').replace(/"/g,'')}" data-email="${u.email||''}" data-phone="${u.phone||''}">${u.full_name||'(tanpa nama)'} ${u.email?`— ${u.email}`:''}</option>`).join('')}
      </select>
      <div class="form-hint">Pilih untuk auto-isi Nama/Email/HP dan langsung terhubung ke akun login tersebut.</div>
    </div>` : ''}

    <div class="form-row">
      <div class="form-group">
        <label>ID Karyawan</label>
        <input type="text" id="ef-code" value="${e.employee_id||empCode}">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="ef-status">
          ${['Aktif','Probasi','Kontrak','Non-Aktif'].map(s=>`<option${(e.status||'Aktif')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Nama Lengkap *</label>
        <input type="text" id="ef-name" value="${e.full_name||''}" placeholder="Nama sesuai KTP">
      </div>
      <div class="form-group">
        <label>Divisi</label>
        <select id="ef-div">
          ${HRD_DIVISIONS.map(d=>`<option${e.division===d?' selected':''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Posisi / Jabatan (teks bebas)</label>
        <input type="text" id="ef-pos" value="${e.position||''}" placeholder="Analis Medis, Sales Executive...">
      </div>
      <input type="hidden" id="ef-link-user-id" value="">
      <div class="form-group">
        <label>No. HP</label>
        <input type="text" id="ef-phone" value="${e.phone||''}" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="ef-email" value="${e.email||''}" placeholder="nama@onelab.id">
      </div>
      <div class="form-group">
        <label>Tanggal Bergabung</label>
        <input type="date" id="ef-join" value="${e.join_date||today}">
      </div>
      <div class="form-group">
        <label>Akhir Kontrak</label>
        <input type="date" id="ef-end" value="${e.end_date||''}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Alamat</label>
        <textarea id="ef-addr" rows="2">${e.address||''}</textarea>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">
        🏛️ Jabatan &amp; Jadwal Kerja <span style="font-weight:500;text-transform:none;color:var(--text3)">(opsional — bisa dilengkapi belakangan)</span>
      </div>
      <div style="font-size:11.5px;color:var(--text3);margin-bottom:10px">
        Pilih di sini agar otomatis sinkron ke Struktur Organisasi dan Jadwal Kerja — tidak perlu input ulang di modul terpisah.
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Jabatan (Struktur Organisasi)</label>
          <select id="ef-position-id">
            <option value="">-- Belum dipilih --</option>
            ${hrdPositionsCache.map(p=>`<option value="${p.id}" ${e.position_id==p.id?'selected':''}>${p.title} (${p.department})</option>`).join('')}
          </select>
          <div class="form-hint">Tidak ada jabatan yang cocok? Tambahkan dulu di menu Struktur Organisasi.</div>
        </div>
        <div class="form-group">
          <label>Shift Kerja</label>
          <select id="ef-shift-code">
            <option value="">-- Belum dipilih --</option>
            ${shiftTemplates.map(t=>`<option value="${t.code}" ${existingSchedule?.shift_code===t.code?'selected':''}>${t.name} (${t.masuk_wd}–${t.pulang_wd})</option>`).join('')}
          </select>
          <div class="form-hint">${existingSchedule?'Karyawan ini sudah punya jadwal aktif — memilih ulang akan menggantikannya.':'Jadwal weekday/sabtu pakai jam default template; bisa diubah detail di menu Jadwal Kerja.'}</div>
        </div>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
        Info Penggajian
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Gaji Pokok (Rp)</label>
          <input type="number" id="ef-salary" value="${e.base_salary||''}" placeholder="0">
        </div>
        <div class="form-group">
          <label>NPWP</label>
          <input type="text" id="ef-npwp" value="${e.npwp||''}" placeholder="00.000.000.0-000.000">
        </div>
        <div class="form-group">
          <label>Bank</label>
          <select id="ef-bank">
            <option value="">-- Pilih --</option>
            ${['BCA','BRI','BNI','Mandiri','BSI','CIMB','Danamon','Lainnya'].map(b=>
              `<option${e.bank_name===b?' selected':''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>No. Rekening</label>
          <input type="text" id="ef-account" value="${e.bank_account||''}" placeholder="No. rekening">
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveEmployee(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function saveEmployee(id) {
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { toast('Nama wajib diisi','err'); return; }
  const user=getUserName?getUserName():'User';

  const positionId  = document.getElementById('ef-position-id')?.value || null;
  const shiftCode    = document.getElementById('ef-shift-code')?.value || '';
  const selectedPos  = positionId ? hrdPositionsCache.find(p=>String(p.id)===String(positionId)) : null;
  const linkUserId   = document.getElementById('ef-link-user-id')?.value || null;

  const payload={
    employee_id:   document.getElementById('ef-code').value.trim(),
    full_name:     name,
    // If a structured Jabatan was picked, its department takes priority over the manual dropdown
    division:      selectedPos?.department || document.getElementById('ef-div').value,
    position:      selectedPos?.title || document.getElementById('ef-pos').value.trim(),
    position_id:   positionId ? parseInt(positionId) : null,
    status:        document.getElementById('ef-status').value,
    phone:         document.getElementById('ef-phone').value.trim(),
    email:         document.getElementById('ef-email').value.trim(),
    address:       document.getElementById('ef-addr').value.trim(),
    join_date:     document.getElementById('ef-join').value||null,
    end_date:      document.getElementById('ef-end').value||null,
    base_salary:   parseFloat(document.getElementById('ef-salary').value)||0,
    npwp:          document.getElementById('ef-npwp').value.trim(),
    bank_name:     document.getElementById('ef-bank').value,
    bank_account:  document.getElementById('ef-account').value.trim(),
    created_by_name:user,
    updated_at:    new Date().toISOString(),
  };

  try {
    let empId = id;
    if (id) { await sbPatch('employees',id,payload); toast('✅ Data diupdate','ok'); }
    else    {
      const created = await sbPost('employees',payload);
      empId = created?.[0]?.id || created?.id;
      toast('✅ Karyawan ditambahkan','ok');
    }

    // If this employee was created from a "pilih user terdaftar" selection,
    // link back so user_profiles.employee_id points here too (true 2-way sync)
    if (linkUserId && empId && !id) {
      await sbPatch('user_profiles', linkUserId, {
        employee_id: empId,
        updated_at:  new Date().toISOString(),
      }).catch(e => console.error('[saveEmployee] link-back failed:', e));
    }

    // Sync shift selection to work_schedules — only if a shift was actually chosen
    if (shiftCode && empId) {
      await syncEmployeeShift(empId, shiftCode);
    }

    closeModalForce();
    await loadEmployees();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// Create/update the employee's active work_schedules row from a chosen SHIFT_TEMPLATES code
async function syncEmployeeShift(employeeId, shiftCode) {
  const tpl = (typeof SHIFT_TEMPLATES !== 'undefined') ? SHIFT_TEMPLATES.find(t=>t.code===shiftCode) : null;
  if (!tpl) return;
  try {
    const existing = await sbGet('work_schedules',
      `select=id&employee_id=eq.${employeeId}&is_active=eq.true&limit=1`).catch(()=>[]);
    const schedulePayload = {
      employee_id:        employeeId,
      shift_name:          tpl.name,
      shift_code:          tpl.code,
      // Legacy columns (jam_masuk/jam_pulang) may still be NOT NULL on databases
      // that haven't run fix_all_constraints.sql yet — fill them defensively
      // so saving never breaks regardless of migration state.
      jam_masuk:           tpl.masuk_wd,
      jam_pulang:          tpl.pulang_wd,
      jam_masuk_weekday:   tpl.masuk_wd,
      jam_pulang_weekday:  tpl.pulang_wd,
      jam_masuk_sabtu:     tpl.masuk_sb||null,
      jam_pulang_sabtu:    tpl.pulang_sb||null,
      is_cross_midnight:   tpl.cross||false,
      hari_kerja:          JSON.stringify(tpl.hari||['Mon','Tue','Wed','Thu','Fri']),
      primary_max_pct:     80,
      rotation_type:       'none',
      is_active:           true,
      created_by:          getUserName?getUserName():'System',
      updated_at:          new Date().toISOString(),
    };
    if (existing?.[0]?.id) {
      await sbPatch('work_schedules', existing[0].id, schedulePayload);
    } else {
      await sbPost('work_schedules', {...schedulePayload, created_at: new Date().toISOString()});
    }
  } catch(e) {
    console.error('[syncEmployeeShift] Failed:', e);
    toast('⚠️ Karyawan tersimpan, tapi sinkron jadwal gagal: '+e.message,'warn',5000);
  }
}

async function deleteEmp(id) {
  if (!confirm('Hapus data karyawan ini?')) return;
  try { await sbDelete('employees',id); toast('🗑 Dihapus','info'); await loadEmployees(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Leave Management ──────────────────────────
async function loadLeaves() {
  try {
    const st=document.getElementById('leave-status')?.value||'';
    const tp=document.getElementById('leave-type')?.value||'';
    let q='select=*&order=created_at.desc';
    if(st) q+=`&status=eq.${st}`;
    if(tp) q+=`&leave_type=eq.${encodeURIComponent(tp)}`;
    const data=await sbGet('leave_requests',q);
    leaveAll=Array.isArray(data)?data:[];
    renderLeaveTable(leaveAll);
  } catch(e) {
    const el=document.getElementById('leave-tbody');
    if(el) el.innerHTML=`<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderLeaveTable(data) {
  const el=document.getElementById('leave-tbody');
  if(!el) return;
  if(!data.length){
    el.innerHTML=`<div class="empty-state"><div class="ico">📅</div>
      <h3>${leaveAll.length?'Tidak ada hasil':'Belum ada pengajuan cuti'}</h3>
    </div>`; return;
  }
  const stColors={Pending:'#F59E0B',Approved:'#22C55E',Rejected:'#EF4444'};
  el.innerHTML=`<table><thead><tr>
    <th>Karyawan</th><th>Tipe Cuti</th><th>Tanggal</th>
    <th>Hari</th><th>Alasan</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(l=>{
    const sc=stColors[l.status]||'#94A3B8';
    return `<tr>
      <td style="font-weight:600">${l.employee_name||'—'}</td>
      <td style="font-size:12px">${l.leave_type||'—'}</td>
      <td style="font-size:12px;color:var(--gray)">${l.start_date?formatDateShort(l.start_date):'—'}${l.end_date&&l.end_date!==l.start_date?' s/d '+formatDateShort(l.end_date):''}</td>
      <td style="text-align:center;font-weight:700">${l.total_days||1}</td>
      <td style="font-size:12px;color:var(--gray);max-width:150px">${(l.reason||'—').substring(0,40)}</td>
      <td><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${l.status||'Pending'}</span></td>
      <td>
        <div class="act-row">
          ${l.status==='Pending'?`
            <button class="act-btn" style="color:#22C55E" onclick="approveLeave(${l.id},'Approved')">✅</button>
            <button class="act-btn" style="color:#EF4444" onclick="approveLeave(${l.id},'Rejected')">❌</button>`:''}
        </div>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function openLeaveForm(empId=null, empName='') {
  let empOpts='<option value="">-- Pilih Karyawan --</option>';
  try {
    const emps=await sbGet('employees','select=id,full_name&status=eq.Aktif&order=full_name');
    empOpts+=(emps||[]).map(e=>`<option value="${e.id}" data-name="${e.full_name}" ${e.id==empId?'selected':''}>${e.full_name}</option>`).join('');
  } catch(e){}
  const today=new Date().toISOString().split('T')[0];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📅 Ajukan Cuti / Izin</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Karyawan *</label>
      <select id="lf-emp" onchange="document.getElementById('lf-name').value=this.options[this.selectedIndex].dataset.name||''">
        ${empOpts}
      </select>
      <input type="hidden" id="lf-name" value="${empName}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipe Cuti</label>
        <select id="lf-type">${LEAVE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>Total Hari</label>
        <input type="number" id="lf-days" value="1" min="1" oninput="calcEndDate()">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tanggal Mulai</label>
        <input type="date" id="lf-start" value="${today}" onchange="calcEndDate()">
      </div>
      <div class="form-group">
        <label>Tanggal Selesai</label>
        <input type="date" id="lf-end" value="${today}">
      </div>
    </div>
    <div class="form-group">
      <label>Alasan</label>
      <textarea id="lf-reason" rows="2" placeholder="Alasan pengajuan cuti..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveLeave()">💾 Ajukan</button>
    </div>`);
}

function calcEndDate() {
  const start=document.getElementById('lf-start')?.value;
  const days=parseInt(document.getElementById('lf-days')?.value||1);
  if (!start) return;
  const endDate=new Date(start);
  endDate.setDate(endDate.getDate()+days-1);
  const el=document.getElementById('lf-end');
  if (el) el.value=endDate.toISOString().split('T')[0];
}

async function saveLeave() {
  const empId=document.getElementById('lf-emp').value;
  const empName=document.getElementById('lf-name').value||document.getElementById('lf-emp').options[document.getElementById('lf-emp').selectedIndex]?.text||'';
  if (!empId) { toast('Pilih karyawan dulu','err'); return; }
  const user=getUserName?getUserName():'User';
  const payload={
    employee_id:   parseInt(empId),
    employee_name: empName,
    leave_type:    document.getElementById('lf-type').value,
    start_date:    document.getElementById('lf-start').value,
    end_date:      document.getElementById('lf-end').value,
    total_days:    parseInt(document.getElementById('lf-days').value)||1,
    reason:        document.getElementById('lf-reason').value.trim(),
    status:        'Pending',
    requested_by:  user,
    created_at:    new Date().toISOString(),
  };
  try {
    await sbPost('leave_requests',payload);
    toast('✅ Cuti diajukan','ok');
    closeModalForce();
    await loadLeaves();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function approveLeave(id, status) {
  const user=getUserName?getUserName():'User';
  try {
    await sbPatch('leave_requests',id,{
      status, approved_by:user, approved_at:new Date().toISOString()
    });
    toast(`✅ Cuti ${status==='Approved'?'Disetujui':'Ditolak'}`,'ok');
    await loadLeaves();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Payroll Tab ───────────────────────────────
function renderPayrollTab() {
  const el=document.getElementById('payroll-content');
  if (!el) return;
  const active=empAll.filter(e=>e.status==='Aktif'||e.status==='Probasi'||e.status==='Kontrak');
  const totalGross=active.reduce((s,e)=>s+(e.base_salary||0),0);
  const totalBPJS =active.reduce((s,e)=>s+Math.round((e.base_salary||0)*0.04),0);
  const totalNet  =active.reduce((s,e)=>s+(e.base_salary||0)-Math.round((e.base_salary||0)*0.04),0);

  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
      ${[
        {label:'Total Karyawan Aktif',val:active.length,color:'var(--navy)'},
        {label:'Total Gaji Bruto',val:formatCurrency(totalGross),color:'#8B5CF6'},
        {label:'Est. Total Net (stlh BPJS 4%)',val:formatCurrency(totalNet),color:'#22C55E'},
      ].map(k=>`<div class="card" style="text-align:center">
        <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
        <div style="font-size:11px;color:var(--gray)">${k.label}</div>
      </div>`).join('')}
    </div>
    <div class="table-wrap">
      <table><thead><tr>
        <th>Karyawan</th><th>Divisi</th><th>Gaji Pokok</th>
        <th>BPJS (4%)</th><th>Est. Gaji Net</th><th>Bank</th>
      </tr></thead><tbody>
      ${active.map(e=>{
        const bpjs=Math.round((e.base_salary||0)*0.04);
        const net=(e.base_salary||0)-bpjs;
        return `<tr>
          <td style="font-weight:600">${e.full_name}</td>
          <td style="font-size:12px;color:var(--gray)">${e.division||'—'}</td>
          <td>${e.base_salary?formatCurrency(e.base_salary):'—'}</td>
          <td style="color:#EF4444">${bpjs?formatCurrency(bpjs):'—'}</td>
          <td style="font-weight:700;color:#22C55E">${net?formatCurrency(net):'—'}</td>
          <td style="font-size:12px;color:var(--gray)">${e.bank_name||'—'} ${e.bank_account||''}</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>`;
}

function openPayrollModal() {
  switchHRDTab('payroll', document.querySelector('#hrd-tabs .tab-btn:nth-child(3)'));
}

// ══════════════════════════════════════════════════════════════
// BULK SYNC — Lengkapi Jabatan & Jadwal untuk karyawan existing
// ══════════════════════════════════════════════════════════════
async function openBulkSyncPositionShift() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">🔗 Lengkapi Jabatan &amp; Jadwal Massal</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div id="bulk-sync-body"><div class="loading-row"><div class="spinner"></div></div></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="saveBulkSyncPositionShift()">💾 Simpan Semua</button>
    </div>`, 'wide');

  await loadBulkSyncList();
}

let bulkSyncState = { employees:[], positions:[] };

async function loadBulkSyncList() {
  const body = document.getElementById('bulk-sync-body');
  try {
    const [emps, positions, schedules] = await Promise.all([
      sbGet('employees','select=*&status=eq.Aktif&order=full_name').catch(()=>[]),
      sbGet('positions','select=*&order=level,title').catch(()=>[]),
      sbGet('work_schedules','select=employee_id,shift_code&is_active=eq.true').catch(()=>[]),
    ]);
    bulkSyncState.positions = positions||[];

    const scheduleMap = {};
    (schedules||[]).forEach(s => { scheduleMap[s.employee_id] = s.shift_code; });

    // Only show employees missing position_id OR missing an active schedule
    const incomplete = (emps||[]).filter(e => !e.position_id || !scheduleMap[e.id]);
    bulkSyncState.employees = incomplete;

    if (!incomplete.length) {
      body.innerHTML = `
        <div class="empty-state" style="padding:30px">
          <div class="ico" style="font-size:36px">✅</div>
          <h3>Semua karyawan aktif sudah lengkap</h3>
          <p>Jabatan dan jadwal kerja sudah ter-link untuk seluruh karyawan aktif.</p>
        </div>`;
      return;
    }

    const shiftTemplates = (typeof SHIFT_TEMPLATES !== 'undefined') ? SHIFT_TEMPLATES : [];

    body.innerHTML = `
      <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
        ${incomplete.length} karyawan aktif belum lengkap jabatan dan/atau jadwalnya. Pilih untuk masing-masing, lalu klik Simpan Semua.
      </div>
      <div style="max-height:55vh;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr>
            ${['KARYAWAN','DIVISI SAAT INI','JABATAN','SHIFT'].map(h=>`
              <th style="padding:8px 10px;background:var(--bg);font-size:10.5px;color:var(--text3);
                text-align:left;border-bottom:1px solid var(--border)">${h}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${incomplete.map((e,i)=>`
              <tr style="background:${i%2?'var(--bg2)':'#fff'};border-bottom:1px solid var(--border)" data-emp-id="${e.id}">
                <td style="padding:8px 10px;font-weight:600">${e.full_name}</td>
                <td style="padding:8px 10px;color:var(--text3)">${e.division||'—'}</td>
                <td style="padding:8px 10px">
                  <select class="bulk-sync-pos" data-emp-id="${e.id}" style="font-size:12px;padding:5px 8px">
                    <option value="">${e.position_id?'(sudah ada)':'-- Pilih --'}</option>
                    ${bulkSyncState.positions.map(p=>`<option value="${p.id}">${p.title}</option>`).join('')}
                  </select>
                </td>
                <td style="padding:8px 10px">
                  <select class="bulk-sync-shift" data-emp-id="${e.id}" style="font-size:12px;padding:5px 8px">
                    <option value="">${scheduleMap[e.id]?'(sudah ada)':'-- Pilih --'}</option>
                    ${shiftTemplates.map(t=>`<option value="${t.code}">${t.code} — ${t.masuk_wd}-${t.pulang_wd}</option>`).join('')}
                  </select>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) {
    body.innerHTML = `<div class="status-box status-err">❌ ${e.message}</div>`;
  }
}

async function saveBulkSyncPositionShift() {
  const posSelects   = document.querySelectorAll('.bulk-sync-pos');
  const shiftSelects = document.querySelectorAll('.bulk-sync-shift');
  let posUpdated = 0, shiftUpdated = 0, errs = 0;

  for (const sel of posSelects) {
    const empId = sel.getAttribute('data-emp-id');
    const posId = sel.value;
    if (!posId) continue;
    const pos = bulkSyncState.positions.find(p=>String(p.id)===String(posId));
    try {
      await sbPatch('employees', empId, {
        position_id: parseInt(posId),
        position:    pos?.title || null,
        division:    pos?.department || undefined,
        updated_at:  new Date().toISOString(),
      });
      posUpdated++;
    } catch(e) { errs++; console.error('[bulkSync position]', empId, e); }
  }

  for (const sel of shiftSelects) {
    const empId = sel.getAttribute('data-emp-id');
    const shiftCode = sel.value;
    if (!shiftCode) continue;
    try {
      await syncEmployeeShift(parseInt(empId), shiftCode);
      shiftUpdated++;
    } catch(e) { errs++; console.error('[bulkSync shift]', empId, e); }
  }

  if (posUpdated === 0 && shiftUpdated === 0) {
    toast('Tidak ada perubahan dipilih','warn');
    return;
  }

  toast(`✅ ${posUpdated} jabatan & ${shiftUpdated} jadwal disinkronkan${errs?` · ${errs} gagal`:''}`, errs?'warn':'ok', 4000);
  closeModalForce();
  await loadEmployees();
}

// ══════════════════════════════════════════════════════════════
// BUAT AKUN dari Data SDM — placeholder user_profiles ter-link
// ══════════════════════════════════════════════════════════════
function openCreateAccountForm(empId, empName, empEmail) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">👤 Buat Akun untuk ${empName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="status-box status-info" style="font-size:12px;margin-bottom:14px">
      ℹ️ Ini membuat profil akses di sistem. Karyawan tetap perlu mendaftar/login sendiri
      di halaman login menggunakan email yang sama — begitu login pertama kali,
      akun ini otomatis terhubung ke data karyawan dan role berikut langsung berlaku.
    </div>
    <div class="form-group">
      <label>Email (wajib sama dengan yang dipakai untuk login nanti) *</label>
      <input type="email" id="ca-email" value="${empEmail||''}" placeholder="nama@onelab.id">
      ${!empEmail?'<div class="form-hint" style="color:#DC2626">⚠️ Data karyawan ini belum punya email — isi dulu di sini, sebaiknya juga lengkapi di Edit Karyawan.</div>':''}
    </div>
    <div class="form-group">
      <label>Role Akses</label>
      <select id="ca-role">
        ${Object.entries(ROLES).map(([k,r])=>`
          <option value="${k}" ${k==='sales'?'selected':''}>${r.label}</option>`).join('')}
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveCreateAccount(${empId},'${empName.replace(/'/g,"\\'")}')">👤 Buat Akun</button>
    </div>`, 'narrow');
}

async function saveCreateAccount(empId, empName) {
  const email = document.getElementById('ca-email')?.value.trim();
  const role  = document.getElementById('ca-role')?.value;
  if (!email) { toast('Email wajib diisi','err'); return; }
  try {
    // If employee record doesn't have this email yet, sync it back
    await sbPatch('employees', empId, { email, updated_at: new Date().toISOString() }).catch(()=>{});

    await sbPost('user_profiles', {
      full_name:   empName,
      email,
      role,
      employee_id: empId,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    });
    toast(`✅ Akun untuk ${empName} dibuat dan terhubung ke Data SDM`,'ok');
    closeModalForce();
    await loadEmployees();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// FILL FROM USER — auto-isi form Tambah Karyawan dari user terdaftar
// ══════════════════════════════════════════════════════════════
function fillEmpFromUser(sel) {
  const opt = sel.options[sel.selectedIndex];
  const userId = opt.value;
  document.getElementById('ef-link-user-id').value = userId || '';
  if (!userId) return;
  const name  = opt.getAttribute('data-name')  || '';
  const email = opt.getAttribute('data-email') || '';
  const phone = opt.getAttribute('data-phone') || '';
  const nameEl  = document.getElementById('ef-name');
  const emailEl = document.getElementById('ef-email');
  const phoneEl = document.getElementById('ef-phone');
  if (nameEl  && name)  nameEl.value  = name;
  if (emailEl && email) emailEl.value = email;
  if (phoneEl && phone) phoneEl.value = phone;
  toast(`✓ Form diisi dari akun "${name}" — akan otomatis terhubung saat disimpan`,'info',2500);
}
