// ═══════════════════════════════════════════════════════════════
// MODUL: Vaksinasi & Imunisasi
//
// Membaca migrasi 0042.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Batch yang tidak layak — kedaluwarsa, VVM tingkat C/D, atau sudah
// dibuang — TIDAK muncul di daftar pilihan saat menyuntik. Bukan muncul
// dengan tanda peringatan: petugas imunisasi bekerja cepat, dan pilihan
// yang ada di daftar akan terpilih.
//
// Layar tetap menampilkan batch bermasalah di tabnya sendiri, karena
// yang harus dilakukan padanya bukan "abaikan" melainkan "buang dan
// catat".
//
// Riwayat dosis pasien ditarik saat memilih pasien, sehingga petugas
// melihat "ini dosis ke-2 dari 3" sebelum menyuntik — bukan sesudah.
//
// KIPI punya tombolnya sendiri di tiap baris. Kejadian ikutan yang
// dicatat di kolom catatan bebas akan tenggelam dan tidak pernah
// dilaporkan.
//
// Prefiks "im".
// ═══════════════════════════════════════════════════════════════

let imData = null;
let imTab = 'pemberian';

function imEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function imTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}
function imJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function imMuat() {
  if (typeof sbGet !== 'function') { imData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [papan, vaksin, batch, tempo, kipi] = await Promise.all([
      sbGet('imunisasi_papan', 'select=*&order=tgl_beri.desc&limit=300'),
      sbGet('vaksin', 'select=*&order=nama'),
      sbGet('vaksin_batch_perhatian', 'select=*&order=tgl_kedaluwarsa'),
      aman('imunisasi_jatuh_tempo', 'select=*'),
      aman('imunisasi_kipi', 'select=*&order=id.desc&limit=200'),
    ]);
    imData = { papan, vaksin, batch, tempo, kipi };
  } catch (e) { imData = null; }
}

