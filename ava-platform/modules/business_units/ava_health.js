// ═══════════════════════════════════════════════════════════════
// MODULE: AVA HEALTH — TRUST LAYER & TELEHEALTH ECOSYSTEM (KBLI 86910)
// Orkestrator Hulu ke Hilir: Telekonsultasi Dokter, Pemantauan IoT/Wearables,
// Badge Kalibrasi AVA Verified, Alkes Marketplace, Caregiver & Corporate B2B.
// ═══════════════════════════════════════════════════════════════

let _avaTabActive = 'consult';
let _avaPortalActive = 'admin'; // admin | customer | doctor | vendor

const AVA_TABS = [
  { id: 'consult',     label: '🩺 Telekonsultasi Dokter', badge: 'Halodoc Style' },
  { id: 'devices',     label: '📟 Alat Medis & Wearables', badge: 'IoT Telemetri' },
  { id: 'calibration', label: '🛠️ Badge AVA Verified',    badge: 'Lab Kalibrasi' },
  { id: 'marketplace', label: '🏬 Marketplace Alkes',     badge: 'Vendor Portal' },
  { id: 'caregiver',   label: '👥 Caregiver & Keluarga', badge: 'Emergency Alert' },
  { id: 'corporate',   label: '🏢 Corporate Wellness',   badge: 'K-Anonymity' },
  { id: 'portals',     label: '🌐 Multi-Portal Switcher',badge: '3 Peran User' }
];

function renderAVAHealth(tab = 'consult') {
  const main = document.getElementById('main-content');
  if (!main) return;

  if (tab && AVA_TABS.some(t => t.id === tab)) _avaTabActive = tab;

  main.innerHTML = `
    <div style="min-height:85vh; background:#020617; color:var(--bg); padding:24px; font-family:'Plus Jakarta Sans', sans-serif;">
      <!-- AVA HEALTH HEADER -->
      <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px; backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:14px;">
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:50px; height:50px; border-radius:14px; background:linear-gradient(135deg, #10B981, #0EA5E9); display:flex; align-items:center; justify-content:center; color:var(--on-accent); font-size:24px; font-weight:800; shadow:0 10px 25px rgba(16,185,129,0.3);">
            🩺
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 style="margin:0; font-size:19px; font-weight:800; color:var(--bg);">AVA Health Ecosystem</h2>
              <span style="background:linear-gradient(90deg, #34D399, #38BDF8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; font-size:11px; font-weight:800; border:1px solid rgba(52,211,153,0.4); padding:2px 8px; border-radius:6px;">
                KBLI 86910 · TRUST & TELEHEALTH LAYER
              </span>
            </div>
            <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Orkestrator Telekonsultasi · Pemantauan Wearable IoT · Badge Kalibrasi Alkes · Marketplace & Caregiver Network</p>
          </div>
        </div>

        <!-- Telemetry Metrics Badge -->
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); padding:6px 12px; border-radius:10px; font-size:11px; color:var(--accent2); font-weight:700;">
            ● 24 Dokter Standby
          </div>
          <div style="background:rgba(14,165,233,0.12); border:1px solid rgba(14,165,233,0.25); padding:6px 12px; border-radius:10px; font-size:11px; color:var(--sky); font-weight:700;">
            📡 142 Alat IoT Terhubung
          </div>
          <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.25); padding:6px 12px; border-radius:10px; font-size:11px; color:#FBBF24; font-weight:700;">
            🛡️ 89 Alkes AVA Verified
          </div>
        </div>
      </div>

      <!-- TAB NAVIGATION -->
      <div style="display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom:20px; overflow-x:auto;">
        ${AVA_TABS.map(tab => `
          <button 
            onclick="switchAVATab('${tab.id}')"
            style="
              background:${_avaTabActive === tab.id ? 'rgba(16,185,129,0.18)' : 'rgba(30,41,59,0.5)'};
              color:${_avaTabActive === tab.id ? '#34D399' : '#94A3B8'};
              border:1px solid ${_avaTabActive === tab.id ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.06)'};
              padding:8px 16px; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s ease; whitespace:nowrap;
            "
          >
            <span>${tab.label}</span>
            <span style="background:${_avaTabActive === tab.id ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)'}; font-size:10px; padding:1px 6px; border-radius:4px; font-weight:600;">
              ${tab.badge}
            </span>
          </button>
        `).join('')}
      </div>

      <!-- TAB CONTENT CONTAINER -->
      <div id="ava-tab-content" style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:16px; min-height:500px; padding:20px;">
      </div>
    </div>
  `;

  renderActiveAVATabContent();
}

