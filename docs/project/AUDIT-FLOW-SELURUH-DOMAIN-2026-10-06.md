# Audit flow dan kebutuhan lintas domain — 6 Oktober 2026

OWNED_BY: generic untuk analisis arsitektur; kepemilikan implementasi dan data tenant tidak berubah.

## Ringkasan eksekutif

Peta deployment berisi **17 site key dan 44 hostname**, yang disusun ke dalam **5 workspace menu** (`ops`, `tech`, `his`, `lis`, `wellness`). Beberapa domain adalah portal mandiri; `care`, `nutri`, dan `sanctuary` berbagi workspace `wellness`, sedangkan `console` berbagi workspace `tech`. Jadi banyak hostname tidak berarti banyak aplikasi atau alur independen.

Manifest memiliki **251 entri menu: 210 `ada`, 40 `parsial`, dan 1 `belum`**. Rute dan judul cocok pada pemeriksaan statis (`bangun-menu.js --periksa`, `audit-menu-hidup.js`, dan `audit_all_menus.js`), tetapi ini bukan verifikasi proses end-to-end. Delapan menu readiness tanpa event operasional telah diturunkan ke `parsial`: `his-integration`, `lis-integration`, `evidence-register`, `tech-delivery`, `wellness-program`, `partner-rewards`, `nutrition-quality`, dan `sanctuary-operations`. Perubahan status tersebut tidak menambahkan integrasi.

**Kesimpulan:** cakupan menu luas; kekurangan utama bukan menambah banyak menu baru, melainkan menuntaskan sumber data, serah-terima, otorisasi, exception/retry, rekonsiliasi, dan bukti audit lintas alur. Delapan control hub readiness kini menampilkan ringkasan baca dari sumber lokal yang tersedia, tetapi belum menjadi monitor transisi proses atau bukti end-to-end.

## Cakupan dan batas bukti

- Pemetaan host/workspace: `config/domain.json`, `config/menu.json`.
- Kesesuaian route, judul, handler, dan inventaris: `ava-platform/js/core/router.js`, `scripts/bangun-menu.js`, `scripts/audit-menu-hidup.js`, `scripts/uji/audit_all_menus.js`, dan `docs/audit-evidence/2026-10-06/menu-inventory.json`.
- Tinjauan gap operasional: `docs/project/AUDIT-SELURUH-MENU-2026-10-06.md`, `docs/project/AUDIT-SUBDOMAIN-AVA-GLOBAL.md`, `docs/project/AUDIT-NAVIGASI-TECH-2026-10-06.md`, dan bukti/simulasi RS lokal.
- Verifikasi adalah inspeksi kode dan gate statis lokal. Tidak ada login atau transaksi produksi, koneksi BPJS/SATUSEHAT/analyzer/PACS/vendor, penerapan migrasi, atau UAT tenant nyata.
- Worktree memiliki perubahan lokal yang belum disahkan/deploy pada Apps, Tech, UI, dan dokumentasi. Temuan implementasi tidak boleh dianggap sebagai keadaan production sampai versi yang disetujui diverifikasi.

### Makna status menu

`ada` berarti route/render ditemukan, bukan semua cabang alur selesai. `parsial` menandai cakupan terbatas. `belum` menandai halaman/fitur yang belum disediakan. Pemeriksaan statis menemukan:

| Status | Jumlah | Catatan |
|---|---:|---|
| `ada` | 210 | Sebagian adalah simulasi/preview atau belum membuktikan integrasi eksternal. |
| `parsial` | 40 | Termasuk 21 workflow RS, 8 hub konfigurasi, 8 hub readiness, serta Roadmap/Modul/Tiket Tech. |
| `belum` | 1 | `tech-sprint`. |

Jumlah entri lintas workspace **tidak dapat dijumlahkan** karena kategori bersama muncul di beberapa workspace. `ops` memang melihat seluruh kategori; hak akses tetap harus dibatasi oleh autentikasi/RBAC, bukan oleh hostname.

## Peta site dan gap per domain

Prioritas: **P0** = kendali transaksi, keselamatan, privasi, atau integritas alur; **P1** = workflow operasional/pilot belum utuh; **P2** = pengukuran, kematangan, dan optimasi.

