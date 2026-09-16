// AVA Tech control plane: satu tempat untuk status konfigurasi, tenant,
// kesehatan instalasi, dan jalur audit. Nilai yang tidak dapat dibaca selalu
// ditampilkan sebagai unknown; tidak pernah diubah menjadi sehat palsu.
function tcpEsc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function tcpRead(table, query) {
  try {
    const value = await sbGet(table, query);
    return { ok: true, value: Array.isArray(value) ? value : [] };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

async function renderTechControlPlane() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';
  const [tenants, heartbeats, audit] = await Promise.all([
    tcpRead('tenant_ringkasan', 'select=*&order=nama'),
    tcpRead('tech_client_heartbeats', 'select=*&order=last_seen.desc&limit=100'),
    tcpRead('activity_logs', 'select=*&order=created_at.desc&limit=20'),
  ]);
  const tenantCount = tenants.ok ? tenants.value.filter(t => t.kode !== 'lokal').length : null;
  const healthy = heartbeats.ok
    ? heartbeats.value.filter(h => h.status === 'HEALTHY').length : null;
  const unknown = [tenants, heartbeats, audit].filter(x => !x.ok).length;
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
    <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:13px;margin-bottom:16px">
      ${[
        ['Tenant klien', tenantCount == null ? '—' : tenantCount, tenants.ok ? 'data tenant terbaca' : 'unknown'],
        ['Heartbeat sehat', healthy == null ? '—' : healthy, heartbeats.ok ? 'instalasi melapor' : 'unknown'],
        ['Audit terbaru', audit.ok ? audit.value.length : '—', audit.ok ? 'event terakhir dimuat' : 'unknown'],
      ].map(([label, value, note]) => `<div class="card" style="padding:14px 16px">
        <div class="label">${label}</div><div style="font-size:25px;font-weight:800">${tcpEsc(value)}</div>
        <div class="mini">${tcpEsc(note)}</div></div>`).join('')}
    </div>
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
