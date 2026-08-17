// ═══════════════════════════════════════════════════════════════
// AGENTIC — RAG RINGAN (Fase 1): Tanya Dokumen + Indeks
//
// Mengadopsi struktur RAG (chunk→embed→retrieve→augment→jawab+sitasi),
// direimplementasi di Supabase (pgvector) — dokumen TETAP di dalam.
// Chunk pakai sectionizer yang sudah ada (agDocSectionize). Embedding lewat
// edge function "embed" (Gemini text-embedding-004, 768d). Lihat
// AGENTIC_RAG_DESIGN.md + supabase_agentic_rag.sql.
//
// ── Pagar kejujuran ───────────────────────────────────────────
// Jawaban RAG adalah ALAT BANTU CARI, bukan otoritas. Prompt memaksa jawaban
// HANYA dari konteks + sitasi wajib; bila tak ada, katakan tidak ditemukan.
// Tetap perlu diverifikasi manusia untuk keputusan mutu/klinis.
// ═══════════════════════════════════════════════════════════════

let _agRag = { busy:false, answer:null, sources:[], status:null };

// Embedding beberapa teks lewat edge function (dibatch di pemanggil).
async function agRagEmbed(texts){
  const res = await fetch(`${SUPABASE_URL}/functions/v1/embed`, {
    method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ texts }) });
  const d = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(d.error || `embed HTTP ${res.status} — pastikan edge function "embed" ter-deploy & GEMINI_API_KEY diset`);
  return d.embeddings || [];
}

// Pecah dokumen jadi chunk: per bagian (sectionizer); bagian panjang dipotong
// ~180 kata dengan sedikit tumpang tindih agar konteks tak terputus.
function agRagChunkDoc(doc){
  const text = (doc.extracted_meta && doc.extracted_meta.full_text) || '';
  if(String(text).trim().length < 60) return [];
  const sections = (typeof agDocSectionize==='function') ? agDocSectionize(text) : { __FULL__: text };
  const out = []; let ord = 0;
  const pushChunk = (key, s) => {
    const words = String(s).trim().split(/\s+/);
    const MAX = 180, OVER = 30;
    if(words.length <= MAX){ out.push({ section_key:key, ord:ord++, content:s.trim(), token_est:Math.round(words.length*1.3) }); return; }
    for(let i=0; i<words.length; i+=(MAX-OVER)){
      const piece = words.slice(i, i+MAX).join(' ');
      out.push({ section_key:key, ord:ord++, content:piece, token_est:Math.round(Math.min(MAX,words.length-i)*1.3) });
    }
  };
  // Pakai bagian bermakna; abaikan __FULL__ bila ada bagian spesifik.
  const keys = Object.keys(sections).filter(k=>k!=='__FULL__' && String(sections[k]||'').trim());
  if(keys.length) keys.forEach(k=>pushChunk(k, sections[k]));
  else pushChunk(null, sections.__FULL__ || text);
  return out;
}

// Indeks ulang satu dokumen.
async function agRagIndexDoc(docId, onProgress){
  const d = agRegistry.find(x=>x.id===docId); if(!d) throw new Error('Dokumen tak ditemukan');
  const chunks = agRagChunkDoc(d);
  if(!chunks.length) return { chunks:0, skipped:true };
  // embed per batch 32
  for(let i=0;i<chunks.length;i+=32){
    const batch = chunks.slice(i, i+32);
    if(onProgress) onProgress(`embed ${Math.min(i+batch.length,chunks.length)}/${chunks.length}…`);
    const vecs = await agRagEmbed(batch.map(c=>c.content));
    batch.forEach((c,j)=>{ c.embedding = '['+ (vecs[j]||[]).join(',') +']'; });
  }
  const payload = chunks.filter(c=>c.embedding && c.embedding!=='[]')
    .map(c=>({ section_key:c.section_key, ord:c.ord, content:c.content, embedding:c.embedding, token_est:c.token_est }));
  const r = await agRpc('agentic_rag_index', { p_doc: docId, p_chunks: payload });
  return r || { chunks: payload.length };
}

