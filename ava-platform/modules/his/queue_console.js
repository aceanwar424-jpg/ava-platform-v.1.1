// ═══════════════════════════════════════════════════════════════
// MODULE: Konsol Panggilan Antrean — dijalankan dari dalam HIS
//
// Layar yang dipakai petugas loket sepanjang hari. Satu tombol besar
// untuk memanggil berikutnya, dan tombol pendamping untuk keadaan yang
// pasti terjadi tapi sering dilupakan sistem antrean: pasien tidak
// muncul, pasien datang terlambat, dan pasien harus pindah loket.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Nomor yang sedang dipanggil ditampilkan SANGAT besar. Petugas melihat
// layar ini sambil melayani pasien di depannya, bukan sambil membaca
// tabel — nomor kecil di dalam baris tabel akan salah dibaca.
//
// "Lewati" TIDAK menandai tiket selesai. Menandai selesai akan mencatat
// pelayanan yang tidak pernah terjadi, dan angka itu ikut ke laporan.
// Tiket yang dilewati bisa dipanggil kembali.
//
// Suara memakai Web Speech API bawaan peramban — tanpa berkas audio,
// tanpa layanan luar. Nomor dieja per huruf/angka ("A - nol - nol - tiga")
// karena "A3" terdengar seperti "A tiga puluh" di ruang tunggu yang ramai.
//
// Prefiks "qk".
// ═══════════════════════════════════════════════════════════════

let qkLoket = null;          // loket yang sedang dipilih petugas
let qkDaftarLoket = [];
let qkPapan = [];
let qkSekarang = null;       // tiket yang sedang dipanggil di loket ini
let qkTimer = null;

const QK_PRIORITAS = {
  cito:        { label: 'CITO',        warna: '#DC2626' },
  hamil:       { label: 'Ibu Hamil',   warna: '#DB2777' },
  disabilitas: { label: 'Disabilitas', warna: '#7C3AED' },
  lansia:      { label: 'Lansia',      warna: '#B45309' },
  normal:      { label: '',            warna: '' },
};

const qkEsc = (x) => String(x == null ? '' : x)
  .replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

const qkJam = (t) => t
  ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  : '—';

// ── Suara ────────────────────────────────────────────────────────
//
// Dieja satu per satu. "A003" dibaca "A, nol, nol, tiga" — bukan
// "A tiga", yang di ruang tunggu ramai tertukar dengan A13 atau A30.
function qkEja(nomor) {
  const angka = { '0':'nol','1':'satu','2':'dua','3':'tiga','4':'empat',
                  '5':'lima','6':'enam','7':'tujuh','8':'delapan','9':'sembilan' };
  return String(nomor || '').split('').map(c => angka[c] || c).join(', ');
}

function qkSuara(nomor, loket) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      `Nomor antrean, ${qkEja(nomor)}, silakan menuju ${loket}`);
    u.lang = 'id-ID';
    u.rate = 0.85;    // lebih lambat dari normal; ruang tunggu bergema
    u.pitch = 1;
    // Pakai suara Indonesia bila peramban punya; kalau tidak, biarkan
    // bawaan — memaksa suara Inggris membaca teks Indonesia justru
    // membuatnya lebih sulit dipahami.
    const id = window.speechSynthesis.getVoices().find(v => /^id/i.test(v.lang));
    if (id) u.voice = id;
    window.speechSynthesis.speak(u);
  } catch (e) { /* suara gagal tidak boleh menghentikan pemanggilan */ }
}

// ── Muat data ────────────────────────────────────────────────────
async function qkMuat() {
  try {
    qkDaftarLoket = await sbGet('queue_counters',
      'select=*&is_active=eq.true&order=urutan,nama') || [];
  } catch (e) { qkDaftarLoket = null; }

  try {
    qkPapan = await sbGet('queue_papan', 'select=*&order=bobot,seq') || [];
  } catch (e) { qkPapan = null; }
}

