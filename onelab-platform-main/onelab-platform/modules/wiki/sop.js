// ═══════════════════════════════════════════════════════════════
// WIKI · DOKUMEN SOP — upload, metadata, versi, template acuan
// ═══════════════════════════════════════════════════════════════

let _wikiDocFilter = { q:'', type:'', status:'' };

function renderWikiDocsTab(el){
  const f=_wikiDocFilter;
  const data=wikiDocs.filter(d=>
    (!f.q || `${d.title||''} ${d.doc_code||''} ${d.category||''} ${d.tags||''}`.toLowerCase().includes(f.q.toLowerCase())) &&
    (!f.type || d.doc_type===f.type) && (!f.status || d.status===f.status));

  el.innerHTML=`
    <div class="pro-toolbar">
      <input class="table-search" placeholder="🔍 Cari judul / kode / kategori / tag..."
        value="${f.q}" oninput="_wikiDocFilter.q=this.value;renderWikiTab()" style="flex:1;min-width:220px">
      <select class="table-filter" onchange="_wikiDocFilter.type=this.value;renderWikiTab()">
        <option value="">Semua Tipe</option>${WIKI_DOC_TYPES.map(t=>`<option ${f.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <select class="table-filter" onchange="_wikiDocFilter.status=this.value;renderWikiTab()">
        <option value="">Semua Status</option>${Object.keys(WIKI_STATUS).map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <button class="btn btn-teal btn-sm" onclick="openWikiDocForm()">${svgIcon('upload',14)} Upload Dokumen</button>
    </div>

    ${data.length?`<div style="overflow-x:auto"><table class="pro-grid"><thead><tr>
      <th>Kode / Versi</th><th>Judul</th><th>Tipe</th><th>Kategori</th><th>Status</th><th>File</th><th>Aksi</th>
    </tr></thead><tbody>
    ${data.map(d=>{
      const c=WIKI_STATUS[d.status]||'#94A3B8';
      const overdue=d.review_date && new Date(d.review_date)<=new Date();
      return `<tr>
        <td style="font-family:monospace;font-size:11px">${d.doc_code||'—'}<div style="color:var(--gray)">v${d.version||'1.0'}</div></td>
        <td><div style="font-weight:700;color:var(--navy)">${d.title||'—'}
            ${d.is_template?`<span class="wiki-badge" style="background:#EDE9FE;color:#6D28D9;margin-left:4px">TEMPLATE ACUAN</span>`:''}
            ${overdue?`<span class="wiki-badge" style="background:var(--danger-soft);color:var(--danger-strong);margin-left:4px">Perlu Review</span>`:''}</div>
          ${d.summary?`<div style="font-size:10.5px;color:var(--gray);max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.summary}</div>`:''}</td>
        <td style="font-size:11.5px">${d.doc_type||'—'}</td>
        <td style="font-size:11.5px;color:var(--gray)">${d.category||'—'}</td>
        <td><span class="wiki-badge" style="background:${c}20;color:${c}">${d.status||'Draft'}</span></td>
        <td style="font-size:11px;color:var(--gray)">${d.file_name?`${d.file_name}<div>${wikiBytes(d.file_size)}</div>`:'—'}</td>
        <td><div class="act-row" style="flex-wrap:nowrap">
          ${d.file_url?`<a class="act-btn" href="${d.file_url}" target="_blank" title="Buka file">${svgIcon('download',14)}</a>`:''}
          <button class="act-btn" title="Riwayat versi" onclick="openWikiVersions(${d.id})">${svgIcon('refresh',14)}</button>
          <button class="act-btn edit" onclick="openWikiDocForm(${d.id})">${svgIcon('edit',14)}</button>
          <button class="act-btn del" onclick="deleteWikiDoc(${d.id})">${svgIcon('trash',14)}</button>
        </div></td>
      </tr>`;}).join('')}
    </tbody></table></div>`
    :`<div class="empty-state"><div class="ico">📚</div><h3>${wikiDocs.length?'Tidak ada hasil':'Belum ada dokumen'}</h3>
      <p style="color:var(--gray)">Upload SOP/kebijakan, tandai satu sebagai <strong>Template Acuan</strong> untuk dipakai di Perbaikan SOP.</p>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openWikiDocForm()">${svgIcon('upload',14)} Upload Dokumen</button></div>`}`;
}

// ── Form upload / edit dokumen ───────────────────────────────────
async function openWikiDocForm(id){
  let d={};
  if(id){ const r=await sbGet('wiki_documents',`select=*&id=eq.${id}`).catch(()=>[]); d=r?.[0]||{}; }
  openModal(`
    <div class="modal-header"><div class="modal-title">${id?'Edit':'Upload'} Dokumen</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>

    ${id?'':`<div class="wiki-drop" id="wd-drop" onclick="document.getElementById('wd-file').click()"
        ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')"
        ondrop="wikiDocDrop(event)">
        ${svgIcon('upload',26)}
        <div style="font-weight:700;margin-top:6px">Klik atau drop file di sini</div>
        <div style="font-size:11.5px;color:var(--gray)">PDF / DOCX / gambar · maks ~20 MB</div>
        <div id="wd-fileinfo" style="font-size:12px;color:var(--teal);font-weight:700;margin-top:6px"></div>
      </div>
      <input type="file" id="wd-file" style="display:none" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.md" onchange="wikiDocPick(this.files[0])">`}

    <div class="form-row" style="margin-top:12px">
      <div class="form-group"><label>Kode Dokumen</label><input id="wd-code" value="${d.doc_code||''}" placeholder="SOP-LAB-001"></div>
      <div class="form-group" style="grid-column:2/-1"><label>Judul *</label><input id="wd-title" value="${d.title||''}" placeholder="SOP Penerimaan Sampel"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tipe</label><select id="wd-type">${WIKI_DOC_TYPES.map(t=>`<option ${d.doc_type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Kategori</label><select id="wd-cat">${WIKI_CATEGORIES.map(c=>`<option ${d.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>Departemen</label><input id="wd-dept" value="${d.department||''}"></div>
      <div class="form-group"><label>Versi</label><input id="wd-ver" value="${d.version||'1.0'}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Status</label><select id="wd-status">${Object.keys(WIKI_STATUS).map(s=>`<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="form-group"><label>Berlaku Sejak</label><input type="date" id="wd-eff" value="${d.effective_date||''}"></div>
      <div class="form-group"><label>Jadwal Review</label><input type="date" id="wd-rev" value="${d.review_date||''}"></div>
      <div class="form-group"><label>Pemilik</label><input id="wd-owner" value="${d.owner_name||wikiUser()}"></div>
    </div>
    <div class="form-group"><label>Ringkasan</label><textarea id="wd-sum" rows="2">${d.summary||''}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Tags</label><input id="wd-tags" value="${d.tags||''}" placeholder="pra-analitik, mutu"></div>
      <div class="form-group"><label style="display:flex;align-items:center;gap:8px;margin-top:22px;font-weight:600">
        <input type="checkbox" id="wd-tpl" ${d.is_template?'checked':''}> Jadikan Template Acuan</label></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" id="wd-save" onclick="saveWikiDoc(${id||'null'})">${svgIcon('check',14)} Simpan</button>
    </div>`,'wide');
}

let _wikiPickedFile=null;
function wikiDocPick(file){
  _wikiPickedFile=file||null;
  const el=document.getElementById('wd-fileinfo');
  if(el&&file) el.textContent=`${file.name} · ${wikiBytes(file.size)}`;
  const t=document.getElementById('wd-title');
  if(t&&!t.value&&file) t.value=file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
}
function wikiDocDrop(e){
  e.preventDefault(); e.currentTarget.classList.remove('over');
  const f=e.dataTransfer?.files?.[0]; if(f) wikiDocPick(f);
}

async function saveWikiDoc(id){
  const title=document.getElementById('wd-title').value.trim();
  if(!title){ toast('Judul wajib diisi','err'); return; }
  const btn=document.getElementById('wd-save');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Menyimpan...'; }
  const V=i=>document.getElementById(i)?.value?.trim()||null;
  const payload={
    doc_code:V('wd-code'), title, doc_type:V('wd-type'), category:V('wd-cat'),
    department:V('wd-dept'), version:V('wd-ver')||'1.0', status:V('wd-status')||'Draft',
    effective_date:V('wd-eff'), review_date:V('wd-rev'), owner_name:V('wd-owner'),
    summary:V('wd-sum'), tags:V('wd-tags'),
    is_template:!!document.getElementById('wd-tpl')?.checked,
    updated_at:new Date().toISOString(),
  };
  try{
    if(_wikiPickedFile){
      const up=await wikiUploadFile(_wikiPickedFile,'docs');
      payload.file_url=up.url; payload.file_name=_wikiPickedFile.name;
      payload.file_size=_wikiPickedFile.size; payload.mime_type=_wikiPickedFile.type||null;
    }
    if(id){ await sbPatch('wiki_documents',id,payload); toast('✅ Dokumen diperbarui','ok'); }
    else {
      payload.created_by=wikiUser();
      const created=await sbPost('wiki_documents',payload);
      const docId=created?.[0]?.id||created?.id;
      if(docId) await sbPost('wiki_versions',{ document_id:docId, version:payload.version,
        file_url:payload.file_url||null, file_name:payload.file_name||null,
        change_note:'Versi awal (upload)', source:'manual', created_by:wikiUser() }).catch(()=>{});
      toast('✅ Dokumen diupload','ok');
    }
    _wikiPickedFile=null; closeModalForce();
    await loadWikiDocs(); renderWikiKPI(); renderWikiTab();
  }catch(e){
    toast('❌ '+e.message,'err',6000);
    if(btn){ btn.disabled=false; btn.textContent='💾 Simpan'; }
  }
}

async function deleteWikiDoc(id){
  if(!confirm('Hapus dokumen ini beserta riwayat versinya?')) return;
  try{ await sbDelete('wiki_documents',id); toast('Terhapus','warn');
    await loadWikiDocs(); renderWikiKPI(); renderWikiTab(); }
  catch(e){ toast('❌ '+e.message,'err'); }
}

// ── Riwayat versi ────────────────────────────────────────────────
async function openWikiVersions(docId){
  const d=wikiDocs.find(x=>x.id==docId)||{};
  let vers=[];
  try{ vers=await sbGet('wiki_versions',`select=*&document_id=eq.${docId}&order=created_at.desc`)||[]; }catch(e){}
  openModal(`
    <div class="modal-header"><div class="modal-title">Riwayat Versi — ${d.title||''}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    ${vers.length?`<div style="overflow-x:auto"><table class="pro-grid"><thead><tr>
      <th>Versi</th><th>Sumber</th><th>Catatan</th><th>Oleh</th><th>Tanggal</th><th></th>
    </tr></thead><tbody>
      ${vers.map(v=>`<tr>
        <td style="font-weight:700">v${v.version||'—'}</td>
        <td><span class="wiki-badge" style="background:${v.source==='ai-reengineer'?'#EDE9FE':'#F1F5F9'};color:${v.source==='ai-reengineer'?'#6D28D9':'#475569'}">
          ${v.source==='ai-reengineer'?'AI Reengineer':'Manual'}</span></td>
        <td style="font-size:11.5px">${v.change_note||'—'}</td>
        <td style="font-size:11.5px">${v.created_by||'—'}</td>
        <td style="font-size:11px;color:var(--gray)">${v.created_at?new Date(v.created_at).toLocaleString('id-ID'):''}</td>
        <td><div class="act-row">
          ${v.file_url?`<a class="act-btn" href="${v.file_url}" target="_blank">${svgIcon('download',14)}</a>`:''}
          ${v.content_text?`<button class="act-btn" title="Lihat isi" onclick="viewWikiVersion(${v.id})">${svgIcon('eye',14)}</button>`:''}
        </div></td></tr>`).join('')}
    </tbody></table></div>`:`<div style="padding:24px;text-align:center;color:var(--gray)">Belum ada riwayat versi.</div>`}
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`,'wide');
}
let _wikiViewText='', _wikiViewName='dokumen.md';
async function viewWikiVersion(verId){
  const r=await sbGet('wiki_versions',`select=*&id=eq.${verId}`).catch(()=>[]);
  const v=r?.[0]; if(!v) return;
  _wikiViewText = v.content_text||'';
  _wikiViewName = `versi_${(v.version||'1').replace(/[^\w.]/g,'')}.md`;
  openModal(`
    <div class="modal-header"><div class="modal-title">Isi Versi v${v.version||''}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="wiki-out">${wikiMd(_wikiViewText)}</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-outline btn-sm" onclick="wikiCopy(_wikiViewText)">${svgIcon('note',13)} Salin</button>
      <button class="btn btn-teal btn-sm" onclick="wikiDownload(_wikiViewText,_wikiViewName)">${svgIcon('download',13)} Download</button>
    </div>`,'wide');
}
