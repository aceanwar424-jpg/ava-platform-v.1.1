# PETA MENU AVA GLOBAL

> **Dibangkitkan otomatis dari [`config/menu.json`](../config/menu.json).**
> Jangan disunting tangan — jalankan `node scripts/bangun-menu.js`.
>
> Berkas ini dan menu di dalam aplikasi berasal dari sumber yang sama,
> sehingga keduanya tidak bisa lagi menyimpang.

Keterangan status: 🟢 ada · 🟡 sebagian · ⚪ struktur saja, belum dibuat

---

## 1. RUANG KERJA (SUBDOMAIN)

| Subdomain | Ruang | Peran | Kategori menu |
|---|---|---|---|
| `ops.avahealth.sbs` | Holding HQ — CEO Cockpit | Pemantauan penuh lintas seluruh unit usaha. SATU-SATUNYA ruang yang melihat semua kategori. | **semua kategori** |
| `tech.avahealth.sbs` | AVA Tech — Pembangun & Penjual Sistem | Tim brand Tech: penguasa pengembangan sistem sekaligus komersialisasinya. Langsung ke halaman masuk. | tech, marketing, keuangan, sdm, konfigurasi, agentic |
| `his.avahealth.sbs` | HIS — Klinik & Seluruh Layanan Non-Lab | Seluruh sistem klinik: rawat jalan, rawat inap, radiologi, farmasi, home care, MCU korporat. Semua yang BUKAN laboratorium. | his, avahealth, korporat, keuangan, mutu, sdm, konfigurasi |
| `lis.avahealth.sbs` | LIS — Laboratorium Diagnostik | Seluruh alur laboratorium: pra-analitik, analitik, pasca-analitik, master data tes, rujukan, dan logistik reagen. | lis, logistik, mutu, konfigurasi |
| `wellness.avahealth.sbs` | Wellness — Nutrition & Personal Care | Gabungan AVA Nutrition dan AVA Care di bawah satu payung wellness, ditambah Sanctuary. Sebelumnya terpecah tiga subdomain dengan isi yang sama. | wellness, marketing, keuangan, logistik, konfigurasi |

**Total menu terpetakan:** 147 — 🟢 128 ada · 🟡 4 sebagian · ⚪ 15 belum dibuat

---

## 2. STRUKTUR MENU PER KATEGORI

### Holding HQ

`utama`

**Pemantauan**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Dashboard Operasional Holding | `dashboard` | Ringkasan lintas 6 pilar dari kueri nyata |
| 🟢 | Pusat Kendali Operasional | `ops-kendali` | Apa yang perlu ditangani sekarang, lintas unit |
| 🟢 | CEO Master Cockpit | `executive-dashboard` | P&L 6 pilar, tenant aktif, burn rate, BEP |
| 🟢 | Konsolidasi Finansial 6 Pilar | `holding-finance` | EBITDA konsolidasi & metrik investor |

**Gerbang Sistem Lain**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| ⚪ | Portal Konsumen | `apps-hub` | Pintasan ke portal pasien, korporat & wellness |
| ⚪ | Perangkat Pendukung | `support-hub` | Pintasan ke kiosk, TV antrian, monitor CRM |

---

### AVA Tech

`tech`

**Pengembangan Sistem**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Cockpit AVA Tech | `saas-console` | Kesehatan mesin platform & ringkasan klien |
| ⚪ | Roadmap & Rilis | `tech-roadmap` | Rencana versi, catatan rilis, status fase |
| ⚪ | Katalog Modul & Versi | `tech-modul` | Daftar modul yang dilisensikan beserta versinya |
| ⚪ | Lacak Bug & Permintaan | `tech-isu` | Antrean perbaikan dan permintaan fitur dari klien |
| 🟢 | Database Studio | `db-studio` | Inspeksi tabel Postgres & SQL editor |
| 🟢 | Jejak Audit Sistem | `audit` | Log kronologis perubahan data sensitif |

**Klien & Lisensi**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Tenant & Klien Faskes | `tenants` | Faskes pemakai sistem, paket, kuota & pemakaian |
| 🟢 | Lisensi Instalasi | `lisensi` | Status lisensi Ed25519 & sidik mesin |
| ⚪ | Penerbitan & Aktivasi Lisensi | `tech-aktivasi` | Buat berkas lisensi untuk mesin klien |
| ⚪ | Telemetri Instalasi Klien | `tech-telemetri` | Versi terpasang, kesehatan, dan pemakaian per klien |

