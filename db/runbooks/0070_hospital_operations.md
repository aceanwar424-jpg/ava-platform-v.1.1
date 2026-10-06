# Operasional RS 0070–0073 — runbook

OWNED_BY: generic. Persetujuan chat mencakup skema repo dan pengujian lokal. Penerapan ke produksi belum diotorisasi.

## Sebelum penerapan

1. Backup dan jadwalkan maintenance; jalankan preflight read-only `db/preflight/0070_hospital_operations_preflight.sql`.
2. Pastikan skema rawat inap existing beserta RPC sudah tersedia. Instalasi desktop membangun baseline lalu migrasi; instalasi cloud yang belum punya baseline harus melalui konsolidasi migrasi resmi, bukan menjalankan SQL arsip secara acak. Migrasi ini tidak membuat skema LIS/akuntansi/rawat inap dasar.
3. Tinjau kepemilikan setiap bed dengan pemilik data. Jangan memberi seluruh bed tenant aktif secara otomatis. Siapkan mapping bed ID → tenant UUID yang terverifikasi, termasuk bangsal isolasi/kelas/SOP.
4. Lakukan UAT peran dokter, perawat, farmasi, finance, housekeeping dan penerima shift dengan fixture sintetis di staging. Buktikan RLS melalui role `authenticated`, bukan query DB owner. Uji konkurensi dua sesi PostgreSQL pada satu bed; simulasi PGlite satu sesi hanya memverifikasi constraint dan hasil kompetisi berurutan.
5. Stage transisi unit khusus menyimpan referensi bukti operasional. Tidak mengklaim mesin klinis, bank darah, persediaan CSSD, partograf, flowsheet ICU, grouper, atau ledger baru. Kebenaran dokumen sumber wajib ditinjau petugas; field referensi bukan pemeriksaan klinis otomatis.

## Urutan penerapan yang perlu persetujuan produksi

Jalankan 0070, 0071, 0072, lalu 0073 lewat migration runner resmi. Pada maintenance, DB administrator menerapkan mapping terverifikasi sebelum membuka aplikasi:

```sql
BEGIN;
CREATE TEMP TABLE reviewed_bed_map (bed_id bigint PRIMARY KEY, tenant_id uuid NOT NULL);
-- Isi pasangan ID bed/tenant yang sudah ditinjau; jangan memakai default atau ID contoh.
-- INSERT INTO reviewed_bed_map VALUES (...);
ALTER TABLE public.inpatient_beds DISABLE TRIGGER rs_bed_guard;
UPDATE public.inpatient_beds b SET tenant_id=m.tenant_id
FROM reviewed_bed_map m WHERE b.id=m.bed_id AND b.tenant_id IS NULL;
ALTER TABLE public.inpatient_beds ENABLE TRIGGER rs_bed_guard;
ALTER TABLE public.inpatient_stays DISABLE TRIGGER rs_stay_guard;
UPDATE public.inpatient_stays s SET tenant_id=a.tenant_id
FROM public.admissions a WHERE a.id=s.admission_id AND s.tenant_id IS NULL;
ALTER TABLE public.inpatient_stays ENABLE TRIGGER rs_stay_guard;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.inpatient_beds WHERE tenant_id IS NULL)
    OR EXISTS(SELECT 1 FROM public.inpatient_stays WHERE tenant_id IS NULL)
    OR EXISTS(SELECT 1 FROM public.inpatient_stays s JOIN public.inpatient_beds b ON b.id=s.bed_id WHERE s.status='Dirawat' AND s.tenant_id<>b.tenant_id)
  THEN RAISE EXCEPTION 'Mapping belum lengkap/konsisten; transaksi dibatalkan'; END IF;
END $$;
COMMIT;
```

Bed lama tanpa mapping tidak terlihat dan tidak dapat dipakai. Episode lama ditaut deterministik dari admissions; tidak mengubah identitas pasien/kunci katalog. Audit migrasi mapping harus dicatat oleh administrator. Jangan mengubah kepemilikan bed yang sudah terisi tanpa keputusan manusia dan audit.

Bed yang sudah berstatus Dibersihkan sebelum migrasi belum punya cleanup_order_id; setelah mapping, petugas terotorisasi memanggil `inp_set_bed_status(bed_id,'Dibersihkan',catatan)` untuk membuat tugas housekeeping baru. Selesaikan tahap dan verifikasi sebelum layanan dibuka. Jangan menganggap verifikasi historis telah tercatat oleh sistem baru.

## Verifikasi hulu–hilir

`node scripts/uji/test_hospital_operations.cjs` dan `node scripts/qa-hospital-operations.cjs`. Bukti di `docs/audit-evidence/2026-10-06/`. Periksa reservasi tertahan, pembersihan dan handover antar aktor, serta error ketika migrasi/RPC tidak tersedia. Konfirmasi checklist DPJP → farmasi → perawat → finance sebelum pemulangan. Release bed dipicu penyelesaian housekeeping, bukan tombol manual.

## Rollback

Jika UAT gagal sebelum penerapan, jangan apply. Jika migrasi sudah diterapkan: hentikan mutasi RS, backup tabel `rs_*` beserta audit, dan kembalikan frontend ke commit sebelumnya. Melepas trigger/RLS akan melemahkan kontrol dan memerlukan keputusan manusia; jangan otomatis drop tabel/kolom atau menghapus reservasi/bukti. Terapkan forward fix terotorisasi setelah menilai episode aktif. Restore backup hanya dengan pemilik data dan downtime terencana.
