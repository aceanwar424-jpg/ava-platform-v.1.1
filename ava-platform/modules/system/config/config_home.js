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
  { icon:'🏢', title:'Pasien, Korporat & Paket', desc:'Master entitas layanan dan relasinya', items:[
    { label:'Master pasien, penjamin & keluarga', action:"navigate('config',{focus:'patient'})" },
    { label:'Korporat, kontrak & benefit', action:"navigate('config',{focus:'corporate'})" },
    { label:'Paket dan katalog layanan', page:'package' },
  ]},
  { icon:'🏥', title:'Fasilitas & Antrean', desc:'Master ruang, loket, device dan kapasitas', items:[
    { label:'Konfigurasi Antrean & Loket', page:'queue-config' },
    { label:'Cabang, unit, ruang & alat', action:"navigate('config',{focus:'facility'})" },
    { label:'Flow, display & registry perangkat', action:"navigate('config',{focus:'queue'})" },
  ]},
  { icon:'🩺', title:'Tenaga & Parameter Klinis', desc:'Master praktisi, MCU dan formularium', items:[
    { label:'Praktisi, spesialisasi & fee', action:"navigate('config',{focus:'practitioner'})" },
    { label:'Parameter MCU', action:"navigate('config',{focus:'mcu'})" },
    { label:'Master obat & aturan pakai', action:"navigate('config',{focus:'medicine'})" },
  ]},
  { icon:'🔗', title:'Kepatuhan & Integrasi', desc:'Metadata konfigurasi dan status kesiapan', items:[
    { label:'Setup integrasi & perangkat', action:"navigate('config',{focus:'integration'})" },
    { label:'SATUSEHAT Operasional', page:'satusehat' },
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
    {label:'Master Cabang / Plant', state:'Tersedia', fields:'Kode, nama, alamat, kontak, jam operasional, status'},
    {label:'Unit, Ruang & Kelas Layanan', state:'Tersedia', fields:'Unit induk, ruang, kapasitas, lokasi, kelas, status'},
    {label:'Peralatan & Modalitas', page:'rad-modalitas', state:'Tersedia sebagian', fields:'Jenis alat, lokasi, status, jadwal pemeliharaan'},
    {label:'Konfigurasi antrean, loket & layanan', page:'queue-config', state:'Tersedia', fields:'Layanan, prefiks, loket, kuota, prioritas'},
  ]},
  practitioner: { icon:'🩺', title:'Praktisi, Jadwal & Fee', desc:'Dokter, spesialisasi, penjadwalan, cuti, jasa, dan rujukan.', items:[
    {label:'Master praktisi & kredensial', page:'hc-staff', state:'Tersedia sebagian', fields:'Profesi, STR/SIP, kompetensi, unit, masa berlaku'},
    {label:'Spesialisasi Praktisi', state:'Tersedia', fields:'Kode, nama, kategori klinis, status'},
    {label:'Jasa Praktisi & Fee Rujukan', state:'Tersedia', fields:'Layanan, penerima fee, nominal/persen, periode berlaku'},
    {label:'Jadwal & cuti praktisi', page:'work-schedule', state:'Tersedia sebagian', fields:'Praktisi, unit, ruang, hari/jam, kuota, pengecualian'},
  ]},
  patient: { icon:'👤', title:'Pasien, Penjamin & Keluarga', desc:'Master identitas pasien dan data administratif pendukung pelayanan.', items:[
    {label:'Registri keluarga & relasi pasien', page:'family', state:'Tersedia', fields:'Kepala keluarga, relasi, kontak darurat, penanggung jawab'},
    {label:'Penjamin, kondisi & alergi', state:'Tersedia', fields:'Kode, nama, tipe, keterangan, status aktif'},
    {label:'Referensi ICD-10 & ICD-9-CM', state:'Tersedia', fields:'Kode, deskripsi, versi, jenis, status aktif'},
    {label:'Pendaftaran & admisi', page:'admission', state:'Operasional', fields:'Dijalankan dari Alur Pasien, bukan konfigurasi'},
  ]},
  corporate: { icon:'🏢', title:'Korporat & Kontrak', desc:'Entitas perusahaan, paket, kontrak, dan administrasi penjamin.', items:[
    {label:'Daftar korporat', page:'corporate', state:'Tersedia', fields:'Identitas perusahaan, PIC, alamat, status'},
    {label:'Kontrak & benefit korporat', state:'Tersedia', fields:'Periode, paket, plafon, tarif, fasilitas, status'},
    {label:'Level & posisi jabatan', state:'Tersedia', fields:'Kode, nama, urutan, eligibility benefit'},
    {label:'Paket layanan', page:'package', state:'Tersedia', fields:'Kode paket, item, tarif, penjamin, periode'},
  ]},
  mcu: { icon:'🧪', title:'Parameter MCU', desc:'Parameter pemeriksaan kesehatan berkala dan hasil turunannya.', items:[
    {label:'Exposure, hasil, status akhir & rekomendasi', state:'Tersedia', fields:'Kode, kategori, nilai, interpretasi, status aktif'},
    {label:'Ambang audiometri, spirometri & visus', state:'Tersedia', fields:'Metode, ambang, klasifikasi, satuan, interpretasi'},
    {label:'Operasional pemeriksaan MCU', page:'mcu', state:'Operasional', fields:'Dijalankan dari Pelayanan Klinis'},
    {label:'Pemeriksaan penunjang', page:'supportive', state:'Operasional sebagian', fields:'Dijalankan dari Pelayanan Klinis'},
  ]},
  payment: { icon:'💳', title:'Bank, EDC & Pembayaran', desc:'Metode bayar, bank, akun, dan mapping transaksi penerimaan.', items:[
    {label:'Bank & terminal EDC', state:'Tersedia', fields:'Bank, merchant ID, terminal, settlement, MDR, status'},
    {label:'Metode bayar & mapping akun', state:'Tersedia', fields:'Metode, akun pendapatan/biaya, penerapan, status'},
    {label:'Kasir & penerimaan', page:'cashier', state:'Operasional', fields:'Dijalankan dari Keuangan'},
    {label:'Akuntansi dan jurnal', page:'accounting', state:'Operasional', fields:'Dijalankan dari Keuangan'},
  ]},
  queue: { icon:'🎟️', title:'Flow, Display & Perangkat Antrean', desc:'Alur layanan yang dipakai bersama HIS, kiosk, dan display antrean.', items:[
    {label:'Konfigurasi layanan, loket & kapasitas', page:'queue-config', state:'Tersedia', fields:'Layanan, loket, prefiks, kuota, urutan panggil'},
    {label:'Flow, display & outlet', state:'Tersedia', fields:'Sumber, tujuan, ruang, display, SLA, prioritas'},
    {label:'Registry kiosk & display', state:'Tersedia', fields:'Device ID, lokasi, layanan, origin, status, terakhir aktif'},
    {label:'Konsol panggilan', page:'queue-console', state:'Operasional', fields:'Dijalankan dari Alur Pasien'},
    {label:'Kiosk mandiri pasien', page:'queue-kiosk', state:'Operasional', fields:'Dijalankan dari Alur Pasien'},
  ]},
  medicine: { icon:'💊', title:'Master Obat & Aturan Pakai', desc:'Formularium, stok, resep, dan parameter penggunaan obat.', items:[
    {label:'Kategori, bentuk & aturan pakai', state:'Tersedia', fields:'Kategori, sediaan, aturan, instruksi, waktu konsumsi'},
    {label:'Farmasi & e-prescription', page:'farmasi', state:'Operasional', fields:'Dijalankan dari Pelayanan Klinis'},
  ]},
  promotion: { icon:'🏷️', title:'Deal, Voucher & Diskon', desc:'Aturan promosi layanan yang terpisah dari transaksi kasir.', items:[
    {label:'Master deal, voucher & diskon', state:'Tersedia', fields:'Kode, target layanan, tipe, nilai, periode, kuota, syarat, status'},
  ]},
  telemedicine: { icon:'📹', title:'Setup Telemedicine', desc:'Konfigurasi koneksi penyedia telekonsultasi.', items:[
    {label:'Provider, jadwal & webhook', state:'Tersedia', fields:'Provider, fasilitas, jadwal, endpoint, status koneksi'},
    {label:'Booking telekonsultasi', page:'appointments', state:'Operasional', fields:'Dijalankan dari Alur Pasien'},
  ]},
  integration: { icon:'', title:'Integrasi & Konektivitas', desc:'Metadata perangkat dan integrasi. Credential disimpan sebagai referensi secret, bukan di layar master.', items:[
    {label:'Flow, display & outlet antrean', state:'Tersedia', fields:'Layanan, tahap, ruang, display, outlet, prioritas'},
    {label:'Registry kiosk & display', state:'Tersedia', fields:'Tipe perangkat, lokasi, origin, layanan, batas penerbitan tiket'},
    {label:'Provider, jadwal & webhook', state:'Tersedia', fields:'Provider, fasilitas, kebijakan jadwal, endpoint, referensi secret'},
    {label:'SATUSEHAT setup & status', state:'Tersedia', fields:'Organization ID, environment, referensi secret, status koneksi'},
  ]},
};

