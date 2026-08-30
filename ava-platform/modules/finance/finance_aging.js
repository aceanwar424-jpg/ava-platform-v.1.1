// ═══════════════════════════════════════════════════════════════
// MODULE: Umur Piutang (AR Aging)
//
// Audit kematangan menempatkan Finance di 12% — terendah dari seluruh
// domain. Penyebab terbesarnya bukan fitur yang rumit, melainkan absennya
// satu layar sederhana: tagihan yang lewat jatuh tempo hanya bisa dilihat
// satu per satu, tidak pernah sebagai gambaran utuh.
//
// Di klinik, kas bocor justru di sini — bukan karena tidak menagih, tapi
// karena tidak ada yang tahu tagihan mana yang paling tua.
//
// Semua angka berasal dari tabel invoices. Bila kosong, layar ini
// mengatakan kosong.
//
// Prefiks "ar" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let arData = null;
let arEmberAktif = null;   // penyaring ember umur

const AR_EMBER = [
  { k: 'belum_jatuh_tempo', label: 'Belum jatuh tempo', warna: 'var(--success-strong)' },
  { k: 'lewat_1_30',        label: '1–30 hari',         warna: 'var(--gold)' },
  { k: 'lewat_31_60',       label: '31–60 hari',        warna: 'var(--warn-deep)' },
  { k: 'lewat_61_90',       label: '61–90 hari',        warna: 'var(--danger-strong)' },
  { k: 'lewat_90_plus',     label: '> 90 hari',         warna: 'var(--danger-deep)' },
];

const arRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

async function renderArAging() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Umur Piutang</h1>
        <p style="color:var(--text3);font-size:13px">
          Tagihan belum lunas dikelompokkan menurut lama lewat jatuh tempo</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="arEkspor()">Ekspor CSV</button>
        <button class="btn btn-teal btn-sm" onclick="renderArAging()">Muat Ulang</button>
      </div>
    </div>
    <div id="ar-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;

  await arMuat();
  arGambar();
}

async function arMuat() {
  try {
    const d = await sbRpc('ar_aging', {});
    arData = (d && typeof d === 'object') ? d : null;
  } catch (e) {
    arData = { _galat: e.message || String(e) };
  }
}

