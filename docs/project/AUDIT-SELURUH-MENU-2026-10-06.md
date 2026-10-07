# Audit keseluruhan menu — 6 Oktober 2026

OWNED_BY: generic. Audit kode lokal dan inventaris, tanpa data pasien nyata, perubahan skema atau akses database produksi. Perubahan workspace pekerjaan lain sedang berlangsung; laporan menggambarkan kode saat audit.

## Cakupan dan hasil

251 entri pada 17 kategori menu internal: **210 ada, 40 parsial, 1 belum**. Delapan menu readiness yang sebelumnya keliru berstatus `ada` kini ditandai `parsial`. Portal konsumen memiliki 19 entri tambahan dan perangkat pendukung 5; keduanya tercatat terpisah dalam inventaris, belum disimulasikan ulang end-to-end pada audit ini. Entri bukan hitungan kemampuan unik.

Pemeriksaan `node scripts/bangun-menu.js --periksa`, `node scripts/audit-menu-hidup.js`, dan `node scripts/uji/audit_all_menus.js` lulus pemeriksaan statis. Tidak ditemukan menu berstatus ada tanpa route/judul. Audit menu hidup memeriksa 215 menu sesuai cakupan filternya, dengan 343 tabel/view dan 345 fungsi dikenali. Pesan “100%” skrip route hanya menyatakan kecocokan navigasi; tidak membuktikan fitur lengkap, migrasi produksi tersedia, atau integrasi berhasil.

Inventaris setiap menu beserta status, kategori, route dan penanda readiness ada di [menu-inventory.json](../audit-evidence/2026-10-06/menu-inventory.json).

| Kategori | Ada | Parsial | Belum |
|---|---:|---:|---:|
| Utama | 6 | 1 | 0 |
| Tech | 18 | 4 | 1 |
| HIS | 40 | 22 | 0 |
| LIS | 28 | 1 | 0 |
| Korporat | 7 | 0 | 0 |
| Wellness | 16 | 4 | 0 |
| Keuangan | 10 | 0 | 0 |
| Logistik | 8 | 0 | 0 |
| SDM | 7 | 0 | 0 |
| Mutu | 8 | 0 | 0 |
| Agentic | 3 | 0 | 0 |
| Konsumen (tautan internal) | 3 | 0 | 0 |
| Konfigurasi | 25 | 8 | 0 |
| Marketing | 10 | 0 | 0 |
| Avahealth | 7 | 0 | 0 |
| Radiologi | 7 | 0 | 0 |
| Support Medical | 7 | 0 | 0 |

## Kekurangan yang ditemukan di kode

