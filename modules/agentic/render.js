// ═══════════════════════════════════════════════════════════════
// AGENTIC — RENDER DOCX DI BROWSER (Fase 5)
// Markdown → .docx tanpa library: dokumen OOXML minimal dibungkus
// ZIP (entry STORED, tanpa kompresi) + CRC32. Melengkapi gap render
// Edge Function yang dicatat sejak Fase 0.
// ═══════════════════════════════════════════════════════════════

// ── CRC32 (tabel standar) ────────────────────────────────────────
const AG_CRC_TABLE = (()=>{
  const t = new Uint32Array(256);
  for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); t[n]=c; }
  return t;
})();
function agCrc32(buf){
  let c = 0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) c = AG_CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── ZIP builder (STORED — kompatibel semua pembaca DOCX) ─────────
function agBuildZip(files){ // files: [{name, data:Uint8Array}]
  const enc = new TextEncoder();
  const chunks = []; const centrals = [];
  let offset = 0;
  for(const f of files){
    const nameB = enc.encode(f.name);
    const crc = agCrc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true);
    lh.setUint16(8, 0, true); // method 0 = stored
    lh.setUint32(14, crc, true);
    lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true);
    lh.setUint16(26, nameB.length, true);
    chunks.push(new Uint8Array(lh.buffer), nameB, f.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
    cd.setUint16(10, 0, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true); cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, nameB.length, true);
    cd.setUint32(42, offset, true);
    centrals.push(new Uint8Array(cd.buffer), nameB);
    offset += 30 + nameB.length + f.data.length;
  }
  let cdSize = 0; centrals.forEach(c=>cdSize+=c.length);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true); eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true);
  const all = [...chunks, ...centrals, new Uint8Array(eocd.buffer)];
  let total = 0; all.forEach(a=>total+=a.length);
  const out = new Uint8Array(total); let p=0;
  for(const a of all){ out.set(a,p); p+=a.length; }
  return out;
}

// ── Markdown → OOXML paragraf ────────────────────────────────────
function agXmlEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Run dengan dukungan **bold**
function agDocxRuns(text){
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map(p=>{
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    const txt = agXmlEsc(m ? m[1] : p);
    return `<w:r><w:rPr>${m?'<w:b/>':''}<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r>`;
  }).join('');
}
function agDocxPara(text, opts){
  const o = opts||{};
  const pPr = [
    o.style ? `<w:pStyle w:val="${o.style}"/>` : '',
    o.bullet ? '<w:ind w:left="360" w:hanging="180"/>' : '',
  ].join('');
  const prefix = o.bullet ? '• ' : '';
  return `<w:p><w:pPr>${pPr}</w:pPr>${agDocxRuns(prefix + text)}</w:p>`;
}

function agMdToDocumentXml(md, title){
  const body = [];
  if(title) body.push(agDocxPara(title, {style:'Title'}));
  const lines = String(md||'').replace(/\r/g,'').split('\n');
  let inCode = false;
  for(const raw of lines){
    const line = raw;
    if(/^```/.test(line)){ inCode = !inCode; continue; }
    if(inCode){ body.push(agDocxPara(line.replace(/\t/g,'    '), {})); continue; }
    if(!line.trim()){ body.push('<w:p/>'); continue; }
    let m;
    if((m = line.match(/^#{1}\s+(.*)$/)))      body.push(agDocxPara(m[1], {style:'Heading1'}));
    else if((m = line.match(/^#{2}\s+(.*)$/))) body.push(agDocxPara(m[1], {style:'Heading2'}));
    else if((m = line.match(/^#{3,}\s+(.*)$/)))body.push(agDocxPara(m[1], {style:'Heading3'}));
    else if((m = line.match(/^\s*[-*]\s+(.*)$/))) body.push(agDocxPara(m[1], {bullet:true}));
    else if((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) body.push(agDocxPara(`${m[1]}. ${m[2]}`, {}));
    else if(/^>\s?/.test(line)) body.push(agDocxPara(line.replace(/^>\s?/,''), {style:'Quote'}));
    else if(/^\|/.test(line))   body.push(agDocxPara(line, {})); // tabel md → baris teks
    else body.push(agDocxPara(line, {}));
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body.join('')}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`;
}

const AG_DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="0A2342"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0A2342"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="0A2342"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="13856B"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>
</w:styles>`;

const AG_DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const AG_DOCX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const AG_DOCX_DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// Markdown → Blob .docx
function agMdToDocxBlob(md, title){
  const enc = new TextEncoder();
  const zip = agBuildZip([
    { name:'[Content_Types].xml',           data: enc.encode(AG_DOCX_CONTENT_TYPES) },
    { name:'_rels/.rels',                   data: enc.encode(AG_DOCX_RELS) },
    { name:'word/_rels/document.xml.rels',  data: enc.encode(AG_DOCX_DOC_RELS) },
    { name:'word/styles.xml',               data: enc.encode(AG_DOCX_STYLES) },
    { name:'word/document.xml',             data: enc.encode(agMdToDocumentXml(md, title)) },
  ]);
  return new Blob([zip], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function agDownloadDocx(md, name, title){
  const blob = agMdToDocxBlob(md, title);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (name||'dokumen').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_') + '.docx';
  a.click();
}

// Unduh .docx dari task Inbox
function agDownloadDocxFromTask(id){
  const t = agTasks.find(x=>x.id===id); if(!t) return;
  const md = (t.result && (t.result.markdown || t.result.text)) || '';
  if(!md){ toast('Task ini tidak punya konten markdown','warn'); return; }
  agDownloadDocx(md, t.title, t.title);
}
