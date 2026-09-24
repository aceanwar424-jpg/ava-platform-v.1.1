# UAT-01 — Alur End-to-End Wellness AHM

**Tujuan:** membuktikan satu alur realistis dari setup program sampai laporan HR tanpa memakai data karyawan atau hasil kesehatan nyata.

**OWNED_BY:** ava  
**Data:** seluruh fixture sintetis. Ganti placeholder email hanya pada salinan kerja lokal.

## 1. Hasil akhir yang harus terbukti

UAT dinyatakan lulus apabila:

1. Satu peserta dapat masuk ke Apps dan melihat Program Wellness AHM.
2. Form input dan impor klinis terkunci sebelum peserta memberi persetujuan eksplisit.
3. Persetujuan versi `wellness-privacy-v1` tercatat pada audit trail.
4. Peserta dapat menyimpan tekanan darah dan gula darah mandiri.
5. Hasil mandiri berlabel `self_reported / unverified`.
6. IHC dapat mengimpor hasil valid dan peserta melihatnya sebagai `ihc_bulk / verified`.
7. File invalid tertahan sebelum upload.
8. File valid yang diunggah ulang tidak membuat duplikasi.
9. HR hanya melihat agregat dan tidak melihat nama atau nilai individual.
10. Dengan satu peserta, nilai rata-rata HR disembunyikan karena small-cell threshold lima orang.
11. Admin dapat membuat reminder dan task peserta yang sudah menyetujui program.

## 2. Aktor dan akun uji

Gunakan akun terpisah agar role dan sesi tidak tercampur.

| Aktor | Role aplikasi | Fungsi UAT |
|---|---|---|
| AVA Admin | Super Admin/Pengelola | Setup program, sinkronisasi roster, reminder |
| Operator IHC | Pengelola | Impor hasil pemeriksaan |
| Peserta UAT | Personal/Pasien | Input mandiri dan melihat timeline |
| HRD UAT | Perusahaan | Melihat monitoring agregat |

Prasyarat akun:

- Akun peserta memakai email aktif yang dapat menerima aktivasi/login.
- Email akun peserta harus sama persis dengan email pada roster.
- Profil peserta memiliki role `patient` atau role personal yang setara.
- Profil HRD memiliki role `corporate` dan terhubung ke corporate AHM.
- Untuk UAT saat ini, operator IHC memakai akses Pengelola karena menu impor berada di workspace tersebut.

Jika akun belum ada, petugas berwenang membuatnya melalui proses provisioning Auth yang berlaku, lalu menautkan `user_profiles`. Jangan menaruh password pada fixture, tiket, atau screenshot.

## 3. Konfigurasi awal program

Masuk sebagai AVA Admin ke `https://apps.avahealth.sbs/`.

1. Pilih akses **Pengelola**.
2. Buka **Program Wellness → Rancang Program Wellness**.
3. Pastikan corporate **AHM - Project Wellness** tersedia.
4. Pastikan program berikut tersedia:

   | Field | Nilai UAT |
   |---|---|
   | Kode | `AHM-DM-HT-2026` |
   | Nama | Program Wellness Diabetes & Hipertensi |
   | Status | Pilot |
   | Tekanan darah | Harian |
   | Gula darah | Sesuai care plan |
   | Visibilitas HR | Agregat saja |
   | Small-cell threshold | 5 peserta |

5. Ubah status dari **Draft** menjadi **Pilot** hanya untuk periode UAT.
6. Catat waktu perubahan sebagai bukti UAT.

**Lulus:** program tampil pada daftar program aktif/pilot dan corporate benar.  
**Gagal:** corporate tidak muncul, program berada pada tenant lain, atau penyimpanan menghasilkan error.

## 4. Memasukkan satu peserta sintetis

Fixture: `docs/project/uat/ahm-wellness-01/roster-uat-01.csv`.

1. Salin file tersebut ke folder kerja sementara.
2. Ganti `GANTI_DENGAN_EMAIL_UJI_AKTIF` dengan email akun peserta UAT.
3. Masuk sebagai Corporate Admin atau admin yang berwenang mengelola roster.
4. Buka **Pemeriksaan Karyawan → Master/Daftar Karyawan**.
5. Pilih **Impor Karyawan (CSV)**.
6. Unggah roster dan pastikan muncul:

   - Employee ID: `AHM-UAT-001`
   - Nama: `Peserta UAT 001`
   - Departemen: `UAT Wellness`

7. Kembali sebagai Pengelola.
8. Pada program `AHM-DM-HT-2026`, tekan **Sinkronkan Roster**.
9. Pastikan jumlah akun tertaut bertambah satu.

**Lulus:** enrollment aktif terbentuk dan akun peserta tertaut berdasarkan email.  
**Gagal:** peserta tidak ditemukan, email tidak tertaut, atau peserta masuk ke corporate/program yang salah.