function switchAVATab(tabId) {
  _avaTabActive = tabId;
  renderAVAHealth(tabId);
}

function renderActiveAVATabContent() {
  const container = document.getElementById('ava-tab-content');
  if (!container) return;

  switch (_avaTabActive) {
    case 'consult':     renderAVAConsult(container);     break;
    case 'devices':     renderAVADevices(container);     break;
    case 'calibration': renderAVACalibration(container); break;
    case 'marketplace': renderAVAMarketplace(container); break;
    case 'caregiver':   renderAVACaregiver(container);   break;
    case 'corporate':   renderAVACorporate(container);   break;
    case 'portals':     renderAVAPortals(container);     break;
    default:            renderAVAConsult(container);
  }
}

// ── SUB-MODUL 1: TELEKONSULTASI DOKTER (HALODOC STYLE) ──────────────
function renderAVAConsult(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="background:rgba(30,41,59,0.8); border:1px solid rgba(52,211,153,0.3); border-radius:14px; padding:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--bg);">🩺 Konsol Telekonsultasi Dokter (Halodoc-Style)</h3>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">State Machine Konsultasi: Confirm → Complete → E-Resep → Rujukan Lab → Komisi Dokter.</p>
        </div>
        <button class="btn btn-teal btn-sm" onclick="avaStartConsultModal()">+ Sesi Konsultasi Baru</button>
      </div>

      <!-- Active Sessions & Waiting Queue -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong style="font-size:13px; color:var(--accent2);">🟢 Sesi Aktif Berjalan (3 Sesi)</strong>
            <span style="font-size:11px; background:rgba(52,211,153,0.15); color:var(--accent2); padding:2px 8px; border-radius:6px;">Live Chat & Video</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px;">
              <div style="display:flex; justify-content:space-between; font-size:12.5px; font-weight:700; color:var(--bg);">
                <span>Pasien: Bpk. Bambang S. (48 th)</span>
                <span style="color:var(--sky);">dr. Rizky Pratama, Sp.PD</span>
              </div>
              <p style="font-size:11.5px; color:var(--text4); margin:4px 0 8px 0;">Keluhan: Hasil tes HbA1c 8.2%, pusing & lemas harian.</p>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-ghost btn-sm" style="font-size:11px; padding:4px 8px;" onclick="toast('Buka Sesi Chat Medis','info')">💬 Chat & Video</button>
                <button class="btn btn-ghost btn-sm" style="font-size:11px; padding:4px 8px;" onclick="toast('Terbitkan E-Resep','ok')">💊 Buat E-Resep</button>
                <button class="btn btn-ghost btn-sm" style="font-size:11px; padding:4px 8px;" onclick="toast('Buat Rujukan Lab','info')">🧪 Rujukan Lab</button>
              </div>
            </div>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong style="font-size:13px; color:#FBBF24;">⏰ Antrian Pasien Menunggu (2 Pasien)</strong>
            <span style="font-size:11px; background:rgba(251,191,36,0.15); color:#FBBF24; padding:2px 8px; border-radius:6px;">Auto Assign</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px;">
              <div style="display:flex; justify-content:space-between; font-size:12.5px; font-weight:700; color:var(--bg);">
                <span>Ibu Siti Aminah (56 th)</span>
                <span style="color:#FBBF24;">Triase: PERHATIAN</span>
              </div>
              <p style="font-size:11.5px; color:var(--text4); margin:4px 0 8px 0;">Telemetri Tensimeter IoT: 155/95 mmHg (Hipertensi Gr 1)</p>
              <button class="btn btn-teal btn-sm" style="font-size:11px; padding:4px 10px; width:100%;" onclick="toast('Terima & Konfirmasi Konsultasi','ok')">✔ Terima Konsultasi</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── SUB-MODUL 2: PEMANTAUAN ALAT MEDIS & WEARABLES ─────────────────
function renderAVADevices(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="background:rgba(30,41,59,0.8); border:1px solid rgba(56,189,248,0.3); border-radius:14px; padding:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--bg);">📟 Telemetri Alat Medis Rumah & Wearable IoT</h3>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Normalisasi data smartwatch (Detak Jantung, SpO2, Tensi, Tidur) & pemicu Alert Emergency Perawat.</p>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="toast('Hubungkan Alat IoT Baru','info')">+ Hubungkan Alat IoT</button>
      </div>

      <!-- Real-time Device Cards -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(16,185,129,0.3); border-radius:14px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:13px; font-weight:800; color:var(--bg);">⌚ Smartwatch Pasien #102</span>
            <span style="font-size:10px; background:rgba(16,185,129,0.2); color:var(--accent2); padding:2px 6px; border-radius:4px;">Normal</span>
          </div>
          <div style="margin:14px 0; font-size:24px; font-weight:800; color:var(--sky);">
            78 <span style="font-size:12px; color:var(--text4); font-weight:400;">BPM (Detak Jantung)</span>
          </div>
          <div style="font-size:11.5px; color:var(--text4); display:flex; justify-content:space-between;">
            <span>SpO2: 98%</span>
            <span>Tidur: 7.2 Jam</span>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(239,68,68,0.4); border-radius:14px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:13px; font-weight:800; color:var(--bg);">🩺 Tensimeter Bluetooth Rumah</span>
            <span style="font-size:10px; background:rgba(239,68,68,0.2); color:var(--danger-tint); padding:2px 6px; border-radius:4px;">🚨 SEGERA (Alert Perawat)</span>
          </div>
          <div style="margin:14px 0; font-size:24px; font-weight:800; color:var(--danger-tint);">
            165/102 <span style="font-size:12px; color:var(--text4); font-weight:400;">mmHg</span>
          </div>
          <div style="font-size:11.5px; color:var(--text4); display:flex; justify-content:space-between; align-items:center;">
            <span>Bpk. Hendra S.</span>
            <button class="btn btn-ghost btn-sm" style="font-size:10px; color:var(--danger); border-color:var(--danger);" onclick="toast('Kirim Perawat Home Care ke Rumah Pasien','warn')">🚑 Kirim Nakes</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── SUB-MODUL 3: BADGE KALIBRASI AVA VERIFIED ──────────────────────
function renderAVACalibration(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="background:rgba(30,41,59,0.8); border:1px solid rgba(245,158,11,0.3); border-radius:14px; padding:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--bg);">🛠️ Sertifikasi & Badge Kalibrasi AVA Verified</h3>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Verifikasi sertifikat kalibrasi lab terakreditasi KAN/Kemenkes & penerbitan badge kepercayaan alkes.</p>
        </div>
        <button class="btn btn-teal btn-sm" onclick="toast('Input Sertifikat Kalibrasi Baru','info')">+ Input Sertifikat Kalibrasi</button>
      </div>

      <!-- Verified Devices List -->
      <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px;">
        <table style="width:100%; border-collapse:collapse; font-size:12.5px; color:var(--bg);">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:var(--text4); text-align:left;">
              <th style="padding:10px;">Nama Alat Medis</th>
              <th style="padding:10px;">Lab Kalibrasi</th>
              <th style="padding:10px;">No. Sertifikat</th>
              <th style="padding:10px;">Masa Berlaku</th>
              <th style="padding:10px;">Status Badge</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
              <td style="padding:10px; font-weight:700;">Centrifuge Lab Pro-5000</td>
              <td style="padding:10px;">Balai Kalibrasi Kemenkes RI</td>
              <td style="padding:10px; font-family:monospace;">KAL-2026-9901</td>
              <td style="padding:10px; color:var(--accent2);">s/d 14 Des 2026</td>
              <td style="padding:10px;"><span style="background:rgba(16,185,129,0.2); color:var(--accent2); padding:2px 8px; border-radius:6px; font-weight:700;">🛡️ AVA VERIFIED</span></td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
              <td style="padding:10px; font-weight:700;">Syringe Pump Clinic-X</td>
              <td style="padding:10px;">Lab Kalibrasi Medika Utama</td>
              <td style="padding:10px; font-family:monospace;">KAL-2025-4421</td>
              <td style="padding:10px; color:#FBBF24;">s/d 20 Sep 2026 (Segera)</td>
              <td style="padding:10px;"><span style="background:rgba(245,158,11,0.2); color:#FBBF24; padding:2px 8px; border-radius:6px; font-weight:700;">🛡️ AVA VERIFIED</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── SUB-MODUL 4: MARKETPLACE ALKES & VENDOR ────────────────────────
function renderAVAMarketplace(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="background:rgba(30,41,59,0.8); border:1px solid rgba(52,211,153,0.3); border-radius:14px; padding:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--bg);">🏬 Marketplace Alat Kesehatan & Vendor Portal</h3>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Etalase penyewaan/pembelian alkes ber-badge "AVA Verified" & verifikasi supplier resmi.</p>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="toast('Tambah Produk Alkes Baru','info')">+ Tambah Produk Alkes</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px;">
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px;">
          <span style="font-size:10px; background:rgba(16,185,129,0.2); color:var(--accent2); padding:2px 6px; border-radius:4px; font-weight:700;">🛡️ AVA VERIFIED</span>
          <h4 style="margin:8px 0 4px 0; color:var(--bg);">Konsentrasi Oksigen Medis 5L</h4>
          <p style="margin:0; font-size:12px; color:var(--text4);">Vendor: PT Medika Alkes Indonesia</p>
          <div style="margin:12px 0 8px 0; font-size:16px; font-weight:800; color:var(--sky);">Rp 350.000 <span style="font-size:11px; color:var(--text4); font-weight:400;">/ bulan (Sewa)</span></div>
          <button class="btn btn-teal btn-sm" style="width:100%; font-size:11px;" onclick="toast('Order Sewa Alkes Berhasil','ok')">🛒 Pesan Sekarang</button>
        </div>
      </div>
    </div>
  `;
}

// ── SUB-MODUL 5: CAREGIVER & NETWORK KELUARGA ──────────────────────
function renderAVACaregiver(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="background:rgba(30,41,59,0.8); border:1px solid rgba(168,85,247,0.3); border-radius:14px; padding:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--bg);">👥 Caregiver & Emergency Family Network</h3>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Akses pendampingan keluarga berbasis RLS scope-gated & pengiriman alert darurat otomatis.</p>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="toast('Tautkan Akun Pendamping/Keluarga','info')">+ Tautkan Pendamping</button>
      </div>

      <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px;">
        <strong style="font-size:13px; color:#C084FC;">Daftar Pendamping Pasien Terverifikasi</strong>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="background:rgba(30,41,59,0.6); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <span>Anak: <strong>Dewi Lestari</strong> (Izin: Baca Tensi & SpO2)</span>
            <button class="btn btn-ghost btn-sm" style="font-size:10px; color:var(--danger);" onclick="toast('Akses Pendamping Dicabut','warn')">Cabut Akses</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── SUB-MODUL 6: CORPORATE B2B WELLNESS ────────────────────────────
function renderAVACorporate(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="background:rgba(30,41,59,0.8); border:1px solid rgba(56,189,248,0.3); border-radius:14px; padding:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--bg);">🏢 Corporate B2B Wellness (K-Anonymity Engine)</h3>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Analitik agregat kesehatan karyawan perusahaan tanpa membuka identitas individu (Garansi Privasi ISO 27001).</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px;">
          <div style="font-size:12px; color:var(--text4);">Karyawan Berpartisipasi</div>
          <div style="font-size:24px; font-weight:800; color:var(--sky); margin:6px 0;">340 <span style="font-size:12px; font-weight:400; color:var(--accent2);">(85% Total)</span></div>
        </div>
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px;">
          <div style="font-size:12px; color:var(--text4);">Skor Wellness Perusahaan</div>
          <div style="font-size:24px; font-weight:800; color:var(--accent2); margin:6px 0;">82.4 <span style="font-size:12px; font-weight:400; color:var(--accent2);">/ 100</span></div>
        </div>
      </div>
    </div>
  `;
}

// ── SUB-MODUL 7: MULTI-PORTAL SWITCHER ──────────────────────────────
function renderAVAPortals(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="background:rgba(30,41,59,0.8); border:1px solid rgba(52,211,153,0.3); border-radius:14px; padding:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--bg);">🌐 Switcher Portal Khusus Peran User</h3>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text4);">Pilih tampilan portal khusus sesuai peran pengguna (Pasien, Dokter Telehealth, atau Vendor Alkes).</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="switchAVAPortalView('customer')">📱 Portal Pasien</button>
          <button class="btn btn-ghost btn-sm" onclick="switchAVAPortalView('doctor')">🩺 Portal Dokter</button>
          <button class="btn btn-ghost btn-sm" onclick="switchAVAPortalView('vendor')">🏬 Portal Vendor</button>
        </div>
      </div>

      <div id="ava-portal-view" style="background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:20px;">
      </div>
    </div>
  `;

  switchAVAPortalView(_avaPortalActive);
}

function switchAVAPortalView(portalRole) {
  _avaPortalActive = portalRole;
  const viewEl = document.getElementById('ava-portal-view');
  if (!viewEl) return;

  if (portalRole === 'customer') {
    viewEl.innerHTML = `
      <div style="color:var(--accent2); font-weight:800; font-size:15px; margin-bottom:12px;">📱 Portal Pasien & Pelanggan AVA Health</div>
      <p style="font-size:12.5px; color:var(--text4);">Antarmuka ramah pengguna untuk booking konsultasi dokter, cek grafik vital harian, sewa alkes, & kelola pendamping keluarga.</p>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn btn-teal btn-sm" onclick="avaStartConsultModal()">🩺 Booking Konsultasi Dokter</button>
        <button class="btn btn-ghost btn-sm" onclick="avaAddDeviceModal()">📊 Tambah Perangkat Wearable/IoT</button>
        <button class="btn btn-ghost btn-sm" onclick="avaAddCaregiverModal()">👥 Kelola Pendamping Keluarga</button>
      </div>
    `;
  } else if (portalRole === 'doctor') {
    viewEl.innerHTML = `
      <div style="color:var(--sky); font-weight:800; font-size:15px; margin-bottom:12px;">🩺 Portal Kerja Dokter Telehealth</div>
      <p style="font-size:12.5px; color:var(--text4);">Konsol khusus dokter untuk menerima antrian pasien online, meninjau grafik telemetri alat rumah, menerbitkan e-resep, & cek saldo fee.</p>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn btn-teal btn-sm" onclick="avaStartConsultModal()">💬 Sesi Konsultasi Baru</button>
        <button class="btn btn-ghost btn-sm" onclick="avaAddEPrescriptionModal('SESI-101')">💊 Terbitkan E-Resep</button>
        <button class="btn btn-ghost btn-sm" onclick="avaAddLabReferralModal('SESI-101')">🧪 Buat Rujukan Tes Lab</button>
      </div>
    `;
  } else {
    viewEl.innerHTML = `
      <div style="color:#FBBF24; font-weight:800; font-size:15px; margin-bottom:12px;">🏬 Portal Mitra Vendor & Lab Kalibrasi</div>
      <p style="font-size:12.5px; color:var(--text4);">Dashboard mitra untuk mengunggah katalog alkes, mendaftarkan nomor sertifikat kalibrasi, & mengklaim badge AVA Verified.</p>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn btn-teal btn-sm" onclick="avaAddCalibrationModal()">🛡️ Registrasi Sertifikat Kalibrasi</button>
        <button class="btn btn-ghost btn-sm" onclick="avaAddMarketplaceItemModal()">🏬 Upload Produk Alkes Baru</button>
      </div>
    `;
  }
}

// ── INTERACTIVE MODAL WINDOWS FOR ALL AVA HEALTH ACTIONS ─────────────
function avaStartConsultModal() {
  const modalId = 'modal-ava-consult';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  
  modal.innerHTML = `
    <div style="background:var(--text); border:1px solid rgba(52,211,153,0.4); border-radius:16px; padding:24px; width:100%; max-width:520px; color:var(--bg); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px; margin-bottom:18px;">
        <h3 style="margin:0; font-size:17px; font-weight:800; color:var(--accent2);">🩺 Buat Sesi Telekonsultasi Baru</h3>
        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text4); font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Nama Pasien *</label>
          <input type="text" id="ac-patient" placeholder="Contoh: Bpk. Bambang S." style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Dokter Spesialis Tujuan *</label>
          <select id="ac-doctor" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
            <option value="dr. Rizky Pratama, Sp.PD">dr. Rizky Pratama, Sp.PD (Penyakit Dalam)</option>
            <option value="dr. Amanda Putri, Sp.JP">dr. Amanda Putri, Sp.JP (Jantung & Pembuluh)</option>
            <option value="dr. Maya Sari, Sp.A">dr. Maya Sari, Sp.A (Kesehatan Anak)</option>
          </select>
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Keluhan Utama *</label>
          <textarea id="ac-complaint" rows="3" placeholder="Tuliskan keluhan atau gejala yang dirasakan..." style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none; resize:none;"></textarea>
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Tingkat Triase AI (Edukatif)</label>
          <select id="ac-triage" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
            <option value="normal">🟢 NORMAL (Konsultasi Rutin)</option>
            <option value="perhatian">🟡 PERHATIAN (Perlu Evaluasi Dokter)</option>
            <option value="segera">🔴 SEGERA (Butuh Tindakan Cepat)</option>
          </select>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:22px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('${modalId}').remove()">Batal</button>
        <button class="btn btn-teal btn-sm" onclick="avaSubmitConsult('${modalId}')">Mulai Konsultasi</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function avaSubmitConsult(modalId) {
  const patient = document.getElementById('ac-patient')?.value.trim();
  const doctor = document.getElementById('ac-doctor')?.value;
  const complaint = document.getElementById('ac-complaint')?.value.trim();
  const triage = document.getElementById('ac-triage')?.value;

  if (!patient || !complaint) {
    toast('Isi nama pasien dan keluhan utama', 'warn');
    return;
  }

  document.getElementById(modalId)?.remove();
  toast(`✅ Sesi konsultasi ${patient} bersama ${doctor} berhasil dibuat!`, 'ok');
  renderAVAHealth('consult');
}

function avaAddEPrescriptionModal(sessionId = 'SESI-101') {
  const modalId = 'modal-ava-prescription';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  modal.innerHTML = `
    <div style="background:var(--text); border:1px solid rgba(56,189,248,0.4); border-radius:16px; padding:24px; width:100%; max-width:500px; color:var(--bg); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px; margin-bottom:18px;">
        <h3 style="margin:0; font-size:17px; font-weight:800; color:var(--sky);">💊 Penerbitan E-Resep Digital</h3>
        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text4); font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Rincian Obat & Dosis *</label>
          <textarea id="ep-drugs" rows="3" placeholder="Contoh: Metformin 500mg (2x1 sesudah makan), Captopril 25mg (1x1 pagi)" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none; resize:none;"></textarea>
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Catatan Penggunaan Dokter</label>
          <input type="text" id="ep-notes" placeholder="Diminum teratur selama 30 hari" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:22px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('${modalId}').remove()">Batal</button>
        <button class="btn btn-teal btn-sm" onclick="document.getElementById('${modalId}').remove(); toast('✅ E-Resep Digital resmi diterbitkan & dikirim ke farmasi!','ok');">Terbitkan E-Resep</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function avaAddLabReferralModal(sessionId = 'SESI-101') {
  const modalId = 'modal-ava-referral';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  modal.innerHTML = `
    <div style="background:var(--text); border:1px solid rgba(245,158,11,0.4); border-radius:16px; padding:24px; width:100%; max-width:500px; color:var(--bg); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px; margin-bottom:18px;">
        <h3 style="margin:0; font-size:17px; font-weight:800; color:#FBBF24;">🧪 Surat Rujukan Pemeriksaan Lab</h3>
        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text4); font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Pilih Jenis Tes Laboratorium *</label>
          <select id="lr-test" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
            <option value="HbA1c & Diabetes Panel">HbA1c & Diabetes Panel</option>
            <option value="Profil Lipid Lengkap">Profil Lipid Lengkap (Kolesterol, HDL, LDL, Trigliserida)</option>
            <option value="Fungsi Ginjal (Ureum & Kreatinin)">Fungsi Ginjal (Ureum & Kreatinin)</option>
            <option value="Paket MCU Eksekutif">Paket MCU Eksekutif</option>
          </select>
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Diagnosa Kerja / Pengantar Dokter</label>
          <input type="text" id="lr-notes" placeholder="Evaluasi kontrol glikemik pasien rutin" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:22px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('${modalId}').remove()">Batal</button>
        <button class="btn btn-teal btn-sm" onclick="document.getElementById('${modalId}').remove(); toast('✅ Surat Rujukan Lab terbit & tersambung ke LIS AVA!','ok');">Terbitkan Rujukan Lab</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function avaAddDeviceModal() {
  const modalId = 'modal-ava-device';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  modal.innerHTML = `
    <div style="background:var(--text); border:1px solid rgba(56,189,248,0.4); border-radius:16px; padding:24px; width:100%; max-width:500px; color:var(--bg); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px; margin-bottom:18px;">
        <h3 style="margin:0; font-size:17px; font-weight:800; color:var(--sky);">📟 Registrasi Alat Medis / Wearable IoT</h3>
        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text4); font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Nama Perangkat *</label>
          <input type="text" id="dev-name" placeholder="Contoh: Smartwatch Health-Pro X" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Tipe Telemetri *</label>
          <select id="dev-type" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
            <option value="Heart Rate (BPM)">Heart Rate (Detak Jantung)</option>
            <option value="SpO2 (%)">SpO2 (Saturasi Oksigen)</option>
            <option value="Blood Pressure (mmHg)">Blood Pressure (Tensimeter Bluetooth)</option>
            <option value="Glukometer (mg/dL)">Glukometer (Gula Darah IoT)</option>
          </select>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:22px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('${modalId}').remove()">Batal</button>
        <button class="btn btn-teal btn-sm" onclick="document.getElementById('${modalId}').remove(); toast('✅ Perangkat IoT berhasil terhubung!','ok'); renderAVAHealth('devices');">Hubungkan Alat</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function avaAddCalibrationModal() {
  const modalId = 'modal-ava-calibration';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  modal.innerHTML = `
    <div style="background:var(--text); border:1px solid rgba(245,158,11,0.4); border-radius:16px; padding:24px; width:100%; max-width:500px; color:var(--bg); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px; margin-bottom:18px;">
        <h3 style="margin:0; font-size:17px; font-weight:800; color:#FBBF24;">🛡️ Registrasi Sertifikat Kalibrasi AVA Verified</h3>
        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text4); font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Nama Alat Medis *</label>
          <input type="text" id="cal-dev" placeholder="Contoh: Centrifuge Pro-5000" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">Nama Lab Kalibrasi Terakreditasi *</label>
          <input type="text" id="cal-lab" placeholder="Contoh: Balai Kalibrasi Kemenkes RI" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none;">
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; font-weight:700; color:var(--text4);">No. Sertifikat Kalibrasi *</label>
          <input type="text" id="cal-cert" placeholder="KAL-2026-XXXX" style="width:100%; padding:10px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--on-accent); outline:none; font-family:monospace;">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:22px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('${modalId}').remove()">Batal</button>
        <button class="btn btn-teal btn-sm" onclick="document.getElementById('${modalId}').remove(); toast('✅ Badge AVA Verified berhasil disetujui & terbit!','ok'); renderAVAHealth('calibration');">Terbitkan Badge</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function avaAddMarketplaceItemModal() {
  toast('Membuka Form Katalog Alkes Baru...', 'info');
}

function avaAddCaregiverModal() {
  toast('Membuka Form Tautan Pendamping Keluarga...', 'info');
}

window.renderAVAHealth = renderAVAHealth;
window.switchAVATab = switchAVATab;
window.switchAVAPortalView = switchAVAPortalView;
window.avaStartConsultModal = avaStartConsultModal;
window.avaSubmitConsult = avaSubmitConsult;
window.avaAddEPrescriptionModal = avaAddEPrescriptionModal;
window.avaAddLabReferralModal = avaAddLabReferralModal;
window.avaAddDeviceModal = avaAddDeviceModal;
window.avaAddCalibrationModal = avaAddCalibrationModal;

