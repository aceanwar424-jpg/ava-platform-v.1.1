# Indeks Dokumentasi

Dokumentasi aktif disusun menurut fungsi, bukan menurut tanggal. Arsip tetap disimpan bila berfungsi sebagai bukti audit atau riwayat keputusan.

## Mulai dari sini

| Kebutuhan | Dokumen |
| --- | --- |
| Status pekerjaan, rencana, dan bukti verifikasi | `project/STATUS-PROYEK.md` |
| Backlog yang belum disetujui untuk dikerjakan | `project/backlog.md` |
| Jalur migrasi dan batas SQL historis | `../db/MIGRATION_CATALOG.md` |
| Peta menu aplikasi | `PETA-MENU.md` |
| Kontrak sinkronisasi LIS ↔ HIS | `LIS-HIS-SERVICE-SYNC.md` |
| Panduan domain dan Vercel | `PANDUAN-SUBDOMAIN-VERCEL.md` |

## Kelompok dokumen

- `architecture/` — rancangan arsitektur dan keputusan tingkat sistem.
- `audit-evidence/` — keluaran pemeriksaan yang dapat direproduksi (JSON).
- `archive/audit/` — laporan audit historis; bukan instruksi implementasi aktif.
- `gtm/` — materi go-to-market dan positioning.
- `project/` — rencana aktif, status, dan backlog.
- Berkas `AUDIT_*.md` di root `docs/` — audit tematik yang masih menjadi referensi kerja.

## Aturan pemeliharaan

1. Catat rencana dan hasil perubahan pada `project/STATUS-PROYEK.md`, termasuk bagian **Implikasi IP & Kepatuhan**.
2. Simpan bukti pemeriksaan otomatis sebagai berkas bertanggal di `audit-evidence/`.
3. Pindahkan dokumen yang sudah tidak aktif tetapi masih bernilai audit ke `archive/`; jangan menghapus tanpa memastikan tidak ada referensi atau kewajiban retensi.
4. Jangan memasukkan data pasien, kredensial, atau dump basis data ke dokumentasi.
