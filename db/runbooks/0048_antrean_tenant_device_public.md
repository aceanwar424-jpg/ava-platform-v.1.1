# Runbook staging — 0048 Antrean Multi-tenant

## Tujuan

Memasang isolasi tenant serta pengamanan perangkat publik tanpa mengganggu antrean aktif.

## Pra-kondisi

1. Gunakan database **staging**, bukan produksi.
2. Buat backup/snapshot yang dapat direstore dan catat timestamp-nya.
3. Jalankan `db/preflight/0048_antrean_tenant_device_public_preflight.sql`; simpan hasilnya pada tiket rilis.
4. Pastikan tenant lokal tersedia dan semua tabel hasil preflight muncul.
5. Pastikan JWT pengguna staging mempunyai claim `tenant_id`, atau gunakan tenant lokal untuk uji desktop.

## Cutover staging

1. Hentikan sementara penerbitan tiket baru pada kiosk dan konsol.
2. Terapkan `db/migrations/0048_antrean_tenant_device_public.sql` sekali melalui runner migrasi.
3. Set Supabase secret `QUEUE_PUBLIC_DEVICE_ID=kiosk.avahealth.sbs`.
4. Set `QUEUE_PUBLIC_ALLOWED_ORIGINS=https://kiosk.avahealth.sbs,https://antrian.avahealth.sbs`.
5. Deploy ulang Edge Function `queue-public`.
6. Jalankan: kiosk ambil satu tiket → konsol panggil → display menunjukkan nomor tanpa nama pasien.
7. Uji tenant kedua pada staging; nomor dan daftar tiket tidak boleh saling terlihat.

## Kriteria lulus

- RPC publik menolak origin selain daftar yang diizinkan.
- Ticket kiosk dibuat dengan tenant perangkat, bukan tenant dari browser.
- Rate limit tetap berlaku setelah cold start Edge Function.
- `queue_papan` tidak bisa dibaca anon, tetapi konsol petugas tenant terkait tetap bisa membaca datanya.
- Tidak ada tiket atau loket tenant A pada konsol/display tenant B.

## Rollback

Jangan mencoba menghapus kolom/constraint satu-satu setelah ada tiket baru: itu dapat merusak jejak audit. Bila staging gagal, hentikan function/kiosk lalu restore snapshot pra-cutover. Untuk produksi, rollback hanya boleh diputuskan oleh pemilik database setelah menilai tiket yang terbit selama jendela rilis.
