# Panduan Konfigurasi Template Dokumen Mutu & E-Hasil Laboratorium

> **Akselerator Sistem Lab — AVA QMS Platform**  
> Standar Acuan: **SNI ISO 15189:2022** • **UU PDP No. 27/2022** • **Interoperabilitas HL7 / FHIR**

---

## 1. Ikhtisar Sistem Template Fleksibel

Sistem template ini dirancang secara **deklaratif (parameter-driven)** sehingga laboratorium klinik, rumah sakit, maupun faskes mitra dapat mengubah seluruh tata letak dokumen tanpa menyentuh kode program inti.

Sistem mendukung 2 keluaran utama:
1. **Lembar Sertifikat E-Hasil Laboratorium Pasien**: Lengkap dengan tabel hasil analit, flag abnormal, nilai rujukan, metode uji, kode LOINC (OBX-3), satuan UCUM (OBX-6), dan tanda tangan elektronik tersertifikasi (QR TTE).
2. **Bundel Dokumen Sistem Manajemen Mutu (SMM ISO 15189:2022)**: Halaman sampul resmi, daftar isi modul mutu terverifikasi, dan Kotak Kendali Dokumen Mutu Standar (Header Box SOP ISO) di setiap halaman prosedur.

---

## 2. Koleksi Preset Siap Pakai (`config/template.presets.json`)

Anda dapat langsung memilih salah satu dari 5 preset bawaan:

