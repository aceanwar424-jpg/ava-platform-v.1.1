-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Task Management System
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. work_schedules ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id              bigint generated always as identity primary key,
  employee_id     bigint references public.employees(id) ON DELETE CASCADE,
  shift_name      text NOT NULL,
  jam_masuk       time NOT NULL,
  jam_pulang      time NOT NULL,
  is_cross_midnight boolean DEFAULT false,
  hari_kerja      text DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
  kapasitas_jam   numeric GENERATED ALWAYS AS (
    CASE WHEN is_cross_midnight
      THEN EXTRACT(EPOCH FROM (jam_pulang + INTERVAL '24 hours' - jam_masuk))/3600 - 1
      ELSE EXTRACT(EPOCH FROM (jam_pulang - jam_masuk))/3600 - 1
    END
  ) STORED,
  primary_max_pct integer DEFAULT 80,
  is_active       boolean DEFAULT true,
  notes           text,
  created_by      text,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

-- ── 2. tasks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id              bigint generated always as identity primary key,
  title           text NOT NULL,
  type            text DEFAULT 'PRIMARY',  -- PRIMARY, SECONDARY
  category        text DEFAULT 'Admin',    -- Meeting, Lapangan, Admin, Riset, Lainnya
  description     text,
  assigned_to     text,                    -- user full_name
  assigned_to_id  bigint,                  -- employee id
  assigned_by     text,
  due_date        date,
  due_time        time,
  alokasi_jam     numeric DEFAULT 1,
  actual_jam      numeric DEFAULT 0,
  status          text DEFAULT 'Todo',     -- Todo, InProgress, Done, Blocked, CarryOver
  priority        text DEFAULT 'Normal',   -- Low, Normal, High, Critical
  carry_over_from bigint references public.tasks(id),
  carry_over_note text,
  carry_over_count integer DEFAULT 0,
  tags            text,                    -- comma separated
  completed_at    timestamp,
  completed_note  text,
  created_by      text,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

-- ── 3. task_links ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_links (
  id              bigint generated always as identity primary key,
  task_id         bigint NOT NULL references public.tasks(id) ON DELETE CASCADE,
  label           text,
  url             text NOT NULL,
  type            text DEFAULT 'link',     -- link, gdoc, gdrive, notion, figma, other
  created_at      timestamp DEFAULT now()
);

-- ── 4. task_logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_logs (
  id              bigint generated always as identity primary key,
  task_id         bigint NOT NULL references public.tasks(id) ON DELETE CASCADE,
  action          text NOT NULL,           -- created, status_change, comment, time_update, link_added, assigned
  old_value       text,
  new_value       text,
  note            text,
  by_user         text,
  created_at      timestamp DEFAULT now()
);

-- ── 5. daily_logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id                  bigint generated always as identity primary key,
  employee_id         bigint references public.employees(id),
  employee_name       text,
  tanggal             date NOT NULL,
  summary             text,
  kendala             text,
  rencana_besok       text,
  total_jam_plan      numeric DEFAULT 0,
  total_jam_actual    numeric DEFAULT 0,
  task_done_count     integer DEFAULT 0,
  task_pending_count  integer DEFAULT 0,
  carry_over_count    integer DEFAULT 0,
  mood                integer,             -- 1=exhausted, 2=ok, 3=good, 4=great
  status              text DEFAULT 'Draft', -- Draft, Submitted, Approved, Revision
  submitted_at        timestamp,
  spv_id              bigint,
  spv_name            text,
  approved_by_spv     text,
  approved_at_spv     timestamp,
  spv_notes           text,
  manager_viewed_at   timestamp,
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now(),
  UNIQUE(employee_id, tanggal)
);

-- ── 6. notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_notifications (
  id              bigint generated always as identity primary key,
  user_name       text NOT NULL,
  type            text NOT NULL,  -- task_assigned, task_reminder, carry_over, logbook_due, logbook_approved, logbook_revision
  title           text,
  message         text,
  link_action     text,           -- navigate target
  is_read         boolean DEFAULT false,
  created_at      timestamp DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to    ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date       ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_links_task_id   ON public.task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id    ON public.task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_emp_date  ON public.daily_logs(employee_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_task_notif_user      ON public.task_notifications(user_name, is_read);
CREATE INDEX IF NOT EXISTS idx_work_schedules_emp   ON public.work_schedules(employee_id);

-- ── Disable RLS ───────────────────────────────────────────────
ALTER TABLE public.work_schedules    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_links        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notifications DISABLE ROW LEVEL SECURITY;

-- ✅ Migration Task Management selesai
