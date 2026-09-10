# LAPORAN AUDIT SISTEM: APPS.AVAHEALTH.SBS
## Fokus Audit: Jenis Login (Corporate, Individual, Nakes, Referral Dokter/Faskes)
**Tanggal Audit:** 5 September 2026  
**Target Sistem:** Portal Web & PWA `https://apps.avahealth.sbs` (`/apps/index.html` + `apps/app.js`)  
**Auditor:** Antigravity AI (Pair Programming with Head of Operations)  
**Dokumen Pendukung:** `AGENTS.md`, `0033_gerbang_masuk_korporat.sql`, `0019_perujuk.sql`, `0030_merek_ava_pada_pesan_portal.sql`, `config/domain.json`

---

## 1. Ringkasan Eksekutif

Portal `apps.avahealth.sbs` dirancang sebagai **Unified Mobile & Customer Super-App** dalam ekosistem AVA Global. Berbeda dengan portal operasional internal HIS/LIS (`his.avahealth.sbs` dan `lis.avahealth.sbs`), portal ini menyajikan antarmuka *responsive mobile-first* yang melayani berbagai pemangku kepentingan eksternal dan tenaga lapangan.

Berdasarkan audit teknis terhadap berkas konfigurasi Vercel, arsitektur frontend (`apps/index.html` dan `apps/app.js`), skema basis data PostgreSQL/Supabase, serta pengujian runtime live, ditemukan kondisi sebagai berikut:

| Jenis Login / Peran | Ketersediaan di UI Login | Mekanisme Backend / Database | Integritas Data & Keamanan | Kesiapan Produksi |
| :--- | :---: | :---: | :---: | :---: |
| **1. Corporate** (B2B MCU) | ✅ Ada (`🏢 Corporate`) | ✅ Supabase RPC `korporat_verifikasi_akses` | ⚠️ Gatekeeper aman, namun akun demo desync | **75%** |
| **2. Individual** (Pasien & Member) | ✅ Ada (`👤 Pasien` & `👑 Member`) | ⚠️ Supabase Auth + Mock Fallback | ❌ Auto-seed fake data ke live DB; query nama longgar | **80%** |
| **3. Nakes** (Staff Home Care) | ✅ Ada (`🩺 Staff Nakes`) | ⚠️ Query `homecare_orders` per string nama | ⚠️ Belum ada form sampling spesimen (ISO 15189) | **50%** |
| **4. Referral** (Dokter / Faskes) | ❌ **TIDAK ADA DI UI** | ❌ Mock 100% di apps; RPC ada di file terpisah | ❌ Hash routing rusak (`#rujukan` blank); UI terputus | **25%** |

---

## 2. Audit Mendalam per Jenis Login

### A. Corporate (Mitra Korporasi MCU & B2B)

#### 1. Pintu Masuk & Alur Autentikasi
* **Pintu Masuk:**
  * Subdomain dedicated: `corp.avahealth.sbs`, `korporat.avahealth.sbs` (tercatat di `config/domain.json` dan `peta-subdomain.js`).
  * Direct URL / hash: `https://apps.avahealth.sbs/#korporat` atau `#corp`.
  * Radio selector pada halaman login: Nilai `corporate`.
* **Input Form:**
  * Menampilkan input tambahan `#corp-code-group` (`Kode Corporate`, input `#login-corp-code`). Nilai contoh/default: `CORP-AVA-01`.
  * Input Email: `Email Perusahaan / PIC`.
  * Input Password: Kata sandi akun korporat.
* **Mekanisme Validasi Backend:**
  * Kode korporat divalidasi pasca-autentikasi melalui RPC PostgreSQL `korporat_verifikasi_akses(p_kode)` (sesuai migrasi `0033_gerbang_masuk_korporat.sql`).
  * Server memeriksa kesesuaian `auth.uid()` dengan `user_profiles.corporate_id`.
  * Membedakan hak akses korporat (`requestor` vs `approver`). Jika requestor, menu approval disembunyikan. Jika approver, menu approval dimunculkan.

#### 2. Modul & Fitur yang Diakses
1. **Home MCU (`corporate-view`):** Informasi profil perusahaan (alamat, PIC, NPWP, nomor rekening, termin tagihan) serta saldo cashback.
2. **Master Karyawan (`corporate-employees-view`):** Roster karyawan, departemen, status kesehatan (Fit/Unfit), fitur import CSV, tambah & hapus karyawan.
3. **Order MCU Massal (`book-examination-view`):** Formulir pengajuan batch MCU baru per paket.
4. **Approval MCU (`examination-approval-view`):** Verifikasi persetujuan batch MCU oleh HR Manager/Approver.
5. **Riwayat MCU (`examination-history-view`):** Pemantauan status pemeriksaan karyawan.
6. **Deposit & Tagihan (`corporate-billing-view`):** Rekapitulasi invoice korporat dan status pelunasan.

