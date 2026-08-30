// ═══════════════════════════════════════════════════════════════════════════
// MODULE: AVA GLOBAL ECOSYSTEM — Dashboard Operasional Holding
// ---------------------------------------------------------------------------
// Ringkasan lintas 6 pilar + pintasan operasional harian.
//
// ── Aturan yang dipegang berkas ini ────────────────────────────────────────
//
// SETIAP ANGKA DI LAYAR INI BERASAL DARI KUERI. Tidak ada satu pun yang
// ditulis tangan. Dashboard yang menampilkan angka karangan lebih buruk
// daripada dashboard kosong: yang kosong membuat orang mencari datanya,
// yang karangan membuat orang mengambil keputusan di atasnya.
//
// Pilar yang modulnya belum punya sumber data (Sanctuary, FMCG) menampilkan
// tanda "—" dan keterangan "belum tersambung", BUKAN angka contoh. Begitu
// modulnya menulis ke tabel, kuerinya tinggal ditambahkan di bawah.
//
// Hal yang sama berlaku untuk status integrasi: SATUSEHAT dan jembatan
// analyzer hanya ditandai hidup bila benar-benar dicek. Lampu hijau palsu
// pada layar laboratorium adalah cacat keselamatan, bukan sekadar hiasan.
// ═══════════════════════════════════════════════════════════════════════════

const DASH_WARNA = {
  lab:'#0EA5E9', klinik:'#14B8A6', homecare:'#F59E0B',
  fmcg:'#EC4899', sanctuary:'#D4AF37', corporate:'#8B5CF6',
};

const dashAngka = (n) => Number(n || 0).toLocaleString('id-ID');
const dashRp = (n) => typeof formatCurrency === 'function'
  ? formatCurrency(n || 0)
  : 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const dashEsc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Jarak waktu yang dibaca manusia. Log tanpa ini memaksa pembaca menghitung
