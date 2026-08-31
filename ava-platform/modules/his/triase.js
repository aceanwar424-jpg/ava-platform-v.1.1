// ═══════════════════════════════════════════════════════════════
// MODUL: Triase IGD, Skrining Risiko & Catatan Pemberian Obat
//
// Membaca migrasi 0046.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Daftar triase diurutkan menurut LEVEL lebih dulu, baru waktu tiba.
// Mengurutkannya menurut waktu datang — seperti antrean biasa —
// mengubur pasien level 1 di bawah pasien level 5 yang datang lebih
// awal. Itu justru kebalikan dari gunanya triase.
//
// Pasien yang lewat target waktu tunggu ditandai merah dan tidak bisa
// disaring hilang. Target itu bukan janji layanan; ia perkiraan berapa
// lama pasien masih aman menunggu.
//
// Layar menyoroti ketidakcocokan antara level triase dan skor EWS.
// Petugas triase menilai dalam hitungan detik dan bisa keliru; angka
// tanda vital yang buruk pada pasien yang ditandai "tidak urgen" adalah
// hal yang harus terlihat, bukan disimpan diam-diam.
//
// Prefiks "tg".
// ═══════════════════════════════════════════════════════════════

let tgData = null;
let tgTab = 'triase';

function tgEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function tgJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TG_WARNA = { 1: '#DC2626', 2: '#EA580C', 3: '#CA8A04', 4: '#16A34A', 5: '#2563EB' };

async function tgMuat() {
  if (typeof sbGet !== 'function') { tgData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [triase, skrining, mar, jadwal, admisi] = await Promise.all([
      sbGet('triase_papan', 'select=*&order=tiba_at.desc&limit=200'),
      aman('skrining_terakhir', 'select=*'),
      aman('mar_papan', 'select=*&order=jadwal_id.desc&limit=200'),
      aman('mar_pemberian', 'select=*&order=id.desc&limit=500'),
      aman('admissions', 'select=id,visit_number,patient_name,mr_number&order=id.desc&limit=100'),
    ]);
    tgData = { triase, skrining, mar, jadwal, admisi };
  } catch (e) { tgData = null; }
}

