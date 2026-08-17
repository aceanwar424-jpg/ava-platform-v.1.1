-- 0010 — Sumber data kanvas orkestrator agentic
--
-- Tab "Orchestrator & A2A" selama ini menampilkan data KARANGAN: daftar
-- agen diketik langsung di modules/agentic/orchestrator.js, seluruh status
-- 'ACTIVE', dan angka closedLoopCount (1420, 890, 450, 310, 620) hanyalah
-- angka yang diketik. Layar itu tampak seperti pemantauan langsung padahal
-- tidak membaca apa pun.
--
-- Data sungguhannya sudah ada sejak lama di skema agentic. RPC ini
-- menyatukannya dalam satu panggilan supaya kanvas tidak perlu memukul
-- empat endpoint tiap kali menyegarkan.
--
-- Hanya-baca. Tidak ada satu pun operasi tulis di sini.

CREATE OR REPLACE FUNCTION public.agentic_canvas(p_jam integer DEFAULT 24)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, agentic
AS $$
  SELECT jsonb_build_object(

    -- NODE: siapa agennya, termasuk garis pelaporan untuk tata letak hierarki.
    'agents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'code', a.code, 'name', a.name, 'role', a.role_title,
        'reports_to', a.reports_to, 'tier', a.model_tier,
        'active', a.active, 'charter', left(a.charter, 400),
        -- Beban kerja nyata, dihitung dari tabel tugas — bukan angka tetap.
        'aktif',   (SELECT count(*) FROM agentic.tasks t
                     WHERE t.agent = a.code AND t.status IN ('RUNNING','PROCESSING','CLAIMED')),
        'antre',   (SELECT count(*) FROM agentic.tasks t
                     WHERE t.agent = a.code AND t.status = 'QUEUED'),
        'selesai', (SELECT count(*) FROM agentic.tasks t
                     WHERE t.agent = a.code AND t.status IN ('DONE','APPROVED')
                       AND t.created_at > now() - make_interval(hours => p_jam)),
        'gagal',   (SELECT count(*) FROM agentic.tasks t
                     WHERE t.agent = a.code AND t.status IN ('FAILED','REJECTED')
                       AND t.created_at > now() - make_interval(hours => p_jam))
      ) ORDER BY a.code)
      FROM agentic.agents a
    ), '[]'::jsonb),

    -- STATE & EXECUTION: tugas yang sedang berjalan, beserta masukan dan
    -- keluarannya. payload = parameter masuk, result = deliverable.
    'tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'agent', t.agent, 'jenis', t.task_type,
        'status', t.status, 'judul', left(t.title, 200),
        'prioritas', t.priority, 'percobaan', t.attempts,
        'induk', t.parent_task_id,
        'perlu_review', t.needs_medical_review,
        'galat', left(t.error_message, 200),
        'ada_masukan', (t.payload IS NOT NULL AND t.payload <> '{}'::jsonb),
        'ada_keluaran', (t.result IS NOT NULL),
        'dibuat', t.created_at
      ) ORDER BY t.created_at DESC)
      FROM agentic.tasks t
      WHERE t.created_at > now() - make_interval(hours => p_jam)
         OR t.status IN ('QUEUED','RUNNING','PROCESSING','CLAIMED')
    ), '[]'::jsonb),

    -- DATA FLOW: jalur delegasi antar-agen (A2A) dalam rentang waktu.
    'edges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'dari', m.from_agent, 'ke', m.to_agent,
        'jenis', m.kind, 'jumlah', m.n, 'terakhir', m.terakhir))
      FROM (
        SELECT from_agent, to_agent, kind, count(*) n, max(created_at) terakhir
          FROM agentic.agent_messages
         WHERE created_at > now() - make_interval(hours => p_jam)
         GROUP BY from_agent, to_agent, kind
      ) m
    ), '[]'::jsonb),

    -- LOG MONITOR: jejak perpindahan status — inti telusur keputusan.
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'task_id', e.task_id, 'dari', e.from_status, 'ke', e.to_status,
        'pelaku', e.actor_type, 'catatan', left(e.note, 240), 'waktu', e.created_at))
      FROM (
        SELECT * FROM agentic.task_events
         WHERE created_at > now() - make_interval(hours => p_jam)
         ORDER BY created_at DESC LIMIT 200
      ) e
    ), '[]'::jsonb),

    'rentang_jam', p_jam,
    'diambil_pada', now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.agentic_canvas(integer) TO anon, authenticated, service_role;
