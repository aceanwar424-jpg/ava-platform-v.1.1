// ═══════════════════════════════════════════════════════════════
// AGENTIC — CONTENT STUDIO (Fase 3 · spec §5.2)
// Kalender konten → planner mingguan AI → produksi (copy+gambar) →
// Approval Inbox → PUBLISHED → slot READY (download aset di sini).
// ═══════════════════════════════════════════════════════════════

let agCalendar = [], agAssets = [], agHealthDays = [];

const AG_CAL_STATUS = {
  PLANNED:'#64748B', IN_PRODUCTION:'#0EA5E9', READY:'#22C55E',
  PUBLISHED:'#0A2342', SKIPPED:'#94A3B8',
};
const AG_CT_META = {
  SOSMED_POST:     {ic:'image',  l:'Post Sosmed'},
  SOSMED_CAROUSEL: {ic:'image',  l:'Carousel'},
  ARTIKEL:         {ic:'note',   l:'Artikel'},
  PPTX_DOKTER:     {ic:'book',   l:'PPT Dokter'},
  EVENT:           {ic:'heart',  l:'Event'},
  FLYER:           {ic:'image',  l:'Flyer'},
};

async function agLoadCalendar(){
  try{ agCalendar = await sbGet('agentic_calendar_v',
    `select=*&target_date=gte.${new Date(Date.now()-7*864e5).toISOString().slice(0,10)}&order=target_date.asc&limit=300`) || []; }
  catch(e){ agCalendar = []; }
}
async function agLoadAssets(){
  try{ agAssets = await sbGet('agentic_assets_v','select=*&order=created_at.desc&limit=100') || []; }
  catch(e){ agAssets = []; }
}
async function agLoadHealthDays(){
  try{ agHealthDays = await sbGet('agentic_health_days_v','select=*&order=month.asc,day.asc') || []; }
  catch(e){ agHealthDays = []; }
}

