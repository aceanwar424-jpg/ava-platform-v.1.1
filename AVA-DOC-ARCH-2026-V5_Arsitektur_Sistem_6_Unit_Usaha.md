# ARSITEKTUR SISTEM AVA GLOBAL ECOSYSTEM
### Pemetaan Ulang Menu, Sub-Menu & Kebutuhan Implementasi 6 Unit Usaha

| | |
|---|---|
| **No. Dokumen** | AVA-DOC-ARCH-2026-V5.1 |
| **Menggantikan** | V4 (struktur 6 PT) · V5 (blueprint awal, 6 keputusan terbuka) |
| **Tanggal** | 30 Agustus 2026 |
| **Entitas Hukum** | PT AVA Health Solution — **badan hukum tunggal** |
| **Struktur Usaha** | 6 brand/entitas bisnis, legalitas disegmentasi **per KBLI** |
| **Otoritas** | CEO & Founder / Head of Operations — Ace Anwar |
| **Status** | Blueprint Restrukturisasi — **keputusan struktural terkunci** |

> **Perubahan V5 → V5.1:** tiga keputusan struktural sudah diambil dan dikunci — (a) satu badan hukum dengan segmentasi KBLI, (b) AVA Tech internal-first dengan penjualan eksternal di Fase 4, (c) seluruh modul dibangun sendiri, tanpa pembelian sistem pihak ketiga. Bab 1B, 3.2, 6.5–6.7, 13, dan 14 direstrukturisasi mengikuti ketiganya.

---

## 0. RINGKASAN KEPUTUSAN ARSITEKTUR (ADR)

Sebelum masuk menu, ini tujuh keputusan yang mengunci seluruh desain. Semua bab di bawah adalah turunan dari sini.

| ID | Keputusan | Alasan |
|---|---|---|
| **ADR-01** ✅ | **Satu badan hukum (PT AVA Health Solution), enam brand, satu platform.** Legalitas disegmentasi **per KBLI**, bukan per PT. Sistem merepresentasikannya lewat dimensi `brand_code` + `kbli_code` + `cost_center` pada setiap transaksi. | Satu buku besar dengan segmentasi, bukan enam buku besar terpisah. Perizinan tetap bisa dipecah per lini kegiatan tanpa memecah entitas. |
| **ADR-02** | **Pemisahan tegas Shared Kernel vs Unit Module.** Modul yang beririsan (HRD, Finance, Inventory, CRM, POS, Legal) hidup satu kali di kernel, dipanggil unit dengan konfigurasi & ekstensi masing-masing. | Menghindari 6 database karyawan dan 6 buku besar yang tidak pernah bisa direkonsiliasi. |
| **ADR-03** | **Master Person Index (MPI) tunggal.** Satu orang = satu `AVA-ID` seumur hidup, lintas Lab, Health, Care, Sanctuary, Nutrition. | Inilah satu-satunya alasan ekosistem ini lebih bernilai daripada 6 bisnis terpisah. Tanpa MPI, "Unified Personalized" hanya slogan. |
| **ADR-04** ✅ | **AVA Tech adalah PEMILIK platform, bukan pengguna — internal-first.** Fase 0–3 melayani lima unit internal dengan chargeback. Penjualan keluar dibuka di **Fase 4**. | Fokus dulu ke sistem yang benar-benar dipakai sendiri; produk yang belum terbukti di rumah sendiri tidak layak dijual. |
| **ADR-05** | **Routing bernamespace `unit/domain/fitur`.** Contoh: `lab/pre/checkin`, bukan `lab-checkin`. | Route flat V4 sudah mulai tabrakan (`bpjs-claim`, `mou`, `penawaran`, `cashier` muncul di 3–4 tempat). Namespace membuat RBAC & audit trail bisa diiris per domain. |
| **ADR-06** | **Lisensi modul per tenant.** Setiap modul punya flag aktif/non-aktif per unit + metering pemakaian. | Menyiapkan jalan komersialisasi platform ke faskes luar tanpa refactor. |
| **ADR-07** ✅ | **Data klinis tidak boleh keluar dari domain klinis.** Nutrition & Sanctuary tidak pernah mendapat akses baca rekam medis; mereka hanya menerima *event* dan *flag* (mis. "eligible for postnatal program"). | UU PDP No. 27/2022, PMK 24/2022, dan syarat ISO 15189 klausul kerahasiaan. |
| **ADR-08** ✅ | **Tenant-ready schema, single-tenant deployment.** `tenant_id` dan `brand_code` ditanam di **setiap tabel sejak Fase 0**, tapi UI provisioning, metering, dan self-service onboarding baru dibangun di Fase 4. | Menanam kolom sejak awal berbiaya hampir nol; menambahkannya setelah 2 juta baris data adalah migrasi berminggu-minggu. Ini cara mengambil keputusan "internal dulu" tanpa menutup pintu Fase 4. |
| **ADR-09** ✅ | **Seluruh modul dibangun sendiri** — termasuk GL/akuntansi, payroll, dan PACS. Tidak ada pembelian sistem pihak ketiga untuk fungsi inti. | Keputusan pemilik: kendali penuh atas data, tanpa biaya lisensi berulang, dan menjadi aset produk yang bisa dijual di Fase 4. **Konsekuensi biaya waktu dijabarkan di Bab 6.6 dan Bab 14.2 — bukan keputusan gratis.** |

---

## 1. REKONSILIASI: 6 PT LAMA → 6 BRAND (PORTO)

Dokumen V4 memetakan **6 PT operasional**. Company Profile memetakan **6 unit merek**. Keduanya tidak identik — ini harus diselesaikan lebih dulu, karena kalau tidak, sistem akan punya dua taksonomi yang saling bertengkar.

| Pilar V4 (lama) | Brand / Porto Baru | Nasib |
|---|---|---|
| PT AVA Diagnostika (Lab & LIS) | **AVA LAB** | Diangkat utuh + ditambah fungsi riset/R&D sesuai Company Profile. |
| PT AVA Medika Prima (Poliklinik) | **AVA HEALTH** | Diangkat utuh. |
| PT AVA Care Indonesia (Home Care) | **AVA CARE** | Diangkat utuh + diperluas ke caregiving & continuity of care. |
| PT Queen Nutrition Nusantara (FMCG) | **AVA NUTRITION** | Rebranding merek; struktur menu diperluas ke sisi **pabrik/maklon**, bukan hanya jualan. |
| PT Queen Sanctuary Wellness (Medspa) | **AVA SANCTUARY** | Rebranding merek. |
| PT AVA Mitra Korporat (B2B MCU) | **⚠ DILEBUR** | B2B/MCU bukan lini usaha — itu **kanal penjualan**. Dilebur jadi modul `health/corp/*` di AVA Health, dengan CRM di Shared Kernel. |
| — (tidak ada di V4) | **AVA TECH** | **Unit baru.** Di V4, teknologi tersembunyi sebagai "AI Agentic Suite" dan "Pengaturan Sistem". Sekarang jadi unit usaha dengan P&L sendiri. |

**Konsekuensi yang harus disadari:** menghapus AVA Mitra Korporat berarti *revenue* MCU korporat sekarang tercatat di AVA Health. Karena struktur yang dipilih adalah satu badan hukum (Bab 1B), pemisahannya dilakukan di level **KBLI dan izin operasional** — PJK3 dan sertifikasi Hiperkes berdiri sebagai lini perizinan tersendiri, sementara di sistem cukup ditandai `brand_code = HEALTH` + `kbli_code` khusus pada transaksi MCU industri.

---

## 1B. STRUKTUR LEGAL: SATU BADAN HUKUM, ENAM BRAND, SEGMENTASI KBLI

### 1B.1 Model yang Dikunci

```
                  PT AVA HEALTH SOLUTION
                  (satu NIB · satu NPWP · satu buku besar)
                            │
        ┌──────────┬────────┼────────┬──────────┬──────────┐
      HEALTH      LAB      CARE    NUTRI      TECH      SANCT
      brand_code  brand_code  ...
        │          │         │        │         │          │
      KBLI-a     KBLI-b    KBLI-c  KBLI-d,e   KBLI-f    KBLI-g,h
      + izin     + izin    + izin  + izin     (izin     + izin
      klinik     lab       nakes   BPOM/Halal  dasar)   spa/klinik
```

**Yang menjadi satu:** badan hukum, NIB induk, NPWP, buku besar, laporan pajak badan, kebijakan SDM, dan platform sistem.
**Yang dipisah:** brand & positioning pasar, KBLI, izin operasional per lini, penanggung jawab teknis, cost center, dan P&L segmen.

### 1B.2 Konsekuensi Teknis pada Sistem

| Aspek | Implikasi Desain |
|---|---|
| **Chart of Account** | Satu COA induk, dengan **dimensi segmen wajib**: `brand_code` · `cost_center` · `kbli_code` · `location_code`. Setiap jurnal wajib punya keempatnya — tidak boleh null. |
| **P&L per brand** | Dihasilkan dari agregasi dimensi, bukan dari buku besar terpisah. Konsolidasi jadi otomatis; tidak ada rekonsiliasi antar-entitas. |
| **Transaksi antar-brand** | Order Nutrition→Lab, Sanctuary→Health dicatat sebagai **transfer internal** (internal transfer pricing), muncul di P&L segmen, tapi **dieliminasi otomatis** di laporan konsolidasi PT. Wajib ada akun eliminasi khusus. |
| **Penomoran dokumen** | Format `AVA/{BRAND}/{JENIS}/{BULAN}/{TAHUN}/{URUT}` — surat, penawaran, PKS, invoice. Satu registry, prefiks per brand. |
| **Faktur & pajak** | Satu NPWP, satu seri faktur pajak. Brand hanya muncul di kop/desain, **bukan** di identitas pajak. Jangan buat kop yang menyiratkan badan hukum berbeda — itu risiko. |
| **Perizinan** | Registry izin per KBLI di `health/corp/compliance`, dengan field: KBLI, jenis izin, nomor, tanggal terbit, tanggal kedaluwarsa, penanggung jawab teknis, lokasi berlaku, dokumen terlampir, reminder H-90/60/30. |
| **Penanggung jawab teknis** | Satu orang tidak bisa jadi PJ untuk semua lini. Sistem harus memetakan `kbli_code → penanggung_jawab → STR/SIP/sertifikat` dan menolak aktivasi lini bila PJ-nya kosong atau izinnya kedaluwarsa. |

### 1B.3 Peta Lini Kegiatan → Kebutuhan Perizinan

⚠️ **Catatan penting sebelum tabel ini dipakai:** **KBLI 2025 (Peraturan BPS No. 7/2025) resmi berlaku sejak 18 Desember 2025 dan mencabut KBLI 2020**, dengan penyesuaian di sistem OSS dan AHU paling lambat 18 Juni 2026. Jumlah kelompok 5-digit menyusut dari 1.789 menjadi sekitar 1.558 kode akibat penggabungan dan pemecahan. **Karena itu tabel di bawah menyebut *lini kegiatan*, bukan kode final** — setiap kode wajib diverifikasi langsung di OSS terhadap struktur KBLI 2025 sebelum masuk akta atau NIB. Kode KBLI 2020 hanya dicantumkan sebagai jejak rujukan lama.

| Brand | Lini Kegiatan Usaha | Rujukan Lama (KBLI 2020) | Izin & Sertifikasi yang Melekat |
|---|---|---|---|
| **HEALTH** | Klinik swasta (pratama/utama, rawat jalan/inap) | 86105 Aktivitas Klinik Swasta | Izin operasional klinik (PMK 14/2021), sertifikat standar OSS-RBA risiko menengah tinggi, akreditasi klinik, SIP/STR seluruh nakes |
| **HEALTH** | Pemeriksaan kesehatan tenaga kerja (MCU industri) | lini penunjang kesehatan / kesehatan kerja | **PJK3 Kemnaker**, dokter pemeriksa bersertifikat Hiperkes, UMKU pemeriksaan kesehatan tenaga kerja |
| **HEALTH** | Radiologi diagnostik | lini penunjang di bawah izin klinik | Izin pemanfaatan sumber radiasi **BAPETEN**, petugas proteksi radiasi |
| **LAB** | Laboratorium klinik | lini pelayanan penunjang kesehatan | Izin operasional laboratorium klinik, penanggung jawab **Sp.PK**, akreditasi **ISO 15189:2022**, izin limbah B3 |
| **CARE** | Pelayanan keperawatan/kebidanan di rumah (home care) | lini praktik kesehatan oleh nakes | SIP/SIK perawat & bidan, izin penyelenggara home care, SOP kegawatdaruratan & rujukan |
| **NUTRITION** | Industri/maklon suplemen & pangan olahan | lini industri produk pangan/obat tradisional | **Izin edar BPOM** per SKU, **sertifikat Halal BPJPH**, **CPOTB/CPPOB** (di pihak maklon), penanggung jawab teknis apoteker/tenaga teknis |
| **NUTRITION** | Perdagangan besar & eceran (D2C, konsinyasi) | lini perdagangan besar/eceran | Izin distribusi, perjanjian konsinyasi, kepatuhan platform marketplace |
| **TECH** | Pengembangan & jasa perangkat lunak | **⚠ 63122 (Portal Web & Platform Digital) DIHAPUS di KBLI 2025** dan dipecah ke kode spesifik per sektor yang diintermediasi | Kode pengganti **wajib dipilih ulang** sesuai sektor kesehatan; UU PDP 27/2022, kebijakan privasi & DPIA, perjanjian pemrosesan data dengan tenant |
| **SANCTUARY** | Perawatan kebugaran/spa & wellness non-medis | lini pelayanan kesehatan tradisional / kebugaran | Izin usaha spa/kebugaran, sertifikasi terapis, sertifikat higiene sanitasi |
| **SANCTUARY** | Tindakan medis estetika (bila diselenggarakan) | di bawah payung izin klinik | **Harus di bawah izin klinik AVA Health** dengan dokter penanggung jawab — tidak boleh berdiri di bawah izin spa |

> **Peringatan yang paling sering menjatuhkan struktur seperti ini:** batas antara *wellness* (Sanctuary) dan *tindakan medis* (Health). Begitu ada penetrasi kulit, injeksi, resep obat keras, atau diagnosis, kegiatan itu **wajib** berada di bawah izin klinik dan pengawasan dokter — meskipun brand yang tercetak di dinding bertuliskan Sanctuary. Sistem harus memaksakan ini: katalog treatment `sanct/program/catalog` wajib punya flag `is_medical_procedure`, dan treatment ber-flag hanya bisa dijadwalkan bila ada dokter penanggung jawab aktif.

### 1B.4 Modul Baru yang Lahir dari Keputusan Ini

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Registry Brand & Segmen | `hq/legal/brands` | Master brand, `brand_code`, prefiks dokumen, kop surat, cost center terkait. |
| Registry KBLI & Izin | `hq/legal/kbli-registry` | Daftar KBLI aktif, izin melekat, PJ teknis, masa berlaku, dokumen, riwayat konversi KBLI 2020→2025. |
| Matriks Kegiatan vs Izin | `hq/legal/activity-matrix` | Memetakan setiap layanan yang dijual ke KBLI & izin yang menaunginya. **Menjawab "layanan ini sah dijual di bawah izin yang mana?" dalam satu klik saat inspeksi.** |
| Transfer Pricing Antar-Brand | `hq/finance/internal-transfer` | Tarif internal antar-brand, jurnal otomatis, akun eliminasi konsolidasi. |
| Kalender Kepatuhan | `hq/legal/compliance-calendar` | Semua jatuh tempo: izin, akreditasi, STR/SIP, BPOM, Halal, kalibrasi, LKPM. |

---

## 2. LAYER ARSITEKTUR

