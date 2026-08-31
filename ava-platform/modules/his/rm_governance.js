// ═══════════════════════════════════════════════════════════════
// MODUL: Kelengkapan & Retensi Rekam Medis
//
// Membaca migrasi 0043.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Kelengkapan dihitung dari tabel sumbernya, bukan dari daftar centang.
// Daftar centang mengukur kerajinan mencentang, bukan kelengkapan
// berkas. Unsur yang memang tidak punya tabel sendiri (lembar
// persetujuan kertas terpindai, misalnya) tetap manual — dan layar
// menandai mana yang otomatis dan mana yang manual, supaya tidak ada
// yang mengira semuanya terperiksa sendiri.
//
// Angka kelengkapan tidak ditampilkan sebagai satu persentase besar
// tanpa rincian. Yang berguna bagi petugas bukan "78%" melainkan "yang
// kurang: diagnosa dan resume pulang".
//
// Pemusnahan tidak berjalan otomatis saat masa simpan lewat. Ia butuh
// petugas yang bertanggung jawab dan berita acara — dan penjagaannya
// ada di basis data, bukan hanya di layar.
//
// Prefiks "rg".
// ═══════════════════════════════════════════════════════════════

let rgData = null;
let rgTab = 'kelengkapan';
let rgFilter = 'semua';

function rgEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function rgTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function rgMuat() {
  if (typeof sbGet !== 'function') { rgData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [papan, unsur, aturan, admisi] = await Promise.all([
      sbGet('rm_papan', 'select=*&order=dinilai_at.desc&limit=400'),
      sbGet('rm_unsur', 'select=*&order=urutan,id'),
      aman('rm_aturan_retensi', 'select=*&order=kode'),
      aman('admissions',
        'select=id,visit_number,patient_name,mr_number,visit_date&order=id.desc&limit=200'),
    ]);
    rgData = { papan, unsur, aturan, admisi };
  } catch (e) { rgData = null; }
}

async function renderRmGovernance() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await rgMuat();

  if (rgData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Kelengkapan &amp; Retensi Rekam Medis</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data kelengkapan tidak dapat dibaca.</strong><br>
        Tabel <code>rm_kelengkapan</code> belum ada — jalankan ulang aplikasi
        agar migrasi <code>0043_rm_kelengkapan_rad_katalog.sql</code> terpasang.
      </div>`;
    return;
  }
  rgGambar();
}

function rgGambar() {
  const P = rgData.papan || [];
  const U = rgData.unsur || [];
  const lengkap = P.filter(x => x.hasil === 'Lengkap');
  const kurang = P.filter(x => x.hasil === 'Tidak Lengkap');
  const siapMusnah = P.filter(x => x.status_retensi === 'Siap Dimusnahkan');
  const belumDinilai = (rgData.admisi || []).filter(a =>
    !P.some(p => p.admission_id === a.id));

  const rerata = P.length
    ? Math.round(P.reduce((a, x) => a + Number(x.persen || 0), 0) / P.length) : 0;

  const daftar = rgFilter === 'lengkap' ? lengkap
               : rgFilter === 'kurang' ? kurang
               : rgFilter === 'musnah' ? siapMusnah : P;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Kelengkapan &amp; Retensi Rekam Medis</h1>
        <p class="muted">Penilaian kelengkapan berkas dan pengelolaan masa simpan.</p>
      </div>
      ${U.length && belumDinilai.length
        ? `<div><button class="btn btn-primary" onclick="rgNilaiMassal()">
             Nilai ${belumDinilai.length} Kunjungan Baru</button></div>` : ''}
    </div>

    ${!U.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>Unsur kelengkapan belum ditetapkan.</b> Kelengkapan belum bisa
        dinilai sampai ada daftar unsur yang harus ada di berkas.
        Tetapkan di tab Unsur Kelengkapan.
      </div>` : ''}
    ${siapMusnah.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${siapMusnah.length} berkas sudah lewat masa simpan.</b>
        Pemusnahan tidak berjalan otomatis — ia butuh petugas yang
        bertanggung jawab dan berita acara.
      </div>` : ''}

    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
                gap:12px; margin-bottom:16px">
      ${rgKartu('Semua dinilai', P.length, 'semua', 'var(--text)')}
      ${rgKartu('Lengkap', lengkap.length, 'lengkap', 'var(--success)')}
      ${rgKartu('Tidak lengkap', kurang.length, 'kurang',
                kurang.length ? 'var(--danger)' : 'var(--text3)')}
      ${rgKartu('Siap dimusnahkan', siapMusnah.length, 'musnah',
                siapMusnah.length ? 'var(--warning)' : 'var(--text3)')}
      <div class="card" style="padding:14px">
        <div style="font-size:12px; color:var(--text3)">Rerata kelengkapan</div>
        <div style="font-size:22px; font-weight:800;
                    color:${rerata >= 90 ? 'var(--success)'
                          : rerata >= 70 ? 'var(--warning)' : 'var(--danger)'}">
          ${rerata}%</div>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${rgTab === 'kelengkapan' ? 'active' : ''}"
              onclick="rgGantiTab('kelengkapan')">Penilaian (${P.length})</button>
      <button class="tab ${rgTab === 'unsur' ? 'active' : ''}"
              onclick="rgGantiTab('unsur')">Unsur Kelengkapan (${U.length})</button>
      <button class="tab ${rgTab === 'retensi' ? 'active' : ''}"
              onclick="rgGantiTab('retensi')">Aturan Retensi</button>
    </div>

    ${rgTab === 'kelengkapan' ? rgTabKelengkapan(daftar)
    : rgTab === 'unsur'       ? rgTabUnsur(U) : rgTabRetensi()}`;
}

