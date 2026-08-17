// ═══════════════════════════════════════════════════════════════
// PACS RANCANGAN SENDIRI — arsip citra & penampil
//
// Kenapa dirancang begini, bukan PACS DICOM penuh:
//   PACS komersial bertumpu pada protokol DICOM di jaringan (C-STORE, C-FIND,
//   WADO) yang menuntut server tersendiri. Untuk skala klinik, menyimpan citra
//   di Supabase Storage dengan metadata di basis data memberi manfaat terbesar
//   dengan perawatan paling sedikit.
//
//   Tiap citra disimpan dalam DUA bentuk:
//     · pratinjau JPG/PNG — untuk dilihat cepat di browser
//     · berkas DICOM asli — diunduh ke workstation bila radiolog perlu
//       perangkat diagnostik sungguhan
//
//   Penampil di bawah memberi zoom, geser, window level, dan pengukuran jarak
//   pada pratinjau. Itu memadai untuk peninjauan dan diskusi, TETAPI pembacaan
//   diagnostik resmi tetap sebaiknya di monitor terkalibrasi.
// ═══════════════════════════════════════════════════════════════

const PACS_BUCKET = 'pacs';

let pacsImages = [], pacsIdx = 0;
let pacsView = { zoom: 1, x: 0, y: 0, brightness: 100, contrast: 100, invert: false };
let pacsMeasure = null;   // {x1,y1,x2,y2} dalam koordinat kanvas
let _pacsImgEl = null, _pacsDragging = false, _pacsLast = null, _pacsMeasuring = false;

// ── Konsol Penerimaan PACS — citra dari alat masuk ke sini ─────
async function openPacsUpload(orderId, accession) {
  openModal(`
    <div class="modal-header"><div class="modal-title">🖼️ Konsol Penerimaan PACS — ${accession}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      Terima citra hasil ekspor dari alat (JPG/PNG). Berkas DICOM asli boleh
      disertakan agar dapat diunduh ke workstation. Setelah diterima, citra dapat
      ditinjau & disunting (zoom, window level, ukur) di penampil.
    </div>
    <div class="form-row">
      <div class="form-group"><label>Seri</label><input type="number" id="pu-series" value="1" min="1"></div>
      <div class="form-group"><label>Posisi / Proyeksi</label>
        <input type="text" id="pu-view" placeholder="AP, Lateral, Oblique..."></div>
    </div>
    <div class="form-group"><label>Gambar Pratinjau (JPG/PNG) *</label>
      <input type="file" id="pu-preview" accept="image/*" multiple></div>
    <div class="form-group"><label>Berkas DICOM asli (opsional)</label>
      <input type="file" id="pu-dicom" accept=".dcm,application/dicom"></div>
    <div id="pu-progress" style="font-size:12px;color:var(--teal);margin-top:8px"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="savePacsUpload(${orderId},'${accession}')">⬆️ Unggah</button>
    </div>`);
}

async function savePacsUpload(orderId, accession) {
  const files = document.getElementById('pu-preview')?.files;
  if (!files || !files.length) { toast('Pilih minimal satu gambar', 'err'); return; }
  const series = parseInt(document.getElementById('pu-series').value) || 1;
  const label = document.getElementById('pu-view').value.trim() || null;
  const dicom = document.getElementById('pu-dicom')?.files?.[0] || null;
  const prog = document.getElementById('pu-progress');

  try {
    const existing = await sbGet('radiology_images',
      `select=instance_no&order_id=eq.${orderId}&series_no=eq.${series}&order=instance_no.desc&limit=1`).catch(() => []);
    let inst = (existing?.[0]?.instance_no || 0) + 1;

    let dicomPath = null;
    if (dicom) {
      if (prog) prog.textContent = 'Mengunggah berkas DICOM…';
      const up = await uploadFile(dicom, PACS_BUCKET, accession);
      dicomPath = up?.path || null;
    }

    for (let i = 0; i < files.length; i++) {
      if (prog) prog.textContent = `Mengunggah gambar ${i + 1} dari ${files.length}…`;
      const up = await uploadFile(files[i], PACS_BUCKET, accession);
      const dim = await pacsImageSize(files[i]);
      await sbPost('radiology_images', {
        order_id: orderId, accession_no: accession,
        series_no: series, instance_no: inst++,
        view_label: label,
        preview_url: up?.url || null, preview_path: up?.path || null,
        dicom_path: i === 0 ? dicomPath : null,
        file_size: files[i].size, width: dim.w, height: dim.h,
        uploaded_by: getUserName ? getUserName() : 'User',
        updated_at: new Date().toISOString(),
      });
    }

    // Tandai waktu citra pertama diterima di konsol PACS (tidak menimpa bila sudah ada).
    const o = (typeof risOrders !== 'undefined') ? risOrders.find(x => x.id === orderId) : null;
    if (o && !o.received_from_device_at) {
      await sbPatch('radiology_orders', orderId,
        { received_from_device_at: new Date().toISOString(), updated_at: new Date().toISOString() }).catch(() => {});
    }

    await logActivity('pacs_receive', 'radiology_images', orderId,
      `${files.length} citra diterima di konsol PACS untuk ${accession}`, accession);
    toast(`✅ ${files.length} citra diterima di arsip`, 'ok');
    closeModalForce();
    if (typeof loadRISOrders === 'function') await loadRISOrders();
  } catch (e) {
    toast('❌ ' + (/bucket/i.test(e.message)
      ? 'Bucket "pacs" belum dibuat di Supabase Storage'
      : e.message), 'err');
  }
}

