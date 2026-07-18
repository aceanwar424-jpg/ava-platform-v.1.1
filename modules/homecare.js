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
          ${o.status==='Sedang Dilayani'?`<button class="btn btn-teal btn-sm" onclick="completeHCVisit(${o.id})">🎉 Selesai & Dokumentasi</button>`:''}
          ${o.status==='Selesai'?`<button class="btn btn-outline btn-sm" onclick="viewHCVisit(${o.id})">📋 Rekam Kunjungan</button>`:''}
          ${o.status==='Selesai'&&o.billing_status!=='Lunas'?`<button class="btn btn-outline btn-sm" onclick="openHCBillingAction(${o.id})">🧾 ${o.billing_status==='Ditagih'?'Tandai Lunas':'Tagih'}</button>`:''}
          ${o.status==='Selesai'?`<button class="btn btn-ghost btn-sm" onclick="openHCRating(${o.id})">${o.rating?'⭐'.repeat(o.rating):'⭐ Rating'}</button>`:''}
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
    const o = hcAll.find(x=>x.id===id);
    await logActivity('status','homecare_orders',id,`Status → ${status}`, o?.patient_name||'');
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
    const o = hcAll.find(x=>x.id===id);
    await logActivity('cancel','homecare_orders',id,`Order dibatalkan: ${reason}`, o?.patient_name||'');
    toast('Order dibatalkan','info');
    closeModalForce();
    await loadHCOrders();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// DOKUMENTASI KUNJUNGAN (homecare_visit_records) — Fase 2
// ══════════════════════════════════════════════════════════════
let hcInvItems = [];   // cache barang inventory untuk pemakaian BHP (Fase 3)
let hcBhpLines = [];   // working state BHP dipakai kunjungan

async function completeHCVisit(id) {
  const o = hcAll.find(x=>x.id===id) || (await sbGet('homecare_orders',`select=*&id=eq.${id}`))?.[0] || {};
  // Ambil rekam yang mungkin sudah ada (jika mengulang dokumentasi)
  const existing = (await sbGet('homecare_visit_records',`select=*&order_id=eq.${id}&order=id.desc&limit=1`).catch(()=>[]))?.[0] || {};
  // Muat barang aktif untuk pilihan BHP (best-effort)
  hcInvItems = (await sbGet('inventory_items','select=id,item_code,item_name,unit,unit_price,stock_qty&order=item_name.asc').catch(()=>[]))||[];
  hcBhpLines = [];
  openModal(`
    <div class="modal-header"><div class="modal-title">📋 Dokumentasi Kunjungan — ${o.patient_name||''}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px">🩺 ${o.service_type||''} · 📅 ${o.scheduled_date?formatDateShort(o.scheduled_date):''} ${o.scheduled_time||''}</div>

    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Tanda Vital</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <div class="form-group"><label>Tekanan Darah (mmHg)</label>
        <div style="display:flex;gap:4px;align-items:center">
          <input type="number" id="vr-sys" value="${existing.bp_systolic||''}" placeholder="120" style="width:100%">
          <span>/</span>
          <input type="number" id="vr-dia" value="${existing.bp_diastolic||''}" placeholder="80" style="width:100%">
        </div></div>
      <div class="form-group"><label>Nadi (x/mnt)</label><input type="number" id="vr-pulse" value="${existing.pulse||''}"></div>
      <div class="form-group"><label>Suhu (°C)</label><input type="number" step="0.1" id="vr-temp" value="${existing.temperature||''}"></div>
      <div class="form-group"><label>Napas (x/mnt)</label><input type="number" id="vr-resp" value="${existing.resp_rate||''}"></div>
      <div class="form-group"><label>SpO₂ (%)</label><input type="number" id="vr-spo2" value="${existing.spo2||''}"></div>
      <div class="form-group"><label>Berat (kg)</label><input type="number" step="0.1" id="vr-weight" value="${existing.weight||''}"></div>
    </div>

    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">Catatan Klinis</div>
    <div class="form-group"><label>Keluhan</label><textarea id="vr-complaint" rows="2">${existing.complaint||''}</textarea></div>
    <div class="form-group"><label>Tindakan yang Dilakukan</label><textarea id="vr-actions" rows="2">${existing.actions_done||''}</textarea></div>
    <div class="form-group"><label>Catatan Asuhan</label><textarea id="vr-notes" rows="2">${existing.nursing_notes||''}</textarea></div>

    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin:8px 0;display:flex;justify-content:space-between;align-items:center">
      <span>Bahan / BHP Dipakai (potong stok otomatis)</span>
      <button class="btn btn-xs btn-ghost" onclick="addHCBhpRow()" ${hcInvItems.length?'':'disabled'}>+ Item</button>
    </div>
    ${hcInvItems.length?'<div id="hc-bhp-table"></div>':'<div class="form-hint" style="color:#F59E0B">Data inventory tidak tersedia — lewati BHP.</div>'}

    <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin:8px 0">Persetujuan & Bukti</div>
    <div class="form-group"><label>URL Foto Bukti Kunjungan (opsional)</label>
      <input type="text" id="vr-photo" value="${existing.photo_url||''}" placeholder="https://..."></div>
    <div class="form-group" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="vr-consent" ${existing.consent_given?'checked':''} style="width:auto">
      <label style="margin:0">Pasien/keluarga menyetujui tindakan (informed consent)</label>
    </div>
    <div class="form-group"><label>Nama Penandatangan Consent</label>
      <input type="text" id="vr-consent-name" value="${existing.consent_name||o.patient_name||''}"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveHCVisit(${id}, ${existing.id||'null'})">🎉 Simpan & Tandai Selesai</button>
    </div>`, 'wide');
  if (hcInvItems.length) renderHCBhp();
}

