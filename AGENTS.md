# AGENTS.md — Akselerator Sistem Lab (Produktisasi Aset)

> File konteks & aturan untuk Antigravity. Tujuannya: mengubah tool internal
> yang saat ini *single-lab* menjadi *engine multi-lab* yang bisa diproduktifkan,
> tanpa melanggar batasan legal, kepatuhan, dan integritas data.
> Baca bagian **Constraints & Deny Rules** sebelum mengimplementasikan fitur apa pun.

---

## 1. Konteks Proyek

- **Pemilik:** Ace Anwar — Head of Operations, AVA Diagnostics. Latar: analis lab
  + informatika (LIS/HIS/SIMRS) + sistem mutu (ISO 15189:2022) + membangun tooling sendiri.
- **Misi:** Memaksimalkan aset yang sudah ada agar menjadi produk/jasa yang bisa
  dijual berulang ke klinik & lab lain — bukan sekali pakai untuk satu lab.
- **Prinsip operasi (wajib dipegang agent):**
  1. **Validasi sebelum bangun besar.** Utamakan MVP tipis yang bisa diuji ke 1 klien
     nyata sebelum menambah fitur.
  2. **Multi-tenant / parameterized sejak hari pertama.** Tidak ada asumsi "AVA" yang
     ter-hardcode.
  3. **Leverage.** Tiap output jadi template/modul yang menambah pustaka aset, bukan pekerjaan sekali pakai.
  4. **Reversibilitas.** Keputusan yang bisa dibatalkan → cepat. Yang tidak (skema data,
     komersialisasi, integrasi eksternal) → berhenti dan minta konfirmasi manusia.

---

## 2. Cara Kerja di Repo Ini (planner hints)

- Selalu **Plan → Execute → Verify**. Tulis rencana ke `implementation_plan.md`, checklist ke `task.md`, bukti ke `walkthrough.md`.
- Pecah tiap Work Item menjadi sub-task **≤ 1 jam**.
- Setiap `implementation_plan.md` **wajib** memuat section **"Implikasi IP & Kepatuhan"**
  (lihat §4) sebelum mulai koding.
- **Human checkpoint wajib** (jangan lanjut tanpa persetujuan) sebelum:
  - Mengubah skema data master (kolom katalog, kunci relasional).
  - Menyertakan/menyalin data spesifik AVA ke dalam produk generik.
  - Integrasi ke sistem eksternal (LIS/SIMRS klien, API vendor, DB produksi).
  - Mengubah dependensi ke satu vendor LLM tertentu.
- Kerjakan sesuai **urutan prioritas** di §3 (P1 dulu). P1 adalah pengganda semua yang lain.

---

## 3. Sistem yang Dimaksimalkan (Work Items, berurut prioritas)

### P1 — Document Reengineering Engine → *multi-lab*
**Sekarang:** Node.js + LLM, mengubah dokumen QMS AVA ke format HTML standar.
**Target:** Engine yang bisa memproses dokumen **lab mana pun** menjadi keluaran SMM
patuh ISO 15189:2022.
**Sub-tasks:**
- Ekstrak semua konstanta/asumsi khusus AVA ke konfigurasi per-tenant (`tenant.config`).
- Bangun **pustaka template modular** yang dipetakan ke klausul ISO 15189:2022.
- Tambah **lapisan "compliance check"** yang menandai klausul/section yang belum terpenuhi
  pada dokumen masukan, lengkap dengan referensi klausul.
- Bungkus pemanggilan LLM di balik **abstraction layer** (provider-agnostic) — jangan
  kunci ke satu vendor.
- Pertahankan **parsing berbasis delimiter `[[SECTION_NAME]]`**, bukan JSON, untuk teks
  medis hasil AI (lebih tahan escape/punctuation).