async function renderTriase(params) {
  if (params && params.tab) tgTab = params.tab;
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await tgMuat();

  if (tgData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Triase &amp; Keselamatan Pasien</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data triase tidak dapat dibaca.</strong><br>
        Tabel <code>triase</code> belum ada — jalankan ulang aplikasi agar migrasi
        <code>0046_triase_skrining_ews_mar.sql</code> terpasang.
      </div>`;
    return;
  }
  tgGambar();
}

function tgGambar() {
  const T = tgData.triase || [];
  const aktif = T.filter(x => x.status === 'Aktif');
  const lewat = aktif.filter(x => x.lewat_target);
  // Ketidakcocokan: level rendah (4-5) tapi EWS >= 7.
  const janggal = aktif.filter(x => x.level >= 4 && Number(x.ews_skor) >= 7);

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Triase &amp; Keselamatan Pasien</h1>
        <p class="muted">Penilaian kegawatan IGD, skrining risiko, dan catatan pemberian obat.</p>
      </div>
      ${tgTab === 'triase'
        ? `<div><button class="btn btn-primary" onclick="tgTriaseBaru()">+ Triase Pasien</button></div>`
        : ''}
    </div>

    ${lewat.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${lewat.length} pasien lewat target waktu tunggu.</b>
        Target itu perkiraan berapa lama pasien masih aman menunggu, bukan
        janji layanan.
      </div>` : ''}
    ${janggal.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${janggal.length} pasien bertanda vital buruk pada level triase rendah.</b>
        Tinjau ulang penilaiannya — triase dinilai dalam hitungan detik dan
        bisa keliru.
      </div>` : ''}

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${tgTab === 'triase' ? 'active' : ''}"
              onclick="tgGantiTab('triase')">Triase IGD (${aktif.length} aktif)</button>
      <button class="tab ${tgTab === 'skrining' ? 'active' : ''}"
              onclick="tgGantiTab('skrining')">Skrining Risiko</button>
      <button class="tab ${tgTab === 'mar' ? 'active' : ''}"
              onclick="tgGantiTab('mar')">Pemberian Obat</button>
    </div>

    ${tgTab === 'triase' ? tgTabTriase(T)
    : tgTab === 'skrining' ? tgTabSkrining() : tgTabMar()}`;
}

function tgGantiTab(t) { tgTab = t; tgGambar(); }

function tgTabTriase(T) {
  if (!T.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🚑</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada pasien ditriase</div>
      <div style="font-size:13px; color:var(--text3); max-width:520px; margin:0 auto">
        Triase menjawab pertanyaan yang berbeda dari antrean: berapa lama
        pasien ini masih aman menunggu.</div>
    </div>`;
  }

  // Level dulu, baru waktu tiba. Mengurutkan menurut waktu datang akan
  // mengubur pasien level 1 di bawah level 5 yang datang lebih awal.
  const urut = [...T].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Aktif' ? -1 : 1;
    if (a.status === 'Aktif' && a.level !== b.level) return a.level - b.level;
    return new Date(b.tiba_at) - new Date(a.tiba_at);
  });

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th style="width:70px">Level</th><th>Pasien</th><th>Keluhan</th>
      <th>Tiba</th><th style="text-align:right">Menunggu</th>
      <th style="text-align:right">Target</th>
      <th style="text-align:right">EWS</th><th>Tanda Vital</th>
      <th>Status</th><th></th>
    </tr></thead><tbody>
    ${urut.map(t => {
      const menit = Math.round(Number(t.menit_tunggu || 0));
      const ewsTinggi = Number(t.ews_skor) >= 7;
      const janggal = t.status === 'Aktif' && t.level >= 4 && ewsTinggi;
      return `<tr style="${t.lewat_target ? 'background:rgba(255,0,0,.05)'
                        : janggal ? 'background:rgba(255,180,0,.06)' : ''}">
        <td style="text-align:center">
          <div style="display:inline-block; min-width:34px; padding:4px 8px;
                      border-radius:6px; font-weight:800; color:#fff;
                      background:${TG_WARNA[t.level] || '#64748b'}">${t.level}</div>
          <div style="font-size:10px; color:var(--text3); margin-top:2px">
            ${tgEsc(t.label_level)}</div></td>
        <td><b>${tgEsc(t.patient_name)}</b>
          <div style="font-size:11px; color:var(--text3)">
            ${tgEsc(t.no_triase)}${t.cara_datang ? ' · ' + tgEsc(t.cara_datang) : ''}</div></td>
        <td style="font-size:12px; max-width:200px">${tgEsc(t.keluhan_utama)}</td>
        <td style="white-space:nowrap">${tgJam(t.tiba_at)}</td>
        <td style="text-align:right; font-weight:${t.lewat_target ? '700' : '400'};
                   color:${t.lewat_target ? 'var(--danger)' : 'inherit'}">
          ${t.status === 'Aktif' ? menit + ' mnt' : '—'}</td>
        <td style="text-align:right; font-size:12px">${t.target_menit} mnt</td>
        <td style="text-align:right; font-weight:800;
                   color:${ewsTinggi ? 'var(--danger)'
                         : Number(t.ews_skor) >= 5 ? 'var(--warning)' : 'inherit'}">
          ${t.ews_skor ?? '—'}</td>
        <td style="font-size:11px; color:var(--text3); white-space:nowrap">
          ${t.td_sistol ? `${t.td_sistol}/${t.td_diastol ?? '?'}` : '—'}
          ${t.nadi ? ` · N${t.nadi}` : ''}
          ${t.napas ? ` · RR${t.napas}` : ''}
          ${t.spo2 ? ` · SpO₂${t.spo2}` : ''}
          ${t.suhu ? ` · ${t.suhu}°` : ''}</td>
        <td>${tgEsc(t.status)}
          ${janggal ? `<div style="font-size:11px; color:var(--warning)">
            EWS tinggi</div>` : ''}</td>
        <td style="white-space:nowrap">
          ${t.status === 'Aktif' ? `
            ${!t.dilihat_dokter_at
              ? `<button class="btn btn-sm btn-primary" onclick="tgDilihat(${t.id})">
                   Dilihat Dokter</button>` : ''}
            <button class="btn btn-sm" onclick="tgTriaseUlang(${t.id})">Triase Ulang</button>`
            : ''}
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>
  </div>`;
}

function tgTabSkrining() {
  const S = tgData.skrining || [];
  const A = tgData.admisi || [];
  const JENIS = ['jatuh', 'nyeri', 'gizi'];

  // Kunjungan yang belum lengkap skriningnya — itulah yang perlu dikerjakan.
  const belum = A.map(a => {
    const punya = JENIS.filter(j => S.some(s => s.admission_id === a.id && s.jenis === j));
    return { ...a, punya, kurang: JENIS.filter(j => !punya.includes(j)) };
  }).filter(x => x.kurang.length);

  const tinggi = S.filter(s => s.kategori === 'Tinggi');

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Tiga skrining wajib saat admisi: <b>risiko jatuh</b>, <b>nyeri</b>, dan
      <b>gizi</b>. Ketiganya dinilai di menit-menit pertama dan menentukan
      tindakan yang berbeda. Alat ukur yang dipakai selalu dicatat — skor 45
      pada satu instrumen berarti hal yang berbeda pada instrumen lain.
    </div>

    ${tinggi.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${tinggi.length} pasien berisiko tinggi.</b>
        Semuanya sudah punya tindak lanjut tertulis — itu ditegakkan saat
        pencatatan.
      </div>` : ''}
    ${belum.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${belum.length} kunjungan belum lengkap skriningnya.</b>
      </div>` : ''}

    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="tgSkriningBaru()">+ Catat Skrining</button>
    </div>

    ${!S.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">📋</div>
        <div style="font-weight:700">Belum ada skrining tercatat</div>
      </div>` : `
      <div class="card" style="margin-bottom:16px; overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Pasien</th><th>Jenis</th><th>Instrumen</th>
          <th style="text-align:right">Skor</th><th>Kategori</th>
          <th>Tindak Lanjut</th><th>Dinilai</th>
        </tr></thead><tbody>
        ${S.map(s => `<tr style="${s.kategori === 'Tinggi'
          ? 'background:rgba(255,0,0,.04)' : ''}">
          <td>${tgEsc(s.patient_name || s.admission_id)}</td>
          <td>${tgEsc(s.jenis)}</td>
          <td style="font-size:12px">${tgEsc(s.instrumen || '—')}</td>
          <td style="text-align:right">${s.skor ?? '—'}</td>
          <td><span style="font-weight:700; color:${s.kategori === 'Tinggi'
            ? 'var(--danger)' : s.kategori === 'Sedang' ? 'var(--warning)' : 'var(--success)'}">
            ${tgEsc(s.kategori)}</span></td>
          <td style="font-size:12px; max-width:260px">${tgEsc(s.tindak_lanjut || '—')}</td>
          <td style="font-size:12px">${tgEsc(s.dinilai_oleh || '—')}
            <div style="font-size:11px; color:var(--text3)">${tgJam(s.dinilai_at)}</div></td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}

    ${belum.length ? `
      <h3 style="font-size:14px; margin:16px 0 8px">Belum Lengkap</h3>
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Kunjungan</th><th>Pasien</th><th>Sudah</th><th>Belum</th>
        </tr></thead><tbody>
        ${belum.slice(0, 30).map(a => `<tr>
          <td>${tgEsc(a.visit_number || a.id)}</td>
          <td>${tgEsc(a.patient_name || '—')}</td>
          <td style="font-size:12px; color:var(--success)">
            ${a.punya.length ? a.punya.join(', ') : '—'}</td>
          <td style="font-size:12px; color:var(--warning)">${a.kurang.join(', ')}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>` : ''}`;
}

