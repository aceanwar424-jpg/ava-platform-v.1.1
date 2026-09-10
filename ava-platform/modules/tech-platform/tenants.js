// ═══════════════════════════════════════════════════════════════
// MODULE: Tenant & Klien Faskes — AVA Tech
//
// AVA Tech membangun platform ini dan menjualnya ke faskes lain. Layar ini
// adalah daftar pelanggannya: siapa memakai sistem ini, paket apa, sampai
// kapan, dan berapa yang sudah terpakai bulan ini.
//
// ── Mengapa layar ini ada ────────────────────────────────────
// Sebelumnya daftar klien disimpan di dalam array JavaScript
// (SAAS_TENANTS di tech_saas.js) yang hilang setiap kali halaman dimuat
// ulang, dan "provisioning tenant baru" hanya mendorong satu baris ke array
// itu lalu menampilkan pesan berhasil. Tidak ada klien yang pernah benar-benar
// tersimpan.
//
// Sumber datanya kini view public.tenant_ringkasan (0029), yang menggabungkan
// public.tenants dengan pemakaian bulan berjalan.
//
// Prefiks "tnt".
// ═══════════════════════════════════════════════════════════════

let tntData = [];
let tntCari = '';

const TNT_PAKET = {
  STARTER_LIS:    { label: 'Starter LIS',        tes: 2000,  kunjungan: 0 },
  CLINIC_PRATAMA: { label: 'Klinik Pratama',     tes: 3000,  kunjungan: 6000 },
  ENTERPRISE_RS:  { label: 'Enterprise RS',      tes: 25000, kunjungan: 50000 },
  MASTER_HOLDING: { label: 'Master Holding',     tes: 0,     kunjungan: 0 },
};

const TNT_STATUS = {
  'aktif':           { warna: 'var(--success-strong)', label: 'Aktif' },
  'segera-berakhir': { warna: 'var(--warn-deeper)',    label: 'Segera berakhir' },
  'kedaluwarsa':     { warna: 'var(--danger-strong)',  label: 'Kedaluwarsa' },
  'tanpa-batas':     { warna: 'var(--text3)',          label: 'Tanpa masa berlaku' },
};

