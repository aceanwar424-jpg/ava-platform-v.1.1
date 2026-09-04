# Runbook — 0050 Registry Master HIS

## Tujuan

Menyediakan 20 domain master konfigurasi HIS dalam registry multi-tenant, dengan audit append-only dan sinkronisasi domain `queue_device` ke registry perangkat antrean publik.

## Batas implementasi

- Jalankan pada **staging** terlebih dahulu. Tidak ada data pasien yang dimigrasikan.
- Migrasi ini tidak mengaktifkan vendor Telemedicine atau SATUSEHAT, dan tidak menyimpan credential. Hanya metadata serta `vault://...` reference yang diizinkan UI.
- Kiosk/display yang ada tetap memakai `queue_public_devices`; jangan mengubah `device_id` aktif tanpa simulasi penerbitan tiket.

## Urutan staging

1. Backup database dan catat jumlah tiket/konfigurasi antrean.
2. Pastikan `0048_antrean_tenant_device_public.sql` dan `0049_homecare_bridging_his_lis.sql` sudah selesai.
3. Jalankan `db/preflight/0050_his_master_registry_preflight.sql` sebagai akun administrator. Semua pemeriksaan harus lolos.
4. Terapkan `db/migrations/0050_his_master_registry.sql` dalam release yang sama dengan kode UI.
5. Dengan akun super admin, buat satu data draft pada `branch`; ubah menjadi aktif dengan alasan; lalu arsipkan. Pastikan tiga jejak muncul pada `his_master_audit`.
6. Buat `queue_device` uji dengan device ID unik dan status draft, lalu aktifkan. Verifikasi satu baris yang sama muncul pada `queue_public_devices` dengan `tenant_id`, origin, layanan, rate limit, dan `is_active` sesuai.
7. Simulasikan penerbitan tiket hanya dari device uji pada environment staging. Verifikasi tenant dan layanan tidak dapat melewati daftar izin.
8. Jalankan UAT pemilik proses untuk domain klinis, keuangan, dan integrasi sebelum rilis produksi.

## Kriteria penerimaan

- Pengguna tenant A tidak dapat membaca record/audit tenant B.
- Role non-administratif ditolak oleh kedua RPC tulis.
- Kode aktif unik dalam tenant/domain; device ID publik tidak dapat ditimpa tenant lain.
- Perubahan pada domain ber-governance menyimpan alasan dan snapshot sebelum/sesudah.
- Secret tidak dapat diketik pada UI karena format referensi wajib `vault://...`.

## Rollback aman

Jika UAT belum diterima, hentikan akses menu konfigurasi dan jangan buat data baru. Bila data staging telah dibuat, **arsipkan** record melalui RPC agar jejak tetap utuh. Jangan menghapus tabel audit atau perangkat antrean secara manual. Penghapusan fisik hanya boleh diputuskan pemilik data setelah backup dan pemeriksaan dependensi.
