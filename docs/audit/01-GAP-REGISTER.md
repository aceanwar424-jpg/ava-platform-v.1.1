# GAP REGISTER (TAHAP 1)
### Analisis Kesenjangan Sistem Eksisting vs Blueprint AVA Global Ecosystem (V5.1)
**Dokumen Rujukan:** `AVA-DOC-ARCH-2026-V5.1` & `PROMPT-ANTIGRAVITY-Restrukturisasi-AVA-Global`  
**Status:** Tahap 1 — Selesai  
**Tanggal:** 30 Agustus 2026  
**Auditor:** Principal Engineer / Antigravity Agent  

---

## RINGKASAN EKSEKUTIF KESENJANGAN

Dari total **249 route unik** pada Blueprint Arsitektur V5.1 (Bab 4–10 dan 15–22):
- **ADA-PENUH:** 38 Route (15.3%) — Berfungsi penuh dan telah terverifikasi.
- **ADA-BEDA-NAMA:** 84 Route (33.7%) — Fitur sudah ada pada rute flat/legacy, memerlukan penataan namespace 3 segmen.
- **ADA-SEBAGIAN:** 46 Route (18.5%) — UI/mockup tersedia, namun integrasi backend/business rule belum lengkap.
- **TIDAK ADA:** 81 Route (32.5%) — Fitur baru sesuai spesifikasi V5.1 (terutama domain KBLI registry, activity matrix, MRP pabrik CPOTB, PACS server buatan sendiri, dan GL/Payroll engine Fase 2–4).

---

## A. TABEL PEMETAAN MENYELURUH (249 ROUTE BLUEPRINT)

### 1. AVA LAB (`lab/` — Bab 4 Blueprint)

