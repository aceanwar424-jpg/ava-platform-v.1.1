// Kontrak antrean publik untuk kiosk dan display ruang tunggu.
//
// Tidak memakai localStorage: tiap subdomain memiliki storage browser sendiri,
// sehingga nomor dari kiosk tidak pernah dapat dilihat oleh TV antrean atau HIS.
// Jalur ini hanya membawa nomor, layanan, dan status — tidak pernah identitas pasien.
(function (global) {
  const host = String(location.hostname || '').toLowerCase();
  const lokal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
  const basis = lokal
    ? 'http://127.0.0.1:54329/functions/v1/queue-public'
    : 'https://rmyqzyfvlmjxtatpctks.supabase.co/functions/v1/queue-public';

  async function panggil(jalur, opsi = {}) {
    const res = await fetch(`${basis}/${jalur}`, {
      ...opsi,
      headers: { 'Content-Type': 'application/json', ...(opsi.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Layanan antrean tidak dapat dihubungi');
    return data;
  }

  global.AVA_QUEUE_PUBLIC = {
    mode: lokal ? 'simulasi-lokal' : 'produksi',
    issue(service) {
      return panggil('issue', { method: 'POST', body: JSON.stringify({ service }) });
    },
    display() { return panggil('display'); },
  };
})(window);
