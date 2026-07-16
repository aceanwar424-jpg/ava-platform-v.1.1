# OneLab Agentic — Fase 0 (Fondasi)

Implementasi `ONELAB_AGENTIC_SPEC.md` **Fase 0**, diadaptasi ke **Supabase-native**
(tanpa VPS/Redis/BullMQ). Prinsip wajib §1 tetap dipenuhi.

## Peta spec → implementasi

| Spec | Implementasi |
|---|---|
| Prisma schema §4 + migrasi | `supabase_agentic.sql` — schema `agentic`, DDL persis §4 |
| BullMQ + Redis (queue) | tabel `agentic.tasks` + `claim_task()` (`FOR UPDATE SKIP LOCKED`) |
| Scheduler | `pg_cron` + `pg_net` (blok §CRON di akhir SQL) |
| Workers (Node) | Edge Function `agentic-worker` (tick, bukan loop bebas — §1.2) |
| `packages/llm-gateway` | Edge Function `llm-gateway` (NVIDIA primary → Gemini fallback) |
| Rate limiter Redis | `agentic_rate_count()` — hitung `llm_requests` 60 detik terakhir per key |
| Cache Redis 24 jam | tabel `agentic.llm_cache` (hanya bila `cacheable:true`) |
| Kill switch | `AGENTIC_PAUSED=true` (§9.8) |

**Gap diketahui:** render Playwright/PPTX (Fase 3) tidak bisa di Edge Function →
akan dirender di browser saat approval, atau service render kecil menyusul.

> **Catatan desain:** tabel tetap terisolasi di schema `agentic` (sesuai spec §2),
> tapi diakses lewat **fungsi tipis di schema `public`** (`agentic_*`). Jadi
> **tidak perlu** mengutak-atik "Exposed schemas" di dashboard.

---

# PANDUAN SETUP (3 LANGKAH)

## ✅ LANGKAH 1 — Jalankan SQL

1. Buka **Supabase Dashboard** → pilih project Anda.
2. Menu kiri → **SQL Editor** → **+ New query**.
3. Buka file **`supabase_agentic.sql`** dari repo → **Ctrl+A**, **Ctrl+C**.
4. Paste ke SQL Editor → klik **Run** (Ctrl+Enter).
5. Berhasil bila muncul: `Agentic schema (Fase 0) siap`.

Cek cepat — jalankan di SQL Editor:
```sql
select routine_name from information_schema.routines
where routine_schema='public' and routine_name like 'agentic_%'
order by 1;
```
Harus muncul **7 baris**: `agentic_cache_get`, `agentic_cache_put`, `agentic_claim_task`,
`agentic_create_task`, `agentic_log_llm`, `agentic_rate_count`, `agentic_transition`.

---

## ✅ LANGKAH 2 — Isi Secrets (API key)

**Lokasi:** menu kiri paling bawah **⚙️ Project Settings** → **Edge Functions**
→ bagian **Secrets** → tombol **Add new secret**.

> Kalau tidak ketemu, coba menu kiri **Edge Functions** → tab **Secrets**.
> (Nama menu berubah-ubah antar versi dashboard — yang dicari: *Edge Functions → Secrets*.)

Tambahkan satu per satu (**Name** → **Value**):

| Name | Value (contoh) | Wajib? |
|---|---|---|
| `NVIDIA_API_KEYS` | `nvapi-xxx,nvapi-yyy,nvapi-zzz` | ✅ (primary) |
| `NVIDIA_MODEL_MAIN` | `meta/llama-3.1-70b-instruct` | opsional |
| `NVIDIA_MODEL_LIGHT` | `meta/llama-3.1-8b-instruct` | opsional |
| `GEMINI_API_KEYS` | `AIza-xxx,AIza-yyy` | ✅ (fallback) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | opsional |
| `LLM_RATE_LIMIT_PER_KEY_PER_MIN` | `30` | opsional |
| `WORKER_CONCURRENCY` | `2` | opsional |
| `AGENTIC_PAUSED` | `true` | opsional — kill switch darurat |

**Banyak key → pisahkan dengan koma**, tanpa spasi wajib. Rotasi & failover otomatis.

> `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` **sudah otomatis tersedia** —
> jangan ditambahkan manual.

---

## ✅ LANGKAH 3 — Deploy 2 Edge Function

**Lokasi:** menu kiri **Edge Functions** → tombol **Deploy a new function**
→ pilih **Via Editor**.

### 3a. Fungsi `llm-gateway`
1. **Function name**: ketik persis **`llm-gateway`**
2. Editor akan berisi kode contoh → **hapus semua** (Ctrl+A, Delete)
3. Buka file repo **`supabase/functions/llm-gateway/index.ts`** → **Ctrl+A**, **Ctrl+C**
4. **Paste** ke editor → klik **Deploy function**

