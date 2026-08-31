// ═══════════════════════════════════════════════════════════════
// MODUL: Insiden Keselamatan Pasien & Indikator Mutu
//
// Membaca migrasi 0045.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Tombol lapor ada di paling atas dan tidak menuntut nama. Sistem
// pelaporan insiden yang meminta identitas menerima sedikit laporan,
// dan yang masuk hanya insiden yang sudah telanjur ketahuan orang lain.
// Yang paling berharga justru nyaris-cedera yang hanya diketahui
// pelakunya sendiri.
//
// Band risiko tidak bisa dipilih dari layar — ia dihitung dari dampak ×
// peluang di basis data. Menurunkan band agar tidak perlu RCA adalah
// cara paling umum program keselamatan kehilangan gunanya.
//
// Insiden yang lewat batas investigasi ditampilkan menyala dan tidak
// bisa disaring hilang.
//
// Indikator yang tidak mencapai target dan belum punya rencana
// perbaikan ditandai — kewajiban yang tak terlihat adalah kewajiban
// yang terlewat.
//
// Prefiks "kp".
// ═══════════════════════════════════════════════════════════════

let kpData = null;
let kpTab = 'insiden';
let kpFilter = 'semua';
let kpPilih = null;

function kpEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function kpTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}
function kpJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const KP_WARNA = {
  'Merah': 'var(--danger)', 'Kuning': 'var(--warning)',
  'Hijau': 'var(--success)', 'Biru': 'var(--info)',
};

async function kpMuat() {
  if (typeof sbGet !== 'function') { kpData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [papan, investigasi, tindakan, indikator, capaian] = await Promise.all([
      sbGet('ikp_papan', 'select=*&order=tgl_kejadian.desc&limit=300'),
      aman('ikp_investigasi', 'select=*&order=id.desc&limit=300'),
      aman('ikp_tindakan', 'select=*&order=id.desc&limit=400'),
      aman('mutu_indikator', 'select=*&order=kode'),
      aman('mutu_papan', 'select=*&order=periode.desc&limit=300'),
    ]);
    kpData = { papan, investigasi, tindakan, indikator, capaian };
  } catch (e) { kpData = null; }
}

