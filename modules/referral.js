// ═══════════════════════════════════════════════════════════════
// MODULE: Rujukan Lab Luar (Fase 5) — kirim, lacak, terima, margin
//
// Tabel referral_labs & referred_tests sudah lama ada di basis data, tetapi
// belum pernah punya layar. Akibatnya pemeriksaan yang dirujuk ke laboratorium
// rekanan tidak terlacak sama sekali: tidak diketahui mana yang sudah dikirim,
// mana yang hasilnya belum kembali, dan berapa selisih harga terhadap biaya.
//
// Inti nilai modul ini adalah kolom "terlambat" — perkiraan tanggal hasil sudah
// lewat tetapi hasil belum masuk. Pemeriksaan yang menganggur di lab rekanan
// harus terlihat, bukan tenggelam di daftar.
//
// Seluruh nama global diawali "ref" untuk mencegah tabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

const REF_STATUS = {
  'Dikirim':    { c: '#B45309', bg: '#FBF1E4' },
  'Diterima':   { c: '#15803D', bg: '#E8F5EC' },
  'Dibatalkan': { c: '#B91C1C', bg: '#FBEAEA' },
};

let refLabs = [];          // master lab rekanan
let refTests = [];         // pemeriksaan yang dirujuk
let refProducts = [];      // katalog pemeriksaan (untuk form kirim)
let refTab = 'lacak';      // lacak | mitra | margin
let refPeriod = '';        // 'YYYY-MM' — periode untuk ringkasan & margin
let refReady = true;       // false bila tabel belum dibuat di basis data
let refPickedAdm = null;   // pasien terpilih pada form kirim
let _refPatTimer = null;

// ══════════════════════════════════════════════════════════════
// HALAMAN UTAMA
// ══════════════════════════════════════════════════════════════
async function renderReferral() {
  if (!refPeriod) refPeriod = new Date().toISOString().slice(0, 7);

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Rujukan Lab Luar</h1>
        <p>Pemeriksaan yang dikerjakan laboratorium rekanan — pengiriman, hasil, dan margin</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="refOpenLabForm()">+ Lab Rekanan</button>
        <button class="btn btn-teal" onclick="refOpenSendForm()">📤 Kirim Pemeriksaan</button>
      </div>
    </div>

    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
      <label style="font-size:12px;color:var(--gray)">Periode</label>
      <input type="month" id="ref-period" value="${refPeriod}" onchange="refSetPeriod(this.value)"
        style="padding:6px 9px;border:1px solid var(--border);border-radius:7px;font-size:12.5px">
      <span style="font-size:11.5px;color:var(--gray)">
        Ringkasan dan margin mengikuti periode ini. Daftar keterlambatan selalu menampilkan
        seluruh pemeriksaan yang hasilnya belum kembali, termasuk dari periode sebelumnya.
      </span>
    </div>

    <div id="ref-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));
      gap:10px;margin-bottom:16px"></div>

    <div class="tabs" id="ref-tabs" style="margin-bottom:14px">
      <button class="tab-btn ${refTab === 'lacak' ? 'active' : ''}"  onclick="refSetTab('lacak',this)">Pelacakan</button>
      <button class="tab-btn ${refTab === 'mitra' ? 'active' : ''}"  onclick="refSetTab('mitra',this)">Lab Rekanan</button>
      <button class="tab-btn ${refTab === 'margin' ? 'active' : ''}" onclick="refSetTab('margin',this)">Margin</button>
    </div>

    <div id="ref-content"><div class="loading-row"><div class="spinner"></div></div></div>`;

  await refLoadAll();
}

// ── Muat data ──────────────────────────────────────────────────
// Kedua tabel dimuat terpisah supaya pesan "tabel belum ada" bisa tampil utuh
// alih-alih error mentah dari PostgREST.
async function refLoadAll() {
  refReady = true;
  try {
    const [labs, tests] = await Promise.all([
      sbGet('referral_labs', 'select=*&order=is_active.desc,name.asc'),
      sbGet('referred_tests', 'select=*&order=sent_at.desc&limit=1000'),
    ]);
    refLabs = Array.isArray(labs) ? labs : [];
    refTests = Array.isArray(tests) ? tests : [];
  } catch (e) {
    refReady = false;
    const el = document.getElementById('ref-content');
    if (el) el.innerHTML = `<div class="status-box status-warn">
      Tabel rujukan lab luar belum ada — jalankan <code>supabase_fase5_lis.sql</code>
      di Supabase SQL Editor, lalu muat ulang halaman ini.
      <div style="font-size:11.5px;color:var(--gray);margin-top:6px">Rincian: ${refEsc(e.message || '')}</div>
    </div>`;
    const kpi = document.getElementById('ref-kpi');
    if (kpi) kpi.innerHTML = '';
    return;
  }
  refPaint();
}

function refSetPeriod(v) {
  refPeriod = v || new Date().toISOString().slice(0, 7);
  refPaint();
}

function refSetTab(tab, btn) {
  refTab = tab;
  document.querySelectorAll('#ref-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  refPaint();
}

// ══════════════════════════════════════════════════════════════
// HELPER
// ══════════════════════════════════════════════════════════════
function refEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function refNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

// Terlambat = masih berstatus Dikirim, punya perkiraan tanggal, dan tanggalnya
// sudah lewat hari ini. Hasil yang sudah diterima tidak pernah dihitung terlambat.
function refIsLate(t) {
  if (!t || t.status !== 'Dikirim' || !t.expected_at) return false;
  return String(t.expected_at).slice(0, 10) < new Date().toISOString().slice(0, 10);
}

function refLateDays(t) {
  if (!refIsLate(t)) return 0;
  const exp = new Date(String(t.expected_at).slice(0, 10) + 'T00:00:00');
  const now = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  return Math.max(0, Math.round((now - exp) / 86400000));
}

// Pemeriksaan dianggap masuk periode berdasarkan tanggal kirim.
function refInPeriod(t) {
  return t && t.sent_at && String(t.sent_at).slice(0, 7) === refPeriod;
}

// Margin selalu price − cost, sesuai kolom yang ada. Tidak ditebak dari sumber lain.
function refMargin(t) { return refNum(t.price) - refNum(t.cost); }

function refRugi(t) { return t.status !== 'Dibatalkan' && refMargin(t) < 0; }

function refStatusBadge(t) {
  const st = REF_STATUS[t.status] || REF_STATUS['Dikirim'];
  return `<span style="background:${st.bg};color:${st.c};padding:3px 9px;border-radius:5px;
    font-size:11px;font-weight:700">${refEsc(t.status || 'Dikirim')}</span>`;
}

