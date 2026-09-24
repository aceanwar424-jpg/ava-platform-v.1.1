// OWNED_BY: ava. Mechanical web exports only; retain complete original compositions.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
const names = ['ava-ecosystem-hero','ava-ecosystem-overview','queen-health-hero','queen-lab-hero','ava-tech-hero','corporate-health-hero','ava-his-showcase','ava-lis-showcase','ava-apps-showcase','integrated-platforms','patient-journey','laboratory-journey','corporate-mcu-journey','ava-tech-workflow','provider-solution','queen-care-hero','queen-nutrition-hero','queen-wellness-hero'];
const tail = ['partnership-hero','investor-growth','about-ava','journal-insights','health-tools','contact-cta'];
const sources = fs.readdirSync(path.join(root,'Artefak')).filter(x=>x.endsWith('.png')).sort();
const assignments = [...names.map((name,i)=>[name,sources[i]]),...tail.map((name,i)=>[name,sources[i+25]])];
(async()=>{
 const manifest=[];
 for (const [name,source] of assignments){
  const input=path.join(root,'Artefak',source);const output=path.join(root,'ava-platform/public/assets/visuals',name);
  const meta=await sharp(input).metadata();
  await sharp(input).resize({width:1440,withoutEnlargement:true}).jpeg({quality:90,mozjpeg:true}).toFile(output+'.jpg');
  await sharp(input).resize({width:1440,withoutEnlargement:true}).webp({quality:86}).toFile(output+'.webp');
  await sharp(input).resize({width:720,withoutEnlargement:true}).webp({quality:82}).toFile(output+'-small.webp');
  manifest.push({name,source,width:meta.width,height:meta.height,owned_by:'ava'});
 }
 fs.writeFileSync(path.join(root,'ava-platform/public/assets/visuals/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Exported',manifest.length,'complete compositions, JPEG + responsive WebP.');
})().catch(e=>{console.error(e);process.exitCode=1;});
