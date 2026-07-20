// ═══════════════════════════════════════════════════════════════
// AGENTIC — DOKUMEN QMS (Fase 2 · spec §5.1)
// Upload → ekstrak teks (DOCX/TXT/MD di browser; PDF via Storage+Gemini)
// → task DOC_INGEST → registry → gap analysis → repair/generate.
// ═══════════════════════════════════════════════════════════════

let _agUploadBusy = false;

// ── Ekstraksi teks DOCX murni di browser ─────────────────────────
// DOCX = arsip ZIP; ambil word/document.xml lalu buang tag XML.
// Zip reader minimal: scan EOCD → central directory → entry → inflate
// via DecompressionStream('deflate-raw') (Chrome 103+/Edge/Firefox 113+).
async function agDocxText(file){
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  // 1) End of Central Directory (sig 0x06054b50), scan dari belakang
  let eocd = -1;
  for(let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--){
    if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error('Bukan file DOCX/ZIP valid');
  const cdCount  = dv.getUint16(eocd + 10, true);
  let cdOfs      = dv.getUint32(eocd + 16, true);
  // 2) Telusuri central directory, cari word/document.xml
  let target = null;
  for(let n = 0; n < cdCount; n++){
    if(dv.getUint32(cdOfs, true) !== 0x02014b50) break;
    const method   = dv.getUint16(cdOfs + 10, true);
    const compSize = dv.getUint32(cdOfs + 20, true);
    const nameLen  = dv.getUint16(cdOfs + 28, true);
    const extraLen = dv.getUint16(cdOfs + 30, true);
    const cmtLen   = dv.getUint16(cdOfs + 32, true);
    const lhOfs    = dv.getUint32(cdOfs + 42, true);
    const name     = new TextDecoder().decode(buf.subarray(cdOfs + 46, cdOfs + 46 + nameLen));
    if(name === 'word/document.xml'){ target = { method, compSize, lhOfs }; break; }
    cdOfs += 46 + nameLen + extraLen + cmtLen;
  }
  if(!target) throw new Error('word/document.xml tidak ditemukan (bukan DOCX?)');
  // 3) Local header → posisi data terkompresi
  const lh = target.lhOfs;
  if(dv.getUint32(lh, true) !== 0x04034b50) throw new Error('Local header ZIP rusak');
  const lhName  = dv.getUint16(lh + 26, true);
  const lhExtra = dv.getUint16(lh + 28, true);
  const dataStart = lh + 30 + lhName + lhExtra;
  const raw = buf.subarray(dataStart, dataStart + target.compSize);
  // 4) Inflate (method 8) / stored (method 0)
  let xmlBytes;
  if(target.method === 8){
    if(typeof DecompressionStream === 'undefined')
      throw new Error('Browser tidak mendukung DecompressionStream — gunakan Chrome/Edge terbaru, atau konversi ke PDF');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([raw]).stream().pipeThrough(ds);
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else if(target.method === 0){
    xmlBytes = raw;
  } else throw new Error(`Metode kompresi ZIP ${target.method} tidak didukung`);
  // 5) XML → teks polos
  const xml = new TextDecoder().decode(xmlBytes);
  return xml
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'")
    .replace(/&#(\d+);/g, (m,n)=>String.fromCharCode(parseInt(n,10)))
    .replace(/\n{3,}/g,'\n\n').trim();
}

// Upload file mentah ke Storage bucket "agentic" (untuk PDF / arsip sumber)
async function agUploadStorage(file){
  const safe = (file.name||'file').replace(/[^\w.\-]+/g,'_').slice(-80);
  const path = `uploads/${Date.now()}_${safe}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/agentic/${path}`, {
    method:'POST',
    headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type||'application/octet-stream' },
    body:file,
  });
  if(!res.ok){ const t=await res.text().catch(()=>''); throw new Error(`Upload gagal: ${t||res.status}. Pastikan supabase_agentic_fase12.sql sudah dijalankan (bucket "agentic").`); }
  return path;
}

// ── TAB DOKUMEN QMS ──────────────────────────────────────────────
function renderAgDocsTab(el){
  const docs = agRegistry.filter(d=>d.status!=='MISSING');
  const missing = agRegistry.filter(d=>d.status==='MISSING');

  el.innerHTML = `
    <div class="ag-detail" style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">${svgIcon('upload',14)} Ingest Dokumen (DOCX / PDF / TXT / MD)</div>
      <div class="ag-drop" id="ag-drop" onclick="document.getElementById('ag-file-input').click()">
        <div style="font-size:13px;font-weight:700;color:#334155">Klik atau tarik file ke sini</div>
        <div style="font-size:11px;color:var(--gray);margin-top:4px">
          DOCX/TXT/MD diekstrak di browser · PDF dibaca AI dari Storage · metadata otomatis oleh LLM</div>
      </div>
      <input type="file" id="ag-file-input" multiple accept=".docx,.pdf,.txt,.md" style="display:none" onchange="agIngestFiles(this.files)">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#334155;margin-top:8px">
        <input type="checkbox" id="ag-auto-gap" checked> Jalankan gap analysis ISO 15189 otomatis setelah semua file ter-ingest
      </label>
      <div id="ag-ingest-log" style="font-size:12px;margin-top:6px"></div>
    </div>

    <div class="ag-detail" style="margin-bottom:12px" id="ag-templates-box">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">📐 Template Dokumen Resmi (fidelity 100%)</div>
      <div class="loading-row"><div class="spinner"></div></div>
    </div>

    ${missing.length ? `
    <div class="ag-detail" style="margin-bottom:12px;border-left:4px solid #EF4444">
      <div style="font-size:12px;font-weight:800;color:#B91C1C;margin-bottom:6px">Dokumen Wajib yang Belum Ada (${missing.length})</div>
      ${missing.slice(0,10).map(d=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px dashed #fecaca">
        ${agDocChip(d.status)} ${agEsc(d.title)} <span style="color:var(--gray)">· ${agEsc(d.iso_clause||'')}</span></div>`).join('')}
      ${missing.length>10?`<div style="font-size:11px;color:var(--gray);margin-top:4px">+${missing.length-10} lainnya — lihat tab Compliance</div>`:''}
    </div>` : ''}

    <div class="ag-detail">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
        <div style="font-size:12px;font-weight:800;color:#0A2342">${svgIcon('book',14)} Registry Dokumen (${docs.length})</div>
        <button class="ag-btn mut" style="padding:5px 11px" title="Unduh daftar master SOP terbit (CSV)" onclick="agExportMasterSOP()">⬇️ Daftar Master SOP</button>
      </div>
      <div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:12px">
        <thead><tr><th>No. Dokumen</th><th>Judul</th><th>Jenis</th><th>Dept</th><th>Status</th><th>Rev</th><th>Review Berikut</th><th></th></tr></thead>
        <tbody>${docs.map(d=>`<tr>
          <td style="white-space:nowrap">${agEsc(d.doc_number||'—')}
            <button class="ag-btn mut" style="padding:1px 6px;font-size:10px;margin-left:4px" title="Tetapkan/ubah nomor dokumen" onclick="agEditDocNumber('${d.id}')">✎</button></td>
          <td>${agEsc(d.title)}</td>
          <td>${agEsc(d.doc_type)} L${d.doc_level}</td>
          <td>${agEsc(d.department)}</td>
          <td>${agDocChip(d.status)}</td>
          <td>${d.current_revision||0}</td>
          <td>${d.next_review_date||'—'}</td>
          <td style="white-space:nowrap">
            ${d.status!=='PUBLISHED' && (d.extracted_meta&&d.extracted_meta.full_text) ?
              `<button class="ag-btn mut" style="padding:4px 9px" title="Buat task perbaikan AI" onclick="agMakeRepairTask('${d.id}')">${svgIcon('sparkle',12)} Repair</button>` : ''}
            ${(d.extracted_meta&&d.extracted_meta.full_text) ?
              `<button class="ag-btn mut" style="padding:4px 9px" title="Rakit .docx final dari template master" onclick="agBuildDocFromTemplate('${d.id}')">🧩 .docx</button>` : ''}
            ${(d.extracted_meta&&d.extracted_meta.full_text) ?
              `<button class="ag-btn mut" style="padding:4px 9px" title="Tinjau isi yang dipetakan ke template sebelum dokumen final dibuat" onclick="agOpenFinalReview('${d.id}')">📄 Review Final</button>` : ''}
            <button class="ag-btn mut" style="padding:4px 9px" title="Tanda tangan elektronik & riwayat pengesahan" onclick="agOpenSignModal('${d.id}')">✍️ TTD</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:16px">Belum ada dokumen — upload di atas untuk memulai.</td></tr>'}</tbody>
      </table></div>
    </div>`;

  // drag & drop
  const drop = document.getElementById('ag-drop');
  if(drop){
    ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
    ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
    drop.addEventListener('drop', e=>agIngestFiles(e.dataTransfer.files));
  }
  // Panel template dokumen (fungsi global dari org.js) — tempat unggah master .docx
  if(typeof agRenderTemplates==='function') agRenderTemplates();
}

// Proses banyak file → buat task DOC_INGEST per file (file terakhir bawa enqueue_gap)
async function agIngestFiles(fileList){
  const files = Array.from(fileList||[]).filter(f=>/\.(docx|pdf|txt|md)$/i.test(f.name));
  if(!files.length){ toast('Pilih file .docx / .pdf / .txt / .md','warn'); return; }
  if(_agUploadBusy){ toast('Masih memproses batch sebelumnya…','warn'); return; }
  _agUploadBusy = true;
  const log = document.getElementById('ag-ingest-log');
  const autoGap = !!(document.getElementById('ag-auto-gap')||{}).checked;
  const put = (m,c)=>{ if(log) log.innerHTML += `<div style="color:${c||'#334155'}">${m}</div>`; };

  let created = 0;
  for(let i=0;i<files.length;i++){
    const f = files[i]; const last = i===files.length-1;
    try{
      let payload = { file_name: f.name, enqueue_gap: autoGap && last };
      if(/\.docx$/i.test(f.name)){
        put(`⏳ ${agEsc(f.name)} — ekstraksi teks…`);
        payload.text = await agDocxText(f);
        payload.storage_path = await agUploadStorage(f); // arsip sumber
      } else if(/\.(txt|md)$/i.test(f.name)){
        payload.text = await f.text();
        payload.storage_path = await agUploadStorage(f);
      } else { // pdf → AI baca dari storage
        put(`⏳ ${agEsc(f.name)} — upload ke Storage…`);
        payload.storage_path = await agUploadStorage(f);
      }
      await agRpc('agentic_create_task', {
        p_agent:'DOCUMENT', p_task_type:'DOC_INGEST',
        p_title:`Ingest: ${f.name}`, p_payload: payload,
      });
      created++;
      put(`✅ ${agEsc(f.name)} — task ingest dibuat`, '#15803D');
    }catch(e){
      put(`❌ ${agEsc(f.name)} — ${agEsc(e.message)}`, '#B91C1C');
    }
  }
  _agUploadBusy = false;
  if(created){
    toast(`${created} task ingest dibuat — menjalankan worker…`,'ok');
    // Worker memproses maksimal N task per panggilan. Untuk unggahan banyak
    // berkas sekaligus, panggil berulang sampai antrian habis — kalau tidak,
    // sisa berkas menggantung dan pengguna harus menekan "Jalankan Worker"
    // berkali-kali tanpa tahu berapa kali. Dibatasi 20 putaran agar tidak
    // berputar tanpa akhir bila ada task yang selalu gagal.
    try{
      for(let putaran=0; putaran<20; putaran++){
        const d = await agRunWorker(5);
        const diproses = (d && d.processed) || 0;
        put(`⚙️ worker: ${diproses} task diproses`);
        if(diproses < 5) break;            // antrian sudah habis
      }
    }catch(e){ toast(e.message,'err'); }
    await agReload();
  }
}

// Buat task DOC_REPAIR manual dari registry
async function agMakeRepairTask(docId){
  const d = agRegistry.find(x=>x.id===docId); if(!d) return;
  try{
    await agRpc('agentic_create_task', {
      p_agent:'DOCUMENT', p_task_type:'DOC_REPAIR',
      p_title:`Perbaiki: ${d.title}`,
      p_payload:{ document_id:d.id, mode:'format_fix', prompt_code:'DOC_REPAIR_SOP' },
    });
    toast('Task repair dibuat — jalankan worker untuk memproses','ok');
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}

// ── Fase 7D bridge: isi hasil AI → placeholder → .docx final (fidelity 100%) ──
async function agLLMText(system, prompt, tier){
  const res = await fetch(`${SUPABASE_URL}/functions/v1/llm-gateway`, {
    method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ system, prompt, tier:tier||'main', temperature:0.2, maxTokens:2500 }) });
  const d = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(d.error || `llm-gateway HTTP ${res.status}`);
  return String(d.text||'');
}
async function agBuildDocFromTemplate(docId){
  const d = agRegistry.find(x=>x.id===docId); if(!d){ toast('Dokumen tak ditemukan','err'); return; }
  const content = d.extracted_meta && d.extracted_meta.full_text;
  if(!content){ toast('Dokumen belum punya isi — generate/repair dulu','warn'); return; }
  if(typeof agDocxFill!=='function' || typeof agDownloadStorage!=='function'){ toast('Modul docxfill/org belum dimuat — reload','err'); return; }
  try{
    toast('Ambil template & rakit .docx…','info');
    const tpl = await agRpc('agentic_template_get', { p_level:d.doc_level, p_type:d.doc_type, p_dept:d.department });
    if(!tpl || !tpl.storage_path){ toast(`Belum ada master .docx untuk ${d.doc_type} L${d.doc_level}/${d.department} — unggah di tab Organisasi → Template`,'warn'); return; }
    const buf = await agDownloadStorage(tpl.storage_path);
    let phs = Array.isArray(tpl.placeholders)?tpl.placeholders.slice():[];
    try{ const scan = await agDocxScanPlaceholders(buf); scan.forEach(k=>{ if(!phs.includes(k)) phs.push(k); }); }catch(e){}
    if(!phs.length){ toast('Master tidak punya {{placeholder}} — tak ada yang diisi','warn'); return; }
    // Map isi dokumen → nilai per placeholder via LLM
    const sys = 'Anda mengisi template dokumen resmi. Balas HANYA JSON objek {placeholder: nilai}. Untuk tiap placeholder pada DAFTAR, ambil/ringkas nilai yang relevan dari ISI DOKUMEN. Placeholder tanpa data yang cocok = string kosong. JANGAN mengarang nilai operasional/angka/nama.';
    const raw = await agLLMText(sys, `DAFTAR PLACEHOLDER: ${JSON.stringify(phs)}\n\nISI DOKUMEN:\n${String(content).slice(0,12000)}`, 'main');
    let map={}; try{ map = JSON.parse(raw.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim()); }catch(e){ map={}; }
    phs.forEach(k=>{ if(typeof map[k]!=='string') map[k] = map[k]==null?'':String(map[k]); });
    const filled = Object.keys(map).filter(k=>phs.includes(k) && map[k]).length;
    const out = await agDocxFill(buf, map);
    const blob = new Blob([out], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download = `${String(d.doc_number||d.title||'dokumen').replace(/[^\w.\-]+/g,'_')}.docx`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast(`.docx final dirakit — ${filled}/${phs.length} field terisi, format identik master`,'ok');
  }catch(e){ toast(e.message,'err'); }
}

// ── TAB COMPLIANCE (dashboard skor §5.1) ─────────────────────────
let _agChkFw = 'ALL', _agComplEl = null;
function agChkFwSet(v){ _agChkFw = v; if(_agComplEl) renderAgComplianceTab(_agComplEl); }
async function renderAgComplianceTab(el){
  _agComplEl = el;
  let score = [];
  try{ score = await agRpc('agentic_compliance_score', {}) || []; }catch(e){}
  const agFws = [...new Set(agChecklist.map(c=>c.framework).filter(Boolean))].sort();
  const agChk = _agChkFw==='ALL' ? agChecklist : agChecklist.filter(c=>c.framework===_agChkFw);
  const totAll   = score.reduce((a,s)=>a+(s.total||0),0);
  const matchAll = score.reduce((a,s)=>a+(s.matched||0),0);
  const pctAll   = totAll ? Math.round(1000*matchAll/totAll)/10 : 0;

  el.innerHTML = `
    <div class="ag-detail" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:12px;font-weight:800;color:#0A2342">Compliance Score — ISO 15189:2022</div>
          <div style="font-size:11px;color:var(--gray)">Klausul wajib yang terpenuhi dokumen (confidence ≥ 0.7)</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:26px;font-weight:800;color:${pctAll>=80?'#22C55E':pctAll>=50?'#F59E0B':'#EF4444'}">${pctAll}%</div>
          <div style="font-size:10.5px;color:var(--gray)">${matchAll}/${totAll} klausul</div>
        </div>
      </div>
      <div class="ag-bar" style="margin-top:8px"><div style="width:${pctAll}%"></div></div>
      <div class="ag-actions" style="margin-top:10px">
        <button class="ag-btn pub" onclick="agRunGapNow()">${svgIcon('sparkle',13)} Jalankan Gap Analysis Sekarang</button>
        <button class="ag-btn mut" onclick="agRunReviewCycle()">${svgIcon('refresh',13)} Cek Dokumen Jatuh Tempo Review</button>
      </div>
    </div>

    <div class="pro-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-bottom:12px">
      ${score.map(s=>`<div class="ag-detail">
        <div style="font-size:9.5px;font-weight:800;color:#64748B;letter-spacing:.3px">${agEsc(s.framework||'—')}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#0A2342">
          <span>${agEsc(s.department)}</span><span>${s.pct}%</span></div>
        <div class="ag-bar" style="margin:6px 0"><div style="width:${s.pct}%"></div></div>
        <div style="font-size:10.5px;color:var(--gray)">✔ ${s.matched} · ⚠ ragu ${s.low_conf} · ✖ kurang ${s.missing} · total ${s.total}</div>
      </div>`).join('') || '<div style="font-size:12px;color:var(--gray)">Belum ada skor — jalankan gap analysis dulu.</div>'}
    </div>

    <div class="ag-detail">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:800;color:#0A2342">Checklist Klausul (${agChk.length}${_agChkFw!=='ALL'?` dari ${agChecklist.length}`:''})</div>
        <label style="font-size:11px;color:#334155;display:flex;align-items:center;gap:6px">Framework:
          <select class="form-input" style="padding:3px 6px;font-size:11px" onchange="agChkFwSet(this.value)">
            <option value="ALL" ${_agChkFw==='ALL'?'selected':''}>Semua (${agChecklist.length})</option>
            ${agFws.map(f=>`<option value="${agEsc(f)}" ${_agChkFw===f?'selected':''}>${agEsc(f)} (${agChecklist.filter(c=>c.framework===f).length})</option>`).join('')}
          </select></label>
      </div>
      <div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Framework</th><th>Klausul</th><th>Persyaratan</th><th>Dok. Dibutuhkan</th><th>Dept</th><th>Match</th><th>Conf.</th></tr></thead>
        <tbody>${agChk.map(c=>{
          const doc = c.matched_document_id ? agRegistry.find(d=>d.id===c.matched_document_id) : null;
          const conf = c.match_confidence!=null ? Number(c.match_confidence) : null;
          return `<tr>
            <td style="white-space:nowrap;font-size:10px;color:#64748B">${agEsc(c.framework||'—')}</td>
            <td style="white-space:nowrap;font-weight:700">${agEsc(c.clause_ref)}</td>
            <td>${agEsc(c.requirement)}</td>
            <td style="white-space:nowrap">${agEsc(c.required_doc_type||'—')} L${c.required_doc_level||'—'}</td>
            <td>${agEsc(c.department||'—')}</td>
            <td>${doc?agEsc(doc.title):'<span style="color:#EF4444;font-weight:700">BELUM ADA</span>'}</td>
            <td style="white-space:nowrap">${conf==null?'—':
              `<span style="font-weight:700;color:${conf>=0.7?'#22C55E':'#F59E0B'}">${(conf*100).toFixed(0)}%</span>`}</td>
          </tr>`;}).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:16px">Checklist kosong — jalankan seed framework (supabase_agentic_fase12.sql + supabase_agentic_frameworks.sql).</td></tr>'}</tbody>
      </table></div>
    </div>

    <div class="ag-detail" style="margin-top:12px" id="ag-audit-box">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">🔍 Audit Internal & CAPA</div>
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;
  agRenderAuditPanel();
}

// ── Panel Audit Internal + CAPA (Fase 7C) ────────────────────────────
const AG_SEV_COLOR = { MAYOR:'#EF4444', MINOR:'#F59E0B', OBSERVASI:'#0EA5E9' };
const AG_CAPA_COLOR = { OPEN:'#EF4444', IN_PROGRESS:'#F59E0B', VERIFICATION:'#8B5CF6', CLOSED:'#22C55E' };
async function agRenderAuditPanel(){
  const box = document.getElementById('ag-audit-box'); if(!box) return;
  let d = null;
  try{ d = await agRpc('agentic_audit_data', {}); }catch(e){ d = null; }
  let inner;
  if(d===null){
    inner = `<div style="font-size:12px;color:var(--gray)">Jalankan <strong>supabase_agentic_fase7c.sql</strong> untuk mengaktifkan audit & CAPA.</div>`;
  } else {
    const s = d.summary||{}; const findings = d.findings||[]; const capa = d.capa||[];
    inner = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <span class="ag-badge" style="background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5">MAYOR ${s.open_mayor||0}</span>
        <span class="ag-badge" style="background:#FEF3C7;color:#92400E;border:1px solid #FCD34D">MINOR ${s.open_minor||0}</span>
        <span class="ag-badge" style="background:#E0F2FE;color:#075985;border:1px solid #7DD3FC">OBSERVASI ${s.open_obs||0}</span>
        <span class="ag-badge" style="background:#F1F5F9;color:#334155;border:1px solid #CBD5E1">CAPA terbuka ${s.capa_open||0}</span>
        ${s.capa_overdue?`<span class="ag-badge" style="background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5">CAPA lewat tempo ${s.capa_overdue}</span>`:''}
      </div>
      <div style="font-size:11.5px;font-weight:800;color:#0A2342;margin:6px 0 4px">Temuan terbuka (${findings.length})</div>
      ${findings.length?`<div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Severity</th><th>Klausul</th><th>Area</th><th>Temuan</th><th>Status</th></tr></thead>
        <tbody>${findings.map(f=>`<tr>
          <td><span class="ag-badge" style="background:${AG_SEV_COLOR[f.severity]||'#64748B'}22;color:${AG_SEV_COLOR[f.severity]||'#64748B'};border:1px solid ${AG_SEV_COLOR[f.severity]||'#64748B'}">${agEsc(f.severity)}</span></td>
          <td style="white-space:nowrap">${agEsc(f.clause_ref||'—')}</td>
          <td>${agEsc(f.area||'—')}</td>
          <td>${agEsc(f.finding||'')}</td>
          <td><span style="color:var(--gray)">${agEsc(f.status)}</span></td>
        </tr>`).join('')}</tbody></table></div>`:'<div style="font-size:11.5px;color:var(--gray)">Belum ada temuan terbuka.</div>'}
      <div style="font-size:11.5px;font-weight:800;color:#0A2342;margin:12px 0 4px">CAPA berjalan (${capa.length})</div>
      ${capa.length?`<div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Judul</th><th>Akar Masalah</th><th>PIC</th><th>Target</th><th>Status</th><th></th></tr></thead>
        <tbody>${capa.map(c=>`<tr>
          <td>${agEsc(c.title||'')}</td>
          <td>${agEsc((c.root_cause||'').slice(0,80))}</td>
          <td style="white-space:nowrap">${agEsc(c.pic||'—')}</td>
          <td style="white-space:nowrap;${c.due_date&&c.due_date<new Date().toISOString().slice(0,10)&&c.status!=='CLOSED'?'color:#B91C1C;font-weight:700':''}">${agEsc(c.due_date||'—')}</td>
          <td><span class="ag-badge" style="background:${AG_CAPA_COLOR[c.status]||'#64748B'}22;color:${AG_CAPA_COLOR[c.status]||'#64748B'};border:1px solid ${AG_CAPA_COLOR[c.status]||'#64748B'}">${agEsc(c.status)}</span></td>
          <td style="white-space:nowrap">
            <select class="form-input" style="padding:2px 4px;font-size:10.5px" onchange="agCapaStatus('${c.id}', this.value)">
              ${['OPEN','IN_PROGRESS','VERIFICATION','CLOSED'].map(st=>`<option ${c.status===st?'selected':''}>${st}</option>`).join('')}
            </select></td>
        </tr>`).join('')}</tbody></table></div>`:'<div style="font-size:11.5px;color:var(--gray)">Belum ada CAPA berjalan.</div>'}`;
  }
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:800;color:#0A2342">🔍 Audit Internal & CAPA</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="ag-btn pub" style="padding:4px 10px;font-size:11px" onclick="agRunAudit()">${svgIcon('sparkle',12)} Jalankan Audit Internal</button>
        <button class="ag-btn mut" style="padding:4px 10px;font-size:11px" onclick="agRenderAuditPanel()">${svgIcon('refresh',11)} Muat ulang</button>
      </div>
    </div>${inner}`;
}
async function agRunAudit(){
  const area = prompt('Area/proses yang diaudit (mis. Pra-analitik, Manajemen mutu):','Pra-analitik');
  if(area===null) return;
  try{
    await agRpc('agentic_create_task', {
      p_agent:'ORG', p_task_type:'AUDIT_EXECUTE',
      p_title:`Audit internal: ${area||'umum'}`,
      p_payload:{ area:area||'umum', clauses:'Klausul kritis ISO 15189:2022', context:'Audit internal terjadwal' },
    });
    toast('Task audit dibuat — menjalankan worker…','ok');
    await agRunWorker(2);
    agRenderAuditPanel();
  }catch(e){ toast(e.message,'err'); }
}
async function agCapaStatus(id, status){
  try{
    await agRpc('agentic_capa_update', { p_id:id, p:{ status } });
    toast(`CAPA → ${status}`,'ok');
    agRenderAuditPanel();
  }catch(e){ toast(e.message,'err'); }
}

async function agRunGapNow(){
  try{
    await agRpc('agentic_create_task', {
      p_agent:'DOCUMENT', p_task_type:'GAP_ANALYSIS',
      p_title:'Gap analysis manual', p_payload:{},
    });
    toast('Task gap analysis dibuat — menjalankan worker…','ok');
    await agRunWorker(2);
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}
async function agRunReviewCycle(){
  try{
    const r = await agRpc('agentic_review_cycle', {});
    toast(`Review cycle: ${r&&r.due_for_review||0} dokumen jatuh tempo → task repair dibuat`,'ok');
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}

// ═══════════════════════════════════════════════════════════════
// TANDA TANGAN ELEKTRONIK · NOMOR DOKUMEN · DAFTAR MASTER SOP
// (butuh supabase_agentic_doc_sign.sql sudah dijalankan)
//
// Bentuk tanda tangan: nama + jabatan + WAKTU SERVER + SIDIK (SHA-256) isi
// dokumen saat ditandatangani. Bukan gambar. Gunanya: bila isi berubah setelah
// disahkan, sidik yang dihitung ulang tidak cocok → perubahan diam-diam
// ketahuan. Itulah yang membuatnya berguna untuk audit, bukan sekadar hiasan.
// ═══════════════════════════════════════════════════════════════

const AG_SIGN_ROLES = ['Disusun oleh', 'Diperiksa oleh', 'Disetujui oleh', 'Diketahui oleh'];

// Isi kanonik yang di-hash. Memakai teks penuh hasil ekstraksi; bila belum ada,
// pakai gabungan metadata inti agar tetap ada yang bisa disidik.
function agDocCanonical(d){
  const t = d && d.extracted_meta && d.extracted_meta.full_text;
  if (t && String(t).trim()) return String(t);
  return [d.doc_number, d.title, d.doc_type, d.department, d.current_revision].join('|');
}

async function agDocHash(text){
  if (!(window.crypto && crypto.subtle)) throw new Error('Peramban tidak mendukung SHA-256 (butuh HTTPS)');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function agOpenSignModal(docId){
  const d = agRegistry.find(x => x.id === docId); if(!d) return;
  const namaKini = (typeof getUserName === 'function') ? getUserName() : '';
  openModal(`
    <div class="modal-header">
      <div class="modal-title">✍️ Tanda Tangan Elektronik</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="font-size:12.5px;margin-bottom:10px">
      <b>${agEsc(d.title)}</b>
      <div style="color:var(--gray);font-size:11.5px">${agEsc(d.doc_number || '(belum bernomor)')} · Rev ${d.current_revision || 0} · ${agEsc(d.department || '')}</div>
    </div>
    <div id="ag-sign-list"><div class="loading-row"><div class="spinner"></div></div></div>
    <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px">
      <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Bubuhkan Tanda Tangan</div>
      <div class="form-row">
        <div class="form-group"><label>Peran *</label>
          <input list="ag-sign-roles" id="ag-sign-role" placeholder="Disetujui oleh">
          <datalist id="ag-sign-roles">${AG_SIGN_ROLES.map(r => `<option value="${r}">`).join('')}</datalist>
        </div>
        <div class="form-group"><label>Nama</label>
          <input id="ag-sign-name" value="${agEsc(namaKini)}">
        </div>
      </div>
      <div class="form-group"><label>Catatan (opsional)</label><input id="ag-sign-note" placeholder="mis. disahkan pada rapat mutu"></div>
      <div style="font-size:10.5px;color:var(--gray)">Waktu diambil dari server, bukan jam komputer ini. Sidik isi dokumen dihitung otomatis.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="agSignDoc('${docId}')">✍️ Tandatangani</button>
    </div>`, 'wide');
  await agRenderSignList(docId);
}

async function agRenderSignList(docId){
  const el = document.getElementById('ag-sign-list'); if(!el) return;
  const d = agRegistry.find(x => x.id === docId) || {};
  let rows = [];
  try { rows = await agRpc('agentic_doc_signatures', { p_doc_id: docId }) || []; }
  catch(e){
    el.innerHTML = `<div class="status-box status-warn">Fitur tanda tangan belum aktif — jalankan <code>supabase_agentic_doc_sign.sql</code> di Supabase SQL Editor.</div>`;
    return;
  }
  if(!rows.length){
    el.innerHTML = `<div style="font-size:12px;color:var(--gray);font-style:italic">Belum ada tanda tangan.</div>`;
    return;
  }

  let nowHash = '';
  try { nowHash = await agDocHash(agDocCanonical(d)); } catch(e){}

  el.innerHTML = rows.map(s => {
    const cocok = nowHash && s.content_hash === nowHash;
    const warna = cocok ? '#15803D' : '#B45309';
    return `<div style="border:1px solid var(--border);border-left:3px solid ${warna};border-radius:8px;padding:9px 11px;margin-bottom:7px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div><b style="font-size:12.5px">${agEsc(s.signer_role)}</b>
          <div style="font-size:12px">${agEsc(s.signer_name)}</div></div>
        <div style="font-size:11px;color:var(--gray);text-align:right">
          ${new Date(s.signed_at).toLocaleString('id-ID')}<div>Rev ${s.revision == null ? 0 : s.revision}</div></div>
      </div>
      ${s.note ? `<div style="font-size:11.5px;color:var(--text2);margin-top:3px">${agEsc(s.note)}</div>` : ''}
      <div style="font-size:10.5px;font-family:ui-monospace,monospace;color:var(--gray);margin-top:5px">
        sidik ${agEsc(String(s.content_hash).slice(0, 16))}…</div>
      <div style="font-size:11px;font-weight:700;margin-top:3px;color:${warna}">
        ${nowHash ? (cocok ? '✅ Isi dokumen tidak berubah sejak ditandatangani'
                           : '⚠️ Isi dokumen BERUBAH setelah ditandatangani — perlu tanda tangan ulang')
                  : 'ℹ️ Sidik saat ini tidak dapat dihitung'}</div>
    </div>`;
  }).join('');
}

async function agSignDoc(docId){
  const d = agRegistry.find(x => x.id === docId); if(!d) return;
  const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const role = gv('ag-sign-role'), name = gv('ag-sign-name'), note = gv('ag-sign-note');
  if(!role){ toast('Isi peran/jabatan','warn'); return; }
  if(!name){ toast('Isi nama penanda tangan','warn'); return; }
  try{
    const hash = await agDocHash(agDocCanonical(d));
    await agRpc('agentic_doc_sign', { p_doc_id: docId, p_signer: name, p_role: role, p_hash: hash, p_note: note || null });
    if(typeof logActivity === 'function')
      logActivity('doc_sign', 'document_registry', docId, `${role}: ${name} menandatangani ${d.doc_number || d.title}`, d.title);
    toast('✍️ Tanda tangan tersimpan','ok');
    const r = document.getElementById('ag-sign-role'); if(r) r.value = '';
    const n = document.getElementById('ag-sign-note'); if(n) n.value = '';
    await agRenderSignList(docId);
  }catch(e){ toast('❌ ' + e.message, 'err'); }
}

// ── Nomor dokumen manual ───────────────────────────────────────
async function agEditDocNumber(docId){
  const d = agRegistry.find(x => x.id === docId); if(!d) return;
  const val = prompt(`Nomor dokumen untuk:\n${d.title}\n\n(Nomor tidak dapat diubah setelah dokumen ditandatangani)`, d.doc_number || '');
  if(val === null) return;
  const num = val.trim();
  if(!num){ toast('Nomor tidak boleh kosong','warn'); return; }
  try{
    await agRpc('agentic_doc_set_number', { p_doc_id: docId, p_number: num });
    if(typeof logActivity === 'function')
      logActivity('doc_number', 'document_registry', docId, `Nomor dokumen diset: ${num}`, d.title);
    toast('✅ Nomor dokumen tersimpan','ok');
    await agReload();
  }catch(e){ toast('❌ ' + e.message, 'err'); }
}

// ── Daftar master SOP terbaru (CSV) ────────────────────────────
// Datanya sudah disediakan RPC agentic_doc_admin (dokumen berstatus PUBLISHED).
async function agExportMasterSOP(){
  toast('Menyiapkan daftar master…','info');
  let data;
  try { data = await agRpc('agentic_doc_admin', { p_recent_days: 30 }); }
  catch(e){ toast('❌ ' + e.message, 'err'); return; }
  const rows = (data && data.published) || [];
  if(!rows.length){ toast('Belum ada dokumen berstatus PUBLISHED','warn'); return; }

  const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = ['No. Dokumen','Judul','Jenis','Level','Departemen','Revisi','Tanggal Berlaku','Review Berikutnya'];
  const csv = [head.join(',')].concat(rows.map(r => [
    r.doc_number, r.title, r.doc_type, r.doc_level, r.department,
    r.revision, r.effective_date, r.next_review_date,
  ].map(q).join(','))).join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `daftar-master-sop-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast(`✅ ${rows.length} dokumen diekspor`, 'ok');
}

// ═══════════════════════════════════════════════════════════════
// TAB REVIEW & PENGESAHAN
//
// Menjawab tiga pertanyaan yang sebelumnya tersebar dan sulit dijawab:
//   1. Dokumen mana yang jatuh tempo review (atau sudah lewat)?
//   2. Dokumen mana yang terbit tapi pengesahannya belum lengkap?
//   3. Siapa mengesahkan apa, kapan?
//
// Semuanya diambil dalam SATU panggilan (agentic_doc_review_data) — bukan satu
// kueri per dokumen. Basis data ada di Sydney (~100 ms per kueri), jadi N kueri
// akan terasa lambat sekali untuk registry yang panjang.
//
// Butuh supabase_agentic_doc_sign.sql sudah dijalankan.
// ═══════════════════════════════════════════════════════════════

// Peran minimum yang dianggap sah untuk sebuah SOP. Dipakai hanya untuk
// MENANDAI kelengkapan, bukan memaksa — tiap organisasi bisa berbeda.
const AG_REVIEW_REQUIRED_ROLES = ['Disusun oleh', 'Diperiksa oleh', 'Disetujui oleh'];

async function renderAgReviewTab(el){
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <div style="font-size:12px;color:var(--gray)">
        Jatuh tempo review, kelengkapan pengesahan, dan jejak siapa mengesahkan apa.
      </div>
      <div style="display:flex;gap:6px">
        <button class="ag-btn mut" style="padding:5px 11px" title="Tandai dokumen jatuh tempo & buat task perbaikan" onclick="agRunReviewCycle()">🔄 Jalankan Siklus Review</button>
        <button class="ag-btn mut" style="padding:5px 11px" onclick="agRenderReviewBody()">↻ Muat Ulang</button>
      </div>
    </div>
    <div id="ag-review-body"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await agRenderReviewBody();
}

async function agRenderReviewBody(){
  const el = document.getElementById('ag-review-body'); if(!el) return;
  el.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

  let data;
  try { data = await agRpc('agentic_doc_review_data', { p_horizon_days: 30 }); }
  catch(e){
    el.innerHTML = `<div class="status-box status-warn">
      Tab Review belum aktif — jalankan <code>supabase_agentic_doc_sign.sql</code> di Supabase SQL Editor.
      <div style="font-size:11px;margin-top:4px;color:var(--gray)">${agEsc(e.message)}</div></div>`;
    return;
  }

  const due    = (data && data.due) || [];
  const unsign = (data && data.unsigned) || [];
  const recent = (data && data.recent_signatures) || [];

  // Yang belum lengkap saja yang perlu ditampilkan sebagai pekerjaan.
  const belum = unsign.filter(d => {
    const roles = d.roles || [];
    return AG_REVIEW_REQUIRED_ROLES.some(r => !roles.includes(r));
  });
  const telat = due.filter(d => (d.days_left ?? 0) < 0);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">
      ${[
        { v: telat.length,  l: 'Lewat Jatuh Tempo', c: '#B91C1C' },
        { v: due.length,    l: 'Jatuh Tempo ≤30 hari', c: '#B45309' },
        { v: belum.length,  l: 'Pengesahan Belum Lengkap', c: '#7C3AED' },
        { v: recent.length, l: 'Pengesahan 90 Hari', c: '#15803D' },
      ].map(k => `<div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${k.c};border-radius:10px;padding:11px 13px">
        <div style="font-size:20px;font-weight:800;color:${k.c};font-variant-numeric:tabular-nums">${k.v}</div>
        <div style="font-size:10.5px;color:var(--gray)">${k.l}</div></div>`).join('')}
    </div>

    <div class="ag-detail" style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">⏰ Jatuh Tempo Review (${due.length})</div>
      ${due.length ? `<div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:12px">
        <thead><tr><th>No. Dokumen</th><th>Judul</th><th>Dept</th><th>Status</th><th>Tgl Review</th><th>Sisa</th><th></th></tr></thead>
        <tbody>${due.map(d => {
          const sisa = d.days_left;
          const lewat = sisa < 0;
          return `<tr>
            <td style="white-space:nowrap">${agEsc(d.doc_number || '—')}</td>
            <td>${agEsc(d.title)}</td>
            <td>${agEsc(d.department || '')}</td>
            <td>${agDocChip(d.status)}</td>
            <td style="white-space:nowrap">${agEsc(d.next_review_date || '—')}</td>
            <td style="white-space:nowrap;font-weight:700;color:${lewat ? '#B91C1C' : sisa <= 7 ? '#B45309' : 'var(--gray)'}">
              ${lewat ? `lewat ${Math.abs(sisa)} hari` : `${sisa} hari`}</td>
            <td style="white-space:nowrap">
              <button class="ag-btn mut" style="padding:4px 9px" title="Tinjau dokumen final sesuai template" onclick="agOpenFinalReview('${d.id}')">📄 Review</button>
              <button class="ag-btn mut" style="padding:4px 9px" onclick="agOpenSignModal('${d.id}')">✍️ TTD</button></td>
          </tr>`;
        }).join('')}</tbody></table></div>`
      : `<div style="font-size:12px;color:var(--gray);font-style:italic">Tidak ada dokumen jatuh tempo dalam 30 hari.</div>`}
    </div>

    <div class="ag-detail" style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:4px">✍️ Pengesahan Belum Lengkap (${belum.length})</div>
      <div style="font-size:10.5px;color:var(--gray);margin-bottom:8px">
        Acuan kelengkapan: ${AG_REVIEW_REQUIRED_ROLES.join(' · ')}</div>
      ${belum.length ? `<div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:12px">
        <thead><tr><th>No. Dokumen</th><th>Judul</th><th>Dept</th><th>Rev</th><th>Sudah TTD</th><th>Kurang</th><th></th></tr></thead>
        <tbody>${belum.map(d => {
          const roles = d.roles || [];
          const kurang = AG_REVIEW_REQUIRED_ROLES.filter(r => !roles.includes(r));
          return `<tr>
            <td style="white-space:nowrap">${agEsc(d.doc_number || '—')}</td>
            <td>${agEsc(d.title)}</td>
            <td>${agEsc(d.department || '')}</td>
            <td>${d.revision || 0}</td>
            <td style="font-size:11px">${roles.length ? roles.map(r => agEsc(r)).join(', ') : '<i style="color:var(--gray)">belum ada</i>'}</td>
            <td style="font-size:11px;color:#B45309;font-weight:600">${kurang.map(r => agEsc(r)).join(', ')}</td>
            <td style="white-space:nowrap">
              <button class="ag-btn mut" style="padding:4px 9px" title="Tinjau dokumen final sesuai template" onclick="agOpenFinalReview('${d.id}')">📄 Review</button>
              <button class="ag-btn mut" style="padding:4px 9px" onclick="agOpenSignModal('${d.id}')">✍️ TTD</button></td>
          </tr>`;
        }).join('')}</tbody></table></div>`
      : `<div style="font-size:12px;color:var(--gray);font-style:italic">Semua dokumen terbit sudah lengkap pengesahannya.</div>`}
    </div>

    <div class="ag-detail">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">🧾 Jejak Pengesahan 90 Hari Terakhir (${recent.length})</div>
      ${recent.length ? `<div style="max-height:320px;overflow-y:auto">
        ${recent.map(s => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;flex-wrap:wrap">
          <div style="min-width:0">
            <b>${agEsc(s.signer_role)}</b> — ${agEsc(s.signer_name)}
            <div style="font-size:11px;color:var(--gray)">${agEsc(s.doc_number || '')} ${agEsc(s.title || '')} · Rev ${s.revision == null ? 0 : s.revision}</div>
          </div>
          <div style="font-size:11px;color:var(--gray);white-space:nowrap">${new Date(s.signed_at).toLocaleString('id-ID')}</div>
        </div>`).join('')}</div>`
      : `<div style="font-size:12px;color:var(--gray);font-style:italic">Belum ada pengesahan tercatat.</div>`}
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// REVIEW DOKUMEN FINAL (sudah disesuaikan template)
//
// Sebelumnya tombol "🧩 .docx" langsung mengunduh berkas jadi — tidak ada
// kesempatan melihat APA yang diisikan AI ke tiap kolom template sebelum
// dokumen resmi terbentuk. Untuk dokumen mutu itu berbahaya: salah petakan
// satu kolom bisa lolos begitu saja ke dokumen bertanda tangan.
//
// Layar ini menyisipkan langkah tinjauan: pemetaan {{PLACEHOLDER}} → nilai
// ditampilkan dan DAPAT DISUNTING manusia, baru kemudian .docx dirakit dari
// nilai yang sudah ditinjau. Format tetap identik master (mesin agDocxFill).
// ═══════════════════════════════════════════════════════════════

let _agFinal = null;   // { docId, buf, phs, map, tpl, doc }

const AG_TPL_MATCH_NOTE = {
  1: null,
  2: 'Memakai template umum departemen MUTU (bukan template khusus departemen dokumen ini).',
  3: 'Memakai template dengan level & jenis sama, tetapi departemen berbeda.',
  4: 'Memakai template jenis sama dengan level berbeda — periksa kesesuaiannya.',
  5: 'Memakai template jenis sama saja (level & departemen berbeda) — periksa saksama.',
};

async function agOpenFinalReview(docId){
  const d = agRegistry.find(x => x.id === docId);
  if(!d){ toast('Dokumen tak ditemukan','err'); return; }
  const content = d.extracted_meta && d.extracted_meta.full_text;
  if(!content){ toast('Dokumen belum punya isi — jalankan Repair/generate dulu','warn'); return; }

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📄 Review Dokumen Final</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="font-size:12.5px;margin-bottom:8px">
      <b>${agEsc(d.title)}</b>
      <div style="color:var(--gray);font-size:11.5px">${agEsc(d.doc_number || '(belum bernomor)')} · ${agEsc(d.doc_type)} L${d.doc_level} · ${agEsc(d.department || '')} · Rev ${d.current_revision || 0}</div>
    </div>
    <div id="ag-final-body"><div class="loading-row"><div class="spinner"></div></div>
      <div style="text-align:center;font-size:11.5px;color:var(--gray)">Mengambil template & memetakan isi…</div></div>
    <div class="modal-footer" id="ag-final-foot"></div>`, 'wide');

  try{
    const tpl = await agRpc('agentic_template_get', { p_level: d.doc_level, p_type: d.doc_type, p_dept: d.department });
    if(!tpl || !tpl.storage_path){ agFinalNoTemplate(d); return; }

    const buf = await agDownloadStorage(tpl.storage_path);
    let phs = Array.isArray(tpl.placeholders) ? tpl.placeholders.slice() : [];
    try { (await agDocxScanPlaceholders(buf)).forEach(k => { if(!phs.includes(k)) phs.push(k); }); } catch(e){}
    if(!phs.length){
      document.getElementById('ag-final-body').innerHTML =
        `<div class="status-box status-warn">Master template ini tidak memiliki <code>{{placeholder}}</code> — tidak ada kolom yang bisa diisi.
         Sisipkan penanda seperti <code>{{JUDUL}}</code>, <code>{{TUJUAN}}</code> pada master .docx Anda.</div>`;
      return;
    }

    const sys = 'Anda mengisi template dokumen resmi. Balas HANYA JSON objek {placeholder: nilai}. Untuk tiap placeholder pada DAFTAR, ambil/ringkas nilai yang relevan dari ISI DOKUMEN. Placeholder tanpa data yang cocok = string kosong. JANGAN mengarang nilai operasional/angka/nama.';
    let raw = '', map = {}, gagal = null;
    try {
      raw = await agLLMText(sys, `DAFTAR PLACEHOLDER: ${JSON.stringify(phs)}\n\nISI DOKUMEN:\n${String(content).slice(0, 12000)}`, 'main');
    } catch(e){ gagal = 'Panggilan AI gagal: ' + e.message; }

    if(!gagal){
      try { map = JSON.parse(String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()); }
      catch(e){ gagal = 'Jawaban AI bukan JSON yang dapat dibaca — pemetaan tidak dapat dibuat otomatis.'; map = {}; }
    }
    phs.forEach(k => { if(typeof map[k] !== 'string') map[k] = map[k] == null ? '' : String(map[k]); });

    // Bila semua kosong, sebutkan kemungkinan sebabnya — jangan biarkan pengguna
    // menebak-nebak melihat "0/31 kolom terisi" tanpa keterangan apa pun.
    const terisi = phs.filter(k => (map[k] || '').trim()).length;
    if(!gagal && terisi === 0){
      gagal = String(content).trim().length < 200
        ? `Isi dokumen sumber sangat pendek (${String(content).trim().length} karakter) — belum ada yang bisa dipetakan. Jalankan Repair/generate isi dokumen dulu.`
        : 'AI tidak menemukan satu pun nilai yang cocok. Periksa apakah nama kolom template sesuai isi dokumen, atau isi manual di bawah.';
    }

    _agFinal = { docId, buf, phs, map, tpl, doc: d, gagal, contentLen: String(content).trim().length };
    agRenderFinalReview();
  }catch(e){
    const el = document.getElementById('ag-final-body');
    if(el) el.innerHTML = `<div class="status-box status-warn">Gagal menyiapkan review: ${agEsc(e.message)}</div>`;
  }
}

// Pesan yang menuntun, bukan sekadar "belum ada".
async function agFinalNoTemplate(d){
  let list = [];
  try { list = await agRpc('agentic_template_list', {}) || []; } catch(e){}
  const siap = list.filter(t => t.has_master);
  document.getElementById('ag-final-body').innerHTML = `
    <div class="status-box status-warn">
      Belum ada master <code>.docx</code> yang cocok untuk dokumen ini
      (<b>${agEsc(d.doc_type)} L${d.doc_level} · ${agEsc(d.department || '')}</b>).
    </div>
    <div style="font-size:12px;margin-top:10px">
      <div style="font-weight:700;margin-bottom:5px">Template yang sudah terpasang master:</div>
      ${siap.length ? `<ul style="margin:0;padding-left:18px">${siap.map(t =>
        `<li>${agEsc(t.doc_type)} L${t.doc_level} · ${agEsc(t.department)} — ${agEsc(t.name)}</li>`).join('')}</ul>
        <div style="color:var(--gray);margin-top:8px">Unggah master untuk kombinasi dokumen ini, atau samakan jenis/level/departemen dokumen dengan salah satu di atas.</div>`
      : `<div style="color:var(--gray)">Belum ada satu pun template dengan master .docx terunggah. Unggah di <b>Dokumen QMS → 📐 Template Dokumen Resmi</b>.</div>`}
      ${list.length && !siap.length ? `<div style="color:var(--gray);margin-top:6px">(${list.length} template terdaftar tetapi belum ada berkas master yang diunggah.)</div>` : ''}
    </div>`;
}

function agRenderFinalReview(){
  const st = _agFinal; if(!st) return;
  const body = document.getElementById('ag-final-body');
  const foot = document.getElementById('ag-final-foot');
  const terisi = st.phs.filter(k => (st.map[k] || '').trim()).length;
  const catatan = AG_TPL_MATCH_NOTE[st.tpl.match_level];

  if(body) body.innerHTML = `
    <div style="font-size:11.5px;color:var(--gray);margin-bottom:8px">
      Template: <b>${agEsc(st.tpl.name || '—')}</b> · ${terisi}/${st.phs.length} kolom terisi
      ${st.contentLen != null ? ` · isi sumber ${st.contentLen.toLocaleString('id-ID')} karakter` : ''}
    </div>
    ${st.gagal ? `<div class="status-box status-warn" style="margin-bottom:10px;font-size:11.5px">⚠️ ${agEsc(st.gagal)}</div>` : ''}
    ${catatan ? `<div class="status-box status-warn" style="margin-bottom:10px;font-size:11.5px">⚠️ ${agEsc(catatan)}</div>` : ''}
    <div style="font-size:11.5px;color:var(--gray);margin-bottom:8px">
      Periksa tiap kolom di bawah. Nilai dapat disunting — yang Anda sunting itulah yang masuk ke dokumen final.
      Kolom kosong akan dibiarkan kosong, bukan dikarang.
    </div>
    <div style="max-height:46vh;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--lgray);position:sticky;top:0">
          <th style="padding:6px 10px;text-align:left;width:34%">Kolom Template</th>
          <th style="padding:6px 10px;text-align:left">Nilai yang akan diisi</th>
        </tr></thead>
        <tbody>${st.phs.map((k, i) => {
          const v = st.map[k] || '';
          const kosong = !v.trim();
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 10px;font-family:ui-monospace,monospace;font-size:11px;vertical-align:top;color:${kosong ? '#B45309' : 'var(--navy)'}">
              {{${agEsc(k)}}}${kosong ? '<div style="font-size:10px;font-style:italic">kosong</div>' : ''}</td>
            <td style="padding:4px 8px">
              <textarea data-ph="${agEsc(k)}" rows="${v.length > 90 ? 3 : 1}" oninput="agFinalEdit(this)"
                style="width:100%;font-size:11.5px;padding:5px;border:1px solid ${kosong ? '#FCD34D' : 'var(--border)'};border-radius:5px;resize:vertical;font-family:inherit">${agEsc(v)}</textarea>
            </td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;

  if(foot) foot.innerHTML = `
    <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    <button class="btn btn-ghost" onclick="agFinalDownload()">⬇️ Unduh .docx Final</button>
    <button class="btn btn-teal" onclick="agFinalApprove()">✅ Setujui &amp; Tandatangani</button>`;
}

function agFinalEdit(ta){
  if(!_agFinal) return;
  _agFinal.map[ta.dataset.ph] = ta.value;
}

async function agFinalDownload(){
  const st = _agFinal; if(!st){ toast('Sesi review hilang — buka ulang','warn'); return; }
  try{
    const out = await agDocxFill(st.buf, st.map);
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${String(st.doc.doc_number || st.doc.title || 'dokumen').replace(/[^\w.\-]+/g, '_')}.docx`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    const terisi = st.phs.filter(k => (st.map[k] || '').trim()).length;
    toast(`.docx final diunduh — ${terisi}/${st.phs.length} kolom terisi, format identik master`, 'ok');
  }catch(e){ toast('❌ ' + e.message, 'err'); }
}

