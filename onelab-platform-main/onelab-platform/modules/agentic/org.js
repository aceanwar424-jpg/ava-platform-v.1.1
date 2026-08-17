// ═══════════════════════════════════════════════════════════════
// AGENTIC — ORGANISASI (Fase 6)
// Struktur organ AI: HEAD (decision maker) → QA Mutu · QA Konten ·
// Kepala IT · (Team Ops, Logistik menyusul). Matriks Mandat R1/R2/R3.
// Anda (CEO) hanya menerima eskalasi + laporan — bukan orkestra lagi.
// ═══════════════════════════════════════════════════════════════

let agOrgAgents = [], agOrgRights = [], agOrgMsgs = [];
let _agSelectedChatAgent = 'HEAD';
let _agChatHistory = [];

const AG_ORG_ICON = {
  HEAD:'👔', TEAM_OPS:'📋', LOGISTIK:'🚚',
  SA_HEAD:'🧪', SA_DOC:'📚', SA_AUDIT:'🔍', SA_REG:'📜', SA_CAPA:'🛠️', QA_MUTU:'✅',
  MKT_HEAD:'✍️', MKT_SEO:'🔑', MKT_COPY:'📝', MKT_DESIGN:'🎨', MKT_SOCIAL:'📣', QA_KONTEN:'✅',
  IT_HEAD:'🖥️', IT_SRE:'🛎️', IT_SEC:'🔐', IT_DATA:'🗄️', IT_DEV:'⚙️',
  SCM_STOCK:'📦', SCM_PO:'🧾',
  HR_HEAD:'👥', HR_CRED:'🪪', HR_ROSTER:'🗓️',
  LAB_HEAD:'🔬', LAB_QC:'🧫', LAB_TAT:'⏱️', LAB_CRIT:'🚨', LAB_CDS:'🩺',
  FIN_HEAD:'💰', FIN_AR:'📄', FIN_LEAK:'🕳️', FIN_RECON:'⚖️',
  GROWTH_HEAD:'🤝', CRM_LEAD:'🎯', CRM_DEAL:'📈', CRM_MOU:'📜',
  CX_HEAD:'💬', CX_COMPLAINT:'📣', CX_FEEDBACK:'⭐',
  PHARMA_HEAD:'💊', PHARMA_STOCK:'📦', PHARMA_SAFETY:'⚠️', PHARMA_NARCO:'🔒',
  WARD_HEAD:'🏥', WARD_BED:'🛏️', WARD_LOS:'📆', WARD_REV:'🧾',
  INSIGHT_HEAD:'🔮', INSIGHT_STOCK:'📉', INSIGHT_DEMAND:'📈', INSIGHT_RISK:'🎲',
};
const AG_DEPT_META = {
  LAB_OPS:          { icon:'🔬', label:'Lab Operations',    head:'LAB_HEAD', tick:'LAB_TICK', color:'#0891B2' },
  SERVICE_ASSURANCE:{ icon:'🧪', label:'Service Assurance', head:'SA_HEAD',  tick:'SA_TICK',  color:'#0EA5E9' },
  MARKETING:        { icon:'✍️', label:'Marketing',         head:'MKT_HEAD', tick:'MKT_TICK', color:'#8B5CF6' },
  IT:               { icon:'🖥️', label:'IT Profesional',    head:'IT_HEAD',  tick:'IT_CHECK', color:'#0F766E' },
  SUPPLY_CHAIN:     { icon:'🚚', label:'Supply Chain',      head:'LOGISTIK', tick:'SCM_TICK', color:'#D97706' },
  PEOPLE:           { icon:'👥', label:'People & Credentialing', head:'HR_HEAD', tick:'HR_TICK', color:'#DB2777' },
  FINANCE:          { icon:'💰', label:'Finance Intelligence', head:'FIN_HEAD', tick:'FIN_TICK', color:'#16A34A' },
  GROWTH:           { icon:'🤝', label:'Growth & CRM',      head:'GROWTH_HEAD', tick:'GROWTH_TICK', color:'#2563EB' },
  CX:               { icon:'💬', label:'Customer Experience', head:'CX_HEAD', tick:'CX_TICK', color:'#E11D48' },
  PHARMACY:         { icon:'💊', label:'Pharmacy',           head:'PHARMA_HEAD', tick:'PHARMA_TICK', color:'#7C3AED' },
  INPATIENT:        { icon:'🏥', label:'Rawat Inap',         head:'WARD_HEAD', tick:'WARD_TICK', color:'#0D9488' },
  INSIGHT:          { icon:'🔮', label:'Predictive Intelligence', head:'INSIGHT_HEAD', tick:'INSIGHT_TICK', color:'#4F46E5' },
};
const AG_RISK_META = {
  R1:{c:'#22C55E', l:'R1 — HEAD putuskan & terbitkan sendiri'},
  R2:{c:'#F59E0B', l:'R2 — HEAD setujui, publish oleh Anda'},
  R3:{c:'#EF4444', l:'R3 — hanya rekomendasi, keputusan Anda'},
};

async function agLoadOrg(){
  try{ agOrgAgents = await sbGet('agentic_agents_v','select=*&order=code.asc') || []; }catch(e){ agOrgAgents = []; }
  try{ agOrgRights = await sbGet('agentic_rights_v','select=*&active=eq.true&order=risk_class.asc,task_type.asc') || []; }catch(e){ agOrgRights = []; }
  try{ agOrgMsgs   = await sbGet('agentic_msgs_v','to_agent=eq.ACE&select=*&order=created_at.desc&limit=30') || []; }catch(e){ agOrgMsgs = []; }
  try{ _agChatHistory = await sbGet('agentic_msgs_v','or=(from_agent.eq.ACE,to_agent.eq.ACE)&order=created_at.asc') || []; }catch(e){ _agChatHistory = []; }
}