| Area/menu | Yang tersedia | Yang belum lengkap |
|---|---|---|
| HIS Integration, LIS Integration | Ringkasan jumlah/status order dan sampel dari sumber yang sudah ada | Korelasi end-to-end, callback, antrean error/retry, rekonsiliasi order–hasil–billing. Modul integrasi LIS lain sudah memiliki implementasi; temuan bukan berarti seluruh integrasi LIS kosong. |
| Evidence Register | Snapshot jumlah izin dan kredensial serta tanggal kedaluwarsa | Register bukti lintas SOP/audit/CAPA, pemilik, keputusan review, mitigasi risiko dan tindak lanjut. |
| Tech Delivery | Snapshot tenant, tiket support dan perubahan/rilis | SLA, incident, acceptance, adopsi tenant dan lifecycle delivery belum terpadu atau diverifikasi. |
| Wellness Program, Partner Rewards | Agregat server program wellness; jumlah/status campaign dan voucher | Consent/follow-up dan rekonsiliasi challenge/reward harus ditautkan ke event pemilik; tidak otomatis dibangun ulang. |
| Nutrition Quality, Sanctuary Operations | Jumlah/status batch dan uji mutu; jumlah/status reservasi dan okupansi ruang | Genealogy batch/QC/quarantine/release/recall, penugasan petugas, consent sesi, hygiene dan tindak lanjut dari sumber operasional. |
| BPJS Claim | Kelengkapan dokumen, status, ageing dan selisih tagih/bayar | Grouper INA-CBG dan bridging VClaim nyata tidak tersedia dalam modul klaim; tarif E-Klaim dan SEP dimasukkan manual. Deskripsi menu masih menjanjikan grouper/bridging. |
| PACS Viewer | Viewer dan data gambar/order yang tersedia | Sumber PACS/DICOM belum tersambung; koneksi dan uji interoperabilitas nyata belum terbukti. |
| 21 menu RS | Bed lifecycle dan koordinasi tahap/tugas/bukti/audit | Mesin klinis, ledger stok, booking kapasitas dan integrasi billing khusus unit belum lengkap; rinci di bawah. |
| Tech Roadmap, Modul, Isu | Daftar perubahan, katalog fungsi dari manifest, dan daftar tiket read-only; control plane menyediakan pencatatan tiket | Sinkronisasi Git dan versi deployment aktual per tenant belum terbukti; lifecycle tiket masih belum menyediakan triage/assign/resolve dari menu daftar. Nomor tiket baru sekarang memakai correlation ID agar dua tiket pada detik yang sama tidak bentrok. |
| Tech Sprint | Halaman penjelasan | Planning sprint, kapasitas, beban kerja dan velocity aktual. Satu-satunya menu berstatus belum. |
| 8 hub konfigurasi | Hub fasilitas, praktisi, pasien, korporat, MCU, pembayaran, antrean, obat | Hub masih parsial. Banyak master anak sudah ada; status hub bukan bukti seluruh master belum tersedia. |
| Workforce hub | Penghubung operasional SDM | Penyatuan cuti, privilege/kompetensi, STR/SIP, substitusi shift dan timekeeping lock dengan kebijakan HR belum lengkap. |
| Agentic MCP | Beberapa demonstrasi converter/privacy/QC | Alat lain menampilkan keterangan belum tersambung; demonstrasi lokal bukan bukti panggilan server MCP nyata. |
| Dashboard Nutrition/Sanctuary | Kartu navigasi | Nilai metrik masih null dan bertanda belum tersambung ke data. |

Delapan menu readiness di atas berlabel **parsial**: `his-integration`, `lis-integration`, `evidence-register`, `tech-delivery`, `wellness-program`, `partner-rewards`, `nutrition-quality`, `sanctuary-operations`. Semua diarahkan router ke `renderReadiness`. Hub kini membaca ringkasan terbatas dari tabel/RPC yang sudah ada (order terintegrasi, sampel, program wellness, campaign/voucher, batch/uji mutu, reservasi/okupansi, tenant/tiket/perubahan, izin/kredensial), menampilkan kegagalan per sumber, dan menyediakan navigasi ke modul pemilik. Ini hanya bukti akses baca agregat; tahap proses, consent, callback, approval, retry, dan rekonsiliasi belum terbukti end-to-end. Status menu tetap parsial.

### Detail gap operasional RS

- **Bed, reservasi, housekeeping, nurse station, discharge, patient flow:** alur bed sudah disimulasikan lokal. UAT per tenant dan persaingan reservasi beberapa sesi PostgreSQL belum terbukti; fixture lokal bukan pengujian produksi.
- **IGD, ICU, maternity/neonatal, day care:** perlu pencatatan klinis terstruktur, flowsheet dan balance cairan, relasi ibu–bayi/partograf, serta catatan sesi spesifik. Workflow tahap dengan bukti belum menggantikan mesin klinis tersebut.
- **Operating room, HD/kemoterapi/day care, transport:** perlu booking sumber daya dengan deteksi benturan, kapasitas, jadwal tim dan realisasi.
- **CSSD, transfusi, farmasi bangsal, linen, diet:** perlu ledger item/batch/komponen, transaksi sumber yang terhubung, kompatibilitas/traceability komponen darah dan porsi diet. Referensi bukti bebas belum menjadi relasi transaksi sumber yang tervalidasi.
- **Billing rawat inap:** pembentukan biaya dari tindakan/akomodasi/pemakaian stok, deposit dan rekonsiliasi payer belum otomatis lengkap.
- **Capacity:** okupansi saat ini tersedia; ALOS/BTO/TOI berdasarkan periode historis belum lengkap.
- **PPI, fasilitas, mortuary:** koordinasi tugas tersedia; kedalaman surveilans, preventive maintenance dan pencatatan khusus perlu ditentukan lewat UAT unit.

