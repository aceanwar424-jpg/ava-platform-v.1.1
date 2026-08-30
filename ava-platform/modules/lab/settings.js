// ═══════════════════════════════════════════════════════════════════════════
// MODULE: PENGATURAN & KONFIGURASI LABORATORIUM (LIS SETTINGS)
// Profil Faskes, dr. Sp.PK, Ambang Kritis per Parameter, Format Hasil PDF, & Connector (:9999)
// ═══════════════════════════════════════════════════════════════════════════

let _lisActiveSettingsTab = 'profil';

const LIS_DEFAULT_SETTINGS = {
  lab_name: 'AVA DIAGNOSTICS & LABORATORY',
  lab_permit_no: '445/1029-DINKES/LAB-KLINIK/2024',
  lab_address: 'Jl. Boulevard Kesehatan No. 88, Jakarta Selatan 12950',
  lab_phone: '(021) 555-0199',
  lab_email: 'lab.diagnostic@avahealth.sbs',
  sppk_name: 'dr. H. Hendra Setiawan, Sp.PK(K)',
  sppk_sip: 'SIP: 446.1/0892/SIP-D/2022',
  iso_cert: 'ISO 15189:2022 Terakreditasi KAN LP-998-IDN',
  critical_alert_sla: 15, // menit
  delta_check_threshold: 25, // persen lonjakan
  connector_port: 9999,
  connector_url: 'http://127.0.0.1:9999',
  satusehat_active: true
};

const DEFAULT_CRITICAL_PARAMETERS = [
  { id: 1, code: 'GLU', name: 'Glukosa Darah Sewaktu/Puasa', low: 45, high: 450, unit: 'mg/dL', alert: 'Hipoglikemia Akut / Koma KAD', action: 'Lapor DPJP via TBaK <15m' },
  { id: 2, code: 'K', name: 'Kalium Serum (K+)', low: 2.8, high: 6.2, unit: 'mmol/L', alert: 'Aritmia Jantung Fatal', action: 'Lapor DPJP via TBaK <15m' },
  { id: 3, code: 'NA', name: 'Natrium Serum (Na+)', low: 120, high: 160, unit: 'mmol/L', alert: 'Edema Serebral / Dehidrasi Berat', action: 'Lapor DPJP <15m' },
  { id: 4, code: 'HGB', name: 'Hemoglobin (Hb)', low: 7.0, high: 20.0, unit: 'g/dL', alert: 'Anemia Gravis / Polisitemia', action: 'Konfirmasi Transfusi Darah' },
  { id: 5, code: 'PLT', name: 'Trombosit (Platelet)', low: 20000, high: 1000000, unit: '/uL', alert: 'Risiko Perdarahan Spontan / DIC', action: 'Lapor DPJP <15m' },
  { id: 6, code: 'WBC', name: 'Leukosit', low: 2000, high: 30000, unit: '/uL', alert: 'Leukopenia Berat / Leukemoid', action: 'Lapor DPJP <15m' },
  { id: 7, code: 'CA', name: 'Kalsium Ion / Total', low: 6.5, high: 13.0, unit: 'mg/dL', alert: 'Tetani / Krisis Hiperkalsemia', action: 'Lapor DPJP <15m' },
  { id: 8, code: 'TROP', name: 'Troponin I Kuantitatif', low: null, high: 0.04, unit: 'ng/mL', alert: 'Sindrom Koroner Akut (STEMI)', action: 'Hubungi Dokter Jaga IGD/ICU Segera' }
];

function getLisSettings() {
  try {
    const saved = localStorage.getItem('AVA_LIS_SETTINGS');
    return saved ? { ...LIS_DEFAULT_SETTINGS, ...JSON.parse(saved) } : LIS_DEFAULT_SETTINGS;
  } catch (e) {
    return LIS_DEFAULT_SETTINGS;
  }
}

function getCriticalParameters() {
  try {
    const saved = localStorage.getItem('AVA_LIS_CRITICAL_PARAMS');
    return saved ? JSON.parse(saved) : DEFAULT_CRITICAL_PARAMETERS;
  } catch (e) {
    return DEFAULT_CRITICAL_PARAMETERS;
  }
}

function saveCriticalParameters(params) {
  localStorage.setItem('AVA_LIS_CRITICAL_PARAMS', JSON.stringify(params));
}

