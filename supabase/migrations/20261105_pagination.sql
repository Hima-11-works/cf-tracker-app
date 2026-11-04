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