async function renderIkp(params) {
  if (params && params.tab) kpTab = params.tab;
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await kpMuat();

  if (kpData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Keselamatan Pasien</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data keselamatan pasien tidak dapat dibaca.</strong><br>
        Tabel <code>ikp</code> belum ada — jalankan ulang aplikasi agar migrasi
        <code>0045_insiden_keselamatan_pasien.sql</code> terpasang.
      </div>`;
    return;
  }
  kpGambar();
}

function kpGambar() {
  const P = kpData.papan || [];
  const belumGrading = P.filter(x => !x.band);
  const lewat = P.filter(x => x.lewat_batas);
  const rcaBelum = P.filter(x => x.wajib_rca && x.status !== 'Ditutup');
  const terbuka = P.filter(x => x.status !== 'Ditutup');

  const daftar = kpFilter === 'terbuka' ? terbuka
               : kpFilter === 'grading' ? belumGrading
               : kpFilter === 'lewat' ? lewat
               : kpFilter === 'rca' ? rcaBelum : P;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Keselamatan Pasien</h1>
        <p class="muted">Pelaporan insiden, investigasi, tindakan perbaikan, dan indikator mutu.</p>
      </div>
      <div><button class="btn btn-primary" onclick="kpLapor()">Laporkan Insiden</button></div>
    </div>

    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Pelaporan <b>boleh tanpa nama</b>. Insiden yang paling berharga untuk
      dipelajari justru nyaris-cedera yang hanya diketahui pelakunya sendiri,
      dan tidak ada yang melaporkan dirinya ke sistem yang mencatat namanya.
    </div>

    ${lewat.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${lewat.length} insiden lewat batas investigasi.</b>
        Ingatan orang tentang urutan kejadian memudar cepat.
      </div>` : ''}
    ${belumGrading.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${belumGrading.length} insiden belum digrading.</b>
        Tanpa band risiko, tidak ada yang tahu mana yang perlu RCA.
      </div>` : ''}

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${kpTab === 'insiden' ? 'active' : ''}"
              onclick="kpGantiTab('insiden')">Insiden (${P.length})</button>
      <button class="tab ${kpTab === 'mutu' ? 'active' : ''}"
              onclick="kpGantiTab('mutu')">Indikator Mutu</button>
    </div>

    ${kpTab === 'insiden' ? kpTabInsiden(P, daftar, terbuka, belumGrading, lewat, rcaBelum)
                          : kpTabMutu()}

    ${kpPilih ? kpPanel() : ''}`;
}

function kpGantiTab(t) { kpTab = t; kpPilih = null; kpGambar(); }
function kpSaring(k) { kpFilter = k; kpGambar(); }

function kpKartu(label, n, kunci, warna) {
  return `<div class="card" style="padding:14px; cursor:pointer;
            ${kpFilter === kunci ? 'outline:2px solid var(--primary)' : ''}"
            onclick="kpSaring('${kunci}')">
    <div style="font-size:12px; color:var(--text3)">${label}</div>
    <div style="font-size:22px; font-weight:800; color:${warna}">${n}</div>
  </div>`;
}

function kpTabInsiden(P, daftar, terbuka, belumGrading, lewat, rcaBelum) {
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
                gap:12px; margin-bottom:16px">
      ${kpKartu('Semua insiden', P.length, 'semua', 'var(--text)')}
      ${kpKartu('Belum ditutup', terbuka.length, 'terbuka', 'var(--info)')}
      ${kpKartu('Belum digrading', belumGrading.length, 'grading',
                belumGrading.length ? 'var(--warning)' : 'var(--text3)')}
      ${kpKartu('Lewat batas', lewat.length, 'lewat',
                lewat.length ? 'var(--danger)' : 'var(--text3)')}
      ${kpKartu('Wajib RCA', rcaBelum.length, 'rca',
                rcaBelum.length ? 'var(--danger)' : 'var(--text3)')}
    </div>

    ${!daftar.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🛟</div>
        <div style="font-weight:700; margin-bottom:4px">
          ${kpFilter === 'semua' ? 'Belum ada insiden dilaporkan'
                                 : 'Tidak ada insiden pada kelompok ini'}</div>
        <div style="font-size:13px; color:var(--text3); max-width:480px; margin:0 auto">
          Nol laporan hampir selalu berarti sistem pelaporannya yang belum
          dipercaya, bukan tidak ada insiden.</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>No.</th><th>Jenis</th><th>Kejadian</th><th>Lokasi</th>
          <th>Pasien</th><th>Band</th><th>Investigasi</th>
          <th style="text-align:right">CAPA</th><th>Status</th><th></th>
        </tr></thead><tbody>
        ${daftar.map(i => `<tr style="${i.lewat_batas ? 'background:rgba(255,0,0,.04)' : ''}">
          <td><b>${kpEsc(i.no_ikp)}</b>
            ${i.anonim ? `<div style="font-size:11px; color:var(--text3)">anonim</div>` : ''}</td>
          <td>${kpEsc(i.jenis)}</td>
          <td style="white-space:nowrap">${kpJam(i.tgl_kejadian)}</td>
          <td style="font-size:12px">${kpEsc(i.lokasi || '—')}</td>
          <td>${kpEsc(i.patient_name || '—')}</td>
          <td>${i.band
            ? `<span style="font-weight:800; color:${KP_WARNA[i.band] || 'var(--text3)'}">
                 ${kpEsc(i.band)}</span>
               <div style="font-size:11px; color:var(--text3)">
                 ${i.dampak}×${i.peluang}</div>`
            : '<span style="color:var(--warning)">belum</span>'}</td>
          <td style="font-size:12px">${i.metode_investigasi
            ? kpEsc(i.metode_investigasi)
              + (i.wajib_rca && i.metode_investigasi !== 'RCA'
                  ? '<div style="font-size:11px; color:var(--danger)">wajib RCA</div>' : '')
            : '<span style="color:var(--text3)">belum</span>'}</td>
          <td style="text-align:right">${Number(i.jml_capa || 0)}
            ${Number(i.capa_belum) ? `<div style="font-size:11px; color:var(--warning)">
              ${i.capa_belum} belum</div>` : ''}</td>
          <td>${kpEsc(i.status)}
            ${i.lewat_batas ? `<div style="font-size:11px; color:var(--danger)">
              lewat batas</div>` : ''}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm" onclick="kpBuka(${i.id})">Rincian</button>
            ${!i.band ? `<button class="btn btn-sm btn-primary" onclick="kpGrading(${i.id})">
              Grading</button>` : ''}
          </td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}`;
}

function kpPanel() {
  const i = (kpData.papan || []).find(x => x.id === kpPilih);
  if (!i) return '';
  const inv = (kpData.investigasi || []).filter(v => v.ikp_id === kpPilih);
  const capa = (kpData.tindakan || []).filter(t => t.ikp_id === kpPilih);

  return `
    <div class="card" style="padding:18px; margin-top:16px;
                             border-left:3px solid ${KP_WARNA[i.band] || 'var(--border)'}">
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px">
        <div>
          <div style="font-weight:800; font-size:15px">${kpEsc(i.no_ikp)} — ${kpEsc(i.jenis)}</div>
          <div style="font-size:12px; color:var(--text3)">
            ${kpJam(i.tgl_kejadian)}${i.lokasi ? ' · ' + kpEsc(i.lokasi) : ''}
            ${i.unit_terkait ? ' · ' + kpEsc(i.unit_terkait) : ''}</div>
        </div>
        <button class="btn btn-sm" onclick="kpTutupPanel()">Tutup</button>
      </div>

      <div style="margin-top:14px; font-size:13px; line-height:1.8">
        <b>Kronologi</b><br>${kpEsc(i.kronologi)}<br><br>
        ${i.tindakan_segera ? `<b>Tindakan segera</b><br>${kpEsc(i.tindakan_segera)}<br><br>` : ''}
        Pelapor: ${i.anonim ? '<i>anonim</i>' : kpEsc(i.pelapor_nama || '—')}
        ${i.pelapor_unit ? ' · ' + kpEsc(i.pelapor_unit) : ''}
      </div>

      <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border)">
        <div style="display:flex; justify-content:space-between; align-items:center;
                    margin-bottom:8px">
          <b style="font-size:13px">Investigasi</b>
          ${!inv.length && i.band
            ? `<button class="btn btn-sm btn-primary" onclick="kpInvestigasi(${i.id})">
                 + Investigasi${i.wajib_rca ? ' (RCA wajib)' : ''}</button>` : ''}
        </div>
        ${!inv.length
          ? `<div style="font-size:12px; color:var(--text3)">
               Belum ada. Insiden tidak boleh ditutup tanpa dicari sebabnya —
               kalau ditutup begitu saja, ia akan terulang.</div>`
          : inv.map(v => `<div style="font-size:13px; line-height:1.8; margin-bottom:8px">
              Metode: <b>${kpEsc(v.metode || '—')}</b>
              ${v.tim ? ' · tim ' + kpEsc(v.tim) : ''}<br>
              <b>Akar masalah:</b> ${kpEsc(v.akar_masalah || '—')}<br>
              ${v.faktor_kontribusi ? `Faktor kontribusi: ${kpEsc(v.faktor_kontribusi)}<br>` : ''}
              ${v.kesimpulan ? `Kesimpulan: ${kpEsc(v.kesimpulan)}` : ''}
            </div>`).join('')}
      </div>

      <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border)">
        <div style="display:flex; justify-content:space-between; align-items:center;
                    margin-bottom:8px">
          <b style="font-size:13px">Tindakan Perbaikan</b>
          <button class="btn btn-sm" onclick="kpCapa(${i.id})">+ Tindakan</button>
        </div>
        ${!capa.length
          ? `<div style="font-size:12px; color:var(--text3)">
               Belum ada. Investigasi tanpa tindakan hanya menghasilkan berkas.</div>`
          : `<table class="data-table"><thead><tr>
              <th>Jenis</th><th>Uraian</th><th>PJ</th><th>Batas</th><th>Selesai</th><th></th>
            </tr></thead><tbody>
            ${capa.map(t => `<tr>
              <td>${kpEsc(t.jenis || '—')}</td>
              <td>${kpEsc(t.uraian)}</td>
              <td style="font-size:12px">${kpEsc(t.penanggung_jawab || '—')}</td>
              <td>${kpTgl(t.batas_waktu)}</td>
              <td>${t.selesai_at
                ? kpTgl(t.selesai_at)
                : '<span style="color:var(--warning)">belum</span>'}</td>
              <td>${!t.selesai_at
                ? `<button class="btn btn-sm" onclick="kpCapaSelesai(${t.id})">
                     Tandai Selesai</button>` : ''}</td>
            </tr>`).join('')}
            </tbody></table>`}
      </div>

      ${i.status !== 'Ditutup' ? `
        <div style="margin-top:14px">
          <button class="btn btn-primary" onclick="kpTutupInsiden(${i.id})">
            Tutup Insiden</button>
          <span style="font-size:12px; color:var(--text3); margin-left:8px">
            Menuntut investigasi, akar masalah, dan seluruh tindakan selesai.</span>
        </div>` : ''}
    </div>`;
}

function kpBuka(id) { kpPilih = (kpPilih === id) ? null : id; kpGambar(); }
function kpTutupPanel() { kpPilih = null; kpGambar(); }

// ── Tindakan ─────────────────────────────────────────────────────
async function kpLapor() {
  const jenis = prompt('Jenis insiden:\n\n'
    + 'KPC  — kondisi berpotensi cedera (belum terjadi)\n'
    + 'KNC  — nyaris cedera (tidak sampai ke pasien)\n'
    + 'KTC  — sampai ke pasien, tidak mencederai\n'
    + 'KTD  — mencederai pasien\n'
    + 'Sentinel — kematian / cedera permanen\n\nKetik salah satu:');
  if (!jenis) return;

  const tgl = prompt('Kapan kejadiannya? (YYYY-MM-DD HH:MM)',
    new Date().toISOString().slice(0, 16).replace('T', ' '));
  if (!tgl) return;
  const kronologi = prompt('Kronologi kejadian (wajib) — urutan apa yang terjadi:');
  if (!kronologi) return;
  const lokasi = prompt('Lokasi kejadian:', '');
  if (lokasi === null) return;
  const segera = prompt('Tindakan yang sudah dilakukan segera:', '');
  if (segera === null) return;
  const pasien = prompt('Nama pasien (kosongkan bila tidak menyangkut pasien tertentu):', '');
  if (pasien === null) return;

  const pakaiNama = confirm('Cantumkan nama Anda sebagai pelapor?\n\n'
    + 'OK   = cantumkan nama\n'
    + 'Batal = laporkan tanpa nama\n\n'
    + 'Laporan tanpa nama sama sahnya. Konsekuensinya hanya satu: '
    + 'tim mutu tidak bisa menanyakan hal lanjutan kepada Anda.');
  let nama = null;
  if (pakaiNama) {
    nama = prompt('Nama pelapor:', window.currentUsername || '');
    if (nama === null) return;
  }

  try {
    const r = await sbRpc('ikp_lapor', {
      p_data: {
        jenis, tgl_kejadian: tgl, kronologi, lokasi: lokasi || null,
        tindakan_segera: segera || null, patient_name: pasien || null,
        pelapor_nama: nama, anonim: !pakaiNama,
      },
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Laporan tercatat: ${r.no_ikp}${r.anonim ? ' (anonim)' : ''}.`
      + (r.catatan ? `\n\n${r.catatan}` : ''));
    await renderIkp();
  } catch (e) { alert('Gagal melaporkan: ' + e.message); }
}

async function kpGrading(id) {
  const dampak = prompt('Dampak (1–5):\n\n'
    + '1 Tidak signifikan · 2 Minor · 3 Moderat · 4 Mayor · 5 Katastropik');
  if (!dampak) return;
  const peluang = prompt('Peluang berulang (1–5):\n\n'
    + '1 Sangat jarang · 2 Jarang · 3 Mungkin · 4 Sering · 5 Sangat sering');
  if (!peluang) return;

  try {
    const r = await sbRpc('ikp_grading', {
      p_ikp_id: id, p_dampak: parseInt(dampak, 10),
      p_peluang: parseInt(peluang, 10),
      p_oleh: (window.currentUsername || null),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Band ${r.band} (skor ${r.skor}).\nInvestigasi wajib: ${r.metode_wajib}.`
      + (r.catatan ? `\n\n${r.catatan}` : ''));
    await renderIkp();
  } catch (e) { alert('Gagal grading: ' + e.message); }
}

async function kpInvestigasi(id) {
  const i = (kpData.papan || []).find(x => x.id === id) || {};
  const metode = prompt(
    `Metode investigasi${i.wajib_rca ? ' (band ' + i.band + ' menuntut RCA)' : ''}:\n\n`
    + 'Sederhana / RCA', i.wajib_rca ? 'RCA' : 'Sederhana');
  if (!metode) return;
  const tim = prompt('Tim investigasi:', '');
  if (tim === null) return;
  const akar = prompt('Akar masalah (wajib untuk bisa menutup insiden):\n\n'
    + 'Cari sebab sistemnya, bukan berhenti di "kelalaian petugas" — '
    + 'insiden yang akar masalahnya selalu individu berarti sistemnya '
    + 'tidak pernah diperbaiki.');
  if (akar === null) return;
  const faktor = prompt('Faktor kontribusi:', '');
  if (faktor === null) return;

  try {
    await sbPost('ikp_investigasi', {
      ikp_id: id, metode: metode.trim(), tim: tim || null,
      akar_masalah: akar || null, faktor_kontribusi: faktor || null,
    });
    await renderIkp();
  } catch (e) { alert('Gagal menyimpan investigasi: ' + e.message); }
}

async function kpCapa(id) {
  const jenis = prompt('Jenis tindakan (Korektif / Preventif):', 'Korektif');
  if (!jenis) return;
  const uraian = prompt('Uraian tindakan perbaikan:');
  if (!uraian) return;
  const pj = prompt('Penanggung jawab:', '');
  if (pj === null) return;
  const batas = prompt('Batas waktu (YYYY-MM-DD):', '');
  if (batas === null) return;

  try {
    await sbPost('ikp_tindakan', {
      ikp_id: id, jenis: jenis.trim(), uraian: uraian.trim(),
      penanggung_jawab: pj || null, batas_waktu: batas || null,
    });
    await renderIkp();
  } catch (e) { alert('Gagal menyimpan tindakan: ' + e.message); }
}

async function kpCapaSelesai(id) {
  const bukti = prompt('Bukti pelaksanaan (dokumen, foto, nomor SPO):', '');
  if (bukti === null) return;
  try {
    await sbPatch('ikp_tindakan', id, {
      selesai_at: new Date().toISOString(), bukti: bukti || null,
    });
    await renderIkp();
  } catch (e) { alert('Gagal memperbarui: ' + e.message); }
}

async function kpTutupInsiden(id) {
  try {
    const r = await sbRpc('ikp_tutup', {
      p_ikp_id: id, p_oleh: (window.currentUsername || null),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Insiden ${r.no_ikp} ditutup.`);
    kpPilih = null;
    await renderIkp();
  } catch (e) { alert('Gagal menutup insiden: ' + e.message); }
}

// ── Indikator mutu ───────────────────────────────────────────────
function kpTabMutu() {
  const I = kpData.indikator || [];
  const C = kpData.capaian || [];
  const belumRencana = C.filter(x => x.perbaikan_belum_diisi);

  if (!I.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📊</div>
      <div style="font-weight:700; margin-bottom:6px">Indikator mutu belum ditetapkan</div>
      <div style="font-size:13px; color:var(--text3); max-width:540px; margin:0 auto 14px;
                  line-height:1.8">
        Definisi indikator sengaja tidak ditanam sebagai data bawaan:
        Indikator Mutu Nasional berubah, dan tiap faskes juga punya
        indikator prioritasnya sendiri. Yang dibangun adalah tempatnya,
        beserta catatan siapa yang menetapkan.
      </div>
      <button class="btn btn-primary" onclick="kpIndikatorBaru()">+ Tetapkan Indikator</button>
    </div>`;
  }

  return `
    ${belumRencana.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${belumRencana.length} capaian di bawah target belum punya rencana perbaikan.</b>
        Yang ditanyakan asesor bukan apakah pernah meleset, melainkan apa
        yang dikerjakan setelahnya.
      </div>` : ''}

    <div style="display:flex; justify-content:flex-end; margin-bottom:10px; gap:8px">
      <button class="btn btn-sm" onclick="kpIndikatorBaru()">+ Indikator</button>
      <button class="btn btn-sm btn-primary" onclick="kpCatatCapaian()">+ Catat Capaian</button>
    </div>

    <div class="card" style="margin-bottom:16px; overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Kode</th><th>Indikator</th><th>Kategori</th>
        <th style="text-align:right">Target</th><th>Arah Baik</th>
        <th>Frekuensi</th><th>PJ</th>
      </tr></thead><tbody>
      ${I.map(x => `<tr>
        <td><b>${kpEsc(x.kode)}</b></td>
        <td>${kpEsc(x.nama)}</td>
        <td style="font-size:12px">${kpEsc(x.kategori || '—')}</td>
        <td style="text-align:right">${x.target != null
          ? x.target + ' ' + kpEsc(x.satuan || '') : '—'}</td>
        <td>${x.arah_baik === 'turun' ? 'makin rendah makin baik' : 'makin tinggi makin baik'}</td>
        <td style="font-size:12px">${kpEsc(x.frekuensi || '—')}</td>
        <td style="font-size:12px">${kpEsc(x.penanggung_jawab || '—')}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>

    <h3 style="font-size:14px; margin:16px 0 8px">Capaian</h3>
    ${!C.length ? `
      <div class="card" style="padding:24px; text-align:center; font-size:13px;
                               color:var(--text3)">Belum ada capaian dicatat.</div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Periode</th><th>Indikator</th>
          <th style="text-align:right">Num/Denom</th>
          <th style="text-align:right">Capaian</th>
          <th style="text-align:right">Target</th>
          <th>Status</th><th>Rencana Perbaikan</th><th></th>
        </tr></thead><tbody>
        ${C.map(c => `<tr style="${c.perbaikan_belum_diisi
          ? 'background:rgba(255,180,0,.05)' : ''}">
          <td>${kpEsc(c.periode)}</td>
          <td>${kpEsc(c.nama || '—')}</td>
          <td style="text-align:right; font-size:12px">
            ${Number(c.numerator || 0)}/${Number(c.denominator || 0)}</td>
          <td style="text-align:right; font-weight:700;
                     color:${c.tercapai === true ? 'var(--success)'
                           : c.tercapai === false ? 'var(--danger)' : 'inherit'}">
            ${Number(c.capaian || 0)}%</td>
          <td style="text-align:right">${c.target != null ? c.target + '%' : '—'}</td>
          <td>${c.tercapai === true ? '<span style="color:var(--success)">tercapai</span>'
              : c.tercapai === false ? '<span style="color:var(--danger)">belum</span>'
              : '—'}</td>
          <td style="font-size:12px; max-width:260px">${c.rencana_perbaikan
            ? kpEsc(c.rencana_perbaikan)
            : (c.tercapai === false
                ? '<span style="color:var(--danger)">belum diisi</span>' : '—')}</td>
          <td>${c.tercapai === false
            ? `<button class="btn btn-sm" onclick="kpIsiRencana(${c.id})">
                 ${c.rencana_perbaikan ? 'Ubah' : 'Isi Rencana'}</button>` : ''}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}`;
}

async function kpIndikatorBaru() {
  const kode = prompt('Kode indikator:');
  if (!kode) return;
  const nama = prompt('Nama indikator:');
  if (!nama) return;
  const kategori = prompt('Kategori:', '');
  if (kategori === null) return;
  const num = prompt('Definisi numerator (apa yang dihitung di atas):', '');
  if (num === null) return;
  const den = prompt('Definisi denominator (apa yang dihitung di bawah):', '');
  if (den === null) return;
  const target = prompt('Target (angka, mis. 85):', '');
  if (target === null) return;
  const arah = confirm('Makin TINGGI makin baik?\n\n'
    + 'OK = makin tinggi makin baik (mis. kepatuhan cuci tangan)\n'
    + 'Batal = makin rendah makin baik (mis. angka infeksi)');
  const frek = prompt('Frekuensi (Harian / Bulanan / Triwulan):', 'Bulanan');
  if (frek === null) return;

  try {
    await sbPost('mutu_indikator', {
      kode: kode.trim().toUpperCase(), nama: nama.trim(),
      kategori: kategori || null,
      definisi_numerator: num || null, definisi_denominator: den || null,
      target: target ? parseFloat(target) : null,
      arah_baik: arah ? 'naik' : 'turun', frekuensi: frek || null,
      ditetapkan_oleh: (window.currentUsername || null),
      tgl_berlaku: new Date().toISOString().slice(0, 10),
    });
    await renderIkp();
  } catch (e) { alert('Gagal menyimpan indikator: ' + e.message); }
}

async function kpCatatCapaian() {
  const I = kpData.indikator || [];
  const pilihan = I.map((x, i) => `${i + 1}. ${x.nama}`).join('\n');
  const n = prompt(`Indikator:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const ind = I[parseInt(n, 10) - 1];
  if (!ind) { alert('Nomor tidak dikenal.'); return; }

  const periode = prompt('Periode (mis. 2026-08):',
    new Date().toISOString().slice(0, 7));
  if (!periode) return;
  const num = prompt(`Numerator — ${ind.definisi_numerator || 'jumlah yang memenuhi'}:`);
  if (num === null) return;
  const den = prompt(`Denominator — ${ind.definisi_denominator || 'jumlah seluruhnya'}:`);
  if (den === null) return;

  try {
    const r = await sbRpc('mutu_catat', {
      p_indikator_id: ind.id, p_periode: periode,
      p_numerator: parseFloat(num), p_denominator: parseFloat(den),
      p_oleh: (window.currentUsername || null),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Capaian ${r.capaian}%${r.target != null ? ` (target ${r.target}%)` : ''}.`
      + (r.wajib_analisis ? '\n\nDi bawah target — wajib diisi rencana perbaikan.' : ''));
    await renderIkp();
  } catch (e) { alert('Gagal mencatat capaian: ' + e.message); }
}

async function kpIsiRencana(id) {
  const analisis = prompt('Analisis penyebab tidak tercapai:');
  if (analisis === null) return;
  const rencana = prompt('Rencana perbaikan:');
  if (!rencana) return;
  try {
    await sbPatch('mutu_capaian', id, {
      analisis: analisis || null, rencana_perbaikan: rencana,
    });
    await renderIkp();
  } catch (e) { alert('Gagal menyimpan rencana: ' + e.message); }
}

window.renderIkp        = renderIkp;
window.kpGantiTab       = kpGantiTab;
window.kpSaring         = kpSaring;
window.kpBuka           = kpBuka;
window.kpTutupPanel     = kpTutupPanel;
window.kpLapor          = kpLapor;
window.kpGrading        = kpGrading;
window.kpInvestigasi    = kpInvestigasi;
window.kpCapa           = kpCapa;
window.kpCapaSelesai    = kpCapaSelesai;
window.kpTutupInsiden   = kpTutupInsiden;
window.kpIndikatorBaru  = kpIndikatorBaru;
window.kpCatatCapaian   = kpCatatCapaian;
window.kpIsiRencana     = kpIsiRencana;
