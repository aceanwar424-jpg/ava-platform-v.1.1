# ONELAB PLATFORM — Dokumen Induk

> **Satu-satunya dokumen yang harus dibaca lebih dulu.** Berisi visi, cakupan, arsitektur,
> kondisi nyata, aturan yang mengikat, dan peta jalan. Dokumen lain hanya memuat rincian
> dan tunduk pada berkas ini. Bila ada pertentangan, **berkas ini yang berlaku.**
>
> Pemilik: Ace Anwar — Head of Operations, OneLab Diagnostics
> Diperbarui: 15 Agustus 2026

---

## 1. Visi & Misi

**Visi.** Menjadi satu sistem yang mengorkestrasi seluruh operasi kesehatan — klinik,
laboratorium, wellness, dan layanan ke rumah — dalam satu kebenaran data, dari
pendaftaran pasien sampai laporan keuangan dan mutu.

**Misi.** Menyatukan yang hari ini terpisah-pisah. Di pasar, sistem operasional kesehatan
sudah lengkap tetapi berserak: LIS sendiri, SIMRS sendiri, akuntansi sendiri, CRM sendiri.
OneLab menyatukannya seperti Odoo menyatukan operasi bisnis — tetapi jauh lebih dalam pada
sisi klinik dan laboratorium, lengkap dengan **Lab Connector** siap pasang agar aliran data
dari alat lab berjalan otomatis penuh.

**Tiga hal yang membuatnya bukan sekadar SIMRS lain:**

1. **Kedalaman ops, bukan hanya transaksi.** TAT per tahap, QC, autoverifikasi, mutu ISO 15189 — hal yang biasanya jadi lampiran, di sini jadi inti.
2. **Sampai ke manajemen dan penjualan.** Kontrak korporat, komisi rujukan, pipeline sales, OKR — bukan berhenti di kasir.
3. **Dua wujud, satu sumber kode.** Terpasang sebagai `.exe` di komputer dedicated klinik, **dan** dibuka lewat peramban — dengan data yang bisa disinkronkan.

**Tujuan komersial.** Dikembangkan penuh untuk dipakai sendiri lebih dulu, lalu dijual
berulang ke klinik dan laboratorium lain. Karena itu semua keputusan teknis dinilai dengan
satu pertanyaan: *apakah ini masih benar ketika dipasang di komputer orang lain?*

---

## 2. Cakupan produk

Dua lini yang diorkestrasi jadi satu, berbagi satu basis data dan satu katalog:

| Lini | Fokus | Contoh isi |
|---|---|---|
| **OneLab** | Klinik & Laboratorium | Pendaftaran, rekam medis, lab (LIS), radiologi, farmasi, rawat inap, kasir, MCU, inventory, keuangan, HRD |
| **AVA Health** | Wellness & layanan ke rumah | Telekonsultasi, home care, marketplace & sewa alkes, wearable/IoT, caregiver, korporat B2B wellness |

**Aplikasi eksternal** (di luar staf) dijembatani halaman `portal.html`:
portal pasien & customer, aplikasi home service, portal nakes home care, pelacakan hasil,
kiosk antrian, portal klien korporat, dan portal dokter referral.

---

## 3. Arsitektur

```
                    ┌──────────────── satu sumber kode ────────────────┐
                    │        onelab-platform/  (HTML + JS modular)     │
                    └───────────────┬─────────────────┬───────────────┘
                                    │                 │
                 ┌──────────────────┘                 └──────────────────┐
                 ▼                                                       ▼
    OneLab Desktop.exe (Electron)                              Peramban (Vercel)
    ├─ Local Engine → PGlite (PostgreSQL 17 WASM)              └─ Supabase cloud
    │   • shim PostgREST di :54329
    │   • autentikasi lokal (kredensial di DB)
    ├─ Server statis platform di :5174
    └─ Tab: Sistem Utama · Portal Apps · Lab Connector · Table Editor · SQL Studio

    Lab Connector (layanan Node terpisah, UI status di :9999)
    └─ menangkap kiriman HL7/ASTM dari alat lab → basis data
```

**Prinsip yang mengikat arsitektur:**

