# OneLab — Fase 4: Keuangan & SDM (SAP FI / CO / HCM)

> Induk: [ONELAB_ROADMAP.md](ONELAB_ROADMAP.md) · Sebelumnya: [Fase 3](ONELAB_FASE3.md) · Berikutnya: [Fase 5](ONELAB_FASE5.md)

**Kenapa fase ini.** Ini kesenjangan terdalam: **FI/CO baru 12%**. Yang ada hanya faktur
penjualan (`modules/finance.js`, 360 baris) dan kasir. Tidak ada buku besar, jurnal, hutang
usaha, pusat biaya, maupun aset tetap — sehingga laporan keuangan tetap disusun manual di luar
sistem, dan **profitabilitas per layanan tidak terukur**.

Kenapa baru sekarang: seluruh modul lain sudah lebih dulu menghasilkan angka yang siap diposting
— kasir, faktur, penerimaan barang, pengeluaran barang, komisi nakes, penggajian.

---

## 4.1 Bagan akun + jurnal + buku besar

**Yang dikerjakan.**

| Bagian | Rincian |
|---|---|
| Bagan akun (COA) | Struktur akun standar: aset, kewajiban, ekuitas, pendapatan, beban — bernomor dan berjenjang |
| Jurnal | Entri berpasangan debit–kredit, selalu seimbang, tidak bisa dihapus (hanya dibalik) |
| Buku besar | Saldo per akun per periode, bisa ditelusuri sampai transaksi asalnya |
| Periode | Buka/tutup periode; periode tertutup tidak menerima entri baru |
| Neraca & laba rugi | Dihasilkan sistem, bukan disusun manual di spreadsheet |

---

## 4.2 Posting otomatis dari modul lain

**Ini yang membuat buku besar hidup.** Tanpa posting otomatis, jurnal hanya jadi pekerjaan
tambahan.

| Sumber | Jurnal yang terbentuk |
|---|---|
| Kasir menerima pembayaran | Kas ↑ / Pendapatan ↑ |
| Faktur diterbitkan | Piutang ↑ / Pendapatan ↑ |
| Faktur dilunasi | Kas ↑ / Piutang ↓ |
| Penerimaan barang (GR) | Persediaan ↑ / Hutang sementara ↑ |
| Pengeluaran barang (GI) | Beban pemakaian ↑ / Persediaan ↓ |
| Selisih opname | Beban selisih persediaan / Persediaan |
| Retur pembelian | Hutang ↓ / Persediaan ↓ |
| Penggajian | Beban gaji ↑ / Hutang gaji ↑ |
| Penyusutan aset | Beban penyusutan ↑ / Akumulasi penyusutan ↑ |

Semua kejadian di atas **sudah tercatat di sistem** — tinggal dipetakan ke akun.

---

## 4.3 Hutang usaha (AP) + jadwal bayar

**Bergantung pada Fase 2.4** (faktur supplier & pencocokan tiga arah).

- Daftar hutang per supplier dengan umur hutang
- Jadwal pembayaran dan pemilihan faktur yang akan dibayar
- Pencatatan pembayaran → jurnal otomatis (Hutang ↓ / Kas ↓)
- Rekap kewajiban jatuh tempo untuk perencanaan kas

---

## 4.4 Pusat biaya → profitabilitas per layanan

**Masalah sekarang.** Semua beban menumpuk jadi satu. Tidak bisa dijawab: apakah Home Care
menguntungkan? Berapa margin sebenarnya per pemeriksaan lab?

**Yang dikerjakan.**

- Pusat biaya per unit: Laboratorium, Radiologi, Home Care, MCU, Umum & Administrasi
- Setiap beban dibebankan ke pusat biaya — pengeluaran barang sudah punya kolom divisi, tinggal
  dipetakan
- Pendapatan juga ditandai per unit
- Laporan **laba rugi per unit layanan**

**Bonus dari Fase 2.1.** Setelah pemakaian BHP terpotong otomatis per pemeriksaan, harga pokok
per tes bisa dihitung nyata: reagen + BHP + komisi + alokasi beban tetap.

---

## 4.5 Aset tetap + penyusutan + jadwal kalibrasi

**Masalah.** Tidak ada daftar aset sama sekali, padahal alat laboratorium adalah aset termahal
dan `analyzers` sudah terdaftar sebagai master alat di modul LIS.

**Yang dikerjakan.**

- Daftar aset: alat lab, alat radiologi, kendaraan, perangkat IT — nilai perolehan, tanggal
  perolehan, masa manfaat
- Penyusutan otomatis per periode → jurnal
- **Jadwal kalibrasi & pemeliharaan** yang tersambung ke master `analyzers`, dengan pengingat
  jatuh tempo — ini juga persyaratan ISO 15189 dan bersinggungan dengan QC alat (Fase 5.5)
- Riwayat perbaikan dan biayanya

---

