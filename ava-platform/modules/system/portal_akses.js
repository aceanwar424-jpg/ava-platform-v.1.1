// ═══════════════════════════════════════════════════════════════
// MODULE: Akses Portal (kelola tautan bertoken pihak luar)
//
// Portal klien korporat tidak ada gunanya tanpa cara membuat tautannya.
// Layar ini tempat staf membuat, memantau, dan MENCABUT akses itu.
//
// ── Yang sengaja ditampilkan apa adanya ──────────────────────
// Token hanya diperlihatkan SEKALI, saat dibuat. Sesudah itu daftar hanya
// menampilkan potongannya. Menyimpan token dalam bentuk yang bisa dilihat
// ulang kapan saja membuat layar ini sendiri menjadi tempat kebocoran —
// cukup satu orang membuka daftar untuk mendapat akses ke semua klien.
//
// Pencabutan bersifat langsung: token nonaktif ditolak pada permintaan
// berikutnya, tanpa menunggu masa berlaku habis.
//
// Prefiks "pak" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let pakDaftar = [];
let pakKorporat = [];
let pakPerujuk = [];

const pakTgl = (d) => d ? new Date(d).toLocaleDateString('id-ID',
  { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

async function renderPortalAkses() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Akses Portal</h1>
        <p style="color:var(--text3);font-size:13px">
          Tautan bertoken untuk klien korporat dan dokter perujuk — hanya-baca, bisa dicabut, berbatas waktu</p></div>
      <div class="btn-row">
        <button class="btn btn-teal btn-sm" onclick="pakBuat()">+ Buat Tautan</button>
        <button class="btn btn-ghost btn-sm" onclick="renderPortalAkses()">Muat Ulang</button>
      </div>
    </div>
    <div id="pak-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await pakMuat();
  pakGambar();
}

async function pakMuat() {
  try {
    // Sengaja TIDAK meminta kolom token. Mesin menyensornya juga (lihat
    // KOLOM_RAHASIA di local-engine.js), tapi tidak memintanya sejak awal
    // membuat maksudnya jelas terbaca di sini: layar ini tidak berurusan
    // dengan token utuh, hanya penanda barisnya.
    pakDaftar = await sbGet('portal_akses',
      'select=id,jenis,ref_id,label,aktif,berlaku_sampai,created_at,terakhir_dipakai,jumlah_akses,token_petunjuk,boleh_tulis' +
      '&order=created_at.desc&limit=200') || [];
    if (!Array.isArray(pakDaftar)) pakDaftar = [];
  } catch (e) { pakDaftar = []; }
  try {
    pakKorporat = await sbGet('corporates', 'select=id,corporate_name,kode_corp&order=corporate_name&limit=300') || [];
    if (!Array.isArray(pakKorporat)) pakKorporat = [];
  } catch (e) { pakKorporat = []; }
  try {
    pakPerujuk = await sbGet('perujuk', 'select=id,nama,jenis&aktif=eq.true&order=nama&limit=300') || [];
    if (!Array.isArray(pakPerujuk)) pakPerujuk = [];
  } catch (e) { pakPerujuk = []; }
}

function pakGambar() {
  const el = document.getElementById('pak-isi');
  if (!el) return;

  const aktif = pakDaftar.filter(a => a.aktif &&
    (!a.berlaku_sampai || new Date(a.berlaku_sampai) >= new Date()));

  el.innerHTML = `
    <div class="card" style="padding:12px 15px;margin-bottom:14px;font-size:12.5px;line-height:1.6;
         background:var(--warn-soft);border-color:var(--gold)">
      <strong>Tautan ini setara kunci.</strong> Siapa pun yang memilikinya dapat melihat data
      perusahaan atau perujuk yang bersangkutan tanpa perlu masuk. Kirim hanya kepada pihak yang berhak,
      dan cabut segera begitu kerja sama berakhir atau PIC berganti.
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center">
        <strong style="font-size:13px">Tautan terdaftar</strong>
        <span style="font-size:11.5px;color:var(--text3)">${aktif.length} aktif dari ${pakDaftar.length}</span>
      </div>
      ${pakDaftar.length ? `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="color:var(--text3);text-align:left">
            <th style="padding:9px 16px">Tujuan</th><th>Jenis</th><th>Token</th><th>Berlaku s/d</th>
            <th>Dipakai</th><th>Akses</th><th>Status</th><th style="padding-right:16px">Aksi</th></tr></thead>
          <tbody>${pakDaftar.map(a => {
            const lewat = a.berlaku_sampai && new Date(a.berlaku_sampai) < new Date();
            const hidup = a.aktif && !lewat;
            return `<tr style="border-top:1px solid var(--border)">
              <td style="padding:9px 16px">${a.label || '(tanpa label)'}</td>
              <td><span class="badge" style="font-size:10.5px">${
                a.jenis === 'perujuk' ? 'perujuk' : 'korporat'}</span></td>
              <td style="font-family:monospace;color:var(--text3)">${a.token_petunjuk || '—'}</td>
              <td style="color:${lewat ? 'var(--danger-strong)' : 'inherit'}">${pakTgl(a.berlaku_sampai)}</td>
              <td>${a.jumlah_akses || 0}×
                ${a.terakhir_dipakai ? `<span style="color:var(--text3);font-size:11px">
                  · ${pakTgl(a.terakhir_dipakai)}</span>` : ''}</td>
              <td>${a.jenis === 'korporat'
                ? `<span class="badge" style="font-size:10.5px;color:${
                     a.boleh_tulis ? 'var(--warn-strong,#B45309)' : 'var(--text3)'}">
                     ${a.boleh_tulis ? 'kelola roster' : 'hanya baca'}</span>`
                : `<span style="color:var(--text3);font-size:11px">hanya baca</span>`}</td>
              <td><span class="badge" style="color:${hidup ? 'var(--success-strong)' : 'var(--text3)'}">
                ${!a.aktif ? 'dicabut' : lewat ? 'kedaluwarsa' : 'aktif'}</span></td>
              <td style="padding-right:16px;white-space:nowrap">
                ${hidup && a.jenis === 'korporat'
                  ? `<button class="btn btn-ghost btn-sm" onclick="pakSetTulis(${a.id}, ${!a.boleh_tulis})">${
                       a.boleh_tulis ? 'Jadikan Baca Saja' : 'Izinkan Kelola'}</button>` : ''}
                ${hidup ? `<button class="btn btn-ghost btn-sm" onclick="pakCabut(${a.id})">Cabut</button>` : ''}
              </td></tr>`; }).join('')}
          </tbody></table></div>`
        : `<div style="padding:24px;text-align:center;color:var(--text3);font-size:12.5px">
             Belum ada tautan portal. Klik "+ Buat Tautan" untuk membuat yang pertama.</div>`}
    </div>`;
}

