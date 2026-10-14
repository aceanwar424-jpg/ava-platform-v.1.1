# Nurse Station — sumber operasional 0113

OWNED_BY: generic. Keputusan pemilik 3A/4A, persetujuan skema lokal. Tidak ada data pasien nyata, produksi, vendor atau pengiriman eksternal.

## Setup dan alur

1. Terapkan migrasi sampai 0113 pada lingkungan yang sudah direview. Produksi memerlukan checkpoint tersendiri. Konfigurasikan role/menu perawat, kewenangan scope rs-nurse-station dan kredensial/privilege individu yang masih aktif; admin bukan pengganti tenaga klinis.
2. Buat, submit, review independen dan aktifkan template nursing_task, nursing_task_outcome, nursing_shift, nursing_observation, serta nursing_task_reassignment bila digunakan. Timezone, pengukuran/unit, kepala unit/supervisor, waktu eskalasi wajib eksplisit. Template tidak mengisi nilai klinis/pasien otomatis.
3. Buka episode sumber aktif. Dari Nurse Station → Formulir Klinis, catat instruksi dan pilih penanggung jawab bernama, lalu sahkan. Publikasikan tugas dari catatan signed milik pelaksana. Deadline dan sumber disimpan sebagai snapshot.
4. Buat SBAR signed untuk pasien/shift. Handover mencakup semua tugas terbuka milik pengirim pada admission; penerima berbeda, aktif dan berwenang harus mengakui. Tugas berpindah owner/version tanpa mengganti deadline atau sumber episode asal.
5. Outcome signed oleh penanggung jawab dipakai untuk menyelesaikan/membatalkan tugas. Instruksi yang diamend sesudah publikasi memerlukan review/cancel/replan. Outcome yang sudah disahkan sebelum amendment tetap dapat diakui sebagai histori, dengan penanda perubahan sumber.
6. Penugasan ulang memakai instruksi reassignment signed dengan privilege khusus. Pending handover bisa ditarik memakai amendment SBAR signed berprivilege withdraw; tugas tetap pada owner semula sampai penugasan yang sah. Pencabutan privilege penerima tidak dapat dilewati oleh retry lama.
7. Observasi memakai kode/unit dari SOP, waktu ISO dengan offset, nilai eksplisit (nol tetap nol). Koreksi mengikuti clinical parent dan observation parent; entered_in_error tidak merekayasa nilai nol. Histori tidak dihapus. Setelah encounter ditutup hanya koreksi sumber berprivilege terpisah, bukan observasi baru.
8. Eskalasi internal diperiksa saat papan dipantau/diperbarui: penanggung jawab → kepala unit → supervisor pada waktu dari SOP. Unik per task/version/level, urut, idempoten. Error parsial terlihat. Inbox supervisor tidak membocorkan rincian pasien.
9. Tombol MAR membawa admission ke sumber farmasi yang tetap memerlukan resep, verifikasi apoteker, jadwal signed dan pemeriksaan identitas. Tugas dan flowsheet bukan pemberian obat.
10. Transfer unit ditolak saat handover pending; tugas terbuka dapat mengikuti admission ke episode aktif berikutnya dengan sumber/deadline asli. Pulang/penutupan ditolak bila tugas terbuka atau handover pending. Setelah obat direkonsiliasi, keputusan pulang signed, invoice/jurnal aktual dan episode closure dapat diselesaikan.

## Batas penerimaan lokal

Alur kanonis baru diuji dari UI/SQL sumber, termasuk role/tenant, retry, race penerimaan, amendment, pencabutan privilege dan akhir transaksi. Tugas sumber sebelumnya tetap dapat dilihat melalui navigasi tersendiri; tidak dimigrasikan atau dinyatakan selesai otomatis. Produksi, rekonstruksi histori lama, validasi SOP klinis tenant dan scheduler offline bukan hasil paket ini. Eskalasi bekerja saat papan dimonitor, bukan saat aplikasi mati. Picker outcome/reassignment memiliki pagination sumber 50 tugas/halaman dan mempertahankan bukti yang sudah diketik; tugas yang lebih lama tidak membutuhkan ID manual.

## Verifikasi dan pembersihan

Runners: test_nursing_sources.cjs, test_nursing_browser.cjs, test_capacity_signed_discharge.cjs dan regresi MAR/clinical forms. Gunakan native disposable PostgreSQL secara serial, runtime RS_TEST_RUNTIME, tanpa produksi. Hasil final dan jumlah PASS dicatat di STATUS-PROYEK.md setelah semua runner selesai. Native cluster/database dan browser uji dibersihkan oleh finally; tidak ada output/screenshot baru. Cache/binary/log runtime lama di luar repo tetap ada karena automatic approval review menolak penghapusannya; penolakan tidak dicoba ulang.
