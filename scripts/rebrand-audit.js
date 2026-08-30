const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TARGET_EXTS = ['.html', '.js', '.ts', '.tsx', '.json', '.sql', '.css'];
const EXCLUDE_DIRS = ['node_modules', '.git', '_karantina_20260815', '_arsip_dokumen_lama'];

const REPLACEMENTS = [
  { from: /Administrator AVA GLOBAL ECOSYSTEM/g, to: 'Administrator AVA GLOBAL ECOSYSTEM' },
  { from: /performa AVA GLOBAL ECOSYSTEM/g, to: 'performa AVA GLOBAL ECOSYSTEM' },
  { from: /AVA GLOBAL ECOSYSTEM/g, to: 'AVA GLOBAL ECOSYSTEM' },
  { from: /<div class="logo-mark">OL<\/div>/g, to: '<img src="css/logo-ava-global.png" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:1.5px solid #d4af37;box-shadow:0 0 8px rgba(212,175,55,0.4);" alt="AVA Logo">' },
  { from: /<span style="color:var\(--text3\);font-weight:500;font-size:12px">AVA<\/span>/g, to: '<span style="color:var(--text3);font-weight:500;font-size:12px">AVA GLOBAL ECOSYSTEM</span>' },
  { from: /data-tooltip="Wiki AVA Ecosystem"/g, to: 'data-tooltip="Wiki AVA Ecosystem"' },
  { from: /label:\s*'Wiki AVA'/g, to: "label: 'Wiki AVA Ecosystem'" }
];

let modifiedCount = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_DIRS.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TARGET_EXTS.includes(ext)) {
        processFile(fullPath);
      }
    }
  }
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const r of REPLACEMENTS) {
      if (r.from.test(content)) {
        content = content.replace(r.from, r.to);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[UPDATED] ${path.relative(ROOT, filePath)}`);
      modifiedCount++;
    }
  } catch (err) {
    console.error(`[ERROR] ${filePath}:`, err.message);
  }
}

console.log('Starting full rebrand audit across codebase...');
scanDir(ROOT);
console.log(`Audit complete. Modified ${modifiedCount} files.`);
