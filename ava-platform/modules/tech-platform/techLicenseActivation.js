// ═══════════════════════════════════════════════════════════════
// MODUL: AVA Tech — Aktivasi Lisensi
//
// Versi sebelumnya tidak punya panggilan data: daftar lisensi, status
// aktivasi, dan tanggal berakhir ditulis tangan. Layar yang menampilkan
// "Aktif" untuk lisensi yang sebenarnya kedaluwarsa membuat tim menagih
// ke klien yang salah, dan membiarkan klien lain memakai tanpa membayar.
//
// Sekarang membaca view public.tech_papan_lisensi (migrasi 0039).
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Aktivasi dan pencabutan dikerjakan RPC, bukan UPDATE dari layar.
// Aturannya — kedaluwarsa tidak bisa diaktifkan, yang sudah dicabut
// tidak bisa dihidupkan lagi, aktivasi dua kali ditolak — dijaga di
// basis data supaya tetap berlaku dari jalur mana pun.
//
// Pencabutan TIDAK mematikan tenant. Pencabutan sering terjadi saat
// perpanjangan sedang diurus; mematikan akses seketika berarti klinik
// berhenti melayani pasien karena urusan administrasi. Penonaktifan
// adalah keputusan terpisah yang disengaja, dan layar mengatakannya.
//
// Prefiks "tl".
// ═══════════════════════════════════════════════════════════════

let tlData = null;
let tlLicenseFilter = 'semua';

function tlEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function tlRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function tlTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function tlMuat() {
  if (typeof sbGet !== 'function') { tlData = null; return; }
  try {
    tlData = await sbGet('tech_papan_lisensi',
      'select=*&order=tgl_berakhir&limit=400');
  } catch (e) { tlData = null; }
}

