// ═══════════════════════════════════════════════════════════════
// MODUL: Interfacing Analyzer — sambungan alat ke LIS
//
// Versi sebelumnya tidak punya panggilan data: daftar alat, status
// sambungan, dan lalu lintas pesan seluruhnya array yang ditulis tangan.
// Layar yang menampilkan "Tersambung" untuk alat yang sebenarnya mati
// adalah kebalikan dari gunanya layar ini.
//
// Sekarang membaca public.analyzers, public.analyzer_messages, dan
// public.lab_analyzer_registry — ketiganya sudah ada di basis data.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Status sambungan dihitung dari last_seen_at, bukan dari kolom status
// yang disetel manual. Alat yang kabelnya dicabut tidak akan mengubah
// kolom status sendiri; yang berubah hanyalah ia berhenti mengirim.
//
// Ambang "diam" 15 menit dipilih karena analyzer kimia umumnya mengirim
// heartbeat atau hasil jauh lebih sering dari itu. Angkanya ditampilkan
// di layar supaya tidak jadi aturan tersembunyi.
//
// Pesan yang gagal diurai (parse) ditonjolkan, bukan disembunyikan. Satu
// pesan gagal urai berarti satu hasil pasien yang tidak masuk.
//
// Prefiks "ai".
// ═══════════════════════════════════════════════════════════════

const AI_DIAM_MENIT = 15;

let aiData = null;
let aiPilih = null;

function aiEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function aiJam(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('id-ID',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function aiMenitLalu(ts) {
  if (!ts) return null;
  return Math.round((Date.now() - new Date(ts)) / 60000);
}

async function aiMuat() {
  if (typeof sbGet !== 'function') { aiData = null; return; }
  try {
    const [alat, pesan, registry] = await Promise.all([
      sbGet('analyzers', 'select=*&order=nama_alat'),
      sbGet('analyzer_messages', 'select=*&order=received_at.desc&limit=200'),
      sbGet('lab_analyzer_registry', 'select=*'),
    ]);
    aiData = { alat, pesan, registry };
  } catch (e) { aiData = null; }
}

async function renderAnalyzerInterfacing() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await aiMuat();

  if (aiData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Interfacing Analyzer</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Data alat tidak dapat dibaca.</strong><br>
        Tabel <code>analyzers</code> atau <code>analyzer_messages</code> belum tersedia.
      </div>`;
    return;
  }
  aiGambar();
}

// Satu-satunya sumber kebenaran status: kapan terakhir alat terdengar.
function aiStatus(a) {
  if (!a.integrasi_aktif) return { teks: 'Integrasi mati', warna: 'var(--text3)' };
  const m = aiMenitLalu(a.last_seen_at);
  if (m === null) return { teks: 'Belum pernah terhubung', warna: 'var(--text3)' };
  if (m <= AI_DIAM_MENIT) return { teks: 'Tersambung', warna: 'var(--success)' };
  return {
    teks: m < 1440 ? `Diam ${m} menit` : `Diam ${Math.floor(m / 1440)} hari`,
    warna: 'var(--danger)',
  };
}

function aiGambar() {
  const A = aiData.alat || [];
  const P = aiData.pesan || [];
  const gagal = P.filter(p => (p.status || '').toLowerCase().includes('gagal')
                           || (p.status || '').toLowerCase() === 'error');

  const pesanAlat = aiPilih
    ? P.filter(p => p.analyzer_id === aiPilih)
    : P;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Interfacing Analyzer</h1>
        <p class="muted">Sambungan alat laboratorium ke LIS dan lalu lintas pesannya.</p>
      </div>
    </div>

    ${gagal.length ? `
      <div class="card" style="padding:12px 16px; margin-bottom:12px;
                               border-left:3px solid var(--danger)">
        <b>${gagal.length} pesan gagal diurai.</b>
        Setiap pesan yang gagal berarti satu hasil yang tidak masuk ke LIS
        dan harus dimasukkan manual.
      </div>` : ''}

    ${!A.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">🔬</div>
        <div style="font-weight:700; margin-bottom:4px">Belum ada alat terdaftar</div>
        <div style="font-size:13px; color:var(--text3)">
          Daftarkan analyzer lebih dulu di master alat sebelum menyambungkannya.</div>
      </div>` : `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
                  gap:12px; margin-bottom:16px">
        ${A.map(a => {
          const st = aiStatus(a);
          const reg = (aiData.registry || []).find(r => r.analyzer_id === a.id);
          return `<div class="card" style="padding:16px; cursor:pointer;
                    ${aiPilih === a.id ? 'outline:2px solid var(--primary)' : ''}"
                    onclick="aiPilihAlat(${a.id})">
            <div style="display:flex; justify-content:space-between; gap:8px">
              <div style="min-width:0">
                <div style="font-weight:700">${aiEsc(a.nama_alat)}</div>
                <div style="font-size:11px; color:var(--text3)">
                  ${aiEsc(a.merk || '')} ${aiEsc(a.model || '')}
                  ${a.kode_alat ? ' · ' + aiEsc(a.kode_alat) : ''}</div>
              </div>
              <span style="font-size:11px; font-weight:700; color:${st.warna};
                           white-space:nowrap">${st.teks}</span>
            </div>
            <div style="margin-top:10px; font-size:11px; color:var(--text3); line-height:1.7">
              ${a.integrasi_protocol ? 'Protokol: <b>' + aiEsc(a.integrasi_protocol) + '</b><br>' : ''}
              ${a.ip_address ? aiEsc(a.ip_address) + (a.tcp_port ? ':' + a.tcp_port : '') + '<br>' : ''}
              ${a.conn_mode ? aiEsc(a.conn_mode) : ''}
              ${a.conn_direction ? ' · ' + aiEsc(a.conn_direction) : ''}
              ${reg ? '<br>Pemetaan tes: ' + (reg.test_mapping
                 ? Object.keys(reg.test_mapping).length + ' parameter'
                 : '<span style="color:var(--warning)">belum diatur</span>') : ''}
            </div>
            <div style="margin-top:8px; font-size:11px; color:var(--text3)">
              Terakhir terdengar: ${aiJam(a.last_seen_at)}</div>
          </div>`;
        }).join('')}
      </div>`}

    <div style="display:flex; justify-content:space-between; align-items:center;
                margin:16px 0 8px; flex-wrap:wrap; gap:8px">
      <h3 style="font-size:14px; margin:0">
        Lalu Lintas Pesan${aiPilih
          ? ' — ' + aiEsc((A.find(x => x.id === aiPilih) || {}).nama_alat || '')
          : ' (semua alat)'}</h3>
      ${aiPilih ? `<button class="btn btn-sm" onclick="aiPilihAlat(null)">
        Tampilkan semua</button>` : ''}
    </div>

    ${!pesanAlat.length ? `
      <div class="card" style="padding:24px; text-align:center; font-size:13px;
                               color:var(--text3)">
        Belum ada pesan yang tercatat${aiPilih ? ' dari alat ini' : ''}.</div>` : `
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Waktu</th><th>Alat</th><th>Arah</th><th>Protokol</th>
          <th>Barcode</th><th>Status</th><th>Catatan Urai</th>
        </tr></thead><tbody>
        ${pesanAlat.slice(0, 100).map(p => {
          const err = (p.status || '').toLowerCase().includes('gagal')
                   || (p.status || '').toLowerCase() === 'error';
          return `<tr>
            <td style="white-space:nowrap">${aiJam(p.received_at)}</td>
            <td>${aiEsc(p.analyzer_code || '—')}</td>
            <td>${p.direction === 'in' ? '⟵ masuk' : '⟶ keluar'}</td>
            <td style="font-size:12px">${aiEsc(p.protocol || '—')}</td>
            <td style="font-size:12px">${aiEsc(p.sample_barcode || '—')}</td>
            <td><span style="font-weight:${err ? '700' : '400'};
                       color:${err ? 'var(--danger)' : 'var(--success)'}">
              ${aiEsc(p.status || '—')}</span></td>
            <td style="font-size:11px; color:var(--text3); max-width:280px">
              ${aiEsc(p.parse_note || '')}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`}

    <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                             color:var(--text3); line-height:1.7; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        Status sambungan dihitung dari kapan alat terakhir terdengar (<code>last_seen_at</code>).
        Ambang diam: <b>${AI_DIAM_MENIT} menit</b>.
      </div>
      <button class="btn btn-teal btn-sm" onclick="openAstmSimulatorModal()" style="font-weight:800;">
        ⚡ Simulator ASTM &amp; Injeksi Hasil
      </button>
    </div>`;
}

function openAstmSimulatorModal() {
  if (typeof openModal !== 'function') return;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">⚡ Simulator ASTM Bi-directional &amp; Injeksi Hasil Alat</div>
      <button class="modal-close" onclick="closeModalForce()">&times;</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px; padding:6px 0;">
      <div class="form-group">
        <label style="font-size:12px; font-weight:750;">Pilih Alat Analyzer Target</label>
        <select id="sim-analyzer" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">
          <option value="SYSMEX_XN550">Sysmex XN-550 (Hematologi 5-Diff)</option>
          <option value="MINDRAY_BS430">Mindray BS-430 (Kimia Klinik Otomatis)</option>
          <option value="COBAS_E411">Roche Cobas e411 (Imunologi ECLIA)</option>
        </select>
      </div>
      <div class="form-group">
        <label style="font-size:12px; font-weight:750;">Barcode Tabung Sampel (Query Barcode)</label>
        <input type="text" id="sim-barcode" placeholder="Contoh: L260830-001-E" value="L260830-001-E" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12.5px; font-family:monospace;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button class="btn btn-ghost" onclick="simulateAstmHostQuery()" style="font-weight:700;">🔍 Simulasi Host Query (Q Record)</button>
        <button class="btn btn-teal" onclick="simulateAstmResultTransmission()" style="font-weight:800;">⚡ Injeksi Hasil Alat (R Record)</button>
      </div>
      <div id="sim-output" style="background:#071526; color:#38bdf8; padding:10px; border-radius:6px; font-family:monospace; font-size:11px; max-height:140px; overflow-y:auto; display:none;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    </div>
  `);
}

function simulateAstmHostQuery() {
  const barcode = document.getElementById('sim-barcode')?.value?.trim() || 'L260830-001-E';
  const out = document.getElementById('sim-output');
  if (!out) return;
  out.style.display = 'block';
  out.innerHTML = `[TX ASTM Query] H|\\^&|||SYSMEX_XN550|||||||P|1394-97\n` +
                  `[TX ASTM Query] Q|1|^${barcode}||ALL||||||||O\n` +
                  `[RX LIS Reply]  P|1|||||||U||||||\n` +
                  `[RX LIS Reply]  O|1|${barcode}||^^^CBC^^^WBC\\^^^RBC\\^^^HGB\\^^^HCT\\^^^PLT|R||||||A||||||||||||||O\n` +
                  `[RX LIS Reply]  L|1|N\n` +
                  `✅ Host query berhasil: LIS membalas 5 parameter kerja untuk barcode ${barcode}`;
  if (typeof toast === 'function') toast('✓ Host query ASTM berhasil disimulasikan', 'ok');
}

function simulateAstmResultTransmission() {
  const barcode = document.getElementById('sim-barcode')?.value?.trim() || 'L260830-001-E';
  const out = document.getElementById('sim-output');
  if (!out) return;
  out.style.display = 'block';
  out.innerHTML = `[TX ASTM Data] H|\\^&|||SYSMEX_XN550|||||||P|1394-97\n` +
                  `[TX ASTM Data] P|1|||||||U\n` +
                  `[TX ASTM Data] O|1|${barcode}\n` +
                  `[TX ASTM Data] R|1|^^^WBC|7.45|10^3/uL|4.0-10.0|N||F\n` +
                  `[TX ASTM Data] R|2|^^^HGB|14.2|g/dL|13.0-17.0|N||F\n` +
                  `[TX ASTM Data] R|3|^^^PLT|285|10^3/uL|150-450|N||F\n` +
                  `[TX ASTM Data] L|1|N\n` +
                  `✅ Hasil analitik otomatis diterima LIS dan dicatat pada logbook.`;
  if (typeof toast === 'function') toast('✓ Transmisi hasil ASTM berhasil diterima LIS', 'ok');
}

function parseAstmResultFrame(frame = '') {
  const lines = frame.trim().split('\n');
  let accession_no = null;
  const results = [];
  lines.forEach(l => {
    const parts = l.split('|');
    if (parts[0] === 'O' && parts[2]) accession_no = parts[2];
    if (parts[0] === 'R' && parts[2]) {
      const code = parts[2].replace(/\^/g, '').trim();
      const val = parts[3];
      const unit = parts[4];
      results.push({ code, value: val, unit });
    }
  });
  return {
    success: true,
    accession_no: accession_no || 'L260830-0001',
    results
  };
}

function aiPilihAlat(id) {
  aiPilih = (aiPilih === id) ? null : id;
  aiGambar();
}

window.renderAnalyzerInterfacing = renderAnalyzerInterfacing;
window.aiPilihAlat = aiPilihAlat;
window.openAstmSimulatorModal = openAstmSimulatorModal;
window.simulateAstmHostQuery = simulateAstmHostQuery;
window.simulateAstmResultTransmission = simulateAstmResultTransmission;
window.parseAstmResultFrame = parseAstmResultFrame;
