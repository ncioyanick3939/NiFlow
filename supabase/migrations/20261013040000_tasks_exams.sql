-- Prüfungen und Aufgaben. Eine Prüfung kann mehrere Lernaufgaben (tasks.exam_id)
-- und Lerntermine (entries.exam_id) haben. Alles gehört dem Nutzer und ist per RLS geschützt.

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  subject text not null default '' check (char_length(subject) <= 120),
  start_at timestamptz not null,
  end_at timestamptz,
  location text not null default '' check (char_length(location) <= 200),
  format text not null default '' check (char_length(format) <= 120),
  description text not null default '' check (char_length(description) <= 5000),
  topics text not null default '' check (char_length(topics) <= 5000),
  notes text not null default '' check (char_length(notes) <= 5000),
  priority text not null default 'high' check (priority in ('low', 'medium', 'high', 'urgent')),
  prep_status text not null default 'not_started' check (prep_status in ('not_started', 'in_progress', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  due_date date,
  due_time time,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  category text not null default 'study' check (category in ('training', 'work', 'study', 'private')),
  exam_id uuid references public.exams(id) on delete set null,
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes between 5 and 1440),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_time is null or due_date is not null)
);

alter table public.entries
  add column exam_id uuid references public.exams(id) on delete set null,
  add column task_id uuid references public.tasks(id) on delete set null;

create index tasks_user_due on public.tasks (user_id, due_date);
create index tasks_exam on public.tasks (exam_id);
create index exams_user_start on public.exams (user_id, start_at);
create index entries_exam on public.entries (exam_id);

alter table public.exams enable row level security;
alter table public.tasks enable row level security;

create policy "exams select own" on public.exams for select to authenticated using (user_id = (select auth.uid()));
create policy "exams insert own" on public.exams for insert to authenticated with check (user_id = (select auth.uid()));
create policy "exams update own" on public.exams for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exams delete own" on public.exams for delete to authenticated using (user_id = (select auth.uid()));

create policy "tasks select own" on public.tasks for select to authenticated using (user_id = (select auth.uid()));
create policy "tasks insert own" on public.tasks for insert to authenticated with check (user_id = (select auth.uid()));
create policy "tasks update own" on public.tasks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tasks delete own" on public.tasks for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.exams to authenticated, service_role;
grant select, insert, update, delete on table public.tasks to authenticated, service_role;
