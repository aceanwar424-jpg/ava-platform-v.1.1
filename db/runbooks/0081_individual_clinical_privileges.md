# Kredensial dan privilege individu — 0081

OWNED_BY: generic. Skema operasional lokal disetujui dalam sesi. Tidak menyalin kredensial nyata ke fixture, memverifikasi vendor, menetapkan ketentuan hukum otomatis, atau menerapkan ke produksi.

## Setup dan urutan

1. Baseline 0074–0080, user_profiles, role/auth dan master HIS tersedia. 0081 merujuk user_id existing; tidak mengganti identitas pegawai/praktisi atau nomor master. Bukti kredensial dicatat sebagai referensi sumber manual yang ditinjau. Hubungan otomatis ke permit_pics/employee legacy belum menjadi bukti fitur ini.
2. Setelah migrasi lokal, buka Konfigurasi Praktisi → Kredensial & privilege individu. Buat draft kredensial dengan petugas, jenis, referensi, bukti dan tanggal eksplisit; ajukan review dan verifikasi oleh profesi reviewer yang berbeda dari pembuat/pemilik.
3. Buat privilege dengan scope, daftar aksi klinis eksplisit, ID kredensial sah petugas yang sama, periode yang tercakup seluruh kredensial, serta bukti. Review terpisah wajib. Jenis/jumlah kredensial yang dipilih merupakan pengesahan setup tenant; aplikasi tidak mengklaim menetapkan kewajiban hukum universal STR/SIP.
4. Reviewer template memerlukan `clinical.template.review`; reviewer authority klinis memerlukan `clinical.authority.review` pada scope terkait. Baru kemudian approve/activate kebijakan. Admin menjalankan aktivasi administratif tetapi tidak menggantikan pengesahan profesi. Bootstrap reviewer kredensial/privilege memakai role profesi yang ditunjuk dalam setup tenant; bukan pemberian privilege otomatis untuk admin.
5. Petugas klinis memerlukan grant per aksi (misalnya clinical.record, clinical.sign, clinical.episode.accept/transfer/close/attach/link_birth) sekaligus authority role yang aktif. Kedaluwarsa, pencabutan atau perubahan role memblokir aksi berikutnya. Catatan sah lama tetap tersimpan.

## Verifikasi dan pemulihan

Jalankan serial `node --max-old-space-size=4096 scripts/uji/test_workforce_privileges.cjs` dan `scripts/qa-workforce-privileges.cjs`. Sembilan SQL dan lima kelompok UI memeriksa maker-checker, tanggal, reviewer individu, clinical record/sign, revoke, privacy, RLS, bypass core, error/retry dan mobile. Seluruh record dummy hanya DB in-memory yang ditutup pada success/failure. Bukti 2026-10-09.

Tidak ada edit diam-diam pada kredensial/grant yang disahkan: cabut dan buat record baru. Jangan menghapus event. 0081 mengganti gate ops_assert_permission dan melindungi approve/activate policy; policy core lama tidak diekspos kepada authenticated. Migrasi sekali melalui runner. Gate ini berlaku pada mesin 0076/0080 dan caller ops_assert_permission; seluruh jalur klinis legacy lain masih perlu inventaris/penyambungan sebelum dinyatakan tertutup. Tidak ada seed grant otomatis pada tenant nyata.
