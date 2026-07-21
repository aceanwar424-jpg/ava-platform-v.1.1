// ═══════════════════════════════════════════════════════════════
// AGENTIC — EDITOR DOKUMEN AI (interaktif, ala Claude/ChatGPT)
//
// Menjawab dua hal:
//   1. Banyak dokumen isinya kurang — terutama PDF, yang saat ingest hanya
//      diambil METADATA-nya (teks badan tidak tersimpan). Editor ini bisa
//      MENARIK teks penuh dari PDF sumber lewat AI.
//   2. Perbaikan (repair) selama ini satu-tembak di latar. Di sini prosesnya
//      INTERAKTIF: Anda beri instruksi, lihat hasilnya, ulangi, baru simpan —
//      sekalian meninjau.
//
// ── Pagar yang wajib disadari ─────────────────────────────────
// AI di sini MENYUSUN & MERAPIKAN, bukan sumber kebenaran. Untuk SOP mutu, isi
// prosedur yang sebenarnya (alat, ambang nilai, penanggung jawab, nomor)
// datang dari praktik lab Anda — BUKAN karangan AI. Bila AI tidak punya dasar,
// ia diminta menandai [ISI: …] agar diisi manusia, bukan mengarang. Setiap
// keluaran adalah DRAF yang harus diverifikasi orang yang kompeten.
// ═══════════════════════════════════════════════════════════════

let _agAiEd = null;   // { docId, doc, content, prev, log:[] }

const AG_AI_SYS = 'Anda asisten penyunting dokumen SOP mutu laboratorium (ISO 15189). ' +
  'Diberi ISI DOKUMEN saat ini dan sebuah INSTRUKSI. Kembalikan SELURUH dokumen versi baru ' +
  'dalam Markdown, mempertahankan struktur baku: Judul, lalu bagian bernomor ## 1. Tujuan, ' +
  '## 2. Ruang Lingkup, ## 3. Referensi, ## 4. Definisi, ## 5. Tanggung Jawab, ## 6. Prosedur, ' +
  '## 7. Dokumen Terkait (sesuaikan bila dokumen memang berbeda jenis). ' +
  'ATURAN KERAS: JANGAN mengarang nilai spesifik (nama alat, ambang, nomor, nama orang, tanggal) ' +
  'yang tidak ada dalam isi. Bila sebuah bagian butuh data nyata dari lab, tulis penanda ' +
  '[ISI: keterangan singkat] agar diisi manusia. Balas HANYA isi dokumen Markdown, tanpa basa-basi, ' +
  'tanpa blok kode.';

async function agAiEditorOpen(docId){
  const d = agRegistry.find(x => x.id === docId);
  if(!d){ toast('Dokumen tak ditemukan','err'); return; }
  const content = (d.extracted_meta && d.extracted_meta.full_text) || '';
  _agAiEd = { docId, doc:d, content, prev:null, log:[] };

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${typeof icon==='function'?icon('sparkles',16):''} Editor Dokumen AI</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="font-size:12px;margin-bottom:6px"><b>${agEsc(d.title)}</b>
      <span style="color:var(--gray)"> · ${agEsc(d.doc_type)} L${d.doc_level} · ${agEsc(d.department||'')}</span></div>
    <div class="status-box status-warn" style="font-size:11px;margin-bottom:8px">
      AI menyusun & merapikan — <b>bukan sumber kebenaran</b>. Isi prosedur nyata (alat, ambang, penanggung jawab)
      harus dari praktik lab Anda. Bagian bertanda <code>[ISI: …]</code> wajib Anda lengkapi. Draf ini perlu diverifikasi.
    </div>
    <div id="ag-ai-body"></div>
    <div class="modal-footer" id="ag-ai-foot"></div>`, 'wide');
  agAiEditorRender();
}

function agAiEditorRender(){
  const st = _agAiEd; if(!st) return;
  const body = document.getElementById('ag-ai-body');
  const foot = document.getElementById('ag-ai-foot');
  const isPdf = /\.pdf$/i.test(st.doc.source_file_path || '');
  const kosong = (st.content||'').trim().length < 200;

  if(body) body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 300px;gap:12px">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <label style="font-size:11px;font-weight:700;color:var(--gray)">ISI DOKUMEN (Markdown) — ${(st.content||'').length.toLocaleString('id-ID')} karakter</label>
          ${st.prev!=null?`<button class="ag-btn mut" style="padding:3px 9px;font-size:10.5px" onclick="agAiEditorUndo()">↶ Batalkan perubahan terakhir</button>`:''}
        </div>
        <textarea id="ag-ai-content" rows="18" oninput="_agAiEd.content=this.value"
          style="width:100%;font-family:ui-monospace,monospace;font-size:11.5px;line-height:1.5;padding:9px;border:1px solid var(--border);border-radius:8px;resize:vertical"
          placeholder="Isi dokumen kosong. Tarik dari PDF, atau susun otomatis, atau ketik sendiri.">${agEsc(st.content||'')}</textarea>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:11px;font-weight:800;color:#0A2342">Perintah ke AI</div>
        ${isPdf && kosong ? `<button class="ag-btn pub" onclick="agAiEditorRun('pdftext')">${typeof icon==='function'?icon('file-text',13):''} Tarik teks penuh dari PDF</button>` : ''}
        <button class="ag-btn ${kosong?'pub':'mut'}" onclick="agAiEditorRun('autofill')">${typeof icon==='function'?icon('sparkles',13):''} Susun/Lengkapi ke struktur SOP</button>
        <textarea id="ag-ai-instruct" rows="3" placeholder="mis. Lengkapi bagian Prosedur jadi langkah bernomor yang rinci; tambah bagian Keselamatan Kerja."
          style="width:100%;font-size:11.5px;padding:7px;border:1px solid var(--border);border-radius:7px;resize:vertical"></textarea>
        <button class="ag-btn pub" onclick="agAiEditorRun('instruct')">${typeof icon==='function'?icon('refresh',13):''} Terapkan Instruksi</button>
        <div id="ag-ai-status" style="font-size:11px;color:var(--gray);min-height:16px"></div>
        ${st.log.length?`<div style="font-size:10.5px;color:var(--gray);border-top:1px solid var(--border);padding-top:6px">
          <b>Riwayat:</b><br>${st.log.slice(-6).map(l=>`· ${agEsc(l)}`).join('<br>')}</div>`:''}
      </div>
    </div>`;

  if(foot) foot.innerHTML = `
    <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    <button class="btn btn-ghost" onclick="agAiEditorSave(false)">💾 Simpan Isi</button>
    <button class="btn btn-teal" onclick="agAiEditorSave(true)">Simpan &amp; Review Final →</button>`;
}

