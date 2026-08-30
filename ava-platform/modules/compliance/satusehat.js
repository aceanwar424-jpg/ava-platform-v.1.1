// ═══════════════════════════════════════════════════════════════
// MODULE: SATUSEHAT (Kemenkes RI)
//
// Menu "Satu Sehat" sebelumnya mati — action-nya string kosong dengan
// penanda soon:true — padahal gerbang, pencatatan jejak, dan converter
// FHIR-nya sudah ada. Layar ini membukanya.
//
// ── Yang JUJUR ditampilkan layar ini ─────────────────────────
// Kesiapan dibaca dari server, bukan diasumsikan. Selama kredensial belum
// diisi, layar ini menyatakan BELUM SIAP dan menolak mengirim apa pun.
// Integrasi versi lama melaporkan "SYNCED_TO_KEMENKES" tanpa mengirim
// apa-apa; layar ini dibuat justru supaya kebohongan seperti itu terlihat.
//
// Seluruh nama global diawali "ss" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let ssStatus = null;
let ssLog = [];

function ssIco(n, s = 16) {
  return (typeof icon === 'function') ? icon(n, s) : '';
}

async function renderSatuSehat() {
  if (typeof injectProShell === 'function') injectProShell();
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>${ssIco('landmark', 20)} SATUSEHAT</h1>
        <p style="color:var(--text3);font-size:13px">
          Pertukaran data kesehatan dengan Kemenkes RI melalui FHIR R4</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="ssUjiKoneksi()">${ssIco('activity', 14)} Uji Koneksi</button>
        <button class="btn btn-teal btn-sm" onclick="renderSatuSehat()">${ssIco('refresh-cw', 14)} Muat Ulang</button>
      </div>
    </div>
    <div id="ss-status"><div class="loading-row"><div class="spinner"></div></div></div>
    <div id="ss-log" style="margin-top:14px"></div>`;

  await Promise.all([ssMuatStatus(), ssMuatLog()]);
  ssPaintStatus();
  ssPaintLog();
}

async function ssMuatStatus() {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/satusehat/status`, { headers: { ...SB_HEADERS } });
    ssStatus = res.ok ? await res.json() : { siap: false, error: `HTTP ${res.status}` };
  } catch (e) {
    ssStatus = { siap: false, error: e.message || String(e) };
  }
}

async function ssMuatLog() {
  try {
    ssLog = await sbGet('satusehat_log',
      'select=id,resource_type,metode,jalur,status_http,berhasil,satusehat_id,galat,dikirim_at' +
      '&order=dikirim_at.desc&limit=50');
    if (!Array.isArray(ssLog)) ssLog = [];
  } catch (e) { ssLog = []; }
}

function ssPaintStatus() {
  const el = document.getElementById('ss-status');
  if (!el) return;
  const s = ssStatus || {};
  const siap = !!s.siap;

  const baris = (label, isi, ok) => `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)">
      <span style="color:var(--text3);font-size:12.5px">${label}</span>
      <span style="font-size:12.5px;font-weight:600;color:${ok === false ? 'var(--danger,#dc2626)' : 'var(--text1)'}">${isi}</span>
    </div>`;

  el.innerHTML = `
    <div class="card" style="padding:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="width:9px;height:9px;border-radius:50%;background:${siap ? '#10B981' : '#F59E0B'};
                     box-shadow:0 0 8px ${siap ? '#10B981' : '#F59E0B'}"></span>
        <strong style="font-size:15px">${siap ? 'Siap mengirim' : 'Belum siap'}</strong>
        <span class="badge" style="margin-left:auto">${(s.mode || '-').toUpperCase()}</span>
      </div>

      ${siap ? '' : `
      <div style="background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.35);
                  border-radius:10px;padding:11px 13px;margin-bottom:12px;font-size:12.5px;line-height:1.6">
        <strong>Kredensial belum lengkap.</strong> Isi <code>SATUSEHAT_CLIENT_ID</code>,
        <code>SATUSEHAT_CLIENT_SECRET</code>, dan <code>SATUSEHAT_ORG_ID</code> di
        <code>desktop-app/.env</code>, lalu jalankan ulang aplikasi.
        Client secret sengaja tidak pernah dikirim ke peramban, jadi tidak bisa diisi dari layar ini.
      </div>`}

      ${baris('Lingkungan', s.mode === 'prod' ? 'Produksi' : 'Sandbox (stg)')}
      ${baris('Alamat FHIR', s.fhirUrl || '-')}
      ${baris('Organization ID', s.orgId || 'belum diisi', !!s.orgId)}
      ${baris('Client ID', s.clientIdTerisi ? 'terisi' : 'belum diisi', !!s.clientIdTerisi)}
      ${baris('Client Secret', s.clientSecretTerisi ? 'terisi' : 'belum diisi', !!s.clientSecretTerisi)}
      ${baris('Token aktif', s.tokenAktif ? 'ya' : 'belum ada')}
      ${s.error ? baris('Galat', s.error, false) : ''}
    </div>`;
}

