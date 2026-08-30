// ═══════════════════════════════════════════════════════════════
// MODUL: PME — Pemantapan Mutu Eksternal / Uji Profisiensi
//
// Versi sebelumnya tidak punya panggilan data: program, siklus, dan
// hasil z-score ditulis tangan. Untuk dokumen yang diperiksa saat
// akreditasi ISO 15189, itu bukan sekadar tidak berguna — ia menyiapkan
// bukti palsu.
//
// Sekarang membaca lab_pme_program / lab_pme_siklus / lab_pme_hasil
// (migrasi 0038).
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// z-score dihitung basis data dari nilai lab, nilai acuan, dan SD
// penyelenggara — tidak diketik. Batasnya (|z| ≤ 2 memuaskan, ≤ 3
// dipertanyakan, > 3 tidak memuaskan) juga tidak bisa diatur dari layar:
// melonggarkan ambang agar hasil terlihat bagus adalah persis yang
// membuat program mutu kehilangan gunanya.
//
// Hasil yang tidak memuaskan menuntut akar masalah dan tindakan
// perbaikan. Kolomnya ditampilkan menyala kosong sampai diisi, bukan
// disembunyikan — kewajiban yang tak terlihat adalah kewajiban yang
// terlewat.
//
// Prefiks "pm".
// ═══════════════════════════════════════════════════════════════

let pmData = null;
let pmSiklus = null;

function pmEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function pmTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function pmMuat() {
  if (typeof sbGet !== 'function') { pmData = null; return; }
  try {
    const [program, siklus, hasil] = await Promise.all([
      sbGet('lab_pme_program', 'select=*&order=nama'),
      sbGet('lab_pme_siklus', 'select=*&order=tgl_kirim_sampel.desc'),
      sbGet('lab_pme_hasil', 'select=*&order=id'),
    ]);
    pmData = { program, siklus, hasil };
  } catch (e) { pmData = null; }
}