// selisih jam sendiri, dan itulah alasan log jarang benar-benar dibaca.
function dashLalu(iso) {
  if (!iso) return '';
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  const hari = Math.floor(detik / 86400);
  if (hari < 30) return `${hari} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day:'numeric', month:'short' });
}

async function renderDashboard() {
  const user = typeof getUserName === 'function' ? getUserName() : 'Pengguna';
  const now = new Date();
  const salam = now.getHours() < 12 ? 'Selamat Pagi'
              : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Malam';
  const tanggal = now.toLocaleDateString('id-ID',
    { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const content = document.getElementById('main-content');
  if (!content) return;

  // Kerangka digambar lebih dulu, angka menyusul. Menunggu seluruh kueri
  // selesai sebelum menampilkan apa pun membuat boot terasa menggantung.
  content.innerHTML = `
    <div style="background:linear-gradient(135deg,#0A2342,#0d2d54 55%,#1e293b);
      border:1px solid rgba(212,175,55,.28);border-radius:16px;padding:22px 26px;
      color:#fff;margin-bottom:22px;position:relative;overflow:hidden;
      box-shadow:0 10px 30px rgba(10,35,66,.22)">
      <div style="position:absolute;right:-18px;top:-30px;font-size:150px;opacity:.04;
        font-weight:900;pointer-events:none;letter-spacing:-6px">AVA</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
        flex-wrap:wrap;gap:16px;position:relative;z-index:1">
        <div style="display:flex;align-items:center;gap:15px">
          <img src="css/logo-ava-global.png" alt=""
            style="width:58px;height:58px;border-radius:50%;border:2.5px solid #d4af37;
            object-fit:cover;box-shadow:0 0 15px rgba(212,175,55,.45)"
            onerror="this.style.display='none'">
          <div>
            <div id="dash-lisensi" style="display:flex;gap:8px;flex-wrap:wrap"></div>
            <h1 style="font-size:21px;font-weight:800;margin:8px 0 2px;letter-spacing:-.3px">
              ${salam}, ${dashEsc(user)}</h1>
            <p style="font-size:12.5px;color:#94a3b8;margin:0">${tanggal}</p>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" style="background:rgba(255,255,255,.1);color:#fff;
            border:1px solid rgba(255,255,255,.2);border-radius:8px;font-weight:700"
            onclick="renderDashboard()">↻ Segarkan</button>
          <button class="btn btn-sm btn-teal" style="font-weight:700;border-radius:8px"
            onclick="navigate('holding-finance')">Konsolidasi P&amp;L</button>
        </div>
      </div>
      <div id="dash-telemetri" style="display:flex;gap:16px;margin-top:18px;
        border-top:1px solid rgba(255,255,255,.1);padding-top:13px;font-size:11.5px;
        color:#cbd5e1;flex-wrap:wrap"></div>
    </div>

    <div style="margin-bottom:22px">
      <div style="display:flex;justify-content:space-between;align-items:center;
        margin-bottom:12px;gap:12px;flex-wrap:wrap">
        <h3 style="font-size:15px;font-weight:800;color:var(--navy);margin:0">
          6 Pilar Bisnis Terintegrasi</h3>
        <span style="font-size:11px;color:var(--text3);font-weight:600">
          Klik pilar untuk membuka modulnya &rarr;</span>
      </div>
      <div id="dash-pilar" style="display:grid;
        grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:13px">
        <div class="loading-row" style="padding:24px;grid-column:1/-1"><div class="spinner"></div></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:22px;padding:18px 20px">
      <h3 style="font-size:14.5px;font-weight:800;color:var(--navy);margin:0 0 13px">
        Pintasan Operasional</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:11px">
        ${[
          ['admission','Registrasi Pasien'],
          ['lab','Validasi Hasil Lab'],
          ['emr-soap','EMR SOAP Dokter'],
          ['farmasi','E-Resep Farmasi'],
          ['queue','Antrian Poli'],
          ['ecommerce-oms','Order D2C'],
          ['cashier','Kasir &amp; Billing'],
          ['agentic','AI Orchestrator'],
        ].map(([hal, label]) => `
          <button class="btn btn-ghost" style="padding:12px;font-size:12.5px;font-weight:700;
            border:1px solid var(--border);border-radius:10px"
            onclick="navigate('${hal}')">${label}</button>`).join('')}
      </div>
    </div>

    <div class="grid-2" style="grid-template-columns:1fr 1fr;gap:18px">
      <div class="card" style="padding:18px 20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:13px">
          <h4 style="font-size:14px;font-weight:800;color:var(--navy);margin:0">
            Metrik Operasional Hari Ini</h4>
          <span id="dash-metrik-cap" style="font-size:10.5px;color:var(--text3)"></span>
        </div>
        <div id="dash-metrik">
          <div class="loading-row" style="padding:16px"><div class="spinner"></div></div>
        </div>
      </div>

      <div class="card" style="padding:18px 20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:13px">
          <h4 style="font-size:14px;font-weight:800;color:var(--navy);margin:0">
            Aktivitas Terakhir</h4>
          <span style="font-size:10.5px;color:var(--text3)">Jejak audit</span>
        </div>
        <div id="dash-aktivitas" style="max-height:230px;overflow-y:auto">
          <div class="loading-row" style="padding:16px"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;

  await muatDataDashboard();
}

