# OneLab — Fase 1: Fondasi, Keamanan & Keselamatan Pasien

> Induk: [ONELAB_ROADMAP.md](ONELAB_ROADMAP.md) · Fase berikutnya: [Fase 2](ONELAB_FASE2.md)

**Kenapa fase ini lebih dulu.** Dua risiko di sini berlaku atas data yang **sudah tersimpan
sekarang**, bukan atas fitur yang akan datang: data pasien dapat dibaca siapa pun yang memegang
kunci publik, dan hasil lab yang mengancam jiwa belum punya jalur notifikasi. Menambah modul
apa pun di atas fondasi ini hanya memperbesar paparan.

---

## 1.1 RLS aktif + kebijakan berbasis peran

**Masalah.** Sekitar **109 tabel** memakai `DISABLE ROW LEVEL SECURITY`, termasuk
`homecare_orders`, `admissions`, `anamnesas`, `lab_results`, dan `medrecord`. Aplikasi memanggil
PostgREST langsung memakai **anon key yang tertanam di `js/core/api.js`** — artinya kunci itu
ada di setiap browser pengguna. Siapa pun yang membukanya bisa membaca seluruh data pasien:
nama, telepon, alamat, diagnosis, hasil lab.

**Risiko.** UU PDP. Data kesehatan termasuk data pribadi spesifik dengan ancaman sanksi
administratif dan pidana.

**Yang dikerjakan.**

| Langkah | Rincian |
|---|---|
| Autentikasi nyata | Pastikan semua akses memakai token pengguna (`Authorization: Bearer <jwt>`), bukan anon key polos |
| Tabel peran | `user_profiles.role` jadi sumber kebenaran, dibaca dari JWT claim — bukan dari objek browser |
| Kebijakan bertingkat | Data pasien: hanya staf klinis & admin. Data keuangan: finance & manajemen. Data SDM: HRD & atasan langsung |
| Aktifkan bertahap | Mulai dari tabel paling sensitif (`admissions`, `anamnesas`, `lab_results`, `homecare_*`, `medrecord`), bukan 109 sekaligus |
| Uji regresi | Tiap tabel yang diaktifkan RLS-nya harus diuji dengan akun tiap peran sebelum lanjut |

**Peringatan.** Mengaktifkan RLS tanpa kebijakan yang benar akan **membuat aplikasi tampak
kosong** — semua query mengembalikan nol baris. Karena itu dikerjakan tabel demi tabel dengan
pengujian, bukan sekali jalan.

---

## 1.2 Penegakan peran di sisi server

**Masalah.** `getUserRole()` membaca `window.currentUser` di browser. Seluruh pemeriksaan
wewenang — termasuk persetujuan PR berjenjang (`invCanApproveSPV/Manager/HeadOps`) dan validasi
hasil lab — dijalankan di sisi klien. Pengguna dengan peramban dan sedikit pengetahuan dapat
mengubahnya, lalu menyetujui PR bernilai berapa pun atau memvalidasi hasil lab.

**Yang dikerjakan.**

- Pindahkan aksi berwewenang ke **Postgres RPC** (`SECURITY DEFINER`) yang memeriksa peran dari
  JWT di dalam basis data:
  - `approve_pr(pr_id, tier, note)` — memverifikasi peran & urutan jenjang
  - `validate_lab_result(result_id)` / `approve_lab_result(result_id)`
  - `adjust_stock(item_id, qty, reason)`
  - `post_goods_issue(payload)`
- Fungsi JS yang ada tetap dipakai sebagai **pemandu tampilan** (menyembunyikan tombol),
  bukan sebagai pengaman.

---

## 1.3 Nilai kritis lab + notifikasi wajib-baca

**Masalah.** Modul hasil sudah punya rentang rujukan, interpretasi, dan **delta check**
(`showDeltaCheck` di `modules/lab/results.js`) — tetapi tidak ada konsep **nilai kritis**:
hasil yang mengancam jiwa dan wajib dikomunikasikan ke dokter dalam hitungan menit, lengkap
dengan catatan siapa dihubungi, kapan, dan oleh siapa.

**Kenapa penting.** ISO 15189 mensyaratkan ini. Secara medis, ini pembeda antara hasil yang
"tercatat" dan pasien yang tertangani.

**Yang dikerjakan.**

