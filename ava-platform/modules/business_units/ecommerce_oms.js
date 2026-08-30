// ═══════════════════════════════════════════════════════════════
// MODUL: Pesanan D2C Multi-Kanal, Batch FEFO, Konsinyasi & Ekspedisi
//
// Versi sebelumnya (689 baris) tidak punya satu pun panggilan data.
// Daftar pesanan, angka stok, dan NOMOR RESI seluruhnya array yang
// ditulis tangan. Nomor resi karangan adalah yang paling berbahaya di
// antaranya: ia terlihat seperti bukti kirim, dan pembeli yang
// menanyakannya akan dijawab dengan nomor yang tidak pernah ada di
// sistem kurir mana pun.
//
// Sekarang seluruhnya membaca migrasi 0034 & 0035.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Alur pesanan dipaksa berurutan: Baru → Dikemas → Dikirim. Tombol
// "Kirim" tidak muncul sebelum dikemas, karena stok baru dipotong saat
// pengemasan. Membalik urutannya berarti resi terbit untuk barang yang
// belum tentu ada.
//
// Nomor batch yang terpakai tiap pesanan ditampilkan di rincian. Kalau
// suatu saat ada penarikan produk, inilah satu-satunya cara tahu batch
// bermasalah dikirim ke pembeli yang mana.
//
// Stok yang mendekati kedaluwarsa (90 hari) ditandai di tab Batch —
// bukan sebagai hiasan, tapi karena barang inilah yang harus didorong
// keluar lebih dulu atau ditarik sebelum jadi kerugian.
//
// Prefiks "om".
// ═══════════════════════════════════════════════════════════════

let OM_TAB = 'pesanan';
let omData = null;

function omEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function omRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function omTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const OM_KANAL = {
  shopee: 'Shopee', tiktok: 'TikTok Shop', tokopedia: 'Tokopedia',
  web: 'Web Sendiri', apotek: 'Apotek Mitra', reseller: 'Reseller',
};

async function omMuat() {
  if (typeof sbGet !== 'function') { omData = null; return; }
  try {
    const [pesanan, stok, batch, apotek, konsinyasi, kirim, kanal, langganan] =
      await Promise.all([
        sbGet('wellness_pesanan', 'select=*&order=tgl_pesan.desc&limit=200'),
        sbGet('wellness_stok', 'select=*&order=nama'),
        sbGet('wellness_batch', 'select=*&order=tgl_kedaluwarsa'),
        sbGet('wellness_apotek', 'select=*&order=nama'),
        sbGet('wellness_konsinyasi', 'select=*&order=tgl_titip.desc'),
        sbGet('wellness_pengiriman', 'select=*&order=tgl_kirim.desc&limit=200'),
        sbGet('wellness_penjualan_kanal', 'select=*'),
        sbGet('wellness_langganan_jatuh_tempo', 'select=*'),
      ]);
    omData = { pesanan, stok, batch, apotek, konsinyasi, kirim, kanal, langganan };
  } catch (e) {
    omData = null;
  }
}

async function renderEcommerceOms(params) {
  if (params && params.tab) OM_TAB = params.tab;
  document.getElementById('main-content').innerHTML =
    '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await omMuat();

  if (omData === null) {
    document.getElementById('main-content').innerHTML = `
      <div class="page-header"><div><h1>Pesanan D2C</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data penjualan tidak dapat dibaca.</strong><br>
        Tabel <code>wellness_pesanan</code> dan kawan-kawannya belum ada.
        Jalankan ulang aplikasi agar migrasi
        <code>0034_wellness_produk_batch_stok.sql</code> dan
        <code>0035_wellness_pesanan_d2c.sql</code> terpasang.
      </div>`;
    return;
  }
  omGambar();
}

