// ═══════════════════════════════════════════
// PARTNER SUB-MODULE: Deals + MOU + Project
// ═══════════════════════════════════════════

const DEAL_TYPES = [
  { key:'MCU',          label:'🏥 MCU Karyawan',         color:'#0EA5E9', nextModule:'project' },
  { key:'HealthDay',    label:'📅 Employee Health Day',  color:'#6366F1', nextModule:'project' },
  { key:'Screening',    label:'🎯 Skrining Massal',      color:'#F59E0B', nextModule:'project' },
  { key:'Wellness',     label:'💪 Program Wellness',     color:'#22C55E', nextModule:'project' },
  { key:'Branding',     label:'📣 Branding Platform',    color:'#8B5CF6', nextModule:'mou' },
  { key:'OfficeCare',   label:'🏢 Office Care',          color:'#F97316', nextModule:'mou' },
  { key:'HomeCare',     label:'🏠 Home Care',            color:'#EF4444', nextModule:'mou' },
  { key:'Personal',     label:'👤 Personal Health',      color:'#EC4899', nextModule:null },
  { key:'LabDiagnostic',label:'🔬 Lab Diagnostik',       color:'#14B8A6', nextModule:'mou' },
  { key:'Lainnya',      label:'📋 Lainnya',              color:'#94A3B8', nextModule:null },
];

const DEAL_FREQ  = ['Sekali','Per Event','Bulanan','Kuartalan','Tahunan','Ongoing'];
const DEAL_STATUS = ['Active','Inactive','Completed','Expired'];

