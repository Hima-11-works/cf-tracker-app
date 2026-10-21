-- Run this once in Supabase Dashboard > SQL Editor.
-- The app uses a server-only Supabase secret key, so no browser policies are needed.

create table if not exists public.whitelist (
  id uuid primary key default gen_random_uuid(),
  codeforces_handle text not null unique,
  is_active boolean not null default true,
  is_iot_lab_member boolean not null default false,
  created_at timestamptz not null default now()
);

-- Also upgrades an existing whitelist table when this schema is rerun.
alter table public.whitelist
  add column if not exists is_iot_lab_member boolean not null default false;

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  contest_id integer not null check (contest_id > 0),
  problem_index text not null,
  name text not null,
  rating integer check (rating is null or rating >= 0),
  section text not null default 'Probation Sheet',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  unique (contest_id, problem_index)
);

create table if not exists public.problem_progress (
  id uuid primary key default gen_random_uuid(),
  codeforces_handle text not null references public.whitelist(codeforces_handle) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  status text not null default 'not_attempted'
    check (status in ('not_attempted', 'accepted', 'tle_mle', 'wrong_answer')),
  accepted_at timestamptz,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (codeforces_handle, problem_id),
  check ((status = 'accepted') or accepted_at is null)
);

create index if not exists problem_progress_handle_idx
  on public.problem_progress (codeforces_handle);
create index if not exists problem_progress_status_idx
  on public.problem_progress (status);
create index if not exists problems_order_idx
  on public.problems (order_index);

alter table public.whitelist enable row level security;
alter table public.problems enable row level security;
alter table public.problem_progress enable row level security;

revoke all on public.whitelist, public.problems, public.problem_progress from anon, authenticated;
grant select, insert, update, delete on public.whitelist, public.problems, public.problem_progress to service_role;

-- No policies are created for anon or authenticated. All app data access goes
-- through server routes that authenticate admin edits and use a secret key.
