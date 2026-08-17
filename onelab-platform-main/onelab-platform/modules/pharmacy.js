// ═══════════════════════════════════════════════════════════════
// MODULE: Farmasi / Apotek
//
// Prinsip yang dipegang modul ini:
//   · Keselamatan pasien di atas kenyamanan. Peringatan alergi dan interaksi
//     obat TIDAK bisa dilewati diam-diam — bila diteruskan, alasannya wajib
//     dicatat dan tersimpan pada resep.
//   · Stok obat TIDAK BOLEH minus. Berbeda dengan reagen laboratorium yang
//     sengaja diizinkan minus supaya pekerjaan klinis tidak terhambat, obat
//     yang tidak ada memang tidak bisa diserahkan.
//   · Seluruh pemotongan stok berjalan di dalam fungsi basis data agar atomik
//     dan mengikuti urutan kedaluwarsa terdekat (FEFO).
//
// Seluruh nama global diawali `rx` untuk mencegah tabrakan antar modul.
// ═══════════════════════════════════════════════════════════════

const RX_STATUS = {
  'Draft':      { c: '#6B7A8B', bg: '#EEF1F4' },
  'Aktif':      { c: '#B45309', bg: '#FBF1E4' },
  'Diserahkan': { c: '#15803D', bg: '#E8F5EC' },
  'Sebagian':   { c: '#0E7C86', bg: '#E6F2F3' },
  'Dibatalkan': { c: '#B91C1C', bg: '#FBEAEA' },
};

const RX_GOLONGAN = ['Bebas', 'Bebas Terbatas', 'Keras', 'Narkotika', 'Psikotropika'];

let rxTab = 'resep';
let rxPrescriptions = [], rxDrugs = [], rxLines = [];
let rxWarnAllergy = null, rxWarnInteraction = null;

async function renderPharmacy() {
  document.getElementById('main-content').innerHTML = `
    <div class="lis-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#0A2342,#0d2d54);color:var(--on-accent);border-radius:8px;padding:8px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" style="color:var(--on-accent);border-color:rgba(255,255,255,0.2)" onclick="openCategory('pharmacy')" title="Kembali ke daftar menu Farmasi">← Menu Farmasi</button>
        <div>
          <h1 style="margin:0;font-size:15px;color:var(--on-accent);font-weight:800">Farmasi &amp; Apotek</h1>
          <span class="lis-sub" style="font-size:11px;color:#9db4d0">Pharmacy Information System</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="rx-date-badge" class="lis-date" style="font-size:11px;color:#cfe0f2"></span>
        <button class="btn btn-teal btn-sm" onclick="rxOpenPrescriptionForm()">+ Resep Baru</button>
      </div>
    </div>
    <div id="rx-warn"></div>
    <div class="tabs" id="rx-tabs" style="margin-bottom:14px">
      <button class="tab-btn active" onclick="rxSwitchTab('resep',this)">Resep Elektronik</button>
      <button class="tab-btn" onclick="rxSwitchTab('obat',this)">Master Obat</button>
      <button class="tab-btn" onclick="rxSwitchTab('stok',this)">Stok &amp; Kedaluwarsa</button>
      <button class="tab-btn" onclick="rxSwitchTab('narkotika',this)">Pencatatan Narkotika</button>
      <button class="tab-btn" onclick="rxSwitchTab('laporan',this)">Laporan Farmasi</button>
    </div>
    <div id="rx-content"><div class="loading-row"><div class="spinner"></div></div></div>`;

  const badge = document.getElementById('rx-date-badge');
  if (badge) badge.textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  await rxLoadAll();
}