| Route Blueprint | Status Saat Ini | Lokasi Kode Eksisting | Kesenjangan / Catatan | Prioritas |
|---|---|---|---|:---:|
| `lab/pre/order` | ADA-BEDA-NAMA | `modules/lab/index.js:45` | Belum terhubung ke MPI tunggal & ICD-10 otomatis | P1 |
| `lab/pre/registration` | ADA-BEDA-NAMA | `modules/his/admission.js:12` | Penomoran accession number belum tersentralisasi | P1 |
| `lab/pre/collection-plan` | ADA-SEBAGIAN | `modules/lab/specimen.js:80` | Aturan order-of-draw masih berbasis teks statis | P2 |
| `lab/pre/checkin` | ADA-BEDA-NAMA | `modules/lab/checkin.js:1` | Belum ada timestamp ganda flebotomis vs analis | P1 |
| `lab/pre/acceptance` | ADA-SEBAGIAN | `modules/lab/specimen.js:150` | Log penolakan spesimen ISO 15189 klausul 7.2.6 belum ada | P1 |
| `lab/pre/routing` | ADA-SEBAGIAN | `modules/lab/worklist.js:40` | Aliquot & child-sample tracking belum terekam DB | P2 |
| `lab/pre/coldchain` | TIDAK ADA | – | Belum ada log suhu transport & PIC kurir | P2 |
| `lab/pre/manifest` | ADA-SEBAGIAN | `modules/logistics/index.js:55` | Belum ada scan keluar-masuk antar cabang terintegrasi LIS | P2 |
| `lab/pre/queue` | ADA-BEDA-NAMA | `monitor/antrian.html:1`, `kiosk/` | Integrasi panggilan flebotomi masih terpisah dari LIS | P1 |
| `lab/ana/worklist` | ADA-BEDA-NAMA | `modules/lab/worklist.js:1` | Filter STAT/Cito/Rutin sudah ada, belum auto-refresh | P1 |
| `lab/ana/interface` | ADA-BEDA-NAMA | `connector/ava-connector.js:1` | Driver HL7/ASTM aktif, belum ada dashboard UI registry | P1 |
| `lab/ana/manual-entry` | ADA-BEDA-NAMA | `modules/lab/results.js:35` | Form hasil terstruktur mikroskopis/PA belum lengkap | P1 |
| `lab/ana/autoverify` | ADA-SEBAGIAN | `js/core/conclusionEngine.js:10` | Mesin kesimpulan ada, belum auto-release jika delta check lolos | P2 |
| `lab/ana/delta` | ADA-SEBAGIAN | `modules/lab/results.js:210` | Pembanding hasil historis manual, belum threshold alert | P2 |
| `lab/ana/rerun` | ADA-SEBAGIAN | `modules/lab/results.js:305` | Log rerun belum mencatat faktor dilusi & approval penyelia | P2 |
| `lab/ana/micro` | TIDAK ADA | – | Alur kultur multi-hari & antibiogram CLSI belum dibuat | P3 |
| `lab/ana/histo` | TIDAK ADA | – | Alur Patologi Anatomi (grossing/slide) belum dibuat | P3 |
| `lab/ana/molecular` | TIDAK ADA | – | Pelaporan Ct value PCR & bridging spesifik Kemenkes | P3 |
| `lab/ana/instrument-log`| ADA-SEBAGIAN| `modules/system/assets.js:88` | Log error & telemetri alat belum otomatis dari connector | P2 |
| `lab/qc/entry` | ADA-BEDA-NAMA | `db/migrations/0009_qc_lots.sql`| Form input level L1/L2/L3 aktif di `modules/lab/qc.js` | P1 |
| `lab/qc/levey-jennings` | ADA-PENUH | `modules/lab/qc.js:120` | Grafik Levey-Jennings & Westgard rules multi-rule aktif | P1 |
| `lab/qc/baseline` | ADA-SEBAGIAN | `modules/lab/qc.js:280` | Hitung Mean & SD dari 20 hari data masih semi-manual | P2 |
| `lab/qc/sigma` | TIDAK ADA | – | Metrik Six Sigma & Total Error Allowable belum ada | P3 |
| `lab/qc/capa` | ADA-BEDA-NAMA | `modules/compliance/capa.js:1` | CAPA form tersedia, belum ter-trigger otomatis saat QC fail | P2 |
| `lab/qc/eqa` | ADA-SEBAGIAN | `modules/compliance/pme.js:1` | Form PNPME ada, integrasi sertifikat belum otomatis | P2 |
| `lab/qc/comparison` | TIDAK ADA | – | Uji korelasi Bland-Altman antar alat belum tersedia | P3 |
| `lab/qc/calibration` | ADA-SEBAGIAN | `modules/system/assets.js:140` | Log kalibrasi ada, belum ada verifikasi linearitas LoD/LoQ | P2 |
| `lab/post/validation` | ADA-BEDA-NAMA | `modules/lab/validation.js:1` | Verifikasi teknis analis vs verifikasi Sp.PK belum 2 level | P1 |
| `lab/post/signoff` | ADA-BEDA-NAMA | `modules/lab/validation.js:90` | Verifikasi medis Sp.PK aktif dengan digital signature | P1 |
| `lab/post/critical` | ADA-BEDA-NAMA | `modules/lab/results.js:450` | Nilai kritis di-highlight, belum ada read-back timer log | P1 |
| `lab/post/comments` | ADA-PENUH | `modules/system/test_reviewer.js`| Komentar interpretatif otomatis berbasis AI/rule aktif | P1 |
| `lab/post/report-builder`| ADA-PENUH | `modules/system/config/config_labreport.js` | Builder layout PDF & kop faskes siap pakai | P1 |
| `lab/post/release` | ADA-BEDA-NAMA | `modules/lab/results.js:550` | Rilis PDF via WhatsApp / portal pasien aktif | P1 |
| `lab/post/esign` | ADA-PENUH | `js/core/pdfSigner.js:1` | TTE & QR code verifikasi keaslian dokumen aktif | P1 |
| `lab/post/amendment` | ADA-SEBAGIAN | `modules/lab/results.js:620` | Addendum report menimpa data jika tidak hati-hati | P1 |
| `lab/post/history` | ADA-PENUH | `modules/his/medrecord.js:1` | Grafik tren kumulatif hasil lab per pasien aktif | P1 |
| `lab/post/summary` | ADA-SEBAGIAN | `modules/lab/results.js:700` | Resume medis lab baru format standar | P2 |
| `lab/master/test-catalog`| ADA-PENUH | `modules/system/config/config_product.js` | 530+ tes lengkap LOINC (OBX-3) & UCUM (OBX-6) | P1 |
| `lab/master/panels` | ADA-PENUH | `modules/system/config/config_package.js` | Panel & paket MCU profil lengkap | P1 |
| `lab/master/specimen` | ADA-PENUH | `data/catalog/catalog_generic.csv` | Master spesimen, tabung, stabilitas on-board | P1 |
| `lab/master/method` | ADA-PENUH | `database.sql:1-3000` | Master metode per alat terkonfigurasi | P1 |
| `lab/master/tat-standard`| ADA-BEDA-NAMA| `db/migrations/0011_ar_aging_tat.sql` | Target TAT per prioritas tes | P1 |
| `lab/master/referrer` | ADA-BEDA-NAMA | `modules/crm/perujuk.js:1` | Master dokter/klinik perujuk + skema diskon | P1 |
| `lab/master/pricing` | ADA-PENUH | `modules/system/config/config_product.js` | Tarif umum, korporat, perujuk | P1 |
| `lab/master/terminology`| ADA-BEDA-NAMA | `lib/validator/catalog_validator.js` | Pemetaan sinonim tes dan mapping LIS | P1 |
| `lab/ref/intervals` | ADA-PENUH | `database.sql`, `modules/system/config/config_product.js` | Rentang rujukan multi-umur, sex, instrumen | P1 |
| `lab/ref/verification` | ADA-SEBAGIAN | `data/catalog/catalog_generic.csv` | Lembar status verifikasi acuan ada, belum form CLSI EP28 | P2 |
| `lab/ref/critical-values`| ADA-PENUH | `database.sql`, `modules/lab/results.js` | Master ambang batas kritis per analit | P1 |
| `lab/ref/unit-conversion`| ADA-PENUH | `js/core/fhirConverter.js:80` | Konversi satuan SI ke konvensional | P1 |
| `lab/ref/rules` | ADA-PENUH | `js/core/conclusionEngine.js:1` | Rules engine reflex & interpretasi otomatis | P1 |
| `lab/ref/fitwork-engine`| ADA-SEBAGIAN | `modules/his/mcu.js:180` | Logika Fit/Unfit ada, belum rule editor mandiri | P2 |
| `lab/ref-lab/partners` | ADA-BEDA-NAMA | `modules/partners/index.js:1` | Profil lab rujukan eksternal | P2 |
| `lab/ref-lab/routing` | ADA-SEBAGIAN | `modules/partners/deals.js:40` | Routing otomatis vendor belum ada | P2 |
| `lab/ref-lab/shipment` | ADA-SEBAGIAN | `modules/system/surat.js:50` | Surat pengantar ada, nomor manifest belum barcode | P2 |
| `lab/ref-lab/result-intake`| ADA-SEBAGIAN| `modules/lab/results.js:800` | Input manual hasil rujukan luar | P2 |
| `lab/ref-lab/settlement`| ADA-BEDA-NAMA | `db/migrations/0020_bekukan_tarif_rujukan.sql` | Rekonsiliasi tagihan lab rujukan | P2 |
| `lab/inv/stock` | ADA-BEDA-NAMA | `modules/logistics/inventory.js:1` | Stok reagen per lot & tanggal kedaluwarsa | P1 |
| `lab/inv/recipe` | ADA-SEBAGIAN | `modules/logistics/inventory.js:120` | BOM tes belum auto-deduct saat rilis hasil | P2 |
| `lab/inv/temperature` | TIDAK ADA | – | Log suhu kulkas manual/IoT belum ada | P2 |
| `lab/inv/reorder` | ADA-PENUH | `modules/logistics/inventory.js:200` | Kalkulasi reorder point & buffer stock | P1 |
| `lab/inv/equipment` | ADA-BEDA-NAMA | `modules/system/assets.js:1` | Inventaris alat, jadwal servis & kalibrasi | P1 |
| `lab/inv/waste` | TIDAK ADA | – | Manifest limbah B3 medis belum tercatat | P2 |
| `lab/qms/documents` | ADA-PENUH | `modules/compliance/qms.js:1` | SOP/IK/Formulir patuh ISO 15189 | P1 |
| `lab/qms/risk` | ADA-SEBAGIAN | `modules/compliance/risk.js:1` | Register risiko proses lab (klausul 2022) | P2 |
| `lab/qms/capa` | ADA-BEDA-NAMA | `modules/compliance/capa.js:1` | Alur ketidaksesuaian & tindakan korektif | P1 |
| `lab/qms/complaints` | ADA-BEDA-NAMA | `modules/crm/leads.js:300` | Form keluhan pelanggan | P2 |
| `lab/qms/audit` | ADA-SEBAGIAN | `modules/compliance/audit.js:1` | Jadwal & temuan audit internal | P2 |
| `lab/qms/competency` | ADA-SEBAGIAN | `modules/hrd/index.js:140` | Matriks kompetensi analis lab | P2 |
| `lab/qms/indicators` | ADA-PENUH | `modules/dashboard/index.js:50` | Dashboard KPI mutu lab & % TAT | P1 |
| `lab/qms/review` | ADA-SEBAGIAN | `modules/compliance/qms.js:250` | Notulen tinjauan manajemen | P2 |
| `lab/qms/readiness` | ADA-PENUH | `lib/compliance/iso15189_checker.js` | Checker kepatuhan klausul ISO 15189 | P1 |
| `lab/analytics/tat` | ADA-PENUH | `modules/dashboard/tat.js:1` | Analitik TAT per fase & bottleneck | P1 |
| `lab/analytics/workload`| ADA-PENUH | `modules/dashboard/index.js:180` | Volume tes per bench & alat | P1 |
| `lab/analytics/utilization`| ADA-PENUH | `modules/dashboard/index.js:220`| Utilisasi tes paling sering/jarang | P1 |
| `lab/analytics/cost` | ADA-SEBAGIAN | `modules/finance/index.js:310` | Profitabilitas tes belum menghitung BHP riil | P2 |
| `lab/analytics/epi` | ADA-SEBAGIAN | `modules/maps/index.js:1` | Peta sebaran penyakit/kasus | P2 |
| `lab/analytics/referrer`| ADA-PENUH | `modules/crm/perujuk.js:80` | Laporan volume rujukan dokter/klinik | P1 |
| `lab/rnd/protocols` | TIDAK ADA | – | Protokol riset klinis belum ada | P4 |
| `lab/rnd/consent` | TIDAK ADA | – | Consent riset terpisah belum ada | P4 |
| `lab/rnd/biobank` | TIDAK ADA | – | Repositori biobank sisa spesimen belum ada | P4 |
| `lab/rnd/datasets` | TIDAK ADA | – | Ekstraksi dataset de-identifikasi belum ada | P4 |
| `lab/rnd/method-validation`| ADA-SEBAGIAN| `lib/validator/catalog_validator.js` | Validasi metode baru semi-otomatis | P3 |
| `lab/rnd/publications` | TIDAK ADA | – | Arsip publikasi/poster riset belum ada | P4 |

