// ═══════════════════════════════════════════════════════════════
// MODULE: Laboratory Information System (LIS) — CORE / SHELL
// ---------------------------------------------------------------
// File ini memuat state bersama, shell halaman (header + tabs),
// KPI, loader data, banner nilai kritis, dan helper yang dipakai
// oleh sub-modul lab lainnya:
//   lab/checkin.js     · Penerimaan & registrasi sampel (barcode)
//   lab/worklist.js    · Worklist per-analyzer + monitoring TAT
//   lab/results.js     · Input hasil + auto-interpretasi ref range
//   lab/validation.js  · Validasi teknis & approval klinis
//   lab/report.js      · Rekam medis lab, cumulative report, cetak
//   lab/qc.js          · Quality Control & manajemen analyzer
// ═══════════════════════════════════════════════════════════════

// Worklist & Check-in dipisah menjadi 2 alur mandiri
const LAB_TABS = ['checkin','worklist','result','validation','approval','report','qc','integrasi'];

// State bersama (dibaca/ditulis lintas sub-modul)
let labSamples  = [];
let labResults  = [];
let _rrCache    = {};   // cache ref_ranges per product_id
let _prodCache  = null; // cache master products (untuk TAT target & dropdown)

// Peta warna interpretasi (green/yellow/orange/red)
const LAB_COLORS = { green:'#22C55E', yellow:'#F59E0B', orange:'#F97316', red:'#EF4444', gray:'#94A3B8' };
function labColor(code){ return LAB_COLORS[code] || LAB_COLORS.gray; }
// Nama pelaku untuk jejak TAT — pakai ALIAS bila di-set, jika tidak nama lengkap.
function labUser(){
  const al = window.currentUser?.profile?.alias;
  if (al && String(al).trim()) return String(al).trim();
  return (typeof getUserName==='function') ? getUserName() : 'User';
}

// Master catatan validator / analis
const LAB_NOTE_PRESETS = [
  'Duplo — pemeriksaan diulang dua kali',
  'Triplo — pemeriksaan diulang tiga kali',
  'Sampel hemolisis',
  'Sampel lipemik',
  'Sampel ikterik',
  'Sampel kurang (QNS)',
  'Sampel bekuan (clotted)',
  'Sampel diencerkan (diluted)',
  'Diperiksa ulang — hasil konsisten',
  'Hasil dikonfirmasi dengan sampel ulang',
  'Perlu sampel ulang',
  'Nilai kritis sudah dilaporkan ke DPJP',
];

// Simpan catatan per test (digunakan oleh Input Hasil, Validasi, dan Approval)
async function saveResultNote(rid, mode='validate'){
  let inp = null;
  if(mode === 'result'){
    inp = document.getElementById('res-note-input');
  } else if (typeof VAL_MODES !== 'undefined' && VAL_MODES[mode]) {
    inp = typeof valEl === 'function' ? valEl(mode, 'note-input') : document.getElementById(`${VAL_MODES[mode].prefix}-note-input`);
  } else {
    inp = document.getElementById(`${mode}-note-input`);
  }
  if(!inp) return;
  const note = inp.value.trim();
  try{
    await sbPatch('lab_results', rid, {notes: note||null, updated_at: new Date().toISOString()});
    const r = labResults.find(x=>x.id==rid); if(r) r.notes = note||null;
    if(typeof _valNotes !== 'undefined') _valNotes[rid] = note;
    if(typeof _resNotes !== 'undefined') _resNotes[rid] = note;
    const p = labResults.find(x=>x.id==rid)||{};
    if(typeof logActivity==='function')
      logActivity('note','lab_results',rid,`Catatan hasil: ${note||'(dikosongkan)'}`,p.patient_name);
    toast('Catatan tersimpan','ok');
  } catch(e){ toast('Gagal menyimpan catatan: '+e.message,'err'); }
}