**Komersial Sistem**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Prospek Klien SaaS | `leads` | Faskes calon pengguna, dari perkenalan ke kontrak |
| 🟢 | Penawaran Lisensi | `penawaran` | Surat penawaran paket SaaS HIS/LIS |
| 🟢 | Kontrak & PKS Lisensi | `mou` | Perjanjian lisensi & pengingat perpanjangan |
| ⚪ | Paket & Daftar Harga | `tech-harga` | Definisi paket lisensi beserta kuota dan tarifnya |
| 🟢 | Tagihan Langganan | `finance` | Faktur langganan klien & status pelunasan |

**Interoperabilitas**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Ekspor Katalog LOINC/UCUM | `catalog-export` | Aset utama yang dilisensikan ke klien |
| 🟡 | Jembatan SATUSEHAT | `satusehat` | Bridging HL7 FHIR Kemenkes; pemeriksa status belum ada |
| 🟡 | Konektor Analyzer | `tech-analyzer` | ASTM E1381/E1394 di porta 9999; layar pengaturannya belum ada |
| 🟢 | Monitor Kuota AI Gateway | `agentic` › agentic-apimonitor | Pemakaian kunci API & rotasi terpusat |

**Tim Tech**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Anggota Tim Tech | `hrd` | Data personel unit Tech |
| ⚪ | Sprint & Beban Kerja | `tech-sprint` | Pembagian tugas dan kapasitas tim |

---

### Klinik & HIS

`his`

**Alur Pasien**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Pendaftaran & Admisi | `admission` | Registrasi pasien, general consent, gelang identitas |
| 🟢 | Antrian Poli | `queue` | Pemanggilan bersuara & layar ruang tunggu |
| 🟢 | Kiosk Mandiri Pasien | `queue-kiosk` | Ambil nomor sendiri di lobi |
| 🟢 | Jadwal Dokter & Perjanjian | `appointments` | Reservasi konsultasi & pengingat |

**Pelayanan Klinis**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | EMR SOAP & CPPT | `emr-soap` | Rekam medis elektronik dokter, ICD-10/9CM |
| 🟢 | Anamnesa & Tanda Vital | `anamnesa` | Keluhan, riwayat, dan pemeriksaan awal |
| 🟢 | Rawat Inap & Bed Management | `inpatient` | Mutasi tempat tidur & resume pulang |
| 🟢 | Arsip Rekam Medis | `medrecord` | Riwayat kunjungan dan berkas pasien |

**Penunjang Non-Lab**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Radiologi & RIS | `radiology` | Order, worklist, dan hasil bacaan radiologi |
| 🟡 | PACS & DICOM Viewer | `pacs-viewer` | Viewer siap; sumber citra DICOM belum tersambung |
| 🟢 | Penunjang Diagnostik (EKG, Audiometri, Spirometri) | `supportive` | Pemeriksaan penunjang non-lab: EKG 12 lead, treadmill, audiometri, faal paru |
| 🟢 | Farmasi & E-Prescription | `farmasi` | Resep elektronik, skrining interaksi, stok FEFO |

**Home Care**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Order Kunjungan Rumah | `homecare` | Sampling, infus, perawatan luka ke rumah |
| 🟢 | Penjadwalan & Dispatch Nakes | `hc-schedule` | Plotting nakes dan pelacakan keberangkatan |
| 🟢 | Master Tenaga Kesehatan | `hc-staff` | STR/SIP, kompetensi, zona layanan |
| 🟢 | Tarif & Komisi Home Care | `hc-tariff` | Tarif tindakan, zonasi, bagi hasil |
| 🟢 | Penagihan & Fee Nakes | `hc-billing` | Rekap fee kunjungan dan pencairan |
| 🟢 | Laporan Kinerja & CSAT | `hc-report` | Volume kunjungan, ketepatan waktu, kepuasan |

**Kepatuhan & Klaim**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Klaim BPJS & INA-CBG | `bpjs-claim` | Grouper tarif & bridging VClaim |
| 🟡 | Integrasi SATUSEHAT | `satusehat` | Pengiriman Encounter & Condition ke Kemenkes |
| 🟢 | Izin & Kepatuhan Faskes | `compliance-tracker` | Masa berlaku izin operasional dan SIP nakes |
| 🟢 | Laporan RL Kemenkes | `rl-reports` | Rekapitulasi RL terisi dari data operasional |

