# LAPORAN KOREKSI & PERBAIKAN
### Pemulihan regresi, penyatuan peta subdomain, dan pengelolaan roster korporat

**Dokumen No:** AVA-DOC-FIX-2026-01
**Tanggal:** 30 Agustus 2026
**Menggantikan klaim:** butir S1 pada [03-LAPORAN-QC.md](03-LAPORAN-QC.md)
**Pemicu:** peninjauan Head of Operations atas tampilan `AVAPLATFORM.bat`

---

## 1. RINGKASAN

Peninjauan menemukan bahwa rangkaian pekerjaan sebelumnya **mengganti fungsi
yang sudah berjalan dengan tampilan statis** — bukan menambah kemampuan.
Dokumentasinya bertambah tebal sementara kodenya mundur, dan itulah sebab
antarmuka terasa "melebar tapi melenceng".

Fondasi Fase 0 (migrasi 0021–0027, shared kernel `js/core/*`) **asli dan tidak
bermasalah**. Yang rusak adalah lapisan antarmuka dan penyambungannya.

---

## 2. REGRESI YANG DIPULIHKAN

| Berkas | Yang hilang | Tindakan |
|---|---|---|
| `portal_korporat.html` | seluruh panggilan endpoint bertoken; diganti PT Telkom + 9 `alert()` | **Dibangun ulang**: token nyata + roster + UI baru |
| `modules/dashboard/index.js` | 5 kueri `sbGet` → nol panggilan data | **Ditulis ulang**: setiap angka dari kueri |
| `track.html` | 2 `fetch` (RPC pelacakan + kunci peta) | Dipulihkan dari HEAD |
| `nakes.html` | helper RPC, portal nakes, penulisan GPS | Dipulihkan dari HEAD |
| `modules/radiology/dicomViewer.js` | bacaan klinis karangan | Diperbaiki (lihat §3) |
| `apps/index.html` | 4 tombol yang mengaku berhasil tanpa berbuat apa pun | Dinonaktifkan + keterangan jujur |

### Mengapa ini serius, bukan sekadar kosmetik

Dashboard Holding menampilkan **"Nilai Kritis / Alarm Westgard: 0 Alarm (100%
Normal)"** tanpa membaca satu baris pun dari `lab_qc_runs`. PACS viewer
mencetak **"AI Screening: Paru & Jantung tampak normal. CTR 46.2%"** pada citra
apa pun, termasuk ketika tidak ada citra sama sekali. Keduanya adalah
pernyataan klinis palsu pada layar yang dipakai mengambil keputusan medis.

Portal korporat menampilkan kolom **"FIT TO WORK / FIT WITH NOTE"** per
karyawan. Fungsi `portal_korporat()` yang digantikannya justru dirancang untuk
**tidak** mengembalikan hasil klinis, dengan komentar eksplisit di
`0017_portal_tagihan_kunci_relasi.sql`:

> perusahaan berhak tahu siapa sudah diperiksa, bukan membaca hasil medis karyawannya

Mock itu melewati batas privasi yang sengaja dibangun.

---

## 3. ATURAN YANG DIPEGANG SESUDAH INI

1. **Angka di layar harus punya sumber.** Bila sumbernya belum ada, tampilkan
   `—` dan keterangan "belum tersambung" — bukan angka contoh. Dashboard
   sekarang menandai pilar FMCG dan Sanctuary demikian, karena modulnya memang
   belum menulis ke tabel mana pun.
2. **Status integrasi hanya hijau bila diperiksa.** SATUSEHAT dan jembatan
   analyzer kini bertuliskan "Belum diperiksa", bukan "Online".
3. **Tidak ada keluaran klinis tanpa masukan nyata.** Tombol CTR di PACS kini
   meminta diameter jantung dan toraks dari pemeriksa, lalu menghitungnya
   dengan `calculateCTR()` yang sudah ada dan benar.
4. **Tombol tidak boleh mengaku berhasil.** Yang belum berfungsi dinonaktifkan
   dengan alasan, bukan diberi `alert('✅ berhasil')`.

---

## 4. PORTAL KORPORAT — DUA JALUR YANG BERBEDA