async function renderQueueConsole() {
  document.getElementById('main-content').innerHTML =
    '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await qkMuat();

  if (qkDaftarLoket === null || qkPapan === null) {
    document.getElementById('main-content').innerHTML = `
      <div class="page-header"><div><h1>Konsol Panggilan Antrean</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data antrean tidak dapat dibaca.</strong><br>
        Tabel <code>queue_counters</code> atau view <code>queue_papan</code> belum ada.
        Jalankan ulang aplikasi agar migrasi
        <code>0032_antrian_loket_prioritas_panggilan.sql</code> terpasang.
      </div>`;
    return;
  }

  if (!qkDaftarLoket.length) {
    document.getElementById('main-content').innerHTML = `
      <div class="page-header"><div><h1>Konsol Panggilan Antrean</h1></div></div>
      <div class="card" style="padding:24px; text-align:center">
        <div style="font-size:30px; opacity:.5; margin-bottom:8px">🎫</div>
        <div style="font-weight:700; margin-bottom:6px">Belum ada loket terdaftar</div>
        <p style="font-size:13px; color:var(--text3); max-width:460px; margin:0 auto 14px; line-height:1.7">
          Konsol ini memanggil antrean per loket. Daftarkan loket lebih dulu —
          nama, layanan yang dilayaninya, dan ruangnya.
        </p>
        <button class="btn btn-teal btn-sm" onclick="navigate('queue-config')">
          Buka Konfigurasi Antrean
        </button>
      </div>`;
    return;
  }

  if (!qkLoket) qkLoket = qkDaftarLoket[0].kode;
  qkGambar();
  qkMulaiSegar();
}

// Menyegarkan berkala supaya antrean yang diterbitkan kiosk muncul tanpa
// petugas menekan apa pun. Dihentikan saat pindah halaman — timer yang
// tertinggal terus menembak basis data sepanjang sesi.
function qkMulaiSegar() {
  qkHentiSegar();
  qkTimer = setInterval(async () => {
    if (!document.getElementById('qk-akar')) { qkHentiSegar(); return; }
    await qkMuat();
    qkGambarDaftar();
  }, 10000);
}
function qkHentiSegar() { if (qkTimer) { clearInterval(qkTimer); qkTimer = null; } }

function qkLoketAktif() {
  return qkDaftarLoket.find(l => l.kode === qkLoket) || qkDaftarLoket[0];
}