| Kode Preset | Nama Preset | Karakteristik Tata Letak | Cocok Untuk |
| :--- | :--- | :--- | :--- |
| `standard_navy` | **Standar Medika** | Logo kiri, warna Navy (#0f2963) & Cyan, garis kop ganda | Lab klinik swasta modern |
| `formal_center` | **Resmi Instansi** | Logo tengah, teks rata tengah, border pembatas tebal | RSUD / Lab rujukan pemerintah |
| `dual_logo_partnership` | **Kemitraan Ganda** | Logo faskes di kiri + Logo Akreditasi KAN di kanan | Lab mitra RS / FKTP / Rujukan |
| `compact_slip` | **Slip Ringkas** | Margin tipis 12mm, padding baris rapat (hemat kertas) | Poli rawat jalan / Ambulatori |
| `emerald_wellness` | **Wellness & Preventive** | Aksen Emerald Green (#065f46), tata letak bersih premium | Check-up korporat & Longevity |

---

## 3. Struktur Konfigurasi Lengkap (`config/template.default.config.json`)

Berikut adalah struktur skema konfigurasi JSON beserta penjelasannya:

```json
{
  "layout": {
    "page_size": "A4",
    "orientation": "portrait",
    "page_margin_mm": {
      "top": 18,
      "bottom": 18,
      "left": 18,
      "right": 18
    },
    "font_family": "'Outfit', 'Segoe UI', Arial, sans-serif",
    "font_size_pt": 10,
    "line_height": 1.45,
    "primary_color": "#0f2963",
    "accent_color": "#0284c7",
    "text_color": "#1e293b",
    "watermark": {
      "enabled": true,
      "text": "SALINAN TERKENDALI",
      "color": "rgba(15, 41, 99, 0.04)",
      "angle_deg": -30
    }
  },

  "header_kop": {
    "logo_position": "left",
    "logo_url": "assets/logo-lab.png",
    "logo_width_px": 80,
    "logo_height_px": 80,
    "secondary_logo_text": "🏅 KAN LP-1192-IDN",
    "kop_text_align": "left",
    "institution_name_size_pt": 15,
    "institution_name_weight": "800",
    "show_accreditation_kan": true,
    "accreditation_kan_text": "TERAKREDITASI KAN LP-1192-IDN • SNI ISO 15189:2022",
    "show_divider_line": true,
    "divider_line_style": "double",
    "divider_line_color": "#0f2963",
    "divider_line_thickness_px": 3,
    "kop_spacing_bottom_px": 16
  },

  "lab_results_table": {
    "header_bg_color": "#f8fafc",
    "header_text_color": "#0f2963",
    "header_border_color": "#cbd5e1",
    "row_padding_vertical_px": 6,
    "row_padding_horizontal_px": 8,
    "alternate_row_bg": true,
    "alternate_row_bg_color": "#fbfcfe",
    "highlight_abnormal": true,
    "abnormal_badge_color": "#fee2e2",
    "abnormal_text_color": "#dc2626",
    
    "columns": [
      { "id": "analyte", "label": "PEMERIKSAAN / PARAMETER ANALIT", "width_pct": 30, "align": "left", "enabled": true, "show_loinc": true },
      { "id": "result", "label": "HASIL UJI", "width_pct": 16, "align": "right", "enabled": true, "bold": true },
      { "id": "flag", "label": "STATUS", "width_pct": 8, "align": "center", "enabled": true, "badge": true },
      { "id": "unit", "label": "SATUAN (UCUM)", "width_pct": 14, "align": "left", "enabled": true },
      { "id": "ref_range", "label": "RENTANG ACUAN", "width_pct": 18, "align": "left", "enabled": true },
      { "id": "method", "label": "METODE UJI", "width_pct": 14, "align": "left", "enabled": true },
      { "id": "specimen", "label": "SPESIMEN", "width_pct": 12, "align": "left", "enabled": false }
    ]
  },

  "smm_document_layout": {
    "cover_page": {
      "enabled": true,
      "title_size_pt": 22,
      "subtitle": "SISTEM MANAJEMEN MUTU LABORATORIUM KLINIK"
    },
    "table_of_contents": {
      "enabled": true,
      "title": "DAFTAR ISI DOKUMEN MUTU"
    },
    "document_control_header": {
      "enabled": true,
      "show_revision_history": true
    }
  },

  "signature_box": {
    "position": "right",
    "spacing_top_px": 24,
    "width_pct": 42,
    "show_qr_tte": true,
    "qr_size_px": 72,
    "qr_caption": "BSrE TTE Tersertifikasi",
    "doctor_role_title": "Dokter Penanggung Jawab Laboratorium"
  },

  "footer": {
    "show_page_number": true,
    "footer_note": "Dokumen ini diterbitkan secara elektronik dan sah sesuai regulasi UU ITE & ISO 15189:2022."
  }
}
```

---

## 4. Resep Pengaturan Praktis (Quick Recipes)

### 🅰️ Mengubah Posisi & Ukuran Logo
- **Logo di Kiri (Default):** Set `"logo_position": "left"`.
- **Logo di Tengah (Gaya RS Pemerintah):** Set `"logo_position": "center"`, `"kop_text_align": "center"`.
- **Logo di Kanan:** Set `"logo_position": "right"`.
- **Logo Ganda (Kiri & Kanan):** Set `"logo_position": "dual"`. Logo primer di sisi kiri, dan badge/logo partner di sisi kanan.
- **Mengubah Ukuran:** Sesuaikan `"logo_width_px": 90` dan `"logo_height_px": 90`.

### 🅱️ Menyesuaikan Kolom Tabel E-Hasil
- **Menyembunyikan Kolom Metode:** Pada array `columns`, cari kolom dengan `"id": "method"` lalu set `"enabled": false`.
- **Menampilkan Kolom Spesimen (Serum/EDTA):** Cari kolom `"id": "specimen"` lalu set `"enabled": true`.
- **Menyembunyikan Kode LOINC:** Pada kolom `"id": "analyte"`, ubah `"show_loinc": false`.
- **Mengubah Label Header Kolom:** Cukup ganti nilai `"label"`, misalnya `"label": "NILAI RUJUKAN NORMAL"`.
- **Mengubah Lebar Kolom:** Atur `"width_pct"` sesuai kebutuhan (total disarankan 100%).

### 🅲 Mengatur Spasi & Margin Kertas
- **Margin Kertas (mm):**
  ```json
  "page_margin_mm": { "top": 15, "bottom": 15, "left": 15, "right": 15 }
  ```
- **Spasi Bawah Kop:** Ubah `"kop_spacing_bottom_px": 20`.
- **Padding Baris Tabel:** Ubah `"row_padding_vertical_px": 4` untuk hasil rapat atau `8` untuk tampilan lapang.
- **Spasi Atas Tanda Tangan:** Ubah `"spacing_top_px": 32` pada blok `signature_box`.

### 🅳 Mengatur Blok Tanda Tangan & QR TTE
- **Posisi TTE:** Ubah `"position": "right"` | `"left"` | `"center"`.
- **Sembunyikan QR Code:** Set `"show_qr_tte": false`.

---

## 5. Alat Bantu Interaktif Visual (`tools/template_configurator.html`)

Tersedia alat bantu interaktif yang dapat dibuka langsung di peramban web:

1. Buka file [tools/template_configurator.html](file:///d:/AVAQUEEN-platform-main/tools/template_configurator.html) di browser.
2. Anda dapat:
   - Memilih preset dengan 1 klik.
   - Menggeser slider margin, spasi kop, ukuran logo, dan padding baris secara instan.
   - Mengklik tombol toggle posisi logo (Kiri / Tengah / Kanan / Ganda).
   - Mencentang / menghilangkan centang kolom tabel hasil lab.
   - Beralih antara pratinjau **E-Hasil Pasien** dan **Dokumen SMM ISO 15189**.
   - Mengklik tombol **"Lihat JSON"** untuk menyalin konfigurasi, atau **"Unduh JSON"**, atau **"Cetak / Print PDF"**.

---

## 6. Penggunaan Programatik (Node.js API)

```javascript
const { TemplateManager } = require('./lib/template_engine/template_manager');
const { ConfigurableDocGenerator } = require('./lib/template_engine/configurable_doc_generator');

const tm = new TemplateManager();
const generator = new ConfigurableDocGenerator();

// 1. Membuat konfigurasi kustom dari preset
const myConfig = tm.createQuickConfig({
  preset: 'standard_navy',
  logo_position: 'dual',
  primary_color: '#0369a1',
  hidden_columns: ['method'],
  enable_specimen_column: true
});

// 2. Render lembar hasil laboratorium pasien
const htmlHasil = generator.renderLabResultHtml(patientData, analytesList, tenantConfig, myConfig);

// 3. Render paket bundel dokumen SMM ISO 15189
const htmlSmm = generator.renderSmmBundleHtml(smmPackage, tenantConfig, myConfig);
```

---

## 7. Status Pengujian & Kepatuhan ISO 15189
- **Unit Test Template:** `scripts/uji/test_template_configuration.cjs` (13/13 Pass, 100%).
- **Asset Integration Test:** `scripts/uji/test_p3_p4_p5_all.js` (9/9 Pass, 100%).
- **Web App Frontend Regression:** `scripts/test-all-52-views.cjs` (52/52 Pass, 0 Errors).
