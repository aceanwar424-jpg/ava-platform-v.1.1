// ═══════════════════════════════════════════════════════════════════════════
// MODULE: ORDER ENTRY & ADMISI LABORATORIUM DIAGNOSTIK (SYSMEX HCLAB STANDARD)
// Desain Ergonomi Tinggi: Rapid Multi-Column Matrix, Package Explosion,
// Smart Multi-Tube Auto-Splitting (CLSI GP41-A6) & Direct Thermal Barcode
// ═══════════════════════════════════════════════════════════════════════════

let _lisOrderSelectedTests = [];
let _lisAllProducts = [];
let _lisFilterCategory = 'ALL';
let _lisSearchQuery = '';
let _lisCurrentPriority = 'RUTIN';

const LIS_CATEGORIES = [
  { id: 'ALL', label: 'Semua Parameter', icon: '📋' },
  { id: 'PANEL', label: '★ Panel Populer', icon: '📦' },
  { id: 'HEM', label: 'Hematologi', icon: '🩸' },
  { id: 'KIM', label: 'Kimia Klinik', icon: '🧪' },
  { id: 'IMU', label: 'Imunoserologi', icon: '🛡️' },
  { id: 'URI', label: 'Urinalisis', icon: '⚪' },
  { id: 'FES', label: 'Feses & Parasit', icon: '🟤' },
  { id: 'MIK', label: 'Mikrobiologi', icon: '🧫' },
  { id: 'MCU', label: 'Paket MCU', icon: '🩺' }
];

// Presets Panel Cepat (Sysmex HCLAB Quick Mode)
const QUICK_PANELS = [
  {
    id: 'PANEL_CBC',
    name: 'Panel Darah Lengkap (CBC + LED)',
    color: '#8B5CF6',
    tube: '🟣 EDTA',
    price: 95000,
    tests: ['Hematologi Lengkap (CBC)', 'Laju Endap Darah (LED)']
  },
  {
    id: 'PANEL_DM',
    name: 'Panel Diabetes Melitus',
    color: '#0EA5E9',
    tube: '🟡 Serum + 🟣 EDTA',
    price: 210000,
    tests: ['Glukosa Darah Puasa', 'Glukosa 2 Jam PP', 'HbA1c (Glycated Hemoglobin)']
  },
  {
    id: 'PANEL_LIPID',
    name: 'Panel Profil Lipid Lengkap',
    color: '#F59E0B',
    tube: '🟡 Serum',
    price: 185000,
    tests: ['Kolesterol Total', 'Trigliserida', 'Kolesterol HDL', 'Kolesterol LDL']
  },
  {
    id: 'PANEL_LFT',
    name: 'Panel Fungsi Hati (LFT)',
    color: '#10B981',
    tube: '🟡 Serum',
    price: 195000,
    tests: ['SGOT (AST)', 'SGPT (ALT)', 'Bilirubin Total', 'Bilirubin Direk']
  },
  {
    id: 'PANEL_RFT',
    name: 'Panel Fungsi Ginjal (RFT)',
    color: '#3B82F6',
    tube: '🟡 Serum',
    price: 155000,
    tests: ['Ureum Darah', 'Kreatinin Darah', 'Asam Urat']
  },
  {
    id: 'PANEL_ELEKTROLIT',
    name: 'Panel Elektrolit Serum',
    color: '#EC4899',
    tube: '🟡 Serum',
    price: 175000,
    tests: ['Elektrolit Serum (Na, K, Cl)']
  },
  {
    id: 'PANEL_FEVER',
    name: 'Panel Demam Akut / Dengue',
    color: '#EF4444',
    tube: '🟣 EDTA + 🟡 Serum',
    price: 285000,
    tests: ['Hematologi Lengkap (CBC)', 'Dengue NS1 Antigen', 'Widal Slide Test', 'Urin Rutin Lengkap']
  },
  {
    id: 'PANEL_HEPATITIS',
    name: 'Panel Skrining Hepatitis B & C',
    color: '#6366F1',
    tube: '🟡 Serum',
    price: 220000,
    tests: ['HBsAg Kualitatif Rapid', 'Anti-HCV Rapid', 'SGOT (AST)', 'SGPT (ALT)']
  }
];