// Indeks semua dokumen berisi (pilihan cakupan: 'published' | 'all').
async function agRagIndexAll(scope){
  const box = document.getElementById('ag-rag-idxlog');
  const put = m => { if(box) box.innerHTML = m; };
  const docs = (agRegistry||[]).filter(d =>
    d.extracted_meta && d.extracted_meta.full_text &&
    String(d.extracted_meta.full_text).trim().length >= 60 &&
    (scope==='all' || d.status==='PUBLISHED'));
  if(!docs.length){ toast(scope==='all'?'Tidak ada dokumen berisi':'Belum ada dokumen PUBLISHED berisi','warn'); return; }
  if(!confirm(`Indeks ${docs.length} dokumen (${scope==='all'?'semua':'PUBLISHED'})?\nMemakai panggilan embedding — sekali saja, hanya diulang bila isi berubah.`)) return;

  let ok=0, chunkTotal=0, gagal=0;
  for(let i=0;i<docs.length;i++){
    put(`Mengindeks ${i+1}/${docs.length}: ${agEsc(docs[i].title.slice(0,50))}…`);
    try{ const r = await agRagIndexDoc(docs[i].id, m=>put(`Mengindeks ${i+1}/${docs.length}: ${m}`)); ok++; chunkTotal += (r.chunks||0); }
    catch(e){ gagal++; }
  }
  put(`✅ Selesai — ${ok} dokumen (${chunkTotal} chunk)${gagal?`, ${gagal} gagal`:''}.`);
  if(typeof logActivity==='function') logActivity('rag_index','document_chunks','all',`Indeks RAG: ${ok} dokumen, ${chunkTotal} chunk`,'');
  await agRagLoadStatus();
}

async function agRagLoadStatus(){
  try{ _agRag.status = await agRpc('agentic_rag_status', {}); }catch(e){ _agRag.status = null; }
  const el = document.getElementById('ag-rag-status'); if(el) el.innerHTML = agRagStatusHtml();
}
function agRagStatusHtml(){
  const s = _agRag.status;
  if(!s) return `<span style="color:var(--warn-deep)">Belum aktif — jalankan supabase_agentic_rag.sql &amp; deploy edge function "embed".</span>`;
  return `Terindeks: <b>${s.docs_indexed||0}</b> dari ${s.docs_total||0} dokumen · <b>${s.chunks||0}</b> chunk`;
}

// Tanya (retrieve + augment + jawab).
async function agRagChat(){
  const q = (document.getElementById('ag-rag-q')||{}).value?.trim();
  if(!q){ toast('Tulis pertanyaan dulu','warn'); return; }
  if(_agRag.busy) return;
  _agRag.busy = true; _agRag.answer=null; _agRag.sources=[];
  const ans = document.getElementById('ag-rag-answer');
  if(ans) ans.innerHTML = `<div class="loading-row"><div class="spinner"></div></div><div style="text-align:center;font-size:11px;color:var(--gray)">mencari di dokumen…</div>`;
  try{
    const qvec = (await agRagEmbed([q]))[0];
    if(!qvec || !qvec.length) throw new Error('Embedding pertanyaan gagal');
    const rows = await agRpc('agentic_rag_search', { p_embedding:'['+qvec.join(',')+']', p_k:8 }) || [];
    if(!rows.length){ if(ans) ans.innerHTML = `<div class="status-box status-warn">Tidak ada dokumen terindeks yang relevan. Indeks dokumen dulu di atas.</div>`; _agRag.busy=false; return; }

    _agRag.sources = rows;
    const ctx = rows.map((r,i)=>`[${i+1}] (${r.doc_number||'—'} · ${r.section_key||'bagian'})\n${r.content}`).join('\n\n');
    const sys = 'Anda menjawab pertanyaan HANYA berdasarkan KONTEKS dokumen mutu yang diberikan. ' +
      'Sertakan sitasi bernomor [n] pada kalimat yang memakainya. Bila jawabannya TIDAK ADA di konteks, ' +
      'katakan "Tidak ditemukan pada dokumen terindeks" — JANGAN mengarang. Jawab ringkas dalam bahasa Indonesia.';
    const answer = await agLLMText(sys, `PERTANYAAN: ${q}\n\nKONTEKS:\n${ctx}`, 'main', { maxTokens: 1500 });
    _agRag.answer = answer;
    if(typeof logActivity==='function') logActivity('rag_ask','document_chunks','q',`Tanya dokumen: ${q.slice(0,80)}`,'');
    agRagPaintAnswer();
  }catch(e){
    if(ans) ans.innerHTML = `<div class="status-box status-warn">❌ ${agEsc(e.message)}</div>`;
  }finally{ _agRag.busy=false; }
}

