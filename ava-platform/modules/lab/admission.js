// ═══════════════════════════════════════════════════════════════════════════
// MODULE: ADMISI PASIEN WALK-IN & ORDER PEMERIKSAAN LAB (FULL PAGE)
// Registrasi Pasien Mandiri & Pemilihan 530+ Parameter Tes dengan Cetak Barcode
// ═══════════════════════════════════════════════════════════════════════════

let _lisOrderSelectedTests = [];
let _lisAllProducts = [];
let _lisFilterCategory = 'ALL';
let _lisSearchQuery = '';

const LIS_CATEGORIES = [
  { id: 'ALL', label: 'Semua Parameter' },
  { id: 'HEM', label: 'Hematologi' },
  { id: 'KIM', label: 'Kimia Klinik' },
  { id: 'IMU', label: 'Imunologi & Serologi' },
  { id: 'URI', label: 'Urinalisis' },
  { id: 'FES', label: 'Feses & Parasit' },
  { id: 'MIK', label: 'Mikrobiologi' },
  { id: 'MCU', label: 'Paket MCU' }
];

async function renderLisAdmission() {
  const main = document.getElementById('main-content');
  if (!main) return;

  _lisAllProducts = (typeof loadLabProducts === 'function') ? (await loadLabProducts()) : (window.REAL_MASTER_LAB_TESTS || []);
  if (!_lisAllProducts || !_lisAllProducts.length) {
    _lisAllProducts = window.REAL_MASTER_LAB_TESTS || [];
  }

  const today = new Date();
  const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');
  const randSeq = String(Math.floor(Math.random() * 900) + 100);
  const autoBarcode = `L${dateStr}-${randSeq}`;
  const autoVisit = `WALK-LAB-${dateStr}-${randSeq}`;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif; max-width:1300px; margin:0 auto;">
      <!-- TOP BREADCRUMB & HEADER -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1px solid var(--border); padding-bottom:14px; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <button class="btn btn-ghost btn-xs" onclick="navigate('lab')" style="font-weight:700; color:var(--text3);">
              &larr; Kembali ke Daftar Sampel
            </button>
            <span style="color:var(--text3); font-size:12px;">/</span>
            <span style="font-size:11px; font-weight:800; color:#10B981; background:rgba(16,185,129,0.12); padding:2px 8px; border-radius:999px; border:1px solid rgba(16,185,129,0.25);">
              🩸 ADMISI LAB MANDIRI
            </span>
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0;">
            Pendaftaran Pasien &amp; Order Pemeriksaan Laboratorium
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:2px 0 0 0;">
            Registrasi pasien walk-in langsung di LIS, pilih tes dari 530+ parameter LOINC, dan cetak label barcode tabung.
          </p>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <button class="btn btn-ghost" onclick="navigate('lab')" style="font-weight:700;">Batal</button>
          <button class="btn btn-teal" style="font-weight:800; padding:10px 22px; font-size:13.5px; box-shadow:0 4px 12px rgba(16,185,129,0.25);" onclick="submitFullPageLisOrder('${autoVisit}')">
            💾 Simpan Order &amp; Cetak Barcode
          </button>
        </div>
      </div>

      <!-- MAIN 2-COLUMN GRID -->
      <div style="display:grid; grid-template-columns:380px 1fr; gap:20px; align-items:start;">
        <!-- KOLOM KIRI: IDENTITAS PASIEN & PERUJUK -->
        <div class="card" style="padding:20px; border-top:4px solid #0EA5E9;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:14.5px; font-weight:800; color:var(--text); margin:0;">
              📋 Data Pasien &amp; Pengirim
            </h3>
            <span style="font-size:11px; font-weight:800; font-family:monospace; color:var(--sky); background:rgba(14,165,233,0.1); padding:2px 6px; border-radius:4px;">
              ${autoVisit}
            </span>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px;">
            <div class="form-group">
              <label style="font-size:12px; font-weight:750; color:var(--text2);">Nama Lengkap Pasien *</label>
              <input type="text" id="adm-patient-name" placeholder="Contoh: Ny. Siti Rahmawati" required style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group">
                <label style="font-size:12px; font-weight:750; color:var(--text2);">NIK / KTP</label>
                <input type="text" id="adm-nik" placeholder="16 Digit NIK" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
              </div>
              <div class="form-group">
                <label style="font-size:12px; font-weight:750; color:var(--text2);">No. RM / ID</label>
                <input type="text" id="adm-mr-no" value="RM-${dateStr}-${randSeq}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px; font-family:monospace;">
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group">
                <label style="font-size:12px; font-weight:750; color:var(--text2);">Jenis Kelamin *</label>
                <select id="adm-gender" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
              <div class="form-group">
                <label style="font-size:12px; font-weight:750; color:var(--text2);">Usia / Tgl Lahir *</label>
                <input type="text" id="adm-age" placeholder="Contoh: 32 th" value="30 th" required style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
              </div>
            </div>

            <div class="form-group">
              <label style="font-size:12px; font-weight:750; color:var(--text2);">No. WhatsApp / HP</label>
              <input type="tel" id="adm-phone" placeholder="08xxxxxxxxxx" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
            </div>

            <div class="form-group">
              <label style="font-size:12px; font-weight:750; color:var(--text2);">Dokter / Klinik Perujuk</label>
              <input type="text" id="adm-doctor" placeholder="dr. Pengirim / Atas Permintaan Sendiri (APS)" value="Atas Permintaan Sendiri (APS)" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group">
                <label style="font-size:12px; font-weight:750; color:var(--text2);">Prioritas</label>
                <select id="adm-priority" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px; font-weight:750; color:#0ea5e9;">
                  <option value="RUTIN">Rutin (Standar)</option>
                  <option value="CITO">⚡ CITO (Segera &lt;1 Jam)</option>
                </select>
              </div>
              <div class="form-group">
                <label style="font-size:12px; font-weight:750; color:var(--text2);">Barcode Accession</label>
                <input type="text" id="adm-barcode" value="${autoBarcode}" readonly style="width:100%; padding:9px 12px; background:var(--bg2); border:1px solid var(--border); border-radius:8px; font-size:13px; font-weight:800; font-family:monospace; color:#10B981;">
              </div>
            </div>

            <div class="form-group">
              <label style="font-size:12px; font-weight:750; color:var(--text2);">Diagnosa Klinis / Catatan Sampling</label>
              <textarea id="adm-notes" rows="2" placeholder="Puasa 10-12 jam, riwayat diabetes, dll..." style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:12.5px; font-family:inherit; resize:vertical;"></textarea>
            </div>
          </div>
        </div>

        <!-- KOLOM KANAN: KATALOG PEMILIHAN TES & ESTIMASI -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- KATALOG FILTER & SELECTOR -->
          <div class="card" style="padding:20px; border-top:4px solid #10B981;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
              <h3 style="font-size:14.5px; font-weight:800; color:var(--text); margin:0;">
                🧪 Pilih Pemeriksaan Laboratorium (530+ Parameter)
              </h3>
              <input type="text" id="adm-test-search" placeholder="🔍 Cari nama tes, LOINC, kode..." value="${_lisSearchQuery}"
                oninput="_lisSearchQuery=this.value; renderLisAdmissionTestCatalog();"
                style="padding:7px 12px; font-size:12.5px; border:1px solid var(--border); border-radius:8px; width:260px;">
            </div>

            <!-- KATEGORI PILLS -->
            <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:12px;">
              ${LIS_CATEGORIES.map(c => `
                <button type="button" class="btn btn-xs ${c.id === _lisFilterCategory ? 'btn-teal' : 'btn-ghost'}"
                  style="font-weight:700; border-radius:6px; white-space:nowrap;"
                  onclick="_lisFilterCategory='${c.id}'; renderLisAdmissionTestCatalog();">
                  ${c.label}
                </button>
              `).join('')}
            </div>

            <!-- TEST GRID / LIST -->
            <div id="adm-test-catalog-list" style="max-height:360px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; padding:8px; background:var(--bg2);">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- RINGKASAN TES TERPILIH & ESTIMASI TABUNG/BIAYA -->
          <div class="card" style="padding:20px; background:linear-gradient(135deg, var(--card-bg) 0%, rgba(16,185,129,0.03) 100%); border:1px solid rgba(16,185,129,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h3 style="font-size:14.5px; font-weight:800; color:var(--text); margin:0;">
                🧾 Ringkasan Order &amp; Kebutuhan Tabung Sampel
              </h3>
              <span id="adm-selected-count-badge" style="font-size:11px; font-weight:800; color:#10B981; background:rgba(16,185,129,0.15); padding:3px 8px; border-radius:999px;">
                0 Tes Terpilih
              </span>
            </div>

            <div id="adm-selected-tests-tags" style="display:flex; flex-wrap:wrap; gap:8px; min-height:48px; margin-bottom:14px; align-items:center;">
              <span style="color:var(--text3); font-size:12.5px;">Belum ada pemeriksaan yang dipilih. Silakan centang tes di atas.</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:14px; flex-wrap:wrap; gap:10px;">
              <div id="adm-tube-reqs" style="font-size:12px; color:var(--text3);">
                <b>Kebutuhan Tabung:</b> <span>-</span>
              </div>
              <div style="text-align:right;">
                <span style="font-size:12px; color:var(--text3);">Estimasi Total Tarif:</span>
                <div style="font-size:20px; font-weight:800; color:#10B981;" id="adm-total-price">Rp 0</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderLisAdmissionTestCatalog();
}

