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

// ── Konfig AI dari DB (Fase 7B) — override Secret/env; kosong = fallback env ──
let CONFIG: Record<string, string> = {};
async function loadConfig() {
  const m = await rpc('agentic_config_map', {});
  CONFIG = (m && typeof m === 'object' && !Array.isArray(m)) ? m as Record<string, string> : {};
}
// Ambil setelan: DB dulu (bila terisi), lalu Secret/env.
function cfg(key: string): string | undefined {
  const v = CONFIG[key];
  if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  const e = Deno.env.get(key);
  return e && e.trim() !== '' ? e : undefined;
}
const rateLimit = () => parseInt(cfg('LLM_RATE_LIMIT_PER_KEY_PER_MIN') || '30', 10) || 30;

function keysOf(env: string): string[] {
  return String(cfg(env) || '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
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
// Error provider bisa berupa string/objek/array — jangan sampai "[object Object]"
const errStr = (v: unknown): string =>
  typeof v === 'string' ? v : (v == null ? '' : JSON.stringify(v).slice(0, 300));

// Rate limit per key: hitung request 60 detik terakhir (pengganti limiter Redis)
async function isRateLimited(alias: string): Promise<boolean> {
  const n = await rpc('agentic_rate_count', { p_alias: alias });
  return typeof n === 'number' && n >= rateLimit();
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
  const nvMain  = cfg('NVIDIA_MODEL_MAIN')  || 'meta/llama-3.3-70b-instruct';
  const nvLight = cfg('NVIDIA_MODEL_LIGHT') || 'meta/llama-3.1-8b-instruct';
  const gmModel = cfg('GEMINI_MODEL') || 'gemini-2.5-flash';
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

  // Tes JALUR GAMBAR (key #1, model gambar pertama) — berjalan paralel.
  // Mencoba genai dulu lalu endpoint gaya OpenAI, persis alur produksi.
  const imgModel = (cfg('NVIDIA_IMAGE_MODEL') || '')
    .split(/[,\s]+/).map((s) => s.trim()).filter((m) => m && !/^nvapi-/i.test(m))[0]
    || DEFAULT_IMAGE_MODELS[0];
  const imgPromise = (async () => {
    if (!nvKeys.length) return null;
    const key = nvKeys[0];
    const isSchnell = /schnell|klein/i.test(imgModel);
    const bodyA = /flux/i.test(imgModel)
      ? { prompt: 'simple teal circle on white background', mode: 'base', width: 1024, height: 1024,
          steps: isSchnell ? 1 : 5, seed: 1 }
      : { prompt: 'simple teal circle on white background', seed: 1 };
    const t0 = Date.now();
    let msgA = '';
    try {
      const res = await fetch(`https://ai.api.nvidia.com/v1/genai/${imgModel}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(bodyA), signal: AbortSignal.timeout(50_000),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.artifacts?.[0]?.base64) {
        return { provider: 'NVIDIA·GAMBAR', key_alias: 'NVIDIA#1', model: imgModel,
          ok: true, http: 200, latency_ms: Date.now() - t0, msg: 'OK (endpoint genai)' };
      }
      msgA = String(data?.detail || data?.error?.message || `HTTP ${res.status}`);
    } catch (e) {
      msgA = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
        ? 'TIMEOUT 50s' : (e instanceof Error ? e.message : 'network error');
    }
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: imgModel, prompt: 'simple teal circle', n: 1, response_format: 'b64_json' }),
        signal: AbortSignal.timeout(50_000),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.data?.[0]?.b64_json) {
        return { provider: 'NVIDIA·GAMBAR', key_alias: 'NVIDIA#1', model: imgModel,
          ok: true, http: 200, latency_ms: Date.now() - t0, msg: 'OK (endpoint openai-style)' };
      }
      return { provider: 'NVIDIA·GAMBAR', key_alias: 'NVIDIA#1', model: imgModel,
        ok: false, http: res.status, latency_ms: Date.now() - t0,
        msg: `genai=[${msgA}] openai=[${String(data?.detail || data?.error?.message || `HTTP ${res.status}`)}]`.slice(0, 220) };
    } catch (e) {
      const msgB = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
        ? 'TIMEOUT 50s' : (e instanceof Error ? e.message : 'network error');
      return { provider: 'NVIDIA·GAMBAR', key_alias: 'NVIDIA#1', model: imgModel,
        ok: false, http: 0, latency_ms: Date.now() - t0, msg: `genai=[${msgA}] openai=[${msgB}]`.slice(0, 220) };
    }
  })();

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

  // Hasil tes jalur gambar
  const imgRes = await imgPromise;
  if (imgRes) {
    results.push(imgRes);
    verdicts.push(imgRes.ok
      ? `🖼✅ Jalur GAMBAR sehat (${imgRes.model} · ${Math.round(imgRes.latency_ms / 1000)}s via ${imgRes.msg.replace('OK ', '')}).`
      : `🖼❌ Jalur GAMBAR gagal (${imgRes.model}): ${imgRes.msg} — produksi masih mencoba ${DEFAULT_IMAGE_MODELS.length} model lain berurutan; cek Monitor → Log LLM utk detail.`);
  }

  return json({ diag: true, checked: results.length, results, verdicts,
    models: { nvidia_main: nvMain, nvidia_light: nvLight, gemini: gmModel, image: imgModel } });
}

// Daftar LENGKAP model text-to-image NVIDIA hosted yang dikenal — dicoba
// berurutan sampai ada yang berhasil. Yang terbukti hidup di akun ini di
// depan; yang rawan menggantung (timeout 60 dtk) paling belakang.
// Prioritas bisa ditimpa lewat secret NVIDIA_IMAGE_MODEL (daftar koma) —
// isinya ditaruh di DEPAN rantai ini, bukan menggantikannya.
const DEFAULT_IMAGE_MODELS = [
  'black-forest-labs/flux.1-dev',            // ✅ terbukti hidup (uji 16 Jul 2026)
  'stabilityai/stable-diffusion-3.5-large',
  'stabilityai/stable-diffusion-3-medium',
  'stabilityai/stable-diffusion-xl',
  'stabilityai/sdxl-turbo',
  'briaai/bria-2.3',
  'black-forest-labs/flux.2-klein-4b',
  'qwen/qwen-image',
  'black-forest-labs/flux.1-kontext-dev',    // rawan lambat
  'black-forest-labs/flux.1-schnell',        // hosted NIM menggantung — cadangan terakhir
];

// ── MODE GAMBAR (Fase 5) ─────────────────────────────────────────────
// POST {mode:'image', prompt, model?, width?, height?}
// KEBIJAKAN: gambar = 100% NVIDIA (rantai semua model text-to-image);
// Gemini TIDAK dipakai utk gambar — khusus teks.
// Tiap model dicoba di endpoint genai (artifacts[0].base64) lalu endpoint
// gaya OpenAI (data[0].b64_json); anggaran waktu total 120 dtk.
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
  // body.model (dari probe/tes) = pakai model itu SAJA.
  // Selain itu: prioritas dari secret NVIDIA_IMAGE_MODEL (opsional, koma)
  // + SEMUA model default di belakangnya (dedupe). Gemini TIDAK dipakai
  // untuk gambar — kebijakan: Gemini khusus teks.
  const pref = String(cfg('NVIDIA_IMAGE_MODEL') || '')
    .split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    .filter((m) => !/^nvapi-/i.test(m)); // jaga-jaga: key nyasar ke secret model
  const models = body.model
    ? [String(body.model)]
    : [...new Set([...pref, ...DEFAULT_IMAGE_MODELS])];
  // FLUX hanya menerima kelipatan 64 (768–1344); 896×1152 ≈ rasio IG 4:5
  const width = Number(body.width) || 896;
  const height = Number(body.height) || 1152;
  const taskId = body.taskId || null;
  const hash = await sha256(`img|${models.join('+')}|${prompt}|${width}x${height}`);
  let last = 'Belum ada percobaan';
  const nvKeys = keysOf('NVIDIA_API_KEYS');
  if (!nvKeys.length) return json({ error: 'NVIDIA_API_KEYS belum diset (gambar hanya lewat NVIDIA).' }, 500);
  // Anggaran waktu total: rantai panjang + model yang menggantung tidak boleh
  // melebihi umur invocation Edge Function (~150 dtk)
  const imgDeadline = Date.now() + 120_000;

  // TERJEMAHKAN prompt ke Inggris via model teks light (±1-2 dtk).
  // TERBUKTI (uji 17 Jul 2026): safety filter NIM flux.1-dev mem-blacklist
  // prompt berbahasa Indonesia apa pun isinya (gambar hitam), sedangkan
  // terjemahan Inggris yang identik LOLOS. Gagal terjemah → pakai asli.
  // IMAGE_FILTER_STRICT=true → blokir keras (perilaku lama). Default OFF:
  // JANGAN blokir prompt apa pun — bila model menolak (gambar hitam),
  // tulis-ulang otomatis ke versi aman lalu retry (§permintaan user).
  const strictFilter = (cfg('IMAGE_FILTER_STRICT') || '').toLowerCase() === 'true';
  const trModel = cfg('NVIDIA_MODEL_LIGHT') || 'meta/llama-3.1-8b-instruct';
  let usedSafeRewrite = false;

  let genPrompt = prompt;
  try {
    const tr = await callNvidia(nvKeys[0], trModel, {
      messages: [
        { role: 'system', content: 'Rewrite the user text as one concise English image-generation prompt. Keep every visual detail, style, ratio, and constraint. Output ONLY the prompt text, no quotes, no explanation.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, max_tokens: 350,
    });
    if (tr.ok && typeof tr.text === 'string' && tr.text.trim().length > 10) {
      genPrompt = tr.text.trim().slice(0, 2500);
    }
  } catch { /* pakai prompt asli */ }

  // Tulis-ulang prompt yang ditolak filter → versi aman yang setara makna
  async function safeRewrite(src: string): Promise<string | null> {
    try {
      const r = await callNvidia(nvKeys[0], trModel, {
        messages: [
          { role: 'system', content: 'The following image prompt was rejected by a safety filter. Rewrite it into a SAFE English prompt that keeps the same topic, mood, style, colors and composition, but REMOVES anything a medical-imagery filter blocks: no patients, no needles, no blood, no injections, no invasive medical procedures on people. Prefer clinic/lab interiors, equipment, abstract health motifs, or a smiling healthcare worker without a patient. Output ONLY the rewritten prompt.' },
          { role: 'user', content: src },
        ],
        temperature: 0.3, max_tokens: 350,
      });
      const t = (r.ok && typeof r.text === 'string') ? r.text.trim() : '';
      return t.length > 10 ? t.slice(0, 2500) : null;
    } catch { return null; }
  }

  // 1) NVIDIA: model demi model × key demi key
  modelLoop:
  for (const model of models) {
    if (Date.now() > imgDeadline) {
      return json({ error: `Anggaran waktu gambar habis (120 dtk). Terakhir → ${last}` }, 503);
    }
    const isFlux = /flux/i.test(model);
    const isSchnell = /schnell|klein/i.test(model); // distilled → langkah sedikit
    // Batasan per model (dok resmi): flux.1-schnell HANYA 1024×1024, steps 1-4,
    // TANPA cfg_scale. flux.1-dev: 768–1344 kelipatan 64. Lainnya: body minimal.
    const dim64 = (v: number) => Math.min(1344, Math.max(768, Math.round(v / 64) * 64));
    const buildBody = (pr: string) => isSchnell
      ? { prompt: pr, mode: 'base', width: 1024, height: 1024, steps: 4, seed: Math.floor(Math.random() * 1e9) }
      : isFlux
      ? { prompt: pr, mode: 'base', width: dim64(width), height: dim64(height),
          seed: Math.floor(Math.random() * 1e9), steps: 30, cfg_scale: 3.5 }
      : { prompt: pr, seed: Math.floor(Math.random() * 1e9) };

    for (const [i, key] of nvKeys.entries()) {
      const alias = `NVIDIA#${i + 1}`;
      const t0 = Date.now();
      let errA = ''; // kegagalan endpoint genai (utk pesan gabungan)

      // ── Percobaan A: endpoint genai — hingga 2x (retry safe-rewrite bila
      //    kena filter konten & IMAGE_FILTER_STRICT tidak aktif) ──
      for (let att = 0; att < 2; att++) {
        try {
          let res = await fetch(`https://ai.api.nvidia.com/v1/genai/${model}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(buildBody(genPrompt)),
            signal: AbortSignal.timeout(60_000),
          });
          let data = await res.json().catch(() => null);

          // Pola antrian NVCF: 202 + header NVCF-REQID → poll status resmi
          if (res.status === 202) {
            const reqId = res.headers.get('NVCF-REQID') || res.headers.get('nvcf-reqid');
            const pollDeadline = Date.now() + 90_000;
            while (reqId && Date.now() < pollDeadline) {
              await sleep(3_000);
              res = await fetch(`https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/${reqId}`, {
                headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
                signal: AbortSignal.timeout(20_000),
              });
              if (res.status === 202) continue;
              data = await res.json().catch(() => null);
              break;
            }
          }

          const b64 = data?.artifacts?.[0]?.base64 || null;
          const black = res.ok && b64 && b64.length * 0.75 < 12_000; // <12 KB = filter (gambar hitam)
          if (res.ok && b64 && !black) {
            const latency = Date.now() - t0;
            await logReq({ task_id: taskId, provider: 'NVIDIA', model, key_alias: alias, prompt_hash: hash,
              prompt_preview: trunc(prompt), response_preview: `[image genai]`, latency_ms: latency, status: 'OK' });
            return json({ images: [`data:${b64Mime(b64)};base64,${b64}`], provider: 'NVIDIA', model, latencyMs: latency });
          }
          if (black) {
            errA = 'filter konten model (gambar hitam)';
            // Auto safe-rewrite SEKALI, lalu ulangi model ini (att=1)
            if (!strictFilter && att === 0 && !usedSafeRewrite) {
              const safe = await safeRewrite(genPrompt);
              if (safe) { genPrompt = safe; usedSafeRewrite = true; continue; }
            }
          } else {
            errA = res.status === 202 ? 'antrian belum selesai >90s'
              : errStr(data?.detail || data?.error?.message || data?.title || `HTTP ${res.status}`);
          }
        } catch (e) {
          const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
          errA = timedOut ? 'timeout 60s' : (e instanceof Error ? e.message : 'network error');
        }
        break; // tidak ada percobaan genai lain → lanjut endpoint B
      }

      // ── Percobaan B: endpoint gaya OpenAI (integrate.api.nvidia.com) ──
      // SELALU dicoba bila A gagal — apa pun jenis kegagalannya (termasuk
      // timeout; sebelumnya hanya 404/422 sehingga model yang menggantung
      // tidak pernah dapat kesempatan di endpoint alternatif).
      try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: genPrompt, n: 1, response_format: 'b64_json' }),
          signal: AbortSignal.timeout(60_000),
        });
        const data = await res.json().catch(() => null);
        const b64 = data?.data?.[0]?.b64_json || null;
        const latency = Date.now() - t0;
        if (res.ok && b64) {
          await logReq({ task_id: taskId, provider: 'NVIDIA', model, key_alias: alias, prompt_hash: hash,
            prompt_preview: trunc(prompt), response_preview: `[image openai-style]`, latency_ms: latency, status: 'OK' });
          return json({ images: [`data:${b64Mime(b64)};base64,${b64}`], provider: 'NVIDIA', model, latencyMs: latency });
        }
        const errB = errStr(data?.detail || data?.error?.message || data?.title || `HTTP ${res.status}`);
        last = `${alias}/${model}: genai=[${errA}] openai=[${errB}]`;
        await logReq({ task_id: taskId, provider: 'NVIDIA', model, key_alias: alias, prompt_hash: hash,
          prompt_preview: trunc(prompt), response_preview: trunc(last), latency_ms: latency, status: 'ERROR' });
        // 4xx non-retryable di KEDUA endpoint = masalah model → model berikutnya
        if (!RETRYABLE.has(res.status) && res.status !== 404) continue modelLoop;
      } catch (e) {
        const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
        last = `${alias}/${model}: genai=[${errA}] openai=[${timedOut ? 'timeout 60s' : (e instanceof Error ? e.message : 'network error')}]`;
        await logReq({ task_id: taskId, provider: 'NVIDIA', model, key_alias: alias, prompt_hash: hash,
          prompt_preview: trunc(prompt), response_preview: trunc(last), latency_ms: Date.now() - t0, status: 'ERROR' });
      }
    }
  }

  // Tidak ada fallback Gemini utk gambar (kebijakan: Gemini khusus teks).
  const filterHit = /gambar hitam/.test(last);
  return json({ error:
    `Semua model gambar NVIDIA gagal (${models.length} model dicoba). Terakhir → ${last}. ` +
    (filterHit
      ? `Filter keamanan NVIDIA menolak tema ini bahkan setelah ditulis-ulang otomatis — ini batasan di server NVIDIA, bukan sistem kita. Coba deskripsi tanpa unsur medis pada orang (interior lab, alat, ilustrasi abstrak).`
      : `Detail tiap percobaan: Agentic AI → Monitor → Log LLM.`) }, 503);
}

// ── MODE VIDEO (Fase 7B) ─────────────────────────────────────────────
// POST {mode:'video', prompt, model?, seed?, duration?}
// Memakai API NVIDIA yang SAMA dengan gambar (endpoint genai + antrian NVCF).
// Aktif hanya bila VIDEO_ENABLED=true DAN NVIDIA_VIDEO_MODEL terisi (config web).
// Video bersifat long-running; kita poll dalam anggaran waktu invocation, dan
// bila belum selesai dikembalikan rapi (bukan menggantung).
// RESPONSE sukses: { videos:[dataUriMp4 | url], provider, model, latencyMs }
async function runVideo(body: Record<string, unknown>) {
  const enabled = (cfg('VIDEO_ENABLED') || '').toLowerCase() === 'true';
  const model = String(cfg('NVIDIA_VIDEO_MODEL') || '').split(/[,\s]+/).map((s) => s.trim())
    .filter((m) => m && !/^nvapi-/i.test(m))[0] || '';
  if (!enabled || !model) {
    return json({ error: 'Video nonaktif. Aktifkan di Konfig AI (VIDEO_ENABLED=true) dan isi NVIDIA_VIDEO_MODEL dengan model text-to-video dari build.nvidia.com.' }, 400);
  }
  const prompt = String(body.prompt || '').trim().slice(0, 4000);
  if (!prompt) return json({ error: 'prompt wajib diisi' }, 400);
  const nvKeys = keysOf('NVIDIA_API_KEYS');
  if (!nvKeys.length) return json({ error: 'NVIDIA_API_KEYS belum diset (video hanya lewat NVIDIA).' }, 500);

  const key = nvKeys[0];
  const t0 = Date.now();
  const reqBody: Record<string, unknown> = { prompt, seed: Number(body.seed) || Math.floor(Math.random() * 1e9) };
  if (body.duration) reqBody.duration = Number(body.duration);
  if (body.width) reqBody.width = Number(body.width);
  if (body.height) reqBody.height = Number(body.height);

  try {
    let res = await fetch(`https://ai.api.nvidia.com/v1/genai/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(reqBody), signal: AbortSignal.timeout(60_000),
    });
    let data = await res.json().catch(() => null);

    // Antrian NVCF: 202 + NVCF-REQID → poll status (video butuh menit; poll s/d anggaran)
    if (res.status === 202) {
      const reqId = res.headers.get('NVCF-REQID') || res.headers.get('nvcf-reqid');
      const pollDeadline = Date.now() + 110_000;
      while (reqId && Date.now() < pollDeadline) {
        await sleep(5_000);
        res = await fetch(`https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/${reqId}`, {
          headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(30_000),
        });
        if (res.status === 202) continue;
        data = await res.json().catch(() => null);
        break;
      }
      if (res.status === 202) {
        return json({ error: `Video masih diproses NVIDIA (>110 dtk) — model "${model}" perlu pemrosesan latar belakang. reqId=${reqId}`, pending: true, reqId, model }, 504);
      }
    }

    // Ekstraksi output: base64 (artifacts/video) atau URL (assets)
    const b64 = data?.artifacts?.[0]?.base64 || data?.video?.[0]?.base64 || data?.data?.[0]?.b64_json || null;
    const url = data?.artifacts?.[0]?.url || data?.assets?.[0]?.url || data?.video?.url || null;
    const latency = Date.now() - t0;
    if (res.ok && b64) {
      await logReq({ task_id: body.taskId || null, provider: 'NVIDIA', model, key_alias: 'NVIDIA#1',
        prompt_preview: trunc(prompt), response_preview: '[video base64]', latency_ms: latency, status: 'OK' });
      return json({ videos: [`data:video/mp4;base64,${b64}`], provider: 'NVIDIA', model, latencyMs: latency });
    }
    if (res.ok && url) {
      await logReq({ task_id: body.taskId || null, provider: 'NVIDIA', model, key_alias: 'NVIDIA#1',
        prompt_preview: trunc(prompt), response_preview: '[video url]', latency_ms: latency, status: 'OK' });
      return json({ videos: [url], provider: 'NVIDIA', model, latencyMs: latency });
    }
    const msg = errStr(data?.detail || data?.error?.message || data?.title || `HTTP ${res.status}`);
    await logReq({ task_id: body.taskId || null, provider: 'NVIDIA', model, key_alias: 'NVIDIA#1',
      prompt_preview: trunc(prompt), response_preview: trunc(msg), latency_ms: latency, status: 'ERROR' });
    return json({ error: `Model video "${model}" gagal: ${msg}. Bila skema body berbeda, sesuaikan model di Konfig AI atau beri tahu jenis API video yang Anda buat.` }, 503);
  } catch (e) {
    const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return json({ error: timedOut ? `Timeout memanggil model video "${model}".` : (e instanceof Error ? e.message : 'network error') }, 503);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Gunakan POST' }, 405);

  const body = await req.json().catch(() => ({}));
  await loadConfig(); // Fase 7B: setelan model/API dari web (fallback ke Secret)
  if (body.diag === true) return await runDiag();
  if (body.mode === 'image') return await runImage(body);
  if (body.mode === 'video') return await runVideo(body);

  const prompt: string = String(body.prompt || '').trim();
  if (!prompt) return json({ error: 'prompt wajib diisi' }, 400);

  const system: string | null = body.system ? String(body.system) : null;
  const temperature: number = typeof body.temperature === 'number' ? body.temperature : 0.4;
  const maxTokens: number = body.maxTokens || 4096;
  const files = Array.isArray(body.files) ? body.files : [];
  const taskId = body.taskId || null;
  const want = (body.provider || 'auto').toUpperCase();
  const tier = body.tier === 'light' ? 'light' : 'main';

  const nvModel = body.model || cfg(tier === 'light' ? 'NVIDIA_MODEL_LIGHT' : 'NVIDIA_MODEL_MAIN')
    || (tier === 'light' ? 'meta/llama-3.1-8b-instruct' : 'meta/llama-3.3-70b-instruct');
  const gmModel = body.model || cfg('GEMINI_MODEL') || 'gemini-2.5-flash';

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
    const nvLight = cfg('NVIDIA_MODEL_LIGHT') || 'meta/llama-3.1-8b-instruct';
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
