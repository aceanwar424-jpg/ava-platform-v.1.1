// Supabase Edge Function: agentic-worker
// ─────────────────────────────────────────────────────────────────────
// Worker tick — pengganti BullMQ worker (Supabase-native).
// Dipicu oleh pg_cron (tiap menit) atau invoke manual. TIDAK loop bebas:
// sekali dipanggil → ambil maksimal N task → proses → berhenti (§1.2).
//
// Alur per task (§4.2):
//   claim_task()  : QUEUED → PROCESSING   (atomik, FOR UPDATE SKIP LOCKED)
//   handler       : kerjakan
//   transition_task(): PROCESSING → DRAFT | FAILED  (+ audit ke task_events)
//
// FASE 0: hanya handler SMOKE_TEST (memvalidasi rantai API→queue→worker→LLM
// gateway→DRAFT). Handler DOC_*/MAKE_* menyusul di Fase 2 & 3.
//
// REQUEST (opsional): { max?:number, agent?:'DOCUMENT'|'CONTENT' }
// RESPONSE: { processed, results:[{taskId,status,note}] }
// ─────────────────────────────────────────────────────────────────────

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WORKER_ID = `edge-${crypto.randomUUID().slice(0, 8)}`;
const MAX_PER_TICK = parseInt(Deno.env.get('WORKER_CONCURRENCY') || '2', 10);

// Semua akses DB lewat wrapper RPC di schema public (tabel tetap di schema
// agentic) — jadi tidak perlu mengubah "Exposed schemas" di dashboard.
async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.hint || `RPC ${fn} gagal (HTTP ${res.status})`);
  return data;
}

// Satu-satunya jalan ke LLM (§1.4) — lewat llm-gateway, bukan API provider langsung.
// Timeout backstop: bila gateway sendiri macet, task tetap ditutup FAILED
// (bukan menggantung PROCESSING sampai invocation dibunuh).
async function askLLM(payload: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(`${SB_URL}/functions/v1/llm-gateway`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(130_000),
    });
  } catch (e) {
    const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new Error(timedOut ? 'llm-gateway timeout 130s — coba Retry; bila berulang cek model/key di Secrets'
      : (e instanceof Error ? e.message : 'network error ke llm-gateway'));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `llm-gateway HTTP ${res.status}`);
  return data;
}

// ── UTIL ─────────────────────────────────────────────────────────────
type Task = { id: string; agent: string; task_type: string; title: string; payload: Record<string, unknown> };
type Dict = Record<string, unknown>;

// Isi {{placeholder}} pada template prompt (§4.10)
function fillTemplate(tpl: string, vars: Dict): string {
  return String(tpl || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] === undefined || vars[k] === null ? '-' : String(vars[k]));
}

// Parse JSON dari output LLM: buang pagar ```json, ambil blok { } / [ ] pertama (§9.1)
function parseJSONLoose(text: string): unknown {
  let s = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch { /* lanjut cari blok */ }
  const iO = s.indexOf('{'), iA = s.indexOf('[');
  const start = (iA >= 0 && (iA < iO || iO < 0)) ? iA : iO;
  if (start < 0) throw new Error('Output LLM bukan JSON');
  const close = s[start] === '[' ? ']' : '}';
  const end = s.lastIndexOf(close);
  if (end <= start) throw new Error('Output LLM bukan JSON utuh');
  return JSON.parse(s.slice(start, end + 1));
}

// Ambil prompt template dari DB; error jelas bila seed belum jalan
async function getPrompt(code: string): Promise<Dict> {
  const p = await rpc('agentic_get_prompt', { p_code: code });
  if (!p) throw new Error(`Prompt template '${code}' tidak ditemukan — jalankan supabase_agentic_fase12.sql`);
  return p as Dict;
}

// Panggil LLM dengan template + validasi JSON (retry 1x dgn pesan error, §9.1)
async function askLLMJson(t: Task, tpl: Dict, vars: Dict, opts: Dict = {}) {
  const base = {
    taskId: t.id,
    tier: tpl.model_hint === 'light' ? 'light' : 'main',
    temperature: Number(tpl.temperature ?? 0.2),
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), vars),
    ...opts,
  };
  let r = await askLLM(base);
  try { return { data: parseJSONLoose(String(r.text)), provider: r.provider, model: r.model }; }
  catch (e1) {
    const msg = e1 instanceof Error ? e1.message : String(e1);
    r = await askLLM({ ...base, cacheable: false,
      prompt: base.prompt + `\n\nOUTPUT SEBELUMNYA GAGAL DIPARSE (${msg}). Ulangi — balas HANYA JSON valid.` });
    return { data: parseJSONLoose(String(r.text)), provider: r.provider, model: r.model };
  }
}

// Unduh file dari Storage bucket "agentic" → base64 (untuk ingest PDF via Gemini)
async function storageBase64(path: string): Promise<string> {
  const res = await fetch(`${SB_URL}/storage/v1/object/agentic/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Gagal unduh storage agentic/${path} (HTTP ${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

// ── HANDLERS ─────────────────────────────────────────────────────────
async function handleSmokeTest(t: Task) {
  const useLLM = t.payload?.use_llm !== false;
  if (!useLLM) {
    return { result: { ok: true, mode: 'dummy', echo: t.payload ?? {} }, note: 'Smoke test dummy (tanpa LLM)' };
  }
  const r = await askLLM({
    taskId: t.id,
    tier: 'light',
    cacheable: true,
    temperature: 0,
    maxTokens: 64,
    system: 'Jawab sangat singkat, tanpa penjelasan tambahan.',
    prompt: String(t.payload?.prompt || 'Balas persis satu kata: OK'),
  });
  return {
    result: { ok: true, mode: 'llm', provider: r.provider, model: r.model, cached: !!r.cached, text: r.text },
    note: `LLM ${r.provider}/${r.model}${r.cached ? ' (cache)' : ''} · ${r.latencyMs ?? 0}ms`,
  };
}

// ═══ FASE 2 — DOCUMENT COMPLIANCE AGENT (§5.1) ═══════════════════════

// DOC_INGEST: teks dokumen (dari browser) / PDF (dari Storage) → metadata LLM
// → document_registry (DISCOVERED). Format tidak standar → NEEDS_REPAIR +
// auto-task DOC_REPAIR. payload.enqueue_gap=true → auto-antri GAP_ANALYSIS.
async function handleDocIngest(t: Task) {
  const p = t.payload || {};
  const fileName = String(p.file_name || 'dokumen');
  let text = String(p.text || '');
  const storagePath = String(p.storage_path || '');

  const tpl = await getPrompt('DOC_INGEST_META');
  let meta: Dict;
  if (text) {
    const { data } = await askLLMJson(t, tpl, { file_name: fileName, text: text.slice(0, 60000) }, { cacheable: true });
    meta = data as Dict;
  } else if (storagePath && /\.pdf$/i.test(storagePath)) {
    // PDF: kirim langsung ke LLM sebagai lampiran (gateway memaksa Gemini utk files)
    const b64 = await storageBase64(storagePath);
    const r = await askLLM({
      taskId: t.id, tier: 'light', temperature: Number(tpl.temperature ?? 0.2),
      system: String(tpl.system_prompt || ''),
      prompt: fillTemplate(String(tpl.user_prompt_template || ''), { file_name: fileName, text: '(lihat lampiran PDF)' }),
      files: [{ mime_type: 'application/pdf', data: b64 }],
    });
    meta = parseJSONLoose(String(r.text)) as Dict;
  } else {
    throw new Error('Payload ingest butuh "text" (hasil ekstraksi browser) atau "storage_path" PDF di bucket agentic');
  }

  const formatOk = meta.format_ok !== false;
  const reg = await rpc('agentic_registry_upsert', { p: {
    title: meta.title || fileName,
    doc_type: meta.doc_type || 'SOP',
    doc_level: meta.doc_level || 2,
    department: meta.department || 'MUTU',
    doc_number: meta.doc_number || null,
    iso_clause: meta.iso_clause || null,
    effective_date: meta.effective_date || null,
    status: formatOk ? 'DISCOVERED' : 'NEEDS_REPAIR',
    source_file_path: storagePath || null,
    gap_notes: formatOk ? null : String(meta.format_issues || 'Format tidak standar'),
    extracted_meta: { ...meta, full_text: text.slice(0, 200000), file_name: fileName },
  }}) as Dict;

  let extra = '';
  if (!formatOk && reg?.id) {
    await rpc('agentic_create_task', {
      p_agent: 'DOCUMENT', p_task_type: 'DOC_REPAIR',
      p_title: `Perbaiki format: ${meta.title || fileName}`,
      p_payload: { document_id: reg.id, mode: 'format_fix', prompt_code: 'DOC_REPAIR_SOP' },
    });
    extra += ' · auto-task DOC_REPAIR';
  }
  if (p.enqueue_gap === true) {
    await rpc('agentic_create_task', {
      p_agent: 'DOCUMENT', p_task_type: 'GAP_ANALYSIS',
      p_title: 'Gap analysis otomatis pasca-ingest', p_payload: {},
    });
    extra += ' · auto-task GAP_ANALYSIS';
  }
  return {
    result: { document_id: reg?.id, meta, format_ok: formatOk },
    note: `Ingest "${meta.title || fileName}" → ${formatOk ? 'DISCOVERED' : 'NEEDS_REPAIR'}${extra}`,
  };
}

// GAP_ANALYSIS: checklist aktif × inventaris dokumen → LLM matching
// (batch 10 klausul/panggilan §5.1) → agentic_gap_apply (MISSING + auto-task).
async function handleGapAnalysis(t: Task) {
  const data = await rpc('agentic_gap_data', {}) as Dict;
  const checklist = (data?.checklist || []) as Dict[];
  const documents = (data?.documents || []) as Dict[];
  if (!checklist.length) {
    return { result: { matched: 0 }, note: 'Checklist kosong — jalankan seed supabase_agentic_fase12.sql' };
  }

  const tpl = await getPrompt('GAP_ANALYSIS_MATCH');
  const docsJson = JSON.stringify(documents.map((d) => ({
    id: d.id, title: d.title, doc_type: d.doc_type, department: d.department, iso_clause: d.iso_clause })));

  const matches: Dict[] = [];
  for (let i = 0; i < checklist.length; i += 10) {
    const batch = checklist.slice(i, i + 10).map((c) => ({
      checklist_id: c.id, clause_ref: c.clause_ref, requirement: c.requirement,
      required_doc_type: c.required_doc_type, department: c.department }));
    const { data: out } = await askLLMJson(t, tpl,
      { clauses: JSON.stringify(batch), documents: docsJson }, { cacheable: true });
    if (Array.isArray(out)) matches.push(...(out as Dict[]));
  }

  const applied = await rpc('agentic_gap_apply', { p: { matches } }) as Dict;
  return {
    result: { ...applied, clauses: checklist.length, documents: documents.length },
    note: `Gap analysis: ${checklist.length} klausul · match ${applied?.matched ?? 0} · missing ${applied?.missing_created ?? 0} · task baru ${applied?.tasks_created ?? 0}`,
  };
}

// DOC_REPAIR: dokumen registry → LLM perbaikan format (Firewall Isi vs Format
// + placeholder policy di template) → markdown DRAFT.
async function handleDocRepair(t: Task) {
  const p = t.payload || {};
  const docId = String(p.document_id || '');
  if (!docId) throw new Error('payload.document_id wajib untuk DOC_REPAIR');
  const doc = await rpc('agentic_doc_get', { p_id: docId }) as Dict;
  if (!doc) throw new Error(`Dokumen ${docId} tidak ditemukan di registry`);

  const em = (doc.extracted_meta || {}) as Dict;
  const source = String(em.full_text || '');
  if (!source) throw new Error('Teks sumber dokumen kosong — ulangi ingest dengan ekstraksi teks (docx/txt), atau isi extracted_meta.full_text');

  const tpl = await getPrompt(String(p.prompt_code || 'DOC_REPAIR_SOP'));
  const r = await askLLM({
    taskId: t.id, tier: tpl.model_hint === 'light' ? 'light' : 'main',
    temperature: Number(tpl.temperature ?? 0.4), maxTokens: 8192,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), {
      title: doc.title, doc_type: doc.doc_type, doc_level: doc.doc_level,
      department: doc.department, iso_clause: doc.iso_clause,
      mode: p.mode || 'format_fix',
      rejection_feedback: p.rejection_feedback || '-',
      gap_notes: doc.gap_notes || '-',
      source_text: source.slice(0, 100000),
    }),
  });
  const markdown = String(r.text || '').trim();
  if (markdown.length < 100) throw new Error('Hasil repair terlalu pendek — kemungkinan output LLM tidak valid');

  await rpc('agentic_doc_update', { p_id: docId, p: { status: 'DRAFT', linked_task_id: t.id } });
  const placeholders = (markdown.match(/\[\[KONFIRMASI:/g) || []).length;
  return {
    result: { document_id: docId, markdown, mode: p.mode || 'format_fix',
      change_note: `Repair (${p.mode || 'format_fix'}) via ${r.provider}/${r.model}`, placeholders },
    note: `Repair "${doc.title}" · ${markdown.length} char · ${placeholders} placeholder konfirmasi`,
  };
}

// DOC_GENERATE: klausul checklist tanpa dokumen → LLM susun draft dokumen baru.
async function handleDocGenerate(t: Task) {
  const p = t.payload || {};
  const clId = String(p.checklist_id || '');
  if (!clId) throw new Error('payload.checklist_id wajib untuk DOC_GENERATE');
  const cl = await rpc('agentic_checklist_get', { p_id: clId }) as Dict;
  if (!cl) throw new Error(`Checklist ${clId} tidak ditemukan`);

  const tpl = await getPrompt('DOC_GENERATE_SOP');
  const r = await askLLM({
    taskId: t.id, tier: 'main',
    temperature: Number(tpl.temperature ?? 0.4), maxTokens: 8192,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), {
      framework: cl.framework, clause_ref: cl.clause_ref, requirement: cl.requirement,
      doc_type: p.doc_type || cl.required_doc_type || 'SOP',
      doc_level: p.doc_level || cl.required_doc_level || 2,
      department: p.department || cl.department || 'MUTU',
      rejection_feedback: p.rejection_feedback || '-',
    }),
  });
  const markdown = String(r.text || '').trim();
  if (markdown.length < 100) throw new Error('Hasil generate terlalu pendek — kemungkinan output LLM tidak valid');

  const docId = String(p.document_id || '');
  if (docId) {
    await rpc('agentic_doc_update', { p_id: docId, p: { status: 'DRAFT', linked_task_id: t.id,
      extracted_meta: { full_text: markdown } } });
  }
  const placeholders = (markdown.match(/\[\[KONFIRMASI:/g) || []).length;
  return {
    result: { document_id: docId || null, checklist_id: clId, markdown,
      change_note: `Generate klausul ${cl.clause_ref} via ${r.provider}/${r.model}`, placeholders },
    note: `Generate klausul ${cl.clause_ref} · ${markdown.length} char · ${placeholders} placeholder konfirmasi`,
  };
}

// DOC_REVIEW_CYCLE: pemicu manual/cron — dokumen jatuh tempo review → task repair
async function handleReviewCycle(_t: Task) {
  const r = await rpc('agentic_review_cycle', {}) as Dict;
  return { result: r, note: `Review cycle: ${r?.due_for_review ?? 0} dokumen jatuh tempo → task repair` };
}

// ═══ FASE 3 — CONTENT & BRANDING AGENT (§5.2) ════════════════════════

// Gambar flyer via llm-gateway mode 'image' (§1.4 satu pintu):
// NVIDIA FLUX primary → Gemini fallback. Model diatur secret
// NVIDIA_IMAGE_MODEL (default black-forest-labs/flux.1-schnell).
// Non-fatal: gagal gambar tidak menggagalkan task (copy tetap DRAFT).
async function makeImage(t: Task, prompt: string, dim?: { width?: number; height?: number }): Promise<string | null> {
  try {
    const res = await fetch(`${SB_URL}/functions/v1/llm-gateway`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'image', prompt, taskId: t.id,
        ...(dim?.width ? { width: dim.width } : {}), ...(dim?.height ? { height: dim.height } : {}) }),
      signal: AbortSignal.timeout(130_000),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(d.images) || !d.images[0]) return null;
    const [meta, b64] = String(d.images[0]).split(',');
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/png';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const path = `renders/${t.id}_${Date.now()}.png`;
    const up = await fetch(`${SB_URL}/storage/v1/object/agentic/${path}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': mime },
      body: arr,
    });
    return up.ok ? path : null;
  } catch { return null; }
}

