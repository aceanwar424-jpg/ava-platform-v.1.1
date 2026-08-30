// ═══════════════════════════════════════════════════════════════
// MODUL: Klaim Penjamin — BPJS, Asuransi, dan TPA
//
// Versi sebelumnya (481 baris) tidak punya panggilan data, dan yang
// dijanjikannya lebih dari yang bisa ditepati: "Grouper Tarif INA-CBG
// v6.0" dan "Penerbitan SEP lewat VClaim". Keduanya ditampilkan sebagai
// fitur yang berjalan, padahal tidak ada satu baris pun di belakangnya.
//
// Sekarang membaca migrasi 0040.
//
// ── Yang sengaja TIDAK dikerjakan di sini ────────────────────
//
// Tidak ada grouper INA-CBG. Tarif INA-CBG dihitung aplikasi E-Klaim
// resmi Kemenkes dari tabel tarif ber-SK yang diperbarui berkala.
// Menghitungnya sendiri menghasilkan angka yang berbeda dari yang diakui
// verifikator — dan selisih yang lebih tinggi bisa dibaca sebagai
// kelebihan tagih, bukan sekadar salah hitung.
//
// Kolomnya karena itu bernama "tarif dari E-Klaim": angkanya dimasukkan
// dari keluaran E-Klaim, bukan lahir di sini. Begitu pula nomor SEP —
// diterbitkan VClaim, disalin ke sini.
//
// Yang dikerjakan layar ini: kelengkapan berkas, status pengajuan, umur
// klaim, dan selisih antara yang ditagih dengan yang dibayar. Itu bagian
// yang selama ini dikerjakan di spreadsheet.
//
// Prefiks "bk".
// ═══════════════════════════════════════════════════════════════

let bkData = null;
let bkTab = 'klaim';
let bkFilter = 'semua';
let bkPilih = null;

function bkEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function bkRp(n) {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  return (v < 0 ? '−Rp ' : 'Rp ') + Math.abs(v).toLocaleString('id-ID');
}
function bkTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function bkMuat() {
  if (typeof sbGet !== 'function') { bkData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [papan, penjamin, berkas, wajib] = await Promise.all([
      sbGet('klaim_papan', 'select=*&order=created_at.desc&limit=400'),
      aman('penjamin', 'select=*&order=nama'),
      aman('klaim_berkas', 'select=*'),
      aman('penjamin_berkas_wajib', 'select=*'),
    ]);
    bkData = { papan, penjamin, berkas, wajib };
  } catch (e) { bkData = null; }
}

