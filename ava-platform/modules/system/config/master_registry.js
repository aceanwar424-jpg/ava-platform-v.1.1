// ═══════════════════════════════════════════════════════════════
// MODULE: Registry Master HIS
// Kontrak UI untuk 20 master konfigurasi. Semua data disimpan per-tenant
// melalui RPC agar perubahan dapat diaudit; layar ini tidak menyimpan secret.
// ═══════════════════════════════════════════════════════════════

const MASTER_REGISTRY = {
  branch: {
    icon:'🏢', group:'Fasilitas & Sumber Daya', homeFocus:'facility', approval:true,
    title:'Master Cabang / Plant', desc:'Identitas, lokasi, kontak, dan jam operasional fasilitas.',
    fields:[
      {key:'facility_type', label:'Jenis fasilitas', type:'select', required:true, options:['Klinik','Laboratorium','Rumah Sakit','Kantor Pusat','Mobile Service','Lainnya']},
      {key:'address', label:'Alamat', type:'textarea', required:true},
      {key:'city', label:'Kota / Kabupaten', required:true},
      {key:'contact_phone', label:'Telepon kontak'},
      {key:'operating_hours', label:'Jam operasional', placeholder:'Sen–Jum 08.00–20.00'},
    ]
  },
  unit_room: {
    icon:'🚪', group:'Fasilitas & Sumber Daya', homeFocus:'facility', approval:true,
    title:'Unit, Ruang & Kelas Layanan', desc:'Struktur unit pelayanan, ruang fisik, dan kapasitasnya.',
    fields:[
      {key:'parent_unit_code', label:'Kode unit induk', required:true, placeholder:'Contoh: POLI'},
      {key:'room_type', label:'Jenis unit / ruang', type:'select', required:true, options:['Unit','Ruang Periksa','Ruang Tindakan','Loket','Laboratorium','Ruang Tunggu','Gudang','Lainnya']},
      {key:'service_class', label:'Kelas layanan', type:'select', options:['Reguler','Eksekutif','VIP','MCU','Corporate','Lainnya']},
      {key:'capacity', label:'Kapasitas', type:'number', min:0},
      {key:'location_note', label:'Lokasi / lantai'},
    ]
  },
  equipment: {
    icon:'🩻', group:'Fasilitas & Sumber Daya', homeFocus:'facility', approval:true,
    title:'Peralatan & Modalitas', desc:'Inventaris alat klinis untuk penempatan dan pemeliharaan.',
    fields:[
      {key:'equipment_type', label:'Jenis alat / modalitas', required:true},
      {key:'manufacturer', label:'Pabrikan'},
      {key:'model', label:'Model'},
      {key:'serial_number', label:'Nomor seri'},
      {key:'room_code', label:'Kode ruang penempatan', required:true},
      {key:'maintenance_due', label:'Jadwal pemeliharaan berikutnya', type:'date'},
    ]
  },
  service_capacity: {
    icon:'📊', group:'Fasilitas & Sumber Daya', homeFocus:'facility', approval:true,
    title:'Kelas & Kapasitas Layanan', desc:'Aturan kapasitas layanan dan slot operasional per unit.',
    fields:[
      {key:'service_code', label:'Kode layanan', required:true},
      {key:'service_class', label:'Kelas layanan', required:true},
      {key:'capacity', label:'Kapasitas per slot', type:'number', min:0, required:true},
      {key:'slot_minutes', label:'Durasi slot (menit)', type:'number', min:1},
      {key:'unit_code', label:'Kode unit'},
    ]
  },
  specialty: {
    icon:'🩺', group:'Master Klinis & SDM', homeFocus:'practitioner', approval:false,
    title:'Spesialisasi Praktisi', desc:'Kamus spesialisasi dan kategori tenaga profesional.',
    fields:[
      {key:'category', label:'Kategori profesi', type:'select', required:true, options:['Dokter Umum','Dokter Spesialis','Dokter Gigi','Perawat','Bidan','Tenaga Kesehatan Lain','Non-Klinis']},
      {key:'credential_note', label:'Catatan kredensial'},
    ]
  },
  practitioner_fee: {
    icon:'🤝', group:'Master Klinis & SDM', homeFocus:'practitioner', approval:true,
    title:'Jasa Praktisi & Fee Rujukan', desc:'Aturan jasa praktisi atau fee rujukan dengan periode berlaku.',
    fields:[
      {key:'practitioner_code', label:'Kode praktisi / penerima', required:true},
      {key:'service_code', label:'Kode layanan', required:true},
      {key:'fee_basis', label:'Basis perhitungan', type:'select', required:true, options:['Nominal','Persentase','Per tindakan','Per paket']},
      {key:'fee_amount', label:'Nilai fee', type:'number', min:0, required:true},
      {key:'referrer_code', label:'Kode perujuk (bila ada)'},
    ]
  },
  patient_reference: {
    icon:'👤', group:'Master Klinis & SDM', homeFocus:'patient', approval:false,
    title:'Penjamin, Kondisi & Alergi Pasien', desc:'Referensi administratif dan klinis yang dapat dipilih di registrasi.',
    fields:[
      {key:'reference_type', label:'Jenis referensi', type:'select', required:true, options:['Penjamin','Alergi','Kondisi Klinis','Gelar','Relasi Keluarga','Jenis Identitas','Lainnya']},
      {key:'coverage_type', label:'Tipe cakupan / kategori'},
      {key:'clinical_note', label:'Catatan klinis / administrasi', type:'textarea'},
    ]
  },
  diagnosis_reference: {
    icon:'📚', group:'Master Klinis & SDM', homeFocus:'patient', approval:true,
    title:'Referensi Diagnosis & Prosedur', desc:'Referensi kode diagnosis atau prosedur beserta versi sumbernya.',
    fields:[
      {key:'code_system', label:'Sistem kode', type:'select', required:true, options:['ICD-10','ICD-9-CM','SNOMED CT','LOINC','Lokal']},
      {key:'source_version', label:'Versi referensi', required:true},
      {key:'kind', label:'Jenis', type:'select', required:true, options:['Diagnosis','Prosedur','Temuan','Lainnya']},
      {key:'clinical_note', label:'Catatan penggunaan', type:'textarea'},
    ]
  },
  mcu_parameter: {
    icon:'🧪', group:'Master Klinis & SDM', homeFocus:'mcu', approval:true,
    title:'Parameter & Hasil MCU', desc:'Parameter, satuan, dan aturan interpretasi pemeriksaan MCU.',
    fields:[
      {key:'value_type', label:'Tipe nilai', type:'select', required:true, options:['Numerik','Teks','Pilihan','Boolean']},
      {key:'unit', label:'Satuan'},
      {key:'classification_rule', label:'Aturan klasifikasi', type:'textarea', required:true},
      {key:'source_reference', label:'Referensi acuan'},
    ]
  },
  mcu_threshold: {
    icon:'📈', group:'Master Klinis & SDM', homeFocus:'mcu', approval:true,
    title:'Ambang Audiometri, Spirometri & Visus', desc:'Batas interpretasi sesuai metode, kelompok usia, dan jenis kelamin.',
    fields:[
      {key:'modality', label:'Modalitas', type:'select', required:true, options:['Audiometri','Spirometri','Visus','Lainnya']},
      {key:'method', label:'Metode', required:true},
      {key:'age_group', label:'Kelompok usia'},
      {key:'sex', label:'Jenis kelamin', type:'select', options:['Semua','Laki-laki','Perempuan']},
      {key:'lower_bound', label:'Batas bawah', type:'number'},
      {key:'upper_bound', label:'Batas atas', type:'number'},
      {key:'unit', label:'Satuan'},
      {key:'classification', label:'Klasifikasi', required:true},
    ]
  },
  medicine_reference: {
    icon:'💊', group:'Master Klinis & SDM', homeFocus:'medicine', approval:true,
    title:'Kategori, Bentuk & Aturan Obat', desc:'Kamus formularium untuk resep dan instruksi penggunaan obat.',
    fields:[
      {key:'category', label:'Kategori obat', required:true},
      {key:'dosage_form', label:'Bentuk sediaan', required:true},
      {key:'dose_rule', label:'Aturan dosis'},
      {key:'instruction', label:'Instruksi pasien', type:'textarea'},
      {key:'administration_time', label:'Waktu pemberian', type:'select', options:['Sebelum makan','Sesudah makan','Saat makan','Pagi','Siang','Malam','Sesuai kebutuhan']},
    ]
  },
  corporate_contract: {
    icon:'🏭', group:'Korporat, Keuangan & Promo', homeFocus:'corporate', approval:true,
    title:'Kontrak & Benefit Korporat', desc:'Kontrak layanan korporat; angka transaksi disalin sebagai snapshot saat dipakai.',
    fields:[
      {key:'corporate_code', label:'Kode korporat', required:true},
      {key:'branch_code', label:'Kode cabang'},
      {key:'package_code', label:'Kode paket'},
      {key:'benefit_ceiling', label:'Plafon benefit', type:'number', min:0},
      {key:'payment_terms', label:'Termin pembayaran'},
      {key:'pic_contact', label:'PIC & kontak'},
    ]
  },
  job_master: {
    icon:'💼', group:'Korporat, Keuangan & Promo', homeFocus:'corporate', approval:false,
    title:'Level & Posisi Jabatan', desc:'Master jabatan untuk eligibilitas benefit dan paket MCU korporat.',
    fields:[
      {key:'corporate_code', label:'Kode korporat'},
      {key:'job_level', label:'Level jabatan', required:true},
      {key:'display_order', label:'Urutan tampilan', type:'number', min:0},
      {key:'eligibility_note', label:'Catatan eligibilitas', type:'textarea'},
    ]
  },
  bank_edc: {
    icon:'🏦', group:'Korporat, Keuangan & Promo', homeFocus:'payment', approval:true,
    title:'Bank & Terminal EDC', desc:'Referensi bank/EDC tanpa menyimpan credential atau PIN.',
    fields:[
      {key:'bank_name', label:'Nama bank / acquirer', required:true},
      {key:'merchant_id', label:'Merchant ID', required:true},
      {key:'terminal_id', label:'Terminal ID'},
      {key:'branch_code', label:'Kode cabang'},
      {key:'settlement_account', label:'Akun settlement (masked)'},
      {key:'mdr_percent', label:'MDR (%)', type:'number', min:0},
    ]
  },
  payment_mapping: {
    icon:'💳', group:'Korporat, Keuangan & Promo', homeFocus:'payment', approval:true,
    title:'Mapping Pembayaran ke Akun', desc:'Aturan metode pembayaran menuju akun penerimaan dan biaya.',
    fields:[
      {key:'payment_method', label:'Metode pembayaran', type:'select', required:true, options:['Tunai','Transfer','QRIS','Kartu Debit','Kartu Kredit','Asuransi','Penjamin Korporat','Lainnya']},
      {key:'revenue_account', label:'Akun pendapatan', required:true},
      {key:'fee_account', label:'Akun biaya / MDR'},
      {key:'tax_treatment', label:'Perlakuan pajak'},
    ]
  },
  promotion: {
    icon:'🏷️', group:'Korporat, Keuangan & Promo', homeFocus:'promotion', approval:true,
    title:'Deal, Voucher & Diskon', desc:'Aturan promo yang dikonfirmasi ulang oleh transaksi pada saat penggunaan.',
    fields:[
      {key:'target_type', label:'Jenis target', type:'select', required:true, options:['Layanan','Paket','Produk','Korporat','Semua']},
      {key:'target_code', label:'Kode target'},
      {key:'discount_type', label:'Tipe diskon', type:'select', required:true, options:['Persentase','Nominal','Harga khusus']},
      {key:'discount_value', label:'Nilai diskon', type:'number', min:0, required:true},
      {key:'quota', label:'Kuota penggunaan', type:'number', min:0},
      {key:'eligibility_note', label:'Syarat & ketentuan', type:'textarea'},
    ]
  },
  queue_flow: {
    icon:'🎟️', group:'Antrean & Integrasi', homeFocus:'queue', approval:true,
    title:'Flow, Display & Outlet Antrean', desc:'Aturan langkah antrean yang digunakan bersama konsol dan display.',
    fields:[
      {key:'service_code', label:'Kode layanan', required:true},
      {key:'from_step', label:'Tahap asal', required:true},
      {key:'to_step', label:'Tahap tujuan', required:true},
      {key:'room_code', label:'Kode ruang'},
      {key:'display_code', label:'Kode display / outlet'},
      {key:'priority_policy', label:'Aturan prioritas', type:'textarea'},
    ]
  },
  queue_device: {
    icon:'🖥️', group:'Antrean & Integrasi', homeFocus:'queue', approval:true,
    title:'Registry Kiosk & Display', desc:'Device ID publik; perubahan aktif otomatis disinkronkan ke registry kiosk/display.',
    fields:[
      {key:'device_type', label:'Jenis perangkat', type:'select', required:true, options:['Kiosk','Display','Kiosk + Display']},
      {key:'location_code', label:'Kode lokasi', required:true},
      {key:'kiosk_origin', label:'Origin kiosk', type:'url', placeholder:'https://kiosk.example.com'},
      {key:'display_origin', label:'Origin display', type:'url', placeholder:'https://antrian.example.com'},
      {key:'allowed_services', label:'Layanan diizinkan', type:'textarea', required:true, placeholder:'Pisahkan dengan koma, contoh: Umum, Laboratorium'},
      {key:'max_issues_per_minute', label:'Batas tiket per menit', type:'number', min:1, max:60, required:true},
    ]
  },
  telemedicine: {
    icon:'📹', group:'Antrean & Integrasi', homeFocus:'telemedicine', approval:true,
    title:'Setup Telemedicine', desc:'Metadata koneksi dan jadwal; secret tetap di secret manager, bukan database master.',
    fields:[
      {key:'provider', label:'Penyedia telemedicine', required:true},
      {key:'facility_code', label:'Kode fasilitas'},
      {key:'scheduling_policy', label:'Aturan penjadwalan', type:'textarea'},
      {key:'endpoint', label:'Endpoint / webhook URL', type:'url'},
      {key:'secret_reference', label:'Referensi secret', required:true, referenceOnly:true, placeholder:'vault://telemed/provider-a'},
    ]
  },
  satusehat_setup: {
    icon:'🔗', group:'Antrean & Integrasi', homeFocus:'queue', approval:true,
    title:'SATUSEHAT Setup & Status', desc:'Metadata organisasi dan environment; credential OAuth tidak pernah disimpan di layar ini.',
    fields:[
      {key:'organization_id', label:'FHIR Organization ID', required:true},
      {key:'environment', label:'Environment', type:'select', required:true, options:['Sandbox','Production']},
      {key:'secret_reference', label:'Referensi secret OAuth', required:true, referenceOnly:true, placeholder:'vault://satusehat/oauth'},
      {key:'connection_status', label:'Status koneksi', type:'select', options:['Belum diuji','Uji staging','Siap UAT','Aktif']},
    ]
  },
};

