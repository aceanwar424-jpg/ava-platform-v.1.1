const fs = require('fs');
const path = require('path');

const ROOT = 'D:/AVAQUEEN-platform-main/ava-platform';

console.log('🔄 Memperbarui akun login user menjadi admin@avahealth.sbs...');

// 1. Perbarui apps/app.js
const appJsPath = path.join(ROOT, 'apps/app.js');
if (fs.existsSync(appJsPath)) {
  let content = fs.readFileSync(appJsPath, 'utf8');
  content = content.replace(/aceanwar424@gmail\.com/g, 'admin@avahealth.sbs');
  fs.writeFileSync(appJsPath, content, 'utf8');
  console.log('✓ apps/app.js diperbarui (admin@avahealth.sbs).');
}

// 2. Perbarui apps/index.html
const appHtmlPath = path.join(ROOT, 'apps/index.html');
if (fs.existsSync(appHtmlPath)) {
  let content = fs.readFileSync(appHtmlPath, 'utf8');
  content = content.replace(/aceanwar424@gmail\.com/g, 'admin@avahealth.sbs');
  content = content.replace(/placeholder="Contoh: RM-12948 atau email Anda"/g, 'placeholder="Contoh: admin@avahealth.sbs atau RM-001"');
  fs.writeFileSync(appHtmlPath, content, 'utf8');
  console.log('✓ apps/index.html diperbarui.');
}

// 3. Perbarui js/auth.js
const authJsPath = path.join(ROOT, 'js/auth.js');
if (fs.existsSync(authJsPath)) {
  let content = fs.readFileSync(authJsPath, 'utf8');
  content = content.replace(/email@domain\.com/g, 'admin@avahealth.sbs');
  content = content.replace(
    /<div style="width:52px;height:52px;background:#0A2342;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;margin:0 auto 12px">OL<\/div>/g,
    '<img src="css/logo-ava-global.png" style="width:56px;height:56px;border-radius:50%;border:2px solid #d4af37;object-fit:cover;margin:0 auto 12px;display:block;box-shadow:0 0 12px rgba(212,175,55,0.4);" alt="Logo">'
  );
  fs.writeFileSync(authJsPath, content, 'utf8');
  console.log('✓ js/auth.js diperbarui.');
}

// 4. Periksa seluruh file js/html lainnya
function scanReplace(dir) {
  for (const f of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (!['node_modules','.git'].includes(f.name)) scanReplace(full);
    } else if (['.js','.html'].includes(path.extname(f.name))) {
      let txt = fs.readFileSync(full, 'utf8');
      if (txt.includes('aceanwar424@gmail.com')) {
        txt = txt.replace(/aceanwar424@gmail\.com/g, 'admin@avahealth.sbs');
        fs.writeFileSync(full, txt, 'utf8');
        console.log(`✓ Diganti di: ${path.relative(ROOT, full)}`);
      }
    }
  }
}

scanReplace(ROOT);
console.log('✨ AKUN USER LOGIN TELAH DIUBAH KE ADMIN@AVAHEALTH.SBS DENGAN SUKSES!');
