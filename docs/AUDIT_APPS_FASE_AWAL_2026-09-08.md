# Audit Apps — fase awal

Tanggal: 7–8 September 2026. Sasaran: https://apps.avahealth.sbs/ dan `ava-platform/apps/`.
OWNED_BY: ava. Lingkup: audit publik baca-saja, audit sumber, dan perapihan lokal. Bukan sertifikasi keamanan atau audit ISO.

## Kesimpulan

Pintu masuk lebih layak untuk uji terbatas setelah perbaikan lokal. Aplikasi belum dapat dinyatakan siap memakai data pasien nyata: dashboard masih mencampur contoh, simulasi, serta operasi backend. Perubahan belum diterapkan ke domain publik.

## Temuan dan penanganan

| Prioritas | Temuan | Penanganan |
|---|---|---|
| Kritis | Akun demo memperoleh token tiruan; kegagalan autentikasi juga membuka dashboard | Hapus bypass/fallback. Respons auth dan profil wajib valid; kegagalan membersihkan sesi dan tetap di login. |
| Tinggi | Peran pilihan browser mengalahkan profil akun | Cocokkan pilihan dengan peran profil; pergantian peran biasa dibatasi. Super admin tetap memerlukan profil server. Akses korporat memerlukan RPC verifikasi. |
| Tinggi | Token URL dan flag browser membuka sesi tanpa verifikasi | Hapus token dari URL; hentikan auto-login berbasis flag. Untuk sementara reload memerlukan login ulang dan SSO berbasis query token tidak digunakan. |
| Tinggi | Tombol pembayaran, pencairan, biosensor, age reversal, wearable, scribe, dan API key menampilkan keberhasilan tiruan | Ganti dengan pesan belum tersedia, tanpa mengubah saldo, pengukuran, atau menerbitkan key tiruan. |
| Sedang | Halaman login menampilkan akses admin, identitas contoh, klaim sertifikasi tanpa bukti audit | Hapus kartu demo dan klaim tersebut dari pintu masuk; kosongkan kredensial bawaan. |
| Sedang | Pendaftaran mengumumkan nomor RM tetap tanpa membuat akun | Arahkan aktivasi ke petugas; handler lama tidak lagi mengumumkan keberhasilan. |
| Sedang | Modal transparan masih masuk pohon aksesibilitas dan fokus | Modal tertutup memakai visibility:hidden; modal terbuka tetap terlihat. |
| Sedang | Label kecil, kontras pilihan aktif buruk, zoom dikunci, tampilan mobile berbeda drastis | Login diringkas; label 14px, input 16px, fokus keyboard, zoom dibuka, tema terang konsisten. |
| Sedang | Aktivasi cache menghapus cache lain pada origin yang sama | Batasi penghapusan ke prefiks cache Apps; naikkan versi dan sertakan stylesheet login. |

## Bukti verifikasi

- Browser produksi: halaman publik memuat kartu demo dan banyak modal tertutup di pohon aksesibilitas. Tidak melakukan login atau transaksi produksi.
- Browser lokal: halaman masuk berhasil dimuat; akun kosong; tidak ada kartu demo atau modal tertutup di pohon aksesibilitas.
- Desktop 1280×720 dan mobile 390×844: inspeksi visual. Pilihan aktif terbaca setelah koreksi warna.
- Mobile 320×640: document clientWidth = scrollWidth = 320; login scrollWidth = 305. Tidak ada overflow horizontal halaman.
- Memilih Perusahaan menampilkan kode perusahaan. Input sintetis tanpa kode menghasilkan pesan “Isi kode perusahaan dari petugas Anda.” sebelum permintaan autentikasi.
- `node --test scripts/uji/test_apps_auth.cjs`: pengujian terisolasi dengan auth/RPC/DOM sintetis; tidak menghubungi server.
- `node --check ava-platform/apps/app.js`, `node --check ava-platform/apps/service-worker.js`, `node scripts/bangun-vercel.js --periksa`, serta diff whitespace diperiksa.

## Batasan dan prioritas sebelum produksi

1. Audit RLS/server dengan akun uji dua tenant: otorisasi frontend tidak menjadi batas keamanan. Periksa juga siapa yang dapat mengubah role di user_profiles.
2. Pisahkan data contoh dari hasil pasien, roster, invoice, keranjang, dan referral. Banner versi uji tidak menggantikan pemisahan tersebut.
3. Chat konsultasi masih memiliki respons otomatis contoh; rujukan dan beberapa alur lain masih simulasi. Belum dinyatakan siap operasional.
4. Klaim cashback memakai dua penulisan terpisah (klaim lalu saldo): perlu transaksi server/idempotensi sebelum dipakai. Tidak diubah karena membutuhkan desain operasi backend.
5. Verifikasi pencarian EHR dengan identitas akun/ID pasien dan pembatasan tenant, bukan nama tampilan.
6. Rancang pemulihan sesi tervalidasi dan SSO aman agar tidak perlu login ulang saat reload. Patch awal sengaja tidak mempertahankan jalur token URL yang tidak diverifikasi.
7. Uji alur terautentikasi end-to-end dengan akun sintetis resmi sebelum release. Audit ini tidak menguji akun nyata, notifikasi, pembayaran, atau penulisan database.

## Implikasi IP & Kepatuhan

Pemeliharaan aset AVA yang sudah ada. Tidak mengekstrak data/harga/klien menjadi produk generik, mengubah katalog, skema, provider LLM, atau memasang integrasi baru. Tidak membuat klaim sertifikasi atau kesesuaian klinis. Pengujian memakai data sintetis. Perubahan lokal terbatas pada direktori Apps dan berkas uji/dokumentasi; perubahan HIS/LIS yang sudah ada tidak diterbitkan.