---

### Laboratorium LIS

`lis`

**Pra-Analitik**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Penerimaan Sampel & Barcode | `lab` | Check-in spesimen dan cetak label tabung |
| 🟢 | Order Lab & Label Sampel | `anamnesa` | Pembentukan order dan label dari admisi |
| ⚪ | Verifikasi Kelayakan Spesimen | `lis-kelayakan` | Penolakan spesimen ISO 15189 klausul 7.2.6 |

**Analitik**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Worklist Analyzer | `worklist` | Antrean kerja per alat |
| 🟢 | Input Hasil & Delta Check | `lab` › lab-result | Entry hasil dan peringatan terhadap riwayat |
| 🟢 | QC Westgard & Levey-Jennings | `lab` › lab-qc | Kendali mutu harian dan telemetri alat |
| ⚪ | Master Alat & Interfacing | `lis-analyzer` | Konfigurasi analyzer dan pemetaan kanal |

**Pasca-Analitik**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Validasi dr. Sp.PK | `lab` › lab-validation | Verifikasi medis nilai kritis dan interpretasi |
| 🟢 | Approval & Rilis PDF | `lab` › lab-approval | TTE QR dan pengiriman hasil ke pasien |
| 🟢 | Arsip Hasil Laboratorium | `lab` › lab-report | Riwayat hasil dan tren analit |
| 🟢 | Turnaround Time (TAT) | `lab-tat` | Durasi tiap tahap dan bottleneck |

**Master Data Lab**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Katalog Tes & Tarif | `product` | 530+ parameter, kunci kode_material terjaga |
| 🟢 | Paket & Panel Pemeriksaan | `package` | Susunan panel dan paket MCU |
| 🟢 | Nilai Rujukan | `refrange` | Rentang per usia, jenis kelamin, satuan |
| 🟢 | Ekspor Katalog LOINC/UCUM | `catalog-export` | Katalog terstandarisasi siap-LIS |
| 🟢 | Format Hasil PDF Lab | `labreport` | Kop surat, tanda tangan, dan tata letak lembar hasil |
| 🟢 | Peninjau Deskripsi Tes | `test-reviewer` | Penyuntingan massal deskripsi 530+ tes ke bahasa awam |

**Rujukan & Perujuk**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Rujukan Lab Rekanan | `referral` | Kirim spesimen keluar dan rekonsiliasi biaya |
| 🟢 | Dokter & Klinik Perujuk | `perujuk` | Tarif komisi rujukan dan pencairan |
| 🟢 | Akses Portal Perujuk | `portal-akses` | Tautan bertoken untuk pihak luar |

**Reagen & BHP**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Stok Reagen & BHP | `inventory` | Saldo stok per gudang dan unit |
| 🟢 | Resep BHP per Pemeriksaan | `inventory` › inventory-recipe | Pemotongan stok otomatis per tes |
| 🟢 | Pesanan Pembelian Reagen | `inventory` › inventory-po | PO ke supplier dan penerimaan barang |

---

### Korporat & MCU

`korporat`

> Terintegrasi utamanya ke HIS — peserta MCU masuk sebagai pasien klinik.

**Klien & Proyek**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Database Klien Korporat | `corporate` | Perusahaan klien, PIC, dan kontraknya |
| 🟢 | Proyek MCU & Roster | `mcu` | MCU massal, import roster, sertifikat sehat |
| 🟢 | Akses Portal Korporat | `portal-akses` | Tautan bertoken; izin kelola roster per tautan |

**Komersial B2B**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Prospek Korporat | `leads` | Funnel klien perusahaan baru |
| 🟢 | Penawaran Paket MCU | `penawaran` | Quotation resmi sampai terbit PO |
| 🟢 | MOU & PKS Korporat | `mou` | Perjanjian kerja sama dan perpanjangannya |
| 🟢 | Klaim Asuransi & TPA | `bpjs-claim` | Penagihan jaminan korporat |

---

### Wellness — Nutrition & Care

`wellness`

> Penggabungan AVA Nutrition, AVA Care (FMCG), dan Queen Sanctuary. Ketiganya sebelumnya berdiri sebagai subdomain terpisah dengan isi yang sama.

