# Backlog

## Audit LIS â€” 2026-09-06

Rincian bukti dan acceptance: [laporan audit](docs/archive/AUDIT-LIS-MENDALAM-2026-09-06.md). Setiap irisan awal â‰¤1 jam; pecah lanjutan sebelum implementasi. Tidak mengaktifkan integrasi produksi atau mengubah master dari backlog ini.

- [ ] P0: hapus angka TAT pengganti dan grafik analyzer sintetis dari tampilan operasional (LIS-01/02).
- [ ] P0: perbaiki status panel parsial dan pemetaan tabungâ€“layanan (LIS-03).
- [ ] P0: rancang transisi server verifikasi/rilis, hitungan berhasil dan event setelah commit (LIS-04).
- [ ] P0: identitas riwayat stabil, QR lokal dan versi laporan final (LIS-07).
- [ ] P0: satukan kontrak evaluator QC; inventaris RPC autoverifikasi aktif sebelum aktivasi (LIS-05/06).
- [ ] P1: pagination dan error yang eksplisit; pengaturan klinis terpusat (LIS-08/11).
- [ ] P1: satukan transaksi log/acknowledgment nilai kritis (LIS-10).
- [ ] P1: uji fault connector dan desain inbox durable/checksum/deduplikasi (LIS-09).
- [ ] P1: isolasi helper simulasi dan pensiunkan jalur walk-in lama setelah penelusuran pemanggil (LIS-12/13/14).
- [ ] P1: uji escaping, endpoint role/tenant, login dan viewport di staging (LIS-15).
- [ ] P1: selaraskan label Verifikasi Teknis, Otorisasi & Rilis, Lot Kontrol serta layout operator.
- [ ] P2: validasi kebutuhan nyata sebelum modul khusus mikrobiologi/AP/bank darah atau perluasan besar lain.

## Apps â€” tindak lanjut audit 2026-09-08
- Audit RLS dan role user_profiles dengan dua tenant sintetis.
- Pisahkan data contoh dan layanan simulasi dari alur operasional pasien.
- Pulihkan sesi melalui validasi server; ganti SSO query-token dengan alur aman.
- Jadikan klaim cashback transaksi server yang idempoten.
- Uji EHR terikat patient ID/tenant dan akun resmi sebelum release publik.

