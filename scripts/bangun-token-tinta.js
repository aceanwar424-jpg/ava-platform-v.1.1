// ═══════════════════════════════════════════════════════════════
// Membangkitkan token "tinta" — warna TEKS gelap dan LATAR terang yang
// masih berupa heksa keras di modul.
//
// Kenapa satu token per nilai, bukan dikonsolidasikan jadi beberapa keluarga:
// mengonsolidasi #991B1B dan #7F1D1D menjadi satu warna MENGUBAH tampilan
// mode terang. Itu keputusan desain yang harus diputuskan manusia, bukan
// efek samping penyeragaman. Dengan satu token per nilai, mode terang tetap
// identik dan tema gelap tetap dapat dukungan penuh.
//
// Pasangan gelapnya dihitung: rona dipertahankan, kecerahan diangkat ke
// tingkat yang terbaca di atas latar gelap (dan diturunkan untuk latar).
//
//   node scripts/bangun-token-tinta.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const AKAR = path.resolve(__dirname, '..', 'onelab-platform-main', 'onelab-platform');

const ke255 = h => { h = h.replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join('');
  return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); };
const keHex = ([r,g,b]) => '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase();

function rgb2hsl([r,g,b]) {
  r/=255; g/=255; b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
  let h=0; if(d){ h = mx===r ? ((g-b)/d)%6 : mx===g ? (b-r)/d+2 : (r-g)/d+4; h*=60; if(h<0)h+=360; }
  const l=(mx+mn)/2, s=d? d/(1-Math.abs(2*l-1)) : 0;
  return [h,s,l];
}
function hsl2rgb([h,s,l]) {
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  const [r,g,b] = h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return [(r+m)*255,(g+m)*255,(b+m)*255];
}

// Teks: angkat kecerahan agar terbaca di latar gelap; turunkan saturasi
// sedikit supaya tidak menyilaukan.
const tintaGelap = (hex) => { const [h,s,l] = rgb2hsl(ke255(hex));
  return keHex(hsl2rgb([h, Math.min(s, .55), Math.max(.72, Math.min(.82, 1 - l * .5))])); };
// Latar bernuansa: turunkan drastis agar tetap terasa sebagai "tint".
const latarGelap = (hex) => { const [h,s] = rgb2hsl(ke255(hex));
  return keHex(hsl2rgb([h, Math.min(s, .45), .14])); };

const sisa = JSON.parse(fs.readFileSync(path.join(require('os').tmpdir(), 'sisa.json'), 'utf8'));

const nama = (hex, i, pre) => `${pre}-${String(i + 1).padStart(2, '0')}`;
const terang = [], gelap = [], peta = {};

sisa.teksGelap.forEach((x, i) => {
  const n = nama(x.hex, i, '--ink');
  peta[x.hex] = n;
  terang.push(`  ${n}: ${keHex(ke255(x.hex))};`.padEnd(30) + `/* teks · ${x.total} pemakaian */`);
  gelap.push(`  ${n}: ${tintaGelap(x.hex)};`);
});
sisa.latarTerang.forEach((x, i) => {
  const n = nama(x.hex, i, '--tint');
  peta[x.hex] = n;
  terang.push(`  ${n}: ${keHex(ke255(x.hex))};`.padEnd(30) + `/* latar · ${x.total} pemakaian */`);
  gelap.push(`  ${n}: ${latarGelap(x.hex)};`);
});

const blokTerang = `
  /* ══ TINTA — dibangkitkan scripts/bangun-token-tinta.js ══════════
     Warna teks gelap dan latar bernuansa yang sebelumnya heksa keras.
     Nilai di sini IDENTIK dengan aslinya, jadi mode terang tidak berubah;
     pasangan gelapnya ada di blok tema gelap. */
${terang.join('\n')}`;

const blokGelap = `
  /* Pasangan tema gelap untuk token tinta. Rona dipertahankan, kecerahan
     dibalik agar terbaca — inilah yang membuat tema gelap tidak lagi
     menyembunyikan teks. */
${gelap.join('\n')}`;

let css = fs.readFileSync(path.join(AKAR, 'css', 'style.css'), 'utf8');
css = css.replace(/\n\s*\/\* ══ TINTA[\s\S]*?(?=\n\})/, '');          // buang blok lama bila ada
css = css.replace(/\n\s*\/\* Pasangan tema gelap untuk token tinta[\s\S]*?(?=\n\})/, '');

const iRoot = css.indexOf('\n}', css.indexOf(':root'));
css = css.slice(0, iRoot) + '\n' + blokTerang + css.slice(iRoot);
const iDark = css.indexOf('\n}', css.indexOf('html[data-theme="dark"] {'));
css = css.slice(0, iDark) + '\n' + blokGelap + css.slice(iDark);
fs.writeFileSync(path.join(AKAR, 'css', 'style.css'), css);

fs.writeFileSync(path.join(require('os').tmpdir(), 'peta-tinta.json'), JSON.stringify(peta, null, 1));
console.log('token tinta dibuat :', Object.keys(peta).length);
console.log('  teks  :', sisa.teksGelap.length, '(' + sisa.teksGelap.reduce((s,x)=>s+x.total,0) + ' pemakaian)');
console.log('  latar :', sisa.latarTerang.length, '(' + sisa.latarTerang.reduce((s,x)=>s+x.total,0) + ' pemakaian)');
console.log('\ncontoh pemetaan gelap:');
sisa.teksGelap.slice(0,5).forEach(x => console.log(`  ${x.hex} → ${tintaGelap(x.hex)}  (${peta[x.hex]})`));
