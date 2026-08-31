// ═══════════════════════════════════════════════════════════════
// MODUL: Master Radiologi — modalitas, katalog, dan unggah citra
//
// Satu berkas, tiga menu:
//   rad-modalitas  Modalitas & Jadwal Alat
//   rad-katalog    Katalog Pemeriksaan Radiologi
//   rad-unggah     Unggah Citra & Studi
//
// Ketiganya berputar di sekitar alat dan pemeriksaan yang sama, dan
// memisahkannya ke tiga berkas berarti tiga tempat yang membaca tabel
// yang sama dengan cara yang sedikit berbeda.
//
// Membaca migrasi 0043 (rad_katalog, kolom jadwal pada modalities) dan
// tabel radiology_images / radiology_orders yang sudah ada.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Izin BAPETEN dan jadwal kalibrasi alat ditampilkan bersama beban
// harian, bukan disembunyikan di halaman aset. Alat radiologi yang
// izinnya lewat atau kalibrasinya kedaluwarsa tetap menyala dan tetap
// memancarkan radiasi — yang hilang adalah dasar hukum memakainya dan
// jaminan bahwa dosisnya sesuai.
//
// Dosis acuan (DRL) dibiarkan kosong bila lab belum menetapkannya.
// Angka dosis yang ditebak lebih buruk daripada kolom kosong: ia jadi
// pembanding yang salah untuk menilai apakah paparan pasien wajar.
//
// Unggah citra menerima berkas pratinjau. Modul ini TIDAK mengurai
// DICOM — jalur DICOM sesungguhnya lewat PACS, dan path-nya dicatat
// sebagai rujukan.
//
// Prefiks "rd".
// ═══════════════════════════════════════════════════════════════

let rdData = null;
let rdTab = 'modalitas';

function rdEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function rdRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function rdTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function rdMuat() {
  if (typeof sbGet !== 'function') { rdData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [modal, katalog, citra, order] = await Promise.all([
      sbGet('rad_modalitas_papan', 'select=*&order=code'),
      sbGet('rad_katalog', 'select=*&order=modality_code,nama'),
      aman('radiology_images', 'select=*&order=id.desc&limit=300'),
      aman('radiology_orders',
        'select=id,accession_no,patient_name,procedure_name,modality_code,performed_at'
        + '&order=performed_at.desc&limit=200'),
    ]);
    rdData = { modal, katalog, citra, order };
  } catch (e) { rdData = null; }
}

