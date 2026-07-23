// ═══════════════════════════════════════════════════════════════
// LIS · INTEGRASI ANALYZER (HL7 / ASTM / CSV)
// - Terima output alat, cocokkan ke draft hasil via HOST CODE / kode analit
// - Interpretasi otomatis (is_auto=true) lalu isi nilai per parameter
// Dua jalur:
//   1. Manual/tempel  → openAnalyzerIntake (analis tempel output alat)
//   2. Otomatis       → renderAnalyzerHub (dashboard: pesan dari OneLab
//      Connector yang masuk ke tabel staging analyzer_messages, di-parse &
//      diterapkan; menutup loop connector → staging → hasil draft)
// Pengisian hasil final TETAP lewat validasi manusia (draft, is_auto).
// ═══════════════════════════════════════════════════════════════

let _aiMatches = [];
let _hubMsgs = [];
let _hubAnalyzers = [];

// ── INTI PAKAI-ULANG ───────────────────────────────────────────
// Parser toleran: HL7 OBX, ASTM R, key=value, CSV/tab
function parseAnalyzerFeed(text){
  const out=[];
  (text||'').split(/\r?\n/).forEach(line=>{
    const l=line.trim(); if(!l) return;
    let code='', value='', unit='', flag='';
    if(/^OBX\|/i.test(l)){
      const f=l.split('|');
      code=(f[3]||'').split('^')[0];
      value=(f[5]||'').trim(); unit=(f[6]||'').trim(); flag=(f[8]||'').trim();
    } else if(/^R\|/i.test(l)){
      const f=l.split('|');
      const comps=(f[2]||'').split('^').filter(Boolean);
      code=comps.length?comps[comps.length-1]:'';
      value=(f[3]||'').trim(); unit=(f[4]||'').trim(); flag=(f[6]||'').trim();
    } else if(l.includes('=')){
      const i=l.indexOf('='); code=l.slice(0,i).trim(); value=l.slice(i+1).trim();
    } else if(l.includes(',') || l.includes('\t')){
      const f=l.split(/[,\t]/); code=(f[0]||'').trim(); value=(f[1]||'').trim(); unit=(f[2]||'').trim();
    }
    if(code && value!=='') out.push({ code, value, unit, flag });
  });
  return out;
}

// Cocokkan entri terhadap draft parameter sampel. Dipakai oleh jalur manual &
// otomatis. Mengembalikan {entries, matches, sample, prod, matched}.
async function aiComputeMatches(sampleId, text){
  const entries=parseAnalyzerFeed(text);
  const s=labSamples.find(x=>x.id==sampleId)||{};
  const prod=(typeof labProduct==='function'?labProduct(s.product_id):null)||{};
  let drafts=labResults.filter(r=>r.admission_id==s.admission_id && r.product_id==s.product_id && r.status==='Draft');
  if(!drafts.length && s.admission_id){
    drafts=await sbGet('lab_results',`select=*&admission_id=eq.${s.admission_id}&product_id=eq.${s.product_id}&status=eq.Draft&order=id.asc`).catch(()=>[]);
  }
  const keyOf=d=>[d.host_code, d.item_code, d.loinc_code, (!d.product_item_id?prod.host_code:null), (!d.product_item_id?prod.kode_internal:null)]
    .filter(Boolean).map(x=>String(x).toLowerCase());

  const matches=[]; const used=new Set();
  entries.forEach(e=>{
    const key=String(e.code).toLowerCase();
    const d=drafts.find(dr=>!used.has(dr.id) && keyOf(dr).includes(key));
    if(d) used.add(d.id);
    matches.push({ entry:e, draft:d||null });
  });
  return { entries, matches, sample:s, prod, matched:matches.filter(m=>m.draft).length };
}

