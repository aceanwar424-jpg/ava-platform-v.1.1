# Konfigurasi operasional, Sprint dan formulir — 0074–0076

OWNED_BY: generic. Persetujuan chat untuk skema repo/uji lokal; **tidak ada apply produksi**.

## Prasyarat dan urutan

Baseline tenant/auth/RBAC dan admissions; 0070–0073 beserta ownership tenant yang diverifikasi. Jalankan preflight read-only `db/preflight/0074_policy_sprint_clinical.sql` di lingkungan yang diotorisasi. Urutan forward: 0074 governance → 0075 Sprint → 0076 formulir. Migrasi 0075–0076 bersifat sekali jalan melalui migration runner; jangan replay manual atau mengubah checksum setelah diterapkan.

Tidak ada policy/preset tenant nyata yang di-seed. UI `cfg-rs-policy` menampilkan versi dan tahap pengesahan; `tech-sprint` memerlukan policy aktif untuk nama tim; `rs-clinical-forms` merujuk admissions existing. Role pages ditambahkan untuk profesi/role relevan yang sudah ada, tidak membuat pengguna atau privilege klinis baru.

## Setup tenant

1. Pembuat menyusun versi lengkap dan mengajukan review. Payload tidak dapat diedit melalui API; koreksi membuat versi baru.
2. Reviewer berbeda dari pembuat menyetujui. Clinical template hanya oleh role dokter/clinical governance; administrator tidak dapat menyetujui sebagai profesi.
3. Aktivator yang berwenang menentukan waktu mulai berlaku; tanggal retroaktif ditolak. Penjadwalan versi baru tidak memensiunkan versi sebelumnya lebih awal. Resolver memilih tanggal efektif terbaru, lalu revision terbaru.
4. Untuk klinis, scope template dan policy authority harus sama. Aksi `clinical.record`, `clinical.sign` dan opsional `clinical.read` mempunyai daftar profesi dan separation of duties. Tanpa kewenangan aktif operasi/baca ditolak. Template tidak menentukan terapi/ambang klinis.
5. Sprint memakai scope nama tim, anggota dari user_profiles tenant, durasi, skala poin, DoD, window velocity dan carry-over. Anggota wajib mempunyai role operasional Tech yang diizinkan. Role Tech saja tidak cukup tanpa membership.

Semua input klinis melalui RPC: catatan baru, sign, amendment dari catatan signed pada encounter dan scope sama. Original tidak ditimpa. Baca memakai RLS dan matriks unit. Catatan menyimpan template policy ID; pengesahan historis memakai versi asli dan kewenangan saat pengesahan. Waktu di UI datetime-local dikonversi ke UTC, bukan diartikan sebagai jam server.

## Batas fungsi

- Governance administratif menyimpan/menyetujui metode kamar, perpindahan kelas, deposit, timezone, cutoff dan pembulatan. **Belum mengganti billing existing, belum mencakup mesin refund/paket/payer/capacity penuh.** UI menyatakan batas ini. Jangan aktivasi nyata dengan asumsi kalkulator existing menggunakan policy.
- Authority baru diberlakukan pada formulir klinis; guard profesi/tenant modul existing tetap berlaku. Bukan pengganti seluruh RBAC legacy.
- Form engine menyediakan isian bertipe, signature dan amendment. Belum menjadi flowsheet ICU/partograf, kompatibilitas darah, MAR atau protokol unit khusus.
- Sprint: create/edit backlog, planning/assign, start, doing/DoD, koreksi Done sebelum penutupan, close, carry-over dan velocity. Closed snapshot tidak diubah. Board dibatasi 100 sprint/500 item dengan penanda batas; arsip/pagination lanjutan belum tersedia.
- Tidak ada koneksi BPJS/PACS baru atau simulator vendor yang mengaku resmi.

## Uji dan bukti

`node scripts/uji/test_policy_sprint.cjs`: fixture SQL PGlite terisolasi, policy approval, tenant/RBAC, membership, DoD, carry-over, snapshot/velocity, klinis/amendment dan RLS. `node scripts/qa-policy-sprint.cjs`: UI tersambung SQL nyata, lifecycle policy/sprint/clinical, escaping, viewport, error/retry. Preset, aktor dan catatan seluruhnya sintetis; fixture dibuang saat close. Uji ini bukan validasi multi-session PostgreSQL atau pengesahan klinis RS.

## Rollback

Sebelum ada transaksi, rollback UI dengan kembali ke commit sebelumnya serta nonaktifkan route baru. Setelah ada data, jangan DROP tabel atau hapus audit/catatan: batasi akses fitur, pertahankan data, lakukan forward fix. Policy aktif dapat retired oleh RPC beralasan; draft/approved lama dipertahankan. Penutupan Sprint dan catatan signed tidak dibuka ulang melalui SQL manual. Backup dan rollback produksi harus ditinjau terpisah.