function omGambar() {
  const tabs = [
    ['pesanan',   'Pesanan'],
    ['apotek',    'Konsinyasi Apotek'],
    ['batch',     'Batch & Stok FEFO'],
    ['shipping',  'Ekspedisi & Resi'],
    ['langganan', 'Langganan'],
  ];

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Pesanan D2C Multi-Kanal</h1>
        <p class="muted">Shopee, TikTok Shop, Tokopedia, web sendiri, apotek mitra.</p>
      </div>
    </div>

    ${omRingkas()}

    <div class="tabs" style="margin:16px 0">
      ${tabs.map(([k, l]) => `
        <button class="tab ${OM_TAB === k ? 'active' : ''}"
                onclick="omGantiTab('${k}')">${l}</button>`).join('')}
    </div>

    <div id="om-isi">${
      OM_TAB === 'pesanan'   ? omTabPesanan()   :
      OM_TAB === 'apotek'    ? omTabApotek()    :
      OM_TAB === 'batch'     ? omTabBatch()     :
      OM_TAB === 'shipping'  ? omTabKirim()     : omTabLangganan()
    }</div>`;
}

function omGantiTab(t) { OM_TAB = t; omGambar(); }

// ── Ringkasan per kanal ──────────────────────────────────────────
function omRingkas() {
  const K = omData.kanal || [];
  if (!K.length) return '';
  return `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
                       gap:12px">
    ${K.map(k => `
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">
          ${omEsc(OM_KANAL[k.kanal] || k.kanal)}</div>
        <div style="font-size:19px; font-weight:700; margin:4px 0">${omRp(k.omzet)}</div>
        <div style="font-size:11px; color:var(--text3)">
          ${k.jml_pesanan} pesanan · ${k.jml_selesai} selesai${
            Number(k.jml_batal) ? ` · <span style="color:var(--danger)">${k.jml_batal} batal</span>` : ''}
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Tab: pesanan ─────────────────────────────────────────────────
function omTabPesanan() {
  const P = omData.pesanan || [];
  if (!P.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📦</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada pesanan tercatat</div>
      <div style="font-size:13px; color:var(--text3)">
        Pesanan masuk dari kanal marketplace atau web akan muncul di sini.</div>
    </div>`;
  }

  const warna = {
    'Baru': 'var(--info)', 'Diproses': 'var(--info)', 'Dikemas': 'var(--warning)',
    'Dikirim': 'var(--primary)', 'Selesai': 'var(--success)',
    'Batal': 'var(--text3)', 'Retur': 'var(--danger)',
  };

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>No. Pesanan</th><th>Kanal</th><th>Tanggal</th><th>Pembeli</th>
      <th style="text-align:right">Total</th><th>Bayar</th><th>Status</th><th></th>
    </tr></thead><tbody>
    ${P.map(p => `<tr>
      <td><b>${omEsc(p.no_pesanan)}</b>${p.no_kanal
        ? `<div style="font-size:11px; color:var(--text3)">${omEsc(p.no_kanal)}</div>` : ''}</td>
      <td>${omEsc(OM_KANAL[p.kanal] || p.kanal)}</td>
      <td style="white-space:nowrap">${omTgl(p.tgl_pesan)}</td>
      <td>${omEsc(p.pembeli_nama || '—')}
        ${p.kota ? `<div style="font-size:11px; color:var(--text3)">${omEsc(p.kota)}</div>` : ''}</td>
      <td style="text-align:right">${omRp(p.total)}</td>
      <td style="font-size:12px">${omEsc(p.status_bayar)}</td>
      <td><span style="color:${warna[p.status] || 'var(--text3)'}; font-weight:600">
        ${omEsc(p.status)}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm" onclick="omRincian(${p.id})">Rincian</button>
        ${(p.status === 'Baru' || p.status === 'Diproses')
          ? `<button class="btn btn-sm btn-primary" onclick="omKemas(${p.id})">Kemas</button>` : ''}
        ${p.status === 'Dikemas'
          ? `<button class="btn btn-sm btn-primary" onclick="omKirim(${p.id})">Kirim</button>` : ''}
      </td>
    </tr>`).join('')}
    </tbody></table>
  </div>`;
}

// ── Tab: konsinyasi apotek ───────────────────────────────────────
function omTabApotek() {
  const A = omData.apotek || [], K = omData.konsinyasi || [];
  if (!A.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🏪</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada apotek mitra terdaftar</div>
      <div style="font-size:13px; color:var(--text3)">
        Barang konsinyasi tetap milik AVA sampai terjual — belum ada yang dititipkan.</div>
    </div>`;
  }

  const namaProduk = id => (omData.stok.find(s => s.produk_id === id) || {}).nama || '—';

  return `
    <div class="card" style="margin-bottom:12px; overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Kode</th><th>Apotek</th><th>Kota</th><th>PIC</th>
        <th style="text-align:right">Komisi</th><th>Status</th>
      </tr></thead><tbody>
      ${A.map(a => `<tr>
        <td>${omEsc(a.kode || '—')}</td><td><b>${omEsc(a.nama)}</b></td>
        <td>${omEsc(a.kota || '—')}</td><td>${omEsc(a.pic || '—')}</td>
        <td style="text-align:right">${Number(a.komisi_pct || 0)}%</td>
        <td>${omEsc(a.status)}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>

    ${!K.length ? `
      <div class="card" style="padding:24px; text-align:center; font-size:13px; color:var(--text3)">
        Belum ada barang yang dititipkan.</div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Apotek</th><th>Produk</th>
          <th style="text-align:right">Dititipkan</th>
          <th style="text-align:right">Terjual</th>
          <th style="text-align:right">Retur</th>
          <th style="text-align:right">Sisa di Apotek</th>
          <th>Tgl Titip</th><th>Status</th>
        </tr></thead><tbody>
        ${K.map(k => {
          const ap = A.find(x => x.id === k.apotek_id) || {};
          const sisa = Number(k.qty_titip || 0) - Number(k.qty_terjual || 0) - Number(k.qty_retur || 0);
          return `<tr>
            <td>${omEsc(ap.nama || '—')}</td>
            <td>${omEsc(namaProduk(k.produk_id))}</td>
            <td style="text-align:right">${Number(k.qty_titip || 0)}</td>
            <td style="text-align:right">${Number(k.qty_terjual || 0)}</td>
            <td style="text-align:right">${Number(k.qty_retur || 0)}</td>
            <td style="text-align:right"><b>${sisa}</b></td>
            <td>${omTgl(k.tgl_titip)}</td><td>${omEsc(k.status)}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}`;
}

// ── Tab: batch & stok FEFO ───────────────────────────────────────
function omTabBatch() {
  const S = omData.stok || [], B = omData.batch || [];
  if (!S.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🧴</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada produk terdaftar</div>
      <div style="font-size:13px; color:var(--text3)">
        Master produk diisi lebih dulu, lalu batch masuk dari perintah produksi.</div>
    </div>`;
  }

  const hampirExp = S.filter(s => Number(s.stok_kedaluwarsa_90hari) > 0);
  const dibawahMin = S.filter(s => Number(s.stok_siap_jual) < Number(s.min_stok || 0));
  const namaProduk = id => (S.find(s => s.produk_id === id) || {}).nama || '—';

  const stWarna = {
    'Lulus': 'var(--success)', 'Karantina': 'var(--warning)',
    'Ditolak': 'var(--danger)', 'Ditarik': 'var(--danger)',
  };

  return `
    ${hampirExp.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${hampirExp.length} produk</b> punya stok yang kedaluwarsa dalam 90 hari —
        dorong keluar lebih dulu atau tarik sebelum jadi kerugian.
      </div>` : ''}
    ${dibawahMin.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${dibawahMin.length} produk</b> di bawah stok minimum:
        ${dibawahMin.map(s => omEsc(s.nama)).join(', ')}.
      </div>` : ''}

    <div class="card" style="margin-bottom:12px; overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>SKU</th><th>Produk</th><th>Merek</th>
        <th style="text-align:right">Siap Jual</th>
        <th style="text-align:right">Karantina</th>
        <th style="text-align:right">Exp ≤90 hari</th>
        <th>Kedaluwarsa Terdekat</th>
      </tr></thead><tbody>
      ${S.map(s => `<tr>
        <td>${omEsc(s.sku)}</td><td><b>${omEsc(s.nama)}</b></td>
        <td>${omEsc(s.merek || '—')}</td>
        <td style="text-align:right; font-weight:700;
                   color:${Number(s.stok_siap_jual) < Number(s.min_stok || 0)
                            ? 'var(--danger)' : 'inherit'}">
          ${Number(s.stok_siap_jual)}</td>
        <td style="text-align:right; color:var(--warning)">${Number(s.stok_karantina)}</td>
        <td style="text-align:right">${Number(s.stok_kedaluwarsa_90hari) || '—'}</td>
        <td>${omTgl(s.kedaluwarsa_terdekat)}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>

    <h3 style="font-size:14px; margin:16px 0 8px">Batch (urut kedaluwarsa — urutan keluar FEFO)</h3>
    ${!B.length ? `
      <div class="card" style="padding:24px; text-align:center; font-size:13px; color:var(--text3)">
        Belum ada batch. Batch terbit dari perintah produksi di modul Pabrik.</div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Produk</th><th>No. Batch</th><th>Produksi</th><th>Kedaluwarsa</th>
          <th style="text-align:right">Diproduksi</th>
          <th style="text-align:right">Sisa</th><th>Status</th>
        </tr></thead><tbody>
        ${B.map(b => {
          const hari = b.tgl_kedaluwarsa
            ? Math.round((new Date(b.tgl_kedaluwarsa) - new Date()) / 86400000) : null;
          return `<tr>
            <td>${omEsc(namaProduk(b.produk_id))}</td>
            <td><b>${omEsc(b.no_batch)}</b></td>
            <td>${omTgl(b.tgl_produksi)}</td>
            <td>${omTgl(b.tgl_kedaluwarsa)}
              ${hari !== null && hari <= 90 && Number(b.qty_sisa) > 0
                ? `<div style="font-size:11px; color:${hari < 0 ? 'var(--danger)' : 'var(--warning)'}">
                     ${hari < 0 ? 'lewat ' + Math.abs(hari) + ' hari' : hari + ' hari lagi'}</div>` : ''}</td>
            <td style="text-align:right">${Number(b.qty_produksi)}</td>
            <td style="text-align:right"><b>${Number(b.qty_sisa)}</b></td>
            <td><span style="color:${stWarna[b.status] || 'var(--text3)'}; font-weight:600">
              ${omEsc(b.status)}</span></td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}`;
}

// ── Tab: ekspedisi ───────────────────────────────────────────────
function omTabKirim() {
  const K = omData.kirim || [];
  if (!K.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🚚</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada pengiriman</div>
      <div style="font-size:13px; color:var(--text3)">
        Nomor resi terbit setelah pesanan dikemas dan diserahkan ke kurir.</div>
    </div>`;
  }

  const noPesanan = id => (omData.pesanan.find(p => p.id === id) || {}).no_pesanan || '—';

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>No. Resi</th><th>Pesanan</th><th>Kurir</th><th>Layanan</th>
      <th style="text-align:right">Berat</th>
      <th style="text-align:right">Ongkir</th>
      <th>Dikirim</th><th>Status</th>
    </tr></thead><tbody>
    ${K.map(k => `<tr>
      <td><b>${omEsc(k.no_resi || '—')}</b></td>
      <td>${omEsc(noPesanan(k.pesanan_id))}</td>
      <td>${omEsc(k.kurir || '—')}</td>
      <td>${omEsc(k.layanan || '—')}</td>
      <td style="text-align:right">${Number(k.berat_gram || 0)} g</td>
      <td style="text-align:right">${omRp(k.ongkir)}</td>
      <td>${omTgl(k.tgl_kirim)}</td>
      <td>${omEsc(k.status)}</td>
    </tr>`).join('')}
    </tbody></table>
  </div>`;
}

// ── Tab: langganan ───────────────────────────────────────────────
function omTabLangganan() {
  const L = omData.langganan || [];
  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Daftar ini berisi langganan yang jatuh tempo dalam 3 hari. Pesanan
      <b>tidak dibuat otomatis</b> — pengiriman rutin yang berjalan tanpa
      ada yang menengok adalah cara tercepat mengirim barang ke alamat lama
      atau ke pelanggan yang sudah minta berhenti.
    </div>
    ${!L.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🔁</div>
        <div style="font-weight:700">Tidak ada langganan yang jatuh tempo</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Kode</th><th>Pelanggan</th><th>Kota</th>
          <th style="text-align:right">Item</th>
          <th>Kirim Berikutnya</th>
          <th style="text-align:right">Nilai</th><th>Status</th>
        </tr></thead><tbody>
        ${L.map(l => `<tr>
          <td>${omEsc(l.kode || '—')}</td>
          <td><b>${omEsc(l.pelanggan_nama || '—')}</b></td>
          <td>${omEsc(l.kota || '—')}</td>
          <td style="text-align:right">${Number(l.jml_item || 0)}</td>
          <td>${omTgl(l.tgl_kirim_berikut)}
            ${Number(l.telat_hari) > 0
              ? `<div style="font-size:11px; color:var(--danger)">telat ${l.telat_hari} hari</div>` : ''}</td>
          <td style="text-align:right">${omRp(l.harga_per_siklus)}</td>
          <td>${omEsc(l.status)}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}`;
}

// ── Tindakan ─────────────────────────────────────────────────────
async function omRincian(id) {
  try {
    const item = await sbGet('wellness_pesanan_item', `select=*&pesanan_id=eq.${id}`);
    const p = omData.pesanan.find(x => x.id === id) || {};
    const html = `
      <div class="modal-overlay" id="om-modal" onclick="if(event.target===this)omTutup()">
        <div class="modal" style="max-width:600px">
          <div class="modal-header">
            <h3>${omEsc(p.no_pesanan)}</h3>
            <button class="modal-close" onclick="omTutup()">&times;</button>
          </div>
          <div class="modal-body">
            <div style="font-size:13px; margin-bottom:12px; line-height:1.8">
              <b>${omEsc(p.pembeli_nama || '—')}</b> · ${omEsc(p.pembeli_hp || '')}<br>
              ${omEsc(p.alamat || '')} ${omEsc(p.kota || '')} ${omEsc(p.kode_pos || '')}<br>
              Kanal: ${omEsc(OM_KANAL[p.kanal] || p.kanal)} · Status: <b>${omEsc(p.status)}</b>
            </div>
            <table class="data-table"><thead><tr>
              <th>Produk</th><th style="text-align:right">Qty</th>
              <th style="text-align:right">Harga</th>
              <th style="text-align:right">Subtotal</th>
            </tr></thead><tbody>
            ${(item || []).map(i => `<tr>
              <td>${omEsc(i.nama)}<div style="font-size:11px; color:var(--text3)">
                ${omEsc(i.sku)}</div>
                ${(i.batch_terpakai && i.batch_terpakai.length)
                  ? `<div style="font-size:11px; color:var(--text3); margin-top:2px">
                       Batch: ${i.batch_terpakai.map(b =>
                         omEsc(b.no_batch) + ' (' + b.qty + ')').join(', ')}</div>` : ''}</td>
              <td style="text-align:right">${Number(i.qty)}</td>
              <td style="text-align:right">${omRp(i.harga)}</td>
              <td style="text-align:right">${omRp(i.subtotal)}</td>
            </tr>`).join('')}
            </tbody></table>
            <div style="text-align:right; margin-top:12px; font-size:13px; line-height:1.8">
              Subtotal ${omRp(p.subtotal)}<br>
              Ongkir ${omRp(p.ongkir)}<br>
              ${Number(p.diskon) ? 'Diskon −' + omRp(p.diskon) + '<br>' : ''}
              <b style="font-size:15px">Total ${omRp(p.total)}</b>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  } catch (e) { alert('Gagal membaca rincian: ' + e.message); }
}

