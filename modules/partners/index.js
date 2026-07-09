// ═══════════════════════════════════════════
// MODULE: Partner Database v3
// - Full CRUD + Pipeline + Deals
// - User tracking setiap aksi
// - Deals modal pakai overlay terpisah (bukan modal utama)
// ═══════════════════════════════════════════

const PARTNER_CATEGORIES = [
  'Apotek','Klinik Pratama','Klinik Utama','Dokter Praktik',
  'Dokter Spesialis','Klinik Gigi','Klinik Mata','Puskesmas',
  'Rumah Sakit','Lab Klinik','Perusahaan SME','Komunitas',
  'Sekolah / Kampus','Gym & Sport Club','Lainnya'
];
const PARTNER_STATUSES = [
  'Prospect','Dihubungi','Meeting','Proposal Dikirim','MOU','Aktif','Tidak Berminat'
];
const STATUS_COLORS = {
  'Prospect':'#F59E0B','Dihubungi':'#0EA5E9','Meeting':'#8B5CF6',
  'Proposal Dikirim':'#F97316','MOU':'#06B6D4','Aktif':'#22C55E',
  'Tidak Berminat':'#EF4444'
};

let PS = {
  all:[], filtered:[], page:1, perPage:25,
  search:'', filterCat:'', filterStatus:'', view:'table'
};