let masterRegistryState = { domain:null, records:[], error:'', query:'', status:'' };

function mrEsc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function mrAttr(value) { return mrEsc(value); }
function mrDefinition(domain) { return MASTER_REGISTRY[domain] || null; }
function mrValue(record, key) { return record?.payload?.[key] ?? ''; }
function mrStatus(status) {
  const map = {active:['Aktif','#DCFCE7','#166534'], draft:['Draft','#FEF3C7','#92400E'], inactive:['Nonaktif','#E5E7EB','#4B5563'], archived:['Diarsipkan','#FEE2E2','#991B1B']};
  const item = map[status] || [status || '—','#F1F5F9','#475569'];
  return `<span style="display:inline-block;padding:3px 7px;border-radius:999px;background:${item[1]};color:${item[2]};font-size:10px;font-weight:800">${item[0]}</span>`;
}
function mrAlert(message, type='info') {
  const colors = {info:['#E0F2FE','#075985'], warn:['#FEF3C7','#92400E'], err:['#FEE2E2','#991B1B']};
  const color = colors[type] || colors.info;
  return `<div style="margin:12px 0;padding:11px 13px;border-radius:9px;background:${color[0]};color:${color[1]};font-size:12px;line-height:1.5">${message}</div>`;
}

async function mrReadRecords(domain) {
  const query = new URLSearchParams({
    select:'id,domain_key,code,name,status,effective_from,effective_to,payload,version,updated_at,updated_by',
    domain_key:`eq.${domain}`,
    order:'updated_at.desc',
  });
  const response = await sbFetch(`${SUPABASE_URL}/rest/v1/his_master_records?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.hint || 'Registry master belum tersedia.');
  return Array.isArray(payload) ? payload : [];
}

async function renderMasterRegistry(domain, targetId='main-content') {
  const definition = mrDefinition(domain);
  const root = document.getElementById(targetId);
  if (!root) return;
  if (!definition) {
    root.innerHTML = `<div class="empty-state"><div class="ico">⚠️</div><h3>Domain master tidak dikenal</h3><button class="btn btn-teal" onclick="navigate('config')">Kembali ke konfigurasi</button></div>`;
    return;
  }
  masterRegistryState = { domain, records:[], error:'', query:'', status:'' };
  root.innerHTML = `<div class="page-header"><div><h1>${definition.icon} ${mrEsc(definition.title)}</h1><p>${mrEsc(definition.desc)}</p></div><div class="btn-row"><button class="btn btn-ghost btn-sm" onclick="navigate('config',{focus:'${definition.homeFocus}'})">← Hub konfigurasi</button><button class="btn btn-teal" onclick="openMasterRecordForm()">+ Tambah master</button></div></div><div class="loading-row"><div class="spinner"></div></div>`;
  try {
    masterRegistryState.records = await mrReadRecords(domain);
  } catch (err) {
    masterRegistryState.error = err.message || 'Gagal membaca master.';
  }
  renderMasterRegistryTable();
}

function renderMasterRegistryTable() {
  const root = document.getElementById('main-content');
  const definition = mrDefinition(masterRegistryState.domain);
  if (!root || !definition) return;
  const all = masterRegistryState.records;
  const term = masterRegistryState.query.toLowerCase();
  const activeFilter = masterRegistryState.status;
  const shown = all.filter(row => (!term || `${row.code} ${row.name}`.toLowerCase().includes(term)) && (!activeFilter || row.status === activeFilter));
  const stat = key => all.filter(row => row.status === key).length;
  const schemaNote = definition.approval ? 'Perubahan pada master ini memerlukan alasan dan dicatat pada jejak audit.' : 'Perubahan tercatat pada jejak audit master.';

  root.innerHTML = `
    <div class="page-header"><div><h1>${definition.icon} ${mrEsc(definition.title)}</h1><p>${mrEsc(definition.desc)}</p></div><div class="btn-row"><button class="btn btn-ghost btn-sm" onclick="navigate('config',{focus:'${definition.homeFocus}'})">← Hub konfigurasi</button><button class="btn btn-teal" onclick="openMasterRecordForm()">+ Tambah master</button></div></div>
    ${mrAlert(`<strong>Kontrak data:</strong> ${schemaNote} ${definition.title.includes('SATUSEHAT') || definition.title.includes('Telemedicine') ? 'Hanya referensi secret yang boleh dicatat, bukan nilai credential.' : ''}`, definition.approval ? 'warn' : 'info')}
    ${masterRegistryState.error ? mrAlert(`<strong>Data belum dapat dibaca.</strong> ${mrEsc(masterRegistryState.error)}<br>Jalankan migrasi <code>0050_his_master_registry.sql</code> di staging sesuai runbook, lalu muat ulang.`, 'err') : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px;margin:14px 0">
      ${[['Total',all.length,'#0A2342'],['Aktif',stat('active'),'#15803D'],['Draft',stat('draft'),'#B45309'],['Nonaktif',stat('inactive'),'#475569']].map(item => `<div class="card" style="padding:10px;border-left:3px solid ${item[2]}"><div style="font-weight:800;font-size:18px;color:${item[2]}">${item[1]}</div><div style="font-size:10px;color:var(--text3)">${item[0]}</div></div>`).join('')}
    </div>
    <div class="table-wrap">
      <div class="table-toolbar"><input class="table-search" value="${mrAttr(masterRegistryState.query)}" oninput="masterRegistryState.query=this.value;renderMasterRegistryTable()" placeholder="Cari kode atau nama..." style="flex:1"><select class="table-filter" onchange="masterRegistryState.status=this.value;renderMasterRegistryTable()"><option value="">Semua status</option><option value="active" ${activeFilter==='active'?'selected':''}>Aktif</option><option value="draft" ${activeFilter==='draft'?'selected':''}>Draft</option><option value="inactive" ${activeFilter==='inactive'?'selected':''}>Nonaktif</option><option value="archived" ${activeFilter==='archived'?'selected':''}>Diarsipkan</option></select><button class="btn btn-ghost btn-sm" onclick="renderMasterRegistry('${masterRegistryState.domain}')">↻ Muat ulang</button></div>
      ${masterRegistryState.error ? '' : (shown.length ? `<table><thead><tr><th>Kode</th><th>Nama</th><th>Status</th><th>Periode berlaku</th><th>Versi</th><th>Diperbarui</th><th>Aksi</th></tr></thead><tbody>${shown.map(row => `<tr><td style="font-family:monospace;font-size:11px;font-weight:800;color:var(--teal)">${mrEsc(row.code)}</td><td><div style="font-weight:700;color:var(--navy)">${mrEsc(row.name)}</div><div style="font-size:10px;color:var(--text3)">${mrEsc(definition.fields.slice(0,2).map(field => mrValue(row, field.key)).filter(Boolean).join(' · ')) || '—'}</div></td><td>${mrStatus(row.status)}</td><td style="font-size:11px">${row.effective_from ? mrEsc(formatDateShort(row.effective_from)) : '—'}${row.effective_to ? ` – ${mrEsc(formatDateShort(row.effective_to))}` : ''}</td><td><span class="badge badge-gray">v${Number(row.version || 1)}</span></td><td style="font-size:10px;color:var(--text3)">${row.updated_at ? mrEsc(formatDateShort(row.updated_at)) : '—'}</td><td><div class="act-row"><button class="act-btn edit" title="Ubah" onclick="openMasterRecordForm(${Number(row.id)})">✎</button><button class="act-btn" title="Jejak audit" onclick="showMasterAudit(${Number(row.id)})">◷</button>${row.status !== 'archived' ? `<button class="act-btn del" title="Arsipkan" onclick="archiveMasterRecord(${Number(row.id)})">×</button>` : ''}</div></td></tr>`).join('')}</tbody></table>` : `<div class="empty-state"><div class="ico">${definition.icon}</div><h3>${all.length ? 'Tidak ada data sesuai filter' : 'Belum ada master'}</h3><p>${all.length ? 'Ubah kata kunci atau status pencarian.' : 'Tambahkan data pertama untuk domain ini.'}</p><button class="btn btn-teal" style="margin-top:10px" onclick="openMasterRecordForm()">+ Tambah master</button></div>`) }
    </div>`;
}

function mrRenderField(field, payload) {
  const value = mrValue({payload}, field.key);
  const required = field.required ? 'required' : '';
  const hint = field.hint ? `<div style="font-size:10px;color:var(--text3);margin-top:3px">${mrEsc(field.hint)}</div>` : '';
  const label = `${mrEsc(field.label)}${field.required ? ' <span style="color:var(--danger)">*</span>' : ''}`;
  if (field.type === 'textarea') return `<label style="grid-column:1/-1"><span>${label}</span><textarea name="${field.key}" rows="2" placeholder="${mrAttr(field.placeholder || '')}">${mrEsc(Array.isArray(value) ? value.join(', ') : value)}</textarea>${hint}</label>`;
  if (field.type === 'select') return `<label><span>${label}</span><select name="${field.key}" ${required}><option value="">— Pilih —</option>${(field.options || []).map(option => `<option value="${mrAttr(option)}" ${String(value)===option?'selected':''}>${mrEsc(option)}</option>`).join('')}</select>${hint}</label>`;
  return `<label><span>${label}</span><input type="${field.type || 'text'}" name="${field.key}" value="${mrAttr(value)}" placeholder="${mrAttr(field.placeholder || '')}" ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} ${required}>${hint}</label>`;
}

function openMasterRecordForm(id=null) {
  const definition = mrDefinition(masterRegistryState.domain);
  if (!definition) return;
  const record = id == null ? null : masterRegistryState.records.find(item => Number(item.id) === Number(id));
  if (id != null && !record) { toast('Data master tidak ditemukan pada daftar ini.', 'err'); return; }
  const payload = record?.payload || {};
  const status = record?.status || 'draft';
  const reasonRequired = definition.approval ? '<span style="color:var(--danger)">*</span>' : '';
  openModal(`
    <div class="modal-head"><div><h2>${record ? 'Ubah' : 'Tambah'} ${mrEsc(definition.title)}</h2><p>${record ? `Versi saat ini v${Number(record.version || 1)}.` : 'Data baru disimpan sebagai draft atau aktif sesuai pilihan.'}</p></div><button class="modal-x" onclick="closeModalForce()">×</button></div>
    <form id="master-registry-form" onsubmit="saveMasterRecord(event,${record ? Number(record.id) : 'null'})">
      <div class="master-registry-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px">
        <label><span>Kode <span style="color:var(--danger)">*</span></span><input name="code" value="${mrAttr(record?.code || '')}" placeholder="HURUF-ANGKA-01" pattern="[A-Za-z0-9][A-Za-z0-9._/-]{0,79}" required ${record ? '' : 'autofocus'}><small>Gunakan huruf/angka serta . _ / -; kode aktif harus unik per tenant.</small></label>
        <label><span>Nama <span style="color:var(--danger)">*</span></span><input name="name" value="${mrAttr(record?.name || '')}" required></label>
        <label><span>Status</span><select name="status"><option value="draft" ${status==='draft'?'selected':''}>Draft</option><option value="active" ${status==='active'?'selected':''}>Aktif</option><option value="inactive" ${status==='inactive'?'selected':''}>Nonaktif</option></select></label>
        <label><span>Berlaku mulai</span><input name="effective_from" type="date" value="${mrAttr(record?.effective_from || '')}"></label>
        <label><span>Berlaku sampai</span><input name="effective_to" type="date" value="${mrAttr(record?.effective_to || '')}"></label>
        <div style="font-size:11px;color:var(--text3);align-self:end;padding-bottom:4px">Periode kosong berarti berlaku sampai ada perubahan atau pengarsipan.</div>
        ${definition.fields.map(field => mrRenderField(field, payload)).join('')}
        <label style="grid-column:1/-1"><span>Alasan perubahan ${reasonRequired}</span><textarea name="reason" rows="2" placeholder="Contoh: Pembaruan keputusan operasional / tiket perubahan"></textarea><small>${definition.approval ? 'Wajib untuk menjaga approval trail pada domain ini.' : 'Opsional, tetapi sangat disarankan untuk audit.'}</small></label>
      </div>
      ${definition.title.includes('Registry Kiosk') ? mrAlert('<strong>Penting:</strong> Kode pada form ini menjadi <em>device ID</em> yang dipakai kiosk/display. ID harus unik lintas tenant; status aktif akan menyinkronkan registry perangkat publik.', 'warn') : ''}
      ${definition.title.includes('SATUSEHAT') || definition.title.includes('Telemedicine') ? mrAlert('<strong>Keamanan:</strong> masukkan hanya referensi <code>vault://...</code>, bukan API key, client secret, token, atau password.', 'warn') : ''}
      <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModalForce()">Batal</button><button class="btn btn-teal" type="submit">${record ? 'Simpan perubahan' : 'Simpan master'}</button></div>
    </form>`, 'modal-lg');
}

function mrNormalizeValue(field, raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (field.key === 'allowed_services') return value.split(',').map(item => item.trim()).filter(Boolean);
  if (field.type === 'number') return Number(value);
  return value;
}

async function saveMasterRecord(event, id=null) {
  event.preventDefault();
  const definition = mrDefinition(masterRegistryState.domain);
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {};
  for (const field of definition.fields) {
    const raw = data.get(field.key);
    const value = mrNormalizeValue(field, raw);
    if (field.required && (value === null || (Array.isArray(value) && !value.length))) { toast(`${field.label} wajib diisi.`, 'warn'); return; }
    if (field.referenceOnly && value && !/^vault:\/\//i.test(String(value))) { toast(`${field.label} harus berupa referensi vault://, bukan credential.`, 'warn'); return; }
    if (value !== null && !(typeof value === 'number' && Number.isNaN(value))) payload[field.key] = value;
  }
  const reason = String(data.get('reason') || '').trim();
  if (definition.approval && !reason) { toast('Alasan perubahan wajib diisi untuk master ini.', 'warn'); return; }
  const start = String(data.get('effective_from') || '');
  const end = String(data.get('effective_to') || '');
  if (start && end && end < start) { toast('Tanggal akhir tidak boleh sebelum tanggal mulai.', 'warn'); return; }
  const submit = form.querySelector('button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'Menyimpan…'; }
  try {
    await sbRpc('his_master_upsert_record', {
      p_id:id, p_domain_key:masterRegistryState.domain, p_code:String(data.get('code') || '').trim(),
      p_name:String(data.get('name') || '').trim(), p_status:String(data.get('status') || 'draft'),
      p_effective_from:start || null, p_effective_to:end || null, p_payload:payload, p_reason:reason || null,
    });
    closeModalForce();
    toast(`Master ${id == null ? 'ditambahkan' : 'diperbarui'} dan tercatat pada audit.`, 'ok');
    await renderMasterRegistry(masterRegistryState.domain);
  } catch (err) {
    toast(err.message || 'Master gagal disimpan.', 'err', 6000);
    if (submit) { submit.disabled = false; submit.textContent = id == null ? 'Simpan master' : 'Simpan perubahan'; }
  }
}

async function archiveMasterRecord(id) {
  const record = masterRegistryState.records.find(item => Number(item.id) === Number(id));
  if (!record) return;
  const reason = window.prompt(`Arsipkan ${record.code} — ${record.name}?\nAlasan pengarsipan wajib diisi:`);
  if (reason === null) return;
  if (!reason.trim()) { toast('Alasan pengarsipan wajib diisi.', 'warn'); return; }
  try {
    await sbRpc('his_master_archive_record', {p_id:Number(id), p_reason:reason.trim()});
    toast('Master diarsipkan; riwayatnya tetap tersedia.', 'ok');
    await renderMasterRegistry(masterRegistryState.domain);
  } catch (err) { toast(err.message || 'Master gagal diarsipkan.', 'err', 6000); }
}

async function showMasterAudit(id) {
  try {
    const query = new URLSearchParams({select:'id,action,reason,before_data,after_data,created_at,actor_user_id', record_id:`eq.${id}`, order:'created_at.desc'});
    const response = await sbFetch(`${SUPABASE_URL}/rest/v1/his_master_audit?${query.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.hint || 'Jejak audit belum tersedia.');
    const rows = Array.isArray(data) ? data : [];
    openModal(`<div class="modal-head"><div><h2>Jejak Audit Master</h2><p>Riwayat ini append-only dan tidak dapat diubah dari UI.</p></div><button class="modal-x" onclick="closeModalForce()">×</button></div><div style="max-height:55vh;overflow:auto">${rows.length ? `<table><thead><tr><th>Waktu</th><th>Aksi</th><th>Alasan</th><th>Perubahan</th></tr></thead><tbody>${rows.map(row => `<tr><td style="font-size:11px">${mrEsc(formatDateShort(row.created_at))}</td><td>${mrEsc(row.action)}</td><td>${mrEsc(row.reason || '—')}</td><td><details><summary style="cursor:pointer;font-size:11px">Lihat snapshot</summary><pre style="max-width:330px;white-space:pre-wrap;font-size:10px;background:var(--bg);padding:7px;border-radius:6px">${mrEsc(JSON.stringify({sebelum:row.before_data,sesudah:row.after_data}, null, 2))}</pre></details></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><h3>Belum ada jejak audit</h3></div>'}</div><div class="modal-actions"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'modal-lg');
  } catch (err) { toast(err.message || 'Jejak audit gagal dimuat.', 'err', 6000); }
}

window.renderMasterRegistry = renderMasterRegistry;
window.openMasterRecordForm = openMasterRecordForm;
window.saveMasterRecord = saveMasterRecord;
window.archiveMasterRecord = archiveMasterRecord;
window.showMasterAudit = showMasterAudit;
