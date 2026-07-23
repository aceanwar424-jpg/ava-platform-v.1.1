# Rancangan — RAG Ringan untuk Dokumen (Adopsi Struktur, Bukan Layanan)

Status: **RANCANGAN (belum dibangun)** · Untuk ditinjau sebelum eksekusi.
Terkait: [AGENTIC_OVERLAP_DESIGN.md](AGENTIC_OVERLAP_DESIGN.md) — Fase 2 di sini
meningkatkan deteksi tumpang tindih dari lexical ke semantik.

## 0. Latar & keputusan yang mendasari

Ditinjau dari RAGFlow, AnythingLLM, dan Dify. Ketiganya menjalankan **pipa yang
sama**. Kita **tidak** menjalankan layanannya (Elasticsearch/MySQL/MinIO/Docker,
RAM 16GB+, dan — paling penting — dokumen mutu/klinis keluar ke sistem pihak
ketiga). Kita **mengadopsi strukturnya** dan membangun ringan di Supabase sendiri,
sehingga **data tetap di dalam** (aman untuk UU PDP).

Pipa yang diadopsi:

```
Dokumen → Chunk → Embed → Simpan(vector) → Retrieve(top-k) → Augment → Jawab+sitasi
           ▲ PUNYA        ▲ tambah rute     ▲ pgvector
        (sectionizer)     (Gemini embed)   (Supabase)
```

## 1. Yang dipecahkan

1. **"Chat dengan SOP"** — tanya-jawab yang di-*grounding* ke isi dokumen nyata,
   dengan **sitasi** (dokumen & bagian mana jawabannya berasal).
2. **Deteksi tumpang tindih semantik** (Fase 3 rancangan overlap) — mengenali dua
   SOP yang bermakna sama walau katanya beda.
3. **Gap analysis lebih tajam** — grounded ke isi, bukan judul.

## 2. Batas nyata stack (diperiksa)

- **Gateway LLM**: NVIDIA NIM (utama) → **Gemini** (fallback). Base Gemini sudah
  ada. Belum ada rute embedding.
- **pgvector belum aktif** di Supabase (mudah diaktifkan — satu ekstensi).
- **Basis data di Sydney** (~100 ms/kueri) → pencarian vektor di dalam Postgres
  (satu kueri), pengindeksan di latar.
- **Dokumen klinis** → semua tetap di Supabase; tidak keluar.

## 3. Prasyarat (dua)

1. **Aktifkan pgvector**: `CREATE EXTENSION IF NOT EXISTS vector;`
2. **Rute embedding di gateway**: tambah `action:'embed'` → panggil Gemini
   `text-embedding-004` (`:embedContent`, **768 dimensi**). Model & dimensi
   **dikunci** karena menentukan lebar kolom vektor. (Alternatif: model embedding
   NVIDIA NIM OpenAI-compatible; dimensi menyesuaikan.)

## 4. Reuse yang sudah ada (nol pekerjaan baru)

- **Chunker = sectionizer** (`agDocSectionize` di docs.js). Dokumen sudah dipecah
  per bagian baku (Tujuan, Isi Prosedur, dst) — itu **chunk bermakna**, jauh lebih
  baik dari potong-buta 500 kata. Bagian yang terlalu panjang dipecah lagi per
  paragraf dengan sedikit tumpang-tindih (overlap) antar potongan.
- **Registry** (`document_registry.extracted_meta.full_text`) sumber teksnya.
- **Gateway** untuk embedding & jawaban.

## 5. Model data (skema `agentic`)

```
agentic.document_chunks
  id, document_id (fk), section_key text,   -- mis. ISI_PROSEDUR
  ord int,                                   -- urutan potongan dalam dokumen
  content text,
  embedding vector(768),                     -- Gemini text-embedding-004
  token_est int, updated_at
  INDEX hnsw (embedding vector_cosine_ops)   -- atau ivfflat bila hnsw tak tersedia

agentic.document_embeddings                  -- untuk overlap semantik (Fase 2)
  document_id (unik), embedding vector(768), -- rata-rata/centroid chunk
  updated_at
```

## 6. Alur & RPC

**Pengindeksan** (client/worker, saat dokumen diterbitkan/disunting atau tombol
"Indeks Ulang"):
1. `agDocSectionize(full_text)` → bagian.
2. Bagian panjang dipecah per paragraf (target ~500–800 token, overlap ~80).
3. Tiap potongan → gateway `embed` → vektor.
4. `agentic_rag_index(p_doc, p_chunks jsonb)` — hapus chunk lama dokumen itu,
   masukkan yang baru (idempoten per dokumen). Hitung centroid → document_embeddings.