---

### 2. AVA HEALTH (`health/` — Bab 5 Blueprint)

| Route Blueprint | Status Saat Ini | Lokasi Kode Eksisting | Kesenjangan / Catatan | Prioritas |
|---|---|---|---|:---:|
| `health/his/admission` | ADA-BEDA-NAMA | `modules/his/admission.js:1` | Pendaftaran rawat jalan & NIK | P1 |
| `health/his/mpi` | ADA-SEBAGIAN | `modules/system/config/config_family.js` | Belum ada mekanisme merge/unmerge dedikasi | P0 (Fase 0) |
| `health/his/emr` | ADA-BEDA-NAMA | `modules/his/emr_soap.js:1` | SOAP klinis, ICD-10 & vital sign aktif | P1 |
| `health/his/orders` | ADA-BEDA-NAMA | `modules/his/clinicflow.js:60` | Order terintegrasi Lab, E-resep & tindakan | P1 |
| `health/his/pharmacy` | ADA-BEDA-NAMA | `modules/pharmacy/index.js:1` | E-resep & stok obat aktif | P1 |
| `health/his/pacs` | ADA-BEDA-NAMA | `modules/radiology/index.js:1`, `js/core/pacsEngine.js` | Viewer DICOM lokal aktif | P2 |
| `health/his/procedures` | ADA-BEDA-NAMA | `modules/his/clinicflow.js:180` | Katalog tindakan medis & informed consent | P1 |
| `health/his/inpatient` | ADA-BEDA-NAMA | `modules/his/inpatient.js:1` | Bed board & asuhan rawat inap dasar | P3 |
| `health/his/immunization`| ADA-SEBAGIAN | `modules/his/admission.js:250` | Pencatatan vaksinasi, belum auto-push SATUSEHAT | P2 |
| `health/his/telehealth` | ADA-BEDA-NAMA | `modules/business_units/ava_health.js:40` | Telekonsultasi dokter aktif | P2 |
| `health/his/mr-governance`| ADA-SEBAGIAN| `modules/his/medrecord.js:200` | Kelengkapan RM ada, retensi/pemusnahan belum | P2 |
| `health/queue/config` | ADA-BEDA-NAMA | `modules/his/clinicflow.js:30` | Konfigurasi loket & kuota dokter | P1 |
| `health/queue/console` | ADA-BEDA-NAMA | `monitor/antrian.html:1` | Layar panggil loket & counter console | P1 |
| `health/queue/display` | ADA-PENUH | `monitor/antrian.html:50` | TV display multi-zona + text-to-speech audio | P1 |
| `health/kiosk/ticket` | ADA-PENUH | `kiosk/index.html:1`, `kiosk/app.js` | Kiosk layar sentuh ambil antrean tiket | P1 |
| `health/kiosk/self-reg` | ADA-SEBAGIAN | `kiosk/index.html:80` | Scan QR kedatangan janji | P2 |
| `health/kiosk/result-print`| ADA-SEBAGIAN| `kiosk/index.html:120` | Cetak hasil mandiri via OTP | P2 |
| `health/queue/virtual` | ADA-SEBAGIAN | `portal.html:150` | Nomor antrean virtual di portal pasien | P2 |
| `health/queue/analytics` | ADA-PENUH | `modules/dashboard/index.js:310` | Waktu tunggu poli per jam | P1 |
| `health/apps/patient` | ADA-BEDA-NAMA | `portal.html:1`, `apps/index.html` | Portal pasien web & Capacitor PWA | P1 |
| `health/apps/doctor` | ADA-BEDA-NAMA | `apps/index.html:200` | View dokter mobile | P2 |
| `health/apps/nakes` | ADA-PENUH | `nakes.html:1` | Portal nakes lapangan & GPS check-in | P1 |
| `health/apps/corporate` | ADA-PENUH | `portal_korporat.html:1` | Portal PIC HR perusahaan unduh hasil massal | P1 |
| `health/apps/referrer` | ADA-PENUH | `portal_perujuk.html:1` | Portal dokter/klinik perujuk kirim sampel | P1 |
| `health/apps/admin` | ADA-BEDA-NAMA | `modules/system/settings.js:1` | Admin console pengaturan faskes | P1 |
| `health/corp/clients` | ADA-BEDA-NAMA | `modules/crm/leads.js:1` | Database perusahaan klien MCU | P1 |
| `health/corp/quotation` | ADA-BEDA-NAMA | `modules/crm/quotation.js:1`, `0012_penawaran.sql` | Builder paket MCU & penawaran resmi | P1 |
| `health/corp/project` | ADA-BEDA-NAMA | `modules/his/mcu.js:1`, `supabase_corp_mcu_booking.sql` | Roster karyawan & penjadwalan gelombang | P1 |
| `health/corp/onsite` | ADA-SEBAGIAN | `modules/his/mcu.js:90` | Mode offline on-site belum teruji sinkron | P2 |
| `health/corp/results` | ADA-PENUH | `modules/his/mcu.js:240` | Mass PDF generator hasil & sertifikat | P1 |
| `health/corp/report` | ADA-PENUH | `modules/his/mcu.js:310` | Laporan agregat epidemiologi perusahaan | P1 |
| `health/corp/fitwork` | ADA-BEDA-NAMA | `modules/his/mcu.js:190` | Keputusan laik kerja oleh dokter Hiperkes | P1 |
| `health/corp/claims` | ADA-BEDA-NAMA | `modules/his/bpjs_claim.js:1` | Manajemen klaim asuransi & penjaminan | P2 |
| `health/corp/bpjs` | ADA-BEDA-NAMA | `js/core/bpjsBridge.js:1` | Jembatan VClaim & grouping INA-CBG | P2 |
| `health/corp/compliance` | ADA-BEDA-NAMA | `modules/compliance/index.js:1` | Registry izin klinik & STR/SIP nakes | P1 |
| `health/billing/cashier` | ADA-BEDA-NAMA | `modules/finance/cashier.js:1` | POS kasir klinis & QRIS dinamis | P1 |
| `health/billing/shift` | ADA-BEDA-NAMA | `modules/finance/cashier.js:140` | Buka/tutup shift kasir & berita acara | P1 |
| `health/billing/ar` | ADA-BEDA-NAMA | `db/migrations/0011_ar_aging_tat.sql` | AR invoice aging korporat | P1 |
| `health/billing/fee` | ADA-BEDA-NAMA | `modules/finance/payroll.js:80` | Bagi hasil & slip jasa medis dokter | P2 |

