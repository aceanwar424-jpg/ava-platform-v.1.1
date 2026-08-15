// Supabase Edge Function: docx-to-pdf
// Proxies DOCX→PDF conversion through ConvertAPI, keeping the API token
// safely server-side (set via Edge Function Secrets in the dashboard,
// never exposed to the browser).
//
// Deploy via Supabase Dashboard → Edge Functions → Deploy a new function → "Via Editor"
// Name it: docx-to-pdf
// Then set the secret: Settings → Edge Functions → Secrets → add CONVERTAPI_TOKEN
//
// Called from the app like:
//   const res = await fetch(`${SUPABASE_URL}/functions/v1/docx-to-pdf`, {
//     method: 'POST',
//     headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({ fileBase64: '...', fileName: 'surat.docx' })
//   });
//   const pdfBlob = await res.blob();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const CONVERTAPI_TOKEN = Deno.env.get('CONVERTAPI_TOKEN');
    if (!CONVERTAPI_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'CONVERTAPI_TOKEN belum diset. Tambahkan di Settings > Edge Functions > Secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileBase64, fileName } = await req.json();
    if (!fileBase64) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 wajib diisi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 -> binary for multipart upload to ConvertAPI
    const binaryStr = atob(fileBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const form = new FormData();
    form.append('File', new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), fileName || 'document.docx');

    const convertRes = await fetch('https://v2.convertapi.com/convert/docx/to/pdf', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CONVERTAPI_TOKEN}` },
      body: form,
    });

    if (!convertRes.ok) {
      const errText = await convertRes.text();
      return new Response(
        JSON.stringify({ error: `ConvertAPI error (HTTP ${convertRes.status}): ${errText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await convertRes.json();
    // ConvertAPI returns { Files: [{ FileData: base64string, FileName, FileSize }] }
    const pdfBase64 = result?.Files?.[0]?.FileData;
    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'ConvertAPI tidak mengembalikan file PDF. Response: ' + JSON.stringify(result) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ pdfBase64, fileName: result.Files[0].FileName }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Edge function error: ' + e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
