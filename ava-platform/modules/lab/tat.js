// ═══════════════════════════════════════════════════════════════
// MODULE: Turnaround Time (TAT) Laboratorium
//
// Lab adalah domain terkuat sistem ini (80% kematangan) — tapi TAT tidak
// pernah diukur sama sekali, padahal SELURUH stempel waktunya sudah
// tersimpan sejak lama: collected_at, received_at, entered_at,
// validated_at, approved_at. Yang belum ada hanyalah yang membaca.
//
// TAT adalah angka yang paling sering ditanyakan klinisi dan paling sering
// diminta auditor ISO 15189. Tanpanya, "lab kami cepat" hanyalah klaim.
//
// ── Kenapa MEDIAN dan P90, bukan rata-rata ───────────────────
// Satu sampel yang tertahan semalam menarik rata-rata sampai menyesatkan.
// Median menggambarkan pengalaman yang biasa; P90 menunjukkan ekor buruk
// yang justru dikeluhkan pasien. Rata-rata menyembunyikan keduanya.
//
// Prefiks "tat" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let tatData = null;
let tatRentang = 30;   // hari

const tatMenit = (m) => {
  if (m == null) return '—';
  const n = Number(m);
  if (!Number.isFinite(n)) return '—';
  if (n < 60) return n.toFixed(0) + ' mnt';
  if (n < 1440) return (n / 60).toFixed(1) + ' jam';
  return (n / 1440).toFixed(1) + ' hari';
};

async function renderLabTat() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Turnaround Time Lab</h1>
        <p style="color:var(--text3);font-size:13px">
          Lama tiap tahap, dari pengambilan sampel sampai hasil disetujui</p></div>
      <div class="btn-row">
        <select id="tat-rentang" onchange="tatUbahRentang(this.value)"
          style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;
                 padding:6px 10px;font-size:12px;color:var(--text)">
          <option value="7">7 hari</option>
          <option value="30" selected>30 hari</option>
          <option value="90">90 hari</option>
        </select>
        <button class="btn btn-teal btn-sm" onclick="renderLabTat()">Muat Ulang</button>
      </div>
    </div>
    <div id="tat-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;

  await tatMuat();
  tatGambar();
}

async function tatMuat() {
  try {
    const d = await sbRpc('lab_tat', { p_hari: tatRentang });
    tatData = (d && typeof d === 'object') ? d : null;
  } catch (e) {
    tatData = { _galat: e.message || String(e) };
  }
}

function tatUbahRentang(v) { tatRentang = parseInt(v, 10) || 30; renderLabTat(); }

