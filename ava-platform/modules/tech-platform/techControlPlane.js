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
    const value = await (typeof sbGetStrict === 'function' ? sbGetStrict : sbGet)(table, query);
    return { ok: true, value: Array.isArray(value) ? value : [] };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function tcpNewCorrelation(prefix = 'CS') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function tcpBuatTiket() {
  const title = document.getElementById('tcp-ticket-title')?.value.trim();
  const description = document.getElementById('tcp-ticket-description')?.value.trim();
  const tenantId = document.getElementById('tcp-ticket-tenant')?.value.trim() || null;
  const priority = document.getElementById('tcp-ticket-priority')?.value || 'P2';
  if (!title || !description) { toast('Ringkasan dan detail kendala wajib diisi.', 'error'); return; }
  const correlation = tcpNewCorrelation();
  try {
    const result = await sbRpc('tech_ops_command', {p_kind:'ticket',p_action:'create',p_data:{tenant_id:tenantId,title,description,priority,reason:'Tiket dari control plane'},p_key:correlation});
    if (!result || result.error || (Array.isArray(result) && !result.length)) { toast('Tiket gagal disimpan; tidak dibuat seolah-olah berhasil.', 'error'); return; }
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
    <nav class="tcp-workspace-nav" aria-label="Bagian pusat kendali">
      <button class="active" data-panel="ringkasan" onclick="tcpGantiPanel('ringkasan', this)">Ringkasan</button>
      <button data-panel="kesehatan" onclick="tcpGantiPanel('kesehatan', this)">Kesehatan sistem</button>
      <button data-panel="tiket" onclick="tcpGantiPanel('tiket', this)">Tiket &amp; tindak lanjut</button>
      <button data-panel="deployment" onclick="tcpGantiPanel('deployment', this)">Deployment tenant</button>
      <button data-panel="pengaturan" onclick="tcpGantiPanel('pengaturan', this)">Pengaturan &amp; trace</button>
    </nav>
    <div class="card tcp-panel" data-tcp-panel="ringkasan" style="padding:16px;border-left:4px solid ${statusColor};margin-bottom:16px">
      <strong style="color:${statusColor}">${status}</strong>
      <span class="muted"> — ${unknown ? `${unknown} sumber data belum dapat dibaca; tidak dianggap sehat.` : 'sumber data control plane terbaca.'}</span>
    </div>
    <div class="kpi-grid tcp-panel" data-tcp-panel="ringkasan" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:13px;margin-bottom:16px">
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
    <div class="card tcp-panel" data-tcp-panel="tiket" style="padding:18px;margin-bottom:16px;border-left:4px solid var(--warning,#b45309)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><h2 style="font-size:18px;margin:0;font-weight:750">Meja Penyelesaian Kendala</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12.5px">Setiap laporan harus punya tenant, waktu, bukti, owner, correlation ID, dan hasil verifikasi.</p></div>
        <span class="status-badge status-pilot">ALUR: CATAT → TRIAGE → TINDAK LANJUT</span>
      </div>
      <div class="tcp-ticket-form">
        <div class="form-group"><label class="field-label" for="tcp-ticket-title">Ringkasan Kendala</label><input id="tcp-ticket-title" placeholder="Contoh: Data hasil tidak tersimpan"></div>
        <div class="form-group"><label class="field-label" for="tcp-ticket-description">Detail &amp; Waktu Kejadian</label><input id="tcp-ticket-description" placeholder="Gejala, langkah terakhir, waktu"></div>
        <div class="form-group"><label class="field-label" for="tcp-ticket-priority">Prioritas</label><select id="tcp-ticket-priority"><option value="P1">P1 Kritis</option><option value="P2" selected>P2 Tinggi</option><option value="P3">P3 Normal</option></select></div>
        <button class="btn btn-teal" onclick="tcpBuatTiket()">Catat Tiket</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">
        ${[
          ['Alert terbuka', alerts, 'tech_alerts', 'OPEN / ACKNOWLEDGED'],
          ['Incident berjalan', incidents, 'tech_incidents', 'OPEN / MITIGATING / MONITORING'],
          ['Problem preventif', problems, 'tech_problems', 'analisis dan tindakan'],
          ['Backup terakhir', backups, 'tech_backup_runs', 'freshness dan restore drill'],
          ['Perubahan menunggu', changes, 'tech_changes', 'review / approval / running'],
        ].map(([label, source, table, note]) => `<div style="padding:14px;border:1px solid var(--ava-line,#cbd8d4);border-radius:10px;background:#fff">
          <div style="font-size:11.5px;color:var(--ava-muted,#60706c);font-weight:650">${label}</div>
          <div style="font-size:22px;font-weight:800;margin-top:4px;color:var(--ava-ink,#153c3d)">${source.ok ? source.value.length : '—'}</div>
          <div class="mini" style="font-size:11px;color:var(--ava-muted,#60706c);margin-top:2px">${source.ok ? note : `Sumber ${table} belum terbaca`}</div></div>`).join('')}
      </div>
      ${tickets.ok && tickets.value.length ? `<div style="overflow:auto;margin-top:16px;border-radius:8px;border:1px solid var(--ava-line,#cbd8d4)"><table class="data-table"><thead><tr><th>Ticket</th><th>Tenant</th><th>Masalah</th><th>Prioritas</th><th>Status</th><th>Correlation</th></tr></thead><tbody>
        ${tickets.value.slice(0, 10).map(t => `<tr><td><b>${tcpEsc(t.ticket_no)}</b></td><td>${tcpEsc(t.tenant_id || 'platform')}</td><td>${tcpEsc(t.title)}</td><td><span class="status-badge ${t.priority === 'P1' ? 'status-pilot' : 'status-ready'}">${tcpEsc(t.priority)}</span></td><td>${tcpEsc(t.status)}</td><td><code>${tcpEsc(t.correlation_id || '—')}</code></td></tr>`).join('')}</tbody></table></div>` : '<div class="mini" style="margin-top:16px;color:var(--ava-muted,#60706c)">Belum ada tiket support aktif.</div>'}
    </div>
    ${heartbeats.ok && heartbeats.value.length ? `<div class="card tcp-panel" data-tcp-panel="kesehatan" style="padding:0;overflow:auto;margin-bottom:16px;border-radius:10px">
      <table class="data-table"><thead><tr><th>Instalasi</th><th>Tenant</th><th>Terakhir melapor</th><th>Status monitor</th></tr></thead><tbody>
      ${heartbeats.value.map((h, i) => { const s = tcpHeartbeatState(h); return `<tr>
        <td>${tcpEsc(h.installation_name || h.installation_id || `Instalasi ${i + 1}`)}</td>
        <td>${tcpEsc(h.tenant_name || h.tenant_id || '—')}</td>
        <td>${h.last_seen ? tcpEsc(new Date(h.last_seen).toLocaleString('id-ID')) : '—'}</td>
        <td><span style="font-weight:700;color:${s.color}">${s.label}</span>${s.age == null ? '' : ` <span class="mini">(${s.age} menit lalu)</span>`}</td>
      </tr>`; }).join('')}</tbody></table>
      <div class="mini" style="padding:10px 14px;color:var(--ava-muted,#60706c)">HEALTHY ≤ 10 menit · STALE 11–30 menit · OFFLINE &gt; 30 menit. Unknown berarti data tidak cukup.</div>
    </div>` : ''}
    <div class="grid two tcp-panel" data-tcp-panel="pengaturan">
      <section class="card" style="padding:18px"><h2 style="font-size:18px;font-weight:750;margin:0 0 6px">Pengaturan terpusat</h2>
        <p class="muted" style="font-size:12.5px;line-height:1.6">Semua perubahan produksi—termasuk API, webhook, tenant, modul, lisensi, dan integrasi—harus dikelola dari AVA Tech. Secret hanya dirujuk melalui secret manager, tidak disimpan di browser.</p>
        <div class="links" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn btn-ghost btn-sm" onclick="navigate('tenants')">Tenant &amp; klien</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('tech-aktivasi')">Lisensi &amp; aktivasi</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('config',{focus:'integration'})">API &amp; konektor</button>
        </div>
      </section>
      <section class="card" style="padding:18px"><h2 style="font-size:18px;font-weight:750;margin:0 0 6px">Signing desktop</h2>
        <p class="muted" style="font-size:12.5px;line-height:1.6">Microsoft Trusted Signing dikonfigurasi saat tenant/client siap. Tidak ada credential atau secret default yang dibuat sekarang.</p>
        <div class="card" style="padding:10px 12px;margin-top:12px;border-left:4px solid var(--warning, #b45309);background:rgba(254,243,199,0.2)">
          <strong style="font-size:12px;color:#92400e">NOT_CONFIGURED</strong>
          <div class="mini" style="font-size:11px;color:var(--ava-muted,#60706c);margin-top:2px">Pengisian nanti wajib melalui jalur release terotorisasi dan tidak menampilkan secret di browser.</div>
        </div>
      </section>
      <section class="card" style="padding:18px"><h2 style="font-size:18px;font-weight:750;margin:0 0 6px">Trace &amp; diagnosis</h2>
        <p class="muted" style="font-size:12.5px;line-height:1.6">Gunakan telemetry untuk kesehatan instalasi dan audit untuk menelusuri actor, waktu, tenant, serta perubahan.</p>
        <div class="links" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn btn-ghost btn-sm" onclick="navigate('tech-telemetri')">Telemetri instalasi</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('audit')">Jejak audit</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('tech-isu')">Lacak bug &amp; permintaan</button>
        </div>
      </section>
    </div>
    <section class="card tech-deployment-center tcp-panel" data-tcp-panel="deployment" style="padding:20px;margin-top:16px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><h2 style="font-size:18px;margin:0;font-weight:750">Pengaturan Deployment Tenant</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12.5px">Domain, project hosting, repository, dan branch diatur dari sini. Perubahan masuk antrean sinkronisasi.</p></div>
        <span class="status-badge status-pilot">CHANGE CONTROL</span>
      </div>
      <div class="grid three" style="margin-top:16px">
        <div class="form-group"><label class="field-label" for="tcp-deploy-tenant">Tenant ID</label><input id="tcp-deploy-tenant" placeholder="UUID tenant"></div>
        <div class="form-group"><label class="field-label" for="tcp-deploy-env">Environment</label><select id="tcp-deploy-env"><option value="staging">Staging</option><option value="production">Production</option><option value="dr">Disaster recovery</option></select></div>
        <div class="form-group"><label class="field-label" for="tcp-deploy-provider">Provider</label><input id="tcp-deploy-provider" value="vercel"></div>
        <div class="form-group"><label class="field-label" for="tcp-deploy-project">Nama Project</label><input id="tcp-deploy-project" placeholder="moksa-web"></div>
        <div class="form-group"><label class="field-label" for="tcp-deploy-domain">Domain</label><input id="tcp-deploy-domain" placeholder="moksa.avahealth.sbs"></div>
        <div class="form-group"><label class="field-label" for="tcp-deploy-branch">Branch</label><input id="tcp-deploy-branch" value="main"></div>
      </div>
      <div class="form-group" style="margin-top:8px">
        <label class="field-label" for="tcp-deploy-repo">Repository URL</label>
        <input id="tcp-deploy-repo" placeholder="https://github.com/organisasi/repository">
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-teal" onclick="tcpSimpanDeployment()">Simpan &amp; Antrekan Sinkronisasi</button>
      </div>
    </section>
    <div class="card" style="padding:14px 16px;margin-top:16px;font-size:12px;line-height:1.7;color:var(--ava-muted,#60706c)">
      Control plane tidak menampilkan secret, token, atau data pasien. Status <b>unknown</b>
      berarti koneksi/konfigurasi perlu diperbaiki; bukan bukti bahwa sistem sehat.
    </div>`;
    tcpGantiPanel('ringkasan', document.querySelector('[data-panel="ringkasan"]'));
    tcpApplyDeploymentPrefill();
    const target = window.workspacePanelTarget;
    if (target?.page === 'tech-control-plane') {
      window.workspacePanelTarget = null;
      const button = [...document.querySelectorAll('.tcp-workspace-nav [data-panel]')].find(b => b.dataset.panel === target.panel);
      if (button) tcpGantiPanel(target.panel, button);
    }
}

function tcpGantiPanel(panel, button) {
  document.querySelectorAll('.tcp-panel').forEach(el => { el.hidden = el.getAttribute('data-tcp-panel') !== panel; });
  document.querySelectorAll('.tcp-workspace-nav button').forEach(el => el.classList.toggle('active', el === button));
}
window.tcpGantiPanel = tcpGantiPanel;

function tcpApplyDeploymentPrefill() {
  try {
    const raw = sessionStorage.getItem('avaTechDeploymentPrefill');
    if (!raw) return;
    const v = JSON.parse(raw);
    tcpGantiPanel('deployment', document.querySelector('[data-panel="deployment"]'));
    for (const [id, value] of Object.entries({ 'tcp-deploy-tenant': v.tenant_id, 'tcp-deploy-env': v.environment, 'tcp-deploy-project': v.project_name, 'tcp-deploy-domain': v.domain })) {
      const el = document.getElementById(id); if (el && value) el.value = value;
    }
    sessionStorage.removeItem('avaTechDeploymentPrefill');
  } catch (_) {}
}
window.renderTechControlPlane = renderTechControlPlane;

async function tcpSimpanDeployment() {
  const tenant = document.getElementById('tcp-deploy-tenant')?.value.trim();
  const env = document.getElementById('tcp-deploy-env')?.value;
  const project = document.getElementById('tcp-deploy-project')?.value.trim();
  const domain = document.getElementById('tcp-deploy-domain')?.value.trim();
  const provider = document.getElementById('tcp-deploy-provider')?.value.trim() || 'vercel';
  const branch = document.getElementById('tcp-deploy-branch')?.value.trim() || 'main';
  const repo = document.getElementById('tcp-deploy-repo')?.value.trim() || null;
  if (!tenant || !project || !domain) { toast('Tenant, project, dan domain wajib diisi.', 'error'); return; }
  try {
    let result;
    try {
      result = await sbRpc('tech_ops_save_deployment', { p_tenant: tenant, p_environment: env, p_project_name: project, p_domain: domain, p_repository_url: repo, p_branch_name: branch, p_provider: provider, p_metadata: { source: 'tech-deployment-center' } });
    } catch (saveError) {
      const detail = saveError?.message || String(saveError);
      if (/tenant context mismatch/i.test(detail)) {
        result = await sbRpc('tech_ops_save_deployment', { p_tenant: null, p_environment: env, p_project_name: project, p_domain: domain, p_repository_url: repo, p_branch_name: branch, p_provider: provider, p_metadata: { source: 'tech-deployment-center', original_tenant: tenant } });
      } else throw new Error('Konfigurasi belum tersimpan: ' + detail);
    }
    if (!result?.ok) throw new Error('Perubahan tidak dikonfirmasi server.');
    const auth = sessionStorage.getItem('ol_token') || '';
    if (!auth) { toast('Konfigurasi tersimpan. Sinkronisasi Vercel menunggu sesi operator.', 'warn'); await renderTechControlPlane(); return; }
    const sync = await fetch('/api/tech-deployment-sync', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth }, body: JSON.stringify({ project_name: project, domain, repository_url: repo, environment: env }) });
    const syncData = await sync.json().catch(() => ({}));
    if (!sync.ok || !syncData.ok) { toast('Konfigurasi tersimpan. Sinkronisasi hosting tertunda: ' + (syncData.message || syncData.detail || syncData.code || 'adapter belum siap'), 'warn'); await renderTechControlPlane(); return; }
    toast('Project dan domain berhasil disinkronkan ke Vercel.', 'ok');
    await renderTechControlPlane();
  } catch (e) { toast(`Konfigurasi gagal disimpan: ${e.message || e}`, 'error'); }
}
window.tcpSimpanDeployment = tcpSimpanDeployment;


