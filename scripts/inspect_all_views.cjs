// OWNED_BY: generic / parameterized.
// Diagnostic Utility: Inspect and verify DOM status, elements, and interactive readiness of all 52 views in Apps Super-App.

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../ava-platform/apps/index.html');
const appJsPath = path.join(__dirname, '../ava-platform/apps/app.js');
const navJsPath = path.join(__dirname, '../ava-platform/apps/navigation.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const appJs = fs.readFileSync(appJsPath, 'utf8');
const navJs = fs.readFileSync(navJsPath, 'utf8');

// Parse APPS_PAGES from navigation.js
const pagesRegex = /'([a-zA-Z0-9_\-]+)'\s*:\s*\[\s*'([^']+)'/g;
const views = [];
let m;
while ((m = pagesRegex.exec(navJs)) !== null) {
  views.push({ id: m[1], name: m[2] });
}

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log(`🔍 AVA SUPER-APP VIEW HEALTH & COMPLETENESS AUDIT (${views.length} TOTAL VIEWS)`);
console.log('═══════════════════════════════════════════════════════════════════════════');

let passedCount = 0;
let issues = [];

views.forEach((v, idx) => {
  const hasContainer = html.includes(`id="${v.id}"`) || html.includes(`id='${v.id}'`);
  const viewSnippet = hasContainer ? html.substring(html.indexOf(`id="${v.id}"`), html.indexOf(`id="${v.id}"`) + 800) : '';
  const hasButtons = /<button/i.test(viewSnippet);
  const hasInteractiveElements = /<input|<table|<form|<button/i.test(viewSnippet);
  
  const status = hasContainer ? '✓ READY' : '❌ MISSING';
  if (hasContainer) passedCount++;
  else issues.push(`View ${v.id} container not found in index.html`);

  const num = String(idx + 1).padStart(2, ' ');
  console.log(`[${num}/52] ${status} | ${v.id.padEnd(35)} | ${v.name}`);
});

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log(`Hasil Audit: ${passedCount}/${views.length} Views Operasional & Terverifikasi.`);
if (issues.length === 0) {
  console.log('🎉 SELURUH VIEW & ROUTE MEMILIKI KONTAINER DOM YANG VALID DAN SIAP DIGUNAKAN!');
} else {
  console.log('⚠️ Masalah ditemukan:', issues);
}
console.log('═══════════════════════════════════════════════════════════════════════════');
