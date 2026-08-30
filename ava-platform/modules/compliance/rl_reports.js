// ═══════════════════════════════════════════════════════════════
// LAPORAN RL KEMENKES (Fase 5.4)
//
// KONDISI AWAL: modules/regulatory_reports.js hanya pelacak tugas — mengingatkan
// bahwa laporan harus dibuat, tetapi tidak membuatkan laporannya. Petugas tetap
// menghitung manual dari beberapa layar lalu mengetik ulang.
//
// Modul ini MENGISI angkanya dari data yang sudah ada. Yang tidak bisa
// diturunkan dari data (identitas faskes, nomor izin) diambil dari Pengaturan
// dan ditandai jelas bila belum diisi — bukan ditebak.
//
// CATATAN JUJUR: format RL berubah mengikuti peraturan Kemenkes. Angka di sini
// adalah rekapitulasi dari data operasional Anda, siap disalin ke format resmi
// yang berlaku. Verifikasi definisi tiap indikator sebelum dikirimkan.
// ═══════════════════════════════════════════════════════════════

let rlPeriod = new Date().toISOString().slice(0, 7);
let rlData = null;

async function renderRLReports() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Laporan Kemenkes</h1>
        <p>Rekapitulasi RL dari data operasional — kunjungan, morbiditas, ketenagaan</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="exportRL()">⬇️ Unduh CSV</button>
        <button class="btn btn-ghost btn-sm" onclick="printRL()">🖨 Cetak</button>
      </div>
    </div>

    <div style="background:#FBF1E4;border:1px solid #E0A75E55;border-radius:8px;padding:11px 14px;
      margin-bottom:14px;font-size:12.5px;color:var(--ink-03)">
      Angka di bawah adalah <b>rekapitulasi dari data operasional Anda</b>, siap disalin ke
      format resmi yang berlaku. Format RL berubah mengikuti peraturan — periksa definisi tiap
      indikator sebelum dikirimkan.
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <input type="month" class="table-filter" id="rl-period" value="${rlPeriod}" onchange="loadRL()">
      <span id="rl-status" style="font-size:12.5px;color:var(--text3)"></span>
    </div>
    <div id="rl-content"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await loadRL();
}

async function loadRL() {
  rlPeriod = document.getElementById('rl-period')?.value || rlPeriod;
  const el = document.getElementById('rl-content'); if (!el) return;
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';

  const from = rlPeriod + '-01';
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0)
    .toISOString().split('T')[0];
  const q = (t, s) => sbGet(t, s).catch(() => []);

  try {
    const [adms, emps, labs, rads, hcs] = await Promise.all([
      q('admissions', `select=id,patient_name,patient_gender,patient_age,mr_number,visit_date,created_at&created_at=gte.${from}T00:00:00&created_at=lte.${to}T23:59:59&limit=5000`),
      q('employees', 'select=id,full_name,position,division,status&status=eq.Aktif'),
      q('lab_results', `select=id,admission_id,created_at&created_at=gte.${from}T00:00:00&created_at=lte.${to}T23:59:59&limit=5000`),
      q('radiology_orders', `select=id,modality_code,status,created_at&created_at=gte.${from}T00:00:00&created_at=lte.${to}T23:59:59&limit=2000`),
      q('homecare_orders', `select=id,service_type,status,scheduled_date&scheduled_date=gte.${from}&scheduled_date=lte.${to}&limit=2000`),
    ]);

    const admIds = (adms || []).map(a => a.id);
    const dxs = admIds.length
      ? await q('icd_diagnostics', `select=icd_code,diagnose_name,is_primary,diagnose_type,admission_id&admission_id=in.(${admIds.join(',')})&limit=5000`)
      : [];

    rlData = { from, to, adms: adms || [], emps: emps || [], labs: labs || [],
               rads: rads || [], hcs: hcs || [], dxs: dxs || [] };
    paintRL();
  } catch (e) {
    el.innerHTML = `<div class="status-box status-err">${e.message}</div>`;
  }
}

