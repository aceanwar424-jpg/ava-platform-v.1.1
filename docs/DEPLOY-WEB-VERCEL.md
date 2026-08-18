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