function renderLisAdmissionTestCatalog() {
  const container = document.getElementById('adm-test-catalog-list');
  if (!container) return;

  const q = (_lisSearchQuery || '').toLowerCase();
  const cat = _lisFilterCategory;

  const filtered = _lisAllProducts.filter(p => {
    const matchQ = !q || (p.nama_tes && p.nama_tes.toLowerCase().includes(q))
                      || (p.kode_internal && p.kode_internal.toLowerCase().includes(q))
                      || (p.loinc_code && p.loinc_code.toLowerCase().includes(q));
    const kat = (p.kategori || '').toLowerCase();
    const matchCat = cat === 'ALL' ||
      (cat === 'HEM' && kat.includes('hematologi')) ||
      (cat === 'KIM' && kat.includes('kimia')) ||
      (cat === 'IMU' && (kat.includes('imun') || kat.includes('sero') || kat.includes('hor'))) ||
      (cat === 'URI' && kat.includes('urin')) ||
      (cat === 'FES' && kat.includes('feses')) ||
      (cat === 'MIK' && kat.includes('mikro')) ||
      (cat === 'MCU' && (kat.includes('mcu') || kat.includes('paket')));
    return matchQ && matchCat;
  });

  if (!filtered.length) {
    container.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text3); font-size:12.5px;">Tidak ditemukan parameter tes yang cocok.</div>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isChecked = _lisOrderSelectedTests.some(t => t.id === p.id);
    const price = p.harga_dasar || p.tarif || 0;
    const sample = p.sampel_type || 'Darah Vena';
    return `
      <label style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; border-radius:6px; margin-bottom:4px; background:${isChecked ? 'rgba(16,185,129,0.12)' : 'var(--bg)'}; border:1px solid ${isChecked ? 'rgba(16,185,129,0.3)' : 'var(--border)'}; cursor:pointer; transition:background .15s;">
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleLisTestSelection(${p.id}, this.checked)" style="width:16px; height:16px; accent-color:#10B981; cursor:pointer;">
          <div>
            <div style="font-weight:750; font-size:13px; color:var(--text);">${p.nama_tes}</div>
            <div style="font-size:11px; color:var(--text3);">
              <code>${p.kode_internal || 'LAB'}</code> &bull; Spesimen: ${sample} ${p.loinc_code ? `&bull; LOINC: ${p.loinc_code}` : ''}
            </div>
          </div>
        </div>
        <div style="font-weight:750; font-size:12.5px; color:#10B981;">
          ${typeof formatCurrency === 'function' ? formatCurrency(price) : 'Rp ' + Number(price).toLocaleString('id-ID')}
        </div>
      </label>
    `;
  }).join('');

  updateLisSelectedSummary();
}