const tntRp  = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const tntTgl = (d) => d ? new Date(d).toLocaleDateString('id-ID',
  { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const tntEsc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

async function renderTenants() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Tenant &amp; Klien Faskes</h1>
        <p style="color:var(--text3);font-size:13px">
          Faskes yang memakai sistem ini — paket langganan, masa berlaku, dan pemakaian bulan berjalan</p></div>
      <div class="btn-row">
        <button class="btn btn-teal btn-sm" onclick="tntForm()">+ Tenant Baru</button>
        <button class="btn btn-ghost btn-sm" onclick="renderTenants()">Muat Ulang</button>
      </div>
    </div>
    <div id="tnt-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;

  await tntMuat();
  tntGambar();
}

async function tntMuat() {
  try {
    tntData = await sbGet('tenant_ringkasan', 'select=*&order=nama') || [];
    if (!Array.isArray(tntData)) tntData = [];
  } catch (e) {
    // View belum ada berarti migrasi 0029 belum terpasang. Dikatakan apa
    // adanya, bukan dijawab dengan daftar kosong yang terlihat seperti
    // "memang belum ada klien".
    tntData = null;
  }
}

function tntGambar() {
  const el = document.getElementById('tnt-isi');
  if (!el) return;

  if (tntData === null) {
    el.innerHTML = `<div class="card" style="padding:20px;font-size:13px;line-height:1.7">
      <strong>Data tenant tidak dapat dibaca.</strong><br>
      View <code>tenant_ringkasan</code> belum ada di basis data ini. Jalankan ulang
      aplikasi agar migrasi <code>0029_ava_tech_penjualan_lisensi.sql</code> terpasang.
    </div>`;
    return;
  }

  // Instalasi milik sendiri bukan penjualan. Dipisahkan supaya angka klien
  // tidak terlihat lebih besar satu daripada kenyataannya.
  const klien = tntData.filter(t => t.kode !== 'lokal');
  const cari = tntCari.toLowerCase();
  const tampil = cari
    ? klien.filter(t => [t.nama, t.kode, t.subdomain, t.kota, t.paket]
        .some(x => String(x || '').toLowerCase().includes(cari)))
    : klien;

  const aktif = klien.filter(t => t.is_active && t.status_langganan !== 'kedaluwarsa').length;
  const perluPerhatian = klien.filter(t =>
    ['kedaluwarsa', 'segera-berakhir'].includes(t.status_langganan)).length;
  const nilaiTahunan = klien
    .filter(t => t.status_langganan !== 'kedaluwarsa')
    .reduce((s, t) => s + Number(t.nilai_langganan || 0), 0);

  el.innerHTML = `
    <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:13px;margin-bottom:16px">
      ${[
        ['Klien faskes aktif', aktif, klien.length ? `dari ${klien.length} terdaftar` : 'belum ada klien', 'var(--teal)'],
        ['Perlu perpanjangan', perluPerhatian, perluPerhatian ? 'kedaluwarsa / < 30 hari' : 'tidak ada yang mendesak',
          perluPerhatian ? 'var(--danger-strong)' : 'var(--success-strong)'],
        ['Nilai langganan berjalan', tntRp(nilaiTahunan), 'dari kontrak yang masih berlaku', 'var(--gold, #B45309)'],
      ].map(([l, v, n, c]) => `
        <div class="card" style="padding:14px 16px;border-left:3px solid ${c}">
          <div style="font-size:10.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;font-weight:700">${l}</div>
          <div style="font-size:21px;font-weight:800;margin-top:3px;color:${c}">${v}</div>
          <div style="font-size:11.5px;color:var(--text3)">${n}</div>
        </div>`).join('')}
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <strong style="font-size:13px">Daftar Klien</strong>
        <input class="input" placeholder="Cari nama, kota, subdomain…" oninput="tntSetCari(this.value)"
          style="margin-left:auto;width:230px;padding:6px 10px;font-size:12.5px">
      </div>

      ${tampil.length ? `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="color:var(--text3);text-align:left">
            <th style="padding:9px 16px">Faskes</th><th>Paket</th><th>Langganan</th>
            <th>Pemakaian bulan ini</th><th>Nilai</th><th style="padding-right:16px">Aksi</th>
          </tr></thead>
          <tbody>${tampil.map(t => tntBaris(t)).join('')}</tbody>
        </table></div>`
        : `<div style="padding:26px;text-align:center;color:var(--text3);font-size:12.5px">
            ${cari ? 'Tidak ada klien yang cocok dengan pencarian.'
                   : 'Belum ada klien faskes terdaftar. Klik "+ Tenant Baru" untuk mencatat yang pertama.'}
          </div>`}
    </div>

    <div class="card" style="padding:12px 16px;margin-top:14px;font-size:11.5px;color:var(--text3);line-height:1.65">
      Instalasi ini sendiri (<code>lokal</code>) tidak dihitung sebagai klien.
      Kuota <strong>0</strong> berarti tanpa batas.
      Pemakaian dicatat lewat <code>tenant_catat_pemakaian()</code> dan direkap per bulan berjalan.
    </div>`;
}

function tntBaris(t) {
  const st = TNT_STATUS[t.status_langganan] || TNT_STATUS['tanpa-batas'];
  const paket = TNT_PAKET[t.paket]?.label || t.paket || '—';

  const bar = (pakai, kuota) => {
    if (!kuota) return `<span style="color:var(--text3)">${Number(pakai || 0).toLocaleString('id-ID')} · tanpa batas</span>`;
    const persen = Math.min(100, Math.round((pakai / kuota) * 100));
    const w = persen >= 90 ? 'var(--danger-strong)' : persen >= 70 ? 'var(--warn-deeper)' : 'var(--teal)';
    return `<div style="font-weight:700">${Number(pakai || 0).toLocaleString('id-ID')} / ${Number(kuota).toLocaleString('id-ID')}</div>
      <div style="height:4px;background:var(--border);border-radius:99px;margin-top:4px;overflow:hidden">
        <div style="height:100%;width:${persen}%;background:${w};border-radius:99px"></div></div>`;
  };

  return `<tr style="border-top:1px solid var(--border)">
    <td style="padding:9px 16px">
      <div style="font-weight:700">${tntEsc(t.nama)}</div>
      <div style="font-size:11px;color:var(--text3)">
        ${tntEsc(t.subdomain || t.kode)}${t.kota ? ' · ' + tntEsc(t.kota) : ''}</div>
    </td>
    <td><span class="badge" style="font-size:10.5px">${tntEsc(paket)}</span></td>
    <td>
      <span class="badge" style="color:${st.warna};font-size:10.5px">${st.label}</span>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">
        ${t.habis_langganan ? 's/d ' + tntTgl(t.habis_langganan) : '—'}</div>
    </td>
    <td style="min-width:160px">
      <div style="font-size:11px;color:var(--text3)">Tes lab</div>
      ${bar(t.pakai_tes, t.kuota_tes)}
    </td>
    <td>${tntRp(t.nilai_langganan)}</td>
    <td style="padding-right:16px;white-space:nowrap">
      <button class="btn btn-ghost btn-sm" onclick="tntForm('${t.id}')">Ubah</button>
    </td></tr>`;
}

function tntSetCari(v) {
  tntCari = v;
  tntGambar();
}

// ── Formulir tambah / ubah ──────────────────────────────────────
function tntForm(id) {
  const t = id ? (tntData || []).find(x => String(x.id) === String(id)) : null;
  const v = (k, d) => (t && t[k] != null ? String(t[k]) : (d || ''));

  openModal(`
    <h3 style="margin:0 0 4px">${t ? 'Ubah Tenant' : 'Tenant Faskes Baru'}</h3>
    <p style="font-size:12px;color:var(--text3);margin:0 0 14px">
      Data klien yang membeli lisensi sistem ini.</p>

    <div class="input-group"><label>Nama faskes *</label>
      <input id="tnt-nama" value="${tntEsc(v('nama'))}" placeholder="mis. Klinik Pratama Sehat Mandiri"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>Kode ${t ? '' : '*'}</label>
        <input id="tnt-kode" value="${tntEsc(v('kode'))}" placeholder="huruf kecil, tanpa spasi"
          ${t ? 'disabled title="Kode dipakai sebagai kunci relasi dan tidak bisa diubah"' : ''}></div>
      <div class="input-group"><label>Kota</label>
        <input id="tnt-kota" value="${tntEsc(v('kota'))}"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>Paket lisensi</label>
        <select id="tnt-paket" onchange="tntIsiKuota()">
          <option value="">— pilih —</option>
          ${Object.entries(TNT_PAKET).map(([k, p]) =>
            `<option value="${k}" ${v('paket') === k ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select></div>
      <div class="input-group"><label>Subdomain klien</label>
        <input id="tnt-subdomain" value="${tntEsc(v('subdomain'))}" placeholder="mis. sehatmandiri.avahealth.sbs"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>Mulai langganan</label>
        <input id="tnt-mulai" type="date" value="${v('mulai_langganan').slice(0, 10)}"></div>
      <div class="input-group"><label>Habis langganan</label>
        <input id="tnt-habis" type="date" value="${v('habis_langganan').slice(0, 10)}"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="input-group"><label>Kuota tes/bulan</label>
        <input id="tnt-kuota-tes" type="number" min="0" value="${v('kuota_tes', '0')}"></div>
      <div class="input-group"><label>Kuota kunjungan</label>
        <input id="tnt-kuota-kunj" type="number" min="0" value="${v('kuota_kunjungan', '0')}"></div>
      <div class="input-group"><label>Nilai langganan</label>
        <input id="tnt-nilai" type="number" min="0" value="${v('nilai_langganan', '0')}"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="input-group"><label>PIC</label>
        <input id="tnt-pic" value="${tntEsc(v('pic_nama'))}"></div>
      <div class="input-group"><label>Kontak PIC</label>
        <input id="tnt-kontak" value="${tntEsc(v('pic_kontak'))}"></div>
    </div>

    <p style="font-size:11.5px;color:var(--text3);line-height:1.6;margin:2px 0 0">
      Kuota <strong>0</strong> berarti tanpa batas. Lisensi tidak mengunci aplikasi —
      status berakhir hanya ditampilkan, penagihan diselesaikan antar manusia.
    </p>

    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-close" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-primary" style="margin-top:0"
        onclick="tntSimpan(${t ? `'${t.id}'` : 'null'})">Simpan</button>
    </div>`);
}

// Memilih paket mengisi kuota bawaannya — tetap bisa disunting, karena
// kesepakatan dengan klien tidak selalu persis sama dengan paket standar.
function tntIsiKuota() {
  const p = TNT_PAKET[document.getElementById('tnt-paket')?.value];
  if (!p) return;
  const tes = document.getElementById('tnt-kuota-tes');
  const kunj = document.getElementById('tnt-kuota-kunj');
  if (tes) tes.value = p.tes;
  if (kunj) kunj.value = p.kunjungan;
}

async function tntSimpan(id) {
  const ambil = (k) => (document.getElementById('tnt-' + k)?.value || '').trim();
  const angka = (k) => Number(document.getElementById('tnt-' + k)?.value || 0) || 0;

  const nama = ambil('nama');
  if (!nama) { toast('Nama faskes wajib diisi', 'warn'); return; }

  const muatan = {
    nama,
    kota:            ambil('kota') || null,
    paket:           ambil('paket') || null,
    subdomain:       ambil('subdomain') || null,
    mulai_langganan: ambil('mulai') || null,
    habis_langganan: ambil('habis') || null,
    kuota_tes:       angka('kuota-tes'),
    kuota_kunjungan: angka('kuota-kunj'),
    nilai_langganan: angka('nilai'),
    pic_nama:        ambil('pic') || null,
    pic_kontak:      ambil('kontak') || null,
    updated_at:      new Date().toISOString(),
  };

  try {
    if (id) {
      await sbPatch('tenants', id, muatan);
      toast('Data tenant diperbarui', 'ok');
    } else {
      const kode = ambil('kode').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!kode) { toast('Kode tenant wajib diisi', 'warn'); return; }
      if ((tntData || []).some(t => t.kode === kode)) {
        toast(`Kode "${kode}" sudah dipakai tenant lain`, 'err'); return;
      }
      // id dibangkitkan di klien karena kolomnya uuid tanpa nilai bawaan
      // (lihat 0004_tenancy.sql) — bukan identity yang terisi sendiri.
      muatan.id = (crypto.randomUUID ? crypto.randomUUID()
                 : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                     const r = Math.random() * 16 | 0;
                     return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                   }));
      muatan.kode = kode;
      muatan.jenis = 'klinik';
      muatan.is_active = true;
      await sbPost('tenants', muatan);
      toast(`Tenant ${nama} terdaftar`, 'ok');
    }
    closeModalForce();
    await tntMuat();
    tntGambar();
  } catch (e) {
    toast('Gagal menyimpan: ' + e.message, 'err');
  }
}

window.renderTenants = renderTenants;
window.tntForm = tntForm;
window.tntSimpan = tntSimpan;
window.tntSetCari = tntSetCari;
window.tntIsiKuota = tntIsiKuota;
