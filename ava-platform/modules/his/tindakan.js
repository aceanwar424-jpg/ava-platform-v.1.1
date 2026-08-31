// ═══════════════════════════════════════════════════════════════
// MODUL: Tindakan & Prosedur — termasuk USG, endoskopi, fisioterapi
//
// Satu modul, empat menu. Yang membedakan hanya penyaring kategorinya:
//   his-procedures   semua kategori
//   sm-usg           kategori USG
//   sm-endoskopi     kategori Endoskopi
//   sm-fisioterapi   kategori Fisioterapi
//
// Membuat empat modul terpisah berarti empat tempat yang harus diubah
// tiap kali alur persetujuan berubah — dan alur persetujuan adalah
// bagian yang paling tidak boleh berbeda-beda antar layar.
//
// Membaca migrasi 0041.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Tombol "Mulai" tidak muncul untuk tindakan yang persetujuannya belum
// ada. Bukan muncul lalu ditolak server — walaupun servernya memang
// menolak. Petugas yang melihat tombol lalu ditolak akan mencari cara
// melewatinya; petugas yang melihat "persetujuan belum ada" tahu apa
// yang harus dikerjakan.
//
// Penolakan pasien dicatat sebagai keputusan, bukan sebagai kegagalan.
// Ia punya tombolnya sendiri dan alasannya wajib — penolakan yang tidak
// tercatat adalah yang paling merepotkan bila kemudian dipersoalkan.
//
// Prefiks "tn".
// ═══════════════════════════════════════════════════════════════

let tnData = null;
let tnKategori = null;      // null = semua
let tnTab = 'daftar';
let tnPilih = null;

function tnEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function tnRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function tnJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function tnMuat() {
  if (typeof sbGet !== 'function') { tnData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [papan, katalog, seri, admisi] = await Promise.all([
      sbGet('tindakan_papan', 'select=*&order=tgl_rencana.desc&limit=300'),
      sbGet('tindakan_katalog', 'select=*&order=kategori,nama'),
      aman('tindakan_seri', 'select=*&order=id.desc&limit=200'),
      aman('admissions', 'select=id,visit_number,patient_name,mr_number&order=id.desc&limit=200'),
    ]);
    tnData = { papan, katalog, seri, admisi };
  } catch (e) { tnData = null; }
}

