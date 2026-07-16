// Supabase Edge Function: llm-gateway
// ─────────────────────────────────────────────────────────────────────
// SATU PINTU ke LLM untuk Agentic Module (§1.4 & §3.1 spec).
// Tidak ada worker yang boleh memanggil NVIDIA/Gemini langsung.
//
// Fitur (§3.1):
//  • Provider: NVIDIA NIM (primary, OpenAI-compatible) → Gemini (fallback)
//  • Multi-key + rotasi round-robin per provider
//  • Rate limiter per key (default 30 req/menit) — berbasis tabel llm_requests
//  • Retry exponential backoff (2s, 8s) untuk 429/5xx setelah semua key dicoba
//  • Cache hash(prompt+model) → agentic.llm_cache TTL 24 jam (khusus task idempotent)
//  • Log penuh ke agentic.llm_requests (prompt/response truncated 2000 char)
//
// SECRETS:
//   NVIDIA_API_KEYS = k1,k2,k3        NVIDIA_MODEL_MAIN  = meta/llama-3.1-70b-instruct
//   GEMINI_API_KEYS = k1,k2           NVIDIA_MODEL_LIGHT = meta/llama-3.1-8b-instruct
//   GEMINI_MODEL    = gemini-2.5-flash
//   LLM_RATE_LIMIT_PER_KEY_PER_MIN = 30
//   (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY disediakan otomatis)
//
// REQUEST:
//   { prompt, system?, model?, tier?:'main'|'light', temperature?, maxTokens?,
//     cacheable?:bool, taskId?:uuid, provider?:'auto'|'NVIDIA'|'GEMINI',
//     files?:[{mime_type,data}]  // hanya didukung Gemini }
// RESPONSE:
//   { text, provider, model, cached, keyAlias, latencyMs }
// ─────────────────────────────────────────────────────────────────────

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RATE_LIMIT = parseInt(Deno.env.get('LLM_RATE_LIMIT_PER_KEY_PER_MIN') || '30', 10);
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── DB helper — lewat wrapper RPC di schema public (tanpa perlu
//    mengubah "Exposed schemas"; tabel tetap di schema agentic) ───────
async function rpc(fn: string, args: Record<string, unknown>) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch { return null; }
}

function keysOf(env: string): string[] {
  return (Deno.env.get(env) || '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}
async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const trunc = (s: string, n = 2000) => (s || '').slice(0, n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Rate limit per key: hitung request 60 detik terakhir (pengganti limiter Redis)
async function isRateLimited(alias: string): Promise<boolean> {
  const n = await rpc('agentic_rate_count', { p_alias: alias });
  return typeof n === 'number' && n >= RATE_LIMIT;
}

async function logReq(row: Record<string, unknown>) {
  await rpc('agentic_log_llm', { p: row });
}

// ── Provider calls ───────────────────────────────────────────────────
async function callNvidia(key: string, model: string, body: Record<string, unknown>) {
  const res = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ model, ...body }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, msg: data?.detail || data?.error?.message || `HTTP ${res.status}` };
  return {
    ok: true,
    text: (data?.choices?.[0]?.message?.content || '').trim(),
    inTok: data?.usage?.prompt_tokens ?? null,
    outTok: data?.usage?.completion_tokens ?? null,
  };
}

async function callGemini(key: string, model: string, prompt: string, system: string | null,
                          temperature: number, maxTokens: number, files: Record<string, string>[]) {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  for (const f of files.slice(0, 8)) if (f?.data) parts.push({ inline_data: { mime_type: f.mime_type || 'application/pdf', data: f.data } });
  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (system) payload.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, msg: data?.error?.message || `HTTP ${res.status}` };
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p: Record<string, string>) => p.text || '').join('').trim();
  if (!text) return { ok: false, status: 502, msg: 'Respons kosong / diblokir filter' };
  return {
    ok: true, text,
    inTok: data?.usageMetadata?.promptTokenCount ?? null,
    outTok: data?.usageMetadata?.candidatesTokenCount ?? null,
  };
}

