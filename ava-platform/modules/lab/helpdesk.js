// ═══════════════════════════════════════════════════════════════════════════
// MODULE: HELP DESK, SOP & PANDUAN ALUR SISTEM LIS (ISO 15189:2022 COMPLIANT)
// Panduan 360° Operasional & Konfigurasi Laboratorium Klinik Terintegrasi
// ═══════════════════════════════════════════════════════════════════════════

let _helpDeskActiveTab = 'FLOW';
let _helpDeskSearchQuery = '';

const LIS_WORKFLOW_STAGES = [
  {
    step: '1',
    id: 'stage-pra-analitik',
    title: 'Pra-Analitik & Sampling',
    color: '#7C3AED',
    icon: '🩸',
    subTitle: 'Registrasi Pasien, Pemilihan Parameter LOINC, Auto-Split Tabung & Sampling',
    menus: [
      { id: 'lis-admission', name: 'Order Pemeriksaan', desc: 'Pendaftaran order walk-in/rujukan, pemilihan 530+ parameter LOINC, deteksi duplikasi, dan kalkulasi otomatis tabung spesimen baku CLSI.' },
      { id: 'lab', name: 'Penerimaan & Barcode', desc: 'Check-in fisik sampel di meja laboratorium, pencetakan label barcode termal (L{YYMMDD}-xxx), dan verifikasi kesesuaian identitas pasien.' },
      { id: 'lis-phlebotomy', name: 'Flebotomi & Sampling', desc: 'Pencatatan waktu tusukan vena/kapiler, lokasi flebotomi, identitas flebotomis, dan verifikasi volume spesimen.' },
      { id: 'lis-kelayakan', name: 'Kriteria Kelayakan Spesimen', desc: 'Skrining mutu pra-analitik: penolakan otomatis sampel hemolisis berat, lipemik, ikterik, bekuan (clot), atau volume kurang (QNS).' }
    ],
    sop: 'Pastikan identifikasi pasien menggunakan minimal 2 data pengenal (Nama & Tgl Lahir/No RM). Pengambilan darah wajib mematuhi Order of Draw CLSI GP41-A6 (Sitrat Biru ➔ Serum Kuning ➔ EDTA Ungu ➔ Urin).'
  },
  {
    step: '2',
    id: 'stage-analitik',
    title: 'Analitik & Interfacing Alat',
    color: '#0284C7',
    icon: '🔬',
    subTitle: 'Antrean Analyzer, Koneksi ASTM/HL7 Port :9999, Input Hasil & Delta Check',
    menus: [
      { id: 'worklist', name: 'Worklist Analyzer', desc: 'Daftar antrean kerja batch sampel per instrumen analyzer dengan pembedaan prioritas CITO vs Rutin.' },
      { id: 'lab-result', name: 'Entry Hasil & Delta Check', desc: 'Penerimaan hasil otomatis dari mesin atau manual, kalkulator pengenceran (1:2 hingga 1:100), visualisasi Scattergram 2D Sysmex, dan deteksi pergeseran riwayat (Delta Check).' },
      { id: 'lis-analyzer', name: 'Interfacing Alat (:9999)', desc: 'Konfigurasi protokol komunikasi bi-directional ASTM E1381/E1394 & HL7 v2, channel mapping, dan simulator query host.' },
      { id: 'lis-lot-verification', name: 'Verifikasi Lot Reagen', desc: 'Validasi bias lot-to-lot reagen baru (CLSI EP26-A) sebelum digunakan pada pemeriksaan rutin pasien.' }
    ],
    sop: 'Setiap hasil yang keluar dari rentang kritis atau memicu Delta Violation Flag (>50% pergeseran dalam 24 jam) wajib dikonfirmasi ulang via pengenceran atau pengujian duplo sebelum dikirim ke dokter Sp.PK.'
  },
  {
    step: '3',
    id: 'stage-pasca-analitik',
    title: 'Pasca-Analitik & Otorisasi Medis',
    color: '#059669',
    icon: '✅',
    subTitle: 'Otorisasi Sp.PK, Logbook Nilai Kritis TBaK, TTE Kriptografis QR & Monitoring TAT',
    menus: [
      { id: 'lab-validation', name: 'Otorisasi Dokter Sp.PK', desc: 'Tinjauan klinis menyeluruh oleh Dokter Spesialis Patologi Klinik, integrasi Expert Auto-Impression, dan rekomendasi tes lanjutan.' },
      { id: 'lis-critical-value', name: 'Logbook Nilai Kritis', desc: 'Pencatatan pelaporan telepon ke DPJP dengan bukti read-back (Tulis-Baca-Konfirmasi / TBaK) dengan SLA ketat < 15 menit.' },
      { id: 'lab-approval', name: 'Validasi & TTE Digital', desc: 'Penerbitan hasil resmi ber-Tanda Tangan Elektronik (TTE) tersertifikasi QR code anti-pemalsuan dan rilis ke portal pasien.' },
      { id: 'lab-tat', name: 'Monitoring TAT', desc: 'Dashboard analitik waktu tunggu (Turnaround Time) pra-analitik, analitik, dan pasca-analitik dengan 8 Circular Progress Gauges.' }
    ],
    sop: 'Hasil resmi hanya dapat dirilis setelah divalidasi Sp.PK. Nilai kritis wajib segera dilaporkan ke dokter perawat/DPJP dan dicatat lengkap di logbook TBaK.'
  },
  {
    step: '4',
    id: 'stage-qc',
    title: 'Kendali Mutu (Quality Control)',
    color: '#D97706',
    icon: '📊',
    subTitle: 'QC Harian Levey-Jennings, 12 Aturan Westgard & Uji Profisiensi (PME)',
    menus: [
      { id: 'lab-qc', name: 'QC Harian & Westgard', desc: 'Grafik Levey-Jennings harian, evaluasi otomatis 12 Westgard Multi-rules (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x), dan Six Sigma Metrics.' },
      { id: 'lis-pme', name: 'Uji Profisiensi (PME)', desc: 'Manajemen uji profisiensi eksternal nasional/internasional (PME Kemenkes / RIQAS / EQAS) dan kalkulasi otomatis Z-Score ISO 15189.' }
    ],
    sop: 'Pemeriksaan sampel pasien tidak boleh dijalankan jika QC Harian melanggar aturan penolakan (misal 1-3s atau 2-2s). Wajib lakukan kalibrasi ulang atau pergantian reagen.'
  },
  {
    step: '5',
    id: 'stage-biobank',
    title: 'Bio-Bank & Arsip Spesimen',
    color: '#0891B2',
    icon: '🧊',
    subTitle: 'Penyimpanan Tabung Freezer -20°C, Add-on Testing & Riwayat Kumulatif',
    menus: [
      { id: 'lis-sample-archive', name: 'Rak Penyimpanan Spesimen', desc: 'Manajemen grid rak 10x10 freezer -20°C, retrieval cepat untuk pemeriksaan susulan (add-on test), dan jadwal pemusnahan limbah medis.' },
      { id: 'lab-report', name: 'Riwayat Hasil Kumulatif', desc: 'Pelacakan tren analit longitudinal pasien dari waktu ke waktu untuk pemantauan terapi kronis.' }
    ],
    sop: 'Serum/plasma pasien disimpan minimal 7 hari pada suhu -20°C pasca pemeriksaan untuk keperluan re-run atau klarifikasi medis.'
  }
];

