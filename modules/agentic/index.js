// ═══════════════════════════════════════════════════════════════
// MODULE: AGENTIC AI — CORE / SHELL (Fase 1 & 2)
//   agentic/inbox.js · Approval Inbox (human-in-the-loop §1.1)
//   agentic/docs.js  · Dokumen QMS: ingest, registry, compliance
//
// Data lewat RPC public.agentic_* + view agentic_*_v (PostgREST).
// Worker & LLM: Edge Function agentic-worker / llm-gateway.
// Schema: supabase_agentic.sql (Fase 0) + supabase_agentic_fase12.sql
// ═══════════════════════════════════════════════════════════════

const AG_TABS = ['inbox','org','docs','review','compliance','studio','monitor'];
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

// ── Ikon Lucide lokal (self-contained, stroke currentColor) ──────
const AG_ICONS = {
  sparkles:'<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  list:'<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  rocket:'<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  filecheck:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>',
  filetext:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  filex:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m14.5 12.5-5 5"/><path d="m9.5 12.5 5 5"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  layers:'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m6.08 9.5-3.48 1.58a1 1 0 0 0 0 1.84l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84L17.92 9.5"/><path d="m6.08 14.5-3.48 1.58a1 1 0 0 0 0 1.84l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84l-3.48-1.58"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  image:'<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  eye:'<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
};
function agIco(name, size){ const p = AG_ICONS[name]||''; size = size||16;
  return `<svg class="ag-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`; }

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
  if(btn){ btn.disabled = true; btn.classList.add('busy'); btn.innerHTML = `${agIco('refresh',15)} <span>Menjalankan…</span>`; }
  try{
    const d = await agRunWorker(5);
    if(d.paused) toast('⏸ Worker di-pause (secret AGENTIC_PAUSED aktif)','warn');
    else if(!d.processed) toast('Antrian kosong — tidak ada task QUEUED','info');
    else toast(`✅ Worker memproses ${d.processed} task`,'ok');
  }catch(e){ toast(e.message,'err'); }
  if(btn){ btn.disabled = false; btn.classList.remove('busy'); btn.innerHTML = `${agIco('refresh',15)} <span>Jalankan Worker</span>`; }
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
const AG_TAB_META = [
  ['inbox','Approval Inbox','check'],['org','Organisasi','users'],
  ['docs','Dokumen QMS','layers'],['review','Review & Pengesahan','check'],
  ['compliance','Compliance','shield'],
  ['studio','Content Studio','image'],['monitor','Monitor','eye'],
];
async function renderAgentic(tab){
  _agTab = AG_TABS.includes(tab) ? tab : 'inbox';
  if (typeof injectProShell==='function') injectProShell();
  injectAgenticStyle();
  document.getElementById('main-content').innerHTML = `
    <div class="ag-shell">
      <div class="ag-console">
        <div class="ag-hero">
          <div class="ag-hero-brand">
            <div class="ag-hero-mark">${agIco('sparkles',22)}</div>
            <div>
              <h1 class="ag-hero-title">Agentic AI <span>Hub</span></h1>
              <p class="ag-hero-sub">Document Compliance Sentinel · <span class="ag-hero-hl">Human-in-the-Loop</span> — tidak ada output AI yang terbit tanpa persetujuan manusia.</p>
            </div>
          </div>
          <button id="ag-run-worker" class="ag-hero-btn" onclick="agInvokeWorkerBtn()" title="Proses antrian task sekarang (1 tick)">
            ${agIco('refresh',15)} <span>Jalankan Worker</span></button>
        </div>

        <div id="ag-kpi" class="ag-metrics"></div>

        <div class="ag-tabbar" id="ag-tabs">
          ${AG_TAB_META.map(([k,l,ic])=>`<button class="ag-tab ${_agTab===k?'active':''}" data-tab="${k}" onclick="switchAgenticTab('${k}')">${agIco(ic,15)}<span>${l}</span></button>`).join('')}
        </div>
      </div>

      <div id="ag-body"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await Promise.all([agLoadTasks(), agLoadRegistry(), agLoadChecklist()]);
  agRenderKPI();
  agRenderTab();
}

function switchAgenticTab(t){
  _agTab = t;
  document.querySelectorAll('#ag-tabs .ag-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===t));
  agRenderTab();
}

function agRenderTab(){
  const el=document.getElementById('ag-body'); if(!el) return;
  if(_agTab==='inbox')            renderAgInboxTab(el);
  else if(_agTab==='org')         renderAgOrgTab(el);
  else if(_agTab==='docs')        renderAgDocsTab(el);
  else if(_agTab==='review')      renderAgReviewTab(el);
  else if(_agTab==='compliance')  renderAgComplianceTab(el);
  else if(_agTab==='studio')      renderAgStudioTab(el);
  else if(_agTab==='monitor')     renderAgMonitorTab(el);
}

function agRenderKPI(){
  const el=document.getElementById('ag-kpi'); if(!el) return;
  const n = s => agTasks.filter(t=>t.status===s).length;
  const needAction = n('DRAFT') + n('IN_MEDICAL_REVIEW') + n('APPROVED') + n('FAILED');
  el.innerHTML=[
    {v:needAction,     l:'Perlu Tindakan',    ic:'alert',     t:'warn'},
    {v:n('QUEUED'),    l:'Antri',             ic:'list',      t:'muted'},
    {v:n('PROCESSING'),l:'Diproses',          ic:'rocket',    t:'accent'},
    {v:n('PUBLISHED'), l:'Published',         ic:'filecheck', t:'good'},
    {v:agRegistry.filter(d=>d.status!=='MISSING').length, l:'Dokumen Terdaftar', ic:'filetext', t:'accent'},
    {v:agRegistry.filter(d=>d.status==='MISSING').length, l:'Dokumen Kurang',    ic:'filex',    t:'bad'},
  ].map(k=>`<div class="ag-metric" data-tone="${k.t}">
      <div class="ag-metric-ico">${agIco(k.ic,18)}</div>
      <div class="ag-metric-body">
        <div class="ag-metric-num">${k.v}</div>
        <div class="ag-metric-lbl">${k.l}</div>
      </div></div>`).join('');
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
  const prev = document.getElementById('agentic-style'); if(prev) prev.remove();
  const s=document.createElement('style'); s.id='agentic-style';
  s.textContent=`
    /* ═══ AGENTIC — Enterprise AI console (scoped .ag-shell) ═══ */
    .ag-shell{ --ag-teal:#14b8a6; --ag-cyan:#22d3ee; --ag-accent:linear-gradient(135deg,#14b8a6,#0ea5e9);
      --ag-line:rgba(15,23,42,.09); --ag-ink:#0f172a; --ag-mut:#64748b;
      font-feature-settings:"ss01","cv01"; letter-spacing:.1px; padding-bottom:10px; }
    .ag-shell *{ box-sizing:border-box }
    .ag-ico{ flex:0 0 auto;vertical-align:-2px }
    @keyframes ag-spin{ to{ transform:rotate(360deg) } }
    @keyframes ag-in{ from{ opacity:0;transform:translateY(6px) } to{ opacity:1;transform:none } }

    /* ── Console (dark hero region) ── */
    .ag-console{ position:relative;overflow:hidden;border-radius:20px;padding:22px 24px 16px;
      background:linear-gradient(152deg,#0b1526 0%,#0f2038 55%,#0b1626 100%);
      border:1px solid rgba(148,163,184,.16);
      box-shadow:0 24px 60px -30px rgba(3,10,25,.9),inset 0 1px 0 rgba(255,255,255,.05); }
    .ag-console::before{ content:'';position:absolute;top:-140px;right:-80px;width:420px;height:420px;
      background:radial-gradient(circle,rgba(20,184,166,.22),transparent 62%);pointer-events:none }
    .ag-console::after{ content:'';position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(circle at 90% 0%,rgba(34,211,238,.08),transparent 40%) }
    .ag-console>*{ position:relative;z-index:1 }

    /* ── Hero ── */
    .ag-hero{ display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap }
    .ag-hero-brand{ display:flex;align-items:center;gap:14px }
    .ag-hero-mark{ width:46px;height:46px;border-radius:13px;display:grid;place-items:center;color:#fff;
      background:linear-gradient(135deg,#14b8a6,#0ea5e9);
      box-shadow:0 8px 22px -6px rgba(20,184,166,.6),inset 0 1px 0 rgba(255,255,255,.4) }
    .ag-hero-title{ margin:0;font-size:19px;font-weight:800;letter-spacing:-.4px;color:#f1f6fc;line-height:1.1 }
    .ag-hero-title span{ background:linear-gradient(135deg,#2dd4bf,#38bdf8);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:800 }
    .ag-hero-sub{ margin:3px 0 0;font-size:12px;color:#93a4bd;line-height:1.5;max-width:640px }
    .ag-hero-hl{ color:#5eead4;font-weight:600 }
    .ag-hero-btn{ display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:#e8f6f3;font-size:12.5px;font-weight:700;
      padding:10px 16px;border-radius:11px;letter-spacing:.2px;
      background:rgba(20,184,166,.12);border:1px solid rgba(45,212,191,.4);transition:.16s;backdrop-filter:blur(6px) }
    .ag-hero-btn:hover{ background:rgba(20,184,166,.22);border-color:#2dd4bf;box-shadow:0 8px 20px -8px rgba(20,184,166,.6);transform:translateY(-1px) }
    .ag-hero-btn:disabled{ opacity:.7;cursor:default }
    .ag-hero-btn.busy .ag-ico{ animation:ag-spin 1s linear infinite }

    /* ── Metric grid ── */
    .ag-metrics{ display:grid;grid-template-columns:repeat(6,1fr);gap:11px;margin:18px 0 4px }
    @media(max-width:1150px){ .ag-metrics{ grid-template-columns:repeat(3,1fr) } }
    @media(max-width:640px){ .ag-metrics{ grid-template-columns:repeat(2,1fr) } }
    .ag-metric{ display:flex;align-items:center;gap:11px;padding:13px 14px;border-radius:14px;
      background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));
      border:1px solid rgba(148,163,184,.14);transition:.16s;animation:ag-in .35s ease both }
    .ag-metric:hover{ transform:translateY(-2px);border-color:rgba(45,212,191,.4);
      box-shadow:0 14px 30px -18px rgba(20,184,166,.55) }
    .ag-metric-ico{ width:38px;height:38px;flex:0 0 auto;border-radius:11px;display:grid;place-items:center;
      color:#5eead4;background:rgba(20,184,166,.12);border:1px solid rgba(45,212,191,.22) }
    .ag-metric-num{ font-size:23px;font-weight:800;line-height:1;letter-spacing:-.5px;color:#f1f6fc;font-variant-numeric:tabular-nums }
    .ag-metric-lbl{ font-size:10px;font-weight:600;color:#94a7c2;margin-top:4px;text-transform:uppercase;letter-spacing:.5px }
    .ag-metric[data-tone="warn"]  .ag-metric-ico{ color:#fbbf24;background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.28) }
    .ag-metric[data-tone="warn"]  .ag-metric-num{ color:#fcd34d }
    .ag-metric[data-tone="muted"] .ag-metric-ico{ color:#cbd5e1;background:rgba(203,213,225,.1);border-color:rgba(203,213,225,.2) }
    .ag-metric[data-tone="good"]  .ag-metric-ico{ color:#34d399;background:rgba(52,211,153,.12);border-color:rgba(52,211,153,.26) }
    .ag-metric[data-tone="good"]  .ag-metric-num{ color:#6ee7b7 }
    .ag-metric[data-tone="bad"]   .ag-metric-ico{ color:#f87171;background:rgba(248,113,113,.12);border-color:rgba(248,113,113,.28) }
    .ag-metric[data-tone="bad"]   .ag-metric-num{ color:#fca5a5 }
    .ag-metric[data-tone="accent"] .ag-metric-num{ color:#7dd3fc }

    /* ── Tab bar ── */
    .ag-tabbar{ display:flex;gap:7px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.12) }
    .ag-tab{ display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-size:12.5px;font-weight:600;letter-spacing:.2px;
      padding:8px 14px;border-radius:10px;color:#93a4bd;background:rgba(255,255,255,.03);
      border:1px solid rgba(148,163,184,.12);transition:.15s }
    .ag-tab:hover{ color:#dbe6f3;background:rgba(255,255,255,.07);border-color:rgba(148,163,184,.24) }
    .ag-tab .ag-ico{ opacity:.85 }
    .ag-tab.active{ color:#fff;background:linear-gradient(135deg,#14b8a6,#0ea5e9);border-color:transparent;font-weight:700;
      box-shadow:0 8px 20px -8px rgba(14,165,233,.7),inset 0 1px 0 rgba(255,255,255,.25) }
    .ag-tab.active .ag-ico{ opacity:1 }

    /* ── Content body ── */
    #ag-body{ margin-top:16px;animation:ag-in .3s ease both }
    .ag-badge{ padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:700;white-space:nowrap;letter-spacing:.2px }
    .ag-split{ display:grid;grid-template-columns:360px 1fr;gap:14px;align-items:start }
    @media(max-width:1000px){ .ag-split{ grid-template-columns:1fr } }
    .ag-list{ background:#fff;border:1px solid var(--ag-line);border-radius:14px;overflow:hidden;max-height:70vh;overflow-y:auto;
      box-shadow:0 1px 2px rgba(15,23,42,.04) }
    .ag-item{ padding:11px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:.12s }
    .ag-item:hover{ background:#f6fafb }
    .ag-item.active{ background:#effcfa;box-shadow:inset 3px 0 0 var(--ag-teal) }
    .ag-detail{ background:#fff;border:1px solid var(--ag-line);border-radius:16px;padding:16px 18px;
      box-shadow:0 1px 2px rgba(15,23,42,.04),0 12px 28px -22px rgba(15,23,42,.25) }
    .ag-md{ font-size:13px;line-height:1.7;white-space:pre-wrap;max-height:52vh;overflow:auto;
      border:1px solid var(--ag-line);border-radius:12px;padding:14px 16px;background:#fbfcfe }
    .ag-md h1,.ag-md h2,.ag-md h3{ margin:.7em 0 .35em;color:#0f172a;white-space:normal;letter-spacing:-.2px }
    .ag-actions{ display:flex;gap:8px;flex-wrap:wrap;margin-top:12px }
    .ag-btn{ border:1px solid transparent;border-radius:10px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;letter-spacing:.2px;
      display:inline-flex;align-items:center;gap:6px;transition:.14s;line-height:1 }
    .ag-btn:hover{ transform:translateY(-1px) }
    .ag-btn:disabled{ opacity:.5;cursor:default;transform:none }
    .ag-btn.ok{ background:#10B981;color:#fff } .ag-btn.ok:hover{ background:#059669;box-shadow:0 8px 18px -8px rgba(16,185,129,.6) }
    .ag-btn.pub{ background:linear-gradient(135deg,#0f766e,#0ea5e9);color:#fff } .ag-btn.pub:hover{ box-shadow:0 8px 20px -8px rgba(14,165,233,.65) }
    .ag-btn.warn{ background:#FEF7E6;color:#92400E;border-color:#FBD38D }
    .ag-btn.err{ background:#FEECEC;color:#B91C1C;border-color:#FCA5A5 }
    .ag-btn.mut{ background:#f1f5f9;color:#334155;border-color:var(--ag-line) } .ag-btn.mut:hover{ background:#e9eef4 }
    .ag-ev{ font-size:11.5px;color:#475569;padding:5px 0;border-bottom:1px dashed #e2e8f0 }
    .ag-drop{ border:1.5px dashed #cbd5e1;border-radius:14px;padding:26px;text-align:center;background:#f8fafc;cursor:pointer;transition:.15s }
    .ag-drop:hover,.ag-drop.over{ border-color:var(--ag-teal);background:#effcfa;box-shadow:inset 0 0 0 3px rgba(20,184,166,.06) }
    .ag-bar{ height:8px;border-radius:999px;background:#e8edf3;overflow:hidden }
    .ag-bar>div{ height:100%;border-radius:999px;background:linear-gradient(90deg,#14b8a6,#0ea5e9) }

    /* Tabel dalam Agentic — lebih premium */
    .ag-shell .pro-table thead th{ text-transform:uppercase;letter-spacing:.4px;font-size:10px;color:#64748b;font-weight:700;
      background:#f8fafc;border-bottom:1px solid var(--ag-line) }
    .ag-shell .pro-table td{ border-bottom:1px solid #f1f5f9 }
    .ag-shell .pro-table tbody tr{ transition:.12s } .ag-shell .pro-table tbody tr:hover{ background:#f8fafc }
    /* Judul seksi di dalam kartu konten */
    .ag-shell .ag-detail>div:first-child{ letter-spacing:-.1px }`;
  document.head.appendChild(s);
}
