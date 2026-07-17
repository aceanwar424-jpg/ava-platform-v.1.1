// ═══════════════════════════════════════════════════════════════
// MODULE: AGENTIC AI — CORE / SHELL (Fase 1 & 2)
//   agentic/inbox.js · Approval Inbox (human-in-the-loop §1.1)
//   agentic/docs.js  · Dokumen QMS: ingest, registry, compliance
//
// Data lewat RPC public.agentic_* + view agentic_*_v (PostgREST).
// Worker & LLM: Edge Function agentic-worker / llm-gateway.
// Schema: supabase_agentic.sql (Fase 0) + supabase_agentic_fase12.sql
// ═══════════════════════════════════════════════════════════════

const AG_TABS = ['inbox','org','docs','compliance','studio','monitor'];
let _agTab = 'inbox';
let agTasks = [], agRegistry = [], agChecklist = [], agLlmLogs = [];

const AG_STATUS_META = {
  QUEUED:            { c:'#64748B', l:'Antri' },
  PROCESSING:        { c:'#0EA5E9', l:'Diproses' },
  DRAFT:             { c:'#F59E0B', l:'Draft — perlu approval' },
  IN_MEDICAL_REVIEW: { c:'#8B5CF6', l:'Review Medis' },
  APPROVED:          { c:'#10B981', l:'Disetujui' },
  PUBLISHED:         { c:'#22C55E', l:'Published' },
  REJECTED:          { c:'#F97316', l:'Ditolak' },
  FAILED:            { c:'#EF4444', l:'Gagal' },
  CANCELLED:         { c:'#94A3B8', l:'Batal' },
};
const AG_DOC_STATUS = {
  DISCOVERED:'#0EA5E9', NEEDS_REPAIR:'#F59E0B', DRAFT:'#F59E0B',
  PUBLISHED:'#22C55E', DUE_FOR_REVIEW:'#F97316', OBSOLETE:'#94A3B8', MISSING:'#EF4444',
};

// ── RPC helper (PostgREST /rpc) ──────────────────────────────────
async function agRpc(fn, args){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method:'POST', headers: SB_HEADERS, body: JSON.stringify(args||{}),
  });
  let d=null; try{ d = await res.json(); }catch(e){}
  if(!res.ok) throw new Error((d&&(d.message||d.hint)) || `RPC ${fn} gagal (HTTP ${res.status})`);
  return d;
}

// Jalankan 1 tick worker (Edge Function) — pengganti cron manual
async function agRunWorker(max){
  const res = await fetch(`${SUPABASE_URL}/functions/v1/agentic-worker`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(max?{max}:{}),
  });
  let d={}; try{ d = await res.json(); }catch(e){}
  if(!res.ok) throw new Error(d.error || `agentic-worker HTTP ${res.status} — pastikan sudah di-deploy`);
  return d;
}

async function agInvokeWorkerBtn(){
  const btn = document.getElementById('ag-run-worker');
  if(btn){ btn.disabled = true; btn.textContent = 'Menjalankan…'; }
  try{
    const d = await agRunWorker(5);
    if(d.paused) toast('⏸ Worker di-pause (secret AGENTIC_PAUSED aktif)','warn');
    else if(!d.processed) toast('Antrian kosong — tidak ada task QUEUED','info');
    else toast(`✅ Worker memproses ${d.processed} task`,'ok');
  }catch(e){ toast(e.message,'err'); }
  if(btn){ btn.disabled = false; btn.innerHTML = `${svgIcon('refresh',13)} Jalankan Worker`; }
  await agReload();
}

// ── Loaders ──────────────────────────────────────────────────────
async function agLoadTasks(){
  try{ agTasks = await sbGet('agentic_tasks_v','select=*&order=updated_at.desc&limit=300') || []; }
  catch(e){ agTasks = []; }
}
async function agLoadRegistry(){
  try{ agRegistry = await sbGet('agentic_registry_v','select=*&order=updated_at.desc&limit=500') || []; }
  catch(e){ agRegistry = []; }
}
async function agLoadChecklist(){
  try{ agChecklist = await sbGet('agentic_checklist_v','select=*&order=clause_ref.asc&limit=500') || []; }
  catch(e){ agChecklist = []; }
}
async function agLoadLlm(){
  try{ agLlmLogs = await sbGet('agentic_llm_requests_v','select=*&order=created_at.desc&limit=100') || []; }
  catch(e){ agLlmLogs = []; }
}
async function agReload(){
  await Promise.all([agLoadTasks(), agLoadRegistry(), agLoadChecklist()]);
  agRenderKPI(); agRenderTab();
}