- **Tidak ada path absolut di kode.** Lokasi diturunkan dari posisi berkas/exe. Ini syarat mutlak agar `.exe` hidup di komputer klien.
- **Adapter data, bukan cabang if.** Sumber data dipilih lewat konfigurasi: `local` (PGlite) · `supabase` · `postgres` milik klien. Disiapkan sejak awal supaya bundel siap-instal bisa dibuat kapan saja.
- **Rahasia tidak pernah masuk repo.** Kunci LLM dan kredensial lewat `.env` / `js/config.local.js`, keduanya diblok `.gitignore`.
- **Data hidup terpisah dari kode.** `pglite-data/` adalah basis data operasional — bukan artefak build, tidak boleh ikut dihapus saat bersih-bersih.

---

## 4. Kondisi nyata hari ini

Hasil audit fungsional atas 50 berkas modul / ±31.830 baris. **Angka ini jujur, bukan target.**

| Domain | Kematangan | Ringkas |
|---|---|---|
| **LIS** — Laboratorium | 80% | Terkuat. Barcode, penolakan spesimen, worklist & TAT, rentang rujukan, delta check, validasi 2 jenjang, QC, parser HL7/ASTM |
| **SAP · MM** — Logistik | 70% | PR berjenjang, PO, GR, GI, batch/FEFO, opname, kartu stok, MRP, valuasi & ABC |
| **CRM & Sales** | 65% | Partner, leads, deals, MOU, surat bernomor, voucher, MCU proyek, OKR |
| **SAP · HCM** — SDM | 45% | Karyawan, cuti, jadwal, absensi. Penggajian masih tabel estimasi |
| **SIMRS** — Klinik | 25% | Pendaftaran sangat rinci, anamnesa, kasir. Rekam medis masih baca-saja |
| **RIS** — Radiologi | 15% | Menumpang tabel `lab_results`; unggah berkas + cetak |
| **SAP · FI/CO** — Akuntansi | 12% | Baru faktur penjualan + kasir |

**Yang benar-benar masih kosong:** rawat inap, farmasi, klaim BPJS/INA-CBG,
buku besar & jurnal, PACS/DICOM, SOAP/CPPT.

**SATUSEHAT/FHIR** tidak lagi kosong, tetapi belum tuntas: gerbang sisi server,
pencatatan jejak, dan converter Patient · Observation · Encounter ·
DiagnosticReport sudah ada; kredensial dan converter lanjutan menyusul.

**Sudah selesai belakangan ini (Agustus 2026):**

- Kerja 32 berkas yang menganggur sejak Juli akhirnya masuk git; rahasia dikeluarkan dari repo.
- Seluruh path absolut `D:\...` dicabut dari Electron dan skrip pendukung.
- Satu launcher induk `ONELAB.bat` menggantikan tiga berkas `.bat`.
- **Autentikasi sungguhan.** Sebelumnya login sepenuhnya palsu — ada tiga jalur pintas terpisah yang otomatis masuk sebagai admin. Ketiganya ditutup; lihat §5.
- Tab **Lab Connector** dan halaman hub **Portal Apps** ditambahkan ke shell desktop.
- Menu AVA Health digabung ke Portal Customer sebagai satu daftar berkelompok.
- **Git tunggal di root** — `desktop-app/` akhirnya terversi (343 commit terjaga).
- **Migrasi skema bernomor** menggantikan pemuatan massal yang menelan kegagalan.
- **RBAC ditegakkan di server**; dua lubang ditutup: eskalasi hak akses lewat PATCH
  `user_profiles`, dan pencabutan akses yang baru berlaku 12 jam kemudian.
- **Outbox offline-first**, cadangan, dan pemulihan yang sudah diuji pulih.
- **Gerbang SATUSEHAT** menggantikan integrasi lama yang melaporkan sukses palsu.

---

## 5. Aturan & batasan yang mengikat

Bagian ini tidak boleh dilanggar tanpa persetujuan manusia yang eksplisit.

### 5.1 Keamanan & akses
- **Tidak ada jalur pintas login.** Pernah ada tiga (stub di engine, auto-login localhost di `index.html`, fallback offline di `auth.js`) dan semuanya sudah dihapus. Jangan menambahkan yang baru dengan alasan kemudahan.
- Kata sandi di-hash **scrypt + salt acak per pengguna**; tidak pernah tersimpan polos.
- Token ditandatangani **HMAC-SHA256** dengan rahasia per-instalasi di folder data.
- Peran dibaca dari `user_profiles.role` — sumber kebenaran yang sama untuk mode lokal maupun cloud.
- `/rest/v1` menolak permintaan tanpa token sah. Akun terkunci 15 menit setelah 5 kali gagal.
- **Kunci API tidak boleh masuk bundel peramban.** Siapa pun bisa membacanya lewat DevTools. Semua panggilan LLM wajib lewat gerbang sisi server: Edge Function `llm-gateway` di mode cloud, dan `/functions/v1/llm-gateway` pada engine lokal. Peramban hanya menerima cuplikan kunci untuk tampilan status, tidak pernah nilainya.

