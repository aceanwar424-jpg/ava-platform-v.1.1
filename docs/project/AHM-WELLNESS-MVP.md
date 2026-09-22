# Project AHM — Cardiometabolic Wellness MVP

**Status:** qualified prospect / project planning

**OWNED_BY:** ava

**Data:** dokumen ini tidak memuat PII, data karyawan, data klinis, PIC, kontrak, atau kredensial.

## 1. Tujuan program

Menyediakan satu alur pengelolaan program diabetes dan hipertensi yang menghubungkan pemeriksaan AHM In-House Clinic (IHC), pemantauan mandiri peserta, tindak lanjut tim medis, serta laporan agregat untuk HR. IHC tetap mengelola pemeriksaan dan keputusan klinis. AVA mengelola platform, orkestrasi data, task, dan laporan sesuai perjanjian pemrosesan data.

## 2. Penilaian kondisi sistem saat ini

| Kebutuhan | Kondisi saat ini | Keputusan MVP |
|---|---|---|
| Registrasi perusahaan | Tabel `corporates`, kontrak, kode korporat, dan verifikasi akun sudah tersedia | Gunakan setelah pilot/kontrak disetujui |
| Roster peserta | Corporate Portal sudah memiliki CRUD, impor CSV, dan pemisahan berdasarkan `corporate_id` | Gunakan untuk enrollment awal; tambah consent dan status program pada model baru |
| Registrasi pemeriksaan IHC | HIS sudah memiliki admissions, corporate scheme, encounter, vital sign, dan hasil laboratorium | Jadikan HIS sebagai clinical system of record IHC |
| Hasil pemeriksaan | Corporate Portal dapat menarik admissions dan lab results | Ganti layar HR menjadi agregat; akses hasil individual hanya untuk role medical/IHC |
| Input kontrol mandiri | Tabel legacy `ava_device_readings` hanya memakai nilai teks generik dan belum membawa program, corporate, waktu ukur, metode, status validasi, atau provenance memadai | Jangan gunakan langsung untuk produksi; bangun observation intake tervalidasi |
| Wellness personal | Helper wearable/hidrasi masih berupa placeholder dan tidak menyimpan pengukuran klinis | Tambahkan menu `Program Saya` khusus peserta terdaftar |
| Laporan kronis | Dashboard saat ini berorientasi MCU, booking, hasil, dan billing | Tambahkan report snapshot harian, mingguan, dan bulanan |
| Alert dan follow-up | Belum ada antrean cardiometabolic case management | Tambahkan task queue untuk IHC; HR tidak menerima clinical alert individual |
| Customer/CRM | Pipeline Lead → Partner → Deal → Project → Corporate sudah tersedia | AHM dicatat sebagai qualified prospect hingga tahap komersial berubah |

## 3. Batas sistem

### Apps Personal — peserta

- Aktivasi program dan persetujuan pemrosesan data.
- Melihat jadwal, hasil yang sudah dirilis, care plan, dan tindak lanjut.
- Input tekanan darah: sistolik, diastolik, denyut, posisi, waktu, alat, dan catatan.
- Input gula darah: nilai, unit, tipe pengukuran (puasa/sewaktu/post-prandial), waktu, alat, dan catatan.
- Riwayat tren personal serta penanda bahwa data berasal dari IHC, lab, perangkat, atau input mandiri.
- Pengingat pengukuran dan appointment tanpa mengubah terapi.
- Pesan keselamatan yang mengarahkan peserta menghubungi IHC/darurat sesuai protokol yang disetujui medical governance.

### HIS — AHM IHC

- Registrasi peserta berdasarkan corporate roster.
- Encounter dan pemeriksaan klinis.
- Vital sign dan order/hasil laboratorium.
- Validasi hasil yang berasal dari bulk upload atau integrasi.
- Case list diabetes/hipertensi, follow-up overdue, task, care plan, dan catatan klinis.
- Koreksi data melalui amendment yang berjejak; nilai lama tidak ditimpa tanpa audit.

### Corporate Medical Dashboard

- Akses individual berbasis penugasan untuk dokter/perawat/case manager IHC.
- Daftar peserta yang membutuhkan review, data belum lengkap, dan follow-up jatuh tempo.
- Ringkasan per program, lokasi IHC, divisi, dan periode.

### HR Dashboard

- Enrollment, activation, participation, measurement adherence, dan utilization.
- Distribusi cohort dan tren agregat.
- Laporan bulanan tanpa diagnosis, hasil mentah, obat, atau identitas individual.
- Small-cell suppression untuk kelompok dengan jumlah kecil agar individu tidak mudah dikenali.

### AVA Tech

- Konfigurasi tenant, program, field mapping, unit, source, dan jadwal laporan.
- Monitoring bulk import/API, antrean gagal, retry, audit, serta SLA integrasi.
- API dan SFTP menjadi tahap produksi; CSV tervalidasi digunakan untuk pilot.

## 4. Alur data MVP