**Pencarian** (Postgres, satu kueri):
```
agentic_rag_search(p_embedding vector, p_k int, p_dept text default null,
                   p_status text default null)
  → chunk teratas by (embedding <=> p_embedding), plus doc_number/title/section.
```

**Chat**:
1. Embed pertanyaan → `agentic_rag_search` (k=6–8, filter dept/status opsional).
2. Rakit prompt: "Jawab HANYA dari KONTEKS berikut. Sebutkan sitasi [No.Dok §Bagian].
   Bila tak ada di konteks, katakan tidak ditemukan — jangan mengarang." + potongan.
3. Gateway → jawaban + **sitasi ke dokumen/bagian**. Klik sitasi → buka dokumen.

## 7. Yang diadopsi dari tiap repo (struktur/API, bukan layanannya)

- **RAGFlow** — bentuk chunk→retrieve→(rerank), "deep document understanding".
  Kita ambil: pemisahan chunk bermakna (via sectionizer) + opsi rerank di Fase 3.
- **AnythingLLM** — pola "workspace chat" + **sitasi sumber** + abstraksi vector
  DB. Kita ambil: API chat-dengan-dokumen berbasis sitasi.
- **Dify** — pola "retrieval node → prompt template → LLM". Kita ambil: template
  prompt grounded. (Workflow/agent sudah kita punya lewat task/worker.)

## 8. Integrasi ke yang sudah ada

- **UI "Chat dengan Dokumen"** — bagian/sub-tab baru di Agentic (atau di Wiki
  sebagai "Tanya Dokumen"). Kotak tanya + jawaban + kartu sitasi.
- **Overlap Fase 2** — ganti/lengkapi skor lexical (Fase 1) dengan cosine antar
  `document_embeddings`. Ambang & tinjauan manusia tetap.
- **Gap analysis** — retrieve klausul ISO vs isi dokumen untuk temuan lebih akurat.

## 9. Risiko yang harus disadari (terbuka)

- **Biaya embedding** — 200 dokumen × beberapa chunk = ratusan panggilan embed
  sekali indeks. Sekali saja (di-cache), tapi perlu dijadwalkan/di-batch. Re-index
  hanya saat isi berubah.
- **Sampah masuk** — PDF scan/isi tipis → embedding buruk → jawaban buruk. RAG tak
  menyembuhkan dokumen kosong (lihat Editor AI + tarik-PDF).
- **Halusinasi tetap mungkin** — mitigasi: prompt "hanya dari konteks" + **sitasi
  wajib** + peringatan bahwa jawaban perlu diverifikasi. Untuk mutu/klinis, jawaban
  RAG adalah **alat bantu cari**, bukan otoritas.
- **Kunci dimensi** — ganti model embedding = re-index semua. Pilih sekali di awal.
- **Tuning indeks** — hnsw/ivfflat perlu disetel saat data bertambah.

## 10. Pentahapan

| Fase | Isi | Prasyarat |
|---|---|---|
| **1** | pgvector + rute embed + document_chunks + index + `agentic_rag_search` + UI "Chat dengan Dokumen" (jawaban + sitasi) | aktifkan pgvector, tambah rute embed |
| **2** | Overlap **semantik** (cosine document_embeddings) melengkapi Fase 1 lexical | Fase 1 |
| **3** | Gap analysis grounded + reranking (opsional) | Fase 1–2 |

Fase 1 sudah berguna sendiri (chat-with-docs). Fase 2–3 memanfaatkan indeks yang
sama tanpa infrastruktur baru.

## 11. Yang perlu diputuskan sebelum eksekusi

1. **Model embedding**: Gemini `text-embedding-004` (768d, kunci Gemini sudah ada)
   — **disarankan**. Atau embedding NVIDIA NIM.
2. **Pemicu indeks**: otomatis saat **Terbitkan/simpan**, atau tombol **"Indeks
   Ulang"** manual, atau keduanya. (Saran: manual dulu — kendali biaya.)
3. **Cakupan**: semua dokumen, atau **PUBLISHED saja** dulu (lebih relevan &
   hemat).
4. **Akses chat**: siapa boleh bertanya (semua pengguna login, atau peran
   tertentu).

---
*Rancangan ini belum menyentuh kode. Setujui/ubah dulu, baru dibangun bertahap
mulai Fase 1.*
