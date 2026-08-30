// ═══════════════════════════════════════════════════════════════
// MODUL: Verifikasi Lot QC — kontrol kualitas per lot bahan
//
// Versi sebelumnya tidak punya panggilan data. Sekarang membaca
// public.lab_qc_lots dan public.lab_qc_runs yang sudah ada.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Aturan Westgard yang dipakai di sini hanya yang bisa dihitung dari
// data yang ada: 1-3s (satu hasil di luar 3 SD) dan 2-2s (dua hasil
// berturut-turut di sisi yang sama melewati 2 SD). Aturan lain butuh
// riwayat lintas level dan lintas hari yang belum tersimpan lengkap —
// menampilkannya sebagai "lolos" padahal tidak pernah diperiksa akan
// memberi rasa aman yang keliru.
//
// Lot yang kedaluwarsa ditandai merah dan TIDAK disembunyikan. Lot
// kedaluwarsa yang masih dipakai adalah temuan audit; menyembunyikannya
// dari layar tidak menghilangkannya dari kenyataan.
//
// z-score dihitung ulang di sini dari measured/target/sd, tidak sekadar
// menampilkan kolom z_score. Kalau keduanya berbeda, itu tanda ada yang
// menulis z_score tanpa lewat perhitungan — dan itu perlu terlihat.
//
// Prefiks "lv".
// ═══════════════════════════════════════════════════════════════

let lvData = null;
let lvLot = null;

function lvEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function lvTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}
function lvJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function lvZ(r) {
  const sd = Number(r.sd);
  if (!sd) return null;
  return (Number(r.measured) - Number(r.target)) / sd;
}

async function lvMuat() {
  if (typeof sbGet !== 'function') { lvData = null; return; }
  try {
    const [lot, run, alat] = await Promise.all([
      sbGet('lab_qc_lots', 'select=*&order=berlaku_sampai'),
      sbGet('lab_qc_runs', 'select=*&order=run_at.desc&limit=400'),
      sbGet('analyzers', 'select=id,nama_alat,kode_alat').catch(() => []),
    ]);
    lvData = { lot, run, alat };
  } catch (e) { lvData = null; }
}

