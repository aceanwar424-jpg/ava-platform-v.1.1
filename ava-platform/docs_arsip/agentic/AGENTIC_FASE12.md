# OneLab Agentic — Fase 1 & 2 (Approval Engine + Document Agent)

Kelanjutan `AGENTIC_FASE0.md`. Fase 0 harus sudah lulus smoke test.

## Apa yang baru

| Fase | Deliverable | Implementasi |
|---|---|---|
| 1 | Approval engine §4.2 | RPC `agentic_approve/reject/retry/cancel/publish` (SQL, satu pintu lewat `transition_task`) |
| 1 | API §7 | RPC public + view `agentic_*_v` (PostgREST) — tanpa server tambahan |
| 1 | Web Approval Inbox | Menu baru **Agentic AI** di aplikasi (rail ikon ✨): tab **Approval Inbox** |
| 2 | Ingest worker | Handler `DOC_INGEST` — DOCX/TXT/MD diekstrak di browser, PDF dibaca AI dari Storage |
| 2 | Seed ISO 15189:2022 + gap analysis | 41 klausul (4–8) + handler `GAP_ANALYSIS` (batch 10 klausul/panggilan LLM) |
| 2 | Repair & generate workers | Handler `DOC_REPAIR` / `DOC_GENERATE` + prompt templates di DB (§4.10, Firewall Isi vs Format + placeholder `[[KONFIRMASI: …]]`) |
| 2 | Compliance dashboard + publish | Tab **Compliance** (skor per departemen) + publish = nomor dokumen otomatis `OL/{TYPE}/{DEPT}/{seq}` + revisi + jadwal review 2 tahun |
| 2 | Review cycle | `agentic_review_cycle()` — manual dari UI atau cron harian |

---

# SETUP (2 LANGKAH + hard refresh)

## ✅ LANGKAH 1 — Jalankan SQL

**SQL Editor** → New query → paste seluruh isi **`supabase_agentic_fase12.sql`** → **Run**.
Berhasil bila muncul: `Agentic Fase 1 & 2 siap — …`.

Cek cepat:
```sql
select count(*) as klausul from agentic.compliance_checklist;   -- ≥ 41
select code from agentic.prompt_templates order by 1;           -- 4 template
```

## ✅ LANGKAH 2 — Re-deploy Edge Function `agentic-worker`

Kode worker **berubah** (5 handler baru). Ulangi cara yang sama:

1. **Edge Functions** → klik **`agentic-worker`** → tab **Code** (atau Deploy ulang Via Editor)
2. Hapus semua isi → paste seluruh isi file repo **`supabase/functions/agentic-worker/index.ts`** → **Deploy**

> `llm-gateway` TIDAK berubah — tidak perlu di-deploy ulang.
> Secrets juga tidak berubah.

## ✅ LANGKAH 3 — Aplikasi

Buka aplikasi → **hard refresh (Ctrl+Shift+R)** → menu rail kiri ada ikon **✨ Agentic AI**.

---

# CARA PAKAI (alur lengkap §5.1)

1. **Agentic AI → Dokumen QMS** → upload file SOP lama (.docx/.pdf/.txt/.md), biarkan
   centang *"gap analysis otomatis"* → worker jalan otomatis.
2. Metadata diekstrak LLM → masuk **Registry**. Format tidak standar → otomatis dibuat
   task perbaikan.
3. **Compliance** → lihat skor ISO 15189:2022 per departemen. Klausul wajib tanpa
   dokumen → otomatis dibuat task **DOC_GENERATE**.
4. **Approval Inbox** → semua draft AI menunggu di sini:
   - **Setujui** → APPROVED (konten medis → lewat Review Medis dulu)
   - **Tolak + Feedback** → task antri ulang, feedback jadi konteks AI (§5.1)
   - **Publish** → dokumen dapat **nomor resmi** + revisi + jadwal review 2 tahun
   - Tanda kuning **⚠ KONFIRMASI:** = nilai yang WAJIB diverifikasi manusia (AI dilarang
     mengarang angka klinis/nama/harga — §9.3)
5. Worker jalan saat tombol **Jalankan Worker** ditekan (atau otomatis tiap menit bila
   cron Fase 0 diaktifkan).

---

# Troubleshooting

| Gejala | Solusi |
|---|---|
| Menu ✨ tidak muncul | Hard refresh (Ctrl+Shift+R). |
| `RPC agentic_approve gagal` / function not found | Langkah 1 belum jalan. |
| Task ingest FAILED: `Prompt template ... tidak ditemukan` | Langkah 1 belum jalan (seed template). |
| Task FAILED: `handler DOC_INGEST belum ada` | Langkah 2 belum jalan (worker lama masih terpasang). |
| Upload gagal: bucket "agentic" | Langkah 1 belum jalan (bucket dibuat oleh SQL). |
| Ekstraksi DOCX error di browser lama | Pakai Chrome/Edge terbaru, atau konversi file ke PDF. |
| Skor compliance 0% terus | Jalankan **Gap Analysis Sekarang** di tab Compliance (butuh dokumen sudah ter-ingest). |

---

# Catatan desain

- **Human-in-the-loop tetap mutlak**: worker hanya bisa sampai DRAFT; `APPROVED`/`PUBLISHED`
  hanya lewat RPC user (matriks §4.2 di-enforce di SQL — bukan di UI).
- Output dokumen = **markdown** (bisa diunduh .md dari Inbox). Render DOCX/PDF resmi
  menyusul (gap Playwright/docx di Edge Function — lihat catatan Fase 0).
- Nomor dokumen `OL/{TYPE}/{DEPT}/{seq}` di-assign **saat publish**, bukan saat draft.
- Seed ISO 15189:2022 adalah **starter set** (41 klausul inti 4–8) — tambah/ubah lewat
  SQL atau langsung di tabel `agentic.compliance_checklist`.

## Berikutnya — Fase 3
Content & Branding Agent: content_calendar + planner mingguan + MAKE_SOSMED /
MAKE_ARTIKEL (jalur review medis sudah siap) + Content Studio UI.
