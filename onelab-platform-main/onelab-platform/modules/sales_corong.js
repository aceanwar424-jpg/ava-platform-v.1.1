// ═══════════════════════════════════════════════════════════════
// MODULE: Corong Penjualan
//
// Corong ini baru bisa diukur ujung ke ujung SEKARANG: tahap penawaran
// baru ada sejak migrasi 0012. Sebelumnya rantainya melompat dari deal
// langsung ke invoice, sehingga tidak ada yang bisa menjawab "dari 100
// prospek, berapa yang jadi uang, dan bocornya di tahap mana".
//
//   Prospek → Deal → Penawaran → Invoice
//
// ── Satu keputusan yang menentukan kejujuran angka ───────────
// Tingkat menang dihitung HANYA dari penawaran yang sudah dijawab
// (Diterima + Ditolak). Memasukkan yang masih menunggu jawaban akan
// menekan angka secara palsu dan membuat tim terlihat buruk padahal
// keputusan pelanggan belum keluar.
//
// Prefiks "cor" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let corData = null;
let corRentang = 90;

const corRp = (n) => {
  const v = Number(n || 0);
  if (v >= 1e9) return 'Rp ' + (v / 1e9).toFixed(1) + ' M';
  if (v >= 1e6) return 'Rp ' + (v / 1e6).toFixed(1) + ' jt';
  return 'Rp ' + v.toLocaleString('id-ID');
};

async function renderSalesCorong() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Corong Penjualan</h1>
        <p style="color:var(--text3);font-size:13px">
          Prospek → Deal → Penawaran → Invoice, beserta di mana kebocorannya</p></div>
      <div class="btn-row">
        <select id="cor-rentang" onchange="corUbahRentang(this.value)"
          style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;
                 padding:6px 10px;font-size:12px;color:var(--text)">
          <option value="30">30 hari</option>
          <option value="90" selected>90 hari</option>
          <option value="365">1 tahun</option>
        </select>
        <button class="btn btn-teal btn-sm" onclick="renderSalesCorong()">Muat Ulang</button>
      </div>
    </div>
    <div id="cor-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;

  try {
    const d = await sbRpc('sales_corong', { p_hari: corRentang });
    corData = (d && typeof d === 'object') ? d : null;
  } catch (e) { corData = { _galat: e.message || String(e) }; }
  corGambar();
}

function corUbahRentang(v) { corRentang = parseInt(v, 10) || 90; renderSalesCorong(); }