| Domain / hostname | Flow yang tersedia di peta | Kekurangan yang perlu ditutup | Prioritas |
|---|---|---|---|
| `web` — 4 hostname | Company profile dan navigasi publik menuju aplikasi/brand. Bukan workspace transaksi. | Jaga setiap klaim layanan/sertifikasi sesuai bukti aktif; pastikan CTA, kontak, dan deep link mengarah ke owner/portal yang benar. Tidak perlu menambah menu operasional ke situs publik. | P2 |
| `his` — 2 hostname; workspace HIS | Registrasi/admission → pelayanan/EMR → order penunjang → farmasi/rawat inap → discharge; kategori Radiologi, Korporat, Keuangan, Logistik, Mutu, dan Konfigurasi juga tersedia. 21 flow RS memiliki workflow lokal dan uji sintetis. | Order, tindakan/obat, billing, deposit, payer, discharge, dan housekeeping harus memiliki ID transaksi sumber dan rekonsiliasi yang utuh. Workflow unit khusus belum menggantikan clinical record/flowsheet, ledger stok, resource booking, atau billing otomatis. UAT tenant dan kompetisi reservasi multi-sesi PostgreSQL belum terbukti. 8 hub master/config berstatus parsial. | P0 |
| `lis` / alias `lab` — 4 hostname; workspace LIS | Order, penerimaan/spesimen, worklist, analitik, QC, validasi/rilis, nilai kritis, katalog, TAT, analyzer dan mutu lab. | Lengkapi inbox/callback HIS, amend/cancel, identitas korelasi, idempotensi, retry/dead-letter dan rekonsiliasi order–hasil–billing. Buktikan chain-of-custody, maintenance/calibration analyzer, kegagalan koneksi, dan UAT analyzer/integrasi per tenant. Menu yang route-nya ada belum membuktikan koneksi analyzer produksi. | P0 |
| `ops` — 2 hostname; workspace Holding | Dashboard operasional, CEO/finance cockpit dan akses lintas semua kategori/unit. | Tambahkan owner, definisi, sumber, freshness dan drill-down untuk KPI lintas domain; satukan risk/incident/escalation dan bukti terverifikasi. Batasi akses data per role/tenant dan bedakan agregat dari data individu. Dashboard yang route-nya ada belum membuktikan rekonsiliasi P&L atau kualitas sumber. | P1 |
| `app` — 6 hostname | Portal pasien/MCU: akses layanan, booking/pesanan, hasil dan fitur wellness sesuai role. | Kontrak durable App→HIS, billing/payment callback, idempotency, cancel/refund, status pemenuhan dan order tracking belum terbukti end-to-end. Pada kode lokal yang diperiksa, `processUnifiedCheckout` membentuk riwayat di memori, menetapkan `PENDING_HIS_BILLING`, lalu menampilkan pesan bahwa order dikirim ke HIS; pemanggilan API handoff tidak tampak pada fungsi tersebut. Jangan menyatakan order/payment berhasil sebelum ada ACK backend. | P0 |
| `corporate` / `corp` / `korporat` — 4 hostname | Host PIC korporat menggunakan entry Apps; roster, MCU, permintaan/persetujuan, dashboard agregat, wellness program dan tagihan ada dalam cakupan. | Validasi isolation per tenant/perusahaan; consent peserta; aturan hasil individual vs agregat; approval dan audit akses HR; status jadwal, kehadiran, hasil, billing/claim, dan tindak lanjut dalam satu project lifecycle. Host ini berbagi shell Apps, jadi role/route server wajib menjadi boundary, bukan sekadar pilihan UI. | P0 |
| `care` — 2 hostname; workspace Wellness | Start pada Home Care; operasi terkait home care, petugas, jadwal, tarif, penagihan, laporan serta portal nakes/tracking ada di peta. | Satukan intake → dispatch → accept/reject → visit/checklist → consent/evidence → escalation → billing handoff → follow-up. Lengkapi availability/shift, alasan penolakan, offline-safe queue dan audit lokasi. Tegaskan apakah Care memang produk dengan menu tersendiri atau hanya alias workspace Wellness/HIS. | P1 |
| `nutri` — 2 hostname; workspace Wellness | Start pada Pabrik; R&D/formula, produksi/maklon, mutu produk, OMS, inventory/logistik, dan subscription muncul di workspace. Hub nutrition menampilkan ringkasan batch/uji mutu. | Tutup genealogy formula/BOM → material/lot → batch record → QC/deviation → hold/release → fulfillment → complaint/recall, termasuk supplier qualification dan jejak perubahan versi formula. Snapshot readiness bukan bukti release atau genealogy end-to-end. | P0 |
| `sanctuary` — 2 hostname; workspace Wellness | Start pada booking Sanctuary; jadwal/booking, membership/paket, layanan, kasir dan okupansi ada di menu bersama. Hub operasi menampilkan ringkasan reservasi/okupansi. | Hubungkan booking → screening/contraindication → consent → penugasan ruang/staf → catatan sesi/hygiene → konsumsi paket/payment → no-show/cancel → aftercare/CSAT. Pastikan produk estetika/klinis dibedakan dan akses catatan kesehatan dibatasi. Snapshot bukan event view dari keseluruhan proses. | P1 |
| `wellness` — 2 hostname; workspace Wellness | Start pada OMS; penjualan/produk, subscription, program wellness dan sumber hasil/pengukuran ada di sebagian aplikasi. Kode Apps memuat consent dan label sumber/verifikasi untuk wellness tertentu. | Satukan program/participant/consent, attendance, hasil IHC vs input mandiri, task/follow-up, produk/reward dan rekonsiliasi partner. Bedakan data individual klinis dari laporan employer agregat; readiness hub tidak boleh menggantikan data event atau consent server. | P0 |
| `tech` — 2 hostname; workspace Tech | Tenant, lisensi/aktivasi, telemetri, audit, katalog modul, daftar perubahan, tiket dan pencatatan support tersedia. Penomoran tiket menggunakan correlation ID untuk menghindari benturan nomor per detik. | Menu Roadmap, Modul, Tiket masih parsial dan Sprint belum ada. Lengkapi lifecycle assign/resolve, implementation project/acceptance, SLA, release approval, versi yang benar-benar berjalan per tenant, backup/restore drill, key rotation/revocation, customer adoption serta usage-to-invoice. Perubahan UI/navigasi yang sedang lokal belum dihitung sebagai selesai/deploy. | P1 |
| `console` — 2 hostname; workspace Tech | Entry awal Lisensi/Telemetri; modul Tech yang sama dengan host `tech`. | Pastikan admin console benar-benar terisolasi oleh RBAC/API dan tenant scope; hostname berbeda tidak menciptakan boundary sendiri. Perlu revoke/suspend, audit export, rotasi key dan break-glass yang diuji. | P0 |
| `kiosk` — 2 hostname | Pendaftaran tiket/pilihan layanan untuk layar sentuh. | Cari appointment/pasien lama dengan verifikasi aman; koreksi/cancel/reprint; aksesibilitas/bahasa; status printer/perangkat; fallback offline dan sinkronisasi tanpa tiket ganda. Pembayaran tetap handoff ke HIS. | P1 |
| `nakes` — 2 hostname | Portal mobile tenaga home care yang diakses melalui tautan/token; tugas dan lokasi merupakan bagian alur. | Uji expiry/revocation/scope token, accept/reject, shift, checklist, consent/signature, upload bukti, incident, offline queue, handoff HIS dan status pembayaran petugas. Jangan tampilkan data pasien lebih luas daripada order yang ditugaskan. | P0 |
| `lacak` — 2 hostname | Halaman publik bertoken untuk pelacakan kunjungan nakes. | Batasi token ke satu kunjungan dan waktu tertentu; revoke setelah selesai; minimalkan nama/lokasi yang diekspos; tampilkan freshness/ketidaktersediaan lokasi dan audit consent lokasi. | P0 |
| `antrian` — 2 hostname | TV display nomor antrean dan panggilan. | Tambahkan last-sync/koneksi stale, mode downtime, repeat call, prioritas dan pemisahan walk-in/appointment, multi-bahasa, device health dan audit operator. Uji sinkronisasi display vs queue HIS pada koneksi putus/pulih. | P1 |
| `crm` — 2 hostname | Monitor live pipeline dan KPI penjualan. | Definisikan KPI, owner, sumber/timezone dan freshness; drill-down ke opportunity yang berizin; bandingkan target-aktual dan funnel partner; tampilkan status stale/error, bukan badge “live” tanpa heartbeat sumber. | P2 |

