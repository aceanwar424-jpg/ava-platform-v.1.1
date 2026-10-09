const fs = require('fs');
const html = fs.readFileSync('ava-platform/apps/index.html', 'utf8');
const appJs = fs.readFileSync('ava-platform/apps/app.js', 'utf8');
const wellnessJs = fs.readFileSync('ava-platform/apps/wellness.js', 'utf8');

// 1. Check for alerts and confirms
const alertInApp = [...appJs.matchAll(/(?<!avaToast[a-zA-Z0-9_]*)(?<![a-zA-Z0-9_.])alert\s*\(/g)];
const alertInWellness = [...wellnessJs.matchAll(/(?<!avaToast[a-zA-Z0-9_]*)(?<![a-zA-Z0-9_.])alert\s*\(/g)];
const confirmInApp = [...appJs.matchAll(/(?<![a-zA-Z0-9_.])confirm\s*\(/g)];
const confirmInWellness = [...wellnessJs.matchAll(/(?<![a-zA-Z0-9_.])confirm\s*\(/g)];

console.log('--- 1. Native Dialog Scan ---');
console.log('alert() in app.js:', alertInApp.length);
alertInApp.forEach(m => console.log('  Line:', appJs.substring(0, m.index).split('\n').length, appJs.substring(m.index - 20, m.index + 40).replace(/\n/g, ' ')));
console.log('alert() in wellness.js:', alertInWellness.length);
alertInWellness.forEach(m => console.log('  Line:', wellnessJs.substring(0, m.index).split('\n').length, wellnessJs.substring(m.index - 20, m.index + 40).replace(/\n/g, ' ')));

console.log('confirm() in app.js:', confirmInApp.length);
confirmInApp.forEach(m => console.log('  Line:', appJs.substring(0, m.index).split('\n').length, appJs.substring(m.index - 20, m.index + 40).replace(/\n/g, ' ')));

// 2. Check for TODO, FIXME, or undefined placeholders
console.log('\n--- 2. TODO / Unfinished Comment Scan ---');
const todoApp = [...appJs.matchAll(/\b(TODO|FIXME|XXX)\b/gi)];
console.log('TODO/FIXME comments in app.js:', todoApp.length);
todoApp.forEach(m => console.log('  ', m[0], 'at line', appJs.substring(0, m.index).split('\n').length));

const todoHtml = [...html.matchAll(/<!--[\s\S]*?\b(TODO|FIXME|XXX)\b[\s\S]*?-->/gi)];
console.log('TODO/FIXME comments in index.html:', todoHtml.length);
todoHtml.forEach(m => console.log('  ', m[0], 'at line', html.substring(0, m.index).split('\n').length));

// 3. Scan onclick functions
console.log('\n--- 3. Onclick Function Availability Scan ---');
const onclickRegex = /onclick\s*=\s*["']\s*([a-zA-Z0-9_$]+)\s*\(/g;
const htmlOnclicks = new Set([...html.matchAll(onclickRegex)].map(m => m[1]));
const appOnclicks = new Set([...appJs.matchAll(onclickRegex)].map(m => m[1]));
const wellnessOnclicks = new Set([...wellnessJs.matchAll(onclickRegex)].map(m => m[1]));
const allOnclicks = new Set([...htmlOnclicks, ...appOnclicks, ...wellnessOnclicks]);

const missingFuncs = [];
for (const fn of allOnclicks) {
  const inApp = appJs.includes('function ' + fn) || appJs.includes(fn + ' =') || appJs.includes(fn + '=') || appJs.includes('window.' + fn);
  const inWellness = wellnessJs.includes('function ' + fn) || wellnessJs.includes(fn + ' =') || wellnessJs.includes(fn + '=') || wellnessJs.includes('window.' + fn);
  const isBuiltin = ['history', 'location', 'console', 'window', 'confirm', 'alert', 'eval'].includes(fn);
  if (!inApp && !inWellness && !isBuiltin) {
    missingFuncs.push(fn);
  }
}
console.log('Total unique onclick functions scanned:', allOnclicks.size);
console.log('Missing/Unresolvable onclick functions:', missingFuncs);

// 4. Check all views in APPS_PAGES vs index.html
console.log('\n--- 4. Views in APPS_PAGES vs index.html ---');
const pagesMatch = appJs.match(/const APPS_PAGES\s*=\s*\[([\s\S]*?)\];/);
if (pagesMatch) {
  const pageIds = [...pagesMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  console.log('Total pages registered in APPS_PAGES:', pageIds.length);
  const missingDomViews = [];
  for (const pid of pageIds) {
    if (!html.includes(`id="${pid}"`) && !html.includes(`id='${pid}'`)) {
      missingDomViews.push(pid);
    }
  }
  console.log('Missing DOM view containers in index.html:', missingDomViews);
}

// 5. Check all document.getElementById calls in app.js
console.log('\n--- 5. getElementById Scan ---');
const getElemRegex = /document\.getElementById\(\s*['"]([a-zA-Z0-9_\-]+)['"]\s*\)/g;
const getElemIds = new Set([...appJs.matchAll(getElemRegex)].map(m => m[1]));
const missingElements = [];
for (const id of getElemIds) {
  const inHtml = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
  // also check if dynamically created in appJs or wellnessJs
  const dynamicInApp = appJs.includes(`id="${id}"`) || appJs.includes(`id='${id}'`) || appJs.includes(`id: '${id}'`);
  if (!inHtml && !dynamicInApp) {
    missingElements.push(id);
  }
}
console.log('Total getElementById queries in app.js:', getElemIds.size);
console.log('Potential missing element IDs in HTML/Dynamic templates:', missingElements);
