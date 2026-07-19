// ═══════════════════════════════════════════════════════════════
// MODULE: Aset Tetap & Jadwal Kalibrasi
//
// Dua hal yang selama ini tidak punya layar sama sekali:
//   1. Daftar aset tetap beserta penyusutannya (garis lurus, masuk jurnal).
//   2. Jadwal kalibrasi & pemeliharaan alat — syarat ISO 15189 dan audit
//      BAPETEN. Tabel asset_maintenance dan fungsi complete_maintenance
//      sudah lama ada di basis data, tapi belum pernah bisa dipakai.
//
// Alat yang kalibrasinya lewat jatuh tempo TIDAK layak dipakai mengeluarkan
// hasil. Layar ini menandainya keras-keras, bukan sekadar mencatat.
//
// Seluruh nama global diawali "ast" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

const AST_KATEGORI    = ['Alat Laboratorium','Alat Radiologi','Perangkat IT','Kendaraan',
                         'Furnitur & Interior','Bangunan','Lainnya'];
const AST_STATUS      = ['Aktif','Dilepas','Rusak'];
const AST_MAINT_TYPES = ['Kalibrasi','Preventif','Perbaikan'];
const AST_RESULTS     = ['Lulus','Tidak Lulus','Perlu Tindak Lanjut'];

let astItems     = [];   // dari tampilan ast_asset_book_v (sudah berisi nilai buku)
let astDeprs     = [];   // riwayat penyusutan
let astMaints    = [];   // jadwal kalibrasi & pemeliharaan
let astAnalyzers = [];   // master alat lab
let astTab       = 'list';
let astFilter    = { search:'', kategori:'', status:'' };
let astPeriod    = new Date().toISOString().slice(0, 7);
let astAssetsOk  = false;  // tabel fixed_assets/depreciations siap?
let astMaintOk   = false;  // tabel asset_maintenance siap?

// ── Penolong kecil ────────────────────────────────────────────
function astEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// Pesan yang menjelaskan apa yang harus dilakukan, bukan melempar galat mentah.
function astMissingBox(berkas) {
  return `<div class="status-box status-warn">
    Tabelnya belum ada di basis data. Jalankan <code>${berkas}</code> di
    Supabase SQL Editor, lalu muat ulang halaman ini.</div>`;
}
function astIsMissingTable(e) {
  return /does not exist|schema cache|Could not find the table|relation .* does not exist/i
    .test(e?.message || '');
}

// Selisih hari ke jatuh tempo, dihitung pada batas tanggal (bukan jam).
function astDaysTo(dateStr) {
  if (!dateStr) return null;
  const kini = new Date(); kini.setHours(0, 0, 0, 0);
  const due  = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  if (isNaN(due)) return null;
  return Math.round((due - kini) / 86400000);
}

// Tiga tingkat penanda: terlambat · jatuh tempo ≤30 hari · aman.
function astDueState(dateStr) {
  const h = astDaysTo(dateStr);
  if (h === null) return { key:'none', label:'Tanpa tanggal', badge:'badge-gray',  days:null };
  if (h < 0)      return { key:'late', label:`Terlambat ${Math.abs(h)} hari`, badge:'badge-red',   days:h };
  if (h === 0)    return { key:'soon', label:'Jatuh tempo hari ini',          badge:'badge-gold',  days:h };
  if (h <= 30)    return { key:'soon', label:`${h} hari lagi`,                badge:'badge-gold',  days:h };
  return            { key:'safe', label:`${h} hari lagi`,                     badge:'badge-green', days:h };
}

function astOpenMaints()      { return astMaints.filter(m => !m.done_at); }
function astOverdueMaints()   { return astOpenMaints().filter(m => astDueState(m.due_date).key === 'late'); }
// Hanya kalibrasi yang terlambat yang membuat alat tak layak mengeluarkan hasil.
// Pemeliharaan preventif yang lewat itu perkara jadwal, bukan mutu hasil.
function astUnfitMaints()     { return astOverdueMaints().filter(m => m.maint_type === 'Kalibrasi'); }

function astCanRunDepr() {
  return ['super_admin','direktur','finance'].includes(getUserRole ? getUserRole() : '');
}

// ── Kerangka halaman ──────────────────────────────────────────
async function renderAssets(initialTab = 'list') {
  astTab = initialTab || 'list';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>🏛️ Aset Tetap &amp; Kalibrasi</h1>
        <p style="color:var(--text3);font-size:13px">
          Daftar aset, penyusutan garis lurus, dan jadwal kalibrasi alat</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="astOpenMaintForm()">🗓️ Jadwal Baru</button>
        <button class="btn btn-teal btn-sm" onclick="astOpenAssetForm()">+ Tambah Aset</button>
      </div>
    </div>

    <div id="ast-unfit"></div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-bottom:16px"
         id="ast-summary"></div>

    <div class="tabs" id="ast-tabs" style="margin-bottom:14px">
      <button class="tab-btn${astTab === 'list'  ? ' active' : ''}" onclick="astSwitchTab('list',this)">🏛️ Daftar Aset</button>
      <button class="tab-btn${astTab === 'depr'  ? ' active' : ''}" onclick="astSwitchTab('depr',this)">📉 Penyusutan</button>
      <button class="tab-btn${astTab === 'maint' ? ' active' : ''}" onclick="astSwitchTab('maint',this)">🔧 Jadwal Kalibrasi</button>
    </div>

    <div id="ast-content"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await astLoadAll();
}