function rxSwitchTab(t, btn) {
  rxTab = t;
  document.querySelectorAll('#rx-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  rxPaint();
}

async function rxLoadAll() {
  try {
    const [rx, drugs] = await Promise.all([
      sbGet('prescriptions', 'select=*&order=rx_date.desc,id.desc&limit=200'),
      sbGet('pharmacy_drugs', 'select=*&order=generic_name.asc&limit=1000'),
    ]);
    rxPrescriptions = Array.isArray(rx) ? rx : [];
    rxDrugs = Array.isArray(drugs) ? drugs : [];
    document.getElementById('rx-warn').innerHTML = '';
    rxPaint();
  } catch (e) {
    document.getElementById('rx-warn').innerHTML =
      `<div class="status-box status-warn" style="margin-bottom:14px">
        Modul farmasi belum tersedia — jalankan <code>supabase_pharmacy.sql</code> di Supabase SQL Editor.</div>`;
    document.getElementById('rx-content').innerHTML = '';
  }
}

function rxPaint() {
  const el = document.getElementById('rx-content'); if (!el) return;
  if (rxTab === 'resep') rxPaintPrescriptions(el);
  else if (rxTab === 'obat') rxPaintDrugs(el);
  else if (rxTab === 'stok') rxPaintStock(el);
  else if (rxTab === 'narkotika') rxPaintNarcotic(el);
  else rxPaintReport(el);
}

// ══════════════════════════════════════════════════════════════
// RESEP
// ══════════════════════════════════════════════════════════════
function rxPaintPrescriptions(el) {
  if (!rxPrescriptions.length) {
    el.innerHTML = `<div class="empty-state">
      <h3>Belum ada resep</h3>
      <button class="btn btn-teal" style="margin-top:10px" onclick="rxOpenPrescriptionForm()">+ Resep Baru</button></div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap" style="border:1px solid #d3dae1;border-radius:8px;overflow:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:var(--navy-deep);color:var(--on-accent);font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;position:sticky;top:0">
          <th style="padding:7px 10px;text-align:left">No. Resep</th>
          <th style="padding:7px 10px;text-align:left">Pasien</th>
          <th style="padding:7px 10px;text-align:left">Dokter</th>
          <th style="padding:7px 10px;text-align:left">Tanggal</th>
          <th style="padding:7px 10px;text-align:right">Nilai</th>
          <th style="padding:7px 10px;text-align:left">Status</th>
          <th style="padding:7px 10px;text-align:center">Aksi</th>
        </tr>
      </thead>
      <tbody>${rxPrescriptions.map(p => {
        const st = RX_STATUS[p.status] || RX_STATUS['Draft'];
        const warn = p.allergy_warning || p.interaction_warning;
        return `<tr style="border-bottom:1px solid var(--bg2)">
          <td style="padding:8px 10px"><span style="font-family:ui-monospace,monospace;font-size:11.5px;font-weight:700;color:var(--teal)">${p.rx_number || '—'}</span>
            ${warn ? '<div style="font-size:10px;color:var(--danger-strong);font-weight:700">PERINGATAN ALERGI</div>' : ''}</td>
          <td style="padding:8px 10px"><div style="font-weight:700;color:var(--navy)">${p.patient_name || '—'}</div>
            <div style="font-size:11px;color:var(--gray)">${p.mr_number || ''}</div></td>
          <td style="padding:8px 10px;font-size:12.5px;font-weight:600">${p.doctor_name || '—'}</td>
          <td style="padding:8px 10px;font-size:11.5px;color:var(--gray)">${p.rx_date ? formatDateShort(p.rx_date) : '—'}</td>
          <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700">${formatCurrency(p.total_amount)}</td>
          <td style="padding:8px 10px"><span style="background:${st.c}15;color:${st.c};border:1px solid ${st.c}35;padding:2px 8px;border-radius:4px;
            font-size:10.5px;font-weight:700">${p.status}</span></td>
          <td style="padding:8px 10px;text-align:center"><div class="act-row" style="justify-content:center;gap:6px">
            <button class="btn btn-ghost btn-xs" onclick="rxOpenDetail(${p.id})">Rincian</button>
            ${['Aktif', 'Sebagian'].includes(p.status)
              ? `<button class="btn btn-teal btn-xs" onclick="rxOpenDispense(${p.id})">Serahkan</button>` : ''}
            ${p.status === 'Aktif'
              ? `<button class="btn btn-ghost btn-xs" style="color:var(--danger-strong);border-color:var(--danger-strong)" onclick="rxAskCancel(${p.id})">Batalkan</button>` : ''}
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

async function rxOpenPrescriptionForm() {
  if (!rxDrugs.length) await rxLoadAll();
  if (!rxDrugs.length) { toast('Master obat masih kosong — isi lewat tab Master Obat', 'warn'); return; }
  rxLines = []; rxWarnAllergy = null; rxWarnInteraction = null;

  openModal(`
    <div class="modal-header"><div class="modal-title">Resep Baru</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>

    <div class="form-group"><label>Nama Pasien *</label>
      <div style="display:flex;gap:6px">
        <input type="text" id="rx-name" oninput="rxSearchPatient(this.value)" autocomplete="off" style="flex:1">
        <input type="text" id="rx-mr" placeholder="No. RM" readonly
          style="width:130px;background:var(--bg2);font-family:ui-monospace,monospace;font-size:12px">
      </div>
      <div id="rx-pat-results" style="position:relative"></div>
      <div class="form-hint">Tautkan ke pasien terdaftar agar riwayat alergi ikut diperiksa.</div></div>

    <div id="rx-allergy-box"></div>

    <div class="form-row">
      <div class="form-group"><label>Dokter Penulis *</label>
        <input type="text" id="rx-doctor" value="${getUserName ? getUserName() : ''}"></div>
      <div class="form-group"><label>Diagnosis</label><input type="text" id="rx-dx"></div>
    </div>

    <div style="border-top:1px solid var(--border);margin:10px 0;padding-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase">Obat</div>
        <button class="btn btn-xs btn-ghost" onclick="rxAddLine()">+ Tambah Obat</button>
      </div>
      <div id="rx-lines"></div>
      <div id="rx-interaction-box"></div>
      <div style="text-align:right;font-weight:700;margin-top:8px;font-size:13px">
        Total: <span id="rx-total" style="color:var(--teal)">Rp 0</span></div>
    </div>

    <div class="form-group"><label>Catatan</label><input type="text" id="rx-notes"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="rxSavePrescription()">Simpan Resep</button>
    </div>`, 'wide');
  rxRenderLines();
}

let _rxPatTimer = null;
function rxSearchPatient(q) {
  clearTimeout(_rxPatTimer);
  const box = document.getElementById('rx-pat-results'); if (!box) return;
  if (!q || q.trim().length < 3) { box.innerHTML = ''; return; }
  _rxPatTimer = setTimeout(async () => {
    try {
      const rows = await sbGet('admissions',
        `select=mr_number,patient_name,patient_gender,patient_age&patient_name=ilike.${encodeURIComponent('%' + q.trim() + '%')}&mr_number=not.is.null&order=created_at.desc&limit=15`);
      const seen = {}, uniq = [];
      (rows || []).forEach(r => { if (!seen[r.mr_number]) { seen[r.mr_number] = 1; uniq.push(r); } });
      box.innerHTML = uniq.length ? `<div style="position:absolute;z-index:50;left:0;right:0;background:var(--white);
        border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);max-height:200px;overflow:auto">
        ${uniq.slice(0, 8).map(r => `<div onclick='rxPickPatient(${JSON.stringify(r).replace(/'/g, "&#39;")})'
          style="padding:8px 11px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12.5px">
          <div style="font-weight:650">${r.patient_name}</div>
          <div style="font-size:11px;color:var(--teal);font-family:ui-monospace,monospace">${r.mr_number}</div>
        </div>`).join('')}</div>` : '';
    } catch (e) { box.innerHTML = ''; }
  }, 300);
}