// Setujui: catat hasil tinjauan ke registry, lalu buka layar tanda tangan.
async function agFinalApprove(){
  const st = _agFinal; if(!st) return;
  const terisi = st.phs.filter(k => (st.map[k] || '').trim()).length;
  if(terisi < st.phs.length){
    if(!confirm(`${st.phs.length - terisi} kolom masih kosong.\nLanjutkan menyetujui dokumen final ini?`)) return;
  }
  try{
    // Simpan nilai final yang SUDAH ditinjau manusia, supaya perakitan ulang
    // memakai hasil tinjauan — bukan menebak ulang lewat AI.
    await agRpc('agentic_doc_update', {
      p_id: st.docId,
      p: { extracted_meta: { template_fill: st.map, template_id: st.tpl.id,
                             reviewed_by: (typeof getUserName === 'function' ? getUserName() : ''),
                             reviewed_at: new Date().toISOString() } },
    });
    if(typeof logActivity === 'function')
      logActivity('doc_final_review', 'document_registry', st.docId,
        `Dokumen final ditinjau (${terisi}/${st.phs.length} kolom terisi)`, st.doc.title);
    toast('✅ Hasil tinjauan tersimpan — lanjut tanda tangan', 'ok');
    await agReload();
    agOpenSignModal(st.docId);
  }catch(e){ toast('❌ ' + e.message, 'err'); }
}