## 4.6 Penggajian sungguhan

**Masalah.** `renderPayrollTab` saat ini hanya **tabel estimasi**: BPJS dipukul rata 4% dari
gaji pokok, tanpa komponen lain. Belum bisa dipakai membayar orang.

**Yang dikerjakan.**

| Bagian | Rincian |
|---|---|
| Komponen | Gaji pokok, tunjangan tetap & tidak tetap, lembur, komisi (dari Fase 2.3), potongan |
| BPJS | Kesehatan & Ketenagakerjaan dengan porsi perusahaan dan karyawan sesuai ketentuan, bukan angka tunggal |
| PPh 21 | Perhitungan pajak penghasilan bulanan dan tahunan |
| Lembur | Dari data absensi yang sudah ada |
| Saldo cuti | Kuota tahunan yang berkurang otomatis saat cuti disetujui |
| Slip gaji | Terbit per karyawan, bisa diunduh |
| Periode terkunci | Setelah dibayarkan, periode tidak bisa diubah |
| Jurnal | Beban gaji per pusat biaya (4.4) |

---

## 4.7 Tutup kas per shift + setoran bank

**Masalah.** Kasir sudah lengkap (pembayaran, kembalian, refund, struk, laporan) tetapi tidak
ada penutupan kas.

**Yang dikerjakan.**

- Buka & tutup shift kasir dengan saldo awal dan akhir
- Berita acara selisih kas (lebih/kurang) beserta penjelasannya
- Setoran ke bank tercatat → jurnal (Bank ↑ / Kas ↓)
- Rekap per kasir per shift

---

## Skema yang dibutuhkan

Berkas migrasi: `supabase_fase4_keuangan.sql`

```sql
-- inti akuntansi
CREATE TABLE IF NOT EXISTS chart_of_accounts (code, name, type, parent_code, is_active, ...);
CREATE TABLE IF NOT EXISTS journal_entries   (entry_no, entry_date, description, source_type,
                                              source_id, posted_by, period, ...);
CREATE TABLE IF NOT EXISTS journal_lines     (entry_id, account_code, debit, credit,
                                              cost_center_id, ...);
CREATE TABLE IF NOT EXISTS accounting_periods(period, status, closed_at, ...);

-- pusat biaya
CREATE TABLE IF NOT EXISTS cost_centers (code, name, unit_type, ...);

-- hutang usaha (lanjutan Fase 2.4)
CREATE TABLE IF NOT EXISTS ap_payments (vendor_invoice_id, paid_at, amount, method, ...);

-- aset tetap
CREATE TABLE IF NOT EXISTS fixed_assets   (asset_code, name, analyzer_id, acquired_at,
                                           cost, useful_life_months, ...);
CREATE TABLE IF NOT EXISTS depreciations  (asset_id, period, amount, ...);
CREATE TABLE IF NOT EXISTS asset_maintenance (asset_id, type, due_date, done_at, cost, ...);

-- penggajian
CREATE TABLE IF NOT EXISTS payroll_runs      (period, status, run_at, locked, ...);
CREATE TABLE IF NOT EXISTS payroll_items     (run_id, employee_id, component, amount, ...);
CREATE TABLE IF NOT EXISTS leave_balances    (employee_id, year, quota, used, ...);

-- kas
CREATE TABLE IF NOT EXISTS cashier_shifts (cashier_name, opened_at, closed_at,
                                           opening_balance, closing_balance, variance, ...);
```

---

## Definisi selesai

- [ ] Pembayaran di kasir otomatis membentuk jurnal yang seimbang
- [ ] Neraca dan laba rugi bisa dicetak dari sistem tanpa spreadsheet
- [ ] Laba rugi per unit (Lab / Radiologi / Home Care) bisa ditampilkan
- [ ] Harga pokok per pemeriksaan terhitung dari pemakaian BHP nyata
- [ ] Faktur supplier yang lolos pencocokan masuk jadwal bayar dan menjurnal saat dibayar
- [ ] Penyusutan alat berjalan otomatis dan jadwal kalibrasi mengingatkan sebelum jatuh tempo
- [ ] Slip gaji terbit lengkap dengan BPJS dan PPh 21, periodenya terkunci setelah dibayar
- [ ] Kasir menutup shift dengan berita acara selisih

## Risiko fase ini

| Risiko | Penanganan |
|---|---|
| Bagan akun salah rancang sejak awal sulit diperbaiki | Susun bersama akuntan/konsultan pajak sebelum satu baris kode ditulis |
| Posting otomatis salah akun → laporan menyesatkan | Jalankan paralel dengan pembukuan manual selama satu periode penuh sebelum diandalkan |
| PPh 21 salah hitung → risiko pajak | Verifikasi dengan konsultan pajak; sediakan penyesuaian manual |
| Periode terkunci menghambat koreksi | Sediakan jurnal balik yang tercatat, bukan membuka kembali periode |