async function renderRadMaster(params) {
  if (params && params.tab) rdTab = params.tab;
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await rdMuat();

  if (rdData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Master Radiologi</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data radiologi tidak dapat dibaca.</strong><br>
        View <code>rad_modalitas_papan</code> belum ada — jalankan ulang
        aplikasi agar migrasi
        <code>0043_rm_kelengkapan_rad_katalog.sql</code> terpasang.
      </div>`;
    return;
  }
  rdGambar();
}

function rdGambar() {
  const M = rdData.modal || [];
  const izinLewat = M.filter(m => m.izin_sisa_hari != null && Number(m.izin_sisa_hari) < 0);
  const kalLewat = M.filter(m => m.kalibrasi_sisa_hari != null
    && Number(m.kalibrasi_sisa_hari) < 0);

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Master Radiologi</h1>
        <p class="muted">Modalitas dan jadwalnya, katalog pemeriksaan, dan citra tersimpan.</p>
      </div>
    </div>

    ${izinLewat.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${izinLewat.length} alat izin BAPETEN-nya sudah lewat:</b>
        ${izinLewat.map(m => rdEsc(m.name || m.code)).join(', ')}.
        Alat tetap menyala dan tetap memancarkan radiasi — yang hilang
        adalah dasar hukum memakainya.
      </div>` : ''}
    ${kalLewat.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${kalLewat.length} alat lewat jadwal kalibrasi.</b>
        Tanpa kalibrasi, tidak ada jaminan dosis yang diterima pasien
        sesuai dengan yang disetel.
      </div>` : ''}

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${rdTab === 'modalitas' ? 'active' : ''}"
              onclick="rdGantiTab('modalitas')">Modalitas &amp; Jadwal (${M.length})</button>
      <button class="tab ${rdTab === 'katalog' ? 'active' : ''}"
              onclick="rdGantiTab('katalog')">Katalog Pemeriksaan (${(rdData.katalog || []).length})</button>
      <button class="tab ${rdTab === 'unggah' ? 'active' : ''}"
              onclick="rdGantiTab('unggah')">Citra &amp; Studi (${(rdData.citra || []).length})</button>
    </div>

    ${rdTab === 'modalitas' ? rdTabModalitas(M)
    : rdTab === 'katalog'   ? rdTabKatalog() : rdTabUnggah()}`;
}

function rdGantiTab(t) { rdTab = t; rdGambar(); }

function rdTabModalitas(M) {
  if (!M.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🖥️</div>
      <div style="font-weight:700; margin-bottom:6px">Belum ada modalitas terdaftar</div>
      <div style="font-size:13px; color:var(--text3); max-width:480px; margin:0 auto 14px">
        Daftarkan alat beserta jam operasi, kapasitas harian, jadwal
        kalibrasi, dan izin BAPETEN-nya.</div>
      <button class="btn btn-primary" onclick="rdModalitasBaru()">+ Tambah Modalitas</button>
    </div>`;
  }

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="rdModalitasBaru()">+ Modalitas</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
                gap:12px">
      ${M.map(m => {
        const beban = Number(m.order_hari_ini || 0);
        const kap = Number(m.kapasitas_harian || 0);
        const pct = kap ? Math.round(beban / kap * 100) : null;
        const izinLewat = m.izin_sisa_hari != null && Number(m.izin_sisa_hari) < 0;
        const kalLewat = m.kalibrasi_sisa_hari != null && Number(m.kalibrasi_sisa_hari) < 0;
        return `<div class="card" style="padding:16px; ${m.is_active === false ? 'opacity:.6' : ''}">
          <div style="display:flex; justify-content:space-between; gap:8px">
            <div style="min-width:0">
              <div style="font-weight:700">${rdEsc(m.name || m.code)}</div>
              <div style="font-size:11px; color:var(--text3)">
                ${rdEsc(m.code || '')}${m.room ? ' · ' + rdEsc(m.room) : ''}
                ${m.merk ? ' · ' + rdEsc(m.merk) + ' ' + rdEsc(m.model || '') : ''}</div>
            </div>
            ${m.is_active === false
              ? '<span class="badge">nonaktif</span>' : ''}
          </div>

          <div style="margin-top:12px; display:flex; gap:16px">
            <div>
              <div style="font-size:20px; font-weight:800">${beban}</div>
              <div style="font-size:11px; color:var(--text3)">order hari ini</div>
            </div>
            <div>
              <div style="font-size:20px; font-weight:800">${Number(m.selesai_hari_ini || 0)}</div>
              <div style="font-size:11px; color:var(--text3)">selesai</div>
            </div>
            <div>
              <div style="font-size:20px; font-weight:800; color:${pct === null
                ? 'var(--text3)' : pct > 100 ? 'var(--danger)'
                : pct > 85 ? 'var(--warning)' : 'inherit'}">
                ${pct === null ? '—' : pct + '%'}</div>
              <div style="font-size:11px; color:var(--text3)">
                ${kap ? 'dari ' + kap : 'kapasitas belum diisi'}</div>
            </div>
          </div>

          <div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border);
                      font-size:12px; line-height:1.8">
            ${m.jam_buka || m.jam_tutup
              ? `Jam operasi: ${rdEsc(m.jam_buka || '?')}–${rdEsc(m.jam_tutup || '?')}<br>` : ''}
            ${m.hari_operasi ? `Hari: ${rdEsc(m.hari_operasi)}<br>` : ''}
            ${m.slot_minutes ? `Slot: ${m.slot_minutes} menit<br>` : ''}
            ${m.jml_pemeriksaan} jenis pemeriksaan
          </div>

          <div style="margin-top:10px; font-size:12px; line-height:1.8">
            <div style="color:${kalLewat ? 'var(--danger)' : 'var(--text3)'}">
              Kalibrasi: ${rdTgl(m.kalibrasi_terakhir)}
              ${m.kalibrasi_berikut
                ? ` → ${rdTgl(m.kalibrasi_berikut)}`
                  + (kalLewat ? ` <b>(lewat ${Math.abs(m.kalibrasi_sisa_hari)} hari)</b>` : '')
                : ' · jadwal berikutnya belum diisi'}
            </div>
            <div style="color:${izinLewat ? 'var(--danger)' : 'var(--text3)'}">
              Izin BAPETEN: ${m.izin_bapeten
                ? rdEsc(m.izin_bapeten) + ' s/d ' + rdTgl(m.izin_berlaku_sampai)
                  + (izinLewat ? ' <b>(LEWAT)</b>' : '')
                : '<span style="color:var(--warning)">belum dicatat</span>'}
            </div>
          </div>

          <button class="btn btn-sm" style="width:100%; margin-top:10px"
                  onclick="rdModalitasUbah(${m.id})">Perbarui Jadwal &amp; Izin</button>
        </div>`;
      }).join('')}
    </div>`;
}