// Catatan Klinis / Sampling Presets
const CLINICAL_PRESETS = [
  'Puasa 10-12 jam terpenuhi',
  'Suspek Demam Berdarah Dengue (Demam H-3)',
  'Kontrol Rutin Diabetes Melitus',
  'Evaluasi Fungsi Ginjal / CKD',
  'Skrining Pra-Operasi',
  'Medical Check-up Tahunan',
  'Trimester 1 Kehamilan (ANC Skrining)'
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
  const autoMR = `RM-${dateStr}-${randSeq}`;

  main.innerHTML = `
    <div style="padding:16px 20px; font-family:'Plus Jakarta Sans',sans-serif; max-width:1440px; margin:0 auto;">
      
      <!-- TOP COMMAND BAR & WORKSTATION HEADER -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:linear-gradient(135deg, #0A2342 0%, #0F3562 100%); color:#fff; border-radius:12px; padding:12px 18px; box-shadow:0 4px 16px rgba(10,35,66,0.15); flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <button class="btn btn-ghost btn-sm" onclick="navigate('lab')" style="color:#cfe0f2; border:1px solid rgba(255,255,255,0.2); font-weight:700; border-radius:8px;">
            ← Kembali ke Sampel
          </button>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h1 style="font-size:17px; font-weight:800; margin:0; color:#fff; letter-spacing:-0.01em;">
                🔬 Order Entry &amp; Registrasi Pasien (Sysmex HCLAB Standard)
              </h1>
              <span style="font-size:10px; font-weight:800; background:#10B981; color:#fff; padding:2px 8px; border-radius:999px; text-transform:uppercase; letter-spacing:0.04em;">
                Rapid Mode
              </span>
            </div>
            <p style="font-size:11.5px; color:#9db4d0; margin:2px 0 0 0;">
              Alur pendaftaran spesimen, pemilihan parameter LOINC/UCUM berkecepatan tinggi, dan auto-splitting tabung baku CLSI.
            </p>
          </div>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <button type="button" class="btn btn-ghost btn-sm" onclick="resetLisAdmissionForm()" style="color:#cbd5e1; border:1px solid rgba(255,255,255,0.15); font-weight:700;">
            🔄 Reset
          </button>
          <button type="button" class="btn btn-teal btn-sm" style="font-weight:800; padding:8px 18px; font-size:13px; box-shadow:0 4px 14px rgba(16,185,129,0.35);" onclick="submitFullPageLisOrder('${autoVisit}')">
            💾 Simpan &amp; Cetak Barcode (Ctrl+Enter)
          </button>
        </div>
      </div>

      <!-- MAIN WORKSTATION GRID -->
      <div style="display:grid; grid-template-columns:360px 1fr; gap:16px; align-items:start;">
        
        <!-- KOLOM KIRI: DEMOGRAFI PASIEN, PENGIRIM & KLINIS -->
        <div style="display:flex; flex-direction:column; gap:14px;">
          <div class="card" id="lis-adm-patient-card" style="padding:16px; border-top:4px solid #0EA5E9; border-radius:10px; background:var(--card-bg, #fff);">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span style="font-size:13px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px;">
                👤 Demografi &amp; Pengirim
              </span>
              <span style="font-size:11px; font-weight:800; font-family:monospace; color:#0EA5E9; background:rgba(14,165,233,0.1); padding:2px 6px; border-radius:4px;">
                ${autoVisit}
              </span>
            </div>

            <!-- PRIORITAS: RUTIN VS CITO -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
              <button type="button" id="btn-priority-rutin" class="btn btn-sm ${ _lisCurrentPriority === 'RUTIN' ? 'btn-teal' : 'btn-ghost' }"
                style="font-weight:800; font-size:11.5px; border-radius:7px; border:1px solid ${ _lisCurrentPriority === 'RUTIN' ? '#10B981' : 'var(--border)' };"
                onclick="setLisOrderPriority('RUTIN')">
                ● Rutin (Standar)
              </button>
              <button type="button" id="btn-priority-cito" class="btn btn-sm ${ _lisCurrentPriority === 'CITO' ? 'btn-danger' : 'btn-ghost' }"
                style="font-weight:800; font-size:11.5px; border-radius:7px; border:1px solid ${ _lisCurrentPriority === 'CITO' ? '#EF4444' : 'var(--border)' }; color:${ _lisCurrentPriority === 'CITO' ? '#fff' : '#EF4444' };"
                onclick="setLisOrderPriority('CITO')">
                ⚡ CITO (&lt; 1 Jam)
              </button>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
              <!-- NAMA & AUTOCOMPLETE -->
              <div class="form-group">
                <label style="font-size:11.5px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">Nama Lengkap Pasien *</label>
                <input type="text" id="adm-patient-name" placeholder="Ketik nama pasien..." required
                  style="width:100%; padding:8px 11px; border:1px solid var(--border); border-radius:7px; font-size:13px; font-weight:600;">
              </div>

              <!-- NO RM & NIK -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="form-group">
                  <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">No. RM / PID</label>
                  <input type="text" id="adm-mr-no" value="${autoMR}"
                    style="width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:7px; font-size:12px; font-family:monospace;">
                </div>
                <div class="form-group">
                  <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">NIK / KTP</label>
                  <input type="text" id="adm-nik" placeholder="16 digit NIK" maxlength="16"
                    style="width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:7px; font-size:12px;">
                </div>
              </div>

              <!-- GENDER & USIA -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="form-group">
                  <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">Jenis Kelamin *</label>
                  <select id="adm-gender" style="width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:7px; font-size:12.5px;">
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">Usia Pasien *</label>
                  <input type="text" id="adm-age" placeholder="Contoh: 35 th" value="30 th" required
                    style="width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:7px; font-size:12.5px;">
                </div>
              </div>

              <!-- NO HP & TIPE KUNJUNGAN -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="form-group">
                  <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">No. WhatsApp / HP</label>
                  <input type="tel" id="adm-phone" placeholder="08xxxxxxxxxx"
                    style="width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:7px; font-size:12px;">
                </div>
                <div class="form-group">
                  <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">Tipe Kunjungan</label>
                  <select id="adm-visit-type" style="width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:7px; font-size:12px;">
                    <option value="Walk-in (APS)">Walk-in (APS)</option>
                    <option value="Rujukan Faskes/Lab">Rujukan Faskes/Lab</option>
                    <option value="Rawat Jalan Poli">Rawat Jalan Poli</option>
                    <option value="Rawat Inap">Rawat Inap</option>
                    <option value="MCU Korporat">MCU Korporat</option>
                  </select>
                </div>
              </div>

              <!-- DOKTER PENGIRIM & BARCODE ACCESSION -->
              <div class="form-group">
                <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">Dokter / Klinik Perujuk</label>
                <input type="text" id="adm-doctor" value="Atas Permintaan Sendiri (APS)"
                  style="width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:7px; font-size:12.5px;">
              </div>

              <div class="form-group">
                <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">Barcode Accession (LIS Master)</label>
                <input type="text" id="adm-barcode" value="${autoBarcode}" readonly
                  style="width:100%; padding:7px 10px; background:var(--bg2, #f8fafc); border:1px solid var(--border); border-radius:7px; font-size:12.5px; font-weight:800; font-family:monospace; color:#10B981;">
              </div>

              <!-- CATATAN SAMPLING & FAST CHIPS -->
              <div class="form-group">
                <label style="font-size:11px; font-weight:750; color:var(--text2); margin-bottom:3px; display:block;">Catatan Klinis / Sampling</label>
                <textarea id="adm-notes" rows="2" placeholder="Kondisi puasa, suspek diagnosis..."
                  style="width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:7px; font-size:12px; font-family:inherit; resize:vertical;"></textarea>
                
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
                  ${CLINICAL_PRESETS.map(p => `
                    <button type="button" class="btn btn-xs btn-ghost"
                      style="font-size:10px; padding:2px 6px; border-radius:4px; border:1px solid var(--border); background:var(--bg2, #f1f5f9);"
                      onclick="appendLisClinicalNote('${p}')">
                      + ${p}
                    </button>
                  `).join('')}
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- KOLOM KANAN: RAPID TEST SELECTION MATRIX & SMART LIVE SUMMARY -->
        <div style="display:flex; flex-direction:column; gap:14px;">
          
          <!-- QUICK-PANEL BUTTONS (Sysmex HCLAB Package Explosion) -->
          <div class="card" style="padding:14px 16px; border-top:4px solid #8B5CF6; border-radius:10px; background:var(--card-bg, #fff);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:13px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px;">
                ⚡ Quick Panels &amp; Paket Pemeriksaan Populer
              </span>
              <span style="font-size:11px; color:var(--text3);">Klik panel untuk memilih seluruh parameter sekaligus</span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:8px;">
              ${QUICK_PANELS.map(pk => `
                <div class="quick-panel-card" onclick="selectLisQuickPanel('${pk.id}')"
                  style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--bg, #f8fafc); cursor:pointer; transition:all 0.15s; border-left:3px solid ${pk.color};"
                  onmouseover="this.style.background='rgba(139,92,246,0.06)'" onmouseout="this.style.background='var(--bg, #f8fafc)'">
                  <div style="font-size:12px; font-weight:750; color:var(--text);">${pk.name}</div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:10.5px;">
                    <span style="color:var(--text3);">${pk.tube}</span>
                    <span style="font-weight:800; color:#10B981;">Rp ${Number(pk.price).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- MULTI-DISCIPLINE TEST CATALOG MATRIX -->
          <div class="card" style="padding:16px; border-top:4px solid #10B981; border-radius:10px; background:var(--card-bg, #fff);">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:13px; font-weight:800; color:var(--text);">
                  🧪 Matriks Parameter Pemeriksaan (530+ LOINC)
                </span>
                <span id="adm-catalog-count" style="font-size:11px; color:var(--text3); font-weight:600;"></span>
              </div>

              <!-- SEARCH BOX REAL-TIME -->
              <div style="position:relative;">
                <input type="text" id="adm-test-search" placeholder="Cari nama tes, kode, LOINC..." value="${_lisSearchQuery}"
                  oninput="_lisSearchQuery=this.value; renderLisAdmissionTestCatalog();"
                  style="padding:6px 12px; font-size:12px; border:1px solid var(--border); border-radius:7px; width:260px;">
                ${ _lisSearchQuery ? `<button onclick="_lisSearchQuery=''; document.getElementById('adm-test-search').value=''; renderLisAdmissionTestCatalog();" style="position:absolute; right:8px; top:6px; background:none; border:none; cursor:pointer; color:var(--text3);">&times;</button>` : '' }
              </div>
            </div>

            <!-- DISCIPLINE TABS -->
            <div style="display:flex; gap:5px; overflow-x:auto; padding-bottom:6px; margin-bottom:10px; border-bottom:1px solid var(--border);">
              ${LIS_CATEGORIES.map(c => `
                <button type="button" class="btn btn-xs ${c.id === _lisFilterCategory ? 'btn-teal' : 'btn-ghost'}"
                  style="font-weight:750; font-size:11.5px; border-radius:6px; white-space:nowrap; padding:4px 10px;"
                  onclick="_lisFilterCategory='${c.id}'; renderLisAdmissionTestCatalog();">
                  ${c.icon} ${c.label}
                </button>
              `).join('')}
            </div>

            <!-- DYNAMIC TEST GRID MATRIX -->
            <div id="adm-test-catalog-list" style="max-height:340px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; padding:6px; background:var(--bg2, #f8fafc); display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:6px;">
              <!-- Dynamically populated -->
            </div>
          </div>

          <!-- SMART LIVE ORDER SUMMARY & ORDER OF DRAW -->
          <div class="card" style="padding:16px 18px; background:linear-gradient(135deg, var(--card-bg, #fff) 0%, rgba(16,185,129,0.04) 100%); border:1px solid rgba(16,185,129,0.35); border-radius:10px;">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:13px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px;">
                🧾 Ringkasan Order &amp; Kebutuhan Tabung Sampel
              </span>
              <span id="adm-selected-count-badge" style="font-size:11px; font-weight:800; color:#10B981; background:rgba(16,185,129,0.15); padding:2px 8px; border-radius:999px;">
                0 Parameter Terpilih
              </span>
            </div>

            <!-- SELECTED CHIPS -->
            <div id="adm-selected-tests-tags" style="display:flex; flex-wrap:wrap; gap:6px; min-height:36px; margin-bottom:12px; align-items:center;">
              <span style="color:var(--text3); font-size:12px;">Belum ada pemeriksaan yang dipilih. Silakan centang pada matriks di atas.</span>
            </div>

            <!-- CLSI ORDER OF DRAW & TUBE REQUIREMENT -->
            <div style="border-top:1px solid var(--border); padding-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div id="adm-tube-reqs" style="font-size:11.5px; color:var(--text2); flex:1; min-width:300px;">
                <b>Kebutuhan Tabung:</b> <span>-</span>
              </div>
              <div style="text-align:right;">
                <span style="font-size:11px; color:var(--text3); display:block;">Total Biaya Pemeriksaan:</span>
                <span style="font-size:20px; font-weight:900; color:#10B981;" id="adm-total-price">Rp 0</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  `;

  // Attach Ctrl+Enter Shortcut
  document.onkeydown = function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      submitFullPageLisOrder(autoVisit);
    }
  };

  renderLisAdmissionTestCatalog();
}

function setLisOrderPriority(p) {
  _lisCurrentPriority = p;
  const card = document.getElementById('lis-adm-patient-card');
  const btnRutin = document.getElementById('btn-priority-rutin');
  const btnCito = document.getElementById('btn-priority-cito');

  if (p === 'CITO') {
    if (card) card.style.borderTopColor = '#EF4444';
    if (btnRutin) { btnRutin.className = 'btn btn-sm btn-ghost'; btnRutin.style.color = 'var(--text)'; }
    if (btnCito) { btnCito.className = 'btn btn-sm btn-danger'; btnCito.style.color = '#fff'; }
  } else {
    if (card) card.style.borderTopColor = '#0EA5E9';
    if (btnRutin) { btnRutin.className = 'btn btn-sm btn-teal'; btnRutin.style.color = '#fff'; }
    if (btnCito) { btnCito.className = 'btn btn-sm btn-ghost'; btnCito.style.color = '#EF4444'; }
  }
}

function appendLisClinicalNote(text) {
  const el = document.getElementById('adm-notes');
  if (!el) return;
  if (!el.value.trim()) {
    el.value = text;
  } else if (!el.value.includes(text)) {
    el.value += '; ' + text;
  }
}

function selectLisQuickPanel(panelId) {
  const panel = QUICK_PANELS.find(p => p.id === panelId);
  if (!panel) return;

  panel.tests.forEach(testName => {
    const prod = _lisAllProducts.find(p => p.nama_tes && p.nama_tes.toLowerCase().includes(testName.toLowerCase()));
    if (prod && !_lisOrderSelectedTests.some(t => t.id === prod.id)) {
      _lisOrderSelectedTests.push(prod);
    }
  });

  if (typeof toast === 'function') toast(`⚡ ${panel.name} ditambahkan (${panel.tests.length} parameter)`, 'ok');
  renderLisAdmissionTestCatalog();
}

function renderLisAdmissionTestCatalog() {
  const container = document.getElementById('adm-test-catalog-list');
  const countEl = document.getElementById('adm-catalog-count');
  if (!container) return;

  const q = (_lisSearchQuery || '').toLowerCase();
  const cat = _lisFilterCategory;

  const filtered = _lisAllProducts.filter(p => {
    const matchQ = !q || (p.nama_tes && p.nama_tes.toLowerCase().includes(q))
                      || (p.kode_internal && p.kode_internal.toLowerCase().includes(q))
                      || (p.loinc_code && p.loinc_code.toLowerCase().includes(q));
    const kat = (p.kategori || '').toLowerCase();
    const matchCat = cat === 'ALL' ||
      (cat === 'PANEL' && (kat.includes('paket') || kat.includes('panel') || (p.is_panel === true))) ||
      (cat === 'HEM' && kat.includes('hematologi')) ||
      (cat === 'KIM' && kat.includes('kimia')) ||
      (cat === 'IMU' && (kat.includes('imun') || kat.includes('sero') || kat.includes('hor'))) ||
      (cat === 'URI' && kat.includes('urin')) ||
      (cat === 'FES' && kat.includes('feses')) ||
      (cat === 'MIK' && kat.includes('mikro')) ||
      (cat === 'MCU' && (kat.includes('mcu') || kat.includes('paket')));
    return matchQ && matchCat;
  });

  if (countEl) countEl.textContent = `(${filtered.length} ditemukan)`;

  if (!filtered.length) {
    container.innerHTML = `<div style="grid-column:1/-1; padding:24px; text-align:center; color:var(--text3); font-size:12.5px;">Tidak ditemukan parameter tes yang cocok dengan kata kunci "${_lisSearchQuery}".</div>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isChecked = _lisOrderSelectedTests.some(t => t.id === p.id);
    const price = p.harga_dasar || p.tarif || 0;
    const sample = p.sampel_type || 'Darah Vena';
    
    // Tentukan badge warna spesimen
    let tubeBadge = '🟡 Serum';
    let badgeColor = '#FBBF24';
    const sLower = sample.toLowerCase();
    const kLower = (p.kategori || '').toLowerCase();
    if (sLower.includes('edta') || kLower.includes('hematologi') || p.nama_tes.includes('HbA1c')) {
      tubeBadge = '🟣 EDTA'; badgeColor = '#A855F7';
    } else if (sLower.includes('sitrat') || p.nama_tes.includes('PT') || p.nama_tes.includes('APTT')) {
      tubeBadge = '🔵 Sitrat'; badgeColor = '#38BDF8';
    } else if (sLower.includes('urin') || kLower.includes('urin')) {
      tubeBadge = '⚪ Urin'; badgeColor = '#F59E0B';
    } else if (sLower.includes('feses') || kLower.includes('feses')) {
      tubeBadge = '🟤 Feses'; badgeColor = '#D97706';
    }

    return `
      <div onclick="toggleLisTestSelection(${p.id}, ${!isChecked})"
        style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-radius:7px; background:${isChecked ? 'rgba(16,185,129,0.12)' : 'var(--bg, #fff)'}; border:1px solid ${isChecked ? 'rgba(16,185,129,0.45)' : 'var(--border)'}; cursor:pointer; transition:all 0.12s; user-select:none;">
        <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();" onchange="toggleLisTestSelection(${p.id}, this.checked)"
            style="width:15px; height:15px; accent-color:#10B981; cursor:pointer; flex-shrink:0;">
          <div style="overflow:hidden;">
            <div style="font-weight:750; font-size:12px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${p.nama_tes}
            </div>
            <div style="font-size:10px; color:var(--text3); display:flex; align-items:center; gap:4px; margin-top:2px;">
              <span style="background:${badgeColor}20; color:${badgeColor}; padding:1px 4px; border-radius:3px; font-weight:700;">${tubeBadge}</span>
              <span style="font-family:monospace;">${p.kode_internal || 'LAB'}</span>
            </div>
          </div>
        </div>
        <div style="font-weight:800; font-size:11.5px; color:#10B981; white-space:nowrap; margin-left:6px;">
          Rp ${Number(price).toLocaleString('id-ID')}
        </div>
      </div>
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

function resetLisAdmissionForm() {
  _lisOrderSelectedTests = [];
  _lisSearchQuery = '';
  _lisFilterCategory = 'ALL';
  _lisCurrentPriority = 'RUTIN';
  renderLisAdmission();
  if (typeof toast === 'function') toast('Form order telah direset', 'info');
}

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
    tagsEl.innerHTML = `<span style="color:var(--text3); font-size:12px;">Belum ada pemeriksaan yang dipilih. Silakan centang pada matriks di atas.</span>`;
    if (countBadge) countBadge.textContent = '0 Parameter Terpilih';
    if (priceEl) priceEl.textContent = 'Rp 0';
    if (tubeEl) tubeEl.innerHTML = '<b>Kebutuhan Tabung:</b> <span>-</span>';
    return;
  }

  if (countBadge) countBadge.textContent = `${_lisOrderSelectedTests.length} Parameter Terpilih`;

  let totalPrice = 0;
  _lisOrderSelectedTests.forEach(t => {
    const price = t.harga_dasar || t.tarif || 0;
    totalPrice += Number(price);
  });

  tagsEl.innerHTML = _lisOrderSelectedTests.map(t => `
    <span style="display:inline-flex; align-items:center; gap:5px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); padding:3px 9px; border-radius:999px; font-size:11.5px; font-weight:750; color:#10B981;">
      <span>${t.nama_tes}</span>
      <span onclick="removeLisSelectedTest(${t.id})" style="cursor:pointer; font-weight:900; margin-left:3px; opacity:0.8;" title="Hapus">&times;</span>
    </span>
  `).join('');

  if (priceEl) {
    priceEl.textContent = `Rp ${Number(totalPrice).toLocaleString('id-ID')}`;
  }

  const requiredTubes = getRequiredTubesForTests(_lisOrderSelectedTests);
  if (tubeEl) {
    tubeEl.innerHTML = `
      <div style="margin-top:4px;">
        <div style="font-size:11px; font-weight:800; color:var(--text); margin-bottom:4px;">
          🧪 Kebutuhan Tabung &amp; Urutan Sampling (CLSI GP41-A6 Order of Draw):
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${requiredTubes.map((tb, idx) => `
            <div style="display:inline-flex; align-items:center; gap:5px; background:var(--bg2, #f8fafc); border:1px solid var(--border); padding:3px 8px; border-radius:6px; font-size:11px; border-left:3px solid ${tb.color};">
              <span style="font-weight:800; color:${tb.color};">${idx + 1}.</span>
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
  const visit_type = document.getElementById('adm-visit-type')?.value || 'Walk-in (APS)';
  const doctor = document.getElementById('adm-doctor')?.value?.trim() || 'APS';
  const priority = _lisCurrentPriority;
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
      visit_type,
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
        sample_type: tube.name,
        mr_number: mr_no
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
window.setLisOrderPriority = setLisOrderPriority;
window.appendLisClinicalNote = appendLisClinicalNote;
window.selectLisQuickPanel = selectLisQuickPanel;
window.resetLisAdmissionForm = resetLisAdmissionForm;
window.getRequiredTubesForTests = getRequiredTubesForTests;
