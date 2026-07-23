// ═══════════════════════════════════════════════════════
// MODULE: Import Excel — Config Master
// Tables: products, packages, corporates, 
//         corporate_employees, partners, ref_ranges
// Uses: SheetJS (XLSX) via CDN — loaded on demand
// ═══════════════════════════════════════════════════════

// ── Template Definitions ──────────────────────────────
const IMPORT_TEMPLATES = {

  products: {
    label: 'Produk / Pemeriksaan Lab',
    table: 'products',
    icon: '🧬',
    sheet: 'Products',
    upsertKey: 'kode_internal',
    columns: [
      { key: 'kode_internal',    header: 'Kode Internal *',    required: true,  example: 'HEM-001'         },
      { key: 'nama_tes',         header: 'Nama Tes *',          required: true,  example: 'Hemoglobin'      },
      { key: 'kategori',         header: 'Kategori *',          required: true,  example: 'Hematologi', note:'Hematologi|Kimia Klinik|Imunologi|Urinalisis|Mikrobiologi|Serologi|Hormon|Lainnya' },
      { key: 'sub_kategori',     header: 'Sub Kategori',        required: false, example: 'Darah Lengkap'   },
      { key: 'sampel_type',      header: 'Jenis Sampel',        required: false, example: 'Darah Vena', note:'Darah Vena|Darah Kapiler|Urine|Feses|Swab|Lainnya' },
      { key: 'volume_sampel',    header: 'Volume Sampel',       required: false, example: '3 mL'            },
      { key: 'satuan_hasil',     header: 'Satuan Hasil',        required: false, example: 'g/dL'            },
      { key: 'metode',           header: 'Metode',              required: false, example: 'Fotometri'       },
      { key: 'waktu_tat_jam',    header: 'TAT (Jam)',           required: false, example: '4', type:'number'},
      { key: 'harga_normal',     header: 'Harga Normal (Rp) *', required: true, example: '50000', type:'number' },
      { key: 'harga_korporat',   header: 'Harga Korporat (Rp)',required: false, example: '40000', type:'number' },
      { key: 'hpp',              header: 'HPP (Rp)',            required: false, example: '15000', type:'number' },
      { key: 'kode_material',    header: 'Kode Material',       required: false, example: 'MAT-001'         },
      { key: 'loinc_code',       header: 'LOINC Code',          required: false, example: '718-7'           },
      { key: 'host_code',        header: 'Host Code (alat)',    required: false, example: 'CBC5'            },
      { key: 'keterangan',       header: 'Keterangan',          required: false, example: 'Puasa 8 jam'     },
      { key: 'is_active',        header: 'Status Aktif',        required: false, example: 'true', note:'true|false' },
    ]
  },

  packages: {
    label: 'Paket MCU / Service',
    table: 'packages',
    icon: '🗂️',
    sheet: 'Packages',
    upsertKey: 'kode_paket',
    columns: [
      { key: 'kode_paket',       header: 'Kode Paket *',         required: true,  example: 'PKT-MCU-001'    },
      { key: 'nama_paket',       header: 'Nama Paket *',         required: true,  example: 'MCU Basic'      },
      { key: 'kategori_paket',   header: 'Kategori *',           required: true,  example: 'MCU', note:'MCU|HealthDay|Screening|Vaksinasi|Wellness|Lainnya' },
      { key: 'target_segment',   header: 'Target Segment',       required: false, example: 'Korporat', note:'Korporat|Personal|BPJS|Umum' },
      { key: 'harga_normal',     header: 'Harga Normal (Rp) *',  required: true,  example: '500000', type:'number' },
      { key: 'harga_korporat',   header: 'Harga Korporat (Rp)', required: false, example: '400000', type:'number' },
      { key: 'hpp_total',        header: 'HPP Total (Rp)',       required: false, example: '150000', type:'number' },
      { key: 'tat_jam',          header: 'TAT (Jam)',            required: false, example: '4', type:'number'     },
      { key: 'deskripsi',        header: 'Deskripsi',            required: false, example: 'Paket pemeriksaan dasar' },
      { key: 'persiapan',        header: 'Persiapan Pasien',     required: false, example: 'Puasa 10 jam'    },
      { key: 'is_active',        header: 'Status Aktif',         required: false, example: 'true', note:'true|false' },
    ]
  },

  corporates: {
    label: 'Data Corporate',
    table: 'corporates',
    icon: '🏢',
    sheet: 'Corporates',
    upsertKey: 'kode_corp',
    columns: [
      { key: 'kode_corp',        header: 'Kode Corporate *',     required: true,  example: 'CORP-001'       },
      { key: 'corporate_name',   header: 'Nama Corporate *',     required: true,  example: 'PT Maju Bersama'},
      { key: 'industry',         header: 'Industri',             required: false, example: 'Manufaktur'     },
      { key: 'pic_name',         header: 'Nama PIC',             required: false, example: 'Budi Santoso'   },
      { key: 'pic_phone',        header: 'No HP PIC',            required: false, example: '08123456789'    },
      { key: 'pic_email',        header: 'Email PIC',            required: false, example: 'budi@maju.co.id'},
      { key: 'billing_type',     header: 'Tipe Billing',         required: false, example: 'Invoice Bulanan', note:'Tunai|Invoice Bulanan|Invoice 2 Minggu|Prepaid' },
      { key: 'payment_terms',    header: 'Tenor Bayar (Hari)',   required: false, example: '30', type:'number' },
      { key: 'credit_limit',     header: 'Credit Limit (Rp)',    required: false, example: '10000000', type:'number' },
      { key: 'discount_type',    header: 'Tipe Diskon',          required: false, example: 'Persen', note:'Persen|Nominal' },
      { key: 'discount_value',   header: 'Nilai Diskon',         required: false, example: '10', type:'number' },
      { key: 'status',           header: 'Status',               required: false, example: 'Aktif', note:'Aktif|Non-Aktif|Prospek' },
    ]
  },

  corporate_employees: {
    label: 'Karyawan Corporate',
    table: 'corporate_employees',
    icon: '',
    sheet: 'Employees',
    upsertKey: null,
    note: '⚠️ Kolom kode_corp wajib ada dan harus cocok dengan data corporate yang sudah ada.',
    columns: [
      { key: '_kode_corp',       header: 'Kode Corporate *',     required: true,  example: 'CORP-001', note:'Harus ada di tabel corporate' },
      { key: 'employee_id',      header: 'NIK / ID Karyawan',    required: false, example: '12345'          },
      { key: 'full_name',        header: 'Nama Karyawan *',      required: true,  example: 'Siti Aminah'    },
      { key: 'department',       header: 'Departemen',           required: false, example: 'HRD'            },
      { key: 'gender',           header: 'Jenis Kelamin',        required: false, example: 'Perempuan', note:'Laki-laki|Perempuan' },
      { key: 'birth_date',       header: 'Tanggal Lahir',        required: false, example: '1990-05-20'     },
      { key: 'phone',            header: 'No HP',                required: false, example: '081234567'       },
      { key: 'email',            header: 'Email',                required: false, example: 'siti@company.com'},
      { key: 'status',           header: 'Status',               required: false, example: 'Aktif', note:'Aktif|Non-Aktif' },
    ]
  },

  partners: {
    label: 'Partner / Mitra',
    table: 'partners',
    icon: '',
    sheet: 'Partners',
    upsertKey: null,
    columns: [
      { key: 'partner_name',     header: 'Nama Partner *',       required: true,  example: 'Apotek Sehat'   },
      { key: 'category',         header: 'Kategori *',           required: true,  example: 'Apotek', note:'Apotek|Klinik Pratama|Klinik Utama|Dokter Praktik|Dokter Spesialis|Puskesmas|Rumah Sakit|Perusahaan SME|Komunitas|Sekolah / Kampus|Gym & Sport Club|Lainnya' },
      { key: 'pic_name',         header: 'Nama PIC',             required: false, example: 'dr. Andi'       },
      { key: 'phone',            header: 'No HP',                required: false, example: '081234567'       },
      { key: 'email',            header: 'Email',                required: false, example: 'andi@apotek.com' },
      { key: 'address',          header: 'Alamat',               required: false, example: 'Jl. Sudirman No.1'},
      { key: 'status',           header: 'Status Pipeline',      required: false, example: 'Prospect', note:'Prospect|Dihubungi|Meeting|Proposal Dikirim|MOU|Aktif|Tidak Berminat' },
      { key: 'assigned_name',    header: 'Sales PIC',            required: false, example: 'Budi'           },
      { key: 'notes',            header: 'Catatan',              required: false, example: 'Kontak via referral' },
    ]
  },

  product_items: {
    label: 'Code Item / Analit (per tes)',
    table: 'product_items',
    icon: '',
    sheet: 'CodeItems',
    upsertKey: null,
    special: 'product_items',
    note: '⚠️ Kolom "Kode Tes Induk" wajib cocok dengan kode_internal tes yang sudah ada. Baris dengan (tes+code) sama akan di-update.',
    columns: [
      { key: '_kode_internal', header: 'Kode Tes Induk *', required: true,  example: 'OL-HEM-001', note:'kode_internal tes yang sudah ada' },
      { key: 'code',           header: 'Code Item *',      required: true,  example: 'RBC' },
      { key: 'name_id',        header: 'Nama Analit *',    required: true,  example: 'Eritrosit' },
      { key: 'uom',            header: 'Satuan',           required: false, example: '10^6/µL' },
      { key: 'result_type',    header: 'Tipe Hasil',       required: false, example: 'numeric', note:'numeric|text|select' },
      { key: 'loinc_code',     header: 'LOINC',            required: false, example: '789-8' },
      { key: 'ref_low',        header: 'Normal Bawah',     required: false, example: '4.5', type:'number' },
      { key: 'ref_high',       header: 'Normal Atas',      required: false, example: '5.9', type:'number' },
      { key: 'ref_text',       header: 'Rujukan Teks',     required: false, example: 'Negatif' },
      { key: 'specimen_type',  header: 'Specimen',         required: false, example: 'BLOOD, WHOLE', note:'BLOOD, WHOLE|BLOOD, SERUM|BLOOD, PLASMA|URINE|STOOL/FECES|SWAB, NASOPHARYNGEAL|SWAB, THROAT|SPUTUM|SALIVA|CSF|TISSUE|OTHER' },
      { key: 'host_code',      header: 'Host Code',        required: false, example: '731' },
      { key: 'display_order',  header: 'Urutan',           required: false, example: '1', type:'number' },
      { key: 'is_active',      header: 'Status Aktif',     required: false, example: 'true', note:'true|false' },
    ]
  },

  ref_ranges: {
    label: 'Reference Range / Nilai Rujukan',
    table: 'ref_ranges',
    icon: '',
    sheet: 'RefRanges',
    upsertKey: null,
    special: 'ref_ranges',
    note: '⚠️ "Kode Tes" wajib cocok dengan tes yang ada. Untuk panel, isi "Code Item" agar range menempel ke analit tertentu. Numerik → isi Min/Maks; Kualitatif → isi "Nilai Kualitatif".',
    columns: [
      { key: '_kode_internal',  header: 'Kode Tes *',      required: true,  example: 'OL-CHE-001', note:'kode_internal tes' },
      { key: '_item_code',      header: 'Code Item',       required: false, example: '', note:'kosongkan jika tes tunggal' },
      { key: 'condition_name',  header: 'Nama Kondisi *',  required: true,  example: 'Normal' },
      { key: 'condition_type',  header: 'Tipe Kondisi',    required: false, example: 'normal', note:'normal|risk|critical' },
      { key: 'value_type',      header: 'Tipe Nilai',      required: false, example: 'numeric', note:'numeric|qualitative' },
      { key: 'gender',          header: 'Gender',          required: false, example: 'All', note:'All|M|F' },
      { key: 'age_min',         header: 'Usia Min',        required: false, example: '0', type:'number' },
      { key: 'age_max',         header: 'Usia Maks',       required: false, example: '999', type:'number' },
      { key: 'range_min',       header: 'Nilai Min',       required: false, example: '70', type:'number' },
      { key: 'range_max',       header: 'Nilai Maks',      required: false, example: '99', type:'number' },
      { key: 'unit',            header: 'Unit',            required: false, example: 'mg/dL' },
      { key: 'critical_low',    header: 'Kritis Bawah',    required: false, example: '40', type:'number' },
      { key: 'critical_high',   header: 'Kritis Atas',     required: false, example: '500', type:'number' },
      { key: 'expected_values', header: 'Nilai Kualitatif',required: false, example: '', note:'utk qualitative: "Negatif,Neg"' },
      { key: 'color_code',      header: 'Warna',           required: false, example: 'green', note:'green|yellow|orange|red' },
      { key: 'interpretation',  header: 'Interpretasi',    required: false, example: 'Normal' },
      { key: 'description',     header: 'Deskripsi',       required: false, example: '' },
      { key: 'recommendation',  header: 'Rekomendasi',     required: false, example: '' },
    ]
  },

  families: {
    label: 'Family Registry (Keluarga)',
    table: 'families',
    icon: '👨‍👩‍👧',
    sheet: 'Families',
    upsertKey: 'family_code',
    columns: [
      { key: 'family_code',    header: 'Kode Keluarga *', required: true,  example: 'FAM-0001' },
      { key: 'family_name',    header: 'Nama Keluarga *', required: true,  example: 'Keluarga Budi' },
      { key: 'pic_name',       header: 'PIC / Kepala',    required: false, example: 'Budi Santoso' },
      { key: 'pic_phone',      header: 'No HP PIC',       required: false, example: '08123456789' },
      { key: 'discount_type',  header: 'Tipe Diskon',     required: false, example: 'percent', note:'percent|fixed' },
      { key: 'discount_value', header: 'Nilai Diskon',    required: false, example: '10', type:'number' },
      { key: 'membership_no',  header: 'No Membership',   required: false, example: '' },
      { key: 'valid_until',    header: 'Berlaku s/d',     required: false, example: '2027-12-31', type:'date' },
      { key: 'status',         header: 'Status',          required: false, example: 'Aktif', note:'Aktif|Non-Aktif' },
    ]
  },

  analyzers: {
    label: 'Analyzer / Alat Lab',
    table: 'analyzers',
    icon: '🎛️',
    sheet: 'Analyzers',
    upsertKey: 'kode_alat',
    skipCreatedBy: true,
    columns: [
      { key: 'kode_alat',     header: 'Kode Alat *',    required: true,  example: 'ANZ-001' },
      { key: 'nama_alat',     header: 'Nama Alat *',    required: true,  example: 'Sysmex XN-550' },
      { key: 'merk',          header: 'Merk',           required: false, example: 'Sysmex' },
      { key: 'model',         header: 'Model',          required: false, example: 'XN-550' },
      { key: 'serial_number', header: 'Serial Number',  required: false, example: '' },
      { key: 'kategori',      header: 'Kategori',       required: false, example: 'Hematology', note:'Hematology|Chemistry|Immunology|Urinalysis|Coagulation|Lainnya' },
      { key: 'lokasi',        header: 'Lokasi',         required: false, example: 'Lab Utama' },
      { key: 'status',        header: 'Status',         required: false, example: 'Aktif', note:'Aktif|Maintenance|Rusak' },
      { key: 'kalibrasi_berikutnya', header: 'Kalibrasi Berikutnya', required: false, example: '2026-12-01', type:'date' },
      { key: 'integrasi_aktif',      header: 'Integrasi Aktif',      required: false, example: 'false', type:'boolean', note:'true|false' },
      { key: 'integrasi_protocol',   header: 'Protokol Integrasi',   required: false, example: 'HL7', note:'HL7|ASTM|POCT' },
    ]
  },
};

