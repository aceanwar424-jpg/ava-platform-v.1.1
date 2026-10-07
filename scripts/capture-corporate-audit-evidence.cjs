const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('./lib/playwright.cjs');

(async () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appsRoot = path.join(repoRoot, 'ava-platform', 'apps');
  const evidenceDir = path.join(repoRoot, 'docs', 'audit-evidence', '2026-10-06');
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

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

  await new Promise(resolve => server.listen(8093, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

  await page.goto('http://127.0.0.1:8093/apps/index.html', { waitUntil: 'networkidle' });

  // Switch to dashboard screen
  await page.evaluate(() => {
    window.showScreen('dashboard-screen');
  });
  await page.waitForTimeout(300);

  // 1. Screenshot: Personal User linked to AHM with Attention Banner + Basic Menus
  await page.evaluate(() => {
    window.linkCorporateToPersonal('PT Astra Honda Motor (AHM)', 'AHM-9902-ENG');
    window.showView('patient-view');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidenceDir, 'corp-linked-attention-spotlight.png') });
  console.log('Saved: corp-linked-attention-spotlight.png');

  // 2. Screenshot: Corporate Assigned Programs View
  await page.evaluate(() => window.showView('corporate-assigned-program-view'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidenceDir, 'corp-assigned-programs-portal.png') });
  console.log('Saved: corp-assigned-programs-portal.png');

  // 3. Screenshot: Ambient Clinical Scribe (Speech-to-SOAP)
  await page.evaluate(() => {
    window.showView('ava-ambient-scribe-view');
    window.toggleAmbientScribeRecording();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidenceDir, 'ambient-scribe-live-soap.png') });
  console.log('Saved: ambient-scribe-live-soap.png');

  // 4. Screenshot: Referral Catalog with LOINC/UCUM
  await page.evaluate(() => window.showView('referral-catalog-view'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidenceDir, 'referral-catalog-loinc.png') });
  console.log('Saved: referral-catalog-loinc.png');

  // Clean up localStorage
  await page.evaluate(() => {
    localStorage.removeItem('AVA_LINKED_CORP_NAME');
    localStorage.removeItem('AVA_LINKED_CORP_NIP');
  });

  await browser.close();
  server.close();
  console.log('Finished capturing all evidence screenshots with active dashboard-screen!');
  process.exit(0);
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