#### 3. Temuan Gap & Risiko Kritis (Corporate)
* **[BUG KRITIS - Demo Login Blocked by RPC]:** Pada `apps/app.js` baris 3550, akun demo `corp@avahealth.sbs` dan `admin@avahealth.sbs` diset sebagai token lokal (`master_ava_token_corporate`) tanpa sesi JWT Supabase nyata. Namun pada baris 3625, fungsi tetap memanggil `verifikasiKorporat(corpCodeInputVal)` yang memanggil RPC `korporat_verifikasi_akses`. Karena tidak ada JWT, PostgreSQL mengembalikan error `"Silakan masuk terlebih dahulu."`, sehingga sesi langsung dibatalkan (`localStorage.removeItem('ol_token')`). Akun demo corporate **gagal login**.
* **[RISIKO MULTI-TENANT - Default First Company Fallback]:** Pada baris 2174-2176 di `loadCorporateData()`:
  ```javascript
  if (isSuperAdmin || !currentUserProfile) {
    corpId = allCorporatesForPicker?.[0]?.id || null;
  }
  ```
  Jika akun korporat belum ditautkan dengan benar ke `corporate_id`, sistem secara berbahaya dapat mengambil data perusahaan pertama yang aktif di database. Ini melanggar isolasi data multi-tenant (UU PDP No. 27/2022).
* **[HARDCODED CONSTANTS]:** Kode korporat bawaan ter-hardcode ke `CORP-AVA-01` di form script, melanggar prinsip generalisasi multi-lab.

---

### B. Individual (Pasien B2C & Member VIP Sanctuary)

#### 1. Pintu Masuk & Alur Autentikasi
* **Pintu Masuk:**
  * Host default: `https://apps.avahealth.sbs`.
  * Hash route: `#member` untuk login VIP Member.
  * Radio selector: `patient` ("👤 Pasien / Cust") atau `member` ("👑 Member VIP").
* **Input Form:**
  * Pasien: `No. Rekam Medis / Email` + Kata Sandi.
  * Member: `No. Kartu Member / Email` + Kata Sandi.
  * Modal Registrasi Mandiri: Tersedia tautan "Daftar Pasien Baru" yang membuka `#register-modal` (Nama, HP/WA, NIK, Tanggal Lahir, Alamat).
* **Mekanisme Validasi Backend:**
  * Login akun riil memanggil REST endpoint Supabase Auth: `POST /auth/v1/token?grant_type=password`, lalu mengambil metadata dari tabel `user_profiles`.

#### 2. Modul & Fitur yang Diakses
* **Layanan & Transaksi:**
  * `orders-tracking-view`: Lacak pesanan produk suplemen & auto-refill nutrisi D2C.
  * `homecare-results-view`: Pelacakan status perawat/analis menuju lokasi.
  * `book-test-view`: Katalog pemeriksaan lab individual, pemilihan cabang, keranjang belanja, dan invoice.
  * `book-homecare-view`: Penjadwalan kunjungan rumah (Home Care & Phlebotomy).
  * `buy-package-view`: Pembelian paket medical check-up (MCU).
  * `ava-consult-view`: Telekonsultasi dokter umum/spesialis.
  * `ava-marketplace-view` & `toko-view`: E-commerce alat kesehatan dan produk kesehatan.
* **Kesehatan & Rekam Medis:**
  * `patient-view`: Dasbor kesehatan pasien, status lab terakhir, timeline perawatan.
  * `medrec-view`: Riwayat rekam medis (EHR) terpadu: Hasil Laboratorium, Radiologi X-Ray Thorax, serta Catatan Resep Dokter (SOAP).
  * `ava-devices-view` & `ava-caregiver-view`: Integrasi alat kesehatan pribadi dan delegasi pemantauan keluarga.
  * `member-sanctuary-view`: Khusus Member VIP untuk reservasi layanan spa medis Queen Sanctuary.