async function renderLotVerification() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await lvMuat();

  if (lvData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Verifikasi Lot QC</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data QC tidak dapat dibaca.</strong><br>
        Tabel <code>lab_qc_lots</code> atau <code>lab_qc_runs</code> belum tersedia.
      </div>`;
    return;
  }
  lvGambar();
}

// Westgard yang bisa dihitung dari data yang tersedia.
function lvWestgard(runs) {
  const urut = [...runs].sort((a, b) => new Date(a.run_at) - new Date(b.run_at));
  const pelanggaran = [];
  for (let i = 0; i < urut.length; i++) {
    const z = lvZ(urut[i]);
    if (z === null) continue;
    if (Math.abs(z) > 3) {
      pelanggaran.push({ id: urut[i].id, aturan: '1-3s',
        ket: `hasil ${z.toFixed(2)} SD dari target` });
      continue;
    }
    if (i > 0) {
      const zs = lvZ(urut[i - 1]);
      if (zs !== null && Math.abs(z) > 2 && Math.abs(zs) > 2
          && Math.sign(z) === Math.sign(zs)) {
        pelanggaran.push({ id: urut[i].id, aturan: '2-2s',
          ket: 'dua hasil berturut-turut di sisi yang sama melewati 2 SD' });
      }
    }
  }
  return pelanggaran;
}

function lvGambar() {
  const L = lvData.lot || [];
  const R = lvData.run || [];
  const namaAlat = id => (lvData.alat.find(a => a.id === id) || {}).nama_alat || '—';

  const kedaluwarsa = L.filter(l =>
    l.is_active && l.berlaku_sampai && new Date(l.berlaku_sampai) < new Date());

  const runLot = lvLot
    ? R.filter(r => r.lot_number === lvLot)
    : R.slice(0, 60);
  const langgar = lvWestgard(runLot);
  const idLanggar = new Set(langgar.map(x => x.id));

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Verifikasi Lot QC</h1>
        <p class="muted">Lot bahan kontrol, nilai target, dan hasil pemantapan mutu internal.</p>
      </div>
    </div>

    ${kedaluwarsa.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${kedaluwarsa.length} lot masih aktif padahal sudah kedaluwarsa:</b>
        ${kedaluwarsa.map(l => lvEsc(l.lot_number)).join(', ')}.
        Hasil QC dari lot kedaluwarsa tidak sah untuk meluluskan pemeriksaan.
      </div>` : ''}

    ${!L.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🧪</div>
        <div style="font-weight:700; margin-bottom:4px">Belum ada lot QC terdaftar</div>
        <div style="font-size:13px; color:var(--text3)">
          Daftarkan lot beserta nilai target dan SD dari sisipan pabrik
          sebelum menjalankan QC.</div>
      </div>` : `
      <div class="card" style="margin-bottom:16px; overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Lot</th><th>Pemeriksaan</th><th>Level</th><th>Alat</th>
          <th style="text-align:right">Target</th>
          <th style="text-align:right">SD</th>
          <th>Berlaku s/d</th><th>Status</th>
          <th style="text-align:right">Run</th><th></th>
        </tr></thead><tbody>
        ${L.map(l => {
          const exp = l.berlaku_sampai && new Date(l.berlaku_sampai) < new Date();
          const n = R.filter(r => r.lot_number === l.lot_number).length;
          return `<tr style="${lvLot === l.lot_number ? 'outline:2px solid var(--primary)' : ''}">
            <td><b>${lvEsc(l.lot_number)}</b></td>
            <td>${lvEsc(l.test_name)}</td>
            <td>${lvEsc(l.qc_level || '—')}</td>
            <td style="font-size:12px">${lvEsc(namaAlat(l.analyzer_id))}</td>
            <td style="text-align:right">${lvEsc(l.target)} ${lvEsc(l.unit || '')}</td>
            <td style="text-align:right">${lvEsc(l.sd)}</td>
            <td style="color:${exp ? 'var(--danger)' : 'inherit'};
                       font-weight:${exp ? '700' : '400'}">
              ${lvTgl(l.berlaku_sampai)}</td>
            <td>${l.is_active
              ? (exp ? '<span style="color:var(--danger); font-weight:700">Aktif tapi kedaluwarsa</span>'
                     : '<span style="color:var(--success)">Aktif</span>')
              : '<span style="color:var(--text3)">Nonaktif</span>'}</td>
            <td style="text-align:right">${n}</td>
            <td><button class="btn btn-sm" onclick="lvPilihLot('${lvEsc(l.lot_number)}')">
              ${lvLot === l.lot_number ? 'Tutup' : 'Lihat Run'}</button></td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}

    ${langgar.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${langgar.length} pelanggaran aturan Westgard terdeteksi:</b>
        ${[...new Set(langgar.map(x => x.aturan))].join(', ')}.
        Hasil pasien pada run tersebut perlu ditinjau sebelum dikeluarkan.
      </div>` : ''}

    <h3 style="font-size:14px; margin:16px 0 8px">
      Hasil Run QC${lvLot ? ' — lot ' + lvEsc(lvLot) : ' (terbaru)'}</h3>

    ${!runLot.length ? `
      <div class="card" style="padding:24px; text-align:center; font-size:13px;
                               color:var(--text3)">
        Belum ada run QC${lvLot ? ' untuk lot ini' : ''}.</div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Waktu</th><th>Pemeriksaan</th><th>Level</th>
          <th style="text-align:right">Terukur</th>
          <th style="text-align:right">Target</th>
          <th style="text-align:right">z</th>
          <th>Putusan</th><th>Westgard</th><th>Oleh</th>
        </tr></thead><tbody>
        ${runLot.map(r => {
          const z = lvZ(r);
          const w = langgar.find(x => x.id === r.id);
          const beda = z !== null && r.z_score != null
                    && Math.abs(z - Number(r.z_score)) > 0.05;
          return `<tr style="${idLanggar.has(r.id) ? 'background:rgba(255,0,0,.04)' : ''}">
            <td style="white-space:nowrap">${lvJam(r.run_at)}</td>
            <td>${lvEsc(r.test_name)}</td>
            <td>${lvEsc(r.qc_level || '—')}</td>
            <td style="text-align:right">${lvEsc(r.measured)}</td>
            <td style="text-align:right">${lvEsc(r.target)}</td>
            <td style="text-align:right; font-weight:700;
                       color:${z === null ? 'var(--text3)'
                              : Math.abs(z) > 3 ? 'var(--danger)'
                              : Math.abs(z) > 2 ? 'var(--warning)' : 'var(--success)'}">
              ${z === null ? '—' : z.toFixed(2)}
              ${beda ? `<div style="font-size:10px; color:var(--warning); font-weight:400">
                          tersimpan ${lvEsc(r.z_score)}</div>` : ''}</td>
            <td>${lvEsc(r.verdict || '—')}</td>
            <td style="font-size:11px; color:var(--danger)">
              ${w ? '<b>' + w.aturan + '</b> — ' + w.ket : ''}</td>
            <td style="font-size:12px">${lvEsc(r.run_by || '—')}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Aturan Westgard yang diperiksa di sini terbatas pada <b>1-3s</b> dan
      <b>2-2s</b> — hanya itu yang bisa dihitung dari data yang tersimpan.
      Aturan lain (4-1s, 10x, R-4s lintas level) butuh riwayat lintas level
      dan lintas hari yang belum lengkap; menampilkannya sebagai "lolos"
      padahal tidak pernah diperiksa akan memberi rasa aman yang keliru.
    </div>`;
}

function lvPilihLot(lot) {
  lvLot = (lvLot === lot) ? null : lot;
  lvGambar();
}

window.renderLotVerification = renderLotVerification;
window.lvPilihLot = lvPilihLot;
