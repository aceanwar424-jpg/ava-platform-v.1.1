// Supabase Edge Function: agentic-worker
// ─────────────────────────────────────────────────────────────────────
// Worker tick — pengganti BullMQ worker (Supabase-native).
// Dipicu oleh pg_cron (tiap menit) atau invoke manual. TIDAK loop bebas:
// sekali dipanggil → ambil maksimal N task → proses → berhenti (§1.2).
//
// Alur per task (§4.2):
//   claim_task()  : QUEUED → PROCESSING   (atomik, FOR UPDATE SKIP LOCKED)
//   handler       : kerjakan
//   transition_task(): PROCESSING → DRAFT | FAILED  (+ audit ke task_events)
//
// FASE 0: hanya handler SMOKE_TEST (memvalidasi rantai API→queue→worker→LLM
// gateway→DRAFT). Handler DOC_*/MAKE_* menyusul di Fase 2 & 3.
//
// REQUEST (opsional): { max?:number, agent?:'DOCUMENT'|'CONTENT' }
// RESPONSE: { processed, results:[{taskId,status,note}] }
// ─────────────────────────────────────────────────────────────────────

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WORKER_ID = `edge-${crypto.randomUUID().slice(0, 8)}`;
const MAX_PER_TICK = parseInt(Deno.env.get('WORKER_CONCURRENCY') || '2', 10);

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json',
      'Accept-Profile': 'agentic', 'Content-Profile': 'agentic',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `RPC ${fn} gagal (HTTP ${res.status})`);
  return data;
}

// Satu-satunya jalan ke LLM (§1.4) — lewat llm-gateway, bukan API provider langsung
async function askLLM(payload: Record<string, unknown>) {
  const res = await fetch(`${SB_URL}/functions/v1/llm-gateway`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `llm-gateway HTTP ${res.status}`);
  return data;
}

// ── HANDLERS ─────────────────────────────────────────────────────────
type Task = { id: string; agent: string; task_type: string; title: string; payload: Record<string, unknown> };

async function handleSmokeTest(t: Task) {
  const useLLM = t.payload?.use_llm !== false;
  if (!useLLM) {
    return { result: { ok: true, mode: 'dummy', echo: t.payload ?? {} }, note: 'Smoke test dummy (tanpa LLM)' };
  }
  const r = await askLLM({
    taskId: t.id,
    tier: 'light',
    cacheable: true,
    temperature: 0,
    maxTokens: 64,
    system: 'Jawab sangat singkat, tanpa penjelasan tambahan.',
    prompt: String(t.payload?.prompt || 'Balas persis satu kata: OK'),
  });
  return {
    result: { ok: true, mode: 'llm', provider: r.provider, model: r.model, cached: !!r.cached, text: r.text },
    note: `LLM ${r.provider}/${r.model}${r.cached ? ' (cache)' : ''} · ${r.latencyMs ?? 0}ms`,
  };
}

const HANDLERS: Record<string, (t: Task) => Promise<{ result: unknown; note: string }>> = {
  SMOKE_TEST: handleSmokeTest,
  // Fase 2: DOC_INGEST, GAP_ANALYSIS, DOC_REPAIR, DOC_GENERATE, DOC_REVIEW_CYCLE
  // Fase 3: PLAN_WEEKLY, MAKE_SOSMED, MAKE_ARTIKEL, MAKE_PPTX_DOKTER, MAKE_EVENT_BRIEF
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Kill switch (§9.8)
  if ((Deno.env.get('AGENTIC_PAUSED') || '').toLowerCase() === 'true') {
    return json({ paused: true, processed: 0, results: [] });
  }

  const body = await req.json().catch(() => ({}));
  const max = Math.min(parseInt(body.max ?? MAX_PER_TICK, 10) || MAX_PER_TICK, 5);
  const agent = body.agent ?? null;
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < max; i++) {
    let task: Task | null = null;
    try {
      const rows = await rpc('claim_task', { p_worker: WORKER_ID, p_agent: agent });
      task = Array.isArray(rows) ? rows[0] ?? null : rows ?? null;
    } catch (e) {
      return json({ error: `Gagal klaim task: ${e instanceof Error ? e.message : String(e)}` }, 500);
    }
    if (!task) break; // queue kosong

    const handler = HANDLERS[task.task_type];
    if (!handler) {
      await rpc('transition_task', {
        p_task_id: task.id, p_to: 'FAILED', p_actor_type: 'WORKER',
        p_error: `Handler '${task.task_type}' belum diimplementasikan (lihat Fase 2/3)`,
        p_note: 'handler tidak ditemukan',
      }).catch(() => null);
      results.push({ taskId: task.id, status: 'FAILED', note: `handler ${task.task_type} belum ada` });
      continue;
    }

    try {
      const { result, note } = await handler(task);
      await rpc('transition_task', {
        p_task_id: task.id, p_to: 'DRAFT', p_actor_type: 'WORKER',
        p_result: result, p_note: note,
      });
      results.push({ taskId: task.id, status: 'DRAFT', note });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await rpc('transition_task', {
        p_task_id: task.id, p_to: 'FAILED', p_actor_type: 'WORKER', p_error: msg, p_note: 'handler error',
      }).catch(() => null);
      results.push({ taskId: task.id, status: 'FAILED', note: msg });
    }
  }

  return json({ worker: WORKER_ID, processed: results.length, results });
});
