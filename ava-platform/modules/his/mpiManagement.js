// ═══════════════════════════════════════════════════════════════
// MODUL: MPI — Master Patient Index
//
// Versi sebelumnya tidak punya panggilan data. Sekarang membaca
// public.mpi_person, person_identifier, person_contact, dan
// person_merge_log yang sudah ada di basis data.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Penggabungan identitas TIDAK dijalankan dari layar ini. Menggabungkan
// dua orang yang ternyata berbeda memindahkan riwayat medis satu pasien
// ke pasien lain — kesalahan yang sangat mahal dibalik dan bisa
// membahayakan. Layar ini menyodorkan kandidat duplikat beserta alasan
// kecocokannya, lalu penggabungan dikerjakan lewat prosedur basis data
// yang meninggalkan jejak di person_merge_log.
//
// Kandidat duplikat dicari dari kecocokan yang bisa dipertanggung-
// jawabkan: NIK sama, atau nama + tanggal lahir sama. Kemiripan nama
// saja TIDAK dipakai — nama Indonesia banyak yang identik, dan
// menyodorkannya sebagai duplikat mengundang penggabungan yang salah.
//
// Prefiks "mp".
// ═══════════════════════════════════════════════════════════════

let mpData = null;
let mpTab = 'cari';
let mpCari = '';

function mpEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function mpTgl(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID',
    { day: '2-digit', month: 'short', year: 'numeric' });
}

async function mpMuat() {
  if (typeof sbGet !== 'function') { mpData = null; return; }
  try {
    const [orang, identitas, kontak, gabung] = await Promise.all([
      sbGet('mpi_person', 'select=*&is_deleted=is.false&order=full_name&limit=500'),
      sbGet('person_identifier', 'select=*').catch(() => []),
      sbGet('person_contact', 'select=*').catch(() => []),
      sbGet('person_merge_log', 'select=*&order=id.desc&limit=100').catch(() => []),
    ]);
    mpData = { orang, identitas, kontak, gabung };
  } catch (e) { mpData = null; }
}

