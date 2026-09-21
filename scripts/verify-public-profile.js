// Public/operational boundary and deploy asset contract regression checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'ava-platform/portal.html'), 'utf8');
const publicSurface = html + fs.readdirSync(path.join(root,'ava-platform/public')).filter(file=>file.endsWith('.html')).map(file=>fs.readFileSync(path.join(root,'ava-platform/public',file),'utf8')).join('');
const publicJs = fs.readFileSync(path.join(root,'ava-platform/js/public-profile.js'),'utf8');
const domain = JSON.parse(fs.readFileSync(path.join(root,'config/domain.json'), 'utf8'));
const web = domain.situs.find(s => s.kunci === 'web');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
for (const m of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(m[1]), `Missing anchor ${m[1]}`);
for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
  const asset = m[1];
  const file = asset.split('#')[0];
  assert(fs.existsSync(path.join(root,'ava-platform',file)), `Missing asset ${asset}`);
  assert(web.berkas.some(entry => entry === file || (entry.endsWith('/') && file.startsWith(entry))), `Asset excluded from standalone export ${asset}`);
}
assert(!/type="password"|SUPABASE|localStorage|handleSSOLogin|mock_token/i.test(html), 'Public page must not authenticate or store sessions');
assert.equal((html.match(/<form\b/g)||[]).length, 0, 'Homepage is a concise company introduction');
const appLinks = [...html.matchAll(/href="(https:\/\/[^"\s]*avahealth\.sbs[^"\s]*)"/g)].map(m => m[1]);
assert.deepEqual([...new Set(appLinks)].sort(), ['https://apps.avahealth.sbs/', 'https://www.avahealth.sbs/']);
const homeSections=(html.match(/<section\b/g)||[]).length;
assert(homeSections >= 6 && homeSections <= 10, 'Homepage gateway must stay focused while covering primary visitor journeys');
for(const marker of ['id="kebutuhan"','ecosystem-map','status-legend','tech-product-grid','trust-section']) {
  assert(html.includes(marker), `Missing Website V2 gateway component ${marker}`);
}
for(const event of ['nav_service_click','appointment_request','lab_inquiry','corporate_inquiry','tech_demo_request','partnership_request','investor_deck_request']) {
  assert(publicSurface.includes(`data-event="${event}"`), `Missing conversion event ${event}`);
}
assert(publicJs.includes("'contact_submit'"), 'Missing reserved contact_submit conversion event');
const nav = html.match(/<nav id="navigation"[\s\S]*?<\/nav>/)[0];
assert(!/href="#|href="portal\.html#/.test(nav), 'Primary navigation must open separate pages');
for(const file of ['ekosistem','layanan','solusi','corporate','kemitraan','jurnal','tentang','kontak']) assert(nav.includes(`public/${file}.html`));
assert(html.includes('property="og:title"') && html.includes('application/ld+json'), 'Homepage needs Open Graph and structured data');
assert.equal(web.masuk,'/portal.html');
console.log('PASS: concise homepage, separate menu pages, unique IDs, assets/export, single apps login, no public authentication.');