// PLAN_WEEKLY: kalender 14 hari + hari kesehatan → LLM slot baru → planner_apply
async function handlePlanWeekly(t: Task) {
  const data = await rpc('agentic_planner_data', {}) as Dict;
  const tpl = await getPrompt('PLAN_WEEKLY');
  const { data: out } = await askLLMJson(t, tpl, {
    today: data.today, window_end: data.window_end,
    posts_per_week: t.payload?.posts_per_week ?? 3,
    articles_per_week: t.payload?.articles_per_week ?? 1,
    existing_slots: JSON.stringify(data.existing_slots || []),
    health_days: JSON.stringify(data.health_days || []),
  });
  const slots = Array.isArray(out) ? out : [];
  const applied = await rpc('agentic_planner_apply', { p: {
    slots, produce_within_days: t.payload?.produce_within_days ?? 4 } }) as Dict;
  return {
    result: { ...applied, proposed: slots.length,
      markdown: `## Rencana Konten Mingguan\n\n${slots.map((s: Dict) =>
        `- **${s.target_date}** · ${s.content_type} · ${s.topic} _(${s.channel}, ${s.framework})_`).join('\n')}` },
    note: `Planner: ${slots.length} usulan → ${applied?.slots_created ?? 0} slot baru, ${applied?.production_started ?? 0} langsung produksi`,
  };
}

// MAKE_SOSMED: copy (hook/caption/hashtag/CTA) + gambar flyer AI (opsional)
async function handleMakeSosmed(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('MAKE_SOSMED');
  const { data } = await askLLMJson(t, tpl, {
    topic: p.topic, angle: p.angle, framework: p.framework || 'PAS',
    channel: p.channel || 'IG', target_date: p.target_date,
    related_test_codes: JSON.stringify(p.related_test_codes || []),
    health_day_ref: p.health_day_ref || '-',
    rejection_feedback: p.rejection_feedback || '-',
  });
  const c = data as Dict;
  if (!c.caption) throw new Error('Output LLM tanpa field caption');

  let imagePath: string | null = null;
  if (p.make_image !== false && c.image_prompt) {
    imagePath = await makeImage(t, String(c.image_prompt));
  }

  const hashtags = Array.isArray(c.hashtags) ? c.hashtags.join(' ') : '';
  const markdown = `## ${c.hook || p.topic}\n\n${c.caption}\n\n**CTA:** ${c.cta || '-'}\n\n${hashtags}` +
    (imagePath ? `\n\n🖼 Gambar: agentic/${imagePath}` : '\n\n_(gambar tidak dibuat)_');

  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'COPY', text_content: `${c.caption}\n\n${hashtags}`, meta: { hook: c.hook, cta: c.cta } } });
  if (imagePath) {
    await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
      asset_type: 'IMAGE', file_path: imagePath, meta: { prompt: c.image_prompt } } });
  }
  return {
    result: { markdown, copy: c, image_path: imagePath, calendar_id: p.calendar_id || null },
    note: `Sosmed "${p.topic}" · caption ${String(c.caption).length} char${imagePath ? ' + gambar' : ''}`,
  };
}

// MAKE_ARTIKEL: artikel 800-1200 kata WAJIB sitasi (§9.4) — kurang sitasi = FAILED
async function handleMakeArtikel(t: Task) {
  const p = t.payload || {};
  const minCit = Number(p.min_citations ?? 3);
  const tpl = await getPrompt('MAKE_ARTIKEL');
  const vars = {
    topic: p.topic, angle: p.angle || '-', audience: p.audience || 'awam',
    target_words: p.target_words || 1000, min_citations: minCit,
    related_test_codes: JSON.stringify(p.related_test_codes || []),
    rejection_feedback: p.rejection_feedback || '-',
  };
  let { data } = await askLLMJson(t, tpl, vars, { maxTokens: 8192 });
  let a = data as Dict;
  let cits = Array.isArray(a.citations) ? a.citations : [];
  if (cits.length < minCit) {
    // satu kesempatan perbaikan, lalu auto-reject internal (§9.4)
    ({ data } = await askLLMJson(t, tpl, {
      ...vars, rejection_feedback:
        `Sitasi hanya ${cits.length}, minimal ${minCit}. Tambahkan sumber ilmiah NYATA. ${vars.rejection_feedback}`,
    }, { maxTokens: 8192, cacheable: false }));
    a = data as Dict;
    cits = Array.isArray(a.citations) ? a.citations : [];
    if (cits.length < minCit) {
      throw new Error(`Auto-reject internal: sitasi ${cits.length} < minimal ${minCit} (§9.4)`);
    }
  }
  const md = `# ${a.title || p.topic}\n\n${a.markdown || ''}\n\n## Sumber\n${cits.map((c: Dict, i: number) =>
    `${i + 1}. ${c.source || ''} — ${c.title || ''} (${c.year || 'n.d.'})${c.url ? ` · ${c.url}` : ''}`).join('\n')}`;
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'HTML', text_content: md, meta: { title: a.title, citations: cits.length } } });
  return {
    result: { markdown: md, title: a.title, meta_description: a.meta_description,
      citations: cits, calendar_id: p.calendar_id || null },
    note: `Artikel "${a.title || p.topic}" · ${String(a.markdown || '').split(/\s+/).length} kata · ${cits.length} sitasi · menunggu review medis`,
  };
}

// MAKE_PPTX_DOKTER: outline slide + speaker notes + referensi (render PPTX menyusul)
async function handleMakePptx(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('MAKE_PPTX_DOKTER');
  const { data } = await askLLMJson(t, tpl, {
    topic: p.topic, audience: p.audience || 'dokter umum',
    duration_min: p.duration_min || 30, slide_count_hint: p.slide_count_hint || 15,
    rejection_feedback: p.rejection_feedback || '-',
  }, { maxTokens: 8192 });
  const d = data as Dict;
  const slides = Array.isArray(d.slides) ? d.slides : [];
  if (!slides.length) throw new Error('Output LLM tanpa slides');
  const md = `# ${d.title || p.topic}\n_Audiens: ${d.audience || '-'} · ${d.duration_min || '-'} menit · ${slides.length} slide_\n\n` +
    slides.map((s: Dict) => `## Slide ${s.n}: ${s.title}\n${(Array.isArray(s.bullets) ? s.bullets : [])
      .map((b: string) => `- ${b}`).join('\n')}\n\n> 🗒 ${s.speaker_notes || ''}`).join('\n\n') +
    `\n\n## Referensi\n${(Array.isArray(d.references) ? d.references : []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`;
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'PPTX', text_content: md, meta: { title: d.title, slides: slides.length } } });
  return {
    result: { markdown: md, outline: d, calendar_id: p.calendar_id || null },
    note: `PPTX outline "${d.title || p.topic}" · ${slides.length} slide · menunggu review medis`,
  };
}

// MAKE_EVENT_BRIEF: brief acara + slot promo otomatis H-14/H-7/H-1
async function handleMakeEventBrief(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('MAKE_EVENT_BRIEF');
  const r = await askLLM({
    taskId: t.id, tier: 'main', temperature: Number(tpl.temperature ?? 0.5), maxTokens: 8192,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), {
      event_name: p.event_name || p.topic, event_date: p.event_date || p.target_date,
      location: p.location || '-', theme: p.theme || p.angle || '-',
      target_participants: p.target_participants || '-', angle: p.angle || '-',
      rejection_feedback: p.rejection_feedback || '-',
    }),
  });
  const md = String(r.text || '').trim();
  if (md.length < 100) throw new Error('Brief terlalu pendek — output LLM tidak valid');
  const promo = await rpc('agentic_event_promo', { p: {
    event_name: p.event_name || p.topic, event_date: p.event_date || p.target_date } }) as Dict;
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'DOCX', text_content: md, meta: { event_date: p.event_date || p.target_date } } });
  return {
    result: { markdown: md, promo_slots: promo?.slots_created ?? 0, calendar_id: p.calendar_id || null },
    note: `Event brief "${p.event_name || p.topic}" · +${promo?.slots_created ?? 0} slot promo otomatis`,
  };
}

// ═══ FASE 6 — ORGANISASI AGENT (HEAD · QA · IT) ══════════════════════

// QA_REVIEW: LLM-as-judge. payload {target_task_id, qa_agent, min_score}
async function handleQaReview(t: Task) {
  const p = t.payload || {};
  const targetId = String(p.target_task_id || '');
  const qaCode = String(p.qa_agent || 'QA_KONTEN');
  const minScore = Number(p.min_score ?? 75);
  if (!targetId) throw new Error('payload.target_task_id wajib');

  const target = await rpc('agentic_task_get', { p_id: targetId }) as Dict | null;
  if (!target) throw new Error(`Task target ${targetId} tidak ditemukan`);
  if (target.status !== 'DRAFT') {
    return { result: { skipped: true }, note: `Target sudah ${target.status} — QA dilewati` };
  }
  const agent = await rpc('agentic_agent_get', { p_code: qaCode }) as Dict | null;
  if (!agent) throw new Error(`Agent QA '${qaCode}' tidak terdaftar/aktif — jalankan supabase_agentic_fase6.sql`);

  const res = (target.result || {}) as Dict;
  const content = String(res.markdown || res.text || JSON.stringify(res)).slice(0, 14000);

  const r = await askLLM({
    taskId: t.id, tier: agent.model_tier === 'light' ? 'light' : 'main',
    temperature: 0, maxTokens: 1200,
    system: String(agent.charter),
    prompt: `AMBANG LULUS: score >= ${minScore}.\nJENIS TASK: ${target.task_type}\nJUDUL: ${target.title}\n\nDRAFT YANG DINILAI:\n${content}`,
  });
  const out = parseJSONLoose(String(r.text)) as Dict;
  const score = Math.max(0, Math.min(100, Number(out.score ?? 0)));
  // verdict dipaksa konsisten dgn ambang (LLM tidak boleh meluluskan di bawah ambang)
  const verdict = (out.verdict === 'PASS' && score >= minScore) ? 'PASS' : 'FAIL';
  const findings = Array.isArray(out.findings) ? out.findings : [];

  await rpc('agentic_qa_add', { p: { task_id: targetId, agent_code: qaCode,
    score, verdict, findings, notes: String(out.saran || '') } });

  return {
    result: { target_task_id: targetId, score, verdict, findings,
      markdown: `## QA ${qaCode} — ${verdict} (${score}/100)\n\n${findings.map((f: string) => `- ${f}`).join('\n') || '- (tanpa temuan)'}\n\n**Saran:** ${out.saran || '-'}` },
    note: `QA ${qaCode} → "${target.title}": ${verdict} ${score}/100`,
  };
}