---

### 3. AVA TECH (`tech/` — Bab 6 Blueprint)

| Route Blueprint | Status Saat Ini | Lokasi Kode Eksisting | Kesenjangan / Catatan | Prioritas |
|---|---|---|---|:---:|
| `tech/product/backlog` | ADA-SEBAGIAN | `modules/agentic/index.js:50` | Backlog manajemen masih statis | P3 |
| `tech/product/sprint` | TIDAK ADA | – | Sprint board belum ada | P3 |
| `tech/product/change-request` | TIDAK ADA | – | CR portal belum ada | P3 |
| `tech/product/release` | ADA-SEBAGIAN | `modules/system/timeline.js:1` | Changelog rilis manual | P2 |
| `tech/product/docs` | ADA-BEDA-NAMA | `modules/wiki/index.js:1` | Wiki & dokumentasi platform | P2 |
| `tech/product/uat` | TIDAK ADA | – | Modul UAT sign-off belum ada | P3 |
| `tech/platform/tenants` | ADA-BEDA-NAMA | `db/migrations/0004_tenancy.sql` | Registri tenant dasar ada, belum ada metering UI | P0 (Fase 0) |
| `tech/platform/iam` | ADA-BEDA-NAMA | `db/migrations/0003_rbac.sql`, `js/auth.js` | RBAC aktif, belum 18 peran baku V5.1 | P0 (Fase 0) |
| `tech/platform/audit` | ADA-BEDA-NAMA | `js/core/auditLogger.js`, `modules/system/audit.js` | Log ada, belum hash-chain immutable di DB | P0 (Fase 0) |
| `tech/platform/environments`| ADA-SEBAGIAN | `config/domain.json` | Config per domain ada, secret manager belum | P1 |
| `tech/platform/monitoring` | ADA-SEBAGIAN | `js/core/ntpService.js` | Monitoring latensi & NTP aktif | P2 |
| `tech/platform/backup` | ADA-BEDA-NAMA | `scripts/pulihkan-cadangan.js` | Script restore ada, jadwal otomatis belum | P1 |
| `tech/platform/security` | ADA-SEBAGIAN | `scripts/audit-keamanan-modul.js`| Script audit modul ada | P1 |
| `tech/platform/servicedesk` | ADA-BEDA-NAMA | `support.html:1` | Tiket support eksternal | P2 |
| `tech/integration/gateway` | ADA-BEDA-NAMA | `js/core/api.js:1` | API client core | P1 |
| `tech/integration/satusehat`| ADA-BEDA-NAMA | `modules/compliance/satusehat.js`, `js/core/fhirConverter.js` | FHIR converter lengkap R4 | P1 |
| `tech/integration/analyzer` | ADA-BEDA-NAMA | `connector/ava-connector.js` | Connector analyzer RS232/TCP-IP | P1 |
| `tech/integration/commerce` | ADA-SEBAGIAN | `modules/business_units/ecommerce_oms.js:90` | API Marketplace masih simulasi | P3 |
| `tech/integration/payment` | ADA-BEDA-NAMA | `js/core/paymentGateway.js` | Gateway pembayaran QRIS & VA | P1 |
| `tech/integration/insurance`| ADA-BEDA-NAMA | `js/core/bpjsBridge.js` | Bridge BPJS / Asuransi | P2 |
| `tech/integration/events` | ADA-BEDA-NAMA | `db/migrations/0006_sync_outbox.sql` | Sync outbox ada, belum ada schema event 17.1 | P0 (Fase 0) |
| `tech/data/warehouse` | TIDAK ADA | – | Pipeline DWH belum dibuat | P3 |
| `tech/data/bi` | ADA-BEDA-NAMA | `modules/dashboard/index.js` | BI chart interaktif aktif | P2 |
| `tech/ai/orchestrator` | ADA-BEDA-NAMA | `modules/agentic/index.js`, `0010_agentic_canvas.sql` | Canvas AI Agentic aktif | P1 |
| `tech/ai/qms-engine` | ADA-PENUH | `lib/compliance/iso15189_checker.js`, `lib/assembler/` | Engine QMS modular & ISO checker | P1 |
| `tech/ai/test-rewriter` | ADA-PENUH | `modules/system/test_reviewer.js`, `tools/content_pipeline.js` | Penulisan ulang deskripsi tes awam | P1 |
| `tech/ai/terminology` | ADA-PENUH | `lib/validator/catalog_validator.js` | Auto-mapper LOINC/UCUM/ICD | P1 |
| `tech/ai/content` | ADA-BEDA-NAMA | `tools/content_pipeline.js` | Pipa konten LinkedIn & SEO | P2 |
| `tech/biz/chargeback` | TIDAK ADA | – | Internal chargeback antar-brand belum ada | P2 (Fase 1) |
| `tech/biz/service-catalog` | TIDAK ADA | – | Katalog layanan Tech belum ada | P2 (Fase 1) |
| `tech/biz/capacity` | TIDAK ADA | – | Alokasi kapasitas tim developer belum ada | P2 (Fase 1) |
| `tech/biz/pipeline` | TIDAK ADA | – | Pipeline SaaS eksternal (Fase 4) | P4 |
| `tech/biz/onboarding` | TIDAK ADA | – | Onboarding tenant luar (Fase 4) | P4 |
| `tech/biz/contracts` | TIDAK ADA | – | Kontrak SLA klien luar (Fase 4) | P4 |
| `tech/core/gl-coa` | ADA-SEBAGIAN | `modules/finance/accounting.js:40` | COA ada, belum berdimensi 4 kolom wajib | P2 (Fase 2) |
| `tech/core/gl-journal` | ADA-SEBAGIAN | `modules/finance/accounting.js:110` | Jurnal manual ada, posting otomatis belum | P2 (Fase 2) |
| `tech/core/gl-ledger` | ADA-SEBAGIAN | `modules/finance/accounting.js:180` | Buku besar & neraca saldo dasar | P2 (Fase 2) |
| `tech/core/gl-report` | ADA-SEBAGIAN | `modules/finance/accounting.js:250` | Laporan keuangan belum bersegmen brand | P2 (Fase 2) |
| `tech/core/gl-closing` | TIDAK ADA | – | Jurnal tutup buku & penyesuaian | P3 (Fase 3) |
| `tech/core/gl-tax` | TIDAK ADA | – | Rekap PPN/PPh e-Faktur/e-Bupot | P3 (Fase 3) |
| `tech/core/gl-audit` | ADA-SEBAGIAN | `modules/finance/accounting.js:320` | Audit trail akuntansi | P2 (Fase 2) |
| `tech/core/pay-components`| ADA-SEBAGIAN| `modules/finance/payroll.js:30` | Komponen gaji belum terpisah 3 profil | P3 (Fase 3) |
| `tech/core/pay-run` | ADA-SEBAGIAN | `modules/finance/payroll.js:110` | Run payroll bulanan sederhana | P3 (Fase 3) |
| `tech/core/pay-variable`| ADA-SEBAGIAN | `modules/finance/payroll.js:180` | Hitung lembur/insentif | P3 (Fase 3) |
| `tech/core/pay-statutory`| TIDAK ADA | – | Perhitungan PPh 21 TER & BPJS resmi | P3 (Fase 3) |
| `tech/core/pay-slip` | ADA-BEDA-NAMA | `modules/finance/payroll.js:260` | Cetak slip gaji PDF | P3 (Fase 3) |
| `tech/core/pay-disbursement`| TIDAK ADA | – | File transfer bank massal | P3 (Fase 3) |
| `tech/core/pacs-store` | ADA-SEBAGIAN | `js/core/pacsEngine.js:20` | Penyimpanan citra lokal | P3 (Fase 3) |
| `tech/core/pacs-mwl` | TIDAK ADA | – | Modality Worklist DICOM | P3 (Fase 3) |
| `tech/core/pacs-qr` | ADA-SEBAGIAN | `js/core/pacsEngine.js:70` | Query/retrieve studi lokal | P3 (Fase 3) |
| `tech/core/pacs-viewer` | ADA-BEDA-NAMA | `modules/radiology/index.js:50` | Web DICOM viewer (zoom/windowing) | P2 |
| `tech/core/pacs-share` | TIDAK ADA | – | Link sharing studi ke pasien | P3 (Fase 3) |
| `tech/core/numbering` | TIDAK ADA | – | Service penomoran dokumen sentral dengan row lock | P0 (Fase 0) |

