// ═══════════════════════════════════════════════════════════════
// CORE: Pemuat modul saat dibutuhkan (lazy loading)
//
// Sebelumnya 82 berkas modul — 3,1 MB JavaScript — dimuat pada SETIAP kali
// aplikasi dibuka, termasuk ketika pengguna hanya melihat Dashboard lalu
// menutupnya. Di komputer klinik yang tidak baru, itu detik-detik yang
// hilang pada tiap boot.
//
// Kini modul dimuat saat halamannya dibuka. 2,84 MB dari 3,1 MB ditunda.
//
// ── Kenapa ada jaring pengaman ───────────────────────────────
// Modul di sini saling memanggil fungsi global satu sama lain, dan
// ketergantungan itu tidak terdaftar di mana pun. Memetakan seluruhnya
// secara statis berisiko meleset, dan melesetnya baru terasa saat petugas
// membuka layar tertentu di tengah pekerjaan.
//
// Karena itu: bila sebuah fungsi render tidak ditemukan sesudah modul
// halamannya dimuat, SELURUH modul sisanya dimuat sekali lalu dicoba lagi.
// Jalur cepat untuk keadaan normal, dan hasil akhir yang tidak pernah lebih
// buruk daripada perilaku lama.
// ═══════════════════════════════════════════════════════════════

const MODUL_VER = '20260815a';
const _modulDimuat = new Map();   // src → Promise

function muatSkrip(src) {
  if (_modulDimuat.has(src)) return _modulDimuat.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${src}?v=${MODUL_VER}`;
    s.async = false;              // jaga urutan eksekusi antar berkas sekelompok
    s.onload = () => resolve(src);
    s.onerror = () => reject(new Error(`gagal memuat ${src}`));
    document.head.appendChild(s);
  });
  _modulDimuat.set(src, p);
  return p;
}

// Muat modul milik satu halaman. Berurutan, karena berkas saudara dalam satu
// folder kerap bergantung pada urutan pemuatan aslinya.
async function pastikanModulHalaman(page) {
  const daftar = (window.MODUL_HALAMAN || {})[page];
  if (!daftar || !daftar.length) return false;
  for (const f of daftar) {
    try { await muatSkrip(f); }
    catch (e) { console.warn('[Lazy]', e.message); }
  }
  return true;
}

let _semuaPromise = null;
function muatSemuaModul() {
  if (_semuaPromise) return _semuaPromise;
  console.warn('[Lazy] Jaring pengaman aktif — memuat sisa modul.');
  _semuaPromise = (async () => {
    for (const f of (window.MODUL_SEMUA || [])) {
      try { await muatSkrip(f); } catch (e) { console.warn('[Lazy]', e.message); }
    }
  })();
  return _semuaPromise;
}

// Prefetch halus: sesudah aplikasi diam, muat modul yang paling sering dibuka
// agar perpindahan pertama terasa seketika — tanpa membebani boot.
function prefetchModulUmum(daftarHalaman = ['admission', 'lab', 'cashier', 'medrecord']) {
  const jalan = () => daftarHalaman.forEach(p => {
    ((window.MODUL_HALAMAN || {})[p] || []).forEach(f => { muatSkrip(f).catch(() => {}); });
  });
  if ('requestIdleCallback' in window) requestIdleCallback(jalan, { timeout: 8000 });
  else setTimeout(jalan, 4000);
}

window.muatSkrip = muatSkrip;
window.pastikanModulHalaman = pastikanModulHalaman;
window.muatSemuaModul = muatSemuaModul;
window.prefetchModulUmum = prefetchModulUmum;
