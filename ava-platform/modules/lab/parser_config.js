// ═══════════════════════════════════════════════════════════════
// LIS · CONFIG PARSER & SINKRONISASI (per alat)
// Masalah: format kiriman tiap alat beda; barcode sampel tak diekstrak →
// auto-match gagal. Modul ini:
//   • parseWithProfile(text,cfg) — parser configurable + ambil barcode sampel
//   • renderParserConfig() — atur posisi field per alat + UJI langsung ke
//     pesan nyata (analyzer_messages) sampai kode/nilai/barcode benar
//   • lpcSync() — proses massal pesan RECEIVED → cocokkan → isi lab_results
// Memakai ulang aiComputeMatches/aiApplyMatches (integration.js) untuk
// pencocokan draft + interpretasi. Hasil tetap draft (is_auto) → validasi manusia.
// ═══════════════════════════════════════════════════════════════

// Profil default per protokol (bisa diubah di UI)
const LPC_DEFAULTS = {
  ASTM: { format:'delimited', fieldSep:'|', compSep:'^', resultRecord:'R',   codeField:2, codeComp:'last', valueField:3, unitField:4, flagField:6, barcodeRecord:'O',   barcodeField:2, barcodeComp:'' },
  HL7:  { format:'delimited', fieldSep:'|', compSep:'^', resultRecord:'OBX', codeField:3, codeComp:'0',    valueField:5, unitField:6, flagField:8, barcodeRecord:'OBR', barcodeField:3, barcodeComp:'0' },
};
function lpcDefault(proto){ return { ...(LPC_DEFAULTS[String(proto||'ASTM').toUpperCase()] || LPC_DEFAULTS.ASTM) }; }

// ── Parser configurable → { entries:[{code,value,unit,flag}], barcode } ──
function parseWithProfile(text, cfg){
  cfg = cfg || {};
  const fmt = cfg.format || 'delimited';
  // Format sederhana → pakai parser bawaan (integration.js), barcode dari record bila ada
  if(fmt==='keyval' || fmt==='csv'){
    const entries = (typeof parseAnalyzerFeed==='function') ? parseAnalyzerFeed(text) : [];
    return { entries, barcode:'' };
  }
  const fs = cfg.fieldSep || '|';
  const cs = cfg.compSep || '^';
  const comp = (val, which) => {
    val = (val==null?'':String(val));
    if(which==='' || which==null) return val.trim();
    const parts = val.split(cs);
    if(which==='last'){ const nz=parts.filter(x=>x!==''); return (nz.length?nz[nz.length-1]:'').trim(); }
    return (parts[Number(which)]||'').trim();
  };
  const isLookLikeBarcode = (str) => {
    if (!str) return false;
    const clean = String(str).trim();
    if (clean.length < 3) return false;
    if (/^\d+$/.test(clean) && clean.length <= 3) return false;
    return true;
  };

  const entries=[]; let barcode='';
  String(text||'').split(/\r\n|\r|\n/).forEach(line=>{
    const l=line.trim(); if(!l) return;
    const f=l.split(fs);
    const rec=(f[0]||'').replace(/^\d+/,'').trim().toUpperCase(); // buang nomor frame ASTM bila ada
    if(cfg.resultRecord && rec===String(cfg.resultRecord).toUpperCase()){
      const code=comp(f[cfg.codeField], cfg.codeComp);
      const value=(f[cfg.valueField]!=null?String(f[cfg.valueField]):'').trim();
      const unit=cfg.unitField!=null&&cfg.unitField!==''?(f[cfg.unitField]||'').trim():'';
      const flag=cfg.flagField!=null&&cfg.flagField!==''?(f[cfg.flagField]||'').trim():'';
      if(code && value!=='') entries.push({ code, value, unit, flag });
    }
    if(cfg.barcodeRecord && rec===String(cfg.barcodeRecord).toUpperCase()){
      const candidate = comp(f[cfg.barcodeField], cfg.barcodeComp);
      if (isLookLikeBarcode(candidate)) {
        barcode = candidate;
      }
    }
    // Fallbacks if not detected or set to a dummy number like "1"
    if (!isLookLikeBarcode(barcode)) {
      if (rec === 'OBR') {
        const b2 = comp(f[2], cfg.barcodeComp);
        const b3 = comp(f[3], cfg.barcodeComp);
        if (isLookLikeBarcode(b2)) barcode = b2;
        else if (isLookLikeBarcode(b3)) barcode = b3;
      } else if (rec === 'PID') {
        const b3 = comp(f[3], cfg.barcodeComp);
        const b2 = comp(f[2], cfg.barcodeComp);
        const b5 = comp(f[5], cfg.barcodeComp);
        if (isLookLikeBarcode(b3)) barcode = b3;
        else if (isLookLikeBarcode(b2)) barcode = b2;
        else if (isLookLikeBarcode(b5)) barcode = b5;
      } else if (rec === 'SPM') {
        const b2 = comp(f[2], cfg.barcodeComp);
        if (isLookLikeBarcode(b2)) barcode = b2;
      } else if (rec === 'O') { // ASTM Order
        const b2 = comp(f[2], cfg.barcodeComp);
        const b3 = comp(f[3], cfg.barcodeComp);
        if (isLookLikeBarcode(b2)) barcode = b2;
        else if (isLookLikeBarcode(b3)) barcode = b3;
      } else if (rec === 'P') { // ASTM Patient
        const b3 = comp(f[3], cfg.barcodeComp);
        const b4 = comp(f[4], cfg.barcodeComp);
        if (isLookLikeBarcode(b3)) barcode = b3;
        else if (isLookLikeBarcode(b4)) barcode = b4;
      }
    }
  });
  return { entries, barcode };
}