#### 3. Temuan Gap & Risiko Kritis (Individual)
* **[CRITICAL - Registrasi Mandiri Hanyalah Mockup]:** Fungsi `handleRegistrationSubmit(event)` di `app.js` baris 2024 sama sekali tidak menyimpan data ke database:
  ```javascript
  closeRegisterModal();
  alert(`Registrasi Akun Mandiri berhasil! No. Rekam Medis (RM) Anda adalah RM-12948. Silakan gunakan untuk masuk.`);
  ```
  Data pasien (NIK, HP, Alamat) langsung dibuang, dan nomor RM di-hardcode ke `RM-12948`. Pasien baru tidak bisa benar-benar mendaftar akun nyata secara online.
* **[CRITICAL - Pencarian Rekam Medis Berdasarkan String Nama]:** Fungsi `loadPatientEHR(patientName)` di `app.js` baris 664 melakukan query:
  `sbGet('lab_results', 'select=*&patient_name=eq.' + encodeURIComponent(patientName))`
  Menggunakan nama tampilan (bukan `mr_number` atau UUID `patient_id`). Ini rentan benturan identitas medis antar-pasien dengan nama serupa, melanggar standar keselamatan pasien (Patient Safety).
* **[CRITICAL - Auto-Seeding Data Tiruan ke Database Produksi]:** Di `app.js` baris 693-740, jika seorang pengguna login dan data rekam medisnya kosong, aplikasi otomatis melakukan `sbPost` data hasil lab fiktif (Hb 14.5, Kolesterol 245, Glukosa 126, Rontgen Thorax PA, Resep Metformin) langsung ke tabel database live `lab_results`, `radiology_orders`, dan `prescriptions`. **Ini melanggar integritas rekam medis dan klausul audit ISO 15189:2022.**

---

### C. Nakes (Tenaga Kesehatan / Petugas Home Care & Flebotomi)

#### 1. Pintu Masuk & Alur Autentikasi
* **Pintu Masuk:**
  * Radio selector: `staff` ("🩺 Staff Nakes").
  * Input Form: `NIP / Email Petugas Nakes` + Kata Sandi.
  * Label: `Portal Tugas Nakes Home Care`.
* **Mekanisme Validasi Backend:**
  * Supabase Auth atau login lokal. Role ditetapkan sebagai `currentRole = 'staff'`.
  * Menampilkan badge: *"Petugas Home Care & Flebotomi"*.

#### 2. Modul & Fitur yang Diakses
* **Sidebar Menu:**
  1. `staff-homecare-view` ("Jadwal Visit Hari Ini"): Menampilkan daftar pasien home care yang harus dikunjungi pada hari berjalan.
  2. `homecare-results-view` ("Riwayat Sampling"): Log riwayat penugasan sampling.
  3. `nearme-view` ("Lokasi Lab & Faskes"): Peta faskes rujukan untuk pengantaran sampel.
  4. `profile-view` ("Profil Petugas"): NIP, STR, dan informasi akun.
* **Aksi Lapangan yang Tersedia:**
  * Buka Rute: Tautan dinamis ke Google Maps berdasarkan koordinat `lat,lng` pasien.
  * Konfirmasi Tiba: Memperbarui status pesanan menjadi `"Tiba di Rumah Pasien"`.
  * Selesai Sampling: Memperbarui status pesanan menjadi `"Sampling Selesai"`.

#### 3. Temuan Gap & Risiko Kritis (Nakes)
* **[GAP PRA-ANALITIK - Kepatuhan ISO 15189:2022 Klausul 6.3 & 7.2]:**
  * Ketika petugas menekan tombol "Selesai Sampling", sistem hanya mengubah string status pesanan.
  * **Tidak ada form input data pra-analitik spesimen:**
    - Nomor barcode tabung spesimen (Sample ID).
    - Jenis tabung/antikoagulan (EDTA, Serum Gel, Citrate, Heparin).
    - Jam pengambilan spesimen aktual (waktu flebotomi).
    - Suhu penyimpanan transport cold-box (2–8°C).
    - Check kelayakan spesimen awal (volume cukup, bebas bekuan/clotting).
* **[PENCARIAN PENUGASAN BERBASIS NAMA TAMPILAN]:**
  * Fungsi `renderStaffHomecare()` baris 1647 memfilter tugas berdasarkan `assigned_staff=eq.${encodeURIComponent(nama)}` atau `petugas_name=eq.${nama}`. Jika nama di akun profil berbeda format dengan nama yang dijadwalkan oleh dispatcher HIS (misal ada gelar "Ns." atau gelar profesi analis "A.Md.AK"), daftar tugas menjadi kosong.
