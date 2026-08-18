// ═══════════════════════════════════════════════════════════════
// MODULE: Lisensi
//
// Menampilkan status lisensi instalasi ini dan sidik mesinnya.
//
// ── Yang sengaja TIDAK dilakukan layar ini ───────────────────
// Ia tidak mengunci apa pun. Aplikasi ini dipakai untuk melayani pasien;
// mengunci klinik dari rekam medisnya sendiri pada tanggal tertentu bukan
// penegakan lisensi, melainkan risiko keselamatan dan tanggung jawab hukum
// yang berpindah ke penyedia aplikasi.
//
// Yang dilakukannya: membuat status lisensi TERLIHAT — jauh sebelum
// berakhir, dan terus-menerus sesudahnya. Penagihan diselesaikan antar
// manusia, bukan dengan mematikan sistem operasional klinik.
//
// Keputusan itu bisa diubah, tetapi harus diubah dengan sengaja. Lihat
// catatan di ONELAB.md §5.
//
// Prefiks "lsn".
// ═══════════════════════════════════════════════════════════════

let lsnData = null;

const LSN_TAMPILAN = {
  'aktif':           { warna: 'var(--success-strong)', label: 'Aktif' },
  'segera-berakhir': { warna: 'var(--warn-deeper)',    label: 'Segera berakhir' },
  'kedaluwarsa':     { warna: 'var(--danger-strong)',  label: 'Kedaluwarsa' },
  'mesin-lain':      { warna: 'var(--danger-strong)',  label: 'Komputer lain' },
  'palsu':           { warna: 'var(--danger-strong)',  label: 'Tidak sah' },
  'rusak':           { warna: 'var(--danger-strong)',  label: 'Berkas rusak' },
  'tidak-ada':       { warna: 'var(--text3)',          label: 'Belum berlisensi' },
  'tidak-diperiksa': { warna: 'var(--text3)',          label: 'Tidak diperiksa' },
  'galat':           { warna: 'var(--danger-strong)',  label: 'Gagal diperiksa' },
};

async function renderLisensi() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Lisensi</h1>
        <p style="color:var(--text3);font-size:13px">
          Status lisensi instalasi ini dan sidik mesinnya</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderLisensi()">Periksa Ulang</button>
      </div>
    </div>
    <div id="lsn-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await lsnMuat();
  lsnGambar();
}

async function lsnMuat() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lisensi`, { headers: SB_HEADERS });
    lsnData = await res.json();
  } catch (e) {
    // Mode cloud tidak punya endpoint ini — dan itu bukan galat, karena
    // lisensi memang perkara instalasi desktop.
    lsnData = { status: 'tidak-diperiksa', sah: true, sidik_mesin: '',
      pesan: 'Instalasi ini dibuka lewat peramban, bukan aplikasi desktop. ' +
             'Lisensi hanya diperiksa pada instalasi desktop di komputer klinik.' };
  }
}

function lsnGambar() {
  const el = document.getElementById('lsn-isi');
  if (!el || !lsnData) return;

  const d = lsnData;
  const t = LSN_TAMPILAN[d.status] || LSN_TAMPILAN['galat'];
  const tgl = (x) => x ? new Date(x).toLocaleDateString('id-ID',
    { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  el.innerHTML = `
    <div class="card" style="padding:18px 20px;margin-bottom:14px">
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
        <span style="font-size:19px;font-weight:800;color:${t.warna}">${t.label}</span>
        ${d.pemegang ? `<span style="font-size:14px;color:var(--text2)">— ${d.pemegang}</span>` : ''}
      </div>
      ${d.pesan ? `<p style="font-size:12.5px;color:var(--text3);line-height:1.6;margin:8px 0 0">
        ${d.pesan}</p>` : ''}

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
           gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;
              letter-spacing:.05em">Edisi</div>
          <div style="font-size:14px;font-weight:700;margin-top:2px">${d.edisi || '—'}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;
              letter-spacing:.05em">Berlaku sampai</div>
          <div style="font-size:14px;font-weight:700;margin-top:2px">
            ${d.berlaku_sampai ? tgl(d.berlaku_sampai) : 'Tanpa batas waktu'}
            ${d.sisa_hari != null && d.sisa_hari >= 0
              ? `<span style="font-size:11.5px;color:var(--text3);font-weight:500">
                  · ${d.sisa_hari} hari lagi</span>` : ''}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;
              letter-spacing:.05em">Ikatan komputer</div>
          <div style="font-size:14px;font-weight:700;margin-top:2px">
            ${d.terikat_mesin ? 'Terikat komputer ini' : 'Tidak terikat'}</div></div>
      </div>
    </div>

    <div class="card" style="padding:16px 20px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">Sidik Mesin</div>
      <p style="font-size:12px;color:var(--text3);line-height:1.6;margin:0 0 10px">
        Kirimkan kode ini ke penyedia aplikasi saat meminta lisensi baru atau
        perpanjangan. Kode ini tidak memuat data pasien maupun isi basis data —
        hanya penanda komputer.</p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <code id="lsn-sidik" style="background:var(--bg2);border:1px solid var(--border);
              border-radius:8px;padding:9px 12px;font-size:13px;letter-spacing:.04em">
          ${d.sidik_mesin || '—'}</code>
        ${d.sidik_mesin ? `<button class="btn btn-ghost btn-sm" onclick="lsnSalinSidik()">Salin</button>` : ''}
      </div>
    </div>

    <div class="card" style="padding:14px 18px;font-size:12px;color:var(--text3);line-height:1.7">
      <b style="color:var(--text2)">Cara memasang berkas lisensi.</b>
      Simpan berkas yang dikirimkan penyedia dengan nama <code>lisensi.json</code>
      di folder data instalasi ini — sejajar dengan folder <code>pglite-data</code>.
      Setelah itu klik “Periksa Ulang”; aplikasi tidak perlu ditutup.
      <br><br>
      <b style="color:var(--text2)">Masa lisensi habis tidak mematikan aplikasi.</b>
      Layanan pasien tetap berjalan dan seluruh data tetap dapat diakses.
      Statusnya ditampilkan terus di layar ini sampai lisensi diperbarui.
    </div>`;
}

function lsnSalinSidik() {
  const t = document.getElementById('lsn-sidik')?.textContent?.trim() || '';
  if (!t || t === '—') return;
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(
    () => toast('Sidik mesin disalin', 'ok'),
    () => toast('Salin manual dari kotak di atas', 'warn'));
  else toast('Salin manual dari kotak di atas', 'warn');
}

window.renderLisensi = renderLisensi;
window.lsnSalinSidik = lsnSalinSidik;
