# OneLab — Peta Jalan 5 Fase (SIMRS · RIS · LIS · SAP)

Dokumen induk hasil audit fungsional **18 Juli 2026** atas 50 berkas modul / 31.830 baris /
12 kategori / 72 submenu. Rinciannya dipecah ke `ONELAB_FASE1.md` … `ONELAB_FASE5.md`.

---

## Kondisi saat ini

| Domain | Kematangan | Ringkas |
|---|---|---|
| **LIS** — Laboratorium | 80% | Terkuat. Penerimaan berbarcode, penolakan spesimen, worklist & TAT, rentang rujukan, **delta check**, validasi 2 jenjang, QC & master analyzer, parser HL7/ASTM |
| **SAP · MM** — Logistik | 70% | Baru matang (Fase 1–5 Inventory). PR berjenjang, PO, GR, GI, batch/FEFO, opname, kartu stok, MRP, valuasi & ABC, retur |
| **CRM & Sales** | 65% | Partner, leads, deals, MOU, surat bernomor, voucher, MCU proyek, OKR |
| **SAP · HCM** — SDM | 45% | Karyawan, cuti, jadwal, absensi. Penggajian masih **tabel estimasi**, BPJS dipukul rata 4% |
| **SIMRS** — Klinik | 25% | Pendaftaran sangat rinci (51 fungsi), anamnesa, kasir. Rekam medis **baca-saja** (5 fungsi) |
| **RIS** — Radiologi | 15% | 393 baris, menumpang tabel `lab_results`, hanya unggah berkas + cetak |
| **SAP · FI/CO** — Akuntansi | 12% | Hanya faktur penjualan + kasir |

### Yang benar-benar kosong (terverifikasi dari kode)

- Rawat inap — nihil (bed, bangsal, visite, resume pulang)
- Farmasi / apotek — nihil ("Apotek" hanya muncul sebagai jenis mitra)
- Klaim BPJS / INA-CBG — BPJS hanya label cara bayar + potongan payroll
- Satu Sehat / FHIR — nihil (menu bertanda *soon*)
- Buku besar, jurnal, hutang usaha, pusat biaya, aset tetap — nihil
- PACS / DICOM, worklist modalitas, alur baca radiolog — nihil
- SOAP / CPPT — nihil

---

## Lima fase

| Fase | Fokus | Kenapa urutannya begini |
|---|---|---|
| **[1](ONELAB_FASE1.md)** | Fondasi, Keamanan & Keselamatan Pasien | Risiko hukum & keselamatan berlaku atas data yang **sudah ada sekarang**. Tidak boleh menambah modul di atas fondasi yang bocor |
| **[2](ONELAB_FASE2.md)** | Menyambung yang Sudah Ada | Termurah, dampak terbesar. Mesinnya sudah dibangun, tinggal disambungkan antar modul |
| **[3](ONELAB_FASE3.md)** | Rekam Medis & Alur Klinik | Fondasi SIMRS. Tanpa rekam medis yang bisa ditulis, klaim tak bisa disusun |
| **[4](ONELAB_FASE4.md)** | Keuangan & SDM (FI/CO/HCM) | Semua modul lain sudah menghasilkan angka yang siap diposting |
| **[5](ONELAB_FASE5.md)** | Kepatuhan & Ekspansi | Pekerjaan besar yang butuh keputusan bisnis lebih dulu |

---

## Lacak kemajuan

Centang saat selesai. Perbarui berkas ini setiap fase rampung.

### Fase 1 — Fondasi, Keamanan & Keselamatan Pasien
- [x] 1.0 Kirim JWT pengguna + perbarui sesi (prasyarat RLS)
- [x] 1.1a RLS — akses anon ke data pasien ditutup (terverifikasi; perlu jalankan rls_a_fix.sql untuk patient_ids)
- [ ] 1.1b RLS — pengetatan per peran (SQL siap, jalankan setelah 1.1a bersih)
- [x] 1.2 Penegakan peran di sisi server (RPC) — approve_pr, reject_pr, adjust_stock, receive_po, post_goods_issue, finish_opname
- [x] 1.3 Nilai kritis lab — pelaporan terstruktur ISO 15189 (deteksi ternyata sudah ada)
- [x] 1.4 Operasi multi-tabel jadi atomik — 6 alur inventory kini satu transaksi
- [x] 1.5 Jejak audit terstandar — write_audit() + before_data/after_data, ditulis di dalam RPC