// HEAD_TICK: orkestrator. Deterministik: keputusan dari Matriks Mandat + QA.
// payload {standup:true} → tambahkan digest harian ke CEO.
async function handleHeadTick(t: Task) {
  const d = await rpc('agentic_head_data', {}) as Dict;
  const drafts = (d.drafts || []) as Dict[];
  const failed = (d.failed || []) as Dict[];
  const lines: string[] = [];
  let qaMade = 0, decided = 0, escalated = 0, retried = 0;

  for (const dr of drafts) {
    const action = String(dr.auto_action || 'AUTO_APPROVE');
    const isOrg = dr.agent === 'ORG';
    try {
      // 1) Log organ / task tanpa-QA → langsung tutup sesuai mandat
      if (action === 'AUTO_PUBLISH_NOQA') {
        await rpc('agentic_head_decide', { p_task_id: dr.id, p_action: 'APPROVE',
          p_reason: `mandat ${dr.risk} (${dr.task_type}) tanpa QA` });
        await rpc('agentic_head_decide', { p_task_id: dr.id, p_action: 'PUBLISH',
          p_reason: `mandat ${dr.risk}` });
        decided++;
        if (!isOrg) lines.push(`✅ Auto-selesai (${dr.risk}): ${dr.title}`);
        continue;
      }
      // 2) Butuh QA tapi belum ada → tugaskan QA agent
      if (!dr.qa) {
        if (!dr.qa_open && dr.qa_agent) {
          await rpc('agentic_create_task', {
            p_agent: 'ORG', p_task_type: 'QA_REVIEW',
            p_title: `QA ${dr.qa_agent}: ${String(dr.title).slice(0, 200)}`,
            p_payload: { target_task_id: dr.id, qa_agent: dr.qa_agent, min_score: dr.min_score },
          });
          qaMade++;
        }
        continue; // tunggu hasil QA di tick berikutnya
      }
      // 3) QA sudah ada → putuskan sesuai mandat
      const qa = dr.qa as Dict;
      const pass = qa.verdict === 'PASS';
      const qaStr = `QA ${dr.qa_agent} ${qa.verdict} ${qa.score}/100`;
      if (!pass && action !== 'RECOMMEND') {
        const fb = `${qaStr}. Temuan: ${(qa.findings as string[] || []).join('; ') || '-'}. ${qa.notes || ''}`;
        await rpc('agentic_head_decide', { p_task_id: dr.id, p_action: 'REJECT', p_reason: fb.slice(0, 900) });
        decided++; lines.push(`↩ Ditolak+perbaiki (${qaStr}): ${dr.title}`);
      } else if (action === 'AUTO_PUBLISH') {
        await rpc('agentic_head_decide', { p_task_id: dr.id, p_action: 'APPROVE', p_reason: `mandat R1, ${qaStr}` });
        await rpc('agentic_head_decide', { p_task_id: dr.id, p_action: 'PUBLISH', p_reason: `mandat R1, ${qaStr}` });
        decided++; lines.push(`🚀 AUTO-PUBLISH (R1, ${qaStr}): ${dr.title}`);
      } else if (action === 'AUTO_APPROVE' && pass) {
        await rpc('agentic_head_decide', { p_task_id: dr.id, p_action: 'APPROVE', p_reason: `mandat R2, ${qaStr}` });
        decided++; lines.push(`👍 Disetujui, menunggu publish CEO (R2, ${qaStr}): ${dr.title}`);
      } else if (action === 'RECOMMEND' && !dr.escalated) {
        await rpc('agentic_msg_add', { p: { from_agent: 'HEAD', to_agent: 'ACE', task_id: dr.id,
          kind: 'ESCALATION',
          body: `R3 menunggu keputusan Anda: "${dr.title}" — ${qaStr}.` +
            ` Rekomendasi HEAD: ${pass ? 'LAYAK approve' : 'PERLU perbaikan'}.` +
            ` ${qa.notes ? 'Catatan QA: ' + qa.notes : ''}` } });
        escalated++; lines.push(`🛎 Eskalasi R3 ke Anda (${qaStr}): ${dr.title}`);
      }
    } catch (e) {
      lines.push(`⚠ Gagal memproses "${dr.title}": ${e instanceof Error ? e.message : e}`);
    }
  }

  // 4) Retry otomatis task gagal yang masih punya budget
  for (const f of failed) {
    try { await rpc('agentic_retry', { p_task_id: f.id }); retried++; }
    catch { /* biarkan utk manusia */ }
  }

  // 5) Standup digest harian (payload.standup) / ringkasan aksi
  const st = (d.standup || {}) as Dict;
  const digest = `## Laporan HEAD — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    `24 jam: ${st.published_24h ?? 0} terbit · ${st.failed_24h ?? 0} gagal · antri ${st.queued_now ?? 0} · draft ${st.draft_now ?? 0}\n` +
    `Menunggu publish Anda (R2): ${((d.approved_waiting || []) as Dict[]).length}\n` +
    (lines.length ? `\nAksi tick ini:\n${lines.map((l) => `- ${l}`).join('\n')}` : '\nTidak ada aksi tick ini.');

  if (t.payload?.standup === true || lines.length > 0) {
    await rpc('agentic_msg_add', { p: { from_agent: 'HEAD', to_agent: 'ACE',
      kind: t.payload?.standup === true ? 'STANDUP' : 'INFO', body: digest } });
  }

  return {
    result: { qa_made: qaMade, decided, escalated, retried, markdown: digest },
    note: `HEAD: ${qaMade} QA ditugaskan · ${decided} diputus · ${escalated} eskalasi · ${retried} retry`,
  };
}

// IT_CHECK: Kepala IT — diag semua jalur + bebaskan task macet + laporan.
async function handleItCheck(t: Task) {
  let diag: Dict = {};
  try {
    const res = await fetch(`${SB_URL}/functions/v1/llm-gateway`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ diag: true }),
      signal: AbortSignal.timeout(130_000),
    });
    diag = await res.json().catch(() => ({}));
  } catch (e) {
    diag = { error: e instanceof Error ? e.message : 'diag gagal' };
  }
  const reap = await rpc('agentic_reap', { p_minutes: 10 }).catch(() => null) as Dict | null;
  const m7 = await rpc('agentic_monitor_7d', {}).catch(() => null) as Dict | null;

  const verdicts = (diag.verdicts || []) as string[];
  const bad = verdicts.filter((v) => v.includes('❌'));
  const failedOpen = ((m7?.failed_open || []) as Dict[]).length;

  // ── FASE 6C: analisis kegagalan → perbaiki PROMPT sendiri (autonomous) ──
  const fixes: string[] = [];
  try {
    const itData = await rpc('agentic_it_data', {}) as Dict | null;
    const llmErrors = (itData?.llm_errors || []) as Dict[];
    const qaFails = (itData?.qa_fails || []) as Dict[];
    const imgBlocked = Number(itData?.image_blocked || 0);
    const templates = (itData?.templates || []) as Dict[];
    // hanya analisis bila ADA sinyal masalah yang bisa diperbaiki lewat prompt
    const worthAnalyzing = imgBlocked >= 3 || qaFails.length >= 2;

    if (worthAnalyzing && templates.length) {
      const itAgent = await rpc('agentic_agent_get', { p_code: 'IT_HEAD' }) as Dict | null;
      const analysis = await askLLM({
        taskId: t.id, tier: 'main', temperature: 0.2, maxTokens: 3000,
        system: String(itAgent?.charter || '') +
          '\nBalas HANYA JSON: {"diagnosis":string,"prompt_fixes":[{"code":string,"new_system_prompt":string,"reason":string}]}.' +
          ' Perbaiki HANYA template yang benar-benar menyebabkan kegagalan di data. Pertahankan SEMUA aturan keamanan yang ada, hanya tambahkan/pertegas. new_system_prompt = versi LENGKAP hasil perbaikan (bukan diff). Kosongkan prompt_fixes bila tidak ada yang perlu diperbaiki.',
        prompt: `SINYAL 24 JAM:\n- Gambar diblokir filter: ${imgBlocked}x\n- Error LLM per model: ${JSON.stringify(llmErrors).slice(0, 1500)}\n- QA gagal: ${JSON.stringify(qaFails).slice(0, 1500)}\n\nTEMPLATE AKTIF (perbaiki bila relevan):\n${JSON.stringify(templates).slice(0, 8000)}`,
      });
      const parsed = parseJSONLoose(String(analysis.text)) as Dict;
      const pfs = Array.isArray(parsed.prompt_fixes) ? parsed.prompt_fixes as Dict[] : [];
      for (const pf of pfs.slice(0, 3)) { // maks 3 perbaikan per patroli
        try {
          const r = await rpc('agentic_prompt_apply', { p: {
            code: pf.code, system_prompt: pf.new_system_prompt,
            reason: String(pf.reason || 'perbaikan otomatis IT'), changed_by: 'IT_HEAD' } }) as Dict;
          if (r && !r.skipped) fixes.push(`🔧 Prompt **${pf.code}** diperbaiki (v${r.from_version}→v${r.to_version}): ${pf.reason}`);
        } catch (e) {
          fixes.push(`⚠ Gagal memperbaiki ${pf.code}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
  } catch (e) {
    fixes.push(`⚠ Analisis prompt gagal: ${e instanceof Error ? e.message : e}`);
  }

  const md = `## Laporan Kepala IT — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    (verdicts.length ? verdicts.map((v) => `- ${v}`).join('\n') : `- diag: ${diag.error || 'tidak ada data'}`) +
    `\n- Task macet dibebaskan: ${reap?.reaped ?? 0}\n- Task FAILED terbuka: ${failedOpen}` +
    (fixes.length ? `\n\n**Perbaikan prompt (otomatis, bisa di-rollback di tab Organisasi):**\n${fixes.map((f) => `- ${f}`).join('\n')}` : '\n- Tidak ada prompt yang perlu diperbaiki');

  // Lapor bila ada masalah ATAU ada perbaikan yang dilakukan
  if (bad.length || failedOpen > 3 || diag.error || fixes.length) {
    await rpc('agentic_msg_add', { p: { from_agent: 'IT_HEAD', to_agent: 'ACE',
      kind: fixes.length ? 'INFO' : 'ALERT', body: md } });
  }
  return {
    result: { verdicts, reaped: reap?.reaped ?? 0, failed_open: failedOpen, prompt_fixes: fixes, markdown: md },
    note: `IT: ${bad.length ? bad.length + ' jalur bermasalah' : 'semua jalur sehat'} · reap ${reap?.reaped ?? 0} · FAILED ${failedOpen} · ${fixes.length} prompt diperbaiki`,
  };
}

// ═══ FASE 7 — DEPARTEMEN SERVICE ASSURANCE & MARKETING ═══════════════

// Dimensi gambar per kanal (selaras channel_specs di supabase_agentic_fase7.sql)
const CHANNEL_DIM: Record<string, { w: number; h: number; aspect: string }> = {
  IG_FEED: { w: 1080, h: 1350, aspect: '4:5' }, IG_SQUARE: { w: 1080, h: 1080, aspect: '1:1' },
  IG_STORY: { w: 1080, h: 1920, aspect: '9:16' }, TIKTOK: { w: 1080, h: 1920, aspect: '9:16' },
  WA: { w: 1080, h: 1080, aspect: '1:1' }, FB_FEED: { w: 1200, h: 1500, aspect: '4:5' },
  YT_THUMB: { w: 1280, h: 720, aspect: '16:9' },
};
const chanDim = (code?: string) => CHANNEL_DIM[String(code || 'IG_FEED').toUpperCase()] || CHANNEL_DIM.IG_FEED;

// CONTENT_ANALYSIS: topik → BRIEF (angle, kanal, format, jumlah slide, SEO, risiko)
async function handleContentAnalysis(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('CONTENT_ANALYSIS');
  const { data } = await askLLMJson(t, tpl, {
    topic: p.topic, angle: p.angle || '-',
    channels: JSON.stringify(p.channels || ['IG_FEED', 'IG_STORY', 'WA', 'TIKTOK']),
    notes: p.notes || '-',
  });
  const b = data as Dict;
  const md = `## Brief Konten — ${p.topic}\n\n**Angle:** ${b.angle || '-'}\n**Audiens:** ${b.audience || '-'}\n` +
    `**Format:** ${b.recommended_format || '-'} · **Kanal:** ${(b.recommended_channels as string[] || []).join(', ')}\n` +
    `**Slide:** ${b.slide_count || '-'} · **Tone:** ${b.tone || '-'}\n\n` +
    `**Poin kunci:**\n${(b.key_points as string[] || []).map((x) => `- ${x}`).join('\n')}\n\n` +
    `**Hooks:**\n${(b.hooks as string[] || []).map((x) => `- ${x}`).join('\n')}\n\n**CTA:** ${b.cta || '-'}\n` +
    `**SEO:** ${(b.seo_keywords as string[] || []).join(', ')}` +
    (b.needs_medical_review ? `\n\n⚠ **Perlu review medis**` : '');
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'COPY', text_content: md, meta: { brief: b } } });

  // Auto-produksi bila diminta & non-medis
  let extra = '';
  if (p.auto_produce === true && b.needs_medical_review !== true &&
      String(b.recommended_format || '').toUpperCase() === 'CAROUSEL') {
    const ch = (b.recommended_channels as string[] || ['IG_FEED'])[0] || 'IG_FEED';
    await rpc('agentic_create_task', {
      p_agent: 'CONTENT', p_task_type: 'MAKE_CAROUSEL',
      p_title: `Carousel: ${p.topic}`,
      p_payload: { topic: p.topic, angle: b.angle, brief: md, channel: ch,
        slide_count: b.slide_count || 6, calendar_id: p.calendar_id || null },
    });
    extra = ' · auto-task MAKE_CAROUSEL';
  }
  return { result: { markdown: md, brief: b, calendar_id: p.calendar_id || null },
    note: `Analisis "${p.topic}" → ${b.recommended_format || '-'}, ${(b.recommended_channels as string[] || []).length} kanal${extra}` };
}

