// Resolve Playwright from an explicit override, local install, or the bundled Codex workspace runtime.
const path = require('node:path');

const candidates = [
  process.env.PLAYWRIGHT_MODULE,
  'playwright',
  path.join(process.env.USERPROFILE || process.env.HOME || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'),
].filter(Boolean);

let lastError;
for (const candidate of candidates) {
  try { module.exports = require(candidate); return; } catch (error) { lastError = error; }
}

throw new Error(`Playwright tidak ditemukan. Instal dependency atau set PLAYWRIGHT_MODULE. ${lastError?.message || ''}`);