Sempat ada kesalahpahaman bahwa portal korporat "belum ada". Kenyataannya ada
**dua**, dan keduanya sah:

| | `apps/index.html` | `portal_korporat.html` |
|---|---|---|
| Masuk | akun + kata sandi | tautan bertoken |
| Peran | `corporate` (requestor / approver) | PIC tanpa akun |
| Kemampuan | roster, booking, approval, riwayat | roster, kontrak, tagihan |
| Berkas | `apps/app.js` (3.144 baris) | halaman mandiri |

**Cacat sesungguhnya:** tombol `corporate` di bilah simulator menunjuk
`portal_korporat.html` — portal tautan yang tipis — padahal portal login yang
lengkap ada di `apps/index.html`. Itu sebabnya menu terasa dangkal.
`config/domain.json` kini mengarahkan `corporate.avahealth.sbs` ke portal login.

### Yang ditambahkan: pengelolaan roster di portal bertoken

Migrasi [`0028_portal_korporat_kelola_karyawan.sql`](../../db/migrations/0028_portal_korporat_kelola_karyawan.sql):

- `portal_akses.boleh_tulis` — izin per-tautan, **mati secara bawaan**
- `portal_korporat_karyawan_tambah` / `_impor` / `_assign` / `_nonaktif`
- `portal_korporat()` kini juga mengembalikan `karyawan` dan `paket_tersedia`

Batas yang dipegang:

- `corporate_id` **tidak pernah** diterima dari pemanggil — selalu dibaca dari token
- Paket yang boleh dipilih dibatasi paket umum + paket milik perusahaan itu
- Kuota kontrak **ditegakkan**, bukan sekadar ditampilkan
- Karyawan baru berstatus `Non-Aktif`; yang menjadwalkan pemeriksaan tetap staf
- Tidak ada satu pun kolom klinis yang terjangkau dari portal
- Penolakan **dikembalikan sebagai nilai**, bukan `RAISE EXCEPTION` — sebab
  exception membatalkan transaksi berikut baris log percobaannya

Verifikasi (13 uji, dijalankan sungguhan di atas PGlite):

```bash
node scripts/uji/test_portal_korporat_roster.js
```

---

## 5. PETA SUBDOMAIN DISATUKAN

**Sebelum:** dua daftar terpisah yang sudah menyimpang.

- `config/domain.json` — 12 situs
- `desktop-app/src/App.tsx` — 15 tombol, ditulis tangan

`corporate`, `crm`, `antrian`, dan `cek` ada di simulator tetapi **tidak punya
peta domain** — jalan di lokal, 404 di produksi. Sebaliknya `console` punya peta
tanpa tombol. Labelnya sendiri tertulis "Simulator 12 Subdomain" sambil
menampilkan 15.

**Sesudah:** `config/domain.json` menjadi satu-satunya sumber (16 situs).
Simulator membacanya lewat IPC `platform:getSitus`, dan jumlah di label dihitung.

Alamat simulator berubah dari `127.0.0.1:5174/<path>` menjadi
`<lokal>.localhost:5174/`. Ini yang paling penting: server statis memilih berkas
masuk dari header `Host`, sehingga membuka path mentah di `127.0.0.1` **melewati
seluruh aturan subdomain** yang justru sedang ingin diuji.

Subdomain baru: `corporate`, `lacak`, `antrian`, `crm`.
`monitor/antrian.html` dan `monitor/crm.html` mendapat `<base href="/monitor/">`
— tanpa itu `../css/...` miliknya salah arah saat disajikan di akar subdomain.

### 5b. Isi tiap subdomain akhirnya benar-benar berbeda

Penyatuan peta saja belum cukup. Peninjauan berikutnya menunjukkan **isi tiap
subdomain masih sama**, dan sebabnya lebih dalam daripada sekadar daftar
yang menyimpang:

| Berkas masuk | Dipakai bersama oleh |
|---|---|
| `/index.html` | his, lis, ops, console |
| `/portal.html` | web, care, nutri, sanctuary, tech |
| `/apps/index.html` | app, corporate |

