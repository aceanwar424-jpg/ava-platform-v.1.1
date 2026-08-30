// ═══════════════════════════════════════════════════════════════
// MODULE: TELEMETRI & MONITORING KESEHATAN KLIEN SAAS
// Standar Operasional B2B — Pemantauan Real-Time Kesehatan Faskes Mitra
// ═══════════════════════════════════════════════════════════════

let clientTelemetryNodes = [
  {
    client_id: 'CLI-001',
    name: 'Klinik Utama Sehat Sentosa',
    location: 'Surabaya, Jawa Timur',
    ip_endpoint: '103.144.20.12',
    app_version: 'v5.1.2',
    last_heartbeat: '2026-08-30 11:45',
    latency_ms: 24,
    db_size_mb: 480,
    daily_transactions: 142,
    status: 'HEALTHY'
  },
  {
    client_id: 'CLI-002',
    name: 'Laboratorium Diagnostika Prima',
    location: 'Medan, Sumatera Utara',
    ip_endpoint: '103.144.20.55',
    app_version: 'v5.1.0',
    last_heartbeat: '2026-08-30 11:44',
    latency_ms: 38,
    db_size_mb: 1250,
    daily_transactions: 310,
    status: 'HEALTHY'
  }
];

/**
 * Catat heartbeat telemetri dari mesin faskes klien
 */
function recordClientHeartbeat(telemetryPayload) {
  const {
    client_id,
    name,
    app_version = 'v5.1.2',
    latency_ms = 30,
    db_size_mb = 100,
    daily_transactions = 0
  } = telemetryPayload;

  if (!client_id) throw new Error('Client ID wajib diisi.');

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  let node = clientTelemetryNodes.find(n => n.client_id === client_id);

  if (node) {
    node.last_heartbeat = now;
    node.latency_ms = latency_ms;
    node.db_size_mb = db_size_mb;
    node.daily_transactions = daily_transactions;
    node.status = latency_ms > 200 ? 'DEGRADED_LATENCY' : 'HEALTHY';
  } else {
    node = {
      client_id,
      name: name || `Faskes Klien ${client_id}`,
      location: 'Indonesia',
      ip_endpoint: '127.0.0.1',
      app_version,
      last_heartbeat: now,
      latency_ms,
      db_size_mb,
      daily_transactions,
      status: 'HEALTHY'
    };
    clientTelemetryNodes.unshift(node);
  }

  return {
    success: true,
    node,
    message: `Heartbeat dari ${node.name} berhasil diperbarui (${latency_ms}ms).`
  };
}

async function renderTechTelemetry() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#10b981; margin-bottom:6px;">
            📡 TELEMETRI INSTALASI &bull; MONITORING MESIN KLIEN B2B
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Telemetri &amp; Pemantauan Klien Faskes
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Pemantauan detak jantung (*heartbeat*), latensi jaringan, versi sistem, dan utilisasi database instalasi klien faskes luar.
          </p>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Status Jaringan Klien Faskes Aktif</h3>
        <table class="table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg2);">
              <th>Client ID</th>
              <th>Nama Faskes</th>
              <th>Versi Terpasang</th>
              <th>Latensi</th>
              <th>Ukuran Database</th>
              <th>Transaksi Hari Ini</th>
              <th>Heartbeat Terakhir</th>
              <th>Status Mesin</th>
            </tr>
          </thead>
          <tbody>
            ${clientTelemetryNodes.map(n => `
              <tr>
                <td style="font-family:monospace; font-weight:700; color:var(--sky);">${n.client_id}</td>
                <td><b>${n.name}</b><div style="font-size:11px; color:var(--text3);">${n.location}</div></td>
                <td><span class="badge" style="background:#334155; color:#fff;">${n.app_version}</span></td>
                <td><b style="color:${n.latency_ms < 50 ? '#10b981' : '#f59e0b'};">${n.latency_ms} ms</b></td>
                <td>${n.db_size_mb} MB</td>
                <td><b>${n.daily_transactions} order</b></td>
                <td style="font-family:monospace;">${n.last_heartbeat}</td>
                <td><span class="badge badge-success">✓ ONLINE (${n.status})</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderTechTelemetry = renderTechTelemetry;
  window.recordClientHeartbeat = recordClientHeartbeat;
  window.clientTelemetryNodes = clientTelemetryNodes;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderTechTelemetry,
    recordClientHeartbeat,
    clientTelemetryNodes
  };
}
