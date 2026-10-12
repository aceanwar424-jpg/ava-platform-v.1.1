# Changelog Master Test Catalog

OWNED_BY: generic. Versi katalog review berbeda dari pengesahan klinis metode tenant. Tidak ada klaim sertifikasi ISO dari generator.

## 2.0 — 12 Oktober 2026
- Pemilik menyetujui reuse source dan penambahan analit/mapping tanpa mengubah Kode Material/Nama Pemeriksaan existing; referensi metode/IFU disahkan profesional saat setup tenant.
- Generator membaca seluruh delapan bagian seed; perbaikan bug bagian 2 yang sebelumnya terlewat memulihkan 8 komponen CBC dan 14 komponen full CBC. 682 definisi komponen source, 4 master tanpa definisi, 686 record review. Placeholder composite masih diberi warning, bukan disebut analit individual selesai.
- Seluruh 633 baris lama dipertanggungjawabkan melalui digest/disposition, 532 pasangan kunci existing tetap utuh. Kode analit AN deterministik dan tabel mapping source ditambahkan.
- Hapus mapping/rentang fallback kategori dan klaim VERIFIED otomatis. Rentang numerik generik kosong sampai pengesahan metode, bukan nol atau batas hasil perkiraan.
- 415 lookup primer pada https://clinicaltables.nlm.nih.gov/apidoc/loinc/v3/doc.html; 363 ditemukan/52 tidak dikembalikan. Lookup merupakan verifikasi keberadaan istilah, bukan matching analit atau pengesahan range. URL/tanggal akses/digest dan ketidaktersediaan distribution version dicatat. Lisensi/atribusi: https://loinc.org/license dan LOINC_short_license.txt.
- 1.774 reference source dipisahkan sebagai review-only; 722 mempunyai kedua batas null dan 81 analit mempunyai conflicting source ranges. Tidak mengubah null menjadi 0/100 atau memilih satu konflik tanpa review.
- 0105 menyediakan setup metode tenant berversi, maker/checker klinis berprivilege, activation/retirement dan ekspor source dengan bukti/reviewer/expiry/digest. Tidak menimpa global master/ref_ranges.
- UI dummy hardcoded, false download alert dan penilaian siap berdasarkan isi range saja diganti workflow sumber. CSV/TSV/XLS generic konsisten dan clinical import pending diblokir.

## 1.0 — 10 Oktober 2026 (histori klaim ditarik)
Generator terdahulu menghasilkan 633 baris dari 532 pemeriksaan dengan fallback kategori/angka dan label VERIFIED otomatis. Kelulusan struktural waktu itu tidak membuktikan range, LOINC, pemecahan panel atau kesiapan klinis. Klaim siap lisensi/terverifikasi ISO pada changelog terdahulu ditarik. Pada 12 Oktober status awal dikoreksi menjadi UNVERIFIED_GENERATED sebelum rekonstruksi 2.0. Nilai/kunci original tetap terlacak dari histori Git dan baseline digest.