async function renderAgOrgTab(el){
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  await agLoadOrg();

  if(!agOrgAgents.length){
    el.innerHTML = `<div class="ag-detail" style="text-align:center;padding:26px;color:var(--gray);font-size:12.5px">
      Organisasi belum terpasang — jalankan <strong>supabase_agentic_fase6.sql</strong> di SQL Editor,
      lalu re-deploy <strong>agentic-worker</strong>.</div>`;
    return;
  }

  const head = agOrgAgents.find(a=>a.code==='HEAD');
  // Lapis 2: kepala departemen + organ lintas-fungsi yang lapor langsung ke HEAD
  const deptHeads = Object.values(AG_DEPT_META).map(m=>agOrgAgents.find(a=>a.code===m.head)).filter(Boolean);
  const deptHeadCodes = deptHeads.map(a=>a.code);
  const crossFn = agOrgAgents.filter(a=>a.code!=='HEAD' && a.reports_to==='HEAD' && !deptHeadCodes.includes(a.code));
  // Kartu 1 departemen: kepala + anggotanya (reports_to = kode kepala)
  const deptCard = (m)=>{
    const dh = agOrgAgents.find(a=>a.code===m.head); if(!dh) return '';
    const members = agOrgAgents.filter(a=>a.reports_to===m.head);
    return `<div class="ag-detail" style="border-top:3px solid ${m.color};padding:10px 12px;min-width:250px;flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12.5px;font-weight:800;color:#0A2342">${m.icon} ${agEsc(m.label)}</div>
        <button class="ag-btn mut" style="padding:3px 8px;font-size:10.5px" onclick="agOrgKick('${m.tick}')">${svgIcon('sparkle',10)} Patroli</button>
      </div>
      <div class="ag-detail" style="border:1px solid ${m.color};padding:7px 10px;margin-top:8px;text-align:center;position:relative;${dh.active?'':'opacity:.45'}">
        <button class="act-btn" title="Edit job desc" style="position:absolute;top:4px;right:4px" onclick="agOrgEditAgent('${dh.code}')">${svgIcon('edit',10)}</button>
        <div style="font-size:12px;font-weight:800;color:#0A2342">${AG_ORG_ICON[dh.code]||'🤖'} ${agEsc(dh.name)}</div>
        <div style="font-size:9.5px;color:var(--gray)">${agEsc(dh.role_title)}</div>
      </div>
      <div style="width:2px;height:8px;background:var(--border2);margin:0 auto"></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${members.map(a=>`<div class="ag-detail" style="padding:6px 9px;position:relative;${a.active?'':'opacity:.45'}">
          <button class="act-btn" title="Edit job desc" style="position:absolute;top:4px;right:4px" onclick="agOrgEditAgent('${a.code}')">${svgIcon('edit',10)}</button>
          <div style="font-size:11.5px;font-weight:700;color:#0A2342">${AG_ORG_ICON[a.code]||'🤖'} ${agEsc(a.name)}</div>
          <div style="font-size:9.5px;color:var(--gray)">${agEsc(a.role_title)} · ${agEsc(a.model_tier)}${a.active?'':' · NONAKTIF'}</div>
        </div>`).join('') || '<div style="font-size:10.5px;color:var(--gray);text-align:center">belum ada anggota</div>'}
      </div>
    </div>`;
  };

  el.innerHTML = `
    <div class="ag-detail" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:12px;font-weight:800;color:#0A2342">Struktur Organisasi Agent</div>
          <div style="font-size:11px;color:var(--gray)">Anda (CEO) → HEAD → staf. HEAD berdetak tiap 15 menit via cron (atau manual di sini).</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="ag-btn pub" onclick="agOrgKick('HEAD_TICK')">${svgIcon('sparkle',13)} Jalankan HEAD</button>
          <button class="ag-btn mut" onclick="agOrgKick('SA_TICK')">🧪 Patroli Mutu</button>
          <button class="ag-btn mut" onclick="agOrgKick('MKT_TICK')">${svgIcon('sparkle',13)} Patroli Marketing</button>
          <button class="ag-btn mut" onclick="agOrgKick('IT_CHECK')">${svgIcon('eye',13)} IT Check</button>
          <button class="ag-btn mut" onclick="agItSecAudit()">🔐 Audit Keamanan</button>
          <button class="ag-btn mut" onclick="agItTask('INTEGRATION_HEALTH','Cek integrasi lab')">🔌 Cek Integrasi</button>
          <button class="ag-btn mut" onclick="agItTask('BACKUP_VERIFY','Verifikasi backup')">💾 Cek Backup</button>
          <button class="ag-btn mut" onclick="agItTask('MASTER_LIST','Daftar induk dokumen')">📋 Daftar Induk</button>
          <button class="ag-btn mut" onclick="agItTask('CDS_REVIEW','CDS: cek mutu data hasil')">🩺 Cek Hasil (CDS)</button>
          <button class="ag-btn mut" onclick="agPlanCampaign()">📣 Rencana Kampanye</button>
          <button class="ag-btn pub" onclick="agOrgKick('EXEC_DIGEST')">📊 Digest Eksekutif</button>
          <button class="ag-btn mut" onclick="agOrgStandup()">${svgIcon('note',13)} Minta Standup</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;align-items:center;margin-top:14px">
        <div style="background:#0A2342;color:#fff;border-radius:10px;padding:8px 22px;font-weight:800;font-size:12.5px">👑 ANDA (CEO)</div>
        <div style="width:2px;height:14px;background:var(--border2)"></div>
        ${head?`<div class="ag-detail" style="border:2px solid #0A2342;padding:10px 18px;text-align:center;min-width:230px;position:relative">
          <button class="act-btn" title="Edit job desc" style="position:absolute;top:6px;right:6px" onclick="agOrgEditAgent('HEAD')">${svgIcon('edit',12)}</button>
          <div style="font-size:14px;font-weight:800;color:#0A2342">${AG_ORG_ICON.HEAD} ${agEsc(head.name)}</div>
          <div style="font-size:10.5px;color:var(--gray)">${agEsc(head.role_title)}</div>
          <span class="ag-badge" style="background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;margin-top:4px;display:inline-block">AKTIF · ${agEsc(head.model_tier)}</span>
        </div>`:''}
        <div style="width:2px;height:14px;background:var(--border2)"></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:stretch;width:100%">
          ${Object.values(AG_DEPT_META).map(deptCard).join('')}
        </div>
        ${crossFn.length?`<div style="width:2px;height:10px;background:var(--border2)"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          ${crossFn.map(a=>`<div class="ag-detail" style="padding:8px 13px;text-align:center;min-width:140px;position:relative;${a.active?'':'opacity:.45'}">
            <button class="act-btn" title="Edit job desc" style="position:absolute;top:5px;right:5px" onclick="agOrgEditAgent('${a.code}')">${svgIcon('edit',11)}</button>
            <div style="font-size:12px;font-weight:800;color:#0A2342">${AG_ORG_ICON[a.code]||'🤖'} ${agEsc(a.name)}</div>
            <div style="font-size:9.5px;color:var(--gray)">${agEsc(a.role_title)}</div>
            <span class="ag-badge" style="margin-top:4px;display:inline-block;${a.active
              ?'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC':'background:var(--bg2);color:var(--text3);border:1px solid #CBD5E1'}">
              ${a.active?'AKTIF':'NONAKTIF'} · ${agEsc(a.model_tier)}</span>
          </div>`).join('')}
        </div>`:''}
      </div>
    </div>

    <div class="pro-grid" style="grid-template-columns:1fr 1fr;gap:12px;align-items:start">
      <div class="ag-detail" id="ag-left-panel" style="padding:16px">
        <!-- Dynamic content via agRenderLeftPanel -->
      </div>

      <div class="ag-detail">
        <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">⚖️ Matriks Mandat (decision rights)</div>
        ${Object.entries(AG_RISK_META).map(([k,mm])=>`
          <div style="font-size:10.5px;font-weight:800;color:${mm.c};margin:8px 0 4px">${mm.l}</div>
          ${agOrgRights.filter(r=>r.risk_class===k && !['HEAD_TICK','QA_REVIEW','IT_CHECK','SMOKE_TEST'].includes(r.task_type)).map(r=>`
            <div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:4px 0;border-bottom:1px dashed #e2e8f0;cursor:pointer"
                 title="Klik untuk mengubah mandat" onclick="agOrgEditRight('${r.task_type}')">
              <span><strong>${agEsc(r.task_type)}</strong> <span style="color:var(--gray)">· ${agEsc(r.note||'')}</span></span>
              <span style="white-space:nowrap;color:var(--gray)">${r.qa_agent?`QA: ${agEsc(r.qa_agent)} ≥${r.min_score}`:'tanpa QA'} ${svgIcon('edit',10)}</span>
            </div>`).join('')}`).join('')}
        <div style="font-size:10.5px;color:var(--gray);margin-top:8px">
          Klik baris untuk mengubah mandat — berlaku seketika tanpa deploy.
          Konten ber-review-medis SELALU R3, apa pun isi matriks.</div>
      </div>
    </div>

    <div class="ag-detail" style="margin-top:12px" id="ag-cron-box">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">⏰ Penjadwal Otomatis (cron)</div>
      <div class="loading-row"><div class="spinner"></div></div>
    </div>

    <div class="ag-detail" style="margin-top:12px" id="ag-templates-box">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">📐 Template Dokumen Resmi (fidelity 100%)</div>
      <div class="loading-row"><div class="spinner"></div></div>
    </div>

    <div class="ag-detail" style="margin-top:12px" id="ag-creds-box">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">🪪 Kredensial Nakes (STR / SIP / Sertifikat)</div>
      <div class="loading-row"><div class="spinner"></div></div>
    </div>

    <div class="ag-detail" style="margin-top:12px" id="ag-complaints-box">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">💬 Keluhan Pelanggan (CX · ISO §7.7)</div>
      <div class="loading-row"><div class="spinner"></div></div>
    </div>

    <div class="ag-detail" style="margin-top:12px" id="ag-aiconfig-box">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">⚙️ Konfigurasi AI (model · API · video)</div>
      <div class="loading-row"><div class="spinner"></div></div>
    </div>

    <div class="ag-detail" style="margin-top:12px" id="ag-prompthist-box">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">🔧 Perbaikan Prompt oleh Kepala IT</div>
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;
  agRenderLeftPanel();
  agRenderCronBox();
  agRenderTemplates();
  agRenderCreds();
  agRenderComplaints();
  agRenderAiConfig();
  agRenderPromptHist();
}

// ── Panel Keluhan Pelanggan (CX, Fase 7L) ────────────────────────
const AG_CX_SEV = { Tinggi:'#dc2626', Sedang:'#b45309', Rendah:'#16a34a' };
async function agRenderComplaints(){
  const box = document.getElementById('ag-complaints-box'); if(!box) return;
  let rows = null;
  try{ rows = await sbGet('agentic_complaints_v','select=*&order=received_at.desc&limit=100') || []; }catch(e){ rows = null; }
  let inner;
  if(rows===null){
    inner = `<div style="font-size:12px;color:var(--gray)">Jalankan <strong>supabase_agentic_fase7l_bizops.sql</strong> untuk mengaktifkan penanganan keluhan.</div>`;
  } else {
    const open = rows.filter(r=>r.status!=='Closed');
    inner = `<div style="font-size:11px;color:var(--gray);margin-bottom:8px">Catat keluhan pelanggan. Agent <strong>CX_COMPLAINT</strong> mentriase & draft respons; keluhan hasil/klinis ditandai perlu verifikasi manusia. Terbuka: ${open.length}.</div>
      <div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Diterima</th><th>Pelanggan</th><th>Kanal</th><th>Kategori</th><th>Tingkat</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.slice(0,30).map(r=>{
          const sc = AG_CX_SEV[r.severity]||'#64748b';
          return `<tr${r.status==='Closed'?' style="opacity:.55"':''}>
            <td style="white-space:nowrap">${agEsc((r.received_at||'').slice(0,10))}</td>
            <td>${agEsc(r.customer_name||'—')}</td>
            <td>${agEsc(r.channel||'—')}</td>
            <td>${agEsc(r.category||'—')}</td>
            <td><span class="ag-badge" style="background:${sc}22;color:${sc};border:1px solid ${sc}">${agEsc(r.severity)}</span></td>
            <td><select class="form-input" style="padding:2px 4px;font-size:10.5px" onchange="agComplaintStatus('${r.id}',this.value)">
              ${['Open','InProgress','Closed'].map(st=>`<option ${r.status===st?'selected':''}>${st}</option>`).join('')}</select></td>
            <td><button class="act-btn" title="Edit" onclick="agComplaintEdit('${r.id}')">${svgIcon('edit',11)}</button></td>
          </tr>`;}).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:14px">Belum ada keluhan tercatat.</td></tr>'}</tbody>
      </table></div>`;
  }
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:800;color:#0A2342">💬 Keluhan Pelanggan (CX · ISO §7.7)</div>
      <div style="display:flex;gap:6px">
        <button class="ag-btn pub" style="padding:4px 10px;font-size:11px" onclick="agComplaintEdit()">${svgIcon('plus',11)} Tambah Keluhan</button>
        <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agOrgKick('CX_TICK')">💬 Patroli CX</button>
        <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agRenderComplaints()">${svgIcon('refresh',11)} Muat ulang</button>
      </div>
    </div>${inner}`;
}
let _agCxRows = [];
async function agComplaintEdit(id){
  try{ _agCxRows = await sbGet('agentic_complaints_v','select=*') || []; }catch(e){ _agCxRows = []; }
  const r = id ? _agCxRows.find(x=>x.id===id) : null;
  const kanal = ['WA','Telepon','Email','Langsung','Google','Lainnya'];
  const kat = ['Hasil','Layanan','Waktu Tunggu','Billing','Fasilitas','Lainnya'];
  openModal(`
    <div style="max-width:520px">
      <h3 style="margin:0 0 10px;color:#0A2342">💬 ${r?'Edit':'Tambah'} Keluhan</h3>
      <div style="display:grid;gap:9px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Pelanggan
            <input id="agcx-name" class="form-input" style="width:100%" value="${agEsc(r?r.customer_name||'':'')}"></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Kanal
            <select id="agcx-chan" class="form-input" style="width:100%">${kanal.map(k=>`<option ${r&&r.channel===k?'selected':''}>${k}</option>`).join('')}</select></label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Kategori
            <select id="agcx-cat" class="form-input" style="width:100%">${kat.map(k=>`<option ${r&&r.category===k?'selected':''}>${k}</option>`).join('')}</select></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Tingkat
            <select id="agcx-sev" class="form-input" style="width:100%">${['Rendah','Sedang','Tinggi'].map(k=>`<option ${r&&r.severity===k?'selected':(!r&&k==='Sedang'?'selected':'')}>${k}</option>`).join('')}</select></label>
        </div>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Uraian keluhan
          <textarea id="agcx-desc" class="form-input" style="width:100%;font-size:12px" rows="3">${agEsc(r?r.description||'':'')}</textarea></label>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Ditangani oleh
          <input id="agcx-assign" class="form-input" style="width:100%" value="${agEsc(r?r.assigned_name||'':'')}"></label>
        ${r?`<label style="font-size:11.5px;font-weight:700;color:var(--text2)">Resolusi
          <textarea id="agcx-res" class="form-input" style="width:100%;font-size:12px" rows="2">${agEsc(r.resolution||'')}</textarea></label>`:''}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="ag-btn mut" onclick="closeModal()">Batal</button>
        <button class="ag-btn pub" onclick="agComplaintSave('${r?r.id:''}')">${svgIcon('check',13)} Simpan</button>
      </div>
    </div>`);
}
async function agComplaintSave(id){
  const g = i=>(document.getElementById(i)||{}).value;
  try{
    const p = { customer_name:g('agcx-name'), channel:g('agcx-chan'), category:g('agcx-cat'),
      severity:g('agcx-sev'), description:g('agcx-desc'), assigned_name:g('agcx-assign') };
    if(id){ p.id=id; if(document.getElementById('agcx-res')) p.resolution=g('agcx-res'); }
    await agRpc('agentic_complaint_upsert', { p });
    closeModal(); toast('Keluhan disimpan','ok'); agRenderComplaints();
  }catch(e){ toast(e.message,'err'); }
}
async function agComplaintStatus(id, status){
  try{ await agRpc('agentic_complaint_upsert', { p:{ id, status } }); toast(`Keluhan → ${status}`,'ok'); agRenderComplaints(); }
  catch(e){ toast(e.message,'err'); }
}