function toggleLisTestSelection(productId, isChecked) {
  const prod = _lisAllProducts.find(p => p.id === productId);
  if (!prod) return;

  if (isChecked) {
    if (!_lisOrderSelectedTests.some(t => t.id === productId)) {
      _lisOrderSelectedTests.push(prod);
    }
  } else {
    _lisOrderSelectedTests = _lisOrderSelectedTests.filter(t => t.id !== productId);
  }

  renderLisAdmissionTestCatalog();
}

function removeLisSelectedTest(productId) {
  _lisOrderSelectedTests = _lisOrderSelectedTests.filter(t => t.id !== productId);
  renderLisAdmissionTestCatalog();
}

function updateLisSelectedSummary() {
  const tagsEl = document.getElementById('adm-selected-tests-tags');
  const countBadge = document.getElementById('adm-selected-count-badge');
  const priceEl = document.getElementById('adm-total-price');
  const tubeEl = document.getElementById('adm-tube-reqs');

  if (!tagsEl) return;

  if (!_lisOrderSelectedTests.length) {
    tagsEl.innerHTML = `<span style="color:var(--text3); font-size:12.5px;">Belum ada pemeriksaan yang dipilih. Silakan centang tes di atas.</span>`;
    if (countBadge) countBadge.textContent = '0 Tes Terpilih';
    if (priceEl) priceEl.textContent = 'Rp 0';
    if (tubeEl) tubeEl.innerHTML = '<b>Kebutuhan Tabung:</b> <span>-</span>';
    return;
  }

  if (countBadge) countBadge.textContent = `${_lisOrderSelectedTests.length} Tes Terpilih`;

  let totalPrice = 0;
  const tubeTypes = new Set();

  tagsEl.innerHTML = _lisOrderSelectedTests.map(t => {
function getRequiredTubesForTests(tests = []) {
  const tubes = {};
  tests.forEach(t => {
    const samp = (t.sampel_type || '').toLowerCase();
    const kat = (t.kategori || '').toLowerCase();
    let tubeKey = 'SST';
    let tubeName = 'Serum SST Gel (Tutup Kuning)';
    let tubeColor = '#FBBF24';
    let tubeSuffix = 'S';
    let tubeOrder = 2;

    if (samp.includes('edta') || kat.includes('hematologi') || t.nama_tes.includes('HbA1c')) {
      tubeKey = 'EDTA';
      tubeName = 'Darah EDTA K2 (Tutup Ungu)';
      tubeColor = '#A855F7';
      tubeSuffix = 'E';
      tubeOrder = 4;
    } else if (samp.includes('sitrat') || t.nama_tes.includes('PT') || t.nama_tes.includes('APTT')) {
      tubeKey = 'CIT';
      tubeName = 'Plasma Sitrat 3.2% (Tutup Biru)';
      tubeColor = '#38BDF8';
      tubeSuffix = 'C';
      tubeOrder = 1;
    } else if (samp.includes('urin') || kat.includes('urinalisis')) {
      tubeKey = 'URI';
      tubeName = 'Pot Urin Steril';
      tubeColor = '#F59E0B';
      tubeSuffix = 'U';
      tubeOrder = 5;
    } else if (samp.includes('feses') || kat.includes('feses')) {
      tubeKey = 'FES';
      tubeName = 'Pot Feses';
      tubeColor = '#D97706';
      tubeSuffix = 'F';
      tubeOrder = 6;
    }

    if (!tubes[tubeKey]) {
      tubes[tubeKey] = {
        key: tubeKey,
        name: tubeName,
        color: tubeColor,
        suffix: tubeSuffix,
        order: tubeOrder,
        tests: []
      };
    }
    tubes[tubeKey].tests.push(t);
  });

  return Object.values(tubes).sort((a, b) => a.order - b.order);
}

function updateLisSelectedSummary() {
  const tagsEl = document.getElementById('adm-selected-tests-tags');
  const countBadge = document.getElementById('adm-selected-count-badge');
  const priceEl = document.getElementById('adm-total-price');
  const tubeEl = document.getElementById('adm-tube-reqs');

  if (!tagsEl) return;

  if (!_lisOrderSelectedTests.length) {
    tagsEl.innerHTML = `<span style="color:var(--text3); font-size:12.5px;">Belum ada pemeriksaan yang dipilih. Silakan centang tes di atas.</span>`;
    if (countBadge) countBadge.textContent = '0 Tes Terpilih';
    if (priceEl) priceEl.textContent = 'Rp 0';
    if (tubeEl) tubeEl.innerHTML = '<b>Kebutuhan Tabung:</b> <span>-</span>';
    return;
  }

  if (countBadge) countBadge.textContent = `${_lisOrderSelectedTests.length} Tes Terpilih`;

  let totalPrice = 0;
  _lisOrderSelectedTests.forEach(t => {
    const price = t.harga_dasar || t.tarif || 0;
    totalPrice += Number(price);
  });

  tagsEl.innerHTML = _lisOrderSelectedTests.map(t => `
    <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); padding:4px 10px; border-radius:999px; font-size:12px; font-weight:750; color:#10B981;">
      <span>${t.nama_tes}</span>
      <span onclick="removeLisSelectedTest(${t.id})" style="cursor:pointer; font-weight:900; margin-left:4px; opacity:0.7;" title="Hapus">&times;</span>
    </span>
  `).join('');

  if (priceEl) {
    priceEl.textContent = typeof formatCurrency === 'function' ? formatCurrency(totalPrice) : 'Rp ' + Number(totalPrice).toLocaleString('id-ID');
  }

  const requiredTubes = getRequiredTubesForTests(_lisOrderSelectedTests);
  if (tubeEl) {
    tubeEl.innerHTML = `
      <div style="margin-top:6px;">
        <div style="font-size:11.5px; font-weight:800; color:var(--text); margin-bottom:6px;">
          🧪 Kebutuhan Tabung &amp; Order of Draw (CLSI GP41-A6):
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${requiredTubes.map(tb => `
            <div style="display:inline-flex; align-items:center; gap:6px; background:var(--bg); border:1px solid var(--border); padding:4px 10px; border-radius:8px; font-size:11.5px; border-left:4px solid ${tb.color};">
              <span style="width:8px; height:8px; border-radius:50%; background:${tb.color}; display:inline-block;"></span>
              <b>${tb.name}</b>
              <span style="font-size:10px; color:var(--text3); font-family:monospace;">(${tb.tests.length} tes)</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

async function submitFullPageLisOrder(visitNumber) {
  const patient_name = document.getElementById('adm-patient-name')?.value?.trim();
  const nik = document.getElementById('adm-nik')?.value?.trim() || null;
  const mr_no = document.getElementById('adm-mr-no')?.value?.trim() || null;
  const patient_gender = document.getElementById('adm-gender')?.value || 'L';
  const ageVal = document.getElementById('adm-age')?.value?.trim() || '30';
  const patient_phone = document.getElementById('adm-phone')?.value?.trim() || null;
  const doctor = document.getElementById('adm-doctor')?.value?.trim() || 'APS';
  const priority = document.getElementById('adm-priority')?.value || 'RUTIN';
  const baseBarcode = document.getElementById('adm-barcode')?.value?.trim() || `L${Date.now().toString().slice(-8)}`;
  const notes = document.getElementById('adm-notes')?.value?.trim() || null;

  if (!patient_name) {
    if (typeof toast === 'function') toast('Nama Pasien wajib diisi', 'err');
    return;
  }

  if (!_lisOrderSelectedTests.length) {
    if (typeof toast === 'function') toast('Pilih minimal 1 parameter pemeriksaan laboratorium', 'err');
    return;
  }

  try {
    // 1. Simpan ke admissions
    const adm = await sbPost('admissions', {
      visit_number: visitNumber,
      patient_name,
      patient_nik: nik,
      mr_number: mr_no,
      patient_gender,
      patient_age: parseInt(ageVal, 10) || 30,
      patient_phone,
      doctor_name: doctor,
      unit: 'Laboratorium',
      priority,
      status: 'In Progress',
      created_at: new Date().toISOString()
    });

    const admId = Array.isArray(adm) ? adm[0]?.id : adm?.id;

    // 2. Smart Tube Splitting
    const requiredTubes = getRequiredTubesForTests(_lisOrderSelectedTests);
    const barcodeLabelsToPrint = [];

    for (const tube of requiredTubes) {
      const tubeBarcode = `${baseBarcode}-${tube.suffix}`;
      const tubeTestNames = tube.tests.map(t => t.nama_tes).join(', ');

      const sample = await sbPost('lab_samples', {
        barcode: tubeBarcode,
        admission_id: admId || null,
        visit_number: visitNumber,
        patient_name,
        product_name: tubeTestNames,
        sampel_type: tube.name,
        volume_ml: 3.0,
        collected_at: new Date().toISOString(),
        collected_by: typeof labUser === 'function' ? labUser() : 'Analis',
        received_at: new Date().toISOString(),
        status: 'Pending',
        notes
      });

      const sampleId = Array.isArray(sample) ? sample[0]?.id : sample?.id;

      // Buat draft analitik per tes di tabung ini
      for (const test of tube.tests) {
        if (typeof labCreateDraftResults === 'function') {
          await labCreateDraftResults(
            { admission_id: admId, sample_id: sampleId, visit_number: visitNumber, patient_name },
            test.id,
            test.nama_tes
          );
        }
      }

      barcodeLabelsToPrint.push({
        barcode: tubeBarcode,
        patient_name,
        product_name: tubeTestNames,
        visit_number: visitNumber,
        sample_type: tube.name
      });
    }

    if (typeof toast === 'function') toast(`✅ Order Lab berhasil dibuat (${requiredTubes.length} Tabung Spesimen)`, 'ok');

    // 3. Print barcode tabung multi-label
    if (typeof printLabBarcodes === 'function') {
      setTimeout(() => {
        printLabBarcodes(barcodeLabelsToPrint);
      }, 300);
    }

    // Reset state & navigate to sample list
    _lisOrderSelectedTests = [];
    navigate('lab');
  } catch (e) {
    if (typeof toast === 'function') toast('❌ ' + e.message, 'err');
  }
}

window.renderLisAdmission = renderLisAdmission;
window.renderLisAdmissionTestCatalog = renderLisAdmissionTestCatalog;
window.toggleLisTestSelection = toggleLisTestSelection;
window.removeLisSelectedTest = removeLisSelectedTest;
window.submitFullPageLisOrder = submitFullPageLisOrder;