### Fase 2 — Menyambung yang Sudah Ada
- [x] 2.1 Auto goods-issue — resep BHP + trigger di lab_results (tak bisa dilewati jalur mana pun)
- [x] 2.2 Home Care → rekam medis — pencarian pasien + tautan mr_number
- [x] 2.3 Komisi nakes → penggajian — ditarik otomatis saat gaji dihitung
- [x] 2.4 Pencocokan tiga arah — vendor_invoices + match_vendor_invoice()
- [x] 2.5 Kontrol anggaran — sisa pagu tampil saat menyusun PR + peringatan bila melampaui
- [x] 2.6 Multi-gudang — stok per lokasi + pemindahan atomik (total tidak berubah)
- [x] 2.7 Telusur lot — lab_result_consumption mencatat batch per hasil (dua arah)

### Fase 3 — Rekam Medis & Alur Klinik
- [x] 3.1 Rekam medis bisa ditulis — SOAP/CPPT + tanda tangan mengunci (trigger), koreksi via adendum
- [x] 3.2 Alergi (banner keselamatan), daftar masalah, tanda vital + tren — menempel di mr_number
- [~] 3.3 ICD-10 — kolom is_primary + trigger satu diagnosis utama; UI dokter menyusul
- [ ] 3.4 Garis waktu kunjungan pasien
- [x] 3.5 Antrian bernomor + layar ruang tunggu (auto-refresh 15 dtk)
- [x] 3.6 Perjanjian + pengingat WhatsApp + deteksi bentrok sumber daya

### Fase 4 — Keuangan & SDM
- [x] 4.1 Bagan akun (template klinik, dapat dikoreksi) + jurnal + buku besar + periode
- [x] 4.2 Posting otomatis via trigger — kasir, pengeluaran barang, opname, komisi home care
- [x] 4.3 Hutang usaha — pembayaran hanya untuk faktur yang lolos pencocokan tiga arah
- [x] 4.4 Pusat biaya → laba rugi per unit layanan
- [~] 4.5 Jadwal kalibrasi alat SELESAI; penyusutan menunggu bagan akun
- [x] 4.6 Penggajian sungguhan — komponen, BPJS, PPh 21 berlapis, slip gaji, periode terkunci
- [x] 4.7 Tutup kas per shift — total sistem dihitung dari transaksi, selisih wajib dijelaskan

### Fase 5 — Kepatuhan & Ekspansi
- [ ] 5.1 Satu Sehat (FHIR) Kemenkes
- [ ] 5.2 Klaim BPJS / INA-CBG
- [ ] 5.3 RIS sebagai modul tersendiri
- [ ] 5.4 Laporan Kemenkes RL 1–5 terisi otomatis
- [~] 5.5 LIS lanjutan — autoverifikasi + Westgard multi-run + Levey-Jennings SELESAI; antarmuka alat langsung & rujukan luar menyusul
- [ ] 5.6 Multi-cabang / unit

---

## Sengaja ditunda

| Modul | Alasan |
|---|---|
| **Rawat inap** | Sebesar modul Inventory yang baru selesai. Hanya dikerjakan bila memang ada keputusan membuka layanan rawat inap |
| **Farmasi / apotek** | Setara besarnya. Butuh master obat, resep elektronik, dispensing, interaksi obat, formularium |
| **Auto-posting sosial media** | Sudah diputuskan tetap manual (spec Agentic §5.2) |

Mengerjakan keduanya bersamaan dengan lima fase di atas akan membuat semuanya setengah jadi.

---

## Catatan penamaan

Menyebut sistem ini "SIMRS" saat ini belum tepat. Tanpa rawat inap, farmasi, dan klaim BPJS,
yang ada adalah **sistem klinik rawat jalan + LIS + ERP logistik** — dan dalam kapasitas itu
cakupannya sudah kuat. Penamaan sebaiknya menyesuaikan sampai Fase 5 selesai.

## Kekuatan yang perlu dijaga

LIS di aplikasi ini lebih lengkap daripada banyak produk komersial: penolakan spesimen,
delta check, validasi dua jenjang, dan QC alat jarang ditemukan sekaligus. Jangan sampai
tergerus saat mengejar modul lain.

---

## Arsitektur & aturan main

- **Vanilla JS tanpa proses build.** Ini kekuatan untuk tim kecil — semua fase di atas
  dikerjakan di dalam struktur yang ada. Tidak ada rencana ganti kerangka kerja.
- **Migrasi SQL bersifat idempoten** (`IF NOT EXISTS`), dijalankan manual di Supabase SQL Editor.
- **Urutan rilis:** jalankan SQL fase tersebut **sebelum** hard-refresh, karena kode fase
  bergantung pada skemanya.
- **Cache:** naikkan `?v=` pada aset di `index.html` setiap merilis perubahan CSS/modul.