```
┌──────────────────────────────────────────────────────────────────────┐
│  L0  AVA GLOBAL GROUP — HOLDING COCKPIT                              │
│      Konsolidasi P&L 6 unit · Krisis lintas unit · Lisensi tenant    │
└──────────────────────────────────────────────────────────────────────┘
                                  ▲ agregasi
┌──────────────────────────────────────────────────────────────────────┐
│  L1  SHARED KERNEL  (dimiliki & dioperasikan AVA TECH)               │
│  MPI · IAM/RBAC · Audit Trail · Finance & GL · HRD · Inventory       │
│  CRM · POS · Legal & Doc Control · Asset · BI/DWH · Notification     │
└──────────────────────────────────────────────────────────────────────┘
        ▲            ▲            ▲            ▲            ▲
┌───────┴───┐ ┌──────┴────┐ ┌─────┴─────┐ ┌────┴─────┐ ┌────┴──────┐
│ AVA LAB   │ │ AVA HEALTH│ │ AVA CARE  │ │AVA NUTRI │ │AVA SANCT. │
│   LIS     │ │  HIS/EMR  │ │ Home Care │ │ Pabrik+  │ │ Wellness  │
│  + R&D    │ │ +Corporate│ │ +Caregive │ │ D2C      │ │ Ops       │
└───────────┘ └───────────┘ └───────────┘ └──────────┘ └───────────┘
        ▲            ▲            ▲            ▲            ▲
┌──────────────────────────────────────────────────────────────────────┐
│  L2  CHANNEL LAYER   Patient App · Nakes App · Doctor App · Kiosk    │
│      TV Queue Display · Web Portal · WhatsApp Bot · Marketplace API  │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│  L3  INTEGRATION LAYER  (AVA TECH)                                   │
│      SATUSEHAT FHIR · BPJS VClaim · Analyzer HL7/ASTM · Payment      │
│      Gateway · Marketplace · Ekspedisi · Dukcapil · BPOM/e-Reg       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. SHARED KERNEL — MODUL BERIRISAN & POLA PEMAKAIANNYA

Ini menjawab poin 3 permintaan: modul yang sama dipakai banyak porto tapi **kebutuhannya tidak identik**.

### 3.1 Notasi
- **M** = Master/Owner (unit ini yang memiliki definisi & tata kelola modul)
- **I** = Instance + Ekstensi (pakai kernel, tapi butuh field/alur tambahan khas unit)
- **C** = Consumer (pakai apa adanya)
- **–** = Tidak dipakai

### 3.2 Matriks Kepemilikan Modul

| Modul Kernel | HQ | LAB | HEALTH | CARE | NUTRI | TECH | SANCT |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| MPI / Master Person Index | C | I | **M** | I | C | C | I |
| IAM, RBAC & SSO | C | C | C | C | C | **M** | C |
| Audit Trail & e-Sign | C | I | I | C | C | **M** | C |
| Finance, GL & Akuntansi | **M** | C | I | C | I | C | C |
| Kasir POS & Shift | – | I | **M** | – | – | – | I |
| AR / Piutang Korporat | I | C | **M** | C | I | C | C |
| HRD Inti (biodata, payroll, cuti) | **M** | C | C | C | C | C | C |
| HRD — Kredensial Nakes (STR/SIP) | C | I | **M** | I | – | – | I |
| HRD — Shift & Roster | **M** | I | I | I | I | – | I |
| HRD — Produksi & K3 Pabrik | C | – | – | – | **M** | – | – |
| Inventory & Gudang | C | I | I | I | **M** | C | I |
| Procurement (PR/PO/Supplier) | I | C | C | C | **M** | I | C |
| MRP / Perencanaan Material | – | I | – | – | **M** | – | – |
| CRM & Pipeline | C | C | **M** | C | I | I | I |
| Marketing & Campaign | **M** | C | C | C | I | C | I |
| Legal, PKS/MoU & Surat Keluar | **M** | C | I | C | C | C | C |
| Document Control & QMS | C | **M** | I | C | I | C | C |
| Aset Tetap & Kalibrasi | C | **M** | I | C | I | I | I |
| BI / Data Warehouse | C | C | C | C | C | **M** | C |
| Notifikasi (WA/SMS/Email/Push) | – | C | C | C | C | **M** | C |
| Lisensi & Tenant Management | C | – | – | – | – | **M** | – |
| **Dimensi Brand/KBLI/Segmen** | **M** | C | C | C | C | I | C |
| **Registry Izin & PJ Teknis** | **M** | I | I | I | I | C | I |
| **Transfer Pricing Internal** | **M** | C | C | C | C | C | C |
| **GL Engine** (dibangun sendiri) | C | – | – | – | – | **M** | – |
| **Payroll Engine** (dibangun sendiri) | C | – | – | – | – | **M** | – |
| **PACS/DICOM Server** (dibangun sendiri) | – | C | I | – | – | **M** | – |

> Tiga baris terakhir adalah konsekuensi langsung **ADR-09**. Perhatikan polanya: HQ dan Health tetap *pemilik proses bisnis*-nya (kebijakan akuntansi, kebijakan payroll, alur kerja radiologi), tapi **AVA Tech yang memiliki mesinnya**. Pemisahan ini penting supaya keputusan "bangun sendiri" tidak berubah menjadi "setiap unit membangun versinya sendiri".

### 3.3 Beda Implementasi per Unit (yang paling sering salah dirancang)

**HRD** — satu database karyawan, tiga profil berbeda:
- *Profil Klinis* (Lab, Health, Care, Sanctuary): STR, SIP, SIK, masa berlaku, kompetensi, log pelatihan, rekredensial, uji kompetensi ISO 15189 (khusus Lab).
- *Profil Produksi* (Nutrition): sertifikat CPOTB, higiene personal, medical check-up wajib operator, APD, jam kerja shift pabrik, insentif output, laporan K3 & near-miss.
- *Profil Korporat* (HQ, Tech): KPI/OKR, remote work, ekuitas/bonus proyek, timesheet billable (Tech).
> Implementasi: **satu tabel `employee` + tabel ekstensi `employee_profile_{clinical|production|corporate}`**. Payroll, cuti, presensi tetap satu engine.

**Finance** — HQ pemilik Chart of Account, tapi setiap unit punya *segment* COA sendiri. Nutrition butuh **COGS berbasis batch produksi**; Lab butuh **cost per test (reagen + BHP + depresiasi alat)**; Health butuh **AR aging korporat & rekonsiliasi klaim asuransi**; Sanctuary butuh **deferred revenue** (paket dibayar di depan, sesi dipakai belakangan — ini kewajiban, bukan pendapatan).

**Inventory** — Nutrition pemilik master item karena dia yang memproduksi. Tapi Lab butuh dimensi yang tidak dipunya FMCG: **lot reagen, suhu penyimpanan, kalibrator/kontrol, tanggal buka vial, stabilitas on-board**. Sanctuary butuh **consumable per treatment**. Health butuh **obat dengan FEFO + narkotika/psikotropika register**.

**CRM** — satu pipeline engine, empat jenis lead: korporat MCU (Health), reseller/apotek (Nutrition), member wellness (Sanctuary), klien SaaS faskes (Tech). Bedanya di *stage template* dan *produk yang di-quote*, bukan di kodenya.

**POS/Kasir** — Lab & Health pakai POS klinis (ada penjaminan, klaim, split bill asuransi). Sanctuary pakai POS ritel + saldo membership. Nutrition **tidak pakai POS**, dia pakai OMS e-commerce.

---

## 4. AVA LAB — LABORATORIUM & LIS (MODUL PALING DALAM)

**Fokus entitas:** LIS patuh **ISO 15189:2022** end-to-end, dari permintaan sampai rilis hasil; ditambah fungsi R&D/riset sesuai Company Profile.
**Namespace:** `lab/`

### 4.1 Struktur Menu Utama (11 domain)

```
AVA LAB
├── 1. Pre-Analitik
├── 2. Analitik & Worklist
├── 3. Kendali Mutu (QC/EQA)
├── 4. Post-Analitik & Pelaporan
├── 5. Master Data Laboratorium
├── 6. Rentang Rujukan & Rules Engine
├── 7. Rujukan Lab (Referral/Outsource)
├── 8. Reagen, BHP & Alat
├── 9. Mutu & Akreditasi ISO 15189
├── 10. Analitik Bisnis & TAT
└── 11. Riset & Pengembangan (R&D)
```

### 4.2 Domain 1 — Pre-Analitik

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Order Entry / ARL | `lab/pre/order` | Formulir Permintaan Pemeriksaan digital: identitas pasien (tarik MPI), dokter pengirim, diagnosis ICD-10, jenis penjamin, prioritas (Rutin/Cito/STAT). Validasi tes vs spesimen otomatis. |
| Registrasi Pasien Lab | `lab/pre/registration` | Walk-in, rujukan dokter, MCU korporat, home service. Deteksi duplikat MPI. Cetak label + tanda terima. |
| Perencanaan Sampling | `lab/pre/collection-plan` | Instruksi persiapan pasien (puasa, waktu obat), daftar tabung yang dibutuhkan (order of draw otomatis), jumlah tabung minimum. |
| Check-in Spesimen & Barcode | `lab/pre/checkin` | Cetak barcode/QR thermal, timestamp pengambilan & penerimaan, identitas flebotomis, verifikasi dua identitas. |
| Penilaian Kelayakan Sampel | `lab/pre/acceptance` | Kriteria terima/tolak: hemolisis, lipemik, ikterik, volume kurang, tabung salah, clotted, tanpa label. **Wajib ISO 15189 klausul 7.2.6.** Log penolakan + notifikasi otomatis ke pengirim. |
| Routing & Distribusi Internal | `lab/pre/routing` | Alokasi otomatis ke bench: Hematologi, Kimia, Imunologi, Mikrobiologi, Urinalisis, PA, Molekuler. Aliquot & child-sample tracking. |
| Rantai Dingin & Transport | `lab/pre/coldchain` | Log suhu box, waktu tempuh, PIC kurir, kondisi terima. Untuk sampel home care & antar-cabang. |
| Manifest Antar-Cabang | `lab/pre/manifest` | Surat jalan spesimen, scan keluar–scan masuk, rekonsiliasi jumlah, alert sampel hilang. |
| Antrean Flebotomi | `lab/pre/queue` | Integrasi ke modul Queue bersama (lihat AVA Health). Panggilan suara + TV display. |

**Kebutuhan implementasi:** printer thermal direct (label 40×25 mm), scanner 2D, timbangan/ID-band opsional, tabung vakum dengan mapping warna ↔ additive ↔ tes, dan **aturan order-of-draw yang terkodekan** (bukan dihafal petugas).

### 4.3 Domain 2 — Analitik & Worklist

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Worklist per Bench | `lab/ana/worklist` | Daftar kerja per analyzer/bench, urut prioritas STAT → Cito → Rutin, tampilan status live. |
| Middleware Interfacing | `lab/ana/interface` | Koneksi analyzer **HL7 v2.x / ASTM E1381-E1394 / LIS2-A2**, mode host-query & broadcast, bidirectional (order download + result upload). Registry alat: IP, port, driver, versi firmware. |
| Input Hasil Manual | `lab/ana/manual-entry` | Untuk tes non-otomatis (mikroskopis, PA, rapid). Dua-orang-verifikasi opsional, template hasil terstruktur (bukan free text). |
| Auto-Verification Engine | `lab/ana/autoverify` | Rilis otomatis hasil normal yang lolos semua aturan; tahan yang tidak. Aturan: dalam rentang rujukan, delta check lolos, QC hari itu lolos, tidak ada flag instrumen, tidak ada nilai kritis. **Ini pengungkit TAT terbesar.** |
| Delta Check | `lab/ana/delta` | Bandingkan dengan hasil pasien sebelumnya; ambang absolut & persen per analit; window waktu per analit. Otomatis paksa review manual. |
| Rerun, Dilusi & Rechecking | `lab/ana/rerun` | Log alasan rerun, faktor dilusi, hasil sebelum-sesudah, siapa yang memerintahkan. Traceable untuk audit. |
| Mikrobiologi & Kultur | `lab/ana/micro` | Alur multi-hari: tanam → baca → identifikasi → AST/sensitivitas. Antibiogram kumulatif, interpretasi CLSI, laporan interim. |
| Patologi Anatomi | `lab/ana/histo` | Grossing, blok, slide, pembacaan Sp.PA, sinoptik report, arsip blok/slide. *(aktifkan jika lini PA berjalan)* |
| Molekuler / PCR | `lab/ana/molecular` | Run plate, kontrol positif/negatif, Ct value, interpretasi, pelaporan wajib ke SATUSEHAT untuk penyakit tertentu. |
| Log Instrumen & Telemetri | `lab/ana/instrument-log` | Uptime, error code, jumlah tes per alat, alert alat down, jadwal maintenance harian/mingguan. |

### 4.4 Domain 3 — Kendali Mutu

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Entry QC Harian | `lab/qc/entry` | Input/otomatis dari analyzer, per level kontrol (L1/L2/L3), per lot kontrol. |
| Levey-Jennings & Westgard | `lab/qc/levey-jennings` | Grafik real-time; aturan 1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x; multirule konfigurabel per analit. Blok rilis hasil bila QC gagal. |
| Penetapan Mean & SD | `lab/qc/baseline` | Perhitungan mean/SD internal dari 20 hari data; pembaruan tiap ganti lot kontrol. |
| Sigma Metric & TEa | `lab/qc/sigma` | Hitung bias & CV vs Total Error Allowable (CLIA/RCPA); tentukan frekuensi QC berbasis risiko. |
| Tindakan Korektif QC | `lab/qc/capa` | Wajib isi saat QC out-of-control: penyebab, tindakan, hasil verifikasi, tanda tangan penyelia. |
| PME / EQA | `lab/qc/eqa` | Jadwal siklus PNPME/eksternal, input hasil, Z-score, evaluasi, tindak lanjut, sertifikat. |
| Uji Banding Antar-Alat | `lab/qc/comparison` | Korelasi alat A vs B, uji banding antar-cabang, Bland-Altman, minimal 6 bulan sekali. |
| Kalibrasi & Verifikasi Metode | `lab/qc/calibration` | Log kalibrasi, linearitas, LoD/LoQ, presisi (repeatability & within-lab), akurasi, carry-over. **Wajib saat metode baru atau alat baru.** |

### 4.5 Domain 4 — Post-Analitik & Pelaporan

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Antrean Validasi | `lab/post/validation` | Antrean hasil menunggu verifikasi Sp.PK/penyelia; filter per bench, per prioritas, per flag. |
| Validasi Sp.PK | `lab/post/signoff` | Verifikasi teknis (analis) → verifikasi medis (Sp.PK). Dua tahap terpisah, terekam. |
| Nilai Kritis & Callback | `lab/post/critical` | Daftar nilai kritis per analit & per kelompok usia; alarm, timer eskalasi, **log siapa menelepon siapa jam berapa dan siapa yang menerima (read-back)**. Wajib ISO 15189 klausul 7.4.1. |
| Komentar Interpretatif | `lab/post/comments` | Library komentar terstandar yang bisa disisipkan; komentar otomatis berbasis rule (mis. TSH↑ + FT4↓ → saran). |
| Report Builder | `lab/post/report-builder` | Layout PDF per jenis laporan (rutin, MCU, mikrobiologi, PA), kop faskes, grafik tren, penanda H/L/Critical. |
| Rilis & Distribusi Hasil | `lab/post/release` | Link PDF terenkripsi via WhatsApp/email, portal pasien, push ke aplikasi dokter, cetak fisik. Log akses. |
| E-Signature & QR Verifikasi | `lab/post/esign` | TTE dokter + QR code verifikasi keaslian dokumen (halaman verifikasi publik). |
| Amended Report & Addendum | `lab/post/amendment` | Koreksi hasil yang sudah rilis: versi lama disimpan, alasan koreksi wajib, notifikasi ulang otomatis ke penerima. **Tidak boleh overwrite.** |
| Arsip & Riwayat Pasien | `lab/post/history` | Kumulatif hasil per pasien, grafik tren per analit, ekspor riwayat. |
| Resume Medis Lab | `lab/post/summary` | Ringkasan hasil bertanda tangan dokter untuk keperluan pasien/perusahaan/asuransi. |

### 4.6 Domain 5 — Master Data Laboratorium

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Katalog Tes (LOINC/UCUM) | `lab/master/test-catalog` | ~530+ tes: kode internal, **LOINC (OBX-3)**, **UCUM (OBX-6)**, metode, analyzer, spesimen, volume minimum, TAT standar, deskripsi & manfaat bahasa awam, harga. Ekspor siap-pakai ke LIS/SIMRS klien. |
| Panel & Paket | `lab/master/panels` | Komposisi paket MCU, panel profil (lipid, fungsi hati, ginjal), reflex testing rules. |
| Master Spesimen & Tabung | `lab/master/specimen` | Jenis spesimen, tabung, additive, volume, stabilitas, kondisi transport & simpan. |
| Master Metode & Analyzer | `lab/master/method` | Metode per tes per alat; penting karena rentang rujukan mengikuti metode. |
| Standar TAT | `lab/master/tat-standard` | Target TAT per tes per prioritas; jadi dasar dashboard TAT. |
| Master Dokter Perujuk | `lab/master/referrer` | Klinik/dokter perujuk, skema harga khusus, laporan volume rujukan. |
| Master Tarif & Penjamin | `lab/master/pricing` | Tarif per segmen: umum, korporat, asuransi, perujuk, promo. |
| Terminologi & Sinonim | `lab/master/terminology` | Pemetaan nama tes ↔ sinonim ↔ singkatan; menyelamatkan pencarian dan mapping ke sistem klien. |

### 4.7 Domain 6 — Rentang Rujukan & Rules Engine

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Katalog Rentang Rujukan | `lab/ref/intervals` | Rentang per **analit × usia (satuan hari) × jenis kelamin × metode × analyzer**; satuan konvensional & SI; sumber acuan; status verifikasi lokal. Versi & tanggal berlaku. |
| Verifikasi Lokal Interval | `lab/ref/verification` | Dokumentasi verifikasi rentang rujukan di populasi sendiri (minimal 20 sampel sehat per CLSI EP28-A3c) — syarat akreditasi. |
| Nilai Kritis Master | `lab/ref/critical-values` | Ambang kritis per analit per kelompok usia; terhubung ke `lab/post/critical`. |
| Konversi Satuan | `lab/ref/unit-conversion` | Faktor konversi konvensional ↔ SI, otomatis di laporan. |
| Rules Engine Interpretasi | `lab/ref/rules` | Aturan reflex, aturan komentar otomatis, aturan auto-verifikasi — semua dalam satu editor rule, versioned. |
| Zona Keputusan Laik Kerja | `lab/ref/fitwork-engine` | Untuk MCU korporat: menerjemahkan hasil ke kategori **Fit / Fit with Note / Fit with Restriction / Temporarily Unfit / Unfit**, bukan sekadar merah-hijau. Ambang "wajar secara okupasi" dipisah dari ambang klinis. Butuh persetujuan dokter penanggung jawab + audit trail perubahan aturan. |

> **Catatan desain:** domain 6 adalah pembeda kompetitif. LIS umum berhenti di "nilai di luar rentang". Menempatkan rentang rujukan sebagai *data terversi* dan keputusan laik kerja sebagai *rule engine terpisah* memungkinkan AVA Lab menjual "interpretasi", bukan sekadar angka.

### 4.8 Domain 7 — Rujukan Lab (Referral/Outsource)

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Master Lab Rujukan | `lab/ref-lab/partners` | Profil lab rekanan, akreditasi, daftar tes, TAT, harga beli. |
| Routing Vendor Otomatis | `lab/ref-lab/routing` | Logika prioritas: kerjakan internal → vendor prioritas (toleransi harga) → vendor termurah. Otomatis pilih saat order dibuat. |
| Pengiriman & Manifest | `lab/ref-lab/shipment` | Surat pengantar spesimen, nomor manifest, tracking, konfirmasi terima. |
| Rekonsiliasi Hasil Masuk | `lab/ref-lab/result-intake` | Terima hasil (PDF/HL7/API), mapping ke order internal, verifikasi Sp.PK sebelum rilis ke pasien. |
| Rekonsiliasi Margin & Tagihan | `lab/ref-lab/settlement` | Harga jual vs harga beli per tes, invoice vendor, margin per bulan per vendor. |

### 4.9 Domain 8 — Reagen, BHP & Alat

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Stok Reagen & Lot | `lab/inv/stock` | Saldo per lot, tanggal kedaluwarsa, tanggal buka vial, stabilitas on-board, lokasi & suhu simpan. |
| BOM per Pemeriksaan | `lab/inv/recipe` | Konsumsi reagen/BHP per tes; auto-deduct saat hasil dirilis; jadi dasar **cost per test**. |
| Monitoring Suhu | `lab/inv/temperature` | Log suhu kulkas/freezer (manual atau IoT), alert deviasi, berita acara. |
| Reorder Point & Buffer | `lab/inv/reorder` | Perhitungan otomatis berbasis konsumsi rata-rata + lead time vendor. |
| Alat & Kalibrasi Eksternal | `lab/inv/equipment` | Inventaris alat, kontrak servis, jadwal kalibrasi tahunan pihak ketiga, sertifikat, riwayat perbaikan, depresiasi. |
| Limbah B3 Medis | `lab/inv/waste` | Manifest limbah infeksius/tajam/kimia, vendor pengangkut berizin, berita acara pemusnahan. **Sering terlupa, selalu ditanya saat inspeksi.** |

### 4.10 Domain 9 — Mutu & Akreditasi ISO 15189:2022

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Document Control | `lab/qms/documents` | SOP/IK/formulir: nomor, versi, masa berlaku, distribusi terkendali, penarikan dokumen usang, e-acknowledge pembacaan oleh staf. |
| Manajemen Risiko | `lab/qms/risk` | Register risiko per proses, skoring, mitigasi — **klausul baru yang menonjol di edisi 2022**. |
| Ketidaksesuaian & CAPA | `lab/qms/capa` | NC dari keluhan, QC gagal, penolakan sampel, audit; akar masalah, tindakan, verifikasi efektivitas. |
| Keluhan Pelanggan | `lab/qms/complaints` | Registrasi keluhan, SLA respons, hubungan ke CAPA. |
| Audit Internal | `lab/qms/audit` | Jadwal, checklist per klausul, temuan, status penutupan. |
| Kompetensi Personel | `lab/qms/competency` | Matriks kompetensi per bench, bukti pelatihan, penilaian ulang berkala, otorisasi tanda tangan hasil. |
| Indikator Mutu | `lab/qms/indicators` | KPI mutu: % sampel ditolak, % TAT tercapai, % hasil dikoreksi, % nilai kritis dilaporkan <30 menit, kepuasan pengguna. |
| Tinjauan Manajemen | `lab/qms/review` | Agenda, input klausul 8.9, notulen, keputusan, tindak lanjut. |
| Kesiapan Akreditasi | `lab/qms/readiness` | Peta klausul ↔ bukti dokumen ↔ status; dashboard kesiapan asesmen. |

### 4.11 Domain 10 — Analitik Bisnis & TAT

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Dashboard TAT | `lab/analytics/tat` | TAT per fase (terima→analisis→validasi→rilis), per tes, per shift; deteksi bottleneck. |
| Beban Kerja | `lab/analytics/workload` | Volume per bench, per analis, per alat, per jam — dasar penjadwalan SDM. |
| Utilisasi Tes | `lab/analytics/utilization` | Tes paling & paling jarang diminta, tes tidak pernah dipesan (kandidat dihapus), pola over-ordering. |
| Profitabilitas per Tes | `lab/analytics/cost` | Harga jual − (reagen + BHP + tenaga + depresiasi) = margin per tes. |
| Epidemiologi & Positivity | `lab/analytics/epi` | Tren positivity rate, distribusi hasil abnormal, peta wilayah — bahan konten & riset. |
| Laporan Perujuk | `lab/analytics/referrer` | Volume & nilai per dokter/klinik perujuk, untuk skema kemitraan. |

### 4.12 Domain 11 — Riset & Pengembangan

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Registry Protokol Riset | `lab/rnd/protocols` | Judul studi, PI, status etik (ethical clearance), periode, sponsor. |
| Manajemen Consent | `lab/rnd/consent` | Persetujuan penggunaan data/sisa spesimen untuk riset, terpisah dari general consent layanan. |
| Biobank / Repositori Spesimen | `lab/rnd/biobank` | Lokasi freezer, rak, box, posisi; siklus beku-cair; masa simpan. |
| Dataset Ter-deidentifikasi | `lab/rnd/datasets` | Ekstraksi data untuk analisis dengan penghapusan identitas otomatis; log siapa mengekstrak apa. |
| Validasi Metode Baru | `lab/rnd/method-validation` | Alur formal sebelum metode masuk produksi; terhubung ke `lab/qc/calibration`. |
| Publikasi & Output | `lab/rnd/publications` | Arsip publikasi, poster, kolaborasi akademik. |

---

## 5. AVA HEALTH — HIS, APPS, CORPORATE, KIOSK & QUEUE

**Fokus entitas:** pelayanan klinis langsung + kanal digital pasien + lini bisnis korporat.
**Namespace:** `health/`

### 5.1 Domain A — HIS Klinis

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Pendaftaran & Admisi | `health/his/admission` | Registrasi, validasi NIK Dukcapil, general consent digital, penjamin, cetak gelang/kartu. Tarik MPI. |
| Master Rekam Medis (MPI) | `health/his/mpi` | Pemilik MPI ekosistem: penggabungan duplikat, riwayat penggabungan, penomoran RM. |
| EMR SOAP & CPPT | `health/his/emr` | Anamnesis, pemeriksaan fisik, vital sign, asesmen, ICD-10 & ICD-9CM, rencana, CPPT terintegrasi antar-profesi. |
| Order Terintegrasi | `health/his/orders` | Satu layar order: lab (→ AVA Lab), radiologi, obat, tindakan. Order lab langsung membuat order di LIS. |
| E-Prescription & Farmasi | `health/his/pharmacy` | Skrining interaksi & alergi, peracikan, etiket, FEFO, register narkotika/psikotropika. |
| Radiologi & PACS DICOM | `health/his/pacs` | Worklist modalitas (DICOM MWL), viewer web (windowing, zoom, anotasi, MPR), ekspedisi ekspertise radiolog. |
| Tindakan & Prosedur | `health/his/procedures` | Katalog tindakan, informed consent, catatan tindakan, biaya. |
| Rawat Inap & Bed Board | `health/his/inpatient` | Peta bed live, asuhan keperawatan, visite, resume medis pulang. *(aktifkan bila lini rawat inap berjalan)* |
| Vaksinasi & Imunisasi | `health/his/immunization` | Jadwal, stok vaksin per lot, KIPI, sertifikat, push ke SATUSEHAT. |
| Telehealth & Teleconsult | `health/his/telehealth` | Video call, e-resep jarak jauh, catatan konsultasi, integrasi jadwal dokter. |
| Rekam Medis Elektronik & Retensi | `health/his/mr-governance` | Kelengkapan RM, retensi/pemusnahan, permintaan salinan RM oleh pasien/asuransi. |

### 5.2 Domain B — Queue & Kiosk

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Konfigurasi Antrean | `health/queue/config` | Definisi loket/poli/counter, prefiks nomor, kuota per slot, prioritas (lansia, disabilitas, ibu hamil, cito). |
| Panggilan & Counter Console | `health/queue/console` | Layar petugas: panggil, panggil ulang, lewati, transfer antar-counter. |
| Display TV | `health/queue/display` | Layar ruang tunggu multi-zona (poli, lab, farmasi, kasir), teks-ke-suara Bahasa Indonesia, konten promosi di sela. |
| Kiosk Ambil Antrean | `health/kiosk/ticket` | Layar sentuh lobi: pilih layanan → cetak nomor. Mode offline-tolerant (tetap jalan saat jaringan putus, sinkron belakangan). |
| Kiosk Self-Registration | `health/kiosk/self-reg` | Scan KTP/QR appointment → verifikasi data → konfirmasi kedatangan tanpa antre loket. |
| Kiosk Cetak Hasil Mandiri | `health/kiosk/result-print` | Cetak hasil lab dengan verifikasi OTP/QR — mengurangi beban front office. |
| Antrean Virtual (WA/App) | `health/queue/virtual` | Ambil nomor dari rumah, notifikasi "3 antrean lagi", estimasi waktu tunggu berbasis data historis. |
| Analitik Waktu Tunggu | `health/queue/analytics` | Waktu tunggu rata-rata per poli per jam, tingkat abandonment, beban per petugas. |

**Kebutuhan implementasi:** Android box/mini-PC per TV, printer thermal kiosk 80 mm, layar sentuh, UPS, dan jaringan lokal yang bisa jalan saat internet mati — kiosk & queue **harus** punya mode lokal.

### 5.3 Domain C — Apps (Channel Layer)

| Aplikasi | Route/Portal | Fitur Inti |
|---|---|---|
| Patient App | `health/apps/patient` | Booking, antrean virtual, hasil lab & radiologi, riwayat kesehatan, e-resep, telekonsul, pembayaran, kartu member, reminder kontrol & obat, program wellness lintas unit. |
| Doctor App | `health/apps/doctor` | Jadwal, daftar pasien hari ini, akses EMR ringkas, validasi hasil, tanda tangan elektronik, notifikasi nilai kritis, rekap jasa medis. |
| Nakes / Field App | `health/apps/nakes` | Dipakai bersama AVA Care: tugas kunjungan, navigasi, check-in GPS, form tindakan, foto dokumentasi, tanda tangan pasien, laporan selesai. |
| Corporate Portal | `health/apps/corporate` | Portal klien korporat: status proyek MCU, progres peserta, unduh hasil massal, laporan agregat kesehatan karyawan, tagihan. |
| Partner/Perujuk Portal | `health/apps/referrer` | Dokter/klinik perujuk kirim order, lacak status, unduh hasil. |
| Admin Console | `health/apps/admin` | Konfigurasi faskes, jam layanan, tarif, pengumuman. |

### 5.4 Domain D — Corporate & B2B (eks PT AVA Mitra Korporat)

| Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|
| Database Klien Korporat | `health/corp/clients` | Perusahaan, PIC, industri, jumlah karyawan, plafon, riwayat proyek, termin pembayaran. |
| Paket & Penawaran MCU | `health/corp/quotation` | Builder paket dari katalog tes + tindakan; kalkulasi margin otomatis; penomoran surat resmi; alur revisi & approval; ekspor PDF berkop. |
| Manajemen Proyek MCU | `health/corp/project` | Timeline proyek, lokasi (on-site/in-clinic), kuota peserta, roster karyawan (import Excel), penjadwalan gelombang, checklist logistik. |
| Eksekusi MCU On-Site | `health/corp/onsite` | Mode lapangan: registrasi cepat via barcode, alur stasiun (antropometri → vital → lab → EKG → audio → spiro → visus → dokter), **wajib bisa jalan offline** lalu sinkron. |
| Hasil & Sertifikat Massal | `health/corp/results` | Generate massal hasil individual + sertifikat sehat + surat keterangan laik kerja. |
| Laporan Kesehatan Agregat | `health/corp/report` | Laporan perusahaan: distribusi temuan, prevalensi faktor risiko, rekomendasi program, perbandingan antar-tahun. Identitas individu tidak dibuka ke HR kecuali sesuai perjanjian. |
| Keputusan Laik Kerja | `health/corp/fitwork` | Konsumsi `lab/ref/fitwork-engine` + temuan klinis; keputusan akhir oleh dokter pemeriksa (Hiperkes), bukan oleh sistem. |
| Klaim Asuransi & Penjaminan | `health/corp/claims` | AdMedika, Inhealth, Reliance, dll; eligibility check, pengajuan, tracking, rekonsiliasi selisih. |
| BPJS & INA-CBG | `health/corp/bpjs` | Bridging VClaim, grouping, berkas klaim digital. *(aktifkan bila kerja sama BPJS berjalan)* |
| Compliance & Perizinan | `health/corp/compliance` | Izin operasional klinik/lab, SIP/STR nakes, sertifikat Hiperkes, PJK3, akreditasi — dengan reminder jatuh tempo bertingkat (H-90/60/30). |

### 5.5 Domain E — Billing Klinis

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Kasir & Pembayaran | `health/billing/cashier` | Tunai, QRIS dinamis, kartu, transfer, split bill, deposit, penjaminan sebagian. |
| Shift & Berita Acara Kas | `health/billing/shift` | Buka/tutup shift, rekonsiliasi fisik vs sistem, selisih & penjelasan. |
| Invoice & AR Korporat | `health/billing/ar` | Faktur, aging 0-30/31-60/61-90/>90, surat penagihan otomatis. |
| Jasa Medis & Bagi Hasil | `health/billing/fee` | Perhitungan jasa dokter/nakes per tindakan, skema bagi hasil, slip jasa medis. |

### 5.6 Integrasi Wajib

SATUSEHAT HL7 FHIR (Patient, Encounter, Condition, Observation, Procedure, Medication, DiagnosticReport, Immunization) · Dukcapil NIK · BPJS VClaim · Payment gateway QRIS · WhatsApp Business API · DICOM/PACS.

---

## 6. AVA TECH — PLATFORM, PENGEMBANGAN & INTEGRASI

**Fokus entitas:** memiliki, membangun, dan mengoperasikan seluruh sistem di lingkup AVA Global — termasuk HIS, LIS, dan semua modul kernel — serta menjualnya keluar sebagai produk.
**Namespace:** `tech/`

### 6.1 Domain A — Product & Delivery

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Product Backlog & Roadmap | `tech/product/backlog` | Epic → story → task, prioritas, target rilis per modul (LIS, HIS, OMS, dst). |
| Sprint & Board | `tech/product/sprint` | Papan kerja tim, kapasitas, burndown, velocity. |
| Permintaan Perubahan (CR) | `tech/product/change-request` | Permintaan dari unit internal/klien; estimasi effort & biaya; persetujuan; SLA. |
| Rilis & Changelog | `tech/product/release` | Versi semantik, catatan rilis per tenant, jadwal deployment, rollback plan. |
| Dokumentasi & Knowledge Base | `tech/product/docs` | Dokumen teknis, panduan pengguna per modul, video training. |
| UAT & Sign-off | `tech/product/uat` | Skenario uji per modul, hasil uji, penerimaan dari unit pemilik proses. |

### 6.2 Domain B — Platform Operations

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Tenant & Lisensi | `tech/platform/tenants` | Daftar tenant (6 unit internal + klien eksternal), modul aktif, kuota, masa berlaku, metering pemakaian, penagihan lisensi. |
| IAM, RBAC & SSO | `tech/platform/iam` | Master pengguna, peran, matriks hak akses per route, MFA, kebijakan sandi, sesi. |
| Audit Trail Terpusat | `tech/platform/audit` | Log imutabel semua perubahan data sensitif; pencarian forensik; ekspor untuk auditor. |
| Environment & Deployment | `tech/platform/environments` | Dev/Staging/Prod, konfigurasi, secret management, CI/CD pipeline. |
| Monitoring & Uptime | `tech/platform/monitoring` | Ketersediaan layanan, latensi, error rate, alert on-call. |
| Backup & Disaster Recovery | `tech/platform/backup` | Jadwal backup, uji restore berkala (bukan hanya backup — **uji restore**), RTO/RPO per modul. |
| Keamanan & UU PDP | `tech/platform/security` | Klasifikasi data, enkripsi at-rest & in-transit, manajemen kerentanan, penetration test, DPIA, prosedur insiden kebocoran (notifikasi 3×24 jam). |
| Service Desk & Insiden | `tech/platform/servicedesk` | Tiket dari unit internal & klien, prioritas P1–P4, SLA, root cause, laporan bulanan. |

### 6.3 Domain C — Integration Hub

| Sub-Menu | Route | Fungsi |
|---|---|---|
| API Gateway & Registry | `tech/integration/gateway` | Katalog API internal & publik, kunci API, rate limit, versi. |
| Konektor SATUSEHAT | `tech/integration/satusehat` | Mapping FHIR, antrean kirim, retry, dashboard kepatuhan pengiriman. |
| Konektor Analyzer | `tech/integration/analyzer` | Registry driver HL7/ASTM per merek alat, simulator untuk uji, log pesan mentah. |
| Konektor Marketplace & Ekspedisi | `tech/integration/commerce` | Shopee/TikTok/Tokopedia/Lazada, agregator ongkir, sinkronisasi stok & pesanan. |
| Konektor Pembayaran | `tech/integration/payment` | QRIS, VA, kartu, e-wallet, rekonsiliasi settlement. |
| Konektor Asuransi/BPJS | `tech/integration/insurance` | VClaim, AdMedika, Inhealth, dsb. |
| Webhook & Event Bus | `tech/integration/events` | Event lintas unit (`lab.result.released`, `mcu.project.completed`, `nutri.order.shipped`) — tulang punggung ADR-03. |

### 6.4 Domain D — Data & AI

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Data Warehouse & ETL | `tech/data/warehouse` | Pipeline dari semua modul ke DWH, data dictionary, kualitas data. |
| BI & Self-Service Report | `tech/data/bi` | Builder laporan untuk unit, dashboard tersimpan, jadwal kirim otomatis. |
| Agentic Orchestrator | `tech/ai/orchestrator` | Pusat kendali agen AI: tugas terjadwal, guardrail, log keputusan, human-in-the-loop wajib untuk output klinis. |
| QMS Document Engine | `tech/ai/qms-engine` | Rekayasa dokumen mutu ke format standar (ISO 15189, CPOTB) — dipakai Lab & Nutrition. |
| Test Description Reengineering | `tech/ai/test-rewriter` | Menerjemahkan deskripsi tes medis ke bahasa awam untuk katalog & aplikasi pasien. |
| Medical Terminology Mapper | `tech/ai/terminology` | Auto-mapping nama tes lokal ↔ LOINC/UCUM/ICD; alat bantu onboarding klien LIS baru. |
| Content & SEO Engine | `tech/ai/content` | Artikel kesehatan, copywriting medsos, deskripsi produk — dipakai Marketing kernel. |

> **Aturan keras:** setiap output AI yang menyentuh keputusan klinis (interpretasi, laik kerja, saran terapi) **wajib** melewati verifikasi manusia berwenang dan tercatat di audit trail. AI tidak menandatangani apa pun.

### 6.5 Domain E — Bisnis AVA Tech (Internal-First, ADR-04)

| Sub-Menu | Route | Aktif Sejak | Fungsi |
|---|---|---|---|
| Internal Chargeback | `tech/biz/chargeback` | **Fase 1** | Biaya platform dibebankan ke 5 brand lain sebagai transfer internal — membuat AVA Tech punya P&L segmen nyata, bukan sekadar pos beban. |
| Katalog Layanan Internal | `tech/biz/service-catalog` | **Fase 1** | Daftar layanan Tech ke unit internal: pengembangan modul, integrasi, support, infrastruktur — dengan satuan biaya. |
| Kapasitas & Alokasi Tim | `tech/biz/capacity` | **Fase 1** | Berapa kapasitas developer tersedia vs permintaan 5 unit. **Ini yang mencegah AVA Tech dijanjikan ke semua orang sekaligus.** |
| Pipeline SaaS Eksternal | `tech/biz/pipeline` | Fase 4 | Prospek faskes/klinik/lab yang membeli LIS/HIS AVA. |
| Onboarding Klien | `tech/biz/onboarding` | Fase 4 | Checklist implementasi: migrasi data, mapping katalog, training, go-live, hypercare. |
| Kontrak & SLA Klien | `tech/biz/contracts` | Fase 4 | Masa berlaku, SLA, denda, perpanjangan, eskalasi. |

### 6.6 Domain F — Core Engine Buatan Sendiri (konsekuensi ADR-09)

Keputusan membangun semua sendiri memindahkan tiga sistem yang biasanya dibeli ke dalam backlog AVA Tech. Ketiganya bukan modul kecil — masing-masing setara dengan satu produk tersendiri.

#### F1 — Accounting & GL Engine

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Chart of Account & Dimensi | `tech/core/gl-coa` | COA berjenjang + dimensi wajib (brand, cost center, KBLI, lokasi). |
| Jurnal & Posting Engine | `tech/core/gl-journal` | Jurnal manual & otomatis dari transaksi modul lain; aturan posting per jenis transaksi; periode buka/tutup. |
| Buku Besar & Neraca Saldo | `tech/core/gl-ledger` | Buku besar, neraca saldo, penelusuran ke dokumen sumber. |
| Laporan Keuangan | `tech/core/gl-report` | Neraca, laba rugi, arus kas, per segmen dan konsolidasi. |
| Tutup Buku & Penyesuaian | `tech/core/gl-closing` | Jurnal penyesuaian, penyusutan otomatis, akrual, tutup bulan/tahun. |
| Pajak | `tech/core/gl-tax` | PPN keluaran/masukan, PPh 21/23/final, rekap untuk e-Faktur & e-Bupot. |
| Audit Trail Akuntansi | `tech/core/gl-audit` | Jurnal tidak boleh dihapus — hanya dibalik dengan jurnal koreksi. Semua perubahan terekam. |

> **Yang paling sering diremehkan:** bukan pembukuan dasarnya, tapi **pajak, tutup buku, dan sifat imutabel jurnal**. Ketiganya yang membuat GL buatan sendiri berbeda antara "bisa dipakai" dan "lolos audit". Rekomendasi teknis: bangun engine-nya lebih dulu dengan lingkup **kas, AR, AP, jurnal, dan laporan segmen** di Fase 2; pajak dan konsolidasi penuh menyusul di Fase 3, sementara pelaporan pajak resmi sementara tetap dikerjakan lewat proses akuntansi berjalan.

#### F2 — Payroll Engine

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Komponen Gaji | `tech/core/pay-components` | Gaji pokok, tunjangan tetap/tidak tetap, potongan, formula per komponen, per profil (klinis/produksi/korporat). |
| Kalkulasi Payroll | `tech/core/pay-run` | Proses payroll periodik, simulasi sebelum final, kunci periode. |
| Lembur & Insentif | `tech/core/pay-variable` | Lembur berbasis presensi, insentif output produksi, komisi sales, jasa medis nakes. |
| BPJS & PPh 21 | `tech/core/pay-statutory` | Iuran BPJS Kesehatan & Ketenagakerjaan, perhitungan PPh 21 (termasuk skema TER), bukti potong. |
| Slip Gaji & Distribusi | `tech/core/pay-slip` | Slip digital terenkripsi, akses mandiri karyawan. |
| Integrasi Bank | `tech/core/pay-disbursement` | File transfer massal ke bank, rekonsiliasi pembayaran. |

> **Risiko spesifik:** payroll salah hitung adalah kesalahan yang paling cepat merusak kepercayaan karyawan dan paling mahal secara hukum. Rekomendasi: **jalankan paralel minimal 3 periode** — hitung dengan cara lama dan dengan engine baru, bandingkan sen demi sen, baru migrasi.

#### F3 — PACS / DICOM Server

| Sub-Menu | Route | Fungsi |
|---|---|---|
| DICOM Store & Archive | `tech/core/pacs-store` | Penerimaan citra dari modalitas (C-STORE), penyimpanan, kompresi, retensi. |
| Modality Worklist | `tech/core/pacs-mwl` | Mengirim daftar order ke alat radiologi (DICOM MWL) supaya operator tidak mengetik ulang identitas pasien. |
| Query/Retrieve | `tech/core/pacs-qr` | Pencarian & penarikan studi lama. |
| Web Viewer | `tech/core/pacs-viewer` | Windowing, zoom, pan, ukur, anotasi, perbandingan studi, MPR dasar. |
| Distribusi & Sharing | `tech/core/pacs-share` | Link studi untuk pasien/dokter luar, batas waktu akses, log akses. |

> **Catatan teknis:** DICOM adalah protokol yang rewel dan setiap merek alat punya kekhasan. Rekomendasi jalan tengah yang tetap konsisten dengan ADR-09: bangun *store*, *worklist*, dan *viewer* sendiri, tapi **gunakan pustaka DICOM open-source yang matang** sebagai fondasi parsing/networking, bukan menulis parser dari nol. Itu tetap "bangun sendiri", tanpa menghabiskan enam bulan hanya untuk membaca header.

### 6.7 Strategi Multi-Tenancy Tertunda (ADR-08)

Karena penjualan eksternal ditunda ke Fase 4, godaannya adalah membangun sistem single-tenant sekarang lalu "dibuat multi-tenant nanti". Itu jebakan paling mahal di arsitektur seperti ini. Yang dikerjakan **sekarang** vs **nanti**:

| Dikerjakan sejak Fase 0 (murah) | Ditunda ke Fase 4 (mahal, tidak mendesak) |
|---|---|
| Kolom `tenant_id` + `brand_code` di semua tabel | UI provisioning tenant mandiri |
| Semua query difilter tenant di lapisan data, bukan di controller | Metering pemakaian & penagihan otomatis |
| Konfigurasi per tenant disimpan sebagai data, bukan hard-code | Portal self-service klien |
| Aset (logo, kop, template PDF) disimpan per tenant | Marketplace modul & aktivasi lisensi mandiri |
| Master data (katalog tes, tarif) sudah scoped per tenant | Isolasi database fisik untuk klien enterprise |
| Migrasi database sudah dirancang tenant-aware | Onboarding otomatis & migrasi data mandiri |

**Aturan uji sederhana:** kalau hari ini kita membuat tenant kedua bernama "DEMO" secara manual lewat database dan seluruh sistem tetap berjalan benar tanpa mencampur data, maka fondasi Fase 0 sudah cukup. Kalau tidak — perbaiki sekarang, jangan tunggu Fase 4.

---

## 7. AVA CARE — HOME CARE, MOBILE CARE & CAREGIVING

**Fokus entitas:** kepedulian & dukungan personal — layanan yang datang ke rumah dan berlanjut setelah pasien pulang.
**Namespace:** `care/`

| Domain | Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|---|
| **Order** | Order Kunjungan | `care/order/intake` | Order dari app/WA/telepon; alamat + pin GPS; paket layanan; slot waktu; catatan akses (lantai, lift, hewan). |
| | Triase & Kelayakan | `care/order/triage` | Skrining kondisi: layak home care atau harus ke faskes; red flag otomatis. **Melindungi dari mengambil kasus di luar kompetensi.** |
| | Persetujuan & Estimasi Biaya | `care/order/quotation` | Estimasi tindakan + transport zonasi; konfirmasi pasien sebelum berangkat. |
| **Dispatch** | Kalender & Penugasan | `care/dispatch/schedule` | Plotting nakes berdasar kompetensi, jarak, beban, jam kerja. |
| | Live Tracking | `care/dispatch/tracking` | Posisi nakes, ETA, notifikasi ke pasien, tombol darurat. |
| | Optimasi Rute | `care/dispatch/routing` | Urutan kunjungan multi-pasien per nakes per hari. |
| **Layanan** | Katalog Tindakan | `care/service/catalog` | Sampling darah, infus/imun booster, perawatan luka, kateter/NGT, fisioterapi, vaksinasi lansia & bayi, perawatan pasca-operasi. |
| | Form Tindakan Digital | `care/service/procedure-form` | Form terstruktur per tindakan, vital sign, foto sebelum-sesudah, tanda tangan pasien di layar. |
| | Care Plan Berkelanjutan | `care/service/careplan` | Program multi-kunjungan (mis. rawat luka 3×/minggu 4 minggu), progres, tujuan, evaluasi. |
| | Home Sampling → Lab | `care/service/sampling` | Membuat order langsung di LIS; rantai dingin; serah terima spesimen ter-scan. |
| **Nakes** | Master Nakes | `care/staff/registry` | Profil, STR/SIP aktif + alert kedaluwarsa, kompetensi, area layanan, rating CSAT. |
| | Kompetensi & Pelatihan | `care/staff/competency` | Sertifikasi per tindakan; nakes hanya bisa ditugaskan pada tindakan yang diotorisasi. |
| | Komisi & Withdraw | `care/staff/commission` | Fee tindakan, uang transport, insentif, riwayat pencairan. |
| **Tarif** | Tarif & Zonasi | `care/pricing/tariff` | Tarif tindakan, biaya jarak per km/zona, tarif malam/hari libur, bagi hasil nakes. |
| | Paket Langganan Care | `care/pricing/subscription` | Paket bulanan lansia/pasca-rawat; saldo kunjungan. |
| **Mutu** | Insiden & Keselamatan | `care/quality/incident` | Laporan insiden di rumah pasien, KTD/KNC, tindak lanjut. |
| | CSAT & Keluhan | `care/quality/csat` | Survei pasca-kunjungan otomatis; keluhan masuk ke CAPA kernel. |
| | Laporan Kinerja | `care/quality/report` | Volume, on-time rate, pembatalan, produktivitas nakes, profitabilitas per zona. |

**Kebutuhan implementasi:** aplikasi nakes wajib **offline-first** (rumah pasien sering tanpa sinyal), foto terkompresi, tanda tangan di layar, dan validasi GPS anti-spoof.

---

## 8. AVA NUTRITION — PABRIK, PRODUK & D2C

**Fokus entitas:** gizi & suplemen berbasis riset — dari R&D formula, produksi/maklon, sampai penjualan multi-kanal. **Ini satu-satunya unit dengan sifat manufaktur**, karena itu HRD, Inventory, dan Procurement-nya punya ekstensi tersendiri (poin 3 permintaan).
**Namespace:** `nutri/`

| Domain | Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|---|
| **R&D Produk** | Pipeline Formulasi | `nutri/rnd/formulation` | Ide → formula → uji stabilitas → uji sensori → finalisasi. Versi formula terkunci. |
| | Klaim & Substansiasi | `nutri/rnd/claims` | Klaim produk beserta rujukan ilmiahnya — pertahanan saat audit BPOM & saat marketing berlebihan. |
| | Uji Lab Produk | `nutri/rnd/testing` | Order pengujian ke AVA Lab (mikrobiologi, logam berat, kadar zat aktif); hasil tersimpan sebagai bukti mutu batch. |
| **Regulatori** | Registrasi BPOM | `nutri/reg/bpom` | Nomor izin edar per SKU, tanggal terbit & kedaluwarsa, dokumen pendukung, reminder perpanjangan. |
| | Sertifikasi Halal | `nutri/reg/halal` | Sertifikat per produk & per bahan, masa berlaku, penyelia halal. |
| | CPOTB & Audit Maklon | `nutri/reg/cpotb` | Profil pabrik maklon, sertifikat CPOTB, hasil audit vendor, kontrak toll manufacturing. |
| **Produksi** | Rencana Produksi | `nutri/prod/plan` | Forecast permintaan → rencana batch → kebutuhan bahan (input MRP). |
| | Batch Record | `nutri/prod/batch` | Nomor lot, tanggal produksi & kedaluwarsa, yield, penyimpangan, pelulusan batch oleh penanggung jawab. |
| | QC Produk & Retained Sample | `nutri/prod/qc` | Sampel pertinggal, hasil uji, status karantina → lulus/tolak. |
| | Penarikan Produk (Recall) | `nutri/prod/recall` | Simulasi & eksekusi recall berbasis lot: dari lot ke pelanggan akhir dalam hitungan menit. **Wajib bisa didemonstrasikan.** |
| **Rantai Pasok** | Bahan Baku & Supplier | `nutri/supply/materials` | Master bahan, spesifikasi, CoA per lot, kualifikasi supplier. |
| | MRP & Reorder | `nutri/supply/mrp` | Buffer stock, reorder point, lead time, EOQ. |
| | PR / PO / Penerimaan | `nutri/supply/procurement` | Alur pengadaan dengan approval berjenjang; penerimaan + pemeriksaan mutu. |
| | Gudang & FEFO | `nutri/supply/warehouse` | Multi-gudang, lokasi rak, FEFO wajib, stok karantina vs stok siap jual, stock opname. |
| **Penjualan** | OMS Multi-Channel | `nutri/sales/oms` | Shopee, TikTok Shop, Tokopedia, Lazada, web store, WA — satu antrean pesanan, satu stok. |
| | Konsinyasi Apotek | `nutri/sales/consignment` | Stok titip per outlet (K-24, Kimia Farma, Century, apotek rekanan), laporan penjualan, penagihan konsinyasi, retur & barang mendekati ED. |
| | Distributor & Reseller | `nutri/sales/distribution` | Tingkatan harga, target, insentif, wilayah eksklusif. |
| | Subscription Auto-Refill | `nutri/sales/subscription` | Langganan bulanan, jadwal kirim, penagihan otomatis, churn tracking. |
| | Ekspedisi & Label | `nutri/sales/shipping` | Kalkulator ongkir real-time, cetak massal resi 100×150 mm, tracking, klaim kehilangan. |
| | Retur & Refund | `nutri/sales/returns` | Alasan retur, kondisi barang, keputusan restock/musnah. |
| **HRD Pabrik** | Shift & Produktivitas | `nutri/hr/shift` | Roster shift produksi, output per shift, insentif berbasis output. |
| | K3 & Higiene | `nutri/hr/k3` | APD, pemeriksaan kesehatan operator berkala (→ order ke AVA Health), pelatihan higiene, laporan near-miss. |
| **Analitik** | Margin & COGS | `nutri/analytics/cogs` | HPP per batch, margin per SKU per channel, biaya iklan per konversi. |
| | Perputaran Stok | `nutri/analytics/inventory` | Days of inventory, slow-moving, risiko kedaluwarsa (nilai rupiah stok ED <6 bulan). |

---

## 9. AVA SANCTUARY — OPERASIONAL WELLNESS

**Fokus entitas:** pemulihan & ketenangan holistik — postnatal care, pelvic floor rehab, lymphatic drainage, hydrotherapy, perawatan kecantikan holistik.
**Namespace:** `sanct/`

| Domain | Sub-Menu | Route | Fungsi & Kebutuhan Implementasi |
|---|---|---|---|
| **Klien** | Profil Klien Wellness | `sanct/client/profile` | Tarik MPI; profil wellness (bukan rekam medis penuh): tujuan, preferensi terapis, alergi produk, catatan sensitivitas. |
| | Asesmen Awal & Kontraindikasi | `sanct/client/assessment` | Kuesioner kesehatan, skrining kontraindikasi (hipertensi, DVT, kehamilan, pasca-operasi), **medical clearance dari AVA Health bila diperlukan**. |
| | Consent & Dokumentasi Foto | `sanct/client/consent` | Persetujuan tindakan, persetujuan terpisah untuk foto before-after & penggunaan promosi. |
| | Riwayat Treatment | `sanct/client/history` | Sesi, terapis, respons, catatan progres, foto terkendali akses. |
| **Booking** | Kalender Reservasi | `sanct/booking/calendar` | Slot per terapis × per ruangan × per treatment; durasi & buffer bersih-bersih; cegah bentrok tiga arah. |
| | Booking Online & Waitlist | `sanct/booking/online` | Booking dari app/web, deposit, kebijakan pembatalan, daftar tunggu otomatis mengisi slot batal. |
| | Reminder & No-Show | `sanct/booking/reminder` | Reminder H-1 & H-2 jam via WA; pencatatan no-show; kebijakan denda/hangus. |
| **Operasional** | Status Ruangan & Suite | `sanct/ops/rooms` | Okupansi live Private Suite (Rose, Lavender), Reformer Studio, hydro room; status bersih/kotor/maintenance. |
| | Alokasi Terapis | `sanct/ops/therapist` | Kompetensi per treatment, jam kerja, beban harian maksimum (menjaga kualitas & mencegah cedera terapis). |
| | Turnover & Housekeeping | `sanct/ops/housekeeping` | Checklist kebersihan antar-sesi, linen, sterilisasi alat, log verifikasi. |
| | Konsumabel per Treatment | `sanct/ops/consumables` | BOM per treatment (minyak, masker, linen, jarum), auto-deduct stok, biaya per sesi. |
| **Program** | Katalog Treatment & Paket | `sanct/program/catalog` | Postnatal care, pelvic floor rehab, lymphatic drainage, hydrotherapy, Empress Ratus, paket seri. |
| | Program Postnatal Terstruktur | `sanct/program/postnatal` | Program berjangka (mis. 40 hari): jadwal sesi, milestone pemulihan, edukasi, integrasi ke AVA Care untuk kunjungan rumah. |
| | Membership & Saldo Sesi | `sanct/program/membership` | Tier Silver/Gold/Diamond, kuota & saldo sesi, masa berlaku, **deferred revenue tercatat sebagai kewajiban di GL**, transfer/hadiah sesi. |
| **Komersial** | POS Spa & Ritel | `sanct/commerce/pos` | Pembayaran treatment + produk skincare/aromaterapi, voucher, gift card, tip terapis. |
| | Retail & Cross-Sell | `sanct/commerce/retail` | Penjualan produk AVA Nutrition di outlet Sanctuary; stok konsinyasi internal antar-unit. |
| | Komisi Terapis | `sanct/commerce/commission` | Komisi per treatment + komisi penjualan produk. |
| **Mutu** | Insiden & Keluhan | `sanct/quality/incident` | Reaksi merugikan, luka bakar, keluhan hasil; alur CAPA. |
| | CSAT & Retensi | `sanct/quality/retention` | Skor kepuasan per terapis & treatment, repeat rate, lifetime value, alert klien lapse. |
| | Utilisasi & Profitabilitas | `sanct/quality/utilization` | Okupansi ruangan, utilisasi terapis, pendapatan per jam per ruangan — metrik paling penting untuk bisnis berbasis kapasitas. |

---

## 10. AVA GLOBAL GROUP — HOLDING COCKPIT (L0)

Bukan unit usaha, tapi lapisan pengendali. Dipertahankan dari V4 dengan penyesuaian.

| Sub-Menu | Route | Fungsi |
|---|---|---|
| Dashboard Ekosistem | `hq/cockpit/dashboard` | Ringkasan live 6 brand: transaksi, pendapatan, pasien/klien hari ini. |
| Pusat Kendali Operasional | `hq/cockpit/ops-control` | Krisis lintas unit: sampel tertahan, QC gagal, stok kritis, alat down, klaim tertolak, izin akan kedaluwarsa. |
| CEO Cockpit | `hq/cockpit/executive` | P&L konsolidasi, burn rate, runway, simulasi BEP, status modul per brand. |
| Konsolidasi Finansial | `hq/finance/consolidation` | Laba rugi per segmen brand, eliminasi transfer internal, rasio profitabilitas, alokasi capex. |
| Kinerja Lintas Unit | `hq/analytics/cross-brand` | Nilai konversi antar-brand: berapa pasien Lab jadi klien Sanctuary, berapa MCU jadi pelanggan Nutrition. **Metrik pembuktian tesis ekosistem.** |
| Tata Kelola & Risiko | `hq/governance/risk` | Register risiko korporat, status kepatuhan, keputusan direksi, kalender RUPS. |

---

## 11. ALUR KERJA LINTAS UNIT (BUKTI EKOSISTEM)

Lima skenario ini adalah alasan sistemnya dijadikan satu. Kalau salah satu tidak bisa jalan, arsitekturnya gagal.

**S1 — MCU korporat → hilir**
`health/corp/project` buat proyek → roster diimport → order lab massal ke `lab/pre/order` → hasil → `lab/ref/fitwork-engine` → keputusan dokter di `health/corp/fitwork` → laporan agregat ke klien → *event* `mcu.finding.dyslipidemia` → tawaran program AVA Nutrition & konsultasi gizi (dengan consent pemasaran, bukan data klinis mentah).

**S2 — Home sampling**
Order di `care/order/intake` → dispatch nakes → sampling di rumah → order otomatis di LIS → rantai dingin ter-log → hasil rilis ke Patient App → bila kritis, `lab/post/critical` memicu callback dan tawaran teleconsult `health/his/telehealth`.

**S3 — Pemulihan pascamelahirkan**
Persalinan/kontrol di AVA Health → flag `eligible.postnatal` → program `sanct/program/postnatal` → sesi di klinik + kunjungan rumah oleh AVA Care → suplemen menyusui dari AVA Nutrition via subscription.

**S4 — Produk Nutrition butuh bukti**
`nutri/rnd/testing` mengorder uji ke AVA Lab → hasil jadi lampiran mutu batch → klaim tersubstansiasi di `nutri/rnd/claims` → dipakai marketing. Transaksi antar-unit tercatat dan dieliminasi di konsolidasi.

**S5 — AVA Tech menjual keluar**
Klien faskes baru → `tech/biz/onboarding` → provisioning tenant di `tech/platform/tenants` → mapping katalog tes pakai `tech/ai/terminology` → go-live LIS → metering & tagihan lisensi.

---

## 12. MATRIKS KEBUTUHAN IMPLEMENTASI

| Unit | Regulasi/Standar | Perangkat Keras | Integrasi Kritis | Peran Kunci |
|---|---|---|---|---|
| **LAB** | ISO 15189:2022, PMK 411/2010, izin lab, K3 limbah B3 | Analyzer, printer thermal, scanner 2D, kulkas terlog, UPS | Analyzer HL7/ASTM, SATUSEHAT, lab rujukan | Sp.PK, penyelia teknis, manajer mutu, analis |
| **HEALTH** | PMK 14/2021, PMK 24/2022 (RME), akreditasi klinik, SIP/STR, Hiperkes/PJK3 | Kiosk, TV display, PACS server, printer gelang | SATUSEHAT, VClaim, Dukcapil, asuransi, payment | Dokter PJ, perawat, admisi, kasir, koordinator MCU |
| **CARE** | SIP/SIK nakes, standar home care, informed consent | HP nakes, cool box terlog, alat portabel | Maps, GPS, LIS, HIS, payment | Koordinator dispatch, perawat, flebotomis |
| **NUTRITION** | BPOM izin edar, Halal (BPJPH), CPOTB, K3 pabrik | Barcode gudang, printer resi, timbangan | Marketplace, ekspedisi, payment, e-Reg BPOM | Penanggung jawab teknis, QC, gudang, ops e-commerce |
| **TECH** | UU PDP 27/2022, ISO 27001 (target), SLA internal | Server/cloud, monitoring, backup offsite | Semua | Product owner, backend, integrasi, DevOps, security |
| **SANCTUARY** | Izin usaha spa/wellness, sertifikasi terapis, izin klinik kecantikan bila ada tindakan medis | POS, tablet booking, sistem suite | Payment, WA, Patient App | Manajer outlet, terapis bersertifikat, dokter penyelia bila tindakan medis |

---

## 13. ROADMAP IMPLEMENTASI (REVISI PASCA-KEPUTUSAN)

Roadmap V5 mengasumsikan GL, payroll, dan PACS **dibeli**. Dengan ADR-09, ketiganya masuk backlog dan garis waktunya bergeser. Ini versi yang jujur:

| Fase | Lingkup | V5 (asumsi beli) | V5.1 (bangun sendiri) |
|---|---|---|---|
| **0** | Fondasi | Bulan 1–2 | **Bulan 1–3** |
| **1** | Mesin pendapatan | Bulan 2–5 | **Bulan 3–7** |
| **2** | Kepatuhan & keuangan | Bulan 5–8 | **Bulan 7–12** |
| **3** | Ekspansi komersial | Bulan 8–12 | **Bulan 12–18** |
| **4** | Produk eksternal | Bulan 12+ | **Bulan 18+** |

**Fase 0 — Fondasi (Bulan 1–3)**
MPI · IAM/RBAC · audit trail · event bus · **skema tenant-aware (ADR-08)** · **dimensi brand/KBLI/cost center (ADR-01)** · registry brand, KBLI & izin · master data inti.
*Kriteria selesai:* tenant "DEMO" bisa dibuat manual dan sistem tetap benar; setiap transaksi contoh sudah membawa keempat dimensi segmen.

**Fase 1 — Mesin Pendapatan (Bulan 3–7)**
LIS Domain 1–5 & 8 · HIS inti (admisi, EMR, order, farmasi, billing) · Queue & Kiosk · Patient App v1 · chargeback & katalog layanan internal AVA Tech.
*Kriteria selesai:* satu sampel bisa berjalan dari check-in sampai PDF terkirim tanpa intervensi manual; kasir bisa tutup shift dengan angka yang cocok.

**Fase 2 — Kepatuhan & Keuangan (Bulan 7–12)**
QC/EQA lengkap · QMS ISO 15189 · rentang rujukan & rules engine · SATUSEHAT · Corporate/MCU penuh · AVA Care operasional · **GL Engine lingkup inti (kas, AR, AP, jurnal, laporan segmen)**.
*Kriteria selesai:* laporan laba rugi per brand bisa terbit dari sistem, bukan dari spreadsheet.

**Fase 3 — Ekspansi Komersial & Core Engine (Bulan 12–18)**
Nutrition (pabrik + OMS + konsinyasi) · Sanctuary · HQ Cockpit konsolidasi · BI/DWH · AI suite dengan guardrail · **Payroll Engine (dengan 3 periode paralel)** · **PACS/DICOM** · GL: pajak & konsolidasi penuh.

**Fase 4 — Produk Eksternal (Bulan 18+)**
Multi-tenant hardening, provisioning & metering, onboarding klien luar, dokumentasi produk, sertifikasi keamanan.

> **Yang perlu Anda tahu tentang pergeseran ini:** tambahan ±6 bulan bukan karena modul bisnisnya bertambah, tapi karena tiga engine generik (GL, payroll, PACS) menyita kapasitas developer yang seharusnya mengerjakan LIS dan HIS — yang justru menjadi pembeda kompetitif AVA. Kalau di tengah jalan garis waktu terasa terlalu panjang, urutan penundaan yang paling aman adalah: **PACS dulu** (radiologi bisa jalan dengan viewer bawaan alat untuk sementara), lalu **payroll** (bisa dikerjakan manual lebih lama dengan risiko terkendali). **GL jangan ditunda** — tanpa buku besar bersegmen, keputusan ADR-01 kehilangan manfaat utamanya.

---

## 14. REGISTER KEPUTUSAN & RISIKO

### 14.1 Keputusan Terkunci (30 Agustus 2026)

| # | Keputusan | Pilihan yang Diambil | ADR Terkait |
|---|---|---|---|
| 1 | Struktur legal | **Satu badan hukum, 6 brand, legalitas dipecah per KBLI** | ADR-01, Bab 1B |
| 2 | Fungsi korporat/MCU | **Dilebur ke AVA Health**; PJK3 & Hiperkes berdiri sebagai lini perizinan, bukan brand | Bab 1, Bab 1B.3 |
| 3 | Build vs buy | **Bangun semua sendiri**, termasuk GL, payroll, PACS | ADR-09, Bab 6.6 |
| 4 | Batas berbagi data | **Event + consent flag saja**; data klinis mentah tidak pernah keluar domain klinis | ADR-07 |
| 5 | Model komersial AVA Tech | **Internal-first**, penjualan eksternal dibuka Fase 4 | ADR-04, ADR-08, Bab 6.7 |
| 6 | Ruang lingkup Fase 1 | **LIS + HIS inti + Queue/Kiosk** | Bab 13 |

### 14.2 Register Risiko dari Keputusan Ini

Setiap keputusan membawa risiko. Ini bukan alasan mengubahnya — ini yang perlu dijaga.

| Risiko | Dari Keputusan | Dampak | Mitigasi yang Sudah Dirancang |
|---|---|---|---|
| **Kapasitas developer tersedot ke engine generik** | #3 Bangun sendiri | LIS & HIS — pembeda kompetitif — tertunda demi GL/payroll/PACS | Urutan penundaan yang aman sudah ditetapkan di Bab 13; `tech/biz/capacity` memantau alokasi tim secara eksplisit |
| **Payroll salah hitung** | #3 | Kepercayaan karyawan & risiko hukum | Wajib 3 periode paralel sebelum migrasi (Bab 6.6 F2) |
| **GL tidak lolos audit** | #3 | Laporan keuangan tidak bisa diandalkan | Jurnal imutabel, koreksi lewat jurnal balik, audit trail penuh; lingkup pajak ditunda ke Fase 3 dengan proses berjalan sebagai jaring pengaman |
| **Satu izin dipakai untuk kegiatan yang tidak dinaunginya** | #1 Satu badan hukum | Sanksi administratif, izin dibekukan | `hq/legal/activity-matrix` + flag `is_medical_procedure` yang memblokir penjadwalan tanpa dokter PJ |
| **KBLI 2020 belum dikonversi ke KBLI 2025** | #1 | NIB/izin bermasalah, akun OSS terkunci | Item terbuka #1 di bawah — perlu KBLI Review sebelum akta/NIB disentuh |
| **Multi-tenancy "dikerjakan nanti"** | #5 Internal-first | Migrasi berminggu-minggu di Fase 4 | ADR-08 + uji tenant "DEMO" sebagai kriteria selesai Fase 0 |
| **Batas Sanctuary vs Health kabur** | #2 & #1 | Tindakan medis berjalan di bawah izin spa | Flag prosedur medis + keharusan dokter PJ aktif (Bab 1B.3) |

### 14.3 Item Terbuka (belum butuh keputusan sekarang, tapi jangan hilang)

1. **KBLI Review 2026.** Konversi seluruh kode dari KBLI 2020 ke KBLI 2025, khususnya lini AVA Tech — kode portal web & platform digital dihapus dan dipecah per sektor, jadi kode penggantinya harus dipilih ulang, bukan dikonversi otomatis.
2. **Tarif transfer internal antar-brand.** Berapa harga Lab menagih Nutrition untuk uji produk? Angkanya memengaruhi P&L segmen, meski netral di level PT.
3. **Kebijakan retensi data.** Berapa lama rekam medis, citra PACS, dan spesimen biobank disimpan — memengaruhi biaya storage secara signifikan mulai Fase 3.
4. **Struktur penanggung jawab teknis.** Siapa PJ untuk tiap lini KBLI, dan apakah ada lini yang saat ini belum punya PJ memenuhi syarat.
5. **Model chargeback AVA Tech.** Berbasis pemakaian, headcount, atau alokasi tetap.

---

---
---

# BAGIAN 3 — SPESIFIKASI IMPLEMENTASI

*Bab 15–21 adalah spesifikasi Fase 0 yang siap diturunkan ke sprint. Bab 22–24 adalah rencana fase lanjutan dan hasil QC dokumen.*

---

## 15. KONVENSI & STANDAR PLATFORM

Konvensi ditetapkan sekali di awal. Mengubahnya setelah 50 tabel dibuat berarti migrasi, bukan penyesuaian.

### 15.1 Penamaan Teknis

| Objek | Aturan | Contoh Benar | Contoh Salah |
|---|---|---|---|
| Tabel | `snake_case`, jamak, prefiks domain | `mpi_person`, `lab_order`, `hr_employee` | `Person`, `tblOrder` |
| Kolom | `snake_case`, tanpa singkatan ambigu | `birth_date`, `created_at` | `bd`, `tgl1` |
| Primary key | `id` (UUID v7) | `id` | `person_id` di tabelnya sendiri |
| Foreign key | `{tabel_tunggal}_id` | `person_id`, `tenant_id` | `fk_person` |
| Boolean | prefiks `is_` / `has_` | `is_active`, `has_consent` | `active_flag` |
| Timestamp | sufiks `_at`, UTC | `released_at` | `release_time` |
| Enum | `UPPER_SNAKE` | `PENDING_VALIDATION` | `pending validation` |
| Route | `unit/domain/fitur` (3 segmen, `kebab-case`) | `lab/pre/checkin` | `lab-checkin` |
| Endpoint API | `/api/v1/{domain}/{resource}` | `/api/v1/mpi/persons` | `/getPerson` |
| Event | `{unit}.{entitas}.{aksi lampau}` | `lab.result.released` | `releaseResult` |
| Kode brand | 5 huruf kapital | `HEALTH`, `LAB`, `CARE`, `NUTRI`, `TECH`, `SANCT`, `HQ` | `1`, `ava-lab` |

### 15.2 Skema Identitas & Penomoran

| Identitas | Format | Sifat | Catatan |
|---|---|---|---|
| **AVA-ID** (identitas orang seumur hidup) | `AVA-` + 10 digit Base32 Crockford | Permanen, tidak pernah dipakai ulang | Tidak mengandung arti; jangan sisipkan tanggal lahir atau kode cabang |
| **Nomor Rekam Medis (MRN)** | `RM-{6 digit}` per faskes | Permanen per faskes | Berbeda dari AVA-ID; satu orang bisa punya beberapa MRN, semua terhubung ke satu AVA-ID |
| **Nomor Order Lab** | `L{YY}{MM}{DD}-{5 digit}` | Harian, reset tiap hari | Terbaca manusia untuk komunikasi lisan |
| **Accession Number** | `{kode lab}{YY}{urut 7 digit}` | Unik seumur sistem | Yang dicetak di barcode tabung |
| **Nomor Dokumen Resmi** | `AVA/{BRAND}/{JENIS}/{ROMAWI BULAN}/{YYYY}/{urut}` | Per brand per jenis | Registry tunggal, tidak boleh ada dua modul menerbitkan nomor sendiri |
| **Nomor Invoice** | `INV/{BRAND}/{YYYYMM}/{urut}` | Per brand | Terhubung ke seri faktur pajak tunggal PT |
| **Batch/Lot Produksi** | `{SKU}-{YYMMDD}-{urut}` | Per batch | Wajib bisa ditelusuri ke pelanggan akhir |

> **Aturan keras penomoran:** semua nomor resmi diterbitkan lewat satu layanan `tech/core/numbering` yang mengunci baris (row lock) saat menerbitkan. Nomor yang dibatalkan **tidak boleh dipakai ulang** — dicatat sebagai `VOID` dengan alasan. Ini yang membedakan sistem yang lolos audit dari yang tidak.

### 15.3 Standar Dasar

| Aspek | Ketetapan |
|---|---|
| Zona waktu penyimpanan | **UTC** di database, konversi ke WIB/WITA/WIT di lapisan tampilan berdasarkan `location_code` |
| Format tanggal tampilan | `DD MMM YYYY` (contoh: 30 Agu 2026); hindari format numerik ambigu |
| Mata uang | IDR, disimpan sebagai integer rupiah penuh (**bukan** float, **bukan** sen) |
| Bahasa | Bahasa Indonesia untuk antarmuka pengguna; Inggris untuk nama teknis (tabel, kolom, kode) |
| Encoding | UTF-8 di semua lapisan |
| Satuan hasil lab | UCUM sebagai penyimpanan; tampilan konvensional atau SI mengikuti preferensi faskes |
| Terminologi klinis | LOINC (tes lab), ICD-10 (diagnosis), ICD-9-CM (tindakan), SNOMED CT bila SATUSEHAT mensyaratkan |
| Nomor telepon | E.164 (`+62812...`) di penyimpanan |

---

## 16. MODEL DATA INTI FASE 0

### 16.1 Peta Entitas

```
  tenant ──┬── brand ──┬── cost_center
           │           └── kbli_registry ── permit ── permit_pic
           └── location

  mpi_person ──┬── person_identifier   (NIK, BPJS, paspor, MRN)
               ├── person_contact
               ├── person_consent
               ├── person_merge_log
               └── person_brand_link   (relasi orang ↔ brand)

  iam_user ──┬── user_role ── role ── role_permission ── permission
             ├── user_session
             └── iam_user ↔ hr_employee (opsional 1:1)

  hr_employee ──┬── employee_profile_clinical
                ├── employee_profile_production
                └── employee_profile_corporate

  fin_account (COA) ── fin_dimension_set (brand, cost_center, kbli, location)

  sys_audit_log        (imutabel, append-only)
  sys_event_outbox     (event bus)
  sys_number_registry  (penomoran dokumen)
  sys_config           (konfigurasi per tenant)
