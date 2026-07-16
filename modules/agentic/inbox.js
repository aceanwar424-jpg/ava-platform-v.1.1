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
              <strong style="font-size:12.5px;color:#0A2342;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${agEsc(t.title)}</strong>
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

  let events = [];
  try{ events = await sbGet('agentic_task_events_v', `task_id=eq.${id}&select=*&order=created_at.asc`) || []; }catch(e){}

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
  if(md) actions += `<button class="ag-btn mut" onclick="agDownloadMd('${t.id}')">${svgIcon('download',13)} Unduh .md</button>`;

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
      <div>
        <div style="font-size:15px;font-weight:800;color:#0A2342">${agEsc(t.title)}</div>
        <div style="font-size:11px;color:var(--gray);margin-top:3px">
          ${agEsc(t.agent)} · ${agEsc(t.task_type)} · attempt ${t.attempts||0}/${t.max_attempts||3}
          · dibuat ${agAgo(t.created_at)} ${t.needs_medical_review?' · 🩺 wajib review medis':''}
        </div>
      </div>
      ${agChip(t.status)}
    </div>

    ${t.error_message ? `<div style="margin-top:10px;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:9px 12px;font-size:12px;color:#B91C1C"><strong>Error:</strong> ${agEsc(t.error_message)}</div>` : ''}
    ${t.payload && t.payload.rejection_feedback ? `<div style="margin-top:10px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:9px 12px;font-size:12px;color:#9A3412"><strong>Feedback penolakan terakhir:</strong> ${agEsc(t.payload.rejection_feedback)}</div>` : ''}
    ${placeholders ? `<div style="margin-top:10px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:9px 12px;font-size:12px;color:#92400E"><strong>⚠ ${placeholders} nilai butuh konfirmasi operator</strong> — periksa tanda KONFIRMASI di draft sebelum approve (kebijakan §9.3: AI dilarang mengarang angka klinis/nama/harga).</div>` : ''}

    ${md ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:800;color:#0A2342;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Preview Draft</div><div class="ag-md">${agMd(md)}</div></div>`
        : (t.result ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:800;color:#0A2342;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Hasil</div><pre class="ag-md" style="white-space:pre-wrap">${agEsc(JSON.stringify(t.result,null,2)).slice(0,4000)}</pre></div>` : '')}

    <div class="ag-actions">${actions}</div>

    <div style="margin-top:14px">
      <div style="font-size:11px;font-weight:800;color:#0A2342;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Audit Trail</div>
      ${events.length ? events.map(e=>`<div class="ag-ev">
          <strong>${agEsc(e.from_status||'∅')} → ${agEsc(e.to_status)}</strong>
          · ${agEsc(e.actor_type)} · ${new Date(e.created_at).toLocaleString('id-ID')}
          ${e.note?`<br><span style="color:#64748B">${agEsc(e.note)}</span>`:''}
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
    toast(`🚀 Published${r&&r.doc_number?` · No. ${r.doc_number}`:''}`,'ok');
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

// ── MONITOR TAB (queue + LLM usage §7 /monitor) ──────────────────
async function renderAgMonitorTab(el){
  await agLoadLlm();
  const q = s => agTasks.filter(t=>t.status===s).length;
  const prov = {};
  agLlmLogs.forEach(l=>{ const k=`${l.provider}/${l.model}`; prov[k]=(prov[k]||0)+1; });

  el.innerHTML = `
    <div class="pro-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
      <div class="ag-detail">
        <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">Kedalaman Antrian</div>
        ${Object.keys(AG_STATUS_META).map(s=>{
          const n=q(s); if(!n) return '';
          return `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;border-bottom:1px dashed #e2e8f0">
            <span>${agChip(s)}</span><strong>${n}</strong></div>`;}).join('') || '<span style="font-size:12px;color:var(--gray)">Kosong</span>'}
      </div>
      <div class="ag-detail">
        <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">LLM per Provider/Model (100 terakhir)</div>
        ${Object.entries(prov).map(([k,n])=>`<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;border-bottom:1px dashed #e2e8f0">
          <span>${agEsc(k)}</span><strong>${n}</strong></div>`).join('') || '<span style="font-size:12px;color:var(--gray)">Belum ada panggilan LLM</span>'}
      </div>
    </div>
    <div class="ag-detail" style="margin-top:12px">
      <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">Log LLM Terakhir</div>
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
