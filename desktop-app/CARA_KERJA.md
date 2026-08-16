# OneLab Desktop — Cara Kerja (Mekanisme Lokal `.exe`)

Dokumen teknis mekanisme desktop. Untuk gambaran menyeluruh (visi, cakupan,
peta jalan, aturan yang mengikat), baca **`ONELAB.md` di folder induk** — itu
dokumen induknya, dan bila ada pertentangan, berkas itu yang berlaku.

---

## 1. Cara menjalankan

**Double-click `ONELAB.bat`** di folder induk (`D:\onelab-platform-main\`).

Sekali klik, semuanya menyala: aplikasi utama plus Lab Connector di latar
belakang. Tidak ada menu pilihan — navigasi memakai tab **di dalam** aplikasi:
Sistem Utama · Portal Apps · Lab Connector · GUI Table Editor · SQL Studio.

Boot pertama ±10–15 detik untuk menyiapkan basis data, berikutnya cepat.

Perintah tambahan:

```
ONELAB.bat backup      → membuat cadangan basis data
```

> `.exe`-nya ada di `desktop-app\release\win-unpacked\OneLab Desktop.exe`.
> `.bat` hanya menyalakannya, dan **tidak memuat satu pun path absolut** —
> seluruh folder boleh dipindah ke drive atau komputer mana pun.

### Akun pertama

Pada instalasi baru, akun admin dibuat otomatis dengan kata sandi **acak**
(bukan default tetap, karena default akan menjadi pintu belakang begitu produk
dijual). Kredensialnya ditulis ke `desktop-app\LOGIN_ADMIN_PERTAMA.txt`.
Masuk, ganti kata sandi, lalu hapus berkas itu.

---

## 2. Apa yang terjadi saat dijalankan

```
OneLab Desktop.exe  (Electron — satu proses)
│
├─ 1. Local Engine  (electron/local-engine.js)
│     • PGlite = PostgreSQL asli (WASM)
│     • Shim PostgREST di 127.0.0.1:54329
│     • Autentikasi lokal: kredensial ter-hash scrypt di basis data
│     • Gerbang LLM       → /functions/v1/llm-gateway
│     • Gerbang SATUSEHAT → /functions/v1/satusehat
│
├─ 2. Server statis platform di 127.0.0.1:5174
│
└─ 3. Jendela React (src/App.tsx) — tab pembungkus di atas keduanya

Lab Connector (proses Node terpisah, UI status di :9999)
└─ menangkap kiriman HL7/ASTM dari alat lab
```

### Lokasi berkas — tidak ada yang di-hardcode

| Apa | Cara ditemukan |
|---|---|
| Folder platform | `ONELAB_PLATFORM_PATH` → `resources/platform` → telusuri ke atas dari lokasi `.exe` |
| Basis data | `ONELAB_DATA_DIR` → `desktop-app/pglite-data` → `userData/pglite-data` |
| `.env` | dari folder induk basis data, lalu `desktop-app/.env` |

> **Jebakan yang sudah tiga kali memakan korban:** pada build terpaket,
> `__dirname` berada **di dalam `app.asar`**, sehingga menelusuri induknya tidak
> pernah sampai ke folder proyek. Semua pencarian di atas berjangkar pada lokasi
> `.exe` atau folder data — jangan pernah memakai `__dirname` untuk menemukan
> berkas di luar bundel.

---

## 3. Kalau kode diubah — apakah langsung terpakai?

| Yang diubah | Perlu build ulang? |
|---|---|
| `onelab-platform/**` (HTML, JS modul, CSS) | **Tidak.** Disajikan langsung dari disk; cukup Refresh Tampilan UI |
| `electron/**`, `src/**` | **Ya** — `npm run build:exe` |
| `db/migrations/**` | Isinya tidak, tapi engine harus dijalankan ulang agar migrasi baru terpasang |

Untuk uji cepat tanpa GUI Electron:

```bash
node run-local.js
```

Itu menyalakan engine (`:54329`) + server platform (`:5174`) memakai basis data
**pengembangan** `.pglite-dev`, terpisah dari data produksi.

> **Verifikasi akhir wajib pada `.exe` hasil build.** Tiga bug packaging lolos
> justru karena hanya diuji lewat `run-local.js`.

---

## 4. Migrasi skema

Skema dikelola lewat `db/migrations/NNNN_*.sql`. Tiap berkas dijalankan sekali,
berurutan, dalam satu transaksi, lalu dicatat di `public.schema_migrations`
beserta checksum-nya. Kegagalan di-ROLLBACK lalu dilempar — sengaja berisik.

**Jangan menyunting migrasi yang sudah terpasang.** Checksum dibandingkan tiap
boot; kalau berubah, muncul peringatan. Buat berkas migrasi baru.

Kelola isi basis data kapan saja lewat aplikasi: tab **GUI Table Editor** dan
**SQL Studio**.

---

## 5. Cadangan & pemulihan

**Membuat cadangan:** lewat aplikasi, `ONELAB.bat backup`, atau
`POST /rest/v1/backup/create`. Hasilnya di `desktop-app/backup/`, dengan nama
basis data asal ikut di nama berkas.

**Memulihkan:**

```bash
node scripts/pulihkan-cadangan.js                  # daftar cadangan
node scripts/pulihkan-cadangan.js <berkas.tar.gz>  # pulihkan
```

Sengaja berupa skrip, bukan endpoint HTTP: memulihkan menimpa basis data yang
sedang dipakai klinik, dan tindakan sebesar itu tidak boleh bisa dipicu dari
jaringan. Basis data lama **dipindahkan**, bukan dihapus, ke
`pglite-data-sebelum-pulih-<stempel>`.

Skrip menolak cadangan milik basis data lain kecuali diberi `--paksa`. Tanpa
penjaga itu, cadangan pengembangan bisa menimpa data klinik tanpa terasa,
karena keduanya berisi katalog produk yang sama.

---

## 6. Catatan build

```bash
npm run build:exe      # vite build + tsc electron + electron-builder --dir
```

Keluaran: `release/win-unpacked/`. Target `portable` — installer NSIS masuk
Fase 4 (lihat `ONELAB.md` §6.1).

`npm run package:exe` (portable satu berkas) memerlukan **Windows Developer
Mode** aktif, karena electron-builder mengekstrak `winCodeSign` yang berisi
symlink macOS. Tidak wajib — `win-unpacked` sudah `.exe` yang berfungsi penuh.

Berkas yang **tidak pernah** masuk repo: `.env`, `connector/config.json`,
`js/config.local.js`, `LOGIN_ADMIN_PERTAMA.txt`, `.auth-secret`, `pglite-data/`.
