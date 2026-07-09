// ═══════════════════════════════════════════════════
// Module: Voucher Engine
// - Campaign management
// - Generate massal dengan kode sequence
// - Background image upload
// - QR Code
// - Share WA / Email
// - Arsip & tracking
// ═══════════════════════════════════════════════════

const SERVICES_LIST = [
  'Skrining Diabetes (HbA1c)',
  'Skrining Kolesterol Lengkap',
  'Skrining Hipertensi',
  'Skrining Asam Urat',
  'FOB (Deteksi Kanker Usus)',
  'Gut Health Program',
  'Pap Smear',
  'HPV Genotyping',
  'Gene Solution Colon Cancer',
  'Gene Solution Cervical Cancer',
  'MCU Dasar',
  'MCU Eksekutif',
  'Konsultasi Dokter',
  'Pickup Sample Gratis',
];

async function renderVoucher(){
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Voucher Builder</h1><p>Buat campaign, generate voucher massal, share WA/Email, dan tracking redeem</p></div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="openCampaignForm()">+ Campaign Baru</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchVoucherTab('campaigns',this)">🎯 Campaign</button>
      <button class="tab-btn" onclick="switchVoucherTab('vouchers',this)">🎟 Daftar Voucher</button>
    </div>

    <div id="campaigns-tab">
      <div id="campaigns-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>

    <div id="vouchers-tab" style="display:none">
      <div class="table-wrap">
        <div class="table-toolbar">
          <input class="table-search" id="vc-search" placeholder="🔍 Cari kode, nama penerima..."
            oninput="filterVouchers(this.value)">
          <select class="table-filter" id="vc-campaign" onchange="filterVouchers()">
            <option value="">Semua Campaign</option>
          </select>
          <select class="table-filter" id="vc-status" onchange="filterVouchers()">
            <option value="">Semua Status</option>
            <option>Active</option><option>Used</option><option>Expired</option><option>Cancelled</option>
          </select>
        </div>
        <div id="vouchers-table"><div class="loading-row"><div class="spinner"></div></div></div>
      </div>
    </div>`;

  await loadCampaigns();
  await loadAllVouchers();
}

let voucherState = { campaigns:[], vouchers:[], activeCampaign:null };
let allVouchers = [];

async function switchVoucherTab(tab, btn){
  document.querySelectorAll('.tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  document.getElementById('campaigns-tab').style.display = tab==='campaigns'?'block':'none';
  document.getElementById('vouchers-tab').style.display  = tab==='vouchers' ?'block':'none';
  if(tab==='vouchers') await loadAllVouchers();
}

// ── Campaigns ─────────────────────────────────────
async function loadCampaigns(){
  try {
    const data = await sbGet('voucher_campaigns','select=*&order=created_at.desc');
    voucherState.campaigns = Array.isArray(data)?data:[];
    renderCampaigns();
  } catch(e){
    document.getElementById('campaigns-grid').innerHTML=
      `<div class="status-box status-err" style="grid-column:1/-1">❌ ${e.message}</div>`;
  }
}

function renderCampaigns(){
  const campaigns = voucherState.campaigns;
  if(!campaigns.length){
    document.getElementById('campaigns-grid').innerHTML=`
      <div class="empty-state" style="grid-column:1/-1">
        <div class="ico">🎯</div><h3>Belum ada campaign</h3>
        <p>Buat campaign pertama untuk mulai generate voucher.</p>
      </div>`;
    return;
  }
  document.getElementById('campaigns-grid').innerHTML = campaigns.map(c=>{
    const services = tryParseJSON(c.services)||[];
    const validUntil = c.valid_until ? new Date(c.valid_until).toLocaleDateString('id-ID') : '∞';
    const discText = c.discount_type==='percent' ? `${c.discount_value}%` : `Rp ${(c.discount_value||0).toLocaleString()}`;
    return `
      <div class="card" style="border-left:4px solid ${c.primary_color||'var(--teal)'}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--navy)">${c.campaign_name}</div>
            <div style="font-size:12px;color:var(--gray);margin-top:2px">${c.description||''}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="act-btn edit" onclick="openCampaignForm(${c.id})">✏️</button>
            <button class="act-btn del" onclick="deleteCampaign(${c.id},'${(c.campaign_name||'').replace(/'/g,"\\'")}')">🗑</button>
          </div>
        </div>

        <!-- Voucher Preview Mini -->
        <div style="background:${c.bg_color||'#0A2342'};border-radius:10px;padding:14px;margin-bottom:12px;color:#fff;position:relative;overflow:hidden">
          ${c.bg_image_url?`<img src="${c.bg_image_url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.25">`:'' }
          <div style="position:relative;z-index:1">
            <div style="font-size:10px;opacity:.7;margin-bottom:4px">OneLab Diagnostics</div>
            <div style="font-size:22px;font-weight:800;color:${c.primary_color||'#00BFA5'}">${discText} OFF</div>
            <div style="font-size:11px;opacity:.8;margin-top:4px">${services.slice(0,2).join(' · ')}${services.length>2?` +${services.length-2} lainnya`:''}</div>
            <div style="font-size:10px;opacity:.6;margin-top:8px">Berlaku s/d ${validUntil}</div>
          </div>
        </div>

        <div class="btn-row">
          <button class="btn btn-teal btn-sm" style="flex:1" onclick="openGenerateModal(${c.id})">
            🎟 Generate Voucher
          </button>
          <button class="btn btn-outline btn-sm" onclick="viewCampaignVouchers(${c.id})">
            Lihat Voucher
          </button>
        </div>
      </div>`;
  }).join('');
}

// ── Campaign Form ─────────────────────────────────
async function openCampaignForm(id=null){
  let c = {};
  if(id){
    const data = await sbGet('voucher_campaigns',`select=*&id=eq.${id}`);
    c = data[0]||{};
  }
  const selectedServices = tryParseJSON(c.services)||[];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Campaign':'🎯 Buat Campaign Baru'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Nama Campaign *</label>
      <input type="text" id="cf-name" value="${c.campaign_name||''}" placeholder="Health Talk Mei 2026">
    </div>
    <div class="form-group">
      <label>Deskripsi</label>
      <input type="text" id="cf-desc" value="${c.description||''}" placeholder="Voucher untuk peserta health talk">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipe Diskon</label>
        <select id="cf-dtype">
          <option value="percent"${c.discount_type!=='fixed'?' selected':''}>Persen (%)</option>
          <option value="fixed"${c.discount_type==='fixed'?' selected':''}>Nominal (Rp)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nilai Diskon</label>
        <input type="number" id="cf-dval" value="${c.discount_value||25}" min="0">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Berlaku Dari</label>
        <input type="date" id="cf-from" value="${c.valid_from||new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Berlaku Sampai</label>
        <input type="date" id="cf-until" value="${c.valid_until||''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Warna Background</label>
        <input type="color" id="cf-bgcolor" value="${c.bg_color||'#0A2342'}" style="height:42px;width:100%;padding:4px">
      </div>
      <div class="form-group">
        <label>Warna Aksen</label>
        <input type="color" id="cf-accolor" value="${c.primary_color||'#00897B'}" style="height:42px;width:100%;padding:4px">
      </div>
    </div>
    <div class="form-group">
      <label>URL Gambar Background (opsional)</label>
      <input type="text" id="cf-bgimg" value="${c.bg_image_url||''}" placeholder="https://... atau upload ke Supabase Storage">
    </div>
    <div class="form-group">
      <label>Layanan yang Termasuk</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:200px;overflow-y:auto;padding:8px;background:var(--lgray);border-radius:8px">
        ${SERVICES_LIST.map(s=>`
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:4px">
            <input type="checkbox" class="svc-chk" value="${s}"
              ${selectedServices.includes(s)?'checked':''}> ${s}
          </label>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Template Pesan WA (untuk share voucher)</label>
      <textarea id="cf-wa-tmpl" rows="4" placeholder="Halo {NAMA}, berikut voucher skrining Anda:\n\nKode: {KODE}\nDiskon: {DISKON}\nBerlaku: {BERLAKU}\n\nBooking: wa.me/62xxx">${c.wa_template||getDefaultWATemplate()}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveCampaign(${id||'null'})">
        ${id?'💾 Simpan':'🎯 Buat Campaign'}
      </button>
    </div>`);
}

function getDefaultWATemplate(){
  return `Halo {NAMA} 👋

