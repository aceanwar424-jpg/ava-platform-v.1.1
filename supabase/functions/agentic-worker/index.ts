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
async function makeImage(t: Task, prompt: string): Promise<string | null> {
  try {
    const res = await fetch(`${SB_URL}/functions/v1/llm-gateway`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'image', prompt, taskId: t.id }),
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
  const md = `## Laporan Kepala IT — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    (verdicts.length ? verdicts.map((v) => `- ${v}`).join('\n') : `- diag: ${diag.error || 'tidak ada data'}`) +
    `\n- Task macet dibebaskan: ${reap?.reaped ?? 0}\n- Task FAILED terbuka: ${failedOpen}`;

  if (bad.length || failedOpen > 3 || diag.error) {
    await rpc('agentic_msg_add', { p: { from_agent: 'IT_HEAD', to_agent: 'ACE', kind: 'ALERT',
      body: md } });
  }
  return {
    result: { verdicts, reaped: reap?.reaped ?? 0, failed_open: failedOpen, markdown: md },
    note: `IT: ${bad.length ? bad.length + ' jalur bermasalah' : 'semua jalur sehat'} · reap ${reap?.reaped ?? 0} · FAILED ${failedOpen}`,
  };
}

const HANDLERS: Record<string, (t: Task) => Promise<{ result: unknown; note: string }>> = {
  SMOKE_TEST: handleSmokeTest,
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

  for (let i = 0; i < max; i++) {
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
  return json({ worker: WORKER_ID, processed: results.length, results });
});