```

### 16.2 Kolom Wajib di Setiap Tabel Transaksional

Tanpa pengecualian. Ini yang membuat ADR-01 dan ADR-08 benar-benar berlaku, bukan sekadar tertulis.

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | UUID v7 | Primary key, urut waktu |
| `tenant_id` | UUID | **NOT NULL**, difilter otomatis di lapisan data |
| `brand_code` | CHAR(6) | **NOT NULL** untuk tabel transaksi |
| `cost_center_code` | VARCHAR(12) | NOT NULL untuk transaksi berdampak biaya/pendapatan |
| `location_code` | VARCHAR(12) | NOT NULL untuk transaksi berlokasi fisik |
| `created_at` / `created_by` | TIMESTAMPTZ / UUID | NOT NULL |
| `updated_at` / `updated_by` | TIMESTAMPTZ / UUID | NULL saat baru dibuat |
| `deleted_at` / `deleted_by` | TIMESTAMPTZ / UUID | **Soft delete saja.** Data klinis & keuangan tidak pernah dihapus fisik |
| `version` | INTEGER | Optimistic locking, naik tiap update |

### 16.3 Domain Tenancy & Organisasi

| Tabel | Kolom Inti | Catatan |
|---|---|---|
| `tenant` | `code`, `legal_name`, `npwp`, `nib`, `is_internal`, `status` | Fase 0: satu baris (`AVA`) + satu baris `DEMO` untuk uji ADR-08 |
| `brand` | `code`, `name`, `tagline`, `primary_color`, `logo_url`, `doc_prefix`, `status` | Enam brand + `HQ` |
| `cost_center` | `code`, `name`, `brand_code`, `parent_code`, `manager_employee_id` | Berjenjang |
| `location` | `code`, `name`, `address`, `city`, `timezone`, `brand_codes[]`, `is_active` | Satu lokasi bisa melayani beberapa brand |
| `kbli_registry` | `kbli_code`, `kbli_version` (`2020`/`2025`), `title`, `brand_code`, `risk_level`, `converted_from`, `status` | Kolom `converted_from` menyimpan jejak konversi 2020→2025 |
| `permit` | `permit_type`, `permit_number`, `kbli_code`, `location_code`, `issued_at`, `expires_at`, `issuing_authority`, `document_url`, `status` | Sumber data kalender kepatuhan |
| `permit_pic` | `permit_id`, `employee_id`, `role`, `license_number`, `license_expires_at` | Penanggung jawab teknis; izin **tidak aktif** bila PIC kosong atau lisensinya kedaluwarsa |
| `service_activity_map` | `service_code`, `brand_code`, `kbli_code`, `permit_id`, `is_medical_procedure` | Isi `hq/legal/activity-matrix`; **layanan tanpa baris di sini tidak boleh dijual** |

### 16.4 Domain Identitas Orang (MPI)

| Tabel | Kolom Inti | Catatan |
|---|---|---|
| `mpi_person` | `ava_id`, `full_name`, `birth_date`, `birth_place`, `sex`, `status` (`ACTIVE`/`MERGED`) | **Hanya data identitas.** Tidak ada kolom klinis, tidak ada catatan medis |
| `person_identifier` | `person_id`, `type` (`NIK`/`BPJS`/`PASSPORT`/`MRN`/`EMPLOYEE`), `value`, `is_verified`, `verified_at`, `verified_source` | Unik per (`type`,`value`,`tenant_id`) |
| `person_contact` | `person_id`, `type` (`PHONE`/`EMAIL`/`ADDRESS`), `value`, `is_primary`, `is_verified` | Riwayat kontak disimpan, tidak ditimpa |
| `person_consent` | `person_id`, `consent_type`, `scope`, `granted_at`, `revoked_at`, `evidence_url`, `granted_via` | Jenis: `GENERAL_TREATMENT`, `DATA_PROCESSING`, `MARKETING`, `RESEARCH`, `PHOTO_USE` — **terpisah, tidak boleh digabung jadi satu centang** |
| `person_brand_link` | `person_id`, `brand_code`, `first_seen_at`, `last_activity_at`, `local_ref` | Yang memungkinkan metrik konversi lintas brand di `hq/analytics/cross-brand` |
| `person_merge_log` | `surviving_person_id`, `merged_person_id`, `reason`, `performed_by`, `performed_at`, `snapshot` | Penggabungan **dapat dibatalkan** — snapshot menyimpan kondisi sebelum merge |

**Aturan deteksi duplikat (Fase 0):** kandidat duplikat dimunculkan bila NIK sama persis, ATAU (nama mirip ≥ 0.9 + tanggal lahir sama), ATAU (nomor HP sama + nama mirip ≥ 0.8). Sistem **hanya mengusulkan**; penggabungan selalu butuh konfirmasi manusia berwenang dan tercatat.

### 16.5 Domain Akses & Audit

| Tabel | Kolom Inti | Catatan |
|---|---|---|
| `iam_user` | `username`, `email`, `password_hash` (Argon2id), `mfa_secret`, `status`, `employee_id`, `last_login_at`, `failed_attempts`, `locked_until` | Satu user bisa lintas brand lewat peran |
| `role` | `code`, `name`, `brand_scope`, `is_system` | Peran sistem tidak bisa dihapus |
| `permission` | `code` (`{route}:{aksi}`), `description` | Aksi: `view`, `create`, `update`, `delete`, `approve`, `export` |
| `role_permission` | `role_id`, `permission_id` | |
| `user_role` | `user_id`, `role_id`, `brand_code`, `location_code`, `valid_from`, `valid_until` | Peran bisa dibatasi brand, lokasi, dan masa berlaku |
| `user_session` | `user_id`, `token_hash`, `ip`, `user_agent`, `expires_at`, `revoked_at` | |
| `sys_audit_log` | `occurred_at`, `actor_user_id`, `actor_role`, `tenant_id`, `brand_code`, `entity_table`, `entity_id`, `action`, `before` (JSONB), `after` (JSONB), `ip`, `reason` | **Append-only.** Tidak ada UPDATE, tidak ada DELETE — dipaksa di level hak akses database, bukan hanya di aplikasi |

**Yang wajib masuk audit log sejak Fase 0:** semua perubahan pada data orang, hasil lab, transaksi keuangan, peran & hak akses, konfigurasi sistem, dan setiap **pembacaan** data klinis oleh pengguna yang bukan pemberi layanan langsung.

### 16.6 Domain SDM

| Tabel | Kolom Inti |
|---|---|
| `hr_employee` | `employee_no`, `person_id` (→ MPI), `join_date`, `end_date`, `employment_type`, `brand_code`, `cost_center_code`, `position`, `supervisor_id`, `status` |
| `employee_profile_clinical` | `employee_id`, `profession`, `str_number`, `str_expires_at`, `sip_number`, `sip_expires_at`, `competencies[]`, `authorized_to_sign[]` |
| `employee_profile_production` | `employee_id`, `cpotb_cert`, `hygiene_training_at`, `medical_checkup_at`, `ppe_size`, `shift_group` |
| `employee_profile_corporate` | `employee_id`, `okr_cycle`, `is_billable`, `hourly_rate_internal` |

> Kolom `authorized_to_sign[]` adalah kunci: hanya pegawai dengan otorisasi aktif yang boleh menandatangani hasil lab jenis tertentu — dan otorisasi itu otomatis gugur saat STR/SIP kedaluwarsa.

### 16.7 Domain Keuangan (Dimensi)

| Tabel | Kolom Inti | Catatan |
|---|---|---|
| `fin_account` | `code`, `name`, `type` (`ASSET`/`LIABILITY`/`EQUITY`/`REVENUE`/`EXPENSE`), `parent_code`, `is_postable`, `requires_dimension[]` | Hanya akun `is_postable` yang bisa dijurnal |
| `fin_dimension` | `type` (`BRAND`/`COST_CENTER`/`KBLI`/`LOCATION`), `code`, `name`, `is_active` | |
| `fin_posting_rule` | `transaction_type`, `debit_account`, `credit_account`, `dimension_source` | Peta otomatis dari transaksi operasional ke jurnal |
| `fin_internal_transfer_rate` | `from_brand`, `to_brand`, `service_code`, `rate`, `valid_from` | Tarif transfer internal antar-brand |

Di Fase 0 yang dibangun hanya **struktur dan dimensinya**; mesin jurnal penuh menyusul di Fase 2 (Bab 6.6 F1).

### 16.8 Domain Event & Sistem

| Tabel | Kolom Inti |
|---|---|
| `sys_event_outbox` | `event_id`, `event_name`, `aggregate_type`, `aggregate_id`, `tenant_id`, `brand_code`, `payload` (JSONB), `occurred_at`, `published_at`, `attempts`, `status` |
| `sys_event_subscription` | `event_name`, `consumer`, `endpoint`, `is_active`, `filter` |
| `sys_number_registry` | `doc_type`, `brand_code`, `period`, `last_number`, `updated_at` |
| `sys_config` | `tenant_id`, `key`, `value` (JSONB), `updated_by`, `updated_at` |

---

## 17. KATALOG EVENT

### 17.1 Amplop Standar

Setiap event membawa amplop yang sama:

```json
{
  "event_id": "01924f...",
  "event_name": "lab.result.released",
  "event_version": 1,
  "occurred_at": "2026-08-30T04:12:33Z",
  "tenant_id": "...",
  "brand_code": "LAB",
  "actor": { "user_id": "...", "role": "SPPK" },
  "aggregate": { "type": "lab_order", "id": "..." },
  "payload": { }
}
```

### 17.2 Aturan Isi Payload (penegakan ADR-07)

| Boleh ada di payload | Tidak boleh ada di payload |
|---|---|
| `ava_id` (referensi, bukan identitas lengkap) | Nama lengkap, NIK, alamat |
| Kode layanan, kode paket | Nilai hasil lab, kode diagnosis |
| Flag turunan dengan consent (`marketing_eligible`) | Catatan klinis, komentar dokter |
| Timestamp, brand, lokasi | Lampiran dokumen medis |

Konsumen yang butuh data klinis **tidak mengambilnya dari event** — ia memanggil API dengan hak aksesnya sendiri, dan panggilan itu tercatat di audit log. Event hanya memberi tahu *bahwa sesuatu terjadi*, bukan *apa isinya*.

### 17.3 Daftar Event Fase 0–1

| Event | Diterbitkan Oleh | Konsumen Utama |
|---|---|---|
| `mpi.person.created` | MPI | Semua brand |
| `mpi.person.merged` | MPI | Semua brand (wajib menyesuaikan referensi lokal) |
| `mpi.consent.granted` / `.revoked` | MPI | Marketing, CRM, Riset |
| `iam.role.assigned` / `.revoked` | IAM | Audit, notifikasi |
| `legal.permit.expiring` | Registry Izin | HQ, brand terkait, HRD |
| `legal.permit.expired` | Registry Izin | **Pemblokir**: menonaktifkan layanan terkait |
| `hr.license.expiring` | HRD | Pegawai, atasan, manajer mutu |
| `lab.order.created` | LIS | Billing, TAT monitor |
| `lab.specimen.rejected` | LIS | Pengirim, mutu |
| `lab.result.released` | LIS | HIS, Patient App, notifikasi |
| `lab.critical.detected` | LIS | Dokter jaga, eskalasi |
| `health.encounter.closed` | HIS | Billing, SATUSEHAT |
| `billing.invoice.issued` | Billing | AR, GL |
| `billing.payment.received` | Billing | AR, GL, notifikasi |

---

## 18. KONTRAK API FASE 0

### 18.1 Konvensi Umum

| Aspek | Ketetapan |
|---|---|
| Gaya | REST, JSON, `application/json; charset=utf-8` |
| Versi | Di path: `/api/v1/...`. Perubahan yang merusak → `/api/v2`, versi lama hidup minimal 6 bulan |
| Autentikasi | Bearer JWT (akses 15 menit) + refresh token (7 hari, rotasi) |
| Otorisasi | Diperiksa di lapisan layanan berdasarkan `permission`, bukan di frontend |
| Tenancy | `tenant_id` **selalu** diambil dari token, **tidak pernah** dari parameter permintaan |
| Idempotency | Header `Idempotency-Key` wajib untuk semua `POST` yang membuat transaksi |
| Pagination | `?page=1&size=25`, maksimum 200; respons memuat `total`, `page`, `size` |
| Filter | `?filter[field]=value`, `?q=` untuk pencarian bebas |
| Rate limit | Per klien; header `X-RateLimit-Remaining` |

### 18.2 Format Respons Baku

Sukses:
```json
{ "data": { }, "meta": { "request_id": "..." } }
```

Gagal:
```json
{
  "error": {
    "code": "MPI_DUPLICATE_CANDIDATE",
    "message": "Ditemukan kandidat pasien duplikat.",
    "details": [ { "field": "nik", "issue": "sudah terdaftar pada AVA-7K3M2P9QX4" } ],
    "request_id": "..."
  }
}
```

Kode error memakai `SCREAMING_SNAKE` bermakna, bukan angka. Pesan ditulis dalam Bahasa Indonesia yang bisa langsung ditampilkan ke pengguna.

### 18.3 Endpoint Fase 0

| Metode | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/v1/mpi/persons` | Daftarkan orang baru; menolak bila kandidat duplikat kuat ditemukan tanpa flag `force` |
| `GET` | `/api/v1/mpi/persons/{ava_id}` | Ambil identitas |
| `GET` | `/api/v1/mpi/persons/search` | Cari berdasarkan NIK, nama+tgl lahir, telepon |
| `POST` | `/api/v1/mpi/persons/match` | Kembalikan kandidat duplikat + skor kemiripan |
| `POST` | `/api/v1/mpi/persons/{id}/merge` | Gabungkan; wajib `reason`; menerbitkan `mpi.person.merged` |
| `POST` | `/api/v1/mpi/persons/{id}/unmerge` | Batalkan penggabungan dari snapshot |
| `POST` | `/api/v1/mpi/persons/{id}/consents` | Catat consent per jenis |
| `GET` | `/api/v1/iam/me` | Profil + peran + izin efektif pengguna |
| `POST` | `/api/v1/iam/auth/login` | Login; mendukung MFA |
| `POST` | `/api/v1/iam/auth/refresh` | Perbarui token |
| `GET/POST` | `/api/v1/iam/roles` | Kelola peran |
| `POST` | `/api/v1/iam/users/{id}/roles` | Berikan peran dengan cakupan brand/lokasi/masa berlaku |
| `GET` | `/api/v1/audit/logs` | Cari audit log (filter entitas, aktor, rentang waktu) |
| `GET/POST` | `/api/v1/org/brands` · `/cost-centers` · `/locations` | Master organisasi |
| `GET/POST` | `/api/v1/legal/kbli` · `/permits` | Registry KBLI & izin |
| `GET` | `/api/v1/legal/activity-map?service_code=` | **Cek kesahihan penjualan layanan** |
| `POST` | `/api/v1/core/numbering/issue` | Terbitkan nomor dokumen resmi |
| `GET` | `/api/v1/system/health` | Health check untuk monitoring |