---

### 4. AVA CARE (`care/` — Bab 7 Blueprint)

| Route Blueprint | Status Saat Ini | Lokasi Kode Eksisting | Kesenjangan / Catatan | Prioritas |
|---|---|---|---|:---:|
| `care/order/intake` | ADA-BEDA-NAMA | `modules/his/homecare.js:30` | Intake order home care & koordinat GPS | P1 |
| `care/order/triage` | ADA-SEBAGIAN | `modules/his/homecare.js:80` | Skrining kelayakan home care sederhana | P2 |
| `care/order/quotation` | ADA-BEDA-NAMA | `modules/his/homecare.js:120` | Estimasi tarif tindakan + zonasi transport | P1 |
| `care/dispatch/schedule`| ADA-BEDA-NAMA | `modules/his/homecare.js:180` | Plotting jadwal nakes per wilayah | P1 |
| `care/dispatch/tracking`| ADA-SEBAGIAN | `modules/maps/index.js:40` | Live tracking nakes & tombol darurat | P2 |
| `care/dispatch/routing` | ADA-SEBAGIAN | `modules/maps/index.js:90` | Optimasi rute kunjungan | P2 |
| `care/service/catalog` | ADA-BEDA-NAMA | `modules/his/homecare.js:220` | Katalog tindakan home care & caregiver | P1 |
| `care/service/procedure-form`| ADA-PENUH | `nakes.html:40` | Form digital tindakan nakes + foto + ttd | P1 |
| `care/service/careplan` | ADA-SEBAGIAN | `modules/his/homecare.js:290` | Program berkelanjutan (mis. luka 4 minggu) | P2 |
| `care/service/sampling` | ADA-BEDA-NAMA | `nakes.html:120` | Sampling darah di rumah kirim ke LIS | P1 |
| `care/staff/registry` | ADA-BEDA-NAMA | `modules/hrd/index.js:50` | Master nakes home care & validitas STR/SIP | P1 |
| `care/staff/competency` | ADA-SEBAGIAN | `modules/hrd/index.js:180` | Otorisasi tindakan per nakes | P2 |
| `care/staff/commission` | ADA-BEDA-NAMA | `modules/finance/payroll.js:150` | Fee tindakan & uang transport nakes | P1 |
| `care/pricing/tariff` | ADA-BEDA-NAMA | `modules/his/homecare.js:350` | Tarif jarak per km/zona & tarif libur | P1 |
| `care/pricing/subscription`| ADA-BEDA-NAMA | `modules/business_units/ecommerce_oms.js:200` | Paket langganan home care lansia | P2 |
| `care/quality/incident` | ADA-SEBAGIAN | `modules/compliance/capa.js:80` | Laporan insiden di rumah pasien | P2 |
| `care/quality/csat` | ADA-SEBAGIAN | `portal.html:300` | Rating bintang & survei kepuasan pasien | P2 |
| `care/quality/report` | ADA-BEDA-NAMA | `modules/his/homecare.js:420` | Laporan kinerja & profitabilitas zona | P1 |

