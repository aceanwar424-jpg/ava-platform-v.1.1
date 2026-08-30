// ═══════════════════════════════════════════════════════════════
// AGENTIC — EDITOR DOKUMEN AI (halaman menetap, bukan modal)
//
// Sebelumnya editor ini modal — ditutup, progres hilang. Kini:
//   · HALAMAN penuh (di main-content), tidak hilang saat berpindah.
//   · Kiri: PRATINJAU dokumen jadi (Markdown ter-render) + tombol pengaturan.
//   · Kanan: CHAT dengan AI untuk perbaikan — riwayatnya TERSIMPAN per dokumen
//     (agentic.document_ai_chat), jadi saat dokumen dibuka lagi, percakapan &
//     progres masih ada. Buka dokumen lain → dokumen ini sudah tersimpan.
//   · Isi dokumen disimpan ke registry (full_text) tiap perubahan.
//
// ── Pagar kejujuran ───────────────────────────────────────────
// AI menyusun & merapikan, BUKAN sumber kebenaran. Nilai nyata (alat, ambang,
// penanggung jawab, nomor) dari praktik lab. Bagian [ISI: …] wajib dilengkapi
// manusia. Tiap keluaran draf yang harus diverifikasi orang kompeten.
// Butuh: supabase_agentic_doc_sign.sql (tabel chat) sudah dijalankan.
// ═══════════════════════════════════════════════════════════════

let _agAiEd = null;   // { docId, doc, content, prev, mode:'preview'|'edit', chat:[] }

// Struktur bagian SELARAS dengan placeholder template pemilik & sectionizer
// (AG_SECTION_KEYS di docs.js). Bila skema template berubah, ubah keduanya.
const AG_AI_SYS = 'Anda asisten penyunting dokumen SOP mutu laboratorium (ISO 15189). ' +
  'Diberi ISI DOKUMEN saat ini dan sebuah INSTRUKSI. Kembalikan SELURUH dokumen versi baru dalam Markdown. ' +
  'Awali dengan "# " judul dokumen, lalu bagian-bagian ini memakai heading "## " PERSIS dengan nama ini, ' +
  'berurutan: ## Tujuan, ## Ruang Lingkup, ## Penanggung Jawab, ## Referensi, ## Ikhtisar Umum, ' +
  '## Glosarium, ## Dokumen Terkait, ## Isi Prosedur, ## Diagram Alur, ## Indikator Kinerja (KPI), ' +
  '## Penanganan Ketidaksesuaian, ## CAPA, ## Pelaporan Insiden, ## Pengelolaan Arsip. ' +
  'Untuk Diagram Alur, tuliskan alur sebagai langkah bernomor/teks (bukan gambar). ' +
  'ATURAN KERAS: JANGAN mengarang nilai spesifik (nama alat, ambang, nomor, nama orang, tanggal, target KPI) ' +
  'yang tidak ada dalam isi. Bila sebuah bagian butuh data nyata dari lab, tulis penanda ' +
  '[ISI: keterangan singkat] agar diisi manusia. Jangan menghapus bagian yang sudah ada isinya. ' +
  'Balas HANYA isi dokumen Markdown, tanpa basa-basi, tanpa blok kode.';

async function agAiEditorOpen(docId){
  const d = agRegistry.find(x => x.id === docId);
  if(!d){ toast('Dokumen tak ditemukan','err'); return; }
  const content = (d.extracted_meta && d.extracted_meta.full_text) || '';
  _agAiEd = { docId, doc:d, content, prev:null, mode:'preview', chat:[] };
  window.currentPage = 'agentic';

  // Muat riwayat chat tersimpan (bila tabelnya ada).
  try { _agAiEd.chat = await agRpc('agentic_doc_chat_list', { p_doc: docId }) || []; }
  catch(e){ _agAiEd.chat = []; _agAiEd.noChatTable = true; }

  agAiEditorRender();
}

// Sorot penanda [ISI: …] pada dokumen ter-render agar bagian yang perlu diisi
// manusia langsung terlihat saat review (bukan tersembunyi di tengah teks).
function agAiHighlightGaps(html){
  return String(html).replace(/\[ISI:([^\]]*)\]/g,
    '<mark style="background:var(--warn-soft);color:var(--warn-deeper);border:1px solid var(--gold);border-radius:4px;padding:0 5px;font-weight:700;font-style:normal">✎ ISI:$1</mark>');
}
function agAiCountGaps(text){ return (String(text||'').match(/\[ISI:[^\]]*\]/g)||[]).length; }