function rdTabKatalog() {
  const K = rdData.katalog || [];
  if (!K.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📖</div>
      <div style="font-weight:700; margin-bottom:6px">Katalog pemeriksaan masih kosong</div>
      <div style="font-size:13px; color:var(--text3); max-width:520px; margin:0 auto 14px;
                  line-height:1.8">
        Tiap pemeriksaan perlu menyebutkan persiapan pasien dan apakah
        memakai kontras — keduanya menentukan apa yang harus disampaikan
        sebelum pasien datang.
      </div>
      <button class="btn btn-primary" onclick="rdKatalogBaru()">+ Tambah Pemeriksaan</button>
    </div>`;
  }

  const tanpaDrl = K.filter(k => k.drl_msv == null);

  return `
    <div style="display:flex; justify-content:space-between; align-items:center;
                margin-bottom:10px; flex-wrap:wrap; gap:8px">
      <div style="font-size:12px; color:var(--text3)">
        ${tanpaDrl.length} dari ${K.length} pemeriksaan belum punya dosis acuan (DRL)
      </div>
      <button class="btn btn-sm btn-primary" onclick="rdKatalogBaru()">+ Pemeriksaan</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Kode</th><th>Pemeriksaan</th><th>Modalitas</th><th>Region</th>
        <th>Posisi</th><th style="text-align:right">Durasi</th>
        <th style="text-align:right">Tarif</th>
        <th>Kontras</th><th>Persiapan</th>
        <th style="text-align:right">DRL</th>
      </tr></thead><tbody>
      ${K.map(k => `<tr>
        <td><b>${rdEsc(k.kode)}</b></td>
        <td>${rdEsc(k.nama)}
          ${k.kontraindikasi ? `<div style="font-size:11px; color:var(--danger)">
            ⚠ ${rdEsc(k.kontraindikasi)}</div>` : ''}</td>
        <td>${rdEsc(k.modality_code || '—')}</td>
        <td style="font-size:12px">${rdEsc(k.region_tubuh || '—')}</td>
        <td style="font-size:12px">${rdEsc(k.posisi || '—')}</td>
        <td style="text-align:right">${k.durasi_menit ? k.durasi_menit + ' mnt' : '—'}</td>
        <td style="text-align:right">${rdRp(k.tarif)}</td>
        <td>${k.pakai_kontras
          ? `<span style="color:var(--warning); font-weight:600">ya</span>
             ${k.jenis_kontras ? `<div style="font-size:11px">${rdEsc(k.jenis_kontras)}</div>` : ''}`
          : 'tidak'}</td>
        <td style="font-size:12px; max-width:200px">${k.persiapan
          ? rdEsc(k.persiapan)
          : (k.pakai_kontras
              ? '<span style="color:var(--warning)">belum diisi</span>'
              : '<span style="color:var(--text3)">—</span>')}</td>
        <td style="text-align:right; font-size:12px">${k.drl_msv != null
          ? k.drl_msv + ' mSv'
          : '<span style="color:var(--text3)">belum</span>'}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Kolom <b>DRL</b> (dosis acuan diagnostik) dibiarkan kosong bila belum
      ditetapkan. Angka dosis yang ditebak lebih buruk daripada kolom
      kosong — ia menjadi pembanding yang salah saat menilai apakah paparan
      yang diterima pasien masih wajar.
    </div>`;
}

function rdTabUnggah() {
  const C = rdData.citra || [];
  const O = rdData.order || [];
  const tanpaCitra = O.filter(o => o.performed_at
    && !C.some(c => c.order_id === o.id));

  return `
    ${tanpaCitra.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${tanpaCitra.length} pemeriksaan sudah dikerjakan tapi belum ada citranya.</b>
        Ekspertise tidak bisa dibuat tanpa citra.
      </div>` : ''}

    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="rdUnggah()">+ Catat Citra</button>
    </div>

    ${!C.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🖼️</div>
        <div style="font-weight:700; margin-bottom:6px">Belum ada citra tercatat</div>
        <div style="font-size:13px; color:var(--text3); max-width:520px; margin:0 auto;
                    line-height:1.8">
          Modul ini mencatat lokasi berkas dan pratinjaunya — ia tidak
          mengurai DICOM. Jalur DICOM sesungguhnya lewat PACS, dan
          path-nya dicatat di sini sebagai rujukan.
        </div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Accession</th><th>Pasien</th><th>Label</th>
          <th style="text-align:right">Seri/Instance</th>
          <th style="text-align:right">Ukuran</th>
          <th>Berkas DICOM</th><th>Pratinjau</th><th>Diunggah</th>
        </tr></thead><tbody>
        ${C.map(c => {
          const o = O.find(x => x.id === c.order_id) || {};
          return `<tr>
            <td><b>${rdEsc(c.accession_no || o.accession_no || '—')}</b></td>
            <td>${rdEsc(o.patient_name || '—')}
              ${o.procedure_name ? `<div style="font-size:11px; color:var(--text3)">
                ${rdEsc(o.procedure_name)}</div>` : ''}</td>
            <td>${rdEsc(c.view_label || '—')}</td>
            <td style="text-align:right; font-size:12px">
              ${c.series_no ?? '—'}/${c.instance_no ?? '—'}</td>
            <td style="text-align:right; font-size:12px">
              ${c.width && c.height ? `${c.width}×${c.height}` : '—'}</td>
            <td style="font-size:11px; max-width:200px">${c.dicom_path
              ? rdEsc(c.dicom_path)
              : '<span style="color:var(--warning)">tidak tercatat</span>'}</td>
            <td>${c.preview_url || c.preview_path
              ? '<span style="color:var(--success)">ada</span>'
              : '<span style="color:var(--text3)">tidak ada</span>'}</td>
            <td style="font-size:12px">${rdEsc(c.uploaded_by || '—')}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}`;
}

// ── Tindakan ─────────────────────────────────────────────────────
async function rdModalitasBaru() {
  const code = prompt('Kode modalitas (mis. CR, CT, MR, US, MG):');
  if (!code) return;
  const name = prompt('Nama alat:');
  if (!name) return;
  const room = prompt('Ruangan:', '');
  if (room === null) return;
  const slot = prompt('Durasi slot (menit):', '15');
  if (slot === null) return;

  try {
    await sbPost('modalities', {
      code: code.trim().toUpperCase(), name: name.trim(),
      room: room || null, slot_minutes: parseInt(slot, 10) || null,
      is_active: true,
    });
    await renderRadMaster();
  } catch (e) { alert('Gagal menyimpan modalitas: ' + e.message); }
}

async function rdModalitasUbah(id) {
  const m = (rdData.modal || []).find(x => x.id === id) || {};
  const merk = prompt('Merk:', m.merk || '');
  if (merk === null) return;
  const model = prompt('Model:', m.model || '');
  if (model === null) return;
  const buka = prompt('Jam buka (HH:MM):', m.jam_buka || '');
  if (buka === null) return;
  const tutup = prompt('Jam tutup (HH:MM):', m.jam_tutup || '');
  if (tutup === null) return;
  const hari = prompt('Hari operasi (mis. Senin–Sabtu):', m.hari_operasi || '');
  if (hari === null) return;
  const kap = prompt('Kapasitas harian (jumlah pemeriksaan):', m.kapasitas_harian || '');
  if (kap === null) return;
  const kalTerakhir = prompt('Kalibrasi terakhir (YYYY-MM-DD):', m.kalibrasi_terakhir || '');
  if (kalTerakhir === null) return;
  const kalBerikut = prompt('Kalibrasi berikutnya (YYYY-MM-DD):', m.kalibrasi_berikut || '');
  if (kalBerikut === null) return;
  const izin = prompt('Nomor izin BAPETEN:', m.izin_bapeten || '');
  if (izin === null) return;
  const izinSampai = prompt('Izin berlaku sampai (YYYY-MM-DD):', m.izin_berlaku_sampai || '');
  if (izinSampai === null) return;

  try {
    await sbPatch('modalities', id, {
      merk: merk || null, model: model || null,
      jam_buka: buka || null, jam_tutup: tutup || null,
      hari_operasi: hari || null,
      kapasitas_harian: kap ? parseInt(kap, 10) : null,
      kalibrasi_terakhir: kalTerakhir || null,
      kalibrasi_berikut: kalBerikut || null,
      izin_bapeten: izin || null,
      izin_berlaku_sampai: izinSampai || null,
      updated_at: new Date().toISOString(),
    });
    await renderRadMaster();
  } catch (e) { alert('Gagal memperbarui: ' + e.message); }
}

async function rdKatalogBaru() {
  const M = rdData.modal || [];
  if (!M.length) { alert('Daftarkan modalitas lebih dulu.'); return; }

  const pilihan = M.map((m, i) => `${i + 1}. ${m.name || m.code} (${m.code})`).join('\n');
  const n = prompt(`Modalitas:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const m = M[parseInt(n, 10) - 1];
  if (!m) { alert('Nomor tidak dikenal.'); return; }

  const kode = prompt('Kode pemeriksaan:');
  if (!kode) return;
  const nama = prompt('Nama pemeriksaan:');
  if (!nama) return;
  const region = prompt('Region tubuh:', '');
  if (region === null) return;
  const posisi = prompt('Posisi (mis. PA, AP, Lateral):', '');
  if (posisi === null) return;
  const kontras = confirm('Pemeriksaan ini memakai kontras?\n\nOK = ya, Batal = tidak');
  let jenisKontras = '', persiapan = '';
  if (kontras) {
    jenisKontras = prompt('Jenis kontras:', '');
    if (jenisKontras === null) return;
  }
  persiapan = prompt('Persiapan pasien'
    + (kontras ? ' (wajib untuk pemeriksaan berkontras)' : '') + ':', '');
  if (persiapan === null) return;
  const kontra = prompt('Kontraindikasi:', '');
  if (kontra === null) return;
  const tarif = prompt('Tarif (Rp):', '0');
  if (tarif === null) return;
  const drl = prompt('Dosis acuan DRL (mSv, kosongkan bila belum ditetapkan):', '');
  if (drl === null) return;

  try {
    await sbPost('rad_katalog', {
      kode: kode.trim().toUpperCase(), nama: nama.trim(),
      modality_id: m.id, modality_code: m.code,
      region_tubuh: region || null, posisi: posisi || null,
      pakai_kontras: kontras, jenis_kontras: jenisKontras || null,
      persiapan: persiapan || null, kontraindikasi: kontra || null,
      tarif: parseFloat(tarif) || 0,
      drl_msv: drl ? parseFloat(drl) : null,
    });
    await renderRadMaster();
  } catch (e) { alert('Gagal menyimpan katalog: ' + e.message); }
}

async function rdUnggah() {
  const O = rdData.order || [];
  if (!O.length) { alert('Belum ada order radiologi yang bisa dilampiri citra.'); return; }

  const pilihan = O.slice(0, 20).map((o, i) =>
    `${i + 1}. ${o.accession_no || o.id} — ${o.patient_name || '?'} · ${o.procedure_name || ''}`
  ).join('\n');
  const n = prompt(`Order radiologi:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const o = O[parseInt(n, 10) - 1];
  if (!o) { alert('Nomor tidak dikenal.'); return; }

  const label = prompt('Label citra (mis. Thorax PA):', o.procedure_name || '');
  if (!label) return;
  const dicom = prompt('Path berkas DICOM di PACS:', '');
  if (dicom === null) return;
  const preview = prompt('URL/path berkas pratinjau (JPG/PNG):', '');
  if (preview === null) return;
  const seri = prompt('Nomor seri:', '1');
  if (seri === null) return;
  const instance = prompt('Nomor instance:', '1');
  if (instance === null) return;

  if (!dicom && !preview) {
    alert('Isi minimal salah satu: path DICOM atau berkas pratinjau. '
      + 'Catatan citra tanpa keduanya tidak menunjuk ke apa pun.');
    return;
  }

  try {
    await sbPost('radiology_images', {
      order_id: o.id, accession_no: o.accession_no,
      view_label: label.trim(),
      dicom_path: dicom || null,
      preview_path: preview || null,
      series_no: seri ? parseInt(seri, 10) : null,
      instance_no: instance ? parseInt(instance, 10) : null,
      uploaded_by: (window.currentUsername || null),
      updated_at: new Date().toISOString(),
    });
    await renderRadMaster();
  } catch (e) { alert('Gagal mencatat citra: ' + e.message); }
}

window.renderRadMaster   = renderRadMaster;
window.rdGantiTab        = rdGantiTab;
window.rdModalitasBaru   = rdModalitasBaru;
window.rdModalitasUbah   = rdModalitasUbah;
window.rdKatalogBaru     = rdKatalogBaru;
window.rdUnggah          = rdUnggah;
