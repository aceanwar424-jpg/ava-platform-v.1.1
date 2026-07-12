// ═══════════════════════════════════════════════════════════════
// CORE: Code 128 barcode generator (mandiri, tanpa dependensi)
// - code128B_SVG(text, opts) → string <svg> (Code 128B)
// - printLabBarcodes(labels) → cetak label lab 5cm × 3cm (Code 128)
// Dipakai oleh modul Anamnesa untuk generate/print barcode sampel.
// ═══════════════════════════════════════════════════════════════

// Tabel pola Code 128 (indeks 0..106). Tiap pola = lebar run bar/spasi
// bergantian (bar,spasi,bar,spasi,bar,spasi); pola Stop (106) punya 7 run.
const CODE128_PATTERNS = [
 '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
 '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
 '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
 '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
 '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
 '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
 '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
 '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
 '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
 '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
 '114131','311141','411131','211412','211214','211232','2331112'
];

// Encode teks (ASCII 32..126) menjadi Code 128B, kembalikan <svg>.
function code128B_SVG(text, opts) {
  opts = opts || {};
  const H = opts.height || 60;          // tinggi bar (unit viewBox)
  const quiet = opts.quiet != null ? opts.quiet : 10; // margin sunyi (modul)

  // Sanitasi: hanya ASCII 32..126 yang didukung Code 128B
  const clean = String(text || '').replace(/[^\x20-\x7E]/g, '-') || ' ';

  const codes = [104];                  // Start Code B
  for (let i = 0; i < clean.length; i++) codes.push(clean.charCodeAt(i) - 32);
  let sum = 104;
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
  codes.push(sum % 103);                // checksum
  codes.push(106);                      // Stop

  const runs = codes.map(c => CODE128_PATTERNS[c]).join('');
  let total = 0;
  for (const ch of runs) total += (+ch);
  const width = total + 2 * quiet;

  let x = quiet, rects = '';
  for (let j = 0; j < runs.length; j++) {
    const w = +runs[j];
    if (j % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="${H}"/>`; // run genap = bar
    x += w;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" preserveAspectRatio="none">${rects}</svg>`;
}

// Cetak label lab 5cm (lebar) × 3cm (tinggi), barcode Code 128 + info basic.
// labels: [{ label_barcode, patient_name, mr_number, visit_number,
//            patient_gender, patient_dob, patient_age, sampel_type, tests:[{product_name}] }]
function printLabBarcodes(labels) {
  if (!labels || !labels.length) { if (typeof toast==='function') toast('Tidak ada label untuk dicetak','warn'); return; }
  const org = localStorage.getItem('ol_org_name') || 'OneLab';
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Barcode Lab</title>
    <style>
      @page { size: 50mm 30mm; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
      .lab { width: 50mm; height: 30mm; padding: 1.5mm 2mm; page-break-after: always; overflow: hidden; }
      .top { display:flex; justify-content:space-between; align-items:center; font-size:6pt; color:#333; }
      .st  { background:#000; color:#fff; font-size:6pt; font-weight:700; padding:0 1.2mm; border-radius:1mm; }
      .bc  { width:100%; }
      .bc svg { display:block; width:46mm; height:10mm; }
      .code{ font-family:'Courier New',monospace; font-size:7.5pt; font-weight:700; letter-spacing:.4px; text-align:center; margin-top:.3mm; }
      .nm  { font-size:8pt; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:.3mm; }
      .meta{ font-size:6pt; color:#222; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    </style></head><body>
    ${labels.map(l => {
      const meta = [l.mr_number?('MR '+l.mr_number):'', l.visit_number||''].filter(Boolean).join(' · ');
      const demo = [l.patient_gender||'', l.patient_age?(l.patient_age+'th'):'', l.patient_dob||''].filter(Boolean).join(' ');
      const tests = (l.tests||[]).map(t=>t.product_name).join(', ');
      return `<div class="lab">
        <div class="top"><span>${org}</span><span class="st">${l.sampel_type||''}</span></div>
        <div class="bc">${code128B_SVG(l.label_barcode||'')}</div>
        <div class="code">${l.label_barcode||''}</div>
        <div class="nm">${l.patient_name||''}</div>
        <div class="meta">${meta}</div>
        <div class="meta">${demo}${tests?' · '+tests:''}</div>
      </div>`;
    }).join('')}
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  w.document.close();
}