// ═══════════════════════════════════════════════════════════════
// SHELL
// ═══════════════════════════════════════════════════════════════
async function renderAgentic(tab){
  _agTab = AG_TABS.includes(tab) ? tab : 'inbox';
  if (typeof injectProShell==='function') injectProShell();
  injectAgenticStyle();
  document.getElementById('main-content').innerHTML = `
    <div class="pro-shell">
    <div class="pro-header">
      <div><h1>${svgIcon('sparkle',18)} Agentic AI</h1>
        <span class="pro-sub">Document Compliance Agent · Human-in-the-loop — tidak ada output AI yang publish tanpa approval</span></div>
      <button id="ag-run-worker" class="pro-chip" onclick="agInvokeWorkerBtn()" title="Proses antrian task sekarang (1 tick)">
        ${svgIcon('refresh',13)} Jalankan Worker</button>
    </div>

    <div id="ag-kpi" class="pro-kpi"></div>

    <div class="pro-toolbar" id="ag-tabs">
      ${[['inbox','Approval Inbox','check'],['org','Organisasi','user'],
         ['docs','Dokumen QMS','book'],
         ['compliance','Compliance','diagnosis'],['studio','Content Studio','image'],
         ['monitor','Monitor','eye']]
        .map(([k,l,ic])=>`<button class="pro-chip ${_agTab===k?'active':''}" onclick="switchAgenticTab('${k}')">${svgIcon(ic,13)} ${l}</button>`).join('')}
    </div>

    <div id="ag-body"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await Promise.all([agLoadTasks(), agLoadRegistry(), agLoadChecklist()]);
  agRenderKPI();
  agRenderTab();
}

function switchAgenticTab(t){
  _agTab = t;
  document.querySelectorAll('#ag-tabs .pro-chip').forEach((b,i)=>b.classList.toggle('active', AG_TABS[i]===t));
  agRenderTab();
}

function agRenderTab(){
  const el=document.getElementById('ag-body'); if(!el) return;
  if(_agTab==='inbox')            renderAgInboxTab(el);
  else if(_agTab==='org')         renderAgOrgTab(el);
  else if(_agTab==='docs')        renderAgDocsTab(el);
  else if(_agTab==='compliance')  renderAgComplianceTab(el);
  else if(_agTab==='studio')      renderAgStudioTab(el);
  else if(_agTab==='monitor')     renderAgMonitorTab(el);
}

function agRenderKPI(){
  const el=document.getElementById('ag-kpi'); if(!el) return;
  const n = s => agTasks.filter(t=>t.status===s).length;
  const needAction = n('DRAFT') + n('IN_MEDICAL_REVIEW') + n('APPROVED') + n('FAILED');
  el.innerHTML=[
    {v:needAction,        l:'Perlu Tindakan',  c:'#F59E0B'},
    {v:n('QUEUED'),       l:'Antri',           c:'#64748B'},
    {v:n('PROCESSING'),   l:'Diproses',        c:'#0EA5E9'},
    {v:n('PUBLISHED'),    l:'Published',       c:'#22C55E'},
    {v:agRegistry.filter(d=>d.status!=='MISSING').length, l:'Dokumen Terdaftar', c:'#0A2342'},
    {v:agRegistry.filter(d=>d.status==='MISSING').length, l:'Dokumen Kurang',    c:'#EF4444'},
  ].map(k=>`<div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${k.c};border-radius:8px;padding:8px 10px">
      <div style="font-size:18px;font-weight:800;color:${k.c}">${k.v}</div>
      <div style="font-size:10px;color:var(--gray)">${k.l}</div></div>`).join('');
}

// ── Util tampilan ────────────────────────────────────────────────
function agChip(status){
  const m = AG_STATUS_META[status] || { c:'#64748B', l:status };
  return `<span class="ag-badge" style="background:${m.c}18;color:${m.c};border:1px solid ${m.c}55">${m.l}</span>`;
}
function agDocChip(status){
  const c = AG_DOC_STATUS[status] || '#64748B';
  return `<span class="ag-badge" style="background:${c}18;color:${c};border:1px solid ${c}55">${status}</span>`;
}
function agEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function agAgo(ts){
  if(!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts).getTime())/1000);
  if(s<60) return `${s}d lalu`; if(s<3600) return `${Math.floor(s/60)}m lalu`;
  if(s<86400) return `${Math.floor(s/3600)}j lalu`; return `${Math.floor(s/86400)}h lalu`;
}
// Markdown ringan → HTML + highlight placeholder [[KONFIRMASI: ...]] (§9.3)
function agMd(md){
  let h = (typeof wikiMd==='function') ? wikiMd(md) :
    agEsc(md).replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>')
      .replace(/^# (.*)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/^\s*[-*] (.*)$/gm,'• $1');
  return h.replace(/\[\[KONFIRMASI:([^\]]*)\]\]/g,
    '<mark style="background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;border-radius:4px;padding:0 4px;font-weight:700">⚠ KONFIRMASI:$1</mark>');
}

function injectAgenticStyle(){
  if(document.getElementById('agentic-style')) return;
  const s=document.createElement('style'); s.id='agentic-style';
  s.textContent=`
    .ag-badge{ padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:700;white-space:nowrap }
    .ag-split{ display:grid;grid-template-columns:340px 1fr;gap:12px;align-items:start }
    @media(max-width:1000px){ .ag-split{ grid-template-columns:1fr } }
    .ag-list{ background:#fff;border:1px solid var(--border);border-radius:10px;overflow:hidden;max-height:70vh;overflow-y:auto }
    .ag-item{ padding:10px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:.12s }
    .ag-item:hover{ background:#f8fafc }
    .ag-item.active{ background:#EAF3FB;box-shadow:inset 3px 0 0 var(--teal) }
    .ag-detail{ background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px 16px }
    .ag-md{ font-size:13px;line-height:1.65;white-space:pre-wrap;max-height:52vh;overflow:auto;
      border:1px solid var(--border);border-radius:8px;padding:12px 14px;background:#fcfcfd }
    .ag-md h1,.ag-md h2,.ag-md h3{ margin:.6em 0 .3em;color:#0A2342;white-space:normal }
    .ag-actions{ display:flex;gap:8px;flex-wrap:wrap;margin-top:10px }
    .ag-btn{ border:none;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer;
      display:inline-flex;align-items:center;gap:6px;transition:.12s }
    .ag-btn:disabled{ opacity:.5;cursor:default }
    .ag-btn.ok{ background:#10B981;color:#fff } .ag-btn.ok:hover{ background:#059669 }
    .ag-btn.pub{ background:#0A2342;color:#fff } .ag-btn.pub:hover{ background:#0d2f5a }
    .ag-btn.warn{ background:#FEF3C7;color:#92400E;border:1px solid #F59E0B }
    .ag-btn.err{ background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5 }
    .ag-btn.mut{ background:#f1f5f9;color:#334155;border:1px solid var(--border) }
    .ag-ev{ font-size:11.5px;color:#475569;padding:5px 0;border-bottom:1px dashed #e2e8f0 }
    .ag-drop{ border:2px dashed #cbd5e1;border-radius:10px;padding:22px;text-align:center;background:#f8fafc;cursor:pointer;transition:.15s }
    .ag-drop:hover,.ag-drop.over{ border-color:var(--teal);background:#eefaf8 }
    .ag-bar{ height:8px;border-radius:6px;background:#e2e8f0;overflow:hidden }
    .ag-bar>div{ height:100%;border-radius:6px;background:linear-gradient(90deg,#0EA5E9,#22C55E) }`;
  document.head.appendChild(s);
}
