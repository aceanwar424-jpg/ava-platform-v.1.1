const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('./lib/playwright.cjs');

(async () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appsRoot = path.join(repoRoot, 'ava-platform', 'apps');
  const platformRoot = path.join(repoRoot, 'ava-platform');

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
    candidates.push(path.join(platformRoot, pathname.replace(/^\//, '')));
    candidates.push(path.join(repoRoot, pathname.replace(/^\//, '')));

    for (const c of candidates) {
      if (fs.existsSync(c) && !fs.statSync(c).isDirectory()) {
        const ext = path.extname(c);
        const mimeMap = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml'
        };
        res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
        return res.end(fs.readFileSync(c));
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + pathname);
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/apps/index.html`;
  console.log(`Test server running at ${baseUrl}`);

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  console.log('Navigating to:', baseUrl);
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  // Switch to dashboard screen
  await page.evaluate(() => {
    window.showScreen('dashboard-screen');
  });
  await page.waitForTimeout(300);

  const outDir = path.resolve(__dirname, '../artifacts/wellness');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. Verify Wellness Hub
  console.log('1. Testing Wellness Hub...');
  await page.evaluate(() => {
    window.showView('ava-wellness-hub-view', 'Wellness Hub');
  });
  await page.waitForTimeout(300);
  const hubClass = await page.$eval('#ava-wellness-hub-view', el => el.className);
  console.log('Wellness Hub class:', hubClass);
  assert(hubClass.includes('active'), 'Wellness hub should be active');
  await page.screenshot({ path: path.join(outDir, '01-wellness-hub.png'), fullPage: false });

  // 2. Test Step & Run Challenge View
  console.log('2. Testing Step & Run Challenge View...');
  await page.evaluate(() => {
    window.showView('wellness-run-challenge-view', 'Step & Run Challenge');
  });
  await page.waitForTimeout(300);

  const initialSteps = await page.$eval('#run-view-steps', el => el.textContent.trim());
  console.log('Initial steps:', initialSteps);

  // Click +1.000 steps button
  await page.evaluate(() => {
    window.simulateWearableAddSteps(1000);
  });
  await page.waitForTimeout(200);
  const updatedSteps1 = await page.$eval('#run-view-steps', el => el.textContent.trim());
  console.log('Steps after +1000:', updatedSteps1);
  assert.equal(updatedSteps1, '9.450');

  // Click +2.500 steps button
  await page.evaluate(() => {
    window.simulateWearableAddSteps(2500);
  });
  await page.waitForTimeout(200);
  const updatedSteps2 = await page.$eval('#run-view-steps', el => el.textContent.trim());
  console.log('Steps after +2500:', updatedSteps2);
  assert.equal(updatedSteps2, '11.950');

  // Test sync wearable device
  await page.evaluate(() => {
    window.syncWearableDevice('Garmin Connect');
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, '02-wellness-step-challenge.png'), fullPage: false });

  // 3. Test NutriCo Calorie & Diet Planner
  console.log('3. Testing NutriCo View...');
  await page.evaluate(() => {
    window.showView('wellness-nutrico-view', 'NutriCo Planner');
  });
  await page.waitForTimeout(300);

  const initialKcal = await page.$eval('#nutrico-total-kcal', el => el.textContent.trim());
  console.log('Initial NutriCo Kcal:', initialKcal);
  assert.equal(initialKcal, '1.420');

  // Click preset chip "+🥣 Oatmeal Chia (320 kcal)"
  await page.evaluate(() => {
    window.quickAddNutricoPreset('oat');
  });
  await page.waitForTimeout(200);
  const kcalAfterOat = await page.$eval('#nutrico-total-kcal', el => el.textContent.trim());
  console.log('NutriCo Kcal after adding Oatmeal Chia:', kcalAfterOat);
  assert.equal(kcalAfterOat, '1.740');

  // Test manual meal submit
  await page.evaluate(() => {
    document.getElementById('nutrico-input-name').value = 'Jus Alpukat Chia';
    document.getElementById('nutrico-input-kcal').value = '180';
    window.submitManualMeal();
  });
  await page.waitForTimeout(200);
  const kcalAfterManual = await page.$eval('#nutrico-total-kcal', el => el.textContent.trim());
  console.log('NutriCo Kcal after manual meal:', kcalAfterManual);
  assert.equal(kcalAfterManual, '1.920');

  // Test AI Food Scan simulation
  await page.evaluate(() => {
    window.simulateAiFoodScan();
  });
  await page.waitForTimeout(200);
  const kcalAfterAi = await page.$eval('#nutrico-total-kcal', el => el.textContent.trim());
  console.log('NutriCo Kcal after AI scan:', kcalAfterAi);
  assert(parseInt(kcalAfterAi.replace('.', '')) > 1920, 'Calories should increase after AI scan');

  await page.screenshot({ path: path.join(outDir, '03-wellness-nutrico.png'), fullPage: false });

  // 4. Test Hydration View
  console.log('4. Testing Hydration View...');
  await page.evaluate(() => {
    window.showView('wellness-hydration-view', 'Smart Hydration');
  });
  await page.waitForTimeout(300);

  const initialWater = await page.$eval('#water-log-val', el => el.textContent.trim());
  console.log('Initial Water:', initialWater);

  await page.evaluate(() => {
    window.addWaterIntake(350);
  });
  await page.waitForTimeout(200);
  const updatedWater1 = await page.$eval('#water-log-val', el => el.textContent.trim());
  console.log('Updated Water after +350ml:', updatedWater1);
  assert(updatedWater1.includes('2.450'));

  await page.evaluate(() => {
    window.addWaterIntake(500);
  });
  await page.waitForTimeout(200);
  const updatedWater2 = await page.$eval('#water-log-val', el => el.textContent.trim());
  console.log('Updated Water after +500ml:', updatedWater2);
  assert(updatedWater2.includes('2.950'));

  await page.screenshot({ path: path.join(outDir, '04-wellness-hydration.png'), fullPage: false });

  // 5. Test HRV & Guided Box Breathing
  console.log('5. Testing HRV & Guided Box Breathing...');
  await page.evaluate(() => {
    window.showView('wellness-hrv-stress-view', 'HRV & Stress Biofeedback');
  });
  await page.waitForTimeout(300);

  // Start breathing session
  await page.evaluate(() => {
    window.startGuidedBreathingSession();
  });
  await page.waitForTimeout(1100);

  const breathContainer = await page.$eval('#hrv-breath-container', el => el ? true : false);
  console.log('Breathing container active:', breathContainer);
  assert(breathContainer, 'Breathing container should be rendered');
  await page.screenshot({ path: path.join(outDir, '05-wellness-breathing.png'), fullPage: false });

  // Stop breathing
  await page.evaluate(() => {
    window.stopGuidedBreathing();
  });
  await page.waitForTimeout(200);

  // 6. Test Bio-Age Quest
  console.log('6. Testing Bio-Age Quest...');
  await page.evaluate(() => {
    window.showView('wellness-bioage-quest-view', 'Bio-Age Quest');
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.claimDailyBioageReward();
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, '06-wellness-bioage-quest.png'), fullPage: false });

  // 7. Test Mobile Responsiveness
  console.log('7. Testing Mobile Responsiveness (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    window.showView('wellness-run-challenge-view', 'Step & Run Challenge');
  });
  await page.waitForTimeout(300);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  console.log('Mobile no horizontal overflow:', overflow);
  assert(overflow, 'Page should not have horizontal document overflow on mobile');
  await page.screenshot({ path: path.join(outDir, '07-mobile-wellness-run.png'), fullPage: false });

  console.log('\n========================================');
  console.log('🎉 ALL WELLNESS AND APP FEATURES VERIFIED!');
  console.log('Console Errors:', consoleErrors.length);
  console.log('========================================');

  await browser.close();
  server.close();
})();
