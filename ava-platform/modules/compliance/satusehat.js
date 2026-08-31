// ═══════════════════════════════════════════════════════════════
// MODULE: SATUSEHAT (Kemenkes RI)
//
// Menu "Satu Sehat" sebelumnya mati — action-nya string kosong dengan
// penanda soon:true — padahal gerbang, pencatatan jejak, dan converter
// FHIR-nya sudah ada. Layar ini membukanya.
//
// ── Yang JUJUR ditampilkan layar ini ─────────────────────────
// Kesiapan dibaca dari server, bukan diasumsikan. Selama kredensial belum
// diisi, layar ini menyatakan BELUM SIAP dan menolak mengirim apa pun.
// Integrasi versi lama melaporkan "SYNCED_TO_KEMENKES" tanpa mengirim
// apa-apa; layar ini dibuat justru supaya kebohongan seperti itu terlihat.
//
// Seluruh nama global diawali "ss" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let ssStatus = null;
let ssLog = [];

function ssIco(n, s = 16) {
  return (typeof icon === 'function') ? icon(n, s) : '';
}

async function renderSatuSehat() {
  if (typeof injectProShell === 'function') injectProShell();
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>${ssIco('landmark', 20)} SATUSEHAT</h1>
        <p style="color:var(--text3);font-size:13px">
          Pertukaran data kesehatan dengan Kemenkes RI melalui FHIR R4</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="ssUjiKoneksi()">${ssIco('activity', 14)} Uji Koneksi</button>
        <button class="btn btn-teal btn-sm" onclick="renderSatuSehat()">${ssIco('refresh-cw', 14)} Muat Ulang</button>
      </div>
    </div>
    <div id="ss-status"><div class="loading-row"><div class="spinner"></div></div></div>
    <div id="ss-kirim" style="margin-top:14px"></div>
    <div id="ss-log" style="margin-top:14px"></div>`;

  await Promise.all([ssMuatStatus(), ssMuatLog(), ssMuatAntrean()]);
  ssPaintStatus();
  ssPaintKirim();
  ssPaintLog();
}

async function ssMuatStatus() {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/satusehat/status`, { headers: { ...SB_HEADERS } });
    ssStatus = res.ok ? await res.json() : { siap: false, error: `HTTP ${res.status}` };
  } catch (e) {
    ssStatus = { siap: false, error: e.message || String(e) };
  }
}

async function ssMuatLog() {
  try {
    ssLog = await sbGet('satusehat_log',
      'select=id,resource_type,metode,jalur,status_http,berhasil,satusehat_id,galat,dikirim_at' +
      '&order=dikirim_at.desc&limit=50');
    if (!Array.isArray(ssLog)) ssLog = [];
  } catch (e) { ssLog = []; }
}

function ssPaintStatus() {
  const el = document.getElementById('ss-status');
  if (!el) return;
  const s = ssStatus || {};
  const siap = !!s.siap;

  const baris = (label, isi, ok) => `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)">
      <span style="color:var(--text3);font-size:12.5px">${label}</span>
      <span style="font-size:12.5px;font-weight:600;color:${ok === false ? 'var(--danger,#dc2626)' : 'var(--text1)'}">${isi}</span>
    </div>`;

  el.innerHTML = `
    <div class="card" style="padding:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="width:9px;height:9px;border-radius:50%;background:${siap ? '#10B981' : '#F59E0B'};
                     box-shadow:0 0 8px ${siap ? '#10B981' : '#F59E0B'}"></span>
        <strong style="font-size:15px">${siap ? 'Siap mengirim' : 'Belum siap'}</strong>
        <span class="badge" style="margin-left:auto">${(s.mode || '-').toUpperCase()}</span>
      </div>

      ${siap ? '' : `
      <div style="background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.35);
                  border-radius:10px;padding:11px 13px;margin-bottom:12px;font-size:12.5px;line-height:1.6">
        <strong>Kredensial belum lengkap.</strong> Isi <code>SATUSEHAT_CLIENT_ID</code>,
        <code>SATUSEHAT_CLIENT_SECRET</code>, dan <code>SATUSEHAT_ORG_ID</code> di
        <code>desktop-app/.env</code>, lalu jalankan ulang aplikasi.
        Client secret sengaja tidak pernah dikirim ke peramban, jadi tidak bisa diisi dari layar ini.
      </div>`}

      ${baris('Lingkungan', s.mode === 'prod' ? 'Produksi' : 'Sandbox (stg)')}
      ${baris('Alamat FHIR', s.fhirUrl || '-')}
      ${baris('Organization ID', s.orgId || 'belum diisi', !!s.orgId)}
      ${baris('Client ID', s.clientIdTerisi ? 'terisi' : 'belum diisi', !!s.clientIdTerisi)}
      ${baris('Client Secret', s.clientSecretTerisi ? 'terisi' : 'belum diisi', !!s.clientSecretTerisi)}
      ${baris('Token aktif', s.tokenAktif ? 'ya' : 'belum ada')}
      ${s.error ? baris('Galat', s.error, false) : ''}
    </div>`;
}