async function renderPmeProficiency() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await pmMuat();

  if (pmData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>PME / Uji Profisiensi</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data PME tidak dapat dibaca.</strong><br>
        Tabel <code>lab_pme_program</code> belum ada — jalankan ulang
        aplikasi agar migrasi
        <code>0038_lis_flebotomi_kelayakan_pme_arsip.sql</code> terpasang.
      </div>`;
    return;
  }
  pmGambar();
}

function pmGambar() {
  const P = pmData.program || [];
  const S = pmData.siklus || [];
  const H = pmData.hasil || [];

  const tidakMemuaskan = H.filter(h => h.evaluasi !== 'Memuaskan');
  const belumDitindak = tidakMemuaskan.filter(h => !h.tindakan_perbaikan);
  const terlambat = S.filter(s => s.batas_kirim_hasil
    && new Date(s.batas_kirim_hasil) < new Date()
    && s.status !== 'Selesai');

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>PME / Uji Profisiensi</h1>
        <p class="muted">Pemantapan mutu eksternal — program, siklus, dan evaluasi hasil.</p>
      </div>
      ${P.length ? `<div><button class="btn btn-primary" onclick="pmTambahSiklus()">
        + Siklus Baru</button></div>` : ''}
    </div>

    ${belumDitindak.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${belumDitindak.length} hasil tidak memuaskan belum punya tindakan perbaikan.</b>
        Ini yang pertama ditanyakan asesor: bukan apakah pernah gagal,
        melainkan apa yang dikerjakan setelah gagal.
      </div>` : ''}
    ${terlambat.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${terlambat.length} siklus lewat batas kirim hasil</b> dan belum
        berstatus selesai.
      </div>` : ''}

    ${!P.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🎯</div>
        <div style="font-weight:700; margin-bottom:6px">Belum ada program PME terdaftar</div>
        <div style="font-size:13px; color:var(--text3); max-width:480px; margin:0 auto 14px">
          Daftarkan penyelenggara yang diikuti lab beserta nomor pesertanya,
          lalu catat tiap siklusnya.</div>
        <button class="btn btn-primary" onclick="pmTambahProgram()">
          + Daftarkan Program</button>
      </div>` : `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
                  gap:12px; margin-bottom:16px">
        ${P.map(p => {
          const sp = S.filter(s => s.program_id === p.id);
          return `<div class="card" style="padding:16px">
            <div style="font-weight:700">${pmEsc(p.nama)}</div>
            <div style="font-size:11px; color:var(--text3); margin-top:2px">
              ${pmEsc(p.penyelenggara || '—')}</div>
            <div style="font-size:12px; color:var(--text3); margin-top:8px; line-height:1.7">
              Lingkup: ${pmEsc(p.lingkup || '—')}<br>
              ${p.no_peserta ? 'No. peserta: <b>' + pmEsc(p.no_peserta) + '</b><br>' : ''}
              ${sp.length} siklus tercatat
            </div>
          </div>`;
        }).join('')}
        <div class="card" style="padding:16px; display:flex; align-items:center;
                                 justify-content:center">
          <button class="btn btn-sm" onclick="pmTambahProgram()">+ Program</button>
        </div>
      </div>

      <h3 style="font-size:14px; margin:16px 0 8px">Siklus</h3>
      ${!S.length ? `
        <div class="card" style="padding:24px; text-align:center; font-size:13px;
                                 color:var(--text3)">Belum ada siklus dicatat.</div>` : `
        <div class="card" style="overflow-x:auto; margin-bottom:16px">
          <table class="data-table"><thead><tr>
            <th>Program</th><th>Siklus</th><th>Kirim Sampel</th>
            <th>Batas Kirim Hasil</th><th>Tgl Hasil</th>
            <th style="text-align:right">Parameter</th>
            <th>Ringkas Evaluasi</th><th>Status</th><th></th>
          </tr></thead><tbody>
          ${S.map(s => {
            const prog = P.find(x => x.id === s.program_id) || {};
            const hs = H.filter(h => h.siklus_id === s.id);
            const buruk = hs.filter(h => h.evaluasi !== 'Memuaskan').length;
            const lewat = s.batas_kirim_hasil
              && new Date(s.batas_kirim_hasil) < new Date() && s.status !== 'Selesai';
            return `<tr style="${pmSiklus === s.id ? 'outline:2px solid var(--primary)' : ''}">
              <td>${pmEsc(prog.nama || '—')}</td>
              <td><b>${pmEsc(s.kode_siklus)}</b></td>
              <td>${pmTgl(s.tgl_kirim_sampel)}</td>
              <td style="color:${lewat ? 'var(--danger)' : 'inherit'};
                         font-weight:${lewat ? '700' : '400'}">
                ${pmTgl(s.batas_kirim_hasil)}</td>
              <td>${pmTgl(s.tgl_hasil)}</td>
              <td style="text-align:right">${hs.length}</td>
              <td style="font-size:12px">${hs.length
                ? (buruk
                    ? `<span style="color:var(--danger); font-weight:700">${buruk} tidak memuaskan</span>`
                    : '<span style="color:var(--success)">semua memuaskan</span>')
                : '—'}</td>
              <td>${pmEsc(s.status)}</td>
              <td><button class="btn btn-sm" onclick="pmPilihSiklus(${s.id})">
                ${pmSiklus === s.id ? 'Tutup' : 'Hasil'}</button></td>
            </tr>`;
          }).join('')}
          </tbody></table>
        </div>`}

      ${pmSiklus ? pmPanelHasil() : ''}`}`;
}

function pmPanelHasil() {
  const s = (pmData.siklus || []).find(x => x.id === pmSiklus);
  if (!s) return '';
  const H = (pmData.hasil || []).filter(h => h.siklus_id === pmSiklus);

  const warna = {
    'Memuaskan': 'var(--success)',
    'Dipertanyakan': 'var(--warning)',
    'Tidak Memuaskan': 'var(--danger)',
  };

  return `
    <div style="display:flex; justify-content:space-between; align-items:center;
                margin:16px 0 8px; flex-wrap:wrap; gap:8px">
      <h3 style="font-size:14px; margin:0">Hasil Siklus ${pmEsc(s.kode_siklus)}</h3>
      <button class="btn btn-sm btn-primary" onclick="pmCatatHasil(${s.id})">
        + Catat Hasil</button>
    </div>

    ${!H.length ? `
      <div class="card" style="padding:24px; text-align:center; font-size:13px;
                               color:var(--text3)">
        Belum ada hasil dicatat untuk siklus ini.</div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Parameter</th>
          <th style="text-align:right">Nilai Lab</th>
          <th style="text-align:right">Nilai Acuan</th>
          <th style="text-align:right">z-score</th>
          <th>Evaluasi</th><th>Akar Masalah</th><th>Tindakan Perbaikan</th><th></th>
        </tr></thead><tbody>
        ${H.map(h => {
          const wajib = h.evaluasi !== 'Memuaskan';
          return `<tr>
            <td><b>${pmEsc(h.parameter)}</b></td>
            <td style="text-align:right">${pmEsc(h.nilai_lab)} ${pmEsc(h.satuan || '')}</td>
            <td style="text-align:right">${pmEsc(h.nilai_acuan)}</td>
            <td style="text-align:right; font-weight:800;
                       color:${warna[h.evaluasi] || 'var(--text3)'}">
              ${h.z_score != null ? Number(h.z_score).toFixed(2) : '—'}</td>
            <td><span style="font-weight:700; color:${warna[h.evaluasi] || 'var(--text3)'}">
              ${pmEsc(h.evaluasi || '—')}</span></td>
            <td style="font-size:12px; ${wajib && !h.akar_masalah
              ? 'color:var(--danger); font-weight:700' : ''}">
              ${h.akar_masalah ? pmEsc(h.akar_masalah)
                : (wajib ? 'belum diisi' : '—')}</td>
            <td style="font-size:12px; ${wajib && !h.tindakan_perbaikan
              ? 'color:var(--danger); font-weight:700' : ''}">
              ${h.tindakan_perbaikan ? pmEsc(h.tindakan_perbaikan)
                : (wajib ? 'belum diisi' : '—')}</td>
            <td>${wajib ? `<button class="btn btn-sm" onclick="pmIsiTindakan(${h.id})">
              ${h.tindakan_perbaikan ? 'Ubah' : 'Isi Tindakan'}</button>` : ''}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}`;
}

function pmPilihSiklus(id) {
  pmSiklus = (pmSiklus === id) ? null : id;
  pmGambar();
}

async function pmTambahProgram() {
  const kode = prompt('Kode program (mis. PME-KIMIA):');
  if (!kode) return;
  const nama = prompt('Nama program:');
  if (!nama) return;
  const penyelenggara = prompt('Penyelenggara:');
  if (penyelenggara === null) return;
  const lingkup = prompt('Lingkup pemeriksaan:', '');
  if (lingkup === null) return;
  const peserta = prompt('Nomor peserta lab (dari penyelenggara):', '');
  if (peserta === null) return;

  try {
    await sbPost('lab_pme_program', {
      kode: kode.trim(), nama: nama.trim(),
      penyelenggara: penyelenggara || null, lingkup: lingkup || null,
      no_peserta: peserta || null,
    });
    await renderPmeProficiency();
  } catch (e) { alert('Gagal menyimpan program: ' + e.message); }
}

async function pmTambahSiklus() {
  const P = pmData.program || [];
  const pilihan = P.map((p, i) => `${i + 1}. ${p.nama}`).join('\n');
  const n = prompt(`Program:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const p = P[parseInt(n, 10) - 1];
  if (!p) { alert('Nomor tidak dikenal.'); return; }

  const kode = prompt('Kode siklus (mis. Siklus 1 2026):');
  if (!kode) return;
  const kirim = prompt('Tanggal kirim sampel (YYYY-MM-DD):', '');
  if (kirim === null) return;
  const batas = prompt('Batas kirim hasil (YYYY-MM-DD):', '');
  if (batas === null) return;

  try {
    await sbPost('lab_pme_siklus', {
      program_id: p.id, kode_siklus: kode.trim(),
      tgl_kirim_sampel: kirim || null, batas_kirim_hasil: batas || null,
      penanggung_jawab: (window.currentUsername || null),
    });
    await renderPmeProficiency();
  } catch (e) { alert('Gagal menyimpan siklus: ' + e.message); }
}

