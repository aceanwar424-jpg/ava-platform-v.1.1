// ═══════════════════════════════════════════════════════════════
// MODUL: Kelayakan Spesimen — terima atau tolak
//
// Versi sebelumnya tidak punya panggilan data: kriteria penolakan
// (REJ-01 dst) dan antrean verifikasi ditulis tangan sebagai array,
// lengkap dengan ambang seperti "hemolisis ≥3+".
//
// Ambang itulah yang paling berbahaya untuk dikarang. Menolak sampel
// kalium karena hemolisis adalah keputusan yang benar; menolaknya
// berdasarkan angka yang tidak pernah divalidasi lab ini bukan.
//
// Sekarang membaca public.lab_kriteria_tolak (migrasi 0038) yang
// sengaja dibuat kosong, dan public.lab_samples.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Penolakan tidak bisa dilakukan tanpa memilih kriteria yang sudah
// ditetapkan lab. Ini dipaksakan di basis data juga (lab_tolak_spesimen),
// bukan hanya di layar — supaya alasan penolakan selalu bisa ditelusuri
// ke kebijakan tertulis, bukan ke pendapat petugas yang sedang jaga.
//
// Sampel yang hasilnya sudah keluar tidak bisa ditolak surut. Kalau
// hasilnya diragukan, jalurnya penarikan hasil — bukan menandai sampel
// ditolak sambil membiarkan hasil yang sudah dikirim ke dokter.
//
// Prefiks "sv".
// ═══════════════════════════════════════════════════════════════

let svData = null;
let svTab = 'antrean';

function svEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function svJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function svMuat() {
  if (typeof sbGet !== 'function') { svData = null; return; }
  try {
    const [kriteria, sampel] = await Promise.all([
      sbGet('lab_kriteria_tolak', 'select=*&order=kode'),
      sbGet('lab_samples', 'select=*&order=id.desc&limit=300'),
    ]);
    svData = { kriteria, sampel };
  } catch (e) { svData = null; }
}

async function renderSpecimenVerification() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await svMuat();

  if (svData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Kelayakan Spesimen</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data kelayakan tidak dapat dibaca.</strong><br>
        Tabel <code>lab_kriteria_tolak</code> belum ada — jalankan ulang
        aplikasi agar migrasi
        <code>0038_lis_flebotomi_kelayakan_pme_arsip.sql</code> terpasang.
      </div>`;
    return;
  }
  svGambar();
}

function svGambar() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Kelayakan Spesimen</h1>
        <p class="muted">Verifikasi penerimaan sampel dan pencatatan penolakan.</p>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${svTab === 'antrean' ? 'active' : ''}"
              onclick="svGantiTab('antrean')">Menunggu Verifikasi</button>
      <button class="tab ${svTab === 'ditolak' ? 'active' : ''}"
              onclick="svGantiTab('ditolak')">Riwayat Penolakan</button>
      <button class="tab ${svTab === 'kriteria' ? 'active' : ''}"
              onclick="svGantiTab('kriteria')">Kriteria Penolakan</button>
    </div>

    ${svTab === 'antrean'  ? svTabAntrean()
    : svTab === 'ditolak'  ? svTabDitolak() : svTabKriteria()}`;
}

function svGantiTab(t) { svTab = t; svGambar(); }