**Acceptance criteria:**
- Bisa memproses ≥ 2 set dokumen lab berbeda tanpa perubahan kode (hanya config).
- Output lolos "compliance check" internal dengan laporan gap yang bisa dibaca.
- Tidak ada string/ID AVA yang ter-hardcode di kode inti.

### P2 — Master Test Catalog → produk *siap-LIS*
**Sekarang:** Katalog ~530+ tes dengan reference range, matriks spesimen/stabilitas,
LOINC/UCUM, dan lembar "Status Verifikasi Acuan".
**Target:** Dataset yang bisa **dilisensikan** untuk menyemai LIS/SIMRS klien + jasa
penyesuaian ke menu tes klien.
**Sub-tasks:**
- Pisahkan **catalog inti (generik, produk)** dari **mapping harga/menu AVA (privat)**.
- Buat generator export multi-format (XLSX/CSV/TSV) yang mempertahankan struktur relasional.
- Sediakan skema validasi otomatis (lihat aturan integritas data di §4.3).
- Jadikan lembar **"Status Verifikasi Acuan"** sebagai fitur jual (audit traceability):
  versi acuan + status audit per baris.
**Acceptance criteria:**
- Export bisa langsung di-*import* ke struktur LIS tanpa perbaikan manual kolom.
- Validator menolak file yang melanggar aturan kunci relasional / kolom rentang.

### P3 — QMS/SMM Suite → pustaka modular per-klausul
**Target:** Dari kumpulan dokumen menjadi **pustaka modul** yang "dirakit" per proyek.
**Sub-tasks:**
- Pecah dokumen menjadi modul yang dipetakan ke klausul 15189:2022.
- Beri metadata tiap modul (klausul, versi, tanggal audit, sumber).
- Sediakan mekanisme "rakit paket" dari daftar modul → dokumen final.
**Acceptance:** Satu paket SMM baru bisa dirakit dari modul tanpa menulis ulang dari nol.

### P4 — Batch Test Description Tool → pipa konten
**Sekarang:** Tool HTML penulisan ulang deskripsi tes ke Bahasa Indonesia awam
(batch TSV, parallel, delimiter `[[SECTION]]`, retry gagal).
**Target:** Selain internal, jadikan **mesin konten**: deskripsi patient-facing untuk
situs/lab klien + bahan otoritas LinkedIn.
**Sub-tasks:** mode "publik/patient-facing", ekspor ke format web, template output konten.
**Acceptance:** Bisa menghasilkan deskripsi siap-tayang dari batch tanpa pembersihan manual.

### P5 — Lapisan Compounding (bikin semuanya majemuk)
- **Pustaka aset (single source of truth):** tiap output klien kembali jadi template.
- **Sistem bukti:** tangkap hasil tiap engagement (before/after, waktu, gap tertutup) jadi
  studi kasus semi-otomatis.
- **Pipa konten:** hubungkan P4 → kalender konten LinkedIn.

---

## 4. Constraints & Deny Rules (batasan jangka panjang)

> Ini yang membuat sistem "lebih maksimal" dan aman untuk dikembangkan bertahun-tahun.
> Agent **tidak boleh** melanggar tanpa konfirmasi manusia eksplisit.

### 4.1 Legal & IP
- **JANGAN** menggabungkan aset milik AVA (data, dokumen, kode yang dibuat untuk kantor)
  ke dalam produk generik tanpa kejelasan kepemilikan/lisensi. Tandai asal tiap aset:
  `OWNED_BY: ava | personal | generic`.
- **JANGAN** menyalin data harga, kontrak (PKS/MoU), atau daftar klien AVA ke repo produk.
- Default: bangun IP baru sebagai **generik/parameterized** agar netral secara kepemilikan.

### 4.2 Kepatuhan (ISO 15189 & data)
- Semua keluaran mutu harus **selaras ISO 15189:2022**; sertakan referensi klausul.
- Jaga acuan pada **edisi terkini** (mis. pedoman/guideline versi terbaru). Simpan
  metadata versi + tanggal; tandai acuan kedaluwarsa.
