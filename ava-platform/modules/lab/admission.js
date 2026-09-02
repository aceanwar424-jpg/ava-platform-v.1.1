// ═══════════════════════════════════════════════════════════════════════════
// MODULE: ORDER ENTRY & ADMISI LABORATORIUM (SYSMEX HCLAB SMART-CLIENT WORKSTATION)
// Sesuai Spesifikasi Sysmex HCLAB (Hal. 3):
// - Top Horizontal Demographic & Order Header Table Grid
// - 5-Column Side-by-Side Multi-Discipline Rapid Matrix (Hematology, Chemistry,
//   Immunology, Urine & Micro, Packages & Selected Summary)
// - Rule-Based Smart Tube Auto-Splitting (CLSI GP41-A6) & Thermal Barcode Output
// ═══════════════════════════════════════════════════════════════════════════

let _lisOrderSelectedTests = [];
let _lisAllProducts = [];
let _lisSearchQuery = '';
let _lisCurrentPriority = 'ROUTINE';

// Presets Panel Cepat (Sysmex HCLAB Quick Mode)
const QUICK_PANELS = [
  {
    id: 'PANEL_CBC',
    name: 'Panel Darah Lengkap (FBC + LED)',
    code: 'FBC',
    color: '#8B5CF6',
    tube: '🟣 EDTA',
    price: 95000,
    tests: ['Hematologi Lengkap (CBC)', 'Laju Endap Darah (LED / Westergren)']
  },
  {
    id: 'PANEL_DM',
    name: 'Panel Diabetes Melitus',
    code: 'DM-PROF',
    color: '#0EA5E9',
    tube: '🟡 Serum + 🟣 EDTA',
    price: 210000,
    tests: ['Glukosa Darah Puasa (GDP)', 'Glukosa Darah 2 Jam PP (GD2PP)', 'HbA1c (Kromatografi HPLC Terstandar NGSP)']
  },
  {
    id: 'PANEL_LIPID',
    name: 'Panel Profil Lipid Lengkap',
    code: 'LIPID',
    color: '#F59E0B',
    tube: '🟡 Serum',
    price: 185000,
    tests: ['Kolesterol Total', 'Trigliserida', 'Kolesterol HDL', 'Kolesterol LDL Direct']
  },
  {
    id: 'PANEL_LFT',
    name: 'Panel Fungsi Hati (LFT)',
    code: 'LFT',
    color: '#10B981',
    tube: '🟡 Serum',
    price: 195000,
    tests: ['SGOT / AST (Aspartate Aminotransferase)', 'SGPT / ALT (Alanine Aminotransferase)', 'Bilirubin Total', 'Bilirubin Direk']
  },
  {
    id: 'PANEL_RFT',
    name: 'Panel Fungsi Ginjal (RFT)',
    code: 'RFT',
    color: '#3B82F6',
    tube: '🟡 Serum',
    price: 155000,
    tests: ['Ureum Darah', 'Kreatinin Darah + eGFR (CKD-EPI)', 'Asam Urat (Uric Acid)']
  },
  {
    id: 'PANEL_ELEKTROLIT',
    name: 'Panel Elektrolit Serum',
    code: 'LYTES',
    color: '#EC4899',
    tube: '🟡 Serum',
    price: 175000,
    tests: ['Elektrolit Serum (Na, K, Cl)']
  },
  {
    id: 'PANEL_FEVER',
    name: 'Panel Demam Akut / Dengue',
    code: 'FEVER',
    color: '#EF4444',
    tube: '🟣 EDTA + 🟡 Serum',
    price: 285000,
    tests: ['Hematologi Lengkap (CBC)', 'Dengue NS1 Antigen Rapid', 'Widal Slide Test', 'Urin Rutin Lengkap (Automated Strip + Sedimen)']
  },
  {
    id: 'PANEL_HEPATITIS',
    name: 'Panel Skrining Hepatitis B & C',
    code: 'HEPA',
    color: '#6366F1',
    tube: '🟡 Serum',
    price: 220000,
    tests: ['HBsAg Kualitatif Rapid', 'Anti-HCV Rapid', 'SGOT / AST (Aspartate Aminotransferase)', 'SGPT / ALT (Alanine Aminotransferase)']
  },
  {
    id: 'PANEL_PREMARITAL',
    name: 'Panel Skrining Pra-Nikah (Premarital)',
    code: 'PREMARITAL',
    color: '#14B8A6',
    tube: '🟣 EDTA + 🟡 Serum + ⚪ Urin',
    price: 495000,
    tests: ['Hematologi Lengkap (CBC)', 'Golongan Darah ABO & Rhesus', 'HBsAg Kualitatif Rapid', 'Anti-HIV Kualitatif Rapid (3 Metode)', 'VDRL / RPR Sifilis', 'Urin Rutin Lengkap (Automated Strip + Sedimen)']
  }
];

