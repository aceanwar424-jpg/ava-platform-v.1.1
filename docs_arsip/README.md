# Arsip Dokumen Rancangan (MD)

Berkas di sini adalah **dokumen rancangan & fase yang implementasinya sudah tuntas**
(SQL-nya sudah dijalankan dan diverifikasi ada di `sql_arsip/`). Dipindahkan agar
direktori utama hanya menyisakan dokumen hidup (roadmap, visi, spesifikasi berjalan).

**Jangan dihapus** — ini catatan alasan & rancangan tiap fitur dibangun. Bila perlu
menelusuri "kenapa modul ini begini", di sinilah jawabannya.

Diarsipkan 23 Juli 2026.

---

## `agentic/` — modul Agentic AI (QMS/SOP)

| Berkas | Isi | Implementasi |
|---|---|---|
| `AGENTIC_FASE0.md` | Fondasi skema agentic | `sql_arsip/03_agentic/supabase_agentic.sql` |
| `AGENTIC_FASE12.md` | Ingest dokumen, bucket, template | `…/supabase_agentic_fase12.sql` |
| `AGENTIC_FASE34.md` | Organ & penanda organisasi | `…/supabase_agentic_fase34.sql` |
| `AGENTIC_FASE5.md` | Kerangka kerja (frameworks) | `…/supabase_agentic_fase5.sql` |
| `AGENTIC_FASE6.md` | Penilaian & checklist mutu | `…/supabase_agentic_fase6*.sql` |
| `AGENTIC_FASE7.md` | Organ per-departemen (IT/Lab/HR/SCM/klinis) | `…/supabase_agentic_fase7*.sql` |
| `AGENTIC_OVERLAP_DESIGN.md` | Rancangan deteksi tumpang-tindih SOP | `sql_arsip/07_lanjutan/supabase_agentic_overlap.sql` |
| `AGENTIC_RAG_DESIGN.md` | Rancangan RAG "Tanya Dokumen" (pgvector) | `sql_arsip/07_lanjutan/supabase_agentic_rag.sql` |

## `onelab/` — fase inti SIMRS/RIS/LIS/SAP

| Berkas | Isi | Implementasi |
|---|---|---|
| `ONELAB_FASE1.md` | Fondasi, nilai kritis, RLS, RPC berwewenang | `sql_arsip/04_roadmap_fase/supabase_fase1*.sql` |
| `ONELAB_FASE2.md` | Inventory/BHP, gudang, faktur supplier | `…/supabase_fase2*.sql` |
| `ONELAB_FASE3.md` | Catatan klinis, alergi, vital, antrian | `…/supabase_fase3.sql` |
| `ONELAB_FASE4.md` | Akuntansi: jurnal, buku besar, payroll | `…/supabase_fase4*.sql` |
| `ONELAB_FASE5.md` | LIS autoverifikasi, RIS, PACS, multi-cabang | `…/supabase_fase5_*.sql` |

---

## Masih di direktori utama (dokumen hidup, TIDAK diarsipkan)

- `AGENTIC_ROADMAP.md`, `AGENTIC_VISION_100Y.md` — arah jangka panjang, masih dirujuk.
- `ONELAB_ROADMAP.md` — peta jalan keseluruhan.
- `ONELAB_AGENTIC_SPEC.md` — spesifikasi berjalan, jadi acuan pengembangan.

Fase Agentic 8 (insight & CDS) dan analyzer bridge **belum** diimplementasikan
(SQL-nya masih di root, belum dijalankan), sehingga tidak ada dokumen fase-nya di sini.