function svTabAntrean() {
  // Sampel yang sudah diambil tapi belum diverifikasi penerimaannya.
  const antre = (svData.sampel || []).filter(s =>
    s.collected_at && !s.diverifikasi_at && s.status !== 'Rejected');

  if (!antre.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🔎</div>
      <div style="font-weight:700; margin-bottom:4px">
        Tidak ada sampel yang menunggu verifikasi</div>
      <div style="font-size:13px; color:var(--text3)">
        Sampel yang sudah diambil akan muncul di sini untuk diperiksa
        kelayakannya sebelum diproses.</div>
    </div>`;
  }

  const adaKriteria = (svData.kriteria || []).length > 0;

  return `
    ${!adaKriteria ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>Kriteria penolakan belum ditetapkan.</b>
        Sampel bisa diterima, tetapi belum bisa ditolak — penolakan wajib
        merujuk kriteria tertulis. Isi daftarnya di tab Kriteria Penolakan.
      </div>` : ''}
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Barcode</th><th>Pasien</th><th>Pemeriksaan</th>
        <th>Jenis</th><th>Diambil</th>
        <th style="text-align:right">Volume</th>
        <th style="text-align:right">Percobaan</th><th></th>
      </tr></thead><tbody>
      ${antre.map(s => `<tr>
        <td><b>${svEsc(s.barcode || '—')}</b></td>
        <td>${svEsc(s.patient_name || '—')}</td>
        <td>${svEsc(s.product_name || '—')}</td>
        <td>${svEsc(s.sampel_type || '—')}</td>
        <td style="white-space:nowrap">${svJam(s.collected_at)}</td>
        <td style="text-align:right">${s.volume_ml ? s.volume_ml + ' mL' : '—'}</td>
        <td style="text-align:right; ${Number(s.jml_percobaan) > 1
          ? 'color:var(--warning); font-weight:700' : ''}">${s.jml_percobaan || 1}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-primary" onclick="svTerima(${s.id})">Terima</button>
          <button class="btn btn-sm" onclick="svTolak(${s.id})"
                  ${adaKriteria ? '' : 'disabled title="Kriteria penolakan belum ditetapkan"'}>
            Tolak</button>
        </td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

function svTabDitolak() {
  const tolak = (svData.sampel || []).filter(s => s.status === 'Rejected');
  const namaKriteria = id =>
    (svData.kriteria.find(k => k.id === id) || {});

  if (!tolak.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📋</div>
      <div style="font-weight:700">Belum ada sampel yang ditolak</div>
    </div>`;
  }

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Angka penolakan adalah indikator mutu praanalitik. Yang naik tiba-tiba
      biasanya menunjuk ke satu ruangan, satu shift, atau satu jenis tabung —
      bukan ke pasien.
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Barcode</th><th>Pasien</th><th>Pemeriksaan</th>
        <th>Kriteria</th><th>Alasan</th><th>Diverifikasi</th>
        <th>Oleh</th><th>Ambil Ulang</th>
      </tr></thead><tbody>
      ${tolak.map(s => {
        const k = namaKriteria(s.kriteria_tolak_id);
        return `<tr>
          <td>${svEsc(s.barcode || '—')}</td>
          <td>${svEsc(s.patient_name || '—')}</td>
          <td>${svEsc(s.product_name || '—')}</td>
          <td>${k.kode ? `<b>${svEsc(k.kode)}</b> ${svEsc(k.nama)}` : '—'}</td>
          <td style="font-size:12px">${svEsc(s.alasan_tolak || '—')}</td>
          <td style="white-space:nowrap">${svJam(s.diverifikasi_at)}</td>
          <td>${svEsc(s.diverifikasi_oleh || '—')}</td>
          <td>${s.diambil_ulang
            ? '<span style="color:var(--danger); font-weight:700">perlu</span>'
            : '<span style="color:var(--text3)">tidak</span>'}</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>`;
}

function svTabKriteria() {
  const K = svData.kriteria || [];
  if (!K.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📐</div>
      <div style="font-weight:700; margin-bottom:6px">
        Kriteria penolakan belum ditetapkan</div>
      <div style="font-size:13px; color:var(--text3); line-height:1.8; max-width:560px;
                  margin:0 auto 14px">
        Daftar ini sengaja dibiarkan kosong. Ambang penolakan — berapa plus
        hemolisis yang menolak kalium, berapa jam sampel masih layak —
        adalah kebijakan lab yang bergantung pada analyzer, metode, dan
        validasi internalnya. Mengisinya dengan angka yang terdengar masuk
        akal akan membuat petugas menerima atau menolak sampel berdasarkan
        ambang yang tidak pernah divalidasi siapa pun di sini.
      </div>
      <button class="btn btn-primary" onclick="svTambahKriteria()">
        + Tetapkan Kriteria</button>
    </div>`;
  }

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="svTambahKriteria()">
        + Tambah Kriteria</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Kode</th><th>Kriteria</th><th>Kategori</th>
        <th>Tindakan</th><th>Berlaku Untuk</th>
        <th>Ambil Ulang</th><th>Ditetapkan</th><th>Status</th>
      </tr></thead><tbody>
      ${K.map(k => `<tr>
        <td><b>${svEsc(k.kode)}</b></td>
        <td>${svEsc(k.nama)}</td>
        <td>${svEsc(k.kategori || '—')}</td>
        <td style="font-size:12px">${svEsc(k.tindakan || '—')}</td>
        <td style="font-size:12px">${svEsc(k.berlaku_untuk || 'semua pemeriksaan')}</td>
        <td>${k.wajib_ambil_ulang ? 'wajib' : 'tidak'}</td>
        <td style="font-size:12px">${svEsc(k.ditetapkan_oleh || '—')}
          ${k.tgl_berlaku ? `<div style="font-size:11px; color:var(--text3)">
            ${new Date(k.tgl_berlaku).toLocaleDateString('id-ID')}</div>` : ''}</td>
        <td>${k.aktif ? 'Aktif' : 'Nonaktif'}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

async function svTerima(id) {
  try {
    const r = await sbRpc('lab_terima_spesimen', {
      p_sample_id: id, p_oleh: (window.currentUsername || 'analis'),
    });
    if (r && r.error) { alert(r.error); return; }
    await renderSpecimenVerification();
  } catch (e) { alert('Gagal menerima spesimen: ' + e.message); }
}

async function svTolak(id) {
  const K = (svData.kriteria || []).filter(k => k.aktif);
  if (!K.length) {
    alert('Kriteria penolakan belum ditetapkan. Penolakan wajib merujuk '
        + 'kriteria tertulis — isi daftarnya di tab Kriteria Penolakan.');
    return;
  }

  const pilihan = K.map((k, i) => `${i + 1}. ${k.kode} — ${k.nama}`).join('\n');
  const n = prompt(`Pilih kriteria penolakan:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const k = K[parseInt(n, 10) - 1];
  if (!k) { alert('Nomor tidak dikenal.'); return; }

  const catatan = prompt(`Catatan tambahan (opsional):\n\nTindakan: ${k.tindakan || '—'}`, '');
  if (catatan === null) return;

  try {
    const r = await sbRpc('lab_tolak_spesimen', {
      p_sample_id: id, p_kriteria_id: k.id,
      p_alasan: catatan || null,
      p_oleh: (window.currentUsername || 'analis'),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Sampel ${r.barcode} ditolak.\n\n${r.kriteria}\n`
      + (r.perlu_ambil_ulang ? '\nPasien PERLU diambil ulang.' : '')
      + (r.tindakan ? `\nTindakan: ${r.tindakan}` : ''));
    await renderSpecimenVerification();
  } catch (e) { alert('Gagal menolak spesimen: ' + e.message); }
}

async function svTambahKriteria() {
  const kode = prompt('Kode kriteria (mis. REJ-01):');
  if (!kode) return;
  const nama = prompt('Uraian kriteria:');
  if (!nama) return;
  const kategori = prompt('Kategori (Praanalitik / Identitas / Volume / Transport):', 'Praanalitik');
  if (kategori === null) return;
  const tindakan = prompt('Tindakan yang harus dilakukan petugas:', '');
  if (tindakan === null) return;
  const berlaku = prompt('Berlaku untuk pemeriksaan apa? (kosong = semua)', '');
  if (berlaku === null) return;
  const ulang = confirm('Sampel yang ditolak dengan kriteria ini WAJIB diambil ulang?\n\n'
    + 'OK = wajib, Batal = tidak wajib');

  try {
    await sbPost('lab_kriteria_tolak', {
      kode: kode.trim(), nama: nama.trim(),
      kategori: kategori || null, tindakan: tindakan || null,
      berlaku_untuk: berlaku || null,
      wajib_ambil_ulang: ulang,
      ditetapkan_oleh: (window.currentUsername || null),
      tgl_berlaku: new Date().toISOString().slice(0, 10),
    });
    await renderSpecimenVerification();
  } catch (e) { alert('Gagal menyimpan kriteria: ' + e.message); }
}

window.renderSpecimenVerification = renderSpecimenVerification;
window.svGantiTab       = svGantiTab;
window.svTerima         = svTerima;
window.svTolak          = svTolak;
window.svTambahKriteria = svTambahKriteria;
