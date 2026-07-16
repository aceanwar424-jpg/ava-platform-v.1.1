# OneLab Agentic — Fase 0 (Fondasi)

Implementasi `ONELAB_AGENTIC_SPEC.md` **Fase 0**, diadaptasi ke arsitektur
**Supabase-native** (tanpa VPS/Redis/BullMQ). Prinsip wajib §1 tetap dipenuhi.

## Peta spec → implementasi

| Spec | Implementasi di sini |
|---|---|
| Prisma schema §4 + migrasi | `supabase_agentic.sql` (schema `agentic`, DDL persis §4) |
| BullMQ + Redis (queue) | tabel `agentic.tasks` + `claim_task()` (`FOR UPDATE SKIP LOCKED`) |
| Scheduler (repeatable jobs) | `pg_cron` + `pg_net` (lihat §CRON di SQL) |
| Workers (proses Node) | Edge Function `agentic-worker` (tick, bukan loop bebas — §1.2) |
| `packages/llm-gateway` | Edge Function `llm-gateway` (NVIDIA primary → Gemini fallback) |
| Rate limiter Redis | hitung `llm_requests` 60 detik terakhir per `key_alias` |
| Cache Redis TTL 24 jam | tabel `agentic.llm_cache` (hanya bila `cacheable:true`) |
| `/storage` lokal | Supabase Storage |
| Kill switch `AGENTIC_PAUSED` | ✅ dicek di `agentic-worker` (§9.8) |

**Gap yang diketahui:** render Playwright/PPTX (§3, Fase 3) tidak bisa jalan di
Edge Function → akan dirender di browser saat approval, atau tambah service render
kecil nanti.

---

## Langkah Setup

### 1. Jalankan SQL
Supabase → SQL Editor → jalankan **`supabase_agentic.sql`**.

### 2. Expose schema `agentic`
Settings → **API** → **Exposed schemas** → tambahkan `agentic` → Save.
> Tanpa ini, `claim_task`/`transition_task` tidak bisa dipanggil via REST.

### 3. Deploy Edge Functions
Edge Functions → Deploy new function (Via Editor), buat **dua** fungsi:
- **`llm-gateway`** → isi dari `supabase/functions/llm-gateway/index.ts`
- **`agentic-worker`** → isi dari `supabase/functions/agentic-worker/index.ts`

### 4. Set Secrets
Settings → Edge Functions → Secrets:

```
NVIDIA_API_KEYS  = key1,key2,key3
NVIDIA_MODEL_MAIN  = meta/llama-3.1-70b-instruct
NVIDIA_MODEL_LIGHT = meta/llama-3.1-8b-instruct
GEMINI_API_KEYS  = key1,key2            # fallback
GEMINI_MODEL     = gemini-2.5-flash
LLM_RATE_LIMIT_PER_KEY_PER_MIN = 30
WORKER_CONCURRENCY = 2
# AGENTIC_PAUSED = true                 # kill switch (§9.8)
```
`SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` sudah disediakan otomatis.

---

## Smoke Test (spec Fase 0: POST /tasks → worker → DRAFT)

### A. Buat task lewat SQL Editor
```sql
insert into agentic.tasks (agent, task_type, title, payload)
values ('DOCUMENT','SMOKE_TEST','Smoke test Fase 0',
        '{"prompt":"Balas persis satu kata: OK"}'::jsonb)
returning id, status;         -- harus QUEUED
```

### B. Jalankan worker (sekali tick)
Edge Functions → `agentic-worker` → **Invoke** dengan body `{}`, atau:
```bash
curl -X POST "https://<PROJECT>.supabase.co/functions/v1/agentic-worker" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" -d '{}'
```
Respons yang diharapkan:
```json
{ "worker":"edge-xxxxxxx", "processed":1,
  "results":[{"taskId":"...","status":"DRAFT","note":"LLM NVIDIA/meta/llama-3.1-8b-instruct · 812ms"}] }
```

### C. Verifikasi state machine + audit trail
```sql
select status, result from agentic.tasks order by created_at desc limit 1;
-- status = DRAFT, result berisi {ok:true, provider:'NVIDIA', text:'OK', ...}

select from_status, to_status, actor_type, note
from agentic.task_events order by created_at;
-- QUEUED→PROCESSING (WORKER) lalu PROCESSING→DRAFT (WORKER)

select provider, model, key_alias, status, latency_ms
from agentic.llm_requests order by created_at desc limit 5;
-- log panggilan LLM + key mana yang dipakai
```

### D. Uji tanpa LLM (murni queue)
```sql
insert into agentic.tasks (agent, task_type, title, payload)
values ('CONTENT','SMOKE_TEST','Dummy tanpa LLM','{"use_llm":false}'::jsonb);
```

### E. Uji guard human-in-the-loop (§1.1) — harus ERROR
```sql
select agentic.transition_task(
  (select id from agentic.tasks where status='DRAFT' limit 1),
  'PUBLISHED','USER',null,'coba lompat approval');
-- ERROR: Transisi tidak sah: DRAFT → PUBLISHED   ✅ (memang harus ditolak)
```

---

## Aktifkan scheduler (opsional di Fase 0)
Database → Extensions → aktifkan **pg_cron** & **pg_net**, lalu jalankan blok
`§CRON` yang ada di akhir `supabase_agentic.sql` (ganti `<PROJECT>` &
`<SERVICE_ROLE_KEY>`).

---

## Status verifikasi lokal

| Uji | Hasil |
|---|---|
| Logika llm-gateway (rotasi, urutan provider, aturan lampiran, retryable) | ✅ 8/8 |
| Matriks transisi state machine §4.2 + guard §1.1 | ✅ 15/15 |

> Type-check Deno dilakukan Supabase saat deploy (Deno tidak terpasang di mesin dev ini).

## Berikutnya — Fase 1
- Approval engine + API §7 (inbox, approve/reject/retry)
- UI **Approval Inbox** sebagai modul di app (vanilla, pola Wiki OneLab)
