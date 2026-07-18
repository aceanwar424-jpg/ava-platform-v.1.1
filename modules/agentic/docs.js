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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:12px;font-weight:800;color:#0A2342">${svgIcon('book',14)} Registry Dokumen (${docs.length})</div>
      </div>
      <div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:12px">
        <thead><tr><th>No. Dokumen</th><th>Judul</th><th>Jenis</th><th>Dept</th><th>Status</th><th>Rev</th><th>Review Berikut</th><th></th></tr></thead>
        <tbody>${docs.map(d=>`<tr>
          <td style="white-space:nowrap">${agEsc(d.doc_number||'—')}</td>
          <td>${agEsc(d.title)}</td>
          <td>${agEsc(d.doc_type)} L${d.doc_level}</td>
          <td>${agEsc(d.department)}</td>
          <td>${agDocChip(d.status)}</td>
          <td>${d.current_revision||0}</td>
          <td>${d.next_review_date||'—'}</td>
          <td style="white-space:nowrap">
            ${d.status!=='PUBLISHED' && (d.extracted_meta&&d.extracted_meta.full_text) ?
              `<button class="ag-btn mut" style="padding:4px 9px" title="Buat task perbaikan AI" onclick="agMakeRepairTask('${d.id}')">${svgIcon('sparkle',12)} Repair</button>` : ''}
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
    try{ await agRunWorker(5); }catch(e){ toast(e.message,'err'); }
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
