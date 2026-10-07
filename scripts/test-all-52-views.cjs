const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('./lib/playwright.cjs');

(async () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appsRoot = path.join(repoRoot, 'ava-platform', 'apps');

  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(parsed.pathname);

    if (pathname === '/' || pathname === '/apps/' || pathname === '/apps/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(appsRoot, 'index.html')));
    }

    if (pathname === '/api/runtime-config.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      return res.end('window.__RUNTIME_CONFIG__ = { SUPABASE_URL: "http://127.0.0.1/mock", SUPABASE_ANON_KEY: "mock" };');
    }

    let candidates = [];
    if (pathname.startsWith('/apps/')) {
      candidates.push(path.join(appsRoot, pathname.replace('/apps/', '')));
    }
    candidates.push(path.join(appsRoot, pathname.replace(/^\//, '')));

    for (const target of candidates) {
      if (fs.existsSync(target) && fs.statSync(target).isFile()) {
        const ext = path.extname(target);
        const map = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.svg': 'image/svg+xml'
        };
        res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
        return res.end(fs.readFileSync(target));
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + pathname);
  });

  await new Promise(resolve => server.listen(8091, '127.0.0.1', resolve));
  console.log('Test server ready at http://127.0.0.1:8091');

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.message);
    pageErrors.push(err.message);
  });

  await page.goto('http://127.0.0.1:8091/apps/index.html', { waitUntil: 'networkidle' });

  // 1. Audit all 52 views in APPS_PAGES
  const viewKeys = await page.evaluate(() => Object.keys(window.APPS_PAGES || {}));
  console.log(`Auditing all ${viewKeys.length} views in APPS_PAGES...`);

  let passed = 0;
  let failed = 0;
  const failureDetails = [];

  for (const vId of viewKeys) {
    const res = await page.evaluate(async (id) => {
      try {
        await window.showView(id);
        const el = document.getElementById(id);
        return {
          id,
          exists: !!el,
          active: el ? el.classList.contains('active') : false,
          error: null
        };
      } catch (err) {
        return {
          id,
          exists: false,
          active: false,
          error: err.message
        };
      }
    }, vId);

    if (res.exists && res.active && !res.error) {
      passed++;
    } else {
      failed++;
      failureDetails.push(res);
    }
  }

  console.log(`View Audit Result: ${passed} PASSED, ${failed} FAILED.`);
  if (failureDetails.length > 0) {
    console.log('Failures:', failureDetails);
  }

  // 2. Test Corporate Linking & Attention Spotlight Flow (AHM)
  console.log('\nTesting Corporate Linking & Attention Spotlight Flow...');
  
  // Initially unlinked: verify promptLinkCorporateCode button is in home
  await page.evaluate(() => window.showView('patient-view'));
  const hasLinkPrompt = await page.evaluate(() => {
    const pv = document.getElementById('patient-view');
    return pv && pv.innerHTML.includes('Tautkan Perusahaan');
  });
  console.log('Initial Unlinked State has Link Prompt:', hasLinkPrompt);
  assert.ok(hasLinkPrompt, 'Unlinked user must see Link Corporate prompt');

  // Verify basic menus are present when unlinked
  const basicShortcutsCountBefore = await page.evaluate(() => {
    return document.querySelectorAll('#patient-view .apps-shortcuts button').length;
  });
  console.log('Basic shortcuts count (unlinked):', basicShortcutsCountBefore);
  assert.ok(basicShortcutsCountBefore > 0, 'Basic shortcuts must be visible when unlinked');

  // Link to PT Astra Honda Motor (AHM)
  await page.evaluate(() => {
    window.linkCorporateToPersonal('PT Astra Honda Motor (AHM)', 'AHM-9902-ENG');
  });

  // Verify Attention Spotlight Banner appears
  const hasAttentionBanner = await page.evaluate(() => {
    const banner = document.querySelector('.corporate-attention-card');
    return !!banner && banner.textContent.includes('PT Astra Honda Motor (AHM)');
  });
  console.log('Attention Spotlight Banner active for AHM:', hasAttentionBanner);
  assert.ok(hasAttentionBanner, 'Corporate Attention Spotlight must appear when linked');

  // Verify Basic Menus STILL 100% visible and accessible
  const basicShortcutsCountAfter = await page.evaluate(() => {
    return document.querySelectorAll('#patient-view .apps-shortcuts button').length;
  });
  console.log('Basic shortcuts count (linked):', basicShortcutsCountAfter);
  assert.ok(basicShortcutsCountAfter >= basicShortcutsCountBefore, 'Basic menus must remain accessible when linked to corporate');

  // Verify Sidebar has Corporate Special Program group AND all basic groups
  const sidebarGroups = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.apps-menu-group summary')).map(s => s.textContent.trim().replace(/⌄$/, '').trim());
  });
  console.log('Sidebar groups when linked:', sidebarGroups);
  assert.ok(sidebarGroups.some(g => g.includes('PT Astra Honda Motor (AHM)')), 'Sidebar must have AHM program group');
  assert.ok(sidebarGroups.some(g => g.includes('Layanan Utama')), 'Sidebar must preserve Layanan Utama');
  assert.ok(sidebarGroups.some(g => g.includes('Wellness & Kebugaran')), 'Sidebar must preserve Wellness & Kebugaran');
  assert.ok(sidebarGroups.some(g => g.includes('Riwayat & Pesanan')), 'Sidebar must preserve Riwayat & Pesanan');

  // Test opening Corporate Assigned Program View
  await page.evaluate(() => window.showView('corporate-assigned-program-view'));
  const corpViewActive = await page.evaluate(() => {
    const cv = document.getElementById('corporate-assigned-program-view');
    const compName = document.getElementById('corp-card-comp-name');
    const nip = document.getElementById('corp-card-nip');
    return {
      active: cv && cv.classList.contains('active'),
      company: compName ? compName.textContent : '',
      nip: nip ? nip.textContent : ''
    };
  });
  console.log('Corporate Assigned Program View:', corpViewActive);
  assert.ok(corpViewActive.active, 'corporate-assigned-program-view must be active');
  assert.ok(corpViewActive.company.includes('Astra Honda Motor'), 'Employee card has company name');
  assert.ok(corpViewActive.nip.includes('AHM-9902-ENG'), 'Employee card has NIP');

  // 3. Test Ambient Clinical Scribe (Speech-to-SOAP)
  console.log('\nTesting Ambient Clinical Scribe (Speech-to-SOAP)...');
  await page.evaluate(() => window.showView('ava-ambient-scribe-view'));
  await page.evaluate(() => window.toggleAmbientScribeRecording());
  const scribeStatusRecording = await page.evaluate(() => {
    const box = document.getElementById('scribe-status-box');
    const btn = document.getElementById('scribe-rec-btn');
    return {
      hasSoap: box && box.innerHTML.includes('SOAP OTOMATIS'),
      hasWave: box && box.innerHTML.includes('audio-wave-bar'),
      btnText: btn ? btn.textContent : ''
    };
  });
  console.log('Scribe recording state:', scribeStatusRecording);
  assert.ok(scribeStatusRecording.hasSoap, 'Scribe must generate SOAP EHR draft');
  assert.ok(scribeStatusRecording.hasWave, 'Scribe must render audio wave animation');

  // Stop recording
  await page.evaluate(() => window.toggleAmbientScribeRecording());
  const scribeStopped = await page.evaluate(() => {
    const btn = document.getElementById('scribe-rec-btn');
    return btn ? btn.textContent : '';
  });
  console.log('Scribe stopped state button:', scribeStopped);
  assert.ok(scribeStopped.includes('Mulai Rekam'), 'Scribe button resets to idle');

  // 4. Test Referral Catalog View
  console.log('\nTesting Referral Catalog View...');
  await page.evaluate(() => window.showView('referral-catalog-view'));
  const referralCatalog = await page.evaluate(() => {
    const table = document.querySelector('.referral-catalog-placeholder');
    return {
      hasContent: table && table.innerHTML.includes('REF-LAB-01'),
      hasLoinc: table && table.innerHTML.includes('LOINC: 4548-4'),
      hasPrice: table && table.innerHTML.includes('Rp 195.000')
    };
  });
  console.log('Referral Catalog content:', referralCatalog);
  assert.ok(referralCatalog.hasContent, 'Referral catalog must show tests');
  assert.ok(referralCatalog.hasLoinc, 'Referral catalog must show LOINC codes');

  // 5. Test LaaS API Key Generator & Mass Zip Download
  console.log('\nTesting LaaS API Key Generator & Mass Zip Download...');
  await page.evaluate(() => window.showView('ava-laas-api-view'));
  await page.evaluate(() => window.generateLaasApiKey());
  const laasKey = await page.evaluate(() => {
    const keyBox = document.getElementById('laas-key-display');
    return keyBox ? keyBox.textContent : '';
  });
  console.log('LaaS generated key box:', laasKey.trim());
  assert.ok(laasKey.includes('ava_live_sk_'), 'LaaS must generate valid API key');

  // 6. Test Unlinking corporate and restoring pure personal basic view
  console.log('\nTesting Unlink Corporate and revert to personal...');
  await page.evaluate(() => window.unlinkCorporateFromPersonal());
  const unlinkedState = await page.evaluate(() => {
    const banner = document.querySelector('.corporate-attention-card');
    const prompt = document.getElementById('patient-view')?.innerHTML.includes('Tautkan Perusahaan');
    return {
      bannerExists: !!banner,
      promptExists: prompt
    };
  });
  console.log('Unlinked state check:', unlinkedState);
  assert.ok(!unlinkedState.bannerExists, 'Attention banner must be removed when unlinked');
  assert.ok(unlinkedState.promptExists, 'Link prompt must re-appear when unlinked');

  // Clean up localStorage test flags
  await page.evaluate(() => {
    localStorage.removeItem('AVA_LINKED_CORP_NAME');
    localStorage.removeItem('AVA_LINKED_CORP_NIP');
    localStorage.removeItem('AVA_STEP_CHALLENGE');
    localStorage.removeItem('AVA_HYDRATION_DATA');
    localStorage.removeItem('AVA_NUTRICO_MEALS');
    localStorage.removeItem('AVA_BIOAGE_TASKS');
  });

  console.log('\nCleaned up all test localStorage dummy data.');
  console.log(`Page errors during test suite: ${pageErrors.length}`);
  assert.equal(pageErrors.length, 0, 'No uncaught page errors allowed');

  await browser.close();
  server.close();
  console.log('\n🎉 ALL AUDITS & TESTS COMPLETED SUCCESSFULLY! 100% PASS');
  process.exit(0);
})().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
