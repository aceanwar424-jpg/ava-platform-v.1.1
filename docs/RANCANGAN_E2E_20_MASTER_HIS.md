# Rancangan End-to-End — 20 Master Baru HIS AVA

**Status:** rancangan sebelum implementasi. Dokumen ini tidak membuat tabel atau mengubah data.

## 1. Keputusan arsitektur

1. Semua master baru multi-tenant: setiap tabel membawa `tenant_id`; batas unik minimal adalah `(tenant_id, kode)`.
2. Setiap record memiliki jejak aktor dan waktu, `is_active`, alasan nonaktif, serta riwayat versi/effective date untuk aturan yang berdampak pada transaksi.
3. Penghapusan fisik dilarang apabila record sudah dipakai. Data diarsipkan/nonaktif dan transaksi lama memakai snapshot saat transaksi dibuat.
4. Browser hanya memanggil API/RPC terautentikasi. Secret vendor hanya berada di Edge Function/server.
5. Semua layar mengikuti pola daftar berfilter → detail → tambah/edit → validasi → review dampak → simpan → jejak audit.
6. Pemisahan data mengikuti FHIR R4: organisasi/fasilitas, lokasi fisik, praktisi, peran praktisi, dan perangkat adalah entitas berbeda. Ini selaras dengan [Organization](https://hl7.org/fhir/R4/organization.html), [Location](https://hl7.org/fhir/R4/location.html), [Practitioner](https://www.hl7.org/fhir/R4/practitioner.html), dan [Device](https://hl7.org/fhir/R4/device-definitions.html).

## 2. Pemisahan configuration dan operasional

| Configuration / master | Operasional yang memakai master |
| --- | --- |
| Cabang, unit, ruang, kelas, alat | Pendaftaran, jadwal, bed, order, radiologi, home care |
| Praktisi, spesialisasi, jasa, jadwal dasar | Booking, EMR, pemeriksaan, approval |
| Penjamin, kondisi, alergi, ICD | Pendaftaran, anamnesis, EMR, klaim |
| Korporat, kontrak, jabatan, benefit | Registrasi korporat, MCU, invoice, portal korporat |
| Parameter MCU dan aturan obat | Pemeriksaan MCU, resep, dispensing |
| Bank, EDC, metode bayar, mapping akun | Kasir, refund, settlement, jurnal |
| Flow, loket, display, registry device | Kiosk, konsol panggilan, layar antrean |
| Promo, telemedicine, SATUSEHAT setup | Diskon admisi, booking, pengiriman FHIR |

Halaman Configuration tidak menerbitkan tiket, membuat admission, memproses pembayaran, atau mengirim data klinis. Halaman operasional hanya memakai master aktif sesuai tenant/cabang.

## 3. Kontrak platform bersama

| Aspek | Ketetapan |
| --- | --- |
| Isolasi | Semua tabel memakai RLS tenant; seluruh RPC yang memakai SECURITY DEFINER menyaring tenant secara eksplisit. |
| Kode | Kode divalidasi di server dan tidak berubah setelah dipakai transaksi. |
| Audit | Simpan before/after, aktor, alasan, sumber UI/API, serta correlation ID. |
| Lifecycle | Draft → review → active → inactive/archived. Kontrak, tarif, flow, dan device wajib maker-checker. |
| Relasi | Form hanya menawarkan record aktif pada tenant sama; server menolak foreign key lintas tenant. |
| Impor | Staging → preview → validasi → commit atomik → laporan error; tidak ada import langsung. |
| Integrasi | Outbox, retry terbatas, dead-letter/error log, status terakhir, dan retry berotorisasi. |

## 4. Rancangan 20 menu

| Menu | Entitas dan field minimum | Alur nyata | Dipakai oleh |
| --- | --- | --- | --- |
| Master Cabang / Plant | fasilitas: kode, nama, tipe, alamat, kontak, timezone, jam operasi, status | Draft oleh admin → review Operations → aktif sebagai konteks layanan | admission, jadwal, kontrak, invoice; FHIR Organization setelah UAT |
| Unit, Ruang & Kelas Layanan | unit, ruang, kelas: parent, kode, nama, kapasitas, lokasi, status | Struktur cabang → unit → ruang → aktif untuk layanan | appointment, antrean, bed, order; FHIR Location bila diperlukan |
| Peralatan & Modalitas | aset: kode, jenis, merek/model, serial, unit/ruang, status, jadwal pemeliharaan | Biomedical daftar → QA verifikasi layak → operasi alokasikan | RIS, analyzer/LIS, maintenance; FHIR Device bila relevan |
| Kelas & Kapasitas Layanan | kapasitas: layanan, kelas, kapasitas, slot, periode efektif | Operations atur kapasitas → scheduler membentuk slot | appointment, kuota antrean, paket/tarif |
| Spesialisasi Praktisi | spesialisasi: kode, nama, kategori, status | Clinical governance kelola → hubungkan ke praktisi/layanan | pencarian booking, EMR, laporan |
| Jasa Praktisi & Fee Rujukan | fee: layanan, praktisi/referrer, basis nilai, nominal/persen, periode, approval | Finance draft → approver → billing menghitung snapshot | kasir, invoice, komisi |
| Penjamin, Kondisi & Alergi Pasien | penjamin/kondisi/alergi/title/relasi: kode, nama, tipe, status | Master aktif → front office pilih → clinician memverifikasi data per pasien | admission, EMR, klaim |
| Referensi Diagnosis & Prosedur | ICD/reference: code system, kode, deskripsi, versi, efektif, aktif | Data steward impor versi → QA validasi → aktif | EMR, billing, reporting, FHIR |
| Kontrak & Benefit Korporat | kontrak/benefit/tarif: corporate, fasilitas, periode, paket, plafon, PIC, terms | Sales/legal draft → approver → aktif → admission cek eligibility dan snapshot | portal korporat, MCU batch, invoice |
| Level & Posisi Jabatan | level/posisi: corporate opsional, kode, nama, urutan, eligibility | Account manager kelola → kontrak hubungkan benefit | import karyawan, MCU eligibility |
| Parameter & Hasil MCU | parameter/hasil/rekomendasi/exposure: kode, tipe nilai, satuan, aturan klasifikasi, versi | Governance draft → dokter PJ review → aktif → hasil memakai versi terkunci | MCU, PDF report, statistik |
| Ambang Audiometri, Spirometri & Visus | threshold: modality, metode, usia/sex, range, unit, klasifikasi, periode | PJ klinis mengesahkan → engine menilai → reviewer boleh override beralasan | layanan penunjang, laporan |
| Kategori, Bentuk & Aturan Obat | kategori, bentuk, dosis/aturan, instruksi, waktu konsumsi | Apoteker kelola → formularium mengaitkan → prescriber memilih | e-prescription, dispensing, MAR |
| Bank & Terminal EDC | bank, merchant, terminal, cabang, settlement account, MDR, status | Finance buat → controller review → kasir pilih terminal aktif | kasir, settlement, jurnal; jangan simpan PAN/CVV |
| Mapping Pembayaran ke Akun | metode, channel, akun penerimaan, akun fee, pajak, periode | Controller tetapkan → preview jurnal → approve | kasir, refund, accounting |
| Deal, Voucher & Diskon | kode, target layanan/paket, tipe/nilai, periode, kuota, eligibility, status | Marketing draft → Finance review → admission hitung → redemption atomik | admission, cashier, invoice |
| Flow, Display & Outlet Antrean | flow/step/display/outlet: layanan, tahap, ruang, policy priority, periode | Operations draft → simulasi → approve → aktif | queue config/counter/ticket/log; tiket lama tidak berubah |
| Registry Kiosk & Display | device: ID, tenant, tipe, lokasi, layanan, origin, status, rate limit, heartbeat | IT register → Operations izin layanan → provisioning → health check → aktif | kiosk, display, queue-public Edge Function |
| Setup Telemedicine | provider, fasilitas, policy jadwal, endpoint, secret reference, webhook status | Admin draft → sandbox test → owner approve → adapter membentuk sesi booking | appointment, notification; adapter mencegah vendor lock-in |
| SATUSEHAT Setup & Status | connection, resource map, log, outbox: org ID, environment, secret reference, status/error | Metadata non-secret → sandbox connectivity → UAT resource sequence → production approval | FHIR Patient, Encounter, Condition, Observation |

## 5. Alur end-to-end

### 5.1 Onboarding faskes sampai menerima pasien

```text
Tenant dibuat
  → Cabang/plant aktif
  → Unit, ruang, kelas, dan alat disusun
  → Layanan + kapasitas + praktisi/jadwal aktif
  → Loket, flow, kiosk, dan display diikat ke layanan
  → Uji tiket sintetis dan panggilan loket
  → Front office boleh membuat admission
```

Kontrak antrean pada migrasi `0048_antrean_tenant_device_public.sql` menjadi fondasi: perangkat publik harus terdaftar, terikat tenant, layanan, origin, dan rate limit. Browser kiosk tidak diberi akses tulis langsung ke database.

### 5.2 Korporat dan MCU sampai invoice

```text
Korporat aktif → kontrak + benefit + tarif disetujui
  → jabatan/eligibility dan karyawan dimuat
  → booking batch MCU
  → admission mengunci snapshot benefit
  → parameter MCU versi aktif dipakai untuk pemeriksaan
  → dokter menyetujui hasil
  → invoice batch terbentuk dari layanan yang sudah disetujui
```

Kontrak, tarif, dan parameter yang pernah dipakai tidak diedit in-place. Perubahan selalu membentuk versi/periode baru.

### 5.3 Pembayaran dan promosi

```text
Metode bayar + mapping akun + terminal aktif
  → promo direview Finance
  → admission menghitung tarif/benefit/promo
  → kasir memverifikasi pembayaran
  → transaksi + redemption + jurnal diposting atomik
  → settlement direkonsiliasi tanpa data kartu sensitif
```

### 5.4 Interoperabilitas

```text
Fasilitas + praktisi diverifikasi
  → sandbox connection disiapkan di server
  → Patient → Encounter → Condition/Observation masuk outbox
  → Edge Function mengambil token dan mengirim FHIR R4
  → resource map + log outcome tercatat
  → gagal masuk retry/dead-letter, bukan dikirim ulang dari browser
```

SATUSEHAT mensyaratkan OAuth2 server-to-server dengan grant `client_credentials`, endpoint sandbox yang berbeda dari produksi, serta API secret yang terikat pada Organization ID terverifikasi. Lihat [autentikasi resmi](https://satusehat.kemkes.go.id/platform/docs/id/api-catalogue/authentication/) dan [endpoint resmi](https://satusehat.kemkes.go.id/platform/docs/id/postman-workshop/endpoint-information/).

## 6. RBAC

| Peran | Hak |
| --- | --- |
| Super Admin | Tenant, akses/RBAC, aktivasi akhir master |
| Admin Fasilitas | Cabang/unit/ruang/loket/perangkat sesuai tenant dan penugasan |
| Clinical Governance | Praktisi, spesialisasi, MCU, referensi klinis, formularium |
| Finance Controller | Bank/EDC, mapping akun, fee, kontrak tarif, review promo |
| Operations Manager | Flow antrean, kapasitas, jadwal dasar, outlet/display |
| Front Office/Kasir/Operator | Membaca master aktif dan menjalankan transaksi saja |
| Integration Admin | Metadata koneksi, sandbox test, log; tidak bisa membaca secret mentah |

Maker-checker wajib untuk kontrak/benefit, tarif/fee, mapping akun, flow antrean aktif, device publik, dan koneksi produksi.

## 7. Paket implementasi

1. **Foundation P0:** convention master, audit event, RLS tenant, reusable list/form framework.
2. **Fasilitas P0:** cabang → unit → ruang → kelas → equipment; kemudian dipakai read-only oleh appointment/admission.
3. **Antrean P0:** perluas 0048 untuk flow/device; preflight → staging → uji kiosk → loket → display.
4. **Praktisi dan pasien P1:** specialty, credential/role, payer/reference, ICD versioning.
5. **Korporat, MCU, farmasi P1:** contract version, job rules, parameter/threshold MCU, medicine reference.
6. **Finance dan promo P1:** bank/EDC, mapping akun, fee, promotion rules; uji invoice/refund/redemption.
7. **Integrasi P2:** adapter telemedicine sandbox lalu SATUSEHAT sandbox; tidak ada endpoint produksi tanpa UAT.

Setiap paket: design review → migrasi idempoten → preflight read-only → backup/rollback → fixture sintetis → RLS/RBAC test → UAT → release note.

## 8. Kriteria penerimaan

- Tenant A tidak dapat melihat atau mengubah master Tenant B.
- Menonaktifkan master yang dipakai transaksi ditolak atau menghasilkan versi baru; histori transaksi tidak berubah.
- Operator hanya melihat master aktif dan sesuai cabang/unit.
- Perubahan flow antrean tidak mengubah tiket yang sudah terbit.
- Kiosk hanya menerbitkan tiket dari perangkat/layanan terdaftar dan tidak mengandung data pasien.
- Kontrak korporat mengunci benefit/tarif pada admission dan invoice.
- Voucher tidak dapat melampaui kuota saat permintaan paralel.
- SATUSEHAT sandbox memberi status per resource, correlation ID, dan alasan gagal; secret tidak muncul di UI/log/Vercel public config.

## 9. IP, privasi, dan checkpoint

- Model data bersifat generik/multi-tenant; tidak ada harga, pasien, atau aset spesifik AVA sebagai seed produksi.
- Fixture pengujian seluruhnya sintetis. Perlindungan data mengikuti UU PDP No. 27 Tahun 2022 yang masih berlaku. [JDIHN](https://jdihn.go.id/pencarian/detail/1555017/index.html).
- Sebelum migrasi: pemilik database menyetujui model relasi, tenant target, backup, dan rollback.
- Sebelum integrasi vendor: pemilik proses menyetujui sandbox, kredensial, cakupan data, dan hasil UAT. Secret tidak pernah masuk source, UI, atau konfigurasi publik.

