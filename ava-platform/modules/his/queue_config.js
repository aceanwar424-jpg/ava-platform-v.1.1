// ═══════════════════════════════════════════════════════════════
// MODULE: Konfigurasi Antrean — loket, prefiks, kuota, prioritas
//
// Sebelum ini "counter" hanyalah teks bebas yang diketik petugas,
// sehingga "Loket 1" dan "loket1" dianggap dua loket berbeda dan laporan
// per loket tidak pernah bisa dijumlahkan.
//
// Layar ini mendefinisikan loket sebagai data: kode tetap, nama tampil,
// layanan yang dilayaninya, dan ruang fisiknya. Konsol panggilan hanya
// bisa memanggil dari loket yang terdaftar di sini.
//
// Prefiks "qcfg".
// ═══════════════════════════════════════════════════════════════

let qcfgLoket = [];
let qcfgConfig = [];

const qcfgEsc = (x) => String(x == null ? '' : x)
  .replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

async function qcfgMuat() {
  try {
    qcfgLoket = await sbGet('queue_counters', 'select=*&order=urutan,nama') || [];
  } catch (e) { qcfgLoket = null; }
  try {
    qcfgConfig = await sbGet('queue_config', 'select=*&order=layanan') || [];
  } catch (e) { qcfgConfig = null; }
}

async function renderQueueConfig() {
  document.getElementById('main-content').innerHTML =
    '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await qcfgMuat();

  if (qcfgLoket === null) {
    document.getElementById('main-content').innerHTML = `
      <div class="page-header"><div><h1>Konfigurasi Antrean</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Tabel antrean belum ada.</strong><br>
        Jalankan ulang aplikasi agar migrasi
        <code>0032_antrian_loket_prioritas_panggilan.sql</code> terpasang.
      </div>`;
    return;
  }

  qcfgGambar();
}

function qcfgGambar() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Konfigurasi Antrean</h1>
        <p style="color:var(--text3);font-size:13px">
          Loket, prefiks nomor, kuota harian, dan urutan prioritas</p></div>
      <div class="btn-row">
        <button class="btn btn-teal btn-sm" onclick="qcfgFormLoket()">+ Loket Baru</button>
        <button class="btn btn-ghost btn-sm" onclick="navigate('queue-console')">Konsol Panggilan</button>
      </div>
    </div>

    <div class="card" style="padding:0; overflow:hidden; margin-bottom:16px">
      <div style="padding:12px 16px; border-bottom:1px solid var(--border)">
        <strong style="font-size:13px">Loket &amp; Counter</strong>
        <span style="font-size:11.5px;color:var(--text3);margin-left:8px">
          ${qcfgLoket.filter(l => l.is_active).length} aktif dari ${qcfgLoket.length}</span>
      </div>
      ${qcfgLoket.length ? `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="color:var(--text3);text-align:left">
            <th style="padding:9px 16px">Kode</th><th>Nama</th><th>Layanan</th>
            <th>Ruang</th><th>Urutan</th><th>Status</th><th style="padding-right:16px">Aksi</th>
          </tr></thead>
          <tbody>${qcfgLoket.map(l => `
            <tr style="border-top:1px solid var(--border)">
              <td style="padding:9px 16px;font-family:ui-monospace,monospace;font-weight:700">${qcfgEsc(l.kode)}</td>
              <td>${qcfgEsc(l.nama)}</td>
              <td><span class="badge" style="font-size:10.5px">${qcfgEsc(l.layanan)}</span></td>
              <td style="color:var(--text3)">${qcfgEsc(l.ruang || '—')}</td>
              <td style="color:var(--text3)">${l.urutan}</td>
              <td><span class="badge" style="font-size:10.5px;color:${l.is_active ? 'var(--success-strong)' : 'var(--text3)'}">
                ${l.is_active ? 'aktif' : 'nonaktif'}</span></td>
              <td style="padding-right:16px;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" onclick="qcfgFormLoket(${l.id})">Ubah</button>
                <button class="btn btn-ghost btn-sm" onclick="qcfgAlih(${l.id}, ${!l.is_active})">
                  ${l.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
              </td>
            </tr>`).join('')}
          </tbody></table></div>`
        : `<div style="padding:26px;text-align:center;color:var(--text3);font-size:12.5px">
             Belum ada loket. Konsol panggilan tidak bisa dipakai sampai minimal satu loket terdaftar.</div>`}
    </div>

    <div class="card" style="padding:0; overflow:hidden; margin-bottom:16px">
      <div style="padding:12px 16px; border-bottom:1px solid var(--border)">
        <strong style="font-size:13px">Prefiks &amp; Kuota per Layanan</strong>
      </div>
      ${(qcfgConfig && qcfgConfig.length) ? `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="color:var(--text3);text-align:left">
          <th style="padding:9px 16px">Layanan</th><th>Prefiks</th><th>Kuota harian</th>
          <th>Suara</th><th style="padding-right:16px">Aksi</th></tr></thead>
        <tbody>${qcfgConfig.map(c => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:9px 16px;font-weight:700">${qcfgEsc(c.layanan)}</td>
            <td style="font-family:ui-monospace,monospace">${qcfgEsc(c.prefiks)}</td>
            <td>${c.kuota_harian ? c.kuota_harian : '<span style="color:var(--text3)">tanpa batas</span>'}</td>
            <td>${c.suara_aktif ? 'aktif' : '<span style="color:var(--text3)">mati</span>'}</td>
            <td style="padding-right:16px">
              <button class="btn btn-ghost btn-sm" onclick="qcfgFormLayanan(${c.id})">Ubah</button>
            </td>
          </tr>`).join('')}</tbody></table>`
        : `<div style="padding:22px;text-align:center;color:var(--text3);font-size:12.5px">
             Belum ada layanan terdaftar. Baris akan muncul sendiri begitu ada tiket antrean pertama.</div>`}
    </div>

    <div class="card" style="padding:16px 18px">
      <strong style="font-size:13px;display:block;margin-bottom:10px">Urutan Prioritas Panggilan</strong>
      <p style="font-size:12.5px;color:var(--text3);line-height:1.7;margin:0 0 12px">
        Antrean dipanggil menurut urutan ini lebih dulu, baru menurut nomor.
        Urutannya ditetapkan di basis data (<code>queue_bobot_prioritas</code>)
        supaya konsol, layar TV, dan kiosk tidak bisa memakai urutan berbeda.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${[['CITO','#DC2626','Gawat — didahulukan mutlak'],
           ['Ibu Hamil','#DB2777',''],
           ['Disabilitas','#7C3AED',''],
           ['Lansia','#B45309',''],
           ['Normal','#64748B','']].map(([n,w,k]) => `
          <div style="border:1px solid ${w}44;background:${w}14;color:${w};
            padding:6px 12px;border-radius:999px;font-size:11.5px;font-weight:700"
            ${k ? `title="${k}"` : ''}>${n}</div>`).join('')}
      </div>
    </div>`;
}

