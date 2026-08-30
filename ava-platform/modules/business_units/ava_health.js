// ═══════════════════════════════════════════════════════════════
// MODUL: AVA Health — Telehealth & Trust Layer
//
// Satu berkas, tujuh sub-modul, tujuh menu. Versi sebelumnya (627 baris)
// tidak punya satu pun panggilan data: sesi telekonsultasi, pembacaan
// alat, sertifikat kalibrasi, dan daftar caregiver seluruhnya array yang
// ditulis tangan.
//
// Yang paling berbahaya di antaranya adalah badge kalibrasi. "AVA
// Verified" pada alat kesehatan adalah pernyataan bahwa sertifikat
// kalibrasinya sudah diperiksa. Menampilkannya dari array yang ditulis
// tangan berarti menjamin alat yang tidak pernah diperiksa siapa pun.
//
// Kelima tabelnya sudah ada di basis data sejak lama dan tidak pernah
// dibaca: ava_consultations, ava_device_readings, ava_calibration_badges,
// ava_marketplace_items, ava_caregiver_links.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Badge kalibrasi yang kedaluwarsa TIDAK ditampilkan sebagai terverifikasi,
// berapa pun isi kolom badge_status-nya. Tanggal berakhir yang sudah
// lewat mengalahkan status yang tersimpan — status tidak berubah sendiri
// saat sertifikat habis.
//
// Cakupan izin caregiver ditampilkan apa adanya. Caregiver melihat data
// kesehatan orang lain; siapa boleh melihat apa harus terbaca sekali
// lihat, bukan tersembunyi di balik kata "aktif".
//
// Prefiks "av".
// ═══════════════════════════════════════════════════════════════

let AVA_TAB = 'consult';
let avData = null;

function avEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function avRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function avTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}
function avJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function avMuat() {
  if (typeof sbGet !== 'function') { avData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [konsul, alat, badge, market, caregiver, korporat, akses] = await Promise.all([
      sbGet('ava_consultations', 'select=*&order=created_at.desc&limit=200'),
      aman('ava_device_readings', 'select=*&order=created_at.desc&limit=200'),
      aman('ava_calibration_badges', 'select=*&order=expiry_date'),
      aman('ava_marketplace_items', 'select=*&order=created_at.desc&limit=200'),
      aman('ava_caregiver_links', 'select=*&order=created_at.desc&limit=200'),
      aman('corporates', 'select=id,corporate_name,status,kode_corp&order=corporate_name'),
      aman('portal_akses', 'select=*&limit=500'),
    ]);
    avData = { konsul, alat, badge, market, caregiver, korporat, akses };
  } catch (e) { avData = null; }
}