// ── State + loader ───────────────────────────────────────────────
let _lpcAnalyzers=[], _lpcMsgs=[], _lpcCfg=null, _lpcAid=null;

async function renderParserConfig(analyzerId){
  try{ _lpcAnalyzers = await sbGet('analyzers','select=*&integrasi_aktif=eq.true&order=nama_alat.asc') || []; }
  catch(e){ toast('Gagal muat alat: '+e.message,'err'); return; }
  if(!_lpcAnalyzers.length){ toast('Belum ada alat berintegrasi. Aktifkan di QC & Analyzer.','warn'); return; }
  _lpcAid = analyzerId || _lpcAnalyzers[0].id;
  await lpcLoadForAnalyzer();
  lpcOpenModal();
}

async function lpcLoadForAnalyzer(){
  const a=_lpcAnalyzers.find(x=>x.id==_lpcAid)||{};
  _lpcCfg = (a.parser_config && typeof a.parser_config==='object') ? { ...lpcDefault(a.integrasi_protocol), ...a.parser_config } : lpcDefault(a.integrasi_protocol);
  try{ _lpcMsgs = await sbGet('analyzer_messages',`select=*&analyzer_id=eq.${_lpcAid}&order=received_at.desc&limit=25`) || []; }
  catch(e){ _lpcMsgs=[]; }
}

