// ═══════════════════════════════════════════════════════════════
// MODUL: EMR SOAP & CPPT
//
// Versi sebelumnya tidak punya panggilan data: antrean poli, tanda
// vital, dan catatan SOAP ditulis tangan. Untuk lembar konsultasi,
// itu menampilkan pemeriksaan atas pasien yang tidak ada — dan angka
// tekanan darah karangan di layar dokter adalah hal yang paling tidak
// boleh terjadi di sistem ini.
//
// Sekarang membaca public.admissions, public.anamnesas,
// public.vital_signs, dan public.icd_diagnostics — semuanya sudah ada
// di basis data dan tidak pernah dibaca dari sini.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Tanda vital dibaca dari vital_signs bila ada, dan baru jatuh ke
// anamnesas bila belum. Keduanya menyimpan tekanan darah dengan nama
// kolom berbeda (bp_systolic vs systole) — warisan dua alur pencatatan
// yang tumbuh terpisah. Yang tidak boleh terjadi adalah menampilkan
// salah satunya sebagai satu-satunya kebenaran lalu menyembunyikan
// bahwa yang lain berbeda.
//
// Catatan yang sudah disimpan TIDAK dihapus dari layar ini. Rekam medis
// adalah dokumen hukum; koreksi dilakukan dengan catatan tambahan yang
// menyebut apa yang dikoreksi, bukan dengan menghapus baris.
//
// Prefiks "es".
// ═══════════════════════════════════════════════════════════════

let esData = null;
let esPilih = null;

function esEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function esJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function esMuat() {
  if (typeof sbGet !== 'function') { esData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [admisi, anamnesa, vital, diagnosa] = await Promise.all([
      sbGet('admissions', 'select=*&order=id.desc&limit=200'),
      aman('anamnesas', 'select=*&order=id.desc&limit=300'),
      aman('vital_signs', 'select=*&order=recorded_at.desc&limit=300'),
      aman('icd_diagnostics', 'select=*&order=id.desc&limit=300'),
    ]);
    esData = { admisi, anamnesa, vital, diagnosa };
  } catch (e) { esData = null; }
}

async function renderEmrSoap() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await esMuat();

  if (esData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>EMR SOAP &amp; CPPT</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data rekam medis tidak dapat dibaca.</strong><br>
        Tabel <code>admissions</code> belum tersedia.
      </div>`;
    return;
  }
  esGambar();
}

function esAnamnesaOf(admissionId) {
  return (esData.anamnesa || []).filter(a => a.admission_id === admissionId);
}
function esVitalOf(admissionId) {
  return (esData.vital || []).filter(v => v.admission_id === admissionId);
}
function esDiagOf(admissionId) {
  return (esData.diagnosa || []).filter(d => d.admission_id === admissionId);
}

// Dua tabel menyimpan tanda vital dengan nama kolom berbeda. Yang lebih
// baru (vital_signs) dipakai lebih dulu; anamnesas jadi cadangan.
function esVitalTerbaru(admissionId) {
  const v = esVitalOf(admissionId)[0];
  if (v) {
    return {
      sumber: 'vital_signs',
      sistol: v.bp_systolic, diastol: v.bp_diastolic,
      nadi: v.pulse, napas: v.resp_rate, suhu: v.temperature,
      spo2: v.spo, berat: v.weight, tinggi: v.height, bmi: v.bmi,
      waktu: v.recorded_at, oleh: v.recorded_by || v.noted_by,
    };
  }
  const a = esAnamnesaOf(admissionId)[0];
  if (a) {
    return {
      sumber: 'anamnesas',
      sistol: a.systole, diastol: a.diastolic ?? a.diastole,
      nadi: a.heart_rate, napas: a.respiratory, suhu: a.temperature,
      spo2: null, berat: a.weight, tinggi: a.height, bmi: a.bmi,
      waktu: null, oleh: null,
    };
  }
  return null;
}

function esGambar() {
  const A = esData.admisi || [];

  // Kunjungan yang sudah punya catatan SOAP dianggap sudah dilayani.
  const belum = A.filter(a => !esAnamnesaOf(a.id).length && !esDiagOf(a.id).length);
  const sudah = A.filter(a => esAnamnesaOf(a.id).length || esDiagOf(a.id).length);

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>EMR SOAP &amp; CPPT</h1>
        <p class="muted">Lembar konsultasi: subjektif, objektif, asesmen, dan rencana.</p>
      </div>
    </div>

    ${!A.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🗒️</div>
        <div style="font-weight:700; margin-bottom:4px">Belum ada kunjungan tercatat</div>
        <div style="font-size:13px; color:var(--text3)">
          Kunjungan yang terdaftar di Pendaftaran &amp; Admisi akan muncul di sini.</div>
      </div>` : `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
                  gap:12px; margin-bottom:16px">
        <div class="card" style="padding:14px">
          <div style="font-size:12px; color:var(--text3)">Belum ada catatan</div>
          <div style="font-size:22px; font-weight:800;
                      color:${belum.length ? 'var(--warning)' : 'var(--text3)'}">
            ${belum.length}</div>
        </div>
        <div class="card" style="padding:14px">
          <div style="font-size:12px; color:var(--text3)">Sudah ada catatan</div>
          <div style="font-size:22px; font-weight:800">${sudah.length}</div>
        </div>
      </div>

      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>No. Kunjungan</th><th>Pasien</th><th>Tanda Vital Terakhir</th>
          <th style="text-align:right">Diagnosa</th>
          <th style="text-align:right">Catatan</th><th></th>
        </tr></thead><tbody>
        ${A.map(a => {
          const v = esVitalTerbaru(a.id);
          const d = esDiagOf(a.id);
          const c = esAnamnesaOf(a.id);
          return `<tr style="${esPilih === a.id ? 'outline:2px solid var(--primary)' : ''}">
            <td><b>${esEsc(a.visit_number || a.id)}</b></td>
            <td>${esEsc(a.patient_name || '—')}</td>
            <td style="font-size:12px">${v
              ? `${v.sistol ?? '—'}/${v.diastol ?? '—'} mmHg
                 · N ${v.nadi ?? '—'} · S ${v.suhu ?? '—'}°C
                 <div style="font-size:10px; color:var(--text3)">
                   dari ${esEsc(v.sumber)}${v.waktu ? ' · ' + esJam(v.waktu) : ''}</div>`
              : '<span style="color:var(--text3)">belum diukur</span>'}</td>
            <td style="text-align:right">${d.length}</td>
            <td style="text-align:right">${c.length}</td>
            <td><button class="btn btn-sm" onclick="esBuka(${a.id})">
              ${esPilih === a.id ? 'Tutup' : 'Lembar SOAP'}</button></td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>

      ${esPilih ? esLembar() : ''}`}`;
}

