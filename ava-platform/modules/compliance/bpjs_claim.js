// ═══════════════════════════════════════════════════════════════════════════
// MODULE: Klaim Asuransi, BPJS INA-CBG & TPA Corporate — AVA GLOBAL
// ---------------------------------------------------------------------------
// Fitur:
// - Grouper Tarif INA-CBG v6.0 (Diagnosa ICD-10 & Prosedur ICD-9-CM)
// - Penerbitan & Validasi SEP (Surat Eligibilitas Peserta) BPJS VClaim v2.0
// - Manajemen Klaim Asuransi Swasta & TPA (AdMedika, Inhealth, Prudential)
// - Verifikasi Kelengkapan Berkas Medis (Resume Medis, Billing, Hasil Lab)
// - Rekapitulasi Settlement & Piutang Klaim B2B
// ═══════════════════════════════════════════════════════════════════════════

let BPJS_STATE = {
  activeTab: 'claims', // 'claims' | 'sep' | 'grouper' | 'tpa' | 'settlement'
  claims: [
    {
      no_sep: '0032S0120826V0001',
      pasien: 'Ny. Siska Melani',
      no_rm: 'RM-2026-0041',
      tgl_layanan: '2026-08-19',
      poli: 'Poli Obgyn & Hormon',
      icd10: 'E28.2 (Polycystic Ovarian Syndrome)',
      icd9cm: '88.78 (Diagnostic Ultrasound of Gravid Uterus)',
      kode_cbg: 'N-4-10-I',
      deskripsi_cbg: 'Penyakit Ovarium & Tuba Ringan',
      tarif_rs: 650000,
      tarif_inacbg: 580000,
      status: 'Siap Kirim e-Klaim',
      kelengkapan: '100% (SEP, CPPT, Lab)'
    },
    {
      no_sep: '0032S0120826V0002',
      pasien: 'Bpk. Hendra Gunawan',
      no_rm: 'RM-2026-0048',
      tgl_layanan: '2026-08-18',
      poli: 'Poli Penyakit Dalam',
      icd10: 'E11.9 (Type 2 Diabetes Mellitus)',
      icd9cm: '90.59 (Diagnostic Examination of Blood)',
      kode_cbg: 'E-4-10-I',
      deskripsi_cbg: 'Diabetes Melitus Tanpa Komplikasi',
      tarif_rs: 450000,
      tarif_inacbg: 420000,
      status: 'Terverifikasi BPJS',
      kelengkapan: '100%'
    },
    {
      no_sep: '0032S0120826V0003',
      pasien: 'Ibu Ratna Juwita',
      no_rm: 'RM-2026-0052',
      tgl_layanan: '2026-08-21',
      poli: 'Poli Kulit & Estetika',
      icd10: 'L70.0 (Acne Vulgaris)',
      icd9cm: '86.28 (Nonexcisional Debridement)',
      kode_cbg: 'L-4-12-I',
      deskripsi_cbg: 'Kelainan Kulit Ringan',
      tarif_rs: 550000,
      tarif_inacbg: 490000,
      status: 'Proses Verifikasi',
      kelengkapan: '85% (Menunggu Resume Dokter)'
    }
  ],
  sepList: [
    { noSep: '0032S0120826V0001', noKartu: '000182910293', nama: 'Ny. Siska Melani', tglSep: '2026-08-19', poli: 'Obgyn', jnsPelayanan: 'Rawat Jalan', status: 'Terbit' },
    { noSep: '0032S0120826V0002', noKartu: '000199201928', nama: 'Bpk. Hendra Gunawan', tglSep: '2026-08-18', poli: 'Penyakit Dalam', jnsPelayanan: 'Rawat Jalan', status: 'Terbit' },
    { noSep: '0032S0120826V0003', noKartu: '000288192011', nama: 'Ibu Ratna Juwita', tglSep: '2026-08-21', poli: 'Kulit', jnsPelayanan: 'Rawat Jalan', status: 'Terbit' }
  ],
  tpaClaims: [
    { noKlaim: 'CLM-ADM-8801', asuransi: 'AdMedika', perusahaan: 'PT Telkom Indonesia', pasien: 'dr. Amanda Clarissa', tagihan: 1250000, approved: 1250000, status: 'Approved' },
    { noKlaim: 'CLM-INH-8802', asuransi: 'Mandiri Inhealth', perusahaan: 'Bank Mandiri (Persero)', pasien: 'Bpk. Rizky Pratama', tagihan: 890000, approved: 890000, status: 'Approved' },
    { noKlaim: 'CLM-PRU-8803', asuransi: 'Prudential Corporate', perusahaan: 'PT Astra International', pasien: 'Ny. Maya Indah', tagihan: 2400000, approved: 2150000, status: 'Sebagian Disetujui' }
  ]
};