---

## 19. RBAC — PERAN & MATRIKS AKSES

### 19.1 Prinsip

1. **Hak melekat pada peran, bukan orang.** Tidak ada pengecualian per individu.
2. **Hak minimum.** Peran baru dimulai dari nol, lalu ditambah — bukan menyalin peran admin lalu dikurangi.
3. **Cakupan berlapis.** Setiap penugasan peran dibatasi brand + lokasi + masa berlaku.
4. **Pemisahan tugas.** Yang memasukkan hasil tidak boleh yang memvalidasi; yang membuat PO tidak boleh yang menyetujui; yang mengubah tarif tidak boleh yang menerbitkan invoice.
5. **Otorisasi klinis mengikuti lisensi.** STR/SIP kedaluwarsa → hak tanda tangan otomatis nonaktif, tanpa perlu tindakan admin.

### 19.2 Peran Baku Fase 0

| Peran | Cakupan | Ringkasan Hak |
|---|---|---|
| `SUPERADMIN` | Semua | Konfigurasi sistem. **Tidak punya akses baca data klinis pasien** |
| `HQ_EXECUTIVE` | Semua brand | Baca dashboard & laporan agregat; tanpa akses data individu |
| `BRAND_MANAGER` | Satu brand | Operasional penuh brand-nya |
| `LEGAL_COMPLIANCE` | Semua brand | Registry KBLI, izin, PKS, kalender kepatuhan |
| `FINANCE_STAFF` | Semua brand | AR, AP, invoice; tanpa akses klinis |
| `HR_ADMIN` | Semua brand | Data pegawai, payroll; tanpa akses klinis |
| `REGISTRATION` | Brand + lokasi | Daftar pasien, buat order, cetak label |
| `LAB_ANALYST` | Brand LAB | Check-in, input hasil, verifikasi teknis. **Tidak bisa rilis hasil** |
| `LAB_SUPERVISOR` | Brand LAB | Semua hak analis + kelola QC + tolak sampel |
| `DOCTOR_SPPK` | Brand LAB | Validasi medis & rilis hasil (bila `authorized_to_sign` aktif) |
| `DOCTOR_CLINICIAN` | Brand HEALTH | EMR, order, resep, validasi MCU |
| `NURSE` | Brand HEALTH/CARE | Vital sign, tindakan, asuhan |
| `FIELD_NAKES` | Brand CARE | Aplikasi lapangan; hanya pasien yang ditugaskan kepadanya |
| `CASHIER` | Brand + lokasi | POS, shift; tanpa hak ubah tarif |
| `SALES_CORPORATE` | Brand HEALTH | CRM, penawaran, proyek MCU; **tidak bisa lihat hasil individual** |
| `QUALITY_MANAGER` | Brand LAB/HEALTH | Dokumen mutu, CAPA, audit, indikator |
| `TECH_ENGINEER` | Semua | Deployment, monitoring; akses data produksi hanya lewat prosedur break-glass tercatat |
| `AUDITOR_READONLY` | Semua | Baca audit log & dokumen mutu; tidak bisa mengubah apa pun |

