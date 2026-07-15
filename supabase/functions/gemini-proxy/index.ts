// Supabase Edge Function: gemini-proxy
// ─────────────────────────────────────────────────────────────────────
// Proxy Google Gemini untuk modul "Wiki OneLab" (perbaikan SOP, content
// studio, generate gambar). API key disimpan SERVER-SIDE via Edge Function
// Secrets — TIDAK PERNAH terekspos ke browser.
//
// Deploy: Supabase Dashboard → Edge Functions → Deploy new function →
//         "Via Editor", beri nama: gemini-proxy
// Secret: Settings → Edge Functions → Secrets → tambahkan:
//         GEMINI_API_KEY = <key dari Google AI Studio>
//         (opsional) GEMINI_MODEL = gemini-2.5-flash
//                    GEMINI_IMAGE_MODEL = gemini-2.5-flash-image
//
// Dipanggil dari app:
//   POST ${SUPABASE_URL}/functions/v1/gemini-proxy
//   body: { mode:'text'|'image', prompt, system?, files?:[{mime_type,data}],
//           model?, temperature? }
//   resp: { text }                (mode text)
//         { images:[dataUri...] } (mode image)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Gunakan POST' }, 405);

  const KEY = Deno.env.get('GEMINI_API_KEY');
  if (!KEY) {
    return json({ error: 'GEMINI_API_KEY belum diset. Tambahkan di Settings → Edge Functions → Secrets.' }, 500);
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

    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini error HTTP ${res.status}`;
      return json({ error: msg }, res.status);
    }

    const cand = data?.candidates?.[0];
    if (!cand) return json({ error: 'Tidak ada hasil dari Gemini (kemungkinan diblokir filter).' }, 502);

    if (mode === 'image') {
      const images: string[] = [];
      for (const p of cand.content?.parts || []) {
        const inline = p.inlineData || p.inline_data;
        if (inline?.data) images.push(`data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`);
      }
      if (!images.length) return json({ error: 'Model tidak mengembalikan gambar. Coba ubah prompt.' }, 502);
      return json({ images, model });
    }

    const text = (cand.content?.parts || []).map((p: Record<string, string>) => p.text || '').join('').trim();
    if (!text) return json({ error: 'Respons kosong dari model.' }, 502);
    return json({ text, model, finishReason: cand.finishReason || null });
  } catch (e) {
    return json({ error: `Gagal memproses: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