// MAKE_CAROUSEL: brief → N slide (copy per-slide) + N gambar berdimensi kanal
async function handleMakeCarousel(t: Task) {
  const p = t.payload || {};
  const dim = chanDim(String(p.channel));
  const wantSlides = Math.max(3, Math.min(10, Number(p.slide_count ?? 6)));
  const tpl = await getPrompt('MAKE_CAROUSEL');
  const { data } = await askLLMJson(t, tpl, {
    brief: p.brief || '-', topic: p.topic || '-', channel: p.channel || 'IG_FEED',
    aspect: dim.aspect, slide_count: wantSlides, angle: p.angle || '-',
    rejection_feedback: p.rejection_feedback || '-',
  }, { maxTokens: 4096 });
  const c = data as Dict;
  const slides = Array.isArray(c.slides) ? (c.slides as Dict[]) : [];
  if (!slides.length) throw new Error('Output LLM tanpa slides carousel');

  // Batasi jumlah render gambar agar tidak menembus anggaran waktu invocation.
  const maxImg = Math.min(slides.length, Number(p.max_images ?? 6));
  const imagePaths: (string | null)[] = [];
  for (let i = 0; i < maxImg; i++) {
    const prompt = String(slides[i].image_prompt || slides[i].headline || p.topic || 'ilustrasi klinis bersih');
    imagePaths.push(p.make_image === false ? null : await makeImage(t, prompt, { width: dim.w, height: dim.h }));
  }

  const hashtags = Array.isArray(c.hashtags) ? (c.hashtags as string[]).join(' ') : '';
  const md = `## ${c.title || p.topic} — Carousel ${p.channel || 'IG_FEED'} (${dim.aspect})\n\n${c.caption || ''}\n\n` +
    slides.map((s, i) => `**Slide ${s.n ?? i + 1} — ${s.headline || ''}**\n${s.body || ''}` +
      (imagePaths[i] ? `\n🖼 agentic/${imagePaths[i]}` : (i < maxImg ? '\n_(gambar gagal dibuat)_' : ''))).join('\n\n') +
    `\n\n**CTA:** ${c.cta || '-'}\n\n${hashtags}`;

  // Aset: 1 COPY caption + IMAGE per slide (meta.slide) + 1 CAROUSEL ringkasan
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'COPY', text_content: `${c.caption || ''}\n\n${hashtags}`, meta: { title: c.title, cta: c.cta } } });
  for (let i = 0; i < imagePaths.length; i++) {
    if (!imagePaths[i]) continue;
    await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
      asset_type: 'IMAGE', file_path: imagePaths[i],
      meta: { slide: slides[i].n ?? i + 1, channel: p.channel, aspect: dim.aspect, prompt: slides[i].image_prompt } } });
  }
  const madeImgs = imagePaths.filter(Boolean).length;
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'CAROUSEL', text_content: md,
    meta: { channel: p.channel, aspect: dim.aspect, slides: slides.length, images: madeImgs } } });

  return { result: { markdown: md, carousel: c, image_paths: imagePaths, calendar_id: p.calendar_id || null },
    note: `Carousel "${p.topic}" · ${slides.length} slide · ${madeImgs} gambar ${dim.aspect}` };
}

// SEO_RESEARCH: topik → kata kunci + outline + meta
async function handleSeoResearch(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('SEO_RESEARCH');
  const { data } = await askLLMJson(t, tpl, { topic: p.topic, audience: p.audience || 'awam', notes: p.notes || '-' });
  const s = data as Dict;
  const md = `## Riset SEO — ${p.topic}\n\n**Kata kunci utama:** ${s.primary_keyword || '-'}\n` +
    `**Sekunder:** ${(s.secondary_keywords as string[] || []).join(', ')}\n**Intent:** ${s.search_intent || '-'}\n\n` +
    `**Judul usulan:** ${s.suggested_title || '-'}\n**Meta:** ${s.meta_description || '-'}\n\n` +
    `**Outline:**\n${(s.outline_headings as string[] || []).map((x) => `- ${x}`).join('\n')}\n\n` +
    `**Gap konten:**\n${(s.content_gaps as string[] || []).map((x) => `- ${x}`).join('\n')}`;
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'COPY', text_content: md, meta: { seo: s } } });

  let extra = '';
  if (p.auto_produce === true) {
    await rpc('agentic_create_task', {
      p_agent: 'CONTENT', p_task_type: 'MAKE_BLOG_SEO',
      p_title: `Artikel SEO: ${s.suggested_title || p.topic}`,
      p_payload: { topic: p.topic, primary_keyword: s.primary_keyword,
        outline: JSON.stringify(s.outline_headings || []), audience: p.audience || 'awam', calendar_id: p.calendar_id || null },
    });
    extra = ' · auto-task MAKE_BLOG_SEO';
  }
  return { result: { markdown: md, seo: s, calendar_id: p.calendar_id || null },
    note: `SEO "${p.topic}" · kw utama: ${s.primary_keyword || '-'}${extra}` };
}

// MAKE_BLOG_SEO: artikel blog 800–1200 kata ter-optimasi + meta + sitasi
async function handleMakeBlogSeo(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('MAKE_BLOG_SEO');
  const { data } = await askLLMJson(t, tpl, {
    topic: p.topic, primary_keyword: p.primary_keyword || p.topic,
    outline: p.outline || '-', audience: p.audience || 'awam',
    rejection_feedback: p.rejection_feedback || '-',
  }, { maxTokens: 8192 });
  const a = data as Dict;
  const cits = Array.isArray(a.citations) ? (a.citations as Dict[]) : [];
  const md = `# ${a.title || p.topic}\n_meta: ${a.meta_description || '-'} · slug: ${a.slug || '-'}_\n\n${a.markdown || ''}` +
    (cits.length ? `\n\n## Sumber\n${cits.map((c, i) => `${i + 1}. ${c.source || ''} — ${c.title || ''} (${c.year || 'n.d.'})${c.url ? ` · ${c.url}` : ''}`).join('\n')}` : '');
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'HTML', text_content: md, meta: { title: a.title, slug: a.slug, meta_description: a.meta_description } } });
  return { result: { markdown: md, title: a.title, slug: a.slug, meta_description: a.meta_description,
      needs_medical_review: !!a.needs_medical_review, calendar_id: p.calendar_id || null },
    note: `Artikel SEO "${a.title || p.topic}" · ${String(a.markdown || '').split(/\s+/).length} kata${a.needs_medical_review ? ' · perlu review medis' : ''}` };
}

// MAKE_DESIGN_BRIEF: konten → brief kreatif; opsi auto-antre MAKE_CAROUSEL
async function handleMakeDesignBrief(t: Task) {
  const p = t.payload || {};
  const dim = chanDim(String(p.channel));
  const tpl = await getPrompt('MAKE_DESIGN_BRIEF');
  const { data } = await askLLMJson(t, tpl, {
    content: p.content || p.topic || '-', channel: p.channel || 'IG_FEED', aspect: dim.aspect,
    format: p.format || 'CAROUSEL', slide_count: p.slide_count || 6,
  });
  const d = data as Dict;
  const md = `## Brief Kreatif — ${p.topic || d.concept}\n**Konsep:** ${d.concept || '-'}\n` +
    `**Style:** ${d.style || '-'} · **Palet:** ${(d.palette as string[] || []).join(', ')}\n` +
    `**Kanal:** ${d.channel || p.channel} (${dim.aspect}) · **Format:** ${d.format || '-'}\n\n` +
    (Array.isArray(d.slides) ? (d.slides as Dict[]).map((s) => `**Slide ${s.n}** — ${s.visual || ''}\n\`${s.image_prompt || ''}\``).join('\n\n') : '');
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: 'COPY', text_content: md, meta: { design: d } } });

  let extra = '';
  if (p.auto_produce === true && String(d.format || '').toUpperCase() === 'CAROUSEL') {
    await rpc('agentic_create_task', {
      p_agent: 'CONTENT', p_task_type: 'MAKE_CAROUSEL',
      p_title: `Carousel: ${p.topic || d.concept}`,
      p_payload: { topic: p.topic || d.concept, brief: md, channel: d.channel || p.channel || 'IG_FEED',
        slide_count: d.slide_count || p.slide_count || 6, calendar_id: p.calendar_id || null },
    });
    extra = ' · auto-task MAKE_CAROUSEL';
  }
  return { result: { markdown: md, design: d, calendar_id: p.calendar_id || null },
    note: `Brief kreatif "${p.topic || d.concept}" · ${(d.slides as Dict[] || []).length} slide${extra}` };
}

// AUDIT_PLAN: rencana audit internal berbasis risiko (markdown)
async function handleAuditPlan(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('AUDIT_PLAN');
  const r = await askLLM({
    taskId: t.id, tier: 'main', temperature: Number(tpl.temperature ?? 0.4), maxTokens: 6000,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), {
      period: p.period || 'Tahunan', focus: p.focus || 'seluruh klausul kritis',
      areas: p.areas || 'Pra-analitik, Analitik, Pasca-analitik, Manajemen',
      rejection_feedback: p.rejection_feedback || '-',
    }),
  });
  const md = String(r.text || '').trim();
  if (md.length < 100) throw new Error('Rencana audit terlalu pendek — output LLM tidak valid');
  return { result: { markdown: md, change_note: `Audit plan via ${r.provider}/${r.model}` },
    note: `Rencana audit "${p.period || 'Tahunan'}" · ${md.length} char` };
}

// REG_WATCH: analisis kepatuhan dari checklist → gap & rekomendasi (markdown)
async function handleRegWatch(t: Task) {
  const scan = await rpc('agentic_sa_scan', {}).catch(() => null) as Dict | null;
  const missing = (scan?.missing || []) as Dict[];
  const summary = `Klausul wajib tanpa dokumen: ${missing.length}. ` +
    missing.slice(0, 20).map((m) => `${m.clause_ref} (${m.required_doc_type} L${m.required_doc_level})`).join('; ');
  const tpl = await getPrompt('REG_WATCH');
  const r = await askLLM({
    taskId: t.id, tier: 'main', temperature: Number(tpl.temperature ?? 0.3), maxTokens: 4000,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), {
      framework: t.payload?.framework || 'ISO 15189:2022',
      checklist_summary: summary, notes: t.payload?.notes || '-',
    }),
  });
  const md = String(r.text || '').trim();
  return { result: { markdown: md, missing_count: missing.length },
    note: `Reg watch: ${missing.length} gap klausul dianalisis` };
}

// SA_TICK: Kepala Service Assurance — patroli dokumen jatuh tempo + gap wajib
async function handleSaTick(t: Task) {
  const scan = await rpc('agentic_sa_scan', {}) as Dict;
  const due = (scan.due_review || []) as Dict[];
  const missing = (scan.missing || []) as Dict[];
  const lines: string[] = [];
  let made = 0;

  // 1) Dokumen jatuh tempo review → repair cycle (dibatasi RPC bawaan)
  try {
    const rc = await rpc('agentic_review_cycle', {}) as Dict;
    if (rc?.due_for_review) lines.push(`🔁 ${rc.due_for_review} dokumen jatuh tempo → task repair`);
  } catch { /* non-fatal */ }

  // 2) Klausul wajib tanpa dokumen → DOC_GENERATE (maks 3 per tick)
  for (const m of missing.slice(0, 3)) {
    try {
      await rpc('agentic_create_task', {
        p_agent: 'DOCUMENT', p_task_type: 'DOC_GENERATE',
        p_title: `Generate ${m.required_doc_type || 'SOP'} — klausul ${m.clause_ref}`,
        p_payload: { checklist_id: m.checklist_id, doc_type: m.required_doc_type,
          doc_level: m.required_doc_level, department: m.department },
      });
      made++;
    } catch (e) { lines.push(`⚠ gagal generate ${m.clause_ref}: ${e instanceof Error ? e.message : e}`); }
  }
  if (made) lines.push(`📝 ${made} dokumen wajib diusulkan (DOC_GENERATE)`);
  if (scan.templates_missing) lines.push(`📐 ${scan.templates_missing} kombinasi jenis/level belum punya TEMPLATE master — unggah di tab Organisasi agar format terjaga.`);

  // Fase 7K: admin dokumen — distribusi & review/obsolete (dedup)
  try {
    const da = await rpc('agentic_doc_admin', {}) as Dict;
    const das = (da.summary || {}) as Dict;
    if (Number(das.recent || 0) > 0 && !(await rpc('agentic_queued_exists', { p_type: 'DOC_DISTRIBUTE' }))) {
      await rpc('agentic_create_task', { p_agent: 'ORG', p_task_type: 'DOC_DISTRIBUTE', p_title: 'Distribusi dokumen terbit baru' });
      lines.push(`📤 ${das.recent} dokumen terbit baru → task distribusi`);
    }
    if (Number(das.overdue || 0) > 0 && !(await rpc('agentic_queued_exists', { p_type: 'DOC_OBSOLETE' }))) {
      await rpc('agentic_create_task', { p_agent: 'ORG', p_task_type: 'DOC_OBSOLETE', p_title: 'Cek dokumen jatuh tempo/obsolete' });
      lines.push(`♻ ${das.overdue} dokumen jatuh tempo review → task obsolete/review`);
    }
  } catch { /* non-fatal */ }

  const md = `## Patroli Service Assurance — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    `Jatuh tempo review: ${due.length} · gap klausul wajib: ${missing.length}\n` +
    (lines.length ? lines.map((l) => `- ${l}`).join('\n') : '- Tidak ada tindakan diperlukan');
  if (lines.length) {
    await rpc('agentic_msg_add', { p: { from_agent: 'SA_HEAD', to_agent: 'ACE',
      kind: (missing.length > 5 || due.length > 5) ? 'ALERT' : 'INFO', body: md } });
  }
  return { result: { due_review: due.length, missing: missing.length, tasks_made: made, markdown: md },
    note: `SA: ${due.length} jatuh tempo · ${missing.length} gap · ${made} task dibuat` };
}

// MKT_TICK: Kepala Marketing — jaga kalender terisi 14 hari ke depan
async function handleMktTick(t: Task) {
  const scan = await rpc('agentic_mkt_scan', {}) as Dict;
  const upcoming = Number(scan.upcoming_slots || 0);
  const due = (scan.due_production || []) as Dict[];
  const lines: string[] = [];
  const minSlots = Number(t.payload?.min_slots ?? 6);

  if (upcoming < minSlots) {
    try {
      await rpc('agentic_create_task', {
        p_agent: 'CONTENT', p_task_type: 'PLAN_WEEKLY',
        p_title: 'Perencanaan konten mingguan (auto)', p_payload: { produce_within_days: 4 } });
      lines.push(`🗓 Kalender tipis (${upcoming}/${minSlots}) → task PLAN_WEEKLY dibuat`);
    } catch (e) { lines.push(`⚠ gagal PLAN_WEEKLY: ${e instanceof Error ? e.message : e}`); }
  } else {
    lines.push(`🗓 Kalender 14 hari: ${upcoming} slot — cukup`);
  }
  if (due.length) lines.push(`⏳ ${due.length} slot jatuh tempo produksi (H-3)`);

  const md = `## Patroli Marketing — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    lines.map((l) => `- ${l}`).join('\n');
  await rpc('agentic_msg_add', { p: { from_agent: 'MKT_HEAD', to_agent: 'ACE', kind: 'INFO', body: md } });
  return { result: { upcoming, due: due.length, markdown: md },
    note: `MKT: ${upcoming} slot mendatang · ${due.length} jatuh tempo` };
}