// ── TAB CONTENT STUDIO ───────────────────────────────────────────
async function renderAgStudioTab(el){
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  await Promise.all([agLoadCalendar(), agLoadAssets(), agLoadHealthDays()]);

  // slot dikelompokkan per tanggal
  const byDate = {};
  agCalendar.forEach(c=>{ (byDate[c.target_date] = byDate[c.target_date]||[]).push(c); });
  const dates = Object.keys(byDate).sort();
  const today = new Date().toISOString().slice(0,10);

  // hari kesehatan 30 hari ke depan
  const upcoming = [];
  const now = new Date();
  for(const h of agHealthDays){
    const d = new Date(now.getFullYear(), h.month-1, h.day);
    const diff = (d - now)/864e5;
    if(diff >= -1 && diff <= 30) upcoming.push({...h, date: d.toISOString().slice(0,10)});
  }

  el.innerHTML = `
    <div class="pro-grid" style="grid-template-columns:1fr 300px;gap:12px;align-items:start">
    <div>
      <div class="ag-detail" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:12px;font-weight:800;color:#0A2342">Kalender Konten</div>
            <div style="font-size:11px;color:var(--gray)">Planner AI mengisi slot; produksi H-4 otomatis; hasil menunggu di Approval Inbox</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="ag-btn pub" onclick="agRunPlanner()">${svgIcon('sparkle',13)} Jalankan Planner Mingguan</button>
            <button class="ag-btn mut" onclick="agOpenSlotForm()">${svgIcon('plus',13)} Slot Manual</button>
          </div>
        </div>
      </div>

      ${dates.length ? dates.map(dt=>`
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:800;color:${dt===today?'#0EA5E9':'#0A2342'};margin:0 0 6px 2px">
            ${dt===today?'📍 HARI INI · ':''}${new Date(dt+'T00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}
          </div>
          ${byDate[dt].map(c=>{
            const m = AG_CT_META[c.content_type]||{ic:'note',l:c.content_type};
            const sc = AG_CAL_STATUS[c.status]||'#64748B';
            const producible = ['PLANNED','SKIPPED'].includes(c.status);
            return `<div class="ag-detail" style="padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
              <div style="min-width:0">
                <div style="font-size:12.5px;font-weight:700;color:#0A2342">${svgIcon(m.ic,12)} ${agEsc(c.topic)}</div>
                <div style="font-size:10.5px;color:var(--gray);margin-top:2px">
                  ${m.l} · ${agEsc(c.channel||'—')} · ${agEsc(c.framework||'')}
                  ${c.health_day_ref?` · 📅 ${agEsc(c.health_day_ref)}`:''}
                  ${c.source==='PLANNER_AI'?' · ✨AI':c.source==='MANUAL'?' · ✍️manual':''}
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span class="ag-badge" style="background:${sc}18;color:${sc};border:1px solid ${sc}55">${c.status}</span>
                ${producible?`<button class="ag-btn ok" style="padding:5px 10px" onclick="agProduceSlot('${c.id}')">${svgIcon('sparkle',12)} Produksi</button>`:''}
                ${c.status==='PLANNED'?`<button class="ag-btn mut" style="padding:5px 8px" title="Lewati" onclick="agSkipSlot('${c.id}')">✕</button>`:''}
              </div>
            </div>`;}).join('')}
        </div>`).join('')
      : `<div class="ag-detail" style="text-align:center;color:var(--gray);font-size:12.5px;padding:26px">
          Kalender kosong. Klik <strong>Jalankan Planner Mingguan</strong> agar AI mengusulkan slot konten,
          atau tambah <strong>Slot Manual</strong>.</div>`}

      <div class="ag-detail" style="margin-top:12px">
        <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">${svgIcon('box',14)} Aset Konten Terakhir</div>
        ${agAssets.length ? `<div style="overflow-x:auto"><table class="pro-table" style="width:100%;font-size:11.5px">
          <thead><tr><th>Waktu</th><th>Jenis</th><th>Isi</th><th></th></tr></thead>
          <tbody>${agAssets.slice(0,20).map(a=>`<tr>
            <td style="white-space:nowrap">${new Date(a.created_at).toLocaleString('id-ID')}</td>
            <td>${agEsc(a.asset_type)}</td>
            <td style="max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${agEsc((a.text_content||a.file_path||'').slice(0,120))}</td>
            <td style="white-space:nowrap">
              ${a.file_path?`<a class="ag-btn mut" style="padding:4px 9px;text-decoration:none" target="_blank" href="${SUPABASE_URL}/storage/v1/object/public/agentic/${agEsc(a.file_path)}">${svgIcon('eye',12)} Lihat</a>`:''}
              ${a.text_content?`<button class="ag-btn mut" style="padding:4px 9px" onclick="agCopyAsset('${a.id}')">📋 Salin</button>`:''}
            </td></tr>`).join('')}</tbody></table></div>`
        : '<div style="font-size:12px;color:var(--gray)">Belum ada aset — aset muncul setelah task MAKE_* selesai diproses worker.</div>'}
      </div>
    </div>

    <div>
      <div class="ag-detail" style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:8px">📅 Hari Kesehatan 30 Hari ke Depan</div>
        ${upcoming.length ? upcoming.map(h=>`<div style="font-size:11.5px;padding:5px 0;border-bottom:1px dashed #e2e8f0">
            <strong>${new Date(h.date+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</strong>
            · ${agEsc(h.name)} <span style="color:var(--gray)">(${h.scope==='NASIONAL'?'🇮🇩':'🌍'})</span>
          </div>`).join('')
        : '<div style="font-size:11.5px;color:var(--gray)">Tidak ada dalam 30 hari — atau jalankan supabase_agentic_fase34.sql (seed).</div>'}
      </div>
      <div class="ag-detail">
        <div style="font-size:12px;font-weight:800;color:#0A2342;margin-bottom:6px">Alur Konten</div>
        <div style="font-size:11.5px;color:#475569;line-height:1.7">
          1. Planner AI / manual mengisi <strong>kalender</strong><br>
          2. <strong>Produksi</strong> → AI membuat copy + gambar<br>
          3. Draft menunggu di <strong>Approval Inbox</strong><br>
          4. Artikel & PPT dokter lewat <strong>review medis</strong> 🩺<br>
          5. Publish → slot <strong>READY</strong>, aset siap diunduh<br>
          <em style="color:var(--gray)">Auto-posting IG/Meta = fase berikutnya (§5.2)</em>
        </div>
      </div>
    </div>
    </div>`;
}

// ── Aksi ─────────────────────────────────────────────────────────
async function agRunPlanner(){
  try{
    await agRpc('agentic_create_task', {
      p_agent:'CONTENT', p_task_type:'PLAN_WEEKLY',
      p_title:'Perencanaan konten mingguan', p_payload:{ posts_per_week:3, articles_per_week:1 },
    });
    toast('Task planner dibuat — menjalankan worker…','ok');
    await agRunWorker(2);
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}
async function agProduceSlot(id){
  try{
    await agRpc('agentic_produce_slot', { p_calendar_id:id });
    toast('Task produksi dibuat — menjalankan worker…','ok');
    await agRunWorker(2);
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}
async function agSkipSlot(id){
  try{ await agRpc('agentic_calendar_set_status', { p_id:id, p_status:'SKIPPED' }); agRenderTab(); }
  catch(e){ toast(e.message,'err'); }
}
function agCopyAsset(id){
  const a = agAssets.find(x=>x.id===id); if(!a||!a.text_content) return;
  navigator.clipboard?.writeText(a.text_content).then(()=>toast('📋 Disalin','ok')).catch(()=>toast('Gagal menyalin','err'));
}

// Form slot manual
function agOpenSlotForm(){
  const d = new Date(Date.now()+3*864e5).toISOString().slice(0,10);
  openModal(`
    <div style="max-width:460px">
      <h3 style="margin:0 0 12px;color:#0A2342">Slot Konten Manual</h3>
      <div style="display:grid;gap:9px">
        <label style="font-size:11.5px;font-weight:700;color:#334155">Jenis
          <select id="agsf-type" class="form-input" style="width:100%">
            ${Object.entries(AG_CT_META).map(([k,m])=>`<option value="${k}">${m.l}</option>`).join('')}
          </select></label>
        <label style="font-size:11.5px;font-weight:700;color:#334155">Topik
          <input id="agsf-topic" class="form-input" style="width:100%" placeholder="cth: Kenali gejala diabetes sejak dini"></label>
        <label style="font-size:11.5px;font-weight:700;color:#334155">Angle / Brief (opsional)
          <textarea id="agsf-angle" class="form-input" style="width:100%" rows="2"></textarea></label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <label style="font-size:11.5px;font-weight:700;color:#334155">Tanggal
            <input id="agsf-date" type="date" class="form-input" style="width:100%" value="${d}"></label>
          <label style="font-size:11.5px;font-weight:700;color:#334155">Channel
            <select id="agsf-channel" class="form-input" style="width:100%">
              <option>IG</option><option>LINKEDIN</option><option>WEB</option><option>WHATSAPP</option><option>OFFLINE</option>
            </select></label>
          <label style="font-size:11.5px;font-weight:700;color:#334155">Framework
            <select id="agsf-fw" class="form-input" style="width:100%">
              <option>PAS</option><option>AIDA</option><option>EDU</option>
            </select></label>
        </div>
        <label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#334155">
          <input type="checkbox" id="agsf-produce" checked> Langsung produksi sekarang (AI membuat draft)
        </label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="ag-btn mut" onclick="closeModal()">Batal</button>
        <button class="ag-btn pub" onclick="agSaveSlot()">${svgIcon('check',13)} Simpan Slot</button>
      </div>
    </div>`);
}
async function agSaveSlot(){
  const topic = (document.getElementById('agsf-topic')||{}).value||'';
  if(!topic.trim()){ toast('Topik wajib diisi','warn'); return; }
  const produceNow = !!(document.getElementById('agsf-produce')||{}).checked;
  try{
    const row = await agRpc('agentic_calendar_add', { p:{
      content_type:(document.getElementById('agsf-type')||{}).value,
      topic: topic.trim(),
      angle:(document.getElementById('agsf-angle')||{}).value||null,
      target_date:(document.getElementById('agsf-date')||{}).value,
      channel:(document.getElementById('agsf-channel')||{}).value,
      framework:(document.getElementById('agsf-fw')||{}).value,
    }});
    closeModal();
    if(produceNow && row && row.id){
      await agRpc('agentic_produce_slot', { p_calendar_id: row.id });
      toast('Slot dibuat + task produksi jalan…','ok');
      try{ await agRunWorker(2); }catch(e){}
    } else toast('Slot kalender dibuat','ok');
    await agReload();
  }catch(e){ toast(e.message,'err'); }
}
