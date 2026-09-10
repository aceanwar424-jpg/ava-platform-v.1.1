# Audit keamanan website — 10 September 2026

OWNED_BY: ava. Status: perbaikan lokal telah diuji; **belum diterapkan atau diverifikasi di produksi**.

## Temuan dan bukti

1. **Tinggi — kredensial demo dipublikasikan.** `js/auth.js` berisi email/password bawaan dan tombol login demo. Pemeriksaan HTTP tanpa login juga mendeteksi markup password demo pada halaman produksi `apps.avahealth.sbs` dan `corp.avahealth.sbs`. Tidak mencoba password tersebut terhadap akun produksi; keberhasilan login dengan password itu belum diketahui.
2. **Tinggi — bypass autentikasi lokal.** Kode demo menerima password dengan panjang minimum dan membuat sesi bahkan saat layanan autentikasi gagal. Token demo pada boot memberi akses superadmin. Seluruh jalur ini dihapus dari auth dan boot utama.
3. **Tinggi — sesi dari URL dan penyimpanan permanen.** Boot utama menerima token/refresh lewat query string dan menyimpannya ke localStorage. Ini memungkinkan sesi tertinggal dan pemaksaan akun melalui link. Penerimaan token URL dihentikan; token lama di localStorage dibuang dan token aplikasi kini hanya di sessionStorage.
4. **Tinggi — pemisahan domain hanya routing tampilan.** File aplikasi bisa diminta melalui domain www, sedangkan kiosk/monitor tidak memakai gerbang staf utama. Middleware baru mengecek seluruh hostname/path sebelum mengizinkan akses. Hanya www diizinkan menyajikan daftar file website publik.
5. **Tinggi — role dari metadata pengguna.** Helper UI sebelumnya memakai user_metadata.role sebagai fallback. Fallback dihapus, profil server wajib tersedia. Pembatasan staf pada middleware menggunakan daftar UUID administratif, bukan klaim role dari browser. Ini tidak menggantikan RLS/otorisasi database.
6. **Sedang — cache aplikasi lama.** Service worker lama dapat menyajikan kode login yang sudah usang. Worker pengganti menghapus cache aplikasi miliknya lalu unregister. Respons privat mendapat no-store. Perangkat yang belum kembali online belum menerima pembersihan ini.

Inventaris berasal dari `config/domain.json`: 44 hostname, mencakup ejaan domain alternatif. Bukti lengkap: `audit-evidence/security-http-2026-09-10.json`. DNS tidak ditemukan, timeout, dan 404 dicatat apa adanya; tidak berarti hostname itu aman atau telah dinonaktifkan pada hosting. HTTP 200 pada path `.env`/config bukan bukti isi rahasia bocor: SPA fallback bisa memberi 200. Isi rahasia dan data pasien tidak diambil. Domain lain di luar inventaris/DNS dashboard belum dapat dipastikan.

## Perbaikan yang disiapkan

- Login utama kosong, tanpa demo, bypass, atau pendaftaran role mandiri.
- Profil akses wajib berasal dari server. Login gagal tidak membuat sesi.
- Token URL ditolak dan parameter dibersihkan; sesi localStorage lama tidak dimigrasikan.
- Logout membersihkan sesi lokal dan meminta pencabutan sesi server.
- Middleware menolak host tak dikenal/URL preview langsung, memisahkan aset www, dan membatasi seluruh host operasional pada akun staf yang disetujui.
- Cookie gerbang staf memakai `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`, tanpa Domain/Expires/Max-Age. Token gerbang diverifikasi ke Auth setiap permintaan; tidak menyimpan password atau refresh token pada cookie.
- Konfigurasi staf kosong menutup domain privat dengan 503. WWW tetap dapat diakses. Alias domain utama mengarah ke www.
- CSRF login/logout dicegah dengan pemeriksaan Origin. Tidak ada shared password baru.
- File lokal/config/SQL/backup ditolak oleh middleware dan dikecualikan dari upload Vercel.
- Runtime config menolak key server yang salah dimasukkan sebagai anon key.

## Verifikasi lokal

`node --test scripts/uji/test_security_domains.cjs scripts/uji/test_apps_auth.cjs`: **22/22 lulus**, fixture sintetis tanpa akses DB produksi. Mencakup seluruh host privat dan direct paths, akun nonstaf, Auth gagal/offline, token palsu, cookie duplikat, CSRF, konfigurasi kosong, isian login kosong, secret runtime, serta parsing skrip inline.

`node scripts/bangun-vercel.js --periksa`, `node scripts/verify-deploy-readiness.js`, pemeriksaan sintaks JS dan `git diff --check`: lulus. Tes middleware adalah unit test terhadap Web Request/Response, bukan bukti bahwa build/deployment Vercel menjalankan middleware.

## Penerapan yang masih wajib

1. Gunakan root repository `D:/AVAQUEEN-platform-main` sebagai Root Directory Vercel, output `ava-platform`. Root middleware dan root `api/` wajib termasuk build. Konfigurasi lama di `ava-platform/vercel.json` bukan target deployment yang aman untuk patch ini.
2. Isi environment server `AVA_SUPABASE_URL`, `AVA_SUPABASE_ANON_KEY` (publishable/anon, bukan service-role), dan `AVA_STAFF_USER_IDS` berupa daftar UUID akun staf yang sudah disetujui, dipisah koma. Daftar ini belum diambil dari produksi atau ditebak dari alamat email. Tanpa daftar itu, domain operasional sengaja menolak akses.
3. Build dan uji deployment di Vercel; verifikasi middleware benar-benar berjalan sebelum static files/API pada semua host, termasuk alias dan preview. Uji staf sintetis di lingkungan uji: login benar/salah, logout, expiry, role yang sesuai, dan direct-file access. Portal Apps saat ini tetap mempertahankan pemeriksaan login/peran miliknya sesudah gerbang staf; belum ada pemulihan sesi otomatis Apps dari gerbang.
4. Terapkan perubahan, lalu ulangi pemeriksaan HTTP/browser pada domain produksi. Dua upaya membaca tab dashboard Vercel melalui alat browser mengalami timeout; tidak ada deploy, perubahan DNS, atau perubahan akun produksi pada audit ini.
5. Rotasi password akun yang memakai kredensial demo/terpapar dan cabut seluruh refresh session terkait. Token JWT yang sudah terbit bisa tetap berlaku sampai kedaluwarsa; logout saja tidak membuktikan semua token curian langsung tidak berlaku. Periksa log sign-in untuk periode terdampak.
6. Audit RLS/grant/RPC, hak perubahan `user_profiles`, signup publik, MFA staf, rate limit login, storage bucket, dan isolasi tenant di backend produksi. Endpoint Supabase langsung harus tetap menolak akses tanpa kewenangan; gerbang domain bukan pengganti perlindungan backend. Tidak ada koneksi DB produksi dalam audit ini.
7. Periksa penyimpanan password browser pada komputer bersama. Penghapusan nilai bawaan dari kode tidak menghapus password yang pernah disimpan sendiri oleh browser/password manager. Session restore browser juga dapat memulihkan sesi; staf harus logout saat berganti petugas.

Dokumentasi platform yang diperiksa: [Vercel Routing Middleware API](https://vercel.com/docs/routing-middleware/api), diakses 10 September 2026. Tidak ada jaminan keamanan menyeluruh sampai penerapan dan verifikasi backend selesai.
