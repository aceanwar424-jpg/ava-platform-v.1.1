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
    {label:'Master Cabang / Plant', state:'Kerangka master', fields:'Kode, nama, alamat, kontak, jam operasional, status'},
    {label:'Unit, Ruang & Kelas Layanan', state:'Kerangka master', fields:'Unit induk, ruang, kapasitas, lokasi, kelas, status'},
    {label:'Peralatan & Modalitas', page:'rad-modalitas', state:'Tersedia sebagian', fields:'Jenis alat, lokasi, status, jadwal pemeliharaan'},
    {label:'Konfigurasi antrean, loket & layanan', page:'queue-config', state:'Tersedia', fields:'Layanan, prefiks, loket, kuota, prioritas'},
  ]},
  practitioner: { icon:'🩺', title:'Praktisi, Jadwal & Fee', desc:'Dokter, spesialisasi, penjadwalan, cuti, jasa, dan rujukan.', items:[
    {label:'Master praktisi & kredensial', page:'hc-staff', state:'Tersedia sebagian', fields:'Profesi, STR/SIP, kompetensi, unit, masa berlaku'},
    {label:'Spesialisasi Praktisi', state:'Kerangka master', fields:'Kode, nama, kategori klinis, status'},
    {label:'Jasa Praktisi & Fee Rujukan', state:'Kerangka master', fields:'Layanan, penerima fee, nominal/persen, periode berlaku'},
    {label:'Jadwal & cuti praktisi', page:'work-schedule', state:'Tersedia sebagian', fields:'Praktisi, unit, ruang, hari/jam, kuota, pengecualian'},
  ]},
  patient: { icon:'👤', title:'Pasien, Penjamin & Keluarga', desc:'Master identitas pasien dan data administratif pendukung pelayanan.', items:[
    {label:'Registri keluarga & relasi pasien', page:'family', state:'Tersedia', fields:'Kepala keluarga, relasi, kontak darurat, penanggung jawab'},
    {label:'Penjamin, kondisi & alergi', state:'Kerangka master', fields:'Kode, nama, tipe, keterangan, status aktif'},
    {label:'Referensi ICD-10 & ICD-9-CM', state:'Kerangka master', fields:'Kode, deskripsi, versi, jenis, status aktif'},
    {label:'Pendaftaran & admisi', page:'admission', state:'Operasional', fields:'Dijalankan dari Alur Pasien, bukan konfigurasi'},
  ]},
  corporate: { icon:'🏢', title:'Korporat & Kontrak', desc:'Entitas perusahaan, paket, kontrak, dan administrasi penjamin.', items:[
    {label:'Daftar korporat', page:'corporate', state:'Tersedia', fields:'Identitas perusahaan, PIC, alamat, status'},
    {label:'Kontrak & benefit korporat', state:'Kerangka master', fields:'Periode, paket, plafon, tarif, fasilitas, status'},
    {label:'Level & posisi jabatan', state:'Kerangka master', fields:'Kode, nama, urutan, eligibility benefit'},
    {label:'Paket layanan', page:'package', state:'Tersedia', fields:'Kode paket, item, tarif, penjamin, periode'},
  ]},
  mcu: { icon:'🧪', title:'Parameter MCU', desc:'Parameter pemeriksaan kesehatan berkala dan hasil turunannya.', items:[
    {label:'Exposure, hasil, status akhir & rekomendasi', state:'Kerangka master', fields:'Kode, kategori, nilai, interpretasi, status aktif'},
    {label:'Ambang audiometri, spirometri & visus', state:'Kerangka master', fields:'Metode, ambang, klasifikasi, satuan, interpretasi'},
    {label:'Operasional pemeriksaan MCU', page:'mcu', state:'Operasional', fields:'Dijalankan dari Pelayanan Klinis'},
    {label:'Pemeriksaan penunjang', page:'supportive', state:'Operasional sebagian', fields:'Dijalankan dari Pelayanan Klinis'},
  ]},
  payment: { icon:'💳', title:'Bank, EDC & Pembayaran', desc:'Metode bayar, bank, akun, dan mapping transaksi penerimaan.', items:[
    {label:'Bank & terminal EDC', state:'Kerangka master', fields:'Bank, merchant ID, terminal, settlement, MDR, status'},
    {label:'Metode bayar & mapping akun', state:'Kerangka master', fields:'Metode, akun pendapatan/biaya, penerapan, status'},
    {label:'Kasir & penerimaan', page:'cashier', state:'Operasional', fields:'Dijalankan dari Keuangan'},
    {label:'Akuntansi dan jurnal', page:'accounting', state:'Operasional', fields:'Dijalankan dari Keuangan'},
  ]},
  queue: { icon:'🎟️', title:'Flow, Display & Perangkat Antrean', desc:'Alur layanan yang dipakai bersama HIS, kiosk, dan display antrean.', items:[
    {label:'Konfigurasi layanan, loket & kapasitas', page:'queue-config', state:'Tersedia', fields:'Layanan, loket, prefiks, kuota, urutan panggil'},
    {label:'Flow, display & outlet', state:'Kerangka master', fields:'Sumber, tujuan, ruang, display, SLA, prioritas'},
    {label:'Registry kiosk & display', state:'Kerangka master', fields:'Device ID, lokasi, layanan, origin, status, terakhir aktif'},
    {label:'Konsol panggilan', page:'queue-console', state:'Operasional', fields:'Dijalankan dari Alur Pasien'},
    {label:'Kiosk mandiri pasien', page:'queue-kiosk', state:'Operasional', fields:'Dijalankan dari Alur Pasien'},
  ]},
  medicine: { icon:'💊', title:'Master Obat & Aturan Pakai', desc:'Formularium, stok, resep, dan parameter penggunaan obat.', items:[
    {label:'Kategori, bentuk & aturan pakai', state:'Kerangka master', fields:'Kategori, sediaan, aturan, instruksi, waktu konsumsi'},
    {label:'Farmasi & e-prescription', page:'farmasi', state:'Operasional', fields:'Dijalankan dari Pelayanan Klinis'},
  ]},
  promotion: { icon:'🏷️', title:'Deal, Voucher & Diskon', desc:'Aturan promosi layanan yang terpisah dari transaksi kasir.', items:[
    {label:'Master deal, voucher & diskon', state:'Kerangka master', fields:'Kode, target layanan, tipe, nilai, periode, kuota, syarat, status'},
  ]},
  telemedicine: { icon:'📹', title:'Setup Telemedicine', desc:'Konfigurasi koneksi penyedia telekonsultasi.', items:[
    {label:'Provider, jadwal & webhook', state:'Kerangka master', fields:'Provider, fasilitas, jadwal, endpoint, status koneksi'},
    {label:'Booking telekonsultasi', page:'appointments', state:'Operasional', fields:'Dijalankan dari Alur Pasien'},
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
          ${domain.items.map(item => { const masterDomain = CONFIG_MASTER_DOMAIN_BY_LABEL[item.label]; return `<div style="border:1px solid var(--border);border-radius:9px;padding:12px;background:var(--surface,#fff)">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><strong style="font-size:12px;color:var(--navy)">${item.label}</strong><span style="white-space:nowrap;font-size:10px;color:${item.state.includes('Operasional') ? 'var(--amber,#B7791F)' : item.page ? 'var(--teal)' : 'var(--text3)'}">${item.state}</span></div>
            <div style="margin-top:7px;font-size:10.5px;line-height:1.45;color:var(--text3)">${item.fields || 'Field akan dirumuskan bersama pemilik proses.'}</div>
            ${masterDomain ? `<button class="btn btn-teal btn-sm" style="margin-top:10px" onclick="navigate('master-records',{domain:'${masterDomain}'})">Kelola master →</button>` : item.page ? `<button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="navigate('${item.page}')">${item.state.includes('Operasional') ? 'Buka operasional →' : 'Buka konfigurasi →'}</button>` : `<div style="margin-top:10px;font-size:11px;color:var(--text3)">Belum memiliki form domain khusus.</div>`}
          </div>`; }).join('')}
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
      <div><h1>Pengaturan &amp; Master HIS</h1><p>Aturan, master, perangkat, dan integrasi. Transaksi harian tetap berada di menu operasional.</p></div>
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
