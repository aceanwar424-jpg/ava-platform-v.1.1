# Delivery sumber dan SLA 0109

OWNED_BY: generic. Penggunaan lokal/sintetis telah diizinkan; migrasi produksi terpisah.

## Alur

1. Lisensi aktif tenant dan paket berisi modul scope. Kunci lisensi, harga dan nilai kontrak tidak dibaca melalui proyeksi delivery.
2. Buat scope: referensi kontrak, instalasi/environment, timezone, seluruh SLA P0–P3 dalam menit, milestone/deadline dengan offset. Setiap modul wajib memiliki milestone deployment. Tambahkan onboarding/training/adopsi sesuai kontrak.
3. Ajukan → reviewer berbeda menyetujui → mulai. Scope tidak diedit setelah dibuat; perubahan scope memakai pembatalan dan project baru, histori lama tetap utuh.
4. Buat rilis melalui Tech Roadmap: review berbeda, preflight, sukses dengan versi sumber. Laporkan instalasi dan verifikasi berbeda melalui Tech Modul. Ini catatan berbukti; tidak menjalankan deploy atau membaca vendor.
5. Ajukan bukti tiap milestone. Milestone modul harus menunjuk deployment verified dengan modul, instalasi, environment dan rilis SUCCEEDED yang sama. Reviewer berbeda menerima/mengembalikan. Bukti yang sudah diterima immutable.
6. Tautkan tiket sumber. SLA dihitung dari created_at, first_response_at dan resolved_at asli, memakai snapshot prioritas/SLA saat linkage. Clock elapsed_24x7 termasuk WAITING_CLIENT; tidak menyamar sebagai kalender jam kerja.
7. Selesaikan dan verifikasi CLOSED tiket di Tech Isu. Serah terima diblokir bila milestone/modul/tiket/lisensi/rilis belum sah.
8. Reviewer selain pembuat mencatat referensi bukti penerimaan pelanggan. Ini verifikasi internal atas dokumen pelanggan, bukan tanda tangan digital pelanggan.
9. Catat referensi follow-up dan outcome adopsi/evaluasi → tutup. Histori review dapat dibaca dari delivery dengan pagination. Papan tiket/rilis/modul menampilkan delivery terkait dan navigasi kembali.

## Perubahan sumber setelah selesai

Rollback/revoke, lisensi/paket berubah atau tiket dibuka kembali tidak menghapus penerimaan lama. Board menghitung ulang current_source_valid dan memperlihatkan masalah sekarang. Scope/milestone/final project/request/history/link immutable; authenticated tidak memiliki DML langsung. Penanganan perubahan memakai sumber dan scope baru, bukan mengedit bukti penerimaan sebelumnya.

## Verifikasi

Jalankan serial dengan RS_TEST_RUNTIME menunjuk runtime PostgreSQL disposable yang disetujui:

```
node --max-old-space-size=512 --v8-pool-size=1 scripts/uji/test_tech_delivery_source.cjs
node --max-old-space-size=512 --v8-pool-size=1 scripts/uji/test_tech_delivery_browser.cjs
node scripts/uji/test_tech_ui_scope.cjs
```

9 source scenarios: kontrak/scope/lisensi/SLA/retry, maker-checker/version, rilis/deployment actual, milestone, source timestamp SLA/tiket/closure, source drift, RBAC/tenant/no-secret/DML, immutable history, native contenders dan retry single-write. 8 browser scenarios memakai index/boot/router/lazy modules nyata dan RPC PostgreSQL authenticated; 4 regresi scope UI Tech. Migrasi workforce/alias/profile locks 0081/0107/0108 ikut dimuat. Native cluster/dummy dan browser dibersihkan; tidak membuat file output uji. Cache runtime/log lama tidak dihapus ulang setelah penolakan automatic approval review.

## Batas

Tidak ada koneksi vendor, job notifikasi SLA, kalender hari kerja/jam operasional, transaksi kontrak finansial baru, atau telemetry/adopsi otomatis. Bukti pelanggan dan follow-up adalah sumber dokumen manual yang direview. Scope lokal ini menyelesaikan lifecycle delivery sesuai SLA elapsed yang dinyatakan; penerimaan deployment produksi nyata tetap terpisah.

## Implikasi IP & Kepatuhan

Generik, source IDs tenant dibatasi, tanpa pasien/harga/kunci lisensi pada proyeksi. Persetujuan skema operasional/lokal yang sudah ada digunakan; tidak ada perubahan join master atau aktivasi produksi.
