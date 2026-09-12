const cp = require('child_process');

const tracked = cp.execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
const suspiciousNames = tracked.filter(file =>
  /(^|\/)(\.env(?!\.example)|.*\.(key|p12|pfx|sqlite|db))$/i.test(file) ||
  /(^|\/)(.*private.*\.pem)$/i.test(file));
const suspiciousContent = [];
for (const file of tracked.filter(file => /\.(js|cjs|mjs|ts|tsx|json|yml|yaml|sql|env)$/i.test(file))) {
  let text;
  try { text = require('fs').readFileSync(file, 'utf8'); } catch (_) { continue; }
  if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i.test(text) ||
      /service_role\s*[:=]\s*['"][^'"]{12,}/i.test(text)) suspiciousContent.push(file);
}
if (suspiciousNames.length || suspiciousContent.length) {
  console.error('Potential tracked secret material found.');
  for (const file of [...new Set([...suspiciousNames, ...suspiciousContent])]) console.error(`- ${file}`);
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed: ${tracked.length} tracked files inspected.`);
}