function lpcOpenModal(){
  const a=_lpcAnalyzers.find(x=>x.id==_lpcAid)||{};
  const c=_lpcCfg;
  const numField=(id,label,val,hint)=>`<div class="form-group"><label>${label}</label><input id="${id}" value="${val==null?'':val}" placeholder="${hint||''}" style="width:100%"></div>`;
  const recvCount=_lpcMsgs.filter(m=>m.status==='RECEIVED'&&m.direction!=='OUT').length;
  openModal(`
    <div class="modal-header"><div class="modal-title">⚙️ Config Parser & Sinkronisasi</div>
      <button class="modal-close" onclick="closeModalForce()"></button></div>
    <div class="form-group"><label>Alat</label>
      <select id="lpc-analyzer" onchange="lpcSwitchAnalyzer(this.value)">
        ${_lpcAnalyzers.map(x=>`<option value="${x.id}" ${x.id==_lpcAid?'selected':''}>${x.nama_alat} · ${x.integrasi_protocol||'ASTM'}</option>`).join('')}
      </select></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--navy);margin:4px 0 6px">Profil Parser</div>
        <div class="form-row">
          <div class="form-group"><label>Format</label>
            <select id="lpc-format"><option value="delimited" ${c.format==='delimited'?'selected':''}>Delimited (ASTM/HL7)</option><option value="keyval" ${c.format==='keyval'?'selected':''}>KODE=NILAI</option><option value="csv" ${c.format==='csv'?'selected':''}>CSV/Tab</option></select></div>
          <div class="form-group"><label>Pemisah field</label><input id="lpc-fs" value="${c.fieldSep||'|'}" style="width:100%"></div>
          <div class="form-group"><label>Pemisah komponen</label><input id="lpc-cs" value="${c.compSep||'^'}" style="width:100%"></div>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--gray);margin:8px 0 4px">RECORD HASIL (nilai per parameter)</div>
        <div class="form-row">
          ${numField('lpc-rrec','Record',c.resultRecord,'R / OBX')}
          ${numField('lpc-cf','Field kode',c.codeField,'2')}
          ${numField('lpc-cc','Komponen kode',c.codeComp,'last / 0')}
        </div>
        <div class="form-row">
          ${numField('lpc-vf','Field nilai',c.valueField,'3')}
          ${numField('lpc-uf','Field unit',c.unitField,'4')}
          ${numField('lpc-ff','Field flag',c.flagField,'6')}
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--gray);margin:8px 0 4px">BARCODE SAMPEL (untuk auto-cocok)</div>
        <div class="form-row">
          ${numField('lpc-brec','Record',c.barcodeRecord,'O / OBR')}
          ${numField('lpc-bf','Field barcode',c.barcodeField,'2')}
          ${numField('lpc-bc','Komponen',c.barcodeComp,'(kosong)')}
        </div>
        <div class="form-hint" style="color:var(--gray)">Index field mulai 0. "Komponen kode" = <code>last</code> (komponen terakhir) atau angka. Ubah lalu klik <b>Uji</b> sampai kode/nilai/barcode benar.</div>
      </div>

      <div>
        <div style="font-size:12px;font-weight:700;color:var(--navy);margin:4px 0 6px">Uji ke Pesan Nyata</div>
        <div class="form-group"><label>Pilih pesan dari alat ini (${_lpcMsgs.length})</label>
          <select id="lpc-msg" onchange="lpcFillFromMsg()">
            <option value="">-- pilih pesan atau tempel manual --</option>
            ${_lpcMsgs.map(m=>`<option value="${m.id}">${m.received_at?new Date(m.received_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''} · ${m.status} · ${(m.raw_text||'').replace(/\s+/g,' ').slice(0,30)}…</option>`).join('')}
          </select></div>
        <textarea id="lpc-raw" rows="6" placeholder="Tempel kiriman mentah alat di sini, atau pilih pesan di atas" style="width:100%;font-family:monospace;font-size:11.5px"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin:6px 0;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="lpcAutoDetect()" title="Tebak posisi field dari pesan nyata">✨ Auto-deteksi</button>
          <button class="btn btn-ghost btn-sm" onclick="lpcHostMap()" title="Petakan kode alat → parameter (isi host_code)">🔗 Peta Host Code</button>
          <button class="btn btn-teal btn-sm" onclick="lpcTest()">🔎 Uji Parse</button>
        </div>
        <div id="lpc-preview" style="font-size:12px;color:var(--gray)">Hasil uji akan tampil di sini.</div>
      </div>
    </div>

    <div class="modal-footer" style="justify-content:space-between">
      <div style="font-size:11.5px;color:var(--gray)">${recvCount} pesan belum diproses untuk alat ini</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
        <button class="btn btn-ghost" onclick="lpcSave()">💾 Simpan Profil</button>
        <button class="btn btn-teal" onclick="lpcSync()">🔄 Simpan &amp; Sinkronkan (${recvCount})</button>
      </div>
    </div>`,'wide');
}

async function lpcSwitchAnalyzer(id){ _lpcAid=parseInt(id)||id; await lpcLoadForAnalyzer(); closeModalForce(); lpcOpenModal(); }
function lpcFillFromMsg(){
  const id=parseInt(document.getElementById('lpc-msg')?.value)||null;
  const m=_lpcMsgs.find(x=>x.id==id);
  document.getElementById('lpc-raw').value = m ? (m.raw_text||'') : '';
  if(m) lpcTest();
}
function lpcReadForm(){
  const g=id=>{ const v=(document.getElementById(id)||{}).value; return v==null?'':String(v).trim(); };
  const gi=id=>{ const v=g(id); return v===''?null:(isNaN(+v)?v:+v); };
  return { format:g('lpc-format')||'delimited', fieldSep:g('lpc-fs')||'|', compSep:g('lpc-cs')||'^',
    resultRecord:g('lpc-rrec')||null, codeField:gi('lpc-cf'), codeComp:g('lpc-cc'),
    valueField:gi('lpc-vf'), unitField:gi('lpc-uf'), flagField:gi('lpc-ff'),
    barcodeRecord:g('lpc-brec')||null, barcodeField:gi('lpc-bf'), barcodeComp:g('lpc-bc') };
}
function lpcTest(){
  const cfg=lpcReadForm();
  const raw=document.getElementById('lpc-raw')?.value||'';
  const box=document.getElementById('lpc-preview'); if(!box) return;
  if(!raw.trim()){ box.innerHTML='<span style="color:var(--warn-deep)">Tempel/ pilih pesan dulu.</span>'; return; }
  const { entries, barcode } = parseWithProfile(raw, cfg);
  const sample = barcode ? (typeof labSamples!=='undefined'?labSamples:[]).find(s=>String(s.barcode)===String(barcode)||String(s.visit_number)===String(barcode)) : null;
  box.innerHTML=`
    <div style="margin-bottom:6px">Barcode terbaca: <b style="font-family:monospace">${barcode||'(tak ada)'}</b>
      ${barcode?(sample?`<span class="badge badge-green">✓ ${sample.patient_name||'sampel ditemukan'}</span>`:'<span class="badge" style="background:var(--tint-02);color:var(--danger-deep)">sampel tak ditemukan</span>'):''}</div>
    <div style="margin-bottom:4px"><b>${entries.length}</b> baris hasil terbaca:</div>
    <div class="table-wrap" style="max-height:220px;overflow:auto"><table><thead><tr><th>Kode</th><th>Nilai</th><th>Unit</th><th>Flag</th></tr></thead><tbody>
    ${entries.length?entries.map(e=>`<tr><td style="font-family:monospace;font-weight:700">${e.code}</td><td style="font-weight:700">${e.value}</td><td style="font-size:11px;color:var(--gray)">${e.unit||''}</td><td style="font-size:11px">${e.flag||''}</td></tr>`).join('')
      :'<tr><td colspan="4" style="text-align:center;color:var(--warn-deep);padding:12px">0 baris — sesuaikan Record/field hasil.</td></tr>'}
    </tbody></table></div>`;
}
// Tebak posisi field dari pesan nyata (mengatasi format alat non-standar).
function lpcAutoDetect(){
  const raw=document.getElementById('lpc-raw')?.value||'';
  if(!raw.trim()){ toast('Tempel / pilih pesan dulu','warn'); return; }
  const fs=(document.getElementById('lpc-fs')?.value)||'|';
  const cs=(document.getElementById('lpc-cs')?.value)||'^';
  const isNum=v=>/^-?\d+(?:[.,]\d+)?$/.test(String(v||'').trim());
  const lines=raw.split(/\r\n|\r|\n/).map(l=>l.trim()).filter(Boolean);

  // Kelompokkan baris per tipe record (buang nomor frame ASTM di depan).
  const groups={};
  lines.forEach(l=>{ const f=l.split(fs); const rec=(f[0]||'').replace(/^\d+/,'').trim().toUpperCase(); if(rec) (groups[rec]=groups[rec]||[]).push(f); });

  // Record hasil = yang paling sering memuat angka & muncul >=2x.
  let best=null,bestScore=-1;
  Object.entries(groups).forEach(([rec,rows])=>{
    const score=rows.filter(f=>f.some(isNum)).length;
    if(rows.length>=2 && score>bestScore){ bestScore=score; best=[rec,rows]; }
  });
  if(!best){ toast('Tak bisa deteksi otomatis — set manual','warn'); return; }
  const [rec,rows]=best;
  const maxLen=Math.max(...rows.map(f=>f.length));

  // Statistik per index field.
  const numFrac=[],alphaFrac=[];
  for(let i=0;i<maxLen;i++){
    let n=0,a=0,t=0;
    rows.forEach(f=>{ const v=(f[i]||'').trim(); if(!v)return; t++; if(isNum(v))n++; else if(/[a-zA-Z]/.test(v))a++; });
    numFrac[i]=t?n/t:0; alphaFrac[i]=t?a/t:0;
  }
  // Field nilai = fraksi numerik tertinggi (setelah index 2).
  let vf=-1,vfr=0; for(let i=3;i<maxLen;i++){ if(numFrac[i]>vfr){ vfr=numFrac[i]; vf=i; } }
  if(vf<0){ toast('Tak menemukan kolom nilai','warn'); return; }
  // Field kode = field alfabetik terdekat SEBELUM nilai.
  let cf=-1; for(let i=vf-1;i>=2;i--){ if(alphaFrac[i]>0.5){ cf=i; break; } }
  // Komponen kode = index komponen non-kosong pertama pada contoh kode.
  let cc='';
  if(cf>=0){
    const sample=(rows.find(f=>(f[cf]||'').trim())||[])[cf]||'';
    const parts=sample.split(cs);
    if(parts.length>1){ const idx=parts.findIndex(x=>x.trim()!==''); cc = idx<0?'0':String(idx); }
  }
  // Field unit = tepat setelah nilai bila alfabetik.
  let uf=(vf+1<maxLen && alphaFrac[vf+1]>0.3 && numFrac[vf+1]<0.5)? vf+1 : '';
  // Field flag = field pendek H/L/N/A/F setelah nilai.
  let ff=''; for(let i=vf+1;i<maxLen;i++){ if(rows.some(f=>/^[HLNAF*]{1,2}$/i.test((f[i]||'').trim()))){ ff=i; break; } }

  // Barcode: cari field (di record apa pun) yang cocok dgn barcode/visit sampel nyata.
  let brec='', bf='', bc='';
  const samples=(typeof labSamples!=='undefined'?labSamples:[]);
  outer: for(const [r,rws] of Object.entries(groups)){
    const m=Math.max(...rws.map(f=>f.length));
    for(let i=1;i<m;i++){
      for(const f of rws){
        const v=(f[i]||'').split(cs).find(x=>x.trim())||''; const vv=v.trim();
        if(vv && samples.some(s=>String(s.barcode)===vv || String(s.visit_number)===vv)){ brec=r; bf=i; break outer; }
      }
    }
  }

  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=(v==null?'':v); };
  set('lpc-format','delimited'); set('lpc-fs',fs); set('lpc-cs',cs);
  set('lpc-rrec',rec); set('lpc-cf',cf>=0?cf:''); set('lpc-cc',cc);
  set('lpc-vf',vf); set('lpc-uf',uf); set('lpc-ff',ff);
  set('lpc-brec',brec); set('lpc-bf',bf); set('lpc-bc',bc);
  toast(`Deteksi: record ${rec}, kode f${cf}${cc!==''?'.'+cc:''}, nilai f${vf}${brec?` · barcode ${brec} f${bf}`:' · barcode tak ketemu'}`,'ok',5000);
  lpcTest();
}

