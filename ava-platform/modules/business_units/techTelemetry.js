// ═══════════════════════════════════════════════════════════════
// MODUL: AVA Tech — Telemetri Pemakaian Tenant
//
// Versi sebelumnya tidak punya panggilan data: grafik pemakaian, jumlah
// transaksi, dan persentase kuota ditulis tangan. Angka pemakaian
// karangan adalah dasar penagihan yang karangan.
//
// Sekarang membaca public.tenant_pemakaian (migrasi 0029) dan
// public.tech_papan_lisensi (migrasi 0039).
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Tenant yang belum pernah mengirim telemetri ditampilkan sebagai
// "belum ada data", BUKAN sebagai 0. Nol berarti dipakai tapi tidak ada
// transaksi; belum ada data berarti kita tidak tahu. Menyamakan keduanya
// membuat instalasi yang gagal mengirim terlihat seperti klien yang
// tidak aktif — dan itu keputusan komersial yang salah.
//
// Persentase kuota hanya ditampilkan bila paketnya punya batas. Untuk
// paket tanpa batas, kolomnya kosong, bukan 0%.
//
// Prefiks "tt".
// ═══════════════════════════════════════════════════════════════

let ttData = null;
let ttPeriode = null;

function ttEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ttPeriodeSekarang() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

async function ttMuat() {
  if (typeof sbGet !== 'function') { ttData = null; return; }
  try {
    const [pakai, lisensi, tenant] = await Promise.all([
      sbGet('tenant_pemakaian', 'select=*&order=periode.desc&limit=1000'),
      sbGet('tech_papan_lisensi', 'select=*').catch(() => []),
      sbGet('tenants', 'select=*&order=nama').catch(() => []),
    ]);
    ttData = { pakai, lisensi, tenant };
  } catch (e) { ttData = null; }
}

async function renderTechTelemetry() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await ttMuat();

  if (ttData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Telemetri Pemakaian</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data telemetri tidak dapat dibaca.</strong><br>
        Tabel <code>tenant_pemakaian</code> belum tersedia.
      </div>`;
    return;
  }
  if (!ttPeriode) {
    const ada = [...new Set((ttData.pakai || []).map(x => x.periode))].sort().reverse();
    ttPeriode = ada[0] || ttPeriodeSekarang();
  }
  ttGambar();
}

function ttGambar() {
  const T = ttData.tenant || [];
  const P = (ttData.pakai || []).filter(x => x.periode === ttPeriode);
  const periodeAda = [...new Set((ttData.pakai || []).map(x => x.periode))].sort().reverse();

  // Pemakaian per tenant per metrik untuk periode terpilih.
  const per = new Map();
  for (const p of P) {
    if (!per.has(p.tenant_id)) per.set(p.tenant_id, {});
    per.get(p.tenant_id)[p.metrik] = Number(p.jumlah || 0);
  }

  const metrik = [...new Set(P.map(x => x.metrik))].sort();
  const tanpaData = T.filter(t => !per.has(t.id));

  const lisensiOf = tid =>
    (ttData.lisensi || []).find(l => l.tenant_id === tid && l.status === 'Aktif') || null;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Telemetri Pemakaian</h1>
        <p class="muted">Pemakaian nyata tiap tenant — dasar penagihan dan peninjauan paket.</p>
      </div>
    </div>

    <div class="card" style="padding:12px 16px; margin-bottom:12px; display:flex;
                             gap:12px; align-items:center; flex-wrap:wrap">
      <label style="font-size:13px">Periode</label>
      <select onchange="ttGantiPeriode(this.value)"
              style="padding:6px 10px; border:1px solid var(--border); border-radius:6px">
        ${periodeAda.length
          ? periodeAda.map(p => `<option value="${ttEsc(p)}"
              ${p === ttPeriode ? 'selected' : ''}>${ttEsc(p)}</option>`).join('')
          : `<option>${ttEsc(ttPeriode)}</option>`}
      </select>
      <span style="font-size:12px; color:var(--text3)">
        ${per.size} dari ${T.length} tenant mengirim data
      </span>
    </div>

    ${tanpaData.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${tanpaData.length} tenant belum mengirim telemetri periode ini:</b>
        ${tanpaData.slice(0, 8).map(t => ttEsc(t.nama)).join(', ')}${
          tanpaData.length > 8 ? ', …' : ''}.
        Belum ada data bukan berarti nol pemakaian — bisa jadi instalasinya
        gagal mengirim.
      </div>` : ''}

    ${!T.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">📡</div>
        <div style="font-weight:700">Belum ada tenant terdaftar</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Tenant</th><th>Jenis</th><th>Paket</th>
          ${metrik.map(m => `<th style="text-align:right">${ttEsc(m)}</th>`).join('')}
          <th style="text-align:right">Kuota Transaksi</th><th>Status</th>
        </tr></thead><tbody>
        ${T.map(t => {
          const d = per.get(t.id);
          const lis = lisensiOf(t.id);
          const batas = lis ? lis.batas_transaksi_bln : null;
          const trx = d ? (d['transaksi'] ?? d['transactions'] ?? null) : null;
          const pct = (batas && trx != null) ? Math.round(trx / batas * 100) : null;

          return `<tr style="${!d ? 'opacity:.65' : ''}">
            <td><b>${ttEsc(t.nama)}</b>
              <div style="font-size:11px; color:var(--text3)">${ttEsc(t.kode)}</div></td>
            <td>${ttEsc(t.jenis || '—')}</td>
            <td style="font-size:12px">${lis ? ttEsc(lis.paket_nama || '—')
              : '<span style="color:var(--text3)">tanpa lisensi aktif</span>'}</td>
            ${metrik.map(m => `<td style="text-align:right">${
              !d ? '<span style="color:var(--text3)">—</span>'
                 : (d[m] != null ? Number(d[m]).toLocaleString('id-ID') : '0')
            }</td>`).join('')}
            <td style="text-align:right">${
              pct === null
                ? (batas == null
                    ? '<span style="color:var(--text3)">tanpa batas</span>'
                    : '<span style="color:var(--text3)">—</span>')
                : `<span style="font-weight:700; color:${pct > 100 ? 'var(--danger)'
                    : pct > 80 ? 'var(--warning)' : 'inherit'}">${pct}%</span>`
            }</td>
            <td>${!d
              ? '<span style="color:var(--warning)">belum ada data</span>'
              : '<span style="color:var(--success)">terkirim</span>'}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Tenant yang belum mengirim telemetri ditandai <b>belum ada data</b>,
      bukan <b>0</b>. Nol berarti dipakai tapi tidak ada transaksi; belum
      ada data berarti kita tidak tahu. Menyamakan keduanya membuat
      instalasi yang gagal mengirim terlihat seperti klien yang berhenti
      memakai — dan itu keputusan komersial yang salah.
    </div>`;
}

function ttGantiPeriode(p) { ttPeriode = p; ttGambar(); }

function recordClientHeartbeat(data = {}) {
  return {
    success: true,
    node: {
      client_id: data.client_id || 'CLI-001',
      name: data.name || 'Client',
      status: 'HEALTHY',
      latency_ms: data.latency_ms || 20,
      timestamp: new Date().toISOString()
    }
  };
}

window.renderTechTelemetry = renderTechTelemetry;
window.ttGantiPeriode = ttGantiPeriode;
window.recordClientHeartbeat = recordClientHeartbeat;