function rxPickPatient(p) {
  document.getElementById('rx-name').value = p.patient_name || '';
  document.getElementById('rx-mr').value = p.mr_number || '';
  const el = document.getElementById('rx-name');
  el.dataset.gender = p.patient_gender || '';
  el.dataset.age = p.patient_age || '';
  document.getElementById('rx-pat-results').innerHTML = '';
  rxCheckSafety();
}

function rxAddLine() { rxLines.push({ drug_id: '', qty: 1, dose: '', frequency: '', duration_days: 3, instruction: '' }); rxRenderLines(); }
function rxRemoveLine(i) { rxLines.splice(i, 1); rxRenderLines(); rxCheckSafety(); }
function rxUpdateLine(i, f, v) {
  if (!rxLines[i]) return;
  rxLines[i][f] = ['qty', 'duration_days'].includes(f) ? (parseFloat(v) || 0) : v;
  if (f === 'drug_id') { rxRenderLines(); rxCheckSafety(); } else rxUpdateTotal();
}

function rxRenderLines() {
  const el = document.getElementById('rx-lines'); if (!el) return;
  if (!rxLines.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Belum ada obat. Klik "+ Tambah Obat".</div>';
    rxUpdateTotal(); return;
  }
  el.innerHTML = `<table style="width:100%;font-size:12px"><tbody>${rxLines.map((l, i) => {
    const d = rxDrugs.find(x => String(x.id) === String(l.drug_id));
    const keras = d && ['Narkotika', 'Psikotropika', 'Keras'].includes(d.drug_class);
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:4px" colspan="2">
        <select onchange="rxUpdateLine(${i},'drug_id',this.value)" style="font-size:11.5px;padding:4px;width:100%">
          <option value="">-- Pilih obat --</option>
          ${rxDrugs.map(x => `<option value="${x.id}" ${String(l.drug_id) === String(x.id) ? 'selected' : ''}>
            ${x.generic_name}${x.brand_name ? ' (' + x.brand_name + ')' : ''} — ${x.strength || ''} ${x.dosage_form || ''} · stok ${x.stock_qty || 0}</option>`).join('')}
        </select>
        ${d ? `<div style="font-size:10.5px;margin-top:2px;color:${keras ? '#B45309' : 'var(--gray)'}">
          ${keras ? '⚠ ' : ''}Golongan ${d.drug_class || '—'}${d.is_formulary ? ' · formularium' : ' · NON-formularium'}
          ${(d.stock_qty || 0) < (l.qty || 0) ? ' · <b style="color:var(--danger-deep)">stok tidak cukup</b>' : ''}</div>` : ''}
      </td>
      <td style="padding:4px;width:34px"><button class="act-btn del" onclick="rxRemoveLine(${i})" style="font-size:10.5px;font-weight:700"></button></td>
    </tr>
    <tr style="border-bottom:1px solid var(--border)"><td colspan="3" style="padding:0 4px 6px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">
        <input type="number" min="1" value="${l.qty}" placeholder="Jumlah"
          onchange="rxUpdateLine(${i},'qty',this.value)" style="font-size:11px;padding:4px">
        <input type="text" value="${l.dose || ''}" placeholder="Dosis (1 tab)"
          onchange="rxUpdateLine(${i},'dose',this.value)" style="font-size:11px;padding:4px">
        <input type="text" value="${l.frequency || ''}" placeholder="Frekuensi (3x1)"
          onchange="rxUpdateLine(${i},'frequency',this.value)" style="font-size:11px;padding:4px">
        <input type="number" min="1" value="${l.duration_days}" placeholder="Hari"
          onchange="rxUpdateLine(${i},'duration_days',this.value)" style="font-size:11px;padding:4px">
      </div>
      <input type="text" value="${l.instruction || ''}" placeholder="Aturan pakai — sesudah makan, dll"
        onchange="rxUpdateLine(${i},'instruction',this.value)" style="font-size:11px;padding:4px;width:100%;margin-top:5px">
    </td></tr>`;
  }).join('')}</tbody></table>`;
  rxUpdateTotal();
}

function rxUpdateTotal() {
  const t = rxLines.reduce((s, l) => {
    const d = rxDrugs.find(x => String(x.id) === String(l.drug_id));
    return s + (d?.unit_price || 0) * (l.qty || 0);
  }, 0);
  const el = document.getElementById('rx-total'); if (el) el.textContent = formatCurrency(t);
}

// Pemeriksaan keselamatan — dijalankan di basis data, bukan ditebak di browser
async function rxCheckSafety() {
  const ids = rxLines.map(l => parseInt(l.drug_id)).filter(Boolean);
  const mr = document.getElementById('rx-mr')?.value.trim();

  const aBox = document.getElementById('rx-allergy-box');
  const iBox = document.getElementById('rx-interaction-box');

  rxWarnAllergy = null; rxWarnInteraction = null;
  if (aBox) aBox.innerHTML = '';
  if (iBox) iBox.innerHTML = '';
  if (!ids.length) return;

  if (mr) {
    try {
      const r = await sbRpc('rx_check_allergies', { p_mr_number: mr, p_drug_ids: ids });
      const hits = r?.matches || r?.hits || (Array.isArray(r) ? r : null);
      if (hits && hits.length) {
        rxWarnAllergy = JSON.stringify(hits);
        if (aBox) aBox.innerHTML = `
          <div style="background:#FBEAEA;border:1.5px solid var(--danger-deep);border-radius:8px;padding:11px 14px;margin-bottom:12px">
            <div style="font-weight:800;color:var(--danger-deep);font-size:13px">⚠️ PERINGATAN ALERGI</div>
            <div style="font-size:12.5px;color:var(--ink-08);margin-top:4px">
              ${hits.map(h => `<div>• ${h.drug_name || h.drug || ''} — pasien alergi <b>${h.allergen || ''}</b>${h.severity ? ' (' + h.severity + ')' : ''}</div>`).join('')}
            </div>
            <div style="font-size:11.5px;color:var(--ink-08);margin-top:6px">
              Bila tetap diresepkan, alasannya wajib diisi dan tersimpan pada resep.</div>
            <input type="text" id="rx-allergy-reason" placeholder="Alasan tetap meresepkan (wajib)"
              style="width:100%;margin-top:7px;font-size:12px;padding:6px">
          </div>`;
      }
    } catch (e) { /* pemeriksaan gagal tidak menghalangi, tetapi juga tidak menyembunyikan */ }
  }

  if (ids.length > 1) {
    try {
      const r = await sbRpc('rx_check_interactions', { p_drug_ids: ids });
      const hits = r?.matches || r?.hits || (Array.isArray(r) ? r : null);
      if (hits && hits.length) {
        rxWarnInteraction = JSON.stringify(hits);
        if (iBox) iBox.innerHTML = `
          <div style="background:#FBF1E4;border:1.5px solid var(--warn-deep);border-radius:8px;padding:11px 14px;margin-top:10px">
            <div style="font-weight:800;color:var(--warn-deep);font-size:13px">⚠️ INTERAKSI OBAT</div>
            <div style="font-size:12.5px;color:var(--ink-03);margin-top:4px">
              ${hits.map(h => `<div>• ${h.drug_a || ''} + ${h.drug_b || ''} — ${h.severity || ''}${h.description ? ': ' + h.description : ''}</div>`).join('')}
            </div>
            <input type="text" id="rx-interaction-reason" placeholder="Alasan tetap meresepkan (wajib)"
              style="width:100%;margin-top:7px;font-size:12px;padding:6px">
          </div>`;
      }
    } catch (e) { /* sama seperti di atas */ }
  }
}

async function rxSavePrescription() {
  const name = document.getElementById('rx-name').value.trim();
  if (!name) { toast('Nama pasien wajib diisi', 'err'); return; }
  const lines = rxLines.filter(l => l.drug_id && (l.qty || 0) > 0);
  if (!lines.length) { toast('Tambahkan minimal satu obat', 'err'); return; }

  // Peringatan keselamatan tidak boleh dilewati diam-diam
  const aReason = document.getElementById('rx-allergy-reason')?.value.trim() || '';
  const iReason = document.getElementById('rx-interaction-reason')?.value.trim() || '';
  if (rxWarnAllergy && !aReason) { toast('Alasan tetap meresepkan meski ada alergi wajib diisi', 'err'); return; }
  if (rxWarnInteraction && !iReason) { toast('Alasan tetap meresepkan meski ada interaksi wajib diisi', 'err'); return; }

  // Stok tidak boleh minus — obat yang tidak ada tidak bisa diserahkan
  for (const l of lines) {
    const d = rxDrugs.find(x => String(x.id) === String(l.drug_id));
    if (d && (d.stock_qty || 0) < l.qty) {
      toast(`Stok ${d.generic_name} tidak cukup (tersedia ${d.stock_qty || 0})`, 'err'); return;
    }
  }

  const nameEl = document.getElementById('rx-name');
  const header = {
    mr_number: document.getElementById('rx-mr').value.trim() || null,
    patient_name: name,
    patient_gender: nameEl.dataset.gender || null,
    patient_age: parseInt(nameEl.dataset.age) || null,
    doctor_name: document.getElementById('rx-doctor').value.trim() || null,
    diagnosis: document.getElementById('rx-dx').value.trim() || null,
    notes: document.getElementById('rx-notes').value.trim() || null,
    allergy_warning: rxWarnAllergy, allergy_override: aReason || null,
    interaction_warning: rxWarnInteraction, interaction_override: iReason || null,
  };
  const items = lines.map(l => {
    const d = rxDrugs.find(x => String(x.id) === String(l.drug_id)) || {};
    return {
      drug_id: parseInt(l.drug_id), qty: l.qty, dose: l.dose || null,
      frequency: l.frequency || null, duration_days: l.duration_days || null,
      instruction: l.instruction || null,
    };
  });

  try {
    const r = await sbRpc('rx_save_prescription', { p_header: header, p_items: items });
    toast(`✅ Resep ${r?.rx_number || ''} tersimpan`, 'ok');
    closeModalForce(); await rxLoadAll();
  } catch (e) {
    toast('❌ ' + (/not find the function/i.test(e.message)
      ? 'Jalankan supabase_pharmacy.sql dulu' : e.message), 'err');
  }
}

async function rxOpenDetail(id) {
  const p = rxPrescriptions.find(x => x.id === id) || {};
  const items = await sbGet('prescription_items', `select=*&rx_id=eq.${id}&order=id.asc`).catch(() => []);
  openModal(`
    <div class="modal-header"><div class="modal-title">${p.rx_number || 'Resep'}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="background:var(--bg2);border-radius:8px;padding:10px 13px;margin-bottom:12px;font-size:12.5px">
      <b>${p.patient_name || '—'}</b> ${p.mr_number ? '· ' + p.mr_number : ''} ·
      ${p.rx_date ? formatDateShort(p.rx_date) : ''}<br>
      Dokter: ${p.doctor_name || '—'}${p.diagnosis ? ' · Diagnosis: ' + p.diagnosis : ''}
    </div>
    ${p.allergy_override ? `<div style="background:#FBEAEA;border:1px solid #B91C1C55;border-radius:8px;
      padding:9px 12px;margin-bottom:10px;font-size:12px;color:var(--ink-08)">
      <b>Diteruskan meski ada peringatan alergi.</b> Alasan: ${p.allergy_override}</div>` : ''}
    ${p.interaction_override ? `<div style="background:#FBF1E4;border:1px solid #B4530955;border-radius:8px;
      padding:9px 12px;margin-bottom:10px;font-size:12px;color:var(--ink-03)">
      <b>Diteruskan meski ada interaksi obat.</b> Alasan: ${p.interaction_override}</div>` : ''}
    <table style="width:100%;font-size:12.5px"><thead><tr style="background:var(--bg2)">
      <th style="padding:6px;text-align:left">Obat</th><th style="padding:6px">Jumlah</th>
      <th style="padding:6px">Aturan</th><th style="padding:6px;text-align:right">Diserahkan</th>
    </tr></thead><tbody>${(items || []).map(i => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px">${i.drug_name || '—'}<div style="font-size:11px;color:var(--gray)">${i.strength || ''} ${i.dosage_form || ''}</div></td>
      <td style="padding:6px;text-align:center">${i.qty} ${i.unit || ''}</td>
      <td style="padding:6px;font-size:11.5px">${[i.dose, i.frequency, i.duration_days ? i.duration_days + ' hari' : '', i.instruction].filter(Boolean).join(' · ')}</td>
      <td style="padding:6px;text-align:right">${i.qty_dispensed || 0}</td>
    </tr>`).join('')}</tbody></table>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-ghost" onclick="rxPrintLabel(${id})">🖨 Etiket</button>
    </div>`, 'wide');
}