21 menu parsial: `rs-patient-flow`, `rs-bed-reservation`, `rs-housekeeping`, `rs-nurse-station`, `rs-discharge`, `rs-igd-flow`, `rs-inpatient-billing`, `rs-capacity`, `rs-operating-room`, `rs-cssd`, `rs-diet`, `rs-transfusion`, `rs-ppi`, `rs-ward-pharmacy`, `rs-transport`, `rs-critical-care`, `rs-maternity`, `rs-day-care`, `rs-linen`, `rs-facility`, `rs-mortuary`.

## Temuan konfigurasi dan kejujuran status

`js/core/bpjsBridge.js` masih dimuat dua shell HTML. Pencarian referensi tidak menemukan pemanggil lain selain definisi/ekspor. Implementasi pencarian peserta menggunakan respons tetap, pembuatan SEP menghasilkan nomor acak, dan ada fallback signature mock. Ini **bukan integrasi BPJS yang terbukti**. Terdapat nilai konfigurasi menyerupai kredensial di frontend/localStorage; asal/validitas harus diverifikasi, konfigurasi rahasia nyata dipindah ke server dan dirotasi bila memang pernah aktif. Nilainya sengaja tidak disalin ke laporan. Audit tidak menghubungi BPJS.

Metadata reservasi bed masih menyebut migrasi 0070–0071; penyelesaian juga membutuhkan 0072–0073 sesuai runbook. Status penerapan produksi tidak diperiksa.

## Prioritas tindak lanjut

1. **Kejujuran status dan gerbang penggunaan:** pertahankan label readiness parsial, benahi deskripsi BPJS dan metadata migrasi; pastikan jalur simulasi tidak dianggap transaksi nyata. Verifikasi deployment dan UAT tenant dengan data sintetis.
2. **Satu alur RS nyata:** tuntaskan IGD/admission → bed → pelayanan/obat/tindakan → billing → discharge → housekeeping, termasuk transaksi sumber, rekonsiliasi dan persaingan reservasi. Bed workflow lokal sudah menjadi fondasi.
3. **Hub integrasi dan pengecualian:** order/hasil/billing, retry idempoten, rekonsiliasi serta penanggung jawab error. Integrasi vendor/produksi memerlukan checkpoint terpisah.
4. **Unit khusus berdasarkan pilot RS:** pilih satu unit nyata untuk booking kapasitas, pencatatan klinis dan ledger stok sebelum memperluas semua unit.
5. **Bukti, workforce, indikator dan Tech:** hubungkan sumber yang sudah ada, lengkapi lifecycle serta indikator historis; lanjutkan kebutuhan non-RS berdasarkan validasi pengguna.

## Bukti sumber dan batas

Sumber: `config/menu.json`, `js/core/router.js`, `modules/system/readiness.js`, `modules/compliance/bpjs_claim.js`, `js/core/bpjsBridge.js`, `modules/radiology/dicomViewer.js`, `modules/his/operations_hubs.js`, `modules/tech-platform/tech_saas.js`, `modules/agentic/mcp.js`, `modules/dashboard/index.js` di bawah `ava-platform/`.

Bukti simulasi RS: `hospital-operations-simulation.json` (21 skenario SQL) dan `hospital-ui-simulation.json` (27 skenario UI) pada folder evidence tanggal ini. Artefak tersebut tidak ditimpa selama penuntasan hub readiness. Uji `scripts/uji/test_readiness_sources.cjs`, `scripts/uji/test_master_registry_ack.cjs`, dan `scripts/uji/test_tech_ticket_number.cjs` memakai record sintetis/in-memory; tidak menulis fixture ke database atau menyimpan data uji. Kategori tanpa temuan di tabel bukan sertifikasi bahwa semua alurnya lengkap. Validasi semua fungsi secara runtime, migrasi/deployment nyata, performa dan integrasi vendor membutuhkan audit lanjutan terpisah.
