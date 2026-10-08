// MODULE: AVA Tech & HealthTech SaaS Engine — PT AVA Health Solution
// Subdomain: tech.avahealth.sbs / #tech / #license-manager

// ── Pemeriksa nyata ─────────────────────────────────────────────
//
// Cockpit ini sebelumnya menyatakan "SATUSEHAT Bridge Active" dan
// "Port :9999 Ready" sebagai teks tetap, tanpa memeriksa apa pun. Pada layar
// yang dipakai memutuskan apakah sebuah integrasi sedang bermasalah, lampu
// hijau yang tidak pernah diperiksa lebih buruk daripada tidak ada lampu.
//
// Yang bisa diperiksa murah, diperiksa. Sisanya ditulis "belum diperiksa".
async function tsProbeConnector() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 2000);
  try {
    const r = await fetch('http://127.0.0.1:9999/api/status', { signal: ac.signal });
    return r.ok ? 'hidup' : 'menolak';
  } catch (e) { return 'mati'; }
  finally { clearTimeout(t); }
}

async function tsAmbilTenant() {
  try {
    const loader = typeof sbGetStrict === 'function' ? sbGetStrict : sbGet;
    const d = await loader('tenant_ringkasan', 'select=*');
    return Array.isArray(d) ? d : null;
  } catch (e) { return null; }
}

const tsRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const tsEsc = (x) => String(x == null ? '' : x)
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Current snapshot only: no invented time series or implied telemetry.
function tsTenantSummary(tenant) {
  if (tenant === null) return '<p class="tech-chart-empty" role="status">Data tenant belum dapat dimuat. Periksa koneksi lalu coba lagi.</p>';
  const rows = tenant.filter(t => t.kode !== 'lokal');
  if (!rows.length) return '<p class="tech-chart-empty">Belum ada tenant terdaftar. Ringkasan muncul setelah tenant tersedia.</p>';
  const groups = [
    {label:'Aktif', count:rows.filter(t=>t.is_active && !['kedaluwarsa','segera-berakhir'].includes(t.status_langganan)).length, color:'#087f6b'},
    {label:'Perlu perpanjangan', count:rows.filter(t=>['kedaluwarsa','segera-berakhir'].includes(t.status_langganan)).length, color:'#946200'},
    {label:'Nonaktif', count:rows.filter(t=>!t.is_active && !['kedaluwarsa','segera-berakhir'].includes(t.status_langganan)).length, color:'#64748b'}
  ];
  return '<p class="tech-chart-note">Jumlah tenant per status · total '+rows.length+' tenant · snapshot saat dimuat</p><ul class="tech-status-chart" aria-label="Jumlah tenant per status">'+groups.map(g=>'<li><span>'+g.label+'</span><span class="tech-bar-track" aria-hidden="true"><i style="width:'+g.count/rows.length*100+'%;background:'+g.color+'"></i></span><strong>'+g.count+' <small>tenant</small></strong></li>').join('')+'</ul>';
}