## 5. Persetujuan peserta

Gunakan browser/profile terpisah.

1. Masuk ke `https://apps.avahealth.sbs/` menggunakan akun peserta.
2. Pilih akses **Personal**.
3. Buka **Program Wellness Saya**.
4. Pastikan program AHM terlihat.
5. Pastikan form tekanan darah dan gula darah belum terbuka.
6. Baca penjelasan penggunaan data, label verifikasi, visibilitas HR, dan batasan medis.
7. Centang pernyataan persetujuan.
8. Tekan **Setujui dan aktifkan pencatatan**.
9. Muat ulang halaman dan pastikan form pencatatan tetap aktif.

**Lulus:** persetujuan tersimpan, form baru terbuka setelah persetujuan, dan audit event `GRANT_CONSENT` mencatat versi `wellness-privacy-v1`.  
**Gagal:** form terbuka sebelum persetujuan, klik tanpa mencentang dapat diproses, atau status kembali pending setelah halaman dimuat ulang.

## 6. Pengujian input mandiri peserta

1. Masukkan tekanan darah mandiri:

   | Field | Nilai |
   |---|---|
   | Sistolik | 136 |
   | Diastolik | 86 |
   | Denyut | 74 |
   | Kondisi | Istirahat |
   | Alat | Tensimeter UAT |
   | Catatan | Pengukuran mandiri UAT-01 |

2. Masukkan gula darah mandiri:

   | Field | Nilai |
   |---|---|
   | Nilai | 118 mg/dL |
   | Konteks | Puasa |
   | Alat | Glukometer UAT |
   | Catatan | Pengukuran mandiri UAT-01 |

3. Pastikan timeline menampilkan dua sesi tersebut.

**Lulus:** tekanan darah menghasilkan sistolik, diastolik, dan denyut; gula darah tersimpan; semuanya berlabel mandiri dan belum diverifikasi.  
**Gagal:** peserta dapat melihat data orang lain, hasil mandiri berlabel terverifikasi, atau data hilang setelah halaman dimuat ulang.

## 7. Pengujian impor hasil IHC valid

Fixture: `docs/project/uat/ahm-wellness-01/ihc-valid-uat-01.csv`.

1. Masuk sebagai Operator IHC/Pengelola.
2. Buka **Program Wellness → Impor Hasil IHC**.
3. Pilih program `AHM-DM-HT-2026`.
4. Unggah file valid.
5. Pastikan preflight menampilkan:

   - Total baris: 1
   - Lolos preflight: 1
   - Perlu diperbaiki: 0

6. Tekan **Impor Hasil Tervalidasi**.
7. Pastikan batch menunjukkan satu baris diterima dan nol ditolak.
8. Masuk kembali sebagai peserta.
9. Pastikan timeline menampilkan hasil IHC dengan tekanan darah, denyut, gula darah, dan HbA1c.

**Lulus:** sumber `IHC`, status `Terverifikasi`, waktu ukur sesuai file, dan tidak mengubah hasil mandiri.  
**Gagal:** hasil masuk ke peserta lain, label sumber salah, atau hasil mandiri tertimpa.

## 8. Pengujian file invalid dan identitas tidak dikenal

Fixture: `docs/project/uat/ahm-wellness-01/ihc-invalid-uat-01.csv`.

1. Pilih file invalid pada halaman impor.
2. Pastikan preflight menyatakan sistolik/diastolik harus berpasangan.
3. Pastikan tombol impor tidak aktif.

**Lulus:** data tidak dikirim ke server dan tidak muncul pada timeline.  
**Gagal:** file invalid dapat diimpor.

Lanjutkan dengan dua variasi berikut:

| Fixture | Hasil yang diharapkan |
|---|---|
| `ihc-out-of-range-uat-01.csv` | Preflight menolak sistolik dan glukosa di luar batas; tombol impor tetap nonaktif. |
| `ihc-unknown-employee-uat-01.csv` | Preflight format lulus, server menolak baris karena Employee ID tidak ada pada roster program; batch berstatus gagal dengan satu error dan tanpa observation baru. |

## 9. Pengujian duplikasi

1. Unggah kembali file `ihc-valid-uat-01.csv` tanpa mengubah isinya.
2. Jalankan impor.
3. Pastikan sistem memberi informasi bahwa batch sudah pernah diproses.
4. Periksa timeline peserta; jumlah hasil IHC tidak bertambah.

**Lulus:** checksum batch mencegah duplikasi.  
**Gagal:** hasil pemeriksaan muncul dua kali.

## 10. Pengujian sebagai HRD

Gunakan browser/profile terpisah.