async function lpcSave(silent){
  const cfg=lpcReadForm();
  try{ await sbPatch('analyzers', _lpcAid, { parser_config: cfg, updated_at:new Date().toISOString() });
    const a=_lpcAnalyzers.find(x=>x.id==_lpcAid); if(a) a.parser_config=cfg; _lpcCfg=cfg;
    if(!silent) toast('✅ Profil parser disimpan','ok'); return true;
  }catch(e){ toast('❌ '+e.message,'err'); return false; }
}
async function lpcSync(){
  if(!(await lpcSave(true))) return;
  const cfg=_lpcCfg;
  let msgs=[]; try{ msgs=await sbGet('analyzer_messages',`select=*&analyzer_id=eq.${_lpcAid}&status=eq.RECEIVED&direction=eq.IN&order=received_at.asc&limit=200`)||[]; }catch(e){ toast(e.message,'err'); return; }
  if(!msgs.length){ toast('Tidak ada pesan RECEIVED untuk disinkronkan','info'); return; }
  toast(`Sinkronisasi ${msgs.length} pesan…`,'info');
  let applied=0, matched=0, nobarcode=0, nosample=0;
  for(const m of msgs){
    const { entries, barcode } = parseWithProfile(m.raw_text||'', cfg);
    if(!barcode){ nobarcode++; continue; }
    const s=(typeof labSamples!=='undefined'?labSamples:[]).find(x=>String(x.barcode)===String(barcode));
    if(!s){ nosample++; await sbPatch('analyzer_messages',m.id,{ sample_barcode:barcode, parse_note:'barcode tak dikenal' }).catch(()=>{}); continue; }
    if(!entries.length){ await sbPatch('analyzer_messages',m.id,{ sample_barcode:barcode, status:'ERROR', parse_note:'0 baris hasil' }).catch(()=>{}); continue; }
    try{
      const r=await aiComputeMatches(s.id, m.raw_text, entries); // entriesOverride
      if(r.matched){ const ok=await aiApplyMatches(r.matches); applied+=ok; matched++;
        await sbPatch('analyzer_messages',m.id,{ sample_barcode:barcode, status:'MATCHED', parse_note:`${ok} hasil diterapkan` }).catch(()=>{});
      } else {
        await sbPatch('analyzer_messages',m.id,{ sample_barcode:barcode, status:'ERROR', parse_note:'tak ada parameter cocok (cek host_code)' }).catch(()=>{});
      }
    }catch(e){ await sbPatch('analyzer_messages',m.id,{ status:'ERROR', parse_note:e.message }).catch(()=>{}); }
  }
  toast(`✅ Sync: ${matched} pesan cocok · ${applied} hasil masuk${nobarcode?` · ${nobarcode} tanpa barcode`:''}${nosample?` · ${nosample} barcode tak dikenal`:''}`,'ok',6000);
  try{ await Promise.all([loadLabSamples&&loadLabSamples(), loadLabResults&&loadLabResults()]); }catch(e){}
  if(typeof renderAnalyzerHub==='function' && document.getElementById('lab-integrasi')) renderAnalyzerHub();
  closeModalForce();
}

