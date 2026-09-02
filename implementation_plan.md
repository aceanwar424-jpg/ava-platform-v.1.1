# Rencana Implementasi — Penyempurnaan HIS

## Tujuan

Membuat ruang `his.avahealth.sbs` dapat dipakai secara konsisten untuk alur HIS yang sudah ada, dengan fokus pada navigasi, pemuatan modul, dan kejelasan keadaan layar tanpa mengubah skema database atau menghubungkan sistem eksternal.

## Batasan

- Tidak mengubah migrasi, tabel, kunci data, atau data produksi.
- Tidak mengaktifkan SATUSEHAT, payment gateway, atau integrasi eksternal.
- Perubahan dibatasi pada kode UI/router/manifest dan dokumentasi verifikasi.

## Work items

- [x] Petakan menu HIS, rute, renderer, dan modul termuat.
- [x] Perbaiki wiring atau kegagalan UI yang ditemukan dalam ruang HIS.
- [x] Jalankan audit menu serta suite HIS yang relevan.
- [x] Catat bukti hasil dan batas verifikasi.

## Implikasi IP & Kepatuhan

- Perubahan mempertahankan data klinis di domain HIS dan tidak menambahkan data pasien nyata.
- Tidak ada aset AVA yang dipindahkan menjadi produk generik dalam pekerjaan ini.
- Kontrol RBAC, audit trail, dan pemisahan data klinis tetap menjadi batas desain; hasil uji lokal bukan pengganti validasi klinis, regulatori, atau integrasi produksi.