* **[FRAGMENTASI DENGAN NAKES.HTML]:** Repo memiliki portal `nakes.html` mandiri yang memiliki fitur live tracking GPS dan konfirmasi token, namun fitur di `apps/index.html` dibuat ulang secara parsial tanpa integrasi sinkron.

---

### D. Referral (Dokter Perujuk, Klinik & Faskes Rekanan)

#### 1. Pintu Masuk & Alur Autentikasi
* **Status di Halaman Login UI:**
  * ❌ **HILANG DARI FORM LOGIN.** Di `apps/index.html` (baris 140-160), tombol radio role selector hanya ada 4: `patient`, `member`, `corporate`, `staff`.
  * Pilihan `referral` sama sekali tidak memiliki tombol radio di form login!
  * Di `app.js` baris 1999-2004, fungsi `updateLoginFormUI('referral')` sudah disiapkan (Label: *"NPA ID / Email Faskes"*, Title: *"Portal Faskes Referral"*), namun elemen tombol pemanggilnya tidak ada di HTML.
* **Status pada Routing Hash / Subdomain:**
  * ❌ **BUG FATAL DI HASH ROUTER:** Di `app.js` baris 3928-3932:
    ```javascript
    else if (hash === '#rujukan') {
      currentRole = 'corporate'; // <-- SALAH: Diset ke corporate bukannya referral!
      showScreen('dashboard-screen');
      showView('referral-wallet-view', 'Dokter & Lab Referral'); // <-- SALAH: View tidak ada di HTML!
    }
    ```
    Jika dokter membuka URL `https://apps.avahealth.sbs/#rujukan`, sistem malah mengubah perannya menjadi `corporate`, dan memanggil view `referral-wallet-view` (yang namanya di HTML adalah `referral-view`). Akibatnya: **layar dashboard menjadi kosong melompong (blank)**.

#### 2. Modul & Fitur yang Dirender (Bila Dipaksa Aktif)
* **Sidebar Menu (`currentRole === 'referral'`):**
  * `referral-view` ("Riwayat Rujukan").
  * `openReferralForm()` ("Buat Rujukan Baru").
  * `openWithdrawFeeModal()` ("Tarik Komisi").
* **Komponen di `referral-view`:**
  * Dompet Kemitraan: Saldo komisi (`r-fee-balance`).
  * Widget Chat P2P: Konsultasi dokter perujuk dengan Dokter Spesialis Patologi Klinik (Sp.PK).
  * Roster Rujukan: Daftar pasien yang dirujuk beserta estimasi fee.
  * Modal Tarik Komisi: Form input rekening bank dan nominal pencairan.

#### 3. Temuan Gap & Risiko Kritis (Referral)
* **[SHOWSTOPPER - Terputus Total dari UI Login]:** Dokter atau pihak faskes luar tidak memiliki cara untuk masuk ke portal perujuk melalui layar utama `apps.avahealth.sbs`.
* **[100% HARDCODED MOCK DATA]:** Seluruh data rujukan berasal dari array statis `MOCK_REFERRALS` (Budi Santoso, Rian Hidayat, Citra Kirana). Nominal fee dan pencairan tidak pernah tersambung ke database.
* **[DUALISME ARSITEKTUR YANG BELUM MENYATU]:**
  * Di backend database, sudah tersedia arsitektur perujuk yang matang: tabel `perujuk`, `perujuk_pencairan`, view `v_komisi_rujukan`, pembekuan tarif komisi di `admissions` (`0020_bekukan_tarif_rujukan.sql`), dan RPC `portal_perujuk(p_token)` di migrasi `0030_merek_ava_pada_pesan_portal.sql`.
  * Selain itu, terdapat halaman mandiri `portal_perujuk.html` yang menggunakan autentikasi berbasis tautan bertoken (`?t=TOKEN`).
  * Di dalam `apps/index.html` bahkan tercantum teks peringatan (baris 1692):
    *"Angka rujukan dan komisi Anda yang sebenarnya ada di Portal Perujuk — halaman bertoken yang dikirimkan AVA kepada Anda. Ringkasan di layar ini belum tersambung ke data..."*
  * Artinya, modul referral di `apps.avahealth.sbs` saat ini berstatus **abandoned/setengah jalan** dan belum terhubung ke mesin transaksi yang sebenarnya.

---

## 3. Matriks Kepatuhan, Keamanan & Batasan (Deny Rules)

