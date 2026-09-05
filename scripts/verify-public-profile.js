// Public/operational boundary and deploy asset contract regression checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'ava-platform/portal.html'), 'utf8');
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
assert.equal((html.match(/<form\b/g)||[]).length, 1, 'Only the local educational calculator form is expected');
const appLinks = [...html.matchAll(/href="(https:\/\/[^"\s]*avahealth\.sbs[^"\s]*)"/g)].map(m => m[1]);
assert.deepEqual([...new Set(appLinks)].sort(), ['https://apps.avahealth.sbs/', 'https://www.avahealth.sbs/']);
assert.equal((html.match(/class="brand-card"/g)||[]).length,6);
assert.equal((html.match(/data-category=/g)||[]).length,8);
for (const id of ['beranda','tentang','brand','produk','perjalanan','sertifikasi','kontak','jurnal','kalkulator','kemitraan','manufaktur']) assert(ids.includes(id));
assert.equal(web.masuk,'/portal.html');
console.log('PASS: anchors, unique IDs, assets/export, 6 brands, 8 categories, single apps login, no public authentication.');
