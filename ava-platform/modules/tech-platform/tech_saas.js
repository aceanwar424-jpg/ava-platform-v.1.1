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
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 2000);
    const r = await fetch('http://127.0.0.1:9999/api/status', { signal: ac.signal });
    clearTimeout(t);
    return r.ok ? 'hidup' : 'menolak';
  } catch (e) { return 'mati'; }
}

async function tsAmbilTenant() {
  try {
    const d = await sbGet('tenant_ringkasan', 'select=*');
    return Array.isArray(d) ? d : null;
  } catch (e) { return null; }
}

const tsRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const tsEsc = (x) => String(x == null ? '' : x)
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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

  const kartu = (warna, label, nilai, ket) =>
    '<div class="card" style="padding:16px 18px; border-left:4px solid ' + warna + ';">' +
      '<div style="font-size:10.5px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:.05em;">' + label + '</div>' +
      '<div style="font-size:19px; font-weight:800; color:' + warna + '; margin:4px 0;">' + nilai + '</div>' +
      '<div style="font-size:11.5px; color:var(--text2);">' + ket + '</div>' +
    '</div>';

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
    '<div style="padding:20px; font-family:\'Plus Jakarta Sans\',sans-serif;">' +

      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; flex-wrap:wrap; gap:16px; background:linear-gradient(135deg,#0F172A,#1E293B); padding:24px 28px; border-radius:16px; border:1px solid rgba(14,165,233,0.3); box-shadow:0 10px 30px rgba(0,0,0,0.15);">' +
        '<div>' +
          '<div style="display:inline-flex; align-items:center; gap:8px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; color:#38BDF8; margin-bottom:8px;">' +
            '<span>&#128187;</span> PILAR 3 &bull; AVA TECH (tech.avahealth.sbs)</div>' +
          '<h1 style="font-size:22px; font-weight:800; color:#fff; margin:0 0 6px 0; letter-spacing:-0.02em;">Pembangun &amp; Penjual Sistem</h1>' +
          '<p style="font-size:13px; color:#94A3B8; margin:0; max-width:660px; line-height:1.5;">' +
            'Unit yang membangun platform ini dan melisensikannya ke faskes lain: mesin multi-tenant, ' +
            'interoperabilitas SATUSEHAT &amp; analyzer, katalog LOINC, serta pengelolaan langganan klien.</p>' +
        '</div>' +
        '<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">' +
          '<button class="btn btn-ghost" onclick="renderTechSaas()" style="background:rgba(255,255,255,0.06); color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:12px;">&#8635; Periksa Ulang</button>' +
          '<button class="btn btn-teal" onclick="navigate(\'tenants\')" style="font-size:12px; font-weight:700;">Kelola Tenant Klien</button>' +
        '</div>' +
      '</div>' +

      '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:24px;">' +
        kartuPenjualan +
        kartu('#8B5CF6', 'Kunci AI Gateway', kunciAktif + ' / ' + aiPool.length,
              aiPool.length ? 'kunci aktif dari pool terpasang' : 'pool kosong — isi js/config.local.js') +
      '</div>' +

      '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:16px; margin-bottom:24px;">' +
        kartu(sc[0], 'Lab Connector (analyzer)', sc[1], sc[2]) +
        kartu('#10B981', 'Basis data', 'PostgreSQL PGlite', 'Local-first, berjalan di dalam aplikasi') +
        kartu('#94A3B8', 'Jembatan SATUSEHAT', 'Belum diperiksa', 'Perlu pemeriksa khusus; status tidak diklaim tanpa itu') +
        kartu('#94A3B8', 'Katalog LOINC/UCUM', 'Lihat di menu', 'Ekspor katalog tes ke format siap-LIS klien') +
      '</div>' +

      '<div style="display:grid; grid-template-columns:1.6fr 1fr; gap:20px; align-items:start;">' +
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

        '<div class="card" style="padding:20px;">' +
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
async function renderTechRoadmap() {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <div style="padding:24px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; background:linear-gradient(135deg,#0F172A,#1E293B); padding:24px 28px; border-radius:16px; border:1px solid rgba(14,165,233,0.3); box-shadow:0 10px 30px rgba(0,0,0,0.15);">
        <div>
          <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; color:#38BDF8; margin-bottom:8px;">
            <span>🗺️</span> TECH ROADMAP & RELEASE LOG (2026 EDITION)
          </div>
          <h1 style="font-size:22px; font-weight:800; color:#fff; margin:0 0 6px 0;">Roadmap & Catatan Rilis Platform</h1>
          <p style="font-size:13px; color:#94A3B8; margin:0; max-width:680px; line-height:1.5;">
            Lacak perjalanan evolusi arsitektur AVA Diagnostics & Health SaaS dari versi baseline v1.0 hingga ekosistem enterprise v2.0.
          </p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-teal" onclick="toast('Roadmap disinkronkan dengan git tags','ok')" style="font-size:12px; font-weight:700;">🔄 Sinkronkan Versioning</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:24px;">
        <div class="card" style="padding:16px 18px; border-left:4px solid #10B981;">
          <div style="font-size:10.5px; font-weight:700; color:var(--text3); text-transform:uppercase;">VERSI SAAT INI</div>
          <div style="font-size:19px; font-weight:800; color:#10B981; margin:4px 0;">v1.2.4-PROD</div>
          <div style="font-size:11.5px; color:var(--text2);">LIS-HIS Sync & Multi-Tenant Engine</div>
        </div>
        <div class="card" style="padding:16px 18px; border-left:4px solid #3B82F6;">
          <div style="font-size:10.5px; font-weight:700; color:var(--text3); text-transform:uppercase;">FASE BERJALAN</div>
          <div style="font-size:19px; font-weight:800; color:#3B82F6; margin:4px 0;">Fase 4: Multi-Lab</div>
          <div style="font-size:11.5px; color:var(--text2);">ISO 15189 Multi-Tenant Parameterized</div>
        </div>
        <div class="card" style="padding:16px 18px; border-left:4px solid #8B5CF6;">
          <div style="font-size:10.5px; font-weight:700; color:var(--text3); text-transform:uppercase;">ROADMAP NEXT (Q4 2026)</div>
          <div style="font-size:19px; font-weight:800; color:#8B5CF6; margin:4px 0;">v2.0 Cloud Enterprise</div>
          <div style="font-size:11.5px; color:var(--text2);">Federated PACS & Universal AI Gateway</div>
        </div>
        <div class="card" style="padding:16px 18px; border-left:4px solid #F59E0B;">
          <div style="font-size:10.5px; font-weight:700; color:var(--text3); text-transform:uppercase;">PROGRESS ROADMAP</div>
          <div style="font-size:19px; font-weight:800; color:#F59E0B; margin:4px 0;">88% Selesai</div>
          <div style="font-size:11.5px; color:var(--text2);">38 dari 43 fitur utama terpasang</div>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-bottom:24px;">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 16px 0;">Timeline Rilis & Milestone Arsitektur</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px;">
          <div style="background:var(--bg2); padding:16px; border-radius:12px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="badge" style="background:#10B98120; color:#10B981; font-weight:800;">v1.0 BASELINE</span>
              <small style="color:var(--text3);">Q1 2026</small>
            </div>
            <h4 style="margin:0 0 6px 0; font-size:14px; color:var(--text);">Core LIS & Single Lab Engine</h4>
            <p style="font-size:12px; color:var(--text2); margin:0; line-height:1.5;">Pengembangan fondasi LIS, reference range, printer barcode, dan ekspor hasil PDF laboratorium.</p>
          </div>
          <div style="background:var(--bg2); padding:16px; border-radius:12px; border:1px solid var(--border); border-color:#3B82F6;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="badge" style="background:#3B82F620; color:#3B82F6; font-weight:800;">v1.1 LIS-HIS SYNC</span>
              <small style="color:var(--text3);">Q2 2026</small>
            </div>
            <h4 style="margin:0 0 6px 0; font-size:14px; color:var(--text);">Pemeriksaan Terintegrasi & HIS</h4>
            <p style="font-size:12px; color:var(--text2); margin:0; line-height:1.5;">Penyesuaian modul pendaftaran order, bridging SATUSEHAT Kemenkes, dan EMR SOAP klinik.</p>
          </div>
          <div style="background:var(--bg2); padding:16px; border-radius:12px; border:1px solid #8B5CF6; box-shadow:0 0 12px rgba(139,92,246,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="badge" style="background:#8B5CF620; color:#8B5CF6; font-weight:800;">v1.2 ACTIVE RILIS</span>
              <small style="color:#8B5CF6; font-weight:700;">SAAT INI</small>
            </div>
            <h4 style="margin:0 0 6px 0; font-size:14px; color:var(--text);">Multi-Lab Engine & AI Gateway</h4>
            <p style="font-size:12px; color:var(--text2); margin:0; line-height:1.5;">Document Reengineering Engine ISO 15189, katalog tes siap-LIS, multi-tenant RBAC, dan Agentic AI Orchestrator.</p>
          </div>
          <div style="background:var(--bg2); padding:16px; border-radius:12px; border:1px dashed var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="badge" style="background:#F59E0B20; color:#F59E0B; font-weight:800;">v2.0 NEXT</span>
              <small style="color:var(--text3);">Q4 2026</small>
            </div>
            <h4 style="margin:0 0 6px 0; font-size:14px; color:var(--text);">Cloud Enterprise & Telemedicine</h4>
            <p style="font-size:12px; color:var(--text2); margin:0; line-height:1.5;">PACS DICOM WebViewer, Automated Billing Gateway, dan Integrasi Perangkat Wearable Pasien.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── KATALOG MODUL & VERSI ────────────────────────────────────────────────
async function renderTechModul() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const modulList = [
    { code: 'AVA-LIS', name: 'AVA LIS Engine', ver: 'v1.2.4', cat: 'Laboratorium', tier: 'Enterprise', desc: 'Sistem LIS lengkap: pra-analitik, interfacing instrument, QC Westgard, otorisasi Sp.PK.' },
    { code: 'AVA-HIS', name: 'AVA HIS & EMR', ver: 'v1.2.1', cat: 'Klinik & RS', tier: 'Pro', desc: 'EMR SOAP PMK 24/2022, pendaftaran pasien, jadwal dokter, IGD, dan rawat inap.' },
    { code: 'AVA-AI', name: 'Agentic AI Orchestrator', ver: 'v2.0-beta', cat: 'AI & Otomasi', tier: 'Enterprise', desc: 'Multi-agent AI penafsir medis, auto-summary QMS ISO 15189, dan Approval Inbox R1-R3.' },
    { code: 'AVA-SS', name: 'SATUSEHAT Bridge', ver: 'v1.0.8', cat: 'Integrasi', tier: 'All Tier', desc: 'Konektor FHIR R4 resmi Kemenkes untuk Encounter, Condition, & Observation.' },
    { code: 'AVA-BPJS', name: 'BPJS INA-CBG Bridge', ver: 'v1.1.0', cat: 'Klaim & Finansial', tier: 'Pro', desc: 'Bridge klaim V-Claim BPJS Kesehatan, SEP, dan validasi koding ICD-10/ICD-9.' },
    { code: 'AVA-RIS', name: 'PACS & DICOM Viewer', ver: 'v1.0.2', cat: 'Radiologi', tier: 'Enterprise', desc: 'Web DICOM Viewer dengan windowing preset, CTR measurement, dan ekspertise Radiolog.' },
    { code: 'AVA-WELL', name: 'Wellness & Nutrition', ver: 'v1.1.5', cat: 'Wellness', tier: 'D2C', desc: 'Kalkulator kalori NutriCo, tracker langkah wearable, dan katalog program diet.' },
    { code: 'AVA-CRM', name: 'B2B Corporate Portal', ver: 'v1.0.9', cat: 'Komersial', tier: 'Enterprise', desc: 'Portal klien korporat MCU, pengelolaan MoU/kontrak, dan auto billing invoice.' }
  ];

  main.innerHTML = `
    <div style="padding:24px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; background:linear-gradient(135deg,#0F172A,#1E293B); padding:24px 28px; border-radius:16px; border:1px solid rgba(14,165,233,0.3);">
        <div>
          <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; color:#38BDF8; margin-bottom:8px;">
            <span>📦</span> KATALOG MODUL & LISENSI PLATFORM
          </div>
          <h1 style="font-size:22px; font-weight:800; color:#fff; margin:0 0 6px 0;">Katalog Modul Berlisensi AVA Tech</h1>
          <p style="font-size:13px; color:#94A3B8; margin:0; line-height:1.5;">
            Daftar modul perangkat lunak kesehatan yang siap dikonfigurasi dan dilisensikan ke klien faskes mitra.
          </p>
        </div>
        <button class="btn btn-teal" onclick="toast('Katalog modul diperbarui','ok')" style="font-size:12px; font-weight:700;">+ Tambah Modul Baru</button>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:18px;">
        ${modulList.map(m => `
          <div class="card" style="padding:20px; display:flex; flex-direction:column; justify-content:space-between; border-top:3px solid #0EA5E9;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-family:monospace; font-weight:800; font-size:11px; color:#0EA5E9; background:rgba(14,165,233,0.1); padding:2px 8px; border-radius:6px;">${m.code}</span>
                <span class="badge" style="background:var(--bg2); color:var(--text2); border:1px solid var(--border);">${m.ver}</span>
              </div>
              <h3 style="font-size:16px; font-weight:800; margin:0 0 6px 0; color:var(--text);">${m.name}</h3>
              <p style="font-size:12px; color:var(--text2); margin:0 0 14px 0; line-height:1.5;">${m.desc}</p>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border); font-size:11.5px;">
              <span style="color:var(--text3);">Kategori: <strong>${m.cat}</strong></span>
              <span style="color:#10B981; font-weight:800;">${m.tier}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── LACAK BUG & PERMINTAAN FITUR ─────────────────────────────────────────
async function renderTechIsu() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const issues = [
    { id: 'TICK-102', client: 'Klinik AVA Utama', title: 'Percepatan loading EMR SOAP pada koneksi 3G', type: 'Optimasi', priority: 'High', status: 'In Progress' },
    { id: 'TICK-101', client: 'Lab Diagnostik Medika', title: 'Penyesuaian format ekspor LOINC HL7 v2.5.1', type: 'Permintaan', priority: 'Medium', status: 'Resolved' },
    { id: 'TICK-099', client: 'RS QMS Partner', title: 'Sinkronisasi otomatis audit trail ISO 15189', type: 'Fitur Baru', priority: 'High', status: 'In Progress' },
    { id: 'TICK-098', client: 'Wellness Sanctuary', title: 'Integrasi kalori NutriCo ke Apple HealthKit API', type: 'Fitur Baru', priority: 'Low', status: 'Under Review' }
  ];

  main.innerHTML = `
    <div style="padding:24px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; background:linear-gradient(135deg,#0F172A,#1E293B); padding:24px 28px; border-radius:16px; border:1px solid rgba(14,165,233,0.3);">
        <div>
          <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; color:#38BDF8; margin-bottom:8px;">
            <span>🐛</span> TICKET & ISSUE TRACKER
          </div>
          <h1 style="font-size:22px; font-weight:800; color:#fff; margin:0 0 6px 0;">Pelacak Bug & Permintaan Fitur Klien</h1>
          <p style="font-size:13px; color:#94A3B8; margin:0; line-height:1.5;">
            Pantau laporan bug, perbaikan masalah, dan antrean fitur baru dari seluruh klien faskes mitra.
          </p>
        </div>
        <button class="btn btn-teal" onclick="toast('Form tiket baru dibuka','ok')" style="font-size:12px; font-weight:700;">+ Buat Tiket Masalah</button>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:15px; font-weight:800; margin:0;">Daftar Tiket Terdaftar</h3>
          <span style="font-size:12px; color:var(--text3);">${issues.length} tiket aktif</span>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; color:var(--text3); border-bottom:1px solid var(--border); background:var(--bg2);">
                <th style="padding:12px 18px;">ID Tiket</th>
                <th>Klien Faskes</th>
                <th>Judul Permintaan / Bug</th>
                <th>Tipe</th>
                <th>Prioritas</th>
                <th style="padding-right:18px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${issues.map(i => `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:12px 18px; font-family:monospace; font-weight:700; color:#0EA5E9;">${i.id}</td>
                  <td><strong>${i.client}</strong></td>
                  <td>${i.title}</td>
                  <td><span class="badge" style="background:var(--bg2); border:1px solid var(--border);">${i.type}</span></td>
                  <td><span style="color:${i.priority === 'High' ? '#EF4444' : '#F59E0B'}; font-weight:700;">${i.priority}</span></td>
                  <td style="padding-right:18px;"><span class="badge" style="background:${i.status === 'Resolved' ? '#10B98120' : '#0EA5E920'}; color:${i.status === 'Resolved' ? '#10B981' : '#0EA5E9'}; font-weight:700;">${i.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ── SPRINT & BEBAN KERJA TIM TECH ────────────────────────────────────────
async function renderTechSprint() {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <div style="padding:24px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; background:linear-gradient(135deg,#0F172A,#1E293B); padding:24px 28px; border-radius:16px; border:1px solid rgba(14,165,233,0.3);">
        <div>
          <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; color:#38BDF8; margin-bottom:8px;">
            <span>⚡</span> SPRINT & ENGINEERING WORKLOAD
          </div>
          <h1 style="font-size:22px; font-weight:800; color:#fff; margin:0 0 6px 0;">Sprint Active & Kapasitas Tim Tech</h1>
          <p style="font-size:13px; color:#94A3B8; margin:0; line-height:1.5;">
            Manajemen beban kerja developer, alokasi tugas sprint, dan velocity rekayasa perangkat lunak AVA Tech.
          </p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:24px;">
        <div class="card" style="padding:16px 18px; border-left:4px solid #10B981;">
          <div style="font-size:10.5px; font-weight:700; color:var(--text3);">SPRINT AKTIF</div>
          <div style="font-size:19px; font-weight:800; color:#10B981; margin:4px 0;">Sprint 24</div>
          <div style="font-size:11.5px; color:var(--text2);">Target: Multi-Lab & LIS-HIS Perfecting</div>
        </div>
        <div class="card" style="padding:16px 18px; border-left:4px solid #0EA5E9;">
          <div style="font-size:10.5px; font-weight:700; color:var(--text3);">VELOCITY TIM</div>
          <div style="font-size:19px; font-weight:800; color:#0EA5E9; margin:4px 0;">42 Story Points</div>
          <div style="font-size:11.5px; color:var(--text2);">Selesai 92% dari target sprint</div>
        </div>
      </div>
    </div>
  `;
}

window.renderTechSaas = renderTechSaas;
window.renderTechRoadmap = renderTechRoadmap;
window.renderTechModul = renderTechModul;
window.renderTechIsu = renderTechIsu;
window.renderTechSprint = renderTechSprint;
window.provisionNewTenant = provisionNewTenant;
window.trackUsageMetering = trackUsageMetering;