async function renderImunisasi() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await imMuat();

  if (imData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Vaksinasi &amp; Imunisasi</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data imunisasi tidak dapat dibaca.</strong><br>
        Tabel <code>vaksin</code> belum ada — jalankan ulang aplikasi agar
        migrasi <code>0042_imunisasi.sql</code> terpasang.
      </div>`;
    return;
  }
  imGambar();
}

// Hanya batch yang benar-benar boleh dipakai.
function imBatchLayak() {
  return (imData.batch || []).filter(b => b.perhatian === 'Layak'
    || b.perhatian === 'Segera kedaluwarsa').filter(b => Number(b.qty_sisa) > 0);
}

function imGambar() {
  const P = imData.papan || [];
  const B = imData.batch || [];
  const T = (imData.tempo || []).filter(x => Number(x.telat_hari) >= 0);
  const telat = T.filter(x => Number(x.telat_hari) > 0);
  const bermasalah = B.filter(b => b.perhatian !== 'Layak' && b.perhatian !== 'Segera kedaluwarsa');
  const segera = B.filter(b => b.perhatian === 'Segera kedaluwarsa');
  const kipiBerat = (imData.kipi || []).filter(k => k.derajat === 'Berat' || k.dirawat);

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Vaksinasi &amp; Imunisasi</h1>
        <p class="muted">Pemberian, stok batch, rantai dingin, dan kejadian ikutan.</p>
      </div>
      ${imBatchLayak().length
        ? `<div><button class="btn btn-primary" onclick="imBeri()">+ Beri Imunisasi</button></div>`
        : ''}
    </div>

    ${bermasalah.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${bermasalah.length} batch tidak layak pakai</b> — kedaluwarsa,
        VVM sudah bergerak, atau sudah ditarik. Batch ini tidak muncul di
        pilihan saat menyuntik, tapi tetap harus dibuang dan dicatat.
      </div>` : ''}
    ${kipiBerat.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${kipiBerat.length} KIPI berat atau memerlukan perawatan.</b>
        Wajib dilaporkan ke Komda/Komnas PP-KIPI.
      </div>` : ''}
    ${telat.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${telat.length} pasien lewat jadwal dosis berikutnya.</b>
        Seri yang terputus terlalu lama sering harus diulang.
      </div>` : ''}

    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
                gap:12px; margin-bottom:16px">
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Pemberian tercatat</div>
        <div style="font-size:22px; font-weight:800">${P.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Batch layak</div>
        <div style="font-size:22px; font-weight:800; color:var(--success)">
          ${imBatchLayak().length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Segera kedaluwarsa</div>
        <div style="font-size:22px; font-weight:800;
                    color:${segera.length ? 'var(--warning)' : 'var(--text3)'}">
          ${segera.length}</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Jadwal jatuh tempo</div>
        <div style="font-size:22px; font-weight:800;
                    color:${T.length ? 'var(--warning)' : 'var(--text3)'}">${T.length}</div>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${imTab === 'pemberian' ? 'active' : ''}"
              onclick="imGantiTab('pemberian')">Pemberian (${P.length})</button>
      <button class="tab ${imTab === 'jadwal' ? 'active' : ''}"
              onclick="imGantiTab('jadwal')">Jadwal Jatuh Tempo (${T.length})</button>
      <button class="tab ${imTab === 'batch' ? 'active' : ''}"
              onclick="imGantiTab('batch')">Stok &amp; Rantai Dingin (${B.length})</button>
      <button class="tab ${imTab === 'vaksin' ? 'active' : ''}"
              onclick="imGantiTab('vaksin')">Master Vaksin</button>
    </div>

    ${imTab === 'pemberian' ? imTabPemberian(P)
    : imTab === 'jadwal'    ? imTabJadwal(T)
    : imTab === 'batch'     ? imTabBatch(B) : imTabVaksin()}`;
}

function imGantiTab(t) { imTab = t; imGambar(); }

function imTabPemberian(P) {
  if (!P.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">💉</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada pemberian tercatat</div>
      <div style="font-size:13px; color:var(--text3)">
        ${(imData.vaksin || []).length
          ? 'Catat pemberian lewat tombol Beri Imunisasi.'
          : 'Isi master vaksin dan batch-nya lebih dulu.'}</div>
    </div>`;
  }

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>No.</th><th>Pasien</th><th>Vaksin</th>
      <th style="text-align:right">Dosis</th><th>Batch</th>
      <th>Diberikan</th><th>Penyuntik</th><th>Dosis Berikutnya</th>
      <th>KIPI</th><th></th>
    </tr></thead><tbody>
    ${P.map(i => `<tr style="${Number(i.jml_kipi) ? 'background:rgba(255,180,0,.05)' : ''}">
      <td><b>${imEsc(i.no_imunisasi)}</b></td>
      <td>${imEsc(i.patient_name)}
        ${i.mr_number ? `<div style="font-size:11px; color:var(--text3)">
          ${imEsc(i.mr_number)}</div>` : ''}</td>
      <td>${imEsc(i.nama_vaksin || '—')}
        ${i.penyakit ? `<div style="font-size:11px; color:var(--text3)">
          ${imEsc(i.penyakit)}</div>` : ''}</td>
      <td style="text-align:right">${i.dosis_ke}/${i.total_dosis || '?'}
        ${i.seri_lengkap ? `<div style="font-size:11px; color:var(--success)">
          lengkap</div>` : ''}</td>
      <td style="font-size:12px">${imEsc(i.no_batch || '—')}</td>
      <td style="white-space:nowrap">${imJam(i.tgl_beri)}</td>
      <td style="font-size:12px">${imEsc(i.penyuntik || '—')}</td>
      <td>${i.tgl_dosis_berikut
        ? imTgl(i.tgl_dosis_berikut)
          + (Number(i.hari_ke_dosis_berikut) < 0
              ? `<div style="font-size:11px; color:var(--danger)">
                   telat ${Math.abs(i.hari_ke_dosis_berikut)} hari</div>` : '')
        : '<span style="color:var(--text3)">—</span>'}</td>
      <td>${Number(i.jml_kipi)
        ? `<span style="color:var(--warning); font-weight:700">${i.jml_kipi}</span>`
        : '—'}</td>
      <td><button class="btn btn-sm" onclick="imCatatKipi(${i.id})">+ KIPI</button></td>
    </tr>`).join('')}
    </tbody></table>
  </div>`;
}

function imTabJadwal(T) {
  if (!T.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🗓️</div>
      <div style="font-weight:700">Tidak ada dosis yang jatuh tempo</div>
    </div>`;
  }

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Daftar ini dihitung dari catatan terakhir tiap pasien per vaksin —
      bukan disimpan sebagai daftar terpisah yang harus dijaga tetap
      sinkron. Pasien yang serinya sudah lengkap tidak muncul di sini.
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Pasien</th><th>Vaksin</th>
        <th style="text-align:right">Dosis Terakhir</th>
        <th>Tanggal Terakhir</th><th>Jatuh Tempo</th>
        <th style="text-align:right">Telat</th>
      </tr></thead><tbody>
      ${T.sort((a, b) => Number(b.telat_hari) - Number(a.telat_hari)).map(t => `<tr>
        <td><b>${imEsc(t.patient_name)}</b>
          ${t.mr_number ? `<div style="font-size:11px; color:var(--text3)">
            ${imEsc(t.mr_number)}</div>` : ''}</td>
        <td>${imEsc(t.nama_vaksin || '—')}</td>
        <td style="text-align:right">${t.dosis_terakhir}/${t.total_dosis || '?'}</td>
        <td>${imTgl(t.tgl_dosis_terakhir)}</td>
        <td>${imTgl(t.tgl_dosis_berikut)}</td>
        <td style="text-align:right; font-weight:${Number(t.telat_hari) > 0 ? '700' : '400'};
                   color:${Number(t.telat_hari) > 0 ? 'var(--danger)' : 'inherit'}">
          ${Number(t.telat_hari) > 0 ? t.telat_hari + ' hari' : 'belum'}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

function imTabBatch(B) {
  if (!B.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🧊</div>
      <div style="font-weight:700; margin-bottom:6px">Belum ada batch vaksin</div>
      <div style="font-size:13px; color:var(--text3); max-width:480px; margin:0 auto 14px">
        Catat batch beserta tanggal kedaluwarsa dan penanda VVM-nya.</div>
      ${(imData.vaksin || []).length
        ? `<button class="btn btn-primary" onclick="imBatchBaru()">+ Terima Batch</button>` : ''}
    </div>`;
  }

  const warna = {
    'Layak': 'var(--success)', 'Segera kedaluwarsa': 'var(--warning)',
    'Kedaluwarsa': 'var(--danger)', 'VVM tidak layak': 'var(--danger)',
    'Dibuang': 'var(--text3)', 'Ditarik': 'var(--danger)',
  };

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="imBatchBaru()">+ Terima Batch</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Vaksin</th><th>No. Batch</th><th>Kedaluwarsa</th>
        <th style="text-align:right">Sisa Hari</th>
        <th style="text-align:right">Sisa Dosis</th>
        <th>VVM</th><th>Suhu Terakhir</th><th>Keadaan</th><th></th>
      </tr></thead><tbody>
      ${B.map(b => `<tr style="${['Kedaluwarsa','VVM tidak layak'].includes(b.perhatian)
        ? 'background:rgba(255,0,0,.04)' : ''}">
        <td>${imEsc(b.nama_vaksin || '—')}</td>
        <td><b>${imEsc(b.no_batch)}</b></td>
        <td>${imTgl(b.tgl_kedaluwarsa)}</td>
        <td style="text-align:right; color:${Number(b.sisa_hari) < 0
          ? 'var(--danger)' : Number(b.sisa_hari) <= 30 ? 'var(--warning)' : 'inherit'}">
          ${b.sisa_hari == null ? '—'
            : Number(b.sisa_hari) < 0 ? 'lewat ' + Math.abs(b.sisa_hari)
            : b.sisa_hari}</td>
        <td style="text-align:right">${Number(b.qty_sisa || 0)}</td>
        <td><b style="color:${['C','D'].includes(String(b.vvm || '').toUpperCase())
          ? 'var(--danger)' : 'var(--success)'}">${imEsc(b.vvm || '—')}</b></td>
        <td style="font-size:12px">${b.suhu_terakhir != null
          ? b.suhu_terakhir + '°C' : '<span style="color:var(--text3)">belum dicek</span>'}
          ${b.suhu_dicek_at ? `<div style="font-size:11px; color:var(--text3)">
            ${imJam(b.suhu_dicek_at)}</div>` : ''}</td>
        <td><span style="font-weight:600; color:${warna[b.perhatian] || 'var(--text3)'}">
          ${imEsc(b.perhatian)}</span></td>
        <td style="white-space:nowrap">
          ${b.status === 'Aktif' ? `
            <button class="btn btn-sm" onclick="imCekSuhu(${b.id})">Catat Suhu/VVM</button>
            <button class="btn btn-sm" onclick="imBuang(${b.id})">Buang</button>` : ''}
        </td>
      </tr>`).join('')}
      </tbody></table>
    </div>

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      VVM (Vaccine Vial Monitor) adalah penanda pada botol yang berubah
      warna bila vaksin terpapar panas. Tingkat <b>A</b> dan <b>B</b> masih
      boleh dipakai; <b>C</b> dan <b>D</b> berarti vaksin sudah kehilangan
      potensinya dan harus dibuang. Vaksin yang rusak karena panas terlihat
      sama persis dengan yang masih baik — penanda inilah satu-satunya
      pembedanya.
    </div>`;
}

function imTabVaksin() {
  const V = imData.vaksin || [];
  if (!V.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🧬</div>
      <div style="font-weight:700; margin-bottom:6px">Master vaksin masih kosong</div>
      <div style="font-size:13px; color:var(--text3); max-width:520px; margin:0 auto 14px;
                  line-height:1.8">
        Jadwal imunisasi nasional sengaja tidak ditanam sebagai data bawaan:
        ia berubah, berbeda antar program, dan berbeda untuk pasien dengan
        kondisi khusus. Jumlah dosis dan interval minimalnya ditetapkan
        penanggung jawab program, dan tercatat siapa yang menetapkan.
      </div>
      <button class="btn btn-primary" onclick="imVaksinBaru()">+ Tambah Vaksin</button>
    </div>`;
  }

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="imVaksinBaru()">+ Vaksin</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Kode</th><th>Nama</th><th>Mencegah</th><th>Rute</th>
        <th style="text-align:right">Total Dosis</th>
        <th style="text-align:right">Interval Min.</th>
        <th>Kontraindikasi</th><th>Ditetapkan</th>
      </tr></thead><tbody>
      ${V.map(v => `<tr>
        <td><b>${imEsc(v.kode)}</b></td>
        <td>${imEsc(v.nama)}
          ${v.nama_dagang ? `<div style="font-size:11px; color:var(--text3)">
            ${imEsc(v.nama_dagang)}</div>` : ''}</td>
        <td>${imEsc(v.penyakit || '—')}</td>
        <td>${imEsc(v.rute || '—')}</td>
        <td style="text-align:right">${v.total_dosis || 1}</td>
        <td style="text-align:right">${v.interval_min_hari
          ? v.interval_min_hari + ' hari'
          : '<span style="color:var(--warning)">belum diisi</span>'}</td>
        <td style="font-size:12px; max-width:200px">${imEsc(v.kontraindikasi || '—')}</td>
        <td style="font-size:12px">${imEsc(v.ditetapkan_oleh || '—')}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

// ── Tindakan ─────────────────────────────────────────────────────
async function imBeri() {
  const B = imBatchLayak();
  if (!B.length) {
    alert('Tidak ada batch vaksin yang layak dipakai.');
    return;
  }

  const pasien = prompt('Nama pasien:');
  if (!pasien) return;
  const mr = prompt('No. rekam medis (kosongkan bila belum ada):', '');
  if (mr === null) return;

  // Riwayat ditarik SEBELUM menyuntik supaya petugas tahu ini dosis ke
  // berapa — bukan setelah.
  let riwayat = [];
  try {
    const q = mr
      ? `select=*&mr_number=eq.${encodeURIComponent(mr)}&order=tgl_beri`
      : `select=*&patient_name=eq.${encodeURIComponent(pasien)}&order=tgl_beri`;
    riwayat = await sbGet('imunisasi_papan', q);
  } catch (_) {}

  const ringkas = riwayat.length
    ? '\n\nRiwayat:\n' + riwayat.map(r =>
        `• ${r.nama_vaksin} dosis ${r.dosis_ke}/${r.total_dosis || '?'} — `
        + new Date(r.tgl_beri).toLocaleDateString('id-ID')).join('\n')
    : '\n\n(belum ada riwayat imunisasi tercatat)';

  const pilihan = B.map((b, i) =>
    `${i + 1}. ${b.nama_vaksin} — batch ${b.no_batch}, sisa ${b.qty_sisa}, `
    + `exp ${b.tgl_kedaluwarsa || '?'}, VVM ${b.vvm}`).join('\n');
  const n = prompt(`${pasien}${ringkas}\n\nPilih vaksin & batch:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const b = B[parseInt(n, 10) - 1];
  if (!b) { alert('Nomor tidak dikenal.'); return; }

  const penyuntik = prompt('Penyuntik:', window.currentUsername || '');
  if (!penyuntik) return;
  const lokasi = prompt('Lokasi suntik:', '');
  if (lokasi === null) return;

  try {
    // Memakai pembungkus yang menagih: pemberiannya tetap dikerjakan
    // fungsi asli dengan seluruh penjagaan rantai dingin dan
    // intervalnya, lalu biayanya diposting bila berhasil.
    const r = await sbRpc('imunisasi_beri_dan_tagih', {
      p_data: {
        batch_id: String(b.id), patient_name: pasien,
        mr_number: mr || null, penyuntik, lokasi_suntik: lokasi || null,
      },
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`${r.no_imunisasi}\n\n${r.vaksin} dosis ${r.dosis_ke} dari ${r.total_dosis}\n`
      + `Batch ${r.no_batch}\n`
      + (r.seri_lengkap
          ? '\nSeri sudah lengkap.'
          : r.dosis_berikut ? `\nDosis berikutnya: ${r.dosis_berikut}` : ''));
    await renderImunisasi();
  } catch (e) { alert('Gagal mencatat imunisasi: ' + e.message); }
}

async function imCekSuhu(batchId) {
  const suhu = prompt('Suhu penyimpanan terbaca (°C):');
  if (suhu === null) return;
  const vvm = prompt('Tingkat VVM pada botol (A / B / C / D):', 'A');
  if (!vvm) return;

  try {
    await sbPatch('vaksin_batch', batchId, {
      suhu_terakhir: suhu ? parseFloat(suhu) : null,
      suhu_dicek_at: new Date().toISOString(),
      vvm: vvm.trim().toUpperCase(),
      updated_at: new Date().toISOString(),
    });
    if (['C', 'D'].includes(vvm.trim().toUpperCase())) {
      alert('VVM tingkat ' + vvm.trim().toUpperCase()
        + ' — batch ini tidak lagi muncul di pilihan penyuntikan. '
        + 'Buang dan catat pembuangannya.');
    }
    await renderImunisasi();
  } catch (e) { alert('Gagal mencatat: ' + e.message); }
}

async function imBuang(batchId) {
  const alasan = prompt('Alasan pembuangan (wajib):');
  if (!alasan) return;
  if (!confirm('Pembuangan tidak bisa dibatalkan. Lanjutkan?')) return;
  try {
    const r = await sbRpc('vaksin_batch_buang', {
      p_batch_id: batchId, p_alasan: alasan,
      p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Batch ${r.no_batch} dibuang. ${r.sisa_dibuang} dosis ikut dinolkan.`);
    await renderImunisasi();
  } catch (e) { alert('Gagal mencatat pembuangan: ' + e.message); }
}

async function imCatatKipi(imunisasiId) {
  const gejala = prompt('Gejala yang dialami (wajib):');
  if (!gejala) return;
  const derajat = prompt('Derajat (Ringan / Sedang / Berat):', 'Ringan');
  if (!derajat) return;
  const tindakan = prompt('Tindakan yang diberikan:', '');
  if (tindakan === null) return;
  const dirawat = confirm('Pasien perlu dirawat?\n\nOK = ya, Batal = tidak');

  try {
    await sbPost('imunisasi_kipi', {
      imunisasi_id: imunisasiId, gejala: gejala.trim(),
      derajat: derajat.trim(), tindakan: tindakan || null,
      dirawat: dirawat, mulai_at: new Date().toISOString(),
      dicatat_oleh: (window.currentUsername || null),
    });
    if (derajat.trim().toLowerCase() === 'berat' || dirawat) {
      alert('KIPI berat tercatat. Wajib dilaporkan ke Komda/Komnas PP-KIPI.');
    }
    await renderImunisasi();
  } catch (e) { alert('Gagal mencatat KIPI: ' + e.message); }
}

async function imVaksinBaru() {
  const kode = prompt('Kode vaksin:');
  if (!kode) return;
  const nama = prompt('Nama vaksin:');
  if (!nama) return;
  const penyakit = prompt('Penyakit yang dicegah:', '');
  if (penyakit === null) return;
  const rute = prompt('Rute pemberian (IM / SC / ID / Oral):', 'IM');
  if (rute === null) return;
  const total = prompt('Jumlah dosis untuk seri lengkap:', '1');
  if (total === null) return;
  const interval = prompt('Interval minimal antar dosis (hari, kosongkan bila dosis tunggal):', '');
  if (interval === null) return;
  const kontra = prompt('Kontraindikasi:', '');
  if (kontra === null) return;

  try {
    await sbPost('vaksin', {
      kode: kode.trim().toUpperCase(), nama: nama.trim(),
      penyakit: penyakit || null, rute: rute || null,
      total_dosis: parseInt(total, 10) || 1,
      interval_min_hari: interval ? parseInt(interval, 10) : null,
      kontraindikasi: kontra || null,
      ditetapkan_oleh: (window.currentUsername || null),
    });
    await renderImunisasi();
  } catch (e) { alert('Gagal menyimpan vaksin: ' + e.message); }
}

async function imBatchBaru() {
  const V = imData.vaksin || [];
  const pilihan = V.map((v, i) => `${i + 1}. ${v.nama}`).join('\n');
  const n = prompt(`Vaksin:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const v = V[parseInt(n, 10) - 1];
  if (!v) { alert('Nomor tidak dikenal.'); return; }

  const batch = prompt('Nomor batch/lot:');
  if (!batch) return;
  const exp = prompt('Tanggal kedaluwarsa (YYYY-MM-DD):');
  if (!exp) return;
  const qty = prompt('Jumlah dosis diterima:');
  if (!qty) return;
  const vvm = prompt('Tingkat VVM saat diterima (A / B / C / D):', 'A');
  if (!vvm) return;

  try {
    await sbPost('vaksin_batch', {
      vaksin_id: v.id, no_batch: batch.trim(),
      tgl_kedaluwarsa: exp, qty_terima: parseFloat(qty) || 0,
      qty_sisa: parseFloat(qty) || 0, vvm: vvm.trim().toUpperCase(),
    });
    await renderImunisasi();
  } catch (e) { alert('Gagal menyimpan batch: ' + e.message); }
}

window.renderImunisasi = renderImunisasi;
window.imGantiTab   = imGantiTab;
window.imBeri       = imBeri;
window.imCekSuhu    = imCekSuhu;
window.imBuang      = imBuang;
window.imCatatKipi  = imCatatKipi;
window.imVaksinBaru = imVaksinBaru;
window.imBatchBaru  = imBatchBaru;
