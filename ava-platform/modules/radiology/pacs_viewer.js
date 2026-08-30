// ═══════════════════════════════════════════════════════════════
// MODUL: PACS Viewer — daftar citra dan pratinjau
//
// Versi sebelumnya tidak punya panggilan data: daftar studi dan citra
// ditulis tangan. Menu ini berstatus "parsial" — dan memang begitulah
// keadaannya, tapi bukan karena datanya karangan.
//
// Sekarang membaca public.radiology_images dan public.radiology_orders.
//
// ── Yang jujur disebutkan di layar ───────────────────────────
//
// Ini BUKAN penampil DICOM. Yang ditampilkan adalah berkas pratinjau
// (preview_path / preview_url) yang sudah dibuat sebelumnya, bukan
// berkas DICOM asli. Alat ukur jarak dan pengaturan windowing yang
// dijanjikan versi lama tidak ada di sini, dan menampilkan alat ukur
// yang tidak terkalibrasi ke piksel-per-milimeter DICOM justru berbahaya:
// hasil pengukurannya akan dikira benar.
//
// Untuk pembacaan diagnostik, berkas DICOM dibuka di penampil ber-standar
// (path-nya disebutkan di tabel). Layar ini untuk melihat cepat studi apa
// saja yang ada dan menautkannya ke ekspertise.
//
// Prefiks "pv".
// ═══════════════════════════════════════════════════════════════

let pvData = null;
let pvPilih = null;

function pvEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function pvJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function pvUkuran(b) {
  const n = Number(b || 0);
  if (!n) return '—';
  if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n > 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

async function pvMuat() {
  if (typeof sbGet !== 'function') { pvData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [citra, order] = await Promise.all([
      sbGet('radiology_images', 'select=*&order=id.desc&limit=300'),
      aman('radiology_orders', 'select=*&order=performed_at.desc&limit=300'),
    ]);
    pvData = { citra, order };
  } catch (e) { pvData = null; }
}

async function renderPacsViewer() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await pvMuat();

  if (pvData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>PACS Viewer</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data citra tidak dapat dibaca.</strong><br>
        Tabel <code>radiology_images</code> belum tersedia.
      </div>`;
    return;
  }
  pvGambar();
}

function pvOrder(orderId) {
  return (pvData.order || []).find(o => o.id === orderId) || {};
}

function pvGambar() {
  const C = pvData.citra || [];

  // Dikelompokkan per studi (accession), bukan per berkas: satu
  // pemeriksaan bisa punya belasan citra dan menampilkannya sebagai
  // daftar datar membuat studi yang sama terlihat seperti belasan
  // pemeriksaan berbeda.
  const studi = new Map();
  for (const c of C) {
    const k = c.accession_no || ('order-' + c.order_id);
    if (!studi.has(k)) studi.set(k, []);
    studi.get(k).push(c);
  }

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>PACS Viewer</h1>
        <p class="muted">Daftar studi dan pratinjau citra radiologi.</p>
      </div>
    </div>

    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Layar ini menampilkan <b>berkas pratinjau</b>, bukan berkas DICOM asli.
      Tidak ada alat ukur jarak dan pengaturan windowing di sini: alat ukur
      yang tidak terkalibrasi ke piksel-per-milimeter DICOM akan memberi
      angka yang dikira benar. Untuk pembacaan diagnostik, buka berkas
      DICOM-nya di penampil ber-standar.
    </div>

    ${!C.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🖼️</div>
        <div style="font-weight:700; margin-bottom:4px">Belum ada citra tersimpan</div>
        <div style="font-size:13px; color:var(--text3)">
          Citra yang diunggah dari modalitas akan muncul di sini.</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Accession</th><th>Pasien</th><th>Pemeriksaan</th><th>Modalitas</th>
          <th style="text-align:right">Jumlah Citra</th>
          <th style="text-align:right">Total Ukuran</th>
          <th>Diperiksa</th><th></th>
        </tr></thead><tbody>
        ${[...studi.entries()].map(([acc, daftar]) => {
          const o = pvOrder(daftar[0].order_id);
          const total = daftar.reduce((a, c) => a + Number(c.file_size || 0), 0);
          return `<tr style="${pvPilih === acc ? 'outline:2px solid var(--primary)' : ''}">
            <td><b>${pvEsc(acc)}</b></td>
            <td>${pvEsc(o.patient_name || '—')}</td>
            <td>${pvEsc(o.procedure_name || '—')}</td>
            <td>${pvEsc(o.modality_code || '—')}</td>
            <td style="text-align:right">${daftar.length}</td>
            <td style="text-align:right">${pvUkuran(total)}</td>
            <td style="white-space:nowrap">${pvJam(o.performed_at)}</td>
            <td><button class="btn btn-sm" onclick="pvBuka('${pvEsc(acc)}')">
              ${pvPilih === acc ? 'Tutup' : 'Lihat'}</button></td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>

      ${pvPilih ? pvPanel(studi.get(pvPilih) || []) : ''}`}`;
}

function pvBuka(acc) {
  pvPilih = (pvPilih === acc) ? null : acc;
  pvGambar();
}

function pvPanel(daftar) {
  if (!daftar.length) return '';
  const o = pvOrder(daftar[0].order_id);

  return `
    <div class="card" style="padding:18px; margin-top:16px">
      <div style="font-weight:800; font-size:15px; margin-bottom:2px">
        ${pvEsc(o.patient_name || '—')}</div>
      <div style="font-size:12px; color:var(--text3); margin-bottom:14px">
        ${pvEsc(o.procedure_name || '')} · ${pvEsc(pvPilih)}
        ${o.referring_doctor ? ' · pengirim ' + pvEsc(o.referring_doctor) : ''}</div>

      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
                  gap:12px">
        ${daftar.map(c => `
          <div style="border:1px solid var(--border); border-radius:8px; overflow:hidden">
            ${c.preview_url || c.preview_path
              ? `<img src="${pvEsc(c.preview_url || c.preview_path)}"
                      alt="${pvEsc(c.view_label || 'citra')}"
                      style="width:100%; display:block; background:#000"
                      onerror="this.style.display='none';
                               this.nextElementSibling.style.display='block'">
                 <div style="display:none; padding:24px; text-align:center;
                             font-size:12px; color:var(--text3)">
                   Pratinjau tidak dapat dimuat</div>`
              : `<div style="padding:24px; text-align:center; font-size:12px;
                            color:var(--text3)">Tidak ada pratinjau</div>`}
            <div style="padding:8px 10px; font-size:11px; line-height:1.6">
              <b>${pvEsc(c.view_label || 'Citra')}</b>
              ${c.series_no != null ? ` · seri ${c.series_no}` : ''}
              ${c.instance_no != null ? ` · #${c.instance_no}` : ''}<br>
              ${c.width && c.height ? `${c.width}×${c.height} · ` : ''}
              ${pvUkuran(c.file_size)}<br>
              ${c.dicom_path
                ? `<span style="color:var(--text3)">DICOM: ${pvEsc(c.dicom_path)}</span>`
                : '<span style="color:var(--warning)">berkas DICOM tidak tercatat</span>'}
              ${c.uploaded_by ? `<br>diunggah ${pvEsc(c.uploaded_by)}` : ''}
            </div>
          </div>`).join('')}
      </div>

      <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border)">
        <button class="btn btn-sm btn-primary" onclick="navigate('rad-ekspertise')">
          Buka Ekspertise Radiologi</button>
      </div>
    </div>`;
}

window.renderPacsViewer = renderPacsViewer;
window.pvBuka = pvBuka;