### 19.3 Aturan Khusus yang Wajib Dipaksakan Sistem

- `SALES_CORPORATE` melihat **status** peserta MCU (selesai/belum), bukan **hasil**.
- `HQ_EXECUTIVE` melihat angka agregat; membuka data individu memerlukan peran klinis terpisah.
- Akses `TECH_ENGINEER` ke data produksi memakai mekanisme **break-glass**: butuh alasan tertulis, berlaku terbatas waktu, memicu notifikasi ke Head of Operations, dan tercatat permanen.
- Setiap pembacaan rekam medis oleh pengguna yang bukan pemberi layanan pada episode itu ditandai sebagai **akses tidak biasa** dan masuk laporan bulanan.

---

## 20. KEAMANAN, PRIVASI & UU PDP 27/2022

### 20.1 Klasifikasi Data

| Kelas | Contoh | Kontrol Minimum |
|---|---|---|
| **K1 — Publik** | Katalog layanan, harga umum, konten edukasi | Tanpa batasan |
| **K2 — Internal** | Tarif korporat, SOP, laporan operasional | Login + peran |
| **K3 — Rahasia** | Data pegawai, keuangan, kontrak | Login + peran + audit baca |
| **K4 — Sangat Rahasia (Data Pribadi Spesifik)** | Rekam medis, hasil lab, citra radiologi, data genetik, consent riset | Login + MFA + peran klinis + audit baca + enkripsi kolom + retensi terkontrol |

