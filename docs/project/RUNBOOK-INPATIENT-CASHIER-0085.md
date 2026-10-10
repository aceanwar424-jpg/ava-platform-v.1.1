# Kasir rawat inap sumber 0085

OWNED_BY: generic. Dependensi: paket billing 0082–0084, tabel cashier_transactions dan trigger accounting legacy yang sebenarnya. Hanya repo dan simulasi lokal disetujui; belum diterapkan ke produksi.

Policy administratif yang direview harus menentukan deposit_account_code (untuk titipan) dan deposit_cash_accounts (daftar kode akun kas yang diperbolehkan). Tidak ada kode akun tenant default. Mapping receive: kas → titipan; refund: titipan → kas; apply: titipan → akun piutang snapshot invoice; pay: kas → piutang invoice; refund_payment: piutang invoice → kas. Mapping yang tidak cocok ditolak, termasuk perubahan mapping setelah draft dibuat.

1. Buka Billing Kamar → Deposit & penyelesaian invoice, pilih setup sumber aktif.
2. Terima deposit dengan bukti nominal aktual. Fixed memakai nilai policy; percentage memerlukan basis active_charges atau estimasi dan pembulatan eksplisit. Partial/excess tetap tercatat sebagai saldo titipan aktual. None hanya mengizinkan titipan bila voluntary disahkan eksplisit.
3. Reviewer berbeda memposting receipt; actual cashier dan jurnal dibuat dalam satu transaksi. Kegagalan jurnal/periode tutup membatalkan seluruh transaksi. Retry input/actor/key yang sama tidak menambah penerimaan lagi.
4. Setelah pemulangan klinis, rekonsiliasi kamar dan review invoice, alokasikan receipt sumber ke invoice. Tidak ada penerimaan kas kedua. Saldo receipt dan invoice membatasi aplikasi; void aplikasi menambah jurnal balik dan memulihkan saldo.
5. Untuk kebijakan tanpa deposit, gunakan Bayar invoice langsung. Pembayaran mengurangi piutang invoice tanpa menjadi titipan. Refund pembayaran mengacu receipt pembayaran dan invoice yang sama; nominal tidak melebihi pembayaran neto. Refund membuka kembali saldo invoice untuk pembayaran susulan.
6. Kelebihan titipan dikembalikan melalui Refund receipt. Histori uang tidak dihapus/diedit. Invoice tidak dapat dibalik selama alokasi atau pembayaran neto masih aktif.

Seluruh command memakai tenant profil, RBAC/authority policy, maker/checker, request key, source lock dan audit. Histori sumber kas/jurnal immutable. Trigger revenue lama dilewati hanya untuk source intent yang tervalidasi; posting explicit mapping atomik menggantikannya. Fungsi inti lama dan fungsi private baru tidak dapat dipanggil authenticated langsung.

Daftar setup dan intent memiliki pagination. Pilih ID setup untuk meninjau pasien tertentu; gunakan halaman intent untuk receipt lama. Invoice posted diprioritaskan. Cluster disposable/dummy dibersihkan dalam finally; cache binary runtime bukan data pasien.

Kontrak/eligibility penjamin dan pembagian patient/payer belum termasuk acceptance paket ini. Integrasi penjamin eksternal tetap nonaktif. Bukti lokal tidak menggantikan konfigurasi/accounting review tenant nyata.
