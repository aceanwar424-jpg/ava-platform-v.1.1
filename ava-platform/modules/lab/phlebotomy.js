// ═══════════════════════════════════════════════════════════════
// MODUL: Flebotomi — pengambilan sampel & urutan tabung
//
// Versi sebelumnya tidak punya panggilan data: daftar tabung dan
// antrean pengambilan ditulis tangan sebagai array.
//
// Sekarang membaca public.lab_tabung (migrasi 0038) dan
// public.lab_samples yang sudah ada.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Katalog tabung dibiarkan KOSONG sampai lab mengisinya. Volume dan
// jumlah inversi berbeda antar merek tabung, dan urutan pengambilan
// bergantung tabung apa saja yang dipakai lab ini. Mengisinya dengan
// angka contoh berarti petugas mengambil darah menurut angka yang tidak
// pernah dicocokkan dengan tabung di rak.
//
// Urutan pengambilan penting bukan karena kerapian: aditif dari tabung
// sebelumnya yang terbawa mengubah hasil tabung berikutnya. Karena itu
// daftar diurutkan berdasarkan kolom urutan_ambil dan nomornya
// ditampilkan besar.
//
// Prefiks "ph".
// ═══════════════════════════════════════════════════════════════

let phData = null;
let phTab = 'antrean';

function phEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function phJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function phMuat() {
  if (typeof sbGet !== 'function') { phData = null; return; }
  try {
    const [tabung, sampel] = await Promise.all([
      sbGet('lab_tabung', 'select=*&order=urutan_ambil'),
      sbGet('lab_samples',
        'select=*&order=id.desc&limit=200'),
    ]);
    phData = { tabung, sampel };
  } catch (e) { phData = null; }
}

async function renderPhlebotomy() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await phMuat();

  if (phData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Flebotomi</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data flebotomi tidak dapat dibaca.</strong><br>
        Tabel <code>lab_tabung</code> belum ada — jalankan ulang aplikasi
        agar migrasi <code>0038_lis_flebotomi_kelayakan_pme_arsip.sql</code>
        terpasang.
      </div>`;
    return;
  }
  phGambar();
}

function phGambar() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Flebotomi</h1>
        <p class="muted">Pengambilan sampel dan urutan tabung.</p>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${phTab === 'antrean' ? 'active' : ''}"
              onclick="phGantiTab('antrean')">Menunggu Pengambilan</button>
      <button class="tab ${phTab === 'tabung' ? 'active' : ''}"
              onclick="phGantiTab('tabung')">Urutan Tabung</button>
    </div>

    ${phTab === 'antrean' ? phTabAntrean() : phTabTabung()}`;
}

function phGantiTab(t) { phTab = t; phGambar(); }