// ── Panel Kredensial Nakes (Fase 7I) ─────────────────────────────
function agCredDays(exp){ if(!exp) return null; return Math.round((new Date(exp)-Date.now())/86400000); }
async function agRenderCreds(){
  const box = document.getElementById('ag-creds-box'); if(!box) return;
  let rows = null;
  try{ rows = await sbGet('agentic_credentials_v','select=*&order=expiry_date.asc') || []; }catch(e){ rows = null; }
  let inner;
  if(rows===null){
    inner = `<div style="font-size:12px;color:var(--gray)">Jalankan <strong>supabase_agentic_fase7i_hr.sql</strong> untuk mengaktifkan pemantauan kredensial.</div>`;
  } else {
    const today = rows.map(r=>({...r, d:agCredDays(r.expiry_date)}));
    inner = `<div style="font-size:11px;color:var(--gray);margin-bottom:8px">Isi STR/SIP/sertifikat tiap nakes. Agent <strong>HR_CRED</strong> memantau kedaluwarsa (feed Akreditasi Klinik & ISO 15189 §6.2). Merah = kedaluwarsa, kuning = ≤90 hari.</div>
      <div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Nama</th><th>Profesi</th><th>Jenis</th><th>Nomor</th><th>Kedaluwarsa</th><th>Sisa</th><th></th></tr></thead>
        <tbody>${today.map(r=>{
          const c = r.d==null?'#64748b':r.d<0?'#dc2626':r.d<=90?'#b45309':'#16a34a';
          return `<tr${r.is_active?'':' style="opacity:.5"'}>
            <td style="font-weight:700">${agEsc(r.staff_name)}</td>
            <td>${agEsc(r.profession||'—')}</td>
            <td>${agEsc(r.credential_type)}</td>
            <td style="white-space:nowrap">${agEsc(r.number||'—')}</td>
            <td style="white-space:nowrap">${agEsc(r.expiry_date||'—')}</td>
            <td style="white-space:nowrap;color:${c};font-weight:700">${r.d==null?'—':r.d<0?`kedaluwarsa ${Math.abs(r.d)}h`:`${r.d}h`}</td>
            <td style="white-space:nowrap"><button class="act-btn" title="Edit" onclick="agCredEdit('${r.id}')">${svgIcon('edit',11)}</button>
              <button class="act-btn" title="Hapus" onclick="agCredDelete('${r.id}')">🗑</button></td>
          </tr>`;}).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:14px">Belum ada kredensial — tambah agar HR_CRED bisa memantau.</td></tr>'}</tbody>
      </table></div>`;
  }
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:800;color:#0A2342">🪪 Kredensial Nakes (STR / SIP / Sertifikat)</div>
      <div style="display:flex;gap:6px">
        <button class="ag-btn pub" style="padding:4px 10px;font-size:11px" onclick="agCredEdit()">${svgIcon('plus',11)} Tambah</button>
        <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agOrgKick('HR_TICK')">🪪 Patroli Kredensial</button>
        <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agRenderCreds()">${svgIcon('refresh',11)} Muat ulang</button>
      </div>
    </div>${inner}`;
}
let _agCredRows = [];
async function agCredEdit(id){
  try{ _agCredRows = await sbGet('agentic_credentials_v','select=*') || []; }catch(e){ _agCredRows = []; }
  const r = id ? _agCredRows.find(x=>x.id===id) : null;
  const prof = ['Dokter','Dokter Spesialis','Perawat','ATLM (Analis)','Radiografer','Apoteker','Bidan','Lainnya'];
  const jenis = ['STR','SIP','SIPB','SIPA','Sertifikat Kompetensi','Lainnya'];
  openModal(`
    <div style="max-width:520px">
      <h3 style="margin:0 0 10px;color:#0A2342">🪪 ${r?'Edit':'Tambah'} Kredensial Nakes</h3>
      <div style="display:grid;gap:9px">
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Nama nakes
          <input id="agcr-name" class="form-input" style="width:100%" value="${agEsc(r?r.staff_name:'')}"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Profesi
            <select id="agcr-prof" class="form-input" style="width:100%">
              ${prof.map(p=>`<option ${r&&r.profession===p?'selected':''}>${p}</option>`).join('')}</select></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Jenis
            <select id="agcr-type" class="form-input" style="width:100%">
              ${jenis.map(p=>`<option ${r&&r.credential_type===p?'selected':''}>${p}</option>`).join('')}</select></label>
        </div>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Nomor
          <input id="agcr-num" class="form-input" style="width:100%" value="${agEsc(r?r.number||'':'')}"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Tanggal terbit
            <input id="agcr-issued" type="date" class="form-input" style="width:100%" value="${agEsc(r?r.issued_date||'':'')}"></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Kedaluwarsa
            <input id="agcr-expiry" type="date" class="form-input" style="width:100%" value="${agEsc(r?r.expiry_date||'':'')}"></label>
        </div>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Penerbit (KKI/KTKI/Organisasi profesi)
          <input id="agcr-issuer" class="form-input" style="width:100%" value="${agEsc(r?r.issuer||'':'')}"></label>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2);display:flex;align-items:center;gap:6px">
          <input type="checkbox" id="agcr-active" ${!r||r.is_active?'checked':''}> Aktif</label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="ag-btn mut" onclick="closeModal()">Batal</button>
        <button class="ag-btn pub" onclick="agCredSave('${r?r.id:''}')">${svgIcon('check',13)} Simpan</button>
      </div>
    </div>`);
}
async function agCredSave(id){
  const g = i=>(document.getElementById(i)||{}).value;
  try{
    const p = { staff_name:g('agcr-name'), profession:g('agcr-prof'), credential_type:g('agcr-type'),
      number:g('agcr-num'), issued_date:g('agcr-issued'), expiry_date:g('agcr-expiry'), issuer:g('agcr-issuer'),
      is_active:String(!!(document.getElementById('agcr-active')||{}).checked) };
    if(id) p.id = id;
    if(!p.staff_name){ toast('Nama wajib diisi','warn'); return; }
    await agRpc('agentic_cred_upsert', { p });
    closeModal(); toast('Kredensial disimpan','ok'); agRenderCreds();
  }catch(e){ toast(e.message,'err'); }
}
async function agCredDelete(id){
  if(!confirm('Hapus kredensial ini?')) return;
  try{ await agRpc('agentic_cred_delete', { p_id:id }); toast('Dihapus','ok'); agRenderCreds(); }
  catch(e){ toast(e.message,'err'); }
}

// ── Panel Konfig AI: set model/API/flag langsung dari web (Fase 7B) ──
const AG_CFG_CAT = { NVIDIA:'🟢 NVIDIA', GAMBAR:'🖼 Gambar', VIDEO:'🎬 Video', GEMINI:'🔵 Gemini', LANJUT:'⚙️ Lanjutan' };
async function agRenderAiConfig(){
  const box = document.getElementById('ag-aiconfig-box'); if(!box) return;
  let rows = [];
  try{ rows = await agRpc('agentic_config_ui', {}) || []; }catch(e){ rows = null; }
  let inner;
  if(rows===null){
    inner = `<div style="font-size:12px;color:var(--gray)">Jalankan <strong>supabase_agentic_fase7b.sql</strong> untuk mengaktifkan konfigurasi AI di web, lalu re-deploy <strong>llm-gateway</strong>.</div>`;
  } else {
    const cats = [...new Set(rows.map(r=>r.category))];
    inner = `<div style="font-size:11px;color:var(--gray);margin-bottom:8px">Kosongkan nilai untuk memakai Secret/env lama. Perubahan berlaku di panggilan AI berikutnya (tanpa re-deploy).</div>` +
      cats.map(cat=>`<div style="margin-bottom:10px">
        <div style="font-size:11px;font-weight:800;color:#0A2342;margin:6px 0 4px">${AG_CFG_CAT[cat]||cat}</div>
        ${rows.filter(r=>r.category===cat).map(r=>`
          <div style="display:grid;grid-template-columns:1fr 1.4fr auto;gap:8px;align-items:center;padding:4px 0;border-bottom:1px dashed #e2e8f0">
            <div>
              <div style="font-size:11.5px;font-weight:700;color:var(--text2)">${agEsc(r.label)} ${r.is_secret?'<span title="rahasia — tak ditampilkan" style="color:#B91C1C">🔒</span>':''}</div>
              <div style="font-size:10px;color:var(--gray)">${agEsc(r.notes||'')}</div>
            </div>
            <input id="agc-${agEsc(r.key)}" class="form-input" style="width:100%;font-size:11.5px"
              placeholder="${agEsc(r.is_secret&&r.has_value?'•••••• tersimpan — isi utk ganti':(r.placeholder||''))}"
              value="${r.is_secret?'':agEsc(r.value||'')}">
            <button class="ag-btn pub" style="padding:4px 10px;font-size:11px" onclick="agConfigSet('${agEsc(r.key)}')">${svgIcon('check',12)} Simpan</button>
          </div>`).join('')}
      </div>`).join('');
  }
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:12px;font-weight:800;color:#0A2342">⚙️ Konfigurasi AI (model · API · video)</div>
      <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agRenderAiConfig()">${svgIcon('refresh',11)} Muat ulang</button>
    </div>${inner}`;
}
async function agConfigSet(key){
  const el = document.getElementById('agc-'+key); if(!el) return;
  try{
    await agRpc('agentic_config_set', { p_key:key, p_value:el.value });
    toast(`${key} disimpan`,'ok');
    agRenderAiConfig();
  }catch(e){ toast(e.message,'err'); }
}

