from pathlib import Path
import re
p=Path('ava-platform/modules/lab/settings.js');s=p.read_text(encoding='utf-8')
a=s.index('const DEFAULT_CRITICAL_PARAMETERS = [');b=s.index('\n];',a)+3;s=s[:a]+'const DEFAULT_CRITICAL_PARAMETERS = []; // Acuan klinis berasal dari master server.'+s[b:]
a=s.index('function getCriticalParameters()');b=s.index('function saveLisSettings',a)
s=s[:a]+'''function getCriticalParameters(){return [];}
function saveCriticalParameters(){toast('Kelola acuan klinis pada menu Nilai Rujukan.','warn');}

'''+s[b:]
s=s.replace("  _lisActiveSettingsTab = tab;","  if(tab==='critical'){navigate('refrange');return;}\n  _lisActiveSettingsTab = tab;",1)
s=s.replace('✓ Pengaturan Laboratorium berhasil disimpan','Preferensi workstation tersimpan pada browser ini')
s=s.replace('Konfigurasi profil faskes, dr. Sp.PK, ambang nilai kritis per analit, katalog tes, dan connector alat server :9999.','Preferensi tampilan pada browser ini. Nilai rujukan dan batas kritis dikelola melalui master server; identitas otorisator mengikuti akun petugas.')
s=s.replace('Standar ISO 15189 / KARS: maksimal &le; 15 menit dengan metode TBaK (Tulis, Baca, Konfirmasi).','Target waktu ditetapkan dalam SOP lab yang disahkan.').replace('Master Katalog Tes (530+)','Katalog Pemeriksaan')
a=s.index('function downloadConnectorZip()');b=s.index('\nwindow.renderLisSettings',a)
s=s[:a]+'''function downloadConnectorZip(){
  const a=document.createElement('a');a.href='/downloads/ava-lis-connector-1.1.0.zip';a.download='ava-lis-connector-1.1.0.zip';
  document.body.appendChild(a);a.click();a.remove();
}

'''+s[b:];p.write_text(s,encoding='utf-8')
p=Path('ava-platform/modules/lab/index.js');s=p.read_text(encoding='utf-8').replace("  if ((r.color_code||'') === 'red' && r.condition_type !== 'normal') return true;\n",'').replace('id="cv-readback" style="width:auto" checked','id="cv-readback" style="width:auto"')
s=s.replace("!gender || rr.gender===gender","rr.gender===gender").replace('age==null || ((rr.age_min==null||age>=rr.age_min) && (rr.age_max==null||age<=rr.age_max))','(age==null ? (rr.age_min==null && rr.age_max==null) : ((rr.age_min==null||age>=rr.age_min) && (rr.age_max==null||age<=rr.age_max)))')
p.write_text(s,encoding='utf-8')
p=Path('ava-platform/modules/lab/validation.js');s=p.read_text(encoding='utf-8').replace("if(typeof printLabReport==='function') printLabReport(p.patient_name, p.visit_number, rows);","if(typeof printLabReport==='function') printLabReport(p.patient_name, p.visit_number, mode==='approve'?undefined:rows);")
s=s.replace('updated_at:r.updated_at??null','updated_at:r.updated_at??null,notes:_valNotes[r.id]??r.notes??null')
p.write_text(s,encoding='utf-8')
p=Path('ava-platform/connector/durable-inbox.js');s=p.read_text(encoding='utf-8').replace('frame(session,frames){','frame(session,frames,analyzer){').replace('{frames,updated_at:', '{frames,analyzer,updated_at:');p.write_text(s,encoding='utf-8')
p=Path('ava-platform/connector/ava-connector.js');s=p.read_text(encoding='utf-8').replace('getInbox().frame(session,next)','getInbox().frame(session,next,analyzer)');p.write_text(s,encoding='utf-8')