// ── PETA HOST CODE (kode alat → parameter produk) ────────────────
// Isi analyzers→product_items.host_code dari data nyata: parse pesan, sandingkan
// tiap kode alat dgn parameter produk sampel contoh, simpan sbg host_code.
// Menulis ke product_items (template, utk pemeriksaan berikutnya) + draft sampel
// ini (agar langsung cocok). Tidak menyentuh nilai hasil (tetap draft/human).
let _lpcHostEntries=[], _lpcHostDrafts=[], _lpcHostSampleId='';
const lpcNorm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function lpcSuggest(code, drafts, used){
  const k=lpcNorm(code); if(!k) return null;
  // 1) sama persis pada host_code/item_code/loinc
  let d=drafts.find(x=>!used.has(x.id) && [x.host_code,x.item_code,x.loinc_code].some(v=>lpcNorm(v)===k));
  if(d) return d;
  // 2) saling-mengandung pada kode/nama
  d=drafts.find(x=>!used.has(x.id) && [x.item_code,x.item_name,x.product_name].some(v=>{const n=lpcNorm(v); return n && (n.includes(k)||k.includes(n));}));
  return d||null;
}

function lpcHostMap(){
  const cfg=lpcReadForm();
  const raw=document.getElementById('lpc-raw')?.value||'';
  if(!raw.trim()){ toast('Tempel / pilih pesan dulu, lalu Peta Host Code','warn'); return; }
  const { entries, barcode } = parseWithProfile(raw, cfg);
  if(!entries.length){ toast('0 baris hasil — sesuaikan parser dulu (Uji Parse)','warn'); return; }
  _lpcHostEntries=entries;
  const s = barcode ? (typeof labSamples!=='undefined'?labSamples:[]).find(x=>String(x.barcode)===String(barcode)) : null;
  _lpcHostSampleId = s ? s.id : '';
  lpcOpenHostMap();
}