// ═══════════════════════════════════════════════════════════════
// Pemuatan data
//
// Setiap kueri memakai .catch(()=>null) sendiri. Satu tabel yang belum ada
// di instalasi tertentu tidak boleh mengosongkan seluruh dashboard — bagian
// itu saja yang menampilkan "—".
//
// Perbedaan null vs [] disengaja dan dipakai di bawah:
//   null = kuerinya gagal / tabelnya tidak ada  → tampilkan "—"
//   []   = tabelnya ada tapi memang kosong      → tampilkan 0
// ═══════════════════════════════════════════════════════════════
async function muatDataDashboard() {
  const kini = new Date();
  const hariIni = kini.toISOString().split('T')[0];
  const bulan = `${kini.getFullYear()}-${String(kini.getMonth() + 1).padStart(2, '0')}`;
  const ambil = (t, q) => sbGet(t, q).catch(() => null);

  const [
    admissions, sampel, hasil, qcRuns, homecare,
    corpExam, corporates, invoices, partners, leads, aktivitas,
  ] = await Promise.all([
    ambil('admissions',          `select=id,status,created_at&created_at=gte.${hariIni}`),
    ambil('lab_samples',         `select=id,status,created_at&created_at=gte.${hariIni}`),
    ambil('lab_results',         `select=id,status,created_at&created_at=gte.${hariIni}`),
    ambil('lab_qc_runs',         `select=id,status,created_at&created_at=gte.${hariIni}`),
    ambil('homecare_orders',     'select=id,status'),
    ambil('corp_exam_requests',  'select=id,exam_status,book_date'),
    ambil('corporates',          'select=id'),
    ambil('invoices',            'select=id,total_amount,status,created_at'),
    ambil('partners',            'select=id,status'),
    ambil('leads',               'select=id,status,estimated_value'),
    ambil('activity_logs',       'select=*&order=created_at.desc&limit=12'),
  ]);

  gambarPilar({ sampel, admissions, homecare, corpExam, corporates, invoices });
  gambarMetrik({ admissions, sampel, hasil, qcRuns, homecare });
  gambarAktivitas(aktivitas);
  gambarTelemetri({ qcRuns, sampel });
  gambarLisensi({ partners, leads, invoices, bulan });
}

// ── Kartu 6 pilar ───────────────────────────────────────────────
function gambarPilar(d) {
  const wadah = document.getElementById('dash-pilar');
  if (!wadah) return;

  const jml = (arr) => arr === null ? null : arr.length;

  // Pilar 5 dan 6 dari FMCG/Sanctuary sengaja bernilai null: modulnya belum
  // menulis ke tabel mana pun, jadi tidak ada yang bisa dihitung. Lihat
  // catatan di kepala berkas — angka contoh tidak dipakai di sini.
  const pilar = [
    { ws:'lab', no:1, ico:'🔬', tag:'DIAGNOSTIK', judul:'Laboratorium &amp; LIS Terpadu',
      ket:'530+ parameter · QC Westgard · delta check',
      nilai: jml(d.sampel), satuan:'sampel masuk hari ini' },

    { ws:'klinik', no:2, ico:'🩺', tag:'KLINIK', judul:'Poliklinik &amp; Telehealth',
      ket:'EMR SOAP · e-resep farmasi · ICD-10',
      nilai: jml(d.admissions), satuan:'pendaftaran hari ini' },

    { ws:'homecare', no:3, ico:'🏠', tag:'HOME CARE', judul:'Home Care &amp; Mobile Nakes',
      ket:'sampling ke rumah · dispatch nakes',
      nilai: d.homecare === null ? null
             : d.homecare.filter(o => !['Selesai','Batal'].includes(o.status)).length,
      satuan:'kunjungan berjalan' },

    { ws:'fmcg', no:4, ico:'📦', tag:'FMCG / D2C', judul:'Queen Nutrition &amp; Suplemen',
      ket:'multi-channel OMS · konsinyasi apotek',
      nilai: null, satuan:'belum tersambung ke data' },

    { ws:'sanctuary', no:5, ico:'👑', tag:'SANCTUARY', judul:'Queen Sanctuary &amp; Spa',
      ket:'reservasi treatment · member VIP',
      nilai: null, satuan:'belum tersambung ke data' },

    { ws:'corporate', no:6, ico:'🏢', tag:'B2B &amp; ASURANSI', judul:'Corporate MCU &amp; Klaim',
      ket:'roster MCU massal · INA-CBG · TPA asuransi',
      nilai: jml(d.corporates), satuan:'mitra korporat terdaftar' },
  ];

  wadah.innerHTML = pilar.map(p => {
    const w = DASH_WARNA[p.ws];
    const adaAngka = p.nilai !== null && p.nilai !== undefined;
    return `
      <div class="card" style="padding:15px 16px;border-left:4px solid ${w};cursor:pointer;
        transition:transform .18s" onclick="switchPortfolioWorkspace('${p.ws}')"
        onmouseover="this.style.transform='translateY(-2px)'"
        onmouseout="this.style.transform='none'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-size:23px">${p.ico}</div>
          <span class="badge" style="background:${w}18;color:${w};font-size:9.5px;font-weight:800">
            PILAR ${p.no} &bull; ${p.tag}</span>
        </div>
        <h4 style="font-size:14px;font-weight:800;color:var(--navy);margin:8px 0 3px">${p.judul}</h4>
        <p style="font-size:11.5px;color:var(--text3);margin:0">${p.ket}</p>
        <div style="margin-top:10px;font-size:11.5px;font-weight:700;
          color:${adaAngka ? w : 'var(--text3)'}">
          ${adaAngka ? `${dashAngka(p.nilai)} ${p.satuan} &rarr;`
                     : `<span style="font-weight:600;font-style:italic">${p.satuan}</span>`}
        </div>
      </div>`;
  }).join('');
}