// ── Panel template dokumen: daftar + unggah master .docx per level/jenis ──
const AG_DOC_LEVELS = { 1:'L1 · Kebijakan/Pedoman Mutu', 2:'L2 · Prosedur (SOP)', 3:'L3 · Instruksi Kerja', 4:'L4 · Formulir/Rekaman' };
async function agRenderTemplates(){
  const box = document.getElementById('ag-templates-box'); if(!box) return;
  let rows = [];
  try{ rows = await sbGet('agentic_templates_v','select=*&order=doc_level.asc,doc_type.asc') || []; }catch(e){ rows = null; }
  const inner = rows===null
    ? `<div style="font-size:12px;color:var(--gray)">Jalankan <strong>supabase_agentic_fase7.sql</strong> untuk mengaktifkan registry template.</div>`
    : `<div style="font-size:11px;color:var(--gray);margin-bottom:8px">Unggah master <strong>.docx</strong> asli per level per jenis. Generator dokumen (SA_DOC) akan mengisi isi ke dalam master ini — header, footer, tipe huruf, ukuran, margin, dan spasi tetap PERSIS. Tanpa template, dokumen dibuat dari format standar (belum terjamin identik).</div>
      <div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Level</th><th>Jenis</th><th>Dept</th><th>Nama</th>
          <th title="Berkas master .docx yang mengunci format. WAJIB — 'terpasang' = template siap dipakai.">Master .docx</th>
          <th title="Contoh dokumen jadi sebagai acuan. OPSIONAL — '—' tidak apa-apa, template tetap siap pakai.">Contoh <span style="font-weight:400;color:var(--gray)">(opsional)</span></th><th></th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td style="white-space:nowrap">${AG_DOC_LEVELS[r.doc_level]||('L'+r.doc_level)}</td>
          <td>${agEsc(r.doc_type)}</td>
          <td>${(r.department||'')==='SEMUA'?'<span style="color:var(--gray)">Semua</span>':agEsc(r.department)}</td>
          <td>${agEsc(r.name)}</td>
          <td>${r.storage_path?`<span class="ag-badge" style="background:#DCFCE7;color:#15803D;border:1px solid #86EFAC">terpasang</span>`:'<span class="ag-badge" style="background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5">belum ada</span>'}</td>
          <td>${r.sample_path?'✅':'—'}</td>
          <td style="white-space:nowrap">
            ${r.storage_path?`<button class="act-btn" title="Tes rakit .docx dari master" onclick="agTemplateTestBuild('${r.id}')">${svgIcon('download',11)||'⬇'}</button>`:''}
            <button class="act-btn" title="Edit / unggah" onclick="agTemplateEdit('${r.id}')">${svgIcon('edit',11)}</button>
            <button class="act-btn" title="Hapus template" style="color:#B91C1C" onclick="agTemplateDelete('${r.id}','${(r.name||'').replace(/'/g,'')}')">${typeof icon==='function'?icon('trash',11):'🗑'}</button></td>
        </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:14px">Belum ada template — tambah lalu unggah master .docx contoh Anda.</td></tr>'}</tbody>
      </table></div>`;
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:12px;font-weight:800;color:#0A2342">📐 Template Dokumen Resmi (fidelity 100%)</div>
      <div style="display:flex;gap:6px">
        <button class="ag-btn pub" style="padding:4px 10px;font-size:11px" onclick="agTemplateEdit()">${svgIcon('plus',11)} Tambah Template</button>
        <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agRenderTemplates()">${svgIcon('refresh',11)} Muat ulang</button>
      </div>
    </div>${inner}`;
}

let _agTplRows = [];
let _agTplEditOrig = null;   // baris asli yang sedang disunting (untuk deteksi kunci berubah)
async function agTemplateEdit(id){
  try{ _agTplRows = await sbGet('agentic_templates_v','select=*') || []; }catch(e){ _agTplRows = []; }
  const r = id ? _agTplRows.find(x=>x.id===id) : null;
  _agTplEditOrig = r || null;
  const fs = (r && r.format_spec) || {};
  const mg = fs.margins_cm || {};
  openModal(`
    <div style="max-width:560px">
      <h3 style="margin:0 0 10px;color:#0A2342">📐 ${r?'Edit':'Tambah'} Template Dokumen</h3>
      <div style="display:grid;gap:9px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Level
            <select id="agt-level" class="form-input" style="width:100%">
              ${[1,2,3,4].map(l=>`<option value="${l}" ${r&&r.doc_level==l?'selected':''}>${AG_DOC_LEVELS[l]}</option>`).join('')}
            </select></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Jenis
            <input id="agt-type" class="form-input" style="width:100%" placeholder="SOP / IK / FORM …" value="${agEsc(r?r.doc_type:'SOP')}"></label>
        </div>
        <!-- Template berlaku untuk SEMUA departemen — tidak perlu diset per dept.
             Nilai 'SEMUA' dikenali pencarian template (agentic_template_get) sebagai
             wildcard yang cocok untuk dokumen departemen apa pun. -->
        <input type="hidden" id="agt-dept" value="SEMUA">
        <div style="font-size:11px;color:var(--gray)">Template ini berlaku untuk <b>semua departemen</b> pada level &amp; jenis di atas.</div>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Nama template
          <input id="agt-name" class="form-input" style="width:100%" value="${agEsc(r?r.name:'')}" placeholder="mis. SOP Pra-Analitik OneLab"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Font
            <input id="agt-font" class="form-input" style="width:100%" value="${agEsc(fs.font||'')}" placeholder="Arial / Times New Roman"></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Ukuran (pt)
            <input id="agt-size" class="form-input" style="width:100%" value="${agEsc(fs.size_pt||'')}" placeholder="11"></label>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr) 1fr;gap:8px">
          <label style="font-size:11px;font-weight:700;color:var(--text2)">Margin atas
            <input id="agt-mt" class="form-input" style="width:100%" value="${agEsc(mg.t||'')}" placeholder="cm"></label>
          <label style="font-size:11px;font-weight:700;color:var(--text2)">bawah
            <input id="agt-mb" class="form-input" style="width:100%" value="${agEsc(mg.b||'')}"></label>
          <label style="font-size:11px;font-weight:700;color:var(--text2)">kiri
            <input id="agt-ml" class="form-input" style="width:100%" value="${agEsc(mg.l||'')}"></label>
          <label style="font-size:11px;font-weight:700;color:var(--text2)">kanan
            <input id="agt-mr" class="form-input" style="width:100%" value="${agEsc(mg.r||'')}"></label>
          <label style="font-size:11px;font-weight:700;color:var(--text2)">Spasi baris
            <input id="agt-ls" class="form-input" style="width:100%" value="${agEsc(fs.line_spacing||'')}" placeholder="1.0/1.5"></label>
        </div>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Master .docx (mengunci header/footer/format)
          <input type="file" id="agt-file" class="form-input" style="width:100%" accept=".docx">
          ${r&&r.storage_path?`<span style="font-size:10.5px;color:#15803D">master terpasang — unggah baru hanya bila ingin mengganti</span>`:''}</label>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Contoh dokumen jadi (referensi — .docx/.pdf)
          <input type="file" id="agt-sample" class="form-input" style="width:100%" accept=".docx,.pdf">
          <span style="font-size:10.5px;color:var(--gray)">Unggah contoh dokumen asli Anda di sini. Dipakai sebagai acuan format & isi saat menyusun master.${r&&r.sample_path?' <span style="color:#15803D">contoh terpasang</span>':''}</span></label>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Daftar placeholder di master (satu per baris, tanpa kurung)
          <span style="font-weight:400;color:var(--gray)">— di file .docx tulis <code>{{NAMA}}</code>.</span>
          <div style="font-weight:400;font-size:10.5px;color:var(--gray);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;margin:3px 0">
            <b>Penanda ISI (diisi otomatis verbatim dari struktur dokumen):</b>
            <code>{{TUJUAN}}</code> <code>{{RUANG_LINGKUP}}</code> <code>{{PENANGGUNG_JAWAB}}</code>
            <code>{{REFERENSI}}</code> <code>{{IKHTISAR_UMUM}}</code> <code>{{GLOSARIUM}}</code>
            <code>{{DOKUMEN_TERKAIT}}</code> <code>{{ISI_PROSEDUR}}</code> <code>{{DIAGRAM_ALUR}}</code>
            <code>{{INDIKATOR_KINERJA_(KPI)}}</code> <code>{{PENANGANAN_KETIDAKSESUAIAN}}</code>
            <code>{{CAPA}}</code> <code>{{PELAPORAN_INSIDEN}}</code> <code>{{PENGELOLAAN_ARSIP}}</code>.<br>
            <b>Penanda METADATA (diisi AI/manual):</b> JUDUL_SOP, VERSI_DOKUMEN, STATUS_DOKUMEN,
            NOMOR_DOKUMEN, KLASIFIKASI_DOKUMEN, TANGGAL_EFEKTIF, TANGGAL_PENINJAUAN, PEMILIK_DOKUMEN,
            NAMA_PENYETUJU, JABATAN_PENYETUJU.
          </div>
          <textarea id="agt-ph" class="form-input" style="width:100%;font-size:12px" rows="3" placeholder="JUDUL&#10;NO_DOKUMEN&#10;TANGGAL_TERBIT">${agEsc(r&&Array.isArray(r.placeholders)?r.placeholders.join('\n'):'')}</textarea></label>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Catatan (header/footer, penomoran, dll)
          <textarea id="agt-notes" class="form-input" style="width:100%;font-size:12px" rows="3">${agEsc(r?r.notes||'':'')}</textarea></label>
      </div>
      <div id="agt-log" style="font-size:11.5px;margin-top:6px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button class="ag-btn mut" onclick="closeModal()">Batal</button>
        <button class="ag-btn pub" onclick="agTemplateSave()">${svgIcon('check',13)} Simpan</button>
      </div>
    </div>`);
}
async function agTemplateSave(){
  const g = id=>(document.getElementById(id)||{}).value;
  const log = document.getElementById('agt-log');
  const put = (m,c)=>{ if(log) log.innerHTML = `<div style="color:${c||'#334155'}">${m}</div>`; };
  try{
    let storage_path, sample_path;
    const f = (document.getElementById('agt-file')||{}).files;
    if(f && f[0]){ put('⏳ Mengunggah master .docx…'); storage_path = await agUploadStorage(f[0]); }
    const sf = (document.getElementById('agt-sample')||{}).files;
    if(sf && sf[0]){ put('⏳ Mengunggah contoh dokumen…'); sample_path = await agUploadStorage(sf[0]); }
    const spec = { font:g('agt-font')||null, size_pt:Number(g('agt-size'))||null,
      margins_cm:{ t:Number(g('agt-mt'))||null, b:Number(g('agt-mb'))||null, l:Number(g('agt-ml'))||null, r:Number(g('agt-mr'))||null },
      line_spacing:g('agt-ls')||null };
    const phList = (g('agt-ph')||'').split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
    const p = { doc_level:Number(g('agt-level')), doc_type:g('agt-type')||'SOP', department:g('agt-dept')||'SEMUA',
      name:g('agt-name')||'Template', format_spec:spec, placeholders:phList, notes:g('agt-notes')||null };
    if(storage_path) p.storage_path = storage_path;
    if(sample_path) p.sample_path = sample_path;
    // Bila tak mengunggah master/contoh baru saat edit, pertahankan yang lama
    // (upsert by level+jenis+dept membuat baris baru saat kunci berubah).
    const o = _agTplEditOrig;
    if(o){
      if(!p.storage_path && o.storage_path) p.storage_path = o.storage_path;
      if(!p.sample_path && o.sample_path) p.sample_path = o.sample_path;
    }
    await agRpc('agentic_template_upsert', { p });

    // Bila mengedit dan KUNCI (level+jenis+dept) berubah — mis. dept MUTU→SEMUA —
    // upsert membuat baris BARU; baris lama jadi duplikat yatim. Hapus yang lama.
    if(o && (o.doc_level!=p.doc_level || o.doc_type!=p.doc_type || o.department!=p.department)){
      try{ await agRpc('agentic_template_delete', { p_id:o.id }); }catch(e){}
    }
    _agTplEditOrig = null;
    closeModal(); toast('Template disimpan','ok'); agRenderTemplates();
  }catch(e){ put('❌ '+agEsc(e.message),'#B91C1C'); }
}

async function agTemplateDelete(id, name){
  if(!confirm(`Hapus template "${name||''}"?\n\nBerkas master .docx yang terunggah tidak dapat dikembalikan.\nDokumen yang sudah pernah dirakit TIDAK terpengaruh.`)) return;
  try{
    await agRpc('agentic_template_delete', { p_id:id });
    if(typeof logActivity==='function') logActivity('template_delete','doc_templates',id,`Template dihapus: ${name||id}`,'');
    toast('Template dihapus','ok');
    agRenderTemplates();
  }catch(e){ toast('❌ '+(/not find the function/i.test(e.message)?'Jalankan supabase_agentic_doc_sign.sql dulu':e.message),'err'); }
}

// Unduh file mentah dari Storage bucket "agentic"
async function agDownloadStorage(path){
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/agentic/${path}`, {
    headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` } });
  if(!res.ok) throw new Error(`Gagal unduh master (HTTP ${res.status})`);
  return await res.arrayBuffer();
}
// Tes rakit .docx: master → isi placeholder dgn nilai contoh → unduh (bukti format identik)
async function agTemplateTestBuild(id){
  try{
    const rows = await sbGet('agentic_templates_v', `select=*&id=eq.${id}`) || [];
    const r = rows[0]; if(!r || !r.storage_path){ toast('Master .docx belum diunggah','warn'); return; }
    if(typeof agDocxFill!=='function'){ toast('docxfill.js belum dimuat — reload halaman','err'); return; }
    toast('Mengunduh master & merakit…','info');
    const buf = await agDownloadStorage(r.storage_path);
    let phs = Array.isArray(r.placeholders)?r.placeholders.slice():[];
    try{ const scan = await agDocxScanPlaceholders(buf); scan.forEach(k=>{ if(!phs.includes(k)) phs.push(k); }); }catch(e){}
    const repl = {}; phs.forEach(k=> repl[k] = `[CONTOH: ${k}]`);
    const out = await agDocxFill(buf, repl);
    const blob = new Blob([out], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download = `TES_${String(r.name||'template').replace(/[^\w.\-]+/g,'_')}.docx`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast(phs.length?`Tes rakit selesai — ${phs.length} placeholder diisi contoh`:'Tes rakit selesai — tidak ada {{placeholder}} di master','ok');
  }catch(e){ toast(e.message,'err'); }
}

// ── Riwayat perbaikan prompt IT + rollback ───────────────────────
async function agRenderPromptHist(){
  const box = document.getElementById('ag-prompthist-box'); if(!box) return;
  let hist = [];
  try{ hist = await sbGet('agentic_prompt_hist_v','select=*&order=created_at.desc&limit=20') || []; }catch(e){ hist = null; }
  const inner = hist===null
    ? `<div style="font-size:12px;color:var(--gray)">Jalankan <strong>supabase_agentic_fase6c.sql</strong> untuk mengaktifkan self-heal prompt oleh Kepala IT.</div>`
    : !hist.length
    ? `<div style="font-size:12px;color:var(--gray)">Belum ada perbaikan. Kepala IT akan memperbaiki prompt otomatis saat mendeteksi kegagalan berulang (gambar diblokir / QA gagal), lalu tercatat di sini dengan tombol rollback.</div>`
    : hist.map(h=>`<div style="border:1px solid var(--border);border-left:4px solid #8B5CF6;border-radius:8px;padding:8px 12px;margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px">
          <span><strong>${agEsc(h.code)}</strong> <span style="color:var(--gray)">v${h.version} · oleh ${agEsc(h.changed_by)}</span></span>
          <span style="color:var(--gray)">${agAgo(h.created_at)}</span>
        </div>
        <div style="font-size:11.5px;color:#475569;margin-top:2px">${agEsc(h.reason||'')}</div>
        <button class="ag-btn warn" style="padding:3px 10px;margin-top:5px;font-size:11px" onclick="agPromptRollback('${agEsc(h.code)}')">${svgIcon('refresh',11)} Rollback ke versi ini</button>
      </div>`).join('');
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:12px;font-weight:800;color:#0A2342">🔧 Perbaikan Prompt oleh Kepala IT</div>
      <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agRenderPromptHist()">${svgIcon('refresh',11)} Muat ulang</button>
    </div>${inner}`;
}
async function agPromptRollback(code){
  if(!confirm(`Kembalikan prompt "${code}" ke versi sebelum perbaikan terakhir?`)) return;
  try{
    const r = await agRpc('agentic_prompt_rollback', { p_code: code });
    toast(`Prompt ${code} dikembalikan ke v${r&&r.restored_from_version}`,'ok');
    agRenderPromptHist();
  }catch(e){ toast(e.message,'err'); }
}