// Router memanggil dengan params.kategori untuk menu Support Medical.
async function renderTindakan(params) {
  if (params && params.kategori !== undefined) tnKategori = params.kategori || null;
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await tnMuat();

  if (tnData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Tindakan &amp; Prosedur</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data tindakan tidak dapat dibaca.</strong><br>
        Tabel <code>tindakan</code> belum ada — jalankan ulang aplikasi agar
        migrasi <code>0041_tindakan_informed_consent.sql</code> terpasang.
      </div>`;
    return;
  }
  tnGambar();
}

function tnJudul() {
  if (!tnKategori) return 'Tindakan & Prosedur';
  return {
    'USG': 'USG Non-Radiologi',
    'Endoskopi': 'Endoskopi',
    'Fisioterapi': 'Fisioterapi & Rehabilitasi Medik',
  }[tnKategori] || ('Tindakan — ' + tnKategori);
}

function tnDaftar() {
  const P = tnData.papan || [];
  return tnKategori ? P.filter(x => x.kategori === tnKategori) : P;
}

function tnGambar() {
  const P = tnDaftar();
  const jadwal = P.filter(x => x.status === 'Dijadwalkan');
  const belumConsent = jadwal.filter(x => x.butuh_consent && !x.siap_dikerjakan);
  const berjalan = P.filter(x => x.status === 'Berjalan');
  const komplikasi = P.filter(x => x.komplikasi && x.komplikasi.trim());
  const berseri = tnKategori === 'Fisioterapi' || !tnKategori;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>${tnEsc(tnJudul())}</h1>
        <p class="muted">Penjadwalan, persetujuan tindakan, pelaksanaan, dan hasilnya.</p>
      </div>
      ${(tnData.katalog || []).length
        ? `<div><button class="btn btn-primary" onclick="tnBaru()">+ Tindakan Baru</button></div>`
        : ''}
    </div>

    ${belumConsent.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${belumConsent.length} tindakan terjadwal belum punya persetujuan.</b>
        Tindakan ini tidak bisa dimulai sampai pasien atau walinya menyatakan
        persetujuan setelah diberi penjelasan.
      </div>` : ''}
    ${komplikasi.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${komplikasi.length} tindakan tercatat mengalami komplikasi.</b>
        Angka ini adalah indikator mutu — biarkan terlihat.
      </div>` : ''}

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${tnTab === 'daftar' ? 'active' : ''}"
              onclick="tnGantiTab('daftar')">Daftar Tindakan (${P.length})</button>
      ${berseri ? `<button class="tab ${tnTab === 'seri' ? 'active' : ''}"
              onclick="tnGantiTab('seri')">Program Terapi</button>` : ''}
      <button class="tab ${tnTab === 'katalog' ? 'active' : ''}"
              onclick="tnGantiTab('katalog')">Katalog</button>
    </div>

    ${tnTab === 'daftar' ? tnTabDaftar(P)
    : tnTab === 'seri'   ? tnTabSeri() : tnTabKatalog()}

    ${tnPilih ? tnPanelConsent() : ''}`;
}

function tnGantiTab(t) { tnTab = t; tnPilih = null; tnGambar(); }

function tnTabDaftar(P) {
  if (!P.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🩹</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada tindakan tercatat</div>
      <div style="font-size:13px; color:var(--text3)">
        ${(tnData.katalog || []).length
          ? 'Jadwalkan tindakan lewat tombol Tindakan Baru.'
          : 'Isi katalog tindakan lebih dulu di tab Katalog.'}</div>
    </div>`;
  }

  const warna = {
    'Dijadwalkan': 'var(--info)', 'Berjalan': 'var(--warning)',
    'Selesai': 'var(--success)', 'Batal': 'var(--text3)',
  };

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>No.</th><th>Pasien</th><th>Tindakan</th><th>Kategori</th>
      <th>Jadwal</th><th>Operator</th><th>Persetujuan</th>
      <th>Status</th><th></th>
    </tr></thead><tbody>
    ${P.map(t => `<tr style="${t.komplikasi ? 'background:rgba(255,180,0,.05)' : ''}">
      <td><b>${tnEsc(t.no_tindakan)}</b>
        ${t.no_seri ? `<div style="font-size:11px; color:var(--text3)">
          ${tnEsc(t.no_seri)} · sesi ${t.sesi_ke}/${t.sesi_rencana || '?'}</div>` : ''}</td>
      <td>${tnEsc(t.patient_name || '—')}
        ${t.mr_number ? `<div style="font-size:11px; color:var(--text3)">
          ${tnEsc(t.mr_number)}</div>` : ''}</td>
      <td>${tnEsc(t.nama_tindakan || '—')}</td>
      <td style="font-size:12px">${tnEsc(t.kategori || '—')}</td>
      <td style="white-space:nowrap">${tnJam(t.tgl_rencana)}</td>
      <td style="font-size:12px">${tnEsc(t.operator || '—')}</td>
      <td style="font-size:12px">${
        !t.butuh_consent
          ? '<span style="color:var(--text3)">tidak diperlukan</span>'
          : t.consent_keputusan === 'Setuju'
            ? `<span style="color:var(--success)">✓ setuju</span>
               <div style="font-size:11px; color:var(--text3)">
                 ${tnEsc(t.consent_penerima || '')}</div>`
            : t.consent_keputusan === 'Menolak'
              ? '<span style="color:var(--danger); font-weight:700">menolak</span>'
              : '<span style="color:var(--danger); font-weight:700">belum ada</span>'}</td>
      <td><span style="font-weight:600; color:${warna[t.status] || 'var(--text3)'}">
        ${tnEsc(t.status)}</span>
        ${t.komplikasi ? `<div style="font-size:11px; color:var(--warning)">
          komplikasi</div>` : ''}</td>
      <td style="white-space:nowrap">
        ${t.status === 'Dijadwalkan' && t.butuh_consent && !t.siap_dikerjakan
          ? `<button class="btn btn-sm btn-primary" onclick="tnConsent(${t.id})">
               Catat Persetujuan</button>` : ''}
        ${t.status === 'Dijadwalkan' && t.siap_dikerjakan
          ? `<button class="btn btn-sm btn-primary" onclick="tnMulai(${t.id})">
               Mulai</button>` : ''}
        ${t.status === 'Berjalan'
          ? `<button class="btn btn-sm btn-primary" onclick="tnSelesai(${t.id})">
               Selesaikan</button>` : ''}
        ${t.status === 'Selesai'
          ? `<button class="btn btn-sm" onclick="tnLihat(${t.id})">Hasil</button>` : ''}
      </td>
    </tr>`).join('')}
    </tbody></table>
  </div>`;
}

function tnTabSeri() {
  const S = (tnData.seri || []).filter(s =>
    !tnKategori || (tnData.katalog.find(k => k.id === s.katalog_id) || {}).kategori === tnKategori);

  if (!S.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📈</div>
      <div style="font-weight:700; margin-bottom:4px">Belum ada program terapi</div>
      <div style="font-size:13px; color:var(--text3); max-width:480px; margin:0 auto">
        Fisioterapi berjalan sebagai program: sekian sesi yang direncanakan,
        dievaluasi di tengah, dan bisa dihentikan lebih awal.</div>
    </div>`;
  }

  const namaK = id => (tnData.katalog.find(k => k.id === id) || {}).nama || '—';

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>No. Seri</th><th>Pasien</th><th>Program</th>
      <th style="text-align:right">Sesi</th><th>Mulai</th>
      <th>Tujuan Terapi</th><th>Status</th>
    </tr></thead><tbody>
    ${S.map(s => {
      const sudah = (tnData.papan || []).filter(t =>
        t.seri_id === s.id && t.status === 'Selesai').length;
      return `<tr>
        <td><b>${tnEsc(s.no_seri || '—')}</b></td>
        <td>${tnEsc(s.patient_name || '—')}</td>
        <td>${tnEsc(namaK(s.katalog_id))}</td>
        <td style="text-align:right">${sudah}/${s.sesi_rencana || '?'}</td>
        <td>${s.tgl_mulai ? new Date(s.tgl_mulai).toLocaleDateString('id-ID') : '—'}</td>
        <td style="font-size:12px; max-width:240px">${tnEsc(s.tujuan_terapi || '—')}</td>
        <td>${tnEsc(s.status)}
          ${s.alasan_henti ? `<div style="font-size:11px; color:var(--text3)">
            ${tnEsc(s.alasan_henti)}</div>` : ''}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
  </div>`;
}

function tnTabKatalog() {
  const K = (tnData.katalog || []).filter(k => !tnKategori || k.kategori === tnKategori);

  if (!K.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">📋</div>
      <div style="font-weight:700; margin-bottom:6px">Katalog tindakan masih kosong</div>
      <div style="font-size:13px; color:var(--text3); max-width:520px; margin:0 auto 14px;
                  line-height:1.8">
        Tiap jenis tindakan perlu disebutkan risiko dan alternatifnya —
        keduanya yang disalin ke lembar persetujuan. Lembar persetujuan
        tanpa penjelasan risiko bukan persetujuan yang diinformasikan.
      </div>
      <button class="btn btn-primary" onclick="tnKatalogBaru()">+ Tambah Jenis Tindakan</button>
    </div>`;
  }

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-sm btn-primary" onclick="tnKatalogBaru()">+ Jenis Tindakan</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr>
        <th>Kode</th><th>Nama</th><th>Kategori</th><th>ICD-9-CM</th>
        <th style="text-align:right">Durasi</th>
        <th style="text-align:right">Tarif</th>
        <th>Persetujuan</th><th>Risiko Tercantum</th><th>Berseri</th>
      </tr></thead><tbody>
      ${K.map(k => `<tr>
        <td><b>${tnEsc(k.kode)}</b></td>
        <td>${tnEsc(k.nama)}</td>
        <td>${tnEsc(k.kategori)}</td>
        <td style="font-size:12px">${tnEsc(k.icd9_cm || '—')}</td>
        <td style="text-align:right">${k.durasi_menit ? k.durasi_menit + ' mnt' : '—'}</td>
        <td style="text-align:right">${tnRp(k.tarif)}</td>
        <td>${k.butuh_consent
          ? '<span style="font-weight:600">wajib</span>'
          : '<span style="color:var(--text3)">tidak</span>'}</td>
        <td>${k.butuh_consent
          ? (k.risiko && k.risiko.trim()
              ? '<span style="color:var(--success)">✓ ada</span>'
              : '<span style="color:var(--danger); font-weight:700">belum diisi</span>')
          : '—'}</td>
        <td>${k.berseri ? `ya (${k.sesi_standar || '?'} sesi)` : 'tidak'}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;
}

function tnPanelConsent() {
  const t = (tnData.papan || []).find(x => x.id === tnPilih);
  if (!t) return '';
  const k = (tnData.katalog || []).find(x => x.id === t.katalog_id) || {};

  return `
    <div class="card" style="padding:18px; margin-top:16px;
                             border-left:3px solid var(--primary)">
      <div style="font-weight:800; font-size:15px; margin-bottom:2px">
        Persetujuan Tindakan — ${tnEsc(t.no_tindakan)}</div>
      <div style="font-size:12px; color:var(--text3); margin-bottom:14px">
        ${tnEsc(t.patient_name || '')} · ${tnEsc(t.nama_tindakan || '')}</div>

      <div style="background:var(--bg2); border-radius:8px; padding:14px;
                  font-size:13px; line-height:1.8; margin-bottom:14px">
        <b>Yang harus dijelaskan sebelum meminta persetujuan</b><br>
        <b>Risiko:</b> ${k.risiko && k.risiko.trim()
          ? tnEsc(k.risiko)
          : '<span style="color:var(--danger)">belum tercantum di katalog — '
            + 'lengkapi dulu sebelum meminta tanda tangan</span>'}<br>
        <b>Alternatif:</b> ${tnEsc(k.alternatif || '—')}
      </div>

      <div style="display:grid; gap:8px; max-width:520px">
        <label>Dijelaskan oleh (dokter) *
          <input id="tn-c-dokter" style="width:100%"
                 value="${tnEsc(window.currentUsername || '')}"></label>
        <label>Penerima penjelasan *
          <input id="tn-c-penerima" style="width:100%"
                 value="${tnEsc(t.patient_name || '')}"></label>
        <label>Hubungan dengan pasien
          <select id="tn-c-hubungan" style="width:100%">
            <option>Pasien</option><option>Suami</option><option>Istri</option>
            <option>Anak</option><option>Orang Tua</option><option>Wali</option>
          </select></label>
        <label>Nomor identitas penerima
          <input id="tn-c-identitas" style="width:100%"></label>
        <label>Saksi petugas
          <input id="tn-c-saksi" style="width:100%"></label>
      </div>

      <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap">
        <button class="btn btn-primary" onclick="tnSimpanConsent('setuju')">
          Pasien Menyetujui</button>
        <button class="btn" onclick="tnSimpanConsent('menolak')">
          Pasien Menolak</button>
        <button class="btn" onclick="tnTutupConsent()">Tutup</button>
      </div>
      <div style="margin-top:10px; font-size:12px; color:var(--text3); line-height:1.7">
        Penolakan juga dicatat — bukan sekadar tidak melanjutkan. Penolakan
        yang tidak tercatat adalah yang paling merepotkan bila kemudian
        dipersoalkan.
      </div>
    </div>`;
}

function tnConsent(id) { tnPilih = id; tnGambar();
  document.getElementById('tn-c-dokter')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function tnTutupConsent() { tnPilih = null; tnGambar(); }

async function tnSimpanConsent(keputusan) {
  const dokter = (document.getElementById('tn-c-dokter').value || '').trim();
  const penerima = (document.getElementById('tn-c-penerima').value || '').trim();
  if (!dokter) { alert('Nama dokter yang memberi penjelasan wajib diisi.'); return; }
  if (!penerima) { alert('Nama penerima penjelasan wajib diisi.'); return; }

  let alasan = null;
  if (keputusan === 'menolak') {
    alasan = prompt('Alasan penolakan (wajib):');
    if (!alasan) return;
  } else {
    if (!confirm(`Konfirmasi: ${penerima} menyatakan SETUJU setelah `
      + `mendapat penjelasan dari ${dokter}?`)) return;
  }

  try {
    const r = await sbRpc('tindakan_catat_consent', {
      p_data: {
        tindakan_id: String(tnPilih), keputusan,
        dijelaskan_oleh: dokter, penerima_nama: penerima,
        penerima_hubungan: document.getElementById('tn-c-hubungan').value,
        penerima_identitas: (document.getElementById('tn-c-identitas').value || '').trim(),
        saksi_petugas: (document.getElementById('tn-c-saksi').value || '').trim(),
        alasan_menolak: alasan,
      },
    });
    if (r && r.error) { alert(r.error); return; }
    tnPilih = null;
    alert(r.tindakan_dibatalkan
      ? 'Penolakan tercatat. Tindakan dibatalkan.'
      : 'Persetujuan tercatat. Tindakan sudah bisa dimulai.');
    await renderTindakan();
  } catch (e) { alert('Gagal menyimpan persetujuan: ' + e.message); }
}

async function tnMulai(id) {
  const operator = prompt('Operator/pelaksana tindakan:', window.currentUsername || '');
  if (!operator) return;
  const asisten = prompt('Asisten (opsional):', '');
  if (asisten === null) return;
  const ruangan = prompt('Ruangan:', '');
  if (ruangan === null) return;

  try {
    const r = await sbRpc('tindakan_mulai', {
      p_tindakan_id: id, p_operator: operator,
      p_asisten: asisten || null, p_ruangan: ruangan || null,
    });
    if (r && r.error) { alert(r.error); return; }
    await renderTindakan();
  } catch (e) { alert('Gagal memulai tindakan: ' + e.message); }
}

async function tnSelesai(id) {
  const dilakukan = prompt('Uraian tindakan yang dikerjakan (wajib):');
  if (!dilakukan) return;
  const temuan = prompt('Temuan:', '');
  if (temuan === null) return;
  const komplikasi = prompt('Komplikasi (kosongkan bila tidak ada):', '');
  if (komplikasi === null) return;
  const anjuran = prompt('Anjuran pasca tindakan:', '');
  if (anjuran === null) return;

  try {
    const r = await sbRpc('tindakan_selesai', {
      p_tindakan_id: id, p_temuan: temuan || null,
      p_dilakukan: dilakukan, p_komplikasi: komplikasi || null,
      p_anjuran: anjuran || null,
    });
    if (r && r.error) { alert(r.error); return; }
    alert(r.sesi_rencana
      ? `Sesi ${r.sesi_selesai} dari ${r.sesi_rencana} selesai.`
      : `Tindakan ${r.no_tindakan} selesai.`);
    await renderTindakan();
  } catch (e) { alert('Gagal menyelesaikan tindakan: ' + e.message); }
}

function tnLihat(id) {
  const t = (tnData.papan || []).find(x => x.id === id);
  if (!t) return;
  const html = `
    <div class="modal-overlay" id="tn-modal" onclick="if(event.target===this)tnTutup()">
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <h3>${tnEsc(t.no_tindakan)} — ${tnEsc(t.nama_tindakan || '')}</h3>
          <button class="modal-close" onclick="tnTutup()">&times;</button>
        </div>
        <div class="modal-body" style="font-size:13px; line-height:1.9">
          <b>${tnEsc(t.patient_name || '—')}</b>
          ${t.mr_number ? ' · ' + tnEsc(t.mr_number) : ''}<br>
          Operator: ${tnEsc(t.operator || '—')}
          ${t.asisten ? ' · asisten ' + tnEsc(t.asisten) : ''}<br>
          Mulai ${tnJam(t.mulai_at)} · selesai ${tnJam(t.selesai_at)}<br><br>

          ${t.butuh_consent ? `
            <div style="background:var(--bg2); padding:10px 12px; border-radius:8px;
                        margin-bottom:12px; font-size:12px">
              <b>Persetujuan</b> — ${tnEsc(t.consent_keputusan || 'belum ada')}
              ${t.consent_oleh ? `<br>dijelaskan oleh ${tnEsc(t.consent_oleh)}` : ''}
              ${t.consent_penerima ? `<br>diterima ${tnEsc(t.consent_penerima)}` : ''}
              ${t.consent_at ? `<br>${tnJam(t.consent_at)}` : ''}
            </div>` : ''}

          <b>Tindakan yang dikerjakan</b><br>${tnEsc(t.tindakan_dilakukan || '—')}<br><br>
          <b>Temuan</b><br>${tnEsc(t.temuan || '—')}<br><br>
          ${t.komplikasi ? `<b style="color:var(--warning)">Komplikasi</b><br>
            ${tnEsc(t.komplikasi)}<br><br>` : ''}
          <b>Anjuran</b><br>${tnEsc(t.anjuran || '—')}
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function tnTutup() {
  const m = document.getElementById('tn-modal');
  if (m) m.remove();
}

async function tnBaru() {
  const K = (tnData.katalog || []).filter(k =>
    k.status === 'Aktif' && (!tnKategori || k.kategori === tnKategori));
  if (!K.length) { alert('Katalog tindakan untuk kategori ini masih kosong.'); return; }

  const pilihan = K.map((k, i) => `${i + 1}. ${k.nama}`).join('\n');
  const n = prompt(`Jenis tindakan:\n\n${pilihan}\n\nNomor:`);
  if (!n) return;
  const k = K[parseInt(n, 10) - 1];
  if (!k) { alert('Nomor tidak dikenal.'); return; }

  const pasien = prompt('Nama pasien:');
  if (!pasien) return;
  const mr = prompt('No. rekam medis:', '');
  if (mr === null) return;
  const tgl = prompt('Waktu rencana (YYYY-MM-DD HH:MM, kosongkan = sekarang):', '');
  if (tgl === null) return;
  const operator = prompt('Operator (bisa diisi nanti):', '');
  if (operator === null) return;

  try {
    const r = await sbRpc('tindakan_buat', {
      p_data: {
        katalog_id: String(k.id), patient_name: pasien,
        mr_number: mr || null, tgl_rencana: tgl || null,
        operator: operator || null,
      },
    });
    if (r && r.error) { alert(r.error); return; }
    alert(`Tindakan ${r.no_tindakan} dijadwalkan.`
      + (r.butuh_consent ? '\n\nTindakan ini menuntut persetujuan sebelum dimulai.' : '')
      + (r.catatan ? `\n\n${r.catatan}` : ''));
    await renderTindakan();
  } catch (e) { alert('Gagal membuat tindakan: ' + e.message); }
}

async function tnKatalogBaru() {
  const kode = prompt('Kode tindakan:');
  if (!kode) return;
  const nama = prompt('Nama tindakan:');
  if (!nama) return;
  const kategori = prompt('Kategori (Bedah Minor / USG / Endoskopi / Fisioterapi / '
    + 'Perawatan Luka / Lain):', tnKategori || 'Bedah Minor');
  if (!kategori) return;
  const consent = confirm('Tindakan ini menuntut persetujuan tertulis?\n\n'
    + 'OK = wajib persetujuan, Batal = tidak wajib');
  let risiko = '', alternatif = '';
  if (consent) {
    risiko = prompt('Risiko yang harus dijelaskan ke pasien (wajib bila '
      + 'menuntut persetujuan):', '');
    if (risiko === null) return;
    alternatif = prompt('Alternatif tindakan:', '');
    if (alternatif === null) return;
  }
  const tarif = prompt('Tarif (Rp):', '0');
  if (tarif === null) return;

  try {
    await sbPost('tindakan_katalog', {
      kode: kode.trim().toUpperCase(), nama: nama.trim(), kategori: kategori.trim(),
      butuh_consent: consent, risiko: risiko || null, alternatif: alternatif || null,
      tarif: parseFloat(tarif) || 0,
    });
    await renderTindakan();
  } catch (e) { alert('Gagal menyimpan katalog: ' + e.message); }
}

window.renderTindakan   = renderTindakan;
window.tnGantiTab       = tnGantiTab;
window.tnConsent        = tnConsent;
window.tnTutupConsent   = tnTutupConsent;
window.tnSimpanConsent  = tnSimpanConsent;
window.tnMulai          = tnMulai;
window.tnSelesai        = tnSelesai;
window.tnLihat          = tnLihat;
window.tnTutup          = tnTutup;
window.tnBaru           = tnBaru;
window.tnKatalogBaru    = tnKatalogBaru;
