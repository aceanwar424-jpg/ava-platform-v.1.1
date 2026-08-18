# Lisensi, Installer, dan Pembaruan

Panduan untuk **penjual** — bukan untuk klien. Berisi cara menerbitkan lisensi,
membangun installer, dan mengatur pembaruan otomatis.

---

## 1. Kunci penerbit lisensi

Sekali seumur produk. Sudah dibuat, ada di:

| Berkas | Isi | Boleh disebar? |
|---|---|---|
| `desktop-app/lisensi-publik.pem` | kunci publik | **ya** — ikut repo dan ikut setiap paket instalasi |
| `desktop-app/.lisensi-privat.pem` | kunci privat | **tidak pernah** — diblokir `.gitignore` |

> **Cadangkan kunci privat sekarang, ke luar komputer kerja.**
> Kalau hilang, tidak ada satu pun lisensi baru atau perpanjangan yang bisa
> diterbitkan, dan membuat pasangan kunci baru akan membuat **seluruh lisensi
> yang sudah beredar langsung ditolak** semua instalasi klien.
>
> Kalau bocor, siapa pun bisa menerbitkan lisensi OneLab yang sah.

---

## 2. Menerbitkan lisensi

Klien mengirimkan **sidik mesin**-nya, yang bisa mereka lihat di menu
Konfigurasi → Lisensi, lalu tekan Salin.

```bash
node scripts/lisensi-buat.js --pemegang "Klinik Melati" --hari 365 --sidik <sidik-mesin-klien> --edisi lengkap
```

Hasilnya berkas `lisensi-klinik-melati.json`. Kirimkan ke klien, dan minta
mereka menyimpannya dengan nama **`lisensi.json`** di folder data instalasi —
sejajar dengan folder `pglite-data`. Aplikasi tidak perlu ditutup; cukup tekan
"Periksa Ulang" di layar Lisensi.

Pilihan lain:

| Argumen | Guna |
|---|---|
| `--tanpa-ikatan` | lisensi bisa dipakai di berapa pun komputer — untuk demo atau lisensi seluruh cabang |
| `--hari 0` | tanpa batas waktu |
| `--catatan "..."` | catatan bebas, ikut ditandatangani |
| `--keluar <path>` | tentukan lokasi berkas hasil |
| `--sidik-saya` | cetak sidik mesin komputer ini |

Menerbitkan tanpa `--sidik` maupun `--tanpa-ikatan` akan **ditolak**. Lisensi
yang bisa disalin ke mana saja harus menjadi pilihan sadar, bukan akibat lupa
mengisi satu argumen.

---

## 3. Apa yang lisensi ini lakukan — dan tidak

**Ini bukan proteksi salin.** Kode aplikasi dikirim sebagai JavaScript yang bisa
dibuka siapa saja; orang yang berniat membobol bisa mematikan pemeriksaannya
dalam hitungan menit. Menyebutnya "pengaman" hanya akan membuat keputusan
bisnis diambil di atas rasa aman yang palsu.

Yang benar-benar dilakukannya:

1. Membuat kesepakatan lisensi **eksplisit dan bisa diperiksa** — siapa
   pemegangnya, edisi apa, sampai kapan.
2. Mencegah satu berkas dipakai ulang di banyak klinik, karena terikat sidik
   mesin.
3. Membuat masa berlaku habis **terlihat** oleh pemakai yang jujur, jauh
   sebelum menjadi sengketa.

### Masa lisensi habis TIDAK mematikan aplikasi

Ini keputusan sengaja. Aplikasi ini dipakai saat pasien sedang dilayani.
Mengunci klinik dari rekam medisnya sendiri pada tanggal tertentu bukan
penegakan lisensi, melainkan risiko keselamatan pasien dan tanggung jawab
hukum yang berpindah ke penyedia aplikasi. Status ditampilkan terus-menerus di
layar Lisensi; penagihan diselesaikan antar manusia.

Kalau kebijakan ini mau diubah, ubahlah dengan sengaja — dan pertimbangkan
membatasi hal yang tidak menyangkut keselamatan (misalnya fitur ekspor atau
laporan), bukan akses ke data pasien.

