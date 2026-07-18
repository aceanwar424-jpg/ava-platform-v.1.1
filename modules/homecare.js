// ═══════════════════════════════════════════
// MODULE: Home Care v2 — Complete
// ═══════════════════════════════════════════

const HC_SERVICES = [
  'Pengambilan Sampel Darah','Cek Gula Darah','Cek Kolesterol','Injeksi',
  'Perawatan Luka','Fisioterapi','Nebulizer','Cek Tekanan Darah',
  'EKG Home Visit','Paket MCU Home','Konsultasi Dokter','Lainnya'
];

const HC_STATUS = {
  'Baru':        {color:'#94A3B8',icon:'📋'},
  'Dikonfirmasi':{color:'#0EA5E9',icon:'✅'},
  'Dijadwalkan': {color:'#8B5CF6',icon:'📅'},
  'Dalam Perjalanan':{color:'#F97316',icon:'🚗'},
  'Sedang Dilayani':{color:'#22C55E',icon:'⚕️'},
  'Selesai':     {color:'#00897B',icon:'🎉'},
  'Dibatalkan':  {color:'#EF4444',icon:'❌'},
};

let hcAll = [];
let hcStaff = [];     // master Nakes (homecare_staff) — Fase 1
let hcTariffs = [];   // master tarif (homecare_tariffs) — Fase 1

// Muat master Nakes & tarif sekali, di-cache untuk dipakai form & billing.
async function loadHCMasters(force=false) {
  if (!force && hcStaff.length && hcTariffs.length) return;
  try {
    const [staff, tariffs] = await Promise.all([
      sbGet('homecare_staff','select=*&order=staff_name.asc').catch(()=>[]),
      sbGet('homecare_tariffs','select=*&order=service_type.asc').catch(()=>[]),
    ]);
    hcStaff   = Array.isArray(staff)?staff:[];
    hcTariffs = Array.isArray(tariffs)?tariffs:[];
  } catch(e) { /* master opsional; form tetap jalan tanpa cache */ }
}

// Cari persentase komisi untuk sebuah order: prioritas nakes → tarif layanan → 15% default.
function hcCommissionPct(staffId, serviceType) {
  const st = hcStaff.find(s=>String(s.id)===String(staffId));
  if (st && st.commission_pct!=null && st.commission_pct!=='') return parseFloat(st.commission_pct)||0;
  const tf = hcTariffs.find(t=>t.service_type===serviceType);
  if (tf && tf.commission_pct!=null && tf.commission_pct!=='') return parseFloat(tf.commission_pct)||0;
  return 15;
}

async function renderHomeCare() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Home Care</h1>
        <p>Manajemen order layanan kunjungan rumah — jadwal, nakes, billing</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderHCStaff()">👥 Master Nakes</button>
        <button class="btn btn-ghost btn-sm" onclick="renderHCTariff()">🏷️ Master Tarif</button>
        <button class="btn btn-ghost btn-sm" onclick="renderHCReport()">📊 Laporan</button>
        <button class="btn btn-teal" onclick="openHCForm()">+ Order Baru</button>
      </div>
    </div>

    <!-- KPI -->
    <div id="hc-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <!-- Status Filter Tabs -->
    <div class="tabs" id="hc-tabs" style="margin-bottom:14px">
      <button class="tab-btn active" onclick="filterHCStatus('',this)">Semua</button>
      ${Object.entries(HC_STATUS).map(([s,v])=>
        `<button class="tab-btn" onclick="filterHCStatus('${s}',this)">${v.icon} ${s}</button>`
      ).join('')}
    </div>

    <!-- Search -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <input class="table-search" id="hc-q" placeholder="🔍 Cari nama pasien, nakes, layanan..."
        oninput="applyHCFilter()" style="flex:1">
      <input type="date" class="table-filter" id="hc-date" onchange="applyHCFilter()">
    </div>

    <div id="hc-list">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;

  await loadHCOrders();
}