// ── Metrik harian ───────────────────────────────────────────────
function gambarMetrik(d) {
  const wadah = document.getElementById('dash-metrik');
  if (!wadah) return;

  const cap = document.getElementById('dash-metrik-cap');
  if (cap) cap.textContent = 'per ' + new Date().toLocaleTimeString('id-ID',
    { hour:'2-digit', minute:'2-digit' });

  const selesai = ['Selesai','Divalidasi','Dirilis','Approved'];
  const qcGagal = d.qcRuns === null ? null
    : d.qcRuns.filter(q => ['Gagal','Reject','Warning'].includes(q.status)).length;

  const baris = [
    { l:'Pendaftaran pasien',       v: d.admissions === null ? null : d.admissions.length, s:'pasien' },
    { l:'Sampel lab diterima',      v: d.sampel === null ? null : d.sampel.length, s:'tabung' },
    { l:'Hasil lab terverifikasi',
      v: d.hasil === null ? null : d.hasil.filter(h => selesai.includes(h.status)).length,
      s:'hasil', warna:'#16a34a' },
    { l:'Kunjungan home care aktif',
      v: d.homecare === null ? null
         : d.homecare.filter(o => !['Selesai','Batal'].includes(o.status)).length, s:'kunjungan' },
    // Angka ini TIDAK boleh dihijaukan tanpa data. Bila tabel QC tidak
    // terbaca, yang benar adalah mengaku tidak tahu — bukan menulis "0 alarm".
    { l:'Peringatan QC Westgard',
      v: qcGagal, s: qcGagal === 0 ? 'tidak ada peringatan' : 'perlu ditinjau',
      warna: qcGagal === null ? null : qcGagal > 0 ? '#dc2626' : '#16a34a' },
  ];

  wadah.innerHTML = `<div style="display:flex;flex-direction:column;gap:11px">
    ${baris.map((b, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;
        ${i < baris.length - 1 ? 'padding-bottom:9px;border-bottom:1px solid var(--border)' : ''}">
        <span style="font-size:12.5px;color:var(--text)">${b.l}</span>
        ${b.v === null
          ? `<span style="font-size:11.5px;color:var(--text3);font-style:italic">
               data tidak tersedia</span>`
          : `<strong style="font-size:13.5px;color:${b.warna || 'var(--teal)'};white-space:nowrap">
               ${dashAngka(b.v)} <span style="font-weight:500;font-size:11px;color:var(--text3)">${b.s}</span>
             </strong>`}
      </div>`).join('')}
  </div>`;
}

// ── Aktivitas ───────────────────────────────────────────────────
function gambarAktivitas(logs) {
  const wadah = document.getElementById('dash-aktivitas');
  if (!wadah) return;

  if (logs === null) {
    wadah.innerHTML = `<div style="padding:18px 4px;font-size:12px;color:var(--text3)">
      Jejak audit tidak dapat dibaca dari instalasi ini.</div>`;
    return;
  }
  if (!logs.length) {
    wadah.innerHTML = `<div style="padding:18px 4px;font-size:12px;color:var(--text3)">
      Belum ada aktivitas tercatat hari ini.</div>`;
    return;
  }

  const warnaAksi = (a) => /hapus|delete|cabut/i.test(a || '') ? '#dc2626'
                         : /buat|create|tambah/i.test(a || '') ? '#16a34a' : '#0284c7';

  wadah.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
    ${logs.map(l => {
      const judul = l.description || l.action || l.activity_type || 'Aktivitas sistem';
      const oleh = l.user_name || l.created_by_name || l.actor || 'Sistem';
      return `<div style="display:flex;gap:10px;align-items:flex-start">
        <div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:6px;
          background:${warnaAksi(l.action)}"></div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--navy);
            overflow:hidden;text-overflow:ellipsis">${dashEsc(judul)}</div>
          <div style="font-size:10.5px;color:var(--text3)">
            ${dashEsc(oleh)}${l.created_at ? ' &bull; ' + dashLalu(l.created_at) : ''}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Telemetri integrasi ─────────────────────────────────────────