// ═══ FASE 7C — AUDIT INTERNAL + CAPA ═════════════════════════════════

// AUDIT_EXECUTE: audit area → temuan terstruktur (NC) → simpan + auto-CAPA
async function handleAuditExecute(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('AUDIT_EXECUTE');
  const { data } = await askLLMJson(t, tpl, {
    area: p.area || 'Seluruh area', clauses: p.clauses || 'Klausul kritis ISO 15189:2022',
    context: p.context || '-', rejection_feedback: p.rejection_feedback || '-',
  }, { maxTokens: 4000 });
  const d = data as Dict;
  const findings = Array.isArray(d.findings) ? (d.findings as Dict[]) : [];
  let capaMade = 0;
  const stored: string[] = [];
  for (const f of findings) {
    try {
      const row = await rpc('agentic_finding_add', { p: {
        audit_task_id: t.id, clause_ref: f.clause_ref || null, area: f.area || p.area || null,
        severity: f.severity || 'OBSERVASI', finding: f.finding || '', evidence: f.evidence || null,
      }}) as Dict;
      stored.push(`[${f.severity || 'OBSERVASI'}] ${f.clause_ref || '-'}: ${f.finding || ''}`);
      // MAYOR/MINOR → antre CAPA otomatis
      if (row?.id && ['MAYOR', 'MINOR'].includes(String(f.severity || '').toUpperCase())) {
        await rpc('agentic_create_task', {
          p_agent: 'ORG', p_task_type: 'CAPA_TRACK',
          p_title: `CAPA: ${String(f.finding || f.clause_ref || 'temuan').slice(0, 120)}`,
          p_payload: { finding_id: row.id, finding: f.finding, severity: f.severity,
            clause_ref: f.clause_ref, area: f.area || p.area },
        });
        await rpc('agentic_finding_set_status', { p_id: row.id, p_status: 'CAPA' }).catch(() => null);
        capaMade++;
      }
    } catch (e) { stored.push(`⚠ gagal simpan temuan: ${e instanceof Error ? e.message : e}`); }
  }
  const md = `## Audit — ${p.area || 'area'}\n${d.summary || ''}\n\n**Temuan (${findings.length}):**\n` +
    findings.map((f) => `- **${f.severity || 'OBSERVASI'}** · ${f.clause_ref || '-'} — ${f.finding || ''}` +
      (f.evidence ? `\n  _bukti:_ ${f.evidence}` : '')).join('\n') +
    (capaMade ? `\n\n➡ ${capaMade} temuan MAYOR/MINOR → CAPA otomatis dibuat.` : '');
  return { result: { markdown: md, findings, capa_created: capaMade },
    note: `Audit "${p.area || 'area'}" · ${findings.length} temuan · ${capaMade} CAPA` };
}

// CAPA_TRACK: temuan → CAPA (akar masalah, tindakan korektif/preventif) tersimpan
async function handleCapaTrack(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('CAPA_TRACK');
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await askLLMJson(t, tpl, {
    finding: p.finding || '-', severity: p.severity || 'MINOR',
    clause_ref: p.clause_ref || '-', area: p.area || '-', today,
  });
  const c = data as Dict;
  const row = await rpc('agentic_capa_add', { p: {
    finding_id: p.finding_id || null, source: p.source || 'AUDIT',
    title: c.title || `CAPA ${p.clause_ref || ''}`.trim(), root_cause: c.root_cause || null,
    corrective_action: c.corrective_action || null, preventive_action: c.preventive_action || null,
    pic: c.pic || null, due_date: /^\d{4}-\d{2}-\d{2}$/.test(String(c.due_date || '')) ? c.due_date : null,
  }}) as Dict;
  const md = `## CAPA — ${c.title || ''}\n**Akar masalah:** ${c.root_cause || '-'}\n` +
    `**Korektif:** ${c.corrective_action || '-'}\n**Preventif:** ${c.preventive_action || '-'}\n` +
    `**PIC:** ${c.pic || '[[KONFIRMASI]]'} · **Target:** ${c.due_date || '[[KONFIRMASI]]'}`;
  return { result: { markdown: md, capa_id: row?.id, capa: c },
    note: `CAPA "${c.title || p.clause_ref || ''}" tersimpan` };
}

// ═══ FASE 7F — DEPARTEMEN IT: audit postur keamanan ═════════════════
async function handleItSecAudit(t: Task) {
  const posture = await rpc('agentic_it_sec_scan', {}) as Dict;
  const tpl = await getPrompt('IT_SEC_AUDIT');
  const r = await askLLM({
    taskId: t.id, tier: 'main', temperature: Number(tpl.temperature ?? 0.2), maxTokens: 3000,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), { posture: JSON.stringify(posture).slice(0, 6000) }),
  });
  const md = String(r.text || '').trim();
  const secrets = (posture?.secrets || []) as Dict[];
  const missing = secrets.filter((s) => !s.has_value).length;
  const medicalAuto = Number(posture?.medical_auto || 0);
  // Kirim ALERT ke CEO bila ada sinyal kritis
  if (medicalAuto > 0 || Number(posture?.no_qa_publish || 0) > 8) {
    await rpc('agentic_msg_add', { p: { from_agent: 'IT_SEC', to_agent: 'ACE',
      kind: 'ALERT', body: `## Audit Keamanan IT\n${md}` } }).catch(() => null);
  }
  return { result: { markdown: md, posture },
    note: `IT_SEC audit · ${missing} secret kosong · ${posture?.failed_7d ?? 0} gagal/7hr${medicalAuto ? ` · ⚠ ${medicalAuto} medis auto` : ''}` };
}

// ═══ FASE 7J — DEPARTEMEN SUPPLY CHAIN ═══════════════════════════════

// Ringkas hasil scan stok jadi markdown
function scmReport(scan: Dict): string {
  const s = (scan.summary || {}) as Dict;
  const low = (scan.low_stock || []) as Dict[];
  const exp = (scan.expiring || []) as Dict[];
  const dead = (scan.expired || []) as Dict[];
  return `## Patroli Supply Chain — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    `Menipis: ${s.low_count ?? 0} · Habis: ${s.out_of_stock ?? 0} · Akan kedaluwarsa: ${s.expiring_count ?? 0} · Kedaluwarsa: ${s.expired_count ?? 0}\n\n` +
    (low.length ? `**Menipis (${low.length}):**\n` + low.slice(0, 15).map((i) =>
      `- ${i.item_name || i.item_code} — stok ${i.stock_qty}/${i.threshold}${Number(i.stock_qty) <= 0 ? ' ⛔ HABIS' : ''} → usul beli ${i.suggested_qty} ${i.unit || ''}${i.supplier ? ` (${i.supplier})` : ''}`).join('\n') + '\n\n' : '') +
    (dead.length ? `**⛔ Kedaluwarsa masih ada stok (${dead.length}) — tarik:**\n` + dead.slice(0, 10).map((b) =>
      `- ${b.item_code} batch ${b.batch_no} exp ${b.expiry_date} · sisa ${b.qty_remaining}`).join('\n') + '\n\n' : '') +
    (exp.length ? `**Mendekati kedaluwarsa (${exp.length}):**\n` + exp.slice(0, 10).map((b) =>
      `- ${b.item_code} batch ${b.batch_no} · ${b.days_left} hari lagi (${b.expiry_date}) · sisa ${b.qty_remaining}`).join('\n') : '');
}

// SCM_TICK: patroli — scan, lapor, dan draft PO utk item menipis
async function handleScmTick(t: Task) {
  const scan = await rpc('agentic_scm_scan', {}) as Dict;
  const low = (scan.low_stock || []) as Dict[];
  const s = (scan.summary || {}) as Dict;
  const md = scmReport(scan);
  let extra = '';
  // Ada item menipis → antre 1 task PO_DRAFT membawa daftarnya
  if (low.length) {
    await rpc('agentic_create_task', {
      p_agent: 'ORG', p_task_type: 'PO_DRAFT',
      p_title: `Draft PO — ${low.length} item menipis`,
      p_payload: { items: low.slice(0, 40) },
    });
    extra = ` · draft PO diantre (${low.length} item)`;
  }
  // Alert CEO bila kritis (habis / kedaluwarsa masih ada stok)
  if (Number(s.out_of_stock || 0) > 0 || Number(s.expired_count || 0) > 0) {
    await rpc('agentic_msg_add', { p: { from_agent: 'LOGISTIK', to_agent: 'ACE', kind: 'ALERT', body: md } }).catch(() => null);
  } else if (low.length || (scan.expiring as Dict[])?.length) {
    await rpc('agentic_msg_add', { p: { from_agent: 'LOGISTIK', to_agent: 'ACE', kind: 'INFO', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...scan },
    note: `SCM: ${s.low_count ?? 0} menipis · ${s.out_of_stock ?? 0} habis · ${s.expired_count ?? 0} kedaluwarsa${extra}` };
}

// STOCK_WATCH: laporan stok on-demand (detail)
async function handleStockWatch(t: Task) {
  const scan = await rpc('agentic_scm_scan', { p_expiry_days: Number(t.payload?.expiry_days ?? 60) }) as Dict;
  const md = scmReport(scan);
  const s = (scan.summary || {}) as Dict;
  return { result: { markdown: md, ...scan }, note: `Stok: ${s.low_count ?? 0} menipis · ${s.expiring_count ?? 0} akan kedaluwarsa` };
}

// PO_DRAFT: daftar item menipis → draft usulan pembelian per pemasok (LLM)
async function handlePoDraft(t: Task) {
  const p = t.payload || {};
  let items = Array.isArray(p.items) ? (p.items as Dict[]) : [];
  if (!items.length) { // dipanggil manual tanpa item → scan dulu
    const scan = await rpc('agentic_scm_scan', {}) as Dict;
    items = ((scan.low_stock || []) as Dict[]).slice(0, 40);
  }
  if (!items.length) return { result: { markdown: '_Tidak ada item menipis — PO tidak diperlukan._' }, note: 'PO: tidak ada item menipis' };
  const tpl = await getPrompt('PO_DRAFT');
  const r = await askLLM({
    taskId: t.id, tier: 'light', temperature: Number(tpl.temperature ?? 0.3), maxTokens: 4000,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), { items: JSON.stringify(items), notes: p.notes || '-' }),
  });
  const md = String(r.text || '').trim();
  await rpc('agentic_msg_add', { p: { from_agent: 'SCM_PO', to_agent: 'ACE', kind: 'INFO',
    body: `## Draft Usulan Pembelian\n${md}` } }).catch(() => null);
  return { result: { markdown: md, items_count: items.length },
    note: `Draft PO ${items.length} item — menunggu tinjauan manusia` };
}

