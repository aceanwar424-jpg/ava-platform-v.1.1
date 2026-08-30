// ═══════════════════════════════════════════════════════════════
// MODUL: Master Katalog Tes & Ekspor LIS
//
// Versi sebelumnya tidak punya panggilan data, dan yang dikarang bukan
// sekadar daftar: rentang rujukan ikut ditulis tangan di berkas ini —
// Hb 12–16, glukosa puasa 70–99, AMH 1,5–4,0 — lengkap dengan
// keterangan sumber yang terdengar meyakinkan.
//
// Rentang rujukan adalah angka yang menentukan hasil pasien disebut
// normal atau tidak. Ia bergantung pada metode, reagen, dan populasi
// pasien tiap lab, dan wajib divalidasi sebelum dipakai. Menuliskannya
// di berkas tampilan berarti angka itu berubah hanya kalau ada yang
// menyunting kode, tanpa jejak siapa menetapkannya — dan itu persis
// yang tidak boleh pada dokumen yang diperiksa saat akreditasi.
//
// Sekarang membaca public.products dan public.ref_ranges yang sudah ada.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Pemeriksaan yang BELUM punya rentang rujukan ditandai menyala, bukan
// disembunyikan. Katalog yang terlihat lengkap padahal separuhnya belum
// punya rujukan adalah katalog yang menyesatkan penggunanya.
//
// Ekspor hanya menyertakan yang punya rujukan lengkap. Mengekspor baris
// setengah jadi ke LIS pihak lain memindahkan lubangnya ke sistem orang.
//
// Prefiks "ce".
// ═══════════════════════════════════════════════════════════════

let ceData = null;
let ceHanyaLengkap = false;

function ceEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function ceMuat() {
  if (typeof sbGet !== 'function') { ceData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [produk, rujukan] = await Promise.all([
      sbGet('products', 'select=*&order=nama_tes&limit=2000'),
      aman('ref_ranges', 'select=*&limit=5000'),
    ]);
    ceData = { produk, rujukan };
  } catch (e) { ceData = null; }
}

async function renderCatalogExport() {
  const content = document.getElementById('main-content');
  if (!content) return;
  content.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await ceMuat();

  if (ceData === null) {
    content.innerHTML = `
      <div class="page-header"><div><h1>Master Katalog Tes</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Katalog tidak dapat dibaca.</strong><br>
        Tabel <code>products</code> belum tersedia.
      </div>`;
    return;
  }
  ceGambar();
}

function ceRujukanOf(productId) {
  return (ceData.rujukan || []).filter(r => r.product_id === productId);
}

// Siap ekspor bila punya kode, LOINC, satuan, dan minimal satu rentang
// rujukan dengan batas yang terisi.
function ceLengkap(p) {
  const r = ceRujukanOf(p.id);
  const adaRentang = r.some(x =>
    x.range_min !== null && x.range_min !== undefined
    && x.range_max !== null && x.range_max !== undefined);
  return !!(p.kode_internal && p.loinc_code && p.satuan_hasil && adaRentang);
}

function ceKurang(p) {
  const k = [];
  if (!p.kode_internal) k.push('kode');
  if (!p.loinc_code) k.push('LOINC');
  if (!p.satuan_hasil) k.push('satuan');
  if (!ceRujukanOf(p.id).some(x => x.range_min != null && x.range_max != null)) {
    k.push('rentang rujukan');
  }
  return k;
}