function astSwitchTab(tab, btn) {
  astTab = tab;
  document.querySelectorAll('#ast-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  astPaintTab();
}

// Semua data diambil sekali; tiap tab tinggal menggambar ulang dari memori.
async function astLoadAll() {
  const el = document.getElementById('ast-content');
  if (el) el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

  astAssetsOk = false; astMaintOk = false;
  astItems = []; astDeprs = []; astMaints = []; astAnalyzers = [];

  // Aset tetap + penyusutan (skema baru)
  try {
    astItems = await sbGet('ast_asset_book_v', 'select=*&order=kode.asc,id.asc') || [];
    astDeprs = await sbGet('depreciations', 'select=*&order=periode.desc,id.desc&limit=1000') || [];
    astAssetsOk = true;
  } catch (e) {
    if (!astIsMissingTable(e)) toast('Aset gagal dimuat: ' + e.message, 'err');
  }

  // Jadwal kalibrasi (skema lama, sudah ada)
  try {
    astMaints = await sbGet('asset_maintenance',
      'select=*&order=due_date.asc,id.asc&limit=1000') || [];
    astMaintOk = true;
  } catch (e) {
    if (!astIsMissingTable(e)) toast('Jadwal gagal dimuat: ' + e.message, 'err');
  }

  // Master alat lab — dipakai untuk menautkan jadwal & aset. Bukan penghalang.
  try {
    astAnalyzers = await sbGet('analyzers',
      'select=id,nama_alat,merk,model,status,lokasi,kalibrasi_berikutnya&order=nama_alat.asc') || [];
  } catch (e) { astAnalyzers = []; }

  astPaintUnfit();
  astPaintSummary();
  astPaintTab();
}

// ── Peringatan mutu: alat yang tak layak mengeluarkan hasil ───
function astPaintUnfit() {
  const box = document.getElementById('ast-unfit');
  if (!box) return;
  const unfit = astUnfitMaints();
  if (!unfit.length) { box.innerHTML = ''; return; }

  box.innerHTML = `
    <div style="background:#FEF2F2;border:1px solid #DC262655;border-left:5px solid #DC2626;
      border-radius:10px;padding:13px 16px;margin-bottom:14px">
      <div style="font-weight:800;color:#B91C1C;font-size:13.5px;margin-bottom:4px">
        ⛔ ${unfit.length} alat lewat jatuh tempo kalibrasi — tidak layak dipakai mengeluarkan hasil
      </div>
      <div style="font-size:12.5px;color:#7F1D1D;margin-bottom:8px">
        Hasil yang dikeluarkan alat di bawah ini tidak dapat dipertanggungjawabkan
        dan berpotensi menjadi temuan pada audit ISO 15189 / BAPETEN.
        Hentikan pemakaiannya sampai kalibrasi ulang selesai dan dinyatakan Lulus.
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${unfit.map(m => `<span style="background:#fff;border:1px solid #DC262655;border-radius:999px;
          padding:3px 10px;font-size:11.5px;color:#B91C1C;font-weight:650">
          ${astEsc(m.asset_name || 'Alat tanpa nama')} ·
          terlambat ${Math.abs(astDaysTo(m.due_date) || 0)} hari</span>`).join('')}
      </div>
    </div>`;
}

// ── Ringkasan atas ────────────────────────────────────────────
function astPaintSummary() {
  const el = document.getElementById('ast-summary');
  if (!el) return;

  const aktif      = astItems.filter(a => (a.status || 'Aktif') === 'Aktif');
  const perolehan  = aktif.reduce((s, a) => s + (+a.nilai_perolehan || 0), 0);
  const nilaiBuku  = aktif.reduce((s, a) => s + (+a.nilai_buku || 0), 0);
  const terlambat  = astOverdueMaints().length;
  const segera     = astOpenMaints().filter(m => astDueState(m.due_date).key === 'soon').length;

  const kartu = [
    { icon:'💰', val: astAssetsOk ? formatCurrency(perolehan) : '—',
      label:`Nilai Perolehan · ${aktif.length} aset aktif`, color:'#0E7C86' },
    { icon:'📉', val: astAssetsOk ? formatCurrency(nilaiBuku) : '—',
      label:'Nilai Buku Berjalan', color:'#7C3AED' },
    { icon:'⛔', val: astMaintOk ? String(terlambat) : '—',
      label:'Jadwal Terlambat', color: terlambat ? '#DC2626' : '#16A34A' },
    { icon:'⏳', val: astMaintOk ? String(segera) : '—',
      label:'Jatuh Tempo ≤ 30 Hari', color:'#B45309' },
  ];

  el.innerHTML = kartu.map(k => `
    <div class="kpi-card" style="border-top:3px solid ${k.color}">
      <div class="kpi-icon" style="background:${k.color}18">${k.icon}</div>
      <div>
        <div class="kpi-val" style="font-size:${String(k.val).length > 9 ? '15px' : '22px'}">${k.val}</div>
        <div class="kpi-label">${k.label}</div>
      </div>
    </div>`).join('');
}

function astPaintTab() {
  const el = document.getElementById('ast-content');
  if (!el) return;
  if (astTab === 'list')       astPaintList(el);
  else if (astTab === 'depr')  astPaintDepr(el);
  else                         astPaintMaint(el);
}

// ══════════════════════════════════════════════════════════════
// TAB 1 — DAFTAR ASET
// ══════════════════════════════════════════════════════════════
function astPaintList(el) {
  if (!astAssetsOk) { el.innerHTML = astMissingBox('supabase_assets.sql'); return; }

  const q    = astFilter.search.toLowerCase();
  const data = astItems.filter(a =>
    (!q || `${a.kode || ''} ${a.nama || ''} ${a.lokasi || ''} ${a.penanggung_jawab || ''}`
             .toLowerCase().includes(q)) &&
    (!astFilter.kategori || a.kategori === astFilter.kategori) &&
    (!astFilter.status   || (a.status || 'Aktif') === astFilter.status));

  // Alat lab yang kalibrasinya terlambat ikut ditandai di baris asetnya,
  // supaya orang yang membuka daftar aset melihat masalah mutu itu juga.
  const unfitByName = new Set(astUnfitMaints().map(m => (m.asset_name || '').toLowerCase()));
  const unfitByAnalyzer = new Set(astUnfitMaints().map(m => m.analyzer_id).filter(Boolean).map(String));

  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="ast-q" placeholder="🔍 Cari kode / nama / lokasi..."
          value="${astEsc(astFilter.search)}" oninput="astApplyFilter()">
        <select class="table-filter" id="ast-f-kat" onchange="astApplyFilter()">
          <option value="">Semua Kategori</option>
          ${AST_KATEGORI.map(c => `<option${astFilter.kategori === c ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
        <select class="table-filter" id="ast-f-status" onchange="astApplyFilter()">
          <option value="">Semua Status</option>
          ${AST_STATUS.map(s => `<option${astFilter.status === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      ${!data.length ? `<div class="empty-state"><div class="ico">🏛️</div>
        <h3>Belum ada aset tercatat</h3>
        <p>Tambahkan aset tetap agar penyusutannya bisa dihitung dan masuk ke pembukuan
           secara otomatis setiap bulan.</p></div>`
      : `<table><thead><tr>
          <th>Kode</th><th>Nama Aset</th><th>Kategori</th><th>Perolehan</th>
          <th style="text-align:right">Nilai Perolehan</th>
          <th style="text-align:right">Akum. Penyusutan</th>
          <th style="text-align:right">Nilai Buku</th>
          <th>Status</th><th></th>
        </tr></thead><tbody>${data.map(a => {
          const buku   = +a.nilai_buku || 0;
          const residu = +a.nilai_residu || 0;
          const habis  = buku <= residu + 0.01;
          const unfit  = unfitByName.has(String(a.nama || '').toLowerCase())
                      || (a.analyzer_id && unfitByAnalyzer.has(String(a.analyzer_id)));
          return `<tr>
            <td style="font-family:ui-monospace,monospace;font-size:11.5px;color:var(--teal)">${astEsc(a.kode) || '—'}</td>
            <td>
              <div style="font-weight:650">${astEsc(a.nama) || '—'}</div>
              <div style="font-size:11px;color:var(--gray)">
                ${astEsc(a.lokasi) || 'Tanpa lokasi'}${a.penanggung_jawab ? ' · ' + astEsc(a.penanggung_jawab) : ''}</div>
              ${unfit ? `<div style="font-size:11px;color:#B91C1C;font-weight:700;margin-top:2px">
                ⛔ kalibrasi terlambat — jangan dipakai mengeluarkan hasil</div>` : ''}
            </td>
            <td style="font-size:12px">${astEsc(a.kategori) || '—'}</td>
            <td style="font-size:11.5px;color:var(--gray)">${a.tanggal_perolehan ? formatDateShort(a.tanggal_perolehan) : '—'}
              <div style="font-size:10.5px">${a.masa_manfaat_bulan || 0} bulan</div></td>
            <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(a.nilai_perolehan)}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--gray)">${formatCurrency(a.akumulasi_penyusutan)}</td>
            <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${formatCurrency(buku)}
              ${habis ? '<div style="font-size:10.5px;color:var(--gray);font-weight:500">susut selesai</div>' : ''}</td>
            <td><span class="badge ${a.status === 'Aktif' ? 'badge-green'
                                    : a.status === 'Rusak' ? 'badge-red' : 'badge-gray'}">${astEsc(a.status) || 'Aktif'}</span></td>
            <td><div class="act-row">
              <button class="act-btn" onclick="astOpenAssetForm(${a.id})" title="Ubah">✏️</button>
              <button class="act-btn" onclick="astOpenMaintForm(null,${a.id})" title="Buat jadwal kalibrasi">🔧</button>
              <button class="act-btn del" onclick="astAskDeleteAsset(${a.id})" title="Hapus">🗑️</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody></table>`}
    </div>`;
}

function astApplyFilter() {
  astFilter.search   = document.getElementById('ast-q')?.value.trim() || '';
  astFilter.kategori = document.getElementById('ast-f-kat')?.value || '';
  astFilter.status   = document.getElementById('ast-f-status')?.value || '';
  const el = document.getElementById('ast-content');
  if (el) astPaintList(el);
  // Fokus dikembalikan agar mengetik di kotak cari tidak terputus.
  const q = document.getElementById('ast-q');
  if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

// ── Formulir aset ─────────────────────────────────────────────
async function astOpenAssetForm(id = null) {
  if (!astAssetsOk) { toast('Jalankan supabase_assets.sql dulu', 'warn'); return; }
  const a = id ? (astItems.find(x => x.id === id) || {}) : {};
  const hariIni = new Date().toISOString().slice(0, 10);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id ? '✏️ Ubah Aset' : '➕ Tambah Aset Tetap'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>

    <div class="form-row">
      <div class="form-group"><label>Kode Aset</label>
        <input type="text" id="ast-f-kode" value="${astEsc(a.kode || 'AST-' + Date.now().toString().slice(-6))}"></div>
      <div class="form-group"><label>Kategori</label>
        <select id="ast-f-kategori">
          ${AST_KATEGORI.map(c => `<option${a.kategori === c ? ' selected' : ''}>${c}</option>`).join('')}
        </select></div>
    </div>

    <div class="form-group"><label>Nama Aset *</label>
      <input type="text" id="ast-f-nama" value="${astEsc(a.nama || '')}"
        placeholder="Hematology Analyzer XN-550, Mobil Operasional, dll"></div>

    <div class="form-group"><label>Tautkan ke Alat Lab (opsional)</label>
      <select id="ast-f-analyzer">
        <option value="">— tidak tertaut —</option>
        ${astAnalyzers.map(an => `<option value="${an.id}"${String(a.analyzer_id) === String(an.id) ? ' selected' : ''}>
          ${astEsc(an.nama_alat)}${an.merk ? ' · ' + astEsc(an.merk) : ''}</option>`).join('')}
      </select>
      <div class="form-hint">Menautkan aset ke master alat lab memudahkan menelusuri
        riwayat kalibrasinya dari sisi keuangan maupun sisi mutu.</div></div>

    <div class="form-row">
      <div class="form-group"><label>Tanggal Perolehan *</label>
        <input type="date" id="ast-f-tanggal" value="${(a.tanggal_perolehan || hariIni).slice(0, 10)}"></div>
      <div class="form-group"><label>Nilai Perolehan (Rp) *</label>
        <input type="number" id="ast-f-nilai" min="0" step="1" value="${+a.nilai_perolehan || 0}"></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>Masa Manfaat (bulan)</label>
        <input type="number" id="ast-f-masa" min="1" step="1" value="${+a.masa_manfaat_bulan || 60}"></div>
      <div class="form-group"><label>Nilai Residu (Rp)</label>
        <input type="number" id="ast-f-residu" min="0" step="1" value="${+a.nilai_residu || 0}">
        <div class="form-hint">Nilai buku tidak akan turun di bawah angka ini.</div></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>Lokasi</label>
        <input type="text" id="ast-f-lokasi" value="${astEsc(a.lokasi || '')}" placeholder="Lab Utama, Ruang Radiologi"></div>
      <div class="form-group"><label>Penanggung Jawab</label>
        <input type="text" id="ast-f-pj" value="${astEsc(a.penanggung_jawab || '')}"></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>Status</label>
        <select id="ast-f-status2">
          ${AST_STATUS.map(s => `<option${(a.status || 'Aktif') === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
        <div class="form-hint">Hanya aset berstatus Aktif yang ikut disusutkan.</div></div>
      <div class="form-group"><label>Kode Unit Layanan (opsional)</label>
        <input type="text" id="ast-f-cc" value="${astEsc(a.cost_center || '')}" placeholder="LAB, RAD, HC">
        <div class="form-hint">Dipakai agar beban penyusutan masuk ke laba rugi unit yang tepat.</div></div>
    </div>

    <div class="form-group"><label>Catatan</label>
      <textarea id="ast-f-catatan" rows="2">${astEsc(a.catatan || '')}</textarea></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="astSaveAsset(${id || 'null'})">💾 Simpan</button>
    </div>`, 'wide');
}

async function astSaveAsset(id) {
  const nama = document.getElementById('ast-f-nama').value.trim();
  if (!nama) { toast('Nama aset wajib diisi', 'err'); return; }

  const nilai = parseFloat(document.getElementById('ast-f-nilai').value) || 0;
  const masa  = parseInt(document.getElementById('ast-f-masa').value, 10) || 0;
  const residu = parseFloat(document.getElementById('ast-f-residu').value) || 0;

  if (nilai <= 0)      { toast('Nilai perolehan harus lebih besar dari nol', 'err'); return; }
  if (masa  <= 0)      { toast('Masa manfaat minimal 1 bulan', 'err'); return; }
  if (residu >= nilai) { toast('Nilai residu harus lebih kecil dari nilai perolehan', 'err'); return; }

  const analyzerId = document.getElementById('ast-f-analyzer').value;
  const body = {
    kode:               document.getElementById('ast-f-kode').value.trim() || null,
    nama,
    kategori:           document.getElementById('ast-f-kategori').value,
    analyzer_id:        analyzerId ? parseInt(analyzerId, 10) : null,
    tanggal_perolehan:  document.getElementById('ast-f-tanggal').value || null,
    nilai_perolehan:    nilai,
    masa_manfaat_bulan: masa,
    nilai_residu:       residu,
    lokasi:             document.getElementById('ast-f-lokasi').value.trim() || null,
    penanggung_jawab:   document.getElementById('ast-f-pj').value.trim() || null,
    status:             document.getElementById('ast-f-status2').value,
    cost_center:        document.getElementById('ast-f-cc').value.trim() || null,
    catatan:            document.getElementById('ast-f-catatan').value.trim() || null,
    updated_at:         new Date().toISOString(),
  };

  try {
    if (id) {
      await sbPatch('fixed_assets', id, body);
      await logActivity('update', 'fixed_assets', id, `Aset diubah: ${nama}`, nama);
    } else {
      const r = await sbPost('fixed_assets', body);
      await logActivity('create', 'fixed_assets', r?.[0]?.id || '', `Aset baru: ${nama}`, nama);
    }
    toast('✅ Aset tersimpan', 'ok');
    closeModalForce();
    await astLoadAll();
  } catch (e) {
    toast('❌ ' + (/duplicate key|unique/i.test(e.message)
      ? 'Kode aset sudah dipakai aset lain' : e.message), 'err');
  }
}

function astAskDeleteAsset(id) {
  const a = astItems.find(x => x.id === id) || {};
  const sudahSusut = astDeprs.some(d => d.asset_id === id);
  openModal(`
    <div class="modal-header"><div class="modal-title">🗑️ Hapus Aset</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:13px;margin-bottom:10px">
      Hapus <b>${astEsc(a.nama)}</b> dari daftar aset tetap?</div>
    ${sudahSusut ? `<div class="status-box status-warn" style="margin-bottom:10px">
      Aset ini sudah pernah disusutkan dan jurnalnya sudah tercatat di pembukuan.
      Menghapusnya membuat daftar aset tidak lagi cocok dengan buku besar.
      Lebih aman mengubah statusnya menjadi <b>Dilepas</b> agar penyusutannya berhenti
      tanpa menghilangkan riwayat.</div>` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-danger" onclick="astDeleteAsset(${id})">Hapus</button>
    </div>`);
}

async function astDeleteAsset(id) {
  const a = astItems.find(x => x.id === id) || {};
  try {
    await sbDelete('fixed_assets', id);
    await logActivity('delete', 'fixed_assets', id, `Aset dihapus: ${a.nama || ''}`, a.nama || '');
    toast('Aset dihapus', 'ok');
    closeModalForce();
    await astLoadAll();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

// ══════════════════════════════════════════════════════════════
// TAB 2 — PENYUSUTAN
// ══════════════════════════════════════════════════════════════
function astPaintDepr(el) {
  if (!astAssetsOk) { el.innerHTML = astMissingBox('supabase_assets.sql'); return; }

  const rows      = astDeprs.filter(d => d.periode === astPeriod);
  const totalPer  = rows.reduce((s, d) => s + (+d.nilai_penyusutan || 0), 0);
  const sudahJalan = rows.length > 0;
  const namaAset  = id => astItems.find(a => a.id === id) || {};

  // Aset yang seharusnya ikut disusutkan tapi belum tercatat di periode ini.
  const belum = astItems.filter(a =>
    (a.status || 'Aktif') === 'Aktif' &&
    (+a.masa_manfaat_bulan || 0) > 0 &&
    (+a.nilai_perolehan || 0) > 0 &&
    (+a.nilai_buku || 0) > (+a.nilai_residu || 0) + 0.01 &&
    !rows.some(d => d.asset_id === a.id));

  el.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <input type="month" class="table-filter" id="ast-periode" value="${astPeriod}" onchange="astChangePeriod()">
      <button class="btn btn-teal btn-sm" onclick="astAskRunDepr()" ${astCanRunDepr() ? '' : 'disabled'}>
        ▶️ Jalankan Penyusutan</button>
      <span style="font-size:12.5px;color:var(--text3)">
        ${sudahJalan
          ? `<b style="color:#15803D">✓ Sudah dijalankan</b> · ${rows.length} aset · ${formatCurrency(totalPer)}`
          : 'Belum dijalankan untuk periode ini'}</span>
    </div>

    ${!astCanRunDepr() ? `<div class="status-box status-warn" style="margin-bottom:12px">
      Penyusutan menyentuh pembukuan, jadi hanya Finance, Direktur, dan Super Admin
      yang dapat menjalankannya. Anda tetap bisa melihat hasilnya.</div>` : ''}

    <div style="background:#F0F9FF;border:1px solid #0EA5E955;border-radius:8px;padding:11px 14px;
      margin-bottom:14px;font-size:12.5px;color:#075985">
      Metode garis lurus: <b>(nilai perolehan − nilai residu) ÷ masa manfaat</b>.
      Penyusutan berhenti sendiri ketika nilai buku menyentuh nilai residu.
      Menjalankan periode yang sama dua kali <b>tidak</b> menggandakan angkanya —
      aset yang sudah tercatat akan dilewati.
    </div>

    ${belum.length && !sudahJalan ? '' : belum.length ? `
      <div class="status-box status-warn" style="margin-bottom:12px">
        ${belum.length} aset belum tercatat pada periode ini
        (${belum.slice(0, 4).map(a => astEsc(a.nama)).join(', ')}${belum.length > 4 ? ', …' : ''}).
        Jalankan ulang penyusutan untuk melengkapinya — yang sudah tercatat tidak akan diulang.
      </div>` : ''}

    <div class="table-wrap">
      ${!rows.length ? `<div class="empty-state"><div class="ico">📉</div>
        <h3>Belum ada penyusutan pada ${astPeriod}</h3>
        <p>${belum.length
            ? `${belum.length} aset siap disusutkan. Tekan "Jalankan Penyusutan" untuk mencatatnya beserta jurnalnya.`
            : 'Tidak ada aset aktif yang masih perlu disusutkan pada periode ini.'}</p></div>`
      : `<table><thead><tr>
          <th>Kode</th><th>Nama Aset</th>
          <th style="text-align:right">Nilai Perolehan</th>
          <th style="text-align:right">Penyusutan Periode</th>
          <th style="text-align:right">Nilai Buku Setelahnya</th>
          <th>Jurnal</th>
        </tr></thead><tbody>${rows.map(d => {
          const a = namaAset(d.asset_id);
          return `<tr>
            <td style="font-family:ui-monospace,monospace;font-size:11.5px;color:var(--teal)">${astEsc(a.kode) || '—'}</td>
            <td>${astEsc(a.nama) || `Aset #${d.asset_id}`}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--gray)">${formatCurrency(a.nilai_perolehan)}</td>
            <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${formatCurrency(d.nilai_penyusutan)}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(d.nilai_buku_setelah)}</td>
            <td style="font-size:11.5px;color:var(--gray)">${d.journal_id ? '#' + d.journal_id : '—'}</td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--bg2);font-weight:800">
          <td colspan="3">TOTAL BEBAN PENYUSUTAN ${astPeriod}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(totalPer)}</td>
          <td colspan="2"></td>
        </tr></tbody></table>`}
    </div>`;
}

function astChangePeriod() {
  astPeriod = document.getElementById('ast-periode')?.value || astPeriod;
  const el = document.getElementById('ast-content');
  if (el) astPaintDepr(el);
}

function astAskRunDepr() {
  if (!astCanRunDepr()) { toast('Anda tidak berwenang menjalankan penyusutan', 'warn'); return; }
  const sudah = astDeprs.filter(d => d.periode === astPeriod);
  openModal(`
    <div class="modal-header"><div class="modal-title">▶️ Jalankan Penyusutan ${astPeriod}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:13px;color:var(--text3);margin-bottom:10px">
      Setiap aset aktif akan disusutkan satu bulan dengan metode garis lurus,
      dan tiap barisnya mencatat jurnal <b>Beban Penyusutan</b> pada
      <b>Akumulasi Penyusutan</b>. Jurnal tidak bisa dihapus, hanya bisa dibalik.
    </div>
    ${sudah.length ? `<div class="status-box status-warn" style="margin-bottom:10px">
      Periode ini sudah pernah dijalankan (${sudah.length} aset tercatat).
      Menjalankannya lagi aman: aset yang sudah punya penyusutan pada periode ini
      akan dilewati, sehingga tidak ada angka yang tercatat dua kali.
      Yang tercatat hanyalah aset baru yang belum sempat ikut.</div>` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="astRunDepr()">▶️ Jalankan</button>
    </div>`);
}

async function astRunDepr() {
  const periode = astPeriod;
  try {
    const r = await sbRpc('ast_run_depreciation', { p_period: periode });
    closeModalForce();
    const n = r?.jumlah_aset ?? 0, lewat = r?.dilewati ?? 0;
    toast(n
      ? `✅ ${n} aset disusutkan · ${formatCurrency(r?.total)}${lewat ? ` · ${lewat} dilewati` : ''}`
      : `Tidak ada yang perlu disusutkan${lewat ? ` — ${lewat} aset sudah tercatat` : ''}`,
      n ? 'ok' : 'info', 4000);
    await astLoadAll();
    astSwitchTab('depr', document.querySelector('#ast-tabs .tab-btn:nth-child(2)'));
  } catch (e) {
    const m = e.message || '';
    toast('❌ ' + (/not find the function|does not exist/i.test(m)
      ? 'Fungsi penyusutan belum ada — jalankan supabase_assets.sql'
      : /Pemetaan akun/i.test(m)
      ? 'Pemetaan akun "asset.depr" belum ada — jalankan supabase_fase4.sql'
      : m), 'err', 5000);
  }
}

// ══════════════════════════════════════════════════════════════
// TAB 3 — JADWAL KALIBRASI & PEMELIHARAAN
// ══════════════════════════════════════════════════════════════
function astPaintMaint(el) {
  if (!astMaintOk) { el.innerHTML = astMissingBox('supabase_fase2b.sql'); return; }

  const terbuka = astOpenMaints();
  const selesai = astMaints.filter(m => m.done_at)
                    .sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)))
                    .slice(0, 40);

  // Yang paling mendesak naik ke atas: terlambat dulu, lalu yang terdekat.
  const urut = [...terbuka].sort((a, b) =>
    (astDaysTo(a.due_date) ?? 99999) - (astDaysTo(b.due_date) ?? 99999));

  el.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <button class="btn btn-teal btn-sm" onclick="astOpenMaintForm()">🗓️ Jadwal Baru</button>
      <span style="font-size:12.5px;color:var(--text3)">
        ${urut.length} jadwal terbuka · ${astOverdueMaints().length} terlambat</span>
    </div>

    <div class="table-wrap" style="margin-bottom:18px">
      ${!urut.length ? `<div class="empty-state"><div class="ico">🔧</div>
        <h3>Tidak ada jadwal terbuka</h3>
        <p>Buat jadwal kalibrasi untuk tiap alat lab. Setelah satu jadwal
           dinyatakan Lulus, jadwal berikutnya terbit sendiri sesuai intervalnya.</p></div>`
      : `<table><thead><tr>
          <th>Alat / Aset</th><th>Jenis</th><th>Jatuh Tempo</th><th>Status</th>
          <th>Interval</th><th></th>
        </tr></thead><tbody>${urut.map(m => {
          const st = astDueState(m.due_date);
          const bahaya = st.key === 'late' && m.maint_type === 'Kalibrasi';
          return `<tr${bahaya ? ' style="background:#FEF2F2"' : ''}>
            <td>
              <div style="font-weight:650">${astEsc(m.asset_name) || 'Tanpa nama'}</div>
              ${bahaya ? `<div style="font-size:11px;color:#B91C1C;font-weight:800;margin-top:2px">
                ⛔ TIDAK LAYAK MENGELUARKAN HASIL</div>` : ''}
            </td>
            <td><span class="badge ${m.maint_type === 'Kalibrasi' ? 'badge-teal'
                                    : m.maint_type === 'Perbaikan' ? 'badge-rose' : 'badge-navy'}">${astEsc(m.maint_type) || '—'}</span></td>
            <td style="font-size:12px">${m.due_date ? formatDateShort(m.due_date) : '—'}</td>
            <td><span class="badge ${st.badge}">${st.label}</span></td>
            <td style="font-size:11.5px;color:var(--gray)">${m.interval_days || 0} hari</td>
            <td><div class="act-row">
              <button class="act-btn" onclick="astOpenCompleteForm(${m.id})" title="Tandai selesai">✅</button>
              <button class="act-btn" onclick="astOpenMaintForm(${m.id})" title="Ubah">✏️</button>
              <button class="act-btn del" onclick="astAskDeleteMaint(${m.id})" title="Hapus">🗑️</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody></table>`}
    </div>

    <div style="font-size:12px;font-weight:800;color:var(--gray);text-transform:uppercase;
      letter-spacing:.08em;margin-bottom:8px">Riwayat Terakhir</div>
    <div class="table-wrap">
      ${!selesai.length ? `<div class="empty-state" style="padding:26px"><div class="ico">📜</div>
        <h3>Belum ada riwayat</h3></div>`
      : `<table><thead><tr>
          <th>Alat / Aset</th><th>Jenis</th><th>Dikerjakan</th><th>Hasil</th>
          <th>No. Sertifikat</th><th style="text-align:right">Biaya</th><th>Oleh</th>
        </tr></thead><tbody>${selesai.map(m => `<tr>
          <td style="font-weight:600">${astEsc(m.asset_name) || '—'}</td>
          <td style="font-size:11.5px;color:var(--gray)">${astEsc(m.maint_type) || '—'}</td>
          <td style="font-size:11.5px">${formatDateShort(m.done_at)}</td>
          <td><span class="badge ${m.result === 'Lulus' ? 'badge-green'
                                  : m.result === 'Tidak Lulus' ? 'badge-red' : 'badge-gold'}">${astEsc(m.result) || '—'}</span></td>
          <td style="font-family:ui-monospace,monospace;font-size:11px">${astEsc(m.certificate_no) || '—'}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(m.cost)}</td>
          <td style="font-size:11.5px;color:var(--gray)">${astEsc(m.performed_by) || '—'}</td>
        </tr>`).join('')}</tbody></table>`}
    </div>`;
}

