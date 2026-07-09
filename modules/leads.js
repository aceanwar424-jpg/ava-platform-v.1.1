// ═══════════════════════════════════════════
// MODULE: Leads Management + OKR v3
// - Pipeline leads dengan activity tracker
// - Convert lead → partner
// - OKR auto-pull dari data real
// - Follow-up reminder
// ═══════════════════════════════════════════

const LEAD_STATUSES = [
  { key:'Baru',        color:'#94A3B8', label:'Baru' },
  { key:'Dihubungi',   color:'#0EA5E9', label:'Dihubungi' },
  { key:'Qualified',   color:'#8B5CF6', label:'Qualified' },
  { key:'Presentasi',  color:'#F59E0B', label:'Presentasi' },
  { key:'Proposal',    color:'#F97316', label:'Proposal' },
  { key:'Negosiasi',   color:'#06B6D4', label:'Negosiasi' },
  { key:'Won',         color:'#22C55E', label:'Won ✓' },
  { key:'Lost',        color:'#EF4444', label:'Lost ✗' },
];

const LEAD_SOURCES = [
  'Maps Prospecting','Referral Internal','Referral Eksternal',
  'Cold Call','Event/Pameran','Media Sosial','Walk-in','Lainnya'
];

const LEAD_CATEGORIES = [
  'Perusahaan SME','Klinik / RS','Sekolah / Kampus',
  'Komunitas','Gym & Sport','Apotek','Individu / Personal','Lainnya'
];

let leadsAll = [], leadsFilter = { status:'', search:'', source:'' };
let okrAll = [];