function arGambar() {
  const el = document.getElementById('ar-isi');
  if (!el) return;

  if (arData && arData._galat) {
    el.innerHTML = `<div class="card" style="padding:18px;border-color:var(--danger-tint)">
      <strong style="color:var(--danger-strong)">Gagal memuat</strong>
      <div style="font-size:12.5px;color:var(--text3);margin-top:6px">${arData._galat}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:8px">
        Jalankan migrasi <code>0011_ar_aging_tat.sql</code> bila fungsi belum tersedia.</div></div>`;
    return;
  }

  const per = (arData && arData.per_ember) || {};
  const total = Number((arData && arData.total_piutang) || 0);
  const lewat = Number((arData && arData.total_lewat_tempo) || 0);
  const daftar = (arData && arData.daftar) || [];

  if (!total && !daftar.length) {
    el.innerHTML = `<div class="card" style="padding:26px;text-align:center">
      <div style="font-size:13.5px;font-weight:700;margin-bottom:6px">Tidak ada piutang tercatat</div>
      <div style="font-size:12.5px;color:var(--text3)">
        Semua tagihan sudah lunas, atau belum ada invoice yang dibuat.</div></div>`;
    return;
  }

  const persenLewat = total ? (lewat / total * 100) : 0;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:14px">
      ${[['Total piutang', arRp(total), 'var(--navy)'],
         ['Lewat jatuh tempo', arRp(lewat), lewat ? 'var(--danger-strong)' : 'var(--text3)'],
         ['Porsi lewat tempo', persenLewat.toFixed(1) + '%', persenLewat > 30 ? 'var(--danger-strong)' : 'var(--text2)'],
         ['Tagihan terbuka', daftar.length + ' invoice', 'var(--text2)']]
        .map(([l, v, c]) => `<div class="card" style="padding:13px">
            <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${l}</div>
            <div style="font-size:19px;font-weight:800;color:${c};margin-top:3px">${v}</div>
          </div>`).join('')}
    </div>

    <div class="card" style="padding:16px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px">Sebaran umur</div>
      ${arBatang(per, total)}
      <div style="font-size:11.5px;color:var(--text3);margin-top:10px">
        Klik salah satu kelompok untuk menyaring daftar di bawah.
      </div>
    </div>

    ${arTabelPartner()}
    ${arTabelDaftar(daftar)}`;
}

function arBatang(per, total) {
  return `<div style="display:flex;height:26px;border-radius:8px;overflow:hidden;margin-bottom:12px">
      ${AR_EMBER.map(e => {
        const n = (per[e.k] && Number(per[e.k].nilai)) || 0;
        const w = total ? (n / total * 100) : 0;
        if (w <= 0) return '';
        return `<div title="${e.label}: ${arRp(n)}" style="width:${w}%;background:${e.warna};
                  cursor:pointer" onclick="arSaring('${e.k}')"></div>`;
      }).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
      ${AR_EMBER.map(e => {
        const b = per[e.k] || { jumlah: 0, nilai: 0 };
        const aktif = arEmberAktif === e.k;
        return `<div onclick="arSaring('${e.k}')" style="cursor:pointer;padding:9px 11px;border-radius:9px;
                  border:1px solid ${aktif ? e.warna : 'var(--border)'};background:${aktif ? 'var(--bg2)' : 'transparent'}">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:2px;background:${e.warna}"></span>
              <span style="font-size:11.5px;color:var(--text3)">${e.label}</span>
            </div>
            <div style="font-size:14px;font-weight:800;margin-top:3px">${arRp(b.nilai)}</div>
            <div style="font-size:11px;color:var(--text3)">${b.jumlah || 0} invoice</div>
          </div>`;
      }).join('')}
    </div>`;
}

function arTabelPartner() {
  const rows = ((arData && arData.per_partner) || []).slice(0, 10);
  if (!rows.length) return '';
  return `<div class="card" style="padding:0;overflow:hidden;margin-bottom:14px">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
      Penunggak terbesar</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr style="color:var(--text3);text-align:left">
        <th style="padding:9px 16px">Pelanggan</th><th>Invoice</th>
        <th>Total</th><th>Lewat tempo</th><th style="padding-right:16px">Terlama</th></tr></thead>
      <tbody>${rows.map(r => `<tr style="border-top:1px solid var(--border)">
        <td style="padding:9px 16px;font-weight:600">${r.partner}</td>
        <td>${r.jumlah}</td>
        <td>${arRp(r.nilai)}</td>
        <td style="color:${Number(r.lewat_tempo) > 0 ? 'var(--danger-strong)' : 'var(--text3)'}">${arRp(r.lewat_tempo)}</td>
        <td style="padding-right:16px">${r.terlama > 0 ? r.terlama + ' hari' : '—'}</td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

function arTabelDaftar(daftar) {
  const rows = arEmberAktif ? daftar.filter(d => d.ember === arEmberAktif) : daftar;
  const judul = arEmberAktif
    ? `Daftar — ${(AR_EMBER.find(e => e.k === arEmberAktif) || {}).label}`
    : 'Daftar tagihan terbuka';
  return `<div class="card" style="padding:0;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center">
      <span style="font-size:13px;font-weight:700">${judul}</span>
      <span style="font-size:11.5px;color:var(--text3)">${rows.length} tagihan · paling tua di atas</span>
      ${arEmberAktif ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto"
        onclick="arSaring(null)">Tampilkan semua</button>` : ''}
    </div>
    ${rows.length ? `<div style="max-height:460px;overflow:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="color:var(--text3);text-align:left">
          <th style="padding:9px 16px">No. Invoice</th><th>Pelanggan</th>
          <th>Nilai</th><th>Jatuh tempo</th><th style="padding-right:16px">Lewat</th></tr></thead>
        <tbody>${rows.map(d => {
          const w = d.hari_lewat > 90 ? 'var(--danger-deep)' : d.hari_lewat > 60 ? 'var(--danger-strong)'
                  : d.hari_lewat > 30 ? 'var(--warn-deep)' : d.hari_lewat > 0 ? 'var(--gold)' : 'var(--text3)';
          return `<tr style="border-top:1px solid var(--border)">
            <td style="padding:9px 16px;font-family:monospace">${d.nomor || '—'}</td>
            <td>${d.partner || '—'}</td>
            <td style="font-weight:700">${arRp(d.nilai)}</td>
            <td>${d.jatuh_tempo || '—'}</td>
            <td style="padding-right:16px;color:${w};font-weight:700">
              ${d.hari_lewat > 0 ? d.hari_lewat + ' hari' : 'belum'}</td>
          </tr>`; }).join('')}</tbody></table></div>`
      : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:12.5px">
           Tidak ada tagihan pada kelompok ini.</div>`}
  </div>`;
}

function arSaring(ember) {
  arEmberAktif = (ember === arEmberAktif) ? null : ember;
  arGambar();
}

function arEkspor() {
  const rows = (arData && arData.daftar) || [];
  if (!rows.length) { if (typeof toast === 'function') toast('Tidak ada data untuk diekspor', 'warn'); return; }
  const baris = [['No. Invoice', 'Pelanggan', 'Nilai', 'Jatuh Tempo', 'Hari Lewat', 'Status']]
    .concat(rows.map(d => [d.nomor || '', d.partner || '', d.nilai || 0,
                           d.jatuh_tempo || '', d.hari_lewat || 0, d.status || '']));
  const csv = baris.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `umur-piutang-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  if (typeof toast === 'function') toast(`${rows.length} baris diekspor`, 'ok');
}

window.renderArAging = renderArAging;
window.arSaring = arSaring;
window.arEkspor = arEkspor;