function pacsImageSize(file) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src); };
    img.onerror = () => res({ w: null, h: null });
    img.src = URL.createObjectURL(file);
  });
}

// ── Penampil ───────────────────────────────────────────────────
async function openPacsViewer(orderId, accession) {
  let imgs = [];
  try {
    imgs = await sbGet('radiology_images',
      `select=*&order_id=eq.${orderId}&order=series_no.asc,instance_no.asc`) || [];
  } catch (e) { toast('Gagal memuat arsip citra', 'err'); return; }

  if (!imgs.length) {
    toast('Belum ada citra pada studi ini', 'info');
    openPacsUpload(orderId, accession);
    return;
  }

  pacsImages = imgs; pacsIdx = 0;
  pacsResetView();

  openModal(`
    <div class="modal-header" style="background:#0D1520;color:var(--on-accent);border-bottom-color:#243243">
      <div class="modal-title" style="color:var(--on-accent)">🖼️ ${accession} — ${imgs.length} citra</div>
      <button class="modal-close" style="color:var(--on-accent)" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>

    <div style="background:#0D1520;margin:-16px -16px 0;padding:10px 16px;
      display:flex;gap:6px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #243243">
      <button class="btn btn-ghost btn-xs" style="color:#AEBDCC" onclick="pacsZoom(1.25)">+</button>
      <button class="btn btn-ghost btn-xs" style="color:#AEBDCC" onclick="pacsZoom(0.8)">−</button>
      <button class="btn btn-ghost btn-xs" style="color:#AEBDCC" onclick="pacsResetView();pacsDraw()">⟲ Reset</button>
      <span style="width:1px;height:18px;background:#243243"></span>
      <label style="color:#7F8FA0;font-size:11px">Terang
        <input type="range" id="pv-bright" min="20" max="200" value="100"
          oninput="pacsView.brightness=+this.value;pacsDraw()" style="width:70px;vertical-align:middle"></label>
      <label style="color:#7F8FA0;font-size:11px">Kontras
        <input type="range" id="pv-contrast" min="20" max="250" value="100"
          oninput="pacsView.contrast=+this.value;pacsDraw()" style="width:70px;vertical-align:middle"></label>
      <button class="btn btn-ghost btn-xs" style="color:#AEBDCC" onclick="pacsView.invert=!pacsView.invert;pacsDraw()">◐ Inversi</button>
      <span style="width:1px;height:18px;background:#243243"></span>
      <button class="btn btn-ghost btn-xs" id="pv-measure" style="color:#AEBDCC" onclick="pacsToggleMeasure()">📏 Ukur</button>
      <span style="flex:1"></span>
      <span id="pv-label" style="color:#7F8FA0;font-size:11.5px"></span>
    </div>

    <div style="background:#0D1520;margin:0 -16px;position:relative">
      <canvas id="pacs-canvas" width="880" height="520"
        style="width:100%;height:auto;display:block;cursor:grab;background:#000"
        onmousedown="pacsDown(event)" onmousemove="pacsMove(event)"
        onmouseup="pacsUp()" onmouseleave="pacsUp()"></canvas>
      <div id="pv-info" style="position:absolute;left:12px;bottom:10px;color:#7F8FA0;
        font-family:ui-monospace,monospace;font-size:11px;pointer-events:none"></div>
    </div>

    <div style="background:#0D1520;margin:0 -16px -16px;padding:10px 16px;
      display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid #243243">
      <button class="btn btn-ghost btn-sm" style="color:#AEBDCC" onclick="pacsNav(-1)">← Sebelumnya</button>
      <div style="display:flex;gap:5px;overflow-x:auto;flex:1">
        ${imgs.map((im, i) => `<img src="${im.preview_url}" onclick="pacsGo(${i})"
          style="height:44px;border-radius:4px;cursor:pointer;border:2px solid transparent"
          data-thumb="${i}" title="Seri ${im.series_no} · ${im.view_label || ''}">`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" style="color:#AEBDCC" onclick="pacsNav(1)">Berikutnya →</button>
      <a id="pv-dicom" class="btn btn-ghost btn-sm" style="color:#3FB3BC;display:none" target="_blank">⬇ DICOM</a>
    </div>`, 'wide');

  pacsGo(0);
}

function pacsResetView() {
  pacsView = { zoom: 1, x: 0, y: 0, brightness: 100, contrast: 100, invert: false };
  pacsMeasure = null; _pacsMeasuring = false;
}