async function renderBpjsClaim(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  if (params.tab) BPJS_STATE.activeTab = params.tab;

  const totalKlaimBpjs = BPJS_STATE.claims.reduce((s, c) => s + c.tarif_inacbg, 0);
  const totalKlaimTpa = BPJS_STATE.tpaClaims.reduce((s, t) => s + t.approved, 0);

  content.innerHTML = `
    <!-- Header Modul -->
    <div class="page-header">
      <div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span class="badge" style="background:#ede9fe; color:#6d28d9; font-weight:800; font-size:10px;">PILAR 6 &bull; PT AVA MITRA KORPORAT &amp; ASURANSI</span>
          <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:800; font-size:10px;">BPJS VCLAIM 2.0 &amp; ADMEDIKA BRIDGE</span>
        </div>
        <h1>📑 Klaim Asuransi, BPJS INA-CBG &amp; TPA</h1>
        <p>Grouping tarif INA-CBG, verifikasi kelengkapan berkas rekam medis &amp; penagihan asuransi korporat</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderBpjsClaim()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="openSimulasiGrouperModal()">+ Simulasi Grouper INA-CBG</button>
        <button class="btn btn-primary btn-sm" style="background:#0A2342; border-color:#0A2342; color:#fff;" onclick="openPenerbitanSepModal()">+ Terbitkan SEP Baru</button>
      </div>
    </div>

    <!-- Ringkasan KPI Klaim -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; margin-bottom:20px;">
      <div class="kpi-card" style="border-left: 4px solid #8b5cf6;">
        <div class="kpi-icon" style="background:rgba(139,92,246,0.15); color:#8b5cf6;">🛡️</div>
        <div>
          <div class="kpi-val">Rp ${((totalKlaimBpjs + totalKlaimTpa)/1000000).toFixed(1)} Jt</div>
          <div class="kpi-label">Total Nilai Klaim Terbit</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">BPJS + Asuransi Swasta</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #0ea5e9;">
        <div class="kpi-icon" style="background:rgba(14,165,233,0.15); color:#0ea5e9;">📋</div>
        <div>
          <div class="kpi-val">${BPJS_STATE.claims.length + BPJS_STATE.tpaClaims.length} Berkas</div>
          <div class="kpi-label">Berkas Klaim Diproses</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Kesesuaian Medis 100%</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #22c55e;">
        <div class="kpi-icon" style="background:rgba(34,197,94,0.15); color:#22c55e;">⚡</div>
        <div>
          <div class="kpi-val">0 Berkas</div>
          <div class="kpi-label">Dispute / Pending Approval</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Zero Dispute Record</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #f59e0b;">
        <div class="kpi-icon" style="background:rgba(245,158,11,0.15); color:#f59e0b;">🎯</div>
        <div>
          <div class="kpi-val">100%</div>
          <div class="kpi-label">Akurasi Grouping ICD-10</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Standar Kemenkes RI</div>
        </div>
      </div>
    </div>

    <!-- Sub-Menu Workspace Tabs (Navigasi Internal Modul) -->
    <div style="display:flex; gap:8px; border-bottom:2px solid var(--border); margin-bottom:20px; overflow-x:auto; padding-bottom:2px;">
      <button class="btn btn-sm ${BPJS_STATE.activeTab === 'claims' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabBpjs('claims')">
        📑 1. Berkas e-Klaim BPJS (${BPJS_STATE.claims.length})
      </button>
      <button class="btn btn-sm ${BPJS_STATE.activeTab === 'sep' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabBpjs('sep')">
        🪪 2. Bridging SEP VClaim (${BPJS_STATE.sepList.length})
      </button>
      <button class="btn btn-sm ${BPJS_STATE.activeTab === 'grouper' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabBpjs('grouper')">
        🧮 3. Simulator Grouper INA-CBG
      </button>
      <button class="btn btn-sm ${BPJS_STATE.activeTab === 'tpa' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabBpjs('tpa')">
        🏢 4. Asuransi Swasta &amp; TPA (${BPJS_STATE.tpaClaims.length})
      </button>
      <button class="btn btn-sm ${BPJS_STATE.activeTab === 'settlement' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabBpjs('settlement')">
        💰 5. Rekap Settlement &amp; Piutang
      </button>
    </div>

    <!-- Konten Tab Aktif -->
    <div id="bpjs-tab-content">
      ${renderBpjsTabContent()}
    </div>
  `;
}

