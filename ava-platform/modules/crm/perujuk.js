// ═══════════════════════════════════════════════════════════════
// MODULE: Dokter & Klinik Perujuk
//
// Mengelola pihak yang mengirim pasien ke AVA, tarif komisinya, dan
// pencairan yang sudah dibayarkan.
//
// ── Yang sengaja TIDAK ada di sini ───────────────────────────
// Tidak ada tempat untuk mengetik nilai komisi. Komisi selalu dihitung dari
// pendaftaran yang benar-benar tercatat (view v_komisi_rujukan). Kolom yang
// bisa diketik akan cepat menyimpang dari kenyataan, dan penyimpangan pada
// angka yang dibayarkan ke pihak luar adalah kesalahan yang paling mahal
// untuk ditemukan belakangan.
//
// Yang bisa diketik hanya PENCAIRAN — uang yang benar-benar sudah keluar.
//
// Prefiks "pjk" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let pjkDaftar = [];

const pjkRp  = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const pjkTgl = (d) => d ? new Date(d).toLocaleDateString('id-ID',
  { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

async function renderPerujuk() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Dokter & Klinik Perujuk</h1>
        <p style="color:var(--text3);font-size:13px">
          Tarif komisi, akumulasi dari pendaftaran nyata, dan pencairan</p></div>
      <div class="btn-row">
        <button class="btn btn-teal btn-sm" onclick="pjkForm()">+ Perujuk Baru</button>
        <button class="btn btn-ghost btn-sm" onclick="renderPerujuk()">Muat Ulang</button>
      </div>
    </div>
    <div id="pjk-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await pjkMuat();
  pjkGambar();
}

async function pjkMuat() {
  try {
    pjkDaftar = await sbRpc('perujuk_ringkasan', {}) || [];
    if (!Array.isArray(pjkDaftar)) pjkDaftar = [];
  } catch (e) {
    pjkDaftar = [];
    toast('Gagal memuat data perujuk: ' + (e.message || e), 'err');
  }
}

function pjkGambar() {
  const el = document.getElementById('pjk-isi');
  if (!el) return;

  const totalSaldo  = pjkDaftar.reduce((s, r) => s + Number(r.saldo || 0), 0);
  const totalKomisi = pjkDaftar.reduce((s, r) => s + Number(r.komisi_terkumpul || 0), 0);
  const totalRujuk  = pjkDaftar.reduce((s, r) => s + Number(r.jumlah_rujukan || 0), 0);

  el.innerHTML = `
    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat-card"><div class="stat-label">Perujuk aktif</div>
        <div class="stat-value">${pjkDaftar.filter(r => r.aktif).length}</div></div>
      <div class="stat-card"><div class="stat-label">Pasien dirujuk</div>
        <div class="stat-value">${totalRujuk}</div></div>
      <div class="stat-card"><div class="stat-label">Komisi terkumpul</div>
        <div class="stat-value">${pjkRp(totalKomisi)}</div></div>
      <div class="stat-card"><div class="stat-label">Belum dicairkan</div>
        <div class="stat-value" style="color:${totalSaldo > 0 ? 'var(--warn-deeper)' : 'var(--text3)'}">
          ${pjkRp(totalSaldo)}</div></div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
        Daftar Perujuk
      </div>
      ${pjkDaftar.length ? `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="color:var(--text3);text-align:left">
            <th style="padding:9px 16px">Nama</th><th>Jenis</th><th>Tarif</th>
            <th style="text-align:right">Rujukan</th>
            <th style="text-align:right">Nilai layanan</th>
            <th style="text-align:right">Komisi</th>
            <th style="text-align:right">Dicairkan</th>
            <th style="text-align:right">Saldo</th>
            <th style="padding-right:16px">Aksi</th></tr></thead>
          <tbody>${pjkDaftar.map(r => `
            <tr style="border-top:1px solid var(--border);${r.aktif ? '' : 'opacity:.55'}">
              <td style="padding:9px 16px">
                ${r.nama}${r.aktif ? '' : ' <span class="badge" style="font-size:10px">nonaktif</span>'}
                ${r.rujukan_terakhir ? `<div style="font-size:11px;color:var(--text3)">
                  terakhir ${pjkTgl(r.rujukan_terakhir)}</div>` : ''}</td>
              <td>${r.jenis || '—'}</td>
              <td id="pjk-tarif-${r.perujuk_id}" style="font-size:11.5px;color:var(--text3)">—</td>
              <td style="text-align:right">${r.jumlah_rujukan || 0}${
                Number(r.jumlah_batal) ? `<div style="font-size:11px;color:var(--text3)">
                  ${r.jumlah_batal} batal</div>` : ''}</td>
              <td style="text-align:right">${pjkRp(r.nilai_rujukan)}</td>
              <td style="text-align:right">${pjkRp(r.komisi_terkumpul)}</td>
              <td style="text-align:right;color:var(--text3)">${pjkRp(r.sudah_dicairkan)}</td>
              <td style="text-align:right;font-weight:700;color:${
                Number(r.saldo) > 0 ? 'var(--warn-deeper)' : 'var(--text3)'}">${pjkRp(r.saldo)}</td>
              <td style="padding-right:16px;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" onclick="pjkForm(${r.perujuk_id})">Ubah</button>
                <button class="btn btn-ghost btn-sm" onclick="pjkCairkan(${r.perujuk_id})"
                  ${Number(r.saldo) > 0 ? '' : 'disabled'}>Cairkan</button>
              </td></tr>`).join('')}
          </tbody></table></div>`
        : `<div style="padding:24px;text-align:center;color:var(--text3);font-size:12.5px">
             Belum ada perujuk terdaftar. Klik "+ Perujuk Baru" untuk menambahkan.</div>`}
    </div>

    <div class="card" style="padding:12px 15px;margin-top:14px;font-size:12px;
         line-height:1.6;color:var(--text3)">
      Komisi <b>dihitung ulang</b> dari pendaftaran yang tercatat, bukan disimpan sebagai
      angka. Setiap pendaftaran memakai tarif yang berlaku saat pasiennya didaftarkan, dan
      nilainya tidak berubah meski tarif diperbarui. Pendaftaran yang dibatalkan tidak
      menghasilkan komisi.
    </div>`;

  pjkIsiTarif();
}

// Tarif tidak ikut di perujuk_ringkasan() — RPC itu sengaja hanya membawa
// angka ringkasan. Diambil terpisah supaya kolom Tarif tidak kosong.
async function pjkIsiTarif() {
  try {
    const rows = await sbGet('perujuk', 'select=id,komisi_persen,komisi_tetap&limit=500') || [];
    rows.forEach(p => {
      const el = document.getElementById('pjk-tarif-' + p.id);
      if (!el) return;
      const bagian = [];
      if (Number(p.komisi_persen)) bagian.push(Number(p.komisi_persen) + '%');
      if (Number(p.komisi_tetap))  bagian.push(pjkRp(p.komisi_tetap) + '/pasien');
      el.textContent = bagian.join(' + ') || 'belum ditetapkan';
    });
  } catch (e) { /* kolom tarif tetap "—"; bukan alasan menggagalkan seluruh layar */ }
}

async function pjkForm(id) {
  let d = { nama: '', jenis: 'Dokter', spesialisasi: '', telepon: '', email: '',
            komisi_persen: 0, komisi_tetap: 0, bank_nama: '', bank_rekening: '',
            bank_atas_nama: '', aktif: true, catatan: '' };
  if (id) {
    try {
      const r = await sbGet('perujuk', `select=*&id=eq.${id}&limit=1`);
      if (r && r[0]) d = r[0];
    } catch (e) { toast('Gagal memuat data: ' + e.message, 'err'); return; }
  }

  const opsi = (v) => ['Dokter', 'Klinik', 'Lab', 'Individu']
    .map(x => `<option value="${x}"${x === v ? ' selected' : ''}>${x}</option>`).join('');

  openModal(`
    <h3 style="margin:0 0 14px">${id ? 'Ubah' : 'Tambah'} Perujuk</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group" style="grid-column:1/-1"><label>Nama</label>
        <input id="pjk-nama" value="${(d.nama || '').replace(/"/g, '&quot;')}" placeholder="dr. Nama Lengkap"></div>
      <div class="input-group"><label>Jenis</label>
        <select id="pjk-jenis">${opsi(d.jenis)}</select></div>
      <div class="input-group"><label>Spesialisasi</label>
        <input id="pjk-spes" value="${(d.spesialisasi || '').replace(/"/g, '&quot;')}"></div>
      <div class="input-group"><label>Telepon</label>
        <input id="pjk-telp" value="${(d.telepon || '').replace(/"/g, '&quot;')}"></div>
      <div class="input-group"><label>Email</label>
        <input id="pjk-email" value="${(d.email || '').replace(/"/g, '&quot;')}"></div>
      <div class="input-group"><label>Komisi persen (%)</label>
        <input id="pjk-persen" type="number" step="0.01" min="0" max="100" value="${Number(d.komisi_persen) || 0}"></div>
      <div class="input-group"><label>Komisi tetap per pasien (Rp)</label>
        <input id="pjk-tetap" type="number" min="0" value="${Number(d.komisi_tetap) || 0}"></div>
      <div class="input-group"><label>Bank</label>
        <input id="pjk-bank" value="${(d.bank_nama || '').replace(/"/g, '&quot;')}"></div>
      <div class="input-group"><label>No. rekening</label>
        <input id="pjk-rek" value="${(d.bank_rekening || '').replace(/"/g, '&quot;')}"></div>
      <div class="input-group" style="grid-column:1/-1"><label>Atas nama</label>
        <input id="pjk-an" value="${(d.bank_atas_nama || '').replace(/"/g, '&quot;')}"></div>
      <div class="input-group" style="grid-column:1/-1"><label>Catatan</label>
        <input id="pjk-catatan" value="${(d.catatan || '').replace(/"/g, '&quot;')}"></div>
      <label style="grid-column:1/-1;display:flex;align-items:center;gap:8px;font-size:12.5px">
        <input type="checkbox" id="pjk-aktif" ${d.aktif !== false ? 'checked' : ''}> Aktif
      </label>
    </div>
    ${id ? `<div style="font-size:11.5px;color:var(--text3);line-height:1.6;margin-top:10px">
      Mengubah tarif hanya berlaku untuk rujukan <b>baru</b>. Rujukan yang sudah tercatat
      memakai tarif yang dibekukan saat pasiennya didaftarkan.</div>` : ''}
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-close" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-primary" style="margin-top:0" onclick="pjkSimpan(${id || 'null'})">Simpan</button>
    </div>`);
}

async function pjkSimpan(id) {
  const nilai = (x) => document.getElementById('pjk-' + x)?.value?.trim() || '';
  const nama = nilai('nama');
  if (!nama) { toast('Nama wajib diisi', 'warn'); return; }

  const payload = {
    nama,
    jenis:          document.getElementById('pjk-jenis')?.value || 'Dokter',
    spesialisasi:   nilai('spes') || null,
    telepon:        nilai('telp') || null,
    email:          nilai('email') || null,
    komisi_persen:  parseFloat(nilai('persen')) || 0,
    komisi_tetap:   parseInt(nilai('tetap'), 10) || 0,
    bank_nama:      nilai('bank') || null,
    bank_rekening:  nilai('rek') || null,
    bank_atas_nama: nilai('an') || null,
    catatan:        nilai('catatan') || null,
    aktif:          !!document.getElementById('pjk-aktif')?.checked,
    updated_at:     new Date().toISOString(),
  };

  try {
    if (id) await sbPatch('perujuk', id, payload);
    else    await sbPost('perujuk', payload);
    toast(id ? 'Perujuk diperbarui' : 'Perujuk ditambahkan', 'ok');
    closeModalForce();
    await renderPerujuk();
  } catch (e) { toast('Gagal menyimpan: ' + (e.message || e), 'err'); }
}

async function pjkCairkan(id) {
  const r = pjkDaftar.find(x => x.perujuk_id === id);
  if (!r) return;
  const saldo = Number(r.saldo || 0);

  openModal(`
    <h3 style="margin:0 0 4px">Cairkan Komisi</h3>
    <p style="font-size:12px;color:var(--text3);margin:0 0 14px">
      ${r.nama} — saldo belum dicairkan <b>${pjkRp(saldo)}</b></p>
    <div class="input-group"><label>Jumlah dicairkan (Rp)</label>
      <input id="pjc-jumlah" type="number" min="1" max="${saldo}" value="${saldo}"></div>
    <div class="input-group"><label>Metode</label>
      <select id="pjc-metode">
        <option>Transfer</option><option>Tunai</option><option>Potong tagihan</option>
      </select></div>
    <div class="input-group"><label>Referensi (no. transaksi)</label>
      <input id="pjc-ref" placeholder="mis. TRF-2026-0001"></div>
    <div class="input-group"><label>Catatan</label><input id="pjc-catatan"></div>
    <div style="font-size:11.5px;color:var(--text3);line-height:1.6;margin-top:8px">
      Catat di sini hanya uang yang <b>sudah benar-benar dibayarkan</b>. Saldo dihitung
      sebagai komisi terkumpul dikurangi seluruh pencairan yang tercatat.
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-close" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-primary" style="margin-top:0" onclick="pjkSimpanCair(${id})">Catat Pencairan</button>
    </div>`);
}

async function pjkSimpanCair(id) {
  const jumlah = parseInt(document.getElementById('pjc-jumlah')?.value, 10) || 0;
  const r = pjkDaftar.find(x => x.perujuk_id === id);
  const saldo = Number(r?.saldo || 0);

  if (jumlah <= 0) { toast('Jumlah harus lebih dari nol', 'warn'); return; }
  // Mencairkan melebihi saldo bukan sekadar salah ketik — ia membuat saldo
  // menjadi negatif dan angka di portal perujuk ikut salah. Ditolak di sini,
  // bukan diperbaiki belakangan.
  if (jumlah > saldo) {
    toast(`Melebihi saldo. Maksimal ${pjkRp(saldo)}.`, 'err');
    return;
  }

  try {
    await sbPost('perujuk_pencairan', {
      perujuk_id:  id,
      jumlah,
      metode:      document.getElementById('pjc-metode')?.value || 'Transfer',
      referensi:   document.getElementById('pjc-ref')?.value?.trim() || null,
      catatan:     document.getElementById('pjc-catatan')?.value?.trim() || null,
      dibuat_oleh: (typeof getUserName === 'function' ? getUserName() : 'User'),
    });
    if (typeof logActivity === 'function') {
      await logActivity('create', 'perujuk_pencairan', id,
        `Pencairan komisi ${pjkRp(jumlah)} untuk ${r?.nama || id}`, r?.nama || '');
    }
    toast(`Pencairan ${pjkRp(jumlah)} tercatat`, 'ok');
    closeModalForce();
    await renderPerujuk();
  } catch (e) { toast('Gagal mencatat pencairan: ' + (e.message || e), 'err'); }
}

window.renderPerujuk  = renderPerujuk;
window.pjkForm        = pjkForm;
window.pjkSimpan      = pjkSimpan;
window.pjkCairkan     = pjkCairkan;
window.pjkSimpanCair  = pjkSimpanCair;