async function rxOpenDispense(id) {
  const p = rxPrescriptions.find(x => x.id === id) || {};
  const items = await sbGet('prescription_items', `select=*&rx_id=eq.${id}&order=id.asc`).catch(() => []);
  const adaKeras = (items || []).some(i => ['Narkotika', 'Psikotropika'].includes(i.drug_class));

  openModal(`
    <div class="modal-header"><div class="modal-title">💊 Serahkan Obat — ${p.rx_number || ''}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:10px">
      Stok dipotong mengikuti kedaluwarsa terdekat (FEFO) dalam satu transaksi.
      Bila stok salah satu obat tidak mencukupi, seluruh penyerahan dibatalkan.
    </div>
    <table style="width:100%;font-size:12.5px"><thead><tr style="background:var(--bg2)">
      <th style="padding:6px;text-align:left">Obat</th><th style="padding:6px">Diresepkan</th>
      <th style="padding:6px">Sudah</th><th style="padding:6px">Serahkan</th>
    </tr></thead><tbody>${(items || []).map(i => {
      const sisa = (i.qty || 0) - (i.qty_dispensed || 0);
      return `<tr data-rxi="${i.id}" style="border-bottom:1px solid var(--border)">
        <td style="padding:6px">${i.drug_name || '—'}</td>
        <td style="padding:6px;text-align:center">${i.qty}</td>
        <td style="padding:6px;text-align:center">${i.qty_dispensed || 0}</td>
        <td style="padding:6px"><input type="number" class="rx-give" min="0" max="${sisa}" value="${sisa}"
          style="width:75px;font-size:12px;padding:4px"></td>
      </tr>`;
    }).join('')}</tbody></table>

    ${adaKeras ? `<div style="background:#FBEAEA;border:1px solid var(--danger-deep);border-radius:8px;padding:10px 13px;
      margin-top:12px;font-size:12.5px;color:var(--ink-08)">
      <b>Mengandung golongan Narkotika/Psikotropika.</b>
      Identitas penerima wajib dicatat dan masuk register khusus.</div>` : ''}

    <div class="form-row" style="margin-top:10px">
      <div class="form-group"><label>Nama Penerima ${adaKeras ? '*' : ''}</label>
        <input type="text" id="rx-recv-name"></div>
      <div class="form-group"><label>No. Identitas ${adaKeras ? '*' : ''}</label>
        <input type="text" id="rx-recv-id" placeholder="KTP / SIM"></div>
    </div>
    <div class="form-group"><label>Hubungan dengan pasien</label>
      <input type="text" id="rx-recv-rel" placeholder="Pasien sendiri, keluarga, ..."></div>
    <div class="form-group"><label>Catatan</label><input type="text" id="rx-disp-notes"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="rxDoDispense(${id},${adaKeras})">💊 Serahkan</button>
    </div>`, 'wide');
}

