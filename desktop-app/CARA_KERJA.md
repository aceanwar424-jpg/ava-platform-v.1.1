# OneLab Desktop — Cara Kerja (Mekanisme Lokal `.exe`)

Dokumen ini menjelaskan **satu-satunya** mekanisme menjalankan OneLab sekarang:
aplikasi desktop `.exe` dengan **DB + backend berjalan penuh di laptop ini**, tanpa
Supabase cloud. Mekanisme lama (Antigravity: `npm run dev:vite` + `dev:electron` via
`RUN_ONELAB_PLATFORM.bat`, SQLite/Prisma) **sudah dihapus dan diganti** oleh ini.

---

## 1. Cara menjalankan (sehari-hari)

**Double-click:** `D:\onelab-platform-main\JALANKAN_ONELAB.bat`

Itu saja. Boot pertama ~10–15 detik (menyiapkan database), berikutnya cepat.
Tidak perlu terminal, tidak perlu `npm run` apa pun.

> File `.exe` sebenarnya ada di
> `desktop-app\release\win-unpacked\OneLab Desktop.exe` — `.bat` hanya
> menyalakannya. Kamu juga bisa langsung double-click `.exe` itu.

---

## 2. Apa yang terjadi saat dijalankan (arsitektur)

```
OneLab Desktop.exe  (Electron — satu proses)
│
├─ 1. Local Engine  (electron/local-engine.js)
│     • PGlite = PostgreSQL 17 asli (WASM), DB tersimpan di:
│       C:\Users\<kamu>\AppData\Roaming\onelab-desktop\onelab-pglite
│     • Boot pertama: muat SELURUH skema dari onelab-platform\sql_arsip\*.sql
│       (174 tabel + 24 view) lalu seed 548 produk dari database.sql
│     • Menyalakan "shim PostgREST" di  http://127.0.0.1:54329
│       → meniru Supabase REST, jadi frontend jalan TANPA diubah
│
├─ 2. Static server  →  http://127.0.0.1:5174
│     • Menyajikan folder onelab-platform\ (index.html + modules + js + css)
│     • LANGSUNG dari disk (bukan salinan) — ini kunci pengembangan cepat
│
└─ 3. Jendela Electron
      • Menampilkan React shell (Table Editor + SQL Studio + tab UI Software)
      • Tab "UI Software" = iframe ke http://127.0.0.1:5174 (platform OneLab asli)
```

Alur data satu modul (contoh Lab):
```
Modul Lab (js)  →  sbGet('lab_samples', ...)  →  http://127.0.0.1:54329/rest/v1/lab_samples
              →  shim menerjemahkan ke SQL  →  PGlite (Postgres lokal)  →  balik JSON
```

Frontend memilih target **otomatis** (di `js/core/api.js`):
- dibuka di `127.0.0.1`/`localhost` (yaitu di dalam `.exe`) → **engine lokal :54329**
- dibuka di domain lain (mis. Vercel) → **Supabase cloud**

Inilah yang mewujudkan visi: kode yang sama bisa jalan **lokal** sekarang, dan
nanti **web + Supabase ATAU konek DB lokal** tanpa ganti kode.

---

## 3. Kalau ada perubahan kode — apakah langsung terpakai?

Tergantung **bagian mana**:

| Yang diubah | Contoh file | Langsung terpakai? | Cara terapkan |
|---|---|---|---|
| **Modul platform** | `onelab-platform\modules\*.js`, `index.html`, `css`, `apps\*` | **YA, langsung** | Cukup **reload** aplikasi (tutup–buka, atau klik "Refresh Tampilan UI" di tab UI Software). Disajikan live dari disk. *Ingat bump `?v=` di `index.html` bila browser cache.* |
| **Engine lokal** | `desktop-app\electron\local-engine.js` (shim/skema) | Tidak | `npm run build:exe` lalu buka lagi `.exe` |
| **Shell/IPC Electron** | `desktop-app\electron\main.ts`, `src\App.tsx` | Tidak | `npm run build:exe` lalu buka lagi `.exe` |

**Jadi untuk "mematangkan script modul" — yang paling sering kamu lakukan —
tidak perlu build sama sekali. Edit → reload → langsung kelihatan.**

Rebuild `.exe` (hanya saat ubah engine/shell):
```bash
cd /d D:\onelab-platform-main\desktop-app
npm run build:exe
```
Hasilnya memperbarui `release\win-unpacked\OneLab Desktop.exe` (± 2–3 menit).

---

## 3b. Data (migrasi dari Supabase cloud)

DB lokal berada di `desktop-app\pglite-data` (pra-bangun, sudah berisi skema +
data). Data awal ditarik satu kali dari Supabase cloud oleh **`migrate-cloud.js`**:
skema penuh + **54 tabel berisi ~3.612 baris** (produk 548, ref_ranges 1399,
product_items 682, leads, corporate_employees, tasks, dll).

Untuk **menyegarkan data dari cloud** kapan pun (idempoten, aman diulang):
```bash
# TUTUP dulu OneLab Desktop.exe (ia mengunci pglite-data), lalu:
cd /d D:\onelab-platform-main\desktop-app
node migrate-cloud.js
```
Catatan:
- `postal_codes` (83 rb baris kodepos) sengaja dilewati agar cepat. Tarik terpisah bila perlu:
  `set ONLY=postal_codes&& node migrate-cloud.js`
- Migrasi memakai `OVERRIDING SYSTEM VALUE` (mengisi `id` identity dari cloud) dan
  mematikan trigger sementara (`session_replication_role=replica`).
- Insert per-baris (multi-row VALUES memicu batas stack parser PGlite).

## 4. Reset / muat ulang database

DB lokal persisten di `…\AppData\Roaming\onelab-desktop\onelab-pglite`.
Untuk membangun ulang dari nol (mis. setelah ubah skema), **hapus folder itu**
lalu jalankan aplikasi lagi — skema + seed dimuat ulang otomatis.

Kelola isi DB kapan saja lewat aplikasi: tab **GUI Table Editor** (lihat/edit 150+
tabel) dan **SQL Studio** (jalankan SQL apa pun, seperti Supabase SQL Editor).

---

## 5. Menuju hasil akhir (nanti)

Saat modul sudah matang:
1. `git push` frontend `onelab-platform\` seperti biasa (deploy Vercel tetap jalan —
   deteksi otomatis membuat produksi memakai Supabase cloud).
2. Untuk deployment yang **konek DB lokal ini**, arahkan saja host ke engine
   (`:54329`) — tanpa ubah kode aplikasi.
3. Portabel ke laptop lain: perlu langkah tambahan (bundling `sql_arsip` + platform
   ke dalam `.exe`, hilangkan path `D:\…` hardcoded). Belum dilakukan — lokal dulu.

---

## 6. Catatan build

- Build harian pakai `npm run build:exe` (target `--dir` → `win-unpacked`).
- `npm run package:exe` (portable satu-file) memerlukan **Windows Developer Mode**
  ON (atau jalankan sebagai Administrator) karena electron-builder mengekstrak
  `winCodeSign` yang berisi symlink macOS. Tidak wajib — `win-unpacked` sudah `.exe`
  yang berfungsi penuh.
- `run-local.js` = penyala engine+platform tanpa Electron (untuk uji cepat di
  browser biasa). Opsional, bukan cara utama.