// ── Formulir loket ───────────────────────────────────────────────
function qcfgFormLoket(id) {
  const l = id ? qcfgLoket.find(x => x.id === id) : null;
  const v = (k, d) => (l && l[k] != null ? String(l[k]) : (d || ''));

  // Layanan yang boleh dipilih diambil dari yang sudah ada, supaya tidak
  // muncul layanan baru karena salah ketik.
  const layanan = [...new Set([
    ...(qcfgConfig || []).map(c => c.layanan),
    ...qcfgLoket.map(x => x.layanan),
    'Dokter', 'Lab', 'Radiologi', 'Farmasi', 'Kasir',
  ].filter(Boolean))];

  openModal(`
    <h3 style="margin:0 0 4px">${l ? 'Ubah Loket' : 'Loket Baru'}</h3>
    <p style="font-size:12px;color:var(--text3);margin:0 0 14px">
      Konsol panggilan hanya bisa memanggil dari loket yang terdaftar.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>Kode ${l ? '' : '*'}</label>
        <input id="qcfg-kode" value="${qcfgEsc(v('kode'))}" placeholder="LOKET-1"
          ${l ? 'disabled title="Kode dipakai konsol panggilan dan tidak bisa diubah"' : ''}></div>
      <div class="input-group"><label>Nama tampil *</label>
        <input id="qcfg-nama" value="${qcfgEsc(v('nama'))}" placeholder="Loket 1"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>Layanan *</label>
        <select id="qcfg-layanan">
          ${layanan.map(x => `<option value="${qcfgEsc(x)}" ${v('layanan') === x ? 'selected' : ''}>${qcfgEsc(x)}</option>`).join('')}
        </select></div>
      <div class="input-group"><label>Ruang</label>
        <input id="qcfg-ruang" value="${qcfgEsc(v('ruang'))}" placeholder="Lantai 1, dekat apotek"></div>
    </div>

    <div class="input-group"><label>Urutan tampil</label>
      <input id="qcfg-urutan" type="number" value="${v('urutan', '100')}"></div>

    <p style="font-size:11.5px;color:var(--text3);line-height:1.6;margin:2px 0 0">
      Ruang dibacakan bersama nomor saat pemanggilan bersuara &mdash;
      &ldquo;silakan menuju Loket 1, Lantai 1&rdquo;.
    </p>

    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-close" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-primary" style="margin-top:0"
        onclick="qcfgSimpanLoket(${l ? l.id : 'null'})">Simpan</button>
    </div>`);
}

