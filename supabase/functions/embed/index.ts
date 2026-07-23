// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: embed — embedding teks via Gemini text-embedding-004 (768d)
//
// Menjaga kunci Gemini tetap di server. Klien (RAG) mengirim beberapa teks,
// fungsi ini mengembalikan vektor per teks. Meniru pola gemini-proxy:
//   · GEMINI_API_KEY = "k1,k2,k3"  ATAU  GEMINI_API_KEY_1.._8  (multi-key)
//   · round-robin + coba key lain saat kuota/erornya layak diulang.
//
// req : { texts: string[] }                (maks 96 per panggilan)
// resp: { embeddings: number[][], model, dim }
// ═══════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = Deno.env.get('GEMINI_EMBED_MODEL') || 'text-embedding-004';
const RETRYABLE = new Set([401, 403, 429, 500, 502, 503, 504]);
let rr = 0;

function collectKeys(): string[] {
  const keys: string[] = [];
  const push = (raw?: string | null) =>
    (raw || '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).forEach((k) => keys.push(k));
  push(Deno.env.get('GEMINI_API_KEY'));
  push(Deno.env.get('GEMINI_API_KEYS'));
  for (let i = 1; i <= 8; i++) push(Deno.env.get(`GEMINI_API_KEY_${i}`));
  return [...new Set(keys)];
}

// Satu panggilan batchEmbedContents untuk banyak teks, dengan rotasi key.
async function batchEmbed(texts: string[], keys: string[]): Promise<number[][]> {
  const body = {
    requests: texts.map((t) => ({
      model: `models/${MODEL}`,
      content: { parts: [{ text: (t || '').slice(0, 8000) }] },
    })),
  };
  const n = keys.length;
  let lastErr = 'tidak ada GEMINI_API_KEY';
  for (let attempt = 0; attempt < n; attempt++) {
    const key = keys[(rr++ % n + n) % n];
    try {
      const res = await fetch(`${API_BASE}/${MODEL}:batchEmbedContents?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
        if (RETRYABLE.has(res.status)) continue;
        throw new Error(lastErr);
      }
      const d = await res.json();
      const embs = (d.embeddings || []).map((e: { values: number[] }) => e.values || []);
      if (embs.length !== texts.length) throw new Error(`jumlah embedding (${embs.length}) != teks (${texts.length})`);
      return embs;
    } catch (e) {
      lastErr = String((e as Error).message || e);
    }
  }
  throw new Error(`Embedding gagal setelah mencoba ${n} key: ${lastErr}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const keys = collectKeys();
    if (!keys.length) return json({ error: 'GEMINI_API_KEY belum diset di secrets fungsi' }, 500);

    const { texts } = await req.json().catch(() => ({ texts: [] }));
    if (!Array.isArray(texts) || !texts.length) return json({ error: 'body harus { texts: string[] }' }, 400);
    if (texts.length > 96) return json({ error: 'maks 96 teks per panggilan' }, 400);

    const embeddings = await batchEmbed(texts.map(String), keys);
    return json({ embeddings, model: MODEL, dim: embeddings[0]?.length || 0 });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