function ssPaintLog() {
  const el = document.getElementById('ss-log');
  if (!el) return;

  if (!ssLog.length) {
    el.innerHTML = `<div class="card" style="padding:22px;text-align:center;color:var(--text3);font-size:13px">
      Belum ada riwayat pengiriman.</div>`;
    return;
  }

  const gagal = ssLog.filter(r => !r.berhasil).length;
  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">
        <strong style="font-size:13.5px">Riwayat Pengiriman</strong>
        <span style="color:var(--text3);font-size:12px">50 terakhir</span>
        ${gagal ? `<span class="badge" style="margin-left:auto;background:rgba(220,38,38,.14);color:#f87171">${gagal} gagal</span>` : ''}
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="color:var(--text3);text-align:left">
            <th style="padding:9px 16px">Waktu</th><th>Resource</th><th>Metode</th>
            <th>HTTP</th><th>Hasil</th><th style="padding-right:16px">Keterangan</th>
          </tr></thead>
          <tbody>${ssLog.map(r => `
            <tr style="border-top:1px solid var(--line)">
              <td style="padding:9px 16px;white-space:nowrap">${r.dikirim_at ? new Date(r.dikirim_at).toLocaleString('id-ID') : '-'}</td>
              <td>${r.resource_type || '-'}</td>
              <td>${r.metode || '-'}</td>
              <td>${r.status_http || '-'}</td>
              <td style="color:${r.berhasil ? '#34D399' : '#f87171'};font-weight:600">
                ${r.berhasil ? 'berhasil' : 'gagal'}</td>
              <td style="padding-right:16px;color:var(--text3);max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  title="${(r.galat || r.satusehat_id || '').replace(/"/g, '&quot;')}">
                ${r.berhasil ? (r.satusehat_id || '') : (r.galat || '').slice(0, 90)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// Uji koneksi sungguhan: menukar token lalu membaca metadata. Tidak mengirim
// data pasien apa pun — aman dijalankan kapan saja.
async function ssUjiKoneksi() {
  if (!ssStatus || !ssStatus.siap) {
    if (typeof toast === 'function') toast('Kredensial belum lengkap — lengkapi dulu di .env', 'warn');
    return;
  }
  if (typeof toast === 'function') toast('Menghubungi SATUSEHAT...', 'info');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/satusehat`, {
      method: 'POST', headers: { ...SB_HEADERS },
      body: JSON.stringify({ metode: 'GET', jalur: `Organization/${ssStatus.orgId}` }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.resourceType) {
      if (typeof toast === 'function') toast(`Terhubung — Organization "${d.name || d.id}" terbaca`, 'ok');
    } else {
      if (typeof toast === 'function') toast(`Gagal: ${d.error || `HTTP ${res.status}`}`, 'err');
    }
  } catch (e) {
    if (typeof toast === 'function') toast('Gagal menghubungi gerbang: ' + (e.message || e), 'err');
  }
  await ssMuatStatus(); ssPaintStatus();
  await ssMuatLog();    ssPaintLog();
}

window.renderSatuSehat = renderSatuSehat;
window.ssUjiKoneksi = ssUjiKoneksi;