function tatGambar() {
  const el = document.getElementById('tat-isi');
  if (!el) return;

  if (tatData && tatData._galat) {
    el.innerHTML = `<div class="card" style="padding:18px;border-color:var(--danger-tint)">
      <strong style="color:var(--danger-strong)">Gagal memuat</strong>
      <div style="font-size:12.5px;color:var(--text3);margin-top:6px">${tatData._galat}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:8px">
        Jalankan migrasi <code>0011_ar_aging_tat.sql</code> bila fungsi belum tersedia.</div></div>`;
    return;
  }

  const nTotal = Number((tatData && tatData.n_total) || 0);
  const nTuntas = Number((tatData && tatData.n_tuntas) || 0);

  if (!nTotal) {
    el.innerHTML = `<div class="card" style="padding:26px;text-align:center">
      <div style="font-size:13.5px;font-weight:700;margin-bottom:6px">Belum ada hasil dalam ${tatRentang} hari terakhir</div>
      <div style="font-size:12.5px;color:var(--text3);line-height:1.6">
        TAT dihitung dari hasil lab yang tercatat. Perluas rentang waktu,
        atau tunggu sampai ada pemeriksaan yang selesai.</div></div>`;
    return;
  }

  const tahap = (tatData.tahap || []).filter(t => t.median != null);
  const maks = Math.max(1, ...tahap.map(t => Number(t.median) || 0));
  // Tahap terlama = penyumbatan. Inilah yang dicari orang saat membuka layar ini.
  const lambat = tahap.reduce((a, b) => (Number(b.median) || 0) > (Number(a.median) || 0) ? b : a, tahap[0] || {});

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px">
      ${[['TAT median', tatMenit(tatData.total_median), 'var(--teal)'],
         ['TAT P90', tatMenit(tatData.total_p90), 'var(--warn-deep)'],
         ['Hasil tuntas', `${nTuntas} dari ${nTotal}`, 'var(--text2)'],
         ['Tahap terlama', lambat.nama || '—', 'var(--danger-strong)']]
        .map(([l, v, c]) => `<div class="card" style="padding:13px">
            <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${l}</div>
            <div style="font-size:17px;font-weight:800;color:${c};margin-top:3px">${v}</div>
          </div>`).join('')}
    </div>

    <div class="card" style="padding:16px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px">Lama per tahap (median)</div>
      <div style="font-size:11.5px;color:var(--text3);margin-bottom:14px">
        Batang terpanjang menunjukkan di mana pekerjaan menumpuk.</div>
      ${tahap.map(t => {
        const v = Number(t.median) || 0;
        const w = (v / maks * 100).toFixed(1);
        const ini = t.nama === lambat.nama;
        return `<div style="margin-bottom:11px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span style="color:var(--text2);font-weight:${ini ? 700 : 500}">${t.nama}</span>
            <span style="font-weight:700;color:${ini ? 'var(--danger-strong)' : 'var(--text2)'}">${tatMenit(v)}</span>
          </div>
          <div style="height:9px;background:var(--bg2);border-radius:5px;overflow:hidden">
            <div style="width:${w}%;height:100%;background:${ini ? 'var(--danger-strong)' : 'var(--teal)'};
                        border-radius:5px;transition:width var(--dur,.22s) var(--ease,ease)"></div>
          </div></div>`;
      }).join('')}
      ${nTuntas < nTotal ? `<div style="font-size:11.5px;color:var(--text3);margin-top:10px">
        ${nTotal - nTuntas} hasil belum tuntas sampai tahap persetujuan, jadi tidak masuk hitungan TAT total.</div>` : ''}
    </div>

    ${tatPerJenis()}
    ${tatTerlambat()}`;
}

function tatPerJenis() {
  const rows = (tatData && tatData.per_jenis) || [];
  if (!rows.length) return '';
  return `<div class="card" style="padding:0;overflow:hidden;margin-bottom:14px">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
      <span style="font-size:13px;font-weight:700">Per jenis spesimen</span>
      <span style="font-size:11.5px;color:var(--text3);margin-left:8px">penyumbatan yang berulang</span></div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr style="color:var(--text3);text-align:left">
        <th style="padding:9px 16px">Jenis</th><th>Jumlah</th>
        <th style="padding-right:16px">TAT median</th></tr></thead>
      <tbody>${rows.map(r => `<tr style="border-top:1px solid var(--border)">
        <td style="padding:9px 16px">${r.jenis}</td>
        <td>${r.jumlah}</td>
        <td style="padding-right:16px;font-weight:700">${tatMenit(r.median)}</td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

function tatTerlambat() {
  const rows = (tatData && tatData.terlambat) || [];
  if (!rows.length) return '';
  return `<div class="card" style="padding:0;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
      <span style="font-size:13px;font-weight:700">Sampel paling lambat</span>
      <span style="font-size:11.5px;color:var(--text3);margin-left:8px">daftar tindak lanjut, bukan sekadar angka</span></div>
    <div style="max-height:320px;overflow:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="color:var(--text3);text-align:left">
          <th style="padding:9px 16px">Barcode</th><th>Pemeriksaan</th>
          <th>Jenis</th><th style="padding-right:16px">TAT</th></tr></thead>
        <tbody>${rows.map(r => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:9px 16px;font-family:monospace">${r.barcode || '—'}</td>
          <td>${r.pemeriksaan || '—'}</td>
          <td style="color:var(--text3)">${r.jenis || '—'}</td>
          <td style="padding-right:16px;font-weight:700;color:var(--danger-strong)">${tatMenit(r.menit)}</td>
        </tr>`).join('')}</tbody></table></div></div>`;
}

window.renderLabTat = renderLabTat;
window.tatUbahRentang = tatUbahRentang;