// ── BHP dipakai (Fase 3) — dinamis, potong stok via issueStock ──
function addHCBhpRow() { hcBhpLines.push({ item_id:'', qty:1 }); renderHCBhp(); }
function removeHCBhpRow(idx) { hcBhpLines.splice(idx,1); renderHCBhp(); }
function updateHCBhp(idx, field, val) { if (hcBhpLines[idx]) { hcBhpLines[idx][field] = field==='qty'?(parseFloat(val)||0):val; } }
function renderHCBhp() {
  const el = document.getElementById('hc-bhp-table'); if (!el) return;
  if (!hcBhpLines.length) { el.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:4px 0">Belum ada BHP. Klik "+ Item".</div>`; return; }
  el.innerHTML = `<table style="width:100%;font-size:12px"><tbody>${hcBhpLines.map((b,idx)=>{
    const item = hcInvItems.find(i=>String(i.id)===String(b.item_id));
    return `<tr>
      <td style="padding:3px"><select onchange="updateHCBhp(${idx},'item_id',this.value)" style="font-size:11px;padding:4px;width:100%">
        <option value="">-- Pilih Barang --</option>
        ${hcInvItems.map(i=>`<option value="${i.id}" ${String(b.item_id)===String(i.id)?'selected':''}>${i.item_name} (stok ${i.stock_qty||0} ${i.unit||''})</option>`).join('')}
      </select></td>
      <td style="padding:3px;width:70px"><input type="number" min="0" value="${b.qty||0}" onchange="updateHCBhp(${idx},'qty',this.value)" style="width:60px;font-size:11px;padding:4px"></td>
      <td style="padding:3px;width:30px"><button class="act-btn del" onclick="removeHCBhpRow(${idx})">✕</button></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function saveHCVisit(orderId, recordId) {
  const num = v => { const n=parseFloat(document.getElementById(v)?.value); return isNaN(n)?null:n; };
  const payload = {
    order_id:     orderId,
    bp_systolic:  num('vr-sys'),
    bp_diastolic: num('vr-dia'),
    pulse:        num('vr-pulse'),
    temperature:  num('vr-temp'),
    resp_rate:    num('vr-resp'),
    spo2:         num('vr-spo2'),
    weight:       num('vr-weight'),
    complaint:      document.getElementById('vr-complaint').value.trim(),
    actions_done:   document.getElementById('vr-actions').value.trim(),
    nursing_notes:  document.getElementById('vr-notes').value.trim(),
    photo_url:      document.getElementById('vr-photo').value.trim(),
    consent_given:  document.getElementById('vr-consent').checked,
    consent_name:   document.getElementById('vr-consent-name').value.trim(),
    recorded_by:    getUserName?getUserName():'User',
    recorded_at:    new Date().toISOString(),
    updated_at:     new Date().toISOString(),
  };
  // Validasi BHP: stok cukup
  const bhp = hcBhpLines.filter(b=>b.item_id && (b.qty||0)>0);
  for (const b of bhp) {
    const item = hcInvItems.find(i=>String(i.id)===String(b.item_id));
    if (item && b.qty > (item.stock_qty||0)) { toast(`Stok ${item.item_name} tidak cukup (${item.stock_qty})`,'err'); return; }
  }
  try {
    if (recordId) await sbPatch('homecare_visit_records', recordId, payload);
    else          await sbPost('homecare_visit_records', payload);
    // Fase 3: potong stok BHP via helper global issueStock (dari inventory.js)
    let bhpValue = 0;
    if (bhp.length && typeof window.issueStock==='function') {
      for (const b of bhp) {
        const item = hcInvItems.find(i=>String(i.id)===String(b.item_id));
        bhpValue += (item?.unit_price||0)*b.qty;
        await window.issueStock(b.item_id, b.qty, 'homecare', orderId, null, `Pemakaian Home Care order #${orderId}`);
      }
    }
    await sbPatch('homecare_orders', orderId, { status:'Selesai', bhp_value:bhpValue, updated_at:new Date().toISOString() });
    await logActivity('complete','homecare_orders',orderId,`Kunjungan selesai${bhp.length?` · ${bhp.length} BHP dipakai`:''}`, '');
    toast('✅ Kunjungan terdokumentasi & selesai','ok');
    closeModalForce();
    await loadHCOrders();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function viewHCVisit(orderId) {
  const rec = (await sbGet('homecare_visit_records',`select=*&order_id=eq.${orderId}&order=id.desc&limit=1`).catch(()=>[]))?.[0];
  if (!rec) {
    openModal(`<div class="modal-header"><div class="modal-title">📋 Rekam Kunjungan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
      <div class="empty-state"><div class="ico">📋</div><h3>Belum ada dokumentasi</h3>
        <button class="btn btn-teal" style="margin-top:10px" onclick="closeModalForce();completeHCVisit(${orderId})">+ Isi Dokumentasi</button></div>`);
    return;
  }
  const row = (l,v)=> v!=null&&v!==''?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12.5px"><span style="color:var(--gray)">${l}</span><strong>${v}</strong></div>`:'';
  openModal(`
    <div class="modal-header"><div class="modal-title">📋 Rekam Kunjungan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Dicatat oleh ${rec.recorded_by||'—'} · ${rec.recorded_at?new Date(rec.recorded_at).toLocaleString('id-ID'):''}</div>
    ${row('Tekanan Darah', (rec.bp_systolic||rec.bp_diastolic)?`${rec.bp_systolic||'—'}/${rec.bp_diastolic||'—'} mmHg`:'')}
    ${row('Nadi', rec.pulse?rec.pulse+' x/mnt':'')}
    ${row('Suhu', rec.temperature?rec.temperature+' °C':'')}
    ${row('Napas', rec.resp_rate?rec.resp_rate+' x/mnt':'')}
    ${row('SpO₂', rec.spo2?rec.spo2+' %':'')}
    ${row('Berat', rec.weight?rec.weight+' kg':'')}
    ${row('Keluhan', rec.complaint)}
    ${row('Tindakan', rec.actions_done)}
    ${row('Catatan Asuhan', rec.nursing_notes)}
    ${row('Informed Consent', rec.consent_given?`✅ Ya (${rec.consent_name||'—'})`:'❌ Tidak')}
    ${rec.photo_url?`<div style="margin-top:10px"><a href="${rec.photo_url}" target="_blank" class="btn btn-ghost btn-sm">🖼️ Lihat Foto Bukti</a></div>`:''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="closeModalForce();completeHCVisit(${orderId})">✏️ Edit Dokumentasi</button>
    </div>`);
}

// ══════════════════════════════════════════════════════════════
// BILLING (Fase 3) — tandai ditagih / lunas, opsional buat invoice
// ══════════════════════════════════════════════════════════════
async function openHCBillingAction(id) {
  const o = hcAll.find(x=>x.id===id) || {};
  const isDitagih = o.billing_status==='Ditagih';
  openModal(`
    <div class="modal-header"><div class="modal-title">🧾 Billing — ${o.patient_name||''}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;margin-bottom:12px">
      <div><strong>Layanan:</strong> ${o.service_type||'—'}</div>
      <div><strong>Tarif:</strong> ${formatCurrency(o.total_amount||0)}</div>
      <div><strong>Komisi Nakes:</strong> ${formatCurrency(o.commission_amount||0)}</div>
      <div><strong>Nilai BHP:</strong> ${formatCurrency(o.bhp_value||0)}</div>
      <div style="grid-column:1/-1"><strong>Status Saat Ini:</strong> ${o.billing_status||'Belum Ditagih'}</div>
      <div style="grid-column:1/-1;padding-top:6px;border-top:1px solid var(--border)">
        <strong>Margin Kotor:</strong> ${formatCurrency((o.total_amount||0)-(o.commission_amount||0)-(o.bhp_value||0))}</div>
    </div>
    ${!isDitagih&&o.partner_id?`<div class="form-group" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="hcb-mkinv" style="width:auto" checked>
      <label style="margin:0">Buat Invoice di modul Finance (partner terkait)</label></div>`:''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="setHCBilling(${id},'${isDitagih?'Lunas':'Ditagih'}')">
        ${isDitagih?'✅ Tandai Lunas':'🧾 Tandai Ditagih'}</button>
    </div>`);
}

async function setHCBilling(id, status) {
  const o = hcAll.find(x=>x.id===id) || {};
  const mkInv = document.getElementById('hcb-mkinv')?.checked;
  try {
    const patch = { billing_status:status, updated_at:new Date().toISOString() };
    if (status==='Ditagih') patch.billed_at = new Date().toISOString();

    // Opsional: buat invoice di modul Finance bila ada partner terkait
    if (status==='Ditagih' && mkInv && o.partner_id) {
      try {
        const yr=new Date().getFullYear(), mo=String(new Date().getMonth()+1).padStart(2,'0');
        const inv = await sbPost('invoices', {
          invoice_number: `INV/${yr}/${mo}/${Date.now().toString().slice(-4)}`,
          invoice_date: new Date().toISOString().split('T')[0],
          partner_id: o.partner_id, service_type: 'Home Care',
          subtotal: o.total_amount||0, discount: 0, ppn_percent: 0,
          total_amount: o.total_amount||0, status: 'Draft',
          notes: `Home Care · ${o.service_type||''} · ${o.patient_name||''}`,
          created_by_name: getUserName?getUserName():'User',
          updated_at: new Date().toISOString(),
        });
        const invId = inv?.[0]?.id || inv?.id;
        if (invId) patch.invoice_id = invId;
        toast('🧾 Invoice dibuat di Finance','ok');
      } catch(err) { toast('⚠️ Invoice gagal dibuat: '+err.message,'warn'); }
    }

    await sbPatch('homecare_orders', id, patch);
    await logActivity('billing','homecare_orders',id,`Billing → ${status}`, o.patient_name||'');
    toast(`✅ Billing → ${status}`,'ok');
    closeModalForce(); await loadHCOrders();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// RATING & FEEDBACK PASIEN (Fase 4)
// ══════════════════════════════════════════════════════════════
function openHCRating(id) {
  const o = hcAll.find(x=>x.id===id) || {};
  openModal(`
    <div class="modal-header"><div class="modal-title">⭐ Kepuasan Pasien — ${o.patient_name||''}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Rating (1–5)</label>
      <select id="hcr-rating">
        <option value="">-- Belum dinilai --</option>
        ${[1,2,3,4,5].map(n=>`<option value="${n}" ${String(o.rating)===String(n)?'selected':''}>${'⭐'.repeat(n)} (${n})</option>`).join('')}
      </select></div>
    <div class="form-group"><label>Masukan / Keluhan</label>
      <textarea id="hcr-feedback" rows="3">${o.feedback||''}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveHCRating(${id})">💾 Simpan</button>
    </div>`);
}

async function saveHCRating(id) {
  const rating = parseInt(document.getElementById('hcr-rating').value)||null;
  const feedback = document.getElementById('hcr-feedback').value.trim();
  try {
    await sbPatch('homecare_orders', id, { rating, feedback, updated_at:new Date().toISOString() });
    toast('✅ Penilaian tersimpan','ok');
    closeModalForce(); await loadHCOrders();
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
  if (next==='Selesai') { completeHCVisit(id); return; }  // Fase 2: dokumentasi dulu
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
    const cancelled = orders.filter(o=>o.status==='Dibatalkan');
    const rev    = done.reduce((s,o)=>s+(o.total_amount||0),0);
    const byService={};
    done.forEach(o=>{ byService[o.service_type||'Lainnya']=(byService[o.service_type||'Lainnya']||0)+1; });

    // Fase 4: analitik SLA, kepuasan, profitabilitas, billing
    const rated = done.filter(o=>o.rating);
    const avgRating = rated.length ? (rated.reduce((s,o)=>s+(o.rating||0),0)/rated.length) : 0;
    const totalComm = done.reduce((s,o)=>s+(o.commission_amount||0),0);
    const totalBhp  = done.reduce((s,o)=>s+(o.bhp_value||0),0);
    const margin    = rev - totalComm - totalBhp;
    const completionRate = orders.length ? Math.round(done.length/orders.length*100) : 0;
    const unbilled = done.filter(o=>(o.billing_status||'Belum Ditagih')!=='Lunas');
    const unbilledVal = unbilled.reduce((s,o)=>s+(o.total_amount||0),0);
    const byNakes={};
    done.forEach(o=>{ const n=o.assigned_staff||'Tidak Diketahui';
      if(!byNakes[n]) byNakes[n]={n:0,rev:0,rate:[]};
      byNakes[n].n++; byNakes[n].rev+=(o.total_amount||0); if(o.rating) byNakes[n].rate.push(o.rating); });

    el.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
        ${[
          {l:'Total Order',v:orders.length,c:'#0A2342'},
          {l:'Selesai',    v:done.length,  c:'#22C55E'},
          {l:'Dibatalkan', v:cancelled.length,c:'#EF4444'},
          {l:'Tingkat Penyelesaian', v:completionRate+'%',c:'#0EA5E9'},
          {l:'Revenue',    v:formatCurrency(rev),c:'#8B5CF6'},
          {l:'Margin Kotor', v:formatCurrency(margin),c:'#00897B'},
          {l:'Rata Kepuasan', v:avgRating?avgRating.toFixed(1)+'/5':'—',c:'#F59E0B'},
          {l:'Belum Lunas',  v:formatCurrency(unbilledVal),c:'#DC2626'},
        ].map(k=>`<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);border-left:4px solid ${k.c}">
          <div style="font-size:${String(k.v).length>8?'12px':'16px'};font-weight:800;color:${k.c}">${k.v}</div>
          <div style="font-size:10px;color:var(--gray)">${k.l}</div>
        </div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="card">
          <div class="card-title" style="margin-bottom:10px">Per Jenis Layanan</div>
          ${Object.entries(byService).sort((a,b)=>b[1]-a[1]).map(([s,c])=>`
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px">
              <span>${s}</span><strong>${c} order</strong>
            </div>`).join('')||'<div style="color:var(--gray)">Belum ada data</div>'}
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:10px">Struktur Biaya</div>
          ${[
            {l:'Revenue', v:rev, c:'#8B5CF6'},
            {l:'– Komisi Nakes', v:totalComm, c:'#F59E0B'},
            {l:'– Nilai BHP', v:totalBhp, c:'#EF4444'},
            {l:'= Margin Kotor', v:margin, c:'#00897B'},
          ].map(r=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px">
            <span>${r.l}</span><strong style="color:${r.c}">${formatCurrency(r.v)}</strong></div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:10px">Kinerja per Nakes</div>
        <div class="table-wrap"><table><thead><tr><th>Nakes</th><th>Kunjungan</th><th>Revenue</th><th>Rata Rating</th></tr></thead>
          <tbody>${Object.entries(byNakes).sort((a,b)=>b[1].rev-a[1].rev).map(([n,d])=>{
            const ar = d.rate.length ? (d.rate.reduce((s,x)=>s+x,0)/d.rate.length).toFixed(1) : '—';
            return `<tr><td style="font-weight:600">${n}</td>
              <td style="text-align:center">${d.n}</td>
              <td style="font-weight:600">${formatCurrency(d.rev)}</td>
              <td style="text-align:center">${ar==='—'?'—':'⭐ '+ar}</td></tr>`;
          }).join('')||'<tr><td colspan="4" style="color:var(--gray);padding:8px">Belum ada data</td></tr>'}</tbody></table></div>
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