// Kartu hub dan menu sidebar memakai registry yang sama. Hal ini mencegah
// master baru berhenti sebagai "kerangka" tanpa rute CRUD yang nyata.
const CONFIG_MASTER_DOMAIN_BY_LABEL = {
  'Master Cabang / Plant':'branch',
  'Unit, Ruang & Kelas Layanan':'unit_room',
  'Peralatan & Modalitas':'equipment',
  'Spesialisasi Praktisi':'specialty',
  'Jasa Praktisi & Fee Rujukan':'practitioner_fee',
  'Penjamin, kondisi & alergi':'patient_reference',
  'Referensi ICD-10 & ICD-9-CM':'diagnosis_reference',
  'Exposure, hasil, status akhir & rekomendasi':'mcu_parameter',
  'Ambang audiometri, spirometri & visus':'mcu_threshold',
  'Kategori, bentuk & aturan pakai':'medicine_reference',
  'Kontrak & benefit korporat':'corporate_contract',
  'Level & posisi jabatan':'job_master',
  'Bank & terminal EDC':'bank_edc',
  'Metode bayar & mapping akun':'payment_mapping',
  'Flow, display & outlet':'queue_flow',
  'Registry kiosk & display':'queue_device',
  'Master deal, voucher & diskon':'promotion',
  'Provider, jadwal & webhook':'telemedicine',
  'Flow, display & outlet antrean':'queue_flow',
  'SATUSEHAT setup & status':'satusehat_setup',
};