function corGambar() {
  const el = document.getElementById('cor-isi');
  if (!el) return;

  if (corData && corData._galat) {
    el.innerHTML = `<div class="card" style="padding:18px;border-color:var(--danger-tint)">
      <strong style="color:var(--danger-strong)">Gagal memuat</strong>
      <div style="font-size:12.5px;color:var(--text3);margin-top:6px">${corData._galat}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:8px">
        Jalankan migrasi <code>0013_kendali_ops_corong.sql</code> bila fungsi belum tersedia.</div></div>`;
    return;
  }

  const tahap = (corData && corData.tahap) || [];
  const pnw = (corData && corData.penawaran) || {};
  const maks = Math.max(1, ...tahap.map(t => Number(t.jumlah) || 0));

  if (!tahap.some(t => Number(t.jumlah) > 0)) {
    el.innerHTML = `<div class="card" style="padding:26px;text-align:center">
      <div style="font-size:13.5px;font-weight:700;margin-bottom:6px">Belum ada aktivitas penjualan</div>
      <div style="font-size:12.5px;color:var(--text3)">
        Belum ada prospek, deal, penawaran, atau invoice dalam ${corRentang} hari terakhir.</div></div>`;
    return;
  }

  const menang = pnw.tingkat_menang;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px">
      ${[['Tingkat menang', menang == null ? 'belum ada jawaban' : menang + '%',
          menang == null ? 'var(--text3)' : (menang >= 50 ? 'var(--success-strong)' : 'var(--warn-deep)')],
         ['Menunggu jawaban', corRp(pnw.nilai_menunggu), 'var(--info)'],
         ['Penawaran terkirim', (pnw.terkirim || 0) + ' dokumen', 'var(--text2)'],
         ['Siklus median', corData.siklus_hari_median != null ? corData.siklus_hari_median + ' hari' : '—', 'var(--text2)']]
        .map(([l, v, c]) => `<div class="card" style="padding:13px">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${l}</div>
          <div style="font-size:18px;font-weight:800;color:${c};margin-top:3px">${v}</div></div>`).join('')}
    </div>

    <div class="card" style="padding:16px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px">Corong</div>
      <div style="font-size:11.5px;color:var(--text3);margin-bottom:14px">
        Penyusutan antar-tahap menunjukkan di mana calon pelanggan berhenti.</div>
      ${tahap.map((t, i) => {
        const n = Number(t.jumlah) || 0;
        const w = (n / maks * 100).toFixed(1);
        const sblm = i > 0 ? Number(tahap[i - 1].jumlah) || 0 : null;
        const konv = sblm ? (n / sblm * 100) : null;
        return `<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
            <span style="font-weight:600">${t.nama}
              ${konv != null ? `<span style="font-weight:400;color:${konv < 30 ? 'var(--danger-strong)' : 'var(--text3)'}">
                · ${konv.toFixed(0)}% lanjut dari tahap sebelumnya</span>` : ''}</span>
            <span><b>${n}</b> <span style="color:var(--text3)">· ${corRp(t.nilai)}</span></span>
          </div>
          <div style="height:22px;background:var(--bg2);border-radius:6px;overflow:hidden">
            <div style="width:${w}%;height:100%;background:linear-gradient(90deg,var(--teal),var(--accent));
                        border-radius:6px;transition:width var(--dur,.22s) var(--ease,ease)"></div>
          </div></div>`;
      }).join('')}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">
      <div class="card" style="padding:14px">
        <div style="font-size:12.5px;font-weight:700;margin-bottom:8px">Status penawaran</div>
        ${[['Menunggu jawaban', pnw.terkirim, 'var(--info)'],
           ['Diterima', pnw.diterima, 'var(--success-strong)'],
           ['Ditolak', pnw.ditolak, 'var(--danger-strong)']]
          .map(([l, v, c]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;
              border-bottom:1px solid var(--border);font-size:12.5px">
              <span style="color:var(--text3)">${l}</span>
              <strong style="color:${c}">${Number(v || 0)}</strong></div>`).join('')}
        <div style="font-size:11px;color:var(--text3);margin-top:9px;line-height:1.5">
          Tingkat menang dihitung dari yang sudah dijawab saja — penawaran yang
          masih menunggu tidak dihitung sebagai kalah.</div>
      </div>
      ${corSumber()}
    </div>`;
}

function corSumber() {
  const rows = (corData && corData.sumber_prospek) || [];
  if (!rows.length) return '';
  const maks = Math.max(1, ...rows.map(r => Number(r.jumlah) || 0));
  return `<div class="card" style="padding:14px">
    <div style="font-size:12.5px;font-weight:700;margin-bottom:8px">Sumber prospek</div>
    ${rows.map(r => {
      const w = ((Number(r.jumlah) || 0) / maks * 100).toFixed(0);
      return `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span>${r.sumber}</span><span style="color:var(--text3)">${r.jumlah} · ${corRp(r.nilai)}</span></div>
        <div style="height:6px;background:var(--bg2);border-radius:3px;overflow:hidden">
          <div style="width:${w}%;height:100%;background:var(--teal);border-radius:3px"></div></div>
      </div>`; }).join('')}
    <div style="font-size:11px;color:var(--text3);margin-top:6px">
      Menunjukkan kanal mana yang layak ditambah anggarannya.</div></div>`;
}

window.renderSalesCorong = renderSalesCorong;
window.corUbahRentang = corUbahRentang;