async function renderBpjsClaim() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await bkMuat();

  if (bkData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Klaim Penjamin</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data klaim tidak dapat dibaca.</strong><br>
        Tabel <code>klaim</code> belum ada — jalankan ulang aplikasi agar
        migrasi <code>0040_klaim_penjamin.sql</code> terpasang.
      </div>`;
    return;
  }
  bkGambar();
}

function bkGambar() {
  const K = bkData.papan || [];
  const belumDiajukan = K.filter(x => ['Draf', 'Berkas Lengkap'].includes(x.status));
  const berjalan = K.filter(x => ['Diajukan', 'Verifikasi'].includes(x.status));
  const kembali = K.filter(x => ['Dikembalikan', 'Ditolak'].includes(x.status));
  const dibayar = K.filter(x => x.status === 'Dibayar');
  const tua = berjalan.filter(x => Number(x.umur_hari) > (Number(x.tempo_hari) || 30));

  const totalTagih = K.reduce((a, x) => a + Number(x.tarif_rs || 0), 0);
  const totalBayar = dibayar.reduce((a, x) => a + Number(x.dibayar || 0), 0);
  const totalSelisih = dibayar.reduce((a, x) => a + Number(x.selisih || 0), 0);

  const daftar = bkFilter === 'draf' ? belumDiajukan
               : bkFilter === 'berjalan' ? berjalan
               : bkFilter === 'kembali' ? kembali
               : bkFilter === 'dibayar' ? dibayar : K;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Klaim Penjamin</h1>
        <p class="muted">BPJS, asuransi swasta, dan TPA — kelengkapan berkas dan status pembayaran.</p>
      </div>
      ${(bkData.penjamin || []).length
        ? `<div><button class="btn btn-primary" onclick="bkKlaimBaru()">+ Klaim Baru</button></div>`
        : ''}
    </div>

    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Layar ini <b>tidak menghitung tarif INA-CBG</b>. Tarif dihitung
      aplikasi E-Klaim resmi dari tabel tarif ber-SK; angka di kolom
      "Tarif E-Klaim" dimasukkan dari keluarannya. Nomor SEP juga
      diterbitkan VClaim dan disalin ke sini. Menghitung sendiri
      menghasilkan angka berbeda dari yang diakui verifikator, dan
      selisih yang lebih tinggi bisa dibaca sebagai kelebihan tagih.
    </div>

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${bkTab === 'klaim' ? 'active' : ''}"
              onclick="bkGantiTab('klaim')">Klaim (${K.length})</button>
      <button class="tab ${bkTab === 'penjamin' ? 'active' : ''}"
              onclick="bkGantiTab('penjamin')">Penjamin &amp; Berkas Wajib</button>
    </div>

    ${bkTab === 'penjamin' ? bkTabPenjamin() : `
      ${tua.length ? `
        <div class="card" style="padding:12px 16px; margin-bottom:12px;
                                 border-left:3px solid var(--warning)">
          <b>${tua.length} klaim melewati janji waktu bayar penjamin</b> dan
          belum dibayar. Umur klaim dihitung sejak tanggal diajukan.
        </div>` : ''}
      ${kembali.length ? `
        <div class="card" style="padding:12px 16px; margin-bottom:12px;
                                 border-left:3px solid var(--danger)">
          <b>${kembali.length} klaim dikembalikan atau ditolak.</b>
          Alasannya tercatat di tiap baris — tiap putaran bolak-balik
          menambah minggu ke waktu pembayaran.
        </div>` : ''}

      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
                  gap:12px; margin-bottom:16px">
        ${bkKartu('Semua klaim', K.length, 'semua', 'var(--text)')}
        ${bkKartu('Belum diajukan', belumDiajukan.length, 'draf',
                  belumDiajukan.length ? 'var(--warning)' : 'var(--text3)')}
        ${bkKartu('Sedang berjalan', berjalan.length, 'berjalan', 'var(--info)')}
        ${bkKartu('Dikembalikan', kembali.length, 'kembali',
                  kembali.length ? 'var(--danger)' : 'var(--text3)')}
        ${bkKartu('Sudah dibayar', dibayar.length, 'dibayar', 'var(--success)')}
      </div>

      ${K.length ? `
        <div class="card" style="padding:14px 16px; margin-bottom:12px; display:flex;
                                 gap:24px; flex-wrap:wrap; font-size:13px">
          <div><span style="color:var(--text3)">Total ditagih</span><br>
            <b style="font-size:17px">${bkRp(totalTagih)}</b></div>
          <div><span style="color:var(--text3)">Sudah dibayar</span><br>
            <b style="font-size:17px; color:var(--success)">${bkRp(totalBayar)}</b></div>
          <div><span style="color:var(--text3)">Selisih pada yang dibayar</span><br>
            <b style="font-size:17px; color:${totalSelisih > 0
              ? 'var(--danger)' : 'inherit'}">${bkRp(totalSelisih)}</b></div>
        </div>` : ''}

      ${!daftar.length ? `
        <div class="card" style="padding:32px; text-align:center">
          <div style="font-size:28px; opacity:.4; margin-bottom:8px">🧾</div>
          <div style="font-weight:700; margin-bottom:4px">
            ${bkFilter === 'semua' ? 'Belum ada klaim tercatat'
                                   : 'Tidak ada klaim pada kelompok ini'}</div>
          ${!(bkData.penjamin || []).length ? `
            <div style="font-size:13px; color:var(--text3); max-width:460px; margin:0 auto">
              Daftarkan penjamin beserta berkas yang diwajibkannya lebih
              dulu, di tab Penjamin &amp; Berkas Wajib.</div>` : ''}
        </div>` : `
        <div class="card" style="overflow-x:auto">
          <table class="data-table"><thead><tr>
            <th>No. Klaim</th><th>Pasien</th><th>Penjamin</th>
            <th>SEP / Kartu</th><th>CBG</th>
            <th style="text-align:right">Tarif RS</th>
            <th style="text-align:right">Tarif E-Klaim</th>
            <th style="text-align:right">Dibayar</th>
            <th style="text-align:right">Selisih</th>
            <th style="text-align:right">Berkas</th>
            <th style="text-align:right">Umur</th>
            <th>Status</th><th></th>
          </tr></thead><tbody>
          ${daftar.map(k => {
            const lengkap = Number(k.berkas_ada) === Number(k.berkas_total)
                         && Number(k.berkas_total) > 0;
            const lewatTempo = Number(k.umur_hari) > (Number(k.tempo_hari) || 30);
            return `<tr style="${bkPilih === k.id ? 'outline:2px solid var(--primary)' : ''}">
              <td><b>${bkEsc(k.no_klaim)}</b>
                <div style="font-size:11px; color:var(--text3)">${bkTgl(k.created_at)}</div></td>
              <td>${bkEsc(k.patient_name || '—')}</td>
              <td style="font-size:12px">${bkEsc(k.penjamin_nama || '—')}</td>
              <td style="font-size:11px">${bkEsc(k.no_sep || '—')}
                <div style="color:var(--text3)">${bkEsc(k.no_kartu || '')}</div></td>
              <td style="font-size:12px">${bkEsc(k.kode_cbg || '—')}</td>
              <td style="text-align:right">${bkRp(k.tarif_rs)}</td>
              <td style="text-align:right">${bkRp(k.tarif_dari_eklaim)}</td>
              <td style="text-align:right">${bkRp(k.dibayar)}</td>
              <td style="text-align:right; font-weight:${k.selisih ? '700' : '400'};
                         color:${Number(k.selisih) > 0 ? 'var(--danger)' : 'inherit'}">
                ${bkRp(k.selisih)}</td>
              <td style="text-align:right; color:${lengkap
                ? 'var(--success)' : 'var(--warning)'}">
                ${k.berkas_ada}/${k.berkas_total}</td>
              <td style="text-align:right; color:${lewatTempo
                ? 'var(--warning)' : 'inherit'}">
                ${k.umur_hari != null ? k.umur_hari + ' hr' : '—'}</td>
              <td><span style="font-weight:600">${bkEsc(k.status)}</span>
                ${k.alasan_kembali ? `<div style="font-size:11px; color:var(--danger)">
                  ${bkEsc(k.alasan_kembali)}</div>` : ''}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-sm" onclick="bkBerkas(${k.id})">Berkas</button>
                ${['Draf','Berkas Lengkap','Dikembalikan'].includes(k.status)
                  ? `<button class="btn btn-sm btn-primary" onclick="bkAjukan(${k.id})">
                       Ajukan</button>` : ''}
                ${['Diajukan','Verifikasi','Disetujui'].includes(k.status)
                  ? `<button class="btn btn-sm" onclick="bkStatus(${k.id})">
                       Ubah Status</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
          </tbody></table>
        </div>`}

      ${bkPilih ? bkPanelBerkas() : ''}`}`;
}