### 5.2 Legal & kepemilikan (IP)
- Jangan menggabungkan aset milik OneLab (data, dokumen, kode kantor) ke produk generik tanpa kejelasan lisensi. Tandai tiap aset: `OWNED_BY: onelab | personal | generic`.
- Jangan menyalin harga, PKS/MoU, atau daftar klien OneLab ke repo produk.
- Default: bangun IP baru sebagai **generik & parameterized**.

### 5.3 Kepatuhan
- Keluaran mutu selaras **ISO 15189:2022**, sertakan referensi klausul.
- Hierarki sumber rentang rujukan: pedoman nasional → guideline internasional → reference lab → konsensus CLSI → **IFU kit reagen sebagai standar operasional yang mengikat**.
- **Tidak ada data pasien nyata** di template/produk. Anonimkan; patuhi UU PDP No. 27/2022. Data uji harus sintetis.

### 5.4 Integritas data katalog
- **Jangan pernah** mengubah `Kode Material` dan `Nama Pemeriksaan` — keduanya kunci join.
- Panel (mis. CBC) **wajib** dipecah jadi baris analit individual, masing-masing berkode sendiri.
- Rentang rujukan **wajib** dipisah ke kolom terpisah (Operator, Batas Bawah, Batas Atas, Jenis Nilai, kelompok usia/sex) — jangan dikolapskan jadi satu sel. Syarat kompatibilitas LIS.
- Pemetaan standar: **LOINC = OBX-3**, **UCUM = OBX-6**. Tidak ada "kode HL7" terpisah per analit.

### 5.5 Agentic (AI)
- **Klinis** (hasil, diagnosis, nilai kritis, nasihat medis) → **selalu keputusan manusia**. Agent hanya menyusun draft dan menandai.
- **Finansial** (bayar, transfer, refund, pembelian) → agent **tidak pernah** mengeksekusi.
- Panggilan model lewat satu adapter — **provider-agnostic**, jangan kunci satu vendor.
- Teks medis hasil AI memakai delimiter `[[SECTION_NAME]]`, bukan JSON (lebih tahan escape/tanda baca).

### 5.6 Disiplin scope
- Jangan membangun fitur besar sebelum ada satu klien atau uji nyata yang memvalidasinya.
- Operasi transformasi harus **idempoten dan dapat diaudit**.

---

## 6. Peta jalan

### 6.1 Jalur platform — yang membuat produk bisa dijual

| Fase | Isi | Status |
|---|---|---|
| **0** | Fondasi: satu launcher, cabut path absolut, amankan rahasia, autentikasi nyata | ✅ Selesai |
| **1** | Git tunggal di root, migrations bernomor, gerbang LLM sisi server | ✅ Selesai — restrukturisasi `apps/`+`packages/` sengaja dilewati (risiko tinggi, nilai rendah dibanding Fase 2–5) |
| **2** | Multi-tenant + RBAC — agar klien ke-2 tidak perlu menyalin kode | ✅ Inti selesai — matriks peran-izin di DB, penegakan sisi server. Kolom `tenant_id` per tabel operasional menunggu cloud multi-klinik benar-benar digelar |
| **3** | Sync engine offline-first + backup/restore | ◐ ±60% — outbox, cadangan, dan pemulihan terverifikasi. Pendorong ke cloud menunggu keputusan project Supabase |
| **4** | Lisensi & aktivasi, installer NSIS, auto-update — **setelah ini produk bisa dijual** | Belum mulai; sebaiknya menunggu calon pembeli pertama |
| **5** | Kedalaman domain: SATUSEHAT/RME, connector dua arah, QC/EQA, TAT analytics | ◐ Dimulai — gerbang SATUSEHAT sisi server + pencatatan jejak siap; converter baru Patient & Observation |
| **6** | Kemasan komersial: edisi produk, tenant demo, dokumentasi, materi training | Belum mulai |

### 6.2 Jalur fungsional — lima fase OneLab

