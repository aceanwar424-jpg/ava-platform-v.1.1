// ═══════════════════════════════════════════════════════════════
// MODUL: Arsip & Retensi Sampel
//
// Versi sebelumnya tidak punya panggilan data. Sekarang membaca
// public.lab_arsip_papan dan public.lab_samples (migrasi 0038).
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Pemusnahan sebelum masa simpan habis ditolak — dijaga di basis data,
// bukan hanya di layar. Sampel adalah satu-satunya cara memeriksa ulang
// hasil yang dipertanyakan; membuangnya lebih cepat dari jadwal
// menghapus kemungkinan itu untuk selamanya.
//
// Arsip tanpa lokasi ditolak. Sampel yang tercatat "diarsipkan" tapi
// tidak diketahui ada di rak mana sama saja dengan hilang, hanya dengan
// tambahan rasa aman yang keliru.
//
// Sampel yang lewat masa simpan ditandai "Siap Dimusnahkan", bukan
// dimusnahkan otomatis. Pemusnahan butuh orang yang bertanggung jawab
// dan berita acara.
//
// Prefiks "sa".
// ═══════════════════════════════════════════════════════════════

let saData = null;
let saFilter = 'tersimpan';

function saEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function saTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function saMuat() {
  if (typeof sbGet !== 'function') { saData = null; return; }
  try {
    saData = await sbGet('lab_arsip_papan', 'select=*&order=simpan_sampai&limit=500');
  } catch (e) { saData = null; }
}