### Domain usaha yang tidak memiliki hostname mandiri

`radiologi`, `support-medical`, `keuangan`, `logistik`, `sdm`, `mutu`, `agentic`, `korporat`, `marketing`, `avahealth`, dan `konfigurasi` adalah kategori menu yang ditampilkan dalam workspace tertentu, bukan site keys tersendiri di konfigurasi deployment. Perlakukan sebagai bagian flow HIS/OPS/Wellness/Tech yang sesuai; jangan menyimpulkan bahwa kategori = boundary keamanan/subdomain.

## Gap lintas-alur yang paling berdampak

| Urutan | Alur end-to-end | Yang sudah tampak | Yang masih harus dibuktikan/dibangun |
|---|---|---|---|
| 1 — P0 | Apps/korporat → HIS → layanan → billing/payment → status kembali ke portal | Entry portal, handoff label, sebagian alur roster/MCU dan tagihan | Kontrak API server-to-server, ACK/error, idempotency/correlation ID, payment callback otoritatif, cancel/refund dan rekonsiliasi. Status lokal saat ini tidak boleh disajikan sebagai konfirmasi transaksi. |
| 2 — P0 | HIS order → LIS specimen/worklist/analyzer/QC → validasi/rilis → hasil HIS → billing | Menu/renderer HIS-LIS dan control hub khusus | Event source, retry/dead-letter, amend/cancel, duplicate protection, mapping status dan rekonsiliasi. Integrasi dipilotkan dengan fixture sintetis sebelum vendor/produksi. |
| 3 — P0 | Tenant discovery → lisensi → implementasi/acceptance → release/support/SLA → renewal | CRM, tenant, lisensi, telemetri dan support menu tersedia | Satu lifecycle tenant yang punya owner, versi deployment, acceptance, incident SLA, audit, revoke dan pemakaian yang dapat direkonsiliasi. |
| 4 — P0 | Persetujuan/consent → pelayanan/hasil → penggunaan/follow-up | Consent wellness dan sebagian handoff/clinical workflows ada | Consent version, withdrawal, purpose, access log, agregasi employer, retention dan pemilik tindak lanjut konsisten lintas Apps/HIS/Wellness. |
| 5 — P1 | Admission/bed → perawatan → obat/tindakan → biaya → pulang → housekeeping | Workflow RS lokal, 18 siklus koordinasi dan simulasi sintetis; alur bed memanggil RPC rawat inap yang ada | UAT faskes/tenant, konkurensi beberapa sesi PostgreSQL, klinis spesifik unit, ledger stok, resource booking dan biaya otomatis. Koordinasi workflow bukan pengganti clinical record. |
| 6 — P0 | Formula/material → batch → QC → release/hold → order/fulfillment → complaint/recall | Modul R&D/produksi/OMS/inventory dan readiness quality menu | Genealogy dan audit perubahan lot/formula, status mutu otoritatif, quarantine/recall dan hubungan ke order customer. |
| 7 — P1 | Home care request → dispatch → visit → lokasi → billing → follow-up | Homecare, portal nakes, dan tracking host tersedia | Token lifecycle, availability, field evidence, offline/error recovery, consent lokasi, billing ACK dan escalation. |
| 8 — P1 | RIS order → acquisition → DICOM/archive → report → hasil HIS | RIS/order dan daftar citra/preview tersedia | `pacs_viewer.js` sendiri menyatakan menampilkan preview, bukan DICOM diagnostik; koneksi PACS/DICOM dan interoperabilitas belum terbukti. |

