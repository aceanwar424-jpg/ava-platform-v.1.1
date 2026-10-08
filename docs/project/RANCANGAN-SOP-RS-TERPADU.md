# Rancangan operasional RS terpadu

Versi 0.1 — 8 Oktober 2026 · OWNED_BY: generic · Status: untuk review pemilik proses.

## Implikasi IP & Kepatuhan

Tidak memakai SOP/data milik RS tertentu, identitas pasien nyata, tarif riil atau kredensial. Semua kebijakan dapat dikonfigurasi per tenant. Dokumen ini merupakan kontrak operasional dan kebutuhan aplikasi, bukan pedoman terapi, SOP klinis yang disahkan, atau bukti kepatuhan regulasi/akreditasi. Dosis, ambang klinis, interval monitoring, triase klinis, kecocokan transfusi dan release steril harus mengikuti aturan yang disahkan pemilik profesi. Tidak mengaktifkan integrasi atau migrasi produksi.

## 1. Model operasi bersama

Satu pasien memiliki identitas master existing dan dapat memiliki banyak encounter. Satu encounter memiliki kunjungan/episode serta perpindahan lokasi, permintaan layanan, pelaksanaan, biaya dan keputusan keluar. Kunjungan ulang setelah penutupan membuat encounter baru; koreksi encounter lama melalui amendment yang diaudit.

**Pintu masuk:** IGD, poliklinik, admisi terencana, rujukan masuk. **Jalur internal:** observasi, rawat inap, OK/recovery, ICU/neonatal, persalinan, HD/kemoterapi/day care, penunjang. **Pintu keluar:** pulang, rujuk, meninggal, atau keluar atas permintaan pasien sesuai proses persetujuan RS.

Alur umum: registrasi → asesmen oleh profesi berwenang → keputusan layanan → reservasi sumber daya → pelayanan dan dokumentasi → rekonsiliasi → keputusan keluar → serah terima → penutupan encounter → pemulihan sumber daya. Tindakan emergensi mengikuti otorisasi klinis RS; sistem tidak menjadikan kelengkapan finance sebagai syarat pertolongan.

Pisahkan status berikut agar satu tombol tidak dianggap menyelesaikan semuanya:

| Objek | Status yang diusulkan |
|---|---|
| Encounter | registered, active, exit_planned, departed, closed; cancelled hanya sebelum layanan aktif |
| Lokasi pasien | lokasi aktual serta riwayat effective_at; perpindahan menunggu accepted oleh unit penerima |
| Reservasi | requested, held, confirmed, consumed, expired, cancelled |
| Bed/sumber daya | available, held, occupied, cleaning, verification_pending, maintenance, blocked |
| Permintaan layanan | requested, reviewed, scheduled, in_progress, performed, verified, cancelled |
| Handover | drafted, sent, accepted, returned |
| Keluar | planned, clinical_ready, logistics_ready, departed; hambatan finance dicatat terpisah |
| Rekonsiliasi finance | open, reviewed, settled atau receivable; status settled tidak berarti pasien sudah keluar |

Penyesuaian terhadap enum/RPC existing dilakukan saat implementasi, tanpa mengganti sejarah status secara diam-diam. Satu bed tidak boleh memiliki dua occupancy/reservasi eksklusif aktif. Patient transfer menutup occupancy asal dan membuka tujuan secara atomik setelah penerimaan; konflik menggagalkan seluruh transaksi. Bed asal masuk cleaning sesuai jenis penggunaan, bukan langsung available.

## 2. Identitas, peran dan pengecualian

**Keputusan pengguna:** matriks kewenangan generik dikonfigurasi per RS/tenant; petugas dan batas kewenangan ditetapkan saat setup. Cakupan mencakup role, persetujuan dan pemisahan pelaksana–verifikator. Admin sistem tidak dapat menggantikan pengesahan klinis. Rincian aksi yang memerlukan dua petugas berbeda, batas nominal finance, cakupan unit dan privilege profesi belum ditetapkan; tidak diasumsikan otomatis dari role admin. Pengaturan wajib yang belum disahkan tetap tidak aktif. Pemeriksaan akses dan separation of duties dilakukan server, dengan versi kebijakan dan audit perubahan.

