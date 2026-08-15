// Supabase Edge Function: gemini-proxy
// ─────────────────────────────────────────────────────────────────────
// Proxy Google Gemini untuk modul "Wiki OneLab" (perbaikan SOP, content
// studio, generate gambar). API key disimpan SERVER-SIDE via Edge Function
// Secrets — TIDAK PERNAH terekspos ke browser.
//
// Deploy: Supabase Dashboard → Edge Functions → Deploy new function →
//         "Via Editor", beri nama: gemini-proxy
//
// SECRETS (Settings → Edge Functions → Secrets):
//   GEMINI_API_KEY = key1,key2,key3      ← BOLEH BANYAK, pisahkan koma
//   (alternatif) GEMINI_API_KEY_1 / _2 / _3 ... (masing-masing 1 key)
//   (opsional)   GEMINI_MODEL       = gemini-2.5-flash
//                GEMINI_IMAGE_MODEL = gemini-2.5-flash-image
//
// MULTI-KEY: key dipakai bergiliran (round-robin) dan otomatis FAILOVER ke
// key berikutnya bila kena rate-limit/kuota/key bermasalah (429/403/5xx).
// Error permintaan (400) TIDAK di-retry — itu masalah prompt, bukan key.
// CATATAN KUOTA: beberapa key dalam SATU project Google berbagi kuota yang
// sama. Agar kuota benar-benar bertambah, pakai key dari PROJECT BERBEDA.
//
// Dipanggil dari app:
//   POST ${SUPABASE_URL}/functions/v1/gemini-proxy
//   body: { mode:'text'|'image', prompt, system?, files?:[{mime_type,data}],
//           model?, temperature? }
//   resp: { text, model, keyIndex, keyCount }                (mode text)
//         { images:[dataUri...], model, keyIndex, keyCount } (mode image)
// ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Kumpulkan semua key: GEMINI_API_KEY (boleh "k1,k2,k3") + GEMINI_API_KEY_1..8
function collectKeys(): string[] {
  const keys: string[] = [];
  const push = (raw?: string | null) => {
    (raw || '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).forEach((k) => keys.push(k));
  };
  push(Deno.env.get('GEMINI_API_KEY'));
  for (let i = 1; i <= 8; i++) push(Deno.env.get(`GEMINI_API_KEY_${i}`));
  return [...new Set(keys)]; // buang duplikat
}

// Status yang layak dicoba ulang dengan KEY LAIN (masalah key/kuota/server).
// 400 = permintaan salah → jangan buang-buang key lain.
const RETRYABLE = new Set([401, 403, 429, 500, 502, 503, 504]);

let rrCounter = 0; // round-robin (per instance)

async function callGemini(model: string, payload: unknown, keys: string[]) {
  const n = keys.length;
  const start = rrCounter++ % n;
  let last: { status: number; msg: string } = { status: 500, msg: 'Tidak ada percobaan' };

  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n;
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${model}:generateContent?key=${keys[idx]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      last = { status: 503, msg: e instanceof Error ? e.message : 'network error' };
      continue; // jaringan gagal → coba key berikutnya
    }

    const data = await res.json().catch(() => null);
    if (res.ok) return { data, keyIndex: idx + 1, keyCount: n };

    last = { status: res.status, msg: data?.error?.message || `HTTP ${res.status}` };
    if (!RETRYABLE.has(res.status)) break; // mis. 400 → hentikan
  }
  const err = new Error(
    n > 1 && RETRYABLE.has(last.status)
      ? `Semua ${n} API key gagal/kena limit. Terakhir: ${last.msg}`
      : last.msg,
  ) as Error & { status?: number };
  err.status = last.status;
  throw err;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Gunakan POST' }, 405);

  const keys = collectKeys();
  if (!keys.length) {
    return json({ error: 'GEMINI_API_KEY belum diset. Tambahkan di Settings → Edge Functions → Secrets (boleh beberapa key dipisah koma).' }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode || 'text';
    const prompt: string = (body.prompt || '').toString();
    if (!prompt.trim()) return json({ error: 'prompt wajib diisi' }, 400);

    const textModel = body.model || Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const imageModel = body.model || Deno.env.get('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image';
    const model = mode === 'image' ? imageModel : textModel;

    // Susun parts: teks + lampiran (PDF/gambar) sebagai inline_data
    const parts: Record<string, unknown>[] = [{ text: prompt }];
    const files = Array.isArray(body.files) ? body.files : [];
    for (const f of files.slice(0, 8)) {
      if (!f?.data) continue;
      parts.push({ inline_data: { mime_type: f.mime_type || 'application/pdf', data: f.data } });
    }

    const payload: Record<string, unknown> = { contents: [{ role: 'user', parts }] };
    if (body.system) payload.systemInstruction = { parts: [{ text: String(body.system) }] };
    if (mode === 'text') {
      payload.generationConfig = {
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
        maxOutputTokens: body.maxOutputTokens || 8192,
      };
    }

    // Panggil Gemini dengan rotasi key + failover otomatis
    const { data, keyIndex, keyCount } = await callGemini(model, payload, keys);

    const cand = data?.candidates?.[0];
    if (!cand) return json({ error: 'Tidak ada hasil dari Gemini (kemungkinan diblokir filter).' }, 502);

    if (mode === 'image') {
      const images: string[] = [];
      for (const p of cand.content?.parts || []) {
        const inline = p.inlineData || p.inline_data;
        if (inline?.data) images.push(`data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`);
      }
      if (!images.length) return json({ error: 'Model tidak mengembalikan gambar. Coba ubah prompt.' }, 502);
      return json({ images, model, keyIndex, keyCount });
    }

    const text = (cand.content?.parts || []).map((p: Record<string, string>) => p.text || '').join('').trim();
    if (!text) return json({ error: 'Respons kosong dari model.' }, 502);
    return json({ text, model, keyIndex, keyCount, finishReason: cand.finishReason || null });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, status && status >= 400 && status < 600 ? status : 500);
  }
});
