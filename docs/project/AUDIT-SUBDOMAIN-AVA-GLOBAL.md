# Audit QC & IT — Subdomain AVA Global Ecosystem

Tanggal audit: 16 September 2026  
Acuan bisnis: `docs/client/AVA-GLOBAL-ECOSYSTEM.html`  
Acuan teknis: `config/domain.json`, `config/menu.json`, `ava-platform/js/core/router.js`, `ava-platform/js/core/modul-manifest.js`

## Putusan audit

Arsitektur AVA sudah mempunyai cakupan yang kuat untuk enam pilar: HIS, LIS, AVA Tech, Care, Nutrition, dan Sanctuary. Alur inti klinik dan laboratorium juga sudah terlihat di menu. Penutupan audit ini menambahkan delapan control hub lintas pilar, memperjelas boundary Apps–HIS, dan menjadikan status menu evidence-based.

1. Batas subdomain dan workspace perlu dijelaskan. `domain.json` memuat 19 host, sedangkan `menu.json` memakai 5 ruang kerja. Care, Nutrition, dan Sanctuary kini didokumentasikan sebagai alias operasional di payung Wellness; keputusan ini menghindari tiga silo menu sambil tetap menyediakan control hub khusus.
2. Menu lama berisi tab/alias dan hub launcher, sehingga pencocokan literal menghasilkan false positive. Generator-aware audit sekarang menjadi pemeriksaan kanonik: 226 menu terpetakan, 218 `ada`, 8 `parsial`, dan tidak ada menu `belum` yang mengklaim sudah punya layar.
3. Kontrak end-to-end kini memiliki titik kendali yang terlihat: order HIS → LIS, hasil LIS → HIS, billing tetap di HIS, rekonsiliasi, consent, exception, partner reward, dan traceability produk. Control hub bersifat read-only sampai event source dan kontrak integrasi disetujui.

## Matriks per subdomain