// ═══ FASE 7I — PEOPLE & CREDENTIALING ════════════════════════════════
function credReport(scan: Dict): string {
  const s = (scan.summary || {}) as Dict;
  const expired = (scan.expired || []) as Dict[];
  const expiring = (scan.expiring || []) as Dict[];
  const noExp = (scan.no_expiry || []) as Dict[];
  return `## Patroli Kredensial Nakes — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    `Kedaluwarsa: ${s.expired ?? 0} · ≤30 hari: ${s.expiring_30 ?? 0} · ≤90 hari: ${s.expiring_90 ?? 0} · tanpa tanggal: ${s.no_expiry ?? 0} · aktif: ${s.total_active ?? 0}\n\n` +
    (expired.length ? `**⛔ KEDALUWARSA (${expired.length}) — nakes ini tidak boleh praktik sampai diperbarui:**\n` + expired.slice(0, 20).map((c) =>
      `- ${c.staff_name} · ${c.credential_type}${c.profession ? ` (${c.profession})` : ''} — exp ${c.expiry_date} (${Math.abs(Number(c.days))} hari lalu)`).join('\n') + '\n\n' : '') +
    (expiring.length ? `**⚠ Segera kedaluwarsa (${expiring.length}):**\n` + expiring.slice(0, 20).map((c) =>
      `- ${c.staff_name} · ${c.credential_type} — ${c.days} hari lagi (${c.expiry_date})`).join('\n') + '\n\n' : '') +
    (noExp.length ? `**Lengkapi tanggal kedaluwarsa (${noExp.length}):** ` + noExp.slice(0, 15).map((c) => `${c.staff_name}/${c.credential_type}`).join(', ') : '');
}
async function handleHrTick(t: Task) {
  const scan = await rpc('agentic_hr_cred_scan', {}) as Dict;
  const s = (scan.summary || {}) as Dict;
  const md = credReport(scan);
  // Fase 7K: pantau roster/absensi juga (dedup)
  try {
    if (!(await rpc('agentic_queued_exists', { p_type: 'ROSTER_CHECK' }))) {
      await rpc('agentic_create_task', { p_agent: 'ORG', p_task_type: 'ROSTER_CHECK', p_title: 'Cek roster & absensi' });
    }
  } catch { /* non-fatal */ }
  if (Number(s.expired || 0) > 0) {
    await rpc('agentic_msg_add', { p: { from_agent: 'HR_CRED', to_agent: 'ACE', kind: 'ALERT', body: md } }).catch(() => null);
  } else if (Number(s.expiring_90 || 0) > 0 || Number(s.no_expiry || 0) > 0) {
    await rpc('agentic_msg_add', { p: { from_agent: 'HR_CRED', to_agent: 'ACE', kind: 'INFO', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...scan },
    note: `HR: ${s.expired ?? 0} kedaluwarsa · ${s.expiring_90 ?? 0} ≤90hr · ${s.total_active ?? 0} aktif` };
}
async function handleCredWatch(t: Task) {
  const scan = await rpc('agentic_hr_cred_scan', { p_days: Number(t.payload?.days ?? 90) }) as Dict;
  const s = (scan.summary || {}) as Dict;
  return { result: { markdown: credReport(scan), ...scan },
    note: `Kredensial: ${s.expired ?? 0} kedaluwarsa · ${s.expiring_90 ?? 0} ≤90hr` };
}

// ═══ FASE 7G — IT: Integration Health + Backup Verify ════════════════
async function handleIntegrationHealth(t: Task) {
  const scan = await rpc('agentic_integration_scan', {
    p_stuck_hours: Number(t.payload?.stuck_hours ?? 6), p_silent_hours: Number(t.payload?.silent_hours ?? 24) }) as Dict;
  const s = (scan.summary || {}) as Dict;
  const stuck = (scan.stuck_samples || []) as Dict[];
  const silent = (scan.silent_analyzers || []) as Dict[];
  const down = (scan.down_analyzers || []) as Dict[];
  const md = `## Kesehatan Integrasi Lab — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    `Sampel tertahan: ${s.stuck ?? 0} · Hasil auto 24j: ${s.auto_results_24h ?? 0} · Analyzer terintegrasi: ${s.integrated_analyzers ?? 0}\n\n` +
    (silent.length ? `**⚠ Analyzer diam (tak ada hasil auto — integrasi mungkin putus):**\n` + silent.map((a) =>
      `- ${a.nama_alat}${a.kategori ? ` (${a.kategori})` : ''}${a.protocol ? ` · ${a.protocol}` : ''} — terakhir: ${a.last_auto_result || 'tidak pernah'}`).join('\n') + '\n\n' : '') +
    (stuck.length ? `**Sampel tertahan In Process (${stuck.length}):**\n` + stuck.slice(0, 15).map((x) =>
      `- ${x.barcode || '—'} · ${x.patient_name || ''}${x.analyzer_name ? ` @ ${x.analyzer_name}` : ''} — ${x.hours} jam`).join('\n') + '\n\n' : '') +
    (down.length ? `**Alat non-operasional:** ` + down.map((a) => `${a.nama_alat} (${a.status})`).join(', ') : '');
  if (silent.length || Number(s.stuck || 0) > 0) {
    await rpc('agentic_msg_add', { p: { from_agent: 'IT_DATA', to_agent: 'ACE',
      kind: silent.length ? 'ALERT' : 'INFO', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...scan },
    note: `Integrasi: ${s.stuck ?? 0} tertahan · ${silent.length} analyzer diam · ${s.auto_results_24h ?? 0} hasil auto/24j` };
}

async function handleBackupVerify(t: Task) {
  const st = await rpc('agentic_backup_status', { p_max_hours: Number(t.payload?.max_hours ?? 26) }) as Dict;
  const stale = st.stale === true;
  const hasAny = st.has_any === true;
  const hrs = st.hours_since_ok;
  const last = (st.last || null) as Dict | null;
  const md = `## Verifikasi Backup — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    (!hasAny
      ? `⛔ **TIDAK ADA catatan backup sama sekali.** Pastikan cron pg_dump Anda mencatat ke \`agentic_backup_log_add\` setelah tiap dump (lihat §CRON di supabase_agentic_fase7g_it.sql). Tanpa ini, kesegaran backup tak bisa diverifikasi.`
      : `Backup OK terakhir: **${hrs ?? '—'} jam lalu** (ambang ${st.max_hours} jam) · status: ${stale ? '⛔ BASI' : '✅ segar'}\n` +
        `Terakhir tercatat: ${last?.status || '—'} · ${last?.method || ''} ${last?.location ? '· ' + last.location : ''} (${last?.run_at || '—'})\n` +
        `Gagal 7 hari: ${st.failed_7d ?? 0}`);
  if (!hasAny || stale || Number(st.failed_7d || 0) > 0) {
    await rpc('agentic_msg_add', { p: { from_agent: 'IT_DATA', to_agent: 'ACE', kind: 'ALERT', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...st },
    note: `Backup: ${!hasAny ? 'TIDAK ADA' : stale ? 'BASI' : 'segar'} (${hrs ?? '—'} jam)` };
}

// ═══ FASE 7H — LAB OPERATIONS ASSURANCE ══════════════════════════════
function labReport(scan: Dict, focus: string): string {
  const s = (scan.summary || {}) as Dict;
  const qc = (scan.qc_alerts || []) as Dict[];
  const crit = (scan.critical_open || []) as Dict[];
  const tat = (scan.tat_breach || []) as Dict[];
  const head = `## Patroli Lab Ops — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    `QC REJECT: ${s.qc_reject ?? 0} · QC Warning: ${s.qc_warning ?? 0} · Nilai kritis belum rilis: ${s.critical_open ?? 0} · TAT lewat: ${s.tat_breach ?? 0} · Dirilis 24j: ${s.released_24h ?? 0}\n\n`;
  const secCrit = crit.length ? `**🚨 NILAI KRITIS BELUM DIRILIS (${crit.length}) — verifikasi & komunikasi ke dokter oleh MANUSIA segera:**\n` +
    crit.slice(0, 15).map((c) => `- ${c.patient_name || '—'} · ${c.product_name || ''} = ${c.result_value || ''} (${c.interpretation}) · status ${c.status} · ${c.hours} jam`).join('\n') + '\n\n' : '';
  const secQc = qc.length ? `**🧫 QC menyimpang (${qc.length}) — REJECT = tahan rilis & ulang QC:**\n` +
    qc.slice(0, 15).map((q) => `- ${q.test_name} @ ${q.analyzer_name || '—'} L${q.qc_level || '?'} · ${q.verdict} (z=${q.z_score ?? '—'}) · ${q.run_at}`).join('\n') + '\n\n' : '';
  const secTat = tat.length ? `**⏱️ Sampel lewat TAT (${tat.length}):**\n` +
    tat.slice(0, 15).map((x) => `- ${x.barcode || '—'} · ${x.patient_name || ''} · ${x.product_name || ''} · ${x.status} · ${x.hours} jam`).join('\n') : '';
  if (focus === 'qc') return head + secQc;
  if (focus === 'tat') return head + secTat;
  if (focus === 'critical') return head + secCrit;
  return head + secCrit + secQc + secTat;
}
async function handleLabScan(t: Task, focus: string) {
  const scan = await rpc('agentic_lab_scan', {
    p_tat_hours: Number(t.payload?.tat_hours ?? 24), p_qc_hours: Number(t.payload?.qc_hours ?? 48) }) as Dict;
  const s = (scan.summary || {}) as Dict;
  const md = labReport(scan, focus);
  // ALERT bila ada QC REJECT atau nilai kritis belum dirilis (keselamatan pasien)
  const critical = Number(s.qc_reject || 0) > 0 || Number(s.critical_open || 0) > 0;
  if (focus === 'all' && (critical || Number(s.tat_breach || 0) > 0)) {
    await rpc('agentic_msg_add', { p: { from_agent: Number(s.critical_open || 0) > 0 ? 'LAB_CRIT' : 'LAB_QC',
      to_agent: 'ACE', kind: critical ? 'ALERT' : 'INFO', body: md } }).catch(() => null);
  } else if (focus === 'critical' && Number(s.critical_open || 0) > 0) {
    await rpc('agentic_msg_add', { p: { from_agent: 'LAB_CRIT', to_agent: 'ACE', kind: 'ALERT', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...scan },
    note: `Lab: ${s.qc_reject ?? 0} QC-reject · ${s.critical_open ?? 0} kritis · ${s.tat_breach ?? 0} TAT` };
}
const handleLabTick = (t: Task) => handleLabScan(t, 'all');
const handleQcWatch = (t: Task) => handleLabScan(t, 'qc');
const handleTatMonitor = (t: Task) => handleLabScan(t, 'tat');
const handleCriticalWatch = (t: Task) => handleLabScan(t, 'critical');

// ═══ FASE 7L — BIZ-OPS: Finance · Growth/CRM · CX · Exec ═════════════
const rp = (v: unknown) => 'Rp ' + Number(v || 0).toLocaleString('id-ID');
// ── Finance ──
function finReport(s: Dict, focus: string): string {
  const sm = (s.summary || {}) as Dict; const ab = (s.ar_buckets || {}) as Dict;
  const ov = (s.overdue_list || []) as Dict[]; const dr = (s.draft_stale || []) as Dict[]; const cv = (s.cashier_variance || []) as Dict[];
  const head = `## Patroli Finance — ${new Date().toLocaleDateString('id-ID')}\n` +
    `Piutang menunggak: ${sm.overdue_count ?? 0} (${rp(sm.overdue_amount)}) · Draft mengendap: ${sm.draft_stale ?? 0} · Selisih kas: ${sm.variance_count ?? 0} · Belum setor: ${sm.undeposited ?? 0}\n\n`;
  const secAr = `**Aging piutang:** 0-30 ${rp(ab.b_0_30)} · 31-60 ${rp(ab.b_31_60)} · 61-90 ${rp(ab.b_61_90)} · >90 ${rp(ab.b_90plus)}\n` +
    (ov.length ? ov.slice(0, 12).map((x) => `- ${x.invoice_number || '—'} · ${x.partner_name || ''} · ${rp(x.total_amount)} · telat ${x.days_overdue} hari`).join('\n') + '\n' : '');
  const secLeak = dr.length ? `**Invoice Draft mengendap (potensi bocor):**\n` + dr.slice(0, 12).map((x) => `- ${x.invoice_number || '—'} · ${x.partner_name || ''} · ${rp(x.total_amount)} · ${x.invoice_date}`).join('\n') + '\n' : '';
  const secRecon = cv.length ? `**Selisih kas kasir:**\n` + cv.slice(0, 12).map((x) => `- ${x.cashier_name || '—'} · selisih ${rp(x.variance)}${x.variance_note ? ` (${x.variance_note})` : ''}`).join('\n') : '';
  if (focus === 'ar') return head + secAr;
  if (focus === 'leak') return head + secLeak;
  if (focus === 'recon') return head + secRecon;
  return head + secAr + '\n' + secLeak + '\n' + secRecon;
}
async function handleFinScan(t: Task, focus: string) {
  const s = await rpc('agentic_fin_scan', {}) as Dict; const sm = (s.summary || {}) as Dict;
  const md = finReport(s, focus);
  if (focus === 'all' && (Number(sm.overdue_count || 0) > 0 || Number(sm.variance_count || 0) > 0)) {
    await rpc('agentic_msg_add', { p: { from_agent: 'FIN_HEAD', to_agent: 'ACE', kind: 'INFO', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...s }, note: `Finance: ${sm.overdue_count ?? 0} menunggak (${rp(sm.overdue_amount)}) · ${sm.variance_count ?? 0} selisih kas` };
}
// ── Growth / CRM ──
function crmReport(s: Dict, focus: string): string {
  const sm = (s.summary || {}) as Dict;
  const fu = (s.overdue_followup || []) as Dict[]; const idl = (s.idle_deals || []) as Dict[]; const mo = (s.expiring_mou || []) as Dict[];
  const head = `## Patroli Growth & CRM — ${new Date().toLocaleDateString('id-ID')}\n` +
    `Follow-up lewat tempo: ${sm.overdue_followup ?? 0} · Deal mandek: ${sm.idle_deals ?? 0} · MOU akan berakhir: ${sm.expiring_mou ?? 0} · Pipeline: ${rp(sm.pipeline_value)}\n\n`;
  const secLead = fu.length ? `**Follow-up lewat tempo (prioritas nilai):**\n` + fu.slice(0, 12).map((x) => `- ${x.lead_name || x.company || '—'} · ${x.status} · ${rp(x.estimated_value)} · jadwal ${x.followup_date}`).join('\n') + '\n' : '';
  const secDeal = idl.length ? `**Deal mandek (lewat ambang idle tahap):**\n` + idl.slice(0, 12).map((x) => `- ${x.lead_name || x.company || '—'} · ${x.status} · diam ${x.stale_days} hari (ambang ${x.idle_days})`).join('\n') + '\n' : '';
  const secMou = mo.length ? `**MOU akan berakhir ≤60 hari:**\n` + mo.slice(0, 12).map((x) => `- ${x.mou_number || '—'} · ${x.title || ''} · ${x.partner_name || ''} · ${x.days_left} hari (${x.end_date})`).join('\n') : '';
  if (focus === 'lead') return head + secLead;
  if (focus === 'deal') return head + secDeal;
  if (focus === 'mou') return head + secMou;
  return head + secLead + '\n' + secDeal + '\n' + secMou;
}
async function handleCrmScan(t: Task, focus: string) {
  const s = await rpc('agentic_crm_scan', {}) as Dict; const sm = (s.summary || {}) as Dict;
  const md = crmReport(s, focus);
  if (focus === 'all' && (Number(sm.expiring_mou || 0) > 0 || Number(sm.overdue_followup || 0) > 0)) {
    await rpc('agentic_msg_add', { p: { from_agent: 'GROWTH_HEAD', to_agent: 'ACE', kind: 'INFO', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...s }, note: `Growth: ${sm.overdue_followup ?? 0} follow-up · ${sm.idle_deals ?? 0} mandek · ${sm.expiring_mou ?? 0} MOU tempo` };
}
// ── CX ──
async function handleCxTick(t: Task) {
  const s = await rpc('agentic_cx_scan', {}) as Dict; const sm = (s.summary || {}) as Dict; const fb = (s.feedback || {}) as Dict;
  const md = `## Patroli CX — ${new Date().toLocaleDateString('id-ID')}\n` +
    `Keluhan terbuka: ${sm.open ?? 0} · Lewat SLA: ${sm.overdue ?? 0} · Tinggi: ${sm.high ?? 0} · NPS 30h: rata ${fb.avg_score ?? '—'} (promoter ${fb.promoters ?? 0}/detraktor ${fb.detractors ?? 0})`;
  // Ada keluhan terbuka → antre triase (dedup)
  if (Number(sm.open || 0) > 0 && !(await rpc('agentic_queued_exists', { p_type: 'COMPLAINT_TRIAGE' }))) {
    await rpc('agentic_create_task', { p_agent: 'ORG', p_task_type: 'COMPLAINT_TRIAGE', p_title: 'Triase keluhan terbuka' });
  }
  if (Number(sm.overdue || 0) > 0 || Number(sm.high || 0) > 0) {
    await rpc('agentic_msg_add', { p: { from_agent: 'CX_HEAD', to_agent: 'ACE', kind: 'ALERT', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...s }, note: `CX: ${sm.open ?? 0} keluhan · ${sm.overdue ?? 0} lewat SLA` };
}
async function handleComplaintTriage(t: Task) {
  const s = await rpc('agentic_cx_scan', {}) as Dict;
  const open = (s.open_complaints || []) as Dict[];
  if (!open.length) return { result: { markdown: '_Tidak ada keluhan terbuka._' }, note: 'CX: tidak ada keluhan terbuka' };
  const tpl = await getPrompt('COMPLAINT_TRIAGE');
  const r = await askLLM({
    taskId: t.id, tier: 'main', temperature: Number(tpl.temperature ?? 0.4), maxTokens: 4000,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), { complaints: JSON.stringify(open.slice(0, 15)) }),
  });
  const md = String(r.text || '').trim();
  await rpc('agentic_msg_add', { p: { from_agent: 'CX_COMPLAINT', to_agent: 'ACE', kind: 'INFO', body: `## Triase & Draft Respons Keluhan\n${md}` } }).catch(() => null);
  return { result: { markdown: md, count: open.length }, note: `Triase ${open.length} keluhan · draft respons (kirim=manusia)` };
}
async function handleFeedbackSummary(t: Task) {
  const s = await rpc('agentic_cx_scan', {}) as Dict; const fb = (s.feedback || {}) as Dict;
  const md = `## Ringkasan Umpan Balik (30 hari)\nJumlah: ${fb.count ?? 0} · Rata skor: ${fb.avg_score ?? '—'} · Promoter (≥9): ${fb.promoters ?? 0} · Detraktor (≤6): ${fb.detractors ?? 0}`;
  return { result: { markdown: md, feedback: fb }, note: `Feedback: ${fb.count ?? 0} · rata ${fb.avg_score ?? '—'}` };
}
// ── Executive digest (agregasi lintas-domain) ──
async function handleExecDigest(t: Task) {
  const g = async (fn: string, args: Dict = {}) => { try { return await rpc(fn, args) as Dict; } catch { return {}; } };
  const [sa, scm, hr, lab, fin, crm, cx, bk] = await Promise.all([
    g('agentic_sa_scan'), g('agentic_scm_scan'), g('agentic_hr_cred_scan'), g('agentic_lab_scan'),
    g('agentic_fin_scan'), g('agentic_crm_scan'), g('agentic_cx_scan'), g('agentic_backup_status'),
  ]);
  const labS = (lab.summary || {}) as Dict, scmS = (scm.summary || {}) as Dict, hrS = (hr.summary || {}) as Dict,
    finS = (fin.summary || {}) as Dict, crmS = (crm.summary || {}) as Dict, cxS = (cx.summary || {}) as Dict;
  const md = `## 📊 Digest Eksekutif — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
    `**Mutu & Dokumen:** gap klausul wajib ${((sa.missing || []) as Dict[]).length} · jatuh tempo review ${((sa.due_review || []) as Dict[]).length}\n` +
    `**Lab:** QC REJECT ${labS.qc_reject ?? 0} · nilai kritis belum rilis ${labS.critical_open ?? 0} · TAT lewat ${labS.tat_breach ?? 0}\n` +
    `**Supply:** stok menipis ${scmS.low_count ?? 0} · habis ${scmS.out_of_stock ?? 0} · kedaluwarsa ${scmS.expired_count ?? 0}\n` +
    `**SDM:** kredensial kedaluwarsa ${hrS.expired ?? 0} · ≤90 hari ${hrS.expiring_90 ?? 0}\n` +
    `**Keuangan:** piutang menunggak ${finS.overdue_count ?? 0} (${rp(finS.overdue_amount)}) · selisih kas ${finS.variance_count ?? 0}\n` +
    `**Growth:** follow-up lewat tempo ${crmS.overdue_followup ?? 0} · MOU akan berakhir ${crmS.expiring_mou ?? 0}\n` +
    `**CX:** keluhan terbuka ${cxS.open ?? 0} · lewat SLA ${cxS.overdue ?? 0}\n` +
    `**Backup:** ${bk.has_any ? (bk.stale ? '⛔ BASI' : '✅ segar') : '⛔ tak ada catatan'}\n`;
  await rpc('agentic_msg_add', { p: { from_agent: 'TEAM_OPS', to_agent: 'ACE', kind: 'STANDUP', body: md } }).catch(() => null);
  return { result: { markdown: md }, note: `Digest eksekutif dikirim ke CEO` };
}
const handleFinTick = (t: Task) => handleFinScan(t, 'all');
const handleArAging = (t: Task) => handleFinScan(t, 'ar');
const handleRevLeak = (t: Task) => handleFinScan(t, 'leak');
const handleRecon = (t: Task) => handleFinScan(t, 'recon');
const handleGrowthTick = (t: Task) => handleCrmScan(t, 'all');
const handleLeadScore = (t: Task) => handleCrmScan(t, 'lead');
const handleDealHygiene = (t: Task) => handleCrmScan(t, 'deal');
const handleMouWatch = (t: Task) => handleCrmScan(t, 'mou');

// ═══ POINT C — video wiring ══════════════════════════════════════════
// makeVideo: gateway mode:'video' → simpan .mp4 ke storage (bila base64) atau URL.
// Non-fatal: gagal/nonaktif → null (script tetap jadi DRAFT).
async function makeVideo(t: Task, prompt: string): Promise<{ path?: string; url?: string } | null> {
  try {
    const res = await fetch(`${SB_URL}/functions/v1/llm-gateway`, {
      method: 'POST', headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'video', prompt, taskId: t.id }), signal: AbortSignal.timeout(130_000),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(d.videos) || !d.videos[0]) return null;
    const v = String(d.videos[0]);
    if (/^https?:\/\//.test(v)) return { url: v };
    const b64 = v.split(',')[1] || '';
    if (!b64) return null;
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const path = `renders/${t.id}_${Date.now()}.mp4`;
    const up = await fetch(`${SB_URL}/storage/v1/object/agentic/${path}`, {
      method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'video/mp4' }, body: arr,
    });
    return up.ok ? { path } : null;
  } catch { return null; }
}
async function handleMakeVideo(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('MAKE_VIDEO');
  const { data } = await askLLMJson(t, tpl, {
    topic: p.topic, channel: p.channel || 'IG_STORY', angle: p.angle || '-', rejection_feedback: p.rejection_feedback || '-' });
  const c = data as Dict;
  if (!c.script && !c.video_prompt) throw new Error('Output LLM tanpa script/video_prompt');
  const vid = p.make_video === false ? null : await makeVideo(t, String(c.video_prompt || c.title || p.topic));
  const hashtags = Array.isArray(c.hashtags) ? (c.hashtags as string[]).join(' ') : '';
  const md = `## ${c.title || p.topic} — Video\n\n${c.caption || ''}\n\n**Script:**\n${c.script || ''}\n\n` +
    (vid?.path ? `🎬 Video: agentic/${vid.path}` : vid?.url ? `🎬 Video: ${vid.url}` : '_(video belum dibuat — aktifkan VIDEO_ENABLED + NVIDIA_VIDEO_MODEL di Konfig AI)_') +
    `\n\n${hashtags}`;
  await rpc('agentic_asset_add', { p: { calendar_id: p.calendar_id || null, task_id: t.id,
    asset_type: vid ? 'VIDEO' : 'COPY', file_path: vid?.path || null,
    text_content: vid?.url ? md + `\nurl:${vid.url}` : md, meta: { title: c.title, video_prompt: c.video_prompt } } }).catch(() => null);
  return { result: { markdown: md, video: vid, copy: c, calendar_id: p.calendar_id || null },
    note: `Video "${p.topic}" · ${vid ? 'video dibuat' : 'script saja (video nonaktif/gagal)'}${c.needs_medical_review ? ' · perlu review medis' : ''}` };
}

// ═══ FASE 7K — task "reserved" diaktifkan ════════════════════════════
async function handleMasterList(_t: Task) {
  const d = await rpc('agentic_doc_admin', {}) as Dict;
  const pub = (d.published || []) as Dict[];
  const s = (d.summary || {}) as Dict;
  const md = `## Daftar Induk Dokumen — ${new Date().toLocaleDateString('id-ID')}\n` +
    `Terbit: ${s.published ?? 0} · Jatuh tempo review: ${s.overdue ?? 0} · Obsolete: ${s.obsolete ?? 0}\n\n` +
    `| No. Dokumen | Judul | Jenis | Dept | Rev | Review Berikut |\n|---|---|---|---|---|---|\n` +
    pub.map((x) => `| ${x.doc_number || '—'} | ${x.title || ''} | ${x.doc_type || ''} L${x.doc_level || ''} | ${x.department || ''} | ${x.revision ?? 0} | ${x.next_review_date || '—'} |`).join('\n');
  return { result: { markdown: md, ...d }, note: `Daftar induk: ${s.published ?? 0} dokumen terbit` };
}
async function handleDocDistribute(_t: Task) {
  const d = await rpc('agentic_doc_admin', {}) as Dict;
  const recent = (d.recent_published || []) as Dict[];
  const md = `## Distribusi Dokumen — ${new Date().toLocaleDateString('id-ID')}\n` +
    (recent.length
      ? `Dokumen terbit terbaru yang perlu **didistribusikan & dicatat acknowledgement**-nya:\n` +
        recent.map((x) => `- ${x.doc_number || '—'} · ${x.title} (${x.department}) · terbit ${x.effective_date}`).join('\n') +
        `\n\n_Distribusi & tanda terima dilakukan & dicatat oleh manusia._`
      : `Tidak ada dokumen terbit baru yang perlu distribusi.`);
  if (recent.length) await rpc('agentic_msg_add', { p: { from_agent: 'SA_DOC', to_agent: 'ACE', kind: 'INFO', body: md } }).catch(() => null);
  return { result: { markdown: md }, note: `Distribusi: ${recent.length} dokumen baru` };
}
async function handleDocObsolete(_t: Task) {
  const d = await rpc('agentic_doc_admin', {}) as Dict;
  const over = (d.overdue_review || []) as Dict[];
  const md = `## Kandidat Review/Obsolete — ${new Date().toLocaleDateString('id-ID')}\n` +
    (over.length
      ? `Dokumen **melewati tanggal review** — tinjau lalu perbarui atau tandai OBSOLETE (aksi manusia):\n` +
        over.map((x) => `- ${x.doc_number || '—'} · ${x.title} (${x.department}) · jatuh tempo ${x.next_review_date} (telat ${x.days_overdue} hari)`).join('\n')
      : `Tidak ada dokumen yang melewati tanggal review.`);
  if (over.length) await rpc('agentic_msg_add', { p: { from_agent: 'SA_DOC', to_agent: 'ACE', kind: 'INFO', body: md } }).catch(() => null);
  return { result: { markdown: md }, note: `Obsolete/review: ${over.length} dokumen jatuh tempo` };
}
async function handleRosterCheck(t: Task) {
  const scan = await rpc('agentic_roster_scan', { p_days: Number(t.payload?.days ?? 14) }) as Dict;
  const s = (scan.summary || {}) as Dict;
  const alpa = (scan.alpa || []) as Dict[];
  const noOut = (scan.no_clockout || []) as Dict[];
  const md = `## Roster & Absensi (14 hari) — ${new Date().toLocaleDateString('id-ID')}\n` +
    `Alpa: ${s.alpa ?? 0} · Tanpa clock-out: ${s.no_clockout ?? 0} · Terlambat parah: ${s.very_late ?? 0} · Terlambat: ${s.late ?? 0}\n\n` +
    (alpa.length ? `**Alpa:** ` + alpa.slice(0, 20).map((a) => `${a.employee_name} (${a.tanggal})`).join(', ') + '\n\n' : '') +
    (noOut.length ? `**Lupa clock-out:** ` + noOut.slice(0, 20).map((a) => `${a.employee_name} (${a.tanggal})`).join(', ') : '');
  if (Number(s.alpa || 0) > 0) await rpc('agentic_msg_add', { p: { from_agent: 'HR_ROSTER', to_agent: 'ACE', kind: 'INFO', body: md } }).catch(() => null);
  return { result: { markdown: md, ...scan }, note: `Roster: ${s.alpa ?? 0} alpa · ${s.very_late ?? 0} telat parah` };
}
async function handlePlanCampaign(t: Task) {
  const p = t.payload || {};
  const tpl = await getPrompt('PLAN_CAMPAIGN');
  const r = await askLLM({
    taskId: t.id, tier: 'main', temperature: Number(tpl.temperature ?? 0.5), maxTokens: 6000,
    system: String(tpl.system_prompt || ''),
    prompt: fillTemplate(String(tpl.user_prompt_template || ''), {
      goal: p.goal || p.topic || 'meningkatkan kesadaran layanan lab', period: p.period || '1 bulan',
      notes: p.notes || '-', rejection_feedback: p.rejection_feedback || '-' }),
  });
  const md = String(r.text || '').trim();
  if (md.length < 100) throw new Error('Rencana kampanye terlalu pendek — output LLM tidak valid');
  return { result: { markdown: md, change_note: `Campaign plan via ${r.provider}/${r.model}` },
    note: `Rencana kampanye "${p.goal || p.topic || ''}" · ${md.length} char` };
}

// ═══ FASE 7M — PHARMACY & INPATIENT (flag-only; klinis=manusia) ══════
function pharmaReport(s: Dict, focus: string): string {
  const sm = (s.summary || {}) as Dict;
  const exp = (s.expired || []) as Dict[]; const exg = (s.expiring || []) as Dict[]; const low = (s.low_stock || []) as Dict[];
  const ov = (s.override_rx || []) as Dict[]; const ctl = (s.controlled_no_id || []) as Dict[];
  const head = `## Patroli Farmasi — ${new Date().toLocaleDateString('id-ID')}\n` +
    `Kedaluwarsa: ${sm.expired ?? 0} · akan kedaluwarsa: ${sm.expiring ?? 0} · stok menipis: ${sm.low_stock ?? 0} · warning di-override: ${sm.override_rx ?? 0} · terkontrol tanpa ID: ${sm.controlled_no_id ?? 0}\n\n`;
  const secExp = (exp.length ? `**⛔ Obat KEDALUWARSA masih ada stok — tarik:**\n` + exp.slice(0, 12).map((b) => `- ${b.drug_code} batch ${b.batch_no} exp ${b.expiry_date} · sisa ${b.qty_remaining}`).join('\n') + '\n' : '') +
    (exg.length ? `**Akan kedaluwarsa:**\n` + exg.slice(0, 10).map((b) => `- ${b.drug_code} batch ${b.batch_no} · ${b.days_left} hari (${b.expiry_date})`).join('\n') + '\n' : '') +
    (low.length ? `**Stok menipis:** ` + low.slice(0, 15).map((d) => `${d.generic_name || d.drug_code} (${d.stock_qty}/${d.min_stock})`).join(', ') : '');
  const secSafety = (ov.length ? `**⚠ Warning keselamatan di-OVERRIDE (butuh tinjauan apoteker):**\n` + ov.slice(0, 12).map((r) => `- ${r.rx_number || '—'} · ${r.patient_name || ''} · dr ${r.doctor_name || '—'} · ${r.kind}`).join('\n') + '\n' : '') +
    (ctl.length ? `**Obat terkontrol diserahkan tanpa identitas penerima:**\n` + ctl.slice(0, 10).map((d) => `- ${d.dispense_number || '—'} · ${d.patient_name || ''}`).join('\n') : '');
  const secNarco = `**Register narkotika/psikotropika:** ${sm.narco_moves_30d ?? 0} pergerakan (30 hari)` +
    (ctl.length ? `\n⚠ ${ctl.length} penyerahan terkontrol tanpa identitas penerima — lengkapi register.` : '');
  if (focus === 'expiry') return head + secExp;
  if (focus === 'safety') return head + secSafety;
  if (focus === 'narco') return head + secNarco;
  return head + secExp + '\n\n' + secSafety + '\n\n' + secNarco;
}
async function handlePharmaScan(t: Task, focus: string) {
  const s = await rpc('agentic_pharma_scan', {}) as Dict; const sm = (s.summary || {}) as Dict;
  const md = pharmaReport(s, focus);
  const critical = Number(sm.expired || 0) > 0 || Number(sm.override_rx || 0) > 0 || Number(sm.controlled_no_id || 0) > 0;
  if ((focus === 'all' && critical) || (focus === 'safety' && Number(sm.override_rx || 0) > 0) || (focus === 'narco' && Number(sm.controlled_no_id || 0) > 0)) {
    await rpc('agentic_msg_add', { p: { from_agent: focus === 'narco' ? 'PHARMA_NARCO' : focus === 'safety' ? 'PHARMA_SAFETY' : 'PHARMA_HEAD',
      to_agent: 'ACE', kind: 'ALERT', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...s }, note: `Farmasi: ${sm.expired ?? 0} kedaluwarsa · ${sm.override_rx ?? 0} override · ${sm.controlled_no_id ?? 0} tanpa ID` };
}
function wardReport(s: Dict, focus: string): string {
  const sm = (s.summary || {}) as Dict; const oc = (s.occupancy || {}) as Dict;
  const ls = (s.long_stay || []) as Dict[]; const zc = (s.zero_charge || []) as Dict[];
  const head = `## Patroli Rawat Inap — ${new Date().toLocaleDateString('id-ID')}\n` +
    `Okupansi: ${sm.occupancy_pct ?? 0}% (${oc.terisi ?? 0}/${oc.total ?? 0} bed) · dirawat: ${sm.admitted_now ?? 0} · LOS panjang: ${sm.long_stay ?? 0} · charge nol: ${sm.zero_charge ?? 0}\n\n`;
  const secBed = `**Bed:** terisi ${oc.terisi ?? 0} · kosong ${oc.kosong ?? 0} · total ${oc.total ?? 0}`;
  const secLos = ls.length ? `**Pasien LOS panjang (tinjau klinis):**\n` + ls.slice(0, 12).map((x) => `- ${x.patient_name || '—'} · bed ${x.bed_no || '—'} · ${x.days} hari · ${x.admit_diagnosis || ''}`).join('\n') : '';
  const secCharge = zc.length ? `**⚠ Pulang dengan charge nol (kemungkinan belum ditagih):**\n` + zc.slice(0, 12).map((x) => `- ${x.patient_name || '—'} · bed ${x.bed_no || '—'} · pulang ${String(x.discharged_at || '').slice(0, 10)}`).join('\n') : '';
  if (focus === 'bed') return head + secBed;
  if (focus === 'los') return head + secLos;
  if (focus === 'charge') return head + secCharge;
  return head + secBed + '\n\n' + secLos + '\n\n' + secCharge;
}
async function handleWardScan(t: Task, focus: string) {
  const s = await rpc('agentic_inpatient_scan', {}) as Dict; const sm = (s.summary || {}) as Dict;
  const md = wardReport(s, focus);
  if ((focus === 'all' && (Number(sm.long_stay || 0) > 0 || Number(sm.zero_charge || 0) > 0)) || (focus === 'charge' && Number(sm.zero_charge || 0) > 0)) {
    await rpc('agentic_msg_add', { p: { from_agent: focus === 'charge' ? 'WARD_REV' : 'WARD_HEAD', to_agent: 'ACE', kind: 'INFO', body: md } }).catch(() => null);
  }
  return { result: { markdown: md, ...s }, note: `Rawat inap: okupansi ${sm.occupancy_pct ?? 0}% · ${sm.long_stay ?? 0} LOS panjang · ${sm.zero_charge ?? 0} charge nol` };
}
const handlePharmaTick = (t: Task) => handlePharmaScan(t, 'all');
const handleDrugExpiry = (t: Task) => handlePharmaScan(t, 'expiry');
const handleRxSafety = (t: Task) => handlePharmaScan(t, 'safety');
const handleNarcoAudit = (t: Task) => handlePharmaScan(t, 'narco');
const handleWardTick = (t: Task) => handleWardScan(t, 'all');
const handleBedWatch = (t: Task) => handleWardScan(t, 'bed');
const handleLosWatch = (t: Task) => handleWardScan(t, 'los');
const handleChargeAudit = (t: Task) => handleWardScan(t, 'charge');

const HANDLERS: Record<string, (t: Task) => Promise<{ result: unknown; note: string }>> = {
  SMOKE_TEST: handleSmokeTest,
  // Fase 7M — Pharmacy & Inpatient:
  PHARMA_TICK: handlePharmaTick, DRUG_EXPIRY: handleDrugExpiry, RX_SAFETY: handleRxSafety, NARCO_AUDIT: handleNarcoAudit,
  WARD_TICK: handleWardTick, BED_WATCH: handleBedWatch, LOS_WATCH: handleLosWatch, CHARGE_AUDIT: handleChargeAudit,
  // Fase 7L — Biz-Ops (Finance · Growth/CRM · CX · Exec):
  FIN_TICK: handleFinTick, AR_AGING: handleArAging, REV_LEAK: handleRevLeak, RECON: handleRecon,
  GROWTH_TICK: handleGrowthTick, LEAD_SCORE: handleLeadScore, DEAL_HYGIENE: handleDealHygiene, MOU_WATCH: handleMouWatch,
  CX_TICK: handleCxTick, COMPLAINT_TRIAGE: handleComplaintTriage, FEEDBACK_SUMMARY: handleFeedbackSummary,
  EXEC_DIGEST: handleExecDigest,
  // Fase 7K — task reserved diaktifkan + video wiring:
  MASTER_LIST: handleMasterList,
  DOC_DISTRIBUTE: handleDocDistribute,
  DOC_OBSOLETE: handleDocObsolete,
  ROSTER_CHECK: handleRosterCheck,
  PLAN_CAMPAIGN: handlePlanCampaign,
  MAKE_VIDEO: handleMakeVideo,
  // Fase 7H — Lab Operations Assurance:
  LAB_TICK: handleLabTick,
  QC_WATCH: handleQcWatch,
  TAT_MONITOR: handleTatMonitor,
  CRITICAL_WATCH: handleCriticalWatch,
  // Fase 7G — IT expansion:
  INTEGRATION_HEALTH: handleIntegrationHealth,
  BACKUP_VERIFY: handleBackupVerify,
  // Fase 7I — People & Credentialing:
  HR_TICK: handleHrTick,
  CRED_WATCH: handleCredWatch,
  // Fase 7J — Supply Chain:
  SCM_TICK: handleScmTick,
  STOCK_WATCH: handleStockWatch,
  PO_DRAFT: handlePoDraft,
  // Fase 7F — Departemen IT:
  IT_SEC_AUDIT: handleItSecAudit,
  // Fase 7C — Audit & CAPA:
  AUDIT_EXECUTE: handleAuditExecute,
  CAPA_TRACK: handleCapaTrack,
  // Fase 7 — Departemen Service Assurance & Marketing:
  SA_TICK: handleSaTick,
  MKT_TICK: handleMktTick,
  CONTENT_ANALYSIS: handleContentAnalysis,
  MAKE_CAROUSEL: handleMakeCarousel,
  SEO_RESEARCH: handleSeoResearch,
  MAKE_BLOG_SEO: handleMakeBlogSeo,
  MAKE_DESIGN_BRIEF: handleMakeDesignBrief,
  AUDIT_PLAN: handleAuditPlan,
  REG_WATCH: handleRegWatch,
  // Fase 6 — Organisasi:
  QA_REVIEW: handleQaReview,
  HEAD_TICK: handleHeadTick,
  IT_CHECK: handleItCheck,
  // Fase 2 — Document Compliance Agent:
  DOC_INGEST: handleDocIngest,
  GAP_ANALYSIS: handleGapAnalysis,
  DOC_REPAIR: handleDocRepair,
  DOC_GENERATE: handleDocGenerate,
  DOC_REVIEW_CYCLE: handleReviewCycle,
  // Fase 3 — Content & Branding Agent:
  PLAN_WEEKLY: handlePlanWeekly,
  MAKE_SOSMED: handleMakeSosmed,
  MAKE_ARTIKEL: handleMakeArtikel,
  MAKE_PPTX_DOKTER: handleMakePptx,
  MAKE_EVENT_BRIEF: handleMakeEventBrief,
};

// ═══ FASE 4 — NOTIFIKASI (opsional, §Fase4) ═════════════════════════
// Set secret AGENTIC_NOTIFY_WEBHOOK = URL webhook (n8n / WhatsApp gateway /
// Slack-compatible). Dipanggil non-fatal saat ada draft baru menunggu approval.
async function notifyDrafts(results: Record<string, unknown>[]) {
  const url = Deno.env.get('AGENTIC_NOTIFY_WEBHOOK');
  if (!url) return;
  const drafts = results.filter((r) => r.status === 'DRAFT');
  if (!drafts.length) return;
  const text = `🤖 OneLab Agentic: ${drafts.length} draft baru menunggu approval:\n` +
    drafts.map((d) => `• ${d.note}`).join('\n') + `\nBuka menu Agentic AI → Approval Inbox.`;
  try {
    await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'onelab-agentic', count: drafts.length }),
    });
  } catch { /* non-fatal */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Kill switch (§9.8)
  if ((Deno.env.get('AGENTIC_PAUSED') || '').toLowerCase() === 'true') {
    return json({ paused: true, processed: 0, results: [] });
  }

  const body = await req.json().catch(() => ({}));
  const max = Math.min(parseInt(body.max ?? MAX_PER_TICK, 10) || MAX_PER_TICK, 5);
  const agent = body.agent ?? null;
  const results: Record<string, unknown>[] = [];
  // Anggaran waktu: task berat (Nemotron 550B ±50 dtk) tidak boleh membuat
  // invocation menembus batas kill Edge Function (~150 dtk → HTTP 504).
  // Setelah 1 task selesai & waktu terpakai >100 dtk, berhenti klaim baru.
  const tickDeadline = Date.now() + 100_000;

  for (let i = 0; i < max; i++) {
    if (i > 0 && Date.now() > tickDeadline) break;
    let task: Task | null = null;
    try {
      const rows = await rpc('agentic_claim_task', { p_worker: WORKER_ID, p_agent: agent });
      task = Array.isArray(rows) ? rows[0] ?? null : rows ?? null;
    } catch (e) {
      return json({ error: `Gagal klaim task: ${e instanceof Error ? e.message : String(e)}` }, 500);
    }
    if (!task) break; // queue kosong

    const handler = HANDLERS[task.task_type];
    if (!handler) {
      await rpc('agentic_transition', {
        p_task_id: task.id, p_to: 'FAILED', p_actor_type: 'WORKER',
        p_error: `Handler '${task.task_type}' belum diimplementasikan (lihat Fase 2/3)`,
        p_note: 'handler tidak ditemukan',
      }).catch(() => null);
      results.push({ taskId: task.id, status: 'FAILED', note: `handler ${task.task_type} belum ada` });
      continue;
    }

    try {
      const { result, note } = await handler(task);
      await rpc('agentic_transition', {
        p_task_id: task.id, p_to: 'DRAFT', p_actor_type: 'WORKER',
        p_result: result, p_note: note,
      });
      results.push({ taskId: task.id, status: 'DRAFT', note });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await rpc('agentic_transition', {
        p_task_id: task.id, p_to: 'FAILED', p_actor_type: 'WORKER', p_error: msg, p_note: 'handler error',
      }).catch(() => null);
      results.push({ taskId: task.id, status: 'FAILED', note: msg });
    }
  }

  await notifyDrafts(results);

  // Jika jumlah task yang diproses mencapai batas maksimal (max),
  // kemungkinan masih ada antrean tersisa. Picu kembali worker secara asinkron.
  if (results.length === max) {
    console.log(`[Worker] Batas maksimal batch ${max} tercapai. Memicu kembali worker di background...`);
    const triggerUrl = `${SB_URL}/functions/v1/agentic-worker`;
    const triggerOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SB_KEY}` },
      body: JSON.stringify({ max, agent })
    };
    try {
      fetch(triggerUrl, triggerOpts).catch(() => null);
    } catch { /* abaikan error */ }
  }

  return json({ worker: WORKER_ID, processed: results.length, results });
});
