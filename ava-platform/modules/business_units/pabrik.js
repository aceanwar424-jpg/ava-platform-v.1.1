// ═══════════════════════════════════════════════════════════════
// MODUL: Pabrik — Formulasi & R&D, Perintah Produksi, Maklon, Uji Mutu
//
// Tiga menu di kategori Wellness berstatus "belum" karena memang tidak
// ada apa pun di belakangnya. Modul ini yang mengisinya, di atas
// migrasi 0037.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Kebutuhan bahan ditampilkan SEBELUM produksi dimulai, lengkap dengan
// berapa yang kurang. Mengetahui kekurangan bahan saat mesin sudah
// menyala berarti satu batch setengah jadi yang tidak bisa diapa-apakan.
//
// Rendemen (hasil nyata dibanding rencana) ditampilkan apa adanya,
// termasuk ketika di bawah 100%. Menyembunyikannya membuat susut yang
// membengkak tidak pernah ketahuan sampai stok opname.
//
// Batch hasil produksi masuk KARANTINA, bukan langsung siap jual.
// Statusnya baru berubah setelah semua uji mutu untuk batch itu lulus —
// bukan setelah uji pertama.
//
// Perintah produksi maklon ditandai jelas, karena hasilnya bukan milik
// AVA dan tidak boleh masuk stok jualan sendiri.
//
// Prefiks "pb".
// ═══════════════════════════════════════════════════════════════

let PB_TAB = 'produksi';
let pbData = null;

function pbEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function pbRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function pbTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function pbMuat() {
  if (typeof sbGet !== 'function') { pbData = null; return; }
  try {
    const [papan, formula, bom, maklon, uji, produk, bahan] = await Promise.all([
      sbGet('pabrik_papan', 'select=*&order=tgl_rencana.desc&limit=200'),
      sbGet('pabrik_formula', 'select=*&order=kode,versi.desc'),
      sbGet('pabrik_bom', 'select=*'),
      sbGet('pabrik_maklon', 'select=*&order=tgl_kontrak.desc'),
      sbGet('pabrik_uji_mutu', 'select=*&order=tgl_kirim.desc&limit=200'),
      sbGet('wellness_produk', 'select=id,sku,nama,merek&order=nama'),
      sbGet('inventory_items', 'select=id,item_name,unit,stock_qty&order=item_name'),
    ]);
    pbData = { papan, formula, bom, maklon, uji, produk, bahan };
  } catch (e) {
    pbData = null;
  }
}

async function renderPabrik(params) {
  if (params && params.tab) PB_TAB = params.tab;
  document.getElementById('main-content').innerHTML =
    '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await pbMuat();

  if (pbData === null) {
    document.getElementById('main-content').innerHTML = `
      <div class="page-header"><div><h1>Pabrik</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data produksi tidak dapat dibaca.</strong><br>
        Tabel <code>pabrik_wo</code> dan kawan-kawannya belum ada.
        Jalankan ulang aplikasi agar migrasi
        <code>0037_pabrik_produksi_maklon.sql</code> terpasang.
      </div>`;
    return;
  }
  pbGambar();
}

