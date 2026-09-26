// AVA Tech control plane: satu tempat untuk status konfigurasi, tenant,
// kesehatan instalasi, dan jalur audit. Nilai yang tidak dapat dibaca selalu
// ditampilkan sebagai unknown; tidak pernah diubah menjadi sehat palsu.
function tcpEsc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function tcpHeartbeatState(row, now = Date.now()) {
  if (!row || !row.last_seen) return { label: 'UNKNOWN', color: 'var(--text3)', age: null };
  const ms = now - new Date(row.last_seen).getTime();
  if (!Number.isFinite(ms) || ms < 0) return { label: 'UNKNOWN', color: 'var(--text3)', age: null };
  const minutes = Math.floor(ms / 60000);
  if (minutes <= 10 && row.status === 'HEALTHY') return { label: 'HEALTHY', color: 'var(--success-strong, #15803d)', age: minutes };
  if (minutes <= 30) return { label: 'STALE', color: 'var(--warn-deeper, #b45309)', age: minutes };
  return { label: 'OFFLINE', color: 'var(--danger-strong, #b91c1c)', age: minutes };
}

async function tcpRead(table, query) {
  try {
    const value = await sbGet(table, query);
    return { ok: true, value: Array.isArray(value) ? value : [] };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function tcpNewCorrelation(prefix = 'CS') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function tcpBuatTiket() {
  const title = prompt('Ringkasan kendala tenant:');
  if (!title || !title.trim()) return;
  const description = prompt('Detail gejala, langkah yang dilakukan, dan waktu kejadian:');
  if (!description || !description.trim()) return;
  const tenantId = prompt('ID tenant (kosongkan jika belum diketahui):', '') || null;
  const correlation = tcpNewCorrelation();
  try {
    const result = await sbPost('tech_support_tickets', {
      ticket_no: `CS-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`,
      tenant_id: tenantId, title: title.trim(), description: description.trim(),
      priority: 'P2', channel: 'internal', status: 'TRIAGED', correlation_id: correlation,
    });
    if (!result || result.error || (Array.isArray(result) && !result.length)) {
      toast('Tiket gagal disimpan; tidak dibuat seolah-olah berhasil.', 'error'); return;
    }
    toast(`Tiket tercatat dengan correlation ID ${correlation}`, 'ok');
    await renderTechControlPlane();
  } catch (e) { toast(`Tiket gagal disimpan: ${e.message || e}`, 'error'); }
}

window.tcpBuatTiket = tcpBuatTiket;

async function renderTechControlPlane() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';
  const [tenants, heartbeats, audit, alerts, incidents, problems, tickets, backups, changes] = await Promise.all([
    tcpRead('tenant_ringkasan', 'select=*&order=nama'),
    tcpRead('tech_client_heartbeats', 'select=*&order=last_seen.desc&limit=100'),
    tcpRead('activity_logs', 'select=*&order=created_at.desc&limit=20'),
    tcpRead('tech_alerts', 'select=*&status=in.(OPEN,ACKNOWLEDGED)&order=last_seen.desc&limit=20'),
    tcpRead('tech_incidents', 'select=*&status=in.(OPEN,MITIGATING,MONITORING)&order=detected_at.desc&limit=20'),
    tcpRead('tech_problems', 'select=*&status=neq.CLOSED&order=due_at.asc&limit=20'),
    tcpRead('tech_support_tickets', 'select=*&status=neq.CLOSED&order=created_at.desc&limit=20'),
    tcpRead('tech_backup_runs', 'select=*&order=finished_at.desc&limit=50'),
    tcpRead('tech_changes', 'select=*&status=in.(REVIEW,APPROVED,RUNNING)&order=created_at.desc&limit=20'),
  ]);
  const tenantCount = tenants.ok ? tenants.value.filter(t => t.kode !== 'lokal').length : null;
  const heartbeatStates = heartbeats.ok
    ? heartbeats.value.map(h => tcpHeartbeatState(h)) : [];
  const healthy = heartbeats.ok
    ? heartbeatStates.filter(h => h.label === 'HEALTHY').length : null;
  const stale = heartbeats.ok
    ? heartbeatStates.filter(h => h.label === 'STALE').length : null;
  const offline = heartbeats.ok
    ? heartbeatStates.filter(h => h.label === 'OFFLINE').length : null;
  const unknown = [tenants, heartbeats, audit, alerts, incidents, problems, tickets, backups, changes].filter(x => !x.ok).length;
  const status = unknown ? 'UNKNOWN' : 'OPERATIONAL';
  const statusColor = unknown ? 'var(--warning, #b45309)' : 'var(--success, #15803d)';

  main.innerHTML = `
    <div class="page-header">
      <div><p class="cat-eyebrow">AVA Tech / Control Plane</p>
        <h1>Kontrol Produksi &amp; Observabilitas</h1>
        <p class="muted">Konfigurasi, tenant, kesehatan instalasi, dan jejak perubahan dari satu pusat kendali.</p></div>
      <button class="btn btn-ghost btn-sm" onclick="renderTechControlPlane()">Periksa ulang</button>
    </div>
    <div class="card" style="padding:16px;border-left:4px solid ${statusColor};margin-bottom:16px">
      <strong style="color:${statusColor}">${status}</strong>
      <span class="muted"> — ${unknown ? `${unknown} sumber data belum dapat dibaca; tidak dianggap sehat.` : 'sumber data control plane terbaca.'}</span>
    </div>
    <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:13px;margin-bottom:16px">
      ${[
        ['Tenant klien', tenantCount == null ? '—' : tenantCount, tenants.ok ? 'data tenant terbaca' : 'unknown'],
        ['Heartbeat sehat', healthy == null ? '—' : healthy, heartbeats.ok ? `${stale} stale · ${offline} offline` : 'unknown'],
        ['Audit terbaru', audit.ok ? audit.value.length : '—', audit.ok ? 'event terakhir dimuat' : 'unknown'],
        ['Alert aktif', alerts.ok ? alerts.value.length : '—', alerts.ok ? 'perlu triage' : 'unknown'],
        ['Incident aktif', incidents.ok ? incidents.value.length : '—', incidents.ok ? 'dengan SLA berjalan' : 'unknown'],
        ['Tiket support', tickets.ok ? tickets.value.length : '—', tickets.ok ? 'belum ditutup' : 'unknown'],
      ].map(([label, value, note]) => `<div class="card" style="padding:14px 16px">
        <div class="label">${label}</div><div style="font-size:25px;font-weight:800">${tcpEsc(value)}</div>
        <div class="mini">${tcpEsc(note)}</div></div>`).join('')}
    </div>
    <div class="card" style="padding:16px;margin-bottom:16px;border-left:4px solid var(--warning,#b45309)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><h2 style="font-size:20px;margin:0">Meja penyelesaian kendala</h2>
          <p class="muted" style="margin:4px 0 0">Setiap laporan harus punya tenant, waktu, bukti, owner, correlation ID, dan hasil verifikasi.</p></div>
        <button class="btn btn-teal btn-sm" onclick="tcpBuatTiket()">+ Catat kendala dari CS</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:14px">
        ${[
          ['Alert terbuka', alerts, 'tech_alerts', 'OPEN / ACKNOWLEDGED'],
          ['Incident berjalan', incidents, 'tech_incidents', 'OPEN / MITIGATING / MONITORING'],
          ['Problem preventif', problems, 'tech_problems', 'analisis dan tindakan'],
          ['Backup terakhir', backups, 'tech_backup_runs', 'freshness dan restore drill'],
          ['Perubahan menunggu', changes, 'tech_changes', 'review / approval / running'],
        ].map(([label, source, table, note]) => `<div style="padding:12px;border:1px solid var(--border);border-radius:10px">
          <strong>${label}</strong><div style="font-size:22px;font-weight:800;margin-top:3px">${source.ok ? source.value.length : '—'}</div>
          <div class="mini">${source.ok ? note : `Sumber ${table} belum terbaca`}</div></div>`).join('')}
      </div>
      ${tickets.ok && tickets.value.length ? `<div style="overflow:auto;margin-top:14px"><table class="data-table"><thead><tr><th>Ticket</th><th>Tenant</th><th>Masalah</th><th>Prioritas</th><th>Status</th><th>Correlation</th></tr></thead><tbody>
        ${tickets.value.slice(0, 10).map(t => `<tr><td><b>${tcpEsc(t.ticket_no)}</b></td><td>${tcpEsc(t.tenant_id || 'platform')}</td><td>${tcpEsc(t.title)}</td><td>${tcpEsc(t.priority)}</td><td>${tcpEsc(t.status)}</td><td><code>${tcpEsc(t.correlation_id || '—')}</code></td></tr>`).join('')}</tbody></table></div>` : '<div class="mini" style="margin-top:14px">Belum ada tiket support aktif.</div>'}
    </div>
    ${heartbeats.ok && heartbeats.value.length ? `<div class="card" style="padding:0;overflow:auto;margin-bottom:16px">
      <table class="data-table"><thead><tr><th>Instalasi</th><th>Tenant</th><th>Terakhir melapor</th><th>Status monitor</th></tr></thead><tbody>
      ${heartbeats.value.map((h, i) => { const s = tcpHeartbeatState(h); return `<tr>
        <td>${tcpEsc(h.installation_name || h.installation_id || `Instalasi ${i + 1}`)}</td>
        <td>${tcpEsc(h.tenant_name || h.tenant_id || '—')}</td>
        <td>${h.last_seen ? tcpEsc(new Date(h.last_seen).toLocaleString('id-ID')) : '—'}</td>
        <td><span style="font-weight:700;color:${s.color}">${s.label}</span>${s.age == null ? '' : ` <span class="mini">(${s.age} menit lalu)</span>`}</td>
      </tr>`; }).join('')}</tbody></table>
      <div class="mini" style="padding:10px 14px">HEALTHY ≤ 10 menit · STALE 11–30 menit · OFFLINE &gt; 30 menit. Unknown berarti data tidak cukup.</div>
    </div>` : ''}
    <div class="grid two">
      <section class="card"><h2 style="font-size:22px">Pengaturan terpusat</h2>
        <p class="muted">Semua perubahan produksi—termasuk API, webhook, tenant, modul, lisensi, dan integrasi—harus dikelola dari AVA Tech. Secret hanya dirujuk melalui secret manager, tidak disimpan di browser.</p>
        <div class="links">
          <button class="btn btn-ghost btn-sm" onclick="navigate('tenants')">Tenant &amp; klien</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('tech-aktivasi')">Lisensi &amp; aktivasi</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('config',{focus:'integration'})">API &amp; konektor</button>
        </div>
      </section>
      <section class="card"><h2 style="font-size:22px">Signing desktop</h2>
        <p class="muted">Microsoft Trusted Signing dikonfigurasi saat tenant/client siap. Tidak ada credential atau secret default yang dibuat sekarang.</p>
        <div class="card" style="padding:10px 12px;margin-top:12px;border-left:4px solid var(--warning, #b45309)">
          <strong>NOT_CONFIGURED</strong>
          <div class="mini">Pengisian nanti wajib melalui jalur release terotorisasi dan tidak menampilkan secret di browser.</div>
        </div>
      </section>
      <section class="card"><h2 style="font-size:22px">Trace &amp; diagnosis</h2>
        <p class="muted">Gunakan telemetry untuk kesehatan instalasi dan audit untuk menelusuri actor, waktu, tenant, serta perubahan.</p>
        <div class="links">
          <button class="btn btn-ghost btn-sm" onclick="navigate('tech-telemetri')">Telemetri instalasi</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('audit')">Jejak audit</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('tech-isu')">Lacak bug &amp; permintaan</button>
        </div>
      </section>
    </div>
    <div class="card" style="padding:14px 16px;margin-top:16px;font-size:12px;line-height:1.7">
      Control plane tidak menampilkan secret, token, atau data pasien. Status <b>unknown</b>
      berarti koneksi/konfigurasi perlu diperbaiki; bukan bukti bahwa sistem sehat.
    </div>`;
}

window.renderTechControlPlane = renderTechControlPlane;
