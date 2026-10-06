# Operasional RS — kontrak implementasi 6 Oktober 2026

OWNED_BY: generic

## Implikasi IP & Kepatuhan

Konfigurasi tenant menentukan unit, ruang, kelas, petugas dan SOP. Fixture seluruhnya sintetis. Tidak mengubah kunci katalog, menyalin data AVA, atau menghubungkan vendor/DB produksi. Penambahan skema menunggu checkpoint manusia sesuai AGENTS.md §1.4 dan §2. Git push tidak dianggap persetujuan menjalankan migrasi produksi. Alur klinis memerlukan validasi pengguna RS; simulator lokal bukan validasi klinis.

## Rencana — tiap subtask maksimal satu jam

- [ ] Inventaris menu, RPC dan skema rawat inap yang sudah ada.
- [ ] Tambahkan peta menu RS dengan status jujur untuk fungsi belum tersedia.
- [ ] Setujui kontrak skema operasional baru sebelum implementasi.
- [ ] Reservasi dan antrean bed: buat, alokasikan, batalkan, kedaluwarsa; cegah dua alokasi aktif.
- [ ] Housekeeping: task setelah pulang, penugasan, mulai, selesai, verifikasi; bed tersedia setelah verifikasi.
- [ ] Nurse station: penugasan pasien, tugas, handover pengirim/penerima, pekerjaan tertunda.
- [ ] Discharge: checklist per peran, hambatan, persetujuan klinis, pemulangan lewat RPC yang ada.
- [ ] Kendali alur pasien dan indikator dengan data aktual, pagination dan error eksplisit.
- [ ] Operasional IGD: tracking zona dan keputusan layanan, terhubung ke triase/admisi.
- [ ] Billing: rekonsiliasi sumber biaya, idempotensi posting, deposit dan penjamin.
- [ ] Operasi/anestesi: booking kapasitas, persiapan, checklist, recovery.
- [ ] CSSD: siklus set/batch, release, distribusi dan traceability pasien.
- [ ] Gizi: diet, puasa, alergi, produksi dan distribusi porsi.
- [ ] Transfusi: permintaan, stok komponen, verifikasi, pemberian dan reaksi.
- [ ] PPI: isolasi, surveilans, audit dan tindak lanjut.
- [ ] Farmasi bangsal: dispensing, unit dose, retur dan rekonsiliasi MAR.
- [ ] Transport: permintaan, dispatch, pengambilan dan penyelesaian.
- [ ] Unit khusus: ICU/neonatal, persalinan, hemodialisis/kemoterapi sesuai aktivasi tenant.
- [ ] Pendukung: linen, fasilitas/utilitas dan serah terima jenazah.
- [ ] Uji setiap transisi sah/tidak sah, tenant/role, retry, konkurensi, rollback dan empty/error state.
- [ ] Simulasikan alur hulu–hilir, catat log, jalankan gate repo, commit dan push perubahan tugas ini.

## Kontrak skema untuk checkpoint

Tambahkan tabel operasional tenant-scoped untuk reservasi bed, tugas layanan, penugasan perawat, handover, rencana pulang dan item checklist. Referensi ke pasien/admisi/bed memakai ID existing; jangan membuat identitas pasien kedua. Setiap mutasi lewat RPC transactional dengan pemeriksaan role/tenant, transisi status dan audit aktor/waktu. Gunakan idempotency key untuk permintaan yang bisa diulang. Modul unit RS selanjutnya memakai kontrak khusus masing-masing, bukan satu kolom JSON bebas untuk keputusan klinis.

Migrasi harus disertai preflight, runbook dan rollback; diuji database kosong serta upgrade instalasi lama. UI berhenti dengan error jelas jika RPC belum tersedia. Tidak menyimpan transaksi klinis di localStorage sebagai pengganti backend.

## Skenario penerimaan utama

Pasien sintetis ditriase → permintaan bed → reservasi → admisi → penugasan perawat → order/dispensing/pemberian → handover → checklist pulang → rekonsiliasi biaya → pemulangan → tugas housekeeping → verifikasi bersih → bed dapat direservasi kembali. Coba dua pasien memperebutkan satu bed, tenant berbeda, role tidak berhak, retry identik, checklist belum selesai dan gangguan backend. Semua harus menolak atau mempertahankan hasil konsisten tanpa transaksi parsial.

## Batas status

Menu baru berstatus `belum` sampai implementasi dan simulasi terkait lulus. Keberadaan menu, halaman, atau SQL saja tidak membuktikan alur selesai. Modul klinis khusus belum dapat disebut siap produksi sebelum UAT RS.