## Temuan kesiapan yang perlu diperbaiki sebelum menambah menu

1. **Kejujuran status:** delapan menu readiness berlabel `parsial` dan kini menampilkan agregat sumber lokal; tetap butuh event korelasi, acceptance test, serta verifikasi workflow sebelum menaikkan status.
2. **Apps checkout:** sebelumnya implementasi lokal menyimpan hasil di memori tetapi menyatakan order terkirim ke HIS. Perubahan lokal menolak checkout dengan `HANDOFF_UNAVAILABLE` sampai kontrak dan ACK backend tersedia, serta mempertahankan cart.
3. **BPJS:** `modules/compliance/bpjs_claim.js` mengelola berkas/status/selisih manual; tidak menjalankan grouper INA-CBG atau penerbitan SEP VClaim. Jangan menyebutnya bridging.
4. **PACS:** viewer mengelola preview, bukan penampil diagnostik DICOM terkalibrasi. Pertahankan label batas itu sampai sistem standar diintegrasikan dan divalidasi.
5. **Boundary domain:** care/nutri/sanctuary dan console/tech berbagi workspace. Tetapkan daftar menu per role/site dan uji URL langsung/API; jangan menjadikan host header sebagai kontrol akses.
6. **KPI dan status live:** semua display/cockpit perlu sumber, waktu pembaruan, status error/stale, dan owner. Empty/missing data tidak boleh terlihat seperti angka nol atau kondisi sehat.