function refLabName(id) {
  const l = refLabs.find(x => String(x.id) === String(id));
  return l ? l.name : '';
}

function refPeriodLabel() {
  if (!refPeriod) return '—';
  const d = new Date(refPeriod + '-01T00:00:00');
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

// ══════════════════════════════════════════════════════════════
// RINGKASAN + PENGGAMBARAN
// ══════════════════════════════════════════════════════════════
function refPaint() {
  if (!refReady) return;
  refPaintKpi();
  const el = document.getElementById('ref-content');
  if (!el) return;
  if (refTab === 'mitra')       el.innerHTML = refViewLabs();
  else if (refTab === 'margin') el.innerHTML = refViewMargin();
  else                          el.innerHTML = refViewTracking();
}

function refPaintKpi() {
  const kpi = document.getElementById('ref-kpi');
  if (!kpi) return;

  const periode = refTests.filter(refInPeriod);
  const terkirim = periode.filter(t => t.status !== 'Dibatalkan').length;
  // Menunggu & terlambat dihitung lintas periode: pekerjaan yang menggantung
  // tidak boleh hilang dari pandangan hanya karena bulannya berganti.
  const menunggu = refTests.filter(t => t.status === 'Dikirim').length;
  const telat    = refTests.filter(refIsLate).length;
  const margin   = periode.filter(t => t.status !== 'Dibatalkan')
                          .reduce((s, t) => s + refMargin(t), 0);

  const cards = [
    { l: `Terkirim · ${refPeriodLabel()}`, v: terkirim, c: '#123A5C' },
    { l: 'Menunggu hasil', v: menunggu, c: '#B45309' },
    { l: 'Terlambat', v: telat, c: telat > 0 ? '#B91C1C' : '#94A3B8' },
    { l: `Margin · ${refPeriodLabel()}`, v: formatCurrency(margin), c: margin < 0 ? '#B91C1C' : '#15803D', small: true },
  ];

  kpi.innerHTML = cards.map(k => `
    <div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${k.c};
      border-radius:10px;padding:12px">
      <div style="font-size:${k.small ? '15px' : '20px'};font-weight:800;color:${k.c};
        font-variant-numeric:tabular-nums">${k.v}</div>
      <div style="font-size:10.5px;color:var(--gray)">${k.l}</div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// TAB 1 — PELACAKAN
// ══════════════════════════════════════════════════════════════
function refViewTracking() {
  if (!refTests.length) {
    return `<div class="empty-state"><div class="ico">📤</div>
      <h3>Belum ada pemeriksaan yang dirujuk</h3>
      <p>Kirim pemeriksaan yang tidak dikerjakan sendiri ke laboratorium rekanan
         agar statusnya terlacak.</p>
      <button class="btn btn-teal" style="margin-top:10px" onclick="refOpenSendForm()">📤 Kirim Pemeriksaan</button>
    </div>`;
  }

  // Terlambat diangkat ke atas daftar — ini yang paling perlu ditindak.
  const telat  = refTests.filter(refIsLate);
  const tunggu = refTests.filter(t => t.status === 'Dikirim' && !refIsLate(t));
  const selesai = refTests.filter(t => t.status !== 'Dikirim');
  const urut = [...telat, ...tunggu, ...selesai];

  const banner = telat.length ? `
    <div class="status-box status-err" style="margin-bottom:12px">
      <strong>${telat.length} pemeriksaan terlambat.</strong>
      Perkiraan tanggal hasil sudah lewat tetapi hasil belum masuk — perlu ditagih ke lab rekanan.
    </div>` : '';

  return banner + `<div class="table-wrap"><table><thead><tr>
      <th>Pasien</th><th>Pemeriksaan</th><th>Lab Rekanan</th>
      <th>Dikirim</th><th>Perkiraan</th><th>Status</th>
      <th style="text-align:right">Biaya</th><th style="text-align:right">Harga</th>
      <th style="text-align:right">Margin</th><th>Aksi</th>
    </tr></thead><tbody>
    ${urut.map(t => {
      const late = refIsLate(t);
      const m = refMargin(t);
      return `<tr style="${late ? 'background:#FEF6F6' : ''}">
        <td>
          <div style="font-weight:650">${refEsc(t.patient_name || '—')}</div>
          ${late ? `<div style="font-size:10.5px;color:#B91C1C;font-weight:700">
            ⚠️ Terlambat ${refLateDays(t)} hari</div>` : ''}
        </td>
        <td style="font-size:12.5px">${refEsc(t.product_name || '—')}</td>
        <td style="font-size:12.5px">${refEsc(t.lab_name || refLabName(t.referral_lab_id) || '—')}</td>
        <td style="font-size:11.5px;color:var(--gray)">${t.sent_at ? formatDateShort(t.sent_at) : '—'}</td>
        <td style="font-size:11.5px;${late ? 'color:#B91C1C;font-weight:700' : 'color:var(--gray)'}">
          ${t.expected_at ? formatDateShort(t.expected_at) : '—'}</td>
        <td>${refStatusBadge(t)}
          ${t.result_at ? `<div style="font-size:10.5px;color:var(--gray);margin-top:2px">
            ${formatDateShort(t.result_at)}</div>` : ''}</td>
        <td style="text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${formatCurrency(refNum(t.cost))}</td>
        <td style="text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${formatCurrency(refNum(t.price))}</td>
        <td style="text-align:right;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;
          color:${m < 0 ? '#B91C1C' : '#15803D'}">
          ${formatCurrency(m)}${refRugi(t) ? ' ⚠️' : ''}</td>
        <td><div class="act-row">
          ${t.status === 'Dikirim' ? `
            <button class="btn btn-teal btn-xs" onclick="refOpenReceiveForm(${t.id})">📥 Terima Hasil</button>
            <button class="btn btn-ghost btn-xs" style="color:#B91C1C" onclick="refCancelTest(${t.id})">Batalkan</button>` : ''}
          ${t.status === 'Diterima' ? `
            <button class="btn btn-ghost btn-xs" onclick="refOpenResultView(${t.id})">Lihat Hasil</button>` : ''}
        </div></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

// ══════════════════════════════════════════════════════════════
// TAB 2 — MASTER LAB REKANAN
// ══════════════════════════════════════════════════════════════
function refViewLabs() {
  if (!refLabs.length) {
    return `<div class="empty-state"><div class="ico">🏥</div>
      <h3>Belum ada lab rekanan</h3>
      <p>Daftarkan laboratorium rekanan lebih dulu sebelum mengirim pemeriksaan.</p>
      <button class="btn btn-teal" style="margin-top:10px" onclick="refOpenLabForm()">+ Lab Rekanan</button>
    </div>`;
  }

  return `<div class="table-wrap"><table><thead><tr>
      <th>Nama Lab</th><th>Kontak</th><th>Telepon</th><th>Alamat</th>
      <th style="text-align:center">Dirujuk</th><th>Status</th><th>Aksi</th>
    </tr></thead><tbody>
    ${refLabs.map(l => {
      const jml = refTests.filter(t => String(t.referral_lab_id) === String(l.id) && t.status !== 'Dibatalkan').length;
      return `<tr style="${l.is_active === false ? 'opacity:.6' : ''}">
        <td>
          <div style="font-weight:650">${refEsc(l.name || '—')}</div>
          ${l.notes ? `<div style="font-size:10.5px;color:var(--gray)">${refEsc(l.notes)}</div>` : ''}
        </td>
        <td style="font-size:12.5px">${refEsc(l.contact_name || '—')}</td>
        <td style="font-size:12.5px">${refEsc(l.phone || '—')}</td>
        <td style="font-size:11.5px;color:var(--gray)">${refEsc(l.address || '—')}</td>
        <td style="text-align:center;font-variant-numeric:tabular-nums">${jml}</td>
        <td><span class="badge ${l.is_active === false ? 'badge-gray' : 'badge-green'}">
          ${l.is_active === false ? 'Nonaktif' : 'Aktif'}</span></td>
        <td><div class="act-row">
          <button class="btn btn-ghost btn-xs" onclick="refOpenLabForm(${l.id})">Ubah</button>
          <button class="btn btn-ghost btn-xs" onclick="refToggleLab(${l.id})">
            ${l.is_active === false ? 'Aktifkan' : 'Nonaktifkan'}</button>
        </div></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

function refOpenLabForm(id) {
  const l = id ? (refLabs.find(x => String(x.id) === String(id)) || {}) : {};
  openModal(`
    <div class="modal-header">
      <div class="modal-title">🏥 ${id ? 'Ubah' : 'Tambah'} Lab Rekanan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group"><label>Nama Laboratorium *</label>
      <input type="text" id="ref-lf-name" value="${refEsc(l.name || '')}" placeholder="Nama lab rekanan"></div>
    <div class="form-row">
      <div class="form-group"><label>Nama Kontak</label>
        <input type="text" id="ref-lf-contact" value="${refEsc(l.contact_name || '')}" placeholder="Penanggung jawab"></div>
      <div class="form-group"><label>Telepon</label>
        <input type="text" id="ref-lf-phone" value="${refEsc(l.phone || '')}" placeholder="08xx"></div>
    </div>
    <div class="form-group"><label>Alamat</label>
      <textarea id="ref-lf-addr" rows="2" placeholder="Alamat lengkap">${refEsc(l.address || '')}</textarea></div>
    <div class="form-group"><label>Catatan</label>
      <textarea id="ref-lf-notes" rows="2" placeholder="Kesepakatan harga, jadwal kurir, dll">${refEsc(l.notes || '')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="refSaveLab(${id || 0})">💾 Simpan</button>
    </div>`);
}

async function refSaveLab(id) {
  const name = (document.getElementById('ref-lf-name')?.value || '').trim();
  if (!name) { toast('Nama laboratorium wajib diisi', 'err'); return; }

  const payload = {
    name,
    contact_name: (document.getElementById('ref-lf-contact')?.value || '').trim() || null,
    phone:        (document.getElementById('ref-lf-phone')?.value || '').trim() || null,
    address:      (document.getElementById('ref-lf-addr')?.value || '').trim() || null,
    notes:        (document.getElementById('ref-lf-notes')?.value || '').trim() || null,
    updated_at:   new Date().toISOString(),
  };

  try {
    if (id) {
      await sbPatch('referral_labs', id, payload);
      await logActivity('update', 'referral_labs', id, `Lab rekanan diubah: ${name}`, name);
    } else {
      payload.is_active = true;
      const res = await sbPost('referral_labs', payload);
      await logActivity('create', 'referral_labs', res?.[0]?.id || 0, `Lab rekanan ditambah: ${name}`, name);
    }
    toast('✅ Lab rekanan tersimpan', 'ok');
    closeModalForce();
    await refLoadAll();
  } catch (e) {
    toast('❌ ' + (e.message || 'Gagal menyimpan'), 'err');
  }
}

async function refToggleLab(id) {
  const l = refLabs.find(x => String(x.id) === String(id));
  if (!l) return;
  const aktif = !(l.is_active === false);
  try {
    await sbPatch('referral_labs', id, { is_active: !aktif, updated_at: new Date().toISOString() });
    await logActivity('update', 'referral_labs', id,
      `Lab rekanan ${aktif ? 'dinonaktifkan' : 'diaktifkan'}: ${l.name}`, l.name);
    toast(aktif ? 'Lab dinonaktifkan' : 'Lab diaktifkan', 'ok');
    await refLoadAll();
  } catch (e) {
    toast('❌ ' + (e.message || 'Gagal mengubah status'), 'err');
  }
}

// ══════════════════════════════════════════════════════════════
// KIRIM PEMERIKSAAN
// ══════════════════════════════════════════════════════════════
async function refOpenSendForm() {
  const aktif = refLabs.filter(l => l.is_active !== false);
  if (!aktif.length) {
    toast('Belum ada lab rekanan aktif — daftarkan dulu', 'warn');
    refOpenLabForm();
    return;
  }

  if (!refProducts.length) {
    try {
      refProducts = await sbGet('products',
        'select=id,nama_tes,kode_internal,harga_normal&is_active=eq.true&order=nama_tes.asc') || [];
    } catch (e) { refProducts = []; }
  }

  refPickedAdm = null;
  const besok = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📤 Kirim Pemeriksaan ke Lab Rekanan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-group" style="position:relative">
      <label>Pasien *</label>
      <input type="text" id="ref-sf-search" placeholder="Ketik minimal 3 huruf nama pasien…"
        oninput="refSearchPatient(this.value)" autocomplete="off">
      <div id="ref-sf-results"></div>
      <div id="ref-sf-hint" class="form-hint">Cari pasien dari daftar kunjungan yang sudah terdaftar.</div>
    </div>

    <div class="form-row">
      <div class="form-group"><label>Pemeriksaan *</label>
        <select id="ref-sf-product" onchange="refPickProduct()">
          <option value="">— pilih pemeriksaan —</option>
          ${refProducts.map(p => `<option value="${p.id}"
            data-name="${refEsc(p.nama_tes || '')}" data-harga="${refNum(p.harga_normal)}">
            ${refEsc(p.nama_tes || '')}${p.kode_internal ? ' · ' + refEsc(p.kode_internal) : ''}
          </option>`).join('')}
        </select>
        ${refProducts.length ? '' : '<div class="form-hint">Katalog pemeriksaan kosong atau gagal dimuat.</div>'}
      </div>
      <div class="form-group"><label>Lab Rekanan *</label>
        <select id="ref-sf-lab">
          <option value="">— pilih lab —</option>
          ${aktif.map(l => `<option value="${l.id}" data-name="${refEsc(l.name || '')}">${refEsc(l.name || '')}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row-3">
      <div class="form-group"><label>Biaya ke Lab (Rp) *</label>
        <input type="number" id="ref-sf-cost" min="0" step="1000" value="0" oninput="refPreviewMargin()">
        <div class="form-hint">Yang kita bayar ke lab rekanan.</div></div>
      <div class="form-group"><label>Harga ke Pasien (Rp) *</label>
        <input type="number" id="ref-sf-price" min="0" step="1000" value="0" oninput="refPreviewMargin()">
        <div class="form-hint">Terisi otomatis dari harga normal.</div></div>
      <div class="form-group"><label>Perkiraan Hasil Kembali *</label>
        <input type="date" id="ref-sf-expected" value="${besok}">
        <div class="form-hint">Dipakai untuk menandai keterlambatan.</div></div>
    </div>

    <div id="ref-sf-margin" style="font-size:12.5px;font-weight:700;margin-bottom:10px"></div>

    <div class="form-group"><label>Catatan</label>
      <textarea id="ref-sf-notes" rows="2" placeholder="Nomor pengiriman, kurir, permintaan khusus…"></textarea></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="refSaveSend()">📤 Kirim</button>
    </div>`, 'wide');

  refPreviewMargin();
}

// Pencarian pasien lewat admissions — satu baris per kunjungan terbaru.
function refSearchPatient(q) {
  clearTimeout(_refPatTimer);
  const box = document.getElementById('ref-sf-results');
  if (!box) return;
  if (!q || q.trim().length < 3) { box.innerHTML = ''; return; }

  _refPatTimer = setTimeout(async () => {
    try {
      const rows = await sbGet('admissions',
        `select=id,mr_number,patient_name,visit_number&patient_name=ilike.${encodeURIComponent('%' + q.trim() + '%')}` +
        `&order=id.desc&limit=15`);
      if (!rows || !rows.length) {
        box.innerHTML = `<div style="position:absolute;z-index:50;left:0;right:0;background:#fff;
          border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:12px;color:var(--gray)">
          Tidak ada pasien cocok.</div>`;
        return;
      }
      box.innerHTML = `<div style="position:absolute;z-index:50;left:0;right:0;background:#fff;
        border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);max-height:210px;overflow:auto">
        ${rows.slice(0, 8).map(r => `
          <div onclick='refPickPatient(${JSON.stringify(r).replace(/'/g, "&#39;")})'
            style="padding:8px 11px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12.5px"
            onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='#fff'">
            <div style="font-weight:650">${refEsc(r.patient_name || '—')}</div>
            <div style="font-size:11px;color:var(--gray)">
              <span style="font-family:ui-monospace,monospace;color:var(--teal)">${refEsc(r.mr_number || 'tanpa RM')}</span>
              ${r.visit_number ? ' · ' + refEsc(r.visit_number) : ''}</div>
          </div>`).join('')}
      </div>`;
    } catch (e) { box.innerHTML = ''; }
  }, 300);
}

function refPickPatient(p) {
  refPickedAdm = p;
  const inp = document.getElementById('ref-sf-search');
  if (inp) inp.value = p.patient_name || '';
  const box = document.getElementById('ref-sf-results');
  if (box) box.innerHTML = '';
  const hint = document.getElementById('ref-sf-hint');
  if (hint) {
    hint.textContent = `✅ ${p.patient_name} · ${p.mr_number || 'tanpa nomor RM'}`;
    hint.style.color = 'var(--teal)';
  }
}

// Harga ke pasien diisi dari harga_normal produk sebagai titik awal — tetap bisa diubah.
function refPickProduct() {
  const sel = document.getElementById('ref-sf-product');
  const opt = sel?.options[sel.selectedIndex];
  const harga = refNum(opt?.getAttribute('data-harga'));
  const price = document.getElementById('ref-sf-price');
  if (price && harga > 0) price.value = harga;
  refPreviewMargin();
}

function refPreviewMargin() {
  const el = document.getElementById('ref-sf-margin');
  if (!el) return;
  const cost = refNum(document.getElementById('ref-sf-cost')?.value);
  const price = refNum(document.getElementById('ref-sf-price')?.value);
  const m = price - cost;
  el.innerHTML = m < 0
    ? `<span style="color:#B91C1C">⚠️ Margin ${formatCurrency(m)} — harga ke pasien lebih rendah
       daripada biaya ke lab. Pemeriksaan ini merugi dan perlu ditinjau.</span>`
    : `<span style="color:#15803D">Margin ${formatCurrency(m)}</span>`;
}

async function refSaveSend() {
  if (!refPickedAdm) { toast('Pilih pasien lebih dulu', 'err'); return; }

  const selP = document.getElementById('ref-sf-product');
  const optP = selP?.options[selP.selectedIndex];
  const productId = selP?.value;
  if (!productId) { toast('Pilih pemeriksaan', 'err'); return; }

  const selL = document.getElementById('ref-sf-lab');
  const optL = selL?.options[selL.selectedIndex];
  const labId = selL?.value;
  if (!labId) { toast('Pilih lab rekanan', 'err'); return; }

  const expected = document.getElementById('ref-sf-expected')?.value;
  if (!expected) { toast('Isi perkiraan tanggal hasil kembali', 'err'); return; }

  const cost = refNum(document.getElementById('ref-sf-cost')?.value);
  const price = refNum(document.getElementById('ref-sf-price')?.value);
  const productName = optP?.getAttribute('data-name') || '';

  if (price < cost && !confirm(
      `Harga ke pasien (${formatCurrency(price)}) lebih rendah daripada biaya ke lab ` +
      `(${formatCurrency(cost)}). Pemeriksaan ini merugi. Lanjutkan?`)) return;

  // Tautkan ke sampel bila kebetulan sudah ada sampel untuk kunjungan &
  // pemeriksaan yang sama. Bersifat pelengkap — gagal pun pengiriman tetap tercatat.
  let sampleId = null;
  try {
    const s = await sbGet('lab_samples',
      `select=id&admission_id=eq.${refPickedAdm.id}` +
      `&product_name=eq.${encodeURIComponent(productName)}&limit=1`);
    sampleId = s?.[0]?.id || null;
  } catch (e) { sampleId = null; }

  try {
    const res = await sbPost('referred_tests', {
      sample_id: sampleId,
      admission_id: refPickedAdm.id,
      product_id: parseInt(productId),
      product_name: productName,
      patient_name: refPickedAdm.patient_name || '',
      referral_lab_id: parseInt(labId),
      lab_name: optL?.getAttribute('data-name') || '',
      sent_at: new Date().toISOString(),
      expected_at: expected,
      cost, price,
      status: 'Dikirim',
      notes: (document.getElementById('ref-sf-notes')?.value || '').trim() || null,
      updated_at: new Date().toISOString(),
    });

    await logActivity('create', 'referred_tests', res?.[0]?.id || 0,
      `Rujukan dikirim: ${productName} → ${optL?.getAttribute('data-name') || ''} ` +
      `(${refPickedAdm.patient_name || ''})`, refPickedAdm.patient_name || '');

    toast('✅ Pemeriksaan tercatat terkirim', 'ok');
    closeModalForce();
    await refLoadAll();
  } catch (e) {
    toast('❌ ' + (e.message || 'Gagal menyimpan pengiriman'), 'err');
  }
}

// ══════════════════════════════════════════════════════════════
// TERIMA HASIL
// ══════════════════════════════════════════════════════════════
function refOpenReceiveForm(id) {
  const t = refTests.find(x => String(x.id) === String(id));
  if (!t) { toast('Data rujukan tidak ditemukan', 'err'); return; }

  const late = refIsLate(t);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">📥 Terima Hasil Rujukan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div style="background:var(--bg2);border-radius:9px;padding:11px 13px;margin-bottom:13px;font-size:12.5px">
      <div style="font-weight:700">${refEsc(t.patient_name || '—')}</div>
      <div style="color:var(--gray);margin-top:3px">
        ${refEsc(t.product_name || '—')} · ${refEsc(t.lab_name || refLabName(t.referral_lab_id) || '—')}
      </div>
      <div style="color:var(--gray);margin-top:3px">
        Dikirim ${t.sent_at ? formatDateShort(t.sent_at) : '—'} ·
        Perkiraan ${t.expected_at ? formatDateShort(t.expected_at) : '—'}
        ${late ? `<span style="color:#B91C1C;font-weight:700"> · terlambat ${refLateDays(t)} hari</span>` : ''}
      </div>
    </div>

    <div class="form-group"><label>Nilai / Isi Hasil *</label>
      <textarea id="ref-rf-value" rows="5"
        placeholder="Salin nilai hasil dari lembar hasil lab rekanan…">${refEsc(t.result_value || '')}</textarea></div>

    <div class="form-group"><label>Tanggal Hasil Diterima *</label>
      <input type="date" id="ref-rf-date" value="${new Date().toISOString().slice(0, 10)}"></div>

    <div class="form-group"><label>Catatan</label>
      <textarea id="ref-rf-notes" rows="2"
        placeholder="Catatan penerimaan">${refEsc(t.notes || '')}</textarea></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="refSaveReceive(${t.id})">✅ Tandai Diterima</button>
    </div>`, 'wide');
}

async function refSaveReceive(id) {
  const val = (document.getElementById('ref-rf-value')?.value || '').trim();
  if (!val) { toast('Isi nilai hasil lebih dulu', 'err'); return; }
  const tgl = document.getElementById('ref-rf-date')?.value;
  if (!tgl) { toast('Isi tanggal hasil diterima', 'err'); return; }

  const t = refTests.find(x => String(x.id) === String(id)) || {};
  try {
    await sbPatch('referred_tests', id, {
      result_value: val,
      result_at: new Date(tgl + 'T00:00:00').toISOString(),
      status: 'Diterima',
      notes: (document.getElementById('ref-rf-notes')?.value || '').trim() || null,
      updated_at: new Date().toISOString(),
    });
    await logActivity('update', 'referred_tests', id,
      `Hasil rujukan diterima: ${t.product_name || ''} (${t.patient_name || ''})`, t.patient_name || '');
    toast('✅ Hasil tercatat diterima', 'ok');
    closeModalForce();
    await refLoadAll();
  } catch (e) {
    toast('❌ ' + (e.message || 'Gagal menyimpan hasil'), 'err');
  }
}

function refOpenResultView(id) {
  const t = refTests.find(x => String(x.id) === String(id));
  if (!t) return;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">🧾 Hasil Rujukan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="background:var(--bg2);border-radius:9px;padding:11px 13px;margin-bottom:13px;font-size:12.5px">
      <div style="font-weight:700">${refEsc(t.patient_name || '—')}</div>
      <div style="color:var(--gray);margin-top:3px">
        ${refEsc(t.product_name || '—')} · ${refEsc(t.lab_name || refLabName(t.referral_lab_id) || '—')}</div>
      <div style="color:var(--gray);margin-top:3px">
        Dikirim ${t.sent_at ? formatDateShort(t.sent_at) : '—'} ·
        Hasil ${t.result_at ? formatDateShort(t.result_at) : '—'}</div>
    </div>
    <div class="form-group"><label>Nilai Hasil</label>
      <div style="white-space:pre-wrap;font-size:12.5px;border:1px solid var(--border);
        border-radius:8px;padding:10px;background:#fff">${refEsc(t.result_value || '—')}</div></div>
    ${t.notes ? `<div class="form-group"><label>Catatan</label>
      <div style="font-size:12.5px;color:var(--gray)">${refEsc(t.notes)}</div></div>` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="refOpenReceiveForm(${t.id})">Perbaiki Hasil</button>
    </div>`, 'wide');
}

async function refCancelTest(id) {
  const t = refTests.find(x => String(x.id) === String(id));
  if (!t) return;
  if (!confirm(`Batalkan rujukan "${t.product_name || ''}" untuk ${t.patient_name || ''}?`)) return;
  try {
    await sbPatch('referred_tests', id, { status: 'Dibatalkan', updated_at: new Date().toISOString() });
    await logActivity('update', 'referred_tests', id,
      `Rujukan dibatalkan: ${t.product_name || ''} (${t.patient_name || ''})`, t.patient_name || '');
    toast('Rujukan dibatalkan', 'ok');
    await refLoadAll();
  } catch (e) {
    toast('❌ ' + (e.message || 'Gagal membatalkan'), 'err');
  }
}

// ══════════════════════════════════════════════════════════════
// TAB 3 — MARGIN PER LAB REKANAN
// ══════════════════════════════════════════════════════════════
function refViewMargin() {
  // Rujukan yang dibatalkan tidak pernah masuk hitungan margin.
  const rows = refTests.filter(t => refInPeriod(t) && t.status !== 'Dibatalkan');

  if (!rows.length) {
    return `<div class="empty-state"><div class="ico">📊</div>
      <h3>Tidak ada rujukan pada ${refPeriodLabel()}</h3>
      <p>Ganti periode di atas untuk melihat bulan lain.</p></div>`;
  }

  // Kelompokkan per lab rekanan.
  const grup = {};
  rows.forEach(t => {
    const key = String(t.referral_lab_id || 'lain');
    if (!grup[key]) grup[key] = {
      nama: t.lab_name || refLabName(t.referral_lab_id) || 'Tanpa lab',
      jml: 0, cost: 0, price: 0, rugi: 0,
    };
    const g = grup[key];
    g.jml++;
    g.cost += refNum(t.cost);
    g.price += refNum(t.price);
    if (refRugi(t)) g.rugi++;
  });

  const list = Object.values(grup).sort((a, b) => (b.price - b.cost) - (a.price - a.cost));
  const totCost  = list.reduce((s, g) => s + g.cost, 0);
  const totPrice = list.reduce((s, g) => s + g.price, 0);
  const totRugi  = list.reduce((s, g) => s + g.rugi, 0);
  const totMargin = totPrice - totCost;

  const rugiRows = rows.filter(refRugi);
  const panelRugi = rugiRows.length ? `
    <div class="status-box status-warn" style="margin-top:16px">
      <strong>${rugiRows.length} pemeriksaan merugi pada ${refPeriodLabel()}.</strong>
      Harga ke pasien lebih rendah daripada biaya ke lab rekanan — tarif atau kesepakatan
      harga perlu ditinjau.
    </div>
    <div class="table-wrap" style="margin-top:10px"><table><thead><tr>
        <th>Pasien</th><th>Pemeriksaan</th><th>Lab Rekanan</th>
        <th style="text-align:right">Biaya</th><th style="text-align:right">Harga</th>
        <th style="text-align:right">Selisih</th>
      </tr></thead><tbody>
      ${rugiRows.map(t => `<tr style="background:#FEF6F6">
        <td>${refEsc(t.patient_name || '—')}</td>
        <td style="font-size:12.5px">${refEsc(t.product_name || '—')}</td>
        <td style="font-size:12.5px">${refEsc(t.lab_name || refLabName(t.referral_lab_id) || '—')}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(refNum(t.cost))}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(refNum(t.price))}</td>
        <td style="text-align:right;font-weight:700;color:#B91C1C;font-variant-numeric:tabular-nums">
          ${formatCurrency(refMargin(t))}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '';

  return `
    <div class="section-header" style="margin-bottom:10px">
      <div class="section-label">Margin per Lab Rekanan · ${refPeriodLabel()}</div>
    </div>
    <div class="table-wrap"><table><thead><tr>
        <th>Lab Rekanan</th><th style="text-align:center">Jumlah</th>
        <th style="text-align:right">Total Biaya</th><th style="text-align:right">Total Harga</th>
        <th style="text-align:right">Margin</th><th style="text-align:center">Merugi</th>
      </tr></thead><tbody>
      ${list.map(g => {
        const m = g.price - g.cost;
        return `<tr>
          <td style="font-weight:650">${refEsc(g.nama)}</td>
          <td style="text-align:center;font-variant-numeric:tabular-nums">${g.jml}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(g.cost)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(g.price)}</td>
          <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums;
            color:${m < 0 ? '#B91C1C' : '#15803D'}">${formatCurrency(m)}</td>
          <td style="text-align:center">${g.rugi
            ? `<span class="badge badge-red">${g.rugi}</span>`
            : '<span style="color:var(--gray)">—</span>'}</td>
        </tr>`;
      }).join('')}
      <tr style="background:var(--bg2);font-weight:800">
        <td>Total</td>
        <td style="text-align:center;font-variant-numeric:tabular-nums">${rows.length}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(totCost)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(totPrice)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;
          color:${totMargin < 0 ? '#B91C1C' : '#15803D'}">${formatCurrency(totMargin)}</td>
        <td style="text-align:center">${totRugi || '—'}</td>
      </tr>
    </tbody></table></div>
    ${panelRugi}`;
}