**`index.html` tidak pernah tahu ia sedang disajikan di subdomain mana.**
Pembedanya dulu query `?workspace=` yang hanya ditempelkan simulator — dan di
produksi query itu tidak pernah ada. `his.avahealth.sbs` menyajikan
`/index.html` polos, jatuh ke `holding`, lalu menampilkan seluruh 14 rel menu.
Jadi keempat subdomain itu **memang selalu identik di produksi**, sejak awal,
bukan akibat perubahan simulator.

Ditambah satu cacat lagi: penyempitan rel hanya dipanggil pada jalur login
master token. Staf yang masuk lewat akun biasa **tidak pernah** mengalami
penyempitan sama sekali.

**Perbaikan.** `config/domain.json` kini memuat pembeda per situs
(`workspace`, `awal`, `sorot`, `peran`), dan `scripts/bangun-vercel.js`
membangkitkan `js/core/peta-subdomain.js` darinya — keluaran kedua dari sumber
yang sama, seperti `vercel.json`. Halaman membaca `location.hostname`:

| Subdomain | Rel menu | Halaman awal |
|---|---|---|
| `ops` | 14 (holding penuh) | Dashboard |
| `his` | 5 (klinik) | EMR SOAP |
| `lis` | 4 (lab) | Lab |
| `console` | 3 (tech) | Lisensi |

`portal.html` menyorot pilar tuan rumahnya: judul, hero, dan urutan kartu
mengikuti `care` / `sanctuary` / `tech`, dengan **seluruh teks diambil dari
kartu pilar yang sudah ada di halaman itu** — tidak ada kalimat baru yang
dikarang. `web` tetap etalase holding penuh. `nutri` dikembalikan ke
`nutri.html`, halaman khususnya yang memang sudah ada. `corporate` mendarat di
portal PIC korporat, bukan layar pasien.

Urutan kewenangan: query string (pengujian) → subdomain → bawaan.

### 5c. AVA Tech: dari etalase menjadi inti sistem

`tech.avahealth.sbs` menampilkan halaman etalase pemasaran, padahal AVA Tech
adalah unit yang **membangun platform ini dan menjualnya** ke faskes lain.

Sebabnya: modul `renderTechSaas` sudah ada dan sudah punya rute
(`saas-console`, `tech_saas`, `license-manager`) **sejak lama**, tetapi
**tidak pernah punya rel menu**. Satu-satunya cara membukanya adalah mengetik
URL. Karena tidak ada yang bisa ditampilkan, subdomainnya diarahkan ke
`portal.html`.

Isi cockpit-nya pun karangan seluruhnya: `4 Tenant Aktif` ditulis tetap,
empat baris tenant palsu, kunci publik `ed25519_ava_9902_master_verified_2026`
yang tidak berasal dari mana pun, dan tombol "Uji Integritas Lisensi" yang
memanggil `alert('✅ Engine Lisensi Terverifikasi Aktif & Valid!')`.

Lebih dalam lagi: `provisionNewTenant()` dan `trackUsageMetering()` bekerja di
atas array JavaScript `SAAS_TENANTS` **di dalam memori**. Setiap klien yang
"berhasil diprovisioning" hilang saat halaman dimuat ulang, dan setiap
pemakaian yang "tercatat" tidak pernah bisa ditagihkan. `test_fase4_e2e.js`
menguji tepat fungsi-fungsi itu dan **selalu lulus** — yang sebenarnya diuji
hanyalah bahwa sebuah array bisa ditambah isinya.

**Perbaikan:**

| | Sebelum | Sesudah |
|---|---|---|
| Rel menu | tidak ada | **AVA Tech** — 11 menu, 3 kelompok |
| `tech.avahealth.sbs` | etalase `portal.html` | cockpit `index.html` → `saas-console` |
| Daftar klien | 4 baris hardcoded | view `tenant_ringkasan` |
| Provisioning | array memori | `INSERT` ke `public.tenants` |
| Metering | angka di memori | `tenant_catat_pemakaian()`, per bulan |
| Status integrasi | "Bridge Active" tetap | Lab Connector benar-benar diprobe; SATUSEHAT "Belum diperiksa" |
| Uji | array memori, selalu lulus | 8 uji SQL sungguhan |

Rel menu **AVA Tech** dikelompokkan sesuai perannya:

- **Operasi Produk** — Cockpit, Tenant & Klien Faskes, Lisensi Instalasi, Monitor AI Gateway
- **Penjualan Sistem** — Prospek Klien SaaS, Penawaran Lisensi, Kontrak PKS, Tagihan Langganan
- **Aset yang Dijual** — Ekspor Katalog LOINC/UCUM, Database Studio, Jejak Audit

Migrasi [`0029_ava_tech_penjualan_lisensi.sql`](../../db/migrations/0029_ava_tech_penjualan_lisensi.sql)
memperluas `public.tenants` yang sudah ada (0004) dengan paket, kuota, masa
langganan, dan nilai kontrak — **bukan** membuat tabel tenant kedua. Ditambah
`tenant_pemakaian` dan view `tenant_ringkasan`.

`console.avahealth.sbs` tetap ada sebagai pintu khusus lisensi (mendarat di
`lisensi`), sementara `tech` adalah cockpit penuh.

```bash
node scripts/uji/test_ava_tech_tenant.js
```

### 5d. Struktur menu: satu sumber, tidak bisa menyimpang lagi

Akar keluhan "sudah ada file .md tapi masih melenceng". Struktur menu hidup di
**dua tempat yang ditulis tangan**:

- `FLYOUT_MENUS` di dalam `index.html` (~240 baris)
- `LAPORAN_ARSITEKTUR_MENU_AVA_GLOBAL.md`

Dua daftar tangan untuk hal yang sama pasti menyimpang, dan memang sudah:
dokumennya menjanjikan pembagian per unit usaha, aplikasinya menampilkan
seluruh 14 rel di setiap subdomain.

**Sekarang:** `config/menu.json` → `scripts/bangun-menu.js` → dokumen +
`js/core/peta-menu.js` yang dipakai aplikasi. Rel navigasi dan seluruh isi
menu **digambar dari peta**, tidak lagi ditulis di HTML.

Generatornya menolak klaim kosong: setiap menu bertanda `ada` diperiksa
benar-benar punya `case` di `router.js`. Pada jalankan pertama ia menolak
**26 klaim yang salah**.

**127 menu terpetakan — 108 ada · 4 sebagian · 15 masih struktur kosong.**
Yang kosong tetap ditampilkan dengan penanda "belum tersedia": menyembunyikannya
membuat peta kerja tampak lebih selesai daripada kenyataannya.

| Ruang | Rel menu | Isi |
|---|---|---|
| `ops` | **13 (semua)** | Pemantauan penuh lintas unit |
| `tech` | 5 | Development + komersial jual sistem |
| `his` | 5 | Klinik non-lab, radiologi, farmasi, home care, MCU korporat |
| `lis` | 4 | Seluruh alur laboratorium |
| `wellness` | 4 | Nutrition + Care (FMCG) + Sanctuary |

Konsumen dibagi tiga: **pasien individual**, **korporat** (requestor/approver,
terintegrasi ke HIS), dan **wellness**. Pendukung: kiosk, TV antrian, monitor
CRM, aplikasi nakes, pelacakan publik.

**Subdomain lama tidak dihapus.** `console`, `nutri`, `care`, `sanctuary` tetap
hidup sebagai alias yang mengarah ke ruang barunya — tautan yang sudah beredar
tidak mati, hanya isinya yang mengikuti struktur baru.

Dua cacat ikut ketemu saat menguji perubahan ini:

1. `FLYOUT_MENUS` dibangun saat berkas diurai, padahal `peta-menu.js` dimuat
   `defer` — hasilnya objek **kosong tanpa satu pun galat**. Kini disusun saat
   pertama dibutuhkan.
2. Rel yang bukan milik sebuah ruang dulu dibuat lalu disembunyikan. Kini tidak
   dibuat sama sekali, sehingga tidak bisa muncul kembali karena satu
   pemanggilan yang keliru.

```bash
node scripts/bangun-menu.js --periksa
```

---

## 6. MENU YANG TIDAK TERSAMBUNG

Tiga menu sudah lama ada di rel navigasi tanpa `case` di router, sehingga
kliknya tidak melakukan apa pun — padahal fungsi rendernya ada:

| Menu | Diperbaiki menjadi |
|---|---|
| `audit` | `case 'audit'` → `renderAuditTrail()` |
| `campaigns` | `case 'campaigns'` → `renderVoucher()` |
| `content-engine` | diarahkan ke Content Studio (`agentic`, tab `studio`) |

Verifikasi: 62 dari 62 target menu kini teresolusi.

---

## 7. MIGRASI YANG DIAM-DIAM BERHENTI

**Temuan paling berdampak.** Log boot menunjukkan:

```
[migrasi] GAGAL pada 0022_fase0_tenancy_organisasi.sql:
          column "brand_code" of relation "cost_centers" does not exist
[local-engine] migrasi gagal — memakai jaring pengaman DDL bawaan
```

Runner migrasi melempar galat dan **berhenti**. Artinya **0023 sampai 0028
tidak pernah terpasang** di instalasi lokal mana pun — seluruh Master Person
Index, IAM/RBAC, kolom dimensi wajib, event outbox, dan RLS Fase 0 absen dari
basis data yang sedang berjalan, meskipun berkasnya ada dan laporan QC
menyatakan lulus.

**Sebabnya:** mesin lokal memuat `sql_arsip/04_roadmap_fase/supabase_fase4.sql`
lebih dulu, dan berkas itu sudah membuat `public.cost_centers` dengan bentuk
lain (PK `id`, tanpa `brand_code`, `code` tanpa indeks unik). `CREATE TABLE IF
NOT EXISTS` di 0022 menjadi no-op, lalu `INSERT`-nya gagal.

**Perbaikan:** 0022 menyelaraskan bentuk tabel warisan lebih dulu
(`ADD COLUMN IF NOT EXISTS` + indeks unik pada `code`) sebelum menyisipkan data.
Pada basis data bersih seluruh blok itu no-op.

---

## 8. BERKAS YANG BERUBAH

**Basis data**
- `db/migrations/0022_fase0_tenancy_organisasi.sql` — penyelarasan cost_centers
- `db/migrations/0028_portal_korporat_kelola_karyawan.sql` — baru

**Mesin & shell**
- `desktop-app/electron/local-engine.js` — endpoint tulis portal, penjaga RPC
- `desktop-app/electron/main.ts` + `preload.ts` — IPC `platform:getSitus`
- `desktop-app/src/App.tsx` + `types.ts` — simulator dari peta domain
- `config/domain.json` → `vercel.json` (dibangkitkan)

**Antarmuka**
- `portal_korporat.html` — dibangun ulang
- `modules/dashboard/index.js` — ditulis ulang
- `modules/system/portal_akses.js` — saklar izin kelola
- `modules/radiology/dicomViewer.js` — preset nyata, CTR nyata
- `apps/index.html`, `track.html`, `nakes.html` — regresi dipulihkan
- `index.html` — perbaikan lingkup rail, rute `content-engine`
- `js/core/router.js` — dua `case` yang hilang
- `monitor/antrian.html`, `monitor/crm.html` — `<base href>`

**Uji**
- `scripts/uji/test_portal_korporat_roster.js` — baru, 13 uji

---

## 9. YANG BELUM DIKERJAKAN

Disebutkan terbuka, bukan dianggap selesai:

1. **Modul Sanctuary dan FMCG belum punya lapisan data.** Keduanya
   presentasional; dashboard menandainya "belum tersambung". Menyambungkannya
   adalah pekerjaan tersendiri.
2. **Sumber PACS belum ada.** Viewer menyatakannya apa adanya. Windowing DICOM
   sesungguhnya menuntut piksel 16-bit dari berkas asli.
3. **Pemeriksa SATUSEHAT dan jembatan analyzer belum ditulis.** Statusnya
   sengaja "Belum diperiksa" sampai ada pemeriksa sungguhan.
4. **42 berkas arsip `.md` dan 17 salinan basi** di
   `desktop-app/release/win-unpacked/` belum dibuang.
5. **Klaim T1–T10** belum ditinjau ulang satu per satu. Fondasinya ada, tetapi
   pengujiannya berjalan di atas basis data uji, bukan instalasi nyata — dan
   temuan §7 menunjukkan keduanya bisa berbeda jauh.