**Produk & Penjualan**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Pesanan Multi-Channel D2C | `ecommerce-oms` | Shopee, TikTok Shop, Tokopedia, web sendiri |
| 🟢 | Konsinyasi Apotek Mitra | `ecommerce-oms` › ecommerce-oms-apotek | Stok titipan di jaringan apotek |
| 🟢 | Batch & Stok FEFO | `ecommerce-oms` › ecommerce-oms-batch | Lot produksi dan peringatan kedaluwarsa |
| 🟢 | Ekspedisi & Resi | `ecommerce-oms` › ecommerce-oms-shipping | Ongkir multi-kurir dan cetak label |
| 🟢 | Langganan & Auto-Refill | `subscription` | Pengiriman rutin bulanan member |

**Layanan Wellness**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Reservasi Treatment | `sanctuary-booking` | Jadwal sesi terapi dan alokasi terapis |
| 🟢 | Member VIP & Saldo Sesi | `sanctuary-booking` › sanctuary-members | Tier member dan kuota sesi tersisa |
| 🟢 | Okupansi Ruangan | `sanctuary-booking` › sanctuary-rooms | Status suite dan waktu sanitasi |
| 🟢 | Katalog Paket Terapi | `sanctuary-booking` › sanctuary-menu | Paket pemulihan dan perawatan |

**Formulasi & Produksi**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| ⚪ | Formulasi & R&D Produk | `wellness-rnd` | Pengembangan formula nutraseutikal |
| ⚪ | Kemitraan Maklon | `wellness-maklon` | Produksi CPOTB/CPKB pihak ketiga |
| ⚪ | Uji Mutu Produk ke Lab | `wellness-mutu` | Order uji mikrobiologi ke AVA Lab |

---

### Keuangan

`keuangan`

**Kasir**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Kasir POS Multi-Payment | `cashier` | Tunai, QRIS, kartu, split bill |
| 🟢 | Shift Kasir & Berita Acara | `cashier` › cashier-shift | Buka/tutup shift dengan rekonsiliasi |

**Piutang & Tagihan**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Invoice & Tagihan | `finance` | Faktur resmi dan monitoring pelunasan |
| 🟢 | Umur Piutang | `ar-aging` | Tagihan lewat tempo per kelompok umur |
| 🟢 | Hutang Usaha | `payables` | Jadwal pembayaran supplier |

**Pembukuan**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Buku Besar & Akuntansi | `accounting` | Jurnal otomatis terintegrasi COA |
| 🟢 | Laporan Laba Rugi | `finance` › finance-report | Pendapatan, HPP, beban, net margin |
| 🟢 | Aset Tetap & Kalibrasi | `assets` | Inventaris alat, penyusutan, kalibrasi |
| 🟢 | Penggajian | `payroll` | Gaji, tunjangan, BPJS, PPh 21 |

---

### Inventori & Logistik

`logistik`

**Persediaan**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Stok Barang | `inventory` | Saldo stok dan batas minimum |
| 🟢 | Pengeluaran Barang | `inventory` › inventory-issue | Bon mutasi ke unit pemakai |
| 🟢 | Stock Opname | `inventory` › inventory-opname | Hitung fisik dan berita acara selisih |
| 🟢 | Kartu Stok | `inventory` › inventory-ledger | Mutasi per lot/batch |

**Pengadaan**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Permintaan Pembelian | `inventory` › inventory-pr | Pengajuan berjenjang |
| 🟢 | Pesanan Pembelian | `inventory` › inventory-po | PO, penerimaan, retur |
| 🟢 | Master Supplier | `inventory` › inventory-supplier | Data pemasok dan kategorinya |
| 🟢 | Perencanaan MRP | `inventory` › inventory-mrp | Reorder point dan rekomendasi beli |

---

### SDM & HRD

`sdm`

**Personalia**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Database Karyawan | `hrd` | Biodata staf seluruh unit |
| 🟢 | Struktur Organisasi | `org-structure` | Bagan hierarki departemen |

**Kehadiran**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Jadwal Kerja & Roster | `work-schedule` | Shift jaga dan jadwal fleksibel |
| 🟢 | Kalender Shift | `shift-calendar` | Kalender bulanan staf bertugas |
| 🟢 | Presensi GPS | `attendance` | Log kehadiran dengan validasi lokasi |

**Produktivitas**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Manajemen Tugas | `tasks` | Penugasan, tenggat, dan status pekerjaan tim |

---

### Mutu, Legal & Administrasi

`mutu`