const RETRYABLE = new Set([401, 403, 408, 429, 500, 502, 503, 504]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Gunakan POST' }, 405);

  const body = await req.json().catch(() => ({}));
  const prompt: string = String(body.prompt || '').trim();
  if (!prompt) return json({ error: 'prompt wajib diisi' }, 400);

  const system: string | null = body.system ? String(body.system) : null;
  const temperature: number = typeof body.temperature === 'number' ? body.temperature : 0.4;
  const maxTokens: number = body.maxTokens || 4096;
  const files = Array.isArray(body.files) ? body.files : [];
  const taskId = body.taskId || null;
  const want = (body.provider || 'auto').toUpperCase();
  const tier = body.tier === 'light' ? 'light' : 'main';

  const nvModel = body.model || Deno.env.get(tier === 'light' ? 'NVIDIA_MODEL_LIGHT' : 'NVIDIA_MODEL_MAIN')
    || 'meta/llama-3.1-70b-instruct';
  const gmModel = body.model || Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

  // ── Cache (khusus task idempotent) ────────────────────────────────
  const hash = await sha256(`${system || ''}|${prompt}|${nvModel}|${gmModel}|${temperature}`);
  if (body.cacheable) {
    const hit = await rpc('agentic_cache_get', { p_hash: hash });
    if (typeof hit === 'string' && hit) {
      await logReq({ task_id: taskId, provider: 'CACHE', model: nvModel, prompt_hash: hash,
        prompt_preview: trunc(prompt), response_preview: trunc(hit), status: 'CACHED', latency_ms: 0 });
      return json({ text: hit, provider: 'CACHE', model: nvModel, cached: true });
    }
  }

  // ── Susun daftar percobaan: NVIDIA dulu, lalu Gemini (§3.1) ───────
  type Attempt = { provider: 'NVIDIA' | 'GEMINI'; key: string; alias: string; model: string };
  const plan: Attempt[] = [];
  if (want === 'AUTO' || want === 'NVIDIA')
    keysOf('NVIDIA_API_KEYS').forEach((k, i) => plan.push({ provider: 'NVIDIA', key: k, alias: `NVIDIA#${i + 1}`, model: nvModel }));
  if (want === 'AUTO' || want === 'GEMINI')
    keysOf('GEMINI_API_KEYS').forEach((k, i) => plan.push({ provider: 'GEMINI', key: k, alias: `GEMINI#${i + 1}`, model: gmModel }));

  if (!plan.length) return json({ error: 'Tidak ada API key. Set NVIDIA_API_KEYS dan/atau GEMINI_API_KEYS di Edge Function Secrets.' }, 500);
  // NVIDIA (text-only) tidak bisa memproses lampiran → paksa Gemini bila ada files
  const usable = files.length ? plan.filter((p) => p.provider === 'GEMINI') : plan;
  if (!usable.length) return json({ error: 'Lampiran file hanya didukung provider Gemini — set GEMINI_API_KEYS.' }, 400);

  const BACKOFF = [0, 2000, 8000]; // §3.1: 3 putaran
  let last = 'Belum ada percobaan';

  for (let round = 0; round < BACKOFF.length; round++) {
    if (BACKOFF[round]) await sleep(BACKOFF[round]);

    for (const a of usable) {
      if (await isRateLimited(a.alias)) {
        await logReq({ task_id: taskId, provider: a.provider, model: a.model, key_alias: a.alias,
          prompt_hash: hash, prompt_preview: trunc(prompt), status: 'RATE_LIMITED' });
        continue; // key ini penuh → coba key lain
      }

      const t0 = Date.now();
      let r: Record<string, unknown>;
      try {
        r = a.provider === 'NVIDIA'
          ? await callNvidia(a.key, a.model, {
              messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
              temperature, max_tokens: maxTokens,
            })
          : await callGemini(a.key, a.model, prompt, system, temperature, maxTokens, files);
      } catch (e) {
        r = { ok: false, status: 503, msg: e instanceof Error ? e.message : 'network error' };
      }
      const latency = Date.now() - t0;

      if (r.ok) {
        const isFallback = a.provider === 'GEMINI' && want === 'AUTO' && keysOf('NVIDIA_API_KEYS').length > 0;
        await logReq({ task_id: taskId, provider: a.provider, model: a.model, key_alias: a.alias,
          prompt_hash: hash, prompt_preview: trunc(prompt), response_preview: trunc(String(r.text)),
          input_tokens: r.inTok, output_tokens: r.outTok, latency_ms: latency,
          status: isFallback ? 'FALLBACK' : 'OK' });
        if (body.cacheable) {
          await rpc('agentic_cache_put', { p_hash: hash, p_model: a.model, p_response: r.text });
        }
        return json({ text: r.text, provider: a.provider, model: a.model, cached: false,
          keyAlias: a.alias, latencyMs: latency });
      }

      last = `${a.alias}: ${r.msg}`;
      await logReq({ task_id: taskId, provider: a.provider, model: a.model, key_alias: a.alias,
        prompt_hash: hash, prompt_preview: trunc(prompt), response_preview: trunc(String(r.msg)),
        latency_ms: latency, status: 'ERROR' });

      // 400 = permintaan salah → percuma ganti key/provider
      if (!RETRYABLE.has(Number(r.status))) {
        return json({ error: `Permintaan ditolak provider: ${r.msg}` }, 400);
      }
    }
  }

  return json({ error: `Semua key & provider gagal setelah retry. Terakhir → ${last}` }, 503);
});
