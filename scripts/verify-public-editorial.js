const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const platform = path.join(root,'ava-platform');
const {calculate,calculateBMI,calculateEnergy,calculateWater,calculateMacros} = require('../ava-platform/js/health-calculators');
const {profiles,articles} = require('./public-editorial-content');
const input = {age:40,weight:80,height:180,sex:'male',factor:1.2,eligible:true};
const male = calculate(input);
assert.equal(male.resting,1730); assert.equal(male.maintenance,2076);
assert.equal(calculate({...input,sex:'female'}).resting,1564);
assert(Math.abs(male.bmi - 24.691358024691358)<1e-10);
for(const [weight,expected] of [[73.9,'Berat badan kurang'],[74,'Rentang berat badan sehat'],[99.9,'Rentang berat badan sehat'],[100,'Berat badan berlebih'],[119.9,'Berat badan berlebih'],[120,'Kategori obesitas']]) assert.equal(calculate({...input,weight,height:200}).category,expected);
for(const bad of [{height:0},{weight:-1},{weight:NaN},{age:19},{age:79},{age:20.5},{height:Infinity},{sex:'unknown'},{factor:0},{eligible:false}]) assert.throws(()=>calculate({...input,...bad}));
assert.equal(calculate({...input,factor:1.8}).maintenance,3114);
const bmiOnly=calculateBMI({weight:65,height:165}); assert(Math.abs(bmiOnly.bmi-23.875114784205696)<1e-10); assert(bmiOnly.healthyMin<bmiOnly.healthyMax);
const energyOnly=calculateEnergy({age:40,weight:80,height:180,sex:'male',factor:1.2}); assert.equal(energyOnly.maintenance,2076);
assert.deepEqual(calculateWater({weight:60}),{minimum:1.8,maximum:2.1});
const macros=calculateMacros({calories:2000}); assert.deepEqual(macros.carbohydrate,[225,325]); assert.deepEqual(macros.protein,[50,175]);
for(const bad of [{weight:0},{weight:251}]) assert.throws(()=>calculateWater(bad));
for(const bad of [{calories:799},{calories:6001}]) assert.throws(()=>calculateMacros(bad));
console.log('PASS: BMI, healthy-weight range, calorie, hydration, macronutrient and validation examples.');
const files = ['portal.html',...fs.readdirSync(path.join(platform,'public')).filter(f=>f.endsWith('.html')).map(f=>'public/'+f)];
assert(files.length >= 37, 'Website V2 public page set is incomplete');
const read = file => fs.readFileSync(path.join(platform,file),'utf8');
const lookup = new Map(files.map(file=>[file,read(file)]));
const home = lookup.get('portal.html');
for (const file of ['demo','penawaran','investasi','tentang','ekosistem','layanan','corporate','ava-his','ava-lis','ava-apps','kalkulator','privasi']) assert(lookup.has(`public/${file}.html`));
assert(lookup.get('public/penawaran.html').includes('Lisensi bulanan') && lookup.get('public/penawaran.html').includes('Biaya awal'));
for(const marker of ['id="bmi-tool"','id="energy-tool"','id="water-tool"','id="macro-tool"']) assert(lookup.get('public/kalkulator.html').includes(marker),`Missing Health Tool ${marker}`);
assert(home.includes('public/kalkulator.html#tool-bmi') && home.includes('public/kalkulator.html#tool-macro'),'Homepage Health Tool cards must be clickable');
for (const file of ['solusi-laboratorium.html','solusi-klinik-pratama.html','solusi-klinik-utama.html','investasi.html']) assert(/uji coba terbatas/i.test(lookup.get('public/'+file)),file);
for (const [file, content] of lookup) assert(!content.includes('Queen Health Solution'), `Corporate name must remain AVA: ${file}`);
assert(!lookup.get('public/manufaktur.html').includes('sediaan nonsteril'), 'Obsolete factory-led positioning must not be published');
for (const [file,html] of lookup) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,`Duplicate IDs in ${file}`);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,file);
  if(file.startsWith('public/')) assert(html.includes('<base href="../">'));
  for(const [,raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:)/.test(raw) || raw === '../') continue;
    const [target,hash] = raw.split('#');
    const relative = (target || file).split('?')[0];
    assert(fs.existsSync(path.join(platform,relative)),`Missing ${relative} in ${file}`);
    if(hash) assert(read(relative).includes(`id="${hash}"`),`Missing ${hash} in ${relative}`);
  }
  assert(!/type="password"|mock_token|handleSSOLogin/.test(html),file);
  assert(html.includes('property="og:title"'),`Missing Open Graph metadata in ${file}`);
  assert(html.includes('application/ld+json'),`Missing structured data in ${file}`);
}
for(const [brand,p] of Object.entries(profiles)) {
  assert.equal(p.mission.length,3); assert(p.flow.length>=5);
  assert(lookup.has('public/brand-'+brand+'.html'));
}
for(const article of articles) {
  const html = lookup.get('public/jurnal-'+article.slug+'.html');
  assert(article.sections.length>=4); assert(article.sources.length>=1);
  assert(html.includes('Belum ditinjau klinis'));
  assert(html.includes('Referensi diperiksa 5 September 2026'));
}
const digest = () => crypto.createHash('sha256').update(files.map(read).join('')).digest('hex');
const before = digest(); execFileSync(process.execPath,['scripts/build-public-profile.js'],{cwd:root}); assert.equal(digest(),before);
assert(lookup.get('public/tentang.html').includes('bisnis fisik fasilitas kesehatan dan laboratorium sendiri'));
assert(lookup.get('public/brand-care.html').includes('perempuan dan laki-laki'));
assert(lookup.get('public/brand-care.html').includes('Queen Sanctuary'));
assert(lookup.get('public/founder.html').includes('founder-photo-slot'));
assert(lookup.get('public/founder.html').includes('Founder, Owner & CEO'));
assert.equal((lookup.get('public/sejarah.html').match(/class="story-chapter"/g)||[]).length,6);
console.log(`PASS: ${files.length} pages, all local targets/anchors, one H1, Website V2 metadata, founder photo slot, 6 story chapters, physical businesses, inclusive Care & Wellness, sourced articles, deterministic rebuild.`);
