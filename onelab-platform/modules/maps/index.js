// ═══════════════════════════════════════════
// MODULE: Maps Prospecting v5
// - Search persis seperti Google Maps
// - Autocomplete realtime saat ketik
// - Tidak perlu tekan tombol Set Lokasi
// ═══════════════════════════════════════════

let mapsState = { service:null, ready:false, results:[], selected:new Set(), apiKey:'' };
let autocompleteWidget = null; // Google Places Autocomplete widget
let searchCenter = null;

const MAP_CATEGORIES = [
  {label:'🏥 Klinik Pratama', q:'klinik pratama', group:'Medis'},
  {label:'🏥 Klinik Utama',   q:'klinik utama',   group:'Medis'},
  {label:'👨‍⚕️ Dokter Umum',   q:'dokter praktik umum', group:'Medis'},
  {label:'🩺 Spesialis',      q:'dokter spesialis', group:'Medis'},
  {label:'👶 Dokter Anak',    q:'dokter anak',     group:'Medis'},
  {label:'🦷 Dokter Gigi',    q:'klinik gigi',     group:'Medis'},
  {label:'👁 Dokter Mata',    q:'klinik mata',     group:'Medis'},
  {label:'🤰 Kandungan',      q:'dokter kandungan', group:'Medis'},
  {label:'🏨 Puskesmas',      q:'puskesmas',       group:'Medis'},
  {label:'🏦 Rumah Sakit',    q:'rumah sakit',     group:'Medis'},
  {label:'🔬 Lab Klinik',     q:'laboratorium klinik', group:'Medis'},
  {label:'💊 Apotek',         q:'apotek',          group:'Farmasi'},
  {label:'💊 Apotek K24',     q:'apotek k24',      group:'Farmasi'},
  {label:'🏋️ Gym & Fitness',  q:'gym fitness center', group:'Wellness'},
  {label:'🧘 Yoga/Pilates',   q:'yoga pilates studio', group:'Wellness'},
  {label:'⛳ Golf Club',      q:'golf club',       group:'Wellness'},
  {label:'🚴 Cycling Club',   q:'cycling club',    group:'Wellness'},
  {label:'💆 Spa & Wellness', q:'spa wellness center', group:'Wellness'},
  {label:'🏢 Perusahaan',     q:'kantor perusahaan', group:'Korporat'},
  {label:'🏭 Pabrik',         q:'pabrik industri', group:'Korporat'},
  {label:'🏗 Kawasan Industri',q:'kawasan industri', group:'Korporat'},
  {label:'🎓 Sekolah',        q:'sekolah',         group:'Pendidikan'},
  {label:'🎓 Universitas',    q:'universitas kampus', group:'Pendidikan'},
  {label:'🕌 Masjid',         q:'masjid islamic center', group:'Komunitas'},
  {label:'🏘 Perumahan',      q:'perumahan cluster', group:'Komunitas'},
];

const CAT_GROUPS = [...new Set(MAP_CATEGORIES.map(c=>c.group))];

