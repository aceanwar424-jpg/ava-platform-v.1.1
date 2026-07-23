# Rancangan — Deteksi Tumpang Tindih Antar Dokumen (Agentic)

Status: **RANCANGAN (belum dibangun)** · Disiapkan untuk ditinjau sebelum eksekusi.

## 1. Masalah yang dipecahkan

Setelah ~200 dokumen mutu masuk registry, muncul pertanyaan yang tak bisa
dijawab satu layar pun sekarang: **apakah ada dua dokumen (atau lebih) yang isinya
tumpang tindih** — mengatur hal yang sama, saling mengulang, atau malah saling
bertentangan?

Ini **berbeda** dari gap analysis yang sudah ada:

| | Gap analysis (sudah ada) | Deteksi tumpang tindih (rancangan ini) |
|---|---|---|
| Membandingkan | Dokumen **vs klausul ISO** | Dokumen **vs dokumen lain** |
| Menjawab | "Dokumen wajib apa yang belum ada?" | "Dokumen mana yang beririsan / berlebih?" |

## 2. Batasan nyata stack kita (diperiksa, bukan diasumsikan)

- **Tidak ada embedding endpoint** — `llm-gateway` hanya teks-masuk/teks-keluar.
- **Tidak ada pgvector** di basis data.
- Basis data di **Sydney (~100 ms/kueri)** — pekerjaan berat harus di worker, bukan per-klik.
- LLM berbiaya per panggilan — membandingkan **semua** pasangan mustahil:
  200 dokumen = **19.900 pasangan**. Tak mungkin diserahkan ke LLM satu per satu.

Karena itu rancangan **tidak** mengandalkan embedding/pgvector. Bila nanti keduanya
ditambah, jadi peningkatan (Fase 3), bukan prasyarat.

## 3. Pendekatan — corong dua tahap

Menyaring dari murah→mahal, agar biaya LLM terbatas hanya pada pasangan yang
benar-benar mencurigakan.

### Tahap A — Penyaring deterministik (tanpa LLM, murah)

Untuk tiap dokumen, hitung sekali "sidik ciri" dari `extracted_meta.full_text`:

- **Istilah kunci** — kata bermakna paling sering (buang kata umum/stopword ID),
  ambil ~40 teratas.
- **Klausul ISO** yang dirujuk (mis. 7.5, 8.2) — sudah lazim ada di dokumen mutu.
- **Judul bagian** (Tujuan, Ruang Lingkup, Prosedur, dst).
- **Pernyataan ruang lingkup** (kalimat di bawah "Ruang Lingkup").

Lalu bandingkan tiap pasangan dengan ukuran murah (aritmetika, bukan LLM):
kemiripan **Jaccard** pada istilah kunci + kesamaan klausul + kesamaan ruang lingkup
→ **skor 0–1**. 19.900 pasangan hanya operasi himpunan — ringan.

**Keluaran Tahap A:** daftar pendek pasangan dengan skor di atas ambang (mis. ≥0,45).
Untuk 200 dokumen yang tertata, biasanya tersisa puluhan pasangan, bukan ribuan.

### Tahap B — Penilaian LLM (hanya pada daftar pendek)

Untuk tiap pasangan mencurigakan, satu panggilan LLM (lewat `agLLMText`) menilai:

- **Jenis tumpang tindih:**
  - `DUPLIKAT` — isinya pada dasarnya sama
  - `SEBAGIAN` — sebagian bab beririsan
  - `KONFLIK` — mengatur hal sama dengan aturan **berbeda** (paling berbahaya)
  - `PELENGKAP` — bersinggungan topik tapi saling melengkapi (bukan masalah)
- **Bagian mana** yang beririsan
- **Anjuran:** gabung / rujuk-silang / pertegas batas ruang lingkup / biarkan

LLM **hanya menilai**, tidak mengubah dokumen apa pun. Biaya terkendali oleh
ambang Tahap A.

## 4. Model data (skema `agentic`, lewat RPC — pola yang sama)