Semua transaksi tenant-scoped dan diperiksa server. Pengguna lintas unit hanya melihat lingkup layanan yang diberikan. Role administrator tidak menggantikan profesi dalam verifikasi klinis.

| Peran | Wewenang utama |
|---|---|
| Admission/bed manager | Registrasi administratif, reservasi, alokasi sesuai keputusan layanan |
| Dokter/DPJP | Asesmen, order, keputusan layanan/keluar, pengesahan klinis sesuai privilege |
| Perawat/bidan | Pelaksanaan sesuai kewenangan, observasi, handover dan checklist profesi |
| Farmasi | Verifikasi resep sesuai kebijakan, dispensing/retur, rekonsiliasi obat |
| Analis/radiografer/unit penunjang | Pelaksanaan dan validasi sesuai role; tidak menutup keputusan DPJP |
| Finance | Tarif, posting, deposit, penjamin, piutang, refund dan rekonsiliasi |
| Petugas layanan pendukung | Tugas CSSD/gizi/linen/transport/housekeeping/fasilitas sesuai penugasan |
| Verifikator/supervisor | Release/verifikasi sesuai domain; pemisahan pelaksana dan pemeriksa jika disyaratkan SOP |
| Mutu/PPI | Surveilans, insiden, CAPA dan audit; akses klinis minimum yang diperlukan |

Override bukan tombol universal: hanya rule yang dinyatakan dapat di-override, dengan alasan, pemberi otorisasi, waktu dan audit. Larangan lintas tenant, privilege tidak sah dan stok negatif tidak bisa dilewati. Kasus emergensi mencatat exception dan tindak lanjut; syarat operasionalnya harus disahkan RS.

## 3. Rancangan formulir bersama

**Keputusan pengguna:** formulir klinis IGD, rawat inap, OK, ICU, persalinan, transfusi dan day care berupa template generik konfigurabel per RS/tenant. Pengisian dan pengesahan mengikuti profesi serta privilege yang berlaku. Penanggung jawab klinis wajib mereview sebelum aktivasi. Persetujuan ini mengizinkan penyusunan template, bukan pengesahan isi klinis atau protokol terapi.

Lifecycle template yang diusulkan: draft → in_review → approved → active → retired. Aktivasi hanya untuk versi yang telah disahkan role klinis berwenang; perubahan isi setelah pengesahan membuat versi baru dan memerlukan review ulang. Catatan pasien menyimpan versi formulir yang digunakan. Simulasi menggunakan template dan data sintetis di lingkungan uji. Field wajib, parameter/satuan, interval observasi, ambang eskalasi dan checklist khusus unit belum dianggap disetujui sampai review domain selesai.

Semua formulir memiliki tenant, encounter/episode, unit, versi, pembuat, waktu kejadian, waktu pencatatan, status dan jejak perubahan. Referensi order, item, invoice, batch dan petugas memakai ID sumber existing, bukan teks bebas sebagai satu-satunya hubungan. Koreksi membuat amendment, tidak menghapus bukti.

| Formulir | Isi minimum |
|---|---|
| Registrasi/admission | Pintu masuk, sumber rujukan, identitas existing, kontak, penjamin, tujuan, kebutuhan aksesibilitas |
| Keputusan layanan | Penanggung jawab klinis, tujuan/unit, prioritas yang disahkan, alasan dan waktu |
| Reservasi/transfer | Sumber/tujuan, kelas, kebutuhan fasilitas, rentang waktu, penanggung jawab, alasan, penerimaan |
| Order/pelaksanaan | Jenis layanan, order sumber, pelaksana, waktu, hasil/bukti, verifikator, penggunaan item |
| Handover | Pengirim/penerima, kondisi dan kebutuhan yang dicatat profesi, tugas/hasil tertunda, obat/alergi yang relevan |
| Rencana keluar | Keputusan dokter, instruksi/follow-up, rekonsiliasi obat, dokumen, tujuan, transport, hambatan |
| Housekeeping | Bed/lokasi, jenis pekerjaan, petugas, mulai/selesai, checklist, pemeriksa, release |
| Exception/insiden | Objek sumber, kategori, dampak, tindakan awal, pemilik, tenggat dan tindak lanjut |

Identitas darurat yang belum terverifikasi mengikuti kebijakan temporary identity RS; penggabungan master tidak boleh dilakukan otomatis. Proses deduplikasi/merge memerlukan aturan pemilik master.

