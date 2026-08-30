// ═══════════════════════════════════════════════════════════════
// AGENTIC — DETEKSI TUMPANG TINDIH ANTAR DOKUMEN (FASE 1)
//
// Deterministik, TANPA LLM, berjalan di peramban. Untuk ~200 dokumen, ~20 ribu
// pembandingan himpunan kecil selesai di bawah sedetik.
//
// Cara kerja (lihat AGENTIC_OVERLAP_DESIGN.md):
//   1. Setiap dokumen dijadikan HIMPUNAN istilah kunci + klausul ISO.
//   2. Istilah yang muncul di banyak dokumen (boilerplate: kop, format, kata
//      umum) DIBUANG — inilah yang mencegah semua SOP terlihat "mirip" hanya
//      karena berbagi struktur.
//   3. Kemiripan tiap pasangan = Jaccard istilah kunci (+ sedikit bobot klausul).
//   4. Pasangan di atas ambang disimpan untuk ditinjau MANUSIA.
//
// Sistem hanya MENANDAI. Keputusan gabung/hapus/biarkan ada di tangan manusia.
// Butuh: supabase_agentic_overlap.sql sudah dijalankan.
// ═══════════════════════════════════════════════════════════════

// Kata umum bahasa Indonesia + kata lazim dokumen mutu yang tak membedakan topik.
const AG_OV_STOP = new Set(('yang dan di ke dari untuk pada dengan ini itu atau ada adalah ' +
  'tidak akan telah sudah dapat bisa harus oleh dalam sebagai agar bila jika maka karena ' +
  'serta antara setiap seluruh semua para atas bawah kiri kanan yaitu ialah yakni juga ' +
  'dokumen prosedur sop instruksi kerja formulir halaman tanggal nomor revisi versi ' +
  'nama jabatan tujuan ruang lingkup referensi definisi tanggung jawab langkah proses ' +
  'terkait dibuat disetujui diperiksa disusun ditinjau berlaku efektif mutu ' +
  'laboratorium lab rumah sakit klinik unit bagian bidang seksi ' +
  'the of and to in for with this that is are be by on as').split(/\s+/));

