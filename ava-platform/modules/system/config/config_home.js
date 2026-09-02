// ═══════════════════════════════════════════════════════════════
// MODULE: Configuration Home — landing kartu berkelompok (ala Virtu)
// ═══════════════════════════════════════════════════════════════
const CONFIG_GROUPS = [
  { icon:'🧬', title:'Master Laboratorium', desc:'Tes, analit, rujukan, alat', items:[
    { label:'Master Tes / Produk', page:'product' },
    { label:'Reference Range', page:'refrange' },
    { label:'Package & Panel', page:'package' },
    { label:'Master Alat (Analyzer)', action:"navigate('lab',{tab:'qc'})" },
  ]},
  { icon:'🏢', title:'Pasien, Korporat & Paket', desc:'Entitas layanan dan relasinya', items:[
    { label:'Corporate', page:'corporate' },
    { label:'Family Registry', page:'family' },
    { label:'Paket Layanan', page:'package' },
  ]},
  { icon:'🎟️', title:'Fasilitas & Antrean', desc:'Loket, kiosk, jadwal dan kapasitas', items:[
    { label:'Konfigurasi Antrean & Loket', page:'queue-config' },
    { label:'Jadwal & Perjanjian', page:'appointments' },
    { label:'Jadwal Home Care', page:'hc-schedule' },
  ]},
  { icon:'🩺', title:'Tenaga & Penugasan', desc:'Nakes dan jadwal operasional', items:[
    { label:'Master Nakes Home Care', page:'hc-staff' },
    { label:'Jadwal Kerja Tim', page:'work-schedule' },
  ]},
  { icon:'🔗', title:'Kepatuhan & Integrasi', desc:'Aktifkan melalui staging dan UAT', items:[
    { label:'SATUSEHAT — Setup & Status', page:'satusehat' },
    { label:'Klaim Penjamin & BPJS', page:'bpjs-claim' },
    { label:'Tracker Kepatuhan', page:'compliance-tracker' },
  ]},
  { icon:'🖨️', title:'Output & Setting', desc:'Hasil PDF, pengaturan, user', items:[
    { label:'Setting Hasil PDF', page:'labreport' },
    { label:'Pengaturan Umum', page:'settings' },
    { label:'User Management', page:'users' },
  ]},
  { icon:'🗃️', title:'Data Tools', desc:'Impor, audit, dan penataan data awal', items:[
    { label:'Bulk Upload (Import Excel/CSV)', page:'import' },
  ]},
];

// Peta ini sengaja membedakan layar yang sudah dapat dipakai dari master
// yang baru disediakan kerangkanya. Dengan begitu operator tidak mendapat
// tombol "palsu", sementara struktur HIS tetap lengkap dan mudah dilanjutkan.
const CONFIG_DOMAINS = {
  facility: { icon:'🏥', title:'Fasilitas, Cabang & Unit', desc:'Struktur faskes, ruang, kelas layanan, dan perangkat operasional.', items:[
    {label:'Konfigurasi antrean, loket & layanan', page:'queue-config', state:'Tersedia'},
    {label:'Jadwal layanan dan perjanjian', page:'appointments', state:'Tersedia'},
    {label:'Cabang, plant, unit, ruang & kelas layanan', state:'Kerangka master'},
    {label:'Alat, modalitas & unit-item pemeriksaan', page:'rad-modalitas', state:'Tersedia sebagian'},
  ]},
  practitioner: { icon:'🩺', title:'Praktisi, Jadwal & Fee', desc:'Dokter, spesialisasi, penjadwalan, cuti, jasa, dan rujukan.', items:[
    {label:'Jadwal dokter & perjanjian', page:'appointments', state:'Tersedia'},
    {label:'Master tenaga kesehatan', page:'hc-staff', state:'Tersedia'},
    {label:'Roster dan jadwal kerja', page:'work-schedule', state:'Tersedia'},
    {label:'Spesialisasi, cuti, jasa & fee rujukan', state:'Kerangka master'},
  ]},
  patient: { icon:'👤', title:'Pasien, Penjamin & Keluarga', desc:'Master identitas pasien dan data administratif pendukung pelayanan.', items:[
    {label:'Pendaftaran dan identitas pasien', page:'admission', state:'Tersedia'},
    {label:'Registri keluarga & relasi pasien', page:'family', state:'Tersedia'},
    {label:'Penjamin, asuransi, kondisi, alergi, ICD-9/10', state:'Kerangka master'},
  ]},
  corporate: { icon:'🏢', title:'Korporat & Kontrak', desc:'Entitas perusahaan, paket, kontrak, dan administrasi penjamin.', items:[
    {label:'Daftar korporat', page:'corporate', state:'Tersedia'},
    {label:'Paket layanan', page:'package', state:'Tersedia'},
    {label:'Kontrak, jabatan, level dan fasilitas penjamin', state:'Kerangka master'},
  ]},
  mcu: { icon:'🧪', title:'Parameter MCU', desc:'Parameter pemeriksaan kesehatan berkala dan hasil turunannya.', items:[
    {label:'Operasional pemeriksaan MCU', page:'mcu', state:'Tersedia'},
    {label:'Audiometri, spirometri & pemeriksaan penunjang', page:'supportive', state:'Tersedia sebagian'},
    {label:'Exposure, hasil akhir, rekomendasi, visus & tekanan darah', state:'Kerangka master'},
  ]},
  payment: { icon:'💳', title:'Bank, EDC & Pembayaran', desc:'Metode bayar, bank, akun, dan mapping transaksi penerimaan.', items:[
    {label:'Kasir & penerimaan', page:'cashier', state:'Tersedia'},
    {label:'Akuntansi dan chart transaksi', page:'accounting', state:'Tersedia'},
    {label:'Bank, EDC, metode pembayaran & mapping akun', state:'Kerangka master'},
  ]},
  queue: { icon:'🎟️', title:'Flow, Display & Perangkat Antrean', desc:'Alur layanan yang dipakai bersama HIS, kiosk, dan display antrean.', items:[
    {label:'Konfigurasi layanan, loket dan kapasitas', page:'queue-config', state:'Tersedia'},
    {label:'Konsol panggilan per loket', page:'queue-console', state:'Tersedia'},
    {label:'Kiosk mandiri pasien', page:'queue-kiosk', state:'Tersedia'},
    {label:'Flow, display, outlet & perangkat terdaftar', state:'Kerangka master'},
  ]},
  medicine: { icon:'💊', title:'Master Obat & Aturan Pakai', desc:'Formularium, stok, resep, dan parameter penggunaan obat.', items:[
    {label:'Farmasi & e-prescription', page:'farmasi', state:'Tersedia'},
    {label:'Kategori, bentuk, aturan, instruksi & waktu konsumsi', state:'Kerangka master'},
  ]},
};