1. **Fondasi, Keamanan & Keselamatan Pasien** — risiko berlaku atas data yang sudah ada sekarang; tidak boleh menumpuk modul di atas fondasi yang bocor.
2. **Menyambung yang Sudah Ada** — termurah, dampak terbesar; mesinnya sudah ada, tinggal disambung.
3. **Rekam Medis & Alur Klinik** — tanpa rekam medis yang bisa ditulis, klaim tak bisa disusun.
4. **Keuangan & SDM (FI/CO/HCM)** — modul lain sudah menghasilkan angka yang siap diposting.
5. **Kepatuhan & Ekspansi** — butuh keputusan bisnis lebih dulu.

### 6.3 Jalur agentic — horizon panjang

- **2026–2035 · Terhubung & Prediktif** — interoperabilitas wajib (SATUSEHAT/BPJS/FHIR), analitik prediktif, tata kelola UU PDP, CDS dengan konfirmasi manusia.
- **2035–2075 · P4 Medicine** — genomics & farmakogenomik, pemantauan berkelanjutan, surveilans AMR, digital twin, MLOps.
- **2075–2125 · Kesehatan Terprogram** — orkestrasi lab otonom dengan supervisor keselamatan, QA terapi lanjut, tata kelola neuro-data.

Tiga sumbu evolusinya: reaktif → prediktif → preskriptif; internal → terhubung → ekosistem;
operasional → klinis-lanjut → terprogram. Otonomi hanya boleh tumbuh sebanding dengan
**tulang punggung kepercayaan** yang menopangnya.

---

## 7. Cara menjalankan

**Sehari-hari:** double-click `ONELAB.bat` di folder induk. Sekali klik, semuanya menyala —
aplikasi utama plus Lab Connector di latar belakang. Navigasi lewat tab di dalam aplikasi.
Boot pertama ±10–15 detik untuk menyiapkan basis data.

**Perintah tambahan:** `ONELAB.bat backup` → membuat cadangan basis data.

**Akun pertama.** Pada instalasi baru, akun admin dibuat otomatis dengan kata sandi **acak**
(bukan default tetap, karena default akan jadi pintu belakang saat produk dijual). Kredensialnya
ditulis ke `desktop-app\LOGIN_ADMIN_PERTAMA.txt`. Masuk, ganti kata sandi, lalu hapus berkas itu.

**Porta yang dipakai:** `5174` platform statis · `54329` shim PostgREST · `9999` UI Lab Connector.

---

## 8. Indeks dokumen

Berkas induk ini menggantikan dokumen-dokumen berikut sebagai **titik masuk**. Rinciannya
tetap berlaku di tempatnya masing-masing:

| Berkas | Isi rinci |
|---|---|
| `AGENTS.md` | Aturan kerja agent & work item produktisasi (P1–P5) |
| `onelab-platform/ONELAB_ROADMAP.md` | Lima fase fungsional + checklist kemajuan per butir |
| `onelab-platform/docs_arsip/onelab/ONELAB_FASE1–5.md` | Uraian tiap fase fungsional |
| `onelab-platform/AGENTIC_ROADMAP.md` | Katalog departemen agent, matriks mandat R1/R2/R3 |
| `onelab-platform/AGENTIC_VISION_100Y.md` | Proyeksi 100 tahun, tiga horizon |
| `onelab-platform/ONELAB_AGENTIC_SPEC.md` | Spesifikasi teknis agentic |
| `onelab-platform/docs_arsip/agentic/*.md` | Rancangan RAG, overlap, fase agentic |
| `onelab-platform/connector/README.md` | Pemasangan & konfigurasi Lab Connector |
| `onelab-platform/sql_arsip/README.md` | Urutan muat skema — **bukan arsip, ini sumber skema hidup** |
| `onelab-platform/.claude/MAP.md` | Peta simbol & jebakan per berkas |
| `docs/gtm/*.md` | Materi go-to-market |
| `templates/smm/**` | Pustaka modul SMM ISO 15189 |

> `desktop-app/CARA_KERJA.md` berisi rincian mekanisme desktop: arsitektur porta, resolver lokasi berkas, migrasi, serta cadangan dan pemulihan.

---

## 9. Utang yang diketahui

Dicatat terbuka agar tidak hilang:

1. **Kredensial SATUSEHAT belum diisi.** `SATUSEHAT_CLIENT_ID`, `SATUSEHAT_CLIENT_SECRET`, dan `SATUSEHAT_ORG_ID` di `desktop-app/.env` masih kosong, jadi gerbangnya melapor `siap: false`. Mulai dari `SATUSEHAT_ENV=stg`. Cocokkan juga alamat bawaan dengan portal Anda — alamat resmi pernah berubah.
2. **Dua project Supabase** tercatat di konfigurasi; hanya `rmyqzyfvlmjxtatpctks` yang benar-benar dipakai kode. Yang satu lagi perlu dipastikan lalu dibersihkan. **Ini yang menghambat pendorong sync ke cloud (Fase 3).**
3. **Kunci yang pernah tertulis di berkas kerja perlu dirotasi** di dashboard penyedia masing-masing.
4. **Kunci Gemini kedua (`AQ.A…ZJDw`) ditolak Google** — bukan kehabisan kuota, melainkan tidak sah/dicabut; tidak akan pulih sendiri. Perlu diterbitkan ulang di Google AI Studio lalu diganti di `desktop-app/.env`. Sementara ini gerbang otomatis melewatinya, jadi fitur AI tetap jalan dengan satu kunci.
5. **Portal korporat & dokter referral** belum aktif sebagai portal eksternal mandiri; fiturnya sudah ada di dalam aplikasi customer, tetapi akses bertoken bercakupan terbatas belum dibangun.
6. ~~`App.tsx` error tipe~~ — **selesai**: `harga_normal` dikonversi ke angka sebelum dikirim; type-check kini nol error di kedua proyek.
7. **Converter FHIR:** Patient, Observation, Encounter, dan DiagnosticReport sudah ada. Belum ada: Condition, Procedure, Composition — dibutuhkan untuk kepatuhan RME penuh.
8. **Lima dari tujuh izin belum punya titik penegakan** (`data.export`, `logbook.approve`, `task.assign`, `team.board.view`) — menjaga fitur yang belum dibangun. Matriksnya siap; penegakan menyusul bersama fiturnya.
9. ~~`CARA_KERJA.md` kedaluwarsa~~ — **selesai**: ditulis ulang mengikuti arsitektur sekarang (launcher tanpa menu, resolver path, migrasi, cadangan/pemulihan).
10. **`_karantina_20260815/`** menunggu keputusan hapus: scaffold Next.js mati, connector duplikat, tiga `.bat` lama, `.git` kosong sisa `git init`, dan sisa uji Fase 3.

### Pelajaran yang berulang

Tiga bug terpisah punya akar yang sama: **kode yang lolos di `run-local.js` tetapi rusak di build terpaket**, karena `__dirname` berada di dalam `app.asar`. Yang kena: pencarian folder platform, lokasi basis data, dan pembacaan `.env`. **Verifikasi akhir harus selalu dilakukan pada `.exe` hasil build, bukan mode pengembangan.**

Pola kedua yang berulang: **kegagalan yang menyamar jadi keberhasilan** — `sbGet()` mengembalikan array kosong saat query gagal, `syncToSatuSehat()` melaporkan sukses tanpa mengirim apa pun, `catch(e){}` kosong menyembunyikan tabel yang gagal dibuat, dan kunci yang ditolak dilabeli "kuota habis". Setiap kali ditemukan, kegagalan dibuat berisik.

Pola ketiga: **penyaringan cakupan lewat teks bebas, bukan kunci relasi.** Portal korporat sempat menyaring tagihan dengan `partner_name = corporate_name`. Saat diuji, token satu klien menampilkan tagihan milik *mitra rujukan* yang kebetulan bernama sama — data keuangan pihak ketiga terbuka lewat tautan yang justru dirancang membatasi. Nama tidak unik dan bisa berubah; cakupan wajib memakai kunci yang dijamin unik. Diperbaiki di `0017_portal_tagihan_kunci_relasi.sql`.

Pola keempat: **skrip inline di HTML tidak pernah ikut diperiksa.** `node --check` hanya membaca berkas `.js`. Satu entri menu yang tersisip di tengah entri lain membuat sebuah string tak tertutup, dan seluruh 734 baris skrip inline `index.html` gagal diurai sekaligus — struktur menu mati tanpa satu pun tanda selain sebaris galat di konsol peramban. Kini dijaga `scripts/periksa-html-inline.js`; **jalankan setelah menyunting berkas HTML mana pun.**

```bash
node scripts/periksa-html-inline.js
```