// ── Panel cron: pantau + jeda/aktifkan tanpa SQL ─────────────────
async function agRenderCronBox(){
  const box = document.getElementById('ag-cron-box'); if(!box) return;
  let cs = null;
  try{ cs = await agRpc('agentic_cron_status', {}); }catch(e){ cs = null; }
  const inner = !cs
    ? `<div style="font-size:12px;color:var(--gray)">Jalankan <strong>supabase_agentic_fase6b.sql</strong> untuk mengaktifkan panel ini.</div>`
    : !cs.enabled
    ? `<div style="font-size:12px;color:#92400E;background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:9px 12px">
        Extension <strong>pg_cron</strong> belum aktif — Database → Extensions → aktifkan <code>pg_cron</code> &amp; <code>pg_net</code>,
        lalu jalankan blok §CRON (lihat AGENTIC_FASE6.md). Tanpa cron, gunakan tombol manual di atas.</div>`
    : `${(cs.jobs||[]).length ? `<div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Job</th><th>Jadwal</th><th>Status</th><th></th></tr></thead>
        <tbody>${cs.jobs.map(j=>`<tr>
          <td style="font-weight:700">${agEsc(j.jobname)}</td>
          <td style="font-family:monospace">${agEsc(j.schedule)}</td>
          <td><span class="ag-badge" style="${j.active?'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC':'background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5'}">${j.active?'AKTIF':'DIJEDA'}</span></td>
          <td><button class="ag-btn ${j.active?'warn':'ok'}" style="padding:3px 10px;font-size:11px"
            onclick="agCronToggle('${agEsc(j.jobname)}', ${!j.active})">${j.active?'⏸ Jeda':'▶ Aktifkan'}</button></td>
        </tr>`).join('')}</tbody></table></div>`
      : `<div style="font-size:12px;color:var(--gray)">pg_cron aktif tapi belum ada job agentic — jalankan blok §CRON siap-pakai (lihat AGENTIC_FASE6.md).</div>`}
      ${(cs.runs||[]).length ? `<div style="font-size:11px;font-weight:800;color:#0A2342;margin:10px 0 4px">Eksekusi terakhir</div>
        ${cs.runs.slice(0,8).map(r=>`<div style="font-size:11px;padding:3px 0;border-bottom:1px dashed #e2e8f0;display:flex;justify-content:space-between;gap:8px">
          <span>${r.status==='succeeded'?'✅':'❌'} <strong>${agEsc(r.jobname)}</strong> ${r.msg&&r.status!=='succeeded'?`<span style="color:#B91C1C">· ${agEsc(r.msg)}</span>`:''}</span>
          <span style="color:var(--gray);white-space:nowrap">${new Date(r.start_time).toLocaleString('id-ID')}</span>
        </div>`).join('')}` : ''}`;
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:12px;font-weight:800;color:#0A2342">⏰ Penjadwal Otomatis (cron)</div>
      <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agRenderCronBox()">${svgIcon('refresh',11)} Muat ulang</button>
    </div>${inner}`;
}
async function agCronToggle(jobname, active){
  try{
    await agRpc('agentic_cron_toggle', { p_jobname: jobname, p_active: active });
    toast(`${jobname} ${active?'diaktifkan':'dijeda'}`,'ok');
    agRenderCronBox();
  }catch(e){ toast(e.message,'err'); }
}

// ── Modal: edit job desc / charter organ ─────────────────────────
function agOrgEditAgent(code){
  const a = agOrgAgents.find(x=>x.code===code); if(!a) return;
  openModal(`
    <div style="max-width:560px">
      <h3 style="margin:0 0 10px;color:#0A2342">${AG_ORG_ICON[code]||'🤖'} Edit Organ — ${agEsc(a.code)}</h3>
      <div style="display:grid;gap:9px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Nama
            <input id="agoe-name" class="form-input" style="width:100%" value="${agEsc(a.name)}"></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Jabatan
            <input id="agoe-role" class="form-input" style="width:100%" value="${agEsc(a.role_title)}"></label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Model
            <select id="agoe-tier" class="form-input" style="width:100%">
              <option value="main" ${a.model_tier==='main'?'selected':''}>main (Nemotron — berat)</option>
              <option value="light" ${a.model_tier==='light'?'selected':''}>light (cepat & murah)</option>
            </select></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2);display:flex;align-items:end;gap:6px;padding-bottom:8px">
            <input type="checkbox" id="agoe-active" ${a.active?'checked':''}> Aktif</label>
        </div>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Job Description / Charter
          <span style="font-weight:400;color:var(--gray)">(= system prompt agent — ini "perintah kerja"-nya)</span>
          <textarea id="agoe-charter" class="form-input" style="width:100%;font-size:12px" rows="9">${agEsc(a.charter)}</textarea></label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="ag-btn mut" onclick="closeModal()">Batal</button>
        <button class="ag-btn pub" onclick="agOrgSaveAgent('${a.code}')">${svgIcon('check',13)} Simpan</button>
      </div>
    </div>`);
}
async function agOrgSaveAgent(code){
  try{
    await agRpc('agentic_agent_update', { p_code: code, p: {
      name: (document.getElementById('agoe-name')||{}).value,
      role_title: (document.getElementById('agoe-role')||{}).value,
      model_tier: (document.getElementById('agoe-tier')||{}).value,
      active: String(!!(document.getElementById('agoe-active')||{}).checked),
      charter: (document.getElementById('agoe-charter')||{}).value,
    }});
    closeModal(); toast('Organ diperbarui — berlaku di task berikutnya','ok');
    agRenderTab();
  }catch(e){
    toast(e.message.includes('agentic_agent_update')?'Jalankan supabase_agentic_fase6b.sql dulu':e.message,'err');
  }
}

// ── Modal: edit mandat (decision rights) ─────────────────────────
function agOrgEditRight(taskType){
  const r = agOrgRights.find(x=>x.task_type===taskType); if(!r) return;
  const qaOpts = agOrgAgents.filter(a=>a.code.startsWith('QA')).map(a=>a.code);
  openModal(`
    <div style="max-width:480px">
      <h3 style="margin:0 0 10px;color:#0A2342">⚖️ Mandat — ${agEsc(r.task_type)}</h3>
      <div style="display:grid;gap:9px">
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Aksi otomatis HEAD
          <select id="agre-action" class="form-input" style="width:100%">
            ${[['AUTO_PUBLISH','R1 — publish sendiri (butuh QA PASS)'],
               ['AUTO_PUBLISH_NOQA','R1 — publish tanpa QA (log/internal)'],
               ['AUTO_APPROVE','R2 — approve saja, publish oleh Anda'],
               ['RECOMMEND','R3 — hanya rekomendasi, keputusan Anda']]
              .map(([v,l])=>`<option value="${v}" ${r.auto_action===v?'selected':''}>${l}</option>`).join('')}
          </select></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">QA penilai
            <select id="agre-qa" class="form-input" style="width:100%">
              <option value="">(tanpa QA)</option>
              ${qaOpts.map(q=>`<option ${r.qa_agent===q?'selected':''}>${q}</option>`).join('')}
            </select></label>
          <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Skor minimal lulus
            <input id="agre-min" type="number" min="0" max="100" class="form-input" style="width:100%" value="${r.min_score}"></label>
        </div>
        <label style="font-size:11.5px;font-weight:700;color:var(--text2)">Catatan
          <input id="agre-note" class="form-input" style="width:100%" value="${agEsc(r.note||'')}"></label>
        <div style="font-size:10.5px;color:#92400E;background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:6px 9px">
          Konten ber-review-medis tetap dipaksa R3 oleh sistem, apa pun setelan ini.</div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="ag-btn mut" onclick="closeModal()">Batal</button>
        <button class="ag-btn pub" onclick="agOrgSaveRight('${r.task_type}')">${svgIcon('check',13)} Simpan Mandat</button>
      </div>
    </div>`);
}
async function agOrgSaveRight(taskType){
  const action = (document.getElementById('agre-action')||{}).value;
  const risk = action==='RECOMMEND'?'R3':action==='AUTO_APPROVE'?'R2':'R1';
  try{
    await agRpc('agentic_rights_update', { p_task_type: taskType, p: {
      auto_action: action, risk_class: risk,
      qa_agent: (document.getElementById('agre-qa')||{}).value,
      min_score: (document.getElementById('agre-min')||{}).value,
      note: (document.getElementById('agre-note')||{}).value,
    }});
    closeModal(); toast('Mandat diperbarui — berlaku di tick HEAD berikutnya','ok');
    agRenderTab();
  }catch(e){
    toast(e.message.includes('agentic_rights_update')?'Jalankan supabase_agentic_fase6b.sql dulu':e.message,'err');
  }
}

async function agOrgKick(type){
  try{
    const r = await agRpc('agentic_org_kick', { p_type: type });
    if(r && r.skipped){ toast('Masih ada yang antri/berjalan — tunggu selesai','info'); return; }
    const _lbl = { HEAD_TICK:'HEAD', IT_CHECK:'Kepala IT', SA_TICK:'Service Assurance', MKT_TICK:'Marketing', SCM_TICK:'Supply Chain', HR_TICK:'People', LAB_TICK:'Lab Ops', FIN_TICK:'Finance', GROWTH_TICK:'Growth', CX_TICK:'CX', EXEC_DIGEST:'Executive Digest', PHARMA_TICK:'Pharmacy', WARD_TICK:'Rawat Inap', INSIGHT_TICK:'Predictive' };
    toast(`${_lbl[type]||type} ditugaskan — menjalankan worker…`,'ok');
    await agRunWorker(4);
    await agReload();
    if(_agTab==='org') agRenderTab();
  }catch(e){
    toast(e.message.includes('agentic_org_kick')?'Jalankan supabase_agentic_fase6.sql dulu':e.message,'err');
  }
}
async function agOrgStandup(){
  try{
    const r = await agRpc('agentic_org_kick', { p_type:'HEAD_TICK', p_payload:{ standup:true } });
    if(r && r.skipped){ toast('HEAD masih berjalan — tunggu sebentar','info'); return; }
    toast('Standup diminta — menjalankan worker…','ok');
    await agRunWorker(4);
    if(_agTab==='org') agRenderTab();
  }catch(e){ toast(e.message,'err'); }
}
async function agItSecAudit(){
  try{
    await agRpc('agentic_create_task', { p_agent:'ORG', p_task_type:'IT_SEC_AUDIT',
      p_title:'Audit postur keamanan IT', p_payload:{} });
    toast('Audit keamanan ditugaskan — menjalankan worker…','ok');
    await agRunWorker(2);
    await agReload();
    if(_agTab==='org') agRenderTab();
  }catch(e){
    toast(/IT_SEC_AUDIT|agentic_it_sec_scan/.test(e.message)?'Jalankan supabase_agentic_fase7f_it.sql dulu':e.message,'err');
  }
}
async function agItTask(type, title){
  try{
    await agRpc('agentic_create_task', { p_agent:'ORG', p_task_type:type, p_title:title, p_payload:{} });
    toast(`${title} ditugaskan — menjalankan worker…`,'ok');
    await agRunWorker(2);
    await agReload();
    if(_agTab==='org') agRenderTab();
  }catch(e){
    toast(/INTEGRATION_HEALTH|BACKUP_VERIFY|integration_scan|backup_status/.test(e.message)?'Jalankan supabase_agentic_fase7g_it.sql dulu':
      /MASTER_LIST|doc_admin/.test(e.message)?'Jalankan supabase_agentic_fase7k_cleanup.sql dulu':e.message,'err');
  }
}
async function agPlanCampaign(){
  const goal = prompt('Tujuan kampanye (mis. promosi paket MCU korporat Q3):','');
  if(goal===null || !goal.trim()) return;
  const period = prompt('Periode (mis. 1 bulan / Juli-Agustus):','1 bulan') || '1 bulan';
  try{
    await agRpc('agentic_create_task', { p_agent:'CONTENT', p_task_type:'PLAN_CAMPAIGN',
      p_title:`Rencana kampanye: ${goal.slice(0,80)}`, p_payload:{ goal, period } });
    toast('Rencana kampanye ditugaskan — menjalankan worker…','ok');
    await agRunWorker(3);
    await agReload();
    if(_agTab==='org') agRenderTab();
  }catch(e){
    toast(/PLAN_CAMPAIGN/.test(e.message)?'Jalankan supabase_agentic_fase7k_cleanup.sql dulu':e.message,'err');
  }
}

// ── Obrolan Agen & Monitor Keaktifan Interaktif ─────────────────────────
let _agChatTab = 'chat';
let _agChatPollTimer = null;

window.switchAgChatTab = function(tab) {
  _agChatTab = tab;
  window.agRenderLeftPanel();
};

window.agSelectChatAgent = function(code) {
  _agSelectedChatAgent = code;
  window.agRenderLeftPanel();
};

window.getAgentStatus = function(agent) {
  if (!agent.active) return '<span style="color:var(--danger)">🔴 Nonaktif</span>';
  const activeTask = agTasks.find(t => 
    (t.status === 'PROCESSING' || t.status === 'QUEUED') && 
    (t.payload?.agent_code === agent.code || t.task_type.startsWith(agent.code.split('_')[0]))
  );
  if (activeTask) {
    const actionText = activeTask.status === 'PROCESSING' ? 'Memproses' : 'Antri';
    return `<span style="color:#0ea5e9;font-weight:700">⚡ ${actionText} ("${activeTask.title}")</span>`;
  }
  return '<span style="color:#22c55e;font-weight:700">🟢 Menganggur (IDLE)</span>';
};

window.agSendChatMsg = async function() {
  const input = document.getElementById('ag-chat-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  const newMsg = {
    from_agent: 'ACE',
    to_agent: _agSelectedChatAgent,
    kind: 'CHAT',
    body: val,
    created_at: new Date().toISOString()
  };
  _agChatHistory.push(newMsg);
  window.agRenderLeftPanel();
  input.value = '';

  try {
    await sbPost('agentic_msgs_v', {
      from_agent: 'ACE',
      to_agent: _agSelectedChatAgent,
      kind: 'CHAT',
      body: val
    });

    await agRpc('agentic_create_task', {
      p_agent: 'ORG',
      p_task_type: 'CHAT_RESPONSE',
      p_title: `Tanggapan Chat: ${_agSelectedChatAgent}`,
      p_payload: { agent_code: _agSelectedChatAgent, message: val },
      p_priority: 1
    });

    agRunWorker(1).catch(() => null);
    window.startChatPolling();
  } catch (err) {
    console.error("Gagal mengirim pesan chat:", err);
  }
};

window.startChatPolling = function() {
  if (_agChatPollTimer) clearInterval(_agChatPollTimer);
  let ticks = 0;
  _agChatPollTimer = setInterval(async () => {
    ticks++;
    if (ticks > 12) {
      clearInterval(_agChatPollTimer);
      return;
    }
    try {
      _agChatHistory = await sbGet('agentic_msgs_v','or=(from_agent.eq.ACE,to_agent.eq.ACE)&order=created_at.asc') || [];
      window.agRenderLeftPanel();
      
      const lastMsg = _agChatHistory[_agChatHistory.length - 1];
      if (lastMsg && lastMsg.from_agent === _agSelectedChatAgent) {
        clearInterval(_agChatPollTimer);
      }
    } catch(e) {}
  }, 2000);
};

window.agRenderLeftPanel = function() {
  const panel = document.getElementById('ag-left-panel');
  if (!panel) return;

  const tabHeader = `
    <div style="display:flex;gap:8px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:6px;">
      <button class="btn btn-sm ${_agChatTab==='chat'?'btn-teal':'btn-light'}" onclick="window.switchAgChatTab('chat')" style="margin:0;font-size:11px;padding:4px 8px">${agIco('users',12)} Hubungi Agen</button>
      <button class="btn btn-sm ${_agChatTab==='inbox'?'btn-teal':'btn-light'}" onclick="window.switchAgChatTab('inbox')" style="margin:0;font-size:11px;padding:4px 8px">${agIco('list',12)} Inbox Pesan (${agOrgMsgs.length})</button>
    </div>
  `;

  if (_agChatTab === 'chat') {
    const activeAgent = agOrgAgents.find(a => a.code === _agSelectedChatAgent);
    const agentStatus = activeAgent ? window.getAgentStatus(activeAgent) : '';
    const chatMsgs = _agChatHistory.filter(m => 
      (m.from_agent === _agSelectedChatAgent && m.to_agent === 'ACE') ||
      (m.from_agent === 'ACE' && m.to_agent === _agSelectedChatAgent)
    );

    let chatHtml = `
      <div style="margin-bottom:8px">
        <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:700">Pilih Agen untuk Dihubungi:</label>
        <select id="ag-chat-select" class="form-select" onchange="window.agSelectChatAgent(this.value)" style="font-size:12px;padding:6px;width:100%;border-radius:6px;border:1px solid var(--border)">
          ${agOrgAgents.map(a => `<option value="${a.code}" ${a.code===_agSelectedChatAgent?'selected':''}>${AG_ORG_ICON[a.code]||'🤖'} ${a.name} (${a.role_title})</option>`).join('')}
        </select>
      </div>
      
      <div class="ag-detail" style="padding:10px;margin-bottom:8px;background:var(--bg);border-left:4px solid var(--primary);border-radius:6px">
        <div style="font-size:12px;font-weight:800;color:#0A2342">${activeAgent ? activeAgent.name : ''}</div>
        <div style="font-size:10px;color:var(--gray);margin-bottom:4px">${activeAgent ? activeAgent.role_title : ''}</div>
        <div style="font-size:11px;display:flex;align-items:center;gap:4px">
          <span>Status Kerja:</span>
          <strong>${agentStatus}</strong>
        </div>
      </div>

      <div id="ag-chat-history-container" style="height:32vh;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--white);margin-bottom:8px;display:flex;flex-direction:column;gap:8px">
        ${chatMsgs.length ? chatMsgs.map(m => {
          const isMe = m.from_agent === 'ACE';
          const bubbleBg = isMe ? '#0f2963' : '#f1f5f9';
          const bubbleColor = isMe ? '#ffffff' : 'var(--text-main)';
          const align = isMe ? 'align-self:flex-end;border-bottom-right-radius:2px;' : 'align-self:flex-start;border-bottom-left-radius:2px;';
          return `
            <div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:11.5px;${align}background:${bubbleBg};color:${bubbleColor};box-shadow: 0 1px 2px rgba(0,0,0,0.05)">
              <div style="font-size:8px;color:${isMe?'rgba(255,255,255,0.7)':'var(--text-muted)'};margin-bottom:2px;font-weight:700">
                ${isMe ? 'Anda (CEO)' : `${AG_ORG_ICON[m.from_agent]||''} ${activeAgent.name}`}
              </div>
              <div style="white-space:pre-wrap;line-height:1.4">${agEsc(m.body)}</div>
              <div style="font-size:8px;text-align:right;margin-top:4px;color:${isMe?'rgba(255,255,255,0.6)':'var(--text-muted)'}">${new Date(m.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          `;
        }).join('') : `<div style="text-align:center;color:var(--text-muted);font-size:11.5px;margin:auto">Kirim pesan pertama Anda ke ${activeAgent ? activeAgent.name : 'agen'} di bawah!</div>`}
      </div>

      <div style="display:flex;gap:6px">
        <input type="text" id="ag-chat-input" placeholder="Ketik instruksi/pertanyaan Anda..." style="flex:1;font-size:12px;padding:8px;border-radius:6px;border:1px solid var(--border)" onkeydown="if(event.key==='Enter') window.agSendChatMsg()">
        <button class="ag-btn pub" onclick="window.agSendChatMsg()" style="margin:0;padding:6px 14px;font-size:12px">Kirim</button>
      </div>
    `;
    panel.innerHTML = tabHeader + chatHtml;

    const chatContainer = document.getElementById('ag-chat-history-container');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  } else {
    let inboxHtml = `
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">📨 Pesan untuk Anda (eskalasi · standup · alert)</div>
      <div style="max-height:50vh;overflow-y:auto">
      ${agOrgMsgs.length ? agOrgMsgs.map(m=>{
        const kc = m.kind==='ESCALATION'?'#EF4444':m.kind==='ALERT'?'#F59E0B':m.kind==='STANDUP'?'#0EA5E9':'#64748B';
        return `<div style="border:1px solid var(--border);border-left:4px solid ${kc};border-radius:8px;padding:9px 12px;margin-bottom:8px;background:var(--white)">
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--gray)">
            <span><strong style="color:${kc}">${agEsc(m.kind)}</strong> · dari ${AG_ORG_ICON[m.from_agent]||''} ${agEsc(m.from_agent)}</span>
            <span>${agAgo(m.created_at)}</span>
          </div>
          <div style="font-size:12px;margin-top:4px;white-space:pre-wrap">${agMd(agEsc(m.body))}</div>
          ${m.task_id?`<button class="ag-btn mut" style="padding:3px 9px;margin-top:6px;font-size:11px"
            onclick="_agSelTask='${m.task_id}';switchAgenticTab('inbox')">${svgIcon('eye',11)} Buka task</button>`:''}
        </div>`;}).join('')
      : '<div style="font-size:12px;color:var(--gray);text-align:center;padding:20px">Belum ada pesan — HEAD akan mengirim eskalasi R3, standup harian, dan alert IT ke sini.</div>'}
      </div>
    `;
    panel.innerHTML = tabHeader + inboxHtml;
  }
};

window.renderAgOrgTab = renderAgOrgTab;

