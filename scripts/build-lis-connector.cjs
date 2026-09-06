// Deterministic ZIP (stored entries), no dependencies or credentials.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const files=['connector/ava-connector.js','connector/durable-inbox.js','connector/package.json','connector/config.example.json','connector/README.md','modules/lab/qcEngine.js'];
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(data){let n=0xffffffff;for(const b of data)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
const entries=files.map(f=>[f,Buffer.from(fs.readFileSync(path.join(root,'ava-platform',f),'utf8').replace(/\r\n/g,'\n'))]);
entries.push(['START.cmd',Buffer.from('@echo off\r\ncd /d "%~dp0connector"\r\nnode ava-connector.js\r\npause\r\n')]);
entries.push(['RELEASE.txt',Buffer.from('AVA LIS Connector 1.1.0\nConfigure SUPABASE_URL and SUPABASE_KEY on the lab workstation. No credentials included.\nRead connector/README.md. Start only after staging and instrument protocol acceptance.\n')]);
const parts=[],directory=[];let offset=0;
for(const [name,data]of entries){const n=Buffer.from(name),c=crc(data),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(c,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);
 const d=Buffer.alloc(46);d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt16LE(0x800,8);d.writeUInt32LE(c,16);d.writeUInt32LE(data.length,20);d.writeUInt32LE(data.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);
 parts.push(h,n,data);directory.push(d,n);offset+=h.length+n.length+data.length;}
const cd=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...parts,cd,end]),dest=path.join(root,'ava-platform/downloads/ava-lis-connector-1.1.0.zip');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,zip);
console.log('Connector ZIP: '+entries.length+' files; SHA256 '+crypto.createHash('sha256').update(zip).digest('hex'));