function bkKartu(label, angka, kunci, warna) {
  return `<div class="card" style="padding:14px; cursor:pointer;
            ${bkFilter === kunci ? 'outline:2px solid var(--primary)' : ''}"
            onclick="bkSaring('${kunci}')">
    <div style="font-size:12px; color:var(--text3)">${label}</div>
    <div style="font-size:22px; font-weight:800; color:${warna}">${angka}</div>
  </div>`;
}

function bkGantiTab(t) { bkTab = t; bkPilih = null; bkGambar(); }
function bkSaring(k) { bkFilter = k; bkGambar(); }

function bkTabPenjamin() {
  const P = bkData.penjamin || [];
  const W = bkData.wajib || [];

  if (!P.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🏦</div>
      <div style="font-weight:700; margin-bottom:6px">Belum ada penjamin terdaftar</div>
      <div style="font-size:13px; color:var(--text3); max-width:520px; margin:0 auto 14px;
                  line-height:1.8">
        Tiap penjamin menuntut berkas yang berbeda. Daftarnya sengaja
        dibiarkan kosong: menebak persyaratan lalu memakainya untuk
        meloloskan pengajuan berarti klaim dikirim tanpa berkas yang
        sebenarnya diminta, dan baru ketahuan saat dikembalikan
        berminggu-minggu kemudian.
      </div>
      <button class="btn btn-primary" onclick="bkPenjaminBaru()">+ Daftarkan Penjamin</button>
    </div>`;
  }

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="bkPenjaminBaru()">
        + Penjamin</button>
    </div>
    <div style="display:grid; gap:12px">
      ${P.map(p => {
        const w = W.filter(x => x.penjamin_id === p.id);
        return `<div class="card" style="padding:16px">
          <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap">
            <div>
              <div style="font-weight:700">${bkEsc(p.nama)}</div>
              <div style="font-size:12px; color:var(--text3)">
                ${bkEsc(p.kode)}${p.jenis ? ' · ' + bkEsc(p.jenis) : ''}
                ${p.tempo_hari ? ' · janji bayar ' + p.tempo_hari + ' hari' : ''}</div>
            </div>
            <button class="btn btn-sm" onclick="bkBerkasWajib(${p.id})">
              + Berkas Wajib</button>
          </div>
          <div style="margin-top:10px; font-size:12px; line-height:1.8">
            ${w.length
              ? 'Berkas wajib: ' + w.map(x =>
                  bkEsc(x.jenis_berkas) + (x.wajib ? '' : ' (opsional)')).join(', ')
              : '<span style="color:var(--warning)">Belum ada daftar berkas wajib — '
                + 'kelengkapan klaim untuk penjamin ini belum bisa diperiksa.</span>'}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function bkBerkas(id) {
  bkPilih = (bkPilih === id) ? null : id;
  bkGambar();
}

function bkPanelBerkas() {
  const k = (bkData.papan || []).find(x => x.id === bkPilih);
  if (!k) return '';
  const B = (bkData.berkas || []).filter(b => b.klaim_id === bkPilih);

  return `
    <div class="card" style="padding:18px; margin-top:16px">
      <div style="font-weight:800; margin-bottom:2px">
        Kelengkapan Berkas — ${bkEsc(k.no_klaim)}</div>
      <div style="font-size:12px; color:var(--text3); margin-bottom:12px">
        ${bkEsc(k.patient_name || '')} · ${bkEsc(k.penjamin_nama || '')}</div>

      ${!B.length ? `
        <div style="padding:16px; background:var(--bg2); border-radius:8px; font-size:13px;
                    color:var(--text3)">
          Belum ada daftar berkas. Tetapkan berkas wajib untuk penjamin ini
          di tab Penjamin, lalu buat ulang klaimnya.
        </div>` : `
        <table class="data-table"><thead><tr>
          <th>Jenis Berkas</th><th>Ada</th><th>Dicek</th><th>Catatan</th><th></th>
        </tr></thead><tbody>
        ${B.map(b => `<tr>
          <td>${bkEsc(b.jenis_berkas)}</td>
          <td>${b.ada
            ? '<span style="color:var(--success); font-weight:700">✓ ada</span>'
            : '<span style="color:var(--warning)">belum</span>'}</td>
          <td style="font-size:12px">${bkEsc(b.dicek_oleh || '—')}</td>
          <td style="font-size:12px">${bkEsc(b.catatan || '—')}</td>
          <td><button class="btn btn-sm" onclick="bkTandaiBerkas(${b.id}, ${!b.ada})">
            ${b.ada ? 'Batalkan' : 'Tandai Ada'}</button></td>
        </tr>`).join('')}
        </tbody></table>`}
    </div>`;
}

async function bkTandaiBerkas(id, ada) {
  try {
    await sbPatch('klaim_berkas', id, {
      ada: ada,
      dicek_oleh: ada ? (window.currentUsername || 'petugas') : null,
      dicek_at: ada ? new Date().toISOString() : null,
    });
    await renderBpjsClaim();
  } catch (e) { alert('Gagal memperbarui berkas: ' + e.message); }
}

async function bkPenjaminBaru() {
  const kode = prompt('Kode penjamin (mis. BPJS):');
  if (!kode) return;
  const nama = prompt('Nama penjamin:');
  if (!nama) return;
  const jenis = prompt('Jenis (BPJS / Asuransi / TPA / Korporat):', 'BPJS');
  if (jenis === null) return;
  const tempo = prompt('Janji waktu bayar (hari):', '');
  if (tempo === null) return;

  try {
    await sbPost('penjamin', {
      kode: kode.trim().toUpperCase(), nama: nama.trim(),
      jenis: jenis || null,
      tempo_hari: tempo ? parseInt(tempo, 10) : null,
    });
    await renderBpjsClaim();
  } catch (e) { alert('Gagal menyimpan penjamin: ' + e.message); }
}

async function bkBerkasWajib(penjaminId) {
  const jenis = prompt('Jenis berkas yang diwajibkan penjamin ini\n'
    + '(mis. Resume Medis, Billing, Hasil Penunjang, Fotokopi Kartu):');
  if (!jenis) return;
  const wajib = confirm('Berkas ini WAJIB (menahan pengajuan bila belum ada)?\n\n'
    + 'OK = wajib, Batal = opsional');
  try {
    await sbPost('penjamin_berkas_wajib', {
      penjamin_id: penjaminId, jenis_berkas: jenis.trim(), wajib: wajib,
    });
    await renderBpjsClaim();
  } catch (e) { alert('Gagal menyimpan berkas wajib: ' + e.message); }
}

async function bkKlaimBaru() {
  const P = bkData.penjamin || [];
  const pilihan = P.map((p, i) => `${i + 1}. ${p.nama}`).join('\n');
  const n = prompt(`Penjamin:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const p = P[parseInt(n, 10) - 1];
  if (!p) { alert('Nomor tidak dikenal.'); return; }

  const pasien = prompt('Nama pasien:');
  if (!pasien) return;
  const kartu = prompt('Nomor kartu peserta:', '');
  if (kartu === null) return;
  const sep = prompt('Nomor SEP (dari VClaim, kosongkan bila belum terbit):', '');
  if (sep === null) return;
  const rawat = prompt('Jenis rawat (Rawat Jalan / Rawat Inap):', 'Rawat Jalan');
  if (rawat === null) return;
  const dx = prompt('Diagnosa utama (ICD-10):', '');
  if (dx === null) return;
  const tarif = prompt('Tarif rumah sakit (Rp):', '0');
  if (tarif === null) return;

  try {
    const r = await sbRpc('klaim_buat', {
      p_data: {
        penjamin_id: String(p.id), patient_name: pasien,
        no_kartu: kartu || null, no_sep: sep || null,
        jenis_rawat: rawat || null, diagnosa_utama: dx || null,
        tarif_rs: parseFloat(tarif) || 0,
        oleh: (window.currentUsername || null),
      },
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Klaim ${r.no_klaim} dibuat.\n`
      + `${r.berkas_disiapkan} berkas disiapkan untuk dilengkapi.`
      + (r.catatan ? `\n\n${r.catatan}` : ''));
    await renderBpjsClaim();
  } catch (e) { alert('Gagal membuat klaim: ' + e.message); }
}

async function bkAjukan(id) {
  try {
    const r = await sbRpc('klaim_ajukan', {
      p_klaim_id: id, p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) {
      const kurang = Array.isArray(r.kurang) ? r.kurang.join('\n• ') : '';
      alert(r.error + (kurang ? '\n\nBelum ada:\n• ' + kurang : ''));
      return;
    }
    alert(`Klaim ${r.no_klaim} diajukan.`);
    await renderBpjsClaim();
  } catch (e) { alert('Gagal mengajukan klaim: ' + e.message); }
}

async function bkStatus(id) {
  const st = prompt('Status baru:\n\n'
    + 'Verifikasi / Disetujui / Dikembalikan / Ditolak / Dibayar');
  if (!st) return;
  let alasan = null, dibayar = null;
  if (['Dikembalikan', 'Ditolak'].includes(st)) {
    alasan = prompt('Alasan (wajib):');
    if (!alasan) return;
  }
  if (st === 'Dibayar') {
    const v = prompt('Jumlah yang dibayar penjamin (Rp):');
    if (v === null) return;
    dibayar = parseFloat(v);
  }

  try {
    const r = await sbRpc('klaim_ubah_status', {
      p_klaim_id: id, p_status: st, p_alasan: alasan,
      p_dibayar: dibayar, p_oleh: (window.currentUsername || 'petugas'),
    });
    if (r && r.error) { alert(r.error); return; }
    await renderBpjsClaim();
  } catch (e) { alert('Gagal mengubah status: ' + e.message); }
}

window.renderBpjsClaim  = renderBpjsClaim;
window.bkGantiTab       = bkGantiTab;
window.bkSaring         = bkSaring;
window.bkBerkas         = bkBerkas;
window.bkTandaiBerkas   = bkTandaiBerkas;
window.bkPenjaminBaru   = bkPenjaminBaru;
window.bkBerkasWajib    = bkBerkasWajib;
window.bkKlaimBaru      = bkKlaimBaru;
window.bkAjukan         = bkAjukan;
window.bkStatus         = bkStatus;