### 3b. Fungsi `agentic-worker`
Ulangi langkah yang sama:
1. **Function name**: **`agentic-worker`**
2. Isi dari file repo **`supabase/functions/agentic-worker/index.ts`**
3. **Deploy function**

> **Yang di-paste = seluruh isi file `.ts` itu, apa adanya.** Tidak perlu diubah.
> Tidak ada API key di dalam kode — key hanya dibaca dari Secrets (Langkah 2).

Setelah deploy, di daftar Edge Functions harus ada **2 fungsi**: `llm-gateway` dan
`agentic-worker` (plus `gemini-proxy` & `docx-to-pdf` bila sudah ada sebelumnya).

---

# SMOKE TEST (bukti Fase 0 jalan)

Target spec: **POST /tasks → worker → status DRAFT**.

### 1) Buat task — SQL Editor
```sql
select public.agentic_create_task(
  'DOCUMENT','SMOKE_TEST','Smoke test Fase 0',
  '{"prompt":"Balas persis satu kata: OK"}'::jsonb
);
```
Hasil: JSON task dengan `"status": "QUEUED"`.

### 2) Jalankan worker
**Edge Functions** → klik **`agentic-worker`** → tab **Invoke** (atau "Test") →
body `{}` → **Send**.

Respons yang diharapkan:
```json
{
  "worker": "edge-a1b2c3d4",
  "processed": 1,
  "results": [
    { "taskId": "…", "status": "DRAFT",
      "note": "LLM NVIDIA/meta/llama-3.1-8b-instruct · 812ms" }
  ]
}
```

### 3) Verifikasi — SQL Editor
```sql
-- a. status harus DRAFT + result terisi
select status, result from agentic.tasks order by created_at desc limit 1;

-- b. audit trail (§1.6): QUEUED→PROCESSING lalu PROCESSING→DRAFT
select from_status, to_status, actor_type, note
from agentic.task_events order by created_at;

-- c. log LLM: provider & key mana yang dipakai
select provider, model, key_alias, status, latency_ms
from agentic.llm_requests order by created_at desc limit 5;
```

### 4) Uji queue murni (tanpa LLM)
```sql
select public.agentic_create_task('CONTENT','SMOKE_TEST','Dummy tanpa LLM','{"use_llm":false}'::jsonb);
```
Invoke worker lagi → `status: DRAFT`, note `Smoke test dummy (tanpa LLM)`.

### 5) Uji guard human-in-the-loop (§1.1) — **harus ERROR**
```sql
select public.agentic_transition(
  (select id from agentic.tasks where status='DRAFT' limit 1),
  'PUBLISHED','USER');
```
Harus gagal: `Transisi tidak sah: DRAFT → PUBLISHED` ✅
(Artinya output AI **tidak bisa** publish tanpa approval.)

---

# Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `processed: 0` | Tidak ada task QUEUED. Jalankan Smoke Test langkah 1 dulu. |
| `Gagal klaim task: ... agentic_claim_task ... not found` | `supabase_agentic.sql` belum dijalankan / gagal. Ulangi Langkah 1 & cek 7 fungsi. |
| `status: FAILED`, note `Tidak ada API key` | Secrets belum diisi / salah nama. Cek `NVIDIA_API_KEYS` (Langkah 2). |
| note `Semua key & provider gagal` | Key salah/kuota habis. Cek log: `select * from agentic.llm_requests order by created_at desc limit 10;` |
| `llm-gateway HTTP 404` | Fungsi `llm-gateway` belum di-deploy atau namanya typo. |
| Worker diam saja | Cek secret `AGENTIC_PAUSED` — kalau `true`, hapus/ubah ke `false`. |

---

# (Opsional) Aktifkan scheduler otomatis

**Database** → **Extensions** → aktifkan **`pg_cron`** dan **`pg_net`**.
Lalu jalankan blok **§CRON** di akhir `supabase_agentic.sql` (ganti `<PROJECT>`
dan `<SERVICE_ROLE_KEY>`). Ini membuat worker jalan tiap menit + reaper tiap 5 menit.

Fase 0 boleh **tanpa** cron dulu — cukup Invoke manual.

---

## Status verifikasi lokal

| Uji | Hasil |
|---|---|
| Logika llm-gateway (rotasi, urutan provider, aturan lampiran, retryable) | ✅ 8/8 |
| Matriks transisi state machine §4.2 + guard §1.1 | ✅ 15/15 |
| RPC dipakai Edge Function ↔ tersedia di SQL | ✅ 6/6 cocok |

> Type-check Deno dilakukan Supabase saat deploy (Deno tidak terpasang di mesin dev ini).

## Berikutnya — Fase 1
Approval engine + API §7 (inbox, approve/reject/retry) + UI **Approval Inbox**
sebagai modul di app (pola Wiki OneLab).