async function renderMpiManagement() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await mpMuat();

  if (mpData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Master Patient Index</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data MPI tidak dapat dibaca.</strong><br>
        Tabel <code>mpi_person</code> belum tersedia.
      </div>`;
    return;
  }
  mpGambar();
}

function mpNik(personId) {
  const i = (mpData.identitas || []).find(x =>
    x.person_id === personId && /nik|ktp/i.test(x.type || ''));
  return i ? i.value : null;
}
function mpHp(personId) {
  const c = (mpData.kontak || []).find(x =>
    x.person_id === personId && /phone|hp|telepon/i.test(x.type || ''));
  return c ? c.value : null;
}

// Kandidat duplikat: hanya kecocokan yang bisa dipertanggungjawabkan.
function mpDuplikat() {
  const O = mpData.orang || [];
  const kel = new Map();

  for (const p of O) {
    const nik = mpNik(p.id);
    const kunci = nik
      ? 'nik:' + nik
      : (p.full_name && p.birth_date)
        ? 'nama-lahir:' + String(p.full_name).trim().toLowerCase() + '|' + p.birth_date
        : null;
    if (!kunci) continue;
    if (!kel.has(kunci)) kel.set(kunci, []);
    kel.get(kunci).push(p);
  }

  return [...kel.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([k, v]) => ({
      alasan: k.startsWith('nik:') ? 'NIK sama' : 'nama & tanggal lahir sama',
      nilai: k.split(':').slice(1).join(':'),
      orang: v,
    }));
}

function mpGambar() {
  const dup = mpDuplikat();

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Master Patient Index</h1>
        <p class="muted">Identitas tunggal pasien lintas unit dan lintas kunjungan.</p>
      </div>
    </div>

    ${dup.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--warning)">
        <b>${dup.length} kemungkinan identitas ganda ditemukan.</b>
        Identitas ganda membuat riwayat satu pasien terbelah — dan yang
        dilihat dokter hanya separuhnya.
      </div>` : ''}

    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${mpTab === 'cari' ? 'active' : ''}"
              onclick="mpGantiTab('cari')">Cari Pasien (${(mpData.orang || []).length})</button>
      <button class="tab ${mpTab === 'duplikat' ? 'active' : ''}"
              onclick="mpGantiTab('duplikat')">Kemungkinan Ganda (${dup.length})</button>
      <button class="tab ${mpTab === 'riwayat' ? 'active' : ''}"
              onclick="mpGantiTab('riwayat')">Riwayat Penggabungan</button>
    </div>

    ${mpTab === 'cari' ? mpTabCari()
    : mpTab === 'duplikat' ? mpTabDuplikat(dup) : mpTabRiwayat()}`;
}

function mpGantiTab(t) { mpTab = t; mpGambar(); }

function mpTabCari() {
  const O = mpData.orang || [];
  const q = mpCari.trim().toLowerCase();
  const hasil = q
    ? O.filter(p =>
        String(p.full_name || '').toLowerCase().includes(q)
        || String(p.ava_id || '').toLowerCase().includes(q)
        || String(mpNik(p.id) || '').includes(q))
    : O.slice(0, 50);

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px">
      <input id="mp-cari" placeholder="Cari nama, AVA ID, atau NIK…"
             value="${mpEsc(mpCari)}" oninput="mpSetCari(this.value)"
             style="width:100%; padding:8px 12px; border:1px solid var(--border);
                    border-radius:6px">
      <div style="font-size:11px; color:var(--text3); margin-top:6px">
        ${q ? `${hasil.length} hasil` : `menampilkan ${hasil.length} dari ${O.length} pasien`}
      </div>
    </div>

    ${!hasil.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">👤</div>
        <div style="font-weight:700">${q ? 'Tidak ada yang cocok'
                                          : 'Belum ada pasien terdaftar di MPI'}</div>
      </div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>AVA ID</th><th>Nama</th><th>Lahir</th><th>Jenis Kelamin</th>
          <th>NIK</th><th>Kontak</th><th>Gol. Darah</th><th>Status</th>
        </tr></thead><tbody>
        ${hasil.map(p => `<tr>
          <td><b>${mpEsc(p.ava_id || '—')}</b></td>
          <td>${mpEsc(p.full_name)}</td>
          <td>${mpTgl(p.birth_date)}
            ${p.birth_place ? `<div style="font-size:11px; color:var(--text3)">
              ${mpEsc(p.birth_place)}</div>` : ''}</td>
          <td>${mpEsc(p.sex || '—')}</td>
          <td>${mpEsc(mpNik(p.id) || '—')}</td>
          <td>${mpEsc(mpHp(p.id) || '—')}</td>
          <td>${mpEsc(p.blood_type || '—')}</td>
          <td>${mpEsc(p.status || '—')}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}`;
}

function mpSetCari(v) {
  mpCari = v;
  // Gambar ulang hanya bagian daftarnya supaya kursor tidak melompat.
  const el = document.getElementById('mp-cari');
  const pos = el && el.selectionStart;
  mpGambar();
  const baru = document.getElementById('mp-cari');
  if (baru) { baru.focus(); if (pos != null) baru.setSelectionRange(pos, pos); }
}

function mpTabDuplikat(dup) {
  if (!dup.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">✓</div>
      <div style="font-weight:700">Tidak ada kemungkinan identitas ganda</div>
      <div style="font-size:13px; color:var(--text3); margin-top:6px">
        Diperiksa dari NIK yang sama, atau nama dan tanggal lahir yang sama.</div>
    </div>`;
  }

  return `
    <div class="card" style="padding:12px 16px; margin-bottom:12px; font-size:13px;
                             color:var(--text3); line-height:1.7">
      Kandidat dicari dari kecocokan yang bisa dipertanggungjawabkan: NIK
      sama, atau nama <b>dan</b> tanggal lahir sama. Kemiripan nama saja
      tidak dipakai — banyak nama Indonesia yang identik, dan
      menyodorkannya sebagai duplikat justru mengundang penggabungan yang
      salah.
    </div>
    <div style="display:flex; flex-direction:column; gap:12px">
      ${dup.map(g => `
        <div class="card" style="padding:16px">
          <div style="font-size:12px; color:var(--text3); margin-bottom:8px">
            Cocok karena <b>${mpEsc(g.alasan)}</b>: ${mpEsc(g.nilai)}</div>
          <table class="data-table"><thead><tr>
            <th>AVA ID</th><th>Nama</th><th>Lahir</th><th>NIK</th>
            <th>Kontak</th><th>Dibuat</th>
          </tr></thead><tbody>
          ${g.orang.map(p => `<tr>
            <td><b>${mpEsc(p.ava_id || '—')}</b></td>
            <td>${mpEsc(p.full_name)}</td>
            <td>${mpTgl(p.birth_date)}</td>
            <td>${mpEsc(mpNik(p.id) || '—')}</td>
            <td>${mpEsc(mpHp(p.id) || '—')}</td>
            <td>${mpTgl(p.created_at)}</td>
          </tr>`).join('')}
          </tbody></table>
          <div style="margin-top:10px; font-size:12px; color:var(--text3); line-height:1.7">
            Penggabungan tidak dijalankan dari layar ini. Menggabungkan dua
            orang yang ternyata berbeda memindahkan riwayat medis satu
            pasien ke pasien lain — sangat mahal dibalik dan bisa
            membahayakan. Serahkan ke petugas rekam medis untuk diverifikasi
            dengan dokumen identitas.
          </div>
        </div>`).join('')}
    </div>`;
}

function mpTabRiwayat() {
  const G = mpData.gabung || [];
  if (!G.length) {
    return `<div class="card" style="padding:32px; text-align:center">
      <div style="font-size:28px; opacity:.4; margin-bottom:8px">🔗</div>
      <div style="font-weight:700">Belum ada penggabungan identitas tercatat</div>
    </div>`;
  }

  return `<div class="card" style="overflow-x:auto">
    <table class="data-table"><thead><tr>
      <th>Waktu</th><th>Digabung Dari</th><th>Menjadi</th><th>Oleh</th><th>Alasan</th>
    </tr></thead><tbody>
    ${G.map(g => `<tr>
      <td style="white-space:nowrap">${mpTgl(g.created_at || g.merged_at)}</td>
      <td>${mpEsc(g.source_person_id || g.from_person_id || '—')}</td>
      <td>${mpEsc(g.target_person_id || g.to_person_id || '—')}</td>
      <td>${mpEsc(g.merged_by || g.created_by || '—')}</td>
      <td style="font-size:12px">${mpEsc(g.reason || g.alasan || '—')}</td>
    </tr>`).join('')}
    </tbody></table>
  </div>`;
}

window.renderMpiManagement = renderMpiManagement;
window.mpGantiTab = mpGantiTab;
window.mpSetCari  = mpSetCari;
