# Acceptance penuntasan 44 menu

OWNED_BY: generic. Persetujuan 1A/2A/3A: preserve histori + explicit cutover/opening, SOP non-RS konfigurabel direview, reviewer klinis individu saat setup. Pengembangan dan tes sintetis lokal diizinkan; produksi/vendor tidak diizinkan. Status menu tidak dinaikkan hanya berdasarkan renderer, total agregat, simulator, atau transaksi yang diblokir.

Setiap baris memerlukan kontrak source ID, transaksi/version/idempotency, role/RLS/audit, alur SQL dan UI positif/negatif, error/retry, serta teardown dummy. Kolom terakhir mencatat acceptance yang masih harus dibuktikan, bukan keputusan baru yang perlu ditanyakan ulang.

| Menu | Sumber / bagian yang tersedia | Acceptance lanjutan |
|---|---|---|
| evidence-register | compliance/master existing | evidence berversi → risk/CAPA → verifikasi efektivitas, tautan sumber |
| tech-roadmap | tech_changes, 0079 SQL6/UI6 | pengaitan delivery/acceptance dan regresi navigasi aplikasi penuh |
| tech-modul | perubahan sukses → tech_module_deployments, 0079 | pengaitan delivery; telemetry vendor tetap nonaktif |
| tech-isu | tech_support_tickets, 0079 | SLA eksplisit, pengaitan delivery/customer success |
| tech-delivery | sumber Tech existing | kontrak, onboarding, milestone, acceptance, SLA dan penutupan berbukti |
| his-integration | order_terintegrasi_papan | handoff sumber → inbox/outbox → retry/reconcile; simulator diberi label |
| rs-patient-flow | admissions + episode 0080, SQL9/UI6 | pengaitan bed, billing, unit klinis dan revisits dalam simulasi terpadu |
| rs-bed-reservation | inpatient_beds + 0071/73 | alur booking/admisi/pindah/pulang terintegrasi episode; race native lulus |
| rs-housekeeping | work orders + source bed | checklist riil/turnaround, pengaitan PPI dan indikator |
| rs-nurse-station | episode/form/work orders | handover, flowsheet, MAR sumber farmasi, tugas dan eskalasi |
| rs-discharge | checklist source + inpatient discharge | obat/penjamin/tagihan/status keluar end-to-end terintegrasi |
| rs-igd-flow | episode IGD + form/template | triage/tindakan/disposition, timestamp dan indikator sumber |
| rs-inpatient-billing | inpatient_charges + tagihan_posting | kamar kalender/24jam/hourly, prorata/tertinggi/cutoff, penjamin/deposit/reversal |
| rs-capacity | kapasitas bed + resources | BOR/ALOS/TOI/BTO historis dari interval sah, cutover dan denominator |
| rs-clinical-forms | 0076 + reviewer/privilege 0081 | formulir spesifik/MAR/flowsheet dan seluruh jalur legacy terkait |
| rs-operating-room | resource booking + work orders | checklist/source klinis/anestesi/recovery/CSSD/billing terpadu |
| rs-cssd | shared stock + quality work orders | set individual, cycle indikator/Bowie-Dick sesuai SOP, release dan recall |
| rs-diet | tugas gizi | asesmen diet, order kitchen, produksi/distribusi/retur, alergi dan stok |
| rs-transfusion | quality work orders; patient issue diblokir | komponen individual, uji/crossmatch profesional, reservation/issue/reaction/return |
| rs-ppi | work orders | surveillance sumber, denominator/version, HAIs/isolasi/CAPA |
| rs-ward-pharmacy | source pharmacy berbeda | adapter pharmacy_drugs/ledger, resep/verifikasi/dispense/MAR/retur/reconcile |
| rs-transport | source work orders | request berbasis pasien/unit, dispatch/receive, resource/safety/turnaround |
| rs-resource-booking | 0077 SQL7/UI5; race native | pengaitan unit klinis dan actual legacy source penuh |
| rs-shared-stock | 0078 SQL8/UI6; race native | adapters pharmacy/component/set; pengaitan transaksi unit end-to-end |
| rs-critical-care | episode/form | flowsheet, perangkat, intake/output, eskalasi dan step-down sumber |
| rs-maternity | relasi ibu–bayi 0080 append-only | episode ibu/bayi, observasi/source kelahiran dan billing individual |
| rs-day-care | episode/work orders | booking, asesmen, tindakan, observasi, completion/billing |
| rs-linen | shared lot inventory | order laundry/dirty-clean/sort/loss/distribution per unit dan turnaround |
| rs-facility | master resources + work orders | inspeksi/preventive/corrective/downtime/spare parts → readiness |
| rs-mortuary | work orders | sumber keputusan meninggal, identifikasi, custody, storage dan handover terverifikasi |
| lis-integration | lab_samples/result sources | inbox/hasil/versi amendment, ACK internal, retry/outbox/reconcile |
| nutrition-quality | wellness_batch/pabrik_uji_mutu | BOM/batch/QC/release/deviation/complaint/recall bersumber nyata |
| wellness-program | wellness sources | program/consent/jadwal/attendance/follow-up/evaluasi lifecycle |
| partner-rewards | voucher_campaigns/vouchers | rules/kuota/eligibility/redeem/reversal/settlement dan anti-double redemption |
| sanctuary-operations | spa_reservasi/okupansi | kalender/resource/consent/service/housekeeping/billing/exception |
| cfg-rs-policy | governance 0074 + reviewer 0081 | seluruh rule benar-benar digunakan mesin dan gate legacy |
| cfg-facility | his_master_records existing | semua referensi unit/resource/bed valid dan digunakan downstream |
| cfg-practitioner | registry + workforce 0081 SQL9/UI5 | hubungan user–employee/praktisi sumber, jadwal dan seluruh clinical legacy gate |
| cfg-patient | MPI/patient sources | identity/link/consent/penjamin, duplication/error dan downstream admission |
| cfg-corporate | contract/benefit sources | review/effective/version dan penggunaan harga/eligibility nyata |
| cfg-mcu | parameter/package sources | versi parameter digunakan pada MCU/report/review |
| cfg-payment | payment sources | metode/account/fees/reversal/settlement benar-benar diterapkan |
| cfg-queue | queue sources | flow/config/loket/device → ticket/call/serve/close dan tenancy |
| cfg-medicine | pharmacy/master sources | formularium/aturan sah → resep/verifikasi/dispense/MAR sumber |

## Bukti tahap ini

0079: SQL6/UI6. 0080: SQL9/UI6, termasuk amendment relasi dan larangan membuka source visit yang sudah pulang. 0081: SQL9/UI5. Native PostgreSQL17.10: lima persaingan dua backend PID berbeda (bed/resource/retry/stok/handover); contender benar-benar menunggu transaksi sesi pertama. Semua cluster/record dummy ditutup/dihapus. Paket runtime temporary tidak berisi record; penghapusan direktorinya ditolak kebijakan tool dan tidak dipaksakan. Regresi dicatat di STATUS-PROYEK.md.

Belum menerima keseluruhan 44 menu. Persetujuan klinis tenant nyata dan kesiapan vendor merupakan penerimaan terpisah; ketidaktersediaan vendor tidak menghalangi pembangunan adapter/simulator lokal sesuai keputusan pengguna.