function agAiEditorRender(){
  const st = _agAiEd; if(!st) return;
  const host = document.getElementById('main-content'); if(!host) return;
  const isPdf = /\.pdf$/i.test(st.doc.source_file_path || '');
  const kosong = (st.content||'').trim().length < 200;
  const gaps = agAiCountGaps(st.content);

  host.innerHTML = `
    <div class="lis-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#0b1526,#0f2038);color:var(--on-accent);border-radius:10px;padding:9px 14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <button class="btn btn-ghost btn-sm" style="color:var(--on-accent);border-color:rgba(255,255,255,.2)" onclick="agAiEditorBack()">← Dokumen QMS</button>
        <div style="min-width:0">
          <h1 style="margin:0;font-size:14px;color:var(--on-accent);font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60vw">${agEsc(st.doc.title)}</h1>
          <span style="font-size:11px;color:#9db4d0">${agEsc(st.doc.doc_type)} L${st.doc.doc_level} · ${agEsc(st.doc.department||'')} · Editor Dokumen AI</span>
        </div>
      </div>
      <span style="font-size:11px;color:#cfe0f2" id="ag-ed-saved">tersimpan otomatis</span>
    </div>

    <div class="status-box status-warn" style="font-size:11px;margin-bottom:10px">
      AI menyusun & merapikan — <b>bukan sumber kebenaran</b>. Nilai nyata (alat, ambang, penanggung jawab)
      dari praktik lab Anda. Bagian <code>[ISI: …]</code> wajib dilengkapi. Draf ini perlu diverifikasi.
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:12px;align-items:start">
      <!-- KIRI: dokumen + pengaturan -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:11px;font-weight:800;color:var(--gray);text-transform:uppercase;letter-spacing:.4px">
            ${st.mode==='preview'?'Pratinjau Dokumen':'Sunting Teks (Markdown)'} · ${(st.content||'').length.toLocaleString('id-ID')} karakter
            ${gaps?`<span style="color:var(--warn-deeper);background:var(--warn-soft);border-radius:8px;padding:1px 7px;margin-left:6px;text-transform:none;letter-spacing:0">✎ ${gaps} bagian perlu diisi</span>`:''}</div>
          <div style="display:flex;gap:6px">
            ${st.prev!=null?`<button class="ag-btn mut" style="padding:3px 9px;font-size:10.5px" onclick="agAiEditorUndo()">↶ Batalkan</button>`:''}
            <button class="ag-btn mut" style="padding:3px 9px;font-size:10.5px" onclick="agAiEditorToggle()">${st.mode==='preview'?'✏️ Sunting teks':'👁 Pratinjau'}</button>
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:10px;background:var(--white);min-height:52vh;max-height:64vh;overflow:auto">
          ${st.mode==='preview'
            ? `<div style="padding:22px 26px;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.6;color:var(--ink-04)" class="ag-ed-doc">
                 ${kosong ? `<div style="color:var(--gray);font-style:italic;text-align:center;padding:40px">Dokumen masih kosong. ${isPdf?'Tekan "Tarik teks dari PDF" di kanan, atau ':''}minta AI menyusun, atau "Sunting teks".</div>` : agAiHighlightGaps(agMd(st.content))}
               </div>`
            : `<textarea id="ag-ed-textarea" oninput="_agAiEd.content=this.value" style="width:100%;min-height:52vh;border:0;outline:0;padding:16px 18px;font-family:ui-monospace,monospace;font-size:11.5px;line-height:1.55;resize:vertical">${agEsc(st.content||'')}</textarea>`}
        </div>

        <!-- PENGATURAN di bawah dokumen -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          ${isPdf ? `<button class="ag-btn pub" onclick="agAiEditorRun('pdftext')">${icon('file-text',13)} Tarik teks dari PDF</button>` : ''}
          <button class="ag-btn ${kosong?'pub':'mut'}" onclick="agAiEditorRun('autofill')">${icon('sparkles',13)} Susun/Lengkapi ke struktur SOP</button>
          <span style="flex:1"></span>
          <button class="ag-btn mut" onclick="agAiEditorSave(false)">💾 Simpan</button>
          <button class="ag-btn pub" onclick="agAiEditorSave(true)">${icon('file-text',13)} Review Final →</button>
        </div>
      </div>

      <!-- KANAN: chat -->
      <div style="border:1px solid var(--border);border-radius:10px;background:var(--white);display:flex;flex-direction:column;height:calc(64vh + 92px)">
        <div style="padding:9px 12px;border-bottom:1px solid var(--border);font-size:12px;font-weight:800;color:var(--navy-deep)">
          ${icon('sparkles',13)} Perbaikan dengan AI
          ${st.noChatTable?`<div style="font-size:10px;font-weight:400;color:var(--warn-deep)">Riwayat belum aktif — jalankan supabase_agentic_doc_sign.sql</div>`:''}
        </div>
        <div id="ag-ed-chat" style="flex:1;overflow-y:auto;padding:10px 12px"></div>
        <div style="border-top:1px solid var(--border);padding:9px 10px">
          <textarea id="ag-ed-instruct" rows="3" placeholder="mis. Lengkapi bagian Prosedur jadi langkah bernomor yang rinci; tambah bagian Keselamatan Kerja."
            style="width:100%;font-size:11.5px;padding:7px;border:1px solid var(--border);border-radius:7px;resize:none"></textarea>
          <button class="ag-btn pub" style="width:100%;margin-top:6px" onclick="agAiEditorRun('instruct')">${icon('refresh',13)} Terapkan Instruksi</button>
          <div id="ag-ed-status" style="font-size:11px;color:var(--gray);min-height:15px;margin-top:4px"></div>
        </div>
      </div>
    </div>`;
  agAiEditorPaintChat();
}