function ceGambar() {
  const P = ceData.produk || [];
  const lengkap = P.filter(ceLengkap);
  const belum = P.filter(p => !ceLengkap(p));
  const daftar = ceHanyaLengkap ? lengkap : P;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Master Katalog Tes &amp; Ekspor LIS</h1>
        <p class="muted">Katalog pemeriksaan dengan pemetaan LOINC dan rentang rujukan.</p>
      </div>
      ${lengkap.length ? `<div><button class="btn btn-primary" onclick="ceEkspor()">
        Ekspor CSV (${lengkap.length} siap)</button></div>` : ''}
    </div>

    ${!P.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">📚</div>
        <div style="font-weight:700; margin-bottom:6px">Katalog pemeriksaan masih kosong</div>
        <div style="font-size:13px; color:var(--text3); max-width:520px; margin:0 auto;
                    line-height:1.8">
          Versi sebelumnya menampilkan contoh rentang rujukan yang ditulis
          di berkas tampilan. Rentang rujukan menentukan hasil pasien
          disebut normal atau tidak, bergantung metode dan reagen tiap lab,
          dan wajib divalidasi sebelum dipakai — jadi ia harus datang dari
          master lab ini sendiri.
        </div>
      </div>` : `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
                  gap:12px; margin-bottom:16px">
        <div class="card" style="padding:14px">
          <div style="font-size:12px; color:var(--text3)">Pemeriksaan terdaftar</div>
          <div style="font-size:22px; font-weight:800">${P.length}</div>
        </div>
        <div class="card" style="padding:14px">
          <div style="font-size:12px; color:var(--text3)">Siap diekspor</div>
          <div style="font-size:22px; font-weight:800; color:var(--success)">${lengkap.length}</div>
        </div>
        <div class="card" style="padding:14px">
          <div style="font-size:12px; color:var(--text3)">Belum lengkap</div>
          <div style="font-size:22px; font-weight:800;
                      color:${belum.length ? 'var(--warning)' : 'var(--text3)'}">
            ${belum.length}</div>
        </div>
      </div>

      ${belum.length ? `
        <div class="card" style="padding:12px 16px; margin-bottom:12px;
                                 border-left:3px solid var(--warning)">
          <b>${belum.length} pemeriksaan belum lengkap</b> dan tidak ikut
          diekspor. Mengekspor baris setengah jadi ke LIS pihak lain hanya
          memindahkan lubangnya ke sistem orang.
        </div>` : ''}

      <div class="card" style="padding:10px 16px; margin-bottom:12px">
        <label style="font-size:13px; cursor:pointer">
          <input type="checkbox" ${ceHanyaLengkap ? 'checked' : ''}
                 onchange="ceSaring(this.checked)"> Tampilkan hanya yang siap diekspor
        </label>
      </div>

      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Kode</th><th>Pemeriksaan</th><th>Kategori</th>
          <th>LOINC</th><th>Satuan</th><th>Metode</th>
          <th>Rentang Rujukan</th><th>Status</th>
        </tr></thead><tbody>
        ${daftar.map(p => {
          const r = ceRujukanOf(p.id);
          const ok = ceLengkap(p);
          const kurang = ceKurang(p);
          return `<tr style="${ok ? '' : 'background:rgba(255,180,0,.05)'}">
            <td><b>${ceEsc(p.kode_internal || '—')}</b></td>
            <td>${ceEsc(p.nama_tes)}</td>
            <td style="font-size:12px">${ceEsc(p.kategori || '—')}</td>
            <td style="font-size:12px">${p.loinc_code
              ? ceEsc(p.loinc_code)
              : '<span style="color:var(--warning)">belum dipetakan</span>'}</td>
            <td style="font-size:12px">${ceEsc(p.satuan_hasil || '—')}</td>
            <td style="font-size:12px">${ceEsc(p.metode || '—')}</td>
            <td style="font-size:12px">${r.length
              ? r.slice(0, 3).map(x =>
                  `${x.range_min ?? '?'}–${x.range_max ?? '?'} ${ceEsc(x.unit || '')}`
                  + (x.gender && x.gender !== 'All' ? ` (${ceEsc(x.gender)})` : '')
                  + (x.condition_name && x.condition_name !== 'Normal'
                      ? ` [${ceEsc(x.condition_name)}]` : '')
                ).join('<br>') + (r.length > 3 ? `<br>+${r.length - 3} lagi` : '')
              : '<span style="color:var(--warning)">belum ditetapkan</span>'}</td>
            <td>${ok
              ? '<span style="color:var(--success); font-weight:600">siap</span>'
              : `<span style="color:var(--warning); font-size:11px">
                   kurang: ${kurang.join(', ')}</span>`}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>

      <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                               color:var(--text3); line-height:1.7">
        Rentang rujukan dibaca dari <code>ref_ranges</code>, bukan ditulis
        di berkas ini. Ia menentukan hasil pasien disebut normal atau
        tidak, bergantung metode dan populasi tiap lab, dan harus punya
        jejak siapa menetapkannya.
      </div>`}`;
}

function ceSaring(v) { ceHanyaLengkap = v; ceGambar(); }

function ceEkspor() {
  const lengkap = (ceData.produk || []).filter(ceLengkap);
  if (!lengkap.length) { alert('Tidak ada pemeriksaan yang siap diekspor.'); return; }

  const baris = [[
    'kode_material', 'nama_pemeriksaan', 'kategori', 'loinc_obx3', 'ucum_obx6',
    'metode', 'gender', 'usia_min', 'usia_max', 'kondisi',
    'batas_bawah', 'batas_atas', 'kritis_bawah', 'kritis_atas', 'interpretasi',
  ]];

  for (const p of lengkap) {
    // Panel dipecah menjadi satu baris per rentang: satu pemeriksaan bisa
    // punya rujukan berbeda per jenis kelamin dan usia, dan menggabungkannya
    // jadi satu baris menghilangkan perbedaan itu.
    for (const r of ceRujukanOf(p.id)) {
      if (r.range_min == null || r.range_max == null) continue;
      baris.push([
        p.kode_internal, p.nama_tes, p.kategori || '', p.loinc_code,
        r.unit || p.satuan_hasil || '', p.metode || '',
        r.gender || 'All', r.age_min ?? '', r.age_max ?? '',
        r.condition_name || 'Normal',
        r.range_min, r.range_max,
        r.critical_low ?? '', r.critical_high ?? '',
        r.interpretation || '',
      ]);
    }
  }

  const csv = baris.map(b => b.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `katalog-tes-ava-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

window.renderCatalogExport = renderCatalogExport;
window.ceSaring = ceSaring;
window.ceEkspor = ceEkspor;