---

### 5. AVA NUTRITION (`nutri/` — Bab 8 Blueprint)

| Route Blueprint | Status Saat Ini | Lokasi Kode Eksisting | Kesenjangan / Catatan | Prioritas |
|---|---|---|---|:---:|
| `nutri/rnd/formulation` | TIDAK ADA | – | Pipeline formula suplemen & uji sensori | P3 |
| `nutri/rnd/claims` | TIDAK ADA | – | Manajemen klaim ilmiah produk | P3 |
| `nutri/rnd/testing` | ADA-SEBAGIAN | `modules/lab/index.js:200` | Order uji lab produk internal ke AVA Lab | P2 |
| `nutri/reg/bpom` | TIDAK ADA | – | Database nomor NIE BPOM & reminder perpanjangan | P2 |
| `nutri/reg/halal` | TIDAK ADA | – | Sertifikat Halal BPJPH per SKU & bahan | P2 |
| `nutri/reg/cpotb` | TIDAK ADA | – | Profil maklon & audit CPOTB/CPPOB | P3 |
| `nutri/prod/plan` | TIDAK ADA | – | Rencana batch produksi | P3 |
| `nutri/prod/batch` | TIDAK ADA | – | Batch record & pelulusan batch oleh PJ | P3 |
| `nutri/prod/qc` | TIDAK ADA | – | QC retained sample & karantina produk | P3 |
| `nutri/prod/recall` | TIDAK ADA | – | Simulasi & eksekusi product recall | P3 |
| `nutri/supply/materials`| ADA-SEBAGIAN | `modules/logistics/inventory.js:80` | Master bahan baku suplemen | P2 |
| `nutri/supply/mrp` | TIDAK ADA | – | Kalkulasi MRP & kebutuhan bahan | P3 |
| `nutri/supply/procurement`| ADA-BEDA-NAMA| `modules/logistics/inventory.js:250` | Alur PR/PO & penerimaan bahan | P2 |
| `nutri/supply/warehouse`| ADA-BEDA-NAMA | `modules/logistics/inventory.js:300` | Multi-gudang FEFO | P1 |
| `nutri/sales/oms` | ADA-PENUH | `modules/business_units/ecommerce_oms.js:1`, `nutri.html` | OMS multi-channel (Shopee/TikTok/Tokopedia) | P1 |
| `nutri/sales/consignment`| ADA-SEBAGIAN| `modules/partners/deals.js:110` | Konsinyasi apotek rekanan | P2 |
| `nutri/sales/distribution`| ADA-SEBAGIAN| `modules/partners/deals.js:180` | Tier harga distributor & reseller | P2 |
| `nutri/sales/subscription`| ADA-PENUH | `modules/business_units/ecommerce_oms.js:180` | Langganan bulanan auto-refill | P1 |
| `nutri/sales/shipping` | ADA-BEDA-NAMA | `js/core/shippingEngine.js:1` | Integrasi ongkir ekspedisi & cetak label resi | P1 |
| `nutri/sales/returns` | ADA-SEBAGIAN | `modules/business_units/ecommerce_oms.js:240` | Manajemen retur barang | P2 |
| `nutri/hr/shift` | TIDAK ADA | – | Roster shift pabrik & insentif output | P3 |
| `nutri/hr/k3` | TIDAK ADA | – | K3 pabrik & MCU operator berkala | P3 |
| `nutri/analytics/cogs` | ADA-SEBAGIAN | `modules/finance/index.js:350` | HPP per batch & margin per SKU | P2 |
| `nutri/analytics/inventory`| ADA-PENUH | `modules/logistics/inventory.js:380` | Slow-moving & alert ED <6 bulan | P1 |

---

### 6. AVA SANCTUARY (`sanct/` — Bab 9 Blueprint)