function lpcOpenHostMap(){
  const samples=(typeof labSamples!=='undefined'?labSamples:[]).filter(s=>['In Process','Pending','Done'].includes(s.status));
  openModal(`
    <div class="modal-header"><div class="modal-title">🔗 Peta Host Code · kode alat → parameter</div>
      <button class="modal-close" onclick="closeModalForce()"></button></div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:8px">Pilih sampel contoh (menentukan produk & daftar parameter), sandingkan tiap <b>kode alat</b> dgn parameter, lalu <b>Simpan</b>. Kode alat ditulis ke <code>host_code</code> parameter — berlaku untuk semua pemeriksaan berikutnya, dan langsung ke draft sampel ini.</div>
    <div class="form-group"><label>Sampel contoh</label>
      <select id="lpc-hm-sample" onchange="lpcHostReload(this.value)">
        <option value="">-- pilih sampel --</option>
        ${samples.map(s=>`<option value="${s.id}" ${s.id==_lpcHostSampleId?'selected':''}>${s.barcode||('#'+s.id)} · ${s.patient_name||''} · ${s.product_name||''}</option>`).join('')}
      </select></div>
    <div id="lpc-hm-body" style="margin-top:8px;font-size:12px;color:var(--gray)">Pilih sampel untuk memuat parameter…</div>
    <div class="modal-footer" style="justify-content:space-between">
      <button class="btn btn-ghost" onclick="closeModalForce();renderParserConfig(_lpcAid)">← Kembali</button>
      <button class="btn btn-teal" onclick="lpcSaveHostMap()">💾 Simpan Host Code</button>
    </div>`,'wide');
  if(_lpcHostSampleId) lpcHostReload(_lpcHostSampleId);
}