**Kepatuhan**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Compliance & Legal Tracker | `compliance-tracker` | Izin operasional, SIP, BPOM, Halal |
| 🟢 | Pelaporan & Audit Regulator | `regulatory` | Laporan wajib ke regulator |
| 🟢 | Jejak Audit | `audit` | Log perubahan data sensitif |

**Dokumen**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Dokumen Mutu & SOP | `wiki` | SOP, instruksi kerja, formulir mutu |
| 🟢 | Surat Keluar & Penomoran | `surat` | Korespondensi resmi bernomor |
| 🟢 | Master Rekanan & Vendor | `partners` | Mitra bisnis dan supplier |

---

### AI Agentic Suite

`agentic`

**Orkestrasi**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Agentic Orchestrator | `agentic` | Pusat orkestrasi multi-agent |
| 🟢 | Monitor Kuota API | `agentic` › agentic-apimonitor | Sisa kuota dan rotasi kunci |
| 🟢 | Approval Inbox | `agentic` › agentic-inbox | Mandat R1-R3 yang menunggu persetujuan |

---

### Portal Konsumen

`konsumen`

> Aplikasi terpisah, bukan rel menu internal. Didaftarkan di sini agar pemetaannya terlihat utuh.

**Portal**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Portal Pasien Individual | `portal-pasien` | apps.avahealth.sbs — booking, hasil, telekonsul |
| 🟢 | Portal Klien Korporat | `portal-korporat` | corp.avahealth.sbs — kelola karyawan, requestor & approver |
| ⚪ | Portal Wellness | `portal-wellness` | wellness.avahealth.sbs — nutrition & personal care |

---

### Pengaturan Sistem

`konfigurasi`

**Sistem**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Pusat Pengaturan | `settings` | Profil faskes, kop surat, format PDF |
| 🟢 | Pengguna & Hak Akses | `settings` › users | RBAC per peran dan per halaman |
| 🟢 | Impor & Ekspor Data | `import` | Unggah data awal via XLSX/CSV |
| 🟢 | Registri Keluarga | `family` | Relasi antar pasien satu keluarga |

---

### Marketing, CRM & Growth

`marketing`

**Prospecting**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Maps Prospecting | `maps` | Pencarian faskes/apotek calon klien di peta, radius overlay & seleksi massal |
| 🟢 | Leads & Pipeline CRM | `leads` | Prospek masuk, tahap tindak lanjut, dan penanggung jawabnya |
| 🟢 | Papan Pipeline CRM | `crm-pipeline` | Papan kanban tahap penjualan |
| 🟢 | Corong Penjualan | `sales-corong` | Konversi per tahap: inquiry, presentasi, penawaran, closing |

**Kampanye & Promo**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Pusat Marketing | `marketing` | Ringkasan kanal, materi promosi, dan aktivitas kampanye |
| 🟢 | Campaign & Voucher | `voucher` › campaigns | Kupon diskon, promo musiman, dan broadcast voucher |
| 🟢 | Penawaran Harga | `penawaran` | Quotation resmi sampai terbit PO |

**Kemitraan & Kinerja**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Dokter & Klinik Perujuk | `perujuk` | Tarif komisi rujukan dan pencairannya |
| 🟢 | Target & OKR Tim | `okr` | Sasaran kuartal dan capaiannya |
| 🟢 | Monitor CRM Layar Besar | `leads` › mkt-crmtv | Layar target omzet & closing rate harian |

---

### AVA Health — Telehealth & Trust Layer

`avahealth`

> KBLI 86910. Modulnya sudah ada dengan tujuh tampilan, tetapi tidak pernah punya satu pun entri menu.

**Layanan Jarak Jauh**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Telekonsultasi Dokter | `ava-consult` | Konsultasi jarak jauh pasien-dokter |
| 🟢 | Caregiver & Pendamping | `ava-caregiver` | Penugasan pendamping perawatan di rumah |

**Perangkat & Kalibrasi**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Alat Medis & Wearables | `ava-devices` | Telemetri IoT perangkat pasien |
| 🟢 | Badge AVA Verified | `ava-calibration` | Sertifikasi kalibrasi alat oleh lab |
| 🟢 | Marketplace Alkes | `ava-marketplace` | Katalog alat kesehatan dan portal vendor |

**Kanal & Mitra**

| | Menu | Halaman | Keterangan |
|---|---|---|---|
| 🟢 | Kanal Korporat B2B | `ava-corporate` | Paket telehealth untuk perusahaan |
| 🟢 | Portal Multi-Peran | `ava-portals` | Tampilan admin, pelanggan, dokter, dan vendor |

