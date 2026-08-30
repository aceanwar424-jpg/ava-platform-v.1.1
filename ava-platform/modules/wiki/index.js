// ═══════════════════════════════════════════════════════════════
// MODULE: WIKI AVA — CORE / SHELL
// Pusat pengetahuan & produksi konten:
//   wiki/sop.js     · Dokumen SOP (upload, versi, template acuan)
//   wiki/fix.js     · Perbaikan SOP berbasis AI (reengineering)
//   wiki/studio.js  · Content Studio + Media/Gambar (AI)
//
// AI lewat Supabase Edge Function "gemini-proxy" — API key TIDAK pernah
// ada di browser. File disimpan di Storage bucket "wiki".
// Schema: supabase_wiki.sql
// ═══════════════════════════════════════════════════════════════

// Tab 'fix' (Perbaikan SOP) & 'content' (Content Studio) DIBUANG — keduanya sudah
// digantikan modul Agentic (Dokumen QMS / Content Studio) dan sudah lama tak
// tercantum di menu Wiki. Menyisakannya hanya membuat dua pintu untuk hal sama.
const WIKI_TABS = ['docs','media'];
let wikiDocs = [], wikiContents = [], wikiMedia = [];
let _wikiTab = 'docs';

const WIKI_DOC_TYPES  = ['SOP','Kebijakan','Instruksi Kerja','Form','Panduan','Template'];
const WIKI_CATEGORIES = ['Laboratorium','Layanan Klinik','Home Care','HRD','Finance','Marketing','Mutu & Akreditasi','K3','IT','Lainnya'];
const WIKI_STATUS     = { Draft:'#F59E0B', Review:'#8B5CF6', Approved:'#22C55E', Obsolete:'#94A3B8' };

function wikiUser(){ return (typeof getUserName==='function') ? getUserName() : 'User'; }

// ── Klien AI (Edge Function) ─────────────────────────────────────
async function wikiAI(payload){
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(payload),
  });
  let data={}; try{ data = await res.json(); }catch(e){}
  if(!res.ok) throw new Error(data.error || `AI error (HTTP ${res.status})`);
  return data;
}
async function wikiAskText(prompt, opts){ const d = await wikiAI(Object.assign({mode:'text', prompt}, opts||{})); return d.text||''; }
// Gambar: 100% NVIDIA via llm-gateway (rantai semua model text-to-image).
// Kebijakan: Gemini KHUSUS teks — tidak ada fallback gemini utk gambar.
async function wikiGenImage(prompt, opts){
  const res = await fetch(`${SUPABASE_URL}/functions/v1/llm-gateway`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(Object.assign({mode:'image', prompt}, opts||{})),
  });
  const d = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(d.error || `Gagal generate gambar (HTTP ${res.status})`);
  return d.images||[];
}