function qkGambar() {
  const L = qkLoketAktif();

  document.getElementById('main-content').innerHTML = `
    <div id="qk-akar">
      <div class="page-header">
        <div><h1>Konsol Panggilan Antrean</h1>
          <p style="color:var(--text3);font-size:13px">
            Memanggil antrean untuk layanan <b>${qkEsc(L.layanan)}</b></p></div>
        <div class="btn-row">
          <select class="input" id="qk-pilih-loket" onchange="qkGantiLoket(this.value)"
            style="padding:7px 11px;font-size:13px;font-weight:700">
            ${qkDaftarLoket.map(l => `<option value="${qkEsc(l.kode)}" ${l.kode === qkLoket ? 'selected' : ''}>
              ${qkEsc(l.nama)}${l.ruang ? ' — ' + qkEsc(l.ruang) : ''}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" onclick="navigate('queue-config')">Konfigurasi</button>
          <button class="btn btn-ghost btn-sm" onclick="window.open('monitor/antrian.html','_blank')">Layar TV</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1.15fr 1fr; gap:18px; align-items:start">
        <div id="qk-panel"></div>
        <div id="qk-daftar"></div>
      </div>
    </div>`;

  qkGambarPanel();
  qkGambarDaftar();
}

function qkGambarPanel() {
  const el = document.getElementById('qk-panel');
  if (!el) return;
  const L = qkLoketAktif();
  const t = qkSekarang;
  const pr = t ? (QK_PRIORITAS[t.prioritas] || QK_PRIORITAS.normal) : null;

  el.innerHTML = `
    <div class="card" style="padding:0; overflow:hidden">
      <div style="background:linear-gradient(135deg,#0A2342,#16324F); color:#fff;
                  padding:26px 22px; text-align:center">
        <div style="font-size:11px; font-weight:800; letter-spacing:.08em;
                    text-transform:uppercase; color:#9DB4D0">
          ${t ? 'Sedang Dipanggil' : 'Belum Ada Panggilan'} &bull; ${qkEsc(L.nama)}
        </div>

        <div style="font-size:${t ? '68px' : '34px'}; font-weight:800; line-height:1.15;
                    margin:10px 0 4px; letter-spacing:-.02em;
                    color:${t ? '#FDE047' : '#4A5F7A'}">
          ${t ? qkEsc(t.nomor) : '—'}
        </div>

        <div style="font-size:15px; font-weight:600; color:#E2E8F0; min-height:22px">
          ${t ? qkEsc(t.pasien || 'Tanpa nama') : 'Tekan Panggil Berikutnya'}
        </div>

        ${t && pr && pr.label ? `<div style="display:inline-block; margin-top:9px;
          background:${pr.warna}; color:#fff; font-size:11px; font-weight:800;
          padding:3px 12px; border-radius:999px">${pr.label}</div>` : ''}

        ${t && t.panggilan_ke > 1 ? `<div style="margin-top:8px; font-size:11.5px; color:#F5D77A">
          Panggilan ke-${t.panggilan_ke}</div>` : ''}
      </div>

      <div style="padding:16px">
        <button class="btn btn-teal" onclick="qkPanggilBerikutnya()"
          style="width:100%; padding:15px; font-size:15px; font-weight:800; margin-bottom:10px">
          Panggil Berikutnya
        </button>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="qkPanggilUlang()" ${t ? '' : 'disabled'}>
            Panggil Ulang
          </button>
          <button class="btn btn-ghost btn-sm" onclick="qkLayani()" ${t ? '' : 'disabled'}>
            Mulai Dilayani
          </button>
          <button class="btn btn-ghost btn-sm" onclick="qkLewati()" ${t ? '' : 'disabled'}>
            Tidak Hadir
          </button>
          <button class="btn btn-ghost btn-sm" onclick="qkFormPindah()" ${t ? '' : 'disabled'}>
            Pindah Loket
          </button>
        </div>

        <button class="btn btn-ghost btn-sm" onclick="qkSelesai()" ${t ? '' : 'disabled'}
          style="width:100%; margin-top:8px">Selesai Dilayani</button>

        <p style="font-size:11.5px; color:var(--text3); line-height:1.6; margin:12px 0 0">
          <b>Tidak Hadir</b> tidak menutup tiket &mdash; pasien yang datang terlambat
          masih bisa dipanggil kembali dari daftar di sebelah.
        </p>
      </div>
    </div>`;
}

function qkGambarDaftar() {
  const el = document.getElementById('qk-daftar');
  if (!el) return;
  const L = qkLoketAktif();

  const milikku  = (qkPapan || []).filter(t => t.service_type === L.layanan);
  const menunggu = milikku.filter(t => t.status === 'Menunggu');
  const lewat    = milikku.filter(t => t.status === 'Lewat');
  const selesai  = milikku.filter(t => ['Selesai', 'Dilayani'].includes(t.status));

  const baris = (t, aksi) => {
    const pr = QK_PRIORITAS[t.prioritas] || QK_PRIORITAS.normal;
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:8px 12px; font-weight:800; font-family:ui-monospace,monospace">
        ${qkEsc(t.queue_number)}</td>
      <td style="padding:8px 12px">
        <div>${qkEsc(t.patient_name || '—')}</div>
        ${pr.label ? `<span style="font-size:10px; font-weight:800; color:${pr.warna}">${pr.label}</span>` : ''}
      </td>
      <td style="padding:8px 12px; font-size:11.5px; color:var(--text3); white-space:nowrap">
        ${qkJam(t.called_at || t.served_at)}</td>
      <td style="padding:8px 12px; text-align:right; white-space:nowrap">${aksi(t)}</td>
    </tr>`;
  };

  el.innerHTML = `
    <div class="card" style="padding:0; overflow:hidden; margin-bottom:14px">
      <div style="padding:12px 16px; border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:center">
        <strong style="font-size:13px">Menunggu</strong>
        <span class="badge" style="font-size:10.5px">${menunggu.length}</span>
      </div>
      ${menunggu.length ? `<div style="max-height:300px; overflow:auto"><table style="width:100%; border-collapse:collapse; font-size:12.5px">
        <tbody>${menunggu.map(t => baris(t, () => '')).join('')}</tbody></table></div>`
        : `<div style="padding:22px; text-align:center; color:var(--text3); font-size:12.5px">
             Tidak ada antrean menunggu.</div>`}
    </div>

    ${lewat.length ? `<div class="card" style="padding:0; overflow:hidden; margin-bottom:14px">
      <div style="padding:12px 16px; border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:center">
        <strong style="font-size:13px">Tidak Hadir</strong>
        <span class="badge" style="font-size:10.5px; color:var(--warn-deeper)">${lewat.length}</span>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:12.5px"><tbody>
        ${lewat.map(t => baris(t, x =>
          `<button class="btn btn-ghost btn-sm" onclick="qkKembalikan(${x.id})">Panggil Lagi</button>`)).join('')}
      </tbody></table>
    </div>` : ''}

    <div class="card" style="padding:12px 16px; font-size:12px; color:var(--text3)">
      Selesai hari ini: <b style="color:var(--text)">${selesai.length}</b> &bull;
      Total antrean ${qkEsc(L.layanan)}: <b style="color:var(--text)">${milikku.length}</b>
    </div>`;
}

// ── Tindakan ─────────────────────────────────────────────────────
function qkGantiLoket(kode) {
  qkLoket = kode;
  qkSekarang = null;      // tiket milik loket sebelumnya, bukan loket ini
  qkGambar();
}