function agRagPaintAnswer(){
  const ans = document.getElementById('ag-rag-answer'); if(!ans) return;
  const md = (typeof agMd==='function') ? agMd(_agRag.answer||'') : agEsc(_agRag.answer||'');
  ans.innerHTML = `
    <div style="background:var(--white);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:12.5px;line-height:1.55">${md}</div>
    ${_agRag.sources.length?`<div style="margin-top:8px">
      <div style="font-size:10.5px;font-weight:800;color:var(--gray);text-transform:uppercase;letter-spacing:.3px;margin-bottom:5px">Sumber</div>
      ${_agRag.sources.map((r,i)=>`<div style="font-size:11px;border:1px solid var(--border);border-radius:7px;padding:6px 9px;margin-bottom:5px">
        <b>[${i+1}] ${agEsc(r.doc_number||'—')}</b> ${agEsc(r.title||'')} <span style="color:var(--gray)">· ${agEsc(r.section_key||'')}</span>
        <div style="color:var(--text2);margin-top:2px;max-height:44px;overflow:hidden">${agEsc((r.content||'').slice(0,220))}…</div>
      </div>`).join('')}
    </div>`:''}
    <div style="font-size:10.5px;color:var(--gray);margin-top:6px;font-style:italic">Jawaban ini alat bantu cari, bukan otoritas — verifikasi pada dokumen sumber sebelum dipakai untuk keputusan.</div>`;
}

// Sub-tab "Tanya Dokumen" (dipanggil dari renderAgDocsTab).
function agRagRenderSection(containerId){
  const el = document.getElementById(containerId); if(!el) return;
  el.innerHTML = `
    <div class="ag-detail" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <div style="font-size:12px;font-weight:800;color:var(--navy-deep)">${icon('layers',14)} Indeks Pencarian</div>
        <div style="display:flex;gap:6px">
          <button class="ag-btn mut" style="padding:5px 11px" onclick="agRagIndexAll('published')">Indeks PUBLISHED</button>
          <button class="ag-btn mut" style="padding:5px 11px" onclick="agRagIndexAll('all')">Indeks Semua</button>
        </div>
      </div>
      <div id="ag-rag-status" style="font-size:11.5px;color:var(--gray)">${agRagStatusHtml()}</div>
      <div id="ag-rag-idxlog" style="font-size:11px;color:var(--teal);margin-top:5px"></div>
    </div>

    <div class="ag-detail">
      <div style="font-size:12px;font-weight:800;color:var(--navy-deep);margin-bottom:8px">${icon('sparkles',14)} Tanya Dokumen</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="ag-rag-q" placeholder="mis. Bagaimana prosedur penanganan hasil kritis?" style="flex:1;min-width:220px;padding:8px 10px;border:1px solid var(--border);border-radius:7px;font-size:12.5px"
          onkeydown="if(event.key==='Enter')agRagChat()">
        <button class="ag-btn pub" style="padding:8px 16px" onclick="agRagChat()">${icon('sparkles',13)} Tanya</button>
      </div>
      <div style="font-size:10.5px;color:var(--gray);margin-top:5px">Jawaban di-*grounding* ke isi dokumen terindeks, dengan sitasi. Hanya dokumen yang sudah diindeks yang dicari.</div>
      <div id="ag-rag-answer" style="margin-top:10px"></div>
    </div>`;
  agRagLoadStatus();
}

function renderAgRagTab(el) {
  el = el || document.getElementById('ag-tab-content');
  if (!el) return;

  el.innerHTML = `
    <div style="padding:20px; display:flex; flex-direction:column; gap:20px;">
      <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(56,189,248,0.3); border-radius:14px; padding:18px; backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); padding:10px; border-radius:12px; color:var(--sky);">
            🔍
          </div>
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--bg);">RAG SOP & Vector Search Engine</h3>
            <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Pencarian dokumen SOP, analisis tumpang tindih (Overlap), & grounding jawaban medis berbasis AI.</p>
          </div>
        </div>
      </div>

      <div id="ag-rag-section-container" style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px;">
      </div>
    </div>
  `;

  agRagRenderSection('ag-rag-section-container');
}

window.renderAgRagTab = renderAgRagTab;
