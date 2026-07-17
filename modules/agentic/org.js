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
        ${head?`<div class="ag-detail" style="border:2px solid #0A2342;padding:10px 18px;text-align:center;min-width:230px">
          <div style="font-size:14px;font-weight:800;color:#0A2342">${AG_ORG_ICON.HEAD} ${agEsc(head.name)}</div>
          <div style="font-size:10.5px;color:var(--gray)">${agEsc(head.role_title)}</div>
          <span class="ag-badge" style="background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;margin-top:4px;display:inline-block">AKTIF · ${agEsc(head.model_tier)}</span>
        </div>`:''}
        <div style="width:2px;height:14px;background:#cbd5e1"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          ${staff.map(a=>`<div class="ag-detail" style="padding:9px 14px;text-align:center;min-width:150px;${a.active?'':'opacity:.45'}">
            <div style="font-size:12.5px;font-weight:800;color:#0A2342">${AG_ORG_ICON[a.code]||'🤖'} ${agEsc(a.name)}</div>
            <div style="font-size:10px;color:var(--gray)">${agEsc(a.role_title)}</div>
            <span class="ag-badge" style="margin-top:4px;display:inline-block;${a.active
              ?'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC':'background:#F1F5F9;color:#64748B;border:1px solid #CBD5E1'}">
              ${a.active?'AKTIF':'SEGERA'} · ${agEsc(a.model_tier)}</span>
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
            <div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:4px 0;border-bottom:1px dashed #e2e8f0">
              <span><strong>${agEsc(r.task_type)}</strong> <span style="color:var(--gray)">· ${agEsc(r.note||'')}</span></span>
              <span style="white-space:nowrap;color:var(--gray)">${r.qa_agent?`QA: ${agEsc(r.qa_agent)} ≥${r.min_score}`:'tanpa QA'}</span>
            </div>`).join('')}`).join('')}
        <div style="font-size:10.5px;color:var(--gray);margin-top:8px">
          Konten ber-review-medis SELALU R3, apa pun isi matriks. Ubah mandat = update tabel
          <code>agentic.decision_rights</code> (tanpa deploy ulang).</div>
      </div>
    </div>`;
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
