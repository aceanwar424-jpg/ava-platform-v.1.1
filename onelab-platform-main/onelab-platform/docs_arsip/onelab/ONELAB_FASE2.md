# OneLab — Fase 2: Menyambung yang Sudah Ada

> Induk: [ONELAB_ROADMAP.md](ONELAB_ROADMAP.md) · Sebelumnya: [Fase 1](ONELAB_FASE1.md) · Berikutnya: [Fase 3](ONELAB_FASE3.md)

**Kenapa fase ini paling menguntungkan.** Hampir semua mesinnya **sudah dibangun** — hanya belum
disambungkan antar modul. `issueStock()` sudah ada dan sudah dipakai Home Care; tipe pergerakan
`TRANSFER` sudah didefinisikan tapi belum pernah dipakai; komisi nakes sudah dihitung tapi
berhenti sebagai laporan. Fase ini menyambungkan yang terputus, bukan membangun yang baru.

---

## 2.1 Auto goods-issue dari Lab / MCU / Radiologi

**Masalah.** Ini temuan kritis nomor dua dari audit awal dan **masih berlaku**. Modul Lab, MCU,
dan Radiologi tidak pernah memotong stok. Pemakaian reagen dan BHP harian tidak tercatat, jadi:

- `avg_monthly_usage` untuk MRP tidak pernah akurat kecuali diisi manual
- Harga pokok per pemeriksaan tidak terukur
- Stok hanya berubah lewat penerimaan PO, adjustment, dan opname — selisihnya menumpuk

**Yang sudah tersedia.** `window.issueStock(itemId, qty, refType, refId, refNo, notes)` di
`modules/inventory.js` — sudah menangani potong stok, tulis ledger `OUT`, dan konsumsi batch FEFO.
Home Care sudah memakainya lewat form dokumentasi kunjungan.

**Yang dikerjakan.**

| Titik sambung | Rincian |
|---|---|
| Resep BHP per pemeriksaan | Tabel `product_consumables`: satu produk/tes memakai barang apa saja, berapa banyak. Ini kuncinya — tanpa ini pemotongan tetap manual |
| Lab | Saat sampel diproses (`processSample`), potong stok sesuai resep BHP tes tersebut |
| MCU | Saat paket MCU dijalankan, potong sesuai gabungan resep tiap tes di paket |
| Radiologi | Potong film/kontras per jenis pemeriksaan |
| Pengaman | Bila stok tidak cukup: peringatkan, jangan blokir pekerjaan klinis — catat sebagai minus untuk ditelusuri |

**Dampak.** Setelah ini berjalan, tombol *Hitung Pemakaian dari Histori* di MRP (sudah dibuat)
akan menghasilkan angka yang benar-benar mencerminkan konsumsi nyata.

---

## 2.2 Home Care → rekam medis pasien

**Masalah.** Dokumentasi kunjungan Home Care (tanda vital, keluhan, tindakan, catatan asuhan)
sudah tersimpan di `homecare_visit_records`, tetapi **terputus dari riwayat pasien**. Pasien
yang sama bisa punya kunjungan Home Care dan pemeriksaan lab tanpa keduanya saling terlihat.

**Yang dikerjakan.**

- Isi `homecare_orders.patient_id` (kolom sudah ada, belum dipakai) dengan tautan ke pasien nyata
- Pencarian pasien di form Home Care memakai basis data pasien, bukan ketik bebas
- Kunjungan Home Care muncul di garis waktu rekam medis
- Sampel yang diambil di rumah otomatis membuat order lab, bukan dicatat terpisah

---

## 2.3 Komisi nakes → penggajian

**Masalah.** `commission_amount` sudah dihitung per order dari master tarif/nakes dan direkap
di layar Penagihan & Komisi — lalu berhenti di situ. Pembayarannya tetap manual di luar sistem.

**Yang dikerjakan.**

- Komponen penghasilan tambahan pada karyawan yang terhubung ke `homecare_staff.employee_id`
- Rekap komisi per periode masuk sebagai komponen penggajian (bergantung Fase 4.6)
- Penandaan komisi yang sudah dibayarkan agar tidak terhitung dua kali

---

## 2.4 Pencocokan tiga arah PO–Penerimaan–Faktur

**Masalah.** Pengendalian utama SAP yang belum ada. Saat ini PO dibuat dan barang diterima,
tetapi faktur supplier tidak pernah dicocokkan ke keduanya sebelum dibayar.

**Yang dikerjakan.**

| Bagian | Rincian |
|---|---|
| Faktur supplier | Tabel `vendor_invoices` — nomor faktur, tanggal, jatuh tempo, nilai, tautan ke PO |
| Aturan cocok | Bandingkan qty dipesan vs diterima vs ditagih, dan harga PO vs harga faktur |
| Toleransi | Selisih kecil (mis. ±2%) lolos otomatis; di atas itu perlu persetujuan |
| Blokir bayar | Faktur yang belum cocok tidak bisa masuk jadwal pembayaran |

