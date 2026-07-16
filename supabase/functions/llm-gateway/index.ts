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
// Anggaran waktu: Edge Function dibunuh gateway ±150 dtk. Tanpa timeout,
// provider yang menggantung membuat task macet PROCESSING (tanpa log).
const ATTEMPT_TIMEOUT_MS = 75_000;   // maksimal per percobaan provider
const TOTAL_BUDGET_MS    = 115_000;  // maksimal total sebelum menyerah rapi

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
// Gemini: terima GEMINI_API_KEYS (jamak) ATAU GEMINI_API_KEY (tunggal, sudah
// dipakai gemini-proxy Wiki) — supaya fallback jalan tanpa setting ganda.
function geminiKeys(): string[] {
  const k = keysOf('GEMINI_API_KEYS');
  return k.length ? k : keysOf('GEMINI_API_KEY');
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
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
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

// ── MODE DIAGNOSTIK ──────────────────────────────────────────────────
// POST {diag:true} → uji SETIAP provider × key × model dengan prompt mini
// (timeout 15 dtk), balikan tabel status + verdict. Tidak dicatat ke log.
async function runDiag() {
  const nvMain  = Deno.env.get('NVIDIA_MODEL_MAIN')  || 'meta/llama-3.3-70b-instruct';
  const nvLight = Deno.env.get('NVIDIA_MODEL_LIGHT') || 'meta/llama-3.1-8b-instruct';
  const gmModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  // 60 dtk: model reasoning raksasa (mis. Nemotron Ultra) bisa >30 dtk utk
  // merespons — 15 dtk menghasilkan false alarm "model mati"
  const DIAG_TIMEOUT = 60_000;

  type Check = { provider: string; key_alias: string; model: string };
  const checks: Check[] = [];
  keysOf('NVIDIA_API_KEYS').forEach((_, i) => {
    checks.push({ provider: 'NVIDIA', key_alias: `NVIDIA#${i + 1}`, model: nvLight });
    checks.push({ provider: 'NVIDIA', key_alias: `NVIDIA#${i + 1}`, model: nvMain });
  });
  geminiKeys().forEach((_, i) =>
    checks.push({ provider: 'GEMINI', key_alias: `GEMINI#${i + 1}`, model: gmModel }));
  if (!checks.length) {
    return json({ error: 'Tidak ada API key terpasang (NVIDIA_API_KEYS / GEMINI_API_KEYS kosong).' }, 500);
  }

  const nvKeys = keysOf('NVIDIA_API_KEYS'), gmKeys = geminiKeys();
  const results = await Promise.all(checks.map(async (c) => {
    const key = c.provider === 'NVIDIA' ? nvKeys[parseInt(c.key_alias.split('#')[1]) - 1]
                                        : gmKeys[parseInt(c.key_alias.split('#')[1]) - 1];
    const t0 = Date.now();
    try {
      const res = c.provider === 'NVIDIA'
        ? await fetch(NVIDIA_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: c.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4 }),
            signal: AbortSignal.timeout(DIAG_TIMEOUT),
          })
        : await fetch(`${GEMINI_BASE}/${c.model}:generateContent?key=${key}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
              generationConfig: { maxOutputTokens: 4 } }),
            signal: AbortSignal.timeout(DIAG_TIMEOUT),
          });
      const data = await res.json().catch(() => null);
      const msg = res.ok ? 'OK' : (data?.detail || data?.error?.message || `HTTP ${res.status}`);
      return { ...c, ok: res.ok, http: res.status, latency_ms: Date.now() - t0, msg: String(msg).slice(0, 220) };
    } catch (e) {
      const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
      return { ...c, ok: false, http: 0, latency_ms: Date.now() - t0,
        msg: timedOut ? `TIMEOUT ${DIAG_TIMEOUT / 1000}s — endpoint/model tidak merespons` :
          (e instanceof Error ? e.message : 'network error') };
    }
  }));

  // Verdict cerdas: kesimpulan yang bisa langsung ditindaklanjuti
  const verdicts: string[] = [];
  const nvLightOk = results.some((r) => r.provider === 'NVIDIA' && r.model === nvLight && r.ok);
  const nvMainOk  = results.some((r) => r.provider === 'NVIDIA' && r.model === nvMain && r.ok);
  const gmOk      = results.some((r) => r.provider === 'GEMINI' && r.ok);
  if (nvLightOk && !nvMainOk) {
    const mainFails = results.filter((r) => r.provider === 'NVIDIA' && r.model === nvMain && !r.ok);
    const allTimeout = mainFails.length > 0 && mainFails.every((r) => String(r.msg).startsWith('TIMEOUT'));
    verdicts.push(allTimeout
      ? `⚠ Model MAIN NVIDIA (${nvMain}) LAMBAT (>60 dtk belum merespons) — key valid. Model reasoning besar memang lambat; produksi masih bisa jalan (timeout produksi 75 dtk), tapi bila sering gagal, ganti NVIDIA_MODEL_MAIN ke model lebih cepat (mis. meta/llama-3.3-70b-instruct).`
      : `⚠ Model MAIN NVIDIA (${nvMain}) bermasalah padahal key valid (model light OK) — ganti Secret NVIDIA_MODEL_MAIN ke model yang tersedia di build.nvidia.com.`);
  }
  if (!nvLightOk && !nvMainOk && nvKeys.length)
    verdicts.push('❌ Semua percobaan NVIDIA gagal — cek key (nvapi-…), kuota, atau jaringan.');
  if (!gmOk && gmKeys.length) verdicts.push('❌ Semua percobaan Gemini gagal — cek GEMINI_API_KEYS / kuota.');
  if (gmOk && !nvMainOk) verdicts.push('ℹ Fallback Gemini sehat — task tetap bisa jalan walau NVIDIA main bermasalah.');
  if (nvMainOk && gmOk) verdicts.push('✅ Semua jalur sehat.');
  else if (nvMainOk) verdicts.push('✅ NVIDIA main sehat.');

  return json({ diag: true, checked: results.length, results, verdicts,
    models: { nvidia_main: nvMain, nvidia_light: nvLight, gemini: gmModel } });
}

// ── MODE GAMBAR (Fase 5) ─────────────────────────────────────────────
// POST {mode:'image', prompt, model?, width?, height?}
// Urutan: NVIDIA FLUX (ai.api.nvidia.com/v1/genai/<model>, respons
// artifacts[0].base64) per key → endpoint gaya OpenAI images bila 404
// (model tertentu spt flux.2-klein) → fallback Gemini image.
// RESPONSE: { images:[dataUri], provider, model, latencyMs }
function b64Mime(b64: string): string {
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}
async function runImage(body: Record<string, unknown>) {
  const prompt = String(body.prompt || '').trim().slice(0, 9500);
  if (!prompt) return json({ error: 'prompt wajib diisi' }, 400);
  // NVIDIA_IMAGE_MODEL boleh BERISI BANYAK model dipisah koma → dicoba
  // berurutan (failover antar model). Isi NAMA MODEL persis dari
  // build.nvidia.com (mis. black-forest-labs/flux.1-schnell,
  // black-forest-labs/flux.2-klein-4b, qwen/qwen-image) — BUKAN API key.
  const models = String(body.model || Deno.env.get('NVIDIA_IMAGE_MODEL') || 'black-forest-labs/flux.1-schnell')
    .split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    .filter((m) => !/^nvapi-/i.test(m)); // jaga-jaga: key nyasar ke secret model
  if (!models.length) models.push('black-forest-labs/flux.1-schnell');
  // FLUX hanya menerima kelipatan 64 (768–1344); 896×1152 ≈ rasio IG 4:5
  const width = Number(body.width) || 896;
  const height = Number(body.height) || 1152;
  const taskId = body.taskId || null;
  const hash = await sha256(`img|${models.join('+')}|${prompt}|${width}x${height}`);
  let last = 'Belum ada percobaan';
  const nvKeys = keysOf('NVIDIA_API_KEYS');

  // 1) NVIDIA: model demi model × key demi key
  modelLoop:
  for (const model of models) {
    const isFlux = /flux/i.test(model);
    const isSchnell = /schnell|klein/i.test(model); // distilled → langkah sedikit
    // FLUX endpoint /genai menerima parameter penuh; model lain (qwen dsb)
    // dikirim minimal agar tidak ditolak validator (422)
    const genaiBody = isFlux
      ? { prompt, mode: 'base', width, height, seed: Math.floor(Math.random() * 1e9),
          steps: isSchnell ? 4 : 30, ...(isSchnell ? {} : { cfg_scale: 3.5 }) }
      : { prompt, seed: Math.floor(Math.random() * 1e9) };

    for (const [i, key] of nvKeys.entries()) {
      const alias = `NVIDIA#${i + 1}`;
      const t0 = Date.now();
      try {
        let res = await fetch(`https://ai.api.nvidia.com/v1/genai/${model}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(genaiBody),
          signal: AbortSignal.timeout(60_000),
        });
        let data = await res.json().catch(() => null);

        // Pola antrian NVCF: server balas 202 + header NVCF-REQID → poll status
        // sampai selesai (maks ~100 dtk) alih-alih menunggu buta.
        if (res.status === 202) {
          const reqId = res.headers.get('NVCF-REQID') || res.headers.get('nvcf-reqid');
          const pollDeadline = Date.now() + 100_000;
          while (reqId && Date.now() < pollDeadline) {
            await sleep(3_000);
            res = await fetch(`https://ai.api.nvidia.com/v1/status/${reqId}`, {
              headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
              signal: AbortSignal.timeout(20_000),
            });
            if (res.status === 202) continue;
            data = await res.json().catch(() => null);
            break;
          }
          if (res.status === 202) { last = `${alias}/${model}: antrian NVCF belum selesai >100s`; continue; }
        }

        let b64 = data?.artifacts?.[0]?.base64 || null;

        // beberapa model image NIM memakai endpoint gaya OpenAI —
        // coba juga saat 404 (path tak dikenal) atau 400/422 (skema beda)
        if (res.status === 404 || res.status === 400 || res.status === 422) {
          res = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, n: 1, response_format: 'b64_json', size: `${width}x${height}` }),
            signal: AbortSignal.timeout(90_000),
          });
          data = await res.json().catch(() => null);
          b64 = data?.data?.[0]?.b64_json || null;
        }

        const latency = Date.now() - t0;
        if (res.ok && b64) {
          await logReq({ task_id: taskId, provider: 'NVIDIA', model, key_alias: alias, prompt_hash: hash,
            prompt_preview: trunc(prompt), response_preview: `[image ${width}x${height}]`,
            latency_ms: latency, status: 'OK' });
          return json({ images: [`data:${b64Mime(b64)};base64,${b64}`], provider: 'NVIDIA', model, latencyMs: latency });
        }
        last = `${alias}/${model}: ${data?.detail || data?.error?.message || data?.title || `HTTP ${res.status}`}`;
        await logReq({ task_id: taskId, provider: 'NVIDIA', model, key_alias: alias, prompt_hash: hash,
          prompt_preview: trunc(prompt), response_preview: trunc(String(last)), latency_ms: latency, status: 'ERROR' });
        // 400/422/404 di kedua endpoint = masalah model/parameter, bukan key
        // → percuma coba key lain, langsung ke MODEL berikutnya
        if (!RETRYABLE.has(res.status)) continue modelLoop;
      } catch (e) {
        const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
        last = `${alias}/${model}: ${timedOut ? 'timeout 60s (endpoint tidak merespons)' : (e instanceof Error ? e.message : 'network error')}`;
      }
    }
  }

  // 2) Fallback Gemini image
  const gmImgModel = String(Deno.env.get('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image');
  for (const [i, key] of geminiKeys().entries()) {
    const alias = `GEMINI#${i + 1}`;
    const t0 = Date.now();
    try {
      const res = await fetch(`${GEMINI_BASE}/${gmImgModel}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(90_000),
      });
      const data = await res.json().catch(() => null);
      const latency = Date.now() - t0;
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const inline = parts.map((p: Record<string, Record<string, string>>) => p.inlineData || p.inline_data).find(Boolean);
      if (res.ok && inline?.data) {
        await logReq({ task_id: taskId, provider: 'GEMINI', model: gmImgModel, key_alias: alias, prompt_hash: hash,
          prompt_preview: trunc(prompt), response_preview: '[image]', latency_ms: latency, status: 'FALLBACK' });
        return json({ images: [`data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`],
          provider: 'GEMINI', model: gmImgModel, latencyMs: latency });
      }
      last = `${alias}: ${data?.error?.message || `HTTP ${res.status} (tanpa gambar)`}`;
      await logReq({ task_id: taskId, provider: 'GEMINI', model: gmImgModel, key_alias: alias, prompt_hash: hash,
        prompt_preview: trunc(prompt), response_preview: trunc(String(last)), latency_ms: latency, status: 'ERROR' });
    } catch (e) {
      last = `${alias}: ${e instanceof Error ? e.message : 'network error'}`;
    }
  }

  return json({ error: `Semua provider gambar gagal. Terakhir → ${last}` }, 503);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Gunakan POST' }, 405);

  const body = await req.json().catch(() => ({}));
  if (body.diag === true) return await runDiag();
  if (body.mode === 'image') return await runImage(body);

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
    || (tier === 'light' ? 'meta/llama-3.1-8b-instruct' : 'meta/llama-3.3-70b-instruct');
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
  if (want === 'AUTO' || want === 'NVIDIA') {
    keysOf('NVIDIA_API_KEYS').forEach((k, i) => plan.push({ provider: 'NVIDIA', key: k, alias: `NVIDIA#${i + 1}`, model: nvModel }));
    // Jaring pengaman: bila model MAIN mati/hang, coba model LIGHT dulu
    // di key pertama sebelum lompat ke Gemini (§3.1 diperluas)
    const nvLight = Deno.env.get('NVIDIA_MODEL_LIGHT') || 'meta/llama-3.1-8b-instruct';
    const k0 = keysOf('NVIDIA_API_KEYS')[0];
    if (k0 && tier === 'main' && nvLight !== nvModel && !body.model) {
      plan.push({ provider: 'NVIDIA', key: k0, alias: 'NVIDIA#1-light', model: nvLight });
    }
  }
  if (want === 'AUTO' || want === 'GEMINI')
    geminiKeys().forEach((k, i) => plan.push({ provider: 'GEMINI', key: k, alias: `GEMINI#${i + 1}`, model: gmModel }));

  if (!plan.length) return json({ error: 'Tidak ada API key. Set NVIDIA_API_KEYS dan/atau GEMINI_API_KEYS di Edge Function Secrets.' }, 500);
  // NVIDIA (text-only) tidak bisa memproses lampiran → paksa Gemini bila ada files
  const usable = files.length ? plan.filter((p) => p.provider === 'GEMINI') : plan;
  if (!usable.length) return json({ error: 'Lampiran file hanya didukung provider Gemini — set GEMINI_API_KEYS.' }, 400);

  const BACKOFF = [0, 2000, 8000]; // §3.1: 3 putaran
  let last = 'Belum ada percobaan';
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (let round = 0; round < BACKOFF.length; round++) {
    if (BACKOFF[round]) await sleep(BACKOFF[round]);

    for (const a of usable) {
      if (Date.now() > deadline) {
        return json({ error: `Anggaran waktu gateway habis (${TOTAL_BUDGET_MS / 1000}s). Terakhir → ${last}` }, 503);
      }
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
        const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
        r = { ok: false, status: 503,
          msg: timedOut ? `timeout ${ATTEMPT_TIMEOUT_MS / 1000}s (provider tidak merespons)` :
            (e instanceof Error ? e.message : 'network error') };
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
