// ═══════════════════════════════════════════════════════════════
// MODULE: LOGBOOK PELAPORAN NILAI KRITIS (CRITICAL VALUE NOTIFICATION)
// Standar Akreditasi KARS / ISO 15189:2022 (SLA Wajib Lapor ≤ 15 Menit)
// ═══════════════════════════════════════════════════════════════

const CRITICAL_THRESHOLDS = {
  GLUCOSE: { param: 'Glukosa Darah', low: 45, high: 450, unit: 'mg/dL' },
  POTASSIUM: { param: 'Kalium (K+)', low: 2.8, high: 6.2, unit: 'mmol/L' },
  SODIUM: { param: 'Natrium (Na+)', low: 120, high: 160, unit: 'mmol/L' },
  HEMOGLOBIN: { param: 'Hemoglobin', low: 7.0, high: 20.0, unit: 'g/dL' },
  PLATELET: { param: 'Trombosit', low: 20000, high: 1000000, unit: '/uL' },
  TROPONIN: { param: 'Troponin I / T', critical_positive: true, unit: 'ng/mL' }
};

let criticalLogs = [
  {
    id: 'CRIT-2026-001',
    accession_no: 'L260830-0001',
    patient_name: 'Tn. Budi Setiawan',
    parameter: 'Kalium (K+)',
    result_value: 6.8,
    unit: 'mmol/L',
    critical_type: 'CRITICAL_HIGH',
    reported_to_doctor: 'dr. Hendra Sp.PD',
    caller_analyst: 'Ahmad Fauzi, A.Md.AK',
    call_timestamp: '2026-08-30 09:42',
    sla_minutes: 8,
    read_back_confirmed: true,
    status: 'REPORTED_AND_CONFIRMED'
  }
];

/**
 * Deteksi apakah nilai pemeriksaan masuk kategori nilai kritis
 */
function checkCriticalValue(paramKey, value) {
  const cfg = CRITICAL_THRESHOLDS[paramKey.toUpperCase()];
  if (!cfg) return { is_critical: false };

  const num = parseFloat(value);
  if (isNaN(num)) return { is_critical: false };

  if (num <= cfg.low) {
    return {
      is_critical: true,
      param: cfg.param,
      value: num,
      type: 'CRITICAL_LOW',
      message: `🚨 NILAI KRITIS RENDAH: ${cfg.param} ${num} ${cfg.unit} (Batas Kritis ≤ ${cfg.low})`
    };
  }

  if (num >= cfg.high) {
    return {
      is_critical: true,
      param: cfg.param,
      value: num,
      type: 'CRITICAL_HIGH',
      message: `🚨 NILAI KRITIS TINGGI: ${cfg.param} ${num} ${cfg.unit} (Batas Kritis ≥ ${cfg.high})`
    };
  }

  return { is_critical: false };
}

/**
 * Catat Laporan Telepon Nilai Kritis (SLA ≤ 15 Menit)
 */
function recordCriticalValueLog(logData) {
  const {
    accession_no,
    patient_name,
    parameter,
    result_value,
    unit,
    critical_type = 'CRITICAL_HIGH',
    reported_to_doctor,
    caller_analyst = 'Analis Jaga',
    sla_minutes = 10,
    read_back_confirmed = true
  } = logData;

  const newLog = {
    id: `CRIT-${new Date().getFullYear()}-${String(criticalLogs.length + 1).padStart(3, '0')}`,
    accession_no,
    patient_name,
    parameter,
    result_value,
    unit,
    critical_type,
    reported_to_doctor,
    caller_analyst,
    call_timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
    sla_minutes: Number(sla_minutes),
    read_back_confirmed: Boolean(read_back_confirmed),
    status: Number(sla_minutes) <= 15 ? 'REPORTED_ON_TIME' : 'REPORTED_DELAYED_BREACH'
  };

  criticalLogs.unshift(newLog);

  return {
    success: true,
    log: newLog,
    is_sla_met: newLog.sla_minutes <= 15,
    message: `Laporan nilai kritis ${parameter} (${result_value} ${unit}) kepada ${reported_to_doctor} berhasil dicatat.`
  };
}

async function renderCriticalValue() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#ef4444; margin-bottom:6px;">
            🚨 STANDAR AKREDITASI ISO 15189 &bull; SLA LAPOR WAJIB &le; 15 MENIT
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Logbook Pelaporan Nilai Kritis (Critical Values)
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Pencatatan wajib lapor telepon ke DPJP, verifikasi teknik TBaK (Tulis, Baca Ulang, Konfirmasi) dan audit SLA waktu respons.
          </p>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Daftar Riwayat Pelaporan Nilai Kritis Pasien</h3>
        <table class="table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg2);">
              <th>ID Lapor</th>
              <th>Accession &amp; Pasien</th>
              <th>Parameter &amp; Hasil Kritis</th>
              <th>Dokter Penerima (DPJP)</th>
              <th>Analis Pelapor</th>
              <th>Waktu Lapor</th>
              <th>SLA Durasi</th>
              <th>Read-back</th>
            </tr>
          </thead>
          <tbody>
            ${criticalLogs.map(l => `
              <tr>
                <td style="font-family:monospace; font-weight:700; color:#ef4444;">${l.id}</td>
                <td><b>${l.patient_name}</b><div style="font-size:11px; color:var(--text3); font-family:monospace;">${l.accession_no}</div></td>
                <td><b style="color:#ef4444;">${l.parameter}: ${l.result_value} ${l.unit}</b></td>
                <td><b>${l.reported_to_doctor}</b></td>
                <td>${l.caller_analyst}</td>
                <td style="font-family:monospace;">${l.call_timestamp}</td>
                <td><span class="badge ${l.sla_minutes <= 15 ? 'badge-success' : 'badge-danger'}">${l.sla_minutes} Menit</span></td>
                <td><span style="color:#10b981; font-weight:700;">✓ TBaK Terkonfirmasi</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderCriticalValue = renderCriticalValue;
  window.checkCriticalValue = checkCriticalValue;
  window.recordCriticalValueLog = recordCriticalValueLog;
  window.CRITICAL_THRESHOLDS = CRITICAL_THRESHOLDS;
  window.criticalLogs = criticalLogs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderCriticalValue,
    checkCriticalValue,
    recordCriticalValueLog,
    CRITICAL_THRESHOLDS,
    criticalLogs
  };
}
