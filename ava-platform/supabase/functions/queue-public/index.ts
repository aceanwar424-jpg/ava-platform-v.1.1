// Edge Function: queue-public
// Jalur aman untuk kiosk dan display antrean publik. Tidak menerima atau
// mengembalikan nama pasien. Service-role key hanya hidup di server.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const LAYANAN = new Set(['Umum', 'Laboratorium', 'MCU', 'Sanctuary', 'Spesialis', 'Farmasi']);
const jejak = new Map<string, number>();

function bolehTerbit(req: Request, layanan: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const kunci = `${ip}|${layanan}`;
  const kini = Date.now();
  const lalu = jejak.get(kunci) || 0;
  if (kini - lalu < 2500) return false;
  jejak.set(kunci, kini);
  return true;
}

async function supabase(path: string, init: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Konfigurasi layanan antrean belum lengkap');
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.hint || 'Basis data antrean tidak tersedia');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const jalur = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  try {
    if (jalur === 'display' && req.method === 'GET') {
      const hari = new Date().toISOString().slice(0, 10);
      const [calls, waiting] = await Promise.all([
        supabase(`/rest/v1/queue_tickets?select=queue_number,service_type,counter,status,called_at,updated_at&queue_date=eq.${hari}&status=in.(Dipanggil,Dilayani)&order=called_at.desc,updated_at.desc&limit=8`),
        supabase(`/rest/v1/queue_tickets?select=service_type&queue_date=eq.${hari}&status=eq.Menunggu`),
      ]);
      const ringkas = new Map<string, number>();
      for (const tiket of waiting as Array<{ service_type?: string }>) {
        const layanan = tiket.service_type || 'Lainnya';
        ringkas.set(layanan, (ringkas.get(layanan) || 0) + 1);
      }
      return json({ calls, waiting: [...ringkas].map(([service_type, total]) => ({ service_type, total })) });
    }

    if (jalur !== 'issue' || req.method !== 'POST') return json({ error: 'Jalur antrean tidak dikenal' }, 404);
    const body = await req.json().catch(() => ({}));
    const layanan = String(body.service || '').trim();
    if (!LAYANAN.has(layanan)) return json({ error: 'Layanan kiosk tidak diizinkan' }, 400);
    if (!bolehTerbit(req, layanan)) return json({ error: 'Tunggu sebentar sebelum mengambil nomor lagi' }, 429);

    const tiket = await supabase('/rest/v1/rpc/issue_kiosk_queue_ticket', {
      method: 'POST',
      body: JSON.stringify({ p_service: layanan, p_kiosk_id: 'kiosk.avahealth.sbs' }),
    }) as { queue_number?: string; seq?: number; ahead?: number };
    return json({ ok: true, queue_number: tiket.queue_number, seq: tiket.seq, ahead: tiket.ahead || 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Layanan antrean gagal' }, 500);
  }
});