function configDomainTabs(active){
  return `<div style="display:flex;flex-wrap:wrap;gap:7px;margin:0 0 18px">${Object.entries(CONFIG_DOMAINS).map(([key, domain]) =>
    `<button class="btn btn-sm ${key === active ? 'btn-teal' : 'btn-ghost'}" onclick="navigate('config',{focus:'${key}'})">${domain.icon} ${domain.title}</button>`
  ).join('')}</div>`;
}

function renderConfigHub(focus = 'overview', targetId = 'main-content'){
  const root = document.getElementById(targetId);
  if (!root) return;
  const isSettingsSub = targetId !== 'main-content';
  const domain = CONFIG_DOMAINS[focus];

  if (domain) {
    root.innerHTML = `
      <div class="page-header"><div><h1>${domain.icon} ${domain.title}</h1><p>${domain.desc}</p></div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('config')">← Semua konfigurasi</button></div>
      ${configDomainTabs(focus)}
      <div class="card" style="max-width:920px;border-top:3px solid var(--teal)">
        <div style="font-weight:800;color:var(--navy);margin-bottom:5px">Ruang konfigurasi ${domain.title}</div>
        <p style="margin:0 0 14px;color:var(--text3);font-size:12px">Menu siap pakai dapat dibuka sekarang. Item kerangka ditandai jelas agar tidak terlihat sebagai fitur transaksi yang sudah selesai.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">
          ${domain.items.map(item => `<div style="border:1px solid var(--border);border-radius:9px;padding:12px;background:var(--surface,#fff)">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><strong style="font-size:12px;color:var(--navy)">${item.label}</strong><span style="white-space:nowrap;font-size:10px;color:${item.page ? 'var(--teal)' : 'var(--text3)'}">${item.state}</span></div>
            ${item.page ? `<button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="navigate('${item.page}')">Buka modul →</button>` : `<div style="margin-top:10px;font-size:11px;color:var(--text3)">Master ini belum memiliki formulir penyimpanan.</div>`}
          </div>`).join('')}
        </div>
      </div>`;
    return;
  }

  renderConfigHome(targetId);
}

function renderConfigHome(targetId = 'main-content'){
  const isSettingsSub = targetId !== 'main-content';

  const headerHtml = isSettingsSub ? `
    <div style="margin-bottom: 16px;">
      <h2 style="font-size:16px; font-weight:800; color:var(--navy)">🗄️ Master Data Hub</h2>
      <p style="font-size:12px; color:var(--text3)">Pusat konfigurasi master data &amp; pengaturan sistem</p>
    </div>
  ` : `
    <div class="page-header">
      <div><h1>Configuration</h1><p>Pusat konfigurasi master data &amp; pengaturan sistem</p></div>
    </div>
  `;

  const root = document.getElementById(targetId);
  if (!root) return;
  root.innerHTML = `
    ${headerHtml}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
      ${CONFIG_GROUPS.map(g=>`
        <div class="card" style="border-top:3px solid var(--teal)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <span style="font-size:22px">${g.icon}</span>
            <div><div style="font-weight:800;color:var(--navy)">${g.title}</div>
              <div style="font-size:10.5px;color:var(--text3)">${g.desc}</div></div>
          </div>
          <div style="border-top:1px solid var(--border);margin:8px 0;"></div>
          <div style="display:flex;flex-direction:column;gap:3px">
            ${g.items.map(it=>`<button class="btn btn-ghost btn-sm" style="justify-content:flex-start;text-align:left;font-weight:600"
              onclick="${it.action||`navigate('${it.page}')`}">▸ ${it.label}</button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

window.renderConfigHome = renderConfigHome;
window.renderConfigHub = renderConfigHub;
