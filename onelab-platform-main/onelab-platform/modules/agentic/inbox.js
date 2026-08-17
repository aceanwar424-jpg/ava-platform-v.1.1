// ═══════════════════════════════════════════════════════════════
// AGENTIC — APPROVAL INBOX (Fase 1 · spec §7 + §4.2)
// Human-in-the-loop: DRAFT → (IN_MEDICAL_REVIEW) → APPROVED → PUBLISHED
// Reject wajib feedback → task antri ulang dgn feedback sbg konteks.
// ═══════════════════════════════════════════════════════════════

let _agSelTask = null;
let _agInboxFilter = 'action'; // action | all | done

function agInboxTasks(){
  if(_agInboxFilter==='action')
    return agTasks.filter(t=>['DRAFT','IN_MEDICAL_REVIEW','APPROVED','FAILED'].includes(t.status));
  if(_agInboxFilter==='done')
    return agTasks.filter(t=>['PUBLISHED','CANCELLED','REJECTED'].includes(t.status));
  return agTasks;
}

function renderAgInboxTab(el){
  el = el || document.getElementById('ag-tab-content');
  if(!el) return;
  const items = agInboxTasks();
  if(_agSelTask && !agTasks.find(t=>t.id===_agSelTask)) _agSelTask = null;
  if(!_agSelTask && items.length) _agSelTask = items[0].id;

  el.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      ${[['action','Perlu Tindakan'],['all','Semua'],['done','Selesai']].map(([k,l])=>
        `<button class="pro-chip ${_agInboxFilter===k?'active':''}" onclick="agSetInboxFilter('${k}')">${l}</button>`).join('')}
    </div>
    <div class="ag-split">
      <div class="ag-list" id="ag-inbox-list">
        ${items.length ? items.map(t=>`
          <div class="ag-item ${t.id===_agSelTask?'active':''}" onclick="agPickTask('${t.id}')">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
              <strong style="font-size:12.5px;color:var(--navy-deep);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${agEsc(t.title)}</strong>
              ${agChip(t.status)}
            </div>
            <div style="font-size:10.5px;color:var(--gray);margin-top:3px">
              ${agEsc(t.agent)} · ${agEsc(t.task_type)} · ${agAgo(t.updated_at)}
              ${t.needs_medical_review?' · 🩺 review medis':''}
            </div>
          </div>`).join('')
        : `<div style="padding:22px;text-align:center;color:var(--gray);font-size:12.5px">Tidak ada task${_agInboxFilter==='action'?' yang perlu tindakan':''}.</div>`}
      </div>
      <div class="ag-detail" id="ag-inbox-detail">
        ${_agSelTask ? '<div class="loading-row"><div class="spinner"></div></div>' :
          '<div style="padding:22px;text-align:center;color:var(--gray);font-size:12.5px">Pilih task di kiri untuk melihat detail & approval.</div>'}
      </div>
    </div>`;
  if(_agSelTask) agRenderTaskDetail(_agSelTask);
}

function agSetInboxFilter(f){ _agInboxFilter = f; _agSelTask = null; agRenderTab(); }
function agPickTask(id){
  _agSelTask = id;
  document.querySelectorAll('#ag-inbox-list .ag-item').forEach(x=>x.classList.remove('active'));
  const items = agInboxTasks(); const idx = items.findIndex(t=>t.id===id);
  const node = document.querySelectorAll('#ag-inbox-list .ag-item')[idx];
  if(node) node.classList.add('active');
  agRenderTaskDetail(id);
}

async function agRenderTaskDetail(id){
  const box = document.getElementById('ag-inbox-detail'); if(!box) return;
  const t = agTasks.find(x=>x.id===id); if(!t){ box.innerHTML=''; return; }

  let events = [], qas = [];
  try{ events = await sbGet('agentic_task_events_v', `task_id=eq.${id}&select=*&order=created_at.asc`) || []; }catch(e){}
  try{ qas = await sbGet('agentic_qa_v', `task_id=eq.${id}&select=*&order=created_at.desc&limit=3`) || []; }catch(e){}

  const r = t.result || {};
  const md = r.markdown || (r.text ? String(r.text) : '');
  const placeholders = md ? (md.match(/\[\[KONFIRMASI:/g)||[]).length : 0;
  const isInfo = ['GAP_ANALYSIS','DOC_REVIEW_CYCLE','SMOKE_TEST','DOC_INGEST'].includes(t.task_type);

  // ── Tombol aksi per status (§4.2) ──
  let actions = '';
  if(t.status==='DRAFT'){
    actions += t.needs_medical_review
      ? `<button class="ag-btn warn" onclick="agActApprove('${t.id}')">${svgIcon('stethoscope',13)} Kirim ke Review Medis</button>`
      : `<button class="ag-btn ok" onclick="agActApprove('${t.id}')">${svgIcon('check',13)} Setujui${isInfo?' (tandai selesai)':''}</button>`;
    actions += `<button class="ag-btn err" onclick="agActReject('${t.id}')">✕ Tolak + Feedback</button>`;
  } else if(t.status==='IN_MEDICAL_REVIEW'){
    actions += `<button class="ag-btn ok" onclick="agActApprove('${t.id}')">${svgIcon('check',13)} Setujui (Review Medis)</button>
      <button class="ag-btn err" onclick="agActReject('${t.id}')">✕ Tolak + Feedback</button>`;
  } else if(t.status==='APPROVED'){
    actions += `<button class="ag-btn pub" onclick="agActPublish('${t.id}')">${svgIcon('upload',13)} Publish</button>`;
  } else if(t.status==='FAILED'){
    actions += `<button class="ag-btn warn" onclick="agActRetry('${t.id}')">${svgIcon('refresh',13)} Retry</button>`;
  } else if(t.status==='QUEUED'){
    actions += `<button class="ag-btn mut" onclick="agInvokeWorkerBtn()">${svgIcon('refresh',13)} Jalankan Worker</button>
      <button class="ag-btn err" onclick="agActCancel('${t.id}')">✕ Batalkan</button>`;
  }
  if(md) actions += `<button class="ag-btn mut" onclick="agDownloadMd('${t.id}')">${svgIcon('download',13)} .md</button>
    <button class="ag-btn mut" onclick="agDownloadDocxFromTask('${t.id}')">${svgIcon('download',13)} .docx</button>`;
  // Konten sosmed yang sudah jadi tapi TANPA gambar → buat gambarnya saja
  // (caption tidak disentuh; pakai image_prompt yang sudah ditulis AI)
  if(t.task_type==='MAKE_SOSMED' && ['DRAFT','APPROVED','PUBLISHED'].includes(t.status)
     && !(t.result && t.result.image_path)){
    actions += `<button class="ag-btn ok" id="ag-genimg-${t.id}" onclick="agGenImageForTask('${t.id}')">${svgIcon('image',13)} Buat Gambar</button>`;
  }

  // Deteksi task macet: PROCESSING terlalu lama = worker mati sebelum menutup task
  let stuckWarn = '';
  if(t.status==='PROCESSING'){
    const mins = Math.floor((Date.now() - new Date(t.updated_at).getTime())/60000);
    stuckWarn = mins >= 3
      ? `<div style="margin-top:10px;background:var(--danger-soft);border:1px solid #FCA5A5;border-radius:8px;padding:9px 12px;font-size:12px;color:var(--danger-deep)">
          <strong>⚠ Diproses sudah ${mins} menit — kemungkinan macet.</strong><br>
          Buka tab <strong>Monitor</strong> → <strong>Tes Koneksi AI</strong> untuk cek provider LLM,
          lalu <strong>Bebaskan Task Macet</strong> untuk antri ulang otomatis.</div>`
      : `<div style="margin-top:10px;font-size:12px;color:var(--info)">⏳ Sedang diproses worker (${mins} menit)… panggilan LLM model besar bisa 1–2 menit.</div>`;
  }

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
      <div>
        <div style="font-size:15px;font-weight:800;color:var(--navy-deep)">${agEsc(t.title)}</div>
        <div style="font-size:11px;color:var(--gray);margin-top:3px">
          ${agEsc(t.agent)} · ${agEsc(t.task_type)} · attempt ${t.attempts||0}/${t.max_attempts||3}
          · dibuat ${agAgo(t.created_at)} ${t.needs_medical_review?' · 🩺 wajib review medis':''}
        </div>
      </div>
      ${agChip(t.status)}
    </div>

    ${stuckWarn}
    ${t.error_message ? `<div style="margin-top:10px;background:var(--danger-soft);border:1px solid #FCA5A5;border-radius:8px;padding:9px 12px;font-size:12px;color:var(--danger-deep)"><strong>Error:</strong> ${agEsc(t.error_message)}</div>` : ''}
    ${t.payload && t.payload.rejection_feedback ? `<div style="margin-top:10px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:9px 12px;font-size:12px;color:#9A3412"><strong>Feedback penolakan terakhir:</strong> ${agEsc(t.payload.rejection_feedback)}</div>` : ''}
    ${placeholders ? `<div style="margin-top:10px;background:var(--warn-soft);border:1px solid #F59E0B;border-radius:8px;padding:9px 12px;font-size:12px;color:var(--warn-deeper)"><strong>⚠ ${placeholders} nilai butuh konfirmasi operator</strong> — periksa tanda KONFIRMASI di draft sebelum approve (kebijakan §9.3: AI dilarang mengarang angka klinis/nama/harga).</div>` : ''}
    ${qas.length ? qas.map(q=>{
      const qc = q.verdict==='PASS' ? '#22C55E' : '#EF4444';
      const finds = Array.isArray(q.findings)?q.findings:[];
      return `<div style="margin-top:10px;background:${qc}0d;border:1px solid ${qc}55;border-radius:8px;padding:9px 12px;font-size:12px">
        <strong style="color:${qc}">🧪 QA ${agEsc(q.agent_code)}: ${agEsc(q.verdict)} · skor ${q.score}/100</strong>
        ${finds.length?`<ul style="margin:4px 0 0 16px;color:var(--text-dim)">${finds.slice(0,6).map(f=>`<li>${agEsc(f)}</li>`).join('')}</ul>`:''}
        ${q.notes?`<div style="color:var(--text-dim);margin-top:3px"><em>Saran: ${agEsc(q.notes)}</em></div>`:''}
      </div>`;}).join('') : ''}

    ${md ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:800;color:var(--navy-deep);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Preview Draft</div><div class="ag-md">${typeof agMd === 'function' ? agMd(md) : agEsc(md)}</div></div>`
        : (t.result ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:800;color:var(--navy-deep);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Hasil</div><pre class="ag-md" style="white-space:pre-wrap">${agEsc(JSON.stringify(t.result,null,2)).slice(0,4000)}</pre></div>` : '')}

    <div class="ag-actions">${actions}</div>

    ${t.status==='APPROVED' ? `<div style="margin-top:10px;background:#ECFDF5;border:1px solid #86EFAC;border-radius:8px;padding:9px 12px;font-size:12px;color:#065F46">
        <strong>Langkah terakhir:</strong> klik <strong>Publish</strong> di atas.
        ${t.agent==='DOCUMENT' ? 'Dokumen akan dapat nomor resmi & tampil di <strong>Dokumen QMS</strong> + <strong>Wiki → Dokumen Resmi</strong>.'
          : 'Aset (caption + gambar) akan siap diunduh di <strong>Content Studio → Aset Konten</strong> dan slot kalender jadi READY.'}</div>` : ''}
    ${t.status==='PUBLISHED' ? `<div style="margin-top:10px;background:#EFF6FF;border:1px solid #93C5FD;border-radius:8px;padding:9px 12px;font-size:12px;color:#1E40AF">
        <strong>📍 Konten ini sudah terbit. Hasilnya ada di:</strong><br>
        ${t.agent==='DOCUMENT'
          ? `• Tab <a href="javascript:switchAgenticTab('docs')" style="font-weight:700">Dokumen QMS</a> (registry + nomor resmi & jadwal review)<br>
             • Menu <a href="javascript:navigate('wiki',{tab:'docs'})" style="font-weight:700">Wiki OneLab → Dokumen Resmi</a> (bisa unduh .docx)`
          : `• Tab <a href="javascript:switchAgenticTab('studio')" style="font-weight:700">Content Studio → Aset Konten</a> (salin caption / lihat gambar / unduh)<br>
             • Slot kalendernya berstatus <strong>READY</strong> — siap diposting manual ke ${agEsc((t.payload&&t.payload.channel)||'channel')}`}
        <br>• Tombol <strong>.md</strong> / <strong>.docx</strong> di atas untuk arsip file</div>` : ''}

    <div style="margin-top:14px">
      <div style="font-size:11px;font-weight:800;color:var(--navy-deep);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Audit Trail</div>
      ${events.length ? events.map(e=>`<div class="ag-ev">
          <strong>${agEsc(e.from_status||'∅')} → ${agEsc(e.to_status)}</strong>
          · ${agEsc(e.actor_type)} · ${new Date(e.created_at).toLocaleString('id-ID')}
          ${e.note?`<br><span style="color:var(--text3)">${agEsc(e.note)}</span>`:''}
        </div>`).join('') : '<div class="ag-ev">Belum ada event.</div>'}
    </div>`;
}

// ── Aksi approval (Fase 1 §7) ────────────────────────────────────
async function agActApprove(id){
  try{
    const r = await agRpc('agentic_approve', { p_task_id:id });
    toast(r && r.status==='IN_MEDICAL_REVIEW' ? '🩺 Diteruskan ke review medis' : '✅ Disetujui — siap publish','ok');
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}
async function agActReject(id){
  const fb = prompt('Feedback penolakan (wajib — dipakai AI sebagai konteks perbaikan):');
  if(fb===null) return;
  if(!fb.trim()){ toast('Feedback wajib diisi','warn'); return; }
  try{
    await agRpc('agentic_reject', { p_task_id:id, p_feedback:fb.trim() });
    toast('↩ Ditolak — task antri ulang dengan feedback','ok');
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}
async function agActRetry(id){
  try{ await agRpc('agentic_retry', { p_task_id:id }); toast('🔁 Task antri ulang','ok'); await agReload(); }
  catch(e){ toast(e.message,'err'); }
}
async function agActCancel(id){
  if(!confirm('Batalkan task ini?')) return;
  try{ await agRpc('agentic_cancel', { p_task_id:id }); toast('Task dibatalkan','ok'); await agReload(); }
  catch(e){ toast(e.message,'err'); }
}
async function agActPublish(id){
  const t = agTasks.find(x=>x.id===id);
  if(!confirm(`Publish "${t?t.title:''}"?\nDokumen akan mendapat nomor resmi & masuk registry.`)) return;
  try{
    const r = await agRpc('agentic_publish', { p_task_id:id });
    toast(`🚀 Published${r&&r.doc_number?` · No. ${r.doc_number} → lihat Dokumen QMS / Wiki`:' → aset di Content Studio'}`,'ok');
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}
function agDownloadMd(id){
  const t = agTasks.find(x=>x.id===id); if(!t) return;
  const md = (t.result&&(t.result.markdown||t.result.text))||'';
  const name = (t.title||'draft').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')+'.md';
  const blob = new Blob([md],{type:'text/markdown;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
}

// Buat gambar utk konten yang sudah jadi (susulan) — caption tidak berubah.
// Alur: image_prompt dari result.copy → llm-gateway mode:image (NVIDIA,
// auto-translate) → upload Storage agentic/renders → content_assets IMAGE.
async function agGenImageForTask(id){
  const t = agTasks.find(x=>x.id===id); if(!t) return;
  const btn = document.getElementById(`ag-genimg-${id}`);
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Membuat gambar…'; }
  try{
    const copy = (t.result && t.result.copy) || {};
    const topic = (t.payload && t.payload.topic) || t.title || 'layanan laboratorium klinik';
    const prompt = copy.image_prompt ||
      `clean modern healthcare flyer visual about "${topic}", teal and navy OneLab branding, laboratory equipment or abstract medical shapes, soft lighting, no people, no text`;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/llm-gateway`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ mode:'image', prompt, taskId:id }),
    });
    const d = await res.json().catch(()=>({}));
    if(!res.ok || !Array.isArray(d.images) || !d.images[0])
      throw new Error(d.error || `Gagal generate (HTTP ${res.status})`);

    // upload dataUri → Storage bucket agentic
    const [meta,b64] = String(d.images[0]).split(',');
    const mime = (meta.match(/data:([^;]+)/)||[])[1] || 'image/png';
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    const path = `renders/${id}_${Date.now()}.png`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/agentic/${path}`, {
      method:'POST',
      headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, 'Content-Type': mime },
      body: arr,
    });
    if(!up.ok) throw new Error('Upload Storage gagal — pastikan bucket "agentic" ada (supabase_agentic_fase12.sql)');

    await agRpc('agentic_asset_add', { p:{
      task_id:id, calendar_id:(t.payload && t.payload.calendar_id) || null,
      asset_type:'IMAGE', file_path:path,
      meta:{ prompt, provider:d.provider, model:d.model, susulan:true } }});

    toast(`🖼 Gambar jadi (${d.provider}/${(d.model||'').split('/').pop()}, ${Math.round((d.latencyMs||0)/1000)}s) → lihat di Content Studio → Aset`, 'ok');
    if(btn){ btn.outerHTML = `<a class="ag-btn mut" style="text-decoration:none" target="_blank"
      href="${SUPABASE_URL}/storage/v1/object/public/agentic/${path}">${svgIcon('eye',13)} Lihat Gambar</a>`; }
  }catch(e){
    toast(e.message,'err');
    if(btn){ btn.disabled = false; btn.innerHTML = `${svgIcon('image',13)} Buat Gambar`; }
  }
}

// ── MONITOR TAB (queue + LLM usage §7 /monitor + hardening Fase 4) ──
async function renderAgMonitorTab(el){
  await agLoadLlm();
  let m7 = null;
  try{ m7 = await agRpc('agentic_monitor_7d', {}); }catch(e){}
  const q = s => agTasks.filter(t=>t.status===s).length;
  const prov = {};
  agLlmLogs.forEach(l=>{ const k=`${l.provider}/${l.model}`; prov[k]=(prov[k]||0)+1; });
  const llm7 = (m7&&m7.llm_7d)||[];
  const tokIn = llm7.reduce((a,r)=>a+(r.tokens_in||0),0);
  const tokOut = llm7.reduce((a,r)=>a+(r.tokens_out||0),0);
  const err7 = llm7.reduce((a,r)=>a+(r.errors||0),0);
  const failed = (m7&&m7.failed_open)||[];

  // task PROCESSING dgn durasi (deteksi macet)
  const processing = agTasks.filter(t=>t.status==='PROCESSING')
    .map(t=>({...t, mins: Math.floor((Date.now()-new Date(t.updated_at).getTime())/60000)}));
  const stuckN = processing.filter(p=>p.mins>=3).length;

  el.innerHTML = `
    <div class="ag-detail" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:12px;font-weight:800;color:var(--navy-deep)">🩺 Kesehatan Sistem AI</div>
          <div style="font-size:11px;color:var(--gray)">Tes semua provider × key × model (bisa ±1 menit — model besar lambat) dan bebaskan task yang macet</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="ag-btn pub" id="ag-diag-btn" onclick="agRunDiag()">${svgIcon('sparkle',13)} Tes Koneksi AI</button>
          <button class="ag-btn ${stuckN?'warn':'mut'}" onclick="agReapStuck()">${svgIcon('refresh',13)} Bebaskan Task Macet${stuckN?` (${stuckN})`:''}</button>
        </div>
      </div>
      ${processing.length?`<div style="margin-top:10px">
        ${processing.map(p=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed #e2e8f0">
          <span>⏳ ${agEsc(p.title)} <span style="color:var(--gray)">(${agEsc(p.task_type)})</span></span>
          <strong style="color:${p.mins>=3?'#EF4444':'#0EA5E9'}">${p.mins} menit${p.mins>=3?' — macet?':''}</strong>
        </div>`).join('')}</div>`:''}
      <div id="ag-diag-out" style="margin-top:10px"></div>
    </div>
    ${m7?`<div class="pro-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px">
      ${[[llm7.reduce((a,r)=>a+(r.n||0),0),'Panggilan LLM (7 hari)','#0EA5E9'],
         [tokIn.toLocaleString('id-ID'),'Token Masuk (7 hari)','#0A2342'],
         [tokOut.toLocaleString('id-ID'),'Token Keluar (7 hari)','#0A2342'],
         [err7,'Error LLM (7 hari)', err7?'#EF4444':'#22C55E'],
         [failed.length,'Task FAILED terbuka', failed.length?'#EF4444':'#22C55E']]
        .map(([v,l,c])=>`<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid ${c};border-radius:8px;padding:8px 10px">
          <div style="font-size:17px;font-weight:800;color:${c}">${v}</div>
          <div style="font-size:10px;color:var(--gray)">${l}</div></div>`).join('')}
    </div>`:''}
    ${failed.length?`<div class="ag-detail" style="margin-bottom:12px;border-left:4px solid #EF4444">
      <div style="font-size:12px;font-weight:800;color:var(--danger-deep);margin-bottom:6px">Task Gagal — perlu perhatian</div>
      ${failed.slice(0,8).map(f=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:5px 0;border-bottom:1px dashed #fecaca;align-items:center">
        <div style="min-width:0"><strong>${agEsc(f.title)}</strong><br><span style="color:var(--text3);font-size:11px">${agEsc(f.error||'')}</span></div>
        <button class="ag-btn warn" style="padding:4px 10px" onclick="agActRetry('${f.id}')">${svgIcon('refresh',12)} Retry</button>
      </div>`).join('')}
    </div>`:''}`;

  el.innerHTML += `
    <div class="pro-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
      <div class="ag-detail">
        <div style="font-size:12px;font-weight:800;color:var(--navy-deep);margin-bottom:8px">Kedalaman Antrian</div>
        ${Object.keys(AG_STATUS_META).map(s=>{
          const n=q(s); if(!n) return '';
          return `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;border-bottom:1px dashed #e2e8f0">
            <span>${agChip(s)}</span><strong>${n}</strong></div>`;}).join('') || '<span style="font-size:12px;color:var(--gray)">Kosong</span>'}
      </div>
      <div class="ag-detail">
        <div style="font-size:12px;font-weight:800;color:var(--navy-deep);margin-bottom:8px">LLM per Provider/Model (100 terakhir)</div>
        ${Object.entries(prov).map(([k,n])=>`<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;border-bottom:1px dashed #e2e8f0">
          <span>${agEsc(k)}</span><strong>${n}</strong></div>`).join('') || '<span style="font-size:12px;color:var(--gray)">Belum ada panggilan LLM</span>'}
      </div>
    </div>
    <div class="ag-detail" style="margin-top:12px">
      <div style="font-size:12px;font-weight:800;color:var(--navy-deep);margin-bottom:8px">Log LLM Terakhir</div>
      <div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Waktu</th><th>Provider</th><th>Model</th><th>Key</th><th>Status</th><th>Latensi</th><th>Token in/out</th></tr></thead>
        <tbody>${agLlmLogs.slice(0,40).map(l=>`<tr>
          <td>${new Date(l.created_at).toLocaleString('id-ID')}</td>
          <td>${agEsc(l.provider)}</td><td>${agEsc(l.model)}</td><td>${agEsc(l.key_alias||'—')}</td>
          <td>${agEsc(l.status)}</td><td>${l.latency_ms!=null?l.latency_ms+'ms':'—'}</td>
          <td>${l.input_tokens!=null?l.input_tokens:'—'}/${l.output_tokens!=null?l.output_tokens:'—'}</td>
        </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--gray)">Belum ada log</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

// ── DIAGNOSTIK AI (Fase 5): tes provider×key×model via llm-gateway ──
async function agRunDiag(){
  const btn = document.getElementById('ag-diag-btn');
  const out = document.getElementById('ag-diag-out');
  if(btn){ btn.disabled = true; btn.textContent = 'Menguji semua jalur…'; }
  if(out) out.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  try{
    const res = await fetch(`${SUPABASE_URL}/functions/v1/llm-gateway`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ diag:true }),
    });
    const d = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(d.error || `llm-gateway HTTP ${res.status} — pastikan llm-gateway versi terbaru sudah di-deploy`);
    if(!d.diag) throw new Error('Gateway versi lama (belum ada mode diag) — re-deploy supabase/functions/llm-gateway/index.ts');

    if(out) out.innerHTML = `
      ${(d.verdicts||[]).map(v=>`<div style="font-size:12.5px;font-weight:700;padding:7px 10px;border-radius:8px;margin-bottom:6px;
        background:${v.startsWith('✅')?'#F0FDF4':v.startsWith('❌')?'#FEF2F2':v.startsWith('⚠')?'#FEF3C7':'#EFF6FF'};
        border:1px solid ${v.startsWith('✅')?'#86EFAC':v.startsWith('❌')?'#FCA5A5':v.startsWith('⚠')?'#F59E0B':'#93C5FD'}">${agEsc(v)}</div>`).join('')}
      <div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
        <thead><tr><th>Provider</th><th>Key</th><th>Model</th><th>Status</th><th>Latensi</th><th>Keterangan</th></tr></thead>
        <tbody>${(d.results||[]).map(r=>`<tr>
          <td>${agEsc(r.provider)}</td><td>${agEsc(r.key_alias)}</td><td>${agEsc(r.model)}</td>
          <td style="font-weight:800;color:${r.ok?'#22C55E':'#EF4444'}">${r.ok?'✅ OK':'❌ GAGAL'}</td>
          <td>${r.latency_ms!=null?r.latency_ms+'ms':'—'}</td>
          <td style="max-width:340px">${agEsc(r.msg||'')}</td>
        </tr>`).join('')}</tbody></table></div>`;
  }catch(e){
    if(out) out.innerHTML = `<div style="font-size:12px;color:var(--danger-deep);background:var(--danger-soft);border:1px solid #FCA5A5;border-radius:8px;padding:9px 12px">${agEsc(e.message)}</div>`;
  }
  if(btn){ btn.disabled = false; btn.innerHTML = `${svgIcon('sparkle',13)} Tes Koneksi AI`; }
}

// Bebaskan task PROCESSING yang macet ≥3 menit → antri ulang / FAILED
async function agReapStuck(){
  try{
    const r = await agRpc('agentic_reap', { p_minutes: 3 });
    const n = (r && r.reaped) || 0;
    toast(n ? `♻ ${n} task macet dibebaskan (antri ulang / FAILED sesuai budget)` :
      'Tidak ada task macet ≥3 menit', n?'ok':'info');
    await agReload();
  }catch(e){
    toast(e.message.includes('agentic_reap') ?
      'Jalankan supabase_agentic_fase5.sql dulu (fungsi agentic_reap belum ada)' : e.message, 'err');
  }
}

window.renderAgInboxTab = renderAgInboxTab;
