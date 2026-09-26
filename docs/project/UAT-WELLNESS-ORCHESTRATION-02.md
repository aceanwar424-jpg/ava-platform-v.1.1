# UAT-02 — Orkestrasi Wellness dari HIS

OWNED_BY: generic. Versi 1.0 / 2026-09-25. Seluruh pengujian memakai data sintetis.

## Keputusan pemilik dan batas peran

Arahan pemilik pada 25 September 2026: HR dapat melihat hasil dan mengevaluasi karyawan perusahaannya, serta meminta treatment. Admin pengelola dapat membuat request dan mengelola seluruh pelaksanaan melalui HIS. APPS menjadi portal perusahaan/peserta serta pengiriman hasil IHC. IHC bukan admin sistem.

| Peran | Jalur | Hak |
|---|---|---|
| Admin pengelola | HIS → Program Kesehatan Korporat → Orkestrasi Wellness | Konfigurasi, roster, request, penerimaan, penjadwalan, pelaksana, laporan, penutupan, akses pemasok |
| HR `corporate` | APPS → Monitoring Wellness | Daftar peserta perusahaan sendiri, hasil terbaru, riwayat, request, evaluasi laporan sesi, ekspor |
| Peserta | APPS → Program Wellness Saya | Notice, input mandiri, jadwal dan laporan treatment sendiri, riwayat, penarikan persetujuan |
| Pemasok `ihc` | APPS → Impor Hasil IHC | Program yang ditugaskan, upload CSV dan status batch sendiri; tidak dapat membaca riwayat/treatment atau mengelola program |

## Implikasi IP & Kepatuhan

UI dan RPC generik tidak memakai data atau ID perusahaan nyata. Notice `wellness-privacy-v2` menjelaskan bahwa HR berwenang melihat data individual dan laporan sesi. Persetujuan v1 tidak otomatis ditulis ulang; peserta dengan persetujuan lama diminta membaca dan menyetujui notice terbaru. Roster tetap tampil, tetapi hasil dan request ditahan sampai dasar pemrosesan aktif. Status `not_required` yang sudah ditetapkan pengelola tetap dihormati; rilis ini tidak menetapkan dasar tersebut secara otomatis.

Level merupakan label operasional, bukan diagnosis. Ambang tekanan darah dan gula puasa yang sudah ada dipertahankan; gula nonpuasa ditandai perlu tinjauan, tidak diterapkan diam-diam ke ambang puasa. Sumber, waktu dan status verifikasi ditampilkan. Aturan bernama `operational-v1`; perubahan aturan klinis berikutnya harus ditinjau pengelola medis.

## Skenario penerimaan

1. **Konfigurasi HIS:** admin membuka menu Orkestrasi Wellness, membuat/mengedit program, mengimpor roster dengan Employee ID tetap, lalu sinkronisasi akun. Impor ulang tidak menciptakan peserta tambahan dan menghitung baris tersimpan secara benar.
2. **Notice:** peserta melihat notice v2 dan checkbox tidak tercentang. Persetujuan eksplisit mengaktifkan pencatatan. HR melihat peserta pending namun belum menerima nilainya.
3. **Level terbaru:** catat tensi sintetis 170/105 lalu 115/75 dengan waktu lebih baru. Daftar HR berubah mengikuti 115/75, request menyimpan tier yang sama, dan kedua hasil tetap ada dalam riwayat.
4. **Tampilan:** daftar langsung termuat, pencarian nama/ID dan filter level bekerja. Peserta tanpa hasil tidak diberi label normal. Gula nonpuasa menampilkan penanda tinjauan.
5. **Request HR:** pilih peserta aktif, jenis treatment, nama, usulan jadwal dan catatan. Setelah terkirim, request berstatus Diminta pada HIS. Replay request yang sama tidak menambah baris.
6. **Request admin:** admin dapat membuat request dari HIS untuk peserta dalam tenantnya.
7. **Pelaksanaan:** admin menerima request, membuat sesi bernomor, menetapkan jadwal dan admin pelaksana. Usulan jadwal HR dibedakan dari jadwal sesi yang ditetapkan admin.
8. **Perubahan sesi:** admin mengubah jadwal atau membatalkan sesi dengan alasan; audit tersimpan. Nomor sesi tidak boleh dipakai untuk menimpa jadwal lama.
9. **Tidak hadir:** isi kehadiran Tidak hadir, kedisiplinan Belum dapat dinilai, laporan dan tindak lanjut. Sistem menolak kombinasi Tidak hadir + Mengikuti arahan.
10. **Sesi pengganti:** buat sesi berikutnya, catat Hadir/Terlambat dan evaluasi mengikuti arahan/Sebagian/Tidak mengikuti beserta laporan. Laporan tersimpan tidak dapat ditimpa oleh pengiriman ulang.
11. **Penutupan:** sistem menolak penyelesaian sebelum ada laporan atau saat masih ada sesi terjadwal. Setelah seluruh sesi ditangani, admin menyimpan kesimpulan. Treatment yang sudah ditutup tidak menerima mutasi pelaksanaan.
12. **Evaluasi:** HR dan peserta membaca jadwal, kehadiran, kedisiplinan, laporan, tindak lanjut serta kesimpulan. HR mengunduh CSV laporan sesi.
13. **IHC:** admin memberikan akses program kepada akun berperan `ihc`. Akun tersebut dapat mengimpor hasil sintetis tetapi tidak bisa meminta treatment atau membaca riwayat. Akses impor berhenti setelah dicabut.
14. **Penarikan:** peserta menarik persetujuan; treatment/sesi aktif dan reminder dibatalkan. HR tidak menerima hasil lagi, request baru ditolak, peserta tetap dapat membaca riwayat sendiri.
15. **Isolasi:** HR perusahaan lain, admin tenant lain, pasien lain, dan IHC tidak dapat membaca/mengubah program atau peserta di luar kewenangannya, termasuk lewat RPC langsung.

## Bukti otomatis

- `node scripts/verify-wellness-orchestration.cjs`: PGlite, migrasi 0058–0064 diulang dua kali, siklus lengkap dan skenario negatif.
- `node scripts/qa-wellness-orchestration.cjs`: browser Edge headless terhubung ke RPC lokal berbasis PGlite, bukan respons mock statis. Set `PLAYWRIGHT_MODULE` ke lokasi paket Playwright bila tidak terpasang secara lokal.
- `docs/audit-evidence/wellness/browser-qa.json` serta screenshot HR desktop/mobile, HIS selesai, laporan peserta dan upload IHC.
- Pengujian ini bukan bukti deployment produksi. Sign-off produksi dilakukan setelah migrasi dan aset dirilis ke lingkungan yang benar.
