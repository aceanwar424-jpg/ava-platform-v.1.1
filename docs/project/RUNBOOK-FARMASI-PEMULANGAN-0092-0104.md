# Farmasi bangsal, MAR dan pemulangan sumber

OWNED_BY: generic untuk adapter baru. Implementasi pharmacy/MAR/inpatient asli tetap dengan provenance semula. Paket ini diuji lokal; belum diterapkan ke produksi. Acceptance seluruh 44 menu tetap terbuka.

## Persiapan tenant

Pasang keluarga 0092–0104 dan UI/router secara bersama setelah dependensi 0070–0091 serta source pharmacy/MAR/inpatient/GL tersedia. Source RPC lama diprivatkan; pemasangan sebagian akan memutus layar lama. Bed/admission/master ownership lama harus sudah dipetakan, bukan ditebak dari nama/MR. Source pasien, harga atau kontrak nyata tidak menjadi fixture/template produk.

Registrasikan kredensial dan privilege individual dokter/apoteker/perawat melalui workforce command dan reviewer berbeda. Aktifkan authority untuk action/scope yang dipakai; role semata tidak memberi privilege klinis. Reviewer SOP/form klinis memiliki privilege review tersendiri. Kredensial kedaluwarsa menahan tindakan baru; retry identik mengembalikan transaksi yang sudah selesai.

Setup binding formulary mencatat harga jual tenant, step quantity satuan stok, presisi nominal, timezone IANA, tanggal berlaku, bukti dan daftar ID batch opening yang benar-benar dimiliki. Apoteker berbeda mengesahkan snapshot sumber. Dua tenant yang bersaing mengklaim batch yang sama diserialisasi; histori tidak dibentuk menjadi ledger opening palsu. Harga dan stok agregat global tidak ditampilkan sebagai milik tenant.

SOP klinis bukan contoh terapi bawaan. Pemilik tenant dan profesional kompeten mengisi serta mengesahkan parameter berikut sebelum operasi:

- `medication_schedule`: timezone, early/late minutes, fractional stock-unit permission, quantity precision, minimal dua identity fields berbeda, signer dokter dan fields instruksi (item Rx/dispense, quantity satuan stok, waktu eksplisit ISO 8601 dengan offset, rute).
- `medication_custody`: timezone, return/waste/take-home permissions, waste billable flag, quantity precision, identitas/asesmen/konseling dan bukti kondisi. Retur juga harus mengikuti step stok binding, sealed, storage verified, batch asli dan expiry yang sah. Jadwal aktif harus dihentikan dokter terlebih dahulu.
- `inpatient_discharge`: scope `rs-discharge`, timezone, masa berlaku keputusan dalam menit, signer dokter, disposition, diagnosis akhir, resume, medication plan, instruksi dan kondisi pulang eksplisit. Tidak ada kondisi klinis bawaan. Rujukan membutuhkan tujuan. Record terbaru yang signed dipakai; record yang sudah diamend atau digantikan keputusan signed lebih baru ditolak.

## Alur operasional

1. Receipt/adjustment memakai batch dan pharmacy stock ledger asli dengan balance tenant terpisah. Input biaya/quantity/expiry/reason eksplisit.
2. Rekonsiliasi mengikat admission dan episode aktif, identitas serta alergi sumber yang diketahui ownership-nya. Alergi legacy matching MR yang belum dipetakan menahan persetujuan. Unknown ownership tidak diabaikan sebagai no-known-allergies.
3. Dokter berprivilege menulis resep/attestasi; identitas pasien dan harga berasal dari sumber tenant, bukan header input. Dosis/frekuensi/durasi ditulis manusia. Apoteker berbeda menilai alergi/interaksi/dosis. Daftar interaksi lama bukan database klinis lengkap.
4. Dispensing menjalankan FEFO hanya dari batch tenant dengan expiry diketahui dan belum lewat, mengubah ledger obat serta item dispensing asli, lalu memposting biaya `pharmacy_dispense_items` ke tagihan. Stock global bukan sumber tampilan tenant. Obat terkendali memerlukan identitas penerima; register asli diberi scope melalui ledger sumber baru, tanpa mengadopsi histori register yang belum dimiliki.
5. Dokter menandatangani instruksi jadwal yang terkait item dispensing; apoteker memverifikasinya. Perawat memeriksa dua identitas dan mencatat slot/outcome dalam window SOP. Retry/slot duplicate tidak memberi dosis dua kali. MAR tidak memotong stok gudang kedua kali. Koreksi given memerlukan record dokter independen signed dan append-only; original MAR tetap utuh.
6. Retur/waste/take-home mengurangi custody pasien yang aktual, tidak melebihi dispensing. Reviewer apoteker berbeda wajib. Retur mengembalikan quantity ke batch asli serta ledger/register asli dan menambah kredit biaya; waste mengikuti billable flag; take-home mencatat identitas penerima/konseling. Kredit yang tidak sesuai presisi nominal ditolak, bukan dibulatkan diam-diam. Invoice posted menahan koreksi biaya dan transaksi stok terkait ikut rollback.
7. Keputusan pulang dokter, checklist sumber selesai, setup billing aktif, serta resep/MAR/custody yang telah direkonsiliasi mengizinkan source discharge. Pada visit episode engine, RPC legacy tidak dapat melewati keputusan signed. Record/source stay yang berubah menahan proses. Source resume memakai nama dokter penandatangan, bed menjadi Dibersihkan dan housekeeping sumber dibuat. Billing lama menggunakan timezone timestamp sumber yang sudah direview agar checklist/discharged-at tanpa timezone tidak bergeser.
8. Proposal kamar sampai discharge-time direview, lalu invoice/jurnal akhir direview dari sumber obat/kamar. Physician closure memakai keputusan source discharge yang sama untuk episode/encounter; tugas aktif dan sisa obat menahan penutupan. Housekeeping bed tetap terpisah dari episode pasien.

## Verifikasi lokal dan batas acceptance

Fixture memakai PostgreSQL disposable loopback, source SQL asli, policy/workforce/episode commands dan data sintetis. Suite menguji stock binding/receipt/adjustment; Rx/FEFO/source billing; MAR/custody; obat terkendali; discharge/invoice; authenticated browser desktop/mobile; dua backend PID berbeda yang benar-benar menunggu Lock untuk dispensing, retur, klaim opening antar tenant dan discharge. Jumlah/skor final dicatat di STATUS-PROYEK.md setelah seluruh suite selesai.

Cluster/record disposable ditutup dan dihapus di finally. Output JSON/PNG milik subtask ini dihapus setelah bukti minimal diringkas; kode test/fixture tetap untuk regresi. Cache binary runtime bukan database/record; penghapusan direktori runtime sebelumnya ditolak automatic approval review dan tidak dipaksakan.

Belum menutup kebutuhan lain pada matriks 44: master obat/ownership alergi legacy dan lifecycle formulary lengkap, valuasi/COGS obat, formulir/indikator unit lain, konfigurasi source downstream, episode/revisit terpadu lintas unit, penjamin room-price overrides, serta integrasi/non-RS/Tech yang belum diterima. Pengujian lokal tidak menjadi persetujuan klinis tenant nyata atau aktivasi vendor/produksi.