// ── Render Page ───────────────────────────────────
async function renderPartners(params={}) {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>🤝 Partner Database</h1>
        <p>Hitlist, pipeline progress, dan output kerjasama semua mitra OneLab</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="btn-view-toggle" onclick="togglePView()">📊 Kanban</button>
        <button class="btn btn-ghost btn-sm" onclick="exportPartnerCSV()">📥 Export</button>
        <button class="btn btn-ghost btn-sm" onclick="navigate('import')">📥 Import Excel</button>
        <button class="btn btn-teal" onclick="openPartnerForm()">+ Tambah Partner</button>
      </div>
    </div>

    <!-- Pipeline bar thick -->
    <div class="card" style="padding:16px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="card-title">📊 Sales Pipeline</div>
        <div id="pipeline-total" style="font-size:12px;color:var(--text3)"></div>
      </div>
      <div id="pipeline-bar" style="display:flex;gap:2px;height:28px;border-radius:var(--r);overflow:hidden;margin-bottom:10px"></div>
      <div id="pipeline-legend" style="display:flex;gap:14px;flex-wrap:wrap"></div>
    </div>

    <div id="pv-table">
      <div class="table-wrap">
        <div class="table-toolbar">
          <input class="table-search" id="ps-q" placeholder="Cari nama, PIC, alamat, kode..."
            oninput="psSearch(this.value)">
          <select class="table-filter" id="ps-cat" onchange="psFilter()">
            <option value="">Semua Kategori</option>
            ${PARTNER_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
          </select>
          <select class="table-filter" id="ps-status" onchange="psFilter()">
            <option value="">Semua Status</option>
            ${PARTNER_STATUSES.map(s=>`<option value="${s}">${s}</option>`).join('')}
          </select>
          <span id="ps-count" style="font-size:12px;color:var(--text3);white-space:nowrap;margin-left:auto"></span>
        </div>
        <div id="partner-tbody"></div>
      </div>
      <div id="partner-pgn"></div>
    </div>

    <div id="pv-kanban" style="display:none">
      <div id="kanban-board" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:12px"></div>
    </div>`;

  PS.all = []; PS.filtered = []; PS.page = 1;
  await loadPartners();
  if (params.highlight) highlightPartner(params.highlight);
}


async function loadPartners() {
  try {
    const data = await sbGet('partners','select=*&order=created_at.desc');
    PS.all = Array.isArray(data) ? data : [];
    PS.page = 1;
    applyPSFilter();
    renderPipelineBar();
    const badgeEl = document.getElementById('badge-partners-rail');
    if (badgeEl) { badgeEl.textContent = PS.all.length; badgeEl.style.display = PS.all.length>0?'flex':'none'; }
  } catch(e) {
    document.getElementById('partner-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function psSearch(v) { PS.search=v.toLowerCase(); PS.page=1; applyPSFilter(); }
function psFilter() {
  PS.filterCat    = document.getElementById('ps-cat')?.value||'';
  PS.filterStatus = document.getElementById('ps-status')?.value||'';
  PS.page=1; applyPSFilter();
}
function applyPSFilter() {
  PS.filtered = PS.all.filter(p=>{
    const q=PS.search;
    const mQ=!q||['partner_name','pic_name','address','phone','partner_code','notes']
      .some(k=>(p[k]||'').toLowerCase().includes(q));
    const mC=!PS.filterCat    || p.category===PS.filterCat;
    const mS=!PS.filterStatus || p.status===PS.filterStatus;
    return mQ&&mC&&mS;
  });
  if(PS.view==='table') renderPTable(); else renderKanban();
}

// ── Pipeline Bar ──────────────────────────────────
function renderPipelineBar() {
  const bar      = document.getElementById('pipeline-bar');
  const legend   = document.getElementById('pipeline-legend');
  const total_el = document.getElementById('pipeline-total');
  if (!bar) return;

  const counts = {};
  Object.keys(STATUS_COLORS).forEach(s => counts[s] = 0);
  PS.all.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
  const total = Math.max(PS.all.length, 1);
  if (total_el) total_el.textContent = PS.all.length + ' total partner';

  // Pipeline segments — clickable filter
  bar.innerHTML = Object.entries(STATUS_COLORS)
    .filter(([s]) => counts[s] > 0)
    .map(([s, c]) => `
      <div style="flex:${counts[s]};background:${c};display:flex;align-items:center;
        justify-content:center;font-size:11px;font-weight:700;color:#fff;
        cursor:pointer;min-width:4px;transition:flex .4s"
        onclick="document.getElementById('ps-status').value='${s}';psFilter()"
        title="${s}: ${counts[s]}">
        <span style="overflow:hidden;white-space:nowrap;padding:0 4px">
          ${(counts[s]/total)>0.08 ? counts[s] : ''}
        </span>
      </div>`)
    .join('');

  // Legend
  legend.innerHTML = Object.entries(STATUS_COLORS)
    .map(([s, c]) => `
      <div style="display:flex;align-items:center;gap:5px;cursor:pointer"
        onclick="document.getElementById('ps-status').value='${s}';psFilter()">
        <div style="width:10px;height:10px;border-radius:2px;background:${c}"></div>
        <span style="font-size:11.5px;color:var(--text3)">
          ${s} <strong style="color:var(--text)">${counts[s]}</strong>
        </span>
      </div>`)
    .join('');
}



function filterByPStatus(s) {
  PS.filterStatus=s;
  const el = document.getElementById('ps-status');
  if(el) el.value=s;
  PS.page=1; applyPSFilter();
}

// ── Table ─────────────────────────────────────────
function renderPTable() {
  const {filtered,page,perPage}=PS;
  document.getElementById('ps-count').textContent=`${filtered.length} dari ${PS.all.length}`;

  if(!filtered.length){
    document.getElementById('partner-tbody').innerHTML=`
      <div class="empty-state">
        <div class="ico">🤝</div>
        <h3>${PS.all.length?'Tidak ada hasil':'Belum ada partner'}</h3>
        <p>${PS.all.length?'Coba ubah filter.':'Klik "+ Tambah Partner" atau import dari Maps.'}</p>
      </div>`;
    document.getElementById('partner-pgn').innerHTML=''; return;
  }

  const start=(page-1)*perPage;
  const rows=filtered.slice(start,start+perPage);

  document.getElementById('partner-tbody').innerHTML=`
    <table>
      <thead><tr>
        <th>#</th><th>Kode</th><th>Nama Partner</th><th>Kategori</th>
        <th>PIC & Kontak</th><th>Status</th><th>Dibuat Oleh</th><th>Aksi</th>
      </tr></thead>
      <tbody>
        ${rows.map((p,i)=>{
          const wn=(p.phone||'').replace(/\D/g,'');
          const wu=wn?`https://wa.me/${wn.startsWith('0')?'62'+wn.slice(1):wn}`:'';
          const mu=p.latitude&&p.longitude?`https://maps.google.com/?q=${p.latitude},${p.longitude}`:'';
          const stColor=STATUS_COLORS[p.status]||'#94A3B8';
          return `<tr id="prow-${p.id}">
            <td style="color:#bbb;font-size:11px">${start+i+1}</td>
            <td style="font-size:11px;color:var(--gray);font-family:monospace">${p.partner_code||'—'}</td>
            <td>
              <div class="td-name">${p.partner_name||'—'}</div>
              <div class="td-sub">${p.address||''}</div>
            </td>
            <td><span class="badge ${catBadge(p.category)}" style="font-size:11px">${catIcon(p.category)} ${p.category||'—'}</span></td>
            <td>
              <div style="font-size:13px">${p.pic_name||'—'}</div>
              ${p.phone?`<div class="td-phone" style="font-size:11px">${p.phone}</div>`:''}
            </td>
            <td>
              <span class="badge" style="background:${stColor}20;color:${stColor};font-size:11px;cursor:pointer"
                onclick="quickStatusChange(${p.id},'${p.status||'Prospect'}')">
                ${p.status||'Prospect'}
              </span>
            </td>
            <td style="font-size:11px;color:var(--gray)">
              ${p.assigned_name||p.created_by_name||'—'}
              ${p.created_at?`<div style="font-size:10px;color:#bbb">${timeAgo(p.created_at)}</div>`:''}
            </td>
            <td>
              <div class="act-row">
                ${wu?`<button class="act-btn wa" onclick="window.open('${wu}','_blank')" title="WA">💬</button>`:''}
                ${mu?`<button class="act-btn maps" onclick="window.open('${mu}','_blank')" title="Maps">🗺</button>`:''}
                <button class="act-btn" onclick="showDealsOverlay(${p.id},'${(p.partner_name||'').replace(/'/g,"\\'")}')">🤝</button>
                <button class="act-btn edit" onclick="openPartnerForm(${p.id})">✏️</button>
                <button class="act-btn del" onclick="deletePartner(${p.id},'${(p.partner_name||'').replace(/'/g,"\\'")}')">🗑</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  const pages=Math.ceil(filtered.length/perPage);
  document.getElementById('partner-pgn').innerHTML=pages>1?`
    <div class="pagination">
      ${Array.from({length:pages},(_,i)=>`
        <button class="pg-btn${i+1===page?' active':''}" onclick="goPP(${i+1})">${i+1}</button>
      `).join('')}
    </div>`:''  ;
}

function goPP(p){PS.page=p;renderPTable();window.scrollTo(0,200);}

// ── Kanban ────────────────────────────────────────
function renderKanban() {
  const board=document.getElementById('kanban-board');
  if(!board)return;
  board.innerHTML=PARTNER_STATUSES.map(s=>{
    const cards=PS.filtered.filter(p=>p.status===s);
    const col=STATUS_COLORS[s]||'#94A3B8';
    return `
      <div style="min-width:200px;flex:1;max-width:240px">
        <div style="padding:8px 12px;border-radius:8px 8px 0 0;background:${col};color:#fff;font-size:12px;font-weight:700;display:flex;justify-content:space-between">
          <span>${s}</span><span>${cards.length}</span>
        </div>
        <div style="background:#fff;border-radius:0 0 8px 8px;padding:6px;min-height:100px;box-shadow:var(--shadow)">
          ${cards.map(p=>`
            <div style="background:${col}12;border-radius:6px;padding:8px 10px;margin-bottom:5px;cursor:pointer;border-left:3px solid ${col}"
              onclick="openPartnerForm(${p.id})">
              <div style="font-size:12px;font-weight:700;color:var(--navy)">${p.partner_name||'—'}</div>
              <div style="font-size:11px;color:var(--gray)">${catIcon(p.category)} ${p.category||''}</div>
              ${p.pic_name?`<div style="font-size:11px;color:var(--gray)">👤 ${p.pic_name}</div>`:''}
              ${p.assigned_name?`<div style="font-size:10px;color:var(--teal)">📋 ${p.assigned_name}</div>`:''}
            </div>`).join('')||
          `<div style="text-align:center;padding:16px;color:#ccc;font-size:11px">Kosong</div>`}
        </div>
      </div>`;
  }).join('');
}

function togglePView() {
  const btn=document.getElementById('btn-view-toggle');
  if(PS.view==='table'){
    PS.view='kanban';
    document.getElementById('pv-table').style.display='none';
    document.getElementById('pv-kanban').style.display='block';
    if(btn) btn.textContent='📊 Table View';
    renderKanban();
  } else {
    PS.view='table';
    document.getElementById('pv-table').style.display='block';
    document.getElementById('pv-kanban').style.display='none';
    if(btn) btn.textContent='📋 Pipeline View';
    renderPTable();
  }
}

function highlightPartner(id) {
  setTimeout(()=>{
    const row=document.getElementById(`prow-${id}`);
    if(row){
      row.style.background='#FFFDE7';
      row.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>row.style.background='',2000);
    }
  },300);
}

// ── Quick Status ──────────────────────────────────
function quickStatusChange(id, currentStatus) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Update Status Partner</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Status Baru</label>
      <select id="qs-status" style="font-size:15px;padding:12px">
        ${PARTNER_STATUSES.map(s=>`<option value="${s}"${s===currentStatus?' selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Catatan (opsional)</label>
      <textarea id="qs-note" rows="2" placeholder="Hasil follow up, alasan perubahan status..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveQuickStatus(${id})">✅ Update</button>
    </div>`);
}

async function saveQuickStatus(id) {
  const status = document.getElementById('qs-status').value;
  const note   = document.getElementById('qs-note').value.trim();
  const user   = getUserName ? getUserName() : 'User';
  try {
    await sbPatch('partners', id, {
      status,
      updated_at: new Date().toISOString(),
      assigned_name: user,
    });
    await logActivity('update','partners', id,
      `Status diubah ke "${status}"${note?' — '+note:''}`, '');
    toast(`✅ Status → ${status}`,'ok');
    closeModalForce();
    await loadPartners();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

// ── Form Add/Edit ─────────────────────────────────
async function openPartnerForm(id=null) {
  let p={};
  if(id){
    const d=await sbGet('partners',`select=*&id=eq.${id}`);
    p=d[0]||{};
  }
  const user = getUserName ? getUserName() : 'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Partner':'➕ Tambah Partner'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    ${id ? `
    <div style="background:var(--lgray);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--gray);display:flex;gap:16px;flex-wrap:wrap">
      ${p.assigned_name?`<span>👤 Dibuat oleh: <strong style="color:var(--navy)">${p.assigned_name}</strong></span>`:''}
      ${p.created_at?`<span>📅 Dibuat: <strong>${formatDate(p.created_at)}</strong></span>`:''}
      ${p.updated_at?`<span>🔄 Update: <strong>${timeAgo(p.updated_at)}</strong></span>`:''}
    </div>` : ''}

    <div class="form-row">
      <div class="form-group">
        <label>Kode Partner</label>
        <input type="text" id="pf-code" value="${p.partner_code||''}" placeholder="Otomatis jika kosong">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="pf-status">
          ${PARTNER_STATUSES.map(s=>`<option value="${s}"${(p.status||'Prospect')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Nama Partner *</label>
        <input type="text" id="pf-name" value="${p.partner_name||''}"
          placeholder="Nama klinik, apotek, perusahaan...">
      </div>
      <div class="form-group">
        <label>Kategori *</label>
        <select id="pf-cat">
          <option value="">-- Pilih --</option>
          ${PARTNER_CATEGORIES.map(c=>`<option value="${c}"${p.category===c?' selected':''}>${catIcon(c)} ${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Assigned To (Sales)</label>
        <input type="text" id="pf-assigned" value="${p.assigned_name||user}"
          placeholder="Nama sales yang handle">
      </div>
      <div class="form-group">
        <label>Nama PIC (dari partner)</label>
        <input type="text" id="pf-pic" value="${p.pic_name||''}"
          placeholder="Nama kontak di partner">
      </div>
      <div class="form-group">
        <label>No. Telepon / WA</label>
        <input type="text" id="pf-phone" value="${p.phone||''}" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="pf-email" value="${p.email||''}" placeholder="email@domain.com">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Alamat</label>
        <input type="text" id="pf-addr" value="${p.address||''}" placeholder="Jl. ...">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Catatan</label>
        <textarea id="pf-notes" rows="3"
          placeholder="Hasil kunjungan, info penting, next action...">${p.notes||''}</textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      ${id?`<button class="btn btn-outline" onclick="closeModalForce();setTimeout(()=>showDealsOverlay(${id},'${(p.partner_name||'').replace(/'/g,"\\'")}'),200)">🤝 Kelola Kerjasama</button>`:''}
      <button class="btn btn-teal" onclick="savePartner(${id||'null'})">
        ${id?'💾 Simpan':'➕ Tambah'}
      </button>
    </div>`);
}

async function savePartner(id) {
  const name = document.getElementById('pf-name').value.trim();
  const cat  = document.getElementById('pf-cat').value;
  if(!name){ toast('Nama wajib diisi','err'); return; }
  if(!cat){  toast('Kategori wajib dipilih','err'); return; }

  const user = getUserName ? getUserName() : 'User';
  const payload = {
    partner_code:  document.getElementById('pf-code').value.trim() || autoCode(cat),
    partner_name:  name,
    category:      cat,
    assigned_name: document.getElementById('pf-assigned').value.trim() || user,
    pic_name:      document.getElementById('pf-pic').value.trim(),
    phone:         document.getElementById('pf-phone').value.trim(),
    email:         document.getElementById('pf-email').value.trim(),
    address:       document.getElementById('pf-addr').value.trim(),
    status:        document.getElementById('pf-status').value,
    notes:         document.getElementById('pf-notes').value.trim(),
    updated_at:    new Date().toISOString(),
  };

  try {
    if(id) {
      await sbPatch('partners', id, payload);
      await logActivity('update','partners', id,
        `Partner diupdate oleh ${user}`, name);
      toast('✅ Partner diupdate','ok');
    } else {
      const res = await sbPost('partners', payload);
      if(res && res[0]) {
        await logActivity('create','partners', res[0].id,
          `Partner baru ditambahkan oleh ${user}`, name);
      }
      toast('✅ Partner ditambahkan','ok');
    }
    closeModalForce();
    await loadPartners();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function deletePartner(id, name) {
  if(!confirm(`Hapus "${name}"?\nSemua data kerjasama terkait akan ikut terhapus.`)) return;
  const user = getUserName ? getUserName() : 'User';
  try {
    await sbDelete('partners', id);
    await logActivity('delete','partners', id,
      `Partner dihapus oleh ${user}`, name);
    toast(`🗑 "${name}" dihapus`,'info');
    await loadPartners();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

// ── Deals Overlay (TERPISAH dari modal utama) ─────
// Pakai overlay sendiri agar tidak konflik dengan modal
function showDealsOverlay(partnerId, partnerName) {
  // Tutup modal utama kalau masih terbuka
  document.getElementById('modal-overlay')?.classList.remove('open');

  // Hapus overlay lama kalau ada
  document.getElementById('deals-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'deals-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:400;
    display:flex;align-items:center;justify-content:center;padding:14px`;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:620px;width:100%;
      max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.2)">

      <!-- Header -->
      <div style="padding:18px 20px;border-bottom:1px solid var(--border);
        display:flex;align-items:center;justify-content:space-between;
        position:sticky;top:0;background:#fff;z-index:10;border-radius:14px 14px 0 0">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--navy)">🤝 Output Kerjasama</div>
          <div style="font-size:12px;color:var(--gray);margin-top:2px">${partnerName}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-teal btn-sm"
            onclick="openDealForm(${partnerId},null,'${partnerName.replace(/'/g,"\\'")}')">
            ➕ Tambah Output
          </button>
          <button onclick="document.getElementById('deals-overlay').remove()"
            style="background:var(--lgray);border:none;border-radius:50%;width:30px;height:30px;
            cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">✕</button>
        </div>
      </div>

      <!-- Body -->
      <div style="padding:18px 20px">
        <div id="deals-summary-${partnerId}"></div>
        <div id="deals-list-${partnerId}">
          <div class="loading-row"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay) overlay.remove();
  });

  // Load deals
  loadDeals(partnerId);
}

// ── Export CSV ────────────────────────────────────
function exportPartnerCSV() {
  const data = PS.filtered.length ? PS.filtered : PS.all;
  if(!data.length){ toast('Tidak ada data','warn'); return; }
  const h = ['No','Kode','Nama','Kategori','PIC Partner','Sales/Assigned',
             'Telepon','Email','Alamat','Status','Catatan','Dibuat'];
  const rows = data.map((p,i)=>[
    i+1, p.partner_code||'', p.partner_name||'', p.category||'',
    p.pic_name||'', p.assigned_name||'', p.phone||'', p.email||'',
    p.address||'', p.status||'', p.notes||'',
    p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : ''
  ].map(v=>`"${String(v).replace(/"/g,'""')}"`));
  const csv = [h,...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `Partners_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.csv`;
  a.click();
  toast('📥 CSV diunduh','ok');
}