---

## 3. PORTAL KONSUMEN

Aplikasi konsumen berdiri sendiri di luar rel menu internal. Struktur menunya dicatat di sini supaya pemetaannya lengkap.

### Portal Pasien Individual

- **Subdomain:** `apps.avahealth.sbs`
- **Cara masuk:** akun pasien

| | Menu | Keterangan |
|---|---|---|
| 🟢 | Beranda & Riwayat | — |
| 🟢 | Booking Pemeriksaan | — |
| 🟡 | Hasil & Unduh PDF | Tersedia setelah hasil dirilis dokter |
| ⚪ | Telekonsultasi | — |
| 🟡 | Pesan Home Care | — |
| ⚪ | Tagihan & Pembayaran | — |

### Portal Klien Korporat

- **Subdomain:** `corp.avahealth.sbs`
- **Cara masuk:** akun korporat — peran requestor / approver diatur di HIS
- **Integrasi:** Terintegrasi utamanya ke HIS: peserta MCU masuk sebagai pasien klinik.

| | Menu | Keterangan |
|---|---|---|
| 🟢 | Beranda Perusahaan | — |
| 🟢 | Master Karyawan | Tambah, ubah, dan keluarkan karyawan |
| 🟢 | Assign Paket MCU | Tetapkan paket per karyawan, kuota kontrak ditegakkan |
| 🟢 | Ajukan Jadwal MCU | Peran requestor |
| 🟢 | Persetujuan Pengajuan | Peran approver |
| 🟢 | Riwayat Pemeriksaan | Status saja, tanpa hasil klinis |
| 🟢 | Tagihan & Kwitansi | — |
| 🟢 | Kontrak & Kuota | — |

### Portal Wellness (Nutrition & Care)

- **Subdomain:** `wellness.avahealth.sbs`
- **Cara masuk:** akun pasien / member
- **Catatan:** Menggantikan nutri. dan care. yang sebelumnya terpisah dengan isi sama.

| | Menu | Keterangan |
|---|---|---|
| ⚪ | Katalog Produk | — |
| 🟡 | Langganan & Auto-Refill | — |
| ⚪ | Program Wellness Saya | — |
| ⚪ | Reservasi Sanctuary | — |
| ⚪ | Lacak Pesanan | — |

---

## 4. PERANGKAT PENDUKUNG

Perangkat dan layar pendukung. Bukan aplikasi bermenu — satu layar, satu tugas.

| | Perangkat | Subdomain | Keterangan |
|---|---|---|---|
| 🟢 | Kiosk Antrian Mandiri | `kiosk.avahealth.sbs` | Layar sentuh lobi: ambil nomor, cetak tiket |
| 🟢 | Display TV Ruang Tunggu | `antrian.avahealth.sbs` | Nomor antrian dan panggilan suara |
| 🟢 | Monitor CRM Penjualan | `crm.avahealth.sbs` | Layar target omzet dan pipeline harian |
| 🟢 | Aplikasi Nakes Lapangan | `nakes.avahealth.sbs` | Kunjungan home care, GPS, checklist tindakan |
| 🟢 | Pelacakan Kunjungan Publik | `lacak.avahealth.sbs` | Pasien memantau posisi nakes, bertoken |

---

## 5. SUBDOMAIN ALIAS

Subdomain lama tetap hidup dan mengarah ke ruang yang benar.
Tidak dihapus supaya tautan, bookmark, dan materi cetak yang sudah
beredar tidak mati. Yang berubah hanya isinya.

| Subdomain | Mengarah ke ruang | Halaman awal | Keterangan |
|---|---|---|---|
| `console.avahealth.sbs` | tech | `lisensi` | Pintu khusus lisensi & telemetri. Isinya bagian dari AVA Tech; dipertahankan sebagai alias, bukan ruang tersendiri. |
| `nutri.avahealth.sbs` | wellness | `ecommerce-oms` | Nutrition kini bagian dari payung Wellness. |
| `care.avahealth.sbs` | wellness | `ecommerce-oms` | Personal Care (FMCG) kini bagian dari payung Wellness. |
| `sanctuary.avahealth.sbs` | wellness | `sanctuary-booking` | Sanctuary adalah layanan wellness; masuk sebagai grup di ruang Wellness. |

