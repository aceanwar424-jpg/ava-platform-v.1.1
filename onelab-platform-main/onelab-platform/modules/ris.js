// ═══════════════════════════════════════════════════════════════
// MODULE: RIS — Radiology Information System (Fase 5.3)
// Menggantikan modules/radiology.js yang hanya mengunggah berkas dan mencetak,
// serta menumpang tabel lab_results.
//
// Alur: Dijadwalkan → Antrian Alat → Dikerjakan → Menunggu Baca → Dibaca → Selesai
//
// "Antrian Alat" mewakili langkah lapangan yang sebelumnya hilang: order dikirim
// ke antrian modalitas (di PACS/RIS sungguhan lewat DICOM Modality Worklist),
// radiografer memanggilnya di mesin, memotret, lalu citra masuk konsol penerimaan
// PACS. Web app ini tidak berbicara DICOM langsung ke alat — langkah ini merekam
// prosesnya; unggah citra tetap manual sampai gateway DICOM dipasang.
// ═══════════════════════════════════════════════════════════════

const RIS_STATUS = {
  'Dijadwalkan':   { c: '#B45309', bg: '#FBF1E4' },
  'Antrian Alat':  { c: '#9333EA', bg: '#F3E8FF' },
  'Dikerjakan':    { c: '#0E7C86', bg: '#E6F2F3' },
  'Menunggu Baca': { c: '#7C3AED', bg: '#F1EAFB' },
  'Dibaca':        { c: '#123A5C', bg: '#EAF0F6' },
  'Selesai':       { c: '#15803D', bg: '#E8F5EC' },
  'Dibatalkan':    { c: '#B91C1C', bg: '#FBEAEA' },
};

let risOrders = [], risModalities = [], risFilter = '';

async function renderRIS() {
  document.getElementById('main-content').innerHTML = `
    <div class="lis-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#0A2342,#0d2d54);color:#fff;border-radius:8px;padding:8px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" style="color:#fff;border-color:rgba(255,255,255,0.2)" onclick="openCategory('radiology')" title="Kembali ke daftar menu Radiologi">← Menu Radiologi</button>
        <div>
          <h1 style="margin:0;font-size:15px;color:#fff;font-weight:800">Radiologi (RIS &amp; PACS)</h1>
          <span class="lis-sub" style="font-size:11px;color:#9db4d0">Radiology Information System</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="ris-date-badge" class="lis-date" style="font-size:11px;color:#cfe0f2"></span>
        <button class="btn btn-teal btn-sm" onclick="openRISOrderForm()">+ Order Pemeriksaan</button>
      </div>
    </div>
    <div id="ris-warn"></div>
    <div class="tabs" id="ris-tabs" style="margin-bottom:14px">
      <button class="tab-btn active" onclick="filterRIS('',this)">Semua</button>
      ${Object.keys(RIS_STATUS).filter(s => s !== 'Dibatalkan')
        .map(s => `<button class="tab-btn" onclick="filterRIS('${s}',this)">${s}</button>`).join('')}
    </div>
    <div id="ris-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px"></div>
    <div id="ris-content"><div class="loading-row"><div class="spinner"></div></div></div>`;

  const badge = document.getElementById('ris-date-badge');
  if (badge) badge.textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  await loadRISOrders();
}