function configDomainTabs(active){
  return `<nav class="config-domain-tabs" aria-label="Domain konfigurasi">${Object.entries(CONFIG_DOMAINS).map(([key, domain]) =>
    `<button type="button" class="config-domain-tab ${key === active ? 'active' : ''}" aria-current="${key === active ? 'page' : 'false'}" onclick="navigate('config',{focus:'${key}'})">${domain.title}</button>`
  ).join('')}</nav>`;
}

function renderConfigHub(focus = 'overview', targetId = 'main-content'){
  const root = document.getElementById(targetId);
  if (!root) return;
  const isSettingsSub = targetId !== 'main-content';
  const domain = CONFIG_DOMAINS[focus];

  if (domain) {
    root.innerHTML = `
      <section class="config-workspace">
      <header class="config-workspace-head"><div><p class="cat-eyebrow">Pengaturan & master</p><h1>${domain.title}</h1><p>${domain.desc}</p></div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="navigate('config')">Semua konfigurasi</button></header>
      ${configDomainTabs(focus)}
      <p class="config-workspace-note">Menu yang tersedia dapat dibuka sekarang. Status ditampilkan agar master yang belum lengkap tidak terlihat sebagai fitur transaksi siap pakai.</p>
      <div class="config-domain-grid">
          ${domain.items.map(item => { const masterDomain = CONFIG_MASTER_DOMAIN_BY_LABEL[item.label]; return `<article class="config-domain-card">
            <div class="config-domain-card-title"><strong>${item.label}</strong><span class="config-state ${item.state.includes('Operasional') ? 'operational' : item.page ? 'available' : ''}">${item.state}</span></div>
            <p>${item.fields || 'Field akan dirumuskan bersama pemilik proses.'}</p>
            ${masterDomain ? `<button type="button" class="config-action" onclick="navigate('master-records',{domain:'${masterDomain}'})">Kelola master</button>` : item.page ? `<button type="button" class="config-action" onclick="navigate('${item.page}')">${item.state.includes('Operasional') ? 'Buka operasional' : 'Buka konfigurasi'}</button>` : `<span class="config-unavailable">Belum memiliki form domain khusus</span>`}
          </article>`; }).join('')}
      </div></section>`;
    return;
  }

  renderConfigHome(targetId);
}

function renderConfigHome(targetId = 'main-content'){
  const isSettingsSub = targetId !== 'main-content';

  const headerHtml = isSettingsSub ? `
    <div style="margin-bottom: 16px;">
      <h2 style="font-size:16px; font-weight:800; color:var(--navy)">Master Data Hub</h2>
      <p style="font-size:12px; color:var(--text3)">Pusat konfigurasi master data &amp; pengaturan sistem</p>
    </div>
  ` : `
    <header class="config-workspace-head"><div><p class="cat-eyebrow">Pengaturan</p><h1>Pengaturan &amp; Master HIS</h1><p>Aturan, master, perangkat, dan integrasi. Transaksi harian tetap berada di menu operasional.</p></div></header>
  `;

  const root = document.getElementById(targetId);
  if (!root) return;
  root.innerHTML = `
    ${headerHtml}
    <div class="config-overview-grid">
      ${CONFIG_GROUPS.map(g=>`
        <section class="config-overview-group">
          <header><strong>${g.title}</strong><p>${g.desc}</p></header>
          <div class="config-overview-actions">
            ${g.items.map(it=>`<button type="button" onclick="${it.action||`navigate('${it.page}')`}">${it.label}<span aria-hidden="true">Buka</span></button>`).join('')}
          </div>
        </section>`).join('')}
    </div>`;
}

window.renderConfigHome = renderConfigHome;
window.renderConfigHub = renderConfigHub;