Ini juga fondasi untuk Hutang Usaha di Fase 4.3.

---

## 2.5 Kontrol anggaran pada PR

**Masalah.** Persetujuan PR sudah berjenjang menurut nominal (<1jt SPV; 1–5jt +Manager;
>5jt +Head Ops), tetapi tidak ada pagu. Divisi bisa mengajukan berapa pun sepanjang ada
yang menyetujui.

**Yang dikerjakan.**

- Tabel `budgets`: pagu per divisi per periode, per kategori barang
- Saat PR disubmit: tampilkan sisa pagu; bila melampaui, butuh jenjang persetujuan lebih tinggi
- Laporan serapan anggaran per divisi

---

## 2.6 Multi-gudang & pemindahan antar lokasi

**Masalah.** `inventory_items.location` hanya teks bebas ("Gudang A, Rak 3"). Tipe pergerakan
`TRANSFER` sudah didefinisikan di kartu stok **tetapi tidak pernah dipakai** — tidak ada cara
memindahkan barang antar lokasi secara tercatat.

**Yang dikerjakan.**

- Tabel `warehouses` (gudang/unit: Gudang Pusat, Lab, Radiologi, Tas Nakes)
- Stok per barang **per lokasi**, bukan satu angka global
- Dokumen pemindahan: keluar dari lokasi asal, masuk ke lokasi tujuan, tercatat di kartu stok
- Tas/kit nakes sebagai sub-lokasi — BHP yang dibawa keluar tetap milik perusahaan sampai terpakai

---

## 2.7 Tautan hasil ke lot reagen

**Masalah.** Batch/kedaluwarsa sudah tersimpan (`inventory_batches`), dan FEFO sudah berjalan
saat pengeluaran barang. Tetapi hasil pemeriksaan tidak menyimpan **lot reagen mana** yang dipakai.

**Kenapa penting.** Bila satu lot reagen bermasalah, harus bisa ditarik daftar semua hasil yang
memakainya untuk ditinjau ulang. Ini persyaratan telusur ISO 15189.

**Yang dikerjakan.** Simpan `batch_id` pada hasil lab saat goods-issue otomatis (2.1) berjalan,
lalu sediakan penelusuran dua arah: dari lot → daftar hasil, dan dari hasil → lot.

---

## Skema yang dibutuhkan

Berkas migrasi: `supabase_fase2_integrasi.sql`

```sql
-- resep BHP per produk/tes  (kunci untuk 2.1)
CREATE TABLE IF NOT EXISTS product_consumables (
  product_id bigint, item_id bigint, qty_per_test numeric, ...
);

-- gudang & stok per lokasi (2.6)
CREATE TABLE IF NOT EXISTS warehouses (...);
CREATE TABLE IF NOT EXISTS stock_by_location (item_id, warehouse_id, qty, ...);
CREATE TABLE IF NOT EXISTS stock_transfers (...);

-- faktur supplier & pencocokan (2.4)
CREATE TABLE IF NOT EXISTS vendor_invoices (...);

-- anggaran (2.5)
CREATE TABLE IF NOT EXISTS budgets (division, period, category, amount, ...);

-- telusur lot (2.7)
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS batch_id bigint;

-- tautan pasien (2.2) — kolom sudah ada, tinggal dipakai
-- homecare_orders.patient_id
```

---

## Definisi selesai

- [ ] Menjalankan satu pemeriksaan lab mengurangi stok reagen sesuai resep BHP-nya
- [ ] Tombol *Hitung Pemakaian dari Histori* di MRP menghasilkan angka wajar tanpa input manual
- [ ] Kunjungan Home Care muncul di riwayat pasien yang sama dengan hasil labnya
- [ ] Faktur supplier yang qty-nya tidak cocok dengan penerimaan tidak bisa dijadwalkan bayar
- [ ] PR yang melampaui pagu divisi memicu jenjang persetujuan lebih tinggi
- [ ] Barang bisa dipindah antar gudang dan tercatat sebagai `TRANSFER` di kartu stok
- [ ] Dari satu lot reagen bisa ditarik daftar hasil yang memakainya

## Risiko fase ini

| Risiko | Penanganan |
|---|---|
| Resep BHP belum lengkap → stok terpotong salah | Mulai dari 10–20 tes tersering, sisanya bertahap |
| Pemotongan stok memblokir pekerjaan klinis | Stok kurang hanya memperingatkan, tidak menghentikan |
| Migrasi ke stok per lokasi mengacaukan saldo | Semua stok awal masuk ke satu gudang default, dipindah bertahap |