function filterRIS(s, btn) {
  risFilter = s;
  document.querySelectorAll('#ris-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  paintRIS();
}

async function loadRISOrders() {
  try {
    const [orders, mods] = await Promise.all([
      sbGet('radiology_orders', 'select=*&order=scheduled_at.desc&limit=300'),
      risModalities.length ? risModalities : sbGet('modalities', 'select=*&is_active=eq.true&order=code'),
    ]);
    risOrders = Array.isArray(orders) ? orders : [];
    risModalities = Array.isArray(mods) ? mods : [];
    document.getElementById('ris-warn').innerHTML = '';
    paintRIS();
  } catch (e) {
    document.getElementById('ris-warn').innerHTML =
      `<div class="status-box status-warn" style="margin-bottom:14px">
        Modul RIS belum tersedia — jalankan <code>supabase_fase5_ris.sql</code>, lalu buat
        bucket <code>pacs</code> di Supabase Storage (non-publik).</div>`;
    document.getElementById('ris-content').innerHTML = '';
  }
}

function paintRIS() {
  const list = risFilter ? risOrders.filter(o => o.status === risFilter) : risOrders;
  const kpi = document.getElementById('ris-kpi');
  if (kpi) {
    const today = new Date().toISOString().split('T')[0];
    kpi.innerHTML = [
      { l: 'Jadwal Hari Ini', v: risOrders.filter(o => (o.scheduled_at || '').startsWith(today)).length, c: '#0E7C86' },
      { l: 'Menunggu Baca', v: risOrders.filter(o => o.status === 'Menunggu Baca').length, c: '#7C3AED' },
      { l: 'Cito', v: risOrders.filter(o => o.priority === 'Cito' && o.status !== 'Selesai').length, c: '#B91C1C' },
      { l: 'Selesai', v: risOrders.filter(o => o.status === 'Selesai').length, c: '#15803D' },
    ].map(k => `<div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${k.c};
      border-radius:10px;padding:12px">
      <div style="font-size:20px;font-weight:800;color:${k.c};font-variant-numeric:tabular-nums">${k.v}</div>
      <div style="font-size:10.5px;color:var(--gray)">${k.l}</div></div>`).join('');
  }

  const el = document.getElementById('ris-content'); if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <h3>${risOrders.length ? 'Tidak ada pemeriksaan pada status ini' : 'Belum ada order radiologi'}</h3>
      <button class="btn btn-teal" style="margin-top:10px" onclick="openRISOrderForm()">+ Order Pemeriksaan</button></div>`;
    return;
  }

  el.innerHTML = `<div class="table-wrap" style="border:1px solid #d3dae1;border-radius:8px;overflow:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#0A2342;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;position:sticky;top:0">
          <th style="padding:7px 10px;text-align:left">No. Akses</th>
          <th style="padding:7px 10px;text-align:left">Pasien</th>
          <th style="padding:7px 10px;text-align:left">Pemeriksaan</th>
          <th style="padding:7px 10px;text-align:left">Jadwal</th>
          <th style="padding:7px 10px;text-align:left">Status</th>
          <th style="padding:7px 10px;text-align:center">Aksi</th>
        </tr>
      </thead>
      <tbody>${list.map(o => {
        const st = RIS_STATUS[o.status] || RIS_STATUS['Dijadwalkan'];
        return `<tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 10px"><span style="font-family:ui-monospace,monospace;font-size:11.5px;font-weight:700;color:var(--teal)">${o.accession_no || '—'}</span>
            ${o.priority === 'Cito' ? '<div style="font-size:10px;color:#B91C1C;font-weight:700">CITO</div>' : ''}</td>
          <td style="padding:8px 10px"><div style="font-weight:700;color:var(--navy)">${o.patient_name || '—'}</div>
            <div style="font-size:11px;color:var(--gray)">${o.mr_number || ''}</div></td>
          <td style="padding:8px 10px"><div style="font-size:12.5px;font-weight:600">${o.procedure_name || '—'}</div>
            <div style="font-size:11px;color:var(--gray)">${o.modality_code || ''}</div></td>
          <td style="padding:8px 10px;font-size:11.5px;color:var(--gray)">${o.scheduled_at ? new Date(o.scheduled_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
          <td style="padding:8px 10px"><span style="background:${st.bg};color:${st.c};border:1px solid ${st.c}35;padding:2px 8px;border-radius:4px;
            font-size:11px;font-weight:700">${o.status}</span></td>
          <td style="padding:8px 10px;text-align:center"><div class="act-row" style="justify-content:center;flex-wrap:wrap">
            ${o.status === 'Dijadwalkan' ? `<button class="btn btn-teal btn-xs" onclick="risOpenSendDevice(${o.id})">Kirim ke Alat</button>` : ''}
            ${o.status === 'Antrian Alat' ? `<button class="btn btn-ghost btn-xs" onclick="risOpenSendDevice(${o.id})" title="Ubah alat/radiografer">Edit</button>
              <button class="btn btn-teal btn-xs" onclick="risStartAcquisition(${o.id})">Mulai Akuisisi</button>` : ''}
            ${o.status === 'Dikerjakan' ? `<button class="btn btn-ghost btn-xs" onclick="openPacsUpload(${o.id},'${o.accession_no}')">Terima Citra</button>
              <button class="btn btn-teal btn-xs" onclick="risSetStatus(${o.id},'Menunggu Baca')">Selesai Foto</button>` : ''}
            ${['Menunggu Baca', 'Dibaca', 'Selesai'].includes(o.status)
              ? `<button class="btn btn-ghost btn-xs" onclick="openPacsViewer(${o.id},'${o.accession_no}')">Citra</button>
                 <button class="btn btn-teal btn-xs" onclick="openRISReport(${o.id})">Laporan</button>` : ''}
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

async function openRISOrderForm() {
  if (!risModalities.length) {
    try { risModalities = await sbGet('modalities', 'select=*&is_active=eq.true&order=code') || []; }
    catch (e) { toast('Jalankan supabase_fase5_ris.sql dulu', 'warn'); return; }
  }
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  openModal(`
    <div class="modal-header"><div class="modal-title">🫁 Order Pemeriksaan Radiologi</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div class="form-group"><label>Nama Pasien *</label>
      <div style="display:flex;gap:6px">
        <input type="text" id="rf-name" oninput="risSearchPatient(this.value)" autocomplete="off" style="flex:1">
        <input type="text" id="rf-mr" placeholder="No. RM" readonly
          style="width:130px;background:var(--bg2);font-family:ui-monospace,monospace;font-size:12px">
      </div>
      <div id="rf-pat-results" style="position:relative"></div></div>
    <div class="form-row">
      <div class="form-group"><label>Modalitas *</label>
        <select id="rf-mod">${risModalities.map(m => `<option value="${m.id}" data-code="${m.code}">${m.code} — ${m.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Prioritas</label>
        <select id="rf-prio"><option>Rutin</option><option>Cito</option></select></div>
    </div>
    <div class="form-group"><label>Jenis Pemeriksaan *</label>
      <input type="text" id="rf-proc" placeholder="Thorax PA, USG Abdomen, ..."></div>
    <div class="form-group"><label>Keterangan Klinis</label>
      <textarea id="rf-clin" rows="2" placeholder="Alasan pemeriksaan, dugaan diagnosis"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Dokter Perujuk</label><input type="text" id="rf-ref"></div>
      <div class="form-group"><label>Jadwal</label>
        <input type="datetime-local" id="rf-sched" value="${now.toISOString().slice(0, 16)}"></div>
    </div>
    <div class="form-group"><label>Persiapan Pasien</label>
      <input type="text" id="rf-prep" placeholder="Puasa 6 jam, minum air putih..."></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveRISOrder()">Buat Order</button>
    </div>`, 'wide');
}

let _risPatTimer = null;
function risSearchPatient(q) {
  clearTimeout(_risPatTimer);
  const box = document.getElementById('rf-pat-results'); if (!box) return;
  if (!q || q.trim().length < 3) { box.innerHTML = ''; return; }
  _risPatTimer = setTimeout(async () => {
    try {
      const rows = await sbGet('admissions',
        `select=mr_number,patient_name,patient_gender,patient_dob&patient_name=ilike.${encodeURIComponent('%' + q.trim() + '%')}&mr_number=not.is.null&order=created_at.desc&limit=15`);
      const seen = {}, uniq = [];
      (rows || []).forEach(r => { if (!seen[r.mr_number]) { seen[r.mr_number] = 1; uniq.push(r); } });
      box.innerHTML = uniq.length ? `<div style="position:absolute;z-index:50;left:0;right:0;background:#fff;
        border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);max-height:200px;overflow:auto">
        ${uniq.slice(0, 8).map(r => `<div onclick='risPickPatient(${JSON.stringify(r).replace(/'/g, "&#39;")})'
          style="padding:8px 11px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12.5px">
          <div style="font-weight:650">${r.patient_name}</div>
          <div style="font-size:11px;color:var(--teal);font-family:ui-monospace,monospace">${r.mr_number}</div>
        </div>`).join('')}</div>` : '';
    } catch (e) { box.innerHTML = ''; }
  }, 300);
}

function risPickPatient(p) {
  document.getElementById('rf-name').value = p.patient_name || '';
  document.getElementById('rf-mr').value = p.mr_number || '';
  document.getElementById('rf-name').dataset.gender = p.patient_gender || '';
  document.getElementById('rf-name').dataset.dob = p.patient_dob || '';
  document.getElementById('rf-pat-results').innerHTML = '';
}

async function saveRISOrder() {
  const name = document.getElementById('rf-name').value.trim();
  const proc = document.getElementById('rf-proc').value.trim();
  if (!name) { toast('Nama pasien wajib diisi', 'err'); return; }
  if (!proc) { toast('Jenis pemeriksaan wajib diisi', 'err'); return; }

  const modSel = document.getElementById('rf-mod');
  const sched = document.getElementById('rf-sched').value;
  const nameEl = document.getElementById('rf-name');

  try {
    const acc = await sbRpc('next_accession', {});
    await sbPost('radiology_orders', {
      accession_no: acc,
      mr_number: document.getElementById('rf-mr').value.trim() || null,
      patient_name: name,
      patient_gender: nameEl.dataset.gender || null,
      patient_dob: nameEl.dataset.dob || null,
      modality_id: parseInt(modSel.value),
      modality_code: modSel.options[modSel.selectedIndex]?.dataset.code || null,
      procedure_name: proc,
      clinical_info: document.getElementById('rf-clin').value.trim() || null,
      referring_doctor: document.getElementById('rf-ref').value.trim() || null,
      priority: document.getElementById('rf-prio').value,
      scheduled_at: sched ? new Date(sched).toISOString() : null,
      preparation: document.getElementById('rf-prep').value.trim() || null,
      status: 'Dijadwalkan',
      created_by: getUserName ? getUserName() : 'User',
      updated_at: new Date().toISOString(),
    });
    await logActivity('ris_order', 'radiology_orders', acc, `Order radiologi ${proc} — ${name}`, name);
    toast(`✅ Order ${acc} dibuat`, 'ok');
    closeModalForce(); await loadRISOrders();
  } catch (e) {
    toast('❌ ' + (/not find the function/i.test(e.message) ? 'Jalankan supabase_fase5_ris.sql dulu' : e.message), 'err');
  }
}

async function risSetStatus(id, status) {
  const patch = { status, updated_at: new Date().toISOString() };
  if (status === 'Dikerjakan') { patch.performed_at = new Date().toISOString(); patch.performed_by = getUserName ? getUserName() : 'User'; }
  try { await sbPatch('radiology_orders', id, patch); await loadRISOrders(); }
  catch (e) { toast('❌ ' + e.message, 'err'); }
}

// ── Kirim ke Alat (antrian modalitas) ──────────────────────────
// Langkah yang mewakili "push order ke antrian mesin". Di PACS/RIS sungguhan
// ini adalah DICOM Modality Worklist; di sini kita merekam alat tujuan dan
// radiografernya lalu memindahkan order ke status "Antrian Alat".
function risOpenSendDevice(id) {
  const o = risOrders.find(x => x.id === id) || {};
  openModal(`
    <div class="modal-header"><div class="modal-title">📡 Kirim ke Alat — ${o.accession_no || ''}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      <b>${o.patient_name || ''}</b> · ${o.procedure_name || ''} (${o.modality_code || ''})<br>
      Kirim order ke antrian alat agar radiografer dapat memanggilnya di mesin.
    </div>
    <div class="form-row">
      <div class="form-group"><label>Alat / Modalitas *</label>
        <input type="text" id="rd-device" value="${o.device_name || o.modality_code || ''}" placeholder="mis. CT-01, DR-Ruang 2"></div>
      <div class="form-group"><label>Ruang</label>
        <input type="text" id="rd-room" value="${o.device_room || ''}" placeholder="Ruang pemeriksaan"></div>
    </div>
    <div class="form-group"><label>Radiografer</label>
      <input type="text" id="rd-rad" value="${o.radiographer || ''}" placeholder="Nama petugas yang memotret"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="risSendDevice(${id})">📡 Kirim ke Antrian Alat</button>
    </div>`);
}

async function risSendDevice(id) {
  const device = document.getElementById('rd-device')?.value.trim();
  if (!device) { toast('Isi alat/modalitas tujuan', 'warn'); return; }
  const patch = {
    status: 'Antrian Alat',
    device_name: device,
    device_room: document.getElementById('rd-room')?.value.trim() || null,
    radiographer: document.getElementById('rd-rad')?.value.trim() || null,
    queued_to_device_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  try {
    await sbPatch('radiology_orders', id, patch);
    const o = risOrders.find(x => x.id === id) || {};
    if (typeof logActivity === 'function')
      logActivity('ris_send_device', 'radiology_orders', o.accession_no || id,
        `Order dikirim ke alat ${device}`, o.patient_name);
    toast(`📡 Terkirim ke antrian ${device}`, 'ok');
    closeModalForce(); await loadRISOrders();
  } catch (e) {
    toast('❌ ' + (/column .* does not exist/i.test(e.message)
      ? 'Jalankan supabase_ris_modality_worklist.sql dulu' : e.message), 'err');
  }
}

// Radiografer mulai memotret di alat.
async function risStartAcquisition(id) {
  const now = new Date().toISOString();
  try {
    await sbPatch('radiology_orders', id, {
      status: 'Dikerjakan', acquisition_started_at: now,
      performed_at: now, performed_by: getUserName ? getUserName() : 'User', updated_at: now,
    });
    await loadRISOrders();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

// ── Laporan radiolog ───────────────────────────────────────────
async function openRISReport(orderId) {
  const o = risOrders.find(x => x.id === orderId) || {};
  let rep = null;
  try {
    const rows = await sbGet('radiology_reports', `select=*&order_id=eq.${orderId}&order=id.desc&limit=1`);
    rep = rows?.[0] || null;
  } catch (e) { toast('Jalankan supabase_fase5_ris.sql dulu', 'warn'); return; }

  // Pembanding: pemeriksaan sebelumnya pada pasien yang sama
  let prior = [];
  if (o.mr_number) {
    prior = await sbGet('radiology_orders',
      `select=accession_no,procedure_name,performed_at&mr_number=eq.${encodeURIComponent(o.mr_number)}&status=eq.Selesai&order=performed_at.desc&limit=5`).catch(() => []);
  }

  const locked = rep?.locked;
  openModal(`
    <div class="modal-header"><div class="modal-title">Laporan — ${o.accession_no || ''}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>

    <div style="background:var(--bg2);border-radius:8px;padding:10px 13px;margin-bottom:12px;font-size:12.5px">
      <b>${o.patient_name || '—'}</b> · ${o.mr_number || ''} · ${o.procedure_name || ''} (${o.modality_code || ''})
      ${o.clinical_info ? `<div style="margin-top:4px;color:var(--text2)">Klinis: ${o.clinical_info}</div>` : ''}
      ${prior.length ? `<div style="margin-top:5px;font-size:11.5px;color:var(--gray)">
        Pemeriksaan sebelumnya: ${prior.map(p => `${p.procedure_name} (${p.performed_at ? formatDateShort(p.performed_at) : '—'})`).join(' · ')}</div>` : ''}
    </div>

    ${locked ? `<div style="background:#E8F5EC;border:1px solid #15803D55;border-radius:8px;padding:9px 13px;
      margin-bottom:12px;font-size:12.5px;color:#15803D">
      Ditandatangani ${rep.radiologist || ''} pada ${rep.signed_at ? new Date(rep.signed_at).toLocaleString('id-ID') : ''}</div>` : ''}

    <div class="form-group"><label>Teknik Pemeriksaan</label>
      <input type="text" id="rr-tech" value="${rep?.technique || ''}" ${locked ? 'disabled' : ''}></div>
    <div class="form-group"><label>Pembanding</label>
      <input type="text" id="rr-comp" value="${rep?.comparison || ''}" ${locked ? 'disabled' : ''}
        placeholder="Foto sebelumnya, atau: tidak ada pembanding"></div>
    <div class="form-group"><label>Temuan (Findings)</label>
      <textarea id="rr-find" rows="5" ${locked ? 'disabled' : ''}>${rep?.findings || ''}</textarea></div>
    <div class="form-group"><label>Kesan (Impression) *</label>
      <textarea id="rr-imp" rows="3" ${locked ? 'disabled' : ''}>${rep?.impression || ''}</textarea></div>
    <div class="form-group"><label>Saran</label>
      <textarea id="rr-rec" rows="2" ${locked ? 'disabled' : ''}>${rep?.recommendation || ''}</textarea></div>
    <div class="form-group" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="rr-crit" ${rep?.is_critical ? 'checked' : ''} ${locked ? 'disabled' : ''} style="width:auto">
      <label style="margin:0">Temuan kritis — wajib dilaporkan segera ke dokter perujuk</label>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      ${rep?.id ? `<button class="btn btn-ghost" onclick="printRISReport(${orderId})">🖨 Cetak</button>` : ''}
      ${!locked ? `<button class="btn btn-ghost" onclick="saveRISReport(${orderId},${rep?.id || 'null'},false)">Simpan Draft</button>
        <button class="btn btn-teal" onclick="saveRISReport(${orderId},${rep?.id || 'null'},true)">🔏 Tandatangani</button>` : ''}
    </div>`, 'wide');
}

async function saveRISReport(orderId, repId, sign) {
  const imp = document.getElementById('rr-imp').value.trim();
  if (sign && !imp) { toast('Kesan wajib diisi sebelum ditandatangani', 'err'); return; }

  const o = risOrders.find(x => x.id === orderId) || {};
  const payload = {
    order_id: orderId, accession_no: o.accession_no,
    technique: document.getElementById('rr-tech').value.trim() || null,
    comparison: document.getElementById('rr-comp').value.trim() || null,
    findings: document.getElementById('rr-find').value.trim() || null,
    impression: imp || null,
    recommendation: document.getElementById('rr-rec').value.trim() || null,
    is_critical: document.getElementById('rr-crit').checked,
    radiologist: getUserName ? getUserName() : 'Radiolog',
    read_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    let id = repId;
    if (id) await sbPatch('radiology_reports', id, payload);
    else { const r = await sbPost('radiology_reports', payload); id = r?.[0]?.id || r?.id; }

    if (sign) {
      await sbRpc('sign_rad_report', { p_report_id: id });
      toast('🔏 Laporan ditandatangani', 'ok');
    } else {
      await sbPatch('radiology_orders', orderId, { status: 'Dibaca', updated_at: new Date().toISOString() });
      toast('✅ Draft laporan tersimpan', 'ok');
    }
    closeModalForce(); await loadRISOrders();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

async function printRISReport(orderId) {
  const o = risOrders.find(x => x.id === orderId) || {};
  const rows = await sbGet('radiology_reports', `select=*&order_id=eq.${orderId}&order=id.desc&limit=1`).catch(() => []);
  const r = rows?.[0]; if (!r) { toast('Laporan belum ada', 'warn'); return; }
  const org = localStorage.getItem('ol_org_name') || 'OneLab Diagnostics';
  const w = window.open('', '_blank');
  const sec = (t, v) => v ? `<div class="sec"><div class="lbl">${t}</div><div>${String(v).replace(/\n/g, '<br>')}</div></div>` : '';
  w.document.write(`<html><head><meta charset="utf-8"><title>${o.accession_no}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:26px;max-width:720px;margin:auto;line-height:1.55}
      h2{margin:0 0 2px} .sub{color:#666;font-size:11px;margin-bottom:16px}
      .box{border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:11.5px}
      .sec{margin-bottom:12px} .lbl{font-weight:700;font-size:11px;text-transform:uppercase;
        letter-spacing:.06em;color:#555;margin-bottom:3px}
      .crit{background:#FBEAEA;border:1px solid #B91C1C;color:#B91C1C;padding:8px 12px;
        border-radius:6px;font-weight:700;margin-bottom:12px}
      .sign{margin-top:44px;text-align:right}
      .sign div{display:inline-block;width:220px;text-align:center;border-top:1px solid #333;padding-top:4px}</style>
    </head><body>
    <h2>Hasil Pemeriksaan Radiologi</h2>
    <div class="sub">${org} · ${o.accession_no || ''}</div>
    <div class="box"><b>${o.patient_name || ''}</b> · ${o.mr_number || ''} ·
      ${o.patient_gender || ''} ${o.patient_dob ? '· ' + o.patient_dob : ''}<br>
      Pemeriksaan: ${o.procedure_name || ''} (${o.modality_code || ''})<br>
      Dokter perujuk: ${o.referring_doctor || '—'} ·
      Tanggal: ${o.performed_at ? new Date(o.performed_at).toLocaleString('id-ID') : '—'}
      ${o.clinical_info ? `<br>Keterangan klinis: ${o.clinical_info}` : ''}</div>
    ${r.is_critical ? '<div class="crit">⚠ TEMUAN KRITIS — telah dilaporkan ke dokter perujuk</div>' : ''}
    ${sec('Teknik', r.technique)}
    ${sec('Pembanding', r.comparison)}
    ${sec('Temuan', r.findings)}
    ${sec('Kesan', r.impression)}
    ${sec('Saran', r.recommendation)}
    <div class="sign"><div>${r.radiologist || ''}<br>
      <span style="font-size:10px;color:#666">${r.signed_at ? 'Ditandatangani ' + new Date(r.signed_at).toLocaleString('id-ID') : 'Draft'}</span></div></div>
    <script>window.print()</script></body></html>`);
  w.document.close();
}