## 4. Billing dan penjamin — usulan untuk review

**Keputusan pengguna — deposit:** opsi 4, konfigurabel per RS/tenant, kelas kamar dan penjamin, termasuk pengecualian. Pilihan konfigurasi dapat berupa nominal tetap, persentase estimasi, atau tanpa deposit. Belum ada nilai/default, waktu penagihan, aturan penambahan deposit, dasar estimasi, prioritas aturan maupun role pemberi pengecualian yang disahkan. Deposit tetap ledger terpisah dengan alokasi ke invoice dan riwayat; keputusan ini tidak mengizinkan deposit menjadi penghambat pertolongan emergensi.

**Keputusan pengguna — 8 Oktober 2026:** metode biaya kamar dapat dikonfigurasi per RS/tenant dan kelas kamar (pilihan 4). Keputusan ini menyetujui fleksibilitas konfigurasi, belum menentukan tarif atau metode default. Konfigurasi memiliki versi dan tanggal efektif; transaksi menyimpan versi yang digunakan. Pilihan metode: hari kalender dengan cutoff, periode 24 jam sejak masuk, atau per jam. Pembulatan, minimum charge, perpindahan kelas dan pengaruh perubahan tarif harus dinyatakan eksplisit sebelum aktivasi. Perubahan konfigurasi tidak menghitung ulang tagihan historis secara otomatis.

Biaya berasal dari event layanan terverifikasi, pemakaian item serta okupansi; masing-masing mempunyai source_id, versi tarif dan kunci idempotensi. Retry tidak menggandakan tagihan. Pembatalan/koreksi membuat reversal atau adjustment dengan referensi asli. Jangan menghitung refund dengan menghapus ledger.

| Keputusan | Usulan desain | Belum diputuskan |
|---|---|---|
| Kamar | Tarif berdasarkan periode occupancy dan kelas aktual, dengan snapshot versi | Harian/jam, cutoff, pembulatan, minimum, hari masuk/keluar |
| Pindah kelas | Simpan segmen waktu per kelas; hitung menurut kebijakan tenant | Prorata atau tarif harian tertentu |
| Deposit | Ledger terpisah, dialokasikan ke invoice; saldo tidak menjadi pendapatan otomatis | Minimum, kapan wajib, pengecualian |
| Refund | Berdasarkan saldo sah, persetujuan finance, bukti pembayaran dan reversal | Batas otorisasi, metode dan tenggat |
| Penjamin | Pisahkan patient share, insurer share, approval dan piutang | Kontrak, plafon, exclusions, dokumen dan SLA |
| Paket | Mapping layanan yang termasuk/tidak termasuk, versi dan tanggal efektif | Komponen serta aturan kelebihan/penggantian |
| Pemulangan | Keputusan klinis dan keberangkatan dicatat terpisah dari saldo/piutang | Prosedur eskalasi hambatan administratif |

Tidak ada angka tarif/deposit atau kebijakan cutoff yang dianggap disetujui. Selisih billed/paid, deposit belum dialokasikan, layanan belum diposting dan penjamin belum pasti menjadi daftar rekonsiliasi. Grouper/BPJS tetap proses resmi manual sampai adapter resmi diotorisasi dan diuji.

## 5. Booking dan kapasitas

### Keputusan review biaya pindah kelas

Pengguna memilih opsi 4: aturan biaya saat pindah kelas dapat dikonfigurasi per RS/tenant dan penjamin. Metode yang dapat disediakan meliputi prorata durasi per kelas, kelas tertinggi dalam hari tagihan, atau kelas pada cutoff. Belum ada metode default yang disetujui. Urutan prioritas aturan RS/kontrak penjamin, batas effective date, pembulatan dan alokasi biaya pasien versus penjamin harus eksplisit. Biaya yang ditagihkan tidak mengubah kelas/riwayat occupancy aktual; koreksi historis melalui adjustment yang diaudit.

Gunakan interval mulai–akhir dengan timezone tenant, kebutuhan ruang/bed/mesin/tim, durasi persiapan dan pemulihan. Konflik diperiksa server dalam transaksi, termasuk blocked/maintenance. Reservasi memiliki expiry; expiry tidak membatalkan pelayanan yang sudah dimulai. Overcapacity hanya untuk sumber yang kebijakannya mengizinkan, dengan persetujuan yang tercatat; tidak melakukan double occupancy bed.

