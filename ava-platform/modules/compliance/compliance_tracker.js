// ═══════════════════════════════════════════════════════════════
// MODUL: Izin & Kepatuhan — perizinan faskes dan kredensial nakes
//
// Versi sebelumnya tidak punya panggilan data: daftar izin, tanggal
// berakhir, dan STR/SIP nakes ditulis tangan. Untuk layar yang gunanya
// justru memperingatkan sebelum sesuatu kedaluwarsa, itu kebalikan dari
// gunanya — ia menampilkan tanggal yang tidak pernah bergerak.
//
// Sekarang membaca public.permits dan public.permit_pics (migrasi 0022)
// serta public.staff_credentials yang sudah ada.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Yang sudah lewat masa berlaku ditampilkan PALING ATAS dan tidak bisa
// disembunyikan dengan penyaring. Izin operasional yang habis berarti
// pelayanan berjalan tanpa dasar hukum; STR yang habis berarti tindakan
// dikerjakan orang yang izin praktiknya tidak berlaku. Keduanya bukan
// hal yang boleh hilang dari pandangan.
//
// Sisa hari dihitung dari tanggal, bukan dibaca dari kolom status.
// Kolom status tidak berubah sendiri saat tanggal lewat — justru itu
// yang membuat izin kedaluwarsa lolos dari perhatian selama ini.
//
// Ambang peringatan 90/60/30 hari ditampilkan di layar supaya bukan
// aturan tersembunyi.
//
// Prefiks "ct".
// ═══════════════════════════════════════════════════════════════

let ctData = null;
let ctTab = 'izin';

function ctEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ctTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}
function ctSisa(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}
function ctWarna(sisa) {
  if (sisa === null) return 'var(--text3)';
  if (sisa < 0) return 'var(--danger)';
  if (sisa <= 30) return 'var(--danger)';
  if (sisa <= 60) return 'var(--warning)';
  if (sisa <= 90) return 'var(--warning)';
  return 'inherit';
}
function ctLabelSisa(sisa) {
  if (sisa === null) return 'tanpa tanggal';
  if (sisa < 0) return `lewat ${Math.abs(sisa)} hari`;
  return `${sisa} hari lagi`;
}

async function ctMuat() {
  if (typeof sbGet !== 'function') { ctData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [izin, pic, kredensial] = await Promise.all([
      sbGet('permits', 'select=*&order=expires_at'),
      aman('permit_pics', 'select=*'),
      aman('staff_credentials', 'select=*&order=expiry_date'),
    ]);
    ctData = { izin, pic, kredensial };
  } catch (e) { ctData = null; }
}

async function renderComplianceTracker() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await ctMuat();

  if (ctData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Izin &amp; Kepatuhan</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data perizinan tidak dapat dibaca.</strong><br>
        Tabel <code>permits</code> belum tersedia.
      </div>`;
    return;
  }
  ctGambar();
}

function ctGambar() {
  const I = (ctData.izin || []).map(x => ({ ...x, _sisa: ctSisa(x.expires_at) }));
  const K = (ctData.kredensial || []).map(x => ({ ...x, _sisa: ctSisa(x.expiry_date) }));

  const lewatIzin = I.filter(x => x._sisa !== null && x._sisa < 0);
  const lewatKred = K.filter(x => x._sisa !== null && x._sisa < 0);
  const segeraIzin = I.filter(x => x._sisa !== null && x._sisa >= 0 && x._sisa <= 90);
  const segeraKred = K.filter(x => x._sisa !== null && x._sisa >= 0 && x._sisa <= 90);

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Izin &amp; Kepatuhan</h1>
        <p class="muted">Perizinan faskes, sertifikasi, dan kredensial tenaga kesehatan.</p>
      </div>
    </div>

    ${(lewatIzin.length || lewatKred.length) ? `
      <div class="card" style="padding:14px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <div style="font-weight:800; color:var(--danger); margin-bottom:6px">
          Sudah lewat masa berlaku</div>
        <div style="font-size:13px; line-height:1.8">
          ${lewatIzin.length ? `<b>${lewatIzin.length} izin</b> — pelayanan yang
            bergantung padanya berjalan tanpa dasar yang berlaku.<br>` : ''}
          ${lewatKred.length ? `<b>${lewatKred.length} kredensial nakes</b> (STR/SIP) —
            tindakan dikerjakan orang yang izin praktiknya tidak berlaku.` : ''}
        </div>
      </div>` : ''}

    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
                gap:12px; margin-bottom:16px">
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Izin terdaftar</div>
        <div style="font-size:22px; font-weight:800">${I.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Kredensial nakes</div>
        <div style="font-size:22px; font-weight:800">${K.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Berakhir ≤90 hari</div>
        <div style="font-size:22px; font-weight:800;
                    color:${(segeraIzin.length + segeraKred.length)
                      ? 'var(--warning)' : 'var(--text3)'}">
          ${segeraIzin.length + segeraKred.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Sudah lewat</div>
        <div style="font-size:22px; font-weight:800;
                    color:${(lewatIzin.length + lewatKred.length)
                      ? 'var(--danger)' : 'var(--success)'}">
          ${lewatIzin.length + lewatKred.length}</div>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${ctTab === 'izin' ? 'active' : ''}"
              onclick="ctGantiTab('izin')">Perizinan Faskes (${I.length})</button>
      <button class="tab ${ctTab === 'nakes' ? 'active' : ''}"
              onclick="ctGantiTab('nakes')">STR / SIP Nakes (${K.length})</button>
    </div>

    ${ctTab === 'izin' ? ctTabIzin(I) : ctTabNakes(K)}

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Sisa hari dihitung dari tanggal berakhir, <b>bukan</b> dibaca dari
      kolom status: status tidak berubah sendiri saat tanggal lewat, dan
      justru itu yang membuat izin kedaluwarsa lolos dari perhatian.
      Ambang peringatan: <b>90 / 60 / 30 hari</b>. Yang sudah lewat selalu
      ditampilkan paling atas.
    </div>`;
}