- **Hormati hierarki sumber** untuk reference range: (1) pedoman nasional relevan →
  (2) guideline klinis internasional → (3) reference lab → (4) konsensus CLSI →
  (5) **IFU kit reagen sebagai standar operasional yang mengikat**.
- **JANGAN** menyimpan data pasien nyata di template/produk. Anonimkan; patuhi
  UU PDP (No. 27/2022). Data uji harus sintetis.

### 4.3 Integritas Data Katalog (hard rules)
- **JANGAN PERNAH** mengubah nilai kolom kunci relasional **`Kode Material`** dan
  **`Nama Pemeriksaan`** — keduanya adalah kunci join.
- **Panel** (mis. CBC) **wajib** dipecah menjadi baris analit individual, masing-masing
  dengan kode sendiri. Jangan biarkan tetap sebagai satu baris panel.
- Variabel reference range **wajib dipisah ke kolom terpisah** (Operator, Batas Bawah,
  Batas Atas, Jenis Nilai, kelompok usia/jenis kelamin) — **jangan** dikolapskan jadi
  satu sel. Ini syarat kompatibilitas LIS.
- Tiap baris analit membawa: Operator, Batas Bawah, Batas Atas, Jenis Nilai,
  kelompok usia/sex, **LOINC**, **UCUM**, sumber, dan catatan klinis.
- Ingat pemetaan standar: **LOINC = OBX-3**, **UCUM = OBX-6** (HL7 v2 / FHIR). Tidak ada
  "kode HL7" terpisah per analit.

### 4.4 Arsitektur & Teknis
- **Provider-agnostic LLM:** semua panggilan model lewat satu adapter. Jangan kunci vendor.
- **Delimiter over JSON** untuk teks medis hasil AI: gunakan `[[SECTION_NAME]]`.
- **Multi-tenant sejak awal:** tidak ada asumsi single-lab di kode inti.
- **Idempoten & dapat diaudit:** operasi transformasi harus bisa diulang dengan hasil sama
  dan meninggalkan jejak (log versi input/output) untuk traceability ISO.

### 4.5 Disiplin Scope
- **JANGAN** membangun fitur besar sebelum ada 1 klien/uji nyata yang memvalidasi kebutuhan.
- Utamakan **MVP tipis**; catat ide "nanti" di `backlog.md`, jangan dikerjakan lebih dulu.

### 4.6 Pemeliharaan & Audit
- Versikan pustaka template & katalog (semantic-ish: `MAJOR.MINOR` + tanggal).
- Tiap perubahan acuan/klausul dicatat di changelog dengan sumber.

---

## 5. Tool / MCP Surface (jika tersedia)
- Gunakan MCP filesystem/github untuk operasi repo. Token **read-only** bila memungkinkan.
- **JANGAN** menghubungkan ke DB/LIS produksi tanpa checkpoint manusia (lihat §2).
- Simpan skill teknis berulang di `.agents/skills/<name>/SKILL.md` (mis. skill
  "assemble-smm-pack", "validate-catalog").

---

## 6. Urutan Eksekusi (roadmap ringkas)
1. **P1** Engine multi-lab (config extraction → template modular → compliance check → LLM adapter).
2. **P2** Catalog: pisahkan inti-generik, validator integritas, export siap-LIS.
3. **P3** QMS modular per-klausul.
4. **P4** Batch tool → mode patient-facing / konten.
5. **P5** Lapisan compounding (SSOT + sistem bukti + pipa konten).

## 7. Definition of Done (global)
- Tidak ada data/ID milik AVA yang ter-hardcode di aset generik.
- Lolos aturan §4.3 (integritas data) via validator otomatis.
- Ada `walkthrough.md` berisi bukti (screenshot/log) tiap Work Item.
- Setiap fitur punya section "Implikasi IP & Kepatuhan" yang sudah ditinjau.
