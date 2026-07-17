// ═══════════════════════════════════════════════════════════════
// AGENTIC — ORGANISASI (Fase 6)
// Struktur organ AI: HEAD (decision maker) → QA Mutu · QA Konten ·
// Kepala IT · (Team Ops, Logistik menyusul). Matriks Mandat R1/R2/R3.
// Anda (CEO) hanya menerima eskalasi + laporan — bukan orkestra lagi.
// ═══════════════════════════════════════════════════════════════

let agOrgAgents = [], agOrgRights = [], agOrgMsgs = [];

const AG_ORG_ICON = { HEAD:'👔', QA_KONTEN:'✍️', QA_MUTU:'🧪', IT_HEAD:'🖥️', TEAM_OPS:'📋', LOGISTIK:'🚚' };
const AG_RISK_META = {
  R1:{c:'#22C55E', l:'R1 — HEAD putuskan & terbitkan sendiri'},
  R2:{c:'#F59E0B', l:'R2 — HEAD setujui, publish oleh Anda'},
  R3:{c:'#EF4444', l:'R3 — hanya rekomendasi, keputusan Anda'},
};

async function agLoadOrg(){
  try{ agOrgAgents = await sbGet('agentic_agents_v','select=*&order=code.asc') || []; }catch(e){ agOrgAgents = []; }
  try{ agOrgRights = await sbGet('agentic_rights_v','select=*&active=eq.true&order=risk_class.asc,task_type.asc') || []; }catch(e){ agOrgRights = []; }
  try{ agOrgMsgs   = await sbGet('agentic_msgs_v','to_agent=eq.ACE&select=*&order=created_at.desc&limit=30') || []; }catch(e){ agOrgMsgs = []; }
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
  const staff = agOrgAgents.filter(a=>a.code!=='HEAD');

  el.innerHTML = `
    <div class="ag-detail" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:12px;font-weight:800;color:#0A2342">Struktur Organisasi Agent</div>
          <div style="font-size:11px;color:var(--gray)">Anda (CEO) → HEAD → staf. HEAD berdetak tiap 15 menit via cron (atau manual di sini).</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="ag-btn pub" onclick="agOrgKick('HEAD_TICK')">${svgIcon('sparkle',13)} Jalankan HEAD</button>
          <button class="ag-btn mut" onclick="agOrgKick('IT_CHECK')">${svgIcon('eye',13)} IT Check</button>
          <button class="ag-btn mut" onclick="agOrgStandup()">${svgIcon('note',13)} Minta Standup</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;align-items:center;margin-top:14px">
        <div style="background:#0A2342;color:#fff;border-radius:10px;padding:8px 22px;font-weight:800;font-size:12.5px">👑 ANDA (CEO)</div>
        <div style="width:2px;height:14px;background:#cbd5e1"></div>
        ${head?`<div class="ag-detail" style="border:2px solid #0A2342;padding:10px 18px;text-align:center;min-width:230px;position:relative">
          <button class="act-btn" title="Edit job desc" style="position:absolute;top:6px;right:6px" onclick="agOrgEditAgent('HEAD')">${svgIcon('edit',12)}</button>
          <div style="font-size:14px;font-weight:800;color:#0A2342">${AG_ORG_ICON.HEAD} ${agEsc(head.name)}</div>
          <div style="font-size:10.5px;color:var(--gray)">${agEsc(head.role_title)}</div>
          <span class="ag-badge" style="background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;margin-top:4px;display:inline-block">AKTIF · ${agEsc(head.model_tier)}</span>
        </div>`:''}
        <div style="width:2px;height:14px;background:#cbd5e1"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          ${staff.map(a=>`<div class="ag-detail" style="padding:9px 14px;text-align:center;min-width:150px;position:relative;${a.active?'':'opacity:.45'}">
            <button class="act-btn" title="Edit job desc" style="position:absolute;top:5px;right:5px" onclick="agOrgEditAgent('${a.code}')">${svgIcon('edit',11)}</button>
            <div style="font-size:12.5px;font-weight:800;color:#0A2342">${AG_ORG_ICON[a.code]||'🤖'} ${agEsc(a.name)}</div>
            <div style="font-size:10px;color:var(--gray)">${agEsc(a.role_title)}</div>
            <span class="ag-badge" style="margin-top:4px;display:inline-block;${a.active
              ?'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC':'background:#F1F5F9;color:#64748B;border:1px solid #CBD5E1'}">
              ${a.active?'AKTIF':'NONAKTIF'} · ${agEsc(a.model_tier)}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="pro-grid" style="grid-template-columns:1fr 1fr;gap:12px;align-items:start">
      <div class="ag-detail">
        <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">📨 Pesan untuk Anda (eskalasi · standup · alert)</div>
        <div style="max-height:56vh;overflow-y:auto">
        ${agOrgMsgs.length ? agOrgMsgs.map(m=>{
          const kc = m.kind==='ESCALATION'?'#EF4444':m.kind==='ALERT'?'#F59E0B':m.kind==='STANDUP'?'#0EA5E9':'#64748B';
          return `<div style="border:1px solid var(--border);border-left:4px solid ${kc};border-radius:8px;padding:9px 12px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--gray)">
              <span><strong style="color:${kc}">${agEsc(m.kind)}</strong> · dari ${AG_ORG_ICON[m.from_agent]||''} ${agEsc(m.from_agent)}</span>
              <span>${agAgo(m.created_at)}</span>
            </div>
            <div style="font-size:12px;margin-top:4px;white-space:pre-wrap">${agMd(agEsc(m.body))}</div>
            ${m.task_id?`<button class="ag-btn mut" style="padding:3px 9px;margin-top:6px;font-size:11px"
              onclick="_agSelTask='${m.task_id}';switchAgenticTab('inbox')">${svgIcon('eye',11)} Buka task</button>`:''}
          </div>`;}).join('')
        : '<div style="font-size:12px;color:var(--gray)">Belum ada pesan — HEAD akan mengirim eskalasi R3, standup harian, dan alert IT ke sini.</div>'}
        </div>
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
    </div>`;
  agRenderCronBox();
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
          <label style="font-size:11.5px;font-weight:700;color:#334155">Nama
            <input id="agoe-name" class="form-input" style="width:100%" value="${agEsc(a.name)}"></label>
          <label style="font-size:11.5px;font-weight:700;color:#334155">Jabatan
            <input id="agoe-role" class="form-input" style="width:100%" value="${agEsc(a.role_title)}"></label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:#334155">Model
            <select id="agoe-tier" class="form-input" style="width:100%">
              <option value="main" ${a.model_tier==='main'?'selected':''}>main (Nemotron — berat)</option>
              <option value="light" ${a.model_tier==='light'?'selected':''}>light (cepat & murah)</option>
            </select></label>
          <label style="font-size:11.5px;font-weight:700;color:#334155;display:flex;align-items:end;gap:6px;padding-bottom:8px">
            <input type="checkbox" id="agoe-active" ${a.active?'checked':''}> Aktif</label>
        </div>
        <label style="font-size:11.5px;font-weight:700;color:#334155">Job Description / Charter
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
        <label style="font-size:11.5px;font-weight:700;color:#334155">Aksi otomatis HEAD
          <select id="agre-action" class="form-input" style="width:100%">
            ${[['AUTO_PUBLISH','R1 — publish sendiri (butuh QA PASS)'],
               ['AUTO_PUBLISH_NOQA','R1 — publish tanpa QA (log/internal)'],
               ['AUTO_APPROVE','R2 — approve saja, publish oleh Anda'],
               ['RECOMMEND','R3 — hanya rekomendasi, keputusan Anda']]
              .map(([v,l])=>`<option value="${v}" ${r.auto_action===v?'selected':''}>${l}</option>`).join('')}
          </select></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:#334155">QA penilai
            <select id="agre-qa" class="form-input" style="width:100%">
              <option value="">(tanpa QA)</option>
              ${qaOpts.map(q=>`<option ${r.qa_agent===q?'selected':''}>${q}</option>`).join('')}
            </select></label>
          <label style="font-size:11.5px;font-weight:700;color:#334155">Skor minimal lulus
            <input id="agre-min" type="number" min="0" max="100" class="form-input" style="width:100%" value="${r.min_score}"></label>
        </div>
        <label style="font-size:11.5px;font-weight:700;color:#334155">Catatan
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
    toast(`${type==='HEAD_TICK'?'HEAD':'Kepala IT'} ditugaskan — menjalankan worker…`,'ok');
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