| Subdomain | Yang sudah tercakup | Kekurangan menu / kendali yang diperlukan | Prioritas |
|---|---|---|---|
| `his.avahealth.sbs` | Admission, antrean, EMR, rawat inap, order terintegrasi, viewer hasil LIS, farmasi, home care, MCU, BPJS, SATUSEHAT, mutu | Hub Integrasi HIS–LIS (order, status, hasil, amend/cancel, retry); Billing Event & Rekonsiliasi (harga tidak dikelola di LIS); consent dan release-of-information; discharge/follow-up; referral tracking; clinical exception queue | P0 |
| `lis.avahealth.sbs` | Order, sampling, kelayakan spesimen, worklist, hasil, validasi, nilai kritis, QC/Westgard, lot, PME, TAT, arsip, katalog, analyzer, helpdesk | Inbox order HIS; callback hasil ke HIS; amend/release correction; chain of custody lengkap; nonconformity/CAPA; maintenance & calibration analyzer; recall/reject reagen; audit integrasi dan retry queue | P0 |
| `ops.avahealth.sbs` | Dashboard holding, control center, CEO cockpit, finance, seluruh domain lintas unit | KPI mutu dan pelayanan lintas pilar; risk register; incident/escalation board; partner performance; roadmap kapasitas fasilitas/pabrik; business continuity/DR status; evidence register untuk klaim, izin, dan sertifikasi | P1 |
| `tech.avahealth.sbs` | Tenant, lisensi, aktivasi, telemetry, roadmap, katalog modul, bug/request, pricing, audit, CRM, integrasi | Implementation project workspace; SLA/support/incident; API & connector catalog; release approval/change record; backup/restore & DR drill; security/access review; customer success/adoption; usage-to-invoice reconciliation | P0 |
| `wellness.avahealth.sbs` | OMS, konsinyasi, batch FEFO, shipping, subscription, Sanctuary booking, pabrik, R&D, maklon, uji mutu | Care program registry; participant/consent; session attendance/follow-up; challenge engine; partner quota/voucher issuance-redemption-reconciliation; product complaint/recall; batch release & deviation/CAPA; supplier qualification; warehouse quarantine/release | P0 |
| `care.avahealth.sbs` | Host terdaftar, modul Home Care ada di HIS, portal Nakes dan tracking tersedia | Belum ada ruang menu `care` pada `menu.json`; perlu workspace khusus atau keputusan eksplisit bahwa Care selalu dikelola di HIS/Wellness. Tambahkan order intake, dispatch, visit note, GPS consent, escalation, QA/CSAT dan billing handoff | P0 |
| `nutri.avahealth.sbs` | Host terdaftar, menu pabrik/R&D/maklon/mutu dan OMS tersedia di workspace Wellness | Belum ada ruang menu `nutri`; perlu pemisahan akses plant/R&D/QA/OMS. Tambahkan formula/version control, batch record, material genealogy, release/quarantine, complaint/recall dan demand planning | P0 |
| `sanctuary.avahealth.sbs` | Booking, member, room occupancy, catalog package tersedia di menu Wellness | Belum ada ruang menu `sanctuary`; perlu role front desk, therapist, supervisor, inventory/hygiene, room maintenance, consent, contraindication screening, package ledger, no-show, follow-up dan CSAT | P1 |
| `apps.avahealth.sbs` | Portal login, booking lab/home care, paket, hasil lab/radiologi, telehealth, wearable, Sanctuary, Nutrition/Care | Belum terlihat menu wellness challenge/reward dan program nutrisi yang lengkap. Beberapa layar masih berisi data/demo hardcoded. Ada akses “Dokumen QMS/Editor SOP AI” di portal pasien; ini melanggar batas publik-operasional. Tombol bayar di Apps harus menjadi handoff/status ke HIS karena payment owner adalah HIS | P0 |
| `corp.avahealth.sbs` | Roster, MCU, pemeriksaan, tagihan/faktur, kontrak dan kuota | Tambahkan status proyek MCU, approval peserta, consent, hasil aggregate vs individual, klaim/rekonsiliasi, SLA PIC, dan audit akses data karyawan | P1 |
| `nakes.avahealth.sbs` | Daftar tugas, detail pasien, navigasi, share lokasi | Tambahkan shift/availability, accept-reject dengan alasan, checklist visit, signature/consent, evidence upload, incident/escalation, offline queue, handoff ke HIS dan status payout | P1 |
| `kiosk.avahealth.sbs` | Pilihan poli, lab, MCU, Sanctuary, spesialis, farmasi/kasir | Tambahkan lookup appointment, pasien lama/baru, verifikasi identitas yang aman, reprint/cancel, accessibility/language, printer/device health, fallback offline dan audit nomor antrean. Pembayaran tetap diarahkan ke HIS | P1 |
| `antrian.avahealth.sbs` | Panggilan nomor dan loket terpadu | Tambahkan mode downtime, last-sync/status koneksi, konfigurasi prioritas, repeat call, multi-bahasa, pemisahan antrean appointment/walk-in, audit operator dan health check device | P1 |
| `crm.avahealth.sbs` | Monitor KPI dan pipeline penjualan | Tambahkan definisi KPI, sumber data/timezone, freshness badge, drill-down ke opportunity, target vs aktual, partner funnel, dan akses read-only yang jelas | P2 |
| `console.avahealth.sbs` | Host lisensi/telemetry terdaftar dan kategori Tech tersedia | Pastikan console benar-benar terisolasi dari `tech` biasa; tambahkan key rotation, license revoke, tenant suspension, alert routing, audit export dan break-glass procedure | P1 |

## Sinkronisasi menu dan manifest

Pemeriksaan literal awal memang menemukan ID tanpa `case` router dan tanpa manifest. Setelah alias, tab, eager module, dan rute induk dibaca oleh pemeriksa kanonik, temuan tersebut dinyatakan sebagai false positive struktural. `node scripts/audit-menu-hidup.js` kini lulus untuk layar mati, tabel/view, RPC, handler, dan manifest. Delapan menu control hub baru dicatat di `TANPA_DATA_WAJAR` karena sengaja read-only sampai event source, owner, dan acceptance test disepakati; status ini tidak boleh dipromosikan menjadi klaim operasional.