// ── Main Render ───────────────────────────────────────
function renderImportExcel() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Bulk Upload — Config Master</h1>
        <p>Upload massal semua master data (tes, code item, ref range, paket, korporat, keluarga, alat). Download template (CSV) dulu, isi, lalu upload.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="downloadAllTemplates()">⬇️ Semua Template (XLSX)</button>
      </div>
    </div>

    <!-- Template cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:24px">
      ${Object.entries(IMPORT_TEMPLATES).map(([key, tpl]) => `
        <div class="card" style="border-top:3px solid var(--teal)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <span style="font-size:26px">${tpl.icon}</span>
            <div>
              <div style="font-weight:800;font-size:14px;color:var(--text)">${tpl.label}</div>
              <div style="font-size:11px;color:var(--text3)">${tpl.columns.length} kolom · tabel: <code>${tpl.table}</code></div>
            </div>
          </div>
          ${tpl.note ? `<div class="status-box status-warn" style="margin-bottom:10px;font-size:12px">${tpl.note}</div>` : ''}
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline btn-sm" style="flex:1" onclick="downloadTemplate('${key}')">
              ⬇️ Download Template
            </button>
            <button class="btn btn-teal btn-sm" style="flex:1" onclick="openImportModal('${key}')">
              ⬆️ Import Excel
            </button>
          </div>
        </div>`).join('')}
    </div>

    <!-- Import Log -->
    <div class="card">
      <div class="card-title" style="margin-bottom:12px">Log Import</div>
      <div id="import-log">
        <div class="empty-state" style="padding:30px">
          <div class="ico" style="font-size:36px"></div>
          <p>Belum ada aktivitas import. Upload file Excel untuk mulai.</p>
        </div>
      </div>
    </div>`;
}

// ── Download Template ─────────────────────────────────
// Download template sebagai CSV (tanpa dependensi — bisa dibuka di Excel/Sheets).
function downloadTemplate(key) {
  const tpl = IMPORT_TEMPLATES[key];
  if (!tpl) return;
  const esc = v => `"${String(v==null?'':v).replace(/"/g,'""')}"`;
  const headers  = tpl.columns.map(c => c.header);
  const examples = tpl.columns.map(c => c.example || '');
  const notes    = tpl.columns.map(c => c.note ? `pilihan: ${c.note}` : (c.required?'WAJIB':''));

  const csv = [
    headers.map(esc).join(','),
    examples.map(esc).join(','),
    notes.map(esc).join(','),
  ].join('\r\n');

  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `template_${key}_onelab.csv`;
  a.click();
  toast(`✅ Template ${tpl.label} (CSV) didownload`, 'ok');
}