function pbGambar() {
  const tabs = [
    ['produksi', 'Perintah Produksi'],
    ['formula',  'Formulasi & R&D'],
    ['maklon',   'Kemitraan Maklon'],
    ['mutu',     'Uji Mutu'],
  ];

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Pabrik</h1>
        <p class="muted">Formulasi, perintah produksi, maklon, dan uji mutu produk.</p>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px">
      ${tabs.map(([k, l]) => `
        <button class="tab ${PB_TAB === k ? 'active' : ''}"
                onclick="pbGantiTab('${k}')">${l}</button>`).join('')}
    </div>

    <div id="pb-isi">${
      PB_TAB === 'produksi' ? pbTabProduksi() :
      PB_TAB === 'formula'  ? pbTabFormula()  :
      PB_TAB === 'maklon'   ? pbTabMaklon()   : pbTabMutu()
    }</div>`;
}

function pbGantiTab(t) { PB_TAB = t; pbGambar(); }

// ── Tab: perintah produksi ───────────────────────────────────────
function pbTabProduksi() {
  const W = pbData.papan || [];
  if (!W.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🏭</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada perintah produksi</div>
      <div style="font-size:13px; color:var(--text3)">
        Formulasi yang sudah disetujui bisa dijadikan perintah produksi.</div>
    </div>`;
  }

  const warna = {
    'Direncanakan': 'var(--info)', 'Produksi': 'var(--warning)',
    'Selesai': 'var(--success)', 'Batal': 'var(--text3)',
  };

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>No. WO</th><th>Produk</th><th>Formula</th>
      <th style="text-align:right">Rencana</th>
      <th style="text-align:right">Hasil</th>
      <th style="text-align:right">Rendemen</th>
      <th>Batch</th><th>Uji Mutu</th><th>Status</th><th></th>
    </tr></thead><tbody>
    ${W.map(w => `<tr>
      <td><b>${pbEsc(w.no_wo)}</b>
        ${w.is_maklon ? '<div><span class="badge" style="background:var(--warning);'
          + 'color:#fff">MAKLON</span></div>' : ''}</td>
      <td>${w.is_maklon
        ? pbEsc(w.klien_nama || '—') + '<div style="font-size:11px; color:var(--text3)">'
          + pbEsc(w.merek_klien || '') + '</div>'
        : pbEsc(w.nama_produk || '—')}</td>
      <td style="font-size:12px">${pbEsc(w.kode_formula || '—')}
        ${w.versi_formula ? ' v' + w.versi_formula : ''}</td>
      <td style="text-align:right">${Number(w.qty_rencana || 0)}</td>
      <td style="text-align:right">${Number(w.qty_hasil || 0) || '—'}</td>
      <td style="text-align:right; ${Number(w.rendemen_pct) && Number(w.rendemen_pct) < 90
        ? 'color:var(--danger); font-weight:700' : ''}">
        ${w.rendemen_pct ? Number(w.rendemen_pct).toFixed(1) + '%' : '—'}</td>
      <td style="font-size:12px">${pbEsc(w.no_batch || '—')}</td>
      <td style="font-size:12px">${Number(w.uji_total)
        ? `${w.uji_lulus}/${w.uji_total} lulus` : '—'}</td>
      <td><span style="color:${warna[w.status] || 'var(--text3)'}; font-weight:600">
        ${pbEsc(w.status)}</span></td>
      <td style="white-space:nowrap">
        ${w.status === 'Direncanakan' ? `
          <button class="btn btn-sm" onclick="pbCekBahan(${w.id})">Cek Bahan</button>
          <button class="btn btn-sm btn-primary" onclick="pbMulai(${w.id})">Mulai</button>` : ''}
        ${w.status === 'Produksi'
          ? `<button class="btn btn-sm btn-primary" onclick="pbSelesai(${w.id}, ${w.qty_rencana})">
               Selesaikan</button>` : ''}
      </td>
    </tr>`).join('')}
    </tbody></table>
  </div>`;
}

// ── Tab: formulasi ───────────────────────────────────────────────
function pbTabFormula() {
  const F = pbData.formula || [];
  if (!F.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🧪</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada formulasi tercatat</div>
      <div style="font-size:13px; color:var(--text3)">
        Resep disimpan berversi — versi baru jadi baris baru, supaya batch
        yang sudah beredar tetap punya catatan dibuat dengan resep yang mana.</div>
    </div>`;
  }

  const namaProduk = id => (pbData.produk.find(p => p.id === id) || {}).nama || '—';
  const bomOf = id => (pbData.bom || []).filter(b => b.formula_id === id);

  const warna = {
    'Draf': 'var(--text3)', 'Uji Coba': 'var(--warning)',
    'Disetujui': 'var(--success)', 'Ditarik': 'var(--danger)',
  };

  return `<div style="display:grid; gap:12px">
    ${F.map(f => {
      const bom = bomOf(f.id);
      return `<div class="card" style="padding:16px">
        <div style="display:flex; justify-content:space-between; align-items:start;
                    flex-wrap:wrap; gap:8px">
          <div>
            <div style="font-weight:700">${pbEsc(f.nama)}
              <span style="font-size:12px; color:var(--text3)">
                ${pbEsc(f.kode)} · versi ${f.versi}</span></div>
            <div style="font-size:12px; color:var(--text3); margin-top:2px">
              ${pbEsc(namaProduk(f.produk_id))}
              ${f.bentuk ? ' · ' + pbEsc(f.bentuk) : ''}
              ${f.batch_standar ? ' · batch standar ' + Number(f.batch_standar)
                + ' ' + pbEsc(f.satuan_batch || '') : ''}
            </div>
          </div>
          <span style="color:${warna[f.status] || 'var(--text3)'}; font-weight:600;
                       font-size:13px">${pbEsc(f.status)}</span>
        </div>

        ${!bom.length ? `
          <div style="margin-top:10px; font-size:12px; color:var(--danger)">
            ⚠ Belum ada bahan (BOM). Perintah produksi dari formula ini akan ditolak.
          </div>` : `
          <table class="data-table" style="margin-top:10px"><thead><tr>
            <th>Bahan</th><th>Fungsi</th>
            <th style="text-align:right">Jumlah</th>
            <th style="text-align:right">Susut</th>
          </tr></thead><tbody>
          ${bom.map(b => `<tr>
            <td>${pbEsc(b.nama_bahan || '—')}</td>
            <td style="font-size:12px; color:var(--text3)">${pbEsc(b.fungsi || '—')}</td>
            <td style="text-align:right">${Number(b.qty)} ${pbEsc(b.satuan || '')}</td>
            <td style="text-align:right">${Number(b.susut_pct || 0)}%</td>
          </tr>`).join('')}
          </tbody></table>`}

        ${f.catatan_rnd ? `<div style="margin-top:10px; font-size:12px; color:var(--text3)">
          ${pbEsc(f.catatan_rnd)}</div>` : ''}
        ${f.tgl_setuju ? `<div style="margin-top:6px; font-size:11px; color:var(--text3)">
          Disetujui ${pbEsc(f.disetujui_oleh || '')} · ${pbTgl(f.tgl_setuju)}</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// ── Tab: maklon ──────────────────────────────────────────────────
function pbTabMaklon() {
  const M = pbData.maklon || [];
  if (!M.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🤝</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada kontrak maklon</div>
      <div style="font-size:13px; color:var(--text3)">
        Maklon: AVA memproduksi untuk merek pihak lain. Hasilnya milik klien
        dan tidak masuk stok jualan AVA.</div>
    </div>`;
  }

  const warna = {
    'Penjajakan': 'var(--text3)', 'Sampel': 'var(--info)', 'Kontrak': 'var(--info)',
    'Produksi': 'var(--warning)', 'Selesai': 'var(--success)', 'Batal': 'var(--text3)',
  };

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>No. Kontrak</th><th>Klien</th><th>Merek</th><th>Produk</th>
      <th style="text-align:right">Kontrak</th>
      <th style="text-align:right">Terkirim</th>
      <th style="text-align:right">Nilai</th>
      <th>Target</th><th>Status</th>
    </tr></thead><tbody>
    ${M.map(m => {
      const pct = Number(m.qty_kontrak)
        ? Math.round(Number(m.qty_terkirim || 0) / Number(m.qty_kontrak) * 100) : 0;
      return `<tr>
        <td><b>${pbEsc(m.no_kontrak || '—')}</b></td>
        <td>${pbEsc(m.klien_nama)}
          ${m.klien_pic ? `<div style="font-size:11px; color:var(--text3)">
            ${pbEsc(m.klien_pic)}</div>` : ''}</td>
        <td>${pbEsc(m.merek_klien || '—')}</td>
        <td>${pbEsc(m.produk_nama || '—')}</td>
        <td style="text-align:right">${Number(m.qty_kontrak || 0)}</td>
        <td style="text-align:right">${Number(m.qty_terkirim || 0)}
          <div style="font-size:11px; color:var(--text3)">${pct}%</div></td>
        <td style="text-align:right">${pbRp(m.nilai_kontrak)}</td>
        <td>${pbTgl(m.tgl_target)}</td>
        <td><span style="color:${warna[m.status] || 'var(--text3)'}; font-weight:600">
          ${pbEsc(m.status)}</span></td>
      </tr>`;
    }).join('')}
    </tbody></table>
  </div>`;
}

// ── Tab: uji mutu ────────────────────────────────────────────────
function pbTabMutu() {
  const U = pbData.uji || [];
  if (!U.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🔬</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada uji mutu tercatat</div>
      <div style="font-size:13px; color:var(--text3)">
        Batch hasil produksi tetap berstatus Karantina sampai semua uji lulus.</div>
    </div>`;
  }

  const warna = {
    'Dikirim': 'var(--info)', 'Diproses': 'var(--warning)',
    'Lulus': 'var(--success)', 'Tidak Lulus': 'var(--danger)',
  };

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Batch baru keluar dari karantina setelah <b>seluruh</b> uji yang
      dijadwalkan untuknya lulus — bukan setelah uji pertama. Satu uji
      tidak lulus langsung menolak batch dan menolkan sisanya.
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>No. Uji</th><th>Jenis</th><th>Lab</th>
        <th>Dikirim</th><th>Hasil</th><th>Sertifikat</th><th>Status</th><th></th>
      </tr></thead><tbody>
      ${U.map(u => `<tr>
        <td><b>${pbEsc(u.no_uji || '—')}</b></td>
        <td>${pbEsc(u.jenis_uji || '—')}</td>
        <td>${pbEsc(u.lab_tujuan || '—')}</td>
        <td>${pbTgl(u.tgl_kirim)}</td>
        <td>${pbTgl(u.tgl_hasil)}
          ${u.kesimpulan ? `<div style="font-size:11px; color:var(--text3)">
            ${pbEsc(u.kesimpulan)}</div>` : ''}</td>
        <td style="font-size:12px">${pbEsc(u.no_sertifikat || '—')}</td>
        <td><span style="color:${warna[u.status] || 'var(--text3)'}; font-weight:600">
          ${pbEsc(u.status)}</span></td>
        <td>${(u.status === 'Dikirim' || u.status === 'Diproses')
          ? `<button class="btn btn-sm" onclick="pbCatatUji(${u.id})">Catat Hasil</button>` : ''}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

// ── Tindakan ─────────────────────────────────────────────────────
async function pbCekBahan(woId) {
  const w = pbData.papan.find(x => x.id === woId);
  if (!w) return;
  try {
    const r = await sbRpc('pabrik_cek_bahan', {
      p_formula_id: (pbData.formula.find(f =>
        f.kode === w.kode_formula && f.versi === w.versi_formula) || {}).id,
      p_qty: w.qty_rencana,
    });
    if (r && r.error) { alert(r.error); return; }

    const baris = (r.bahan || []).map(b =>
      `${b.cukup ? '✔' : '✘'} ${b.nama}: butuh ${b.butuh} ${b.satuan || ''}, `
      + `tersedia ${b.tersedia}${b.cukup ? '' : ` — KURANG ${b.kurang}`}`).join('\n');
    alert(`Kebutuhan bahan untuk ${w.no_wo} (${w.qty_rencana} unit):\n\n${baris}\n\n`
        + (r.cukup ? 'Semua bahan mencukupi.' : 'Bahan TIDAK mencukupi — produksi akan ditolak.'));
  } catch (e) { alert('Gagal memeriksa bahan: ' + e.message); }
}

async function pbMulai(woId) {
  if (!confirm('Mulai produksi? Bahan baku akan dipotong dari gudang.')) return;
  try {
    const r = await sbRpc('pabrik_mulai_produksi', {
      p_wo_id: woId, p_oleh: (window.currentUsername || 'operator'),
    });
    if (r && r.error) {
      const kurang = (r.bahan || []).filter(b => !b.cukup)
        .map(b => `• ${b.nama}: kurang ${b.kurang} ${b.satuan || ''}`).join('\n');
      alert(r.error + (kurang ? '\n\n' + kurang : ''));
      return;
    }
    alert(`Produksi ${r.no_wo} dimulai. Bahan sudah dipotong dari gudang.`);
    await renderPabrik();
  } catch (e) { alert('Gagal memulai produksi: ' + e.message); }
}

async function pbSelesai(woId, rencana) {
  const hasil = prompt(
    `Jumlah hasil produksi yang benar-benar jadi\n(rencana: ${rencana}):`, String(rencana));
  if (!hasil) return;
  const batch = prompt('Nomor batch (kosongkan untuk dibuatkan otomatis):', '');
  if (batch === null) return;
  const exp = prompt('Tanggal kedaluwarsa (YYYY-MM-DD, kosongkan untuk dihitung '
    + 'dari masa simpan produk):', '');
  if (exp === null) return;

  try {
    const r = await sbRpc('pabrik_selesai_produksi', {
      p_wo_id: woId, p_qty_hasil: parseFloat(hasil),
      p_no_batch: batch || null, p_tgl_kedaluwarsa: exp || null,
      p_oleh: (window.currentUsername || 'operator'),
    });
    if (r && r.error) { alert(r.error); return; }

    alert(`Produksi ${r.no_wo} selesai.\n\n`
      + `Batch: ${r.no_batch}\n`
      + `Hasil: ${r.qty_hasil} (rendemen ${r.rendemen_pct}%)\n`
      + `HPP per unit: ${pbRp(r.hpp_per_unit)}\n\n`
      + (r.batch && r.batch.maklon
        ? 'Hasil maklon — tidak masuk stok AVA, tercatat di kontrak klien.'
        : 'Batch masuk KARANTINA. Catat uji mutu agar bisa dijual.'));
    await renderPabrik();
  } catch (e) { alert('Gagal menyelesaikan produksi: ' + e.message); }
}

async function pbCatatUji(ujiId) {
  const status = prompt('Hasil uji — ketik: lulus / tidak lulus / diproses');
  if (!status) return;
  const kesimpulan = prompt('Kesimpulan / catatan:', '');
  if (kesimpulan === null) return;
  const sertifikat = (status.toLowerCase() === 'lulus')
    ? prompt('Nomor sertifikat (opsional):', '') : null;

  try {
    const r = await sbRpc('pabrik_catat_uji', {
      p_uji_id: ujiId, p_status: status, p_kesimpulan: kesimpulan || null,
      p_no_sertifikat: sertifikat || null,
      p_oleh: (window.currentUsername || 'QC'),
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Hasil uji tercatat.\n\nStatus batch sekarang: ${r.batch || r.status}`
      + (r.catatan ? `\n${r.catatan}` : ''));
    await renderPabrik();
  } catch (e) { alert('Gagal mencatat hasil uji: ' + e.message); }
}

window.renderPabrik = renderPabrik;
window.pbGantiTab   = pbGantiTab;
window.pbCekBahan   = pbCekBahan;
window.pbMulai      = pbMulai;
window.pbSelesai    = pbSelesai;
window.pbCatatUji   = pbCatatUji;