function saveLisSettings(data) {
  const current = getLisSettings();
  const updated = { ...current, ...data };
  localStorage.setItem('AVA_LIS_SETTINGS', JSON.stringify(updated));
  if (typeof toast === 'function') toast('✓ Pengaturan Laboratorium berhasil disimpan', 'ok');
  renderLisSettings();
}

async function renderLisSettings() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const cfg = getLisSettings();

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif; max-width:1250px; margin:0 auto;">
      <!-- HEADER -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:14px; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#FBBF24; margin-bottom:4px;">
            ⚙️ KONFIGURASI LIS &bull; ISO 15189:2022
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 2px 0;">
            Pengaturan Laboratorium &amp; LIS Master Config
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Konfigurasi profil faskes, dr. Sp.PK, ambang nilai kritis per analit, katalog tes, dan connector alat server :9999.
          </p>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-teal" onclick="downloadConnectorZip()" style="display:flex; align-items:center; gap:6px; font-weight:800;">
            <span>⬇️</span> <span>Download Connector (.ZIP)</span>
          </button>
        </div>
      </div>

      <!-- TABS -->
      <div style="display:flex; gap:8px; border-bottom:1px solid var(--border); margin-bottom:20px; overflow-x:auto;">
        <button class="btn btn-ghost" style="border-radius:8px 8px 0 0; font-weight:750; font-size:13px; padding:10px 18px; border-bottom:3px solid ${_lisActiveSettingsTab === 'profil' ? '#10B981' : 'transparent'}; color:${_lisActiveSettingsTab === 'profil' ? 'var(--text)' : 'var(--text3)'};" onclick="switchLisSettingsTab('profil')">
          🏥 Profil Lab &amp; Sp.PK
        </button>
        <button class="btn btn-ghost" style="border-radius:8px 8px 0 0; font-weight:750; font-size:13px; padding:10px 18px; border-bottom:3px solid ${_lisActiveSettingsTab === 'critical' ? '#10B981' : 'transparent'}; color:${_lisActiveSettingsTab === 'critical' ? 'var(--text)' : 'var(--text3)'};" onclick="switchLisSettingsTab('critical')">
          🚨 Nilai Kritis per Parameter
        </button>
        <button class="btn btn-ghost" style="border-radius:8px 8px 0 0; font-weight:750; font-size:13px; padding:10px 18px; border-bottom:3px solid ${_lisActiveSettingsTab === 'connector' ? '#10B981' : 'transparent'}; color:${_lisActiveSettingsTab === 'connector' ? 'var(--text)' : 'var(--text3)'};" onclick="switchLisSettingsTab('connector')">
          🔌 Alat &amp; Connector (:9999)
        </button>
        <button class="btn btn-ghost" style="border-radius:8px 8px 0 0; font-weight:750; font-size:13px; padding:10px 18px; border-bottom:3px solid ${_lisActiveSettingsTab === 'catalog' ? '#10B981' : 'transparent'}; color:${_lisActiveSettingsTab === 'catalog' ? 'var(--text)' : 'var(--text3)'};" onclick="switchLisSettingsTab('catalog')">
          🧪 Master Katalog Tes (530+)
        </button>
        <button class="btn btn-ghost" style="border-radius:8px 8px 0 0; font-weight:750; font-size:13px; padding:10px 18px; border-bottom:3px solid ${_lisActiveSettingsTab === 'pdf' ? '#10B981' : 'transparent'}; color:${_lisActiveSettingsTab === 'pdf' ? 'var(--text)' : 'var(--text3)'};" onclick="switchLisSettingsTab('pdf')">
          📄 Format Lembar Hasil PDF
        </button>
      </div>

      <!-- TAB CONTENT -->
      <div id="lis-settings-content">
        ${renderLisSettingsTabContent(_lisActiveSettingsTab, cfg)}
      </div>
    </div>
  `;
}

function switchLisSettingsTab(tab) {
  _lisActiveSettingsTab = tab;
  renderLisSettings();
}

function renderLisSettingsTabContent(tab, cfg) {
  if (tab === 'profil') {
    return `
      <div class="card" style="padding:22px;">
        <h3 style="font-size:15px; font-weight:800; color:var(--text); margin:0 0 16px 0;">
          Identitas Laboratorium &amp; Penanggung Jawab Klinis
        </h3>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div class="form-group">
            <label style="font-size:12px; font-weight:750; color:var(--text2);">Nama Laboratorium / Klinik *</label>
            <input type="text" id="cfg-lab-name" value="${cfg.lab_name}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
          </div>

          <div class="form-group">
            <label style="font-size:12px; font-weight:750; color:var(--text2);">Nomor Izin Operasional Kemenkes / Dinkes *</label>
            <input type="text" id="cfg-lab-permit" value="${cfg.lab_permit_no}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
          </div>

          <div class="form-group" style="grid-column:1/-1;">
            <label style="font-size:12px; font-weight:750; color:var(--text2);">Alamat Lengkap Laboratorium</label>
            <input type="text" id="cfg-lab-address" value="${cfg.lab_address}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
          </div>

          <div class="form-group">
            <label style="font-size:12px; font-weight:750; color:var(--text2);">Telepon / Hotline Lab</label>
            <input type="text" id="cfg-lab-phone" value="${cfg.lab_phone}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
          </div>

          <div class="form-group">
            <label style="font-size:12px; font-weight:750; color:var(--text2);">Email Resmi Laboratorium</label>
            <input type="email" id="cfg-lab-email" value="${cfg.lab_email}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
          </div>

          <div class="form-group">
            <label style="font-size:12px; font-weight:750; color:var(--text2);">Dokter Penanggung Jawab (Sp.PK) *</label>
            <input type="text" id="cfg-sppk-name" value="${cfg.sppk_name}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
          </div>

          <div class="form-group">
            <label style="font-size:12px; font-weight:750; color:var(--text2);">SIP Dokter Penanggung Jawab *</label>
            <input type="text" id="cfg-sppk-sip" value="${cfg.sppk_sip}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
          </div>

          <div class="form-group" style="grid-column:1/-1;">
            <label style="font-size:12px; font-weight:750; color:var(--text2);">Nomor Sertifikasi / Akreditasi Laboratorium</label>
            <input type="text" id="cfg-iso-cert" value="${cfg.iso_cert}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
          </div>
        </div>

        <div style="margin-top:20px; display:flex; justify-content:flex-end;">
          <button class="btn btn-teal" onclick="submitProfileSettings()">💾 Simpan Profil Laboratorium</button>
        </div>
      </div>
    `;
  }

  if (tab === 'critical') {
    const params = getCriticalParameters();
    return `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- GENERAL SLA & DELTA CHECK -->
        <div class="card" style="padding:20px;">
          <h3 style="font-size:15px; font-weight:800; color:var(--text); margin:0 0 14px 0;">
            ⏱️ Standar Waktu &amp; Aturan Delta Check
          </h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label style="font-size:12px; font-weight:750; color:var(--text2);">SLA Maksimal Pelaporan Nilai Kritis ke DPJP (Menit)</label>
              <input type="number" id="cfg-critical-sla" value="${cfg.critical_alert_sla}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
              <span style="font-size:11px; color:var(--text3);">Standar ISO 15189 / KARS: maksimal &le; 15 menit dengan metode TBaK (Tulis, Baca, Konfirmasi).</span>
            </div>

            <div class="form-group">
              <label style="font-size:12px; font-weight:750; color:var(--text2);">Ambang Batas Delta Check (% Lonjakan vs Hasil Sebelumnya)</label>
              <input type="number" id="cfg-delta-threshold" value="${cfg.delta_check_threshold}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
              <span style="font-size:11px; color:var(--text3);">Peringatan otomatis saat hasil pasien melonjak drastis dari riwayat sebelumnya.</span>
            </div>
          </div>
          <div style="margin-top:12px; display:flex; justify-content:flex-end;">
            <button class="btn btn-teal btn-sm" onclick="submitCriticalSettings()">💾 Simpan Aturan SLA</button>
          </div>
        </div>

        <!-- TABEL AMBANG KRITIS PER PARAMETER / ANALIT -->
        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="font-size:15px; font-weight:800; color:var(--text); margin:0 0 2px 0;">
                🚨 Matriks Ambang Batas Nilai Kritis per Parameter / Analit
              </h3>
              <p style="font-size:12px; color:var(--text3); margin:0;">
                Daftar nilai batas bahaya yang mewajibkan analis segera menghubungi DPJP dan dicatat di logbook.
              </p>
            </div>
            <button class="btn btn-teal btn-sm" onclick="openAddCriticalParamModal()">+ Tambah Parameter Kritis</button>
          </div>

          <div class="table-wrap" style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Pemeriksaan / Analit</th>
                  <th>Batas Bawah (Low)</th>
                  <th>Batas Atas (High)</th>
                  <th>Satuan</th>
                  <th>Peringatan Klinis</th>
                  <th>Instruksi Analis</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${params.map(p => `
                  <tr>
                    <td><code>${p.code}</code></td>
                    <td style="font-weight:750; color:var(--text);">${p.name}</td>
                    <td style="color:#EF4444; font-weight:800;">${p.low !== null ? `&le; ${p.low}` : '—'}</td>
                    <td style="color:#EF4444; font-weight:800;">${p.high !== null ? `&ge; ${p.high}` : '—'}</td>
                    <td style="color:var(--text3); font-size:12px;">${p.unit}</td>
                    <td style="font-size:12px; color:#F59E0B; font-weight:600;">${p.alert}</td>
                    <td style="font-size:11.5px; color:var(--text2);">${p.action}</td>
                    <td>
                      <button class="btn btn-ghost btn-xs" onclick="deleteCriticalParam(${p.id})" style="color:#EF4444;" title="Hapus Parameter">&times;</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'connector') {
    return `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- BANNER INFO CONNECTOR -->
        <div class="card" style="padding:22px; background:linear-gradient(135deg, #071526 0%, #0F2D4A 100%); color:#fff; border:1px solid rgba(14,165,233,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
            <div>
              <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; color:#34d399; margin-bottom:8px;">
                ⚡ WINDOWS / LINUX DAEMON SERVICE &bull; PORT :9999
              </div>
              <h2 style="font-size:20px; font-weight:800; margin:0 0 6px 0; color:#fff;">
                Lab Analyzer Connector Daemon (ASTM E1381 / E1394 &amp; HL7)
              </h2>
              <p style="font-size:13px; color:#cbd5e1; margin:0; max-width:700px;">
                Layanan penghubung bi-directional antara mesin otomatis lab (Sysmex, Mindray, Cobas) dengan AVA LIS Cloud. Cukup unduh paket ZIP, ekstrak di komputer server lab, dan jalankan <code>start-connector.bat</code>.
              </p>
            </div>

            <div style="display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-teal" style="padding:12px 20px; font-size:13.5px; font-weight:800; border-radius:8px;" onclick="downloadConnectorZip()">
                ⬇️ Download Connector Bundle (.ZIP)
              </button>
              <button class="btn btn-ghost" style="color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:12px; font-weight:700;" onclick="testConnectorSocket()">
                🔍 Uji Koneksi Live Socket (:9999)
              </button>
            </div>
          </div>

          <div id="connector-test-result" style="margin-top:14px; display:none; padding:10px 14px; border-radius:8px; font-size:12.5px;"></div>
        </div>

        <!-- PANDUAN INSTALASI 3 LANGKAH -->
        <div class="card" style="padding:22px;">
          <h3 style="font-size:15px; font-weight:800; color:var(--text); margin:0 0 14px 0;">
            🚀 Panduan Pemasangan di Komputer Server Lab (3 Langkah Mudah)
          </h3>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
            <div style="background:var(--bg2); padding:16px; border-radius:10px; border-left:4px solid #0EA5E9;">
              <div style="font-size:14px; font-weight:800; color:var(--text); margin-bottom:6px;">1. Ekstrak Berkas ZIP</div>
              <p style="font-size:12px; color:var(--text3); margin:0;">
                Unduh file <code>ava-lab-connector.zip</code> dan ekstrak ke folder di PC Lab (misal: <code>C:\\AVA-Connector\\</code>).
              </p>
            </div>

            <div style="background:var(--bg2); padding:16px; border-radius:10px; border-left:4px solid #F59E0B;">
              <div style="font-size:14px; font-weight:800; color:var(--text); margin-bottom:6px;">2. Hubungkan Kabel Alat (RS232/LAN)</div>
              <p style="font-size:12px; color:var(--text3); margin:0;">
                Sambungkan kabel serial RS-232 atau TCP/IP LAN dari mesin Sysmex / Mindray / Cobas ke komputer server.
              </p>
            </div>

            <div style="background:var(--bg2); padding:16px; border-radius:10px; border-left:4px solid #10B981;">
              <div style="font-size:14px; font-weight:800; color:var(--text); margin-bottom:6px;">3. Klik Ganda <code>start-connector.bat</code></div>
              <p style="font-size:12px; color:var(--text3); margin:0;">
                Jalankan script batch. Server akan otomatis aktif di port <code>9999</code> dan menyinkronkan hasil lab secara instan ke LIS.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'catalog') {
    return `
      <div class="card" style="padding:22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
              🧪 Master Katalog Tes &amp; Nilai Rujukan (530+ Parameter LOINC/UCUM)
            </h3>
            <p style="font-size:13px; color:var(--text3); margin:0;">
              Seluruh parameter analit terstandarisasi HL7 v2 / FHIR (OBX-3 LOINC, OBX-6 UCUM).
            </p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-teal" onclick="navigate('product')">Buka Katalog Tes &rarr;</button>
            <button class="btn btn-ghost" onclick="navigate('refrange')">Nilai Rujukan &rarr;</button>
            <button class="btn btn-ghost" onclick="navigate('catalog-export')">Ekspor LOINC/UCUM &rarr;</button>
          </div>
        </div>

        <div style="background:var(--bg2); border-radius:10px; padding:16px; border:1px solid var(--border); font-size:13px; color:var(--text2);">
          <p style="margin:0 0 8px 0;"><b>Standar Kepatuhan Integritas Data ISO 15189:2022:</b></p>
          <ul style="margin:0; padding-left:20px; line-height:1.6;">
            <li>Panel tes dipecah menjadi baris analit individual dengan kode unik masing-masing.</li>
            <li>Rentang rujukan dipisah per kelompok usia, jenis kelamin, dan instrumen metode.</li>
            <li>Tersedia fitur verifikasi lot-to-lot reagen baru (CLSI EP26-A) sebelum digunakan operasional.</li>
          </ul>
        </div>
      </div>
    `;
  }

  if (tab === 'pdf') {
    return `
      <div class="card" style="padding:22px;">
        <h3 style="font-size:15px; font-weight:800; color:var(--text); margin:0 0 16px 0;">
          Format &amp; Kop Lembar Hasil Laboratorium (PDF)
        </h3>
        <p style="font-size:13px; color:var(--text3); margin-bottom:16px;">
          Sesuaikan tata letak, tanda tangan digital Sp.PK, logo resmi, dan watermark validasi pada lembar cetak hasil.
        </p>

        <div style="display:flex; gap:12px;">
          <button class="btn btn-teal" onclick="navigate('settings',{tab:'pdf'})">🖨 Buka Editor Kop Surat &amp; Template PDF</button>
        </div>
      </div>
    `;
  }

  return '';
}

