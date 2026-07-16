# OneLab Agentic — Fase 3 & 4 (Content Agent + Hardening)

Kelanjutan `AGENTIC_FASE12.md`. Fase 1–2 harus sudah terpasang.

## Apa yang baru

| Fase | Deliverable | Implementasi |
|---|---|---|
| 3 | Planner mingguan (§5.2) | Handler `PLAN_WEEKLY` + seed 17 hari kesehatan + RPC `agentic_planner_apply` (dedupe topik, auto-produksi slot H-4) |
| 3 | MAKE_SOSMED | Copy (hook/caption/hashtag/CTA, framework PAS/AIDA/EDU, anti-hyperbole §9.5) + **gambar flyer AI** via gemini-proxy → Storage |
| 3 | MAKE_ARTIKEL | 800–1200 kata + **wajib sitasi** (§9.4: kurang sitasi → 1x perbaikan → auto-FAILED) + **wajib review medis** 🩺 |
| 3 | MAKE_PPTX_DOKTER | Outline slide + speaker notes + referensi (wajib review medis) |
| 3 | MAKE_EVENT_BRIEF | Brief acara + **slot promo otomatis H-14/H-7/H-1** |
| 3 | Content Studio UI | Tab baru: kalender per tanggal, produksi per slot, slot manual, galeri aset, hari kesehatan 30 hari |
| 4 | Notifikasi | Secret opsional `AGENTIC_NOTIFY_WEBHOOK` — worker POST saat ada draft baru |
| 4 | Retensi | `agentic_housekeep()` — purge cache kedaluwarsa, log LLM >90 hari |
| 4 | Monitor | Kartu 7 hari (panggilan/token/error) + daftar task FAILED dgn tombol retry |

---

# SETUP (2 LANGKAH + hard refresh)

## ✅ LANGKAH 1 — Jalankan SQL
**SQL Editor** → paste seluruh isi **`supabase_agentic_fase34.sql`** → **Run**.
Berhasil bila muncul: `Agentic Fase 3 & 4 siap — …`.

## ✅ LANGKAH 2 — Re-deploy `agentic-worker`
Kode worker berubah lagi (5 handler content + notifikasi):
**Edge Functions → agentic-worker → Code** → ganti seluruh isi dengan file repo
**`supabase/functions/agentic-worker/index.ts`** → **Deploy**.

> `llm-gateway` tetap tidak berubah. `gemini-proxy` (untuk gambar) harus sudah
> ter-deploy dari modul Wiki — kalau belum, gambar dilewati (copy tetap jadi).

## (Opsional) Secret notifikasi
`AGENTIC_NOTIFY_WEBHOOK` = URL webhook Anda (n8n / WhatsApp gateway / Slack).
Worker mengirim POST JSON `{text, count}` setiap ada draft baru menunggu approval.

Lalu **hard refresh** aplikasi → **✨ Agentic AI → Content Studio**.

---

# CARA PAKAI (alur §5.2)

1. **Content Studio** → **Jalankan Planner Mingguan** → AI mengusulkan slot
   (memanfaatkan hari kesehatan: Hari Diabetes 14 Nov → konten GLU/HBA1C, dst).
2. Slot ≤ H-4 otomatis diproduksi; slot lain klik **Produksi** kapan saja.
   Bisa juga **Slot Manual** (topik sendiri + langsung produksi).
3. Hasil masuk **Approval Inbox**: caption+hashtag+gambar (sosmed), artikel
   bersitasi (lewat 🩺 review medis), outline PPT dokter, brief event.
4. **Publish** → slot kalender jadi **READY**; aset (copy/gambar) diunduh dari
   galeri **Aset Konten** di Content Studio.
5. Auto-posting ke IG/Meta API sengaja BELUM dibuat (sesuai spec §5.2 —
   "jangan di fase 1"). Semua tetap lewat manusia.

## Cron lengkap (opsional, bila pg_cron aktif — lihat blok §CRON di tiap file SQL)
| Jadwal | Fungsi |
|---|---|
| Tiap menit | tick `agentic-worker` |
| Tiap 5 menit | `reap_stuck_tasks()` |
| Harian 02:00 WIB | `agentic_review_cycle()` |
| Senin 05:00 WIB | task `PLAN_WEEKLY` |
| Harian 03:00 WIB | `agentic_housekeep()` |

---

# Troubleshooting

| Gejala | Solusi |
|---|---|
| Tab Content Studio kosong / error RPC | Langkah 1 belum jalan. |
| Task FAILED `handler PLAN_WEEKLY belum ada` | Langkah 2 belum jalan (worker lama). |
| Artikel FAILED `Auto-reject internal: sitasi …` | Perilaku benar (§9.4) — Retry, atau turunkan `min_citations` di payload. |
| Gambar tidak dibuat, copy jadi | Normal bila gemini-proxy belum di-deploy / kuota gambar habis — non-fatal. |
| Kartu 7-hari di Monitor tidak muncul | Langkah 1 belum jalan (`agentic_monitor_7d`). |

## Status build spec
Fase 0 ✅ · Fase 1 ✅ · Fase 2 ✅ · Fase 3 ✅ · Fase 4 ✅ — spec v1.0 tuntas.
Backlog lanjutan (di luar spec): render DOCX/PPTX/flyer template Playwright
(butuh service render kecil), auto-posting Meta API, RLS role APPROVER.
