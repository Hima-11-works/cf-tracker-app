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


-- Paginate leaderboard rows in Postgres after computing global solved counts and ranks.
create index if not exists problem_progress_accepted_handle_idx
  on public.problem_progress (codeforces_handle)
  where status = 'accepted';

create or replace function public.get_leaderboard_page(
  p_limit integer default 10,
  p_offset integer default 0,
  p_exclude_iot_lab_members boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_whitelist as (
    select codeforces_handle, is_iot_lab_member
    from public.whitelist
    where is_active
      and (not coalesce(p_exclude_iot_lab_members, false) or not is_iot_lab_member)
  ),
  scores as (
    select
      roster.codeforces_handle,
      roster.is_iot_lab_member,
      count(progress.problem_id)::bigint as solved
    from active_whitelist as roster
    left join public.problem_progress as progress
      on progress.codeforces_handle = roster.codeforces_handle
      and progress.status = 'accepted'
    group by roster.codeforces_handle, roster.is_iot_lab_member
  ),
  ranked as (
    select
      codeforces_handle,
      is_iot_lab_member,
      solved,
      rank() over (order by solved desc) as leaderboard_rank
    from scores
  )
  select jsonb_build_object(
    'leaderboard',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'handle', page.codeforces_handle,
            'solved', page.solved,
            'rank', page.leaderboard_rank,
            'isIotLabMember', page.is_iot_lab_member
          )
          order by page.solved desc, page.codeforces_handle asc
        )
        from (
          select *
          from ranked
          order by solved desc, codeforces_handle asc
          limit greatest(1, least(coalesce(p_limit, 10), 50))
          offset greatest(coalesce(p_offset, 0), 0)
        ) as page
      ),
      '[]'::jsonb
    ),
    'totalCount', (select count(*) from ranked),
    'problemCount', (select count(*) from public.problems)
  );
$$;

revoke all on function public.get_leaderboard_page(integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.get_leaderboard_page(integer, integer, boolean) to service_role;
