# OneLab Agentic — Fase 5 (Diagnostik, Pemulihan & Render DOCX)

Menjawab masalah nyata di lapangan: **task menggantung "Diproses" tanpa kejelasan
error** — sekarang bisa didiagnosis 1 klik dan dipulihkan 1 klik.

## Apa yang baru

| Fitur | Di mana | Fungsi |
|---|---|---|
| 🩺 **Tes Koneksi AI** | Agentic AI → Monitor | Menguji SETIAP provider × key × model dengan prompt mini (timeout 15 dtk) → tabel ✅/❌ + latensi + pesan error + **verdict cerdas** (contoh: "Model MAIN NVIDIA bermasalah padahal key valid — ganti Secret NVIDIA_MODEL_MAIN") |
| ♻ **Bebaskan Task Macet** | Agentic AI → Monitor | Task PROCESSING ≥3 menit dibebaskan: antri ulang, atau FAILED (dgn pesan jelas) bila budget 3x habis |
| ⏳ Deteksi macet di Inbox | Detail task PROCESSING | Tampil durasi berjalan; ≥3 menit muncul peringatan + arahan |
| ⏱ Timeout LLM | llm-gateway + worker | 75 dtk/percobaan + anggaran total 115 dtk → provider hang kini GAGAL CEPAT & TERCATAT di log, failover jalan |
| 🪜 Fallback model | llm-gateway | NVIDIA main → NVIDIA light → Gemini (task tetap jalan walau model utama mati) |
| 📄 **Unduh .docx** | Inbox & Wiki | Markdown draft/dokumen resmi dirender jadi .docx **langsung di browser** (heading, bullet, bold, style OneLab) — menutup gap render Fase 0 |
| 📚 Wiki dirapikan | Wiki OneLab | Wiki = **perpustakaan manual**; produksi AI diarahkan ke Agentic (banner + menu); dokumen PUBLISHED Agentic tampil di seksi "Dokumen Resmi" |
| 🎨 **Gambar via NVIDIA FLUX** | llm-gateway `mode:'image'` | Flyer sosmed kini digenerate **NVIDIA FLUX** (default `black-forest-labs/flux.1-schnell`) → fallback Gemini. Dipakai worker MAKE_SOSMED **dan** Wiki Media. Model diganti via secret `NVIDIA_IMAGE_MODEL` |
| 📍 Penunjuk arah konten | Inbox | Task APPROVED/PUBLISHED kini menampilkan kartu "hasilnya ada di …" (Content Studio / Dokumen QMS / Wiki) |

## Ke mana konten setelah di-approve? (alur lengkap)

```
DRAFT ──Setujui──► APPROVED ──Publish──► PUBLISHED
                                          │
        ┌─────────────────────────────────┴──────────────────────────┐
        │ Agent CONTENT (sosmed/artikel/ppt/event)                    │
        │  → Content Studio ► Aset Konten: salin caption, lihat/unduh │
        │    gambar (Storage bucket agentic/renders), unduh .md/.docx │
        │  → slot kalender jadi READY (siap diposting manual)         │
        ├──────────────────────────────────────────────────────────────┤
        │ Agent DOCUMENT (SOP/pedoman)                                 │
        │  → Dokumen QMS: nomor resmi OL/…, revisi, jadwal review      │
        │  → Wiki OneLab ► seksi "Dokumen Resmi" (unduh .docx)         │
        └──────────────────────────────────────────────────────────────┘
```
*Auto-posting ke IG/Meta sengaja belum dibuat (spec §5.2) — posting tetap manusia.*

## Pilihan model gambar NVIDIA (analisis)

| Model | Lisensi | Cocok? |
|---|---|---|
| **flux.1-schnell** ✅ default | Apache-2.0 (bebas komersial) | Tercepat (4 langkah), kualitas bagus utk flyer — **pilihan aman utk konten marketing OneLab** |
| flux.2-klein-4b | Apache-2.0, generasi terbaru (FLUX.2) | Kualitas lebih baru + bisa image editing; ganti `NVIDIA_IMAGE_MODEL=black-forest-labs/flux.2-klein-4b` bila tersedia di akun Anda |
| flux.1-dev / Kontext-dev | **Non-Commercial** | ⚠ Hindari utk materi marketing komersial |

Kuota: endpoint hosted build.nvidia.com memakai **kredit developer gratis** (sama
dgn key nvapi Anda). Untuk produksi volume tinggi nanti bisa self-host (model
"Downloadable") — arsitektur tidak berubah, cukup ganti endpoint.

---

# SETUP (3 LANGKAH + hard refresh)

## ✅ 1 — SQL
**SQL Editor** → paste **`supabase_agentic_fase5.sql`** → Run.
(`Agentic Fase 5 siap — …`)

## ✅ 2 — Re-deploy DUA Edge Function
Kali ini **keduanya berubah**:
1. **`llm-gateway`** ← isi dari `supabase/functions/llm-gateway/index.ts` (timeout + diag + fallback)
2. **`agentic-worker`** ← isi dari `supabase/functions/agentic-worker/index.ts` (backstop timeout)

## ✅ 3 — Pulihkan task yang macet
Hard refresh aplikasi → **Agentic AI → Monitor**:
1. Klik **Tes Koneksi AI** → lihat verdict. Bila "Model MAIN bermasalah":
   Settings → Edge Functions → Secrets → set **`NVIDIA_MODEL_MAIN`** ke model yang
   ada di [build.nvidia.com](https://build.nvidia.com) (mis. `meta/llama-3.3-70b-instruct`).
   (Tanpa diganti pun task tetap jalan berkat fallback light/Gemini — hanya kualitas main model yang hilang.)
2. Klik **Bebaskan Task Macet** → task PROCESSING lama antri ulang.
3. Klik **Jalankan Worker** → sekarang setiap kegagalan pasti tercatat:
   status FAILED + kolom Error di Inbox + log di tabel `llm_requests`.

---

# Kenapa kemarin macet "Diproses" tanpa error?

Kombinasi tiga hal (semua sudah ditutup):
1. Panggilan ke model NVIDIA 70B **menggantung** (model lama kemungkinan tak
   dilayani lagi) — dan gateway lama **tidak punya timeout** → menunggu selamanya.
2. Invocation Edge Function dibunuh platform (±150 dtk, HTTP 504) → worker mati
   **sebelum sempat menulis status/error** → task terkunci PROCESSING.
3. Reaper (pembersih task macet) hanya jalan via cron yang belum diaktifkan.

Sekarang: hang → timeout 75 dtk → tercatat `ERROR` di log → coba key/model/provider
berikut → kalau semua gagal → task **FAILED dengan pesan jelas** → tombol Retry.
Plus tombol reap manual bila ada kejadian di luar dugaan.

## Status build
Fase 0–4 (spec v1.0) ✅ · Fase 5 (di luar spec: diagnostik+render) ✅
Sisa backlog opsional: PPTX asli (bukan outline), auto-posting Meta API,
RLS role APPROVER (perlu desain auth dulu — seluruh app masih pakai anon key).
