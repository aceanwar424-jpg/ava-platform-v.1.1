# Walkthrough — Penyempurnaan HIS

## Ruang lingkup

Perbaikan dibatasi pada `his.avahealth.sbs`: navigasi dan konteks UI. Tidak ada
migrasi database, perubahan data klinis, atau pemanggilan integrasi eksternal.

## Temuan dan perbaikan

- Tombol tetap di rail bawah selalu menunjuk ke `lis-settings`, bahkan saat
  aplikasi disajikan dari `his.avahealth.sbs`. Akibatnya staf HIS memperoleh
  pintasan yang salah menuju konfigurasi connector analyzer/LIS.
- Tag rail juga selalu memakai `ISO 15189:2022`, yang merupakan konteks LIS.
- `ava-platform/index.html` kini menyesuaikan label, tag, dan target tombol
  berdasarkan workspace. Pada HIS tombol menjadi **Pengaturan Sistem HIS**,
  bertag **HIS / RME**, dan membuka `settings` melalui router yang sama sehingga
  kontrol RBAC tetap berlaku. LIS mempertahankan tombol connector-nya.
- Pengaturan tidak lagi menampilkan atau menyediakan template SQL untuk
  menonaktifkan RLS seluruh tabel. Kontrol isolasi data tetap berada di database;
  panel hanya menyisakan diagnostik skema dan bantuan konfirmasi akun yang harus
  dijalankan melalui prosedur administrasi tercatat.
- Sidebar HIS diperkuat agar grup accordion dan submenu selalu seukuran
  kontennya, rail selalu menumpuk dari atas, dan submenu memiliki tinggi
  minimum. Grup tidak lagi dibuka secara otomatis hanya karena berada di
  urutan pertama; grup aktif saja yang terbuka setelah navigasi tersinkron.
  Versi URL stylesheet diperbarui agar browser mengambil aturan sidebar baru.

## Bukti verifikasi

- Pemeriksaan sintaks JavaScript inline `index.html`: lulus.
- `node --check ava-platform/modules/system/settings.js`: lulus; pencarian
  `Disable RLS`/`disable_rls` pada modul pengaturan tidak menemukan sisa kontrol.
- `node scripts/uji/test_fase1_e2e.js`: 13/13 lulus.
- `node scripts/uji/test_his_tindakan_imunisasi.js`: 18/18 lulus.
- `node scripts/uji/test_alur_tagihan_order.js`: 13/13 lulus.
- Audit menu menemukan tabel/view, RPC, handler, dan manifest HIS bersih.
  Audit global masih melaporkan lima rute LIS yang tidak terkait ruang HIS:
  `lab-result`, `lab-validation`, `lab-approval`, `lab-qc`, dan `lab-report`.
- Verifikasi UI pada `http://his.localhost:5174/`: rail menampilkan **AVA
  CLINIC / Hospital & Clinical System**; tombol baru membuka **Pusat Pengaturan
  & Konfigurasi**, bukan pengaturan LIS, dan panel administrasi hanya
  menampilkan bantuan konfirmasi akun serta diagnostik skema.
- Verifikasi sidebar HIS setelah perbaikan: grup **Pelayanan Klinis** yang
  aktif menampilkan seluruh submenu; grup lain tertutup rapat dan rail dapat
  digulir tanpa ruang kosong besar.

## Batas verifikasi

Pengujian memakai lingkungan lokal dan data kosong. Koneksi produksi,
SATUSEHAT, perangkat analyzer, serta penerapan migrasi pada database produksi
tidak diuji atau diubah.