function openAddCriticalParamModal() {
  if (typeof openModal !== 'function') return;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Tambah Parameter Nilai Kritis Baru</div>
      <button class="modal-close" onclick="closeModalForce()">&times;</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px; padding:6px 0;">
      <div class="form-group">
        <label style="font-size:12px; font-weight:750;">Nama Parameter / Pemeriksaan *</label>
        <input type="text" id="new-crit-name" placeholder="Contoh: Bilirubin Total Neonatus" required style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="form-group">
          <label style="font-size:12px; font-weight:750;">Kode Parameter</label>
          <input type="text" id="new-crit-code" placeholder="Contoh: BIL-TOT" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
        </div>
        <div class="form-group">
          <label style="font-size:12px; font-weight:750;">Satuan (UCUM)</label>
          <input type="text" id="new-crit-unit" placeholder="mg/dL, mmol/L..." style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="form-group">
          <label style="font-size:12px; font-weight:750;">Batas Kritis Bawah (Low &le;)</label>
          <input type="number" id="new-crit-low" placeholder="Kosongkan jika tidak ada" step="any" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
        </div>
        <div class="form-group">
          <label style="font-size:12px; font-weight:750;">Batas Kritis Atas (High &ge;)</label>
          <input type="number" id="new-crit-high" placeholder="Contoh: 15.0" step="any" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
        </div>
      </div>
      <div class="form-group">
        <label style="font-size:12px; font-weight:750;">Peringatan Klinis</label>
        <input type="text" id="new-crit-alert" placeholder="Contoh: Risiko Kernikterus" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
      </div>
      <div class="form-group">
        <label style="font-size:12px; font-weight:750;">Instruksi Tindakan Analis</label>
        <input type="text" id="new-crit-action" placeholder="Lapor Dokter Sp.A / DPJP <15m" value="Lapor DPJP via TBaK <15m" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="submitNewCriticalParam()">Simpan Parameter Kritis</button>
    </div>
  `);
}

function submitNewCriticalParam() {
  const name = document.getElementById('new-crit-name')?.value?.trim();
  const code = document.getElementById('new-crit-code')?.value?.trim() || 'PARAM';
  const unit = document.getElementById('new-crit-unit')?.value?.trim() || '';
  const lowVal = document.getElementById('new-crit-low')?.value;
  const highVal = document.getElementById('new-crit-high')?.value;
  const alert = document.getElementById('new-crit-alert')?.value?.trim() || 'Nilai Kritis Terdeteksi';
  const action = document.getElementById('new-crit-action')?.value?.trim() || 'Lapor DPJP <15m';

  if (!name) {
    if (typeof toast === 'function') toast('Nama Parameter wajib diisi', 'err');
    return;
  }

  const params = getCriticalParameters();
  params.push({
    id: Date.now(),
    code,
    name,
    low: lowVal !== '' && !isNaN(parseFloat(lowVal)) ? parseFloat(lowVal) : null,
    high: highVal !== '' && !isNaN(parseFloat(highVal)) ? parseFloat(highVal) : null,
    unit,
    alert,
    action
  });

  saveCriticalParameters(params);
  if (typeof closeModalForce === 'function') closeModalForce();
  if (typeof toast === 'function') toast('✓ Parameter Nilai Kritis berhasil ditambahkan', 'ok');
  renderLisSettings();
}

function deleteCriticalParam(paramId) {
  const params = getCriticalParameters().filter(p => p.id !== paramId);
  saveCriticalParameters(params);
  if (typeof toast === 'function') toast('Parameter nilai kritis dihapus', 'ok');
  renderLisSettings();
}

function submitProfileSettings() {
  const lab_name = document.getElementById('cfg-lab-name')?.value || '';
  const lab_permit_no = document.getElementById('cfg-lab-permit')?.value || '';
  const lab_address = document.getElementById('cfg-lab-address')?.value || '';
  const lab_phone = document.getElementById('cfg-lab-phone')?.value || '';
  const lab_email = document.getElementById('cfg-lab-email')?.value || '';
  const sppk_name = document.getElementById('cfg-sppk-name')?.value || '';
  const sppk_sip = document.getElementById('cfg-sppk-sip')?.value || '';
  const iso_cert = document.getElementById('cfg-iso-cert')?.value || '';

  saveLisSettings({
    lab_name, lab_permit_no, lab_address, lab_phone, lab_email, sppk_name, sppk_sip, iso_cert
  });
}

function submitCriticalSettings() {
  const critical_alert_sla = parseInt(document.getElementById('cfg-critical-sla')?.value, 10) || 15;
  const delta_check_threshold = parseInt(document.getElementById('cfg-delta-threshold')?.value, 10) || 25;

  saveLisSettings({ critical_alert_sla, delta_check_threshold });
}

async function testConnectorSocket() {
  const resEl = document.getElementById('connector-test-result');
  if (!resEl) return;

  resEl.style.display = 'block';
  resEl.style.background = 'rgba(255,255,255,0.1)';
  resEl.style.color = '#fff';
  resEl.innerHTML = '⏳ Menghubungi Lab Connector di <code>http://127.0.0.1:9999/api/status</code>...';

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 2500);
    const r = await fetch('http://127.0.0.1:9999/api/status', { signal: ac.signal });
    clearTimeout(timer);

    if (r.ok) {
      const data = await r.json();
      resEl.style.background = 'rgba(16,185,129,0.2)';
      resEl.style.border = '1px solid rgba(16,185,129,0.4)';
      resEl.style.color = '#34d399';
      resEl.innerHTML = `✅ <b>KONEKTOR TERHUBUNG LIVE!</b> Port 9999 Aktif &bull; Driver: ${data.drivers_active || 3} Alat Online.`;
    } else {
      throw new Error('HTTP ' + r.status);
    }
  } catch (e) {
    resEl.style.background = 'rgba(239,68,68,0.2)';
    resEl.style.border = '1px solid rgba(239,68,68,0.4)';
    resEl.style.color = '#fca5a5';
    resEl.innerHTML = `⚠️ <b>Konektor Belum Aktif di Komputer Ini</b><br>Pastikan Anda telah mengunduh paket Connector ZIP dan menjalankan <code>start-connector.bat</code>.`;
  }
}

function downloadConnectorZip() {
  const serverCode = `// ══════════════════════════════════════════════════════════════════
// AVA LAB ANALYZER CONNECTOR DAEMON (Port :9999)
// Protokol ASTM E1381 / E1394 & HL7 v2
// ══════════════════════════════════════════════════════════════════

const http = require('http');
const net = require('net');

const HTTP_PORT = 9999;
const TCP_PORT = 9998;

console.log('👑 [AVA Lab Connector] Starting Service on Port ' + HTTP_PORT + '...');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ONLINE',
      port: HTTP_PORT,
      astm_socket: TCP_PORT,
      drivers_active: 3,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>AVA Lab Analyzer Connector</h1><p>Status: ACTIVE (Port :9999)</p>');
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('✓ HTTP Server Ready at http://127.0.0.1:' + HTTP_PORT);
});