### Sidik mesin

Dibangun dari nama komputer, sistem operasi, arsitektur, dan model CPU. Sengaja
tidak memakai nomor seri disk: klinik yang mengganti disk karena servis tidak
boleh kehilangan akses. Konsekuensinya, sidik ini tidak unik secara mutlak —
dan memang tidak perlu, karena tujuannya menghalangi penyalinan santai, bukan
serangan.

---

## 4. Membangun installer

```bash
cd desktop-app
npm run package:installer
```

Hasilnya `desktop-app/release/OneLab Desktop Setup <versi>.exe` (±89 MB).

Yang ikut masuk paket (`extraResources`):

| Isi | Tujuan di paket | Mengapa wajib |
|---|---|---|
| `onelab-platform/` | `resources/platform` | seluruh antarmuka aplikasi |
| `db/migrations/` | `resources/db` | skema basis data; **tanpa ini aplikasi menolak jalan** |
| `lisensi-publik.pem` | `resources/lisensi-publik.pem` | verifikasi lisensi |

Installer NSIS: bisa memilih folder, memasang per-mesin, membuat pintasan, dan
**tidak menghapus data saat uninstall** — basis data ada di `%APPDATA%`, di luar
folder instalasi.

### Paket cacat gagal keras, bukan diam-diam

Kalau `db/migrations` tidak ikut, aplikasi terpaket menampilkan kotak galat lalu
menutup diri. Sebelumnya ia hanya mencatat "dilewati" dan tetap jalan — yang
berarti klinik mendapat basis data separuh jadi, dan baru ketahuan
berbulan-bulan kemudian saat sudah berisi rekam medis.

---

## 5. Pembaruan otomatis

Sudah tersambung (`electron-updater`) tetapi **belum aktif**: `package.json`
belum punya kolom `publish`. Selama itu kosong, aplikasi tidak memeriksa apa pun
dan tidak mengeluh.

Untuk mengaktifkan lewat GitHub Releases, tambahkan ke `build` di
`desktop-app/package.json`:

```json
"publish": [{ "provider": "github", "owner": "aceanwar424", "repo": "onelab-platform" }]
```

lalu terbitkan rilis dengan `electron-builder --win nsis --publish always`
(butuh `GH_TOKEN`).

Perilaku yang dipilih:

- Pembaruan **diunduh** di latar belakang, **dipasang saat aplikasi ditutup**.
  Memasang lalu me-restart di tengah pendaftaran pasien adalah gangguan
  operasional.
- Kegagalan pembaruan **dicatat, tidak dibungkam**. Instalasi yang
  berbulan-bulan gagal memperbarui tanpa jejak adalah cara paling sunyi untuk
  tertinggal dari perbaikan keamanan.
- Bisa dimatikan di klinik tertentu dengan variabel lingkungan
  `ONELAB_NO_UPDATE=1`.

### Belum ada penandatanganan kode

Installer belum ditandatangani, jadi Windows SmartScreen akan memperingatkan
pemakai saat memasang. Untuk dijual luas, sertifikat code signing perlu dibeli
(OV/EV). Ini keputusan biaya, bukan teknis.

---

## 6. Yang diverifikasi pada build terpaket

Diuji langsung pada `.exe` hasil paket, bukan hanya mode pengembangan:

- folder platform dan 20 migrasi ditemukan dari `resources/`
- migrasi terpasang pada basis data kosong; `portal_data()` menjawab
- lisensi sah terbaca: pemegang, edisi, masa berlaku, ikatan mesin
- lisensi yang diubah isinya ditolak — **saat aplikasi sedang berjalan**,
  tanpa restart
- endpoint lisensi menolak permintaan tanpa sesi

Satu bug ditemukan justru pada tahap ini: `lisensi.js` tidak ikut tersalin ke
`dist-electron`, sehingga pemeriksaan lisensi selalu galat di build terpaket
sementara mode pengembangan tampak sehat. Skrip penyalinan kini menyalin
seluruh berkas `.js` di `electron/`, bukan satu nama yang harus diingat.
