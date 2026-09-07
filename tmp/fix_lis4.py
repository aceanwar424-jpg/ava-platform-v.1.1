from pathlib import Path
import re
p=Path('ava-platform/modules/lab/qc.js');s=p.read_text(encoding='utf-8').replace('r.lot_id===current.lot_id','r.lot_id===current.lot_id && r.lot_number===current.lot_number');p.write_text(s,encoding='utf-8')
p=Path('ava-platform/modules/lab/index.js');s=p.read_text(encoding='utf-8')
s+='''
function labEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
''';p.write_text(s,encoding='utf-8')
for name in ['validation.js','worklist.js','report.js','results.js']:
 p=Path('ava-platform/modules/lab')/name;s=p.read_text(encoding='utf-8')
 for expr in ['r.patient_name','r.result_value','r.unit','r.product_name','r.item_name','p.patient_name','pt.name','pt.visit','patientName','requestingDoc','prod','p.result_value',"p.unit||''","r.unit||''","r.notes||''"]:
  s=s.replace('${'+expr+'}','${labEscape('+expr+')}')
 p.write_text(s,encoding='utf-8')
p=Path('ava-platform/js/core/lazy.js');s=p.read_text(encoding='utf-8');s=re.sub(r"const MODUL_VER = '[^']+';","const MODUL_VER = '20260907-lis-integrity-rc1';",s);p.write_text(s,encoding='utf-8')
p=Path('ava-platform/index.html');s=p.read_text(encoding='utf-8')
for f in ['js/core/lazy.js','js/core/peta-menu.js','js/core/modul-manifest.js']:
 s=re.sub(re.escape(f)+r'\?v=[^"\s]+',f+'?v=20260907-lis-integrity-rc1',s)
p.write_text(s,encoding='utf-8')