async function renderMaps() {
  mapsState.apiKey = await loadMapsApiKey();

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Maps Prospecting</h1>
        <p>Cari mitra via Google Maps → import langsung ke Leads Management</p></div>
    </div>

    <!-- API Key -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-title" style="margin-bottom:12px">🔑 Google Maps API Key</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="password" id="mk" class="table-search" style="flex:1;min-width:200px"
          placeholder="AIza..." value="${mapsState.apiKey}">
        <button class="btn btn-ghost btn-sm" onclick="toggleMK()">👁</button>
        <button class="btn btn-teal btn-sm" onclick="connectMaps()">⚡ Sambungkan</button>
        <button class="btn btn-outline btn-sm" onclick="saveMapsApiKey()">💾 Simpan</button>
      </div>
      <div id="maps-status" class="status-box ${mapsState.apiKey?'status-info':'status-warn'}" style="margin-top:8px">
        ${mapsState.apiKey?'⏳ Key ditemukan, klik Sambungkan...':'⚠️ Masukkan API key lalu simpan.'}
      </div>
    </div>

    <!-- Search Config -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-title" style="margin-bottom:12px">📍 Lokasi & Kategori</div>

      <!-- Search box persis seperti Google Maps -->
      <div class="form-group" style="margin-bottom:14px">
        <label>Cari lokasi (ketik seperti Google Maps)</label>
        <div style="position:relative">
          <input type="text" id="maps-place-input"
            style="width:100%;padding:12px 44px 12px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:border .2s"
            placeholder="Ketik nama kota, area, atau alamat..."
            onfocus="this.style.borderColor='var(--teal)'"
            onblur="this.style.borderColor='var(--border)'">
          <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:18px;pointer-events:none">📍</span>
        </div>
        <div id="place-confirmed" style="display:none;margin-top:8px;padding:8px 12px;background:var(--mint);border-radius:6px;font-size:12px;color:#085041;display:flex;align-items:center;gap:6px"></div>
      </div>

      <div class="form-row" style="margin-bottom:14px">
        <div class="form-group">
          <label>Radius</label>
          <select id="maps-radius">
            <option value="500">500 m</option>
            <option value="1000">1 km</option>
            <option value="2000">2 km</option>
            <option value="5000" selected>5 km</option>
            <option value="10000">10 km</option>
            <option value="20000">20 km</option>
          </select>
        </div>
        <div class="form-group" style="align-self:flex-end">
          <div id="coords-display" style="font-size:12px;color:var(--gray);padding:10px 0">
            📍 Koordinat: belum diset
          </div>
        </div>
      </div>

      <!-- Kategori -->
      <div class="form-group">
        <label>Kategori Target</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button class="btn btn-ghost btn-sm" onclick="selAllCat(true)">☑ Semua</button>
          <button class="btn btn-ghost btn-sm" onclick="selAllCat(false)">☐ Hapus</button>
          ${CAT_GROUPS.map(g=>`<button class="btn btn-ghost btn-sm" onclick="selCatGroup('${g}')">${g}</button>`).join('')}
        </div>
        ${CAT_GROUPS.map(g=>`
          <div style="margin-bottom:10px">
            <div style="font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${g}</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px">
              ${MAP_CATEGORIES.filter(c=>c.group===g).map(c=>`
                <span class="maps-chip chip on" data-q="${c.q}" data-group="${g}"
                  onclick="toggleMChip(this)"
                  style="background:var(--teal);color:#fff;border-color:var(--teal)">${c.label}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>

      <div class="btn-row" style="margin-top:14px">
        <button class="btn btn-primary" id="maps-search-btn" onclick="startMapsSearch()" disabled>
          🔍 Cari Mitra
        </button>
        <span id="maps-cat-count" style="font-size:12px;color:var(--gray);align-self:center"></span>
      </div>

      <div id="maps-prog-wrap" style="display:none;margin-top:10px">
        <div style="background:var(--mint);border-radius:6px;height:7px;overflow:hidden">
          <div id="maps-prog" style="height:100%;background:var(--teal);width:0;border-radius:6px;transition:width .3s"></div>
        </div>
        <div id="maps-prog-txt" style="font-size:12px;color:var(--gray);margin-top:5px"></div>
      </div>
    </div>

    <!-- Results -->
    <div id="maps-results-wrap" style="display:none">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span id="maps-res-count" style="font-size:13px;font-weight:700;color:var(--navy)"></span>
          <input class="table-search" id="maps-res-filter" placeholder="🔍 Filter hasil..."
            oninput="filterMapsRes(this.value)" style="max-width:200px">
          <div class="btn-row" style="margin-left:auto">
            <button class="btn btn-ghost btn-sm" onclick="toggleAllMapsSelect()">☑ Pilih Semua</button>
            <button class="btn btn-teal btn-sm" id="maps-import-btn" onclick="importSelectedMaps()" disabled>
              ⬆ Import
            </button>
          </div>
        </div>
        <div id="maps-results-body"></div>
      </div>
    </div>

    <div id="map-el" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"></div>`;

  updateMapsCatCount();

  // Auto connect jika key ada
  if (mapsState.apiKey) {
    connectMaps();
  }
}

// ── Connect & init autocomplete ───────────────────
function toggleMK() {
  const i = document.getElementById('mk');
  i.type = i.type === 'password' ? 'text' : 'password';
}

function connectMaps() {
  const key = document.getElementById('mk')?.value.trim() || mapsState.apiKey;
  if (!key) { showMapsStatus('err','⚠️ API key kosong'); return; }

  document.getElementById('gmsdk')?.remove();
  mapsState.ready = false;
  autocompleteWidget = null;
  showMapsStatus('info','⏳ Menghubungkan...');

  const s = document.createElement('script'); s.id = 'gmsdk';
  s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=onMapsReady&language=id`;
  s.onerror = () => showMapsStatus('err','❌ Gagal. Aktifkan Maps JS API + Places API + Geocoding API di Google Cloud Console.');
  document.head.appendChild(s);
}

window.onMapsReady = function() {
  try {
    const mapEl = document.getElementById('map-el');
    if (!mapEl) return;

    // Init invisible map (required for PlacesService)
    const map = new google.maps.Map(mapEl, {
      center: {lat:-6.2, lng:106.8}, zoom:13
    });
    mapsState.service = new google.maps.places.PlacesService(map);
    mapsState.ready = true;

    // Init Autocomplete — persis seperti search bar Google Maps
    const input = document.getElementById('maps-place-input');
    if (input) {
      autocompleteWidget = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'id' },
        fields: ['geometry', 'formatted_address', 'name'],
        language: 'id'
      });

      // Event: user pilih suggestion dari dropdown
      autocompleteWidget.addListener('place_changed', () => {
        const place = autocompleteWidget.getPlace();
        if (place.geometry && place.geometry.location) {
          searchCenter = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          };
          document.getElementById('coords-display').textContent =
            `📍 ${place.formatted_address || place.name}`;
          document.getElementById('coords-display').style.color = 'var(--teal)';

          // Show confirmed
          const confirmed = document.getElementById('place-confirmed');
          confirmed.style.display = 'flex';
          confirmed.textContent = `✅ Lokasi: ${place.formatted_address || place.name}`;

          toast('📍 Lokasi ditetapkan!', 'ok');
        }
      });
    }

    showMapsStatus('ok','✅ Google Maps terhubung! Ketik lokasi di kotak pencarian.');
    document.getElementById('maps-search-btn').disabled = false;
    toast('✅ Maps terhubung','ok');
  } catch(e) {
    showMapsStatus('err','❌ ' + e.message);
  }
};

function showMapsStatus(type, msg) {
  const el = document.getElementById('maps-status');
  if (!el) return;
  el.className = `status-box status-${type}`;
  el.textContent = msg;
}

// ── API Key ───────────────────────────────────────
async function loadMapsApiKey() {
  try {
    const d = await sbGet('settings','select=value&key=eq.maps_api_key');
    return d?.[0]?.value || localStorage.getItem('ol_maps_key') || '';
  } catch(e) { return localStorage.getItem('ol_maps_key') || ''; }
}

async function saveMapsApiKey() {
  const key = document.getElementById('mk')?.value.trim();
  if (!key) { toast('API key kosong','err'); return; }
  localStorage.setItem('ol_maps_key', key);
  mapsState.apiKey = key;
  try {
    const ex = await sbGet('settings','select=id&key=eq.maps_api_key');
    if (ex?.length) await sbPatch('settings', ex[0].id, {value:key});
    else await sbPost('settings', {key:'maps_api_key', value:key, label:'Google Maps API Key'});
    toast('✅ API key tersimpan permanen','ok');
  } catch(e) { toast('✅ Tersimpan di browser','warn'); }
}

// ── Chips ─────────────────────────────────────────
function toggleMChip(el) {
  const on = el.classList.toggle('on');
  el.style.background = on ? 'var(--teal)' : '#fff';
  el.style.color = on ? '#fff' : 'var(--gray)';
  el.style.borderColor = on ? 'var(--teal)' : 'var(--border)';
  updateMapsCatCount();
}
function selAllCat(on) {
  document.querySelectorAll('.maps-chip').forEach(c => {
    c.classList.toggle('on', on);
    c.style.background = on ? 'var(--teal)' : '#fff';
    c.style.color = on ? '#fff' : 'var(--gray)';
    c.style.borderColor = on ? 'var(--teal)' : 'var(--border)';
  });
  updateMapsCatCount();
}
function selCatGroup(group) {
  const chips = document.querySelectorAll(`.maps-chip[data-group="${group}"]`);
  const allOn = [...chips].every(c => c.classList.contains('on'));
  chips.forEach(c => {
    c.classList.toggle('on', !allOn);
    c.style.background = !allOn ? 'var(--teal)' : '#fff';
    c.style.color = !allOn ? '#fff' : 'var(--gray)';
    c.style.borderColor = !allOn ? 'var(--teal)' : 'var(--border)';
  });
  updateMapsCatCount();
}
function updateMapsCatCount() {
  const n = document.querySelectorAll('.maps-chip.on').length;
  const el = document.getElementById('maps-cat-count');
  if (el) el.textContent = n ? `${n} kategori dipilih` : '';
}

// ── Search ────────────────────────────────────────
async function startMapsSearch() {
  if (!mapsState.ready) { toast('Sambungkan Maps dulu','err'); return; }
  if (!searchCenter) {
    toast('Ketik dan pilih lokasi dari dropdown dulu','warn');
    document.getElementById('maps-place-input')?.focus();
    return;
  }
  const chips = [...document.querySelectorAll('.maps-chip.on')];
  if (!chips.length) { toast('Pilih minimal 1 kategori','err'); return; }

  mapsState.results = []; mapsState.selected = new Set();
  document.getElementById('maps-results-wrap').style.display = 'none';
  document.getElementById('maps-search-btn').disabled = true;
  document.getElementById('maps-search-btn').textContent = '⏳ Mencari...';
  document.getElementById('maps-prog-wrap').style.display = 'block';

  const radius = parseInt(document.getElementById('maps-radius').value);
  const center = new google.maps.LatLng(searchCenter.lat, searchCenter.lng);
  const kws = chips.map(c => c.dataset.q);

  for (let i = 0; i < kws.length; i++) {
    document.getElementById('maps-prog-txt').textContent =
      `Mencari "${kws[i]}"... (${i+1}/${kws.length})`;
    document.getElementById('maps-prog').style.width =
      Math.round(i / kws.length * 100) + '%';
    await mapsSearchKw(center, radius, kws[i]);
    await new Promise(r => setTimeout(r, 300));
  }

  document.getElementById('maps-prog').style.width = '100%';
  document.getElementById('maps-prog-txt').textContent =
    `✅ ${mapsState.results.length} lokasi ditemukan`;
  document.getElementById('maps-search-btn').disabled = false;
  document.getElementById('maps-search-btn').textContent = '🔍 Cari Mitra';

  await renderMapsResults();
}

function mapsSearchKw(center, radius, kw) {
  return new Promise(resolve => {
    function handle(results, status, pag) {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        results.forEach(p => {
          if (!mapsState.results.find(r => r.place_id === p.place_id)) {
            mapsState.results.push({
              place_id: p.place_id,
              name: p.name,
              address: p.vicinity || '',
              category: kw,
              phone: '',
              rating: p.rating || '',
              reviews: p.user_ratings_total || 0,
              lat: p.geometry?.location?.lat() || '',
              lng: p.geometry?.location?.lng() || '',
              in_db: false, db_id: null, db_phone: ''
            });
          }
        });
        if (pag?.hasNextPage) setTimeout(() => pag.nextPage(), 2000);
        else resolve();
      } else resolve();
    }
    mapsState.service.nearbySearch(
      { location: center, radius, keyword: kw, language: 'id' }, handle
    );
  });
}

async function renderMapsResults() {
  document.getElementById('maps-results-wrap').style.display = 'block';
  document.getElementById('maps-res-count').textContent = 'Mengecek database...';
  document.getElementById('maps-results-body').innerHTML =
    '<div class="loading-row"><div class="spinner"></div></div>';

  // Cek duplikat di DB
  try {
    const names = [...new Set(mapsState.results.map(r => r.name))];
    if (names.length) {
      const qStr = names.map(n => `"${n.replace(/"/g,'\\"')}"`).join(',');
      const ex = await sbGet('partners', `select=id,partner_name,phone&partner_name=in.(${qStr})`);
      const exMap = {};
      (ex||[]).forEach(p => { exMap[p.partner_name] = {id:p.id, phone:p.phone}; });
      mapsState.results.forEach(r => {
        if (exMap[r.name]) {
          r.in_db = true;
          r.db_id = exMap[r.name].id;
          r.db_phone = exMap[r.name].phone;
        }
      });
    }
  } catch(e) {}

  const inDB = mapsState.results.filter(r => r.in_db).length;
  const newOnes = mapsState.results.length - inDB;
  document.getElementById('maps-res-count').innerHTML = `
    <span>${mapsState.results.length} lokasi</span>
    <span class="badge badge-green" style="margin-left:8px">${newOnes} baru</span>
    <span class="badge badge-gray" style="margin-left:4px">${inDB} sudah ada</span>`;

  if (!mapsState.results.length) {
    document.getElementById('maps-results-body').innerHTML =
      '<div class="empty-state"><div class="ico">🔍</div><h3>Tidak ada hasil</h3><p>Coba perluas radius atau tambah kategori.</p></div>';
    return;
  }

  document.getElementById('maps-results-body').innerHTML = `
    <table>
      <thead><tr>
        <th><input type="checkbox" id="maps-chk-all" onchange="toggleAllMapsChk(this.checked)"></th>
        <th>#</th><th>Nama</th><th>Kategori</th><th>Alamat</th>
        <th>Telepon</th><th>Rating</th><th>Aksi</th>
      </tr></thead>
      <tbody>
        ${mapsState.results.map((r, i) => {
          const mu = `https://www.google.com/maps/place/?q=place_id:${r.place_id}`;
          return `<tr id="mr-${i}" style="${r.in_db ? 'background:#FAFFF9' : ''}">
            <td><input type="checkbox" class="maps-chk" data-idx="${i}"
              onchange="toggleMapsSelect(${i},this.checked)"
              ${r.in_db && r.db_phone ? 'disabled title="Sudah lengkap"' : ''}></td>
            <td style="color:#bbb;font-size:11px">${i+1}</td>
            <td>
              <div class="td-name">${r.name}</div>
              ${r.in_db
                ? `<span class="badge badge-green" style="font-size:10px">✓ Ada di DB${!r.db_phone ? ' · belum ada telepon' : ''}</span>`
                : `<span class="badge badge-gold" style="font-size:10px">Baru</span>`}
            </td>
            <td><span class="badge badge-gray" style="font-size:11px">${catIcon(r.category)} ${r.category}</span></td>
            <td style="font-size:12px;color:var(--gray);max-width:180px">${r.address}</td>
            <td id="mp-${i}" class="td-phone">
              ${r.phone ? r.phone
                : r.db_phone ? `<span style="color:var(--gray);font-size:11px">${r.db_phone}</span>`
                : `<button class="act-btn" onclick="fetchMapsPhone(${i})">📞</button>`}
            </td>
            <td>${r.rating ? `⭐${r.rating}` : '—'}</td>
            <td>
              <div class="act-row">
                <button class="act-btn maps" onclick="window.open('${mu}','_blank')">🗺</button>
                ${r.in_db
                  ? `<button class="act-btn edit" onclick="navigate('partners',{highlight:${r.db_id}})">✏️</button>`
                  : `<button class="act-btn" onclick="importOneMaps(${i})" title="Import satu">⬆</button>`}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function filterMapsRes(q) {
  document.querySelectorAll('#maps-results-body tbody tr').forEach(tr => {
    tr.style.display = !q || tr.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ── Select ────────────────────────────────────────
function toggleMapsSelect(idx, checked) {
  if (checked) mapsState.selected.add(idx);
  else mapsState.selected.delete(idx);
  updateMapsImportBtn();
}
function toggleAllMapsChk(checked) {
  document.querySelectorAll('.maps-chk:not(:disabled)').forEach(c => {
    c.checked = checked;
    toggleMapsSelect(parseInt(c.dataset.idx), checked);
  });
}
function toggleAllMapsSelect() {
  const all = [...document.querySelectorAll('.maps-chk:not(:disabled)')];
  const on = all.every(c => c.checked);
  all.forEach(c => { c.checked = !on; toggleMapsSelect(parseInt(c.dataset.idx), !on); });
  const ca = document.getElementById('maps-chk-all');
  if (ca) ca.checked = !on;
}
function updateMapsImportBtn() {
  const btn = document.getElementById('maps-import-btn');
  if (!btn) return;
  btn.disabled = mapsState.selected.size === 0;
  btn.textContent = mapsState.selected.size
    ? `⬆ Import ${mapsState.selected.size}`
    : '⬆ Import';
}

// ── Phone fetch ───────────────────────────────────
function fetchMapsPhone(idx) {
  if (!mapsState.ready) { toast('Maps belum konek','err'); return; }
  const r = mapsState.results[idx];
  const cell = document.getElementById(`mp-${idx}`);
  if (cell) cell.innerHTML = '<span style="color:#ccc;font-size:11px">⏳</span>';

  mapsState.service.getDetails(
    { placeId: r.place_id, fields: ['formatted_phone_number'] },
    (res, st) => {
      if (st === google.maps.places.PlacesServiceStatus.OK && res) {
        const ph = res.formatted_phone_number || '';
        if (!ph) {
          if (cell) cell.innerHTML = `<button class="act-btn" onclick="fetchMapsPhone(${idx})">📞</button>`;
          toast('Nomor tidak tersedia','warn'); return;
        }
        mapsState.results[idx].phone = ph;
        if (cell) cell.innerHTML = `<span class="td-phone">${ph}</span>`;
        if (r.in_db && r.db_id) {
          sbPatch('partners', r.db_id, {phone: ph, updated_at: new Date().toISOString()})
            .then(() => toast(`📞 ${r.name} diupdate`, 'ok'))
            .catch(() => {});
        } else {
          toast('📞 ' + ph, 'ok');
        }
      } else {
        if (cell) cell.innerHTML = `<button class="act-btn" onclick="fetchMapsPhone(${idx})">📞</button>`;
      }
    }
  );
}

// ── Import ────────────────────────────────────────
async function importOneMaps(idx) {
  mapsState.selected = new Set([idx]);
  await importSelectedMaps();
}

async function importSelectedMaps() {
  if (!mapsState.selected.size) { toast('Pilih dulu','warn'); return; }
  const btn = document.getElementById('maps-import-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Import ke Leads...'; }

  let added = 0, skipped = 0;
  const user = getUserName ? getUserName() : 'User';

  for (const idx of mapsState.selected) {
    const r = mapsState.results[idx];
    try {
      // Check if already in leads
      const existing = await sbGet('leads',
        `select=id&lead_name=ilike.${encodeURIComponent(r.name)}&limit=1`).catch(()=>[]);
      if (existing?.length) { skipped++; continue; }

      const cat = mapCatFromQ(r.category);
      const res = await sbPost('leads', {
        lead_name:       r.name,
        company:         r.name,
        category:        cat,
        phone:           r.phone || '',
        address:         r.address || '',
        source:          'Maps Prospecting',
        status:          'Baru',
        assigned_name:   user,
        notes:           `Import dari Google Maps · Rating: ${r.rating||'—'} · ${r.reviews||0} reviews`,
        estimated_value: 0,
        created_by_name: user,
        updated_at:      new Date().toISOString(),
      });
      if (res && res[0]) {
        await logActivity('create','leads', res[0].id, `Import dari Maps: ${r.name}`, r.name);
        added++;
      }
    } catch(e) { skipped++; }
  }

  mapsState.selected = new Set();
  if (btn) { btn.disabled = false; btn.textContent = '⬆ Import'; }
  
  if (added > 0) {
    toast(`✅ ${added} prospek masuk ke Leads Management`, 'ok', 4000);
    // Show quick nav button
    const el = document.getElementById('maps-result-header');
    if (el) el.innerHTML += `
      <button class="btn btn-teal btn-sm" onclick="navigate('leads')" style="margin-left:8px">
        🎯 Buka Leads →
      </button>`;
  } else {
    toast(`⚠️ ${skipped} sudah ada di Leads`, 'warn');
  }
  await renderMapsResults();
  updateMapsImportBtn();
}

// ── Helpers ───────────────────────────────────────
function mapCatFromQ(q) {
  if (!q) return 'Lainnya'; q = q.toLowerCase();
  if (q.includes('apotek')) return 'Apotek';
  if (q.includes('klinik utama')) return 'Klinik Utama';
  if (q.includes('klinik')) return 'Klinik Pratama';
  if (q.includes('spesialis') || q.includes('kandungan') || q.includes('anak') || q.includes('gigi') || q.includes('mata')) return 'Dokter Spesialis';
  if (q.includes('dokter')) return 'Dokter Praktik';
  if (q.includes('puskesmas')) return 'Puskesmas';
  if (q.includes('rumah sakit')) return 'Rumah Sakit';
  if (q.includes('lab')) return 'Lab Klinik';
  if (q.includes('gym') || q.includes('fitness') || q.includes('yoga') || q.includes('golf') || q.includes('spa') || q.includes('cycling')) return 'Gym & Sport Club';
  if (q.includes('sekolah') || q.includes('universitas')) return 'Sekolah / Kampus';
  if (q.includes('masjid') || q.includes('perumahan')) return 'Komunitas';
  if (q.includes('pabrik') || q.includes('industri') || q.includes('kawasan') || q.includes('kantor')) return 'Perusahaan SME';
  return 'Lainnya';
}