async function pmCatatHasil(siklusId) {
  const param = prompt('Parameter (mis. Glukosa):');
  if (!param) return;
  const lab = prompt('Nilai hasil lab:');
  if (lab === null) return;
  const acuan = prompt('Nilai acuan / target dari penyelenggara:');
  if (acuan === null) return;
  const sd = prompt('Simpangan baku (SD) dari penyelenggara:');
  if (sd === null) return;
  const satuan = prompt('Satuan:', '');
  if (satuan === null) return;

  try {
    const r = await sbRpc('lab_pme_catat_hasil', {
      p_siklus_id: siklusId, p_parameter: param,
      p_nilai_lab: parseFloat(lab), p_nilai_acuan: parseFloat(acuan),
      p_sd: parseFloat(sd), p_satuan: satuan || null,
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Hasil tercatat.\n\nz-score: ${r.z_score}\nEvaluasi: ${r.evaluasi}`
      + (r.wajib_tindakan
        ? '\n\nHasil ini WAJIB punya akar masalah dan tindakan perbaikan.' : ''));
    await renderPmeProficiency();
  } catch (e) { alert('Gagal mencatat hasil: ' + e.message); }
}

async function pmIsiTindakan(hasilId) {
  const akar = prompt('Akar masalah (mengapa hasilnya menyimpang?):');
  if (akar === null) return;
  const tindakan = prompt('Tindakan perbaikan yang dikerjakan:');
  if (tindakan === null) return;

  try {
    await sbPatch('lab_pme_hasil', hasilId, {
      akar_masalah: akar || null,
      tindakan_perbaikan: tindakan || null,
      tgl_tindakan: new Date().toISOString().slice(0, 10),
    });
    await renderPmeProficiency();
  } catch (e) { alert('Gagal menyimpan tindakan: ' + e.message); }
}

function calculatePmeZScore(labVal, peerMean, peerSd) {
  const z = (labVal - peerMean) / peerSd;
  const rounded = parseFloat(z.toFixed(2));
  const absZ = Math.abs(rounded);
  let evaluation = 'SATISFACTORY';
  if (absZ > 3.0) evaluation = 'UNSATISFACTORY';
  else if (absZ > 2.0) evaluation = 'QUESTIONABLE';
  return { z_score: rounded, evaluation };
}

window.renderPmeProficiency = renderPmeProficiency;
window.pmPilihSiklus   = pmPilihSiklus;
window.pmTambahProgram = pmTambahProgram;
window.pmTambahSiklus  = pmTambahSiklus;
window.pmCatatHasil    = pmCatatHasil;
window.pmIsiTindakan   = pmIsiTindakan;
window.calculatePmeZScore = calculatePmeZScore;