async function renderTechSaas(params = {}) {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  const [tenant, connector] = await Promise.all([tsAmbilTenant(), tsProbeConnector()]);

  const aiPool = (window.AIGateway && window.AIGateway.state && window.AIGateway.state.keyPool) || [];
  const kunciAktif = aiPool.filter((k) => k.status === 'ACTIVE').length;

  const klien = (tenant || []).filter((t) => t.kode !== 'lokal');
  const klienAktif = klien.filter((t) => t.is_active && t.status_langganan !== 'kedaluwarsa').length;
  const perluPerpanjang = klien.filter((t) =>
    ['kedaluwarsa', 'segera-berakhir'].indexOf(t.status_langganan) >= 0).length;
  const nilaiBerjalan = klien
    .filter((t) => t.status_langganan !== 'kedaluwarsa')
    .reduce((a, t) => a + Number(t.nilai_langganan || 0), 0);

  const kartu = (warna, label, nilai, ket) => {
    const ico = /klien|tenant/i.test(label) ? 'users' : /perpanjang/i.test(label) ? 'calendar' : /nilai|langganan/i.test(label) ? 'wallet' : /AI/i.test(label) ? 'key' : /connector|analyzer/i.test(label) ? 'activity' : /basis|database/i.test(label) ? 'database' : /SATUSEHAT/i.test(label) ? 'shield' : 'book';
    return '<div class="card metric-card" style="padding:12px 14px; border-radius:14px; box-shadow:0 4px 14px rgba(16,45,60,.05);">' +
      '<div style="display:flex;align-items:flex-start;gap:10px;"><span class="metric-icon" style="--metric-color:' + warna + '">' + (typeof icon === 'function' ? icon(ico, 19) : '') + '</span><div style="min-width:0"><div style="font-size:10px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:.05em;">' + label + '</div>' +
      '<div style="font-size:18px; font-weight:750; color:var(--text1,var(--ava-ink)); margin:5px 0 2px;">' + nilai + '</div>' +
      '<div style="font-size:11px; color:var(--text2);">' + ket + '</div></div></div></div>';
  };

  const petaConn = {
    hidup:   ['#10B981', 'Terhubung', 'ASTM E1381/E1394 di porta 9999'],
    menolak: ['#F59E0B', 'Menjawab, bermasalah', 'Layanan hidup tetapi menolak permintaan'],
    mati:    ['#94A3B8', 'Tidak berjalan', 'Nyalakan Lab Connector untuk menghubungkan analyzer'],
  };
  const sc = petaConn[connector];

  const kartuPenjualan = (tenant === null)
    ? '<div class="card" style="padding:16px 18px; grid-column:1/-1; font-size:12.5px; line-height:1.7;">' +
      '<strong>Data tenant tidak terbaca.</strong> View <code>tenant_ringkasan</code> belum ada — ' +
      'jalankan ulang aplikasi agar migrasi <code>0029</code> terpasang.</div>'
    : [
        kartu('#0EA5E9', 'Klien faskes aktif', klienAktif,
              klien.length ? ('dari ' + klien.length + ' tenant terdaftar') : 'belum ada klien terdaftar'),
        kartu(perluPerpanjang ? '#EF4444' : '#10B981', 'Perlu perpanjangan', perluPerpanjang,
              perluPerpanjang ? 'kedaluwarsa atau kurang dari 30 hari' : 'tidak ada yang mendesak'),
        kartu('#D4AF37', 'Nilai langganan berjalan', tsRp(nilaiBerjalan),
              'dari kontrak yang masih berlaku'),
      ].join('');

  const barisKlien = klien.slice(0, 8).map((t) =>
    '<tr style="border-top:1px solid var(--border);">' +
      '<td style="padding:10px 18px;">' +
        '<div style="font-weight:700;">' + tsEsc(t.nama) + '</div>' +
        '<div style="font-size:11px; color:var(--text3); font-family:monospace;">' +
          tsEsc(t.subdomain || t.kode) + '</div>' +
      '</td>' +
      '<td>' + tsEsc(t.paket || '—') + '</td>' +
      '<td><span class="badge" style="font-size:10.5px;">' + tsEsc(t.status_langganan) + '</span></td>' +
      '<td style="padding-right:18px;">' + tsRp(t.nilai_langganan) + '</td>' +
    '</tr>').join('');

  main.innerHTML =
    '<div class="tech-saas-dashboard" style="padding:16px; font-family:\'Plus Jakarta Sans\',sans-serif;">' +

      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:16px; background:linear-gradient(135deg, #102e30 0%, #153c3d 100%); padding:20px 24px; border-radius:14px; border:1px solid rgba(184,145,43,.3); box-shadow:0 8px 24px rgba(16,46,48,.12);">' +
        '<div>' +
          '<div style="display:inline-flex; align-items:center; gap:8px; background:rgba(8,127,107,0.25); border:1px solid rgba(142,224,193,0.3); padding:4px 12px; border-radius:999px; font-size:11px; font-weight:800; color:#8fe0c1; margin-bottom:10px;">' +
            '<span>&#128187;</span> PILAR 3 &bull; AVA TECH (tech.avahealth.sbs)</div>' +
          '<h1 style="font-size:22px; font-weight:780; color:#fff; margin:0 0 6px 0; letter-spacing:-0.02em;">Pembangun &amp; Penjual Sistem</h1>' +
          '<p style="font-size:12.5px; color:#d2e5df; margin:0; max-width:680px; line-height:1.55;">' +
            'Unit yang membangun platform ini dan melisensikannya ke faskes lain: mesin multi-tenant, ' +
            'interoperabilitas SATUSEHAT &amp; analyzer, katalog LOINC, serta pengelolaan langganan klien.</p>' +
        '</div>' +
        '<div class="tech-hero-callout" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:12px 14px;color:#fff"><strong style="color:#f4d98b">✦ Platform Siap Berkembang</strong><span style="color:#d2e5df">Kelola tenant, integrasi, dan operasional dalam satu dashboard terpusat.</span><button class="tech-callout-arrow" onclick="navigate(&#39;tech-control-plane&#39;)" aria-label="Buka pusat kendali operasi">→</button></div>' +
        '<div class="tech-hero-actions"><button class="btn btn-teal" onclick="navigate(\'tenants\')">Kelola Platform <span>→</span></button></div>' +
      '</div>' +

      '<div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:12px;">' +
        kartuPenjualan +
        kartu('#8B5CF6', 'Kunci AI Gateway', kunciAktif + ' / ' + aiPool.length,
              aiPool.length ? 'kunci aktif dari pool terpasang' : 'pool kosong — isi js/config.local.js') +
      '</div>' +

      '<div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:14px;">' +
        kartu(sc[0], 'Lab Connector (analyzer)', sc[1], sc[2]) +
        kartu(tenant === null ? '#946200' : '#087f6b', 'Sumber data tenant', tenant === null ? 'Tidak terbaca' : 'Terbaca', 'Berdasarkan permintaan data terakhir') +
        kartu('#94A3B8', 'Jembatan SATUSEHAT', 'Belum diperiksa', 'Perlu pemeriksa khusus; status tidak diklaim tanpa itu') +
        kartu('#94A3B8', 'Katalog LOINC/UCUM', 'Lihat di menu', 'Ekspor katalog tes ke format siap-LIS klien') +
      '</div>' +

      '<div class="tech-analytics-grid">' +
        '<div class="card tech-trend"><div class="tech-panel-head"><div><h3>Komposisi tenant</h3><small>Status langganan saat ini, bukan riwayat aktivitas</small></div></div>' + tsTenantSummary(tenant) + '</div>' +
        '<div class="card tech-system-status"><div class="tech-panel-head"><div><h3>Status Sistem</h3><small>Kesehatan komponen utama platform</small></div><button class="btn btn-ghost btn-sm" onclick="renderTechSaas()">↻ Periksa Ulang</button></div>' +
          '<div class="tech-status-row"><i class="ok"></i><span>Aplikasi Web</span><em class="ok">Berjalan normal</em></div>' +
          '<div class="tech-status-row"><i class="neutral"></i><span>Data tenant</span><em class="neutral">' + (tenant === null ? 'Gagal dimuat' : 'Terbaca') + '</em></div>' +
          '<div class="tech-status-row"><i class="neutral"></i><span>Lab Connector (Analyzer)</span><em class="neutral">' + sc[1] + '</em></div>' +
          '<div class="tech-status-row"><i class="neutral"></i><span>AI Gateway</span><em class="neutral">' + kunciAktif + ' kunci aktif; koneksi belum diuji</em></div>' +
          '<div class="tech-status-row"><i class="warn"></i><span>Jembatan SATUSEHAT</span><em class="warn">Perlu diperiksa</em></div>' +
          '<div class="tech-status-row"><i class="ok"></i><span>Katalog LOINC/UCUM</span><em class="neutral">Belum diperiksa</em></div>' +
        '</div>' +
      '</div>' +

      '<div style="display:grid; grid-template-columns:1.6fr 1fr; gap:12px; align-items:start;">' +
        '<div class="card" style="padding:0; overflow:hidden;">' +
          '<div style="padding:14px 18px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px;">' +
            '<h3 style="font-size:14.5px; font-weight:800; margin:0;">Klien Faskes Terdaftar</h3>' +
            '<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="navigate(\'tenants\')">Kelola &rarr;</button>' +
          '</div>' +
          (klien.length
            ? '<div style="overflow-x:auto"><table style="width:100%; border-collapse:collapse; font-size:12.5px;">' +
              '<thead><tr style="text-align:left; color:var(--text3);">' +
                '<th style="padding:9px 18px;">Faskes</th><th>Paket</th><th>Langganan</th>' +
                '<th style="padding-right:18px;">Nilai</th></tr></thead>' +
              '<tbody>' + barisKlien + '</tbody></table></div>'
            : '<div style="padding:30px; text-align:center; color:var(--text3); font-size:12.5px;">' +
              'Belum ada klien faskes terdaftar.<br>' +
              '<button class="btn btn-teal btn-sm" style="margin-top:10px" onclick="navigate(\'tenants\')">Daftarkan klien pertama</button></div>') +
        '</div>' +

        '<div class="card" style="padding:14px; border-radius:6px; box-shadow:none;">' +
          '<div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">' +
            '<span style="font-size:17px;">&#128274;</span>' +
            '<h3 style="font-size:14px; font-weight:800; margin:0;">Lisensi Instalasi Ini</h3></div>' +
          '<p style="font-size:12px; color:var(--text2); line-height:1.6;">' +
            'Lisensi ditandatangani Ed25519 dan diverifikasi luring di mesin klien — tanpa server lisensi eksternal.</p>' +
          '<p style="font-size:11.5px; color:var(--text3); line-height:1.6; margin-top:10px;">' +
            'Lisensi berakhir <strong>tidak</strong> mematikan aplikasi. Statusnya ditampilkan ' +
            'terus-menerus; penagihan diselesaikan antar manusia.</p>' +
          '<button class="btn btn-teal" style="width:100%; margin-top:14px; font-size:12px; font-weight:700;" ' +
            'onclick="navigate(\'lisensi\')">Buka Layar Lisensi</button>' +
        '</div>' +
      '</div>' +
      '<div class="tech-lower-grid">' +
        '<div class="card tech-panel"><div class="tech-panel-head"><h3>Tenant Terbaru</h3><button class="btn btn-ghost btn-sm" onclick="navigate(&#39;tenants&#39;)">Lihat semua</button></div>' +
          (klien.length ? klien.slice(0,3).map(t => '<div class="tech-list-row"><span class="tech-avatar">' + tsEsc((t.nama||'T').slice(0,1)) + '</span><span><b>' + tsEsc(t.nama) + '</b><small>' + tsEsc(t.subdomain||t.kode||'') + '</small></span><em>' + tsEsc(t.is_active ? (t.status_langganan || 'Aktif') : 'Nonaktif') + '</em></div>').join('') : '<div class="tech-empty">Belum ada tenant baru.</div>') +
        '</div>' +
        '<div class="card tech-panel"><div class="tech-panel-head"><h3>Notifikasi &amp; Perhatian</h3><button class="btn btn-ghost btn-sm" onclick="navigate(&#39;tech-isu&#39;)">Lihat semua</button></div>' +
          '<div class="tech-list-row"><span class="tech-alert-dot danger">!</span><span><b>Lab Connector</b><small>Periksa koneksi analyzer</small></span><small>sekarang</small></div>' +
          '<div class="tech-list-row"><span class="tech-alert-dot warn">!</span><span><b>Jembatan SATUSEHAT</b><small>Status belum diperiksa</small></span><small>perlu cek</small></div>' +
        '</div>' +
        '<div class="card tech-panel"><div class="tech-panel-head"><h3>Aksi Cepat</h3></div><div class="tech-quick-grid">' +
          '<button onclick="navigate(\'tenants\')"><span>♙</span>Tambah Tenant</button><button onclick="navigate(\'lisensi\')"><span>▣</span>Kelola Lisensi</button><button onclick="navigate(\'satusehat\')"><span>↔</span>Cek Integrasi</button><button onclick="navigate(\'product\')"><span>▤</span>Lihat Katalog LOINC</button>' +
        '</div></div>' +
      '</div>' +
    '</div>';
}

// ═══════════════════════════════════════════════════════════════
// PROVISIONING TENANT & PENCATATAN PEMAKAIAN
//
// Sebelumnya bagian ini bekerja di atas array JavaScript bernama
// SAAS_TENANTS: provisionNewTenant() mendorong satu baris ke array itu lalu
// mengembalikan { success: true }, dan trackUsageMetering() menaikkan angka
// di dalamnya. Keduanya hilang begitu halaman dimuat ulang — tidak ada satu
// pun klien atau pemakaian yang pernah benar-benar tersimpan, padahal
// inilah dasar penagihan langganan.
//
// Sekarang keduanya menulis ke basis data: public.tenants dan
// public.tenant_pemakaian (migrasi 0029). Karena itu keduanya menjadi
// async — pemanggil lama yang memperlakukannya sinkron akan mendapat
// Promise, bukan diam-diam bekerja dengan data palsu.
// ═══════════════════════════════════════════════════════════════

const TS_KUOTA_PAKET = {
  STARTER_LIS:    { tes: 2000,  kunjungan: 0 },
  CLINIC_PRATAMA: { tes: 3000,  kunjungan: 6000 },
  ENTERPRISE_RS:  { tes: 25000, kunjungan: 50000 },
  MASTER_HOLDING: { tes: 0,     kunjungan: 0 },
};

function tsUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Mendaftarkan faskes klien baru ke public.tenants.
 * Mengembalikan { ok, tenant } atau { error }.
 */
async function provisionNewTenant(config) {
  config = config || {};
  const nama = String(config.name || config.nama || '').trim();
  const paket = config.plan || config.paket || null;

  if (!nama) return { error: 'Nama faskes wajib diisi.' };
  if (!paket) return { error: 'Paket lisensi wajib dipilih.' };

  const kode = String(config.kode || nama).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  if (!kode) return { error: 'Kode tenant tidak dapat diturunkan dari nama.' };

  const kuota = TS_KUOTA_PAKET[paket] || TS_KUOTA_PAKET.STARTER_LIS;

  const baris = {
    id: tsUuid(),
    kode,
    nama,
    jenis: config.jenis || 'klinik',
    is_active: true,
    paket,
    subdomain: config.subdomain || (kode + '.avahealth.sbs'),
    kota: config.kota || null,
    pic_nama: config.pic_nama || null,
    pic_kontak: config.pic_kontak || null,
    mulai_langganan: config.mulai_langganan || null,
    habis_langganan: config.habis_langganan || null,
    nilai_langganan: Number(config.nilai_langganan || 0),
    kuota_tes: config.kuota_tes != null ? Number(config.kuota_tes) : kuota.tes,
    kuota_kunjungan: config.kuota_kunjungan != null ? Number(config.kuota_kunjungan) : kuota.kunjungan,
  };

  try {
    await sbPost('tenants', baris);
    return { ok: true, tenant: baris };
  } catch (e) {
    // Kode ganda adalah kesalahan pemakaian, bukan kegagalan sistem —
    // dibedakan supaya pemanggil bisa menampilkannya dengan tepat.
    const pesan = String((e && e.message) || e);
    if (/duplicate|unique/i.test(pesan)) {
      return { error: 'Kode tenant "' + kode + '" sudah dipakai.' };
    }
    return { error: 'Gagal mendaftarkan tenant: ' + pesan };
  }
}

/**
 * Mencatat pemakaian kuota satu tenant pada bulan berjalan.
 * metrik: 'tes_lab' | 'kunjungan_emr'
 */
async function trackUsageMetering(tenantId, metrik, jumlah) {
  if (!tenantId) return { error: 'Tenant tidak disebutkan.' };

  // Nama metrik lama dari pemanggil terdahulu tetap diterima supaya
  // pemanggil yang belum diperbarui tidak diam-diam mencatat ke metrik yang
  // tidak dikenal dan hilang.
  const peta = { LAB_TEST: 'tes_lab', EMR_VISIT: 'kunjungan_emr' };
  const m = peta[metrik] || metrik;

  try {
    return await sbRpc('tenant_catat_pemakaian', {
      p_tenant: tenantId, p_metrik: m, p_jumlah: Number(jumlah || 1),
    });
  } catch (e) {
    return { error: 'Gagal mencatat pemakaian: ' + ((e && e.message) || e) };
  }
}

// ── TECH ROADMAP & RILIS ────────────────────────────────────────────────
// Read-only records from existing operational tables; never seed example production data.
async function tsOperationalList(title, table, columns) {
  const main = document.getElementById('main-content');
  const view = document.createElement('section');
  view.className = 'tech-directory';
  main.replaceChildren(view);
  view.innerHTML = '<h1>' + tsEsc(title) + '</h1><p role="status">Memuat data…</p>';
  try {
    const rows = await sbGetStrict(table, 'select=' + columns.map(c => c[0]).join(',') + '&order=created_at.desc&limit=100');
    if (!view.isConnected) return;
    if (!Array.isArray(rows)) throw new Error('Invalid response');
    view.innerHTML = '<h1>' + tsEsc(title) + '</h1><p>Menampilkan maksimal 100 catatan terbaru.</p>' +
      (rows.length ? '<div style="overflow:auto"><table class="data-table"><thead><tr>' + columns.map(c => '<th>' + tsEsc(c[1]) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + columns.map(c => '<td>' + tsEsc(r[c[0]] ?? '—') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : '<p role="status">Belum ada catatan yang tersedia untuk akses Anda.</p>');
  } catch (_) {
    if (!view.isConnected) return;
    view.innerHTML = '<h1>' + tsEsc(title) + '</h1><p role="alert">Data belum dapat dimuat. Periksa koneksi atau akses akun, lalu coba lagi.</p>';
  }
  if (!view.isConnected) return;
  const retry = document.createElement('button');retry.className='btn btn-ghost';retry.textContent='Muat ulang';
  retry.onclick = () => tsOperationalList(title, table, columns);view.appendChild(retry);
}
async function renderTechRoadmap() {
  return tsOperationalList('Rilis & Perubahan', 'tech_changes', [['change_no','Nomor'],['title','Perubahan'],['change_type','Jenis'],['status','Status'],['release_version','Versi'],['created_at','Dicatat']]);
}
async function renderTechIsu() {
  return tsOperationalList('Tiket & Tindak Lanjut', 'tech_support_tickets', [['ticket_no','Tiket'],['title','Masalah'],['priority','Prioritas'],['status','Status'],['created_at','Dicatat']]);
}
async function renderTechModul() {
  const main=document.getElementById('main-content');
  const groups=window.PETA_MENU?.kategori?.tech?.grup || [];
  main.innerHTML='<section class="tech-directory"><h1>Katalog Fungsi Tech</h1><p>Inventaris konfigurasi aplikasi. Versi deployment tiap tenant belum tersedia di katalog ini.</p>' +
    groups.map(g=>'<h2>'+tsEsc(g.nama)+'</h2><ul>'+g.menu.map(m=>'<li>'+tsEsc(m.label)+' · '+tsEsc(m.status)+'</li>').join('')+'</ul>').join('')+'</section>';
}
async function renderTechSprint() {
  return window.renderTeamSprint();
}

window.renderTechSaas = renderTechSaas;
window.renderTechRoadmap = renderTechRoadmap;
window.renderTechModul = renderTechModul;
window.renderTechIsu = renderTechIsu;
window.renderTechSprint = renderTechSprint;
window.provisionNewTenant = provisionNewTenant;
window.trackUsageMetering = trackUsageMetering;