// ── Master produk analit laboratorium (Katalog Tes Medis Terverifikasi LOINC/UCUM) ──────
const REAL_MASTER_LAB_TESTS = [
  // HEMATOLOGI
  { id: 101, kode_internal: 'LAB-HEM-001', nama_tes: 'Darah Lengkap Otomatis (CBC + Diff)', kategori: 'Hematologi', satuan_hasil: 'Panel', sampel_type: 'Darah EDTA (Ungu)', waktu_tat_jam: 1, is_panel: true, loinc_code: '58410-2', tarif: 110000 },
  { id: 102, kode_internal: 'LAB-HEM-002', nama_tes: 'Hemoglobin (Hb)', kategori: 'Hematologi', satuan_hasil: 'g/dL', sampel_type: 'Darah EDTA (Ungu)', waktu_tat_jam: 1, is_panel: false, loinc_code: '718-7', tarif: 45000 },
  { id: 103, kode_internal: 'LAB-HEM-003', nama_tes: 'Leukosit (WBC)', kategori: 'Hematologi', satuan_hasil: '10^3/uL', sampel_type: 'Darah EDTA (Ungu)', waktu_tat_jam: 1, is_panel: false, loinc_code: '6690-2', tarif: 45000 },
  { id: 104, kode_internal: 'LAB-HEM-004', nama_tes: 'Trombosit (Platelet)', kategori: 'Hematologi', satuan_hasil: '10^3/uL', sampel_type: 'Darah EDTA (Ungu)', waktu_tat_jam: 1, is_panel: false, loinc_code: '777-3', tarif: 45000 },
  { id: 105, kode_internal: 'LAB-HEM-005', nama_tes: 'Hematokrit (HCT)', kategori: 'Hematologi', satuan_hasil: '%', sampel_type: 'Darah EDTA (Ungu)', waktu_tat_jam: 1, is_panel: false, loinc_code: '4544-3', tarif: 45000 },
  { id: 106, kode_internal: 'LAB-HEM-006', nama_tes: 'Laju Endap Darah (LED / Westergren)', kategori: 'Hematologi', satuan_hasil: 'mm/jam', sampel_type: 'Darah Sitrat / EDTA', waktu_tat_jam: 2, is_panel: false, loinc_code: '44522-1', tarif: 50000 },
  { id: 107, kode_internal: 'LAB-HEM-007', nama_tes: 'Golongan Darah ABO & Rhesus', kategori: 'Hematologi', satuan_hasil: 'Kualitatif', sampel_type: 'Darah EDTA (Ungu)', waktu_tat_jam: 1, is_panel: false, loinc_code: '883-9', tarif: 65000 },
  { id: 108, kode_internal: 'LAB-HEM-008', nama_tes: 'Masa Perdarahan (Bleeding Time - Ivy)', kategori: 'Hematologi', satuan_hasil: 'menit', sampel_type: 'Darah Kapiler', waktu_tat_jam: 1, is_panel: false, loinc_code: '3187-0', tarif: 50000 },
  { id: 109, kode_internal: 'LAB-HEM-009', nama_tes: 'Masa Pembekuan (Clotting Time - Lee White)', kategori: 'Hematologi', satuan_hasil: 'menit', sampel_type: 'Darah Vena', waktu_tat_jam: 1, is_panel: false, loinc_code: '3184-7', tarif: 50000 },
  { id: 110, kode_internal: 'LAB-HEM-010', nama_tes: 'Morfologi Darah Tepi (MDT / Apus Darah)', kategori: 'Hematologi', satuan_hasil: 'Deskriptif', sampel_type: 'Darah EDTA (Ungu)', waktu_tat_jam: 4, is_panel: false, loinc_code: '6742-1', tarif: 150000 },
  { id: 111, kode_internal: 'LAB-HEM-011', nama_tes: 'Hemostasis PT / INR', kategori: 'Hematologi', satuan_hasil: 'detik / INR', sampel_type: 'Plasma Sitrat (Biru)', waktu_tat_jam: 2, is_panel: false, loinc_code: '5902-2', tarif: 135000 },
  { id: 112, kode_internal: 'LAB-HEM-012', nama_tes: 'Hemostasis APTT', kategori: 'Hematologi', satuan_hasil: 'detik', sampel_type: 'Plasma Sitrat (Biru)', waktu_tat_jam: 2, is_panel: false, loinc_code: '3173-0', tarif: 135000 },

  // KIMIA KLINIK & DIABETES
  { id: 201, kode_internal: 'LAB-KIM-001', nama_tes: 'Glukosa Darah Puasa (GDP)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '1558-6', tarif: 45000 },
  { id: 202, kode_internal: 'LAB-KIM-002', nama_tes: 'Glukosa Darah 2 Jam PP (GD2PP)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '1514-9', tarif: 45000 },
  { id: 203, kode_internal: 'LAB-KIM-003', nama_tes: 'Glukosa Darah Sewaktu (GDS)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 1, is_panel: false, loinc_code: '2345-7', tarif: 45000 },
  { id: 204, kode_internal: 'LAB-KIM-004', nama_tes: 'HbA1c (Kromatografi HPLC Terstandar NGSP)', kategori: 'Kimia Klinik', satuan_hasil: '%', sampel_type: 'Darah EDTA (Ungu)', waktu_tat_jam: 2, is_panel: false, loinc_code: '4548-4', tarif: 185000 },
  { id: 205, kode_internal: 'LAB-KIM-005', nama_tes: 'Ureum Darah', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '3094-0', tarif: 55000 },
  { id: 206, kode_internal: 'LAB-KIM-006', nama_tes: 'Kreatinin Darah + eGFR (CKD-EPI)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '2160-0', tarif: 60000 },
  { id: 207, kode_internal: 'LAB-KIM-007', nama_tes: 'Asam Urat (Uric Acid)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '3084-1', tarif: 55000 },

  // FUNGSI HATI & PROFIL LIPID
  { id: 208, kode_internal: 'LAB-KIM-008', nama_tes: 'SGOT / AST (Aspartate Aminotransferase)', kategori: 'Kimia Klinik', satuan_hasil: 'U/L', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '1920-8', tarif: 55000 },
  { id: 209, kode_internal: 'LAB-KIM-009', nama_tes: 'SGPT / ALT (Alanine Aminotransferase)', kategori: 'Kimia Klinik', satuan_hasil: 'U/L', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '1742-6', tarif: 55000 },
  { id: 210, kode_internal: 'LAB-KIM-010', nama_tes: 'Bilirubin Total', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '1975-2', tarif: 60000 },
  { id: 211, kode_internal: 'LAB-KIM-011', nama_tes: 'Bilirubin Direk & Indirek', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '1968-7', tarif: 65000 },
  { id: 212, kode_internal: 'LAB-KIM-012', nama_tes: 'Gamma GT (GGT)', kategori: 'Kimia Klinik', satuan_hasil: 'U/L', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '2324-2', tarif: 75000 },
  { id: 213, kode_internal: 'LAB-KIM-013', nama_tes: 'Fosfatase Alkali (ALP)', kategori: 'Kimia Klinik', satuan_hasil: 'U/L', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '6768-6', tarif: 75000 },
  { id: 214, kode_internal: 'LAB-KIM-014', nama_tes: 'Protein Total, Albumin, Globulin', kategori: 'Kimia Klinik', satuan_hasil: 'g/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: true, loinc_code: '2885-2', tarif: 95000 },
  { id: 215, kode_internal: 'LAB-KIM-015', nama_tes: 'Kolesterol Total', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '2093-3', tarif: 55000 },
  { id: 216, kode_internal: 'LAB-KIM-016', nama_tes: 'Trigliserida', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '2571-8', tarif: 60000 },
  { id: 217, kode_internal: 'LAB-KIM-017', nama_tes: 'HDL Kolesterol (Direct)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '2085-9', tarif: 65000 },
  { id: 218, kode_internal: 'LAB-KIM-018', nama_tes: 'LDL Kolesterol (Direct)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '13457-7', tarif: 85000 },
  { id: 219, kode_internal: 'LAB-KIM-019', nama_tes: 'Profil Lipid Lengkap (Total, HDL, LDL, TG)', kategori: 'Kimia Klinik', satuan_hasil: 'Panel', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: true, loinc_code: '57698-3', tarif: 240000 },

  // ELEKTROLIT
  { id: 220, kode_internal: 'LAB-ELE-001', nama_tes: 'Elektrolit Serum (Na+, K+, Cl-)', kategori: 'Kimia Klinik', satuan_hasil: 'mmol/L', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 1, is_panel: true, loinc_code: '24326-1', tarif: 175000 },
  { id: 221, kode_internal: 'LAB-ELE-002', nama_tes: 'Kalsium Total (Ca)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '17861-6', tarif: 75000 },
  { id: 222, kode_internal: 'LAB-ELE-003', nama_tes: 'Magnesium (Mg)', kategori: 'Kimia Klinik', satuan_hasil: 'mg/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '19123-9', tarif: 85000 },

  // IMUNOLOGI & SEROLOGI
  { id: 301, kode_internal: 'LAB-IMU-001', nama_tes: 'HBsAg Kualitatif (Rapid / ECLIA)', kategori: 'Imunologi', satuan_hasil: 'Non-Reaktif', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '5196-1', tarif: 95000 },
  { id: 302, kode_internal: 'LAB-IMU-002', nama_tes: 'Anti-HBs Kuantitatif (Titer Proteksi)', kategori: 'Imunologi', satuan_hasil: 'mIU/mL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 3, is_panel: false, loinc_code: '48070-7', tarif: 165000 },
  { id: 303, kode_internal: 'LAB-IMU-003', nama_tes: 'Anti-HCV (Hepatitis C Screening)', kategori: 'Imunologi', satuan_hasil: 'Non-Reaktif', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 3, is_panel: false, loinc_code: '13955-0', tarif: 175000 },
  { id: 304, kode_internal: 'LAB-IMU-004', nama_tes: 'Anti-HIV 1/2 Screening 3 Metode', kategori: 'Imunologi', satuan_hasil: 'Non-Reaktif', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 3, is_panel: false, loinc_code: '68961-2', tarif: 185000 },
  { id: 305, kode_internal: 'LAB-IMU-005', nama_tes: 'VDRL / RPR (Skrining Sifilis)', kategori: 'Imunologi', satuan_hasil: 'Non-Reaktif', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '20507-0', tarif: 85000 },
  { id: 306, kode_internal: 'LAB-IMU-006', nama_tes: 'TPHA (Konfirmasi Treponema Pallidum)', kategori: 'Imunologi', satuan_hasil: 'Non-Reaktif', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '24111-7', tarif: 120000 },
  { id: 307, kode_internal: 'LAB-IMU-007', nama_tes: 'Widal Serologi (Tifoid S. typhi)', kategori: 'Imunologi', satuan_hasil: 'Titer', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: true, loinc_code: '20570-8', tarif: 80000 },
  { id: 308, kode_internal: 'LAB-IMU-008', nama_tes: 'Dengue NS1 Antigen (Demam Berdarah Hari 1-3)', kategori: 'Imunologi', satuan_hasil: 'Negatif', sampel_type: 'Serum / EDTA', waktu_tat_jam: 1, is_panel: false, loinc_code: '68961-2', tarif: 195000 },
  { id: 309, kode_internal: 'LAB-IMU-009', nama_tes: 'Dengue IgG & IgM (Serologi DBD Hari >3)', kategori: 'Imunologi', satuan_hasil: 'Negatif', sampel_type: 'Serum / EDTA', waktu_tat_jam: 1, is_panel: true, loinc_code: '40713-0', tarif: 195000 },
  { id: 310, kode_internal: 'LAB-IMU-010', nama_tes: 'Troponin I Kuantitatif (Cardiac Marker)', kategori: 'Imunologi', satuan_hasil: 'ng/mL', sampel_type: 'Serum / Plasma Heparin', waktu_tat_jam: 1, is_panel: false, loinc_code: '10839-9', tarif: 320000 },
  { id: 311, kode_internal: 'LAB-IMU-011', nama_tes: 'hs-CRP (High-Sensitivity C-Reactive Protein)', kategori: 'Imunologi', satuan_hasil: 'mg/L', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 2, is_panel: false, loinc_code: '30522-7', tarif: 195000 },

  // TIROID & HORMON
  { id: 312, kode_internal: 'LAB-HOR-001', nama_tes: 'TSHs (Sensitive Thyroid Stimulating Hormone)', kategori: 'Imunologi', satuan_hasil: 'uIU/mL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 3, is_panel: false, loinc_code: '3016-3', tarif: 195000 },
  { id: 313, kode_internal: 'LAB-HOR-002', nama_tes: 'FT4 (Free Thyroxine)', kategori: 'Imunologi', satuan_hasil: 'ng/dL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 3, is_panel: false, loinc_code: '3024-7', tarif: 195000 },
  { id: 314, kode_internal: 'LAB-HOR-003', nama_tes: 'Anti-Müllerian Hormone (AMH - Cadangan Ovarium)', kategori: 'Imunologi', satuan_hasil: 'ng/mL', sampel_type: 'Serum (Kuning/Merah)', waktu_tat_jam: 4, is_panel: false, loinc_code: '35422-5', tarif: 495000 },

  // URINALISIS & FESES
  { id: 401, kode_internal: 'LAB-URI-001', nama_tes: 'Urin Lengkap (Makroskopis, Kimiawi 10P, Sedimen)', kategori: 'Urinalisis', satuan_hasil: 'Panel', sampel_type: 'Urin Midstream (Pot Urin)', waktu_tat_jam: 1, is_panel: true, loinc_code: '24357-6', tarif: 65000 },
  { id: 402, kode_internal: 'LAB-URI-002', nama_tes: 'Tes Kehamilan Urin (HCG Plano Test)', kategori: 'Urinalisis', satuan_hasil: 'Negatif', sampel_type: 'Urin Sewaktu/Pagi', waktu_tat_jam: 1, is_panel: false, loinc_code: '2106-3', tarif: 45000 },
  { id: 403, kode_internal: 'LAB-URI-003', nama_tes: 'Narkoba Urin 6 Parameter (THC, MAMP, AMP, MOR, COC, BZO)', kategori: 'Urinalisis', satuan_hasil: 'Negatif', sampel_type: 'Urin Segar', waktu_tat_jam: 1, is_panel: true, loinc_code: '19295-5', tarif: 175000 },
  { id: 404, kode_internal: 'LAB-FES-001', nama_tes: 'Feses Lengkap (Makroskopis, Mikroskopis, Telur Cacing)', kategori: 'Feses', satuan_hasil: 'Panel', sampel_type: 'Feses Segar (Pot Feses)', waktu_tat_jam: 2, is_panel: true, loinc_code: '10701-1', tarif: 65000 },
  { id: 405, kode_internal: 'LAB-FES-002', nama_tes: 'Darah Samar Feses (FOBT Imunokromatografi)', kategori: 'Feses', satuan_hasil: 'Negatif', sampel_type: 'Feses Segar (Pot Feses)', waktu_tat_jam: 2, is_panel: false, loinc_code: '14563-1', tarif: 95000 },

  // PAKET MCU LABORATORIUM
  { id: 501, kode_internal: 'LAB-MCU-001', nama_tes: 'Paket MCU Dasar (Darah Lengkap, Urin Lengkap, GDS, SGPT, Kreatinin, Asam Urat, Kolesterol)', kategori: 'Paket MCU', satuan_hasil: 'Paket', sampel_type: 'Darah EDTA + Serum + Urin', waktu_tat_jam: 3, is_panel: true, loinc_code: 'MCU-BASIC', tarif: 420000 },
  { id: 502, kode_internal: 'LAB-MCU-002', nama_tes: 'Paket Skrining Diabetes & Jantung (HbA1c, GDP, Profil Lipid Lengkap, EKG, Urin Lengkap)', kategori: 'Paket MCU', satuan_hasil: 'Paket', sampel_type: 'Darah EDTA + Serum + Urin', waktu_tat_jam: 3, is_panel: true, loinc_code: 'MCU-CARDIO-DM', tarif: 590000 },
  { id: 503, kode_internal: 'LAB-MCU-003', nama_tes: 'Paket Skrining Pra-Nikah (Darah Lengkap, Gol. Darah, HBsAg, Anti-HIV, VDRL, Urin)', kategori: 'Paket MCU', satuan_hasil: 'Paket', sampel_type: 'Darah EDTA + Serum + Urin', waktu_tat_jam: 3, is_panel: true, loinc_code: 'MCU-PREMARITAL', tarif: 650000 }
];

async function loadLabProducts(){
  if (_prodCache && _prodCache.length > 0) return _prodCache;
  try {
    const data = await sbGet('products',
      'select=id,nama_tes,kode_internal,kategori,satuan_hasil,sampel_type,waktu_tat_jam,is_panel,host_code,is_active&is_active=eq.true&order=kategori,nama_tes');
    if (data && Array.isArray(data) && data.length > 0) {
      _prodCache = data;
    } else {
      _prodCache = REAL_MASTER_LAB_TESTS;
    }
  } catch(e){
    _prodCache = REAL_MASTER_LAB_TESTS;
  }
  return _prodCache;
}
function labProduct(id){ return (_prodCache||REAL_MASTER_LAB_TESTS).find(p=>p.id==id) || null; }
window.REAL_MASTER_LAB_TESTS = REAL_MASTER_LAB_TESTS;
window.loadLabProducts = loadLabProducts;
window.labProduct = labProduct;

// ── Turnaround Time (TAT) ────────────────────────────────────────
// Target jam diambil dari master produk (waktu_tat_jam), fallback 4 jam.
function tatTargetHours(row){
  const p = labProduct(row.product_id);
  return (p && p.waktu_tat_jam) ? p.waktu_tat_jam : 4;
}
function minutesSince(iso){
  if(!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime())/60000));
}
// Status TAT sebuah sampel/hasil relatif ke waktu terima (received_at/collected_at)
function tatStatus(row){
  const start = row.received_at || row.collected_at || row.created_at;
  const elapsed = minutesSince(start);
  const targetMin = tatTargetHours(row) * 60;
  if (elapsed === null) return { elapsed:0, targetMin, overdue:false, pct:0, label:'—' };
  const pct = Math.min(100, Math.round(elapsed/targetMin*100));
  const overdue = elapsed > targetMin;
  const h = Math.floor(elapsed/60), m = elapsed%60;
  return { elapsed, targetMin, overdue, pct, label:`${h?h+'j ':''}${m}m` };
}
function tatBadge(row){
  const t = tatStatus(row);
  const color = t.overdue ? '#EF4444' : (t.pct>75 ? '#F59E0B' : '#22C55E');
  return `<span title="Target ${tatTargetHours(row)} jam" style="display:inline-flex;align-items:center;gap:4px;
    background:${color}15;color:${color};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">
    ${t.label}${t.overdue?' · OVERDUE':''}</span>`;
}

// ── Deteksi nilai kritis ─────────────────────────────────────────
// Kritis bila is_critical=true, atau color_code merah, atau nilai numerik
// keluar dari batas critical_low/high yang tersimpan di hasil.
function isCriticalResult(r){
  if (r.is_critical === true) return true;
  if ((r.color_code||'') === 'red' && r.condition_type !== 'normal') return true;
  const v = (r.result_numeric!=null) ? r.result_numeric : parseFloat(r.result_value);
  if (!isNaN(v)) {
    if (r.critical_low  != null && v <= r.critical_low)  return true;
    if (r.critical_high != null && v >= r.critical_high) return true;
  }
  return false;
}
function isReleased(r){ return r.status==='Approved' || r.status==='Released'; }

// ── Ref ranges loader (dipakai results.js & worklist.js) ─────────
async function labLoadRR(productId){
  if(!productId) return [];
  if(_rrCache[productId]) return _rrCache[productId];
  try {
    _rrCache[productId] = await sbGet('ref_ranges',
      `select=*&product_id=eq.${productId}&order=range_min.asc`) || [];
  } catch(e){ _rrCache[productId] = []; }
  return _rrCache[productId];
}
// Cari ref range yang cocok untuk sebuah nilai (numerik ATAU teks/kualitatif),
// dengan opsi filter gender & umur. rawVal boleh angka atau teks (Positif/Negatif).
function matchRefRange(rrs, rawVal, gender, age){
  const cand = (rrs||[]).filter(rr=>{
    const gOk = !rr.gender || rr.gender==='All' || !gender || rr.gender===gender;
    const aOk = age==null || ((rr.age_min==null||age>=rr.age_min) && (rr.age_max==null||age<=rr.age_max));
    return gOk && aOk;
  });
  const num = parseFloat(rawVal);
  const txt = String(rawVal==null?'':rawVal).trim().toLowerCase();

  // 1) Numerik — cocokkan ke rentang (abaikan baris kualitatif & baris tanpa rentang)
  if(!isNaN(num) && txt!==''){
    const m = cand.find(rr=> rr.value_type!=='qualitative'
      && !(rr.range_min==null && rr.range_max==null)
      && (rr.range_min==null||num>=rr.range_min)
      && (rr.range_max==null||num<=rr.range_max));
    if(m) return m;
  }
  // 2) Kualitatif/teks — cocokkan ke daftar expected_values (mis. "Negatif,Neg")
  if(txt){
    const m = cand.find(rr=>{
      const list=(rr.expected_values||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      return list.includes(txt);
    });
    if(m) return m;
  }
  return null;
}

// ── Code item (analit) per produk ────────────────────────────────
let _itemsCache = {};
async function labProductItems(productId){
  if(_itemsCache[productId]) return _itemsCache[productId];
  try {
    _itemsCache[productId] = (await sbGet('product_items',
      `select=id,code,name_id,uom,loinc_code,host_code,ref_low,ref_high,ref_text,display_order,is_active&product_id=eq.${productId}&order=display_order.asc`)||[])
      .filter(i=>i.is_active!==false);
  } catch(e){ _itemsCache[productId] = []; }
  return _itemsCache[productId];
}

// Buat draft lab_results untuk sebuah tes — PECAH per code item bila panel.
// base: { admission_id, sample_id, visit_number, patient_name }
async function labCreateDraftResults(base, productId, productName){
  const items = await labProductItems(productId);
  const now = new Date().toISOString();
  if (items.length){
    for (const it of items){
      await sbPost('lab_results', { ...base,
        product_id: productId, product_name: productName,
        product_item_id: it.id, item_code: it.code||null, item_name: it.name_id||it.code||null,
        unit: it.uom||null, loinc_code: it.loinc_code||null, host_code: it.host_code||null,
        status:'Draft', entered_by: labUser(), entered_at: now });
    }
    return items.length;
  }
  await sbPost('lab_results', { ...base,
    product_id: productId, product_name: productName,
    status:'Draft', entered_by: labUser(), entered_at: now });
  return 1;
}

// ── Loaders utama ────────────────────────────────────────────────
async function loadLabSamples(){
  try {
    const data = await sbGet('lab_samples',
      `select=*&order=created_at.desc&limit=200`);
    labSamples = Array.isArray(data)?data:[];
  } catch(e){ labSamples = []; }
}
async function loadLabResults(){
  try {
    const data = await sbGet('lab_results',
      `select=*&order=created_at.desc&limit=300`);
    labResults = Array.isArray(data)?data:[];
  } catch(e){ labResults = []; }
}

// ── Gaya padat ala LIS desktop (Sysmex-like), scoped ke #lab-shell ──
function injectLisStyle(){
  if(document.getElementById('lis-style')) return;
  const s=document.createElement('style'); s.id='lis-style';
  s.textContent=`
    #lab-shell{ font-size:12.5px; color:var(--ink-04); }
    #lab-shell .lis-header{ display:flex;justify-content:space-between;align-items:center;
      background:linear-gradient(90deg,#0A2342,#0d2d54);color:var(--on-accent);border-radius:8px;padding:8px 14px;margin-bottom:10px; }
    #lab-shell .lis-header h1{ font-size:15px;margin:0;color:var(--on-accent);font-weight:800; }
    #lab-shell .lis-sub{ font-size:11px;color:#9db4d0; }
    #lab-shell .lis-date{ font-size:11px;color:#cfe0f2; }
    #lab-shell #lab-kpi{ gap:6px !important;margin-bottom:10px !important; }
    #lab-shell #lab-kpi > div{ padding:6px 8px !important;border-radius:7px !important; }
    #lab-shell #lab-kpi > div > div:nth-child(2){ font-size:16px !important; }
    #lab-shell .tabs{ gap:2px;border-bottom:2px solid #d3dae1;margin-bottom:10px;flex-wrap:wrap; }
    #lab-shell .tab-btn{ padding:6px 12px !important;font-size:11.5px !important;border-radius:6px 6px 0 0; }
    #lab-shell .table-wrap{ border:1px solid #d3dae1;border-radius:8px;overflow:auto; }
    #lab-shell .table-wrap table{ width:100%;border-collapse:collapse; }
    #lab-shell .table-wrap th{ background:var(--navy-deep);color:var(--on-accent);font-size:10.5px;text-transform:uppercase;
      letter-spacing:.03em;padding:5px 8px;text-align:left;position:sticky;top:0;white-space:nowrap; }
    #lab-shell .table-wrap td{ padding:4px 8px;border-bottom:1px solid #eef1f4;font-size:12px;vertical-align:middle; }
    #lab-shell .table-wrap tbody tr:nth-child(even){ background:var(--bg); }
    #lab-shell .table-wrap tbody tr:hover{ background:#eaf5f3; }
    #lab-shell .lis-title{ font-size:11px;font-weight:800;color:var(--navy-deep);text-transform:uppercase;
      letter-spacing:.04em;margin:12px 0 6px;padding-left:7px;border-left:3px solid var(--teal); }
    #lab-shell .lis-badge{ display:inline-block;min-width:18px;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:800;text-align:center; }
    #lab-shell .lis-badge.warn{ background:var(--warn-soft);color:var(--warn-deeper); }
    #lab-shell .lis-badge.info{ background:#DBEAFE;color:var(--ink-11); }
    #lab-shell .lis-badge.ok{ background:var(--tint-01);color:var(--ink-06); }
    #lab-shell .lis-bar{ height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;min-width:56px; }
    #lab-shell .lis-bar > span{ display:block;height:100%;background:var(--teal); }
    #lab-shell .btn-xs{ padding:3px 8px !important;font-size:11px !important; }`;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
// SHELL HALAMAN
//
// Tab bar & band KPI DIPINDAH keluar: navigasi antar sub-menu kini lewat kartu
// di halaman indeks kategori (openCategory), dan ringkasan angka tampil di sana
// (labCategorySummary). Tiap sub-menu jadi halamannya sendiri — di sini hanya
// dirender SATU tab yang diminta, dengan judul & tautan kembali ke indeks.
// ═══════════════════════════════════════════════════════════════
const LAB_TAB_META = {
  checkin:    { label:'Penerimaan & Barcode',     ico:'🩸' },
  worklist:   { label:'Worklist Mesin Analyzer',  ico:'🔬' },
  result:     { label:'Input Hasil & Delta Check',ico:'📝' },
  validation: { label:'Otorisasi Dokter Sp.PK',   ico:'✅' },
  approval:   { label:'Approval & TTE QR',        ico:'🔏' },
  report:     { label:'Rekam Medis Lab & Arsip',  ico:'📁' },
  qc:         { label:'QC & Kendali Mutu',        ico:'📊' },
  integrasi:  { label:'Integrasi Alat (:9999)',   ico:'🔌' },
};

async function renderLab(tab='checkin'){
  if(!LAB_TABS.includes(tab)) tab='checkin';
  injectLisStyle();
  const meta = LAB_TAB_META[tab] || { label:'LIS', ico:'' };
  document.getElementById('main-content').innerHTML = `
    <div id="lab-shell" class="lis" style="font-family:'Plus Jakarta Sans',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:14px;">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#10b981; margin-bottom:4px;">
            🔬 LIS &bull; ISO 15189:2022
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 2px 0;">
            ${meta.ico} ${meta.label}
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Diagnostic Laboratory Information System &bull; ASTM E1381 / HL7 Integrated
          </p>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div id="lab-connector-live-pill" style="display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:11.5px;font-weight:700;background:rgba(14,165,233,0.1);border:1px solid rgba(14,165,233,0.25);color:#0284C7;cursor:pointer" onclick="navigate('analyzer-interfacing')" title="Status Lab Analyzer Connector (:9999)">
            <span style="width:7px;height:7px;border-radius:50%;background:#0EA5E9;display:inline-block"></span>
            <span>Analyzer :9999</span>
          </div>
        </div>
      </div>

      <div id="lab-critical-banner"></div>
      <div id="lab-${tab}"></div>
    </div>`;

  const badge = document.getElementById('lab-date-badge');
  if (badge) badge.textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Probe live connector in background
  probeLabConnectorBadge();

  await Promise.all([loadLabProducts(), loadLabSamples(), loadLabResults()]);
  renderCriticalBanner();

  // Render HANYA tab yang diminta.
  ({
    checkin:renderCheckinTab,
    worklist:renderWorklistTab,
    result:renderResultTab,
    validation:renderValidationTab,
    approval:renderApprovalTab,
    report:renderReportTab,
    qc:renderQCTab,
    integrasi:renderAnalyzerHub,
  }[tab] || renderCheckinTab)();
}

async function probeLabConnectorBadge(){
  const pill = document.getElementById('lab-connector-live-pill');
  if(!pill) return;
  try{
    const ac = new AbortController();
    const t = setTimeout(()=>ac.abort(), 1800);
    const res = await fetch('http://127.0.0.1:9999/api/status', { signal: ac.signal });
    clearTimeout(t);
    if(res.ok){
      pill.style.background = 'rgba(16,185,129,0.12)';
      pill.style.borderColor = 'rgba(16,185,129,0.3)';
      pill.style.color = '#059669';
      pill.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#10B981;display:inline-block;box-shadow:0 0 6px #10B981"></span><span>Analyzer Online</span>`;
    }
  }catch(e){
    // Standby mode
    pill.style.background = 'rgba(148,163,184,0.1)';
    pill.style.borderColor = 'rgba(148,163,184,0.2)';
    pill.style.color = '#64748B';
    pill.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#94A3B8;display:inline-block"></span><span>Driver Offline</span>`;
  }
}

// ── Ringkasan angka untuk halaman indeks kategori (halaman depan) ──
// Dipanggil openCategory('lab'). Memuat data lalu menaruh kartu KPI elegan di
// containerId. Klik kartu langsung membuka sub-menu terkait.
async function labCategorySummary(containerId){
  const el=document.getElementById(containerId); if(!el) return;
  el.innerHTML=`<div class="loading-row"><div class="spinner"></div></div>`;
  try{ await Promise.all([loadLabSamples(), loadLabResults()]); }catch(e){ el.innerHTML=''; return; }

  const pending   = labSamples.filter(s=>s.status==='Pending').length;
  const inProc    = labSamples.filter(s=>s.status==='In Process').length;
  const overdue   = labSamples.filter(s=>['Pending','In Process'].includes(s.status) && tatStatus(s).overdue).length;
  const draftRes  = labResults.filter(r=>r.status==='Draft' && r.result_value).length;
  const validated = labResults.filter(r=>r.status==='Validated').length;
  const critical  = labResults.filter(r=>isCriticalResult(r) && !isReleased(r)).length;
  const released  = labResults.filter(r=>isReleased(r)).length;

  const cards=[
    {icon:'',val:pending,   label:'Sampel Pending',color:'#F59E0B',tab:'checkin'},
    {icon:'⚗️',val:inProc,    label:'Diproses',      color:'#0EA5E9',tab:'checkin'},
    {icon:'⏰',val:overdue,   label:'TAT Terlambat', color:'#EF4444',tab:'checkin'},
    {icon:'',val:draftRes,  label:'Draft Hasil',   color:'#8B5CF6',tab:'result'},
    {icon:'',val:critical,  label:'Nilai Kritis',  color:'#DC2626',tab:'validation'},
    {icon:'✅',val:validated, label:'Tervalidasi',   color:'#22C55E',tab:'approval'},
    {icon:'',val:released,  label:'Released',       color:'#0A2342',tab:'report'},
    {icon:'🔌',val:'',        label:'Integrasi Alat', color:'#0E7C86',tab:'integrasi'},
  ];
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px">
    ${cards.map(k=>`
      <button onclick="navigate('lab',{tab:'${k.tab}'})"
        style="text-align:left;background:var(--white);border:1px solid var(--border);border-left:4px solid ${k.color};
        border-radius:12px;padding:12px 14px;cursor:pointer;transition:box-shadow .15s,transform .15s"
        onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-1px)'"
        onmouseout="this.style.boxShadow='';this.style.transform=''">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:22px;font-weight:800;color:${k.color};font-variant-numeric:tabular-nums">${k.val}</span>
          <span style="font-size:16px;opacity:.7">${k.icon}</span>
        </div>
        <div style="font-size:11px;color:var(--gray);margin-top:2px">${k.label}</div>
      </button>`).join('')}
  </div>`;
}

// Tab bar sudah dipindah ke halaman indeks kategori. switchLabTab dipertahankan
// sebagai shim agar pemanggil lama (mis. checkin.js yang melompat ke Input Hasil)
// tetap berpindah — kini lewat navigasi halaman, bukan menyembunyikan div.
function switchLabTab(tab){ if(typeof navigate==='function') navigate('lab',{tab}); }

// Reload penuh + re-render semua tab (dipanggil sub-modul setelah mutasi)
async function labRefresh(){
  await Promise.all([loadLabSamples(), loadLabResults()]);
  renderLabKPI(); renderCriticalBanner();
  renderCheckinTab(); renderWorklistTab(); renderResultTab();
  renderValidationTab(); renderApprovalTab(); renderReportTab();
}

// ── KPI ──────────────────────────────────────────────────────────
function renderLabKPI(){
  const el=document.getElementById('lab-kpi'); if(!el) return;
  const pending   = labSamples.filter(s=>s.status==='Pending').length;
  const inProc    = labSamples.filter(s=>s.status==='In Process').length;
  const overdue   = labSamples.filter(s=>['Pending','In Process'].includes(s.status) && tatStatus(s).overdue).length;
  const draftRes  = labResults.filter(r=>r.status==='Draft').length;
  const validated = labResults.filter(r=>r.status==='Validated').length;
  const critical  = labResults.filter(r=>isCriticalResult(r) && !isReleased(r)).length;
  const released  = labResults.filter(r=>isReleased(r)).length;

  el.innerHTML=[
    {icon:'',val:pending,   label:'Sampel Pending', color:'#F59E0B', tab:'checkin'},
    {icon:'⚗️',val:inProc,    label:'Diproses',       color:'#0EA5E9', tab:'checkin'},
    {icon:'⏰',val:overdue,   label:'TAT Terlambat',  color:'#EF4444', tab:'checkin'},
    {icon:'',val:draftRes,  label:'Draft Hasil',    color:'#8B5CF6', tab:'result'},
    {icon:'',val:critical,  label:'Nilai Kritis',   color:'#DC2626', tab:'validation'},
    {icon:'✅',val:validated, label:'Tervalidasi',    color:'#22C55E', tab:'approval'},
    {icon:'',val:released,  label:'Released',        color:'#0A2342', tab:'report'},
  ].map(k=>`
    <div onclick="switchLabTab('${k.tab}',document.querySelector('#lab-tabs .tab-btn:nth-child(${LAB_TABS.indexOf(k.tab)+1})'))"
      style="background:var(--white);border-radius:10px;padding:10px 12px;border:1px solid var(--border);border-left:4px solid ${k.color};text-align:center;cursor:pointer">
      <div style="font-size:16px">${k.icon}</div>
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:9px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

// ── Banner nilai kritis (selalu tampil di atas bila ada) ─────────
function renderCriticalBanner(){
  const el=document.getElementById('lab-critical-banner'); if(!el) return;
  const crit = labResults.filter(r=>isCriticalResult(r) && !isReleased(r) && !r.critical_ack_at);
  if(!crit.length){ el.innerHTML=''; return; }
  el.innerHTML=`
    <div style="background:var(--danger-soft);border:1.5px solid var(--danger-tint);border-left:5px solid var(--danger-strong);border-radius:10px;padding:12px 16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:var(--danger-deep);font-size:13px;margin-bottom:4px">
        ${crit.length} NILAI KRITIS belum dilaporkan
      </div>
      <div style="font-size:11.5px;color:var(--ink-10);margin-bottom:8px">
        Wajib dilaporkan ke dokter penanggung jawab beserta bukti read-back (ISO 15189).
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${crit.slice(0,8).map(r=>`
          <div style="background:var(--white);border:1px solid var(--danger-tint);border-radius:8px;padding:6px 10px;font-size:12px">
            <strong>${r.patient_name||'—'}</strong> · ${r.product_name||'—'}:
            <span style="color:var(--danger-strong);font-weight:800">${r.result_value||'—'} ${r.unit||''}</span>
            <button class="btn btn-xs" style="margin-left:6px;background:var(--danger-strong);color:var(--on-accent);border:none"
              onclick="ackCritical(${r.id})">Lapor</button>
          </div>`).join('')}
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// NILAI KRITIS — pencatatan komunikasi terstruktur (Fase 1.3)
// ISO 15189 menuntut bukti SIAPA dihubungi, KAPAN, DENGAN CARA APA,
// dan bahwa penerima MENGULANG kembali nilainya (read-back).
// Catatan teks bebas tidak memenuhi syarat itu.
// ══════════════════════════════════════════════════════════════
async function ackCritical(id){
  const r = labResults.find(x=>x.id===id);
  if(!r){ toast('Hasil tidak ditemukan','err'); return; }

  // Riwayat upaya sebelumnya — upaya yang gagal tetap harus terlihat
  const prev = await sbGet('critical_value_notifications',
    `select=*&result_id=eq.${id}&order=notified_at.desc`).catch(()=>[]);

  const ambang = [
    r.critical_low  != null ? `< ${r.critical_low}`  : null,
    r.critical_high != null ? `> ${r.critical_high}` : null,
  ].filter(Boolean).join(' atau ') || '—';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Pelaporan Nilai Kritis</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>

    <div style="background:var(--danger-soft);border:1px solid var(--danger-tint);border-radius:8px;padding:12px 14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--danger-deep)">${r.patient_name||'—'}</div>
      <div style="font-size:12.5px;margin-top:3px">${r.product_name||'—'}:
        <b style="color:var(--danger-strong);font-size:15px">${r.result_value||'—'} ${r.unit||''}</b></div>
      <div style="font-size:11.5px;color:var(--ink-10);margin-top:2px">Ambang kritis: ${ambang}</div>
    </div>

    ${prev.length?`
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:6px">
        Riwayat upaya (${prev.length})</div>
      ${prev.map(p=>`
        <div style="font-size:11.5px;padding:6px 9px;background:var(--bg2);border-radius:6px;margin-bottom:4px">
          <b>${p.attempt_status==='Berhasil'?'✅':'⚠️'} ${p.notified_to||'—'}</b>
          <span style="color:var(--gray)">(${p.notified_role||'—'}) · ${p.method||'—'} ·
          ${p.notified_at?new Date(p.notified_at).toLocaleString('id-ID'):'—'} · oleh ${p.notified_by||'—'}</span>
          ${p.response?`<div style="margin-top:2px">Instruksi: ${p.response}</div>`:''}
        </div>`).join('')}
    </div>`:''}

    <div class="form-row">
      <div class="form-group"><label>Dilaporkan kepada *</label>
        <input type="text" id="cv-to" placeholder="dr. Sinta Wijaya"></div>
      <div class="form-group"><label>Peran</label>
        <select id="cv-role">${['Dokter','DPJP','Perawat','Bidan','Lainnya'].map(x=>`<option>${x}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Cara</label>
        <select id="cv-method">${['Telepon','WhatsApp','Langsung'].map(x=>`<option>${x}</option>`).join('')}</select></div>
      <div class="form-group"><label>Waktu lapor</label>
        <input type="datetime-local" id="cv-at" value="${new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}"></div>
    </div>
    <div class="form-group"><label>Hasil upaya</label>
      <select id="cv-status" onchange="cvToggleReached()">
        <option value="Berhasil">Berhasil — penerima menerima laporan</option>
        <option value="Tidak Terjangkau">Tidak terjangkau — perlu upaya ulang</option>
      </select></div>

    <div id="cv-reached">
      <div class="form-group" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="cv-readback" style="width:auto" checked>
        <label style="margin:0">Penerima <b>mengulang kembali</b> nilai &amp; nama pasien (read-back)</label>
      </div>
      <div class="form-group"><label>Instruksi / tindakan dari penerima</label>
        <textarea id="cv-response" rows="2" placeholder="mis. pasien diminta segera ke IGD"></textarea></div>
    </div>

    <div class="form-group"><label>Catatan tambahan</label>
      <input type="text" id="cv-notes"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-danger" onclick="saveCriticalNotification(${id})">Simpan Pelaporan</button>
    </div>`, 'wide');
}

function cvToggleReached(){
  const st = document.getElementById('cv-status')?.value;
  const box = document.getElementById('cv-reached');
  if (box) box.style.display = st==='Berhasil' ? 'block' : 'none';
}

async function saveCriticalNotification(id){
  const r = labResults.find(x=>x.id===id) || {};
  const to     = document.getElementById('cv-to').value.trim();
  const status = document.getElementById('cv-status').value;
  if(!to){ toast('Nama penerima laporan wajib diisi','err'); return; }

  const readback = document.getElementById('cv-readback')?.checked || false;
  if(status==='Berhasil' && !readback){
    if(!confirm('Read-back belum dicentang. ISO 15189 mensyaratkan penerima mengulang kembali nilainya. Tetap simpan?')) return;
  }

  const atLocal = document.getElementById('cv-at').value;
  const notifiedAt = atLocal ? new Date(atLocal).toISOString() : new Date().toISOString();
  const ambang = [
    r.critical_low  != null ? `< ${r.critical_low}`  : null,
    r.critical_high != null ? `> ${r.critical_high}` : null,
  ].filter(Boolean).join(' atau ') || null;

  try {
    await sbPost('critical_value_notifications', {
      result_id: id, sample_id: r.sample_id||null, admission_id: r.admission_id||null,
      patient_name: r.patient_name||'', test_name: r.product_name||'',
      result_value: String(r.result_value||''), unit: r.unit||'',
      critical_range: ambang,
      notified_by: labUser(), notified_to: to,
      notified_role: document.getElementById('cv-role').value,
      method: document.getElementById('cv-method').value,
      notified_at: notifiedAt,
      readback: status==='Berhasil' ? readback : false,
      response: status==='Berhasil' ? (document.getElementById('cv-response').value.trim()||null) : null,
      attempt_status: status,
      notes: document.getElementById('cv-notes').value.trim()||null,
      updated_at: new Date().toISOString(),
    });

    // Hasil hanya dianggap tuntas bila upaya BERHASIL.
    // Upaya gagal tetap tercatat, dan hasil tetap muncul di banner.
    if(status==='Berhasil'){
      await sbPatch('lab_results', id, {
        critical_ack_by:   labUser(),
        critical_ack_at:   new Date().toISOString(),
        critical_ack_note: `Dilaporkan ke ${to} via ${document.getElementById('cv-method').value}`,
        critical_notified_at: notifiedAt,
        critical_notified_by: labUser(),
      });
    }

    if (typeof logActivity==='function')
      logActivity('critical_notify','lab_results',id,
        `Nilai kritis ${r.product_name||''} ${r.result_value||''} dilaporkan ke ${to} (${status})`,
        r.patient_name||'');

    toast(status==='Berhasil' ? '✅ Pelaporan tercatat' : '⚠️ Upaya tercatat — hasil tetap perlu tindak lanjut','ok');
    closeModalForce();
    await loadLabResults(); renderCriticalBanner(); renderLabKPI();
  } catch(e){
    toast('❌ '+e.message+' — jalankan supabase_fase1_fondasi.sql bila tabel belum ada','err');
  }
}