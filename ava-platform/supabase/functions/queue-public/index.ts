// Edge Function: queue-public
// Kiosk dan display publik tidak pernah menerima identitas pasien. Tenant,
// perangkat, layanan, dan rate-limit diputuskan oleh PostgreSQL via service role.

const defaultOrigins = ['https://kiosk.avahealth.sbs', 'https://antrian.avahealth.sbs'];
const deviceId = Deno.env.get('QUEUE_PUBLIC_DEVICE_ID') || '';
const allowedOrigins = new Set((Deno.env.get('QUEUE_PUBLIC_ALLOWED_ORIGINS') || defaultOrigins.join(','))
  .split(',').map(x => x.trim()).filter(Boolean));

function originOf(req: Request) {
  const origin = req.headers.get('origin') || '';
  return allowedOrigins.has(origin) ? origin : '';
}
function headers(origin = '') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
}
function json(body: unknown, status = 200, origin = '') {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
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

type DeviceContext = { tenant_id: string; device_id: string; allowed_services: string[]; kiosk_origin?: string; display_origin?: string };
async function deviceContext() {
  if (!deviceId) throw new Error('QUEUE_PUBLIC_DEVICE_ID belum diatur pada Edge Function');
  return await supabase('/rest/v1/rpc/queue_public_device_context', {
    method: 'POST', body: JSON.stringify({ p_device_id: deviceId }),
  }) as DeviceContext;
}

Deno.serve(async (req) => {
  const origin = originOf(req);
  if (req.method === 'OPTIONS') return origin ? new Response('ok', { headers: headers(origin) }) : json({ error: 'Origin tidak diizinkan' }, 403);
  if (!origin) return json({ error: 'Origin tidak diizinkan' }, 403);

  const jalur = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  try {
    const device = await deviceContext();
    const expectedOrigin = jalur === 'display' ? device.display_origin : device.kiosk_origin;
    if (expectedOrigin && origin !== expectedOrigin) return json({ error: 'Perangkat tidak cocok dengan origin' }, 403, origin);

    if (jalur === 'display' && req.method === 'GET') {
      const hari = new Date().toISOString().slice(0, 10);
      const tenant = encodeURIComponent(device.tenant_id);
      const [calls, waiting] = await Promise.all([
        supabase(`/rest/v1/queue_tickets?select=queue_number,service_type,counter,status,called_at,updated_at&tenant_id=eq.${tenant}&queue_date=eq.${hari}&status=in.(Dipanggil,Dilayani)&order=called_at.desc,updated_at.desc&limit=8`),
        supabase(`/rest/v1/queue_tickets?select=service_type&tenant_id=eq.${tenant}&queue_date=eq.${hari}&status=eq.Menunggu`),
      ]);
      const ringkas = new Map<string, number>();
      for (const tiket of waiting as Array<{ service_type?: string }>) {
        const layanan = tiket.service_type || 'Lainnya';
        ringkas.set(layanan, (ringkas.get(layanan) || 0) + 1);
      }
      return json({ calls, waiting: [...ringkas].map(([service_type, total]) => ({ service_type, total })) }, 200, origin);
    }

    if (jalur !== 'issue' || req.method !== 'POST') return json({ error: 'Jalur antrean tidak dikenal' }, 404, origin);
    const body = await req.json().catch(() => ({}));
    const layanan = String(body.service || '').trim();
    if (!layanan) return json({ error: 'Layanan wajib dipilih' }, 400, origin);
    const tiket = await supabase('/rest/v1/rpc/issue_public_queue_ticket', {
      method: 'POST', body: JSON.stringify({ p_device_id: device.device_id, p_service: layanan }),
    }) as { queue_number?: string; seq?: number; ahead?: number };
    return json({ ok: true, queue_number: tiket.queue_number, seq: tiket.seq, ahead: tiket.ahead || 0 }, 200, origin);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Layanan antrean gagal' }, 500, origin);
  }
});
