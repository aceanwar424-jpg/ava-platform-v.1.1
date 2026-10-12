# Audit sisa acceptance 44 menu — 12 Oktober 2026

OWNED_BY: generic. Baseline kode 2441a20; audit read-only sumber/migrasi/router/test dan pembaruan dokumentasi. Tidak menjalankan ulang tes/database; PASS di bawah adalah bukti eksekusi sebelumnya, bukan rerun audit ini.

## Kesimpulan
44 dari daftar 44 masih parsial untuk acceptance penuh; tidak ada menu dalam daftar ini dinaikkan menjadi tuntas. Ini daftar pekerjaan pengembangan dan pembuktian yang tersisa, bukan 44 menu kosong. Matriks rincian: ACCEPTANCE-44-MENU-2026-10-09.md. Audit ini tidak menilai ulang 211 menu di luar matriks.

## Yang sudah tersedia dan jangan dihitung ulang sebagai belum dibangun
- 0079/0086: tiket lifecycle, perubahan/rilis, report dan verifikasi instalasi. 2441a20: guard konteks tenant pada board/form; 4 browser race PASS.
- 0080/0081: episode pasien/relasi ibu-bayi, credential/privilege profesional individual dan review.
- 0082–0091: room reconciliation, invoice/jurnal, deposit/direct payment/refund, reviewed eligibility penjamin, alokasi manfaat per-stay, payer payment/refund/reversal. RUNBOOK-PAYER-0087-0091.md menyatakan batas paket.
- 0092–0104: farmasi sumber, harga/batch tenant, reviewed Rx/FEFO, MAR/custody/register controlled, signed discharge/resume/housekeeping, invoice dan penutupan episode. 41 skenario SQL/browser/race PASS sebelumnya; bukan 41 menu tuntas.

## Sisa pekerjaan per kelompok
1. Alur pasien, bed, resource, housekeeping: simulasi terpadu booking → IGD/admission → pindah unit/bed → tindakan → pulang → bed siap → revisit; checklist turnaround, kaitan PPI serta sumber legacy penuh. Kapasitas masih snapshot; interval historis/cutover/denominator BOR/ALOS/TOI/BTO belum ada.
2. Keperawatan/formulir/IGD/ICU/maternitas/day-care: handover dan flowsheet lengkap, tugas/eskalasi, triage/disposition dan waktu sumber, perangkat/intake-output/step-down, observasi kelahiran ibu-bayi dan billing individual; paket tindakan/observasi/completion day-care. MAR sumber tersedia tetapi integrasi semua unit belum acceptance.
3. OK/CSSD/transfusi: source checklist anestesi/recovery serta stock/billing terhubung; set CSSD individual, cycle/indikator/Bowie-Dick sesuai SOP reviewed, release/recall; komponen darah individual, crossmatch profesional, reservasi/issue/reaction/return. 0078 masih menolak issue darah ke pasien; quality work order selesai belum bukti cycle/crossmatch sumber.
4. Diet/PPI: asesmen/order diet → kitchen → produksi/distribusi/retur, alergi/stock; surveillance sumber, denominator/version HAIs, isolasi dan CAPA.
5. Transport/linen/facility/mortuary/shared-stock: dispatch/receive dan keselamatan/turnaround; laundry dirty-clean/sort/loss/distribution; preventive/corrective/downtime/sparepart → readiness; keputusan meninggal/identifikasi/storage/custody/handover; adapter component/set dan transaksi unit terhubung.
6. Farmasi/master obat/pemulangan/billing: master obat dan formularium lifecycle/version/retirement, ownership alergi legacy, valuasi/COGS; seluruh jalur clinical legacy/cutover, amendment/exception serta kaitan unit/payer; benefit override tarif/metode kamar dan cap selain stay. Alokasi/settlement payer dasar sudah tersedia.
7. HIS/LIS integration: source handoff → inbox/outbox, versi/amendment hasil, ACK internal, retry/dedup/reconcile dan simulator berlabel. Koneksi/ACK vendor produksi belum tersedia dan terpisah dari pembangunan lokal.
8. Tech/evidence: delivery kontrak/onboarding/milestone/acceptance/closure; SLA eksplisit dan customer success; hubungan ticket/release/installation ke delivery; regresi navigasi aplikasi penuh. evidence berversi → risk/CAPA → verifikasi efektivitas dengan sumber.
9. Non-RS: nutrition BOM/batch/QC/release/deviation/complaint/recall; wellness program/consent/schedule/attendance/follow-up/evaluasi; rewards eligibility/rules/quota/redeem/reversal/settlement anti-double redemption; sanctuary resource/consent/service/housekeeping/billing/exception.
10. Sembilan konfigurasi: policy benar digunakan semua mesin/gate legacy; unit/resource/bed referensi downstream; user–employee–practitioner/jadwal/clinical gate; MPI/identity/link/consent/duplicate/penjamin; kontrak versi/effective/harga; MCU parameter versi/report; payment account/fees/reversal/settlement; queue loket/device → serve/close/tenant; medicine master/formulary lifecycle dan downstream.

## Gap kualitas data terpisah
Katalog generated 633 baris belum clinical-ready: 633 UNVERIFIED, 45 warning mismatch kode/label, total 678 warning dan 0 error struktural sesuai eksekusi sebelumnya. Gate clinical_import sudah tersedia. Perlu review analit/mapping/range/acuan/IFU profesional; tidak cukup mengubah flag menjadi VERIFIED. Kunci join/range tidak diubah oleh audit.

## Dasar audit dan batas bukti
Router masih memakai renderHospitalOperations untuk capacity/CSSD/diet/transfusion/linen/mortuary, dan renderReadiness untuk tech-delivery. hospital_operations.js menjelaskan kapasitas saat ini dan indikator historis belum dihitung. 0078 guard darah mensyaratkan adapter individual/crossmatch. Migrasi terbaru 0104; sumber runbook dan STATUS menunjukkan paket teruji di atas. Fixture/unit-test PASS belum menggantikan simulasi seluruh aplikasi lintas 44 menu, cutover, exception, role/tenant, retry/race, UI desktop/mobile dan teardown.

## Keputusan pemilik
Tidak ada keputusan baru yang wajib untuk melanjutkan implementasi dan uji sintetis lokal berdasarkan persetujuan yang sudah diberikan. SOP/acuan/IFU, reviewer dan master tenant nyata harus disahkan sebelum penggunaan operasional nyata. Koneksi vendor/DB produksi tetap membutuhkan checkpoint terpisah; bukan alasan menghentikan pekerjaan lokal.

## Implikasi IP & Kepatuhan
Audit/dokumentasi generik; tanpa pasien atau aset privat baru, tanpa skema/master key changes, tanpa DB/vendor. Tidak mengklaim kesiapan klinis/ISO dari kelulusan struktural atau renderer menu. Original/history dan bukti provenance dipertahankan.
