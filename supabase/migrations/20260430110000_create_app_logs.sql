create or replace function public.can_manage_app_logs()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  ) or exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.can_manage_roles = true
  );
$$;

create table if not exists public.app_log_settings (
  id integer primary key,
  retention_days integer not null default 90 check (retention_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

insert into public.app_log_settings (id, retention_days)
values (1, 90)
on conflict (id) do nothing;

create or replace function public.app_log_retention_days()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select retention_days from public.app_log_settings where id = 1),
    90
  );
$$;

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid null references auth.users(id),
  actor_email text null,
  source text not null default 'user',
  severity text not null default 'info',
  action text not null,
  entity_type text null,
  entity_id text null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  path text null
);

create index if not exists app_logs_created_at_idx on public.app_logs (created_at desc);
create index if not exists app_logs_action_idx on public.app_logs (action);
create index if not exists app_logs_entity_idx on public.app_logs (entity_type, entity_id);

alter table public.app_logs enable row level security;
alter table public.app_log_settings enable row level security;

drop policy if exists "Authenticated users can insert app logs" on public.app_logs;
create policy "Authenticated users can insert app logs"
on public.app_logs
for insert
to authenticated
with check (true);

drop policy if exists "Admins can view app logs" on public.app_logs;
create policy "Admins can view app logs"
on public.app_logs
for select
to authenticated
using (public.can_manage_app_logs());

drop policy if exists "Authenticated users can purge expired app logs" on public.app_logs;
create policy "Authenticated users can purge expired app logs"
on public.app_logs
for delete
to authenticated
using (
  created_at < now() - make_interval(days => public.app_log_retention_days())
);

drop policy if exists "Admins can view app log settings" on public.app_log_settings;
create policy "Admins can view app log settings"
on public.app_log_settings
for select
to authenticated
using (public.can_manage_app_logs());

drop policy if exists "Admins can update app log settings" on public.app_log_settings;
create policy "Admins can update app log settings"
on public.app_log_settings
for update
to authenticated
using (public.can_manage_app_logs())
with check (public.can_manage_app_logs());

drop policy if exists "Admins can insert app log settings" on public.app_log_settings;
create policy "Admins can insert app log settings"
on public.app_log_settings
for insert
to authenticated
with check (public.can_manage_app_logs());
