# Operasi Tech — acceptance sumber 0079/0109/0114

OWNED_BY: generic. Uji lokal sintetis; tidak menjalankan deployment atau menghubungkan vendor/produksi.

## Setup

Migrasi0114 mendaftarkan Tim Teknis dengan menu dashboard, roadmap, modul, isu dan delivery. Role tim yang sudah diizinkan command memperoleh empat menu operasi. Tidak ada hak klinis, pengelolaan user, delete atau wildcard baru. get_my_access aktual memakai user_pages sebelum role_pages; pembatasan halaman individu tidak digantikan oleh matriks klien. Route guard empat menu mengacu allowlist server; role/tenant/stage tetap diperiksa pada setiap command SQL. Tidak ada migrasi profil pengguna otomatis. Apply produksi tetap checkpoint tersendiri.

## Alur hulu ke hilir

1. Roadmap: buat perubahan dengan tipe, risiko dan rencana rollback → ajukan → reviewer berbeda setujui/tolak → preflight → mulai → catat hasil dan versi sukses. Bukti ini tidak menjalankan deploy otomatis.
2. Modul: laporan instalasi menunjuk perubahan SUCCEEDED, versi yang sama, modul/instalasi/environment dan bukti → petugas berbeda verifikasi. Rollback perubahan mencabut pengesahan sumber instalasi; laporan baru tidak bisa memakai rilis yang sudah dibatalkan.
3. Isu: buat masalah/prioritas → triage dan pemilik bernama → mulai → tunggu pelanggan/resume bila perlu → penyelesaian dengan referensi bukti → reviewer berbeda tutup. Reopen mempertahankan outcome lama di histori, mengulang workflow dengan version berikutnya.
4. Delivery: scope lisensi/modul/instalasi/SLA reviewed → milestone sumber verified → ticket linkage → handover → customer acceptance → follow-up/outcome → close. Lihat RUNBOOK-TECH-DELIVERY-0109.md. Tiga menu sumber menampilkan delivery terkait dan navigasi ke sana. SLA elapsed_24x7 menggunakan created_at/first_response_at/resolved_at sumber, dengan threshold eksplisit dari scope; WAITING_CLIENT tidak berhenti menghitung waktu. Bukan kalender jam kerja.
5. Riwayat sumber per record memperlihatkan actor, waktu, transisi/version, alasan dan bukti preflight/hasil/rilis/instalasi/outcome. Pagination 50event/halaman mempertahankan histori awal. Nama actor berasal registry saat dibaca; actor_id historis tetap. Proyeksi tidak memasukkan kunci lisensi/harga/credential/secret vendor.
6. Stale version ditolak dan tidak menambah event. Retry idempoten memakai request actor/input/key yang sama. Jika response sudah terlambat saat tenant/petugas/halaman berubah, UI tidak menampilkan error/data sumber lama atau mengirim ulang ke tenant baru. Commit server yang sudah terjadi tetap ada dan harus dimuat dari sumber, bukan dipalsukan sukses di klien.

## Batas penerimaan

Paket menerima alur bukti operasional lokal, navigasi source lifecycle dan SLA deklaratif. Telemetry live, eksekusi deployment, transaksi finansial kontrak, kalender jam kerja, vendor/produksi tetap terpisah. Bukti pelanggan/follow-up merupakan referensi manual yang direview; bukan pengukuran adopsi otomatis. Approval klinis tidak berasal role teknis. Data historis tidak di-backfill atau dipindahkan antar tenant.

## Verify dan cleanup

Final runner/count dicatat di STATUS-PROYEK.md: actual authenticated operations app, actual delivery SQL/native race dan delivery app; lifecycle rollback/source isolation; stale UI scope; TechRouterApp. PostgreSQL disposable dijalankan serial, browser runner ditutup dan cluster dummy dihapus. RS_TEST_NO_ARTIFACTS=1 mencegah penulisan ulang bukti lama. Tidak ada screenshot/result baru. Cache/binary/log runtime di luar repo tidak dihapus ulang setelah automatic approval review menolak cleanup sebelumnya.
