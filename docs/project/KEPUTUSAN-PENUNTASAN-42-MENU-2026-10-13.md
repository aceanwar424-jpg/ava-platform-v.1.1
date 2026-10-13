# Keputusan penuntasan 42 menu

OWNED_BY: generic. Dikonfirmasi pemilik pada 13 Oktober 2026. Melengkapi persetujuan operasional sebelumnya; tidak mengizinkan DB/vendor/produksi.

| No | Pilihan | Aturan implementasi |
|---|---|---|
| 1 | A | Identitas sementara IGD; penautan definitif oleh petugas berwenang, dengan persetujuan dan audit. |
| 2 | A | Merge duplikat melalui pengajuan dan persetujuan petugas berbeda; seluruh identitas dan kunjungan lama terlacak. |
| 3 | A | Handover per pasien/shift, konfirmasi pengirim/penerima, tugas tertunda dengan penanggung jawab dan tenggat. |
| 4 | A | Eskalasi penanggung jawab → kepala unit → supervisor operasional, konfigurabel per tenant; notifikasi awal dalam aplikasi. |
| 5 | A | Tarif/metode kamar serta plafon per kunjungan, kategori dan periode kontrak; kelebihan sesuai kontrak direview, invoice final tidak dihitung ulang otomatis. |
| 6 | B | Biaya mengikuti harga perolehan batch aktual yang digunakan. Pemilihan batch obat tetap FEFO. |
| 7 | A | Reversal/refund beralasan dan disetujui; transaksi asli tersimpan. |
| 8 | B | Komisi uang, saldo mitra dan settlement direview, selain voucher/diskon; tidak mengizinkan transfer uang/integrasi pembayaran eksternal. |
| 9 | A | CAPA ditutup setelah bukti pelaksana dan verifikasi efektivitas reviewer berbeda; dapat dibuka kembali. |

## Plan → Execute → Verify

Subtask maksimal satu jam: audit kontrak sumber; skema/command/version/idempotency; projection/RLS/audit; menu/context guard; SQL/native concurrency; browser aplikasi; cleanup; dokumentasi dan commit/push. Persetujuan aturan tidak menggantikan acceptance per menu.

Tahap awal identitas: audit MPI/person_identifier/person_merge_log dan patients/admissions. Tabel MPI dan merge log sudah ada; helper merge UI yang ditemukan menghasilkan objek JavaScript, bukan bukti transaksi merge aktual yang disetujui. Jangan menggabungkan otomatis berdasarkan nama/tanggal lahir atau backfill.

Preserve ID dan histori sumber; link identitas tidak menulis ulang clinical signed record, MAR, charge atau invoice final. Consent/alergi/penjamin konflik direkonsiliasi eksplisit; merge tidak otomatis memberi consent. Uji konflik dan penggunaan downstream sebelum acceptance.

## Implikasi IP & Kepatuhan

Aturan generik per tenant, data uji sintetis, tanpa data pasien/harga/kontrak/klien privat. Kunci katalog tetap utuh. Clinical SOP/reviewer/credential/privilege tetap wajib; persetujuan ini tidak mengesahkan acuan klinis. Perubahan master di luar persetujuan sebelumnya memerlukan checkpoint konkret sesuai AGENTS.md. Tidak ada koneksi atau aktivasi produksi/vendor.

## Status

Keputusan tercatat, implementasi dan acceptance masih harus dibuktikan. Matriks terakhir tetap 2 menu tuntas lokal dan 42 parsial.
