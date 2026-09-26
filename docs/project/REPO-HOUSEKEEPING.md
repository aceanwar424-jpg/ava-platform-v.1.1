# Repository housekeeping

Tanggal: 26 September 2026

## Struktur yang dipertahankan

- `db/migrations/` adalah sumber migrasi aktif. SQL lama di `ava-platform/sql_arsip/` dipertahankan sebagai arsip historis dan tidak dipanggil runtime.
- `docs/project/` adalah dokumentasi kerja aktif. `ava-platform/docs_arsip/` dipertahankan sebagai arsip fase lama.
- `data/queue-simulation/` adalah fixture database sintetis untuk pengujian; file berukuran nol di dalamnya merupakan file PostgreSQL internal dan tidak boleh dihapus satu per satu.
- `ava-platform/downloads/` berisi paket connector yang dapat diunduh tenant dan tetap dipertahankan.
- Logo di root dan `ava-platform/css/` memiliki hash sama tetapi melayani dua root deployment berbeda; keduanya dipertahankan.

## Hasil pemeriksaan

- Tidak ditemukan file `.bak`, `.tmp`, `.old`, `.orig`, atau `.swp` aktif.
- CSS aplikasi tidak digabung karena melayani surface berbeda: shell authenticated, Apps, kiosk, wellness, dan public profile. Penggabungan akan meningkatkan risiko regresi dan menghilangkan batas cache/deployment.
- Menu sudah berupa satu sumber konfigurasi (`config/menu.json`) dan keluaran `ava-platform/js/core/peta-menu.js` dibangkitkan otomatis.
- Folder arsip tidak dihapus karena masih menjadi referensi migrasi dan audit historis.

## Implikasi IP & Kepatuhan

OWNED_BY: generic untuk struktur housekeeping. Tidak ada data pasien, credential, token, atau aset klien yang dipindahkan. Penghapusan artefak database internal dan arsip historis dilarang tanpa inventaris serta checkpoint terpisah.
