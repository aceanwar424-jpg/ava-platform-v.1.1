# Deploy web (Vercel) — avahealth.sbs

## Apa yang terjadi, 18 Agustus 2026

`avahealth.sbs` mengembalikan **404: NOT_FOUND** di semua halaman.

Situsnya tidak hilang. Ia tetap ter-deploy utuh, hanya tersembunyi dua folder
ke dalam:

```
https://www.avahealth.sbs/                                            → 404
https://www.avahealth.sbs/onelab-platform-main/onelab-platform/index.html → 200
```

**Penyebab.** Commit `153421d` ("satukan repositori di root proyek")
memindahkan folder platform dari akar repo ke
`onelab-platform-main/onelab-platform/`. Pengaturan **Root Directory** proyek
Vercel tetap menunjuk akar repo, dan di sana tidak ada `index.html`.

Akibat keduanya sekaligus: `vercel.json` juga ikut pindah, sehingga Vercel
tidak pernah membacanya. Itu sebabnya subdomain `apps.` dan `kiosk.` ikut mati
dan tautan dalam seperti `/portal.html` ikut 404 — bukan cuma halaman depan.

## Perbaikan yang dipakai

`vercel.json` di **akar repo**, dengan `outputDirectory` menunjuk folder
platform, plus seluruh aturan redirect dan rewrite yang tadinya ada di berkas
bersarang.

Cukup di-push; tidak perlu menyentuh dashboard Vercel.

```bash
git -C D:/onelab-platform-main push
```

## Pemisahan subdomain

Peta domain ada di **satu berkas**: config/domain.json. Berkas itu dibaca dua tempat sekaligus —
scripts/bangun-vercel.js (membangkitkan vercel.json) dan server statis lokal :5174. Satu sumber
untuk lokal dan produksi, supaya "di lokal jalan kok" tidak pernah terjadi.

| Host | Isi |
|---|---|
| avahealth.sbs (+www, +ejaan terbalik) | Web Utama — sementara halaman hub Portal Apps |
| his.avahealth.sbs | Sistem Utama (aplikasi staf) |
| app.avahealth.sbs, apps.avahealth.sbs | Portal Customer & Korporat |
| kiosk.avahealth.sbs | Kiosk Antrian |
| nakes.avahealth.sbs | Portal Nakes Home Care |
| cek.avahealth.sbs | Lacak Pesanan & Hasil |

### Menambah subdomain

1. Tambah satu entri di config/domain.json
2. Jalankan: node scripts/bangun-vercel.js
3. Uji lokal: http://<lokal>.localhost:5174/ — semua *.localhost otomatis ke 127.0.0.1,
   tidak perlu menyunting berkas hosts
4. Push, lalu tambahkan domainnya di dashboard Vercel (Settings → Domains)

Skrip menolak membangun bila entri menunjuk berkas yang tidak ada, dua situs memakai host yang
sama, atau halaman di dalam subfolder belum punya <base href>. Sudah diuji dengan sengaja
merusak ketiganya.

### Mengapa <base href>, dan mengapa satu proyek Vercel

apps/index.html memuat ../js/core/api.js — lapisan API bersama yang memuat konfigurasi Supabase.
Kalau tiap subdomain jadi proyek Vercel sendiri dengan akar sendiri, berkas itu harus digandakan,
dan salinan akan menyimpang. Satu proyek menjaga satu salinan.

Konsekuensinya berkas subdomain tetap berada di subfolder (/apps/, /kiosk/) sementara alamatnya
adalah akar. <base href="/apps/"> yang menjembatani: style.css dan app.js miliknya tetap ketemu,
sementara ../js/core/api.js tetap naik ke akar. Aman di sini karena semua panggilan jaringan
memakai SUPABASE_URL absolut dan tidak ada aset yang dirujuk dari akar.

### Yang TIDAK diberikan pemisahan ini

**Subdomain bukan pembatas akses.** his.avahealth.sbs tetap bisa dibuka siapa pun; yang menjaga
sistem staf adalah login, bukan alamatnya. Seluruh berkas juga tetap dapat diambil dari host mana
pun — misalnya app.avahealth.sbs/index.html tetap menyajikan sistem staf. Pemisahan ini soal
kejelasan dan citra, bukan keamanan.

## Aturan yang mengikat sesudah ini

> **Jangan mengubah Root Directory proyek Vercel.** Ia harus tetap di akar
> repo, karena di situlah `vercel.json` dibaca. Kalau suatu saat diubah ke
> `onelab-platform-main/onelab-platform`, `vercel.json` akar tidak lagi dibaca
> dan situs akan rusak dengan cara yang sama — halaman depan mungkin muncul,
> tetapi subdomain dan tautan dalam kembali 404.

> **Kalau folder platform dipindah lagi, ubah `outputDirectory` di
> `vercel.json` akar pada commit yang sama.** Pemindahan folder dan
> pengaturan deploy harus berpindah bersama; kalau terpisah, situs baru
> ketahuan rusak setelah orang lain yang membukanya.

## Dua berkas vercel.json — sengaja

| Berkas | Dibaca Vercel? | Guna |
|---|---|---|
| `vercel.json` (akar) | **ya** | yang benar-benar dipakai |
| `onelab-platform-main/onelab-platform/vercel.json` | tidak | cadangan bila Root Directory suatu saat dipindah ke sana |

Aturan rutenya harus **sama isinya**. Kalau salah satu diubah, ubah keduanya —
kalau tidak, keduanya akan berbeda dan tidak ada yang tahu mana yang berlaku.

## Cara memeriksa sesudah deploy

```bash
for u in / /portal.html /apps/index.html /kiosk/index.html; do curl -s -o /dev/null -w "%{http_code} $u\n" "https://www.avahealth.sbs$u"; done
```

Keempatnya harus **200**. Selain itu:

- `https://apps.avahealth.sbs/` → membuka portal customer
- `https://kiosk.avahealth.sbs/` → membuka kiosk antrian
- tautan dalam yang bukan berkas nyata → jatuh ke `index.html` (aturan rewrite)

## Catatan sebelum push

Push berikutnya membawa **seluruh pekerjaan sesi ini** ke web produksi
sekaligus, bukan hanya perbaikan 404 ini: portal korporat, portal perujuk,
ekspor Maps, warna penanda kategori, layar Lisensi, dan perubahan lain.
Semuanya sudah diuji lokal, tetapi patut diketahui bahwa satu push mengubah
banyak hal di situs yang dilihat publik.