Unit penerima menyatakan kebutuhan fasilitas, bukan sistem menyimpulkan kelayakan klinis. Perubahan jadwal memberi riwayat serta tugas pemberitahuan. Tidak mengirim pesan eksternal tanpa kanal dan otorisasi yang disepakati.

## 6. Unit khusus dan pendukung

| Unit | Alur dan catatan yang diusulkan | Keputusan pemilik domain |
|---|---|---|
| IGD | Arrival → triase profesi → zona/asesmen → tindakan/observasi → keputusan keluar/transfer; waktu per tahap | Skala triase, reassessment, target waktu, otorisasi |
| OK/anestesi | Order → booking ruang/tim → persiapan → checklist profesi → tindakan → recovery → handover; item terpakai terhubung | Checklist, privilege, kesiapan dan kriteria transfer |
| ICU/neonatal | Admisi unit, flowsheet bertimestamp, input/output dan task tertunda; sumber pengukuran diketahui | Parameter, satuan, interval dan aturan eskalasi; neonatal punya identitas sendiri |
| Persalinan | Episode ibu, observasi profesi, catatan persalinan, episode bayi dan hubungan ibu–bayi, handover | Formulir/partograf, aturan identifikasi dan pengesahan |
| HD/kemoterapi/day care | Order dan protokol yang disahkan → booking → pemeriksaan kesiapan → pelaksanaan/sesi → monitoring → keputusan selesai | Protokol, kelayakan dan verifikasi profesi; tidak menghasilkan dosis otomatis |
| Farmasi bangsal | Order → verifikasi → dispensing/unit dose → penerimaan → pencatatan pemberian → retur/waste → rekonsiliasi | Formularium, substitusi, otorisasi, aturan obat khusus |
| Transfusi | Permintaan → review → reservasi komponen → verifikasi sumber/identitas → issue → pemberian oleh profesi → monitoring/reaksi → penutupan | Kompatibilitas, traceability, syarat release dan protokol reaksi yang disahkan |
| CSSD | Terima set → proses per batch → inspeksi/release → distribusi → pemakaian → kembali; gagal release dikarantina | Checklist, kriteria release, expiry dan integritas set |
| Gizi | Order diet/alergi/puasa → cutoff produksi → porsi per unit → distribusi → perubahan/retur | Diet, otorisasi, cutoff dan penanganan perubahan |
| Linen | Distribusi → penggunaan → kembali → proses → inspeksi → distribusi; loss/waste tercatat | Satuan, kategori, proses dan stock minimum |
| Transport | Permintaan → assignment → pickup/handover → perjalanan → penerimaan → selesai | Prioritas, kebutuhan pendamping/peralatan dan dispatch |
| PPI | Status isolasi yang disahkan → tugas → observasi/surveilans → insiden → tindak lanjut | Definisi surveilans, aturan isolasi, pelaporan dan hak akses |
| Fasilitas | Preventive schedule → work order → pekerjaan → verifikasi → release; resource diblokir saat tidak layak | Frekuensi, checklist, kewenangan release |
| Mortuary | Keputusan klinis terdokumentasi → penerimaan → identifikasi → penyimpanan → otorisasi serah terima → selesai | Dokumen, verifikasi penerima, retention dan kewenangan |

Ledger stok mengikuti item, satuan, batch/serial jika relevan, expiry, lokasi, custody dan movement_id. Receive/issue/return/waste/quarantine/release/adjustment berbeda jenis transaksi. Stok dan status release berasal dari ledger, bukan angka yang diedit langsung. Referensi pasien hanya pada penggunaan yang memerlukannya. Unit serta konversi dan perubahan master perlu review tersendiri.

## 7. SDM, bukti dan integrasi

**Keputusan pengguna — integrasi:** dokumentasi API dan akses sandbox eksternal HIS–LIS, BPJS serta PACS belum tersedia (opsi 1). Siapkan kontrak adapter dan simulator lokal dengan data sintetis; koneksi eksternal tetap nonaktif. Integrasi HIS–LIS internal existing dipertahankan sesuai implementasinya, tanpa dianggap telah memenuhi kontrak vendor yang belum tersedia. Simulator tidak menghasilkan SEP resmi, klaim penerimaan vendor atau status interoperabilitas produksi. Setiap respons/bukti simulasi memiliki penanda lingkungan uji. Adapter eksternal gagal eksplisit saat belum dikonfigurasi; simulator hanya aktif di lingkungan uji dan tidak menggantikan adapter nyata secara diam-diam. Persetujuan koneksi eksternal, dokumentasi resmi, pemetaan tenant, secret server dan uji sandbox diperlukan sebelum aktivasi.