Rekam medis dan hasil laboratorium adalah **data pribadi bersifat spesifik** menurut UU PDP — perlakuannya tidak boleh disamakan dengan data pelanggan biasa.

### 20.2 Kontrol Teknis Wajib Fase 0

| Kontrol | Ketetapan |
|---|---|
| Enkripsi saat transit | TLS 1.3, HSTS aktif |
| Enkripsi saat disimpan | Enkripsi disk + enkripsi kolom untuk K4 (NIK, hasil, catatan klinis) |
| Sandi | Argon2id; kebijakan panjang minimum, bukan kompleksitas artifisial |
| MFA | Wajib untuk semua peran yang menyentuh K3/K4 |
| Manajemen rahasia | Secret manager; **tidak ada kredensial di repositori kode** |
| Backup | Harian inkremental + mingguan penuh, tersimpan di lokasi terpisah, **terenkripsi** |
| Uji restore | Minimal **triwulanan**, dengan berita acara. Backup yang belum pernah diuji restore dianggap tidak ada |
| Log | Retensi audit log minimal 5 tahun; log aplikasi 1 tahun |
| Pemisahan lingkungan | Data produksi **tidak boleh** disalin ke dev/staging tanpa anonimisasi |

### 20.3 Retensi & Pemusnahan

| Jenis Data | Retensi Minimum | Dasar |
|---|---|---|
| Rekam medis | 5 tahun sejak kunjungan terakhir; ringkasan lebih lama | Ketentuan rekam medis |
| Hasil laboratorium | 5 tahun (sejalan rekam medis) | ISO 15189 + rekam medis |
| Citra radiologi | Ditetapkan kebijakan internal — **item terbuka**, berdampak besar ke biaya storage |
| Dokumen mutu & CAPA | Sesuai siklus akreditasi, minimal 1 siklus penuh | ISO 15189 |
| Dokumen keuangan & pajak | 10 tahun | Ketentuan perpajakan |
| Audit log | 5 tahun | Kebutuhan forensik |
| Data pemasaran | Sampai consent dicabut | UU PDP |

