const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
execFileSync(process.execPath,['scripts/build-lis-connector.cjs'],{stdio:'inherit'});
const files=fs.readdirSync('ava-platform/modules/lab').filter(f=>f.endsWith('.js')).map(f=>'ava-platform/modules/lab/'+f)
 .concat(['ava-platform/connector/ava-connector.js','ava-platform/connector/durable-inbox.js','ava-platform/connector/config.example.json','ava-platform/connector/package.json',
 'ava-platform/downloads/ava-lis-connector-1.1.0.zip','db/migrations/0051_lis_his_service_sync.sql','db/migrations/0052_lis_result_integrity.sql','config/menu.json','ava-platform/js/core/peta-menu.js','ava-platform/js/core/lazy.js','ava-platform/index.html']);
const manifest={version:'1.1.0-rc.1',date:'2026-09-07',status:'local-tested-production-not-activated',hashFormat:'SHA256; UTF-8 text normalized to LF; ZIP bytes unchanged',
 tests:['verify-lis-integrity.cjs','verify-lis-his-sync.cjs','verify-lis-connector.cjs','verify-deploy-readiness.js'],
 activationPrerequisites:['confirmed deployment project','staging migrations and historical tenant mapping','clinical role/SOP and instrument acceptance'],
 files:files.sort().map(file=>({file,sha256:crypto.createHash('sha256').update(file.endsWith('.zip')?fs.readFileSync(file):fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')}))};
fs.mkdirSync('docs/audit-evidence',{recursive:true});fs.writeFileSync('docs/audit-evidence/lis-rc1-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('RC1 manifest: '+manifest.files.length+' files with SHA256. Production activation remains pending.');