function phTabAntrean() {
  const belum = (phData.sampel || []).filter(s => !s.collected_at
    && (s.status || 'Pending') === 'Pending');
  const sudah = (phData.sampel || []).filter(s => s.collected_at).slice(0, 40);

  return `
    ${!belum.length ? `
      <div class="card" style="padding:32px; text-align:center; margin-bottom:16px">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">💉</div>
        <div style="font-weight:700; margin-bottom:4px">
          Tidak ada sampel yang menunggu diambil</div>
        <div style="font-size:13px; color:var(--text3)">
          Permintaan pemeriksaan yang sudah terdaftar akan muncul di sini.</div>
      </div>` : `
      <div class="card" style="margin-bottom:16px; overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Barcode</th><th>Pasien</th><th>Pemeriksaan</th>
          <th>Jenis Sampel</th><th></th>
        </tr></thead><tbody>
        ${belum.map(s => `<tr>
          <td><b>${phEsc(s.barcode || '—')}</b></td>
          <td>${phEsc(s.patient_name || '—')}</td>
          <td>${phEsc(s.product_name || '—')}</td>
          <td>${phEsc(s.sampel_type || '—')}</td>
          <td><button class="btn btn-sm btn-primary" onclick="phAmbil(${s.id})">
            Catat Pengambilan</button></td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}

    <h3 style="font-size:14px; margin:16px 0 8px">Sudah Diambil (terbaru)</h3>
    ${!sudah.length ? `
      <div class="card" style="padding:24px; text-align:center; font-size:13px;
                               color:var(--text3)">Belum ada pengambilan tercatat.</div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Barcode</th><th>Pasien</th><th>Diambil</th><th>Oleh</th>
          <th style="text-align:right">Volume</th>
          <th>Lokasi Tusuk</th>
          <th style="text-align:right">Percobaan</th>
          <th>Puasa</th><th>Status</th>
        </tr></thead><tbody>
        ${sudah.map(s => `<tr>
          <td>${phEsc(s.barcode || '—')}</td>
          <td>${phEsc(s.patient_name || '—')}</td>
          <td style="white-space:nowrap">${phJam(s.collected_at)}</td>
          <td>${phEsc(s.collected_by || '—')}</td>
          <td style="text-align:right">${s.volume_ml ? s.volume_ml + ' mL' : '—'}</td>
          <td>${phEsc(s.lokasi_tusuk || '—')}</td>
          <td style="text-align:right; ${Number(s.jml_percobaan) > 1
            ? 'color:var(--warning); font-weight:700' : ''}">
            ${s.jml_percobaan || 1}</td>
          <td>${s.puasa === true ? 'ya' : s.puasa === false ? 'tidak' : '—'}</td>
          <td>${phEsc(s.status || '—')}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}`;
}

function phTabTabung() {
  const T = phData.tabung || [];
  if (!T.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🧪</div>
      <div style="font-weight:700; margin-bottom:6px">Katalog tabung belum diisi</div>
      <div style="font-size:13px; color:var(--text3); line-height:1.8; max-width:520px;
                  margin:0 auto">
        Daftar ini sengaja dibiarkan kosong sampai lab mengisinya sendiri.
        Volume dan jumlah inversi berbeda antar merek tabung, dan urutan
        pengambilan bergantung tabung apa saja yang dipakai di sini.
        Mengisinya dengan angka contoh berarti petugas mengambil darah
        menurut angka yang tidak pernah dicocokkan dengan tabung di rak.
      </div>
    </div>`;
  }

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Urut dari atas ke bawah. Urutan ini penting bukan karena kerapian:
      aditif dari tabung sebelumnya yang terbawa mengubah hasil tabung
      berikutnya — EDTA yang masuk ke tabung kimia menaikkan kalium dan
      menurunkan kalsium.
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th style="width:60px">Urutan</th><th>Tabung</th><th>Warna Tutup</th>
        <th>Aditif</th><th style="text-align:right">Volume</th>
        <th style="text-align:right">Inversi</th>
        <th>Departemen</th><th>Penyimpanan</th>
      </tr></thead><tbody>
      ${T.map(t => `<tr>
        <td style="text-align:center; font-size:20px; font-weight:800; color:var(--primary)">
          ${t.urutan_ambil ?? '—'}</td>
        <td><b>${phEsc(t.nama)}</b>
          <div style="font-size:11px; color:var(--text3)">${phEsc(t.kode)}</div></td>
        <td>${phEsc(t.warna_tutup || '—')}</td>
        <td>${phEsc(t.aditif || '—')}</td>
        <td style="text-align:right">${t.volume_ml ? t.volume_ml + ' mL' : '—'}</td>
        <td style="text-align:right">${t.jml_bolak_balik ?? '—'}</td>
        <td>${phEsc(t.departemen || '—')}</td>
        <td style="font-size:12px">${phEsc(t.suhu_simpan || '—')}
          ${t.stabil_jam ? `<div style="font-size:11px; color:var(--text3)">
            stabil ${t.stabil_jam} jam</div>` : ''}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

async function phAmbil(sampleId) {
  const oleh = prompt('Diambil oleh (nama flebotomis):', window.currentUsername || '');
  if (!oleh) return;
  const vol = prompt('Volume yang berhasil diambil (mL):', '');
  if (vol === null) return;
  const lokasi = prompt('Lokasi tusukan (mis. vena mediana cubiti kanan):', '');
  if (lokasi === null) return;
  const percobaan = prompt('Jumlah percobaan tusukan:', '1');
  if (percobaan === null) return;
  const puasa = confirm('Pasien dalam keadaan puasa?\n\nOK = ya, Batal = tidak');

  try {
    await sbPatch('lab_samples', sampleId, {
      collected_at: new Date().toISOString(),
      collected_by: oleh,
      volume_ml: vol ? parseFloat(vol) : null,
      lokasi_tusuk: lokasi || null,
      jml_percobaan: parseInt(percobaan, 10) || 1,
      puasa: puasa,
    });
    await renderPhlebotomy();
  } catch (e) { alert('Gagal mencatat pengambilan: ' + e.message); }
}

function recordPhlebotomySampling(barcode, data = {}) {
  const record = {
    barcode,
    officer: data.officer || 'Analis',
    sampling_site: data.sampling_site || 'Vena Mediana Cubiti',
    sampling_time: new Date().toISOString(),
    status: 'Selesai Sampling',
    notes: data.notes || 'Sampling selesai'
  };
  return { success: true, status: 'Selesai Sampling', record };
}

window.renderPhlebotomy = renderPhlebotomy;
window.phGantiTab = phGantiTab;
window.phAmbil    = phAmbil;
window.recordPhlebotomySampling = recordPhlebotomySampling;