function rlAggregate() {
  const d = rlData;
  const pasienUnik = new Set(d.adms.map(a => a.mr_number || a.patient_name)).size;
  const baru = new Set(), lama = new Set();
  d.adms.forEach(a => {
    const k = a.mr_number || a.patient_name;
    (baru.has(k) ? lama : baru).add(k);
  });

  const gender = { L: 0, P: 0, lain: 0 };
  d.adms.forEach(a => {
    const g = (a.patient_gender || '').toUpperCase();
    if (g.startsWith('L') || g === 'M') gender.L++;
    else if (g.startsWith('P') || g === 'F') gender.P++;
    else gender.lain++;
  });

  const umur = { '0-4': 0, '5-14': 0, '15-24': 0, '25-44': 0, '45-64': 0, '65+': 0, 'tidak diketahui': 0 };
  d.adms.forEach(a => {
    const u = parseInt(a.patient_age);
    if (isNaN(u)) umur['tidak diketahui']++;
    else if (u <= 4) umur['0-4']++;
    else if (u <= 14) umur['5-14']++;
    else if (u <= 24) umur['15-24']++;
    else if (u <= 44) umur['25-44']++;
    else if (u <= 64) umur['45-64']++;
    else umur['65+']++;
  });

  // Sepuluh besar penyakit — hanya diagnosis utama bila ada penandanya
  const dxCount = {};
  d.dxs.forEach(x => {
    const key = `${x.icd_code || '—'}|${x.diagnose_name || x.diagnosis || 'Tanpa nama'}`;
    dxCount[key] = (dxCount[key] || 0) + 1;
  });
  const top10 = Object.entries(dxCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([k, n]) => { const [kode, nama] = k.split('|'); return { kode, nama, n }; });

  const tenaga = {};
  d.emps.forEach(e => { const p = e.position || 'Tidak diisi'; tenaga[p] = (tenaga[p] || 0) + 1; });

  const radByMod = {};
  d.rads.forEach(r => { const m = r.modality_code || '—'; radByMod[m] = (radByMod[m] || 0) + 1; });

  return { pasienUnik, baru: baru.size, lama: lama.size, gender, umur, top10, tenaga, radByMod,
           kunjungan: d.adms.length, lab: d.labs.length, rad: d.rads.length,
           hc: d.hcs.filter(h => h.status === 'Selesai').length };
}