1. Masuk sebagai akun HRD.
2. Pilih akses **Perusahaan**.
3. Buka **Program Wellness → Monitoring Wellness**.
4. Pastikan program AHM tampil.
5. Verifikasi metrik:

   - Enrollment: 1.
   - Akun tertaut: 1.
   - Aktivitas 7 hari: 1 jika seluruh pengujian dilakukan pada periode aktif.
   - Cakupan tekanan darah: 1.
   - Cakupan gula darah: 1.
   - Rata-rata sistolik, diastolik, dan gula darah: disembunyikan.

6. Cari nama `Peserta UAT 001` dan Employee ID `AHM-UAT-001` pada halaman.

**Lulus:** nama, Employee ID, catatan, dan nilai individual tidak tersedia; statistik rata-rata disembunyikan karena cohort kurang dari lima.  
**Gagal:** HR dapat melihat hasil klinis individual atau sistem menampilkan rata-rata satu peserta.

## 11. Pengujian reminder dan CRM

Untuk membuktikan task pada hari yang sama, jalankan bagian ini setelah persetujuan pada bagian 5 dan sebelum peserta mencatat hasil pada bagian 6. Bila dijalankan setelah peserta baru saja mengisi data, hasil yang benar adalah nol task karena syarat tidak aktif belum terpenuhi.

1. Masuk sebagai Pengelola.
2. Buka **Rancang Program Wellness**.
3. Buat rule:

   | Field | Nilai |
   |---|---|
   | Nama | Reminder UAT kontrol harian |
   | Target | Semua pengukuran |
   | Tidak aktif | 1 hari |
   | Jam | 08:00 |
   | Kanal | Notifikasi Apps |
   | Pesan | Saatnya mencatat pemantauan harian sesuai program Anda. |

4. Simpan rule.
5. Tekan **Buat Task Reminder**.
6. Pada akun peserta, pastikan task/reminder tampil apabila syarat tidak aktif terpenuhi.

Pastikan peserta yang consent-nya masih `pending` tidak menerima task walaupun tidak memiliki hasil pengukuran.

Pengujian email atau WhatsApp dilakukan terpisah setelah connector disetujui dan aktif.

## 12. Perluasan opsional menjadi lima peserta

Satu peserta sengaja membuktikan perlindungan small-cell. Untuk menguji statistik agregat:

1. Buat lima peserta sintetis dengan Employee ID unik.
2. Sinkronkan roster.
3. Impor minimal satu tekanan darah atau gula darah per peserta dalam 30 hari.
4. Pastikan HR baru melihat nilai rata-rata ketika jumlah peserta terukur mencapai lima.
5. Pastikan nilai individual tetap tidak tersedia.

## 13. Bukti yang dikumpulkan

Simpan bukti tanpa password dan tanpa data orang nyata:

- Screenshot program dan status Pilot.
- Screenshot enrollment/akun tertaut.
- Screenshot gate persetujuan sebelum dan sesudah disetujui.
- Screenshot timeline peserta untuk hasil mandiri dan IHC.
- Screenshot preflight valid dan invalid.
- Screenshot pesan duplikasi.
- Screenshot dashboard HR dengan small-cell suppression.
- Screenshot rule reminder dan task.
- Nama file, checksum batch, tanggal, tester, hasil lulus/gagal, dan catatan defect.

Setelah UAT selesai, nonaktifkan peserta sintetis dan kembalikan status program sesuai keputusan operasional. Jangan menghapus audit trail atau menimpa hasil; gunakan mekanisme status/amendment yang berlaku.

## 14. Matriks skenario UAT

| Skenario | Input/kondisi | Hasil wajib |
|---|---|---|
| Happy path personal | Consent granted, BP dan glukosa valid | Tersimpan sebagai `self_reported / unverified`. |
| Belum consent | Consent pending | Form terkunci dan server menolak observation. |
| Happy path IHC | Employee ID valid, hasil valid | Batch selesai; hasil `ihc_bulk / verified`. |
| Struktur CSV invalid | Diastolik kosong | Preflight menahan upload. |
| Nilai di luar batas | Sistolik 390, glukosa 780 | Preflight menahan upload. |
| Identitas asing | Employee ID tidak ada | Server menolak baris dan mencatat error batch. |
| Batch sama | Checksum file sama | Ditandai duplikat tanpa observation tambahan. |
| Cohort kecil | Peserta terukur kurang dari 5 | HR melihat cakupan, tetapi rata-rata disembunyikan. |
| Cohort memadai | Minimal 5 peserta sintetis terukur | HR melihat rata-rata agregat tanpa data individu. |
| Reminder setelah aktivitas | Pengukuran masih dalam jendela aktif | Tidak membuat task baru. |
| Reminder saat tidak aktif | Consent granted dan melewati inactivity days | Membuat satu task; pemanggilan ulang tidak menggandakan task hari yang sama. |