function pacsGo(i) {
  if (i < 0 || i >= pacsImages.length) return;
  pacsIdx = i;
  const im = pacsImages[i];
  document.querySelectorAll('[data-thumb]').forEach(t =>
    t.style.borderColor = (+t.getAttribute('data-thumb') === i) ? '#3FB3BC' : 'transparent');

  const lbl = document.getElementById('pv-label');
  if (lbl) lbl.textContent = `Seri ${im.series_no} · Citra ${im.instance_no}${im.view_label ? ' · ' + im.view_label : ''}`;

  const dl = document.getElementById('pv-dicom');
  if (dl) {
    if (im.dicom_path) { dl.style.display = ''; dl.href = `${STORAGE_URL}/object/public/${PACS_BUCKET}/${im.dicom_path}`; }
    else dl.style.display = 'none';
  }

  _pacsImgEl = new Image();
  _pacsImgEl.crossOrigin = 'anonymous';
  _pacsImgEl.onload = () => { pacsResetView(); pacsDraw(); };
  _pacsImgEl.onerror = () => {
    const c = document.getElementById('pacs-canvas');
    if (c) { const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#7F8FA0'; g.font = '14px sans-serif'; g.textAlign = 'center';
      g.fillText('Gambar tidak dapat dimuat', c.width / 2, c.height / 2); }
  };
  _pacsImgEl.src = pacsImages[i].preview_url;
}

function pacsNav(d) { pacsGo(pacsIdx + d); }
function pacsZoom(f) { pacsView.zoom = Math.max(0.2, Math.min(8, pacsView.zoom * f)); pacsDraw(); }

function pacsToggleMeasure() {
  _pacsMeasuring = !_pacsMeasuring;
  const b = document.getElementById('pv-measure');
  if (b) b.style.color = _pacsMeasuring ? '#3FB3BC' : '#AEBDCC';
  if (!_pacsMeasuring) { pacsMeasure = null; pacsDraw(); }
}

function pacsDown(e) {
  const c = document.getElementById('pacs-canvas'); if (!c) return;
  const r = c.getBoundingClientRect();
  const x = (e.clientX - r.left) * (c.width / r.width);
  const y = (e.clientY - r.top) * (c.height / r.height);
  if (_pacsMeasuring) { pacsMeasure = { x1: x, y1: y, x2: x, y2: y }; }
  else { _pacsDragging = true; _pacsLast = { x: e.clientX, y: e.clientY }; c.style.cursor = 'grabbing'; }
}

function pacsMove(e) {
  const c = document.getElementById('pacs-canvas'); if (!c) return;
  if (_pacsMeasuring && pacsMeasure) {
    const r = c.getBoundingClientRect();
    pacsMeasure.x2 = (e.clientX - r.left) * (c.width / r.width);
    pacsMeasure.y2 = (e.clientY - r.top) * (c.height / r.height);
    pacsDraw(); return;
  }
  if (!_pacsDragging) return;
  pacsView.x += e.clientX - _pacsLast.x;
  pacsView.y += e.clientY - _pacsLast.y;
  _pacsLast = { x: e.clientX, y: e.clientY };
  pacsDraw();
}

function pacsUp() {
  _pacsDragging = false;
  const c = document.getElementById('pacs-canvas'); if (c) c.style.cursor = 'grab';
}

function pacsDraw() {
  const c = document.getElementById('pacs-canvas'); if (!c || !_pacsImgEl) return;
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);

  const iw = _pacsImgEl.naturalWidth || 1, ih = _pacsImgEl.naturalHeight || 1;
  const fit = Math.min(c.width / iw, c.height / ih);
  const s = fit * pacsView.zoom;
  const dw = iw * s, dh = ih * s;
  const dx = (c.width - dw) / 2 + pacsView.x;
  const dy = (c.height - dh) / 2 + pacsView.y;

  g.filter = `brightness(${pacsView.brightness}%) contrast(${pacsView.contrast}%)` +
             (pacsView.invert ? ' invert(1)' : '');
  g.drawImage(_pacsImgEl, dx, dy, dw, dh);
  g.filter = 'none';

  if (pacsMeasure) {
    const m = pacsMeasure;
    g.strokeStyle = '#3FB3BC'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(m.x1, m.y1); g.lineTo(m.x2, m.y2); g.stroke();
    [[m.x1, m.y1], [m.x2, m.y2]].forEach(p => {
      g.beginPath(); g.arc(p[0], p[1], 3.5, 0, Math.PI * 2); g.fillStyle = '#3FB3BC'; g.fill();
    });
    // Jarak dikonversi ke piksel citra asli — bukan milimeter, karena
    // pratinjau JPG tidak membawa informasi skala DICOM.
    const px = Math.hypot(m.x2 - m.x1, m.y2 - m.y1) / s;
    g.fillStyle = '#3FB3BC'; g.font = '12px ui-monospace,monospace';
    g.fillText(`${px.toFixed(0)} px`, (m.x1 + m.x2) / 2 + 8, (m.y1 + m.y2) / 2 - 6);
  }

  const info = document.getElementById('pv-info');
  if (info) info.textContent =
    `${iw}×${ih} · zoom ${(pacsView.zoom * 100).toFixed(0)}% · ` +
    `terang ${pacsView.brightness}% · kontras ${pacsView.contrast}%` +
    (pacsMeasure ? ' · ukuran dalam piksel citra' : '');
}