// Versi XLSX (opsional) — butuh SheetJS
function downloadTemplateXLSX(key) {
  const tpl = IMPORT_TEMPLATES[key]; if (!tpl) return;
  const headers  = tpl.columns.map(c => c.header);
  const examples = tpl.columns.map(c => c.example || '');
  const notes    = tpl.columns.map(c => c.note ? `[${c.note}]` : '');
  if (typeof XLSX !== 'undefined') _downloadXLSX(key, tpl, headers, examples, notes);
  else loadSheetJS(() => _downloadXLSX(key, tpl, headers, examples, notes));
}

// Normalisasi nilai tanggal → 'YYYY-MM-DD' (Date object dari XLSX atau teks)
function _toDateStr(v) {
  if (v instanceof Date && !isNaN(v)) {
    const tz = v.getTimezoneOffset()*60000;
    return new Date(v.getTime()-tz).toISOString().slice(0,10);
  }
  const s = String(v).trim();
  return s || null;
}

function _downloadXLSX(key, tpl, headers, examples, notes) {
  const wb = XLSX.utils.book_new();

  // Main data sheet
  const wsData = [
    headers,       // Row 1: headers (bold via styling not supported in free XLSX)
    examples,      // Row 2: example data
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = tpl.columns.map(c => ({ wch: Math.max(c.header.length + 4, 18) }));

  XLSX.utils.book_append_sheet(wb, ws, tpl.sheet);

  // Info sheet with column descriptions
  const infoData = [
    ['PANDUAN PENGISIAN', '', '', ''],
    ['', '', '', ''],
    ['Kolom', 'Wajib?', 'Contoh', 'Catatan / Pilihan'],
    ...tpl.columns.map(c => [
      c.header.replace(' *', ''),
      c.required ? 'WAJIB ✓' : 'Opsional',
      c.example || '',
      c.note || '',
    ]),
    ['', '', '', ''],
    ['CATATAN PENTING:', '', '', ''],
    ['- Baris pertama adalah header, JANGAN dihapus', '', '', ''],
    ['- Baris kedua adalah contoh, bisa dihapus', '', '', ''],
    ['- Kolom bertanda * adalah wajib diisi', '', '', ''],
    ['- Format tanggal: YYYY-MM-DD (contoh: 1990-05-20)', '', '', ''],
    ['- Angka tidak perlu format Rp atau titik pemisah', '', '', ''],
    ...(tpl.note ? [['', '', '', ''], [tpl.note, '', '', '']] : []),
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 25 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Panduan');

  XLSX.writeFile(wb, `template_${key}_onelab.xlsx`);
  toast(`✅ Template ${tpl.label} didownload`, 'ok');
}

function downloadAllTemplates() {
  if (typeof XLSX === 'undefined') {
    loadSheetJS(() => _downloadAllXLSX());
  } else {
    _downloadAllXLSX();
  }
}

function _downloadAllXLSX() {
  const wb = XLSX.utils.book_new();
  Object.entries(IMPORT_TEMPLATES).forEach(([key, tpl]) => {
    const headers  = tpl.columns.map(c => c.header);
    const examples = tpl.columns.map(c => c.example || '');
    const ws = XLSX.utils.aoa_to_sheet([headers, examples]);
    ws['!cols'] = tpl.columns.map(c => ({ wch: Math.max(c.header.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, ws, tpl.sheet);
  });

  // Master info sheet
  const info = [
    ['OneLab Growth Platform — Master Template Import'],
    ['Download tanggal: ' + new Date().toLocaleDateString('id-ID')],
    [''],
    ['Sheet', 'Data', 'Tabel Supabase'],
    ...Object.entries(IMPORT_TEMPLATES).map(([k, t]) => [t.sheet, t.label, t.table]),
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'README');

  XLSX.writeFile(wb, 'onelab_master_template.xlsx');
  toast('✅ Semua template didownload dalam 1 file', 'ok');
}

// ── Open Import Modal ─────────────────────────────────
function openImportModal(key) {
  const tpl = IMPORT_TEMPLATES[key];
  if (!tpl) return;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${tpl.icon} Import ${tpl.label}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>

    <div class="status-box status-warn" style="margin-bottom:16px;font-size:13px">
      ⚠️ Pastikan format file sesuai template. Kolom header harus persis sama.
      ${tpl.upsertKey ? `Data dengan <strong>${tpl.upsertKey}</strong> yang sama akan di-UPDATE, bukan duplikat.` : 'Data baru akan ditambahkan (tidak ada upsert).'}
    </div>

    <div class="form-group">
      <label>Upload File Excel (.xlsx / .xls / .csv)</label>
      <div class="upload-area" id="import-dropzone"
        ondragover="event.preventDefault();this.style.borderColor='var(--teal)'"
        ondragleave="this.style.borderColor=''"
        ondrop="handleImportDrop(event,'${key}')">
        <div style="font-size:32px;margin-bottom:8px">📂</div>
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">Drag & drop file di sini</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:12px">atau klik untuk pilih file</div>
        <input type="file" id="import-file-${key}" accept=".xlsx,.xls,.csv"
          style="display:none" onchange="handleImportFile(this,'${key}')">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('import-file-${key}').click()">
          📁 Pilih File
        </button>
      </div>
    </div>

    <!-- Preview area -->
    <div id="import-preview-${key}" style="display:none">
      <div class="section-label" style="margin-bottom:10px">Preview Data</div>
      <div id="import-preview-table-${key}" style="overflow-x:auto;max-height:300px;overflow-y:auto"></div>
      <div id="import-stats-${key}" style="margin-top:10px;font-size:13px;color:var(--text3)"></div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-outline btn-sm" onclick="downloadTemplate('${key}')">⬇️ Download Template</button>
      <button class="btn btn-teal" id="btn-do-import-${key}" style="display:none"
        onclick="doImport('${key}')">⬆️ Import Sekarang</button>
    </div>`);
}

// ── File Handling ─────────────────────────────────────
function handleImportDrop(event, key) {
  event.preventDefault();
  document.getElementById('import-dropzone').style.borderColor = '';
  const file = event.dataTransfer.files[0];
  if (file) processImportFile(file, key);
}

function handleImportFile(input, key) {
  const file = input.files[0];
  if (file) processImportFile(file, key);
}

let importParsedData = {};

function processImportFile(file, key) {
  const tpl = IMPORT_TEMPLATES[key];
  toast('Membaca file...', 'info', 1500);

  if (typeof XLSX === 'undefined') {
    loadSheetJS(() => _parseFile(file, key, tpl));
  } else {
    _parseFile(file, key, tpl);
  }
}

function _parseFile(file, key, tpl) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!rows.length) { toast('File kosong', 'err'); return; }

      // Find header row (first non-empty row)
      const headerRow = rows[0].map(h => String(h).trim());
      const dataRows  = rows.slice(1).filter(r => r.some(c => c !== ''));

      // Map headers to column keys
      const colMap = {};
      tpl.columns.forEach(col => {
        const cleanHeader = col.header.replace(' *', '').trim();
        const idx = headerRow.findIndex(h =>
          h.replace(' *','').trim().toLowerCase() === cleanHeader.toLowerCase()
        );
        if (idx !== -1) colMap[col.key] = idx;
      });

      // Check required columns
      const missing = tpl.columns.filter(c => c.required && colMap[c.key] === undefined).map(c => c.header);
      if (missing.length) {
        toast(`❌ Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'err', 5000);
        return;
      }

      // Parse rows into objects
      const parsed = dataRows.map((row, i) => {
        const obj = { _row: i + 2 };
        tpl.columns.forEach(col => {
          const idx = colMap[col.key];
          if (idx === undefined) { obj[col.key] = null; return; }
          let val = row[idx];
          if (val === '' || val === null || val === undefined) { obj[col.key] = null; return; }
          if (col.type === 'number') val = parseFloat(String(val).replace(/[^0-9.-]/g,'')) || 0;
          else if (col.type === 'boolean' || col.key === 'is_active') {
            const s = String(val).toLowerCase();
            val = s === 'true' || s === 'ya' || s === '1' || val === 1;
          }
          else if (col.type === 'date') val = _toDateStr(val);
          else val = String(val).trim();
          obj[col.key] = val;
        });
        return obj;
      }).filter(r => tpl.columns.filter(c => c.required).every(c => r[c.key]));

      importParsedData[key] = parsed;

      // Show preview
      showImportPreview(key, tpl, parsed, headerRow, colMap);

    } catch (err) {
      toast('❌ Gagal membaca file: ' + err.message, 'err', 5000);
    }
  };
  reader.readAsArrayBuffer(file);
}

function showImportPreview(key, tpl, parsed, headerRow, colMap) {
  const previewEl = document.getElementById(`import-preview-${key}`);
  const tableEl   = document.getElementById(`import-preview-table-${key}`);
  const statsEl   = document.getElementById(`import-stats-${key}`);
  const btnEl     = document.getElementById(`btn-do-import-${key}`);

  if (!previewEl) return;
  previewEl.style.display = '';

  const displayCols = tpl.columns.filter(c => colMap[c.key] !== undefined);
  const previewRows = parsed.slice(0, 5);

  tableEl.innerHTML = `
    <table style="min-width:100%">
      <thead>
        <tr>
          <th style="padding:8px 10px;background:var(--navy);color:#fff;font-size:11px">#</th>
          ${displayCols.map(c => `<th style="padding:8px 10px;background:var(--navy);color:#fff;font-size:11px;white-space:nowrap">${c.header.replace(' *','')}</th>`).join('')}
          <th style="padding:8px 10px;background:var(--navy);color:#fff;font-size:11px">Status</th>
        </tr>
      </thead>
      <tbody>
        ${previewRows.map((row, i) => `
          <tr style="background:${i%2?'var(--bg2)':'#fff'}">
            <td style="padding:7px 10px;font-size:12px;color:var(--text3)">${row._row}</td>
            ${displayCols.map(c => `<td style="padding:7px 10px;font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${row[c.key]??''}">${row[c.key]??'<span style="color:#ccc">—</span>'}</td>`).join('')}
            <td style="padding:7px 10px"><span class="badge badge-green">✓ Siap</span></td>
          </tr>`).join('')}
        ${parsed.length > 5 ? `<tr><td colspan="${displayCols.length+2}" style="padding:8px;text-align:center;font-size:12px;color:var(--text3)">... dan ${parsed.length-5} baris lainnya</td></tr>` : ''}
      </tbody>
    </table>`;

  statsEl.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <span>Total baris valid: <strong>${parsed.length}</strong></span>
      <span>Kolom terbaca: <strong>${Object.keys(colMap).length}/${tpl.columns.length}</strong></span>
      ${tpl.upsertKey ? `<span style="color:var(--teal)">Mode: Upsert (update jika ${tpl.upsertKey} sama)</span>` : `<span style="color:var(--accent)">+ Mode: Insert (tambah semua)</span>`}
    </div>`;

  if (btnEl) btnEl.style.display = parsed.length ? '' : 'none';
}

// ── Do Import ─────────────────────────────────────────
async function doImport(key) {
  const tpl    = IMPORT_TEMPLATES[key];
  const parsed = importParsedData[key];
  if (!parsed?.length) { toast('Tidak ada data untuk diimport', 'warn'); return; }

  const btn = document.getElementById(`btn-do-import-${key}`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengimport...'; }

  let ok = 0, err = 0, errMsgs = [];
  const user = getUserName ? getUserName() : 'User';

  try {
    // Handler khusus yang butuh lookup relasi (product/kode induk)
    if (key === 'corporate_employees') {
      await _importCorpEmployees(parsed, user, (o, e, m) => { ok=o; err=e; errMsgs=m; });
    } else if (tpl.special === 'product_items') {
      await _importProductItems(parsed, (o, e, m) => { ok=o; err=e; errMsgs=m; });
    } else if (tpl.special === 'ref_ranges') {
      await _importRefRanges(parsed, (o, e, m) => { ok=o; err=e; errMsgs=m; });
    } else {
      for (const row of parsed) {
        try {
          const payload = {};
          tpl.columns.forEach(col => {
            if (!col.key.startsWith('_')) {
              payload[col.key] = row[col.key];
            }
          });
          payload.updated_at = new Date().toISOString();
          if (!tpl.skipCreatedBy && !payload.created_by) payload.created_by = user;

          if (tpl.upsertKey && payload[tpl.upsertKey]) {
            // Check if exists
            const existing = await sbGet(tpl.table, `select=id&${tpl.upsertKey}=eq.${encodeURIComponent(payload[tpl.upsertKey])}`).catch(()=>[]);
            if (existing?.length) {
              await sbPatch(tpl.table, existing[0].id, payload);
            } else {
              await sbPost(tpl.table, payload);
            }
          } else {
            await sbPost(tpl.table, payload);
          }
          ok++;
        } catch(e) {
          err++;
          errMsgs.push(`Baris ${row._row}: ${e.message}`);
        }
      }
    }
  } catch(e) {
    toast('❌ ' + e.message, 'err');
  }

  // Log result
  _addImportLog(key, tpl, ok, err, errMsgs);
  closeModalForce();

  // Reload relevant module
  const reloadMap = {
    products:      ()=>{ if(typeof loadProducts==='function' && document.getElementById('prod-tbody')) loadProducts(); },
    product_items: ()=>{ if(typeof loadProducts==='function' && document.getElementById('prod-tbody')) loadProducts(); },
    ref_ranges:    ()=>{ if(typeof loadRefRanges==='function' && document.getElementById('rr-tbody')) loadRefRanges(); },
    packages:      ()=>{ if(typeof loadPackages==='function') loadPackages(); },
    corporates:    ()=>{ if(typeof loadCorporates==='function') loadCorporates(); },
    families:      ()=>{ if(typeof loadFamilies==='function' && document.getElementById('fam-list')) loadFamilies(); },
    partners:      ()=>{ if(typeof loadPartners==='function') loadPartners(); },
  };
  if (reloadMap[key]) reloadMap[key]();

  toast(`✅ Import selesai: ${ok} berhasil, ${err} gagal`, err ? 'warn' : 'ok', 4000);
}

async function _importCorpEmployees(parsed, user, callback) {
  let ok = 0, err = 0, errMsgs = [];

  // Build corp code → id map
  const corps = await sbGet('corporates','select=id,kode_corp').catch(()=>[]);
  const corpMap = {};
  (corps||[]).forEach(c => corpMap[c.kode_corp] = c.id);

  for (const row of parsed) {
    try {
      const corpId = corpMap[row['_kode_corp']];
      if (!corpId) throw new Error(`Kode corporate "${row['_kode_corp']}" tidak ditemukan`);

      const payload = {
        corporate_id: corpId,
        employee_id:  row.employee_id,
        full_name:    row.full_name,
        department:   row.department,
        gender:       row.gender,
        birth_date:   row.birth_date,
        phone:        row.phone,
        email:        row.email,
        status:       row.status || 'Aktif',
        updated_at:   new Date().toISOString(),
      };
      await sbPost('corporate_employees', payload);
      ok++;
    } catch(e) {
      err++;
      errMsgs.push(`Baris ${row._row}: ${e.message}`);
    }
  }
  callback(ok, err, errMsgs);
}

// Import code item — lookup product_id dari kode_internal, upsert by (product_id, code)
async function _importProductItems(parsed, callback) {
  let ok=0, err=0, errMsgs=[];
  const prods = await sbGet('products','select=id,kode_internal').catch(()=>[]);
  const pmap = {}; (prods||[]).forEach(p=>pmap[String(p.kode_internal).toLowerCase()] = p.id);

  for (const row of parsed) {
    try {
      const pid = pmap[String(row._kode_internal||'').toLowerCase()];
      if (!pid) throw new Error(`Kode tes "${row._kode_internal}" tidak ditemukan`);
      const payload = {
        product_id: pid, code: row.code||null, name_id: row.name_id||row.code,
        uom: row.uom||null, result_type: row.result_type||'numeric', loinc_code: row.loinc_code||null,
        ref_low: row.ref_low??null, ref_high: row.ref_high??null, ref_text: row.ref_text||null,
        specimen_type: row.specimen_type||null, host_code: row.host_code||null,
        display_order: row.display_order||1, is_active: row.is_active!==false,
      };
      const ex = await sbGet('product_items',
        `select=id&product_id=eq.${pid}&code=eq.${encodeURIComponent(row.code||'')}`).catch(()=>[]);
      if (ex?.length) await sbPatch('product_items', ex[0].id, payload);
      else            await sbPost('product_items', payload);
      ok++;
    } catch(e) { err++; errMsgs.push(`Baris ${row._row}: ${e.message}`); }
  }

  // Recompute is_panel utk produk yang terpengaruh
  const affected = [...new Set(parsed.map(r=>pmap[String(r._kode_internal||'').toLowerCase()]).filter(Boolean))];
  for (const pid of affected) {
    try {
      const items = await sbGet('product_items',`select=id&product_id=eq.${pid}&is_active=eq.true`).catch(()=>[]);
      await sbPatch('products', pid, { is_panel: (items||[]).length > 1 });
    } catch(e){}
  }
  callback(ok, err, errMsgs);
}

// Import ref range — lookup product_id (+ product_item_id opsional), dukung numerik & kualitatif
async function _importRefRanges(parsed, callback) {
  let ok=0, err=0, errMsgs=[];
  const prods = await sbGet('products','select=id,kode_internal,nama_tes').catch(()=>[]);
  const pmap = {}; (prods||[]).forEach(p=>pmap[String(p.kode_internal).toLowerCase()] = {id:p.id,name:p.nama_tes});
  const itemCache = {};

  for (const row of parsed) {
    try {
      const pinfo = pmap[String(row._kode_internal||'').toLowerCase()];
      if (!pinfo) throw new Error(`Kode tes "${row._kode_internal}" tidak ditemukan`);
      let itemId=null, itemCode=null;
      if (row._item_code) {
        if (!itemCache[pinfo.id]) {
          const its = await sbGet('product_items',`select=id,code&product_id=eq.${pinfo.id}`).catch(()=>[]);
          const map={}; (its||[]).forEach(i=>map[String(i.code||'').toLowerCase()] = i.id);
          itemCache[pinfo.id] = map;
        }
        itemId = itemCache[pinfo.id][String(row._item_code).toLowerCase()] || null;
        itemCode = row._item_code;
        if (!itemId) throw new Error(`Code item "${row._item_code}" tidak ada di tes ${row._kode_internal}`);
      }
      const isQual = String(row.value_type||'numeric').toLowerCase()==='qualitative';
      const gender = row.gender||'All';
      const ageMin = row.age_min??0;
      const payload = {
        product_id: pinfo.id, product_name: pinfo.name, product_item_id: itemId, item_code: itemCode,
        value_type: isQual?'qualitative':'numeric',
        condition_name: row.condition_name, condition_type: row.condition_type||'normal',
        gender, age_min: ageMin, age_max: row.age_max??999,
        range_min: isQual?null:(row.range_min??null), range_max: isQual?null:(row.range_max??null),
        unit: isQual?null:(row.unit||null),
        critical_low: isQual?null:(row.critical_low??null), critical_high: isQual?null:(row.critical_high??null),
        expected_values: isQual?(row.expected_values||null):null,
        color_code: row.color_code||'green', interpretation: row.interpretation||null,
        description: row.description||null, recommendation: row.recommendation||null,
      };
      // upsert by product + item + condition + gender + age_min
      let q = `select=id&product_id=eq.${pinfo.id}&condition_name=eq.${encodeURIComponent(row.condition_name)}&gender=eq.${gender}&age_min=eq.${ageMin}`;
      q += itemId ? `&product_item_id=eq.${itemId}` : `&product_item_id=is.null`;
      const ex = await sbGet('ref_ranges', q).catch(()=>[]);
      if (ex?.length) await sbPatch('ref_ranges', ex[0].id, payload);
      else            await sbPost('ref_ranges', payload);
      ok++;
    } catch(e) { err++; errMsgs.push(`Baris ${row._row}: ${e.message}`); }
  }
  callback(ok, err, errMsgs);
}

function _addImportLog(key, tpl, ok, err, errMsgs) {
  const logEl = document.getElementById('import-log');
  if (!logEl) return;

  const now = new Date().toLocaleString('id-ID');
  const isFirst = logEl.querySelector('.empty-state');
  if (isFirst) logEl.innerHTML = '';

  const logItem = document.createElement('div');
  logItem.style.cssText = 'border-bottom:1px solid var(--border);padding:14px 0;';
  logItem.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:18px">${tpl.icon}</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:13px">${tpl.label}</div>
        <div style="font-size:11.5px;color:var(--text3)">${now}</div>
      </div>
      <div style="display:flex;gap:8px">
        <span class="badge badge-green">✅ ${ok} berhasil</span>
        ${err ? `<span class="badge badge-red">❌ ${err} gagal</span>` : ''}
      </div>
    </div>
    ${errMsgs.length ? `
      <div style="margin-top:8px;padding:8px 12px;background:#FEF2F2;border-radius:6px;font-size:11.5px;color:#DC2626">
        ${errMsgs.slice(0,5).map(m=>`<div>• ${m}</div>`).join('')}
        ${errMsgs.length > 5 ? `<div>... dan ${errMsgs.length-5} error lainnya</div>` : ''}
      </div>` : ''}`;

  logEl.prepend(logItem);
}

// ── Load SheetJS on demand ────────────────────────────
function loadSheetJS(callback) {
  if (typeof XLSX !== 'undefined') { callback(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload = () => { toast('SheetJS loaded','info',1000); callback(); };
  script.onerror = () => toast('❌ Gagal load library Excel','err');
  document.head.appendChild(script);
}