async function loadHCOrders() {
  try {
    await loadHCMasters();
    const data = await sbGet('homecare_orders','select=*&order=scheduled_date.asc,created_at.desc');
    hcAll = Array.isArray(data) ? data : [];
    renderHCKPI();
    applyHCFilter();
  } catch(e) {
    document.getElementById('hc-list').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderHCKPI() {
  const el = document.getElementById('hc-kpi');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = hcAll.filter(o=>o.scheduled_date===today);
  const pending  = hcAll.filter(o=>['Baru','Dikonfirmasi'].includes(o.status)).length;
  const active   = hcAll.filter(o=>['Dijadwalkan','Dalam Perjalanan','Sedang Dilayani'].includes(o.status)).length;
  const done     = hcAll.filter(o=>o.status==='Selesai').length;
  const revenue  = hcAll.filter(o=>o.status==='Selesai').reduce((s,o)=>s+(o.total_amount||0),0);

  el.innerHTML = [
    {icon:'📋',val:hcAll.length,    label:'Total Order',   color:'#0A2342'},
    {icon:'📅',val:todayOrders.length,label:'Jadwal Hari Ini',color:'#8B5CF6'},
    {icon:'⏳',val:pending,         label:'Menunggu',      color:'#F59E0B'},
    {icon:'🔵',val:active,          label:'Aktif',         color:'#0EA5E9'},
    {icon:'✅',val:done,            label:'Selesai',       color:'#22C55E'},
    {icon:'💰',val:formatCurrency(revenue),label:'Revenue', color:'#00897B'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);
      border-left:4px solid ${k.color};text-align:center">
      <div style="font-size:20px">${k.icon}</div>
      <div style="font-size:16px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

let hcActiveStatus = '';
function filterHCStatus(status, btn) {
  hcActiveStatus = status;
  document.querySelectorAll('#hc-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyHCFilter();
}

function applyHCFilter() {
  const q    = (document.getElementById('hc-q')?.value||'').toLowerCase();
  const date = document.getElementById('hc-date')?.value||'';
  const filtered = hcAll.filter(o=>
    (!hcActiveStatus || o.status===hcActiveStatus) &&
    (!q || (o.patient_name||'').toLowerCase().includes(q) ||
           (o.assigned_staff||'').toLowerCase().includes(q) ||
           (o.service_type||'').toLowerCase().includes(q) ||
           (o.order_number||'').toLowerCase().includes(q)) &&
    (!date || o.scheduled_date===date)
  );
  renderHCList(filtered);
}

function renderHCList(orders) {
  const el = document.getElementById('hc-list');
  if (!orders.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">🏠</div>
      <h3>${hcAll.length?'Tidak ada hasil':'Belum ada order Home Care'}</h3>
      <p>Buat order baru untuk layanan kunjungan ke rumah pasien.</p>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openHCForm()">+ Order Baru</button>
    </div>`; return;
  }

  el.innerHTML = `<div style="display:grid;gap:10px">
    ${orders.map(o=>{
      const st = HC_STATUS[o.status]||HC_STATUS['Baru'];
      const today = new Date().toISOString().split('T')[0];
      const isToday = o.scheduled_date===today;
      const isPast  = o.scheduled_date && o.scheduled_date<today && o.status!=='Selesai';

      return `<div class="card" style="padding:14px 16px">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <div style="width:44px;height:44px;border-radius:50%;background:${st.color}20;
            display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">
            ${st.icon}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--navy)">${o.patient_name||'—'}</div>
                <div style="font-size:12px;color:var(--gray);margin-top:2px">
                  📞 ${o.patient_phone||'—'} &nbsp;·&nbsp; 🩺 ${o.service_type||'—'}
                </div>
                <div style="font-size:11px;color:var(--gray);margin-top:2px">📍 ${(o.patient_address||'').substring(0,60)}${o.patient_address?.length>60?'...':''}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <span style="background:${st.color}20;color:${st.color};padding:3px 10px;
                  border-radius:10px;font-size:11px;font-weight:700">${o.status||'Baru'}</span>
                <div style="font-size:12px;font-weight:700;color:${isPast?'#EF4444':isToday?'#8B5CF6':'var(--navy)'};margin-top:4px">
                  ${isToday?'📅 HARI INI':''}${isPast?'⚠️ LEWAT':''}
                  ${o.scheduled_date?formatDateShort(o.scheduled_date):'Belum dijadwalkan'}
                  ${o.scheduled_time?' · '+o.scheduled_time:''}
                </div>
                ${o.assigned_staff?`<div style="font-size:11px;color:var(--gray)">👤 ${o.assigned_staff}</div>`:''}
                ${o.total_amount?`<div style="font-size:12px;font-weight:700;color:var(--teal)">${formatCurrency(o.total_amount)}</div>`:''}
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div style="display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap">
          ${o.status==='Baru'?`<button class="btn btn-teal btn-sm" onclick="updateHCStatus(${o.id},'Dikonfirmasi')">✅ Konfirmasi</button>`:''}
          ${o.status==='Dikonfirmasi'?`<button class="btn btn-teal btn-sm" onclick="updateHCStatus(${o.id},'Dijadwalkan')">📅 Jadwalkan</button>`:''}
          ${o.status==='Dijadwalkan'?`<button class="btn btn-teal btn-sm" onclick="updateHCStatus(${o.id},'Dalam Perjalanan')">🚗 Berangkat</button>`:''}
          ${o.status==='Dalam Perjalanan'?`<button class="btn btn-teal btn-sm" onclick="updateHCStatus(${o.id},'Sedang Dilayani')">⚕️ Mulai Layanan</button>`:''}
          ${o.status==='Sedang Dilayani'?`<button class="btn btn-teal btn-sm" onclick="updateHCStatus(${o.id},'Selesai')">🎉 Selesai</button>`:''}
          ${o.patient_phone?`<button class="btn btn-outline btn-sm" onclick="window.open('https://wa.me/${(o.patient_phone||'').replace(/\D/g,'').replace(/^0/,'62')}','_blank')">💬 WA Pasien</button>`:''}
          <button class="btn btn-ghost btn-sm" onclick="openHCForm(${o.id})">✏️ Edit</button>
          ${o.status!=='Selesai'&&o.status!=='Dibatalkan'?`<button class="btn btn-ghost btn-sm" style="color:#EF4444" onclick="cancelHCOrder(${o.id})">Batal</button>`:''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

async function updateHCStatus(id, status) {
  try {
    await sbPatch('homecare_orders', id, {status, updated_at: new Date().toISOString()});
    toast(`✅ Status → ${status}`,'ok');
    await loadHCOrders();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// Pembatalan wajib alasan (Fase 1)
function cancelHCOrder(id) {
  openModal(`
    <div class="modal-header"><div class="modal-title">❌ Batalkan Order Home Care</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Alasan Pembatalan *</label>
      <textarea id="hc-cancel-reason" rows="3" placeholder="Contoh: pasien reschedule, salah input, dll"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Kembali</button>
      <button class="btn btn-danger" onclick="confirmCancelHC(${id})">Batalkan Order</button>
    </div>`);
}

async function confirmCancelHC(id) {
  const reason = document.getElementById('hc-cancel-reason')?.value.trim();
  if (!reason) { toast('Alasan pembatalan wajib diisi','err'); return; }
  try {
    await sbPatch('homecare_orders', id, { status:'Dibatalkan', cancel_reason:reason, updated_at:new Date().toISOString() });
    toast('Order dibatalkan','info');
    closeModalForce();
    await loadHCOrders();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function openHCForm(id=null) {
  let o = {};
  await loadHCMasters();
  if (id) { const d=await sbGet('homecare_orders',`select=*&id=eq.${id}`); o=d[0]||{}; }

  // Load partners for reference
  let partnerOpts = '<option value="">-- Dari Partner (opsional) --</option>';
  try {
    const pts=await sbGet('partners','select=id,partner_name&status=eq.Aktif&order=partner_name&limit=100');
    partnerOpts+=(pts||[]).map(p=>`<option value="${p.id}" ${o.partner_id==p.id?'selected':''}>${p.partner_name}</option>`).join('');
  } catch(e){}

  // Master Nakes dropdown — jika assigned_staff lama tak ada di master, tetap tampilkan
  const activeStaff = hcStaff.filter(s=>s.is_active!==false);
  const staffInMaster = activeStaff.some(s=>String(s.id)===String(o.staff_id) || s.staff_name===o.assigned_staff);
  let staffOpts = '<option value="">-- Pilih Nakes --</option>';
  staffOpts += activeStaff.map(s=>{
    const sel = (o.staff_id && String(o.staff_id)===String(s.id)) || (!o.staff_id && o.assigned_staff===s.staff_name);
    return `<option value="${s.id}" data-name="${(s.staff_name||'').replace(/"/g,'&quot;')}" ${sel?'selected':''}>${s.staff_name}${s.role_title?' · '+s.role_title:''}</option>`;
  }).join('');
  if (o.assigned_staff && !staffInMaster) staffOpts += `<option value="" data-name="${o.assigned_staff.replace(/"/g,'&quot;')}" selected>${o.assigned_staff} (lama)</option>`;

  const user = getUserName?getUserName():'User';
  const today = new Date().toISOString().split('T')[0];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Order':'🏠 Order Home Care Baru'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group" style="grid-column:1/-1">
        <label>Nama Pasien *</label>
        <input type="text" id="hf-name" value="${o.patient_name||''}" placeholder="Nama lengkap pasien">
      </div>
      <div class="form-group">
        <label>No. HP / WA Pasien</label>
        <input type="text" id="hf-phone" value="${o.patient_phone||''}" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Tipe Layanan *</label>
        <select id="hf-service" onchange="hcOnServiceChange()">
          ${HC_SERVICES.map(s=>`<option${o.service_type===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Alamat Kunjungan *</label>
        <textarea id="hf-addr" rows="2" placeholder="Jl. ..., RT/RW, Kelurahan, Kecamatan">${o.patient_address||''}</textarea>
      </div>
      <div class="form-group">
        <label>Tanggal Kunjungan</label>
        <input type="date" id="hf-date" value="${o.scheduled_date||today}" onchange="hcCheckScheduleConflict(${id||'null'})">
      </div>
      <div class="form-group">
        <label>Jam Kunjungan</label>
        <input type="time" id="hf-time" value="${o.scheduled_time||'08:00'}" onchange="hcCheckScheduleConflict(${id||'null'})">
      </div>
      <div class="form-group">
        <label>Nakes / Tim yang Bertugas</label>
        <select id="hf-staff" onchange="hcOnStaffChange()">${staffOpts}</select>
        ${activeStaff.length?'':'<div class="form-hint" style="color:#F59E0B">Belum ada master Nakes. Tambah via tombol "👥 Master Nakes".</div>'}
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="hf-status" onchange="hcOnStatusChange()">
          ${Object.keys(HC_STATUS).map(s=>`<option${(o.status||'Baru')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tarif Layanan (Rp)</label>
        <input type="number" id="hf-amount" value="${o.total_amount||''}" placeholder="0" oninput="hcUpdateCommissionPreview()">
        <div class="form-hint" id="hf-comm-preview" style="color:var(--teal)"></div>
      </div>
      <div class="form-group" id="hf-cancel-wrap" style="grid-column:1/-1;display:${o.status==='Dibatalkan'?'block':'none'}">
        <label>Alasan Pembatalan ${o.status==='Dibatalkan'?'*':''}</label>
        <input type="text" id="hf-cancel-reason" value="${o.cancel_reason||''}" placeholder="Alasan order dibatalkan">
      </div>
      <div class="form-group" id="hf-conflict-wrap" style="grid-column:1/-1;display:none">
        <div id="hf-conflict" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:8px 10px;font-size:12px;color:#B91C1C"></div>
      </div>
      <div class="form-group">
        <label>Referral Partner</label>
        <select id="hf-partner">${partnerOpts}</select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Catatan</label>
        <textarea id="hf-notes" rows="2" placeholder="Kondisi pasien, alat yang dibawa, instruksi khusus...">${o.notes||''}</textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveHCOrder(${id||'null'})">💾 Simpan</button>
    </div>`);
  hcUpdateCommissionPreview();
  hcCheckScheduleConflict(id);
}

// ── Helper form: nama nakes terpilih (dari master atau order lama) ──
function hcSelectedStaffName() {
  const sel = document.getElementById('hf-staff');
  if (!sel) return '';
  const opt = sel.options[sel.selectedIndex];
  return opt ? (opt.getAttribute('data-name')||'') : '';
}

// Ganti layanan → auto-isi tarif dari master (hanya jika field tarif masih kosong/0)
function hcOnServiceChange() {
  const svc = document.getElementById('hf-service')?.value;
  const amtEl = document.getElementById('hf-amount');
  const tf = hcTariffs.find(t=>t.service_type===svc);
  if (tf && amtEl && (!parseFloat(amtEl.value))) amtEl.value = tf.base_price||'';
  hcUpdateCommissionPreview();
}

function hcOnStaffChange() { hcUpdateCommissionPreview(); hcCheckScheduleConflict(); }

function hcOnStatusChange() {
  const st = document.getElementById('hf-status')?.value;
  const wrap = document.getElementById('hf-cancel-wrap');
  if (wrap) wrap.style.display = st==='Dibatalkan' ? 'block' : 'none';
}

// Preview komisi nakes berdasarkan pct efektif (nakes → tarif → 15%)
function hcUpdateCommissionPreview() {
  const el = document.getElementById('hf-comm-preview'); if (!el) return;
  const amt = parseFloat(document.getElementById('hf-amount')?.value)||0;
  const staffId = document.getElementById('hf-staff')?.value||'';
  const svc = document.getElementById('hf-service')?.value||'';
  const pct = hcCommissionPct(staffId, svc);
  const comm = Math.round(amt * pct / 100);
  el.textContent = amt ? `Komisi nakes ≈ ${formatCurrency(comm)} (${pct}%)` : '';
}

// Deteksi bentrok jadwal: nakes sama, tanggal sama, jam sama (order lain aktif)
function hcCheckScheduleConflict(currentId=null) {
  const wrap = document.getElementById('hf-conflict-wrap');
  const box  = document.getElementById('hf-conflict');
  if (!wrap || !box) return;
  const staffName = hcSelectedStaffName();
  const date = document.getElementById('hf-date')?.value;
  const time = document.getElementById('hf-time')?.value;
  if (!staffName || !date || !time) { wrap.style.display='none'; return; }
  const clash = hcAll.filter(o =>
    String(o.id)!==String(currentId) &&
    o.assigned_staff===staffName && o.scheduled_date===date && o.scheduled_time===time &&
    !['Dibatalkan','Selesai'].includes(o.status)
  );
  if (clash.length) {
    box.innerHTML = `⚠️ ${staffName} sudah ada jadwal lain pada ${formatDateShort(date)} ${time}: ${clash.map(c=>c.patient_name).join(', ')}`;
    wrap.style.display='block';
  } else { wrap.style.display='none'; }
}

async function saveHCOrder(id) {
  const name = document.getElementById('hf-name').value.trim();
  const addr = document.getElementById('hf-addr').value.trim();
  const svc  = document.getElementById('hf-service').value;
  if (!name) { toast('Nama pasien wajib diisi','err'); return; }
  if (!addr) { toast('Alamat wajib diisi','err'); return; }

  const status = document.getElementById('hf-status').value;
  const cancelReason = document.getElementById('hf-cancel-reason')?.value.trim()||'';
  if (status==='Dibatalkan' && !cancelReason) { toast('Alasan pembatalan wajib diisi','err'); return; }

  const user = getUserName?getUserName():'User';
  const num  = id ? '' : `HC-${Date.now().toString().slice(-6)}`;

  const staffSel  = document.getElementById('hf-staff');
  const staffId   = parseInt(staffSel.value)||null;
  const staffName = hcSelectedStaffName();
  const amount    = parseFloat(document.getElementById('hf-amount').value)||0;
  const commPct   = hcCommissionPct(staffId, svc);

  const payload = {
    patient_name:    name,
    patient_phone:   document.getElementById('hf-phone').value.trim(),
    patient_address: addr,
    service_type:    svc,
    scheduled_date:  document.getElementById('hf-date').value||null,
    scheduled_time:  document.getElementById('hf-time').value||null,
    assigned_staff:  staffName,
    staff_id:        staffId,
    status:          status,
    cancel_reason:   status==='Dibatalkan' ? cancelReason : null,
    total_amount:    amount,
    commission_amount: Math.round(amount * commPct / 100),
    partner_id:      parseInt(document.getElementById('hf-partner').value)||null,
    notes:           document.getElementById('hf-notes').value.trim(),
    created_by_name: user,
    updated_at:      new Date().toISOString(),
    ...(num ? {order_number:num} : {}),
  };

  try {
    if (id) {
      await sbPatch('homecare_orders',id,payload);
      toast('✅ Order diupdate','ok');
    } else {
      const res=await sbPost('homecare_orders',payload);
      await logActivity('create','homecare_orders',res[0]?.id,`Order HC baru: ${name}`,name);
      toast('✅ Order dibuat','ok');
    }
    closeModalForce();
    await loadHCOrders();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

function renderHCReport() {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0,7);
  const byStaff = {};
  hcAll.filter(o=>o.status==='Selesai').forEach(o=>{
    const n=o.assigned_staff||'Tidak Ditugaskan';
    byStaff[n]=(byStaff[n]||0)+(o.total_amount||0);
  });

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📊 Laporan Home Care</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      ${[
        {label:'Total Order',val:hcAll.length,color:'var(--navy)'},
        {label:'Selesai',val:hcAll.filter(o=>o.status==='Selesai').length,color:'#22C55E'},
        {label:'Dibatalkan',val:hcAll.filter(o=>o.status==='Dibatalkan').length,color:'#EF4444'},
        {label:'Total Revenue',val:formatCurrency(hcAll.filter(o=>o.status==='Selesai').reduce((s,o)=>s+(o.total_amount||0),0)),color:' var(--teal)'},
      ].map(k=>`<div style="background:var(--lgray);border-radius:8px;padding:12px">
        <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
        <div style="font-size:11px;color:var(--gray)">${k.label}</div>
      </div>`).join('')}
    </div>
    <div class="card-title" style="margin-bottom:8px">Revenue per Nakes</div>
    ${Object.entries(byStaff).sort((a,b)=>b[1]-a[1]).map(([name,rev])=>`
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px">${name}</span>
        <span style="font-size:13px;font-weight:700;color:var(--teal)">${formatCurrency(rev)}</span>
      </div>`).join('')||'<div style="color:var(--gray);font-size:13px">Belum ada data</div>'}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    </div>`);
}

// ══════════════════════════════════════════
// HOME CARE: Jadwal Kunjungan + Billing + Report
// ══════════════════════════════════════════

async function renderHCSchedule() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Jadwal Kunjungan Home Care</h1>
        <p>Kalender harian nakes & assign tugas</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderHomeCare()">← Orders</button>
        <button class="btn btn-ghost btn-sm" onclick="renderHCBilling()">💵 Billing Nakes</button>
        <button class="btn btn-ghost btn-sm" onclick="renderHCFullReport()">📊 Report</button>
      </div>
    </div>

    <!-- Date Picker -->
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
      <button class="btn btn-ghost btn-sm" onclick="changeHCDate(-1)">← Kemarin</button>
      <input type="date" id="hc-sched-date" class="table-filter" style="font-size:14px;font-weight:700"
        value="${new Date().toISOString().split('T')[0]}" onchange="loadHCSchedule()">
      <button class="btn btn-ghost btn-sm" onclick="changeHCDate(1)">Besok →</button>
      <button class="btn btn-teal btn-sm" onclick="document.getElementById('hc-sched-date').value='${new Date().toISOString().split('T')[0]}';loadHCSchedule()">Hari Ini</button>
    </div>

    <div id="hc-schedule-content">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;

  await loadHCSchedule();
}

function changeHCDate(delta) {
  const el = document.getElementById('hc-sched-date');
  if (!el) return;
  const d  = new Date(el.value);
  d.setDate(d.getDate()+delta);
  el.value = d.toISOString().split('T')[0];
  loadHCSchedule();
}

async function loadHCSchedule() {
  const el   = document.getElementById('hc-schedule-content'); if (!el) return;
  const date = document.getElementById('hc-sched-date')?.value||new Date().toISOString().split('T')[0];
  el.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

  try {
    const data = await sbGet('homecare_orders',
      `select=*&scheduled_date=eq.${date}&order=scheduled_time.asc`);
    const orders = Array.isArray(data)?data:[];

    if (!orders.length) {
      el.innerHTML=`<div class="empty-state"><div class="ico">📅</div>
        <h3>Tidak ada jadwal untuk ${formatDateShort(date)}</h3>
      </div>`; return;
    }

    // Group by nakes
    const byNakes = {};
    orders.forEach(o=>{
      const key=o.assigned_staff||'Belum Ditugaskan';
      if (!byNakes[key]) byNakes[key]=[];
      byNakes[key].push(o);
    });

    const nakesColors=['#0EA5E9','#22C55E','#8B5CF6','#F59E0B','#EF4444','#00897B'];

    el.innerHTML=`
      <!-- Summary -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:16px">
        ${[
          {l:'Total Order', v:orders.length,                                          c:'#0A2342'},
          {l:'Nakes Bertugas',v:Object.keys(byNakes).filter(n=>n!=='Belum Ditugaskan').length, c:'#22C55E'},
          {l:'Belum Assign', v:byNakes['Belum Ditugaskan']?.length||0,               c:'#EF4444'},
          {l:'Selesai',      v:orders.filter(o=>o.status==='Selesai').length,         c:'#8B5CF6'},
        ].map(k=>`<div style="background:#fff;border-radius:10px;padding:10px;border:1px solid var(--border);border-left:4px solid ${k.c};text-align:center">
          <div style="font-size:18px;font-weight:800;color:${k.c}">${k.v}</div>
          <div style="font-size:10px;color:var(--gray)">${k.l}</div>
        </div>`).join('')}
      </div>

      <!-- Schedule by Nakes -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
        ${Object.entries(byNakes).map(([nakes,orders],idx)=>`
          <div class="card">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
              <div style="width:36px;height:36px;border-radius:50%;background:${nakesColors[idx%nakesColors.length]};
                color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800">
                ${nakes.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--navy)">${nakes}</div>
                <div style="font-size:11px;color:var(--gray)">${orders.length} kunjungan</div>
              </div>
            </div>
            ${orders.map(o=>{
              const stColors={'Baru':'#94A3B8','Dikonfirmasi':'#0EA5E9','Dijadwalkan':'#8B5CF6','Dalam Perjalanan':'#F97316','Sedang Dilayani':'#22C55E','Selesai':'#00897B','Dibatalkan':'#EF4444'};
              const sc=stColors[o.status]||'#94A3B8';
              const mapsUrl=o.patient_address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.patient_address)}`:'';
              const waUrl=o.patient_phone?`https://wa.me/${(o.patient_phone||'').replace(/\D/g,'').replace(/^0/,'62')}?text=${encodeURIComponent(`Halo ${o.patient_name}, kami dari OneLab Diagnostics. Nakes akan mengunjungi Anda pukul ${o.scheduled_time||'sesuai jadwal'} untuk layanan ${o.service_type||'Home Care'}. Terima kasih.`)}`:'';
              return `
              <div style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div>
                    <div style="font-size:12px;font-weight:700;color:var(--teal)">${o.scheduled_time||'—'}</div>
                    <div style="font-size:13px;font-weight:600;color:var(--navy)">${o.patient_name}</div>
                    <div style="font-size:11px;color:var(--gray)">${o.service_type||'—'}</div>
                    <div style="font-size:10px;color:var(--gray);margin-top:2px">${(o.patient_address||'').substring(0,40)}${(o.patient_address||'').length>40?'...':''}</div>
                  </div>
                  <span style="background:${sc}20;color:${sc};padding:2px 7px;border-radius:8px;font-size:10px;font-weight:700;white-space:nowrap">${o.status}</span>
                </div>
                <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
                  ${mapsUrl?`<a href="${mapsUrl}" target="_blank" class="btn btn-ghost btn-xs">📍 Maps</a>`:''}
                  ${waUrl?`<a href="${waUrl}" target="_blank" class="btn btn-ghost btn-xs" style="color:#25D366">💬 WA Pasien</a>`:''}
                  ${o.status!=='Selesai'?`<button class="btn btn-teal btn-xs" onclick="quickStatusHC(${o.id},'${o.status}')">Update</button>`:''}
                </div>
              </div>`;
            }).join('')}
          </div>`).join('')}
      </div>`;
  } catch(e) {
    el.innerHTML=`<div class="status-box status-err">${e.message}</div>`;
  }
}

async function quickStatusHC(id, currentStatus) {
  const flow = ['Baru','Dikonfirmasi','Dijadwalkan','Dalam Perjalanan','Sedang Dilayani','Selesai'];
  const idx  = flow.indexOf(currentStatus);
  const next = flow[idx+1];
  if (!next) return;
  await updateHCStatus(id, next);
  await loadHCSchedule();
}

// ── Billing Nakes ─────────────────────────
async function renderHCBilling() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Billing Fee Nakes</h1>
        <p>Rekap fee per nakes berdasarkan order yang selesai</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderHCSchedule()">← Jadwal</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <select class="table-filter" id="hcb-month" onchange="loadHCBilling()">
        ${Array.from({length:12},(_,i)=>{
          const d=new Date(); d.setMonth(i);
          return `<option value="${i}" ${i===new Date().getMonth()?'selected':''}>${d.toLocaleDateString('id-ID',{month:'long'})}</option>`;
        }).join('')}
      </select>
      <select class="table-filter" id="hcb-year" onchange="loadHCBilling()">
        ${[2024,2025,2026].map(y=>`<option${y===new Date().getFullYear()?' selected':''}>${y}</option>`).join('')}
      </select>
      <span id="hcb-summary" style="font-size:13px;color:var(--gray)"></span>
    </div>

    <div id="hcb-content"><div class="loading-row"><div class="spinner"></div></div></div>`;

  await loadHCBilling();
}

async function loadHCBilling() {
  const el    = document.getElementById('hcb-content'); if (!el) return;
  const month = document.getElementById('hcb-month')?.value;
  const year  = document.getElementById('hcb-year')?.value||new Date().getFullYear();
  const m     = String(parseInt(month)+1).padStart(2,'0');
  const from  = `${year}-${m}-01`;
  const to    = `${year}-${m}-31`;

  try {
    await loadHCMasters();
    const data = await sbGet('homecare_orders',
      `select=*&status=eq.Selesai&scheduled_date=gte.${from}&scheduled_date=lte.${to}&order=assigned_staff.asc`);
    const orders = Array.isArray(data)?data:[];

    const byNakes={};
    orders.forEach(o=>{
      const n=o.assigned_staff||'Tidak Diketahui';
      if (!byNakes[n]) byNakes[n]={name:n,orders:[],total:0,fee:0};
      byNakes[n].orders.push(o);
      byNakes[n].total+=(o.total_amount||0);
      // Fase 1: komisi dari order (commission_amount), fallback pct efektif master
      const fee = (o.commission_amount!=null && o.commission_amount!=='')
        ? (parseFloat(o.commission_amount)||0)
        : Math.round((o.total_amount||0) * hcCommissionPct(o.staff_id, o.service_type) / 100);
      byNakes[n].fee += fee;
    });

    const sumEl=document.getElementById('hcb-summary');
    if (sumEl) sumEl.textContent=`${orders.length} order selesai · ${Object.keys(byNakes).length} nakes`;

    if (!Object.keys(byNakes).length) {
      el.innerHTML=`<div class="empty-state"><div class="ico">💵</div><h3>Belum ada order selesai bulan ini</h3></div>`; return;
    }

    el.innerHTML=`<div class="table-wrap"><table>
      <thead><tr>
        <th>Nakes</th><th>Jumlah Order</th><th>Total Revenue</th><th>Fee Komisi</th><th>Detail</th>
      </tr></thead><tbody>
      ${Object.values(byNakes).map(n=>`<tr>
        <td style="font-weight:700;color:var(--navy)">${n.name}</td>
        <td style="text-align:center;font-weight:600">${n.orders.length}</td>
        <td style="font-weight:700">${formatCurrency(n.total)}</td>
        <td style="font-weight:800;color:#22C55E">${formatCurrency(n.fee)}</td>
        <td>
          <button class="btn btn-ghost btn-xs" onclick="showNakesDetail('${n.name.replace(/'/g,"\\'")}',${JSON.stringify(n.orders.map(o=>o.id)).replace(/"/g,'&quot;')})">
            Detail
          </button>
        </td>
      </tr>`).join('')}
      <tr style="background:var(--lgray);font-weight:800">
        <td>TOTAL</td>
        <td style="text-align:center">${orders.length}</td>
        <td>${formatCurrency(Object.values(byNakes).reduce((s,n)=>s+n.total,0))}</td>
        <td style="color:#22C55E">${formatCurrency(Object.values(byNakes).reduce((s,n)=>s+n.fee,0))}</td>
        <td></td>
      </tr>
      </tbody></table></div>`;
  } catch(e) { el.innerHTML=`<div class="status-box status-err">${e.message}</div>`; }
}

async function renderHCFullReport() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Report Home Care</h1><p>Rekap kunjungan dan revenue per periode</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderHomeCare()">← Orders</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input type="date" class="table-filter" id="hcr-from" value="${new Date(Date.now()-30*86400000).toISOString().split('T')[0]}">
      <span style="align-self:center;color:var(--gray)">s/d</span>
      <input type="date" class="table-filter" id="hcr-to" value="${new Date().toISOString().split('T')[0]}">
      <button class="btn btn-teal btn-sm" onclick="loadHCReport()">🔍 Tampilkan</button>
    </div>
    <div id="hcr-content"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await loadHCReport();
}

async function loadHCReport() {
  const el   = document.getElementById('hcr-content'); if (!el) return;
  const from = document.getElementById('hcr-from')?.value;
  const to   = document.getElementById('hcr-to')?.value;
  el.innerHTML=`<div class="loading-row"><div class="spinner"></div></div>`;
  try {
    const data = await sbGet('homecare_orders',
      `select=*&scheduled_date=gte.${from}&scheduled_date=lte.${to}&order=scheduled_date.desc`);
    const orders = Array.isArray(data)?data:[];
    const done   = orders.filter(o=>o.status==='Selesai');
    const rev    = done.reduce((s,o)=>s+(o.total_amount||0),0);
    const byService={};
    done.forEach(o=>{ byService[o.service_type||'Lainnya']=(byService[o.service_type||'Lainnya']||0)+1; });

    el.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
        ${[
          {l:'Total Order',v:orders.length,c:'#0A2342'},
          {l:'Selesai',    v:done.length,  c:'#22C55E'},
          {l:'Dibatalkan', v:orders.filter(o=>o.status==='Dibatalkan').length,c:'#EF4444'},
          {l:'Revenue',    v:formatCurrency(rev),c:'#8B5CF6'},
        ].map(k=>`<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);border-left:4px solid ${k.c}">
          <div style="font-size:${String(k.v).length>8?'12px':'16px'};font-weight:800;color:${k.c}">${k.v}</div>
          <div style="font-size:10px;color:var(--gray)">${k.l}</div>
        </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:10px">Per Jenis Layanan</div>
        ${Object.entries(byService).sort((a,b)=>b[1]-a[1]).map(([s,c])=>`
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span>${s}</span><strong>${c} order</strong>
          </div>`).join('')||'<div style="color:var(--gray)">Belum ada data</div>'}
      </div>`;
  } catch(e) { el.innerHTML=`<div class="status-box status-err">${e.message}</div>`; }
}

// Detail order per nakes (dipanggil dari tabel billing) — sebelumnya belum ada
function showNakesDetail(name, ids) {
  const orders = hcAll.filter(o=>ids.includes(o.id));
  openModal(`
    <div class="modal-header"><div class="modal-title">👤 Detail Order — ${name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <table style="width:100%;font-size:12px"><thead><tr style="background:var(--bg)">
      <th style="padding:5px;text-align:left">Tanggal</th><th style="padding:5px;text-align:left">Pasien</th>
      <th style="padding:5px;text-align:left">Layanan</th><th style="padding:5px;text-align:right">Tarif</th><th style="padding:5px;text-align:right">Komisi</th>
    </tr></thead><tbody>${orders.map(o=>{
      const fee = (o.commission_amount!=null&&o.commission_amount!=='')?parseFloat(o.commission_amount)||0:Math.round((o.total_amount||0)*hcCommissionPct(o.staff_id,o.service_type)/100);
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px">${o.scheduled_date?formatDateShort(o.scheduled_date):'—'}</td>
        <td style="padding:5px">${o.patient_name||'—'}</td>
        <td style="padding:5px">${o.service_type||'—'}</td>
        <td style="padding:5px;text-align:right">${formatCurrency(o.total_amount||0)}</td>
        <td style="padding:5px;text-align:right;font-weight:700;color:#22C55E">${formatCurrency(fee)}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="5" style="padding:8px;color:var(--gray)">Tidak ada data</td></tr>'}</tbody></table>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}

// ══════════════════════════════════════════════════════════════
// MASTER NAKES (homecare_staff) — Fase 1
// ══════════════════════════════════════════════════════════════
async function renderHCStaff() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>👥 Master Nakes</h1><p>Tenaga kesehatan Home Care — kompetensi, wilayah, komisi</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderHomeCare()">← Orders</button>
        <button class="btn btn-teal" onclick="openHCStaffForm()">+ Tambah Nakes</button>
      </div>
    </div>
    <div class="table-wrap"><div id="hcs-tbody"><div class="loading-row"><div class="spinner"></div></div></div></div>`;
  await loadHCMasters(true);
  renderHCStaffTable();
}

function renderHCStaffTable() {
  const el = document.getElementById('hcs-tbody'); if (!el) return;
  if (!hcStaff.length) { el.innerHTML = `<div class="empty-state"><div class="ico">👥</div><h3>Belum ada Nakes</h3><p>Klik "+ Tambah Nakes".</p></div>`; return; }
  el.innerHTML = `<table><thead><tr>
    <th>Nama</th><th>Peran</th><th>Kompetensi</th><th>Wilayah</th><th>Komisi</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>${hcStaff.map(s=>`<tr>
    <td><div style="font-weight:600;color:var(--navy)">${s.staff_name||'—'}</div><div style="font-size:11px;color:var(--gray)">${s.phone||''}</div></td>
    <td style="font-size:12px">${s.role_title||'—'}</td>
    <td style="font-size:11px;color:var(--gray)">${s.competencies||'—'}</td>
    <td style="font-size:11px;color:var(--gray)">${s.coverage_area||'—'}</td>
    <td style="text-align:center;font-weight:700">${s.commission_pct!=null?s.commission_pct+'%':'—'}</td>
    <td><span class="badge ${s.is_active!==false?'badge-teal':'badge-gray'}">${s.is_active!==false?'Aktif':'Nonaktif'}</span></td>
    <td><div class="act-row">
      <button class="act-btn edit" onclick="openHCStaffForm(${s.id})">✏️</button>
      <button class="act-btn del" onclick="deleteHCStaff(${s.id})">🗑</button>
    </div></td>
  </tr>`).join('')}</tbody></table>`;
}

async function openHCStaffForm(id=null) {
  const s = id ? (hcStaff.find(x=>x.id===id)||{}) : {};
  let empOpts = '<option value="">-- Tautkan Karyawan (opsional) --</option>';
  try {
    const emps = await sbGet('employees','select=id,full_name&order=full_name&limit=200').catch(()=>[]);
    empOpts += (emps||[]).map(e=>`<option value="${e.id}" ${s.employee_id==e.id?'selected':''}>${e.full_name}</option>`).join('');
  } catch(e){}
  openModal(`
    <div class="modal-header"><div class="modal-title">${id?'✏️ Edit Nakes':'👥 Tambah Nakes'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Nama Nakes *</label><input type="text" id="hcs-name" value="${s.staff_name||''}"></div>
      <div class="form-group"><label>No. HP / WA</label><input type="text" id="hcs-phone" value="${s.phone||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Peran</label>
        <select id="hcs-role">${['Perawat','Analis','Fisioterapis','Dokter','Bidan','Lainnya'].map(r=>`<option${s.role_title===r?' selected':''}>${r}</option>`).join('')}</select></div>
      <div class="form-group"><label>Komisi (%)</label><input type="number" id="hcs-comm" value="${s.commission_pct!=null?s.commission_pct:15}" min="0" max="100"></div>
    </div>
    <div class="form-group"><label>Kompetensi (layanan yang dikuasai)</label>
      <input type="text" id="hcs-comp" value="${s.competencies||''}" placeholder="Pengambilan Sampel, Injeksi, Perawatan Luka"></div>
    <div class="form-group"><label>Wilayah Cakupan</label>
      <input type="text" id="hcs-area" value="${s.coverage_area||''}" placeholder="Jakarta Selatan, Depok"></div>
    <div class="form-group"><label>Tautkan ke Karyawan (HRD)</label><select id="hcs-emp">${empOpts}</select></div>
    <div class="form-row">
      <div class="form-group"><label>Status</label>
        <select id="hcs-active"><option value="true"${s.is_active!==false?' selected':''}>Aktif</option><option value="false"${s.is_active===false?' selected':''}>Nonaktif</option></select></div>
      <div class="form-group"><label>Catatan</label><input type="text" id="hcs-notes" value="${s.notes||''}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveHCStaff(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function saveHCStaff(id) {
  const name = document.getElementById('hcs-name').value.trim();
  if (!name) { toast('Nama Nakes wajib diisi','err'); return; }
  const payload = {
    staff_name: name,
    phone: document.getElementById('hcs-phone').value.trim(),
    role_title: document.getElementById('hcs-role').value,
    commission_pct: parseFloat(document.getElementById('hcs-comm').value)||0,
    competencies: document.getElementById('hcs-comp').value.trim(),
    coverage_area: document.getElementById('hcs-area').value.trim(),
    employee_id: parseInt(document.getElementById('hcs-emp').value)||null,
    is_active: document.getElementById('hcs-active').value==='true',
    notes: document.getElementById('hcs-notes').value.trim(),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) { await sbPatch('homecare_staff',id,payload); toast('✅ Nakes diupdate','ok'); }
    else { await sbPost('homecare_staff',payload); toast('✅ Nakes ditambahkan','ok'); }
    closeModalForce(); await loadHCMasters(true); renderHCStaffTable();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteHCStaff(id) {
  if (!confirm('Hapus Nakes ini?')) return;
  try { await sbDelete('homecare_staff',id); toast('🗑 Dihapus','info'); await loadHCMasters(true); renderHCStaffTable(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// MASTER TARIF (homecare_tariffs) — Fase 1
// ══════════════════════════════════════════════════════════════
async function renderHCTariff() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>🏷️ Master Tarif Home Care</h1><p>Tarif dasar & komisi per jenis layanan</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderHomeCare()">← Orders</button>
        <button class="btn btn-teal" onclick="openHCTariffForm()">+ Tambah Tarif</button>
      </div>
    </div>
    <div class="table-wrap"><div id="hct-tbody"><div class="loading-row"><div class="spinner"></div></div></div></div>`;
  await loadHCMasters(true);
  renderHCTariffTable();
}

function renderHCTariffTable() {
  const el = document.getElementById('hct-tbody'); if (!el) return;
  if (!hcTariffs.length) { el.innerHTML = `<div class="empty-state"><div class="ico">🏷️</div><h3>Belum ada tarif</h3></div>`; return; }
  el.innerHTML = `<table><thead><tr>
    <th>Jenis Layanan</th><th>Tarif Dasar</th><th>Komisi %</th><th>Komisi Flat</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>${hcTariffs.map(t=>`<tr>
    <td style="font-weight:600">${t.service_type||'—'}</td>
    <td style="font-weight:700">${formatCurrency(t.base_price||0)}</td>
    <td style="text-align:center">${t.commission_pct!=null?t.commission_pct+'%':'—'}</td>
    <td style="text-align:right">${t.commission_flat?formatCurrency(t.commission_flat):'—'}</td>
    <td><span class="badge ${t.is_active!==false?'badge-teal':'badge-gray'}">${t.is_active!==false?'Aktif':'Nonaktif'}</span></td>
    <td><div class="act-row"><button class="act-btn edit" onclick="openHCTariffForm(${t.id})">✏️</button></div></td>
  </tr>`).join('')}</tbody></table>`;
}

function openHCTariffForm(id=null) {
  const t = id ? (hcTariffs.find(x=>x.id===id)||{}) : {};
  openModal(`
    <div class="modal-header"><div class="modal-title">${id?'✏️ Edit Tarif':'🏷️ Tambah Tarif'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Jenis Layanan *</label>
      <select id="hct-svc">${HC_SERVICES.map(s=>`<option${t.service_type===s?' selected':''}>${s}</option>`).join('')}</select></div>
    <div class="form-row">
      <div class="form-group"><label>Tarif Dasar (Rp)</label><input type="number" id="hct-price" value="${t.base_price||0}"></div>
      <div class="form-group"><label>Komisi (%)</label><input type="number" id="hct-comm" value="${t.commission_pct!=null?t.commission_pct:15}" min="0" max="100"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Komisi Flat (Rp, opsional)</label><input type="number" id="hct-flat" value="${t.commission_flat||0}"></div>
      <div class="form-group"><label>Status</label>
        <select id="hct-active"><option value="true"${t.is_active!==false?' selected':''}>Aktif</option><option value="false"${t.is_active===false?' selected':''}>Nonaktif</option></select></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveHCTariff(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function saveHCTariff(id) {
  const payload = {
    service_type: document.getElementById('hct-svc').value,
    base_price: parseFloat(document.getElementById('hct-price').value)||0,
    commission_pct: parseFloat(document.getElementById('hct-comm').value)||0,
    commission_flat: parseFloat(document.getElementById('hct-flat').value)||0,
    is_active: document.getElementById('hct-active').value==='true',
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) { await sbPatch('homecare_tariffs',id,payload); toast('✅ Tarif diupdate','ok'); }
    else { await sbPost('homecare_tariffs',payload); toast('✅ Tarif ditambahkan','ok'); }
    closeModalForce(); await loadHCMasters(true); renderHCTariffTable();
  } catch(e) { toast('❌ '+e.message,'err'); }
}
