// ═══════════════════════════════════════════════════════════════════════════
// MODULE: ORDER ENTRY & ADMISI LABORATORIUM (SYSMEX HCLAB PRO MAX WORKSTATION)
// Desain Responsif Ergonomis Tinggi:
// - Zero Horizontal Overflow pada semua resolusi layar (Desktop & Laptop)
// - Responsive Multi-Discipline Matrix (Hematology, Chemistry, Immunology, Urine/Micro)
// - Smart Multi-Tube Auto-Splitting (CLSI GP41-A6) & Direct Thermal Barcode Output
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
    name: 'Panel Skrining Pra-Nikah',
    code: 'PREMARITAL',
    color: '#14B8A6',
    tube: '🟣 EDTA + 🟡 Serum + ⚪ Urin',
    price: 495000,
    tests: ['Hematologi Lengkap (CBC)', 'Golongan Darah ABO & Rhesus', 'HBsAg Kualitatif Rapid', 'Anti-HIV Kualitatif Rapid (3 Metode)', 'VDRL / RPR Sifilis', 'Urin Rutin Lengkap (Automated Strip + Sedimen)']
  }
];

// Presets Catatan Klinis / Sampling
const CLINICAL_PRESETS = [
  'Puasa 10-12 jam',
  'Suspek DBD (Demam H-3)',
  'Kontrol Diabetes Melitus',
  'Evaluasi Fungsi Ginjal',
  'Skrining Pra-Operasi',
  'Medical Check-up (MCU)',
  'Trimester 1 ANC'
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
    <div style="padding:12px 16px; font-family:'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; max-width:1600px; margin:0 auto; font-size:12px; color:var(--text, #1e293b); box-sizing:border-box; overflow-x:hidden;">
      
      <!-- TOP COMMAND BAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:linear-gradient(90deg, #0B2240 0%, #17375E 100%); color:#fff; padding:8px 14px; border-radius:8px; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn btn-xs" onclick="navigate('lab')" style="background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.3); font-weight:700; border-radius:4px; padding:3px 10px;">
            ← Keluar
          </button>
          <div>
            <div style="font-weight:800; font-size:13.5px; letter-spacing:0.02em; display:flex; align-items:center; gap:8px;">
              <span>SYSMEX HCLAB</span>
              <span style="font-size:10.5px; font-weight:700; color:#38bdf8; background:rgba(56,189,248,0.15); padding:1px 6px; border-radius:3px;">Order Entry Pro Max</span>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" class="btn btn-xs" onclick="resetLisAdmissionForm()" style="background:rgba(255,255,255,0.12); color:#cbd5e1; border:1px solid rgba(255,255,255,0.25); font-weight:700; padding:4px 10px;">
            📄 Form Baru
          </button>
          <button type="button" class="btn btn-xs" onclick="submitFullPageLisOrder('${autoVisit}')" style="background:#10B981; color:#fff; border:1px solid #059669; font-weight:800; padding:4px 14px; box-shadow:0 2px 8px rgba(16,185,129,0.35);">
            💾 Simpan &amp; Barcode (Ctrl+Enter)
          </button>
        </div>
      </div>

      <!-- HORIZONTAL COMPACT DEMOGRAPHIC PANEL (RESPONSIVE GRID) -->
      <div id="lis-adm-header-panel" style="background:var(--bg2, #f1f5f9); border:1px solid var(--border, #cbd5e1); padding:10px 12px; margin-bottom:10px; border-radius:8px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(135px, 1fr)); gap:8px; align-items:end;">
          
          <div>
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">Lab No / Accession</label>
            <input type="text" id="adm-barcode" value="${autoBarcode}" readonly style="width:100%; padding:5px 7px; font-size:11.5px; font-weight:800; font-family:monospace; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; color:#0f766e; box-sizing:border-box;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">No. RM / PID *</label>
            <input type="text" id="adm-mr-no" value="${autoMR}" style="width:100%; padding:5px 7px; font-size:11.5px; font-family:monospace; font-weight:700; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; box-sizing:border-box;">
          </div>

          <div style="grid-column: span 2;">
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">Nama Pasien *</label>
            <input type="text" id="adm-patient-name" placeholder="Ketik nama lengkap..." required style="width:100%; padding:5px 7px; font-size:12px; font-weight:700; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; box-sizing:border-box;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">NIK / KTP</label>
            <input type="text" id="adm-nik" placeholder="16 digit NIK" maxlength="16" style="width:100%; padding:5px 7px; font-size:11.5px; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; box-sizing:border-box;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">Usia *</label>
            <input type="text" id="adm-age" value="30 Th" placeholder="30 Th" style="width:100%; padding:5px 7px; font-size:11.5px; font-weight:700; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; box-sizing:border-box;">
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">Gender *</label>
            <select id="adm-gender" style="width:100%; padding:5px 7px; font-size:11.5px; font-weight:700; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; box-sizing:border-box;">
              <option value="L">Laki-laki (L)</option>
              <option value="P">Perempuan (P)</option>
            </select>
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">Prioritas</label>
            <select id="adm-priority" onchange="setLisOrderPriority(this.value)" style="width:100%; padding:5px 7px; font-size:11.5px; font-weight:800; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; color:#0284c7; box-sizing:border-box;">
              <option value="ROUTINE">ROUTINE</option>
              <option value="STAT">⚡ STAT / CITO</option>
            </select>
          </div>

          <div>
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">Dokter / Faskes</label>
            <input type="text" id="adm-doctor" value="APS" placeholder="Dokter / Poli" style="width:100%; padding:5px 7px; font-size:11.5px; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; box-sizing:border-box;">
          </div>

          <div style="grid-column: span 2;">
            <label style="font-size:10px; font-weight:800; color:var(--text3, #64748b); text-transform:uppercase;">Catatan Klinis / Sampling</label>
            <input type="text" id="adm-notes" placeholder="Kondisi puasa, riwayat diagnosa..." style="width:100%; padding:5px 7px; font-size:11.5px; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; box-sizing:border-box;">
          </div>

        </div>

        <!-- FAST CLINICAL PRESETS CHIPS -->
        <div style="display:flex; align-items:center; gap:5px; margin-top:8px; overflow-x:auto; padding-bottom:2px;">
          <span style="font-size:10px; font-weight:800; color:var(--text3, #64748b); white-space:nowrap;">PRESET KLINIS:</span>
          ${CLINICAL_PRESETS.map(p => `
            <button type="button" class="btn btn-xs" onclick="appendLisClinicalNote('${p}')"
              style="font-size:10.5px; padding:2px 7px; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:4px; color:var(--text2, #475569); cursor:pointer; white-space:nowrap;">
              + ${p}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- QUICK PANELS & SEARCH FILTER RIBBON -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg2, #f8fafc); border:1px solid var(--border, #cbd5e1); padding:6px 10px; border-radius:6px; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:6px; overflow-x:auto; max-width:calc(100% - 280px);">
          <span style="font-size:11px; font-weight:800; color:var(--text, #0b2240); white-space:nowrap;">⚡ PANEL CEPAT:</span>
          ${QUICK_PANELS.map(pk => `
            <button type="button" onclick="selectLisQuickPanel('${pk.id}')"
              style="font-size:11px; font-weight:700; padding:3px 8px; border-radius:4px; border:1px solid ${pk.color}; background:var(--bg, #fff); color:var(--text, #0b2240); cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:4px;"
              onmouseover="this.style.background='${pk.color}15'" onmouseout="this.style.background='var(--bg, #fff)'">
              <span style="color:${pk.color}; font-weight:900;">★</span>
              <span>${pk.name}</span>
            </button>
          `).join('')}
        </div>

        <div style="position:relative; width:260px; min-width:200px;">
          <input type="text" id="adm-test-search" placeholder="🔍 Filter parameter LOINC..." value="${_lisSearchQuery}"
            oninput="_lisSearchQuery=this.value; renderLis5ColumnMatrix();"
            style="width:100%; padding:5px 8px; font-size:11.5px; border:1px solid var(--border, #cbd5e1); border-radius:4px; box-sizing:border-box;">
          ${ _lisSearchQuery ? `<button onclick="_lisSearchQuery=''; document.getElementById('adm-test-search').value=''; renderLis5ColumnMatrix();" style="position:absolute; right:6px; top:5px; background:none; border:none; cursor:pointer; color:var(--text3);">&times;</button>` : '' }
        </div>
      </div>

      <!-- MAIN MULTI-COLUMN WORKSTATION (4 DISCIPLINE COLS + 1 SUMMARY PANEL) -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)) 340px; gap:10px; align-items:start;">
        
        <!-- DISCIPLINE COLUMNS WRAPPER (4 COLS) -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px; min-width:0;">
          
          <!-- COLUMN 1: HEMATOLOGY -->
          <div style="background:var(--card-bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:6px; display:flex; flex-direction:column; overflow:hidden;">
            <div style="background:#7c3aed; color:#fff; font-weight:800; font-size:11.5px; padding:6px 9px; letter-spacing:0.02em; display:flex; justify-content:space-between; align-items:center;">
              <span>🩸 HEMATOLOGI</span>
              <span id="count-hem" style="font-size:10px; opacity:0.9;"></span>
            </div>
            <div id="col-hem-list" style="padding:5px; overflow-y:auto; max-height:460px; display:flex; flex-direction:column; gap:3px; background:rgba(124,58,237,0.03);">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- COLUMN 2: CHEMISTRY -->
          <div style="background:var(--card-bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:6px; display:flex; flex-direction:column; overflow:hidden;">
            <div style="background:#0284c7; color:#fff; font-weight:800; font-size:11.5px; padding:6px 9px; letter-spacing:0.02em; display:flex; justify-content:space-between; align-items:center;">
              <span>🧪 KIMIA KLINIK</span>
              <span id="count-kim" style="font-size:10px; opacity:0.9;"></span>
            </div>
            <div id="col-kim-list" style="padding:5px; overflow-y:auto; max-height:460px; display:flex; flex-direction:column; gap:3px; background:rgba(2,132,199,0.03);">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- COLUMN 3: IMMUNOLOGY -->
          <div style="background:var(--card-bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:6px; display:flex; flex-direction:column; overflow:hidden;">
            <div style="background:#059669; color:#fff; font-weight:800; font-size:11.5px; padding:6px 9px; letter-spacing:0.02em; display:flex; justify-content:space-between; align-items:center;">
              <span>🛡️ IMUNOSEROLOGI</span>
              <span id="count-imu" style="font-size:10px; opacity:0.9;"></span>
            </div>
            <div id="col-imu-list" style="padding:5px; overflow-y:auto; max-height:460px; display:flex; flex-direction:column; gap:3px; background:rgba(5,150,105,0.03);">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- COLUMN 4: URINE & MICRO -->
          <div style="background:var(--card-bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:6px; display:flex; flex-direction:column; overflow:hidden;">
            <div style="background:#d97706; color:#fff; font-weight:800; font-size:11.5px; padding:6px 9px; letter-spacing:0.02em; display:flex; justify-content:space-between; align-items:center;">
              <span>⚪ URIN &amp; MIKRO</span>
              <span id="count-uri" style="font-size:10px; opacity:0.9;"></span>
            </div>
            <div id="col-uri-list" style="padding:5px; overflow-y:auto; max-height:460px; display:flex; flex-direction:column; gap:3px; background:rgba(217,119,6,0.03);">
              <!-- Rendered dynamically -->
            </div>
          </div>

        </div>

        <!-- SUMMARY PANEL (COLUMN 5) -->
        <div style="background:var(--card-bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:6px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,0.06); position:sticky; top:12px;">
          
          <div style="background:#0B2240; color:#fff; font-weight:800; font-size:11.5px; padding:6px 10px; letter-spacing:0.02em; display:flex; justify-content:space-between; align-items:center;">
            <span>📋 RINGKASAN ORDER (<span id="adm-selected-count">0</span>)</span>
            <button type="button" onclick="_lisOrderSelectedTests=[]; renderLis5ColumnMatrix();" style="background:none; border:none; color:#f87171; font-size:10.5px; font-weight:700; cursor:pointer;">Reset</button>
          </div>

          <!-- SELECTED TESTS LIST TABLE -->
          <div id="adm-selected-table-container" style="max-height:220px; overflow-y:auto; padding:4px; background:var(--bg, #fff);">
            <!-- Rendered dynamically -->
          </div>

          <!-- BOTTOM SMART TUBE AUTO-SPLITTING & TOTAL -->
          <div style="border-top:1px solid var(--border, #cbd5e1); background:var(--bg2, #f8fafc); padding:10px 12px;">
            <div style="font-size:10.5px; font-weight:800; color:var(--text, #334155); margin-bottom:5px;">
              🧪 SPESIMEN &amp; URUTAN PENGAMBILAN (CLSI GP41-A6):
            </div>
            
            <div id="adm-tube-reqs" style="display:flex; flex-direction:column; gap:4px; margin-bottom:10px; min-height:42px;">
              <span style="color:var(--text3, #94a3b8); font-size:11px;">Belum ada tes yang dipilih.</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border, #cbd5e1); padding-top:8px; margin-bottom:10px;">
              <span style="font-size:11px; font-weight:700; color:var(--text3, #475569);">Estimasi Total Tarif:</span>
              <span id="adm-total-price" style="font-size:16px; font-weight:900; color:#10B981;">Rp 0</span>
            </div>

            <button type="button" class="btn btn-teal" onclick="submitFullPageLisOrder('${autoVisit}')"
              style="width:100%; font-weight:800; padding:9px; font-size:12.5px; border-radius:5px; background:#10B981; color:#fff; border:none; cursor:pointer; box-shadow:0 3px 10px rgba(16,185,129,0.35);">
              💾 SIMPAN ORDER &amp; CETAK BARCODE
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
    panel.style.background = 'var(--bg2, #f1f5f9)';
    panel.style.border = '1px solid var(--border, #cbd5e1)';
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

  if (typeof toast === 'function') toast(`⚡ ${panel.name} ditambahkan`, 'ok');
  renderLis5ColumnMatrix();
}

function renderLis5ColumnMatrix() {
  const q = (_lisSearchQuery || '').toLowerCase();

  const hemProds = _lisAllProducts.filter(p => {
    const k = (p.kategori || '').toLowerCase();
    const matchCat = k.includes('hematologi') || p.nama_tes.includes('Hb') || p.nama_tes.includes('Darah') || p.nama_tes.includes('LED') || p.nama_tes.includes('Trombosit');
    const matchQ = !q || p.nama_tes.toLowerCase().includes(q) || (p.loinc_code && p.loinc_code.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  const kimProds = _lisAllProducts.filter(p => {
    const k = (p.kategori || '').toLowerCase();
    const matchCat = k.includes('kimia') || p.nama_tes.includes('Glukosa') || p.nama_tes.includes('Kolesterol') || p.nama_tes.includes('SGOT') || p.nama_tes.includes('SGPT') || p.nama_tes.includes('Ureum') || p.nama_tes.includes('Kreatinin');
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

  if (countEl) countEl.textContent = `${prods.length}`;

  if (!prods.length) {
    container.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text3, #94a3b8); font-size:11px;">Tidak ada parameter cocok</div>`;
    return;
  }

  container.innerHTML = prods.map(p => {
    const isChecked = _lisOrderSelectedTests.some(t => t.id === p.id);
    const price = p.harga_dasar || p.tarif || 0;
    
    return `
      <div onclick="toggleLisTestSelection(${p.id}, ${!isChecked})"
        style="display:flex; justify-content:space-between; align-items:center; padding:5px 7px; border-radius:4px; background:${isChecked ? '#d1fae5' : 'var(--bg, #fff)'}; border:1px solid ${isChecked ? '#10b981' : 'var(--border, #e2e8f0)'}; cursor:pointer; font-size:11px; user-select:none; transition:all 0.1s;"
        onmouseover="if(!${isChecked}) this.style.background='var(--bg2, #f8fafc)'" onmouseout="if(!${isChecked}) this.style.background='var(--bg, #fff)'">
        <div style="display:flex; align-items:center; gap:6px; overflow:hidden; flex:1;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();" onchange="toggleLisTestSelection(${p.id}, this.checked)"
            style="accent-color:#10B981; width:13px; height:13px; cursor:pointer; flex-shrink:0;">
          <span style="font-weight:${isChecked ? '800' : '600'}; color:${isChecked ? '#065f46' : 'var(--text, #1e293b)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${p.nama_tes}
          </span>
        </div>
        <span style="font-size:10px; font-weight:750; color:#059669; white-space:nowrap; margin-left:4px; flex-shrink:0;">
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
      <div style="padding:20px; text-align:center; color:var(--text3, #94a3b8); font-size:11px;">
        <div style="font-size:20px; margin-bottom:4px;">📋</div>
        Pilih parameter pada matriks disiplin di samping
      </div>
    `;
    if (priceEl) priceEl.textContent = 'Rp 0';
    if (tubeEl) tubeEl.innerHTML = `<span style="color:var(--text3, #94a3b8); font-size:11px;">Belum ada spesimen tabung terpilih.</span>`;
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
        <tr style="background:var(--bg2, #f1f5f9); color:var(--text2, #475569); font-weight:800; text-align:left; border-bottom:1px solid var(--border, #cbd5e1);">
          <th style="padding:4px 6px;">Kode</th>
          <th style="padding:4px 6px;">Pemeriksaan</th>
          <th style="padding:4px 6px; text-align:right;">Tarif</th>
          <th style="padding:4px 4px; text-align:center; width:20px;"></th>
        </tr>
      </thead>
      <tbody>
        ${_lisOrderSelectedTests.map(t => {
          const price = t.harga_dasar || t.tarif || 0;
          return `
            <tr style="border-bottom:1px solid var(--border, #f1f5f9);">
              <td style="padding:4px 6px; font-family:monospace; font-weight:700; color:#0284c7;">${t.kode_internal || 'LAB'}</td>
              <td style="padding:4px 6px; font-weight:600; color:var(--text, #1e293b);">${t.nama_tes}</td>
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
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-left:3px solid ${tb.color}; padding:3px 6px; border-radius:3px; font-size:10.5px;">
        <span style="font-weight:700; color:var(--text, #1e293b);">${idx + 1}. ${tb.name}</span>
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
  if (typeof toast === 'function') toast('Form order dibersihkan', 'info');
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

    if (typeof toast === 'function') toast(`✅ Order Lab Tersimpan (${requiredTubes.length} Tabung Spesimen)`, 'ok');

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