// Terapkan hasil cocok ke lab_results (draft, is_auto) + interpretasi ref-range.
// Murni: tidak menutup modal / refresh. Mengembalikan jumlah yang berhasil.
async function aiApplyMatches(matches){
  const toApply=(matches||[]).filter(m=>m.draft);
  if(!toApply.length) return 0;
  const first=toApply[0].draft;
  const admD=await sbGet('admissions',`select=patient_gender,patient_age&id=eq.${first.admission_id}`).catch(()=>[]);
  const adm=admD?.[0]||{};
  const rrAll=await labLoadRR(first.product_id);
  const sampleIds=new Set();
  let ok=0;
  for(const m of toApply){
    const d=m.draft, val=String(m.entry.value).trim();
    const rr=(rrAll||[]).filter(x=> (d.product_item_id? (x.product_item_id==d.product_item_id||x.product_item_id==null) : x.product_item_id==null));
    const num=parseFloat(val);
    const match=matchRefRange(rr, val, adm.patient_gender, adm.patient_age);
    const crit=match?((!isNaN(num)&&((match.critical_low!=null&&num<=match.critical_low)||(match.critical_high!=null&&num>=match.critical_high)))||match.condition_type==='critical'):false;
    const payload={
      result_value:val, result_numeric:isNaN(num)?null:num, unit:(m.entry.unit||d.unit||null),
      ref_range_id:match?.id||null, normal_min:match?.range_min??null, normal_max:match?.range_max??null,
      critical_low:match?.critical_low??null, critical_high:match?.critical_high??null,
      interpretation:match?.interpretation||match?.condition_name||null, color_code:match?.color_code||'green',
      condition_name:match?.condition_name||null, condition_type:match?.condition_type||null,
      is_critical:crit, is_auto:true, status:'Draft',
      entered_by:'Analyzer', entered_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    };
    try { await sbPatch('lab_results',d.id,payload); ok++; if(d.sample_id) sampleIds.add(d.sample_id); } catch(e){}
  }
  for(const sid of sampleIds){ await sbPatch('lab_samples',sid,{status:'Done',updated_at:new Date().toISOString()}).catch(()=>{}); }
  return ok;
}

