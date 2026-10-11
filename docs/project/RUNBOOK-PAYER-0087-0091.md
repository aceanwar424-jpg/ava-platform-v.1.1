# Penjamin rawat inap sumber 0087–0091

OWNED_BY: generic. Sesudah paket billing/kasir 0082–0085. Pengembangan dan pengujian lokal diizinkan; penerapan produksi/vendor tidak termasuk.

Kontrak master corporate_contract harus aktif dengan effective_from/effective_to eksplisit. Lengkapi payer_type (BPJS/Asuransi/Korporat), covered_categories, coverage_percentage, benefit_ceiling, cap_scope=stay, unlisted_categories=excluded, benefit_rounding dan payer_receivable_account. Kategori mengikuti charge_type sumber persis; Kamar konfigurasi adalah adjustment engine tersendiri. Tidak mengasumsikan semua biaya ditanggung atau plafon berlaku tahunan. Lingkup lain belum didukung dan ditolak.

1. Buat eligibility pada setup billing aktif, pilih kontrak yang cocok dengan guarantor admission/stay. Masukkan referensi bukti dan masa berlaku dalam periode kontrak. Reviewer berbeda menyetujui snapshot; perubahan kontrak/identitas membatalkan kelayakan draft untuk approval. Ini persetujuan bukti lokal, bukan ACK vendor.
2. Selesaikan pemulangan klinis, rekonsiliasi kamar dan review invoice sumber. Buat alokasi manfaat memakai eligibility approved yang masih berlaku. Quote menggunakan biaya sumber aktif dan kategori eksplisit; koreksi negatif harus direkonsiliasi. Alokasi tidak boleh melebihi saldo pasien yang belum dibayar: refund/reversal aplikasi dahulu bila pasien sudah membayar terlalu banyak.
3. Pilih mapping piutang penjamin kontrak → piutang pasien snapshot invoice. Reviewer berbeda memposting jurnal transfer atomik; tidak menambah revenue. Saldo invoice pada board kasir adalah bagian pasien, sedangkan saldo claim adalah bagian penjamin.
4. Terima pembayaran pasien melalui pay/apply; terima pembayaran penjamin melalui payer_pay dengan claim dan invoice yang sesuai. Mapping masing-masing mengurangi piutang yang sesuai; sumber uang tetap cashier_transactions. Tidak boleh melebihi saldo masing-masing. Nominal, metode, referensi dan pusat biaya wajib eksplisit.
5. Refund penjamin mengacu payer receipt asal dan claim/invoice yang sama. Batas refund adalah net receipt; refund membuka kembali piutang penjamin tanpa mengubah bagian pasien. Void claim memerlukan seluruh penerimaan penjamin sudah dikembalikan, menjaga jurnal asli dan menambah reversal. Invoice tidak dapat di-void saat alokasi/pembayaran aktif.

RLS, role/profil tenant, authority policy, snapshot, source locks, maker/checker, retry keys dan audit berlaku. Kebijakan authority perlu action billing.payer.create/approve/reject/revoke, billing.payer.claim_create/approve/reject/void serta billing.cashier.create_payer_pay/create_payer_refund. Tidak ada otorisasi finance implisit di luar role/policy tenant.

Paket ini menangani manfaat/settlement lokal per stay. Override tarif kamar/metode kontrak, claim submission/ACK vendor dan lingkup plafon selain stay belum tersedia. Jangan mengklaim keseluruhan 44 menu selesai dari verifikasi paket ini.