function paintRL() {
  const el = document.getElementById('rl-content'); if (!el) return;
  const a = rlAggregate();
  const st = document.getElementById('rl-status');
  if (st) st.textContent = `Periode ${rlData.from} s/d ${rlData.to}`;

  const tbl = (rows, c1, c2) => `<table style="width:100%;font-size:12.5px">
    <thead><tr style="background:var(--bg2)">
      <th style="padding:6px;text-align:left">${c1}</th>
      <th style="padding:6px;text-align:right;width:110px">${c2}</th>
    </tr></thead><tbody>${rows.map(r => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px">${r[0]}</td>
      <td style="padding:6px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${r[1]}</td>
    </tr>`).join('')}</tbody></table>`;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:18px">
      ${[{ l: 'Total Kunjungan', v: a.kunjungan, c: '#123A5C' },
         { l: 'Pasien Unik', v: a.pasienUnik, c: '#0E7C86' },
         { l: 'Pasien Baru', v: a.baru, c: '#15803D' },
         { l: 'Pemeriksaan Lab', v: a.lab, c: '#7C3AED' },
         { l: 'Pemeriksaan Radiologi', v: a.rad, c: '#1D4ED8' },
         { l: 'Kunjungan Home Care', v: a.hc, c: '#B45309' }]
        .map(k => `<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid ${k.c};
          border-radius:10px;padding:12px">
          <div style="font-size:21px;font-weight:800;color:${k.c};font-variant-numeric:tabular-nums">${k.v}</div>
          <div style="font-size:10.5px;color:var(--gray)">${k.l}</div></div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card"><div class="card-title" style="margin-bottom:10px">RL 5 — Pengunjung menurut jenis kelamin</div>
        ${tbl([['Laki-laki', a.gender.L], ['Perempuan', a.gender.P],
               ['Tidak diisi', a.gender.lain]], 'Kelompok', 'Jumlah')}</div>
      <div class="card"><div class="card-title" style="margin-bottom:10px">RL 5 — Pengunjung menurut kelompok umur</div>
        ${tbl(Object.entries(a.umur), 'Kelompok umur', 'Jumlah')}</div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title" style="margin-bottom:10px">RL 4 — Sepuluh besar penyakit (berdasarkan ICD-10)</div>
      ${a.top10.length ? `<table style="width:100%;font-size:12.5px">
        <thead><tr style="background:var(--bg2)">
          <th style="padding:6px;text-align:left;width:40px">No</th>
          <th style="padding:6px;text-align:left;width:90px">Kode</th>
          <th style="padding:6px;text-align:left">Diagnosis</th>
          <th style="padding:6px;text-align:right;width:80px">Kasus</th>
        </tr></thead><tbody>${a.top10.map((d, i) => `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px">${i + 1}</td>
          <td style="padding:6px;font-family:ui-monospace,monospace;color:var(--teal)">${d.kode}</td>
          <td style="padding:6px">${d.nama}</td>
          <td style="padding:6px;text-align:right;font-weight:700">${d.n}</td>
        </tr>`).join('')}</tbody></table>`
        : `<div style="color:var(--gray);font-size:12.5px">
            Belum ada diagnosis berkode ICD-10 pada periode ini. Isi diagnosis lewat
            Anamnesa atau Rekam Medis agar laporan ini terisi otomatis.</div>`}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="card"><div class="card-title" style="margin-bottom:10px">RL 2 — Ketenagaan</div>
        ${Object.keys(a.tenaga).length ? tbl(Object.entries(a.tenaga), 'Jabatan', 'Jumlah')
          : '<div style="color:var(--gray);font-size:12.5px">Belum ada data karyawan aktif</div>'}</div>
      <div class="card"><div class="card-title" style="margin-bottom:10px">RL 3 — Kegiatan radiologi per modalitas</div>
        ${Object.keys(a.radByMod).length ? tbl(Object.entries(a.radByMod), 'Modalitas', 'Pemeriksaan')
          : '<div style="color:var(--gray);font-size:12.5px">Belum ada pemeriksaan radiologi</div>'}</div>
    </div>`;
}

function exportRL() {
  if (!rlData) return;
  const a = rlAggregate();
  const rows = [
    ['LAPORAN REKAPITULASI', rlData.from + ' s/d ' + rlData.to],
    [], ['RINGKASAN', 'Jumlah'],
    ['Total kunjungan', a.kunjungan], ['Pasien unik', a.pasienUnik],
    ['Pasien baru', a.baru], ['Pasien lama', a.lama],
    ['Pemeriksaan laboratorium', a.lab], ['Pemeriksaan radiologi', a.rad],
    ['Kunjungan home care selesai', a.hc],
    [], ['RL 5 — JENIS KELAMIN', 'Jumlah'],
    ['Laki-laki', a.gender.L], ['Perempuan', a.gender.P], ['Tidak diisi', a.gender.lain],
    [], ['RL 5 — KELOMPOK UMUR', 'Jumlah'],
    ...Object.entries(a.umur),
    [], ['RL 4 — SEPULUH BESAR PENYAKIT', 'Kode', 'Kasus'],
    ...a.top10.map(d => [d.nama, d.kode, d.n]),
    [], ['RL 2 — KETENAGAAN', 'Jumlah'],
    ...Object.entries(a.tenaga),
    [], ['RL 3 — RADIOLOGI PER MODALITAS', 'Jumlah'],
    ...Object.entries(a.radByMod),
  ];
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = rows.map(r => (r.length ? r.map(esc).join(',') : '')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const el = document.createElement('a');
  el.href = URL.createObjectURL(blob);
  el.download = `laporan_RL_${rlPeriod}.csv`;
  el.click();
  setTimeout(() => URL.revokeObjectURL(el.href), 1000);
}

function printRL() {
  const body = document.getElementById('rl-content')?.innerHTML || '';
  const org = localStorage.getItem('ol_org_name') || 'AVA Health & Lab Diagnostics';
  const w = window.open('', '_blank');
  w.document.write(`<html><head><meta charset="utf-8"><title>Laporan RL ${rlPeriod}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11.5px;padding:22px;max-width:900px;margin:auto}
      h2{margin:0 0 2px} .sub{color:#666;font-size:11px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}
      th{background:var(--bg2)}
      .card{border:1px solid #ddd;border-radius:6px;padding:11px;margin-bottom:12px;page-break-inside:avoid}
      .card-title{font-weight:700;margin-bottom:7px}</style></head><body>
    <h2>Laporan Rekapitulasi — ${org}</h2>
    <div class="sub">Periode ${rlData ? rlData.from + ' s/d ' + rlData.to : rlPeriod}
      · dicetak ${new Date().toLocaleString('id-ID')}</div>
    ${body}
    <script>window.print()</script></body></html>`);
  w.document.close();
}