// ── JALUR MANUAL / TEMPEL ──────────────────────────────────────
function openAnalyzerIntake(prefill){
  const samples = labSamples.filter(s=>['In Process','Pending','Done'].includes(s.status));
  openModal(`
    <div class="modal-header"><div class="modal-title">🔌 Terima Hasil dari Analyzer</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
      Pilih sampel, tempel output alat (HL7 OBX / ASTM R / CSV / <code>KODE=NILAI</code>). Nilai dicocokkan otomatis ke tiap parameter lewat <strong>Host Code</strong> / kode analit / LOINC.
    </div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label>Sampel *</label>
        <select id="ai-sample">
          <option value="">-- Pilih sampel --</option>
          ${samples.map(s=>`<option value="${s.id}" ${prefill&&prefill.sampleId==s.id?'selected':''}>${s.barcode||('#'+s.id)} · ${s.patient_name||''} · ${s.product_name||''}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-group"><label>Output Analyzer</label>
      <textarea id="ai-feed" rows="7" placeholder="Contoh:
GLU=105
OBX|1|NM|WBC^Leukosit||7.2|10^3/uL|...
R|1|^^^RBC^|4.8|10^6/uL||N
HGB,14.2,g/dL" style="width:100%;font-family:monospace;font-size:12px">${prefill&&prefill.text?String(prefill.text).replace(/</g,'&lt;'):''}</textarea></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn btn-teal btn-sm" onclick="parseAnalyzerIntake()">🔎 Parse &amp; Cocokkan</button>
    </div>
    <div id="ai-preview"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" id="ai-apply-btn" style="display:none" onclick="applyAnalyzerIntake()">✅ Terapkan ke Hasil</button>
    </div>`, 'wide');
  if(prefill&&prefill.autoParse) setTimeout(parseAnalyzerIntake,50);
}

async function parseAnalyzerIntake(){
  const sampleId=parseInt(document.getElementById('ai-sample')?.value)||null;
  const text=document.getElementById('ai-feed')?.value||'';
  const prev=document.getElementById('ai-preview');
  const applyBtn=document.getElementById('ai-apply-btn');
  if(!sampleId){ toast('Pilih sampel dulu','err'); return; }
  const r=await aiComputeMatches(sampleId, text);
  if(!r.entries.length){ prev.innerHTML='<div class="status-box status-warn">Tidak ada baris hasil yang bisa diparse.</div>'; return; }
  _aiMatches=r.matches;
  prev.innerHTML=`
    <div style="font-size:12px;margin-bottom:6px"><strong>${r.matched}/${r.entries.length}</strong> baris cocok · sampel ${r.sample.barcode||''} (${r.prod.nama_tes||r.sample.product_name||''})</div>
    <div class="table-wrap" style="max-height:260px;overflow-y:auto"><table><thead><tr>
      <th>Kode Alat</th><th>Nilai</th><th>Unit</th><th>→ Parameter</th><th>Status</th>
    </tr></thead><tbody>
    ${r.matches.map(m=>`<tr>
      <td style="font-family:monospace;font-size:12px;font-weight:700">${m.entry.code}</td>
      <td style="font-weight:700">${m.entry.value}</td>
      <td style="font-size:11px;color:var(--gray)">${m.entry.unit||''}</td>
      <td style="font-size:12px">${m.draft?(m.draft.item_name||m.draft.product_name):'<span style="color:#EF4444">tidak cocok</span>'}</td>
      <td>${m.draft?'<span class="badge badge-green">✓ cocok</span>':'<span class="badge badge-gray">dilewati</span>'}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
  if(applyBtn) applyBtn.style.display = r.matched?'':'none';
}

async function applyAnalyzerIntake(){
  const first=_aiMatches.find(m=>m.draft)?.draft;
  const ok=await aiApplyMatches(_aiMatches);
  if(!ok){ toast('Tidak ada yang cocok','warn'); return; }
  if(typeof logActivity==='function' && first) logActivity('analyzer_import','lab_results',first.id,`Auto-import ${ok} hasil dari analyzer`);
  toast(`✅ ${ok} hasil masuk otomatis dari analyzer`,'ok',4000);
  closeModalForce(); labRefresh();
}

// ── DASHBOARD INTEGRASI ALAT (menutup loop otomatis) ───────────
async function renderAnalyzerHub(){
  const host=document.getElementById('lab-integrasi'); if(!host) return;
  host.innerHTML=`<div class="loading-row"><div class="spinner"></div></div>`;

  // analyzer_messages / analyzers ada hanya jika supabase_analyzer_bridge.sql sudah dijalankan.
  let analyzers=null, msgs=null;
  try { analyzers=await sbGet('analyzers','select=*&order=nama_alat.asc'); } catch(e){ analyzers=null; }
  try { msgs=await sbGet('analyzer_messages','select=*&order=received_at.desc&limit=120'); } catch(e){ msgs=null; }

  if(msgs===null){
    host.innerHTML=`
      <div style="background:#FFF8E1;border:1px solid #FDE68A;border-radius:12px;padding:18px 20px;font-size:13px;color:#92400E;line-height:1.7">
        Modul <strong>Integrasi Alat</strong> memerlukan tabel <code>analyzer_messages</code>.<br>
        Jalankan <code>supabase_analyzer_bridge.sql</code> di Supabase SQL Editor, lalu muat ulang halaman ini.<br>
        <span style="font-size:12px;color:#B45309">Setelah itu, jalankan <code>OneLab Connector</code> di PC lab agar hasil alat masuk ke sini.</span>
      </div>`;
    return;
  }
  _hubMsgs=msgs||[]; _hubAnalyzers=analyzers||[];
  const anById=id=>(_hubAnalyzers.find(a=>a.id==id)||{});
  const now=Date.now();
  const received=_hubMsgs.filter(m=>m.status==='RECEIVED' && m.direction!=='OUT');
  const online=_hubAnalyzers.filter(a=>a.integrasi_aktif && a.last_seen_at && (now-new Date(a.last_seen_at).getTime())<3e5).length;
  const integs=_hubAnalyzers.filter(a=>a.integrasi_aktif).length;

  host.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <span class="badge badge-teal">${integs} alat integrasi</span>
        <span class="badge ${online?'badge-green':'badge-gray'}" style="margin-left:6px">${online} online</span>
        <span class="badge" style="background:#EFF6FF;color:#1D4ED8;margin-left:6px">${received.length} pesan belum diproses</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="renderAnalyzerHub()">↻ Segarkan</button>
        <button class="btn btn-ghost btn-sm" onclick="openAnalyzerIntake()">Tempel Manual</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">Status Alat &amp; Connector</div>
      <div class="table-wrap"><table><thead><tr>
        <th>Alat</th><th>Protokol</th><th>Koneksi</th><th>Terakhir Terlihat</th><th>Pesan 24j</th><th>Belum Diproses</th>
      </tr></thead><tbody>
      ${integs?_hubAnalyzers.filter(a=>a.integrasi_aktif).map(a=>{
        const seen=a.last_seen_at?new Date(a.last_seen_at).getTime():0;
        const isOn=seen&&(now-seen)<3e5;
        const m24=_hubMsgs.filter(m=>m.analyzer_id==a.id && new Date(m.received_at).getTime()>now-864e5).length;
        const unp=_hubMsgs.filter(m=>m.analyzer_id==a.id && m.status==='RECEIVED' && m.direction!=='OUT').length;
        return `<tr>
          <td><div style="font-weight:600">${a.nama_alat||'—'}</div><div style="font-size:10px;color:var(--gray)">${a.kode_alat||''}</div></td>
          <td style="font-size:12px">${a.integrasi_protocol||'—'}</td>
          <td style="font-size:11px;color:var(--gray)">${a.ip_address?`${a.ip_address}:${a.tcp_port||'—'} · ${a.conn_mode||'server'}${a.conn_direction==='twoway'?' · 2-arah':''}`:'—'}</td>
          <td style="font-size:11px;color:${isOn?'#16a34a':'#94a3b8'};font-weight:${isOn?'700':'400'}"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${isOn?'#16a34a':'#94a3b8'};margin-right:4px"></span> ${isOn?'online':(seen?new Date(seen).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'belum ada data')}</td>
          <td style="text-align:center">${m24}</td>
          <td style="text-align:center;font-weight:${unp?'700':'400'};color:${unp?'#1D4ED8':'var(--gray)'}">${unp||'—'}</td>
        </tr>`;
      }).join(''):`<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray)">Belum ada alat berintegrasi. Aktifkan integrasi di tab <b>QC &amp; Analyzer</b> → + Analyzer.</td></tr>`}
      </tbody></table></div>
    </div>

    <div class="card">
      <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">Pesan Masuk dari Alat (staging)</div>
      <div class="table-wrap"><table><thead><tr>
        <th>Waktu</th><th>Alat</th><th>Barcode</th><th>Isi (mentah)</th><th>Status</th><th>Aksi</th>
      </tr></thead><tbody>
      ${_hubMsgs.length?_hubMsgs.map(m=>{
        const a=anById(m.analyzer_id);
        const barSample=m.sample_barcode?labSamples.find(s=>String(s.barcode)===String(m.sample_barcode)):null;
        const stColor={RECEIVED:'#1D4ED8',PARSED:'#0EA5E9',MATCHED:'#16a34a',ERROR:'#EF4444',SENT:'#94A3B8'}[m.status]||'#94A3B8';
        const raw=(m.raw_text||'').replace(/\s+/g,' ').slice(0,48);
        const canProcess=m.status==='RECEIVED' && m.direction!=='OUT';
        return `<tr>
          <td style="font-size:11px;color:var(--gray)">${m.received_at?new Date(m.received_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</td>
          <td style="font-size:12px">${a.nama_alat||m.analyzer_code||'—'}</td>
          <td style="font-size:11px">${m.sample_barcode?`${m.sample_barcode}${barSample?`<div style="font-size:10px;color:#16a34a">${barSample.patient_name||''}</div>`:`<div style="font-size:10px;color:#EF4444">tak dikenal</div>`}`:'<span style="color:var(--gray)">—</span>'}</td>
          <td style="font-family:monospace;font-size:11px;color:var(--gray)" title="${(m.raw_text||'').replace(/"/g,'')}">${raw}${(m.raw_text||'').length>48?'…':''}</td>
          <td><span style="background:${stColor}20;color:${stColor};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${m.status}</span>${m.parse_note?`<div style="font-size:10px;color:var(--gray)">${m.parse_note}</div>`:''}</td>
          <td>${canProcess?`<button class="btn btn-teal btn-xs" onclick="hubProcessMessage(${m.id})">${barSample?'Parse &amp; Terapkan':'Cocokkan'}</button>`:''}</td>
        </tr>`;
      }).join(''):`<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray)">Belum ada pesan. Pastikan OneLab Connector berjalan di PC lab dan alat mengirim hasil.</td></tr>`}
      </tbody></table></div>
    </div>`;

  // Auto-segarkan tiap 20 dtk selama tab Integrasi terbuka.
  clearInterval(window._hubTimer);
  window._hubTimer=setInterval(()=>{ if(document.getElementById('lab-integrasi')) renderAnalyzerHub(); else clearInterval(window._hubTimer); }, 20000);
}

// Proses satu pesan staging: auto bila barcode dikenal, jika tidak buka tempel manual.
async function hubProcessMessage(msgId){
  const msg=_hubMsgs.find(m=>m.id==msgId); if(!msg) return;
  let sampleId=null;
  if(msg.sample_barcode){
    const s=labSamples.find(x=>String(x.barcode)===String(msg.sample_barcode));
    if(s) sampleId=s.id;
  }
  if(!sampleId){
    // barcode tak dikenal / kosong → biarkan analis pilih sampel manual, teks sudah terisi
    openAnalyzerIntake({ text:msg.raw_text });
    return;
  }
  const r=await aiComputeMatches(sampleId, msg.raw_text);
  if(!r.matched){
    await sbPatch('analyzer_messages',msgId,{status:'ERROR',parse_note:'Tak ada parameter cocok dengan draft'}).catch(()=>{});
    toast('Tak ada parameter yang cocok','warn'); renderAnalyzerHub(); return;
  }
  const ok=await aiApplyMatches(r.matches);
  await sbPatch('analyzer_messages',msgId,{status:'MATCHED',parse_note:`${ok} hasil diterapkan`}).catch(()=>{});
  if(typeof logActivity==='function') logActivity('analyzer_import','analyzer_messages',msgId,`Auto-import ${ok} hasil dari ${msg.analyzer_code||'alat'}`);
  toast(`${ok} hasil diterapkan dari ${msg.analyzer_code||'alat'}`,'ok',4000);
  try { await Promise.all([loadLabSamples(), loadLabResults()]); } catch(e){}
  renderAnalyzerHub();
}