## Temuan lintas sistem

### Kontrak HIS–LIS–Billing

Dokumen portofolio sudah menyatakan bahwa HIS memegang billing/payment dan LIS menerima order serta mengirim hasil. Implementasi perlu menampilkan tiga menu audit bersama: `Integration Inbox`, `Retry & Dead Letter`, dan `Reconciliation`. Tanpa tiga titik ini, supervisor tidak bisa membedakan order belum dikirim, gagal diproses, hasil belum diterima HIS, atau transaksi sudah selesai tetapi belum direkonsiliasi.

### Wellness, Nutrition, dan Sanctuary

Portofolio menyebut participant, program, produk, tempat, partner, challenge, voucher dan tindak lanjut. Menu yang tersedia saat ini lebih kuat pada transaksi OMS, batch, dan booking. Lapisan care-program dan partner-reward belum tampak sebagai satu alur yang dapat dipantau. Ini adalah gap fungsional terbesar terhadap visi end-to-end.

### Tata kelola mutu dan bukti

Ada menu mutu, audit dan compliance, tetapi belum terlihat satu `Evidence Register` yang mengikat SOP, izin, sertifikasi, hasil audit, CAPA, pemilik bukti, tanggal berlaku, dan status verifikasi. Menu ini penting untuk membedakan kemampuan demo, pilot, implementasi dan fasilitas yang benar-benar aktif.

### Boundary publik dan operasional

Portal pasien/Apps kini hanya menampilkan layanan pasien, hasil, booking, wellness, dan produk yang memang ditujukan untuk pengguna. Kartu QMS/editor SOP internal sudah dikeluarkan. Checkout Apps menggunakan status handoff `PENDING_HIS_BILLING`; Apps tidak mengonfirmasi pembayaran dan tidak membuat referensi QRIS.

## Urutan perbaikan yang disarankan

1. **P0 — Sinkronisasi kontrak inti:** buat menu dan event audit HIS–LIS–Billing; perbaiki payment handoff; tandai order/result/retry/reconciliation.
2. **P0 — Pisahkan workspace:** tetapkan keputusan arsitektur untuk Care, Nutri dan Sanctuary. Jika tetap satu payung Wellness, hapus kesan subdomain mandiri; jika subdomain dipertahankan, tambahkan `ruang` dan filter menu masing-masing.
3. **P0 — Bersihkan boundary Apps:** keluarkan QMS/internal tools dan hilangkan demo data dari tampilan produksi; tambahkan wellness program/reward bila memang akan dijual.
4. **P1 — Tutup menu drift:** cocokkan 25 menu tanpa router dan 27 menu tanpa manifest; ubah status menu menjadi evidence-based.
5. **P1 — Tambahkan QC operasional:** CAPA/nonconformity, evidence register, device health, DR status, partner reconciliation, product complaint/recall.
6. **P2 — Rapikan cockpit:** definisi KPI, freshness, ownership, drill-down, dan read-only boundary pada monitor serta dashboard CEO.

## Gate QC sebelum menyatakan siap produksi

- Satu skenario order lengkap HIS → LIS → hasil → HIS → billing dapat ditelusuri dengan ID korelasi.
- Amend/cancel/retry dan kegagalan integrasi mempunyai status, pemilik, dan jejak audit.
- Tidak ada menu berstatus `ada` tanpa handler atau rute induk yang terdokumentasi.
- Care/Nutrition/Sanctuary memiliki keputusan workspace dan RBAC yang eksplisit.
- Portal publik tidak menampilkan menu QMS, database internal, data demo pasien, atau harga/payment yang bukan tanggung jawab Apps.
- Batch, release, complaint/recall, partner voucher, consent dan follow-up memiliki pemilik proses.
- Backup/restore, observability dan incident escalation diuji pada lingkungan non-produksi sebelum integrasi eksternal.

Audit ini bersifat arsitektur, menu dan readiness. Ia tidak menyatakan bahwa lisensi fasilitas, akreditasi, produksi obat, partner hotel/F&B/gym, atau fitur roadmap sudah aktif.