//
// Hanya dua hal yang benar-benar bisa dipastikan tanpa memanggil layanan
// luar: apakah basis data menjawab, dan apakah tabel lab terbaca. Sisanya
// (SATUSEHAT, jembatan analyzer) menunggu pemeriksa sungguhan — sampai itu
// ada, statusnya ditulis "belum diperiksa", bukan "online".
function gambarTelemetri(d) {
  const wadah = document.getElementById('dash-telemetri');
  if (!wadah) return;

  const titik = (warna, label, nilai) => `
    <span style="display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${warna}"></span>
      ${label}: <b>${nilai}</b></span>`;

  const dbHidup = d.sampel !== null || d.qcRuns !== null;

  wadah.innerHTML = [
    titik(dbHidup ? '#22c55e' : '#ef4444', 'Basis data lokal',
          dbHidup ? 'Terhubung' : 'Tidak menjawab'),
    titik(d.qcRuns === null ? '#64748b' : '#22c55e', 'Modul QC lab',
          d.qcRuns === null ? 'Tidak terbaca' : 'Terbaca'),
    titik('#64748b', 'SATUSEHAT FHIR', 'Belum diperiksa'),
    titik('#64748b', 'Jembatan analyzer', 'Belum diperiksa'),
  ].join('');
}

// ── Lencana ringkas di kepala ───────────────────────────────────
function gambarLisensi(d) {
  const wadah = document.getElementById('dash-lisensi');
  if (!wadah) return;

  const modul = typeof window.MODUL_HALAMAN === 'object'
    ? Object.keys(window.MODUL_HALAMAN).length : null;

  const omzetBulan = d.invoices === null ? null
    : d.invoices.filter(i => i.status === 'Dibayar' && String(i.created_at || '').startsWith(d.bulan))
                .reduce((s, i) => s + Number(i.total_amount || 0), 0);

  const lencana = [];
  if (modul !== null) {
    lencana.push(`<span style="font-size:10.5px;font-weight:700;background:rgba(20,184,166,.2);
      color:#2dd4bf;border:1px solid #14b8a6;padding:3px 10px;border-radius:99px">
      ${modul} modul terdaftar</span>`);
  }
  if (omzetBulan !== null) {
    lencana.push(`<span style="font-size:10.5px;font-weight:700;background:rgba(212,175,55,.18);
      color:#d4af37;border:1px solid #d4af37;padding:3px 10px;border-radius:99px">
      Omzet lunas bulan ini ${dashRp(omzetBulan)}</span>`);
  }
  wadah.innerHTML = lencana.join('');
}

// Router hook
window.renderDashboard = renderDashboard;