Mengacu pada aturan jangka panjang di **`AGENTS.md`**:

| Kriteria / Aturan | Status Audit pada `apps.avahealth.sbs` | Catatan Evaluasi |
| :--- | :---: | :--- |
| **Multi-tenant sejak awal (§1 & §4.4)** | ⚠️ Sebagian Patuh | Corporate sudah memakai gatekeeper RPC, namun fallback `allCorporatesForPicker[0]` dan hardcoded `CORP-AVA-01` melanggar isolasi multi-tenant. |
| **Keamanan Data Pasien & UU PDP (§4.2)** | ❌ Pelanggaran Kritis | 1. Query rekam medis berdasarkan string nama pasien.<br>2. Auto-injection data lab & rontgen dummy ke live DB.<br>3. Registrasi mandiri tidak mengenkripsi atau menyimpan identitas secara aman. |
| **Kepatuhan Mutu ISO 15189:2022 (§4.2)** | ❌ Belum Memenuhi | Alur flebotomi nakes lapangan belum mencatat rantai dingin (*cold-chain*), waktu pengambilan spesimen, dan nomor tabung primer (*traceability*). |
| **Konektivitas Dokter Perujuk (§4.2 & §4.3)** | ❌ Terputus | Hak akses dokter rujukan belum terhubung ke skema bagi hasil/komisi resmi di database LIS. |
| **Konsistensi Branding & Netralitas IP (§4.1)** | ⚠️ Perlu Pembersihan | Terdapat istilah bawaan template luar seperti *"Virtu Style Lab Test Items"* di `app.js` yang perlu dibersihkan menjadi terminologi resmi AVA Health Platform. |

---

## 4. Rekomendasi Rencana Perbaikan (Action Plan)

### Prioritas 1: Perbaikan Showstopper & Bug Login (Wajib Segera)
1. **Tambahkan Selector Role "Referral" di `apps/index.html`:**
   * Ubah grid role selector dari 4 opsi menjadi 5 opsi (atau atur tab navigasi: Pasien, Member VIP, Corporate, Nakes, Mitra Perujuk).
   * Sambungkan event `onchange="updateLoginFormUI('referral')"`.
2. **Perbaiki Hash Router `#rujukan` di `apps/app.js`:**
   * Ganti `currentRole = 'corporate'` menjadi `currentRole = 'referral'`.
   * Ganti target tampilan dari `referral-wallet-view` (tidak ada) menjadi `referral-view` (elemen aktual).
3. **Perbaiki Akun Demo Corporate:**
   * Sesuaikan `verifikasiKorporat` di `app.js` agar memberikan bypass ramah pengujian (*testing bypass*) ketika mendeteksi kredensial demo lokal tanpa merusak verifikasi ketat JWT Supabase saat di lingkungan produksi.

### Prioritas 2: Integritas Data Medis & Penghentian Fake Seeding (Kepatuhan UU PDP & ISO 15189)
1. **Hentikan Auto-Seeding Fake Lab Results ke Live DB:**
   * Hapus blok `sbPost` otomatis di `loadPatientEHR`. Jika data lab pasien kosong, tampilkan pesan informatif (*empty state UI*), bukan memasukkan data lab palsu ke database.
2. **Ubah Query Rekam Medis ke ID Unik:**
   * Gunakan `user_id` atau `mr_number` unik pada query tabel `lab_results`, `radiology_orders`, dan `prescriptions`, bukan string `patient_name`.
3. **Aktifkan Registrasi Mandiri Nyata:**
   * Hubungkan form registrasi dengan RPC registrasi pasien di Supabase (`pendaftaran_pasien_baru`), hasilkan nomor RM resmi berurutan, dan kirimkan konfirmasi WhatsApp/Email.

### Prioritas 3: Standardisasi Pra-Analitik Nakes & Integrasi Portal Perujuk
1. **Lengkapi Form Selesai Sampling Nakes:**
   * Tambahkan modal pop-up saat nakes menekan "Selesai Sampling": input nomor barcode tabung darah, jam flebotomi, dan konfirmasi suhu boks transport.
2. **Integrasikan Modul Referral dengan Skema Komisi Database:**
   * Hubungkan daftar rujukan dan saldo komisi di `referral-view` ke view PostgreSQL `v_komisi_rujukan` dan tabel `perujuk_pencairan`, sehingga dokter/faskes perujuk dapat memantau akumulasi komisi riil dan mengajukan pencairan dana secara otomatis.