function agAiEditorPaintChat(){
  const el = document.getElementById('ag-ed-chat'); if(!el) return;
  const st = _agAiEd;
  if(!st.chat.length){
    el.innerHTML = `<div style="font-size:11.5px;color:var(--gray);font-style:italic">Belum ada percakapan. Beri instruksi di bawah, atau tekan "Susun/Lengkapi".</div>`;
    return;
  }
  el.innerHTML = st.chat.map(m=>{
    const me = m.role==='user';
    return `<div style="display:flex;justify-content:${me?'flex-end':'flex-start'};margin-bottom:7px">
      <div style="max-width:88%;font-size:11.5px;line-height:1.4;padding:7px 10px;border-radius:10px;
        ${me?'background:#0f766e;color:var(--on-accent)':'background:var(--bg2);color:var(--ink-04)'}">
        ${agEsc(m.content||'')}
        <div style="font-size:9px;opacity:.6;margin-top:3px">${m.created_at?new Date(m.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):''}</div>
      </div></div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function agAiEditorToggle(){
  const st = _agAiEd; if(!st) return;
  if(st.mode==='edit'){
    const ta = document.getElementById('ag-ed-textarea'); if(ta) st.content = ta.value;
  }
  st.mode = st.mode==='preview' ? 'edit' : 'preview';
  agAiEditorRender();
}

function agAiEditorUndo(){
  const st = _agAiEd; if(!st || st.prev==null) return;
  st.content = st.prev; st.prev = null;
  agAiEditorRender();
  agAiEditorPersist('save');   // simpan hasil undo
}

async function agAiEditorBack(){
  await agAiEditorPersist('save');   // pastikan tersimpan sebelum keluar
  if(typeof renderAgentic==='function') renderAgentic('docs');
}

// Simpan isi ke registry (dan segarkan salinan memori).
async function agAiEditorPersist(kind){
  const st = _agAiEd; if(!st) return false;
  if(st.mode==='edit'){ const ta=document.getElementById('ag-ed-textarea'); if(ta) st.content=ta.value; }
  try{
    await agRpc('agentic_doc_update', { p_id: st.docId, p: { extracted_meta: { full_text: st.content } } });
    const d = agRegistry.find(x=>x.id===st.docId);
    if(d) d.extracted_meta = Object.assign({}, d.extracted_meta, { full_text: st.content });
    const badge = document.getElementById('ag-ed-saved'); if(badge) badge.textContent = 'tersimpan ✓';
    return true;
  }catch(e){ toast('Gagal menyimpan: '+e.message,'err'); return false; }
}

async function agAiEditorChatAdd(role, text, kind){
  const st = _agAiEd;
  st.chat.push({ role, content:text, kind, created_at:new Date().toISOString() });
  agAiEditorPaintChat();
  try{ await agRpc('agentic_doc_chat_add', { p_doc: st.docId, p_role: role, p_content: text, p_kind: kind||null }); }catch(e){}
}

async function agAiEditorRun(kind){
  const st = _agAiEd; if(!st) return;
  const status = document.getElementById('ag-ed-status');
  const say = m => { if(status) status.textContent = m; };
  const busy = b => document.querySelectorAll('#main-content .ag-btn').forEach(x=>x.disabled=b);

  let instr = '';
  if(kind==='instruct'){
    instr = (document.getElementById('ag-ed-instruct')||{}).value?.trim();
    if(!instr){ say('Tulis instruksi dulu.'); return; }
  }
  if(st.mode==='edit'){ const ta=document.getElementById('ag-ed-textarea'); if(ta) st.content=ta.value; }

  try{
    busy(true);
    let out = '';
    if(kind==='pdftext'){
      say('Mengambil PDF & menarik teks (AI)…');
      await agAiEditorChatAdd('user','↳ Tarik teks penuh dari PDF sumber','pdftext');
      out = await agAiPdfText(st.doc);
    } else if(kind==='autofill'){
      say('Menyusun ke struktur SOP…');
      await agAiEditorChatAdd('user','↳ Susun/lengkapi ke struktur SOP','autofill');
      out = await agLLMText(AG_AI_SYS,
        `INSTRUKSI: Susun/rapikan menjadi struktur SOP baku yang lengkap. Pertahankan semua isi nyata; untuk yang belum ada beri [ISI: …]. Judul: "${st.doc.title}".\n\nISI DOKUMEN SAAT INI:\n${st.content||'(kosong)'}`,
        'main', { maxTokens: 7000 });
    } else {
      say('Menerapkan instruksi…');
      await agAiEditorChatAdd('user', instr, 'instruct');
      const inp=document.getElementById('ag-ed-instruct'); if(inp) inp.value='';
      out = await agLLMText(AG_AI_SYS,
        `INSTRUKSI: ${instr}\n\nISI DOKUMEN SAAT INI:\n${st.content||'(kosong)'}`,
        'main', { maxTokens: 7000 });
    }
    out = String(out||'').replace(/^```(?:markdown|md)?\s*/i,'').replace(/```\s*$/,'').trim();
    if(!out){ say('AI tidak mengembalikan isi. Coba lagi.'); await agAiEditorChatAdd('ai','(tidak ada keluaran — coba lagi)','error'); return; }

    st.prev = st.content;
    st.content = out;
    await agAiEditorPersist('ai');                        // simpan isi baru
    await agAiEditorChatAdd('ai', `Dokumen diperbarui — ${out.length.toLocaleString('id-ID')} karakter. Tinjau di kiri.`, 'result');
    say('Selesai. Tinjau di kiri.');
    agAiEditorRender();
  }catch(e){
    say('❌ '+e.message);
    await agAiEditorChatAdd('ai','Gagal: '+e.message,'error');
  }finally{ busy(false); }
}

// Tarik teks penuh dari PDF sumber lewat gateway (Gemini menerima lampiran).
async function agAiPdfText(doc){
  const path = doc.source_file_path;
  if(!path) throw new Error('Dokumen ini tidak punya berkas PDF sumber');
  const buf = await agDownloadStorage(path);
  const bytes = new Uint8Array(buf); let bin='';
  for(let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000));
  const b64 = btoa(bin);
  const sys = 'Transkripsikan SELURUH teks dokumen PDF terlampir APA ADANYA ke Markdown. Pertahankan judul, ' +
    'bagian bernomor, dan penomoran langkah. JANGAN meringkas/menambah/menghapus. Tabel tulis sebagai daftar rapi. Balas hanya teksnya.';
  return await agLLMText(sys, 'Transkripsikan berkas terlampir.', 'main',
    { maxTokens: 8000, files: [{ mime_type:'application/pdf', data:b64 }] });
}

async function agAiEditorSave(proceed){
  const ok = await agAiEditorPersist('save');
  if(!ok) return;
  toast('💾 Isi tersimpan','ok');
  if(proceed){
    const id = _agAiEd.docId;
    if(typeof renderAgentic==='function') renderAgentic('docs');
    if(typeof agOpenFinalReview==='function') setTimeout(()=>agOpenFinalReview(id), 300);
  }
}