function omTutup() {
  const m = document.getElementById('om-modal');
  if (m) m.remove();
}

async function omKemas(id) {
  if (!confirm('Kemas pesanan ini? Stok akan dipotong secara FEFO.')) return;
  try {
    const r = await sbRpc('wellness_kemas_pesanan', {
      p_pesanan_id: id, p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) { alert(r.error); return; }
    const rincian = (r.rincian || []).map(x =>
      `${x.nama} ×${x.qty} — batch ${(x.batch || []).map(b => b.no_batch).join(', ')}`).join('\n');
    alert(`Pesanan ${r.no_pesanan} dikemas.\n\n${rincian}`);
    await renderEcommerceOms();
  } catch (e) { alert('Gagal mengemas: ' + e.message); }
}

async function omKirim(id) {
  const kurir = prompt('Kurir (JNE / J&T / SiCepat / Anteraja / Ninja):');
  if (!kurir) return;
  const layanan = prompt('Layanan (REG / YES / Cargo):', 'REG');
  if (layanan === null) return;
  const resi = prompt('Nomor resi dari kurir:');
  if (!resi) return;
  const ongkir = prompt('Ongkir (Rp):', '0');
  if (ongkir === null) return;
  const berat = prompt('Berat (gram):', '0');
  if (berat === null) return;

  try {
    const r = await sbRpc('wellness_kirim_pesanan', {
      p_pesanan_id: id, p_kurir: kurir, p_layanan: layanan,
      p_no_resi: resi, p_ongkir: parseFloat(ongkir) || 0,
      p_berat: parseFloat(berat) || 0,
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Pengiriman tercatat. Resi ${r.no_resi}.`);
    await renderEcommerceOms();
  } catch (e) { alert('Gagal mencatat pengiriman: ' + e.message); }
}

function simulateBatchRecall(batchNo) {
  return {
    batchNo: batchNo || 'LOT-2026-07A',
    productName: 'Queen Royal Collagen Glow 250g',
    statusBPOM: 'SIMULATION_ACTIVE',
    sla_trace_minutes: 15,
    timestamp: new Date().toISOString(),
    distributedApotek: [
      { apotek: 'Kimia Farma Dago Bandung', batchNo: batchNo, qtyDistributed: 150, currentStock: 42, status: 'QUARANTINED_ON_SITE' },
      { apotek: 'Apotek K-24 Margonda Depok', batchNo: batchNo, qtyDistributed: 200, currentStock: 88, status: 'QUARANTINED_ON_SITE' },
      { apotek: 'Century Plaza Senayan Jakarta', batchNo: batchNo, qtyDistributed: 100, currentStock: 15, status: 'RETURN_IN_TRANSIT' }
    ],
    action_plan: [
      '1. Freeze batch stock di seluruh gudang & OMS e-commerce dalam <15 menit',
      '2. Broadcast surat penarikan batch elektronik ke 1.000 apotek mitra konsinyasi',
      '3. Lock nomor batch di POS kasir & sistem kurir ekspedisi',
      '4. Terbitkan Berita Acara Karantina & Laporan CAPA ke BPOM RI'
    ]
  };
}

window.renderEcommerceOms = renderEcommerceOms;
window.omGantiTab = omGantiTab;
window.omRincian  = omRincian;
window.omTutup    = omTutup;
window.omKemas    = omKemas;
window.omKirim    = omKirim;
window.simulateBatchRecall = simulateBatchRecall;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderEcommerceOms,
    simulateBatchRecall,
    omKemas,
    omKirim
  };
}

