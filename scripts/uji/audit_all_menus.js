// ═══════════════════════════════════════════════════════════════
// AUDIT ALL MENUS IN config/menu.json vs router.js & modules
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const menuFile = path.resolve(__dirname, '../../config/menu.json');
const routerFile = path.resolve(__dirname, '../../ava-platform/js/core/router.js');
const manifestFile = path.resolve(__dirname, '../../ava-platform/js/core/modul-manifest.js');

const menuData = JSON.parse(fs.readFileSync(menuFile, 'utf8'));
const routerContent = fs.readFileSync(routerFile, 'utf8');

// Extract all routes handled in router.js
const routeCases = new Set();
for (const m of routerContent.matchAll(/case\s+'([a-zA-Z0-9_-]+)':/g)) {
  routeCases.add(m[1]);
}

// Extract PAGE_TITLES
const titleMatch = routerContent.match(/const\s+PAGE_TITLES\s*=\s*\{([\s\S]*?)\};/);
const pageTitles = {};
if (titleMatch) {
  const body = titleMatch[1];
  for (const m of body.matchAll(/(?:'([a-zA-Z0-9_-]+)'|([a-zA-Z0-9_-]+))\s*:\s*'([^']+)'/g)) {
    const key = m[1] || m[2];
    pageTitles[key] = m[3];
  }
}

console.log('=== AUDIT FORENSIK SELURUH MENU APLIKASI ===\n');

let totalMenus = 0;
let missingRoutes = [];
let missingTitles = [];
let auditedList = [];

for (const [katKey, kat] of Object.entries(menuData.kategori || {})) {
  for (const grup of kat.grup || []) {
    for (const item of grup.menu || []) {
      totalMenus++;
      const id = item.id;
      const rute = item.rute || id;
      const label = item.label;
      const status = item.status;
      
      const hasRoute = routeCases.has(rute) || routeCases.has(id);
      const hasTitle = Boolean(pageTitles[rute] || pageTitles[id]);
      
      if (status === 'ada') {
        if (!hasRoute) {
          missingRoutes.push({ kat: katKey, grup: grup.nama, id, rute, label });
        }
        if (!hasTitle) {
          missingTitles.push({ kat: katKey, grup: grup.nama, id, rute, label });
        }
      }
      
      auditedList.push({
        id, rute, label, kat: katKey, grup: grup.nama, status, hasRoute, hasTitle
      });
    }
  }
}

console.log(`Total Menu di config/menu.json: ${totalMenus}`);
console.log(`Menu status 'ada' tanpa rute di router.js: ${missingRoutes.length}`);
if (missingRoutes.length > 0) {
  console.log('\n❌ DAFTAR MENU TANPA RUTE DI ROUTER.JS:');
  missingRoutes.forEach(m => {
    console.log(`  - [${m.kat} > ${m.grup}] ID: "${m.id}" | Rute: "${m.rute}" | Label: "${m.label}"`);
  });
}

console.log(`\nMenu status 'ada' tanpa PAGE_TITLES: ${missingTitles.length}`);
if (missingTitles.length > 0) {
  console.log('\n⚠️ DAFTAR MENU TANPA PAGE_TITLES:');
  missingTitles.forEach(m => {
    console.log(`  - ID: "${m.id}" / Rute: "${m.rute}" | Label: "${m.label}"`);
  });
}

if (missingRoutes.length === 0 && missingTitles.length === 0) {
  console.log('\n✅ SEMUA MENU 100% SINKRON & TERSEDIA!');
}
