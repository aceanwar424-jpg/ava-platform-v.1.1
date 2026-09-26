const test=require('node:test'); const assert=require('node:assert/strict');
const transitions={incident:{OPEN:['MITIGATING','RESOLVED'],MITIGATING:['MONITORING','RESOLVED'],MONITORING:['RESOLVED','OPEN'],RESOLVED:['CLOSED']},problem:{OPEN:['ANALYSIS'],ANALYSIS:['ACTIONED'],ACTIONED:['VERIFYING'],VERIFYING:['CLOSED']}};
function move(kind,from,to,reason){assert.ok(transitions[kind][from]?.includes(to),`${kind}: ${from}->${to} invalid`);assert.ok(reason&&reason.trim(),'reason required');return to;}
test('incident lifecycle requires valid states and evidence',()=>{let s='OPEN';s=move('incident',s,'MITIGATING','log error');s=move('incident',s,'MONITORING','service restored');s=move('incident',s,'RESOLVED','smoke test passed');s=move('incident',s,'CLOSED','client confirmed');assert.equal(s,'CLOSED')});
test('invalid incident transition is rejected',()=>assert.throws(()=>move('incident','OPEN','CLOSED','langsung tutup')));
test('preventive problem requires analysis action verification',()=>{let s='OPEN';for(const [to,reason] of [['ANALYSIS','pattern'],['ACTIONED','patch'],['VERIFYING','drill'],['CLOSED','effective']])s=move('problem',s,to,reason);assert.equal(s,'CLOSED')});
test('empty evidence is rejected',()=>assert.throws(()=>move('problem','VERIFYING','CLOSED','')));