| Bagian | Rincian |
|---|---|
| Master ambang | Tambah `critical_low` / `critical_high` pada `ref_ranges` (mis. K⁺ <2,5 atau >6,5; Hb <7; Glukosa <40) |
| Deteksi otomatis | Saat hasil disimpan, nilai di luar ambang kritis ditandai dan **tidak bisa lewat diam-diam** |
| Alur notifikasi | Tabel `critical_value_notifications`: hasil, nilai, siapa menghubungi, dihubungi siapa, kapan, cara (telepon/WA), respons dokter |
| Tidak bisa ditutup | Hasil kritis wajib dicatat komunikasinya sebelum status bisa lanjut |
| Laporan | Rekap waktu tanggap nilai kritis — bukti untuk asesor akreditasi |

---

## 1.4 Operasi multi-tabel jadi atomik

**Masalah.** Beberapa alur melakukan banyak `sbPatch`/`sbPost` berurutan tanpa transaksi.
Bila gagal di tengah (jaringan putus), data jadi tidak sinkron:

- `saveReceivePO` — `po_items`, `inventory_items`, `stock_ledger`, `inventory_batches`
- `finishOpname` — `stock_opname_items`, `inventory_items`, `stock_ledger`
- `saveGoodsIssue` — `goods_issues`, `goods_issue_items`, stok, ledger, batch
- `saveHCVisit` — rekam kunjungan, status order, `issueStock` per BHP

**Akibat nyata.** Stok berkurang tetapi ledger tidak tercatat, atau sebaliknya — selisih yang
baru ketahuan saat opname dan tidak bisa ditelusuri.

**Yang dikerjakan.** Bungkus tiap alur di atas menjadi satu RPC Postgres sehingga seluruh
perubahan berhasil bersama atau dibatalkan bersama. Sekaligus menyelesaikan 1.2 karena
pemeriksaan peran ikut masuk ke dalam fungsi yang sama.

---

## 1.5 Jejak audit terstandar

**Masalah.** `activity_logs` sudah ada dan sebagian aksi sudah mencatat (adjustment stok,
persetujuan PR, goods issue, retur, status Home Care) — tetapi belum menyeluruh dan formatnya
belum seragam. Aksi klinis (input hasil, validasi, ubah data pasien) belum tercatat.

**Yang dikerjakan.**

- Seragamkan bentuk catatan: `aksi`, `tabel`, `id`, `sebelum`, `sesudah`, `oleh`, `kapan`.
- Wajibkan pencatatan pada semua aksi yang mengubah data klinis dan keuangan.
- Catatan **tidak boleh bisa dihapus** dari aplikasi.
- Layar penelusuran: cari berdasarkan pasien, pengguna, atau rentang waktu.

---

## Skema yang dibutuhkan

Berkas migrasi: `supabase_fase1_fondasi.sql`

```sql
-- ambang nilai kritis
ALTER TABLE ref_ranges
  ADD COLUMN IF NOT EXISTS critical_low  numeric,
  ADD COLUMN IF NOT EXISTS critical_high numeric;

-- komunikasi nilai kritis
CREATE TABLE IF NOT EXISTS critical_value_notifications (...);

-- jejak audit seragam
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS before_data jsonb,
  ADD COLUMN IF NOT EXISTS after_data  jsonb;

-- RPC atomik + pemeriksaan peran
CREATE OR REPLACE FUNCTION approve_pr(...) SECURITY DEFINER ...
CREATE OR REPLACE FUNCTION post_goods_issue(...) SECURITY DEFINER ...
CREATE OR REPLACE FUNCTION finish_opname(...) SECURITY DEFINER ...
```

---

## Definisi selesai

- [ ] Akun peran `sales` tidak bisa membaca `lab_results` maupun `admissions` lewat REST langsung
- [ ] Peran non-manajemen tidak bisa menyetujui PR meski memanipulasi JavaScript di browser
- [ ] Hasil di luar ambang kritis tidak bisa diselesaikan tanpa catatan komunikasi
- [ ] Mematikan jaringan di tengah penerimaan PO tidak meninggalkan stok yang tidak sinkron
- [ ] Setiap perubahan data klinis muncul di layar penelusuran audit

## Risiko fase ini

| Risiko | Penanganan |
|---|---|
| RLS salah kebijakan → aplikasi tampak kosong | Aktifkan per tabel + uji tiap peran sebelum lanjut |
| RPC mengubah perilaku yang sudah jalan | Pertahankan jalur lama sampai RPC terbukti, baru alihkan |
| Nilai kritis mengganggu alur kerja harian | Ambang diisi bersama penanggung jawab lab, bukan ditebak |