function tgTabMar() {
  const M = tgData.mar || [];
  const P = tgData.jadwal || [];

  if (!M.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">💊</div>
      <div style="font-weight:700; margin-bottom:6px">Belum ada jadwal pemberian obat</div>
      <div style="font-size:13px; color:var(--text3); max-width:540px; margin:0 auto 14px;
                  line-height:1.8">
        Farmasi menyerahkan obat, tapi yang mencatat siapa memberikannya ke
        pasien dan jam berapa adalah layar ini. Tanpa catatan itu, dosis yang
        terlewat dan dosis ganda sama-sama tidak terdeteksi sampai pasien
        bereaksi.
      </div>
      <button class="btn btn-primary" onclick="tgJadwalBaru()">+ Jadwal Obat</button>
    </div>`;
  }

  const tidakDiberikan = P.filter(x => x.hasil !== 'Diberikan');

  return `
    ${tidakDiberikan.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${tidakDiberikan.length} dosis tercatat tidak diberikan.</b>
        Semuanya beralasan — itu ditegakkan saat pencatatan. Dosis terlewat
        tanpa alasan tidak bisa dibedakan dari lupa mencatat.
      </div>` : ''}

    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="tgJadwalBaru()">+ Jadwal Obat</button>
    </div>

    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Pasien</th><th>Obat</th><th>Dosis</th><th>Rute</th>
        <th>Jam</th><th style="text-align:right">Diberikan</th>
        <th style="text-align:right">Tidak</th><th>Terakhir</th>
        <th>Status</th><th></th>
      </tr></thead><tbody>
      ${M.map(j => {
        const jam = Array.isArray(j.jam_pemberian) ? j.jam_pemberian : [];
        return `<tr style="${j.status !== 'Aktif' ? 'opacity:.6' : ''}">
          <td>${tgEsc(j.patient_name || '—')}</td>
          <td><b>${tgEsc(j.nama_obat)}</b></td>
          <td>${tgEsc(j.dosis)}</td>
          <td>${tgEsc(j.rute || '—')}</td>
          <td style="font-size:12px">${jam.length ? jam.map(tgEsc).join(', ')
            : tgEsc(j.frekuensi || '—')}</td>
          <td style="text-align:right">${Number(j.jml_diberikan || 0)}</td>
          <td style="text-align:right; color:${Number(j.jml_tidak_diberikan)
            ? 'var(--warning)' : 'inherit'}">${Number(j.jml_tidak_diberikan || 0)}</td>
          <td style="font-size:12px">${tgJam(j.terakhir_diberikan)}</td>
          <td>${tgEsc(j.status)}</td>
          <td>${j.status === 'Aktif'
            ? `<button class="btn btn-sm btn-primary" onclick="tgCatatObat(${j.jadwal_id})">
                 Catat Pemberian</button>` : ''}</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>`;
}

// ── Tindakan ─────────────────────────────────────────────────────
async function tgTriaseBaru(ulangDari) {
  const asal = ulangDari
    ? (tgData.triase || []).find(x => x.id === ulangDari) : null;

  const pasien = asal ? asal.patient_name : prompt('Nama pasien:');
  if (!pasien) return;
  const keluhan = prompt('Keluhan utama:', asal ? asal.keluhan_utama : '');
  if (!keluhan) return;
  const cara = asal ? asal.cara_datang
    : prompt('Cara datang (Jalan sendiri / Kursi roda / Brankar / Ambulans):', 'Jalan sendiri');
  if (cara === null) return;

  const level = prompt('Level kegawatan:\n\n'
    + '1 Resusitasi — segera, mengancam nyawa\n'
    + '2 Emergensi  — sangat mendesak (≤10 menit)\n'
    + '3 Urgen      — mendesak (≤30 menit)\n'
    + '4 Kurang urgen (≤60 menit)\n'
    + '5 Tidak urgen (≤120 menit)\n\nKetik 1–5:');
  if (!level) return;

  const sistol = prompt('Tekanan darah sistol:', '');
  if (sistol === null) return;
  const diastol = prompt('Diastol:', '');
  if (diastol === null) return;
  const nadi = prompt('Nadi (×/menit):', '');
  if (nadi === null) return;
  const napas = prompt('Napas (×/menit):', '');
  if (napas === null) return;
  const suhu = prompt('Suhu (°C):', '');
  if (suhu === null) return;
  const spo2 = prompt('SpO₂ (%):', '');
  if (spo2 === null) return;
  const kesadaran = prompt('Kesadaran (Sadar / Suara / Nyeri / Tidak respons):', 'Sadar');
  if (kesadaran === null) return;
  const petugas = prompt('Petugas triase:', window.currentUsername || '');
  if (!petugas) return;

  try {
    const r = await sbRpc('triase_catat', {
      p_data: {
        patient_name: pasien, mr_number: asal ? asal.mr_number : null,
        keluhan_utama: keluhan, cara_datang: cara || null,
        level: parseInt(level, 10),
        td_sistol: sistol || null, td_diastol: diastol || null,
        nadi: nadi || null, napas: napas || null, suhu: suhu || null,
        spo2: spo2 || null, kesadaran: kesadaran || 'Sadar',
        petugas_triase: petugas,
        triase_ulang_dari: ulangDari ? String(ulangDari) : null,
      },
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`${r.no_triase} — level ${r.level}, target ${r.target_menit} menit.\n\n`
      + `EWS ${r.ews.skor} (${r.ews.tingkat})\n${r.ews.anjuran}`
      + (r.peringatan ? `\n\n⚠ ${r.peringatan}` : ''));
    await renderTriase();
  } catch (e) { alert('Gagal mencatat triase: ' + e.message); }
}

function tgTriaseUlang(id) { tgTriaseBaru(id); }

async function tgDilihat(id) {
  try {
    await sbPatch('triase', id, {
      dilihat_dokter_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await renderTriase();
  } catch (e) { alert('Gagal mencatat: ' + e.message); }
}

async function tgSkriningBaru() {
  const A = tgData.admisi || [];
  if (!A.length) { alert('Belum ada kunjungan untuk diskrining.'); return; }
  const pilihan = A.slice(0, 20).map((a, i) =>
    `${i + 1}. ${a.visit_number || a.id} — ${a.patient_name || '?'}`).join('\n');
  const n = prompt(`Kunjungan:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const a = A[parseInt(n, 10) - 1];
  if (!a) { alert('Nomor tidak dikenal.'); return; }

  const jenis = prompt('Jenis skrining (jatuh / nyeri / gizi):');
  if (!jenis) return;
  const instrumen = prompt('Alat ukur yang dipakai\n'
    + '(mis. Morse Fall Scale, Numeric Rating Scale, MST):');
  if (!instrumen) return;
  const skor = prompt('Skor:', '');
  if (skor === null) return;
  const kategori = prompt('Kategori risiko (Rendah / Sedang / Tinggi):');
  if (!kategori) return;
  let lanjut = '';
  if (kategori.toLowerCase() === 'tinggi') {
    lanjut = prompt('Tindak lanjut (wajib untuk risiko tinggi):');
    if (!lanjut) return;
  } else {
    lanjut = prompt('Tindak lanjut (opsional):', '');
    if (lanjut === null) return;
  }

  try {
    const r = await sbRpc('skrining_catat', {
      p_data: {
        admission_id: String(a.id), patient_name: a.patient_name,
        mr_number: a.mr_number, jenis, instrumen,
        skor: skor || null, kategori,
        tindak_lanjut: lanjut || null,
        dinilai_oleh: (window.currentUsername || null),
      },
    });
    if (r && r.error) { alert(r.error); return; }
    await renderTriase();
  } catch (e) { alert('Gagal mencatat skrining: ' + e.message); }
}

async function tgJadwalBaru() {
  const A = tgData.admisi || [];
  if (!A.length) { alert('Belum ada kunjungan.'); return; }
  const pilihan = A.slice(0, 20).map((a, i) =>
    `${i + 1}. ${a.visit_number || a.id} — ${a.patient_name || '?'}`).join('\n');
  const n = prompt(`Kunjungan:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const a = A[parseInt(n, 10) - 1];
  if (!a) { alert('Nomor tidak dikenal.'); return; }

  const obat = prompt('Nama obat:');
  if (!obat) return;
  const dosis = prompt('Dosis (mis. 1 g, 500 mg):');
  if (!dosis) return;
  const rute = prompt('Rute (IV / IM / PO / SC):', 'PO');
  if (rute === null) return;
  const frek = prompt('Frekuensi (mis. 3x1):', '');
  if (frek === null) return;
  const jam = prompt('Jam pemberian, pisahkan koma (mis. 06:00,14:00,22:00):', '');
  if (jam === null) return;
  const instruksi = prompt('Instruksi khusus:', '');
  if (instruksi === null) return;

  try {
    await sbPost('mar_jadwal', {
      admission_id: a.id, patient_name: a.patient_name, mr_number: a.mr_number,
      nama_obat: obat.trim(), dosis: dosis.trim(), rute: rute || null,
      frekuensi: frek || null,
      jam_pemberian: jam ? jam.split(',').map(x => x.trim()).filter(Boolean) : [],
      instruksi: instruksi || null,
      diresepkan_oleh: (window.currentUsername || null),
    });
    await renderTriase();
  } catch (e) { alert('Gagal menyimpan jadwal: ' + e.message); }
}

async function tgCatatObat(jadwalId) {
  const j = (tgData.mar || []).find(x => x.jadwal_id === jadwalId);
  if (!j) return;
  const jamTersedia = Array.isArray(j.jam_pemberian) ? j.jam_pemberian : [];

  const tgl = prompt('Tanggal pemberian (YYYY-MM-DD):',
    new Date().toISOString().slice(0, 10));
  if (!tgl) return;
  const jam = prompt(`Jam pemberian${jamTersedia.length
    ? ' (' + jamTersedia.join(', ') + ')' : ''}:`, jamTersedia[0] || '');
  if (!jam) return;

  const hasil = prompt('Hasil:\n\n'
    + 'Diberikan / Ditunda / Ditolak Pasien / Dilewati / Dihentikan', 'Diberikan');
  if (!hasil) return;

  let alasan = null;
  if (hasil !== 'Diberikan') {
    alasan = prompt(`Alasan "${hasil}" (wajib):`);
    if (!alasan) return;
  }
  const oleh = prompt('Diberikan oleh:', window.currentUsername || '');
  if (!oleh) return;

  try {
    const r = await sbRpc('mar_catat', {
      p_jadwal_id: jadwalId, p_tgl: tgl, p_jam: jam,
      p_hasil: hasil, p_oleh: oleh, p_alasan: alasan,
    });
    if (r && r.error) { alert(r.error); return; }
    await renderTriase();
  } catch (e) { alert('Gagal mencatat pemberian: ' + e.message); }
}

window.renderTriase   = renderTriase;
window.tgGantiTab     = tgGantiTab;
window.tgTriaseBaru   = tgTriaseBaru;
window.tgTriaseUlang  = tgTriaseUlang;
window.tgDilihat      = tgDilihat;
window.tgSkriningBaru = tgSkriningBaru;
window.tgJadwalBaru   = tgJadwalBaru;
window.tgCatatObat    = tgCatatObat;