// Jadwal bisa ditautkan ke master alat lab ATAU ke aset tetap.
// asset_maintenance hanya punya analyzer_id + asset_name, jadi aset tetap
// yang bukan alat lab dicatat lewat namanya.
async function astOpenMaintForm(id = null, presetAssetId = null) {
  if (!astMaintOk) { toast('Tabel jadwal belum ada — jalankan supabase_fase2b.sql', 'warn'); return; }
  const m = id ? (astMaints.find(x => x.id === id) || {}) : {};
  const presetAset = presetAssetId ? astItems.find(a => a.id === presetAssetId) : null;
  const namaAwal = m.asset_name || presetAset?.nama || '';
  const analyzerAwal = m.analyzer_id ?? presetAset?.analyzer_id ?? '';
  const dueAwal = (m.due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)).slice(0, 10);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id ? '✏️ Ubah Jadwal' : '🗓️ Jadwal Kalibrasi / Pemeliharaan Baru'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>

    <div class="form-group"><label>Alat Lab (opsional)</label>
      <select id="ast-m-analyzer" onchange="astMaintPickAnalyzer()">
        <option value="">— pilih dari master alat lab —</option>
        ${astAnalyzers.map(an => `<option value="${an.id}" data-nama="${astEsc(an.nama_alat)}"
          ${String(analyzerAwal) === String(an.id) ? ' selected' : ''}>
          ${astEsc(an.nama_alat)}${an.lokasi ? ' · ' + astEsc(an.lokasi) : ''}</option>`).join('')}
      </select></div>

    <div class="form-group"><label>Atau pilih dari Aset Tetap</label>
      <select id="ast-m-asset" onchange="astMaintPickAsset()">
        <option value="">— pilih aset tetap —</option>
        ${astItems.map(a => `<option value="${a.id}" data-nama="${astEsc(a.nama)}"
          data-analyzer="${a.analyzer_id || ''}"${presetAssetId === a.id ? ' selected' : ''}>
          ${astEsc(a.kode) ? astEsc(a.kode) + ' · ' : ''}${astEsc(a.nama)}</option>`).join('')}
      </select></div>

    <div class="form-group"><label>Nama Alat / Aset *</label>
      <input type="text" id="ast-m-nama" value="${astEsc(namaAwal)}"
        placeholder="Terisi otomatis saat memilih di atas, boleh diketik sendiri">
      <div class="form-hint">Nama inilah yang muncul di daftar jadwal dan di sertifikat.</div></div>

    <div class="form-row">
      <div class="form-group"><label>Jenis *</label>
        <select id="ast-m-tipe">
          ${AST_MAINT_TYPES.map(t => `<option${(m.maint_type || 'Kalibrasi') === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Interval (hari)</label>
        <input type="number" id="ast-m-interval" min="0" step="1" value="${m.interval_days ?? 365}">
        <div class="form-hint">Jadwal berikutnya terbit otomatis sejauh ini setelah hasil Lulus.
          Isi 0 bila sekali saja.</div></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>Jatuh Tempo *</label>
        <input type="date" id="ast-m-due" value="${dueAwal}"></div>
      <div class="form-group"><label>Vendor / Pelaksana</label>
        <input type="text" id="ast-m-vendor" value="${astEsc(m.vendor || '')}" placeholder="Nama lembaga kalibrasi"></div>
    </div>

    <div class="form-group"><label>Catatan</label>
      <textarea id="ast-m-notes" rows="2">${astEsc(m.notes || '')}</textarea></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="astSaveMaint(${id || 'null'})">💾 Simpan Jadwal</button>
    </div>`, 'wide');
}

