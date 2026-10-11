/**
 * Comprehensive Audit Suite for lis.avahealth.sbs
 * Menguji seluruh aspek: Arsitektur Subdomain, Routing, 24 Modul LIS,
 * Kepatuhan ISO 15189:2022, CLSI, ASTM Connector, Nilai Kritis, dan Visual Render di Browser.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('./lib/playwright.cjs');
const { localRoute } = require('./qa-domain-readability.cjs');

async function runLisAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔬 AUDIT KOMPREHENSIF LIS.AVAHEALTH.SBS (SISTEM LABORATORIUM)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const report = {
    timestamp: new Date().toISOString(),
    subdomain: 'lis.avahealth.sbs',
    total_checks: 0,
    passed_checks: 0,
    failed_checks: 0,
    sections: {}
  };

  function check(sectionName, title, condition, details = '') {
    report.total_checks++;
    if (!report.sections[sectionName]) report.sections[sectionName] = [];
    
    if (condition) {
      report.passed_checks++;
      report.sections[sectionName].push({ title, status: 'PASS' });
      console.log(`  ✅ [PASS] ${title}`);
    } else {
      report.failed_checks++;
      report.sections[sectionName].push({ title, status: 'FAIL', details });
      console.error(`  ❌ [FAIL] ${title}: ${details}`);
    }
  }

  // ── 1. AUDIT KONFIGURASI SUBDOMAIN & ROUTING ──
  console.log('1. AUDIT ARSITEKTUR DOMAIN & SUBDOMAIN:');
  const domainConfig = JSON.parse(fs.readFileSync('config/domain.json', 'utf8'));
  const lisDomain = domainConfig.situs.find(s => s.kunci === 'lis');

  check('domain', 'Entri LIS terdefinisi di config/domain.json', !!lisDomain);
  check('domain', 'Host mencakup lis.avahealth.sbs dan lab.avahealth.sbs', 
    lisDomain.host.includes('lis.avahealth.sbs') && lisDomain.host.includes('lab.avahealth.sbs'));
  check('domain', 'Workspace terkonfigurasi kanonik ke "lis"', lisDomain.workspace === 'lis');
  check('domain', 'Halaman awal terarah ke "lab" (Penerimaan Sampel)', lisDomain.awal === 'lab');

  // ── 2. AUDIT KELENGKAPAN MENU & STRUKTUR NAVIGASI LIS ──
  console.log('\n2. AUDIT STRUKTUR MENU & KATEGORI LIS (config/menu.json):');
  const menuConfig = JSON.parse(fs.readFileSync('config/menu.json', 'utf8'));
  const lisRoom = menuConfig.ruang.lis;
  check('menu', 'Ruang LIS terdaftar di peta menu ruang kerja', !!lisRoom);
  check('menu', 'Kategori LIS mencakup ["lis", "mutu"]', 
    lisRoom.kategori.includes('lis') && lisRoom.kategori.includes('mutu'));

  const lisCategory = menuConfig.kategori.lis;
  const allLisMenus = (lisCategory.grup || []).flatMap(g => g.menu || []);
  check('menu', `Seluruh 24 menu LIS granular terdaftar (ditemukan: ${allLisMenus.length})`, allLisMenus.length >= 24);

  // Verifikasi setiap menu punya label, id, dan status
  const invalidMenus = allLisMenus.filter(m => !m.id || !m.label);
  check('menu', 'Seluruh menu LIS memiliki atribut id dan label valid', invalidMenus.length === 0);

  // ── 3. AUDIT KONTRAK INTEGRITAS DATA & ISO 15189:2022 ──
  console.log('\n3. AUDIT KONTRAK KLINIS & KEPATUHAN ISO 15189:2022:');

  // Mock global environment untuk evaluasi modul LIS
  global.window = global;
  global.localStorage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  };

  require('../ava-platform/modules/lab/phlebotomy.js');
  require('../ava-platform/modules/lab/specimenVerification.js');
  require('../ava-platform/modules/lab/analyzerInterfacing.js');
  require('../ava-platform/modules/lab/criticalValue.js');
  require('../ava-platform/modules/lab/pmeProficiency.js');
  require('../ava-platform/modules/lab/sampleArchiving.js');
  require('../ava-platform/modules/lab/lotVerification.js');
  require('../ava-platform/modules/lab/qcEngine.js');
  require('../ava-platform/modules/lab/autoverify.js');

  // 3a. Flebotomi & Sampling Pra-Analitik
  const phlebRes = window.recordPhlebotomySampling('SAMPLE-AUDIT-001', {
    officer: 'Siti Rahma, A.Md.AK',
    sampling_site: 'Vena Cephalica',
    notes: 'Sampling aman tanpa hematoma'
  });
  check('iso_pra_analitik', 'Pencatatan sampling flebotomi dengan nama nakes dan lokasi anatomi', 
    phlebRes.success === true && phlebRes.status === 'Selesai Sampling');

  // 3b. Kriteria Penolakan Spesimen (ISO 15189 Klausul 7.2.6)
  const rejectedHemolysis = window.evaluateSpecimenSuitability({
    accession_no: 'SAMPLE-AUDIT-002',
    hemolysis_grade: '3+',
    is_clotted: false
  });
  check('iso_pra_analitik', 'Kriteria penolakan: Spesimen hemolisis berat (3+) mutlak DITOLAK', 
    rejectedHemolysis.status === 'REJECTED_SPECIMEN' && !rejectedHemolysis.is_suitable);

  const rejectedClot = window.evaluateSpecimenSuitability({
    accession_no: 'SAMPLE-AUDIT-003',
    hemolysis_grade: 'NONE',
    is_clotted: true
  });
  check('iso_pra_analitik', 'Kriteria penolakan: Tabung EDTA dengan micro-clot mutlak DITOLAK', 
    rejectedClot.status === 'REJECTED_SPECIMEN' && !rejectedClot.is_suitable);

  // 3c. Deteksi Nilai Kritis & Mandatory Read-Back (ISO 15189 Klausul 7.4)
  const critK = window.checkCriticalValue('Kalium (K)', 6.8);
  check('iso_pasca_analitik', 'Deteksi otomatis nilai kritis Kalium 6.8 mmol/L (Hiperkalemia)', 
    critK.is_critical === true && critK.type === 'CRITICAL_HIGH');

  const critGlu = window.checkCriticalValue('Glukosa Sewaktu', 35);
  check('iso_pasca_analitik', 'Deteksi otomatis nilai kritis Glukosa 35 mg/dL (Hipoglikemia)', 
    critGlu.is_critical === true && critGlu.type === 'CRITICAL_LOW');

  const critLog = window.recordCriticalValueLog({
    accession_no: 'SAMPLE-AUDIT-004',
    parameter: 'Kalium',
    reported_to_doctor: 'dr. Sp.PK',
    caller_analyst: 'Siti Rahma',
    sla_minutes: 8,
    read_back_confirmed: true
  });
  check('iso_pasca_analitik', 'Pencatatan eskalasi nilai kritis SLA < 15 menit & konfirmasi read-back (TBaK)',
    critLog.success === true && critLog.is_sla_met === true && critLog.read_back_confirmed === true);

  // 3d. Evaluasi QC Westgard (ISO 15189 Klausul 7.3)
  const qcEngine = window.westgardQcEngine || require('../ava-platform/modules/lab/qcEngine.js');
  const westgardInvalid = qcEngine.evaluateWestgardRules('BUKAN_ANGKA', 100, 2);
  check('iso_kendali_mutu', 'QC Engine menolak nilai non-numerik dengan status INVALID', 
    westgardInvalid.status === 'INVALID');

  const westgard10x = qcEngine.evaluateWestgardRules(101.5, 100, 1, Array(9).fill(101.5));
  check('iso_kendali_mutu', 'Aturan Westgard 10x (10 pengukuran beruntun di 1 sisi mean) memicu REJECT', 
    westgard10x.status === 'REJECT' && westgard10x.triggeredRule === '10x');

  // 3e. Uji Profisiensi PME Z-Score
  const zSatisfactory = window.calculatePmeZScore(14.2, 14.0, 0.35);
  check('iso_pme', 'Kalkulasi Z-Score PME: |Z| <= 2 dievaluasi SATISFACTORY', 
    zSatisfactory.evaluation === 'SATISFACTORY');

  const zUnsatisfactory = window.calculatePmeZScore(16.5, 14.0, 0.35);
  check('iso_pme', 'Kalkulasi Z-Score PME: |Z| > 3 dievaluasi UNSATISFACTORY', 
    zUnsatisfactory.evaluation === 'UNSATISFACTORY');

  // 3f. Verifikasi Lot Reagen Baru (CLSI EP26-A)
  const lotVerification = window.evaluateLotToLotVerification({
    parameter: 'Glukosa',
    sample_pairs: [
      { old_val: 100, new_val: 101 },
      { old_val: 150, new_val: 151.5 },
      { old_val: 200, new_val: 202 }
    ],
    max_bias_pct: 5.0
  });
  check('clsi_reagen', 'Verifikasi Lot-to-Lot CLSI EP26-A: Rerata bias 1.0% (<=5%) DISETUJUI', 
    lotVerification.is_approved === true && lotVerification.mean_bias_pct <= 5.0);

  // 3g. Interfacing Alat ASTM E1381/E1394
  const astmRes = window.parseAstmResultFrame(
    "H|\\^&|||SYSMEX_XN550\r\nP|1|||||||U\r\nO|1|SAMPLE-AUDIT-ASTM\r\nR|1|^^^WBC|7.45|10^3/uL|4.0-10.0|N||F\r\nL|1|N"
  );
  check('astm_interfacing', 'Parsing frame transmisi hasil ASTM E1394 mengekstrak analit instrumen',
    astmRes.success === true && astmRes.accession_no === 'SAMPLE-AUDIT-ASTM' && astmRes.results.length === 1);

  // 3h. Pengarsipan Spesimen Freezer -20°C
  const arcRes = window.archiveSpecimen('SAMPLE-AUDIT-ARC', {
    freezer_id: 'FREEZER-MINUS20',
    rack_id: 'RACK-03',
    box_id: 'BOX-A',
    grid_position: 'B5'
  });
  const findArc = window.findArchivedSpecimen('SAMPLE-AUDIT-ARC');
  check('sample_archive', 'Pengarsipan spesimen ke freezer -20°C dengan koordinat rack/box/grid',
    arcRes.success === true && findArc.found === true && findArc.entry.grid_position === 'B5');

  // ── 4. AUDIT VISUAL HEADLESS BROWSER DI LIS.AVAHEALTH.SBS ──
  console.log('\n4. AUDIT INTERAKSI & RENDER BROWSER (https://lis.avahealth.sbs/):');
  
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  // Intercept permintaan ke lis.avahealth.sbs
  await page.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/' && u.hostname === 'lis.avahealth.sbs') {
      let h = fs.readFileSync('ava-platform/index.html', 'utf8')
        .replace("window.addEventListener('DOMContentLoaded', async () => {", 
                 "window.addEventListener('DOMContentLoaded', async () => { return; // fixture: bypass network login\n");
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: h });
    }
    return localRoute(route);
  });

  await page.goto('https://lis.avahealth.sbs/');

  // Injeksi state sesi terautentikasi analis & dokter lab
  await page.evaluate(() => {
    window.currentUser = {
      id: 'synthetic-analyst-uuid',
      profile: {
        id: 'synthetic-analyst-uuid',
        role: 'super_admin',
        tenant_id: 'synthetic-lab-tenant',
        full_name: 'Analis Mutu Senior, A.Md.AK'
      }
    };
    window.getUserRole = () => 'super_admin';
    window.getUserName = () => 'Analis Mutu Senior, A.Md.AK';
    window.sbGet = window.sbGetStrict = async () => [];
    window.sbRpc = async () => [];
    window.sbCount = async () => 0;
    window.sbPost = window.sbPatch = window.sbDelete = async () => { throw new Error('Fixture: write blocked'); };
    window.tsProbeConnector = async () => 'hidup';

    // Inisialisasi navigasi ruang LIS
    if (typeof susunMenu === 'function') susunMenu();
    if (typeof siapkanNavigasi === 'function') siapkanNavigasi('lis');
    if (typeof sesuaikanChromeRuangKerja === 'function') sesuaikanChromeRuangKerja('lis');
  });

  // Verifikasi deteksi ruang kerja LIS
  const workspaceState = await page.evaluate(() => ({
    bodyClass: document.body.className,
    brandTitle: document.getElementById('sidebar-brand-title')?.textContent || '',
    brandSub: document.getElementById('sidebar-brand-sub')?.textContent || '',
    brandTag: document.getElementById('sidebar-brand-tag')?.textContent || '',
    title: document.title
  }));

  check('browser', 'Body memuat class "lis-workspace-page"', workspaceState.bodyClass.includes('lis-workspace-page'));
  check('browser', 'Branding sidebar menampilkan "AVA LAB"', workspaceState.brandTitle.includes('AVA LAB'));
  check('browser', 'Tag branding menampilkan standar "ISO 15189:2022"', workspaceState.brandTag.includes('ISO 15189:2022'));
  check('browser', 'Document title terarah ke "AVA Lab — Laboratorium"', workspaceState.title.includes('AVA Lab'));

  // ── 5. UJI RENDER 29 RUTE LIS LENGKAP SECARA INTERAKTIF ──
  console.log('\n5. AUDIT RENDERING 29 MODUL LIS SECARA LIVE:');
  const routesToTest = [
    // 1. Pendaftaran & Sampel
    { id: 'lis-admission', label: 'Permintaan Pemeriksaan & Order Lab' },
    { id: 'lis-phlebotomy', label: 'Pengambilan Sampel (Flebotomi)' },
    { id: 'lab', label: 'Penerimaan Sampel (Check-in)' },
    { id: 'lis-kelayakan', label: 'Kelayakan & Penolakan Spesimen' },
    // 2. Konteks Klinis & Penunjang
    { id: 'lis-anamnesa', label: 'Anamnesis & Observasi Klinis' },
    { id: 'lis-audiometry', label: 'Audiometri (Penunjang)' },
    { id: 'lis-spirometry', label: 'Spirometri (Penunjang)' },
    { id: 'lis-supportive', label: 'EKG & Pemeriksaan Penunjang' },
    // 3. Pemeriksaan
    { id: 'worklist', label: 'Antrean Pemeriksaan Analyzer' },
    { id: 'lab-result', label: 'Input & Tinjau Hasil Lab' },
    { id: 'referral', label: 'Rujukan Laboratorium' },
    // 4. Validasi & Hasil
    { id: 'lis-critical-value', label: 'Pelaporan Nilai Kritis SLA' },
    { id: 'lab-validation', label: 'Verifikasi Teknis Analis' },
    { id: 'lab-approval', label: 'Otorisasi & Rilis Dokter Sp.PK' },
    { id: 'lab-tat', label: 'Kinerja & Waktu Tunggu (TAT)' },
    // 5. Mutu Laboratorium
    { id: 'lab-qc', label: 'Kendali Mutu Harian (QC Levey-Jennings)' },
    { id: 'lis-lot-verification', label: 'Verifikasi Lot Reagen' },
    { id: 'lis-pme', label: 'Uji Profisiensi (PME)' },
    // 6. Riwayat & Arsip
    { id: 'lab-report', label: 'Riwayat Hasil Kumulatif' },
    { id: 'lis-sample-archive', label: 'Manajemen Rak Freezer -20°C' },
    // 7. Katalog & Persediaan
    { id: 'product', label: 'Katalog Pemeriksaan LOINC/UCUM' },
    { id: 'package', label: 'Panel & Paket Pemeriksaan' },
    { id: 'refrange', label: 'Rentang Nilai Rujukan' },
    { id: 'inventory', label: 'Persediaan Reagen & Bahan' },
    { id: 'catalog-export', label: 'Ekspor Katalog Siap-LIS' },
    // 8. Pengaturan & Bantuan
    { id: 'lis-analyzer', label: 'Interfacing Alat ASTM :9999' },
    { id: 'lis-settings', label: 'Pengaturan Laboratorium' },
    { id: 'lis-helpdesk', label: 'Panduan & Bantuan LIS' },
    { id: 'lis-integration', label: 'Inbox Integrasi HIS-LIS' }
  ];

  let renderedModules = 0;
  for (const m of routesToTest) {
    const res = await page.evaluate(async (pageId) => {
      try {
        await window.navigate(pageId);
        await new Promise(r => setTimeout(r, 60));
        const main = document.getElementById('main-content');
        const text = main ? main.innerText.trim() : '';
        const hasError = text.includes('Gagal Memuat Modul') || text.includes('Halaman ini belum tersedia');
        return {
          id: pageId,
          hasMain: !!main,
          textLen: text.length,
          hasError,
          firstLine: text.split('\n')[0] || ''
        };
      } catch (err) {
        return { id: pageId, hasMain: false, hasError: true, err: err.message };
      }
    }, m.id);

    const isOk = res.hasMain && !res.hasError && res.textLen > 0;
    if (isOk) renderedModules++;
    check('module_render', `Render [${m.id}] ${m.label}`, isOk, res.err || 'Teks kosong atau error banner');
  }

  check('module_render', 'Seluruh 29 modul LIS berhasil ter-render tanpa error', renderedModules === routesToTest.length);
  check('module_render', 'Page error durante audit = 0', pageErrors.length === 0, pageErrors.join('; '));

  await browser.close();

  // Simpan Laporan Bukti Audit
  const outDir = 'docs/audit-evidence';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outReportPath = path.join(outDir, 'lis-subdomain-audit-report.json');
  fs.writeFileSync(outReportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 REKAPITULASI AUDIT LIS: ${report.passed_checks} DARI ${report.total_checks} UJI LULUS (${((report.passed_checks/report.total_checks)*100).toFixed(1)}%)`);
  console.log(`📁 File Bukti Audit Tersimpan: ${outReportPath}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (report.failed_checks > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLisAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