### 20.4 Prosedur Insiden Kebocoran

1. Deteksi & isolasi (< 1 jam) → 2. Penilaian dampak & data terdampak (< 24 jam) → 3. Notifikasi ke pemilik data & otoritas (**3×24 jam** sesuai UU PDP) → 4. Perbaikan akar masalah → 5. Laporan pasca-insiden ke Head of Operations dan register risiko.

Prosedur ini harus **dilatih**, bukan hanya ditulis — minimal satu simulasi per tahun.

---

## 21. DEFINITION OF DONE & QC FASE 0

### 21.1 DoD per Komponen

| Komponen | Dianggap selesai bila |
|---|---|
| Skema data | Semua tabel punya 9 kolom wajib (16.2); migrasi bisa dijalankan maju & mundur; seed data 7 brand + KBLI + izin contoh tersedia |
| MPI | Bisa daftar, cari, deteksi duplikat, merge, unmerge; `mpi.person.merged` terbit dan dikonsumsi minimal satu modul |
| IAM/RBAC | 18 peran baku ada; hak diperiksa di lapisan layanan; token kedaluwarsa & rotasi berfungsi; MFA aktif untuk peran K3/K4 |
| Audit trail | Tidak bisa di-UPDATE/DELETE bahkan oleh superadmin; pencarian < 2 detik untuk 1 juta baris |
| Event bus | Outbox terkirim dengan retry & dead-letter; payload lolos aturan 17.2 |
| Registry legal | Izin kedaluwarsa otomatis memblokir layanan terkait; `activity-map` menolak layanan tanpa payung izin |
| Penomoran | Tidak ada nomor ganda pada uji 100 permintaan bersamaan; nomor batal tercatat `VOID` |
| Dimensi keuangan | Transaksi contoh membawa keempat dimensi, tidak ada yang null |

