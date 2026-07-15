// ═══════════════════════════════════════════════════════════════
// WIKI · PERBAIKAN SOP (AI Reengineering)
// Pilih TEMPLATE ACUAN + dokumen yang mau diperbaiki → Gemini menulis
// ulang mengikuti struktur/format acuan → simpan sebagai versi baru.
// Sumber dokumen: file upload langsung ATAU dokumen yang sudah ada.
// ═══════════════════════════════════════════════════════════════

let _fixTplFile=null, _fixDocFiles=[], _fixResult='', _fixDocId=null;

const FIX_FOCUS = [
  'Struktur & penomoran sesuai acuan',
  'Bahasa formal, ringkas, tidak ambigu',
  'Lengkapi bagian yang hilang (tujuan, ruang lingkup, tanggung jawab, prosedur, referensi)',
  'Konsistensi istilah & satuan',
  'Kesesuaian kaidah mutu (ISO 15189 / akreditasi)',
];

function renderWikiFixTab(el){
  const templates=wikiDocs.filter(d=>d.is_template);
  const docs=wikiDocs.filter(d=>!d.is_template);
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
      <div class="wiki-card">
        <div class="wiki-sec">1 · Template Acuan</div>
        <div class="form-group"><label>Pilih dari dokumen bertanda Template</label>
          <select id="fx-tpl" onchange="_fixTplFile=null;document.getElementById('fx-tplinfo').textContent=''">
            <option value="">— tidak pakai (upload manual) —</option>
            ${templates.map(t=>`<option value="${t.id}">${t.doc_code?'['+t.doc_code+'] ':''}${t.title}</option>`).join('')}
          </select></div>
        <div class="wiki-drop" onclick="document.getElementById('fx-tplfile').click()"
          ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')"
          ondrop="fixDrop(event,'tpl')">
          ${svgIcon('upload',20)} <span style="font-weight:700">Upload template acuan (PDF)</span>
          <div id="fx-tplinfo" style="font-size:12px;color:var(--teal);font-weight:700;margin-top:4px"></div>
        </div>
        <input type="file" id="fx-tplfile" style="display:none" accept=".pdf,.txt,.md" onchange="fixPick('tpl',this.files[0])">
        ${templates.length?'':`<div style="font-size:11px;color:#92400E;background:#FFF8E1;border-radius:6px;padding:8px;margin-top:8px">
          Belum ada dokumen bertanda <strong>Template Acuan</strong>. Tandai di tab Dokumen SOP, atau upload manual di atas.</div>`}
      </div>

      <div class="wiki-card">
        <div class="wiki-sec">2 · Dokumen yang Diperbaiki</div>
        <div class="form-group"><label>Pilih dokumen tersimpan</label>
          <select id="fx-doc" onchange="_fixDocId=this.value||null">
            <option value="">— tidak dipilih (upload manual) —</option>
            ${docs.map(d=>`<option value="${d.id}">${d.doc_code?'['+d.doc_code+'] ':''}${d.title} (v${d.version||'1.0'})</option>`).join('')}
          </select></div>
        <div class="wiki-drop" onclick="document.getElementById('fx-docfile').click()"
          ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')"
          ondrop="fixDrop(event,'doc')">
          ${svgIcon('upload',20)} <span style="font-weight:700">Upload dokumen (PDF, bisa banyak)</span>
          <div id="fx-docinfo" style="font-size:12px;color:var(--teal);font-weight:700;margin-top:4px"></div>
        </div>
        <input type="file" id="fx-docfile" style="display:none" multiple accept=".pdf,.txt,.md" onchange="fixPick('doc',this.files)">
      </div>
    </div>

    <div class="wiki-card" style="margin-top:14px">
      <div class="wiki-sec">3 · Fokus Perbaikan</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px;margin-bottom:10px">
        ${FIX_FOCUS.map((f,i)=>`<label style="font-size:12px;display:flex;gap:7px;align-items:flex-start;font-weight:500">
          <input type="checkbox" class="fx-focus" value="${f}" checked style="margin-top:2px"> ${f}</label>`).join('')}
      </div>
      <div class="form-group"><label>Instruksi tambahan (opsional)</label>
        <input id="fx-extra" placeholder="mis. sesuaikan dengan alur LIS OneLab, tambahkan tabel rekaman mutu"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button class="btn btn-teal" id="fx-run" onclick="runWikiFix()">${svgIcon('sparkle',15)} Proses Perbaikan (AI)</button>
      </div>
    </div>

    <div id="fx-output" style="margin-top:14px"></div>`;
  if(_fixResult) renderFixOutput();
}

function fixPick(kind, files){
  if(kind==='tpl'){
    _fixTplFile = files?.length? files[0] : files;
    if(_fixTplFile){ document.getElementById('fx-tplinfo').textContent=`${_fixTplFile.name} · ${wikiBytes(_fixTplFile.size)}`;
      const s=document.getElementById('fx-tpl'); if(s) s.value=''; }
  } else {
    _fixDocFiles = files? Array.from(files.length!=null?files:[files]) : [];
    const el=document.getElementById('fx-docinfo');
    if(el) el.textContent = _fixDocFiles.length? _fixDocFiles.map(f=>f.name).join(', ').slice(0,120) : '';
    if(_fixDocFiles.length){ const s=document.getElementById('fx-doc'); if(s){ s.value=''; _fixDocId=null; } }
  }
}
function fixDrop(e, kind){
  e.preventDefault(); e.currentTarget.classList.remove('over');
  const fs=e.dataTransfer?.files; if(!fs?.length) return;
  fixPick(kind, kind==='tpl'? fs[0] : fs);
}

// Ambil file dokumen sebagai lampiran AI (dari upload atau dari Storage)
async function fixCollectFiles(){
  const files=[];
  // Template acuan
  const tplSel=document.getElementById('fx-tpl')?.value;
  if(_fixTplFile) files.push({ role:'TEMPLATE ACUAN', file:_fixTplFile });
  else if(tplSel){
    const t=wikiDocs.find(d=>d.id==tplSel);
    if(t?.file_url){ const f=await fixFetchFile(t.file_url,t.file_name,t.mime_type); if(f) files.push({role:'TEMPLATE ACUAN', file:f}); }
  }
  // Dokumen target
  if(_fixDocFiles.length) _fixDocFiles.forEach(f=>files.push({role:'DOKUMEN', file:f}));
  else if(_fixDocId){
    const d=wikiDocs.find(x=>x.id==_fixDocId);
    if(d?.file_url){ const f=await fixFetchFile(d.file_url,d.file_name,d.mime_type); if(f) files.push({role:'DOKUMEN', file:f}); }
  }
  return files;
}
async function fixFetchFile(url,name,mime){
  try{ const r=await fetch(url); if(!r.ok) return null; const b=await r.blob();
    return new File([b], name||'file.pdf', {type:mime||b.type||'application/pdf'}); }
  catch(e){ return null; }
}

async function runWikiFix(){
  const btn=document.getElementById('fx-run');
  const out=document.getElementById('fx-output');
  const focus=[...document.querySelectorAll('.fx-focus:checked')].map(c=>c.value);
  const extra=document.getElementById('fx-extra')?.value.trim()||'';

  const picked=await fixCollectFiles();
  const hasDoc=picked.some(p=>p.role==='DOKUMEN');
  if(!hasDoc){ toast('Pilih atau upload dokumen yang mau diperbaiki','err'); return; }

  if(btn){ btn.disabled=true; btn.innerHTML='⏳ Memproses...'; }
  out.innerHTML=`<div class="wiki-card"><div class="loading-row"><div class="spinner"></div> AI sedang menganalisis & menulis ulang dokumen…</div></div>`;

  try{
    const parts=[];
    for(const p of picked){
      const b64=await fileToBase64(p.file);
      parts.push({ mime_type: p.file.type||'application/pdf', data:b64, _role:p.role, _name:p.file.name });
    }
    const manifest=parts.map((p,i)=>`${i+1}. [${p._role}] ${p._name}`).join('\n');
    const system = `Kamu adalah konsultan mutu & dokumentasi laboratorium klinik berpengalaman (ISO 15189, akreditasi KAN/SNARS).
Tugasmu MEREKAYASA-ULANG (reengineer) dokumen SOP agar rapi, lengkap, konsisten, dan siap pakai.
Selalu jawab dalam Bahasa Indonesia formal. Keluaran HARUS berupa dokumen final dalam format Markdown — tanpa basa-basi pembuka/penutup.`;
    const prompt = `Berikut lampiran dokumen:
${manifest}

TUGAS:
${picked.some(p=>p.role==='TEMPLATE ACUAN')
  ? 'Gunakan berkas berlabel [TEMPLATE ACUAN] sebagai PATOKAN struktur, penomoran, gaya bahasa, dan format. Tulis ulang berkas [DOKUMEN] agar SEPENUHNYA mengikuti acuan tersebut, tanpa mengubah makna teknis/klinis yang benar.'
  : 'Tidak ada template acuan. Rapikan dan lengkapi berkas [DOKUMEN] mengikuti struktur SOP standar: Judul, Kode, Versi, Tujuan, Ruang Lingkup, Definisi, Tanggung Jawab, Alat & Bahan, Prosedur (langkah bernomor), Rekaman Mutu, Referensi, Riwayat Revisi.'}

FOKUS PERBAIKAN:
${focus.map(f=>'- '+f).join('\n') || '- Rapikan struktur & bahasa'}
${extra?`\nINSTRUKSI TAMBAHAN:\n- ${extra}`:''}

ATURAN:
- Pertahankan seluruh substansi teknis yang sudah benar; jangan mengarang data/angka klinis yang tidak ada di sumber.
- Jika ada bagian wajib yang tidak tersedia di sumber, tulis placeholder jelas: "[PERLU DILENGKAPI: ...]".
- Akhiri dengan bagian "## Catatan Perubahan" berisi poin-poin singkat apa saja yang diperbaiki.

Keluarkan HANYA dokumen hasil perbaikan dalam Markdown.`;

    const d = await wikiAI({ mode:'text', prompt, system, temperature:0.3,
      files: parts.map(p=>({mime_type:p.mime_type, data:p.data})) });
    _fixResult = d.text||'';
    _fixLastModel = d.model||'';
    renderFixOutput();
    toast('✅ Perbaikan selesai','ok');
  }catch(e){
    out.innerHTML=`<div class="status-box status-err">❌ ${e.message}
      <div style="font-size:11.5px;margin-top:6px">Pastikan Edge Function <code>gemini-proxy</code> sudah di-deploy &amp; secret <code>GEMINI_API_KEY</code> terisi.</div></div>`;
  }
  if(btn){ btn.disabled=false; btn.innerHTML=`${svgIcon('sparkle',15)} Proses Perbaikan (AI)`; }
}

let _fixLastModel='';
function renderFixOutput(){
  const out=document.getElementById('fx-output'); if(!out) return;
  out.innerHTML=`
    <div class="wiki-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div class="wiki-sec" style="margin:0">Hasil Perbaikan ${_fixLastModel?`<span style="font-weight:500;text-transform:none;color:var(--gray)">· ${_fixLastModel}</span>`:''}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="wikiCopy(_fixResult)">${svgIcon('note',13)} Salin</button>
          <button class="btn btn-ghost btn-sm" onclick="wikiDownload(_fixResult,'SOP_perbaikan.md')">${svgIcon('download',13)} Download</button>
          <button class="btn btn-teal btn-sm" onclick="openSaveFixVersion()">${svgIcon('check',13)} Simpan sebagai Versi</button>
        </div>
      </div>
      <div class="wiki-out">${wikiMd(_fixResult)}</div>
    </div>`;
}

// ── Simpan hasil sebagai versi baru dokumen ──────────────────────
function openSaveFixVersion(){
  if(!_fixResult){ toast('Belum ada hasil','warn'); return; }
  const docs=wikiDocs.filter(d=>!d.is_template);
  openModal(`
    <div class="modal-header"><div class="modal-title">Simpan Hasil sebagai Versi</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Dokumen tujuan</label>
      <select id="sv-doc">
        <option value="">— buat dokumen baru —</option>
        ${docs.map(d=>`<option value="${d.id}" ${_fixDocId==d.id?'selected':''}>${d.title} (v${d.version||'1.0'})</option>`).join('')}
      </select></div>
    <div class="form-row">
      <div class="form-group"><label>Judul (jika dokumen baru)</label><input id="sv-title" placeholder="SOP hasil perbaikan"></div>
      <div class="form-group"><label>Versi baru *</label><input id="sv-ver" value="${_fixDocId?nextWikiVersion(_fixDocId):'1.0'}"></div>
    </div>
    <div class="form-group"><label>Catatan perubahan</label>
      <input id="sv-note" value="Perbaikan otomatis mengikuti template acuan (AI)"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveFixVersion()">${svgIcon('check',14)} Simpan</button>
    </div>`);
}
function nextWikiVersion(docId){
  const d=wikiDocs.find(x=>x.id==docId); const v=parseFloat(d?.version||'1.0');
  return isNaN(v)? '1.1' : (v+0.1).toFixed(1);
}
async function saveFixVersion(){
  const sel=document.getElementById('sv-doc').value;
  const ver=document.getElementById('sv-ver').value.trim()||'1.0';
  const note=document.getElementById('sv-note').value.trim()||null;
  try{
    let docId=sel||null;
    if(!docId){
      const title=document.getElementById('sv-title').value.trim()||'SOP Hasil Perbaikan';
      const created=await sbPost('wiki_documents',{ title, doc_type:'SOP', status:'Draft', version:ver,
        summary:'Dibuat dari hasil perbaikan AI', created_by:wikiUser() });
      docId=created?.[0]?.id||created?.id;
    } else {
      await sbPatch('wiki_documents',docId,{ version:ver, updated_at:new Date().toISOString() });
    }
    await sbPost('wiki_versions',{ document_id:docId, version:ver, content_text:_fixResult,
      change_note:note, source:'ai-reengineer', ai_model:_fixLastModel||null, created_by:wikiUser() });
    toast('✅ Tersimpan sebagai versi '+ver,'ok');
    closeModalForce();
    await loadWikiDocs(); renderWikiKPI();
  }catch(e){ toast('❌ '+e.message,'err',5000); }
}