1. AHM mengirim roster minimum yang sudah disepakati melalui Corporate Portal atau jalur aman.
2. Peserta diundang, membaca pemberitahuan privasi, memberikan persetujuan yang diperlukan, lalu enrollment diaktifkan.
3. IHC mencatat encounter dan pemeriksaan di HIS atau mengirim batch hasil tervalidasi.
4. Observation intake melakukan pemeriksaan identitas, tipe pengukuran, unit, waktu, duplikasi, sumber, dan kelengkapan.
5. Hasil IHC yang sudah dirilis tampil pada peserta dan masuk ke longitudinal timeline.
6. Peserta dapat menambahkan pengukuran rumah. Data selalu diberi label `self_reported` dan tidak otomatis dianggap hasil klinis tervalidasi.
7. Rule yang telah disetujui medical governance membuat task untuk IHC. Rule tidak mengirim diagnosis atau clinical alert individual kepada HR.
8. Report service membentuk snapshot harian, mingguan, dan bulanan dari data yang sudah diotorisasi.

## 5. Laporan

### Harian — IHC dan AVA Operations

- Enrollment baru, data masuk, batch gagal, duplikasi, unit tidak dikenal, dan data yang menunggu validasi.
- Peserta dengan follow-up jatuh tempo dan task klinis terbuka.
- Aktivitas input mandiri dan pengukuran yang memerlukan review berdasarkan protokol.

### Mingguan — Corporate Medical

- Cakupan pengukuran, kelengkapan data, engagement, dan penyelesaian follow-up.
- Perubahan distribusi cohort diabetes/hipertensi.
- Kinerja per IHC/site tanpa membuka data di luar kewenangan medical team.

### Bulanan — HR/Management

- Jumlah eligible, enrolled, activated, active monitoring, dan drop-off.
- Cakupan screening serta adherence pengukuran.
- Tren agregat program dan utilization IHC.
- Data quality, SLA laporan, dan rekomendasi operasional periode berikutnya.

## 6. Model data yang dibutuhkan setelah checkpoint skema

| Entitas | Fungsi |
|---|---|
| `wellness_programs` | Definisi program, corporate, periode, status, protokol, dan reporting cadence |
| `wellness_enrollments` | Hubungan participant–program, consent, status, source, dan tanggal aktivasi |
| `wellness_observations` | Tekanan darah, gula darah, HbA1c, berat/BMI dan data relevan dengan unit serta provenance |
| `wellness_care_plans` | Tujuan, aktivitas, penanggung jawab, periode, dan status plan |
| `wellness_tasks` | Review, follow-up, escalation, due date, assignment, dan resolution |
| `wellness_import_batches` | File/API source, checksum, jumlah baris, error, retry, dan idempotency |
| `wellness_report_snapshots` | Snapshot agregat per periode dan audience untuk hasil yang dapat diaudit |

Setiap tabel wajib membawa `tenant_id`, `corporate_id` bila relevan, audit timestamp, serta kebijakan RLS. Observation harus menyimpan `subject_id`, `measured_at`, `received_at`, `code`, `value`, `unit`, `source`, `verification_status`, `device/method`, dan referensi encounter bila berasal dari IHC.

## 7. Role minimum

| Role | Akses |
|---|---|
| Participant | Data diri dan input diri |
| IHC Clinician | Data klinis peserta yang ditugaskan, validasi, care plan, task |
| IHC Case Manager | Worklist dan follow-up sesuai scope; tidak otomatis memiliki seluruh hak dokter |
| Corporate Medical Lead | Cohort medical dan laporan operasional teridentifikasi sesuai kewenangan |
| HR Program Admin | Enrollment administratif dan laporan agregat |
| HR Executive | Dashboard agregat dan laporan bulanan |
| AVA Support | Metadata operasional dan error integrasi; akses klinis terbatas serta diaudit |

## 8. Scope pilot yang disarankan

- Satu corporate tenant dan satu IHC.
- Cohort terbatas diabetes dan hipertensi.
- Roster import, enrollment, consent, IHC batch upload, input mandiri, timeline, task, dan tiga jenis laporan.
- Belum mencakup device integration langsung, prescription management, medication change, atau klaim klinis otomatis.
- Seluruh threshold, escalation, dan pesan keselamatan ditandatangani medical governance AHM/IHC sebelum UAT.

## 9. Backlog implementasi bertahap

1. Konfirmasi data controller/processor, audience laporan, retention, consent, dan role matrix.
2. Setujui data dictionary tekanan darah dan glukosa beserta unit serta source.
3. Buat migrasi formal, RLS, audit, rollback, dan uji tenant isolation.
4. Tambahkan konfigurasi program AHM tanpa string klien di kode inti.
5. Bangun IHC import preflight, error queue, idempotency, dan amendment.
6. Bangun Apps Personal `Program Saya` dan input mandiri.
7. Bangun IHC case list serta Corporate Medical Dashboard.
8. Bangun HR aggregate dashboard dan report scheduler.
9. Jalankan UAT data sintetis, DPIA, security review, dan pilot terbatas.

## 10. Gate sebelum implementasi database

Perubahan berikut menunggu persetujuan eksplisit: penambahan skema master wellness, penerapan migrasi ke Supabase, koneksi ke sistem IHC/HRIS AHM, pemasukan roster nyata, dan pembukaan akses laporan kepada pengguna AHM.
