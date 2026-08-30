# PANDUAN MENDAFTARKAN SUBDOMAIN DI VERCEL

**Domain:** `avahealth.sbs`
**Nameserver:** Vercel (sudah aktif)
**Paket:** Hobby — wildcard tidak tersedia, jadi tiap subdomain didaftarkan satu per satu
**Project Vercel:** `onelab-platform-cjb5`

---

## YANG PALING PENTING DULU

**Jangan pakai kotak "DNS Records" di halaman Domains.**

Nameserver domain Anda sudah Vercel. Artinya begitu sebuah subdomain
di-*Connect* ke sebuah project, **Vercel membuat DNS-nya sendiri secara
otomatis**. Menambah record `A 76.76.21.21` secara manual justru bisa
bertabrakan dengan yang dibuat Vercel, dan gejalanya sulit dilacak —
sertifikat SSL gagal terbit atau subdomain kadang hidup kadang mati.

Cukup satu jalur: **Domains → Connect**.

---

## LANGKAH BAKU (berlaku untuk semua subdomain)

1. Buka **Vercel → Domains → `avahealth.sbs`**
2. Klik tombol **Connect** (kanan atas panel *Connected Projects*)
3. Isi **Domain**: `<subdomain>.avahealth.sbs`
4. Pilih **Project**: `onelab-platform-cjb5`
5. **Redirect**: kosongkan — biarkan *No Redirect*
   Kecuali untuk `lab.` dan `korporat.` (lihat catatan di tabel)
6. Klik **Add**
7. Tunggu status berubah menjadi **Valid Configuration** (biasanya < 1 menit)

Ulangi untuk tiap baris di tabel berikut.

> **Tidak perlu redeploy** setiap kali menambah subdomain. Routing-nya
> ditentukan `vercel.json` yang sudah ter-deploy, berdasarkan header `Host`.

---

## URUTAN PENDAFTARAN

Diurutkan dari yang paling dibutuhkan. Kalau ingin bertahap, kerjakan
Gelombang 1 dulu — itu sudah membuat sistem bisa dipakai.

### Sudah tersambung (4)

| Subdomain | Menyajikan |
|---|---|
| `avahealth.sbs` | redirect ke `www` — biarkan apa adanya |
| `www.avahealth.sbs` | Web utama / company profile |
| `apps.avahealth.sbs` | Portal pasien |
| `kiosk.avahealth.sbs` | Kiosk antrian lobi |

---

### GELOMBANG 1 — Operasional inti (5 subdomain)

Tanpa ini staf tidak bisa bekerja.

| # | Subdomain | Menyajikan | Dipakai siapa |
|---|---|---|---|
| 1 | `ops.avahealth.sbs` | Cockpit Holding — **semua menu** | Direksi, Head of Ops |
| 2 | `his.avahealth.sbs` | Klinik & seluruh layanan non-lab | Dokter, perawat, admisi, farmasi, radiologi |
| 3 | `lis.avahealth.sbs` | Laboratorium | Analis, dr. Sp.PK |
| 4 | `tech.avahealth.sbs` | AVA Tech — lisensi, tenant, penjualan sistem | Tim Tech |
| 5 | `corp.avahealth.sbs` | Portal klien korporat (login PIC) | PIC perusahaan klien |

### GELOMBANG 2 — Layanan lapangan & konsumen (4)

| # | Subdomain | Menyajikan | Dipakai siapa |
|---|---|---|---|
| 6 | `nakes.avahealth.sbs` | Aplikasi nakes lapangan | Perawat/bidan home care |
| 7 | `lacak.avahealth.sbs` | Pelacakan kunjungan (publik, bertoken) | Pasien home care |
| 8 | `app.avahealth.sbs` | Portal pasien (alias `apps.`) | Pasien |
| 9 | `wellness.avahealth.sbs` | Ruang kerja Wellness — Nutrition + Care + Sanctuary | Tim wellness |

### GELOMBANG 3 — Layar & monitor (2)

| # | Subdomain | Menyajikan | Dipakai siapa |
|---|---|---|---|
| 10 | `antrian.avahealth.sbs` | Display TV ruang tunggu | Layar TV |
| 11 | `crm.avahealth.sbs` | Monitor CRM penjualan | Layar tim sales |

### GELOMBANG 4 — Etalase publik per pilar (3)