const LIS_TROUBLESHOOTING_GUIDES = [
  {
    title: '🔌 Koneksi Alat Analyzer Port :9999 Terputus (Offline)',
    cause: 'Service background LIS Gateway tidak berjalan di PC Server Laboratorium atau kabel RS232/LAN longgar.',
    solution: [
      'Buka menu "Konfigurasi LIS & Gateway" lalu periksa status status port :9999.',
      'Unduh paket connector jika belum terpasang dan jalankan service `node connector.js`.',
      'Pastikan IP Address analyzer dan port listening sama dengan konfigurasi di LIS Gateway.'
    ]
  },
  {
    title: '⚠️ Pelanggaran Aturan Westgard 1-3s atau 2-2s pada QC Harian',
    cause: 'Terjadi error acak (random error) atau pergeseran sistematis (systematic shift) pada fotometer/reagen.',
    solution: [
      'Cek masa kedaluwarsa dan nomor lot reagen/kontrol yang terpasang di analyzer.',
      'Lakukan re-mix atau buka vial kontrol baru, lalu jalankan QC ulang.',
      'Bila masih out-of-control, lakukan kalibrasi parameter terkait sebelum memproses sampel pasien.'
    ]
  },
  {
    title: '🚨 Nilai Kritis Pasien Terdeteksi (Panic Value)',
    cause: 'Hasil analit melampaui batas bahaya kritis (contoh: K+ < 2.5 atau > 6.5 mmol/L, Glukosa < 45 mg/dL).',
    solution: [
      'Sistem otomatis memunculkan alert merah menyala pada workstation.',
      'Analis segera melakukan pengujian ulang (duplo) untuk memastikan validitas.',
      'Hubungi DPJP/ruangan via telepon dalam waktu < 15 menit, bacakan hasil, minta konfirmasi ulang, dan catat pada "Logbook Nilai Kritis".'
    ]
  },
  {
    title: '🩸 Sampel Hemolisis / Lipemik / Bekuan Terdeteksi',
    cause: 'Kesalahan saat flebotomi, sentrifugasi prematur, atau lipidemia pada darah pasien.',
    solution: [
      'Buka menu "Kriteria Kelayakan Spesimen" dan klik "Tolak Sampel".',
      'Pilih alasan spesifik (misal Hemolisis Indeks +3) dan kirim notifikasi ke unit pengirim.',
      'Order sampling ulang secara otomatis diterbitkan di antrean flebotomi.'
    ]
  }
];