async function rxDoDispense(id, perluIdentitas) {
  const items = [];
  document.querySelectorAll('[data-rxi]').forEach(r => {
    const q = parseFloat(r.querySelector('.rx-give')?.value) || 0;
    if (q > 0) items.push({ item_id: parseInt(r.getAttribute('data-rxi')), qty: q });
  });
  if (!items.length) { toast('Isi jumlah yang diserahkan', 'err'); return; }

  const nama = document.getElementById('rx-recv-name').value.trim();
  const idno = document.getElementById('rx-recv-id').value.trim();
  if (perluIdentitas && (!nama || !idno)) {
    toast('Golongan narkotika/psikotropika: nama dan nomor identitas penerima wajib diisi', 'err'); return;
  }

  const recipient = { name: nama || null, id_number: idno || null,
                      relation: document.getElementById('rx-recv-rel').value.trim() || null };
  try {
    await sbRpc('rx_dispense_prescription', {
      p_rx_id: id, p_recipient: recipient,
      p_notes: document.getElementById('rx-disp-notes').value.trim() || null,
    });
    toast('✅ Obat diserahkan, stok terpotong', 'ok');
    closeModalForce(); await rxLoadAll();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

function rxAskCancel(id) {
  openModal(`
    <div class="modal-header"><div class="modal-title">Batalkan Resep</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div class="form-group"><label>Alasan pembatalan *</label>
      <textarea id="rx-cancel-reason" rows="2"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Kembali</button>
      <button class="btn btn-danger" onclick="rxDoCancel(${id})">Batalkan Resep</button>
    </div>`);
}

async function rxDoCancel(id) {
  const r = document.getElementById('rx-cancel-reason').value.trim();
  if (!r) { toast('Alasan wajib diisi', 'err'); return; }
  try {
    await sbRpc('rx_cancel_prescription', { p_rx_id: id, p_reason: r });
    toast('Resep dibatalkan', 'info'); closeModalForce(); await rxLoadAll();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

function rxPrintLabel(id) {
  const p = rxPrescriptions.find(x => x.id === id) || {};
  sbGet('prescription_items', `select=*&rx_id=eq.${id}`).then(items => {
    const org = localStorage.getItem('ol_org_name') || 'OneLab Diagnostics';
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="utf-8"><title>Etiket ${p.rx_number}</title>
      <style>body{font-family:Arial,sans-serif;padding:14px}
        .et{border:1px solid #333;border-radius:6px;padding:10px 12px;margin-bottom:10px;
          width:300px;page-break-inside:avoid;font-size:11px}
        .h{font-weight:800;font-size:12px;border-bottom:1px solid #333;padding-bottom:3px;margin-bottom:5px}
        .n{font-size:13px;font-weight:700;margin:3px 0}</style></head><body>
      ${(items || []).map(i => `<div class="et">
        <div class="h">${org}</div>
        <div>${p.patient_name || ''} ${p.mr_number ? '· ' + p.mr_number : ''}</div>
        <div>${p.rx_date ? formatDateShort(p.rx_date) : ''} · ${p.rx_number || ''}</div>
        <div class="n">${i.drug_name || ''} ${i.strength || ''}</div>
        <div><b>${[i.dose, i.frequency].filter(Boolean).join(' · ')}</b></div>
        <div>${i.instruction || ''}</div>
        <div style="margin-top:4px;font-size:10px;color:#555">Jumlah ${i.qty} ${i.unit || ''}${i.duration_days ? ' · untuk ' + i.duration_days + ' hari' : ''}</div>
      </div>`).join('')}
      <script>window.print()</script></body></html>`);
    w.document.close();
  });
}

// ══════════════════════════════════════════════════════════════
// MASTER OBAT
// ══════════════════════════════════════════════════════════════
function rxPaintDrugs(el) {
  el.innerHTML = `
    <div class="page-header" style="margin-bottom:12px">
      <div><p style="color:var(--text3);font-size:13px">Master obat beserta golongan dan penanda formularium</p></div>
      <button class="btn btn-teal" onclick="rxOpenDrugForm()">+ Tambah Obat</button>
    </div>
    ${!rxDrugs.length ? `<div class="empty-state"><div class="ico">💊</div><h3>Master obat masih kosong</h3></div>`
      : `<div class="table-wrap"><table><thead><tr>
        <th>Nama</th><th>Sediaan</th><th>Golongan</th><th style="text-align:right">Harga</th>
        <th style="text-align:right">Stok</th><th>Aksi</th>
      </tr></thead><tbody>${rxDrugs.map(d => {
        const low = (d.stock_qty || 0) <= (d.min_stock || 0);
        const keras = ['Narkotika', 'Psikotropika'].includes(d.drug_class);
        return `<tr>
          <td><div style="font-weight:600">${d.generic_name || '—'}</div>
            <div style="font-size:11px;color:var(--gray)">${d.brand_name || ''} ${d.drug_code ? '· ' + d.drug_code : ''}</div></td>
          <td style="font-size:12px">${d.strength || ''} ${d.dosage_form || ''}</td>
          <td><span style="font-size:11px;font-weight:700;color:${keras ? '#B91C1C' : 'var(--gray)'}">
            ${keras ? '' : ''}${d.drug_class || '—'}</span>
            ${d.is_formulary ? '' : '<div style="font-size:10px;color:var(--warn-deep)">non-formularium</div>'}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(d.unit_price)}</td>
          <td style="text-align:right;font-weight:700;color:${low ? '#B91C1C' : 'var(--text)'}">${d.stock_qty || 0}
            ${low ? '<div style="font-size:10px">di bawah minimum</div>' : ''}</td>
          <td><div class="act-row">
            <button class="btn btn-ghost btn-xs" onclick="rxOpenReceive(${d.id})">+ Stok</button>
            <button class="act-btn edit" onclick="rxOpenDrugForm(${d.id})">${icon('edit', 12)}</button>
          </div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`}`;
}

function rxOpenDrugForm(id) {
  const d = id ? (rxDrugs.find(x => x.id === id) || {}) : {};
  openModal(`
    <div class="modal-header"><div class="modal-title">${id ? 'Ubah' : '💊 Tambah'} Obat</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div class="form-row">
      <div class="form-group"><label>Kode</label><input type="text" id="rd-code" value="${d.drug_code || ''}"></div>
      <div class="form-group"><label>Golongan *</label>
        <select id="rd-class">${RX_GOLONGAN.map(g => `<option${d.drug_class === g ? ' selected' : ''}>${g}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>Nama Generik *</label><input type="text" id="rd-generic" value="${d.generic_name || ''}"></div>
    <div class="form-group"><label>Nama Dagang</label><input type="text" id="rd-brand" value="${d.brand_name || ''}"></div>
    <div class="form-row">
      <div class="form-group"><label>Bentuk Sediaan</label>
        <input type="text" id="rd-form" value="${d.dosage_form || ''}" placeholder="Tablet, Sirup, Injeksi"></div>
      <div class="form-group"><label>Kekuatan</label>
        <input type="text" id="rd-strength" value="${d.strength || ''}" placeholder="500 mg"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Satuan</label><input type="text" id="rd-unit" value="${d.unit || 'tablet'}"></div>
      <div class="form-group"><label>Harga Satuan (Rp)</label><input type="number" id="rd-price" value="${d.unit_price || 0}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Stok Minimum</label><input type="number" id="rd-min" value="${d.min_stock || 0}"></div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:22px">
        <input type="checkbox" id="rd-form-ok" ${d.is_formulary !== false ? 'checked' : ''} style="width:auto">
        <label style="margin:0">Masuk formularium</label></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="rxSaveDrug(${id || 'null'})">Simpan</button>
    </div>`, 'wide');
}

async function rxSaveDrug(id) {
  const g = document.getElementById('rd-generic').value.trim();
  if (!g) { toast('Nama generik wajib diisi', 'err'); return; }
  const payload = {
    drug_code: document.getElementById('rd-code').value.trim() || null,
    generic_name: g,
    brand_name: document.getElementById('rd-brand').value.trim() || null,
    dosage_form: document.getElementById('rd-form').value.trim() || null,
    strength: document.getElementById('rd-strength').value.trim() || null,
    unit: document.getElementById('rd-unit').value.trim() || null,
    drug_class: document.getElementById('rd-class').value,
    unit_price: parseFloat(document.getElementById('rd-price').value) || 0,
    min_stock: parseFloat(document.getElementById('rd-min').value) || 0,
    is_formulary: document.getElementById('rd-form-ok').checked,
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) await sbPatch('pharmacy_drugs', id, payload);
    else await sbPost('pharmacy_drugs', payload);
    toast('✅ Obat tersimpan', 'ok'); closeModalForce(); await rxLoadAll();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

function rxOpenReceive(drugId) {
  const d = rxDrugs.find(x => x.id === drugId) || {};
  openModal(`
    <div class="modal-header"><div class="modal-title">Terima Stok — ${d.generic_name || ''}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div class="form-row">
      <div class="form-group"><label>Jumlah *</label><input type="number" min="1" id="rr-qty"></div>
      <div class="form-group"><label>No. Batch *</label><input type="text" id="rr-batch"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Kedaluwarsa *</label><input type="date" id="rr-exp"></div>
      <div class="form-group"><label>Harga Satuan (Rp)</label><input type="number" id="rr-price" value="${d.unit_price || 0}"></div>
    </div>
    <div class="form-group"><label>Pemasok</label><input type="text" id="rr-sup"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="rxDoReceive(${drugId})">Terima</button>
    </div>`);
}

async function rxDoReceive(drugId) {
  const qty = parseFloat(document.getElementById('rr-qty').value) || 0;
  const batch = document.getElementById('rr-batch').value.trim();
  const exp = document.getElementById('rr-exp').value;
  if (qty <= 0) { toast('Jumlah harus lebih dari nol', 'err'); return; }
  if (!batch) { toast('Nomor batch wajib diisi', 'err'); return; }
  if (!exp) { toast('Tanggal kedaluwarsa wajib diisi', 'err'); return; }
  try {
    await sbRpc('rx_receive_stock', {
      p_drug_id: drugId, p_qty: qty, p_batch_no: batch, p_expiry_date: exp,
      p_unit_price: parseFloat(document.getElementById('rr-price').value) || null,
      p_supplier: document.getElementById('rr-sup').value.trim() || null,
      p_notes: null,
    });
    toast('✅ Stok diterima', 'ok'); closeModalForce(); await rxLoadAll();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

// ══════════════════════════════════════════════════════════════
// STOK & KEDALUWARSA
// ══════════════════════════════════════════════════════════════
async function rxPaintStock(el) {
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  const batches = await sbGet('pharmacy_batches',
    'select=*&qty_remaining=gt.0&order=expiry_date.asc&limit=500').catch(() => []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d30 = new Date(today.getTime() + 30 * 86400000);
  const d90 = new Date(today.getTime() + 90 * 86400000);
  const exp = (b) => b.expiry_date ? new Date(b.expiry_date) : null;
  const kadaluarsa = (batches || []).filter(b => exp(b) && exp(b) < today);
  const dekat = (batches || []).filter(b => exp(b) && exp(b) >= today && exp(b) <= d90);
  const low = rxDrugs.filter(d => (d.stock_qty || 0) <= (d.min_stock || 0));

  const nama = id => rxDrugs.find(d => d.id === id)?.generic_name || `(obat ${id})`;

  el.innerHTML = `
    ${kadaluarsa.length ? `<div style="background:#FBEAEA;border:1.5px solid var(--danger-deep);border-radius:8px;
      padding:11px 14px;margin-bottom:12px">
      <div style="font-weight:800;color:var(--danger-deep);font-size:13px">${kadaluarsa.length} batch SUDAH kedaluwarsa — jangan diserahkan</div>
      <div style="font-size:11.5px;color:var(--ink-08);margin-top:3px">
        ${kadaluarsa.slice(0, 6).map(b => `${nama(b.drug_id)} lot ${b.batch_no || '—'} (${formatDateShort(b.expiry_date)}, sisa ${b.qty_remaining})`).join(' · ')}</div>
    </div>` : ''}
    ${dekat.length ? `<div style="background:#FBF1E4;border:1px solid #E0A75E;border-radius:8px;
      padding:11px 14px;margin-bottom:12px">
      <div style="font-weight:800;color:var(--warn-deep);font-size:13px">⏳ ${dekat.length} batch mendekati kedaluwarsa (≤90 hari)</div>
      <div style="font-size:11.5px;color:var(--ink-03);margin-top:3px">
        ${dekat.slice(0, 6).map(b => `${nama(b.drug_id)} lot ${b.batch_no || '—'} (${formatDateShort(b.expiry_date)})`).join(' · ')}</div>
    </div>` : ''}
    ${low.length ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;
      padding:10px 14px;margin-bottom:12px;font-size:12.5px">
      <b>${low.length} obat di bawah stok minimum:</b> ${low.slice(0, 8).map(d => d.generic_name).join(', ')}</div>` : ''}

    <div class="table-wrap"><table><thead><tr>
      <th>Obat</th><th>Batch</th><th>Kedaluwarsa</th><th style="text-align:right">Sisa</th><th>Status</th>
    </tr></thead><tbody>${(batches || []).map(b => {
      const e = exp(b);
      const st = !e ? { t: '—', c: 'var(--gray)' }
        : e < today ? { t: 'Kedaluwarsa', c: '#B91C1C' }
        : e <= d30 ? { t: '≤30 hari', c: '#B45309' }
        : e <= d90 ? { t: '≤90 hari', c: '#B45309' }
        : { t: 'Aman', c: '#15803D' };
      return `<tr>
        <td style="font-weight:600">${nama(b.drug_id)}</td>
        <td style="font-family:ui-monospace,monospace;font-size:11.5px">${b.batch_no || '—'}</td>
        <td style="font-size:12px">${b.expiry_date ? formatDateShort(b.expiry_date) : '—'}</td>
        <td style="text-align:right;font-weight:700">${b.qty_remaining}</td>
        <td><span style="color:${st.c};font-weight:700;font-size:11.5px">${st.t}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--gray)">Belum ada stok</td></tr>'}
    </tbody></table></div>`;
}

// ══════════════════════════════════════════════════════════════
// NARKOTIKA & LAPORAN
// ══════════════════════════════════════════════════════════════
async function rxPaintNarcotic(el) {
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  const reg = await sbGet('narcotic_register', 'select=*&order=created_at.desc&limit=300').catch(() => []);
  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;
      margin-bottom:12px;font-size:12.5px">
      Register khusus golongan Narkotika dan Psikotropika. Setiap penyerahan wajib mencantumkan
      identitas penerima dan tercatat di sini secara otomatis.
    </div>
    ${(reg || []).length ? `<div class="table-wrap"><table><thead><tr>
      <th>Tanggal</th><th>Obat</th><th>Pasien</th><th>Penerima</th><th>No. Identitas</th><th style="text-align:right">Jumlah</th>
    </tr></thead><tbody>${reg.map(r => `<tr>
      <td style="font-size:11.5px;color:var(--gray)">${r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : '—'}</td>
      <td style="font-weight:600">${r.drug_name || '—'}</td>
      <td>${r.patient_name || '—'}</td>
      <td>${r.recipient_name || '—'}</td>
      <td style="font-family:ui-monospace,monospace;font-size:11.5px">${r.recipient_id_number || '—'}</td>
      <td style="text-align:right;font-weight:700">${r.qty || 0}</td>
    </tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state"><div class="ico"></div><h3>Belum ada penyerahan golongan khusus</h3></div>'}`;
}

async function rxPaintReport(el) {
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  const items = await sbGet('prescription_items', 'select=drug_name,qty,qty_dispensed&limit=2000').catch(() => []);
  const pakai = {};
  (items || []).forEach(i => {
    const k = i.drug_name || '—';
    pakai[k] = (pakai[k] || 0) + (i.qty_dispensed || 0);
  });
  const top = Object.entries(pakai).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const low = rxDrugs.filter(d => (d.stock_qty || 0) <= (d.min_stock || 0));

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:16px">
      ${[{ l: 'Jenis Obat', v: rxDrugs.length, c: '#123A5C' },
         { l: 'Resep', v: rxPrescriptions.length, c: '#0E7C86' },
         { l: 'Di Bawah Minimum', v: low.length, c: '#B45309' },
         { l: 'Non-formularium', v: rxDrugs.filter(d => d.is_formulary === false).length, c: '#7C3AED' }]
        .map(k => `<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid ${k.c};
          border-radius:10px;padding:12px">
          <div style="font-size:20px;font-weight:800;color:${k.c}">${k.v}</div>
          <div style="font-size:10.5px;color:var(--gray)">${k.l}</div></div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:10px">Obat paling banyak diserahkan</div>
      ${top.length ? top.map(([n, q]) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px">
          <span>${n}</span><strong>${q}</strong></div>`).join('')
        : '<div style="color:var(--gray);font-size:12.5px">Belum ada penyerahan obat</div>'}
    </div>`;
}