| # | Subdomain | Menyajikan | Catatan |
|---|---|---|---|
| 12 | `care.avahealth.sbs` | Etalase AVA Care | `portal.html`, menyorot Pilar 4 |
| 13 | `nutri.avahealth.sbs` | Etalase AVA Nutrition | Halaman khusus `nutri.html` |
| 14 | `sanctuary.avahealth.sbs` | Etalase Queen Sanctuary | `portal.html`, menyorot Pilar 6 |

### GELOMBANG 5 — Alias (opsional, 4)

Boleh dilewati. Tambahkan hanya kalau alamatnya memang dipakai/dicetak.

| # | Subdomain | Sama dengan | Redirect? |
|---|---|---|---|
| 15 | `lab.avahealth.sbs` | `lis.` | **Ya** → `lis.avahealth.sbs` |
| 16 | `korporat.avahealth.sbs` | `corp.` | **Ya** → `corp.avahealth.sbs` |
| 17 | `cek.avahealth.sbs` | `app.` | Tidak — biarkan menyajikan langsung |
| 18 | `console.avahealth.sbs` | `tech.` (mendarat di layar Lisensi) | Tidak |

> Untuk dua yang bertanda **Ya**: pada langkah 5, isi kolom **Redirect to**
> dengan tujuannya, pilih **307 Temporary**. Ubah ke **308 Permanent** hanya
> kalau sudah yakin — peramban menyimpan redirect permanen sangat lama dan
> sulit dibatalkan.

---

## DOMAIN SALAH KETIK `avahelath.sbs`

**Jangan daftarkan 22 subdomain-nya di Vercel.** Itu menggandakan pekerjaan
tanpa manfaat.

Cukup daftarkan **apex-nya saja** sebagai redirect:

1. **Domains → Connect**
2. Domain: `avahelath.sbs`
3. **Redirect to:** `avahealth.sbs`, pilih **307 Temporary**

Pengunjung yang salah ketik tetap sampai, dengan satu entri.

---

## MEMERIKSA HASILNYA

Setelah tiap gelombang, buka alamatnya di peramban. Yang harus terlihat:

| Subdomain | Tanda berhasil |
|---|---|
| `ops.` | Layar masuk → sesudah masuk, rel menu **15 kategori** |
| `his.` | Rel menu **7 kategori** (Klinik, AVA Health, Korporat, Keuangan, Mutu, SDM, Pengaturan) |
| `lis.` | Rel menu **4 kategori** (Lab LIS, Inventori, Mutu, Pengaturan) |
| `tech.` | Rel menu **6 kategori**, mendarat di Cockpit AVA Tech |
| `corp.` | Portal PIC korporat, **bukan** layar pasien |
| `antrian.` | Layar antrian penuh, tanpa menu |
| `lacak.` | "Tautan tidak lengkap" — benar, halaman ini butuh token |

Kalau `his.` dan `lis.` menampilkan menu yang **sama**, berarti
`js/core/peta-subdomain.js` belum ikut ter-deploy. Jalankan
`node scripts/bangun-vercel.js`, commit, lalu deploy ulang.

---

## MENAMBAH SUBDOMAIN BARU NANTI

Jangan menambahkannya langsung di Vercel saja — nanti Vercel dan aplikasi
menyimpan daftar yang berbeda, dan itu sumber masalah yang sudah pernah
terjadi di proyek ini.

Urutannya:

1. Tambah satu entri di [`config/domain.json`](../config/domain.json)
2. Jalankan:
   ```bash
   node scripts/bangun-vercel.js
   ```
   Ini memperbarui `vercel.json` **dan** `ava-platform/js/core/peta-subdomain.js`
3. Uji di komputer sendiri — tanpa mengubah berkas hosts:
   ```
   http://<subdomain-baru>.localhost:5174/
   ```
4. Commit + deploy
5. Baru **Domains → Connect** di Vercel

Pemeriksa kebasian tersedia kapan saja:

```bash
node scripts/bangun-vercel.js --periksa
```

---

## CATATAN PAKET HOBBY

- **Wildcard `*.avahealth.sbs` tidak tersedia** di Hobby. Itu sebabnya
  panduan ini mendaftarkan satu per satu. Di paket Pro, seluruh tabel di atas
  cukup diganti **satu entri** `*.avahealth.sbs`.
- Ketentuan Hobby ditujukan untuk penggunaan **non-komersial**. Platform ini
  dijual ke faskes lain (lihat tabel `tenants` dan tagihan langganan di modul
  AVA Tech). Sebelum dipakai klien berbayar, periksa ketentuan paket di
  dashboard Vercel — akun yang disuspend saat sistem sudah dipakai klinik
  adalah kejutan yang paling mahal.
