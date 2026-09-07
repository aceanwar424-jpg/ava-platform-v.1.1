from pathlib import Path
p=Path('ava-platform/connector/ava-connector.js');s=p.read_text(encoding='utf-8')
s=s.replace("const os = require('os');","const os = require('os');\nconst crypto = require('crypto');\nconst {DurableInbox}=require('./durable-inbox');\nconst {evaluateWestgardZ}=require('../modules/lab/qcEngine');")
s=s.replace("if (!SUPABASE_KEY)","if (require.main === module && !SUPABASE_KEY)",1)
s=s.replace('const INGEST_QUEUE = [];',"let inbox;\nfunction getInbox(){return inbox ||= new DurableInbox(process.env.AVA_CONNECTOR_SPOOL || CFG.spool_dir || path.join(os.homedir(),'.ava-connector','inbox'));}\nconst INGEST_QUEUE = []; ")
s=s.replace("      const res = await rpc('analyzer_ingest', {", "      const qc=item.protocol==='ASTM'?pisahkanQcAstm(item.raw):[];\n      const res = qc.length ? await kirimQc(item.analyzer,qc) : await rpc('analyzer_ingest', {")
s=s.replace('      INGEST_QUEUE.shift(); // remove from queue on success','      getInbox().complete(item.id);\n      INGEST_QUEUE.shift(); // durable delivery acknowledged')
s=s.replace('      // Wait with backoff',"      if(item.attempts>=8){getInbox().quarantine(item);INGEST_QUEUE.shift();log('Message quarantined for reconciliation: '+item.id);continue;}\n      getInbox().retry(item);\n      // Wait with backoff")
s=s.replace("  INGEST_QUEUE.push({ analyzer, protocol, raw, direction: dir, attempts: 0 });", "  const id=getInbox().enqueue({analyzer,protocol,raw,direction:dir});\n  if(!INGEST_QUEUE.some(x=>x.id===id)) INGEST_QUEUE.push(getInbox().pending().find(x=>x.id===id));")
s=s.replace('  let astm = [];', "  let session=crypto.randomUUID(), expectedFrame=1, lastFrame=null;\n  let astm = [];")
s=s.replace('        if (end < 0) break;', '        if (end < 0 || buf.length<end+2) break;')
s=s.replace("        const msg = buf.slice(start + 1, end).toString('latin1');", "        if(buf[end+1]!==CR){socket.destroy(new Error('Invalid MLLP terminator'));return;}\n        const msg = buf.slice(start + 1, end).toString('latin1');")
s=s.replace("        ingest(analyzer, 'HL7', msg, 'IN');", "        try{ingest(analyzer, 'HL7', msg, 'IN');}catch(e){socket.destroy(e);return;}")
s=s.replace("if (b0 === ENQ) { socket.write(Buffer.from([ACK])); astm = [];", "if (b0 === ENQ) { session=crypto.randomUUID();expectedFrame=1;lastFrame=null;socket.write(Buffer.from([ACK])); astm = [];")
s=s.replace("          const qc = pisahkanQcAstm(full);\n          if (qc.length) kirimQc(analyzer, qc);\n          else ingest(analyzer, 'ASTM', full, 'IN');", "          try{ingest(analyzer,'ASTM',full,'IN');getInbox().finish(session);}catch(e){socket.destroy(e);return;}")
a=s.index('        if (buf.length < term + 4)');b=s.index('        socket.write(Buffer.from([ACK]));  // ACK per frame',a)
s=s[:a]+'''        if (buf.length < term + 5) break;
        const frame=buf.subarray(0,term+5);
        const checksum=frame.subarray(1,term+1).reduce((n,v)=>(n+v)&255,0).toString(16).toUpperCase().padStart(2,'0');
        const frameNo=Number(String.fromCharCode(frame[1]));
        const valid=checksum===frame.subarray(term+1,term+3).toString('ascii').toUpperCase() && frame[term+3]===CR && frame[term+4]===LF;
        buf=buf.subarray(term+5);
        if(!valid || !Number.isInteger(frameNo) || frameNo<0 || frameNo>7){socket.write(Buffer.from([NAK]));advanced=true;continue;}
        if(lastFrame && frame.equals(lastFrame)){socket.write(Buffer.from([ACK]));advanced=true;continue;}
        if(frameNo!==expectedFrame){socket.write(Buffer.from([NAK]));advanced=true;continue;}
        const text=frame.subarray(2,term).toString('latin1');
        const next=[...astm,text];
        try{getInbox().frame(session,next);}catch(e){socket.write(Buffer.from([NAK]));socket.destroy(e);return;}
        astm=next;lastFrame=Buffer.from(frame);expectedFrame=(frameNo+1)%8;
'''+s[b:]
a=s.index('function nilaiWestgard(');b=s.index('async function ambilLot',a)
s=s[:a]+'''function nilaiWestgard(z,riwayatZ=[]) {
  const ev=evaluateWestgardZ([...riwayatZ].reverse().concat(z));
  return {verdict:ev.status,rule:ev.triggeredRule,catatan:ev.recommendation};
}

'''+s[b:]
s=s.replace("    log(`  ⚠ QC gagal diunggah (${analyzer.name}): ${e.message}`);", "    log(`  ⚠ QC gagal diunggah (${analyzer.name}): ${e.message}`);\n    throw e;")
s=s.replace("    startStatusServer();", "    INGEST_QUEUE.push(...getInbox().pending());\n    processQueue();\n    startStatusServer();")
p.write_text(s,encoding='utf-8')
