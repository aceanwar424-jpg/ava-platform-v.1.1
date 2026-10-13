# Identitas pasien dan penggabungan 0112

OWNED_BY: generic. Menjalankan keputusan pemilik 1A/2A dengan persetujuan skema operasional lokal. Tidak diterapkan ke produksi.

Menu cfg-patient dan his-mpi memakai workflow yang sama. Family Registry tetap pada menu family; cfg-patient-reference existing tidak diubah. Status sementara disimpan dalam sidecar; master person IDs/identifier join tetap utuh. Identitas definitif baru memerlukan nama, tanggal lahir dan sex eksplisit. Identitas sementara tidak memerlukan tanggal lahir rekaan.

Kunjungan ditautkan eksplisit oleh petugas berwenang dengan bukti pencocokan; snapshot sumber dan MR lama dipertahankan. Tidak ada inferensi hubungan dari backfill, nama atau nomor MR. Satu encounter tidak dapat ditimpa identitasnya melalui action link. Koreksi tautan yang keliru membutuhkan workflow lanjutan, tidak ditangani dengan menghapus riwayat.

Pengajuan duplicate/identified memuat dua root aktif, bukti, alasan dan snapshot person/identifier/contact/consent. Identified khusus sumber sementara ke tujuan definitif. Reviewer berbeda harus memverifikasi identitas dan mencatat review consent/alergi/penjamin. Perubahan sumber setelah pengajuan menolak approval; pengajuan dapat ditolak dan dibuat ulang. Lock master NOWAIT menolak review saat penulisan sumber sedang berlangsung; retry setelah sumber stabil. Graph mutation per tenant diserialkan, request key identik mengembalikan hasil asli; input/aktor berbeda dengan key sama ditolak.

Penggabungan membuat alias dan log, tanpa memindahkan atau menghapus person, encounter, clinical signed record, consent, allergy, invoice atau claim. Root resolver dapat mengikuti rantai alias. Episode board menampilkan identitas utama tambahan untuk encounter yang sudah ditautkan dan diizinkan; snapshot clinical asli tetap digunakan. Tidak otomatis memberikan consent atau menerapkan manfaat penjamin dari identitas tujuan.

UI mempertahankan tampilan demografi, identifier/kontak sumber, kandidat duplikat nama/tanggal lahir atau NIK pada halaman yang tampil. Kandidat bukan penggabungan otomatis. Paging 50; search nama/nomor identitas internal, bukan pencarian menyeluruh seluruh identifier. Seluruh response/form/cache dibatasi konteks tenant/petugas/halaman. Helper simulasi merge lama kini menolak klaim sukses tanpa transaksi sumber.

Runner lokal: scripts/uji/test_patient_identity_source.cjs dan scripts/uji/test_patient_identity_browser.cjs dengan RS_TEST_RUNTIME disposable. Tidak menulis hasil/screenshot baru. Source fixture memuat actual MPI DDL, actual episode/governance/workforce dan profile locks. Auth bridge menguji SQL authenticated session, bukan sertifikasi JWT produksi.

## Batas acceptance

Penautan/merge lokal bukan penyelesaian seluruh cfg-patient: koreksi link, lifecycle consent/identifier yang direview, rekonsiliasi ownership alergi/penjamin dan penggunaan identity di seluruh legacy downstream masih terbuka. Tidak menawarkan unmerge graph pada tahap ini. Tidak menandai 42 menu selesai berdasarkan package ini.

## Implikasi IP & Kepatuhan

Data uji sintetis dan source histories immutable. Tidak mengubah kunci katalog/master IDs atau menganggap consent telah diberikan melalui merge. Review klinis serta privileges existing tetap wajib. Tidak ada data pasien nyata, integrasi vendor atau deployment produksi.
