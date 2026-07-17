# OneLab Agentic — Fase 6 (ORGANISASI AGENT)

Dari "Anda orkestra semua" → **organisasi AI dengan mandat**. Anda (CEO) hanya
menerima eskalasi, laporan harian, dan memegang publish kelas berisiko.

## Struktur

```
ANDA (CEO) ── hanya: eskalasi R3 · publish R2 · laporan harian
   └─ 👔 HEAD (Chief of Staff — decision maker, Nemotron)
        ├─ ✍️ QA Konten   (LLM-as-judge, rubrik konten & anti-hyperbole)
        ├─ 🧪 QA Mutu     (LLM-as-judge, rubrik SOP/ISO 15189)
        ├─ 🖥️ Kepala IT   (diag semua jalur AI + bebaskan task macet + alert)
        ├─ 📋 Kepala Team (menyusul — nonaktif)
        └─ 🚚 Logistik    (menyusul — nonaktif)
```

## Matriks Mandat (keputusan Anda: FULL AUTO R1)

| Kelas | Task | Alur |
|---|---|---|
| **R1** | MAKE_SOSMED (non-medis) | QA Konten menilai → PASS ≥75 → **HEAD approve + PUBLISH sendiri** → Anda hanya baca laporan. FAIL → HEAD reject + feedback QA → AI perbaiki sendiri |
| R1 tanpa QA | PLAN_WEEKLY, DOC_INGEST, GAP_ANALYSIS, log organ | langsung ditutup HEAD (log) |
| **R2** | DOC_REPAIR, DOC_GENERATE, EVENT_BRIEF | QA Mutu/Konten → PASS → HEAD **APPROVE** → tinggal 1 klik **Publish** Anda (nomor dokumen resmi tetap keputusan manusia) |
| **R3** | MAKE_ARTIKEL, PPTX_DOKTER, semua ber-review-medis | QA menilai → HEAD **hanya merekomendasikan** via pesan — keputusan 100% Anda |

- `needs_medical_review` **selalu memaksa R3**, apa pun isi matriks.
- Setiap keputusan HEAD tercatat di audit trail dgn alasan (`HEAD: mandat R1, QA PASS 88/100`).
- Ubah mandat kapan pun: `update agentic.decision_rights set ...` — tanpa deploy.

---

# SETUP (3 LANGKAH)

## ✅ 1 — SQL
SQL Editor → paste **`supabase_agentic_fase6.sql`** → Run.
(`Agentic Fase 6 siap — …`)

## ✅ 2 — Re-deploy `agentic-worker`
Ganti isi dgn file repo `supabase/functions/agentic-worker/index.ts` → Deploy.
(3 handler baru: QA_REVIEW, HEAD_TICK, IT_CHECK. `llm-gateway` tidak berubah.)

## ✅ 3 — Cron (keputusan Anda: otomatis penuh)
**Database → Extensions**: aktifkan **pg_cron** + **pg_net** (sekali saja).
Lalu jalankan blok **§CRON ORGANISASI** di akhir `supabase_agentic_fase6.sql`
(ganti `<PROJECT>` = `rmyqzyfvlmjxtatpctks` dan `<SERVICE_ROLE_KEY>` dari
Settings → API). Hasil: worker/menit · HEAD/15 menit · standup 07:00 WIB ·
IT check/6 jam · reaper/5 menit.

Hard refresh app → **Agentic AI → Organisasi**.

---

# CARA KERJA HARIAN (setelah cron aktif)

1. Planner mengisi kalender → task produksi jalan → draft.
2. **HEAD tick**: draft tanpa QA → menugaskan QA agent. Draft ber-QA → diputus
   sesuai matriks. Task gagal → auto-retry.
3. Sosmed lolos QA → **terbit sendiri** (aset siap di Content Studio).
   SOP lolos QA → **APPROVED**, menunggu 1 klik Anda.
   Artikel medis → **eskalasi** dgn rekomendasi HEAD + skor QA.
4. **07:00 WIB**: standup HEAD di tab Organisasi (+ webhook bila diset).
5. **Kepala IT** tiap 6 jam: tes semua jalur AI, bebaskan task macet ≥10 menit,
   alert bila ada jalur mati.

Tombol manual tetap ada di tab Organisasi: **Jalankan HEAD · IT Check · Minta Standup**.

# Uji cepat setelah setup
1. Tab Organisasi → **Jalankan HEAD** → HEAD menugaskan QA utk semua draft lama.
2. **Jalankan Worker** 2-3× (atau tunggu cron) → QA menilai → tick HEAD
   berikutnya memutuskan.
3. Lihat: Inbox (badge 🧪 QA di tiap task), pesan HEAD di tab Organisasi,
   audit trail berisi "HEAD: mandat …".

# Troubleshooting
| Gejala | Solusi |
|---|---|
| Tab Organisasi: "belum terpasang" | Langkah 1 belum jalan |
| Task FAILED `handler HEAD_TICK belum ada` | Langkah 2 belum jalan |
| HEAD tidak memutuskan draft lama | Wajar 2 tick: tick-1 menugaskan QA, tick-2 memutuskan |
| Mau cabut mandat R1 | `update agentic.decision_rights set auto_action='AUTO_APPROVE' where task_type='MAKE_SOSMED';` |

## Berikutnya (backlog F6C–E)
Memori RAG (pgvector + NVIDIA embeddings — QA menilai berdasar SOP Anda sendiri),
Kepala Team (SLA & standup kaya), Logistik (baca inventory nyata → draft PO),
bus pesan antar-agent penuh.
