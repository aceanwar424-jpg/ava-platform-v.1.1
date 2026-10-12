const fs = require('fs');
const lines = fs.readFileSync('data/catalog/catalog_generic.csv', 'utf8').trim().split('\n');

const samples = [];
lines.slice(1).forEach(l => {
  const parts = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
  const testName = parts[1] ? parts[1].replace(/"/g, '') : '';
  const analyteName = parts[2] ? parts[2].replace(/"/g, '') : '';
  const loinc = parts[9] ? parts[9].replace(/"/g, '') : '';
  const ucum = parts[10] ? parts[10].replace(/"/g, '') : '';
  
  if (/t4|protein|bilirubin|kreatinin|tsh|hitungan/i.test(testName)) {
    samples.push({ testName, analyteName, loinc, ucum });
  }
});

console.log('Sample Analyte mapping:');
samples.slice(0, 10).forEach(s => {
  console.log(`Pemeriksaan: "${s.testName}" -> Analit: "${s.analyteName}" [LOINC: ${s.loinc}, UCUM: ${s.ucum}]`);
});
