-- Run once in Supabase Dashboard > SQL Editor for an existing installation.
alter table public.whitelist
  add column if not exists is_iot_lab_member boolean not null default false;
