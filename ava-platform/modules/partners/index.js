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
  search:'', filterCat:'', filterStatus:'', view:'table',
  mapInstance: null, markers: [], activeInfoWindow: null
};

// ── Render Page ───────────────────────────────────
async function renderPartners(params={}) {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Partner Database</h1>
        <p>Hitlist, pipeline progress, dan visualisasi lokasi peta semua mitra AVA</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="btn-view-toggle" onclick="togglePView()">${icon('kanban', 13)} Pipeline (Kanban)</button>
        <button class="btn btn-ghost btn-sm" onclick="exportPartnerCSV()">${icon('download', 13)} Export</button>
        <button class="btn btn-ghost btn-sm" onclick="navigate('import')">${icon('upload', 13)} Import Excel</button>
        <button class="btn btn-teal" onclick="openPartnerForm()">+ Tambah Partner</button>
      </div>
    </div>

    <!-- Pipeline bar thick -->
    <div class="card" style="padding:16px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="card-title">Sales Pipeline</div>
        <div id="pipeline-total" style="font-size:12px;color:var(--text3)"></div>
      </div>
      <div id="pipeline-bar" style="display:flex;gap:2px;height:28px;border-radius:var(--r);overflow:hidden;margin-bottom:10px"></div>
      <div id="pipeline-legend" style="display:flex;gap:14px;flex-wrap:wrap"></div>
    </div>

    <!-- Table View -->
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

    <!-- Kanban View -->
    <div id="pv-kanban" style="display:none">
      <div id="kanban-board" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:12px"></div>
    </div>

    <!-- Map View -->
    <div id="pv-map" style="display:none">
      <div class="card" style="padding:16px;margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            <span>Sebaran Mitra di Peta</span>
            <span id="pmap-stats-badge" class="badge badge-teal" style="font-size:11px">0 lokasi terpetakan</span>
          </div>
          <div id="pmap-unmapped-info" style="font-size:12px;color:var(--gray)"></div>
        </div>

        <div id="partner-map-wrap" style="position:relative;width:100%;height:520px;border-radius:10px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--shadow)">
          <div id="partner-map-canvas" style="width:100%;height:100%;background:var(--lgray);display:flex;align-items:center;justify-content:center;color:var(--gray)">
            <div style="text-align:center;padding:20px">
              <div class="spinner" style="margin:0 auto 12px"></div>
              <div>Memuat Peta Mitra...</div>
            </div>
          </div>
        </div>
      </div>
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
  if(PS.view==='table') renderPTable();
  else if(PS.view==='kanban') renderKanban();
  else if(PS.view==='map') renderPMap();
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
        justify-content:center;font-size:11px;font-weight:700;color:var(--on-accent);
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
        <div class="ico">${icon('users', 32)}</div>
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
            <td><span class="badge ${catBadge(p.category)}" style="font-size:11px">${p.category||'—'}</span></td>
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
                ${wu?`<button class="act-btn wa" onclick="window.open('${wu}','_blank')" title="WA" style="font-size:10.5px;font-weight:700">WA</button>`:''}
                ${mu?`<button class="act-btn maps" onclick="window.open('${mu}','_blank')" title="Maps">${icon('map', 12)}</button>`:''}
                <button class="act-btn" onclick="showDealsOverlay(${p.id},'${(p.partner_name||'').replace(/'/g,"\\'")}')" title="Kerjasama">${icon('briefcase', 12)}</button>
                <button class="act-btn edit" onclick="openPartnerForm(${p.id})">${icon('edit', 12)}</button>
                <button class="act-btn del" onclick="deletePartner(${p.id},'${(p.partner_name||'').replace(/'/g,"\\'")}')">${icon('trash', 12)}</button>
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
        <div style="padding:8px 12px;border-radius:8px 8px 0 0;background:${col};color:var(--on-accent);font-size:12px;font-weight:700;display:flex;justify-content:space-between">
          <span>${s}</span><span>${cards.length}</span>
        </div>
        <div style="background:var(--white);border-radius:0 0 8px 8px;padding:6px;min-height:100px;box-shadow:var(--shadow)">
          ${cards.map(p=>`
            <div style="background:${col}12;border-radius:6px;padding:8px 10px;margin-bottom:5px;cursor:pointer;border-left:3px solid ${col}"
              onclick="openPartnerForm(${p.id})">
              <div style="font-size:12px;font-weight:700;color:var(--navy)">${p.partner_name||'—'}</div>
              <div style="font-size:11px;color:var(--gray)">${p.category||''}</div>
              ${p.pic_name?`<div style="font-size:11px;color:var(--gray);display:flex;align-items:center;gap:4px">${icon('user', 10)} ${p.pic_name}</div>`:''}
              ${p.assigned_name?`<div style="font-size:10px;color:var(--teal);display:flex;align-items:center;gap:4px;margin-top:2px">${icon('briefcase', 10)} ${p.assigned_name}</div>`:''}
            </div>`).join('')||
          `<div style="text-align:center;padding:16px;color:#ccc;font-size:11px">Kosong</div>`}
        </div>
      </div>`;
  }).join('');
}

function togglePView() {
  const btn = document.getElementById('btn-view-toggle');
  if (PS.view === 'table') {
    PS.view = 'kanban';
    document.getElementById('pv-table').style.display = 'none';
    document.getElementById('pv-kanban').style.display = 'block';
    document.getElementById('pv-map').style.display = 'none';
    if (btn) btn.innerHTML = `${icon('map', 13)} Map View`;
    renderKanban();
  } else if (PS.view === 'kanban') {
    PS.view = 'map';
    document.getElementById('pv-table').style.display = 'none';
    document.getElementById('pv-kanban').style.display = 'none';
    document.getElementById('pv-map').style.display = 'block';
    if (btn) btn.innerHTML = `${icon('list', 13)} Table View`;
    renderPMap();
  } else {
    PS.view = 'table';
    document.getElementById('pv-table').style.display = 'block';
    document.getElementById('pv-kanban').style.display = 'none';
    document.getElementById('pv-map').style.display = 'none';
    if (btn) btn.innerHTML = `${icon('kanban', 13)} Pipeline (Kanban)`;
    renderPTable();
  }
}

// ── Map View ──────────────────────────────────────
// loadMapsApiKey() didefinisikan di modules/maps/index.js (sumber tunggal).
// Dulu disalin di sini juga — deklarasi rangkap yang identik. Karena kedua modul
// selalu dimuat saat startup, cukup satu definisi; salinan di sini dihapus agar
// tidak menjadi fungsi global ganda.

async function renderPMap() {
  const mapCanvas = document.getElementById('partner-map-canvas');
  if (!mapCanvas) return;

  // Check if google maps sdk is loaded
  if (!window.google || !window.google.maps) {
    const key = await loadMapsApiKey();
    if (!key) {
      mapCanvas.innerHTML = `
        <div style="text-align:center;padding:30px">
          <div style="font-weight:700;font-size:15px;color:var(--navy);margin-bottom:4px">Google Maps API Key Belum Diset</div>
          <div style="font-size:12px;color:var(--gray);margin-bottom:12px">Buka menu Maps Prospecting untuk memasukkan API Key</div>
          <button class="btn btn-teal btn-sm" onclick="navigate('maps')">Ke Maps Prospecting</button>
        </div>`;
      return;
    }
    // Load script dynamically
    mapCanvas.innerHTML = `
      <div style="text-align:center;padding:30px">
        <div class="spinner" style="margin:0 auto 12px"></div>
        <div>Menghubungkan ke Google Maps...</div>
      </div>`;
    
    if (!document.getElementById('gmsdk-partner')) {
      window.onPartnerMapsReady = function() { renderPMap(); };
      const s = document.createElement('script'); s.id = 'gmsdk-partner';
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=onPartnerMapsReady&language=id`;
      document.head.appendChild(s);
    }
    return;
  }

  // Clear map container and init Google Maps
  mapCanvas.innerHTML = '';
  const defaultCenter = { lat: -6.2088, lng: 106.8456 }; // Jakarta
  PS.mapInstance = new google.maps.Map(mapCanvas, {
    center: defaultCenter,
    zoom: 11,
    mapTypeControl: true,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
      position: google.maps.ControlPosition.TOP_RIGHT,
    },
    streetViewControl: false,
    fullscreenControl: true,
  });

  // Plot partner markers
  const bounds = new google.maps.LatLngBounds();
  let mappedCount = 0;
  let unmappedList = [];

  // Clear old markers
  (PS.markers || []).forEach(m => m.setMap(null));
  PS.markers = [];

  PS.filtered.forEach((p) => {
    const lat = parseFloat(p.latitude);
    const lng = parseFloat(p.longitude);

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      unmappedList.push(p);
      return;
    }

    mappedCount++;
    const pos = { lat, lng };
    bounds.extend(pos);

    const stColor = STATUS_COLORS[p.status] || '#00A896';
    const marker = new google.maps.Marker({
      position: pos,
      map: PS.mapInstance,
      title: p.partner_name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: stColor,
        fillOpacity: 0.95,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      }
    });

    const wn = (p.phone || '').replace(/\D/g, '');
    const waUrl = wn ? `https://wa.me/${wn.startsWith('0') ? '62' + wn.slice(1) : wn}` : '';

    const infoContent = `
      <div style="padding:6px;max-width:260px;font-family:inherit">
        <div style="font-weight:800;font-size:14px;color:var(--navy);margin-bottom:2px">${p.partner_name}</div>
        ${p.partner_code ? `<div style="font-size:11px;color:var(--gray);font-family:monospace;margin-bottom:4px">${p.partner_code}</div>` : ''}
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
          <span style="background:var(--lgray);font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600">${catIcon(p.category)} ${p.category}</span>
          <span style="background:${stColor}20;color:${stColor};font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700">${p.status || 'Prospect'}</span>
        </div>
        ${p.address ? `<div style="font-size:11px;color:var(--gray);margin-bottom:6px">${p.address}</div>` : ''}
        ${p.pic_name ? `<div style="font-size:11px;color:var(--navy);margin-bottom:6px">👤 ${p.pic_name} ${p.phone ? '· ' + p.phone : ''}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:8px">
          ${waUrl ? `<a href="${waUrl}" target="_blank" style="background:#25D366;color:var(--on-accent);text-decoration:none;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:600">💬 WA</a>` : ''}
          <button onclick="openPartnerForm(${p.id})" style="background:var(--teal);color:var(--on-accent);border:none;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer">Edit</button>
          <button onclick="showDealsOverlay(${p.id},'${(p.partner_name||'').replace(/'/g,"\\'")}')" style="background:var(--navy);color:var(--on-accent);border:none;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer">Kerjasama</button>
        </div>
      </div>`;

    marker.addListener('click', () => {
      if (PS.activeInfoWindow) PS.activeInfoWindow.close();
      PS.activeInfoWindow = new google.maps.InfoWindow({ content: infoContent });
      PS.activeInfoWindow.open(PS.mapInstance, marker);
    });

    PS.markers.push(marker);
  });

  // Update badge & stats info
  const statsBadge = document.getElementById('pmap-stats-badge');
  if (statsBadge) statsBadge.textContent = `${mappedCount} dari ${PS.filtered.length} mitra terpetakan`;

  const unmappedInfo = document.getElementById('pmap-unmapped-info');
  if (unmappedInfo) {
    if (unmappedList.length > 0) {
      unmappedInfo.innerHTML = `⚠️ ${unmappedList.length} belum ada koordinat · <button class="btn btn-teal btn-xs" onclick="autoGeocodeUnmappedPartners()">📍 Auto-Geocode (${unmappedList.length})</button>`;
    } else {
      unmappedInfo.innerHTML = `✅ Semuanya terpetakan dengan sempurna`;
    }
  }

  if (mappedCount > 0) {
    PS.mapInstance.fitBounds(bounds);
    if (mappedCount === 1) PS.mapInstance.setZoom(14);
  }

  // Auto trigger geocode if unmapped partners exist
  if (unmappedList.length > 0 && window.google && window.google.maps && google.maps.Geocoder) {
    setTimeout(() => autoGeocodeUnmappedPartners(), 800);
  }
}

function focusPartnerOnMap(id) {
  const p = PS.filtered.find(x => x.id === id);
  if (!p) return;
  const lat = parseFloat(p.latitude);
  const lng = parseFloat(p.longitude);
  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && PS.mapInstance) {
    PS.mapInstance.setCenter({ lat, lng });
    PS.mapInstance.setZoom(15);
    const marker = PS.markers.find(m => m.getTitle() === p.partner_name);
    if (marker) {
      google.maps.event.trigger(marker, 'click');
    }
  } else {
    toast(`📍 ${p.partner_name} belum memiliki koordinat`, 'warn');
  }
}

async function autoGeocodeUnmappedPartners() {
  const unmapped = PS.filtered.filter(p => (!p.latitude || !p.longitude) && p.address);
  if (!unmapped.length) { toast('Semua mitra ber-alamat sudah punya koordinat', 'info'); return; }

  if (!window.google || !window.google.maps || !google.maps.Geocoder) {
    toast('Google Maps belum terhubung', 'err'); return;
  }

  const geocoder = new google.maps.Geocoder();
  toast(`📍 Memproses geocoding ${unmapped.length} mitra...`, 'info');
  let count = 0;

  for (const p of unmapped) {
    try {
      const res = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: p.address, componentRestrictions: { country: 'id' } }, (results, status) => {
          if (status === 'OK' && results[0]) resolve(results[0].geometry.location);
          else reject(status);
        });
      });

      const lat = res.lat();
      const lng = res.lng();

      await sbPatch('partners', p.id, { latitude: lat, longitude: lng, updated_at: new Date().toISOString() });
      p.latitude = lat;
      p.longitude = lng;
      count++;
      await new Promise(r => setTimeout(r, 400));
    } catch(e) {}
  }

  toast(`✅ Berhasil geocode ${count} lokasi mitra!`, 'ok');
  await renderPMap();
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
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
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
      <div class="modal-title">${id?'Edit Partner':'+ Tambah Partner'}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>

    ${id ? `
    <div style="background:var(--lgray);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--gray);display:flex;gap:16px;flex-wrap:wrap">
      ${p.assigned_name?`<span>👤 Dibuat oleh: <strong style="color:var(--navy)">${p.assigned_name}</strong></span>`:''}
      ${p.created_at?`<span>Dibuat: <strong>${formatDate(p.created_at)}</strong></span>`:''}
      ${p.updated_at?`<span>Update: <strong>${timeAgo(p.updated_at)}</strong></span>`:''}
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
      <div class="form-group">
        <label>Latitude</label>
        <input type="text" id="pf-lat" value="${p.latitude||''}" placeholder="-6.200000">
      </div>
      <div class="form-group">
        <label>Longitude</label>
        <input type="text" id="pf-lng" value="${p.longitude||''}" placeholder="106.810000">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Catatan</label>
        <textarea id="pf-notes" rows="3"
          placeholder="Hasil kunjungan, info penting, next action...">${p.notes||''}</textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      ${id?`<button class="btn btn-outline" onclick="closeModalForce();setTimeout(()=>showDealsOverlay(${id},'${(p.partner_name||'').replace(/'/g,"\\'")}'),200)">Kelola Kerjasama</button>`:''}
      <button class="btn btn-teal" onclick="savePartner(${id||'null'})">
        ${id?'Simpan':'+ Tambah'}
      </button>
    </div>`);
}

async function savePartner(id) {
  const name = document.getElementById('pf-name').value.trim();
  const cat  = document.getElementById('pf-cat').value;
  if(!name){ toast('Nama wajib diisi','err'); return; }
  if(!cat){  toast('Kategori wajib dipilih','err'); return; }

  const user = getUserName ? getUserName() : 'User';
  const latVal = document.getElementById('pf-lat')?.value.trim();
  const lngVal = document.getElementById('pf-lng')?.value.trim();

  const payload = {
    partner_code:  document.getElementById('pf-code').value.trim() || autoCode(cat),
    partner_name:  name,
    category:      cat,
    assigned_name: document.getElementById('pf-assigned').value.trim() || user,
    pic_name:      document.getElementById('pf-pic').value.trim(),
    phone:         document.getElementById('pf-phone').value.trim(),
    email:         document.getElementById('pf-email').value.trim(),
    address:       document.getElementById('pf-addr').value.trim(),
    latitude:      latVal ? parseFloat(latVal) : null,
    longitude:     lngVal ? parseFloat(lngVal) : null,
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
      toast('Partner ditambahkan','ok');
    }
    closeModalForce();
    await loadPartners();
  } catch(e){ toast(e.message,'err'); }
}

async function deletePartner(id, name) {
  if(!confirm(`Hapus "${name}"?\nSemua data kerjasama terkait akan ikut terhapus.`)) return;
  const user = getUserName ? getUserName() : 'User';
  try {
    await sbDelete('partners', id);
    await logActivity('delete','partners', id,
      `Partner dihapus oleh ${user}`, name);
    toast(`"${name}" dihapus`,'info');
    await loadPartners();
  } catch(e){ toast(e.message,'err'); }
}

// ── Deals Overlay (TERPISAH dari modal utama) ─────
// Pakai overlay sendiri agar tidak konflik dengan modal
// Tambah parameter style dan icon
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
    <div style="background:var(--white);border-radius:14px;max-width:620px;width:100%;
      max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.2)">

      <!-- Header -->
      <div style="padding:18px 20px;border-bottom:1px solid var(--border);
        display:flex;align-items:center;justify-content:space-between;
        position:sticky;top:0;background:var(--white);z-index:10;border-radius:14px 14px 0 0">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--navy);display:flex;align-items:center;gap:6px">${icon('briefcase', 16)} Output Kerjasama</div>
          <div style="font-size:12px;color:var(--gray);margin-top:2px">${partnerName}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-teal btn-sm"
            onclick="openDealForm(${partnerId},null,'${partnerName.replace(/'/g,"\\'")}')">
            Tambah Output
          </button>
          <button onclick="document.getElementById('deals-overlay').remove()"
            style="background:var(--lgray);border:none;border-radius:50%;width:30px;height:30px;
            cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center" style="font-size:10.5px;font-weight:700"></button>
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
// Remove emoji in download alert
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
  toast('CSV diunduh','ok');
}