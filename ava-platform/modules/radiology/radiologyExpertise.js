// ═══════════════════════════════════════════════════════════════
// MODUL: Ekspertise Radiologi — pembacaan dan penandatanganan
//
// Versi sebelumnya tidak punya panggilan data: daftar pemeriksaan
// menunggu baca, temuan, dan kesan ditulis tangan sebagai array. Untuk
// layar yang isinya kesimpulan klinis, itu bukan sekadar tampilan
// kosong — ia menampilkan pembacaan atas pasien yang tidak ada.
//
// Sekarang membaca public.radiology_orders dan public.radiology_reports
// yang sudah ada di basis data.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Ekspertise yang sudah ditandatangani TIDAK bisa disunting dari layar
// ini. Laporan bertanda tangan adalah dokumen medis yang sudah beredar
// ke dokter pengirim; mengubahnya diam-diam berarti dua versi beredar
// tanpa ada yang tahu mana yang dipakai. Perubahan setelah tanda tangan
// harus lewat adendum.
//
// Temuan kritis ditandai dan diikuti kolom "sudah diberitahu ke siapa,
// kapan". Temuan kritis yang tidak sampai ke dokter pengirim sama saja
// dengan tidak dibaca.
//
// Waktu tunggu dihitung dari pemeriksaan selesai (performed_at) ke
// pembacaan (read_at) — bukan dari order dibuat. Yang diukur adalah
// kinerja radiolog, bukan lamanya pasien menunggu jadwal.
//
// Prefiks "re".
// ═══════════════════════════════════════════════════════════════

let reData = null;
let reTab = 'menunggu';

function reEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function reJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function reJamTunggu(o, r) {
  if (!o.performed_at || !r || !r.read_at) return null;
  return Math.round((new Date(r.read_at) - new Date(o.performed_at)) / 3600000);
}

async function reMuat() {
  if (typeof sbGet !== 'function') { reData = null; return; }
  try {
    const [order, laporan] = await Promise.all([
      sbGet('radiology_orders', 'select=*&order=performed_at.desc&limit=300'),
      sbGet('radiology_reports', 'select=*&order=id.desc&limit=300'),
    ]);
    reData = { order, laporan };
  } catch (e) { reData = null; }
}