function esBuka(id) {
  esPilih = (esPilih === id) ? null : id;
  esGambar();
}

function esLembar() {
  const a = (esData.admisi || []).find(x => x.id === esPilih);
  if (!a) return '';
  const c = esAnamnesaOf(esPilih);
  const d = esDiagOf(esPilih);
  const v = esVitalTerbaru(esPilih);
  const semuaVital = esVitalOf(esPilih);

  return `
    <div class="card" style="padding:18px; margin-top:16px">
      <div style="display:flex; justify-content:space-between; align-items:center;
                  flex-wrap:wrap; gap:8px; margin-bottom:12px">
        <div>
          <div style="font-weight:800; font-size:15px">${esEsc(a.patient_name || '—')}</div>
          <div style="font-size:12px; color:var(--text3)">
            Kunjungan ${esEsc(a.visit_number || a.id)}</div>
        </div>
        <button class="btn btn-sm btn-primary" onclick="esCatat(${esPilih})">
          + Catatan SOAP</button>
      </div>

      ${!c.length && !d.length ? `
        <div style="padding:20px; background:var(--bg2); border-radius:8px;
                    font-size:13px; color:var(--text3)">
          Belum ada catatan untuk kunjungan ini.</div>` : ''}

      ${v ? `
        <div style="margin-bottom:14px">
          <div style="font-weight:700; font-size:13px; margin-bottom:6px">
            O — Objektif (tanda vital)</div>
          <div style="font-size:13px; line-height:1.9">
            Tekanan darah: <b>${v.sistol ?? '—'}/${v.diastol ?? '—'}</b> mmHg &nbsp;·&nbsp;
            Nadi: <b>${v.nadi ?? '—'}</b> ×/mnt &nbsp;·&nbsp;
            Napas: <b>${v.napas ?? '—'}</b> ×/mnt &nbsp;·&nbsp;
            Suhu: <b>${v.suhu ?? '—'}</b> °C
            ${v.spo2 != null ? ` &nbsp;·&nbsp; SpO₂: <b>${v.spo2}</b> %` : ''}<br>
            BB: <b>${v.berat ?? '—'}</b> kg &nbsp;·&nbsp;
            TB: <b>${v.tinggi ?? '—'}</b> cm
            ${v.bmi != null ? ` &nbsp;·&nbsp; IMT: <b>${v.bmi}</b>` : ''}
          </div>
          <div style="font-size:11px; color:var(--text3); margin-top:4px">
            Sumber: <code>${esEsc(v.sumber)}</code>
            ${v.oleh ? ' · dicatat ' + esEsc(v.oleh) : ''}
            ${v.waktu ? ' · ' + esJam(v.waktu) : ''}
            ${semuaVital.length > 1
              ? ` · ${semuaVital.length} pengukuran tercatat pada kunjungan ini` : ''}
          </div>
        </div>` : ''}

      ${c.map(x => `
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px">
          <div style="font-weight:700; font-size:13px; margin-bottom:6px">
            S — Subjektif</div>
          <div style="font-size:13px; line-height:1.8">
            Keluhan utama: ${esEsc(x.chief_complaint || '—')}<br>
            ${x.history ? 'Riwayat: ' + esEsc(x.history) + '<br>' : ''}
            ${x.allergies ? `<span style="color:var(--danger); font-weight:700">
              Alergi: ${esEsc(x.allergies)}</span><br>` : ''}
            ${x.current_meds ? 'Obat saat ini: ' + esEsc(x.current_meds) + '<br>' : ''}
            ${x.family_history ? 'Riwayat keluarga: ' + esEsc(x.family_history) : ''}
          </div>
        </div>`).join('')}

      ${d.length ? `
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px">
          <div style="font-weight:700; font-size:13px; margin-bottom:6px">
            A — Asesmen (diagnosa ICD-10)</div>
          <table class="data-table"><thead><tr>
            <th>Kode</th><th>Uraian</th><th>Jenis</th><th>Dicatat</th>
          </tr></thead><tbody>
          ${d.map(x => `<tr>
            <td><b>${esEsc(x.icd_code || '—')}</b></td>
            <td>${esEsc(x.description || '—')}</td>
            <td>${esEsc(x.diagnose_type || '—')}</td>
            <td>${esJam(x.created_at)}</td>
          </tr>`).join('')}
          </tbody></table>
        </div>` : ''}

      <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;
                  font-size:12px; color:var(--text3); line-height:1.7">
        Catatan yang sudah tersimpan tidak bisa dihapus dari layar ini.
        Rekam medis adalah dokumen hukum — koreksi dilakukan dengan catatan
        tambahan yang menyebut apa yang dikoreksi, bukan dengan menghapus
        baris.
      </div>
    </div>`;
}