Penugasan mempertimbangkan unit, shift, kompetensi/privilege dan status izin yang dikonfigurasi. Cuti, substitusi dan perubahan shift tercatat dengan pemberi persetujuan. Timekeeping lock, lembur, ambang beban dan jam kerja belum diputuskan; tidak dipakai otomatis untuk payroll.

Evidence register memuat jenis dokumen, pemilik, versi, tanggal berlaku/expiry, objek terkait, review dan tindak lanjut. Indikator hanya dihitung dari event lengkap dengan definisi/periodenya; event kurang menghasilkan peringatan kualitas data, bukan angka contoh. BOR/ALOS/BTO/TOI membutuhkan definisi denominator, periode dan kebijakan bed yang ditetapkan RS.

Integrasi mempunyai outbox/inbox, correlation_id, idempotency key, attempt, last_error dan reconciliation state. Timeout tidak otomatis berarti gagal atau sukses; cek acknowledgement sumber. Retry terkontrol dan tidak menduplikasi transaksi. HIS–LIS, PACS dan BPJS masing-masing memerlukan kontrak terpisah. Secret disimpan server; tidak browser.

Tech Sprint adalah fasilitas tim pengembangan terpisah dari encounter RS: backlog → planning → pelaksanaan → review. Usulan awal capacity jam tersedia per anggota dan estimasi effort; story point/velocity hanya jika tim memilih metode itu. Kebutuhan, role dan aturan carry-over belum disetujui.

**Keputusan pengguna — Tech Sprint:** opsi 2, ikut dituntaskan menggunakan story point dan velocity. Story point merupakan estimasi relatif tim, bukan konversi otomatis ke jam atau produktivitas individu. Velocity dihitung dari item yang memenuhi Definition of Done pada sprint tertutup; tanpa riwayat tampil belum tersedia. Panjang sprint, skala estimasi, jendela rata-rata velocity, role penutupan dan aturan carry-over masih perlu ditentukan. Item yang belum selesai tidak dihitung sebagai selesai; perpindahan sprint menjaga riwayat dan tidak menggandakan poin historis. Angka perkiraan tidak ditampilkan sebagai realisasi.

## 8. Simulasi dan acceptance

### Keputusan konfigurasi Tech Sprint

Pengguna memilih opsi 1: konfigurabel per tim dalam tenant. Durasi sprint, skala story point, Definition of Done, jendela perhitungan velocity dan aturan carry-over ditetapkan saat setup. Tidak mengaktifkan default dua minggu/skala Fibonacci/rata-rata tiga sprint tanpa keputusan tim. Sprint menyimpan versi pengaturan; perubahan konfigurasi tidak mengubah metrik sprint tertutup secara diam-diam. Story point lintas tim tidak digabung menjadi pembanding produktivitas. Riwayat perpindahan item dan perubahan estimasi diaudit. Role planning/penutupan serta syarat konfigurasi wajib ditentukan sebelum sprint aktif.

Data seluruhnya sintetis. Uji database sebenarnya di lingkungan lokal/test, bukan hanya respons mock, serta UI desktop/mobile. Konkurensi diuji menggunakan beberapa sesi PostgreSQL. Tiap modul wajib melewati tenant/role, transisi tidak sah, retry, error, rollback dan audit.