// Dua jenis portal, satu mekanisme token. Halaman tujuan dan daftar pilihan
// berbeda, tetapi pembuatan, pencabutan, masa berlaku, dan pembatasan
// percobaan persis sama — cakupannya sama-sama ditentukan server dari token.
const PAK_JENIS = {
  korporat: { label: 'Klien korporat', halaman: 'portal_korporat.html',
              kosong: 'Belum ada data perusahaan korporat. Tambahkan lebih dulu di Corporate Management.' },
  perujuk:  { label: 'Dokter / klinik perujuk', halaman: 'portal_perujuk.html',
              kosong: 'Belum ada perujuk aktif. Tambahkan lebih dulu di menu Dokter & Klinik Perujuk.' },
};

function pakDaftarTujuan(jenis) {
  return jenis === 'perujuk'
    ? pakPerujuk.map(p => ({ id: p.id, teks: p.nama + (p.jenis ? ' (' + p.jenis + ')' : '') }))
    : pakKorporat.map(c => ({ id: c.id, teks: c.corporate_name + (c.kode_corp ? ' (' + c.kode_corp + ')' : '') }));
}

function pakGantiJenis() {
  const jenis = document.getElementById('pak-jenis')?.value || 'korporat';
  const sel = document.getElementById('pak-corp');
  if (!sel) return;
  const daftar = pakDaftarTujuan(jenis);
  sel.innerHTML = daftar.length
    ? daftar.map(d => `<option value="${d.id}">${d.teks}</option>`).join('')
    : `<option value="">— ${PAK_JENIS[jenis].kosong} —</option>`;

  // Perujuk tidak punya roster karyawan untuk dikelola. Pilihannya
  // disembunyikan, bukan sekadar diabaikan diam-diam saat disimpan.
  const kotak = document.getElementById('pak-tulis-kotak');
  if (kotak) {
    kotak.style.display = jenis === 'korporat' ? '' : 'none';
    if (jenis !== 'korporat') document.getElementById('pak-tulis').checked = false;
  }
}

function pakBuat() {
  if (!pakKorporat.length && !pakPerujuk.length) {
    toast('Belum ada perusahaan korporat maupun perujuk aktif untuk dibuatkan tautan.', 'warn');
    return;
  }
  openModal(`
    <h3 style="margin:0 0 4px">Buat Tautan Portal</h3>
    <p style="font-size:12px;color:var(--text3);margin:0 0 14px">
      Tautan hanya-baca untuk pihak luar. Token akan ditampilkan sekali saja.</p>
    <div class="input-group"><label>Jenis portal</label>
      <select id="pak-jenis" onchange="pakGantiJenis()">
        ${Object.entries(PAK_JENIS).map(([k, v]) =>
          `<option value="${k}">${v.label}</option>`).join('')}
      </select></div>
    <div class="input-group"><label>Tujuan</label>
      <select id="pak-corp">${pakDaftarTujuan('korporat').map(d =>
        `<option value="${d.id}">${d.teks}</option>`).join('')}</select></div>
    <div class="input-group"><label>Masa berlaku</label>
      <select id="pak-hari">
        <option value="30">30 hari</option>
        <option value="90">90 hari</option>
        <option value="180" selected>180 hari</option>
        <option value="365">1 tahun</option>
      </select></div>
    <div class="input-group" id="pak-tulis-kotak">
      <label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer;font-weight:400">
        <input type="checkbox" id="pak-tulis" style="margin-top:3px;width:15px;height:15px;flex-shrink:0">
        <span><b>Izinkan klien mengelola roster karyawannya sendiri</b>
          <span style="display:block;font-size:11.5px;color:var(--text3);line-height:1.55;margin-top:3px">
            PIC dapat menambah, mengimpor, dan menetapkan paket MCU untuk karyawannya.
            Hasil pemeriksaan tetap tidak dapat dilihat. Bisa dimatikan kapan saja.</span></span>
      </label></div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-close" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-primary" style="margin-top:0" onclick="pakSimpan()">Buat Tautan</button>
    </div>`);
}