async function esCatat(admissionId) {
  const a = (esData.admisi || []).find(x => x.id === admissionId);
  const keluhan = prompt('S — Keluhan utama:');
  if (!keluhan) return;
  const riwayat = prompt('Riwayat penyakit sekarang (opsional):', '');
  if (riwayat === null) return;
  const alergi = prompt('Alergi yang diketahui (kosongkan bila tidak ada):', '');
  if (alergi === null) return;

  const td = prompt('O — Tekanan darah (sistol/diastol, mis. 120/80):', '');
  if (td === null) return;
  const nadi = prompt('Nadi (×/menit):', '');
  if (nadi === null) return;
  const suhu = prompt('Suhu (°C):', '');
  if (suhu === null) return;

  const icd = prompt('A — Kode ICD-10 (kosongkan bila belum ditegakkan):', '');
  if (icd === null) return;
  const dx = icd ? prompt('Uraian diagnosa:', '') : '';
  if (dx === null) return;

  const [sis, dia] = String(td).split('/').map(x => parseInt(x, 10));

  try {
    await sbPost('anamnesas', {
      admission_id: admissionId,
      visit_number: a && a.visit_number,
      patient_name: a && a.patient_name,
      chief_complaint: keluhan,
      history: riwayat || null,
      allergies: alergi || null,
      systole: Number.isFinite(sis) ? sis : null,
      heart_rate: nadi ? parseInt(nadi, 10) : null,
      temperature: suhu ? parseFloat(suhu) : null,
    });

    // Tanda vital juga ditulis ke vital_signs supaya layar lain yang
    // membaca tabel itu ikut melihatnya — bukan hanya layar ini.
    if (Number.isFinite(sis) || nadi || suhu) {
      await sbPost('vital_signs', {
        admission_id: admissionId,
        mr_number: a && a.mr_number,
        bp_systolic: Number.isFinite(sis) ? sis : null,
        bp_diastolic: Number.isFinite(dia) ? dia : null,
        pulse: nadi ? parseInt(nadi, 10) : null,
        temperature: suhu ? parseFloat(suhu) : null,
        recorded_at: new Date().toISOString(),
        recorded_by: (window.currentUsername || null),
      }).catch(() => {});
    }

    if (icd) {
      await sbPost('icd_diagnostics', {
        admission_id: admissionId,
        icd_code: icd,
        description: dx || null,
        diagnose_type: 'Utama',
      }).catch(() => {});
    }

    await renderEmrSoap();
  } catch (e) { alert('Gagal menyimpan catatan: ' + e.message); }
}

window.renderEmrSoap = renderEmrSoap;
window.esBuka  = esBuka;
window.esCatat = esCatat;