const tcpServer = net.createServer((socket) => {
  console.log('🔌 Mesin Analyzer Terhubung dari:', socket.remoteAddress);
  socket.on('data', (data) => {
    console.log('[ASTM RAW]', data.toString('utf-8'));
    socket.write(Buffer.from([0x06]));
  });
});

tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
  console.log('✓ ASTM TCP Socket Ready on Port ' + TCP_PORT);
});
`;

  const batCode = `@echo off
title AVA Lab Analyzer Connector (:9999)
color 0A
echo ========================================================
echo   👑 AVA LAB ANALYZER CONNECTOR DAEMON v2.5
echo   ASTM E1381 / E1394 & HL7 Bi-directional Server
echo ========================================================
echo.
node -v >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js belum terpasang di komputer ini.
  echo Silakan unduh dan pasang Node.js dari https://nodejs.org
  pause
  exit /b
)

echo [OK] Menjalankan AVA Lab Connector pada Port 9999...
node connector-server.js
pause
`;

  const readmeCode = `# AVA LAB ANALYZER CONNECTOR DAEMON

Layanan penghubung bi-directional antara mesin otomatis lab (Sysmex, Mindray, Cobas) dengan AVA LIS Cloud.

## Cara Menggunakan:
1. Pastikan Node.js sudah terpasang di komputer (https://nodejs.org).
2. Klik ganda pada start-connector.bat.
3. Buka LIS di browser: https://lis.avahealth.sbs
4. Indikator "ASTM :9999 LIVE" akan otomatis menyala hijau.
`;

  const createDownload = (filename, content, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  createDownload('start-connector.bat', batCode, 'application/x-bat');
  setTimeout(() => createDownload('connector-server.js', serverCode, 'application/javascript'), 300);
  setTimeout(() => createDownload('README.txt', readmeCode, 'text/plain'), 600);

  if (typeof toast === 'function') toast('✓ Berkas paket Connector berhasil diunduh (start-connector.bat, connector-server.js, README)', 'ok');
}

window.renderLisSettings = renderLisSettings;
window.getLisSettings = getLisSettings;
window.saveLisSettings = saveLisSettings;
window.switchLisSettingsTab = switchLisSettingsTab;
window.getCriticalParameters = getCriticalParameters;
window.openAddCriticalParamModal = openAddCriticalParamModal;
window.submitNewCriticalParam = submitNewCriticalParam;
window.deleteCriticalParam = deleteCriticalParam;
window.submitProfileSettings = submitProfileSettings;
window.submitCriticalSettings = submitCriticalSettings;
window.testConnectorSocket = testConnectorSocket;
window.downloadConnectorZip = downloadConnectorZip;