function agAiEditorUndo(){
  const st = _agAiEd; if(!st || st.prev==null) return;
  st.content = st.prev; st.prev = null;
  st.log.push('dibatalkan');
  agAiEditorRender();
}

async function agAiEditorRun(kind){
  const st = _agAiEd; if(!st) return;
  const status = document.getElementById('ag-ai-status');
  const say = m => { if(status) status.textContent = m; };
  const setBusy = b => { document.querySelectorAll('#ag-ai-body button, #ag-ai-foot button').forEach(x=>x.disabled=b); };

  try{
    setBusy(true);
    let out = '';
    if(kind === 'pdftext'){
      say('Mengambil PDF & menarik teks (AI)…');
      out = await agAiPdfText(st.doc);
      st.log.push('tarik teks dari PDF');
    } else if(kind === 'autofill'){
      say('Menyusun ke struktur SOP…');
      out = await agLLMText(AG_AI_SYS,
        `INSTRUKSI: Susun/rapikan menjadi struktur SOP baku yang lengkap. Pertahankan semua isi nyata; untuk yang belum ada, beri penanda [ISI: …]. Judul dokumen: "${st.doc.title}".\n\nISI DOKUMEN SAAT INI:\n${st.content || '(kosong)'}`,
        'main', { maxTokens: 7000 });
      st.log.push('susun ke struktur SOP');
    } else {
      const ins = (document.getElementById('ag-ai-instruct')||{}).value?.trim();
      if(!ins){ say('Tulis instruksi dulu.'); setBusy(false); return; }
      say('Menerapkan instruksi…');
      out = await agLLMText(AG_AI_SYS,
        `INSTRUKSI: ${ins}\n\nISI DOKUMEN SAAT INI:\n${st.content || '(kosong)'}`,
        'main', { maxTokens: 7000 });
      st.log.push(ins.slice(0, 60));
    }
    out = String(out||'').replace(/^```(?:markdown|md)?\s*/i,'').replace(/```\s*$/,'').trim();
    if(!out){ say('AI tidak mengembalikan isi. Coba lagi.'); setBusy(false); return; }
    st.prev = st.content;      // simpan untuk undo satu langkah
    st.content = out;
    say('Selesai. Tinjau di kolom kiri.');
    agAiEditorRender();
  }catch(e){
    say('❌ ' + e.message);
  }finally{ setBusy(false); }
}

// Tarik teks penuh dari PDF sumber lewat gateway (Gemini menerima lampiran).
async function agAiPdfText(doc){
  const path = doc.source_file_path;
  if(!path) throw new Error('Dokumen ini tidak punya berkas PDF sumber');
  const buf = await agDownloadStorage(path);
  // arrayBuffer → base64 (potong per blok agar tidak meledak di string besar)
  const bytes = new Uint8Array(buf); let bin = '';
  for(let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000));
  const b64 = btoa(bin);
  const sys = 'Transkripsikan SELURUH teks dokumen PDF terlampir APA ADANYA ke Markdown. Pertahankan judul, ' +
    'bagian bernomor, dan penomoran langkah. JANGAN meringkas, JANGAN menambah, JANGAN menghapus. ' +
    'Bila ada tabel, tuliskan sebagai daftar rapi. Balas hanya teksnya.';
  return await agLLMText(sys, 'Transkripsikan berkas terlampir.', 'main',
    { maxTokens: 8000, files: [{ mime_type:'application/pdf', data:b64 }] });
}

async function agAiEditorSave(proceed){
  const st = _agAiEd; if(!st) return;
  const content = (document.getElementById('ag-ai-content')||{}).value ?? st.content;
  if(!content.trim()){ toast('Isi masih kosong','warn'); return; }
  try{
    await agRpc('agentic_doc_update', { p_id: st.docId, p: { extracted_meta: { full_text: content } } });
    // segarkan salinan memori supaya Review Final memakai isi terbaru
    const d = agRegistry.find(x=>x.id===st.docId);
    if(d){ d.extracted_meta = Object.assign({}, d.extracted_meta, { full_text: content }); }
    if(typeof logActivity==='function')
      logActivity('doc_ai_edit','document_registry',st.docId,`Isi dokumen disunting via Editor AI (${content.length} karakter)`,st.doc.title);
    toast('💾 Isi tersimpan','ok');
    if(proceed){
      closeModalForce();
      if(typeof agOpenFinalReview==='function') agOpenFinalReview(st.docId);
    }
  }catch(e){ toast('❌ '+e.message,'err'); }
}