function ssPaintLog() {
  const el = document.getElementById('ss-log');
  if (!el) return;

  if (!ssLog.length) {
    el.innerHTML = `<div class="card" style="padding:22px;text-align:center;color:var(--text3);font-size:13px">
      Belum ada riwayat pengiriman.</div>`;
    return;
  }

  const gagal = ssLog.filter(r => !r.berhasil).length;
  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">
        <strong style="font-size:13.5px">Riwayat Pengiriman</strong>
        <span style="color:var(--text3);font-size:12px">50 terakhir</span>
        ${gagal ? `<span class="badge" style="margin-left:auto;background:rgba(220,38,38,.14);color:#f87171">${gagal} gagal</span>` : ''}
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="color:var(--text3);text-align:left">
            <th style="padding:9px 16px">Waktu</th><th>Resource</th><th>Metode</th>
            <th>HTTP</th><th>Hasil</th><th style="padding-right:16px">Keterangan</th>
          </tr></thead>
          <tbody>${ssLog.map(r => `
            <tr style="border-top:1px solid var(--line)">
              <td style="padding:9px 16px;white-space:nowrap">${r.dikirim_at ? new Date(r.dikirim_at).toLocaleString('id-ID') : '-'}</td>
              <td>${r.resource_type || '-'}</td>
              <td>${r.metode || '-'}</td>
              <td>${r.status_http || '-'}</td>
              <td style="color:${r.berhasil ? '#34D399' : '#f87171'};font-weight:600">
                ${r.berhasil ? 'berhasil' : 'gagal'}</td>
              <td style="padding-right:16px;color:var(--text3);max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  title="${(r.galat || r.satusehat_id || '').replace(/"/g, '&quot;')}">
                ${r.berhasil ? (r.satusehat_id || '') : (r.galat || '').slice(0, 90)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// PENGIRIMAN DATA KLINIS
//
// Sebelumnya layar ini hanya bisa MENGUJI KONEKSI. Konverter FHIR-nya
// sudah lengkap sejak lama di js/core/fhirConverter.js — Patient,
// Encounter, Observation, Condition, DiagnosticReport — tapi tidak ada
// satu pun layar yang memakainya. Pipanya terpasang, tidak ada yang
// mengalir. Itulah yang membuat menu ini berstatus "parsial".
//
// ── Urutan pengiriman tidak boleh dibalik ────────────────────
// FHIR menuntut Patient ada lebih dulu sebelum Encounter menunjuk
// kepadanya, dan Encounter sebelum Observation. Mengirim Encounter untuk
// pasien yang belum terdaftar akan ditolak Kemenkes — dan yang lebih
// buruk, bila sempat diterima, ia menggantung tanpa induk.
//
// Karena itu tombol kirim untuk kunjungan TIDAK muncul selama pasiennya
// belum tertaut. Bukan muncul lalu gagal.
//
// ── Yang tidak dilakukan di sini ─────────────────────────────
// Tidak ada pengiriman massal otomatis. Data yang dikirim ke sistem
// kesehatan nasional atas nama fasilitas ini tidak boleh mengalir tanpa
// ada yang menekan dan melihat hasilnya. Kesalahan pemetaan yang
// terkirim seribu kali jauh lebih mahal daripada yang terkirim sekali.

let ssPeta = [];        // satusehat_resource_map
let ssPasien = [];
let ssKunjungan = [];
let ssDiagnosa = [];
let ssHasil = [];
let ssProduk = [];

async function ssMuatAntrean() {
  const aman = async (t, q) => { try { return await sbGet(t, q); } catch (_) { return []; } };
  [ssPeta, ssPasien, ssKunjungan, ssDiagnosa, ssHasil] = await Promise.all([
    aman('satusehat_resource_map', 'select=*&limit=2000'),
    aman('mpi_person',
      'select=id,ava_id,full_name,birth_date,sex&is_deleted=is.false&order=id.desc&limit=50'),
    aman('admissions',
      'select=id,visit_number,patient_name,visit_date,mr_number&order=id.desc&limit=50'),
    aman('icd_diagnostics', 'select=*&order=id.desc&limit=50'),
    aman('lab_results', 'select=*&order=id.desc&limit=50'),
  ]);

  // LOINC tidak ada di lab_results — ia tinggal di master products.
  // Tanpa penggabungan ini, setiap hasil akan terlihat "belum dipetakan"
  // padahal kodenya sudah ada di katalog.
  ssProduk = await aman('products', 'select=id,nama_tes,loinc_code,satuan_hasil&limit=2000');
}

// lab_results memakai nama kolom yang berbeda dari yang diharapkan
// konverter FHIR: result_value bukan nilai_hasil, unit bukan satuan,
// product_name bukan nama_tes. Ketidakcocokan ini membuat hasil yang sah
// ditolak sebagai "nilai kosong" — jadi pemetaannya dilakukan di satu
// tempat, di sini.
function ssHasilKeFhir(h, patientId, encounterId) {
  const prod = (ssProduk || []).find(x => x.id === h.product_id) || {};
  return {
    nama_tes: h.product_name || prod.nama_tes || h.test_name,
    nilai_hasil: h.result_numeric != null ? h.result_numeric : h.result_value,
    satuan: h.unit || prod.satuan_hasil,
    loinc_code: h.loinc_code || prod.loinc_code,
    ref_min: h.normal_min,
    ref_max: h.normal_max,
    satusehat_patient_id: patientId,
    satusehat_encounter_id: encounterId,
  };
}

// LOINC dilihat lewat master juga, supaya tombol kirim tidak tertahan
// hanya karena kolom di lab_results memang tidak pernah ada.
function ssLoincHasil(h) {
  const prod = (ssProduk || []).find(x => x.id === h.product_id) || {};
  return h.loinc_code || prod.loinc_code || null;
}

// Induk sebuah kunjungan: pasien MPI-nya, dan apakah keduanya sudah
// tertaut. Diagnosa dan hasil lab menunjuk keduanya, jadi keduanya harus
// ada lebih dulu.
function ssIndukKunjungan(admissionId) {
  const k = (ssKunjungan || []).find(x => x.id === admissionId);
  if (!k) return null;
  const p = (ssPasien || []).find(x =>
    (x.full_name || '').toLowerCase() === (k.patient_name || '').toLowerCase());
  return {
    kunjungan: k,
    encounterId: ssIdSatuSehat('admissions', k.id),
    patientId: p ? ssIdSatuSehat('mpi_person', p.id) : null,
  };
}

// Sudah tertaut ke SATUSEHAT? Dicari dari peta, bukan ditebak.
function ssIdSatuSehat(tabel, lokalId) {
  const r = (ssPeta || []).find(x =>
    x.lokal_tabel === tabel && String(x.lokal_id) === String(lokalId));
  return r ? r.satusehat_id : null;
}

async function ssCatatPeta(resourceType, tabel, lokalId, satusehatId) {
  try {
    await sbPost('satusehat_resource_map', {
      resource_type: resourceType, lokal_tabel: tabel,
      lokal_id: String(lokalId), satusehat_id: satusehatId,
    });
  } catch (_) { /* jejak utamanya tetap ada di satusehat_log */ }
}

function ssPaintKirim() {
  const el = document.getElementById('ss-kirim');
  if (!el) return;

  const siap = !!(ssStatus && ssStatus.siap);
  const adaKonverter = typeof window.fhirConverter === 'object'
    && typeof window.fhirConverter.convertToFhirPatient === 'function';

  if (!adaKonverter) {
    el.innerHTML = `
      <div class="card" style="padding:16px;font-size:13px;line-height:1.7">
        <strong>Konverter FHIR belum dimuat.</strong>
        Berkas <code>js/core/fhirConverter.js</code> tidak tersedia di halaman ini,
        jadi data klinis belum bisa dipetakan ke format FHIR.
      </div>`;
    return;
  }

  const pasienBelum = (ssPasien || []).filter(p => !ssIdSatuSehat('mpi_person', p.id));
  const pasienSudah = (ssPasien || []).length - pasienBelum.length;

  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--line)">
        <strong style="font-size:13.5px">Kirim Data Klinis</strong>
        <div style="color:var(--text3);font-size:12px;margin-top:3px">
          Pasien harus terkirim lebih dulu; kunjungan menunjuk kepadanya.
          Urutan ini dituntut FHIR, bukan pilihan tampilan.
        </div>
      </div>

      ${!siap ? `
        <div style="padding:14px 16px;font-size:12.5px;color:var(--text3)">
          Kredensial belum lengkap — pengiriman dinonaktifkan. Layar ini tidak
          akan mencoba mengirim apa pun selama server menyatakan belum siap.
        </div>` : `
        <div style="padding:12px 16px;border-bottom:1px solid var(--line);
                    font-size:12.5px;color:var(--text3)">
          ${pasienSudah} dari ${(ssPasien || []).length} pasien terakhir sudah tertaut.
        </div>

        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead><tr style="color:var(--text3);text-align:left">
              <th style="padding:9px 16px">Pasien</th><th>Lahir</th>
              <th>ID SATUSEHAT</th><th style="padding-right:16px"></th>
            </tr></thead>
            <tbody>${(ssPasien || []).slice(0, 15).map(p => {
              const sid = ssIdSatuSehat('mpi_person', p.id);
              return `<tr style="border-top:1px solid var(--line)">
                <td style="padding:9px 16px">${escHtmlFhir(p.full_name || '-')}
                  <div style="color:var(--text3);font-size:11px">
                    ${escHtmlFhir(p.ava_id || '')}</div></td>
                <td>${p.birth_date || '-'}</td>
                <td style="color:${sid ? '#34D399' : 'var(--text3)'}">
                  ${sid ? escHtmlFhir(sid) : 'belum tertaut'}</td>
                <td style="padding-right:16px">
                  ${sid ? '' : `<button class="btn btn-sm btn-teal"
                     onclick="ssKirimPasien(${p.id})">Kirim</button>`}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>

        <div style="padding:12px 16px;border-top:1px solid var(--line)">
          <strong style="font-size:13px">Kunjungan</strong>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead><tr style="color:var(--text3);text-align:left">
              <th style="padding:9px 16px">Kunjungan</th><th>Pasien</th>
              <th>Tanggal</th><th>ID SATUSEHAT</th><th style="padding-right:16px"></th>
            </tr></thead>
            <tbody>${(ssKunjungan || []).slice(0, 15).map(k => {
              const sid = ssIdSatuSehat('admissions', k.id);
              // Pasien dicocokkan lewat MPI. Tanpa tautan pasien, kunjungan
              // tidak boleh dikirim — Encounter yang menunjuk pasien tak
              // terdaftar akan menggantung tanpa induk.
              const p = (ssPasien || []).find(x =>
                (x.full_name || '').toLowerCase() === (k.patient_name || '').toLowerCase());
              const pid = p ? ssIdSatuSehat('mpi_person', p.id) : null;
              return `<tr style="border-top:1px solid var(--line)">
                <td style="padding:9px 16px">${escHtmlFhir(k.visit_number || k.id)}</td>
                <td>${escHtmlFhir(k.patient_name || '-')}</td>
                <td>${k.visit_date || '-'}</td>
                <td style="color:${sid ? '#34D399' : 'var(--text3)'}">
                  ${sid ? escHtmlFhir(sid) : 'belum tertaut'}</td>
                <td style="padding-right:16px">
                  ${sid ? ''
                    : pid ? `<button class="btn btn-sm btn-teal"
                               onclick="ssKirimKunjungan(${k.id}, '${escHtmlFhir(pid)}')">
                               Kirim</button>`
                          : `<span style="color:var(--text3);font-size:11.5px">
                               pasien belum tertaut</span>`}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>

        <div style="padding:12px 16px;border-top:1px solid var(--line)">
          <strong style="font-size:13px">Diagnosa</strong>
          <span style="color:var(--text3);font-size:11.5px;margin-left:6px">
            menunjuk pasien dan kunjungan — keduanya harus tertaut lebih dulu</span>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead><tr style="color:var(--text3);text-align:left">
              <th style="padding:9px 16px">Kode ICD-10</th><th>Uraian</th>
              <th>Kunjungan</th><th>ID SATUSEHAT</th><th style="padding-right:16px"></th>
            </tr></thead>
            <tbody>${(ssDiagnosa || []).slice(0, 10).map(d => {
              const sid = ssIdSatuSehat('icd_diagnostics', d.id);
              const induk = ssIndukKunjungan(d.admission_id);
              const siapKirim = induk && induk.patientId && induk.encounterId;
              return `<tr style="border-top:1px solid var(--line)">
                <td style="padding:9px 16px"><b>${escHtmlFhir(d.icd_code || '-')}</b></td>
                <td>${escHtmlFhir(d.description || '-')}</td>
                <td>${escHtmlFhir((induk && induk.kunjungan.visit_number) || d.admission_id || '-')}</td>
                <td style="color:${sid ? '#34D399' : 'var(--text3)'}">
                  ${sid ? escHtmlFhir(sid) : 'belum tertaut'}</td>
                <td style="padding-right:16px">
                  ${sid ? ''
                    : siapKirim ? `<button class="btn btn-sm btn-teal"
                        onclick="ssKirimDiagnosa(${d.id})">Kirim</button>`
                      : `<span style="color:var(--text3);font-size:11.5px">
                           ${!induk ? 'kunjungan tak dikenal'
                             : !induk.patientId ? 'pasien belum tertaut'
                             : 'kunjungan belum tertaut'}</span>`}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>

        <div style="padding:12px 16px;border-top:1px solid var(--line)">
          <strong style="font-size:13px">Hasil Pemeriksaan</strong>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead><tr style="color:var(--text3);text-align:left">
              <th style="padding:9px 16px">Pemeriksaan</th><th>Nilai</th>
              <th>LOINC</th><th>ID SATUSEHAT</th><th style="padding-right:16px"></th>
            </tr></thead>
            <tbody>${(ssHasil || []).slice(0, 10).map(h => {
              const sid = ssIdSatuSehat('lab_results', h.id);
              const induk = ssIndukKunjungan(h.admission_id);
              const siapKirim = induk && induk.patientId && induk.encounterId;
              // LOINC kosong menahan pengiriman. Observation tanpa kode
              // standar tidak bisa dibaca sistem lain — ia terkirim tapi
              // tidak berarti apa-apa bagi penerimanya.
              const loinc = ssLoincHasil(h);
              const adaLoinc = !!(loinc && String(loinc).trim());
              return `<tr style="border-top:1px solid var(--line)">
                <td style="padding:9px 16px">${escHtmlFhir(h.product_name || h.test_name || '-')}</td>
                <td>${escHtmlFhir(h.result_value ?? h.result_numeric ?? '-')}
                  ${escHtmlFhir(h.unit || '')}</td>
                <td style="color:${adaLoinc ? 'inherit' : 'var(--text3)'}">
                  ${adaLoinc ? escHtmlFhir(loinc) : 'belum dipetakan'}</td>
                <td style="color:${sid ? '#34D399' : 'var(--text3)'}">
                  ${sid ? escHtmlFhir(sid) : 'belum tertaut'}</td>
                <td style="padding-right:16px">
                  ${sid ? ''
                    : (siapKirim && adaLoinc) ? `<button class="btn btn-sm btn-teal"
                        onclick="ssKirimHasil(${h.id})">Kirim</button>`
                      : `<span style="color:var(--text3);font-size:11.5px">
                           ${!adaLoinc ? 'LOINC belum dipetakan'
                             : !induk ? 'kunjungan tak dikenal'
                             : !induk.patientId ? 'pasien belum tertaut'
                             : 'kunjungan belum tertaut'}</span>`}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>`}
    </div>`;
}

async function ssKirimPasien(id) {
  const p = (ssPasien || []).find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Kirim data ${p.full_name} ke SATUSEHAT?\n\n`
    + 'Data ini terdaftar atas nama fasilitas Anda di sistem kesehatan nasional '
    + 'dan tidak bisa ditarik kembali dari layar ini.')) return;

  try {
    // Konverter menolak NIK kosong dan tidak punya nilai cadangan — itu
    // memang disengaja: mendaftarkan pasien atas nomor identitas yang
    // bukan miliknya jauh lebih buruk daripada gagal mengirim.
    const resource = window.fhirConverter.convertToFhirPatient(p);
    const r = await window.fhirConverter.syncToSatuSehat(resource);
    if (!r.success) {
      if (typeof toast === 'function') toast(r.error || 'Pengiriman ditolak', 'err');
      else alert(r.error || 'Pengiriman ditolak');
    } else {
      await ssCatatPeta('Patient', 'mpi_person', p.id, r.satusehatId);
      if (typeof toast === 'function') toast(`Terkirim — ID ${r.satusehatId}`, 'ok');
    }
  } catch (e) {
    const pesan = e && e.message ? e.message : String(e);
    if (typeof toast === 'function') toast(pesan, 'err'); else alert(pesan);
  }
  await renderSatuSehat();
}

async function ssKirimKunjungan(id, patientSatusehatId) {
  const k = (ssKunjungan || []).find(x => x.id === id);
  if (!k) return;
  if (!confirm(`Kirim kunjungan ${k.visit_number || id} ke SATUSEHAT?`)) return;

  try {
    const resource = window.fhirConverter.convertToFhirEncounter(
      { ...k, satusehat_patient_id: patientSatusehatId },
      (ssStatus && ssStatus.orgId) || null);
    const r = await window.fhirConverter.syncToSatuSehat(resource);
    if (!r.success) {
      if (typeof toast === 'function') toast(r.error || 'Pengiriman ditolak', 'err');
      else alert(r.error || 'Pengiriman ditolak');
    } else {
      await ssCatatPeta('Encounter', 'admissions', k.id, r.satusehatId);
      if (typeof toast === 'function') toast(`Terkirim — ID ${r.satusehatId}`, 'ok');
    }
  } catch (e) {
    const pesan = e && e.message ? e.message : String(e);
    if (typeof toast === 'function') toast(pesan, 'err'); else alert(pesan);
  }
  await renderSatuSehat();
}

async function ssKirimDiagnosa(id) {
  const d = (ssDiagnosa || []).find(x => x.id === id);
  if (!d) return;
  const induk = ssIndukKunjungan(d.admission_id);
  if (!induk || !induk.patientId || !induk.encounterId) {
    alert('Pasien dan kunjungannya harus tertaut lebih dulu.');
    return;
  }
  if (!confirm(`Kirim diagnosa ${d.icd_code} ke SATUSEHAT?`)) return;

  try {
    const resource = window.fhirConverter.convertToFhirCondition({
      ...d,
      satusehat_patient_id: induk.patientId,
      satusehat_encounter_id: induk.encounterId,
    });
    const r = await window.fhirConverter.syncToSatuSehat(resource);
    if (!r.success) {
      if (typeof toast === 'function') toast(r.error || 'Ditolak', 'err');
      else alert(r.error || 'Ditolak');
    } else {
      await ssCatatPeta('Condition', 'icd_diagnostics', d.id, r.satusehatId);
      if (typeof toast === 'function') toast(`Terkirim — ID ${r.satusehatId}`, 'ok');
    }
  } catch (e) {
    const pesan = e && e.message ? e.message : String(e);
    if (typeof toast === 'function') toast(pesan, 'err'); else alert(pesan);
  }
  await renderSatuSehat();
}

async function ssKirimHasil(id) {
  const h = (ssHasil || []).find(x => x.id === id);
  if (!h) return;
  const induk = ssIndukKunjungan(h.admission_id);
  if (!induk || !induk.patientId || !induk.encounterId) {
    alert('Pasien dan kunjungannya harus tertaut lebih dulu.');
    return;
  }
  if (!confirm(`Kirim hasil ${h.product_name || h.test_name} ke SATUSEHAT?`)) return;

  try {
    // Konverter menolak nilai, LOINC, dan satuan yang kosong — tidak ada
    // nilai cadangan. Hasil laboratorium yang dikarang lalu dikirim ke
    // sistem kesehatan nasional adalah kesalahan yang tidak bisa ditarik.
    const resource = window.fhirConverter.convertToFhirObservation(
      ssHasilKeFhir(h, induk.patientId, induk.encounterId));
    const r = await window.fhirConverter.syncToSatuSehat(resource);
    if (!r.success) {
      if (typeof toast === 'function') toast(r.error || 'Ditolak', 'err');
      else alert(r.error || 'Ditolak');
    } else {
      await ssCatatPeta('Observation', 'lab_results', h.id, r.satusehatId);
      if (typeof toast === 'function') toast(`Terkirim — ID ${r.satusehatId}`, 'ok');
    }
  } catch (e) {
    const pesan = e && e.message ? e.message : String(e);
    if (typeof toast === 'function') toast(pesan, 'err'); else alert(pesan);
  }
  await renderSatuSehat();
}

// Pelolos HTML lokal — fhirConverter punya miliknya sendiri tapi tidak
// diekspor ke window.
function escHtmlFhir(x) {
  return String(x ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Uji koneksi sungguhan: menukar token lalu membaca metadata. Tidak mengirim
// data pasien apa pun — aman dijalankan kapan saja.
async function ssUjiKoneksi() {
  if (!ssStatus || !ssStatus.siap) {
    if (typeof toast === 'function') toast('Kredensial belum lengkap — lengkapi dulu di .env', 'warn');
    return;
  }
  if (typeof toast === 'function') toast('Menghubungi SATUSEHAT...', 'info');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/satusehat`, {
      method: 'POST', headers: { ...SB_HEADERS },
      body: JSON.stringify({ metode: 'GET', jalur: `Organization/${ssStatus.orgId}` }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.resourceType) {
      if (typeof toast === 'function') toast(`Terhubung — Organization "${d.name || d.id}" terbaca`, 'ok');
    } else {
      if (typeof toast === 'function') toast(`Gagal: ${d.error || `HTTP ${res.status}`}`, 'err');
    }
  } catch (e) {
    if (typeof toast === 'function') toast('Gagal menghubungi gerbang: ' + (e.message || e), 'err');
  }
  await ssMuatStatus(); ssPaintStatus();
  await ssMuatLog();    ssPaintLog();
}

window.renderSatuSehat = renderSatuSehat;
window.ssUjiKoneksi = ssUjiKoneksi;
window.ssKirimPasien = ssKirimPasien;
window.ssKirimKunjungan = ssKirimKunjungan;
window.ssKirimDiagnosa = ssKirimDiagnosa;
window.ssKirimHasil = ssKirimHasil;