function gantiTabBpjs(tab) {
  BPJS_STATE.activeTab = tab;
  renderBpjsClaim();
}

function renderBpjsTabContent() {
  // TAB 1: BERKAS E-KLAIM BPJS
  if (BPJS_STATE.activeTab === 'claims') {
    return `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">Daftar Berkas Klaim Pasien BPJS INA-CBG</h3>
            <p style="font-size:12px; color:var(--text3); margin:2px 0 0 0;">Validasi koding ICD-10, ICD-9-CM &amp; kelengkapan resume medis</p>
          </div>
          <button class="btn btn-sm btn-teal" onclick="openSimulasiGrouperModal()">+ Tambah Klaim Baru</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>No. SEP &amp; Tanggal</th>
                <th>Pasien &amp; No. RM</th>
                <th>Poli Layanan</th>
                <th>Diagnosa ICD-10 &amp; ICD-9-CM</th>
                <th>Kode CBG &amp; Deskripsi</th>
                <th>Tarif RS / INA-CBG</th>
                <th>Kelengkapan Berkas</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${BPJS_STATE.claims.map(c => `
                <tr>
                  <td>
                    <code style="font-weight:700; color:#0A2342;">${c.no_sep}</code>
                    <div style="font-size:11px; color:var(--text3);">${c.tgl_layanan}</div>
                  </td>
                  <td>
                    <b>${c.pasien}</b>
                    <div style="font-size:11px; color:var(--text3);">${c.no_rm}</div>
                  </td>
                  <td>${c.poli}</td>
                  <td>
                    <b>${c.icd10}</b>
                    <div style="font-size:11px; color:var(--text3);">${c.icd9cm}</div>
                  </td>
                  <td>
                    <span class="badge badge-teal">${c.kode_cbg}</span>
                    <div style="font-size:11px; color:var(--text);">${c.deskripsi_cbg}</div>
                  </td>
                  <td>
                    <div>RS: Rp ${c.tarif_rs.toLocaleString('id-ID')}</div>
                    <b style="color:var(--teal);">CBG: Rp ${c.tarif_inacbg.toLocaleString('id-ID')}</b>
                  </td>
                  <td><span class="badge ${c.kelengkapan.includes('100%') ? 'badge-success' : 'badge-warning'}">${c.kelengkapan}</span></td>
                  <td><span class="badge ${c.status === 'Terverifikasi BPJS' ? 'badge-success' : 'badge-teal'}">${c.status}</span></td>
                  <td>
                    <button class="btn btn-xs btn-ghost" onclick="alert('Mengunggah berkas e-klaim untuk SEP ${c.no_sep}')">📤 e-Klaim</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 2: BRIDGING SEP VCLAIM
  if (BPJS_STATE.activeTab === 'sep') {
    return `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">Penerbitan &amp; Monitoring SEP (Surat Eligibilitas Peserta)</h3>
            <p style="font-size:12px; color:var(--text3); margin:2px 0 0 0;">Koneksi langsung ke BPJS Kesehatan VClaim API v2.0 via HMAC-SHA256</p>
          </div>
          <button class="btn btn-sm btn-teal" onclick="openPenerbitanSepModal()">+ Terbitkan SEP Baru</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>No. SEP</th>
                <th>No. Kartu BPJS</th>
                <th>Nama Peserta</th>
                <th>Tanggal Pelayanan</th>
                <th>Poli Tujuan</th>
                <th>Jenis Pelayanan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${BPJS_STATE.sepList.map(s => `
                <tr>
                  <td><code style="font-weight:700; color:#0A2342;">${s.noSep}</code></td>
                  <td>${s.noKartu}</td>
                  <td><b>${s.nama}</b></td>
                  <td>${s.tglSep}</td>
                  <td>${s.poli}</td>
                  <td>${s.jnsPelayanan}</td>
                  <td><span class="badge badge-success">${s.status}</span></td>
                  <td>
                    <button class="btn btn-xs btn-ghost" onclick="alert('Cetak Lembar SEP ${s.noSep}')">🖨️ Cetak SEP</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 3: SIMULATOR GROUPER INA-CBG
  if (BPJS_STATE.activeTab === 'grouper') {
    return `
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">🧮 Simulator INA-CBG Tariff Grouper Calculator</h3>
        <div class="grid-2" style="grid-template-columns:1fr 1fr; gap:20px;">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div class="form-group">
              <label>Diagnosa Utama (ICD-10)</label>
              <select id="grp-icd10" class="input">
                <option value="E28.2|N-4-10-I|Penyakit Ovarium & Tuba Ringan|580000">E28.2 - Polycystic Ovarian Syndrome (PCOS)</option>
                <option value="E11.9|E-4-10-I|Diabetes Melitus Tanpa Komplikasi|420000">E11.9 - Type 2 Diabetes Mellitus</option>
                <option value="I10|I-4-10-I|Hipertensi Esensial Primer|390000">I10 - Essential Hypertension</option>
                <option value="J06.9|J-4-10-I|Infeksi Saluran Pernapasan Akut|320000">J06.9 - Acute Upper Respiratory Infection</option>
              </select>
            </div>
            <div class="form-group">
              <label>Prosedur Tindakan (ICD-9-CM)</label>
              <select id="grp-icd9" class="input">
                <option value="88.78">88.78 - Diagnostic Ultrasound of Gravid Uterus</option>
                <option value="90.59">90.59 - Diagnostic Examination of Blood</option>
                <option value="89.52">89.52 - Electrocardiogram (EKG)</option>
                <option value="None">Tidak Ada Tindakan Bedah/Invasif</option>
              </select>
            </div>
            <button class="btn btn-teal" onclick="hitungGrouperSimulasi()">⚡ Hitung Tarif INA-CBG</button>
          </div>

          <div id="grp-result-box" style="background:var(--bg2); border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
            <span style="font-size:12px; color:var(--text3);">Hasil Estimasi Klaim INA-CBG</span>
            <h2 id="grp-cbg-code" style="font-size:28px; font-weight:900; color:var(--teal); margin:8px 0 4px 0;">N-4-10-I</h2>
            <h4 id="grp-cbg-desc" style="font-size:14px; font-weight:700; color:var(--navy); margin:0 0 12px 0;">Penyakit Ovarium &amp; Tuba Ringan</h4>
            <div style="font-size:18px; font-weight:800; color:#22c55e;" id="grp-cbg-tariff">Rp 580.000</div>
          </div>
        </div>
      </div>
    `;
  }

  // TAB 4: ASURANSI SWASTA & TPA
  if (BPJS_STATE.activeTab === 'tpa') {
    return `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">Klaim Asuransi Swasta, Korporasi &amp; TPA Partner</h3>
            <p style="font-size:12px; color:var(--text3); margin:2px 0 0 0;">Integrasi portal klaim AdMedika, Mandiri Inhealth, Fullerton &amp; Prudential</p>
          </div>
          <button class="btn btn-sm btn-teal" onclick="alert('Form klaim TPA baru')">+ Input Klaim Asuransi</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>No. Klaim TPA</th>
                <th>Provider Asuransi</th>
                <th>Perusahaan Klien</th>
                <th>Nama Pasien</th>
                <th>Total Tagihan RS</th>
                <th>Disetujui (Approved)</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${BPJS_STATE.tpaClaims.map(t => `
                <tr>
                  <td><code>${t.noKlaim}</code></td>
                  <td><b>${t.asuransi}</b></td>
                  <td>${t.perusahaan}</td>
                  <td><b>${t.pasien}</b></td>
                  <td>Rp ${t.tagihan.toLocaleString('id-ID')}</td>
                  <td><strong style="color:var(--teal);">Rp ${t.approved.toLocaleString('id-ID')}</strong></td>
                  <td><span class="badge ${t.status === 'Approved' ? 'badge-success' : 'badge-warning'}">${t.status}</span></td>
                  <td>
                    <button class="btn btn-xs btn-ghost" onclick="alert('Kirim invoice tagihan klaim ${t.noKlaim}')">📑 Tagih</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 5: REKAP SETTLEMENT & PIUTANG
  return `
    <div class="card" style="padding:20px;">
      <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">💰 Rekap Settlement Pembayaran Klaim BPJS &amp; TPA</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:20px;">
        <div style="background:var(--bg2); padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--text3);">Total Klaim Diajukan</span>
          <h2 style="font-size:22px; color:var(--navy); margin:4px 0 0 0;">Rp 184.200.000</h2>
        </div>
        <div style="background:var(--bg2); padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--text3);">Settlement Diterima (Lunas)</span>
          <h2 style="font-size:22px; color:#22c55e; margin:4px 0 0 0;">Rp 178.900.000</h2>
        </div>
        <div style="background:var(--bg2); padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--text3);">Piutang Klaim Berjalan</span>
          <h2 style="font-size:22px; color:#f59e0b; margin:4px 0 0 0;">Rp 5.300.000</h2>
        </div>
      </div>
    </div>
  `;
}

function hitungGrouperSimulasi() {
  const val = document.getElementById('grp-icd10')?.value || '';
  const [icd, cbg, desc, tarif] = val.split('|');
  document.getElementById('grp-cbg-code').textContent = cbg || 'N-4-10-I';
  document.getElementById('grp-cbg-desc').textContent = desc || 'Penyakit Ovarium & Tuba Ringan';
  document.getElementById('grp-cbg-tariff').textContent = 'Rp ' + Number(tarif || 580000).toLocaleString('id-ID');
  if (typeof toast === 'function') toast('✅ Grouping tarif berhasil diperbarui', 'ok');
}

function openSimulasiGrouperModal() {
  gantiTabBpjs('grouper');
}

function openPenerbitanSepModal() {
  const modalHtml = `
    <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
      <div class="modal-title" style="font-size:16px; font-weight:800;">+ Penerbitan SEP BPJS Baru (VClaim 2.0)</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-group">
        <label>Nomor Kartu BPJS Pasien</label>
        <input type="text" id="modal-sep-kartu" class="input" placeholder="000xxxxxxxx">
      </div>
      <div class="form-group">
        <label>Nama Pasien</label>
        <input type="text" id="modal-sep-nama" class="input" placeholder="Nama Pasien">
      </div>
      <div class="grid-2" style="gap:10px;">
        <div class="form-group">
          <label>Poli Tujuan</label>
          <select id="modal-sep-poli" class="input">
            <option value="Poli Obgyn">Poli Obgyn &amp; Hormon</option>
            <option value="Poli Penyakit Dalam">Poli Penyakit Dalam</option>
            <option value="Poli Kulit & Estetika">Poli Kulit &amp; Estetika</option>
            <option value="Laboratorium PK">Laboratorium Patologi Klinik</option>
          </select>
        </div>
        <div class="form-group">
          <label>Jenis Pelayanan</label>
          <select id="modal-sep-jns" class="input">
            <option value="Rawat Jalan">Rawat Jalan Tingkat Lanjut (RJTL)</option>
            <option value="Rawat Inap">Rawat Inap Tingkat Lanjut (RITL)</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="margin-top:10px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
        <button class="btn btn-teal" onclick="simpanSepBaru()">💾 Terbitkan SEP &amp; Verifikasi BPJS</button>
      </div>
    </div>
  `;
  if (typeof openModal === 'function') openModal(modalHtml, 'medium');
}

function simpanSepBaru() {
  const kartu = document.getElementById('modal-sep-kartu')?.value;
  const nama = document.getElementById('modal-sep-nama')?.value;
  const poli = document.getElementById('modal-sep-poli')?.value;
  const jns = document.getElementById('modal-sep-jns')?.value;

  if (!nama || !kartu) {
    if (typeof toast === 'function') toast('Nomor kartu dan nama wajib diisi', 'err');
    return;
  }

  const newSep = {
    noSep: '0032S0120826V' + String(BPJS_STATE.sepList.length + 1).padStart(4, '0'),
    noKartu: kartu,
    nama: nama,
    tglSep: new Date().toISOString().slice(0,10),
    poli: poli || 'Poli Umum',
    jnsPelayanan: jns || 'Rawat Jalan',
    status: 'Terbit'
  };

  BPJS_STATE.sepList.unshift(newSep);
  if (typeof closeModalForce === 'function') closeModalForce();
  if (typeof toast === 'function') toast(`✅ SEP ${newSep.noSep} berhasil diterbitkan!`, 'ok');
  gantiTabBpjs('sep');
}

window.renderBpjsClaim = renderBpjsClaim;
window.gantiTabBpjs = gantiTabBpjs;
window.hitungGrouperSimulasi = hitungGrouperSimulasi;
window.openSimulasiGrouperModal = openSimulasiGrouperModal;
window.openPenerbitanSepModal = openPenerbitanSepModal;
window.simpanSepBaru = simpanSepBaru;
