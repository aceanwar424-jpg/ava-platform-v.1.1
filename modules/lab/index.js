// ═══════════════════════════════════════════════════════════════
// MODULE: Laboratory Information System (LIS) — CORE / SHELL
// ---------------------------------------------------------------
// File ini memuat state bersama, shell halaman (header + tabs),
// KPI, loader data, banner nilai kritis, dan helper yang dipakai
// oleh sub-modul lab lainnya:
//   lab/checkin.js     · Penerimaan & registrasi sampel (barcode)
//   lab/worklist.js    · Worklist per-analyzer + monitoring TAT
//   lab/results.js     · Input hasil + auto-interpretasi ref range
//   lab/validation.js  · Validasi teknis & approval klinis
//   lab/report.js      · Rekam medis lab, cumulative report, cetak
//   lab/qc.js          · Quality Control & manajemen analyzer
// ═══════════════════════════════════════════════════════════════

const LAB_TABS = ['checkin','worklist','result','validation','approval','report','qc'];

// State bersama (dibaca/ditulis lintas sub-modul)
let labSamples  = [];
let labResults  = [];
let _rrCache    = {};   // cache ref_ranges per product_id
let _prodCache  = null; // cache master products (untuk TAT target & dropdown)

// Peta warna interpretasi (green/yellow/orange/red)
const LAB_COLORS = { green:'#22C55E', yellow:'#F59E0B', orange:'#F97316', red:'#EF4444', gray:'#94A3B8' };
function labColor(code){ return LAB_COLORS[code] || LAB_COLORS.gray; }
function labUser(){ return (typeof getUserName==='function') ? getUserName() : 'User'; }

// ── Master produk (dipakai untuk target TAT & interpretasi) ──────
async function loadLabProducts(){
  if (_prodCache) return _prodCache;
  try {
    _prodCache = await sbGet('products',
      'select=id,nama_tes,kode_internal,kategori,satuan_hasil,sampel_type,waktu_tat_jam,is_panel,host_code,is_active&is_active=eq.true&order=kategori,nama_tes') || [];
  } catch(e){ _prodCache = []; }
  return _prodCache;
}
function labProduct(id){ return (_prodCache||[]).find(p=>p.id==id) || null; }

// ── Turnaround Time (TAT) ────────────────────────────────────────
// Target jam diambil dari master produk (waktu_tat_jam), fallback 4 jam.
function tatTargetHours(row){
  const p = labProduct(row.product_id);
  return (p && p.waktu_tat_jam) ? p.waktu_tat_jam : 4;
}
function minutesSince(iso){
  if(!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime())/60000));
}
// Status TAT sebuah sampel/hasil relatif ke waktu terima (received_at/collected_at)
function tatStatus(row){
  const start = row.received_at || row.collected_at || row.created_at;
  const elapsed = minutesSince(start);
  const targetMin = tatTargetHours(row) * 60;
  if (elapsed === null) return { elapsed:0, targetMin, overdue:false, pct:0, label:'—' };
  const pct = Math.min(100, Math.round(elapsed/targetMin*100));
  const overdue = elapsed > targetMin;
  const h = Math.floor(elapsed/60), m = elapsed%60;
  return { elapsed, targetMin, overdue, pct, label:`${h?h+'j ':''}${m}m` };
}
function tatBadge(row){
  const t = tatStatus(row);
  const color = t.overdue ? '#EF4444' : (t.pct>75 ? '#F59E0B' : '#22C55E');
  const icon  = t.overdue ? '⏰' : '⏱';
  return `<span title="Target ${tatTargetHours(row)} jam" style="display:inline-flex;align-items:center;gap:4px;
    background:${color}15;color:${color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">
    ${icon} ${t.label}${t.overdue?' · TELAT':''}</span>`;
}