async function qcfgSimpanLoket(id) {
  const g = (k) => (document.getElementById('qcfg-' + k)?.value || '').trim();
  const nama = g('nama');
  if (!nama) { toast('Nama loket wajib diisi', 'warn'); return; }

  const muatan = {
    nama,
    layanan: g('layanan'),
    ruang: g('ruang') || null,
    urutan: Number(g('urutan')) || 100,
  };

  try {
    if (id) {
      await sbPatch('queue_counters', id, muatan);
      toast('Loket diperbarui', 'ok');
    } else {
      const kode = g('kode').toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (!kode) { toast('Kode loket wajib diisi', 'warn'); return; }
      if (qcfgLoket.some(x => x.kode === kode)) {
        toast(`Kode "${kode}" sudah dipakai`, 'err'); return;
      }
      muatan.kode = kode;
      muatan.is_active = true;
      await sbPost('queue_counters', muatan);
      toast(`Loket ${nama} ditambahkan`, 'ok');
    }
    closeModalForce();
    await qcfgMuat();
    qcfgGambar();
  } catch (e) { toast('Gagal menyimpan: ' + e.message, 'err'); }
}

async function qcfgAlih(id, aktif) {
  try {
    await sbPatch('queue_counters', id, { is_active: aktif });
    toast(aktif ? 'Loket diaktifkan' : 'Loket dinonaktifkan', 'ok');
    await qcfgMuat(); qcfgGambar();
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

// ── Formulir layanan ─────────────────────────────────────────────
function qcfgFormLayanan(id) {
  const c = (qcfgConfig || []).find(x => x.id === id);
  if (!c) return;
  const layanan = c.layanan;

  openModal(`
    <h3 style="margin:0 0 4px">Pengaturan ${qcfgEsc(layanan)}</h3>
    <p style="font-size:12px;color:var(--text3);margin:0 0 14px">
      Berlaku untuk semua loket yang melayani layanan ini.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>Prefiks nomor</label>
        <input id="qcfg-l-prefiks" value="${qcfgEsc(c.prefiks)}" maxlength="3"
          style="font-family:ui-monospace,monospace;text-transform:uppercase"></div>
      <div class="input-group"><label>Kuota harian</label>
        <input id="qcfg-l-kuota" type="number" min="0" value="${c.kuota_harian || 0}"></div>
    </div>

    <label style="display:flex;align-items:center;gap:9px;font-size:13px;cursor:pointer;margin-top:4px">
      <input type="checkbox" id="qcfg-l-suara" ${c.suara_aktif ? 'checked' : ''}
        style="width:15px;height:15px;cursor:pointer">
      Bacakan nomor dengan suara saat dipanggil
    </label>

    <p style="font-size:11.5px;color:var(--text3);line-height:1.6;margin:12px 0 0">
      Kuota <b>0</b> berarti tanpa batas.
    </p>

    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-close" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-primary" style="margin-top:0"
        onclick="qcfgSimpanLayanan(${c.id})">Simpan</button>
    </div>`);
}

async function qcfgSimpanLayanan(id) {
  const prefiks = (document.getElementById('qcfg-l-prefiks')?.value || '').trim().toUpperCase();
  if (!prefiks) { toast('Prefiks wajib diisi', 'warn'); return; }
  try {
    await sbPatch('queue_config', id, {
      prefiks,
      kuota_harian: Number(document.getElementById('qcfg-l-kuota')?.value) || 0,
      suara_aktif: !!document.getElementById('qcfg-l-suara')?.checked,
      updated_at: new Date().toISOString(),
    });
    toast('Pengaturan disimpan', 'ok');
    closeModalForce();
    await qcfgMuat(); qcfgGambar();
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

window.renderQueueConfig = renderQueueConfig;
window.qcfgFormLoket = qcfgFormLoket;
window.qcfgSimpanLoket = qcfgSimpanLoket;
window.qcfgAlih = qcfgAlih;
window.qcfgFormLayanan = qcfgFormLayanan;
window.qcfgSimpanLayanan = qcfgSimpanLayanan;
