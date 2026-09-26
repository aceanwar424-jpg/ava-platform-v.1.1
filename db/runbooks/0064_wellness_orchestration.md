# Rilis 0064 — Orkestrasi Wellness

OWNED_BY: generic. Versi 1.0 / 2026-09-25.

## Isi rilis

Migrasi `db/migrations/0064_wellness_orchestration.sql` menambah tabel transaksi sesi treatment dan akses pemasok, versi notice enrollment, idempotency key request, snapshot hasil terbaru, serta RPC orkestrasi dan history. API lama request HR tetap tersedia dengan validasi baru. Tidak mengubah kunci katalog master atau mengisi data produksi.

Frontend menambah `his-wellness`, memindahkan konfigurasi/pelaksanaan ke HIS, menggunakan komponen bersama untuk HR dan peserta, serta menyediakan peran login IHC. Daftar peserta termuat otomatis. Riwayat hasil dan laporan sesi, filter level, pencarian dan ekspor CSV tersedia.

## Sebelum penerapan

1. Checkpoint pemilik untuk akses/migrasi DB produksi sesuai AGENTS.md §2/§5; implementasi dan pengujian lokal tidak memerlukan akses produksi.
2. Pastikan migrasi 0058–0063 sudah ada. Jalankan preflight `db/preflight/0064_wellness_orchestration.sql` secara read-only di target yang telah disetujui. Profil yang tidak memiliki tenant harus diperbaiki dengan mapping yang benar; jangan memakai fallback tenant global.
3. Simpan backup terverifikasi dan definisi fungsi lama melalui prosedur operator yang berlaku. Tidak menghapus data untuk rollback.
4. Periksa akun pemasok IHC yang pernah memakai akun admin pada UAT lama. Rilis ini tidak menurunkan peran akun secara otomatis. Tetapkan akun eksternal khusus `ihc` melalui pengelolaan akun yang berwenang, lalu berikan akses program dari HIS. Jangan menjalankan ulang seed UAT yang mengangkat IHC menjadi `super_admin`.
5. Beri tahu peserta mengenai notice v2. Persetujuan v1 tidak mencakup otomatis pemberitahuan v2. Roster tetap terlihat, hasil/request ditahan sampai v2 diterima atau dasar `not_required` yang sudah sah tersedia.
6. Ambang level adalah aturan operasional v1; pengelola medis perlu meninjau penggunaannya. Tidak dipasarkan sebagai diagnosis otomatis.

## Urutan rilis

1. Terapkan **0064 saja** pada lingkungan yang sudah memiliki 0058–0063. Migrasi berjalan dalam transaksi dan dapat diulang; jangan menimpa fungsi baru dengan migrasi/seed lama sesudahnya.
2. Muat ulang cache schema PostgREST (`NOTIFY pgrst, 'reload schema'`).
3. Rilis aset aplikasi dan middleware pada versi `20260925-orchestration`: JS/CSS wellness bersama, Apps JS/navigation/HTML, modul HIS, router, manifest, peta menu, settings_users dan index HIS.
4. Pastikan menu `his-wellness` tersedia untuk peran internal. Migrasi menambahkan page mapping untuk peran yang sudah ada; tidak menaikkan peran eksternal.
5. Lakukan UAT-02 dengan akun sintetis HR, admin, peserta, dan IHC pada target. Konfirmasi fungsi RPC muncul, daftar otomatis tampil, request sampai laporan bisa dijalankan, dan pembatasan tenant berlaku.
6. Catat versi deployment, hasil migrasi, waktu, tester dan sign-off. Jangan menyimpan kredensial atau data karyawan nyata dalam bukti repo.

## Pemulihan

- Bila migrasi gagal, transaksi rollback; jangan deploy frontend yang memerlukan RPC baru.
- Bila frontend gagal setelah migrasi berhasil, hentikan akses modul baru dan lakukan forward fix. Menurunkan frontend ke versi v1 tidak memulihkan consent secara aman karena server tetap memerlukan notice v2.
- Jangan drop tabel sesi/request atau mengubah consent peserta untuk melewati error. Backup dipulihkan hanya oleh operator sesuai prosedur pemulihan data.

## Batas operasional

IHC menggunakan upload CSV; koneksi API vendor/DB IHC tidak dibuat. Notifikasi WhatsApp/email tetap membutuhkan connector tersendiri. Pembuatan task reminder Apps dilakukan melalui kendali yang tersedia di HIS. Bukti lokal tidak menjamin akun, konfigurasi tenant, dan migrasi pada produksi sudah sama.