async function renderSampleArchiving() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await saMuat();

  if (saData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Arsip &amp; Retensi Sampel</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data arsip tidak dapat dibaca.</strong><br>
        View <code>lab_arsip_papan</code> belum ada — jalankan ulang aplikasi
        agar migrasi <code>0038_lis_flebotomi_kelayakan_pme_arsip.sql</code>
        terpasang.
      </div>`;
    return;
  }
  saGambar();
}

function saGambar() {
  const A = saData || [];
  const belum = A.filter(x => x.status_arsip === 'Belum Diarsipkan');
  const tersimpan = A.filter(x => x.status_arsip === 'Tersimpan');
  const siap = A.filter(x => x.status_arsip === 'Siap Dimusnahkan');
  const musnah = A.filter(x => x.status_arsip === 'Dimusnahkan');

  const daftar = saFilter === 'belum' ? belum
               : saFilter === 'tersimpan' ? tersimpan
               : saFilter === 'siap' ? siap : musnah;

  const warna = {
    'Belum Diarsipkan': 'var(--warning)', 'Tersimpan': 'var(--success)',
    'Siap Dimusnahkan': 'var(--danger)', 'Dimusnahkan': 'var(--text3)',
  };

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Arsip &amp; Retensi Sampel</h1>
        <p class="muted">Penyimpanan sampel selesai periksa, masa simpan, dan pemusnahan.</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
                gap:12px; margin-bottom:16px">
      ${saKartu('Belum diarsipkan', belum.length, 'belum', warna['Belum Diarsipkan'])}
      ${saKartu('Tersimpan', tersimpan.length, 'tersimpan', warna['Tersimpan'])}
      ${saKartu('Siap dimusnahkan', siap.length, 'siap', warna['Siap Dimusnahkan'])}
      ${saKartu('Sudah dimusnahkan', musnah.length, 'musnah', warna['Dimusnahkan'])}
    </div>

    ${siap.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${siap.length} sampel sudah lewat masa simpan.</b>
        Pemusnahan tidak berjalan otomatis — ia butuh petugas yang
        bertanggung jawab dan berita acara.
      </div>` : ''}

    ${!daftar.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🗄️</div>
        <div style="font-weight:700">Tidak ada sampel pada kelompok ini</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Barcode</th><th>Pasien</th><th>Pemeriksaan</th><th>Jenis</th>
          <th>Lokasi</th><th>Diarsipkan</th><th>Simpan s/d</th>
          <th style="text-align:right">Sisa</th><th>Status</th><th></th>
        </tr></thead><tbody>
        ${daftar.map(x => `<tr>
          <td><b>${saEsc(x.barcode || '—')}</b></td>
          <td>${saEsc(x.patient_name || '—')}</td>
          <td>${saEsc(x.product_name || '—')}</td>
          <td>${saEsc(x.sampel_type || '—')}</td>
          <td style="font-size:12px">${saLokasi(x)}</td>
          <td>${saTgl(x.diarsipkan_at)}</td>
          <td>${saTgl(x.simpan_sampai)}</td>
          <td style="text-align:right; color:${Number(x.sisa_hari) < 0
            ? 'var(--danger)' : 'inherit'}">
            ${x.sisa_hari == null ? '—'
              : Number(x.sisa_hari) < 0 ? 'lewat ' + Math.abs(x.sisa_hari) + 'h'
              : x.sisa_hari + ' hari'}</td>
          <td><span style="font-weight:600; color:${warna[x.status_arsip] || 'var(--text3)'}">
            ${saEsc(x.status_arsip)}</span></td>
          <td style="white-space:nowrap">
            ${x.status_arsip === 'Belum Diarsipkan'
              ? `<button class="btn btn-sm btn-primary" onclick="saArsipkan(${x.id})">
                   Arsipkan</button>` : ''}
            ${x.status_arsip === 'Siap Dimusnahkan'
              ? `<button class="btn btn-sm" onclick="saMusnahkan(${x.id})">
                   Musnahkan</button>` : ''}
            ${x.status_arsip === 'Dimusnahkan' && x.dimusnahkan_oleh
              ? `<span style="font-size:11px; color:var(--text3)">
                   oleh ${saEsc(x.dimusnahkan_oleh)}</span>` : ''}
          </td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}`;
}

// Lokasi ditulis sebagai satu baris: tempat, lalu rak/boks/posisi yang
// terisi saja. Menampilkan "· · ·" untuk bagian kosong membuat rak yang
// belum dicatat terlihat seperti sudah dicatat.
function saLokasi(x) {
  if (!x.lokasi_arsip) return '—';
  const rinci = [x.rak, x.boks, x.posisi].filter(Boolean).map(saEsc);
  return saEsc(x.lokasi_arsip) + (rinci.length ? ' · ' + rinci.join(' · ') : '');
}

function saKartu(label, angka, kunci, warna) {
  return `<div class="card" style="padding:14px; cursor:pointer;
            ${saFilter === kunci ? 'outline:2px solid var(--primary)' : ''}"
            onclick="saSaring('${kunci}')">
    <div style="font-size:12px; color:var(--text3)">${label}</div>
    <div style="font-size:22px; font-weight:800; color:${warna}">${angka}</div>
  </div>`;
}

function saSaring(k) { saFilter = k; saGambar(); }

async function saArsipkan(id) {
  const lokasi = prompt('Lokasi penyimpanan (mis. Freezer -20°C, Kulkas 4°C):');
  if (!lokasi) return;
  const rak = prompt('Rak:', '');
  if (rak === null) return;
  const boks = prompt('Boks:', '');
  if (boks === null) return;
  const posisi = prompt('Posisi dalam boks (mis. A5):', '');
  if (posisi === null) return;
  const hari = prompt('Masa simpan (hari):', '7');
  if (hari === null) return;

  try {
    const r = await sbRpc('lab_arsipkan_sampel', {
      p_sample_id: id, p_lokasi: lokasi, p_rak: rak || null,
      p_boks: boks || null, p_posisi: posisi || null,
      p_simpan_hari: parseInt(hari, 10) || 7,
      p_oleh: (window.currentUsername || 'analis'),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Sampel ${r.barcode} diarsipkan. Simpan sampai ${r.simpan_sampai}.`);
    await renderSampleArchiving();
  } catch (e) { alert('Gagal mengarsipkan: ' + e.message); }
}

async function saMusnahkan(id) {
  const ba = prompt('Nomor berita acara pemusnahan:');
  if (!ba) return;
  const oleh = prompt('Dimusnahkan oleh (nama petugas):', window.currentUsername || '');
  if (!oleh) return;
  if (!confirm('Pemusnahan tidak bisa dibatalkan. Lanjutkan?')) return;

  try {
    const r = await sbRpc('lab_musnahkan_sampel', {
      p_sample_id: id, p_berita_acara: ba, p_oleh: oleh,
    });
    if (r && r.error) { alert(r.error); return; }
    await renderSampleArchiving();
  } catch (e) { alert('Gagal mencatat pemusnahan: ' + e.message); }
}

window.renderSampleArchiving = renderSampleArchiving;
window.saSaring    = saSaring;
window.saArsipkan  = saArsipkan;
window.saMusnahkan = saMusnahkan;