async function lpcHostReload(sampleId){
  _lpcHostSampleId=parseInt(sampleId)||sampleId||'';
  const body=document.getElementById('lpc-hm-body'); if(!body) return;
  const s=(typeof labSamples!=='undefined'?labSamples:[]).find(x=>x.id==_lpcHostSampleId);
  if(!s){ body.innerHTML='<div style="color:var(--warn-deep)">Pilih sampel dulu.</div>'; return; }
  body.innerHTML='Memuat parameter…';
  let drafts=(typeof labResults!=='undefined'?labResults:[]).filter(r=>r.admission_id==s.admission_id && r.product_id==s.product_id && r.status==='Draft');
  if(!drafts.length && s.admission_id){ drafts=await sbGet('lab_results',`select=*&admission_id=eq.${s.admission_id}&product_id=eq.${s.product_id}&status=eq.Draft&order=id.asc`).catch(()=>[]); }
  _lpcHostDrafts=drafts||[];
  if(!_lpcHostDrafts.length){ body.innerHTML='<div style="color:var(--warn-deep)">Sampel ini belum punya parameter draft. Pilih sampel lain dgn produk yang sama.</div>'; return; }
  const used=new Set();
  const rows=_lpcHostEntries.map((e,i)=>{
    const sug=lpcSuggest(e.code,_lpcHostDrafts,used); if(sug) used.add(sug.id);
    const opts=_lpcHostDrafts.map(d=>{
      const pid=d.product_item_id||''; const sel=(sug&&sug.id===d.id)?'selected':'';
      const lbl=`${d.item_name||d.item_code||('#'+d.id)}${d.host_code?` · host:${d.host_code}`:''}${pid?'':' (tanpa template)'}`;
      return `<option value="${pid}" ${pid?'':'disabled'} ${sel}>${lbl}</option>`;
    }).join('');
    return `<tr>
      <td style="font-family:monospace;font-weight:700">${e.code}</td>
      <td style="font-weight:700">${e.value}</td><td style="font-size:11px;color:var(--gray)">${e.unit||''}</td>
      <td><select id="lpc-hm-${i}" data-code="${String(e.code).replace(/"/g,'&quot;')}" style="width:100%;font-size:12px">
        <option value="">— lewati —</option>${opts}</select></td>
    </tr>`;
  }).join('');
  body.innerHTML=`<div class="table-wrap" style="max-height:340px;overflow:auto"><table><thead><tr>
    <th>Kode Alat</th><th>Nilai</th><th>Unit</th><th>→ Parameter produk (host_code ditulis)</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div class="form-hint" style="color:var(--gray);margin-top:6px">Auto-saran berdasar kemiripan nama/kode — periksa & sesuaikan. “(tanpa template)” tak bisa disimpan sbg host_code global.</div>`;
}

async function lpcSaveHostMap(){
  if(!_lpcHostEntries.length){ toast('Tak ada kode untuk dipetakan','warn'); return; }
  const jobs=[]; const seen=new Set();
  _lpcHostEntries.forEach((e,i)=>{
    const sel=document.getElementById(`lpc-hm-${i}`); if(!sel) return;
    const pid=sel.value; const code=(sel.getAttribute('data-code')||e.code||'').trim();
    if(pid && code && !seen.has(pid)){ seen.add(pid); jobs.push({ pid, code }); }
  });
  if(!jobs.length){ toast('Belum ada pemetaan dipilih','warn'); return; }
  let okT=0, okD=0;
  for(const j of jobs){
    try{ await sbPatch('product_items', j.pid, { host_code:j.code }); okT++; }catch(e){}
    const dr=_lpcHostDrafts.find(d=>String(d.product_item_id)===String(j.pid));
    if(dr){ try{ await sbPatch('lab_results', dr.id, { host_code:j.code }); dr.host_code=j.code; okD++; }catch(e){} }
  }
  toast(`✅ Host code: ${okT} parameter (template) · ${okD} draft sampel ini`,'ok',6000);
  try{ if(typeof _itemsCache!=='undefined') _itemsCache={}; }catch(e){}   // paksa muat ulang master parameter
  try{ if(typeof loadLabResults==='function') await loadLabResults(); }catch(e){}
  closeModalForce(); renderParserConfig(_lpcAid);
}