function rgKartu(label, angka, kunci, warna) {
  return `<div class="card" style="padding:14px; cursor:pointer;
            ${rgFilter === kunci ? 'outline:2px solid var(--primary)' : ''}"
            onclick="rgSaring('${kunci}')">
    <div style="font-size:12px; color:var(--text3)">${label}</div>
    <div style="font-size:22px; font-weight:800; color:${warna}">${angka}</div>
  </div>`;
}

function rgGantiTab(t) { rgTab = t; rgGambar(); }
function rgSaring(k) { rgFilter = k; rgTab = 'kelengkapan'; rgGambar(); }

function rgTabKelengkapan(D) {
  if (!D.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📁</div>
      <div style="font-weight:700; margin-bottom:4px">
        ${rgFilter === 'semua' ? 'Belum ada berkas yang dinilai'
                               : 'Tidak ada berkas pada kelompok ini'}</div>
      <div style="font-size:13px; color:var(--text3)">
        Kelengkapan dihitung dari isian yang benar-benar ada di tabelnya,
        bukan dari daftar centang.</div>
    </div>`;
  }

  const warnaRet = {
    'Aktif': 'var(--success)', 'Siap Dimusnahkan': 'var(--danger)',
    'Dimusnahkan': 'var(--text3)', 'Retensi belum ditetapkan': 'var(--warning)',
  };

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>Kunjungan</th><th>Pasien</th>
      <th style="text-align:right">Kelengkapan</th>
      <th>Yang Kurang</th><th>Dinilai</th>
      <th>Simpan s/d</th><th>Retensi</th><th></th>
    </tr></thead><tbody>
    ${D.map(k => {
      const kurang = Array.isArray(k.kurang) ? k.kurang : [];
      const pct = Number(k.persen || 0);
      return `<tr style="${k.hasil === 'Tidak Lengkap' ? 'background:rgba(255,180,0,.04)' : ''}">
        <td><b>${rgEsc(k.visit_number || k.admission_id)}</b></td>
        <td>${rgEsc(k.patient_name || '—')}
          ${k.mr_number ? `<div style="font-size:11px; color:var(--text3)">
            ${rgEsc(k.mr_number)}</div>` : ''}</td>
        <td style="text-align:right; font-weight:700;
                   color:${pct === 100 ? 'var(--success)'
                         : pct >= 70 ? 'var(--warning)' : 'var(--danger)'}">
          ${k.jml_terpenuhi}/${k.jml_wajib}
          <div style="font-size:11px; font-weight:400">${pct}%</div></td>
        <td style="font-size:12px; max-width:280px">${kurang.length
          ? kurang.map(x => rgEsc(x.nama)
              + (x.cara === 'manual' ? ' <span style="color:var(--text3)">(manual)</span>' : ''))
              .join(', ')
          : '<span style="color:var(--success)">—</span>'}</td>
        <td style="font-size:12px">${rgTgl(k.dinilai_at)}
          ${k.dinilai_oleh ? `<div style="font-size:11px; color:var(--text3)">
            ${rgEsc(k.dinilai_oleh)}</div>` : ''}</td>
        <td>${rgTgl(k.simpan_sampai)}
          ${k.sisa_hari != null && Number(k.sisa_hari) < 0
            ? `<div style="font-size:11px; color:var(--danger)">
                 lewat ${Math.abs(k.sisa_hari)} hari</div>` : ''}</td>
        <td><span style="font-weight:600; color:${warnaRet[k.status_retensi] || 'var(--text3)'}">
          ${rgEsc(k.status_retensi)}</span></td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm" onclick="rgNilai(${k.admission_id})">Nilai Ulang</button>
          ${k.status_retensi === 'Siap Dimusnahkan'
            ? `<button class="btn btn-sm" onclick="rgMusnahkan(${k.admission_id})">
                 Musnahkan</button>` : ''}
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>
  </div>`;
}

function rgTabUnsur(U) {
  if (!U.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">☑️</div>
      <div style="font-weight:700; margin-bottom:6px">Unsur kelengkapan belum ditetapkan</div>
      <div style="font-size:13px; color:var(--text3); max-width:540px; margin:0 auto 14px;
                  line-height:1.8">
        Tiap unsur menyebut cara memeriksanya. Yang <b>otomatis</b> dihitung
        langsung dari tabelnya — ada anamnesa atau tidak, ada diagnosa atau
        tidak. Yang <b>manual</b> dicentang petugas, dipakai hanya untuk
        berkas yang memang tidak punya tabel sendiri.
      </div>
      <button class="btn btn-primary" onclick="rgUnsurBaru()">+ Tetapkan Unsur</button>
    </div>`;
  }

  const SUMBER_DIKENAL = ['anamnesas', 'vital_signs', 'icd_diagnostics', 'tindakan',
    'tindakan_consent', 'prescriptions', 'lab_samples', 'radiology_orders'];

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="rgUnsurBaru()">+ Unsur</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th style="width:60px">Urut</th><th>Kode</th><th>Unsur</th><th>Kelompok</th>
        <th>Cara Periksa</th><th>Sumber</th><th>Wajib</th><th>Berlaku</th>
      </tr></thead><tbody>
      ${U.map(u => {
        const dikenal = !u.sumber_tabel || SUMBER_DIKENAL.includes(u.sumber_tabel);
        return `<tr style="${u.aktif === false ? 'opacity:.6' : ''}">
          <td style="text-align:center">${u.urutan ?? '—'}</td>
          <td><b>${rgEsc(u.kode)}</b></td>
          <td>${rgEsc(u.nama)}</td>
          <td style="font-size:12px">${rgEsc(u.kelompok || '—')}</td>
          <td>${u.cara_periksa === 'otomatis'
            ? '<span style="color:var(--success)">otomatis</span>'
            : '<span style="color:var(--text3)">manual</span>'}</td>
          <td style="font-size:12px">${u.sumber_tabel
            ? (dikenal
                ? `<code>${rgEsc(u.sumber_tabel)}</code>`
                : `<code>${rgEsc(u.sumber_tabel)}</code>
                   <div style="font-size:11px; color:var(--warning)">
                     tidak dikenal — diperlakukan manual</div>`)
            : '—'}</td>
          <td>${u.wajib ? 'ya' : 'tidak'}</td>
          <td style="font-size:12px">${rgEsc(u.berlaku_rawat || 'Semua')}</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7">
      Sumber tabel yang dikenali: ${SUMBER_DIKENAL.map(s => `<code>${s}</code>`).join(', ')}.
      Unsur yang menunjuk tabel di luar daftar ini diperlakukan sebagai
      manual, bukan diam-diam dianggap terpenuhi — daftarnya tertutup
      karena menerima nama tabel apa pun dari data berarti membiarkan isi
      tabel menentukan kueri yang dijalankan.
    </div>`;
}

function rgTabRetensi() {
  const A = rgData.aturan || [];
  if (!A.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">⏳</div>
      <div style="font-weight:700; margin-bottom:6px">Aturan retensi belum ditetapkan</div>
      <div style="font-size:13px; color:var(--text3); max-width:540px; margin:0 auto 14px;
                  line-height:1.8">
        Masa simpan rekam medis diatur peraturan, dan angkanya berbeda untuk
        rekam medis umum, anak, dan kasus tertentu. Angkanya sengaja tidak
        ditanam di sistem — ia ditetapkan penanggung jawab rekam medis
        beserta dasar hukumnya, supaya saat berubah tidak perlu menyunting
        kode dan ada jejak siapa menetapkan.
      </div>
      <button class="btn btn-primary" onclick="rgAturanBaru()">+ Tetapkan Aturan</button>
    </div>`;
  }

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="rgAturanBaru()">+ Aturan</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Kode</th><th>Nama</th><th>Berlaku Untuk</th>
        <th style="text-align:right">Masa Simpan</th>
        <th>Yang Diabadikan</th><th>Dasar Hukum</th><th>Ditetapkan</th><th>Aktif</th>
      </tr></thead><tbody>
      ${A.map(a => `<tr>
        <td><b>${rgEsc(a.kode)}</b></td>
        <td>${rgEsc(a.nama)}</td>
        <td>${rgEsc(a.berlaku_untuk || '—')}</td>
        <td style="text-align:right">${a.simpan_tahun} tahun</td>
        <td style="font-size:12px">${rgEsc(a.abadikan || '—')}</td>
        <td style="font-size:12px">${rgEsc(a.dasar_hukum || '—')}</td>
        <td style="font-size:12px">${rgEsc(a.ditetapkan_oleh || '—')}
          ${a.tgl_berlaku ? `<div style="font-size:11px; color:var(--text3)">
            ${rgTgl(a.tgl_berlaku)}</div>` : ''}</td>
        <td>${a.aktif ? 'ya' : 'tidak'}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

// ── Tindakan ─────────────────────────────────────────────────────
async function rgNilai(admissionId) {
  try {
    const r = await sbRpc('rm_hitung_kelengkapan', {
      p_admission_id: admissionId,
      p_oleh: (window.currentUsername || 'petugas RM'),
    });
    if (r && r.error) { alert(r.error); return; }
    const kurang = Array.isArray(r.kurang) ? r.kurang : [];
    alert(`${r.hasil} — ${r.terpenuhi}/${r.wajib} (${r.persen}%)`
      + (kurang.length ? '\n\nYang kurang:\n• ' + kurang.map(x => x.nama).join('\n• ') : '')
      + (r.catatan ? `\n\n${r.catatan}` : ''));
    await renderRmGovernance();
  } catch (e) { alert('Gagal menilai: ' + e.message); }
}

// Penilaian massal dijalankan berurutan, bukan serentak. Kunjungan bisa
// ratusan; mengirim semuanya sekaligus membuat basis data lokal tersendat
// dan sebagian gagal tanpa jelas yang mana.
async function rgNilaiMassal() {
  const belum = (rgData.admisi || []).filter(a =>
    !(rgData.papan || []).some(p => p.admission_id === a.id));
  if (!belum.length) { alert('Tidak ada kunjungan baru yang perlu dinilai.'); return; }
  if (!confirm(`Nilai kelengkapan ${belum.length} kunjungan?`)) return;

  let ok = 0, gagal = 0;
  for (const a of belum) {
    try {
      const r = await sbRpc('rm_hitung_kelengkapan', {
        p_admission_id: a.id, p_oleh: (window.currentUsername || 'petugas RM'),
      });
      if (r && r.error) gagal++; else ok++;
    } catch (_) { gagal++; }
  }
  alert(`Selesai. Berhasil ${ok}${gagal ? `, gagal ${gagal}` : ''}.`);
  await renderRmGovernance();
}

async function rgMusnahkan(admissionId) {
  const ba = prompt('Nomor berita acara pemusnahan (wajib):');
  if (!ba) return;
  const oleh = prompt('Dimusnahkan oleh (wajib):', window.currentUsername || '');
  if (!oleh) return;
  if (!confirm('Pemusnahan tidak bisa dibatalkan. Lanjutkan?')) return;

  try {
    const r = await sbRpc('rm_musnahkan', {
      p_admission_id: admissionId, p_berita_acara: ba, p_oleh: oleh,
    });
    if (r && r.error) { alert(r.error); return; }
    await renderRmGovernance();
  } catch (e) { alert('Gagal mencatat pemusnahan: ' + e.message); }
}

async function rgUnsurBaru() {
  const kode = prompt('Kode unsur (mis. ANM):');
  if (!kode) return;
  const nama = prompt('Nama unsur:');
  if (!nama) return;
  const kelompok = prompt('Kelompok (Identitas / Anamnesis / Pemeriksaan / '
    + 'Tindakan / Pulang):', '');
  if (kelompok === null) return;
  const otomatis = confirm('Diperiksa OTOMATIS dari tabel?\n\n'
    + 'OK = otomatis (pilih tabel berikutnya)\nBatal = manual (dicentang petugas)');
  let sumber = null;
  if (otomatis) {
    sumber = prompt('Tabel sumber:\n\nanamnesas / vital_signs / icd_diagnostics / '
      + 'tindakan / tindakan_consent / prescriptions / lab_samples / radiology_orders', '');
    if (sumber === null) return;
  }
  const wajib = confirm('Unsur ini WAJIB ada?\n\nOK = wajib, Batal = opsional');
  const berlaku = prompt('Berlaku untuk (Semua / Jalan / Inap):', 'Semua');
  if (berlaku === null) return;
  const urutan = prompt('Urutan tampil:', '0');
  if (urutan === null) return;

  try {
    await sbPost('rm_unsur', {
      kode: kode.trim().toUpperCase(), nama: nama.trim(),
      kelompok: kelompok || null,
      cara_periksa: otomatis ? 'otomatis' : 'manual',
      sumber_tabel: sumber || null, wajib: wajib,
      berlaku_rawat: berlaku || 'Semua',
      urutan: parseInt(urutan, 10) || 0,
    });
    await renderRmGovernance();
  } catch (e) { alert('Gagal menyimpan unsur: ' + e.message); }
}

async function rgAturanBaru() {
  const kode = prompt('Kode aturan (mis. UMUM):');
  if (!kode) return;
  const nama = prompt('Nama aturan:');
  if (!nama) return;
  const untuk = prompt('Berlaku untuk (umum / anak / kasus tertentu):', 'umum');
  if (untuk === null) return;
  const tahun = prompt('Masa simpan (tahun):');
  if (!tahun) return;
  const abadikan = prompt('Yang diabadikan setelah masa aktif '
    + '(mis. ringkasan pulang, lembar persetujuan):', '');
  if (abadikan === null) return;
  const dasar = prompt('Dasar hukum / rujukan penetapan:', '');
  if (dasar === null) return;

  try {
    await sbPost('rm_aturan_retensi', {
      kode: kode.trim().toUpperCase(), nama: nama.trim(),
      berlaku_untuk: untuk || null,
      simpan_tahun: parseInt(tahun, 10),
      abadikan: abadikan || null, dasar_hukum: dasar || null,
      ditetapkan_oleh: (window.currentUsername || null),
      tgl_berlaku: new Date().toISOString().slice(0, 10),
    });
    await renderRmGovernance();
  } catch (e) { alert('Gagal menyimpan aturan: ' + e.message); }
}

window.renderRmGovernance = renderRmGovernance;
window.rgGantiTab   = rgGantiTab;
window.rgSaring     = rgSaring;
window.rgNilai      = rgNilai;
window.rgNilaiMassal = rgNilaiMassal;
window.rgMusnahkan  = rgMusnahkan;
window.rgUnsurBaru  = rgUnsurBaru;
window.rgAturanBaru = rgAturanBaru;