## Urutan tindak lanjut yang disarankan

1. **MVP integritas alur (P0):** sepakati owner/kontrak dan status nyata untuk Apps→HIS billing serta HIS↔LIS. Bangun correlation ID, idempotency, status, exception, retry yang terkontrol dan rekonsiliasi; jangan menghubungkan produksi tanpa checkpoint pemilik.
2. **Tutup risiko akses/consent (P0):** review server-side tenant isolation untuk portal corporate, wellness individual-vs-aggregate, token nakes/tracking dan Tech console. Uji grant/deny serta expiry dengan fixture sintetis.
3. **Selesaikan flow terpilih sebelum halaman baru:** pilih satu pilot HIS/LIS dan satu pilot Wellness. Buat acceptance matrix happy path, duplicate/retry, cancel/amend, timeout, partial failure, unauthorized tenant, audit trail dan recovery.
4. **Ubah readiness/klaim (P0/P1):** kategorikan menu readiness sebagai parsial; pertahankan peringatan BPJS dan PACS; hindari “sent/paid/live/verified” tanpa sumber otoritatif.
5. **Pilot unit RS (P1):** perluas workflow bed yang sudah disimulasikan ke UAT nonproduksi, termasuk konkurensi PostgreSQL dan pemetaan tenant. Setelah itu pilih unit klinis/stock/billing berdasarkan kebutuhan nyata.
6. **Tech, KPI, dan perangkat (P1/P2):** tuntaskan lifecycle tiket/sprint/delivery; tambahkan health/freshness dan fallback pada kiosk/display/CRM/cockpit.

Jangan membangun seluruh gap sekaligus. Validasi minimal satu flow per pilot dengan pengguna domain terkait; keputusan integrasi, kontrak eksternal, dan perubahan skema harus melewati checkpoint pemilik.

## Bukti dan keterbatasan

- `node scripts/bangun-menu.js --periksa` — lulus sinkronisasi manifest.
- `node scripts/audit-menu-hidup.js` — setelah perubahan status, 207 item `ada` tercakup oleh checker; tidak ada masalah route/handler/schema yang dikenali checker.
- `node scripts/uji/audit_all_menus.js` — seluruh 251 item konsisten route/judul menurut aturan skrip.
- Delapan status menu dan perilaku checkout diubah pada worktree lokal; belum dipublish. Checkout diuji untuk gagal tertutup, tidak membuat riwayat order dan tidak mengosongkan cart.
- Simulasi RS lokal yang dicatat pada status proyek: 21 skenario SQL dan 27 skenario UI lulus; tidak membuktikan penerapan migrasi produksi, multi-session concurrency, atau kelayakan klinis semua unit.
- Laporan menu dan inventaris: `AUDIT-SELURUH-MENU-2026-10-06.md` dan `../audit-evidence/2026-10-06/menu-inventory.json`.
- Audit host terdahulu: `AUDIT-SUBDOMAIN-AVA-GLOBAL.md`; rinci navigasi Tech: `AUDIT-NAVIGASI-TECH-2026-10-06.md`.
- Source readiness dan uji agregat sintetis: `../../ava-platform/modules/system/readiness.js`, `../../scripts/uji/test_readiness_sources.cjs`; BPJS: `../../ava-platform/modules/compliance/bpjs_claim.js`; PACS: `../../ava-platform/modules/radiology/pacs_viewer.js`; Apps checkout/wellness: `../../ava-platform/apps/app.js`, `../../ava-platform/apps/wellness.js`.
- Validasi ACK registry master dan keunikan nomor tiket Tech: `../../scripts/uji/test_master_registry_ack.cjs`, `../../scripts/uji/test_tech_ticket_number.cjs`.