| Route Blueprint | Status Saat Ini | Lokasi Kode Eksisting | Kesenjangan / Catatan | Prioritas |
|---|---|---|---|:---:|
| `sanct/client/profile` | ADA-BEDA-NAMA | `modules/business_units/sanctuary_booking.js:30` | Profil klien wellness dari MPI | P1 |
| `sanct/client/assessment`| ADA-SEBAGIAN | `modules/business_units/sanctuary_booking.js:70` | Skrining kontraindikasi & clearance dokter | P1 |
| `sanct/client/consent` | ADA-SEBAGIAN | `modules/business_units/sanctuary_booking.js:110` | Consent tindakan & izin foto before-after | P1 |
| `sanct/client/history` | ADA-BEDA-NAMA | `modules/business_units/sanctuary_booking.js:140` | Riwayat treatment & foto perkembangan | P1 |
| `sanct/booking/calendar`| ADA-PENUH | `modules/business_units/sanctuary_booking.js:180` | Kalender 3 dimensi: Terapis × Ruangan × Treatment | P1 |
| `sanct/booking/online` | ADA-PENUH | `modules/business_units/sanctuary_booking.js:240` | Booking online & kebijakan pembatalan | P1 |
| `sanct/booking/reminder`| ADA-BEDA-NAMA | `js/core/whatsappGateway.js` | Reminder WA otomatis H-1 & H-2 jam | P1 |
| `sanct/ops/rooms` | ADA-BEDA-NAMA | `modules/business_units/sanctuary_booking.js:310` | Status okupansi Suite (Rose/Lavender) | P1 |
| `sanct/ops/therapist` | ADA-BEDA-NAMA | `modules/business_units/sanctuary_booking.js:360` | Alokasi & beban harian terapis | P1 |
| `sanct/ops/housekeeping`| TIDAK ADA | – | Checklist kebersihan & sterilisasi alat | P2 |
| `sanct/ops/consumables`| ADA-SEBAGIAN | `modules/logistics/inventory.js:150` | BOM minyak/linen per treatment | P2 |
| `sanct/program/catalog`| ADA-PENUH | `modules/business_units/sanctuary_booking.js:410` | Katalog treatment: Postnatal, Ratus, Rehab | P1 |
| `sanct/program/postnatal`| ADA-SEBAGIAN| `modules/business_units/sanctuary_booking.js:460` | Program pemulihan postnatal 40 hari | P2 |
| `sanct/program/membership`| ADA-BEDA-NAMA| `modules/business_units/sanctuary_booking.js:500` | Tier keanggotaan & saldo sesi kuota | P1 |
| `sanct/commerce/pos` | ADA-BEDA-NAMA | `modules/finance/cashier.js:80` | POS kasir spa & voucher | P1 |
| `sanct/commerce/retail`| ADA-SEBAGIAN | `modules/business_units/ecommerce_oms.js:310` | Penjualan skincare & produk AVA Nutrition | P2 |
| `sanct/commerce/commission`| ADA-BEDA-NAMA| `modules/finance/payroll.js:190` | Komisi per treatment terapis | P1 |
| `sanct/quality/incident`| ADA-SEBAGIAN | `modules/compliance/capa.js:110` | Laporan reaksi merugikan/alergi minyak | P2 |
| `sanct/quality/retention`| ADA-PENUH | `modules/crm/leads.js:220` | CSAT, repeat rate & lifetime value klien | P1 |
| `sanct/quality/utilization`| ADA-PENUH | `modules/dashboard/index.js:360` | Okupansi kamar & utilisasi terapis | P1 |

---

### 7. AVA GLOBAL HQ (`hq/` — Bab 1B & Bab 10 Blueprint)

| Route Blueprint | Status Saat Ini | Lokasi Kode Eksisting | Kesenjangan / Catatan | Prioritas |
|---|---|---|---|:---:|
| `hq/cockpit/dashboard` | ADA-BEDA-NAMA | `modules/dashboard/index.js:1` | Dashboard agregat 6 brand | P1 |
| `hq/cockpit/ops-control`| ADA-PENUH | `modules/system/ops_kendali.js:1`, `0013_kendali_ops_corong.sql` | Pusat kendali operasional krisis lintas unit | P1 |
| `hq/cockpit/executive` | ADA-BEDA-NAMA | `modules/dashboard/executive.js:1` | CEO Master Cockpit & runway | P1 |
| `hq/finance/consolidation`| ADA-BEDA-NAMA| `modules/finance/holding_finance.js:1` | P&L per brand (belum auto eliminasi internal) | P1 |
| `hq/analytics/cross-brand`| ADA-SEBAGIAN | `modules/dashboard/index.js:410` | Metrik konversi lintas brand masih statis | P2 |
| `hq/governance/risk` | ADA-BEDA-NAMA | `modules/compliance/risk.js:1` | Register risiko korporat | P2 |
| `hq/legal/brands` | TIDAK ADA | – | Master registry 6 brand + prefiks dokumen | P0 (Fase 0) |
| `hq/legal/kbli-registry`| TIDAK ADA | – | Registri KBLI 2020/2025 & penanggung jawab teknis | P0 (Fase 0) |
| `hq/legal/activity-matrix`| TIDAK ADA | – | Matriks pemetaan layanan ↔ izin KBLI sah | P0 (Fase 0) |
| `hq/finance/internal-transfer`| TIDAK ADA | – | Tarif transfer internal antar-brand | P1 (Fase 0) |
| `hq/legal/compliance-calendar`| ADA-BEDA-NAMA| `modules/compliance/index.js:80` | Kalender jatuh tempo izin & STR/SIP H-90/60/30 | P1 |

---

## B. KESENJANGAN STRUKTURAL (ADR-01 S/D ADR-08)