| Skenario | Hasil wajib |
|---|---|
| Poliklinik → rawat inap → pindah kelas → pulang | Identitas/encounter terhubung, okupansi berurutan, handover diterima, biaya per segmen, checklist profesi, bed tersedia setelah release |
| IGD → ICU → OK/recovery → bangsal | Jejak perpindahan lengkap; sumber daya dan profesi sah; tugas tertunda terbawa |
| Admisi langsung → persalinan → ibu/bayi keluar berbeda waktu | Episode terpisah dan hubungan sah; satu penutupan tidak menutup episode lain |
| Day care → selesai atau konversi rawat inap | Booking dan catatan sesi tetap terlacak; transisi tidak menggandakan biaya |
| Rujuk/meninggal/keluar atas permintaan | Keputusan/dokumen profesi, custody dan penerimaan sesuai jenis keluar |
| Dua permintaan bed/slot bersamaan | Hanya satu alokasi eksklusif berhasil, tanpa occupancy ganda |
| Dispensing/retur dan CSSD/transfusi | Movement sumber terlacak; stok negatif/release tidak sah ditolak |
| Billing retry, reversal, deposit/refund, penjamin | Satu source posting; ledger seimbang menurut aturan yang disahkan; tidak ada saldo hilang |
| Integrasi timeout/duplikat/out-of-order | Status tidak mengaku sukses; ack/retry/reconciliation tidak menggandakan transaksi |
| Role/lintas tenant/amendment | Akses ditolak server; profesi tidak bisa digantikan admin; histori dipertahankan |

Status menu menjadi **ada** hanya setelah batas fungsi disepakati, implementasi sumber nyata dan uji lulus. Unit klinis juga membutuhkan acceptance pemilik profesi. Simulasi lokal tidak menggantikan UAT atau deployment verification.

## 9. Keputusan review dan pelaksanaan

**Keputusan pengguna final 1–9:** semua pilihan A disetujui. Gunakan master pasien/encounter/order/stok/billing existing; gate draft-review-approve-activate; ketentuan kontrak penjamin mengungguli aturan umum hanya pada bagian eksplisit; satu encounter dengan episode unit (bayi/kunjungan ulang tertutup terpisah); ledger terpadu dengan detail domain; koreksi tanpa menghapus transaksi asli; preset sintetis khusus test; pengguna review operasional dan profesi review klinis; deliverable implementasi/migrasi repo/uji lokal/dokumentasi/commit/push. Deployment produksi dan koneksi eksternal tetap terpisah. Ini tidak mengesahkan parameter klinis maupun nilai tenant tertentu.

### Keputusan pengguna: konfigurasi administratif

Pengguna menyetujui seluruh aturan administratif dapat dikonfigurasi per RS/tenant: kamar, perpindahan kelas, deposit/pengecualian, refund, paket, penjamin, booking, kapasitas dan kewenangan override. Setiap aturan memiliki versi, tanggal berlaku, persetujuan dan audit; nilai serta role berwenang ditetapkan saat setup RS. Persetujuan ini adalah keputusan desain fleksibilitas konfigurasi, bukan persetujuan tarif, batas kewenangan atau aturan default tertentu.

Setup harus menunjukkan konflik dan prioritas aturan tenant/kelas/kontrak penjamin secara eksplisit. Aturan wajib yang belum lengkap tidak diaktifkan atau diganti nilai asumsi secara diam-diam. Persetujuan klinis, larangan lintas tenant, stok negatif dan occupancy bed ganda tetap tidak dapat dilewati melalui override administratif. Riwayat transaksi menyimpan versi kebijakan; perubahan aturan tidak menghitung ulang transaksi lama tanpa adjustment sah. Integrasi eksternal dan migrasi produksi tetap memerlukan checkpoint terpisah.

Review awal: (1) setujui model encounter/transfer/keluar dan pemisahan klinis–finance; (2) pilih kebijakan kamar dan deposit; (3) tetapkan role persetujuan/override; (4) tunjuk pemilik review profesi; (5) sepakati unit/sumber daya yang aktif. Keputusan tarif/master, SOP klinis dan akses vendor tetap dicatat per tenant. Persetujuan rancangan tidak dianggap persetujuan migrasi produksi.

Urutan implementasi mencakup semua unit: fondasi shared → bed/transfer/keluar → transaksi layanan/stok/billing → booking dan unit khusus → indikator/bukti/SDM → integrasi berizin dan UAT. Setiap work item dipecah menjadi subtask maksimum satu jam: inventaris sumber; kontrak; implementasi; simulasi negatif/positif; UI; bukti. Gap operasional tidak ditutup hanya dengan checklist generik.

Rujukan internal: [audit menu](AUDIT-SELURUH-MENU-2026-10-06.md), [rencana operasional RS](RENCANA-OPERASIONAL-RS.md), [status proyek](STATUS-PROYEK.md).