// ── Storage helper ───────────────────────────────────────────────
function wikiToken(){ try{ return (typeof getStoredToken==='function' && getStoredToken()) || SUPABASE_KEY; }catch(e){ return SUPABASE_KEY; } }
async function wikiUploadFile(file, folder){
  const safe = (file.name||'file').replace(/[^\w.\-]+/g,'_').slice(-80);
  const path = `${folder||'docs'}/${Date.now()}_${safe}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/wiki/${path}`, {
    method:'POST',
    headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${wikiToken()}`, 'Content-Type': file.type||'application/octet-stream' },
    body:file,
  });
  if(!res.ok){ const t=await res.text().catch(()=>''); throw new Error(`Upload gagal: ${t||res.status}. Pastikan bucket "wiki" sudah dibuat (jalankan supabase_wiki.sql).`); }
  return { path, url:`${SUPABASE_URL}/storage/v1/object/public/wiki/${path}` };
}
async function wikiUploadDataUri(dataUri, folder, name){
  const [meta, b64] = String(dataUri).split(',');
  const mime = (meta.match(/data:([^;]+)/)||[])[1] || 'image/png';
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return wikiUploadFile(new File([arr], name||`img_${Date.now()}.png`, {type:mime}), folder||'media');
}
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result).split(',')[1]);
    r.onerror=reject; r.readAsDataURL(file);
  });
}
function wikiBytes(n){ if(!n) return '—'; const u=['B','KB','MB','GB']; let i=0,v=n; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(i?1:0)} ${u[i]}`; }

// ── Loaders ──────────────────────────────────────────────────────
async function loadWikiDocs(){
  try{ wikiDocs = await sbGet('wiki_documents','select=*&order=created_at.desc&limit=300') || []; }
  catch(e){ wikiDocs = []; }
}
async function loadWikiContents(){
  try{ wikiContents = await sbGet('wiki_contents','select=*&order=created_at.desc&limit=200') || []; }
  catch(e){ wikiContents = []; }
}
async function loadWikiMedia(){
  try{ wikiMedia = await sbGet('wiki_media','select=*&order=created_at.desc&limit=100') || []; }
  catch(e){ wikiMedia = []; }
}

// ═══════════════════════════════════════════════════════════════
// SHELL
// ═══════════════════════════════════════════════════════════════
async function renderWiki(tab){
  _wikiTab = WIKI_TABS.includes(tab) ? tab : 'docs';
  if (typeof injectProShell==='function') injectProShell();
  injectWikiStyle();
  document.getElementById('main-content').innerHTML = `
    <div class="pro-shell">
    <div class="pro-header">
      <div><h1>${svgIcon('book',18)} Wiki AVA</h1>
        <span class="pro-sub">Dokumen &amp; SOP · Perbaikan SOP (AI) · Content Studio · Media</span></div>
      <span class="pro-sub" id="wiki-ai-state">AI: teks Gemini/NVIDIA · gambar 100% NVIDIA</span>
    </div>

    <div id="wiki-kpi" class="pro-kpi"></div>

    <div class="pro-toolbar" id="wiki-tabs">
      ${[['docs','Dokumen SOP','note'],['media','Media & Gambar','image']]
        .map(([k,l,ic])=>`<button class="pro-chip ${_wikiTab===k?'active':''}" onclick="switchWikiTab('${k}')">${svgIcon(ic,13)} ${l}</button>`).join('')}
    </div>

    <div id="wiki-body"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await Promise.all([loadWikiDocs(), loadWikiContents(), loadWikiMedia()]);
  renderWikiKPI();
  renderWikiTab();
}

function switchWikiTab(t){
  _wikiTab = t;
  document.querySelectorAll('#wiki-tabs .pro-chip').forEach((b,i)=>b.classList.toggle('active', WIKI_TABS[i]===t));
  renderWikiTab();
}

function renderWikiTab(){
  const el=document.getElementById('wiki-body'); if(!el) return;
  if(_wikiTab==='docs'){        renderWikiDocsTab(el); wikiPrependOfficialDocs(el); }
  else if(_wikiTab==='media')   renderWikiMediaTab(el);
}

// ── Penataan: Wiki = perpustakaan manual · produksi AI pindah ke Agentic ──
// Tab AI lama tetap bisa dipakai (di bawah banner), tapi jalur utama kini
// modul Agentic (ada approval + audit trail + nomor dokumen resmi).
function wikiTabWithBanner(el, kind, legacyRenderer){
  const isFix = kind==='fix';
  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#0A2342,#13856B);border-radius:10px;padding:14px 16px;margin-bottom:12px;color:var(--on-accent);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-weight:800;font-size:13.5px">✨ ${isFix?'Perbaikan SOP':'Produksi konten'} kini ditangani Agentic AI</div>
        <div style="font-size:11.5px;opacity:.85;margin-top:3px">
          ${isFix
            ? 'Document Compliance Agent: perbaikan + generate dokumen ISO 15189, lewat approval, dapat nomor resmi & riwayat revisi.'
            : 'Content & Branding Agent: kalender konten + planner mingguan + copy & gambar, semua lewat Approval Inbox.'}</div>
      </div>
      <button class="btn btn-sm" style="background:var(--white);color:var(--navy-deep);font-weight:800;border:none"
        onclick="navigate('agentic',{tab:'${isFix?'docs':'studio'}'})">Buka Agentic AI →</button>
    </div>
    <details style="margin-bottom:10px">
      <summary style="cursor:pointer;font-size:12px;color:var(--gray)">Pakai mode lama (tanpa approval) — klik untuk membuka</summary>
      <div id="wiki-legacy-${kind}" style="margin-top:10px"></div>
    </details>`;
  const legacy = el.querySelector(`#wiki-legacy-${kind}`);
  const det = el.querySelector('details');
  let rendered = false;
  det.addEventListener('toggle', ()=>{ if(det.open && !rendered){ rendered = true; legacyRenderer(legacy); } });
}

// Seksi "Dokumen Resmi" — hasil publish Agentic (registry) tampil di perpustakaan
async function wikiPrependOfficialDocs(el){
  let rows = [];
  try{ rows = await sbGet('agentic_registry_v',
    'status=eq.PUBLISHED&select=id,doc_number,title,doc_type,department,current_revision,effective_date,next_review_date,extracted_meta&order=doc_number.asc&limit=200') || []; }
  catch(e){ return; }
  if(!rows.length) return;
  const box = document.createElement('div');
  box.innerHTML = `
    <div class="wiki-card" style="margin-bottom:12px;border-left:4px solid var(--success-strong)">
      <div class="wiki-sec" style="margin-bottom:8px">📌 Dokumen Resmi — diterbitkan via Agentic AI (${rows.length})</div>
      <div style="overflow-x:auto"><table class="pro-grid" style="width:100%;font-size:11.5px">
        <thead><tr><th>No. Dokumen</th><th>Judul</th><th>Jenis</th><th>Dept</th><th>Rev</th><th>Berlaku</th><th>Review</th><th></th></tr></thead>
        <tbody>${rows.map(d=>`<tr>
          <td style="font-family:monospace;white-space:nowrap">${d.doc_number||'—'}</td>
          <td style="font-weight:700;color:var(--navy)">${(d.title||'').replace(/</g,'&lt;')}</td>
          <td>${d.doc_type||''}</td><td>${d.department||''}</td>
          <td>v${d.current_revision||1}</td>
          <td style="white-space:nowrap">${d.effective_date||'—'}</td>
          <td style="white-space:nowrap">${d.next_review_date||'—'}</td>
          <td>${(d.extracted_meta&&d.extracted_meta.full_text)?
            `<button class="act-btn" title="Unduh .docx" onclick="wikiDlOfficial('${d.id}')">${svgIcon('download',14)}</button>`:''}</td>
        </tr>`).join('')}</tbody></table></div>
    </div>`;
  el.prepend(box);
  window._wikiOfficialDocs = rows;
}
function wikiDlOfficial(id){
  const d = (window._wikiOfficialDocs||[]).find(x=>x.id===id);
  if(!d || !(d.extracted_meta&&d.extracted_meta.full_text)){ toast('Konten tidak tersedia','warn'); return; }
  if(typeof agDownloadDocx==='function')
    agDownloadDocx(d.extracted_meta.full_text, `${d.doc_number||d.title}`, `${d.doc_number?d.doc_number+' — ':''}${d.title}`);
  else wikiDownload(d.extracted_meta.full_text, `${d.doc_number||d.title}.md`);
}

function renderWikiKPI(){
  const el=document.getElementById('wiki-kpi'); if(!el) return;
  const appr = wikiDocs.filter(d=>d.status==='Approved').length;
  const tpl  = wikiDocs.filter(d=>d.is_template).length;
  const due  = wikiDocs.filter(d=>d.review_date && new Date(d.review_date) <= new Date()).length;
  el.innerHTML=[
    {v:wikiDocs.length,      l:'Total Dokumen',  c:'#0A2342'},
    {v:appr,                 l:'Approved',       c:'#22C55E'},
    {v:tpl,                  l:'Template Acuan', c:'#8B5CF6'},
    {v:due,                  l:'Perlu Review',   c:'#EF4444'},
    {v:wikiContents.length,  l:'Konten',         c:'#0EA5E9'},
    {v:wikiMedia.length,     l:'Media',          c:'#F59E0B'},
  ].map(k=>`<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid ${k.c};border-radius:8px;padding:8px 10px">
      <div style="font-size:18px;font-weight:800;color:${k.c}">${k.v}</div>
      <div style="font-size:10px;color:var(--gray)">${k.l}</div></div>`).join('');
}

function injectWikiStyle(){
  if(document.getElementById('wiki-style')) return;
  const s=document.createElement('style'); s.id='wiki-style';
  s.textContent=`
    .wiki-drop{ border:2px dashed var(--border2);border-radius:10px;padding:20px;text-align:center;background:var(--bg);cursor:pointer;transition:.15s }
    .wiki-drop:hover,.wiki-drop.over{ border-color:var(--teal);background:#eefaf8 }
    .wiki-out{ background:var(--white);border:1px solid var(--border);border-radius:10px;padding:14px 16px;
      font-size:13px;line-height:1.65;white-space:pre-wrap;max-height:460px;overflow:auto }
    .wiki-out h1,.wiki-out h2,.wiki-out h3{ margin:.6em 0 .3em;color:var(--navy-deep) }
    .wiki-card{ background:var(--white);border:1px solid var(--border);border-radius:10px;padding:14px }
    .wiki-sec{ font-size:11px;font-weight:800;color:var(--navy-deep);text-transform:uppercase;letter-spacing:.05em;
      background:#EAF3FB;border-left:3px solid var(--teal);padding:6px 10px;border-radius:4px;margin:0 0 10px }
    .wiki-badge{ padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:700;white-space:nowrap }
    .wiki-thumb{ width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid var(--border);background:var(--bg2) }`;
  document.head.appendChild(s);
}

// Render markdown ringan → HTML (untuk preview hasil AI)
function wikiMd(md){
  let h=(md||'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  h=h.replace(/^### (.*)$/gm,'<h3>$1</h3>')
     .replace(/^## (.*)$/gm,'<h2>$1</h2>')
     .replace(/^# (.*)$/gm,'<h1>$1</h1>')
     .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
     .replace(/^\s*[-*] (.*)$/gm,'• $1');
  return h;
}
function wikiDownload(text, name, mime){
  const blob=new Blob([text],{type:mime||'text/markdown;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name||'dokumen.md'; a.click();
}
function wikiCopy(text){ navigator.clipboard?.writeText(text).then(()=>toast('📋 Disalin','ok')).catch(()=>toast('Gagal menyalin','err')); }