// Memilih alat lab mengisi nama sekaligus mengosongkan pilihan aset tetap,
// agar tidak ada dua sumber nama yang saling bertengkar.
function astMaintPickAnalyzer() {
  const sel = document.getElementById('ast-m-analyzer');
  const opt = sel?.selectedOptions?.[0];
  if (!opt || !sel.value) return;
  document.getElementById('ast-m-nama').value = opt.getAttribute('data-nama') || '';
  const aset = document.getElementById('ast-m-asset');
  if (aset) aset.value = '';
}

function astMaintPickAsset() {
  const sel = document.getElementById('ast-m-asset');
  const opt = sel?.selectedOptions?.[0];
  if (!opt || !sel.value) return;
  document.getElementById('ast-m-nama').value = opt.getAttribute('data-nama') || '';
  // Bila aset tetap itu memang tertaut ke alat lab, tautannya ikut terbawa.
  const an = opt.getAttribute('data-analyzer');
  const selAn = document.getElementById('ast-m-analyzer');
  if (selAn) selAn.value = an || '';
}

async function astSaveMaint(id) {
  const nama = document.getElementById('ast-m-nama').value.trim();
  const due  = document.getElementById('ast-m-due').value;
  if (!nama) { toast('Nama alat/aset wajib diisi', 'err'); return; }
  if (!due)  { toast('Tanggal jatuh tempo wajib diisi', 'err'); return; }

  const anId = document.getElementById('ast-m-analyzer').value;
  const body = {
    analyzer_id:   anId ? parseInt(anId, 10) : null,
    asset_name:    nama,
    maint_type:    document.getElementById('ast-m-tipe').value,
    interval_days: parseInt(document.getElementById('ast-m-interval').value, 10) || 0,
    due_date:      due,
    vendor:        document.getElementById('ast-m-vendor').value.trim() || null,
    notes:         document.getElementById('ast-m-notes').value.trim() || null,
    updated_at:    new Date().toISOString(),
  };

  try {
    if (id) {
      await sbPatch('asset_maintenance', id, body);
      await logActivity('update', 'asset_maintenance', id, `Jadwal diubah: ${nama}`, nama);
    } else {
      const r = await sbPost('asset_maintenance', body);
      await logActivity('create', 'asset_maintenance', r?.[0]?.id || '',
        `Jadwal ${body.maint_type} baru: ${nama} (jatuh tempo ${due})`, nama);
    }
    toast('✅ Jadwal tersimpan', 'ok');
    closeModalForce();
    await astLoadAll();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

function astAskDeleteMaint(id) {
  const m = astMaints.find(x => x.id === id) || {};
  openModal(`
    <div class="modal-header"><div class="modal-title">🗑️ Hapus Jadwal</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:13px;margin-bottom:10px">
      Hapus jadwal ${astEsc(m.maint_type)} untuk <b>${astEsc(m.asset_name)}</b>?
    </div>
    <div class="status-box status-warn" style="margin-bottom:10px">
      Jadwal yang sudah terlanjur dikerjakan sebaiknya diselesaikan lewat tombol ✅,
      bukan dihapus — riwayat kalibrasi adalah bukti yang dicari saat audit.
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-danger" onclick="astDeleteMaint(${id})">Hapus</button>
    </div>`);
}

async function astDeleteMaint(id) {
  const m = astMaints.find(x => x.id === id) || {};
  try {
    await sbDelete('asset_maintenance', id);
    await logActivity('delete', 'asset_maintenance', id,
      `Jadwal dihapus: ${m.asset_name || ''}`, m.asset_name || '');
    toast('Jadwal dihapus', 'ok');
    closeModalForce();
    await astLoadAll();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

// ── Menyelesaikan jadwal lewat RPC complete_maintenance ───────
function astOpenCompleteForm(id) {
  const m = astMaints.find(x => x.id === id);
  if (!m) return;
  const st = astDueState(m.due_date);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">✅ Selesaikan ${astEsc(m.maint_type)}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>

    <div style="font-size:13px;margin-bottom:4px"><b>${astEsc(m.asset_name)}</b></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
      Jatuh tempo ${m.due_date ? formatDateShort(m.due_date) : '—'} ·
      <span class="badge ${st.badge}">${st.label}</span>
      ${m.vendor ? ' · ' + astEsc(m.vendor) : ''}
    </div>

    <div class="form-group"><label>Hasil *</label>
      <select id="ast-c-result" onchange="astCompleteHint()">
        ${AST_RESULTS.map(r => `<option>${r}</option>`).join('')}
      </select>
      <div class="form-hint" id="ast-c-hint"></div></div>

    <div class="form-row">
      <div class="form-group"><label>Nomor Sertifikat</label>
        <input type="text" id="ast-c-cert" placeholder="No. sertifikat kalibrasi"></div>
      <div class="form-group"><label>Biaya (Rp)</label>
        <input type="number" id="ast-c-cost" min="0" step="1" value="${+m.cost || 0}"></div>
    </div>

    <div class="form-group"><label>Catatan</label>
      <textarea id="ast-c-notes" rows="2" placeholder="Temuan, penyimpangan, atau tindak lanjut">${astEsc(m.notes || '')}</textarea></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="astDoComplete(${id})">✅ Simpan Hasil</button>
    </div>`, 'wide');
  astCompleteHint();
}

// Menjelaskan konsekuensi tiap pilihan sebelum orang menekan simpan.
function astCompleteHint() {
  const v  = document.getElementById('ast-c-result')?.value;
  const el = document.getElementById('ast-c-hint');
  if (!el) return;
  if (v === 'Lulus') {
    el.innerHTML = 'Alat dinyatakan layak. Jadwal berikutnya akan terbit otomatis sesuai intervalnya.';
    el.style.color = '#15803D';
  } else {
    el.innerHTML = 'Jadwal berikutnya <b>tidak</b> diterbitkan. Alat tetap dianggap belum layak '
                 + 'mengeluarkan hasil sampai ada kalibrasi ulang yang Lulus.';
    el.style.color = '#B91C1C';
  }
}

async function astDoComplete(id) {
  const result = document.getElementById('ast-c-result').value;
  const cert   = document.getElementById('ast-c-cert').value.trim();
  const cost   = parseFloat(document.getElementById('ast-c-cost').value) || 0;
  const notes  = document.getElementById('ast-c-notes').value.trim();

  if (result === 'Lulus' && !cert) {
    toast('Nomor sertifikat wajib diisi untuk hasil Lulus — itu buktinya saat audit', 'err', 4000);
    return;
  }

  try {
    const r = await sbRpc('complete_maintenance', {
      p_id: id, p_result: result, p_cert: cert || null, p_cost: cost, p_notes: notes || null,
    });
    closeModalForce();
    toast(r?.next_due
      ? `✅ Tercatat · jadwal berikutnya ${formatDateShort(r.next_due)}`
      : `✅ Tercatat sebagai "${result}"`, 'ok', 4000);
    await astLoadAll();
  } catch (e) {
    const m = e.message || '';
    toast('❌ ' + (/not find the function|does not exist/i.test(m)
      ? 'Fungsi complete_maintenance belum ada — jalankan supabase_fase2b.sql' : m), 'err', 5000);
  }
}