async function renderLisHelpDesk() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:16px 20px; font-family:'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; max-width:1440px; margin:0 auto; color:var(--text, #1e293b);">
      
      <!-- TOP BANNER -->
      <div style="background:linear-gradient(135deg, #0A2342 0%, #0F3562 100%); color:#fff; border-radius:10px; padding:18px 22px; margin-bottom:16px; box-shadow:0 4px 16px rgba(10,35,66,0.12);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="background:#10B981; color:#fff; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:999px; text-transform:uppercase;">
                ISO 15189:2022 SOP
              </span>
              <span style="color:#94a3b8; font-size:12px;">&bull;</span>
              <span style="color:#38bdf8; font-size:12px; font-weight:700;">Sysmex HCLAB Architecture</span>
            </div>
            <h1 style="font-size:22px; font-weight:800; margin:0; color:#fff;">
              💡 Pusat Bantuan, SOP &amp; Panduan Alur Kerja LIS
            </h1>
            <p style="font-size:13px; color:#cbd5e1; margin:4px 0 0 0; max-width:850px;">
              Panduan interaktif menyeluruh mengenai alur operasional laboratorium, penjelasan fungsi tiap menu, standar keselamatan pasien, dan solusi cepat penanganan kendala teknis.
            </p>
          </div>

          <div style="display:flex; gap:8px;">
            <button class="btn btn-sm" onclick="_helpDeskActiveTab='FLOW'; renderLisHelpDeskContent();"
              style="background:${_helpDeskActiveTab === 'FLOW' ? '#10B981' : 'rgba(255,255,255,0.15)'}; color:#fff; border:1px solid rgba(255,255,255,0.25); font-weight:750; border-radius:6px; padding:6px 14px;">
              🗺️ Alur Kerja Laboratorium
            </button>
            <button class="btn btn-sm" onclick="_helpDeskActiveTab='DICTIONARY'; renderLisHelpDeskContent();"
              style="background:${_helpDeskActiveTab === 'DICTIONARY' ? '#10B981' : 'rgba(255,255,255,0.15)'}; color:#fff; border:1px solid rgba(255,255,255,0.25); font-weight:750; border-radius:6px; padding:6px 14px;">
              📖 Penjelasan Menu (360°)
            </button>
            <button class="btn btn-sm" onclick="_helpDeskActiveTab='TROUBLESHOOT'; renderLisHelpDeskContent();"
              style="background:${_helpDeskActiveTab === 'TROUBLESHOOT' ? '#10B981' : 'rgba(255,255,255,0.15)'}; color:#fff; border:1px solid rgba(255,255,255,0.25); font-weight:750; border-radius:6px; padding:6px 14px;">
              🛠️ Troubleshooting Cepat
            </button>
          </div>
        </div>
      </div>

      <!-- DYNAMIC CONTENT CONTAINER -->
      <div id="helpdesk-content-area">
        <!-- Rendered dynamically -->
      </div>

    </div>
  `;

  renderLisHelpDeskContent();
}

function renderLisHelpDeskContent() {
  const container = document.getElementById('helpdesk-content-area');
  if (!container) return;

  if (_helpDeskActiveTab === 'FLOW') {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        
        <div class="card" style="padding:16px; border-left:4px solid #10B981;">
          <h3 style="font-size:15px; font-weight:800; margin:0 0 6px 0; color:var(--text);">
            🧭 Peta Alur Kerja Laboratorium End-to-End (SOP Klinis)
          </h3>
          <p style="font-size:12.5px; color:var(--text3); margin:0;">
            Berikut adalah siklus hidup spesimen laboratorium dari tahap registrasi hingga pelaporan hasil resmi dan pengarsipan bio-bank:
          </p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
          ${LIS_WORKFLOW_STAGES.map(st => `
            <div class="card" style="padding:16px; border-top:4px solid ${st.color}; border-radius:8px; display:flex; flex-direction:column; justify-content:space-between; background:var(--card-bg, #fff);">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span style="font-size:11px; font-weight:800; color:${st.color}; background:${st.color}15; padding:2px 8px; border-radius:4px;">
                    TAHAP ${st.step}
                  </span>
                  <span style="font-size:18px;">${st.icon}</span>
                </div>

                <h4 style="font-size:14.5px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
                  ${st.title}
                </h4>
                <p style="font-size:11.5px; color:var(--text3); margin:0 0 12px 0; line-height:1.4;">
                  ${st.subTitle}
                </p>

                <div style="border-top:1px solid var(--border); padding-top:8px; margin-bottom:10px;">
                  <div style="font-size:11px; font-weight:800; color:var(--text2); margin-bottom:6px;">Modul Terkait:</div>
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    ${st.menus.map(m => `
                      <div style="background:var(--bg2, #f8fafc); border:1px solid var(--border); padding:6px 8px; border-radius:5px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                          <b style="font-size:11.5px; color:var(--text);">${m.name}</b>
                          <button class="btn btn-xs btn-ghost" onclick="navigate('${m.id}')" style="font-size:10px; font-weight:800; color:#0284c7; padding:1px 6px;">
                            Buka &rarr;
                          </button>
                        </div>
                        <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">${m.desc}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>

              <div style="background:${st.color}10; border-left:3px solid ${st.color}; padding:8px 10px; border-radius:4px; font-size:11px; color:var(--text); margin-top:10px;">
                <b>SOP Kepatuhan:</b> ${st.sop}
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  } else if (_helpDeskActiveTab === 'DICTIONARY') {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        
        <!-- SEARCH BOX -->
        <div class="card" style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; margin:0 0 2px 0; color:var(--text);">
              📖 Kamus Penjelasan 100% Menu LIS (Operasional &amp; Konfigurasi)
            </h3>
            <p style="font-size:12px; color:var(--text3); margin:0;">
              Panduan tujuan, input wajib, otomatisasi, dan dokumen output per menu.
            </p>
          </div>
          <input type="text" placeholder="🔍 Cari menu atau fungsi..." value="${_helpDeskSearchQuery}"
            oninput="_helpDeskSearchQuery=this.value; renderLisHelpDeskContent();"
            style="padding:6px 12px; font-size:12px; border:1px solid var(--border); border-radius:6px; width:280px;">
        </div>

        <!-- OPERATIONAL SECTION -->
        <div>
          <div style="font-size:13px; font-weight:800; color:#0284C7; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <span>🩸 1. KELOMPOK MENU OPERASIONAL LAB (WORKFLOW HARIAN)</span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px; margin-bottom:20px;">
            ${renderDictionaryCards('OPERATIONAL')}
          </div>
        </div>

        <!-- CONFIGURATION SECTION -->
        <div>
          <div style="font-size:13px; font-weight:800; color:#7C3AED; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <span>⚙️ 2. KELOMPOK MENU PENGATURAN &amp; MASTER DATA (SETUP ADMINISTRASI)</span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px;">
            ${renderDictionaryCards('CONFIG')}
          </div>
        </div>

      </div>
    `;
  } else if (_helpDeskActiveTab === 'TROUBLESHOOT') {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        
        <div class="card" style="padding:16px; border-left:4px solid #EF4444;">
          <h3 style="font-size:15px; font-weight:800; margin:0 0 4px 0; color:var(--text);">
            🛠️ Panduan Penanganan Kendala Teknis &amp; Alarm Kritis (Troubleshooting)
          </h3>
          <p style="font-size:12.5px; color:var(--text3); margin:0;">
            Langkah-langkah cepat yang harus diambil analis saat terjadi kendala interfacing, kegagalan QC, atau alarm nilai kritis.
          </p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:14px;">
          ${LIS_TROUBLESHOOTING_GUIDES.map(tg => `
            <div class="card" style="padding:16px; border-radius:8px; background:var(--card-bg, #fff);">
              <h4 style="font-size:14px; font-weight:800; color:#EF4444; margin:0 0 8px 0;">
                ${tg.title}
              </h4>
              <div style="background:var(--bg2, #f8fafc); padding:8px 10px; border-radius:6px; font-size:11.5px; margin-bottom:10px; border-left:3px solid #94a3b8;">
                <b>Kemungkinan Penyebab:</b> ${tg.cause}
              </div>
              <div style="font-size:11.5px; font-weight:750; color:var(--text); margin-bottom:6px;">Langkah Penanganan Solutif:</div>
              <ol style="margin:0; padding-left:18px; font-size:11.5px; color:var(--text2); display:flex; flex-direction:column; gap:4px; line-height:1.4;">
                ${tg.solution.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  }
}

function renderDictionaryCards(type) {
  const dictionary = [
    // OPERASIONAL
    { type: 'OPERATIONAL', id: 'lab', name: 'Penerimaan & Barcode', icon: '🩸', role: 'Petugas Admisi / Analis', desc: 'Melakukan check-in fisik tabung darah/spesimen yang masuk, mencocokkan identitas pasien, dan mencetak label barcode standar 50x30 mm.' },
    { type: 'OPERATIONAL', id: 'lis-admission', name: 'Order Pemeriksaan', icon: '📝', role: 'Petugas Admisi / Flebotomis', desc: 'Mendaftarkan order pemeriksaan baru, memilih dari 530+ parameter LOINC, dan menghitung otomatis pembagian tabung fisik baku CLSI.' },
    { type: 'OPERATIONAL', id: 'lis-phlebotomy', name: 'Flebotomi & Sampling', icon: '💉', role: 'Flebotomis', desc: 'Mencatat stempel waktu pengambilan sampel (collected_at), identitas flebotomis, dan lokasi tusukan vena/kapiler.' },
    { type: 'OPERATIONAL', id: 'lis-kelayakan', name: 'Kriteria Kelayakan Spesimen', icon: '🔍', role: 'Analis Mutu', desc: 'Melakukan verifikasi visual kualitas sampel (penolakan otomatis spesimen lisis/lipemik/bekuan/volume kurang).' },
    { type: 'OPERATIONAL', id: 'worklist', name: 'Worklist Analyzer', icon: '🔬', role: 'Analis Laboratorium', desc: 'Menampilkan antrean kerja pengujian sampel pada masing-masing instrumen analyzer (Hematologi, Kimia Darah, Urinalisis).' },
    { type: 'OPERATIONAL', id: 'lab-result', name: 'Entry Hasil & Delta Check', icon: '📊', role: 'Analis Laboratorium', desc: 'Menginput atau menerima hasil otomatis dari analyzer, menghitung faktor pengenceran, dan mendeteksi lonjakan delta check.' },
    { type: 'OPERATIONAL', id: 'lis-analyzer', name: 'Interfacing Alat (:9999)', icon: '🔌', role: 'IT Support / Analis', desc: 'Monitoring gateway komunikasi bi-directional alat analyzer menggunakan standar ASTM E1381/E1394 di port :9999.' },
    { type: 'OPERATIONAL', id: 'lis-lot-verification', name: 'Verifikasi Lot Reagen', icon: '🧪', role: 'Supervisor Lab', desc: 'Melakukan evaluasi bias uji paralel lot-to-lot reagen baru sesuai pedoman CLSI EP26-A sebelum digunakan pada pasien.' },
    { type: 'OPERATIONAL', id: 'lab-validation', name: 'Otorisasi Dokter Sp.PK', icon: '👨‍⚕️', role: 'Dokter Sp.PK', desc: 'Tinjauan klinis medis terhadap hasil analitik pasien, penulisan expert impression, dan persetujuan rilis resmi.' },
    { type: 'OPERATIONAL', id: 'lis-critical-value', name: 'Logbook Nilai Kritis', icon: '🚨', role: 'Analis / Dokter Sp.PK', desc: 'Pencatatan eskalasi nilai kritis telepon ke DPJP dengan SLA < 15 menit dan bukti read-back (TBaK).' },
    { type: 'OPERATIONAL', id: 'lab-approval', name: 'Validasi & TTE Digital', icon: '🔏', role: 'Dokter Sp.PK / Validator', desc: 'Penerbitan dokumen hasil resmi dengan Tanda Tangan Elektronik QR tersertifikasi anti-pemalsuan.' },
    { type: 'OPERATIONAL', id: 'lab-tat', name: 'Monitoring TAT', icon: '⏱️', role: 'Kepala Laboratorium', desc: 'Pemantauan durasi pra-analitik, analitik, dan pasca-analitik berbasis 8 Circular Progress Gauges.' },
    { type: 'OPERATIONAL', id: 'lab-qc', name: 'QC Harian & Westgard', icon: '📈', role: 'Analis / Tim Mutu', desc: 'Plotting Levey-Jennings kontrol harian, evaluasi 12 multi-rules Westgard, dan Six Sigma Metrics.' },
    { type: 'OPERATIONAL', id: 'lis-pme', name: 'Uji Profisiensi (PME)', icon: '🏆', role: 'Tim Mutu ISO 15189', desc: 'Kalkulasi Z-Score uji profisiensi eksternal (PME Kemenkes / RIQAS) untuk kepatuhan akreditasi.' },
    { type: 'OPERATIONAL', id: 'lis-sample-archive', name: 'Rak Penyimpanan Spesimen', icon: '🧊', role: 'Petugas Bank Sampel', desc: 'Manajemen slot penyimpanan serum/plasma pada freezer -20°C untuk add-on test dan jadwal disposal.' },
    { type: 'OPERATIONAL', id: 'lab-report', name: 'Riwayat Hasil Kumulatif', icon: '📁', role: 'Klinisi / Analis', desc: 'Melihat tren analit longitudinal pasien untuk evaluasi efektivitas terapi medis jangka panjang.' },

    // KONFIGURASI
    { type: 'CONFIG', id: 'refrange', name: 'Reference Range Matrix', icon: '📏', role: 'Admin Lab / Sp.PK', desc: 'Konfigurasi rentang rujukan multi-tier per kelompok umur (neonatus, anak, dewasa, geriatri), gender, dan metode alat.' },
    { type: 'CONFIG', id: 'product', name: 'Katalog Tes & LOINC/UCUM', icon: '🏷️', role: 'Admin LIS / Sp.PK', desc: 'Master data 530+ parameter tes laboratorium terstandarisasi LOINC (OBX-3) dan UCUM (OBX-6).' },
    { type: 'CONFIG', id: 'package', name: 'Panel & Paket Pemeriksaan', icon: '📦', role: 'Admin LIS', desc: 'Konfigurasi paket pemeriksaan (Panel Lipid, LFT, RFT, MCU) untuk pemilihan cepat (quick explosion).' },
    { type: 'CONFIG', id: 'inventory', name: 'Inventori Reagen & BHP', icon: '📦', role: 'Logistik Farmasi/Lab', desc: 'Manajemen stok reagen, kit kontrol, kalibrator, batas kedaluwarsa, dan pemantauan suhu penyimpanan.' },
    { type: 'CONFIG', id: 'referral', name: 'Rujukan Laboratorium', icon: '🤝', role: 'Koordinator Rujukan', desc: 'Manajemen pengiriman spesimen ke lab rujukan eksternal dan rekonsiliasi biaya rujukan.' },
    { type: 'CONFIG', id: 'catalog-export', name: 'Ekspor Standar LOINC', icon: '📤', role: 'IT Manager / Konsultan', desc: 'Pengekspor dataset katalog tes siap integrasi LIS/HIS klien dalam format CSV/TSV terstruktur.' },
    { type: 'CONFIG', id: 'lis-settings', name: 'Konfigurasi LIS & Gateway', icon: '⚙️', role: 'Superadmin / IT', desc: 'Pengaturan profil instansi, logo kop hasil PDF, DPJP Sp.PK, ambang batas kritis, dan installer gateway :9999.' }
  ];

  const q = (_helpDeskSearchQuery || '').toLowerCase();
  const items = dictionary.filter(d => d.type === type && (!q || d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q)));

  if (!items.length) {
    return `<div style="grid-column:1/-1; padding:20px; text-align:center; color:var(--text3); font-size:12px;">Tidak ditemukan menu yang cocok.</div>`;
  }

  return items.map(it => `
    <div class="card" style="padding:14px; border-radius:8px; background:var(--card-bg, #fff); display:flex; flex-direction:column; justify-content:space-between;">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">${it.icon}</span>
            <b style="font-size:13px; color:var(--text);">${it.name}</b>
          </div>
          <button class="btn btn-xs btn-ghost" onclick="navigate('${it.id}')" style="font-size:10.5px; font-weight:800; color:#0284c7; padding:2px 6px;">
            Buka &rarr;
          </button>
        </div>

        <div style="font-size:10px; font-weight:750; color:#059669; margin-bottom:6px;">
          👤 Pengguna: ${it.role}
        </div>

        <p style="font-size:11.5px; color:var(--text3); margin:0; line-height:1.4;">
          ${it.desc}
        </p>
      </div>
    </div>
  `).join('');
}

window.renderLisHelpDesk = renderLisHelpDesk;
window.renderLisHelpDeskContent = renderLisHelpDeskContent;
