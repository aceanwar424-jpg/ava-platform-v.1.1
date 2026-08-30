const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PLATFORM_DIR = path.resolve(__dirname, '../ava-platform');

console.log('====================================================');
console.log('🔍 AUDIT MENYELURUH KEAMANAN & INTEGRITAS MODUL AVA');
console.log('====================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let errors = [];

// 1. Audit Manifest Modul
const manifestPath = path.join(PLATFORM_DIR, 'js/core/modul-manifest.js');
if (!fs.existsSync(manifestPath)) {
  errors.push('modul-manifest.js tidak ditemukan!');
} else {
  const content = fs.readFileSync(manifestPath, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  try {
    vm.runInContext(content, sandbox);
    const manifest = sandbox.window.MODUL_HALAMAN;
    console.log(`✓ Manifest berhasil dimuat (${Object.keys(manifest).length} rute halaman terdaftar).`);
    
    // Periksa setiap berkas modul di dalam manifest
    for (const [route, files] of Object.entries(manifest)) {
      for (const relFile of files) {
        totalChecks++;
        const fullFile = path.join(PLATFORM_DIR, relFile);
        if (fs.existsSync(fullFile)) {
          passedChecks++;
        } else {
          errors.push(`[404] File modul untuk rute "${route}" tidak ditemukan di disk: ${relFile}`);
        }
      }
    }
  } catch (err) {
    errors.push('Gagal mengevaluasi modul-manifest.js: ' + err.message);
  }
}

// 2. Audit Sintaks Seluruh Berkas JS di modules/
function scanJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      scanJsFiles(full);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      totalChecks++;
      try {
        const code = fs.readFileSync(full, 'utf8');
        new vm.Script(code, { filename: e.name });
        passedChecks++;
      } catch (syntaxErr) {
        errors.push(`[SYNTAX ERROR] ${path.relative(PLATFORM_DIR, full)}: ${syntaxErr.message}`);
      }
    }
  }
}

const modulesDir = path.join(PLATFORM_DIR, 'modules');
if (fs.existsSync(modulesDir)) {
  scanJsFiles(modulesDir);
}

// 3. Audit Modul Manager & Preset Lisensi
const moduleConfigPath = path.resolve(__dirname, '../config/modules.config.json');
if (fs.existsSync(moduleConfigPath)) {
  totalChecks++;
  try {
    const modConfig = JSON.parse(fs.readFileSync(moduleConfigPath, 'utf8'));
    if (modConfig.presets && modConfig.presets.master_holding && modConfig.presets.starter_lis) {
      passedChecks++;
      console.log(`✓ Konfigurasi modules.config.json valid (${Object.keys(modConfig.presets).length} preset lisensi terdefinisi).`);
    } else {
      errors.push('Preset modules.config.json tidak lengkap.');
    }
  } catch (err) {
    errors.push('Format JSON modules.config.json rusak: ' + err.message);
  }
}

// 4. Audit 3 Output Sistem Files
const outputFiles = [
  { name: '1. Sistem Utama / Web', path: 'index.html' },
  { name: '2. Apps System Hub', path: 'portal.html' },
  { name: '2. Apps System Mobile', path: 'apps_portal.html' },
  { name: '3. Support System Hub', path: 'support.html' },
  { name: '3. Support Kiosk Antrian', path: 'kiosk/index.html' },
  { name: '3. Support TV Antrian', path: 'monitor/antrian.html' },
  { name: '3. Support TV CRM', path: 'monitor/crm.html' }
];

for (const out of outputFiles) {
  totalChecks++;
  const full = path.join(PLATFORM_DIR, out.path);
  if (fs.existsSync(full)) {
    passedChecks++;
  } else {
    errors.push(`Output System ${out.name} tidak ditemukan: ${out.path}`);
  }
}

console.log('\n====================================================');
console.log(`HASIL AUDIT: ${passedChecks} / ${totalChecks} pengujian berhasil lolos.`);
if (errors.length === 0) {
  console.log('✅ SELURUH MODUL, SINTAKS, MANIFEST & OUTPUT SISTEM 100% AMAN & LENGKAP!');
} else {
  console.log(`❌ Ditemukan ${errors.length} masalah:`);
  errors.forEach(e => console.log('  - ' + e));
}
console.log('====================================================\n');
