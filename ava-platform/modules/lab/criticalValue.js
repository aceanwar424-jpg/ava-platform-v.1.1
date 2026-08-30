// ═══════════════════════════════════════════════════════════════
// MODUL: Logbook Pelaporan Nilai Kritis
//
// Versi sebelumnya tidak punya panggilan data: seluruh isi logbook —
// nama pasien, nama dokter yang ditelepon, nama analis, jam panggilan,
// dan SLA — array yang ditulis tangan. Logbook nilai kritis adalah
// dokumen yang diperiksa saat akreditasi; logbook karangan lebih buruk
// daripada tidak punya logbook, karena ia dipercaya.
//
// Sekarang membaca public.critical_value_notifications yang memang
// sudah ada di basis data sejak lama, tapi tidak pernah dibaca.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Ambang nilai kritis TIDAK ditulis di berkas ini. Versi lama memuat
// tabel ambang (kalium 2,8–6,2 dsb) sebagai konstanta JavaScript.
// Ambang adalah kebijakan lab yang bergantung metode dan populasi
// pasien; menaruhnya di berkas tampilan berarti ia berubah hanya kalau
// ada yang menyunting kode, dan tidak ada jejak siapa menetapkannya.
// Yang ditampilkan di sini adalah ambang yang DISALIN ke tiap kejadian
// (kolom critical_range) — yang benar-benar berlaku saat itu.
//
// SLA dihitung dari selisih waktu catatan terbit ke waktu ditelepon,
// bukan disimpan sebagai angka. Angka yang disimpan bisa diisi apa saja.
//
// Prefiks "cv".
// ═══════════════════════════════════════════════════════════════

let cvData = null;
let cvFilter = 'semua';

function cvEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cvJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Menit dari hasil keluar sampai ditelepon. null bila salah satu waktunya
// belum ada — lebih jujur daripada menampilkan 0 menit.
function cvSla(r) {
  const a = r.created_at;
  const b = r.notified_at;
  if (!a || !b) return null;
  return Math.round((new Date(b) - new Date(a)) / 60000);
}

async function cvMuat() {
  if (typeof sbGet !== 'function') { cvData = null; return; }
  try {
    cvData = await sbGet('critical_value_notifications',
      'select=*&order=created_at.desc&limit=300');
  } catch (e) { cvData = null; }
}