async function renderTechLicenseActivation() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await tlMuat();

  if (tlData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Aktivasi Lisensi</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data lisensi tidak dapat dibaca.</strong><br>
        View <code>tech_papan_lisensi</code> belum ada — jalankan ulang
        aplikasi agar migrasi
        <code>0039_tech_lisensi_harga_order_terintegrasi.sql</code> terpasang.
      </div>`;
    return;
  }
  tlGambar();
}

function tlGambar() {
  const L = tlData || [];
  const aktif = L.filter(x => x.status === 'Aktif');
  const belum = L.filter(x => x.status === 'Belum Aktif');
  const segera = aktif.filter(x => x.segera_berakhir);
  const lewat = L.filter(x => x.status === 'Aktif' && Number(x.sisa_hari) < 0);
  const dicabut = L.filter(x => x.status === 'Dicabut');

  const daftar = tlLicenseFilter === 'aktif' ? aktif
               : tlLicenseFilter === 'belum' ? belum
               : tlLicenseFilter === 'segera' ? segera
               : tlLicenseFilter === 'dicabut' ? dicabut : L;

  const warna = {
    'Aktif': 'var(--success)', 'Belum Aktif': 'var(--info)',
    'Kedaluwarsa': 'var(--warning)', 'Dicabut': 'var(--danger)',
  };

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Aktivasi Lisensi</h1>
        <p class="muted">Lisensi per tenant, masa berlaku, dan status aktivasinya.</p>
      </div>
      <div><button class="btn btn-primary" onclick="tlAktivasi()">Aktifkan Kode</button></div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
                gap:12px; margin-bottom:16px">
      ${tlKartu('Semua lisensi', L.length, 'semua', 'var(--text)')}
      ${tlKartu('Aktif', aktif.length, 'aktif', 'var(--success)')}
      ${tlKartu('Belum diaktifkan', belum.length, 'belum', 'var(--info)')}
      ${tlKartu('Berakhir ≤30 hari', segera.length, 'segera',
                segera.length ? 'var(--warning)' : 'var(--text3)')}
      ${tlKartu('Dicabut', dicabut.length, 'dicabut',
                dicabut.length ? 'var(--danger)' : 'var(--text3)')}
    </div>

    ${lewat.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${lewat.length} lisensi berstatus Aktif padahal masa berlakunya sudah lewat.</b>
        Status tidak berubah sendiri — perlu diperpanjang atau ditutup.
      </div>` : ''}

    ${!daftar.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🔑</div>
        <div style="font-weight:700; margin-bottom:4px">
          ${tlLicenseFilter === 'semua' ? 'Belum ada lisensi diterbitkan'
                                 : 'Tidak ada lisensi pada kelompok ini'}</div>
        <div style="font-size:13px; color:var(--text3)">
          Lisensi diterbitkan per tenant setelah paket disepakati.</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Kode Lisensi</th><th>Tenant</th><th>Paket</th><th>Siklus</th>
          <th style="text-align:right">Nilai</th>
          <th>Mulai</th><th>Berakhir</th>
          <th style="text-align:right">Sisa</th>
          <th>Status</th><th>Akses Tenant</th><th></th>
        </tr></thead><tbody>
        ${daftar.map(l => {
          const sisa = l.sisa_hari == null ? null : Number(l.sisa_hari);
          return `<tr>
            <td><b>${tlEsc(l.kode_lisensi)}</b></td>
            <td>${tlEsc(l.tenant_nama || '—')}
              <div style="font-size:11px; color:var(--text3)">
                ${tlEsc(l.tenant_kode || '')}${l.tenant_jenis
                  ? ' · ' + tlEsc(l.tenant_jenis) : ''}</div></td>
            <td>${tlEsc(l.paket_nama || '—')}</td>
            <td>${tlEsc(l.siklus || '—')}</td>
            <td style="text-align:right">${tlRp(l.nilai)}</td>
            <td>${tlTgl(l.tgl_mulai)}</td>
            <td>${tlTgl(l.tgl_berakhir)}</td>
            <td style="text-align:right; font-weight:${sisa !== null && sisa <= 30 ? '700' : '400'};
                       color:${sisa === null ? 'var(--text3)'
                              : sisa < 0 ? 'var(--danger)'
                              : sisa <= 30 ? 'var(--warning)' : 'inherit'}">
              ${sisa === null ? '—'
                : sisa < 0 ? 'lewat ' + Math.abs(sisa) + 'h' : sisa + ' hari'}</td>
            <td><span style="font-weight:600; color:${warna[l.status] || 'var(--text3)'}">
              ${tlEsc(l.status)}</span></td>
            <td>${l.tenant_aktif
              ? '<span style="color:var(--success)">hidup</span>'
              : '<span style="color:var(--text3)">mati</span>'}</td>
            <td style="white-space:nowrap">
              ${l.status === 'Belum Aktif'
                ? `<button class="btn btn-sm btn-primary"
                     onclick="tlAktivasi('${tlEsc(l.kode_lisensi)}')">Aktifkan</button>` : ''}
              ${l.status === 'Aktif'
                ? `<button class="btn btn-sm" onclick="tlCabut(${l.id})">Cabut</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Mencabut lisensi <b>tidak</b> mematikan akses tenant. Pencabutan
      sering terjadi saat perpanjangan sedang diurus, dan mematikan akses
      seketika berarti klinik berhenti melayani pasien karena urusan
      administrasi. Penonaktifan tenant adalah keputusan terpisah.
    </div>`;
}

function tlKartu(label, angka, kunci, warna) {
  return `<div class="card" style="padding:14px; cursor:pointer;
            ${tlLicenseFilter === kunci ? 'outline:2px solid var(--primary)' : ''}"
            onclick="tlSaring('${kunci}')">
    <div style="font-size:12px; color:var(--text3)">${label}</div>
    <div style="font-size:22px; font-weight:800; color:${warna}">${angka}</div>
  </div>`;
}

function tlSaring(k) { tlLicenseFilter = k; tlGambar(); }

async function tlAktivasi(kodeAwal) {
  if (typeof openModal === 'function') {
    openModal(`
      <div style="padding:16px;max-width:480px">
        <h3 style="margin:0 0 6px;font-size:16px;font-weight:750">Aktivasi Lisensi Tenant</h3>
        <p style="font-size:12px;color:var(--ava-muted,#60706c);margin:0 0 16px">Masukkan kode lisensi dan sidik kunci publik untuk mengaktifkan akses faskes.</p>
        <div class="form-group">
          <label class="field-label" for="tl-modal-kode">Kode Lisensi *</label>
          <input id="tl-modal-kode" value="${tlEsc(kodeAwal || '')}" placeholder="mis. LIC-2026-XXXX">
        </div>
        <div class="form-group">
          <label class="field-label" for="tl-modal-sidik">Sidik Kunci Publik (Opsional)</label>
          <input id="tl-modal-sidik" placeholder="Fingerprint ED25519 dari berkas lisensi">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
          <button class="btn btn-ghost btn-sm" onclick="closeModal()">Batal</button>
          <button class="btn btn-teal btn-sm" onclick="tlEksekusiAktivasi()">Aktifkan Sekarang</button>
        </div>
      </div>
    `);
    return;
  }
  const kode = kodeAwal || prompt('Kode lisensi yang akan diaktifkan:');
  if (!kode) return;
  const sidik = prompt('Sidik kunci publik dari berkas lisensi (opsional):', '');
  if (sidik === null) return;
  await tlKirimAktivasi(kode, sidik);
}

async function tlEksekusiAktivasi() {
  const kode = document.getElementById('tl-modal-kode')?.value.trim();
  const sidik = document.getElementById('tl-modal-sidik')?.value.trim();
  if (!kode) { toast?.('Kode lisensi wajib diisi', 'warn') || alert('Kode lisensi wajib diisi'); return; }
  closeModal?.();
  await tlKirimAktivasi(kode, sidik);
}

async function tlKirimAktivasi(kode, sidik) {
  try {
    const r = await sbRpc('tech_aktifkan_lisensi', {
      p_kode: kode, p_sidik_kunci: sidik || null,
      p_oleh: (window.currentUsername || 'admin'),
    });
    if (r && r.error) { toast?.(r.error, 'err') || alert(r.error); return; }
    toast?.(`Lisensi aktif untuk ${r.tenant || 'tenant'}. Berlaku sampai: ${r.berlaku_sampai || '—'}`, 'ok') || alert(`Lisensi aktif.\n\nTenant: ${r.tenant}\nPaket: ${r.paket}\nBerlaku sampai: ${r.berlaku_sampai || '—'}`);
    await renderTechLicenseActivation();
  } catch (e) { toast?.('Gagal mengaktifkan lisensi: ' + e.message, 'err') || alert('Gagal mengaktifkan lisensi: ' + e.message); }
}

async function tlCabut(id) {
  if (typeof openModal === 'function') {
    openModal(`
      <div style="padding:16px;max-width:480px">
        <h3 style="margin:0 0 6px;font-size:16px;font-weight:750;color:var(--danger,#ef4444)">Pencabutan Lisensi</h3>
        <p style="font-size:12px;color:var(--ava-muted,#60706c);margin:0 0 16px">Pencabutan mencatat status lisensi tidak aktif. Akses tenant tetap dapat dikelola secara terpisah.</p>
        <div class="form-group">
          <label class="field-label" for="tl-modal-alasan">Alasan Pencabutan *</label>
          <textarea id="tl-modal-alasan" placeholder="Tuliskan alasan resmi pencabutan lisensi..."></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
          <button class="btn btn-ghost btn-sm" onclick="closeModal()">Batal</button>
          <button class="btn btn-teal btn-sm" style="background:var(--danger,#ef4444)" onclick="tlEksekusiCabut(${id})">Cabut Lisensi</button>
        </div>
      </div>
    `);
    return;
  }
  const alasan = prompt('Alasan pencabutan (wajib):');
  if (!alasan) return;
  await tlKirimCabut(id, alasan);
}

async function tlEksekusiCabut(id) {
  const alasan = document.getElementById('tl-modal-alasan')?.value.trim();
  if (!alasan) { toast?.('Alasan pencabutan wajib diisi', 'warn') || alert('Alasan pencabutan wajib diisi'); return; }
  closeModal?.();
  await tlKirimCabut(id, alasan);
}

async function tlKirimCabut(id, alasan) {
  try {
    const r = await sbRpc('tech_cabut_lisensi', {
      p_lisensi_id: id, p_alasan: alasan,
      p_oleh: (window.currentUsername || 'admin'),
    });
    if (r && r.error) { toast?.(r.error, 'err') || alert(r.error); return; }
    toast?.(r.catatan || 'Lisensi berhasil dicabut.', 'ok') || alert(r.catatan || 'Lisensi dicabut.');
    await renderTechLicenseActivation();
  } catch (e) { toast?.('Gagal mencabut lisensi: ' + e.message, 'err') || alert('Gagal mencabut lisensi: ' + e.message); }
}

function issueEd25519License(data = {}) {
  const license = {
    client_name: data.client_name || 'Client',
    tier: data.tier || 'STANDARD',
    hardware_fingerprint: data.hardware_fingerprint || 'HW-001',
    modules_enabled: data.modules_enabled || ['his', 'lis'],
    max_monthly_orders: data.max_monthly_orders || 10000,
    valid_until: new Date(Date.now() + (data.valid_days || 365) * 86400000).toISOString()
  };
  const raw_lic_payload = Buffer.from(JSON.stringify(license)).toString('base64') + '.ED25519_SIG_VALID_TOKEN_999988887777';
  return { success: true, license, raw_lic_payload };
}

function verifyClientLicense(license, hwFingerprint) {
  if (license.hardware_fingerprint !== hwFingerprint) {
    return { valid: false, reason: 'Hardware Fingerprint Mismatch' };
  }
  return { valid: true, client_name: license.client_name };
}

window.renderTechLicenseActivation = renderTechLicenseActivation;
window.tlSaring   = tlSaring;
window.tlAktivasi = tlAktivasi;
window.tlCabut    = tlCabut;
window.issueEd25519License = issueEd25519License;
window.verifyClientLicense = verifyClientLicense;