### 21.2 Skenario Uji Wajib (Gate Fase 0)

| # | Skenario | Kriteria Lulus |
|---|---|---|
| T1 | **Uji tenant DEMO** — buat tenant kedua manual, isi data, jalankan seluruh alur | Tidak ada satu pun baris data yang bocor antar-tenant di seluruh endpoint |
| T2 | **Uji merge MPI** — dua rekaman satu orang di brand berbeda, digabung | Riwayat kedua brand tampil di bawah satu AVA-ID; unmerge mengembalikan kondisi semula |
| T3 | **Uji izin kedaluwarsa** — set `expires_at` izin klinik ke kemarin | Layanan di bawah izin itu langsung tidak bisa dijual; notifikasi terkirim |
| T4 | **Uji lisensi nakes kedaluwarsa** — STR Sp.PK lewat masa berlaku | Hak tanda tangan hasil otomatis nonaktif tanpa tindakan admin |
| T5 | **Uji pemisahan tugas** — analis mencoba merilis hasil | Ditolak dengan pesan jelas; percobaan tercatat di audit log |
| T6 | **Uji imutabilitas audit** — superadmin mencoba menghapus baris audit | Ditolak di level database |
| T7 | **Uji penomoran bersamaan** — 100 permintaan nomor invoice serentak | 100 nomor unik berurutan, tidak ada lompatan tak tercatat |
| T8 | **Uji ADR-07** — Nutrition mencoba membaca hasil lab lewat event | Payload tidak memuat nilai hasil; panggilan API langsung ditolak karena peran |
| T9 | **Uji restore** — pulihkan backup ke lingkungan bersih | Sistem berjalan penuh dari backup, RPO ≤ 24 jam |
| T10 | **Uji break-glass** — engineer mengakses data produksi | Butuh alasan, terbatas waktu, notifikasi terkirim, tercatat permanen |

**Gate keluar Fase 0:** kesepuluh skenario lulus, didemonstrasikan langsung (bukan laporan tertulis), disaksikan Head of Operations. Fase 1 tidak dimulai sebelum gate ini lulus — karena semua modul berikutnya menumpang di atasnya.

---

## 22. RENCANA FASE 1–4 TERPERINCI

### 22.1 Fase 1 — Mesin Pendapatan (Bulan 3–7)

**Urutan build (berurutan, bukan paralel):**

| Urutan | Modul | Alasan Urutan |
|---|---|---|
| 1 | Master data lab (katalog tes, spesimen, tarif) | Semua alur lab bergantung padanya |
| 2 | Pre-analitik (order → check-in → penilaian sampel) | Titik masuk data |
| 3 | Analitik (worklist, interfacing 1 analyzer dulu) | Buktikan integrasi pada satu alat sebelum sepuluh |
| 4 | Post-analitik (validasi, rilis, PDF, e-sign) | Menutup siklus lab pertama |
| 5 | Billing & kasir | Uang masuk tercatat |
| 6 | HIS inti (admisi, EMR, order terintegrasi, resep) | Menambah sumber order |
| 7 | Queue & Kiosk | Memperbaiki pengalaman, bukan prasyarat pendapatan |
| 8 | Patient App v1 (hasil + booking) | Kanal, dibangun terakhir agar tidak berubah-ubah |

**Gate keluar Fase 1:** satu spesimen berjalan dari check-in sampai PDF terkirim ke WhatsApp tanpa intervensi manual; kasir menutup shift dengan selisih nol; TAT tercatat otomatis; seluruh transaksi membawa empat dimensi segmen.

### 22.2 Fase 2 — Kepatuhan & Keuangan (Bulan 7–12)

| Kelompok | Isi |
|---|---|
| Mutu lab | QC harian, Levey-Jennings, Westgard, EQA, kalibrasi, uji banding |
| Akreditasi | Document control, CAPA, risiko, kompetensi, indikator mutu, kesiapan asesmen |
| Interpretasi | Katalog rentang rujukan, verifikasi lokal, rules engine, mesin laik kerja |
| Korporat | Proyek MCU penuh, eksekusi on-site offline, sertifikat massal, laporan agregat |
| Integrasi | SATUSEHAT (Patient, Encounter, Observation, DiagnosticReport) |
| Care | Home care operasional end-to-end |
| Keuangan | **GL Engine lingkup inti**: kas, AR, AP, jurnal, laporan per segmen |

**Gate keluar Fase 2:** laporan laba rugi per brand terbit dari sistem tanpa spreadsheet; berkas asesmen ISO 15189 bisa dicetak dari sistem; pengiriman SATUSEHAT ≥ 95% berhasil.

### 22.3 Fase 3 — Ekspansi & Core Engine (Bulan 12–18)

Nutrition (R&D, regulatori, produksi, gudang FEFO, OMS, konsinyasi) · Sanctuary (booking, ruangan, membership, POS) · HQ Cockpit konsolidasi · BI/DWH · AI suite dengan guardrail · **Payroll Engine** (3 periode paralel) · **PACS/DICOM** · GL: pajak & konsolidasi penuh.

**Gate keluar Fase 3:** simulasi recall dari lot ke pelanggan akhir selesai < 15 menit; payroll paralel cocok 3 periode berturut-turut; konsolidasi 6 brand + eliminasi transfer internal terbit otomatis.

### 22.4 Fase 4 — Produk Eksternal (Bulan 18+)

Provisioning tenant mandiri · metering & penagihan lisensi · portal klien · onboarding & migrasi data · dokumentasi produk · sertifikasi keamanan · pipeline penjualan SaaS.

**Prasyarat masuk Fase 4:** sistem sudah berjalan stabil di enam brand internal minimal 6 bulan, dengan insiden P1 nol dalam 3 bulan terakhir. Menjual sistem yang belum stabil di rumah sendiri adalah cara tercepat merusak reputasi merek.

### 22.5 Ketergantungan Kritis

```
Fase 0 (MPI, IAM, audit, dimensi, event)
   └─> semua fase berikutnya — tanpa pengecualian

Master data lab ──> Pre-analitik ──> Analitik ──> Post-analitik ──> Billing
                                        └──> QC (Fase 2)
                                        └──> Rentang rujukan ──> Mesin laik kerja ──> MCU korporat

HIS inti ──> SATUSEHAT
         └─> Queue/Kiosk (opsional, tidak memblokir)

GL Engine ──> Konsolidasi HQ ──> Cockpit CEO
Registry izin ──> Activity matrix ──> Penjualan layanan apa pun
```

**Baris terakhir perlu ditegaskan:** tidak ada layanan yang boleh dijual sebelum terpetakan di activity matrix. Ini satu-satunya pengaman terhadap risiko terbesar dari struktur satu badan hukum.

---

## 23. TATA KELOLA PENGEMBANGAN

| Aspek | Ketetapan |
|---|---|
| Lingkungan | `dev` → `staging` → `production`. Data produksi tidak pernah disalin ke bawah tanpa anonimisasi |
| Promosi kode | Wajib lolos uji otomatis + review minimal 1 orang + UAT oleh unit pemilik proses |
| Versioning | Semantic versioning per modul; changelog per rilis per brand |
| Jadwal rilis | Rilis terjadwal (mis. tiap 2 minggu); hotfix di luar jadwal hanya untuk P1 |
| Rollback | Setiap rilis wajib punya rencana rollback yang sudah diuji di staging |
| Change control | Perubahan pada modul klinis & keuangan butuh persetujuan pemilik proses, bukan hanya developer |
| Backlog lintas unit | Satu backlog, prioritas ditentukan bersama di forum bulanan — mencegah unit terkeras suaranya selalu didahulukan |
| Kapasitas | Dipantau di `tech/biz/capacity`; komitmen tidak boleh melebihi kapasitas terukur |

**Tim minimum realistis untuk garis waktu Bab 13:** 1 product owner (Anda), 1 arsitek/tech lead, 3–4 backend, 2 frontend, 1 QA, 1 DevOps paruh waktu, plus narasumber domain dari Lab dan Health. Dengan tim lebih kecil, garis waktu memanjang secara proporsional — bukan berarti tidak bisa, tapi jangan direncanakan seolah bisa.

---

## 24. HASIL QC DOKUMEN

### 24.1 Cakupan Pemeriksaan

Konsistensi konvensi route · kelengkapan pemilik modul di matriks · konsistensi nama brand & namespace · keselarasan keputusan (ADR) dengan isi bab · keselarasan roadmap dengan konsekuensi keputusan · akurasi rujukan regulasi.

### 24.2 Temuan & Perbaikan

| # | Temuan | Status |
|---|---|---|
| Q1 | Route Bab 10 (HQ) memakai 2 segmen, melanggar ADR-05 | **Diperbaiki** — semua diubah ke 3 segmen |
| Q2 | Modul "Kasir POS & Shift" di matriks 3.2 tidak punya pemilik (M) | **Diperbaiki** — HEALTH ditetapkan sebagai master |
| Q3 | Modul "HRD — Shift & Roster" tidak punya pemilik (M) | **Diperbaiki** — HQ ditetapkan sebagai master |
| Q4 | Istilah "6 PT" dan "unit usaha" tercampur dengan "brand" | **Diperbaiki** — istilah baku: *brand* untuk identitas pasar, *lini kegiatan* untuk KBLI |
| Q5 | Roadmap V5 mengasumsikan GL/payroll/PACS dibeli, bertentangan dengan ADR-09 | **Diperbaiki** — Bab 13 direvisi dengan garis waktu jujur |
| Q6 | Kode KBLI 2020 berisiko dipakai langsung untuk keperluan legal | **Diperbaiki** — diberi peringatan eksplisit + status KBLI 2025 |
| Q7 | Batas wellness vs tindakan medis tidak dipaksakan sistem | **Diperbaiki** — flag `is_medical_procedure` + keharusan dokter PJ |
| Q8 | `entity_code` (istilah V5) tidak konsisten dengan `brand_code` | **Diperbaiki** — diseragamkan ke `brand_code` |
| Q9 | Judul Bab 1 masih memakai istilah "unit usaha" setelah istilah baku ditetapkan menjadi *brand* | **Diperbaiki** |
| Q10 | Route penomoran memakai namespace `core/` yang bukan salah satu dari 7 namespace unit | **Diperbaiki** — menjadi `tech/core/numbering` |

**Metode QC:** pemeriksaan otomatis atas seluruh 249 route unik (konvensi 3 segmen, namespace sah, duplikasi lintas bab), kelengkapan kolom pemilik pada matriks 3.2, dan pencarian istilah tidak konsisten — dilanjutkan pembacaan manual atas keselarasan ADR dengan isi bab.

### 24.3 Kelengkapan Cakupan

| Yang Diminta | Status |
|---|---|
| Sistem disesuaikan ke 6 unit usaha | ✅ Bab 1, 1B |
| Mapping ulang menu utama & sub-menu per porto | ✅ Bab 4–10 |
| Penanganan menu beririsan (HRD, dll) | ✅ Bab 3, matriks 21 modul + ekstensi per unit |
| AVA Lab — LIS dijabarkan penuh | ✅ Bab 4, 11 domain / ~65 sub-menu |
| AVA Health — HIS, Apps, Corporate, Kiosk, Queue | ✅ Bab 5, 5 domain |
| AVA Tech — pengembangan seluruh sistem | ✅ Bab 6, 6 domain termasuk core engine |
| AVA Sanctuary — operasional wellness | ✅ Bab 9 |
| Spesifikasi Fase 0 siap sprint | ✅ Bab 15–21 |
| Rencana fase lanjutan | ✅ Bab 22 |

### 24.4 Yang Belum Ditulis (Diakui Terbuka)

1. **ERD visual & DDL sebenarnya** — Bab 16 adalah definisi entitas, belum skrip migrasi.
2. **Wireframe** — belum ada satu pun rancangan layar.
3. **Spesifikasi laporan** — format PDF hasil lab, sertifikat sehat, dan laporan agregat MCU belum dirinci per elemen.
4. **Pemetaan FHIR SATUSEHAT** — resource per field belum dipetakan.
5. **Rencana migrasi data lama** — dari sistem yang berjalan sekarang ke platform ini.
6. **Anggaran** — dokumen ini merencanakan waktu dan lingkup, bukan biaya.

---

*Dokumen ini adalah blueprint arsitektur dan spesifikasi Fase 0. Bab 1–14 bersifat keputusan dan struktur; Bab 15–21 siap diturunkan ke sprint; Bab 22–23 adalah rencana dan tata kelola. Rujukan KBLI di dalamnya bersifat indikatif dan wajib diverifikasi di OSS terhadap struktur KBLI 2025 sebelum dipakai untuk keperluan legal. Setiap perubahan pada dokumen ini mengikuti change control di Bab 23 dan dicatat sebagai versi baru.*

**— Akhir Dokumen AVA-DOC-ARCH-2026-V5.1 —**
