# Billing kamar dan invoice sumber 0082–0084

OWNED_BY: generic. Perubahan repo dan tes lokal disetujui; dokumen ini tidak mengizinkan penerapan produksi.

Urutan dependensi: sumber inpatient, tagihan 0044, accounting fase4, 0070–0081, lalu 0082–0084. Pasang sebagai satu paket dalam database disposable/staging yang disetujui. 0083 menunda jurnal legacy pada stay enrolled; 0084 menyediakan review invoice dan jurnal final. Jangan memasang 0083 sendiri untuk penggunaan operasional.

Sebelum penerapan, cocokkan signature/body rs_stay_guard, inp_discharge_patient, trial_balance dan profit_by_cost_center. Migrasi berhenti bila kontrak yang dipatch berbeda. Validasi ledger biaya aktif, timestamp sumber tanpa timezone, periode accounting, GL mappings/accounts/cost centers, kebijakan aktif serta otorisasi billing. Tidak ada tarif, saldo opening, coverage lama atau mapping accounting default tenant.

1. Tetapkan kebijakan administratif aktif: metode periode/pindah/rounding/timezone/minimum. Pilih presisi nominal dan weighted_period_average secara eksplisit. Cutoff memakai tarif opening serta latest_daily_at_period_start eksplisit.
2. Buat opening pada stay sumber Dirawat, cutover saat ini, coverage lama dan jumlah biaya sumber yang benar. Reviewer berbeda menyetujui snapshot; bila sumber/kebijakan berubah, tolak draft dan buat ulang. Opening tidak menyalin/mengarang transaksi lama.
3. Transfer memakai inp_transfer_bed yang sebenarnya. Segmen tarif dan versi setup berubah otomatis. Proposal kumulatif diposting oleh reviewer lain melalui tagihan_posting. Koreksi negatif menambah baris qty -1; biaya asli tetap immutable. Retry dengan key/input/actor yang sama mengembalikan hasil asli.
4. Pemulangan memakai checklist dan inp_discharge_patient sumber. Status klinis, bed Dibersihkan dan housekeeping tetap berjalan. Stay enrolled menandai finance_deferred.
5. Rekonsiliasi biaya sampai discharged_at, kemudian buat invoice dengan event mapping dan cost center aktif yang dipilih. Reviewer terpisah memeriksa ulang snapshot charge/rate/accounting. Jurnal dan invoice diposting atomik; periode tutup menggagalkan keduanya. Total nol tidak membuat jurnal palsu.
6. Charge sumber tidak dapat berubah setelah invoice posted. Void beralasan mempertahankan invoice/jurnal dan menambah jurnal balik periode berjalan. Setelah void, koreksi charge dilakukan dengan proposal baru lalu invoice baru. Periode reversal tutup tetap menolak operasi.

View tagihan lama memfilter source owner, tenant profil, dan peran. Jurnal invoice dibatasi melalui RLS termasuk ketika policy permisif lama masih ada; RPC reverse/post lama dibungkus untuk menolak bypass source invoice. Agregat SECURITY DEFINER juga memfilter invoice tenant lain. Visibilitas jurnal legacy dipertahankan; paket ini bukan audit seluruh accounting legacy.

Bukti: calculator 8, source SQL 9, UI 6 pada docs/audit-evidence/2026-10-10 dan kalkulator 2026-10-09. Fixture accounting memakai fungsi sumber post_journal/reverse_journal yang sebenarnya, dengan mapping sintetis. Runtime native loopback dipakai saat PGlite kehabisan memori; cluster/server/dummy ditutup/dihapus dalam finally. Screenshot mobile diperiksa tanpa overflow.

Masih harus dilengkapi: kontrak/eligibility penjamin, alokasi manfaat, deposit/refund/payment cashier dan settlement; acceptance lintas 44 menu. Jangan menyatakan billing atau seluruh menu selesai berdasarkan paket ini. Tidak ada aktivasi vendor/DB produksi.