async function qkPanggilBerikutnya() {
  const L = qkLoketAktif();
  try {
    const r = await sbRpc('queue_panggil_berikutnya', {
      p_counter_kode: L.kode,
      p_oleh: (typeof getUserName === 'function' ? getUserName() : null),
    });
    if (r?.error)  { toast(r.error, 'err'); return; }
    if (r?.kosong) { toast(r.pesan, 'warn'); qkSekarang = null; qkGambarPanel(); return; }

    qkSekarang = r;
    qkSuara(r.nomor, r.loket + (r.ruang ? ', ' + r.ruang : ''));
    await qkMuat();
    qkGambarPanel();
    qkGambarDaftar();
  } catch (e) { toast('Gagal memanggil: ' + e.message, 'err'); }
}

async function qkPanggilUlang() {
  if (!qkSekarang) return;
  try {
    const r = await sbRpc('queue_panggil_ulang', {
      p_id: qkSekarang.id,
      p_oleh: (typeof getUserName === 'function' ? getUserName() : null),
    });
    if (r?.error) { toast(r.error, 'err'); return; }
    qkSekarang.panggilan_ke = r.panggilan_ke;
    qkSuara(r.nomor, r.loket || qkLoketAktif().nama);
    qkGambarPanel();
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

async function qkLewati() {
  if (!qkSekarang) return;
  const alasan = prompt('Alasan tidak hadir (boleh dikosongkan):', '') ?? null;
  try {
    const r = await sbRpc('queue_lewati', {
      p_id: qkSekarang.id, p_alasan: alasan || null,
      p_oleh: (typeof getUserName === 'function' ? getUserName() : null),
    });
    if (r?.error) { toast(r.error, 'err'); return; }
    toast(`${r.nomor} ditandai tidak hadir`, 'ok');
    qkSekarang = null;
    await qkMuat(); qkGambarPanel(); qkGambarDaftar();
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

async function qkKembalikan(id) {
  try {
    const r = await sbRpc('queue_kembalikan', {
      p_id: id, p_oleh: (typeof getUserName === 'function' ? getUserName() : null),
    });
    if (r?.error) { toast(r.error, 'err'); return; }
    toast(`${r.nomor} dikembalikan ke antrean`, 'ok');
    await qkMuat(); qkGambarDaftar();
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

async function qkUbahStatus(status, pesan) {
  if (!qkSekarang) return;
  try {
    await sbPatch('queue_tickets', qkSekarang.id, {
      status,
      served_at: status === 'Dilayani' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    });
    toast(pesan, 'ok');
    if (status === 'Selesai') qkSekarang = null;
    await qkMuat(); qkGambarPanel(); qkGambarDaftar();
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

const qkLayani  = () => qkUbahStatus('Dilayani', 'Ditandai sedang dilayani');
const qkSelesai = () => qkUbahStatus('Selesai',  'Ditandai selesai dilayani');

function qkFormPindah() {
  if (!qkSekarang) return;
  const lain = qkDaftarLoket.filter(l => l.kode !== qkLoket);
  if (!lain.length) { toast('Tidak ada loket lain yang aktif', 'warn'); return; }

  openModal(`
    <h3 style="margin:0 0 4px">Pindahkan ${qkEsc(qkSekarang.nomor)}</h3>
    <p style="font-size:12px;color:var(--text3);margin:0 0 14px">
      Nomor antrean tidak berubah &mdash; pasien sudah memegang kertas dengan nomor itu.</p>
    <div class="input-group"><label>Loket tujuan</label>
      <select id="qk-tujuan">${lain.map(l =>
        `<option value="${qkEsc(l.kode)}">${qkEsc(l.nama)} — ${qkEsc(l.layanan)}</option>`).join('')}
      </select></div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-close" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-primary" style="margin-top:0" onclick="qkPindah()">Pindahkan</button>
    </div>`);
}

async function qkPindah() {
  const tujuan = document.getElementById('qk-tujuan')?.value;
  if (!tujuan || !qkSekarang) return;
  try {
    const r = await sbRpc('queue_pindah', {
      p_id: qkSekarang.id, p_counter_tujuan: tujuan,
      p_oleh: (typeof getUserName === 'function' ? getUserName() : null),
    });
    if (r?.error) { toast(r.error, 'err'); return; }
    toast(`${r.nomor} dipindah ke ${r.loket_baru}`, 'ok');
    closeModalForce();
    qkSekarang = null;
    await qkMuat(); qkGambarPanel(); qkGambarDaftar();
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

window.renderQueueConsole = renderQueueConsole;
window.qkGantiLoket = qkGantiLoket;
window.qkPanggilBerikutnya = qkPanggilBerikutnya;
window.qkPanggilUlang = qkPanggilUlang;
window.qkLewati = qkLewati;
window.qkKembalikan = qkKembalikan;
window.qkLayani = qkLayani;
window.qkSelesai = qkSelesai;
window.qkFormPindah = qkFormPindah;
window.qkPindah = qkPindah;