// Presets Catatan Klinis / Sampling
const CLINICAL_PRESETS = [
  'Puasa 10-12 jam terpenuhi',
  'Suspek DBD (Demam Hari ke-3)',
  'Evaluasi Pasien Diabetes Melitus',
  'Evaluasi Fungsi Ginjal / Hemodialisa',
  'Skrining Pra-Operasi (Pre-Op)',
  'Medical Check-Up (MCU) Tahunan',
  'Trimester 1 Kehamilan (ANC)'
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
    <div style="padding:10px 14px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width:1600px; margin:0 auto; font-size:12px; color:#1e293b;">
      
      <!-- TOP SYSMEX HCLAB WORKSTATION TITLE & TOOLBAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0B2240; color:#fff; padding:6px 12px; border-radius:6px 6px 0 0; margin-bottom:2px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn btn-xs" onclick="navigate('lab')" style="background:#1e3a5f; color:#fff; border:1px solid #3b82f6; font-weight:700; border-radius:4px; padding:2px 8px;">
            &larr; Exit Order Entry
          </button>
          <span style="font-weight:800; font-size:13px; letter-spacing:0.02em; display:flex; align-items:center; gap:6px;">
            <span style="color:#38bdf8;">SYSMEX HCLAB</span> &bull; Order Entry Workstation (Smart Client)
          </span>
          <span style="background:#10B981; color:#fff; font-size:10px; font-weight:800; padding:1px 6px; border-radius:3px;">ONLINE</span>
        </div>

        <div style="display:flex; gap:6px; align-items:center;">
          <button type="button" class="btn btn-xs" onclick="resetLisAdmissionForm()" style="background:#1e3a5f; color:#cbd5e1; border:1px solid #475569; font-weight:700; padding:3px 10px;">
            📄 New / Clear
          </button>
          <button type="button" class="btn btn-xs" onclick="submitFullPageLisOrder('${autoVisit}')" style="background:#10B981; color:#fff; border:1px solid #059669; font-weight:800; padding:3px 14px; box-shadow:0 2px 6px rgba(16,185,129,0.3);">
            💾 Save &amp; Print Barcode (Ctrl+Enter)
          </button>
        </div>
      </div>

      <!-- HORIZONTAL DEMOGRAPHIC & ORDER HEADER PANEL (SYSMEX HCLAB TABLE LAYOUT) -->
      <div id="lis-adm-header-panel" style="background:#e2e8f0; border:1px solid #cbd5e1; padding:8px 12px; margin-bottom:8px; border-radius:0 0 6px 6px;">
        <div style="display:grid; grid-template-columns:140px 140px 220px 100px 110px 80px 120px 1fr 140px; gap:8px; align-items:end;">
          
          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">Lab No / Accession</label>
            <input type="text" id="adm-barcode" value="${autoBarcode}" readonly style="width:100%; padding:4px 6px; font-size:11.5px; font-weight:800; font-family:monospace; background:#f8fafc; border:1px solid #94a3b8; border-radius:3px; color:#0f766e;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">PID / No. RM *</label>
            <input type="text" id="adm-mr-no" value="${autoMR}" style="width:100%; padding:4px 6px; font-size:11.5px; font-family:monospace; font-weight:700; background:#fff; border:1px solid #94a3b8; border-radius:3px;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">Patient Name *</label>
            <input type="text" id="adm-patient-name" placeholder="Nama lengkap pasien..." required style="width:100%; padding:4px 6px; font-size:12px; font-weight:700; background:#fff; border:1px solid #94a3b8; border-radius:3px;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">NIK / KTP</label>
            <input type="text" id="adm-nik" placeholder="16 digit NIK" maxlength="16" style="width:100%; padding:4px 6px; font-size:11.5px; background:#fff; border:1px solid #94a3b8; border-radius:3px;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">Age / DOB *</label>
            <input type="text" id="adm-age" value="30 Yrs" placeholder="30 Yrs" style="width:100%; padding:4px 6px; font-size:11.5px; font-weight:700; background:#fff; border:1px solid #94a3b8; border-radius:3px;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">Sex *</label>
            <select id="adm-gender" style="width:100%; padding:4px 6px; font-size:11.5px; font-weight:700; background:#fff; border:1px solid #94a3b8; border-radius:3px;">
              <option value="L">MALE</option>
              <option value="P">FEMALE</option>
            </select>
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">Priority</label>
            <select id="adm-priority" onchange="setLisOrderPriority(this.value)" style="width:100%; padding:4px 6px; font-size:11.5px; font-weight:800; background:#fff; border:1px solid #94a3b8; border-radius:3px; color:#0284c7;">
              <option value="ROUTINE">ROUTINE</option>
              <option value="STAT">⚡ STAT / CITO</option>
            </select>
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">Ward / Doctor / Clinical Notes</label>
            <div style="display:flex; gap:4px;">
              <input type="text" id="adm-doctor" value="APS" placeholder="Dokter / Poli" style="width:140px; padding:4px 6px; font-size:11.5px; background:#fff; border:1px solid #94a3b8; border-radius:3px;">
              <input type="text" id="adm-notes" placeholder="Catatan puasa, suspek..." style="flex:1; padding:4px 6px; font-size:11.5px; background:#fff; border:1px solid #94a3b8; border-radius:3px;">
            </div>
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase;">Order Date &amp; Time</label>
            <div style="font-family:monospace; font-size:11px; font-weight:700; color:#334155; padding:5px 6px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:3px; text-align:center;">
              ${today.toLocaleDateString('id-ID')} ${today.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
            </div>
          </div>

        </div>

        <!-- FAST CLINICAL PRESETS CHIPS -->
        <div style="display:flex; align-items:center; gap:6px; margin-top:6px; overflow-x:auto;">
          <span style="font-size:10px; font-weight:800; color:#64748b;">PRESETS:</span>
          ${CLINICAL_PRESETS.map(p => `
            <button type="button" class="btn btn-xs" onclick="appendLisClinicalNote('${p}')"
              style="font-size:10px; padding:1px 6px; background:#fff; border:1px solid #cbd5e1; border-radius:3px; color:#334155; cursor:pointer;">
              + ${p}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- SEARCH & QUICK PANELS RIBBON -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; border:1px solid #cbd5e1; padding:6px 10px; border-radius:4px; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px; overflow-x:auto;">
          <span style="font-size:11px; font-weight:800; color:#0b2240; white-space:nowrap;">⚡ QUICK PANELS:</span>
          ${QUICK_PANELS.map(pk => `
            <button type="button" onclick="selectLisQuickPanel('${pk.id}')"
              style="font-size:11px; font-weight:700; padding:3px 8px; border-radius:3px; border:1px solid ${pk.color}; background:#fff; color:#0b2240; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:4px;"
              onmouseover="this.style.background='${pk.color}15'" onmouseout="this.style.background='#fff'">
              <span style="color:${pk.color}; font-weight:800;">★</span>
              <span>${pk.name}</span>
            </button>
          `).join('')}
        </div>

        <div style="position:relative; width:260px;">
          <input type="text" id="adm-test-search" placeholder="🔍 Quick Filter across all disciplines..." value="${_lisSearchQuery}"
            oninput="_lisSearchQuery=this.value; renderLis5ColumnMatrix();"
            style="width:100%; padding:4px 8px; font-size:11.5px; border:1px solid #94a3b8; border-radius:3px;">
          ${ _lisSearchQuery ? `<button onclick="_lisSearchQuery=''; document.getElementById('adm-test-search').value=''; renderLis5ColumnMatrix();" style="position:absolute; right:6px; top:4px; background:none; border:none; cursor:pointer; color:#64748b;">&times;</button>` : '' }
        </div>
      </div>

      <!-- 5-COLUMN SIDE-BY-SIDE MULTI-DISCIPLINE SCREEN PANEL (SYSMEX HCLAB PAGE 3 MATRIX) -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr) 340px; gap:8px; align-items:stretch; min-height:480px;">
        
        <!-- COLUMN 1: HEMATOLOGY -->
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; display:flex; flex-direction:column; overflow:hidden;">
          <div style="background:#7c3aed; color:#fff; font-weight:800; font-size:11.5px; padding:5px 8px; letter-spacing:0.03em; display:flex; justify-content:space-between;">
            <span>🩸 HEMATOLOGY</span>
            <span id="count-hem" style="font-size:10px; opacity:0.85;"></span>
          </div>
          <div id="col-hem-list" style="padding:4px; overflow-y:auto; flex:1; max-height:440px; display:flex; flex-direction:column; gap:2px; background:#faf5ff;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- COLUMN 2: CHEMISTRY -->
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; display:flex; flex-direction:column; overflow:hidden;">
          <div style="background:#0284c7; color:#fff; font-weight:800; font-size:11.5px; padding:5px 8px; letter-spacing:0.03em; display:flex; justify-content:space-between;">
            <span>🧪 CHEMISTRY</span>
            <span id="count-kim" style="font-size:10px; opacity:0.85;"></span>
          </div>
          <div id="col-kim-list" style="padding:4px; overflow-y:auto; flex:1; max-height:440px; display:flex; flex-direction:column; gap:2px; background:#f0f9ff;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- COLUMN 3: IMMUNOLOGY & SEROLOGY -->
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; display:flex; flex-direction:column; overflow:hidden;">
          <div style="background:#059669; color:#fff; font-weight:800; font-size:11.5px; padding:5px 8px; letter-spacing:0.03em; display:flex; justify-content:space-between;">
            <span>🛡️ IMMUNOLOGY</span>
            <span id="count-imu" style="font-size:10px; opacity:0.85;"></span>
          </div>
          <div id="col-imu-list" style="padding:4px; overflow-y:auto; flex:1; max-height:440px; display:flex; flex-direction:column; gap:2px; background:#ecfdf5;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- COLUMN 4: URINE & MICROBIOLOGY -->
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; display:flex; flex-direction:column; overflow:hidden;">
          <div style="background:#d97706; color:#fff; font-weight:800; font-size:11.5px; padding:5px 8px; letter-spacing:0.03em; display:flex; justify-content:space-between;">
            <span>⚪ URINE &amp; MICRO</span>
            <span id="count-uri" style="font-size:10px; opacity:0.85;"></span>
          </div>
          <div id="col-uri-list" style="padding:4px; overflow-y:auto; flex:1; max-height:440px; display:flex; flex-direction:column; gap:2px; background:#fffbeb;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- COLUMN 5: SELECTED ORDER & SMART TUBE AUTO-SPLITTING -->
        <div style="background:#fff; border:1px solid #0b2240; border-radius:4px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 2px 8px rgba(11,34,64,0.08);">
          <div style="background:#0b2240; color:#fff; font-weight:800; font-size:11.5px; padding:5px 8px; letter-spacing:0.03em; display:flex; justify-content:space-between; align-items:center;">
            <span>📋 SELECTED ORDER (<span id="adm-selected-count">0</span>)</span>
            <button type="button" onclick="_lisOrderSelectedTests=[]; renderLis5ColumnMatrix();" style="background:none; border:none; color:#f87171; font-size:10px; font-weight:700; cursor:pointer;">Clear All</button>
          </div>

          <!-- SELECTED TEST LIST (TABLE FORMAT ALA HCLAB) -->
          <div id="adm-selected-table-container" style="flex:1; overflow-y:auto; max-height:260px; padding:4px; background:#fff;">
            <!-- Rendered dynamically -->
          </div>

          <!-- BOTTOM TUBE REQUIREMENTS & TOTAL TARIFF -->
          <div style="border-top:1px solid #cbd5e1; background:#f8fafc; padding:8px 10px;">
            <div style="font-size:10.5px; font-weight:800; color:#334155; margin-bottom:4px;">
              🧪 TUBE SPECIMENS &amp; ORDER OF DRAW:
            </div>
            <div id="adm-tube-reqs" style="display:flex; flex-direction:column; gap:3px; margin-bottom:8px; min-height:42px;">
              <span style="color:#94a3b8; font-size:11px;">Belum ada spesimen tabung terpilih.</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #cbd5e1; padding-top:6px; margin-bottom:8px;">
              <span style="font-size:11px; font-weight:700; color:#475569;">Total Biaya:</span>
              <span id="adm-total-price" style="font-size:16px; font-weight:900; color:#10B981;">Rp 0</span>
            </div>

            <button type="button" class="btn btn-teal" onclick="submitFullPageLisOrder('${autoVisit}')"
              style="width:100%; font-weight:800; padding:8px; font-size:12.5px; border-radius:4px; background:#10B981; color:#fff; border:none; cursor:pointer; box-shadow:0 2px 6px rgba(16,185,129,0.3);">
              💾 SUBMIT ORDER &amp; PRINT BARCODE
            </button>
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

  renderLis5ColumnMatrix();
}

function setLisOrderPriority(p) {
  _lisCurrentPriority = p;
  const panel = document.getElementById('lis-adm-header-panel');
  if (!panel) return;
  if (p === 'STAT') {
    panel.style.background = '#fee2e2';
    panel.style.border = '2px solid #ef4444';
  } else {
    panel.style.background = '#e2e8f0';
    panel.style.border = '1px solid #cbd5e1';
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

  if (typeof toast === 'function') toast(`⚡ ${panel.name} selected`, 'ok');
  renderLis5ColumnMatrix();
}

function renderLis5ColumnMatrix() {
  const q = (_lisSearchQuery || '').toLowerCase();

  // Filter products for each discipline
  const hemProds = _lisAllProducts.filter(p => {
    const k = (p.kategori || '').toLowerCase();
    const matchCat = k.includes('hematologi') || p.nama_tes.includes('Hb') || p.nama_tes.includes('Darah');
    const matchQ = !q || p.nama_tes.toLowerCase().includes(q) || (p.loinc_code && p.loinc_code.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  const kimProds = _lisAllProducts.filter(p => {
    const k = (p.kategori || '').toLowerCase();
    const matchCat = k.includes('kimia') || p.nama_tes.includes('Glukosa') || p.nama_tes.includes('Kolesterol') || p.nama_tes.includes('SGOT') || p.nama_tes.includes('Ureum') || p.nama_tes.includes('Kreatinin');
    const matchQ = !q || p.nama_tes.toLowerCase().includes(q) || (p.loinc_code && p.loinc_code.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  const imuProds = _lisAllProducts.filter(p => {
    const k = (p.kategori || '').toLowerCase();
    const matchCat = k.includes('imun') || k.includes('sero') || k.includes('hor') || p.nama_tes.includes('HBsAg') || p.nama_tes.includes('HIV') || p.nama_tes.includes('Dengue') || p.nama_tes.includes('Widal');
    const matchQ = !q || p.nama_tes.toLowerCase().includes(q) || (p.loinc_code && p.loinc_code.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  const uriProds = _lisAllProducts.filter(p => {
    const k = (p.kategori || '').toLowerCase();
    const matchCat = k.includes('urin') || k.includes('feses') || k.includes('mikro') || p.nama_tes.includes('Urin') || p.nama_tes.includes('Feses') || p.nama_tes.includes('BTA');
    const matchQ = !q || p.nama_tes.toLowerCase().includes(q) || (p.loinc_code && p.loinc_code.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  // Render Columns
  renderColumnItems('col-hem-list', 'count-hem', hemProds);
  renderColumnItems('col-kim-list', 'count-kim', kimProds);
  renderColumnItems('col-imu-list', 'count-imu', imuProds);
  renderColumnItems('col-uri-list', 'count-uri', uriProds);

  // Render Selected Table
  renderSelectedTable();
}

function renderColumnItems(containerId, countId, prods) {
  const container = document.getElementById(containerId);
  const countEl = document.getElementById(countId);
  if (!container) return;

  if (countEl) countEl.textContent = `${prods.length} items`;

  if (!prods.length) {
    container.innerHTML = `<div style="padding:16px; text-align:center; color:#94a3b8; font-size:11px;">Tidak ada parameter cocok</div>`;
    return;
  }

  container.innerHTML = prods.map(p => {
    const isChecked = _lisOrderSelectedTests.some(t => t.id === p.id);
    const price = p.harga_dasar || p.tarif || 0;
    
    return `
      <div onclick="toggleLisTestSelection(${p.id}, ${!isChecked})"
        style="display:flex; justify-content:space-between; align-items:center; padding:4px 6px; border-radius:3px; background:${isChecked ? '#d1fae5' : '#fff'}; border:1px solid ${isChecked ? '#10b981' : '#e2e8f0'}; cursor:pointer; font-size:11px; user-select:none; transition:background 0.1s;"
        onmouseover="if(!${isChecked}) this.style.background='#f8fafc'" onmouseout="if(!${isChecked}) this.style.background='#fff'">
        <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();" onchange="toggleLisTestSelection(${p.id}, this.checked)"
            style="accent-color:#10B981; width:13px; height:13px; cursor:pointer;">
          <span style="font-weight:${isChecked ? '800' : '600'}; color:${isChecked ? '#065f46' : '#1e293b'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${p.nama_tes}
          </span>
        </div>
        <span style="font-size:10.5px; font-weight:700; color:#059669; white-space:nowrap; margin-left:4px;">
          Rp ${Number(price).toLocaleString('id-ID')}
        </span>
      </div>
    `;
  }).join('');
}

function renderSelectedTable() {
  const container = document.getElementById('adm-selected-table-container');
  const countEl = document.getElementById('adm-selected-count');
  const priceEl = document.getElementById('adm-total-price');
  const tubeEl = document.getElementById('adm-tube-reqs');

  if (!container) return;

  if (countEl) countEl.textContent = _lisOrderSelectedTests.length;

  if (!_lisOrderSelectedTests.length) {
    container.innerHTML = `
      <div style="padding:24px; text-align:center; color:#94a3b8; font-size:11.5px;">
        <div style="font-size:24px; margin-bottom:4px;">📋</div>
        Klik parameter pada kolom untuk menambahkan ke order
      </div>
    `;
    if (priceEl) priceEl.textContent = 'Rp 0';
    if (tubeEl) tubeEl.innerHTML = `<span style="color:#94a3b8; font-size:11px;">Belum ada spesimen tabung terpilih.</span>`;
    return;
  }

  let totalPrice = 0;
  _lisOrderSelectedTests.forEach(t => {
    totalPrice += Number(t.harga_dasar || t.tarif || 0);
  });

  if (priceEl) priceEl.textContent = `Rp ${Number(totalPrice).toLocaleString('id-ID')}`;

  container.innerHTML = `
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead>
        <tr style="background:#f1f5f9; color:#475569; font-weight:800; text-align:left; border-bottom:1px solid #cbd5e1;">
          <th style="padding:4px 6px;">Code</th>
          <th style="padding:4px 6px;">Test Name</th>
          <th style="padding:4px 6px; text-align:right;">Tariff</th>
          <th style="padding:4px 4px; text-align:center; width:20px;"></th>
        </tr>
      </thead>
      <tbody>
        ${_lisOrderSelectedTests.map(t => {
          const price = t.harga_dasar || t.tarif || 0;
          return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:4px 6px; font-family:monospace; font-weight:700; color:#0284c7;">${t.kode_internal || 'LAB'}</td>
              <td style="padding:4px 6px; font-weight:600; color:#1e293b;">${t.nama_tes}</td>
              <td style="padding:4px 6px; text-align:right; font-weight:700; color:#059669;">Rp ${Number(price).toLocaleString('id-ID')}</td>
              <td style="padding:4px 4px; text-align:center;">
                <button type="button" onclick="removeLisSelectedTest(${t.id})" style="background:none; border:none; color:#ef4444; font-weight:900; cursor:pointer; font-size:12px;">&times;</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  // Calculate required tubes
  const requiredTubes = getRequiredTubesForTests(_lisOrderSelectedTests);
  if (tubeEl) {
    tubeEl.innerHTML = requiredTubes.map((tb, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #cbd5e1; border-left:3px solid ${tb.color}; padding:3px 6px; border-radius:3px; font-size:10.5px;">
        <span style="font-weight:700; color:#1e293b;">${idx + 1}. ${tb.name}</span>
        <span style="font-family:monospace; font-weight:800; color:${tb.color};">(${tb.tests.length} tes)</span>
      </div>
    `).join('');
  }
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

  renderLis5ColumnMatrix();
}

function removeLisSelectedTest(productId) {
  _lisOrderSelectedTests = _lisOrderSelectedTests.filter(t => t.id !== productId);
  renderLis5ColumnMatrix();
}

function resetLisAdmissionForm() {
  _lisOrderSelectedTests = [];
  _lisSearchQuery = '';
  _lisCurrentPriority = 'ROUTINE';
  renderLisAdmission();
  if (typeof toast === 'function') toast('Form order cleared', 'info');
}

function getRequiredTubesForTests(tests = []) {
  const tubes = {};
  tests.forEach(t => {
    const samp = (t.sampel_type || '').toLowerCase();
    const kat = (t.kategori || '').toLowerCase();
    let tubeKey = 'SST';
    let tubeName = 'Serum SST Gel (Kuning)';
    let tubeColor = '#FBBF24';
    let tubeSuffix = 'S';
    let tubeOrder = 2;

    if (samp.includes('edta') || kat.includes('hematologi') || t.nama_tes.includes('HbA1c') || t.nama_tes.includes('CBC')) {
      tubeKey = 'EDTA';
      tubeName = 'Darah EDTA K2 (Ungu)';
      tubeColor = '#A855F7';
      tubeSuffix = 'E';
      tubeOrder = 4;
    } else if (samp.includes('sitrat') || t.nama_tes.includes('PT') || t.nama_tes.includes('APTT')) {
      tubeKey = 'CIT';
      tubeName = 'Plasma Sitrat 3.2% (Biru)';
      tubeColor = '#38BDF8';
      tubeSuffix = 'C';
      tubeOrder = 1;
    } else if (samp.includes('urin') || kat.includes('urin') || t.nama_tes.includes('Urin')) {
      tubeKey = 'URI';
      tubeName = 'Pot Urin Steril';
      tubeColor = '#F59E0B';
      tubeSuffix = 'U';
      tubeOrder = 5;
    } else if (samp.includes('feses') || kat.includes('feses') || t.nama_tes.includes('Feses')) {
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

async function submitFullPageLisOrder(visitNumber) {
  const patient_name = document.getElementById('adm-patient-name')?.value?.trim();
  const nik = document.getElementById('adm-nik')?.value?.trim() || null;
  const mr_no = document.getElementById('adm-mr-no')?.value?.trim() || null;
  const patient_gender = document.getElementById('adm-gender')?.value || 'L';
  const ageVal = document.getElementById('adm-age')?.value?.trim() || '30';
  const doctor = document.getElementById('adm-doctor')?.value?.trim() || 'APS';
  const priority = _lisCurrentPriority;
  const baseBarcode = document.getElementById('adm-barcode')?.value?.trim() || `L${Date.now().toString().slice(-8)}`;
  const notes = document.getElementById('adm-notes')?.value?.trim() || null;

  if (!patient_name) {
    if (typeof toast === 'function') toast('Patient Name is required', 'err');
    return;
  }

  if (!_lisOrderSelectedTests.length) {
    if (typeof toast === 'function') toast('Select at least 1 laboratory test', 'err');
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
      doctor_name: doctor,
      unit: 'Laboratorium',
      visit_type: 'Walk-in (APS)',
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

    if (typeof toast === 'function') toast(`✅ Lab Order Saved (${requiredTubes.length} Physical Tubes Generated)`, 'ok');

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
window.renderLis5ColumnMatrix = renderLis5ColumnMatrix;
window.toggleLisTestSelection = toggleLisTestSelection;
window.removeLisSelectedTest = removeLisSelectedTest;
window.submitFullPageLisOrder = submitFullPageLisOrder;
window.setLisOrderPriority = setLisOrderPriority;
window.appendLisClinicalNote = appendLisClinicalNote;
window.selectLisQuickPanel = selectLisQuickPanel;
window.resetLisAdmissionForm = resetLisAdmissionForm;
window.getRequiredTubesForTests = getRequiredTubesForTests;