async function renderRadiologyExpertise() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await reMuat();

  if (reData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Ekspertise Radiologi</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data radiologi tidak dapat dibaca.</strong><br>
        Tabel <code>radiology_orders</code> atau <code>radiology_reports</code>
        belum tersedia.
      </div>`;
    return;
  }
  reGambar();
}

function reLaporan(orderId) {
  return (reData.laporan || []).find(r => r.order_id === orderId) || null;
}

function reGambar() {
  const O = reData.order || [];

  // Sudah diperiksa, belum ada laporan bertanda tangan.
  const menunggu = O.filter(o => o.performed_at && !(reLaporan(o.id) || {}).signed_at);
  const selesai = O.filter(o => (reLaporan(o.id) || {}).signed_at);
  const kritis = selesai.filter(o => {
    const r = reLaporan(o.id);
    return r && r.is_critical && !r.critical_notified_at;
  });

  const daftar = reTab === 'menunggu' ? menunggu : selesai;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Ekspertise Radiologi</h1>
        <p class="muted">Pembacaan, kesan, dan penandatanganan laporan.</p>
      </div>
    </div>

    ${kritis.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${kritis.length} temuan kritis belum diberitahukan ke dokter pengirim.</b>
        Temuan kritis yang tidak sampai sama saja dengan tidak dibaca.
      </div>` : ''}

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${reTab === 'menunggu' ? 'active' : ''}"
              onclick="reGantiTab('menunggu')">Menunggu Baca (${menunggu.length})</button>
      <button class="tab ${reTab === 'selesai' ? 'active' : ''}"
              onclick="reGantiTab('selesai')">Sudah Ditandatangani (${selesai.length})</button>
    </div>

    ${!daftar.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🩻</div>
        <div style="font-weight:700; margin-bottom:4px">
          ${reTab === 'menunggu'
            ? 'Tidak ada pemeriksaan yang menunggu dibaca'
            : 'Belum ada laporan yang ditandatangani'}</div>
        <div style="font-size:13px; color:var(--text3)">
          ${reTab === 'menunggu'
            ? 'Pemeriksaan yang sudah selesai diakuisisi akan muncul di sini.'
            : ''}</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Accession</th><th>Pasien</th><th>Pemeriksaan</th><th>Modalitas</th>
          <th>Prioritas</th><th>Diperiksa</th>
          ${reTab === 'selesai' ? `<th>Dibaca</th><th>Radiolog</th>
            <th style="text-align:right">Tunggu</th><th>Kritis</th>` : '<th>Klinis</th>'}
          <th></th>
        </tr></thead><tbody>
        ${daftar.map(o => {
          const r = reLaporan(o.id);
          const jam = reJamTunggu(o, r);
          const cito = (o.priority || '').toLowerCase().includes('cito');
          return `<tr>
            <td><b>${reEsc(o.accession_no || '—')}</b></td>
            <td>${reEsc(o.patient_name || '—')}
              ${o.mr_number ? `<div style="font-size:11px; color:var(--text3)">
                ${reEsc(o.mr_number)}</div>` : ''}</td>
            <td>${reEsc(o.procedure_name || '—')}</td>
            <td>${reEsc(o.modality_code || '—')}</td>
            <td>${cito ? '<b style="color:var(--danger)">CITO</b>'
                       : reEsc(o.priority || 'Rutin')}</td>
            <td style="white-space:nowrap">${reJam(o.performed_at)}</td>
            ${reTab === 'selesai' ? `
              <td style="white-space:nowrap">${reJam(r && r.read_at)}</td>
              <td>${reEsc((r && r.radiologist) || '—')}</td>
              <td style="text-align:right; color:${jam !== null && jam > 24
                ? 'var(--warning)' : 'inherit'}">
                ${jam === null ? '—' : jam + ' jam'}</td>
              <td>${r && r.is_critical
                ? (r.critical_notified_at
                    ? `<span style="color:var(--success)">✓ ${reEsc(r.critical_notified_to || '')}</span>`
                    : '<span style="color:var(--danger); font-weight:700">belum</span>')
                : '—'}</td>`
            : `<td style="font-size:12px; max-width:220px">
                 ${reEsc(o.clinical_info || '—')}</td>`}
            <td style="white-space:nowrap">
              <button class="btn btn-sm" onclick="reLihat(${o.id})">Lihat</button>
              ${reTab === 'menunggu'
                ? `<button class="btn btn-sm btn-primary" onclick="reBaca(${o.id})">
                     ${r ? 'Lanjutkan' : 'Baca'}</button>` : ''}
              ${reTab === 'selesai' && r && r.is_critical && !r.critical_notified_at
                ? `<button class="btn btn-sm" onclick="reLaporKritis(${r.id})">
                     Catat Pemberitahuan</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Waktu tunggu dihitung dari pemeriksaan selesai sampai dibaca, bukan
      dari order dibuat — yang diukur kinerja pembacaan, bukan lamanya
      pasien menunggu jadwal. Laporan yang sudah ditandatangani tidak bisa
      disunting dari layar ini; perubahan setelah tanda tangan harus lewat
      adendum agar tidak ada dua versi beredar tanpa ada yang tahu.
    </div>`;
}

function reGantiTab(t) { reTab = t; reGambar(); }

function reLihat(orderId) {
  const o = (reData.order || []).find(x => x.id === orderId);
  const r = reLaporan(orderId);
  if (!o) return;

  const html = `
    <div class="modal-overlay" id="re-modal" onclick="if(event.target===this)reTutup()">
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <h3>${reEsc(o.accession_no || '')} — ${reEsc(o.procedure_name || '')}</h3>
          <button class="modal-close" onclick="reTutup()">&times;</button>
        </div>
        <div class="modal-body" style="font-size:13px; line-height:1.8">
          <div style="margin-bottom:12px">
            <b>${reEsc(o.patient_name || '—')}</b>
            ${o.patient_gender ? ' · ' + reEsc(o.patient_gender) : ''}
            ${o.patient_dob ? ' · ' + reEsc(o.patient_dob) : ''}<br>
            Pengirim: ${reEsc(o.referring_doctor || '—')}<br>
            Klinis: ${reEsc(o.clinical_info || '—')}<br>
            Diperiksa: ${reJam(o.performed_at)}
            ${o.radiographer ? ' oleh ' + reEsc(o.radiographer) : ''}
          </div>
          ${!r ? `<div style="padding:16px; background:var(--bg2); border-radius:8px;
                              color:var(--text3)">
              Belum ada ekspertise untuk pemeriksaan ini.</div>` : `
            <div style="border-top:1px solid var(--border); padding-top:12px">
              ${r.technique ? `<b>Teknik</b><br>${reEsc(r.technique)}<br><br>` : ''}
              ${r.comparison ? `<b>Pembanding</b><br>${reEsc(r.comparison)}<br><br>` : ''}
              <b>Temuan</b><br>${reEsc(r.findings || '—')}<br><br>
              <b>Kesan</b><br>${reEsc(r.impression || '—')}<br><br>
              ${r.recommendation ? `<b>Saran</b><br>${reEsc(r.recommendation)}<br><br>` : ''}
              ${r.is_critical ? `<div style="color:var(--danger); font-weight:700">
                ⚠ Temuan kritis${r.critical_notified_at
                  ? ` — diberitahukan ke ${reEsc(r.critical_notified_to || '')}
                      pada ${reJam(r.critical_notified_at)}`
                  : ' — BELUM diberitahukan'}</div><br>` : ''}
              <div style="font-size:12px; color:var(--text3)">
                ${r.signed_at
                  ? `Ditandatangani ${reEsc(r.radiologist || '')} pada ${reJam(r.signed_at)}`
                  : 'Draf — belum ditandatangani'}</div>
            </div>`}
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function reTutup() {
  const m = document.getElementById('re-modal');
  if (m) m.remove();
}

async function reBaca(orderId) {
  const o = (reData.order || []).find(x => x.id === orderId);
  const r = reLaporan(orderId);
  if (r && r.signed_at) {
    alert('Laporan ini sudah ditandatangani dan tidak bisa disunting. '
        + 'Perubahan setelah tanda tangan harus lewat adendum.');
    return;
  }

  const teknik = prompt('Teknik pemeriksaan:', (r && r.technique) || '');
  if (teknik === null) return;
  const temuan = prompt('Temuan:', (r && r.findings) || '');
  if (temuan === null) return;
  const kesan = prompt('Kesan:', (r && r.impression) || '');
  if (!kesan) { alert('Kesan wajib diisi — itu bagian yang dibaca dokter pengirim.'); return; }
  const saran = prompt('Saran (opsional):', (r && r.recommendation) || '');
  if (saran === null) return;
  const kritis = confirm('Apakah ini temuan kritis yang harus segera '
    + 'diberitahukan ke dokter pengirim?\n\nOK = ya, Batal = tidak');
  const radiolog = prompt('Nama radiolog:', window.currentUsername || '');
  if (!radiolog) return;
  const ttd = confirm('Tandatangani sekarang?\n\n'
    + 'OK = tandatangani (tidak bisa disunting lagi)\nBatal = simpan sebagai draf');

  const isi = {
    order_id: orderId,
    accession_no: o && o.accession_no,
    technique: teknik || null,
    findings: temuan || null,
    impression: kesan,
    recommendation: saran || null,
    is_critical: kritis,
    radiologist: radiolog,
    read_at: new Date().toISOString(),
    signed_at: ttd ? new Date().toISOString() : null,
    locked: ttd,
    updated_at: new Date().toISOString(),
  };

  try {
    if (r) await sbPatch('radiology_reports', r.id, isi);
    else await sbPost('radiology_reports', isi);
    await renderRadiologyExpertise();
  } catch (e) { alert('Gagal menyimpan ekspertise: ' + e.message); }
}

async function reLaporKritis(reportId) {
  const kepada = prompt('Diberitahukan kepada siapa? (nama dokter pengirim/penerima)');
  if (!kepada) return;
  try {
    await sbPatch('radiology_reports', reportId, {
      critical_notified_to: kepada,
      critical_notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await renderRadiologyExpertise();
  } catch (e) { alert('Gagal mencatat pemberitahuan: ' + e.message); }
}

window.renderRadiologyExpertise = renderRadiologyExpertise;
window.reGantiTab   = reGantiTab;
window.reLihat      = reLihat;
window.reTutup      = reTutup;
window.reBaca       = reBaca;
window.reLaporKritis = reLaporKritis;