async function pakSimpan() {
  const jenis = document.getElementById('pak-jenis')?.value || 'korporat';
  const sel = document.getElementById('pak-corp');
  const id = parseInt(sel?.value, 10);
  const label = sel?.options[sel.selectedIndex]?.text || '';
  const hari = parseInt(document.getElementById('pak-hari')?.value, 10) || 180;
  const bolehTulis = jenis === 'korporat' && !!document.getElementById('pak-tulis')?.checked;
  if (!id) { toast('Pilih tujuan tautan lebih dulu', 'warn'); return; }
  try {
    const r = await sbRpc('portal_akses_buat', {
      p_jenis: jenis, p_ref_id: id, p_label: label, p_hari: hari, p_boleh_tulis: bolehTulis });
    if (!r || !r.ok || !r.token) { toast('Gagal membuat tautan', 'err'); return; }

    const halaman = (PAK_JENIS[jenis] || PAK_JENIS.korporat).halaman;
    const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}${halaman}?t=${r.token}`;
    openModal(`
      <h3 style="margin:0 0 4px">Tautan siap dikirim</h3>
      <p style="font-size:12px;color:var(--text3);margin:0 0 12px">
        <b>Salin sekarang.</b> Demi keamanan, token tidak ditampilkan lagi sesudah jendela ini ditutup.</p>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:11px;
           font-family:monospace;font-size:11.5px;word-break:break-all;margin-bottom:12px"
           id="pak-url">${url}</div>
      <div style="font-size:11.5px;color:var(--text3);line-height:1.6;margin-bottom:14px">
        Berlaku ${hari} hari untuk <b>${label}</b>. Bisa dicabut kapan saja dari daftar.<br>
        Akses: <b>${r.boleh_tulis ? 'kelola roster karyawan' : 'hanya melihat data'}</b>.
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-close" onclick="closeModalForce();renderPortalAkses()">Tutup</button>
        <button class="btn btn-primary" style="margin-top:0" onclick="pakSalin()">Salin Tautan</button>
      </div>`);
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

function pakSalin() {
  const t = document.getElementById('pak-url')?.textContent || '';
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(
    () => toast('Tautan disalin', 'ok'), () => toast('Salin manual dari kotak di atas', 'warn'));
  else toast('Salin manual dari kotak di atas', 'warn');
}

async function pakCabut(id) {
  if (!confirm('Cabut tautan ini? PIC yang memegangnya langsung kehilangan akses.')) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_akses?id=eq.${id}`, {
      method: 'PATCH', headers: SB_HEADERS, body: JSON.stringify({ aktif: false }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    toast('Tautan dicabut', 'ok');
    await pakMuat(); pakGambar();
  } catch (e) { toast('Gagal mencabut: ' + e.message, 'err'); }
}

// Menyalakan/mematikan izin kelola roster pada tautan yang sudah beredar.
// Lewat RPC, bukan PATCH langsung ke tabel: kolom ini menentukan apakah
// pihak luar boleh menulis ke basis data, dan keputusan itu tidak pantas
// bergantung pada kebijakan RLS yang bisa berubah tanpa disadari.
async function pakSetTulis(id, boleh) {
  const tanya = boleh
    ? 'Izinkan klien ini menambah dan mengelola roster karyawannya sendiri?'
    : 'Kembalikan tautan ini menjadi hanya-baca? Klien tidak lagi bisa mengubah roster.';
  if (!confirm(tanya)) return;
  try {
    const r = await sbRpc('portal_akses_set_tulis', { p_id: id, p_boleh: boleh });
    if (!r || r.error) { toast(r?.error || 'Gagal mengubah akses', 'err'); return; }
    toast(boleh ? 'Klien kini dapat mengelola roster' : 'Tautan kembali hanya-baca', 'ok');
    await pakMuat(); pakGambar();
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

window.renderPortalAkses = renderPortalAkses;
window.pakSetTulis = pakSetTulis;
window.pakBuat = pakBuat;
window.pakGantiJenis = pakGantiJenis;
window.pakSimpan = pakSimpan;
window.pakSalin = pakSalin;
window.pakCabut = pakCabut;