async function openDealsModal(partnerId, partnerName) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">🤝 Output Kerjasama — ${partnerName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <!-- Summary -->
    <div id="deals-summary-${partnerId}"></div>

    <div style="margin-bottom:12px;display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btn-teal btn-sm" onclick="openDealForm(${partnerId},null,'${partnerName.replace(/'/g,"\\'")}')">
        ➕ Tambah Output Kerjasama
      </button>
    </div>

    <div id="deals-list-${partnerId}">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`);

  await loadDeals(partnerId);
}

async function loadDeals(partnerId) {
  try {
    const data = await sbGet('partner_deals',
      `select=*&partner_id=eq.${partnerId}&order=created_at.desc`);
    renderDealsList(partnerId, Array.isArray(data)?data:[]);
  } catch(e) {
    const el = document.getElementById(`deals-list-${partnerId}`);
    if (el) el.innerHTML = `<div class="status-box status-err">❌ ${e.message}</div>`;
  }
}

function renderDealsList(partnerId, deals) {
  const el = document.getElementById(`deals-list-${partnerId}`);
  if (!el) return;

  // Summary
  const sumEl = document.getElementById(`deals-summary-${partnerId}`);
  if (sumEl && deals.length) {
    const active = deals.filter(d=>d.status==='Active');
    const totalVal = active.reduce((s,d)=>s+(d.value||0),0);
    sumEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
        <div style="background:var(--mint);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--navy)">${deals.length}</div>
          <div style="font-size:11px;color:var(--gray)">Total Output</div>
        </div>
        <div style="background:#E8F5E9;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#2E7D32">${active.length}</div>
          <div style="font-size:11px;color:var(--gray)">Aktif</div>
        </div>
        <div style="background:#FFF8E1;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:14px;font-weight:800;color:#F57F17">${formatCurrency(totalVal)}</div>
          <div style="font-size:11px;color:var(--gray)">Nilai Aktif</div>
        </div>
      </div>`;
  }

  if (!deals.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:30px">
        <div class="ico">🤝</div>
        <h3>Belum ada output kerjasama</h3>
        <p>Catat setiap output kerjasama: MCU, Wellness, Branding, dll.<br>
        Masing-masing output bisa dilanjutkan ke MOU atau Project.</p>
      </div>`; return;
  }

  el.innerHTML = deals.map(d => {
    const dt = DEAL_TYPES.find(t=>t.key===d.deal_type)||{color:'#94A3B8',label:d.deal_type||'—',nextModule:null};
    const stColors = {Active:'#22C55E',Completed:'#06B6D4',Inactive:'#94A3B8',Expired:'#EF4444'};
    const stColor  = stColors[d.status]||'#94A3B8';

    return `
      <div style="border:1.5px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden">
        <!-- Header -->
        <div style="background:${dt.color}15;border-left:4px solid ${dt.color};padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--navy)">${d.deal_name}</div>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
              <span style="background:${dt.color}20;color:${dt.color};padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">${dt.label}</span>
              <span style="background:${stColor}20;color:${stColor};padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">${d.status}</span>
              ${d.frequency?`<span class="badge badge-gray" style="font-size:10px">${d.frequency}</span>`:''}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="act-btn edit" onclick="openDealForm(${d.partner_id},${d.id})">✏️</button>
            <button class="act-btn del" onclick="deleteDeal(${d.id},${d.partner_id})">🗑</button>
          </div>
        </div>

        <!-- Body -->
        <div style="padding:12px 14px;background:#fff">
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">
            ${d.value?`<div style="font-size:12px"><span style="color:var(--gray)">Nilai:</span> <strong style="color:var(--navy)">${formatCurrency(d.value)}</strong></div>`:''}
            ${d.participant_count?`<div style="font-size:12px"><span style="color:var(--gray)">Peserta:</span> <strong>${d.participant_count} orang</strong></div>`:''}
            ${d.start_date?`<div style="font-size:12px;color:var(--gray)">${formatDateShort(d.start_date)}${d.end_date?' → '+formatDateShort(d.end_date):''}</div>`:''}
            ${d.pic_partner?`<div style="font-size:12px;color:var(--gray)">PIC: ${d.pic_partner}</div>`:''}
          </div>
          ${d.description?`<div style="font-size:12px;color:var(--gray);margin-bottom:8px">${d.description}</div>`:''}
          ${d.next_action?`
            <div style="background:#FFF8E1;border-radius:6px;padding:8px 10px;font-size:12px;color:#5D4037;margin-bottom:8px">
              ⚡ <strong>Next Action:</strong> ${d.next_action}
              ${d.next_action_date?` — <strong>${formatDateShort(d.next_action_date)}</strong>`:''}
            </div>`:''}

          <!-- Next Step Buttons -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--border)">
            ${dt.nextModule==='mou'?`
              <button class="btn btn-outline btn-sm" onclick="openMOUFromDeal(${d.id},${d.partner_id},'${(d.deal_name||'').replace(/'/g,"\\'")}')">
                📜 Buat MOU
              </button>`:
            dt.nextModule==='project'?`
              <button class="btn btn-outline btn-sm" onclick="openProjectFromDeal(${d.id},${d.partner_id},'${(d.deal_name||'').replace(/'/g,"\\'")}')">
                📋 Buat Project
              </button>`:''}
            <button class="btn btn-ghost btn-sm" onclick="openDealForm(${d.partner_id},${d.id})">
              ✏️ Edit Detail
            </button>
            ${d.status==='Active'?`
              <button class="btn btn-ghost btn-sm" onclick="completeDeal(${d.id},${d.partner_id})" style="color:var(--teal)">
                ✅ Selesai
              </button>`:''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Deal Form ─────────────────────────────────────
async function openDealForm(partnerId, dealId=null, partnerNameHint='') {
  let d = {};
  if (dealId) {
    const data = await sbGet('partner_deals',`select=*&id=eq.${dealId}`);
    d = data[0]||{};
  }

  const overlay = document.createElement('div');
  overlay.id = 'deal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:600;display:flex;align-items:center;justify-content:center;padding:14px;overflow-y:auto';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:540px;width:100%;padding:22px;max-height:92vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:16px;font-weight:800;color:var(--navy)">${dealId?'✏️ Edit Output Kerjasama':'➕ Tambah Output Kerjasama'}</div>
        <button onclick="document.getElementById('deal-overlay').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--gray)">✕</button>
      </div>

      <div class="form-group">
        <label>Tipe Output Kerjasama *</label>
        <select id="df-type" onchange="updateDealTypeInfo()">
          ${DEAL_TYPES.map(t=>`<option value="${t.key}"${(d.deal_type||'MCU')===t.key?' selected':''}>${t.label}</option>`).join('')}
        </select>
        <div id="df-type-info" style="font-size:12px;color:var(--gray);margin-top:4px;padding:6px 10px;background:var(--lgray);border-radius:6px"></div>
      </div>

      <div class="form-group">
        <label>Nama Output / Program *</label>
        <input type="text" id="df-name" value="${d.deal_name||''}"
          placeholder="MCU Karyawan PT. ABC 2026, Health Day Mei 2026...">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select id="df-status">
            ${DEAL_STATUS.map(s=>`<option${(d.status||'Active')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Frekuensi</label>
          <select id="df-freq">
            <option value="">Pilih...</option>
            ${DEAL_FREQ.map(f=>`<option${d.frequency===f?' selected':''}>${f}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Nilai Kerjasama (Rp)</label>
          <input type="number" id="df-value" value="${d.value||''}" placeholder="0">
        </div>
        <div class="form-group">
          <label>Jumlah Peserta</label>
          <input type="number" id="df-participants" value="${d.participant_count||''}" placeholder="0">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Tanggal Mulai</label>
          <input type="date" id="df-start" value="${d.start_date||''}">
        </div>
        <div class="form-group">
          <label>Tanggal Selesai</label>
          <input type="date" id="df-end" value="${d.end_date||''}">
        </div>
      </div>

      <div class="form-group">
        <label>PIC dari Partner</label>
        <input type="text" id="df-pic" value="${d.pic_partner||''}"
          placeholder="Nama kontak HRD / Manager">
      </div>

      <div class="form-group">
        <label>Deskripsi / Lingkup Layanan</label>
        <textarea id="df-desc" rows="3"
          placeholder="Detail layanan, jumlah peserta, jenis pemeriksaan yang disepakati...">${d.description||''}</textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Next Action</label>
          <input type="text" id="df-next" value="${d.next_action||''}"
            placeholder="Follow up proposal, kirim MOU...">
        </div>
        <div class="form-group">
          <label>Deadline Next Action</label>
          <input type="date" id="df-next-date" value="${d.next_action_date||''}">
        </div>
      </div>

      <div class="form-group">
        <label>Catatan Internal</label>
        <textarea id="df-notes" rows="2"
          placeholder="Catatan tim OneLab...">${d.notes||''}</textarea>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
        <button class="btn btn-ghost" onclick="document.getElementById('deal-overlay').remove()">Batal</button>
        <button class="btn btn-teal" id="df-save-btn" onclick="saveDeal(${partnerId},${dealId||'null'})">
          ${dealId?'💾 Simpan':'➕ Tambah'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  updateDealTypeInfo();
}

function updateDealTypeInfo() {
  const type = document.getElementById('df-type')?.value;
  const dt = DEAL_TYPES.find(t=>t.key===type)||{};
  const el = document.getElementById('df-type-info');
  if (!el) return;
  const nextInfo = dt.nextModule==='mou'
    ? '→ Output ini akan dilanjutkan ke <strong>MOU / Perjanjian</strong>'
    : dt.nextModule==='project'
    ? '→ Output ini akan dilanjutkan ke <strong>Project / Eksekusi</strong>'
    : '→ Output langsung tanpa MOU/Project';
  el.innerHTML = nextInfo;
}

async function saveDeal(partnerId, dealId) {
  const name = document.getElementById('df-name').value.trim();
  const type = document.getElementById('df-type').value;
  if (!name) { toast('Nama output wajib diisi','err'); return; }

  const btn = document.getElementById('df-save-btn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Menyimpan...'; }

  const payload = {
    partner_id:        partnerId,
    deal_name:         name,
    deal_type:         type,
    status:            document.getElementById('df-status').value,
    value:             parseFloat(document.getElementById('df-value').value)||0,
    frequency:         document.getElementById('df-freq').value,
    participant_count: parseInt(document.getElementById('df-participants').value)||0,
    start_date:        document.getElementById('df-start').value||null,
    end_date:          document.getElementById('df-end').value||null,
    pic_partner:       document.getElementById('df-pic').value.trim(),
    description:       document.getElementById('df-desc').value.trim(),
    next_action:       document.getElementById('df-next').value.trim(),
    next_action_date:  document.getElementById('df-next-date').value||null,
    notes:             document.getElementById('df-notes').value.trim(),
    requires_mou:      ['Branding','OfficeCare','HomeCare','LabDiagnostic'].includes(type),
    updated_at:        new Date().toISOString(),
    created_by_name:   getUserName ? getUserName() : 'User',
  };

  try {
    if (dealId) {
      await sbPatch('partner_deals', dealId, payload);
      toast('✅ Output kerjasama diupdate','ok');
    } else {
      const res = await sbPost('partner_deals', payload);
      if (res?.[0]) {
        await logActivity('create','partner_deals',res[0].id,`Output kerjasama baru: ${name}`,name);
      }
      toast('✅ Output kerjasama ditambahkan','ok');

      // Auto update partner status ke Aktif
      await sbPatch('partners', partnerId, {status:'Aktif',updated_at:new Date().toISOString()});
    }
    document.getElementById('deal-overlay')?.remove();
    await loadDeals(partnerId);
  } catch(e) {
    toast('❌ '+e.message,'err');
    if (btn) { btn.disabled=false; btn.textContent=dealId?'💾 Simpan':'➕ Tambah'; }
  }
}

async function completeDeal(dealId, partnerId) {
  if (!confirm('Tandai kerjasama ini sebagai Selesai?')) return;
  try {
    await sbPatch('partner_deals', dealId, {status:'Completed',updated_at:new Date().toISOString()});
    toast('✅ Kerjasama ditandai Selesai','ok');
    await loadDeals(partnerId);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deleteDeal(dealId, partnerId) {
  if (!confirm('Hapus output kerjasama ini?')) return;
  try {
    await sbDelete('partner_deals', dealId);
    toast('🗑 Dihapus','info');
    await loadDeals(partnerId);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Next Step: MOU ────────────────────────────────
function openMOUFromDeal(dealId, partnerId, dealName) {
  document.getElementById('deal-overlay')?.remove();
  closeModalForce();
  navigate('mou');
  setTimeout(() => {
    if (typeof openMOUForm === 'function') openMOUForm(null, partnerId, dealId, dealName);
  }, 400);
}

// ── Next Step: Project ────────────────────────────
function openProjectFromDeal(dealId, partnerId, dealName) {
  document.getElementById('deal-overlay')?.remove();
  closeModalForce();
  // Pre-fill MCU form with deal data
  setTimeout(async () => {
    navigate('mcu');
    setTimeout(() => openMCUForm(null, partnerId, dealId), 400);
  }, 200);
}