Berikut voucher skrining kesehatan Anda dari *OneLab Diagnostics* 🏥

🎟 *Kode Voucher:* {KODE}
💰 *Diskon:* {DISKON}
📋 *Layanan:* {LAYANAN}
⏰ *Berlaku s/d:* {BERLAKU}

Booking & Info:
📱 WA: [Nomor WA OneLab]
📍 Lokasi: Bintaro Jaya, Tangsel

_Sebutkan kode voucher saat booking_ 🙏`;
}

async function saveCampaign(id){
  const name = document.getElementById('cf-name').value.trim();
  if(!name){ toast('Nama campaign wajib diisi','err'); return; }

  const services = [...document.querySelectorAll('.svc-chk:checked')].map(c=>c.value);

  const payload = {
    campaign_name:  name,
    description:    document.getElementById('cf-desc').value.trim(),
    discount_type:  document.getElementById('cf-dtype').value,
    discount_value: parseFloat(document.getElementById('cf-dval').value)||0,
    valid_from:     document.getElementById('cf-from').value||null,
    valid_until:    document.getElementById('cf-until').value||null,
    bg_color:       document.getElementById('cf-bgcolor').value,
    primary_color:  document.getElementById('cf-accolor').value,
    bg_image_url:   document.getElementById('cf-bgimg').value.trim(),
    services:       JSON.stringify(services),
    wa_template:    document.getElementById('cf-wa-tmpl').value,
    updated_at:     new Date().toISOString(),
  };

  try {
    if(id){ await sbPatch('voucher_campaigns',id,payload); toast('✅ Campaign diupdate','ok'); }
    else  { await sbPost('voucher_campaigns',payload);     toast('✅ Campaign dibuat','ok'); }
    closeModalForce();
    await loadCampaigns();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function deleteCampaign(id, name){
  if(!confirm(`Hapus campaign "${name}"?\nSemua voucher dalam campaign ini akan dihapus.`)) return;
  try {
    await sbDelete('voucher_campaigns',id);
    toast('🗑 Campaign dihapus','info');
    await loadCampaigns();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

// ── Generate Voucher Modal ────────────────────────
async function openGenerateModal(campaignId){
  const c = voucherState.campaigns.find(x=>x.id===campaignId);
  if(!c) return;
  voucherState.activeCampaign = c;

  // Load existing count
  let existingCount = 0;
  try {
    const existing = await sbGet('vouchers',`select=id&campaign_id=eq.${campaignId}`);
    existingCount = (existing||[]).length;
  } catch(e){}

  openModal(`
    <div class="modal-header">
      <div class="modal-title">🎟 Generate Voucher — ${c.campaign_name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div style="background:var(--lgray);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--gray)">
      Voucher sudah ada: <strong style="color:var(--navy)">${existingCount}</strong>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Jumlah Voucher yang Dibuat *</label>
        <input type="number" id="gv-count" value="10" min="1" max="1000"
          oninput="previewVoucherCodes()">
      </div>
      <div class="form-group">
        <label>Prefix Kode</label>
        <input type="text" id="gv-prefix" value="OL" placeholder="OL"
          oninput="previewVoucherCodes()" maxlength="6">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Nomor Awal Sequence</label>
        <input type="number" id="gv-start" value="${existingCount+1}" min="1"
          oninput="previewVoucherCodes()">
      </div>
      <div class="form-group">
        <label>Panjang Angka</label>
        <select id="gv-padlen" onchange="previewVoucherCodes()">
          <option value="3">3 digit (001)</option>
          <option value="4" selected>4 digit (0001)</option>
          <option value="5">5 digit (00001)</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>Preview Kode (5 pertama)</label>
      <div id="gv-preview" style="background:var(--lgray);border-radius:6px;padding:10px;font-family:monospace;font-size:13px;color:var(--navy)"></div>
    </div>

    <div id="gv-progress" style="display:none;margin:10px 0">
      <div style="background:var(--mint);border-radius:6px;height:7px;overflow:hidden">
        <div id="gv-prog-bar" style="height:100%;background:var(--teal);width:0;border-radius:6px;transition:width .2s"></div>
      </div>
      <div id="gv-prog-txt" style="font-size:12px;color:var(--gray);margin-top:5px"></div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" id="btn-gen" onclick="generateVouchers(${campaignId})">
        🎟 Generate Voucher
      </button>
    </div>`);

  previewVoucherCodes();
}

function previewVoucherCodes(){
  const prefix = (document.getElementById('gv-prefix')?.value||'OL').toUpperCase();
  const start  = parseInt(document.getElementById('gv-start')?.value)||1;
  const pad    = parseInt(document.getElementById('gv-padlen')?.value)||4;
  const codes  = Array.from({length:5},(_,i)=>`${prefix}${String(start+i).padStart(pad,'0')}`);
  const el     = document.getElementById('gv-preview');
  if(el) el.textContent = codes.join('  ·  ') + '  · ...';
}

async function generateVouchers(campaignId){
  const count  = parseInt(document.getElementById('gv-count').value)||10;
  const prefix = (document.getElementById('gv-prefix').value||'OL').toUpperCase();
  const start  = parseInt(document.getElementById('gv-start').value)||1;
  const pad    = parseInt(document.getElementById('gv-padlen').value)||4;

  const c = voucherState.campaigns.find(x=>x.id===campaignId);
  if(!c) return;

  const btn = document.getElementById('btn-gen');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Generating...'; }
  document.getElementById('gv-progress').style.display='block';

  let created=0, failed=0;
  const batchSize=20;

  for(let i=0;i<count;i+=batchSize){
    const batch=[];
    for(let j=i;j<Math.min(i+batchSize,count);j++){
      batch.push({
        campaign_id:  campaignId,
        code:         `${prefix}${String(start+j).padStart(pad,'0')}`,
        sequence_num: start+j,
        status:       'Active',
        expires_at:   c.valid_until ? new Date(c.valid_until).toISOString() : null,
      });
    }
    try {
      // Batch insert
      for(const v of batch){
        await sbPost('vouchers',v);
        created++;
      }
    } catch(e){ failed+=batch.length; }

    const pct=Math.round(Math.min(i+batchSize,count)/count*100);
    document.getElementById('gv-prog-bar').style.width=pct+'%';
    document.getElementById('gv-prog-txt').textContent=`${Math.min(i+batchSize,count)} dari ${count} dibuat...`;
    await new Promise(r=>setTimeout(r,50));
  }

  closeModalForce();
  toast(`✅ ${created} voucher dibuat${failed?`, ${failed} gagal`:''}`, 'ok');

  // Switch to "Daftar Voucher" tab — find it reliably instead of fragile index lookup
  const allTabBtns = document.querySelectorAll('.tabs .tab-btn');
  const vouchersBtn = Array.from(allTabBtns).find(b => b.textContent.includes('Daftar Voucher'));
  await switchVoucherTab('vouchers', vouchersBtn);

  // Auto-filter to the campaign that was just generated
  const campaignSel = document.getElementById('vc-campaign');
  if (campaignSel) { campaignSel.value = String(campaignId); filterVouchers(); }
}

// ── Voucher List ──────────────────────────────────
async function loadAllVouchers(){
  const tbl = document.getElementById('vouchers-table');
  if(!tbl) return;
  tbl.innerHTML='<div class="loading-row"><div class="spinner"></div></div>';

  // Populate campaign filter
  const sel = document.getElementById('vc-campaign');
  if(sel && voucherState.campaigns.length){
    sel.innerHTML='<option value="">Semua Campaign</option>'+
      voucherState.campaigns.map(c=>`<option value="${c.id}">${c.campaign_name}</option>`).join('');
  }

  try {
    let data;
    try {
      data = await sbGet('vouchers','select=*,voucher_campaigns!campaign_id(campaign_name)&order=created_at.desc&limit=200');
    } catch(embedErr) {
      // Fallback: embed still ambiguous/fails (FK name may differ on this DB) —
      // fetch separately and join client-side so the table never breaks
      console.warn('[loadAllVouchers] Embed query failed, falling back to client-side join:', embedErr);
      const [vRaw, cRaw] = await Promise.all([
        sbGet('vouchers','select=*&order=created_at.desc&limit=200'),
        sbGet('voucher_campaigns','select=id,campaign_name'),
      ]);
      const campMap = {};
      (cRaw||[]).forEach(c => { campMap[c.id] = c.campaign_name; });
      data = (vRaw||[]).map(v => ({...v, voucher_campaigns: v.campaign_id ? {campaign_name: campMap[v.campaign_id]} : null}));
    }
    allVouchers = Array.isArray(data)?data:[];
    renderVoucherTable(allVouchers);
  } catch(e){ tbl.innerHTML=`<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`; }
}

function filterVouchers(q){
  const search = (document.getElementById('vc-search')?.value||'').toLowerCase();
  const cmpId  = document.getElementById('vc-campaign')?.value||'';
  const status = document.getElementById('vc-status')?.value||'';
  const filtered = allVouchers.filter(v=>
    (!search || (v.code||'').toLowerCase().includes(search) || (v.recipient_name||'').toLowerCase().includes(search)) &&
    (!cmpId  || String(v.campaign_id)===cmpId) &&
    (!status || v.status===status)
  );
  renderVoucherTable(filtered);
}

async function viewCampaignVouchers(campaignId){
  document.querySelectorAll('.tabs .tab-btn').forEach((b,i)=>b.classList.toggle('active',i===1));
  document.getElementById('campaigns-tab').style.display='none';
  document.getElementById('vouchers-tab').style.display='block';
  await loadAllVouchers();
  const sel=document.getElementById('vc-campaign');
  if(sel){ sel.value=String(campaignId); filterVouchers(); }
}

function renderVoucherTable(data){
  const tbl=document.getElementById('vouchers-table');
  if(!tbl) return;
  if(!data.length){
    tbl.innerHTML=`<div class="empty-state"><div class="ico">🎟</div><h3>Belum ada voucher</h3><p>Pilih campaign dan klik "Generate Voucher".</p></div>`;
    return;
  }
  tbl.innerHTML=`
    <table>
      <thead><tr>
        <th><input type="checkbox" id="vc-all" onchange="toggleAllVoucherChk(this.checked)"></th>
        <th>Kode</th><th>Campaign</th><th>Status</th>
        <th>Penerima</th><th>Dibagikan</th><th>Berlaku s/d</th><th>Aksi</th>
      </tr></thead>
      <tbody>
        ${data.slice(0,100).map((v,i)=>{
          const st = v.status==='Active'?'badge-green':v.status==='Used'?'badge-gray':v.status==='Expired'?'badge-red':'badge-navy';
          const exp = v.expires_at ? new Date(v.expires_at).toLocaleDateString('id-ID') : '∞';
          const campName = v.voucher_campaigns?.campaign_name || '—';
          return `<tr>
            <td><input type="checkbox" class="vc-chk" data-id="${v.id}"></td>
            <td style="font-family:monospace;font-weight:700;font-size:13px;color:var(--navy)">${v.code}</td>
            <td style="font-size:12px;color:var(--gray)">${campName}</td>
            <td><span class="badge ${st}">${v.status}</span></td>
            <td style="font-size:12px">${v.recipient_name||'—'}</td>
            <td style="font-size:11px;color:var(--gray)">${v.shared_via||'—'}</td>
            <td style="font-size:12px;color:var(--gray)">${exp}</td>
            <td>
              <div class="act-row">
                <button class="act-btn" onclick="openVoucherDesign(${v.id})" title="Lihat & Share">👁</button>
                <button class="act-btn wa" onclick="shareVoucherWA(${v.id})" title="Share WA">💬</button>
                <button class="act-btn del" onclick="cancelVoucher(${v.id})">✕</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${data.length>100?`<div style="padding:12px 16px;font-size:12px;color:var(--gray)">Menampilkan 100 dari ${data.length} voucher</div>`:''}
    <div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border)">
      <button class="btn btn-outline btn-sm" onclick="bulkShareWA()">💬 Share WA Terpilih</button>
      <button class="btn btn-ghost btn-sm" onclick="exportVouchersCSV()">📥 Export CSV</button>
      <button class="btn btn-ghost btn-sm" onclick="printVouchersBatch()">🖨 Print Batch</button>
    </div>`;
}

// ── Voucher Design / Share ────────────────────────
async function openVoucherDesign(voucherId){
  const v = allVouchers.find(x=>x.id===voucherId);
  if(!v) return;
  const campaign = voucherState.campaigns.find(c=>c.id===v.campaign_id) ||
                   (v.voucher_campaigns ? {campaign_name:v.voucher_campaigns.campaign_name} : {});

  const c = campaign;
  const services = tryParseJSON(c.services)||[];
  const discText = c.discount_type==='percent' ? `${c.discount_value||0}%` : `Rp ${(c.discount_value||0).toLocaleString()}`;
  const exp = v.expires_at ? new Date(v.expires_at).toLocaleDateString('id-ID') : '—';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(v.code)}`;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">🎟 Voucher ${v.code}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <!-- Voucher Design -->
    <div id="voucher-design-${v.id}" style="
      background:${c.bg_color||'#0A2342'};
      border-radius:14px;padding:20px;color:#fff;
      position:relative;overflow:hidden;margin-bottom:16px;
      min-height:180px;
    ">
      ${c.bg_image_url?`<img src="${c.bg_image_url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.2;border-radius:14px">`:'' }
      <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div style="font-size:11px;opacity:.6;font-weight:600;letter-spacing:.08em;margin-bottom:4px">ONELAB DIAGNOSTICS</div>
          <div style="font-size:28px;font-weight:900;color:${c.primary_color||'#00BFA5'};line-height:1;margin-bottom:8px">${discText} OFF</div>
          <div style="font-size:12px;opacity:.8;margin-bottom:6px">${(c.campaign_name||'Voucher Skrining')}</div>
          <div style="font-size:11px;opacity:.65;margin-bottom:12px">${services.slice(0,3).join(' · ')}${services.length>3?` +${services.length-3} lainnya`:''}</div>
          <div style="background:rgba(255,255,255,.15);border-radius:6px;padding:8px 12px;display:inline-block">
            <div style="font-size:10px;opacity:.7;margin-bottom:2px">KODE VOUCHER</div>
            <div style="font-family:monospace;font-size:18px;font-weight:800;letter-spacing:.12em">${v.code}</div>
          </div>
          <div style="font-size:10px;opacity:.5;margin-top:10px">Berlaku s/d ${exp}</div>
        </div>
        <div style="background:#fff;padding:6px;border-radius:8px;flex-shrink:0">
          <img src="${qrUrl}" width="90" height="90" alt="QR" style="display:block;border-radius:4px">
          <div style="font-size:8px;color:#0A2342;text-align:center;margin-top:2px">Scan / Booking</div>
        </div>
      </div>
    </div>

    <!-- Assign recipient -->
    <div class="form-row">
      <div class="form-group">
        <label>Nama Penerima</label>
        <input type="text" id="vr-name" value="${v.recipient_name||''}" placeholder="Nama pasien / penerima">
      </div>
      <div class="form-group">
        <label>No. WA Penerima</label>
        <input type="text" id="vr-phone" value="${v.recipient_phone||''}" placeholder="08xxxxxxxxxx">
      </div>
    </div>
    <div class="form-group">
      <label>Email Penerima</label>
      <input type="email" id="vr-email" value="${v.recipient_email||''}" placeholder="email@domain.com">
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-outline" onclick="saveRecipientAndShare(${v.id},'print')">🖨 Print</button>
      <button class="btn btn-outline" onclick="saveRecipientAndShare(${v.id},'email')">📧 Email</button>
      <button class="btn btn-teal" onclick="saveRecipientAndShare(${v.id},'wa')">💬 Share WA</button>
    </div>`);
}

async function saveRecipientAndShare(id, via){
  const name  = document.getElementById('vr-name')?.value.trim()||'';
  const phone = document.getElementById('vr-phone')?.value.trim()||'';
  const email = document.getElementById('vr-email')?.value.trim()||'';

  try {
    await sbPatch('vouchers', id, {
      recipient_name: name, recipient_phone: phone, recipient_email: email,
      shared_via: via, updated_at: new Date().toISOString()
    });
    // Update local
    const v = allVouchers.find(x=>x.id===id);
    if(v){ v.recipient_name=name; v.recipient_phone=phone; v.shared_via=via; }
  } catch(e){}

  if(via==='wa')    shareVoucherWA(id, name, phone);
  else if(via==='email') alert('Fitur email: integrasikan dengan layanan email seperti EmailJS atau Resend.');
  else if(via==='print') printVoucher(id);
}

async function shareVoucherWA(id, recipientName='', phone=''){
  const v = allVouchers.find(x=>x.id===id) || {};
  const c = voucherState.campaigns.find(x=>x.id===v.campaign_id)||{};
  const services = tryParseJSON(c.services)||[];
  const discText = c.discount_type==='percent' ? `${c.discount_value||0}%` : `Rp ${(c.discount_value||0).toLocaleString()}`;
  const exp = v.expires_at ? new Date(v.expires_at).toLocaleDateString('id-ID') : '∞';
  const name = recipientName || v.recipient_name || 'Bapak/Ibu';
  const ph = phone || v.recipient_phone || '';

  let msg = (c.wa_template || `Halo {NAMA},\n\n🎟 Kode Voucher: *{KODE}*\n💰 Diskon: {DISKON}\n📋 Layanan: {LAYANAN}\n⏰ Berlaku: {BERLAKU}`);
  msg = msg.replace(/{NAMA}/g, name)
           .replace(/{KODE}/g, v.code||'')
           .replace(/{DISKON}/g, discText)
           .replace(/{LAYANAN}/g, services.slice(0,3).join(', '))
           .replace(/{BERLAKU}/g, exp);

  const waNum = ph.replace(/\D/g,'');
  const waUrl = waNum
    ? `https://wa.me/${waNum.startsWith('0')?'62'+waNum.slice(1):waNum}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  window.open(waUrl,'_blank');
}

function printVoucher(id){
  const v = allVouchers.find(x=>x.id===id);
  const c = voucherState.campaigns.find(x=>x.id===v?.campaign_id)||{};
  if(!v) return;
  const services = tryParseJSON(c.services)||[];
  const discText = c.discount_type==='percent' ? `${c.discount_value||0}%` : `Rp ${(c.discount_value||0).toLocaleString()}`;
  const exp = v.expires_at ? new Date(v.expires_at).toLocaleDateString('id-ID') : '∞';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(v.code)}`;

  const w = window.open('','_blank','width=600,height=400');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Voucher ${v.code}</title>
    <style>
      @page{size:10cm 5cm;margin:0}
      *{box-sizing:border-box;margin:0;padding:0}
      body{width:10cm;height:5cm;background:${c.bg_color||'#0A2342'};color:#fff;font-family:Arial,sans-serif;overflow:hidden;position:relative}
      .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.2}
      .content{position:relative;z-index:1;padding:10px 12px;height:100%;display:flex;justify-content:space-between;align-items:center}
      .left{flex:1}
      .org{font-size:6pt;opacity:.6;letter-spacing:.06em;margin-bottom:2px}
      .disc{font-size:24pt;font-weight:900;color:${c.primary_color||'#00BFA5'};line-height:1}
      .camp{font-size:7pt;opacity:.8;margin:3px 0}
      .svcs{font-size:6pt;opacity:.65;margin-bottom:6px}
      .code-box{background:rgba(255,255,255,.15);border-radius:4px;padding:4px 8px;display:inline-block}
      .code-lbl{font-size:5pt;opacity:.7}
      .code-val{font-family:monospace;font-size:11pt;font-weight:800;letter-spacing:.08em}
      .exp{font-size:5pt;opacity:.5;margin-top:4px}
      .qr-wrap{background:#fff;padding:4px;border-radius:6px}
      @media print{button{display:none}}
    </style></head>
    <body>
    ${c.bg_image_url?`<img class="bg" src="${c.bg_image_url}">`:''}
    <div class="content">
      <div class="left">
        <div class="org">ONELAB DIAGNOSTICS</div>
        <div class="disc">${discText} OFF</div>
        <div class="camp">${c.campaign_name||''}</div>
        <div class="svcs">${services.slice(0,3).join(' · ')}</div>
        <div class="code-box">
          <div class="code-lbl">KODE VOUCHER</div>
          <div class="code-val">${v.code}</div>
        </div>
        <div class="exp">Berlaku s/d ${exp}</div>
      </div>
      <div class="qr-wrap"><img src="${qrUrl}" width="64" height="64"></div>
    </div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
  w.document.close();
}

function printVouchersBatch(){
  const checked = [...document.querySelectorAll('.vc-chk:checked')].map(c=>parseInt(c.dataset.id));
  if(!checked.length){ toast('Pilih voucher dulu','warn'); return; }
  checked.forEach(id=>printVoucher(id));
}

async function cancelVoucher(id){
  if(!confirm('Batalkan voucher ini?')) return;
  try {
    await sbPatch('vouchers',id,{status:'Cancelled'});
    toast('✅ Voucher dibatalkan','info');
    await loadAllVouchers();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

function exportVouchersCSV(){
  const checked=[...document.querySelectorAll('.vc-chk:checked')].map(c=>parseInt(c.dataset.id));
  const data = checked.length ? allVouchers.filter(v=>checked.includes(v.id)) : allVouchers;
  if(!data.length){ toast('Tidak ada data','warn'); return; }
  const h=['Kode','Campaign','Status','Penerima','Telepon','Email','Dibagikan Via','Berlaku s/d'];
  const rows=data.map(v=>[
    v.code||'',v.voucher_campaigns?.campaign_name||'',v.status||'',
    v.recipient_name||'',v.recipient_phone||'',v.recipient_email||'',
    v.shared_via||'',v.expires_at?new Date(v.expires_at).toLocaleDateString('id-ID'):''
  ].map(x=>`"${String(x).replace(/"/g,'""')}"`));
  const csv=[h,...rows].map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download=`Vouchers_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.csv`;
  a.click(); toast('📥 CSV diunduh','ok');
}

function toggleAllVoucherChk(checked){
  document.querySelectorAll('.vc-chk').forEach(c=>c.checked=checked);
}

// ── Bulk WA Share ─────────────────────────────────
function bulkShareWA(){
  const checked=[...document.querySelectorAll('.vc-chk:checked')].map(c=>parseInt(c.dataset.id));
  if(!checked.length){ toast('Pilih voucher dulu','warn'); return; }
  if(checked.length>10){ toast('Maksimal 10 voucher sekaligus untuk WA blast','warn'); return; }
  checked.forEach((id,i)=>{
    setTimeout(()=>shareVoucherWA(id), i*800);
  });
}

// ── Utils ─────────────────────────────────────────
