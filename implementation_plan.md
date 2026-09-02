# Rencana Implementasi — Penyempurnaan HIS & Antrean Publik

## Tujuan

Membuat ruang `his.avahealth.sbs` dapat dipakai secara konsisten untuk alur HIS yang sudah ada, serta menyatukan pengambilan tiket dari `kiosk.avahealth.sbs` dengan konsol dan display `antrian.avahealth.sbs` melalui kontrak antrean yang sama.

## Batasan

- Tidak mengubah data produksi atau melakukan deploy tanpa langkah rilis eksplisit.
- Tidak mengaktifkan SATUSEHAT, payment gateway, atau integrasi eksternal lain.
- Endpoint publik kiosk hanya boleh menerbitkan tiket tanpa identitas pasien dan hanya untuk layanan yang diizinkan; kontrol petugas tetap terautentikasi.

## Work items

- [x] Petakan menu HIS, rute, renderer, dan modul termuat.
- [x] Perbaiki wiring atau kegagalan UI yang ditemukan dalam ruang HIS.
- [x] Jalankan audit menu serta suite HIS yang relevan.
- [x] Catat bukti hasil dan batas verifikasi.
- [x] Perbaiki kepadatan dan ketahanan layout sidebar HIS.
- [x] Audit final: menu, router, renderer, tombol, manifest, dan aksesibilitas UI.
- [x] Selesaikan seluruh temuan UI/routing yang dapat diperbaiki tanpa migrasi data.
- [x] Verifikasi regresi menyeluruh dan catat gap yang membutuhkan keputusan manusia.
- [x] Petakan ketidakselarasan kiosk, layar antrean, dan kontrak data antrean.
- [x] Bangun jalur simulasi lintas-subdomain yang memakai satu sumber antrean.
- [x] Verifikasi simulasi ambil nomor → tampil pada layar antrean.
- [x] Jadikan kontrak kiosk sebagai migrasi HIS resmi, terjejak dan bukan skrip lepas.
- [x] Hubungkan Edge Function produksi ke prosedur kiosk khusus berbasis service-role.
- [x] Verifikasi migrasi, build desktop, dan kesiapan deploy Vercel/Supabase.

## Implikasi IP & Kepatuhan

- Perubahan mempertahankan data klinis di domain HIS dan tidak menambahkan data pasien nyata.
- Tidak ada aset AVA yang dipindahkan menjadi produk generik dalam pekerjaan ini.
- Kontrol RBAC, audit trail, dan pemisahan data klinis tetap menjadi batas desain; hasil uji lokal bukan pengganti validasi klinis, regulatori, atau integrasi produksi.
- Kiosk publik tidak mengirim atau menampilkan nama pasien. Penerbitan tiket dibatasi pada layanan yang diizinkan dan harus melalui endpoint khusus, bukan hak tulis tabel langsung.
- Antrean tetap induk HIS. Kiosk dan display adalah klien publik terbatas; hanya service-role server yang dapat menerbitkan tiket kiosk dan setiap tiket ditandai sumbernya.