// ── Deteksi nilai kritis ─────────────────────────────────────────
// Kritis bila is_critical=true, atau color_code merah, atau nilai numerik
// keluar dari batas critical_low/high yang tersimpan di hasil.
function isCriticalResult(r){
  if (r.is_critical === true) return true;
  if ((r.color_code||'') === 'red' && r.condition_type !== 'normal') return true;
  const v = (r.result_numeric!=null) ? r.result_numeric : parseFloat(r.result_value);
  if (!isNaN(v)) {
    if (r.critical_low  != null && v <= r.critical_low)  return true;
    if (r.critical_high != null && v >= r.critical_high) return true;
  }
  return false;
}
function isReleased(r){ return r.status==='Approved' || r.status==='Released'; }

// ── Ref ranges loader (dipakai results.js & worklist.js) ─────────
async function labLoadRR(productId){
  if(!productId) return [];
  if(_rrCache[productId]) return _rrCache[productId];
  try {
    _rrCache[productId] = await sbGet('ref_ranges',
      `select=*&product_id=eq.${productId}&order=range_min.asc`) || [];
  } catch(e){ _rrCache[productId] = []; }
  return _rrCache[productId];
}
// Cari ref range yang cocok untuk sebuah nilai (numerik ATAU teks/kualitatif),
// dengan opsi filter gender & umur. rawVal boleh angka atau teks (Positif/Negatif).
function matchRefRange(rrs, rawVal, gender, age){
  const cand = (rrs||[]).filter(rr=>{
    const gOk = !rr.gender || rr.gender==='All' || !gender || rr.gender===gender;
    const aOk = age==null || ((rr.age_min==null||age>=rr.age_min) && (rr.age_max==null||age<=rr.age_max));
    return gOk && aOk;
  });
  const num = parseFloat(rawVal);
  const txt = String(rawVal==null?'':rawVal).trim().toLowerCase();

  // 1) Numerik — cocokkan ke rentang (abaikan baris kualitatif & baris tanpa rentang)
  if(!isNaN(num) && txt!==''){
    const m = cand.find(rr=> rr.value_type!=='qualitative'
      && !(rr.range_min==null && rr.range_max==null)
      && (rr.range_min==null||num>=rr.range_min)
      && (rr.range_max==null||num<=rr.range_max));
    if(m) return m;
  }
  // 2) Kualitatif/teks — cocokkan ke daftar expected_values (mis. "Negatif,Neg")
  if(txt){
    const m = cand.find(rr=>{
      const list=(rr.expected_values||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      return list.includes(txt);
    });
    if(m) return m;
  }
  return null;
}

// ── Code item (analit) per produk ────────────────────────────────
let _itemsCache = {};
async function labProductItems(productId){
  if(_itemsCache[productId]) return _itemsCache[productId];
  try {
    _itemsCache[productId] = (await sbGet('product_items',
      `select=id,code,name_id,uom,loinc_code,host_code,ref_low,ref_high,ref_text,display_order,is_active&product_id=eq.${productId}&order=display_order.asc`)||[])
      .filter(i=>i.is_active!==false);
  } catch(e){ _itemsCache[productId] = []; }
  return _itemsCache[productId];
}

// Buat draft lab_results untuk sebuah tes — PECAH per code item bila panel.
// base: { admission_id, sample_id, visit_number, patient_name }
async function labCreateDraftResults(base, productId, productName){
  const items = await labProductItems(productId);
  const now = new Date().toISOString();
  if (items.length){
    for (const it of items){
      await sbPost('lab_results', { ...base,
        product_id: productId, product_name: productName,
        product_item_id: it.id, item_code: it.code||null, item_name: it.name_id||it.code||null,
        unit: it.uom||null, loinc_code: it.loinc_code||null, host_code: it.host_code||null,
        status:'Draft', entered_by: labUser(), entered_at: now });
    }
    return items.length;
  }
  await sbPost('lab_results', { ...base,
    product_id: productId, product_name: productName,
    status:'Draft', entered_by: labUser(), entered_at: now });
  return 1;
}

// ── Loaders utama ────────────────────────────────────────────────
async function loadLabSamples(){
  try {
    const data = await sbGet('lab_samples',
      `select=*&order=created_at.desc&limit=200`);
    labSamples = Array.isArray(data)?data:[];
  } catch(e){ labSamples = []; }
}
async function loadLabResults(){
  try {
    const data = await sbGet('lab_results',
      `select=*&order=created_at.desc&limit=300`);
    labResults = Array.isArray(data)?data:[];
  } catch(e){ labResults = []; }
}

// ═══════════════════════════════════════════════════════════════
// SHELL HALAMAN
// ═══════════════════════════════════════════════════════════════
async function renderLab(tab='checkin'){
  if(!LAB_TABS.includes(tab)) tab='checkin';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>🔬 Laboratory Information System</h1>
        <p>Penerimaan sampel · Worklist &amp; TAT · Input &amp; interpretasi hasil · Validasi berjenjang · Nilai kritis · QC alat</p></div>
      <div class="btn-row">
        <span id="lab-date-badge" style="font-size:12px;color:var(--gray)"></span>
      </div>
    </div>

    <div id="lab-critical-banner"></div>

    <div id="lab-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <div class="tabs" id="lab-tabs">
      <button class="tab-btn ${tab==='checkin'?'active':''}"    onclick="switchLabTab('checkin',this)">🧪 Penerimaan Sampel</button>
      <button class="tab-btn ${tab==='worklist'?'active':''}"   onclick="switchLabTab('worklist',this)">🔬 Worklist &amp; TAT</button>
      <button class="tab-btn ${tab==='result'?'active':''}"     onclick="switchLabTab('result',this)">📝 Input Hasil</button>
      <button class="tab-btn ${tab==='validation'?'active':''}" onclick="switchLabTab('validation',this)">✅ Validasi</button>
      <button class="tab-btn ${tab==='approval'?'active':''}"   onclick="switchLabTab('approval',this)">🔏 Approval</button>
      <button class="tab-btn ${tab==='report'?'active':''}"     onclick="switchLabTab('report',this)">📁 Rekam Medis</button>
      <button class="tab-btn ${tab==='qc'?'active':''}"         onclick="switchLabTab('qc',this)">🎛️ QC &amp; Alat</button>
    </div>

    <div id="lab-checkin"    ${tab!=='checkin'?'style="display:none"':''}></div>
    <div id="lab-worklist"   ${tab!=='worklist'?'style="display:none"':''}></div>
    <div id="lab-result"     ${tab!=='result'?'style="display:none"':''}></div>
    <div id="lab-validation" ${tab!=='validation'?'style="display:none"':''}></div>
    <div id="lab-approval"   ${tab!=='approval'?'style="display:none"':''}></div>
    <div id="lab-report"     ${tab!=='report'?'style="display:none"':''}></div>
    <div id="lab-qc"         ${tab!=='qc'?'style="display:none"':''}></div>`;

  const badge = document.getElementById('lab-date-badge');
  if (badge) badge.textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  await Promise.all([loadLabProducts(), loadLabSamples(), loadLabResults()]);
  renderLabKPI();
  renderCriticalBanner();
  renderCheckinTab();
  renderWorklistTab();
  renderResultTab();
  renderValidationTab();
  renderApprovalTab();
  renderReportTab();
  renderQCTab();
}

function switchLabTab(tab, btn){
  document.querySelectorAll('#lab-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  LAB_TABS.forEach(t=>{
    const el=document.getElementById(`lab-${t}`);
    if(el) el.style.display = (t===tab)?'block':'none';
  });
  if (tab==='qc') renderQCTab();
}

// Reload penuh + re-render semua tab (dipanggil sub-modul setelah mutasi)
async function labRefresh(){
  await Promise.all([loadLabSamples(), loadLabResults()]);
  renderLabKPI(); renderCriticalBanner();
  renderCheckinTab(); renderWorklistTab(); renderResultTab();
  renderValidationTab(); renderApprovalTab(); renderReportTab();
}

// ── KPI ──────────────────────────────────────────────────────────
function renderLabKPI(){
  const el=document.getElementById('lab-kpi'); if(!el) return;
  const pending   = labSamples.filter(s=>s.status==='Pending').length;
  const inProc    = labSamples.filter(s=>s.status==='In Process').length;
  const overdue   = labSamples.filter(s=>['Pending','In Process'].includes(s.status) && tatStatus(s).overdue).length;
  const draftRes  = labResults.filter(r=>r.status==='Draft').length;
  const validated = labResults.filter(r=>r.status==='Validated').length;
  const critical  = labResults.filter(r=>isCriticalResult(r) && !isReleased(r)).length;
  const released  = labResults.filter(r=>isReleased(r)).length;

  el.innerHTML=[
    {icon:'🧪',val:pending,   label:'Sampel Pending', color:'#F59E0B', tab:'checkin'},
    {icon:'⚗️',val:inProc,    label:'Diproses',       color:'#0EA5E9', tab:'worklist'},
    {icon:'⏰',val:overdue,   label:'TAT Terlambat',  color:'#EF4444', tab:'worklist'},
    {icon:'📝',val:draftRes,  label:'Draft Hasil',    color:'#8B5CF6', tab:'result'},
    {icon:'🚨',val:critical,  label:'Nilai Kritis',   color:'#DC2626', tab:'validation'},
    {icon:'✅',val:validated, label:'Tervalidasi',    color:'#22C55E', tab:'approval'},
    {icon:'📤',val:released,  label:'Released',        color:'#0A2342', tab:'report'},
  ].map(k=>`
    <div onclick="switchLabTab('${k.tab}',document.querySelector('#lab-tabs .tab-btn:nth-child(${LAB_TABS.indexOf(k.tab)+1})'))"
      style="background:#fff;border-radius:10px;padding:10px 12px;border:1px solid var(--border);border-left:4px solid ${k.color};text-align:center;cursor:pointer">
      <div style="font-size:16px">${k.icon}</div>
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:9px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

// ── Banner nilai kritis (selalu tampil di atas bila ada) ─────────
function renderCriticalBanner(){
  const el=document.getElementById('lab-critical-banner'); if(!el) return;
  const crit = labResults.filter(r=>isCriticalResult(r) && !isReleased(r) && !r.critical_ack_at);
  if(!crit.length){ el.innerHTML=''; return; }
  el.innerHTML=`
    <div style="background:#FEF2F2;border:1.5px solid #FCA5A5;border-left:5px solid #DC2626;border-radius:10px;padding:12px 16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:#B91C1C;font-size:13px;margin-bottom:8px">
        🚨 ${crit.length} NILAI KRITIS memerlukan tindak lanjut
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${crit.slice(0,8).map(r=>`
          <div style="background:#fff;border:1px solid #FCA5A5;border-radius:8px;padding:6px 10px;font-size:12px">
            <strong>${r.patient_name||'—'}</strong> · ${r.product_name||'—'}:
            <span style="color:#DC2626;font-weight:800">${r.result_value||'—'} ${r.unit||''}</span>
            <button class="btn btn-xs" style="margin-left:6px;background:#DC2626;color:#fff;border:none"
              onclick="ackCritical(${r.id})">Acknowledge</button>
          </div>`).join('')}
      </div>
    </div>`;
}

async function ackCritical(id){
  const note = prompt('Catatan tindak lanjut nilai kritis (mis. dilaporkan ke dr. Sinta 14:20):');
  if(note===null) return;
  try {
    await sbPatch('lab_results', id, {
      critical_ack_by: labUser(),
      critical_ack_at: new Date().toISOString(),
      critical_ack_note: note || 'Diketahui',
    });
    if (typeof logActivity==='function')
      logActivity('critical_ack','lab_results',id,'Nilai kritis di-acknowledge: '+note);
    toast('✅ Nilai kritis di-acknowledge','ok');
    await loadLabResults(); renderCriticalBanner(); renderLabKPI();
  } catch(e){ toast('⚠️ Kolom acknowledgment belum ada — jalankan supabase_lab_lis.sql','warn'); }
}