async function renderAVAHealth(tab) {
  if (tab) AVA_TAB = tab;
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await avMuat();

  if (avData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>AVA Health</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data AVA Health tidak dapat dibaca.</strong><br>
        Tabel <code>ava_consultations</code> dan kawan-kawannya belum tersedia.
      </div>`;
    return;
  }
  avGambar();
}

function switchAVATab(tabId) { AVA_TAB = tabId; avGambar(); }

function avGambar() {
  const tabs = [
    ['consult',     'Telekonsultasi'],
    ['devices',     'Perangkat & Wearables'],
    ['calibration', 'Badge Kalibrasi'],
    ['marketplace', 'Marketplace Alkes'],
    ['caregiver',   'Caregiver & Keluarga'],
    ['corporate',   'Korporat B2B'],
    ['portals',     'Portal & Akses'],
  ];

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>AVA Health</h1>
        <p class="muted">Telehealth dan lapisan kepercayaan: alat, kalibrasi, dan izin akses.</p>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px; flex-wrap:wrap">
      ${tabs.map(([k, l]) => `
        <button class="tab ${AVA_TAB === k ? 'active' : ''}"
                onclick="switchAVATab('${k}')">${l}</button>`).join('')}
    </div>

    <div id="ava-isi">${renderActiveAVATabContent()}</div>`;
}

function renderActiveAVATabContent() {
  switch (AVA_TAB) {
    case 'devices':     return avTabDevices();
    case 'calibration': return avTabCalibration();
    case 'marketplace': return avTabMarketplace();
    case 'caregiver':   return avTabCaregiver();
    case 'corporate':   return avTabCorporate();
    case 'portals':     return avTabPortals();
    default:            return avTabConsult();
  }
}

function avKosong(ikon, judul, ket) {
  return `<div class="card" style="padding:32px; text-align:center">
    <div style="font-size:28px; opacity:.4; margin-bottom:8px">${ikon}</div>
    <div style="font-weight:700; margin-bottom:4px">${judul}</div>
    ${ket ? `<div style="font-size:13px; color:var(--text3); max-width:520px;
                          margin:0 auto; line-height:1.8">${ket}</div>` : ''}
  </div>`;
}

// ── 1. Telekonsultasi ────────────────────────────────────────────
function avTabConsult() {
  const K = avData.konsul || [];
  if (!K.length) {
    return avKosong('🩺', 'Belum ada sesi telekonsultasi',
      'Sesi yang dibuat dari aplikasi pasien akan muncul di sini.');
  }

  const antre = K.filter(k => (k.status || '').toLowerCase().includes('menunggu')
                           || (k.status || '').toLowerCase() === 'baru');
  const warnaTriase = { 'merah': 'var(--danger)', 'kuning': 'var(--warning)',
                        'hijau': 'var(--success)' };

  return `
    ${antre.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--info)">
        <b>${antre.length} sesi menunggu dokter.</b>
      </div>` : ''}
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Waktu</th><th>Pasien</th><th>Dokter</th><th>Keluhan</th>
        <th>Triase</th><th>e-Resep</th><th>Rujukan Lab</th>
        <th style="text-align:right">Jasa Dokter</th><th>Status</th>
      </tr></thead><tbody>
      ${K.map(k => `<tr>
        <td style="white-space:nowrap">${avJam(k.created_at)}</td>
        <td>${avEsc(k.patient_name || '—')}</td>
        <td>${avEsc(k.doctor_name || '—')}</td>
        <td style="font-size:12px; max-width:260px">${avEsc(k.complaint || '—')}</td>
        <td><span style="font-weight:700;
              color:${warnaTriase[String(k.triage_level || '').toLowerCase()] || 'var(--text3)'}">
          ${avEsc(k.triage_level || '—')}</span></td>
        <td>${k.e_prescription ? '✓' : '—'}</td>
        <td>${k.lab_referral ? '✓' : '—'}</td>
        <td style="text-align:right">${avRp(k.doctor_fee)}</td>
        <td>${avEsc(k.status || '—')}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

// ── 2. Perangkat & wearables ─────────────────────────────────────
function avTabDevices() {
  const D = avData.alat || [];
  if (!D.length) {
    return avKosong('⌚', 'Belum ada pembacaan perangkat',
      'Pembacaan dari alat dan wearable yang tertaut ke akun pasien akan muncul di sini.');
  }

  const waspada = D.filter(d => d.alert_status
    && !/normal|aman|ok/i.test(d.alert_status));

  return `
    ${waspada.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${waspada.length} pembacaan di luar rentang normal.</b>
        Pembacaan alat rumahan bukan diagnosis — ia alasan untuk menghubungi
        pasien, bukan untuk mengambil kesimpulan klinis dari layar ini.
      </div>` : ''}
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Waktu</th><th>Pasien</th><th>Perangkat</th><th>Jenis</th>
        <th style="text-align:right">Nilai</th><th>Status</th>
      </tr></thead><tbody>
      ${D.map(d => {
        const alert = d.alert_status && !/normal|aman|ok/i.test(d.alert_status);
        return `<tr>
          <td style="white-space:nowrap">${avJam(d.created_at)}</td>
          <td>${avEsc(d.patient_id || '—')}</td>
          <td>${avEsc(d.device_name || '—')}</td>
          <td>${avEsc(d.device_type || '—')}</td>
          <td style="text-align:right; font-weight:700;
                     color:${alert ? 'var(--danger)' : 'inherit'}">
            ${avEsc(d.reading_value)} ${avEsc(d.unit || '')}</td>
          <td>${avEsc(d.alert_status || '—')}</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>`;
}

// ── 3. Badge kalibrasi ───────────────────────────────────────────
// Tanggal berakhir mengalahkan kolom status. Sertifikat tidak
// memperbarui statusnya sendiri saat habis masa berlaku.
function avBadge(b) {
  if (b.expiry_date && new Date(b.expiry_date) < new Date()) {
    return { teks: 'Kedaluwarsa', warna: 'var(--danger)', sah: false };
  }
  const s = String(b.badge_status || '').toLowerCase();
  if (/verified|aktif|valid/.test(s)) {
    return { teks: 'AVA Verified', warna: 'var(--success)', sah: true };
  }
  return { teks: b.badge_status || 'Belum diverifikasi',
           warna: 'var(--text3)', sah: false };
}

function avTabCalibration() {
  const B = avData.badge || [];
  if (!B.length) {
    return avKosong('🏅', 'Belum ada sertifikat kalibrasi terdaftar',
      '"AVA Verified" adalah pernyataan bahwa sertifikat kalibrasi alat '
      + 'sudah diperiksa. Daftar ini kosong sampai ada yang benar-benar '
      + 'diperiksa — menampilkannya lebih awal berarti menjamin alat yang '
      + 'tidak pernah dilihat siapa pun.');
  }

  const exp = B.filter(b => !avBadge(b).sah);
  const segera = B.filter(b => {
    if (!b.expiry_date) return false;
    const h = Math.round((new Date(b.expiry_date) - new Date()) / 86400000);
    return h >= 0 && h <= 60;
  });

  return `
    ${exp.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${exp.length} alat tidak berbadge sah</b> — kedaluwarsa atau belum
        diverifikasi. Alat ini tidak boleh ditampilkan sebagai AVA Verified
        di mana pun.
      </div>` : ''}
    ${segera.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${segera.length} sertifikat berakhir dalam 60 hari.</b>
      </div>` : ''}
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Alat</th><th>Lab Kalibrasi</th><th>No. Sertifikat</th>
        <th>Berlaku s/d</th><th style="text-align:right">Sisa</th><th>Badge</th>
      </tr></thead><tbody>
      ${B.map(b => {
        const st = avBadge(b);
        const sisa = b.expiry_date
          ? Math.round((new Date(b.expiry_date) - new Date()) / 86400000) : null;
        return `<tr>
          <td><b>${avEsc(b.device_name || '—')}</b></td>
          <td>${avEsc(b.lab_name || '—')}</td>
          <td style="font-size:12px">${avEsc(b.cert_number || '—')}</td>
          <td>${avTgl(b.expiry_date)}</td>
          <td style="text-align:right; color:${sisa !== null && sisa < 0
            ? 'var(--danger)' : sisa !== null && sisa <= 60 ? 'var(--warning)' : 'inherit'}">
            ${sisa === null ? '—'
              : sisa < 0 ? 'lewat ' + Math.abs(sisa) + 'h' : sisa + ' hari'}</td>
          <td><span style="font-weight:700; color:${st.warna}">${avEsc(st.teks)}</span></td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Badge dihitung dari tanggal berakhir sertifikat, bukan dari kolom
      status: sertifikat tidak memperbarui statusnya sendiri saat habis
      masa berlaku. Alat yang sertifikatnya lewat ditandai kedaluwarsa
      berapa pun isi kolom statusnya.
    </div>`;
}

// ── 4. Marketplace alkes ─────────────────────────────────────────
function avTabMarketplace() {
  const M = avData.market || [];
  if (!M.length) {
    return avKosong('🛒', 'Belum ada alat yang ditawarkan',
      'Alat sewa dan jual dari vendor mitra akan muncul di sini.');
  }

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>Alat</th><th>Vendor</th><th>Jenis</th>
      <th style="text-align:right">Harga</th><th>Verifikasi</th><th>Ditambahkan</th>
    </tr></thead><tbody>
    ${M.map(m => {
      const ver = /verified|aktif/i.test(String(m.badge_status || ''));
      return `<tr>
        <td><b>${avEsc(m.title || '—')}</b></td>
        <td>${avEsc(m.vendor_name || '—')}</td>
        <td>${avEsc(m.type || '—')}</td>
        <td style="text-align:right">${avRp(m.price)}</td>
        <td>${ver
          ? '<span style="color:var(--success); font-weight:600">AVA Verified</span>'
          : `<span style="color:var(--text3)">${avEsc(m.badge_status || 'belum diverifikasi')}</span>`}</td>
        <td>${avTgl(m.created_at)}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
  </div>`;
}

// ── 5. Caregiver & keluarga ──────────────────────────────────────
function avTabCaregiver() {
  const C = avData.caregiver || [];
  if (!C.length) {
    return avKosong('👨‍👩‍👧', 'Belum ada caregiver tertaut',
      'Caregiver adalah orang yang diberi izin memantau kesehatan pasien lain.');
  }

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Cakupan izin ditampilkan apa adanya, bukan diringkas jadi "aktif".
      Caregiver melihat data kesehatan orang lain — siapa boleh melihat apa
      harus terbaca sekali lihat.
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Pasien</th><th>Caregiver</th><th>Hubungan</th>
        <th>Cakupan Izin</th><th>Ditautkan</th>
      </tr></thead><tbody>
      ${C.map(c => `<tr>
        <td>${avEsc(c.patient_id || '—')}</td>
        <td><b>${avEsc(c.caregiver_name || '—')}</b></td>
        <td>${avEsc(c.relation || '—')}</td>
        <td style="font-size:12px">${
          c.permission_scope
            ? (Array.isArray(c.permission_scope)
                ? c.permission_scope.map(avEsc).join(', ')
                : avEsc(typeof c.permission_scope === 'object'
                    ? JSON.stringify(c.permission_scope) : c.permission_scope))
            : '<span style="color:var(--warning)">cakupan belum ditetapkan</span>'}</td>
        <td>${avTgl(c.created_at)}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

// ── 6. Korporat B2B ──────────────────────────────────────────────
function avTabCorporate() {
  const K = avData.korporat || [];
  if (!K.length) {
    return avKosong('🏢', 'Belum ada perusahaan klien terdaftar',
      'Perusahaan klien dikelola di modul Corporate Management (HIS).');
  }

  const aktif = K.filter(k => k.status === 'Aktif');

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
                gap:12px; margin-bottom:16px">
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Perusahaan terdaftar</div>
        <div style="font-size:22px; font-weight:800">${K.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Aktif</div>
        <div style="font-size:22px; font-weight:800; color:var(--success)">${aktif.length}</div>
      </div>
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Perusahaan</th><th>Kode Korporat</th><th>Status</th>
      </tr></thead><tbody>
      ${K.map(k => `<tr>
        <td><b>${avEsc(k.corporate_name || '—')}</b></td>
        <td style="font-size:12px">${avEsc(k.kode_corp || '—')}</td>
        <td>${avEsc(k.status || '—')}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Kode korporat dipakai PIC perusahaan untuk masuk ke portalnya. Kode
      ini <b>bukan rahasia</b> — ia tercetak di invoice dan dokumen PKS —
      sehingga akses portal diperiksa dari akun yang masuk, bukan dari
      kode yang diketik.
    </div>`;
}

// ── 7. Portal & akses ────────────────────────────────────────────
function avTabPortals() {
  const A = avData.akses || [];
  if (!A.length) {
    return avKosong('🔗', 'Belum ada tautan portal diterbitkan',
      'Portal bertoken diterbitkan per perusahaan atau per pasien, dan '
      + 'masa berlakunya terbatas.');
  }

  const kini = new Date();
  const kadaluarsa = A.filter(a =>
    (a.berlaku_sampai && new Date(a.berlaku_sampai) < kini) || a.aktif === false);
  const aktif = A.filter(a => !kadaluarsa.includes(a));

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
                gap:12px; margin-bottom:16px">
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Tautan aktif</div>
        <div style="font-size:22px; font-weight:800; color:var(--success)">${aktif.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Mati / kedaluwarsa</div>
        <div style="font-size:22px; font-weight:800;
                    color:${kadaluarsa.length ? 'var(--warning)' : 'var(--text3)'}">
          ${kadaluarsa.length}</div>
      </div>
    </div>

    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Jenis</th><th>Untuk</th><th>Boleh Tulis</th>
        <th>Berlaku s/d</th><th>Terakhir Dipakai</th>
        <th style="text-align:right">Dipakai</th><th>Status</th>
      </tr></thead><tbody>
      ${A.slice(0, 200).map(a => {
        const mati = a.berlaku_sampai && new Date(a.berlaku_sampai) < kini;
        return `<tr style="${mati ? 'opacity:.6' : ''}">
          <td>${avEsc(a.jenis || '—')}</td>
          <td>${avEsc(a.label || a.ref_id || '—')}</td>
          <td>${a.boleh_tulis
            ? '<span style="color:var(--warning); font-weight:600">ya</span>'
            : 'tidak'}</td>
          <td>${avTgl(a.berlaku_sampai)}</td>
          <td>${avJam(a.terakhir_dipakai)}</td>
          <td style="text-align:right">${Number(a.jumlah_akses || 0)}</td>
          <td>${mati
            ? `<span style="color:var(--text3)">${a.aktif === false
                 ? 'dinonaktifkan' : 'kedaluwarsa'}</span>`
            : '<span style="color:var(--success)">aktif</span>'}</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Kolom <b>boleh tulis</b> ditandai karena tautan yang bisa mengubah
      data berbeda risikonya dari tautan yang hanya membaca. Tautan
      bertoken beredar lewat surel dan pesan — yang bisa menulis harus
      sesedikit mungkin dan semasa-berlaku-pendek mungkin.
    </div>`;
}

window.renderAVAHealth = renderAVAHealth;
window.switchAVATab = switchAVATab;
window.renderActiveAVATabContent = renderActiveAVATabContent;