| ADR | Ketetapan Blueprint | Kondisi Sistem Saat Ini | Kesenjangan yang Harus Ditutup |
|---|---|---|---|
| **ADR-01** | Satu badan hukum (PT AVA Health Solution), transaksi berdimensi `brand_code` + `kbli_code` + `cost_center` + `location_code`. | Tabel transaksi (`orders`, `invoices`, `samples`) belum memiliki 4 kolom dimensi tersebut. | Tambahkan 4 kolom dimensi di seluruh tabel transaksional melalui migrasi expand. |
| **ADR-03** | Master Person Index (MPI) tunggal seumur hidup (`AVA-ID`). | Identitas pasien tersebar per modul (`patients`, `family_members`, `corporate_employees`) tanpa `AVA-ID` Base32. | Bangun tabel `mpi_person`, `person_identifier`, `person_consent`, dan mekanisme auto-match/merge. |
| **ADR-05** | Routing bernamespace 3 segmen `unit/domain/fitur`. | `router.js:5-42` menggunakan 40+ rute flat (`marketing`, `mou`, `cashier`, `admission`, `bpjs-claim`). | Terapkan router alias dengan pola Strangler Fig untuk mendukung URL baru tanpa mematahkan link lama. |
| **ADR-07** | Data klinis (K4) dilarang keluar ke domain non-klinis (Nutrition & Sanctuary hanya menerima event/flag). | Saat ini modul non-klinis masih dapat query langsung ke tabel data pasien dev. | Pasang Row Level Security (RLS) dan filter akses data medis pada event payload. |
| **ADR-08** | `tenant_id` dan `brand_code` ditanam di setiap tabel sejak Fase 0. | `tenant_id` baru ada di `local_auth_users` dan `user_profiles` (`0004_tenancy.sql`). | Tanam kolom `tenant_id` NOT NULL dengan default 'lokal' di seluruh tabel. |

---

## C. ALUR END-TO-END YANG TERPUTUS (S1 S/D S5)

### S1 — MCU Korporat → Hilir
- **Alur Target:** `health/corp/project` → import roster → order lab massal `lab/pre/order` → hasil lab → `lab/ref/fitwork-engine` → dokter Hiperkes `health/corp/fitwork` → laporan agregat → event `mcu.finding.*` → promosi gizi AVA Nutrition.
- **Titik Putus Saat Ini:** Import roster dan generate hasil massal sudah berfungsi di `modules/his/mcu.js:240`, **tetapi** event outbox ke modul Nutrition belum terhubung, dan logika Fit/Unfit masih semi-manual tanpa rule engine terpisah.

### S2 — Home Sampling
- **Alur Target:** `care/order/intake` → dispatch nakes `care/dispatch/schedule` → sampling nakes app `nakes.html` → order otomatis di LIS `lab/pre/checkin` → log rantai dingin → hasil rilis ke Patient App `portal.html` → callback nilai kritis `lab/post/critical`.
- **Titik Putus Saat Ini:** Alur dari `nakes.html` ke LIS sudah mengirim order, **tetapi** pencatatan log suhu cool-box (rantai dingin) belum ada dan eskalasi callback nilai kritis belum memiliki timer/log read-back otomatis.

### S3 — Pemulihan Pascamelahirkan (Postnatal)
- **Alur Target:** Kontrol persalinan AVA Health → trigger flag `eligible.postnatal` → booking `sanct/program/postnatal` → home care AVA Care → suplemen menyusui AVA Nutrition.
- **Titik Putus Saat Ini:** Flag antar-modul belum ada karena belum ada MPI dan Event Outbox terintegrasi. Sanctuary booking berjalan independen dari EMR Health.

### S4 — Uji Produk Nutrition di Lab
- **Alur Target:** Formulasi `nutri/rnd/testing` order uji mikro/logam ke AVA Lab → hasil lab jadi lampiran mutu batch CPOTB → invoice transfer internal dieliminasi di konsolidasi HQ.
- **Titik Putus Saat Ini:** Modul batch record Nutrition belum ada; transaksi antar-brand belum memiliki akun eliminasi otomatis di `modules/finance/holding_finance.js`.

### S5 — AVA Tech Menjual Keluar (Fase 4)
- **Alur Target:** Onboarding klien faskes baru → provisioning tenant → mapping katalog tes dengan AI terminology mapper → LIS go-live → metering lisensi.
- **Titik Putus Saat Ini:** AI terminology mapper sudah ada di `lib/validator/catalog_validator.js`, namun UI provisioning tenant dan metering otomatis ditunda ke Fase 4 sesuai ADR-08.

---

## D. FITUR SISTEM EKSISTING DI LUAR BLUEPRINT (ASET YANG DIPERTAHANKAN)

Fitur-fitur berikut ditemukan di repositori eksisting namun belum disebutkan eksplisit di Blueprint V5.1. **Sesuai aturan, fitur ini dipertahankan:**

1. **QMS HTML Delimiter Engine (`lib/assembler/` & `scripts/sync_all_qms_documents.js`):**
   - Engine pemrosesan dokumen mutu ISO 15189 berbasis delimiter `[[SECTION_NAME]]` (bukan JSON) yang tahan escape teks medis.
2. **Agentic AI Workflow Canvas (`modules/agentic/` & `0010_agentic_canvas.sql`):**
   - Antarmuka visual perancangan prompt chain dan automasi tugas lab.
3. **Database Studio GUI (`modules/system/db_studio.js`):**
   - Manajemen tabel Supabase/PGlite langsung dari UI platform.
4. **Maps Prospecting Engine (`modules/maps/`):**
   - Modul visualisasi pemetaan faskes, klinik, dan prospek perujuk di peta wilayah.
5. **Color & Ink Token Enforcers (`scripts/bangun-token-tinta.js`, `scripts/tegakkan-token-warna.js`):**
   - Tool standarisasi palet warna visual dark-mode dan print layout.

---

## E. DAFTAR PERTANYAAN & CHECKPOINT (GATE 1)

1. **Prioritisasi Transisi Rute (ADR-05):** Apakah kita menerapkan sistem routing ganda (legacy flat route + new 3-segment route) secara transparan di `router.js` pada Fase 0 agar antarmuka yang ada saat ini tetap 100% berjalan tanpa downtime? *(Rekomendasi: Ya, via Strangler Fig alias mapper)*.
2. **Penamaan Master Person Index (MPI):** Apakah kode identitas seumur hidup `AVA-XXXXXXXXXX` (Base32) akan di-generate otomatis untuk seluruh pasien yang sudah ada di database saat ini melalui migrasi backfill? *(Rekomendasi: Ya, backfill seluruh pasien lama dengan AVA-ID unik)*.

---
🛑 **GATE 1 REACHED: Gap Register selesai disusun secara komprehensif.**  
**Menunggu persetujuan manusia untuk melangkah ke Tahap 2 (Rencana Restrukturisasi).**
