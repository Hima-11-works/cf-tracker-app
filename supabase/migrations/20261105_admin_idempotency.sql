create table if not exists public.admin_idempotency_keys (
  idempotency_key uuid primary key,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_idempotency_keys enable row level security;

revoke all on table public.admin_idempotency_keys from public, anon, authenticated;
grant all on table public.admin_idempotency_keys to service_role;