```
agentic.document_features            -- satu baris per dokumen (cache ciri)
  document_id (unik), key_terms jsonb, iso_clauses jsonb,
  section_titles jsonb, scope_text text, computed_at

agentic.document_overlaps            -- satu baris per pasangan
  id, doc_a, doc_b (doc_a < doc_b agar unik), score numeric,
  overlap_type text,          -- DUPLIKAT/SEBAGIAN/KONFLIK/PELENGKAP (diisi Tahap B)
  overlapping_sections jsonb, recommendation text,
  status text,                -- DETECTED/REVIEWED/RESOLVED/DISMISSED
  reviewed_by, reviewed_at, created_at, updated_at
  UNIQUE(doc_a, doc_b)
```

Bersifat dapat-diperbarui (bukan hanya-tambah) karena status berubah saat ditinjau.
Jejak keputusan tetap tercatat lewat `logActivity`.

## 5. Alur & manusia-dalam-lingkaran (invarian R3 dijaga)

1. Pengguna menekan **"Pindai Tumpang Tindih"** → membuat task `DOC_OVERLAP_SCAN`.
2. Worker: hitung/ambil `document_features` semua dokumen → Tahap A → simpan daftar
   pendek ke `document_overlaps` (status `DETECTED`) → jalankan Tahap B pada daftar
   pendek → isi jenis + anjuran.
3. Layar **"Tumpang Tindih Dokumen"** (sub-tab baru di Review) menampilkan pasangan
   terurut skor: jenis, bagian yang beririsan, anjuran. `KONFLIK` ditandai merah.
4. **Manusia memutuskan** — tandai *Ditindaklanjuti* / *Diabaikan* (mis. dua SOP
   memang beda unit). Sistem **tidak** menggabung/menghapus apa pun sendiri.

## 6. Antarmuka

- Sub-tab **"Tumpang Tindih"** di tab Review (sebelah kelengkapan pengesahan).
- Kartu ringkas: jumlah pasangan per jenis (Duplikat / Sebagian / Konflik).
- Tabel pasangan: Dok A ↔ Dok B · skor · jenis · bagian beririsan · anjuran · aksi
  (Tinjau, Abaikan). Klik membuka kedua dokumen berdampingan (pratinjau yang sudah
  kita punya).

## 7. Pentahapan

| Fase | Isi | Biaya LLM | Nilai |
|---|---|---|---|
| **1** | Ciri + Tahap A + tabel daftar pendek | **Nol** | Langsung menandai pasangan mencurigakan |
| **2** | Tahap B (jenis + anjuran per pasangan) | Terbatas (hanya daftar pendek) | Kualifikasi & rekomendasi |
| **3** *(opsional)* | Embedding + pgvector untuk recall lebih baik | Perlu endpoint embedding baru | Menangkap kemiripan makna yang lolos penyaring kata |

Fase 1 sudah berguna sendiri (tanpa biaya LLM). Fase 2 menambah penilaian. Fase 3
hanya bila Fase 1–2 terbukti kurang menangkap.

## 8. Risiko yang harus disadari (dinyatakan terbuka)

- **Positif palsu dari boilerplate** — dua dokumen bisa terlihat mirip hanya karena
  berbagi kop/klausul ISO/format. Penyaring harus membuang bagian boilerplate;
  tetap perlu mata manusia. Fitur ini **anjuran**, bukan vonis.
- **Sampah masuk, sampah keluar** — PDF hasil scan dengan OCR buruk menghasilkan
  ciri buruk → deteksi buruk. Dokumen berteks (DOCX / PDF teks) jauh lebih andal.
- **Kalibrasi ambang** — terlalu rendah = banjir pasangan; terlalu tinggi = luput.
  Ambang perlu disetel setelah melihat data nyata Anda.
- **O(n²)** — 200 dokumen ringan; kalau kelak ribuan, Tahap A perlu penyaring blok
  (mis. hanya bandingkan dalam level+departemen sama dulu).

## 9. Yang perlu diputuskan sebelum eksekusi

1. **Mulai dari Fase 1 saja** (deterministik, nol biaya LLM) lalu lihat hasilnya
   sebelum menyalakan Fase 2? — **disarankan**.
2. **Cakupan pembandingan awal:** semua dokumen, atau dalam **departemen sama** dulu
   (lebih relevan — tumpang tindih biasanya di dalam satu unit)?
3. **Ambang skor awal** — mulai konservatif (mis. 0,5) agar tidak membanjiri.

---
*Rancangan ini belum menyentuh kode. Setujui/ubah dulu, baru dibangun bertahap.*