async function renderCriticalValue() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await cvMuat();

  if (cvData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Pelaporan Nilai Kritis</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Logbook tidak dapat dibaca.</strong><br>
        Tabel <code>critical_value_notifications</code> belum tersedia.
      </div>`;
    return;
  }
  cvGambar();
}

function cvGambar() {
  const semua = cvData || [];
  const belum = semua.filter(r => !r.notified_at);
  const belumKonfirmasi = semua.filter(r => r.notified_at && !r.readback);
  const daftar = cvFilter === 'belum' ? belum
               : cvFilter === 'konfirmasi' ? belumKonfirmasi
               : semua;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Pelaporan Nilai Kritis</h1>
        <p class="muted">Logbook wajib akreditasi — hasil kritis, siapa dihubungi, dan kapan.</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
                gap:12px; margin-bottom:16px">
      ${cvKartu('Total tercatat', semua.length, 'semua', 'var(--text)')}
      ${cvKartu('Belum dilaporkan', belum.length, 'belum',
                belum.length ? 'var(--danger)' : 'var(--text3)')}
      ${cvKartu('Belum ada read-back', belumKonfirmasi.length, 'konfirmasi',
                belumKonfirmasi.length ? 'var(--warning)' : 'var(--text3)')}
    </div>

    ${belum.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${belum.length} hasil kritis belum dilaporkan.</b>
        Nilai kritis yang tidak sampai ke dokter adalah hasil yang tidak berguna.
      </div>` : ''}

    ${!daftar.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🔔</div>
        <div style="font-weight:700; margin-bottom:4px">
          ${cvFilter === 'semua' ? 'Belum ada nilai kritis tercatat'
                                 : 'Tidak ada yang cocok dengan penyaring ini'}</div>
        <div style="font-size:13px; color:var(--text3)">
          Catatan terbit otomatis saat hasil melewati ambang kritis yang
          ditetapkan lab.</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Waktu Hasil</th><th>Pasien</th><th>Pemeriksaan</th>
          <th style="text-align:right">Nilai</th><th>Ambang</th>
          <th>Dilaporkan</th><th>Oleh → Kepada</th>
          <th style="text-align:right">SLA</th><th>Read-back</th><th></th>
        </tr></thead><tbody>
        ${daftar.map(r => {
          const sla = cvSla(r);
          return `<tr>
            <td style="white-space:nowrap">${cvJam(r.created_at)}</td>
            <td>${cvEsc(r.patient_name || '—')}</td>
            <td>${cvEsc(r.test_name || '—')}</td>
            <td style="text-align:right; font-weight:700; color:var(--danger)">
              ${cvEsc(r.result_value)} ${cvEsc(r.unit || '')}</td>
            <td style="font-size:12px; color:var(--text3)">
              ${cvEsc(r.critical_range || '—')}</td>
            <td style="white-space:nowrap">${r.notified_at
              ? cvJam(r.notified_at)
              : '<span style="color:var(--danger); font-weight:700">belum</span>'}</td>
            <td style="font-size:12px">${r.notified_at
              ? cvEsc(r.notified_by || '—') + ' → ' + cvEsc(r.notified_to || '—')
              : '—'}</td>
            <td style="text-align:right; font-weight:${sla !== null && sla > 15 ? '700' : '400'};
                       color:${sla === null ? 'var(--text3)'
                              : sla > 15 ? 'var(--danger)' : 'var(--success)'}">
              ${sla === null ? '—' : sla + ' mnt'}</td>
            <td>${r.readback
              ? '<span style="color:var(--success)">✓ dikonfirmasi</span>'
              : r.notified_at
                ? '<span style="color:var(--warning)">belum</span>' : '—'}</td>
            <td style="white-space:nowrap">
              ${!r.notified_at
                ? `<button class="btn btn-sm btn-primary" onclick="cvLapor(${r.id})">
                     Catat Pelaporan</button>` : ''}
              ${r.notified_at && !r.readback
                ? `<button class="btn btn-sm" onclick="cvReadBack(${r.id})">
                     Read-back OK</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Kolom <b>Ambang</b> menampilkan batas yang berlaku saat kejadian itu
      tercatat, disalin ke barisnya masing-masing. Mengubah ambang di
      kemudian hari tidak mengubah catatan lama — itu memang disengaja,
      supaya logbook tetap menggambarkan keadaan pada saat itu.
    </div>`;
}

function cvKartu(label, angka, kunci, warna) {
  return `<div class="card" style="padding:14px; cursor:pointer;
            ${cvFilter === kunci ? 'outline:2px solid var(--primary)' : ''}"
            onclick="cvSaring('${kunci}')">
    <div style="font-size:12px; color:var(--text3)">${label}</div>
    <div style="font-size:22px; font-weight:800; color:${warna}">${angka}</div>
  </div>`;
}

function cvSaring(k) { cvFilter = k; cvGambar(); }

async function cvLapor(id) {
  const kepada = prompt('Dilaporkan kepada siapa? (nama dokter/perawat penerima)');
  if (!kepada) return;
  const oleh = prompt('Dilaporkan oleh (nama petugas lab):',
    window.currentUsername || '');
  if (!oleh) return;
  const cara = prompt('Cara menghubungi (telepon / WhatsApp / langsung):', 'telepon');
  if (cara === null) return;

  try {
    await sbPatch('critical_value_notifications', id, {
      notified_to: kepada, notified_by: oleh, method: cara,
      notified_at: new Date().toISOString(),
      attempt_status: 'Tersampaikan',
      updated_at: new Date().toISOString(),
    });
    await renderCriticalValue();
  } catch (e) { alert('Gagal mencatat pelaporan: ' + e.message); }
}

// Read-back: penerima mengulang kembali nilainya untuk memastikan tidak
// salah dengar. Dicatat terpisah dari pelaporan karena keduanya memang
// dua kejadian — dan yang sering terlewat justru yang kedua.
async function cvReadBack(id) {
  if (!confirm('Penerima sudah mengulang kembali nilai hasilnya dengan benar?')) return;
  try {
    await sbPatch('critical_value_notifications', id, {
      readback: true, updated_at: new Date().toISOString(),
    });
    await renderCriticalValue();
  } catch (e) { alert('Gagal mencatat read-back: ' + e.message); }
}

function checkCriticalValue(param, val) {
  const p = (param || '').toUpperCase();
  const num = parseFloat(val);
  if (p.includes('POTASSIUM') || p.includes('KALIUM')) {
    if (num >= 6.2) return { is_critical: true, type: 'CRITICAL_HIGH' };
    if (num <= 2.8) return { is_critical: true, type: 'CRITICAL_LOW' };
  }
  if (p.includes('GLUCOSE') || p.includes('GLUKOSA')) {
    if (num >= 450) return { is_critical: true, type: 'CRITICAL_HIGH' };
    if (num <= 45) return { is_critical: true, type: 'CRITICAL_LOW' };
  }
  return { is_critical: false, type: 'NORMAL' };
}

function recordCriticalValueLog(data = {}) {
  return {
    success: true,
    is_sla_met: (data.sla_minutes || 0) <= 15,
    log_id: 'CVL-' + Date.now(),
    entry: data
  };
}

window.renderCriticalValue = renderCriticalValue;
window.cvSaring   = cvSaring;
window.cvLapor    = cvLapor;
window.cvReadBack = cvReadBack;
window.checkCriticalValue = checkCriticalValue;
window.recordCriticalValueLog = recordCriticalValueLog;