function agOvTerms(text){
  const freq = {};
  const words = String(text || '').toLowerCase()
    .replace(/[^a-zÀ-ɏ\s]/g, ' ')   // hanya huruf (klausul ditangani terpisah)
    .split(/\s+/);
  for (const w of words){
    if (w.length < 4) continue;               // buang kata sangat pendek
    if (AG_OV_STOP.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return freq;
}

function agOvClauses(text){
  const set = new Set();
  const m = String(text || '').match(/\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\b/g) || [];
  m.forEach(c => set.add(c));
  return set;
}

function agOvJaccard(a, b){
  if (!a.size || !b.size) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (big.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// Bangun himpunan istilah kunci per dokumen dengan membuang boilerplate korpus.
function agOvBuildFeatures(docs){
  const perDoc = docs.map(d => ({
    id: d.id,
    freq: agOvTerms(d.extracted_meta && d.extracted_meta.full_text),
    clauses: agOvClauses(d.extracted_meta && d.extracted_meta.full_text),
  }));

  // Document frequency: berapa dokumen memuat tiap istilah.
  const df = {};
  for (const p of perDoc)
    for (const t in p.freq) df[t] = (df[t] || 0) + 1;

  const n = perDoc.length;
  const boilerplateCut = Math.max(3, Math.ceil(n * 0.5));  // muncul di >50% dokumen = boilerplate

  // Himpunan kunci = istilah non-boilerplate, ~40 teratas per bobot TF-IDF.
  return perDoc.map(p => {
    const scored = [];
    for (const t in p.freq){
      if (df[t] >= boilerplateCut) continue;
      const idf = Math.log(n / df[t]);
      scored.push([t, p.freq[t] * idf]);
    }
    scored.sort((x, y) => y[1] - x[1]);
    return { id: p.id, terms: new Set(scored.slice(0, 40).map(s => s[0])), clauses: p.clauses };
  });
}

// ── Pemindaian ────────────────────────────────────────────────
async function agOverlapScan(){
  const th = parseFloat((document.getElementById('ag-ov-th') || {}).value) || 0.5;
  const sameDept = !!(document.getElementById('ag-ov-samedept') || {}).checked;
  const body = document.getElementById('ag-ov-result');
  if (body) body.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

  // Dokumen berisi teks saja (yang kosong/scan-gagal tak bisa dibandingkan).
  const docs = (agRegistry || []).filter(d =>
    d.extracted_meta && d.extracted_meta.full_text &&
    String(d.extracted_meta.full_text).trim().length >= 200);

  if (docs.length < 2){
    if (body) body.innerHTML = `<div class="status-box status-warn">Butuh minimal 2 dokumen berteks. Yang tersedia: ${docs.length}. (Dokumen hasil scan tanpa teks tidak bisa dibandingkan.)</div>`;
    return;
  }

  const feats = agOvBuildFeatures(docs);
  const deptOf = {};
  docs.forEach(d => deptOf[d.id] = d.department || '');

  // Bandingkan tiap pasangan.
  const pairs = [];
  for (let i = 0; i < feats.length; i++){
    for (let j = i + 1; j < feats.length; j++){
      const A = feats[i], B = feats[j];
      if (sameDept && deptOf[A.id] !== deptOf[B.id]) continue;
      const termJ = agOvJaccard(A.terms, B.terms);
      if (termJ < 0.05) continue;   // lewati yang jelas tak beririsan (percepat)
      const clauseJ = (A.clauses.size && B.clauses.size) ? agOvJaccard(A.clauses, B.clauses) : null;
      const score = clauseJ == null ? termJ : (0.8 * termJ + 0.2 * clauseJ);
      if (score < th) continue;

      // Istilah & klausul yang beririsan (untuk tampilan).
      const shared = [];
      for (const t of A.terms) if (B.terms.has(t)) shared.push(t);
      const sc = [];
      for (const c of A.clauses) if (B.clauses.has(c)) sc.push(c);

      pairs.push({ doc_a: A.id, doc_b: B.id, score: Math.round(score * 1000) / 1000,
        shared_terms: shared.slice(0, 10), shared_clauses: sc.slice(0, 8) });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  try{
    await agRpc('agentic_overlap_save', { p_pairs: pairs });
    if (typeof logActivity === 'function')
      logActivity('overlap_scan', 'document_overlaps', 'scan',
        `Pindai tumpang tindih: ${docs.length} dokumen → ${pairs.length} pasangan ≥ ${th}`, '');
    toast(`Pindai selesai — ${pairs.length} pasangan mencurigakan dari ${docs.length} dokumen`, pairs.length ? 'warn' : 'ok');
  }catch(e){
    if (body) body.innerHTML = `<div class="status-box status-warn">Gagal menyimpan hasil — jalankan <code>supabase_agentic_overlap.sql</code> dulu.<div style="font-size:11px;color:var(--gray);margin-top:4px">${agEsc(e.message)}</div></div>`;
    return;
  }
  await agOverlapLoad();
}

// ── Muat & tampilkan pasangan tersimpan ───────────────────────
async function agOverlapLoad(){
  const body = document.getElementById('ag-ov-result'); if (!body) return;
  let rows = [];
  try{ rows = await agRpc('agentic_overlap_list', {}) || []; }
  catch(e){
    body.innerHTML = `<div class="status-box status-warn">Fitur belum aktif — jalankan <code>supabase_agentic_overlap.sql</code>.</div>`;
    return;
  }
  agOverlapPaint(rows);
}

function agOvTypeChip(t){
  const m = { DUPLIKAT:['#B91C1C','#FEE2E2'], KONFLIK:['#B91C1C','#FEE2E2'],
    SEBAGIAN:['#B45309','#FEF3C7'], PELENGKAP:['#15803D','#DCFCE7'] };
  const c = m[t]; if (!c) return '';
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${c[1]};color:${c[0]}">${t}</span>`;
}

function agOverlapPaint(rows){
  const body = document.getElementById('ag-ov-result'); if (!body) return;
  const aktif = rows.filter(r => r.status === 'DETECTED');
  const ditinjau = rows.filter(r => r.status !== 'DETECTED');

  if (!rows.length){
    body.innerHTML = `<div style="font-size:12px;color:var(--gray);font-style:italic">Belum ada hasil. Tekan "Pindai Sekarang" untuk memeriksa tumpang tindih antar dokumen.</div>`;
    return;
  }

  const rowHtml = (r, dim) => `
    <div style="border:1px solid var(--border);border-left:3px solid ${r.score>=0.7?'#B91C1C':r.score>=0.55?'#B45309':'#64748b'};
      border-radius:8px;padding:9px 11px;margin-bottom:7px;${dim?'opacity:.6':''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="font-size:11px;font-weight:800;color:var(--navy)">
          Kemiripan ${(r.score*100).toFixed(0)}%
          <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;${r.method==='semantic'?'background:var(--tint-03);color:var(--ink-20)':'background:#E0F2FE;color:var(--ink-17)'}">${r.method==='semantic'?'makna':'kata'}</span>
          ${agOvTypeChip(r.overlap_type)}
          ${r.status!=='DETECTED'?`<span style="font-size:10px;color:var(--gray);font-weight:600">· ${agEsc(r.status)}${r.reviewed_by?' oleh '+agEsc(r.reviewed_by):''}</span>`:''}
        </div>
        ${r.status==='DETECTED'?`<div style="display:flex;gap:5px">
          <button class="ag-btn mut" style="padding:3px 9px;font-size:10.5px" onclick="agOverlapMark('${r.id}','RESOLVED')">Ditindaklanjuti</button>
          <button class="ag-btn mut" style="padding:3px 9px;font-size:10.5px" onclick="agOverlapMark('${r.id}','DISMISSED')">Abaikan</button>
        </div>`:`<button class="ag-btn mut" style="padding:3px 9px;font-size:10.5px" onclick="agOverlapMark('${r.id}','DETECTED')">Buka lagi</button>`}
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-top:6px;font-size:11.5px">
        <div><b>${agEsc(r.a_number||'—')}</b> ${agEsc(r.a_title||'')}<div style="font-size:10px;color:var(--gray)">${agEsc(r.a_dept||'')}</div></div>
        <div style="color:var(--gray);font-weight:800">↔</div>
        <div><b>${agEsc(r.b_number||'—')}</b> ${agEsc(r.b_title||'')}<div style="font-size:10px;color:var(--gray)">${agEsc(r.b_dept||'')}</div></div>
      </div>
      ${(r.shared_terms&&r.shared_terms.length)?`<div style="font-size:10.5px;color:var(--text2);margin-top:5px">
        <span style="color:var(--gray)">Istilah beririsan:</span> ${r.shared_terms.map(t=>`<span style="background:#EEF2FF;color:var(--ink-05);padding:1px 6px;border-radius:8px;margin-right:3px">${agEsc(t)}</span>`).join('')}
        ${(r.shared_clauses&&r.shared_clauses.length)?` · <span style="color:var(--gray)">klausul:</span> ${r.shared_clauses.map(c=>agEsc(c)).join(', ')}`:''}</div>`:''}
      ${r.recommendation?`<div style="font-size:11px;color:var(--text2);margin-top:4px"><b>Anjuran:</b> ${agEsc(r.recommendation)}</div>`:''}
    </div>`;

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:10px">
      ${[['Perlu ditinjau',aktif.length,'#B45309'],['Kemiripan ≥70%',aktif.filter(r=>r.score>=0.7).length,'#B91C1C'],['Sudah ditinjau',ditinjau.length,'#15803D']]
        .map(k=>`<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid ${k[2]};border-radius:9px;padding:9px 11px">
          <div style="font-size:18px;font-weight:800;color:${k[2]}">${k[1]}</div>
          <div style="font-size:10px;color:var(--gray)">${k[0]}</div></div>`).join('')}
    </div>
    ${aktif.length?aktif.map(r=>rowHtml(r,false)).join(''):'<div style="font-size:12px;color:var(--gray);font-style:italic;margin-bottom:8px">Tidak ada pasangan yang perlu ditinjau.</div>'}
    ${ditinjau.length?`<div style="font-size:11px;font-weight:700;color:var(--gray);margin:10px 0 6px">Sudah ditinjau (${ditinjau.length})</div>${ditinjau.map(r=>rowHtml(r,true)).join('')}`:''}`;
}

async function agOverlapMark(id, status){
  try{
    await agRpc('agentic_overlap_status', { p_id: id, p_status: status,
      p_by: (typeof getUserName === 'function' ? getUserName() : null) });
    if (typeof logActivity === 'function')
      logActivity('overlap_'+status.toLowerCase(), 'document_overlaps', id, `Pasangan tumpang tindih: ${status}`, '');
    await agOverlapLoad();
  }catch(e){ toast('❌ ' + e.message, 'err'); }
}

// ── Bagian di dalam tab Review ────────────────────────────────
function agOverlapRenderSection(containerId){
  const el = document.getElementById(containerId); if (!el) return;
  const nText = (agRegistry || []).filter(d => d.extracted_meta && d.extracted_meta.full_text &&
    String(d.extracted_meta.full_text).trim().length >= 200).length;
  el.innerHTML = `
    <div class="ag-detail">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <div style="font-size:12px;font-weight:800;color:var(--navy-deep)">${typeof icon==='function'?icon('layers',14):''} Tumpang Tindih Dokumen</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <label style="font-size:11px;color:var(--gray);display:flex;align-items:center;gap:4px">Ambang
            <input id="ag-ov-th" type="number" min="0.3" max="0.95" step="0.05" value="0.5" style="width:64px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:11.5px"></label>
          <label style="font-size:11px;color:var(--gray);display:flex;align-items:center;gap:4px">
            <input id="ag-ov-samedept" type="checkbox"> hanya dept sama</label>
          <button class="ag-btn mut" style="padding:6px 12px" onclick="agOverlapScan()" title="Berbasis kesamaan KATA (Jaccard) — cepat, tanpa AI, tanpa indeks">${typeof icon==='function'?icon('refresh',13):''} Pindai Kata</button>
          <button class="ag-btn pub" style="padding:6px 12px" onclick="agOverlapScanSemantic()" title="Berbasis kesamaan MAKNA (embedding) — butuh dokumen diindeks di Tanya Dokumen">${typeof icon==='function'?icon('sparkles',13):''} Pindai Makna (AI)</button>
        </div>
      </div>
      <div style="font-size:10.5px;color:var(--gray);margin-bottom:8px">
        <b>Pindai Kata</b>: cepat, dari kesamaan istilah &amp; klausul (${nText} dokumen berteks). <b>Pindai Makna</b>:
        menangkap SOP yang bermakna sama walau katanya beda — butuh dokumen diindeks dulu (Tanya Dokumen → Indeks).
        Untuk makna, mulai ambang tinggi (mis. 0,82). Hasil bersifat <b>anjuran</b>.
      </div>
      <div id="ag-ov-result"></div>
    </div>`;
  agOverlapLoad();
}

// Pindai berbasis makna (embedding centroid) — perhitungan di Postgres.
async function agOverlapScanSemantic(){
  let th = parseFloat((document.getElementById('ag-ov-th') || {}).value);
  if(!(th>0)) th = 0.82;
  if(th < 0.6 && !confirm(`Ambang makna ${th} cukup rendah — bisa banyak positif palsu. Lanjut?\n(Saran: 0,80–0,88)`)) return;
  const body = document.getElementById('ag-ov-result');
  if(body) body.innerHTML = `<div class="loading-row"><div class="spinner"></div></div><div style="text-align:center;font-size:11px;color:var(--gray)">membandingkan makna dokumen…</div>`;
  try{
    const r = await agRpc('agentic_overlap_scan_semantic', { p_threshold: th });
    if(r && r.note){ if(body) body.innerHTML = `<div class="status-box status-warn">${agEsc(r.note)}</div>`; return; }
    if(typeof logActivity==='function') logActivity('overlap_semantic','document_overlaps','scan',`Pindai makna: ${(r&&r.inserted)||0} pasangan ≥ ${th} dari ${(r&&r.docs)||0} dok`,'');
    toast(`Pindai makna selesai — ${(r&&r.inserted)||0} pasangan baru (${(r&&r.docs)||0} dokumen terindeks)`, (r&&r.inserted)?'warn':'ok');
    await agOverlapLoad();
  }catch(e){
    if(body) body.innerHTML = `<div class="status-box status-warn">Gagal — pastikan <code>supabase_agentic_overlap.sql</code> (Fase 2) &amp; <code>supabase_agentic_rag.sql</code> sudah dijalankan, dan dokumen sudah diindeks.<div style="font-size:11px;color:var(--gray);margin-top:4px">${agEsc(e.message)}</div></div>`;
  }
}