// ── RENDER LEADS ──────────────────────────
async function renderLeads() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>🎯 Leads Management</h1>
        <p>Pipeline prospek — dari kontak pertama sampai closing</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="navigate('maps')">🗺 Maps</button>
        <button class="btn btn-ghost btn-sm" onclick="renderLeadsKanban()">📊 Kanban</button>
        <button class="btn btn-teal" onclick="openLeadForm()">+ Tambah Lead</button>
      </div>
    </div>

    <!-- Funnel steps — Virtu style horizontal -->
    <div class="funnel-steps" id="leads-funnel"></div>

    <!-- Reminder Alert -->
    <div id="leads-reminder" style="margin-bottom:14px"></div>

    <!-- Filter toolbar + table -->
    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="ld-q" placeholder="Cari nama, perusahaan, PIC..."
          oninput="leadsFilter.search=this.value;applyLeadsFilter()">
        <select class="table-filter" id="ld-status" onchange="leadsFilter.status=this.value;applyLeadsFilter()">
          <option value="">Semua Status</option>
          ${LEAD_STATUSES.map(s=>`<option value="${s.key}">${s.label}</option>`).join('')}
        </select>
        <select class="table-filter" id="ld-source" onchange="leadsFilter.source=this.value;applyLeadsFilter()">
          <option value="">Semua Sumber</option>
          ${LEAD_SOURCES.map(s=>`<option>${s}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="exportLeadsCSV()">📥 Export</button>
        <span id="ld-count" style="font-size:12px;color:var(--text3);white-space:nowrap;margin-left:auto"></span>
      </div>
      <div id="leads-tbody">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>`;

  leadsAll = [];
    await loadLeads();
}

function exportLeadsCSV() {
  if (!leadsAll.length) { toast('Tidak ada data','warn'); return; }
  const rows = ['Nama,Perusahaan,Kontak,Status,Sumber,Follow-up,Nilai,Sales'];
  leadsAll.forEach(l => rows.push(`"${l.lead_name||''}", "${l.company||''}", "${l.contact_name||''}", "${l.status||''}", "${l.source||''}", "${l.followup_date||''}", "${l.estimated_value||0}", "${l.assigned_name||''}"`));
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'leads.csv'; a.click();
}

function renderLeadsKanban() {
  const board = document.getElementById('leads-tbody');
  if (!board) return;
  const statuses = LEAD_STATUSES.filter(s=>!['Won','Lost'].includes(s.key));
  board.innerHTML = `<div style="display:flex;gap:12px;overflow-x:auto;padding:16px;min-height:400px">
    ${statuses.map(st => {
      const cards = leadsAll.filter(l=>l.status===st.key);
      return `<div class="kanban-col">
        <div class="kanban-col-header">
          <span class="kanban-col-title">
            <span style="width:8px;height:8px;border-radius:50%;background:${st.color};display:inline-block"></span>
            ${st.label}
          </span>
          <span class="kanban-col-count">${cards.length}</span>
        </div>
        ${cards.slice(0,15).map(l=>`
          <div class="kanban-card" onclick="openLeadDetail(${l.id})">
            <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:4px">${l.lead_name||l.company||'—'}</div>
            ${l.company&&l.lead_name?`<div style="font-size:11px;color:var(--text3)">${l.company}</div>`:''}
            <div style="display:flex;justify-content:space-between;margin-top:8px;align-items:center">
              <span style="font-size:11px;color:var(--text3)">${l.assigned_name||'—'}</span>
              ${l.estimated_value?`<span style="font-size:11px;font-weight:700;color:var(--teal)">${formatCurrency(l.estimated_value)}</span>`:''}
            </div>
          </div>`).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

async function loadLeads() {
  try {
    const data = await sbGet('leads','select=*&order=followup_date.asc.nullslast,created_at.desc');
    leadsAll = Array.isArray(data) ? data : [];
    renderLeadsFunnel();
    renderLeadsReminder();
    applyLeadsFilter();
  } catch(e) {
    document.getElementById('leads-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderLeadsFunnel() {
  const el = document.getElementById('leads-funnel');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const active = leadsAll.filter(l=>!['Won','Lost'].includes(l.status));
  const overdue = leadsAll.filter(l=>l.followup_date&&l.followup_date<today&&!['Won','Lost'].includes(l.status));

  const steps = [
    { key:'all',   label:'Total Leads',  count:leadsAll.length,  color:'#0891B2' },
    ...LEAD_STATUSES.filter(s=>!['Won','Lost'].includes(s.key)).map(s=>({
      key:s.key, label:s.label, count:leadsAll.filter(l=>l.status===s.key).length, color:s.color
    })),
    { key:'Won',   label:'Won ✓',        count:leadsAll.filter(l=>l.status==='Won').length,  color:'#22C55E' },
    { key:'overdue',label:'Overdue',     count:overdue.length, color:'#EF4444' },
  ];

  el.innerHTML = steps.map(s=>`
    <div class="funnel-step ${leadsFilter.status===s.key||(!leadsFilter.status&&s.key==='all')?'active':''}"
      onclick="${s.key==='all'?'leadsFilter.status=\'\';applyLeadsFilter()':s.key==='overdue'?'leadsFilter.status=\'\';applyLeadsFilter()':'leadsFilter.status=\''+s.key+'\';applyLeadsFilter()'}">
      <div class="fs-count" style="${leadsFilter.status===s.key||(!leadsFilter.status&&s.key==='all')?'color:#fff':'color:'+s.color}">${s.count}</div>
      <div class="fs-label">${s.label}</div>
    </div>`).join('');
}


function renderLeadsReminder() {
  const el = document.getElementById('leads-reminder');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const overdue = leadsAll.filter(l =>
    l.followup_date && l.followup_date <= today &&
    !['Won','Lost'].includes(l.status)
  );
  if (!overdue.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="background:#FFF8E1;border:1.5px solid #FCD34D;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px">
      <span style="font-size:22px">⏰</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#92400E">
          ${overdue.length} lead perlu di-follow up hari ini atau sudah lewat!
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          ${overdue.slice(0,5).map(l=>`
            <span onclick="openLeadDetail(${l.id})"
              style="background:#FEF3C7;border:1px solid #FCD34D;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:#92400E">
              ${l.lead_name||l.company||'—'} · ${l.followup_date}
            </span>`).join('')}
          ${overdue.length>5?`<span style="font-size:11px;color:#92400E">+${overdue.length-5} lainnya</span>`:''}
        </div>
      </div>
    </div>`;
}

function applyLeadsFilter() {
  const q   = leadsFilter.search.toLowerCase();
  const st  = leadsFilter.status;
  const src = leadsFilter.source;

  const filtered = leadsAll.filter(l =>
    (!q  || (l.lead_name||'').toLowerCase().includes(q) ||
             (l.company||'').toLowerCase().includes(q) ||
             (l.contact_name||'').toLowerCase().includes(q) ||
             (l.phone||'').includes(q)) &&
    (!st  || l.status === st) &&
    (!src || l.source === src)
  );

  const cnt = document.getElementById('ld-count');
  if (cnt) cnt.textContent = `${filtered.length} lead`;
  renderLeadsTable(filtered);
}

function renderLeadsTable(data) {
  const el = document.getElementById('leads-tbody');
  if (!el) return;

  if (!data.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ico">🎯</div>
        <h3>${leadsAll.length ? 'Tidak ada hasil' : 'Belum ada leads'}</h3>
        <p>Tambah lead manual atau import dari Maps Prospecting.</p>
        <button class="btn btn-teal" style="margin-top:12px" onclick="openLeadForm()">+ Tambah Lead</button>
      </div>`; return;
  }

  const today = new Date().toISOString().split('T')[0];

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>Lead / Perusahaan</th><th>Kontak</th><th>Sumber</th>
        <th>Status</th><th>Follow-up</th><th>Nilai Est.</th>
        <th>Sales</th><th>Aksi</th>
      </tr></thead>
      <tbody>
        ${data.map(l => {
          const st = LEAD_STATUSES.find(s=>s.key===l.status)||LEAD_STATUSES[0];
          const isOverdue = l.followup_date && l.followup_date < today && !['Won','Lost'].includes(l.status);
          const isSoon    = l.followup_date && l.followup_date === today;
          return `<tr>
            <td>
              <div style="font-weight:700;color:var(--text)">${l.lead_name||l.company||'—'}</div>
              ${l.company&&l.lead_name?`<div style="font-size:11px;color:var(--text3)">${l.company}</div>`:''}
              ${l.category?`<span class="badge badge-gray" style="font-size:10px;margin-top:2px">${l.category}</span>`:''}
            </td>
            <td>
              <div style="font-size:13px">${l.contact_name||l.pic_name||'—'}</div>
              ${l.phone?`<div style="font-size:11px;color:var(--teal)">${l.phone}</div>`:''}
            </td>
            <td style="font-size:12px;color:var(--text3)">${l.source||'—'}</td>
            <td>
              <span style="background:${st.color}20;color:${st.color};padding:3px 10px;
                border-radius:10px;font-size:11px;font-weight:700;cursor:pointer"
                onclick="quickLeadStatus(${l.id},'${l.status}')">
                ${st.label}
              </span>
            </td>
            <td>
              ${l.followup_date ? `
                <div style="font-size:12px;font-weight:600;color:${isOverdue?'#EF4444':isSoon?'#F59E0B':'var(--text)'}">
                  ${isOverdue?'⚠️ ':''}${isSoon?'📅 Today ':''}${formatDateShort(l.followup_date)}
                </div>
                ${l.followup_note?`<div style="font-size:10px;color:var(--text3)">${l.followup_note.substring(0,30)}...</div>`:''}
              ` : '<span style="color:#ccc;font-size:12px">Belum diset</span>'}
            </td>
            <td style="font-weight:600;color:var(--text);font-size:13px">
              ${l.estimated_value ? formatCurrency(l.estimated_value) : '—'}
            </td>
            <td style="font-size:12px;color:var(--text3)">${l.assigned_name||'—'}</td>
            <td>
              <div class="act-row">
                <button class="act-btn" onclick="openLeadDetail(${l.id})" title="Detail & Aktivitas">📋</button>
                ${l.phone?`<button class="act-btn wa" onclick="window.open('https://wa.me/${(l.phone||'').replace(/\D/g,'').replace(/^0/,'62')}','_blank')" title="WA">💬</button>`:''}
                <button class="act-btn edit" onclick="openLeadForm(${l.id})">✏️</button>
                ${!['Won','Lost'].includes(l.status)?`
                  <button class="act-btn" onclick="convertLeadToPartner(${l.id})"
                    style="color:#22C55E;font-size:11px;padding:4px 7px" title="Convert ke Partner">→Partner</button>`:''}
                <button class="act-btn del" onclick="deleteLead(${l.id})">🗑</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── Lead Detail + Activity Tracker ────────
async function openLeadDetail(id) {
  const d    = await sbGet('leads',`select=*&id=eq.${id}`);
  const lead = d[0]; if (!lead) return;
  const activities = await loadLeadActivities(id);
  const st   = LEAD_STATUSES.find(s=>s.key===lead.status)||LEAD_STATUSES[0];

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${lead.lead_name||lead.company||'—'}</div>
        <div style="display:flex;gap:6px;margin-top:4px">
          <span style="background:${st.color}20;color:${st.color};padding:2px 9px;border-radius:8px;font-size:11px;font-weight:700">${st.label}</span>
          ${lead.category?`<span class="badge badge-gray" style="font-size:10px">${lead.category}</span>`:''}
          ${lead.source?`<span class="badge badge-navy" style="font-size:10px">${lead.source}</span>`:''}
        </div>
      </div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <!-- Info Grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:var(--lgray);border-radius:8px;padding:10px 12px">
        <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Kontak</div>
        <div style="font-size:13px;font-weight:600">${lead.contact_name||lead.pic_name||'—'}</div>
        ${lead.phone?`<div style="font-size:12px;color:var(--teal)">${lead.phone}</div>`:''}
        ${lead.email?`<div style="font-size:12px;color:var(--text3)">${lead.email}</div>`:''}
      </div>
      <div style="background:var(--lgray);border-radius:8px;padding:10px 12px">
        <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Deal Info</div>
        <div style="font-size:13px;font-weight:700;color:var(--teal)">${lead.estimated_value?formatCurrency(lead.estimated_value):'Belum diestimasi'}</div>
        <div style="font-size:11px;color:var(--text3)">Assigned: ${lead.assigned_name||'—'}</div>
      </div>
      ${lead.followup_date?`
        <div style="background:#FFF8E1;border-radius:8px;padding:10px 12px">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Next Follow-up</div>
          <div style="font-size:13px;font-weight:600;color:#92400E">${formatDateShort(lead.followup_date)}</div>
          ${lead.followup_note?`<div style="font-size:11px;color:#92400E">${lead.followup_note}</div>`:''}
        </div>`:''}
      ${lead.address?`
        <div style="background:var(--lgray);border-radius:8px;padding:10px 12px">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Alamat</div>
          <div style="font-size:12px">${lead.address}</div>
        </div>`:''}
    </div>

    <!-- Activity Tracker -->
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
      <span>📋 Riwayat Aktivitas</span>
      <button class="btn btn-teal btn-xs" onclick="openAddActivity(${id})">+ Catat Aktivitas</button>
    </div>
    <div id="activity-list-${id}" style="margin-bottom:14px">
      ${renderActivitiesList(activities)}
    </div>

    <!-- Quick Status Change -->
    <div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Update Status</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${LEAD_STATUSES.map(s=>`
          <button onclick="updateLeadStatusFromDetail(${id},'${s.key}')"
            style="padding:5px 12px;border-radius:8px;border:2px solid ${s.color};
              background:${lead.status===s.key?s.color:'transparent'};
              color:${lead.status===s.key?'#fff':s.color};font-size:11px;font-weight:700;cursor:pointer">
            ${s.label}
          </button>`).join('')}
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-outline" onclick="closeModalForce();openLeadForm(${id})">✏️ Edit</button>
      ${!['Won','Lost'].includes(lead.status)?`
        <button class="btn btn-teal" onclick="convertLeadToPartner(${id})">✅ Convert ke Partner</button>`:''}
    </div>`);
}

async function loadLeadActivities(leadId) {
  try {
    const data = await sbGet('activity_logs',
      `select=*&table_name=eq.leads&record_id=eq.${leadId}&order=created_at.desc&limit=20`);
    return Array.isArray(data) ? data : [];
  } catch(e) { return []; }
}

function renderActivitiesList(activities) {
  if (!activities.length) return `
    <div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">
      Belum ada aktivitas tercatat. Klik "+ Catat Aktivitas" untuk mulai.
    </div>`;

  const icons = {
    'call':'📞','whatsapp':'💬','email':'📧','meeting':'🤝',
    'visit':'🚗','proposal':'📋','demo':'🎯','note':'📝',
    'status_change':'🔄','create':'✨','update':'✏️'
  };

  return activities.map(a => `
    <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--lgray);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
        ${icons[a.action]||'📌'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${a.description||a.action||'—'}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">
          ${a.user_name||'—'} · ${timeAgo(a.created_at)}
        </div>
      </div>
    </div>`).join('');
}

function openAddActivity(leadId) {
  const types = [
    {key:'call',label:'📞 Telepon'},{key:'whatsapp',label:'💬 WhatsApp'},
    {key:'email',label:'📧 Email'},{key:'meeting',label:'🤝 Meeting'},
    {key:'visit',label:'🚗 Kunjungan'},{key:'proposal',label:'📋 Kirim Proposal'},
    {key:'note',label:'📝 Catatan'}
  ];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📋 Catat Aktivitas</div>
      <button class="modal-close" onclick="closeModalForce();openLeadDetail(${leadId})">✕</button>
    </div>
    <div class="form-group">
      <label>Tipe Aktivitas *</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${types.map(t=>`
          <button onclick="document.querySelectorAll('.act-type-btn').forEach(b=>b.style.background='');
            this.style.background='var(--mint)';document.getElementById('act-type').value='${t.key}'"
            class="act-type-btn" style="padding:6px 12px;border-radius:8px;border:1.5px solid var(--border);
              background:var(--lgray);cursor:pointer;font-size:12px;transition:background .15s">
            ${t.label}
          </button>`).join('')}
        <input type="hidden" id="act-type" value="note">
      </div>
    </div>
    <div class="form-group">
      <label>Deskripsi / Catatan *</label>
      <textarea id="act-desc" rows="3" placeholder="Contoh: Telepon dengan Bu Sari HRD, tertarik MCU 200 peserta bulan Agustus..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Next Follow-up Date</label>
        <input type="date" id="act-followup">
      </div>
      <div class="form-group">
        <label>Catatan Follow-up</label>
        <input type="text" id="act-followup-note" placeholder="Kirim proposal harga...">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce();openLeadDetail(${leadId})">Batal</button>
      <button class="btn btn-teal" onclick="saveActivity(${leadId})">💾 Simpan</button>
    </div>`);
}

async function saveActivity(leadId) {
  const desc = document.getElementById('act-desc').value.trim();
  const type = document.getElementById('act-type').value;
  if (!desc) { toast('Deskripsi wajib diisi','err'); return; }

  const followup = document.getElementById('act-followup').value;
  const followupNote = document.getElementById('act-followup-note').value.trim();
  const user = getUserName ? getUserName() : 'User';

  try {
    // Log activity
    await sbPost('activity_logs', {
      action: type,
      table_name: 'leads',
      record_id: String(leadId),
      description: desc,
      user_name: user,
      created_at: new Date().toISOString()
    });

    // Update followup date if set
    if (followup) {
      await sbPatch('leads', leadId, {
        followup_date: followup,
        followup_note: followupNote || null,
        updated_at: new Date().toISOString()
      });
    }

    toast('✅ Aktivitas tercatat','ok');
    closeModalForce();
    await loadLeads();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function updateLeadStatusFromDetail(id, status) {
  const user = getUserName ? getUserName() : 'User';
  try {
    await sbPatch('leads', id, { status, updated_at: new Date().toISOString() });
    await sbPost('activity_logs', {
      action: 'status_change',
      table_name: 'leads',
      record_id: String(id),
      description: `Status diubah ke "${status}" oleh ${user}`,
      user_name: user,
      created_at: new Date().toISOString()
    });
    toast(`✅ Status → ${status}`,'ok');
    closeModalForce();
    await loadLeads();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Quick Status ──────────────────────────
function quickLeadStatus(id, current) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Update Status Lead</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      ${LEAD_STATUSES.map(s=>`
        <button onclick="updateLeadStatusFromDetail(${id},'${s.key}')"
          style="padding:8px 16px;border-radius:8px;border:2px solid ${s.color};
            background:${'${s.key}'===current?s.color:'transparent'};
            color:${'${s.key}'===current?'#fff':s.color};font-size:13px;font-weight:700;cursor:pointer">
          ${s.label}
        </button>`).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
    </div>`);
}

// ── Lead Form ─────────────────────────────
async function openLeadForm(id=null) {
  let l = {};
  if (id) {
    const d = await sbGet('leads',`select=*&id=eq.${id}`);
    l = d[0]||{};
  }
  const user = getUserName ? getUserName() : 'User';
  const today = new Date().toISOString().split('T')[0];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Lead':'➕ Tambah Lead'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Nama Lead / Perusahaan *</label>
        <input type="text" id="lf-name" value="${l.lead_name||''}" placeholder="PT. Contoh / Nama Individu">
      </div>
      <div class="form-group">
        <label>Kategori</label>
        <select id="lf-cat">
          <option value="">-- Pilih --</option>
          ${LEAD_CATEGORIES.map(c=>`<option${l.category===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Nama Kontak / PIC</label>
        <input type="text" id="lf-pic" value="${l.contact_name||l.pic_name||''}" placeholder="Nama HRD / Pimpinan">
      </div>
      <div class="form-group">
        <label>No. HP / WA</label>
        <input type="text" id="lf-phone" value="${l.phone||''}" placeholder="08xxxxxxxxxx">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="lf-email" value="${l.email||''}" placeholder="email@perusahaan.com">
      </div>
      <div class="form-group">
        <label>Sumber Lead</label>
        <select id="lf-source">
          <option value="">-- Pilih --</option>
          ${LEAD_SOURCES.map(s=>`<option${l.source===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>Alamat</label>
      <input type="text" id="lf-addr" value="${l.address||''}" placeholder="Jl. ...">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Status Pipeline</label>
        <select id="lf-status">
          ${LEAD_STATUSES.map(s=>`<option value="${s.key}"${(l.status||'Baru')===s.key?' selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Estimasi Nilai (Rp)</label>
        <input type="number" id="lf-value" value="${l.estimated_value||''}" placeholder="0">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Next Follow-up</label>
        <input type="date" id="lf-followup" value="${l.followup_date||''}">
      </div>
      <div class="form-group">
        <label>Catatan Follow-up</label>
        <input type="text" id="lf-followup-note" value="${l.followup_note||''}" placeholder="Kirim proposal, demo produk...">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Assigned Sales</label>
        <input type="text" id="lf-assigned" value="${l.assigned_name||user}" placeholder="Nama sales">
      </div>
      <div class="form-group">
        <label>Nama Perusahaan (jika berbeda)</label>
        <input type="text" id="lf-company" value="${l.company||''}" placeholder="Nama perusahaan">
      </div>
    </div>

    <div class="form-group">
      <label>Catatan</label>
      <textarea id="lf-notes" rows="2" placeholder="Info tambahan, kebutuhan khusus...">${l.notes||''}</textarea>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveLead(${id||'null'})">
        ${id?'💾 Simpan':'➕ Tambah Lead'}
      </button>
    </div>`);
}

async function saveLead(id) {
  const name = document.getElementById('lf-name').value.trim();
  if (!name) { toast('Nama wajib diisi','err'); return; }
  const user = getUserName ? getUserName() : 'User';

  const payload = {
    lead_name:       name,
    company:         document.getElementById('lf-company').value.trim(),
    category:        document.getElementById('lf-cat').value,
    contact_name:    document.getElementById('lf-pic').value.trim(),
    phone:           document.getElementById('lf-phone').value.trim(),
    email:           document.getElementById('lf-email').value.trim(),
    source:          document.getElementById('lf-source').value,
    address:         document.getElementById('lf-addr').value.trim(),
    status:          document.getElementById('lf-status').value,
    estimated_value: parseFloat(document.getElementById('lf-value').value)||0,
    followup_date:   document.getElementById('lf-followup').value||null,
    followup_note:   document.getElementById('lf-followup-note').value.trim(),
    assigned_name:   document.getElementById('lf-assigned').value.trim()||user,
    notes:           document.getElementById('lf-notes').value.trim(),
    created_by_name: user,
    updated_at:      new Date().toISOString(),
  };

  try {
    if (id) {
      await sbPatch('leads', id, payload);
      toast('✅ Lead diupdate','ok');
    } else {
      const res = await sbPost('leads', payload);
      if (res?.[0]) {
        await sbPost('activity_logs', {
          action: 'create',
          table_name: 'leads',
          record_id: String(res[0].id),
          description: `Lead baru ditambahkan: ${name}`,
          user_name: user,
          created_at: new Date().toISOString()
        });
      }
      toast('✅ Lead ditambahkan','ok');
    }
    closeModalForce();
    await loadLeads();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Convert Lead → Partner ────────────────
async function convertLeadToPartner(id) {
  const d    = await sbGet('leads',`select=*&id=eq.${id}`);
  const lead = d[0]; if (!lead) return;

  if (!confirm(`Convert "${lead.lead_name||lead.company}" menjadi Partner aktif?\n\nLead akan ditandai Won dan data dipindah ke Partner Database.`)) return;

  const user = getUserName ? getUserName() : 'User';

  try {
    // Create partner
    const partner = await sbPost('partners', {
      partner_name:    lead.lead_name || lead.company,
      category:        lead.category  || 'Lainnya',
      pic_name:        lead.contact_name || lead.pic_name,
      phone:           lead.phone,
      email:           lead.email,
      address:         lead.address,
      status:          'Aktif',
      assigned_name:   lead.assigned_name || user,
      notes:           `Converted dari Lead pada ${new Date().toLocaleDateString('id-ID')}. ${lead.notes||''}`,
      source:          lead.source || 'Leads',
      created_by_name: user,
      updated_at:      new Date().toISOString(),
    });

    // Mark lead as Won
    await sbPatch('leads', id, {
      status:       'Won',
      converted_to: partner?.[0]?.id || null,
      updated_at:   new Date().toISOString(),
    });

    // Log activity
    await sbPost('activity_logs', {
      action: 'convert',
      table_name: 'leads',
      record_id: String(id),
      description: `Lead berhasil diconvert menjadi Partner: ${lead.lead_name||lead.company}`,
      user_name: user,
      created_at: new Date().toISOString()
    });

    toast('✅ Lead berhasil diconvert ke Partner!','ok');
    closeModalForce();
    await loadLeads();

    // Ask about next steps
    openModal(`
      <div class="modal-header">
        <div class="modal-title">✅ Lead Berhasil Diconvert!</div>
        <button class="modal-close" onclick="closeModalForce()">✕</button>
      </div>
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">
          ${lead.lead_name||lead.company} sekarang jadi Partner aktif!
        </div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:20px">Apa langkah selanjutnya?</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <button onclick="closeModalForce();navigate('partners')"
          style="padding:14px;border-radius:10px;border:2px solid var(--border);background:#fff;
            cursor:pointer;text-align:center;transition:all .2s"
          onmouseover="this.style.borderColor='var(--teal)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-size:24px">🤝</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-top:6px">Partner Database</div>
          <div style="font-size:11px;color:var(--text3)">Kelola output kerjasama</div>
        </button>
        <button onclick="closeModalForce();createMOUFromLead(${partner?.[0]?.id||'null'},'${(lead.lead_name||lead.company||'').replace(/'/g,"\\'")}')"
          style="padding:14px;border-radius:10px;border:2px solid var(--border);background:#fff;
            cursor:pointer;text-align:center;transition:all .2s"
          onmouseover="this.style.borderColor='var(--teal)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-size:24px">📜</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-top:6px">Buat MOU</div>
          <div style="font-size:11px;color:var(--text3)">Langsung buat perjanjian</div>
        </button>
        <button onclick="closeModalForce();createMCUFromLead(${partner?.[0]?.id||'null'},'${(lead.lead_name||lead.company||'').replace(/'/g,"\\'")}')"
          style="padding:14px;border-radius:10px;border:2px solid var(--border);background:#fff;
            cursor:pointer;text-align:center;transition:all .2s"
          onmouseover="this.style.borderColor='var(--teal)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-size:24px">🏥</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-top:6px">Buat Project MCU</div>
          <div style="font-size:11px;color:var(--text3)">Setup project & RAB</div>
        </button>
        <button onclick="closeModalForce();createCorporateFromLead(${partner?.[0]?.id||'null'},'${(lead.lead_name||lead.company||'').replace(/'/g,"\\'")}')"
          style="padding:14px;border-radius:10px;border:2px solid var(--border);background:#fff;
            cursor:pointer;text-align:center;transition:all .2s"
          onmouseover="this.style.borderColor='#8B5CF6'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-size:24px">🏢</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-top:6px">Daftarkan Corporate</div>
          <div style="font-size:11px;color:var(--text3)">Jika klien korporat dengan kontrak</div>
        </button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModalForce();navigate('leads')">Nanti saja</button>
      </div>
    `);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteLead(id) {
  if (!confirm('Hapus lead ini?')) return;
  try {
    await sbDelete('leads', id);
    toast('🗑 Lead dihapus','info');
    await loadLeads();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════
// OKR & TARGET SALES
// ══════════════════════════════════════════
async function renderOKR() {
  const now = new Date();

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>OKR &amp; Target Sales</h1>
        <p>Objective, Key Results, dan tracking realisasi tim sales</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="navigate('leads')">🎯 Leads</button>
        <button class="btn btn-teal" onclick="openOKRForm()">+ Tambah OKR</button>
      </div>
    </div>

    <!-- Auto KPI dari data real -->
    <div id="okr-real-kpi" style="margin-bottom:16px">
      <div class="loading-row" style="padding:20px"><div class="spinner"></div></div>
    </div>

    <!-- Filter & list -->
    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
      <select id="okr-period" class="table-filter" style="min-width:180px" onchange="loadOKR()">
        <option value="">📋 Semua Periode</option>
        ${generatePeriodOptions(now)}
      </select>
      <select id="okr-assignee" class="table-filter" onchange="loadOKR()">
        <option value="">Semua Sales</option>
      </select>
      <span id="okr-count" style="font-size:12px;color:var(--text3)"></span>
    </div>

    <div id="okr-list">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;

  await Promise.all([loadOKRRealKPI(), loadOKR()]);
}

function generatePeriodOptions(now) {
  const yr = now.getFullYear();
  const qNow = Math.ceil((now.getMonth()+1)/3);
  let opts = '';
  // Last 4 quarters + next 2
  for (let i = -3; i <= 2; i++) {
    let q = qNow + i;
    let y = yr;
    while (q < 1) { q += 4; y--; }
    while (q > 4) { q -= 4; y++; }
    const isCurrent = q === qNow && y === yr;
    opts += `<option value="${y}-Q${q}" ${isCurrent?'selected':''}>Q${q} ${y}${isCurrent?' ← Sekarang':''}</option>`;
  }
  opts += `<option value="${yr}">Tahunan ${yr}</option>`;
  opts += `<option value="${yr-1}">Tahunan ${yr-1}</option>`;
  return opts;
}

async function loadOKRRealKPI() {
  const el = document.getElementById('okr-real-kpi');
  if (!el) return;
  try {
    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    const [partners, deals, leads, invoices] = await Promise.all([
      sbGet('partners','select=id,created_at,assigned_name&order=created_at.desc').catch(()=>[]),
      sbGet('partner_deals','select=id,value,status,created_at&status=eq.Active').catch(()=>[]),
      sbGet('leads','select=id,status,estimated_value,assigned_name&order=created_at.desc').catch(()=>[]),
      sbGet('invoices','select=id,total_amount,status&status=eq.Dibayar').catch(()=>[]),
    ]);

    const newPartners = (partners||[]).filter(p => p.created_at?.startsWith(now.getFullYear().toString()));
    const activeDeals = deals||[];
    const wonLeads    = (leads||[]).filter(l => l.status==='Won');
    const totalRev    = (invoices||[]).reduce((s,i)=>s+(i.total_amount||0),0);
    const pipelineVal = (leads||[]).filter(l=>!['Won','Lost'].includes(l.status))
                          .reduce((s,l)=>s+(l.estimated_value||0),0);

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        ${[
          {icon:'🤝', val:newPartners.length, label:'Partner Baru (YTD)', color:'#0EA5E9'},
          {icon:'💰', val:formatCurrency(totalRev), label:'Revenue Terkumpul', color:'#22C55E'},
          {icon:'📊', val:formatCurrency(pipelineVal), label:'Pipeline Value', color:'#F59E0B'},
          {icon:'🎯', val:wonLeads.length, label:'Leads Won', color:'#8B5CF6'},
          {icon:'🔥', val:activeDeals.length, label:'Deal Aktif', color:'#EF4444'},
          {icon:'📈', val:`${wonLeads.length && (leads||[]).length ? Math.round(wonLeads.length/(leads||[]).length*100) : 0}%`, label:'Conversion Rate', color:'#00897B'},
        ].map(k=>`
          <div style="background:#fff;border-radius:10px;padding:12px 14px;border:1px solid var(--border);border-left:4px solid ${k.color}">
            <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${k.label}</div>
          </div>`).join('')}
      </div>`;
  } catch(e) {
    el.innerHTML = `<div class="status-box status-warn">⚠️ Tidak bisa load KPI: ${e.message}</div>`;
  }
}

async function loadOKR() {
  const period   = document.getElementById('okr-period')?.value || '';
  const assignee = document.getElementById('okr-assignee')?.value || '';

  try {
    let q = 'select=*&order=year.desc,quarter.desc,created_at.desc';
    if (period) q += `&period=eq.${period}`;
    if (assignee) q += `&assigned_name=eq.${encodeURIComponent(assignee)}`;

    const data = await sbGet('okr_targets', q);
    okrAll = Array.isArray(data) ? data : [];

    // Populate assignee filter
    const sel = document.getElementById('okr-assignee');
    if (sel && sel.options.length === 1) {
      const names = [...new Set(okrAll.map(o=>o.assigned_name).filter(Boolean))];
      names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        sel.appendChild(opt);
      });
    }

    const cnt = document.getElementById('okr-count');
    if (cnt) cnt.textContent = `${okrAll.length} OKR`;

    renderOKRList();
  } catch(e) {
    const el = document.getElementById('okr-list');
    if (el) el.innerHTML = `<div class="status-box status-err">❌ ${e.message}</div>`;
  }
}

function renderOKRList() {
  const el = document.getElementById('okr-list');
  if (!el) return;

  if (!okrAll.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ico">📈</div>
        <h3>Belum ada OKR</h3>
        <p>Tambah Objective dan Key Results untuk periode ini.</p>
        <button class="btn btn-teal" style="margin-top:12px" onclick="openOKRForm()">+ Tambah OKR</button>
      </div>`; return;
  }

  // Group by objective
  const byObj = {};
  okrAll.forEach(o => {
    const key = o.objective || 'Lainnya';
    if (!byObj[key]) byObj[key] = [];
    byObj[key].push(o);
  });

  el.innerHTML = Object.entries(byObj).map(([obj, items]) => `
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;
        padding-bottom:10px;border-bottom:1px solid var(--border)">
        🎯 ${obj}
      </div>
      ${items.map(o => {
        const pct = o.target > 0 ? Math.min(100, Math.round((o.actual||0)/o.target*100)) : 0;
        const color = pct >= 100 ? '#22C55E' : pct >= 70 ? '#F59E0B' : '#EF4444';
        return `
          <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #F1F5F9">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <div>
                <span style="font-size:13px;font-weight:600;color:var(--text)">${o.metric_type||o.metric||'—'}</span>
                <span style="font-size:11px;color:var(--text3);margin-left:8px">${o.period||''} · ${o.assigned_name||'Tim'}</span>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span style="font-size:13px;font-weight:700;color:${color}">${pct}%</span>
                <button class="act-btn edit" onclick="openUpdateOKR(${o.id})">✏️</button>
                <button class="act-btn del" onclick="deleteOKR(${o.id})">🗑</button>
              </div>
            </div>
            <div style="background:var(--lgray);border-radius:4px;height:8px;overflow:hidden;margin-bottom:6px">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .5s"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3)">
              <span>Realisasi: <strong style="color:var(--text)">${o.actual||0} ${o.unit||''}</strong></span>
              <span>Target: <strong style="color:var(--text)">${o.target||0} ${o.unit||''}</strong></span>
            </div>
          </div>`;
      }).join('')}
    </div>`).join('');
}

async function openOKRForm(id=null) {
  let o = {};
  if (id) {
    const d = await sbGet('okr_targets',`select=*&id=eq.${id}`);
    o = d[0]||{};
  }
  const user = getUserName ? getUserName() : 'User';
  const now  = new Date();
  const q    = Math.ceil((now.getMonth()+1)/3);
  const defPeriod = `${now.getFullYear()}-Q${q}`;

  const metrics = [
    'Jumlah Partner Baru','Jumlah Leads Won','Jumlah Deal MCU',
    'Jumlah Deal Wellness','Nilai Revenue (Rp)','Jumlah MOU Signed',
    'Jumlah Visit/Kunjungan','Jumlah Proposal Terkirim','Jumlah Event Health Day',
  ];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit OKR':'➕ Tambah OKR'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Objective *</label>
      <input type="text" id="of-obj" value="${o.objective||''}"
        placeholder="Contoh: Tingkatkan partner MCU korporat Q3 2026">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Key Result / Metrik *</label>
        <select id="of-metric" onchange="document.getElementById('of-metric-custom').style.display=this.value==='custom'?'block':'none'">
          <option value="">-- Pilih --</option>
          ${metrics.map(m=>`<option value="${m}"${o.metric_type===m?' selected':''}>${m}</option>`).join('')}
          <option value="custom">Lainnya (custom)</option>
        </select>
        <input type="text" id="of-metric-custom" value="${o.metric_type||''}"
          placeholder="Ketik metrik custom..." style="display:none;margin-top:6px">
      </div>
      <div class="form-group">
        <label>Periode</label>
        <select id="of-period">
          ${generatePeriodOptions(now)}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Target *</label>
        <input type="number" id="of-target" value="${o.target||''}" placeholder="0">
      </div>
      <div class="form-group">
        <label>Realisasi saat ini</label>
        <input type="number" id="of-actual" value="${o.actual||0}" placeholder="0">
      </div>
      <div class="form-group">
        <label>Satuan</label>
        <input type="text" id="of-unit" value="${o.unit||''}" placeholder="partner, deal, Rp, %">
      </div>
    </div>
    <div class="form-group">
      <label>Assigned To (Sales)</label>
      <input type="text" id="of-assigned" value="${o.assigned_name||user}" placeholder="Nama sales / Tim">
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <textarea id="of-notes" rows="2">${o.notes||''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveOKR(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function openUpdateOKR(id) {
  const d = await sbGet('okr_targets',`select=*&id=eq.${id}`);
  const o = d[0]||{};

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📊 Update Realisasi OKR</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="background:var(--lgray);border-radius:8px;padding:12px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text)">${o.objective||'—'}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">${o.metric_type||''} · Target: ${o.target} ${o.unit||''}</div>
    </div>
    <div class="form-group">
      <label>Realisasi Terkini *</label>
      <input type="number" id="upd-actual" value="${o.actual||0}">
    </div>
    <div class="form-group">
      <label>Catatan Update</label>
      <textarea id="upd-notes" rows="2" placeholder="Keterangan pencapaian...">${o.notes||''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveOKRUpdate(${id})">💾 Update</button>
    </div>`);
}

async function saveOKRUpdate(id) {
  const actual = parseFloat(document.getElementById('upd-actual').value)||0;
  const notes  = document.getElementById('upd-notes').value.trim();
  try {
    await sbPatch('okr_targets', id, {actual, notes, updated_at: new Date().toISOString()});
    toast('✅ Realisasi diupdate','ok');
    closeModalForce();
    await loadOKR();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function saveOKR(id) {
  const metricSel    = document.getElementById('of-metric').value;
  const metricCustom = document.getElementById('of-metric-custom').value.trim();
  const metric = metricSel === 'custom' ? metricCustom : metricSel;
  const obj    = document.getElementById('of-obj').value.trim();
  const target = parseFloat(document.getElementById('of-target').value)||0;

  if (!obj)    { toast('Objective wajib diisi','err'); return; }
  if (!metric) { toast('Metrik wajib dipilih','err'); return; }
  if (!target) { toast('Target wajib diisi','err'); return; }

  const period = document.getElementById('of-period').value;
  const [yr, qt] = period.includes('-Q')
    ? [parseInt(period.split('-Q')[0]), parseInt(period.split('-Q')[1])]
    : [parseInt(period), null];

  const payload = {
    objective:    obj,
    metric_type:  metric,
    period:       period,
    year:         yr,
    quarter:      qt,
    target:       target,
    actual:       parseFloat(document.getElementById('of-actual').value)||0,
    unit:         document.getElementById('of-unit').value.trim(),
    assigned_name:document.getElementById('of-assigned').value.trim(),
    notes:        document.getElementById('of-notes').value.trim(),
    created_by_name: getUserName ? getUserName() : 'User',
    updated_at:   new Date().toISOString(),
  };

  try {
    if (id) { await sbPatch('okr_targets', id, payload); toast('✅ OKR diupdate','ok'); }
    else    { await sbPost('okr_targets', payload);      toast('✅ OKR ditambahkan','ok'); }
    closeModalForce();
    await loadOKR();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteOKR(id) {
  if (!confirm('Hapus OKR ini?')) return;
  try {
    await sbDelete('okr_targets', id);
    toast('🗑 OKR dihapus','info');
    await loadOKR();
  } catch(e) { toast('❌ '+e.message,'err'); }
}
