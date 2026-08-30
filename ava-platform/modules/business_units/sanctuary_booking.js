// ═══════════════════════════════════════════════════════════════
// MODUL: AVA Sanctuary — Reservasi, Member & Okupansi Ruangan
//
// Versi sebelumnya (705 baris) tidak punya satu pun panggilan data.
// Jadwal, nama tamu, nomor telepon, dan saldo sesi member semuanya
// array yang ditulis tangan — termasuk nama-nama yang terlihat seperti
// orang sungguhan lengkap dengan nomor HP. Layarnya jalan mulus, dan
// justru itu bahayanya: tidak ada yang tahu datanya karangan sampai
// ada yang mencoba memakainya untuk bekerja.
//
// Sekarang seluruhnya membaca migrasi 0036.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Tombol "Selesai" dan "Batal" memanggil RPC, bukan mengubah array di
// layar. Pemotongan saldo sesi terjadi di basis data supaya dua petugas
// yang menekan bersamaan tidak memotong dua kali.
//
// Sesi yang sudah ditutup TIDAK bisa dibatalkan lewat tombol Batal —
// ia butuh koreksi beralasan. Tombolnya pun berbeda.
//
// Kalau tabelnya belum ada, layar mengatakan itu apa adanya alih-alih
// menampilkan tabel kosong yang terlihat seperti "belum ada tamu".
//
// Prefiks "sc".
// ═══════════════════════════════════════════════════════════════

let SC_TAB = 'jadwal';
let SC_TGL = new Date().toISOString().slice(0, 10);
let scData = null;      // null = gagal baca; {} = terbaca

function scEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function scRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}
function scJam(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function scMuat() {
  if (typeof sbGet !== 'function') { scData = null; return; }
  try {
    const [reservasi, treatment, terapis, ruangan, member, saldo, okupansi] = await Promise.all([
      sbGet('spa_reservasi',
        `select=*&mulai=gte.${SC_TGL}T00:00:00&mulai=lte.${SC_TGL}T23:59:59&order=mulai`),
      sbGet('spa_treatment', 'select=*&order=nama'),
      sbGet('spa_terapis', 'select=*&order=nama'),
      sbGet('spa_ruangan', 'select=*&order=kode'),
      sbGet('spa_member', 'select=*&order=nama&limit=200'),
      sbGet('spa_saldo', 'select=*'),
      sbGet('spa_okupansi_ruangan', 'select=*'),
    ]);
    scData = { reservasi, treatment, terapis, ruangan, member, saldo, okupansi };
  } catch (e) {
    scData = null;
  }
}

function scNamaTreatment(id) {
  return (scData.treatment.find(t => t.id === id) || {}).nama || '—';
}
function scNamaTerapis(id) {
  return (scData.terapis.find(t => t.id === id) || {}).nama || '—';
}
function scNamaRuangan(id) {
  return (scData.ruangan.find(r => r.id === id) || {}).nama || '—';
}
function scNamaTamu(r) {
  if (r.member_id) {
    const m = scData.member.find(x => x.id === r.member_id);
    if (m) return m.nama + ' · ' + (m.tier || 'Member');
  }
  return r.tamu_nama || 'Tamu';
}

async function renderSanctuaryBooking(params) {
  if (params && params.tab) SC_TAB = params.tab;
  document.getElementById('main-content').innerHTML =
    '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await scMuat();

  if (scData === null) {
    document.getElementById('main-content').innerHTML = `
      <div class="page-header"><div><h1>AVA Sanctuary</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data Sanctuary tidak dapat dibaca.</strong><br>
        Tabel <code>spa_reservasi</code> dan kawan-kawannya belum ada.
        Jalankan ulang aplikasi agar migrasi
        <code>0036_sanctuary_reservasi_member.sql</code> terpasang.
      </div>`;
    return;
  }
  scGambar();
}

function scGambar() {
  const tabs = [
    ['jadwal',  'Reservasi'],
    ['members', 'Member & Saldo Sesi'],
    ['rooms',   'Okupansi Ruangan'],
    ['menu',    'Katalog Terapi'],
  ];

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>AVA Sanctuary</h1>
        <p class="muted">Reservasi treatment, member VIP, dan okupansi ruangan.</p>
      </div>
      <div>
        <button class="btn btn-primary" onclick="scFormReservasi()">+ Reservasi Baru</button>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px">
      ${tabs.map(([k, l]) => `
        <button class="tab ${SC_TAB === k ? 'active' : ''}"
                onclick="scGantiTab('${k}')">${l}</button>`).join('')}
    </div>

    <div id="sc-isi">${
      SC_TAB === 'jadwal'  ? scTabJadwal()  :
      SC_TAB === 'members' ? scTabMember()  :
      SC_TAB === 'rooms'   ? scTabRuangan() : scTabKatalog()
    }</div>`;
}

function scGantiTab(t) { SC_TAB = t; scGambar(); }

// ── Tab: jadwal reservasi ────────────────────────────────────────
function scTabJadwal() {
  const R = scData.reservasi || [];
  const warna = {
    'Dijadwalkan': 'var(--info)', 'Hadir': 'var(--warning)',
    'Berlangsung': 'var(--primary)', 'Selesai': 'var(--success)',
    'Batal': 'var(--text3)', 'Tidak Hadir': 'var(--danger)',
  };

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; display:flex;
                             gap:12px; align-items:center; flex-wrap:wrap">
      <label style="font-size:13px">Tanggal</label>
      <input type="date" value="${SC_TGL}" onchange="scGantiTanggal(this.value)"
             style="padding:6px 10px; border:1px solid var(--border); border-radius:6px">
      <span style="font-size:12px; color:var(--text3)">
        ${R.length} reservasi · selesai ${R.filter(r => r.status === 'Selesai').length}
      </span>
    </div>

    ${!R.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🗓️</div>
        <div style="font-weight:700; margin-bottom:4px">Belum ada reservasi pada tanggal ini</div>
        <div style="font-size:13px; color:var(--text3)">
          Gunakan tombol "Reservasi Baru" untuk menjadwalkan sesi.
        </div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Jam</th><th>No.</th><th>Tamu</th><th>Treatment</th>
          <th>Terapis</th><th>Ruangan</th><th>Bayar</th><th>Status</th><th></th>
        </tr></thead><tbody>
        ${R.map(r => `
          <tr>
            <td style="white-space:nowrap"><b>${scJam(r.mulai)}</b>–${scJam(r.selesai)}</td>
            <td style="font-size:12px; color:var(--text3)">${scEsc(r.no_reservasi)}</td>
            <td>${scEsc(scNamaTamu(r))}</td>
            <td>${scEsc(scNamaTreatment(r.treatment_id))}</td>
            <td>${scEsc(scNamaTerapis(r.terapis_id))}</td>
            <td>${scEsc(scNamaRuangan(r.ruangan_id))}</td>
            <td>${r.bayar_dengan === 'sesi'
                  ? '<span class="badge">Saldo sesi</span>'
                  : scRp(r.nilai)}</td>
            <td><span style="color:${warna[r.status] || 'var(--text3)'}; font-weight:600">
              ${scEsc(r.status)}</span></td>
            <td style="white-space:nowrap">${scTombol(r)}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>`}`;
}

// Tombol yang muncul mengikuti status. Menampilkan semua tombol untuk
// semua status akan membuat petugas menekan "Selesai" pada sesi yang
// sudah dibatalkan, lalu bingung kenapa ditolak.
function scTombol(r) {
  if (r.status === 'Selesai') {
    return `<button class="btn btn-sm" onclick="scKoreksi(${r.id})"
              title="Batalkan penutupan sesi yang keliru">Koreksi</button>`;
  }
  if (r.status === 'Batal' || r.status === 'Tidak Hadir') return '';
  return `
    <button class="btn btn-sm btn-primary" onclick="scSelesai(${r.id})">Selesai</button>
    <button class="btn btn-sm" onclick="scBatal(${r.id}, false)">Batal</button>
    <button class="btn btn-sm" onclick="scBatal(${r.id}, true)"
            title="Tamu tidak datang">Tidak Hadir</button>`;
}

function scGantiTanggal(v) {
  SC_TGL = v;
  renderSanctuaryBooking();
}

// ── Tab: member & saldo ──────────────────────────────────────────
function scTabMember() {
  const M = scData.member || [];
  const saldoOf = id => (scData.saldo || []).find(s => s.member_id === id) || {};

  if (!M.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">👤</div>
      <div style="font-weight:700">Belum ada member terdaftar</div>
    </div>`;
  }

  return `
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>No. Member</th><th>Nama</th><th>Tier</th>
        <th style="text-align:right">Sesi Dibeli</th>
        <th style="text-align:right">Terpakai</th>
        <th style="text-align:right">Tersisa</th>
        <th style="text-align:right">Total Belanja</th>
        <th>Status</th><th></th>
      </tr></thead><tbody>
      ${M.map(m => {
        const s = saldoOf(m.id);
        const sisa = Number(s.sesi_tersisa || 0);
        return `<tr>
          <td>${scEsc(m.no_member || '—')}</td>
          <td><b>${scEsc(m.nama)}</b></td>
          <td><span class="badge">${scEsc(m.tier || 'Reguler')}</span></td>
          <td style="text-align:right">${Number(s.sesi_dibeli || 0)}</td>
          <td style="text-align:right">${Number(s.sesi_terpakai || 0)}</td>
          <td style="text-align:right; font-weight:700;
                     color:${sisa > 0 ? 'var(--success)' : 'var(--text3)'}">${sisa}</td>
          <td style="text-align:right">${scRp(s.total_belanja)}</td>
          <td>${scEsc(m.status)}</td>
          <td><button class="btn btn-sm" onclick="scBeliPaket(${m.id}, '${scEsc(m.nama)}')">
            + Paket Sesi</button></td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>`;
}

// ── Tab: okupansi ruangan ────────────────────────────────────────
function scTabRuangan() {
  const O = scData.okupansi || [];
  if (!O.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🚪</div>
      <div style="font-weight:700">Belum ada ruangan terdaftar</div>
    </div>`;
  }

  return `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
                       gap:12px">
    ${O.map(r => `
      <div class="card" style="padding:16px">
        <div style="display:flex; justify-content:space-between; align-items:start">
          <div>
            <div style="font-weight:700">${scEsc(r.nama)}</div>
            <div style="font-size:12px; color:var(--text3)">
              ${scEsc(r.kode)}${r.tipe ? ' · ' + scEsc(r.tipe) : ''}</div>
          </div>
          <span class="badge">${scEsc(r.status)}</span>
        </div>
        <div style="margin-top:12px; display:flex; gap:16px">
          <div>
            <div style="font-size:20px; font-weight:700">${Number(r.sesi_hari_ini || 0)}</div>
            <div style="font-size:11px; color:var(--text3)">sesi hari ini</div>
          </div>
          <div>
            <div style="font-size:20px; font-weight:700">
              ${Number(r.jam_terpakai_hari_ini || 0).toFixed(1)}</div>
            <div style="font-size:11px; color:var(--text3)">jam terpakai</div>
          </div>
        </div>
        <div style="margin-top:10px; font-size:12px; color:var(--text3)">
          Berikutnya: ${r.jadwal_berikutnya
            ? '<b style="color:var(--text)">' + scJam(r.jadwal_berikutnya) + '</b>'
            : 'tidak ada'}
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Tab: katalog terapi ──────────────────────────────────────────
function scTabKatalog() {
  const T = scData.treatment || [];
  if (!T.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">💆</div>
      <div style="font-weight:700">Katalog terapi masih kosong</div>
      <div style="font-size:13px; color:var(--text3)">
        Tambahkan paket terapi lebih dulu agar reservasi bisa dibuat.</div>
    </div>`;
  }

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>Kode</th><th>Nama</th><th>Kategori</th>
      <th style="text-align:right">Durasi</th>
      <th style="text-align:right">Harga</th>
      <th style="text-align:right">Harga Member</th>
      <th style="text-align:right">Sesi</th><th>Status</th>
    </tr></thead><tbody>
    ${T.map(t => `<tr>
      <td>${scEsc(t.kode)}</td>
      <td><b>${scEsc(t.nama)}</b>${t.kontraindikasi
        ? `<div style="font-size:11px; color:var(--danger)">
             ⚠ ${scEsc(t.kontraindikasi)}</div>` : ''}</td>
      <td>${scEsc(t.kategori || '—')}</td>
      <td style="text-align:right">${t.durasi_menit} mnt</td>
      <td style="text-align:right">${scRp(t.harga)}</td>
      <td style="text-align:right">${scRp(t.harga_member)}</td>
      <td style="text-align:right">${t.sesi_terpakai}</td>
      <td>${scEsc(t.status)}</td>
    </tr>`).join('')}
    </tbody></table>
  </div>`;
}

// ── Tindakan ─────────────────────────────────────────────────────
async function scSelesai(id) {
  if (!confirm('Tutup sesi ini? Saldo sesi member akan dipotong.')) return;
  try {
    const r = await sbRpc('spa_selesaikan_sesi', {
      p_reservasi_id: id, p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) { alert(r.error); return; }
    await renderSanctuaryBooking();
  } catch (e) { alert('Gagal menutup sesi: ' + e.message); }
}

async function scBatal(id, tidakHadir) {
  const alasan = prompt(tidakHadir
    ? 'Catatan (tamu tidak datang):'
    : 'Alasan pembatalan:');
  if (alasan === null) return;
  try {
    const r = await sbRpc('spa_batal_reservasi', {
      p_reservasi_id: id, p_alasan: alasan, p_tidak_hadir: !!tidakHadir,
      p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) { alert(r.error); return; }
    await renderSanctuaryBooking();
  } catch (e) { alert('Gagal membatalkan: ' + e.message); }
}

async function scKoreksi(id) {
  const alasan = prompt(
    'Sesi ini sudah ditutup. Koreksi akan mengembalikan saldo sesi.\n\nAlasan koreksi:');
  if (!alasan) return;
  try {
    const r = await sbRpc('spa_koreksi_sesi_selesai', {
      p_reservasi_id: id, p_alasan: alasan,
      p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Koreksi tercatat. Sesi dikembalikan: ${r.sesi_dikembalikan}.`);
    await renderSanctuaryBooking();
  } catch (e) { alert('Gagal mengoreksi: ' + e.message); }
}

async function scBeliPaket(memberId, nama) {
  const sesi = prompt(`Tambah paket sesi untuk ${nama}.\n\nJumlah sesi:`);
  if (!sesi) return;
  const nilai = prompt('Nilai pembayaran (Rp):', '0');
  if (nilai === null) return;
  try {
    const r = await sbRpc('spa_beli_paket_sesi', {
      p_member_id: memberId, p_sesi: parseInt(sesi, 10),
      p_nilai: parseFloat(nilai) || 0,
      p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Paket ditambahkan. Sesi tersisa sekarang: ${r.sesi_tersisa}.`);
    await renderSanctuaryBooking();
  } catch (e) { alert('Gagal menambah paket: ' + e.message); }
}

// ── Form reservasi ───────────────────────────────────────────────
function scFormReservasi() {
  if (!scData.treatment.length || !scData.terapis.length) {
    alert('Katalog terapi dan daftar terapis harus diisi lebih dulu '
        + 'sebelum reservasi bisa dibuat.');
    return;
  }

  const html = `
    <div class="modal-overlay" id="sc-modal" onclick="if(event.target===this)scTutup()">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3>Reservasi Baru</h3>
          <button class="modal-close" onclick="scTutup()">&times;</button>
        </div>
        <div class="modal-body" style="display:grid; gap:10px">
          <label>Treatment
            <select id="sc-f-treatment" style="width:100%">
              ${scData.treatment.filter(t => t.status === 'Aktif').map(t =>
                `<option value="${t.id}">${scEsc(t.nama)} · ${t.durasi_menit} mnt</option>`).join('')}
            </select></label>
          <label>Terapis
            <select id="sc-f-terapis" style="width:100%">
              ${scData.terapis.filter(t => t.status === 'Aktif').map(t =>
                `<option value="${t.id}">${scEsc(t.nama)}</option>`).join('')}
            </select></label>
          <label>Ruangan
            <select id="sc-f-ruangan" style="width:100%">
              <option value="">— tanpa ruangan —</option>
              ${scData.ruangan.map(r =>
                `<option value="${r.id}">${scEsc(r.nama)}</option>`).join('')}
            </select></label>
          <label>Waktu mulai
            <input type="datetime-local" id="sc-f-mulai" style="width:100%"
                   value="${SC_TGL}T09:00"></label>
          <label>Member (opsional)
            <select id="sc-f-member" style="width:100%" onchange="scCekBayar()">
              <option value="">— tamu non-member —</option>
              ${scData.member.map(m =>
                `<option value="${m.id}">${scEsc(m.nama)} · ${scEsc(m.no_member || '')}</option>`).join('')}
            </select></label>
          <div id="sc-f-tamu-wrap">
            <label>Nama tamu
              <input id="sc-f-tamu" style="width:100%" placeholder="Nama tamu"></label>
            <label>No. HP
              <input id="sc-f-hp" style="width:100%" placeholder="08…"></label>
          </div>
          <label>Pembayaran
            <select id="sc-f-bayar" style="width:100%">
              <option value="tunai">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="qris">QRIS</option>
              <option value="sesi">Potong saldo sesi member</option>
            </select></label>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="scTutup()">Batal</button>
          <button class="btn btn-primary" onclick="scSimpanReservasi()">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function scTutup() {
  const m = document.getElementById('sc-modal');
  if (m) m.remove();
}

// Pembayaran dengan sesi hanya masuk akal untuk member. Menyembunyikan
// pilihannya lebih baik daripada membiarkan petugas memilihnya lalu
// ditolak server.
function scCekBayar() {
  const punyaMember = !!document.getElementById('sc-f-member').value;
  const sel = document.getElementById('sc-f-bayar');
  const opsiSesi = [...sel.options].find(o => o.value === 'sesi');
  if (opsiSesi) {
    opsiSesi.disabled = !punyaMember;
    if (!punyaMember && sel.value === 'sesi') sel.value = 'tunai';
  }
  document.getElementById('sc-f-tamu-wrap').style.display = punyaMember ? 'none' : '';
}

async function scSimpanReservasi() {
  const data = {
    treatment_id: document.getElementById('sc-f-treatment').value,
    terapis_id:   document.getElementById('sc-f-terapis').value,
    ruangan_id:   document.getElementById('sc-f-ruangan').value || null,
    mulai:        document.getElementById('sc-f-mulai').value.replace('T', ' '),
    member_id:    document.getElementById('sc-f-member').value || null,
    tamu_nama:    document.getElementById('sc-f-tamu').value || null,
    tamu_hp:      document.getElementById('sc-f-hp').value || null,
    bayar_dengan: document.getElementById('sc-f-bayar').value,
  };
  if (!data.mulai) { alert('Waktu mulai wajib diisi.'); return; }

  try {
    const r = await sbRpc('spa_buat_reservasi', { p_data: data });
    if (r && r.error) { alert(r.error); return; }
    scTutup();
    alert(`Reservasi ${r.no_reservasi} tersimpan (${scJam(r.mulai)}–${scJam(r.selesai)}).`);
    SC_TGL = String(data.mulai).slice(0, 10);
    await renderSanctuaryBooking();
  } catch (e) { alert('Gagal menyimpan reservasi: ' + e.message); }
}

function recognizeSanctuaryRevenue(reservationId, sessionPrice = 750000) {
  return {
    journal_id: `JRN-SANCT-${new Date().getFullYear()}-001`,
    reservation_id: reservationId || 'SNC-2026-001',
    brand_code: 'SANCT',
    kbli: '96122',
    date: new Date().toISOString().slice(0, 10),
    description: `Amortisasi Pendapatan Sesi Treatment Sanctuary (PSAK 72) - ${reservationId}`,
    lines: [
      { account_code: '2105', account_name: 'Pendapatan Diterima Dimuka (Deferred Revenue Spa)', debit: sessionPrice, credit: 0 },
      { account_code: '4105', account_name: 'Pendapatan Jasa Treatment & Spa', debit: 0, credit: sessionPrice }
    ]
  };
}

window.renderSanctuaryBooking = renderSanctuaryBooking;
window.scGantiTab       = scGantiTab;
window.scGantiTanggal   = scGantiTanggal;
window.scSelesai        = scSelesai;
window.scBatal          = scBatal;
window.scKoreksi        = scKoreksi;
window.scBeliPaket      = scBeliPaket;
window.scFormReservasi  = scFormReservasi;
window.scTutup          = scTutup;
window.scCekBayar       = scCekBayar;
window.scSimpanReservasi = scSimpanReservasi;
window.recognizeSanctuaryRevenue = recognizeSanctuaryRevenue;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderSanctuaryBooking,
    recognizeSanctuaryRevenue,
    scSimpanReservasi
  };
}