function ctGantiTab(t) { ctTab = t; ctGambar(); }

// Yang sudah lewat selalu di atas, lalu yang paling dekat berakhir.
function ctUrut(a, b) {
  const sa = a._sisa === null ? Infinity : a._sisa;
  const sb = b._sisa === null ? Infinity : b._sisa;
  return sa - sb;
}

function ctTabIzin(I) {
  if (!I.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📄</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada izin terdaftar</div>
      <div style="font-size:13px; color:var(--text3); max-width:480px; margin:0 auto">
        Daftarkan izin operasional, sertifikasi, dan izin edar beserta
        tanggal berakhirnya agar peringatan bisa terbit sebelum habis.</div>
    </div>`;
  }

  const picOf = id => (ctData.pic || []).filter(p => p.permit_id === id);

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>Jenis Izin</th><th>Nomor</th><th>Penerbit</th>
      <th>KBLI / Lokasi</th><th>Terbit</th><th>Berakhir</th>
      <th style="text-align:right">Sisa</th><th>PIC</th><th>Status</th><th>Dokumen</th>
    </tr></thead><tbody>
    ${[...I].sort(ctUrut).map(x => {
      const pics = picOf(x.id);
      return `<tr style="${x._sisa !== null && x._sisa < 0
        ? 'background:rgba(255,0,0,.04)' : ''}">
        <td><b>${ctEsc(x.permit_type || '—')}</b></td>
        <td style="font-size:12px">${ctEsc(x.permit_number || '—')}</td>
        <td style="font-size:12px">${ctEsc(x.issuing_authority || '—')}</td>
        <td style="font-size:12px">${ctEsc(x.kbli_code || '—')}
          ${x.location_code ? ' · ' + ctEsc(x.location_code) : ''}</td>
        <td>${ctTgl(x.issued_at)}</td>
        <td>${ctTgl(x.expires_at)}</td>
        <td style="text-align:right; font-weight:${x._sisa !== null && x._sisa <= 90
          ? '700' : '400'}; color:${ctWarna(x._sisa)}">${ctLabelSisa(x._sisa)}</td>
        <td style="font-size:12px">${pics.length
          ? pics.map(p => ctEsc(p.pic_name || p.role_title || '—')).join(', ')
          : '<span style="color:var(--warning)">belum ada PIC</span>'}</td>
        <td>${ctEsc(x.status || '—')}</td>
        <td>${x.document_url
          ? `<a href="${ctEsc(x.document_url)}" target="_blank" rel="noopener">buka</a>`
          : '<span style="color:var(--warning)">belum diunggah</span>'}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
  </div>`;
}

function ctTabNakes(K) {
  if (!K.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🪪</div>
      <div style="font-weight:700; margin-bottom:4px">
        Belum ada kredensial nakes terdaftar</div>
      <div style="font-size:13px; color:var(--text3); max-width:480px; margin:0 auto">
        STR dan SIP dokter, perawat, analis, dan apoteker dicatat di sini
        beserta masa berlakunya.</div>
    </div>`;
  }

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>Nama</th><th>Profesi</th><th>Jenis</th><th>Nomor</th>
      <th>Penerbit</th><th>Terbit</th><th>Berakhir</th>
      <th style="text-align:right">Sisa</th><th>Aktif</th>
    </tr></thead><tbody>
    ${[...K].sort(ctUrut).map(x => `<tr style="${x._sisa !== null && x._sisa < 0
      ? 'background:rgba(255,0,0,.04)' : ''}">
      <td><b>${ctEsc(x.staff_name || '—')}</b></td>
      <td>${ctEsc(x.profession || '—')}</td>
      <td>${ctEsc(x.credential_type || '—')}</td>
      <td style="font-size:12px">${ctEsc(x.number || '—')}</td>
      <td style="font-size:12px">${ctEsc(x.issuer || '—')}</td>
      <td>${ctTgl(x.issued_date)}</td>
      <td>${ctTgl(x.expiry_date)}</td>
      <td style="text-align:right; font-weight:${x._sisa !== null && x._sisa <= 90
        ? '700' : '400'}; color:${ctWarna(x._sisa)}">${ctLabelSisa(x._sisa)}</td>
      <td>${x.is_active === false
        ? '<span style="color:var(--text3)">nonaktif</span>'
        : (x._sisa !== null && x._sisa < 0
            ? '<span style="color:var(--danger); font-weight:700">aktif tapi kedaluwarsa</span>'
            : 'aktif')}</td>
    </tr>`).join('')}
    </tbody></table>
  </div>`;
}

window.renderComplianceTracker = renderComplianceTracker;
window.ctGantiTab = ctGantiTab;
