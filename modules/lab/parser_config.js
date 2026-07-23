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
    if(cfg.barcodeRecord && !barcode && rec===String(cfg.barcodeRecord).toUpperCase()){
      barcode=comp(f[cfg.barcodeField], cfg.barcodeComp);
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
        <div style="display:flex;justify-content:flex-end;margin:6px 0"><button class="btn btn-teal btn-sm" onclick="lpcTest()">🔎 Uji Parse</button></div>
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
  if(!raw.trim()){ box.innerHTML='<span style="color:#B45309">Tempel/ pilih pesan dulu.</span>'; return; }
  const { entries, barcode } = parseWithProfile(raw, cfg);
  const sample = barcode ? (typeof labSamples!=='undefined'?labSamples:[]).find(s=>String(s.barcode)===String(barcode)) : null;
  box.innerHTML=`
    <div style="margin-bottom:6px">Barcode terbaca: <b style="font-family:monospace">${barcode||'(tak ada)'}</b>
      ${barcode?(sample?`<span class="badge badge-green">✓ ${sample.patient_name||'sampel ditemukan'}</span>`:'<span class="badge" style="background:#FEE2E2;color:#B91C1C">sampel tak ditemukan</span>'):''}</div>
    <div style="margin-bottom:4px"><b>${entries.length}</b> baris hasil terbaca:</div>
    <div class="table-wrap" style="max-height:220px;overflow:auto"><table><thead><tr><th>Kode</th><th>Nilai</th><th>Unit</th><th>Flag</th></tr></thead><tbody>
    ${entries.length?entries.map(e=>`<tr><td style="font-family:monospace;font-weight:700">${e.code}</td><td style="font-weight:700">${e.value}</td><td style="font-size:11px;color:var(--gray)">${e.unit||''}</td><td style="font-size:11px">${e.flag||''}</td></tr>`).join('')
      :'<tr><td colspan="4" style="text-align:center;color:#B45309;padding:12px">0 baris — sesuaikan Record/field hasil.</td></tr>'}
    </tbody></table></div>`;
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
