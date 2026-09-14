#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const artifactRoot = path.resolve(process.argv[2] || 'desktop-app/release');
const forbiddenName = /\.(env|key|db|sqlite|bak|dump)$/i;
const forbiddenContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\s*[:=]\s*["']?[A-Za-z0-9._-]{24,}/i,
];

if (!fs.existsSync(artifactRoot)) {
  console.error(`Artifact directory not found: ${artifactRoot}`);
  console.error('Build an installer first, then rerun this gate.');
  process.exit(1);
}

const files = [];
function walk(current) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const resolved = path.join(current, entry.name);
    if (entry.isDirectory()) walk(resolved);
    else files.push(resolved);
  }
}
walk(artifactRoot);

const findings = [];
for (const file of files) {
  const relative = path.relative(artifactRoot, file);
  if (forbiddenName.test(path.basename(file)) ||
      (path.extname(file).toLowerCase() === '.pem' &&
       path.basename(file).toLowerCase() !== 'lisensi-publik.pem')) {
    findings.push(`${relative}: forbidden sensitive file extension`);
    continue;
  }

  const stat = fs.statSync(file);
  if (stat.size > 25 * 1024 * 1024) continue;
  const content = fs.readFileSync(file);
  const text = content.toString('utf8');
  for (const pattern of forbiddenContent) {
    if (pattern.test(text)) {
      findings.push(`${relative}: forbidden sensitive content (${pattern})`);
      break;
    }
  }
}

if (findings.length > 0) {
  console.error(`Desktop artifact scan failed: ${findings.length} finding(s).`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Desktop artifact scan passed: ${files.length} files inspected in ${artifactRoot}.`);
